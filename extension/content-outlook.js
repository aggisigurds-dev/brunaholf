// content-outlook.js — runs on outlook.office.com / outlook.live.com.
//
// v1 best-effort scrape — Outlook OWA uses React with virtualized lists and
// heavily styled DOM. Selectors here are conservative; if nothing is captured,
// the popup shows "0 found" so we know to adjust.

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

  function detectAccount() {
    // Outlook top-right account button usually has aria-label or alt with email.
    const btn = document.querySelector('button[aria-label*="@"]')
      || document.querySelector('[data-tid="OwaUserActionMenuButton"]');
    if (btn) {
      const lbl = btn.getAttribute('aria-label') || '';
      const m = lbl.match(/([\w.+-]+@[\w.-]+\.[\w-]+)/);
      if (m) return m[1].trim().toLowerCase();
    }
    const t = document.title || '';
    const m2 = t.match(/([\w.+-]+@[\w.-]+\.[\w-]+)/);
    if (m2) return m2[1].trim().toLowerCase();
    return null;
  }

  function detectFolder() {
    // OWA: aria-current="page" or selected folder label in the nav tree.
    const sel = document.querySelector('[aria-selected="true"][role="treeitem"]')
      || document.querySelector('[aria-current="page"]');
    if (sel) {
      const txt = (sel.textContent || '').trim();
      // Strip count badges like "Redder ehf 12"
      const cleaned = txt.replace(/\s+\d+\s*$/, '').trim();
      if (cleaned) return cleaned;
    }
    return 'INBOX';
  }

  function extractRows() {
    // OWA virtualized list — each row commonly has role="option" within
    // a role="listbox" or role="grid" container. Aria-label often carries
    // full context ("From X, subject Y, received Z").
    let rows = Array.from(document.querySelectorAll('[role="option"][aria-label]'));
    if (!rows.length) {
      rows = Array.from(document.querySelectorAll('div[data-convid], div[data-itemid]'));
    }
    return rows.slice(0, MAX_ROWS_PER_SCAN);
  }

  function parseAriaLabel(label) {
    if (!label) return {};
    // Common OWA aria-label format examples:
    //   "Foo Bar, Subject text, Received Mon 6/26/2026 5:30 PM, ..."
    //   "Unread, Foo Bar, Subject text, ..."
    const parts = label.split(',').map(s => s.trim()).filter(Boolean);
    let sender_name = null, subject = null, received_at = null;

    // Strip leading flags (Unread, High importance, etc.)
    const FLAGS = /^(unread|read|high importance|low importance|flagged|has attachment)$/i;
    let i = 0;
    while (i < parts.length && FLAGS.test(parts[i])) i++;

    if (i < parts.length) sender_name = parts[i++];
    if (i < parts.length) subject = parts[i++];
    for (; i < parts.length; i++) {
      const p = parts[i];
      const m = p.match(/received\s+(.+)$/i);
      if (m) {
        const d = new Date(m[1]);
        if (!isNaN(d.getTime())) { received_at = d.toISOString(); break; }
      }
    }
    return { sender_name, subject, received_at };
  }

  async function scrape() {
    const rows = extractRows();
    if (!rows.length) {
      warn('No Outlook rows found — DOM selectors may have changed');
      return null;
    }
    const account = detectAccount();
    if (!account) {
      warn('Could not detect Outlook account');
      return null;
    }
    const folder = detectFolder();

    const out = [];
    for (const row of rows) {
      const label = row.getAttribute('aria-label') || '';
      const { sender_name, subject, received_at } = parseAriaLabel(label);
      if (!sender_name && !subject) continue;

      // Try to find sender email — OWA sometimes has a hover/data attribute.
      const emailEl = row.querySelector('[title*="@"], [data-email]');
      const sender_email = emailEl
        ? ((emailEl.getAttribute('data-email') || emailEl.getAttribute('title') || '').match(/[\w.+-]+@[\w.-]+\.[\w-]+/) || [null])[0]
        : null;

      // Snippet: often in a second span inside the row.
      const snipEl = row.querySelector('[role="presentation"] span:last-of-type');
      const snippet = snipEl ? (snipEl.textContent || '').trim().slice(0, 500) : null;

      const idSeed = [account, sender_email || sender_name || '', subject || '', received_at || ''].join('|');
      const h = await hash32(idSeed);
      out.push({
        message_id: `browser:${h}`,
        sender_name, sender_email: sender_email ? sender_email.toLowerCase() : null,
        subject, snippet, received_at,
        has_attachment: /attachment/i.test(label),
      });
    }
    return { account, folder, emails: out };
  }

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

  window.addEventListener('load', () => setTimeout(() => runScan('load'), 3000));
  window.addEventListener('hashchange', scheduleScan);
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
