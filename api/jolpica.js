const ALLOWED_TYPES = new Set(['standings', 'schedule', 'results']);

const ITALY_2026_POINTS = new Map([
  ['antonelli', 25],
  ['russell', 18],
  ['max_verstappen', 15],
  ['norris', 12],
  ['piastri', 10],
  ['hamilton', 8],
  ['gasly', 6],
  ['arvid_lindblad', 4],
  ['colapinto', 2],
  ['tsunoda', 1]
]);

function applyItaly2026FreshnessOverlay(payload) {
  const table = payload?.MRData?.StandingsTable;
  const list = table?.StandingsLists?.[0];
  const standings = list?.DriverStandings;
  if (!Array.isArray(standings) || String(list?.round || table?.round) !== '13') return false;

  const antonelli = standings.find((row) => row?.Driver?.driverId === 'antonelli');
  const russell = standings.find((row) => row?.Driver?.driverId === 'russell');

  // Exact pre-Italian-GP snapshot guard. Once Jolpica publishes the post-race
  // standings (Antonelli 267 / Russell 201), this overlay stops applying.
  if (String(antonelli?.points) !== '242' || String(russell?.points) !== '183') return false;

  for (const row of standings) {
    const driverId = row?.Driver?.driverId;
    const racePoints = ITALY_2026_POINTS.get(driverId) || 0;
    row.points = String(Number(row.points || 0) + racePoints);
    if (driverId === 'antonelli') row.wins = String(Number(row.wins || 0) + 1);
  }

  standings.sort((a, b) => Number(b.points) - Number(a.points));
  standings.forEach((row, index) => {
    row.position = String(index + 1);
    row.positionText = String(index + 1);
  });

  payload.MRData.provisional = {
    applied: true,
    id: '2026-italy-r13',
    note: 'Temporary verified race-result overlay while upstream standings are awaiting refresh.'
  };
  return true;
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const season = url.searchParams.get('season') || 'current';
    const type = url.searchParams.get('type') || 'standings';
    const round = url.searchParams.get('round') || 'last';

    if (!/^(current|\d{4})$/.test(season) || !ALLOWED_TYPES.has(type)) {
      return Response.json({ error: 'Invalid Jolpica request' }, { status: 400 });
    }
    if (type === 'results' && !/^(last|next|\d{1,2})$/.test(round)) {
      return Response.json({ error: 'Invalid round' }, { status: 400 });
    }

    let path;
    if (type === 'standings') path = `/ergast/f1/${season}/driverstandings/`;
    else if (type === 'schedule') path = `/ergast/f1/${season}/races/`;
    else path = `/ergast/f1/${season}/${round}/results/`;

    const upstream = await fetch(`https://api.jolpi.ca${path}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'F1-Championship-Magic-Number-v0.1'
      }
    });

    const body = await upstream.text();
    let responseBody = body;
    let provisionalApplied = false;

    if (upstream.ok && type === 'standings' && season === '2026') {
      try {
        const parsed = JSON.parse(body);
        provisionalApplied = applyItaly2026FreshnessOverlay(parsed);
        responseBody = JSON.stringify(parsed);
      } catch {
        // Return the upstream body unchanged if parsing fails.
      }
    }

    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-F1-Provisional-Overlay': provisionalApplied ? '2026-italy-r13' : 'none'
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
