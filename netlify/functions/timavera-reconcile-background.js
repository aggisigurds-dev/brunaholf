// timavera-reconcile-background.js — NÆTUR-SPEGLUN á Tímaveru-glugga aftur í tímann.
//
// AF HVERJU ÞETTA ER TIL (2026-08-07, beiðni 0138d239)
// `timavera-pull-background` keyrir á 2 tíma fresti með `days=3` — það heldur
// gögnunum ferskum en speglar aðeins síðustu tvo heilu dagana. Vinnufærslum er
// hins vegar breytt í tímaveru.is LÖNGU eftir á: staðfest dæmi er keyrsla
// 2026-07-31 sem sótti leiðrétta útgáfu af færslum frá 13. júlí — 18 daga gamalt.
// Þær breytingar fá nýjan `entry_key`, svo án speglunar á breiða glugganum sat
// gamla röðin eftir sem draugur og tvítaldist í Efnislista/Kröfuyfirliti.
//
// Þess vegna er þessi þunna umgjörð: EINU SINNI á sólarhring speglum við 60 daga
// aftur í tímann, sem þekur alltaf allan undanfarandi mánuð — tímabilið sem enn
// getur endað á reikningi. Engin rökfræði er afrituð, við köllum sama handler.
//
// Aðskilin frá tíðu keyrslunni VILJANDI: ef breiði glugginn skilar villu (t.d.
// ef Tímavera setur þak á dagafjölda í `/worklogs`) heldur 2-tíma keyrslan samt
// áfram að halda gögnunum ferskum. Ein biluð leið á ekki að fella hina.
//
// `?days=N` má nota til að keyra hana handvirkt með öðrum glugga.

const base = require('./timavera-pull.js');

exports.handler = async (event) => {
  const days = ((event && event.queryStringParameters) || {}).days || '60';
  return base.handler({
    ...(event || {}),
    httpMethod: 'GET',
    body: null,
    queryStringParameters: { days: String(days) },
  });
};
