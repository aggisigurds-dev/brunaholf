// inbox.js — Brunahólf private inbox digest endpoint.
// Reads the email_digest table (populated by the local luna-bridge) and returns
// a filtered/searchable feed for the #inbox view and the Luna chat widget.
//
// Auth model: this endpoint reads with the Supabase service_role key (which
// bypasses RLS). The table has no anon policies, so even if someone hit
// Supabase directly with the public anon key they would get nothing.
//
// Required Netlify env vars:
//   SUPABASE_URL                  — https://osfdzskyvisifcwyjkuk.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY     — service role JWT (server-side only)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return resp(204, '', corsHeaders());
  }
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return json(500, { error: 'Inbox is not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' });
  }

  const params = event.queryStringParameters || {};
  const limit  = clamp(parseInt(params.limit || '50', 10), 1, 200);
  const filter = (params.filter || 'all').toLowerCase(); // all | questions
  const q      = (params.q || '').trim();
  const account = (params.account || '').trim();

  // Build the PostgREST query.
  const queryParts = [
    'select=id,account,folder,sender_name,sender_email,subject,snippet,is_question,has_attachment,attachment_names,received_at,fetched_at',
    'folder=neq.SENT', // sent-mail rows (SENT ingest) must not appear in the inbox feed
    `limit=${limit}`,
    'order=received_at.desc.nullslast',
  ];
  if (filter === 'questions') queryParts.push('is_question=eq.true');
  if (account) queryParts.push(`account=eq.${encodeURIComponent(account)}`);
  if (q) {
    // PostgREST `or` with `ilike` across subject + snippet + sender.
    const enc = encodeURIComponent(`%${q}%`);
    queryParts.push(`or=(subject.ilike.${enc},snippet.ilike.${enc},sender_name.ilike.${enc},sender_email.ilike.${enc})`);
  }

  const url = `${SUPABASE_URL}/rest/v1/email_digest?${queryParts.join('&')}`;
  try {
    const r = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!r.ok) {
      const txt = await r.text();
      return json(r.status, { error: `Supabase ${r.status}: ${txt.slice(0, 300)}` });
    }
    const rows = await r.json();
    return json(200, { rows, count: rows.length, limit, filter, q, account });
  } catch (err) {
    return json(500, { error: `Server error: ${err.message || String(err)}` });
  }
};

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), {
    'content-type': 'application/json',
    ...corsHeaders(),
  });
}
function resp(statusCode, body, headers) {
  return { statusCode, headers, body };
}
function clamp(n, lo, hi) {
  if (isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
