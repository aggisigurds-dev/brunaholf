#!/usr/bin/env node
/* Ósend drög — er allt til sem þarf til að senda reikninginn? (Agnar 16.11.2026:
 * „Ertu með þá allar nauðsynlegar upplýsingar um viðskiptavini með ósendar kröfur í Kröfu yfirliti?")
 *
 *   node tools/osent-upplysingar.cjs            → tafla á skjá
 *   node tools/osent-upplysingar.cjs --json     → sama sem JSON
 *
 * LES AÐEINS (GET): /api/verkkaupar (listinn, sama „ósent" og þrep 2 í Kröfu yfirliti) og
 * /api/verkkaupar?name= per greiðanda. Reglurnar eru N.greidandaGat í netlify/functions/_vk-nytt.js
 * (próf: test/vk-nytt.test.js). Prentar aldrei netföng eða nöfn tengiliða — aðeins já / VANTAR.
 * Lagar ekkert: taxta, netfang og greiðanda ákveður Agnar (kunnaskra / rukkari).
 */
const path = require('path');
const N = require(path.join(__dirname, '..', 'netlify', 'functions', '_vk-nytt.js'));
const GRUNNUR = process.env.BH_BASE || 'https://brunaholf.netlify.app';
const kr = (n) => Math.round(Number(n) || 0).toLocaleString('de-DE');

async function saekja(slod) {
  const r = await fetch(GRUNNUR + slod, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(slod + ' → ' + r.status);
  return r.json();
}

(async () => {
  const listi = (await saekja('/api/verkkaupar')).rows || [];
  const osent = listi.filter((r) => (Number(r.osent) || 0) > 0).sort((a, b) => b.osent - a.osent);
  const ut = [];
  for (const r of osent) {
    const p = await saekja('/api/verkkaupar?name=' + encodeURIComponent(r.name));
    ut.push({ nafn: r.name, kt: r.kt || '', osent: Math.round(r.osent), drog: (p.drog || []).length, gat: N.greidandaGat(p) });
  }
  const alls = ut.reduce((s, x) => s + x.osent, 0);
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ alls, greidendur: ut }, null, 2)); return; }
  const ja = (b) => (b ? 'já' : 'VANTAR');
  console.log(`Ósend drög: ${kr(alls)} kr · ${ut.length} greiðendur · ${ut.filter((x) => x.gat.i_lagi).length} með allt til\n`);
  for (const x of ut) {
    const g = x.gat;
    console.log(`${g.i_lagi ? '✓' : '✗'} ${x.nafn} · ${kr(x.osent)} kr (${x.drog} drög)`);
    console.log(`    kennitala ${ja(g.kennitala)} · netfang reiknings ${ja(g.netfang)} · Payday ${g.payday ? 'skráður' : 'EKKI SKRÁÐUR'} · heimilisfang ${ja(g.heimilisfang)}`);
    if (g.taxta_vantar.length) console.log(`    taxti ekki í verðskrá: ${g.taxta_vantar.join(', ')}`);
    for (const d of g.drog_vantar) console.log(`    drög ${d.verk} ${d.manudur}: vantar ${d.vantar.join(', ')}`);
    for (const m of g.heimilisfang_misraemi) console.log(`    heimilisfang stangast á (${m.verk} ${m.manudur}): drög „${m.drog}" · skráð „${m.skrad}"`);
  }
})().catch((e) => { console.error('Villa:', e.message); process.exit(1); });
