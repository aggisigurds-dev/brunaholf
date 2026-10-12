// Staðbundinn móttakari: vafrinn POSTar gögn hingað. Aðeins 127.0.0.1.
// Skrifar í SINK_DIR eða möppuna sem skriftan er keyrð ÚR (cwd) — ALDREI í skill-möppuna (hún er í git).
// Keyra úr scratchpad:  cd <scratchpad> && node <brunaholf>/.claude/skills/vidmotsprof/sink.cjs
const http = require('http'), fs = require('fs'), path = require('path');
const DIR = process.env.SINK_DIR || process.cwd();
const hdr = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Private-Network': 'true',
};
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, hdr); return res.end(); }
  const u = new URL(req.url, 'http://x');
  const name = (u.searchParams.get('name') || 'dump').replace(/[^a-z0-9_.-]/gi, '');
  if (req.method === 'GET') {
    const f = path.join(DIR, name);
    if (!fs.existsSync(f)) { res.writeHead(404, hdr); return res.end('nf'); }
    res.writeHead(200, { ...hdr, 'Content-Type': 'application/json' });
    return res.end(fs.readFileSync(f));
  }
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const buf = Buffer.concat(chunks);
    fs.writeFileSync(path.join(DIR, name), buf);
    console.log('saved', name, buf.length);
    res.writeHead(200, { ...hdr, 'Content-Type': 'text/plain' });
    res.end('ok ' + buf.length);
  });
}).on('error', e => { console.error(e.code === 'EADDRINUSE' ? 'Port 8765 er þegar í notkun — móttakari keyrir líklega nú þegar (skrifar í SÍNA möppu).' : e.message); process.exit(1); })
  .listen(8765, '127.0.0.1', () => console.log('listening 8765 → ' + DIR));
