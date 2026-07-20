/**
 * gmail-send.js — senda tölvupóst BEINT úr tengdu Gmail-pósthólfi.
 *
 * HVERS VEGNA ÞETTA ER TIL (2026-07-20):
 *   Öll póstsending appanna fór gegnum Resend (`email-send.js`), sem krefst þess
 *   að lénið sé STAÐFEST með DNS-færslum. `eldklar.is` er ekki staðfest þar —
 *   Resend svarar 403 „The eldklar.is domain is not verified" á hverja einustu
 *   sendingu. DNS-in liggja hjá Cloudflare og Agnar kemst ekki þangað inn, svo
 *   Resend-leiðin var lokuð.
 *
 *   `eldklar.is` KEYRIR Á GOOGLE WORKSPACE (MX → google.com) og pósthólfin eru
 *   þegar OAuth-tengd hér (`google_oauth`, sjá gmail-ingest.js). Því sendum við
 *   einfaldlega gegnum Gmail sjálft: engin DNS-vinna, réttur sendandi, og
 *   pósturinn LENDIR Í „Sent"-möppunni eins og hann hefði verið sendur í hendi
 *   (Resend-póstur gerði það aldrei).
 *
 * Endapunktur:
 *   GET  /api/gmail-send?status=1        → hvaða pósthólf geta sent
 *   POST /api/gmail-send
 *     { account, to:[…], subject, html, cc?:[…], replyTo?, attachments?:[…] }
 *
 *   Viðhengi — sömu snið og email-send.js tekur, svo kallendur þurfa ekki að breytast:
 *     { filename, content }  base64 (t.d. reikningur teiknaður í vafranum)
 *     { filename, driveId }  skrá í Drive — sótt hér með sama OAuth-tokeni
 *     { filename, url }      opin slóð (t.d. Supabase Storage)
 *
 * ATH: `account` VERÐUR að vera pósthólf sem er tengt með gmail.send-heimild.
 * Eftir að skópinu var bætt við (`_google.js`) þarf að TENGJA HVERT PÓSTHÓLF
 * UPP Á NÝTT einu sinni — gömul token bera ekki nýja skópið.
 */
const { freshAccessTokenFor, listConnectedAccounts, json, cors } = require('./_google');

const GMAIL_SEND = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };

  if (event.httpMethod === 'GET') {
    const accounts = await listConnectedAccounts().catch(() => []);
    return json(200, {
      accounts: (accounts || []).map(a => ({
        email: a.user_email,
        // Token sem var búið til FYRIR skóp-viðbótina getur ekki sent.
        can_send: String(a.scope || '').indexOf('gmail.send') !== -1,
      })),
    });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return json(400, { error: 'Invalid JSON body' }); }

  const account = String(body.account || '').trim();
  const to = [].concat(body.to || []).map(s => String(s || '').trim()).filter(Boolean);
  const subject = String(body.subject || '').trim();
  if (!account) return json(400, { error: 'Missing account', message: 'Hvaða pósthólf á að senda frá?' });
  if (!to.length || !subject) return json(400, { error: 'Missing to/subject' });

  let token;
  try { token = await freshAccessTokenFor(account); }
  catch (e) { token = null; }
  if (!token) {
    return json(400, {
      error: 'NOT_CONNECTED',
      message: 'Pósthólfið ' + account + ' er ekki tengt (eða heimildin útrunnin). ' +
               'Tengdu það í Brunahólf → Bakendi → „☁️ Gmail úr skýi".',
    });
  }

  // ── Viðhengi leyst í base64 ────────────────────────────────────────────────
  const atts = [];
  const warnings = [];
  for (const a of (Array.isArray(body.attachments) ? body.attachments : [])) {
    if (!a) continue;
    const name = a.filename || 'skjal.pdf';
    try {
      if (a.content) {
        atts.push({ filename: name, content: String(a.content), type: a.contentType || guessType(name) });
      } else if (a.driveId) {
        // Sama OAuth-token og sendir — nær í aðgangsstýrðar Drive-skrár.
        const r = await fetch(
          'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(a.driveId) + '?alt=media&supportsAllDrives=true',
          { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) { warnings.push(name + ': Drive HTTP ' + r.status); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        atts.push({ filename: name, content: buf.toString('base64'), type: a.contentType || guessType(name) });
      } else if (a.url) {
        const r = await fetch(a.url);
        if (!r.ok) { warnings.push(name + ': HTTP ' + r.status); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        atts.push({ filename: name, content: buf.toString('base64'), type: a.contentType || guessType(name) });
      }
    } catch (e) { warnings.push(name + ': ' + String((e && e.message) || e)); }
  }

  const mime = buildMime({
    from: body.from || account,       // má vera „Nafn <netfang>" — verður að vera pósthólfið eða alias þess
    to, cc: [].concat(body.cc || []).filter(Boolean),
    replyTo: body.replyTo || '',
    subject,
    html: String(body.html || ''),
    attachments: atts,
  });

  const r = await fetch(GMAIL_SEND, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: b64url(mime) }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j && j.error && j.error.message) || ('HTTP ' + r.status);
    // Skóp-villan er langalgengasta orsökin — segjum nákvæmlega hvað þarf.
    const needsScope = /insufficient|scope|permission/i.test(msg);
    return json(r.status, {
      error: needsScope ? 'SCOPE_MISSING' : 'SEND_FAILED',
      message: needsScope
        ? 'Pósthólfið vantar send-heimild. Tengdu ' + account + ' upp á nýtt í Bakendi → „☁️ Gmail úr skýi".'
        : msg,
      warnings,
    });
  }
  return json(200, { ok: true, id: j.id, threadId: j.threadId, warnings });
};

