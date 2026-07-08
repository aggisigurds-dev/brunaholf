// solur.js — Slökkvitæki POS sales (read-only) from the shared Supabase, for the
// reikningur generator and the Reikningar í bið batch flow.
//   GET /api/solur            → recent finalised sales (for the single-sale loader)
//   GET /api/solur?unsent=1   → unsent reikningur sales (credit notes netted out)
//
// Each sale carries a resolved payer kennitala (`kt`) so the dkPlus invoice Head
// can supply a real Customer (fixes "Customer not supplied"). NOTE: solur.customer_id
// is ambiguous (same id → different companies in vidskiptavinir vs fyrirtaeki), so
// kt is resolved by matching the sale's customer_nafn against the masters, with the
// id used only to disambiguate. Sales that can't be resolved get kt=null +
// kt_ambiguous=true and must be fixed before invoicing (the §3 customer-base cleanup
// makes this exact, this is the pragmatic interim).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const norm = (s) => (s || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const q = event.queryStringParameters || {};
  const limit = Math.min(500, Math.max(1, parseInt(q.limit, 10) || 200));
  let filter = '&status=eq.final';
  if (q.unsent) filter += '&greitt_med=eq.reikningur&invoiced_at=is.null';

  try {
    const [rows, credits, vrows, frows] = await Promise.all([
      sb(`solur?select=id,num,customer_nafn,customer_id,upphaed_an_vsk,vsk_upphaed,samtals,afslattur,` +
        `greitt_med,athugasemdir,created_at,is_credit,credit_of,linur${filter}` +
        `&order=created_at.desc&limit=${limit}`),
      sb('solur?select=credit_of&is_credit=is.true'),
      sb('vidskiptavinir?select=id,kennitala,nafn'),
      sb('fyrirtaeki?select=id,kennitala,nafn'),
    ]);

    // Credit-note netting: drop the credit notes themselves and any fully-reversed
    // original (an original whose id is referenced by a credit note's credit_of).
    const reversed = new Set(credits.map((c) => c.credit_of).filter((x) => x != null));

    // Master lookups for kennitala resolution.
    const vById = new Map(vrows.map((r) => [r.id, r]));
    const fById = new Map(frows.map((r) => [r.id, r]));
    const nameMap = new Map(); // norm(nafn) → Set(kt)
    for (const r of [...vrows, ...frows]) {
      const k = norm(r.nafn);
      if (!k || !r.kennitala) continue;
      if (!nameMap.has(k)) nameMap.set(k, new Set());
      nameMap.get(k).add(r.kennitala);
    }
    function resolveKt(customerId, customerNafn) {
      const n = norm(customerNafn);
      const v = customerId != null ? vById.get(customerId) : null;
      const f = customerId != null ? fById.get(customerId) : null;
      if (v && norm(v.nafn) === n) return { kt: v.kennitala, src: 'id' };
      if (f && norm(f.nafn) === n) return { kt: f.kennitala, src: 'id' };
      if (v && !f) return { kt: v.kennitala, src: 'id' };
      if (f && !v) return { kt: f.kennitala, src: 'id' };
      const cands = nameMap.get(n);
      if (cands && cands.size === 1) return { kt: [...cands][0], src: 'name' };
      if (cands && cands.size > 1) return { kt: null, src: 'ambiguous' };
      return { kt: null, src: 'none' };
    }

    const sales = rows
      .filter((s) => !s.is_credit && !reversed.has(s.id))
      .map((s) => {
        const r = resolveKt(s.customer_id, s.customer_nafn);
        return {
          id: s.id,
          num: s.num || '',
          customer: s.customer_nafn || '',
          customer_id: s.customer_id || null,
          kt: r.kt,                 // resolved payer kennitala (xxxxxx-xxxx) or null
          kt_ambiguous: !r.kt,      // true → needs a manual customer fix before invoicing
          ex_vsk: Number(s.upphaed_an_vsk) || 0,
          vsk: Number(s.vsk_upphaed) || 0,
          total: Number(s.samtals) || 0,
          // 2026-07-08 (afsláttar-úttekt): the sale-level discount (kr m.vsk)
          // + per-line discount_pct/vsk_pct were dropped here — every
          // discounted POS sale became a FULL-price dk draft.
          afslattur: Number(s.afslattur) || 0,
          paid_with: s.greitt_med || '',
          date: (s.created_at || '').slice(0, 10),
          lines: Array.isArray(s.linur) ? s.linur.map((l) => ({
            id: l.product_id != null ? l.product_id : '',
            desc: l.desc || '',
            qty: Number(l.qty) || 0,
            price: Number(l.unit_price_ex_vat) || 0,
            vsk_pct: l.vsk_pct == null ? 24 : Number(l.vsk_pct) || 0,
            discount_pct: Math.max(0, Math.min(100, Number(l.discount_pct) || 0)),
          })) : [],
        };
      });

    return json(200, { count: sales.length, sales });
  } catch (e) {
    return json(502, { error: e.message });
  }
};

async function sb(path) {
  const out = [];
  let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return out;
}

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
