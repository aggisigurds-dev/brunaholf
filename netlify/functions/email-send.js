// email-send.js — server-side Resend proxy for Brunahólf.
//
//   POST /api/email-send
//   Body: { from, to, subject, html, attachments?: [ {filename, driveId} | {filename, content(base64)} ] }
//
// Auth: RESEND_API_KEY in Netlify env (preferred). Never store the key client-side.
// Drive attachments ({filename, driveId}) are resolved to base64 here via the
// local /api/drive-download (holds the Google OAuth token) — restricted Drive
// PDFs can't be fetched by Resend or the browser directly.
//
// Sendandi verður að vera á staðfestu Resend-léni (eldklar.is). Notað til að
// senda Efnislista/Tímaskjal á bókara (bokhald@brunaholf.is) fyrir Payday.
//
// 2026-07-07: RESEND_API_KEY settur í brunaholf Netlify (afritaður úr Slökkvitæki);
// þessi commit endurbyggir svo functionið sjái nýju env-breytuna.

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON body' }); }

  const apiKey = process.env.RESEND_API_KEY || body.apiKey || '';
  if (!apiKey) return json(400, { error: 'API_KEY_MISSING', message: 'RESEND_API_KEY er ekki stilltur í Netlify (brunaholf)' });

  const { apiKey: _drop, ...payload } = body;
  if (!payload.from || !payload.to || !payload.subject) return json(400, { error: 'Missing from/to/subject' });

  // Resolve Drive attachments → base64 (via the local drive-download function).
  if (Array.isArray(payload.attachments) && payload.attachments.length) {
    const origin = `https://${event.headers && (event.headers.host || event.headers.Host) || 'brunaholf.netlify.app'}`;
    const DRIVE_DL = process.env.DRIVE_DOWNLOAD_URL || `${origin}/api/drive-download`;
    const out = [], warnings = [];
    for (const a of payload.attachments) {
      if (a && a.driveId) {
        try {
          const dr = await fetch(DRIVE_DL + '?id=' + encodeURIComponent(a.driveId));
          const dj = await dr.json().catch(() => ({}));
          if (dr.ok && dj && dj.base64) out.push({ filename: a.filename || dj.name || 'skjal.pdf', content: dj.base64 });
          else warnings.push((a.filename || a.driveId) + ': ' + ((dj && dj.error) || ('HTTP ' + dr.status)));
        } catch (e) { warnings.push((a.filename || a.driveId) + ': ' + String((e && e.message) || e)); }
      } else if (a && a.content) { out.push(a); }
    }
    payload.attachments = out;
    if (!out.length && warnings.length) return json(502, { error: 'ATTACHMENT_FAILED', message: 'Viðhengi náðist ekki: ' + warnings.join('; ') });
  }

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!r.ok) return json(r.status, { error: 'RESEND_ERROR', status: r.status, detail: data });
    return json(200, { ok: true, id: data.id || null });
  } catch (e) {
    return json(502, { error: 'SEND_FAILED', message: String((e && e.message) || e) });
  }
};

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
