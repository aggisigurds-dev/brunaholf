// relink-docs.js — finna DAUÐA/úrelta skjala-linka og endurtengja við réttu
// skrána sem nú býr í master-möppunum tveim (2026-07-13, ósk Agnars: „skjala-
// linkur virkaði ekki … búnir að færa mest í master … kanski á eftir að
// endurtengja").
//
// Rök: þegar skrár voru FÆRÐAR í master-möppuna hélst drive_file_id óbreytt →
// þeir linkar virka enn. En þegar AFRIT var eytt í tiltekt situr customer_
// documents.drive_file_id eftir á eydda afritinu → dauður linkur. Þessi endapunktur:
//   1. Listar báðar master-möppurnar (reikningar + úttektarskýrslur).
//   2. Byggir uppflettingu: R-númer → skrá (reikningar) og kt|ár(+heimilisfang)
//      → skrá (skýrslur).
//   3. Fyrir hvert customer_documents með drive_file_id sem er EKKI í master-
//      möppunum: reynir að finna réttu master-skrána og endurtengir drive_file_id.
//
//   GET /api/relink-docs?dry=1   → greinir + skýrsla, EKKERT skrifað
//   GET /api/relink-docs?apply=1 → endurtengir (uppfærir drive_file_id)
//   Valkv.: &reikningar=<id>&skyrslur=<id> (sjálfgefnar master-möppur).

const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULTS = {
  reikningar: '1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p',
  skyrslur:   '1VSRRw6O8U6lU8WzZxA8CkLtrAmiU07mg',
};
const FOLDER_MIME = 'application/vnd.google-apps.folder';

