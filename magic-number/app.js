const DRIVER_GP_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const DRIVER_SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const TEAM_GP_MAX = 43;
const TEAM_SPRINT_MAX = 15;
const SIMULATIONS = 3000;

const TEAM_COLOURS = {
  mercedes: '00a19c', ferrari: 'e8002d', mclaren: 'ff8000', red_bull: '3671c6',
  alpine: 'ff87bc', aston_martin: '229971', williams: '64c4ff', rb: '6692ff',
  haas: 'b6babd', audi: 'f50537', cadillac: 'd4af37'
};

const els = {
  modeButtons: [...document.querySelectorAll('.mode-btn')],
  seasonSelect: document.querySelector('#seasonSelect'),
  entityLabel: document.querySelector('#entityLabel'),
  entitySelect: document.querySelector('#entitySelect'),
  refreshBtn: document.querySelector('#refreshBtn'),
  dataStatus: document.querySelector('#dataStatus'),
  magicNumber: document.querySelector('#magicNumber'),
  magicText: document.querySelector('#magicText'),
  magicNote: document.querySelector('#magicNote'),
  magicProgress: document.querySelector('#magicProgress'),
  selectedCardLabel: document.querySelector('#selectedCardLabel'),
  entityBadge: document.querySelector('#entityBadge'),
  entityName: document.querySelector('#entityName'),
  entityTeam: document.querySelector('#entityTeam'),
  entityPoints: document.querySelector('#entityPoints'),
  entityPosition: document.querySelector('#entityPosition'),
  gapToThreat: document.querySelector('#gapToThreat'),
  remainingMax: document.querySelector('#remainingMax'),
  remainingGp: document.querySelector('#remainingGp'),
  remainingSprint: document.querySelector('#remainingSprint'),
  latestRound: document.querySelector('#latestRound'),
  titleProbability: document.querySelector('#titleProbability'),
  projectedClinch: document.querySelector('#projectedClinch'),
  simulationCount: document.querySelector('#simulationCount'),
  countbackBadge: document.querySelector('#countbackBadge'),
  countbackSummary: document.querySelector('#countbackSummary'),
  countbackRows: document.querySelector('#countbackRows'),
  nextRoundTitle: document.querySelector('#nextRoundTitle'),
  clinchSummary: document.querySelector('#clinchSummary'),
  scenarioList: document.querySelector('#scenarioList'),
  probabilityList: document.querySelector('#probabilityList'),
  forecastMethod: document.querySelector('#forecastMethod'),
  fieldTitle: document.querySelector('#fieldTitle'),
  entityHeader: document.querySelector('#entityHeader'),
  rivalsBody: document.querySelector('#rivalsBody'),
  updatedAt: document.querySelector('#updatedAt')
};

let state = {
  year: 2026,
  mode: 'drivers',
  source: '',
  provisional: false,
  driverEntities: [],
  constructorEntities: [],
  driverMeta: new Map(),
  constructorMeta: new Map(),
  raceHistory: [],
  qualifyingHistory: [],
  latestRound: 0,
  latestMeeting: null,
  remainingMeetings: [],
  remainingSprints: 0,
  selectedId: null,
  forecastToken: 0
};

async function jolpica(type, season) {
  const url = new URL('/api/jolpica', window.location.origin);
  url.searchParams.set('type', type);
  url.searchParams.set('season', season);
  const response = await fetch(url, { cache: 'no-store' });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!response.ok) throw new Error(data?.detail || data?.error || `Jolpica ${type} HTTP ${response.status}`);
  if (!data || typeof data !== 'object') throw new Error(`Unexpected Jolpica ${type} response`);
  return data;
}

