// gmail-ingest.js — pull Gmail straight from Google (cloud) into email_digest.
//
//   GET /api/gmail-ingest?account=<email>&days=N&dry=1[&folder=sent]
//
// The cloud twin of luna-bridge/bridge.js: instead of reading Thunderbird mbox
// files on the Windows desktop, it asks the Gmail API for recent INBOX messages
// and upserts the SAME email_digest record shape (same columns, same dedupe key
// `message_id`, same is_question heuristic). This lets the hub stop depending on
// the desktop bridge for Google mailboxes — eldklar@eldklar.is first.
//
// Parameters:
//   account  the connected Google mailbox to pull (e.g. eldklar@eldklar.is).
//            Optional — defaults to whatever account is connected. If given it
//            MUST match the connected account (see the single-account note below).
//   days     look-back window for `newer_than:Nd` (default 10, max 400).
//   folder   'sent' pulls the SENT mailbox instead of the inbox: the Gmail
//            query becomes `in:sent newer_than:Nd` and rows are written with
//            folder='SENT', is_question=false (our own replies are never
//            inbound questions). Default (param omitted) = inbox, unchanged.
//   dry=1    preview only — returns counts + a few sample subjects, writes NOTHING.
//
// ── Single-account note ──────────────────────────────────────────────────────
// The shared OAuth helper (_google.js) stores exactly ONE token row (id=1) and
// `freshAccessToken()` always returns that account's token. So this endpoint can
// only pull the account that is currently connected via /api/google-auth. To pull
// eldklar@eldklar.is from the cloud, connect Google AS eldklar@eldklar.is. The
// `account` guard below makes a mismatch loud rather than silently pulling the
// wrong mailbox. Multi-account (a token row per email) is a separate, larger task.

