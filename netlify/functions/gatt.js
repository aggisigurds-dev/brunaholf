// gatt.js — gögn Þjónustuvefsins fyrir INNSKRÁÐAN viðskiptavin.
//
//   GET /api/gatt   → { account, stats, buildings[], reports[], invoices[] }
//
// base_id kemur EINGÖNGU úr session-tokeninu (aldrei úr slóð) → einangrun.
// Endurnýtir customer.js-samsetninguna innra og skilar AÐEINS hvítlistuðum,
// kúnna-öruggum reitum (engin ai_flags, AR-aldur, nótur, verð eða hrá skjöl).
// Skjöl eru sótt gegnum /api/gatt-doc (eignarhaldsprófað), aldrei hrár hlekkur.

const P = require('./_portal');
const customer = require('./customer');

const REPORT_TYPES = ['uttektarskyrsla', 'brunakerfi'];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: P.secHeaders(), body: '' };
  if (event.httpMethod !== 'GET') return P.json(405, { error: 'GET only' });
  if (!P.envReady()) return P.json(503, { error: 'Þjónustuvefur ekki uppsettur' });

  const session = P.getSession(event);
  if (!session) return P.json(401, { error: 'Ekki innskráð(ur)' });
  const baseId = session.base_id;

  try {
    // 1) Endurnýta customer.js-samsetninguna (base + sites + docs + invoices)
    const res = await customer.handler({ httpMethod: 'GET', queryStringParameters: { base: String(baseId) }, headers: {} });
    if (!res || res.statusCode !== 200) return P.json(502, { error: 'Gögn ekki tiltæk' });
    const data = JSON.parse(res.body || '{}');
    const sites = Array.isArray(data.sites) ? data.sites : [];
    const docs = Array.isArray(data.docs) ? data.docs : [];

    // 2) Skoðanastaða per byggingu úr view-inu (site_id → staða/ár)
    const stById = {};
    try {
      const sr = await P.sbGet(`v_stadir_skyrslu_stada?base_id=eq.${baseId}&select=site_id,report_year,stada,total_devices,inspect_month`);
      if (sr.ok) (await sr.json()).forEach((r) => { stById[r.site_id] = r; });
    } catch (_) {}

    // 3) Byggingar — hvítlistaðir reitir
    const buildings = sites.map((s) => {
      const st = stById[s.id] || {};
      return {
        id: s.id,
        nafn: s.nafn,
        heimilisfang: s.heimilisfang || '',
        i_thjonustu: s.er_i_thjonustu !== false,
        stada: st.stada || (s.er_i_thjonustu === false ? 'ekki_i_thjonustu' : 'engin_skyrsla'),
        sidasta_ar: st.report_year || null,
        taeki: st.total_devices != null ? st.total_devices : null,
      };
    });

    // 4) Skýrslur (uttekt + brunakerfi) — skjal sótt gegnum gatt-doc
    const reports = docs
      .filter((d) => REPORT_TYPES.includes(d.doc_type) && !d.is_duplicate)
      .map((d) => ({
        docId: d.id,
        dags: d.doc_date || null,
        ar: d.year || null,
        tegund: d.doc_type,
        bygging: d.site_nafn || '',
        magn: d.amount != null ? d.amount : null,
      }))
      .sort((a, b) => String(b.dags || b.ar || '').localeCompare(String(a.dags || a.ar || '')));

    // 5) Reikningar (skjöl af tegund reikningur)
    const invoices = docs
      .filter((d) => d.doc_type === 'reikningur' && !d.is_duplicate)
      .map((d) => ({
        docId: d.id,
        nr: d.invoice_number || null,
        dags: d.doc_date || null,
        ar: d.year || null,
        bygging: d.site_nafn || '',
        upphaed: d.amount != null ? d.amount : null,
      }))
      .sort((a, b) => String(b.dags || b.ar || '').localeCompare(String(a.dags || a.ar || '')));

    // 6) Yfirlits-tölur (það sem óhætt er að reikna beint)
    const stats = {
      byggingar: buildings.filter((b) => b.i_thjonustu).length,
      i_lagi: buildings.filter((b) => b.stada === 'ok').length,
      vantar: buildings.filter((b) => b.stada === 'engin_skyrsla').length,
      taeki_alls: buildings.reduce((n, b) => n + (b.taeki || 0), 0),
    };

    return P.json(200, {
      account: { name: session.name || data.base?.nafn || '', theme: session.theme || 'steel' },
      stats, buildings, reports, invoices,
    });
  } catch (e) {
    return P.json(500, { error: String((e && e.message) || e) });
  }
};
