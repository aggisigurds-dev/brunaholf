// payday-invoice-pdf.js — PDF reiknings beint úr Payday (16.10.2026).
//
//   GET /api/payday-invoice-pdf?tilvisun=355      → application/pdf (inline)
//   GET /api/payday-invoice-pdf?uuid=<payday-id>  → sama, án uppflettingar
//
// Agnar 16.10.2026: „geturðu opnað á það að ég geti opnað reikningana úr hreyfingarlistanum".
// Payday-PDF-ið er ekki speglað í okkar kerfi (sjá Fyrri reikningar í Efnislista) — þetta fall
// sækir það á staðnum: Payday API `GET /invoices/{id}/pdf` (apidoc.payday.is → Sales → Invoices → PDF).
//
// Uppfletting: invoices.payday_uuid (fyllt af payday-pull frá 16.10). Vanti GUID-ið (eldri innsog)
// er leitað í Payday „Fetch all" á gjalddagabilinu ±3 dagar eftir númeri og GUID-ið vistað í röðina.
//
// Tókinn: sami og payday-pull (app_kv 'payday_oauth'). Vörður: P.requireStaff (fail-open þar til
// HUB_STAFF_PASSWORD er sett — sama og önnur hub-föll).

const P = require('./_portal.js');
const pull = require('./payday-pull.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
const cors = () => ({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' });
const json = (s, p) => ({ statusCode: s, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors() }, body: JSON.stringify(p) });
const isoDay = (d) => d.toISOString().slice(0, 10);
const isGuid = (s) => /^[0-9a-f-]{32,36}$/i.test(String(s || ''));

async function finnaUuid(tilvisun) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/invoices?select=payday_uuid,gjalddagi,tilvisun&source=eq.payday&tilvisun=eq.${encodeURIComponent(tilvisun)}&limit=1`, { headers: sbHeaders });
  const rows = r.ok ? await r.json() : [];
  const row = rows[0] || null;
  if (row && isGuid(row.payday_uuid)) return { uuid: row.payday_uuid, via: 'spegill' };

  // Varaleið: spyrja Payday beint á gjalddagabilinu (eða síðustu 100 ef enginn gjalddagi).
  const token = await pull.getAccessToken();
  const params = new URLSearchParams({ perpage: '100', page: '1' });
  if (row && row.gjalddagi) {
    const d = new Date(row.gjalddagi);
    const from = new Date(d); from.setDate(from.getDate() - 3);
    const to = new Date(d); to.setDate(to.getDate() + 3);
    params.set('dueDateFrom', isoDay(from)); params.set('dueDateTo', isoDay(to));
  }
  const lr = await fetch(`${pull.API_BASE}/invoices?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'Api-Version': pull.API_VERSION, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!lr.ok) throw new Error(`Payday listi ${lr.status}: ${(await lr.text()).slice(0, 200)}`);
  const lj = await lr.json();
  const list = Array.isArray(lj) ? lj : (lj.invoices || lj.items || lj.data || []);
  const hit = list.find(x => String(x && x.number) === String(tilvisun));
  if (!hit || !isGuid(hit.id)) return { uuid: null, via: 'ekkert', leitad: list.length };
  // Vista GUID-ið svo næsta opnun sleppi við Payday-leitina.
  if (row) {
    await fetch(`${SUPABASE_URL}/rest/v1/invoices?source=eq.payday&tilvisun=eq.${encodeURIComponent(tilvisun)}`, {
      method: 'PATCH', headers: { ...sbHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ payday_uuid: hit.id }),
    }).catch(() => {});
  }
  return { uuid: hit.id, via: 'payday-leit' };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  const g = P.requireStaff(event); if (g) return g;
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'SUPABASE env vantar' });

  const q = event.queryStringParameters || {};
  const tilvisun = String(q.tilvisun || '').trim().replace(/^R-?/i, '');
  let uuid = String(q.uuid || '').trim();
  if (!uuid && !tilvisun) return json(400, { error: 'tilvisun eða uuid vantar' });
  if (uuid && !isGuid(uuid)) return json(400, { error: 'uuid er ekki GUID' });

  try {
    let via = 'uuid';
    if (!uuid) { const f = await finnaUuid(tilvisun); uuid = f.uuid; via = f.via;
      if (!uuid) return json(404, { error: `Reikningur ${tilvisun} fannst hvorki í Payday-speglinum né í Payday — keyrðu /api/payday-pull og reyndu aftur`, via }); }

    const token = await pull.getAccessToken();
    const pr = await fetch(`${pull.API_BASE}/invoices/${encodeURIComponent(uuid)}/pdf`, {
      headers: { Authorization: `Bearer ${token}`, 'Api-Version': pull.API_VERSION, Accept: 'application/pdf, application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (!pr.ok) return json(502, { error: `Payday PDF ${pr.status}`, detail: (await pr.text()).slice(0, 300), uuid, via });

    const ct = pr.headers.get('content-type') || '';
    let buf;
    if (/json/i.test(ct)) {
      // Varúð: skjölin sýna ekkert svarsnið — ef Payday pakkar PDF-inu í JSON (base64) er það tekið hér.
      const j = await pr.json();
      const b64 = typeof j === 'string' ? j : (j.pdf || j.data || j.content || j.file || j.base64 || null);
      if (!b64) return json(502, { error: 'Payday skilaði JSON án PDF', keys: Object.keys(j || {}), uuid });
      buf = Buffer.from(String(b64).replace(/^data:[^,]*,/, ''), 'base64');
    } else {
      buf = Buffer.from(await pr.arrayBuffer());
    }
    if (buf.subarray(0, 4).toString('latin1') !== '%PDF') {
      return json(502, { error: 'Svar Payday er ekki PDF', content_type: ct, bytes: buf.length, head: buf.subarray(0, 80).toString('utf8'), uuid });
    }
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="reikningur-${tilvisun || uuid}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
        ...cors(),
      },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  }
};
