// taekjalaus-tillogur.js — TILLÖGULISTI: þjónustufyrirtæki sem eiga reikninga en ENGIN tæki skráð.
// LES EINGÖNGU. Skrifar ekkert í gagnagrunn og býr ekki til nein tæki — listinn er til samþykktar.
//
//   GET /api/taekjalaus-tillogur            → { generated_at, forsendur, counts, fyrirtaeki:[…] }
//   GET /api/taekjalaus-tillogur?texti=1    → sami listi sem læsilegur texti (dagsetningar DD/MM/YYYY)
//
// AF HVERJU ÞETTA ER TIL (verkefnalisti 26375c05, 29.10.2026)
// Húnar ehf. (reikningur R-106989) átti reikning í gamla Stólpa-kerfinu en 0 tæki í `uttaeki`, því
// reikningurinn fór aldrei gegnum söluflæði appsins sem býr annars til tæki. Mæling 11.09.2026: 215
// fyrirtæki með reikninga en engin tæki, 10 þeirra í þjónustu. Hér eru þau sem EIGA að vera með tæki:
// fyrirtæki í þjónustu (er_i_thjonustu, ekki eytt) með a.m.k. eitt reikningsskjal og engin virk tæki
// (status ≠ 'urelt' — sama regla og Ársskoðun/para-rekstrarfelag: í notkun = allt nema 'urelt').
//
// HEIMILDIR REIKNINGSLÍNA (sama skipting og para-rekstrarfelag.js):
//   • Stólpi (R-1xxxxx)  → reikningslestur + reikningslinur (thjonusta: hledsla|yfirferd|nytt|annad, tegund)
//   • Appið  (R-000xxx)  → solur.linur (texti í `desc`, flokkaður hér) — salan ræður sé reikningur í báðum
//
// HVERNIG TILLAGAN ER REIKNUÐ (per tegund tækis, kredit-nótur dregnar frá samsvarandi línu):
//   skoðuð(ár) = Σ yfirferð + hleðsla það ár    ný = Σ „Slökkvitæki …“-línur (hver sala = ný tæki)
//   lágmark = max(stærsta skoðaða ár, Σ ný)     hámark = stærsta skoðaða ár + Σ ný
//   Tillagan er LÁGMARKIÐ; hámarkið sýnir mögulega skörun (tæki sem var selt og síðar yfirfarið).
//   Reykskynjarar, CO₂ eftir þyngd (suðugas/áfyllingar), skilti og brunakerfi eru EKKI talin sem tæki.
//
// ÖRYGGI: engar kennitölur í úttaki (hvorki fyrirtækja né einstaklinga). Les með þjónustulykli.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Tegundir sem teljast tæki — `type`/`size` eru sömu gildi og í tækjaskránni (uttaeki) og taeki_tegundir.
const TEG = {
  lettvatn: { heiti: 'Léttvatn 6 L', type: 'Léttvatn', size: '6 L' },
  duft6:    { heiti: 'ABC Duft 6 kg', type: 'ABC Duft', size: '6 kg' },
  duft2:    { heiti: 'ABC Duft 2 kg', type: 'ABC Duft', size: '2 kg' },
  co2_5:    { heiti: 'CO₂ 5 kg', type: 'CO₂', size: '5 kg' },
  co2_2:    { heiti: 'CO₂ 2 kg', type: 'CO₂', size: '2 kg' },
  slanga:   { heiti: 'Brunaslanga', type: 'Brunaslanga', size: null },
  teppi:    { heiti: 'Eldvarnarteppi', type: 'Eldvarnarteppi', size: null },
  abf:      { heiti: 'ABF-tæki', type: 'ABF', size: null },
};
const THJ_STOLPI = { hledsla: 'hledsla', yfirferd: 'yfirferd', nytt: 'ny' };
const THJ_TEXTI = { ny: 'ný', hledsla: 'hleðsla', yfirferd: 'yfirferð' };

