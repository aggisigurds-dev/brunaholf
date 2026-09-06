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
  // Í síma opnast karfan sem YFIRLIT (skjáskot/senda áfram) — ritillinn einn smell í burtu („✏️ Breyta").
  // Valið man sig per punkt í lotunni svo teikning eftir breytingu hendi manni ekki aftur í yfirlitið.
  const compactPref = {};
  const isMobile = () => !!(window.matchMedia && window.matchMedia('(max-width:720px)').matches);

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

  // ── Kostnaðarreikningar (Agnar 06.09.2026: „vantar einhvers konar Redder form skráningu") ──
  // Birgjareikningar sem eru endurrukkaðir á kúnnann: innkaupsverð + afslátturinn sem VIÐ fengum
  // → listaverð = innkaup ÷ (1 − afsl.) → söluverð (má yfirskrifa). Regla (Charlize #410):
  // afsláttur birgja er framlegð okkar og kemur aldrei á reikning kúnna. Búa í karfa.kostnadur.
  const listaverd = (cost, disc) => { const d = num(disc); return d >= 100 ? num(cost) : num(cost) / (1 - d / 100); };
  const nyKostLina = (inv, extra) => Object.assign({ desc: '', qty: 1, cost: 0, disc_pct: num(inv.afsl_pct), disc_manual: false, sell: 0, sell_manual: false, vsk_pct: 24 }, extra || {});
  const nyKost = () => ({ id: 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), birgir: '', nr: '', dags: new Date().toISOString().slice(0, 10), afsl_pct: 0, pdf: null, lines: [], created_at: new Date().toISOString() });
  function kostTotals(inv) {
    let innk = 0, sala = 0;
    for (const l of (inv.lines || [])) { innk += num(l.qty) * num(l.cost); sala += num(l.qty) * num(l.sell); }
    return { innk: Math.round(innk), sala: Math.round(sala), fl: Math.round(sala - innk), pct: sala > 0 ? Math.round((sala - innk) / sala * 100) : 0 };
  }
  function uppfaeraSell(l) { if (!l.sell_manual) l.sell = Math.round(listaverd(l.cost, l.disc_pct) * 100) / 100; }
  // Límdar línur af reikningi: „3 x Reykskynjari 12.500" · „Reykskynjari 3 stk 12.500 kr" · „Kapall 25 m 190" (síðasta talan = einingaverð).
  function lesaKostLinur(text, inv) {
    const out = [];
    for (let s of String(text || '').split('\n')) {
      s = s.replace(/^[\s•\-–*·]+/, '').replace(/\s+kr\.?\s*$/i, '').trim(); if (!s) continue;
      let m, qty = 1, desc = s, price = 0;
      if ((m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:[×x]|stk\.?)?\s+(.+?)\s+([\d.]+(?:,\d+)?)$/))) { qty = num(m[1]); desc = m[2]; price = num(m[3]); }
      else if ((m = s.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(?:[×x]|stk\.?)\s+([\d.]+(?:,\d+)?)$/))) { desc = m[1]; qty = num(m[2]); price = num(m[3]); }
      else if ((m = s.match(/^(.+?)\s+([\d.]+(?:,\d+)?)$/))) { desc = m[1]; price = num(m[2]); }
      else continue;
      desc = desc.replace(/\s+(stk|x)\.?$/i, '').trim(); if (!desc) continue;
      const l = nyKostLina(inv, { desc, qty: qty || 1, cost: price }); uppfaeraSell(l); out.push(l);
    }
    return out;
  }
  // Línurnar í körfuna á söluverði: vara úr vörulista → OKKAR listaverð; handstillt söluverð → það; annars reiknað listaverð.
  function tilKorfu(note, inv) {
    const k = note.karfa; const ref = 'kost:' + inv.id; const hint = (inv.birgir || 'kostnaðarreikningur') + (inv.nr ? ' ' + inv.nr : '');
    k.lines = (k.lines || []).filter(l => l.kost_ref !== ref);
    let n = 0;
    for (const l of (inv.lines || [])) {
      if (!(num(l.qty) > 0)) continue;
      const v = l.sell_manual ? null : voraEftirNafni(l.desc);
      k.lines.push(v
        ? { type: 'product', desc: v.nafn, qty: num(l.qty), unit_price_ex_vat: v.verd, vsk_pct: v.vsk, product_id: v.id, disc_pct: 0, kost_ref: ref, hint }
        : { type: 'product', desc: l.desc, qty: num(l.qty), unit_price_ex_vat: num(l.sell), vsk_pct: num(l.vsk_pct) || 24, product_id: null, disc_pct: 0, kost_ref: ref, hint });
      n++;
    }
    k.auto = false;
    ctx.setSync('🧺 ' + n + ' lín' + (n === 1 ? 'a' : 'ur') + ' úr ' + hint + ' settar í körfuna á söluverði');
    return n;
  }
  function uppfaeraKostTolur(invEl, inv) {
    if (!invEl || !inv) return;
    invEl.querySelectorAll('tr[data-kl]').forEach(tr => {
      const l = inv.lines[+tr.dataset.kl]; if (!l) return;
      const di = tr.querySelector('[data-kf="disc"]'); if (di && document.activeElement !== di) di.value = tala(l.disc_pct);
      const se = tr.querySelector('[data-kf="sell"]'); if (se && document.activeElement !== se) { se.value = tala(l.sell); se.classList.toggle('manual', !!l.sell_manual); }
      const li = tr.querySelector('.dk-lista'); if (li) li.textContent = fmt(listaverd(l.cost, l.disc_pct));
      const su = tr.querySelector('.dk-ksum'); if (su) su.textContent = fmt(num(l.qty) * num(l.sell));
    });
    const t = kostTotals(inv); const q = s => invEl.querySelector(s);
    if (q('.k-innk')) q('.k-innk').textContent = fmt(t.innk);
    if (q('.k-sala')) q('.k-sala').textContent = fmt(t.sala);
    if (q('.k-fl')) q('.k-fl').textContent = fmt(t.fl) + ' (' + t.pct + '%)';
  }
  function birgjaListi() {
    const names = new Set();
    (ctx.NOTES || []).forEach(n => (((n.karfa || {}).kostnadur) || []).forEach(inv => { if (inv.birgir) names.add(inv.birgir); }));
    let dl = document.getElementById('ds-birgjar');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'ds-birgjar'; document.body.appendChild(dl); }
    dl.innerHTML = [...names].sort((a, b) => a.localeCompare(b, 'is')).map(n => '<option value="' + esc(n) + '">').join('');
  }
  // 📎 PDF/mynd af reikningnum: innra viðhengi (sendist aldrei) — hangir á reikningnum OG punktinum.
  function hengjaPdf(note, inv, btn) {
    const f0 = document.createElement('input'); f0.type = 'file'; f0.accept = 'image/*,application/pdf'; f0.hidden = true; document.body.appendChild(f0);
    f0.addEventListener('change', async () => {
      const f = f0.files && f0.files[0]; f0.remove(); if (!f) return;
      if (f.size > 4 * 1024 * 1024) { alert('Skráin er stærri en 4 MB'); return; }
      btn.disabled = true; btn.textContent = '⏳…';
      try {
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
        const d = new Date(); const ym = d.getFullYear() + '-' + pad(d.getMonth() + 1);
        const j = await ctx.api('/api/pdf-store', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName: f.name, contentBase64: b64, mimeType: f.type, worksite_name: 'Drög-stöð', work_month: ym, doc_type: 'innra' }) });
        inv.pdf = { drive_file_id: j.id, title: f.name, url: j.public_url };
        try { const r = await ctx.post({ action: 'attach', id: note.id, attachment: inv.pdf }); if (r && r.row && Array.isArray(r.row.attachments)) note.attachments = r.row.attachments; } catch (_) {}
        await vista(note); ctx.teikna();
      } catch (e) { alert('Upphleðsla mistókst: ' + (e.message || e)); btn.disabled = false; btn.textContent = '📎 PDF'; }
    });
    f0.click();
  }
  function kostHtml(note) {
    const k = note.karfa || {}; const list = Array.isArray(k.kostnadur) ? k.kostnadur : [];
    let h = '<div class="dk-kost"><div class="dk-kost-h"><b>🧾 Kostnaðarreikningar</b><small>innkaup sem eru endurrukkuð — listaverð = innkaup ÷ (1 − afsl. okkar); söluverð má yfirskrifa</small>'
      + '<button type="button" data-dk="kost-add" style="' + ctx.KEY + '" title="Skrá birgjareikning: birgir, nr., dags., PDF og línur með innkaupsverði og afslætti okkar">+ Kostnaðarreikningur</button></div>';
    list.forEach((inv, i) => {
      const t = kostTotals(inv);
      const rows = (inv.lines || []).map((l, j) => '<tr data-kl="' + j + '"><td><input data-kf="desc" list="ds-vorur" value="' + esc(l.desc) + '" placeholder="Vara / lýsing af reikningi…"></td>'
        + '<td style="width:58px"><input class="n" data-kf="qty" value="' + esc(tala(l.qty)) + '" inputmode="decimal"></td>'
        + '<td style="width:92px"><input class="n" data-kf="cost" value="' + esc(tala(l.cost)) + '" inputmode="decimal" title="Innkaupsverð án vsk (eining)"></td>'
        + '<td style="width:54px"><input class="n" data-kf="disc" value="' + esc(tala(l.disc_pct)) + '" inputmode="decimal" title="Afslátturinn sem VIÐ fengum %"></td>'
        + '<td class="r dk-lista" title="Listaverð = innkaup ÷ (1 − afsl.)">' + fmt(listaverd(l.cost, l.disc_pct)) + '</td>'
        + '<td style="width:92px"><input class="n sell' + (l.sell_manual ? ' manual' : '') + '" data-kf="sell" value="' + esc(tala(l.sell)) + '" inputmode="decimal" title="Söluverð án vsk á reikning kúnna — sjálfgefið listaverðið"></td>'
        + '<td class="r dk-ksum">' + fmt(num(l.qty) * num(l.sell)) + '</td>'
        + '<td style="width:26px"><button type="button" class="dk-x" data-dk="kost-ldel" title="Taka línu út">✕</button></td></tr>').join('');
      h += '<div class="dk-kinv" data-ki="' + i + '"><div class="dk-kinv-h">'
        + '<input data-kf="birgir" list="ds-birgjar" value="' + esc(inv.birgir) + '" placeholder="Birgir (t.d. Securitas, Rönning, Redder…)">'
        + '<input data-kf="nr" value="' + esc(inv.nr) + '" placeholder="Reikn.nr">'
        + '<input data-kf="dags" type="date" value="' + esc(inv.dags || '') + '">'
        + '<label>Afsl. okkar % <input class="n" data-kf="afsl_pct" value="' + esc(tala(inv.afsl_pct)) + '" inputmode="decimal" title="Afslátturinn sem við fengum á reikningnum — fer á allar línur sem ekki hafa sér-afslátt"></label>'
        + (inv.kredit ? '<span class="ds-chip warn" title="Kreditnóta — magn neikvætt, dregst frá; fer ekki sjálfkrafa í körfu">↩ KREDIT</span>' : '')
        + (inv.ai && inv.ai.afhending ? '<span class="ds-chip" title="Afhendingarstaður á reikningnum — vísbending um kúnna, ekki sönnun">📍 ' + esc(inv.ai.afhending) + '</span>' : '')
        + (inv.pdf && inv.pdf.url ? '<a class="ds-chip" href="' + esc(inv.pdf.url) + '" target="_blank" rel="noopener" title="Innra viðhengi — sendist aldrei">📎 ' + esc((inv.pdf.title || 'PDF').slice(0, 28)) + '</a>' : '<button type="button" data-dk="kost-pdf" style="' + ctx.KEY + '" title="Hengja PDF/mynd af reikningnum við (innra viðhengi, sendist aldrei)">📎 PDF</button>')
        + '<button type="button" class="dk-x" data-dk="kost-del" title="Eyða kostnaðarreikningi úr punktinum">✕</button></div>'
        + '<div class="dk-kt-wrap"><table class="dk-kt"><thead><tr><th>Lýsing</th><th>Magn</th><th>Innkaup án vsk</th><th>Afsl %</th><th style="text-align:right">Listaverð</th><th>Söluverð án vsk</th><th style="text-align:right">Samtals sala</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        + '<div class="dk-kinv-tools"><button type="button" data-dk="kost-line" style="' + ctx.KEY + '">+ Lína</button><button type="button" data-dk="kost-paste" style="' + ctx.KEY + '" title="Líma línur af reikningnum („3 x Reykskynjari 12.500", ein í hverja línu) — þær lesast í töfluna">📋 Líma línur</button><span class="sp"></span>'
        + '<span class="dk-kinv-tot">Innkaup <b class="k-innk">' + fmt(t.innk) + '</b> · Endurkrafa <b class="k-sala">' + fmt(t.sala) + '</b> · Framlegð <b class="k-fl">' + fmt(t.fl) + ' (' + t.pct + '%)</b></span>'
        + '<button type="button" data-dk="kost-tilkorfu" style="' + ctx.GOLD + '" title="Setur línurnar í draft-körfuna á söluverði (skiptir út fyrri línum þessa reiknings)">🧺 Setja í körfu</button></div>'
        + '<textarea class="dk-kpaste" hidden placeholder="Límdu línur af reikningnum — ein í hverja línu:&#10;3 x Reykskynjari Hochiki 12.500&#10;Kapall 2x0,75 25 m 190&#10;…og smelltu á „Lesa línur"."></textarea>'
        + '<div class="dk-kinv-tools dk-kpastebar" hidden><button type="button" data-dk="kost-lesa" style="' + ctx.GOLD + '">Lesa línur</button><button type="button" data-dk="kost-paste" style="' + ctx.KEY + '">Hætta við</button></div>'
        + '</div>';
    });
    h += '</div>';
    return h;
  }

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
      // 🧾 Kostnaðarreikningar (06.09.2026): birgjareikningar sem eru endurrukkaðir — „Redder-form" fyrir aðra birgja
      '.dk-kost{margin-top:10px;border-top:1px dashed var(--edge,#c9c2b3);padding-top:8px}',
      '.dk-kost-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}.dk-kost-h b{font-size:12.5px}.dk-kost-h small{color:var(--muted);font-size:11px;flex:1 1 200px}',
      '.dk-kinv{border:1px solid var(--line,#e6e1d6);border-radius:6px;padding:8px 10px;margin-top:6px;background:var(--bg-2,#ece7dc)}',
      '.dk-kinv-h{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.dk-kinv-h input{height:30px;padding:0 7px;border:1px solid var(--edge,#c9c2b3);border-radius:4px;background:var(--input-bg,#f6f3ec);font:inherit;font-size:12.5px;color:var(--ink);box-sizing:border-box;min-width:0}',
      '.dk-kinv-h input[data-kf="birgir"]{flex:2 1 150px}.dk-kinv-h input[data-kf="nr"]{flex:1 1 84px}.dk-kinv-h input[data-kf="dags"]{flex:1 1 130px}.dk-kinv-h label{font-size:11.5px;color:var(--muted);display:inline-flex;align-items:center;gap:5px}.dk-kinv-h label input{width:56px;text-align:right}',
      '.dk-kt-wrap{overflow-x:auto;margin-top:6px}.dk-kt{width:100%;min-width:560px;border-collapse:collapse}.dk-kt th{font-family:var(--font-mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:2px 4px;font-weight:600}',
      '.dk-kt td{padding:3px 4px;vertical-align:middle;border-top:1px solid var(--line,#e6e1d6)}.dk-kt td.r{text-align:right;font-family:var(--font-mono);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dk-kt input{height:30px;padding:0 6px;border:1px solid var(--edge,#c9c2b3);border-radius:4px;background:var(--input-bg,#f6f3ec);font:inherit;font-size:12.5px;color:var(--ink);width:100%;box-sizing:border-box;min-width:0}.dk-kt input.n{text-align:right;font-family:var(--font-mono);font-variant-numeric:tabular-nums}.dk-kt input.sell.manual{border-color:var(--gold-deep,#8f6a1c);background:#fff}',
      '.dk-kinv-tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}.dk-kinv-tools .sp{flex:1}.dk-kinv-tot{font-family:var(--font-mono);font-size:11px;color:var(--muted)}.dk-kinv-tot b{color:var(--ink)}',
      '.dk-kpaste{width:100%;box-sizing:border-box;margin-top:6px;min-height:72px;padding:6px 8px;border:1px dashed var(--edge,#c9c2b3);border-radius:4px;background:#fff;font:inherit;font-size:12px}',
      '.ds-karfa.compact .dk-kost{display:none}',
      // Yfirlit (Agnar 05.09.2026): „smækka svo ég sjái allt á einum skjá — skjáskot og senda áfram"
      '.ds-karfa.compact .dk-t,.ds-karfa.compact .dk-tools,.ds-karfa.compact .dk-nota,.ds-karfa.compact .dk-tot,.ds-karfa.compact .dk-cta,.ds-karfa.compact .dk-head{display:none}',
      '.dk-yfirlit{background:#fff;color:#161513;border:1px solid #d9d3c6;border-radius:6px;padding:10px 12px;font-size:12px;line-height:1.3}',
      '.dk-yfirlit .y-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;border-bottom:2px solid #161513;padding-bottom:5px;margin-bottom:6px}.dk-yfirlit .y-head b{font-family:var(--font-display,serif);font-size:15px}.dk-yfirlit .y-head span{font-family:var(--font-mono);font-size:10.5px;color:#6f685c}',
      '.dk-yfirlit .y-kunni{font-size:12px;margin-bottom:6px}.dk-yfirlit .y-kunni small{color:#6f685c;font-family:var(--font-mono);font-size:10.5px}',
      '.dk-yfirlit table{width:100%;border-collapse:collapse}.dk-yfirlit td{padding:3px 0;border-top:1px solid #ece7dc;vertical-align:top}.dk-yfirlit td.r{text-align:right;font-family:var(--font-mono);font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:8px}.dk-yfirlit td.n{color:#6f685c;font-family:var(--font-mono);font-size:10.5px;white-space:nowrap;padding-right:6px}',
      '.dk-yfirlit .y-tot td{border-top:1px solid #161513;font-weight:600}.dk-yfirlit .y-tot.big td{font-size:14px;border-top:0;padding-top:2px}.dk-yfirlit .y-tot.big td.r{font-family:var(--font-display,serif);font-size:16px}',
      '.dk-yfirlit .y-note{margin-top:7px;font-size:10.5px;color:#6f685c;border-top:1px dashed #d9d3c6;padding-top:5px}',
      '.dk-yfirlit .y-bar{display:flex;gap:6px;margin-top:8px}.dk-yfirlit .y-bar button{flex:1;height:34px;font:inherit;font-size:12px;font-weight:700;border:1px solid #c9c2b3;border-radius:4px;background:#f6f3ec;color:#161513;cursor:pointer}',
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
    note.karfa = { lines: fromText(note.raw), kostnadur: [], discount_pct: 0, athugasemd: '', auto: true, kunni: null, totals: null };
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
      + '<button type="button" class="dk-x" data-dk="yfirlit" title="Yfirlit — allt á einum skjá (skjáskot / senda áfram)">🔍</button>'
      + '<button type="button" class="dk-x" data-dk="loka" title="Loka (karfan geymist)">✕</button></div>'
      + '<table class="dk-t"><thead><tr><th>Vara / þjónusta</th><th>Magn</th><th>Ein.verð án vsk</th><th>Afsl %</th><th style="text-align:right">Samtals</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<div class="dk-tools"><button type="button" data-dk="add" style="' + ctx.KEY + '">+ Vara</button><button type="button" data-dk="addsvc" style="' + ctx.KEY + '">+ Vinna / þjónusta</button><button type="button" data-dk="urtexta" style="' + ctx.KEY + '" title="Lesa línurnar aftur úr texta punktsins (skiptir út núverandi línum)">↻ Úr punktinum</button><span class="sp"></span>'
      + '<label>Afsl. af heild % <input data-f="discount_pct" value="' + esc(tala(k.discount_pct)) + '" inputmode="decimal"></label></div>'
      + kostHtml(note)
      + '<textarea class="dk-nota" data-f="athugasemd" placeholder="Krass — hvað á eftir að athuga, hvað var sagt, afsláttur sem bíður…">' + esc(k.athugasemd || '') + '</textarea>'
      + '<div class="dk-tot"><span>Án vsk <b class="dk-ex">' + fmt(t.ex) + '</b></span><span>VSK <b class="dk-vsk">' + fmt(t.vsk) + '</b></span><span class="dk-total">' + fmt(t.total) + ' kr</span></div>'
      + '<div class="dk-cta"><button type="button" data-dk="senda" style="' + ctx.GOLD + '" title="Opnar söluborð Slökkvitækis með þessari körfu — reikningurinn verður til þar">🧺 Senda í körfu ↗</button><button type="button" data-dk="yfirlit" style="' + ctx.KEY + '" title="Samþjappað yfirlit sem kemst á einn skjá — til að skjáskjóta og senda áfram">🔍 Yfirlit</button><span class="dk-stada">' + (k.saved_at ? 'vistað ' + esc(stund(k.saved_at)) : 'óvistað') + '</span></div>'
      + '<div class="dk-yfirlit" hidden></div>'
      + '</div>';
  }
  // Samþjappað drög-spjald: kúnni · línur · samtölur — eitt skjáskot, ekkert ritanlegt.
  function yfirlitHtml(note) {
    const k = note.karfa || { lines: [] }; const ku = k.kunni || {}; const t = totals(k);
    const d = new Date(); const dags = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
    const rows = (k.lines || []).filter(l => num(l.qty) > 0 || num(l.unit_price_ex_vat) > 0).map(l =>
      '<tr><td class="n">' + esc(tala(l.qty)) + ' ×</td><td>' + esc(l.desc || '') + (num(l.disc_pct) ? ' <small style="color:#6f685c">−' + esc(tala(l.disc_pct)) + '%</small>' : '') + '</td><td class="r">' + fmt(l.unit_price_ex_vat) + '</td><td class="r">' + fmt(linuSum(l)) + '</td></tr>').join('');
    return '<div class="y-head"><b>Slökkvitæki ehf.</b><span>Drög að reikningi · ' + dags + '</span></div>'
      + '<div class="y-kunni"><b>' + esc(ku.nafn || note.worksite_name || '—') + '</b>' + (ku.kt ? ' <small>kt ' + esc(ku.kt) + '</small>' : '') + '</div>'
      + '<table><tbody>' + rows
      + (num(k.discount_pct) ? '<tr><td class="n"></td><td>Afsláttur af heild</td><td class="r"></td><td class="r">−' + esc(tala(k.discount_pct)) + '%</td></tr>' : '')
      + '<tr class="y-tot"><td class="n"></td><td>Samtals án vsk</td><td class="r"></td><td class="r">' + fmt(t.ex) + '</td></tr>'
      + '<tr class="y-tot" style="font-weight:400"><td class="n"></td><td>VSK 24%</td><td class="r"></td><td class="r">' + fmt(t.vsk) + '</td></tr>'
      + '<tr class="y-tot big"><td class="n"></td><td>Samtals m. vsk</td><td class="r"></td><td class="r">' + fmt(t.total) + ' kr</td></tr>'
      + '</tbody></table>'
      + '<div class="y-note">Drög — ekki reikningur. Einingaverð án vsk.' + (k.athugasemd ? ' ' + esc(k.athugasemd) : '') + '</div>'
      + '<div class="y-bar"><button type="button" data-dk="afrita">📋 Afrita sem texta</button><button type="button" data-dk="yfirlit">✏️ Breyta</button></div>';
  }
  function yfirlitTexti(note) {
    const k = note.karfa || { lines: [] }; const ku = k.kunni || {}; const t = totals(k);
    const L = ['Slökkvitæki ehf. — Drög að reikningi', (ku.nafn || note.worksite_name || '') + (ku.kt ? ' · kt ' + ku.kt : ''), ''];
    for (const l of (k.lines || [])) if (num(l.qty) > 0 || num(l.unit_price_ex_vat) > 0) L.push(tala(l.qty) + ' × ' + (l.desc || '') + ' @ ' + fmt(l.unit_price_ex_vat) + (num(l.disc_pct) ? ' −' + tala(l.disc_pct) + '%' : '') + ' = ' + fmt(linuSum(l)));
    if (num(k.discount_pct)) L.push('Afsláttur af heild −' + tala(k.discount_pct) + '%');
    L.push('', 'Samtals án vsk ' + fmt(t.ex) + ' kr', 'VSK 24% ' + fmt(t.vsk) + ' kr', 'Samtals m. vsk ' + fmt(t.total) + ' kr', '', 'Drög — ekki reikningur. Einingaverð án vsk.');
    return L.join('\n');
  }
  function badge(note) {
    const k = note.karfa; if (!k) return '';
    const nl = Array.isArray(k.lines) ? k.lines.length : 0, nk = Array.isArray(k.kostnadur) ? k.kostnadur.length : 0;
    if (!nl && !nk) return '';
    const t = totals(k);
    return '<span class="ds-chip karfa" title="Draft-karfa' + (k.sent_at ? ' — send í söluborð ' + esc(stund(k.sent_at)) : '') + (nk ? ' · ' + nk + ' kostnaðarreikning' + (nk === 1 ? 'ur' : 'ar') : '') + '">🧺 ' + nl + ' lín' + (nl === 1 ? 'a' : 'ur') + ' · ' + fmt(t.total) + ' kr' + (nk ? ' · 🧾 ' + nk : '') + (k.sent_at ? ' · ↗' : '') + '</span>';
  }

  // ── Vistun (sjálfkrafa, 800 ms) ──────────────────────────────────────────
  async function vista(note, opts) {
    const k = note.karfa; if (!k) return null;
    const body = { action: 'karfa', id: note.id, karfa: { lines: k.lines, kostnadur: Array.isArray(k.kostnadur) ? k.kostnadur : [], discount_pct: num(k.discount_pct), athugasemd: k.athugasemd || '', auto: !!k.auto } };
    if (opts && opts.sent) body.sent = true;
    if (note.worksite_name) body.worksite_name = note.worksite_name;
    const j = await ctx.post(body);
    if (j && j.karfa) { note.karfa = Object.assign({}, j.karfa, { lines: k.lines, kostnadur: Array.isArray(k.kostnadur) ? k.kostnadur : [] }); }
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
    // Efniskostnaðar-síðan („＋ Skrá kostnaðarreikning") biður um tóman kostnaðarreikning um leið
    let nyK = false;
    try { if (sessionStorage.getItem('ds_open_kost')) { sessionStorage.removeItem('ds_open_kost'); note.karfa.kostnadur = Array.isArray(note.karfa.kostnadur) ? note.karfa.kostnadur : []; if (!note.karfa.kostnadur.length) { note.karfa.kostnadur.push(nyKost()); nyK = true; } } } catch (_) {}
    opin = note.id; ctx.teikna(); skruna(note.id);
    if (ny || nyK) { try { await vista(note); ctx.teikna(); } catch (_) {} }
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
      const vilCompact = compactPref[note.id] !== undefined ? compactPref[note.id] : isMobile();
      if (vilCompact) { root.classList.add('compact'); const y = root.querySelector('.dk-yfirlit'); if (y) { y.hidden = false; y.innerHTML = yfirlitHtml(note); } }
      birgjaListi();
      const rootNow = () => ctx.view.querySelector('.ds-karfa[data-karfa="' + note.id + '"]') || root;
      root.addEventListener('input', e => {
        const el = e.target;
        // 🧾 kostnaðarreikningur — reitir merktir data-kf
        const kf = el.dataset.kf;
        if (kf) {
          const invEl = el.closest('.dk-kinv'); const inv = invEl ? (k.kostnadur || [])[+invEl.dataset.ki] : null; if (!inv) return;
          const trk = el.closest('tr[data-kl]');
          if (trk) {
            const l = inv.lines[+trk.dataset.kl]; if (!l) return;
            if (kf === 'desc') l.desc = el.value;
            if (kf === 'qty') l.qty = num(el.value);
            if (kf === 'cost') { l.cost = num(el.value); uppfaeraSell(l); }
            if (kf === 'disc') { l.disc_pct = num(el.value); l.disc_manual = true; uppfaeraSell(l); }
            if (kf === 'sell') { l.sell = num(el.value); l.sell_manual = true; el.classList.add('manual'); }
          } else {
            if (kf === 'birgir') inv.birgir = el.value;
            if (kf === 'nr') inv.nr = el.value;
            if (kf === 'dags') inv.dags = el.value || null;
            if (kf === 'afsl_pct') { inv.afsl_pct = num(el.value); for (const l of inv.lines) if (!l.disc_manual) { l.disc_pct = inv.afsl_pct; uppfaeraSell(l); } }
          }
          uppfaeraKostTolur(invEl, inv); vistaSidar(note, root);
          return;
        }
        const f = el.dataset.f; if (!f) return;
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
        if (act === 'yfirlit') {
          const y = root.querySelector('.dk-yfirlit'); const a = !root.classList.contains('compact');
          compactPref[note.id] = a;
          root.classList.toggle('compact', a); y.hidden = !a; if (a) { y.innerHTML = yfirlitHtml(note); try { y.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (_) {} }
          return;
        }
        if (act === 'afrita') {
          try { await navigator.clipboard.writeText(yfirlitTexti(note)); b.textContent = '✓ Afritað'; setTimeout(() => { b.textContent = '📋 Afrita sem texta'; }, 1500); }
          catch (_) { alert(yfirlitTexti(note)); }
          return;
        }
        // 🧾 kostnaðarreikningar
        if (act === 'kost-add') { k.kostnadur = Array.isArray(k.kostnadur) ? k.kostnadur : []; k.kostnadur.push(nyKost()); ctx.teikna(); vistaSidar(note, rootNow()); const bi = rootNow().querySelector('.dk-kinv:last-of-type [data-kf="birgir"]'); if (bi) bi.focus(); return; }
        if (act.startsWith('kost-')) {
          const invEl = b.closest('.dk-kinv'); const ki = invEl ? +invEl.dataset.ki : -1; const inv = ki >= 0 ? (k.kostnadur || [])[ki] : null; if (!inv) return;
          if (act === 'kost-del') { if (!confirm('Eyða þessum kostnaðarreikningi úr punktinum?' + (inv.pdf ? ' (Viðhengið hangir áfram á punktinum.)' : ''))) return; k.kostnadur.splice(ki, 1); ctx.teikna(); vistaSidar(note, rootNow()); return; }
          if (act === 'kost-line') { inv.lines.push(nyKostLina(inv)); ctx.teikna(); const d2 = rootNow().querySelector('.dk-kinv[data-ki="' + ki + '"] tr[data-kl]:last-child [data-kf="desc"]'); if (d2) d2.focus(); vistaSidar(note, rootNow()); return; }
          if (act === 'kost-ldel') { const tr = b.closest('tr[data-kl]'); inv.lines.splice(+tr.dataset.kl, 1); ctx.teikna(); vistaSidar(note, rootNow()); return; }
          if (act === 'kost-paste') { const ta = invEl.querySelector('.dk-kpaste'), bar = invEl.querySelector('.dk-kpastebar'); const show = ta.hidden; ta.hidden = !show; bar.hidden = !show; if (show) ta.focus(); return; }
          if (act === 'kost-lesa') {
            const ta = invEl.querySelector('.dk-kpaste'); const nyjar = lesaKostLinur(ta.value, inv);
            if (!nyjar.length) { alert('Fann engar línur — sniðið er „3 x Vara 12.500" (ein vara í hverja línu, síðasta talan = einingaverð).'); return; }
            inv.lines = inv.lines.concat(nyjar); ctx.teikna(); vistaSidar(note, rootNow()); return;
          }
          if (act === 'kost-pdf') { hengjaPdf(note, inv, b); return; }
          if (act === 'kost-tilkorfu') {
            if (!(inv.lines || []).some(l => num(l.qty) > 0)) { alert('Engar línur með magni á reikningnum.'); return; }
            tilKorfu(note, inv); ctx.teikna(); vistaSidar(note, rootNow()); return;
          }
          return;
        }
        if (act === 'del') { const tr = b.closest('tr[data-i]'); k.lines.splice(+tr.dataset.i, 1); k.auto = false; vistaSidar(note, root); ctx.teikna(); return; }
        if (act === 'add' || act === 'addsvc') { k.lines.push(nyLina(act === 'addsvc' ? 'service' : 'product')); k.auto = false; ctx.teikna(); const r2 = ctx.view.querySelector('.ds-karfa[data-karfa="' + note.id + '"] tr:last-child input[data-f="desc"]'); if (r2) r2.focus(); vistaSidar(note, ctx.view.querySelector('.ds-karfa[data-karfa="' + note.id + '"]') || root); return; }
        if (act === 'urtexta') { if (k.lines.length && !confirm('Skipta línunum út fyrir það sem lesið er úr textanum?')) return; k.lines = fromText(note.raw); k.auto = true; ctx.teikna(); vistaSidar(note, ctx.view.querySelector('.ds-karfa[data-karfa="' + note.id + '"]') || root); return; }
        if (act === 'senda') {
          if (!k.lines.length) { alert('Karfan er tóm.'); return; }
          if (!note.worksite_name) { alert('Veldu kúnna fyrst (reiturinn „Kúnni…" fyrir ofan) — söluborðið þarf að vita á hvern reikningurinn fer.'); return; }
          b.disabled = true; b.textContent = '⏳…';
          try { clearTimeout(timers[note.id]); await vista(note, { sent: true }); }
          catch (err) { alert('Vistun mistókst: ' + (err.message || err)); b.disabled = false; b.textContent = '🧺 Senda í körfu ↗'; return; }
          const url = POS_URL + '?karfa=' + encodeURIComponent(note.id) + '#sala';
          // Innfelld í Slökkvitæki-appið (Big Boss / Fjármál, ?embed=1): færa allan gluggann á söluborðið
          // í stað þess að opna nýjan flipa — sama app, karfan bíður þar. Annars nýr flipi.
          let faert = false;
          if (window.top !== window) { try { window.top.location.href = url; faert = true; } catch (_) { faert = false; } }
          if (!faert) window.open(url, '_blank', 'noopener');
          ctx.setSync('🧺 karfa #' + note.id + ' send í söluborðið — reikningurinn er kláraður þar');
          ctx.teikna();
        }
      });
    });
  }

  window.DsKarfa = { box, badge, wire, isOpen: id => opin != null && String(opin) === String(id), open: id => opna(id), close: () => { opin = null; }, fromText, totals, version: 'v1' };
})();
