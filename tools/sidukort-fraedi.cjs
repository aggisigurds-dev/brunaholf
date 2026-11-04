#!/usr/bin/env node
/* sidukort-fraedi.cjs — DRÖG að síðukorti (.claude/sidukort.json) eins repós, lesin úr kóðanum.
 *
 *   node tools/sidukort-fraedi.cjs --repo <slóð> [--ut <skrá>]
 *
 * Án --ut prentast JSON á stdout. Eigandi er ALLTAF null í drögunum: hann er fylltur úr
 * greiningarlotum (hver agent á hvaða síðu) og fyrst þá er skráin vistuð sem
 * <repo>/.claude/sidukort.json — sem tools/build-agents-registry.cjs les.
 *
 * Hvað er lesið (tegund repós ræðst af innihaldi, ekki nafni möppunnar):
 *   brunaholf     index.html DEFAULT_STATE.tabs (flipar, {id,label}) + render<Xxx>-föll sem passa við flipa,
 *                 og <title> hverrar *.html í rótinni.
 *   slokkvitaeki  id="view-…" í index.html, VIEW_ID = '…' í js/patches/*.js, PAGES og APPS í
 *                 js/patches/261-app-profiles.js.
 *   kjarni        apps/*\/app/**\/page.tsx (síður) og route.ts (API), líka apps/*\/src/app.
 * Lesaðeins: skrifar aðeins --ut-skrána. */
'use strict';
const fs = require('fs');
const path = require('path');

const arg = process.argv.slice(2);
const flagg = n => { const i = arg.indexOf(n); return i > -1 ? arg[i + 1] : null; };
const repo = flagg('--repo') ? path.resolve(flagg('--repo')) : null;
if (!repo || !fs.existsSync(repo)) { console.error('Notkun: node tools/sidukort-fraedi.cjs --repo <slóð> [--ut <skrá>]'); process.exit(1); }

const les = f => { try { return fs.readFileSync(path.join(repo, f), 'utf8'); } catch (_) { return null; } };
const til = f => fs.existsSync(path.join(repo, f));
const rel = f => path.relative(repo, f).split(path.sep).join('/');
const sida = (o) => ({ id: o.id, titill: o.titill || o.id, tegund: o.tegund || null, leid: o.leid || null,
  skilgreind: o.skilgreind || [], yfir: o.yfir || null, eigandi: null, undiragentar: [], kveikjuord: [], ...(o.auka || {}) });
const hreinsa = s => String(s || '').replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const lykill = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ── brunaholf ──────────────────────────────────────────────────────────── */
function brunaholf() {
  const idx = les('index.html') || '';
  const sidur = [];
  const sed = new Map();
  // render-föll → lykill (renderTvMaeting → tvmaeting)
  const render = new Map();
  for (const m of idx.matchAll(/function (render([A-Z][A-Za-z0-9]*))\s*\(/g)) {
    const k = lykill(m[2]); if (!render.has(k)) render.set(k, m[1]);
  }
  // DEFAULT_STATE.tabs — flipar hubsins
  const ds = idx.indexOf('const DEFAULT_STATE');
  const blokk = ds > -1 ? idx.slice(ds, ds + 40000) : '';
  const tabsEnd = blokk.search(/\n\s*\]\s*,?\s*\n/);
  const tabsTxt = tabsEnd > -1 ? blokk.slice(0, tabsEnd) : blokk;
  for (const m of tabsTxt.matchAll(/\{\s*id\s*:\s*'([^']+)'\s*,\s*label\s*:\s*'([^']*)'([^}]*)/g)) {
    const id = m[1];
    if (sed.has(id)) continue;
    const url = (m[3].match(/url\s*:\s*'([^']+)'/) || [])[1] || null;
    const fn = render.get(lykill(id));
    const skilgreind = ['index.html' + (fn ? '#' + fn : '')];
    if (url && /^\/[\w-]+\.html$/.test(url) && til(url.slice(1))) skilgreind.push(url.slice(1));
    const p = sida({ id, titill: hreinsa(m[2]), tegund: url ? (/^https?:/.test(url) ? 'ytri' : 'sida') : 'flipi',
      leid: url || '/#' + id, skilgreind });
    sed.set(id, p); sidur.push(p);
  }
  // *.html í rótinni
  for (const f of fs.readdirSync(repo).filter(x => x.endsWith('.html') && !/^(index|404)\.html$/.test(x)).sort()) {
    const id = f.replace(/\.html$/, '');
    const t = les(f) || '';
    const titill = hreinsa((t.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]) || id;
    const fyrir = sed.get(id);
    if (fyrir) { if (!fyrir.skilgreind.includes(f)) fyrir.skilgreind.push(f); continue; }
    const p = sida({ id, titill, tegund: 'sida', leid: '/' + f, skilgreind: [f] });
    sed.set(id, p); sidur.push(p);
  }
  return { vefur: 'brunaholf', sidur };
}

