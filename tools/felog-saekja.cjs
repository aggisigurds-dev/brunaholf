#!/usr/bin/env node
/* felog-saekja.cjs — sækir nöfn + kennitölur félaga (fyrirtaeki + customers_base) og skrifar
 * data/felog.json, sem tools/router.cjs notar til að þekkja fyrirtæki í prompti ÁN netkalls.
 *
 *   node tools/felog-saekja.cjs          sækir og skrifar data/felog.json
 *   node tools/felog-saekja.cjs --dry    sækir og prentar fjölda, skrifar ekkert
 *
 * Lesaðeins (GET um REST með anon-lyklinum úr slokkvitaeki/js/config.js). Aðeins LÖGAÐILAR
 * (kt sem byrjar á 4–7) fara í skrána — kt einstaklinga eru aldrei skrifaðar.
 * data/felog.json er í data/.gitignore: brunaholf birtir rót repósins (publish = "."), og
 * data/ er ekki lokað í netlify.toml, svo skráin má ALDREI fara í git.
 * Keyra aftur eftir stórar breytingar á fyrirtækjaskránni (vikulega dugar). */
'use strict';
const fs = require('fs');
const path = require('path');
const G = require('./_lotu-grunnur.cjs');

const UT = path.join(G.BH, 'data', 'felog.json');

async function allt(tafla, select, sia) {
  const k = G.keys();
  if (!k) throw new Error('Fann ekki SUPABASE_URL/KEY (slokkvitaeki/js/config.js)');
  const rows = [];
  for (let fra = 0; ; fra += 1000) {
    const r = await G.saekja(`${k.url}/rest/v1/${tafla}?select=${select}${sia || ''}&order=id.asc&limit=1000&offset=${fra}`, { headers: k.h }, 15000);
    if (!r.ok) throw new Error(`${tafla}: ${r.status || r.villa} ${(r.text || '').slice(0, 160)}`);
    rows.push(...r.json);
    if (r.json.length < 1000) break;
  }
  return rows;
}

(async () => {
  const dry = process.argv.includes('--dry');
  const [fy, cb, cc] = await Promise.all([
    allt('fyrirtaeki', 'id,nafn,kennitala,netfang,customer_base_id', '&deleted_at=is.null'),
    allt('customers_base', 'id,nafn,kennitala,netfang,contact_email', '&kennitala=not.is.null'),
    allt('charlize_contacts', 'id,kennitala,netfang,status', '&netfang=not.is.null&status=neq.rejected'),
  ]);
  // Netföng og lén → kt (05.11.2026, Agnar: signatúra með gudmundurs@benni.is þekktist ekki). Netfang gildir aðeins
  // þegar það vísar á EINA kt; lén aðeins þegar allar raðir þess eru á einni kt og það er ekki almennt pósthús.
  const cbKt = new Map(cb.map(r => [r.id, r.kennitala]));
  const ALMENN_LEN = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'yahoo.com', 'icloud.com', 'me.com', 'simnet.is',
    'internet.is', 'mi.is', 'visir.is', 'mmedia.is', 'vortex.is', 'centrum.is', 'islandia.is', 'hive.is', 'talnet.is', 'emax.is', 'eldklar.is', 'brunaholf.is']);
  const nfKt = new Map();
  const baeta = (nf, kt) => {
    nf = String(nf || '').trim().toLowerCase(); kt = G.ktSnid(kt);
    if (!nf.includes('@') || !kt || !G.ktLogadili(kt)) return;
    if (!nfKt.has(nf)) nfKt.set(nf, new Set());
    nfKt.get(nf).add(kt);
  };
  for (const r of cc) baeta(r.netfang, r.kennitala);
  for (const r of cb) { baeta(r.netfang, r.kennitala); baeta(r.contact_email, r.kennitala); }
  for (const r of fy) baeta(r.netfang, r.kennitala || cbKt.get(r.customer_base_id));
  const netfong = [], lenKt = new Map();
  for (const [nf, kts] of nfKt) {
    const dom = nf.split('@')[1];
    if (!lenKt.has(dom)) lenKt.set(dom, new Set());
    for (const kt of kts) lenKt.get(dom).add(kt);
    if (kts.size === 1) netfong.push([nf, [...kts][0]]);
  }
  const len = [...lenKt].filter(([dom, kts]) => kts.size === 1 && !ALMENN_LEN.has(dom)).map(([dom, kts]) => [dom, [...kts][0]]);
  const sed = new Set();
  const felog = [];
  let einst = 0;
  for (const [uppruni, rows] of [['c', cb], ['f', fy]]) {
    for (const r of rows) {
      const kt = G.ktSnid(r.kennitala);
      const nafn = String(r.nafn || '').replace(/\s+/g, ' ').trim();
      if (!kt || !nafn) continue;
      if (!G.ktLogadili(kt)) { einst++; continue; }
      const k = kt + '|' + nafn.toLowerCase();
      if (sed.has(k)) continue;
      sed.add(k);
      felog.push([kt, nafn, uppruni, r.id]);
    }
  }
  // Tómt svar er bilun (t.d. RLS), ekki „engin félög“ — skrifum þá ekki yfir gilda skrá.
  if (!felog.length) throw new Error(`0 félög komu til baka (fyrirtaeki ${fy.length}, customers_base ${cb.length}) — RLS eða lykill? Skrá ekki skrifuð.`);
  const ut = {
    generated: new Date().toISOString(),
    _athugasemd: 'GENERATED af tools/felog-saekja.cjs — aðeins lögaðilar (kt 4–7…). felog: [kt, nafn, uppruni c=customers_base f=fyrirtaeki, id]; netfong: [netfang, kt] (aðeins einkvæm); len: [lén, kt] (aðeins einkvæm, ekki almenn pósthús). ALDREI í git (data/.gitignore).',
    fjoldi: felog.length,
    felog,
    netfong,
    len,
  };
  const kts = new Set(felog.map(f => f[0])).size;
  const lysing = `${felog.length} nöfn, ${kts} kennitölur, ${netfong.length} netföng, ${len.length} lén (fyrirtaeki ${fy.length}, customers_base ${cb.length}, charlize_contacts ${cc.length}; ${einst} raðir einstaklinga sleppt)`;
  if (dry) { console.log(`[dry] ${lysing}`); return; }
  fs.mkdirSync(path.dirname(UT), { recursive: true });
  fs.writeFileSync(UT, JSON.stringify(ut) + '\n');
  console.log(`✅ data/felog.json: ${lysing}`);
})().catch(e => { console.error('VILLA:', e.message); process.exit(1); });
