// email-ingest-browser.js — receive email metadata from the brunaholf-mail-pulse
// Chrome extension and upsert into `email_digest`.
//
// Browser-bridge alternative to luna-bridge/bridge.js: the extension scrapes
// the visible inbox (Gmail webmail + Outlook OWA) on the user's machine, then
// POSTs batches here. Same `on_conflict=message_id` upsert key as bridge.js
// and gmail-ingest.js — the three paths are interchangeable; whoever sees an
// email first wins, the others are no-op.
//
//   POST /api/email-ingest-browser
//     Header: X-Brunaholf-Token: <EXTENSION_INGEST_TOKEN>   (shared secret)
//     Body:   {
//       account: "eldklar@eldklar.is",
//       folder:  "INBOX",
//       emails:  [
//         { message_id, sender_name, sender_email, subject, snippet,
//           received_at, has_attachment? },
//         ...
//       ]
//     }
//     → { ok, account, folder, received, upserted, classified_questions }
//
// Env vars (set in Netlify):
//   EXTENSION_INGEST_TOKEN  — shared secret the extension sends
//   SUPABASE_URL            — already set
//   SUPABASE_SERVICE_ROLE_KEY — already set
//
// message_id convention from the extension is `browser:<sha256(account|sender|
// subject|received_at)>[:32]` so it stays stable across reloads. Bridge / cloud
// paths use real RFC822 ids and the two don't collide.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = process.env.EXTENSION_INGEST_TOKEN;
const BATCH = 200;
const MAX_EMAILS_PER_REQUEST = 500;

// ── Question/skip heuristics — ported from gmail-ingest.js / bridge.js ─────
const NOREPLY = /(no[-_.]?reply|donotreply|do[-_.]not[-_.]reply|notifications?@|mailer[-_.]daemon|postmaster|automated|account[-_.]?security)/i;
const QWORDS = /\b(question|inquiry|ask|help|how can|could you|would you|spurning|fyrirspurn|spurnt|spurð|spyrja|hjálp|hvernig|hvort|hvenær|hvar|hvers vegna)\b/i;
const SKIP_SUBJ = /(unsubscribe|subscription|newsletter|password reset|verify your|two-step|two factor|2fa code|verification code|kvittun|reikning frá|invoice from|order confirmation|shipping)/i;

function looksLikeQuestion({ subject, snippet, fromAddr }) {
  const s = (subject || '').trim();
  const sLow = s.toLowerCase();
  const body = (snippet || '').slice(0, 1500);
  if (NOREPLY.test(fromAddr || '')) return false;
  if (SKIP_SUBJ.test(sLow)) return false;
  if (s.includes('?')) return true;
  if (QWORDS.test(sLow)) return true;
  if (body.includes('?') && body.length > 30) return true;
  return false;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vantar' });
  if (!TOKEN) return json(500, { error: 'EXTENSION_INGEST_TOKEN vantar í Netlify env' });

  const sent = (event.headers['x-brunaholf-token'] || event.headers['X-Brunaholf-Token'] || '').trim();
  if (!sent || sent !== TOKEN) {
    return json(401, { error: 'Ógilt eða vantandi X-Brunaholf-Token' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (_) { return json(400, { error: 'Invalid JSON' }); }

  const account = String(body.account || '').trim();
  const folder = String(body.folder || 'INBOX').trim() || 'INBOX';
  const emails = Array.isArray(body.emails) ? body.emails : [];

  if (!account) return json(400, { error: 'account vantar' });
  if (!emails.length) return json(200, { ok: true, account, folder, received: 0, upserted: 0 });
  if (emails.length > MAX_EMAILS_PER_REQUEST) {
    return json(413, { error: `max ${MAX_EMAILS_PER_REQUEST} emails per request, sent ${emails.length}` });
  }

  const now = new Date().toISOString();
  let classifiedQuestions = 0;
  const rows = emails.map(e => {
    const message_id = String(e.message_id || '').trim();
    if (!message_id) return null;

    const sender_email = (e.sender_email || '').toString().trim().toLowerCase() || null;
    const sender_name = (e.sender_name || '').toString().trim() || null;
    const subject = (e.subject || '').toString().trim() || null;
    const snippet = (e.snippet || '').toString().trim().slice(0, 500) || null;
    const received_at = isoTimestamp(e.received_at) || now;
    const has_attachment = !!e.has_attachment;

    const is_question = e.is_question != null
      ? !!e.is_question
      : looksLikeQuestion({ subject, snippet, fromAddr: sender_email });
    if (is_question) classifiedQuestions++;

    return {
      message_id, account, folder,
      sender_name, sender_email, subject, snippet,
      received_at, has_attachment, is_question,
      fetched_at: now,
      source_path: 'browser-extension',
    };
  }).filter(Boolean);

  if (!rows.length) return json(400, { error: 'Engar gildar raðir (vantar message_id)' });

  // Dedup within-batch: Postgres on_conflict can't handle two rows with the
  // same constraint key in one statement. The extension can emit dupes when
  // received_at parsing fails for multiple rows with the same sender+subject.
  const seenIds = new Map();
  for (const r of rows) if (!seenIds.has(r.message_id)) seenIds.set(r.message_id, r);
  const deduped = [...seenIds.values()];
  const within_batch_dupes = rows.length - deduped.length;

  let upserted = 0;
  for (let i = 0; i < deduped.length; i += BATCH) {
    const slice = deduped.slice(i, i + BATCH);
    const u = await fetch(`${SUPABASE_URL}/rest/v1/email_digest?on_conflict=message_id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(slice),
    });
    if (!u.ok) {
      const txt = (await u.text()).slice(0, 300);
      return json(500, { error: `Upsert ${u.status}: ${txt}`, upserted });
    }
    upserted += slice.length;
  }

  return json(200, {
    ok: true,
    account, folder, within_batch_dupes,
    received: emails.length, upserted,
    classified_questions: classifiedQuestions,
  });
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Brunaholf-Token',
  };
}
function json(code, body) {
  return { statusCode: code, headers: { 'Content-Type': 'application/json', ...cors() }, body: JSON.stringify(body) };
}
function isoTimestamp(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = new Date(v < 10_000_000_000 ? v * 1000 : v);
    return isNaN(d) ? null : d.toISOString();
  }
  const s = String(v).trim();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
