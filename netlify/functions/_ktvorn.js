// _ktvorn.js — SAMEIGINLEGA kennitölureglan fyrir hverja leið sem stofnar fyrirtaeki-röð eða setur félag í þjónustu.
//
// Krókur 77 (29.10.2026): tvær skráningarleiðir bjuggu til tvær raðir á sömu kennitölu og sama nafni — ekkert stoppaði það
// (einkvæmi vísirinn (kt, stadur_nr) gildir ekki þegar stadur_nr er tómt). Sama regla og patch 490 í Slökkvitæki-appinu:
//
//   1. Kennitala sem er til í kerfinu er NOTUÐ. Leitað er að lifandi röðum á kt í báðum sniðum (bandstrik OG hrein tala):
//        or=(kennitala.eq.DASH,kennitala.eq.DIGITS)&deleted_at=is.null
//      ALDREI `kennitala=eq.<hreinar tölur>` — dálkurinn geymir bandstrik (kveikjan kt_normalize), slík leit finnur ekkert.
//   2. Röð með SAMA nafni (norm: lágstafir, bil samþjöppuð) eða SAMA heimilisfangi (gata + númer) er sama röðin → skilað.
//   3. Annars er ný röð = nýr staður á sömu kt og fær stadur_nr = max(hæsta nr á ÖLLUM röðum kt, fjöldi raða) + 1
//      (staðir eru númeraðir 1,2,3…; fyrsti staður án nr telst nr 1 — annars fengi annar staðurinn nr 1 eins og tvífarinn).
//      Eyddar raðir (deleted_at) teljast ekki til LEITAR en teljast til NÚMERS: einkvæmi vísirinn nær yfir þær líka.
//      23505 (kapphlaup um sama nr) → reynt aftur með nr+1, að hámarki 4 tilraunir.
//   4. Leitarvilla er aldrei lesin sem „ekkert til" — `ok:false` er skilað og kallarinn stofnar EKKERT (ekki giska).
//
// CommonJS, env eins og _spine.js: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Engin ný pakki.
// `sb` = { get(path) → raðir (kastar ef !ok), send(method, path, body, prefer) → {ok,status,rows,code,text} } — sjá makeSb().

'use strict';

const WALKIN = '9999999999';
const COLS = 'id,nafn,kennitala,heimilisfang,simi,netfang,' + encodeURIComponent('tengiliður') + ',er_i_thjonustu,stadur_nr,customer_base_id';
const MAX_TILRAUNIR = 4;

// ── kennitala / nöfn / heimilisföng ──────────────────────────────────────────
function normKt(s) { const d = String(s == null ? '' : s).replace(/\D/g, ''); return d.length === 10 ? d : ''; }
function dashKt(s) { const d = normKt(s); return d ? d.slice(0, 6) + '-' + d.slice(6) : ''; }
function ktOr(kt) { const d = normKt(kt); return 'kennitala.eq.' + dashKt(d) + ',kennitala.eq.' + d; }
function normNafn(s) { return String(s == null ? '' : s).toLowerCase().replace(/[.,;]+/g, ' ').replace(/\s+/g, ' ').trim(); }

// Heimilisfang → { lykill, nr, bokst, postnr }. lykill = fyrstu 6 stafir götunnar (broddar felldir, ð→d, þ→th, æ→ae):
// þolir þágufall/eignarfall („Hjallahraun"/„Hjallahrauni", „Strandgata"/„Strandgötu") án þess að opna fyrir almennt suð.
function greinaHeimili(s) {
  const t = String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae');
  const m = t.match(/^([^\d]*)(\d+)(.*)$/);
  if (!m) return { lykill: '', nr: '', bokst: '', postnr: '' };
  const lykill = (m[1].match(/[a-z]+/g) || []).join('').slice(0, 6);
  const rest = m[3];
  const bokst = (rest.match(/^\s*([a-z])(?![a-z])/) || [])[1] || '';
  const postnr = (rest.match(/(?:^|[\s,])([1-9]\d{2})(?!\d)/) || [])[1] || '';
  return { lykill: lykill.length >= 3 ? lykill : '', nr: m[2], bokst, postnr };
}
// Sama gata + númer (+ bókstafur ef báðir hafa). Mismunandi póstsvæði (fyrsti stafur póstnúmers) = ekki sama staðurinn.
function samaHeimili(a, b) {
  const x = greinaHeimili(a), y = greinaHeimili(b);
  if (!x.lykill || !x.nr || x.lykill !== y.lykill || x.nr !== y.nr) return false;
  if (x.bokst && y.bokst && x.bokst !== y.bokst) return false;
  if (x.postnr && y.postnr && x.postnr[0] !== y.postnr[0]) return false;
  return true;
}

