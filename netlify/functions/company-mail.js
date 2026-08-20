// company-mail.js — latest email communication per service company + "unreplied" flag.
//
//   GET /api/company-mail[?days=365]
//     → { byId: { <fyrirtaeki_id>: {from, subject, snippet, received_at,
//                                   is_question, unreplied, important,
//                                   signals[], history} },
//         generated_at, scanned:{emails, companies, matched, exact, history, green} }
//
// Purpose: on the Slökkvitæki "Fyrirtæki í þjónustu" list we only visit a
// customer once a year, so an email from months ago is easily forgotten. This
// surfaces, per company, the newest INBOUND email and whether we have replied
// to it — the UI shows a red envelope when a company has an unanswered message.
//
// Three states drive the traffic-light on "Fyrirtæki í þjónustu":
//   🔴 unreplied — matched INBOUND email with no later SENT reply (strict, exact
//        address only — a wrong red envelope is worse than a missing one).
//   🟡 important — a "signal" (uppsögn/flutt/eigandi/gjaldþrot/…) seen anywhere
//        in the window; matched exact per-building OR broad per-base (a loose
//        "go check" flag, never drives red).
//   🟢 history  — we simply have correspondence with the customer in the window.
//        Two sources, unioned: (1) felag_samskipti via the tv_history_sites RPC
//        (the SAME matcher Þjónustuver póstar uses — resolves WHICH building each
//        mail belongs to, so a rekstrarfélag sibling is never lit); (2) a cheap
//        in-JS fallback marking single-site bases with any inbound/outbound mail,
//        so green still shows if the RPC ever fails. Never sets unreplied/important.
//
// Address maps (all ambiguity-guarded — an address shared by two customers is
// dropped, never guessed):
//   • fyrirtaeki.netfang   → that site        (exact → red/green + signals)
//   • customers_base email → single-site base (exact, since it is the sole site)
//   • any of the above     → base → its in-service sites (broad → yellow/green)
// No kt/domain guessing.
//
// "unreplied" = there is a matched inbound email AND no SENT email addressed to
// that company address with received_at >= the newest inbound's received_at.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const q = event.queryStringParameters || {};

    // ── Single-company FULL history mode (on-demand, from the badge popover) ──
    //   GET /api/company-mail?co=<fyrirtaeki_id>
    //     → { fyrirtaeki_id, base_id, mails:[{id,subject,snippet,sender_name,
    //         sender_email,is_question,fra_okkur,received_at,via}] }  (all-time, desc)
    if (q.co) {
      const coId = parseInt(q.co, 10);
      if (!Number.isFinite(coId)) return json(400, { error: 'bad co id' });
      const hist = await rpcCompanyHistory(coId);
      return json(200, hist || { fyrirtaeki_id: coId, mails: [] });
    }

    let days = parseInt(q.days, 10);
    if (!Number.isFinite(days) || days <= 0) days = 365;
    days = Math.min(days, 730);
    const sinceIso = new Date(Date.now() - days * 86400000).toISOString();

    // Fire the felag-derived history set (broad green — the SAME source Þjónustuver
    // póstar uses) in PARALLEL with our own reads. It is ~3.4s server-side, so total
    // time ≈ max(this, the email_digest scan), not the sum. Never throws into the
    // response: on any failure green just falls back to the exact/single-site matches.
    // Cap felag so a slow view can never push the whole function past Netlify's
    // ~10s limit — if it doesn't answer in time, green falls back to the in-JS
    // single-site matches below (function stays fast and always returns 200).
    const histPromise = Promise.race([
      rpcHistorySites(days),
      new Promise((res) => setTimeout(() => res(null), 6000)),
    ]).catch(() => null);

    // ---- service companies (live sites in service) ----
    const sites = await fetchAll('fyrirtaeki',
      'select=id,nafn,kennitala,netfang,customer_base_id&er_i_thjonustu=eq.true&deleted_at=is.null');

    // ---- base-level emails (only usable when a base has ONE live service site) ----
    const baseIds = [...new Set(sites.map(s => s.customer_base_id).filter(Boolean))];
    let bases = [];
    if (baseIds.length) {
      // chunk the IN() so the URL never gets too long
      for (let i = 0; i < baseIds.length; i += 200) {
        const chunk = baseIds.slice(i, i + 200);
        const b = await fetchAll('customers_base',
          `select=id,netfang,contact_email&id=in.(${chunk.join(',')})`);
        bases.push(...b);
      }
    }
    const baseById = {};
    bases.forEach(b => { baseById[b.id] = b; });

    // count live service sites per base (to know which bases are single-site)
    const sitesPerBase = {};
    sites.forEach(s => { if (s.customer_base_id) sitesPerBase[s.customer_base_id] = (sitesPerBase[s.customer_base_id] || 0) + 1; });

    // ---- build email → fyrirtaeki_id map, keeping only UNAMBIGUOUS addresses ----
    const emailToId = {};     // email → id  (or the sentinel AMBIG)
    const AMBIG = Symbol('ambig');
    const claim = (email, id) => {
      const e = cleanEmail(email);
      if (!e || FREE_OK(e) === null) return; // invalid
      if (!(e in emailToId)) emailToId[e] = id;
      else if (emailToId[e] !== id) emailToId[e] = AMBIG; // two companies, same address → drop
    };
    sites.forEach(s => {
      claim(s.netfang, s.id);
    });
    // base emails only for single-live-site bases
    sites.forEach(s => {
      const bid = s.customer_base_id;
      if (!bid || (sitesPerBase[bid] || 0) !== 1) return;
      const b = baseById[bid];
      if (!b) return;
      claim(b.netfang, s.id);
      claim(b.contact_email, s.id);
    });
    // drop ambiguous
    Object.keys(emailToId).forEach(e => { if (emailToId[e] === AMBIG) delete emailToId[e]; });

    // ---- BROAD email → base map (for the yellow "signals" ONLY) ----
    // Red (unreplied) stays strict per-building above. Yellow may match looser:
    // any address of any building of a base, or the base's own email → that base
    // → ALL its in-service buildings. A "possible change — go check" flag is worth
    // a looser match; worst case is a glance at mail that turns out fine. (Red is
    // never driven this way, so a loose match can't produce a wrong "you owe a reply".)
    const emailToBase = {};
    const AMBIG_B = Symbol('ambigBase');
    const claimBase = (email, baseId) => {
      const e = cleanEmail(email);
      if (!e || FREE_OK(e) === null || !baseId) return;
      if (!(e in emailToBase)) emailToBase[e] = baseId;
      else if (emailToBase[e] !== baseId) emailToBase[e] = AMBIG_B; // two bases, same address → drop
    };
    sites.forEach(s => { if (s.customer_base_id) claimBase(s.netfang, s.customer_base_id); });
    bases.forEach(b => { claimBase(b.netfang, b.id); claimBase(b.contact_email, b.id); });
    Object.keys(emailToBase).forEach(e => { if (emailToBase[e] === AMBIG_B) delete emailToBase[e]; });
    const baseToSites = {}; // base_id → [in-service fyrirtaeki_id]
    sites.forEach(s => { if (s.customer_base_id) (baseToSites[s.customer_base_id] = baseToSites[s.customer_base_id] || []).push(s.id); });

    const companyEmails = new Set(Object.keys(emailToId));
    if (!companyEmails.size) {
      return json(200, { byId: {}, generated_at: new Date().toISOString(),
        scanned: { emails: 0, companies: sites.length, matched: 0 } });
    }

    // ---- read recent email_digest (inbound + sent) — PARALLEL pages ----
    // This is the heavy read (~7k rows). Sequential paging cost ~9s and pushed
    // the function to Netlify's 10s cliff (→ 502 → empty badges). Parallel paging
    // brings it to ~1.5s. See fetchAllParallel.
    const rows = await fetchAllParallel('email_digest',
      'select=sender_email,to_addresses,subject,snippet,body_preview,is_question,received_at,folder' +
      `&received_at=gte.${encodeURIComponent(sinceIso)}&order=received_at.desc`);

    // newest INBOUND per company email + collect SENT recipients timeline, and
    // scan ALL inbound in the window for "signals" (uppsögn/flutt/eigendaskipti/
    // gjaldþrot/kvörtun/bilun/áríðandi). A status-change email from months ago is
    // easily buried behind newer mail — but it's exactly what we must NOT forget
    // before the yearly visit, so we look across the whole window, not just newest.
    const inbound = {};    // email → newest inbound row
    const sentTo = {};     // email → newest SENT received_at addressed to it
    const sigByEmail = {}; // email → { <type>: {subject, received_at} } — EXACT
    const sigByIdBroad = {};// fyrirtaeki_id → { <type>: {subject, received_at} } — BROAD (yellow)
    const broadMail = {};  // fyrirtaeki_id → newest signal-bearing mail (fyrir popover)
    const baseHist = {};   // base_id → newest correspondence, any direction — BROAD (green/history)
    const noteHist = (baseId, custAddr, m) => {
      if (!baseId) return;
      const cur = baseHist[baseId];
      if (cur && (cur.received_at || '') >= (m.received_at || '')) return;
      baseHist[baseId] = {
        from: custAddr || (cur && cur.from) || null,
        subject: m.subject || '',
        snippet: (m.snippet || m.body_preview || '').slice(0, 240),
        received_at: m.received_at || null,
      };
    };
    for (const m of rows) {
      const isSent = String(m.folder || '').toUpperCase() === 'SENT';
      if (isSent) {
        const recips = recipientsOf(m.to_addresses);
        for (const r of recips) {
          if (companyEmails.has(r) && (!sentTo[r] || (m.received_at || '') > sentTo[r])) sentTo[r] = m.received_at || '';
          noteHist(emailToBase[r], r, m); // outbound TO a customer address → correspondence (green)
        }
        continue;
      }
      const from = cleanEmail(m.sender_email);
      if (!from) continue;
      noteHist(emailToBase[from], from, m); // inbound FROM a customer address → correspondence (green)
      const types = detectSignals(m.subject, m.snippet, m.body_preview);
      // EXACT per-building match (red/green + exact signals)
      if (companyEmails.has(from)) {
        if (!inbound[from]) inbound[from] = m; // rows desc → first hit is newest
        if (types.length) {
          const bag = sigByEmail[from] || (sigByEmail[from] = {});
          for (const t of types) if (!bag[t]) bag[t] = { subject: m.subject || '', received_at: m.received_at || null };
        }
      }
      // BROAD base match — signals only (yellow). Attaches to ALL in-service
      // buildings of the base (over-flags multi-site rekstrarfélög, acceptable
      // for a "go check" flag; single-site bases — the majority — are precise).
      if (types.length) {
        const baseId = emailToBase[from];
        if (baseId) {
          for (const sid of (baseToSites[baseId] || [])) {
            const bag = sigByIdBroad[sid] || (sigByIdBroad[sid] = {});
            for (const t of types) if (!bag[t]) bag[t] = { subject: m.subject || '', received_at: m.received_at || null };
            const bm = broadMail[sid];
            if (!bm || (m.received_at || '') > (bm.received_at || '')) broadMail[sid] = { from, subject: m.subject || '', snippet: (m.snippet || m.body_preview || '').slice(0, 240), received_at: m.received_at || null };
          }
        }
      }
    }

    // ---- assemble per-company result ----
    const byId = {};
    let matched = 0;
    for (const email of companyEmails) {
      const m = inbound[email];
      if (!m) continue;
      const id = emailToId[email];
      const lastSent = sentTo[email] || '';
      const unreplied = !(lastSent && lastSent >= (m.received_at || ''));
      const cur = byId[id];
      // if a site somehow maps from two addresses, keep the newest inbound
      if (cur && (cur.received_at || '') >= (m.received_at || '')) continue;
      const bag = sigByEmail[email] || {};
      const signals = Object.keys(bag)
        .map(t => ({ type: t, subject: bag[t].subject, received_at: bag[t].received_at }))
        .sort((a, b) => String(b.received_at || '').localeCompare(String(a.received_at || '')));
      byId[id] = {
        from: email,
        subject: m.subject || '',
        snippet: (m.snippet || m.body_preview || '').slice(0, 240),
        received_at: m.received_at || null,
        is_question: !!m.is_question,
        unreplied,
        important: signals.length > 0,   // gult merki = eitthvað sem kallar á athygli
        signals,                          // [{type, subject, received_at}] — lífsferill fyrst
      };
      matched++;
    }

    const exactMatched = Object.keys(byId).length;

    // ---- merge BROAD base-level signals (yellow) ----
    // Attaches signals to sibling in-service buildings too. Never sets unreplied
    // (so this can't produce a red). Creates a signals-only entry when the
    // building had no exact mail match, so the yellow badge still shows.
    for (const sid in sigByIdBroad) {
      const bag = sigByIdBroad[sid];
      let e = byId[sid];
      if (!e) {
        const bm = broadMail[sid] || {};
        e = byId[sid] = {
          from: bm.from || null,
          subject: bm.subject || '',
          snippet: bm.snippet || '',
          received_at: bm.received_at || null,
          is_question: false,
          unreplied: false,   // broad match is signals-only — never drives RED
          important: false,
          signals: [],
          match: 'broad',
        };
      }
      const seen = new Set((e.signals || []).map(s => s.type));
      for (const t in bag) if (!seen.has(t)) e.signals.push({ type: t, subject: bag[t].subject, received_at: bag[t].received_at });
      e.signals.sort((a, b) => String(b.received_at || '').localeCompare(String(a.received_at || '')));
      e.important = e.signals.length > 0;
    }

    // ---- merge BROAD base-level HISTORY (green) ----
    // "We have correspondence with this customer" — a calm green dot on the
    // list. SINGLE-SITE bases only: the lone in-service building is unambiguous.
    // Multi-site rekstrarfélög are deliberately left to the exact per-building
    // matches above, so we never claim history on a sibling building we never
    // actually wrote to. Never sets unreplied/important → can only ADD green.
    let historyAdded = 0;
    for (const baseId in baseHist) {
      const siteList = baseToSites[baseId] || [];
      if (siteList.length !== 1) continue;      // single in-service site only
      const sid = siteList[0];
      if (byId[sid]) continue;                  // already red/yellow/green(exact) — keep the stronger entry
      const hm = baseHist[baseId];
      byId[sid] = {
        from: hm.from || null,
        subject: hm.subject || '',
        snippet: hm.snippet || '',
        received_at: hm.received_at || null,
        is_question: false,
        unreplied: false,
        important: false,
        signals: [],
        match: 'history',
        history: true,
      };
      historyAdded++;
    }

    // ---- merge felag-derived HISTORY ids (broad green, matches Þjónustuver) ----
    // The RPC resolves which building each mail belongs to (single-site → lone
    // building; multi-site → the evidence-matched building only), so a sibling of
    // a rekstrarfélag is never lit. Only ADDS green — a stronger red/yellow or a
    // richer single-site green entry above always wins (guarded by byId[sid]).
    const hist = await histPromise;
    let felagGreen = 0;
    if (hist && Array.isArray(hist.ids)) {
      const detail = hist.detail || {};
      for (const sid of hist.ids) {
        if (byId[sid]) continue;
        const dt = detail[String(sid)] || null;
        byId[sid] = {
          from: (dt && dt.from) || null,
          subject: (dt && dt.subject) || '',
          snippet: '',
          received_at: (dt && dt.received_at) || null,
          is_question: false,
          unreplied: false,
          important: false,
          signals: [],
          match: 'history',
          history: true,
        };
        felagGreen++;
      }
    }

    return json(200, {
      byId,
      generated_at: new Date().toISOString(),
      scanned: {
        emails: rows.length, companies: sites.length, matched: Object.keys(byId).length,
        exact: exactMatched, with_signals: Object.values(byId).filter(v => v.signals && v.signals.length).length,
        history: historyAdded + felagGreen, history_felag: felagGreen,
        green: Object.values(byId).filter(v => !v.unreplied && !(v.signals && v.signals.length)).length,
      },
    });
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};

