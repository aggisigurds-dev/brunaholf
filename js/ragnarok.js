/* Ragnarök-útlit fyrir J.A.R.V.I.S. (jarvis.html) og Vélarrými (afkastavakt.html).
 *
 * Agnar 11.09.2026: „Ragnarök útgáfu af Jarvis … switchable theme af þeim síðum",
 * eftir „Golden Jarvis MkII" úr Claude Design. Klassíska (bláa) útlitið er
 * sjálfgefið og óbreytt; Ragnarök kviknar með <html data-thema="ragnarok">.
 *
 * Stillingin á við tækið: localStorage `jarvis_thema_v1` ('ragnarok' | 'klassiskt'),
 * sameiginleg báðum síðunum og hubbinu (index.html litar rammann um Jarvis-flipann).
 * `?thema=ragnarok` eða `?thema=klassiskt` í slóð setur hana líka. Höfuð-skriftan á
 * hvorri síðu setur eigindið ÁÐUR en málað er; þessi skrá sér um rofann (RgThema),
 * letrið, samstillingu milli flipa og teikningu eldkjarnans (RgKjarni).
 *
 * RgKjarni teiknar úr hönnuninni: glóð, þykkan bútaðan málmhring, geisla á 17° fresti,
 * dökka skífu, bjartan snúningsboga, brennandi brotna boga, glæður sem rísa og bráðinn
 * kjarna. Allt á striga síðunnar í hennar eigin rAF-lykkju — engin aukalykkja — og
 * shadowBlur aðeins á örfáum strikum, því hann er dýr á síma.
 */
