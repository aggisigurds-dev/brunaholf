# Aðgangur stjóra að kerfinu í eigin Claude (04.11.2026)

Stjóri (Claude-aðgangur á anninn76@gmail.com) notar **sinn eigin Claude-aðgang** og tengir sjálfur þrjár tengingar. Ekkert er deilt af aðgangi Agnars,
engir lyklar fara á milli nema einn lestrar-tengistrengur.

## 1. Supabase — aðeins lestur

Hlutverkið `stjori_lesari` (`sql/2026-11-04_stjori_lesari.sql`) má **SELECT-a allt í `public`** og ekkert annað:
ekki skrifa, ekki eyða, 30 s hámark á fyrirspurn, 5 tengingar. Les fram hjá RLS (annars væru RLS-töflur án policies tómar),
sem er óhætt því engin skrifréttindi fylgja. Mælt 04.11: 686 SELECT-réttindi, 0 skrifréttindi.

Tengistrengur (Agnar setur lykilorðið og sendir á vinnupóst, aldrei gmail):

```
postgresql://stjori_lesari:<lykilorð>@db.osfdzskyvisifcwyjkuk.supabase.co:5432/postgres?sslmode=require
```

Í Claude (Desktop/Code) bætist við Postgres-MCP, t.d. í `.mcp.json`:

```json
{ "mcpServers": { "brunaholf-db": {
  "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres", "<tengistrengur>"] } } }
```

Hvað er hvar: gagnakortið í `docs/AGENTASKRA.md`, staðreyndir í `docs/STADREYNDIR.md`, þekkingargrunnurinn
`select topic, fact from v_charlize_active`. Kennitölur og tengiliðir eru ekki viðkvæm gögn í kerfinu.
**Ekki** bjóða honum í Supabase-stofnunina (Pro: lægsta hlutverk er Developer = fullur skrifaðgangur, 242 töflur án RLS).

## 2. GitHub — lesa allt, vinna á grein

Agnar: Settings → Collaborators á `aggisigurds-dev/brunaholf` og `aggisigurds-dev/slokkvitaeki` → bæta stjóra við (Write);
Settings → Branches → vernda `main` (require pull request). Stjóri tengir GitHub-tenginguna í sínum Claude.

Regla: **`main` er deploy** (`[deploy]` í commit → Netlify). Stjóri vinnur á eigin grein og opnar PR; Agnar sameinar.
Write-aðgangur dugir fyrir allt sem hann þarf: hann getur ýtt á sínar greinar og opnað PR — verndin stöðvar aðeins
beint push á `main`. Eigin forrit býr hann til í **sínum eigin repoum** undir sínum GitHub-notanda með fullum réttindum.

## 3. Google Drive — flokka, aldrei eyða

Stjóri tengir Google Drive með sínu Google. Reglurnar úr `.claude/skills/google-drive/SKILL.md`:
- **Aldrei eyða.** Tvítök fara í möppuna „Eyđa - dublicates" (`1CnnNHm1xCukiTs806z9Ha1nZnSELM9k8`).
- Skjöl viðskiptavina eiga heima í fastmöppunum undir `1ZATA15k-c4gXe27nl9IsAamMLub8PaCP` með föstu nafnavenjunni
  (`Fyrirtæki - staður - kt - úttektarskýrsla - ár.pdf`). Leita alltaf innan möppu, ekki allt Drive.
- Fjöldaflutningur og endurnefning fer í gegnum `/api/drive-*`-föllin, ekki handvirkt í gegnum tenginguna.
- Hans eigið Drive má hann flokka eins og hann vill.

## 4. Tölvupósturinn (eldklar@eldklar.is, bokhald@)

Pósturinn er **þegar í Supabase**: luna-bridge les Thunderbird á skrifstofuvélinni inn í `email_digest`
(eldklar@ + bokhald@, meginmál, to/from, þræðir). Stjóri les hann því strax með `stjori_lesari` — engin pósttenging þarf
til að fylgjast með eða greina. Þjónustuborðið (`#bord`, hamur Tölvupóstar) sýnir sama efni.

Vilji hann vinna í sjálfu pósthólfinu:
- **Delegation** (mælt með): Agnar → Gmail eldklar@ → Stillingar → Reikningar → „Veita aðgang að reikningnum þínum" →
  anninn76@gmail.com. Hann opnar hólfið í sínu Gmail án lykilorðs; Agnar getur afturkallað. Gmail-tenging Claude sér
  þó ekki afhent hólf.
- **Gmail-tenging Claude á eldklar@**: aðeins ef hann þarf að láta Claude lesa hólfið beint — þá skráir Agnar sig inn
  í tenginguna fyrir hann (lykilorðið fer ekki á milli). Sending kúnnapósts fer áfram um hubbinn (`/api/gmail-send`).

## 5. Brunahólfs-safnið á Drive

Agnar deilir rótarmöppunni `1ZATA15k-c4gXe27nl9IsAamMLub8PaCP` með anninn76@gmail.com — **Viewer fyrst**;
Editor þegar hann hefur ákveðið verk í safninu (Editor getur sett í ruslið, þess vegna gildir „aldrei eyða"-reglan).
Hún birtist þá undir „Deilt með mér" í hans Drive-tengingu.

## 6. Hjálpartól til að fylgjast með kerfinu (síðar)

- Sér repo, ekki inni í brunaholf. Notar lestrar-tengistrenginn og `GET`-API hubbsins.
- Byggja ofan á Kerfisheilsu (agent `kerfisheilsa`, síða í hub) og `automation_runs`/`query_logs`, ekki endurgera.
- Þurfi tólið að skrifa (t.d. skrá atvik) fer það í gegnum nýtt Netlify-fall með þjónustulykli, ekki beint á töflu.
