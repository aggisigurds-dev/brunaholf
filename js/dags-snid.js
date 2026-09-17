/* === DAGSETNINGARSNIÐ — DD/MM/YYYY ===
 *
 * Systurskrá við `slokkvitaeki/js/patches/148-date-format-unify.js`. Sama regla,
 * sama útkoma, svo appið tvö sýni sömu dagsetningu eins.
 *
 * Af hverju:
 *   - `toLocaleDateString('is-IS')` skilar EKKI sama sniði alls staðar. Á sumum
 *     Windows+Chrome-uppsetningum vantar íslensku staðfærsluna og vafrinn fellur
 *     á en-US (M/D/YYYY) — þá sér einn notandi „3/9/2026" og annar „9.3.2026"
 *     fyrir NÁKVÆMLEGA sömu línu af kóða.
 *   - 17.09.2026 ákvað Agnar eitt snið alls staðar: dagur fyrst, skástrik.
 *
 * Hvað þetta gerir:
 *   - Vefur `toLocaleDateString` og `toLocaleString` þannig að þegar kallað er
 *     með 'is'/'is-IS' (eða engu) OG ÁN valkosta-hlutar er skilað DD/MM/YYYY.
 *   - Sé valkosta-hlutur sendur með (t.d. {day:'numeric',month:'long'} fyrir
 *     „17. september 2026") fer kallið óbreytt í gegn. Langformið heldur sér.
 *
 * ATH: þetta snertir aðeins BIRTINGU. Gildi sem eru geymd eða lesin aftur
 * (Payday, Stólpa-PDF, skráarnöfn í Drive) eru ISO eða með punkti og mega ekki
 * breytast — sjá `docs/DAGSETNINGAR.md`.
 */
(() => {
  if (window.__dagsSnidUppsett) return;
  window.__dagsSnidUppsett = true;

  const erIslenskt = (loc) => {
    if (loc == null) return true;                 // sjálfgefið → líka DD/MM/YYYY
    if (typeof loc === 'string') return /^is(-IS)?$/i.test(loc);
    if (Array.isArray(loc)) return loc.some((l) => /^is(-IS)?$/i.test(String(l)));
    return false;
  };

  const tvo = (n) => String(n).padStart(2, '0');
  const ddmmyyyy = (d) => (isNaN(d) ? '' : tvo(d.getDate()) + '/' + tvo(d.getMonth() + 1) + '/' + d.getFullYear());

  const upprDate = Date.prototype.toLocaleDateString;
  Date.prototype.toLocaleDateString = function (locale, options) {
    if (!options && erIslenskt(locale)) return ddmmyyyy(this);
    return upprDate.call(this, locale, options);
  };

  const upprBoth = Date.prototype.toLocaleString;
  Date.prototype.toLocaleString = function (locale, options) {
    if (!options && erIslenskt(locale)) {
      if (isNaN(this)) return '';
      return ddmmyyyy(this) + ', ' + tvo(this.getHours()) + ':' + tvo(this.getMinutes());
    }
    return upprBoth.call(this, locale, options);
  };

  // Fyrir nýjan kóða — hreinna en að smíða Date bara til að sniðmáta.
  window.dagsIS = function (d) {
    if (!d) return '—';
    const dt = (d instanceof Date) ? d : new Date(d);
    return isNaN(dt) ? '—' : ddmmyyyy(dt);
  };
})();
/* === LOK DAGSETNINGARSNIÐS === */
