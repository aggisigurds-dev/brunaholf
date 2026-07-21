// skjal.js — birtir Drive-skjal BEINT í vafranum (inline), án Google-innskráningar.
// GET /api/skjal?id=FILE_ID
//
// Af hverju: grænu ár-punktarnir í Slökkvitæki „Brunakerfi yfirlit" (patch 272/273)
// og skjalalistar opnuðu drive.google.com/file/d/… — í símum með mörg Google-
// reikninga spyr Google „Select an account" Í HVERT SINN (kvörtun Agnars
// 2026-07-21). Þessi endapunktur sækir skjalið með server-OAuth (sama og
// drive-download.js) og skilar því sem application/pdf inline — enginn
// reikningaveljari, opnast strax.
//
// drive-download.js skilar JSON+base64 fyrir tól; þessi skilar BÆTUNUM með réttu
// content-type fyrir vafrann. Sama 10 MB þak.

const { freshAccessToken, json, cors } = require('./_google');

const MAX_BYTES = 10 * 1024 * 1024;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const id = ((event.queryStringParameters || {}).id || '').trim();
  if (!/^[\w-]{10,}$/.test(id)) return json(400, { error: 'gilt id vantar' });

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  let meta;
  try {
    const mr = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?fields=id,name,mimeType,size&supportsAllDrives=true', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!mr.ok) return json(mr.status, { error: 'meta ' + mr.status });
    meta = await mr.json();
  } catch (e) { return json(500, { error: e.message }); }

  if (meta.size && Number(meta.size) > MAX_BYTES) {
    // of stórt til að streyma héðan — vísa á Drive (gamla leiðin)
    return { statusCode: 302, headers: { Location: 'https://drive.google.com/file/d/' + id + '/view' }, body: '' };
  }

  try {
    const r = await fetch('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media&supportsAllDrives=true', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return json(r.status, { error: 'download ' + r.status });
    const buf = Buffer.from(await r.arrayBuffer());
    const ascii = String(meta.name || 'skjal.pdf').replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    return {
      statusCode: 200,
      headers: {
        'content-type': meta.mimeType || 'application/pdf',
        'content-disposition': 'inline; filename="' + ascii + '"',
        'cache-control': 'public, max-age=3600',
        'access-control-allow-origin': '*',
      },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) { return json(500, { error: e.message }); }
};
