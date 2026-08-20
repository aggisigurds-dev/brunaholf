// tengilidir-build.js — build/refresh Charlize tengiliðir from work email.
//
//   GET /api/tengilidir-build[?dry=1][&scope=meaningful|all]
//
// Derives contact addresses from email_digest, matches them to companies, and
// upserts into charlize_contacts (all status='pending' for human review — the
// same workflow charlize/scripts/mail_contacts.py + tengilidir.md define).
//
// HARD RULES (do not relax):
//   • eldklar@eldklar.is ONLY. The account filter is hard-coded, never a param —
//     the personal inbox (aggisigurds@gmail.com) and other mailboxes are never read.
//   • Reads ONLY addresses / display-names / dates. Never subject/body/snippet —
//     so no email content (and no access codes) can ever land in a contact row.
//   • Matching is by KNOWN company address / domain (lénið er sterkasti lykillinn),
//     never name-guessing. A domain shared by many félög (eignaumsjon.is …) is left
//     otengd as an umsjónaraðili — never pinned to one company.
//
// scope=meaningful (default): the 308 company-linked + the shared-domain managers.
//   scope=all: also every otengd vendor/one-off (mostly noise — you reject in review).
// Writes replace only prior source='postur-eldklar*' rows; manual seeds + any row a
// human has touched (other source) are never deleted, and existing addresses are skipped
// so seeds are never duplicated.
const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCOUNT = 'eldklar@eldklar.is';

const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

const JUNK = /^(no-?reply|noreply|donotreply|notifications?|mailer-daemon|postmaster|bounce|info@news|marketing|newsletter|support@)/i;
const JUNK_DOMAINS = new Set(['github.com','google.com','accounts.google.com','gmail.com','hotmail.com','outlook.com','facebookmail.com','redditmail.com','linkedin.com','temuemail.com','shein.com','alibaba.com','bland.is','a4.is','payday.is','barki.is','veldix.is','stolpi.is','teya.com']);
const OWN = new Set(['eldklar.is','brunaholf.is','slokkvitaeki.is']);
const PERSONAL_DOMAINS = new Set(['gmail.com','hotmail.com','outlook.com','me.com','icloud.com','simnet.is','visir.is','internet.is','live.com','yahoo.com']);
const ROLES = [
  [/^(bokhald|bókhald|reikning|accounts?|invoice|fjarmal)/i, 'bokhald'],
  [/^(husvordur|húsvörður|umsjon|umsjón|rekstur|vidhald|viðhald)/i, 'husvordur'],
  [/^(pantanir|innkaup|orders?|sala)/i, 'pantanir'],
  [/^(skrifstofa|office|info|afgreidsla|afgreiðsla)/i, 'onnur'],
];
const roleOf = a => { const l = a.split('@')[0]; for (const [rx, r] of ROLES) if (rx.test(l)) return r; return null; };
const extractAddrs = s => { const m = String(s || '').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g); return m ? m.map(x => x.toLowerCase()) : []; };

