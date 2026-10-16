// tengilidir.js — read + manage Charlize tengiliðir (contact list).
//
//   GET  /api/tengilidir            → { contacts:[…], stats:{…} }
//   POST /api/tengilidir  { action:'link',    id, kennitala, fyrirtaeki? }
//                          { action:'unlink',  id }
//                          { action:'approve', id }   // pending → approved (active)
//                          { action:'reject',  id }   // → rejected (hidden from otengd/pending)
//   GET  /api/tengilidir?kennitala=… → { contacts:[…] } tengiliðir EINS félags (16.10.2026)
//   POST /api/tengilidir  { action:'add', netfang, kennitala, fyrirtaeki? }  // viðbótarnetfang félags
//                          { action:'aftengja', id }  // tekur netfangið af félaginu
//
// 16.10.2026 — VIÐBÓTARNETFÖNG Á PRÓFÍLNUM (Slökkvitæki 473). Agnar: „heimila að ég geti sett inn
// viðbótar tölvupósta … sem hjálpar við að tengja Samskipti". Samþykkt röð með kennitölu fer nú inn í
// v_kunni_netfong (sql/2026-10-16_v_kunni_netfong_vidbotarnetfong.sql í slokkvitaeki), svo póstar frá
// og til netfangsins birtast í Samskiptum félagsins. Sama tafla og Tengiliðir-síðan — ein staðreynd.
//
// charlize_contacts has RLS ON (customer emails) — the web can't read it with the
// anon key, so this service-role function is the ONLY door. It never touches email
// content; it only reads/writes the contact rows the build step already produced.
const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'content-type': 'application/json' };
const json = (code, o) => ({ statusCode: code, headers: cors, body: JSON.stringify(o) });

async function pageAll(path, select, extra = '') {
  const out = []; let offset = 0; const step = 1000;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}?select=${select}${extra}&limit=${step}&offset=${offset}`, { headers: H });
    if (!r.ok) throw new Error(`${path} ${r.status} ${(await r.text()).slice(0, 160)}`);
    const rows = await r.json(); out.push(...rows);
    if (rows.length < step) break; offset += step;
  }
  return out;
}

// Kennitala alltaf geymd með bandstriki (mælt 16.10.2026: 417 af 417 tengdum röðum).
function ktStrik(v) {
  const d = String(v || '').replace(/\D/g, '');
  return d.length === 10 ? d.slice(0, 6) + '-' + d.slice(6) : '';
}
const idag = () => new Date().toISOString().slice(0, 10);
const enc = encodeURIComponent;

// Viðbótarnetfang félags. Netfang sem er þegar til í töflunni er TENGT (ótengd röð) eða
// samþykkt (sama félag) frekar en tvítekið — UNIQUE (netfang, kennitala) myndi hvort eð er hafna því.
// Netföngin eru öll geymd í lágstöfum (mælt: 0 af 453 með hástaf), svo eq dugar.
async function baetaVid(b) {
  const addr = String(b.netfang || '').trim().toLowerCase().replace(/^mailto:/, '');
  const kt = ktStrik(b.kennitala);
  if (!addr || addr.indexOf('@') < 1) return json(400, { error: 'Netfangið þarf @ — t.d. jon@felag.is' });
  if (!kt) return json(400, { error: 'Félagið vantar kennitölu (10 tölustafi) — netfangið tengist á kennitölu' });
  const fyrirtaeki = String(b.fyrirtaeki || '').trim() || null;
  const r0 = await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts?netfang=eq.${enc(addr)}&select=*`, { headers: H });
  if (!r0.ok) return json(r0.status, { error: 'lestur ' + r0.status + ' ' + (await r0.text()).slice(0, 160) });
  const til = await r0.json();
  const onnur = til.filter(r => r.kennitala && r.kennitala !== kt && r.status === 'approved')
    .map(r => ({ kennitala: r.kennitala, fyrirtaeki: r.fyrirtaeki }));
  const patchRod = async (rid, patch) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts?id=eq.${rid}`, {
      method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(patch),
    });
    if (!r.ok) return json(r.status, { error: 'patch ' + r.status + ' ' + (await r.text()).slice(0, 160) });
    const u = await r.json();
    return json(200, { ok: true, contact: (u && u[0]) || null, onnur });
  };
  const sama = til.find(r => r.kennitala === kt);
  if (sama) return patchRod(sama.id, { status: 'approved', confidence: 'confirmed' });
  const otengd = til.find(r => !r.kennitala);
  if (otengd) return patchRod(otengd.id, { kennitala: kt, fyrirtaeki: fyrirtaeki || otengd.fyrirtaeki, status: 'approved', confidence: 'confirmed' });
  const fyrst = til[0] || {};
  const row = {
    netfang: addr, len: addr.split('@')[1] || null, tegund: 'netfang',
    hlutverk: fyrst.hlutverk || null, heiti: fyrst.heiti || null, attin: fyrst.attin || null,
    faerslur: fyrst.faerslur || null, fyrst_sest: fyrst.fyrst_sest || null, sidast_sest: fyrst.sidast_sest || null,
    kennitala: kt, fyrirtaeki, status: 'approved', confidence: 'confirmed',
    source: 'Fyrirtækjaprófíll: viðbótarnetfang (' + idag() + ')',
  };
  const ir = await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts?on_conflict=netfang,kennitala`, {
    method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row),
  });
  if (!ir.ok) return json(ir.status, { error: 'insert ' + ir.status + ' ' + (await ir.text()).slice(0, 160) });
  const ny = await ir.json();
  return json(200, { ok: true, added: true, contact: (ny && ny[0]) || null, onnur });
}

