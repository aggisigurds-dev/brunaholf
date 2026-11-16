---
name: reikningalota
description: Byrja reikningalotu með Agnari án þess að hann þurfi að útskýra neitt — les kynninguna docs/REIKNINGALOTA.md, athugar tengingar (póstur, Tímavera, Payday, Redder, banki), les Drög-stöðina og segir stöðuna í fjórum línum. Notaðu í upphafi hverrar lotu sem snýst um að klára reikninga, kröfur, úttektir eða punkta sem safnast hafa, og þegar Agnar segir „reikningalota", „klára reikninga", „hvað er tilbúið að senda" eða „ertu með nýjustu póstana".
---

# Reikningalota

Lestu **`docs/REIKNINGALOTA.md`** fyrst — allt sem Agnar hefur þurft að endurtaka
(félögin, flæðin, afslættirnir, pósturinn) stendur þar. Spurðu ekki um það.

Sé Agent-tólið tiltækt: kallaðu á **`rukkari`** (🦆) — hann keyrir þessa rútínu, kallar á
bokari / sala-reikningar / postur (áður eldklar-postur; `slokkvitaeki/.claude/agents/postur.md`) og heldur utan um lotuna. Skillinn er handvirka leiðin.

## Rútínan (5 mín, engar spurningar)

1. `GET https://brunaholf.netlify.app/api/data-sources-status` → tengingar. Nefndu
   sérstaklega póstreikninga með `not_connected` eða `age_days > 0`.
2. `GET https://brunaholf.netlify.app/api/reikningspunktar?op=stada` → `verk` (Brunahólfs-drög
   með `checks`/`ready`), `kunnar` (Slökkvitækis-kúnnar með punkta), `unfiled`.
3. `GET https://brunaholf.netlify.app/api/reikningspunktar?status=nytt,flokkad` → punktarnir
   sjálfir. Það sem er `tegund:'spurning'` eða með `ai.spurningar` bíður ákvörðunar Agnars.
4. `node tools/osent-upplysingar.cjs` (les aðeins) → hvað vantar hjá hverjum greiðanda með ósend drög áður en
   hægt er að senda: kennitala, netfang reiknings, skráning í Payday, heimilisfang, taxti verks í verðskrá, tómir
   reitir á drögunum, heimilisfang sem stangast á. Það sem er `✗` fer í línuna „bíður punkta/upplýsinga";
   taxti, netfang og val á heimilisfangi fara í „bíður ákvörðunar Agnars". Netföng og nöfn tengiliða prentast ekki.
5. Svaraðu í **fjórum línum**: tilbúið að senda · bíður punkta/upplýsinga · bíður ákvörðunar
   Agnars · tengingar sem eru dottnar út. Svo: „Hvar viltu byrja?" — eða byrjaðu á því
   sem er tilbúið.

## Meðan lotan stendur

- Eitt verk í einu, eftir Drög-stöðinni. Brunahólf: „✓ Setja á drögin" skrifar í
  `invoice_drafts` (`POST /api/reikningspunktar {action:'apply', …}`); Slökkvitæki: punktur
  merkist notaður þegar hann er kominn í söluna í Slökkvitæki-appinu.
- Allt sem Agnar nefnir og á að muna → `POST /api/reikningspunktar {action:'add', felag, raw}`.
  Ekki í svarið, ekki á miða.
- Tölur sem enda á reikningi: fletta upp (`pricing_guide`, `solur`, afsláttarreglur) — aldrei giska.
- Tómir reitir á drögum (greiðandi, kt, heimilisfang) fyllast úr Payday hjá greiðanda sem er þegar tengdur verkinu,
  eftir já frá Agnari; aldrei skrifað yfir gildi sem er til, aldrei giskað á netfang eða taxta.
- **Í lok lotu** (Agnar 16.11.2026: „update skills, agents, knowledge base og customerbase fyrir þetta session"):
  agentaskrá eigandans, þessi skill ef verklagið breyttist, Charlize (`charlize_knowledge`, svið `brunaholf`/`kerfi`)
  og kúnnaminnið — ein röð með `scope='kunni'` og kennitölu fyrir hvert félag sem lotan snerti (staða, hvað var gert,
  hvað stendur opið). Netföng og nöfn tengiliða fara í kúnnaminnið, aldrei í skrár í repóinu.
- Sé lotan slitin: ekkert tapast. Næsta lota byrjar á skrefi 1.
