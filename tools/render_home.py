"""Write the root index.html (the menu) and shared/site.js's class list from the guide files."""
import html, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ORDER = ['gladiator', 'templar', 'assassin', 'ranger', 'sorcerer', 'spiritmaster', 'cleric', 'chanter']
ROLE = {'gladiator': 'Melee DPS', 'templar': 'Tank', 'assassin': 'Melee DPS', 'ranger': 'Ranged DPS',
        'sorcerer': 'Magic DPS', 'spiritmaster': 'Magic DPS · spirits', 'cleric': 'Healer', 'chanter': 'Support'}
GUIDES = [{'key': 'macros', 'name': 'Macro Guide', 'href': 'macros/', 'role': 'Combat',
           'build': 'Set up the in-game skill macro',
           'blurb': 'How the macro and basic-attack cancelling work, the setup in game step by step, what goes in it, and every class at a glance.',
           'store': None, 'svg': '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>'},
          {'key': 'crafting', 'name': 'Crafting', 'href': 'crafting/', 'role': 'Professions',
           'build': 'Five crafts, proficiency 1 to 100',
           'blurb': 'What each craft makes and unlocks, success rates, the Dragon Lord ladder to item level 102, materials, and what your alts need.',
           'store': 'crafting-planner', 'kind': 'craft', 'svg': '<path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7L3 15l3 3 8-8M3 21h10"/>'},
          {'key': 'essence', 'name': 'Essence Extraction', 'href': 'essence-extraction/', 'role': 'Gathering profession',
           'build': 'Proficiency 1 to 100, fastest route',
           'blurb': 'Which ore, plants and gems to gather at each proficiency, where they grow, and how to get past each gate.',
           'store': 'essence-planner', 'svg': '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 18 3-18"/>'}]


def main():
    e = html.escape
    cards, site = [], []
    for c in ORDER:
        p = os.path.join(ROOT, 'classes', f'{c}.guide.json')
        if not os.path.exists(p):
            continue
        m = json.load(open(p))['meta']
        store = m.get('storageKey') or f'{c}-planner'
        cards.append(f'''    <a class="cc" href="{c}-planner/index.html"><img src="{c}-planner/icons/{m['brandIcon']}.webp" alt="">
      <h2>{e(m['name'])}</h2><span class="role">{e(ROLE[c])}</span>
      <span class="build">{e(m['build'])}</span><p>{e(m.get('blurb', ''))}</p><span class="prog" data-store="{store}"></span></a>''')
        site.append({'key': c, 'name': m['name'], 'href': f'{c}-planner/', 'icon': f"{c}-planner/icons/{m['brandIcon']}.webp"})
    gath = [f'''    <a class="cc" href="{g['href']}index.html"><span class="gico" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{g['svg']}</svg></span>
      <h2>{e(g['name'])}</h2><span class="role">{e(g['role'])}</span>
      <span class="build">{e(g['build'])}</span><p>{e(g['blurb'])}</p>{f'<span class="prog" data-store="{g["store"]}" data-kind="{g.get('kind', 'prof')}"></span>' if g['store'] else ''}</a>''' for g in GUIDES]
    page = open(os.path.join(HERE, 'templates', 'home.html'), encoding='utf-8').read()
    page = page.replace('{cards}', '\n'.join(cards)).replace('{guides}', '\n'.join(gath)).replace('{compiled}', '18 Oct 2026')
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(page)
    s = open(os.path.join(ROOT, 'shared', 'site.js'), encoding='utf-8').read()
    start, end = s.index('const SITE = ['), s.index('];', s.index('const SITE = [')) + 2
    body = 'const SITE = [\n' + ''.join(f'  {json.dumps(x, ensure_ascii=False)},\n' for x in site) + '];'
    open(os.path.join(ROOT, 'shared', 'site.js'), 'w', encoding='utf-8').write(s[:start] + body + s[end:])
    print('index.html:', len(cards), 'classes')


if __name__ == '__main__':
    main()
