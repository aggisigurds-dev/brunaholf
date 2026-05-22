// sheet-create.js — creates the Luna ↔ Aggi shared Google Sheet.
// POST /api/sheet-create  body { title?, force? }
// Returns { id, url, alreadyExisted }

const { freshAccessToken, json, cors } = require('./_google');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}
  const title = (body.title || 'Brunahólf — Luna ↔ Aggi vinnuborð').trim();
  const force = !!body.force;

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  // Have we already created one? (stored in google_oauth.notes or a side table)
  if (!force) {
    const existing = await loadExisting();
    if (existing && existing.sheet_id) {
      return json(200, { id: existing.sheet_id, url: existing.sheet_url, alreadyExisted: true });
    }
  }

  // 1. Create the spreadsheet with named sheets
  const createBody = {
    properties: { title, locale: 'is_IS', timeZone: 'Atlantic/Reykjavik' },
    sheets: [
      { properties: { sheetId: 0, title: 'Samtal Luna ↔ Aggi', gridProperties: { rowCount: 200, columnCount: 6 } } },
      { properties: { sheetId: 1, title: 'Tenglar (pricelist, drög…)', gridProperties: { rowCount: 60, columnCount: 4 } } },
      { properties: { sheetId: 2, title: 'Útreikningar — Landsspítalinn', gridProperties: { rowCount: 300, columnCount: 12 } } },
      { properties: { sheetId: 3, title: 'Útreikningar — almenn vinnuborð', gridProperties: { rowCount: 300, columnCount: 12 } } },
      { properties: { sheetId: 4, title: 'Tækifæri og verkefnaröð',       gridProperties: { rowCount: 200, columnCount: 6 } } },
    ],
  };

  let sheet;
  try {
    const r = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody),
    });
    if (!r.ok) return json(r.status, { error: `Sheets create: ${(await r.text()).slice(0, 400)}` });
    sheet = await r.json();
  } catch (e) {
    return json(500, { error: e.message });
  }

  // 2. Seed content
  const data = [
    {
      range: "'Samtal Luna ↔ Aggi'!A1:F1",
      values: [['Hver', 'Tími', 'Spurning / svar', 'Staða', 'Tag', 'Athugasemd']],
    },
    {
      range: "'Samtal Luna ↔ Aggi'!A2:F4",
      values: [
        ['Luna',   new Date().toISOString().slice(0,16).replace('T',' '), 'Vinnuborðið var sett upp í kvöld. Skrifa hér og ég mun lesa.', 'Opnað', 'setup', 'Eftirfarandi blöð ætluð fyrir mismunandi gögn.'],
        ['Aggi',  '',                                                      'Skrifa hér…',                                                  'Nýtt',  '',      ''],
        ['Luna',   '',                                                      '',                                                              '',      '',      ''],
      ],
    },
    {
      range: "'Tenglar (pricelist, drög…)'!A1:D1",
      values: [['Heiti', 'Slóð', 'Tegund', 'Lýsing']],
    },
    {
      range: "'Tenglar (pricelist, drög…)'!A2:D5",
      values: [
        ['Brunahólf hub',          'https://brunaholf.netlify.app',                                'Vefur',   'Stjórnstöð (Inbox, Tímavera, Verðsamanburður, Verkstaðir…)'],
        ['Slökkvitæki app',        'https://slokkvitaeki.netlify.app',                             'Vefur',   'Vörusala app'],
        ['Supabase dashboard',     'https://supabase.com/dashboard/project/osfdzskyvisifcwyjkuk', 'Vefur',   'Gagnagrunnur (RLS — service_role only)'],
        ['Payday — Reikningar',    'https://app.payday.is/is/invoices/',                           'Vefur',   'Útgefnir reikningar (168 í ár)'],
      ],
    },
    {
      range: "'Útreikningar — Landsspítalinn'!A1:E1",
      values: [['Þáttur', 'Eining', 'Magn', 'Einingaverð', 'Samtals']],
    },
    {
      range: "'Útreikningar — Landsspítalinn'!A2:E2",
      values: [['(Aggi — bæta við úr Tekjur2 sheet eða leikið mér útreikninga hér)', '', '', '', '']],
    },
    {
      range: "'Tækifæri og verkefnaröð'!A1:F1",
      values: [['Forgangur','Heiti','Lýsing','Áætluð virði (kr)','Eigandi','Staða']],
    },
    {
      range: "'Tækifæri og verkefnaröð'!A2:F7",
      values: [
        ['Hátt', 'Innheimta Dalvegur 24',              'Þrjár ógr. reikningar, samtals ~32M kr',          '32.000.000', 'Aggi', 'Bíð'],
        ['Hátt', 'Innheimta Krókur 77 Gullslétta 18',  'Reikningur #161, ógr. síðan í fyrra (~15M kr)',  '14.990.147', 'Aggi', 'Bíð'],
        ['Hátt', 'Útgefa Mannverk Laugarás Lagoon',    'Drög #3295122, aldrei sent — 10,6M kr',          '10.634.769', 'Aggi', 'Bíð'],
        ['Mið',  'Innheimta ÞG verktakar Landsspítal.', 'Reikningur #310 frá 30.4 — 7,7M kr',             '7.665.338',  'Aggi', 'Bíð'],
        ['Mið',  'Hreinsa "Ekki sett" Tilvísanir í Payday', '~8 reikningar með Tilvísun=Ekki sett',     '',           'Aggi', 'Bíð'],
        ['Lágt', 'Vörueyða: ný 6L Léttvatn til sölu',   'Markaður 11k–17k kr; við seljum bara hleðslur', '',          'Aggi', 'Bíð'],
      ],
    },
  ];

  try {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, valueInputOption: 'USER_ENTERED' }),
    });
    if (!r.ok) console.error('Seed failed:', await r.text());
  } catch (e) { console.error('Seed error:', e.message); }

  // 3. Store the sheet id so we don't recreate it
  await saveExisting(sheet.spreadsheetId, sheet.spreadsheetUrl, title);

  return json(200, {
    id: sheet.spreadsheetId,
    url: sheet.spreadsheetUrl,
    alreadyExisted: false,
  });
};

async function loadExisting() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/app_kv?key=eq.luna_sheet&select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return null;
  const arr = await r.json();
  if (!arr[0]) return null;
  try {
    const v = typeof arr[0].value === 'string' ? JSON.parse(arr[0].value) : arr[0].value;
    return v;
  } catch { return null; }
}

async function saveExisting(sheet_id, sheet_url, title) {
  await fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=key`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      key: 'luna_sheet',
      value: { sheet_id, sheet_url, title, created_at: new Date().toISOString() },
    }),
  });
}
