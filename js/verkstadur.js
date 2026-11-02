/* Verkstaður — mynd, heimilisfang, húsupplýsingar og teikningar per verkstað (Brunahólfs-hubbinn).
 *
 * 02.11.2026 (Agnar, Kröfu yfirlit): „vanti mynd þarna af heimilisfanginu og að það sé hægt að sjá betri upplýsingar og
 * teikningar af verkstaðnum eins og á slökkvitæki company profiles" — og svo: „setja húsnæðin í greiningu þarna, en ekki
 * slökkvitækjagreiningu, heldur aðalega að fá góðar teikningar, eða teikningarnar úr Ajour".
 *
 * Ein vél, tveir staðir: smámynd + gluggi í Kröfu yfirliti, og Viðskiptavinir · Greining (sami panill innfelldur).
 *   window.BhVerkstadur.hlada()               — sækir allar raðir verkstadur_info (smámyndir), málar á staðnum
 *   window.BhVerkstadur.smamynd(ws, titill)   — 84×54 hnappur (sama stærð með/án myndar — ekkert hopp)
 *   window.BhVerkstadur.mala()                — uppfærir smámyndir á staðnum
 *   window.BhVerkstadur.opna(ws, titill)      — gluggi
 *   window.BhVerkstadur.teikna(el, ws, opts)  — panillinn inn í gefinn hnút
 * Gögn: /api/verkstadur (tafla verkstadur_info + ajour_teikningar). Mynd og húsupplýsingar koma úr Slökkvitækja-föllunum
 * (husmynd = Street View/loftmynd, hus-upplysingar = landnr, hæðir, teikningar úr skjalasafni / map.is, landnr = leit) og eru
 * sóttar AÐEINS við smell — aldrei í lykkju. Ajour-teikningarnar setur luna-bridge/ajour-teikningar.js inn.
 */
