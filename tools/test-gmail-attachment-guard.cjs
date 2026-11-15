/* Behaviour test for the ATTACHMENTS_FAILED guard in brunaholf gmail-send.js.
   Stubs ./_google and global.fetch — no network, no live send. */
const path = require('path');
const FN = '/home/user/brunaholf/netlify/functions/gmail-send.js';
const GOOGLE = path.resolve('/home/user/brunaholf/netlify/functions/_google.js');

// Stub _google before gmail-send requires it.
require.cache[GOOGLE] = {
  id: GOOGLE, filename: GOOGLE, loaded: true, exports: {
    freshAccessTokenFor: async () => 'tok', freshAccessToken: async () => 'drivetok',
    listConnectedAccounts: async () => [],
    cors: () => ({}),
    json: (statusCode, payload) => ({ statusCode, headers: {}, body: JSON.stringify(payload) }),
  },
};

let gmailSendCalls = 0;
let problemInserts = [];
function installFetch({ driveOk = true, urlOk = true }) {
  gmailSendCalls = 0; problemInserts = [];
  global.fetch = async (u, opts) => {
    u = String(u);
    if (u.indexOf('gmail.googleapis.com') !== -1) {
      gmailSendCalls++;
      return { ok: true, status: 200, json: async () => ({ id: 'm1', threadId: 't1' }) };
    }
    if (u.indexOf('drive/v3/files') !== -1) {
      return driveOk
        ? { ok: true, status: 200, arrayBuffer: async () => Buffer.from('PDFDATA') }
        : { ok: false, status: 404, arrayBuffer: async () => Buffer.alloc(0) };
    }
    if (u.indexOf('/rest/v1/app_problems') !== -1) {
      problemInserts.push(JSON.parse(opts.body)); return { ok: true, status: 201 };
    }
    // plain url attachment
    return urlOk
      ? { ok: true, status: 200, arrayBuffer: async () => Buffer.from('URLDATA') }
      : { ok: false, status: 500, arrayBuffer: async () => Buffer.alloc(0) };
  };
}

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
delete require.cache[require.resolve(FN)];
const { handler } = require(FN);

const call = (attachments, extra = {}) => handler({
  httpMethod: 'POST',
  body: JSON.stringify({ account: 'a@b.is', to: ['x@y.is'], subject: 's', html: '<p>h</p>', attachments, ...extra }),
});

let pass = 0, fail = 0;
function check(name, cond, info) {
  if (cond) { console.log('  PASS  ' + name); pass++; }
  else { console.log('  FAIL  ' + name + '  → ' + info); fail++; }
}

(async () => {
  // 1) happy path — everything resolves → sends
  installFetch({});
  let r = await call([{ filename: 'reikningur.pdf', driveId: 'd1' }]);
  let b = JSON.parse(r.body);
  check('all resolve → 200 + sent', r.statusCode === 200 && b.ok === true && gmailSendCalls === 1, `${r.statusCode} sends=${gmailSendCalls}`);

  // 2) THE BUG: a Drive attachment 404s → must refuse, must NOT send
  installFetch({ driveOk: false });
  r = await call([{ filename: 'reikningur.pdf', driveId: 'gone' }]);
  b = JSON.parse(r.body);
  check('drive 404 → 422 ATTACHMENTS_FAILED', r.statusCode === 422 && b.error === 'ATTACHMENTS_FAILED', `${r.statusCode} ${b.error}`);
  check('drive 404 → NO gmail send happened', gmailSendCalls === 0, `sends=${gmailSendCalls}`);
  check('drive 404 → warnings non-empty', Array.isArray(b.warnings) && b.warnings.length > 0, JSON.stringify(b.warnings));
  check('drive 404 → logged to app_problems', problemInserts.length === 1 && problemInserts[0][0].kind === 'attachments_failed', JSON.stringify(problemInserts));
  check('log carries source_app=brunaholf', problemInserts.length && problemInserts[0][0].source_app === 'brunaholf', '');

  // 3) allowPartial escape hatch → sends anyway
  installFetch({ driveOk: false });
  r = await call([{ filename: 'x.pdf', driveId: 'gone' }], { allowPartial: true });
  check('allowPartial:true → still sends', r.statusCode === 200 && gmailSendCalls === 1, `${r.statusCode} sends=${gmailSendCalls}`);

  // 3b) allowPartial must be STRICT true, not truthy
  installFetch({ driveOk: false });
  r = await call([{ filename: 'x.pdf', driveId: 'gone' }], { allowPartial: 'yes' });
  check('allowPartial:"yes" (truthy) → still REFUSES', r.statusCode === 422, `${r.statusCode}`);

  // 4) no attachments at all (N=0) → "senda bara texta" must keep working
  installFetch({});
  r = await call([]);
  check('zero attachments → sends (text-only path intact)', r.statusCode === 200 && gmailSendCalls === 1, `${r.statusCode} sends=${gmailSendCalls}`);

  // 5) VÍR 3 — a null entry must NOT inflate the requested count
  installFetch({});
  r = await call([null, { filename: 'ok.pdf', driveId: 'd1' }]);
  b = JSON.parse(r.body);
  check('null entry does not cause a false 422', r.statusCode === 200 && gmailSendCalls === 1, `${r.statusCode} ${b.error || ''} requested=${b.requested}`);

  // 6) VÍR 2 — a formless entry must refuse WITH a reason
  installFetch({});
  r = await call([{ filename: 'tomt.pdf', content: '' }]);
  b = JSON.parse(r.body);
  check('content:"" → 422 with a stated reason', r.statusCode === 422 && b.warnings.length > 0, `${r.statusCode} ${JSON.stringify(b.warnings)}`);

  // 7) kennitala must never reach the problem log — ALL the real filename shapes.
  // Measured: 1533 of 3755 customer_documents filenames (41%) carry a kennitala.
  // The first attempt used \b…\b and leaked every underscore-delimited name;
  // testing only the space-delimited form gave false confidence.
  const KT_SHAPES = [
    'Uttekt 1234567890 Menja.pdf',      // spaces
    'Reikningur_120380-4569.pdf',       // underscore + dash  ← leaked before
    'Reikningur_1203804569.pdf',        // underscore, no dash ← leaked before
    'Skyrsla 120380 4569.pdf',          // space as separator  ← leaked before
    'kt1203804569.pdf',                 // glued to letters    ← leaked before
  ];
  for (const fn of KT_SHAPES) {
    installFetch({ driveOk: false });
    await call([{ filename: fn, driveId: 'gone' }]);
    const logged = JSON.stringify(problemInserts);
    const leaked = /\d{6}-?\s?\d{4}/.test(logged);
    check('kt scrubbed: ' + fn, !leaked, logged.slice(0, 160));
  }

  // 8) a URL with a token must never reach the problem log either
  installFetch({});
  global.fetch = (u, o) => {
    if (String(u).indexOf('/rest/v1/app_problems') !== -1) { problemInserts.push(JSON.parse(o.body)); return { ok: true, status: 201 }; }
    if (String(u).indexOf('gmail.googleapis.com') !== -1) { gmailSendCalls++; return { ok: true, status: 200, json: async () => ({}) }; }
    throw new Error('Failed to parse URL from /storage/Jon_120380-4569.pdf?token=SECRETVALUE');
  };
  await call([{ filename: 'x.pdf', url: '/storage/x.pdf?token=SECRETVALUE' }]);
  const logged2 = JSON.stringify(problemInserts);
  check('url + token scrubbed from problem log',
    logged2.indexOf('SECRETVALUE') === -1 && logged2.indexOf('120380') === -1, logged2.slice(0, 200));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