/* ── slokkvitaeki ───────────────────────────────────────────────────────── */
function slokkvitaeki() {
  const idx = les('index.html') || '';
  const app = les('js/patches/261-app-profiles.js') || '';
  const sidur = [];
  const sed = new Map();
  const nyr = (id, o) => { if (sed.has(id)) return sed.get(id); const p = sida({ id, ...o }); sed.set(id, p); sidur.push(p); return p; };
  const baeta = (p, f) => { if (f && !p.skilgreind.includes(f)) p.skilgreind.push(f); };

  // PAGES: { k, label, short?, emoji, url? }
  const pages = new Map();
  const pStart = app.indexOf('var PAGES = [');
  const pTxt = pStart > -1 ? app.slice(pStart, app.indexOf('\n  ];', pStart)) : '';
  for (const m of pTxt.matchAll(/\{\s*k\s*:\s*'([^']+)'\s*,\s*label\s*:\s*'([^']*)'([^}]*)\}/g)) {
    pages.set(m[1], { label: hreinsa(m[2]), url: (m[3].match(/url\s*:\s*'([^']+)'/) || [])[1] || null, touch: /touch\s*:\s*true/.test(m[3]) });
  }
  // nav-merki í index.html: data-view="x" … <span>Heiti</span>
  const navLabel = new Map();
  for (const m of idx.matchAll(/data-view="([^"]+)"[^>]*>(?:(?!<\/button>)[\s\S])*?<span>([^<]+)<\/span>/g)) if (!navLabel.has(m[1])) navLabel.set(m[1], hreinsa(m[2]));

  // 1) view-… í index.html
  for (const m of idx.matchAll(/id="view-([^"]+)"/g)) {
    const k = m[1];
    nyr(k, { titill: (pages.get(k) || {}).label || navLabel.get(k) || k, tegund: 'view', leid: '#' + k, skilgreind: ['index.html'] });
  }
  // 2) VIEW_ID = '…' í patches
  const pd = path.join(repo, 'js', 'patches');
  let pf = [];
  try { pf = fs.readdirSync(pd).filter(f => f.endsWith('.js')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b)); } catch (_) {}
  for (const f of pf) {
    const t = fs.readFileSync(path.join(pd, f), 'utf8');
    const v = t.match(/VIEW_ID\s*=\s*['"]view-([^'"]+)['"]/);
    if (!v) continue;
    const k = v[1];
    const lbl = (t.match(/NAV_LABEL\s*=\s*['"]([^'"]+)['"]/) || [])[1];
    const p = nyr(k, { titill: (pages.get(k) || {}).label || (lbl && hreinsa(lbl.replace(/^\W+\s*/u, ''))) || navLabel.get(k) || k,
      tegund: 'view', leid: '#' + k, skilgreind: [] });
    baeta(p, 'js/patches/' + f);
  }
  // 3) PAGES-síður sem ekki eru view hér (iframe á brunaholf/kjarna eða sjálfstæð slóð)
  for (const [k, pg] of pages) {
    const p = nyr(k, { titill: pg.label, tegund: pg.url ? (/brunaholf\.netlify\.app/.test(pg.url) ? 'iframe-brunaholf' : /vercel\.app/.test(pg.url) ? 'iframe-kjarni' : 'sida') : 'view',
      leid: pg.url || '#' + k, skilgreind: [] });
    if (p.titill === k) p.titill = pg.label;
    baeta(p, 'js/patches/261-app-profiles.js');
  }
  // 4) APPS — öppin (síða = appið sjálft, inniheldur = sjálfgefnu síðurnar)
  const aStart = app.indexOf('var APPS = [');
  const aTxt = aStart > -1 ? app.slice(aStart, app.indexOf('\n  ];', aStart)) : '';
  for (const m of aTxt.matchAll(/\{\s*key\s*:\s*'([^']+)'[^}]*?name\s*:\s*'([^']+)'([\s\S]*?)defaults\s*:\s*\[([^\]]*)\]/g)) {
    const home = (m[3].match(/home\s*:\s*'([^']+)'/) || [])[1] || null;
    const inniheldur = [...m[4].matchAll(/'([^']+)'/g)].map(x => x[1]);
    nyr('app:' + m[1], { titill: m[2] + ' (app)', tegund: 'app', leid: '/app/' + m[1] + '/',
      skilgreind: ['js/patches/261-app-profiles.js'], auka: { heimasida: home, inniheldur } });
  }
  return { vefur: 'slokkvitaeki', sidur };
}

