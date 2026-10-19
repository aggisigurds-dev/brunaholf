// Staðbundinn prófunarþjónn fyrir adgangar.html: static skrár úr repóinu og /api/hub-adgangar keyrt á
// Supabase-líkani í MINNI (tools/_hub-adgangar-mock.cjs) — ekkert fer á raunverulega þjóninn og engin
// raunveruleg gögn eru lesin. Uppsetningarkóði prófsins er skrifaður út við ræsingu.
//   node tools/dev-hub-adgangar.cjs [port]      (sjálfgefið 8789)
const http = require('http'), fs = require('fs'), path = require('path');
const { CODE } = require('./_hub-adgangar-mock.cjs');
const H = require('../netlify/functions/hub-adgangar.js');
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8789);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/hub-adgangar') {
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', async () => {
      const q = {}; u.searchParams.forEach((v, k) => { q[k] = v; });
      const r = await H.handler({ httpMethod: req.method, body: b || null, headers: { host: req.headers.host, cookie: req.headers.cookie || '' }, queryStringParameters: q });
      res.writeHead(r.statusCode, r.headers); res.end(r.body);
    });
    return;
  }
  const fp = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/adgangar.html' : u.pathname));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(fp, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  });
}).listen(PORT, () => console.log('adgangar dev → http://localhost:' + PORT + '/adgangar.html   uppsetningarkóði prófsins: ' + CODE));
