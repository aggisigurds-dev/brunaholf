// doc-matrix.js — coverage matrix of customer documents by (customer, year, type).
//
// Returns one row per service-customer base with per-year counts +
// drive_file_ids per doc_type so the UI can show ✓ / ⚠ N / — cells.
//
//   GET /api/doc-matrix[?from=2023&to=2026]
//
// Response shape:
//   {
//     years: [2023,2024,2025,2026],
//     types: ['uttektarskyrsla','reikningur','samningur'],
//     rows: [
//       {
//         base_id, nafn, kennitala, er_i_thjonustu,
//         cells: { '2023:uttektarskyrsla': [drive_file_id, …], ... }
//       },
//       ...
//     ]
//   }
//
// Sorted by `er_i_thjonustu DESC NULLS LAST, nafn ASC`.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vantar' });

  const p = event.queryStringParameters || {};
  const from = Math.max(2018, parseInt(p.from || '2023', 10) || 2023);
  const to = Math.min(2030, parseInt(p.to || '2026', 10) || 2026);
  const years = [];
  for (let y = from; y <= to; y++) years.push(y);

  const types = ['uttektarskyrsla', 'reikningur', 'samningur'];

  try {
    // Pull every relevant customer base (service customers + anyone with docs).
    const bases = await fetchAll(
      'customers_base',
      `select=id,nafn,kennitala,er_i_thjonustu&order=er_i_thjonustu.desc.nullslast,nafn.asc`
    );

    // Pull all docs in window.
    const docs = await fetchAll(
      'customer_documents',
      `select=id,customer_base_id,doc_type,year,doc_date,drive_file_id,storage_path,is_duplicate&` +
      `year=gte.${from}&year=lte.${to}&order=year.asc`
    );

    // Pre-bucket docs into (base_id × year × type) → [drive_file_id|id]
    const bucket = new Map();
    for (const d of docs) {
      if (d.is_duplicate) continue;
      const key = `${d.customer_base_id}:${d.year}:${d.doc_type}`;
      const arr = bucket.get(key) || [];
      arr.push(d.storage_path ? `${SUPABASE_URL}/storage/v1/object/public/${d.storage_path}` : ((d.drive_file_id && !String(d.drive_file_id).startsWith('sb:')) ? `/api/skjal?id=${encodeURIComponent(d.drive_file_id)}` : ''));
      bucket.set(key, arr);
    }

    const rows = bases
      .map(b => {
        const cells = {};
        let hasAny = false;
        for (const y of years) for (const t of types) {
          const k = `${y}:${t}`;
          const arr = bucket.get(`${b.id}:${y}:${t}`) || [];
          if (arr.length) hasAny = true;
          cells[k] = arr;
        }
        return { base_id: b.id, nafn: b.nafn, kennitala: b.kennitala, er_i_thjonustu: !!b.er_i_thjonustu, cells, hasAny };
      })
      // Drop bases without a single doc in window AND that aren't service customers
      .filter(r => r.hasAny || r.er_i_thjonustu)
      .map(({ hasAny, ...r }) => r); // strip helper

    return json(200, {
      generated_at: new Date().toISOString(),
      years, types,
      doc_count: docs.length,
      customer_count: rows.length,
      rows,
    });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

async function fetchAll(table, qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + 999}`, 'Range-Unit': 'items',
      },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}

function cors() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(s, p) { return resp(s, JSON.stringify(p), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
