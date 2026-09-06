const ALLOWED_TYPES = new Set([
  'standings',
  'constructors',
  'schedule',
  'results',
  'results_all',
  'qualifying_all'
]);

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

const ITALY_2026_RESULTS = [
  { driverId: 'antonelli', number: '12', code: 'ANT', constructorId: 'mercedes', constructorName: 'Mercedes', position: 1, points: 25 },
  { driverId: 'russell', number: '63', code: 'RUS', constructorId: 'mercedes', constructorName: 'Mercedes', position: 2, points: 18 },
  { driverId: 'max_verstappen', number: '3', code: 'VER', constructorId: 'red_bull', constructorName: 'Red Bull', position: 3, points: 15 },
  { driverId: 'norris', number: '1', code: 'NOR', constructorId: 'mclaren', constructorName: 'McLaren', position: 4, points: 12 },
  { driverId: 'piastri', number: '81', code: 'PIA', constructorId: 'mclaren', constructorName: 'McLaren', position: 5, points: 10 },
  { driverId: 'hamilton', number: '44', code: 'HAM', constructorId: 'ferrari', constructorName: 'Ferrari', position: 6, points: 8 },
  { driverId: 'gasly', number: '10', code: 'GAS', constructorId: 'alpine', constructorName: 'Alpine F1 Team', position: 7, points: 6 },
  { driverId: 'arvid_lindblad', number: '41', code: 'LIN', constructorId: 'rb', constructorName: 'RB F1 Team', position: 8, points: 4 },
  { driverId: 'colapinto', number: '43', code: 'COL', constructorId: 'alpine', constructorName: 'Alpine F1 Team', position: 9, points: 2 },
  { driverId: 'tsunoda', number: '22', code: 'TSU', constructorId: 'rb', constructorName: 'RB F1 Team', position: 10, points: 1 }
];

const ITALY_2026_TEAM_POINTS = new Map([
  ['mercedes', 43],
  ['red_bull', 15],
  ['mclaren', 22],
  ['ferrari', 8],
  ['alpine', 8],
  ['rb', 5]
]);

function markProvisional(payload, id, note) {
  payload.MRData ||= {};
  payload.MRData.provisional = { applied: true, id, note };
}

function applyItaly2026DriverOverlay(payload) {
  const table = payload?.MRData?.StandingsTable;
  const list = table?.StandingsLists?.[0];
  const standings = list?.DriverStandings;
  if (!Array.isArray(standings) || String(list?.round || table?.round) !== '13') return false;

  const antonelli = standings.find((row) => row?.Driver?.driverId === 'antonelli');
  const russell = standings.find((row) => row?.Driver?.driverId === 'russell');
  if (String(antonelli?.points) !== '242' || String(russell?.points) !== '183') return false;

  const racePoints = new Map(ITALY_2026_RESULTS.map((row) => [row.driverId, row.points]));
  for (const row of standings) {
    const driverId = row?.Driver?.driverId;
    row.points = String(Number(row.points || 0) + (racePoints.get(driverId) || 0));
    if (driverId === 'antonelli') row.wins = String(Number(row.wins || 0) + 1);
  }

  standings.sort((a, b) => Number(b.points) - Number(a.points) || Number(b.wins || 0) - Number(a.wins || 0));
  standings.forEach((row, index) => {
    row.position = String(index + 1);
    row.positionText = String(index + 1);
  });

  markProvisional(payload, '2026-italy-r13-drivers', 'Verified Italian GP result overlay while upstream driver standings await refresh.');
  return true;
}

function applyItaly2026ConstructorOverlay(payload) {
  const table = payload?.MRData?.StandingsTable;
  const list = table?.StandingsLists?.[0];
  const standings = list?.ConstructorStandings;
  if (!Array.isArray(standings) || String(list?.round || table?.round) !== '13') return false;

  const mercedes = standings.find((row) => row?.Constructor?.constructorId === 'mercedes');
  if (String(mercedes?.points) !== '425') return false;

  for (const row of standings) {
    const constructorId = row?.Constructor?.constructorId;
    row.points = String(Number(row.points || 0) + (ITALY_2026_TEAM_POINTS.get(constructorId) || 0));
    if (constructorId === 'mercedes') row.wins = String(Number(row.wins || 0) + 1);
  }

  standings.sort((a, b) => Number(b.points) - Number(a.points) || Number(b.wins || 0) - Number(a.wins || 0));
  standings.forEach((row, index) => {
    row.position = String(index + 1);
    row.positionText = String(index + 1);
  });

  markProvisional(payload, '2026-italy-r13-constructors', 'Verified Italian GP result overlay while upstream constructor standings await refresh.');
  return true;
}

function applyItaly2026ResultsOverlay(payload) {
  const table = payload?.MRData?.RaceTable;
  const races = table?.Races;
  if (!Array.isArray(races) || races.some((race) => String(race.round) === '13')) return false;

  races.push({
    season: '2026',
    round: '13',
    raceName: 'Italian Grand Prix',
    date: '2026-09-06',
    Circuit: { circuitId: 'monza', circuitName: 'Autodromo Nazionale di Monza', Location: { locality: 'Monza', country: 'Italy' } },
    Results: ITALY_2026_RESULTS.map((row) => ({
      number: row.number,
      position: String(row.position),
      positionText: String(row.position),
      points: String(row.points),
      Driver: { driverId: row.driverId, permanentNumber: row.number, code: row.code },
      Constructor: { constructorId: row.constructorId, name: row.constructorName }
    }))
  });
  races.sort((a, b) => Number(a.round) - Number(b.round));
  table.round = '13';
  markProvisional(payload, '2026-italy-r13-results', 'Top-10 Italian GP classification overlay for current countback/form calculations while upstream results await refresh.');
  return true;
}

