// Verkflæðisskrár: engin tóm eða óheil GitHub-segð (lota 9 umferð 2, 17.11.2026; sama próf og í slokkvitaeki).
// 17.11.2026 05:07–06:13 féll ÖLL deploy.yml ('workflow file issue') af því athugasemd inni í run-blokk innihélt
// tóma segð (dollaramerki + tvöfaldir slaufusvigar með engu á milli). GitHub metur segðir líka í skeljarathugasemdum,
// svo morgunbirtingin kl. 06:10 keyrði ekki (lagað í 349f82d0). Þetta próf les hverja verkflæðisskrá og fellur á:
//   - tómri segð,
//   - segð sem opnast en lokast ekki í sömu línu.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const MAPPA = path.join(__dirname, '..', '.github', 'workflows');
const OPNA = '$' + '{{';

function gallar(texti) {
  const ut = [];
  texti.replace(/\r\n/g, '\n').split('\n').forEach((lina, i) => {
    let k = 0;
    while ((k = lina.indexOf(OPNA, k)) > -1) {
      const lok = lina.indexOf('}}', k + 3);
      if (lok < 0) { ut.push((i + 1) + ': segð lokast ekki'); break; }
      if (!lina.slice(k + 3, lok).trim()) ut.push((i + 1) + ': tóm segð');
      k = lok + 2;
    }
  });
  return ut;
}

test('verkflæðisskrár hafa enga tóma eða óheila GitHub-segð', () => {
  const skrar = fs.readdirSync(MAPPA).filter(f => /\.ya?ml$/.test(f));
  assert.ok(skrar.length > 0, 'engin verkflæðisskrá fannst');
  const brot = [];
  for (const f of skrar) for (const g of gallar(fs.readFileSync(path.join(MAPPA, f), 'utf8'))) brot.push(f + ':' + g);
  assert.deepStrictEqual(brot, []);
});

test('prófið grípur gallann frá 17.11.2026 (tóm segð í skeljarathugasemd)', () => {
  const slaem = '        run: |\n          # Skilaboðin koma um env (ekki ' + OPNA + ' }} í skelinni)\n          echo ok\n';
  assert.deepStrictEqual(gallar(slaem), ['2: tóm segð']);
  assert.deepStrictEqual(gallar('x: ' + OPNA + ' github.event_name'), ['1: segð lokast ekki']);
  assert.deepStrictEqual(gallar('if: ' + OPNA + ' github.event_name }} == x'), []);
});
