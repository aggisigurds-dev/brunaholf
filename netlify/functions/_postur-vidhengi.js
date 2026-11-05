// _postur-vidhengi.js — deilt: sækir viðhengi úr Gmail-skeyti og vistar í bucket `postur-vidhengi`
// + röð í `postur_vidhengi`. Notað af gmail-ingest.js (vidhengi=1) og gmail-vidhengi-background.js.
//
// 05.11.2026 — Agnar: „ég vil geta sótt gögn úr innsoginu“. Innsogið skráði aðeins nöfn viðhengja
// (email_digest.attachment_names); hér koma skrárnar sjálfar. Reglur:
//   · aðeins hlutar með skráarnafni og body.attachmentId
//   · inline-myndum úr signatúrum sleppt (image/* undir 60 KB, eða nöfn eins og image001.gif / Outlook-xxxx.gif)
//   · hámark 20 MB per skrá (bucket file_size_limit); stærri skráð með storage_path '' og mime 'skipped/too-large'? NEI —
//     þeim er sleppt alveg og talið í `sleppt` (ekkert hálft í töflunni)
//   · tvítak = sama (account, gmail_msg_id, filename) → sleppt án netkalls í Gmail
// Engin undantekning fer upp úr þessu — kallarinn fær talningu og villulista, innsogið fellur aldrei vegna viðhengja.
'use strict';
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'postur-vidhengi';
const MAX_BYTES = 20 * 1024 * 1024;
const INLINE_MYND_MAX = 60 * 1024;
const INLINE_NOFN = /^(image\d{3}\.(gif|png|jpe?g)|outlook-[a-z0-9]+\.(gif|png)|~wrd\d+\.jpg|oledata\.mso)$/i;

