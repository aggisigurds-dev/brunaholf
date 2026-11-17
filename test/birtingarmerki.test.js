// Birtingarmerkið virkar aðeins í FYRIRSÖGN commit-skilaboða (lota 9, 17.11.2026, Verkefnalisti 166530a8).
// 10.11.2026 birti lota báðar síður óvart: merkið stóð í meginmáli („Ekki [deploy] …") og netlify.toml las %B.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const toml = fs.readFileSync(path.join(__dirname, '..', 'netlify.toml'), 'utf8');
const ignore = (toml.match(/^\s*ignore\s*=\s*"(.*)"\s*$/m) || [])[1] || '';
const M = '[' + 'deploy' + ']';

test('netlify.toml: ignore les aðeins fyrirsögnina (%s), ekki öll skilaboðin (%B)', () => {
  assert.ok(ignore, 'ignore-reglan fannst ekki');
  assert.match(ignore, /git log -1 --pretty=%s\b/);
  assert.doesNotMatch(ignore, /%B/);
});

test('netlify.toml: regla keyrð á fyrirsögnum — byggir aðeins þegar merkið er í fyrirsögn', (t) => {
  const keyra = (fyrirsogn) => {
    const skip = ignore.replace(/git log -1 --pretty=%s/, 'printf "%s\\n" "$FYRIRSOGN"');
    const r = spawnSync('bash', ['-c', skip], { env: Object.assign({}, process.env, { FYRIRSOGN: fyrirsogn }), encoding: 'utf8' });
    if (r.error) { t.skip('bash ekki tiltækt'); return null; }
    return r.status;   // 1 = byggja, 0 = sleppa
  };
  const a = keyra(M + ' Birta lagfæringu');
  if (a === null) return;
  assert.strictEqual(a, 1, 'merki í fyrirsögn á að byggja');
  assert.strictEqual(keyra('Laga villu'), 0, 'án merkis á að sleppa');
});