async function fetchUpstream(path) {
  const response = await fetch(`https://api.jolpi.ca${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'F1-Championship-Magic-Number-v0.2.1'
    }
  });
  const body = await response.text();
  return { response, body };
}

function raceKey(race) {
  return `${race?.season || ''}:${race?.round || ''}`;
}

function mergeRacePages(pages, resultKey) {
  const first = structuredClone(pages[0]);
  const outputTable = first?.MRData?.RaceTable;
  if (!outputTable) throw new Error('Unexpected Jolpica paged response');

  const raceMap = new Map();
  for (const page of pages) {
    const races = page?.MRData?.RaceTable?.Races || [];
    for (const race of races) {
      const key = raceKey(race);
      if (!raceMap.has(key)) {
        raceMap.set(key, structuredClone(race));
        continue;
      }
      const target = raceMap.get(key);
      const incoming = race?.[resultKey] || [];
      const existing = target?.[resultKey] || [];
      const seen = new Set(existing.map((entry) => entry?.Driver?.driverId || `${entry?.number || ''}:${entry?.position || ''}`));
      for (const entry of incoming) {
        const entryKey = entry?.Driver?.driverId || `${entry?.number || ''}:${entry?.position || ''}`;
        if (!seen.has(entryKey)) {
          existing.push(entry);
          seen.add(entryKey);
        }
      }
      existing.sort((a, b) => Number(a?.position || 999) - Number(b?.position || 999));
      target[resultKey] = existing;
    }
  }

  outputTable.Races = [...raceMap.values()].sort((a, b) => Number(a?.round || 999) - Number(b?.round || 999));
  outputTable.round = outputTable.Races.at(-1)?.round || outputTable.round;
  first.MRData.limit = String(pages.reduce((sum, page) => sum + Number(page?.MRData?.limit || 0), 0));
  first.MRData.offset = '0';
  first.MRData.total = String(pages[0]?.MRData?.total || outputTable.Races.reduce((sum, race) => sum + (race?.[resultKey]?.length || 0), 0));
  first.MRData.pagination = { merged: true, pages: pages.length, pageSize: PAGE_SIZE };
  return first;
}

async function fetchPagedSeason(season, endpoint, resultKey) {
  const firstCall = await fetchUpstream(`/ergast/f1/${season}/${endpoint}/?limit=${PAGE_SIZE}&offset=0`);
  if (!firstCall.response.ok) return firstCall;

  const firstPage = JSON.parse(firstCall.body);
  const total = Number(firstPage?.MRData?.total || 0);
  const pageCount = Math.max(1, Math.min(MAX_PAGES, Math.ceil(total / PAGE_SIZE)));
  if (pageCount === 1) return { response: firstCall.response, body: JSON.stringify(firstPage) };

  const offsets = Array.from({ length: pageCount - 1 }, (_, index) => (index + 1) * PAGE_SIZE);
  const rest = await Promise.all(offsets.map(async (offset) => {
    const call = await fetchUpstream(`/ergast/f1/${season}/${endpoint}/?limit=${PAGE_SIZE}&offset=${offset}`);
    if (!call.response.ok) throw new Error(`Jolpica ${endpoint} page at offset ${offset} failed with ${call.response.status}`);
    return JSON.parse(call.body);
  }));

  const merged = mergeRacePages([firstPage, ...rest], resultKey);
  return { response: firstCall.response, body: JSON.stringify(merged) };
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

    let upstreamCall;
    if (type === 'results_all') {
      upstreamCall = await fetchPagedSeason(season, 'results', 'Results');
    } else if (type === 'qualifying_all') {
      upstreamCall = await fetchPagedSeason(season, 'qualifying', 'QualifyingResults');
    } else {
      let path;
      if (type === 'standings') path = `/ergast/f1/${season}/driverstandings/`;
      else if (type === 'constructors') path = `/ergast/f1/${season}/constructorstandings/`;
      else if (type === 'schedule') path = `/ergast/f1/${season}/races/`;
      else path = `/ergast/f1/${season}/${round}/results/`;
      upstreamCall = await fetchUpstream(path);
    }

    const { response: upstream, body } = upstreamCall;
    let responseBody = body;
    let provisionalId = 'none';

    if (upstream.ok && season === '2026') {
      try {
        const parsed = JSON.parse(body);
        let applied = false;
        if (type === 'standings') applied = applyItaly2026DriverOverlay(parsed);
        else if (type === 'constructors') applied = applyItaly2026ConstructorOverlay(parsed);
        else if (type === 'results_all') applied = applyItaly2026ResultsOverlay(parsed);
        if (applied) provisionalId = parsed?.MRData?.provisional?.id || '2026-italy-r13';
        responseBody = JSON.stringify(parsed);
      } catch {
        // Keep upstream response unchanged if parsing fails.
      }
    }

    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'X-F1-Provisional-Overlay': provisionalId
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
