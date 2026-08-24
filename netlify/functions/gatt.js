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
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') return P.json(405, { error: 'GET/POST only' });
  if (!P.envReady()) return P.json(503, { error: 'Þjónustuvefur ekki uppsettur' });

  const session = P.getSession(event);
  if (!session) return P.json(401, { error: 'Ekki innskráð(ur)' });
  const baseId = session.base_id;

  // POST → viðskiptavinur sendir fyrirspurn (skilaboð)
  if (event.httpMethod === 'POST') {
    let b; try { b = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Ógilt JSON' }); }
    const text = String(b.body || '').trim();
    if (!text) return P.json(400, { error: 'Tómt skeyti' });
    if (text.length > 4000) return P.json(400, { error: 'Skeyti of langt' });
    try {
      const ins = await P.sbPost('portal_messages', { base_id: baseId, sender: 'kunni', body: text, author_name: session.name || '' });
      if (!ins.ok) return P.json(ins.status, { error: 'Villa', detail: await ins.text() });
      return P.json(200, { ok: true, row: (await ins.json())[0] });
    } catch (e) { return P.json(500, { error: String((e && e.message) || e) }); }
  }

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

    // 2b) Brunaslöngur per byggingu (fyrirtaeki_id = site_id í fyrirtaeki-töflunni)
    const siteIds = sites.map((s) => s.id).filter(Boolean);
    const sloById = {};
    try {
      if (siteIds.length) {
        const ar = await P.sbGet(`arsskodun_report_facts?fyrirtaeki_id=in.(${siteIds.join(',')})&select=fyrirtaeki_id,report_year,equipment&order=report_year.desc`);
        if (ar.ok) {
          (await ar.json()).forEach((r) => {
            if (sloById[r.fyrirtaeki_id] !== undefined) return;
            const eq = (typeof r.equipment === 'string') ? JSON.parse(r.equipment) : (r.equipment || {});
            sloById[r.fyrirtaeki_id] = eq.brunaslongur != null ? Number(eq.brunaslongur) : null;
          });
        }
      }
    } catch (_) {}

    // 2c) Brunakerfi — næsta skoðun og fjöldi staðsetning í þjónustu
    // customer_base_id er null í öllum línum — filter á fyrirtaeki_id í staðinn
    const bkById = {};
    const bkSiteIds = new Set();
    try {
      const kr = siteIds.length ? await P.sbGet(`brunakerfi_skyrslur?fyrirtaeki_id=in.(${siteIds.join(',')})&select=fyrirtaeki_id,year,data&order=year.desc`) : { ok: false };
      if (kr.ok) {
        (await kr.json()).forEach((r) => {
          bkSiteIds.add(r.fyrirtaeki_id);
          if (bkById[r.fyrirtaeki_id]) return;
          const d2 = (typeof r.data === 'string') ? JSON.parse(r.data) : (r.data || {});
          const dags = d2.meta && d2.meta.dags;
          if (dags) {
            const m = /^(\d{4})-(\d{2})/.exec(String(dags));
            if (m) bkById[r.fyrirtaeki_id] = '01.' + m[2] + '.' + (Number(m[1]) + 1);
          }
        });
      }
    } catch (_) {}

    // 3) Byggingar — hvítlistaðir reitir
    const buildings = sites.map((s) => {
      const st = stById[s.id] || {};
      let slNext = '—';
      if (st.report_year && st.inspect_month) {
        slNext = '01.' + String(st.inspect_month).padStart(2, '0') + '.' + (st.report_year + 1);
      }
      return {
        id: s.id,
        nafn: s.nafn,
        heimilisfang: s.heimilisfang || '',
        i_thjonustu: s.er_i_thjonustu !== false,
        stada: st.stada || (s.er_i_thjonustu === false ? 'ekki_i_thjonustu' : 'engin_skyrsla'),
        sidasta_ar: st.report_year || null,
        taeki: st.total_devices != null ? st.total_devices : null,
        slo: sloById[s.id] != null ? sloById[s.id] : null,
        nt: 'Tæki: ' + slNext + '|Kerfi: ' + (bkById[s.id] || '—'),
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
      brunaslongur_alls: buildings.reduce((n, b) => n + (b.slo || 0), 0),
      brunakerfi_stk: bkSiteIds.size,
    };

    // 7) Skilaboð (fyrirspurna-þráður félagsins) + merkja starfs-skilaboð lesin
    let messages = [];
    try {
      const mr = await P.sbGet(`portal_messages?base_id=eq.${baseId}&select=sender,body,author_name,created_at&order=created_at.asc`);
      if (mr.ok) messages = await mr.json();
      await P.sbPatch(`portal_messages?base_id=eq.${baseId}&sender=eq.starf`, { read_by_customer: true });
    } catch (_) {}

    return P.json(200, {
      account: { name: session.name || data.base?.nafn || '', theme: session.theme || 'steel' },
      stats, buildings, reports, invoices, messages,
    });
  } catch (e) {
    return P.json(500, { error: String((e && e.message) || e) });
  }
};
