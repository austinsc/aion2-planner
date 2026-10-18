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
  { key: 'essence', name: 'Essence Extraction', href: 'essence-extraction/' },
];

function siteMenu(current, root) {
  const el = document.getElementById('site');
  if (!el) return;
  const link = (p, extra = '') => `<a href="${root}${p.href}index.html"${p.key === current ? ' aria-current="page"' : ''}>${extra}${p.name}</a>`;
  el.innerHTML = `<div class="wrap"><a class="home" href="${root}index.html"${current === 'home' ? ' aria-current="page"' : ''}>AION 2 Planner</a><span class="sep"></span>` +
    SITE.map(p => link(p, p.icon ? `<img src="${root}${p.icon}" alt="">` : '')).join('') +
    `<span class="sep"></span>` + SITE_EXTRA.map(p => link(p)).join('') + `</div>`;
  const cur = el.querySelector('[aria-current="page"]'), wrap = el.firstChild;
  if (cur && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = cur.offsetLeft - (wrap.clientWidth - cur.offsetWidth) / 2;
}