const FLOKKAR = {
  tillaga:       'Tillaga um tæki úr reikningslínum',
  rekstrarfelag: 'Aðrir staðir sama félags eiga tæki — kanna hvort tækin séu skráð þar',
  olesid:        'Engar nothæfar reikningslínur (reikningar ólesnir eða án lína) — lesa fyrst',
  co2_gas:       'Aðeins CO₂ eftir þyngd (gas/áfyllingar) — ekki talið sem slökkvitæki',
  brunakerfi:    'Aðeins brunakerfi (eftirlit) — engin slökkvitæki á reikningum',
  reykskynjarar: 'Aðeins reykskynjarar — ekki skráðir sem tæki í tillögu',
  aukahlutir:    'Aðeins skilti/aukahlutir — engin tæki á reikningum',
  annad:         'Reikningar án tækja í línum — kanna handvirkt',
};

/* ───────────────────────── Supabase (les-eingöngu) ───────────────────────── */

function cors() { return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,OPTIONS' }; }
function json(code, body) { return { statusCode: code, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, cors()), body: JSON.stringify(body) }; }
function text(code, body) { return { statusCode: code, headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, cors()), body }; }
function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }

// Blaðsíðuskipt GET (1000 raðir í einu). ALLTAF með order= svo síður skarist ekki.
async function sbGet(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders({ Range: `${from}-${from + 999}` }) });
    if (!r.ok) throw new Error(path.split('?')[0] + ' → HTTP ' + r.status + ' ' + (await r.text()).slice(0, 140));
    const rows = await r.json().catch(() => []);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
// col=in.(…) í bútum svo slóðin verði aldrei of löng.
async function sbIn(table, col, values, rest) {
  const vals = Array.from(new Set(values)).filter(v => v !== null && v !== undefined);
  const hlutar = [];
  for (let i = 0; i < vals.length; i += 60) hlutar.push(vals.slice(i, i + 60));
  const svor = await Promise.all(hlutar.map(h => sbGet(`${table}?${col}=in.(${h.map(v => typeof v === 'number' ? v : '"' + encodeURIComponent(v) + '"').join(',')})&${rest}`)));
  return [].concat(...svor);
}

async function saekja() {
  const [fyr, docs, taeki] = await Promise.all([
    sbGet('fyrirtaeki?er_i_thjonustu=eq.true&deleted_at=is.null&select=id,nafn,heimilisfang,postnumer,status,customer_base_id&order=id'),
    sbGet('customer_documents?doc_type=eq.reikningur&fyrirtaeki_id=not.is.null&select=id,fyrirtaeki_id,invoice_number,doc_date,year,is_duplicate,amount,vidskiptategund,drive_file_id,storage_path&order=id'),
    sbGet('uttaeki?select=id,fyrirtaeki_id,status&order=id'),
  ]);
  // Frambjóðendur: í þjónustu, a.m.k. eitt reikningsskjal, engin virk tæki.
  const medSkjal = new Set(docs.map(d => d.fyrirtaeki_id));
  const virk = new Set(taeki.filter(t => t.status !== 'urelt').map(t => t.fyrirtaeki_id));
  const fram = fyr.filter(f => medSkjal.has(f.id) && !virk.has(f.id));
  const ids = fram.map(f => f.id);
  const bases = fram.map(f => f.customer_base_id);
  const idSet = new Set(ids);
  const nrs = Array.from(new Set(docs.filter(d => idSet.has(d.fyrirtaeki_id)).map(d => normNr(d.invoice_number)).filter(n => /^R-\d+$/.test(n || ''))));

  const LES = 'select=reikningur_nr,fyrirtaeki_id,dags,ar,kredit,stemmir,vegna&order=reikningur_nr';
  const SOL = 'select=id,num,customer_id,created_at,status,is_credit,source,vidskiptategund,linur&order=id';
  const [les1, les2, sol1, sol2, systkini] = await Promise.all([
    sbIn('reikningslestur', 'reikningur_nr', nrs, LES),
    sbIn('reikningslestur', 'fyrirtaeki_id', ids, LES),
    sbIn('solur', 'customer_id', ids, SOL),
    sbIn('solur', 'num', nrs, SOL),
    sbIn('fyrirtaeki', 'customer_base_id', bases, 'deleted_at=is.null&select=id,nafn,customer_base_id&order=id'),
  ]);
  const lestur = dedupe(les1.concat(les2), r => r.reikningur_nr);
  const solur = dedupe(sol1.concat(sol2), r => r.id);
  const [linur, annarra] = await Promise.all([
    sbIn('reikningslinur', 'reikningur_nr', lestur.map(l => l.reikningur_nr), 'select=reikningur_nr,linu_nr,lysing,magn,thjonusta,tegund&order=id'),
    // nöfn fyrirtækja sem salan er skráð á í stað skjalsins (líka eydd) — svo misræmið sé læsilegt
    sbIn('fyrirtaeki', 'id', solur.map(s => s.customer_id).filter(i => !idSet.has(i)), 'select=id,nafn,deleted_at&order=id'),
  ]);
  return { fyr, docs, taeki, lestur, linur, solur, systkini, annarra };
}

