# Brunahólf local MCP

Lítill stdio MCP server sem þú keyrir á heimaskrifstofu-tölvunni. Gefur Claude (cloud-side) **á-vél getu** sem hann annars hefur ekki:

- Lesa skrár í Downloads, Drive, Documents, sjá möppustrúktur og stærðir
- Hit-a hvaða URL sem er (þ.m.t. `brunaholf.netlify.app` sem Claude getur ekki náð í beint vegna egress policy)
- Opna URL í default browser-num þínum
- Streama skrár upp í Google Drive (gegnum brunahólf's Drive-proxy endpoint)

## Tools

| Tool | Hvað það gerir |
|---|---|
| `list_dir(path)` | listar skrár í möppu á tölvunni |
| `file_info(path)` | size, mtime, kind á einni skrá |
| `read_file_text(path, max_kb)` | les UTF-8 textaskrá (defaults 200KB max) |
| `http_fetch(url, method?, headers?, body?)` | fetchar URL frá tölvunni þinni |
| `open_in_browser(url)` | opnar URL í default browser-num |
| `upload_to_drive_via_brunaholf(local_path, drive_folder_id, name?)` | streamar local-skrá í Drive folder gegnum brunaholf endpoint |

## Setup (eitt-skiptis)

```bash
cd local-mcp
npm install
```

Þá skráðu serverinn í Claude Code:

```bash
claude mcp add brunaholf-local -- node /full/path/to/brunaholf/local-mcp/server.mjs
```

(Notaðu absolute path. Á Windows: `node C:\Users\Notandi\...\local-mcp\server.mjs`)

Endurræstu Claude Code session. Næst þegar Claude tengist, sér hann tools-ana.

## Að prufa

Eftir registration, biðjið Claude um:

> „Listaðu hvað er í Downloads/Takeout"

Eða:

> „Hit-aðu /api/payday-pull?probe=1"

Hann gerir það sjálfur — engin click frá þér.

## Öryggi

- **Engin shell-execution tool** — Claude getur ekki keyrt random skipanir
- **Engin file-write tool** — Claude getur ekki yfirskrifað neitt
- Read-only á filesystem
- HTTP-fetch á hvaða URL — passaðu hvaða tölu eða login þú sendir í gegn

Ef þú vilt þrengri permissions: edit-aðu tools-array-ið efst í `server.mjs` og taktu út það sem þú vilt ekki.

## Næstu skref (v2)

- Resumable Drive upload (handles multi-GB files)
- Chrome DevTools Protocol bridge (`chrome_click`, `chrome_screenshot`, `chrome_reload_extension`)
- Native messaging fyrir extension-control
