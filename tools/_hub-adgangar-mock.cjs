// Supabase-líkan í minni fyrir hub-adgangar (próf + staðbundinn prófunarþjónn). Snertir enga raunveruleg gögn.
process.env.SUPABASE_URL = 'http://mock.local';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
const crypto = require('crypto');
const path = require('path');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ── líkan af Supabase REST ──
const db = { hub_adgangar: [], hub_adgangar_stilling: [], agent_logs: [] };
let nextId = 1; const mails = [];
const CODE = 'ABCDE-12345-FGHIJ-67890';
db.hub_adgangar_stilling.push({ id: 1, pw_hash: null, pw_enc: null, pw_changed_at: null, session_secret: crypto.randomBytes(32).toString('hex'), setup_hash: sha(CODE) });
const mk = (o) => Object.assign({ id: nextId++, nafn: '', notandanafn: null, starfsmannanumer: null, kennitala: null, postfang: null, simi: null, felog: [], rola: 'Starfsmaður', sidur: [], virkur: true, sent_at: null, last_login_at: null, mistok: 0, laest_til: null }, o);
db.hub_adgangar.push(mk({ nafn: 'Agnar Sigurðsson', notandanafn: 'AS', postfang: 'aggisigurds@gmail.com', rola: 'Admin' }));
db.hub_adgangar.push(mk({ nafn: 'Lena Huld', notandanafn: 'LS', postfang: 'lena@bbio.is' }));
db.hub_adgangar.push(mk({ nafn: 'Marius' }));                          // án notandanafns
db.hub_adgangar.push(mk({ nafn: 'Óvirkur Maður', notandanafn: 'OM', virkur: false }));

function filt(rows, params) {
  let out = rows.slice();
  for (const [k, v] of params) {
    if (['select', 'order', 'limit'].includes(k)) continue;
    const m = /^(eq|ilike)\.(.*)$/.exec(v); if (!m) continue;
    const val = decodeURIComponent(m[2]);
    out = out.filter((r) => { const x = r[k]; if (m[1] === 'ilike') return String(x || '').toLowerCase() === val.toLowerCase(); return String(x) === val; });
  }
  const lim = params.find(([k]) => k === 'limit'); if (lim) out = out.slice(0, Number(lim[1]));
  return out;
}
global.fetch = async (url, opt = {}) => {
  const u = new URL(url); const method = (opt.method || 'GET').toUpperCase();
  const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
  if (u.pathname === '/api/gmail-send') { mails.push(JSON.parse(opt.body)); return respond(200, { ok: true }); }
  const m = /^\/rest\/v1\/([a-z_]+)$/.exec(u.pathname); if (!m) return respond(404, {});
  const t = m[1]; if (!db[t]) return respond(404, {});
  const params = [...u.searchParams.entries()];
  if (method === 'GET') { let rows = filt(db[t], params); if (u.searchParams.get('order') === 'id.asc') rows.sort((a, b) => a.id - b.id); return respond(200, rows); }
  if (method === 'POST') {
    const row = JSON.parse(opt.body);
    if (t === 'hub_adgangar' && row.notandanafn && db[t].some((r) => r.notandanafn === row.notandanafn)) return respond(409, { code: '23505' });
    const full = t === 'hub_adgangar' ? mk(row) : Object.assign({ id: nextId++ }, row); db[t].push(full); return respond(201, [full]);
  }
  if (method === 'PATCH') { const rows = filt(db[t], params); rows.forEach((r) => Object.assign(r, JSON.parse(opt.body))); return respond(200, rows); }
  if (method === 'DELETE') { const rows = filt(db[t], params); db[t] = db[t].filter((r) => !rows.includes(r)); return respond(204, []); }
  return respond(405, {});
};


module.exports = { db, mails, mk, CODE, sha };
