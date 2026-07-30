// link-heilsa.js — ER HLEKKURINN LIFANDI? Ódýr metadata-könnun á öllum
// `customer_documents.drive_file_id`.
//
//   GET /api/link-heilsa                      → staða úr grunni (engin Drive-köll)
//   GET /api/link-heilsa?run=1[&limit=250][&offset=N][&recheck=1]
//                                             → kannar lotu og VISTAR niðurstöðu
//   GET /api/link-heilsa?dead=1[&limit=200]   → listi yfir staðfest dauða hlekki
//
// AF HVERJU ÞETTA ER TIL (2026-07-30)
// Kerfið mældi hlekkja-heilsu með því að spyrja „er skráin í MASTER-MÖPPU?".
// Sá mælikvarði mælir SKIPULAG, ekki hvort hlekkurinn virki: skrá sem lifir
// góðu lífi í annarri möppu taldist „unmatched" og leit út eins og gagnatap.
// Mæling á 40 slembiúrtaki sýndi að ~82% „unmatched" skjala SVÖRUÐU (200/302)
// og aðeins ~15% voru raunverulega 404. Þess vegna leit vandinn út fyrir að
// vera ~6× stærri en hann er, og „dauðir hlekkir" komu „alltaf aftur".
//
// Hér er spurt beint: svarar `files.get` fyrir þetta id? Aðeins `fields=id,
// name,trashed` — ENGIN niðurhal (skjal.js/drive-download.js sækja bætin og
// eru þung; þetta er nokkur hundruð bæt per skrá).
//
// ÖRYGGI: les-eingöngu gagnvart Drive. Eina skrifið er í ÞRJÁ heilsu-dálka á
// customer_documents (link_ok / link_checked_at / link_status) — snertir aldrei
// drive_file_id, storage_path, tengingar né skrár í Drive.

