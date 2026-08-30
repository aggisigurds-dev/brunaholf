/**
 * NLSH 8-svæða leftover á Landsspítalinn-flipanum og /nlsh.html.
 * Gögn: GET/POST /api/nlsh-section-progress — teikning, ekki herbergi.
 */
(function () {
  const STATUS = {
    vantar_teikningu: { lab: 'Bíður teikningar', col: '#94a3b8' },
    oskrad: { lab: 'Óskráð áætlun', col: '#94a3b8' },
    ohafid: { lab: 'Óhafið', col: '#e11d48' },
    i_vinnu: { lab: 'Í vinnu', col: '#2563eb' },
    lokid: { lab: 'Lokið', col: '#16a34a' },
  };
  const num = (n) => (n == null ? '—' : Math.round(n).toLocaleString('is-IS'));

  function ensureStyle() {
    if (document.getElementById('nl-sec-style')) return;
    const st = document.createElement('style');
    st.id = 'nl-sec-style';
    st.textContent = `
      .nl-sec-note{font-size:12px;color:var(--text-dim,#5a6473);margin:0 0 10px;max-width:720px;line-height:1.45}
      .nl-sec-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:4px 0 8px}
      @media (max-width:900px){.nl-sec-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      .nl-sec-cell{background:var(--card-bg,#fff);border:1px solid var(--border,#e3e7ec);border-top:3px solid #94a3b8;border-radius:10px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,.05)}
      .nl-sec-h{font-size:13px;font-weight:700;color:var(--text,#1f2933);display:flex;justify-content:space-between;gap:8px;align-items:baseline}
      .nl-sec-st{font-size:10.5px;font-weight:600;letter-spacing:.03em;text-transform:uppercase}
      .nl-sec-row{display:flex;justify-content:space-between;font-size:12.5px;margin-top:4px;color:var(--text,#1f2933)}
      .nl-sec-row b{font-variant-numeric:tabular-nums}
      .nl-sec-in{width:72px;padding:3px 6px;border:1px solid var(--border,#d8dee9);border-radius:6px;font:inherit;font-size:13px;text-align:right}
      .nl-sec-in:focus{outline:none;border-color:#0a84ff}
      .nl-sec-copy{margin-top:8px;padding:5px 8px;border:1px solid var(--border,#d8dee9);background:#fff;border-radius:7px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;width:100%}
      .nl-sec-copy:hover{background:#eef2f7}
      .nl-sec-sub{font-size:10.5px;color:var(--text-dim,#7a8493);margin-top:6px;line-height:1.35}
      .nl-sec-cat{font-size:11.5px;color:var(--text-dim,#5a6473);margin:8px 0 0;max-width:720px;line-height:1.45}
      .nl-sec-save{font-size:11px;color:var(--text-dim,#7a8493);margin:0 0 8px}
      .nl-sec-save.ok{color:#0a8a00}
      .nl-sec-save.err{color:#c40000}
    `;
    document.head.appendChild(st);
  }

  let saveTimer = null;

  async function savePlanned(id, value) {
    const planned = {};
    planned[id] = value === '' ? 0 : Number(value);
    const $st = document.getElementById('nl-sec-save');
    if ($st) { $st.textContent = 'Vistar…'; $st.className = 'nl-sec-save'; }
    try {
      const r = await fetch('/api/nlsh-section-progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planned }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.error) throw new Error(j.error || ('HTTP ' + r.status));
      if ($st) { $st.textContent = 'Vistað'; $st.className = 'nl-sec-save ok'; }
    } catch (e) {
      if ($st) { $st.textContent = 'Vistaði samt ekki: ' + String(e.message || e).slice(0, 80); $st.className = 'nl-sec-save err'; }
    }
  }

  function cellHtml(s) {
    const st = STATUS[s.status] || STATUS.oskrad;
    const sharedDrawings = (s.shared_drawings || []).map((n) => escapeHtml(n)).join(', ');
    const shared = s.shared_from
      ? `Tvíteikning talin á ${escapeHtml(s.shared_from)}${sharedDrawings ? ' (' + sharedDrawings + ')' : ''}.`
      : '';
    const drawings = (s.drawings || []).map((d) => escapeHtml(d.name)).join(', ');
    return `<div class="nl-sec-cell" style="border-top-color:${st.col}" data-sec="${escapeAttr(s.id)}">
      <div class="nl-sec-h"><span>${escapeHtml(s.label)}</span><span class="nl-sec-st" style="color:${st.col}">${escapeHtml(st.lab)}</span></div>
      <div class="nl-sec-row"><span>Áætlað</span><input class="nl-sec-in" type="number" min="0" inputmode="numeric" aria-label="Áætluð göt ${escapeAttr(s.label)}" value="${s.planned || ''}" placeholder="0"></div>
      <div class="nl-sec-row"><span>Lokið (Ajour)</span><b>${num(s.done)}</b></div>
      <div class="nl-sec-row"><span>Eftir</span><b>${num(s.left)}</b></div>
      <button type="button" class="nl-sec-copy" data-copy="${escapeAttr(s.copy)}">Afrita áhöfn</button>
      <div class="nl-sec-sub">${shared}${shared && drawings ? ' ' : ''}${drawings ? escapeHtml(drawings) : ''}</div>
    </div>`;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      window.prompt('Afritaðu:', text);
      return false;
    }
  }

  window.mountNlshSections = async function mountNlshSections() {
    const root = document.getElementById('nl-sections');
    if (!root) return;
    ensureStyle();
    root.innerHTML = '<div class="nl-sec-save">Sækir svæði…</div>';
    let data;
    try {
      const r = await fetch('/api/nlsh-section-progress');
      data = await r.json();
      if (!r.ok || data.error) throw new Error(data.error || ('HTTP ' + r.status));
    } catch (e) {
      root.innerHTML = `<div class="nl-sec-save err">Gat ekki sótt svæði: ${escapeHtml(e.message)}</div>`;
      return;
    }
    const floors = ['4H', '5H'];
    const cat = (data.category || []).filter((c) => c.serials > 0);
    const catLine = cat.length
      ? `<p class="nl-sec-cat">Flokkateikningar teljast ekki með í gataeftirstöðvum: ${cat.map((c) => escapeHtml(c.drawing) + ' (' + num(c.serials) + ')').join(', ')}.</p>`
      : '';
    root.innerHTML = `
      <p class="nl-sec-note">${escapeHtml(data.note || '')} Áætlað vistast strax. Þetta er ekki herbergjastyring og ekki 95% úr Ajour-lista.</p>
      <div class="nl-sec-save" id="nl-sec-save">${data.drawing_backfilled ? '' : 'Áætlað má fylla inn núna. Lokið fyllist við næsta Ajour-innsog.'}</div>
      ${floors.map((f) => `
        <div class="nl-sec-grid">
          ${(data.sections || []).filter((s) => s.floor === f).map(cellHtml).join('')}
        </div>
      `).join('')}
      ${catLine}
    `;
    root.querySelectorAll('.nl-sec-cell').forEach((cell) => {
      const id = cell.getAttribute('data-sec');
      const input = cell.querySelector('.nl-sec-in');
      const btn = cell.querySelector('.nl-sec-copy');
      input.addEventListener('input', () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => savePlanned(id, input.value), 400);
      });
      input.addEventListener('change', () => {
        clearTimeout(saveTimer);
        savePlanned(id, input.value);
      });
      btn.addEventListener('click', async () => {
        const ok = await copyText(btn.getAttribute('data-copy') || '');
        const orig = btn.textContent;
        btn.textContent = ok ? 'Afritað' : orig;
        setTimeout(() => { btn.textContent = orig; }, 1600);
      });
    });
  };
})();
