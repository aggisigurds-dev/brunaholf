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
  const [fy, cb] = await Promise.all([
    allt('fyrirtaeki', 'id,nafn,kennitala', '&deleted_at=is.null&kennitala=not.is.null'),
    allt('customers_base', 'id,nafn,kennitala', '&kennitala=not.is.null'),
  ]);
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
    _athugasemd: 'GENERATED af tools/felog-saekja.cjs — aðeins lögaðilar (kt 4–7…). [kt, nafn, uppruni c=customers_base f=fyrirtaeki, id]. ALDREI í git (data/.gitignore).',
    fjoldi: felog.length,
    felog,
  };
  const kts = new Set(felog.map(f => f[0])).size;
  if (dry) { console.log(`[dry] ${felog.length} nöfn, ${kts} kennitölur (fyrirtaeki ${fy.length}, customers_base ${cb.length}; ${einst} raðir einstaklinga sleppt)`); return; }
  fs.mkdirSync(path.dirname(UT), { recursive: true });
  fs.writeFileSync(UT, JSON.stringify(ut) + '\n');
  console.log(`✅ data/felog.json: ${felog.length} nöfn, ${kts} kennitölur (fyrirtaeki ${fy.length}, customers_base ${cb.length}; ${einst} raðir einstaklinga sleppt)`);
})().catch(e => { console.error('VILLA:', e.message); process.exit(1); });
