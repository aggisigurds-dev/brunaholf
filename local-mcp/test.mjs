// test.mjs — offline self-test for the Brunahólf local MCP server.
//
//   node test.mjs   (or: npm test)
//
// Verifies the tool functions run with the real deps installed, that the
// hand-rolled zod→JSON-schema converter marks the right args required, and
// that http_fetch no longer crashes on a GET carrying a body. No network and
// no external services: http_fetch is exercised against a throwaway localhost
// server so this passes anywhere (incl. CI / the cloud sandbox).

import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tools, callTool, zodToJsonSchema } from './server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let passed = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failures.push(name + (extra ? ' — ' + extra : '')); console.log('  ✗', name, extra || ''); }
}

// 1) Schema converter marks the correct args required.
{
  const req = (n) => zodToJsonSchema(tools.find(t => t.name === n).inputSchema).required.sort();
  ok('list_dir requires [path]', JSON.stringify(req('list_dir')) === '["path"]');
  ok('http_fetch requires only [url]', JSON.stringify(req('http_fetch')) === '["url"]');
  ok('upload requires [drive_folder_id, local_path]',
     JSON.stringify(req('upload_to_drive_via_brunaholf')) === '["drive_folder_id","local_path"]');
  const s = zodToJsonSchema(tools.find(t => t.name === 'http_fetch').inputSchema);
  ok('http_fetch method is an enum', s.properties.method && Array.isArray(s.properties.method.enum));
}

// 2) Filesystem tools work on this repo folder.
{
  const dir = await callTool('list_dir', { path: HERE });
  ok('list_dir sees server.mjs', dir.entries.some(e => e.name === 'server.mjs'));

  const info = await callTool('file_info', { path: join(HERE, 'package.json') });
  ok('file_info reports a file', info.kind === 'file' && info.size_bytes > 0);

  const txt = await callTool('read_file_text', { path: join(HERE, 'package.json') });
  ok('read_file_text reads package.json', txt.text.includes('brunaholf-local-mcp'));

  const tiny = await callTool('read_file_text', { path: join(HERE, 'package.json'), max_kb: 1 });
  ok('read_file_text honours max_kb', tiny.returned_bytes <= 1024);
}

// 3) http_fetch against a throwaway localhost server — incl. the GET+body case
//    that used to throw "Request with GET/HEAD method cannot have body".
{
  const srv = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ hello: 'world', method: req.method }));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}/`;
  try {
    const g = await callTool('http_fetch', { url: base, method: 'GET' });
    ok('http_fetch GET works + parses json', g.ok && g.body_json && g.body_json.hello === 'world');

    // The regression fix: a GET with a body must not throw, body is ignored.
    const gb = await callTool('http_fetch', { url: base, method: 'GET', body: 'ignored' });
    ok('http_fetch GET+body does not crash', gb.ok === true);

    const p = await callTool('http_fetch', { url: base, method: 'POST', body: '{"x":1}' });
    ok('http_fetch POST works', p.ok && p.body_json.method === 'POST');
  } finally {
    srv.close();
  }
}

// 4) Bad tool name is rejected.
{
  let threw = false;
  try { await callTool('does_not_exist', {}); } catch (_) { threw = true; }
  ok('unknown tool rejected', threw);
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.error('FAILURES:\n- ' + failures.join('\n- ')); process.exit(1); }
