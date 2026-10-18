"""Write the root index.html (the menu) and shared/site.js's class list from the guide files."""
import html, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ORDER = ['gladiator', 'templar', 'assassin', 'ranger', 'sorcerer', 'spiritmaster', 'cleric', 'chanter']
ROLE = {'gladiator': 'Melee DPS', 'templar': 'Tank', 'assassin': 'Melee DPS', 'ranger': 'Ranged DPS',
        'sorcerer': 'Magic DPS', 'spiritmaster': 'Magic DPS · spirits', 'cleric': 'Healer', 'chanter': 'Support'}
GATHERING = [{'key': 'essence', 'name': 'Essence Extraction', 'href': 'essence-extraction/', 'role': 'Gathering profession',
              'build': 'Proficiency 1 to 100, fastest route',
              'blurb': 'Which ore, plants and gems to gather at each proficiency, where they grow, and how to get past each gate.',
              'store': 'essence-planner'}]


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
    gath = [f'''    <a class="cc wide" href="{g['href']}index.html"><span class="gico" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z"/></svg></span>
      <h2>{e(g['name'])}</h2><span class="role">{e(g['role'])}</span>
      <span class="build">{e(g['build'])}</span><p>{e(g['blurb'])}</p><span class="prog" data-store="{g['store']}"></span></a>''' for g in GATHERING]
    page = open(os.path.join(HERE, 'templates', 'home.html'), encoding='utf-8').read()
    page = page.replace('{cards}', '\n'.join(cards)).replace('{gathering}', '\n'.join(gath)).replace('{compiled}', '18 Oct 2026')
    open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(page)
    s = open(os.path.join(ROOT, 'shared', 'site.js'), encoding='utf-8').read()
    start, end = s.index('const SITE = ['), s.index('];', s.index('const SITE = [')) + 2
    body = 'const SITE = [\n' + ''.join(f'  {json.dumps(x, ensure_ascii=False)},\n' for x in site) + '];'
    open(os.path.join(ROOT, 'shared', 'site.js'), 'w', encoding='utf-8').write(s[:start] + body + s[end:])
    print('index.html:', len(cards), 'classes')


if __name__ == '__main__':
    main()