/* ───────────────────────── flokkun lína ───────────────────────── */

function dedupe(rows, lykill) { const s = new Set(); return rows.filter(r => { const k = lykill(r); if (s.has(k)) return false; s.add(k); return true; }); }
function normNr(s) { const t = String(s || '').trim(); const m = /^R[-\s]*(\d+)$/i.exec(t); return m ? 'R-' + m[1] : (t || null); }
function dags10(v) { return v ? String(v).slice(0, 10) : null; }
function dmy(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '—'; }

function thjUrTexta(t) {
  if (/yfirfer/.test(t)) return 'yfirferd';
  if (/hleðsl|hledsl|áfyll/.test(t)) return 'hledsla';
  if (/slökkvitæki|slokkvitaeki/.test(t)) return 'ny';
  return null;
}

// Texti línu → { kind: taeki|reyk|co2_gas|brunakerfi|aukahlutur|annad, … }. Aukahlutir fyrst: „Skilti … Slökkvitæki“,
// „Skipafesting fyrir 6 kg. Slökkvitæki“ og „V-merki slökkvitæki“ eru EKKI tæki þótt orðið standi þar.
function textaLina(desc, qty) {
  const t = String(desc || '').toLowerCase();
  if (/skilti|límmiði|merki|festing|o-hringur|slanga fyrir|handfang|þrýstimæl/.test(t)) return { kind: 'aukahlutur', qty };
  if (/brunakerf|brunaviðvör|^skoðun á |skoðunarskýrslu|boðbúnað|handboð/.test(t)) return { kind: 'brunakerfi', qty };
  if (/rey[k]?skynj/.test(t)) return { kind: 'reyk', qty };
  if (/co₂|co2|kolsýr/.test(t)) {
    if (/byrjunargjald/.test(t)) return { kind: 'co2_gas', kg: 0, byrjun: qty };
    if (/100 ?gr/.test(t)) return { kind: 'co2_gas', kg: qty / 10, byrjun: 0 };
    const m = /(\d+)\s*kg/.exec(t), stk = m ? +m[1] : 0, thj = thjUrTexta(t);
    if ((stk === 2 || stk === 5) && thj) return { kind: 'taeki', tegund: stk === 5 ? 'co2_5' : 'co2_2', thj, qty };
    return { kind: 'co2_gas', kg: stk * qty, byrjun: 0 };   // 9/10 kg áfyllingar = iðnaðargas, ekki slökkvitæki
  }
  let tegund = null;
  if (/duft/.test(t)) tegund = /duft\s*2\b/.test(t) ? 'duft2' : 'duft6';
  else if (/l[eé]ttvatn/.test(t)) tegund = 'lettvatn';
  else if (/\babf\b|froða/.test(t)) tegund = 'abf';
  else if (/brunaslang/.test(t)) tegund = 'slanga';
  else if (/teppi/.test(t)) tegund = 'teppi';
  const thj = thjUrTexta(t) || (tegund === 'teppi' ? 'ny' : null);   // teppi er selt sem vara án orðsins „Slökkvitæki“
  if (tegund && thj) return { kind: 'taeki', tegund, thj, qty };
  return { kind: 'annad', qty };
}
// Stólpa-lína: tegund/thjonusta eru þegar flokkuð við lestur PDF (reikningslinur); ‚annad‘ fer gegnum textann.
function linaUrStolpa(l) {
  const qty = Number(l.magn) || 0, thj = THJ_STOLPI[l.thjonusta];
  if (thj && l.tegund === 'co2_kg') return { kind: 'co2_gas', kg: qty, byrjun: 0 };
  if (thj && l.tegund === 'reyk') return { kind: 'reyk', qty };
  if (thj && TEG[l.tegund]) return { kind: 'taeki', tegund: l.tegund, thj, qty };
  return textaLina(l.lysing, qty);
}
function linaUrSolu(l) { return textaLina(l.desc || l.lysing, Number(l.qty != null ? l.qty : l.magn) || 0); }
function muna(l) { l.orig = l.qty; return l; }   // upprunalegt magn — kredit-jöfnun breytir qty

