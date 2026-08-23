const ALLOWED_ENDPOINTS = new Set([
  'sessions',
  'drivers',
  'position',
  'intervals',
  'laps',
  'stints',
  'pit',
  'race_control',
  'weather',
  'starting_grid',
  'session_result'
]);

export async function GET(request) {
  try {
    const requestUrl = new URL(request.url);
    const endpoint = requestUrl.searchParams.get('endpoint') || '';

    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      return Response.json(
        { error: 'Unsupported OpenF1 endpoint' },
        { status: 400 }
      );
    }

    const upstreamUrl = new URL(`https://api.openf1.org/v1/${endpoint}`);

    for (const [key, value] of requestUrl.searchParams.entries()) {
      if (key === 'endpoint') continue;
      upstreamUrl.searchParams.append(key, value);
    }

    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'F1-Live-Timing-v0.1.2'
      }
    });

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    });
  } catch (error) {
    console.error('OpenF1 proxy error:', error);

    return Response.json(
      {
        error: 'OpenF1 upstream request failed',
        detail: error instanceof Error ? error.message : String(error)
      },
      { status: 502 }
    );
  }
}
