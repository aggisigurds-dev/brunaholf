// uttekt-upload.js — taka við app-gerðum úttektarskýrslum úr Slökkvitæki-appinu
// (sem vistar PDF-in í public Supabase bucket) og setja AFRIT í kanónísku
// Úttektarskýrslur Drive-möppuna + skrá/uppfæra `customer_documents` röð, svo
// app-skýrslurnar birtast í Kerfis-korti / Skýrslu-stöð eins og Drive-lesnar.
//
//   POST /api/uttekt-upload
//     body { kt, fyrirtaeki_id?, company, address?, year, month?, filename?,
//            pdf_base64? | public_url? }
//       — PDF annaðhvort inline base64 eða public URL (aðal-leiðin: Supabase
//         Storage public_url úr appinu). Hámark ~10 MB.
//     → 200 { ok:true, drive_file_id, doc_id, name }
//     → 4xx/5xx { error }
//
// Nafnavenjan er sú SAMA og uttekt-rename framleiðir:
//   `<Fyrirtæki>[ - <Heimilisfang>] - <kt með striki> - <ár>[ - <mánuður>][ - #<fyrirtaeki_id>].pdf`
//
// Idempotency: (1) leitað að nákvæmlega sama kanóníska nafni í möppunni —
// finnist það er INNIHALDIÐ uppfært (files.update, ný revision) í stað þess að
// búa til annað Drive-eintak; (2) sé til (fyrirtaeki_id, year, uttektarskyrsla)
// röð í customer_documents er drive_file_id hennar UPPFÆRT (aldrei tvíröð).

const _g = require('./_google');
const _spine = require('./_spine');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FOLDER = '1VSRRw6O8U6lU8WzZxA8CkLtrAmiU07mg'; // Úttektarskýrslur (canonical)
const FOLDER_REIKN = '1FHHX99LRB_9w_LqwHIY57T4l9mLMID7p'; // Reikningar - Invoices (canonical)
const MAX_PDF = 10 * 1024 * 1024; // ~10 MB

// — sömu hjálparar og uttekt-rename.js (dash + sanitize) —
const dash = kt => (kt && kt.length === 10) ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;
function sanitize(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 70); }

