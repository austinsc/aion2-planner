"""Merge tools/out/<class>.auto.json with classes/<class>.guide.json into <class>-planner/data.js.

python3 tools/render.py [class ...]   (default: every class with a guide file)
The guide may override any generated value: per-skill fields, per-level keep/note text,
the crystal schedule order, the 45 build rows, and it supplies the stigmas, passives,
written notes, macro cards and sources.
"""
import html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def merge(cls):
    auto = json.load(open(os.path.join(HERE, 'out', f'{cls}.auto.json')))
    g = json.load(open(os.path.join(ROOT, 'classes', f'{cls}.guide.json')))
    names = {s['name'] for s in auto['skills']}
    for name, over in g.get('skills', {}).items():
        if name not in names:
            raise SystemExit(f'{cls}: guide names unknown skill {name!r}')
        s = next(s for s in auto['skills'] if s['name'] == name)
        s.update(over)
    for lvl, over in g.get('steps', {}).items():
        auto['steps'][int(lvl) - 1].update(over)
    if 'plan' in g:
        byref = {(b['key'], s['n']): s for b in auto['boards'] for s in b['steps']}
        auto['plan'] = [{'lvl': lvl, 'board': k, 'n': n, 'label': byref[(k, n)]['label'], 'cost': byref[(k, n)]['cost'],
                         'nodes': byref[(k, n)]['nodes']} for lvl, k, n in g['plan']]
    if 'build45' in g:
        auto['build45'] = g['build45']
        for s in auto['skills']:
            rows = [r['to'] for r in g['build45'] if s['name'] in r['skills']]
            if rows and 't45' not in g.get('skills', {}).get(s['name'], {}):
                s['t45'] = max(rows)
    for r in auto['build45']:
        r.pop('raw', None)
    for b in auto['boards']:
        b.setdefault('way', '')
    for st in auto['steps']:
        st.pop('stig', None)
    data = {'meta': g['meta'], 'phases': g['phases'], 'text': g['text'], 'skills': auto['skills'], 'levels': auto['levels'],
            'steps': auto['steps'], 'boards': auto['boards'], 'plan': auto['plan'], 'later': auto['later'],
            'build45': auto['build45'], 'stigmas': g['stigmas'], 'passives': g['passives'], 'costTable': auto['costTable'],
            'macro': g['macro'], 'sources': g['sources'],
            'arcana': {'cards': auto.get('arcana', []), **g.get('arcana', {})}}
    bp = os.path.join(ROOT, 'classes', f'{cls}.builds.json')
    if os.path.exists(bp):
        data['builds'] = json.load(open(bp))
    for k in ('azphelPhases',):
        if k in g:
            data[k] = g[k]
    check(cls, data)
    return data


def check(cls, d):
    names = {s['name'] for s in d['skills']}
    bad = []
    for p in d['passives']:
        if p not in names: bad.append(('passive', p))
    for s in d['stigmas']:
        if s['name'] not in names: bad.append(('stigma', s['name']))
    for r in d['build45']:
        for s in r['skills']:
            if s not in names: bad.append(('build45', s))
    for c in d['macro']:
        for b in c['blocks']:
            for it in b.get('items', []):
                for s in [it.get('skill')] + it.get('skills', []) + [x.get('skill') for x in it.get('cells', [])]:
                    if s and s not in names and b['t'] not in ('hand', 'keys'):
                        bad.append(('macro ' + b['t'], s))
    B = d.get('builds')
    if B:
        from urllib.parse import urlparse
        for b in B['builds']:
            where = f"build {b.get('id')}"
            for k in ('id', 'name', 'mode', 'role', 'summary', 'sources'):
                if not b.get(k):
                    bad.append((where, 'missing ' + k))
            if b.get('mode') not in ('PvE', 'PvP', 'PvE and PvP'):
                bad.append((where, 'mode must be PvE, PvP or "PvE and PvP"'))
            for x in b.get('skills', []):
                if x['skill'] not in names: bad.append((where + ' skills', x['skill']))
            for x in b.get('specialties', []):
                if x['skill'] not in names: bad.append((where + ' specialties', x['skill']))
            for x in b.get('stigmas', []):
                if x['name'] not in names: bad.append((where + ' stigmas', x['name']))
            for x in b.get('passives', []):
                if x not in names: bad.append((where + ' passives', x))
            # The three sites must remain with the Global-only switch on, so Korea/Taiwan-only sources don't count.
            hosts = {urlparse(x['url']).netloc.replace('www.', '') for x in b.get('sources', []) if x.get('url') and not x.get('region')}
            if len(hosts) < 3:
                bad.append((where, f'needs sources from at least 3 different sites (not counting region ones), has {sorted(hosts)}'))
            for x in [b] + b.get('sources', []):
                if x.get('region') not in (None, 'KR', 'TW'):
                    bad.append((where, f"region must be KR or TW, not {x.get('region')!r}"))
        # Region markup in text: [kr]...[/kr] or [tw]...[/tw], not nested.
        def strings(o):
            if isinstance(o, dict): return [s for v in o.values() for s in strings(v)]
            if isinstance(o, list): return [s for v in o for s in strings(v)]
            return [o] if isinstance(o, str) else []
        for t in strings(B):
            rest = re.sub(r'\[(kr|tw)\][^\[]*?(?:\[(?!/?(?:kr|tw)\])[^\[]*?)*\[/\1\]', '', t)
            if re.search(r'\[/?(kr|tw)\]', rest):
                bad.append(('builds region markup', t[:80]))
    if bad:
        raise SystemExit(f'{cls}: problems {bad}')


def write(cls):
    d = merge(cls)
    out = os.path.join(ROOT, f'{cls}-planner', 'data.js')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write('/* Generated by tools/render.py from tools/build_class.py output and classes/' + cls + '.guide.json. */\n')
        f.write('const DATA = ' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n')
    m = d['meta']
    page = open(os.path.join(HERE, 'templates', 'class.html'), encoding='utf-8').read()
    for k in ('title', 'sub', 'brandIcon'):
        page = page.replace('{' + k + '}', html.escape(m[k]))
    page = page.replace('{description}', html.escape(f"{m['name']} levelling planner for AION 2 Global: {m['build']} build, skill points, Specialties, Daevanion crystals and Stigmas for every level from 1 to 45."))
    page = page.replace('{compiled}', html.escape(m.get('compiled', '18 Oct 2026')))
    with open(os.path.join(ROOT, f'{cls}-planner', 'index.html'), 'w', encoding='utf-8') as f:
        f.write(page)
    print(cls, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    classes = sys.argv[1:] or sorted(f.split('.')[0] for f in os.listdir(os.path.join(ROOT, 'classes')) if f.endswith('.guide.json'))
    for c in classes:
        write(c)