/* ───────────────────────── smíði tillögu ───────────────────────── */

function byggja(g, nu) {
  nu = nu || new Date();
  const iAr = nu.getFullYear();
  const taekiFid = {};   // fyrirtaeki_id → fjöldi virkra tækja (til að þekkja systkini sem eiga tæki)
  g.taeki.forEach(t => { if (t.status !== 'urelt') taekiFid[t.fyrirtaeki_id] = (taekiFid[t.fyrirtaeki_id] || 0) + 1; });
  const medSkjal = new Set(g.docs.map(d => d.fyrirtaeki_id));
  const fram = g.fyr.filter(f => medSkjal.has(f.id) && !taekiFid[f.id]);

  const lesturNr = {}; g.lestur.forEach(l => { lesturNr[l.reikningur_nr] = l; });
  const linurNr = {}; g.linur.forEach(l => { (linurNr[l.reikningur_nr] = linurNr[l.reikningur_nr] || []).push(l); });
  const solurNum = {}; g.solur.forEach(s => { solurNum[s.num] = s; });

  const fyrirtaeki = fram.map(f => {
    const athug = [];
    const skjol = g.docs.filter(d => d.fyrirtaeki_id === f.id);
    const ekkiTvitak = skjol.filter(d => !d.is_duplicate);
    const inv = new Map();   // reikningsnúmer → reikningur
    const anNumers = [];
    const nyr = (nr, grunnur) => { if (!inv.has(nr)) inv.set(nr, Object.assign({ nr, uppruni: null, stada: null, dags: null, ar: null, upphaed: null, vt: null, kredit: false, linur: [] }, grunnur)); return inv.get(nr); };

    ekkiTvitak.forEach(d => {
      const nr = normNr(d.invoice_number);
      if (!nr) { anNumers.push({ upphaed: d.amount != null ? Number(d.amount) : null, dags: d.doc_date || null, vt: d.vidskiptategund || null }); return; }
      const r = nyr(nr, { dags: d.doc_date || null, ar: d.year || null, vt: d.vidskiptategund || null, upphaed: d.amount != null ? Number(d.amount) : null, medPdf: !!d.drive_file_id || !!d.storage_path });
      if (!r.dags && d.doc_date) r.dags = d.doc_date;
    });
    // lestur/sala sem tilheyra fyrirtækinu en eiga ekki skjal hér
    g.lestur.filter(l => l.fyrirtaeki_id === f.id).forEach(l => nyr(l.reikningur_nr, {}));
    g.solur.filter(s => s.customer_id === f.id).forEach(s => nyr(s.num, {}));

    inv.forEach(r => {
      const s = solurNum[r.nr], l = lesturNr[r.nr];
      if (s) {
        r.uppruni = 'app'; r.dags = dags10(s.created_at) || r.dags; r.kredit = !!s.is_credit;
        if (s.status === 'void') r.stada = 'felldur';
        else if (s.status !== 'final') r.stada = 'drog';
        else if (s.customer_id !== f.id) {
          const o = (g.annarra || []).find(x => x.id === s.customer_id);
          r.stada = 'annar_vidskiptavinur';
          athug.push(r.nr + ' er skráður á ' + (o ? '„' + o.nafn + '“ (#' + o.id + (o.deleted_at ? ', eytt' : '') + ')' : 'fyrirtæki #' + s.customer_id) + ' í sölukerfinu en skjalið á þetta fyrirtæki — ekki talinn með');
        }
        else { r.stada = 'talinn'; r.linur = (Array.isArray(s.linur) ? s.linur : []).map(linaUrSolu).map(muna); }
      } else if (l) {
        r.uppruni = 'stolpi'; r.dags = l.dags || r.dags; r.kredit = !!l.kredit;
        if (l.stemmir === false) { r.stada = 'stemmir_ekki'; athug.push(r.nr + ' stemmir ekki við upphæð í lestri — ekki talinn með'); }
        else if (!(linurNr[r.nr] || []).length) r.stada = 'olesinn';   // lestur án lína (t.d. skönnuð PDF)
        else { r.stada = 'talinn'; r.linur = linurNr[r.nr].map(linaUrStolpa).map(muna); }
      } else {
        r.uppruni = /^R-1\d{5}$/.test(r.nr) ? 'stolpi' : (/^R-0\d{5}$/.test(r.nr) ? 'app' : 'annad');
        r.stada = 'olesinn';
      }
      r.dags = dags10(r.dags);
      r.ar = r.dags ? +r.dags.slice(0, 4) : (r.ar || null);
    });

    // KREDIT-NÓTUR: hver neikvæð tækjalína dregst frá nýjustu eldri jákvæðu línu sömu tegundar og þjónustu.
    const talin = Array.from(inv.values()).filter(r => r.stada === 'talinn').sort((a, b) => String(a.dags || '').localeCompare(String(b.dags || '')) || a.nr.localeCompare(b.nr));
    talin.forEach(k => {
      k.linur.filter(l => (l.kind === 'taeki' || l.kind === 'reyk') && l.qty < 0).forEach(l => {
        let thorf = -l.qty;
        talin.slice().reverse().forEach(o => {
          if (thorf <= 0 || o === k || String(o.dags || '') > String(k.dags || '9999')) return;
          o.linur.forEach(x => { if (thorf > 0 && x.kind === l.kind && x.tegund === l.tegund && x.thj === l.thj && x.qty > 0) { const d = Math.min(x.qty, thorf); x.qty -= d; thorf -= d; } });
        });
        if (thorf > 0) athug.push(k.nr + ' (kredit) dregur frá ' + thorf + ' ' + (l.tegund ? TEG[l.tegund].heiti : 'reykskynjara') + ' sem finnast ekki á eldri reikningi');
        l.qty = 0;
      });
    });

    // SAMANTEKT
    const per = {};   // tegund → { skodud:{ár:{n,nr:[]}}, ny:{n,nr:[]} }
    const reyk = { n: 0 }, gas = { kg: 0, byrjun: 0, nr: new Set() }, flokkur = { brunakerfi: 0, aukahlutur: 0 };
    let sidasta = null;
    talin.forEach(r => {
      r.linur.forEach(l => {
        if (l.kind === 'taeki' && l.qty > 0) {
          const p = per[l.tegund] = per[l.tegund] || { skodud: {}, ny: { n: 0, nr: [] } };
          if (l.thj === 'ny') { p.ny.n += l.qty; if (!p.ny.nr.includes(r.nr)) p.ny.nr.push(r.nr); }
          else { const a = p.skodud[r.ar || 0] = p.skodud[r.ar || 0] || { n: 0, nr: [] }; a.n += l.qty; if (!a.nr.includes(r.nr)) a.nr.push(r.nr); }
          if (r.dags && (!sidasta || r.dags > sidasta)) sidasta = r.dags;
        } else if (l.kind === 'reyk') reyk.n += l.qty;
        else if (l.kind === 'co2_gas') { gas.kg += l.kg || 0; gas.byrjun += l.byrjun || 0; gas.nr.add(r.nr); }
        else if (l.kind === 'brunakerfi' || l.kind === 'aukahlutur') flokkur[l.kind] += 1;
      });
    });
    const tillaga = Object.keys(TEG).filter(t => per[t]).map(t => {
      const ar = Object.keys(per[t].skodud).map(Number).sort((a, b) => a - b);
      const stor = ar.reduce((m, y) => per[t].skodud[y].n > m.n ? { y, n: per[t].skodud[y].n } : m, { y: null, n: 0 });
      const lag = Math.max(stor.n, per[t].ny.n), ham = stor.n + per[t].ny.n;
      return {
        tegund: t, heiti: TEG[t].heiti, uttaeki_type: TEG[t].type, uttaeki_size: TEG[t].size, fjoldi: lag, hamark: ham,
        byggt_a: [
          ar.filter(y => per[t].skodud[y].n > 0).map(y => 'skoðuð ' + (y || 'óþekkt ár') + ': ' + per[t].skodud[y].n + ' (' + per[t].skodud[y].nr.join(', ') + ')').join(' · '),
          per[t].ny.n ? 'ný alls: ' + per[t].ny.n + ' (' + per[t].ny.nr.join(', ') + ')' : '',
        ].filter(Boolean).join(' · '),
      };
    }).filter(x => x.fjoldi > 0);

    // SYSTKINI (sama customer_base_id) sem eiga virk tæki — tækin gætu verið skráð á öðrum stað félagsins
    const systkini = f.customer_base_id ? g.systkini.filter(s => s.customer_base_id === f.customer_base_id && s.id !== f.id && taekiFid[s.id]).map(s => ({ id: s.id, nafn: s.nafn, taeki: taekiFid[s.id] })) : [];

    const reikningar = Array.from(inv.values()).sort((a, b) => String(a.dags || '').localeCompare(String(b.dags || '')) || a.nr.localeCompare(b.nr)).map(r => ({
      nr: r.nr, dags: r.dags, uppruni: r.uppruni, stada: r.stada, kredit: r.kredit || undefined, upphaed: r.upphaed, tegund_vidskipta: r.vt,
      efni: r.stada === 'talinn' ? efni(r.linur) : undefined,
    }));
    const olesnir = reikningar.filter(r => r.stada === 'olesinn');
    const OLESIN_SKYRING = { stolpi: 'Stólpa-PDF ólesin eða ekki á Drive', app: 'engin sala fannst í sölukerfinu', annad: 'óþekkt númerasnið og engar línur (sennilega Stólpi án PDF)' };
    Object.keys(OLESIN_SKYRING).forEach(u => {
      const l = olesnir.filter(r => r.uppruni === u);
      if (l.length) athug.push(l.length + ' reikningur án lína (' + l.map(r => r.nr + (r.upphaed != null ? ' ' + r.upphaed + ' kr' : '')).join(', ') + ') — ' + OLESIN_SKYRING[u]);
    });
    if (anNumers.length) athug.push(anNumers.length + ' reikningsskjal án reikningsnúmers (' + anNumers.map(x => (x.dags ? dmy(x.dags) : 'án dags.') + (x.upphaed != null ? ' ' + x.upphaed + ' kr' : '')).join('; ') + ')');
    if (tillaga.length && sidasta && (iAr - +sidasta.slice(0, 4)) >= 3) athug.push('nýjasta heimild er frá ' + dmy(sidasta) + ' — tæki gætu verið horfin');

    let flokk;
    const talid = reikningar.filter(r => r.stada === 'talinn').length;
    if (systkini.length) flokk = 'rekstrarfelag';
    else if (tillaga.length) flokk = 'tillaga';
    else if (!talid) flokk = 'olesid';
    else if (gas.nr.size) flokk = 'co2_gas';
    else if (flokkur.brunakerfi) flokk = 'brunakerfi';
    else if (reyk.n) flokk = 'reykskynjarar';
    else if (flokkur.aukahlutur) flokk = 'aukahlutir';
    else flokk = 'annad';
    // skjal merkt „brunakerfi“ án lína (t.d. reikningur án PDF) segir líka sína sögu
    if (flokk === 'olesid' && reikningar.length && reikningar.every(r => r.tegund_vidskipta === 'brunakerfi')) flokk = 'brunakerfi';

    // „sleppa“ aðeins ef hver einasti reikningur er útskýrður — ólesinn eða númerslaus reikningur gæti falið tæki
    const adgerd = flokk === 'tillaga' ? 'skra'
      : (flokk === 'rekstrarfelag' || flokk === 'olesid' || flokk === 'annad' || olesnir.length || anNumers.length) ? 'kanna' : 'sleppa';

    return {
      fyrirtaeki_id: f.id, nafn: f.nafn, heimilisfang: f.heimilisfang || null, postnumer: f.postnumer || null, customer_base_id: f.customer_base_id || null,
      stada_fyrirtaekis: f.status || null,
      flokkur: flokk, flokkur_texti: FLOKKAR[flokk],
      adgerd,
      tillaga, tillaga_taeki_alls: tillaga.reduce((s, x) => s + x.fjoldi, 0),
      ekki_talid: {
        reykskynjarar: reyk.n || undefined,
        co2_gas: gas.nr.size ? { kg: Math.round(gas.kg * 10) / 10, byrjunargjold: gas.byrjun, reikningar: Array.from(gas.nr) } : undefined,
      },
      systkini_med_taeki: systkini.length ? systkini : undefined,
      reikningar_alls: skjol.length, reikningar_ekki_tvitok: ekkiTvitak.length,
      reikningar, athugasemdir: athug,
    };
  });

  const rodun = { tillaga: 0, rekstrarfelag: 1, olesid: 2, annad: 3, co2_gas: 4, brunakerfi: 5, reykskynjarar: 6, aukahlutir: 7 };
  fyrirtaeki.sort((a, b) => rodun[a.flokkur] - rodun[b.flokkur] || a.nafn.localeCompare(b.nafn, 'is'));
  const eftirFlokki = {}, eftirAdgerd = {};
  fyrirtaeki.forEach(x => { eftirFlokki[x.flokkur] = (eftirFlokki[x.flokkur] || 0) + 1; eftirAdgerd[x.adgerd] = (eftirAdgerd[x.adgerd] || 0) + 1; });
  return {
    ok: true,
    generated_at: nu.toISOString(),
    les_eingongu: true,
    forsendur: 'Fyrirtæki í þjónustu (er_i_thjonustu, ekki eytt) með a.m.k. eitt reikningsskjal og engin virk tæki í uttaeki (status ≠ urelt). ' +
      'Tillaga per tegund = lágmark (stærsta skoðaða ár eða Σ ný, það stærra); hámark = skoðuð + ný. Kredit-nótur dregnar frá. ' +
      'Reykskynjarar, CO₂ eftir þyngd, skilti og brunakerfi eru ekki talin sem tæki. Ekkert er skráð fyrr en Agnar samþykkir listann.',
    counts: {
      fyrirtaeki_i_thjonustu_med_reikninga: g.fyr.filter(f => medSkjal.has(f.id)).length,
      an_taekja: fyrirtaeki.length,
      eftir_flokki: eftirFlokki, eftir_adgerd: eftirAdgerd,
      tillaga_taeki_alls: fyrirtaeki.reduce((s, x) => s + x.tillaga_taeki_alls, 0),
    },
    fyrirtaeki,
  };
}

