/* === REIKNINGSLÍNUR — les vörulínur úr Stólpa-reikningum (PDF-texti) ===
 *
 * Agnar 12.09.2026: „nýtt tól í bakenda brunahólf sem les okkar vörulínur út úr
 * invoicum til að safna í gagnabanka yfir hleðsluáætlanirnar" … „Þá er bara
 * lestur á vörunúmerum eða vöruheitum". Notað af hledsluaaetlun.html.
 *
 * INNTAK: texti eins og pdf-parse skilar honum (pdf.js-atriði á sömu y-hæð límd
 * saman, ný lína við nýja hæð). Vafrinn fær sama texta með `textiUrPdfjs(pdfDoc)`.
 *
 * SNIÐIN (mæld 12.09.2026 á 12 + 54 + 75 reikningum 2020–2026):
 *   A · Límd lína   „SlökkviSlökkvitæki Léttvatn 6 ltr.5,009.677,00117243.547,0010,00"
 *                   = [stuttheiti][lýsing][fjöldi][einingaverð][vörunr.][VSK-kóði][upphæð][afsl.%]
 *                   Tölurnar geta líka staðið einar á næstu línu á eftir margra lína lýsingu.
 *   A' · Með bilum  „YfirferðYfirferð Léttvatn 6-9 ltr. 1,0 3.150,0133 23.150"
 *                   = … [fjöldi] [verð+vörunr.] [VSK+upphæð] ([afsl.%]) — pdf.js í vafra skilar
 *                   sumum 2026-reikningum svona.
 *   B · Tala á línu „Yfirferð Léttvatn 6-9 ltr." / „30,00" / „1.774,00133" / „2" / „53.220,00" [/ „20,00"]
 *                   Einingaverð og vörunúmer eru límd saman; aukastafir verðsins = aukastafir fjöldans.
 *   Kreditnóta: línan „Kredit" í haus og mínus á fjölda og upphæð.
 *   Skannað PDF: enginn texti → `textalaust: true` (þarf ljóslestur, ekkert lesið).
 *
 * SANNPRÓFUN — hver lína sannar sig sjálf: fjöldi × verð × (1 − afsl.) = upphæð.
 * Reikningurinn allur: Σ upphæð × (1 + VSK) = „Til greiðslu". Hvort tveggja er
 * skilað (`stemmir`) svo aldrei sé treyst á línu sem reiknast ekki.
 *
 * FLOKKUN eftir VÖRUNÚMERI (sama númeraröð og vorur.dk_vorunr í appinu), ekki
 * heiti: R-105200 ber stuttheitið „Hleðsla" en er vörunr. 132 „Slökkvitækjaþjónusta"
 * með fjöldann 14,7 (tímar). Heitið ræður aðeins ef vörunúmerið er óþekkt, og þá
 * er það merkt `flokkun: 'heiti'`.
 */