function setStatus(message, kind = '') {
  els.dataStatus.textContent = message;
  els.dataStatus.className = `status ${kind}`.trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeDriverStandings(data) {
  const table = data?.MRData?.StandingsTable;
  const list = table?.StandingsLists?.[0];
  const rows = list?.DriverStandings;
  if (!Array.isArray(rows) || !rows.length) throw new Error('드라이버 순위 데이터가 비어 있습니다.');

  const meta = new Map();
  const entities = rows.map((entry) => {
    const driver = entry.Driver || {};
    const constructor = entry.Constructors?.at(-1) || entry.Constructors?.[0] || {};
    const id = driver.driverId || String(driver.permanentNumber || entry.position);
    const name = [driver.givenName, driver.familyName].filter(Boolean).join(' ') || id;
    const code = driver.code || driver.familyName?.slice(0, 3)?.toUpperCase() || id.slice(0, 3).toUpperCase();
    const teamId = constructor.constructorId || '';
    const teamName = constructor.name || '—';
    const entity = {
      id, kind: 'driver', name, code,
      points: Number(entry.points || 0), position: Number(entry.position || 999), wins: Number(entry.wins || 0),
      teamId, sub: teamName, color: TEAM_COLOURS[teamId] || 'ff365e'
    };
    meta.set(id, entity);
    return entity;
  }).sort((a, b) => a.position - b.position);

  return { round: Number(list?.round || table?.round || 0), entities, meta, provisional: Boolean(data?.MRData?.provisional?.applied) };
}

function normalizeConstructorStandings(data) {
  const table = data?.MRData?.StandingsTable;
  const list = table?.StandingsLists?.[0];
  const rows = list?.ConstructorStandings;
  if (!Array.isArray(rows) || !rows.length) throw new Error('컨스트럭터 순위 데이터가 비어 있습니다.');

  const meta = new Map();
  const entities = rows.map((entry) => {
    const constructor = entry.Constructor || {};
    const id = constructor.constructorId || String(entry.position);
    const name = constructor.name || id;
    const code = constructorCode(name);
    const entity = {
      id, kind: 'constructor', name, code,
      points: Number(entry.points || 0), position: Number(entry.position || 999), wins: Number(entry.wins || 0),
      sub: constructor.nationality || 'Constructor', color: TEAM_COLOURS[id] || 'ff365e'
    };
    meta.set(id, entity);
    return entity;
  }).sort((a, b) => a.position - b.position);

  return { round: Number(list?.round || table?.round || 0), entities, meta, provisional: Boolean(data?.MRData?.provisional?.applied) };
}

function constructorCode(name) {
  const known = {
    Mercedes: 'MER', Ferrari: 'FER', McLaren: 'MCL', 'Red Bull': 'RBR', 'Red Bull Racing': 'RBR',
    'Alpine F1 Team': 'ALP', 'Aston Martin': 'AMR', Williams: 'WIL', 'RB F1 Team': 'RB',
    'Racing Bulls': 'RB', 'Haas F1 Team': 'HAS', Audi: 'AUD', 'Cadillac F1 Team': 'CAD'
  };
  return known[name] || name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((word) => word[0]).join('').slice(0, 3).toUpperCase();
}

function normalizeSchedule(data, latestRound) {
  const races = data?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races) || !races.length) throw new Error('시즌 일정 데이터가 비어 있습니다.');
  const normalized = races.map((race) => ({
    round: Number(race.round),
    meeting_name: race.raceName || `Round ${race.round}`,
    country_name: race.Circuit?.Location?.country || '',
    location: race.Circuit?.Location?.locality || '',
    date: race.date || '',
    is_sprint: Boolean(race.Sprint)
  }));
  return {
    latest: normalized.find((race) => race.round === latestRound) || normalized.filter((race) => race.round <= latestRound).at(-1) || null,
    remaining: normalized.filter((race) => race.round > latestRound)
  };
}

function normalizeRaceHistory(data) {
  const races = data?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races)) return [];
  return races.map((race) => ({
    round: Number(race.round),
    name: race.raceName || `Round ${race.round}`,
    results: (race.Results || []).map((result) => ({
      driverId: result.Driver?.driverId || '',
      constructorId: result.Constructor?.constructorId || '',
      position: Number(result.position || 999),
      points: Number(result.points || 0)
    }))
  })).sort((a, b) => a.round - b.round);
}

function normalizeQualifyingHistory(data) {
  const races = data?.MRData?.RaceTable?.Races;
  if (!Array.isArray(races)) return [];
  return races.map((race) => ({
    round: Number(race.round),
    name: race.raceName || `Round ${race.round}`,
    results: (race.QualifyingResults || []).map((result) => ({
      driverId: result.Driver?.driverId || '',
      constructorId: result.Constructor?.constructorId || '',
      position: Number(result.position || 999)
    }))
  })).sort((a, b) => a.round - b.round);
}

function currentEntities() {
  return state.mode === 'drivers' ? state.driverEntities : state.constructorEntities;
}

function currentMeta() {
  return state.mode === 'drivers' ? state.driverMeta : state.constructorMeta;
}