// Free/shared mail domains are still allowed as an exact address (it IS the
// customer's address); the ambiguity guard drops any shared across companies.
function FREE_OK(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null; }
function cleanEmail(v) {
  if (!v) return '';
  let s = String(v).trim().toLowerCase();
  // pull "Name <addr>" → addr
  const m = s.match(/<([^>]+)>/);
  if (m) s = m[1].trim();
  return s.replace(/[),;]+$/, '');
}
// to_addresses may be a jsonb array, a comma/semicolon string, or "Name <a@b>".
function recipientsOf(to) {
  if (!to) return [];
  let parts = [];
  if (Array.isArray(to)) parts = to;
  else parts = String(to).split(/[,;]/);
  const out = [];
  for (const p of parts) {
    const e = cleanEmail(p);
    if (e && e.indexOf('@') > 0) out.push(e);
  }
  return out;
}

// ── "signals" í pósti (gult merki) ─────────────────────────────────────────
// Íhaldssamir frasar sem benda STERKT á breytingu/vandamál — betra að sleppa
// óvissu en að flagga rangt. Lífsferils-merkin (uppsogn/flutt/eigandi/gjaldthrot)
// eru þau sem má ALLS EKKI gleyma áður en farið er í árlega heimsókn: ef kúnninn
// sendi „við erum hætt / flutt / gjaldþrota" fyrir mörgum mánuðum má það ekki
// grafast. Notað á subject + snippet + body_preview (lágstafað).
const SIGNALS = {
  uppsogn:    ['sagði upp', 'segja upp', 'segjum upp', 'sagt upp', 'uppsögn', 'uppsagn', 'viljum hætta', 'óska eftir að hætta', 'hætta þjónust', 'hætt þjónust', 'afþökk', 'afpant', 'cancel', 'terminate', 'discontinue', 'no longer need', 'end the contract', 'end our contract'],
  flutt:      ['erum flutt', 'vorum flutt', 'fluttum', 'nýtt heimilisfang', 'breytt heimilisfang', 'ný staðsetning', 'we have moved', 'have relocated', 'new address'],
  eigandi:    ['eigendaskipt', 'nýr eigandi', 'nýir eigend', 'ný eigandi', 'nýtt rekstrarfélag', 'nýr rekstraraðil', 'new owner', 'change of ownership', 'under new management', 'sold the company', 'sold to'],
  gjaldthrot: ['gjaldþrot', 'þrotabú', 'gjaldþrota', 'bankrupt', 'insolven', 'liquidat'],
  kvortun:    ['kvörtun', 'kvarta', 'óánæg', 'ósátt', 'vonbrigð', 'léleg þjónust', 'complaint', 'unhappy', 'disappointed', 'not satisfied'],
  bilun:      ['bilað', 'biluð', 'bilun', 'fer í gang', 'fara í gang', 'ónýt', 'leki', 'lekur', 'sprungið', 'virkar ekki', 'virkar ekkert', 'false alarm', 'malfunction', 'not working', 'emergency', 'eldsvoð', 'kviknaði'],
  aridandi:   ['áríðandi', 'brýnt', 'sem fyrst', 'hið fyrsta', 'urgent', 'asap', 'immediately', 'as soon as possible'],
};
function detectSignals(subject, snippet, body) {
  const hay = ((subject || '') + ' ' + (snippet || '') + ' ' + (body || '')).toLowerCase();
  const out = [];
  for (const type in SIGNALS) {
    if (SIGNALS[type].some(k => hay.indexOf(k) !== -1)) out.push(type);
  }
  return out;
}

