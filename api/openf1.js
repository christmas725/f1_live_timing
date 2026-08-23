const ALLOWED_ENDPOINTS = new Set([
  'sessions', 'drivers', 'position', 'intervals', 'laps', 'stints',
  'pit', 'race_control', 'weather', 'starting_grid', 'session_result'
]);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const endpoint = String(req.query.endpoint || '');
  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(400).json({ error: 'Unsupported OpenF1 endpoint' });
  }

  const url = new URL(`https://api.openf1.org/v1/${endpoint}`);
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'endpoint') continue;
    if (Array.isArray(value)) value.forEach(v => url.searchParams.append(key, String(v)));
    else if (value !== undefined) url.searchParams.append(key, String(value));
  }

  try {
    const upstream = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'F1-Live-Timing-v0.1' } });
    const body = await upstream.text();
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(upstream.status).send(body);
  } catch (error) {
    return res.status(502).json({ error: 'OpenF1 upstream request failed', detail: error.message });
  }
};
