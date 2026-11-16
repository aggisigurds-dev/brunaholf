// odin.js — reglubók og handbók Óðins fyrir Agentanetið í Jarvis (16.11.2026).
//
// Agnar 16.11.2026: „make a new agent that handles samþykktir, verkefnalista allaround. That I can bit by bit teach …
// Name him Odin" · „Svo getum við kannski búið til rulebook og manual af worksteps fyrir algengustu málin fyrir hann.
// Er í Jarvis, agentnet".
//
//   GET  /api/odin                                        → { reglur:[…], tolur:{…}, urskurdir:[síðustu 20] }
//   POST /api/odin { action:'stadfesta', id }             → tillaga verður virk regla (heimild óbreytt)
//   POST /api/odin { action:'ovirkja', id }               → regla gerð óvirk (aldrei eytt)
//   POST /api/odin { action:'heimild', id, heimild }      → 'sjalfur' | 'leggja_til'
//   POST /api/odin { action:'domur', id, domur, athugasemd } → dómur á úrskurð: 'rett' | 'rangt'
//
// ÖRYGGI
//   • Lestur og skrif krefjast starfsmanna-session (P.requireStaff) — reglubókin er rekstrarstefna, ekki opið efni.
//   • Skrif aðeins frá sama vef (Origin), sama regla og charlize-stada / agent-notes. Hvert skrif er skráð í agent_logs.
//   • Heimildin 'sjalfur' fæst EKKI héðan fyrir reglur sem undirbúa póst, kröfur eða reikninga (urskurdur
//     'undirbua_afgreidslu'): starfsmanna-lykilorðið er sameiginlegt og ber ekki nafn, svo sú heimild er aðeins
//     veitt með orðum Agnars í lotu. Reglur af tegundinni 'til_agnars' geta heldur ekki orðið 'sjalfur' — þær ERU
//     ákvarðanir hans. Tveir rangir dómar á reglu færa hana sjálfkrafa aftur í 'leggja_til'.

const P = require('./_portal');

const ORIGIN_OK = /^https:\/\/([a-z0-9-]+--)?brunaholf\.netlify\.app$/;
const LOCAL_OK = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
const REGLU_DALKAR = 'id,heiti,flokkur,thegar,adgerd,urskurdur,heimild,thak_kr,agent,skill,skref,heimildarord,kennt_af,kennt_at,virk,notkun,sidast_notad,rett,rangt';
// Úrskurðir sem mega fara í 'sjalfur' úr Jarvis: innri, afturkræfar aðgerðir. Póstur og peningar ('undirbua_afgreidslu')
// og ákvarðanir Agnars ('til_agnars') aldrei.
const MA_VERDA_SJALFUR = ['loka_med_sonnun', 'hafna', 'samthykkja', 'senda_agent'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (!P.dbReady()) return P.json(500, { error: 'Supabase env missing' });
  const g = P.requireStaff(event); if (g) return g;
  try {
    if (event.httpMethod === 'POST') return await skrifa(event);
    if (event.httpMethod !== 'GET') return P.json(405, { error: 'Method not allowed' });
    return await lesa();
  } catch (e) {
    return P.json(500, { error: e.message || String(e) });
  }
};

