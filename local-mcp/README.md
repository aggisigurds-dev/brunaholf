# Brunahólf local MCP — skýja-tengill fyrir Claude local

Lítill stdio MCP server sem þú keyrir á **heimaskrifstofu-tölvunni** (eða hvaða
vél sem er). Hann er *tengillinn* milli staðbundna Claude (Claude Code á vélinni)
og skýsins: gefur Claude **á-vél getu** sem hann hefur annars ekki:

- Lesa skrár í Downloads, Drive, Documents, sjá möppustrúktur og stærðir
- Hit-a hvaða URL sem er (þ.m.t. `brunaholf.netlify.app`, sem skýja-Claude nær
  ekki í beint vegna egress-reglu)
- Opna URL í default browser-num þínum
- Streama skrár upp í Google Drive (gegnum brunahólf's Drive-proxy endapunkt —
  `/api/drive-upload-session`, engin ný innskráning á vélinni)

## Tools

| Tool | Hvað það gerir |
|---|---|
| `list_dir(path)` | listar skrár í möppu á tölvunni |
| `file_info(path)` | size, mtime, kind á einni skrá |
| `read_file_text(path, max_kb)` | les UTF-8 textaskrá (sjálfgefið 200KB hámark) |
| `http_fetch(url, method?, headers?, body?)` | fetchar URL frá tölvunni þinni |
| `open_in_browser(url)` | opnar URL í default browser-num |
| `upload_to_drive_via_brunaholf(local_path, drive_folder_id, name?)` | streamar local-skrá í Drive folder gegnum brunaholf endapunkt |

## Uppsetning — tvísmelltu (Windows)

Á vélinni sem á að fá tengilinn (t.d. heimaskrifstofan), tvísmelltu á:

```
setja-upp-local-mcp.bat
```

Hann setur upp pakkana (`npm install`), keyrir sjálfsprófið, og skráir
`brunaholf-local` hjá Claude Code með **user-scope** (aðgengilegt í öllum möppum
á vélinni) og algerri slóð á `server.mjs`. Ekkert PowerShell.

Taka út aftur: `claude mcp remove brunaholf-local -s user`

### Handvirkt (ef þú vilt ekki .bat)

```bash
cd local-mcp
npm install
claude mcp add brunaholf-local -s user -- node /full/path/to/local-mcp/server.mjs
```

(Notaðu **algera** slóð. Á Windows: `node C:\Users\Notandi\...\local-mcp\server.mjs`.)
Endurræstu Claude Code lotu — næst þegar hann tengist sér hann tools-ana.

### Valkostur: verkefna-scope (`.mcp.json`)

Ef þú vilt frekar að tengillinn hlaðist sjálfkrafa í tilteknu repo-i (og sé
meðal MCP-þjónanna sem beðið er um að samþykkja), bættu þessu í `.mcp.json`
repo-sins **eftir** `npm install` í `local-mcp/`:

```json
"brunaholf-local": { "command": "node", "args": ["local-mcp/server.mjs"] }
```

Ekki gera hvort tveggja (user-scope **og** `.mcp.json`) — þá skráist hann tvisvar.

## Að prufa

```bash
npm test        # eða: node test.mjs  — keyrir án nettengingar/ytri þjónusta
```

Eftir registration, biðjið Claude í nýrri lotu um:

> „Listaðu hvað er í Downloads"

Eða:

> „Hit-aðu https://brunaholf.netlify.app/api/data-sources-status"

Hann gerir það sjálfur — engin click frá þér.

## Upphal í Drive — leynilykill (valfrjálst)

`upload_to_drive_via_brunaholf` þarf sameiginlegan leynilykil, því
`/api/drive-upload-session` er læst með `X-Brunaholf-Token`:

1. Á brunahólf-Netlify: settu env-breytuna `LOCAL_UPLOAD_TOKEN` (leynilykill).
2. Á þessari vél: settu SÖMU breytu svo MCP-ferlið erfi hana —
   `setx LOCAL_UPLOAD_TOKEN "<sami lykill>"`, loka svo Claude Code og opna aftur.

Tólið les lykilinn úr `LOCAL_UPLOAD_TOKEN` sjálfkrafa (eða úr `token`-viðfanginu).
**Les-, fetch- og browser-tólin virka án lykils** — aðeins upphalið þarf hann.

## Öryggi

- **Engin shell-execution tool** — Claude getur ekki keyrt random skipanir
- **Engin file-write tool** — Claude getur ekki yfirskrifað neitt
- Read-only á filesystem
- HTTP-fetch á hvaða URL — passaðu hvaða tölu eða login þú sendir í gegn
- Leynilyklar eru ALDREI í kóðanum — `LOCAL_UPLOAD_TOKEN` kemur úr umhverfinu

Ef þú vilt þrengri permissions: edit-aðu `tools`-fylkið efst í `server.mjs` og
taktu út það sem þú vilt ekki.

## Næstu skref (v2)

- Resumable Drive upload (handles multi-GB files, heldur áfram eftir rof)
- Chrome DevTools Protocol bridge (`chrome_click`, `chrome_screenshot`, `chrome_reload_extension`)
- Native messaging fyrir extension-control
