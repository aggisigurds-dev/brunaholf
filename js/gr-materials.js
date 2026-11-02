/* gr-materials.js — Verðskrá efnis (sama listi og /reikningur og Efnislistinn í Gerð reikninga).
   EIN heimild fyrir þrjá lesendur: index.html (Efnislisti, „+ bæta efni úr Verðskrá"),
   brunathettingar.html (verkstaða-appið, „Efni af lager") og netlify/functions/field-app.js.
   UMD: vafri → window.GR_MATERIALS, node → module.exports. Breyttu verðum HÉR, hvergi annars staðar.
   02.11.2026 (Agnar: „put english words for the base material types"): `en` á kafla og atriði er AÐEINS
   birtingarheiti fyrir ensku útgáfu verkstaða-appsins — `label` er áfram lykillinn sem vistast (item_label)
   og skrifstofan les; `en` má vanta (fellur á label). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GR_MATERIALS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return [
    { section:'Almennt', en:'General', items:[
      {label:'Eldvarnar akríl',unit:'stk',price:1624,en:'Fire acrylic sealant (cartridge)'},{label:'Eldvarnar Akríl 5kg',unit:'stk',price:14400,en:'Fire acrylic sealant 5 kg'},
      {label:'Háþennslukítti',unit:'stk',price:4489,en:'Intumescent sealant (high-expansion)'},{label:'Eldvarnar silikon',unit:'stk',price:2220,en:'Fire silicone sealant'},
      {label:'Eldvarnar steinull',unit:'plata',price:10703,en:'Fire-rated mineral wool board'},{label:'Eldvarnar málning',unit:'líter',price:2500,en:'Fire-protection paint (ablative coating)'},
      {label:'Eldvarnar rúlla 55mm',unit:'stk',price:53574,en:'Intumescent wrap roll 55 mm (25 m)'},
      /* 15.10.2026 (Agnar): rúllan er 25 m og var aðeins seljanleg í heilu lagi,
         svo tveir metrar urðu annaðhvort 53.574 kr eða handskrifuð sérlína.
         MÆLT Í REDDER (redder_line_items, „Eldvarnarband PW á rúllu 2mm x 25M"):
         ein_verd 53.574,19 er FULLA verðið og afsl_pct 50 er okkar innkaup (26.787).
         Verðskráin ber því fulla verðið — lengdarmetrinn er 53.574,19 / 25 = 2.143 kr,
         ekki helmingurinn af því. Rúllan sjálf stendur óbreytt fyrir ofan. */
      {label:'Eldvarnar rúlla 55mm — lengdarmetri',unit:'m',price:2143,en:'Intumescent wrap 55 mm — per metre'},
    ]},
    { section:'Eldvarnar band (mm)', en:'Intumescent pipe wrap (mm)', items:[
      {label:'Band 55mm',unit:'stk',price:1621,en:'Pipe wrap 55 mm'},{label:'Band 63mm',unit:'stk',price:3590,en:'Pipe wrap 63 mm'},{label:'Band 75mm',unit:'stk',price:1236,en:'Pipe wrap 75 mm'},
      {label:'Band 82mm',unit:'stk',price:1287,en:'Pipe wrap 82 mm'},{label:'Band 90mm',unit:'stk',price:1556,en:'Pipe wrap 90 mm'},{label:'Band 110mm',unit:'stk',price:2047,en:'Pipe wrap 110 mm'},
      {label:'Band 125mm',unit:'stk',price:2628,en:'Pipe wrap 125 mm'},{label:'Band 160mm',unit:'stk',price:4780,en:'Pipe wrap 160 mm'},{label:'Band 200mm',unit:'stk',price:6025,en:'Pipe wrap 200 mm'},
    ]},
    { section:'Eldvarnar kragi (mm)', en:'Fire collars (mm)', items:[
      {label:'Kragi 32mm',unit:'stk',price:2821,en:'Fire collar 32 mm'},{label:'Kragi 40mm',unit:'stk',price:3205,en:'Fire collar 40 mm'},{label:'Kragi 55mm',unit:'stk',price:3308,en:'Fire collar 55 mm'},
      {label:'Kragi 63mm',unit:'stk',price:3590,en:'Fire collar 63 mm'},{label:'Kragi 75mm',unit:'stk',price:4103,en:'Fire collar 75 mm'},{label:'Kragi 82mm',unit:'stk',price:4174,en:'Fire collar 82 mm'},
      {label:'Kragi 90mm',unit:'stk',price:4719,en:'Fire collar 90 mm'},{label:'Kragi 110mm',unit:'stk',price:4915,en:'Fire collar 110 mm'},{label:'Kragi 125mm',unit:'stk',price:6260,en:'Fire collar 125 mm'},
      {label:'Kragi 140mm',unit:'stk',price:8052,en:'Fire collar 140 mm'},{label:'Kragi 160mm',unit:'stk',price:10191,en:'Fire collar 160 mm'},{label:'Kragi 200mm',unit:'stk',price:18021,en:'Fire collar 200 mm'},
      {label:'Kragi 250mm',unit:'stk',price:26792,en:'Fire collar 250 mm'},{label:'Kragi 315mm',unit:'stk',price:151754,en:'Fire collar 315 mm'},
    ]},
    { section:'Brunaþéttirör', en:'Fire-stop sleeves', items:[
      {label:'Brunaþéttirör 16mm',unit:'stk',price:6426,en:'Fire-stop sleeve 16 mm'},{label:'Brunaþéttirör 20mm',unit:'stk',price:6426,en:'Fire-stop sleeve 20 mm'},
      {label:'Brunaþéttirör 32mm',unit:'stk',price:8044,en:'Fire-stop sleeve 32 mm'},{label:'Brunaþéttirör 50mm',unit:'stk',price:9012,en:'Fire-stop sleeve 50 mm'},
      {label:'Brunaþéttirör PVC 32mm',unit:'stk',price:2498,en:'Fire-stop sleeve PVC 32 mm'},{label:'Brunaþéttirör PVC 50mm',unit:'stk',price:2970,en:'Fire-stop sleeve PVC 50 mm'},
    ]},
  ];
});
