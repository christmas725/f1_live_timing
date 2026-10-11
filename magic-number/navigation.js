const menu = document.querySelector('#siteMenu');
const toggle = document.querySelector('#menuToggle');
toggle.addEventListener('click', () => { menu.showModal(); toggle.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden'; });
document.querySelector('#menuClose').addEventListener('click', () => menu.close());
menu.addEventListener('click', (event) => { if (event.target === menu && event.clientX > menu.getBoundingClientRect().right) menu.close(); });
menu.addEventListener('close', () => { toggle.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; toggle.focus(); });
const page = /\/documents(?:\.html)?\/?$/.test(location.pathname) ? 'documents' : 'home';
menu.querySelector(`[data-page="${page}"]`).setAttribute('aria-current', 'page');