const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbHeaders = (extra) => Object.assign(
  { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
  extra || {});

const CONC = 12;            // samhliða metadata-köll
const DEFAULT_LIMIT = 250;  // ~10s þak Netlify; metadata-kall er ~50-100ms

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`sbGet ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

// Eitt ódýrt metadata-kall. Skilar ALDREI kasti — hver skrá fær sína niðurstöðu.
async function probe(token, fid) {
  try {
    const r = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fid)}` +
      `?fields=id,trashed&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      // Skrá í ruslinu er tæknilega til en ónothæf → telst dauð.
      return d && d.trashed ? { ok: false, status: 'trashed' } : { ok: true, status: '200' };
    }
    return { ok: false, status: String(r.status) };   // 404 = horfin, 403 = enginn aðgangur
  } catch (e) {
    return { ok: null, status: 'net' };               // netvilla → ÓÚTKLJÁÐ, ekki dauð
  }
}

async function inChunks(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...await Promise.all(items.slice(i, i + size).map(fn)));
  }
  return out;
}

// POST {action:'restore', ids:[…]} — ENDURHEIMTA úr Drive-ruslinu.
// Þröngt afmarkað viljandi: gerir AÐEINS trashed=false, aldrei trashed=true,
// og aðeins fyrir skjöl sem GRUNNURINN segir vera í rusli (listinn frá
// biðlaranum er ALDREI treyst — hann er síaður gegn link_status='trashed').
// Google tæmir ruslið eftir ~30 daga, svo þetta er tímabundinn gluggi.
async function restore(ids) {
  const wanted = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isFinite);
  if (!wanted.length) return { ok: false, error: 'engin gild id' };

  // Server-megin staðfesting: aðeins raðir sem eru MERKTAR trashed
  const rows = await sbGet('customer_documents?select=id,drive_file_id,doc_type,year' +
    `&link_status=eq.trashed&id=in.(${wanted.join(',')})`);
  if (!rows.length) return { ok: true, restored: 0, results: [], note: 'engin þeirra er merkt trashed' };

  const token = await freshAccessToken();
  const nu = new Date().toISOString();
  const results = await inChunks(rows, 5, async (r) => {
    try {
      const up = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(r.drive_file_id)}?supportsAllDrives=true`,
        { method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: false }) });
      if (!up.ok) return { id: r.id, ok: false, error: `drive ${up.status}` };
      const v = await probe(token, r.drive_file_id);          // sannreyna strax
      await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${r.id}`, {
        method: 'PATCH', headers: sbHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ link_ok: v.ok, link_checked_at: nu, link_status: v.status }),
      }).catch(() => null);
      // rekjanleiki
      await fetch(`${SUPABASE_URL}/rest/v1/override_log`, {
        method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ field: 'link_restore', old_value: 'trashed',
          new_value: `${r.drive_file_id} → ${v.status}`, note: `doc ${r.id} ${r.doc_type} ${r.year || ''}` }),
      }).catch(() => null);
      return { id: r.id, ok: v.ok === true, status: v.status };
    } catch (e) { return { id: r.id, ok: false, error: String((e && e.message) || e) }; }
  });
  return { ok: true, reyndi: rows.length, restored: results.filter(r => r.ok).length, results };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vantar' });

  if (event.httpMethod === 'POST') {
    let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (_) {}
    if (b.action !== 'restore') return json(400, { error: "aðeins action:'restore'" });
    try { return json(200, await restore(b.ids)); }
    catch (e) { return json(500, { error: String((e && e.message) || e) }); }
  }
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET/POST only' });

  const p = event.queryStringParameters || {};

  try {
    // ── Samantekt úr grunni (engin Drive-köll) ──────────────────────────────
    // Telur með Content-Range (Prefer: count=exact) — sækir ENGAR raðir.
    const count = async (q) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?${q}&select=id`,
        { headers: sbHeaders({ Prefer: 'count=exact', Range: '0-0' }) });
      const cr = r.headers.get('content-range') || '*/0';
      return parseInt(String(cr).split('/')[1] || '0', 10) || 0;
    };
    const summary = async () => {
      const [med_drive_hlekk, athugud, lifandi, daud, eftir] = await Promise.all([
        count('drive_file_id=not.is.null'),
        count('drive_file_id=not.is.null&link_checked_at=not.is.null'),
        count('link_ok=is.true'),
        count('link_ok=is.false'),
        count('drive_file_id=not.is.null&link_checked_at=is.null'),
      ]);
      return { med_drive_hlekk, athugud, lifandi, daud, eftir };
    };

    // ── ?dead=1 — listi yfir staðfest dauða hlekki ──────────────────────────
    if (p.dead) {
      const lim = Math.min(parseInt(p.limit || '200', 10) || 200, 1000);
      const rows = await sbGet(
        'customer_documents?select=id,doc_type,year,fyrirtaeki_id,customer_base_id,' +
        'drive_file_id,storage_path,link_status,link_checked_at,notes' +
        `&link_ok=is.false&order=doc_type.asc,year.desc&limit=${lim}`);
      // Skjal sem á Supabase-afrit er EKKI týnt — það opnast, bara ekki úr Drive.
      const tynd = rows.filter(r => !r.storage_path);
      return json(200, {
        ok: true, counts: await summary(),
        daudir_alls: rows.length,
        tynd_alveg: tynd.length,
        m_supabase_afrit: rows.length - tynd.length,
        rows,
      });
    }

    // ── Sjálfgefið: bara staðan ────────────────────────────────────────────
    if (!p.run) return json(200, { ok: true, counts: await summary(),
      hint: 'Keyra lotu: /api/link-heilsa?run=1&limit=250 (endurtaka með nextOffset þar til done)' });

    // ── ?run=1 — kanna lotu og vista ───────────────────────────────────────
    const limit = Math.min(parseInt(p.limit || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 500);
    const offset = parseInt(p.offset || '0', 10) || 0;
    // Sjálfgefið: aðeins ÓATHUGUÐ (svo endurteknar keyrslur mjaki sér áfram).
    // recheck=1 → athuga allt upp á nýtt.
    const filt = p.recheck ? 'drive_file_id=not.is.null'
                           : 'drive_file_id=not.is.null&link_checked_at=is.null';
    const rows = await sbGet(
      `customer_documents?select=id,drive_file_id&${filt}&order=id.asc&offset=${offset}&limit=${limit}`);

    if (!rows.length) return json(200, { ok: true, done: true, checked: 0, counts: await summary() });

    const token = await freshAccessToken();
    const nu = new Date().toISOString();
    const results = await inChunks(rows, CONC, async (r) => {
      const v = await probe(token, r.drive_file_id);
      return { id: r.id, ...v };
    });

    // Vista — sleppa óútkljáðum netvillum svo þær verði reyndar aftur síðar.
    const writes = results.filter(r => r.ok !== null);
    await inChunks(writes, 10, async (r) =>
      fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${r.id}`, {
        method: 'PATCH', headers: sbHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ link_ok: r.ok, link_checked_at: nu, link_status: r.status }),
      }).catch(() => null));

    const alive = results.filter(r => r.ok === true).length;
    const dead = results.filter(r => r.ok === false).length;
    const net = results.filter(r => r.ok === null).length;

    return json(200, {
      ok: true, done: rows.length < limit,
      checked: rows.length, lifandi: alive, daud: dead, netvillur: net,
      offset, nextOffset: offset + (p.recheck ? rows.length : 0),  // án recheck styttist listinn sjálfkrafa
      staða_kóðar: results.filter(r => r.ok === false)
        .reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}),
      counts: await summary(),
    });
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};
