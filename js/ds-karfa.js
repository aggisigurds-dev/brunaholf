/* ds-karfa.js — DRAFT-KARFA í Drög-stöðinni (05.09.2026, Agnar)
 *
 * „Það sem vantar helst þarna er draft-karfa … velja vörur, verð reiknast, afsláttur …
 *  compact útgáfa af körfunni á söluborði … takki „Senda í körfu" … nýr flokkur, ekki
 *  venjuleg sala, ekki í draft — flækist ekki í neitt fyrr en hún er kláruð í söluborði …
 *  mjög editable á allan hátt, hálfgert krassblað þangað til maður sendir hana í vinnslu."
 *
 * Karfan býr AÐEINS á punktinum (`reikningspunktar.karfa`, jsonb). Hún er ekki sala og
 * ekki drög í `solur`. „Senda í körfu" opnar söluborð Slökkvitækis með ?karfa=<id> —
 * patch 352 þar hleður línunum og kúnnanum í POS-körfuna og reikningurinn verður til
 * ÞAR, eftir öllum reglum söluborðsins (afsláttar-konvensjón, PDF, Payday).
 *
 * Notað af renderDrogstod í index.html (dsCtx): box(note) teiknar ritilinn, wire() vírar,
 * badge(note) sýnir flögu. Vörulistinn (`vorur`) kemur úr /api/reikningspunktar?op=vorur.
 * Sjálf-innihaldið, einn <script src> — sama mynstur og hub-sync-buttons.js.
 */
