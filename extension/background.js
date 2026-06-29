// background.js — service worker.
// Receives email batches from content scripts and POSTs to the brunahólf hub.

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
