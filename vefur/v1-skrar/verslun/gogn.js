/* Gögn verslunarinnar: afrit af vörunum eins og þær voru 15.11.2026 (heiti, verð, lager) ásamt stillingum þessarar síðu.
   Verslunin teiknar sig úr þessu afriti og sækir svo lifandi vörur af /api/vefur-vorur (verslun/verslun.js, kaflinn
   „Lifandi vörur“): það sem stendur hér um vörur sést því aðeins andartak, eða þegar fallið næst ekki.
   sott        hvenær vöruskráin var lesin
   vorur       hver vara: id, nafn, flokkur, lysing, verd (með vsk), an (án vsk), birgdir, mynd (vv/v/<id>.webp) og
               ms (fingrafar myndarinnar í vöruskránni: breytist það sækir verslunin myndina þaðan)
   efni.vorur  vöruval: falid (faldar vörur), profill (vörur með ítarlega vörusíðu)
   efni.thema  litir, letur og horn verslunarinnar á þessari síðu (vanti það notar verslunin sín eigin)
   efni.m      myndir sem skipt var út og hvar ramminn sker þær (pos)
   efni.t      textar sem skipt var út
   Minnispunktar starfsfólks í vörulýsingum (birgjanúmer, birgjareikningar, innkaupsverð) eru ekki í afritinu, og
   fallið tekur þá líka úr lifandi lýsingum. Vöruskránni sjálfri er breytt í Slökkvitæki-kerfinu, ekki hér. */
