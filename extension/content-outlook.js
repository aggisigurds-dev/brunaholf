// content-outlook.js — runs on outlook.office.com / outlook.live.com.
//
// OWA uses a virtualised React list with stable ARIA semantics. Strategy:
//   • find rows via role="option" (the inbox list) AND data-convid (a stable
//     conversation id Outlook exposes on each row)
//   • parse the row's aria-label for sender/subject/time-text (locale-agnostic
//     where possible; we keep the raw text fragments so the hash is unique
//     even if date parsing fails for an Icelandic-locale label)
//   • dig out the sender email from any inner element carrying an `@` in
//     `title`, `data-*` or text
//   • build a stable message_id from convid when available, else from a
//     content hash including DOM index as a tiebreaker
//
// Diagnostic logging is verbose by design — Outlook's class names rotate
// monthly. When the scraper returns few rows, the console tells us exactly
// which selectors matched and why.

(() => {
  if (window.__brunaholfOutlookLoaded) return;
  window.__brunaholfOutlookLoaded = true;

  const LOG_PREFIX = '[Brunaholf Mail Pulse · Outlook]';
  const MAX_ROWS_PER_SCAN = 50;
  const AUTO_SCAN_DEBOUNCE_MS = 5000;

  function log(...a) { try { console.log(LOG_PREFIX, ...a); } catch (_) {} }
  function warn(...a) { try { console.warn(LOG_PREFIX, ...a); } catch (_) {} }

  async function hash32(s) {
    const buf = new TextEncoder().encode(s);
    const dig = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(dig)).slice(0, 16)
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Account detection ─────────────────────────────────────────────────────
  function detectAccount() {
    // (1) The "Me-control" button at top-right has aria-label containing the
    //     signed-in email. Variants: data-tid="OwaUserActionMenuButton",
    //     class names rotate, but aria-label is stable.
    const candidates = [
      'button[aria-label*="@"]',
      '[data-tid="OwaUserActionMenuButton"]',
      '[data-tid*="MeControl"]',
      'div[role="banner"] [aria-label*="@"]',
      'img[alt*="@"]',
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) {
        const lbl = el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title') || '';
        const m = lbl.match(/([\w.+-]+@[\w.-]+\.[\w-]+)/);
        if (m) { log('account via', sel); return m[1].trim().toLowerCase(); }
      }
    }
    // (2) Document title sometimes carries the address.
    const t = document.title || '';
    const m2 = t.match(/([\w.+-]+@[\w.-]+\.[\w-]+)/);
    if (m2) { log('account via document.title'); return m2[1].trim().toLowerCase(); }
    // (3) JS in some OWA versions exposes window._userInfo.mail — try defensively.
    try {
      const w = window;
      const cand = w._userInfo?.mail || w.OwaUserInfo?.userPrincipalName;
      if (cand && cand.includes('@')) { log('account via window.*'); return String(cand).toLowerCase(); }
    } catch (_) {}
    return null;
  }

  // ── Folder detection ──────────────────────────────────────────────────────
  function detectFolder() {
    // (1) Selected tree item in the left nav.
    const selected = document.querySelector('[role="treeitem"][aria-selected="true"]')
      || document.querySelector('[role="treeitem"].selected')
      || document.querySelector('[aria-current="page"][role="treeitem"]');
    if (selected) {
      const txt = (selected.textContent || '').trim();
      const cleaned = txt.replace(/\s*\d+\s*$/, '').trim(); // strip unread count
      if (cleaned) return cleaned;
    }
    // (2) Page header / breadcrumb.
    const heading = document.querySelector('[role="heading"][aria-level="1"]')
      || document.querySelector('h1');
    if (heading) {
      const t = (heading.textContent || '').trim();
      if (t && t.length < 60) return t;
    }
    return 'INBOX';
  }

  // ── Row extraction ────────────────────────────────────────────────────────
  function extractRows() {
    // OWA inbox list rows in priority order — first match wins.
    const selectors = [
      'div[role="option"][aria-label][data-convid]',
      'div[role="option"][aria-label]',
      'div[draggable="true"][role="option"]',
      'div[data-convid][aria-label]',
      'div[data-itemid][aria-label]',
    ];
    let rows = [];
    for (const sel of selectors) {
      rows = Array.from(document.querySelectorAll(sel));
      if (rows.length) {
        log(`rows: ${rows.length} via "${sel}"`);
        break;
      }
    }
    if (!rows.length) warn('No rows matched any selector — Outlook DOM may have shifted');
    return rows.slice(0, MAX_ROWS_PER_SCAN);
  }

  // ── ARIA-label parsing (multiple OWA layouts) ─────────────────────────────
  // Common shapes (commas separate fields):
  //   "Unread, Foo Bar, Subject text, 5:30 PM, ..."
  //   "Foo Bar, Subject text, Received Mon 6/26/2026 5:30 PM, ..."
  //   "Foo Bar, Subject text, body preview..., 6/26/2026, Attachment, ..."
  // Icelandic OWA may localise "Received"/"Unread" — we don't rely on the words.
  const FLAG_WORDS = /^(unread|read|high importance|low importance|flagged|has attachment|óles[ið]+|les[ið]+|áríðandi|merkt|með viðhengi|attachment)$/i;

  function parseAriaLabel(label) {
    if (!label) return { sender_name: null, subject: null, received_text: null, received_at: null };
    const parts = label.split(',').map(s => s.trim()).filter(Boolean);

    // Drop leading flag/status words.
    let i = 0;
    while (i < parts.length && FLAG_WORDS.test(parts[i])) i++;

    const sender_name = parts[i++] || null;
    const subject = parts[i++] || null;

    // Walk remaining parts looking for a parseable date/time.
    let received_text = null, received_at = null;
    for (; i < parts.length; i++) {
      const p = parts[i];
      // Strip a leading "Received " / "Móttekið " etc if present.
      const stripped = p.replace(/^(received|móttekið|móttekinn)\s+/i, '');
      const d = new Date(stripped);
      if (!isNaN(d.getTime()) && d.getUTCFullYear() > 2020 && d.getUTCFullYear() < 2100) {
        received_text = stripped;
        received_at = d.toISOString();
        break;
      }
      // Standalone "HH:MM" or "HH.MM" → treat as today.
      if (/^\d{1,2}[:.]\d{2}(\s*(AM|PM))?$/i.test(p)) {
        const now = new Date();
        const d2 = new Date(`${now.toDateString()} ${p.replace('.', ':')}`);
        if (!isNaN(d2.getTime())) {
          received_text = p; received_at = d2.toISOString(); break;
        }
      }
      // Standalone date "6/26/2026" or "26.6.2026"
      if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(p)) {
        const norm = p.replace(/\./g, '/');
        const d3 = new Date(norm);
        if (!isNaN(d3.getTime())) { received_text = p; received_at = d3.toISOString(); break; }
      }
    }
    return { sender_name, subject, received_text, received_at };
  }

  // ── Sender email extraction from row inner content ────────────────────────
  function extractSenderEmail(row) {
    // Look through title/data-*/text for any "@" reachable from the row.
    const all = row.querySelectorAll('[title*="@"], [data-email], [aria-label*="@"]');
    for (const el of all) {
      const candidates = [
        el.getAttribute('data-email'),
        el.getAttribute('title'),
        el.getAttribute('aria-label'),
        el.textContent,
      ];
      for (const c of candidates) {
        const m = c && c.match(/[\w.+-]+@[\w.-]+\.[\w-]+/);
        if (m) return m[0].toLowerCase();
      }
    }
    return null;
  }

  // ── Snippet extraction ────────────────────────────────────────────────────
  function extractSnippet(row) {
    // Common patterns: a final span/div with the preview text.
    const sels = [
      '[role="presentation"] span:last-of-type',
      'div[role="presentation"] > span',
      'span[id*="snippet"]',
      'div[data-tid*="snippet"]',
    ];
    for (const sel of sels) {
      const el = row.querySelector(sel);
      if (el) {
        const t = (el.textContent || '').trim();
        if (t && t.length > 5) return t.slice(0, 500);
      }
    }
    return null;
  }

  // ── Convid (Outlook's stable conversation id) for message_id stability ───
  function convId(row) {
    return row.getAttribute('data-convid') || row.getAttribute('data-itemid')
      || row.getAttribute('id') || null;
  }

  // ── Main scrape ───────────────────────────────────────────────────────────
  async function scrape() {
    const rows = extractRows();
    if (!rows.length) return null;
    const account = detectAccount();
    if (!account) { warn('account undetected — bailing scrape'); return null; }
    const folder = detectFolder();

    const out = [];
    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const label = row.getAttribute('aria-label') || '';
      const { sender_name, subject, received_text, received_at } = parseAriaLabel(label);
      if (!sender_name && !subject) continue;

      const sender_email = extractSenderEmail(row);
      const snippet = extractSnippet(row);
      const cv = convId(row);

      // message_id: prefer Outlook's stable convid; fall back to content hash.
      let message_id;
      if (cv) {
        const h = await hash32(`outlook:${account}:${cv}`);
        message_id = `browser:${h}`;
      } else {
        const idSeed = [
          account, sender_email || sender_name || '', subject || '',
          received_text || '', `idx:${idx}`,
        ].join('|');
        message_id = `browser:${await hash32(idSeed)}`;
      }

      out.push({
        message_id, sender_name,
        sender_email: sender_email || null,
        subject, snippet, received_at,
        has_attachment: /attachment|viðhengi/i.test(label),
      });
    }
    return { account, folder, emails: out };
  }

  // ── Scheduling / messaging ────────────────────────────────────────────────
  let pendingTimer = null;
  async function runScan(trigger = 'auto') {
    const res = await scrape();
    if (!res || !res.emails?.length) {
      log(`scan(${trigger}): nothing found`);
      return { ok: false, reason: 'no-rows' };
    }
    log(`scan(${trigger}): ${res.emails.length} rows from ${res.account} (${res.folder})`);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'emails',
        account: res.account, folder: res.folder, emails: res.emails,
      });
      log('upsert response:', response);
      return response;
    } catch (e) {
      warn('sendMessage failed:', e);
      return { ok: false, error: String(e) };
    }
  }
  function scheduleScan() {
    if (pendingTimer) return;
    pendingTimer = setTimeout(() => { pendingTimer = null; runScan('auto'); }, AUTO_SCAN_DEBOUNCE_MS);
  }

  // Initial scan: handle both pre-loaded and still-loading cases.
  if (document.readyState === 'complete') {
    setTimeout(() => runScan('init'), 3000);
  } else {
    window.addEventListener('load', () => setTimeout(() => runScan('load'), 3000));
  }
  // OWA uses pushState for nav; observe URL changes via hashchange + popstate.
  window.addEventListener('hashchange', scheduleScan);
  window.addEventListener('popstate', scheduleScan);
  setTimeout(() => {
    new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
  }, 5000);

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'manual-scan') {
      runScan('manual').then(sendResponse);
      return true;
    }
  });

  log('content-outlook.js loaded');
})();
