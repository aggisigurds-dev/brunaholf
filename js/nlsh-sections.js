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
      .nl-fl-wrap{margin:0 0 14px}
      .nl-fl-sum{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin:0 0 10px;font-size:13px;color:var(--text,#1f2933)}
      .nl-fl-sum b{font-size:22px;font-variant-numeric:tabular-nums}
      .nl-fl-sum small{color:var(--text-dim,#5a6473);font-size:11.5px}
      .nl-fl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      @media (max-width:900px){.nl-fl-grid{grid-template-columns:minmax(0,1fr)}}
      .nl-fl{background:var(--card-bg,#fff);border:1px solid var(--border,#e3e7ec);border-radius:10px;padding:10px 12px}
      .nl-fl-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:13px;margin-bottom:8px}
      .nl-fl-h span{font-size:11.5px;color:var(--text-dim,#5a6473);font-variant-numeric:tabular-nums}
      .nl-fl-plan{display:grid;grid-template-columns:1fr 1fr .7fr 1fr 1fr;gap:5px}
      .nl-fl-w{height:84px;border:1.5px solid;border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:11px;font-weight:700;color:#1f2933}
      .nl-fl-w i{font-style:normal;font-size:15px;font-variant-numeric:tabular-nums}
      .nl-fl-mid{background:repeating-linear-gradient(135deg,#f1f3f5,#f1f3f5 5px,#e6e9ed 5px,#e6e9ed 10px);border:1.5px dashed #b6bcc6;color:#7a8493;font-weight:600}
      .nl-fl-cap{display:grid;grid-template-columns:2fr .7fr 2fr;gap:5px;margin-top:6px;font-size:11px;color:var(--text,#1f2933);font-variant-numeric:tabular-nums}
      .nl-fl-cap div{line-height:1.35}
      .nl-fl-cap small{display:block;color:var(--text-dim,#7a8493);font-size:10.5px}
      .nl-fl-leg{display:flex;align-items:center;gap:8px;margin:8px 0 0;font-size:11px;color:var(--text-dim,#5a6473)}
      .nl-fl-leg span.bar{flex:0 0 140px;height:8px;border-radius:4px;background:linear-gradient(90deg,hsl(0 62% 80%),hsl(60 62% 80%),hsl(125 62% 80%))}
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

  // Hæðamynd (30.10.2026): hlutfall búið per tvær stúkur á hverri hæð. Áætlun = reiturinn „Áætlað“ á spjaldinu (4H, 5H) ef
  // hann er fylltur, annars MAT úr kláruðum hæðum: S1+S2 ≈ 2.900 (6H.pdf 2.837, 5H 2.901 — báðar búnar), S4+S5 ≈ 2.500
  // (Brunayfirlit 6H 2.467), 4H aðeins milliloftsþéttingar ≈ 256 per par (128 per væng eins og 5H2S „Fjöldi 128“).
  const FLOOR_EST = { '6H': { a: 2900, b: 2500 }, '5H': { a: 2900, b: 2500 }, '4H': { a: 256, b: 256 } };
  const FLOOR_NAME = { '6H': '6. hæð', '5H': '5. hæð', '4H': '4. hæð' };

  function pairData(data, f) {
    const by = {};
    (data.sections || []).forEach((s) => { by[s.id] = s; });
    const k = f.toLowerCase();
    return [
      { key: 'a', label: 'S1 + S2', s: by[k + '-s1'] },
      { key: 'b', label: 'S4 + S5', s: by[k + '-s4'] },
    ].map((p) => {
      const done = p.s && p.s.done != null ? p.s.done : null;
      const entered = p.s && p.s.planned > 0 ? p.s.planned : 0;
      const total = entered || Math.max(FLOOR_EST[f][p.key], done || 0);
      const pct = done == null ? null : Math.min(100, Math.round((done / total) * 100));
      return { label: p.label, done, total, pct, estimated: !entered };
    });
  }

  function pctColor(p) {
    if (p == null) return { bg: '#e5e7eb', bd: '#9ca3af' };
    const h = Math.round(p * 1.25);
    return { bg: 'hsl(' + h + ' 62% 86%)', bd: 'hsl(' + h + ' 55% 38%)' };
  }

  function floorHtml(data, f) {
    const [a, b] = pairData(data, f);
    const wing = (name, p) => {
      const c = pctColor(p.pct);
      return `<div class="nl-fl-w" style="background:${c.bg};border-color:${c.bd}">${name}<i>${p.pct == null ? '—' : p.pct + '%'}</i></div>`;
    };
    const cap = (p) => `<div><b>${escapeHtml(p.label)}</b> · ${num(p.done)} af ${p.estimated ? '~' : ''}${num(p.total)}<small>${p.estimated ? 'mat' : 'áætlað á spjaldi'}</small></div>`;
    const done = (a.done || 0) + (b.done || 0), total = a.total + b.total;
    return `<div class="nl-fl">
      <div class="nl-fl-h"><b>${FLOOR_NAME[f]}</b><span>${total ? Math.round((done / total) * 100) : 0}% · ${num(done)} af ~${num(total)}</span></div>
      <div class="nl-fl-plan">${wing('S1', a)}${wing('S2', a)}<div class="nl-fl-mid">S3</div>${wing('S4', b)}${wing('S5', b)}</div>
      <div class="nl-fl-cap">${cap(a)}<span></span>${cap(b)}</div>
    </div>`;
  }

  function floorsHtml(data) {
    const floors = ['6H', '5H', '4H'];
    let done = 0, total = 0;
    floors.forEach((f) => pairData(data, f).forEach((p) => { done += p.done || 0; total += p.total; }));
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<div class="nl-fl-wrap">
      <div class="nl-fl-sum"><b>${pct}% lokið</b><span>${num(done)} af ~${num(total)} götum á 4.–6. hæð</span><small>Heildin er mat nema þar sem Áætlað er fyllt inn. Ajour gefur aðeins klárað, ekki það sem á eftir að gera. Stúkurnar eru taldar tvær og tvær því Ajour geymir göt á teikningum sem ná yfir S1+S2 og S4+S5. Ajour skráir stakar lokanir (sín hvorum megin við vegg). Rafmagnsraufar, rafmagnsgöt og fleira á flokkateikningum er ótalið hér.</small></div>
      <div class="nl-fl-grid">${floors.map((f) => floorHtml(data, f)).join('')}</div>
      <div class="nl-fl-leg"><span>0%</span><span class="bar"></span><span>100% búið</span></div>
    </div>`;
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
      ${floorsHtml(data)}
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
