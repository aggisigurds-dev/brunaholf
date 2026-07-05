// hreinsi-bord.js — the document "cleaning board".
//
// Reconnects customer_documents to the customer spine with SAFE, ADDITIVE,
// idempotent batch writes only. It never deletes a doc row, never flags a
// duplicate (that stays by-eye in Skýrslu-stöð), never touches a location.
// Every bucket recomputes its proposal server-side, so „apply" always matches
// what the preview showed.
//
//   GET  /api/hreinsi-bord                       → { buckets:{…preview…}, sum }
//   POST /api/hreinsi-bord {action:'apply', bucket, ids:[…]}   → applies that bucket's proposals for those ids
//
// Buckets:
//   reconnect      fyrirtaeki_id NULL, kt-in-notes → EXACTLY ONE live fyrirtaeki  → set fyrirtaeki_id (+base if null)
//   reconnect_many fyrirtaeki_id NULL, kt-in-notes → >1 live fyrirtaeki (multi-site) → COUNT only, hand to Skýrslu-stöð
//   base_link      customer_base_id NULL, kt-in-notes IS in customers_base        → set customer_base_id
//   base_missing   customer_base_id NULL, kt-in-notes NOT in customers_base        → create base + link
//   deleted_ptr    fyrirtaeki_id → a soft-deleted fyrirtaeki                       → repoint to lone live sibling, else clear (keep base)
//   dangling       fyrirtaeki_id → no row at all                                   → clear fyrirtaeki_id
//   bad_year       year impossible (<2005 or >next year)                          → clear year

const { json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  try {
    if (event.httpMethod === 'POST') {
      let body = {}; try { body = JSON.parse(event.body || '{}'); } catch {}
      if (body.action === 'apply') return json(200, await apply(body));
      return json(400, { error: 'unknown action' });
    }
    const { buckets, sum } = await computeBuckets();
    // preview: don't ship the whole reconnect_many detail, just its count is in sum
    return json(200, {
      buckets: {
        reconnect:    buckets.reconnect,
        base_link:    buckets.base_link,
        base_missing: buckets.base_missing,
        deleted_ptr:  buckets.deleted_ptr,
        dangling:     buckets.dangling,
        bad_year:     buckets.bad_year,
      },
      sum,
    });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

// ── Supabase REST helpers ─────────────────────────────────────────────────────
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function sbGet(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders({ Range: `${from}-${from + 999}` }) });
    if (!r.ok) throw new Error('sbGet ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const rows = await r.json().catch(() => []);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
async function sbWrite(method, path, payload, prefer) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: prefer || 'return=representation' }),
    body: payload == null ? undefined : JSON.stringify(payload),
  });
  const rows = await r.json().catch(() => []);
  if (!r.ok) throw new Error(method + ' ' + path.split('?')[0] + ' ' + r.status + ' ' + JSON.stringify(rows).slice(0, 200));
  return rows;
}

const ktDigits = k => String(k || '').replace(/\D/g, '');
const ktDashed = d => (String(d).length === 10 ? String(d).slice(0, 6) + '-' + String(d).slice(6) : String(d));
// pull a kennitala out of free text (notes/customer_name). Prefer a "kt: NNNNNN-NNNN"
// form, else any 6-4 (dashed or not) run that isn't obviously an amount/date.
function ktFromText(t) {
  if (!t) return '';
  const s = String(t);
  let m = s.match(/kt[.:\s]*([0-9]{6}-?[0-9]{4})/i);
  if (m) return ktDigits(m[1]);
  m = s.match(/(?:^|[^0-9])([0-9]{6}-[0-9]{4})(?:[^0-9]|$)/);   // dashed form is safe
  if (m) return ktDigits(m[1]);
  return '';
}

