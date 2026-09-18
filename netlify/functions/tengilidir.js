// tengilidir.js — read + manage Charlize tengiliðir (contact list).
//
//   GET  /api/tengilidir            → { contacts:[…], stats:{…} }
//   POST /api/tengilidir  { action:'link',    id, kennitala, fyrirtaeki? }
//                          { action:'unlink',  id }
//                          { action:'approve', id }   // pending → approved (active)
//                          { action:'reject',  id }   // → rejected (hidden from otengd/pending)
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (!SUPABASE_URL || !KEY) return json(500, { error: 'missing SUPABASE env' });

  try {
    if (event.httpMethod === 'GET') {
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
      if (!id || !b.action) return json(400, { error: 'id + action required' });
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
