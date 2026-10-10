// Staðbundinn móttakari: vafrinn POSTar gögn hingað, skrifað í scratchpad. Aðeins 127.0.0.1.
const http = require('http'), fs = require('fs'), path = require('path');
const DIR = __dirname;
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
}).listen(8765, '127.0.0.1', () => console.log('listening 8765'));
