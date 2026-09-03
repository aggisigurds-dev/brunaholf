// gatt-admin.js — stjórnsíðan „Viðskiptavinavefir" (innri, starfsfólk).
//
//   GET  /api/gatt-admin              → { access[], messages[] }
//   GET  /api/gatt-admin?q=<leit>     → { companies[] }  (fyrirtækja-leit fyrir „velja fyrirtæki")
//   POST /api/gatt-admin { action, ... }
//     create        {base_id}                 → stofna aðgang (slug + URL, tómt netfang/lykilorð)
//     save          {id, email, password?}    → vista aðgangsorð (netfang) + lykilorð (hashað ef sett)
//     gen-password  {id}                       → búa til sterkt lykilorð, skila því EINU SINNI
//     clear-password{id}                       → hreinsa lykilorð (slekkur á innskráningu)
//     toggle        {id, active}               → virkja/afvirkja
//     delete        {id}                        → aftengja vef (eyða aðgangi)
//     send          {id, password?}            → senda kúnna URL + notandanafn (+ lykilorð) í pósti
//     reply-msg     {base_id, body}            → starfsmaður svarar fyrirspurn
//     mark-read     {base_id}                   → merkja fyrirspurnir félags lesnar
//
// ⚠️ Innri síða — arfar (skort á) auðkenningu hub-sins; á að vera á bak við
// væntanlega hub-innskráningu. Öll skrif nota service-role (aldrei í vafra).

const P = require('./_portal');
const crypto = require('crypto');
const MAIL_ACCOUNT = 'eldklar@eldklar.is';

