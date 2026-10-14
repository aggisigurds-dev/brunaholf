// afkost.js — Afköst-flipinn (Boss-útlit). Les /api/afkost og teiknar:
//   · 3 mánaða spjöld með samanburði við fyrri 3 mánuði
//   · 14 dagar: verkbeiðnir inn/klárað · tæki yfirfarin/hlaðin á verkstæði · CO₂-hylki · úttektir
//   · sölur eftir sölurás, vikulega
//   · tekjugreining eftir mánuðum: þjónustuflokkur / vöruflokkur / tækjategund / sölurás (kr án vsk)
//   · tæki í úttektarskýrslum eftir skoðunarmánuði
//   · Stólpi-sagan eftir árum (2020–2026)
// Endursmíðað 14.10.2026 (Agnar: „það hefur aldrei virkað"). Heimildir og rökin: netlify/functions/afkost.js.
// Gull er skraut, aldrei gögn (DESIGN.md Boss): gagnalitir eru blár, grænn, terra og stál.
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = n => String(n).padStart(2, '0');
  const fmtN = n => (Math.round(Number(n) || 0)).toLocaleString('is-IS').replace(/,/g, '.');
  const fmtKr = n => fmtN(n) + ' kr';
  const fmtDay = iso => { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? iso : p2(d.getDate()) + '/' + p2(d.getMonth() + 1); };
  const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const MAN = ['jan', 'feb', 'mar', 'apr', 'maí', 'jún', 'júl', 'ágú', 'sep', 'okt', 'nóv', 'des'];
  const fmtYm = ym => { const [y, m] = String(ym).split('-'); return (MAN[+m - 1] || m) + ' ’' + String(y).slice(-2); };
  const pct = (now, prev) => { if (!prev) return now ? 'nýtt' : '±0%'; const p = Math.round((now - prev) / prev * 100); return (p > 0 ? '+' : '') + p + '%'; };

  // Gagnalitir (ekki gull): blár = inn/verslun, grænn = klárað/yfirfarið, terra = hlaðið, stál = CO₂/annað, dökkblár = úttektir
  const C = { bla: '#5980a6', blaDj: '#2a4763', graen: '#2f7a4a', terra: '#b5522a', stal: '#8f8776', ink: '#161513', gull: '#8a6a1c', ljos: '#c9c2b3' };
  const FLOKK_LITIR = [C.graen, C.terra, C.stal, C.bla, C.blaDj, '#6f685c', '#a89f8c', '#3f3a33', C.ljos, '#d9d3c6', '#7a5a12', '#4a463f', '#bfb7a6', '#e6e1d6'];

  const S = { data: null, months: 6, greining: 'thjonusta', view: null };

  // ── Súlurit: hópaðar súlur (einn hópur á dag/viku) ─────────────────────────
  function bars(rows, keys, opts) {
    const o = Object.assign({ h: 130, fmt: fmtN }, opts || {});
    const max = Math.max(1, ...rows.flatMap(r => keys.map(k => +r[k.key] || 0)));
    const w = Math.max(14, Math.floor(60 / keys.length));
    return `<div style="display:flex;align-items:flex-end;gap:6px;height:${o.h}px;padding:0 2px">
      ${rows.map(r => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;height:100%">
          <div style="flex:1;display:flex;align-items:flex-end;gap:2px;width:100%;justify-content:center;min-height:0">
            ${keys.map(k => { const v = +r[k.key] || 0; return `<div title="${esc(r._label)} · ${esc(k.label)}: ${esc(o.fmt(v))}" style="width:${w}%;height:${v ? Math.max(2, v / max * 100) : 0}%;background:${k.color};border-radius:2px 2px 0 0;${v ? '' : 'border-top:1px solid ' + C.ljos + ';'}"></div>`; }).join('')}
          </div>
          <div class="boss-mono" style="font-size:9.5px;color:var(--muted-2);white-space:nowrap">${esc(r._label)}</div>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:14px;margin-top:10px;flex-wrap:wrap">
      ${keys.map(k => `<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink-2)"><span style="width:10px;height:10px;border-radius:2px;background:${k.color};display:inline-block"></span>${esc(k.label)}${k.sum != null ? ` <b class="boss-mono">${esc(o.fmt(k.sum))}</b>` : ''}</div>`).join('')}
    </div>`;
  }
  // ── Staflaðar súlur (einn mánuður á súlu, flokkarnir staflaðir) ────────────
  function stacked(rows, series, opts) {
    const o = Object.assign({ h: 170, fmt: fmtKr }, opts || {});
    const tot = rows.map(r => series.reduce((a, s) => a + Math.max(0, +r[s.key] || 0), 0));
    const max = Math.max(1, ...tot);
    return `<div style="display:flex;align-items:flex-end;gap:10px;height:${o.h}px;padding:0 2px">
      ${rows.map((r, i) => `
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;height:100%">
          <div class="boss-mono" style="font-size:10px;color:var(--ink-2);white-space:nowrap">${esc(o.fmt(tot[i]))}</div>
          <div style="flex:1;display:flex;flex-direction:column-reverse;width:70%;max-width:64px;min-height:0;justify-content:flex-start">
            ${series.map(s => { const v = Math.max(0, +r[s.key] || 0); return v ? `<div title="${esc(r._label)} · ${esc(s.label)}: ${esc(o.fmt(v))}" style="height:${v / max * 100}%;background:${s.color};border-top:1px solid rgba(255,255,255,.35)"></div>` : ''; }).join('')}
          </div>
          <div class="boss-mono" style="font-size:10px;color:var(--muted-2);white-space:nowrap">${esc(r._label)}</div>
        </div>`).join('')}
    </div>`;
  }
  function legend(series) {
    return `<div style="display:flex;gap:12px;margin-top:10px;flex-wrap:wrap">${series.map(s => `<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink-2)"><span style="width:10px;height:10px;border-radius:2px;background:${s.color};display:inline-block"></span>${esc(s.label)}</div>`).join('')}</div>`;
  }
  function panel(title, plate, body, meta) {
    return `<section class="boss-panel" style="margin-bottom:16px;overflow:hidden">
      <div class="boss-panel-head"><span class="boss-plate">${esc(plate)}</span><span class="boss-panel-title">${esc(title)}</span>${meta ? `<span class="boss-meta" style="margin:0 0 0 auto">${meta}</span>` : ''}</div>
      <div style="padding:16px 18px 14px">${body}</div>
    </section>`;
  }
  function kpi(label, value, meta, dark, tag) {
    return `<div class="boss-kpi${dark ? ' dark' : ''}" style="flex:1 1 170px;min-width:0">
      <div class="k-head"><span class="k-label">${esc(label)}</span>${tag ? `<span class="boss-tag${dark ? ' dark' : ''}">${esc(tag)}</span>` : ''}</div>
      <div class="k-num">${value}</div>
      ${meta ? `<div class="k-meta">${meta}</div>` : ''}
    </div>`;
  }
  const TH = 'padding:7px 10px;text-align:right;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line-2);white-space:nowrap';
  const TD = 'padding:6px 10px;text-align:right;border-top:1px solid var(--line);font-size:12.5px;white-space:nowrap';

  // ── Tekjugreiningin: fylki flokkur × mánuður ───────────────────────────────
  function greiningHtml(d) {
    const kind = S.greining;
    const lykill = { thjonusta: 'thjonusta', voruflokkur: 'voruflokkur', tegund: 'tegund', ras: 'ras' }[kind];
    const labels = Object.fromEntries((d.flokkar[kind] || []).map(f => [f.key, f.label]));
    const keys = [];
    d.monthly.forEach(m => Object.keys(m[lykill] || {}).forEach(k => { if (!keys.includes(k)) keys.push(k); }));
    const sum = k => d.monthly.reduce((a, m) => a + ((m[lykill] || {})[k] || 0), 0);
    keys.sort((a, b) => sum(b) - sum(a));
    const series = keys.map((k, i) => ({ key: k, label: labels[k] || k, color: FLOKK_LITIR[i % FLOKK_LITIR.length] }));
    const rows = d.monthly.map(m => Object.assign({ _label: fmtYm(m.ym) }, m[lykill] || {}));
    const total = keys.reduce((a, k) => a + sum(k), 0);
    const tafla = `<div style="overflow:auto;margin-top:14px"><table style="width:100%;border-collapse:collapse" class="boss-mono">
      <thead><tr><th style="${TH};text-align:left">${esc({ thjonusta: 'Þjónustuflokkur', voruflokkur: 'Vöruflokkur', tegund: 'Tækjategund', ras: 'Sölurás' }[kind])}</th>${d.monthly.map(m => `<th style="${TH}">${esc(fmtYm(m.ym))}</th>`).join('')}<th style="${TH}">Samtals</th><th style="${TH}">Hlutur</th></tr></thead>
      <tbody>${series.map(s => `<tr><td style="${TD};text-align:left;font-family:var(--font-ui)"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${s.color};margin-right:7px;vertical-align:middle"></span>${esc(s.label)}</td>${d.monthly.map(m => { const v = (m[lykill] || {})[s.key] || 0; return `<td style="${TD};color:${v < 0 ? 'var(--red)' : 'var(--ink)'}">${v ? fmtN(v) : '<span style="color:var(--muted-2)">—</span>'}</td>`; }).join('')}<td style="${TD};font-weight:600">${fmtN(sum(s.key))}</td><td style="${TD};color:var(--muted)">${total ? Math.round(sum(s.key) / total * 100) : 0}%</td></tr>`).join('')}
      <tr><td style="${TD};text-align:left;font-weight:700;font-family:var(--font-ui);border-top:2px solid var(--line-2)">Samtals án vsk</td>${d.monthly.map(m => `<td style="${TD};font-weight:700;border-top:2px solid var(--line-2)">${fmtN(m.kr_exvat)}</td>`).join('')}<td style="${TD};font-weight:700;border-top:2px solid var(--line-2)">${fmtN(total)}</td><td style="${TD};border-top:2px solid var(--line-2)"></td></tr>
      <tr><td style="${TD};text-align:left;color:var(--muted);font-family:var(--font-ui)">Sölur · kreditreikningar</td>${d.monthly.map(m => `<td style="${TD};color:var(--muted)">${m.n}${m.kredit_n ? ' · <span style="color:var(--red)">' + m.kredit_n + '</span>' : ''}</td>`).join('')}<td style="${TD}"></td><td style="${TD}"></td></tr>
      </tbody></table></div>`;
    return stacked(rows, series) + legend(series) + tafla;
  }
  function taekiTaflaHtml(d) {
    const rad = (lbl, f) => `<tr><td style="${TD};text-align:left;font-family:var(--font-ui)">${esc(lbl)}</td>${d.monthly.map(m => `<td style="${TD}">${f(m) ? fmtN(f(m)) : '<span style="color:var(--muted-2)">—</span>'}</td>`).join('')}<td style="${TD};font-weight:600">${fmtN(d.monthly.reduce((a, m) => a + (f(m) || 0), 0))}</td></tr>`;
    return `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse" class="boss-mono">
      <thead><tr><th style="${TH};text-align:left">Tæki á sölulínum</th>${d.monthly.map(m => `<th style="${TH}">${esc(fmtYm(m.ym))}</th>`).join('')}<th style="${TH}">Samtals</th></tr></thead>
      <tbody>${rad('Yfirfarin', m => m.taeki.yfirferd)}${rad('Hlaðin', m => m.taeki.hledsla)}${rad('Ný tæki seld', m => m.taeki.nytt)}${rad('CO₂-hylki', m => m.taeki.co2_hylki)}</tbody></table></div>
      <div class="boss-meta" style="margin-top:8px">Magn af sölulínum (yfirferð · hleðsla · nýtt tæki · CO₂ 100 gr) í öllum sölurásum — verslun, þjónustuferðum og brunakerfi. Kreditlínur draga frá.</div>`;
  }

  function render($view) {
    S.view = $view;
    $view.innerHTML = `
      <div style="max-width:1180px;margin:0 auto;padding:4px 4px 30px">
        <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px">
          <div>
            <div class="boss-kicker">Afköst · Slökkvitæki</div>
            <h1 class="boss-h1" style="margin-top:8px">Afköst</h1>
            <div class="boss-sub" id="ak-meta">Sækir…</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="boss-label">Tímabil</span>
            <div class="boss-seg" id="ak-months">${[3, 6, 12].map(m => `<button type="button" data-m="${m}" class="${m === S.months ? 'active' : ''}">${m} mán</button>`).join('')}</div>
            <button type="button" class="boss-btn ivory sm" id="ak-refresh">↻ Uppfæra</button>
          </div>
        </div>
        <div id="ak-body"><div class="boss-tray" style="padding:28px;text-align:center">Sæki afköstin úr Supabase…</div></div>
      </div>`;
    $view.querySelector('#ak-months').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (!b) return; S.months = +b.dataset.m; render($view); });
    $view.querySelector('#ak-refresh').addEventListener('click', () => render($view));
    load($view).catch(e => { const b = $view.querySelector('#ak-body'); if (b) b.innerHTML = `<div class="boss-tray" style="padding:20px;color:var(--red)">Villa: ${esc(e.message || e)}</div>`; });
  }

  async function load($view) {
    const r = await fetch('/api/afkost?months=' + S.months, { cache: 'no-store' });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error || ('HTTP ' + r.status));
    S.data = d;
    if (S.view !== $view) return;
    const meta = $view.querySelector('#ak-meta');
    if (meta) meta.innerHTML = `Sótt ${esc(fmtDate(d.generated_at))} · ${d.counts.verkbeidnir} verkbeiðnir · ${d.counts.solur} sölur · ${d.counts.taeki_saga} færslur í tækjasögu`;
    paint($view);
  }

  function paint($view) {
    const d = S.data, m = d.macro3m, p = m.prev_period || {};
    const cmp = (now, prev) => m.prev_period_insufficient ? 'ekki nóg saga til samanburðar' : `${esc(pct(now, prev))} frá fyrri 3 mán (${esc(fmtN(prev))})`;
    const daily = d.daily14.map(x => ({ ...x, _label: fmtDay(x.date) }));
    const saga = d.saga14.reduce((a, s) => ({ skodad: a.skodad + s.skodad, hladid: a.hladid + s.hladid, thjonustad: a.thjonustad + s.thjonustad }), { skodad: 0, hladid: 0, thjonustad: 0 });
    const sum = k => daily.reduce((a, x) => a + (x[k] || 0), 0);
    const weekly = d.weekly.map(w => ({ ...w, _label: fmtDay(w.week_start) }));
    const sk = d.skodunarmanudir.map(s => ({ ...s, _label: fmtYm(s.ym) }));

    const body = $view.querySelector('#ak-body');
    body.innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px">
        ${kpi('Innkomin verk · 3 mán', fmtN(m.verkbeidnir_in), cmp(m.verkbeidnir_in, p.verkbeidnir_in), false, 'verkstæði')}
        ${kpi('Klárað og sótt · 3 mán', fmtN(m.verkbeidnir_done), cmp(m.verkbeidnir_done, p.verkbeidnir_done), false, 'verkstæði')}
        ${kpi('Tæki á verkstæði · 3 mán', `${fmtN(m.yfirfarin + m.hladin)}`, `${fmtN(m.yfirfarin)} yfirfarin · ${fmtN(m.hladin)} hlaðin · ${cmp(m.yfirfarin + m.hladin, (p.yfirfarin || 0) + (p.hladin || 0))}`, true, 'verklínur')}
        ${kpi('CO₂-hylki · 3 mán', fmtN(m.co2_hylki), cmp(m.co2_hylki, p.co2_hylki), false, '100 gr')}
        ${kpi('Úttektir · 3 mán', fmtN(m.uttektir), `${fmtN(m.uttekt_taeki)} tæki á sölulínum · ${cmp(m.uttektir, p.uttektir)}`, false, 'sölur')}
        ${kpi('Sala samtals · 3 mán', `${fmtN(m.sala_kr)}<span class="boss-kr">kr</span>`, `${fmtN(m.solur_n)} sölur · ${cmp(m.sala_kr, p.sala_kr)}`, true, 'm/vsk')}
      </div>

      ${panel('Verkbeiðnir — síðustu 14 daga', 'VERKSTÆÐI', bars(daily, [
        { key: 'verkbeidnir_in', label: 'Innkomið (móttökudagur)', color: C.bla, sum: sum('verkbeidnir_in') },
        { key: 'verkbeidnir_done', label: 'Klárað og sótt (sóknardagur)', color: C.graen, sum: sum('verkbeidnir_done') }]),
        'eydd og afturkölluð verk ekki talin')}

      ${panel('Tæki á verkstæði — síðustu 14 daga', 'YFIRFARIN · HLAÐIN', bars(daily, [
        { key: 'yfirfarin', label: 'Yfirfarin', color: C.graen, sum: sum('yfirfarin') },
        { key: 'hladin', label: 'Hlaðin', color: C.terra, sum: sum('hladin') }])
        + `<div class="boss-meta" style="margin-top:10px">Talið af verklínum sóttra verka (þjónustutextinn segir yfirferð eða hleðsla). Tækjasagan (taeki_saga) sömu 14 daga: <b class="boss-mono">${saga.skodad}</b> skoðuð · <b class="boss-mono">${saga.hladid}</b> hlaðin · <b class="boss-mono">${saga.thjonustad}</b> þjónustuð — ${d.saga_live_since ? 'lifandi skráning frá ' + esc(fmtDay(d.saga_live_since)) : 'aðeins bakfylling 12/10/2026, lifandi skráning kviknar þegar næsta verk er sótt'}.</div>`,
        'úr verklidur')}

      ${panel('CO₂-hylki 100 gr — síðustu 14 daga', 'CO₂', bars(daily, [{ key: 'co2_hylki', label: 'Hylki fyllt (× N á verklínu)', color: C.stal, sum: sum('co2_hylki') }], { h: 90 }), 'talið á sóknardegi')}

      ${panel('Úttektir í þjónustuferðum — síðustu 14 daga', 'ÚTTEKTIR', bars(daily, [
        { key: 'uttektir', label: 'Úttektarsölur (uttekt + brunakerfi)', color: C.blaDj, sum: sum('uttektir') },
        { key: 'uttekt_taeki', label: 'Tæki á sölulínum (yfirferð + hleðsla + nýtt)', color: C.bla, sum: sum('uttekt_taeki') }]),
        'af sölum með uppruna uttekt / brunakerfi')}

      ${panel('Sölur eftir sölurás — vikulega', 'SÖLURÁS', stacked(weekly, [
        { key: 'verslun_kr', label: 'Í verslun', color: C.bla }, { key: 'uttekt_kr', label: 'Í þjónustuferðum', color: C.blaDj }, { key: 'brunakerfi_kr', label: 'Brunakerfi', color: C.terra }], { h: 150 })
        + legend([{ label: 'Í verslun', color: C.bla }, { label: 'Í þjónustuferðum', color: C.blaDj }, { label: 'Brunakerfi', color: C.terra }])
        + `<div style="overflow:auto;margin-top:12px"><table style="width:100%;border-collapse:collapse" class="boss-mono"><thead><tr><th style="${TH};text-align:left">Vika frá</th>${weekly.map(w => `<th style="${TH}">${esc(w._label)}</th>`).join('')}</tr></thead><tbody>
          <tr><td style="${TD};text-align:left;font-family:var(--font-ui)">Verslun · sölur</td>${weekly.map(w => `<td style="${TD}">${w.verslun_n}</td>`).join('')}</tr>
          <tr><td style="${TD};text-align:left;font-family:var(--font-ui)">Þjónustuferðir · sölur</td>${weekly.map(w => `<td style="${TD}">${w.uttekt_n}</td>`).join('')}</tr>
          <tr><td style="${TD};text-align:left;font-family:var(--font-ui)">Brunakerfi · sölur</td>${weekly.map(w => `<td style="${TD}">${w.brunakerfi_n}</td>`).join('')}</tr>
          <tr><td style="${TD};text-align:left;font-family:var(--font-ui);color:var(--muted)">Kreditreikningar</td>${weekly.map(w => `<td style="${TD};color:${w.kredit_n ? 'var(--red)' : 'var(--muted-2)'}">${w.kredit_n || '—'}</td>`).join('')}</tr>
        </tbody></table></div>`,
        'krónur með vsk · kredit dregst frá')}

      <section class="boss-panel" style="margin-bottom:16px;overflow:hidden">
        <div class="boss-panel-head" style="flex-wrap:wrap"><span class="boss-plate">TEKJUGREINING</span><span class="boss-panel-title">Hvaðan koma tekjurnar — ${S.months} mánuðir, kr án vsk</span>
          <div class="boss-seg" id="ak-greining" style="margin-left:auto">${[['thjonusta', 'Þjónustuflokkar'], ['voruflokkur', 'Vöruflokkar'], ['tegund', 'Tækjategundir'], ['ras', 'Sölurásir']].map(([k, l]) => `<button type="button" data-g="${k}" class="${S.greining === k ? 'active' : ''}">${l}</button>`).join('')}</div>
        </div>
        <div style="padding:16px 18px 14px" id="ak-greining-body">${greiningHtml(d)}</div>
      </section>

      ${panel('Tæki á sölulínum eftir mánuðum', 'TÆKI', taekiTaflaHtml(d), 'allar sölurásir')}

      ${panel('Tæki í úttektarskýrslum eftir skoðunarmánuði', 'SKOÐUNARMÁNUÐUR', bars(sk, [
        { key: 'taeki', label: 'Tæki í úttektarskýrslum (Drive-skýrslur)', color: C.graen, sum: sk.reduce((a, s) => a + s.taeki, 0) },
        { key: 'reikn_taeki', label: 'Tæki á úttektarreikningum (Stólpi, þar sem mánuður þekkist)', color: C.stal, sum: sk.reduce((a, s) => a + s.reikn_taeki, 0) }], { h: 150 })
        + `<div style="overflow:auto;margin-top:12px"><table style="width:100%;border-collapse:collapse" class="boss-mono"><thead><tr><th style="${TH};text-align:left">Mánuður</th>${sk.map(s => `<th style="${TH}">${esc(s._label)}</th>`).join('')}</tr></thead><tbody>
          <tr><td style="${TD};text-align:left;font-family:var(--font-ui)">Skýrslur</td>${sk.map(s => `<td style="${TD}">${s.skyrslur || '—'}</td>`).join('')}</tr>
          <tr><td style="${TD};text-align:left;font-family:var(--font-ui)">Tæki í skýrslum</td>${sk.map(s => `<td style="${TD};font-weight:600">${s.taeki ? fmtN(s.taeki) : '—'}</td>`).join('')}</tr>
          <tr><td style="${TD};text-align:left;font-family:var(--font-ui);color:var(--muted)">Þar af léttvatn · duft · CO₂ · slöngur · reykskynjarar</td>${sk.map(s => { const e = s.eq || {}; const n = k => e[k] || 0; return `<td style="${TD};color:var(--muted)">${s.taeki ? [n('lettvatn'), n('duft6_12') + n('duft2'), n('co2_5') + n('co2_2'), n('brunaslongur'), n('reykskynjarar')].join(' · ') : '—'}</td>`; }).join('')}</tr>
        </tbody></table></div>
        <div class="boss-meta" style="margin-top:8px">Skoðunarmánuðurinn er lesinn úr skýrslunni sjálfri (arsskodun_report_facts) og af reikningum (uttekt_reikningur_facts). Ónákvæmara en sölulínurnar — skýrsla getur vantað eða verið tvílesin — en segir hvenær skoðað var, ekki hvenær selt var.</div>`,
        'úr Drive-skýrslum og reikningum')}

      ${panel('Stólpi-sagan — reikningar eftir árum', 'SAGA 2020–2026', `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse" class="boss-mono">
        <thead><tr><th style="${TH};text-align:left">Ár</th><th style="${TH}">Reikningar</th><th style="${TH}">Yfirfarin tæki</th><th style="${TH}">Hlaðin tæki</th><th style="${TH}">Ný tæki</th><th style="${TH}">Yfirferð kr</th><th style="${TH}">Hleðsla kr</th><th style="${TH}">Nýtt kr</th><th style="${TH}">Annað kr</th><th style="${TH}">Samtals kr</th></tr></thead>
        <tbody>${d.stolpi.map(y => { const tot = y.kr.yfirferd + y.kr.hledsla + y.kr.nytt + y.kr.annad; return `<tr><td style="${TD};text-align:left;font-weight:700">${y.ar}</td><td style="${TD}">${fmtN(y.reikningar)}</td><td style="${TD}">${fmtN(y.taeki.yfirferd)}</td><td style="${TD}">${fmtN(y.taeki.hledsla)}</td><td style="${TD}">${fmtN(y.taeki.nytt)}</td><td style="${TD}">${fmtN(y.kr.yfirferd)}</td><td style="${TD}">${fmtN(y.kr.hledsla)}</td><td style="${TD}">${fmtN(y.kr.nytt)}</td><td style="${TD}">${fmtN(y.kr.annad)}</td><td style="${TD};font-weight:700">${fmtN(tot)}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="boss-meta" style="margin-top:8px">Reikningar lesnir úr Stólpa-PDF (reikningslestur + reikningslinur, kredit undanskilið). 2026 nær til júlí og skarast við app-sölurnar frá maí — þessi tafla er sagan, tekjugreiningin að ofan er nútíðin.</div>`,
        'reikningslestur')}

      <div class="boss-meta" style="margin-top:4px;line-height:1.6">
        <b>Heimildir:</b> verkbeiðnir og verklínur (verkstæðið) · sölur og sölulínur (tekjur, flokkaðar eftir vörunúmeri og texta) · tækjasaga (taeki_saga) · úttektarskýrslur og reikningar eftir skoðunarmánuði · Stólpi-reikningar 2020–2026.
        „Klárað" telst aðeins þegar verk er sótt; áætlaður sóknardagur telur ekki. Kreditreikningar teljast ekki sölur en lækka krónurnar.
      </div>`;

    body.querySelector('#ak-greining').addEventListener('click', e => {
      const b = e.target.closest('button[data-g]'); if (!b) return;
      S.greining = b.dataset.g;
      body.querySelectorAll('#ak-greining button').forEach(x => x.classList.toggle('active', x.dataset.g === S.greining));
      body.querySelector('#ak-greining-body').innerHTML = greiningHtml(d);
    });
  }

  window.AfkostSida = { render, state: S };
  // Skráin er defer og hleðst á eftir fyrstu teikningu hubbsins: ef Afköst er flipinn sem
  // opnaðist, teiknum við hann upp á nýtt hér svo gamla varaleiðin standi ekki eftir.
  try {
    if (typeof state !== 'undefined' && state && state.ui && state.ui.activeTab === 'afkost' && typeof $view !== 'undefined' && $view) render($view);
  } catch (_) {}
})();
