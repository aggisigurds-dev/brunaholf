# J.A.R.V.I.S. — talandi raddir (Fish Audio)

Skafald til að láta Jarvis-HUD-ið **tala** með karakter-röddum. Ekkert er lifandi
fyrr en `FISH_API_KEY` er sett + `jarvis-voice.js` tengt inn — óhætt að deploya á
undan (functionið er óvirkt þangað til).

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
| Agent | Rödd | Fish `voice_id` |
|---|---|---|
| 🎩 Jarvis | J.A.R.V.I.S. (MCU) | `612b878b113047d9a770c069c8b4fdfe` |
| 🍀 Hunter | Gruff Irish | `880fb671ebcb446dbc0d5fc99baf909e` |
| 🃏 Harley | Harley Quinn | `e723d4c8547d4552af98ded15728cfbd` |
| 🌿 Náttúran | David Attenborough | `eabac87f2d8b47f1b174e7d2f685618a` |
| 🤖 GLaDOS | GLaDOS | `ee885900b0874d12b1c3439d1e56cc95` |
| 🤠 Dolly | *(vantar)* | — velja Fish „southern/country" eða tengja ElevenLabs „Aunt Shirley" |

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
