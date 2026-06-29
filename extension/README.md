# Brunahólf · Mail Pulse — Chrome extension

Browser-bridge fyrir email_digest. Skannar opna Gmail / Outlook flipa á tölvunni þinni og POST-ar metadata-i á brunahólf hub-ið.

**Hvers vegna:** luna-bridge/bridge.js byggir á Thunderbird mbox + Task Scheduler á Windows-tölvu. Ef sú tölva er ekki á, eða Thunderbird er ekki tengt einhverri mailbox, þá verður email_digest staðnað. Þessi extension er parallel-leið sem virkar þegar þú ert bara með Chrome opinn og signaður inn á viðkomandi pósta.

## Hvað hún gerir

Þegar þú ert með Gmail eða Outlook OWA opna í Chrome-flipa:

- Content-script-ið skannar topp 50 raðir í inbox-inu (sender, subject, snippet, dagsetning, hvort er attachment)
- Reiknar stable `message_id` (`browser:<sha256-prefix>`) svo endurkeyrslur upserta sömu röð
- Sendir batch-inn á `/api/email-ingest-browser` með shared-secret í `X-Brunaholf-Token` header
- Backend-inn upsertar í `email_digest` með `on_conflict=message_id` — sömu regla og bridge.js / gmail-ingest.js

Sjálfvirk keyrsla:
- Við page-load (~2s eftir Gmail tilbúið, ~3s eftir Outlook)
- Þegar þú skiptir um folder/label (hash change)
- Þegar nýjar raðir birtast (MutationObserver, debounced 4-5s)

Handvirk keyrsla:
- Smelltu á extension-iconið → „Sync núna á þessum flipa"

## Uppsetning

### 1. Settu shared-secret í Netlify env vars

Brunaholf project → Project configuration → Environment variables → Add variable:

- **Key:** `EXTENSION_INGEST_TOKEN`
- **Secret:** ☑ (haka)
- **Scopes:** Functions + Builds + Runtime (Specific scopes)
- **Value (Production + Deploy Previews + Branch deploys):** búðu til random streng, t.d. úr `openssl rand -hex 32` eða copy-aðu úr password manager. Mundu þennan token — þú þarft að líma hann í extension popup-inu.

Eftir á: **Deploys → Trigger deploy → Deploy site**.

### 2. Hlaðu extension í Chrome

1. Sækja `extension/` möppuna úr brunahólfi repo-inu (eða copy-aðu hana á tölvuna)
2. Opna `chrome://extensions/`
3. Toggle **„Developer mode"** efst hægra megin → ON
4. Smella **„Load unpacked"** → veldu `extension/` möppuna
5. „Brunahólf · Mail Pulse" birtist í listanum + í toolbar-num (mögulega smelltu á puzzle-piece iconið til að pinna)

### 3. Stilltu token í popup

1. Smelltu á extension-iconið í toolbar
2. Líma `EXTENSION_INGEST_TOKEN` (sama gildi og í Netlify) í **„X-Brunaholf-Token"** reitinn
3. (Endpoint URL er fyrirfram stilltur á `https://brunaholf.netlify.app/api/email-ingest-browser` — engin breyting þörf)
4. Smella **„Vista stillingar"**

### 4. Prufa

1. Opna Gmail flipa með t.d. **eldklar@eldklar.is**
2. Bíða ~5 sek (initial scan keyrir sjálfvirkt)
3. Eða smella á extension iconið → **„Sync núna á þessum flipa"**
4. Popup-inn sýnir „eldklar@eldklar.is · INBOX · 50→50 · 12 sp · 2s síðan"

Eftir nokkrar mínútur staðfestu í brunahólf hub-num:
- 🌅 Dagurinn → 🔄 Samstilling → email-row fyrir eldklar@eldklar.is ætti að birta nýja dagsetningu

## Hvernig hún hagar sér

- **Engin OAuth-uppsetning** — notar bara þína innskráningu í browsernum (cookies-ar sjást aldrei af extensioninu)
- **Bara metadata** — extension les ekki póst-bodies (bara það sem birtist í inbox-listanum: sender, subject, snippet)
- **Engin tvítekning** — message_id-ar úr extension byrja á `browser:` og hash-aðir frá sender|subject|received_at. Sama email scrape-uð aftur upsertar sömu röð. Ef bridge.js sér sama post líka, fær hann sína RFC822 message_id-röð (sjást báðar í DB en með aðskildum ID-um).
- **Debounced** — MutationObserver debounce-ar 4-5 sek þannig að scroll/hover triggerar ekki spam
- **Resilient** — ef Gmail/Outlook DOM breytist og selektorar feila, console-loggar viðvörun en hrynur ekki

## Hvenær á að nota hver leið

| Leið | Hvenær |
|---|---|
| **Mail Pulse (þessi extension)** | Þú ert með Chrome opnaðan + signaðu inn á mailboxin |
| **luna-bridge** | Mailboxar settir upp í Thunderbird á heimaskrifstofu-tölvu |
| **gmail-ingest.js (cloud)** | Þú vilt full ingest úr skýi, óháð því hvort tölva sé á |

Þú getur keyrt fleiri en eina — `on_conflict=message_id` í backend-inu sér til þess að það verði aldrei tvítekning innan sama path-s. Mismunandi path-ar gefa mismunandi ID en samliggjandi rað fyrir sömu email birtist í UI sem 1-2 rað-ar mest.

## Vandræða-leysir

**Popup segir „Engin sync skráð enn"** — ekkert scan keyrt enn. Bíddu eftir initial scan-i (5 sek eftir page-load), eða smelltu „Sync núna".

**„Villa: 401 Ógilt eða vantandi X-Brunaholf-Token"** — token í popup matchar ekki `EXTENSION_INGEST_TOKEN` í Netlify. Endurnýja og match-a saman, vista í popup, prufa aftur.

**„Villa: 500 EXTENSION_INGEST_TOKEN vantar í Netlify env"** — env-var er ekki sett. Sjáðu skref 1.

**„Engar raðir fundust á síðunni"** — Gmail/Outlook DOM-ið er kannski ekki tilbúið, eða selektorar þurfa lagfæringu. Opna DevTools console á flipa-num, leita að `[Brunaholf Mail Pulse]` log-um.

**Outlook gefur 0 niðurstöður á meðan Gmail virkar** — Outlook OWA DOM-ið er flóknara og selectors v1 eru best-effort. Sendu HTML-snippet úr inbox-listanum á sláttsvæði/issue og ég lagfæri.