function sbHeaders(extra) {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', ...extra };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(204, '', cors());
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env missing' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Invalid JSON' }); }

  const ktRaw = String(body.kt || '').replace(/\D/g, '');
  const company = sanitize(body.company);
  const address = sanitize(body.address || '');
  const year = parseInt(body.year, 10);
  const month = body.month ? sanitize(String(body.month)).toLowerCase() : '';
  const fyrirtaekiId = body.fyrirtaeki_id ? parseInt(body.fyrirtaeki_id, 10) : null;
  // 2026-07-18: brúin tekur nú LÍKA app-gerða REIKNINGA (doc_type='reikningur'
  // + invoice_number [R-nr, dedup-lykillinn] + amount/doc_date valkvætt) —
  // lenda í Reikningar-master möppunni undir reikningar-rename nafnavenjunni
  // og upsert-ast í customer_documents á R-númerinu. Default óbreytt: skýrsla.
  const docType = String(body.doc_type || 'uttektarskyrsla');
  const isInv = docType === 'reikningur';
  const invNr = isInv ? sanitize(String(body.invoice_number || '')).toUpperCase() : '';
  const amount = body.amount != null ? Math.round(Number(body.amount) || 0) : null;
  const docDate = body.doc_date ? String(body.doc_date).slice(0, 10) : '';
  if (isInv && !/^R-?\d{4,7}$/.test(invNr)) return json(400, { error: 'invoice_number (R-nr) vantar eða rangt snið fyrir doc_type=reikningur' });

  if (ktRaw.length !== 10) return json(400, { error: 'kt (10 tölustafir) vantar eða rangt snið' });
  if (!company) return json(400, { error: 'company vantar' });
  if (!year || year < 2005 || year > new Date().getFullYear() + 1) return json(400, { error: 'year vantar eða ótrúverðugt' });
  if (!body.pdf_base64 && !body.public_url) return json(400, { error: 'pdf_base64 eða public_url vantar' });

  // 1) Sækja/afkóða PDF-ið
  let pdfBuf;
  try {
    if (body.pdf_base64) {
      pdfBuf = Buffer.from(String(body.pdf_base64), 'base64');
    } else {
      const url = String(body.public_url);
      if (!/^https:\/\//i.test(url)) return json(400, { error: 'public_url verður að vera https' });
      const r = await fetch(url);
      if (!r.ok) return json(400, { error: `Náði ekki í PDF af public_url (${r.status})` });
      const len = parseInt(r.headers.get('content-length') || '0', 10);
      if (len > MAX_PDF) return json(413, { error: 'PDF stærra en 10 MB' });
      pdfBuf = Buffer.from(await r.arrayBuffer());
    }
  } catch (e) {
    return json(400, { error: 'Gat ekki sótt/afkóðað PDF: ' + (e.message || e) });
  }
  if (!pdfBuf || !pdfBuf.length) return json(400, { error: 'PDF tómt (0 bæti)' });
  if (pdfBuf.length > MAX_PDF) return json(413, { error: 'PDF stærra en 10 MB' });
  if (pdfBuf.slice(0, 5).toString('latin1') !== '%PDF-') return json(400, { error: 'Skjalið er ekki PDF (%PDF- haus vantar)' });

  const ktDash = dash(ktRaw);

  // Herða staðar-tengingu (2026-07-24): ef appið gaf EKKI fyrirtaeki_id, leysum
  // við hann úr STÖÐUM félagsins (sömu kt) gegnum sameiginlegu tengiregluna —
  // AÐEINS með sönnun (#id-stimpill / eini staðurinn / heimilisfang passar við
  // nákvæmlega EINN stað). resolveSite skoðar aldrei annað en staði þessarar kt,
  // svo skýrslan getur ALDREI ratað á fyrirtæki með svipað nafn undir annarri kt
  // (rótin að „Hamraborg 7" → „Hamraborg ehf" ruglingnum). Enginn match → látið
  // óbreytt (null) — aldrei giskað á nafn. Skýrslur aðeins (reikn. dedup-ast á R-nr).
  let resolvedVia = null;
  if (!isInv && !fyrirtaekiId) {
    try {
      const br0 = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(ktDash)}&select=id&limit=1`, { headers: sbHeaders() });
      const baseId0 = br0.ok ? ((await br0.json())[0] || {}).id || null : null;
      if (baseId0) {
        const sites = await _spine.sitesForBase(baseId0);
        // Byggjum kandídat-„skráarheiti" úr nafni+heimilisfangi svo addrKeyLoose
        // nái húsnúmerinu; PDF/app-heimilisfangið fer líka sem extraAddr.
        const r = _spine.resolveSite(company + (address ? ' - ' + address : ''), sites, address);
        if (r) { fyrirtaekiId = r.id; resolvedVia = r.via; }
      }
    } catch (_) { /* óvissa → fyrirtaekiId óbreytt (má vera null), aldrei giskað */ }
  }

  const TARGET = isInv ? FOLDER_REIKN : FOLDER;
  const name = body.filename
    ? sanitize(String(body.filename).replace(/\.pdf$/i, '')) + '.pdf'
    : isInv
      // reikningar-rename venjan: Fyrirtæki - kt - R nr - dags - upphæð
      ? [company, ktDash, invNr.replace(/^R-?/, 'R '),
         docDate ? docDate.slice(8, 10) + '.' + docDate.slice(5, 7) + '.' + docDate.slice(2, 4) : '',
         amount != null ? amount.toLocaleString('is-IS').replace(/,/g, '.') + ' kr' : '']
          .filter(Boolean).join(' - ') + '.pdf'
      : company
        + (address ? ' - ' + address : '')
        + ' - ' + ktDash
        + ' - ' + year
        + (month ? ' - ' + month : '')
        + (fyrirtaekiId ? ' - #' + fyrirtaekiId : '')
        + '.pdf';

  let token;
  try { token = await _g.freshAccessToken(); }
  catch (e) { return json(500, { error: 'Google auth: ' + (e.message || e) }); }

  // 2) Idempotency í Drive: sama kanóníska nafn í möppunni → uppfæra innihald.
  let fileId = null, updated = false;
  try {
    const q = `'${TARGET}' in parents and name = '${name.replace(/'/g, "\\'")}' and trashed = false`;
    const sr = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=2`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (sr.ok) {
      const found = (await sr.json()).files || [];
      if (found.length) { fileId = found[0].id; updated = true; }
    }
  } catch { /* leit brást → höldum áfram og búum til nýtt */ }

  // 3) Hlaða upp í Drive (multipart create, eða media update á fyrirliggjandi skrá).
  try {
    if (fileId) {
      const ur = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
        body: pdfBuf,
      });
      if (!ur.ok) return json(502, { error: `Drive update ${ur.status}: ${(await ur.text()).slice(0, 300)}` });
    } else {
      const boundary = 'bh_uttekt_' + Date.now();
      const meta = JSON.stringify({ name, parents: [TARGET], mimeType: 'application/pdf' });
      const multi = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`),
        pdfBuf,
        Buffer.from(`\r\n--${boundary}--`),
      ]);
      const cr = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: multi,
      });
      if (!cr.ok) return json(502, { error: `Drive upload ${cr.status}: ${(await cr.text()).slice(0, 300)}` });
      fileId = (await cr.json()).id;
    }
  } catch (e) {
    return json(502, { error: 'Drive upload: ' + (e.message || e) });
  }

  // 4) customer_documents: finna base eftir kt, upsert-a röðina.
  let docId = null, docErr = null;
  try {
    const br = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(ktDash)}&select=id&limit=1`, { headers: sbHeaders() });
    const base = br.ok ? (await br.json())[0] : null;
    let baseId = base ? base.id : null;
    if (!baseId) {
      // finna-eða-stofna base fyrir kt (sama og doc-index create-leiðin)
      const cr = await fetch(`${SUPABASE_URL}/rest/v1/customers_base`, {
        method: 'POST',
        headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({ kennitala: ktDash, nafn: company }),
      });
      if (cr.ok) baseId = ((await cr.json())[0] || {}).id;
    }

    const today = new Date().toISOString().slice(0, 10);

    // Er til röð? Reikningur: dedup á R-númerinu (einkvæmt). Skýrsla: (staður, ár).
    let existing = null;
    if (isInv) {
      const nrDash = invNr.replace(/^R-?/, 'R-');
      const er = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?doc_type=eq.reikningur&invoice_number=eq.${encodeURIComponent(nrDash)}&select=id,notes,drive_file_id&limit=1`, { headers: sbHeaders() });
      if (er.ok) existing = (await er.json())[0] || null;
    } else if (fyrirtaekiId) {
      const er = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?fyrirtaeki_id=eq.${fyrirtaekiId}&year=eq.${year}&doc_type=eq.uttektarskyrsla&select=id,notes,drive_file_id&limit=1`, { headers: sbHeaders() });
      if (er.ok) existing = (await er.json())[0] || null;
    }
    if (!existing) {
      // sama drive_file_id þegar skráð (t.d. endursending á sömu skrá)?
      const dr = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(fileId)}&select=id,notes&limit=1`, { headers: sbHeaders() });
      if (dr.ok) existing = (await dr.json())[0] || null;
    }

    if (existing) {
      const notes = ((existing.notes || '') + ` · app-útgáfa ${today}`).slice(0, 500);
      const pr = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${existing.id}`, {
        method: 'PATCH',
        headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({ drive_file_id: fileId, year, notes, ...(baseId ? { customer_base_id: baseId } : {}) }),
      });
      if (pr.ok) docId = ((await pr.json())[0] || {}).id || existing.id;
      else docErr = `PATCH ${pr.status}: ${(await pr.text()).slice(0, 200)}`;
    } else {
      const row = {
        drive_file_id: fileId,
        doc_type: docType,
        year,
        customer_base_id: baseId,
        fyrirtaeki_id: fyrirtaekiId || null,
        customer_name: company,
        notes: `Sjálfvirkt úr appi ${today} · kt ${ktDash}`,
        ...(isInv ? { invoice_number: invNr.replace(/^R-?/, 'R-'), ...(amount != null ? { amount } : {}), ...(docDate ? { doc_date: docDate } : {}) } : {}),
      };
      const ir = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents`, {
        method: 'POST',
        headers: sbHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify(row),
      });
      if (ir.ok) docId = ((await ir.json())[0] || {}).id;
      else if (ir.status === 409) {
        // UNIQUE(drive_file_id) árekstur — röðin er þegar til, sækjum id-ið.
        const rr = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(fileId)}&select=id&limit=1`, { headers: sbHeaders() });
        if (rr.ok) docId = ((await rr.json())[0] || {}).id || null;
      } else docErr = `INSERT ${ir.status}: ${(await ir.text()).slice(0, 200)}`;
    }
  } catch (e) {
    docErr = String(e.message || e);
  }

  // Drive-afritið er komið — skila alltaf fileId þótt skráningin klikki.
  return json(200, { ok: true, drive_file_id: fileId, doc_id: docId, name, updated, fyrirtaeki_id: fyrirtaekiId, ...(resolvedVia ? { resolved_via: resolvedVia } : {}), ...(docErr ? { doc_error: docErr } : {}) });
};

function cors() {
  return {
    'access-control-allow-origin': '*', // m.a. https://slokkvitaeki.netlify.app
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
function json(statusCode, payload) {
  return resp(statusCode, JSON.stringify(payload), { 'content-type': 'application/json', ...cors() });
}
function resp(statusCode, body, headers) { return { statusCode, headers, body }; }