// Broad green: in-service building ids we have email history with, resolved by
// felag_samskipti via the SECURITY DEFINER RPC (sql/2026-08-20_tv_history_sites.sql).
async function rpcHistorySites(days) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/tv_history_sites`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  if (!r.ok) throw new Error(`tv_history_sites: ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json(); // { ids:[bigint], detail:{ "<site_id>": {from, subject, received_at} } }
}

// Full communication history for ONE company (all-time), for the popover expander.
async function rpcCompanyHistory(coId) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/tv_company_history`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json' },
    body: JSON.stringify({ p_fyrirtaeki_id: coId }),
  });
  if (!r.ok) throw new Error(`tv_company_history: ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json(); // { fyrirtaeki_id, base_id, mails:[…] }
}

// Like fetchAll but fires all pages CONCURRENTLY (count-first), for the heavy
// email_digest read. Preserves order: page 0 (newest), then 1, 2, … in sequence,
// so the desc ordering the matching relies on is intact.
async function fetchAllParallel(table, qs) {
  const PAGE = 1000;
  const url = `${SUPABASE_URL}/rest/v1/${table}?${qs}`;
  const headersFor = (from) => ({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
    Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' });
  const r0 = await fetch(url, { headers: { ...headersFor(0), Prefer: 'count=exact' } });
  if (!r0.ok) throw new Error(`${table}: ${r0.status} ${(await r0.text()).slice(0, 160)}`);
  const first = await r0.json();
  const total = parseInt(((r0.headers.get('content-range') || '').split('/')[1] || '').trim(), 10);
  if (!Number.isFinite(total) || total <= first.length) return first;
  const jobs = [];
  for (let from = PAGE; from < total && from <= 60000; from += PAGE) {
    jobs.push(fetch(url, { headers: headersFor(from) }).then(async (r) => {
      if (!r.ok) throw new Error(`${table}: ${r.status}`);
      return r.json();
    }));
  }
  const rest = await Promise.all(jobs);
  const out = first.slice();
  for (const p of rest) out.push(...p);
  return out;
}

async function fetchAll(table, qs) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
        Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
    from += 1000;
    if (from > 60000) break; // safety cap
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
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
