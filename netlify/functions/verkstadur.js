// verkstadur.js — mynd, heimilisfang, húsupplýsingar og teikningar per verkstað (tafla verkstadur_info).
//
// 02.11.2026 (Agnar, Kröfu yfirlit: „vanti mynd þarna af heimilisfanginu og að það sé hægt að sjá betri
// upplýsingar og teikningar af verkstaðnum eins og á slökkvitæki company profiles").
//
//   GET  /api/verkstadur?all=1   → { rows:[{ worksite_name, heimilisfang, mynd_url, mynd_texti, hus, … }] }  (án teikningalista)
//   GET  /api/verkstadur?ws=NAFN → { row }  (með teikningalista)
//   POST /api/verkstadur { action:'vista', ws, heimilisfang, heimilisfang_heimild, hus, teikningar,
//                          mynd:{ b64, type, heimild, texti } | null, by }
//        → myndin fer í public bucket `verkstadir`, röðin upsertast. mynd:null = reynt, engin mynd fannst.
//
// Vafrinn sækir sjálfur úr Slökkvitækja-föllunum (hus-upplysingar + husmynd, CORS *) og sendir hingað til
// geymslu — svo engin keðja ytri kalla lendir á 10 s þaki fallsins. Sótt aðeins við raunverulegan smell.
const KV = require('./_ktvorn');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'verkstadir';
// Teikningaborð verkstaðar (mál #1464, 11.11.2026): falið félag á kennitölu Brunahólfs ehf (customers_base 330) sem
// er_i_thjonustu=false og status óvirkur — sama snið og 17 handgerðu raðirnar frá 03.–04.11 (#1910 Skúlagata 26 o.fl.).
const BH_KT = '5204172300';
const GERVI_FORSKEYTI = 'Brunahólf - ';
const LISTI = 'worksite_name,heimilisfang,heimilisfang_heimild,mynd_url,mynd_heimild,mynd_texti,hus,updated_at,updated_by';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

  if (event.httpMethod === 'GET') {
    const q = event.queryStringParameters || {};
    if (q.ws) {
      const [r, t] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/verkstadur_info?worksite_name=eq.${encodeURIComponent(q.ws)}&select=*`, { headers: H }),
        fetch(`${SUPABASE_URL}/rest/v1/ajour_teikningar?select=file_id,project_id,project_name,nafn,n_skraningar,n_klarad,mynd_url,w,h,sidast&order=project_name,nafn`, { headers: { ...H, Range: '0-4999' } }),
      ]);
      if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
      const row = (await r.json())[0] || null;
      const allar = t.ok ? await t.json() : [];
      // Teikningaborð Slökkvitækis (03.11.2026, HT-02.11): verkstaður með slokk_company_id á teikning_bord-röð (hæðir, skurðir,
      // eldveggir/brunahólf sem Teikningin vistar) — hub-inn sýnir hæðaspjöldin og opnar Teikninguna í Slökkvitæki.
      let bord = null;
      if (row && row.slokk_company_id) {
        try {
          const tb = await fetch(`${SUPABASE_URL}/rest/v1/teikning_bord?company_id=eq.${row.slokk_company_id}&select=company_id,haedir,updated_at`, { headers: H });
          const b0 = tb.ok ? (await tb.json())[0] : null;
          if (b0) bord = { company_id: b0.company_id, updated_at: b0.updated_at, haedir: (b0.haedir || []).map((h) => ({ id: h.id, nafn: h.nafn, image_url: h.image_url, frum: h.frum || null, skurdur: h.skurdur || null, eldveggir: (h.eldveggir || []).filter(Boolean).length, holf: (h.holf || []).length, merki: (h.markers || []).length })) };
          // Félagið er til en Teikningin hefur ekki vistað neitt enn (teikning_bord verður til við fyrstu vistun þar):
          // borðið er samt TIL — tómt — svo hub-inn sýnir „Opna Teikningu" en ekki „Stofna" aftur.
          else if (tb.ok) bord = { company_id: row.slokk_company_id, updated_at: null, haedir: [], tomt: true };
        } catch (_) { bord = null; }
      }
      return json(200, { row, ajour: ajourFyrir(q.ws, row, Array.isArray(allar) ? allar : []), bord });
    }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/verkstadur_info?select=${LISTI}&order=worksite_name`, { headers: { ...H, Range: '0-999' } });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, { rows: await r.json() });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const ws = String(b.ws || '').trim();
  if (!ws) return json(400, { error: 'ws vantar' });
  if (b.action === 'ajour') {
    // Handvalið Ajour-verkefni (tómt = sjálfvirk pörun aftur).
    const r = await fetch(`${SUPABASE_URL}/rest/v1/verkstadur_info?on_conflict=worksite_name`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ worksite_name: ws, ajour_project_id: b.ajour_project_id || null, updated_at: new Date().toISOString(), updated_by: String(b.by || '').slice(0, 60) || null }),
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, { ok: true, row: (await r.json())[0] || null });
  }
  if (b.action === 'mynd') {
    // Eigin mynd (Agnar 02.11: „leyfa að ég skipti um mynd") — snertir aðeins myndarreitina, ekki heimilisfang/teikningar.
    const m = b.mynd || {};
    if (!m.b64) return json(400, { error: 'mynd vantar' });
    const upp = await geymaMynd(ws, m, H);
    if (upp.error) return json(upp.status || 400, { error: upp.error });
    const r = await fetch(`${SUPABASE_URL}/rest/v1/verkstadur_info?on_conflict=worksite_name`, {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ worksite_name: ws, mynd_url: upp.url, mynd_heimild: 'handvirkt', mynd_texti: String(m.texti || 'Eigin mynd').slice(0, 120), updated_at: new Date().toISOString(), updated_by: String(b.by || '').slice(0, 60) || null }),
    });
    if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
    return json(200, { ok: true, row: (await r.json())[0] || null });
  }
  if (b.action === 'stofna_bord') return stofnaBord(ws, b, H);
  if (b.action !== 'vista') return json(400, { error: 'action vantar' });

  const rod = {
    worksite_name: ws,
    heimilisfang: String(b.heimilisfang || '').trim() || null,
    heimilisfang_heimild: b.heimilisfang_heimild || null,
    hus: b.hus || null,
    teikningar: Array.isArray(b.teikningar) ? b.teikningar.slice(0, 60) : null,
    updated_at: new Date().toISOString(),
    updated_by: String(b.by || '').slice(0, 60) || null,
  };
  const m = b.mynd;
  if (m && m.b64) {
    const upp = await geymaMynd(ws, m, H);
    if (upp.error) return json(upp.status || 400, { error: upp.error });
    rod.mynd_url = upp.url;
    rod.mynd_heimild = String(m.heimild || '').slice(0, 40) || null;
    rod.mynd_texti = String(m.texti || '').slice(0, 120) || null;
  } else if (m === null) {
    // Reynt og engin mynd fannst — gamla myndin (ef einhver) víkur ekki nema heimilisfangið hafi breyst.
    rod.mynd_heimild = 'engin';
    if (b.nytt_heimilisfang) { rod.mynd_url = null; rod.mynd_texti = null; }
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/verkstadur_info?on_conflict=worksite_name`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rod),
  });
  if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
  return json(200, { ok: true, row: (await r.json())[0] || null });
};

// Ajour-verkefni ↔ verkstaður. Nöfnin eru ólík („Skùlagata 26" / „Skúlagata 26", „Heklu reitur" / „Heklureitur",
// „Hrafnista Nesvellir 4" / „Nesvellir 4", „Höfðabakka 9B" / „Höfðabakki 9B"): sama orð (eða ≥5 stafa sameiginlegt
// forskeyti) OG sama húsnúmer ef verkstaðurinn ber númer. Handpör eins og í /api/ajour-yfirlit (staðfest af Agnari 18.09).
const HANDPOR = [[/^landss?p[ií]talinn/i, /^NLSH/i], [/^[áa]land 6/i, /^Borgarsp[ií]talinn/i]];
const brjota = (s) => String(s || '').toLowerCase().replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/ö/g, 'o')
  .normalize('NFD').replace(/[̀-ͯ]/g, '');
const ord = (s) => brjota(s).split(/[^a-z0-9]+/).filter((w) => w && !/^\d/.test(w) && w.length >= 4 && !['hotel', 'blu', 'farm', 'reitur', 'reitir'].includes(w));
const numer = (s) => (brjota(s).match(/\b(\d{1,4})[a-z]?\b/g) || []).map((x) => parseInt(x, 10));
// Fallbeyging/stafsetning („Fellaskóla"/„Fellaskóli", „Fjarðagata"/„Fjarðargata", „Ölduselskoli"/„Ölduselsskóli"):
// orð ≥6 stafa með Levenshtein-fjarlægð ≤2 teljast eins. Sameiginlegt forskeyti eitt sér dugar EKKI — „Borgarnes" ≠ „Borgarspítalinn".
function fjarl(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return d[b.length];
}
function passar(ws, pn) {
  for (const [a, b] of HANDPOR) if (a.test(ws.trim())) return b.test(pn.trim());
  const wo = ord(ws), po = ord(pn);
  // „Heklu reitur" → „heklureitur": samsett nafn borið saman án bila (allt nafnið, ekki forskeyti)
  const wj = brjota(ws).replace(/[^a-z]/g, ''), pj = brjota(pn).replace(/[^a-z]/g, '');
  const ordPassa = wo.some((w) => po.some((p) => p === w || (w.length >= 6 && p.length >= 6 && fjarl(w, p) <= 2))) || (wj.length >= 6 && wj === pj);
  if (!ordPassa) return false;
  const wn = numer(ws); if (!wn.length) return true;
  const pnn = numer(pn); return wn.some((n) => pnn.includes(n));
}
function ajourFyrir(ws, row, allar) {
  const verk = new Map();
  for (const t of allar) { const v = verk.get(t.project_id) || { project_id: t.project_id, project_name: t.project_name, n: 0 }; v.n++; verk.set(t.project_id, v); }
  const verkefni = [...verk.values()].sort((a, b) => String(a.project_name).localeCompare(String(b.project_name), 'is'));
  const handvalid = (row && row.ajour_project_id) || null;
  const valin = handvalid ? verkefni.filter((v) => v.project_id === handvalid) : verkefni.filter((v) => passar(ws, v.project_name || ''));
  const ids = new Set(valin.map((v) => v.project_id));
  const teikningar = allar.filter((t) => ids.has(t.project_id)).sort((a, b) => (b.n_skraningar || 0) - (a.n_skraningar || 0));
  return { verkefni, valin, handvalid, teikningar };
}

// „＋ Stofna teikningaborð" (mál #1464, valkostur 1): verkstaður án slokk_company_id fær falið félag í Slökkvitæki
// svo Teikningin (teikning_bord per félag) virki. Aldrei tvítekið:
//   1. verkstaðurinn á þegar félag → því skilað, ekkert skrifað;
//   2. annars kennitölureglan (_ktvorn.faTilStad) á kt Brunahólfs: sama NAFN eða sama heimilisfang → sú röð notuð
//      (t.d. „Varmárskóli" og „Varmárskóli 16921" deila #1925), annars ný röð;
//   3. röð sem fyndist og er Í ÞJÓNUSTU eða ber ekki „Brunahólf - "-forskeytið er aldrei tengd sjálfkrafa (409).
// teikning_bord-röðin sjálf verður til þegar Teikningin í Slökkvitæki vistar fyrst (upsert á company_id, 375/383).
async function stofnaBord(ws, b, H) {
  const r0 = await fetch(`${SUPABASE_URL}/rest/v1/verkstadur_info?worksite_name=eq.${encodeURIComponent(ws)}&select=worksite_name,heimilisfang,slokk_company_id`, { headers: H });
  if (!r0.ok) return json(502, { error: 'verkstaðaleit mistókst — ekkert stofnað: ' + (await r0.text()).slice(0, 200) });
  const row = (await r0.json())[0] || null;
  if (row && row.slokk_company_id) return json(200, { ok: true, til: true, company_id: row.slokk_company_id });
  const heimili = String((row && row.heimilisfang) || '').trim();
  if (!/\d/.test(heimili)) return json(400, { error: 'Skráðu heimilisfang verkstaðarins fyrst — Teikningin sækir hæðirnar eftir því.' });
  const heiti = String(b.heiti || '').replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!heiti) return json(400, { error: 'Heiti vantar' });
  const nafn = heiti.indexOf(GERVI_FORSKEYTI) === 0 ? heiti : GERVI_FORSKEYTI + heiti;
  const dags = new Date().toISOString().slice(0, 10).split('-').reverse().join('.');
  const res = await KV.faTilStad({
    sb: KV.makeSb((...a) => fetch(...a), SUPABASE_URL, SUPABASE_KEY), kt: BH_KT, thjonusta: false,
    row: { nafn, heimilisfang: heimili, er_i_thjonustu: false, status: 'óvirkur',
      athugasemdir: 'Verkstaður Brunahólfs (Tímavera „' + ws + '"). Röðin er til svo teikningaborð + brunahólfun virki — ekki þjónustukúnni Slökkvitækis. Stofnað ' + dags + ' með „Stofna teikningaborð" í hubbnum' + (b.by ? ' (' + String(b.by).slice(0, 40) + ')' : '') + '.' },
  });
  if (!res.ok) return json(res.status || 502, { error: res.error });
  const f = res.row || {};
  if (res.hvernig === 'reuse' && (f.er_i_thjonustu === true || String(f.nafn || '').indexOf(GERVI_FORSKEYTI) !== 0)) {
    return json(409, { error: '„' + (f.nafn || '#' + f.id) + '" (#' + f.id + ') á sama nafn eða heimilisfang en er ekki falið teikningafélag — tengi ekki sjálfkrafa.' });
  }
  if (!f.id) return json(502, { error: 'félagið varð ekki til (ekkert id)' });
  const u = await fetch(`${SUPABASE_URL}/rest/v1/verkstadur_info?on_conflict=worksite_name`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ worksite_name: ws, slokk_company_id: f.id, updated_at: new Date().toISOString(), updated_by: String(b.by || '').slice(0, 60) || null }),
  });
  if (!u.ok) return json(u.status, { error: 'félag #' + f.id + ' til, en tenging við verkstaðinn mistókst: ' + (await u.text()).slice(0, 200) });
  const ur = (await u.json())[0] || {};
  if (ur.slokk_company_id !== f.id) return json(502, { error: 'las til baka slokk_company_id=' + ur.slokk_company_id + ' (átti að vera ' + f.id + ')' });
  return json(200, { ok: true, til: false, endurnytt: res.hvernig === 'reuse', company_id: f.id, nafn: f.nafn });
}

async function geymaMynd(ws, m, H) {
  const tegund = /^image\/(jpeg|png|webp)$/.test(m.type || '') ? m.type : 'image/jpeg';
  const bytes = Buffer.from(String(m.b64), 'base64');
  if (bytes.length < 2000 || bytes.length > 4e6) return { error: 'mynd of lítil eða of stór' };
  const slod = `${slug(ws)}-${Date.now()}.${tegund === 'image/png' ? 'png' : tegund === 'image/webp' ? 'webp' : 'jpg'}`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${slod}`, {
    method: 'POST', headers: { ...H, 'Content-Type': tegund, 'x-upsert': 'true', 'Cache-Control': '31536000' }, body: bytes,
  });
  if (!up.ok) return { status: up.status, error: 'geymsla: ' + (await up.text()).slice(0, 200) };
  return { url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${slod}` };
}

function slug(s) {
  return String(s).toLowerCase().replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/ö/g, 'o')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'verkstadur';
}
function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
