// kostnadur-sync-background.js — viðhengi úr pósti eldklar@eldklar.is → tafla `kostnadur` (27.09.2026, Agnar:
// „síða í Slökkvitæki sem les viðhengin úr póstinum sjálfkrafa og flokkar þau … sumt eru reikningar á
// verkstæðið, sumt á verk … sækja allt síðasta mánuðinn frá eldklar@eldklar.is").
//
//   GET/POST /.netlify/functions/kostnadur-sync-background?days=31[&max=80]
//
// Bakgrunnsfall (Netlify: nafnið endar á -background → 202 strax, keyrir allt að 15 mín).
// Staðan er skrifuð í app_kv['kostnadur_sync'] svo síðan geti sýnt hana.
//
// Skref fyrir hvert skeyti:
//   1. Gmail (format=full — `format=metadata` sem gmail-ingest notar skilar EKKI hlutatrénu, þess vegna
//      stendur has_attachment=false á nær öllum eldklar-póstum í email_digest).
//   2. Hvert viðhengi (PDF, mynd, CSV) er sótt, vistað í lokaða bucketinn `kostnadur` og lesið af Claude
//      með skema-þvinguðu JSON (output_config.format). Undirskriftarmyndir og smámyndir eru hunsaðar.
//   3. Ný röð í `kostnadur` — AÐEINS ef hún er ekki til (ignore-duplicates): endurkeyrsla yfirskrifar
//      aldrei tengingar/flokkun sem gerð var á síðunni.
// Eigin sendingar (from:eldklar@eldklar.is) eru útilokaðar í Gmail-fyrirspurninni: það eru sölureikningar
// OKKAR, ekki kostnaður. Framsendingar frá brunaholf@ koma með.

const { freshAccessTokenFor } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.KOSTNADUR_MODEL || 'claude-opus-5';
const ACCOUNT = 'eldklar@eldklar.is';
const BUCKET = 'kostnadur';
const TIMA_HAMARK_MS = 13 * 60 * 1000;   // skilur eftir svigrúm innan 15 mín hámarks Netlify
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

