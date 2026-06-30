// skoda.js — backend for tokenized remote ársskoðun fill flow.
//
// GET  /api/skoda?token=ABC   → invite row (without expires_at if used)
// GET  /api/skoda?list=1      → recent submissions (Aggi viewer)
// GET  /api/skoda?submission=UUID  → single submission with form_data
// POST /api/skoda { action:'invite', verkkaupi, kennitala, simi, tengilidur,
//                   heimilisfang, postnumer, template_id? }
//                            → { token, url }
// POST /api/skoda { action:'submit', token, form_data,
//                   signature_customer, signature_inspector?,
//                   submitter_name?, submitter_email? }
//                            → { ok, submission_id }
//
// Service-role only (skodun_invites + skodun_submissions are RLS-disabled).
// Submissions also broadcast to verkefnalisti as 'i_yfirferd' so Aggi's
// Claude task board surfaces them.

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_TEMPLATE = 'arsskodun-brunakerfa';
const FILL_PAGE_HOST   = process.env.SKODA_FILL_HOST || 'https://brunaholf.netlify.app';
const FILL_PAGE_PATH   = '/skoda.html';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json', ...corsHeaders },
  body: JSON.stringify(body),
});

async function sb(path, init = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers });
}

function makeToken(len = 16) {
  // URL-safe base64 of 16 random bytes → 22 chars, strip padding/non-safe.
  const buf = crypto.randomBytes(len);
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
    .slice(0, 18);
}

