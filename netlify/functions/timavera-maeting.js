// Timavera → brunaholf bridge.
// Goal: when called, return today's Mæting (attendance) as JSON the
// frontend can render directly — same shape as the rows in the
// "Mæting raw" Google Sheet today (status / name / project / inn / ut /
// hours / gps / note / scraped_at).
//
// STATE (2026-05-20):
//   - We do NOT have Timavera API credentials yet (waiting for support reply).
//   - Until then this function is a PASSTHROUGH to the existing published
//     Google Sheet, so the page can already migrate off the direct-Sheet
//     fetch and start consuming a stable JSON endpoint.
//   - Once credentials arrive, swap the body of fetchFromTimavera() and the
//     frontend keeps working without changes.
//
// ENV VARS (set in Netlify dashboard once known):
//   TIMAVERA_API_BASE      — e.g. https://app.timavera.is/api/v1
//   TIMAVERA_API_TOKEN     — bearer token issued by Timavera support
//   MAETING_SHEET_CSV      — fallback Sheet URL (optional, defaults below)
//
// SCHEDULE: every 10 min via netlify.toml [[plugins]] schedule.
//   When run on a schedule, no req comes in — function just refreshes
//   an in-memory cache (Netlify Functions are stateless, so this only
//   matters if we add KV/Blob caching later).

const DEFAULT_SHEET_CSV =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRXUTGE4Ui3eadS0kGX0d-5LvFbyt5SNWD6ToeRRn1MJ6zoiGng7RK5ZJOVEq6s_x8wkiNLpgU8nHJk/pub?output=csv';

// Hand-rolled CSV parser (Sheets-style: quotes, commas, newlines inside quotes).
function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0]));
}

async function fetchFromSheet(sheetUrl) {
  const r = await fetch(sheetUrl, { redirect: 'follow' });
  if (!r.ok) throw new Error('Sheet CSV fetch failed: HTTP ' + r.status);
  const text = await r.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return { source: 'sheet', last_scrape: null, records: [] };
  const head = rows[0].map(h => h.toLowerCase().trim());
  const idx = (k) => head.indexOf(k);
  const cols = {
    status: idx('status'), name: idx('name'), project: idx('project'),
    inn: idx('inn'), ut: idx('ut'), hours: idx('hours'),
    gps: idx('gps'), note: idx('note'), scraped_at: idx('scraped_at')
  };
  const records = rows.slice(1)
    .map(r => ({
      status:     (r[cols.status]  || '').toLowerCase(),
      name:        r[cols.name]    || '',
      project:     r[cols.project] || '',
      inn:         r[cols.inn]     || '',
      ut:          r[cols.ut]      || '',
      hours:       r[cols.hours]   || '',
      gps:        (r[cols.gps]    || '').toLowerCase(),
      note:        r[cols.note]    || '',
      scraped_at:  r[cols.scraped_at] || ''
    }))
    .filter(x => x.name);
  // Try to parse the first scraped_at timestamp
  let last_scrape = null;
  for (const r of records) {
    const m = (r.scraped_at || '').match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
    if (m) { last_scrape = m[1] + 'T' + m[2] + ':00'; break; }
  }
  return { source: 'sheet', last_scrape, records };
}

async function fetchFromTimavera() {
  // TODO 2026-05-20: implement once Timavera issues an API token.
  // Expected flow:
  //   const r = await fetch(`${process.env.TIMAVERA_API_BASE}/attendance/today`, {
  //     headers: { Authorization: 'Bearer ' + process.env.TIMAVERA_API_TOKEN }
  //   });
  //   if (!r.ok) throw new Error(...);
  //   const data = await r.json();
  //   return { source: 'timavera', last_scrape: new Date().toISOString(), records: data.map(normalize) };
  throw new Error('TIMAVERA_API_TOKEN not configured — falling back to Sheet');
}

export const handler = async (event) => {
  let payload, sourceUsed;
  try {
    if (process.env.TIMAVERA_API_TOKEN) {
      try { payload = await fetchFromTimavera(); sourceUsed = 'timavera'; }
      catch (e) { console.warn('[maeting] timavera failed, falling back:', e.message); }
    }
    if (!payload) {
      const sheet = process.env.MAETING_SHEET_CSV || DEFAULT_SHEET_CSV;
      payload = await fetchFromSheet(sheet);
      sourceUsed = 'sheet-fallback';
    }
    // Compute live counters server-side so the page doesn't have to redo work.
    const mætt = payload.records.filter(x => x.status === 'mætt' || (x.inn && !x.ut));
    const hætt = payload.records.filter(x => x.status === 'hætt' || (x.inn && x.ut));
    const ageMs = payload.last_scrape ? (Date.now() - new Date(payload.last_scrape).getTime()) : null;
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        // Short cache so the page doesn't hammer us, but stays fresh enough.
        'Cache-Control': 'public, max-age=60'
      },
      body: JSON.stringify({
        source: sourceUsed,
        fetched_at: new Date().toISOString(),
        last_scrape: payload.last_scrape,
        stale: ageMs != null && ageMs > 24 * 3600e3,
        age_hours: ageMs != null ? Math.round(ageMs / 3600e3) : null,
        counts: { mætt: mætt.length, hætt: hætt.length, total: payload.records.length },
        records: payload.records
      })
    };
  } catch (err) {
    console.error('[maeting] fatal:', err);
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || String(err), source: sourceUsed || null })
    };
  }
};
