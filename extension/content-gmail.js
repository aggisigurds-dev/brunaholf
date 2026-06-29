// content-gmail.js — runs on https://mail.google.com/*
//
// Scrapes the visible inbox rows and sends them to the background service worker.
// Gmail DOM is obfuscated; we lean on a few selectors that have been stable for
// years (`tr.zA`, `span[email]`, `td.xW span[title]`). Defensive fallbacks below.

(() => {
  if (window.__brunaholfMailPulseLoaded) return;
  window.__brunaholfMailPulseLoaded = true;

  const LOG_PREFIX = '[Brunaholf Mail Pulse]';
  const MAX_ROWS_PER_SCAN = 50;
  const AUTO_SCAN_DEBOUNCE_MS = 4000;

  function log(...a) { try { console.log(LOG_PREFIX, ...a); } catch (_) {} }
  function warn(...a) { try { console.warn(LOG_PREFIX, ...a); } catch (_) {} }

  function detectAccount() {
    // Best source: the account link in the top-right has aria-label like
    // "Google Account: Foo Bar (foo@bar.com)".
    const a = document.querySelector('a[aria-label*="@"]');
    if (a) {
      const m = a.getAttribute('aria-label').match(/\(([^)]+@[^)]+)\)/);
      if (m) return m[1].trim().toLowerCase();
    }
    // Fallback: <title> "Inbox - foo@bar.com - Gmail"
    const t = document.title || '';
    const m2 = t.match(/([\w.+-]+@[\w.-]+\.[\w-]+)/);
    if (m2) return m2[1].trim().toLowerCase();
    return null;
  }

  function detectFolder() {
    // Read the breadcrumb/nav state — the URL hash carries it.
    const hash = location.hash || '';
    const m = hash.match(/#([^/?]+)/);
    if (!m) return 'INBOX';
    const seg = decodeURIComponent(m[1]).toLowerCase();
    if (seg === 'inbox' || seg === 'imp') return 'INBOX';
    if (seg === 'sent') return 'SENT';
    if (seg === 'starred') return 'STARRED';
    if (seg === 'all') return 'ALL';
    if (seg === 'search') return 'SEARCH';
    if (seg.startsWith('label/')) return decodeURIComponent(seg.slice(6));
    if (seg.startsWith('category/')) return 'CATEGORY:' + decodeURIComponent(seg.slice(9));
    return seg.toUpperCase();
  }

  // Stable hash for the message_id (browser:<32hex>). Uses SubtleCrypto.
  async function hash32(s) {
    const buf = new TextEncoder().encode(s);
    const dig = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(dig)).slice(0, 16)
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Parse Gmail row time. Format depends on age:
  //   - same day: "5:30 PM" / "17:30"
  //   - same year: "Jun 26"
  //   - older: "6/26/24"
  // The element's `title` attribute usually carries the FULL datetime — prefer it.
  function parseRowTime(td) {
    if (!td) return null;
    const span = td.querySelector('span[title]') || td.querySelector('span');
    if (!span) return null;
    const titleAttr = span.getAttribute('title');
    if (titleAttr) {
      const d = new Date(titleAttr);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    // Last resort: assume "today" with the displayed time.
    const txt = (span.textContent || '').trim();
    if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(txt)) {
      const now = new Date();
      const d2 = new Date(`${now.toDateString()} ${txt}`);
      if (!isNaN(d2.getTime())) return d2.toISOString();
    }
    return null;
  }

  function extractSender(tr) {
    // Gmail puts the sender name + email on a span: <span email="foo@bar" name="Foo">
    const s = tr.querySelector('span[email]');
    if (s) {
      return {
        sender_email: (s.getAttribute('email') || '').toLowerCase() || null,
        sender_name: s.getAttribute('name') || s.textContent.trim() || null,
      };
    }
    // Fallback: first .yW > span
    const yw = tr.querySelector('.yW span, .yX span');
    return {
      sender_email: null,
      sender_name: yw ? yw.textContent.trim() : null,
    };
  }

  function extractSubjectAndSnippet(tr) {
    // td.xY > div > span (first span = subject, last "y2" span = snippet).
    const td = tr.querySelector('td.xY') || tr.querySelector('td:nth-of-type(3)');
    if (!td) return { subject: null, snippet: null };
    const subjSpan = td.querySelector('.bog, .y6 > span:first-child, span > span');
    const snipSpan = td.querySelector('.y2');
    return {
      subject: subjSpan ? subjSpan.textContent.trim() : null,
      snippet: snipSpan ? snipSpan.textContent.replace(/^\s*-\s*/, '').trim() : null,
    };
  }

  function hasAttachment(tr) {
    // Paperclip icon Gmail adds a span with .brd / .y3 attribute somewhere.
    return !!tr.querySelector('.brd, [aria-label*="attachment" i], [data-tooltip*="attachment" i]');
  }

  async function scrapeRows() {
    const rows = Array.from(document.querySelectorAll('tr.zA'));
    if (!rows.length) {
      warn('No tr.zA rows found — selector may have changed, or inbox not loaded yet');
      return [];
    }
    const slice = rows.slice(0, MAX_ROWS_PER_SCAN);
    const account = detectAccount();
    if (!account) {
      warn('Could not detect account from page — skipping');
      return [];
    }
    const folder = detectFolder();

    const out = [];
    for (let idx = 0; idx < slice.length; idx++) {
      const tr = slice[idx];
      const { sender_email, sender_name } = extractSender(tr);
      const { subject, snippet } = extractSubjectAndSnippet(tr);
      const td_time = tr.querySelector('td.xW') || tr.querySelector('td:last-of-type');
      const received_at = parseRowTime(td_time);

      if (!subject && !sender_email && !sender_name) continue;

      // Hash includes the raw displayed/title time text (locale-independent)
      // plus the DOM row index as a final tiebreaker — keeps the message_id
      // stable across re-scrapes of the same view, while differentiating
      // rows that share sender+subject but landed on different dates.
      const timeTitle = td_time?.querySelector('span[title]')?.getAttribute('title') || '';
      const timeText = td_time?.textContent?.trim() || '';
      const snipFrag = (snippet || '').slice(0, 60);
      const idSeed = [
        account,
        sender_email || sender_name || '',
        subject || '',
        timeTitle, timeText, snipFrag,
        `idx:${idx}`,
      ].join('|');
      const h = await hash32(idSeed);
      out.push({
        message_id: `browser:${h}`,
        sender_name, sender_email, subject, snippet,
        received_at,
        has_attachment: hasAttachment(tr),
      });
    }
    return { account, folder, emails: out };
  }

  let lastScanAt = 0;
  let pendingTimer = null;

  async function runScan(trigger = 'auto') {
    lastScanAt = Date.now();
    const res = await scrapeRows();
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
      log(`upsert response:`, response);
      return response;
    } catch (e) {
      warn('sendMessage failed:', e);
      return { ok: false, error: String(e) };
    }
  }

  function scheduleScan() {
    if (pendingTimer) return;
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      runScan('auto');
    }, AUTO_SCAN_DEBOUNCE_MS);
  }

  // Initial scan on load + every time the route hash changes (folder switch).
  window.addEventListener('load', () => setTimeout(() => runScan('load'), 2000));
  window.addEventListener('hashchange', scheduleScan);

  // MutationObserver: detect when new rows appear (Gmail virtualizes the list,
  // but new arrivals/scrolling re-render rows under the same container).
  let observer = null;
  function startObserving() {
    const root = document.querySelector('div[role="main"]') || document.body;
    if (observer) observer.disconnect();
    observer = new MutationObserver(scheduleScan);
    observer.observe(root, { childList: true, subtree: true });
  }
  setTimeout(startObserving, 4000);

  // Popup → "Sync now" sends this message.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'manual-scan') {
      runScan('manual').then(sendResponse);
      return true;
    }
  });

  log('content-gmail.js loaded');
})();