(function () {
  'use strict';

  var LYKILL = 'jarvis_thema_v1';
  var LETUR = 'https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap';

  function er() { return document.documentElement.getAttribute('data-thema') === 'ragnarok'; }

  function saekjaLetur() {
    if (document.getElementById('rg-letur')) return;
    var l = document.createElement('link');
    l.id = 'rg-letur'; l.rel = 'stylesheet'; l.href = LETUR;
    document.head.appendChild(l);
  }

  // Litur vafrastikunnar (meta theme-color) fylgir útlitinu; klassíski liturinn er geymdur á taginu.
  function litaHaus(rg) {
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m) return;
    if (!m.hasAttribute('data-klassiskt')) m.setAttribute('data-klassiskt', m.getAttribute('content') || '');
    m.setAttribute('content', rg ? '#020202' : m.getAttribute('data-klassiskt'));
  }

  // `vista` = notandinn skipti sjálfur og stillingin skrifast. Storage-atburður frá
  // öðrum flipa vistar ekki aftur — hann speglar bara það sem hinn flipinn gerði.
  function setja(t, vista) {
    var rg = t === 'ragnarok', adur = er();
    if (rg) { document.documentElement.setAttribute('data-thema', 'ragnarok'); saekjaLetur(); }
    else document.documentElement.removeAttribute('data-thema');
    if (vista) { try { localStorage.setItem(LYKILL, rg ? 'ragnarok' : 'klassiskt'); } catch (e) {} }
    litaHaus(rg);
    if (adur !== rg) window.dispatchEvent(new CustomEvent('rg:thema', { detail: { ragnarok: rg } }));
  }

  function skipta() { setja(er() ? 'klassiskt' : 'ragnarok', true); }

  window.addEventListener('storage', function (e) {
    if (e.key === LYKILL) setja(e.newValue === 'ragnarok' ? 'ragnarok' : 'klassiskt', false);
  });
  if (er()) saekjaLetur();

  window.RgThema = { LYKILL: LYKILL, er: er, setja: setja, skipta: skipta, litaHaus: litaHaus };

  /* ── RgKjarni ─────────────────────────────────────────────────────────────── */
  var GR = Math.PI / 180, HRINGUR = Math.PI * 2;
  var THYKKUR = [[0, 38, '#ffb347'], [52, 70, '#c9982f'], [74, 140, '#ff8c2a'], [168, 176, '#e6b04a'],
                 [190, 262, '#ffcf6a'], [300, 318, '#d2691e'], [324, 360, '#ffb347']];
  var GRANNUR = [[20, 30, '#ff9a3a'], [95, 160, '#ffd98a'], [200, 215, '#b5651d'], [250, 330, '#ffb347']];

  // Umgjörðin utan um agnaskífu með radíus R: skífan nær 1,09·R, hringirnir 1,29·R,
  // geislarnir 1,36·R, gráðutölurnar 1,43·R og glóðin 1,5·R. `t` í sekúndum.
  function hringir(x, cx, cy, R, dpr, t, merki) {
    if (!(R > 0)) return;
    var i, s, d, a;
    function bogi(r, fra, til) { x.beginPath(); x.arc(cx, cy, r, fra, til); x.stroke(); }

    var puls = 0.8 + 0.2 * Math.sin(t * 2.094);                 // andar á 3 s
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
    g.addColorStop(0, 'rgba(255,150,40,' + (0.5 * puls).toFixed(3) + ')');
    g.addColorStop(0.48, 'rgba(210,80,20,' + (0.22 * puls).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(210,80,20,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R * 1.5, 0, HRINGUR); x.fill();

    var snA = t * HRINGUR / 140, snB = -t * HRINGUR / 110;       // þykkur réttsælis, grannur rangsælis
    x.lineWidth = R * 0.2;
    for (i = 0; i < THYKKUR.length; i++) { s = THYKKUR[i]; x.strokeStyle = s[2]; bogi(R * 1.19, (s[0] - 90) * GR + snA, (s[1] - 90) * GR + snA); }
    x.lineWidth = R * 0.12;
    for (i = 0; i < GRANNUR.length; i++) { s = GRANNUR[i]; x.strokeStyle = s[2]; bogi(R * 1.15, s[0] * GR + snB, s[1] * GR + snB); }

    // geislar: tvær slóðir, eitt strik hvor; flökta eins og jv-flicker í hönnuninni (8 s)
    var snC = t * HRINGUR / 300, fz = (t % 8) / 8;
    var fl = fz < 0.92 ? 1 : fz < 0.95 ? 0.4 : fz < 0.97 ? 1 : 0.6;
    x.beginPath();
    for (d = 0; d < 360; d += 17) {
      a = (d + 0.5 - 90) * GR + snC;
      x.moveTo(cx + Math.cos(a) * R * 1.09, cy + Math.sin(a) * R * 1.09);
      x.lineTo(cx + Math.cos(a) * R * 1.36, cy + Math.sin(a) * R * 1.36);
    }
    x.lineWidth = Math.max(1, R * 0.018); x.strokeStyle = 'rgba(255,140,42,' + (0.8 * fl).toFixed(2) + ')'; x.stroke();
    x.beginPath();
    for (d = 0; d < 360; d += 17) {
      a = (d + 5.75 - 90) * GR + snC;
      x.moveTo(cx + Math.cos(a) * R * 1.11, cy + Math.sin(a) * R * 1.11);
      x.lineTo(cx + Math.cos(a) * R * 1.3, cy + Math.sin(a) * R * 1.3);
    }
    x.lineWidth = Math.max(1, R * 0.009); x.strokeStyle = 'rgba(255,207,106,' + (0.8 * fl).toFixed(2) + ')'; x.stroke();

    // dökka skífan (felur innri enda hringjanna) + glóð innan á brúninni
    var sk = x.createRadialGradient(cx, cy, 0, cx, cy, R * 1.09);
    sk.addColorStop(0, '#050505'); sk.addColorStop(0.78, '#050505');
    sk.addColorStop(0.92, 'rgba(40,14,4,.97)'); sk.addColorStop(1, 'rgba(92,34,8,.95)');
    x.fillStyle = sk; x.beginPath(); x.arc(cx, cy, R * 1.09, 0, HRINGUR); x.fill();
    var br = x.createRadialGradient(cx, cy, R * 0.72, cx, cy, R * 1.09);
    br.addColorStop(0, 'rgba(255,120,30,0)'); br.addColorStop(1, 'rgba(255,120,30,.34)');
    x.fillStyle = br; x.beginPath(); x.arc(cx, cy, R * 1.09, 0, HRINGUR); x.fill();

    // bjartur snúningsbogi (18 s): ljós fjórðungur + glóandi fjórðungur. Glóðin er breið dauf rönd
    // undir — shadowBlur í hverjum ramma var dýr á síma (yfirferð 11.09.2026).
    var snD = t * HRINGUR / 18, a0 = -0.75 * Math.PI + snD, a1 = -0.25 * Math.PI + snD, a2 = 0.25 * Math.PI + snD;
    x.lineWidth = Math.max(6, 11 * dpr); x.strokeStyle = 'rgba(255,140,40,.22)'; bogi(R * 1.21, a0, a2);
    x.lineWidth = Math.max(2, 3.5 * dpr);
    x.strokeStyle = '#fff0c0'; bogi(R * 1.21, a0, a1);
    x.strokeStyle = 'rgba(255,120,40,.6)'; bogi(R * 1.21, a1, a2);

    if (merki) teiknaMerki(x, cx, cy, R, dpr);
  }

  // Gráðutölurnar standa kyrrar, svo þær eru teiknaðar EINU SINNI (með glóð) á geymslustriga og
  // aðeins afritaðar í hverjum ramma. Teiknaðar aftur ef stærð, miðja eða letur breytist.
  var merkjaGeymsla = typeof WeakMap === 'function' ? new WeakMap() : null;
  function teiknaMerki(x, cx, cy, R, dpr) {
    var W = x.canvas.width, H = x.canvas.height;
    var letur = !!(document.fonts && document.fonts.check && document.fonts.check('9px "Chakra Petch"'));
    var lykill = W + 'x' + H + ':' + Math.round(cx) + ',' + Math.round(cy) + ',' + Math.round(R) + ',' + dpr + ',' + letur;
    var g = merkjaGeymsla && merkjaGeymsla.get(x.canvas);
    if (!g || g.lykill !== lykill) {
      var c = document.createElement('canvas'), d, a;
      c.width = W; c.height = H;
      var y = c.getContext('2d');
      y.font = Math.round(9 * dpr) + "px 'Chakra Petch',ui-monospace,Menlo,Consolas,monospace";
      if ('letterSpacing' in y) y.letterSpacing = (1.2 * dpr).toFixed(1) + 'px';
      y.textAlign = 'center'; y.textBaseline = 'middle';
      y.fillStyle = '#ff9a3a'; y.shadowBlur = 6 * dpr; y.shadowColor = 'rgba(255,120,30,.8)';
      for (d = 0; d < 360; d += 30) {
        a = (d - 90) * GR;
        y.fillText(String(d).padStart(3, '0'), cx + Math.cos(a) * R * 1.43, cy + Math.sin(a) * R * 1.43);
      }
      g = { lykill: lykill, strigi: c };
      if (merkjaGeymsla) merkjaGeymsla.set(x.canvas, g);
    }
    x.drawImage(g.strigi, 0, 0);
  }

  // Brennandi brotnir bogar og glæður sem rísa. Hver striga fær sitt eintak (eigið ástand).
  // `hradi` > 1 kyndir eldinn (hljóð / tal); teiknað í 'lighter' svo glóðin leggist saman.
  function glod(nBogar, nGlaedur) {
    var bogar = [], glaedur = [], i;
    for (i = 0; i < nBogar; i++) {
      bogar.push({ r: 0.55 + Math.random() * 0.55, a: Math.random() * 6.283, len: 0.1 + Math.random() * 1.2,
        w: 1 + Math.random() * 3, sp: (Math.random() - 0.5) * 0.15, ph: Math.random() * 6.283, heitt: Math.random() > 0.6 });
    }
    for (i = 0; i < nGlaedur; i++) {
      glaedur.push({ x: Math.random() * 2.4 - 1.2, y: Math.random() * 2.4 - 1.2,
        vy: 0.08 + Math.random() * 0.25, s: 0.5 + Math.random() * 1.5, ph: Math.random() * 6.283 });
    }
    return {
      teikna: function (x, cx, cy, R, dpr, t, dt, hradi) {
        var i, b, e, fl, rr, alfa, k;
        x.lineCap = 'butt';
        for (i = 0; i < bogar.length; i++) {
          b = bogar[i];
          b.a += b.sp * hradi * dt;
          fl = 0.5 + 0.5 * Math.sin(t * (0.8 + b.w * 0.3) + b.ph);
          if (fl < 0.12) continue;
          rr = Math.max(0, R * b.r + Math.sin(t + b.ph) * 2 * dpr);
          alfa = b.heitt ? 0.35 + 0.6 * fl : 0.25 + 0.5 * fl;
          x.beginPath(); x.arc(cx, cy, rr, b.a, b.a + b.len);
          x.lineWidth = (b.w + 5) * dpr;                               // breið dauf rönd = glóð án shadowBlur
          x.strokeStyle = 'rgba(255,140,40,' + (alfa * 0.16).toFixed(3) + ')'; x.stroke();
          x.lineWidth = b.w * dpr;
          x.strokeStyle = b.heitt ? 'rgba(255,' + ((200 + 40 * fl) | 0) + ',140,' + alfa.toFixed(2) + ')'
                                  : 'rgba(' + ((230 + 25 * fl) | 0) + ',' + ((110 + 60 * fl) | 0) + ',30,' + alfa.toFixed(2) + ')';
          x.stroke();
        }
        for (i = 0; i < glaedur.length; i++) {
          e = glaedur[i];
          e.y -= e.vy * hradi * dt; e.x += Math.sin(t * 2 + e.ph) * 0.1 * dt;
          if (e.y < -1.2) { e.y = 1.2; e.x = Math.random() * 2.4 - 1.2; }
          if (Math.sqrt(e.x * e.x + e.y * e.y) > 1.15) continue;
          k = 0.4 + 0.6 * Math.abs(Math.sin(t * 3 + e.ph));
          x.fillStyle = 'rgba(255,' + ((120 + 100 * k) | 0) + ',40,' + (0.3 + 0.6 * k).toFixed(2) + ')';
          x.beginPath(); x.arc(cx + e.x * R, cy + e.y * R, e.s * dpr, 0, HRINGUR); x.fill();
        }
      }
    };
  }

  // Bráðni kjarninn: fimm bogar sem hringsnúast um miðjupunktinn.
  function kjarni(x, cx, cy, R, dpr, t) {
    for (var i = 0; i < 5; i++) {
      var rr = Math.max(0, R * (0.06 + i * 0.038) + Math.sin(t * 2 + i) * R * 0.017);
      var st = t * (1.2 + i * 0.3) + i, lengd = 1.6 + Math.sin(t + i);
      var lit = '255,' + (210 - i * 20) + ',' + (120 - i * 18), alfa = 0.9 - i * 0.12;
      x.beginPath(); x.arc(cx, cy, rr, st, st + lengd);
      x.lineWidth = 6 * dpr; x.strokeStyle = 'rgba(' + lit + ',' + (alfa * 0.18).toFixed(3) + ')'; x.stroke();
      x.lineWidth = 1.3 * dpr; x.strokeStyle = 'rgba(' + lit + ',' + alfa.toFixed(2) + ')'; x.stroke();
    }
  }

  // Agnaskífa (TALA-hnappurinn og Vélarrými): stjörnur sem snúast hægt, bjartari nær miðju.
  function agnir(n) {
    var p = [];
    for (var i = 0; i < n; i++) {
      p.push({ a: Math.random() * 6.283, r: Math.sqrt(Math.random()), s: 0.5 + Math.random() * 1.1,
        w: (Math.random() - 0.5) * 0.24, ph: Math.random() * 6.283 });
    }
    return {
      teikna: function (x, cx, cy, R, dpr, t, dt, hradi, staekkun) {
        for (var i = 0; i < p.length; i++) {
          var q = p[i], k = 1 - q.r, tw = 0.5 + 0.5 * Math.sin(t * 2 + q.ph);
          q.a += q.w * hradi * dt;
          x.fillStyle = 'rgba(255,' + ((175 + 60 * k) | 0) + ',' + ((70 + 90 * k) | 0) + ',' + (0.25 + 0.7 * k * tw).toFixed(2) + ')';
          x.beginPath(); x.arc(cx + Math.cos(q.a) * q.r * R, cy + Math.sin(q.a) * q.r * R, q.s * dpr * (staekkun || 1), 0, HRINGUR); x.fill();
        }
      }
    };
  }

  // Hvítglóandi miðja (sama litaröð og í hönnuninni).
  function blomi(x, cx, cy, r) {
    if (!(r > 0)) return;
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(0.3, 'rgba(255,190,80,.8)');
    g.addColorStop(0.7, 'rgba(230,90,20,.35)'); g.addColorStop(1, 'rgba(200,60,10,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, HRINGUR); x.fill();
  }

  window.RgKjarni = { hringir: hringir, glod: glod, kjarni: kjarni, agnir: agnir, blomi: blomi };
})();
