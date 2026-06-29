// popup.js — settings + manual sync + last-sync status.

const $ = (id) => document.getElementById(id);
const log = (m) => { const el = $('log'); el.textContent = m; };

function relTime(ts) {
  if (!ts) return '—';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s síðan`;
  if (s < 3600) return `${Math.round(s/60)}m síðan`;
  if (s < 86400) return `${Math.round(s/3600)}klst síðan`;
  return `${Math.round(s/86400)}d síðan`;
}

async function loadConfig() {
  const cfg = await chrome.storage.sync.get(['endpoint', 'token']);
  $('endpoint').value = cfg.endpoint || 'https://brunaholf.netlify.app/api/email-ingest-browser';
  $('token').value = cfg.token || '';
}

async function loadStatus() {
  const { lastSync } = await chrome.storage.local.get('lastSync');
  const box = $('status');
  if (!lastSync || !Object.keys(lastSync).length) {
    box.innerHTML = '<div class="sub">Engin sync skráð enn.</div>';
    return;
  }
  const items = Object.entries(lastSync).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  box.innerHTML = items.map(([acct, info]) => {
    const css = info.status === 'success' ? 'ok' : 'err';
    const detail = info.status === 'success'
      ? `${info.sent}→${info.upserted}${info.questions ? ` · ${info.questions} sp` : ''}`
      : `villa: ${info.error || ''}`;
    return `
      <div class="status-row">
        <div>
          <div class="acct">${escape(acct)}</div>
          <div class="sub">${escape(info.folder || '')} · <span class="${css}">${escape(detail)}</span></div>
        </div>
        <div class="when">${relTime(info.at)}</div>
      </div>`;
  }).join('');
}

function escape(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

$('save').addEventListener('click', async () => {
  const endpoint = $('endpoint').value.trim();
  const token = $('token').value.trim();
  await chrome.storage.sync.set({ endpoint, token });
  log('Stillingar vistaðar.');
});

async function trySendScan(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: 'manual-scan' });
}

$('sync').addEventListener('click', async () => {
  log('Sendi „sync" á virkan flipa…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { log('Enginn virkur flipi.'); return; }
    const isMailTab = /mail\.google\.com|outlook\.(office|live)\.com/.test(tab.url || '');
    if (!isMailTab) { log('Flipinn er ekki Gmail eða Outlook.'); return; }
    let res;
    try {
      res = await trySendScan(tab.id);
    } catch (e) {
      // "Receiving end does not exist" → content script not loaded (tab
      // pre-dates the extension). Auto-refresh the tab and retry once.
      if (String(e.message || e).includes('Receiving end')) {
        log('Endurhleður flipa og reyni aftur…');
        await chrome.tabs.reload(tab.id);
        await new Promise(r => setTimeout(r, 4500));
        res = await trySendScan(tab.id);
      } else { throw e; }
    }
    if (res?.ok) {
      log(`Tókst: ${res.upserted} upsertaðir (${res.received} sendir).`);
    } else if (res?.reason === 'no-rows') {
      log('Engar raðir fundust á síðunni.');
    } else {
      log('Villa: ' + (res?.error || 'óþekkt'));
    }
    setTimeout(loadStatus, 800);
  } catch (e) {
    log('Villa: ' + (e.message || e));
  }
});

loadConfig().then(loadStatus);
setInterval(loadStatus, 5000);
