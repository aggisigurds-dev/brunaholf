// background.js — service worker.
// Receives email batches from content scripts and POSTs to the brunahólf hub.

const MAIL_URL_PATTERNS = [
  'https://mail.google.com/*',
  'https://outlook.office.com/mail/*',
  'https://outlook.office365.com/mail/*',
  'https://outlook.live.com/mail/*',
];

// On install/update/reload, force-refresh any open Gmail/Outlook tabs so the
// content scripts inject into them. Otherwise tabs opened BEFORE the extension
// have no content script and "Sync now" fails with "Receiving end does not
// exist". Runs once per install/update.
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({ url: MAIL_URL_PATTERNS });
    for (const t of tabs) {
      if (t.id != null) chrome.tabs.reload(t.id).catch(()=>{});
    }
    console.log('[Brunaholf Mail Pulse] auto-refreshed', tabs.length, 'mail tabs');
  } catch (e) {
    console.warn('[Brunaholf Mail Pulse] auto-refresh on install failed:', e);
  }
});

const DEFAULTS = {
  endpoint: 'https://brunaholf.netlify.app/api/email-ingest-browser',
  token: '',
};

async function getConfig() {
  const stored = await chrome.storage.sync.get(['endpoint', 'token']);
  return {
    endpoint: stored.endpoint || DEFAULTS.endpoint,
    token: stored.token || DEFAULTS.token,
  };
}

async function recordSync(account, info) {
  const all = (await chrome.storage.local.get('lastSync')).lastSync || {};
  all[account] = { ...info, at: Date.now() };
  await chrome.storage.local.set({ lastSync: all });
}

async function postEmails({ account, folder, emails }) {
  const { endpoint, token } = await getConfig();
  if (!endpoint) throw new Error('No endpoint configured');
  if (!token) throw new Error('No X-Brunaholf-Token configured');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Brunaholf-Token': token,
    },
    body: JSON.stringify({ account, folder, emails }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data.error || JSON.stringify(data).slice(0, 200)}`);
  return data;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'emails') {
    const { account, folder, emails } = msg;
    (async () => {
      try {
        const result = await postEmails({ account, folder, emails });
        await recordSync(account, {
          folder,
          sent: emails.length,
          upserted: result.upserted ?? 0,
          questions: result.classified_questions ?? 0,
          status: 'success',
        });
        sendResponse({ ok: true, ...result });
      } catch (e) {
        await recordSync(account, {
          folder,
          sent: emails.length,
          status: 'error',
          error: String(e.message || e).slice(0, 200),
        });
        sendResponse({ ok: false, error: String(e.message || e) });
      }
    })();
    return true; // keep channel open for async sendResponse
  }
  if (msg?.type === 'get-config') {
    getConfig().then(sendResponse);
    return true;
  }
});