function selectedEntity() {
  return currentMeta().get(state.selectedId) || currentEntities()[0] || null;
}

function maxPerGp() { return state.mode === 'drivers' ? DRIVER_GP_POINTS[0] : TEAM_GP_MAX; }
function maxPerSprint() { return state.mode === 'drivers' ? DRIVER_SPRINT_POINTS[0] : TEAM_SPRINT_MAX; }
function remainingMax() { return state.remainingMeetings.length * maxPerGp() + state.remainingSprints * maxPerSprint(); }
function nextEventMax() { return maxPerGp() + (state.remainingMeetings[0]?.is_sprint ? maxPerSprint() : 0); }

function resultCounts(entity, history, maxPosition = 24) {
  const counts = Array(maxPosition + 1).fill(0);
  for (const race of history) {
    for (const result of race.results) {
      const matches = entity.kind === 'driver' ? result.driverId === entity.id : result.constructorId === entity.id;
      if (matches && result.position >= 1 && result.position <= maxPosition) counts[result.position] += 1;
    }
  }
  if (history === state.raceHistory && counts[1] === 0 && entity.wins) counts[1] = entity.wins;
  return counts;
}

function compareCountback(a, b) {
  const aRace = resultCounts(a, state.raceHistory);
  const bRace = resultCounts(b, state.raceHistory);
  for (let pos = 1; pos < aRace.length; pos += 1) {
    if (aRace[pos] !== bRace[pos]) return { winner: aRace[pos] > bRace[pos] ? a.id : b.id, source: 'race', position: pos, aRace, bRace };
  }
  const aQuali = resultCounts(a, state.qualifyingHistory);
  const bQuali = resultCounts(b, state.qualifyingHistory);
  for (let pos = 1; pos < aQuali.length; pos += 1) {
    if (aQuali[pos] !== bQuali[pos]) return { winner: aQuali[pos] > bQuali[pos] ? a.id : b.id, source: 'qualifying', position: pos, aRace, bRace, aQuali, bQuali };
  }
  return { winner: null, source: 'unresolved', position: null, aRace, bRace, aQuali, bQuali };
}

function countbackGuaranteed(a, b) {
  const aWins = resultCounts(a, state.raceHistory)[1] || a.wins || 0;
  const bWins = resultCounts(b, state.raceHistory)[1] || b.wins || 0;
  return aWins > bWins + state.remainingMeetings.length;
}

function magicAgainst(candidate, rival) {
  const max = remainingMax();
  const gap = candidate.points - rival.points;
  const base = Math.max(0, max - gap + 1);
  const locked = base > 0 && countbackGuaranteed(candidate, rival);
  return { base, magic: Math.max(0, base - (locked ? 1 : 0)), locked, gap };
}

function strongestRival(candidate) {
  return currentEntities()
    .filter((entity) => entity.id !== candidate.id)
    .map((rival) => ({ rival, ...magicAgainst(candidate, rival) }))
    .sort((a, b) => b.magic - a.magic || b.rival.points - a.rival.points)[0] || null;
}

function isEliminated(entity) {
  const max = remainingMax();
  return currentEntities().some((rival) => {
    if (rival.id === entity.id) return false;
    if (entity.points + max < rival.points) return true;
    if (entity.points + max === rival.points && countbackGuaranteed(rival, entity)) return true;
    return false;
  });
}

function populateEntitySelect() {
  const entities = currentEntities();
  const previous = state.selectedId;
  els.entitySelect.replaceChildren();
  for (const entity of entities) {
    const option = document.createElement('option');
    option.value = entity.id;
    option.textContent = `P${entity.position} · ${entity.name} · ${entity.points} pts`;
    els.entitySelect.append(option);
  }
  state.selectedId = entities.some((entity) => entity.id === previous) ? previous : entities[0]?.id || null;
  els.entitySelect.value = state.selectedId || '';
}

