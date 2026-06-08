// name-lookup.js — find a customer's kennitala by company NAME, for Skjalaheiti reports
// that printed only the name (older reports, no kt on the page).
//   GET /api/name-lookup?name=Aðalskoðun
//   → { found:true, exact:true, kennitala, nafn, id, heimilisfang }        (one confident match)
//     { found:true, exact:false, count, candidates:[{kennitala,nafn,heimilisfang}] }  (ambiguous)
//     { found:false }
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const norm = (s) => String(s || '')
  .toLowerCase()
  .replace(/\b(ehf|hf|slf|sf|ses|ohf|bs|svf)\b\.?/g, '')   // drop company-type suffix
  .replace(/[^\p{L}\p{N} ]/gu, ' ')                         // punctuation → space
  .replace(/\s+/g, ' ')
  .trim();

// Curated name→kennitala bridge from the 2026-06-08 Keldan lookups, for older reports that
// print only a company name (no kt on the page). Keys are normalized names; matched against
// the START of the parsed name so "Aðalskoðun, Grjóthálsi 10" still resolves to "aðalskoðun".
const KELDAN_ALIASES = {"almenna bílaverkstæðið":"470291-1099","augnlæknastöðin mjódd":"580800-3860","aðalskoðun":"540994-2269","bitter jp innréttingar":"610305-0400","bleksmiðjan":"571215-1600","bláa lónið":"490792-2369","bortækni":"620805-0250","bretti réttingarverkstæði":"691010-1630","bílasala selfoss":"560614-0550","bílasmiðurinn":"541298-2159","bílaspítalinn":"430504-3710","bíóbú":"700702-2350","center hotels laugavegur":"450905-1430","center hótel þingholt":"450905-1430","centerhotels":"450905-1430","colas":"420187-1499","djús lemon":"611112-1140","efla":"621079-0189","ferðafélag íslands":"530169-3759","fiskbúð suðurlands":"610789-1109","foss stéttarfélag":"430775-0659","framsýn menntun":"630615-0890","golfbúðin":"631299-2539","gullhamrar veitingahús":"660304-2580","h árnason":"471194-2399","hamborgarabúlla tómasar":"520905-2190","hannesarholt":"710809-0890","heilsudalurinn eignarhaldsfélag hress":"540497-2149","heilsustofnun nlfí":"480269-6919","heilsuvitund sjúkraþjálfun":"480402-2510","hellishólar":"460105-2690","hljóðfærahúsið":"690506-1570","hreysti":"470688-1229","háskólaprent":"530117-1380","húsfélagið eskivellir 21 a og b":"590314-0130","icecom":"540102-2440","indverska matarfélagið":"510613-0310","jarðboranir":"590286-1419","jeppasmiðjan ljónsstöðum":"491090-1389","k þorsteinsson og co":"650172-0519","katla dmi":"650303-3260","kfc":"540198-3149","kirkjugarðar hafnarfjarðar":"700371-3799","kjölfar fríða gull":"631292-2169","kjöthúsið":"670593-2079","klaki tech":"621019-1200","klifurfélag reykjavíkur":"410302-3810","línuborun":"521001-2590","malbikunarstöðin hlaðbær colas":"420187-1499","metal":"650604-3690","mhg":"481100-2830","miðbæjarhótel centerhotels":"450905-1430","málmtækni":"510570-0579","mítra":"700399-3469","nýja kökuhúsið":"510276-0199","one systems ísland":"500902-3530","poloborg bláa sjoppan":"591017-0630","prófílstál":"611201-2060","pústþjónusta bjb":"690494-2649","rauði kross íslands":"530269-2649","sameignarfélag ölfusborga":"500269-2199","sjúkraþjálfunin afl":"700699-2189","sláturfélag suðurlands":"600269-2089","snóker og poolstofan":"551002-2920","stafræn prentsmiðja":"531200-2330","stjörnu oddi":"460185-0419","stokkhylur":"430407-0310","storkurinn":"511207-2660","stál og stansar":"630287-1119","sætoppur":"691106-0470","tannlæknar mjódd":"450506-0440","tokyo veitingar":"670710-0920","trésmiðja heimis":"570102-3460","trésmiðjan jari":"460891-1089","umslag":"680789-1189","viðhald og nýsmíði":"431194-2879","íhlutir":"510292-2519","íslensk hollusta":"601005-1150"};
function aliasMatch(q){
  let hit = null, hitLen = -1;
  for (const k in KELDAN_ALIASES){
    if ((q === k || q.startsWith(k + ' ')) && k.length > hitLen){ hit = KELDAN_ALIASES[k]; hitLen = k.length; }
  }
  return hit;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  const raw = ((event.queryStringParameters || {}).name || '').trim();
  if (norm(raw).length < 3) return json(400, { error: 'name too short' });

  const q = norm(raw);

  // 1) Curated Keldan bridge wins first — authoritative for these companies, and it
  //    tolerates the parsed "name, street" shape that the live DB names don't match.
  const aliasKt = aliasMatch(q);
  if (aliasKt) return json(200, { found: true, exact: true, kennitala: aliasKt, nafn: raw, source: 'keldan' });

  const H = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const like = encodeURIComponent('%' + raw.replace(/[%_*]/g, ' ').trim() + '%');

  async function search(table) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?nafn=ilike.${like}&select=id,nafn,kennitala,heimilisfang&limit=30`, { headers: H });
      if (!r.ok) return [];
      return (await r.json().catch(() => [])) || [];
    } catch (e) { return []; }
  }

  // Prefer the curated customers_base; fall back to the wider fyrirtaeki list.
  let rows = await search('customers_base');
  if (!rows.length) rows = await search('fyrirtaeki');

  // Dedupe by kennitala (same company can appear more than once).
  const byKt = {};
  rows.forEach((r) => { if (r && r.kennitala) byKt[r.kennitala] = r; });
  const uniq = Object.values(byKt);
  if (!uniq.length) return json(200, { found: false });

  // One exact normalized name match → confident.
  const exact = uniq.filter((r) => norm(r.nafn) === q);
  const pick = exact.length === 1 ? exact[0] : (uniq.length === 1 ? uniq[0] : null);
  if (pick) {
    return json(200, { found: true, exact: true, kennitala: pick.kennitala, nafn: pick.nafn, id: pick.id, heimilisfang: pick.heimilisfang || null });
  }

  // Otherwise hand back the candidates so the user picks — never guess a kennitala.
  return json(200, {
    found: true, exact: false, count: uniq.length,
    candidates: uniq.slice(0, 8).map((r) => ({ kennitala: r.kennitala, nafn: r.nafn, heimilisfang: r.heimilisfang || null })),
  });
};

function cors() {
  return { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS', 'access-control-allow-headers': 'content-type' };
}
function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json', ...cors() }, body: JSON.stringify(payload) };
}