// ── The single source of truth: compute every bucket from a full snapshot ──────
async function computeBuckets() {
  const nextYear = new Date().getFullYear() + 1;
  const [docs, fyr, bases] = await Promise.all([
    sbGet('customer_documents?select=id,doc_type,year,customer_base_id,fyrirtaeki_id,drive_file_id,customer_name,notes,is_duplicate'),
    sbGet('fyrirtaeki?select=id,nafn,heimilisfang,kennitala,customer_base_id,er_i_thjonustu,deleted_at'),
    sbGet('customers_base?select=id,nafn,kennitala'),
  ]);

  const fyrById = {};                 // id → fyrirtaeki row (live or deleted)
  const liveByKt = {};                // ktDigits → [live fyrirtaeki]
  const liveByBase = {};              // customer_base_id → [live fyrirtaeki]
  fyr.forEach(f => {
    fyrById[f.id] = f;
    if (f.deleted_at == null) {
      const d = ktDigits(f.kennitala);
      if (d) (liveByKt[d] = liveByKt[d] || []).push(f);
      if (f.customer_base_id != null) (liveByBase[f.customer_base_id] = liveByBase[f.customer_base_id] || []).push(f);
    }
  });
  const baseByKt = {};
  bases.forEach(b => { const d = ktDigits(b.kennitala); if (d) baseByKt[d] = b; });

  const B = { reconnect: [], reconnect_many: [], base_link: [], base_missing: [], deleted_ptr: [], dangling: [], bad_year: [] };

  for (const d of docs) {
    const name = d.customer_name || (d.notes || '').replace(/\s+/g, ' ').slice(0, 80) || '';
    const kt = ktFromText(d.notes) || ktFromText(d.customer_name);

    // -- fyrirtaeki_id hygiene first (deleted / dangling) --
    if (d.fyrirtaeki_id != null) {
      const target = fyrById[d.fyrirtaeki_id];
      if (!target) {
        B.dangling.push({ id: d.id, doc_type: d.doc_type, year: d.year, name, fyrirtaeki_id: d.fyrirtaeki_id });
      } else if (target.deleted_at != null) {
        const sibs = (liveByBase[target.customer_base_id] || []);
        const to = sibs.length === 1 ? sibs[0] : null;
        B.deleted_ptr.push({
          id: d.id, doc_type: d.doc_type, year: d.year, name,
          from_id: d.fyrirtaeki_id, from_nafn: target.nafn,
          to_id: to ? to.id : null, to_nafn: to ? to.nafn : null,
          set_base_id: (d.customer_base_id == null && target.customer_base_id != null) ? target.customer_base_id : null,
        });
      }
    }

    // -- reconnect: no location yet, but a kt in text --
    if (d.fyrirtaeki_id == null && kt) {
      const cands = liveByKt[kt] || [];
      if (cands.length === 1) {
        const f = cands[0];
        B.reconnect.push({
          id: d.id, doc_type: d.doc_type, year: d.year, name, kt: ktDashed(kt),
          fyrirtaeki_id: f.id, fyrirtaeki_nafn: f.nafn, fyrirtaeki_heimilisfang: f.heimilisfang || '',
          set_base_id: (d.customer_base_id == null && f.customer_base_id != null) ? f.customer_base_id : null,
        });
      } else if (cands.length > 1) {
        B.reconnect_many.push({ id: d.id, kt: ktDashed(kt), sites: cands.length });
      }
    }

    // -- base linkage --
    if (d.customer_base_id == null && kt) {
      const base = baseByKt[kt];
      if (base) {
        B.base_link.push({ id: d.id, doc_type: d.doc_type, year: d.year, name, kt: ktDashed(kt), set_base_id: base.id, base_nafn: base.nafn });
      } else {
        B.base_missing.push({ id: d.id, doc_type: d.doc_type, year: d.year, name, kt: ktDashed(kt) });
      }
    }

    // -- impossible year --
    if (d.year != null && (d.year < 2005 || d.year > nextYear)) {
      B.bad_year.push({ id: d.id, doc_type: d.doc_type, year: d.year, name });
    }
  }

  const sum = {
    docs: docs.length,
    reconnect: B.reconnect.length,
    reconnect_many: B.reconnect_many.length,
    base_link: B.base_link.length,
    base_missing: B.base_missing.length,
    deleted_ptr: B.deleted_ptr.length,
    dangling: B.dangling.length,
    bad_year: B.bad_year.length,
  };
  return { buckets: B, sum };
}

// ── POST apply: recompute, then apply the chosen bucket for the chosen ids ─────
async function apply(body) {
  const bucket = body.bucket;
  const ids = new Set((body.ids || []).map(x => parseInt(x, 10)).filter(Boolean));
  if (!bucket || !ids.size) throw new Error('vantar bucket / ids');

  const { buckets } = await computeBuckets();
  const list = (buckets[bucket] || []).filter(p => ids.has(p.id));
  if (!list.length) return { ok: true, applied: 0, note: 'ekkert eftir að gera (þegar unnið?)' };

  // create bases up-front for base_missing so we can link
  const baseMade = {};
  if (bucket === 'base_missing') {
    for (const p of list) {
      const found = await sbGet(`customers_base?kennitala=eq.${p.kt}&select=id`);
      if (found[0]) { baseMade[p.id] = found[0].id; continue; }
      const rows = await sbWrite('POST', 'customers_base', [{ kennitala: p.kt, nafn: (p.name || '').trim() || ('kt ' + p.kt) }]);
      baseMade[p.id] = (Array.isArray(rows) ? rows[0] : rows).id;
    }
  }

  let applied = 0;
  for (const p of list) {
    const patch = {};
    if (bucket === 'reconnect') {
      patch.fyrirtaeki_id = p.fyrirtaeki_id;
      if (p.set_base_id) patch.customer_base_id = p.set_base_id;
      patch.found_by = 'hreinsi-auto';
    } else if (bucket === 'base_link') {
      patch.customer_base_id = p.set_base_id;
    } else if (bucket === 'base_missing') {
      patch.customer_base_id = baseMade[p.id];
    } else if (bucket === 'deleted_ptr') {
      patch.fyrirtaeki_id = p.to_id;   // lone live sibling, or null → keep base link, drop the dead pointer
      if (p.set_base_id) patch.customer_base_id = p.set_base_id;
    } else if (bucket === 'dangling') {
      patch.fyrirtaeki_id = null;
    } else if (bucket === 'bad_year') {
      patch.year = null;
    } else {
      throw new Error('bucket „' + bucket + '" er ekki keyranlegt');
    }
    await sbWrite('PATCH', `customer_documents?id=eq.${p.id}`, patch, 'return=minimal');
    applied++;
  }
  return { ok: true, applied };
}
