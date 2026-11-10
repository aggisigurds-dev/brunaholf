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
  // Eigið snið: toLocaleString('is-IS') fellur í en-US („10,193“) þar sem íslenska vantar í vafrann.
  const num = (n) => (n == null ? '—' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'));

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
      .nl-kort-in{position:relative;line-height:0}
      .nl-kort-skil{width:1px;align-self:stretch;background:#cfc8b9;margin:0 4px}
      .nl-kort-leg{gap:5px 6px!important;margin-top:0!important}
      .nl-kort-t{display:inline-flex;align-items:center;gap:5px;border:1px solid #e2ddd0;background:#fff;color:#1f2933;border-radius:20px;padding:3px 9px 3px 7px;font:500 11.5px -apple-system,'Segoe UI',Roboto,sans-serif;cursor:pointer;line-height:1.3}
      .nl-kort-t small{color:#6f685c;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10.5px}
      .nl-kort-t.af{opacity:.38;text-decoration:line-through}
      .nl-kort-t.opid{cursor:default;border-style:dashed}
      button.nl-kort-t:hover{background:#faf8f4}
      button.nl-kort-t:focus-visible{outline:2px solid #c9a54a;outline-offset:1px}
      .nl-kort-sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:10px 0 0}
      @media(max-width:900px){.nl-kort-sum{grid-template-columns:repeat(2,minmax(0,1fr))}}
      .nl-ks{border:1px solid #cfc8b9;border-radius:10px;padding:10px 12px;font-size:12px;font-variant-numeric:tabular-nums;color:#1f2933;background:#fff}
      .nl-ks-h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px}
      .nl-ks-h b{font-size:15px}
      .nl-ks-h span{font-size:20px;font-weight:700}
      .nl-ks-s{color:#5a6473;margin-bottom:6px}
      .nl-ks table{border-collapse:collapse;width:100%}
      .nl-ks td,.nl-ks th{padding:1px 0;text-align:right;font-weight:400}
      .nl-ks th{color:#5a6473;font-size:10.5px}
      .nl-ks td:first-child,.nl-ks th:first-child{text-align:left}
      .nl-ks tr.t td{border-top:1px solid #cfd5de;font-weight:700}
      .nl-ks-z{display:flex;gap:6px;margin-top:8px}
      .nl-ks-z div{flex:1;border-radius:6px;padding:3px 4px;text-align:center;font-size:10.5px;line-height:1.3}
      .nl-ks-z b{display:block;font-size:13px}
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
      .nl-note b{color:var(--nl-ink)}
      .nl-dg{margin:4px 0 18px}
      .nl-dg-h{display:flex;align-items:center;flex-wrap:wrap;gap:6px 12px;margin:16px 2px 8px}
      .nl-dg-h b{font:700 19px 'Playfair Display',Georgia,serif;letter-spacing:-.01em}
      .nl-dg-h span:last-child{font-size:12px;color:var(--nl-mute);font-variant-numeric:tabular-nums}
      .nl-dg-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      @media (max-width:1000px){.nl-dg-g{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media (max-width:520px){.nl-dg-g{grid-template-columns:minmax(0,1fr)}}
      .nl-dk{min-width:0;background:#fff;color:#1f2933;border:1px solid var(--nl-line);border-top:3px solid var(--dk,#9ca3af);border-radius:12px;padding:12px 14px 10px;box-shadow:0 1px 2px rgba(22,21,19,.05),0 4px 14px rgba(22,21,19,.04)}
      .nl-dk-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
      .nl-dk-h b{font:700 15px 'Playfair Display',Georgia,serif}
      .nl-dk-p{font:800 26px/1 'Playfair Display',Georgia,serif;font-variant-numeric:tabular-nums}
      .nl-dk-s{font-size:11.5px;color:#6f685c;margin:3px 0 9px;font-variant-numeric:tabular-nums}
      .nl-dk-r{display:grid;grid-template-columns:78px minmax(0,1fr) auto;align-items:center;gap:8px;font-size:11.5px;padding:3px 0;font-variant-numeric:tabular-nums}
      .nl-dk-r span{color:#44505e}
      .nl-dk-r em{font-style:normal;font-weight:700;white-space:nowrap}
      .nl-dk-r em small{font-weight:400;color:#6f685c}
      .nl-dk-r.na span,.nl-dk-r.na em{color:#9aa1ab;font-weight:400}
      .nl-dk-b{height:7px;border-radius:4px;background:#ece7dc;overflow:hidden}
      .nl-dk-b i{display:block;height:100%;border-radius:4px}
      .nl-ut{display:grid;gap:9px;background:#fff;color:#1f2933;border:1px solid var(--nl-line);border-radius:12px;padding:14px 16px;margin:8px 0}
      .nl-ut-r{display:grid;grid-template-columns:170px minmax(60px,1fr) minmax(0,1.4fr);align-items:center;gap:12px;font-size:12px;font-variant-numeric:tabular-nums}
      .nl-ut-r b{font-weight:600}
      .nl-ut-r em{font-style:normal;color:#44505e}
      @media (max-width:640px){.nl-ut-r{grid-template-columns:minmax(0,1fr);gap:4px}}
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
    const t = ref ? (ref.cat[c] || 0) : 0;
    return /^Loft/i.test(c) ? Math.round(t * loftFactor(stukur, w)) : t;
  }

  // Loftræsting 5H er talin sér á Miro (borð uXjVG3Z1Bmk=, Agnar): 5H1S 115 gegnumtök = 230 lokanir, 5H2S 122 = 244 — um 12 %
  // færri en á 6H, svo „6H = 100 %“ vanmat loftið á 5H (10.11.2026). Miro telur um 7 % færri en Ajour skráir (6H S2: 272 á Miro
  // á móti kláruðu í Ajour) og markmiðið er kvarðað með því hlutfalli. S4/S5 eru ótalin á Miro: meðalhlutfall S1 og S2 (áætlun).
  const MIRO_LOFT = { vidmid: 272, S1: 230, S2: 244 };
  const sumCat = (o, fn) => Object.keys(o || {}).reduce((a, k) => a + (fn(k) ? o[k] : 0), 0);
  const erLoft = (c) => /^Loft/i.test(c);
  function loftFactor(stukur, w) {
    const l6 = (x) => sumCat((stukur.wings['6H ' + x] || {}).cat, erLoft);
    const kv = l6('S2') ? l6('S2') / MIRO_LOFT.vidmid : 1;
    const fw = (x) => (l6(x) ? Math.min(1, (MIRO_LOFT[x] * kv) / l6(x)) : 1);
    return MIRO_LOFT[w] ? fw(w) : (fw('S1') + fw('S2')) / 2;
  }

  // Flokkahópar með ÞAKI per hóp (10.11.2026): markmið hóps = sami hópur á sama væng á 6H (loft kvarðað, sjá að ofan), en aldrei
  // minna en klárað + opið á deildinni sjálfri. Áður var allt lagt saman og stál umfram viðmið faldi að loftræsting var ógerð
  // (5H S4 sýndi 96 % með 68 % af loftinu). Hópar frekar en stakir stærðarflokkar: flokkun milli nágrannastærða er ekki eins
  // milli hæða (5H S1 Stál 40-50 = 411 á móti 378 á 6H). 4H hefur aðeins milliloft; 6H á ekkert milliloft (Agnar 10.11.2026).
  const HOPAR = [['Loft', 'Loftræsting', erLoft], ['Stál', 'Stálrör', (c) => /^Stál/i.test(c)], ['Plast', 'Plaströr', (c) => /^Plast/i.test(c)], ['Gólf', 'Milliloft', (c) => c === GOLF_CLS]];
  function hopStada(stukur, f, w) {
    const d = stukur.wings[f + ' ' + w] || { done: 0, open: 0, cat: {}, catOpen: {} };
    const ref = stukur.wings['6H ' + w] || { cat: {}, catOpen: {} };
    return HOPAR.map(([k, nafn, fn]) => {
      const done = sumCat(d.cat, fn), open = sumCat(d.catOpen, fn);
      let mark;
      if (k === 'Gólf') mark = f === '6H' ? 0 : GOLF_TGT[w];
      else if (f === '4H') mark = 0;
      else if (f === '6H') mark = done;
      else mark = Math.round((sumCat(ref.cat, fn) + sumCat(ref.catOpen, fn)) * (k === 'Loft' ? loftFactor(stukur, w) : 1));
      return { k, nafn, done, open, mark, tgt: Math.max(mark, done + open) };
    });
  }
  function wingTarget(stukur, f, w) {
    const d = stukur.wings[f + ' ' + w] || { done: 0, open: 0, cat: {} };
    const hs = hopStada(stukur, f, w);
    const tgt = hs.reduce((a, h) => a + h.tgt, 0), cd = hs.reduce((a, h) => a + h.done, 0);
    return Math.max(d.done, tgt + (d.done - cd));
  }

  // Deildaspjöld: ein stika per flokkahóp á hverri deild — sýnir HVAÐ er eftir, ekki bara hve mikið.
  function deildirHtml(stukur) {
    const stika = (p) => { const c = pctColor(p); return c.bd; };
    const haedir = ['6H', '5H', '4H'].map((f) => {
      let fd = 0, ft = 0;
      const kort = WINGS.map((w) => {
        const d = stukur.wings[f + ' ' + w] || { done: 0, open: 0 };
        const hs = hopStada(stukur, f, w);
        const done = hs.reduce((a, h) => a + h.done, 0), tgt = hs.reduce((a, h) => a + h.tgt, 0);
        fd += done; ft += tgt;
        const p = tgt ? Math.floor((done / tgt) * 100) : 0;
        const radir = hs.map((h) => {
          if (!h.tgt) return '';
          if (!h.mark && f === '6H') return `<div class="nl-dk-r na" title="Milliloft á ekki að vera á 6. hæð (Agnar 10.11.2026) — líklega rangt flokkað í Ajour"><span>${h.nafn}</span><div class="nl-dk-b"></div><em>${num(h.done)} <small>utan markmiðs</small></em></div>`;
          const hp = Math.floor((h.done / h.tgt) * 100);
          return `<div class="nl-dk-r" title="${f} ${w} · ${h.nafn}: ${num(h.done)} klárað${h.open ? ', ' + num(h.open) + ' opin í Ajour' : ''}, markmið ~${num(h.tgt)}"><span>${h.nafn}</span><div class="nl-dk-b"><i style="width:${Math.max(hp, h.done ? 2 : 0)}%;background:${stika(hp)}"></i></div><em>${num(h.done)} <small>/ ~${num(h.tgt)}</small></em></div>`;
        }).join('');
        const eftir = Math.max(0, tgt - done);
        return `<div class="nl-dk" style="--dk:${stika(p)}">
          <div class="nl-dk-h"><b>${f} ${w}</b><span class="nl-dk-p">${p}%</span></div>
          <div class="nl-dk-s">${eftir ? '~' + num(eftir) + ' eftir' : 'lokið'}${d.open ? ' · ' + num(d.open) + ' opin í Ajour' : ''}</div>
          ${radir}
        </div>`;
      }).join('');
      const fp = ft ? Math.floor((fd / ft) * 100) : 0;
      return `<div class="nl-dg-h"><b>${FLOOR_NAME[f]}</b><span class="nl-fl-pill">${fp}%</span><span>${num(fd)} af ~${num(ft)} · ~${num(Math.max(0, ft - fd))} eftir</span></div><div class="nl-dg-g">${kort}</div>`;
    }).join('');
    return `<div class="nl-dg">${haedir}
      <p class="nl-sec-cat">Hver stika er einn flokkahópur. Markmið (~) = sami hópur á sömu deild á 6. hæð, en aldrei minna en klárað + opið. Loftræsting á 5. hæð er kvörðuð við eigin talningu (S1 og S2 taldar, S4 og S5 áætlaðar með sama hlutfalli). Milliloft: um 100 göt á deild = ~${num(GOLF_TGT.S1)} lokanir á 4. og 5. hæð, ekkert á 6. hæð. Rafmagn er sér hér fyrir neðan.</p>
    </div>`;
  }

  // Utan deilda: rafmagn á sérteikningum, Viðbótarverkefni og skráningar án teikningar (stukur.utan úr tools/nlsh-stukur.cjs).
  function utanHtml(stukur) {
    const u = stukur.utan;
    if (!u) return '';
    const finna = (re) => { const k = Object.keys(u).find((x) => re.test(x)); return k ? u[k] : { done: 0, open: 0, cat: {}, catOpen: {} }; };
    const erRaf = (c) => RAF_CLS.indexOf(c) >= 0;
    const rafDeild = (f) => ['S1', 'S2'].reduce((a, w) => { const d = stukur.wings[f + ' ' + w] || {}; return [a[0] + sumCat(d.cat, erRaf), a[1] + sumCat(d.catOpen, erRaf)]; }, [0, 0]);
    const r6 = finna(/^6H.*Rafmagns/i), r5 = finna(/^5H.*Rafmagns/i), vb = finna(/Viðbótarverkefni/i), an = finna(/^\(engin teikning\)$/);
    const d6 = rafDeild('6H'), d5 = rafDeild('5H');
    const k6 = d6[0] + r6.done, o6 = d6[1] + r6.open, k5 = d5[0] + r5.done, o5 = d5[1] + r5.open;
    const minnis = (an.catOpen['Guide point'] || 0) + (an.catOpen['Annað'] || 0);
    const rod = (heiti, done, tgt, texti, lit) => {
      const p = tgt ? Math.min(100, Math.floor((done / tgt) * 100)) : 0;
      return `<div class="nl-ut-r"><b>${heiti}</b><div class="nl-dk-b"><i style="width:${Math.max(p, done ? 1 : 0)}%;background:${lit || pctColor(p).bd}"></i></div><em>${texti}</em></div>`;
    };
    return `<details class="nl-fl-det" open><summary>Rafmagn og annað utan deilda</summary>
      <div class="nl-ut">
        ${rod('Rafmagn 6H · S1+S2', k6, k6 + o6, `${num(k6)} klárað${o6 ? ' · ' + num(o6) + ' opin' : ''}`)}
        ${rod('Rafmagn 5H · S1+S2', k5, k6 + o6, `${num(k5)} klárað · ${num(o5)} mæld og ólokuð`)}
        ${rod('Viðbótarverkefni', vb.done, vb.done + vb.open, `${num(vb.done)} klárað${vb.open ? ' · ' + num(vb.open) + ' opin' : ''}`)}
        ${rod('Án teikningar', an.done, an.done + an.open, `${num(an.open)} opnar, þar af ${num(minnis)} minnispunktar · ${num(an.done)} kláraðar`, '#9ca3af')}
      </div>
      <p class="nl-sec-cat">Rafmagn er skráð á sérteikningar í Ajour og skiptist ekki á deildir hér. Stikan fyrir 5. hæð miðar við 6. hæð, sem er viðmið en ekki markmið: aðeins upprunalegar rafmagnsteikningar eru til og breytingar hafa tvítalið sum göt (Agnar 10.11.2026). Á S4 og S5 er ekkert rafmagn skráð á hvorugri hæð. Skráningar án teikningar eru athugasemdir, leiðréttingar og göt sem bíða (t.d. eftir gifsi) og verða ekki staðsettar á deild.</p>
    </details>`;
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
    if (f === '5H') { const ref = zoneOf(stukur, '6H', w, z); t += ref.done - (ref.cat[GOLF_CLS] || 0) - RAF_CLS.reduce((x, c) => x + (ref.cat[c] || 0), 0) - Math.round(sumCat(ref.cat, erLoft) * (1 - loftFactor(stukur, w))); }
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
      <p class="nl-sec-cat">Markmið = sami flokkur á sama væng á 6H (hún er búin); loftræsting á 5H er kvörðuð niður við eigin talningu (um 12 % færri gegnumtök en á 6H). Stærðarflokkun er ekki alveg eins milli hæða, svo stakur flokkur getur sýnt of lítið þótt hópurinn sé búinn — deildaspjöldin efst leggja hópana saman. Gólf Ø160-200 (milliloft) á 4H og 5H: um 100 göt á stúku (Agnar) = ~200 stakar lokanir; 6H hefur engin gólfgöt í markmiði. Lítil tala í reit er stærðin sem eftir er. Samtals eftir um <b>${num(rem)}</b> göt (án rafmagnsraufa). Gólfgöt eru ${perC[GOLF_CLS] ? Math.round((perC[GOLF_CLS] / rem) * 100) : 0}% af því.</p>
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
    const st = { floor: '6H', stada: 'allt', hopar: pk.hopar.map(() => true), hue: true, tafla: true, zoom: 'allt', af: {} };
    // Tákn eftir tegund og stærð (10.11.2026) — sama hugsun og á Miro-kortum Agnars: kross = loftræsting, tígull = rafmagn,
    // hvert tákn segir tegund og stærð. [lögun, litur, radíus, heiti]; lögun: x kross, o hringur, t þríhyrningur, s ferningur, d tígull.
    const TAKN = (c) => {
      c = c || '';
      const m = /(\d+)\s*-\s*(\d+)/.exec(c), lo = m ? +m[1] : 0;
      if (/^Loft/i.test(c)) return !m ? ['x', '#64748b', 3.6, 'Loft annað'] : lo >= 400 ? ['x', '#c026d3', 5.2, 'Loft 400-630'] : lo >= 200 ? ['x', '#7c3aed', 4.4, 'Loft 200-315'] : ['x', '#2563eb', 3.6, 'Loft 125-160'];
      if (/^Stál/i.test(c)) return lo >= 110 ? ['o', '#7c2d12', 4.6, 'Stál 110-160'] : lo >= 75 ? ['o', '#c2410c', 3.9, 'Stál 75-110'] : lo >= 40 ? ['o', '#f97316', 3.2, 'Stál 40-50'] : ['o', '#fbbf24', 2.7, 'Stál 15-35'];
      if (/^Plast/i.test(c)) return lo >= 75 ? ['t', '#155e75', 4.8, 'Plast 75-100'] : lo >= 35 ? ['t', '#0891b2', 4.1, 'Plast 35-50'] : ['t', '#22d3ee', 3.4, 'Plast 20-34'];
      if (c === GOLF_CLS) return ['s', '#0f766e', 3.8, 'Milliloft'];
      if (RAF_CLS.indexOf(c) >= 0) return ['d', '#067429', 4, 'Rafmagn'];
      return ['s', '#9ca3af', 2.6, 'Annað'];
    };
    const HOPTAKN = [['x', '#2563eb', 3.8, 'Loft'], ['o', '#f97316', 3.2, 'Stál'], ['d', '#067429', 4, 'Rafmagn'], ['s', '#0f766e', 3.8, 'Milliloft'], ['s', '#9ca3af', 2.6, 'Annað']];
    const TK = pk.flokkar ? pk.flokkar.map(TAKN) : null;
    const taknOf = (q) => (TK && TK[q[6]]) || HOPTAKN[q[3]];
    const ROD = ['Loft 125-160', 'Loft 200-315', 'Loft 400-630', 'Loft annað', 'Stál 15-35', 'Stál 40-50', 'Stál 75-110', 'Stál 110-160', 'Plast 20-34', 'Plast 35-50', 'Plast 75-100', 'Milliloft', 'Rafmagn', 'Annað', 'Loft', 'Stál'];
    const slod = (cx, t, x, y, r) => {
      cx.beginPath();
      if (t === 'x') { cx.moveTo(x - r, y - r); cx.lineTo(x + r, y + r); cx.moveTo(x + r, y - r); cx.lineTo(x - r, y + r); }
      else if (t === 'd') { cx.moveTo(x, y - r * 1.25); cx.lineTo(x + r, y); cx.lineTo(x, y + r * 1.25); cx.lineTo(x - r, y); cx.closePath(); }
      else if (t === 't') { cx.moveTo(x, y - r); cx.lineTo(x + r, y + r * 0.8); cx.lineTo(x - r, y + r * 0.8); cx.closePath(); }
      else if (t === 's') cx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
      else cx.arc(x, y, r, 0, 6.2832);
    };
    const teikna = (cx, q, k, zs) => {
      const t = taknOf(q), x = q[0] * k, y = q[1] * k, r = t[2] * zs;
      slod(cx, t[0], x, y, r);
      if (t[0] === 'x') { cx.lineCap = 'round'; cx.lineWidth = Math.max(1, r * 0.5); cx.strokeStyle = q[2] ? t[1] + 'e0' : '#dc2626'; cx.stroke(); }
      else if (q[2]) { cx.fillStyle = t[1] + 'd0'; cx.fill(); cx.lineWidth = 0.6; cx.strokeStyle = 'rgba(22,21,19,.4)'; cx.stroke(); }
      else { cx.fillStyle = '#ffffffe0'; cx.fill(); cx.lineWidth = 2; cx.strokeStyle = '#dc2626'; cx.stroke(); }
      if (!q[2]) { cx.beginPath(); cx.arc(x, y, r + 3.5 * zs, 0, 6.2832); cx.lineWidth = Math.max(1, 1.6 * zs); cx.strokeStyle = '#dc2626'; cx.stroke(); }
    };
    const taknSvg = (t) => {
      const c = t[1], p = t[0] === 'x' ? '<path d="M3 3L11 11M11 3L3 11" stroke="' + c + '" stroke-width="2.4" stroke-linecap="round" fill="none"/>' : t[0] === 'd' ? '<path d="M7 1L12 7L7 13L2 7Z" fill="' + c + '"/>' : t[0] === 't' ? '<path d="M7 2L12.5 12H1.5Z" fill="' + c + '"/>' : t[0] === 's' ? '<rect x="2.5" y="2.5" width="9" height="9" fill="' + c + '"/>' : '<circle cx="7" cy="7" r="' + Math.min(6, t[2] * 1.25) + '" fill="' + c + '"/>';
      return '<svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true">' + p + '</svg>';
    };
    const ZK = ['N', 'C', 'S'], ZN = ['Norður', 'Center', 'Suður'];
    const grpOf = (c) => (/^Loft/i.test(c) ? 0 : /^Stál/i.test(c) ? 1 : RAF_CLS.indexOf(c) >= 0 ? 2 : /^Gólf/i.test(c) ? 3 : 4);
    const catGrp = (cat) => { const g = [0, 0, 0, 0, 0]; Object.keys(cat || {}).forEach((c) => { g[grpOf(c)] += cat[c]; }); return g; };
    // markmið hóps á svæði: 5H = sami flokkur á sama svæði á 6H; milliloft = hlutur svæðis í markmiði væng; rafmagn utan markmiða
    const golfShare = () => { const g = [0, 0, 0]; ['S1', 'S2'].forEach((x) => ZK.forEach((k, zi) => { g[zi] += zoneOf(stukur, '5H', x, k).cat[GOLF_CLS] || 0; })); const t = g[0] + g[1] + g[2]; return g.map((x) => (t ? x / t : 0)); };
    const target = (f, w, zi) => {
      const zd = zoneOf(stukur, f, w, ZK[zi]);
      if (f === '6H') return catGrp(zd.cat);
      if (f === '4H') return [0, 0, 0, Math.round(GOLF_TGT[w] * golfShare()[zi]), 0];
      const z6 = zoneOf(stukur, '6H', w, ZK[zi]), ref = catGrp(z6.cat);
      return [Math.round(ref[0] * loftFactor(stukur, w)), ref[1], 0, Math.round(GOLF_TGT[w] * golfShare()[zi]), ref[4]];
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
      const G = geom(st.floor), inn = box.querySelector('.nl-kort-in');
      // Stækkun á vængjapar: innri kassinn er breikkaður og hliðrað svo parið fylli kortið (bakgrunnsmyndin er 2.123 px á breidd).
      let Z = 1;
      const zp = st.zoom === 'allt' ? null : G['n' + st.zoom];
      if (zp && G[zp.l] && G[zp.r]) { const x0 = Math.max(0, G[zp.l].x0 - 30), x1 = Math.min(pk.w, G[zp.r].x1 + 30); Z = pk.w / (x1 - x0); inn.style.width = (Z * 100) + '%'; inn.style.marginLeft = (-(x0 / pk.w) * Z * 100) + '%'; }
      else { inn.style.width = '100%'; inn.style.marginLeft = '0'; }
      const W = img.clientWidth || 900, k = W / pk.w, zs = Math.max(0.42, Math.min(1.8, Math.sqrt(k / 0.74))); // táknstærð fylgir kvarða kortsins (sími lítil, stækkað stærri)
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
      // kláraðir fyrst, opnir ofan á svo þeir hverfi ekki undir
      [1, 0].forEach((umf) => pts.forEach((q) => {
        if (q[2] !== umf) return;
        if (!st.hopar[q[3]] || st.af[taknOf(q)[3]]) return;
        if (st.stada === 'klarad' && !q[2]) return;
        if (st.stada === 'opid' && q[2]) return;
        n++;
        teikna(cx, q, k, zs);
      }));
      box.querySelector('.nl-kort-n').textContent = num(n) + ' punktar sýndir';
      // samantekt fyrir hverja stúku undir teikningunni (fylgir völdum flokkum og stöðu)
      const sm = box.querySelector('.nl-kort-sum'); sm.innerHTML = '';
      const sl = sel();
      [1, 2, 4, 5].forEach((s5) => {
        const w = 'S' + s5, wd = stukur.wings[st.floor + ' ' + w];
        if (!wd) return;
        const dn = catGrp(wd.cat), open = [0, 0, 0, 0, 0];
        pts.forEach((q) => { if (q[4] === s5 && !q[2]) open[q[3]]++; });
        const tg = [0, 0, 0, 0, 0];
        for (let zi = 0; zi < 3; zi++) target(st.floor, w, zi).forEach((x, i) => { tg[i] += x; });
        const rows = []; let sd = 0, so = 0, stg = 0;
        pk.hopar.forEach((h, i) => {
          if (!sl[i]) return;
          sd += dn[i]; so += open[i]; stg += tg[i];
          rows.push('<tr><td>' + h + '</td><td>' + num(dn[i]) + '</td><td>' + (open[i] ? num(open[i]) : '·') + '</td><td>' + (tg[i] ? '~' + num(tg[i]) : '·') + '</td></tr>');
        });
        const p = stg > 0 ? Math.min(100, Math.round((sd / stg) * 100)) : null, c = pctColor(p == null ? 0 : p);
        const zs = [0, 1, 2].map((zi) => { const pz = pctOf(st.floor, w, zi), cz = pctColor(pz == null ? 0 : Math.round(pz * 100)); return '<div style="background:' + cz.bg + '">' + ZN[zi] + '<b>' + (pz == null ? '–' : Math.round(pz * 100) + '%') + '</b></div>'; }).join('');
        const el = document.createElement('div');
        el.className = 'nl-ks'; el.style.borderColor = c.bd;
        el.innerHTML = '<div class="nl-ks-h"><b>' + w + '</b><span>' + (p == null ? '–' : p + '%') + '</span></div><div class="nl-ks-s">' + num(sd) + ' klárað' + (so ? ' · ' + num(so) + ' opin' : '') + (stg ? ' af ~' + num(stg) : '') + '</div>'
          + '<table><tr><th></th><th>Klárað</th><th>Opið</th><th>Markmið</th></tr>' + rows.join('') + '<tr class="t"><td>Σ</td><td>' + num(sd) + '</td><td>' + (so ? num(so) : '·') + '</td><td>' + (stg ? '~' + num(stg) : '·') + '</td></tr></table><div class="nl-ks-z">' + zs + '</div>';
        sm.appendChild(el);
      });
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
        ${['6H', '5H', '4H'].map((f) => `<button type="button" class="nl-kort-b${st.floor === f ? ' on' : ''}" data-fl="${f}">${f === '6H' ? '6. hæð' : f === '5H' ? '5. hæð' : '4. hæð'}</button>`).join('')}
        <span class="nl-kort-skil"></span>
        ${[['allt', 'Öll hæðin'], ['1', 'S1 + S2'], ['4', 'S4 + S5']].map((x) => `<button type="button" class="nl-kort-b${st.zoom === x[0] ? ' on' : ''}" data-zm="${x[0]}" title="Stækka kortið á þetta vængjapar">${x[1]}</button>`).join('')}
        <span class="nl-kort-sp"></span>
        ${[['allt', 'Allt'], ['klarad', 'Klárað'], ['opid', 'Opið']].map((x) => `<button type="button" class="nl-kort-b${st.stada === x[0] ? ' on' : ''}" data-st="${x[0]}">${x[1]}</button>`).join('')}
      </div>
      <div class="nl-kort-bar">${pk.hopar.map((h, i) => `<label class="nl-kort-c"><input type="checkbox" data-h="${i}" ${st.hopar[i] ? 'checked' : ''}><i style="background:${KORT_LITIR[i]}"></i>${h} <small>${num(c[i])}</small></label>`).join('')}
        <label class="nl-kort-c"><input type="checkbox" data-o="hue" ${st.hue ? 'checked' : ''}>Litur</label><label class="nl-kort-c"><input type="checkbox" data-o="tafla" ${st.tafla ? 'checked' : ''}>Samantekt</label><span class="nl-kort-n"></span></div>
      <div class="nl-kort-bar nl-kort-leg">${(() => {
        const tal = {}, tk = {};
        (pk.floors[st.floor] || []).forEach((q) => { const t = taknOf(q); tal[t[3]] = (tal[t[3]] || 0) + 1; tk[t[3]] = t; });
        return Object.keys(tal).sort((a, b) => ROD.indexOf(a) - ROD.indexOf(b)).map((h) => `<button type="button" class="nl-kort-t${st.af[h] ? ' af' : ''}" data-tk="${escapeAttr(h)}" aria-pressed="${st.af[h] ? 'false' : 'true'}" title="Sýna eða fela ${escapeAttr(h)}">${taknSvg(tk[h])}${escapeHtml(h)} <small>${num(tal[h])}</small></button>`).join('') + '<span class="nl-kort-t opid"><svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="#fff" stroke="#dc2626" stroke-width="2"/></svg>Opið í Ajour</span>';
      })()}</div>
      <div class="nl-kort-map"><div class="nl-kort-in"><img src="/img/nlsh-yfirlit-${(st.floor === '4H' ? '5H' : st.floor).toLowerCase()}.jpg" alt="Brunayfirlit ${st.floor === '4H' ? '5H (notað fyrir 4H)' : st.floor}"><canvas></canvas><div class="nl-kort-ov"></div></div></div>
      <div class="nl-kort-sum"></div>
      <p class="nl-sec-cat">Hvert tákn er ein skráning í Ajour, á staðnum sem var smellt á. Lögun segir tegund (kross = loftræsting, hringur = stálrör, þríhyrningur = plaströr, ferningur = milliloft, tígull = rafmagn), litur og stærð segja stærðarflokk. Smelltu á tákn í skýringunum til að fela það eða sýna, og á „S1 + S2“ eða „S4 + S5“ til að stækka. Fyllt tákn er klárað, rauður hringur er opið. Liturinn yfir svæði sýnir hlutfall af markmiði (rautt lítið, grænt mikið) og fylgir völdum flokkum. Samantektin í skörðunum er fjöldi gata á stúku og svæði, líka eftir völdum flokkum og stöðu. Staðsetning er sjálfvirk pörun við brunaveggi blaðsins og getur skeikað um nokkra metra. 4. hæð hefur ekki eigið yfirlitsblað: 5H-blaðið er notað og punktarnir eru aðeins milliloftsgöt (staðsetning þar er grófari, sérstaklega S1 og S2). Blaðið er Rev.A; staða ${fmtD(pk.updated)}.</p>`;
      box.querySelectorAll('[data-fl]').forEach((b) => b.addEventListener('click', () => { st.floor = b.getAttribute('data-fl'); render(); }));
      box.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => { st.stada = b.getAttribute('data-st'); render(); }));
      box.querySelectorAll('[data-zm]').forEach((b) => b.addEventListener('click', () => { st.zoom = b.getAttribute('data-zm'); render(); }));
      box.querySelectorAll('[data-tk]').forEach((b) => b.addEventListener('click', () => { const h = b.getAttribute('data-tk'); st.af[h] = !st.af[h]; b.classList.toggle('af', !!st.af[h]); b.setAttribute('aria-pressed', st.af[h] ? 'false' : 'true'); draw(); }));
      box.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('change', () => { st.hopar[+b.getAttribute('data-h')] = b.checked; draw(); }));
      box.querySelectorAll('[data-o]').forEach((b) => b.addEventListener('change', () => { st[b.getAttribute('data-o')] = b.checked; draw(); }));
      const im = box.querySelector('img'); im.addEventListener('load', draw); if (im.complete) draw();
    };
    render();
    window.addEventListener('resize', () => { if (box.isConnected) draw(); });
  }

  // Opnar skráningar í Ajour eru EKKI sama og ólokuð göt: meirihlutinn hefur enga teikningu (athugasemdir, leiðréttingar, bið).
  function opidLina(stukur) {
    const u = stukur.utan;
    if (!u) return 'Rafmagnsraufar, rafmagnsgöt og fleira á flokkateikningum er ótalið hér.';
    const aDeild = Object.keys(stukur.wings).reduce((a, k) => a + (stukur.wings[k].open || 0), 0);
    const an = (u['(engin teikning)'] || { open: 0 }).open;
    const ser = Object.keys(u).reduce((a, k) => a + (k === '(engin teikning)' ? 0 : u[k].open), 0);
    return `Opið í Ajour: <b>${num(stukur.open)}</b> skráningar — ${num(aDeild)} á deildum, ${num(ser)} á sérteikningum (rafmagn, viðbótarverk) og ${num(an)} án teikningar.`;
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
      <p class="nl-note">Heildin er mat: Ajour gefur aðeins klárað, ekki það sem á eftir að gera. Ajour skráir stakar lokanir (sín hvorum megin við vegg). ${opidLina(stukur)}</p>
      ${deildirHtml(stukur)}
      ${utanHtml(stukur)}
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
