const GP_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const KNOWN_2026_SPRINT_LOCATIONS = ['shanghai', 'miami', 'montreal', 'montréal', 'silverstone', 'zandvoort', 'singapore'];

const els = {
  seasonSelect: document.querySelector('#seasonSelect'),
  driverSelect: document.querySelector('#driverSelect'),
  refreshBtn: document.querySelector('#refreshBtn'),
  dataStatus: document.querySelector('#dataStatus'),
  magicNumber: document.querySelector('#magicNumber'),
  magicText: document.querySelector('#magicText'),
  magicProgress: document.querySelector('#magicProgress'),
  driverBadge: document.querySelector('#driverBadge'),
  driverName: document.querySelector('#driverName'),
  driverTeam: document.querySelector('#driverTeam'),
  driverPoints: document.querySelector('#driverPoints'),
  driverPosition: document.querySelector('#driverPosition'),
  gapToNext: document.querySelector('#gapToNext'),
  remainingMax: document.querySelector('#remainingMax'),
  remainingGp: document.querySelector('#remainingGp'),
  remainingSprint: document.querySelector('#remainingSprint'),
  latestRound: document.querySelector('#latestRound'),
  rivalsBody: document.querySelector('#rivalsBody'),
  nextRoundTitle: document.querySelector('#nextRoundTitle'),
  clinchSummary: document.querySelector('#clinchSummary'),
  scenarioList: document.querySelector('#scenarioList'),
  updatedAt: document.querySelector('#updatedAt')
};

let state = {
  year: 2026,
  standings: [],
  driverMeta: new Map(),
  latestRace: null,
  latestMeeting: null,
  remainingMeetings: [],
  remainingSprints: 0,
  nextRoundSprint: false,
  selectedNumber: null
};

async function api(endpoint, params = {}) {
  const url = new URL('/api/openf1', window.location.origin);
  url.searchParams.set('endpoint', endpoint);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, { cache: 'no-store' });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!response.ok) {
    const message = data?.detail || data?.error || `HTTP ${response.status}`;
    throw new Error(message);
  }
  if (!Array.isArray(data)) throw new Error(`Unexpected ${endpoint} response`);
  return data;
}

function dateValue(value) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

function setStatus(message, kind = '') {
  els.dataStatus.textContent = message;
  els.dataStatus.className = `status ${kind}`.trim();
}

function isSprintMeeting(meeting, sessions) {
  const fromApi = sessions.some((session) => session.meeting_key === meeting.meeting_key && String(session.session_name).toLowerCase() === 'sprint');
  if (fromApi) return true;
  if (state.year !== 2026) return false;
  const haystack = `${meeting.meeting_name || ''} ${meeting.location || ''} ${meeting.country_name || ''}`.toLowerCase();
  return KNOWN_2026_SPRINT_LOCATIONS.some((name) => haystack.includes(name));
}

function formatGap(value) {
  if (value === 0) return 'TIED';
  return value > 0 ? `+${value}` : `${value}`;
}

function driverLabel(driver) {
  const meta = state.driverMeta.get(driver.driver_number);
  return meta?.full_name || meta?.broadcast_name || `Driver #${driver.driver_number}`;
}

function acronym(driver) {
  return state.driverMeta.get(driver.driver_number)?.name_acronym || String(driver.driver_number);
}

function teamName(driver) {
  return state.driverMeta.get(driver.driver_number)?.team_name || '—';
}

function teamColor(driver) {
  const raw = state.driverMeta.get(driver.driver_number)?.team_colour;
  return raw && /^[0-9a-f]{6}$/i.test(raw) ? `#${raw}` : '#ff365e';
}

function getSelected() {
  return state.standings.find((d) => String(d.driver_number) === String(state.selectedNumber)) || state.standings[0];
}

function getRemainingMax() {
  return state.remainingMeetings.length * GP_POINTS[0] + state.remainingSprints * SPRINT_POINTS[0];
}

function magicAgainst(candidate, rival, remainingMax) {
  const gap = Number(candidate.points_current) - Number(rival.points_current);
  return Math.max(0, remainingMax - gap + 1);
}

function strongestRival(candidate, remainingMax) {
  return state.standings
    .filter((r) => r.driver_number !== candidate.driver_number)
    .map((r) => ({ rival: r, magic: magicAgainst(candidate, r, remainingMax) }))
    .sort((a, b) => b.magic - a.magic || Number(b.rival.points_current) - Number(a.rival.points_current))[0];
}

function populateDriverSelect() {
  const current = state.selectedNumber;
  els.driverSelect.replaceChildren();
  for (const row of state.standings) {
    const option = document.createElement('option');
    option.value = row.driver_number;
    option.textContent = `P${row.position_current} · ${driverLabel(row)} · ${row.points_current} pts`;
    els.driverSelect.append(option);
  }
  const preferred = state.standings.some((d) => String(d.driver_number) === String(current)) ? current : state.standings[0]?.driver_number;
  state.selectedNumber = preferred;
  els.driverSelect.value = preferred ?? '';
}