async function sbJson(qs) {
  const r = await P.sbGet(qs);
  if (!r.ok) throw new Error('lestur: ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

async function lesa() {
  const [reglur, urskurdir] = await Promise.all([
    sbJson(`odin_reglur?select=${REGLU_DALKAR}&order=virk.desc,heimild.desc,id.asc&limit=500`),
    sbJson('odin_urskurdir?select=id,created_at,tegund,mal_tafla,mal_id,titill,regla_id,urskurdur,gert,rokstudningur,sent_a,domur,domur_athugasemd,afturkallad_at&order=created_at.desc&limit=20'),
  ]);
  const vika = Date.now() - 7 * 864e5;
  const nyl = urskurdir.filter((u) => Date.parse(u.created_at) >= vika);
  return P.json(200, {
    reglur: reglur.map((r) => Object.assign({}, r, { ma_verda_sjalfur: maVerdaSjalfur(r) })),
    tolur: {
      virkar: reglur.filter((r) => r.virk).length,
      sjalfur: reglur.filter((r) => r.virk && r.heimild === 'sjalfur').length,
      leggja_til: reglur.filter((r) => r.virk && r.heimild !== 'sjalfur').length,
      tillogur: reglur.filter((r) => !r.virk).length,
      urskurdir_7d: nyl.length,
      gert_7d: nyl.filter((u) => u.gert).length,
      odaemt: urskurdir.filter((u) => u.gert && !u.domur && !u.afturkallad_at).length,
    },
    urskurdir,
    generated: new Date().toISOString(),
  });
}

function maVerdaSjalfur(r) { return !!r && MA_VERDA_SJALFUR.indexOf(r.urskurdur) !== -1; }

async function skrifa(event) {
  const origin = String((event.headers && (event.headers.origin || event.headers.Origin)) || '');
  if (origin && !ORIGIN_OK.test(origin) && !LOCAL_OK.test(origin)) return P.json(403, { error: 'Skrif aðeins leyfð frá brunaholf.netlify.app' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Invalid JSON' }); }
  const id = Number(b.id);
  if (!Number.isInteger(id) || id <= 0) return P.json(400, { error: 'id vantar' });
  const by = String(b.by_who || 'jarvis.html').slice(0, 60);
  const skra = (action, output, status) => P.log({ agent: 'odin', action, target: String(id), status: status || 'ok', output, by_who: by }).catch(() => {});

  if (b.action === 'domur') {
    const domur = b.domur === 'rett' ? 'rett' : b.domur === 'rangt' ? 'rangt' : null;
    if (!domur) return P.json(400, { error: 'domur þarf að vera rett eða rangt' });
    const u = (await sbJson(`odin_urskurdir?select=id,regla_id,domur&id=eq.${id}&limit=1`))[0];
    if (!u) return P.json(404, { error: 'Úrskurðurinn fannst ekki' });
    const r = await P.sbPatch(`odin_urskurdir?id=eq.${id}`, { domur, domur_at: new Date().toISOString(), domur_athugasemd: b.athugasemd ? String(b.athugasemd).slice(0, 1000) : null });
    if (!r.ok) return P.json(502, { error: 'domur: ' + r.status + ' ' + (await r.text()).slice(0, 200) });
    let aftur_i_leggja_til = false;
    if (u.regla_id && u.domur !== domur) {
      const regla = (await sbJson(`odin_reglur?select=id,rett,rangt,heimild&id=eq.${u.regla_id}&limit=1`))[0];
      if (regla) {
        const breyting = { updated_at: new Date().toISOString() };
        if (domur === 'rett') breyting.rett = (regla.rett || 0) + 1;
        else {
          breyting.rangt = (regla.rangt || 0) + 1;
          // Tveir rangir dómar → reglan missir heimildina þar til Agnar veitir hana aftur.
          if (breyting.rangt >= 2 && regla.heimild === 'sjalfur') { breyting.heimild = 'leggja_til'; aftur_i_leggja_til = true; }
        }
        await P.sbPatch(`odin_reglur?id=eq.${u.regla_id}`, breyting);
      }
    }
    await skra('odin_domur', { domur, aftur_i_leggja_til });
    return P.json(200, { ok: true, domur, aftur_i_leggja_til });
  }

  const regla = (await sbJson(`odin_reglur?select=${REGLU_DALKAR}&id=eq.${id}&limit=1`))[0];
  if (!regla) return P.json(404, { error: 'Reglan fannst ekki' });
  let breyting = null;
  if (b.action === 'stadfesta') breyting = { virk: true };
  else if (b.action === 'ovirkja') breyting = { virk: false, heimild: 'leggja_til' };   // óvirk regla ber aldrei heimild
  else if (b.action === 'heimild') {
    const h = b.heimild === 'sjalfur' ? 'sjalfur' : b.heimild === 'leggja_til' ? 'leggja_til' : null;
    if (!h) return P.json(400, { error: 'heimild þarf að vera sjalfur eða leggja_til' });
    if (h === 'sjalfur') {
      if (!maVerdaSjalfur(regla)) {
        await skra('odin_heimild_hafnad', { urskurdur: regla.urskurdur }, 'villa');
        return P.json(403, { error: 'Þessi regla snertir póst, peninga eða ákvörðun Agnars. Heimildina „sjálfur“ veitir Agnar aðeins með eigin orðum í lotu.' });
      }
      breyting = { heimild: 'sjalfur', virk: true };
    } else breyting = { heimild: 'leggja_til' };
  } else return P.json(400, { error: 'Óþekkt aðgerð' });

  breyting.updated_at = new Date().toISOString();
  const r = await P.sbPatch(`odin_reglur?id=eq.${id}`, breyting);
  if (!r.ok) return P.json(502, { error: b.action + ': ' + r.status + ' ' + (await r.text()).slice(0, 200) });
  // Lesið til baka: svarið segir það sem STENDUR í grunninum, ekki það sem beðið var um.
  const eftir = (await sbJson(`odin_reglur?select=${REGLU_DALKAR}&id=eq.${id}&limit=1`))[0];
  await skra('odin_' + b.action, { fyrir: { virk: regla.virk, heimild: regla.heimild }, eftir: { virk: eftir.virk, heimild: eftir.heimild } });
  return P.json(200, { ok: true, regla: Object.assign({}, eftir, { ma_verda_sjalfur: maVerdaSjalfur(eftir) }) });
}

exports._maVerdaSjalfur = maVerdaSjalfur;
