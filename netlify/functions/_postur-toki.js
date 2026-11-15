// _postur-toki.js — tíma-tóki fyrir póstsendingu milli þjóna (15.11.2026).
//
// HVERS VEGNA: gmail-send.js svaraði án innskráningar, svo hver sem er á netinu gat sent póst sem eldklar@/bokhald@
// og látið senda sér skrár úr Drive-inu (driveId sótt með aðal-tokeninu). Agnar 15.11.2026: „Já, smíða" við
// „Ég loka fyrst póstsendingunni (gmail-send) svo aðeins innskráðir geti sent".
//
// gmail-send hleypir nú aðeins inn (1) innskráðum á Brunahólfi (cookie hub_user, sami vefur) eða (2) þjónum sem
// senda þennan tóka í hausnum x-postur-toki: „<mínúta>.<HMAC-SHA256(SUPABASE_SERVICE_ROLE_KEY, 'postur-senda|'+mínúta)>".
// Tókinn gildir í 10 mín. Sami lykill er á báðum vefjum (Slökkvitæki mintar hann í postur-senda.cjs og hub-adgangar).
//
// Kallendur sem mynta: daily-health.js (heilsuvaktin 07:10), hub-adgangar.js (aðgangspóstur; afrit í slokkvitaeki —
// þar er myntunin skrifuð inn í fallið svo afritin haldist eins), slokkvitaeki/netlify/functions/postur-senda.cjs.
// Sama mynstur og morgunToki í slokkvitaeki/netlify/functions/_radgjafinn-hlid.cjs.

const crypto = require('crypto');

const HAUS = 'x-postur-toki';
const GILDIR_MIN = 10;
const lykill = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const undirrita = (m) => crypto.createHmac('sha256', lykill()).update('postur-senda|' + m).digest('hex');

function posturToki(ms = Date.now()) {
  const m = Math.floor(ms / 60000);
  return m + '.' + undirrita(m);
}

// Satt aðeins ef hausinn ber gildan tóka frá síðustu 10 mínútum (1 mín. vikmörk fram í tímann vegna klukkuskekkju).
function erGildurToki(event, ms = Date.now()) {
  if (!lykill()) return false;
  const h = (event && event.headers) || {};
  const [mStr, sig] = String(h[HAUS] || h['X-Postur-Toki'] || '').split('.');
  const m = Number(mStr), nu = Math.floor(ms / 60000);
  if (!Number.isInteger(m) || m < nu - GILDIR_MIN || m > nu + 1 || !/^[0-9a-f]{64}$/.test(sig || '')) return false;
  return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(undirrita(m), 'hex'));
}

module.exports = { HAUS, GILDIR_MIN, posturToki, erGildurToki };
