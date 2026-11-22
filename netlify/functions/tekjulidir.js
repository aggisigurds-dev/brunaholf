// tekjulidir.js — Tekjuliðir Slökkvitækis fyrir Rekstrarskýrslu Brunahólfs (fasi 3, Agnar 22.11.2026).
//
//   GET /api/tekjulidir → sama JSON og slokkvitaeki /api/tekjulidir (flokkar × mánuðir, hópar, sölutegundir, topp 8, skilgreining)
//
// Flokkunin og útreikningurinn (EITT flokkunarfall) búa í slokkvitaeki netlify/functions/_tekjulidir.cjs — þaðan koma líka 3–5 stærstu
// flokkarnir á Tekjur í beinni. Hér er aðeins þunnt gegnumstreymi: hub_user-kakan er staðfest hér (innskráður stjórnandi, eins og
// rekstrarskyrsla.js) og send ÁFRAM (aðeins hún) til slokkvitaeki, sem staðfestir hana aftur — undirrituð kaka gildir á báðum vefjum,
// en vafrinn geymir hana sér per vef, svo síðan getur ekki kallað beint á hinn vefinn. 8 s tímamörk; bregðist það er svarið 502 með
// ástæðu (síðan sýnir „ómælt“), aldrei tölur sem líta út eins og 0. AÐEINS LESTUR.
const RS = require('./rekstrarskyrsla.js');

const SL = () => (process.env.SLOKKVITAEKI_URL || 'https://slokkvitaeki.netlify.app').replace(/\/$/, '');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return RS._svar(405, { villa: 'Aðeins GET' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return RS._svar(500, { villa: 'Supabase vantar' });
  let n;
  try { n = await RS._notandi(event); } catch (e) { return RS._hafnad(502); }
  if (n.villa) return RS._hafnad(n.villa);
  if (!n.stjornandi) return RS._hafnad(403);
  const hra = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  const m = /(?:^|;\s*)hub_user=([^;]+)/.exec(String(hra));
  if (!m) return RS._hafnad(401);
  try {
    const sig = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
    const r = await fetch(`${SL()}/api/tekjulidir`, { headers: { cookie: `hub_user=${m[1]}`, accept: 'application/json' }, signal: sig });
    let j = null;
    try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) return RS._svar(502, { villa: 'Tekjuliðir ómældir — Slökkvitækjavefurinn svaraði ' + r.status + (j && j.error ? ': ' + String(j.error).slice(0, 160) : '') });
    if (!j || !Array.isArray(j.flokkar) || j.flokkar.length !== 15 || !Array.isArray(j.manudir)) return RS._svar(502, { villa: 'Tekjuliðir ómældir — óvænt snið frá Slökkvitækjavefnum' });
    return RS._svar(200, j);
  } catch (e) {
    return RS._svar(502, { villa: e && e.name === 'TimeoutError' ? 'Tekjuliðir ómældir — Slökkvitækjavefurinn svaraði of seint' : 'Tekjuliðir ómældir — Slökkvitækjavefurinn náðist ekki' });
  }
};