function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ý/g, 'y')
    .replace(/þ/g, 'th').replace(/ð/g, 'd').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'felag';
}
function genPassword() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const b = crypto.randomBytes(14); let o = '';
  for (let i = 0; i < 12; i++) o += a[b[i] % a.length];
  return o;
}
function origin(event) {
  const host = (event.headers && (event.headers.host || event.headers.Host)) || 'brunaholf.netlify.app';
  return 'https://' + host;
}
function pubRow(r) { // aldrei skila pass_hash í vafra
  return { id: r.id, base_id: r.base_id, slug: r.slug, email: r.email || '', hasPassword: !!r.pass_hash,
    active: r.active, theme: r.theme, display_name: r.display_name, last_login: r.last_login, created_at: r.created_at };
}
async function baseNames(ids) {
  const uniq = [...new Set(ids.filter((x) => x != null))];
  if (!uniq.length) return {};
  const r = await P.sbGet(`customers_base?id=in.(${uniq.join(',')})&select=id,nafn,kennitala`);
  const map = {};
  if (r.ok) (await r.json()).forEach((b) => { map[b.id] = b; });
  return map;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: P.secHeaders(), body: '' };
  if (!P.dbReady()) return P.json(503, { error: 'Supabase env vantar' });
  const _g = P.requireStaff(event); if (_g) return _g;

  try {
    // ── GET ──
    if (event.httpMethod === 'GET') {
      const q = (event.queryStringParameters || {}).q;
      if (q != null && String(q).trim()) {
        const enc = encodeURIComponent(String(q).trim());
        const r = await P.sbGet(`customers_base?or=(nafn.ilike.*${enc}*,kennitala.ilike.*${enc}*)&select=id,nafn,kennitala,rekstrarfelag&order=nafn&limit=40`);
        const companies = r.ok ? await r.json() : [];
        return P.json(200, { companies });
      }
      const ar = await P.sbGet('portal_users?select=*&order=created_at.desc');
      const access = ar.ok ? await ar.json() : [];
      const mr = await P.sbGet('portal_messages?select=*&order=created_at.desc&limit=100');
      const messages = mr.ok ? await mr.json() : [];
      const names = await baseNames([...access.map((a) => a.base_id), ...messages.map((m) => m.base_id)]);
      return P.json(200, {
        access: access.map((a) => Object.assign(pubRow(a), { base_nafn: (names[a.base_id] || {}).nafn || ('#' + a.base_id) })),
        messages: messages.map((m) => ({ id: m.id, base_id: m.base_id, base_nafn: (names[m.base_id] || {}).nafn || ('#' + m.base_id),
          sender: m.sender, body: m.body, author_name: m.author_name, created_at: m.created_at, read_by_staff: m.read_by_staff })),
      });
    }

    if (event.httpMethod !== 'POST') return P.json(405, { error: 'GET eða POST only' });
    let body; try { body = JSON.parse(event.body || '{}'); } catch { return P.json(400, { error: 'Ógilt JSON' }); }
    const action = body.action;

    if (action === 'create') {
      const baseId = parseInt(body.base_id, 10);
      if (!baseId) return P.json(400, { error: 'base_id vantar' });
      const names = await baseNames([baseId]);
      const name = (names[baseId] || {}).nafn || ('Félag ' + baseId);
      // einkvæmt slug
      let slug = slugify(name);
      const ex = await P.sbGet(`portal_users?slug=like.${encodeURIComponent(slug)}*&select=slug`);
      const taken = new Set((ex.ok ? await ex.json() : []).map((x) => x.slug));
      if (taken.has(slug)) { let n = 2; while (taken.has(slug + '-' + n)) n++; slug = slug + '-' + n; }
      const ins = await P.sbPost('portal_users', { base_id: baseId, slug: slug, active: true, display_name: name });
      if (!ins.ok) return P.json(ins.status, { error: 'Gat ekki stofnað', detail: await ins.text() });
      const row = (await ins.json())[0];
      return P.json(200, { ok: true, row: pubRow(row), url: origin(event) + '/gatt/?c=' + slug });
    }

    if (action === 'save') {
      const id = String(body.id || '');
      if (!id) return P.json(400, { error: 'id vantar' });
      const patch = {};
      if (typeof body.email === 'string') patch.email = body.email.trim().toLowerCase() || null;
      if (typeof body.password === 'string' && body.password) patch.pass_hash = P.hashPassword(body.password);
      if (typeof body.display_name === 'string') patch.display_name = body.display_name.trim();
      if (typeof body.theme === 'string') patch.theme = body.theme.trim();
      if (!Object.keys(patch).length) return P.json(400, { error: 'Ekkert til að vista' });
      const r = await P.sbPatch(`portal_users?id=eq.${id}&select=*`, patch);
      if (!r.ok) return P.json(r.status, { error: 'Villa', detail: await r.text() });
      return P.json(200, { ok: true, row: pubRow((await r.json())[0]) });
    }

    if (action === 'gen-password') {
      const id = String(body.id || '');
      if (!id) return P.json(400, { error: 'id vantar' });
      const pw = genPassword();
      const r = await P.sbPatch(`portal_users?id=eq.${id}&select=*`, { pass_hash: P.hashPassword(pw) });
      if (!r.ok) return P.json(r.status, { error: 'Villa', detail: await r.text() });
      return P.json(200, { ok: true, password: pw, row: pubRow((await r.json())[0]) });
    }

    if (action === 'clear-password') {
      const id = String(body.id || '');
      const r = await P.sbPatch(`portal_users?id=eq.${id}&select=*`, { pass_hash: null });
      if (!r.ok) return P.json(r.status, { error: 'Villa', detail: await r.text() });
      return P.json(200, { ok: true, row: pubRow((await r.json())[0]) });
    }

    if (action === 'toggle') {
      const id = String(body.id || '');
      const r = await P.sbPatch(`portal_users?id=eq.${id}&select=*`, { active: !!body.active });
      if (!r.ok) return P.json(r.status, { error: 'Villa', detail: await r.text() });
      return P.json(200, { ok: true, row: pubRow((await r.json())[0]) });
    }

    if (action === 'delete') {
      const id = String(body.id || '');
      const r = await fetch(`${P.SUPABASE_URL}/rest/v1/portal_users?id=eq.${id}`, {
        method: 'DELETE', headers: { apikey: P.SUPABASE_KEY, Authorization: `Bearer ${P.SUPABASE_KEY}` },
      });
      if (!r.ok) return P.json(r.status, { error: 'Villa', detail: await r.text() });
      return P.json(200, { ok: true });
    }

    if (action === 'send') {
      const id = String(body.id || '');
      const gr = await P.sbGet(`portal_users?id=eq.${id}&select=*&limit=1`);
      const u = (gr.ok ? await gr.json() : [])[0];
      if (!u) return P.json(404, { error: 'Aðgangur finnst ekki' });
      const to = (body.to || u.email || '').trim();
      if (!to) return P.json(400, { error: 'Ekkert netfang til að senda á' });
      const url = origin(event) + '/gatt/?c=' + u.slug;
      const pw = (typeof body.password === 'string' && body.password) ? body.password : null;
      const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">' +
        '<p>Sæl/l,</p>' +
        '<p>Hér er aðgangur að þjónustuvef Slökkvitækja ehf. þar sem þú sérð stöðu brunavarna, úttektarskýrslur og reikninga fyrir ' + esc(u.display_name || 'félagið') + '.</p>' +
        '<p><b>Vefslóð:</b> <a href="' + esc(url) + '">' + esc(url) + '</a><br>' +
        '<b>Notandanafn:</b> ' + esc(u.email || '') + (pw ? '<br><b>Lykilorð:</b> ' + esc(pw) : '') + '</p>' +
        '<p style="color:#666;font-size:12px">Kveðja,<br>Slökkvitæki ehf.</p></div>';
      const gmail = require('./gmail-send');
      const res = await gmail.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({
        account: MAIL_ACCOUNT, to: [to], subject: 'Aðgangur að þjónustuvef Slökkvitækja ehf.', html: html }) });
      if (!res || res.statusCode !== 200) return P.json(502, { error: 'Póstur sendist ekki', detail: res && res.body });
      return P.json(200, { ok: true, sent_to: to });
    }

    if (action === 'reply-msg') {
      const baseId = parseInt(body.base_id, 10);
      const text = String(body.body || '').trim();
      if (!baseId || !text) return P.json(400, { error: 'base_id/body vantar' });
      const ins = await P.sbPost('portal_messages', { base_id: baseId, sender: 'starf', body: text, author_name: body.author_name || 'Slökkvitæki', read_by_staff: true });
      if (!ins.ok) return P.json(ins.status, { error: 'Villa', detail: await ins.text() });
      return P.json(200, { ok: true, row: (await ins.json())[0] });
    }

    if (action === 'mark-read') {
      const baseId = parseInt(body.base_id, 10);
      if (!baseId) return P.json(400, { error: 'base_id vantar' });
      await P.sbPatch(`portal_messages?base_id=eq.${baseId}&sender=eq.kunni`, { read_by_staff: true });
      return P.json(200, { ok: true });
    }

    return P.json(400, { error: 'Óþekkt aðgerð', action });
  } catch (e) {
    return P.json(500, { error: String((e && e.message) || e) });
  }
};

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