// ── PostgREST aðgangur (stungið inn svo prófin geti notað gervi-fetch) ──────────
function makeSb(fetchFn, url, key) {
  const H = (extra) => Object.assign({ apikey: key, Authorization: 'Bearer ' + key }, extra || {});
  return {
    async get(path) {
      const r = await fetchFn(url + '/rest/v1/' + path, { headers: H() });
      const t = await r.text();
      if (!r.ok) throw new Error(String(path).split('?')[0] + ' ' + r.status + ' ' + t.slice(0, 160));
      let j; try { j = JSON.parse(t); } catch (_) { j = null; }
      if (!Array.isArray(j)) throw new Error(String(path).split('?')[0] + ': óvænt svar');
      return j;
    },
    async send(method, path, body, prefer) {
      const r = await fetchFn(url + '/rest/v1/' + path, { method, headers: H({ 'Content-Type': 'application/json', Prefer: prefer || 'return=representation' }), body: JSON.stringify(body) });
      const t = await r.text();
      let j = null; try { j = JSON.parse(t); } catch (_) {}
      return { ok: r.ok, status: r.status, rows: Array.isArray(j) ? j : [], code: j && !Array.isArray(j) ? j.code : undefined, text: t.slice(0, 200) };
    },
  };
}
function defaultSb() { return makeSb((...a) => fetch(...a), process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); }

// ── leit ────────────────────────────────────────────────────────────────────
// Lifandi raðir á kt (og/eða base). Kastar ef leitin mistekst — kallandinn má ALDREI lesa það sem „ekkert til".
async function finnaKt(sb, kt, opts) {
  opts = opts || {};
  const d = normKt(kt);
  const out = new Map();
  if (d && d !== WALKIN) {
    (await sb.get('fyrirtaeki?select=' + COLS + '&or=(' + ktOr(d) + ')&deleted_at=is.null&order=id.asc')).forEach((r) => out.set(r.id, r));
  }
  if (opts.baseId != null && opts.baseId !== '') {
    (await sb.get('fyrirtaeki?select=' + COLS + '&customer_base_id=eq.' + encodeURIComponent(opts.baseId) + '&deleted_at=is.null&order=id.asc')).forEach((r) => out.set(r.id, r));
  }
  return [...out.values()].sort((a, b) => a.id - b.id);
}

function veljaRod(hits) { return hits.slice().sort((a, b) => ((b.er_i_thjonustu === true) - (a.er_i_thjonustu === true)) || (a.id - b.id))[0]; }

// → { ok, rows, sama: röð|null, astaeda: 'nafn'|'heimilisfang'|null, athugad } eða { ok:false, error }
async function finnaStad(o) {
  const d = normKt(o.kt);
  const athugad = !!(d && d !== WALKIN) || (o.baseId != null && o.baseId !== '');
  if (!athugad) return { ok: true, rows: [], sama: null, astaeda: null, athugad: false };
  let rows;
  try { rows = await finnaKt(o.sb, o.kt, { baseId: o.baseId }); } catch (e) { return { ok: false, error: (e && e.message) || String(e), rows: [] }; }
  const n = normNafn(o.nafn);
  let sama = null, astaeda = null;
  if (n) { const h = rows.filter((r) => normNafn(r.nafn) === n); if (h.length) { sama = veljaRod(h); astaeda = 'nafn'; } }
  if (!sama && trim(o.heimilisfang)) { const h = rows.filter((r) => samaHeimili(r.heimilisfang, o.heimilisfang)); if (h.length) { sama = veljaRod(h); astaeda = 'heimilisfang'; } }
  return { ok: true, rows, sama, astaeda, athugad: true };
}
function trim(s) { return String(s == null ? '' : s).trim(); }

// ── staðarnúmer ─────────────────────────────────────────────────────────────
// rows = ALLAR raðir kt (líka eyddar). null = engin röð til → fyrsti staðurinn fær ekkert númer.
function naestaNr(rows) {
  if (!rows || !rows.length) return null;
  let mx = 0;
  rows.forEach((r) => { const n = parseInt(r.stadur_nr, 10); if (Number.isFinite(n) && n > mx) mx = n; });
  return Math.max(mx, rows.length) + 1;
}
async function naestaNrFraGrunni(sb, kt) {
  const d = normKt(kt);
  if (!d || d === WALKIN) return null;   // án kt: einkvæmi vísirinn deilir lyklinum '' — aldrei setja nr á kt-lausar raðir
  return naestaNr(await sb.get('fyrirtaeki?select=id,stadur_nr&or=(' + ktOr(d) + ')'));
}