function renderRivals(candidate, remainingMax) {
  els.rivalsBody.replaceChildren();
  for (const rival of state.standings) {
    const tr = document.createElement('tr');
    const isSelected = rival.driver_number === candidate.driver_number;
    const magic = isSelected ? null : magicAgainst(candidate, rival, remainingMax);
    if (!isSelected && magic === 0) tr.classList.add('eliminated');
    const gap = Number(candidate.points_current) - Number(rival.points_current);
    const maxFinal = Number(rival.points_current) + remainingMax;

    tr.innerHTML = `
      <td>P${rival.position_current}</td>
      <td class="driver-cell"><strong>${escapeHtml(driverLabel(rival))}</strong><span>${escapeHtml(teamName(rival))}</span></td>
      <td>${rival.points_current}</td>
      <td>${isSelected ? '—' : formatGap(gap)}</td>
      <td>${isSelected ? Number(candidate.points_current) + remainingMax : maxFinal}</td>
      <td>${isSelected ? '—' : `<span class="magic-pill">${magic}</span>`}</td>
      <td>${isSelected ? '<span class="status-pill leader">SELECTED</span>' : magic === 0 ? '<span class="status-pill out">ELIMINATED</span>' : '<span class="status-pill alive">ALIVE</span>'}</td>
    `;
    els.rivalsBody.append(tr);
  }
}

function renderScenarios(candidate, overallMagic, rival, remainingMax) {
  els.scenarioList.replaceChildren();
  const next = state.remainingMeetings[0];
  if (!next) {
    els.nextRoundTitle.textContent = '시즌 종료';
    els.clinchSummary.textContent = overallMagic === 0 ? '챔피언십 계산이 종료되었습니다.' : '남은 라운드가 없습니다. 최종 공식 순위를 확인하세요.';
    return;
  }

  const nextName = next.meeting_name || next.country_name || 'Next Grand Prix';
  els.nextRoundTitle.textContent = `${nextName} 확정 시나리오`;
  const eventMax = GP_POINTS[0] + (state.nextRoundSprint ? SPRINT_POINTS[0] : 0);
  const maxPossibleReduction = eventMax * 2;

  if (overallMagic === 0) {
    els.clinchSummary.textContent = `${driverLabel(candidate)}는 수학적으로 모든 경쟁자를 이미 제거한 상태입니다.`;
    return;
  }

  if (overallMagic > maxPossibleReduction) {
    els.clinchSummary.textContent = `다음 라운드에서 한 번에 줄일 수 있는 최대 매직넘버는 ${maxPossibleReduction}입니다. 현재 ${overallMagic}이므로 이 라운드에서는 아직 챔피언 확정이 불가능합니다.`;
  } else {
    els.clinchSummary.textContent = `${driverLabel(candidate)}는 다음 라운드에서 챔피언 확정이 가능합니다. 가장 위험한 경쟁자는 ${driverLabel(rival)}입니다.`;
  }

  const candidateTotals = state.nextRoundSprint
    ? [33, 30, 28, 25, 22, 20, 18]
    : GP_POINTS.map((pts, index) => ({ label: `P${index + 1}`, pts })).slice(0, 8);

  if (state.nextRoundSprint) {
    for (const total of candidateTotals) {
      const allowed = eventMax + total - overallMagic;
      const div = document.createElement('div');
      div.className = 'scenario';
      div.innerHTML = `<strong>주말 합계 ${total}점</strong><span>${allowed < 0 ? '이 경우 확정 불가' : `${escapeHtml(driverLabel(rival))} 주말 ${Math.min(eventMax, allowed)}점 이하 필요`}</span>`;
      els.scenarioList.append(div);
    }
  } else {
    for (const item of candidateTotals) {
      const allowed = eventMax + item.pts - overallMagic;
      const div = document.createElement('div');
      div.className = 'scenario';
      div.innerHTML = `<strong>${item.label} · ${item.pts}점</strong><span>${allowed < 0 ? '이 경우 확정 불가' : allowed >= 25 ? `${escapeHtml(driverLabel(rival))} 결과와 무관` : `${escapeHtml(driverLabel(rival))} ${rivalResultText(allowed)}`}</span>`;
      els.scenarioList.append(div);
    }
  }
}

function rivalResultText(maxPoints) {
  if (maxPoints < 0) return '확정 불가';
  if (maxPoints >= 25) return '결과와 무관';
  for (let i = 0; i < GP_POINTS.length; i += 1) {
    if (GP_POINTS[i] <= maxPoints) return `P${i + 1} 이하 (${GP_POINTS[i]}점 이하)`;
  }
  return 'P11 이하 (0점)';
}