async function recordVerkefnalistiSubmission(invite, submission) {
  // Best-effort — don't fail the submission if this errors.
  try {
    const who = invite?.verkkaupi || 'Ókunnur verkkaupi';
    const addr = invite?.heimilisfang ? ` · ${invite.heimilisfang}` : '';
    const row = {
      title: `📋 Brunakerfi skoðun móttekin — ${who}${addr}`,
      description: `Skoðun á ${who} (kt ${invite?.kennitala || '?'}) móttekin frá ${
        submission.submitter_name || 'starfsmanni'
      }. Submission id: ${submission.id}`,
      status: 'i_yfirferd',
      priority: 2,
      category: 'allt',
    };
    await sb('verkefnalisti', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
  } catch (_) { /* swallow */ }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
  if (!SUPABASE_URL || !SUPABASE_KEY) return json(500, { error: 'Supabase env vars missing' });

  try {
    if (event.httpMethod === 'GET') {
      const q = event.queryStringParameters || {};

      if (q.submission) {
        const r = await sb(`skodun_submissions?id=eq.${encodeURIComponent(q.submission)}&select=*`);
        if (!r.ok) return json(r.status, { error: await r.text() });
        const rows = await r.json();
        if (!rows.length) return json(404, { error: 'Submission not found' });
        const sub = rows[0];
        // Attach invite info if available
        if (sub.token) {
          const ir = await sb(`skodun_invites?token=eq.${encodeURIComponent(sub.token)}&select=*`);
          if (ir.ok) {
            const invites = await ir.json();
            if (invites.length) sub.invite = invites[0];
          }
        }
        return json(200, { submission: sub });
      }

      if (q.list === '1' || q.list === 'true') {
        const r = await sb('skodun_submissions?select=id,token,template_id,submitted_at,submitter_name,submitter_email&order=submitted_at.desc&limit=50');
        if (!r.ok) return json(r.status, { error: await r.text() });
        const rows = await r.json();
        // Enrich each with the invite header info
        const tokens = [...new Set(rows.map(r => r.token).filter(Boolean))];
        let inviteMap = {};
        if (tokens.length) {
          const list = tokens.map(t => `"${t}"`).join(',');
          const ir = await sb(`skodun_invites?token=in.(${encodeURIComponent(list)})&select=*`);
          if (ir.ok) {
            const invites = await ir.json();
            invites.forEach(i => { inviteMap[i.token] = i; });
          }
        }
        const submissions = rows.map(r => ({
          ...r,
          invite: r.token ? (inviteMap[r.token] || null) : null,
        }));
        return json(200, { submissions });
      }

      if (q.token) {
        const r = await sb(`skodun_invites?token=eq.${encodeURIComponent(q.token)}&select=*`);
        if (!r.ok) return json(r.status, { error: await r.text() });
        const rows = await r.json();
        if (!rows.length) return json(404, { error: 'Boð fannst ekki' });
        const invite = rows[0];
        const now = new Date();
        const expired = invite.expires_at && new Date(invite.expires_at) < now;
        const used    = !!invite.used_at;
        return json(200, {
          invite: {
            token: invite.token,
            template_id: invite.template_id,
            verkkaupi: invite.verkkaupi,
            kennitala: invite.kennitala,
            simi: invite.simi,
            tengilidur: invite.tengilidur,
            heimilisfang: invite.heimilisfang,
            postnumer: invite.postnumer,
            created_at: invite.created_at,
            used_at: invite.used_at,
            expires_at: used ? null : invite.expires_at,
          },
          expired,
          used,
        });
      }

      return json(400, { error: 'token, list eða submission vantar' });
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const body = JSON.parse(event.body || '{}');
    const action = body.action;

    if (action === 'invite') {
      const verkkaupi = String(body.verkkaupi || '').trim();
      if (!verkkaupi) return json(400, { error: 'verkkaupi vantar' });

      // Make a unique token (retry up to 5x if rare collision).
      let token = null;
      for (let i = 0; i < 5; i++) {
        token = makeToken();
        const row = {
          token,
          template_id: String(body.template_id || DEFAULT_TEMPLATE),
          verkkaupi,
          kennitala: body.kennitala ? String(body.kennitala).trim() : null,
          simi: body.simi ? String(body.simi).trim() : null,
          tengilidur: body.tengilidur ? String(body.tengilidur).trim() : null,
          heimilisfang: body.heimilisfang ? String(body.heimilisfang).trim() : null,
          postnumer: body.postnumer ? String(body.postnumer).trim() : null,
          created_by: body.created_by ? String(body.created_by).trim() : null,
        };
        const r = await sb('skodun_invites', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(row),
        });
        if (r.ok) break;
        const txt = await r.text();
        if (!/duplicate/i.test(txt)) {
          return json(r.status, { error: txt });
        }
      }

      const url = `${FILL_PAGE_HOST}${FILL_PAGE_PATH}?token=${token}`;
      return json(200, { ok: true, token, url });
    }

    if (action === 'submit') {
      const token = String(body.token || '').trim();
      if (!token) return json(400, { error: 'token vantar' });
      if (!body.form_data || typeof body.form_data !== 'object') {
        return json(400, { error: 'form_data vantar' });
      }

      // Verify token + check used/expired.
      const ir = await sb(`skodun_invites?token=eq.${encodeURIComponent(token)}&select=*`);
      if (!ir.ok) return json(ir.status, { error: await ir.text() });
      const invites = await ir.json();
      if (!invites.length) return json(404, { error: 'Boðsmerki fannst ekki' });
      const invite = invites[0];
      if (invite.used_at) return json(409, { error: 'Þessi tengill hefur þegar verið notaður' });
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        return json(410, { error: 'Þessi tengill er útrunninn' });
      }

      const sub = {
        token,
        template_id: invite.template_id,
        form_data: body.form_data,
        signature_customer: body.signature_customer || null,
        signature_inspector: body.signature_inspector || null,
        submitter_name: body.submitter_name ? String(body.submitter_name).trim() : null,
        submitter_email: body.submitter_email ? String(body.submitter_email).trim() : null,
      };
      const r = await sb('skodun_submissions', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(sub),
      });
      if (!r.ok) return json(r.status, { error: await r.text() });
      const [created] = await r.json();

      // Mark invite used.
      await sb(`skodun_invites?token=eq.${encodeURIComponent(token)}`, {
        method: 'PATCH',
        body: JSON.stringify({ used_at: new Date().toISOString() }),
      });

      // Broadcast to verkefnalisti (best effort).
      await recordVerkefnalistiSubmission(invite, created);

      return json(200, { ok: true, submission_id: created.id });
    }

    return json(400, { error: 'unknown action' });
  } catch (e) {
    return json(500, { error: String(e.message || e) });
  }
};
