---
name: vidmotsprof
description: >
  Prófa breytingu í Brunahólfs-hubbnum Í GEGNUM VIÐMÓTIÐ án þess að skrifa í lifandi gögn —
  staðbundinn þjónn (5601) með GET-köllum vísað á lifandi API, Playwright-route sem grípur
  öll skrif, PDF-ið fangað á leiðinni í /api/pdf-store og opnað með pdf.js. Notaðu áður en þú
  segir „lagað" um glugga, takka, reikning, drög eða PDF í index.html, og eftir [deploy] til að
  staðfesta á lifandi síðu. Kveikjuorð: „prófa", „staðfesta", „virkar þetta", „sannreyna",
  „skjáskot af PDF", „opnast glugginn".
---

# Viðmótspróf án skrifa (Brunahólf)

**Reglan:** UI er aðeins staðfest í gegnum viðmótið — beint API-kall sannar ekki að glugginn,
takkinn eða talan birtist (sjá minni `feedback-profa-i-gegnum-vidmotid`). Og próf má **aldrei**
skrifa í lifandi gögn: drög, `nlsh_manadarlok`, `krofur_yfirlit_meta`, PDF í Drive/Storage.

## 1 · Staðbundinn þjónn með lifandi gögnum

`.claude/launch.json` → `brunaholf-dev` (`npx serve -l 5601 .`). Ræstu með `preview_start`
eða keyrðu þjóninn í bakgrunni. Föllin (`/api/*`, `/.netlify/*`) eru EKKI til á 5601 —
route-reglan sækir GET af lifandi síðunni og grípur allt annað:

```js
async (page) => {
  const skrif = [];
  await page.context().unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
  await page.context().route('**/*', async (route) => {
    const req = route.request(); let url; try { url = new URL(req.url()); } catch { return route.continue(); }
    const m = req.method();
    // lifandi föll: skrif aldrei í gegn
    if (url.hostname === 'brunaholf.netlify.app' && m !== 'GET') { skrif.push('LIVE ' + m + ' ' + url.pathname); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    // Supabase beint úr vafranum: skrif gripin (rpc-lestur má fara í gegn ef nafnið er ekki skrif)
    if (/supabase\.co/.test(url.hostname) && !['GET', 'HEAD', 'OPTIONS'].includes(m)) {
      if (m === 'POST' && /\/rpc\//.test(url.pathname) && !/merge|save|set_|upsert|insert|update|delete|log|next_reikningur_num/i.test(url.pathname)) return route.continue();
      if (m === 'POST' && /\/storage\/v1\/object\/sign\//.test(url.pathname)) return route.continue();
      skrif.push(m + ' supabase ' + url.pathname); return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.hostname !== 'localhost' || !/^\/(api|\.netlify)\//.test(url.pathname)) return route.continue();
    if (m !== 'GET') { skrif.push(m + ' ' + url.pathname); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    const r = await fetch('https://brunaholf.netlify.app' + url.pathname + url.search);
    return route.fulfill({ status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json' }, body: Buffer.from(await r.arrayBuffer()) });
  });
  // … prófið …
  return { skrif };   // skilaðu ALLTAF skrif-listanum: hann sannar hvað HEFÐI verið vistað
}
```

Playwright MCP (`browser_run_code_unsafe`) keyrir þetta. Chrome-MCP-hópurinn hefur stundum
ekki hub-flipann — Playwright er þá leiðin.

## 2 · Gildrur sem kostuðu umferðir

- **Sama slóð með nýju `#` endurhleður ekki.** Gamall gluggi (`.gr-modal-bg`) stendur þá og
  gleypir smelli. Farðu ALLTAF `page.goto('about:blank')` á undan `goto(...#flipi)`.
- **Bíddu á stöðu, ekki á texta sem var þegar þarna.** `waitForTimeout` + lesa KPI gaf úrelta
  tölu úr fyrri mánuði. Notaðu `waitForFunction` á skilyrði sem aðeins nýja ástandið uppfyllir,
  t.d. `document.getElementById('nle-man')?.value === '2026-09' && /3.827.435/.test(...)`.
- **Mánuður síðunnar ≠ mánuður gluggans.** Prófaðu glugga með síðuna á ÖÐRUM mánuði
  (`state.ui.gr_month = '2026-08'; render()`) — þannig fundust læsti NLSH-glugginn og 0 kr
  Heklureits-drögin.
- **Opna glugga beint:** `window.__grPendingOpen = '<verkstaður>'` (+ `__grPendingMonth`) og
  `render()`, eða smella á `[data-gr-gata="Landsspitalinn"]` / `[data-gr-gata="Heklu reitur"]`.
- **Höfuðlaus vafri sýnir en-US kommur** (3,827,435) — berðu saman tölustafi, ekki snið.
- Safnaðu `pageerror` í lista og skilaðu honum með niðurstöðunni.
- **Falinn vafraspjald frýs** (rAF stoppar) — sjá minni `feedback-maeling-falid-spjald`.

## 3 · PDF: fanga, opna, skoða

PDF-smiðirnir (`buildAndSave*Pdf`) POSTa `{fileName, contentBase64}` á `/api/pdf-store`.
Gríptu það á leiðinni og sendu á staðbundinn móttakara (`sink.cjs` í þessari möppu,
127.0.0.1:8765, skrifar í möppuna sína):

```js
if (url.pathname === '/api/pdf-store') {
  const b = JSON.parse(req.postData() || '{}');
  await fetch('http://127.0.0.1:8765/x?name=prof.pdf.b64', { method: 'POST', body: b.contentBase64 });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, webViewLink: 'https://example.invalid/v', downloadUrl: 'https://example.invalid/d' }) });
}
```

`pdftoppm` er ekki á vélunum. Opnaðu PDF-ið með **pdf.js í vafranum** (síða með
`<div id="out">` og `pdfjsLib` af cdnjs 3.11.174), teiknaðu hverja síðu á canvas og taktu
skjáskot af canvas-inu; `getTextContent()` gefur textann og `styles[].fontFamily` sannar letrið
(t.d. að Playfair hafi hlaðist). Lestu skjáskotin sjálfur áður en þú sendir Agnari.

## 4 · Lifandi staðfesting eftir [deploy]

1. Bíddu eftir birtingu (live `/build.json` = HEAD).
2. Sama próf á `https://brunaholf.netlify.app/#…` með sömu route-reglu (skrif gripin).
3. Aðeins þegar Agnar bað um raunvistun (t.d. „settu stöðuna í september") má vistunin fara í
   gegn — þá route sem **fangar en heldur áfram** (`route.continue()`) svo PDF-ið náist líka.
4. Lestu svo til baka **í viðmótinu** (t.d. Kröfu yfirlit sýnir drögin + PDF-hlekkinn).

## Sjá líka
`screenshot-verify` (fjarlotur: TLS-relay), `deploy`, minni `feedback-profunarsmellur-eydir`
(aldrei smella á takka sem fannst með mynstri — ✕ var Eyða).
