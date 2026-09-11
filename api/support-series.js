const CONFIG = {
  f2: {
    label: 'FIA Formula 2',
    short: 'F2',
    driverUrl: 'https://www.fiaformula2.com/en/standings/2026/drivers',
    teamUrl: 'https://www.fiaformula2.com/en/standings/2026/teams',
    schedule: [
      ['Melbourne','2026-03-08',39,65], ['Miami Gardens','2026-05-03',39,65],
      ['Montréal','2026-05-24',39,65], ['Monte Carlo','2026-06-07',39,65],
      ['Barcelona','2026-06-14',39,65], ['Spielberg','2026-06-28',39,65],
      ['Silverstone','2026-07-05',39,65], ['Spa-Francorchamps','2026-07-19',39,65],
      ['Budapest','2026-07-26',39,65], ['Monza','2026-09-06',39,65],
      ['Madrid','2026-09-13',39,65], ['Baku','2026-09-26',39,65],
      ['Lusail','2026-11-29',39,65], ['Yas Marina','2026-12-06',39,65]
    ]
  },
  f3: {
    label: 'FIA Formula 3',
    short: 'F3',
    driverUrl: 'https://www.fiaformula3.com/en/standings/2026/drivers',
    teamUrl: 'https://www.fiaformula3.com/en/standings/2026/teams',
    schedule: [
      ['Melbourne','2026-03-08',39,89], ['Monte Carlo','2026-06-07',39,89],
      ['Barcelona','2026-06-14',39,89], ['Spielberg','2026-06-28',39,89],
      ['Silverstone','2026-07-05',39,89], ['Spa-Francorchamps','2026-07-19',39,89],
      ['Budapest','2026-07-26',39,89], ['Monza','2026-09-06',39,89],
      ['Madrid','2026-09-13',67,150]
    ]
  },
  f1a: {
    label: 'F1 Academy',
    short: 'F1 Academy',
    driverUrl: 'https://www.f1academy.com/Racing-Series/Standings/Driver',
    teamUrl: 'https://www.f1academy.com/Racing-Series/Standings/Team',
    schedule: [
      ['Shanghai','2026-03-15',39,86], ['Montreal','2026-05-24',65,145],
      ['Silverstone','2026-07-05',39,86], ['Zandvoort','2026-08-23',39,86],
      ['Austin','2026-10-25',65,145], ['Las Vegas','2026-11-21',39,86]
    ]
  }
};

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
}

function cleanText(value) {
  return decodeHtml(String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function pickStandingsArray(data) {
  const direct = data?.props?.pageProps?.pageData?.Standings;
  if (Array.isArray(direct) && direct.length) return direct;
  const seen = new Set();
  const queue = [data];
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value) && value.length && value.some((item) => item && typeof item === 'object' && ('TotalPoints' in item || 'totalPoints' in item))) {
      return value;
    }
    for (const child of Object.values(value)) {
      if (child && typeof child === 'object') queue.push(child);
    }
  }
  return [];
}

function normalizeNextData(items) {
  return items.map((item, index) => {
    const name = cleanText(item.FullName || item.DisplayName || item.TeamName || item.Name || item.DriverName || '');
    const points = Number(item.TotalPoints ?? item.totalPoints ?? item.Points ?? item.points ?? 0);
    const position = Number(item.Position ?? item.position ?? item.Rank ?? item.rank ?? index + 1);
    return { position: Number.isFinite(position) ? position : index + 1, name, points: Number.isFinite(points) ? points : 0 };
  }).filter((item) => item.name && Number.isFinite(item.points));
}

function parseHtmlRows(html) {
  const rows = [];
  const rowMatches = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const rowHtml of rowMatches) {
    const cells = [...rowHtml.matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((match) => cleanText(match[1])).filter(Boolean);
    if (cells.length < 2) continue;
    let pointsIndex = -1;
    for (let i = cells.length - 1; i >= 0; i -= 1) {
      if (/^\d+(?:\.\d+)?$/.test(cells[i])) { pointsIndex = i; break; }
    }
    if (pointsIndex < 1) continue;
    const points = Number(cells[pointsIndex]);
    if (!Number.isFinite(points)) continue;
    const nameCell = cells.find((cell, i) => i < pointsIndex && /[A-Za-zÀ-ž]/.test(cell) && !/^(driver|team|points|pts|sr|fr|rg|or)$/i.test(cell));
    if (!nameCell) continue;
    const positionMatch = cells.join(' ').match(/^\s*(\d{1,2})/);
    const name = nameCell.replace(/^\d+[.)]?\s*/, '').replace(/\s+[A-Z]{3}$/, '').trim();
    if (!name || /standings|grand prix/i.test(name)) continue;
    rows.push({ position: positionMatch ? Number(positionMatch[1]) : rows.length + 1, name, points });
  }
  return rows;
}

function parseStandings(html) {
  const nextMatch = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextMatch) {
    try {
      const data = JSON.parse(nextMatch[1]);
      const normalized = normalizeNextData(pickStandingsArray(data));
      if (normalized.length) return normalized.sort((a, b) => a.position - b.position);
    } catch {}
  }
  return parseHtmlRows(html).sort((a, b) => a.position - b.position);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'Formula-Championship-Magic-Number-v0.4'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

function scheduleState(schedule) {
  const today = new Date();
  const endOfToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59));
  const rounds = schedule.map((entry, index) => ({
    round: index + 1,
    name: entry[0],
    endDate: entry[1],
    maxDriver: entry[2],
    maxTeam: entry[3]
  }));
  const completed = rounds.filter((round) => new Date(`${round.endDate}T23:59:59Z`) < endOfToday);
  return {
    latest: completed.at(-1) || null,
    remaining: rounds.filter((round) => !completed.some((done) => done.round === round.round))
  };
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const series = (url.searchParams.get('series') || '').toLowerCase();
    const season = Number(url.searchParams.get('season') || 2026);
    const config = CONFIG[series];
    if (!config || season !== 2026) {
      return Response.json({ error: 'Unsupported series or season' }, { status: 400 });
    }

    const [driverHtml, teamHtml] = await Promise.all([fetchText(config.driverUrl), fetchText(config.teamUrl)]);
    const drivers = parseStandings(driverHtml);
    const teams = parseStandings(teamHtml);
    if (!drivers.length || !teams.length) throw new Error('Official standings could not be parsed');
    const schedule = scheduleState(config.schedule);

    return Response.json({
      series,
      seriesLabel: config.label,
      seriesShort: config.short,
      season,
      source: 'official',
      sourceLabel: `${config.label} 공식 사이트`,
      countbackExact: false,
      drivers,
      teams,
      latest: schedule.latest,
      remaining: schedule.remaining,
      fetchedAt: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    console.error('Support series proxy error:', error);
    return Response.json({ error: 'Support series upstream request failed', detail: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