function renderModeLabels() {
  const constructors = state.mode === 'constructors';
  els.entityLabel.textContent = constructors ? '기준 컨스트럭터' : '기준 드라이버';
  els.selectedCardLabel.textContent = constructors ? 'SELECTED CONSTRUCTOR' : 'SELECTED DRIVER';
  els.fieldTitle.textContent = constructors ? '컨스트럭터별 매직넘버' : '경쟁자별 매직넘버';
  els.entityHeader.textContent = constructors ? 'Constructor' : 'Driver';
  els.modeButtons.forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderHero(candidate, threat) {
  const max = remainingMax();
  const eliminated = isEliminated(candidate);
  if (eliminated) {
    els.magicNumber.textContent = 'OUT';
    els.magicText.textContent = `${candidate.name}은(는) 현재 남은 최대 포인트를 모두 얻어도 챔피언십 선두를 추월할 수 없습니다.`;
    els.magicProgress.style.width = '0%';
    els.magicNote.textContent = '수학적으로 챔피언 가능성이 소멸한 상태입니다.';
  } else if (!threat || threat.magic === 0) {
    els.magicNumber.textContent = '0';
    els.magicText.textContent = `${candidate.name}은(는) 수학적으로 챔피언을 확정한 상태입니다.`;
    els.magicProgress.style.width = '100%';
    els.magicNote.textContent = '남은 결과와 관계없이 챔피언십 1위를 유지합니다.';
  } else {
    els.magicNumber.textContent = String(threat.magic);
    els.magicText.textContent = `${threat.rival.name} 기준 · 현재 격차 ${formatGap(threat.gap)}점 · 경쟁자의 남은 최대점 ${max}점.`;
    const denominator = Math.max(1, max + Math.max(0, -threat.gap) + 1);
    const progress = Math.max(0, Math.min(100, 100 - threat.magic / denominator * 100));
    els.magicProgress.style.width = `${progress}%`;
    els.magicNote.textContent = threat.locked
      ? `현재 레이스 우승 countback이 남은 모든 GP를 감안해도 뒤집히지 않아 동점 우승이 보장됩니다. 기본 매직넘버 ${threat.base}에서 1점을 차감했습니다.`
      : '동점 상황에서 countback이 아직 미래 결과로 뒤집힐 수 있으므로 안전하게 1점 앞서는 기준을 사용합니다.';
  }

  els.entityBadge.textContent = candidate.code;
  els.entityBadge.style.background = `linear-gradient(135deg, #${candidate.color}, #31384a)`;
  els.entityName.textContent = candidate.name;
  els.entityTeam.textContent = candidate.sub || '—';
  els.entityPoints.textContent = candidate.points;
  els.entityPosition.textContent = `P${candidate.position}`;
  els.gapToThreat.textContent = threat ? formatGap(candidate.points - threat.rival.points) : '—';
  els.remainingMax.textContent = max;
  els.remainingGp.textContent = state.remainingMeetings.length;
  els.remainingSprint.textContent = state.remainingSprints;
  els.latestRound.textContent = `최신 완료 기준: ${state.latestMeeting?.meeting_name || `Round ${state.latestRound}`} · ${state.provisional ? '결과 반영 보정 사용 중' : '공개 데이터 동기화'}`;
}

function renderCountback(candidate, threat) {
  els.countbackRows.replaceChildren();
  if (!threat) {
    els.countbackBadge.textContent = 'NO RIVAL';
    els.countbackSummary.textContent = '비교할 경쟁자가 없습니다.';
    return;
  }

  const rival = threat.rival;
  const comparison = compareCountback(candidate, rival);
  const favoursCandidate = comparison.winner === candidate.id;
  els.countbackBadge.textContent = comparison.winner ? (favoursCandidate ? 'ADVANTAGE' : 'TRAILING') : 'TIED';
  els.countbackBadge.className = `mini-pill ${favoursCandidate ? 'good' : comparison.winner ? 'warn' : ''}`.trim();

  if (comparison.winner) {
    const sourceText = comparison.source === 'race' ? '레이스' : '퀄리파잉';
    els.countbackSummary.textContent = `${candidate.name} vs ${rival.name}: ${sourceText} P${comparison.position} 횟수에서 현재 countback 우위가 갈립니다.${threat.locked ? ' 이 우위는 남은 레이스를 모두 고려해도 뒤집히지 않습니다.' : ' 다만 남은 경기 결과에 따라 바뀔 수 있습니다.'}`;
  } else {
    els.countbackSummary.textContent = `${candidate.name}와 ${rival.name}은 현재 확보된 레이스·퀄리파잉 countback 데이터에서도 완전히 같습니다.`;
  }

  const aRace = comparison.aRace;
  const bRace = comparison.bRace;
  const aQuali = comparison.aQuali || resultCounts(candidate, state.qualifyingHistory);
  const bQuali = comparison.bQuali || resultCounts(rival, state.qualifyingHistory);
  const rows = [
    ['Race P1', aRace[1] || candidate.wins || 0, bRace[1] || rival.wins || 0],
    ['Race P2', aRace[2] || 0, bRace[2] || 0],
    ['Race P3', aRace[3] || 0, bRace[3] || 0],
    ['Quali P1', aQuali[1] || 0, bQuali[1] || 0]
  ];
  for (const [label, aValue, bValue] of rows) {
    const div = document.createElement('div');
    div.className = 'countback-row';
    div.innerHTML = `<span>${label}</span><strong>${escapeHtml(candidate.code)} ${aValue}</strong><strong>${escapeHtml(rival.code)} ${bValue}</strong>`;
    els.countbackRows.append(div);
  }
}

function renderScenarios(candidate, threat) {
  els.scenarioList.replaceChildren();
  const next = state.remainingMeetings[0];
  if (!next) {
    els.nextRoundTitle.textContent = '시즌 종료';
    els.clinchSummary.textContent = '남은 라운드가 없습니다.';
    return;
  }
  els.nextRoundTitle.textContent = `${next.meeting_name} 확정 시나리오`;
  if (!threat || threat.magic === 0) {
    els.clinchSummary.textContent = `${candidate.name}은(는) 이미 챔피언 확정 상태입니다.`;
    return;
  }
  if (isEliminated(candidate)) {
    els.clinchSummary.textContent = '이미 수학적으로 챔피언 가능성이 소멸했습니다.';
    return;
  }

  const eventMax = nextEventMax();
  const maxReduction = eventMax * 2;
  if (threat.magic > maxReduction) {
    els.clinchSummary.textContent = `다음 주말에 줄일 수 있는 최대 매직넘버는 ${maxReduction}입니다. 현재 ${threat.magic}이므로 이 라운드에서는 아직 확정할 수 없습니다.`;
  } else {
    els.clinchSummary.textContent = `${candidate.name}은(는) 다음 라운드에서 챔피언 확정이 가능합니다. 기준 경쟁자는 ${threat.rival.name}입니다.`;
  }

  const options = state.mode === 'drivers'
    ? (next.is_sprint ? [33, 30, 28, 25, 22, 20, 18] : DRIVER_GP_POINTS.slice(0, 8))
    : (next.is_sprint ? [58, 55, 51, 48, 45, 42, 40] : [43, 40, 36, 33, 30, 27, 25]);

  options.forEach((candidatePoints, index) => {
    const allowed = eventMax + candidatePoints - threat.magic;
    const div = document.createElement('div');
    div.className = 'scenario';
    const label = state.mode === 'drivers' && !next.is_sprint ? `P${index + 1} · ${candidatePoints}점` : `주말 ${candidatePoints}점`;
    const condition = allowed < 0 ? '이 경우 확정 불가' : allowed >= eventMax ? `${threat.rival.name} 결과와 무관` : `${threat.rival.name} ${Math.max(0, allowed)}점 이하 필요`;
    div.innerHTML = `<strong>${escapeHtml(label)}</strong><span>${escapeHtml(condition)}</span>`;
    els.scenarioList.append(div);
  });
}

function renderField(candidate) {
  const max = remainingMax();
  els.rivalsBody.replaceChildren();
  for (const entity of currentEntities()) {
    const selected = entity.id === candidate.id;
    const info = selected ? null : magicAgainst(candidate, entity);
    const eliminatedByCandidate = !selected && (candidate.points > entity.points + max || (candidate.points === entity.points + max && countbackGuaranteed(candidate, entity)));
    const tr = document.createElement('tr');
    if (eliminatedByCandidate) tr.classList.add('eliminated');
    const gap = candidate.points - entity.points;
    const cells = [
      [`P${entity.position}`, 'Pos'],
      [`<strong>${escapeHtml(entity.name)}</strong><span>${escapeHtml(entity.sub || '')}</span>`, state.mode === 'drivers' ? 'Driver' : 'Constructor', 'entity-cell'],
      [entity.points, 'Pts'],
      [selected ? '—' : formatGap(gap), 'Gap'],
      [selected ? candidate.points + max : entity.points + max, 'Max Final'],
      [selected ? '—' : `<span class="magic-pill">${info.magic}</span>`, 'Magic'],
      [selected ? '<span class="status-pill selected">SELECTED</span>' : eliminatedByCandidate ? '<span class="status-pill out">ELIMINATED</span>' : '<span class="status-pill alive">ALIVE</span>', 'Status']
    ];
    cells.forEach(([html, label, className]) => {
      const td = document.createElement('td');
      td.dataset.label = label;
      if (className) td.className = className;
      td.innerHTML = html;
      tr.append(td);
    });
    els.rivalsBody.append(tr);
  }
}

function formatGap(value) {
  if (value === 0) return 'TIED';
  return value > 0 ? `+${value}` : String(value);
}

function renderCore() {
  renderModeLabels();
  const candidate = selectedEntity();
  if (!candidate) return;
  const threat = strongestRival(candidate);
  renderHero(candidate, threat);
  renderCountback(candidate, threat);
  renderScenarios(candidate, threat);
  renderField(candidate);
  scheduleForecast();
}

function driverRecentPoints(driverId) {
  const recent = state.raceHistory.slice(-5);
  if (!recent.length) return 0;
  return recent.reduce((sum, race) => sum + (race.results.find((r) => r.driverId === driverId)?.points || 0), 0) / recent.length;
}

function buildDriverWeights() {
  const rounds = Math.max(1, state.latestRound);
  const raw = state.driverEntities.map((driver) => {
    const seasonAvg = driver.points / rounds;
    const recentAvg = driverRecentPoints(driver.id);
    const value = Math.max(.25, .65 * seasonAvg + .35 * recentAvg + .6);
    return [driver.id, value];
  });
  const total = raw.reduce((sum, [, value]) => sum + value, 0) || 1;
  return new Map(raw.map(([id, value]) => [id, value / total]));
}

function hashString(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function rng() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function sampleRanking(drivers, weights, rng) {
  return drivers.map((driver) => {
    const u = Math.min(.999999, Math.max(.000001, rng()));
    const gumbel = -Math.log(-Math.log(u));
    return { driver, score: Math.log(weights.get(driver.id) || .0001) + gumbel * .86 };
  }).sort((a, b) => b.score - a.score).map((entry) => entry.driver);
}

function cloneCounts(entity, maxPosition = 24) {
  return resultCounts(entity, state.raceHistory, maxPosition).slice();
}

function compareSimCountback(aId, bId, countsMap, standingsMap) {
  const a = countsMap.get(aId) || [];
  const b = countsMap.get(bId) || [];
  const max = Math.max(a.length, b.length, 24);
  for (let pos = 1; pos < max; pos += 1) {
    const av = a[pos] || 0;
    const bv = b[pos] || 0;
    if (av !== bv) return av > bv ? -1 : 1;
  }
  return (standingsMap.get(aId)?.position || 999) - (standingsMap.get(bId)?.position || 999);
}

function conservativeClinched(selectedId, pointsMap, entities, maxRemaining) {
  const selected = pointsMap.get(selectedId) ?? -Infinity;
  return entities.every((entity) => entity.id === selectedId || selected > (pointsMap.get(entity.id) || 0) + maxRemaining);
}

function runForecast() {
  const selected = selectedEntity();
  if (!selected || !state.driverEntities.length || !state.remainingMeetings.length) {
    return { driverProb: new Map(), constructorProb: new Map(), selectedProbability: selected && !isEliminated(selected) ? 100 : 0, projectedClinch: state.remainingMeetings.length ? '—' : '시즌 종료' };
  }

  const drivers = state.driverEntities.filter((driver) => driver.teamId);
  const teams = state.constructorEntities;
  const driverStandingMap = new Map(state.driverEntities.map((entity) => [entity.id, entity]));
  const teamStandingMap = new Map(teams.map((entity) => [entity.id, entity]));
  const weights = buildDriverWeights();
  const fingerprint = `${state.year}|${state.latestRound}|${state.driverEntities.map((d) => `${d.id}:${d.points}`).join(',')}|${state.constructorEntities.map((t) => `${t.id}:${t.points}`).join(',')}`;
  const rng = mulberry32(hashString(fingerprint));
  const driverChampions = new Map(drivers.map((d) => [d.id, 0]));
  const teamChampions = new Map(teams.map((t) => [t.id, 0]));
  const selectedClinch = new Map();

  for (let sim = 0; sim < SIMULATIONS; sim += 1) {
    const dPoints = new Map(drivers.map((d) => [d.id, d.points]));
    const tPoints = new Map(teams.map((t) => [t.id, t.points]));
    const dCounts = new Map(drivers.map((d) => [d.id, cloneCounts(d)]));
    const tCounts = new Map(teams.map((t) => [t.id, cloneCounts(t)]));
    let clinchedAt = null;

    state.remainingMeetings.forEach((meeting, meetingIndex) => {
      if (meeting.is_sprint) {
        const sprintOrder = sampleRanking(drivers, weights, rng);
        sprintOrder.forEach((driver, index) => {
          const pts = DRIVER_SPRINT_POINTS[index] || 0;
          if (!pts) return;
          dPoints.set(driver.id, (dPoints.get(driver.id) || 0) + pts);
          tPoints.set(driver.teamId, (tPoints.get(driver.teamId) || 0) + pts);
        });
      }

      const raceOrder = sampleRanking(drivers, weights, rng);
      raceOrder.forEach((driver, index) => {
        const position = index + 1;
        const pts = DRIVER_GP_POINTS[index] || 0;
        dPoints.set(driver.id, (dPoints.get(driver.id) || 0) + pts);
        tPoints.set(driver.teamId, (tPoints.get(driver.teamId) || 0) + pts);
        const dc = dCounts.get(driver.id);
        if (dc) dc[position] = (dc[position] || 0) + 1;
        const tc = tCounts.get(driver.teamId);
        if (tc) tc[position] = (tc[position] || 0) + 1;
      });

      if (!clinchedAt) {
        const after = state.remainingMeetings.slice(meetingIndex + 1);
        const sprintAfter = after.filter((m) => m.is_sprint).length;
        if (state.mode === 'drivers') {
          const rem = after.length * DRIVER_GP_POINTS[0] + sprintAfter * DRIVER_SPRINT_POINTS[0];
          if (conservativeClinched(selected.id, dPoints, drivers, rem)) clinchedAt = meeting.meeting_name;
        } else {
          const rem = after.length * TEAM_GP_MAX + sprintAfter * TEAM_SPRINT_MAX;
          if (conservativeClinched(selected.id, tPoints, teams, rem)) clinchedAt = meeting.meeting_name;
        }
      }
    });

    const driverWinner = [...drivers].sort((a, b) => {
      const diff = (dPoints.get(b.id) || 0) - (dPoints.get(a.id) || 0);
      return diff || compareSimCountback(a.id, b.id, dCounts, driverStandingMap);
    })[0];
    if (driverWinner) driverChampions.set(driverWinner.id, (driverChampions.get(driverWinner.id) || 0) + 1);

    const teamWinner = [...teams].sort((a, b) => {
      const diff = (tPoints.get(b.id) || 0) - (tPoints.get(a.id) || 0);
      return diff || compareSimCountback(a.id, b.id, tCounts, teamStandingMap);
    })[0];
    if (teamWinner) teamChampions.set(teamWinner.id, (teamChampions.get(teamWinner.id) || 0) + 1);

    const selectedWon = state.mode === 'drivers' ? driverWinner?.id === selected.id : teamWinner?.id === selected.id;
    if (selectedWon) {
      const label = clinchedAt || state.remainingMeetings.at(-1)?.meeting_name || 'Final round';
      selectedClinch.set(label, (selectedClinch.get(label) || 0) + 1);
    }
  }

  const relevant = state.mode === 'drivers' ? driverChampions : teamChampions;
  const selectedProbability = (relevant.get(selected.id) || 0) / SIMULATIONS * 100;
  const projectedClinch = [...selectedClinch.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || (selectedProbability < .1 ? '가능성 낮음' : '최종전');
  return { driverProb: driverChampions, constructorProb: teamChampions, selectedProbability, projectedClinch };
}

function formatProbability(value) {
  if (value <= 0) return '0%';
  if (value < .1) return '<0.1%';
  if (value >= 99.95) return '100%';
  return `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

function renderForecast(forecast) {
  const selected = selectedEntity();
  if (!selected) return;
  els.simulationCount.textContent = `${SIMULATIONS.toLocaleString()}x`;
  els.titleProbability.textContent = formatProbability(forecast.selectedProbability || 0);
  els.projectedClinch.textContent = forecast.projectedClinch || '—';
  els.probabilityList.replaceChildren();

  const probabilities = state.mode === 'drivers' ? forecast.driverProb : forecast.constructorProb;
  const entities = currentEntities();
  const rows = entities.map((entity) => ({ entity, probability: (probabilities.get(entity.id) || 0) / SIMULATIONS * 100 }))
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 6);

  rows.forEach(({ entity, probability }) => {
    const div = document.createElement('div');
    div.className = 'probability-row';
    div.innerHTML = `
      <div class="probability-copy">
        <div class="name-line"><span>${escapeHtml(entity.name)}</span></div>
        <div class="probability-bar"><i style="width:${Math.max(.5, probability)}%"></i></div>
      </div>
      <div class="probability-value">${formatProbability(probability)}</div>`;
    els.probabilityList.append(div);
  });

  els.forecastMethod.textContent = `${SIMULATIONS.toLocaleString()}회 시뮬레이션 · 시즌 누적 성적 65% + 최근 5개 GP 폼 35% · 남은 ${state.remainingMeetings.length} GP / Sprint ${state.remainingSprints}회 반영. 공식 확률이나 베팅 지표가 아닙니다.`;
}

function scheduleForecast() {
  const token = ++state.forecastToken;
  els.titleProbability.textContent = '…';
  els.projectedClinch.textContent = '계산 중';
  els.simulationCount.textContent = `${SIMULATIONS.toLocaleString()}x`;
  els.probabilityList.innerHTML = '<div class="info-box">남은 시즌을 시뮬레이션하는 중…</div>';
  setTimeout(() => {
    if (token !== state.forecastToken) return;
    const forecast = runForecast();
    if (token !== state.forecastToken) return;
    renderForecast(forecast);
  }, 20);
}

async function loadData() {
  state.year = Number(els.seasonSelect.value || 2026);
  els.refreshBtn.disabled = true;
  setStatus('Jolpica 챔피언십·countback 데이터 확인 중…');
  state.forecastToken += 1;

  try {
    const [driversData, constructorsData, scheduleData] = await Promise.all([
      jolpica('standings', state.year),
      jolpica('constructors', state.year),
      jolpica('schedule', state.year)
    ]);
    const [raceResult, qualiResult] = await Promise.allSettled([
      jolpica('results_all', state.year),
      jolpica('qualifying_all', state.year)
    ]);

    const drivers = normalizeDriverStandings(driversData);
    const constructors = normalizeConstructorStandings(constructorsData);
    state.latestRound = Math.max(drivers.round, constructors.round);
    const schedule = normalizeSchedule(scheduleData, state.latestRound);

    state.source = 'Jolpica';
    state.provisional = drivers.provisional || constructors.provisional || (raceResult.status === 'fulfilled' && Boolean(raceResult.value?.MRData?.provisional?.applied));
    state.driverEntities = drivers.entities;
    state.constructorEntities = constructors.entities;
    state.driverMeta = drivers.meta;
    state.constructorMeta = constructors.meta;
    state.raceHistory = raceResult.status === 'fulfilled' ? normalizeRaceHistory(raceResult.value) : [];
    state.qualifyingHistory = qualiResult.status === 'fulfilled' ? normalizeQualifyingHistory(qualiResult.value) : [];
    state.latestMeeting = schedule.latest;
    state.remainingMeetings = schedule.remaining;
    state.remainingSprints = schedule.remaining.filter((meeting) => meeting.is_sprint).length;

    populateEntitySelect();
    renderCore();
    const partial = raceResult.status === 'rejected' || qualiResult.status === 'rejected';
    setStatus(`${state.source} 동기화 완료 · Drivers ${state.driverEntities.length} · Constructors ${state.constructorEntities.length}${state.provisional ? ' · 최신 GP 임시 보정' : ''}${partial ? ' · 일부 countback 보조 데이터 지연' : ''}`, partial ? 'warn' : 'ok');
    els.updatedAt.textContent = `Last updated ${new Date().toLocaleString('ko-KR')}`;
  } catch (error) {
    console.error(error);
    setStatus(`데이터 오류: ${error.message}`, 'error');
    els.magicText.textContent = '공개 데이터 소스 갱신 상태를 확인해 주세요.';
    els.countbackSummary.textContent = 'countback 데이터를 불러오지 못했습니다.';
  } finally {
    els.refreshBtn.disabled = false;
  }
}

els.modeButtons.forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.mode === state.mode) return;
  state.mode = button.dataset.mode;
  state.selectedId = null;
  populateEntitySelect();
  renderCore();
}));
els.entitySelect.addEventListener('change', () => {
  state.selectedId = els.entitySelect.value;
  renderCore();
});
els.refreshBtn.addEventListener('click', loadData);
els.seasonSelect.addEventListener('change', loadData);

loadData();
