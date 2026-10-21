/* The site menu: every page loads this and calls siteMenu(currentKey, rootPrefix). */
const SITE = [
  {"key": "gladiator", "name": "Gladiator", "href": "gladiator-planner/", "icon": "gladiator-planner/icons/11170000.webp"},
  {"key": "templar", "name": "Templar", "href": "templar-planner/", "icon": "templar-planner/icons/12240000.webp"},
  {"key": "assassin", "name": "Assassin", "href": "assassin-planner/", "icon": "assassin-planner/icons/13350000.webp"},
  {"key": "ranger", "name": "Ranger", "href": "ranger-planner/", "icon": "ranger-planner/icons/14010000.webp"},
  {"key": "sorcerer", "name": "Sorcerer", "href": "sorcerer-planner/", "icon": "sorcerer-planner/icons/15060000.webp"},
  {"key": "spiritmaster", "name": "Spiritmaster", "href": "spiritmaster-planner/", "icon": "spiritmaster-planner/icons/16100000.webp"},
  {"key": "cleric", "name": "Cleric", "href": "cleric-planner/", "icon": "cleric-planner/icons/17350000.webp"},
  {"key": "chanter", "name": "Chanter", "href": "chanter-planner/", "icon": "chanter-planner/icons/18100000.webp"},
];
const SITE_EXTRA = [
  { key: 'macros', name: 'Macros', href: 'macros/' },
  { key: 'crafting', name: 'Crafting', href: 'crafting/' },
  { key: 'essence', name: 'Essence Extraction', href: 'essence-extraction/' },
];

/* Site-wide "Global only" switch, on by default: hides content that applies only to the Korean and Taiwanese servers.
   Pages mark such content with class "nonglobal"; scripts that render it listen for the "globalonly" event. */
const GLOBAL_KEY = 'aion2-global-only';
function globalOnly() { try { return localStorage.getItem(GLOBAL_KEY) !== '0'; } catch(e) { return true; } }
function applyGlobalOnly() {
  document.documentElement.classList.toggle('global-only', globalOnly());
  document.querySelectorAll('.gtoggle').forEach(b => b.setAttribute('aria-pressed', globalOnly()));
}
function setGlobalOnly(on) {
  try { localStorage.setItem(GLOBAL_KEY, on ? '1' : '0'); } catch(e) {}
  applyGlobalOnly();
  window.dispatchEvent(new Event('globalonly'));
}
applyGlobalOnly();

function siteMenu(current, root) {
  const el = document.getElementById('site');
  if (!el) return;
  const link = (p, extra = '') => `<a href="${root}${p.href}index.html"${p.key === current ? ' aria-current="page"' : ''}>${extra}${p.name}</a>`;
  el.innerHTML = `<div class="wrap"><div class="links"><a class="home" href="${root}index.html"${current === 'home' ? ' aria-current="page"' : ''}>AION 2 Planner</a><span class="sep"></span>` +
    SITE.map(p => link(p, p.icon ? `<img src="${root}${p.icon}" alt="">` : '')).join('') +
    `<span class="sep"></span>` + SITE_EXTRA.map(p => link(p)).join('') + `</div>` +
    `<button class="gtoggle" type="button" aria-pressed="${globalOnly()}" title="Hide advice, data and boards that apply only to the Korean and Taiwanese servers"><span class="sw"></span>Global only</button></div>`;
  el.querySelector('.gtoggle').onclick = () => setGlobalOnly(!globalOnly());
  const cur = el.querySelector('[aria-current="page"]'), wrap = el.querySelector('.links');
  if (cur && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = cur.offsetLeft - (wrap.clientWidth - cur.offsetWidth) / 2;
}