// ── MIME-smíði ──────────────────────────────────────────────────────────────
// Haus-gildi með íslenskum stöfum verða að fara í RFC 2047 (=?UTF-8?B?…?=),
// annars koma þau brengluð fram hjá viðtakanda.
function enc(s) {
  const v = String(s == null ? '' : s);
  return /^[\x20-\x7E]*$/.test(v) ? v : '=?UTF-8?B?' + Buffer.from(v, 'utf8').toString('base64') + '?=';
}
// Nafn í „Nafn <netfang>" þarf kóðun en netfangið sjálft ALDREI.
function encAddr(a) {
  const m = String(a || '').match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? (enc(m[1]) + ' <' + m[2] + '>') : String(a || '').trim();
}
function wrap(b64) { return (b64.match(/.{1,76}/g) || []).join('\r\n'); }
function b64url(s) {
  return Buffer.from(s, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function guessType(n) {
  const e = String(n).toLowerCase().split('.').pop();
  return e === 'pdf' ? 'application/pdf'
    : e === 'png' ? 'image/png'
    : (e === 'jpg' || e === 'jpeg') ? 'image/jpeg'
    : 'application/octet-stream';
}

function buildMime(o) {
  const bnd = 'bh_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  const h = [
    'From: ' + encAddr(o.from),
    'To: ' + o.to.map(encAddr).join(', '),
  ];
  if (o.cc && o.cc.length) h.push('Cc: ' + o.cc.map(encAddr).join(', '));
  if (o.replyTo) h.push('Reply-To: ' + encAddr(o.replyTo));
  h.push('Subject: ' + enc(o.subject));
  h.push('MIME-Version: 1.0');

  const htmlPart =
    'Content-Type: text/html; charset="UTF-8"\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    wrap(Buffer.from(o.html || '', 'utf8').toString('base64'));

  if (!o.attachments.length) {
    return h.join('\r\n') + '\r\n' + htmlPart;
  }

  h.push('Content-Type: multipart/mixed; boundary="' + bnd + '"');
  const parts = ['--' + bnd, htmlPart];
  for (const a of o.attachments) {
    // filename* (RFC 5987) ber íslensku stafina; venjulega filename er ascii-vara.
    const ascii = a.filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    parts.push('--' + bnd);
    parts.push(
      'Content-Type: ' + a.type + '; name="' + ascii + '"\r\n' +
      'Content-Disposition: attachment; filename="' + ascii + '"; ' +
        "filename*=UTF-8''" + encodeURIComponent(a.filename) + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      wrap(a.content));
  }
  parts.push('--' + bnd + '--');
  return h.join('\r\n') + '\r\n\r\n' + parts.join('\r\n');
}
