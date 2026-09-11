const allowed = new Set(['f1', 'f2', 'f3', 'f1a']);
const params = new URLSearchParams(window.location.search);
const requested = (params.get('series') || 'f1').toLowerCase();
const series = allowed.has(requested) ? requested : 'f1';

window.__MAGIC_SERIES__ = series;
document.documentElement.dataset.series = series;

document.querySelectorAll('[data-series-link]').forEach((link) => {
  const active = link.dataset.seriesLink === series;
  link.classList.toggle('active', active);
  link.setAttribute('aria-current', active ? 'page' : 'false');
});

if (series === 'f1') {
  document.title = 'F1 챔피언십 매직넘버 계산기';
  const eyebrow = document.querySelector('.eyebrow');
  const heading = document.querySelector('h1');
  const subtitle = document.querySelector('.subtitle');
  if (eyebrow) eyebrow.textContent = '비공식 F1 챔피언십 계산 도구 · V0.4';
  if (heading) heading.innerHTML = 'F1 챔피언십 <span>매직넘버</span>';
  if (subtitle) subtitle.textContent = 'F1 드라이버·팀 챔피언십의 우승 확정까지 남은 점수와 다음 라운드 조건을 한글로 쉽게 확인합니다.';
  import('./app.js');
} else {
  import('./support-app.js');
}