// Tekur netfangið af félaginu. Beri önnur röð sama netfang (annað félag, eða ótengd) er ÞESSI röð
// aðeins tenging og henni er eytt — annars stæðu tvær ótengdar raðir með sama netfangi á
// Tengiliðir-síðunni. Sé hún eina röð netfangsins verður hún ótengd og fer aftur á þá síðu.
async function aftengja(id) {
  const r0 = await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts?id=eq.${id}&select=id,netfang`, { headers: H });
  const rod = r0.ok ? (await r0.json())[0] : null;
  if (!rod) return json(404, { error: 'tengiliður fannst ekki' });
  const r1 = await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts?netfang=eq.${enc(rod.netfang)}&id=neq.${id}&select=id`, { headers: H });
  const fleiri = r1.ok ? (await r1.json()).length : 0;
  const r = fleiri
    ? await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts?id=eq.${id}`, { method: 'DELETE', headers: { ...H, Prefer: 'return=representation' } })
    : await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts?id=eq.${id}`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ kennitala: null, fyrirtaeki: null }),
      });
  if (!r.ok) return json(r.status, { error: 'aftengja ' + r.status + ' ' + (await r.text()).slice(0, 160) });
  const u = await r.json();
  if (!u || !u.length) return json(409, { error: 'engin röð breyttist — reyndu aftur' });
  return json(200, { ok: true, eytt: !!fleiri, contact: u[0] });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (!SUPABASE_URL || !KEY) return json(500, { error: 'missing SUPABASE env' });

  try {
    if (event.httpMethod === 'GET') {
      const q = event.queryStringParameters || {};
      if (q.kennitala) {
        const kt = ktStrik(q.kennitala);
        if (!kt) return json(400, { error: 'kennitala þarf 10 tölustafi' });
        const rows = await pageAll('charlize_contacts',
          'id,netfang,len,fyrirtaeki,kennitala,hlutverk,heiti,faerslur,sidast_sest,status,confidence,source,created_at',
          '&kennitala=eq.' + kt + '&status=neq.rejected&order=created_at.asc');
        // Sama netfang tengt ÖÐRU félagi → v_kunni_netfong getur ekki eignað póstinn öðru þeirra
        // (HAVING count(DISTINCT bid) = 1) og hann birtist hvorugu. Það á að sjást á prófílnum.
        const addrs = [...new Set(rows.map(r => r.netfang).filter(Boolean))];
        let onnur = [];
        if (addrs.length) {
          onnur = await pageAll('charlize_contacts', 'netfang,kennitala,fyrirtaeki',
            '&netfang=in.(' + encodeURIComponent(addrs.map(a => '"' + a.replace(/"/g, '') + '"').join(',')) + ')&kennitala=not.is.null&kennitala=neq.' + kt + '&status=eq.approved');
        }
        rows.forEach(r => { r.onnur = onnur.filter(o => o.netfang === r.netfang).map(o => ({ kennitala: o.kennitala, fyrirtaeki: o.fyrirtaeki })); });
        return json(200, { contacts: rows });
      }
      const rows = await pageAll('charlize_contacts',
        'id,netfang,len,fyrirtaeki,kennitala,hlutverk,heiti,attin,faerslur,fyrst_sest,sidast_sest,status,confidence,source',
        '&status=neq.rejected&order=faerslur.desc.nullslast');
      const stats = {
        total: rows.length,
        linked: rows.filter(r => r.kennitala).length,
        otengd: rows.filter(r => !r.kennitala).length,
        pending: rows.filter(r => r.status === 'pending').length,
        approved: rows.filter(r => r.status === 'approved').length,
        domains: new Set(rows.map(r => r.len).filter(Boolean)).size,
      };
      return json(200, { contacts: rows, stats });
    }

    if (event.httpMethod === 'POST') {
      let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (_) {}
      const id = +b.id;
      if (b.action === 'add') return await baetaVid(b);
      if (!id || !b.action) return json(400, { error: 'id + action required' });
      if (b.action === 'aftengja') return await aftengja(id);
      let patch = null;
      // 18.09.2026 (Agnar: „bryndis@ — allt í lagi þó sama samskiptasamtalið tengist á fleiri"):
      // umsjónaraðili skrifar um mörg hús. 'link' SKIPTIR um hús á röðinni; 'link_add' BÆTIR VIÐ
      // húsi — ný röð með sama netfangi og annarri kennitölu (UNIQUE (netfang, kennitala) ver gegn
      // tvítökum). Sé upphaflega röðin ótengd er hún einfaldlega tengd.
      if (b.action === 'link_add') {
        const kt = String(b.kennitala || '').trim();
        if (!kt) return json(400, { error: 'kennitala required for link_add' });
        const sr = await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts?id=eq.${id}&select=*`, { headers: H });
        const src = sr.ok ? (await sr.json())[0] : null;
        if (!src) return json(404, { error: 'tengiliður fannst ekki' });
        if (src.kennitala && String(src.kennitala).replace(/\D/g, '') !== kt.replace(/\D/g, '')) {
          const row = {
            netfang: src.netfang, len: src.len, tegund: src.tegund, hlutverk: src.hlutverk, heiti: src.heiti, attin: src.attin,
            faerslur: src.faerslur, fyrst_sest: src.fyrst_sest, sidast_sest: src.sidast_sest,
            kennitala: kt, fyrirtaeki: (b.fyrirtaeki || null), status: 'approved', confidence: 'confirmed',
            source: 'Tengiliðir-síðan: viðbótarhús við ' + (src.fyrirtaeki || src.kennitala) + ' (' + new Date().toISOString().slice(0, 10) + ')',
          };
          const ir = await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts?on_conflict=netfang,kennitala`, {
            method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(row),
          });
          if (!ir.ok) return json(ir.status, { error: 'insert ' + ir.status + ' ' + (await ir.text()).slice(0, 160) });
          const ny = await ir.json();
          return json(200, { ok: true, added: true, contact: (ny && ny[0]) || null });
        }
        patch = { kennitala: kt, fyrirtaeki: (b.fyrirtaeki || null), confidence: 'confirmed' };
      } else if (b.action === 'link') {
        const kt = String(b.kennitala || '').trim();
        if (!kt) return json(400, { error: 'kennitala required for link' });
        patch = { kennitala: kt, fyrirtaeki: (b.fyrirtaeki || null), confidence: 'confirmed' };
      } else if (b.action === 'unlink') {
        patch = { kennitala: null };
      } else if (b.action === 'approve') {
        patch = { status: 'approved', confidence: 'confirmed' };
      } else if (b.action === 'reject') {
        patch = { status: 'rejected' };
      } else {
        return json(400, { error: 'unknown action' });
      }
      const r = await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts?id=eq.${id}`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(patch),
      });
      if (!r.ok) return json(r.status, { error: 'patch ' + r.status + ' ' + (await r.text()).slice(0, 160) });
      const upd = await r.json();
      return json(200, { ok: true, contact: (upd && upd[0]) || null });
    }

    return json(405, { error: 'method not allowed' });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};
