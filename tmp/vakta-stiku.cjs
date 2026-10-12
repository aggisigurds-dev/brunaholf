const fs = require('fs');
const slod = 'https://brunaholf.netlify.app/api/app-state?key=hub_state';
const fingur = v => JSON.stringify((v.tabs || []).map(t => (t.sep ? 'S:' + (t.label || '') : t.id) + (t.hidden ? '!' : '')));
let sidast = null, sidastUpp = null, breytingar = 0;
const kl = () => new Date().toTimeString().slice(0, 8);

(async function lykkja(n) {
  for (let i = 0; i < n; i++) {
    try {
      const r = await fetch(slod, { cache: 'no-store' });
      const d = await r.json();
      const v = d.value || {};
      const f = fingur(v);
      const upp = v.ui && v.ui.updated_at;
      if (sidast === null) {
        console.log(kl() + '  grunnur settur · ui.updated_at=' + upp);
      } else if (f !== sidast) {
        breytingar++;
        console.log(kl() + '  ⚠ TABS BREYTTUST án þess að Agnar snerti — ui.updated_at ' + sidastUpp + ' → ' + upp);
      } else if (upp !== sidastUpp) {
        console.log(kl() + '  (ui.updated_at hreyfðist en tabs óbreytt: ' + upp + ')');
      }
      sidast = f; sidastUpp = upp;
    } catch (e) { console.log(kl() + '  villa: ' + e.message); }
    await new Promise(r => setTimeout(r, 20000));
  }
  console.log('\nLOKIÐ — tabs breyttust ' + breytingar + ' sinnum á vaktinni.');
  console.log(breytingar ? 'ÖNNUR VÉL ER AÐ SKRIFA.' : 'Engin önnur vél skrifaði á þessum tíma.');
})(10);
