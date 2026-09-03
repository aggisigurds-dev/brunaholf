/* gr-materials.js — Verðskrá efnis (sama listi og /reikningur og Efnislistinn í Gerð reikninga).
   EIN heimild fyrir þrjá lesendur: index.html (Efnislisti, „+ bæta efni úr Verðskrá"),
   brunathettingar.html (verkstaða-appið, „Efni af lager") og netlify/functions/field-app.js.
   UMD: vafri → window.GR_MATERIALS, node → module.exports. Breyttu verðum HÉR, hvergi annars staðar. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GR_MATERIALS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return [
    { section:'Almennt', items:[
      {label:'Eldvarnar akríl',unit:'stk',price:1624},{label:'Eldvarnar Akríl 5kg',unit:'stk',price:14400},
      {label:'Háþennslukítti',unit:'stk',price:4489},{label:'Eldvarnar silikon',unit:'stk',price:2220},
      {label:'Eldvarnar steinull',unit:'plata',price:10703},{label:'Eldvarnar málning',unit:'líter',price:2500},
      {label:'Eldvarnar rúlla 55mm',unit:'stk',price:53574},
    ]},
    { section:'Eldvarnar band (mm)', items:[
      {label:'Band 55mm',unit:'stk',price:1621},{label:'Band 63mm',unit:'stk',price:3590},{label:'Band 75mm',unit:'stk',price:1236},
      {label:'Band 82mm',unit:'stk',price:1287},{label:'Band 90mm',unit:'stk',price:1556},{label:'Band 110mm',unit:'stk',price:2047},
      {label:'Band 125mm',unit:'stk',price:2628},{label:'Band 160mm',unit:'stk',price:4780},{label:'Band 200mm',unit:'stk',price:6025},
    ]},
    { section:'Eldvarnar kragi (mm)', items:[
      {label:'Kragi 32mm',unit:'stk',price:2821},{label:'Kragi 40mm',unit:'stk',price:3205},{label:'Kragi 55mm',unit:'stk',price:3308},
      {label:'Kragi 63mm',unit:'stk',price:3590},{label:'Kragi 75mm',unit:'stk',price:4103},{label:'Kragi 82mm',unit:'stk',price:4174},
      {label:'Kragi 90mm',unit:'stk',price:4719},{label:'Kragi 110mm',unit:'stk',price:4915},{label:'Kragi 125mm',unit:'stk',price:6260},
      {label:'Kragi 140mm',unit:'stk',price:8052},{label:'Kragi 160mm',unit:'stk',price:10191},{label:'Kragi 200mm',unit:'stk',price:18021},
      {label:'Kragi 250mm',unit:'stk',price:26792},{label:'Kragi 315mm',unit:'stk',price:151754},
    ]},
    { section:'Brunaþéttirör', items:[
      {label:'Brunaþéttirör 16mm',unit:'stk',price:6426},{label:'Brunaþéttirör 20mm',unit:'stk',price:6426},
      {label:'Brunaþéttirör 32mm',unit:'stk',price:8044},{label:'Brunaþéttirör 50mm',unit:'stk',price:9012},
      {label:'Brunaþéttirör PVC 32mm',unit:'stk',price:2498},{label:'Brunaþéttirör PVC 50mm',unit:'stk',price:2970},
    ]},
  ];
});
