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

**Staða:** sett inn á þessari vél (DESKTOP-M5FO3I6) 04.11.2026 kl. 09:50 — afrit í `~/.claude/settings.json.bak-2026-11-04`. Á hinum vélunum þarf að bæta blokkinni við handvirkt (aðrar stillingar óbreyttar).

**Prófunargildra:** pípupróf með `echo '{"cwd":"C:\projects"}'` í Git Bash skilar oft ógildu JSON (bakskástrik týnast) → hookurinn þegir eins og hann á að gera og lítur út fyrir að vera bilaður. Skrifaðu prófunarinntakið í skrá með `cat <<EOF` og framskástrikum (`C:/projects`) eða keyrðu `--dry`.

Blokkin sem fer inn: `--notandi` lætur hookinn þegja ef verkefnið hefur hann sjálft í `.claude/settings.json`, svo ekkert keyrir tvisvar:

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

## Síðuvörður og keflið (04.11.2026 kvöld)

- **Síðuvörður** (`tools/sidu-vordur.cjs`, PreToolUse á Read · Edit · Write · MultiEdit · NotebookEdit): þegar lotan snertir skrá sem síðukortið á (`data/sidukort.json` → `skilgreind`, patch-númer eða síðu-id í skráarheiti) kemur eigandi síðunnar inn með slóð á agent-skrána og ALDREI-línur, einu sinni per síðu per lotu (ástand í `~/.claude/lotu-state/`). Skrá sem engin síða á (js/patches, apps/, netlify/functions, *.html) er skráð sem gat í `router-log.jsonl`. Prófun: `node tools/sidu-vordur.cjs --dry <skrá>`.
- **Keflið (boðhlaup, Agnar):** keflið fellur aldrei. `lotu-byrjun.cjs` setur jarvis með keflið í byrjun hverrar lotu; `router.cjs` réttir jarvis það þegar engin kveikjuorð hitta en promptið lýsir verki (≥ 9 orð); regla 5 í „Grunnreglur allra agenta“ í hverri agent-skrá segir agentinum að rétta verk utan sviðs áfram til eigandans og segja Agnari hver tók við.
- **Uppsetning á vél:** `node tools/setja-hooka.cjs --pull` setur alla fjóra hookana í `~/.claude/settings.json` (afrit tekið). Gildra sem fannst 04.11: lota opnuð í heimamöppunni sjálfri (C:\Users\<notandi>) lét `--notandi` þegja — lagað í `_lotu-grunnur.cjs`.
- **Fallorð:** „fyrir“, „eftir“, „yfir“ o.fl. hitta aldrei kveikjuorð með stofn-pörun (FALLORD í router.cjs) — „fyrir mig“ kallaði áður stjórann fyrirtaeki.

## Deploy-vörður — Lisbeth fer í gegnum öll deploy (05.11.2026)

- **Hvað:** `tools/deploy-vordur.cjs` (PreToolUse á `Bash`) sér skipunina sem er að fara að keyra. `[deploy]`-commit, `git push` með `[deploy]`-haus, `netlify deploy`, `node deploy.js`, `gh pr merge` og `git merge` fá `permissionDecision: ask` — Agnar sér „🖤 Lisbeth hefur ekki farið yfir þetta deploy“ — nema gildur úrskurður sé til í `~/.claude/lisbeth/<repo>.json`: RÉTT AÐFERÐ / RÉTT MEÐ SKILYRÐUM, yngri en 4 klst, á sama kóða (`git diff --quiet <head> HEAD`, ekkert óvistað í tracked skrám). Hookurinn neitar aldrei; Agnar ræður.
- **Lisbeth skráir:** `node tools/deploy-vordur.cjs --urskurdur "RÉTT AÐFERÐ" --cwd <repo-rót> [--hawking "ÞOLIR …"]`. Staða: `--stada --cwd <rót>`. Þurrkeyrsla: `--dry "<skipun>" --cwd <rót>`.
- **Hawking:** `kerfisrynir` (Stephen Hawking, `slokkvitaeki/.claude/agents/kerfisrynir.md`) fer yfir tölvu + síma + öpp + RLS + Netlify-föll; Lisbeth kallar á hann þegar það er snert og skráir úrskurð hans með `--hawking`.
- **Uppsetning:** í `.claude/settings.json` allra þriggja repóa (brunaholf beint, slokkvitaeki um `lotu-hookar.cjs deploy`, kjarni um `../brunaholf/tools/`) og í `~/.claude/settings.json` með `node tools/setja-hooka.cjs --pull` (fimmti hookurinn, matcher `Bash`, `--notandi` þegir þar sem repóið hefur hann sjálft).
- **Log:** hver stöðvun og hver úrskurður fer í `~/.claude/router-log.jsonl` (`deploy: {repo, skref, gildur, hvers}`) → lotu-lok.
