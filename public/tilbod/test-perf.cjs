#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const dir = __dirname;
let failed = 0;
function ok(name, cond, detail) {
  if (cond) console.log('  OK  ' + name);
  else { failed++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
ok('docx UMD is not a blocking script tag',
  !/<script[^>]+src=["']https:\/\/unpkg\.com\/docx/.test(html));
ok('loadDocxLib helper exists', /function loadDocxLib\(/.test(html));
ok('click handler awaits loadDocxLib', /const docxLib = await loadDocxLib\(\)/.test(html));
ok('docx is still pinned to 9.1.0', html.includes('docx@9.1.0/build/index.umd.js'));
ok('logo has width/height (CLS)',
  /<img class="logo" src="logo.png" width="180" height="60"/.test(html));

const toml = fs.readFileSync(path.join(dir, 'netlify.toml'), 'utf8');
ok('HTML / revalidates', /for = "\/"/.test(toml) && /max-age=0, must-revalidate/.test(toml));
ok('PNG may be cached a day', /for = "\/\*\.png"/.test(toml) && /max-age=86400/.test(toml));

const logo = fs.readFileSync(path.join(dir, 'logo.png'));
ok('logo.png is a PNG', logo[0] === 0x89 && logo[1] === 0x50 && logo[2] === 0x4e && logo[3] === 0x47);
ok('logo.png is under 20 KB (was 218 KB)', logo.length < 20 * 1024);
ok('logo.png is smaller than the live 218 KB original', logo.length < 217792);

console.log(failed ? '\n' + failed + ' failed' : '\nall tilbod perf contracts passed');
process.exit(failed ? 1 : 0);