window.BH_VV_GOGN = {
 "stada": "prufa",
 "sott": "2026-11-15T00:29:38.000Z",
 "efni": {
  "vorur": {
   "falid": [],
   "profill": {
    "2": true,
    "3": true,
    "4": true,
    "12": true,
    "13": true,
    "14": true,
    "18": true,
    "25": true,
    "174": true,
    "337": true,
    "338": true,
    "339": true,
    "340": true,
    "361": true,
    "437": true
   }
  },
  "m": {
   "forsida.hetja.mynd": {
    "src": "img/verslun-hetja.webp",
    "pos": "right"
   },
   "vara.18.veggur.mynd": {
    "src": "myndir/lv-veggur.jpg"
   },
   "vara.18.skref.2.mynd": {
    "src": "myndir/lv-skref-2.jpg"
   },
   "vara.174.veggur.mynd": {
    "src": "myndir/lv-veggur.jpg"
   },
   "vara.174.skref.2.mynd": {
    "src": "myndir/lv-skref-2.jpg"
   },
   "vara.not.mynd": {
    "pos": "right"
   },
   "vara.galleri.not": {
    "pos": "right"
   }
  },
  "t": {
   "bordi.merki": {
    "x": "Brunahólf slökkvitæki ehf."
   }
  }
 },
 "vorur": [
  {
   "id": 12,
   "nafn": "Duft 2 kg. ABC Slökkvitæki",
   "flokkur": "Slökkvitæki",
   "lysing": "",
   "verd": 8500,
   "an": 6855,
   "birgdir": 362,
   "mynd": "vv/v/12.webp",
   "ms": "65b97d7d1e97"
  },
  {
   "id": 1,
   "nafn": "Duft 6 kg. ABC Slökkvitæki",
   "flokkur": "Slökkvitæki",
   "lysing": "Fjölnota duftslökkvitæki – hentar fyrir flesta eldsvoða (A, B, C flokkar)",
   "verd": 13500,
   "an": 10887,
   "birgdir": 207,
   "mynd": "vv/v/1.webp",
   "ms": "dcc58f60c3d2"
  },
  {
   "id": 2,
   "nafn": "CO₂ 2 kg. Slökkvitæki",
   "flokkur": "Slökkvitæki",
   "lysing": "Koltvísýringsslökkvitæki – hentugt fyrir rafmagn og rafeindatæki\n\nKolsýra er gastegund sem ryður andrúmslofti í burtu og hefur því kæfandi áhrif.\nKolsýran er mjög köld (sirka -80°C) þegar hún kemur úr tækinu og hefur því einnig kælandi áhrif.\nKolsýra er besti slökkvimiðill sem fæst á rafmagnselda og hún skemmir ekki út frá sér, ólíkt dufti.\nFyrir utan hinn mikla kulda ryður kolsýra súrefni í burtu og er því hættuleg fólki, sér í lagi í litlum rýmum.\nÞá slekkur hún sömuleiðis illa glóð.",
   "verd": 16440,
   "an": 13258,
   "birgdir": 40,
   "mynd": "vv/v/2.webp",
   "ms": "4fcd1954a10c"
  },
  {
   "id": 25,
   "nafn": "CO₂ 5 kg. Slökkvitæki",
   "flokkur": "Slökkvitæki",
   "lysing": "Koltvísýringsslökkvitæki – fyrir rafmagn og rafeindatæki\n\nKolsýra er gastegund sem ryður andrúmslofti í burtu og hefur því kæfandi áhrif.\nKolsýran er mjög köld (sirka -80°C) þegar hún kemur úr tækinu og hefur því einnig kælandi áhrif.\nKolsýra er besti slökkvimiðill sem fæst á rafmagnselda og hún skemmir ekki út frá sér, ólíkt dufti.\nFyrir utan hinn mikla kulda ryður kolsýra súrefni í burtu og er því hættuleg fólki, sér í lagi í litlum rýmum.\nÞá slekkur hún sömuleiðis illa glóð.",
   "verd": 29500,
   "an": 23790,
   "birgdir": -1,
   "mynd": "vv/v/25.webp",
   "ms": "e70350664fdf"
  },
  {
   "id": 174,
   "nafn": "Léttvatn 2 kg. AB Slökkvitæki",
   "flokkur": "Slökkvitæki",
   "lysing": "Léttvatnsslökkvitæki henta vel á heimilin þar sem þau virka á A og B elda. A flokkur elda eru eldar sem kvikna í fatnaði, pappír, gúmmí, plasti, og timbri. B flokkur elda eru eldar sem kvikna í eldsneyti, olíu, og feiti",
   "verd": 11500,
   "an": 9274,
   "birgdir": 6,
   "mynd": "vv/v/174.webp",
   "ms": "6cb08a2597ab"
  },
  {
   "id": 18,
   "nafn": "Léttvatn 6 kg. AB Slökkvitæki",
   "flokkur": "Slökkvitæki",
   "lysing": "Helstu atriði vörunnar\nHentar vel til að bregðast hratt við þegar eldur kviknar á heimili eða vinnustað\n6 lítra rúmtak sem nýtist vel þar sem þörf er á meira slökkviefni við höndina\nVeggfesting fylgir, þannig að auðvelt er að koma tækinu fyrir á sýnilegum og aðgengilegum stað\nAuðvelt að hafa skipulag á eldvarnabúnaði í bílskúr, geymslu eða sameign\nLéttvatnsslökkvitæki með 6 L rúmtaki er ætlað til að vera tiltækt þegar grípa þarf inn í strax við eldsvoða. Með því að hafa slökkvitæki á föstum stað eykst öryggi og viðbragðstími styttist.\n\nSlökkvitækið kemur með veggfestingu sem auðveldar uppsetningu þar sem þú vilt hafa það við höndina, til dæmis í forstofu, bílskúr, geymslu eða á vinnusvæði. Gott er að velja stað sem er auðvelt að nálgast og sjá, svo tækið sé fljótt tiltækt þegar á þarf að halda.",
   "verd": 14480,
   "an": 11677,
   "birgdir": 244,
   "mynd": "vv/v/18.webp",
   "ms": "5c6bcbd7c359"
  },
  {
   "id": 437,
   "nafn": "KOLDIx 5L hylki",
   "flokkur": "Slökkvitæki",
   "lysing": "Kolsýruhylki 5 L frá Veldix.",
   "verd": 22900,
   "an": 18468,
   "birgdir": null,
   "mynd": "vv/v/437.webp",
   "ms": "0b4a200edf52"
  },
  {
   "id": 4,
   "nafn": "Eldvarnateppi 1m x 1m",
   "flokkur": "Eldvarnir",
   "lysing": "Glertrefjateppi í vegghengdu hylki, fyrir eldhús eða bílskúr",
   "verd": 3890,
   "an": 3137,
   "birgdir": 19,
   "mynd": "vv/v/4.webp",
   "ms": "c287136cbd39"
  },
  {
   "id": 340,
   "nafn": "Eldvarnarteppi CWS. hv.",
   "flokkur": "Eldvarnir",
   "lysing": "Eldvarnarteppi fyrir eldhús, 1x1 m. Vandað teppi frá viðurkenndum framleiðanda sem uppfyllir staðla. Kemur í tösku fyrir örugga geymslu.",
   "verd": 4990,
   "an": 4024,
   "birgdir": 4,
   "mynd": "vv/v/340.webp",
   "ms": "2ccbe32e0374"
  },
  {
   "id": 451,
   "nafn": "Ningbo Sjúkrataska grá",
   "flokkur": "Sjúkratöskur",
   "lysing": "Hentar vel í bifreiðina eða á heimilið\nLítil einföld sjúkrataska með ýmsum einföldum búnaði eins og plástrum, skærum, bindum o.fl.",
   "verd": 1995,
   "an": 1609,
   "birgdir": 5,
   "mynd": "vv/v/451.webp",
   "ms": "0cec2b0a5628"
  },
  {
   "id": 339,
   "nafn": "Ningbo Sjúkrataska rauð",
   "flokkur": "Sjúkratöskur",
   "lysing": "Lítil og einföld sjúkrataska með grunnbúnaði — plástrar, skæri, bindi ofl.",
   "verd": 1995,
   "an": 1609,
   "birgdir": 5,
   "mynd": "vv/v/339.webp",
   "ms": "fa9124238a36"
  },
  {
   "id": 453,
   "nafn": "Olympia áfylltur sjúkrakassi 1-10 manns",
   "flokkur": "Sjúkratöskur",
   "lysing": "Olympia sjúkrataska með búnaði fyrir 1-10 manns og veggfestingu. Tvískipt og hólfuð, ABS plast, appelsínugul. Stærð 270x190x115. Innihald m.a.: sáraböggla, grisjur, sárabindi, teygjubindi, plástra, hanska, skæri, flísatöng, munn við munn maska og vasaljós.",
   "verd": 10306,
   "an": 8311,
   "birgdir": 4,
   "mynd": "vv/v/453.webp",
   "ms": "2df42ed180cd"
  },
  {
   "id": 452,
   "nafn": "Fyrsta hjálp sjúkrakassi 11-30 manns",
   "flokkur": "Sjúkratöskur",
   "lysing": "Vegghengjanlegur sjúkrakassi með innihaldi fyrir 11-30 manns, 400x280x100 mm. Innihald m.a.: sáraumbúðir (steríl), brunateppi, álteppi, kælipokar, grisjurúllur, plástrar, hanskar, spelkur, skæri, munn við munn maski. 4 skrúfur til að hengja veggfestinguna fylgja.",
   "verd": 11573,
   "an": 9333,
   "birgdir": 4,
   "mynd": "vv/v/452.webp",
   "ms": "60712d8cfab5"
  },
  {
   "id": 338,
   "nafn": "Sjúkrakassi hvítur m/veggf. Spencer",
   "flokkur": "Sjúkratöskur",
   "lysing": "Veggfestur sjúkrakassi (Max PRO) með dauðhreinsuðum búnaði fyrir sáraskiptingu og neyð. Innihald m.a.: sótthreinsihanskar, sáravökvi 250 ml, joðófanlausn 10% 125 ml, grisjur, einnota pinsett, plástrar, teygjubindi, skæri, kælipoki og úrgangspoki.",
   "verd": 19950,
   "an": 16089,
   "birgdir": 2,
   "mynd": "vv/v/338.webp",
   "ms": "da099f655552"
  },
  {
   "id": 337,
   "nafn": "Sjúkrataska First Aid Combi",
   "flokkur": "Sjúkratöskur",
   "lysing": "Alhliða sjúkrataska til viðbragðs í neyð. Innihald m.a.: plástur, húð- og klórhexidínþurrkur, skurðumbúðir, þrýstiumbúðir, augnskol, grisjur, umbúðir, björgunarteppi og merkingar.",
   "verd": 28350,
   "an": 22863,
   "birgdir": 1,
   "mynd": "vv/v/337.webp",
   "ms": "028e3ce89fef"
  },
  {
   "id": 13,
   "nafn": "Reykskynjari 2",
   "flokkur": "Skynjarar og rafhlöður",
   "lysing": "",
   "verd": 2722,
   "an": 2195,
   "birgdir": 12,
   "mynd": "vv/v/13.webp",
   "ms": "1f4f3c9cb7b7"
  },
  {
   "id": 3,
   "nafn": "Reykskynjari",
   "flokkur": "Skynjarar og rafhlöður",
   "lysing": "10 ára rafhlaða, ljósmyndatækni, CE vottað",
   "verd": 4490,
   "an": 3621,
   "birgdir": 8,
   "mynd": "vv/v/3.webp",
   "ms": "d500220ee592"
  },
  {
   "id": 14,
   "nafn": "Reykskynjari 3",
   "flokkur": "Skynjarar og rafhlöður",
   "lysing": "",
   "verd": 6650,
   "an": 5363,
   "birgdir": 30,
   "mynd": "vv/v/14.webp",
   "ms": "986ebe19e974"
  },
  {
   "id": 449,
   "nafn": "Reykskynjari Zorro stakur",
   "flokkur": "Skynjarar og rafhlöður",
   "lysing": "Stakur reykskynjari, allt að 10 ára rafhlöðuending, 3M lím fylgir, skiptanleg rafhlaða (CR123A fylgir)",
   "verd": 4290,
   "an": 3460,
   "birgdir": 4,
   "mynd": "vv/v/449.webp",
   "ms": "d68acd7cd3d9"
  },
  {
   "id": 448,
   "nafn": "Reykskynjari Zorro Svartur Stakur",
   "flokkur": "Skynjarar og rafhlöður",
   "lysing": "Stakur reykskynjari svartur, allt að 10 ára rafhlöðuending, 3M lím fylgir",
   "verd": 4390,
   "an": 3540,
   "birgdir": 2,
   "mynd": "vv/v/448.webp",
   "ms": "1f067fe8731a"
  },
  {
   "id": 461,
   "nafn": "X-Sense snjall reykskynjari XS01-M",
   "flokkur": "Skynjarar og rafhlöður",
   "lysing": "Þráðlaus og samtengdur, allt að 24 skynjarar (500 m drægni) — ef einn fer í gang fara allir í gang. Snjallstýring í appi með SBS50 base stöð. 85 dB, 10 ára ending, skiptanleg lithium rafhlaða. EN 14604.",
   "verd": 6990,
   "an": 5637,
   "birgdir": 21,
   "mynd": "vv/v/461.webp",
   "ms": "44503fd40ddb"
  },
  {
   "id": 462,
   "nafn": "X-Sense Base stöð SBS50",
   "flokkur": "Skynjarar og rafhlöður",
   "lysing": "Tengir X-Sense kerfið við internetið svo tilkynningar berast í appið. Styður allt að 50 X-Sense skynjara.",
   "verd": 12990,
   "an": 10476,
   "birgdir": 3,
   "mynd": "vv/v/462.webp",
   "ms": "92e575df0419"
  },
  {
   "id": 463,
   "nafn": "X-Sense lekaskynjari SWS51",
   "flokkur": "Skynjarar og rafhlöður",
   "lysing": "Virkjast ef hann greinir vatn — bak við þvottavél, undir vaski eða við lagnagrind. Sendir tilkynningu í X-Sense appið (með SBS50). Rafhlöður fylgja.",
   "verd": 5990,
   "an": 4831,
   "birgdir": 6,
   "mynd": "vv/v/463.webp",
   "ms": "4be9763a366e"
  },
  {
   "id": 342,
   "nafn": "Gasskynjari Battery Kidde",
   "flokkur": "Skynjarar og rafhlöður",
   "lysing": "",
   "verd": 5990,
   "an": 4831,
   "birgdir": 8,
   "mynd": "vv/v/342.webp",
   "ms": "c00af2ffd880"
  },
  {
   "id": 195,
   "nafn": "Gasskynjari Zorro 230V",
   "flokkur": "Skynjarar og rafhlöður",
   "lysing": "GAS SKYNJARI\n\n- 85 dB hljóð styrkur\n\n- einfaldur í uppsetningu\n\n- nemur Proban og Metan gas CH4",
   "verd": 5990,
   "an": 4831,
   "birgdir": 1,
   "mynd": "vv/v/195.webp",
   "ms": "838cb04255e9"
  },
  {
   "id": 455,
   "nafn": "Standur fyrir eitt slökkvitæki m/merki",
   "flokkur": "Slökkvitækjafestingar",
   "lysing": "Gólfstandur fyrir eitt slökkvitæki, með merki",
   "verd": 7728,
   "an": 6232,
   "birgdir": 5,
   "mynd": "vv/v/455.webp",
   "ms": "abb537aa7b45"
  },
  {
   "id": 341,
   "nafn": "Skipafesting 5/6/12kg svört",
   "flokkur": "Slökkvitækjafestingar",
   "lysing": "",
   "verd": 7990,
   "an": 6444,
   "birgdir": 10,
   "mynd": "vv/v/341.webp",
   "ms": "67852f6ab074"
  },
  {
   "id": 113,
   "nafn": "Skipafesting fyrir 6 kg. Slökkvitæki",
   "flokkur": "Slökkvitækjafestingar",
   "lysing": "",
   "verd": 8634,
   "an": 6963,
   "birgdir": 40,
   "mynd": "vv/v/113.webp",
   "ms": "8efb20c40fd6"
  },
  {
   "id": 456,
   "nafn": "Merki Brunaboði 15x15",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "Sjálflýsandi 15x15 sm öryggismerki, Brunaboði",
   "verd": 1586,
   "an": 1279,
   "birgdir": 10,
   "mynd": "vv/v/456.webp",
   "ms": "1a1e4b38d1bc"
  },
  {
   "id": 457,
   "nafn": "Flóttamerki Gluggi 15x15",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "Sjálflýsandi 15x15 sm neyðarmerki, flóttagluggi",
   "verd": 4128,
   "an": 3329,
   "birgdir": 1,
   "mynd": "vv/v/457.webp",
   "ms": "944eb4ef9f28"
  },
  {
   "id": 458,
   "nafn": "Merki Flóttastigi 15x15",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "15x15 sm merki, stigi",
   "verd": 1586,
   "an": 1279,
   "birgdir": 1,
   "mynd": "vv/v/458.webp",
   "ms": "a5e55dc53e0c"
  },
  {
   "id": 459,
   "nafn": "Hurðaropnun merki hægri niður 10x10",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "Sjálflýsandi 10x10 sm merki „Down to open\", handfang hægri",
   "verd": 1893,
   "an": 1527,
   "birgdir": 1,
   "mynd": "vv/v/459.webp",
   "ms": "be8ad5115c5d"
  },
  {
   "id": 460,
   "nafn": "Hurðaropnun merki vinstri niður 10x10",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "Sjálflýsandi 10x10 sm merki „Down to open\", handfang vinstri",
   "verd": 1893,
   "an": 1527,
   "birgdir": 1,
   "mynd": "vv/v/460.webp",
   "ms": "b030e9fe9fad"
  },
  {
   "id": 387,
   "nafn": "Límmiði - Slökkvitæki - Sjálflýsandi 150x150mm",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "",
   "verd": 999,
   "an": 806,
   "birgdir": -4,
   "mynd": "vv/v/387.webp",
   "ms": "345f0f97eadf"
  },
  {
   "id": 86,
   "nafn": "Skilti Neyðarútgangur 120x340",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "",
   "verd": 5201,
   "an": 4194,
   "birgdir": 122,
   "mynd": "vv/v/86.webp",
   "ms": "329333bd4066"
  },
  {
   "id": 101,
   "nafn": "Skilti -L- Slökkvitæki - Sjálflýsandi 150x150mm",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "",
   "verd": 3500,
   "an": 2823,
   "birgdir": 56,
   "mynd": "vv/v/101.webp",
   "ms": "7351ee43e2df"
  },
  {
   "id": 102,
   "nafn": "V-merki Brunaslanga 15x15",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "Stærð\n150x340",
   "verd": 3958,
   "an": 3192,
   "birgdir": 361,
   "mynd": "vv/v/102.webp",
   "ms": "55e4b16dbe04"
  },
  {
   "id": 104,
   "nafn": "Skilti græn hörð - Sjálflýsandi 150x300",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "",
   "verd": 4635,
   "an": 3738,
   "birgdir": 3,
   "mynd": "vv/v/104.webp",
   "ms": "a650e8ab135f"
  },
  {
   "id": 140,
   "nafn": "Skilti Flöt - Slökkvitæki - Sjálflýsandi -150x150mm",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "",
   "verd": 1690,
   "an": 1363,
   "birgdir": -3,
   "mynd": "vv/v/140.webp",
   "ms": "0af07b095f2c"
  },
  {
   "id": 141,
   "nafn": "Skilti flöt - Brunaslanga - Sjálflýsandi -150x150mm",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "",
   "verd": 1690,
   "an": 1363,
   "birgdir": 193,
   "mynd": "vv/v/141.webp",
   "ms": "37f18adbd220"
  },
  {
   "id": 365,
   "nafn": "Neyðarhamar",
   "flokkur": "Ýmsar vörur",
   "lysing": "",
   "verd": 2990,
   "an": 2411,
   "birgdir": 10,
   "mynd": "vv/v/365.webp",
   "ms": "f3fb054f5fef"
  },
  {
   "id": 373,
   "nafn": "Skilti -L- Brunaslanga - Sjálflýsandi 150x150mm",
   "flokkur": "Skilti, ljós og miðar",
   "lysing": "",
   "verd": 3500,
   "an": 2823,
   "birgdir": 408,
   "mynd": "vv/v/373.webp",
   "ms": "d24073547eec"
  }
 ]
};