function render() {
  const candidate = getSelected();
  if (!candidate) return;

  const remainingMax = getRemainingMax();
  const strongest = strongestRival(candidate, remainingMax);
  const overallMagic = strongest?.magic ?? 0;
  const gap = strongest ? Number(candidate.points_current) - Number(strongest.rival.points_current) : 0;

  els.magicNumber.textContent = overallMagic;
  els.magicText.textContent = strongest
    ? overallMagic === 0
      ? `${driverLabel(candidate)}는 ${driverLabel(strongest.rival)}를 포함한 모든 경쟁자를 수학적으로 제거했습니다.`
      : `${driverLabel(strongest.rival)} 기준. 현재 격차 ${formatGap(gap)}점, 경쟁자가 얻을 수 있는 남은 최대점 ${remainingMax}점.`
    : '경쟁자가 없습니다.';

  const progressBase = Math.max(1, remainingMax + 1);
  const progress = Number(candidate.position_current) === 1 ? Math.max(0, Math.min(100, 100 - (overallMagic / progressBase) * 100)) : 0;
  els.magicProgress.style.width = `${progress}%`;

  els.driverBadge.textContent = acronym(candidate);
  els.driverBadge.style.background = `linear-gradient(135deg, ${teamColor(candidate)}, #31384a)`;
  els.driverName.textContent = driverLabel(candidate);
  els.driverTeam.textContent = teamName(candidate);
  els.driverPoints.textContent = candidate.points_current;
  els.driverPosition.textContent = `P${candidate.position_current}`;
  els.gapToNext.textContent = strongest ? formatGap(gap) : '—';

  els.remainingMax.textContent = remainingMax;
  els.remainingGp.textContent = state.remainingMeetings.length;
  els.remainingSprint.textContent = state.remainingSprints;
  const latestName = state.latestMeeting?.meeting_name || state.latestRace?.country_name || 'Latest race';
  els.latestRound.textContent = `최신 완료 기준: ${latestName} · GP 25점 / Sprint 8점 최대`;

  renderRivals(candidate, remainingMax);
  if (strongest) renderScenarios(candidate, overallMagic, strongest.rival, remainingMax);
}

async function loadData() {
  const year = Number(els.seasonSelect.value || 2026);
  state.year = year;
  els.refreshBtn.disabled = true;
  setStatus('OpenF1 최신 챔피언십 확인 중…');

  try {
    const [sessions, meetings] = await Promise.all([
      api('sessions', { year }),
      api('meetings', { year })
    ]);

    const now = Date.now();
    const races = sessions
      .filter((s) => String(s.session_name).toLowerCase() === 'race')
      .sort((a, b) => dateValue(a.date_start) - dateValue(b.date_start));

    let latestRace = [...races].reverse().find((race) => dateValue(race.date_end || race.date_start) <= now);
    if (!latestRace) latestRace = [...races].reverse().find((race) => dateValue(race.date_start) <= now) || races.at(-1);
    if (!latestRace) throw new Error(`${year} Race session을 찾지 못했습니다.`);

    const [championship, drivers] = await Promise.all([
      api('championship_drivers', { session_key: latestRace.session_key }),
      api('drivers', { session_key: latestRace.session_key })
    ]);
    if (!championship.length) throw new Error('드라이버 챔피언십 데이터가 아직 공개되지 않았습니다.');

    state.latestRace = latestRace;
    state.standings = championship
      .filter((d) => Number.isFinite(Number(d.points_current)) && Number.isFinite(Number(d.position_current)))
      .sort((a, b) => Number(a.position_current) - Number(b.position_current));
    state.driverMeta = new Map(drivers.map((d) => [d.driver_number, d]));

    const orderedMeetings = meetings
      .filter((m) => !/test/i.test(`${m.meeting_name || ''} ${m.meeting_official_name || ''}`))
      .sort((a, b) => dateValue(a.date_start) - dateValue(b.date_start));
    state.latestMeeting = orderedMeetings.find((m) => m.meeting_key === latestRace.meeting_key)
      || [...orderedMeetings].reverse().find((m) => dateValue(m.date_start) <= dateValue(latestRace.date_start));

    const latestMeetingDate = dateValue(state.latestMeeting?.date_start || latestRace.date_start);
    state.remainingMeetings = orderedMeetings.filter((m) => dateValue(m.date_start) > latestMeetingDate);
    state.remainingSprints = state.remainingMeetings.filter((meeting) => isSprintMeeting(meeting, sessions)).length;
    state.nextRoundSprint = Boolean(state.remainingMeetings[0] && isSprintMeeting(state.remainingMeetings[0], sessions));

    populateDriverSelect();
    render();
    const stamp = new Date();
    els.updatedAt.textContent = `Last updated ${stamp.toLocaleString('ko-KR')}`;
    setStatus(`OpenF1 동기화 완료 · ${state.standings.length} drivers`, 'ok');
  } catch (error) {
    console.error(error);
    setStatus(`데이터 오류: ${error.message}`, 'error');
    els.magicText.textContent = 'OpenF1 데이터가 갱신되는 동안 잠시 최신 계산이 불가능할 수 있습니다.';
  } finally {
    els.refreshBtn.disabled = false;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

els.driverSelect.addEventListener('change', () => {
  state.selectedNumber = Number(els.driverSelect.value);
  render();
});
els.refreshBtn.addEventListener('click', loadData);
els.seasonSelect.addEventListener('change', loadData);

loadData();