/* ── kjarni ─────────────────────────────────────────────────────────────── */
function kjarni() {
  const sidur = [];
  const appsDir = path.join(repo, 'apps');
  const ganga = (d, ut) => {
    let l; try { l = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of l) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) ganga(p, ut); else if (e.name === 'page.tsx' || e.name === 'route.ts') ut.push(p);
    }
  };
  let apps = [];
  try { apps = fs.readdirSync(appsDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); } catch (_) {}
  for (const a of apps.sort()) {
    for (const rot of [path.join(appsDir, a, 'app'), path.join(appsDir, a, 'src', 'app')]) {
      if (!fs.existsSync(rot)) continue;
      const skrar = []; ganga(rot, skrar);
      for (const f of skrar.sort()) {
        const seg = path.relative(rot, path.dirname(f)).split(path.sep).filter(s => s && !/^\(.*\)$/.test(s));
        const leid = '/' + seg.join('/');
        const api = path.basename(f) === 'route.ts';
        const t = fs.readFileSync(f, 'utf8');
        const titill = api ? null : hreinsa((t.match(/title\s*:\s*["'`]([^"'`]+)["'`]/) || [])[1]);
        sidur.push(sida({ id: `${a}:${leid}${api ? ' (api)' : ''}`, titill: titill || `${a} ${leid}`,
          tegund: api ? 'api' : 'sida', leid, skilgreind: [rel(f)], auka: { app: a } }));
      }
    }
  }
  return { vefur: 'kjarni', sidur };
}

const tegund = til('js/patches/261-app-profiles.js') ? 'slokkvitaeki'
  : til('apps') && !til('index.html') ? 'kjarni'
  : til('index.html') && /const DEFAULT_STATE/.test(les('index.html') || '') ? 'brunaholf' : null;
if (!tegund) { console.error(`Þekki ekki repóið ${repo} (hvorki brunaholf, slokkvitaeki né kjarni).`); process.exit(1); }
const r = { brunaholf, slokkvitaeki, kjarni }[tegund]();
const ut = {
  utgafa: 1,
  vefur: r.vefur,
  vefagent: null,
  _drog: `DRÖG úr tools/sidukort-fraedi.cjs ${new Date().toISOString().slice(0, 10)} (${tegund}, ${r.sidur.length} síður). eigandi = null þar til greiningarlota fyllir hann; vistist svo sem ${tegund}/.claude/sidukort.json.`,
  sidur: r.sidur,
};
const json = JSON.stringify(ut, null, 1) + '\n';
const utSkra = flagg('--ut');
if (utSkra) {
  fs.mkdirSync(path.dirname(path.resolve(utSkra)), { recursive: true });
  fs.writeFileSync(path.resolve(utSkra), json);
  const t = {}; for (const s of r.sidur) t[s.tegund] = (t[s.tegund] || 0) + 1;
  console.log(`${tegund}: ${r.sidur.length} síður → ${path.resolve(utSkra)}  (${Object.entries(t).map(([k, v]) => k + ' ' + v).join(' · ')})`);
} else process.stdout.write(json);
