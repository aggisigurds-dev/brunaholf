# Lotu-hookarnir — router, lotuminni (Agentakerfið 2.0, 04.11.2026)

Þrír hookar. Kóðinn býr á **einum stað**, `brunaholf/tools/`; slokkvitaeki kallar á hann í gegnum `tools/lotu-hookar.cjs` og kjarni með slóð í systurmöppuna.

| Hook | Skrá | Hvað | Tími |
|---|---|---|---|
| `UserPromptSubmit` | `tools/router.cjs` | Leiðarvísir: kveikjuorð → agentar (alger slóð + ALDREI-línur), síða, fyrirtæki + kúnnaminni (`charlize_yfirlit`). Þegir á `/…` og < 3 orð. Skrifar `~/.claude/router-log.jsonl` (enginn prompt-texti). | ~0,1 s + ræsing node; netkall aðeins ef fyrirtæki finnst (3 s þak) |
| `Stop` | `tools/lotu-lok.cjs` | Uppfærir röð lotunnar í `charlize_sessions` (svör, agentar, kt, staðreyndir, göt, samantekt). Aldrei stdout, alltaf exit 0. | < 1 s, 2 s þak á netkalli |
| `SessionStart` | `tools/lotu-byrjun.cjs` | „Síðustu lotur hér“ — 5 síðustu lotur repósins, 🔴 ólokið minni. | 3 s þak |

Ekkert af þessu breytir gögnum nema `lotu-lok.cjs` (ein röð per lotu í `charlize_sessions`).

## 0. Áður en kveikt er (einu sinni)

1. **DDL:** keyrðu `sql/2026-11-04_charlize_sessions.sql` í Supabase SQL Editor (með samþykki Agnars). Án hennar virka hookarnir samt — Stop sendir ekkert og SessionStart segir eina línu.
2. **Kúnnaminnið:** `charlize_yfirlit` bilar í dag um anon-REST (42702 „nafn“ tvírætt). Lagfæringin er í `sql/2026-11-04_charlize_yfirlit_fix.sql` (önnur lota skrifaði hana). Án hennar segir routerinn „Charlize nær ekki í grunninn“ — annað virkar.
3. **Staðbundin gögn (á hverri vél, EKKI í git — `data/.gitignore`):**
   ```
   cd C:\projects\brunaholf
   node tools/build-agents-registry.cjs     # data/agents-registry.json, data/sidukort.json, data/gagnakort.json
   node tools/felog-saekja.cjs              # data/felog.json (nöfn + kt lögaðila)
   node tools/router.cjs --test             # á að enda á „N/N rétt“
   ```

## 1. Kveiktu á EINU repói fyrst — brunaholf

`C:\projects\brunaholf\.claude\settings.json` — bættu `UserPromptSubmit`, `Stop` og `SessionStart` við **við hliðina á** graphify-hookunum sem eru fyrir (PreToolUse helst óbreytt):

```json
{
  "enableAllProjectMcpServers": true,
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash|Grep", "hooks": [ { "type": "command", "command": "graphify hook-guard search" } ] },
      { "matcher": "Read|Glob", "hooks": [ { "type": "command", "command": "graphify hook-guard read" } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node tools/router.cjs", "timeout": 5 } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node tools/lotu-lok.cjs", "timeout": 10 } ] }
    ],
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node tools/lotu-byrjun.cjs", "timeout": 5 } ] }
    ]
  }
}
```

(`UserPromptSubmit` hefur engan `matcher`.)

**Prófun eftir að kveikt er** (ný lota í `C:\projects\brunaholf`):
1. Við upphaf á að sjást lína úr „Lotuminnið …“ / „Síðustu lotur hér (brunaholf)“.
2. Skrifaðu `rukka Center Hotels fyrir október` → Claude á að nefna rukkari + fyrirtæki. Staðfestu:
   `Get-Content $HOME\.claude\router-log.jsonl -Tail 1` → `"agentar":["fyrirtaeki","rukkari"]`.
3. Eftir svarið: `Get-ChildItem $HOME\.claude\lotu-state` → `<session_id>.json`, og (ef DDL keyrð)
   `select * from v_charlize_sessions_7d;` sýnir röðina.
