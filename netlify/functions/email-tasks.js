// email-tasks.js — questions/tasks oversight from email_digest + email_actions overlay.
//
// GET  /api/email-tasks?status=new|in_progress|answered|dismissed|snoozed|all
//                       &account=...&q=...&limit=200
// POST /api/email-tasks  body { email_id, status?, priority?, notes?, due_date?, linked_worksite?, assigned_to?, snoozed_until? }

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  if (event.httpMethod === 'POST') return updateAction(event);
  if (event.httpMethod !== 'GET')  return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};
  const status = (p.status || 'open').toLowerCase();
  const account = (p.account || '').trim();
  const q = (p.q || '').trim();
  const limit = Math.min(parseInt(p.limit || '200', 10) || 200, 500);

  try {
    // Pull all questions in the digest + their action overlays
    const parts = [
      'select=id,account,sender_name,sender_email,subject,snippet,is_question,has_attachment,attachment_names,received_at',
      'is_question=eq.true',
      'folder=neq.SENT', // belt & braces — SENT rows are always is_question=false anyway
      `limit=${limit}`,
      'order=received_at.desc.nullslast',
    ];
    if (account) parts.push(`account=eq.${encodeURIComponent(account)}`);
    if (q) {
      const enc = encodeURIComponent(`%${q}%`);
      parts.push(`or=(subject.ilike.${enc},snippet.ilike.${enc},sender_name.ilike.${enc},sender_email.ilike.${enc})`);
    }
    const [emails, actions] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/email_digest?${parts.join('&')}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/email_actions?select=*&limit=2000`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }).then(r => r.json()),
    ]);

    const actionsByEmail = {};
    for (const a of actions) actionsByEmail[a.email_id] = a;

    const rows = emails.map(e => {
      const a = actionsByEmail[e.id] || { status: 'new', priority: 'normal' };
      return {
        ...e,
        status: a.status || 'new',
        priority: a.priority || 'normal',
        notes: a.notes || null,
        due_date: a.due_date || null,
        snoozed_until: a.snoozed_until || null,
        linked_worksite: a.linked_worksite || null,
        assigned_to: a.assigned_to || null,
      };
    });

    // Filter by status if requested
    let filtered = rows;
    if (status === 'open') filtered = rows.filter(r => r.status === 'new' || r.status === 'in_progress');
    else if (status !== 'all') filtered = rows.filter(r => r.status === status);

    // Sort: high-priority first, then by received_at desc
    const priWeight = { high: 0, normal: 1, low: 2 };
    filtered.sort((a, b) => {
      const dp = (priWeight[a.priority] ?? 1) - (priWeight[b.priority] ?? 1);
      if (dp !== 0) return dp;
      return (b.received_at || '').localeCompare(a.received_at || '');
    });

    const counts = {
      total:        rows.length,
      new:          rows.filter(r => r.status === 'new').length,
      in_progress:  rows.filter(r => r.status === 'in_progress').length,
      answered:     rows.filter(r => r.status === 'answered').length,
      dismissed:    rows.filter(r => r.status === 'dismissed').length,
      snoozed:      rows.filter(r => r.status === 'snoozed').length,
      high_priority: rows.filter(r => r.priority === 'high' && (r.status === 'new' || r.status === 'in_progress')).length,
    };

    return json(200, { count: filtered.length, total: rows.length, counts, rows: filtered });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

async function updateAction(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }
  if (!body.email_id) return json(400, { error: 'email_id is required' });

  const allowed = ['status','priority','notes','due_date','linked_worksite','assigned_to','snoozed_until'];
  const payload = { email_id: body.email_id, updated_at: new Date().toISOString() };
  for (const k of allowed) if (body[k] !== undefined) payload[k] = body[k];

  const r = await fetch(`${SUPABASE_URL}/rest/v1/email_actions?on_conflict=email_id`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) return json(r.status, { error: (await r.text()).slice(0, 300) });
  return json(200, { ok: true, row: (await r.json())[0] });
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
