'use strict';
/*
 * bh-browser.js — launch Playwright/Chromium so it actually works through
 * a Claude Code web/remote session's egress proxy.
 *
 * THE PROBLEM: modern Chromium (BoringSSL) sends an "ECH GREASE" TLS
 * extension (type 65037) on every HTTPS ClientHello, by design and
 * deliberately hard to turn off (it's an anti-ossification measure — see
 * https://blog.cloudflare.com/tls-encrypted-client-hello/). The remote
 * session's egress proxy re-terminates TLS and its ClientHello parser
 * chokes on that extension, RSTing the connection outright. Plain curl/Node
 * requests don't send it, so only browser automation is affected — a plain
 * `chromium.launch()` fails every `page.goto('https://...')` with
 * net::ERR_CONNECTION_RESET, even though curl to the same host works fine.
 *
 * `--disable-features=EncryptedClientHello` (and every variant of it) was
 * tested against the Chromium build in this environment and does NOT
 * suppress the extension. Rewriting the extension out of the ClientHello
 * bytes in flight was also tried and does NOT work: TLS 1.3's Finished
 * message is a MAC over the exact transcript each side believes it sent, so
 * a middlebox that edits bytes after Chromium has already hashed its
 * original ClientHello breaks the handshake's integrity check even though
 * the proxy itself accepts the edited hello (net::ERR_SSL_PROTOCOL_ERROR
 * instead — progress, but still broken).
 *
 * THE FIX: don't let Chromium's TLS stack talk to the proxy at all. Run a
 * local relay that:
 *   1. Terminates TLS with Chromium itself, playing the server role with a
 *      throwaway self-signed cert. This is safe only because Playwright's
 *      `ignoreHTTPSErrors: true` makes Chromium skip all certificate
 *      validation (any cert, any hostname, is accepted).
 *   2. Opens a completely separate, ordinary Node `tls` connection to the
 *      real target through the egress proxy's CONNECT tunnel. Node's TLS
 *      client never sends ECH GREASE, so this leg negotiates cleanly.
 *   3. Pipes the two decrypted plaintext streams together.
 *
 * Each hop is a complete, self-consistent TLS session terminated by a real
 * implementation, so there's no transcript-integrity problem — this is a
 * real MITM split, not a byte-rewrite. If a future session hits
 * ERR_CONNECTION_RESET again on a fresh Chromium build, re-verify the ECH
 * theory first (capture the ClientHello via a fake local CONNECT proxy and
 * check for extension 65037) before assuming this fix has bit-rotted.
 *
 * Usage (from a Claude Code web/remote session — Chromium + Playwright are
 * pre-installed there; PLAYWRIGHT_BROWSERS_PATH is already set):
 *   const { launch } = require('./tools/bh-browser');
 *   const { context, cleanup } = await launch();
 *   const page = await context.newPage();
 *   await page.goto('https://example.netlify.app');
 *   ...
 *   await cleanup();   // closes browser + local relay
 *
 * The `playwright` package itself is installed GLOBALLY in that
 * environment, not as a dependency of this repo — run with:
 *   NODE_PATH=/opt/node22/lib/node_modules node your-script.js
 * (adjust the path if a future environment snapshot moves it; `npm ls -g
 * playwright` finds the real path if this one 404s).
 */

const net = require('net');
const tls = require('tls');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  throw new Error(
    "bh-browser: require('playwright') failed — it's installed globally in " +
    'the Claude Code remote environment, not as a repo dependency. Re-run ' +
    'this script with NODE_PATH pointing at the global install, e.g.:\n' +
    '  NODE_PATH=/opt/node22/lib/node_modules node your-script.js\n' +
    "If that path is stale, find the real one with `npm ls -g playwright`.\n" +
    'Original error: ' + e.message
  );
}