const sbH = (extra) => Object.assign({ apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }, extra || {});
async function sb(path, opt) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, Object.assign({}, opt, { headers: sbH(Object.assign({ 'content-type': 'application/json' }, (opt && opt.headers) || {})) }));
  if (!r.ok) throw new Error('Supabase ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function stada(value) {
  try {
    await sb('app_kv?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ key: 'kostnadur_sync', value, updated_at: new Date().toISOString() }) });
  } catch (_) {}
}

// ── Gmail ────────────────────────────────────────────────────────────────────
async function gget(token, path) {
  const r = await fetch(GMAIL + path, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('Gmail ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function listaSkeyti(token, days) {
  const q = encodeURIComponent('has:attachment newer_than:' + days + 'd -from:' + ACCOUNT);
  const ids = [];
  let pageToken = '';
  do {
    const j = await gget(token, '/messages?maxResults=100&q=' + q + (pageToken ? '&pageToken=' + pageToken : ''));
    (j.messages || []).forEach((m) => ids.push(m.id));
    pageToken = j.nextPageToken || '';
  } while (pageToken && ids.length < 1000);
  return ids;
}
const haus = (payload, nafn) => {
  const h = ((payload && payload.headers) || []).find((x) => String(x.name).toLowerCase() === nafn.toLowerCase());
  return h ? h.value : '';
};
function parseFra(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { nafn: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { nafn: null, email: s.includes('@') ? s.toLowerCase() : null };
}
// Viðhengi sem skipta máli: PDF, myndir (nema smámyndir/undirskriftir) og CSV (t.d. Teya-útdrættir).
function vidhengi(payload) {
  const out = [];
  let nr = 0;
  (function walk(p) {
    if (!p) return;
    const fn = (p.filename || '').trim();
    if (fn && p.body && p.body.attachmentId) {
      nr++;
      const mime = String(p.mimeType || '').toLowerCase();
      const staerd = +(p.body.size || 0);
      const cid = (p.headers || []).some((h) => String(h.name).toLowerCase() === 'content-id');
      const pdf = mime === 'application/pdf' || /\.pdf$/i.test(fn);
      const mynd = /^image\/(jpeg|jpg|png|webp)$/.test(mime);
      const csv = mime === 'text/csv' || /\.csv$/i.test(fn);
      const smamynd = mynd && (staerd < 25000 || (cid && staerd < 120000));   // lógó og undirskriftir
      if ((pdf || mynd || csv) && !smamynd && staerd < 20 * 1024 * 1024) {
        out.push({ key: nr + ':' + fn, fn, mime: pdf ? 'application/pdf' : csv ? 'text/csv' : mime, staerd, attId: p.body.attachmentId });
      }
    }
    (p.parts || []).forEach(walk);
  })(payload);
  return out;
}
async function saekjaVidhengi(token, msgId, attId) {
  const j = await gget(token, '/messages/' + msgId + '/attachments/' + attId);
  return Buffer.from(String(j.data || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
async function vista(pathName, buf, mime) {
  const r = await fetch(SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + pathName, {
    method: 'POST', headers: sbH({ 'content-type': mime, 'x-upsert': 'true' }), body: buf,
  });
  if (!r.ok) throw new Error('Storage ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

// ── Claude ───────────────────────────────────────────────────────────────────
const nullable = (t) => ({ anyOf: [{ type: t }, { type: 'null' }] });
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    tegund: { type: 'string', enum: ['reikningur', 'kvittun', 'teya_yfirlit', 'kortayfirlit', 'greidsluselill', 'okkar_reikningur', 'tilbod', 'annad'] },
    flokkur: { type: 'string', enum: ['verkstaedi', 'verk', 'lager', 'efni', 'rekstur', 'bill', 'hugbunadur', 'annad', 'ekki_kostnadur'] },
    seljandi: nullable('string'),
    seljandi_kt: nullable('string'),
    reikningsnr: nullable('string'),
    dags: nullable('string'),
    gjalddagi: nullable('string'),
    upphaed: nullable('number'),
    vsk: nullable('number'),
    gjaldmidill: nullable('string'),
    tilvisun: nullable('string'),
    samantekt: { type: 'string' },
    vissa: { type: 'number' },
    linur: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { lysing: { type: 'string' }, magn: nullable('number'), einingarverd: nullable('number'), upphaed: nullable('number'), dags: nullable('string'), kort: nullable('string') },
        required: ['lysing', 'magn', 'einingarverd', 'upphaed', 'dags', 'kort'],
      },
    },
  },
  required: ['tegund', 'flokkur', 'seljandi', 'seljandi_kt', 'reikningsnr', 'dags', 'gjalddagi', 'upphaed', 'vsk', 'gjaldmidill', 'tilvisun', 'samantekt', 'vissa', 'linur'],
};
const SYSTEM =
  'Þú lest viðhengi sem bárust í pósthólf Slökkvitækis ehf. (eldklar@eldklar.is), íslensks fyrirtækis sem ' +
  'þjónustar slökkvitæki, brunaslöngur og reykskynjara, rekur verkstæði og fer í úttektir hjá viðskiptavinum. ' +
  'Móðurfélagið er Brunahólf ehf. Dragðu út gögnin og flokkaðu skjalið.\n' +
  'tegund: reikningur (reikningur frá birgi/seljanda á okkur), kvittun, teya_yfirlit (uppgjör/yfirlit frá Teya ' +
  'kortafyrirtækinu — færslur í linur), kortayfirlit (kreditkortayfirlit), greidsluselill, okkar_reikningur ' +
  '(reikningur sem VIÐ gáfum út — Slökkvitæki/Brunahólf er seljandinn), tilbod, annad.\n' +
  'flokkur: verkstaedi (rekstrarvörur/varahlutir/áfyllingarefni fyrir verkstæðið sjálft), verk (kostnaður sem ' +
  'tilheyrir ákveðnu verki eða viðskiptavini — t.d. verknúmer, heimilisfang eða kúnni nefndur), lager (vörur keyptar ' +
  'á lager: slökkvitæki, reykskynjarar, brunaslöngur, skilti og varahlutir til endursölu), efni (annað efni og ' +
  'vörukaup), rekstur (sími, húsnæði, tryggingar, bókhald, skattar, gjöld), bill (eldsneyti, viðgerðir, ' +
  'dekk), hugbunadur (áskriftir, hugbúnaður), annad, ekki_kostnadur (okkar eigin reikningar, auglýsingar, ' +
  'skjöl sem eru ekki kostnaður).\n' +
  'Upphæðir í krónum sem tölur án þúsundaskila (12.400 kr → 12400). upphaed = heildarupphæð MEÐ VSK. ' +
  'Dagsetningar sem YYYY-MM-DD. seljandi_kt sem 10 tölustafir án bandstriks. tilvisun = verknúmer, tilvísun, ' +
  'pöntunarnúmer, heimilisfang eða nafn viðskiptavinar sem skjalið nefnir (null ef ekkert). linur = vörulínur ' +
  'reiknings, eða færslur á Teya-/kortayfirliti (dags + upphaed + kort ef sést). samantekt = ein stutt setning ' +
  'á íslensku um hvað þetta er. vissa = 0–1 hversu viss þú ert um flokkunina. Notaðu null þegar gildi sést ekki ' +
  '— aldrei giska á tölur.';

async function lesa(att, buf, efni, fra) {
  let blokk;
  if (att.mime === 'application/pdf') blokk = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } };
  else if (att.mime === 'text/csv') blokk = { type: 'text', text: 'CSV-SKRÁ (' + att.fn + '):\n' + buf.toString('utf8').slice(0, 60000) };
  else blokk = { type: 'image', source: { type: 'base64', media_type: att.mime === 'image/jpg' ? 'image/jpeg' : att.mime, data: buf.toString('base64') } };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-api-key': ANTHROPIC, 'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: MODEL, max_tokens: 12000, system: SYSTEM,
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: [blokk, { type: 'text', text: 'Skráarheiti: ' + att.fn + '\nEfnislína póstsins: ' + (efni || '') + '\nSendandi: ' + (fra || '') }] }],
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Claude ' + r.status + ': ' + JSON.stringify(j.error || j).slice(0, 240));
  if (j.stop_reason === 'refusal') throw new Error('Claude hafnaði skjalinu' + (j.stop_details && j.stop_details.category ? ' (' + j.stop_details.category + ')' : ''));
  if (j.stop_reason === 'max_tokens') throw new Error('Svarið klipptist (max_tokens)');
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return JSON.parse(text);
}
const dagsEda = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : null);
const tala = (v) => (v == null || v === '' || isNaN(+v) ? null : Math.round(+v));
const kt = (s) => { const d = String(s || '').replace(/\D/g, ''); return d.length === 10 ? d : null; };

