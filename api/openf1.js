const ALLOWED_ENDPOINTS = new Set([
  'sessions',
  'meetings',
  'drivers',
  'championship_drivers',
  'championship_teams',
  'position',
  'intervals',
  'laps',
  'stints',
  'pit',
  'race_control',
  'weather',
  'starting_grid',
  'session_result',
  'car_data',
  'location',
  'overtakes',
  'team_radio'
]);

const TOKEN_URL = 'https://api.openf1.org/token';
const API_BASE = 'https://api.openf1.org/v1';
const TOKEN_SKEW_MS = 60_000;

let tokenCache = {
  accessToken: null,
  expiresAt: 0,
  inFlight: null
};

function credentialsConfigured() {
  return Boolean(process.env.OPENF1_USERNAME && process.env.OPENF1_PASSWORD);
}

function tokenStillValid() {
  return Boolean(
    tokenCache.accessToken &&
    tokenCache.expiresAt > Date.now() + TOKEN_SKEW_MS
  );
}

async function requestAccessToken(forceRefresh = false) {
  if (!credentialsConfigured()) return null;
  if (!forceRefresh && tokenStillValid()) return tokenCache.accessToken;
  if (!forceRefresh && tokenCache.inFlight) return tokenCache.inFlight;

  const task = (async () => {
    const body = new URLSearchParams({
      username: process.env.OPENF1_USERNAME,
      password: process.env.OPENF1_PASSWORD
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body,
      cache: 'no-store'
    });

    const text = await response.text();

    if (!response.ok) {
      let detail = text;
      try {
        const parsed = JSON.parse(text);
        detail = parsed.detail || parsed.error || text;
      } catch {
        // Keep raw response text.
      }
      throw new Error(`OpenF1 token request failed (${response.status}): ${detail}`);
    }

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error('OpenF1 token response was not valid JSON.');
    }

    if (!payload?.access_token) {
      throw new Error('OpenF1 token response did not include access_token.');
    }

    const expiresInSeconds = Number(payload.expires_in) || 3600;
    tokenCache.accessToken = payload.access_token;
    tokenCache.expiresAt = Date.now() + expiresInSeconds * 1000;

    return tokenCache.accessToken;
  })();

  tokenCache.inFlight = task;

  try {
    return await task;
  } finally {
    tokenCache.inFlight = null;
  }
}

async function fetchOpenF1(upstreamUrl, accessToken) {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'F1-Live-Timing-v0.9.0'
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(upstreamUrl, {
    headers,
    cache: 'no-store'
  });
}

function json(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

export async function GET(request) {
  try {
    const requestUrl = new URL(request.url);
    const endpoint = requestUrl.searchParams.get('endpoint') || '';

    if (endpoint === 'auth_status') {
      if (!credentialsConfigured()) {
        return json({
          configured: false,
          authenticated: false,
          mode: 'anonymous',
          message: 'OPENF1_USERNAME / OPENF1_PASSWORD are not configured.'
        });
      }

      try {
        await requestAccessToken();
        const expiresIn = Math.max(
          0,
          Math.floor((tokenCache.expiresAt - Date.now()) / 1000)
        );

        return json({
          configured: true,
          authenticated: true,
          mode: 'authenticated',
          expires_in: expiresIn
        });
      } catch (error) {
        console.error('OpenF1 authentication check failed:', error);
        return json({
          configured: true,
          authenticated: false,
          mode: 'authentication_error',
          error: 'OpenF1 authentication failed',
          detail: error instanceof Error ? error.message : String(error)
        }, 502);
      }
    }

    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      return json({ error: 'Unsupported OpenF1 endpoint' }, 400);
    }

    const upstreamUrl = new URL(`${API_BASE}/${endpoint}`);

    for (const [key, value] of requestUrl.searchParams.entries()) {
      if (key === 'endpoint') continue;
      upstreamUrl.searchParams.append(key, value);
    }

    let accessToken = null;

    if (credentialsConfigured()) {
      try {
        accessToken = await requestAccessToken();
      } catch (error) {
        console.error('OpenF1 token acquisition failed:', error);
        return json({
          error: 'OpenF1 authentication failed',
          detail: error instanceof Error ? error.message : String(error)
        }, 502);
      }
    }

    let upstream = await fetchOpenF1(upstreamUrl, accessToken);

    if (accessToken && (upstream.status === 401 || upstream.status === 403)) {
      tokenCache.accessToken = null;
      tokenCache.expiresAt = 0;

      try {
        accessToken = await requestAccessToken(true);
        upstream = await fetchOpenF1(upstreamUrl, accessToken);
      } catch (error) {
        console.error('OpenF1 token refresh failed:', error);
        return json({
          error: 'OpenF1 token refresh failed',
          detail: error instanceof Error ? error.message : String(error)
        }, 502);
      }
    }

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-OpenF1-Mode': accessToken ? 'authenticated' : 'anonymous'
      }
    });
  } catch (error) {
    console.error('OpenF1 proxy error:', error);

    return json({
      error: 'OpenF1 upstream request failed',
      detail: error instanceof Error ? error.message : String(error)
    }, 502);
  }
}
