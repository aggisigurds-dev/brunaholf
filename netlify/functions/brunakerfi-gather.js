// brunakerfi-gather.js — safnar BRUNAKERFI-skýrslum (viðtökupróf / árleg prófun á
// brunaviðvörunarkerfi) sem liggja DREIFÐAR um Drive, endurnefnir þær á kanónískt
// snið, FÆRIR þær í „Brunakerfisúttektir"-möppuna og skráir í customer_documents
// (doc_type='brunakerfi'). Byggt á uttekt-rename.js — sömu battle-tested þáttun.
//
//   GET /api/brunakerfi-gather?status=1              → talning (frambjóðendur, eftir)
//   GET /api/brunakerfi-gather?dry=1[&limit=8]       → skoða (ENGIN færsla/skráning)
//   GET /api/brunakerfi-gather[&limit=6]             → FÆRA + skrá (batchað, resumable)
//
// ÖRYGGI: aðeins skrár sem sannreynast (efnislega) sem brunakerfi-skýrsla eru
// færðar. Reikningar, slökkvitækja-úttektir og ólæsileg skjöl eru SLEPPT (ekki
// færð). Færsla er afturkræf (skrá er ekki eytt, bara flutt milli mappa).

const pdf = require('pdf-parse');
const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ISSUER_KT = '6005080400';
const DEST = '1OtsCTzM6FEQbaKBrQ7SqEU6xFKGBWICu';   // „Brunakerfisúttektir" (mappan sem Agnar bjó til)
const MONTHS = 'janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember';

function sbHeaders(extra) {
  return Object.assign({ apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }, extra || {});
}

