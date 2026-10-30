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
      .nl-fl-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}
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
            .nl-fl-w small{font-size:9.5px;font-weight:500;color:#44505e;font-variant-numeric:tabular-nums}
      .nl-fl-det{margin:12px 0 0}
      .nl-fl-det summary{cursor:pointer;font-size:12.5px;font-weight:700;color:var(--text,#1f2933)}
      .nl-fl-tw{overflow-x:auto;margin-top:8px}
      .nl-fl-t{border-collapse:collapse;font-size:11.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
      .nl-fl-t th,.nl-fl-t td{padding:4px 7px;text-align:right;border-bottom:1px solid var(--border,#e3e7ec)}
      .nl-fl-t th:first-child,.nl-fl-t td:first-child{text-align:left}
      .nl-fl-t thead th{font-size:10.5px;color:var(--text-dim,#5a6473);font-weight:600}
      .nl-um td{text-align:center;min-width:54px;font-weight:600}
      .nl-um td small{display:block;font-weight:500;font-size:9.5px;color:#44505e}
      .nl-um td.nl-um-na{color:#a0a8b4;font-weight:400}
      .nl-um .nl-um-sum td,.nl-um tfoot td{border-top:2px solid var(--border,#cfd5de);background:transparent}
      .nl-fl-w{height:auto!important;min-height:84px;padding:6px 3px}
      .nl-fl-zs{display:flex;flex-direction:column;gap:2px;width:100%;margin-top:4px;padding:0 2px}
      .nl-fl-z{display:block;border-radius:3px;padding:1px 3px;font-size:9.5px;font-weight:600;text-align:center;color:#1f2933;font-variant-numeric:tabular-nums}
      .nl-fl-svg{display:block;width:100%;height:auto;color:var(--text,#1f2933)}
      .nl-kort-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:8px 0;font-size:12px}
      .nl-kort-sp{flex:1}
      .nl-kort-b{border:1px solid var(--border,#cfd5de);background:var(--card-bg,#fff);color:inherit;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer}
      .nl-kort-b.on{background:#1f2933;color:#fff;border-color:#1f2933}
      .nl-kort-c{display:inline-flex;align-items:center;gap:5px;cursor:pointer}
      .nl-kort-c i{width:10px;height:10px;border-radius:50%;display:inline-block}
      .nl-kort-n{margin-left:auto;color:var(--text-dim,#5a6473);font-variant-numeric:tabular-nums}
      .nl-kort-map{position:relative;line-height:0;border:1px solid var(--border,#e3e7ec);border-radius:8px;overflow:hidden;background:#fff}
      .nl-kort-map img{width:100%;height:auto;display:block}
      .nl-kort-ov{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none}
      .nl-kort-notch{position:absolute;transform:translate(-50%,-50%);background:rgba(255,255,255,.93);border:1px solid #b6bcc6;border-radius:5px;padding:2px 4px;font-size:9.5px;line-height:1.25;color:#1f2933;font-variant-numeric:tabular-nums;text-align:center}
      .nl-kort-notch b{display:block;font-size:10px}
      .nl-kort-notch table{border-collapse:collapse;width:100%}
      .nl-kort-notch th{font-weight:700;color:#5a6473}
      .nl-kort-notch td{padding:0 2px;text-align:right}
      .nl-kort-notch td:first-child{text-align:left;color:#44505e}
      .nl-kort-notch tr.t td,.nl-kort-notch tr.p td{border-top:1px solid #cfd5de;font-weight:700}
      .nl-kort-map canvas{position:absolute;left:0;top:0;width:100%;height:100%}
      .nl-fl-leg{display:flex;align-items:center;gap:8px;margin:8px 0 0;font-size:11px;color:var(--text-dim,#5a6473)}
      .nl-fl-leg span.bar{flex:0 0 140px;height:8px;border-radius:4px;background:linear-gradient(90deg,hsl(0 62% 80%),hsl(60 62% 80%),hsl(125 62% 80%))}
      /* ===== fagleg útlit 30.10.2026: dökkt höfuðspjald, númeruð spjöld, rjómapappír ===== */
.nl-fl-wrap{counter-reset:nlsec;--nl-ink:#161513;--nl-line:#e2ddd0;--nl-paper:#faf8f4;--nl-gold:#c9a54a;--nl-mute:#6f685c;color:var(--nl-ink)}
      .nl-hero{position:relative;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(200px,.9fr) minmax(0,1.6fr);gap:16px 36px;align-items:center;padding:22px 28px;border-radius:14px;color:#f4f1ea;background:linear-gradient(160deg,#1f1e1b,#0f0f0e);border:1px solid #3a3732;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 10px 28px rgba(10,10,9,.22)}
      .nl-hero::before{content:'';position:absolute;left:14px;right:14px;top:0;height:2px;border-radius:0 0 2px 2px;background:linear-gradient(90deg,#8f6a1c,#f5d76e 45%,#b8892e)}
      .nl-kick{display:block;font:500 10.5px/1.2 'IBM Plex Mono',ui-monospace,Menlo,monospace;letter-spacing:.14em;color:#d9b25a}
      .nl-hero h2{margin:6px 0 4px;font:800 26px/1.1 'Playfair Display',Georgia,serif;letter-spacing:-.015em;color:#fff}
      .nl-hero-sub{margin:0;font-size:12px;color:#c8c1b1}
      .nl-hero-pct{display:grid;grid-template-columns:auto 1fr;align-items:baseline;column-gap:10px}
      .nl-hero-pct b{font:800 56px/1 'Playfair Display',Georgia,serif;color:#fff;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
      .nl-hero-pct span{font-size:13px;color:#c8c1b1}
      .nl-hero-pct .nl-bar{grid-column:1/-1;margin-top:10px}
      .nl-bar{height:8px;border-radius:5px;background:#2e2c27;overflow:hidden}
      .nl-bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#b8892e,#f5d76e 60%,#c9a54a)}
      .nl-bar.sm{height:5px;background:#ece7dc;grid-column:1/-1;margin-top:8px}
      .nl-hero-k{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0}
      .nl-hero-k>div{padding-left:16px;border-left:1px solid #3a3732}
      .nl-hero-k dt{font:500 10px 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#a8a08f}
      .nl-hero-k dd{margin:5px 0 0;font:800 26px/1 'Playfair Display',Georgia,serif;color:#fff;font-variant-numeric:tabular-nums}
      @media (max-width:980px){.nl-hero{grid-template-columns:minmax(0,1fr);padding:18px}.nl-hero-k dd{font-size:21px}}
      .nl-note{margin:10px 2px 14px;font-size:11.5px;line-height:1.5;color:var(--nl-mute);max-width:900px}
      .nl-fl{background:#fff;border:1px solid var(--nl-line);border-radius:14px;padding:16px 18px 12px;box-shadow:0 1px 2px rgba(22,21,19,.05),0 4px 14px rgba(22,21,19,.04)}
      .nl-fl-h{display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:0 12px;margin-bottom:10px}
      .nl-fl-h b{font:700 19px 'Playfair Display',Georgia,serif;letter-spacing:-.01em}
      .nl-fl-pill{font:600 12px 'IBM Plex Mono',ui-monospace,monospace;padding:3px 9px;border-radius:20px;background:#161513;color:#f5d76e}
      .nl-fl-h .nl-fl-cnt{justify-self:end;font:500 11.5px 'IBM Plex Mono',ui-monospace,monospace;color:var(--nl-mute)}
      .nl-fl-grid{gap:16px!important}
      .nl-fl-leg{margin:12px 2px 0!important;flex-wrap:wrap;color:var(--nl-mute)!important}
      .nl-fl-det{margin:18px 0 0!important;background:#fff;border:1px solid var(--nl-line);border-radius:14px;overflow:hidden;counter-increment:nlsec;box-shadow:0 1px 2px rgba(22,21,19,.05)}
      .nl-fl-det>summary{list-style:none;display:flex;align-items:center;gap:12px;padding:13px 18px;background:var(--nl-paper);font:700 15.5px 'Playfair Display',Georgia,serif;color:var(--nl-ink);cursor:pointer;user-select:none}
      .nl-fl-det>summary::-webkit-details-marker{display:none}
      .nl-fl-det>summary::before{content:counter(nlsec,decimal-leading-zero);font:600 11px 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.06em;color:#3e2c06;padding:3px 8px;border-radius:5px;background:linear-gradient(180deg,#f5d76e,#c9a54a);box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
      .nl-fl-det>summary::after{content:'▾';margin-left:auto;color:#8f8776;font-size:12px}
      .nl-fl-det:not([open])>summary::after{content:'▸'}
      .nl-fl-det[open]>summary{border-bottom:1px solid var(--nl-line)}
      .nl-fl-det>:not(summary){margin-left:18px!important;margin-right:18px!important}
      .nl-fl-det>:last-child{margin-bottom:16px!important}
      .nl-fl-tw{margin-top:14px!important}
      .nl-fl-t{width:100%;max-width:1180px;font-size:12px}
      .nl-fl-svg{max-width:1240px;margin:0 auto}
      .nl-fl-t thead th{position:sticky;top:0;background:var(--nl-paper);font:500 10px 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--nl-mute);padding:8px 9px;border-bottom:1px solid var(--nl-line)}
      .nl-fl-t td{padding:7px 9px;border-bottom:1px solid #efebe1}
      .nl-fl-t tbody tr:hover td{filter:brightness(.97)}
      .nl-fl-t td:first-child{font-weight:700}
      .nl-fl-t .nl-um-sum td,.nl-fl-t tfoot td{background:var(--nl-paper)!important;border-top:2px solid var(--nl-line)}
      .nl-sec-cat{color:var(--nl-mute)!important;max-width:980px!important}
      .nl-kort-bar{gap:8px 10px!important;margin:14px 0 10px!important}
      .nl-kort-b{border:1px solid #cfc8b9!important;background:#fff!important;border-radius:8px!important;padding:6px 14px!important;font:600 12px -apple-system,'Segoe UI',Roboto,sans-serif!important;color:var(--nl-ink)!important;box-shadow:0 1px 0 rgba(22,21,19,.06)}
      .nl-kort-b:hover{background:var(--nl-paper)!important}
      .nl-kort-b.on{background:#161513!important;color:#f5d76e!important;border-color:#161513!important}
      .nl-kort-c{border:1px solid var(--nl-line);background:#fff;border-radius:20px;padding:4px 11px 4px 9px;font-size:12px}
      .nl-kort-c small{color:var(--nl-mute);font-family:'IBM Plex Mono',ui-monospace,monospace}
      .nl-kort-n{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11.5px!important}
      .nl-kort-map{border:1px solid #cfc8b9!important;border-radius:12px!important;box-shadow:0 2px 10px rgba(22,21,19,.08)}
      .nl-kort-notch{border-color:#cfc8b9!important;border-radius:7px!important;box-shadow:0 2px 8px rgba(22,21,19,.14);font-size:min(10.5px,.8vw)}
      .nl-kort-notch b{font-family:'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;font-size:9px!important;color:#8f6a1c}
      .nl-sec-note{color:var(--nl-mute)}
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

  function floorsHtmlPar(data) {
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

  // Stúkur hver fyrir sig (30.10.2026): data/nlsh-stukur.json er búið til af tools/nlsh-stukur.cjs úr HNITUM Ajour (hver
  // skráning ber x,y á teikningunni og atríum-bilið skilur vængina að). Markmið per væng = mat úr kláruðum vængjum:
  // venjuleg göt úr 6H (búin), gólfgöt (milliloft) 230 per væng á 4H og 5H (5H S1+S2 = 460). 6H á ekki gólfgöt.
  const WING_BASE = { S1: 1250, S2: 1260, S4: 1200, S5: 1280 };
  const WING_GOLF = 230;
  const WINGS = ['S1', 'S2', 'S4', 'S5'];
  const CLS = [
    ['Stál Ø15-35 LV', 'Stál 15-35'], ['Stál Ø40-50 LV', 'Stál 40-50'], ['Stál Ø75-110 LV (1)', 'Stál 75-110'], ['Stál Ø110-160 LV', 'Stál 110-160'],
    ['Plast Ø20-34 Lv', 'Plast 20-34'], ['Plast Ø35-50 LV (1)', 'Plast 35-50'], ['Loft Ø125-160 LV', 'Loft 125-160'], ['Loft Ø200-315 LV', 'Loft 200-315'],
    ['Loft Ø400-630 LV', 'Loft 400-630'], ['Gólf Ø 160-200', 'Gólf 160-200'], ['Raflagnaþéttingar, göt og raufar', 'Rafþétt.'], ['Raufar. (Metrer) LV', 'Raufar'],
  ];
  const fmtD = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); };

  // Markmið per flokk: 5H = sami flokkur á sama væng á 6H (hún er búin); gólfgöt (milliloft) = 5H S1/S2 eigin tala, 230 á S4/S5,
  // sama á 4H sem hefur aðeins gólfgöt; 6H = það sem er klárað. Hver flokkur er „umferð“ sem getur verið óhafin á væng.
  const GOLF_CLS = 'Gólf Ø 160-200';
  // Rafmagn (6H á 285 rafþéttingar og raufar, 5H ekki skráð) er utan markmiða — sjá athugasemd á síðunni.
  const RAF_CLS = ['Raflagnaþéttingar, göt og raufar', 'Raufar. (Metrer) LV', 'Raf raufar. (Metrar og Stk.)', 'Raf göt (Stk.)'];
  const GOLF_TGT = { S1: 200, S2: 200, S4: 200, S5: 200 }; // Agnar 30.10: ~100 milliloftsgöt á stúku = ~200 stakar lokanir
  function classTarget(stukur, f, w, c) {
    if (RAF_CLS.indexOf(c) >= 0) return 0;
    if (c === GOLF_CLS) return f === '6H' ? 0 : GOLF_TGT[w];
    if (f === '4H') return 0;
    if (f === '6H') return null;
    const ref = stukur.wings['6H ' + w];
    return ref ? (ref.cat[c] || 0) : 0;
  }
  function wingTarget(stukur, f, w) {
    const d = stukur.wings[f + ' ' + w] || { done: 0, cat: {} };
    if (f === '6H') return d.done;
    let tgt = 0, cd = 0;
    CLS.forEach(([c]) => { tgt += classTarget(stukur, f, w, c) || 0; cd += d.cat[c] || 0; });
    return Math.max(d.done, tgt + (d.done - cd));
  }

  // Norður / Center / Suður (skipting verktaka á hverri stúku): sjá tools/nlsh-stukur.cjs — brýrnar milli stúkna sjást sem dýfa í
  // y-hnitum. Markmið svæðis: 5H = sama svæði á sama væng á 6H án gólfgata, auk gólfgata (markmið væng skipt eftir hlut svæðis í
  // gólfgötum 5H S1+S2); 4H = aðeins gólfgöt; 6H = það sem er klárað.
  const ZONES = [['N', 'Norður'], ['C', 'Center'], ['S', 'Suður']];
  function zoneOf(stukur, f, w, z) {
    const d = stukur.wings[f + ' ' + w];
    return d && d.z && d.z[z] ? d.z[z] : { done: 0, open: 0, cat: {} };
  }
  function zoneTarget(stukur, f, w, z) {
    const zd = zoneOf(stukur, f, w, z);
    if (f === '6H') return zd.done;
    let t = 0;
    if (f === '5H') { const ref = zoneOf(stukur, '6H', w, z); t += ref.done - (ref.cat[GOLF_CLS] || 0) - RAF_CLS.reduce((x, c) => x + (ref.cat[c] || 0), 0); }
    const g = { N: 0, C: 0, S: 0 };
    ['S1', 'S2'].forEach((x) => ZONES.forEach(([k]) => { g[k] += zoneOf(stukur, '5H', x, k).cat[GOLF_CLS] || 0; }));
    const gs = g.N + g.C + g.S;
    if (gs) t += (GOLF_TGT[w] * g[z]) / gs;
    return Math.max(zd.done, Math.round(t));
  }
  function zoneTable(stukur) {
    const rows = [];
    ['6H', '5H', '4H'].forEach((f) => WINGS.forEach((w) => {
      const cells = ZONES.map(([k]) => {
        const zd = zoneOf(stukur, f, w, k), t = zoneTarget(stukur, f, w, k);
        const pct = t ? Math.min(100, Math.round((zd.done / t) * 100)) : 0;
        const c = pctColor(pct);
        return `<td style="background:${c.bg}">${pct}%<small>${num(zd.done)} / ~${num(t)}${zd.open ? ' · ' + num(zd.open) + ' opin' : ''}</small></td>`;
      });
      rows.push(`<tr><td><b>${f} ${w}</b></td>${cells.join('')}</tr>`);
    }));
    return `<details class="nl-fl-det" open><summary>Norður · Center · Suður á hverri stúku (skipting verktaka)</summary>
      <div class="nl-fl-tw"><table class="nl-fl-t nl-um"><thead><tr><th>Stúka</th>${ZONES.map((z) => `<th>${z[1]}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>
      <p class="nl-sec-cat">Svæðin eru fundin úr y-hnitum gata á teikningunni (brýrnar milli stúkna). Þetta er nálgun við litamerkingu verktaka (grænt norður, blátt center, rautt suður), ekki nákvæm lína. Markmið eru mat eins og annars staðar.</p>
    </details>`;
  }

  // Grunnmynd í sama formi og teikning verktaka: stúkur S1 S2 | S3 (atríum) | S4 S5, hver vængur skiptur í norður (efst),
  // center og suður (neðst), brýr milli stúkna á mörkum svæða. Hvert svæði litað eftir hlutfalli af markmiði.
  function planSvg(stukur, f, cells) {
    const X = { S1: 10, S2: 180, S4: 510, S5: 680 }, W = 130, TOP = 32, H = [146, 164, 146];
    const Y = [TOP, TOP + H[0], TOP + H[0] + H[1]], BOT = TOP + H[0] + H[1] + H[2];
    const brun = '#d6c4cf';
    // Flokkahópar í hverju svæði: loftræsting, stál (vatnslagnir), rafmagn, annað (plast, gólf o.fl.)
    const grp = (zd) => {
      const sum = (fn) => Object.keys(zd.cat || {}).reduce((a, k) => a + (fn(k) ? zd.cat[k] : 0), 0);
      const loft = sum((k) => /^Loft/i.test(k)), stal = sum((k) => /^Stál/i.test(k)), raf = sum((k) => RAF_CLS.indexOf(k) >= 0);
      const golf = zd.cat[GOLF_CLS] || 0;
      return [['Loft', loft], ['Stál', stal], ['Rafmagn', raf], ['Gólf', golf], ['Annað', Math.max(0, zd.done - loft - stal - raf - golf)]];
    };
    let g = `<rect x="330" y="${TOP}" width="160" height="${BOT - TOP}" rx="3" fill="url(#nl-hatch)" stroke="#b6bcc6" stroke-dasharray="4 3"/><text x="410" y="${TOP + (BOT - TOP) / 2 + 6}" text-anchor="middle" font-size="20" font-weight="700" fill="#7a8493">S3</text>`;
    [[X.S1 + W, X.S2], [X.S4 + W, X.S5]].forEach((b2) => [Y[1], Y[2]].forEach((y) => { g += `<rect x="${b2[0]}" y="${y - 9}" width="${b2[1] - b2[0]}" height="18" fill="${brun}" stroke="#a98fa0" stroke-width=".8"/>`; }));
    g += `<rect x="${X.S2 + W}" y="${Y[2] - 6}" width="${X.S4 - X.S2 - W}" height="12" fill="${brun}" stroke="#a98fa0" stroke-width=".8"/>`;
    cells.forEach((x) => {
      const w = x.w;
      ZONES.forEach(([k, lab], zi) => {
        const zd = zoneOf(stukur, f, w, k), t = zoneTarget(stukur, f, w, k);
        const pz = t ? Math.min(100, Math.round((zd.done / t) * 100)) : 0;
        const cz = pctColor(pz), x0 = X[w], y0 = Y[zi], cx = x0 + W / 2;
        const lines = grp(zd).map((r, ri) => `<text x="${x0 + 12}" y="${y0 + 80 + ri * 14}" font-size="11" fill="#44505e">${r[0]}</text><text x="${x0 + W - 12}" y="${y0 + 80 + ri * 14}" text-anchor="end" font-size="11.5" font-weight="700" fill="#1f2933">${num(r[1])}</text>`).join('');
        g += `<g><title>${f} ${w} ${lab}: ${num(zd.done)} af ~${num(t)} (${pz}%)${zd.open ? ', ' + num(zd.open) + ' opin' : ''}</title><rect x="${x0}" y="${y0}" width="${W}" height="${H[zi]}" fill="${cz.bg}" stroke="${cz.bd}" stroke-width="1.4"/><text x="${cx}" y="${y0 + 17}" text-anchor="middle" font-size="11.5" fill="#44505e">${lab}</text><text x="${cx}" y="${y0 + 40}" text-anchor="middle" font-size="22" font-weight="700" fill="#1f2933">${pz}%</text><text x="${cx}" y="${y0 + 58}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#1f2933">${num(zd.done)} / ~${num(t)}</text>${lines}</g>`;
      });
      g += `<text x="${X[w] + W / 2}" y="${TOP - 10}" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor">${w} · ${x.pct}%</text>`;
      g += `<text x="${X[w] + W / 2}" y="${BOT + 17}" text-anchor="middle" font-size="12" fill="currentColor" opacity=".75">${num(x.d.done)} / ~${num(x.total)}</text>`;
    });
    return `<svg class="nl-fl-svg" viewBox="0 0 820 ${BOT + 26}" role="img" aria-label="${FLOOR_NAME[f]}: hlutfall og fjöldi gata per stúku og svæði"><defs><pattern id="nl-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#f1f3f5"/><rect width="4" height="8" fill="#e6e9ed"/></pattern></defs>${g}</svg>`;
  }

  function floorWingsHtml(stukur, f) {
    const cells = WINGS.map((w) => {
      const d = stukur.wings[f + ' ' + w] || { done: 0, open: 0 };
      const total = wingTarget(stukur, f, w);
      const pct = Math.min(100, Math.round((d.done / total) * 100));
      const c = pctColor(pct);
      return { w, d, total, pct, c };
    });
    const done = cells.reduce((a, x) => a + x.d.done, 0), total = cells.reduce((a, x) => a + x.total, 0);
    return { done, total, html: `<div class="nl-fl">
      <div class="nl-fl-h"><b>${FLOOR_NAME[f]}</b><span class="nl-fl-pill">${total ? Math.round((done / total) * 100) : 0}%</span><span class="nl-fl-cnt">${num(done)} af ~${num(total)} götum</span><div class="nl-bar sm"><i style="width:${total ? Math.min(100, Math.round((done / total) * 100)) : 0}%"></i></div></div>
      ${planSvg(stukur, f, cells)}
    </div>` };
  }

  function stukurTable(stukur) {
    const rows = [];
    ['6H', '5H', '4H'].forEach((f) => WINGS.forEach((w) => {
      const d = stukur.wings[f + ' ' + w] || { done: 0, open: 0, cat: {} };
      const known = CLS.reduce((a, c) => a + (d.cat[c[0]] || 0), 0);
      const total = wingTarget(stukur, f, w);
      rows.push(`<tr><td><b>${f} ${w}</b></td>${CLS.map((c) => `<td>${d.cat[c[0]] ? num(d.cat[c[0]]) : '·'}</td>`).join('')}<td>${d.done - known ? num(d.done - known) : '·'}</td><td><b>${num(d.done)}</b></td><td>${d.open ? num(d.open) : '·'}</td><td>~${num(Math.max(0, total - d.done))}</td></tr>`);
    }));
    return `<details class="nl-fl-det"><summary>Sundurliðun á hverja stúku og flokk</summary>
      <div class="nl-fl-tw"><table class="nl-fl-t"><thead><tr><th>Stúka</th>${CLS.map((c) => `<th>${escapeHtml(c[1])}</th>`).join('')}<th>Annað</th><th>Klárað</th><th>Opið</th><th>Eftir (mat)</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
      <p class="nl-sec-cat">Staða ${fmtD(stukur.updated)} úr hnitum Ajour (${num(stukur.done)} klárað og ${num(stukur.open)} opið alls; flokkateikningar og „Viðbótarverkefni“ eru utan stúkna). „Eftir“ er mat: markmið væng mínus klárað. Gólf Ø160-200 er milliloft og er mest ógert á 4H og 5H S4+S5. Skipting á eftir að keyra aftur með <code>node tools/nlsh-stukur.cjs</code>.</p>
    </details>`;
  }

  // Umferðir: hlutfall af markmiði per flokk á hverja stúku (5H og 4H). Rauðir reitir = umferðin er óhafin eða á byrjunarreit.
  function umferdirTable(stukur) {
    const cls = CLS.filter((c) => c[0] !== 'Raflagnaþéttingar, göt og raufar' && c[0] !== 'Raufar. (Metrer) LV');
    let rem = 0;
    const perC = {};
    const rows = [];
    ['6H', '5H', '4H'].forEach((f) => WINGS.forEach((w) => {
      const d = stukur.wings[f + ' ' + w] || { done: 0, cat: {} };
      if (f === '6H') {
        const c6 = cls.map(([c]) => { const n = d.cat[c] || 0; return n ? `<td style="background:#c3f0c8">${num(n)}</td>` : '<td class="nl-um-na">—</td>'; });
        rows.push(`<tr><td><b>${f} ${w}</b></td>${c6.join('')}<td>búið</td></tr>`);
        return;
      }
      let left = 0;
      const cells = cls.map(([c]) => {
        const t = classTarget(stukur, f, w, c);
        if (!t) return '<td class="nl-um-na">—</td>';
        const n = d.cat[c] || 0;
        const pct = Math.round((n / t) * 100);
        const l = Math.max(0, t - n);
        left += l; perC[c] = (perC[c] || 0) + l;
        const col = pctColor(Math.min(100, pct));
        return `<td style="background:${col.bg}" title="${f} ${w} · ${escapeHtml(c)}: ${num(n)} af ~${num(t)}">${pct > 100 ? '100%+' : pct + '%'}<small>${num(n)} / ~${num(t)}</small><small>${l ? '−' + num(l) : '✓'}</small></td>`;
      });
      rem += left;
      rows.push(`<tr><td><b>${f} ${w}</b></td>${cells.join('')}<td><b>${num(left)}</b></td></tr>`);
    }));
    const foot = `<tr class="nl-um-sum"><td><b>Eftir</b></td>${cls.map(([c]) => `<td>${perC[c] ? num(perC[c]) : '·'}</td>`).join('')}<td><b>${num(rem)}</b></td></tr>`;
    return `<details class="nl-fl-det" open><summary>Umferðir: hlutfall af markmiði á hverja stúku og flokk</summary>
      <div class="nl-fl-tw"><table class="nl-fl-t nl-um"><thead><tr><th>Stúka</th>${cls.map((c) => `<th>${escapeHtml(c[1])}</th>`).join('')}<th>Eftir</th></tr></thead><tbody>${rows.join('')}</tbody><tfoot>${foot}</tfoot></table></div>
      <p class="nl-sec-cat">Markmið = sami flokkur á sama væng á 6H (hún er búin). Gólf Ø160-200 (milliloft) á 4H og 5H: um 100 göt á stúku (Agnar) = ~200 stakar lokanir; 6H hefur engin gólfgöt í markmiði. Lítil tala í reit er stærðin sem eftir er. Samtals eftir um <b>${num(rem)}</b> göt (án rafmagnsraufa). Gólfgöt eru ${perC[GOLF_CLS] ? Math.round((perC[GOLF_CLS] / rem) * 100) : 0}% af því.</p>
    </details>`;
  }

  // Punktakort (30.10.2026): hver Ajour-skráning sem punktur á Brunayfirlit 5H/6H (A285-31/A286-31 Rev.A). Hnitin eru pöruð við rauða
  // brunaveggi blaðsins í tools/nlsh-stukur.cjs → data/nlsh-punktar.json; myndirnar eru img/nlsh-yfirlit-5h|6h.jpg (útskorið).
  const KORT_LITIR = ['#2563eb', '#d97706', '#9333ea', '#0f766e', '#6b7280'];
  function kortHtml() {
    return `<details class="nl-fl-det" open><summary>Kort: hvert gat sem punktur á teikningunni</summary>
      <div id="nl-kort" class="nl-kort"><div class="nl-sec-save">Sækir punkta…</div></div>
    </details>`;
  }
  async function mountKort(root, stukur) {
    const box = root.querySelector('#nl-kort');
    if (!box) return;
    let pk;
    try { const r = await fetch('/data/nlsh-punktar.json?v=' + Date.now()); if (!r.ok) throw new Error('HTTP ' + r.status); pk = await r.json(); }
    catch (e) { box.innerHTML = '<div class="nl-sec-save err">Gat ekki sótt punkta: ' + escapeHtml(e.message) + '</div>'; return; }
    const st = { floor: '6H', stada: 'allt', hopar: pk.hopar.map(() => true), hue: true, tafla: true };
    const ZK = ['N', 'C', 'S'], ZN = ['Norður', 'Center', 'Suður'];
    const grpOf = (c) => (/^Loft/i.test(c) ? 0 : /^Stál/i.test(c) ? 1 : RAF_CLS.indexOf(c) >= 0 ? 2 : /^Gólf/i.test(c) ? 3 : 4);
    const catGrp = (cat) => { const g = [0, 0, 0, 0, 0]; Object.keys(cat || {}).forEach((c) => { g[grpOf(c)] += cat[c]; }); return g; };
    // markmið hóps á svæði: 5H = sami flokkur á sama svæði á 6H; milliloft = hlutur svæðis í markmiði væng; rafmagn utan markmiða
    const golfShare = () => { const g = [0, 0, 0]; ['S1', 'S2'].forEach((x) => ZK.forEach((k, zi) => { g[zi] += zoneOf(stukur, '5H', x, k).cat[GOLF_CLS] || 0; })); const t = g[0] + g[1] + g[2]; return g.map((x) => (t ? x / t : 0)); };
    const target = (f, w, zi) => {
      const zd = zoneOf(stukur, f, w, ZK[zi]);
      if (f === '6H') return catGrp(zd.cat);
      const z6 = zoneOf(stukur, '6H', w, ZK[zi]), ref = catGrp(z6.cat);
      return [ref[0], ref[1], 0, Math.round(GOLF_TGT[w] * golfShare()[zi]), ref[4]];
    };
    const geom = (f) => {
      const pts = pk.floors[f] || [], out = {};
      [[1, 2], [4, 5]].forEach((pr) => {
        const a = pts.filter((q) => pr.indexOf(q[4]) >= 0);
        if (!a.length) return;
        const xs = a.map((q) => q[0]).sort((p, q) => p - q), ys = a.map((q) => q[1]);
        let gi = 1, gm = 0; for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > gm) { gm = xs[i] - xs[i - 1]; gi = i; }
        const ymn = Math.min(...ys) - 10, ymx = Math.max(...ys) + 10, mid = (xs[gi - 1] + xs[gi]) / 2;
        out[pr[0]] = { x0: xs[0] - 10, x1: xs[gi - 1] + 10 }; out[pr[1]] = { x0: xs[gi] - 10, x1: xs[xs.length - 1] + 10 };
        out['n' + pr[0]] = { mid, gap: gm, ymn, ymx, l: pr[0], r: pr[1] };
      });
      return out;
    };
    const sel = () => pk.hopar.map((_, i) => st.hopar[i]);
    const band = (g, zi) => { const h = g.ymx - g.ymn; return [g.ymn + [0, 0.275, 0.725][zi] * h, g.ymn + [0.275, 0.725, 1][zi] * h]; };
    const pctOf = (f, w, zi) => {
      const zd = zoneOf(stukur, f, w, ZK[zi]), d = catGrp(zd.cat), t = target(f, w, zi), s = sel();
      let dn = 0, tg = 0; s.forEach((on, i) => { if (on) { dn += d[i]; tg += t[i]; } });
      return tg > 0 ? Math.min(1, dn / tg) : null;
    };
    const draw = () => {
      const pts = pk.floors[st.floor] || [];
      const cnv = box.querySelector('canvas'), img = box.querySelector('img');
      const W = img.clientWidth || 900, k = W / pk.w, G = geom(st.floor);
      cnv.width = Math.round(W); cnv.height = Math.round(pk.h * k);
      const cx = cnv.getContext('2d'); cx.clearRect(0, 0, cnv.width, cnv.height);
      if (st.hue) [1, 2, 4, 5].forEach((s5) => {
        const g = G[s5], pr = G['n' + (s5 < 3 ? 1 : 4)]; if (!g || !pr) return;
        for (let zi = 0; zi < 3; zi++) {
          const p = pctOf(st.floor, 'S' + s5, zi); if (p == null) continue;
          const b = band(pr, zi);
          cx.fillStyle = 'hsla(' + Math.round(p * 125) + ',78%,50%,0.10)';
          cx.fillRect(g.x0 * k, b[0] * k, (g.x1 - g.x0) * k, (b[1] - b[0]) * k);
        }
      });
      let n = 0;
      pts.forEach((q) => {
        if (!st.hopar[q[3]]) return;
        if (st.stada === 'klarad' && !q[2]) return;
        if (st.stada === 'opid' && q[2]) return;
        n++;
        cx.beginPath(); cx.arc(q[0] * k, q[1] * k, q[2] ? 3.2 : 5, 0, 6.2832);
        if (q[2]) { cx.fillStyle = KORT_LITIR[q[3]] + 'b8'; cx.fill(); } else { cx.fillStyle = '#ffffffcc'; cx.fill(); cx.lineWidth = 2; cx.strokeStyle = '#dc2626'; cx.stroke(); }
      });
      box.querySelector('.nl-kort-n').textContent = num(n) + ' punktar sýndir';
      // samantekt í skörðunum milli stúkna: hver H hefur norður-, center- og suðurskarð
      const ov = box.querySelector('.nl-kort-ov'); ov.innerHTML = '';
      if (!st.tafla) return;
      const s = sel();
      [1, 4].forEach((l) => {
        const pr = G['n' + l]; if (!pr) return;
        for (let zi = 0; zi < 3; zi++) {
          const rows = [], b = band(pr, zi), cy = (b[0] + b[1]) / 2;
          const col = (w) => {
            const zd = zoneOf(stukur, st.floor, 'S' + w, ZK[zi]), d = catGrp(zd.cat);
            const open = [0, 0, 0, 0, 0]; (pk.floors[st.floor] || []).forEach((q) => { if (q[4] === w && q[5] === zi && !q[2]) open[q[3]]++; });
            return d.map((x, i) => (st.stada === 'klarad' ? x : st.stada === 'opid' ? open[i] : x + open[i]));
          };
          const cl = col(pr.l), cr = col(pr.r), pl = pctOf(st.floor, 'S' + pr.l, zi), pr2 = pctOf(st.floor, 'S' + pr.r, zi);
          pk.hopar.forEach((h, i) => { if (s[i]) rows.push('<tr><td>' + h + '</td><td>' + num(cl[i]) + '</td><td>' + num(cr[i]) + '</td></tr>'); });
          const sum = (c) => c.reduce((a, x, i) => a + (s[i] ? x : 0), 0);
          const el = document.createElement('div');
          el.className = 'nl-kort-notch';
          el.style.left = (pr.mid * k) + 'px'; el.style.top = (cy * k) + 'px';
          el.innerHTML = '<b>' + ZN[zi] + '</b><table><tr><th></th><th>S' + pr.l + '</th><th>S' + pr.r + '</th></tr>' + rows.join('') + '<tr class="t"><td>Σ</td><td>' + num(sum(cl)) + '</td><td>' + num(sum(cr)) + '</td></tr><tr class="p"><td>%</td><td>' + (pl == null ? '–' : Math.round(pl * 100)) + '</td><td>' + (pr2 == null ? '–' : Math.round(pr2 * 100)) + '</td></tr></table>';
          ov.appendChild(el);
        }
      });
    };
    const cnt = (f) => { const c = pk.hopar.map(() => 0); (pk.floors[f] || []).forEach((q) => { c[q[3]]++; }); return c; };
    const render = () => {
      const c = cnt(st.floor);
      box.innerHTML = `<div class="nl-kort-bar">
        ${['6H', '5H'].map((f) => `<button type="button" class="nl-kort-b${st.floor === f ? ' on' : ''}" data-fl="${f}">${f === '6H' ? '6. hæð' : '5. hæð'}</button>`).join('')}
        <span class="nl-kort-sp"></span>
        ${[['allt', 'Allt'], ['klarad', 'Klárað'], ['opid', 'Opið']].map((x) => `<button type="button" class="nl-kort-b${st.stada === x[0] ? ' on' : ''}" data-st="${x[0]}">${x[1]}</button>`).join('')}
      </div>
      <div class="nl-kort-bar">${pk.hopar.map((h, i) => `<label class="nl-kort-c"><input type="checkbox" data-h="${i}" ${st.hopar[i] ? 'checked' : ''}><i style="background:${KORT_LITIR[i]}"></i>${h} <small>${num(c[i])}</small></label>`).join('')}
        <label class="nl-kort-c"><input type="checkbox" data-o="hue" ${st.hue ? 'checked' : ''}>Litur</label><label class="nl-kort-c"><input type="checkbox" data-o="tafla" ${st.tafla ? 'checked' : ''}>Samantekt</label><span class="nl-kort-n"></span></div>
      <div class="nl-kort-map"><img src="/img/nlsh-yfirlit-${st.floor.toLowerCase()}.jpg" alt="Brunayfirlit ${st.floor}"><canvas></canvas><div class="nl-kort-ov"></div></div>
      <p class="nl-sec-cat">Punktur = staðurinn sem var smellt á í Ajour. Fylltur punktur er klárað, rauður hringur er opið. Liturinn yfir svæði sýnir hlutfall af markmiði (rautt lítið, grænt mikið) og fylgir völdum flokkum. Samantektin í skörðunum er fjöldi gata á stúku og svæði, líka eftir völdum flokkum og stöðu. Staðsetning er sjálfvirk pörun við brunaveggi blaðsins og getur skeikað um nokkra metra. Blaðið er Rev.A; staða ${fmtD(pk.updated)}.</p>`;
      box.querySelectorAll('[data-fl]').forEach((b) => b.addEventListener('click', () => { st.floor = b.getAttribute('data-fl'); render(); }));
      box.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => { st.stada = b.getAttribute('data-st'); render(); }));
      box.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('change', () => { st.hopar[+b.getAttribute('data-h')] = b.checked; draw(); }));
      box.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('change', () => { st[b.getAttribute('data-o')] = b.checked; draw(); }));
      const im = box.querySelector('img'); im.addEventListener('load', draw); if (im.complete) draw();
    };
    render();
    window.addEventListener('resize', () => { if (box.isConnected) draw(); });
  }

  function floorsHtml(data, stukur) {
    if (!stukur || !stukur.wings) return floorsHtmlPar(data);
    const fl = ['6H', '5H', '4H'].map((f) => floorWingsHtml(stukur, f));
    const done = fl.reduce((a, x) => a + x.done, 0), total = fl.reduce((a, x) => a + x.total, 0);
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<div class="nl-fl-wrap">
      <div class="nl-hero">
        <div class="nl-hero-main"><span class="nl-kick">NLSH · MEÐFERÐARKJARNI · 4.–6. HÆÐ</span><h2>Framvinda brunaþéttinga</h2><p class="nl-hero-sub">Staða ${fmtD(stukur.updated)} úr hnitum Ajour</p></div>
        <div class="nl-hero-pct"><b>${pct}%</b><span>lokið</span><div class="nl-bar"><i style="width:${pct}%"></i></div></div>
        <dl class="nl-hero-k"><div><dt>Klárað</dt><dd>${num(done)}</dd></div><div><dt>Markmið (mat)</dt><dd>~${num(total)}</dd></div><div><dt>Eftir (mat)</dt><dd>~${num(Math.max(0, total - done))}</dd></div></dl>
      </div>
      <p class="nl-note">Heildin er mat: Ajour gefur aðeins klárað, ekki það sem á eftir að gera. Ajour skráir stakar lokanir (sín hvorum megin við vegg). Rafmagnsraufar, rafmagnsgöt og fleira á flokkateikningum er ótalið hér.</p>
      <div class="nl-fl-grid">${fl.map((x) => x.html).join('')}</div>
      <div class="nl-fl-leg"><span>0%</span><span class="bar"></span><span>100% búið</span><span>· Loft = loftræsting · Stál = stálrör (vatnslagnir) · Rafmagn · Gólf = milliloft · Annað = plast o.fl. · fjöldi gata sem er klárað</span></div>
      ${kortHtml()}
      ${zoneTable(stukur)}
      ${umferdirTable(stukur)}
      ${stukurTable(stukur)}
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
    let stukur = null;
    try {
      const rs = await fetch('/data/nlsh-stukur.json?v=' + Date.now());
      if (rs.ok) stukur = await rs.json();
    } catch (_) { stukur = null; }
    const floors = ['4H', '5H'];
    const cat = (data.category || []).filter((c) => c.serials > 0);
    const catLine = cat.length
      ? `<p class="nl-sec-cat">Flokkateikningar teljast ekki með í gataeftirstöðvum: ${cat.map((c) => escapeHtml(c.drawing) + ' (' + num(c.serials) + ')').join(', ')}.</p>`
      : '';
    root.innerHTML = `
      ${floorsHtml(data, stukur)}
      <p class="nl-sec-note">${escapeHtml(data.note || '')} Áætlað vistast strax. Þetta er ekki herbergjastyring og ekki 95% úr Ajour-lista.</p>
      <div class="nl-sec-save" id="nl-sec-save">${data.drawing_backfilled ? '' : 'Áætlað má fylla inn núna. Lokið fyllist við næsta Ajour-innsog.'}</div>
      ${floors.map((f) => `
        <div class="nl-sec-grid">
          ${(data.sections || []).filter((s) => s.floor === f).map(cellHtml).join('')}
        </div>
      `).join('')}
      ${catLine}
    `;
    mountKort(root, stukur);
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
