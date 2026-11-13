/* Vefverslun Brunahólfs: skrifta verslunarinnar, tekin úr vefverslun/verslun.js í kóðasafni Slökkvitækja-appsins (afritað 13.11.2026).
   Aðlöguð á þessum stöðum svo hún keyri inni í þessari síðu:
   1. gögnin koma úr verslun/gogn.js (window.BH_VV_GOGN), ekki af /api/vefverslun
   2. ritillinn (ritill.js) fylgir ekki: VV.breytaLeyft = false
   3. leiðir heita #verslun, #vara-<id> og #karfa (í versluninni sjálfri #/, #/vara/<id> og #/karfa)
   4. verslunin heldur síðustu síðu sinni þegar slóðin bendir á kafla utan hennar (#hafa-samband)
   5. „Fá tilboð“ leiðir í #hafa-samband á þessari síðu
   6. titill síðunnar er látinn ósnertur
   7. karfan segir „1 vara“
   Greiðsla er ekki tengd: „Halda áfram í greiðslu“ sýnir aðeins skilaboð og sendir ekkert. */
// Vefverslun Brunahólfs — síðurnar (forsíða verslunar, vörusíða, karfa).
//
// Allt sem sést er teiknað úr þremur hlutum:
//   VV.vorur  lifandi úr `vorur` (forsíða söluborðsins) — nafn, verð, lager, mynd
//   VV.efni   það sem breytingahamurinn vistar: þema, textar (t), myndir (m), kaflar (b), tölur (n), vöruval (vorur)
//   sjálfgefin gildi hér í kóðanum — efnið geymir AÐEINS það sem hefur verið breytt, „Endurstilla" eyðir yfirskrifinni
//
// Hjálparar sem allar síður nota (og ritill.js les): E() texti, M() mynd, B() kafli, N() tala. Hver ber data-lykil
// (data-e / data-m / data-b / data-n) svo ritillinn finni hvað var smellt á.
(() => {
  'use strict';
  const API = '/api/vefverslun';
  // Kassahamur: Sala (js/patches/133) sýnir vörusíðuna í glugga. Karfan þar er kassans — „Setja í körfu“ sendir boð
  // til Sölu í stað þess að fara í körfu búðarinnar, og haus, fótur, afhending og tilboð búðarinnar eru falin.
  const KASSI = new URLSearchParams(location.search).has('kassi');
  // Skoðunarhamur (?kassi=1&skoda=1): Vörur og þjónusta sýnir síðuna sem nánari lýsingu — engin karfa yfirleitt
  const SKODA = KASSI && new URLSearchParams(location.search).has('skoda');
  const sendaKassa = (bod) => { try { if (window.parent !== window) window.parent.postMessage(bod, location.origin); } catch (_) {} };
  const KASSI_TAKKI = 'Setja í körfu á Sölu';
  const KARFA_LYKILL = 'bh_vefverslun_karfa';
  const OPINBER = '#hafa-samband';
  const UT = '';   // upprunalega heimasíðan opnast í nýjum glugga (Agnar 13.10.2026: „erfitt að komast til baka")
  const LETUR = ['Poppins', 'Inter', 'Montserrat', 'Roboto', 'Open Sans', 'Lato', 'Nunito', 'Raleway', 'Work Sans', 'DM Sans', 'Source Sans 3', 'Playfair Display', 'Merriweather', 'Oswald'];
  const THEMA0 = {
    litir: { navy: '#222f47', navyDeep: '#18213a', orange: '#ff4001', orangeInk: '#d13300', mist: '#f0f2f7', white: '#ffffff', ink: '#1b2338', muted: '#515d78', line: '#d5dae6' },
    letur: { fyrirsagnir: 'Poppins', texti: 'Poppins' }, grunnstaerd: 16, runun: 16, takkar: 'pilla',
  };
  const FLOKKAR = { 'Slökkvitæki': 'Slökkvitæki', 'Eldvarnir': 'Eldvarnateppi', 'Sjúkratöskur': 'Sjúkratöskur', 'Skynjarar og rafhlöður': 'Skynjarar', 'Slökkvitækjafestingar': 'Festingar' };

  const VV = window.VV = {
    API, LETUR, THEMA0,
    efni: {}, vorur: [], stada: 'prufa', drog_uppfaert: null, utgafa: 0, virkjad: null,
    ritill: false, breytaLeyft: false,
    sia: { flokkur: '', leit: '', rada: 'vinsaelt' },
    vara: { mynd: 0, fjoldi: 1, afhending: 'saekja', m2: 500, tilk: '' },
    karfaAfh: 'saekja',
    karfa: lesaKorfu(),
    sjg: {}, sjgM: {},
  };

  // ── Smáhjálparar ────────────────────────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tala = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const kr = (n) => tala(n) + ' kr';
  const num = (v, d) => { const n = Number(v); return v === '' || v == null || !isFinite(n) ? d : n; };
  const okLitur = (c) => (typeof c === 'string' && /^(#[0-9a-fA-F]{3,8}|transparent)$/.test(c) ? c : '');
  const STADIR = ['center', 'top', 'bottom', 'left', 'right', 'left top', 'right top', 'left bottom', 'right bottom'];
  // Texti: **feitt**, {áherslulitur}, línuskil
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\{(.+?)\}/g, '<span class="vv-aherslu">$1</span>').replace(/\n/g, '<br>');
  Object.assign(VV, { esc, kr, tala, num, okLitur, md, STADIR });

  const hladin = new Set(['Poppins']);
  function hladaLetri(f) {
    if (!f || hladin.has(f) || !LETUR.includes(f)) return;
    hladin.add(f);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + f.replace(/ /g, '+') + ':wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
  }
  VV.hladaLetri = hladaLetri;

  function stillStr(s) {
    if (!s || typeof s !== 'object') return '';
    const o = [];
    if (LETUR.includes(s.ff)) { hladaLetri(s.ff); o.push(`font-family:'${s.ff}',system-ui,sans-serif`); }
    if (s.fs) o.push(`font-size:${Math.min(160, Math.max(8, num(s.fs, 16)))}px`);
    if (s.fw) o.push(`font-weight:${Math.min(900, Math.max(100, num(s.fw, 400)))}`);
    if (okLitur(s.c)) o.push(`color:${s.c}`);
    if (okLitur(s.bg)) o.push(`background:${s.bg};padding:.08em .3em;border-radius:6px`);
    if (['left', 'center', 'right'].includes(s.ta)) o.push(`text-align:${s.ta}`);
    if (s.lh) o.push(`line-height:${Math.min(3, Math.max(0.8, num(s.lh, 1.5)))}`);
    if (s.ls != null && s.ls !== '') o.push(`letter-spacing:${Math.min(0.5, Math.max(-0.1, num(s.ls, 0)))}em`);
    if (s.it) o.push('font-style:italic');
    if (s.tt === 'uppercase' || s.tt === 'none') o.push(`text-transform:${s.tt}`);
    return o.join(';');
  }
  VV.stillStr = stillStr;

  // ── E(): texti ──────────────────────────────────────────────────────────────
  const tObj = (k) => (VV.efni.t && VV.efni.t[k]) || {};
  const texti = (k, def) => { const o = tObj(k); return typeof o.x === 'string' ? o.x : def; };
  function E(tag, k, def, cls) {
    VV.sjg[k] = def;
    const o = tObj(k), st = stillStr(o.s);
    const c = (cls || '') + (o.fela ? ' vv-falid' : '');
    return `<${tag} data-e="${esc(k)}"${c.trim() ? ` class="${esc(c.trim())}"` : ''}${st ? ` style="${esc(st)}"` : ''}>${md(texti(k, def))}</${tag}>`;
  }

  // ── M(): myndarammi. srcKey = annar lykill sem á myndina sjálfa (rammastíllinn er sameiginlegur, myndin ekki) ──
  function mStill(k, def, srcKey) {
    def = def || {};
    const m = VV.efni.m || {};
    const o = m[k] || {};
    const so = srcKey ? m[srcKey] || {} : o;
    const src = so.src || def.src || '';
    const fit = (o.fit || def.fit) === 'contain' ? 'contain' : 'cover';
    const pos = STADIR.includes(o.pos) ? o.pos : def.pos || 'center';
    const h = num(o.h, def.h), w = num(o.w, def.w), z = num(o.z, 100), r = o.r != null ? num(o.r, 0) : null;
    const bak = okLitur(o.bak) || def.bak || '';
    const ramma = [h ? `height:${Math.min(1400, Math.max(30, h))}px` : '', w ? `width:${Math.min(100, Math.max(10, w))}%` : '', bak ? `background:${bak}` : '', r != null ? `border-radius:${Math.min(80, Math.max(0, r))}px` : ''].filter(Boolean).join(';');
    const mynd = [`object-fit:${fit}`, `object-position:${pos}`, z !== 100 ? `transform:scale(${Math.min(4, Math.max(1, z / 100))});transform-origin:${pos}` : ''].filter(Boolean).join(';');
    return { src, ramma, mynd, fela: !!o.fela, fit, pos, h, w, z, bak, r };
  }
  VV.mStill = (k, srcKey) => mStill(k, VV.sjgM[k], srcKey);
  function M(k, def, opt) {
    opt = opt || {};
    VV.sjgM[k] = def;
    const s = mStill(k, def, opt.srcKey);
    const c = 'vv-m' + (s.src ? '' : ' tomt') + (s.fela ? ' vv-falid' : '') + (opt.cls ? ' ' + opt.cls : '');
    return `<div class="${c}" data-m="${esc(k)}"${opt.srcKey ? ` data-ms="${esc(opt.srcKey)}"` : ''}${opt.fast ? ' data-fast="1"' : ''}${s.ramma ? ` style="${esc(s.ramma)}"` : ''}>${s.src ? `<img src="${esc(s.src)}" alt="${esc(def.alt || '')}" loading="${opt.strax ? 'eager' : 'lazy'}" decoding="async" style="${esc(s.mynd)}">` : ''}</div>`;
  }
  VV.myndSrc = (k, def) => { const m = VV.efni.m || {}; return (m[k] && m[k].src) || def || ''; };

  // ── B(): kafli sem má fela eða lita ──
  function B(k, inner, cls, tag) {
    tag = tag || 'section';
    const o = (VV.efni.b && VV.efni.b[k]) || {};
    const bg = okLitur(o.bg);
    return `<${tag} data-b="${esc(k)}" class="${esc((cls || '') + (o.fela ? ' vv-falid' : ''))}"${bg ? ` style="background:${bg}"` : ''}>${inner}</${tag}>`;
  }

  // ── N(): tala sem ritillinn getur stillt (t.d. virknistig, slökkvigeta í reiknivél) ──
  const nGildi = (k, def) => num(VV.efni.n && VV.efni.n[k], def);

  // ── Tákn ───────────────────────────────────────────────────────────────────
  const T = {
    hak: ['0 0 256 256', 'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z'],
    x: ['0 0 256 256', 'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z'],
    hringhak: ['0 0 256 256', 'M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z'],
    innsigli: ['0 0 256 256', 'M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82Zm-52.2,6.84-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z'],
    bill: ['0 0 256 256', 'M247.42,117l-14-35A15.93,15.93,0,0,0,218.58,72H184V64a8,8,0,0,0-8-8H24A16,16,0,0,0,8,72V184a16,16,0,0,0,16,16H41a32,32,0,0,0,62,0h50a32,32,0,0,0,62,0h17a16,16,0,0,0,16-16V120A7.94,7.94,0,0,0,247.42,117ZM184,88h34.58l9.6,24H184ZM72,208a16,16,0,1,1,16-16A16,16,0,0,1,72,208Zm112,0a16,16,0,1,1,16-16A16,16,0,0,1,184,208Z'],
    spjall: ['0 0 256 256', 'M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-6.54-.67L40,216,52.47,178.6a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z'],
    karfa: ['0 0 256 256', 'M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,160H40V56H216V200ZM176,88a48,48,0,0,1-96,0,8,8,0,0,1,16,0,32,32,0,0,0,64,0,8,8,0,0,1,16,0Z'],
    leit: ['0 0 256 256', 'M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z'],
    minus: ['0 0 256 256', 'M224,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16H216A8,8,0,0,1,224,128Z'],
    plus: ['0 0 256 256', 'M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z'],
    vinstri: ['0 0 256 256', 'M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z'],
    haegri: ['0 0 256 256', 'M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z'],
    skjal: ['0 0 256 256', 'M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z'],
    vidvorun: ['0 0 256 256', 'M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM120,104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm8,88a12,12,0,1,1,12-12A12,12,0,0,1,128,192Z'],
    logi: ['0 0 24 24', 'M12 1.8c.9 3.4 5.6 5.6 5.6 11.1 0 4.2-2.6 7.6-5.6 7.6s-5.6-3.4-5.6-7.6c0-2.4 1.1-4.1 2.4-5.4.2 2 1.1 3.3 2.4 3.3.1-3.6 1.6-5.7.8-9zM12 21.3c1.7 0 3.1-1.6 3.1-3.6 0-2.2-1.6-3.1-2.3-4.9-.9 1.6-3.9 2.7-3.9 4.9 0 2 1.4 3.6 3.1 3.6z'],
    brusi: ['0 0 24 24', 'M6 22V9.2L9.2 5H17a1 1 0 0 1 1 1v16zM10 2h5v3h-5zM8.5 12.5l7 7m0-7-7 7'],
    kutur: ['0 0 24 24', 'M8 7h8a3.5 3.5 0 0 1 3.5 3.5V19a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-8.5A3.5 3.5 0 0 1 8 7zm2-5h4v5h-4z'],
    panna: ['0 0 24 24', 'M10 21a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm6.5-8H23v2h-6.5zM10 1c1.5 2 3 3 2.6 5-.3 1.2-1.4 1.8-2.6 1.8S7.6 7 7.6 5.7C7.6 4 9 3 10 1z'],
    skjar: ['0 0 24 24', 'M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v8h16V6zm5 13h6v2H9z'],
    rafhlada: ['0 0 24 24', 'M3 7h15a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zm17 3h2v4h-2zM11.5 8.5 7.5 13h3l-1 3.5 4-4.5h-3z'],
    snjor: ['0 0 24 24', 'M11 1h2v6.3l3.3-2 1 1.7L13 9.6V11h1.4l2.6-4.3 1.7 1-2 3.3H23v2h-6.3l2 3.3-1.7 1L14.4 13H13v1.4l4.3 2.6-1 1.7-3.3-2V23h-2v-6.3l-3.3 2-1-1.7 4.3-2.6V13H9.6L7 17.3l-1.7-1 2-3.3H1v-2h6.3l-2-3.3 1.7-1L9.6 11H11V9.6L6.7 7l1-1.7 3.3 2z'],
    elding: ['0 0 24 24', 'M13.5 1 4 13.5h6.5L9.5 23 20 9.5h-6.6z'],
    tannhjol: ['0 0 24 24', 'M10.3 1h3.4l.5 2.9a8.6 8.6 0 0 1 2.1.9l2.4-1.7 2.4 2.4-1.7 2.4c.4.7.7 1.4.9 2.1l2.9.5v3.4l-2.9.5a8.6 8.6 0 0 1-.9 2.1l1.7 2.4-2.4 2.4-2.4-1.7c-.7.4-1.4.7-2.1.9l-.5 2.9h-3.4l-.5-2.9a8.6 8.6 0 0 1-2.1-.9l-2.4 1.7-2.4-2.4 1.7-2.4a8.6 8.6 0 0 1-.9-2.1L1 13.7v-3.4l2.9-.5c.2-.7.5-1.4.9-2.1L3.1 5.3l2.4-2.4 2.4 1.7c.7-.4 1.4-.7 2.1-.9zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
    skjoldur: ['0 0 24 24', 'M12 1.5 21 5v6.5c0 5.4-3.8 9.9-9 11-5.2-1.1-9-5.6-9-11V5zm0 2.2L5 6.4v5.1c0 4.2 2.9 7.8 7 8.9 4.1-1.1 7-4.7 7-8.9V6.4zm0 3.3c.7 2.4 3.6 3.7 3.6 7.2 0 2.5-1.6 4.3-3.6 4.3s-3.6-1.8-3.6-4.3c0-1.5.7-2.5 1.6-3.3.1 1.1.7 1.9 1.4 1.9.1-2.1 1-3.4.6-5.8z'],
  };
  const ico = (n, cls) => { const t = T[n]; if (!t) return ''; const strok = n === 'brusi' ? ' fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"' : ''; return `<svg class="vv-ico${cls ? ' ' + cls : ''}" viewBox="${t[0]}" aria-hidden="true"${strok}><path d="${t[1]}"/></svg>`; };
  VV.ico = ico;

  // ── Körfuhjálparar (karfan er vafra-staða gestsins: hann á enga aðra auðkenningu fyrr en pöntun er send) ──
  function lesaKorfu() {
    try { const o = JSON.parse(localStorage.getItem(KARFA_LYKILL) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; }
  }
  function vistaKorfu() { try { localStorage.setItem(KARFA_LYKILL, JSON.stringify(VV.karfa)); } catch (_) {} }
  const iKorfu = () => Object.entries(VV.karfa).filter(([id, n]) => vara(Number(id)) && n > 0);
  const fjoldiKorfu = () => iKorfu().reduce((s, [, n]) => s + n, 0);
  function baetaVid(id, n) {
    VV.karfa[id] = Math.min(999, (VV.karfa[id] || 0) + n);
    vistaKorfu();
  }

  // ── Vörur ──────────────────────────────────────────────────────────────────
  const vara = (id) => VV.vorur.find((v) => v.id === id);
  const falinVara = (id) => ((VV.efni.vorur && VV.efni.vorur.falid) || []).includes(id);
  const synilegar = () => VV.vorur.filter((v) => !falinVara(v.id));
  const varaNafn = (v) => texti(`vara.${v.id}.nafn`, v.nafn);
  const varaMynd = (v) => VV.myndSrc(`vara.${v.id}.mynd`, v.mynd);
  const flokkSlod = (f) => String(f || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/ð/g, 'd').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-');
  const flokkHeiti = (f) => texti('flokkur.' + flokkSlod(f), FLOKKAR[f] || f);
  const profill = (id) => { const p = VV.efni.vorur && VV.efni.vorur.profill; return p && p[id] != null ? !!p[id] : SJALFGEFINN_PROFILL.includes(id); };
  VV.profill = profill;
  VV.synilegar = synilegar;

  function radad(listi) {
    const l = listi.slice();
    if (VV.sia.rada === 'lagt') l.sort((a, b) => a.verd - b.verd);
    else if (VV.sia.rada === 'haett') l.sort((a, b) => b.verd - a.verd);
    else if (VV.sia.rada === 'nafn') l.sort((a, b) => varaNafn(a).localeCompare(varaNafn(b), 'is'));
    return l;
  }
  // Leitin þolir broddstafaleysi og CO2/CO₂ ("slokkvitaeki", "co2"), og hvert orð verður að finnast einhvers staðar
  // í heiti, innra heiti, flokki eða lýsingu ("reyk 10" finnur 10 ára skynjarann)
  const leitHreint = (t) => String(t || '').toLowerCase().replace(/₂/g, '2').replace(/þ/g, 'th').replace(/æ/g, 'ae').replace(/ð/g, 'd').replace(/ö/g, 'o')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  function sjanlegar() {
    const ord = leitHreint(VV.sia.leit).split(/\s+/).filter(Boolean);
    const hey = (v) => leitHreint([varaNafn(v), v.innraNafn, v.flokkur, flokkHeiti(v.flokkur), v.lysing].join(' '));
    return radad(synilegar().filter((v) => (!VV.sia.flokkur || flokkSlod(v.flokkur) === VV.sia.flokkur) && (!ord.length || ord.every((o) => hey(v).includes(o)))));
  }
  // „27 vörur" — eða „3 af 27 vörum" þegar leit eða flokkur þrengir listann
  function talnTexti() {
    const alls = synilegar().length, n = sjanlegar().length;
    return n === alls ? `${alls} ${texti('forsida.vorur-ord', 'vörur · verð með vsk')}` : `${n} af ${alls} vörum · verð með vsk`;
  }

  // ── Sameiginlegt: haus, fótur, vörukort ──────────────────────────────────
  function haus() {
    const flipar = [['heim', 'Heim', OPINBER], ['bruna', 'Brunaþéttingar', OPINBER + '#/brunathetting'], ['kerfi', 'Brunakerfi', OPINBER + '#/brunakerfi'], ['slokk', 'Slökkvitæki', OPINBER + '#/slokkvitaeki'], ['verslun', 'Vefverslun', '#verslun'], ['um', 'Um okkur', OPINBER + '#/um-okkur']];
    const n = fjoldiKorfu();
    return `<header class="vv-haus"><div class="vv-wrap">
<a class="vv-logo" href="#verslun" aria-label="Brunahólf vefverslun">${M('haus.logo', { src: 'myndir/brunaholf-logo.png', alt: 'Brunahólf', fit: 'contain', h: 40, bak: 'transparent' }, { strax: 1 })}</a>
<label class="vv-leit">${ico('leit')}<input type="search" data-act="leit" value="${esc(VV.sia.leit)}" placeholder="${esc(texti('haus.leit', 'Leita að vöru, t.d. reykskynjari'))}" aria-label="Leita að vöru"></label>
<div class="vv-haus-h"><a class="vv-btn ljos sm" href="#karfa">${ico('karfa')}${E('span', 'haus.karfa', 'Karfa')}<span class="vv-fjoldi" id="vv-fjoldi">${n}</span></a><a class="vv-btn sm" href="${OPINBER}"${UT}>${E('span', 'haus.tilbod', 'Fá tilboð')}</a></div>
</div></header>
<nav class="vv-flipar" aria-label="Svið"><div class="vv-wrap">${flipar.map(([k, d, h]) => `<a class="vv-flipi" href="${h}"${k === 'verslun' ? ' aria-current="page"' : UT}>${E('span', 'flipi.' + k, d)}</a>`).join('')}</div></nav>`;
  }
  function fotur() {
    return B('fotur', `<div class="vv-wrap"><a class="vv-logo" href="#verslun">${M('fotur.logo', { src: 'myndir/brunaholf-logo.png', alt: 'Brunahólf', fit: 'contain', h: 30, bak: 'transparent' })}</a>${E('span', 'fotur.texti', 'Brunahólf · Slökkvitæki ehf. · Helluhrauni 10, 220 Hafnarfirði · 565-4080 · slokkvitaeki@brunaholf.is')}</div>`, 'vv-fotur', 'footer');
  }
  // birgdir: null = ekki talið, < 0 = skekkja í talningu (selt umfram skráð). Aðeins 0 er raunverulega uppselt.
  const uppseltV = (v) => v.birgdir === 0;
  const othekktLager = (v) => v.birgdir == null || v.birgdir < 0;
  function merki(v) {
    if (uppseltV(v)) return E('span', 'merki.uppselt', 'Uppselt', 'vv-merki uppselt');
    if (v.birgdir > 0 && v.birgdir <= 5) return E('span', 'merki.faeftir', 'Fá eftir', 'vv-merki lagt');
    return '';
  }
  function kort(v) {
    const uppselt = uppseltV(v);
    return `<article class="vv-kort"><a class="vv-kort-m" href="#vara-${v.id}">${merki(v)}${M('kort.mynd', { src: v.mynd, alt: v.nafn, fit: 'contain', h: 220, bak: '#ffffff' }, { srcKey: `vara.${v.id}.mynd` })}</a>
<div class="vv-kort-b"><span class="vv-kort-flokkur">${esc(flokkHeiti(v.flokkur))}</span><h3><a href="#vara-${v.id}">${E('span', `vara.${v.id}.nafn`, v.nafn)}</a></h3>
<div class="vv-verd"><b>${kr(v.verd)}</b><small>${tala(v.an)} án vsk</small></div>
${uppselt ? `<a class="vv-btn ghost sm" href="#vara-${v.id}">${E('span', 'kort.lata-vita', 'Láta mig vita')}</a>` : `<button type="button" class="vv-btn navy sm" data-act="i-korfu" data-id="${v.id}">${ico('karfa')}${E('span', 'kort.takki', 'Í körfu')}</button>`}</div></article>`;
  }
  const yfirHaus = (k, yfir, inng) => `<div class="vv-kafli-haus">${E('h2', k + '.yfir', yfir, 'vv-yfir')}${inng != null ? E('p', k + '.inng', inng, 'vv-yfir-inng') : ''}</div>`;

  // ── Forsíða verslunar ───────────────────────────────────────────────────
  function grind() {
    const l = sjanlegar();
    return `<div class="vv-grind" id="vv-grind">${l.length ? l.map(kort).join('') : `<div class="vv-tomt" style="grid-column:1/-1">${E('span', 'forsida.ekkert', 'Engin vara fannst. Prófaðu annað leitarorð.')}</div>`}</div>`;
  }
  function sidaForsida() {
    const syn = synilegar();
    const flokkar = [];
    for (const v of syn) if (!flokkar.some((f) => f.f === v.flokkur)) flokkar.push({ f: v.flokkur, n: syn.filter((x) => x.flokkur === v.flokkur).length });
    const hetja = B('forsida.hetja', `${M('forsida.hetja.mynd', { src: 'myndir/hetja.jpg', alt: '', fit: 'cover', bak: 'transparent' }, { fast: 1, strax: 1 })}<div class="vv-wrap">${E('span', 'forsida.hetja.yfir', 'Vefverslun Brunahólfs', 'vv-hetja-yfir')}${E('h1', 'forsida.hetja.titill', 'Rétt tæki, {á réttum stað.}')}${E('p', 'forsida.hetja.texti', 'Slökkvitæki, eldvarnateppi, reykskynjarar og sjúkratöskur. Sæktu hjá okkur eða fáðu sent heim.')}<div class="vv-hnappar"><a class="vv-btn ghost" href="#vara-1">${E('span', 'forsida.hetja.takki1', 'Hvaða slökkvitæki á ég að kaupa?')}</a><a class="vv-btn ghost" href="#vara-3">${E('span', 'forsida.hetja.takki2', 'Er reykskynjarinn minn nóg?')}</a></div></div>`, 'vv-hetja');
    const traust = B('forsida.traust', `<div class="vv-wrap">${[['innsigli', 'Starfsleyfi frá HMS'], ['bill', 'Sótt eða sent heim'], ['spjall', 'Ráðgjöf frá fagfólki'], ['hringhak', 'Skoðun og áfylling á tækjum']].map(([i, d], k) => `<span>${ico(i)}${E('span', 'traust.' + (k + 1), d)}</span>`).join('')}</div>`, 'vv-traust');
    const rada = [['vinsaelt', 'Vinsælast'], ['lagt', 'Verð: lægst fyrst'], ['haett', 'Verð: hæst fyrst'], ['nafn', 'Nafn (A–Ö)']];
    return `${hetja}${traust}<main class="vv-wrap vv-adal">
<div class="vv-titilrod"><div>${E('h2', 'forsida.titill', 'Allar vörur')}<span class="vv-undir" id="vv-taln">${esc(talnTexti())}</span></div>
<label class="vv-rada">${E('span', 'forsida.rada', 'Raða')}<select data-act="rada">${rada.map(([k, d]) => `<option value="${k}"${VV.sia.rada === k ? ' selected' : ''}>${d}</option>`).join('')}</select></label></div>
<div class="vv-flokkar" role="group" aria-label="Flokkar"><button type="button" class="vv-flokk" data-act="flokkur" data-v="" aria-pressed="${!VV.sia.flokkur}">${E('span', 'flokkur.allt', 'Allt')}<small>${syn.length}</small></button>${flokkar.map((f) => `<button type="button" class="vv-flokk" data-act="flokkur" data-v="${flokkSlod(f.f)}" aria-pressed="${VV.sia.flokkur === flokkSlod(f.f)}">${E('span', 'flokkur.' + flokkSlod(f.f), FLOKKAR[f.f] || f.f)}<small>${f.n}</small></button>`).join('')}</div>
${grind()}
${B('forsida.cta', `<div>${E('h3', 'cta.titill', 'Fyrirtæki, húsfélag eða bátur?')}${E('p', 'cta.texti', 'Við veljum réttu tækin, setjum þau upp og skoðum þau árlega.')}</div><div class="vv-hnappar"><a class="vv-btn" href="${OPINBER}"${UT}>${E('span', 'cta.takki1', 'Fá tilboð')}</a><a class="vv-btn ghost" href="${OPINBER}"${UT}>${E('span', 'cta.takki2', 'Spyrja Loga')}</a></div>`, 'vv-cta', 'div')}
</main>`;
  }

  // ── Vörusíða ───────────────────────────────────────────────────────────
  // Ítarlegur vöruprófíll er til fyrir þrjár tækjategundir (duft, léttvatn, kolsýra). Hver vara fær sniðið sitt
  // eftir nafni, og tölur sem eru ólíkar eftir stærð (slökkvigeta, þyngd, …) koma úr SERHAEFT[vöru-id].
  // Slökkvigeta er af miðanum á tækinu (léttvatn 6 L 21A 144B, 2 L 5A 34B, CO₂ 2 kg 34B); annað er dæmigert
  // fyrir tæki af þessari stærð og stendur með „um" — ritillinn breytir hvoru tveggja.
  const REGLUR = [
    ['Handfangið í mest 90 cm hæð', 'Í upphengi á merktum, aðgengilegum stað. Aldrei bak við hurð, inni í skáp eða í afkima.'],
    ['Aldrei meira en 25 m að næsta tæki', 'Þar sem eldfimir vökvar eru geymdir er hámarkið 20 m, og tæki við hvern hættustað.'],
    ['Við útganga og á göngum', 'Á sömu stöðum á öllum hæðum, svo fólk viti hvar á að grípa tækið.'],
    ['Minnst tvö tæki á hverri hæð', 'Í atvinnuhúsnæði. Á hæð undir 100 m² með litlu brunaálagi getur eitt tæki dugað.'],
    ['Merkt með F001-skilti', 'Skiltið þarf að sjást líka í rafmagnsleysi, sjálflýsandi eða á neyðarlýsingu.'],
  ];
  const HEIMILD = 'Heimildir: reglugerð um slökkvitæki nr. 1068/2011, byggingarreglugerð nr. 112/2012 (9. hluti) og leiðbeiningar 165.BR1.';
  const SKODUN = ['Hversu oft þarf að skoða tækið?', 'Einu sinni á ári. Þjónustuaðili með starfsleyfi yfirfer tækið, merkir það með dagsetningu og skráir skoðunina. Sjálfur lítur þú á tækið mánaðarlega.'];
  const EFTIR = ['Hvað geri ég eftir að tækið hefur verið notað?', 'Komdu með það í hleðslu, líka þótt aðeins lítið hafi farið úr því. Tæki sem byrjað er að tæma er ekki lengur öruggt.'];
  const ab = (a, b) => (a ? `${String(a / 10).replace('.', ',')} metra löng timburstæða` : '') + (a && b ? ' og ' : '') + (b ? `${b} lítrar af brennandi vökva í prófunarbakka` : '');

  const PROFILAR = {
    duft: {
      merki: 'Aðaltæki · verkstæði og lager',
      inngangur: 'Öflugt fjölnota slökkvitæki sem vinnur á eldi í föstum efnum, eldfimum vökvum og gasi. Traust aðaltæki fyrir verkstæði, lager, bílskúr, sumarhús og báta.',
      pillur: ['{**A**} · timbur, pappír, plast', '{**B**} · olía, bensín, lakk', '{**C**} · gas'],
      ef: {
        inng: 'Eldar skiptast í flokka eftir því hvað brennur. Þetta tæki ræður við þrjá algengustu flokkana.',
        listi: [
          { k: 'a', mynd: 'myndir/flokkur-a.jpg', ico: 'logi', fl: 'Flokkur A', t: 'Föst efni', x: 'Timbur, pappír, pappi, vefnaður, plast og dekk.', stig: 3, v: 'Góð virkni', n: 'Duftið kælir ekki. Gáðu að glóð þegar eldurinn er slokknaður.' },
          { k: 'b', mynd: 'myndir/flokkur-b.jpg', ico: 'brusi', fl: 'Flokkur B', t: 'Eldfimir vökvar', x: 'Bensín, dísel, olía, málning, lakk og leysiefni.', stig: 4, v: 'Mjög góð virkni', n: 'Sterkasta hlið duftsins. Slekkur hratt, líka á stórum fleti.' },
          { k: 'c', mynd: 'myndir/flokkur-c.jpg', ico: 'kutur', fl: 'Flokkur C', t: 'Gas', x: 'Própan og bútan á kútum, gaslagnir og gasgrill.', stig: 4, v: 'Mjög góð virkni', n: 'Skrúfaðu fyrst fyrir gasið ef þú getur, annars getur það safnast upp.' },
        ],
      },
      ekki: [
        { k: 'feiti', mynd: 'myndir/ekki-feiti.jpg', ico: 'panna', fl: 'Flokkur F', t: 'Feiti í potti', x: 'Notaðu eldvarnateppi. Aldrei vatn.' },
        { k: 'tolvur', mynd: 'myndir/ekki-tolvur.jpg', ico: 'skjar', fl: 'Rafeindabúnaður', t: 'Tölvur og töflur', x: 'Duftið skemmir búnað. CO₂ er betra.' },
        { k: 'lithium', mynd: 'myndir/ekki-lithium.jpg', ico: 'rafhlada', fl: 'Liþíumrafhlöður', t: 'Rafhjól og hlaupahjól', x: 'Forðaðu þér og hringdu í 112.' },
      ],
      notkun: {
        inng: 'Þar sem fleiri en ein tegund af eldi getur kviknað á sama stað. Myndirnar eru líka í myndasafninu efst.',
        listi: [
          { k: 'verkstaedi', mynd: 'myndir/notkun-verkstaedi.jpg', merki: 'A · B', t: 'Verkstæði', x: 'Olía, leysiefni og neistar á sama stað. Slekkur bæði í olíutusku og olíupolli.' },
          { k: 'bilskur', mynd: 'myndir/notkun-bilskur.jpg', merki: 'A · B', t: 'Bílskúr', x: 'Bensín, dekk og rafgeymar. Hafðu tækið við dyrnar, ekki innst í skúrnum.' },
          { k: 'sumarhus', mynd: 'myndir/notkun-sumarhus.jpg', merki: 'A', t: 'Sumarhús', x: 'Kamína og langt í slökkvilið. Tækið þolir frost í óupphituðu húsi.' },
          { k: 'batur', mynd: 'myndir/notkun-batur.jpg', merki: 'A · B', t: 'Bátar', x: 'Olía og dísel í vélarrúmi. Skipafesting heldur tækinu föstu í veltingi.' },
          { k: 'lager', mynd: 'myndir/notkun-lager.jpg', merki: 'A', t: 'Lager', x: 'Pappi, plast og bretti. Tæki við hvern útgang, merkt með skilti.' },
          { k: 'grill', mynd: 'myndir/notkun-grill.jpg', merki: 'C', t: 'Gasgrill og pallur', x: 'Skrúfaðu fyrir kútinn ef þú getur, og slökktu svo.' },
        ],
      },
      um: {
        yfir: 'Um tækið',
        p: ['Duft 6 kg. ABC er traust aðaltæki þar sem eldur getur kviknað í ólíkum efnum: timbri, pappír og plasti, olíu og bensíni, eða gasi. Eitt og sama tækið ræður við alla þrjá flokkana, svo þú þarft ekki að velja rétt tæki á ögurstundu.',
          'Duftið leggst yfir eldinn, kæfir hann og rýfur efnahvarfið í loganum, svo eldurinn slokknar hratt. Tækið er forþrýst með köfnunarefni og alltaf tilbúið.',
          'Sex kíló eru lágmarkið fyrir duft sem aðaltæki. Tækið er nógu létt til að flestir ráði við það og nógu öflugt til að slökkva eld sem er að byrja að breiðast út.'],
        gott: '**Gott að vita:** duftið dreifist víða og byrgir sýn í lokuðu rými. Í skrifstofum og verslunum mælum við frekar með léttvatni.',
      },
      maelir: { yfir: 'Lestu á mælinn einu sinni í mánuði', mynd: 'myndir/maelir.jpg', alt: 'Þrýstimælir á slökkvitæki, nálin á grænu', listi: ['Nálin er á græna svæðinu', 'Innsigli og öryggispinni á sínum stað', 'Engar beyglur, ryð eða sprungur í slöngu', 'Tækið hangir á sínum stað og skiltið sést', 'Skoðunarmiðinn er yngri en 12 mánaða'], rautt: 'Nálin á rauðu? Notaðu ekki tækið. Komdu með það til okkar.' },
      skref: {
        undir: 'Stattu í 2 til 3 metra fjarlægð, með flóttaleiðina að baki.',
        listi: [['Taktu pinnann úr', 'Rjúfðu innsiglið og togaðu öryggispinnann úr handfanginu.', 'myndir/skref-1.jpg'], ['Miðaðu á rót eldsins', 'Beindu stútnum að rótum loganna, ekki upp í reykinn.', 'myndir/skref-2.jpg'], ['Kreistu handfangið', 'Þrýstu þétt. Sleppirðu, stöðvast duftið strax.', 'myndir/skref-3.jpg'], ['Sópaðu yfir eldinn', 'Hreyfðu stútinn frá hlið til hliðar þar til eldurinn er slokknaður.', 'myndir/skref-4.jpg']],
      },
      stadur: { mynd: 'myndir/veggur.jpg', reglur: REGLUR },
      reikn: { geta: 43 },
      spurn: (s) => [
        [`Hvað þýðir ${s.geta}?`, `Tölurnar segja hve stóran eld tækið slökkti í stöðluðu prófi: ${ab(s.A, s.B)}. C þýðir að það má nota á gaselda.`],
        SKODUN, EFTIR,
        ['Má geyma tækið í frosti?', 'Já. Það þolir frá −30 °C upp í +60 °C, svo það má vera í óupphituðum bílskúr, sumarhúsi eða bát allan veturinn.'],
        ['Dugar eitt tæki á heimilið?', 'Við mælum með slökkvitæki og eldvarnateppi í eldhúsið á hverju heimili, og reykskynjari á að vera á hverri hæð. Í íbúð hentar léttvatn oft betur en duft, því það óhreinkar minna.'],
        ['Má nota það á rafmagnstæki?', 'Já, duftið leiðir ekki rafmagn. En það sest í allt og getur skemmt viðkvæman búnað, svo við tölvur og rafmagnstöflur er CO₂ betri kostur.'],
      ],
    },

    lettvatn: {
      merki: 'Heimili, skrifstofur og verslanir',
      inngangur: 'Léttvatnstæki slekkur eld í föstum efnum og eldfimum vökvum og skilur lítið eftir sig. Gott val fyrir heimili, skrifstofur, verslanir og stigaganga.',
      pillur: ['{**A**} · timbur, pappír, textíll', '{**B**} · bensín, olía, lakk'],
      ef: {
        inng: 'Eldar skiptast í flokka eftir því hvað brennur. Léttvatn er sterkast á föst efni og ræður líka við eldfima vökva.',
        listi: [
          { k: 'a', mynd: 'myndir/lv-ef-a.jpg', ico: 'logi', fl: 'Flokkur A', t: 'Föst efni', x: 'Húsgögn, textíll, pappír, timbur og plast.', stig: 4, v: 'Mjög góð virkni', n: 'Vatnið kælir glóðina svo eldurinn kviknar síður aftur.' },
          { k: 'b', mynd: 'myndir/lv-ef-b.jpg', ico: 'brusi', fl: 'Flokkur B', t: 'Eldfimir vökvar', x: 'Bensín, dísel, olía, málning og lakk.', stig: 3, v: 'Góð virkni', n: 'Froðan leggst eins og filma yfir vökvann og kæfir eldinn.' },
        ],
      },
      ekki: [
        { k: 'gas', mynd: 'myndir/lv-ekki-gas.jpg', ico: 'kutur', fl: 'Flokkur C', t: 'Gaseldur', x: 'Léttvatn slekkur ekki gas. Skrúfaðu fyrir og notaðu duft.' },
        { k: 'feiti', mynd: 'myndir/ekki-feiti.jpg', ico: 'panna', fl: 'Flokkur F', t: 'Feiti í potti', x: 'Vatn í brennandi feiti veldur sprengingu. Notaðu eldvarnateppi.' },
        { k: 'frost', mynd: 'myndir/lv-ekki-frost.jpg', ico: 'snjor', fl: 'Frost', t: 'Óupphituð rými', x: 'Þolir ekki frost. Í kaldan bílskúr eða sumarhús fer duft.' },
      ],
      notkun: {
        inng: 'Inni, þar sem fólk býr og vinnur og hiti fer ekki undir frostmark. Myndirnar eru líka í myndasafninu efst.',
        listi: [
          { k: 'heimili', mynd: 'myndir/lv-not-heimili.jpg', merki: 'A · B', t: 'Heimili', x: 'Í forstofu eða við útgang, svo allir á heimilinu nái í það á leiðinni út.' },
          { k: 'stigagangur', mynd: 'myndir/lv-not-stigagangur.jpg', merki: 'A', t: 'Stigagangur', x: 'Sameign í fjölbýli: sama staður á hverri hæð, merkt með skilti.' },
          { k: 'skrifstofa', mynd: 'myndir/lv-not-skrifstofa.jpg', merki: 'A', t: 'Skrifstofa', x: 'Pappír, húsgögn og fólk. Óhreinkar minna en duft og byrgir ekki sýn.' },
          { k: 'verslun', mynd: 'myndir/lv-not-verslun.jpg', merki: 'A', t: 'Verslun', x: 'Umbúðir, fatnaður og vörur. Tæki við útganga og afgreiðslu.' },
          { k: 'hotel', mynd: 'myndir/lv-not-hotel.jpg', merki: 'A', t: 'Hótel og gisting', x: 'Á göngum, við stiga og útganga. Gestir þekkja ekki húsið.' },
          { k: 'bilskur', mynd: 'myndir/lv-not-bilskur.jpg', merki: 'A · B', t: 'Upphitaður bílskúr', x: 'Bensín og olía, en aðeins ef skúrinn er kyndur allan veturinn.' },
        ],
      },
      um: {
        yfir: 'Um tækið',
        p: ['Léttvatn er vatn með froðuíblöndun. Vatnið kælir eldinn og froðan leggst sem þunn filma yfir eldfima vökva svo þeir ná ekki súrefni.',
          'Þess vegna ræður tækið bæði við eld í föstum efnum, eins og húsgögnum, pappír og textíl, og í vökvum eins og bensíni og olíu. Glóðin kólnar líka, svo eldurinn kviknar síður aftur.',
          'Léttvatn óhreinkar mun minna en duft og byrgir ekki sýn, svo það hentar vel innandyra þar sem fólk býr og vinnur.'],
        gott: '**Gott að vita:** léttvatnstæki þola ekki frost. Í óupphituðum bílskúr, sumarhúsi eða bát er duft betri kostur.',
      },
      maelir: { yfir: 'Lestu á mælinn einu sinni í mánuði', mynd: 'myndir/maelir.jpg', alt: 'Þrýstimælir á slökkvitæki, nálin á grænu', listi: ['Nálin er á græna svæðinu', 'Innsigli og öryggispinni á sínum stað', 'Engar beyglur, ryð eða sprungur í slöngu', 'Tækið stendur þar sem aldrei frýs', 'Skoðunarmiðinn er yngri en 12 mánaða'], rautt: 'Nálin á rauðu eða tækið hefur frosið? Notaðu það ekki. Komdu með það til okkar.' },
      skref: {
        undir: 'Stattu í 3 til 4 metra fjarlægð, með flóttaleiðina að baki.',
        listi: [['Taktu pinnann úr', 'Rjúfðu innsiglið og togaðu öryggispinnann úr handfanginu.', 'myndir/skref-1.jpg'], ['Miðaðu rétt', 'Á föst efni beint á glóðina. Á vökva á vegg eða brún, svo froðan renni yfir pollinn.', 'myndir/skref-2.jpg'], ['Kreistu handfangið', 'Þrýstu þétt og haltu tækinu uppréttu.', 'myndir/skref-3.jpg'], ['Bleyttu vel', 'Farðu yfir allan flötinn og bleyttu glóðina svo eldurinn kvikni ekki aftur.', 'myndir/skref-4.jpg']],
      },
      stadur: { mynd: 'myndir/veggur.jpg', reglur: REGLUR },
      reikn: { geta: 21 },
      spurn: (s) => [
        [`Hvað þýðir ${s.geta}?`, `Tölurnar segja hve stóran eld tækið slökkti í stöðluðu prófi: ${ab(s.A, s.B)}. Ekkert C, því léttvatn slekkur ekki gaseld.`],
        ['Má léttvatnstæki standa í óupphituðu rými?', 'Nei. Léttvatn þolir ekki frost: tækið virkar ekki og getur skemmst undir frostmarki. Í óupphitaðan bílskúr, sumarhús eða bát mælum við með dufttæki.'],
        SKODUN,
        ['Má nota það á feiti í potti?', 'Nei. Vatn í brennandi feiti getur valdið sprengingu. Settu lok eða eldvarnateppi yfir pottinn og slökktu undir.'],
        ['Má nota það á rafmagnstæki?', s.rafm ? 'Já, upp að 1000 V úr minnst 1 m fjarlægð, eins og stendur á tækinu. Taktu strauminn af ef þú getur. Við tölvur og töflur er kolsýrutæki betra.' : 'Aðeins ef tækið er merkt fyrir rafbúnað á miðanum, og þá úr minnst 1 m fjarlægð. Taktu strauminn af ef þú getur. Við tölvur og töflur er kolsýrutæki betra.'],
        ['Duft eða léttvatn á heimilið?', 'Léttvatn hentar flestum heimilum: það óhreinkar minna og ræður vel við húsgögn og textíl. Duft er betra þar sem getur frosið eða ef gas er í húsinu.'],
      ],
    },

    co2: {
      merki: 'Rafbúnaður, tölvur og töflur',
      inngangur: 'Kolsýrutæki slekkur eld í rafbúnaði og eldfimum vökvum án þess að skilja eftir sig leifar. Besti kosturinn við tölvur, netþjóna og rafmagnstöflur.',
      pillur: ['{**B**} · olía, bensín, leysiefni', '{**Rafbúnaður**} · upp að 1000 V'],
      ef: {
        inng: 'Kolsýra er sérhæfð: hún slekkur í rafbúnaði og vökvum án þess að skemma það sem hún snertir.',
        listi: [
          { k: 'rafb', mynd: 'myndir/co2-ef-rafbunadur.jpg', ico: 'elding', fl: 'Rafbúnaður', t: 'Töflur og tölvur', x: 'Rafmagnstöflur, netþjónar, tölvur og raftæki undir spennu.', stig: 4, v: 'Mjög góð virkni', n: 'Leiðir ekki rafmagn og skilur engar leifar eftir. Minnst 1 m fjarlægð.' },
          { k: 'b', mynd: 'myndir/co2-ef-b.jpg', ico: 'brusi', fl: 'Flokkur B', t: 'Eldfimir vökvar', x: 'Olía, bensín, leysiefni og lakk.', stig: 3, v: 'Góð virkni', n: 'Kolsýran ryður súrefninu frá og kælir. Best á lítinn, byrjandi eld.' },
          { k: 'velar', mynd: 'myndir/co2-ef-velar.jpg', ico: 'tannhjol', fl: 'Vélar og tæki', t: 'Mótorar og vélar', x: 'Rafmótorar, prentarar og vélar í gangi.', stig: 3, v: 'Góð virkni', n: 'Slekkur án þess að skemma vélina sem brann.' },
        ],
      },
      ekki: [
        { k: 'glod', mynd: 'myndir/co2-ekki-glod.jpg', ico: 'logi', fl: 'Flokkur A', t: 'Glóð í föstum efnum', x: 'Timbur og pappír kvikna aftur. Notaðu duft eða léttvatn.' },
        { k: 'lokad', mynd: 'myndir/co2-ekki-lokad.jpg', ico: 'vidvorun', fl: 'Varúð', t: 'Lítil lokuð rými', x: 'Kolsýran ryður súrefni burt. Farðu út og loftaðu.' },
        { k: 'feiti', mynd: 'myndir/ekki-feiti.jpg', ico: 'panna', fl: 'Flokkur F', t: 'Feiti í potti', x: 'Feitin getur blossað upp aftur. Notaðu eldvarnateppi.' },
      ],
      notkun: {
        inng: 'Þar sem rafbúnaður er í húfi og duft myndi valda meira tjóni en eldurinn. Myndirnar eru líka í myndasafninu efst.',
        listi: [
          { k: 'tolvuver', mynd: 'myndir/co2-not-tolvuver.jpg', merki: 'Rafbúnaður', t: 'Tölvuver og netþjónar', x: 'Slekkur án þess að skilja eftir duft í viftum og búnaði.' },
          { k: 'tafla', mynd: 'myndir/co2-not-rafmagnstafla.jpg', merki: 'Rafbúnaður', t: 'Rafmagnstafla', x: 'Tækið fer við töfluna. Taktu strauminn af ef þú getur.' },
          { k: 'skrifstofa', mynd: 'myndir/co2-not-skrifstofa.jpg', merki: 'Rafbúnaður', t: 'Skrifstofa', x: 'Tölvur og prentarar. Til viðbótar við léttvatnstækið fyrir húsgögnin.' },
          { k: 'rannsokn', mynd: 'myndir/co2-not-rannsoknastofa.jpg', merki: 'B · Rafbúnaður', t: 'Rannsóknastofa', x: 'Leysiefni og viðkvæm tæki sem duft myndi eyðileggja.' },
          { k: 'taeknirymi', mynd: 'myndir/co2-not-taeknirymi.jpg', merki: 'B · Rafbúnaður', t: 'Tæknirými og vélarrúm', x: 'Mótorar, dælur og stýringar. Loftaðu út eftir notkun.' },
          { k: 'verkstaedi', mynd: 'myndir/co2-not-verkstaedi.jpg', merki: 'B · Rafbúnaður', t: 'Verkstæði með vélum', x: 'Rafknúnar vélar, olía og smurefni á sama stað.' },
        ],
      },
      um: {
        yfir: 'Um tækið',
        p: ['Kolsýra (CO₂) er gas sem ryður súrefninu frá eldinum og kæfir hann. Hún kemur mjög köld úr tækinu, um −80 °C, og kælir líka.',
          'Kolsýran leiðir ekki rafmagn og gufar upp án þess að skilja eftir sig leifar. Þess vegna er hún besti kosturinn á eld í rafbúnaði, tölvum og töflum, þar sem duft myndi eyðileggja tækin.',
          'Kolsýra slekkur illa glóð í föstum efnum eins og timbri og pappír. Þar þarf duft- eða léttvatnstæki líka, svo kolsýrutækið kemur til viðbótar, ekki í staðinn.'],
        gott: '**Gott að vita:** kolsýran ryður súrefni burt og er hættuleg fólki í litlum rýmum. Farðu út eftir notkun og loftaðu vel.',
      },
      maelir: { yfir: 'Enginn mælir: tækið er vigtað', mynd: 'myndir/co2-vigtun.jpg', alt: 'Kolsýrutæki á vigt', listi: ['Innsigli og öryggispinni á sínum stað', 'Hornið og slangan heil, engar sprungur', 'Tækið hangir á sínum stað og skiltið sést', 'Skoðunarmiðinn er yngri en 12 mánaða'], rautt: 'Kolsýran er geymd sem vökvi og mælir segði ekkert um magnið. Í árlegu skoðuninni vigtum við tækið og hlöðum ef það hefur létt sig um meira en 10%.' },
      skref: {
        undir: 'Kolsýrutæki draga stutt. Farðu nálægt, en hafðu flóttaleiðina að baki.',
        listi: [['Taktu pinnann úr', 'Rjúfðu innsiglið og togaðu öryggispinnann úr.', 'myndir/co2-skref-1.jpg'], ['Haltu um handfangið', 'Aldrei um hornið sjálft. Það verður um −80 °C og getur valdið kalsárum.', 'myndir/co2-skref-2.jpg'], ['Farðu nálægt', 'Stattu 1 til 2 m frá og beindu horninu að rótum eldsins. Á rafbúnað minnst 1 m.', 'myndir/co2-skref-3.jpg'], ['Loftaðu út', 'Farðu út og loftaðu vel áður en farið er inn aftur.', 'myndir/co2-skref-4.jpg']],
      },
      stadur: {
        mynd: 'myndir/co2-veggur.jpg',
        reglur: [REGLUR[0], ['Við búnaðinn sem það á að verja', 'Við rafmagnstöflu, tölvuver eða vélar. Það kemur til viðbótar við duft- eða léttvatnstæki hæðarinnar, ekki í stað þeirra.'], REGLUR[2], ['Í opnu, loftræstu rými', 'Ekki inni í litlum lokuðum skáp eða geymslu þar sem kolsýran safnast fyrir.'], REGLUR[4]],
      },
      reikn: null,
      spurn: (s) => [
        [`Hvað þýðir ${s.geta}?`, `Talan segir að tækið slökkti ${s.B} lítra af brennandi vökva í stöðluðu prófi. Kolsýrutæki fá ekkert A-gildi, því þau slökkva illa glóð.`],
        ['Af hverju er enginn þrýstimælir?', 'Kolsýran er geymd sem vökvi undir miklum þrýstingi og mælir segði ekkert um hve mikið er eftir. Þess vegna eru kolsýrutæki vigtuð í árlegu skoðuninni.'],
        ['Er hættulegt að nota kolsýrutæki inni?', 'Í litlum, lokuðum rýmum já, því kolsýran ryður súrefninu burt. Notaðu tækið, farðu svo út og loftaðu vel áður en farið er inn aftur.'],
        ['Má halda um hornið?', 'Nei. Hornið verður ískalt, um −80 °C, og getur valdið kalsárum. Haltu aðeins um handföngin.'],
        ['Hversu oft þarf að skoða tækið?', 'Einu sinni á ári. Þá er tækið vigtað og hlaðið ef það hefur létt sig um meira en 10%.'],
        ['Dugar kolsýrutæki eitt og sér?', 'Sjaldnast. Það ræður ekki við eld í timbri, pappír og húsgögnum, svo hafðu duft- eða léttvatnstæki líka. Kolsýrutækið fer við rafbúnaðinn.'],
      ],
    },

    reyk: {
      merki: 'Hver hæð, hvert svefnherbergi',
      inngangur: 'Reykskynjari varar við reyk áður en eldurinn breiðist út, líka þegar allir sofa. Einfaldasti og ódýrasti hluti brunavarna heimilisins.',
      pillur: ['{**85 dB**} · minnst', '{**10 ár**} · líftími'],
      ef: {
        yfir: 'Hvað nemur skynjarinn best?',
        inng: 'Flestir brunar á heimilum byrja hægt, með reyk frá glóð. Skynjarinn nemur reykinn löngu áður en logar sjást.',
        listi: [
          { k: 'glod', mynd: 'myndir/rk-ef-glod.jpg', ico: 'logi', fl: 'Glóð', t: 'Sófi, rúm og textíll', x: 'Eldur sem kraumar lengi og myndar mikinn reyk.', stig: 4, v: 'Nemur mjög snemma', n: 'Algengur næturbruni. Skynjarinn vekur þig áður en reykurinn verður hættulegur.' },
          { k: 'eldur', mynd: 'myndir/rk-ef-eldur.jpg', ico: 'logi', fl: 'Opinn eldur', t: 'Logar og reykur', x: 'Eldur sem breiðist hratt út, til dæmis í pappír eða rusli.', stig: 3, v: 'Nemur vel', n: 'Reykurinn stígur upp í loftið þar sem skynjarinn er.' },
          { k: 'raftaeki', mynd: 'myndir/rk-ef-raftaeki.jpg', ico: 'elding', fl: 'Raftæki', t: 'Ofhitnun', x: 'Fjöltengi, hleðslutæki og raftæki sem byrja að bráðna.', stig: 4, v: 'Nemur mjög snemma', n: 'Plast sem hitnar gefur frá sér reyk áður en það kviknar í því.' },
        ],
      },
      ekkiTitill: 'Ekki setja hann hér', ekkiUndir: 'Þar fer hann í gang að ástæðulausu.',
      ekki: [
        { k: 'eldhus', mynd: 'myndir/rk-ekki-eldhus.jpg', ico: 'panna', fl: 'Eldhús', t: 'Beint yfir eldavél', x: 'Gufa og steiking. Settu hann frammi á gangi.' },
        { k: 'bad', mynd: 'myndir/rk-ekki-bad.jpg', ico: 'vidvorun', fl: 'Baðherbergi', t: 'Gufa úr sturtu', x: 'Gufan líkist reyk. Settu hann utan við baðið.' },
        { k: 'kalt', mynd: 'myndir/rk-ekki-kalt.jpg', ico: 'snjor', fl: 'Óupphitað', t: 'Kaldur, rykugur skúr', x: 'Ryk, útblástur og kuldi trufla nemann.' },
      ],
      notkun: {
        yfir: 'Hvar kemur skynjarinn að gagni?',
        inng: 'Þar sem fólk sefur og þar sem það fer út. Myndirnar eru líka í myndasafninu efst.',
        listi: [
          { k: 'svefnherbergi', mynd: 'myndir/rk-not-svefnherbergi.jpg', merki: 'Svefn', t: 'Svefnherbergi', x: 'Svo hljóðið nái að vekja þig, líka með lokaðar dyr.' },
          { k: 'gangur', mynd: 'myndir/rk-not-gangur.jpg', merki: 'Flóttaleið', t: 'Gangur', x: 'Framan við svefnherbergin, á leiðinni út.' },
          { k: 'stofa', mynd: 'myndir/rk-not-stofa.jpg', merki: 'Glóð', t: 'Stofa', x: 'Sófi, sjónvarp og hleðslutæki. Hér byrja margir brunar.' },
          { k: 'stigagangur', mynd: 'myndir/rk-not-stigagangur.jpg', merki: 'Hver hæð', t: 'Stigagangur', x: 'Minnst einn á hverri hæð, helst efst í stiganum.' },
          { k: 'sumarhus', mynd: 'myndir/rk-not-sumarhus.jpg', merki: 'Svefn', t: 'Sumarhús', x: 'Kamína, kerti og fólk sem þekkir ekki húsið.' },
          { k: 'gisting', mynd: 'myndir/rk-not-gisting.jpg', merki: 'Skylda', t: 'Gistiherbergi', x: 'Einn í hverju herbergi, nema brunaviðvörunarkerfi sé í húsinu.' },
        ],
      },
      um: {
        yfir: 'Um skynjarann',
        p: ['Reykskynjari nemur reyk og gefur frá sér hátt viðvörunarhljóð, minnst 85 dB í þriggja metra fjarlægð, svo allir í húsinu vakni.',
          'Skynjararnir okkar nema reyk frá glóð vel, til dæmis í sófa, rúmi eða ofhitnuðu raftæki. Slíkur eldur getur kraumað lengi áður en logar sjást, og reykurinn er hættulegastur þegar fólk sefur.',
          'Byggingarreglugerð gerir kröfu um reykskynjara í íbúðum: minnst einn á hverri hæð og einn á hverja 80 m².'],
        gott: '**Gott að vita:** skynjari með 10 ára rafhlöðu þarf aldrei rafhlöðuskipti. Þú skiptir um allan skynjarann eftir 10 ár.',
      },
      maelir: { yfir: 'Prófaðu hann einu sinni í mánuði', mynd: 'myndir/rk-profun.jpg', alt: 'Fingur ýtir á prófunarhnapp reykskynjara', listi: ['Haltu prófunarhnappinum inni þar til hann pípir', 'Ryksugaðu létt yfir raufarnar', 'Stutt píp á mínútu fresti þýðir að rafhlaðan er að klárast', 'Skiptu um skynjarann eftir 10 ár', 'Aldrei mála yfir hann eða líma fyrir'], rautt: 'Heyrist ekkert þegar þú prófar? Skiptu um rafhlöðu eða skynjara strax.' },
      skref: {
        yfir: 'Svona setur þú hann upp',
        undir: 'Tekur nokkrar mínútur. Engar snúrur.',
        listi: [['Veldu stað', 'Í loftinu, minnst 50 cm frá vegg, horni og ljósum.', 'myndir/rk-skref-1.jpg'], ['Skrúfaðu festinguna', 'Festu plötuna í loftið með skrúfunum.', 'myndir/rk-skref-2.jpg'], ['Snúðu honum á', 'Settu skynjarann á festinguna og snúðu þar til hann smellur.', 'myndir/rk-skref-3.jpg'], ['Prófaðu', 'Ýttu á prófunarhnappinn og hlustaðu.', 'myndir/rk-profun.jpg']],
        s112: 'Ef skynjarinn fer í gang: komdu öllum út, lokaðu á eftir þér og hringdu í 112.',
      },
      stadur: {
        yfir: 'Reglur um staðsetningu',
        mynd: 'myndir/rk-loft.jpg', alt: 'Reykskynjari á miðju lofti',
        reglur: [
          ['Minnst einn á hverri hæð', 'Og minnst einn á hverja 80 m². Einn í hverri íbúð að lágmarki.'],
          ['Hljóðið þarf að heyrast í svefnherbergjum', 'Minnst 75 dB inni í hverju svefnherbergi. Í stærri íbúðum þarf skynjara í svefnherbergin eða samtengda skynjara.'],
          ['Í loftinu, frá vegg og horni', 'Minnst 50 cm frá vegg, horni og loftljósum, helst á miðju lofti.'],
          ['Við flóttaleiðir', 'Framan við svefnherbergi, á ganginum þar sem fólk fer út.'],
          ['Einn í hverju gistiherbergi', 'Í gistingu, nema sjálfvirkt brunaviðvörunarkerfi sé í húsinu.'],
        ],
        heimild: 'Heimild: byggingarreglugerð nr. 112/2012, greinar 9.4.2 og 9.4.3. Staðallinn um reykskynjara er ÍST EN 14604.',
      },
      reikn: { skynjarar: 80 },
      bordi: { k: 'reyk', x: 'Reykskynjari sem virkar vekur heimilið áður en reykurinn verður hættulegur.' },
      hentar: { yfir: 'Hvaða skynjari hentar?', x: '**9V skynjarinn** gengur fyrir rafhlöðu sem skipt er um árlega. **10 ára skynjarinn** er með innbyggðri rafhlöðu sem endist allan líftímann. **Þráðlausi skynjarinn** er líka með 10 ára rafhlöðu og samtengist hinum, svo allir fara í gang í einu.', takkar: [['9V', 13], ['10 ára', 3], ['Þráðlaus', 14]] },
      spurn: () => [
        ['Af hverju pípir skynjarinn stutt á mínútu fresti?', 'Rafhlaðan er að klárast. Skiptu um hana strax, eða um allan skynjarann ef hann er með innbyggðri 10 ára rafhlöðu.'],
        ['Hvað þýðir samtengdur?', 'Þegar einn skynjari nemur reyk fara allir í gang, svo þú heyrir viðvörunina þó eldurinn sé á annarri hæð eða í hinum enda hússins.'],
        ['Hvenær á að skipta um skynjara?', 'Á 10 ára fresti. Neminn eldist og verður ónákvæmari. Dagsetningin stendur á bakhliðinni.'],
        ['Má setja hann í eldhúsið?', 'Ekki beint við eldavélina, þar fer hann í gang við hverja steikingu. Settu hann frammi á ganginum.'],
        ['Hversu oft á að prófa hann?', 'Einu sinni í mánuði með prófunarhnappinum, og alltaf þegar þú kemur heim eftir langa fjarveru.'],
        ['Fer hann í gang ef ég er að heiman?', 'Hann vælir á staðnum en hringir ekki í neinn. Fyrir fyrirtæki og stærri hús þarf brunaviðvörunarkerfi með vöktun.'],
      ],
    },

    teppi: {
      merki: 'Eldhús, kaffistofur og hjólhýsi',
      inngangur: 'Eldvarnateppi kæfir eld í potti eða pönnu á augabragði. Öruggasta leiðin til að slökkva eld í feiti, þar sem aldrei má nota vatn.',
      pillur: ['{**F**} · feiti og matarolía', '{**A**} · eldur í fötum'],
      ef: {
        yfir: 'Á hvað virkar teppið best?',
        inng: 'Teppið lokar á súrefnið. Það virkar best á lítinn eld sem það nær að hylja allan.',
        listi: [
          { k: 'pottur', mynd: 'myndir/tp-ef-pottur.jpg', ico: 'panna', fl: 'Flokkur F', t: 'Feiti í potti', x: 'Matarolía og feiti í potti eða á pönnu.', stig: 4, v: 'Mjög góð virkni', n: 'Leggðu teppið yfir og láttu það liggja þar til allt hefur kólnað.' },
          { k: 'fot', mynd: 'myndir/tp-ef-fot.jpg', ico: 'logi', fl: 'Eldur í fatnaði', t: 'Föt og fólk', x: 'Ef kviknar í fötum einhvers.', stig: 4, v: 'Mjög góð virkni', n: 'Vefðu teppinu þétt utan um til að kæfa eldinn.' },
          { k: 'smaeldar', mynd: 'myndir/tp-ef-smaeldar.jpg', ico: 'logi', fl: 'Smáeldar', t: 'Ruslafata og kerti', x: 'Lítill eldur sem teppið nær að hylja allan.', stig: 3, v: 'Góð virkni', n: 'Ef teppið nær ekki yfir allan eldinn þarf slökkvitæki.' },
        ],
      },
      ekki: [
        { k: 'utbreiddur', mynd: 'myndir/tp-ekki-utbreiddur.jpg', ico: 'vidvorun', fl: 'Of stór', t: 'Eldur sem hefur breiðst út', x: 'Forðaðu þér, lokaðu á eftir þér og hringdu í 112.' },
        { k: 'tafla', mynd: 'myndir/tp-ekki-tafla.jpg', ico: 'elding', fl: 'Rafbúnaður', t: 'Rafmagnstöflur', x: 'Notaðu kolsýrutæki.' },
        { k: 'pollur', mynd: 'myndir/tp-ekki-pollur.jpg', ico: 'brusi', fl: 'Flokkur B', t: 'Stór pollur af eldsneyti', x: 'Teppið nær ekki yfir. Notaðu duft.' },
      ],
      notkun: {
        yfir: 'Hvar kemur teppið að gagni?',
        inng: 'Alls staðar þar sem eldað er. Myndirnar eru líka í myndasafninu efst.',
        listi: [
          { k: 'eldhus', mynd: 'myndir/tp-not-eldhus.jpg', merki: 'F', t: 'Eldhús', x: 'Hangir nálægt útgangi eldhússins, ekki yfir eldavélinni.' },
          { k: 'kaffistofa', mynd: 'myndir/tp-not-kaffistofa.jpg', merki: 'F', t: 'Kaffistofa og mötuneyti', x: 'Þar sem margir elda og hita mat.' },
          { k: 'hjolhysi', mynd: 'myndir/tp-not-hjolhysi.jpg', merki: 'F', t: 'Hjólhýsi og húsbíll', x: 'Lítið og létt, tekur ekkert pláss á veggnum.' },
          { k: 'sumarhus', mynd: 'myndir/tp-not-sumarhus.jpg', merki: 'F', t: 'Sumarhús', x: 'Ókunnugt eldhús og langt í slökkvilið.' },
          { k: 'bilskur', mynd: 'myndir/tp-not-bilskur.jpg', merki: 'A', t: 'Bílskúr og verkstæði', x: 'Fyrir smáelda og eld í fötum við vinnu.' },
          { k: 'pallur', mynd: 'myndir/tp-not-pallur.jpg', merki: 'F', t: 'Pallur og grill', x: 'Feiti sem kviknar í á grillinu.' },
        ],
      },
      um: {
        yfir: 'Um teppið',
        p: ['Eldvarnateppi er ofið úr glertrefjum sem þola mikinn hita. Það er lagt yfir eldinn og lokar á súrefnið, svo eldurinn kafnar.',
          'Það er besta leiðin til að slökkva eld í feiti eða matarolíu, því þar má aldrei nota vatn: vatnið sýður samstundis og þeytir logandi feitinni yfir eldhúsið.',
          'Teppið hangir á vegg. Þú togar í borðana, teppið rennur úr hylkinu og er tilbúið á augabragði.'],
        gott: '**Gott að vita:** teppið er einnota. Eftir notkun fer það í ruslið og nýtt kemur í staðinn.',
      },
      maelir: { yfir: 'Athugaðu teppið', mynd: 'myndir/tp-athugun.jpg', alt: 'Eldvarnateppi á vegg', listi: ['Hylkið hangir á sínum stað og er heilt', 'Borðarnir standa niður úr hylkinu', 'Ekkert hangir fyrir eða hylur það', 'Teppið hefur aldrei verið notað'], rautt: 'Búið að nota teppið? Fáðu þér nýtt, það er einnota.' },
      skref: {
        yfir: 'Svona notarðu teppið',
        undir: 'Aldrei vatn á brennandi feiti.',
        listi: [['Togaðu í borðana', 'Teppið rennur úr hylkinu. Haltu í borðana.', 'myndir/tp-skref-1.jpg'], ['Hlífðu höndunum', 'Haltu teppinu fyrir framan þig og vefðu brúnunum yfir hendurnar.', 'myndir/tp-skref-2.jpg'], ['Leggðu það yfir eldinn', 'Leggðu það varlega yfir pottinn, frá þér, og þektu allt eldsvæðið.', 'myndir/tp-skref-3.jpg'], ['Slökktu á hellunni', 'Slökktu á hitanum og láttu teppið liggja þar til allt hefur kólnað.', 'myndir/tp-skref-4.jpg']],
      },
      stadur: {
        yfir: 'Hvar á teppið að hanga?',
        mynd: 'myndir/tp-veggur.jpg', alt: 'Eldvarnateppi við útgang eldhússins',
        reglur: [
          ['Í eldhúsinu, nálægt útgangi', 'Svo þú náir í það á leiðinni frá eldinum, ekki yfir honum.'],
          ['Ekki beint yfir eldavélinni', 'Þar nærðu ekki í það ef kviknar í pottinum.'],
          ['Í seilingarhæð', 'Allir á heimilinu eiga að ná í borðana án þess að teygja sig.'],
          ['Eitt í hverju eldhúsi', 'Líka í kaffistofu, mötuneyti, hjólhýsi og sumarhúsi.'],
          ['Slökkvitæki nálægt', 'Teppið er fyrir pottinn. Slökkvitæki fyrir annað sem kviknar í.'],
        ],
        heimild: 'Staðallinn um eldvarnateppi er ÍST EN 1869. Teppin eru einnota.',
      },
      reikn: null,
      bordi: { k: 'teppi', x: 'Eldvarnateppi í eldhúsinu breytir pottabruna í smáatvik.' },
      reiknTexti: { yfir: 'Eitt teppi í hvert eldhús', x: 'Teppið telst ekki með í slökkvigetu hæðarinnar. Það kemur til viðbótar við slökkvitækið, í eldhúsið þar sem eldað er.', takki: ['Skoða léttvatnstækið', 18] },
      hentar: { yfir: 'Teppi eða slökkvitæki?', x: 'Á feiti í potti er **eldvarnateppi** best. Á annan eld í eldhúsinu hentar **léttvatn** vel. Hafðu bæði.', takkar: [['Eldvarnateppi', 4], ['Léttvatn 6 L', 18]] },
      spurn: () => [
        ['Má nota teppið aftur?', 'Nei. Eldvarnateppi er einnota. Eftir notkun fer það í ruslið og þú færð þér nýtt.'],
        ['Af hverju ekki vatn á feiti?', 'Vatnið sýður samstundis, þenst út og þeytir logandi feitinni yfir eldhúsið. Teppið kæfir eldinn án þess.'],
        ['Hvað á teppið að liggja lengi?', 'Þar til potturinn hefur kólnað alveg. Ekki lyfta því til að kíkja, þá getur eldurinn blossað upp aftur.'],
        ['Hvað ef kviknar í fötum?', 'Vefðu teppinu þétt utan um manneskjuna til að kæfa eldinn, eða láttu hana leggjast og rúlla. Kældu brunann svo með köldu vatni.'],
        ['Hvar á teppið að hanga?', 'Í eldhúsinu, nálægt útgangi en ekki beint yfir eldavélinni, svo þú náir í það án þess að teygja þig yfir eldinn.'],
        ['Þarf að skoða teppið?', 'Já, við förum yfir það í árlegu skoðuninni með slökkvitækjunum: hylkið heilt, borðarnir lausir og teppið ónotað.'],
      ],
    },
  };

  // Það sem er ólíkt eftir stærð: slökkvigeta (A, B), tölurnar fjórar, þrjú atriði, tæknilýsing og þjónustuverð
  const SERHAEFT = {
    1: {
      snid: 'duft', geta: '43A 233B C', A: 43, B: 233,
      tolur: [['6 kg', 'ABC slökkviduft'], ['43A 233B C', 'Slökkvigeta'], ['≈ 15 sek', 'Losunartími'], ['≈ 6 m', 'Kastlengd']],
      atridi: ['Slökkvigeta **43A 233B C**', 'Þrýstimælir sýnir í fljótu bragði hvort tækið er tilbúið', 'Þolir frost, veggfesting fylgir, CE-merkt samkvæmt ÍST EN 3'],
      taekni: [['Gerð', 'Forþrýst duftslökkvitæki'], ['Slökkviefni', 'ABC duft, 6 kg'], ['Drifefni', 'Köfnunarefni (N₂)'], ['Slökkvigeta', '43A 233B C'], ['Losunartími', 'Um 15 sekúndur'], ['Kastlengd', 'Um 6 metrar'], ['Hitaþol', '−30 °C til +60 °C'], ['Hæð og þvermál', 'Um 55 cm · 16 cm'], ['Þyngd með dufti', 'Um 9,5 kg'], ['Staðall', 'ÍST EN 3, CE-merkt'], ['Fylgir', 'Veggfesting og þrýstimælir']],
      thjon: [['Árleg yfirferð', '4.200 kr'], ['Hleðsla eftir notkun', '8.410 kr']],
    },
    12: {
      snid: 'duft', geta: '13A 89B C', A: 13, B: 89,
      merki: 'Í bílinn, bátinn og sumarhúsið',
      inngangur: 'Lítið og létt fjölnota slökkvitæki sem vinnur á eldi í föstum efnum, eldfimum vökvum og gasi. Passar í bílinn, bátinn, hjólhýsið og sumarhúsið.',
      um: ['Duft 2 kg. ABC er lítið tæki sem ræður við eld í ólíkum efnum: timbri, pappír og plasti, olíu og bensíni, eða gasi. Það er létt í hendi og passar þar sem pláss er lítið.',
        'Duftið leggst yfir eldinn, kæfir hann og rýfur efnahvarfið í loganum, svo eldurinn slokknar hratt. Tækið er forþrýst með köfnunarefni og alltaf tilbúið.',
        'Tvö kíló eru gott tæki í bíl, bát eða hjólhýsi. Sem aðaltæki á vinnustað eða í sameign mælum við með 6 kg tæki, sem hefur meira en þrefalt A-gildi.'],
      tolur: [['2 kg', 'ABC slökkviduft'], ['13A 89B C', 'Slökkvigeta'], ['≈ 8 sek', 'Losunartími'], ['≈ 4 m', 'Kastlengd']],
      atridi: ['Slökkvigeta **13A 89B C**', 'Lítið og létt, passar í bíl, bát og hjólhýsi', 'Þolir frost, CE-merkt samkvæmt ÍST EN 3'],
      taekni: [['Gerð', 'Forþrýst duftslökkvitæki'], ['Slökkviefni', 'ABC duft, 2 kg'], ['Drifefni', 'Köfnunarefni (N₂)'], ['Slökkvigeta', '13A 89B C'], ['Losunartími', 'Um 8 sekúndur'], ['Kastlengd', 'Um 4 metrar'], ['Hitaþol', '−30 °C til +60 °C'], ['Staðall', 'ÍST EN 3, CE-merkt']],
      thjon: [['Árleg yfirferð', '3.600 kr'], ['Hleðsla eftir notkun', '5.200 kr']],
    },
    18: {
      snid: 'lettvatn', geta: '21A 144B', A: 21, B: 144, rafm: false,
      tolur: [['6 L', 'Léttvatn'], ['21A 144B', 'Slökkvigeta'], ['A + B', 'Föst efni og vökvar'], ['+5 °C', 'Lægsti hiti · þolir ekki frost']],
      atridi: ['Slökkvigeta **21A 144B**', 'Kælir glóðina svo eldurinn kviknar síður aftur', 'Óhreinkar minna en duft. Veggfesting fylgir'],
      taekni: [['Gerð', 'Forþrýst léttvatnstæki'], ['Slökkviefni', 'Vatn með froðuíblöndun, 6 lítrar'], ['Slökkvigeta', '21A 144B'], ['Losunartími', 'Um 30 sekúndur'], ['Kastlengd', 'Um 4 metrar'], ['Hitaþol', '+5 °C til +60 °C, þolir ekki frost'], ['Hæð og þvermál', 'Um 55 cm · 16 cm'], ['Þyngd fullt', 'Um 10 kg'], ['Staðall', 'ÍST EN 3, CE-merkt'], ['Fylgir', 'Veggfesting og þrýstimælir']],
      thjon: [['Árleg yfirferð', '3.906 kr'], ['Hleðsla eftir notkun', '8.410 kr']],
    },
    174: {
      snid: 'lettvatn', geta: '5A 34B', A: 5, B: 34, rafm: true,
      tolur: [['2 L', 'Léttvatn'], ['5A 34B', 'Slökkvigeta'], ['1000 V', 'Rafbúnaður úr 1 m'], ['+5 °C', 'Lægsti hiti · þolir ekki frost']],
      atridi: ['Slökkvigeta **5A 34B**', 'Lítið og létt, passar í forstofu, íbúð og sumarbústað sem er kyndur', 'Má nota á rafbúnað upp að 1000 V úr minnst 1 m fjarlægð'],
      taekni: [['Gerð', 'Forþrýst léttvatnstæki'], ['Slökkviefni', 'Vatn með froðuíblöndun, 2 lítrar'], ['Slökkvigeta', '5A 34B'], ['Rafbúnaður', 'Upp að 1000 V, minnst 1 m'], ['Losunartími', 'Um 10 sekúndur'], ['Kastlengd', 'Um 3 metrar'], ['Hitaþol', '+5 °C til +60 °C, þolir ekki frost'], ['Hæð', 'Um 40 cm'], ['Þyngd fullt', 'Um 3,5 kg'], ['Staðall', 'ÍST EN 3, CE-merkt'], ['Fylgir', 'Þrýstimælir']],
      thjon: [['Árleg yfirferð', '3.600 kr'], ['Hleðsla eftir notkun', '5.200 kr']],
    },
    2: {
      snid: 'co2', geta: '34B', A: 0, B: 34,
      tolur: [['2 kg', 'Kolsýra (CO₂)'], ['34B', 'Slökkvigeta'], ['1000 V', 'Rafbúnaður úr 1 m'], ['0 leifar', 'Skilur ekkert eftir']],
      atridi: ['Slökkvigeta **34B**', 'Skilur engar leifar eftir á tækjum og búnaði', 'Má nota á rafbúnað upp að 1000 V úr minnst 1 m fjarlægð'],
      taekni: [['Gerð', 'Kolsýrutæki (CO₂ undir þrýstingi)'], ['Slökkviefni', 'Kolsýra, 2 kg'], ['Slökkvigeta', '34B'], ['Rafbúnaður', 'Upp að 1000 V, minnst 1 m'], ['Losunartími', 'Um 7 sekúndur'], ['Kastlengd', 'Um 2 til 3 metrar'], ['Hitaþol', '−30 °C til +60 °C'], ['Hæð', 'Um 58 cm'], ['Þyngd fullt', 'Um 6,5 kg'], ['Staðall', 'ÍST EN 3, CE-merkt'], ['Þrýstimælir', 'Enginn: tækið er vigtað']],
      thjon: [['Árleg yfirferð', '4.055 kr'], ['Hleðsla eftir notkun', '4.216 kr']],
    },
    25: {
      snid: 'co2', geta: '89B', A: 0, B: 89,
      tolur: [['5 kg', 'Kolsýra (CO₂)'], ['89B', 'Slökkvigeta'], ['1000 V', 'Rafbúnaður úr 1 m'], ['0 leifar', 'Skilur ekkert eftir']],
      atridi: ['Slökkvigeta **89B**', 'Löng slanga með horni, nær vel að töflum og vélum', 'Má nota á rafbúnað upp að 1000 V úr minnst 1 m fjarlægð'],
      taekni: [['Gerð', 'Kolsýrutæki (CO₂ undir þrýstingi)'], ['Slökkviefni', 'Kolsýra, 5 kg'], ['Slökkvigeta', '89B'], ['Rafbúnaður', 'Upp að 1000 V, minnst 1 m'], ['Losunartími', 'Um 9 sekúndur'], ['Kastlengd', 'Um 2 til 3 metrar'], ['Hitaþol', '−30 °C til +60 °C'], ['Hæð', 'Um 70 cm'], ['Þyngd fullt', 'Um 14 kg'], ['Staðall', 'ÍST EN 3, CE-merkt'], ['Fylgir', 'Slanga með horni · enginn þrýstimælir']],
      thjon: [['Árleg yfirferð', '4.055 kr'], ['Hleðsla eftir notkun', '8.556 kr']],
    },
    3: {
      snid: 'reyk',
      pillur: ['{**Ljósnemi**} · glóð og reykur', '{**10 ára**} · rafhlaða'],
      tolur: [['10 ára', 'Rafhlaða fylgir'], ['Ljósnemi', 'Nemur glóð snemma'], ['85 dB', 'Viðvörunarhljóð'], ['Stakur', 'Ekki samtengdur']],
      atridi: ['Ljósnemi sem nemur reyk frá glóð snemma', '10 ára rafhlaða, engin rafhlöðuskipti', 'Stakur skynjari, CE-vottaður'],
      taekni: [['Gerð', 'Reykskynjari með ljósnema'], ['Rafhlaða', 'Innbyggð, endist í 10 ár'], ['Samtenging', 'Nei, stakur'], ['Prófunarhnappur', 'Já'], ['Líftími', '10 ár'], ['Vottun', 'CE']],
      thjon: [],
    },
    13: {
      snid: 'reyk',
      pillur: ['{**Ljósnemi**} · glóð og reykur', '{**9V**} · rafhlaða'],
      tolur: [['9V', 'Rafhlaða, skipt árlega'], ['Ljósnemi', 'Nemur glóð snemma'], ['85 dB', 'Viðvörunarhljóð'], ['EN 14604', 'Staðall']],
      atridi: ['Ljósnemi sem nemur reyk frá glóð snemma', 'Gengur fyrir 9V rafhlöðu sem skipt er um árlega', 'Uppfyllir staðalinn EN 14604'],
      taekni: [['Gerð', 'Reykskynjari með ljósnema (Numens SND-500)'], ['Rafhlaða', '9V, skipt um árlega'], ['Samtenging', 'Nei, stakur'], ['Prófunarhnappur', 'Já'], ['Líftími', '10 ár'], ['Staðall', 'EN 14604']],
      thjon: [],
    },
    14: {
      snid: 'reyk',
      pillur: ['{**Þráðlaus**} · samtenging', '{**10 ára**} · liþíumrafhlaða'],
      tolur: [['10 ára', 'Liþíumrafhlaða fylgir'], ['Þráðlaus', 'Samtengist öðrum'], ['85 dB', 'Viðvörunarhljóð'], ['LPCB · CE', 'Vottaður']],
      atridi: ['Samtengist þráðlaust: einn fer í gang, allir fara í gang', '10 ára liþíumrafhlaða fylgir', 'LPCB- og CE-vottaður'],
      taekni: [['Gerð', 'Reykskynjari, þráðlaust samtengjanlegur (Numens)'], ['Rafhlaða', 'Liþíum, endist í 10 ár, fylgir'], ['Samtenging', 'Þráðlaus (RF)'], ['Prófunarhnappur', 'Já'], ['Líftími', '10 ár'], ['Vottun', 'LPCB, CE']],
      thjon: [],
    },
    4: {
      snid: 'teppi',
      tolur: [['1 × 1 m', 'Glertrefjar'], ['F', 'Feiti í potti'], ['Einnota', 'Nýtt eftir notkun'], ['Hylki', 'Losað með borðum']],
      atridi: ['Kæfir eld í potti á augabragði', 'Togað í borðana og teppið rennur úr hylkinu', 'Leiðbeiningar á íslensku á hylkinu'],
      taekni: [['Gerð', 'Eldvarnateppi úr glertrefjum'], ['Stærð', '100 × 100 cm'], ['Geymsla', 'Vegghengt hylki, losað með borðum'], ['Hentar fyrir', 'Feiti í potti, eld í fötum, smáelda'], ['Notkun', 'Einnota'], ['Leiðbeiningar', 'Á íslensku, á hylkinu']],
      thjon: [],
    },
    340: {
      snid: 'teppi',
      tolur: [['1 × 1 m', 'Eldvarnateppi'], ['F', 'Feiti í potti'], ['Einnota', 'Nýtt eftir notkun'], ['Taska', 'Hangir á vegg']],
      atridi: ['Kæfir eld í potti á augabragði', 'Í hvítri tösku sem hangir á vegg', 'Frá viðurkenndum framleiðanda sem uppfyllir staðla'],
      taekni: [['Gerð', 'Eldvarnateppi'], ['Stærð', '100 × 100 cm'], ['Geymsla', 'Hvít taska með auga til að hengja upp'], ['Hentar fyrir', 'Feiti í potti, eld í fötum, smáelda'], ['Notkun', 'Einnota'], ['Staðlar', 'Uppfyllir staðla samkvæmt framleiðanda']],
      thjon: [],
    },
  };
  const SJALFGEFINN_PROFILL = [1, 12, 18, 174, 2, 25, 3, 13, 14, 4, 340];
  function sniðVoru(v) {
    if (SERHAEFT[v.id]) return SERHAEFT[v.id].snid;
    const n = String(v.innraNafn || v.nafn || '').toLowerCase();   // innra heitið: birt heiti (t.d. „Kolsýruhylki“) má ekki breyta gerðinni
    if (/co₂|co2|kolsýr/.test(n)) return 'co2';
    if (/léttvatn|lettvatn/.test(n)) return 'lettvatn';
    if (/duft/.test(n)) return 'duft';
    if (/reykskynjar/.test(n)) return 'reyk';
    if (/eldvarna\S*teppi/.test(n)) return 'teppi';
    return null;
  }
  // Sérhæfð gildi vöru, eða gildi næsta tækis af sömu gerð (vara sem fær prófíl í ritlinum án eigin talna)
  function serGildi(v) {
    if (SERHAEFT[v.id]) return SERHAEFT[v.id];
    const s = sniðVoru(v);
    return SERHAEFT[{ duft: 1, lettvatn: 18, co2: 2, reyk: 3, teppi: 4 }[s] || 1];
  }
  VV.snidVoru = sniðVoru;

  function tengdar(v) {
    const syn = synilegar(), out = [], sed = new Set([v.id]);
    for (const f of [...new Set(syn.map((x) => x.flokkur))]) {
      if (out.length >= 4) break;
      if (f === v.flokkur) continue;
      const c = syn.find((x) => x.flokkur === f && !sed.has(x.id));
      if (c) { out.push(c); sed.add(c.id); }
    }
    for (const x of syn) { if (out.length >= 4) break; if (!sed.has(x.id)) { out.push(x); sed.add(x.id); } }
    return out;
  }

  function galleri(v, P, Pr) {
    const syn = [{ teg: 'vara' }].concat(Pr ? Pr.notkun.listi.map((n) => ({ teg: 'not', n })) : []);
    const i = Math.min(VV.vara.mynd, syn.length - 1);
    const valid = syn[i];
    let adal;
    if (valid.teg === 'vara') {
      adal = `${Pr ? E('span', `${P}.merki`, (SERHAEFT[v.id] || {}).merki || Pr.merki, 'vv-galleri-merki') : ''}${M('vara.galleri', { src: v.mynd, alt: v.nafn, fit: 'contain', h: 600, bak: '#ffffff' }, { srcKey: `${P}.mynd`, strax: 1 })}`;
    } else {
      const n = valid.n;
      adal = `${M('vara.galleri.not', { src: n.mynd, alt: n.t, fit: 'cover', h: 420 }, { srcKey: `${P}.not.${n.k}.mynd` })}<div class="vv-galleri-texti">${E('span', `${P}.not.${n.k}.merki`, n.merki, 'vv-flokkmerki')}${E('h3', `${P}.not.${n.k}.t`, n.t)}${E('p', `${P}.not.${n.k}.x`, n.x)}</div>`;
    }
    const thumbs = syn.length > 1 ? `<div class="vv-thumbs" role="group" aria-label="Myndir">${syn.map((s, k) => {
      const src = s.teg === 'vara' ? VV.myndSrc(`${P}.mynd`, v.mynd) : VV.myndSrc(`${P}.not.${s.n.k}.mynd`, s.n.mynd);
      return `<button type="button" class="vv-thumb${s.teg === 'vara' ? ' vara' : ''}" data-act="mynd" data-i="${k}" aria-pressed="${k === i}" aria-label="${esc(s.teg === 'vara' ? 'Vörumynd' : s.n.t)}"><img src="${esc(src)}" alt="" loading="lazy"></button>`;
    }).join('')}</div>` : '';
    return `<div class="vv-galleri">${adal}</div>${thumbs}`;
  }

  // „Hvaða tæki hentar?"-spjaldið: slökkvitæki deila einu (lyklar hentar.*), skynjarar og teppi eiga sitt
  function hentarSpjald(P, Pr) {
    const h = Pr.hentar || { k: 'hentar', yfir: 'Hvaða tæki hentar?', x: '**Duft ABC** vinnur á flestum eldum. **Léttvatn** hentar vel á heimilin, á A og B elda. **CO₂** er fyrir rafmagn og rafeindatæki.', takkar: [['Duft', 1], ['Léttvatn', 18], ['CO₂', 2]] };
    const k = h.k || `${P}.hentar`;
    return `<div class="vv-blad navy" style="padding:36px">${E('h3', k + '.yfir', h.yfir, 'vv-h3')}${E('p', k + '.x', h.x, 'vv-dauft')}<div class="vv-flokkar" style="margin-top:6px">${h.takkar.map(([t, id], i) => `<a class="vv-btn sm" href="#vara-${id}">${E('span', k + (h.k ? ['.duft', '.lettvatn', '.co2'][i] : '.takki' + (i + 1)), t)}</a>`).join('')}</div></div>`;
  }

  function kaflarRikir(v, P, Pr, S) {
    const tolur = B(`${P}.tolur`, S.tolur.map(([a, b], i) => `<div class="vv-tala">${E('b', `${P}.tala.${i + 1}.t`, a)}${E('span', `${P}.tala.${i + 1}.s`, b)}</div>`).join(''), 'vv-tolur', 'div');

    const efKort = Pr.ef.listi.map((f) => {
      const stig = Math.round(Math.min(4, Math.max(0, nGildi(`${P}.ef.${f.k}.stig`, f.stig))));
      return `<div class="vv-ef">${M(`${P}.ef.${f.k}.mynd`, { src: f.mynd, alt: f.t, fit: 'cover', bak: '#ffffff' }, { fast: 1 })}<div class="vv-ef-i">
<div class="vv-ef-haus"><span class="vv-ef-tafla">${ico(f.ico)}</span><h3>${E('small', `${P}.ef.${f.k}.fl`, f.fl)}${E('span', `${P}.ef.${f.k}.t`, f.t)}</h3></div>
${E('p', `${P}.ef.${f.k}.x`, f.x)}
<div class="vv-virkni"><span data-n="${P}.ef.${f.k}.stig" data-max="4" data-sjg="${f.stig}">${[0, 1, 2, 3].map((j) => `<i${j < stig ? ' class="on"' : ''}></i>`).join('')}</span>${E('span', `${P}.ef.${f.k}.v`, f.v)}</div>
${E('p', `${P}.ef.${f.k}.n`, f.n)}</div></div>`;
    }).join('');
    const ekkiKort = Pr.ekki.map((f) => `<div class="vv-ekki">${M(`${P}.ekki.${f.k}.mynd`, { src: f.mynd, alt: f.t, fit: 'cover', bak: '#ffffff' }, { fast: 1 })}<div class="vv-ekki-i"><span class="vv-ef-tafla">${ico(f.ico)}</span><h3>${E('small', `${P}.ekki.${f.k}.fl`, f.fl)}${E('span', `${P}.ekki.${f.k}.t`, f.t)}</h3>${E('p', `${P}.ekki.${f.k}.x`, f.x)}</div></div>`).join('');
    const eldflokkar = B(`${P}.eldflokkar`, `${yfirHaus(`${P}.eldflokkar`, Pr.ef.yfir || 'Á hvað virkar tækið best?', Pr.ef.inng)}<div class="vv-ef-rod" style="grid-template-columns:repeat(${Pr.ef.listi.length},minmax(0,1fr))">${efKort}</div>${B(`${P}.ekki`, `<div class="vv-ekki-titill">${E('b', `${P}.ekki.titill`, Pr.ekkiTitill || 'Ekki ætlað fyrir')}${E('span', `${P}.ekki.undir`, Pr.ekkiUndir || 'Hér hentar annað betur.')}</div>${ekkiKort}`, 'vv-ekki-rod', 'div')}`, 'vv-kafli');

    const notkun = B(`${P}.notkun`, `${yfirHaus(`${P}.notkun`, Pr.notkun.yfir || 'Hvar kemur tækið að gagni?', Pr.notkun.inng)}<div class="vv-not-rod">${Pr.notkun.listi.map((n) => `<div class="vv-not">${M('vara.not.mynd', { src: n.mynd, alt: n.t, fit: 'cover', h: 200 }, { srcKey: `${P}.not.${n.k}.mynd` })}<div class="vv-not-b">${E('span', `${P}.not.${n.k}.merki`, n.merki, 'vv-flokkmerki')}${E('h3', `${P}.not.${n.k}.t`, n.t)}${E('p', `${P}.not.${n.k}.x`, n.x)}</div></div>`).join('')}</div>${B('bordi', `${ico('skjoldur', 'vv-skjoldur')}${Pr.bordi ? E('p', 'bordi.' + Pr.bordi.k, Pr.bordi.x) : E('p', 'bordi.texti', 'Rétt slökkvitæki getur bjargað lífi, eignum og dregið úr skemmdum.')}<div class="vv-bordi-merki">${E('b', 'bordi.merki', 'Slökkvitæki ehf')}${E('small', 'bordi.undir', 'Slökkvitæki · Þjónusta · Varahlutir')}</div>`, 'vv-bordi', 'div')}`, 'vv-kafli');

    const um = B(`${P}.um`, `<div class="vv-blad" style="padding:40px;gap:18px">${E('h2', `${P}.um.yfir`, Pr.um.yfir, 'vv-yfir')}
${(S.um || Pr.um.p).map((t, i) => E('p', `${P}.um.${i + 1}`, t, 'vv-txt')).join('\n')}
<div class="vv-gott">${ico('vidvorun')}${E('p', `${P}.um.gott`, Pr.um.gott)}</div></div>
<div class="vv-blad" style="padding:36px;gap:16px">${E('h3', `${P}.maelir.yfir`, Pr.maelir.yfir, 'vv-h3')}${M(`${P}.maelir.mynd`, { src: Pr.maelir.mynd, alt: Pr.maelir.alt, fit: 'cover', h: 200 })}
<ul class="vv-hak">${Pr.maelir.listi.map((d, i) => `<li>${ico('hak')}${E('span', `${P}.maelir.${i + 1}`, d)}</li>`).join('')}</ul>
${E('p', `${P}.maelir.rautt`, Pr.maelir.rautt, 'vv-heimild')}</div>`, 'vv-tveir');

    const skref = B(`${P}.skref`, `<div class="vv-blad navy" style="padding:44px 44px 40px;gap:28px"><div class="vv-titilrod">${E('h2', `${P}.skref.yfir`, Pr.skref.yfir || 'Svona notarðu tækið', 'vv-yfir')}${E('span', `${P}.skref.undir`, Pr.skref.undir)}</div>
<div class="vv-skref-rod">${Pr.skref.listi.map(([t, x, mynd], i) => `<div class="vv-skref">${M('vara.skref.mynd', { src: mynd, alt: t, fit: 'cover', h: 150 }, { srcKey: `${P}.skref.${i + 1}.mynd` })}<div class="vv-skref-haus"><span class="vv-nr">${i + 1}</span>${E('h3', `${P}.skref.${i + 1}.t`, t)}</div>${E('p', `${P}.skref.${i + 1}.x`, x)}</div>`).join('')}</div>
<div class="vv-112"><b>112</b>${E('span', `${P}.skref.112`, Pr.skref.s112 || 'Ef eldurinn er stærri en þú ræður við: forðaðu þér, lokaðu á eftir þér og hringdu í 112.')}</div></div>`, '', 'div');

    const stadur = B(`${P}.stadur`, `<div class="vv-blad" style="padding:28px">${M(`${P}.veggur.mynd`, { src: Pr.stadur.mynd, alt: Pr.stadur.alt || 'Slökkvitæki á vegg undir F001-skilti', fit: 'cover', h: 460, pos: Pr.stadur.alt ? 'center' : 'right' })}</div>
<div class="vv-blad" style="padding:40px;gap:20px">${E('h2', `${P}.stadur.yfir`, Pr.stadur.yfir || 'Hvar á tækið að vera?', 'vv-yfir')}<div>${Pr.stadur.reglur.map(([b, s], i) => `<div class="vv-regla"><span class="n">${i + 1}</span><div>${E('b', `${P}.regla.${i + 1}.t`, b)}${E('span', `${P}.regla.${i + 1}.x`, s)}</div></div>`).join('')}</div>
${E('p', `${P}.stadur.heimild`, Pr.stadur.heimild || HEIMILD, 'vv-heimild')}</div>`, 'vv-tveir jafnt');

    let reikn;
    if (Pr.reikn && Pr.reikn.skynjarar) {
      const fl = [60, 100, 150, 250], m2 = fl.includes(VV.vara.m2) ? VV.vara.m2 : 100;
      const fj = Math.max(1, Math.ceil(m2 / Pr.reikn.skynjarar));
      reikn = B(`${P}.reikn`, `<div class="vv-blad vv-reikn" style="padding:40px"><div style="display:flex;flex-direction:column;gap:14px">${E('h2', `${P}.reikn.yfir`, 'Hversu marga skynjara þarf?', 'vv-yfir')}${E('p', `${P}.reikn.inng`, 'Veldu stærð hæðarinnar. Reglan er minnst einn skynjari á hverja 80 m² og minnst einn á hverri hæð.', 'vv-yfir-inng')}
<div class="vv-flokkar" role="group" aria-label="Gólfflötur hæðar">${fl.map((m) => `<button type="button" class="vv-stk" data-act="m2" data-v="${m}" aria-pressed="${m2 === m}">${tala(m)} m²</button>`).join('')}</div>
${E('p', `${P}.reikn.fyrirvari`, 'Auk þess þarf hljóðið að ná 75 dB inni í hverju svefnherbergi. Oftast þýðir það skynjara í hvert svefnherbergi, eða samtengda skynjara.', 'vv-heimild')}</div>
<div class="vv-reikn-svar"><span style="font-size:14px;font-weight:500;color:var(--c-muted)">${esc(texti(`${P}.reikn.haed`, 'Hæð upp á'))} ${tala(m2)} m²</span><b>${fj} ${esc(fj === 1 ? texti('reikn.skynjari', 'skynjari') : texti('reikn.skynjarar', 'skynjarar'))}</b>
<span style="font-size:15px">${E('span', `${P}.reikn.lysing`, 'á hverri hæð, minnst')}</span>
<button type="button" class="vv-btn navy" data-act="setja-fjolda" data-n="${fj}" style="align-self:flex-start;margin-top:8px">${ico('karfa')}${KASSI ? KASSI_TAKKI : E('span', 'reikn.takki', 'Setja í körfu')} · ${fj}</button></div></div>`, '', 'div');
    } else if (Pr.reikn) {
      const geta = Math.round(Math.min(200, Math.max(1, nGildi(`${P}.reikn.geta`, S.A || Pr.reikn.geta))));
      const krafa = Math.max(26, Math.round(0.065 * VV.vara.m2));
      const taeki = Math.max(2, Math.ceil(krafa / geta));
      reikn = B(`${P}.reikn`, `<div class="vv-blad vv-reikn" style="padding:40px"><div style="display:flex;flex-direction:column;gap:14px">${E('h2', `${P}.reikn.yfir`, 'Hversu mörg tæki þarf?', 'vv-yfir')}${E('p', `${P}.reikn.inng`, 'Veldu stærð hæðarinnar. Samanlögð slökkvigeta á hæð þarf að vera minnst 0,065 A á hvern fermetra og aldrei undir 26A.', 'vv-yfir-inng')}
<div class="vv-flokkar" role="group" aria-label="Gólfflötur hæðar">${[200, 500, 1000, 2000].map((m) => `<button type="button" class="vv-stk" data-act="m2" data-v="${m}" aria-pressed="${VV.vara.m2 === m}">${tala(m)} m²</button>`).join('')}</div>
${E('p', `${P}.reikn.fyrirvari`, 'Leiðbeinandi útreikningur fyrir eina hæð í atvinnuhúsnæði. Í stórum eða skiptum rýmum ræður 25 metra reglan oft fjöldanum. Við komum og metum þörfina.', 'vv-heimild')}</div>
<div class="vv-reikn-svar"><span style="font-size:14px;font-weight:500;color:var(--c-muted)">${esc(texti(`${P}.reikn.haed`, 'Hæð upp á'))} ${tala(VV.vara.m2)} m²</span><b>${taeki} ${esc(texti('reikn.taeki', 'tæki'))}</b>
<span style="font-size:15px">${E('span', `${P}.reikn.lysing`, 'Hvert tæki gefur')} <b style="font:inherit;font-weight:600;color:inherit" data-n="${P}.reikn.geta" data-max="200" data-min="1" data-sjg="${S.A || Pr.reikn.geta}">${geta}A</b> · þarf minnst <b style="font:inherit;font-weight:600;color:inherit">${krafa}A</b></span>
<button type="button" class="vv-btn navy" data-act="setja-fjolda" data-n="${taeki}" style="align-self:flex-start;margin-top:8px">${ico('karfa')}${KASSI ? KASSI_TAKKI : E('span', 'reikn.takki', 'Setja í körfu')} · ${taeki}</button></div></div>`, '', 'div');
    } else {
      const rt = Pr.reiknTexti || { yfir: 'Kolsýrutæki og slökkvigeta hæðar', x: 'Kolsýrutæki fá ekkert A-gildi, svo þau teljast ekki með í slökkvigetu hæðarinnar. Hafðu duft- eða léttvatnstæki fyrir hæðina, og kolsýrutæki við rafbúnaðinn.', takki: ['Skoða dufttækið', 1] };
      reikn = B(`${P}.reikn`, `<div class="vv-blad" style="padding:36px 40px;gap:10px">${E('h2', `${P}.reikn.yfir`, rt.yfir, 'vv-yfir')}${E('p', `${P}.reikn.inng`, rt.x, 'vv-yfir-inng')}<a class="vv-btn navy sm" href="#vara-${rt.takki[1]}" style="align-self:flex-start;margin-top:6px">${E('span', `${P}.reikn.takki`, rt.takki[0])}</a></div>`, '', 'div');
    }

    const taekni = B(`${P}.taekni`, `<div class="vv-blad" style="padding:40px;gap:18px">${E('h2', `${P}.taekni.yfir`, 'Tæknilýsing', 'vv-yfir')}<table class="vv-tafla"><tbody>${S.taekni.map(([a, b], i) => `<tr>${E('th', `${P}.taekni.${i + 1}.a`, a)}${E('td', `${P}.taekni.${i + 1}.b`, b)}</tr>`).join('')}</tbody></table>
<div class="vv-flokkar"><a class="vv-btn ghost sm" href="#">${ico('skjal')}${E('span', `${P}.taekni.skjal1`, 'Gagnablað · PDF')}</a><a class="vv-btn ghost sm" href="#">${ico('skjal')}${E('span', `${P}.taekni.skjal2`, 'Notkunarleiðbeiningar · PDF')}</a></div></div>
<div style="display:flex;flex-direction:column;gap:18px">${S.thjon && S.thjon.length ? `<div class="vv-blad" style="padding:36px">${E('h3', `${P}.thjon.yfir`, 'Þjónusta við tækið', 'vv-h3')}${E('p', `${P}.thjon.x`, Pr === PROFILAR.co2 ? 'Samkvæmt reglugerð á þjónustuaðili að yfirfara slökkvitæki árlega. Kolsýrutæki vigtum við og hlöðum, og merkjum með dagsetningu.' : 'Samkvæmt reglugerð á þjónustuaðili að yfirfara slökkvitæki árlega. Við skoðum, hleðjum og merkjum tækið með dagsetningu.', 'vv-dauft')}
${S.thjon.map(([a, b], i) => `<div class="vv-verdlina">${E('span', `${P}.thjon.${i + 1}.a`, a)}${E('b', `${P}.thjon.${i + 1}.b`, b)}</div>`).join('')}
<a class="vv-btn navy sm" href="${OPINBER}"${UT} style="align-self:flex-start;margin-top:8px">${E('span', `${P}.thjon.takki`, 'Bóka skoðun')}</a></div>` : ''}
${hentarSpjald(P, Pr)}</div>`, 'vv-tveir taekni', 'div');

    const spurn = B(`${P}.spurn`, `${yfirHaus(`${P}.spurn`, 'Algengar spurningar', null)}<div class="vv-spurn-rod">${Pr.spurn(S).map(([q, a], i) => `<div class="vv-spurn">${E('h3', `${P}.spurn.${i + 1}.q`, q)}${E('p', `${P}.spurn.${i + 1}.a`, a)}</div>`).join('')}</div>`, 'vv-kafli');

    return tolur + eldflokkar + notkun + um + skref + stadur + reikn + taekni + spurn;
  }

  function sidaVara(id) {
    const v = vara(id);
    if (!v) return `<main class="vv-wrap vv-adal"><div class="vv-tomt">${E('span', 'vara.ekki-til', 'Þessi vara er ekki í versluninni.')}<br><br><a class="vv-btn navy" href="#verslun">${E('span', 'vara.til-baka', 'Aftur í verslunina')}</a></div></main>`;
    const P = `vara.${id}`, uppselt = uppseltV(v);
    const snid = profill(id) ? sniðVoru(v) : null;
    const Pr = snid ? PROFILAR[snid] : null, S = Pr ? serGildi(v) : null;
    const fyrstaMalsgrein = String(v.lysing || '').split(/\n\s*\n/)[0].trim();
    const s = VV.vara;
    const haegri = `<span class="vv-yfirflokkur">${esc(flokkHeiti(v.flokkur))}</span>${E('h1', `${P}.nafn`, v.nafn)}
${E('p', `${P}.inngangur`, Pr ? S.inngangur || Pr.inngangur : fyrstaMalsgrein, 'vv-inng')}
${Pr ? `<div class="vv-pillur">${(S.pillur || Pr.pillur).map((d, i) => E('span', `${P}.pilla.${i + 1}`, d, 'vv-pilla')).join('')}</div>
<ul class="vv-hak">${S.atridi.map((d, i) => `<li>${ico('hak')}${E('span', `${P}.atridi.${i + 1}`, d)}</li>`).join('')}</ul>` : ''}
<div class="vv-stort-verd"><b>${kr(v.verd)}</b><small>${tala(v.an)} án vsk</small></div>
<span class="vv-lager">${ico('hringhak')}${uppselt ? E('span', 'lager.uppselt', 'Uppselt í bili. Pantaðu og við látum vita þegar það kemur.') : othekktLager(v) ? E('span', 'lager.stadfest', 'Fáanlegt. Við staðfestum afhendingartíma með pöntuninni.') : E('span', 'lager.til', 'Á lager, tilbúið til afhendingar')}</span>
<fieldset class="vv-afh"><legend>${E('span', 'afh.titill', 'Afhending')}</legend>
<button type="button" class="vv-val" data-act="afh" data-v="saekja" aria-pressed="${s.afhending === 'saekja'}"><span class="punktur"></span><span style="flex:1">${E('b', 'afh.saekja.t', 'Sækja hjá okkur')}${E('small', 'afh.saekja.x', 'Helluhrauni 10, Hafnarfirði · virka daga 8 til 16')}</span>${E('b', 'afh.saekja.verd', '0 kr')}</button>
<button type="button" class="vv-val" data-act="afh" data-v="senda" aria-pressed="${s.afhending === 'senda'}"><span class="punktur"></span><span style="flex:1">${E('b', 'afh.senda.t', 'Fá sent heim')}${E('small', 'afh.senda.x', 'Póstsending um land allt')}</span>${E('b', 'afh.senda.verd', 'Bætist við')}</button></fieldset>
<div class="vv-kaupa"><div class="vv-fj" role="group" aria-label="Fjöldi"><button type="button" class="vv-stp" data-act="faerri" aria-label="Fækka">${ico('minus')}</button><span>${s.fjoldi}</span><button type="button" class="vv-stp" data-act="fleiri" aria-label="Fjölga">${ico('plus')}</button></div>
<button type="button" class="vv-btn navy" data-act="setja" data-id="${v.id}">${ico('karfa')}${KASSI ? KASSI_TAKKI : E('span', 'vara.takki', 'Setja í körfu')} · ${kr(v.verd * s.fjoldi)}</button></div>
${s.tilk ? `<div class="vv-tilk" role="status"><span>${esc(s.tilk)}</span><a class="vv-btn ljos sm" href="#karfa">${E('span', 'vara.skoda-korfu', 'Skoða körfu')}</a></div>` : ''}
<a class="vv-btn ghost vv-tilbod" href="${OPINBER}"${UT} style="align-self:flex-start">${E('span', 'vara.tilbod', 'Fleiri en 10 stykki? Fá tilboð')}</a>`;

    // Ein málsgrein = sami texti og inngangurinn efst; kassinn birtist þá aðeins hafi ritillinn gefið honum eigin texta
    const lysingTvitekin = !!fyrstaMalsgrein && !/\n\s*\n/.test(String(v.lysing || '').trim()) && !(VV.efni.t && VV.efni.t[`${P}.lysing`]);
    const venjulegt = Pr || lysingTvitekin ? '' : B(`${P}.um`, `<div class="vv-blad" style="padding:40px;gap:16px">${E('h2', 'vara.um.yfir', 'Um vöruna', 'vv-yfir')}${E('p', `${P}.lysing`, String(v.lysing || '').trim() || 'Lýsing kemur fljótlega.', 'vv-txt')}</div>`, '', 'div');
    const oft = B('vara.oft', `${yfirHaus('vara.oft', 'Oft keypt með', null)}<div class="vv-grind">${tengdar(v).map(kort).join('')}</div>`, 'vv-kafli');

    return `<main class="vv-wrap vv-adal" style="padding-top:28px">
<nav class="vv-mola" aria-label="Brauðmolar"><a href="#verslun">${E('span', 'mola.verslun', 'Vefverslun')}</a><span aria-hidden="true">/</span><a href="#verslun" data-act="flokkur" data-v="${flokkSlod(v.flokkur)}">${esc(flokkHeiti(v.flokkur))}</a><span aria-hidden="true">/</span><span style="color:var(--c-ink)">${esc(varaNafn(v))}</span></nav>
<div class="vv-vara-haus"><div class="vv-vara-v">${galleri(v, P, Pr)}</div><div class="vv-vara-h">${haegri}</div></div>
<div class="vv-kaflar">${Pr ? kaflarRikir(v, P, Pr, S) : venjulegt}${oft}</div></main>`;
  }

  // ── Karfa ──────────────────────────────────────────────────────────────
  function sidaKarfa() {
    const linur = iKorfu().map(([id, n]) => ({ v: vara(Number(id)), n }));
    const vorur = linur.reduce((s, l) => s + l.v.verd * l.n, 0);
    const fj = linur.reduce((s, l) => s + l.n, 0);
    if (!linur.length) {
      return `<main class="vv-wrap vv-adal">${E('h1', 'karfa.titill', 'Karfan þín', 'vv-yfir')}<div class="vv-tomt">${E('p', 'karfa.tom', 'Karfan er tóm.')}<br><a class="vv-btn navy" href="#verslun">${ico('vinstri')}${E('span', 'karfa.halda', 'Halda áfram að versla')}</a></div></main>`;
    }
    const vsk = vorur - vorur / 1.24;
    return `<main class="vv-wrap vv-adal">
<div class="vv-titilrod"><div>${E('h1', 'karfa.titill', 'Karfan þín', 'vv-yfir')}<span class="vv-undir">${fj} ${esc(fj % 10 === 1 && fj % 100 !== 11 ? 'vara · verð með vsk' : texti('karfa.vorur-ord', 'vörur · öll verð með vsk'))}</span></div><a class="vv-btn ghost sm" href="#verslun">${ico('vinstri')}${E('span', 'karfa.halda', 'Halda áfram að versla')}</a></div>
<div class="vv-karfa"><div class="vv-karfa-l">
<div class="vv-blad" style="padding:8px 24px">${linur.map(({ v, n }) => `<div class="vv-lina"><a class="vv-lina-m" href="#vara-${v.id}"><img src="${esc(varaMynd(v))}" alt="" loading="lazy"></a>
<div><h3><a href="#vara-${v.id}">${esc(varaNafn(v))}</a></h3><small>${kr(v.verd)} stk.</small><button type="button" class="fjar" data-act="k-fjarlaegja" data-id="${v.id}">${esc(texti('karfa.fjarlaegja', 'Fjarlægja'))}</button></div>
<div class="vv-fj"><button type="button" class="vv-stp litill" data-act="k-faerri" data-id="${v.id}" aria-label="Fækka">${ico('minus')}</button><span>${n}</span><button type="button" class="vv-stp litill" data-act="k-fleiri" data-id="${v.id}" aria-label="Fjölga">${ico('plus')}</button></div>
<div class="samt">${kr(v.verd * n)}</div></div>`).join('')}</div>
<div class="vv-blad">${E('h2', 'karfa.afh', 'Afhending', 'vv-h3')}
<button type="button" class="vv-val" data-act="k-afh" data-v="saekja" aria-pressed="${VV.karfaAfh === 'saekja'}"><span class="punktur"></span><span style="flex:1">${E('b', 'afh.saekja.t', 'Sækja hjá okkur')}${E('small', 'afh.saekja.x', 'Helluhrauni 10, Hafnarfirði · virka daga 8 til 16')}</span>${E('b', 'afh.saekja.verd', '0 kr')}</button>
<button type="button" class="vv-val" data-act="k-afh" data-v="senda" aria-pressed="${VV.karfaAfh === 'senda'}"><span class="punktur"></span><span style="flex:1">${E('b', 'afh.senda.t', 'Fá sent heim')}${E('small', 'afh.senda.x', 'Póstsending um land allt')}</span>${E('b', 'afh.senda.verd', 'Bætist við')}</button></div>
<div class="vv-blad">${E('h2', 'karfa.upplysingar', 'Upplýsingar', 'vv-h3')}<div class="vv-reitir">
<label>${esc(texti('karfa.nafn', 'Nafn'))}<input autocomplete="name" placeholder="Jón Jónsson"></label><label>${esc(texti('karfa.kt', 'Kennitala (fyrir reikning)'))}<input inputmode="numeric" placeholder="000000-0000"></label>
<label>${esc(texti('karfa.netfang', 'Netfang'))}<input type="email" autocomplete="email" placeholder="jon@daemi.is"></label><label>${esc(texti('karfa.simi', 'Sími'))}<input type="tel" autocomplete="tel" placeholder="000 0000"></label></div></div>
</div>
<aside class="vv-samantekt">${E('h2', 'karfa.samantekt', 'Samantekt')}
<div class="rod"><span>${esc(texti('karfa.vorur', 'Vörur'))}</span><b>${kr(vorur)}</b></div>
<div class="rod"><span>${esc(texti('karfa.afhending', 'Afhending'))}</span><b>${VV.karfaAfh === 'senda' ? esc(texti('afh.senda.verd', 'Bætist við')) : '0 kr'}</b></div>
<div class="rod"><span>${esc(texti('karfa.vsk', 'Þar af vsk (24%)'))}</span><b>${kr(vsk)}</b></div>
<div class="alls"><span>${esc(texti('karfa.samtals', 'Samtals'))}</span><b>${kr(vorur)}</b></div>
<button type="button" class="vv-btn breidur" data-act="greida">${E('span', 'karfa.greida', 'Halda áfram í greiðslu')}${ico('haegri')}</button>
${E('p', 'karfa.greidsluleidir', 'Greiðsluleiðir: kort, millifærsla eða reikningur á kennitölu fyrirtækis. Sendingarkostnaður bætist við og er staðfestur með pöntuninni.', 'smatt')}</aside></div></main>`;
  }

  // ── Teiknun og leiðir ──────────────────────────────────────────────────
  function leid() {
    if (window.BHV2 && !window.BHV2.iVerslun() && VV.sida) return VV.sida;
    const h = location.hash.replace(/^#/, '');
    const [a, b] = h.split('-');
    if (a === 'vara' && b) return { s: 'vara', id: Number(b) };
    if (a === 'karfa') return { s: 'karfa' };
    return { s: 'forsida' };
  }
  VV.leid = leid;

  function render(efst) {
    VV.sjg = {}; VV.sjgM = {};
    const r = leid();
    VV.sida = r;
    const app = document.getElementById('vv-app');
    const y = window.scrollY;
    const midja = r.s === 'vara' ? sidaVara(r.id) : r.s === 'karfa' ? sidaKarfa() : sidaForsida();
    app.innerHTML = haus() + midja + fotur();
    if (efst) window.scrollTo(0, 0); else window.scrollTo(0, y);
    const fl = app.querySelector('.vv-flipar .vv-wrap'), virkur = fl && fl.querySelector('[aria-current]');
    if (virkur && fl.scrollWidth > fl.clientWidth) fl.scrollLeft = Math.max(0, virkur.getBoundingClientRect().left - fl.getBoundingClientRect().left + fl.scrollLeft - 16);
    const v = r.s === 'vara' && vara(r.id);
    VV.titill = (v ? varaNafn(v) + ' · ' : r.s === 'karfa' ? 'Karfa · ' : '') + 'Vefverslun Brunahólfs';
    if (VV.eftirTeikningu) VV.eftirTeikningu();
  }
  VV.render = render;

  function beitaThema() {
    const th = VV.efni.thema || {};
    const l = Object.assign({}, THEMA0.litir, th.litir || {});
    const st = document.documentElement.style;
    for (const [k, v] of Object.entries(l)) if (okLitur(v) && v !== 'transparent') st.setProperty('--c-' + k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), v);
    const lt = Object.assign({}, THEMA0.letur, th.letur || {});
    const fh = LETUR.includes(lt.fyrirsagnir) ? lt.fyrirsagnir : 'Poppins', fb = LETUR.includes(lt.texti) ? lt.texti : 'Poppins';
    hladaLetri(fh); hladaLetri(fb);
    st.setProperty('--f-head', `'${fh}',system-ui,sans-serif`);
    st.setProperty('--f-body', `'${fb}',system-ui,sans-serif`);
    st.setProperty('--base', Math.min(22, Math.max(13, num(th.grunnstaerd, 16))) + 'px');
    st.setProperty('--r', Math.min(40, Math.max(0, num(th.runun, 16))) + 'px');
    st.setProperty('--r-btn', th.takkar === 'runad' ? '12px' : th.takkar === 'ferkantad' ? '3px' : '999px');
  }
  VV.beitaThema = beitaThema;

  function toast(msg) {
    let t = document.querySelector('.vv-toast');
    if (!t) { t = document.createElement('div'); t.className = 'vv-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.remove(), 3200);
  }
  VV.toast = toast;

  // ── Atburðir ───────────────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (!a || !document.getElementById('vv-app').contains(a)) return;
    const act = a.dataset.act, id = Number(a.dataset.id);
    const s = VV.vara;
    if (act === 'leit') return;
    if (act === 'flokkur') {
      e.preventDefault();
      VV.sia.flokkur = a.dataset.v || '';
      if (leid().s !== 'forsida') { location.hash = '#verslun'; return; }
      render(false);
    } else if (act === 'i-korfu') {
      baetaVid(id, 1);
      const v = vara(id);
      toast((v ? varaNafn(v) : 'Vara') + ' ' + texti('kort.sett', 'sett í körfu'));
      const f = document.getElementById('vv-fjoldi'); if (f) f.textContent = fjoldiKorfu();
    } else if (act === 'mynd') { s.mynd = Number(a.dataset.i) || 0; render(false); }
    else if (act === 'faerri') { s.fjoldi = Math.max(1, s.fjoldi - 1); render(false); }
    else if (act === 'fleiri') { s.fjoldi = Math.min(99, s.fjoldi + 1); render(false); }
    else if (act === 'afh') { s.afhending = a.dataset.v; render(false); }
    else if (act === 'k-afh') { VV.karfaAfh = a.dataset.v; render(false); }
    else if (act === 'setja') {
      if (KASSI) { sendaKassa({ vvKassi: 'setja', id, n: s.fjoldi }); return; }
      baetaVid(id, s.fjoldi);
      const v = vara(id);
      s.tilk = `${s.fjoldi} × ${v ? varaNafn(v) : ''} ${texti('kort.sett', 'sett í körfu')}`;
      render(false);
    } else if (act === 'm2') { s.m2 = Number(a.dataset.v) || 500; render(false); }
    else if (act === 'setja-fjolda') {
      const r = leid();
      const n = Number(a.dataset.n) || 1;
      if (KASSI && r.s === 'vara') { sendaKassa({ vvKassi: 'setja', id: r.id, n }); return; }
      if (r.s === 'vara') { baetaVid(r.id, n); s.tilk = `${n} × ${varaNafn(vara(r.id))} ${texti('kort.sett', 'sett í körfu')}`; render(false); }
    } else if (act === 'k-faerri' || act === 'k-fleiri' || act === 'k-fjarlaegja') {
      const n = VV.karfa[id] || 0;
      if (act === 'k-fjarlaegja' || (act === 'k-faerri' && n <= 1)) delete VV.karfa[id];
      else VV.karfa[id] = act === 'k-fleiri' ? Math.min(999, n + 1) : n - 1;
      vistaKorfu();
      render(false);
    } else if (act === 'greida') {
      toast(texti('karfa.prufa-skilabod', VV.stada === 'virk' ? 'Greiðsla er ekki tengd ennþá. Hafðu samband og við göngum frá pöntuninni.' : 'Prufuhamur: greiðsla er ekki tengd ennþá. Engin pöntun var send.'));
    }
  });
  document.addEventListener('change', (e) => {
    const a = e.target.closest('[data-act="rada"]');
    if (!a) return;
    VV.sia.rada = a.value;
    render(false);
  });
  document.addEventListener('input', (e) => {
    const a = e.target.closest('[data-act="leit"]');
    if (!a) return;
    VV.sia.leit = a.value;
    if (leid().s !== 'forsida') { location.hash = '#verslun'; return; }
    const g = document.getElementById('vv-grind');
    if (g) g.outerHTML = grind();
    const tl = document.getElementById('vv-taln'); if (tl) tl.textContent = talnTexti();
    if (VV.eftirTeikningu) VV.eftirTeikningu();
  });
  window.addEventListener('hashchange', () => {
    if (window.BHV2 && !window.BHV2.iVerslun()) return;
    VV.vara.mynd = 0; VV.vara.fjoldi = 1; VV.vara.tilk = ''; render(true);
    if (KASSI) { const r = leid(); sendaKassa({ vvKassi: 'vara', id: r.s === 'vara' ? r.id : null }); }   // Sala uppfærir haus og birgðir
  });
  if (KASSI) document.addEventListener('keydown', (e) => { if (e.key === 'Escape') sendaKassa({ vvKassi: 'loka' }); });
  window.addEventListener('storage', (e) => { if (e.key === KARFA_LYKILL) { VV.karfa = lesaKorfu(); render(false); } });

  // ── Hleðsla ────────────────────────────────────────────────────────────
  // Heiti sem viðskiptavinur skilur. Innra heitið (kassinn, reikningar) stendur óbreytt í vorur.nafn
  const NOFN = {
    18: 'Léttvatn 6 L. AB Slökkvitæki',
    174: 'Léttvatn 2 L. AB Slökkvitæki',
    3: 'Reykskynjari með 10 ára rafhlöðu',
    13: 'Reykskynjari 9V, Numens SND-500',
    14: 'Reykskynjari, þráðlaust samtengjanlegur',
    342: 'CO-skynjari (kolsýringur), Kidde, 10 ára rafhlaða',
    4: 'Eldvarnateppi 1 × 1 m í hylki',
    340: 'Eldvarnateppi 1 × 1 m í hvítri tösku',
    339: 'Sjúkrataska, lítil, rauð',
    338: 'Sjúkrakassi með veggfestingu',
    341: 'Skipafesting fyrir 5, 6 og 12 kg tæki, svört',
    113: 'Skipafesting fyrir 6 kg slökkvitæki',
    86: 'Skilti: Neyðarútgangur, 120 × 340 mm',
    101: 'L-skilti: Slökkvitæki, sjálflýsandi 150 × 150 mm',
    373: 'L-skilti: Brunaslanga, sjálflýsandi 150 × 150 mm',
    140: 'Flatt skilti: Slökkvitæki, sjálflýsandi 150 × 150 mm',
    141: 'Flatt skilti: Brunaslanga, sjálflýsandi 150 × 150 mm',
    104: 'Skilti: Flóttaleið, hart og sjálflýsandi 150 × 300 mm',
    102: 'V-skilti: Brunaslanga, sjálflýsandi',
    437: 'Kolsýruhylki 5 L (KOLDIX)',
  };
  // Lýsingar á vörum sem eiga enga (eða aðeins innri athugasemd) í vorur
  const LYSINGAR = {
    341: 'Sterk festing sem heldur slökkvitækinu föstu þar sem hreyfing er á: í bátum, bílum og vinnuvélum. Tækið er spennt fast með ól og sylgju sem er fljótlegt að losa þegar á þarf að halda. Passar fyrir 5, 6 og 12 kg tæki.',
    113: 'Festing sem heldur 6 kg slökkvitæki föstu í bátum, bílum og vinnuvélum. Tækið er spennt fast með ólum svo það losnar ekki í veltingi eða á ójöfnum vegi.',
    86: 'Skilti sem merkir neyðarútgang, með texta á íslensku og ensku (FIRE EXIT). Stærð 120 × 340 mm.',
    101: 'Sjálflýsandi skilti sem merkir hvar slökkvitæki er. L-skiltið stendur hornrétt út frá veggnum, svo það sést eftir ganginum úr báðum áttum. Sjálflýsandi flöturinn safnar birtu og lýsir í myrkri ef rafmagnið fer. Stærð 150 × 150 mm.',
    373: 'Sjálflýsandi skilti sem merkir hvar brunaslanga er. L-skiltið stendur hornrétt út frá veggnum, svo það sést eftir ganginum úr báðum áttum. Sjálflýsandi flöturinn safnar birtu og lýsir í myrkri ef rafmagnið fer. Stærð 150 × 150 mm.',
    140: 'Sjálflýsandi skilti sem merkir hvar slökkvitæki er. Flatt skilti sem fer beint á vegginn fyrir ofan tækið. Lýsir í myrkri ef rafmagnið fer. Stærð 150 × 150 mm.',
    141: 'Sjálflýsandi skilti sem merkir hvar brunaslanga er. Flatt skilti sem fer beint á vegginn fyrir ofan slöngukeflið. Lýsir í myrkri ef rafmagnið fer. Stærð 150 × 150 mm.',
    104: 'Grænt flóttaleiðarskilti með hlaupandi manni og ör sem vísar í átt að útgangi. Hart og sjálflýsandi, lýsir í myrkri ef rafmagnið fer. Stærð 150 × 300 mm.',
    102: 'Sjálflýsandi skilti sem merkir hvar brunaslanga er. V-laga skiltið fer á horn eða stendur út frá vegg og sést úr tveimur áttum.',
    365: 'Neyðarhamar til að hafa í bílnum. Oddurinn brýtur hliðarrúðu og blaðið í handfanginu sker á öryggisbelti, ef ekki er hægt að komast út eftir slys.',
    342: 'Kolsýringsskynjari (CO) frá Kidde með innsiglaðri rafhlöðu sem endist í 10 ár. Kolsýringur er lyktarlaust og ósýnilegt gas sem myndast við ófullkominn bruna, til dæmis frá kamínu, gasofni eða bíl í bílskúr.',
  };
  const STOK_LYSING = 40;   // styttri lýsing en þetta (t.d. „Stærð 150x340" eftir hreinsun) víkur fyrir LYSINGAR
  function lagaVorur(vorur) {
    for (const v of vorur) {
      if (NOFN[v.id]) { v.innraNafn = v.nafn; v.nafn = NOFN[v.id]; }
      if (LYSINGAR[v.id] && String(v.lysing || '').trim().length < STOK_LYSING) v.lysing = LYSINGAR[v.id];
    }
    return vorur;
  }
  async function saekja(drog) {
    const r = { ok: true, status: 200, json: async () => window.BH_VV_GOGN };
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Villa ' + r.status);
    VV.stada = d.stada; VV.efni = d.efni || {}; VV.vorur = lagaVorur(d.vorur || []);
    VV.drog_uppfaert = d.drog_uppfaert; VV.utgafa = d.utgafa || 0; VV.virkjad = d.virkjad || null;
    return d;
  }
  VV.saekja = saekja;

  (async () => {
    const q = new URLSearchParams(location.search);
    const breyta = q.has('breyta') || q.has('ritill');   // ?ritill=1 hleður ritlinum en kveikir EKKI á breytingahamnum (ritill.js: aðeins ?breyta kveikir) — hliðarstikan (23.10.2026)
    try { await saekja(breyta); } catch (e) {
      document.getElementById('vv-app').innerHTML = `<div class="vv-hledur">Ekki tókst að sækja verslunina (${esc(e.message)}). <a href="">Reyna aftur</a></div>`;
      return;
    }
    VV.breytaLeyft = false;
    if (VV.breytaLeyft) document.body.classList.add('vvr-bidur');
    if (KASSI) document.body.classList.add('vv-kassi');
    if (SKODA) document.body.classList.add('vv-skoda');
    beitaThema();
    render(false);
    if (KASSI) sendaKassa({ vvKassi: 'tilbuin' });
    if (VV.breytaLeyft) {
      const s = document.createElement('script');
      s.src = 'ritill.js?v=' + (document.querySelector('meta[name="vv-utgafa"]') || {}).content;
      document.body.appendChild(s);
    }
  })();
})();