// ── Drive með backoff (afrit úr uttekt-rename) ─────────────────────────────────
async function driveFetch(url, opts, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, opts);
      if (r.ok || (r.status !== 403 && r.status !== 429 && r.status < 500)) return r;
      last = r;
    } catch (e) { last = e; }
    if (i < tries - 1) await new Promise(res => setTimeout(res, 400 * Math.pow(2, i) + Math.floor(Math.random() * 300)));
  }
  if (last instanceof Error) throw last;
  return last;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  const p = event.queryStringParameters || {};
  const dry = p.dry === '1';
  const limit = Math.min(parseInt(p.limit || (dry ? '8' : '6'), 10) || 6, 12);
  const offset = Math.max(parseInt(p.offset || '0', 10) || 0, 0);

  // Frambjóðendur: PDF með brunakerfi-vísandi nafni, hvar sem er á Drive-inu.
  // (Nafna-forsía; INNIHALD sker svo úr — sjá isBruna.) Raðað eftir id svo
  // offset-gluggin sé STÖÐUGUR milli kalla (skrár sem eru færðar/sleppt fara
  // ekki úr listanum, en offset skríður framhjá þeim → hver skrá heimsótt einu
  // sinni; annars myndu sleppt skjöl endurskannast endalaust).
  let candidates;
  try { candidates = await findCandidates(token); }
  catch (e) { return json(500, { error: 'Drive leit mistókst: ' + e.message }); }
  candidates.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const alreadyDone = candidates.filter(f => (f.parents || []).includes(DEST)).length;
  if (p.status === '1') {
    return json(200, { total_candidates: candidates.length, already_in_dest: alreadyDone, pending: candidates.length - alreadyDone });
  }

  // ── DEDUP: fjarlægja tvítök í áfangamöppunni (afturkræft — í rusl) ──────────
  //   ?dedup=1        → HENDA (trasha) tvítökum
  //   ?dedup=1&dry=1  → sýna aðeins hvað yrði hent
  // Tvö skref: (1) sama md5 = 100% eins innihald; (2) sama NAFN. Í báðum er einu
  // eintaki HALDIÐ (helst án „(1)"/„copy"-viðskeytis, annars elsta).
  if (p.dedup === '1') {
    const files = await listFolderMeta(DEST, token);
    const trash = new Set();
    let byMd5 = 0, byName = 0;
    const g5 = {}; files.forEach(f => { if (f.md5Checksum) (g5[f.md5Checksum] = g5[f.md5Checksum] || []).push(f); });
    Object.values(g5).forEach(g => { if (g.length > 1) { const keep = pickKeeper(g); g.forEach(x => { if (x.id !== keep.id) { trash.add(x.id); byMd5++; } }); } });
    const gn = {}; files.forEach(f => { if (!trash.has(f.id)) (gn[f.name] = gn[f.name] || []).push(f); });
    Object.values(gn).forEach(g => { if (g.length > 1) { const keep = pickKeeper(g); g.forEach(x => { if (x.id !== keep.id && !trash.has(x.id)) { trash.add(x.id); byName++; } }); } });
    const ids = [...trash];
    let trashed = 0;
    const T = Date.now();
    if (!dry) for (const id of ids) {
      if ((Date.now() - T) > 8000) break;   // tímavörn — afgangur í næsta kalli (resumable)
      try { if (await trashFile(id, token)) trashed++; } catch (_) {}
    }
    return json(200, { dedup: true, total: files.length, would_trash: ids.length, trashed, remaining: ids.length - trashed, by_md5: byMd5, by_name: byName, dry });
  }

  // ── CONNECT-sweep: skrá HVERT PDF í áfangamöppunni sem er ekki þegar tengt ──
  //   ?connect=1[&offset=N]  → les innihald, tengir base/stað, upsert-ar (batchað)
  if (p.connect === '1') {
    const files = (await listFolderMeta(DEST, token)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const st = { connect: true, total: files.length, offset, scanned: 0, indexed: 0, skipped: 0, errors: 0 };
    const T = Date.now(); let w = 0, j = offset;
    for (; j < files.length; j++) {
      if (w >= limit || (Date.now() - T) > 9000) break;
      const f = files[j];
      try {
        const ex = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(f.id)}&select=id&limit=1`, { headers: sbHeaders() });
        const exr = await ex.json().catch(() => []);
        if (Array.isArray(exr) && exr[0]) { st.skipped++; continue; }   // þegar tengt
        w++; st.scanned++;
        const text = await readPdfText(f.id, token);
        const parsed = await parseReport(text, f.name);
        await fetch(`${SUPABASE_URL}/rest/v1/customer_documents`, {
          method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }),
          body: JSON.stringify({ drive_file_id: f.id, doc_type: 'brunakerfi', year: parsed.year ? +parsed.year : null,
            customer_base_id: parsed.base ? parsed.base.id : null, fyrirtaeki_id: parsed.siteId || null,
            customer_name: parsed.company, notes: 'brunakerfi-connect ' + new Date().toISOString().slice(0, 10) }) });
        st.indexed++;
      } catch (e) { st.errors++; }
    }
    st.nextOffset = j < files.length ? j : null; st.done = st.nextOffset === null;
    return json(200, st);
  }

  // ── SERVICE-sweep: tengiliðir + búa til/uppfæra fyrirtæki í brunakerfisþjónustu ─
  //   ?service=1[&offset=N]  → les hverja skýrslu, dregur út síma/netfang/tengilið,
  //   fyllir AUÐA reiti á fyrirtækinu (yfirskrifar aldrei), setur er_i_thjonustu=true,
  //   BÝR TIL fyrirtæki+base ef kt er ekki til, og bætir staðnum í brunakerfi-listann
  //   (app_settings.brunakerfi_customers). Batchað.
  if (p.service === '1') {
    const files = (await listFolderMeta(DEST, token)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const st = { service: true, total: files.length, offset, scanned: 0, contact_filled: 0, upgraded: 0, created: 0, ambiguous: 0, no_kt: 0, errors: 0, map_added: 0 };
    const addIds = [];
    const T = Date.now(); let w = 0, j = offset;
    for (; j < files.length; j++) {
      if (w >= limit || (Date.now() - T) > 9000) break;
      const f = files[j]; w++; st.scanned++;
      try {
        const text = await readPdfText(f.id, token);
        const pr = await parseReport(text, f.name);
        const contact = parseContact(text);
        if (pr.base && pr.siteId) {
          if (await updateSiteContact(pr.siteId, contact)) st.contact_filled++;
          st.upgraded++; addIds.push(pr.siteId);
        } else if (pr.base && !pr.siteId) {
          st.ambiguous++;   // rekstrarfélag með marga staði → Skýrslu-stöð sker úr
        } else if (!pr.base && pr.kt && pr.kt.length === 10 && pr.kt !== '9999999999') {
          const base = await createBase(pr.kt, pr.company);
          if (base) {
            const site = await createSite(pr.kt, pr.company, pr.address, contact, base.id);
            if (site) {
              st.created++; addIds.push(site.id);
              await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(f.id)}`, {
                method: 'PATCH', headers: sbHeaders(), body: JSON.stringify({ customer_base_id: base.id, fyrirtaeki_id: site.id }) });
            }
          }
        } else { st.no_kt++; }
      } catch (e) { st.errors++; }
    }
    st.map_added = await addToBrunakerfiMap([...new Set(addIds)]);
    st.nextOffset = j < files.length ? j : null; st.done = st.nextOffset === null;
    return json(200, st);
  }

  const stats = { dest: DEST, total_candidates: candidates.length, offset,
                  scanned: 0, moved: 0, indexed: 0, skipped: 0, errors: 0, rows: [] };
  const T0 = Date.now();
  let work = 0;
  let idx = offset;
  for (; idx < candidates.length; idx++) {
    if (work >= limit || (Date.now() - T0) > 9000) break;
    const f = candidates[idx];
    // Þegar í áfangamöppunni → búið (offset skríður framhjá án niðurhals).
    if ((f.parents || []).includes(DEST)) { continue; }
    work++; stats.scanned++;
    try {
      const text = await readPdfText(f.id, token);
      const isInvoice = /\bR[\s_-]?\d{5,7}\b/i.test(f.name) || /til greiðslu|reikningsnr|gjalddagi\s*-?\s*eindagi|samtals fyrir vsk/i.test(text);
      // Efnisleg staðfesting: brunaviðvörunarkerfi viðtökupróf/árleg prófun.
      // Aðgreint frá slökkvitækja-úttekt (sem hefur „Fjöldi:"-búnaðartöflu).
      const brunaHit = /brunaviðvörunarkerfi|viðtökupróf|árleg prófun/i.test(text);
      const brunaBody = /stjórnstöð|jaðarbúnað|boðsendir|reykskynjur|handboð/i.test(text);
      const hasIssuer = text.replace(/\D/g, '').includes(ISSUER_KT);
      const isBruna = !isInvoice && brunaHit && (brunaBody || hasIssuer);
      if (!isBruna) {
        stats.skipped++;
        stats.rows.push({ fileId: f.id, name: f.name, action: 'skip',
          reason: isInvoice ? 'reikningur' : !brunaHit ? 'ekki brunakerfi-skýrsla (innihald)' : 'óviss' });
        continue;
      }

      // Þáttun (sömu reglur og uttekt-rename)
      let kt = customerKt(text);
      const old = fieldsFromOldName(f.name);
      kt = kt || old.kt || null;
      let base = kt ? await matchBase(kt) : null;
      const party = parseParty(text, base && base.nafn);
      const realish = c => { const t = String(c || '').normalize('NFD').replace(/[^a-z]/gi, ''); return t.length >= 3 && !/^kt[\s\d-]*$/i.test(String(c || '').trim()); };
      let company = (base && realish(base.nafn)) ? String(base.nafn).trim()
                  : realish(party.company) ? String(party.company).trim()
                  : (party.company || (base && base.nafn) || old.company || '').trim();
      const address = expandCity(stripCompanyPrefix(old.address || party.address || extractAddress(text), company));
      const di = dateInfo(text);
      const nameYear = (f.name.match(/\b(20[0-3]\d)\b/) || [])[1] || '';
      const month = di.month || old.month || '';
      const year = di.year || old.year || nameYear || '';
      // Öfug kt-uppfletting eftir nafni ef kt vantar
      if (!kt && realish(company)) { const fk = await ktByCompanyName(company, address); if (fk) { kt = fk.replace(/\D/g, ''); base = await matchBase(kt); } }
      const siteId = base ? await matchSite(base.id, address) : null;

      // Kanónískt nafn ef nóg er vitað; annars halda upphaflegu nafni.
      let newName = f.name;
      if (realish(company) && kt && year) {
        newName = sanitize(company) + (address ? ' - ' + sanitize(address) : '') + ' - ' + dash(kt) + ' - ' + year + (month ? ' - ' + month : '') + ' - brunakerfi' + (siteId ? ' - #' + siteId : '') + '.pdf';
      }

      const row = { fileId: f.id, oldName: f.name, newName, company, kt: kt ? dash(kt) : '', address, year: year || '', site_id: siteId || null };

      if (dry) { row.action = 'would-move'; stats.rows.push(row); continue; }

      // 1) FÆRA (+ endurnefna) í áfangamöppuna — addParents/removeParents.
      const removeParents = (f.parents || []).join(',');
      const upd = await driveFetch(
        'https://www.googleapis.com/drive/v3/files/' + f.id + '?supportsAllDrives=true&addParents=' + DEST +
          (removeParents ? '&removeParents=' + encodeURIComponent(removeParents) : '') + '&fields=id,parents',
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(newName !== f.name ? { name: newName } : {}) });
      if (!upd.ok) { stats.errors++; row.action = 'error'; row.error = 'move ' + upd.status + ': ' + (await upd.text().catch(() => '')).slice(0, 120); stats.rows.push(row); continue; }
      stats.moved++; row.action = 'moved';

      // 2) SKRÁ í customer_documents (doc_type='brunakerfi'), idempotent á drive_file_id.
      try {
        const ex = await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?drive_file_id=eq.${encodeURIComponent(f.id)}&select=id&limit=1`, { headers: sbHeaders() });
        const exRows = await ex.json().catch(() => []);
        if (Array.isArray(exRows) && exRows[0]) {
          await fetch(`${SUPABASE_URL}/rest/v1/customer_documents?id=eq.${exRows[0].id}`, {
            method: 'PATCH', headers: sbHeaders(),
            body: JSON.stringify(Object.assign({ doc_type: 'brunakerfi', year: year ? +year : null, customer_name: company },
              base ? { customer_base_id: base.id } : {}, siteId ? { fyrirtaeki_id: siteId } : {})) });
          row.indexed = 'updated';
        } else {
          await fetch(`${SUPABASE_URL}/rest/v1/customer_documents`, {
            method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }),
            body: JSON.stringify({ drive_file_id: f.id, doc_type: 'brunakerfi', year: year ? +year : null,
              customer_base_id: base ? base.id : null, fyrirtaeki_id: siteId || null, customer_name: company,
              notes: 'brunakerfi-gather ' + new Date().toISOString().slice(0, 10) }) });
          row.indexed = 'inserted';
        }
        stats.indexed++;
      } catch (e) { row.index_error = String(e.message || e); }
      stats.rows.push(row);
    } catch (e) { stats.errors++; stats.rows.push({ fileId: f.id, name: f.name, action: 'error', error: String(e.message || e) }); }
  }
  stats.nextOffset = idx < candidates.length ? idx : null;
  stats.done = stats.nextOffset === null;
  return json(200, stats);
};

// ── Frambjóðenda-leit: brunakerfi-vísandi nöfn hvar sem er á Drive ─────────────
async function findCandidates(token) {
  // Drive `contains` er hástafa-ónæmt; nota mörg brot (broddstafir brenglast í
  // skráarheitum) OR-að. INNIHALD sker svo úr — þetta er bara forsía.
  const tokens = ['brunakerf', 'runaker', 'brunaviðvörun', 'runavi', 'viðtökupr', 'i_t_kupr', 'vidtokupr', 'árleg prófun', 'rleg pr'];
  const seen = {};
  for (const tk of tokens) {
    let pageToken = null;
    do {
      const params = new URLSearchParams({
        q: `name contains '${tk.replace(/'/g, "\\'")}' and mimeType='application/pdf' and trashed=false`,
        fields: 'files(id,name,parents),nextPageToken', pageSize: '300',
        includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const r = await driveFetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('list ' + r.status);
      const d = await r.json();
      for (const f of (d.files || [])) seen[f.id] = f;
      pageToken = d.nextPageToken;
    } while (pageToken);
  }
  return Object.values(seen);
}
// Möppu-listi með md5 + createdTime (fyrir dedup + connect).
async function listFolderMeta(folder, token) {
  const out = []; let pageToken = null;
  do {
    const params = new URLSearchParams({ q: `'${folder.replace(/'/g, "\\'")}' in parents and trashed=false`, fields: 'files(id,name,md5Checksum,createdTime),nextPageToken', pageSize: '300', includeItemsFromAllDrives: 'true', supportsAllDrives: 'true', corpora: 'allDrives' });
    if (pageToken) params.set('pageToken', pageToken);
    const r = await driveFetch('https://www.googleapis.com/drive/v3/files?' + params, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error('list ' + r.status);
    const d = await r.json();
    for (const f of (d.files || [])) if (/pdf$/i.test(f.name)) out.push(f);
    pageToken = d.nextPageToken;
  } while (pageToken);
  return out;
}
async function trashFile(id, token) {
  const r = await driveFetch('https://www.googleapis.com/drive/v3/files/' + id + '?supportsAllDrives=true&fields=id', {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  return r.ok;
}
// Hvaða eintaki á að HALDA í tvítaka-hópi: helst nafn ÁN afrit-viðskeytis
// („ (1)", „copy", „-kópía"), annars elsta (createdTime).
function pickKeeper(group) {
  const clean = group.filter(f => !/\((\d+)\)\.pdf$|\bcopy\b|kópía|afrit/i.test(f.name));
  const pool = clean.length ? clean : group;
  return pool.slice().sort((a, b) => String(a.createdTime || '').localeCompare(String(b.createdTime || '')))[0];
}
// Búa til canonical base ef kt er ekki til (additive; matchBase staðfesti null).
async function createBase(kt, nafn) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base`, {
    method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({ kennitala: dash(kt), nafn: (nafn && nafn.trim()) || ('kt ' + dash(kt)) }) });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
// Búa til fyrirtæki (staður) fyrir nýtt brunakerfi-fyrirtæki.
async function createSite(kt, nafn, address, contact, baseId) {
  const body = { kennitala: dash(kt), nafn: (nafn && nafn.trim()) || ('kt ' + dash(kt)),
    heimilisfang: address || null, er_i_thjonustu: true, customer_base_id: baseId };
  if (contact.simi) body.simi = contact.simi;
  if (contact.netfang) body.netfang = contact.netfang;
  if (contact.tengilidur) body['tengiliður'] = contact.tengilidur;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki`, {
    method: 'POST', headers: sbHeaders({ Prefer: 'return=representation' }), body: JSON.stringify(body) });
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
// Fylla AÐEINS auða reiti (yfirskrifar aldrei) + setja er_i_thjonustu=true.
async function updateSiteContact(siteId, contact) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?id=eq.${siteId}&select=simi,netfang,${encodeURIComponent('tengiliður')},er_i_thjonustu`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  const cur = rows[0] || {};
  const patch = {};
  if (contact.simi && !cur.simi) patch.simi = contact.simi;
  if (contact.netfang && !cur.netfang) patch.netfang = contact.netfang;
  if (contact.tengilidur && !cur['tengiliður']) patch['tengiliður'] = contact.tengilidur;
  if (!cur.er_i_thjonustu) patch.er_i_thjonustu = true;
  if (!Object.keys(patch).length) return 0;
  await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?id=eq.${siteId}`, { method: 'PATCH', headers: sbHeaders(), body: JSON.stringify(patch) });
  return 1;
}
// Bæta stöðum í brunakerfisþjónustu-listann (app_settings.settings.brunakerfi_customers).
async function addToBrunakerfiMap(ids) {
  if (!ids.length) return 0;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1&select=settings`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  const exists = Array.isArray(rows) && rows[0];
  const settings = (exists && rows[0].settings) || {};
  const map = settings.brunakerfi_customers || {};
  let added = 0;
  for (const id of ids) { if (!map[id]) { map[id] = true; added++; } }
  settings.brunakerfi_customers = map;
  if (exists) {
    await fetch(`${SUPABASE_URL}/rest/v1/app_settings?id=eq.1`, { method: 'PATCH', headers: sbHeaders(), body: JSON.stringify({ settings, updated_at: new Date().toISOString() }) });
  } else {
    await fetch(`${SUPABASE_URL}/rest/v1/app_settings`, { method: 'POST', headers: sbHeaders({ Prefer: 'return=minimal' }), body: JSON.stringify({ id: 1, settings, updated_at: new Date().toISOString() }) });
  }
  return added;
}
// Tengiliðaupplýsingar úr skýrslunni: sími / netfang / tengiliður.
// Útilokar SÖLUAÐILANN (Slökkvitæki: sími 565-4080, eldklar/brunaholf netföng).
function parseContact(text) {
  const t = String(text || '');
  let simi = '';
  for (const m of t.matchAll(/S[íi]mi\s*:?\s*(\d[\d\s-]{5,11}\d)/gi)) {
    const d = m[1].replace(/[\s-]/g, '');
    if (d && d !== '5654080' && d.length >= 6) { simi = d; break; }
  }
  let tengilidur = '';
  const tm = t.match(/Tengili[ðd]ur\s+([A-ZÁÉÍÓÚÝÆÖÞÐ][^\n]{1,40}?)\s*(?:Heimilisf|Kennitala|P[óo]stnr|S[íi]mi|Netfang|$)/i);
  if (tm) tengilidur = tm[1].replace(/\s+/g, ' ').trim();
  let netfang = '';
  for (const m of t.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
    if (!/eldklar|slokkvit|brunaholf/i.test(m[0])) { netfang = m[0]; break; }
  }
  return { simi, netfang, tengilidur };
}
// Þáttun skýrslu → {base, siteId, company, year} (fyrir connect-sweep).
async function parseReport(text, name) {
  let kt = customerKt(text);
  const old = fieldsFromOldName(name);
  kt = kt || old.kt || null;
  let base = kt ? await matchBase(kt) : null;
  const party = parseParty(text, base && base.nafn);
  const realish = c => { const t = String(c || '').normalize('NFD').replace(/[^a-z]/gi, ''); return t.length >= 3 && !/^kt[\s\d-]*$/i.test(String(c || '').trim()); };
  let company = (base && realish(base.nafn)) ? String(base.nafn).trim() : realish(party.company) ? String(party.company).trim() : (party.company || (base && base.nafn) || old.company || '').trim();
  const address = expandCity(stripCompanyPrefix(old.address || party.address || extractAddress(text), company));
  const di = dateInfo(text);
  const nameYear = (name.match(/\b(20[0-3]\d)\b/) || [])[1] || '';
  const year = di.year || old.year || nameYear || '';
  if (!kt && realish(company)) { const fk = await ktByCompanyName(company, address); if (fk) { kt = fk.replace(/\D/g, ''); base = await matchBase(kt); } }
  const siteId = base ? await matchSite(base.id, address) : null;
  return { kt, base, company, address, year, siteId };
}
async function readPdfText(id, token) {
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return '';
  const buf = Buffer.from(await r.arrayBuffer());
  const d = await pdf(buf).catch(() => null);
  let text = d ? d.text : '';
  if ((text || '').replace(/\s/g, '').length < 25) {
    const viaG = await driveExtractText(id, token).catch(() => '');
    if (viaG && viaG.replace(/\s/g, '').length >= 25) text = viaG;
  }
  return text;
}
async function driveExtractText(id, token) {
  const cp = await driveFetch('https://www.googleapis.com/drive/v3/files/' + id + '/copy?supportsAllDrives=true&fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'tmp-ocr-' + id, mimeType: 'application/vnd.google-apps.document' }) });
  if (!cp.ok) return '';
  const doc = await cp.json(); if (!doc || !doc.id) return '';
  let text = '';
  try { const ex = await driveFetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '/export?mimeType=text/plain', { headers: { Authorization: `Bearer ${token}` } }); if (ex.ok) text = await ex.text(); } catch (_) {}
  try { await driveFetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '?supportsAllDrives=true', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }); } catch (_) {}
  return text;
}

// ── Þáttun (afrit úr uttekt-rename.js) ─────────────────────────────────────────
function allKts(s) { const out = []; const re = /\b(\d{6})-?(\d{4})\b/g; let m; while ((m = re.exec(s))) out.push(m[1] + m[2]); return out; }
function customerKt(s) { for (const kt of allKts(s)) if (kt !== ISSUER_KT) return kt; return null; }
const MNAME = { 1: 'janúar', 2: 'febrúar', 3: 'mars', 4: 'apríl', 5: 'maí', 6: 'júní', 7: 'júlí', 8: 'ágúst', 9: 'september', 10: 'október', 11: 'nóvember', 12: 'desember' };
function dateInfo(text) {
  const t = String(text || '');
  const m = t.match(/\bdags\.?\s*:?\s*(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/i);
  if (m) { const mo = parseInt(m[2], 10); let y = m[3]; if (y.length === 2) y = '20' + y; if (mo >= 1 && mo <= 12) return { month: MNAME[mo], year: y }; }
  const re = new RegExp('\\b(' + MONTHS + ')\\s+(20\\d{2})\\b', 'gi');
  let mm;
  while ((mm = re.exec(t))) { const before = t.slice(Math.max(0, mm.index - 32), mm.index); if (/næst|next/i.test(before)) continue; return { month: mm[1].toLowerCase(), year: mm[2] }; }
  return { month: '', year: '' };
}
function parseParty(text, baseName) {
  const t = String(text || '');
  const m = t.match(/hjá\s+fyrirt(?:æki|aeki)nu\s+(.+?)\.?\s*Kt\b/i);
  if (m) {
    const full = m[1].replace(/\s+/g, ' ').trim();
    const pc = full.match(/^(.*?)[,\s]+(\d{3})\s+([A-ZÁÉÍÓÚÝÆÖÞÐ][a-záéíóúýæöþð]+(?:\s*\([^)]*\))?)\s*$/);
    if (!pc) return { company: baseName || full, address: '' };
    const head = pc[1].trim();
    const st = head.match(/^(.*?)\s*([A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.\-]*\s+\d{1,4}[a-dA-D]?)\s*$/);
    let company = '', street = head;
    if (st) { street = st[2].trim(); company = (st[1] || '').trim(); }
    return { company: company || baseName || '', address: street + ', ' + pc[2] + ' ' + pc[3] };
  }
  let company = '', address = '';
  const cm = t.match(/Verkkaupi\s+(.+?)\s+Kennitala/i);
  if (cm) company = cm[1].replace(/\s+/g, ' ').trim();
  const am = t.match(/Heimilisf\.?\s*(.+?)\s*Póstnr\.?\s*(\d{3})\s+([A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.]*)/i);
  if (am) {
    const street = am[1].replace(/^\s*vegna/i, '').replace(/\s+/g, ' ').trim();
    const city = am[3].replace(/\.$/, '').replace(/^Rvk$/i, 'Reykjavík').replace(/^Hfj$/i, 'Hafnarfjörður').replace(/^Kóp$/i, 'Kópavogur');
    address = street + ', ' + am[2] + ' ' + city;
  }
  return { company: company || baseName || '', address };
}
function extractAddress(text) {
  const t = String(text || '');
  const pairRe = /([A-ZÁÉÍÓÚÝÆÖÞÐ][A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.\-]*(?:[^\S\n]+[A-Za-zÁÉÍÓÚÝÆÖÞÐáéíóúýæöþð.\-]+){0,3}[^\S\n]+\d{1,4}(?:[^\S\n]*[-–][^\S\n]*\d{1,4})?[a-dA-D]?)[,\s]+(\d{3}[^\S\n]+[A-ZÁÉÍÓÚÝÆÖÞÐ][a-záéíóúýæöþð]+(?:bær|borg)?)/g;
  let m;
  while ((m = pairRe.exec(t))) {
    const street = m[1].replace(/\s+/g, ' ').trim(), city = m[2].replace(/\s+/g, ' ').trim();
    if (/helluhraun|slökkvitæki|brunakerfi|vsk\s*nr/i.test(street)) continue;
    return street + ', ' + city;
  }
  return '';
}
function fieldsFromOldName(name) {
  const parts = String(name || '').replace(/\.pdf$/i, '').split(' - ').map(s => s.trim());
  const out = { company: '', address: '', kt: '', month: '', year: '' };
  const ktIdx = parts.findIndex(s => /^\d{6}-?\d{4}$/.test(s.replace(/\s/g, '')));
  out.company = (ktIdx === 0) ? '' : (parts[0] || '');
  if (ktIdx >= 0) {
    out.kt = parts[ktIdx].replace(/\D/g, '');
    if (ktIdx > 1) out.address = parts.slice(1, ktIdx).join(', ').replace(/\s+/g, ' ').trim();
    parts.slice(ktIdx + 1).forEach(p => {
      if (new RegExp('^(' + MONTHS + ')$', 'i').test(p)) out.month = p.toLowerCase();
      else if (/^20\d{2}$/.test(p)) out.year = p;
    });
  }
  return out;
}
function stripCompanyPrefix(addr, company) {
  let a = String(addr || '').replace(/\s+/g, ' ').trim();
  const c = String(company || '').trim();
  if (c && a.toLowerCase().indexOf(c.toLowerCase()) === 0) a = a.slice(c.length).replace(/^[\s,;:.\-]+/, '').trim();
  return a;
}
function expandCity(a) {
  return String(a || '')
    .replace(/\b(\d{3})\s+Rvk\.?\b/i, '$1 Reykjavík').replace(/\b(\d{3})\s+Hfj\.?\b/i, '$1 Hafnarfjörður')
    .replace(/\b(\d{3})\s+Kóp\.?\b/i, '$1 Kópavogur').replace(/\b(\d{3})\s+Grb\.?\b/i, '$1 Garðabær')
    .replace(/\b(\d{3})\s+Mos\.?\b/i, '$1 Mosfellsbær').replace(/\s+/g, ' ').trim();
}
const dash = kt => (kt && kt.length === 10) ? kt.slice(0, 6) + '-' + kt.slice(6) : kt;
function sanitize(s) { return String(s || '').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 70); }
function foldNm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(ehf|hf|slf|sf)\.?\b/g, '').replace(/[^a-z0-9]+/g, ''); }
let _ktByNameCache = null;
async function ktByCompanyName(company, address) {
  const key = foldNm(company);
  if (!key || key.length < 4) return null;
  if (!_ktByNameCache) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?deleted_at=is.null&kennitala=not.is.null&select=nafn,kennitala,heimilisfang&limit=5000`, { headers: sbHeaders() });
    const rows = await r.json().catch(() => []);
    _ktByNameCache = Array.isArray(rows) ? rows : [];
  }
  const hits = _ktByNameCache.filter(x => foldNm(x.nafn) === key && String(x.kennitala || '').replace(/\D/g, '').length === 10);
  if (!hits.length) return null;
  const kts = [...new Set(hits.map(h => String(h.kennitala).replace(/\D/g, '')))];
  if (kts.length === 1) return hits[0].kennitala;
  if (address) {
    const ak = siteAddrKey(address);
    const byAddr = hits.filter(h => siteAddrKey(h.heimilisfang) === ak);
    const akts = [...new Set(byAddr.map(h => String(h.kennitala).replace(/\D/g, '')))];
    if (akts.length === 1) return byAddr[0].kennitala;
  }
  return null;
}
async function matchBase(kt) {
  if (!kt) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/customers_base?kennitala=eq.${encodeURIComponent(dash(kt))}&select=id,nafn&limit=1`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  return (Array.isArray(rows) && rows[0]) ? rows[0] : null;
}
function siteAddrKey(s) {
  const t = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const num = (t.match(/(\d+)/) || [])[1] || '';
  const street = (t.replace(/\d.*/, '').match(/[a-z]+/g) || []).join('').slice(0, 6);
  return street + '|' + num;
}
async function matchSite(baseId, address) {
  if (!baseId) return null;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/fyrirtaeki?customer_base_id=eq.${baseId}&deleted_at=is.null&select=id,heimilisfang`, { headers: sbHeaders() });
  const rows = await r.json().catch(() => []);
  if (!Array.isArray(rows) || !rows.length) return null;
  if (rows.length === 1) return rows[0].id;
  const ak = siteAddrKey(address);
  if (!ak || ak === '|') return null;
  const m = rows.filter(s => siteAddrKey(s.heimilisfang) === ak);
  return m.length === 1 ? m[0].id : null;
}
