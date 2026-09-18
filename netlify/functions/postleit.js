// postleit.js — leit í tölvupósti (email_digest, fyllt af luna-bridge úr Thunderbird).
//   GET /api/postleit?q=…&account=…&folder=inbox|sent|all&from=YYYY-MM-DD&to=YYYY-MM-DD
//                     &att=1&body=1&sender=…&limit=50&offset=0
//   → { rows:[{id,account,folder,sender_name,sender_email,to_addresses,subject,snippet,body_preview,
//              has_attachment,attachment_names,received_at,message_id}], count, more }
//
// 18.09.2026 (Agnar: „svipað sem leitar í tölvupóstum"). Systir við Drive-leit.
//   • q leitar í efnislínu, sendanda, viðtakanda, og útdrætti; body=1 bætir
//     við meginmálinu (body_preview). Mörg orð = ÖLL verða að finnast (AND), hvert í einhverjum reit.
//   • account tómt = ÖLL VINNUPÓSTHÓLF. Persónulega hólfið (aggisigurds@gmail.com) er ALDREI með
//     í þeirri sjálfgefnu leit — það þarf að velja sérstaklega (sbr. regluna um að persónulegi
//     pósturinn blandist ekki vinnugögnum).
//   • Aðeins lestur. Þjónustulykill; taflan hefur engar anon-reglur.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PERSONULEGT = 'aggisigurds@gmail.com';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'GET') return json(405, { error: 'GET only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const p = event.queryStringParameters || {};
  const q = String(p.q || '').trim();
  const account = String(p.account || '').trim();
  const folder = String(p.folder || 'all').toLowerCase();
  const sender = String(p.sender || '').trim();
  const limit = Math.max(1, Math.min(200, parseInt(p.limit, 10) || 50));
  const offset = Math.max(0, parseInt(p.offset, 10) || 0);
  const isoDay = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s : '');
  const from = isoDay(p.from), to = isoDay(p.to);
  const body = p.body === '1' || p.body === 'true';
  if (!q && !sender && !from && !to && !account) return json(400, { error: 'Sláðu inn leitarorð (eða veldu pósthólf / sendanda / tímabil).' });

  // PostgREST: gildi í or=(…) mega ekki bera , ( ) — hreinsum þau út (þau leita hvort sem er illa).
  const hreint = (s) => s.replace(/[,()"\\*%]/g, ' ').trim();
  const parts = [
    'select=id,message_id,account,folder,sender_name,sender_email,to_addresses,subject,snippet,body_preview,has_attachment,attachment_names,received_at',
    'order=received_at.desc.nullslast', `limit=${limit + 1}`, `offset=${offset}`,
  ];
  if (account) parts.push(`account=ilike.${encodeURIComponent(hreint(account))}`);
  else parts.push(`account=not.ilike.${encodeURIComponent(PERSONULEGT)}`);
  if (folder === 'sent') parts.push('folder=eq.SENT'); else if (folder === 'inbox') parts.push('folder=neq.SENT');
  if (from) parts.push(`received_at=gte.${from}T00:00:00Z`);
  if (to) parts.push(`received_at=lte.${to}T23:59:59Z`);
  if (p.att === '1' || p.att === 'true') parts.push('has_attachment=eq.true');
  if (sender) { const e = encodeURIComponent(`*${hreint(sender)}*`); parts.push(`or=(sender_name.ilike.${e},sender_email.ilike.${e})`); }
  const words = hreint(q).split(/\s+/).filter(Boolean).slice(0, 6);
  const cols = ['subject', 'snippet', 'sender_name', 'sender_email', 'to_addresses'].concat(body ? ['body_preview'] : []);
  // hvert orð: or=(…) yfir reitina; mörg orð → and=(or(…),or(…))
  const orFor = (w) => `or(${cols.map((c) => `${c}.ilike.*${w}*`).join(',')})`;
  if (words.length === 1) parts.push('or=' + encodeURIComponent(`(${cols.map((c) => `${c}.ilike.*${words[0]}*`).join(',')})`));
  else if (words.length > 1) parts.push('and=' + encodeURIComponent(`(${words.map(orFor).join(',')})`));

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/email_digest?${parts.join('&')}`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    if (!r.ok) return json(r.status, { error: `Supabase ${r.status}: ${(await r.text()).slice(0, 300)}` });
    const rows = await r.json();
    const more = rows.length > limit;
    return json(200, { q, account: account || null, folder, from: from || null, to: to || null, body, offset, more,
      count: Math.min(rows.length, limit),
      rows: rows.slice(0, limit).map((x) => ({ ...x, body_preview: String(x.body_preview || '').slice(0, 1500) })) });
  } catch (e) { return json(502, { error: e.message }); }
};

function cors() { return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' }; }
function json(s, b) { return resp(s, JSON.stringify(b), { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
