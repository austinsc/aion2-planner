"""Write macros/index.html: the macro guide, with each class's boss setup taken from its guide file."""
import html, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ORDER = ['gladiator', 'templar', 'assassin', 'ranger', 'sorcerer', 'spiritmaster', 'cleric', 'chanter']
e = html.escape


def card(cls):
    g = json.load(open(os.path.join(ROOT, 'classes', f'{cls}.guide.json')))
    data = open(os.path.join(ROOT, f'{cls}-planner', 'data.js'), encoding='utf-8').read()
    data = json.loads(data[data.index('{'):data.rindex('}') + 1])
    ids = {s['name']: s['id'] for s in data['skills']}
    m = g['meta']

    def ico(name):
        return f'<img src="../{cls}-planner/icons/{ids[name]}.webp" alt="">' if ids.get(name) else ''

    blocks = [b for c in g['macro'] for b in c['blocks']]
    keys = next((b['items'] for b in blocks if b['t'] == 'keys'), [])
    stacks = next((b['items'] for b in blocks if b['t'] == 'stacks'), [])
    def chip(k):
        cap = k['cap'].replace('Hold · ', '')
        if k.get('skill'):
            return f'<span class="chip">{e(cap)}: {ico(k["skill"])}<b>{e(k["skill"])}</b></span>'
        if k.get('macro') and 'macro' not in cap.lower():
            return f'<span class="chip">{e(cap)}: <b>the macro</b></span>'
        return f'<span class="chip"><b>{e(cap[0].upper() + cap[1:])}</b></span>'
    hold = ''.join(chip(k) for k in keys)
    n, lines = 0, []
    for st in stacks:
        cells = []
        for c in st['cells']:
            n += 1
            cells.append(f'<li><b>{n}</b>{ico(c["skill"])}{e(c["skill"])}</li>')
        lines.append(f'<div class="line"><span class="tag">{e(st["tag"])}</span><ol>{"".join(cells)}</ol></div>')
    return f'''      <article class="mc">
        <header><img src="../{cls}-planner/icons/{m['brandIcon']}.webp" alt=""><div><h3>{e(m['name'])}</h3><small>{e(m['build'])}</small></div></header>
        <div class="hold">{hold}</div>
        {''.join(lines)}
        <a class="pill go" href="../{cls}-planner/index.html#macro">Full setup →</a>
      </article>'''


def main():
    page = open(os.path.join(HERE, 'templates', 'macros.html'), encoding='utf-8').read()
    page = page.replace('{classes}', '\n'.join(card(c) for c in ORDER)).replace('{compiled}', '18 Oct 2026')
    os.makedirs(os.path.join(ROOT, 'macros'), exist_ok=True)
    open(os.path.join(ROOT, 'macros', 'index.html'), 'w', encoding='utf-8').write(page)
    print('macros/index.html written')


if __name__ == '__main__':
    main()