/* Gengur hlutatréð; skilar [{ filename, mime, size, attachmentId, inline }] fyrir hluta með nafni. */
function finnaVidhengi(payload) {
  const ut = [];
  const walk = (part) => {
    if (!part) return;
    const fn = (part.filename || '').trim();
    if (fn) {
      const h = {}; (part.headers || []).forEach(x => { h[String(x.name || '').toLowerCase()] = x.value || ''; });
      ut.push({
        filename: fn, mime: part.mimeType || null,
        size: (part.body && part.body.size) || 0,
        attachmentId: (part.body && part.body.attachmentId) || null,
        inline: /inline/i.test(h['content-disposition'] || '') || !!h['content-id'],
      });
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return ut;
}

/* Á að sækja þennan hlut? Skilar null = já, annars ástæða. */
function sleppa(v) {
  if (!v.attachmentId) return 'ekkert attachmentId';
  if (v.size > MAX_BYTES) return 'stærri en 20 MB';
  const mynd = /^image\//i.test(v.mime || '');
  if (mynd && (v.size < INLINE_MYND_MAX || INLINE_NOFN.test(v.filename))) return 'inline-mynd';
  if (!mynd && INLINE_NOFN.test(v.filename)) return 'inline-hlutur';
  return null;
}

function oruggtNafn(fn) {
  // Lisbeth 05.11: # og % líka — encodeURI sleppir # og fetch klippir slóðina þar („Reikningur #123.pdf“)
  return String(fn).normalize('NFC').replace(/[\\/:*?"<>|#%\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'vidhengi';
}
/* Storage-slóð kóðuð per lið — sama mynstur og storage-backup-background.js:141, ekki encodeURI á heild. */
const kodaSlod = (p) => String(p).split('/').map(encodeURIComponent).join('/');
function slod(account, receivedAt, gmailMsgId, filename) {
  const ar = (receivedAt && String(receivedAt).slice(0, 4)) || 'ar';
  return `${String(account).toLowerCase()}/${ar}/${gmailMsgId}/${oruggtNafn(filename)}`;
}

const sbH = () => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` });

/* Hvaða (gmail_msg_id, filename) eru þegar til fyrir þetta hólf — eitt kall fyrir allan runann. */
async function tilThegar(account, gmailIds) {
  const til = new Set();
  for (let i = 0; i < gmailIds.length; i += 100) {
    const u = new URL(`${SUPABASE_URL}/rest/v1/postur_vidhengi`);
    u.searchParams.set('select', 'gmail_msg_id,filename');
    u.searchParams.set('account', `eq.${account}`);
    u.searchParams.set('gmail_msg_id', 'in.(' + gmailIds.slice(i, i + 100).map(v => JSON.stringify(String(v))).join(',') + ')');
    const r = await fetch(u, { headers: sbH() });
    if (!r.ok) throw new Error('postur_vidhengi lestur ' + r.status);
    (await r.json()).forEach(x => til.add(x.gmail_msg_id + '\u0000' + x.filename));
  }
  return til;
}

/* Sækir eitt viðhengi úr Gmail (base64url) → Buffer. */
async function saekjaGmail(token, gmailMsgId, attachmentId) {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMsgId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Gmail attachment ${r.status}`);
  const j = await r.json();
  return Buffer.from(String(j.data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

async function hladaUpp(storagePath, buf, mime) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${kodaSlod(storagePath)}`, {
    method: 'POST',
    headers: { ...sbH(), 'Content-Type': mime || 'application/octet-stream', 'x-upsert': 'true' },
    body: buf,
  });
  if (!r.ok) throw new Error(`storage ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function skraRod(rod) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/postur_vidhengi?on_conflict=account,gmail_msg_id,filename`, {
    method: 'POST',
    headers: { ...sbH(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rod),
  });
  if (!r.ok) throw new Error(`postur_vidhengi skrif ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

/* Aðalfallið. skeyti = [{ gmailMsgId, messageId, folder, receivedAt, payload }]. Skilar talningu. */
async function vistaVidhengi(token, account, skeyti, opt = {}) {
  const ut = { skodud: 0, sott: 0, tvitok: 0, sleppt: 0, villur: 0, villulisti: [], skrar: [] };
  const med = skeyti.map(s => ({ ...s, vidh: finnaVidhengi(s.payload) })).filter(s => s.vidh.length);
  if (!med.length) return ut;
  let til;
  try { til = await tilThegar(account, med.map(s => s.gmailMsgId)); }
  catch (e) { ut.villur++; ut.villulisti.push('lestur: ' + e.message); return ut; }
  const CONC = opt.conc || 4;
  const verk = [];
  for (const s of med) for (const v of s.vidh) {
    ut.skodud++;
    const astaeda = sleppa(v);
    if (astaeda) { ut.sleppt++; continue; }
    if (til.has(s.gmailMsgId + '\u0000' + v.filename)) { ut.tvitok++; continue; }
    verk.push({ s, v });
  }
  for (let i = 0; i < verk.length; i += CONC) {
    await Promise.all(verk.slice(i, i + CONC).map(async ({ s, v }) => {
      try {
        const buf = await saekjaGmail(token, s.gmailMsgId, v.attachmentId);
        if (buf.length > MAX_BYTES) { ut.sleppt++; return; }
        const storage_path = slod(account, s.receivedAt, s.gmailMsgId, v.filename);
        await hladaUpp(storage_path, buf, v.mime);
        await skraRod({
          message_id: s.messageId, account, folder: s.folder || null, gmail_msg_id: s.gmailMsgId, attachment_id: v.attachmentId,
          filename: v.filename, mime: v.mime, size: buf.length, storage_path, received_at: s.receivedAt || null,
          sha256: crypto.createHash('sha256').update(buf).digest('hex'),
        });
        ut.sott++;
        if (ut.skrar.length < 40) ut.skrar.push(storage_path);
      } catch (e) {
        ut.villur++;
        if (ut.villulisti.length < 20) ut.villulisti.push(`${s.gmailMsgId}/${v.filename}: ${e.message}`);
      }
    }));
  }
  return ut;
}

/* Undirrituð slóð (lesaðeins) í eina skrá, gildir `sek` sekúndur. */
async function undirritudSlod(storagePath, sek = 3600) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${kodaSlod(storagePath)}`, {
    method: 'POST', headers: { ...sbH(), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: sek }),
  });
  if (!r.ok) throw new Error(`sign ${r.status}`);
  const j = await r.json();
  return j.signedURL ? `${SUPABASE_URL}/storage/v1${j.signedURL}` : null;
}

module.exports = { finnaVidhengi, sleppa, oruggtNafn, slod, vistaVidhengi, undirritudSlod, BUCKET, MAX_BYTES };