exports.handler = async (event) => {
  const p = (event && event.queryStringParameters) || {};
  const days = Math.min(Math.max(parseInt(p.days || '31', 10) || 31, 1), 400);
  const max = Math.min(Math.max(parseInt(p.max || '80', 10) || 80, 1), 300);
  const t0 = Date.now();
  const s = { byrjad: new Date().toISOString(), days, skeyti: 0, vidhengi: 0, nyjar: 0, thegar: 0, villur: [], lokid: null, a_ferd: true };
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  if (!ANTHROPIC) { s.villur.push('ANTHROPIC_API_KEY vantar í Netlify'); s.a_ferd = false; s.lokid = new Date().toISOString(); await stada(s); return; }
  await stada(s);
  try {
    const token = await freshAccessTokenFor(ACCOUNT);
    const ids = await listaSkeyti(token, days);
    s.skeyti = ids.length;
    // Það sem er þegar lesið — sótt í einu lagi og borið saman við skeytin.
    const til = new Set();
    for (let i = 0; i < ids.length; i += 150) {
      const hluti = ids.slice(i, i + 150).map((x) => '"' + x + '"').join(',');
      const rows = await sb('kostnadur?select=message_id,attachment_key&message_id=in.(' + hluti + ')');
      (rows || []).forEach((r) => til.add(r.message_id + '|' + r.attachment_key));
    }
    let unnid = 0;
    for (const id of ids) {
      if (Date.now() - t0 > TIMA_HAMARK_MS || unnid >= max) { s.villur.push('Hámarki náð í þessari keyrslu — keyrðu aftur til að klára'); break; }
      let msg;
      try { msg = await gget(token, '/messages/' + id + '?format=full'); }
      catch (e) { s.villur.push(id + ': ' + e.message); continue; }
      const efni = haus(msg.payload, 'Subject');
      const fra = parseFra(haus(msg.payload, 'From'));
      const mottekid = msg.internalDate ? new Date(+msg.internalDate).toISOString() : null;
      for (const att of vidhengi(msg.payload)) {
        s.vidhengi++;
        if (til.has(id + '|' + att.key)) { s.thegar++; continue; }
        if (Date.now() - t0 > TIMA_HAMARK_MS || unnid >= max) break;
        unnid++;
        const row = {
          account: ACCOUNT, message_id: id, attachment_key: att.key, skra_nafn: att.fn, mime: att.mime, staerd: att.staerd,
          sendandi: fra.nafn, sendandi_email: fra.email, efni, mottekid_at: mottekid,
        };
        try {
          const buf = await saekjaVidhengi(token, id, att.attId);
          const pathName = id + '/' + att.key.replace(/[^\w.\-]+/g, '_');
          await vista(pathName, buf, att.mime);
          row.storage_path = pathName;
          try {
            const ai = await lesa(att, buf, efni, (fra.nafn || '') + ' <' + (fra.email || '') + '>');
            Object.assign(row, {
              tegund: ai.tegund, flokkur: ai.flokkur, seljandi: ai.seljandi, seljandi_kt: kt(ai.seljandi_kt),
              reikningsnr: ai.reikningsnr, dags: dagsEda(ai.dags), gjalddagi: dagsEda(ai.gjalddagi),
              upphaed: tala(ai.upphaed), vsk: tala(ai.vsk), gjaldmidill: ai.gjaldmidill || 'ISK',
              linur: Array.isArray(ai.linur) ? ai.linur.slice(0, 300) : [], samantekt: ai.samantekt, tilvisun: ai.tilvisun,
              ai_vissa: typeof ai.vissa === 'number' ? ai.vissa : null, ai: { model: MODEL, lesid: new Date().toISOString() },
            });
            if (ai.flokkur === 'ekki_kostnadur' || ai.tegund === 'okkar_reikningur') row.stada = 'hunsad';
          } catch (e) { row.ai_villa = String(e.message || e).slice(0, 400); }
          await sb('kostnadur?on_conflict=message_id,attachment_key', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify(row) });
          s.nyjar++;
        } catch (e) { s.villur.push((att.fn || id) + ': ' + String(e.message || e).slice(0, 200)); }
        if (s.nyjar % 5 === 0) await stada(s);
      }
    }
  } catch (e) {
    s.villur.push(String(e.message || e).slice(0, 300));
  }
  s.villur = s.villur.slice(0, 40);
  s.a_ferd = false;
  s.lokid = new Date().toISOString();
  await stada(s);
};