(function (rot) {
  'use strict';

  // Vörunúmer → [þjónusta, tegund]. Staðfest gegn vorur.dk_vorunr og lesnum reikningum 12.09.2026.
  const VORUNUMER = {
    '123': ['hledsla', 'lettvatn'], '125': ['hledsla', 'duft6'], '126': ['hledsla', 'duft2'],
    '127': ['hledsla', 'abf'], '128': ['hledsla', 'co2_5'], '129': ['hledsla', 'co2_2'],
    '206': ['hledsla', 'co2_5'], '207': ['hledsla', 'co2_2'],
    '131': ['hledsla', 'co2_kg'],   // „Hleðsla Co2 pr. Kg." — fjöldinn er KÍLÓ, ekki tæki
    '328': ['hledsla', 'duft1'], '331': ['hledsla', 'duft12'],
    '133': ['yfirferd', 'lettvatn'], '135': ['yfirferd', 'duft6'], '136': ['yfirferd', 'duft2'],
    '137': ['yfirferd', 'abf'], '138': ['yfirferd', 'co2_5'], '139': ['yfirferd', 'co2_2'],
    '140': ['yfirferd', 'slanga'], '141': ['yfirferd', 'reyk'],
    '353': ['yfirferd', 'duft2'], '332': ['yfirferd', 'duft9'],
    '117': ['nytt', 'lettvatn'], '118': ['nytt', 'duft6'], '119': ['nytt', 'duft2'],
    '120': ['nytt', 'abf'], '121': ['nytt', 'co2_5'], '122': ['nytt', 'co2_2'],
    '329': ['nytt', 'lettvatn2'], '341': ['nytt', 'co2_1'], '342': ['nytt', 'co2_5'], '343': ['nytt', 'co2_5'],
    '143': ['nytt', 'co2_5'],     // „Kolsýrukútur notaður 5 kg. með krana" (eldri Stólpa-reikningar)
    '116': ['nytt', 'lettvatn'],  // „Léttvatnsstæki 6ltr Einlitt" (eldri Stólpa-reikningar)
    '160': ['nytt', 'reyk'], '161': ['nytt', 'reyk'], '162': ['nytt', 'reyk'], '214': ['nytt', 'reyk'],
    '170': ['nytt', 'teppi'],
    '132': ['annad', null]   // „Slökkvitækjaþjónusta" — tímavinna, ekki tækjafjöldi
  };
  const VSK = { '2': 0.24, '1': 0.11, '0': 0 };

  const MAGN = /^-?(?:0|[1-9]\d{0,4}),\d{1,2}$/;
  const VERD1 = /^-?(?:0|[1-9]\d{0,2}(?:\.\d{3})*),\d$/;
  const VERD2 = /^-?(?:0|[1-9]\d{0,2}(?:\.\d{3})*),\d{2}$/;
  const UPPH = /^-?(?:0|[1-9]\d{0,2}(?:\.\d{3})*)(?:,\d{1,2})?$/;
  const VSKUPPH = /^(\d)(-?(?:0|[1-9]\d{0,2}(?:\.\d{3})*)(?:,\d{1,2})?)$/;
  const AFSL = /^\d{1,2},\d{2}$/;
  const STAFIR = /[A-Za-zÁÉÍÓÚÝÞÆÐÖáéíóúýþæðö]/;
  // Hausmerki sem standa stök á línu rétt á undan vörulínunum (öll sniðin).
  const HAUSMERKI = /^(Sími:Fax:|Sími:|Eining|Raðnr\.:Sími:|Raðnr\.:|Dagsetning:|Gjalddagi-Eindagi:|Greiðsl\.skilm\.:|Starfsmaður:|Tilvísun:|Afh\.skilm\.:|Verk:)$/;

  function tala(s) { return Number(String(s).replace(/\./g, '').replace(',', '.')); }

  function reiknast(magn, verd, afsl, upph) {
    const vaent = magn * verd * (1 - (afsl || 0) / 100);
    return Math.abs(vaent - upph) <= Math.max(1.5, Math.abs(upph) * 0.002);
  }

  // Tölurunan eftir lýsingu, límd saman: [fjöldi][verð][vörunr.][VSK][upphæð][afsl.%]?
  // Allar skiptingar sem standast snið eru prófaðar; aðeins sú sem reiknast er tekin.
  function sundra(S) {
    const lausnir = [];
    for (let a = 3; a <= Math.min(S.length, 9); a++) {
      const m = S.slice(0, a);
      if (!MAGN.test(m)) continue;
      const aukastafir = m.split(',')[1].length;
      const reVerd = aukastafir === 1 ? VERD1 : VERD2;
      for (let b = a + 3; b <= Math.min(S.length, a + 14); b++) {
        const v = S.slice(a, b);
        if (!reVerd.test(v)) continue;
        for (const lengd of [3, 2]) {
          const vnr = S.slice(b, b + lengd);
          if (!/^\d+$/.test(vnr) || vnr.length !== lengd) continue;
          const vsk = S.charAt(b + lengd);
          if (!/^\d$/.test(vsk)) continue;
          const hali = S.slice(b + lengd + 1);
          const kostir = [[hali, null]];
          const ma = hali.match(/^(.*?)(\d{1,2},\d{2})$/);
          if (ma) kostir.push([ma[1], ma[2]]);
          for (const [u, af] of kostir) {
            if (!u || !UPPH.test(u)) continue;
            if (af !== null && !AFSL.test(af)) continue;
            const lina = { magn: tala(m), einingaverd: tala(v), vorunumer: vnr, vsk, upphaed: tala(u), afslattur_pct: af === null ? null : tala(af) };
            if (reiknast(lina.magn, lina.einingaverd, lina.afslattur_pct, lina.upphaed)) lausnir.push(lina);
          }
        }
      }
    }
    if (!lausnir.length) return null;
    // Fleiri en ein? Þriggja stafa vörunúmer og þekktur VSK-kóði vinna.
    lausnir.sort((x, y) => (y.vorunumer.length - x.vorunumer.length) || ((y.vsk in VSK) - (x.vsk in VSK)));
    return lausnir[0];
  }

  // Lína með lýsingu OG tölum límdum aftast (snið A). Lengsta lýsingin sem skilur
  // eftir gilda runu vinnur („…150x150" + „2,00…", ekki „…150x15" + „02,00…").
  function klofnaLimdri(lina) {
    let sidastiStafur = -1;
    for (let i = lina.length - 1; i >= 0; i--) { if (!/[0-9.,\-]/.test(lina[i])) { sidastiStafur = i; break; } }
    if (sidastiStafur < 0) return null;
    for (let p = sidastiStafur + 1; p < lina.length - 6; p++) {
      const s = sundra(lina.slice(p));
      if (!s) continue;
      let besta = { p, s };
      for (let q = p + 1; q < lina.length - 6; q++) {
        const t = sundra(lina.slice(q));
        if (t && t.upphaed === s.upphaed && t.vorunumer === s.vorunumer) besta = { p: q, s: t };
      }
      return { lysing: lina.slice(0, besta.p).trim(), tolur: besta.s };
    }
    return null;
  }

  // Einingaverð + vörunúmer límt („3.150,0133"): aukastafir verðsins = aukastafir fjöldans.
  function verdOgNumer(tok, aukastafir) {
    const m = String(tok).match(aukastafir === 1 ? /^(-?[\d.]+,\d)(\d{2,3})$/ : /^(-?[\d.]+,\d{2})(\d{2,3})$/);
    if (!m || !(aukastafir === 1 ? VERD1 : VERD2).test(m[1])) return null;
    return { einingaverd: tala(m[1]), vorunumer: m[2] };
  }
  // Handslegin lína getur verið án vörunúmers („-2,0 | 3.387,0 | 2 | -6.774" á kreditnótu R-108024) —
  // þá er verðið eitt og sér og línan flokkast eftir heiti.
  function verdEdaVerdOgNumer(tok, aukastafir) {
    return verdOgNumer(tok, aukastafir) ||
      ((aukastafir === 1 ? VERD1 : VERD2).test(String(tok)) ? { einingaverd: tala(tok), vorunumer: null } : null);
  }

  // Snið A' — tölurnar aftast á línunni aðskildar með bilum:
  //   „1,0 3.150,0133 23.150"         [fjöldi] [verð+nr] [VSK+upphæð]
  //   „4,0 6.962,9177 223.67415,00"   [fjöldi] [verð+nr] [VSK+upphæð+afsl.%] — afslátturinn límdur aftan við
  //   … eða VSK, upphæð og afsláttur sem sér orð.
  // „223.67415,00" → allar gildar skiptingar; aðeins sú sem reiknast er notuð.
  function vskUpphAfsl(tok) {
    const s = String(tok), ut = [];
    const vsk = s.charAt(0);
    if (!/^\d$/.test(vsk)) return ut;
    const R = s.slice(1);
    if (UPPH.test(R)) ut.push({ vsk, upph: R, af: null });
    for (const n of [4, 5]) {
      if (R.length > n && UPPH.test(R.slice(0, -n)) && AFSL.test(R.slice(-n))) ut.push({ vsk, upph: R.slice(0, -n), af: R.slice(-n) });
    }
    return ut;
  }
  function klofnaBilum(lina) {
    const toks = String(lina).trim().split(/\s+/);
    const kostir = [
      { k: 3, les: t => vskUpphAfsl(t[2]) },
      { k: 4, les: t => (AFSL.test(t[3]) ? vskUpphAfsl(t[2]).filter(x => x.af === null).map(x => Object.assign(x, { af: t[3] })) : []) },
      { k: 4, les: t => (/^\d$/.test(t[2]) && UPPH.test(t[3]) ? [{ vsk: t[2], upph: t[3], af: null }] : []) },
      { k: 5, les: t => (/^\d$/.test(t[2]) && UPPH.test(t[3]) && AFSL.test(t[4]) ? [{ vsk: t[2], upph: t[3], af: t[4] }] : []) }
    ];
    for (const kostur of kostir) {
      if (toks.length <= kostur.k) continue;
      const t = toks.slice(-kostur.k);
      if (!MAGN.test(t[0])) continue;
      const vn = verdEdaVerdOgNumer(t[1], t[0].split(',')[1].length);
      if (!vn) continue;
      for (const r of kostur.les(t)) {
        const tolur = { magn: tala(t[0]), einingaverd: vn.einingaverd, vorunumer: vn.vorunumer, vsk: r.vsk, upphaed: tala(r.upph), afslattur_pct: r.af === null ? null : tala(r.af) };
        if (reiknast(tolur.magn, tolur.einingaverd, tolur.afslattur_pct, tolur.upphaed)) return { lysing: toks.slice(0, -kostur.k).join(' '), tolur };
      }
    }
    return null;
  }

  // Stuttheiti Stólpa límt framan á lýsingu í sniði A: „YfirferðYfirferð Léttvatn",
  // „SlökkviSlökkvitæki", „Skilti fSkilti flöt", „samtenReykskynjarar", „HleðslaSlökkvitækjaþjónusta".
  function hreinsaStuttheiti(s) {
    s = String(s || '').trim();
    const n = Math.min(12, Math.floor(s.length / 2));
    for (let k = n; k >= 2; k--) {
      const p = s.slice(0, k);
      if (s.slice(k).toLowerCase().startsWith(p.toLowerCase())) return s.slice(k);
    }
    const m = s.match(/^([A-ZÁÉÍÓÚÝÞÆÐÖ]?[a-záéíóúýþæðö]{2,9})(?=[A-ZÁÉÍÓÚÝÞÆÐÖ][a-záéíóúýþæðö])/);
    return m ? s.slice(m[1].length) : s;
  }

  function flokkaHeiti(texti, magn) {
    const t = String(texti || '').toLowerCase();
    let tegund = null;
    if (/l[ée]ttvatn/.test(t)) tegund = 'lettvatn';
    else if (/abf|froð|frod/.test(t)) tegund = 'abf';
    else if (/duft/.test(t)) tegund = /\b2\s*kg/.test(t) ? 'duft2' : 'duft6';
    else if (/co2|co₂|kolsýr/.test(t)) tegund = /\b2\s*kg/.test(t) ? 'co2_2' : (/\b5\s*kg/.test(t) ? 'co2_5' : null);
    else if (/brunaslang/.test(t)) tegund = 'slanga';
    else if (/reykskynj/.test(t)) tegund = 'reyk';
    else if (/teppi/.test(t)) tegund = 'teppi';
    let thjonusta = 'annad';
    if (tegund && Number.isInteger(Math.abs(magn)) && /hle[ðd]sl|endurhla/.test(t)) thjonusta = 'hledsla';
    else if (tegund && /yfirf/.test(t)) thjonusta = 'yfirferd';
    return { thjonusta, tegund: thjonusta === 'annad' ? null : tegund };
  }

  // vorur (valfrjálst): { '<dk_vorunr>': { nafn, flokkur } } úr vöruskrá appsins.
  function flokka(vorunumer, lysing, magn, vorur) {
    const k = VORUNUMER[vorunumer];
    if (k) return { thjonusta: k[0], tegund: k[1], flokkun: 'vorunumer' };
    if (vorur && vorur[vorunumer]) return Object.assign(flokkaHeiti(vorur[vorunumer].nafn, magn), { flokkun: 'vorunumer' });
    return Object.assign(flokkaHeiti(lysing, magn), { flokkun: 'heiti' });
  }

  function lesa(texti, valkostir) {
    const vorur = valkostir && valkostir.vorur;
    const linur = String(texti || '').split('\n').map(s => s.trim());
    const ath = [];
    if (!linur.some(l => STAFIR.test(l))) {
      return { reikningur_nr: null, dags: null, kennitala: null, vidskiptavinur: '', vegna: null, tilvisun: null, kredit: false,
        linur: [], samtala: 0, til_greidslu: null, stemmir: null, textalaust: true, ath: ['PDF án textalags (skannað skjal) — þarf ljóslestur'] };
    }
    const fyrsta = re => { for (const l of linur) { const m = l.match(re); if (m) return m; } return null; };

    const nrM = fyrsta(/^(1\d{5})$/);
    const dM = fyrsta(/^(\d{2})\.(\d{2})\.(\d{2})$/);
    const ktM = fyrsta(/^(\d{6})-(\d{4})$/);
    const vegnaM = fyrsta(/^vegna:?\s+(.+)$/i);
    const tilvM = fyrsta(/^(S-\d{6})$/);
    const kredit = linur.some(l => /^Kredit$/i.test(l));
    const nafn = (linur.find(l => l && STAFIR.test(l)) || '').trim();

    let endir = linur.findIndex(l => /^Þessi reikningur er rafrænt/.test(l));
    if (endir < 0) { endir = linur.length; ath.push('fann ekki lok vörulína'); }
    let upphaf = -1;
    for (let i = 0; i < endir; i++) { if (HAUSMERKI.test(linur[i])) upphaf = i; }
    if (upphaf < 0) ath.push('fann ekki upphaf vörulína');

    const vorulinur = [];
    let lysingBid = [];
    const skra = (lysing, t, snid) => {
      const hrein = snid === 'A' ? hreinsaStuttheiti(lysing) : lysing;
      const f = flokka(t.vorunumer, hrein, t.magn, vorur);
      vorulinur.push({
        linu_nr: vorulinur.length + 1, lysing: hrein, vorunumer: t.vorunumer, magn: t.magn,
        einingaverd: t.einingaverd, afslattur_pct: t.afslattur_pct, upphaed: t.upphaed, vsk: t.vsk,
        thjonusta: f.thjonusta, tegund: f.tegund, flokkun: f.flokkun, snid,
        stemmir: t._reiknast !== false
      });
    };

    for (let i = upphaf + 1; i < endir; i++) {
      const l = linur[i];
      if (!l) continue;
      if (STAFIR.test(l)) {
        const k = klofnaLimdri(l) || klofnaBilum(l);
        if (k) { skra(lysingBid.concat(k.lysing).join(' ').trim(), k.tolur, 'A'); lysingBid = []; }
        else lysingBid.push(l);
        continue;
      }
      const hopur = [];
      let j = i;
      while (j < endir && linur[j] && !STAFIR.test(linur[j])) { hopur.push(linur[j]); j++; }
      i = j - 1;
      const lysing = lysingBid.join(' ').trim();
      lysingBid = [];
      if (!lysing) { ath.push('talnalína án lýsingar: ' + hopur.join(' | ')); continue; }
      let t = null, snid = null;
      if (hopur.length >= 4 && MAGN.test(hopur[0]) && /^\d$/.test(hopur[2]) && UPPH.test(hopur[3])) {
        const vn = verdEdaVerdOgNumer(hopur[1], hopur[0].split(',')[1].length);
        const af = hopur[4] && AFSL.test(hopur[4]) ? tala(hopur[4]) : null;
        if (vn) {
          t = { magn: tala(hopur[0]), einingaverd: vn.einingaverd, vorunumer: vn.vorunumer, vsk: hopur[2], upphaed: tala(hopur[3]), afslattur_pct: af };
          snid = 'B';
          if (!reiknast(t.magn, t.einingaverd, t.afslattur_pct, t.upphaed)) t._reiknast = false;
        }
        const notad = af === null ? 4 : 5;
        if (hopur.length > notad) ath.push('auka talnalínur eftir „' + lysing + '": ' + hopur.slice(notad).join(' | '));
      }
      if (!t) { t = sundra(hopur.join('')); snid = 'A'; }
      if (!t) { const kb = klofnaBilum('x ' + hopur.join(' ')); if (kb) { t = kb.tolur; snid = 'A'; } }
      if (!t) { ath.push('las ekki tölur fyrir „' + lysing + '": ' + hopur.join(' | ')); continue; }
      skra(lysing, t, snid);
    }
    if (lysingBid.length) ath.push('lýsing án talna: ' + lysingBid.join(' | '));

    let tilGreidslu = null;
    const ig = linur.findIndex(l => /^Til greiðslu/.test(l));
    if (ig >= 0) { for (let k = ig + 1; k < Math.min(linur.length, ig + 3); k++) { if (UPPH.test(linur[k])) { tilGreidslu = tala(linur[k]); break; } } }
    const samtala = Math.round(vorulinur.reduce((a, v) => a + v.upphaed, 0) * 100) / 100;
    let stemmir = null;
    if (tilGreidslu !== null && vorulinur.length && vorulinur.every(v => v.vsk in VSK)) {
      const medVsk = vorulinur.reduce((a, v) => a + v.upphaed * (1 + VSK[v.vsk]), 0);
      stemmir = Math.abs(medVsk - tilGreidslu) <= Math.max(2, Math.abs(tilGreidslu) * 0.0005);
    }

    return {
      reikningur_nr: nrM ? 'R-' + nrM[1] : null,
      dags: dM ? '20' + dM[3] + '-' + dM[2] + '-' + dM[1] : null,
      kennitala: ktM ? ktM[1] + ktM[2] : null,
      vidskiptavinur: nafn,
      vegna: vegnaM ? vegnaM[1].trim() : null,
      tilvisun: tilvM ? tilvM[1] : null,
      kredit,
      linur: vorulinur,
      samtala, til_greidslu: tilGreidslu, stemmir,
      textalaust: false,
      ath
    };
  }

  // Vafri: sami texti og pdf-parse býr til (sama y → límt, ný y → ný lína).
  async function textiUrPdfjs(pdfDoc) {
    let ut = '';
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const sida = await pdfDoc.getPage(n);
      const efni = await sida.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
      let sidastaY = null, texti = '';
      for (const atr of efni.items) {
        const y = atr.transform[5];
        if (sidastaY === null || sidastaY === y) texti += atr.str; else texti += '\n' + atr.str;
        sidastaY = y;
      }
      ut += '\n\n' + texti;
    }
    return ut;
  }

  const api = { lesa, sundra, flokka, hreinsaStuttheiti, klofnaBilum, textiUrPdfjs, VORUNUMER };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else rot.ReikningsLinur = api;
})(typeof window !== 'undefined' ? window : globalThis);