const { freshAccessToken, loadTokens, freshAccessTokenFor, loadTokensFor, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH = 200;

// ── Question/skip heuristics — ported verbatim from luna-bridge/bridge.js ─────
const NOREPLY_PATTERN = /(no[-_.]?reply|donotreply|do[-_.]not[-_.]reply|notifications?@|mailer[-_.]daemon|postmaster|automated|account[-_.]?security)/i;
const QUESTION_WORDS = /\b(question|inquiry|ask|help|how can|could you|would you|spurning|fyrirspurn|spurnt|spurð|spyrja|hjálp|hvernig|hvort|hvenær|hvar|hvers vegna)\b/i;
const SKIP_SUBJECT = /(unsubscribe|subscription|newsletter|password reset|verify your|two-step|two factor|2fa code|verification code|kvittun|reikning frá|invoice from|order confirmation|shipping)/i;

// Same shape/logic as bridge.js looksLikeQuestion, but fed the fields we get
// from the Gmail API (subject, snippet/body text, from address) instead of a
// mailparser object.
function looksLikeQuestion({ subject, bodyText, fromAddr }) {
  const subj = (subject || '').trim();
  const subjLower = subj.toLowerCase();
  const body = (bodyText || '').slice(0, 1500);
  if (NOREPLY_PATTERN.test(fromAddr || '')) return false;
  if (SKIP_SUBJECT.test(subjLower)) return false;
  if (subj.includes('?')) return true;
  if (QUESTION_WORDS.test(subjLower)) return true;
  if (body.includes('?') && body.length > 30) return true;
  return false;
}

function snippetOf(text) {
  if (!text) return '';
  return text
    .replace(/^\s*>.*$/gm, '')           // drop quoted lines
    .replace(/\r?\n[ \t]*\r?\n/g, '\n')  // collapse blank paragraphs
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

// "Name <addr@x>" → { name, address }
function parseAddress(raw) {
  const s = (raw || '').trim();
  if (!s) return { name: null, address: null };
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) {
    const name = m[1].trim();
    return { name: name || null, address: (m[2] || '').trim().toLowerCase() || null };
  }
  if (s.includes('@')) return { name: null, address: s.toLowerCase() };
  return { name: s, address: null };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};
  const dry = p.dry === '1' || p.dry === 'true';
  // 2026-07-17: hámark hækkað 90 → 400 svo Stólpa-tímabilið (feb–mars 2026)
  // náist í sögulegri sókn; venjuleg keyrsla notar áfram fáa daga.
  const days = Math.min(Math.max(parseInt(p.days || '10', 10) || 10, 1), 400);
  const wantAccount = (p.account || '').trim();
  // folder=sent → pull the SENT mailbox (rows get folder='SENT', is_question=false).
  const sentFolder = (p.folder || '').trim().toLowerCase() === 'sent';

  // ── Get a token for the requested Google account ───────────────────────────
  // 2026-07-17 fjölreikningar: sé `account` gefið er FYRST leitað að eigin
  // token-röð fyrir það netfang (google_oauth keyed á user_email) — svo hvaða
  // tengt pósthólf sem er er sótt beint. Fallback: aðal-reikningurinn (id=1)
  // með gamla 409-verðinum ef netfangið passar ekki.
  let token, connected;
  if (wantAccount) {
    const own = await loadTokensFor(wantAccount).catch(() => null);
    if (own && own.refresh_token) {
      try {
        token = await freshAccessTokenFor(wantAccount);
        connected = own.user_email;
      } catch (e) {
        return json(401, { error: e.message });
      }
    }
  }
  if (!token) {
    try {
      token = await freshAccessToken();
      const t = await loadTokens();
      connected = (t && t.user_email) || null;
    } catch (e) {
      return json(401, { error: e.message });
    }
    // Single-account guard for the primary row: a mismatch is loud, with the
    // multi-account fix in the message.
    if (wantAccount && connected &&
        wantAccount.toLowerCase() !== connected.toLowerCase()) {
      return json(409, {
        error: `Tengt pósthólf er ${connected}, ekki ${wantAccount}. ` +
          `Tengdu ${wantAccount} sem AUKAREIKNING: opnaðu /api/google-auth?account=${encodeURIComponent(wantAccount)} ` +
          `og skráðu þig inn sem það netfang — aðal-tengingin (Drive) helst óbreytt.`,
        connected, requested: wantAccount,
      });
    }
  }
  // The mailbox label we tag rows with: prefer the connected identity, fall back
  // to the requested account string (so the row is attributable even if the
  // userinfo email wasn't stored).
  const account = connected || wantAccount || 'me';

  try {
    // 1) list recent message ids (inbox by default, sent mail with folder=sent)
    const q = `in:${sentFolder ? 'sent' : 'inbox'} newer_than:${days}d`;
    const ids = [];
    let pageToken = '';
    let guard = 0;
    do {
      const params = new URLSearchParams({ q, maxResults: '100' });
      if (pageToken) params.set('pageToken', pageToken);
      const lr = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?' + params,
        { headers: { Authorization: `Bearer ${token}` } });
      if (!lr.ok) return json(lr.status, { error: `Gmail list ${lr.status}: ${(await lr.text()).slice(0, 300)}` });
      const list = await lr.json();
      (list.messages || []).forEach(m => ids.push(m.id));
      pageToken = list.nextPageToken || '';
    } while (pageToken && ++guard < 30);

    // 2) fetch each message (metadata headers + internalDate + snippet)
    const records = [];
    let errors = 0;
    // modest concurrency so we stay inside the function time budget
    const CONC = 8;
    for (let i = 0; i < ids.length; i += CONC) {
      const chunk = ids.slice(i, i + CONC);
      const got = await Promise.all(chunk.map(async (id) => {
        try {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
            `?format=metadata&metadataHeaders=Subject&metadataHeaders=From` +
            `&metadataHeaders=To&metadataHeaders=Date&metadataHeaders=Message-Id`,
            { headers: { Authorization: `Bearer ${token}` } });
          if (!r.ok) return null;
          const m = await r.json();
          const hh = {};
          (m.payload?.headers || []).forEach(h => { hh[h.name.toLowerCase()] = h.value; });

          const from = parseAddress(hh.from || '');
          // Gmail already HTML-unescapes the snippet; it's the best body text we
          // have without pulling the full body.
          const snippetText = decodeEntities(m.snippet || '');

          // received_at: prefer internalDate (epoch ms), fall back to Date header.
          let receivedAt = null;
          if (m.internalDate) {
            const ms = parseInt(m.internalDate, 10);
            if (Number.isFinite(ms)) receivedAt = new Date(ms).toISOString();
          }
          if (!receivedAt && hh.date) {
            const d = new Date(hh.date);
            if (!isNaN(d.getTime())) receivedAt = d.toISOString();
          }

          // has_attachment: detect parts with a filename (metadata format still
          // returns the payload part tree).
          const attachment_names = collectAttachmentNames(m.payload);

          return {
            // dedupe key — RFC822 Message-Id header, fall back to the gmail id.
            message_id: (hh['message-id'] || '').trim() || `gmail:${account}/${id}`,
            account,
            folder: sentFolder ? 'SENT' : 'INBOX',
            sender_name: from.name,
            sender_email: from.address,
            to_addresses: hh.to || null,
            subject: hh.subject || '',
            snippet: snippetOf(snippetText),
            body_preview: snippetText.slice(0, 4000),
            is_question: sentFolder ? false : looksLikeQuestion({
              subject: hh.subject, bodyText: snippetText, fromAddr: from.address,
            }),
            has_attachment: attachment_names.length > 0,
            attachment_names,
            received_at: receivedAt,
            source_path: 'gmail-api',
            source_offset: null,
          };
        } catch (_) { return null; }
      }));
      got.forEach(rec => { if (rec) records.push(rec); else errors++; });
    }

    // 3) dry-run → preview, no writes
    if (dry) {
      return json(200, {
        ok: true, dry: true, account, days, folder: sentFolder ? 'SENT' : 'INBOX',
        listed: ids.length, mapped: records.length, errors,
        questions: records.filter(r => r.is_question).length,
        with_attachment: records.filter(r => r.has_attachment).length,
        samples: records.slice(0, 8).map(r => ({
          subject: r.subject || '(án efnis)',
          from: r.sender_name || r.sender_email || '',
          received_at: r.received_at,
          is_question: r.is_question,
        })),
        note: 'Prufa — ekkert vistað í email_digest.',
      });
    }

    // 4) upsert in batches — exactly like bridge.js upsert() (on_conflict=message_id)
    let upserted = 0;
    for (let i = 0; i < records.length; i += BATCH) {
      const slice = records.slice(i, i + BATCH);
      const u = await fetch(`${SUPABASE_URL}/rest/v1/email_digest?on_conflict=message_id`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(slice),
      });
      if (!u.ok) throw new Error(`Upsert ${u.status}: ${(await u.text()).slice(0, 300)}`);
      upserted += slice.length;
    }

    return json(200, {
      ok: true, account, days, folder: sentFolder ? 'SENT' : 'INBOX',
      listed: ids.length, mapped: records.length, upserted, errors,
      questions: records.filter(r => r.is_question).length,
    });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};

// Walk the Gmail payload part tree for parts that carry a filename.
function collectAttachmentNames(payload) {
  const names = [];
  const walk = (part) => {
    if (!part) return;
    if (part.filename && part.filename.trim()) names.push(part.filename.trim());
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return names;
}

// Gmail snippets come HTML-entity-encoded (&amp; &#39; …). Decode the few that matter.
function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    });
}