async function pageAll(path, select, extra = '') {
  const out = []; let offset = 0; const step = 1000;
  for (;;) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}?select=${select}${extra}&limit=${step}&offset=${offset}`, { headers: H });
    if (!r.ok) throw new Error(`${path} ${r.status} ${(await r.text()).slice(0, 200)}`);
    const rows = await r.json(); out.push(...rows);
    if (rows.length < step) break; offset += step;
  }
  return out;
}

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'content-type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (!SUPABASE_URL || !KEY) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'missing SUPABASE env' }) };
  const q = event.queryStringParameters || {};
  const dry = q.dry === '1' || q.dry === 'true';
  const scope = (q.scope === 'all') ? 'all' : 'meaningful';

  try {
    // eldklar mail — addresses/names/dates ONLY
    const mail = await pageAll('email_digest', 'sender_email,sender_name,to_addresses,received_at', `&account=eq.${encodeURIComponent(ACCOUNT)}`);
    // company address/domain keys
    const comp = [];
    for (const c of await pageAll('customers_base', 'kennitala,nafn,netfang,contact_email', '&nafn=not.is.null')) {
      comp.push({ kt: (c.kennitala || '').trim(), nm: (c.nafn || '').trim(), email: c.netfang });
      if (c.contact_email) comp.push({ kt: (c.kennitala || '').trim(), nm: (c.nafn || '').trim(), email: c.contact_email });
    }
    for (const c of await pageAll('fyrirtaeki', 'kennitala,nafn,netfang', '&nafn=not.is.null&deleted_at=is.null'))
      comp.push({ kt: (c.kennitala || '').trim(), nm: (c.nafn || '').trim(), email: c.netfang });

    const exactMap = new Map(), domainMap = new Map();
    for (const c of comp) for (const em of extractAddrs(c.email)) {
      const dom = em.split('@')[1]; if (!dom || OWN.has(dom) || JUNK_DOMAINS.has(dom) || PERSONAL_DOMAINS.has(dom)) continue;
      if (!exactMap.has(em)) exactMap.set(em, [c.kt, c.nm]);
      if (!domainMap.has(dom)) domainMap.set(dom, new Set());
      domainMap.get(dom).add(c.kt + '|' + c.nm);
    }

    // aggregate external addresses
    const seen = new Map();
    for (const msg of mail) {
      const date = msg.received_at ? String(msg.received_at).slice(0, 10) : null;
      for (const [field, dir] of [['sender_email', 'inn'], ['to_addresses', 'ut']]) for (const addr of extractAddrs(msg[field])) {
        const len = addr.split('@')[1]; if (!len) continue;
        if (OWN.has(len) || JUNK_DOMAINS.has(len) || JUNK.test(addr)) continue;
        if ([...JUNK_DOMAINS].some(d => len === d || len.endsWith('.' + d))) continue;
        let e = seen.get(addr);
        if (!e) { e = { len, heiti: null, n: 0, fyrst: date, sidast: date, attin: new Set() }; seen.set(addr, e); }
        e.n++; e.attin.add(dir);
        if (date) { if (!e.fyrst || date < e.fyrst) e.fyrst = date; if (!e.sidast || date > e.sidast) e.sidast = date; }
        if (field === 'sender_email' && msg.sender_name && !e.heiti) e.heiti = msg.sender_name;
      }
    }

    // match: exact > single-company domain > otengd (shared / none)
    const rows = [];
    let nExact = 0, nDomain = 0, nShared = 0, nNoise = 0;
    for (const [addr, e] of seen) {
      const attin = e.attin.size > 1 ? 'baedi' : [...e.attin][0];
      const baseRow = { netfang: addr, len: e.len, heiti: e.heiti, hlutverk: roleOf(addr), attin, faerslur: e.n, fyrst_sest: e.fyrst, sidast_sest: e.sidast, status: 'pending' };
      if (exactMap.has(addr)) { const [kt, nm] = exactMap.get(addr); rows.push({ ...baseRow, kennitala: kt || null, fyrirtaeki: nm, source: 'postur-eldklar (netfang)', confidence: 'confirmed' }); nExact++; continue; }
      const ds = domainMap.get(e.len);
      if (ds && ds.size === 1) { const [kt, nm] = [...ds][0].split('|'); rows.push({ ...baseRow, kennitala: kt || null, fyrirtaeki: nm, source: 'postur-eldklar (lén)', confidence: 'likely' }); nDomain++; continue; }
      if (ds && ds.size > 1) { rows.push({ ...baseRow, kennitala: null, fyrirtaeki: null, source: 'postur-eldklar — umsjónaraðili, deilt lén: ' + [...ds].map(s => s.split('|')[1]).join('; ').slice(0, 110), confidence: 'unverified' }); nShared++; continue; }
      nNoise++;
      if (scope === 'all') rows.push({ ...baseRow, kennitala: null, fyrirtaeki: null, source: 'postur-eldklar', confidence: 'unverified' });
    }

    const summary = { account: ACCOUNT, scope, emails: mail.length, addresses: seen.size, exact: nExact, domain: nDomain, shared: nShared, noise_skipped: scope === 'all' ? 0 : nNoise, to_write: rows.length };

    if (dry) return { statusCode: 200, headers: cors, body: JSON.stringify({ dry: true, ...summary, samples: rows.slice(0, 15).map(r => ({ netfang: r.netfang, len: r.len, fyrirtaeki: r.fyrirtaeki, kt: r.kennitala, role: r.hlutverk, n: r.faerslur, conf: r.confidence })) }) };

    // WRITE: replace prior auto rows, skip addresses that already exist (seeds/human rows)
    const existing = new Set((await pageAll('charlize_contacts', 'netfang')).map(r => (r.netfang || '').toLowerCase()));
    const del = await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts?source=like.postur-eldklar*`, { method: 'DELETE', headers: { ...H, Prefer: 'return=minimal' } });
    if (!del.ok && del.status !== 404) throw new Error('delete ' + del.status + ' ' + (await del.text()).slice(0, 160));
    const fresh = rows.filter(r => !existing.has(r.netfang));
    let written = 0;
    for (let i = 0; i < fresh.length; i += 200) {
      const chunk = fresh.slice(i, i + 200);
      const w = await fetch(`${SUPABASE_URL}/rest/v1/charlize_contacts`, { method: 'POST', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(chunk) });
      if (!w.ok) throw new Error('insert ' + w.status + ' ' + (await w.text()).slice(0, 200));
      written += chunk.length;
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ dry: false, ...summary, already_existed: rows.length - fresh.length, written }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
