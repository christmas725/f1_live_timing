const SIMULATIONS = 3000;

import { SERIES_META, DRIVER_META, TEAM_KO, TEAM_COLORS } from './support-meta.js';

const els = Object.fromEntries([
  'seasonSelect','entityLabel','entitySelect','refreshBtn','dataStatus','magicNumber','magicText','magicNote','magicProgress',
  'selectedCardLabel','entityBadge','entityName','entityTeam','entityPoints','entityPosition','gapToThreat','remainingMax','remainingGp',
  'remainingSprint','latestRound','titleProbability','projectedClinch','simulationCount','countbackBadge','countbackSummary','countbackRows',
  'nextRoundTitle','clinchSummary','scenarioList','probabilityList','forecastMethod','fieldTitle','entityHeader','rivalsBody','updatedAt'
].map((id) => [id, document.getElementById(id)]));
els.modeButtons = [...document.querySelectorAll('.mode-btn')];

const series = window.__MAGIC_SERIES__ || 'f2';
const meta = SERIES_META[series];
let state = { mode: 'drivers', data: null, drivers: [], teams: [], selectedId: null, forecastToken: 0 };

function slug(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function escapeHtml(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function currentEntities() { return state.mode === 'drivers' ? state.drivers : state.teams; }
function selectedEntity() { return currentEntities().find((item) => item.id === state.selectedId) || currentEntities()[0] || null; }
function eventMax(event) { return state.mode === 'drivers' ? event.maxDriver : event.maxTeam; }
function remainingMax() { return (state.data?.remaining || []).reduce((sum, event) => sum + eventMax(event), 0); }
function formatGap(value) { if (value === 0) return '동점'; return value > 0 ? `+${value}` : String(value); }

function decorateDriver(row) {
  const info = DRIVER_META[series][row.name] || null;
  const team = info?.[1] || meta.full;
  return {
    id: slug(row.name), kind:'driver', rawName:row.name, name:info?.[0] || row.name, code:info?.[2] || row.name.replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase(),
    team, sub:TEAM_KO[team] || team, color:TEAM_COLORS[team] || meta.color, points:Number(row.points||0), position:Number(row.position||999)
  };
}
function decorateTeam(row) {
  const name = row.name.replace(/^\d+[.)]?\s*/, '').trim();
  return { id:slug(name), kind:'team', rawName:name, name:TEAM_KO[name] || name, code:name.split(/\s+/).map((v)=>v[0]).join('').slice(0,3).toUpperCase(), sub:meta.full, color:TEAM_COLORS[name] || meta.color, points:Number(row.points||0), position:Number(row.position||999) };
}

function magicAgainst(candidate, rival) {
  const gap = candidate.points - rival.points;
  const base = Math.max(0, remainingMax() - gap + 1);
  return { rival, gap, magic: base };
}
function strongestRival(candidate) {
  return currentEntities().filter((entity) => entity.id !== candidate.id).map((rival) => magicAgainst(candidate, rival)).sort((a,b)=>b.magic-a.magic || b.rival.points-a.rival.points)[0] || null;
}
function isEliminated(entity) {
  const rem = remainingMax();
  return currentEntities().some((rival) => rival.id !== entity.id && entity.points + rem < rival.points);
}

function setStatus(message, kind='') { els.dataStatus.textContent = message; els.dataStatus.className = `status ${kind}`.trim(); }

function configurePage() {
  document.title = `${meta.title} 챔피언십 매직넘버 계산기`;
  document.querySelector('.eyebrow').textContent = `비공식 ${meta.full} 챔피언십 계산 도구 · V0.4`;
  document.querySelector('h1').innerHTML = `${meta.title} 챔피언십 <span>매직넘버</span>`;
  document.querySelector('.subtitle').textContent = `${meta.full} 드라이버·팀 챔피언십의 우승 확정까지 남은 점수와 다음 라운드 조건을 한글로 쉽게 확인합니다.`;
  const glossary = document.querySelector('.glossary-row');
  if (glossary) glossary.innerHTML = meta.guide.map(([key, text]) => `<span><b>${escapeHtml(key)}</b> ${escapeHtml(text)}</span>`).join('');
  const starterTitle = document.querySelector('#starterTitle');
  if (starterTitle) starterTitle.textContent = `${meta.title}도 숫자 3개만 먼저 보면 돼요`;
  const methodGrid = document.querySelector('.method-grid');
  if (methodGrid) methodGrid.innerHTML = `
    <p><strong>라운드 최대점</strong><br />${escapeHtml(meta.method)}</p>
    <p><strong>보수적 동점 처리</strong><br />지원 시리즈는 세부 카운트백 전체를 가져오지 않아 동점은 확정으로 보지 않습니다.</p>
    <p><strong>수학적 탈락</strong><br />남은 최대점을 전부 얻어도 현재 경쟁자를 넘을 수 없으면 탈락으로 표시합니다.</p>
    <p><strong>확률 전망</strong><br />현재 순위와 포인트를 기반으로 남은 라운드를 3,000회 단순 시뮬레이션합니다.</p>`;
  const note = document.querySelector('.method-note');
  if (note) note.innerHTML = `공식 순위 데이터는 <b>${escapeHtml(meta.full)} 공식 사이트</b>에서 불러옵니다. 세부 카운트백은 보수적으로 처리합니다.`;
  const footer = document.querySelector('footer p:first-child');
  if (footer) footer.textContent = `팬이 만든 비공식 계산기입니다. ${meta.full} 및 FIA와 제휴 관계가 없습니다.`;
}

function renderModeLabels() {
  const teams = state.mode === 'constructors';
  els.entityLabel.textContent = teams ? '기준 팀' : '기준 드라이버';
  els.selectedCardLabel.textContent = teams ? '선택한 팀' : '선택한 드라이버';
  els.fieldTitle.textContent = teams ? '팀별 매직넘버' : '경쟁자별 매직넘버';
  els.entityHeader.textContent = teams ? '팀' : '드라이버';
  els.modeButtons[0].textContent = '드라이버 챔피언십';
  els.modeButtons[1].textContent = '팀 챔피언십';
  els.modeButtons.forEach((button) => { const active = button.dataset.mode === state.mode; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  const spans = document.querySelectorAll('.remaining-card .stats-row span');
  if (spans[1]) spans[1].textContent = '남은 라운드';
  if (spans[2]) spans[2].textContent = '다음 라운드 최대점';
}

function populateEntitySelect() {
  const previous = state.selectedId;
  els.entitySelect.replaceChildren();
  for (const entity of currentEntities()) {
    const option = document.createElement('option'); option.value = entity.id; option.textContent = `${entity.position}위 · ${entity.name} · ${entity.points}점`; els.entitySelect.append(option);
  }
  state.selectedId = currentEntities().some((e)=>e.id===previous) ? previous : currentEntities()[0]?.id || null;
  els.entitySelect.value = state.selectedId || '';
}

function renderHero(candidate, threat) {
  const rem = remainingMax();
  if (isEliminated(candidate)) {
    els.magicNumber.textContent = '탈락'; els.magicText.textContent = `${candidate.name}은(는) 남은 최대 포인트를 모두 얻어도 현재 선두를 넘을 수 없습니다.`; els.magicProgress.style.width='0%';
  } else if (!threat || threat.magic === 0) {
    els.magicNumber.textContent='0'; els.magicText.textContent=`${candidate.name}은(는) 수학적으로 챔피언을 확정했습니다.`; els.magicProgress.style.width='100%';
  } else {
    els.magicNumber.textContent=String(threat.magic); els.magicText.textContent=`${threat.rival.name} 기준 · 현재 격차 ${formatGap(threat.gap)}점 · 남은 최대점 ${rem}점.`;
    const denominator=Math.max(1,rem+Math.max(0,-threat.gap)+1); els.magicProgress.style.width=`${Math.max(0,Math.min(100,100-threat.magic/denominator*100))}%`;
  }
  els.magicNote.textContent='세부 카운트백이 완전히 제공되지 않아 동점 우승은 인정하지 않고 1점 앞서는 보수적 기준으로 계산합니다.';
  els.entityBadge.textContent=candidate.code; els.entityBadge.style.background=`linear-gradient(135deg,#${candidate.color},#31384a)`;
  els.entityName.textContent=candidate.name; els.entityTeam.textContent=candidate.sub || '—'; els.entityPoints.textContent=candidate.points; els.entityPosition.textContent=`${candidate.position}위`; els.gapToThreat.textContent=threat?formatGap(candidate.points-threat.rival.points):'—';
  els.remainingMax.textContent=rem; els.remainingGp.textContent=state.data.remaining.length; els.remainingSprint.textContent=state.data.remaining[0]?eventMax(state.data.remaining[0]):0;
  els.latestRound.textContent=`최신 완료 기준: ${state.data.latest?.name || '시즌 시작 전'} · ${state.data.sourceLabel}`;
}

function renderCountback() {
  els.countbackRows.replaceChildren(); els.countbackBadge.textContent='보수 계산'; els.countbackBadge.className='mini-pill warn';
  els.countbackSummary.textContent=`${meta.title}는 현재 공식 종합 순위를 기준으로 매직넘버를 계산합니다. 세부 레이스별 카운트백 전체를 아직 연결하지 않았기 때문에 포인트 동점만으로 챔피언 확정 처리하지 않습니다.`;
}

function renderScenarios(candidate, threat) {
  els.scenarioList.replaceChildren(); const next=state.data.remaining[0];
  if (!next) { els.nextRoundTitle.textContent='시즌 종료'; els.clinchSummary.textContent='남은 라운드가 없습니다.'; return; }
  els.nextRoundTitle.textContent=`${next.name} 우승 확정 조건`;
  if (!threat || threat.magic===0) { els.clinchSummary.textContent=`${candidate.name}은(는) 이미 챔피언 확정 상태입니다.`; return; }
  if (isEliminated(candidate)) { els.clinchSummary.textContent='이미 수학적으로 챔피언 가능성이 소멸했습니다.'; return; }
  const max=eventMax(next); const after=state.data.remaining.slice(1).reduce((sum,e)=>sum+eventMax(e),0);
  els.clinchSummary.textContent = candidate.points + max > threat.rival.points + after ? `${candidate.name}은(는) ${next.name}에서 챔피언 확정이 가능한 범위에 있습니다.` : `현재 격차로는 ${next.name} 종료 시점에 아직 확정할 수 없습니다.`;
  const candidates=[max,Math.round(max*.85),Math.round(max*.7),Math.round(max*.55),Math.round(max*.4),Math.round(max*.25)];
  [...new Set(candidates)].forEach((score)=>{ const allowed=score+(candidate.points-threat.rival.points)-after-1; const div=document.createElement('div'); div.className='scenario'; const cond=allowed<0?'이 점수로는 확정 불가':allowed>=max?`${threat.rival.name} 결과와 무관`:`${threat.rival.name} ${allowed}점 이하 필요`; div.innerHTML=`<strong>주말 ${score}점</strong><span>${escapeHtml(cond)}</span>`; els.scenarioList.append(div); });
}

function renderField(candidate) {
  els.rivalsBody.replaceChildren(); const rem=remainingMax();
  for (const entity of currentEntities()) {
    const selected=entity.id===candidate.id; const info=selected?null:magicAgainst(candidate,entity); const out=!selected && candidate.points>entity.points+rem; const gap=candidate.points-entity.points;
    const tr=document.createElement('tr'); if(out) tr.classList.add('eliminated');
    const cells=[
      [`${entity.position}위`,'순위'], [`<strong>${escapeHtml(entity.name)}</strong><span>${escapeHtml(entity.sub||'')}</span>`,state.mode==='drivers'?'드라이버':'팀','entity-cell'],
      [entity.points,'포인트'], [selected?'—':formatGap(gap),'격차'], [selected?candidate.points+rem:entity.points+rem,'가능 최대점'],
      [selected?'—':`<span class="magic-pill">${info.magic}</span>`,'매직넘버'], [selected?'<span class="status-pill selected">선택</span>':out?'<span class="status-pill out">수학적 탈락</span>':'<span class="status-pill alive">경쟁 중</span>','상태']
    ];
    cells.forEach(([html,label,className])=>{ const td=document.createElement('td'); td.dataset.label=label; if(className)td.className=className; td.innerHTML=html; tr.append(td); }); els.rivalsBody.append(tr);
  }
}

function hashString(value){let h=2166136261;for(let i=0;i<value.length;i+=1){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function runForecast(){
  const entities=currentEntities(); const selected=selectedEntity(); if(!selected||!entities.length) return {counts:new Map(),selectedProbability:0,projectedClinch:'—'};
  if(!state.data.remaining.length) return {counts:new Map(entities.map(e=>[e.id,e.id===selected.id?SIMULATIONS:0])),selectedProbability:isEliminated(selected)?0:100,projectedClinch:'시즌 종료'};
  const maxPoints=Math.max(...entities.map(e=>e.points),1); const strengths=new Map(entities.map((e,i)=>[e.id,clamp(.25+.55*(e.points/maxPoints)+.2*((entities.length-i)/entities.length),.1,1)]));
  const fingerprint=`${series}|${state.mode}|${entities.map(e=>`${e.id}:${e.points}`).join(',')}`; const rng=mulberry32(hashString(fingerprint)); const counts=new Map(entities.map(e=>[e.id,0])); const clinch=new Map();
  for(let sim=0;sim<SIMULATIONS;sim+=1){ const points=new Map(entities.map(e=>[e.id,e.points])); let clinched=null;
    state.data.remaining.forEach((event,eventIndex)=>{ const mx=eventMax(event); for(const e of entities){ const s=strengths.get(e.id)||.2; const noise=(rng()-.5)*.75; const score=Math.round(mx*clamp(.05+s*.78+noise,0,1)); points.set(e.id,(points.get(e.id)||0)+score); }
      if(!clinched){ const remAfter=state.data.remaining.slice(eventIndex+1).reduce((sum,e)=>sum+eventMax(e),0); const sp=points.get(selected.id)||0; if(entities.every(e=>e.id===selected.id || sp>(points.get(e.id)||0)+remAfter)) clinched=event.name; }
    });
    const winner=[...entities].sort((a,b)=>(points.get(b.id)||0)-(points.get(a.id)||0) || a.position-b.position)[0]; if(winner) counts.set(winner.id,(counts.get(winner.id)||0)+1); if(winner?.id===selected.id){ const label=clinched||state.data.remaining.at(-1)?.name||'최종전'; clinch.set(label,(clinch.get(label)||0)+1); }
  }
  const selectedProbability=(counts.get(selected.id)||0)/SIMULATIONS*100; const projectedClinch=[...clinch.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || (selectedProbability<.1?'가능성 낮음':'최종전'); return {counts,selectedProbability,projectedClinch};
}
function formatProbability(v){if(v<=0)return'0%';if(v<.1)return'<0.1%';if(v>=99.95)return'100%';return`${v.toFixed(v<10?1:0)}%`;}
function renderForecast(forecast){ const selected=selectedEntity(); if(!selected)return; els.simulationCount.textContent=`${SIMULATIONS.toLocaleString()}회`; els.titleProbability.textContent=formatProbability(forecast.selectedProbability); els.projectedClinch.textContent=forecast.projectedClinch; els.probabilityList.replaceChildren();
  const rows=currentEntities().map(e=>({entity:e,p:(forecast.counts.get(e.id)||0)/SIMULATIONS*100})).sort((a,b)=>b.p-a.p).slice(0,6); rows.forEach(({entity,p})=>{const div=document.createElement('div');div.className='probability-row';div.innerHTML=`<div class="probability-copy"><div class="name-line"><span>${escapeHtml(entity.name)}</span></div><div class="probability-bar"><i style="width:${Math.max(.5,p)}%"></i></div></div><div class="probability-value">${formatProbability(p)}</div>`;els.probabilityList.append(div);});
  els.forecastMethod.textContent=`${SIMULATIONS.toLocaleString()}회 단순 시뮬레이션 · 현재 포인트와 순위를 가중치로 사용 · 남은 ${state.data.remaining.length}라운드 반영 · 공식 확률이나 베팅 지표가 아닙니다.`;
}
function scheduleForecast(){const token=++state.forecastToken;els.titleProbability.textContent='…';els.projectedClinch.textContent='계산 중';els.simulationCount.textContent=`${SIMULATIONS.toLocaleString()}회`;els.probabilityList.innerHTML='<div class="info-box">남은 시즌을 시뮬레이션하는 중…</div>';setTimeout(()=>{if(token!==state.forecastToken)return;renderForecast(runForecast());},20);}

function renderCore(){ renderModeLabels(); const candidate=selectedEntity(); if(!candidate)return; const threat=strongestRival(candidate); renderHero(candidate,threat); renderCountback(); renderScenarios(candidate,threat); renderField(candidate); scheduleForecast(); }

async function loadData(){
  els.refreshBtn.disabled=true; setStatus(`${meta.full} 공식 순위를 확인하는 중…`); state.forecastToken+=1;
  try {
    const response=await fetch(`/api/support-series?series=${encodeURIComponent(series)}&season=2026`,{cache:'no-store'}); const data=await response.json(); if(!response.ok)throw new Error(data.detail||data.error||`HTTP ${response.status}`);
    state.data=data; state.drivers=data.drivers.map(decorateDriver).sort((a,b)=>a.position-b.position); state.teams=data.teams.map(decorateTeam).sort((a,b)=>a.position-b.position); populateEntitySelect(); renderCore();
    setStatus(`${data.sourceLabel} 동기화 완료 · 드라이버 ${state.drivers.length}명 · 팀 ${state.teams.length}개`, 'ok'); els.updatedAt.textContent=`업데이트 ${new Date(data.fetchedAt).toLocaleString('ko-KR')}`;
  } catch(error) { console.error(error); setStatus(`데이터 오류: ${error.message}`,'error'); els.magicText.textContent='공식 지원 시리즈 순위 데이터를 불러오지 못했습니다.'; els.countbackSummary.textContent='데이터 소스 연결 상태를 확인해 주세요.'; }
  finally { els.refreshBtn.disabled=false; }
}

configurePage();
els.modeButtons.forEach((button)=>button.addEventListener('click',()=>{if(button.dataset.mode===state.mode)return;state.mode=button.dataset.mode;state.selectedId=null;populateEntitySelect();renderCore();}));
els.entitySelect.addEventListener('change',()=>{state.selectedId=els.entitySelect.value;renderCore();});
els.refreshBtn.addEventListener('click',loadData); els.seasonSelect.addEventListener('change',loadData);
loadData();
