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
 *     { account, to:[…], subject, html, cc?:[…], replyTo?, inReplyTo?, attachments?:[…] }
 *
 *   inReplyTo (10.09.2026) — Message-ID upprunalega póstsins (email_digest.message_id).
 *     Setur In-Reply-To + References og sendir með threadId sendandi pósthólfsins, svo
 *     svarið lendir í SAMA samtali, bæði hjá viðtakanda og í Gmail hjá okkur.
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
const { freshAccessTokenFor, freshAccessToken, listConnectedAccounts, json, cors } = require('./_google');

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
  // Drive-skrár eru sóttar með AÐAL-tokeninu (id=1, aggisigurds) því skjölin
  // (customer_documents, þjónustusamningar o.fl.) liggja í HANS Drive — send-
  // pósthólfið (t.d. eldklar@) hefur ekki endilega aðgang að þeim skrám.
  let _driveTok = null;
  async function driveTok() {
    if (_driveTok) return _driveTok;
    try { _driveTok = await freshAccessToken(); } catch (_) { _driveTok = token; }
    return _driveTok || token;
  }
  const atts = [];
  const warnings = [];
  // Talið INNI í lykkjunni, á færslum sem lifa af `if (!a) continue` að neðan.
  // ALDREI `body.attachments.length`: null-færsla (sem er viljandi sleppt) myndi
  // þá blása upp N og framkalla falskt 422 sem stöðvar fullgilda sendingu.
  // 254-receipt-sender.js:246 síar ekki null og 166-krofu-yfirlit.js:1282 getur
  // skilað null, svo þetta er raunveruleg leið, ekki fræðileg.
  let requested = 0;
  for (const a of (Array.isArray(body.attachments) ? body.attachments : [])) {
    if (!a) continue;
    requested++;
    const name = a.filename || 'skjal.pdf';
    try {
      if (a.content) {
        atts.push({ filename: name, content: String(a.content), type: a.contentType || guessType(name) });
      } else if (a.driveId) {
        const r = await fetch(
          'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(a.driveId) + '?alt=media&supportsAllDrives=true',
          { headers: { Authorization: 'Bearer ' + (await driveTok()) } });
        if (!r.ok) { warnings.push(name + ': Drive HTTP ' + r.status); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        atts.push({ filename: name, content: buf.toString('base64'), type: a.contentType || guessType(name) });
      } else if (a.url) {
        const r = await fetch(a.url);
        if (!r.ok) { warnings.push(name + ': HTTP ' + r.status); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        atts.push({ filename: name, content: buf.toString('base64'), type: a.contentType || guessType(name) });
      } else {
        // Færsla sem ber ekkert af formunum þremur — t.d. `content:''` (falsy,
        // dettur fram hjá öllum greinum) eða `{filename, path}` sem
        // 254-receipt-sender.js:32 skjalfestir en þjónninn útfærði aldrei. Án
        // þessarar línu félli hún ÞEGJANDI í gegn og 422-ið að neðan skytist með
        // TÓMUM `warnings` — notandinn sæi „0 af 1" án nokkurrar ástæðu.
        // `warnings` má aldrei vera tómt þegar vörnin skýtur.
        warnings.push(name + ': ekkert innihald (content/driveId/url vantar)');
      }
    } catch (e) { warnings.push(name + ': ' + String((e && e.message) || e)); }
  }

  // ── Óleyst viðhengi STÖÐVA sendinguna ──────────────────────────────────────
  // Vörnin sjálf kom 2026-08-27 (68c7a66): kallandinn bað um viðhengi, eitt eða
  // fleiri leystust ekki (Drive 404/heimild, dauð slóð), og pósturinn fór samt
  // af stað — kúnninn fékk póst sem segir „Meðfylgjandi er reikningur" með ENGU
  // viðhengi meðan Kröfu yfirlit POSTaði `sent:true`. Klientinn getur ekki
  // sannreynt driveId/url sjálfur (hann sendir bara tilvísunina), svo neitunin
  // verður að vera HÉR.
  //
  // 2026-09-01 hert á þrennu sem upphaflega útgáfan hafði ekki:
  //   • `requested` talið inni í lykkjunni (var `.filter(Boolean).length` — sami
  //     fjöldi í dag, en tvær talningarleiðir sem geta rekið í sundur);
  //   • `!== true` í stað `!body.allowPartial`, svo `allowPartial:'nei'` (truthy
  //     strengur) slökkvi ekki óvart á vörninni;
  //   • bilunin SKRÁÐ í `app_problems` — sjá logAttachmentFailure að neðan.
  //     Upphaflega útgáfan var þögul og brunahólf skrifaði ekkert í registry-ið,
  //     svo 3×/dag sópunin hefði aldrei séð stöðvaða sendingu.
  if (requested > atts.length && body.allowPartial !== true) {
    await logAttachmentFailure(requested, atts.length, warnings);
    return json(422, {
      error: 'ATTACHMENTS_FAILED',
      message: 'Aðeins ' + atts.length + ' af ' + requested + ' viðhengjum leystust. '
             + 'Pósturinn var EKKI sendur — kúnninn hefði fengið hann án skjalsins. '
             + (warnings.length ? '(' + warnings.join('; ') + ')' : ''),
      requested, resolved: atts.length, warnings,
    });
  }

  // ── Svar í SAMA þræði (10.09.2026) ────────────────────────────────────────
  // Agnar: „laaaaang þægilegast ef maður getur svarað póstum úr kerfinu og það haldi sama
  // samtalinu". Svara-hnappurinn (240) sendi áður nýjan póst með „Re:" í efni og Gmail
  // setti hann í NÝJAN þráð. Nú: In-Reply-To + References (póstforrit viðtakandans raðar
  // svarinu í samtalið) og threadId úr SENDANDI pósthólfinu (svarið lendir í sama þræði
  // hjá okkur). Uppflettingin má ALDREI stöðva sendingu: finnist upprunalegi pósturinn
  // ekki fer svarið samt — með hausunum en án threadId — og viðvörun fylgir svarinu.
  let thread = null;
  const inReplyTo = normMsgId(body.inReplyTo);
  if (body.inReplyTo && !inReplyTo) warnings.push('inReplyTo hunsað: ógilt Message-ID');
  if (inReplyTo) thread = await finnaThrad(token, inReplyTo, warnings);

  const mime = buildMime({
    from: body.from || account,       // má vera „Nafn <netfang>" — verður að vera pósthólfið eða alias þess
    to, cc: [].concat(body.cc || []).filter(Boolean),
    replyTo: body.replyTo || '',
    inReplyTo: inReplyTo || '',
    references: thread ? thread.references : '',
    subject,
    html: String(body.html || ''),
    attachments: atts,
  });

  const r = await fetch(GMAIL_SEND, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(thread && thread.threadId ? { raw: b64url(mime), threadId: thread.threadId } : { raw: b64url(mime) }),
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
  return json(200, {
    ok: true, id: j.id, threadId: j.threadId,
    threaded: !!(thread && thread.threadId && j.threadId === thread.threadId),
    warnings,
  });
};

// ── Bilanaskráning fyrir stöðvaða sendingu ──────────────────────────────────
// Stöðvunin að ofan er nýr bilunar-punktur, og regla 3 í docs/ORYGGISNET.md
// segir að nýr bilunar-punktur megi ekki vera þögull. Klientmegin endar hún í
// `alert()` og hvergi annars staðar: `app_problems` er 100% `source_app=
// 'slokkvitaeki'` — brunahólf skrifar ekkert í registry-ið, svo 3×/dag sópunin
// sæi þetta aldrei. Þess vegna er skráð HÉR, þjónsmegin, þar sem bilunin er í
// raun þekkt og báðir kallendur (Kröfu yfirlit og AppMail) fara um sama stað.
//
// Fire-and-forget: skráning má ALDREI fella sendinguna eða breyta svarinu.
// PERSÓNUGREINANLEGT FER EKKI HÉR INN (regla 6): ekkert netfang viðtakanda,
// engin kennitala. Skráarnöfn geta borið kennitölu, svo þau eru hreinsuð.
// MÆLT á 3.755 röðum í `customer_documents`: 1.533 skráanöfn (41%) bera
// kennitölu, svo þetta er meginreglan en ekki jaðartilvik.
// `\b` DUGAR EKKI: undirstrik er orðstafur, svo `Reikningur_120380-4569.pdf`
// slapp óhreinsað í gegn (og `_`-sniðið er nafnasniðmát, ekki tilviljun).
// Lookbehind/lookahead á tölustaf í staðinn — grípur `_`, bil, bandstrik og
// stafi sem skilstafi.
function scrubDetail(s) {
  return String(s == null ? '' : s)
    // Slóðir fyrst: `catch (e)` bergmálar undici-villur sem bera fulla slóð
    // með `?token=…`. Þær eiga ekkert erindi í registry sem allur hópurinn les.
    .replace(/\S*(?:https?:\/\/|\?|token=)\S*/gi, '<slóð>')
    .replace(/(?<!\d)\d{6}[-\s_]?\d{4}(?!\d)/g, '<kt>');
}

async function logAttachmentFailure(requested, resolved, warnings) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const detail = scrubDetail(
      resolved + ' af ' + requested + ' viðhengjum leystust — sending stöðvuð. '
      + (warnings || []).join('; ')
    ).slice(0, 2000);
    const fingerprint = ('attachments_failed|' + detail).slice(0, 200);
    await fetch(url.replace(/\/$/, '') + '/rest/v1/app_problems', {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'content-type': 'application/json',
        Prefer: 'return=minimal',
      },
      // Án timeout gæti hangandi Supabase breytt 422-inu í Netlify-502 (sjálfgefin
      // 10 s keyrsla). Sendingin er þegar stöðvuð á þessum punkti, svo hér má
      // ekkert bíða: skráningin er aukaatriði, svarið til notandans er það ekki.
      signal: AbortSignal.timeout(2500),
      body: JSON.stringify([{
        source_app: 'brunaholf',
        kind: 'attachments_failed',
        severity: 'error',
        detail,
        page: 'gmail-send',
        who: 'gmail-send',
        ua: 'netlify-function',
        fingerprint,
      }]),
    });
  } catch (_) { /* swallow — skráning má aldrei brjóta sendinguna */ }
}

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

