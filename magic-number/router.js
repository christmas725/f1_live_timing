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
  import('./app.js');
} else {
  import('./support-app.js');
}