// „4 × ABC Duft 6 kg hleðsla; 1 × ný …“ — stutt lýsing á því sem reikningur taldi fram
function efni(linur) {
  const s = {}, ut = [];
  let gas = 0, kg = 0, reyk = 0, bk = 0, ak = 0;
  linur.forEach(l => {
    if (l.kind === 'taeki' && l.qty > 0) { const k = l.tegund + '|' + l.thj; s[k] = (s[k] || 0) + l.qty; }
    else if (l.kind === 'co2_gas') { gas++; kg += l.kg || 0; }
    else if (l.kind === 'reyk') reyk += l.qty;
    else if (l.kind === 'brunakerfi') bk++;
    else if (l.kind === 'aukahlutur') ak++;
  });
  Object.keys(s).forEach(k => { const [t, th] = k.split('|'); ut.push(s[k] + ' × ' + TEG[t].heiti + ' ' + THJ_TEXTI[th]); });
  if (gas) ut.push('CO₂ gas ' + Math.round(kg * 10) / 10 + ' kg');
  if (reyk > 0) ut.push(reyk + ' × reykskynjari');
  if (bk) ut.push('brunakerfi');
  if (ak) ut.push('skilti/aukahlutir');
  if (!ut.length) {
    const taekja = linur.filter(l => (l.kind === 'taeki' || l.kind === 'reyk') && l.orig);
    if (taekja.some(l => l.orig < 0)) return 'kredit-nóta (dregin frá eldri reikningi)';
    if (taekja.length) return 'allt dregið frá með kredit-nótu';
  }
  return ut.join('; ') || 'engar tækjalínur';
}

