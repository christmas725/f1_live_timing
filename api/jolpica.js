const ALLOWED_TYPES = new Set(['standings', 'schedule']);

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const season = url.searchParams.get('season') || 'current';
    const type = url.searchParams.get('type') || 'standings';

    if (!/^(current|\d{4})$/.test(season) || !ALLOWED_TYPES.has(type)) {
      return Response.json({ error: 'Invalid Jolpica request' }, { status: 400 });
    }

    const path = type === 'standings'
      ? `/ergast/f1/${season}/driverstandings/`
      : `/ergast/f1/${season}/races/`;

    const upstream = await fetch(`https://api.jolpi.ca${path}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'F1-Championship-Magic-Number-v0.1'
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
    console.error('Jolpica proxy error:', error);
    return Response.json(
      { error: 'Jolpica upstream request failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
