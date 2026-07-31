# J.A.R.V.I.S. — talandi raddir (Fish Audio)

Skafald til að láta Jarvis-HUD-ið **tala** með karakter-röddum. `jarvis-voice.js`
er ÞEGAR tengt í `jarvis.html` (ein `<script defer>` lína) og sprautar sjálf-
innihaldna 🎙️ **radd-prufu** — svo það talar strax í dag með ókeypis vafra-rödd.
Fish-raunraddirnar kvikna þegar `FISH_API_KEY` er sett (þangað til skilar
`/api/jarvis-tts` 503 og client-inn fellur mjúklega á vafra-röddina).

## Skrárnar
| Skrá | Hlutverk |
|---|---|
| `netlify/functions/jarvis-tts.js` | Serverless proxy → Fish Audio S2.1 Pro. Tekur `{text, voice_id}`, skilar hljóði. Skyndiminni á endurteknar setningar (endur-rukkar ekki). |
| `js/jarvis-voice.js` | Client: `Jarvis.say('hunter', "…")`. Áhöfnin + raddir. Fellur á ókeypis vafra-rödd ef lykill vantar. |

## Kveikja á (3 skref)
1. **Lykill** — settu í Brunahólf Netlify env:
   - `FISH_API_KEY` = Fish Audio API-lykillinn þinn (fish.audio → Developer → API Keys)
   - `FISH_MODEL` (valkv.) = `s2.1-pro-free` (sjálfgefið, ókeypis kynningin) eða
     `s2-pro` (greitt, $15/1M stafir — fyrir viðskiptanotkun þegar kynningin rennur út)
2. **Skyndiminni** (valkv. en mælt með) — býr til fasta slóð per setning svo sama
   línan er búin til EINU SINNI:
   - Notar núverandi `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (þegar sett)
   - Búðu til **opinn** storage-bucket `jarvis-tts` í Supabase. Sleppir þessu ef
     bucketið vantar → skilar hljóðinu beint í staðinn.
3. **Tengja inn** — í `jarvis.html`:
   ```html
   <script src="/js/jarvis-voice.js"></script>
   ```
   svo kalla t.d.:
   ```js
   Jarvis.say('jarvis',  'Góðan daginn, Agnar. Þrjár sölur bíða reikninga.');
   Jarvis.say('hunter',  "Right ya numpty — send the feckin' invoices!");
   ```
   HUD-ið getur hlustað á atburðina til að glóa með röddinni:
   ```js
   addEventListener('jarvis:speak', e => hudPulse(true,  e.detail.agent));
   addEventListener('jarvis:done',  e => hudPulse(false, e.detail.agent));
   ```

## Áhöfnin (raddir = `/m/<id>` af fish.audio)
| Agent (`id`) | Rödd | Fish `voice_id` |
|---|---|---|
| 🎩 Jarvis (`jarvis`) | J.A.R.V.I.S. (MCU) — dagleg yfirsýn | `612b878b113047d9a770c069c8b4fdfe` |
| 🔥 Gordon Ramsay (`ramsay`) | nöldrar um ósend drög/reikninga | `e605a2a42b0a44ccb7af2e42e1676c92` |
| 🎙️ Morgan Freeman (`freeman`) | sögumaður — les skuldalistann | `76bb6ae7b26c41fbbd484514fdb014c2` |
| 💪 Arnold (`arnold`) | hvatning — „do it now" | `2270085c19e14054b63e0e451593e0f0` |
| 🇺🇸 Trump (`trump`) | hype-man (in-house parody) | `5dcaea7bfca74256bdbafc77593a8770` |
| 🃏 Harley (`harley`) | ringulreiðs-áminningar | `e723d4c8547d4552af98ded15728cfbd` |
| 💫 Samantha (`scarlett`) | blíð kven-aðstoð (Her) | `474887f7949b4d1ab3e626cddf82613a` |
| 🌸 Natalie (`natalie`) | hlý & róleg kvenrödd | `9154a623447644788ce990c64e0f235a` |

Hver agent ber líka `sample`-línu (í karakter) svo HUD/prufa getur talað sjálfgefið.

Skiptu um rödd hvenær sem er: `Jarvis.setVoice('jarvis', '<nýtt-id>')`, eða breyttu
`AGENTS` í `js/jarvis-voice.js`.

## Kostnaður
Stuttar línur → nánast ekkert. ~$15 per **milljón** stafi (Fish `s2-pro`), og
skyndiminnið endur-rukkar ekki endurteknar setningar → **~$1–2/mánuði** í raun,
oft ókeypis meðan `s2.1-pro-free` kynningin varir. Íslenskir broddstafir (á, ð, þ,
æ, ö) eru 2 bæti hver (rukkað per UTF-8 bæti) — hverfandi munur.

## Athuga
- **Íslenska:** Fish S2/S2.1 Pro STYÐUR íslensku (~80–83 tungumál) svo Jarvis les
  íslensk gögn/nöfn rétt — ekki fullkomið móðurmál (íslenska er minni tungumáls-flokkur)
  en alvöru íslenska, ekki ensk-hreimuð.
- **Karakter-banter** er best á ENSKU (fyndnara + allar raddir ná því 100%).
- Functionið skilar `{ok, url}` (þegar skyndiminni er á) eða `{ok, audio:<base64>, mime}`.
  Client-inn spilar hvort sem er. Villa → `{error}` og client fellur á vafra-rödd.
