// rekstur-manudir.js — „Hvernig gengur reksturinn?“ fyrir Brunahólf: sjö tímabil í EINU kalli (22.11.2026, beiðni Agnars).
//
//   GET /api/rekstur-manudir
//     → { idag, man[7]{ fra, til, heiti, unnid, greitt, unnid_hlutar{tima,landspitali,heklureitur}, klst, got },
//         innheimta{…}, ferskleiki{…}, sott }
//   Sex heilir mánuðir á undan + líðandi mánuður til dags. Rekstrarskýrslan (rekstrarskyrsla.js) skilar aðeins mánuð til dags og þrjá
//   heila, og slökkvitæki.netlify.app má ekki kalla á hana sex sinnum — hér er sóknin gerð einu sinni og reiknuð með SÖMU föllum
//   (_rekstur.js brunaholf(), engin ný regla):
//     UNNIÐ  = stimplaðir rukkanlegir tímar × dagvinnutaxti verkstaðar + Landspítalagöt (checked_date) + Heklureitsgöt (execution_date)
//     GREITT = Payday PAID eftir greidsla_date (höfuðstóll, án vsk) + reikningar merktir greiddir í Kröfu yfirliti (SENT, innan 120 d)
//     INNHEIMTA = _rekstur.js innheimta() (skilgreining í ⓘ á flísinni): hlutfall, gjaldfallið, greiðsluhraði.
//   REIKNINGSFÆRT (útgáfudagur) er reiknað í slokkvitaeki tekjur-beint/rekstur-yfirlit úr sömu töflu (invoices) og áður.
// Aðgangur: eins og rekstrarskyrsla.js — innskráður stjórnandi (hub_user, rola Admin); 401/403 annars. AÐEINS LESTUR.
const R = require('./_rekstur.js');
const RS = require('./rekstrarskyrsla.js');

const INNHEIMTA_FRA = '2026-06-30';   // Slökkvitæki fór í Payday 30.06.2026 — sama gluggi á báðum félögum svo tölurnar séu samanburðarhæfar

async function innheimtaBh(idag) {
  const [radir, hand] = await Promise.all([
    RS._allt('invoices', `select=tilvisun,status,utgafudagur,gjalddagi,greidsla_date,hofudstoll&source=eq.payday&status=in.(PAID,SENT)&utgafudagur=gte.${INNHEIMTA_FRA}&order=id.asc`),
    RS._allt('krofur_yfirlit_meta', `select=inv_key,paid,paid_at,hidden,done&or=(paid.eq.true,hidden.eq.true,done.eq.true)&order=inv_key.asc`),
  ]);
  if (!radir.length) return { omaelt: 'reikningalesturinn skilaði engu' };
  return R.innheimta(radir, hand, idag, INNHEIMTA_FRA);
}

async function manudir(idag) {
  const per = R.manudir(idag);
  const { gogn, ferskleiki } = await RS._saekja(idag, { fra: per[0].fra, bhAdeins: true });
  // Tómur lestur er EKKI 0: Tímavera, Ajour og Payday-greiðslur Brunahólfs eru til í hverjum mánuði, svo engin röð = lesturinn brást
  // (aðgangsregla, rangur lykill — mælt 17.11.2026: RLS gaf []). Þá bregst fallið og SL-hliðin segir ómælt með ástæðu.
  if (!(gogn.timavera || []).length) throw new Error('Tímaveru-lesturinn skilaði engu');
  if (!(gogn.ajour || []).length) throw new Error('Ajour-lesturinn skilaði engu');
  if (!(gogn.paydayBh || []).length) throw new Error('Greiðslulesturinn skilaði engu');
  const bh = R.brunaholf(per, gogn);
  const kr = (x) => Math.round(x);
  return {
    per,
    man: per.map((p, i) => ({
      fra: p.fra, til: p.til, heiti: p.heiti,
      unnid: kr(bh.virdi[i]), greitt: kr(bh.greitt[i]), greitt_n: bh.greittN[i],
      unnid_hlutar: { tima: kr(bh.tima[i]), landspitali: kr(bh.lshV[i]), heklureitur: kr(bh.hekV[i]) },
      klst: Math.round(bh.klst[i] * 10) / 10, got: bh.got[i],
    })),
    ferskleiki,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return RS._svar(405, { villa: 'Aðeins GET' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return RS._svar(500, { villa: 'Supabase vantar' });
  let n;
  try { n = await RS._notandi(event); } catch (e) { return RS._hafnad(502); }
  if (n.villa) return RS._hafnad(n.villa);
  if (!n.stjornandi) return RS._hafnad(403);
  const idag = new Date().toISOString().slice(0, 10);
  try {
    // Innheimtan er sjálfstæð heimild: bregðist hún eru mánuðirnir samt skilaðir (innheimta: { omaelt }) — aldrei 0.
    const [m, inn] = await Promise.all([
      manudir(idag),
      innheimtaBh(idag).catch((e) => ({ omaelt: 'Innheimta Brunahólfs náðist ekki' })),
    ]);
    return RS._svar(200, { idag, man: m.man, innheimta: inn, ferskleiki: m.ferskleiki, innheimta_regla: { fra: INNHEIMTA_FRA }, sott: new Date().toISOString() });
  } catch (e) {
    return RS._svar(502, { villa: 'Gögn náðust ekki: ' + String(e.message || e).slice(0, 200) });
  }
};
exports._manudir = manudir;
