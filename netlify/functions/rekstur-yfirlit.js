// rekstur-yfirlit.js — „Hvernig gengur reksturinn?“ fyrir Fjármála-yfirlit Brunahólfs (Agnar 22.11.2026: „setja líka hingað“).
//
//   GET /api/rekstur-yfirlit → sama JSON og slokkvitaeki /api/rekstur-yfirlit (hvort félag sér: sjö mánuðir Unnið · Reikningsfært · Greitt,
//                              ógreitt, innheimta, setning + merkt áætlun)
//
// Útreikningurinn býr í slokkvitaeki (_rekstur-yfirlit.cjs, _unnid-sl.cjs) — hér er aðeins þunnt gegnumstreymi, eins og tekjulidir.js:
// hub_user-kakan er staðfest hér (innskráður stjórnandi) og send ÁFRAM (aðeins hún). Slökkvitækjavefurinn kallar svo aftur á brunaholf
// /api/rekstur-manudir fyrir Brunahólfs-hlutann. 9 s tímamörk; bregðist það er svarið 502 með ástæðu (síðan sýnir „ómælt“), aldrei tölur
// sem líta út eins og 0. AÐEINS LESTUR.
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
    const sig = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined;
    const r = await fetch(`${SL()}/api/rekstur-yfirlit`, { headers: { cookie: `hub_user=${m[1]}`, accept: 'application/json' }, signal: sig });
    let j = null;
    try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) return RS._svar(502, { villa: 'Reksturinn ómældur — Slökkvitækjavefurinn svaraði ' + r.status + (j && j.error ? ': ' + String(j.error).slice(0, 160) : '') });
    if (!j || !j.slokkvitaeki || !j.brunaholf) return RS._svar(502, { villa: 'Reksturinn ómældur — óvænt snið frá Slökkvitækjavefnum' });
    return RS._svar(200, j);
  } catch (e) {
    return RS._svar(502, { villa: e && e.name === 'TimeoutError' ? 'Reksturinn ómældur — Slökkvitækjavefurinn svaraði of seint' : 'Reksturinn ómældur — Slökkvitækjavefurinn náðist ekki' });
  }
};
