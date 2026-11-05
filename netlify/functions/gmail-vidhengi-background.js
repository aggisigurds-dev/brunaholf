// gmail-vidhengi-background.js — BAKFYLLING viðhengja úr Gmail (Netlify background, 15 mín).
//
//   POST /api/gmail-vidhengi-background  { account, folder: 'inbox'|'sent'|'both', days, q, jobId? }
//
// 05.11.2026 — Agnar: „ég vil geta sótt gögn úr innsoginu … pósta sem minnast á þjónustusamning,
// samning … 3 ár aftur, og úttektarskýrslur 2025 og 2026“. Keyrir gmail-ingest með vidhengi=1 og
// aukaleit q yfir stóran glugga; samstillt HTTP-fall næði ekki að sækja tugi PDF-a innan 10 s.
// Staða í app_kv['gmail_vidhengi:<jobId>'] (sama mynstur og mbox-extract-pdfs-background) svo
// Kerfisheilsa/Agnar geti lesið hana: { stada, byrjad, lokid, keyrslur: [{folder, listed, vidhengi}] }.
//
// Ekki áætlað í netlify.toml — aðeins keyrt viljandi (staff-hlið). Tvítök eru skaðlaus: upsert á
// message_id og unique(account, gmail_msg_id, filename).
'use strict';
const P = require('./_portal');
const { handler: ingest } = require('./gmail-ingest');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function stada(jobId, value) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/app_kv?on_conflict=key`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: `gmail_vidhengi:${jobId}`, value, updated_at: new Date().toISOString() }),
    });
  } catch (_) { /* staða má aldrei fella keyrsluna */ }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'POST only' };
  const g = P.requireStaff(event); if (g) return g;
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (_) { return { statusCode: 400, body: 'JSON' }; }
  const account = String(body.account || 'eldklar@eldklar.is').trim();
  const folders = body.folder === 'both' ? ['inbox', 'sent'] : [body.folder === 'sent' ? 'sent' : 'inbox'];
  const days = String(Math.min(Math.max(parseInt(body.days || '1100', 10) || 1100, 1), 1100));
  const q = String(body.q || 'has:attachment').replace(/[\r\n]/g, ' ').trim().slice(0, 300);
  const jobId = String(body.jobId || Date.now().toString(36)).replace(/[^\w-]/g, '').slice(0, 40);
  const log = { stada: 'keyrir', account, days, q, byrjad: new Date().toISOString(), keyrslur: [] };
  await stada(jobId, log);
  for (const folder of folders) {
    const qs = { account, days, q, vidhengi: '1' };
    if (folder === 'sent') qs.folder = 'sent';
    try {
      const res = await ingest({ httpMethod: 'GET', queryStringParameters: qs }, {});
      let r = {}; try { r = JSON.parse((res && res.body) || '{}'); } catch (_) {}
      log.keyrslur.push({ folder, ok: r.ok !== false, listed: r.listed, upserted: r.upserted, nyir: r.nyir, vidhengi: r.vidhengi || null, error: r.error });
    } catch (e) {
      log.keyrslur.push({ folder, ok: false, error: String((e && e.message) || e) });
    }
    await stada(jobId, log);
  }
  log.stada = log.keyrslur.every(k => k.ok) ? 'lokid' : 'villa';
  log.lokid = new Date().toISOString();
  await stada(jobId, log);
  return { statusCode: 200, body: JSON.stringify({ ok: true, jobId, log }) };
};
