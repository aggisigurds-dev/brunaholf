// gmail-search.js — search Gmail with a free-form query.
// GET /api/gmail-search?q=þjónustusamningur+from:eldklar.is&limit=20

const { freshAccessToken, json, cors } = require('./_google');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors(), body: '' };
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  const p = event.queryStringParameters || {};
  const q = (p.q || '').trim();
  const limit = Math.min(parseInt(p.limit || '15', 10) || 15, 50);
  if (!q) return json(400, { error: 'q is required' });

  let token;
  try { token = await freshAccessToken(); }
  catch (e) { return json(401, { error: e.message }); }

  try {
    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?` + new URLSearchParams({
      q, maxResults: String(limit),
    });
    const lr = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!lr.ok) return json(lr.status, { error: `Gmail list ${lr.status}: ${(await lr.text()).slice(0, 300)}` });
    const list = await lr.json();
    const ids = (list.messages || []).map(m => m.id);
    // Fetch headers in parallel
    const details = await Promise.all(ids.map(async id => {
      const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      const m = await r.json();
      const hh = {};
      (m.payload?.headers || []).forEach(h => { hh[h.name.toLowerCase()] = h.value; });
      return {
        id, threadId: m.threadId,
        snippet: m.snippet,
        labels: m.labelIds,
        subject: hh.subject || '',
        from: hh.from || '',
        to: hh.to || '',
        date: hh.date || '',
        internalDate: m.internalDate,
      };
    }));
    return json(200, {
      q, total: list.resultSizeEstimate || ids.length,
      messages: details.filter(Boolean),
    });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
