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

    // 2c) Brunakerfi — næsta skoðun úr brunakerfi-SKJÖLUM (customer_documents,
    // doc_type='brunakerfi'). Brunakerfis-skoðanir eru skráðar sem skjöl (sótt úr
    // Drive), EKKI í brunakerfi_skyrslur (sú tafla er nánast tóm — 3 óskyldar
    // línur). Nýjasta skoðun per byggingu → næsta = sami mánuður, ár+1 (sama
    // regla og Tæki-skoðun). `docs` eru þegar raðuð nýjast-fyrst (customer.js),
    // svo fyrsta brunakerfi-skjal hverrar byggingar er það nýjasta.
    const bkById = {};
    const bkSiteIds = new Set();
    docs.forEach((d) => {
      if (d.doc_type !== 'brunakerfi' || d.is_duplicate) return;
      const sid = d.fyrirtaeki_id;
      if (sid == null) return;
      bkSiteIds.add(sid);
      if (bkById[sid]) return;                 // þegar með nýjustu (raðað nýjast-fyrst)
      const ds = d.doc_date || (d.year ? d.year + '-01-01' : null);
      if (!ds) return;                         // án dags — reyna næsta (eldra) skjal
      const m = /^(\d{4})-(\d{2})/.exec(String(ds));
      if (m) bkById[sid] = '01.' + m[2] + '.' + (Number(m[1]) + 1);
    });

    // Ársdótar '23–'26: AÐEINS skjöl á þessum fyrirtaeki_id. Charlize: aldrei
    // mála öll hús rekstrarfélags græn af einni skýrslu / stada='ok'. Óstaðsett
    // skjal (fyrirtaeki_id null) telst aðeins ef félagið á nákvæmlega einn stað.
    const liveCount = sites.filter((s) => s.er_i_thjonustu === true).length;
    const YEAR_BOXES = [2023, 2024, 2025, 2026];
    function yearsForSite(siteId) {
      const u = {}, b = {};
      YEAR_BOXES.forEach((y) => { u[y] = false; b[y] = false; });
      docs.forEach((d) => {
        if (d.is_duplicate) return;
        const sid = d.fyrirtaeki_id;
        if (sid == null) {
          if (liveCount !== 1) return;
        } else if (Number(sid) !== Number(siteId)) return;
        const y = Number(d.year || (d.doc_date ? String(d.doc_date).slice(0, 4) : 0));
        if (!YEAR_BOXES.includes(y)) return;
        if (d.doc_type === 'uttektarskyrsla') u[y] = true;
        if (d.doc_type === 'brunakerfi') b[y] = true;
      });
      return YEAR_BOXES.map((y) => [u[y] ? 'ok' : 'no', b[y] ? 'ok' : 'no']);
    }

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
        y: yearsForSite(s.id),
        // Brunak. dálkur: á skjal á ÞESSUM stað, ekki „í þjónustu".
        br: bkSiteIds.has(s.id),
        nt: 'Slökkvit.: ' + slNext + '|Brunak.: ' + (bkById[s.id] || '—'),
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
