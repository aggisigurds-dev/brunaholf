/* theme.js — ÞEMAÐ ER FRYST Á LJÓSA BOSS-ÚTLITINU (10.09.2026).
 *
 * Agnar: „reyna sleppa öllum dark white view… láttu bara tölvu-desktop litina
 *         ráða öllu og með fasta liti svo Google Chrome reyni ekki að breyta
 *         þeim í Android."
 *
 * HVAÐ VAR AÐ. Þessi skrá var sjálfgefið á 'auto', sem las
 * matchMedia('(prefers-color-scheme: dark)') og setti <html data-theme="dark">.
 * Átta síður hlaða hana (index, verkefnalisti, fjarmalyfirlit, brunakerfi,
 * eydublod, multitool, pdftools, skraalisti). Á síma með dökkt kerfisþema
 * skiptu þær sér því SJÁLFAR í dökkt — og [data-theme="dark"] í css/theme.css
 * skipti um ~30 breytur undir þeim.
 *
 * Meta-taggið `color-scheme: only light` ver gegn Chrome Android sem umlitar
 * síður sjálfkrafa. Það ver EKKI gegn þessari skrá, sem er okkar eigin kóði.
 * Þess vegna var síðan ljós í yfirlýsingu en dökk í reynd.
 *
 * OG ENGINN GAT SLÖKKT Á ÞVÍ. setTheme/cycleTheme áttu engan kallanda í öllu
 * repóinu — eina tilvísunin utan þessarar skráar er athugasemd í index.html:23620.
 * Skiptivélin keyrði sjálfkrafa en engin stýring var tengd við hana.
 *
 * NÚNA: alltaf ljóst. Sömu litir á tölvu, spjaldtölvu og síma, óháð
 * kerfisstillingu notandans. Slökkvitæki-appið var fryst á sama hátt 17.08.2026
 * (Brunastál+rautt, skiptivélin fjarlægð) — þetta samræmir hubbinn við það.
 *
 * [data-theme="dark"]-blokkin í css/theme.css er skilin eftir ÓSNERT en verður
 * óvirk: ekkert setur lengur það eigindi. Hún er ekki fjarlægð svo hægt sé að
 * kveikja á dökku þema aftur með einni breytingu hér, ef Agnar vill það seinna.
 */
(function () {
  var LJOST = 'light';

  // Fast eigindi svo CSS sem stílar á [data-theme] hagi sér fyrirsjáanlega.
  document.documentElement.setAttribute('data-theme', LJOST);
  document.documentElement.setAttribute('data-theme-mode', 'fast');

  // Gömlu geymdu valinu er hent — vél sem hafði 'dark' í localStorage myndi
  // annars sitja uppi með það að eilífu ef þemað yrði nokkurn tíma þítt aftur.
  try { localStorage.removeItem('bh-theme'); } catch (_) {}

  // Föllin standa eftir svo kall úr óþekktum stað hrynji ekki — en þau gera
  // ekkert. Þögult no-op er betra en ReferenceError í miðri vinnu.
  window.setTheme = function () { return LJOST; };
  window.cycleTheme = function () { return LJOST; };
})();