// Setur inn nýja röð með réttu staðarnúmeri; 23505 → nr+1 (≤ 4 tilraunir). → { ok, row } | { ok:false, status, error }
async function settaInnStad(o) {
  const d = normKt(o.kt);
  const row = Object.assign({}, o.row);
  if (d) row.kennitala = dashKt(d);
  let nr;
  try { nr = await naestaNrFraGrunni(o.sb, o.kt); } catch (e) { return { ok: false, status: 502, error: 'staðarnúmer: ' + ((e && e.message) || e) }; }
  const tilraunir = o.tilraunir || MAX_TILRAUNIR;
  let sidast = null;
  for (let i = 0; i < tilraunir; i++) {
    const body = nr != null ? Object.assign({}, row, { stadur_nr: nr }) : row;
    const r = await o.sb.send('POST', 'fyrirtaeki?select=' + COLS, body, 'return=representation');
    if (r.ok) return { ok: true, row: r.rows[0] || body, stadur_nr: nr != null ? nr : null };
    sidast = r;
    if (nr != null && (r.status === 409 || String(r.code) === '23505')) { nr++; continue; }
    break;
  }
  return { ok: false, status: (sidast && sidast.status) || 500, error: 'fyrirtaeki POST ' + (sidast ? sidast.status + ' ' + sidast.text : '') };
}

// Fyllir AÐEINS auða reiti (yfirskrifar aldrei) + setur í þjónustu ef beðið er um það.
function audirReitir(cur, row, thjonusta) {
  const upd = {};
  ['simi', 'netfang', 'tengiliður', 'heimilisfang'].forEach((c) => { const v = trim(row && row[c]); if (v && !trim(cur[c])) upd[c] = v; });
  if (row && row.customer_base_id != null && cur.customer_base_id == null) upd.customer_base_id = row.customer_base_id;
  if (thjonusta && cur.er_i_thjonustu !== true) upd.er_i_thjonustu = true;
  return upd;
}

// Aðalfallið. Reglan í einu kalli:
//   finnist röð með sama nafni/heimilisfangi → hún er notuð (auðir reitir fylltir, sett í þjónustu ef thjonusta);
//   annars, ef nyrStadurLeyfdur (sjálfgefið true) → ný röð sem nýr staður á kt; ef EKKI leyfður (sjálfvirkir innlesarar sem
//   mega ekki búa til staði út frá nafni úr skjali) → engin ný röð þegar kt á þegar rað: { hvernig:'til' }.
// → { ok:true, hvernig:'reuse'|'site'|'til'|'ny', row, rows, astaeda } | { ok:false, status, error }
async function faTilStad(o) {
  const f = await finnaStad({ sb: o.sb, kt: o.kt, baseId: o.baseId, nafn: o.row && o.row.nafn, heimilisfang: o.row && o.row.heimilisfang });
  if (!f.ok) return { ok: false, status: 502, error: 'kennitöluleit mistókst — ekkert stofnað: ' + f.error };
  if (f.sama) {
    let row = f.sama;
    const upd = audirReitir(row, o.row || {}, !!o.thjonusta);
    if (Object.keys(upd).length) {
      const p = await o.sb.send('PATCH', 'fyrirtaeki?id=eq.' + encodeURIComponent(row.id) + '&select=' + COLS, upd, 'return=representation');
      if (!p.ok) return { ok: false, status: p.status || 502, error: 'fyrirtaeki PATCH ' + p.status + ' ' + p.text };
      row = p.rows[0] || Object.assign({}, row, upd);
    }
    return { ok: true, hvernig: 'reuse', astaeda: f.astaeda, row, rows: f.rows };
  }
  if (f.rows.length && o.nyrStadurLeyfdur === false) return { ok: true, hvernig: 'til', row: f.rows[0], rows: f.rows };
  const s = await settaInnStad({ sb: o.sb, kt: o.kt, row: Object.assign({}, o.row, o.thjonusta ? { er_i_thjonustu: true } : {}) });
  if (!s.ok) return s;
  return { ok: true, hvernig: f.rows.length ? 'site' : 'ny', row: s.row, rows: f.rows, stadur_nr: s.stadur_nr };
}

module.exports = { WALKIN, normKt, dashKt, ktOr, normNafn, greinaHeimili, samaHeimili, makeSb, defaultSb, finnaKt, finnaStad, naestaNr, naestaNrFraGrunni, settaInnStad, faTilStad, audirReitir };
