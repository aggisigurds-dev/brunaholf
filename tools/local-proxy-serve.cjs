// Staðbundinn prófunarþjónn fyrir hub-inn: static skrár úr repóinu, en /api/* og /.netlify/* fara á framleiðsluna
// (brunaholf.netlify.app) svo Gerð Reikninga, Redder og Hreyfingaryfirlit sæki alvöru gögn. Aðeins GET/HEAD/OPTIONS
// eru áframsend — skrif (POST/PATCH/PUT/DELETE) fá 405 svo prófun geti aldrei breytt neinu á þjóninum.
//   node tools/local-proxy-serve.cjs [port]      (sjálfgefið 8788)
const http = require('http'), https = require('https'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8788);
const UPSTREAM = 'brunaholf.netlify.app';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/') || u.pathname.startsWith('/.netlify/')) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) { res.writeHead(405, { 'Content-Type': 'text/plain' }); return res.end('prófunarþjónn: skrif ekki áframsend'); }
    const p = https.request({ host: UPSTREAM, path: u.pathname + u.search, method: req.method, headers: { ...req.headers, host: UPSTREAM } }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    p.on('error', e => { res.writeHead(502); res.end(String(e)); });
    return req.pipe(p);
  }
  let fp = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.stat(fp, (err, st) => {
    if (err || !st.isFile()) { if (!path.extname(fp)) { fp = path.join(ROOT, 'index.html'); } else { res.writeHead(404); return res.end('404'); } }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(fp).pipe(res);
  });
}).listen(PORT, () => console.log('hub local → http://localhost:' + PORT + '  (api → ' + UPSTREAM + ', aðeins lestur)'));
