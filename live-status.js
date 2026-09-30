(() => {
  'use strict';

  const els = Object.fromEntries([
    'openf1AuthState',
    'liveModeState',
    'detectedSession',
    'nextSessionTime',
    'liveSessionDetail'
  ].map(id => [id, document.getElementById(id)]));

  if (Object.values(els).some(value => !value)) return;

  const state = {
    nextStart: null,
    nextSession: null,
    currentSession: null,
    refreshTimer: 0,
    clockTimer: 0
  };

  const SESSION_LABELS = {
    'Practice 1': '프랙티스 1',
    'Practice 2': '프랙티스 2',
    'Practice 3': '프랙티스 3',
    'Sprint Qualifying': '스프린트 퀄리파잉',
    'Sprint Shootout': '스프린트 퀄리파잉',
    'Sprint': '스프린트',
    'Qualifying': '퀄리파잉',
    'Race': '레이스'
  };

  function sessionLabel(session) {
    return SESSION_LABELS[session?.session_name] || session?.session_name || session?.session_type || '세션';
  }

  function eventLabel(session) {
    if (!session) return '—';
    if (session.country_name === 'Bahrain' && /Kuala Lumpur/i.test(session.location || '')) {
      return '바레인 GP in 말레이시아';
    }
    return session.country_name || session.location || 'Grand Prix';
  }

  function formatKst(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d);
  }

  function durationText(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return '곧 시작';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}일 ${hours}시간 ${minutes}분`;
    if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초`;
    return `${minutes}분 ${seconds}초`;
  }

  async function getJson(url) {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });

    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`Invalid JSON (${response.status})`);
    }

    if (!response.ok) {
      throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
    }
    return payload;
  }

  function setBadge(element, text, tone) {
    element.textContent = text;
    element.dataset.tone = tone;
  }

  function selectSessionWindow(sessions) {
    const now = Date.now();
    const valid = sessions
      .filter(s => !s.is_cancelled)
      .map(s => ({
        ...s,
        startMs: new Date(s.date_start).getTime(),
        endMs: new Date(s.date_end || s.date_start).getTime()
      }))
      .filter(s => Number.isFinite(s.startMs) && Number.isFinite(s.endMs))
      .sort((a, b) => a.startMs - b.startMs);

    const current = valid.find(s => now >= s.startMs - 15 * 60_000 && now <= s.endMs + 30 * 60_000) || null;
    const upcoming = valid.find(s => s.startMs > now) || null;
    const previous = [...valid].reverse().find(s => s.endMs < now) || null;

    return { current, upcoming, previous };
  }

  function renderSessionState({ current, upcoming, previous }) {
    state.currentSession = current;
    state.nextSession = upcoming;
    state.nextStart = upcoming?.startMs || null;

    if (current) {
      setBadge(els.liveModeState, 'LIVE', 'live');
      els.detectedSession.textContent = `${eventLabel(current)} · ${sessionLabel(current)}`;
      els.liveSessionDetail.textContent = `${current.circuit_short_name || current.location || ''} · KST ${formatKst(current.date_start)}`;
    } else {
      setBadge(els.liveModeState, 'STANDBY', 'standby');
      const reference = previous || upcoming;
      els.detectedSession.textContent = reference
        ? `현재 라이브 세션 없음 · 최근 ${eventLabel(reference)} ${sessionLabel(reference)}`
        : '현재 라이브 세션 없음';
      els.liveSessionDetail.textContent = upcoming
        ? `다음: ${eventLabel(upcoming)} · ${sessionLabel(upcoming)} · KST ${formatKst(upcoming.date_start)}`
        : '예정된 세션을 찾지 못했습니다.';
    }

    renderCountdown();
  }

  function renderCountdown() {
    if (state.currentSession) {
      els.nextSessionTime.textContent = '세션 진행 중';
      return;
    }

    if (!state.nextStart) {
      els.nextSessionTime.textContent = '—';
      return;
    }

    const remain = state.nextStart - Date.now();
    els.nextSessionTime.textContent = remain > 0
      ? `${durationText(remain)} 후`
      : '세션 확인 중…';
  }

  async function refresh() {
    try {
      const auth = await getJson('/api/openf1?endpoint=auth_status');
      if (auth?.authenticated) {
        setBadge(els.openf1AuthState, 'AUTHENTICATED', 'ok');
      } else if (auth?.configured) {
        setBadge(els.openf1AuthState, 'AUTH ERROR', 'error');
      } else {
        setBadge(els.openf1AuthState, 'ANONYMOUS', 'warn');
      }
    } catch (error) {
      console.warn('OpenF1 auth status unavailable', error);
      setBadge(els.openf1AuthState, 'AUTH CHECK ERROR', 'error');
    }

    try {
      const year = new Date().getUTCFullYear();
      const sessions = await getJson(`/api/openf1?endpoint=sessions&year=${year}`);
      renderSessionState(selectSessionWindow(Array.isArray(sessions) ? sessions : []));
    } catch (error) {
      console.warn('Session auto detection failed', error);
      setBadge(els.liveModeState, 'DETECT ERROR', 'error');
      els.detectedSession.textContent = '세션 자동 감지 실패';
      els.liveSessionDetail.textContent = error.message || 'OpenF1 session request failed';
      state.currentSession = null;
      state.nextSession = null;
      state.nextStart = null;
      renderCountdown();
    }
  }

  state.clockTimer = window.setInterval(renderCountdown, 1000);
  state.refreshTimer = window.setInterval(refresh, 60_000);
  refresh();
})();