4. Ef eitthvað er skrítið: `/hooks` í Claude Code sýnir hookana; `claude --debug` sýnir úttak þeirra.

Hookurinn keyrir með `cwd` = möppan sem lotan var opnuð í. Ef lotan `cd`-ar í undirmöppu og hookinn finnst ekki, notaðu `node "$CLAUDE_PROJECT_DIR/tools/router.cjs"` í staðinn (sama fyrir hina tvo).

## 2. slokkvitaeki — við hliðina á minni.cjs

`C:\projects\slokkvitaeki\.claude\settings.json` — `SessionStart` fær **aðra færslu** á eftir minni.cjs (sem stendur óbreytt):

```json
{
  "enableAllProjectMcpServers": true,
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "node tools/minni.cjs 2>&1 || echo 'Minnisstýribókin svaraði ekki — keyrðu: node tools/minni.cjs --uppfaera'", "timeout": 15 },
          { "type": "command", "command": "node tools/lotu-hookar.cjs byrjun", "timeout": 5 }
        ]
      }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "node tools/lotu-hookar.cjs router", "timeout": 5 } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node tools/lotu-hookar.cjs lok", "timeout": 10 } ] }
    ]
  }
}
```
(Halda `"//"`-athugasemdinni sem er fyrir.) `tools/lotu-hookar.cjs` finnur `../brunaholf` (eða `BH_REPO`); vanti brunaholf á vélinni gerir hann ekkert.

## 3. kjarni

`C:\projects\kjarni\.claude\settings.json`:

```json
{
  "enableAllProjectMcpServers": true,
  "hooks": {
    "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "node ../brunaholf/tools/router.cjs", "timeout": 5 } ] } ],
    "Stop":             [ { "hooks": [ { "type": "command", "command": "node ../brunaholf/tools/lotu-lok.cjs", "timeout": 10 } ] } ],
    "SessionStart":     [ { "hooks": [ { "type": "command", "command": "node ../brunaholf/tools/lotu-byrjun.cjs", "timeout": 5 } ] } ]
  }
}
```

## 4. `~/.claude/settings.json` — lotur utan repóanna (C:\projects, worktrees)

Bættu `"hooks"` við (aðrar stillingar óbreyttar). `--notandi` lætur hookinn þegja ef verkefnið hefur hann sjálft í `.claude/settings.json`, svo ekkert keyrir tvisvar:

```json
"hooks": {
  "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "node C:/projects/brunaholf/tools/router.cjs --notandi", "timeout": 5 } ] } ],
  "Stop":             [ { "hooks": [ { "type": "command", "command": "node C:/projects/brunaholf/tools/lotu-lok.cjs --notandi", "timeout": 10 } ] } ],
  "SessionStart":     [ { "hooks": [ { "type": "command", "command": "node C:/projects/brunaholf/tools/lotu-byrjun.cjs --notandi", "timeout": 5 } ] } ]
}
```
Í `C:\projects` (foreldramöppunni) sýnir SessionStart lotur **allra** repóa. Worktrees (`slokkvitaeki-wt-…`) skrást sem repo `projects`.

## Handprófanir (lesaðeins)

```
node tools/router.cjs --dry "Þjónustuborðið sýnir ekki Aðalmál" --cwd C:\projects\slokkvitaeki   # → bord-flettur
node tools/router.cjs --dry "rukka Center Hotels"                                               # → fyrirtaeki, rukkari (+ kúnnaminni)
node tools/router.cjs --dry "takk fyrir"                                                        # → þögn
node tools/router.cjs --test
node tools/lotu-byrjun.cjs --texti
<stdin-JSON með session_id, transcript_path, cwd, last_assistant_message> | node tools/lotu-lok.cjs --dry
```
`--dry` skrifar hvorki log, ástand né í grunninn. `--an-nets` sleppir charlize_yfirlit í routernum.

## Að slökkva

Taktu færslurnar út úr `settings.json` (eða keyrðu `/hooks` og afvirkjaðu). Ekkert annað þarf að hreinsa; `~/.claude/router-log.jsonl` og `~/.claude/lotu-state/` má eyða að vild.