// Message-ID → „<…>" án bila, gæsalappa eða línuskila; annað → null. Gildið fer beint í
// MIME-haus, svo þetta er líka vörnin gegn haus-innskoti („…>\r\nBcc: …").
function normMsgId(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  const inner = s.replace(/^</, '').replace(/>$/, '');
  if (!/^[^\s<>"]{3,300}$/.test(inner) || inner.indexOf('@') === -1) return null;
  return '<' + inner + '>';
}

// Finnur upprunalega póstinn í SENDANDI pósthólfinu (Gmail-leit rfc822msgid:) og skilar
// threadId + References-keðju (fyrri tilvísanir + upprunalega Message-ID). Kastar aldrei.
async function finnaThrad(token, msgId, warnings) {
  const H = { Authorization: 'Bearer ' + token };
  const api = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
  try {
    const l = await fetch(api + '?maxResults=1&q=' + encodeURIComponent('rfc822msgid:' + msgId.slice(1, -1)), { headers: H });
    if (!l.ok) {
      warnings.push('þráðaleit: HTTP ' + l.status + ' — svarið fer án threadId');
      return { threadId: null, references: msgId };
    }
    const lj = await l.json().catch(() => ({}));
    const hit = lj && lj.messages && lj.messages[0];
    if (!hit) {
      warnings.push('upprunalegi pósturinn fannst ekki í sendandi pósthólfi — svarið fer án threadId');
      return { threadId: null, references: msgId };
    }
    let refs = '';
    const m = await fetch(api + '/' + encodeURIComponent(hit.id) + '?format=metadata&metadataHeaders=References', { headers: H });
    if (m.ok) {
      const mj = await m.json().catch(() => ({}));
      const hdr = ((mj && mj.payload && mj.payload.headers) || []).find(x => String(x.name || '').toLowerCase() === 'references');
      refs = hdr ? String(hdr.value || '') : '';
    }
    const kedja = (refs.match(/<[^<>\s"]+>/g) || []).filter(x => x !== msgId).slice(-10);
    kedja.push(msgId);
    return { threadId: hit.threadId || null, references: kedja.join(' ') };
  } catch (e) {
    warnings.push('þráðaleit mistókst: ' + String((e && e.message) || e));
    return { threadId: null, references: msgId };
  }
}
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
  if (o.inReplyTo) {
    // Bæði gildin eru hreinsuð í normMsgId / finnaThrad (aðeins <…> án bila eða línuskila),
    // svo ekkert getur skotið inn eigin haus. Löng References-keðja er brotin á línur (RFC 5322).
    h.push('In-Reply-To: ' + o.inReplyTo);
    h.push('References: ' + String(o.references || o.inReplyTo).split(' ').filter(Boolean).join('\r\n '));
  }
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
    // GMAIL HUNSAR filename* (RFC 2231/5987) og les venjulega name=/filename=
    // beint — þess vegna birtist „Tilbo_" í stað „Tilboð" (staðfest á sendu
    // tilboði 2026-07-21). Gmail (og Outlook/Apple Mail) skilja hins vegar
    // RFC 2047 encoded-word INNI í parametrinum — það er sniðið sem Gmail
    // sjálft býr til. Því fer B-kóðaða nafnið í name/filename þegar íslenskir
    // stafir eru til staðar, og filename* fylgir áfram fyrir staðal-þæga
    // klienta.
    const clean = String(a.filename).replace(/"/g, '');
    const q = /^[\x20-\x7E]*$/.test(clean)
      ? '"' + clean + '"'
      : '"=?UTF-8?B?' + Buffer.from(clean, 'utf8').toString('base64') + '?="';
    parts.push('--' + bnd);
    parts.push(
      'Content-Type: ' + a.type + '; name=' + q + '\r\n' +
      'Content-Disposition: attachment; filename=' + q + '; ' +
        "filename*=UTF-8''" + encodeURIComponent(clean) + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      wrap(a.content));
  }
  parts.push('--' + bnd + '--');
  return h.join('\r\n') + '\r\n\r\n' + parts.join('\r\n');
}
