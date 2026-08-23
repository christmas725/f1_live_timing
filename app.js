(() => {
  'use strict';

  const API_BASE = 'https://api.openf1.org/v1';
  const ENDPOINTS = ['drivers', 'position', 'intervals', 'laps', 'stints', 'pit', 'race_control', 'weather', 'starting_grid'];

  const el = Object.fromEntries([
    'eventTitle','trackStatusDot','trackStatus','sessionClock','yearSelect','sessionSelect','speedSelect','loadButton',
    'sessionName','currentLap','totalLaps','replayTime','dataSource','playButton','timeline','restartButton','notice',
    'circuitName','timingBody','raceControl','messageCount','airTemp','trackTemp','windSpeed','rainfall','humidity','pressure'
  ].map(id => [id, document.getElementById(id)]));

  const app = {
    sessions: [],
    selectedSession: null,
    drivers: [],
    raw: null,
    events: null,
    state: null,
    cursors: null,
    replayStart: 0,
    replayEnd: 0,
    playhead: 0,
    playing: false,
    lastFrameAt: 0,
    raf: 0,
    renderAt: 0,
    speed: 30,
    source: 'OPENF1'
  };

  function setNotice(message = '', kind = 'info') {
    el.notice.textContent = message;
    el.notice.className = `notice${message ? ' visible' : ''} ${kind}`;
  }

  function formatDateLabel(iso) {
    try {
      return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' }).format(new Date(iso));
    } catch { return ''; }
  }

  function formatClock(ms) {
    if (!Number.isFinite(ms)) return '--:--:--';
    const d = new Date(ms);
    return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
  }

  function formatElapsed(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  }

  function formatLapTime(value) {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) return '—';
    const min = Math.floor(v / 60);
    const sec = v - min * 60;
    return `${min}:${sec.toFixed(3).padStart(6, '0')}`;
  }

  function formatGap(value, leader = false) {
    if (leader) return 'LEADER';
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string') return value.startsWith('+') ? value : `+${value}`;
    const v = Number(value);
    return Number.isFinite(v) ? `+${v.toFixed(3)}` : '—';
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  async function apiError(response, label) {
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch { body = null; }
    const detail = String(body?.detail || body?.error || text || `${label} ${response.status}`);
    const error = new Error(`${label} ${response.status}: ${detail}`);
    error.status = response.status;
    error.detail = detail;
    if (/live f1 session in progress|restricted to authenticated users|live session/i.test(detail)) {
      error.code = 'OPENF1_LIVE_LOCK';
    }
    return error;
  }

  async function apiFetch(endpoint, params = {}) {
    const cleanParams = Object.fromEntries(Object.entries(params).filter(([,v]) => v !== undefined && v !== null));
    const qs = new URLSearchParams({ endpoint, ...cleanParams });
    const proxyUrl = `/api/openf1?${qs.toString()}`;

    try {
      const response = await fetch(proxyUrl, { headers: { Accept: 'application/json' } });
      if (response.ok) return await response.json();
      const error = await apiError(response, 'Proxy');
      if (error.code === 'OPENF1_LIVE_LOCK') throw error;
      if (![404, 405].includes(response.status)) throw error;
    } catch (error) {
      if (error?.code === 'OPENF1_LIVE_LOCK') throw error;
      console.warn('Proxy unavailable; trying OpenF1 directly.', error);
    }

    const directQs = new URLSearchParams(cleanParams);
    const response = await fetch(`${API_BASE}/${endpoint}?${directQs.toString()}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw await apiError(response, `OpenF1 ${endpoint}`);
    return response.json();
  }

  async function safeFetch(endpoint, sessionKey) {
    try { return await apiFetch(endpoint, { session_key: sessionKey }); }
    catch (error) {
      console.warn(`${endpoint} unavailable`, error);
      return [];
    }
  }

  function populateYears() {
    const currentYear = new Date().getUTCFullYear();
    const maxYear = Math.max(2023, currentYear);
    el.yearSelect.innerHTML = '';
    for (let year = maxYear; year >= 2023; year--) {
      const opt = document.createElement('option');
      opt.value = String(year);
      opt.textContent = String(year);
      el.yearSelect.appendChild(opt);
    }
  }

  function renderSessionOptions(sessions) {
    el.sessionSelect.innerHTML = '';
    for (const s of sessions) {
      const opt = document.createElement('option');
      opt.value = String(s.session_key);
      if (s.source_type === 'LOCAL_CACHE') {
        opt.textContent = '2025 Abu Dhabi GP · Local Cache (Laps 1–7)';
      } else if (s.source_type === 'DEMO') {
        opt.textContent = '2025 Demo Grand Prix · Offline Replay';
      } else {
        opt.textContent = `${formatDateLabel(s.date_start)} · ${s.country_name || s.location} · ${s.circuit_short_name || s.location}`;
      }
      el.sessionSelect.appendChild(opt);
    }
  }

  async function loadSessions(year = Number(el.yearSelect.value)) {
    stopPlayback();
    el.sessionSelect.disabled = true;
    el.loadButton.disabled = true;
    el.sessionSelect.innerHTML = '<option>세션 목록 불러오는 중…</option>';
    setNotice(`${year} 시즌의 완료된 Race 세션을 찾고 있어요.`, 'info');

    try {
      const sessions = await apiFetch('sessions', { year, session_name: 'Race' });
      const now = Date.now();
      const historical = sessions
        .filter(s => !s.is_cancelled && new Date(s.date_end || s.date_start).getTime() < now)
        .sort((a, b) => new Date(b.date_start) - new Date(a.date_start));

      if (!historical.length) throw new Error('완료된 Race 세션이 없습니다.');

      app.sessions = [...historical, makeLocalSession(), makeDemoSession()];
      app.selectedSession = app.sessions[0];
      renderSessionOptions(app.sessions);
      setNotice(`${year} 시즌 Race ${historical.length}개를 찾았어요. 실제 OpenF1 기록 또는 오프라인 Local Cache를 선택할 수 있습니다.`, 'ok');
    } catch (error) {
      console.error(error);
      app.sessions = [makeLocalSession(), makeDemoSession()];
      app.selectedSession = app.sessions[0];
      renderSessionOptions(app.sessions);
      if (error?.code === 'OPENF1_LIVE_LOCK') {
        setNotice('OpenF1 LIVE SESSION LOCK · 현재 F1 라이브 세션으로 비인증 API가 일시 제한되어 있어요. 2025 Abu Dhabi GP 실제 기록 Local Cache(1–7랩)를 우선 사용할 수 있습니다. 세션 종료 후 시즌을 다시 선택하면 Historical Replay가 복구됩니다.', 'locked');
      } else {
        setNotice('OpenF1을 사용할 수 없어 Local Cache로 전환했어요. Local Cache까지 불러오지 못할 경우 Demo Replay가 마지막 fallback으로 동작합니다.', 'info');
      }
    } finally {
      el.sessionSelect.disabled = false;
      el.loadButton.disabled = false;
    }
  }

  function makeLocalSession() {
    return {
      session_key: 'local-2025-abu-dhabi-l1-7', meeting_key: 'local-2025-abu-dhabi', year: 2025,
      country_name: 'Abu Dhabi', location: 'Yas Marina', circuit_short_name: 'Yas Marina Circuit',
      session_name: 'Race · Laps 1–7', session_type: 'Race', source_type: 'LOCAL_CACHE',
      local_data_url: './data/local-2025-abu-dhabi-l1-7.json',
      date_start: '2025-12-07T13:00:00Z', date_end: '2025-12-07T13:12:00Z'
    };
  }

  async function localReplayData(session) {
    const response = await fetch(session.local_data_url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Local cache ${response.status}`);
    const data = await response.json();
    if (!data?.drivers?.length || !data?.laps?.length) throw new Error('Local cache is incomplete.');
    return data;
  }

  function makeDemoSession() {
    return {
      session_key: 'demo', meeting_key: 'demo', year: 2025,
      country_name: 'Demo', location: 'Timing Lab', circuit_short_name: 'Timing Lab',
      session_name: 'Race', session_type: 'Race', source_type: 'DEMO',
      date_start: '2025-01-01T12:00:00Z', date_end: '2025-01-01T13:25:00Z'
    };
  }

  function demoData() {
    const names = [
      [4,'NOR','Lando Norris','McLaren','FF8700'],[81,'PIA','Oscar Piastri','McLaren','FF8700'],
      [1,'VER','Max Verstappen','Red Bull Racing','3671C6'],[63,'RUS','George Russell','Mercedes','27F4D2'],
      [16,'LEC','Charles Leclerc','Ferrari','E8002D'],[44,'HAM','Lewis Hamilton','Ferrari','E8002D'],
      [12,'ANT','Kimi Antonelli','Mercedes','27F4D2'],[55,'SAI','Carlos Sainz','Williams','64C4FF'],
      [23,'ALB','Alexander Albon','Williams','64C4FF'],[14,'ALO','Fernando Alonso','Aston Martin','229971'],
      [18,'STR','Lance Stroll','Aston Martin','229971'],[10,'GAS','Pierre Gasly','Alpine','FF87BC'],
      [31,'OCO','Esteban Ocon','Haas F1 Team','B6BABD'],[87,'BEA','Oliver Bearman','Haas F1 Team','B6BABD'],
      [30,'LAW','Liam Lawson','Racing Bulls','6692FF'],[22,'TSU','Yuki Tsunoda','Red Bull Racing','3671C6'],
      [6,'HAD','Isack Hadjar','Racing Bulls','6692FF'],[27,'HUL','Nico Hulkenberg','Kick Sauber','52E252'],
      [5,'BOR','Gabriel Bortoleto','Kick Sauber','52E252'],[43,'COL','Franco Colapinto','Alpine','FF87BC']
    ];
    const drivers = names.map(([driver_number,name_acronym,full_name,team_name,team_colour]) => ({ driver_number,name_acronym,full_name,team_name,team_colour }));
    const start = new Date('2025-01-01T12:00:00Z').getTime();
    const totalLaps = 57;
    const position = [], intervals = [], laps = [], race_control = [], weather = [], pit = [], stints = [], starting_grid = [];

    names.forEach((driver, index) => {
      starting_grid.push({ driver_number: driver[0], position: index + 1 });
      const firstCompound = index % 3 === 0 ? 'SOFT' : index % 3 === 1 ? 'MEDIUM' : 'HARD';
      const secondCompound = firstCompound === 'HARD' ? 'MEDIUM' : 'HARD';
      stints.push({ driver_number: driver[0], stint_number: 1, lap_start: 1, lap_end: 25 + (index % 7), compound: firstCompound, tyre_age_at_start: 0 });
      stints.push({ driver_number: driver[0], stint_number: 2, lap_start: 26 + (index % 7), lap_end: totalLaps, compound: secondCompound, tyre_age_at_start: 0 });
    });

    for (let lap = 1; lap <= totalLaps; lap++) {
      names.forEach((driver, index) => {
        const base = 88.0 + index * .12;
        const lapTime = base + Math.sin(lap * .43 + index) * .7 + (lap < 3 ? 2.2 : 0) + (lap > 45 ? -0.6 : 0);
        const lapStart = start + (lap - 1) * 90000 + index * 120;
        laps.push({ date_start: new Date(lapStart).toISOString(), driver_number: driver[0], lap_number: lap, lap_duration: lapTime, duration_sector_1: lapTime*.29, duration_sector_2: lapTime*.42, duration_sector_3: lapTime*.29, is_pit_out_lap: lap === 27 + (index % 7) });
        if (lap % 2 === 0 || lap === 1) {
          const posShift = (lap > 18 && index < 6) ? Math.round(Math.sin(lap/5 + index) * 1.2) : 0;
          const pos = clamp(index + 1 + posShift, 1, names.length);
          position.push({ date: new Date(lapStart + lapTime*1000).toISOString(), driver_number: driver[0], position: pos });
          intervals.push({ date: new Date(lapStart + lapTime*1000 + 800).toISOString(), driver_number: driver[0], gap_to_leader: index === 0 ? null : index * 2.2 + lap * .08, interval: index === 0 ? null : 1.4 + (index % 4)*.45 });
        }
      });
    }

    names.forEach((driver, index) => {
      const pitLap = 25 + (index % 7);
      pit.push({ date: new Date(start + pitLap*90000 + index*120).toISOString(), driver_number: driver[0], lap_number: pitLap, lane_duration: 21.5 + (index%5)*.4, stop_duration: 2.2 + (index%4)*.2 });
    });

    race_control.push(
      { date: new Date(start + 1000).toISOString(), lap_number: 1, category:'SessionStatus', scope:'Track', flag:'GREEN', message:'RACE STARTED - TRACK CLEAR' },
      { date: new Date(start + 19*90000).toISOString(), lap_number: 19, category:'Flag', scope:'Sector', flag:'YELLOW', message:'YELLOW FLAG IN SECTOR 2' },
      { date: new Date(start + 20*90000).toISOString(), lap_number: 20, category:'Flag', scope:'Track', flag:'GREEN', message:'TRACK CLEAR' },
      { date: new Date(start + 38*90000).toISOString(), lap_number: 38, category:'SafetyCar', scope:'Track', flag:null, message:'VIRTUAL SAFETY CAR DEPLOYED' },
      { date: new Date(start + 40*90000).toISOString(), lap_number: 40, category:'SafetyCar', scope:'Track', flag:'GREEN', message:'VIRTUAL SAFETY CAR ENDING - TRACK CLEAR' },
      { date: new Date(start + 57*90000).toISOString(), lap_number: 57, category:'Flag', scope:'Track', flag:'CHEQUERED', message:'CHEQUERED FLAG' }
    );

    for (let m = 0; m <= 85; m += 5) {
      weather.push({ date: new Date(start + m*60000).toISOString(), air_temperature: 24.2 + Math.sin(m/20)*.7, track_temperature: 36.5 - m*.035, wind_speed: 2.4 + Math.sin(m/9)*.5, rainfall: 0, humidity: 51 + Math.round(Math.sin(m/15)*4), pressure: 1012.5 });
    }

    return { drivers, position, intervals, laps, race_control, weather, pit, stints, starting_grid };
  }

  async function loadSelectedSession() {
    const key = el.sessionSelect.value;
    app.selectedSession = app.sessions.find(s => String(s.session_key) === String(key)) || app.sessions[0];
    stopPlayback();
    el.loadButton.disabled = true;
    el.timingBody.innerHTML = '<tr class="loading-row"><td colspan="10">Timing data loading…</td></tr>';
    setNotice('Position · Interval · Lap · Tyre · Pit · Race Control · Weather 데이터를 불러오는 중이에요.', 'info');

    try {
      let data;
      if (app.selectedSession.source_type === 'DEMO' || String(app.selectedSession.session_key) === 'demo') {
        data = demoData();
        app.source = 'DEMO';
      } else if (app.selectedSession.source_type === 'LOCAL_CACHE') {
        data = await localReplayData(app.selectedSession);
        app.source = 'LOCAL CACHE';
      } else {
        const sessionKey = app.selectedSession.session_key;
        const results = await Promise.all(ENDPOINTS.map(endpoint => safeFetch(endpoint, sessionKey)));
        data = Object.fromEntries(ENDPOINTS.map((endpoint, i) => [endpoint, results[i]]));
        if (!data.drivers.length || (!data.position.length && !data.laps.length)) {
          throw new Error('핵심 타이밍 데이터가 비어 있습니다.');
        }
        app.source = 'OPENF1';
      }

      prepareReplay(data);
      renderAll(true);
      if (app.source === 'OPENF1') {
        setNotice('실제 OpenF1 기록을 불러왔어요. ▶ 버튼으로 Replay를 시작하면 됩니다.', 'ok');
      } else if (app.source === 'LOCAL CACHE') {
        setNotice('실제 2025 Abu Dhabi GP의 1–7랩 기록을 담은 Local Cache가 준비됐어요. Lap time · Position · Gap은 실제 기록이며, Interval은 인접 Gap으로 계산합니다. 이 소형 캐시에는 타이어 컴파운드·날씨·피트 데이터는 포함하지 않았어요.', 'ok');
      } else {
        setNotice('내장 Demo Replay가 준비됐어요. ▶ 버튼으로 UI 동작을 확인할 수 있습니다.', 'ok');
      }
    } catch (error) {
      console.error(error);
      if (app.selectedSession?.source_type !== 'LOCAL_CACHE' && app.selectedSession?.source_type !== 'DEMO') {
        try {
          const localSession = makeLocalSession();
          const localData = await localReplayData(localSession);
          app.selectedSession = localSession;
          app.source = 'LOCAL CACHE';
          prepareReplay(localData);
          renderAll(true);
          setNotice('선택한 OpenF1 기록을 불러오지 못해 실제 2025 Abu Dhabi GP 1–7랩 Local Cache로 전환했어요.', 'info');
          return;
        } catch (localError) {
          console.error('Local cache fallback failed', localError);
        }
      }
      app.selectedSession = makeDemoSession();
      app.source = 'DEMO';
      prepareReplay(demoData());
      renderAll(true);
      setNotice('Local Cache까지 불러오지 못해 마지막 fallback인 Demo Replay로 전환했어요.', 'info');
    } finally {
      el.loadButton.disabled = false;
    }
  }

  function timestamp(value) {
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
  }

  function prepareReplay(data) {
    app.raw = data;
    app.drivers = [...data.drivers].sort((a,b) => Number(a.driver_number) - Number(b.driver_number));

    const positions = (data.position || []).map(e => ({...e, t: timestamp(e.date)})).filter(e => e.t).sort((a,b) => a.t-b.t);
    const intervals = (data.intervals || []).map(e => ({...e, t: timestamp(e.date)})).filter(e => e.t).sort((a,b) => a.t-b.t);
    const laps = (data.laps || []).map(e => {
      const start = timestamp(e.date_start);
      const duration = Number(e.lap_duration);
      return {...e, t: start ? start + (Number.isFinite(duration) ? duration*1000 : 0) : null};
    }).filter(e => e.t).sort((a,b) => a.t-b.t);
    const raceControl = (data.race_control || []).map(e => ({...e, t: timestamp(e.date)})).filter(e => e.t).sort((a,b) => a.t-b.t);
    const weather = (data.weather || []).map(e => ({...e, t: timestamp(e.date)})).filter(e => e.t).sort((a,b) => a.t-b.t);
    const pit = (data.pit || []).map(e => ({...e, t: timestamp(e.date)})).filter(e => e.t).sort((a,b) => a.t-b.t);

    app.events = { positions, intervals, laps, raceControl, weather, pit };
    const candidates = [...positions, ...intervals, ...laps, ...raceControl, ...weather, ...pit].map(e => e.t).filter(Boolean);
    const sessionStart = timestamp(app.selectedSession?.date_start);
    const sessionEnd = timestamp(app.selectedSession?.date_end);
    app.replayStart = candidates.length ? Math.min(...candidates) : sessionStart || Date.now();
    app.replayEnd = candidates.length ? Math.max(...candidates) : sessionEnd || app.replayStart + 2*3600000;
    if (sessionStart && sessionStart < app.replayStart + 10*60000) app.replayStart = Math.min(app.replayStart, sessionStart);
    if (sessionEnd && sessionEnd > app.replayEnd && sessionEnd - app.replayEnd < 20*60000) app.replayEnd = sessionEnd;

    const maxLap = Math.max(0, ...(data.laps || []).map(l => Number(l.lap_number) || 0));
    el.totalLaps.textContent = maxLap || '--';
    el.timeline.value = '0';
    app.playhead = app.replayStart;
    resetReplayState();
    applyUntil(app.playhead);

    const s = app.selectedSession;
    el.eventTitle.textContent = `${s?.year || ''} ${s?.country_name || s?.location || 'Grand Prix'} · ${s?.session_name || 'Race'}`.trim();
    el.circuitName.textContent = s?.circuit_short_name || s?.location || 'Circuit';
    el.sessionName.textContent = (s?.session_name || 'Race').toUpperCase();
    el.dataSource.textContent = app.source;
  }

  function resetReplayState() {
    const grid = new Map((app.raw.starting_grid || []).map(g => [Number(g.driver_number), Number(g.position)]));
    app.state = {
      drivers: new Map(),
      raceControl: [],
      weather: null,
      trackStatus: { text: 'TRACK CLEAR', className: 'green' },
      globalBest: Infinity,
      currentLap: 0
    };
    for (const d of app.drivers) {
      const n = Number(d.driver_number);
      app.state.drivers.set(n, {
        meta: d,
        position: grid.get(n) || 99,
        gap: null,
        interval: null,
        lap: 0,
        last: null,
        best: Infinity,
        lastIsPersonalBest: false,
        pits: 0,
        pitOut: false
      });
    }
    app.cursors = { positions:0, intervals:0, laps:0, raceControl:0, weather:0, pit:0 };
  }

  function applyUntil(target) {
    for (const type of ['positions','intervals','laps','raceControl','weather','pit']) {
      const list = app.events[type];
      let i = app.cursors[type];
      while (i < list.length && list[i].t <= target) {
        applyEvent(type, list[i]);
        i++;
      }
      app.cursors[type] = i;
    }
  }

  function applyEvent(type, e) {
    const n = Number(e.driver_number);
    const d = app.state.drivers.get(n);
    if (type === 'positions' && d) {
      d.position = Number(e.position) || d.position;
    } else if (type === 'intervals' && d) {
      d.gap = e.gap_to_leader;
      d.interval = e.interval;
    } else if (type === 'laps' && d) {
      d.lap = Math.max(d.lap, Number(e.lap_number) || 0);
      app.state.currentLap = Math.max(app.state.currentLap, d.lap);
      const lapTime = Number(e.lap_duration);
      d.last = Number.isFinite(lapTime) && lapTime > 0 ? lapTime : null;
      d.pitOut = Boolean(e.is_pit_out_lap);
      d.lastIsPersonalBest = false;
      if (d.last && d.last < d.best) {
        d.best = d.last;
        d.lastIsPersonalBest = true;
        if (d.best < app.state.globalBest) app.state.globalBest = d.best;
      }
    } else if (type === 'raceControl') {
      app.state.raceControl.push(e);
      updateTrackStatus(e);
    } else if (type === 'weather') {
      app.state.weather = e;
    } else if (type === 'pit' && d) {
      d.pits += 1;
      d.pitOut = false;
    }
  }

  function updateTrackStatus(e) {
    const msg = String(e.message || '').toUpperCase();
    const flag = String(e.flag || '').toUpperCase();
    const scope = String(e.scope || '').toUpperCase();

    if (msg.includes('RED FLAG') || flag === 'RED') {
      app.state.trackStatus = { text: 'RED FLAG', className: 'red' };
    } else if (msg.includes('VIRTUAL SAFETY CAR') && !msg.includes('ENDING') && !msg.includes('END')) {
      app.state.trackStatus = { text: 'VIRTUAL SAFETY CAR', className: 'safety' };
    } else if (msg.includes('SAFETY CAR') && !msg.includes('ENDING') && !msg.includes('END')) {
      app.state.trackStatus = { text: 'SAFETY CAR', className: 'safety' };
    } else if (flag === 'CHEQUERED' || msg.includes('CHEQUERED')) {
      app.state.trackStatus = { text: 'CHEQUERED', className: 'chequered' };
    } else if ((flag.includes('YELLOW') || msg.includes('YELLOW FLAG')) && (scope === 'TRACK' || scope === '' || e.category === 'SafetyCar')) {
      app.state.trackStatus = { text: 'YELLOW', className: 'yellow' };
    } else if (flag === 'GREEN' || msg.includes('TRACK CLEAR') || msg.includes('RACE STARTED')) {
      app.state.trackStatus = { text: 'TRACK CLEAR', className: 'green' };
    }
  }

  function activeStint(driverNumber, lap) {
    const stints = (app.raw.stints || []).filter(s => Number(s.driver_number) === driverNumber);
    if (!stints.length) return null;
    let found = stints.find(s => lap >= Number(s.lap_start || 0) && lap <= Number(s.lap_end || Infinity));
    if (!found) found = [...stints].sort((a,b) => Number(b.lap_start)-Number(a.lap_start)).find(s => lap >= Number(s.lap_start || 0));
    return found || stints[0];
  }

  function tyreInfo(driverNumber, lap) {
    const stint = activeStint(driverNumber, lap);
    if (!stint) return { compound:'UNKNOWN', short:'?' , age:'—' };
    const compound = String(stint.compound || 'UNKNOWN').toUpperCase();
    const shortMap = { SOFT:'S', MEDIUM:'M', HARD:'H', INTERMEDIATE:'I', WET:'W' };
    const baseAge = Number(stint.tyre_age_at_start) || 0;
    const age = lap > 0 ? Math.max(0, baseAge + lap - Number(stint.lap_start || lap)) : baseAge;
    return { compound, short: shortMap[compound] || '?', age };
  }

  function renderTiming() {
    const drivers = [...app.state.drivers.values()].sort((a,b) => {
      if (a.position !== b.position) return a.position - b.position;
      return Number(a.meta.driver_number) - Number(b.meta.driver_number);
    });

    if (!drivers.length) {
      el.timingBody.innerHTML = '<tr class="loading-row"><td colspan="10">Driver data unavailable</td></tr>';
      return;
    }

    const globalBest = Math.min(...drivers.map(d => d.best).filter(Number.isFinite), Infinity);
    el.timingBody.innerHTML = drivers.map((d, index) => {
      const m = d.meta;
      const number = Number(m.driver_number);
      const pos = d.position < 90 ? d.position : index + 1;
      const tyre = tyreInfo(number, d.lap || app.state.currentLap);
      const lastClass = d.last && Math.abs(d.last - globalBest) < .0005 ? 'best-session' : (d.lastIsPersonalBest ? 'best-personal' : '');
      const bestClass = Number.isFinite(d.best) && Math.abs(d.best - globalBest) < .0005 ? 'best-session' : '';
      const teamColor = /^[0-9A-Fa-f]{6}$/.test(m.team_colour || '') ? `#${m.team_colour}` : '#777777';
      return `
        <tr>
          <td class="pos">${pos}</td>
          <td class="driver-cell">
            <div class="driver-wrap" style="--team:${teamColor}">
              <i class="team-stripe"></i>
              <span class="driver-number">${number}</span>
              <span class="driver-name"><strong>${escapeHtml(m.name_acronym || String(m.last_name || '').slice(0,3).toUpperCase() || number)}</strong><span>${escapeHtml(m.team_name || '')}</span></span>
            </div>
          </td>
          <td class="gap ${pos === 1 ? 'leader' : ''}">${formatGap(d.gap, pos === 1)}</td>
          <td>${pos === 1 ? '—' : formatGap(d.interval)}</td>
          <td class="tyre-cell"><span class="tyre ${tyre.compound}" title="${escapeHtml(tyre.compound)}">${tyre.short}</span></td>
          <td>${tyre.age}</td>
          <td>${d.lap || '—'}</td>
          <td class="lap-time ${lastClass}">${d.pitOut ? '<span class="muted">OUT LAP</span>' : formatLapTime(d.last)}</td>
          <td class="lap-time ${bestClass}">${formatLapTime(d.best)}</td>
          <td><span class="pit-count">${d.pits}</span></td>
        </tr>`;
    }).join('');
  }

  function raceControlClass(e) {
    const text = `${e.flag || ''} ${e.message || ''}`.toUpperCase();
    if (text.includes('RED')) return 'red';
    if (text.includes('YELLOW')) return 'yellow';
    if (text.includes('SAFETY CAR')) return 'safety';
    if (text.includes('GREEN') || text.includes('TRACK CLEAR')) return 'green';
    return '';
  }

  function renderRaceControl() {
    const items = app.state.raceControl.slice(-10).reverse();
    el.messageCount.textContent = String(app.state.raceControl.length);
    if (!items.length) {
      el.raceControl.innerHTML = '<div class="empty-state">아직 표시할 메시지가 없습니다.</div>';
      return;
    }
    el.raceControl.innerHTML = items.map(e => `
      <div class="rc-item">
        <div class="rc-lap">${e.lap_number ? `LAP ${e.lap_number}` : formatClock(e.t).slice(0,5)}</div>
        <div class="rc-content">
          <span class="rc-flag ${raceControlClass(e)}">${escapeHtml(e.flag || e.category || 'INFO')}</span>
          <div class="rc-message">${escapeHtml(e.message || '')}</div>
        </div>
      </div>`).join('');
  }

  function renderWeather() {
    const w = app.state.weather;
    if (!w) {
      el.airTemp.textContent = el.trackTemp.textContent = '--°C';
      el.windSpeed.textContent = '-- m/s'; el.rainfall.textContent = '--'; el.humidity.textContent = '--%'; el.pressure.textContent = '-- hPa';
      return;
    }
    el.airTemp.textContent = `${Number(w.air_temperature).toFixed(1)}°C`;
    el.trackTemp.textContent = `${Number(w.track_temperature).toFixed(1)}°C`;
    el.windSpeed.textContent = `${Number(w.wind_speed).toFixed(1)} m/s`;
    el.rainfall.textContent = Number(w.rainfall) ? 'YES' : 'NO';
    el.humidity.textContent = `${Math.round(Number(w.humidity))}%`;
    el.pressure.textContent = `${Number(w.pressure).toFixed(0)} hPa`;
  }

  function renderHeader() {
    el.currentLap.textContent = String(app.state.currentLap || 0);
    el.replayTime.textContent = formatElapsed(app.playhead - app.replayStart);
    el.sessionClock.textContent = formatClock(app.playhead);
    el.trackStatus.textContent = app.state.trackStatus.text;
    el.trackStatusDot.className = `status-dot ${app.state.trackStatus.className}`;
    const progress = app.replayEnd > app.replayStart ? (app.playhead - app.replayStart) / (app.replayEnd - app.replayStart) : 0;
    el.timeline.value = String(Math.round(clamp(progress, 0, 1) * 1000));
  }

  function renderAll(force = false) {
    const now = performance.now();
    if (!force && now - app.renderAt < 180) return;
    app.renderAt = now;
    renderHeader();
    renderTiming();
    renderRaceControl();
    renderWeather();
  }

  function seekTo(target) {
    if (!app.raw) return;
    const t = clamp(target, app.replayStart, app.replayEnd);
    if (t < app.playhead) {
      resetReplayState();
      app.playhead = app.replayStart;
    }
    applyUntil(t);
    app.playhead = t;
    renderAll(true);
  }

  function animationFrame(now) {
    if (!app.playing) return;
    if (!app.lastFrameAt) app.lastFrameAt = now;
    const delta = Math.min(500, now - app.lastFrameAt);
    app.lastFrameAt = now;
    const target = app.playhead + delta * app.speed;
    applyUntil(Math.min(target, app.replayEnd));
    app.playhead = Math.min(target, app.replayEnd);
    renderAll(false);
    if (app.playhead >= app.replayEnd) {
      stopPlayback();
      renderAll(true);
      return;
    }
    app.raf = requestAnimationFrame(animationFrame);
  }

  function startPlayback() {
    if (!app.raw) return;
    if (app.playhead >= app.replayEnd) seekTo(app.replayStart);
    app.playing = true;
    app.lastFrameAt = 0;
    el.playButton.textContent = '❚❚';
    el.playButton.setAttribute('aria-label', '일시정지');
    cancelAnimationFrame(app.raf);
    app.raf = requestAnimationFrame(animationFrame);
  }

  function stopPlayback() {
    app.playing = false;
    app.lastFrameAt = 0;
    cancelAnimationFrame(app.raf);
    el.playButton.textContent = '▶';
    el.playButton.setAttribute('aria-label', '재생');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function bindEvents() {
    el.yearSelect.addEventListener('change', () => loadSessions(Number(el.yearSelect.value)));
    el.sessionSelect.addEventListener('change', () => {
      app.selectedSession = app.sessions.find(s => String(s.session_key) === el.sessionSelect.value) || app.sessions[0];
    });
    el.loadButton.addEventListener('click', loadSelectedSession);
    el.speedSelect.addEventListener('change', () => { app.speed = Number(el.speedSelect.value) || 30; });
    el.playButton.addEventListener('click', () => app.playing ? stopPlayback() : startPlayback());
    el.restartButton.addEventListener('click', () => { stopPlayback(); seekTo(app.replayStart); });
    el.timeline.addEventListener('input', () => {
      if (!app.raw) return;
      const ratio = Number(el.timeline.value) / 1000;
      el.replayTime.textContent = formatElapsed((app.replayEnd - app.replayStart) * ratio);
    });
    el.timeline.addEventListener('change', () => {
      if (!app.raw) return;
      const ratio = Number(el.timeline.value) / 1000;
      seekTo(app.replayStart + (app.replayEnd - app.replayStart) * ratio);
    });
  }

  async function init() {
    populateYears();
    bindEvents();
    app.speed = Number(el.speedSelect.value) || 30;
    el.timingBody.innerHTML = '<tr class="loading-row"><td colspan="10">세션을 선택하고 데이터를 불러오세요.</td></tr>';
    await loadSessions();
  }

  init();
})();