function sbHeaders(extra) { return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, extra || {}); }
async function sbGet(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders({ Range: `${from}-${from + 999}` }) });
    if (!r.ok) throw new Error('sbGet ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const rows = await r.json().catch(() => []);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
async function patchDoc(id, patch) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${id}`, {
    method: 'PATCH', headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error('patch ' + r.status + ' ' + (await r.text()).slice(0, 120));
}

async function listFolder(token, folder) {
  const out = [];
  let pageToken = '';
  do {
    const params = new URLSearchParams({
      q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType),nextPageToken',
      pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await fetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('Drive list ' + r.status + ': ' + (await r.text()).slice(0, 200));
    const d = await r.json();
    out.push(...(d.files || []));
    pageToken = d.nextPageToken || '';
  } while (pageToken);
  return out;
}

// ── parsing helpers ──────────────────────────────────────────────────────────
function digits(s) { return String(s || '').replace(/\D/g, ''); }
function ktFromName(name) {
  const m = String(name || '').match(/\b(\d{6}-\d{4})\b/) || String(name || '').match(/\b(\d{10})\b/);
  return m ? digits(m[1]) : '';
}
function yearFromName(name) {
  const ys = String(name || '').match(/\b(20\d\d)\b/g);
  return ys ? Math.max(...ys.map(Number)) : null;
}
// R-númer → tölugildi (einkvæmt, sleppir forkúlu-núllum). „R-000523" → 523.
function rNumFromName(name) {
  const m = String(name || '').match(/\bR[-\s]?0*(\d{3,6})\b/i);
  return m ? parseInt(m[1], 10) : null;
}
function rNumFromDoc(inv) {
  const m = String(inv || '').match(/0*(\d{3,6})/);
  return m ? parseInt(m[1], 10) : null;
}
// Heimilisfangs-lykill til að greina milli staða rekstrarfélags (sama kt+ár).
function addrKey(s) {
  const t = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const num = (t.match(/(\d+)/) || [])[1] || '';
  const street = (t.replace(/\d.*/, '').match(/[a-z]+/g) || []).join('').slice(0, 6);
  return street + '|' + num;
}
function isJunk(f) {
  // tmp-ocr-* Google-Docs (leifar frá OCR-lesurum) — ekki alvöru skjöl.
  return f.mimeType !== FOLDER_MIME && f.mimeType !== 'application/pdf' && /^tmp-ocr-/i.test(f.name || '');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });
  const p = event.queryStringParameters || {};
  const apply = p.apply === '1' || p.apply === 'true';
  const reikFolder = p.reikningar || DEFAULTS.reikningar;
  const skyrFolder = p.skyrslur || DEFAULTS.skyrslur;

  try {
    const token = await freshAccessToken();
    const reikFiles = (await listFolder(token, reikFolder)).filter(f => f.mimeType === 'application/pdf');
    const skyrFiles = (await listFolder(token, skyrFolder)).filter(f => f.mimeType === 'application/pdf');
    const junkCount = 0; // (junk excluded above by pdf-only filter)

    const masterIds = new Set([...reikFiles, ...skyrFiles].map(f => f.id));

    // Uppflettingar
    const byR = new Map();                 // rNum → [fileId]
    reikFiles.forEach(f => { const n = rNumFromName(f.name); if (n != null) { const a = byR.get(n) || []; a.push(f.id); byR.set(n, a); } });
    const bySkyr = new Map();              // kt|ár → [{id, addrkey}]
    skyrFiles.forEach(f => {
      const kt = ktFromName(f.name), yr = yearFromName(f.name);
      if (!kt || !yr) return;
      const k = kt + '|' + yr;
      const a = bySkyr.get(k) || []; a.push({ id: f.id, addrkey: addrKey(f.name) }); bySkyr.set(k, a);
    });

    // Skjöl + kt (úr customers_base) + heimilisfang staðar (úr fyrirtaeki)
    const docs = await sbGet('customer_documents?drive_file_id=not.is.null&select=id,doc_type,drive_file_id,invoice_number,year,customer_base_id,fyrirtaeki_id');
    const bases = await sbGet('customers_base?select=id,kennitala');
    const ktByBase = new Map(bases.map(b => [b.id, digits(b.kennitala)]));
    const sites = await sbGet('fyrirtaeki?select=id,heimilisfang');
    const addrBySite = new Map(sites.map(s => [s.id, addrKey(s.heimilisfang)]));

    const relink = [], unmatched = [], ambiguous = [];
    let okInMaster = 0;

    for (const d of docs) {
      if (masterIds.has(d.drive_file_id)) { okInMaster++; continue; }   // linkur bendir þegar á master → í lagi
      // Ekki í master → dauður eða úrelt afrit. Reyna að finna réttu skrána.
      if (d.doc_type === 'reikningur') {
        const rn = rNumFromDoc(d.invoice_number);
        const hits = rn != null ? (byR.get(rn) || []) : [];
        if (hits.length === 1) relink.push({ id: d.id, doc_type: d.doc_type, key: 'R-' + rn, to: hits[0], from: d.drive_file_id });
        else if (hits.length > 1) ambiguous.push({ id: d.id, doc_type: d.doc_type, key: 'R-' + rn, n: hits.length });
        else unmatched.push({ id: d.id, doc_type: d.doc_type, key: d.invoice_number || '(ekkert R-nr)' });
      } else if (d.doc_type === 'uttektarskyrsla') {
        const kt = ktByBase.get(d.customer_base_id) || '';
        const yr = d.year;
        const hits = (kt && yr) ? (bySkyr.get(kt + '|' + yr) || []) : [];
        if (hits.length === 1) relink.push({ id: d.id, doc_type: d.doc_type, key: kt + '|' + yr, to: hits[0].id, from: d.drive_file_id });
        else if (hits.length > 1) {
          // margir staðir sama kt+ár → greina eftir heimilisfangi staðarins
          const ak = addrBySite.get(d.fyrirtaeki_id);
          const m = ak ? hits.filter(h => h.addrkey === ak) : [];
          if (m.length === 1) relink.push({ id: d.id, doc_type: d.doc_type, key: kt + '|' + yr + '|' + ak, to: m[0].id, from: d.drive_file_id });
          else ambiguous.push({ id: d.id, doc_type: d.doc_type, key: kt + '|' + yr, n: hits.length });
        } else unmatched.push({ id: d.id, doc_type: d.doc_type, key: (kt || '?') + '|' + (yr || '?') });
      } else {
        // samningur o.fl. — önnur mappa, ekki snert hér
        unmatched.push({ id: d.id, doc_type: d.doc_type, key: '(önnur mappa)' });
      }
    }

    const summary = {
      master_files: { reikningar: reikFiles.length, skyrslur: skyrFiles.length },
      docs_with_fileid: docs.length,
      ok_already_in_master: okInMaster,
      relink_count: relink.length,
      ambiguous_count: ambiguous.length,
      unmatched_count: unmatched.length,
    };

    if (!apply) {
      return json(200, { ok: true, dry: true, summary,
        sample_relink: relink.slice(0, 25), sample_unmatched: unmatched.slice(0, 15), sample_ambiguous: ambiguous.slice(0, 15) });
    }

    let done = 0;
    for (const r of relink) { await patchDoc(r.id, { drive_file_id: r.to }); done++; }
    return json(200, { ok: true, applied: true, summary, relinked: done, ambiguous: ambiguous.slice(0, 40), unmatched: unmatched.slice(0, 40) });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
