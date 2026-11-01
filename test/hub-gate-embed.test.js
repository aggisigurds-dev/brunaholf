// Próf: innskráningarhliðið efst í index.html er sleppt AÐEINS þegar síðan er opnuð í ramma með ?embed=1 (Slökkvitækis-appið);
// beint í vafra og í ramma án embed=1 sendir óinnskráðan notanda á adgangar.html þegar kveikt er á hliðinu.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<style>html\.hub-gate-pending[^<]*<\/style>\s*<script>([\s\S]*?)<\/script>/);

async function runGate({ framed, search }) {
  const out = { fetched: 0, redirect: null, pending: false };
  const cls = new Set();
  const win = {};
  win.self = win;
  win.top = framed ? {} : win;
  const ctx = vm.createContext({
    window: win,
    document: { documentElement: { classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c) } } },
    location: { search, pathname: '/', hash: '#efniskostnadur', replace: (u) => { out.redirect = u; } },
    fetch: () => { out.fetched++; return Promise.resolve({ json: () => ({ gate: true, authed: false }) }); },
    setTimeout, clearTimeout, encodeURIComponent,
  });
  vm.runInContext(m[1], ctx);
  await new Promise((r) => setImmediate(r));
  out.pending = cls.has('hub-gate-pending');
  return out;
}

test('hliðið finnst efst í index.html', () => { assert.ok(m, 'gate-script fannst ekki'); });

test('í ramma með ?embed=1: hliðið er sleppt (engin fyrirspurn, engin tilvísun, síðan ekki falin)', async () => {
  const r = await runGate({ framed: true, search: '?embed=1' });
  assert.equal(r.fetched, 0);
  assert.equal(r.redirect, null);
  assert.equal(r.pending, false);
});

test('beint í vafra (ekki í ramma): óinnskráður er sendur á innskráningu, líka með ?embed=1', async () => {
  for (const search of ['', '?embed=1']) {
    const r = await runGate({ framed: false, search });
    assert.equal(r.fetched, 1, search);
    assert.match(r.redirect || '', /^\/adgangar\.html\?next=/, search);
  }
});

test('í ramma án embed=1: hliðið gildir áfram', async () => {
  for (const search of ['', '?x=1', '?embed=10']) {
    const r = await runGate({ framed: true, search });
    assert.match(r.redirect || '', /^\/adgangar\.html\?next=/, search);
  }
});