/* ───────────────────────── læsilegur texti ───────────────────────── */

function textiUr(r) {
  const L = [];
  L.push('TÆKJALAUS ÞJÓNUSTUFYRIRTÆKI — TILLÖGULISTI TIL SAMÞYKKTAR (les-eingöngu, ekkert skráð)');
  L.push('Búinn til ' + dmy(r.generated_at.slice(0, 10)) + ' · ' + r.counts.an_taekja + ' fyrirtæki af ' + r.counts.fyrirtaeki_i_thjonustu_med_reikninga + ' í þjónustu með reikninga');
  L.push('Flokkar: ' + Object.keys(r.counts.eftir_flokki).map(k => FLOKKAR[k].split(' — ')[0] + ' ' + r.counts.eftir_flokki[k]).join(' · ') + ' · tillaga alls ' + r.counts.tillaga_taeki_alls + ' tæki');
  L.push('');
  r.fyrirtaeki.forEach(x => {
    L.push('#' + x.fyrirtaeki_id + ' ' + x.nafn + (x.heimilisfang ? ' · ' + x.heimilisfang : '') + (x.stada_fyrirtaekis && x.stada_fyrirtaekis !== 'virkur' ? ' · STAÐA: ' + x.stada_fyrirtaekis : '') + '  [' + x.flokkur_texti + ']');
    x.tillaga.forEach(t => L.push('    TILLAGA ' + t.fjoldi + ' × ' + t.heiti + (t.hamark > t.fjoldi ? ' (allt að ' + t.hamark + ')' : '') + ' — ' + t.byggt_a));
    if (x.systkini_med_taeki) L.push('    SYSTKINI MEÐ TÆKI: ' + x.systkini_med_taeki.map(s => s.nafn + ' (' + s.taeki + ')').join(', '));
    if (x.ekki_talid.co2_gas) L.push('    CO₂ gas (ekki talið): ' + x.ekki_talid.co2_gas.kg + ' kg · ' + x.ekki_talid.co2_gas.byrjunargjold + ' byrjunargjöld');
    if (x.ekki_talid.reykskynjarar) L.push('    Reykskynjarar (ekki talið): ' + x.ekki_talid.reykskynjarar);
    x.reikningar.forEach(rk => L.push('    ' + dmy(rk.dags) + ' ' + rk.nr + ' [' + (rk.uppruni || '?') + ', ' + rk.stada + ']' + (rk.upphaed != null ? ' ' + rk.upphaed + ' kr' : '') + (rk.efni ? ' — ' + rk.efni : '')));
    x.athugasemdir.forEach(a => L.push('    ATH: ' + a));
    L.push('');
  });
  return L.join('\n');
}

/* ───────────────────────── handler ───────────────────────── */

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  const p = event.queryStringParameters || {};
  try {
    const r = byggja(await saekja());
    return p.texti ? text(200, textiUr(r)) : json(200, r);
  } catch (e) {
    return json(502, { ok: false, error: String((e && e.message) || e) });
  }
};
exports._byggja = byggja;       // fyrir tools/-próf án nets
exports._textaLina = textaLina;
