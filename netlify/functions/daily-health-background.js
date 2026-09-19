// daily-health-background.js — SCHEDULED (netlify.toml, daglega 07:10).
//
// AF HVERJU ÞETTA ER TIL (19.09.2026):
// `daily-health.js` var skrifað til að segja Agnari þegar gagnaleiðsla fúnar eða
// samstilling klikkar. Það virkaði — og hefur aldrei sagt honum neitt, því í haus
// þess stóð: „Enginn tímaáætlun er skráð í netlify.toml". Það var byggt og aldrei
// tengt.
//
// Agnar sama dag: „Þetta er algjörlega klikkun að það sé ekki hægt að láta neitt
// virka lengur en í nokkrar klst." Fyrsta þurrkeyrsla á daily-health sýndi að
// hann hefur rétt fyrir sér og að kerfið VISSI það allan tímann:
//
//     🔴 Landsbankinn ledger 96 daga gömul
//     🔴 Redder efnisreikningar 8 daga gömul
//     🔴 Ajour — innskráning útrunnin (tvö störf)
//     🔴 Ajour skráningar 2 daga gamlar
//     🟠 tvö störf sem hafa aldrei keyrt
//
// Sjö raunveruleg vandamál sem enginn sá, af því vaktin var sofandi.
//
// ÁÆTLUNIN SITUR Á ÞESSUM TVÍBURA, EKKI Á daily-health SJÁLFU: Netlify svarar
// HTTP-beiðni á áætlað fall með 403, og daily-health verður að vera áfram
// kallanlegt (?dry=1 til að skoða án þess að senda). Sama mynstur og
// gmail-ingest-background.
//
// SENDIR AÐEINS ÞEGAR EITTHVAÐ ER AÐ. daily-health sendir ekki án ábendinga, svo
// dagur þar sem allt er í lagi er hljóður. Móttakandi ræðst af HEALTH_ALERT_TO í
// Netlify-umhverfinu — engin breyting á kóða þarf til að beina honum annað eða
// þagga hann (setjið HEALTH_ALERT_OFF=1).
const { handler: health } = require('./daily-health');

exports.handler = async () => {
  if (process.env.HEALTH_ALERT_OFF === '1') {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: 'HEALTH_ALERT_OFF=1' }) };
  }
  const res = await health({ httpMethod: 'GET', queryStringParameters: { send: '1' }, headers: {} }, {});
  let body = {};
  try { body = JSON.parse((res && res.body) || '{}'); } catch (_) {}
  return { statusCode: 200, body: JSON.stringify({ ok: body.ok !== false, sent: body.sent, summary: body.summary }) };
};