// One throwaway self-signed cert, generated once per process and reused for
// every target host — fine because ignoreHTTPSErrors disables hostname/CA
// checks on the Chromium side entirely.
let cachedCert = null;
function selfSignedCert() {
  if (cachedCert) return cachedCert;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bh-browser-cert-'));
  const keyPath = path.join(dir, 'key.pem');
  const certPath = path.join(dir, 'cert.pem');
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath,
      '-days', '2', '-nodes', '-subj', '/CN=localhost',
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
    cachedCert = { key: fs.readFileSync(keyPath, 'utf8'), cert: fs.readFileSync(certPath, 'utf8') };
    return cachedCert;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function upstreamProxy() {
  const p = process.env.HTTPS_PROXY || process.env.https_proxy || '';
  const m = p.match(/^https?:\/\/([^:/]+):(\d+)/i);
  return m ? { host: m[1], port: Number(m[2]) } : null;
}

// Open a raw TCP connection to the real target, tunneled through the
// upstream CONNECT proxy if one is configured, otherwise direct.
function dialUpstream(host, port) {
  return new Promise((resolve, reject) => {
    const up = upstreamProxy();
    if (!up) { const s = net.connect(port, host); s.once('connect', () => resolve(s)); s.once('error', reject); return; }
    const sock = net.connect(up.port, up.host);
    sock.once('error', reject);
    sock.once('connect', () => {
      sock.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\nProxy-Connection: Keep-Alive\r\n\r\n`);
    });
    let buf = Buffer.alloc(0);
    const onData = d => {
      buf = Buffer.concat([buf, d]);
      const headerEnd = buf.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      sock.removeListener('data', onData);
      const status = buf.subarray(0, headerEnd).toString('latin1');
      if (!/^HTTP\/1\.[01]\s+2\d\d/.test(status)) { reject(new Error('upstream CONNECT failed: ' + status.split('\r\n')[0])); return; }
      const rest = buf.subarray(headerEnd + 4);
      if (rest.length) sock.unshift(rest);
      resolve(sock);
    };
    sock.on('data', onData);
  });
}

function startRelay() {
  const { key, cert } = selfSignedCert();

  const server = net.createServer(client => {
    let buf = Buffer.alloc(0);
    const onHead = async d => {
      buf = Buffer.concat([buf, d]);
      const lineEnd = buf.indexOf('\r\n');
      if (lineEnd === -1) return;
      client.removeListener('data', onHead);

      const line = buf.subarray(0, lineEnd).toString('latin1');
      const m = line.match(/^CONNECT\s+([^\s:]+):(\d+)\s+HTTP/i);
      if (!m) { client.destroy(); return; }
      const [, host, portStr] = m;
      const port = Number(portStr);

      try {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');

        const tlsClient = new tls.TLSSocket(client, {
          isServer: true, key, cert, ALPNProtocols: ['http/1.1'],
        });

        const rawUp = await dialUpstream(host, port);
        const tlsUp = tls.connect({
          socket: rawUp, servername: host, ALPNProtocols: ['http/1.1'],
          // NODE_EXTRA_CA_CERTS already trusts the egress proxy's re-terminated
          // certs; keep default verification for a real, correct handshake.
        });

        const teardown = () => { tlsClient.destroy(); tlsUp.destroy(); };
        tlsClient.on('error', teardown);
        tlsUp.on('error', teardown);
        tlsClient.pipe(tlsUp);
        tlsUp.pipe(tlsClient);
      } catch (e) {
        client.destroy();
      }
    };
    client.on('data', onHead);
    client.on('error', () => {});
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function launch(opts = {}) {
  const { context: ctxOpts = {}, ...launchOpts } = opts;
  const relay = await startRelay();
  const port = relay.address().port;

  const browser = await chromium.launch({
    headless: opts.headless !== false,
    args: [
      `--proxy-server=http://127.0.0.1:${port}`,
      // Chromium's default proxy-bypass already exempts loopback — keep that
      // default. It matters for local dev servers (127.0.0.1) mixed with real
      // external calls (e.g. Supabase): the local request goes direct, the
      // external one still gets ECH-stripped through the relay.
      '--no-sandbox',
      '--disable-dev-shm-usage',
      ...(launchOpts.args || []),
    ],
    ...launchOpts,
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
    ...ctxOpts,
  });

  const cleanup = async () => {
    await browser.close().catch(() => {});
    relay.close();
  };

  return { browser, context, cleanup, relayPort: port };
}

module.exports = { launch };
