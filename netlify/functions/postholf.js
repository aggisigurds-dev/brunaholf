// postholf.js — read endpoint for the dedicated "Pósthólf" page (flokkar + stjörnu).
//
// GET /api/postholf?account=&label=&starred=1&status=&q=&limit=200
//   Returns email_digest rows that are STARRED or carry at least one Gmail label
//   (flokkur), merged with the email_actions overlay (status/priority/linked_worksite).
//   Also returns label_counts + starred_count so the page can render filter chips
//   without pulling everything twice.
//
// Kept separate from inbox.js on purpose: this feed is label/starred-driven, not
// the raw inbox, so the verkbord button opens a focused view that will not flood.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};
  const account = (p.account || '').trim();
  const label = (p.label || '').trim();
  const onlyStarred = p.starred === '1' || p.starred === 'true';
  const status = (p.status || '').trim().toLowerCase();
  const q = (p.q || '').trim();
  const limit = Math.min(parseInt(p.limit || '250', 10) || 250, 500);

  // Base: labelled OR starred, never SENT.
  const parts = [
    'select=id,account,folder,sender_name,sender_email,subject,snippet,is_question,has_attachment,attachment_names,received_at,gmail_labels,starred',
    'folder=neq.SENT',
    'or=(starred.eq.true,gmail_labels.neq.[])',
    `limit=${limit}`,
    'order=received_at.desc.nullslast',
  ];
  if (account) parts.push(`account=eq.${encodeURIComponent(account)}`);
  if (onlyStarred) parts.push('starred=eq.true');
  if (label) parts.push(`gmail_labels=cs.${encodeURIComponent(JSON.stringify([label]))}`);
  if (q) {
    const enc = encodeURIComponent(`%${q}%`);
    parts.push(`or=(subject.ilike.${enc},snippet.ilike.${enc},sender_name.ilike.${enc},sender_email.ilike.${enc})`);
  }

  try {
    const [emails, actions] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/email_digest?${parts.join('&')}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/email_actions?select=*&limit=3000`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }).then(r => r.json()),
    ]);

    const byEmail = {};
    for (const a of (Array.isArray(actions) ? actions : [])) byEmail[a.email_id] = a;

    let rows = (Array.isArray(emails) ? emails : []).map(e => {
      const a = byEmail[e.id] || {};
      return {
        ...e,
        gmail_labels: e.gmail_labels || [],
        status: a.status || 'new',
        priority: a.priority || 'normal',
        notes: a.notes || null,
        linked_worksite: a.linked_worksite || null,
        due_date: a.due_date || null,
      };
    });

    if (status && status !== 'all') {
      if (status === 'open') rows = rows.filter(r => r.status === 'new' || r.status === 'in_progress');
      else rows = rows.filter(r => r.status === status);
    }

    // Label + starred counts across the (unfiltered-by-label) feed for chips.
    const label_counts = {};
    let starred_count = 0;
    for (const r of rows) {
      if (r.starred) starred_count++;
      for (const l of (r.gmail_labels || [])) label_counts[l] = (label_counts[l] || 0) + 1;
    }

    return json(200, { count: rows.length, starred_count, label_counts, rows });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) { return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() }); }
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
