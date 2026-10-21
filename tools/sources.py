"""Fetch and parse the source pages the class planners are built from.

Aion 2 Maps class guides give the level stepper, skill order, Daevanion boards and routes,
the 45 build, Stigmas and the macro layout; Metabot gives skill ids, cooldowns, MP and range.
Pages are cached in tools/cache/ so re-runs are offline.
"""
import html, json, os, re, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
CLASSES = ['gladiator', 'templar', 'assassin', 'ranger', 'sorcerer', 'spiritmaster', 'cleric', 'chanter']


def fetch(url, name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        subprocess.run(['curl', '-sSfL', '-m', '60', '-o', path, url], check=True)
    with open(path, encoding='utf-8') as f:
        return f.read()


def text(s):
    """Inner HTML to plain text: drop citations and evidence badges, keep words."""
    s = re.sub(r'<sup class="cite">.*?</sup>', '', s, flags=re.S)
    s = re.sub(r'<span class="ev[^"]*"><span class="ev-full">.*?</span></span>', '', s, flags=re.S)
    s = re.sub(r'<svg.*?</svg>', '', s, flags=re.S)
    s = re.sub(r'<br\s*/?>', ' ', s)
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


def text_ev(s):
    """Like text() but keeps evidence badges as [tags], for notes handed to writers."""
    s = re.sub(r'<span class="ev[^"]*"><span class="ev-full">(.*?)</span></span>', r' [\1]', s, flags=re.S)
    return text(s)


# ---------------- Metabot ----------------
def metabot_skills():
    t = fetch('https://metabot.gg/en/aion-2/skills', 'metabot-skills.html')
    out = {}
    heads = [(m.start(), text(m.group(1))) for m in re.finditer(r'<h[234][^>]*>(.*?)</h[234]>', t)]
    for i, (pos, h) in enumerate(heads):
        m = re.match(r'(\w+) skills$', h)
        if not m or m.group(1).lower() not in CLASSES:
            continue
        cls = m.group(1).lower()
        end = next((p for p, hh in heads[i + 1:] if re.match(r'\w+ skills$', hh) or hh.startswith('How AION')), len(t))
        chunk = t[pos:end]
        kinds = [(mm.start(), text(mm.group(1))) for mm in re.finditer(r'<h[234][^>]*>(.*?)</h[234]>', chunk)]
        rows = []
        for mm in re.finditer(r'<tr><th scope="row">(.*?)</tr>', chunk, flags=re.S):
            kind = [k for p, k in kinds if p < mm.start()][-1].split()[0].lower()
            r = mm.group(1)
            ic = re.search(r'skills%2F(\d+)\.webp', r)
            slug = re.search(r'href="/en/aion-2/skills/([^"]+)"', r)
            name = text(re.search(r'<span class="B32I9a_nameText">(.*?)</span>', r).group(1))
            tds = [text(x) for x in re.findall(r'<td[^>]*>(.*?)</td>', r, flags=re.S)]
            if kind == 'passive' and tds[1:2] and tds[1] not in ('', '\u2014'):
                kind = 'stigma'  # Metabot lists some stigmas under the passive heading; passives have no cooldown
            rows.append({'name': name, 'id': ic.group(1) if ic else None, 'slug': slug.group(1) if slug else None,
                         'kind': kind, 'unlock': tds[0] if tds else '', 'cd': tds[1] if len(tds) > 1 else '',
                         'range': tds[2] if len(tds) > 2 else '', 'mp': tds[3] if len(tds) > 3 else ''})
        out[cls] = rows
    return out


if __name__ == '__main__':
    ms = metabot_skills()
    for c, rows in ms.items():
        print(c, len(rows), [r['kind'] for r in rows].count('active'), [r['kind'] for r in rows].count('passive'), [r['kind'] for r in rows].count('stigma'))
    print(json.dumps(ms['sorcerer'][:3], indent=1))


# ---------------- Aion 2 Maps class guide ----------------
def section(t, start_id, end_id=None):
    i = t.find(f'id="{start_id}"')
    if i < 0:
        return ''
    if end_id:
        j = t.find(f'id="{end_id}"', i)
    else:
        m = re.compile(r'<h[23][^>]* id="').search(t, i + 10)
        j = m.start() if m else len(t)
    return t[i:j]


def tables(s):
    """Every <table> in s as a list of rows of (text, html) cells, header row first."""
    out = []
    for tb in re.findall(r'<table.*?</table>', s, flags=re.S):
        rows = []
        for tr in re.findall(r'<tr>(.*?)</tr>', tb, flags=re.S):
            rows.append([(text(c), c) for c in re.findall(r'<t[hd][^>]*>(.*?)</t[hd]>', tr, flags=re.S)])
        out.append(rows)
    return out


def skill_names(cell_html):
    """Bold skill names in a cell, in order."""
    return [text(b) for b in re.findall(r'<strong>(.*?)</strong>', cell_html, flags=re.S)]


def a2m_class(cls):
    t = fetch(f'https://aion2maps.com/guides/{cls}/', f'aion2maps-{cls}.html')
    d = {'cls': cls}
    # ---- level stepper
    fig = t[t.find('<figure class="lvplan'):]
    fig = fig[:fig.find('</figure>')]
    grid = []
    for m in re.finditer(r'<li class="lv-sk (lv-[ap])[^"]*" data-seq="([0-9a-f]+)" data-learn="(\d+)"><span>(.*?)</span>', fig):
        grid.append({'name': html.unescape(m.group(4)), 'kind': 'active' if m.group(1) == 'lv-a' else 'passive',
                     'seq': [int(c, 16) for c in m.group(2)], 'learn': int(m.group(3))})
    steps = []
    for m in re.finditer(r'<li class="lv-step[^"]*" data-lv="(\d+)" data-up="([\d,]*)" data-new="([\d,]*)">(.*?)</ul></li>', fig, flags=re.S):
        items = []
        for it in re.finditer(r'<li class="lv-i ?([a-z-]*)"><b>(.*?)</b><span>(.*?)</span></li>', m.group(4), flags=re.S):
            body = it.group(3)
            small = [text(x) for x in re.findall(r'<small>(.*?)</small>', body, flags=re.S)]
            main = text(re.sub(r'<small>.*?</small>', '', body, flags=re.S))
            q = [text(x) for x in re.findall(r'<q>(.*?)</q>', body, flags=re.S)]
            items.append({'k': it.group(1), 'b': text(it.group(2)), 'main': main, 'small': small, 'q': q})
        steps.append({'lvl': int(m.group(1)), 'up': [int(x) for x in m.group(2).split(',') if x],
                      'new': [int(x) for x in m.group(3).split(',') if x], 'items': items})
    order = re.search(r'<p class="lv-order"><b>Where points go</b>(.*?)</p>', t, flags=re.S)
    d.update(grid=grid, steps=steps, order=text(order.group(1)) if order else '')
    # ---- Daevanion boards
    dv = t[t.find('<figure class="daev"'):]
    dv = dv[:dv.find('</figure>')]
    legend = [(int(m.group(1)), text(m.group(2)), text(m.group(3))) for m in
              re.finditer(r'<li class="dv-k" data-st="(\d)"><i></i><b>(.*?)</b><small>(.*?)</small>', dv)]
    boards = []
    for bm in re.finditer(r'<section class="dv-board">(.*?)</section>', dv, flags=re.S):
        b = bm.group(1)
        h4 = re.search(r'<h4>(.*?)<small>(.*?)</small></h4>', b, flags=re.S)
        cols = int(re.search(r'--cols:(\d+)', b).group(1))
        cells = []
        for i, cm in enumerate(re.finditer(r'<i class="dv-(c [^"]*|gap)"([^>]*)>(.*?)</i>', b)):
            if cm.group(1) == 'gap':
                continue
            attrs = cm.group(2)
            st = re.search(r'data-st="(\d)"', attrs)
            title = html.unescape(re.search(r'title="([^"]*)"', attrs).group(1))
            cells.append({'c': i % cols, 'r': i // cols, 'cls': cm.group(1).split()[1],
                          'st': int(st.group(1)) if st else None, 'title': title,
                          'n': int(cm.group(3)) if cm.group(3).strip().isdigit() else None})
        lis, way = [], ''
        so = re.search(r'<ol class="dv-list">(.*?)</ol>', b, flags=re.S)
        if so:
            for li in re.finditer(r'<li data-st="(\d)"><b>(\d+)</b><span>(.*?)</span></li>', so.group(1)):
                lis.append({'n': int(li.group(2)), 'st': int(li.group(1)), 'label': text(li.group(3))})
            w = re.search(r'<li class="dv-steps"><span>(.*?)</span>', so.group(1))
            way = text(w.group(1)) if w else ''
        foot = [text(x) for x in re.findall(r'<p class="dv-cost">(.*?)</p>', b, flags=re.S)]
        boards.append({'name': text(h4.group(1)), 'opens': text(h4.group(2)), 'cols': cols, 'cells': cells,
                       'steps': lis, 'way': way, 'foot': foot})
    d.update(dv_legend=legend, boards=boards)
    # ---- tables and notes
    d['sections'] = {}
    for sid in ['levelling', 'specialties-while-levelling', 'while-questing', 'build', 'skill-points', 'specialties',
                'stigmas', 'passives', 'swaps', 'skill-levels-past-10', 'stigma-points', 'macro', 'set-it-up',
                'in-a-fight', 'tanking', 'daevanion', 'stats', 'arcana', 'pvp', 'how-it-fights']:
        s = section(t, sid)
        if s:
            d['sections'][sid] = s
    return d