(() => {
  if (window.DsKarfa) return;
  const POS_URL = 'https://slokkvitaeki.netlify.app/';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Math.round(Number(n) || 0).toLocaleString('is-IS').replace(/,/g, '.');
  const pad = n => String(n).padStart(2, '0');
  const stund = iso => { const d = new Date(iso); return isNaN(d) ? '' : pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  // Íslensk tala: „12.500" = 12500 (þúsundapunktur), „23790.32" = 23790,32 (tugabrot), „1.234,5" = 1234,5.
  const num = v => {
    const s = String(v == null ? '' : v).trim().replace(/\s/g, ''); if (!s) return 0;
    let t = s;
    if (s.includes(',')) t = s.replace(/\./g, '').replace(',', '.');
    else if ((s.match(/\./g) || []).length > 1) t = s.replace(/\./g, '');
    else if (/\.\d{3}$/.test(s)) t = s.replace('.', '');
    const n = parseFloat(t); return isFinite(n) ? n : 0;
  };
  const tala = n => { const x = Math.round((Number(n) || 0) * 100) / 100; return Number.isInteger(x) ? String(x) : String(x); };

  let VORUR = null, vorurLofad = null, opin = null, ctx = null;
  const timers = {};

  // ── Vörulistinn ──────────────────────────────────────────────────────────
  function hladaVorur() {
    if (VORUR) return Promise.resolve(VORUR);
    if (!vorurLofad) vorurLofad = ctx.api('/api/reikningspunktar?op=vorur').then(j => {
      VORUR = (j.vorur || []).map(v => ({ id: v.id, nafn: v.nafn, verd: num(v.verd_an_vsk), vsk: num(v.vsk_prosenta) || 24, flokkur: v.flokkur || '' }));
      let dl = document.getElementById('ds-vorur');
      if (!dl) { dl = document.createElement('datalist'); dl.id = 'ds-vorur'; document.body.appendChild(dl); }
      dl.innerHTML = VORUR.map(v => '<option value="' + esc(v.nafn) + '">' + esc(fmt(v.verd) + ' kr' + (v.flokkur ? ' · ' + v.flokkur : '')) + '</option>').join('');
      return VORUR;
    }).catch(e => { vorurLofad = null; throw e; });
    return vorurLofad;
  }
  const norm = s => String(s || '').toLowerCase().replace(/co₂/g, 'co2').replace(/[.,·\-–—()\/]+/g, ' ').replace(/\s+/g, ' ').trim();
  function voraEftirNafni(nafn) { const n = norm(nafn); return (VORUR || []).find(v => norm(v.nafn) === n) || null; }
  // Besta vara fyrir lausan texta („5 kg CO2-tæki", „flöt slökkvitækjaskilti"). Skor ≥ 4 telst hittur.
  function finnaVoru(desc) {
    if (!VORUR || !VORUR.length) return null;
    const d = norm(desc); const dt = d.split(' ').filter(t => t.length >= 3);
    const kgD = (d.match(/(\d+(?:[.,]\d+)?) ?kg/) || [])[1];
    const vill = /tæki|taeki|nýtt|ny\b|slökkvit/.test(d) && !/hleðsl|hledsl|yfirferð|yfirferd|áfyll|afyll|skoðun/.test(d);
    let best = null, bestSkor = 0;
    for (const v of VORUR) {
      const n = norm(v.nafn); const nt = n.split(' ');
      let skor = 0;
      for (const t of dt) if (nt.some(x => x === t || (x.length >= 4 && t.length >= 4 && (x.includes(t) || t.includes(x))))) skor += 2;
      const kgV = (n.match(/(\d+(?:[.,]\d+)?) ?kg/) || [])[1];
      if (kgD && kgV) skor += kgD === kgV ? 3 : -5;
      if (vill && /slökkvitæki/.test(n)) skor += 2;
      if (/hleðsla|yfirferd|yfirferð|áfylling|skoðun|leiga/.test(n) && !/hleðsl|hledsl|yfirferð|yfirferd|áfyll|afyll|skoðun|leig/.test(d)) skor -= 4;
      if (/skilti/.test(d) && /slökkvitæk/.test(d) && /skilti/.test(n) && /slökkvitæki/.test(n)) skor += 3;
      if (/flöt|flot/.test(d) && /flöt/.test(n)) skor += 2;
      if (skor > bestSkor) { bestSkor = skor; best = v; }
    }
    return bestSkor >= 4 ? best : null;
  }

  // ── Lesa körfu úr texta punktsins ────────────────────────────────────────
  const svc = (label, qty, price) => ({ type: 'service', desc: String(label || 'Vinna').replace(/\s*[≈~]\s*$/, '').trim() || 'Vinna', qty, unit_price_ex_vat: price, vsk_pct: 24, product_id: null, disc_pct: 0 });
  const prod = (qty, desc) => { const v = finnaVoru(desc); return v ? { type: 'product', desc: v.nafn, qty, unit_price_ex_vat: v.verd, vsk_pct: v.vsk, product_id: v.id, disc_pct: 0, hint: desc } : { type: 'service', desc: String(desc).trim(), qty, unit_price_ex_vat: 0, vsk_pct: 24, product_id: null, disc_pct: 0 }; };
  function fromText(raw) {
    const out = [];
    for (let s of String(raw || '').split('\n')) {
      s = s.replace(/^[\s•\-–*·]+/, '').trim(); if (!s) continue;
      if (/^(ATH|VANTAR|AFSL|HVER|ÚR PÓSTI|Fordæmi|Engin|Ekkert|Krafan|Línur|→|R-\d|Leið|Skemmt|Notað|Eftir að|Leiguverð)/i.test(s)) continue;
      let m;
      if ((m = s.match(/^(.*?)\s*[≈~]?\s*(\d+(?:[.,]\d+)?)\s*klst\.?\s*[×x]\s*([\d.\s]+(?:,\d+)?)\s*kr/i))) { out.push(svc(m[1], num(m[2]), num(m[3]))); continue; }
      if ((m = s.match(/^(\d+(?:[.,]\d+)?)\s*[×x]\s*(.+?)(?:\s*[—–]\s*.*)?$/))) { out.push(prod(num(m[1]), m[2])); continue; }
      if ((m = s.match(/^(\d+)\s+(?:stk\.?\s+)?([^\d].{2,80}?)$/))) { out.push(prod(num(m[1]), m[2])); continue; }
    }
    return out;
  }

  // ── Reikningur ───────────────────────────────────────────────────────────
  const linuSum = l => num(l.qty) * num(l.unit_price_ex_vat) * (1 - num(l.disc_pct) / 100);
  function totals(k) {
    let ex = 0, vsk = 0;
    for (const l of (k.lines || [])) { const s = linuSum(l); ex += s; vsk += s * (num(l.vsk_pct) || 24) / 100; }
    const d = num(k.discount_pct); if (d) { ex *= 1 - d / 100; vsk *= 1 - d / 100; }
    const exR = Math.round(ex), totR = Math.round(ex + vsk);
    return { ex: exR, vsk: totR - exR, total: totR };
  }
  const nyLina = teg => ({ type: teg === 'service' ? 'service' : 'product', desc: '', qty: 1, unit_price_ex_vat: 0, vsk_pct: 24, product_id: null, disc_pct: 0 });

  // ── CSS ──────────────────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('ds-karfa-css')) return;
    const st = document.createElement('style'); st.id = 'ds-karfa-css';
    st.textContent = [
      '.ds-karfa{margin:8px 0 2px;border:1px solid var(--edge,#c9c2b3);border-left:4px solid var(--gold,#c9a54a);border-radius:6px;background:var(--card,#fff);box-shadow:var(--panel-shadow,0 8px 24px -16px rgba(0,0,0,.35));padding:10px 12px 12px;font-size:12.5px}',
      '.dk-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}.dk-head b{font-size:13.5px}.dk-head .dk-kunni{font-family:var(--font-mono);font-size:11px;color:var(--muted)}.dk-head .sp{flex:1}',
      '.dk-t{width:100%;border-collapse:collapse}.dk-t th{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);text-align:left;padding:2px 4px;font-weight:600}',
      '.dk-t td{padding:3px 4px;vertical-align:middle;border-top:1px solid var(--line,#e6e1d6)}.dk-t td.r{text-align:right;font-family:var(--font-mono);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dk-t input{height:30px;padding:0 7px;border:1px solid var(--edge,#c9c2b3);border-radius:4px;background:var(--input-bg,#f6f3ec);font:inherit;font-size:12.5px;color:var(--ink);width:100%;box-sizing:border-box;min-width:0}',
      '.dk-t input:focus{outline:none;border-color:var(--gold-deep,#8f6a1c);background:#fff}.dk-t input.n{text-align:right;font-family:var(--font-mono);font-variant-numeric:tabular-nums}',
      '.dk-t .dk-pid{display:block;font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-top:1px}.dk-t .dk-pid.ny{color:var(--warn,#8a6a1c)}',
      '.dk-x{font:inherit;font-size:13px;border:0;background:transparent;color:var(--muted);cursor:pointer;padding:4px 6px}.dk-x:hover{color:var(--red,#b5522a)}',
      '.dk-tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px}.dk-tools .sp{flex:1}.dk-tools label{font-size:11.5px;color:var(--muted);display:inline-flex;align-items:center;gap:5px}',
      '.dk-tools label input{width:56px;height:28px;text-align:right;padding:0 6px;border:1px solid var(--edge,#c9c2b3);border-radius:4px;background:var(--input-bg,#f6f3ec);font:inherit;font-size:12px}',
      '.dk-tot{display:flex;gap:14px;justify-content:flex-end;align-items:baseline;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid var(--line,#e6e1d6);font-family:var(--font-mono);font-size:11.5px;color:var(--muted)}',
      '.dk-tot b{color:var(--ink)}.dk-tot .dk-total{font-size:16px;color:var(--ink);font-family:var(--font-display,serif)}',
      '.dk-cta{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:10px}.dk-stada{font-family:var(--font-mono);font-size:10.5px;color:var(--muted)}.dk-stada.ok{color:var(--green,#2f7a4a)}',
      '.dk-nota{width:100%;box-sizing:border-box;margin-top:8px;min-height:44px;padding:6px 8px;border:1px dashed var(--edge,#c9c2b3);border-radius:4px;background:var(--input-bg,#f6f3ec);font:inherit;font-size:12px;resize:vertical}',
      '.ds-chip.karfa{background:#fbf3d9;border-color:#d9b95a;color:#5a4410}',
      // Sími (Agnar 05.09.2026, „can you make it fit"): hver lína verður spjald — vöruheitið á fullri
      // breidd, svo magn · verð · afsl · samtals · ✕ í einni röð með smá-merkjum; takkar á fullri breidd.
      '@media (max-width:720px){',
      '.ds-karfa{padding:10px 10px 12px}.dk-head .dk-kunni{width:100%;white-space:normal}',
      '.dk-t thead{display:none}.dk-t,.dk-t tbody{display:block}',
      '.dk-t tr{display:grid;grid-template-columns:46px minmax(0,1fr) 44px minmax(58px,auto) 22px;grid-template-areas:"d d d d d" "q p a s x";gap:6px 5px;padding:9px 0;border-top:1px solid var(--line,#e6e1d6);align-items:end;min-width:0}',
      '.dk-t td{display:block;padding:0;border-top:0;width:auto !important}',
      '.dk-t td:nth-child(1){grid-area:d}.dk-t td:nth-child(2){grid-area:q}.dk-t td:nth-child(3){grid-area:p}.dk-t td:nth-child(4){grid-area:a}.dk-t td:nth-child(5){grid-area:s;text-align:right;padding-bottom:8px}.dk-t td:nth-child(6){grid-area:x;text-align:right;padding-bottom:4px}',
      '.dk-t td:nth-child(2)::before,.dk-t td:nth-child(3)::before,.dk-t td:nth-child(4)::before,.dk-t td:nth-child(5)::before{display:block;font-family:var(--font-mono);font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:3px;white-space:nowrap}',
      '.dk-t td:nth-child(2)::before{content:"magn"}.dk-t td:nth-child(3)::before{content:"verð án vsk"}.dk-t td:nth-child(4)::before{content:"afsl %"}.dk-t td:nth-child(5)::before{content:"samtals"}',
      '.dk-t input{height:36px;font-size:13px;padding:0 6px;min-width:0}.dk-t td{min-width:0}.dk-t td.r{font-size:13px}.dk-t .dk-pid{white-space:normal}',
      // inline-stíllinn (KEY/GOLD, 30 px) ræður annars — !important hér svo takkarnir séu fingra-stórir
      '.dk-tools .sp{display:none}.dk-tools button{flex:1 1 auto;height:38px !important}.dk-tools label{width:100%;justify-content:space-between;margin-top:2px}.dk-tools label input{width:72px;height:34px}',
      '.dk-tot{justify-content:space-between;gap:8px 12px;font-size:11px}.dk-tot .dk-total{width:100%;text-align:right;font-size:19px;margin-top:2px}',
      '.dk-cta{flex-direction:column;align-items:stretch}.dk-cta button{width:100% !important;height:46px !important;font-size:14px !important}.dk-cta .dk-stada{text-align:center}',
      '}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ── Ritillinn ────────────────────────────────────────────────────────────
  function tryggjaKorfu(note) {
    if (note.karfa && typeof note.karfa === 'object' && Array.isArray(note.karfa.lines)) return false;
    note.karfa = { lines: fromText(note.raw), discount_pct: 0, athugasemd: '', auto: true, kunni: null, totals: null };
    return true;
  }
  function box(note) {
    css();
    const k = note.karfa || { lines: [] };
    const ku = k.kunni || {}; const kunniNafn = ku.nafn || note.worksite_name || '';
    const t = totals(k);
    const rows = (k.lines || []).map((l, i) => {
      const v = l.product_id ? (VORUR || []).find(x => x.id === l.product_id) : null;
      return '<tr data-i="' + i + '"><td><input list="ds-vorur" data-f="desc" value="' + esc(l.desc) + '" placeholder="Vara eða lýsing…">'
        + '<span class="dk-pid' + (l.product_id ? '' : ' ny') + '">' + (l.product_id ? '#' + esc(l.product_id) + (v ? ' · ' + esc(v.flokkur || 'vara') : '') : (l.type === 'service' ? 'þjónusta / vinna (frjáls lína)' : 'ekki úr vörulista')) + (l.hint ? ' · úr punkti: „' + esc(l.hint) + '"' : '') + '</span></td>'
        + '<td style="width:64px"><input class="n" data-f="qty" value="' + esc(tala(l.qty)) + '" inputmode="decimal"></td>'
        + '<td style="width:96px"><input class="n" data-f="price" value="' + esc(tala(l.unit_price_ex_vat)) + '" inputmode="decimal" title="Einingaverð án vsk"></td>'
        + '<td style="width:58px"><input class="n" data-f="disc" value="' + esc(tala(l.disc_pct)) + '" inputmode="decimal" title="Afsláttur línu %"></td>'
        + '<td class="r dk-sum">' + fmt(linuSum(l)) + '</td>'
        + '<td style="width:26px"><button type="button" class="dk-x" data-dk="del" title="Taka línu út">✕</button></td></tr>';
    }).join('');
    return '<div class="ds-karfa" data-karfa="' + esc(note.id) + '">'
      + '<div class="dk-head"><b>🧺 Draft-karfa</b><span class="dk-kunni">' + (kunniNafn ? esc(kunniNafn) + (ku.kt ? ' · kt ' + esc(ku.kt) : '') + (ku.afslattur_pct ? ' · ' + esc(ku.afslattur_pct) + '% fastur afsl.' : '') : 'enginn kúnni valinn — veldu kúnna í reitnum fyrir ofan') + '</span><span class="sp"></span>'
      + (k.auto ? '<span class="ds-chip warn" title="Línurnar voru lesnar sjálfkrafa úr textanum — yfirfarðu vöru, magn og verð">✨ sjálfvirk tillaga</span>' : '')
      + (k.sent_at ? '<span class="ds-chip ok" title="Send í söluborðið">↗ send ' + esc(stund(k.sent_at)) + '</span>' : '')
      + '<button type="button" class="dk-x" data-dk="loka" title="Loka (karfan geymist)">✕</button></div>'
      + '<table class="dk-t"><thead><tr><th>Vara / þjónusta</th><th>Magn</th><th>Ein.verð án vsk</th><th>Afsl %</th><th style="text-align:right">Samtals</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<div class="dk-tools"><button type="button" data-dk="add" style="' + ctx.KEY + '">+ Vara</button><button type="button" data-dk="addsvc" style="' + ctx.KEY + '">+ Vinna / þjónusta</button><button type="button" data-dk="urtexta" style="' + ctx.KEY + '" title="Lesa línurnar aftur úr texta punktsins (skiptir út núverandi línum)">↻ Úr punktinum</button><span class="sp"></span>'
      + '<label>Afsl. af heild % <input data-f="discount_pct" value="' + esc(tala(k.discount_pct)) + '" inputmode="decimal"></label></div>'
      + '<textarea class="dk-nota" data-f="athugasemd" placeholder="Krass — hvað á eftir að athuga, hvað var sagt, afsláttur sem bíður…">' + esc(k.athugasemd || '') + '</textarea>'
      + '<div class="dk-tot"><span>Án vsk <b class="dk-ex">' + fmt(t.ex) + '</b></span><span>VSK <b class="dk-vsk">' + fmt(t.vsk) + '</b></span><span class="dk-total">' + fmt(t.total) + ' kr</span></div>'
      + '<div class="dk-cta"><button type="button" data-dk="senda" style="' + ctx.GOLD + '" title="Opnar söluborð Slökkvitækis með þessari körfu — reikningurinn verður til þar">🧺 Senda í körfu ↗</button><span class="dk-stada">' + (k.saved_at ? 'vistað ' + esc(stund(k.saved_at)) : 'óvistað') + '</span></div>'
      + '</div>';
  }
  function badge(note) {
    const k = note.karfa; if (!k || !Array.isArray(k.lines) || !k.lines.length) return '';
    const t = totals(k);
    return '<span class="ds-chip karfa" title="Draft-karfa' + (k.sent_at ? ' — send í söluborð ' + esc(stund(k.sent_at)) : '') + '">🧺 ' + k.lines.length + ' lín' + (k.lines.length === 1 ? 'a' : 'ur') + ' · ' + fmt(t.total) + ' kr' + (k.sent_at ? ' · ↗' : '') + '</span>';
  }

  // ── Vistun (sjálfkrafa, 800 ms) ──────────────────────────────────────────
  async function vista(note, opts) {
    const k = note.karfa; if (!k) return null;
    const body = { action: 'karfa', id: note.id, karfa: { lines: k.lines, discount_pct: num(k.discount_pct), athugasemd: k.athugasemd || '', auto: !!k.auto } };
    if (opts && opts.sent) body.sent = true;
    if (note.worksite_name) body.worksite_name = note.worksite_name;
    const j = await ctx.post(body);
    if (j && j.karfa) { note.karfa = Object.assign({}, j.karfa, { lines: k.lines }); }
    return j;
  }
  function vistaSidar(note, root) {
    clearTimeout(timers[note.id]);
    const st = root.querySelector('.dk-stada'); if (st) { st.textContent = 'vistar…'; st.className = 'dk-stada'; }
    timers[note.id] = setTimeout(async () => {
      try { await vista(note); if (document.contains(root)) { const s = root.querySelector('.dk-stada'); if (s) { s.textContent = 'vistað ' + stund(new Date().toISOString()); s.className = 'dk-stada ok'; } uppfaeraFlogu(note); } }
      catch (e) { const s = root.querySelector('.dk-stada'); if (s) { s.textContent = 'vistun mistókst: ' + (e.message || e); s.className = 'dk-stada'; } }
    }, 800);
  }
  function uppfaeraFlogu(note) {
    const b = ctx.view.querySelector('[data-karfa-open="' + note.id + '"]'); const t = totals(note.karfa || { lines: [] });
    if (b) b.textContent = '🧺 ' + (note.karfa && note.karfa.lines.length ? fmt(t.total) + ' kr' : 'Karfa');
  }
  function uppfaeraTolur(root, note) {
    const k = note.karfa; const t = totals(k);
    root.querySelectorAll('tr[data-i]').forEach(tr => { const l = k.lines[+tr.dataset.i]; const c = tr.querySelector('.dk-sum'); if (l && c) c.textContent = fmt(linuSum(l)); });
    const ex = root.querySelector('.dk-ex'), vs = root.querySelector('.dk-vsk'), tot = root.querySelector('.dk-total');
    if (ex) ex.textContent = fmt(t.ex); if (vs) vs.textContent = fmt(t.vsk); if (tot) tot.textContent = fmt(t.total) + ' kr';
  }

  // ── Vírun ────────────────────────────────────────────────────────────────
  function skruna(id) { const c = ctx.view.querySelector('.ds-note[data-id="' + id + '"]'); if (c) { try { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { c.scrollIntoView(); } } }
  async function opna(id) {
    const note = ctx.NOTES.find(n => String(n.id) === String(id)); if (!note) return;
    try { await hladaVorur(); } catch (e) { alert('Náði ekki vörulistanum: ' + (e.message || e)); }
    const ny = tryggjaKorfu(note);
    opin = note.id; ctx.teikna(); skruna(note.id);
    if (ny) { try { await vista(note); ctx.teikna(); } catch (_) {} }
  }
  function wire(c) {
    ctx = c; const $v = ctx.view;
    // takkar á spjöldum (01) og í Valið (03)
    $v.querySelectorAll('[data-karfa-open]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const id = Number(b.dataset.karfaOpen); if (opin === id) { opin = null; ctx.teikna(); } else opna(id); }));
    // 🧺 Ný karfa á valinn kúnna (03)
    const ny = $v.querySelector('#ds-val [data-act="nykarfa"]');
    if (ny) ny.addEventListener('click', async () => {
      const kunni = ctx.selKunni(); if (!kunni) return;
      ny.disabled = true;
      const row = await ctx.skra('🧺 Karfa — ' + kunni, { worksite_name: kunni, felag: 'slokkvitaeki' });
      if (row && !row.pending) { ctx.addNote(row); await opna(row.id); } else if (row) { alert('Netið er úti — punkturinn er í biðröð; karfan opnast þegar hann er kominn inn.'); }
      ny.disabled = false;
    });
    // 🧺 Karfa í skráningarstikunni efst — einu sinni
    const kb = document.getElementById('ds-karfa');
    if (kb && !kb.dataset.wired) { kb.dataset.wired = '1'; kb.addEventListener('click', async () => {
      if (ctx.felVal() !== 'slokkvitaeki') ctx.setFelag('slokkvitaeki');
      const raw = ctx.inputValue() || '🧺 Karfa';
      kb.disabled = true;
      const row = await ctx.skra(raw, { felag: 'slokkvitaeki' });
      if (row && !row.pending) { ctx.addNote(row); await opna(row.id); } else if (row) alert('Netið er úti — punkturinn er í biðröð; karfan opnast þegar hann er kominn inn.');
      kb.disabled = false;
    }); }
    // ritillinn sjálfur
    $v.querySelectorAll('.ds-karfa').forEach(root => {
      const note = ctx.NOTES.find(n => String(n.id) === root.dataset.karfa); if (!note || !note.karfa) return;
      const k = note.karfa;
      root.addEventListener('click', e => e.stopPropagation());
      root.addEventListener('input', e => {
        const el = e.target; const f = el.dataset.f; if (!f) return;
        const tr = el.closest('tr[data-i]');
        if (tr) {
          const l = k.lines[+tr.dataset.i]; if (!l) return;
          if (f === 'desc') { l.desc = el.value; const v = voraEftirNafni(el.value); if (v) { l.product_id = v.id; l.type = 'product'; l.unit_price_ex_vat = v.verd; l.vsk_pct = v.vsk; delete l.hint; const p = tr.querySelector('[data-f="price"]'); if (p) p.value = tala(v.verd); } else if (l.product_id) { l.product_id = null; l.type = 'service'; }
            const pid = tr.querySelector('.dk-pid'); if (pid) { pid.textContent = l.product_id ? '#' + l.product_id + (v ? ' · ' + (v.flokkur || 'vara') : '') : 'þjónusta / vinna (frjáls lína)'; pid.className = 'dk-pid' + (l.product_id ? '' : ' ny'); } }
          if (f === 'qty') l.qty = num(el.value);
          if (f === 'price') l.unit_price_ex_vat = num(el.value);
          if (f === 'disc') l.disc_pct = num(el.value);
        } else if (f === 'discount_pct') k.discount_pct = num(el.value);
        else if (f === 'athugasemd') k.athugasemd = el.value;
        k.auto = false;
        uppfaeraTolur(root, note); vistaSidar(note, root);
      });
      root.addEventListener('click', async e => {
        const b = e.target.closest('[data-dk]'); if (!b) return;
        const act = b.dataset.dk;
        if (act === 'loka') { opin = null; ctx.teikna(); return; }
        if (act === 'del') { const tr = b.closest('tr[data-i]'); k.lines.splice(+tr.dataset.i, 1); k.auto = false; vistaSidar(note, root); ctx.teikna(); return; }
        if (act === 'add' || act === 'addsvc') { k.lines.push(nyLina(act === 'addsvc' ? 'service' : 'product')); k.auto = false; ctx.teikna(); const r2 = ctx.view.querySelector('.ds-karfa[data-karfa="' + note.id + '"] tr:last-child input[data-f="desc"]'); if (r2) r2.focus(); vistaSidar(note, ctx.view.querySelector('.ds-karfa[data-karfa="' + note.id + '"]') || root); return; }
        if (act === 'urtexta') { if (k.lines.length && !confirm('Skipta línunum út fyrir það sem lesið er úr textanum?')) return; k.lines = fromText(note.raw); k.auto = true; ctx.teikna(); vistaSidar(note, ctx.view.querySelector('.ds-karfa[data-karfa="' + note.id + '"]') || root); return; }
        if (act === 'senda') {
          if (!k.lines.length) { alert('Karfan er tóm.'); return; }
          if (!note.worksite_name) { alert('Veldu kúnna fyrst (reiturinn „Kúnni…" fyrir ofan) — söluborðið þarf að vita á hvern reikningurinn fer.'); return; }
          b.disabled = true; b.textContent = '⏳…';
          try { clearTimeout(timers[note.id]); await vista(note, { sent: true }); }
          catch (err) { alert('Vistun mistókst: ' + (err.message || err)); b.disabled = false; b.textContent = '🧺 Senda í körfu ↗'; return; }
          window.open(POS_URL + '?karfa=' + encodeURIComponent(note.id) + '#sala', '_blank', 'noopener');
          ctx.setSync('🧺 karfa #' + note.id + ' send í söluborðið — reikningurinn er kláraður þar');
          ctx.teikna();
        }
      });
    });
  }

  window.DsKarfa = { box, badge, wire, isOpen: id => opin != null && String(opin) === String(id), open: id => opna(id), close: () => { opin = null; }, fromText, totals, version: 'v1' };
})();