(function () {
  'use strict';
  if (window.BhVerkstadur) return;
  const SLOKK = 'https://slokkvitaeki.netlify.app';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dmy = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const me = () => { try { return (typeof window.bhMe === 'function' ? window.bhMe() : '') || ''; } catch (_) { return ''; } };
  let VSI = (() => { try { return JSON.parse(localStorage.getItem('ky_vsi_cache') || '{}') || {}; } catch (_) { return {}; } })();   // skyndiminni; þjónninn ræður
  const geyma = () => { try { localStorage.setItem('ky_vsi_cache', JSON.stringify(VSI)); } catch (_) {} };

  async function hlada() {
    try {
      const r = await fetch('/api/verkstadur?all=1', { cache: 'no-store' }); if (!r.ok) return;
      const j = await r.json(); const m = {}; for (const x of (j.rows || [])) m[x.worksite_name] = x;
      VSI = m; geyma(); mala();
    } catch (_) {}
  }
  // Supabase-smækkun: ALLTAF resize=contain — width eitt sér SKER myndina (mælt 21.10.2026).
  const smaekka = (u, w) => /\/storage\/v1\/object\/public\//.test(u || '') ? u.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=' + (w || 240) + '&resize=contain' : u;
  const imgMedVaraleid = (u, w) => `<img src="${esc(smaekka(u, w))}" alt="" loading="lazy" onerror="if(!this.dataset.f){this.dataset.f=1;this.src=${esc(JSON.stringify(u))}}">`;
  const myndUrl = (ws) => (VSI[ws] && VSI[ws].mynd_url) || '';
  const inni = (ws) => myndUrl(ws) ? imgMedVaraleid(myndUrl(ws), 240) : '<span>＋ mynd</span>';
  function smamynd(ws, titill) {
    if (!ws) return '<span class="ky-wsm ky-wsm-tomt" aria-hidden="true"></span>';
    return `<button type="button" class="ky-wsm${myndUrl(ws) ? ' med' : ''}" data-wsm="${esc(ws)}" data-u="${esc(myndUrl(ws))}" title="${esc(titill || ws)} — mynd, heimilisfang og teikningar">${inni(ws)}</button>`;
  }
  function mala() {
    document.querySelectorAll('.ky-wsm[data-wsm]').forEach((b) => {
      const ws = b.dataset.wsm, u = myndUrl(ws);
      if (b.dataset.u === u) return; b.dataset.u = u; b.classList.toggle('med', !!u); b.innerHTML = inni(ws);
    });
  }
  // Tillaga að heimilisfangi úr nafni verkstaðar („Skùlagata 26" → „Skúlagata 26", „Hnjúkamói 9Þorlákshöfn" → „Hnjúkamói 9").
  function tillaga(ws) {
    const s = String(ws || '').normalize('NFC').replace(/[ùû]/g, 'ú').replace(/[òô]/g, 'ó').replace(/[ìî]/g, 'í').replace(/[àâ]/g, 'á').replace(/[èê]/g, 'é').trim();
    const m = /^([A-Za-zÁÐÉÍÓÚÝÞÆÖáðéíóúýþæö .-]+?)\s+(\d{1,4}[A-Za-z]?)(?![\d])/.exec(s);
    return m ? (m[1].trim() + ' ' + m[2]) : '';
  }
  // Landeignaskrá: „Skúlagata 26 (101) - L 101118" → {gata, postnr, landnr}
  async function leit(q) {
    const r = await fetch(SLOKK + '/.netlify/functions/landnr?leit=' + encodeURIComponent(q)); const j = await r.json().catch(() => ({}));
    const seen = new Set(), out = [];
    for (const x of (j.results || [])) {
      const m = /^(.+?)\s*\((\d{3})\)\s*-\s*L\s*(\d+)/.exec(String(x.label || '')); if (!m) continue;
      const k = m[1].toLowerCase() + '|' + m[2]; if (seen.has(k)) continue; seen.add(k);
      out.push({ gata: m[1].trim(), postnr: m[2], landnr: m[3] });
    }
    return out;
  }
  async function vista(body) {
    const r = await fetch('/api/verkstadur', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ by: me() }, body)) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.row) throw new Error(j.error || ('HTTP ' + r.status));
    const { teikningar, ...an } = j.row; VSI[j.row.worksite_name] = an; geyma(); mala();
    return j;
  }
  async function saekja(ws, heimilisfang, heimild) {
    const hu = await fetch(SLOKK + '/.netlify/functions/hus-upplysingar?heimilisfang=' + encodeURIComponent(heimilisfang)).then((r) => r.json()).catch(() => ({}));
    const e = hu.eign || null;
    const fullt = e && e.label ? (e.label + (e.postnr ? ', ' + e.postnr : '')) : heimilisfang;
    const hm = await fetch(SLOKK + '/api/husmynd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: fullt }) }).then((r) => r.json()).catch(() => ({}));
    const res = (hu.results || []).map((t) => ({ filename: t.filename, infoUrl: t.infoUrl, thumb: t.thumb || null, lysing: t.lysing || '', tegund: t.tegund || '', dags: t.dags || '', haed: t.haed || [], stig: t.stig || [], grunnmynd: !!t.grunnmynd, urelt: !!t.urelt }));
    res.sort((a, b) => (a.urelt - b.urelt) || (b.grunnmynd - a.grunnmynd) || String(b.dags).localeCompare(String(a.dags)));
    return vista({ action: 'vista', ws, heimilisfang, heimilisfang_heimild: heimild,
      nytt_heimilisfang: ((VSI[ws] || {}).heimilisfang || '') !== heimilisfang,
      hus: { eign: e, tillogur: hu.tillogur || {}, teikningar: hu.teikningar || {}, heimild: hu.heimild || null },
      teikningar: res.slice(0, 60),
      mynd: hm && hm.ok && hm.image ? { b64: hm.image, type: hm.contentType, heimild: hm.heimild, texti: hm.attribution || '' } : null });
  }

  const nafnAn = (s) => String(s || '').replace(/\.(pdf|jpe?g|png)$/i, '').trim();
  function ajourHtml(a) {
    if (!a) return '';
    const vk = a.verkefni || [], valin = a.valin || [], tk = a.teikningar || [];
    const val = `<select class="kyvs-ajsel" title="Ajour-verkefni verkstaðarins"><option value="">${valin.length ? 'Sjálfvirkt: ' + esc(valin.map((x) => x.project_name).join(', ')) : 'Ekkert Ajour-verkefni fannst — veldu'}</option>${vk.map((x) => `<option value="${esc(x.project_id)}"${a.handvalid === x.project_id ? ' selected' : ''}>${esc(x.project_name)} (${x.n})</option>`).join('')}</select>`;
    const grid = tk.length ? '<div class="kyvs-ajgrid">' + tk.map((t) => `<a class="kyvs-aj" href="${esc(t.mynd_url || '#')}" target="_blank" rel="noopener" title="${esc(nafnAn(t.nafn))}${t.w ? ' · ' + t.w + '×' + t.h : ''}">${t.mynd_url ? imgMedVaraleid(t.mynd_url, 520) : '<span class="kyvs-pdf">Mynd vantar</span>'}<span class="kyvs-tl">${esc(nafnAn(t.nafn) || 'Teikning')}</span><span class="kyvs-td">${valin.length > 1 ? esc(t.project_name) + ' · ' : ''}${t.n_skraningar || 0} skráningar · ${t.n_klarad || 0} kláraðar${t.sidast ? ' · síðast ' + esc(dmy(t.sidast)) : ''}</span></a>`).join('') + '</div>' : '';
    return `<div class="kyvs-th"><span class="kyvs-l">Teikningar úr Ajour</span><span>${tk.length ? tk.length + ' vinnuteikningar' : '<span style="color:var(--muted)">engar</span>'}</span>${val}</div>${grid}`;
  }

  async function teikna(el, ws, opts) {
    opts = opts || {};
    el.innerHTML = '<div class="kyvs-st">Sæki…</div>';
    let row = null, aj = null;
    try { const r = await fetch('/api/verkstadur?ws=' + encodeURIComponent(ws), { cache: 'no-store' }); const j = await r.json(); row = j.row || null; aj = j.ajour || null; } catch (_) {}
    const syna = (st) => {
      const v = row || {}, hus = v.hus || {}, e = hus.eign || {}, til = hus.tillogur || {}, tk = hus.teikningar || {}, tl = v.teikningar || [];
      const rvk = e.svfnr === '0000';
      const kort = v.heimilisfang ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((e.label ? e.label + ', ' + (e.postnr || '') : v.heimilisfang) + ' Ísland') : '';
      const flis = [e.landnr ? 'Landnr. L' + esc(e.landnr) : '', til.haedir ? esc(til.haedir) + ' hæðir' : '', til.kjallari === 'yes' ? 'kjallari' : '', til.jardhaed === 'yes' ? 'jarðhæð' : '', til.ris === 'yes' ? 'ris' : '']
        .filter(Boolean).map((x) => `<span class="kyvs-f">${x}</span>`).join('');
      const tHtml = tl.slice(0, 24).map((t) => `<a class="kyvs-tk${t.urelt ? ' urelt' : ''}" href="${esc(t.infoUrl || '#')}" target="_blank" rel="noopener" title="${esc([t.tegund, t.lysing, t.dags].filter(Boolean).join(' · '))}">${t.thumb ? `<img src="${esc(t.thumb)}" alt="" loading="lazy">` : '<span class="kyvs-pdf">PDF</span>'}<span class="kyvs-tl">${esc(t.lysing || t.filename || 'Teikning')}</span><span class="kyvs-td">${esc(t.dags ? dmy(t.dags) : '')}${t.urelt ? ' · úrelt' : ''}</span></a>`).join('');
      el.innerHTML = `
        <div class="kyvs-efst${opts.innfellt ? ' innf' : ''}">
          <div class="kyvs-mynd${v.mynd_url ? '' : ' tom'}">${v.mynd_url ? `<img src="${esc(v.mynd_url)}" alt="">` : `<div class="kyvs-engin">${v.heimilisfang ? (v.mynd_heimild === 'engin' ? 'Engin mynd fannst af þessu húsi' : 'Mynd ekki sótt enn') : 'Skráðu heimilisfang verkstaðarins til að sækja mynd og teikningar'}</div>`}${v.mynd_texti ? `<span class="kyvs-attr">${esc(v.mynd_texti)}</span>` : ''}</div>
          <div class="kyvs-hlid">
            <div class="kyvs-adr"><span class="kyvs-l">Heimilisfang</span><b>${v.heimilisfang ? esc(e.label ? e.label + (e.postnr ? ', ' + e.postnr : '') : v.heimilisfang) : '<span style="color:var(--muted);font-weight:500">óskráð</span>'}</b>${kort ? `<a href="${esc(kort)}" target="_blank" rel="noopener" class="kyvs-lk">Kort ↗</a>` : ''}<button type="button" class="kyvs-btn" data-vs="breyta">✎ ${v.heimilisfang ? 'Breyta' : 'Skrá heimilisfang'}</button></div>
            <div class="kyvs-leit" hidden><input type="text" class="kyvs-in" placeholder="t.d. Skúlagata 26" value="${esc(v.heimilisfang || tillaga(ws))}"><button type="button" class="kyvs-btn" data-vs="leita">Leita</button><div class="kyvs-cand"></div></div>
            ${flis ? `<div class="kyvs-flis">${flis}</div>` : ''}
          </div>
        </div>
        ${ajourHtml(aj)}
        ${v.heimilisfang ? `<div class="kyvs-th"><span class="kyvs-l">Teikningar úr ${rvk ? 'skjalasafni' : 'kortasjá'}</span>${tk.fjoldi ? `<span>${tk.gildandi != null ? esc(tk.gildandi) + ' gildandi af ' : ''}${esc(tk.fjoldi)}${tk.grunnmyndir ? ' · ' + esc(tk.grunnmyndir) + ' grunnmyndir' : ''}${hus.heimild ? ' · ' + esc(String(hus.heimild).split(' · ')[0]) : ''}</span>` : '<span style="color:var(--muted)">engar fundust</span>'}${rvk && e.landnr ? `<a class="kyvs-lk" target="_blank" rel="noopener" href="https://skjalasafn.reykjavik.is/fotoweb/archives/5000-A%C3%B0aluppdr%C3%A6ttir/?q=${encodeURIComponent(e.landnr)}">Allar í skjalasafni ↗</a>` : ''}</div>
          ${tHtml ? `<div class="kyvs-tgrid">${tHtml}</div>${tl.length > 24 ? `<div class="kyvs-st">${tl.length - 24} til viðbótar — sjá allar í skjalasafninu/kortasjánni.</div>` : ''}` : ''}` : ''}
        <div class="kyvs-st" data-vs-st>${st || ''}</div>
        <div class="kyvs-fot">${v.heimilisfang ? '<button type="button" class="kyvs-btn" data-vs="aftur" title="Sækja mynd og teikningar aftur">↻ Sækja aftur</button>' : ''}${opts.onLoka ? '<button type="button" class="kyvs-btn" data-vs="loka">Loka</button>' : ''}</div>`;
      const q = (s) => el.querySelector(s);
      if (opts.onLoka) q('[data-vs="loka"]').onclick = opts.onLoka;
      const leitBox = q('.kyvs-leit'), inp = q('.kyvs-in'), cand = q('.kyvs-cand'), $st = q('[data-vs-st]');
      const keyra = async (adr, heimild) => {
        $st.style.color = 'var(--muted)'; $st.textContent = 'Sæki mynd, húsupplýsingar og teikningar fyrir ' + adr + '…';
        el.querySelectorAll('.kyvs-btn').forEach((x) => { x.disabled = true; });
        try { const j = await saekja(ws, adr, heimild); row = j.row; syna(row.mynd_url ? '✓ Vistað' : '✓ Vistað — engin mynd fannst af húsinu'); }
        catch (err) { syna('<span style="color:var(--red)">✗ ' + esc(err.message || err) + '</span>'); }
      };
      const leita = async () => {
        const qq = inp.value.trim(); if (!qq) return;
        cand.innerHTML = '<span class="kyvs-st">Leita í Landeignaskrá…</span>';
        let c = []; try { c = await leit(qq); } catch (_) {}
        // Eitt nákvæmt staðfang (gata + númer, og póstnúmer ef slegið inn) → sótt strax; annars velur notandinn.
        const qg = qq.replace(/,.*$/, '').trim().toLowerCase(), qp = (/,\s*(\d{3})/.exec(qq) || [])[1];
        const nak = c.filter((x) => x.gata.toLowerCase() === qg && (!qp || x.postnr === qp));
        if (nak.length === 1) { keyra(nak[0].gata + ', ' + nak[0].postnr, 'handvirkt'); return; }
        cand.innerHTML = c.length ? c.slice(0, 8).map((x) => `<button type="button" class="kyvs-btn kyvs-c" data-a="${esc(x.gata + ', ' + x.postnr)}">${esc(x.gata)} <span style="color:var(--muted)">(${esc(x.postnr)})</span></button>`).join('') : '<span class="kyvs-st">Ekkert fannst — prófaðu götuheiti og húsnúmer, t.d. „Laugavegur 170".</span>';
        cand.querySelectorAll('.kyvs-c').forEach((x) => { x.onclick = () => keyra(x.dataset.a, 'handvirkt'); });
      };
      q('[data-vs="breyta"]').onclick = () => { leitBox.hidden = !leitBox.hidden; if (!leitBox.hidden) { inp.focus(); inp.select(); } };
      q('[data-vs="leita"]').onclick = leita;
      inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); leita(); } });
      const aft = q('[data-vs="aftur"]'); if (aft) aft.onclick = () => keyra(row.heimilisfang, row.heimilisfang_heimild || 'handvirkt');
      const ajs = q('.kyvs-ajsel');
      if (ajs) ajs.onchange = async () => {
        $st.style.color = 'var(--muted)'; $st.textContent = 'Vista Ajour-verkefni…';
        try {
          await vista({ action: 'ajour', ws, ajour_project_id: ajs.value || null });
          const r = await fetch('/api/verkstadur?ws=' + encodeURIComponent(ws), { cache: 'no-store' }); const j = await r.json(); row = j.row || row; aj = j.ajour || null; syna('✓ Vistað');
        } catch (err) { $st.style.color = 'var(--red)'; $st.textContent = '✗ ' + (err.message || err); }
      };
      if (!v.heimilisfang) { leitBox.hidden = false; if (inp.value) leita(); else inp.focus(); }
    };
    syna('');
  }

  function opna(ws, titill) {
    const old = document.getElementById('ky-vs-modal'); if (old) old.remove();
    const w = document.createElement('div'); w.id = 'ky-vs-modal';
    w.style.cssText = 'position:fixed;inset:0;z-index:100080;background:rgba(10,10,9,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    w.innerHTML = `<div class="kyvs"><div class="kyvs-h"><div><div class="kyvs-t">${esc(titill || ws)}</div><div class="kyvs-s">Verkstaður</div></div><button type="button" class="kyvs-x" title="Loka">×</button></div><div class="kyvs-b"></div></div>`;
    document.body.appendChild(w);
    const close = () => w.remove();
    w.addEventListener('click', (e) => { if (e.target === w) close(); });
    w.querySelector('.kyvs-x').addEventListener('click', close);
    w.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    teikna(w.querySelector('.kyvs-b'), ws, { onLoka: close });
  }

  window.BhVerkstadur = { hlada, smamynd, mala, opna, teikna, mynd: myndUrl, tillaga };
})();
