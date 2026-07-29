/* kerfisheilsa v2 — REST-útgáfa (engin supabase-js þörf) */
(() => {
  if (window.__kerfisheilsaInstalled) return;
  window.__kerfisheilsaInstalled = true;
  const U = 'https://osfdzskyvisifcwyjkuk.supabase.co';
  const K = 'sb_publishable_YVpznM5EK01qOdevQwOcIg_rMjTkT7f';
  const q = async (path) => {
    const r = await fetch(U + '/rest/v1/' + path, { headers: { apikey: K, Authorization: 'Bearer ' + K } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  };
  const CHECKS = [
    { key: 'gmail', label: 'Gmail-tenging (eldklar)',
      run: async () => {
        const d = await q('email_digest?select=received_at&order=received_at.desc&limit=1');
        const last = d[0] ? new Date(d[0].received_at) : null;
        const h = last ? (Date.now() - last.getTime()) / 36e5 : 999;
        return { ok: h < 26, warn: h < 48, detail: last ? 'Nýjasti póstur: ' + last.toLocaleString('is-IS') : 'Engir póstar' };
      },
      fix: '1. Opnaðu Bakendi (vinstri valmynd)\n2. Smelltu á „✦ Tengja pósthólf (Google)"\n3. Veldu eldklar@eldklar.is\n4. Ef „Google hasn’t verified this app" birtist: „Advanced" → „Go to brunaholf.netlify.app"\n5. „Continue" / „Allow"\n\nATH: bæði móttaka OG sendingar úr kerfinu fara um þessa tengingu — ef hún er rauð komast reikningar/póstar líklega ekki út. Appið (luna-bridge) er í production svo tengingin á að haldast.' },
    { key: 'supabase', label: 'Supabase gagnagrunnur',
      run: async () => { const t0 = Date.now(); await q('app_settings?select=id&limit=1'); return { ok: true, detail: 'Svarar (' + (Date.now() - t0) + ' ms)' }; },
      fix: '1. status.supabase.com — er þjónustutruflun?\n2. Endurhlaða síðuna (Ctrl+Shift+R)\n3. Ef enn dautt: supabase.com/dashboard → verkefnið → athuga hvort það sé „paused" → „Restore project"' },
    { key: 'backup', label: 'Næturafrit í Drive',
      run: async () => {
        const d = await q('storage_backup_log?select=backed_up_at&order=backed_up_at.desc&limit=1');
        const last = d[0] ? new Date(d[0].backed_up_at) : null;
        const h = last ? (Date.now() - last.getTime()) / 36e5 : 999;
        return { ok: h < 30, warn: h < 54, detail: last ? 'Síðast: ' + last.toLocaleString('is-IS') : 'Aldrei keyrt' };
      },
      fix: '1. supabase.com/dashboard → Edge Functions → storage-backup-background → Logs\n2. Skoðaðu villuna í nýjustu keyrslu\n3. Algengast: Drive-heimild útrunnin — endurtengdu Drive í Bakenda' },
    { key: 'payday', label: 'Payday-reikningar',
      run: async () => {
        const d = await q('payday_invoices_slokk?select=created_date&order=created_date.desc&limit=1');
        const last = d[0] ? new Date(d[0].created_date) : null;
        const days = last ? (Date.now() - last.getTime()) / 864e5 : 999;
        return { ok: days < 4, warn: days < 8, soft: true, detail: last ? 'Nýjasti reikningur í samstillingu: ' + last.toLocaleDateString('is-IS') : 'Engir reikningar' };
      },
      fix: 'Mild ábending, ekki bilun. Taflan samstillist reglulega við Payday — reikningar sendir í dag birtast í næstu samstillingu.\n1. Ef þú varst að senda reikninga: athugaðu app.payday.is\n2. Ef ekkert hefur samstillst í marga daga: Slökkvitæki-síðan → Stillingar → Payday API-lykill' },
    { key: 'netlify', label: 'Netlify (síðurnar)',
      run: async () => {
        const ok = await fetch('https://slokkvitaeki.netlify.app/', { method: 'HEAD', mode: 'no-cors' }).then(() => true).catch(() => false);
        return { ok, detail: ok ? 'Báðar síður svara' : 'slokkvitaeki.netlify.app svarar ekki' };
      },
      fix: '1. app.netlify.com → veldu síðuna → Deploys\n2. Rautt deploy: opnaðu logginn — oftast dugar „Retry deploy"\n3. Allt grænt en dautt samt: www.netlifystatus.com' }
  ];
  const dot = s => s === 'ok' ? '🟢' : s === 'warn' ? '🟡' : '🔴';
  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function showFix(check, status, detail) {
    const old = document.getElementById('_kh-modal'); if (old) old.remove();
    const m = document.createElement('div');
    m.id = '_kh-modal';
    m.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
    m.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:520px;width:100%;padding:22px 24px;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<div style="font-weight:800;font-size:16px">' + dot(status) + ' ' + esc(check.label) + '</div>' +
      '<button id="_kh-x" style="border:0;background:#f1f5f9;border-radius:99px;width:30px;height:30px;cursor:pointer;font-size:15px">✕</button></div>' +
      '<div style="color:#64748b;font-size:13px;margin-bottom:12px">' + esc(detail || '') + '</div>' +
      '<div style="font-weight:700;font-size:12px;letter-spacing:.05em;color:#475569;margin-bottom:6px">🛠 HVERNIG LAGA ÉG ÞETTA?</div>' +
      '<div style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;font-size:13.5px;line-height:1.55;color:#334155">' + esc(check.fix) + '</div></div>';
    m.addEventListener('click', e => { if (e.target === m || e.target.id === '_kh-x') m.remove(); });
    document.body.appendChild(m);
  }
  async function render() {
    let host = document.querySelector('#view-dagurinn, [data-view="dagurinn"]');
    let card = document.getElementById('_kh-card');
    if (!card) {
      card = document.createElement('div');
      card.id = '_kh-card';
      card.style.cssText = 'margin:12px auto;max-width:1100px;background:#fff;border:1px solid #e2e8f0;border-left:4px solid #10b981;border-radius:14px;padding:13px 16px;font-size:13.5px;font-family:inherit;position:relative;z-index:50';
      (host || document.body).insertBefore(card, (host || document.body).firstChild);
    }
    card.innerHTML = '<div style="font-weight:800;font-size:12px;letter-spacing:.06em;color:#334155;margin-bottom:8px">🩺 KERFISHEILSA <span style="font-weight:400;color:#94a3b8">— smelltu á lið til að sjá lagfæringu</span></div><div id="_kh-rows">Athuga…</div>';
    const rows = card.querySelector('#_kh-rows');
    rows.innerHTML = '';
    let worst = 'ok';
    for (const c of CHECKS) {
      let status = 'err', detail = '';
      try {
        const r = await c.run();
        status = r.ok ? 'ok' : (r.warn || r.soft ? 'warn' : 'err');
        detail = r.detail || '';
      } catch (e) { detail = 'Villa: ' + (e.message || e); }
      if (status !== 'ok' && worst === 'ok') worst = status;
      if (status === 'err') worst = 'err';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;padding:4px 6px;border-radius:8px;cursor:pointer';
      row.innerHTML = '<span>' + dot(status) + '</span><span style="font-weight:600">' + esc(c.label) + '</span><span style="color:#94a3b8;font-size:12px">' + esc(detail) + '</span>';
      row.addEventListener('mouseenter', () => row.style.background = '#f8fafc');
      row.addEventListener('mouseleave', () => row.style.background = '');
      row.addEventListener('click', () => showFix(c, status, detail));
      rows.appendChild(row);
    }
    card.style.borderLeftColor = worst === 'ok' ? '#10b981' : worst === 'warn' ? '#f59e0b' : '#ef4444';
    if (worst === 'err' && !sessionStorage.getItem('_kh_alerted')) {
      sessionStorage.setItem('_kh_alerted', '1');
      const idx = [...rows.children].findIndex(r => r.textContent.includes('🔴'));
      if (idx >= 0) showFix(CHECKS[idx], 'err', 'Sjálfvirk viðvörun — eitthvað þarfnast athygli.');
    }
  }
  const boot = () => { render(); setInterval(render, 15 * 60 * 1000); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : setTimeout(boot, 1500);
  console.log('[kerfisheilsa] v2 (REST) installed');
})();
