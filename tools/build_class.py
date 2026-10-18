"""Turn the parsed sources into the DATA object a class planner renders.

python3 tools/build_class.py <class>  ->  tools/out/<class>.auto.json
The automatic parts (level steps, skill levels, boards, routes, crystal schedule, 45 build order)
come from here; the written parts (skill roles, notes, macro cards) live in classes/<class>.guide.json.
"""
import heapq, json, os, re, sys
import sources

HERE = os.path.dirname(os.path.abspath(__file__))
GRADE = {'dv-u': 'unique', 'dv-s': 'common', 'dv-a': 'legend', 'dv-p': 'rare', 'dv-start': 'start'}
COST = {1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 4, 8: 4, 9: 4}  # cost to go from level k to k+1
SHORT = json.load(open(os.path.join(HERE, 'stat_short.json')))


def board_key(name):
    return name.split()[0].lower()


def build_board(b, skills_by_name):
    key = board_key(b['name'])
    nodes = []
    for c in b['cells']:
        m = re.match(r'(.*) \((\d+) crystals?\)$', c['title'])
        label, cost = (m.group(1), int(m.group(2))) if m else (c['title'], 0)
        grade = GRADE[c['cls']]
        n = {'st': c['st'], 'label': label, 'cost': cost, 'n': c['n'], 'c': c['c'], 'r': c['r'],
             'id': f"{key}:{c['c']}-{c['r']}"}
        if grade == 'start':
            n.update(type='start', label='Start', short='', grade='start')
        elif c['cls'] in ('dv-a', 'dv-p'):
            sk = re.sub(r' \+\d+$', '', label)
            n.update(type='skill', skill=sk, icon=skills_by_name.get(sk, {}).get('id'), short='', grade=grade)
        else:
            stat = re.sub(r' [+−-][\d.,]+%?$', '', label)
            if stat not in SHORT:
                print('  no short name for stat:', stat, file=sys.stderr)
            n.update(type='stat', short=SHORT.get(stat, stat[:4].upper()), grade=grade)
        nodes.append(n)
    rows = max(n['r'] for n in nodes) + 1
    corners = {}
    for n in nodes:
        if n['grade'] == 'unique':
            stat = re.sub(r' [+−-][\d.,]+%?$', '', n['label'])
            corners[stat] = corners.get(stat, 0) + 1
    corner = ', '.join(f'{v}x {k}' for k, v in corners.items())
    opens = int(re.search(r'\d+', b['opens']).group(0))
    board = {'key': key, 'name': b['name'].split(' ')[0], 'cols': b['cols'], 'rows': rows, 'opens': opens,
             'corners': corner + (' (own crystal type, PvP only)' if key == 'azphel' else ''), 'nodes': nodes}
    board['steps'] = route(board, b['steps'])
    board['way'] = b['way'].replace('On the way, as steps only: ', '')
    return board


def route(board, listed):
    """Cheapest connected path to each numbered target, in order; a phase's leftover route nodes join its last step."""
    byid = {n['id']: n for n in board['nodes']}
    at = {(n['c'], n['r']): n for n in board['nodes']}
    owned = {n['id'] for n in board['nodes'] if n['type'] == 'start'}
    targets = {n['n']: n for n in board['nodes'] if n['n']}
    steps = []

    def filler(below):
        for p in range(4):
            if p >= below or any(x['phase'] == p for x in steps):
                continue
            rest = sorted((n for n in board['nodes'] if n['st'] == p and n['id'] not in owned), key=lambda n: (n['r'], n['c']))
            if rest:
                owned.update(n['id'] for n in rest)
                steps.append({'n': None, 'label': 'Filler stat nodes' if all(n['type'] == 'stat' for n in rest) else 'Filler nodes',
                              'phase': p, 'nodes': [n['id'] for n in rest], 'cost': sum(n['cost'] for n in rest)})

    for i, ls in enumerate(listed):
        tgt = targets[ls['n']]
        ph = ls['st']
        filler(ph)
        allowed = {n['id'] for n in board['nodes'] if n['st'] is not None and n['st'] <= ph} | owned
        # Dijkstra from the owned set
        dist, prev, pq = {}, {}, []
        for o in owned:
            dist[o] = 0
            heapq.heappush(pq, (0, o))
        while pq:
            d, u = heapq.heappop(pq)
            if d > dist.get(u, 1e9):
                continue
            if u == tgt['id']:
                break
            un = byid[u]
            for dc, dr in ((0, 1), (1, 0), (0, -1), (-1, 0)):
                v = at.get((un['c'] + dc, un['r'] + dr))
                if not v or v['id'] not in allowed:
                    continue
                nd = d + (0 if v['id'] in owned else v['cost'])
                if nd < dist.get(v['id'], 1e9):
                    dist[v['id']] = nd
                    prev[v['id']] = u
                    heapq.heappush(pq, (nd, v['id']))
        path, u = [], tgt['id']
        if u not in dist:
            print(f"  {board['key']} step {ls['n']}: target not reachable on route nodes", file=sys.stderr)
            path = [u]
        else:
            while u not in owned:
                path.append(u)
                u = prev[u]
            path.reverse()
        owned |= set(path)
        last_of_phase = i + 1 == len(listed) or listed[i + 1]['st'] != ph
        if last_of_phase:
            rest = sorted((n for n in board['nodes'] if n['st'] == ph and n['id'] not in owned), key=lambda n: (n['r'], n['c']))
            path += [n['id'] for n in rest]
            owned |= {n['id'] for n in rest}
        steps.append({'n': ls['n'], 'label': ls['label'], 'phase': ph, 'nodes': path,
                      'cost': sum(byid[x]['cost'] for x in path)})
    filler(4)
    return steps


def schedule(boards, levels):
    """Buy each board's while-levelling steps as soon as the crystals allow.
    A board's first two targets go ahead of older boards' remaining ones (the guides take the main
    damage skills' nodes on every board as it opens); otherwise older boards first, in step order."""
    queue = {b['key']: [s for s in b['steps'] if s['phase'] == 0] for b in boards if b['key'] != 'azphel'}
    opens = {b['key']: b['opens'] for b in boards}
    spent, plan = 0, []
    for row in levels:
        L = row['lvl']
        while True:
            cand = [(k, q[0]) for k, q in queue.items() if q and opens[k] <= L]
            if not cand:
                break
            cand.sort(key=lambda kq: (0 if kq[1]['n'] <= 2 else 1, opens[kq[0]], kq[1]['n']))
            k, s = cand[0]
            if spent + s['cost'] > row['dv']:
                break
            spent += s['cost']
            queue[k].pop(0)
            plan.append({'lvl': L, 'board': k, 'n': s['n'], 'label': s['label'], 'cost': s['cost'], 'nodes': s['nodes']})
    left = [(k, s['n']) for k, q in queue.items() for s in q]
    if left:
        print('  not bought by 45:', left, file=sys.stderr)
    return plan


def later(boards, legend):
    titles = {1: 'District quests and sealed dungeons', 2: 'Nightmare shop crystals', 3: 'Festival Shop crystals'}
    totals = {st: int(re.search(r'\d+', small).group(0)) for st, b, small in legend[:4]}
    out = []
    for ph in (1, 2, 3):
        items = [{'board': b['key'], 'n': s['n'], 'label': s['label'], 'cost': s['cost'], 'nodes': s['nodes']}
                 for b in boards if b['key'] != 'azphel' for s in b['steps'] if s['phase'] == ph]
        if items:
            out.append({'phase': ph, 'title': f"{titles[ph]} (to {totals[ph]} crystals)", 'items': items,
                        'total': sum(i['cost'] for i in items)})
    return out, totals


def build(cls):
    a = sources.a2m_class(cls)
    mb = {s['name']: s for s in sources.metabot_skills()[cls]}
    levels = json.load(open(os.path.join(HERE, 'levels.json')))
    grid = a['grid']
    names = [g['name'] for g in grid]
    for g in grid:
        if g['name'] not in mb:
            print('  not in Metabot:', g['name'], file=sys.stderr)
    # skills: grid order (actives then passives), then stigmas from Metabot
    skills = []
    for g in grid:
        m = mb.get(g['name'], {})
        skills.append({'id': m.get('id'), 'name': g['name'], 'kind': g['kind'], 'learn': g['learn'],
                       'cd': m.get('cd', '') if g['kind'] == 'active' else '', 'range': m.get('range', '') if g['kind'] == 'active' else '',
                       'mp': m.get('mp', '') if g['kind'] == 'active' else '', 'elem': '', 'role': '', 'spec': {}, 't45': 1})
    for m in mb.values():
        if m['name'] not in names:
            skills.append({'id': m['id'], 'name': m['name'], 'kind': 'stigma' if m['kind'] == 'stigma' else m['kind'],
                           'learn': int(re.sub(r'\D', '', m['unlock']) or 22), 'cd': m['cd'], 'range': m['range'], 'mp': m['mp'],
                           'elem': '', 'role': '', 'spec': {}, 't45': 1})
    # steps
    steps = []
    for st in a['steps']:
        L = st['lvl']
        lv = {g['name']: g['seq'][L - 1] for g in grid if g['seq'][L - 1] > 0}
        alloc = []
        for i in st['up']:
            g = grid[i]
            x, y = max(1, g['seq'][L - 2] if L > 1 else 1), g['seq'][L - 1]
            alloc.append({'skill': g['name'], 'a': x, 'b': y, 'cost': sum(COST[k] for k in range(x, y))})
        pts = next((it['main'] for it in st['items'] if it['k'] == 'lv-pts'), '')
        alloc.sort(key=lambda x: pts.find(f"{x['skill']} {x['a']} →") % 10000)
        gained = levels[L - 1]['sp'] - (levels[L - 2]['sp'] if L > 1 else 0)
        keep, specs, notes, stig = '', [], [], []
        for it in st['items']:
            if it['k'] == 'lv-pts':
                keep = ' '.join(it['small'])
            elif it['k'] == 'lv-spec':
                sk = it['main'].split(' reaches ')[0]
                pick = it['q'][0] if it['q'] else it['main'].split('take ', 1)[-1]
                pick = pick.replace(f' [{sk}]', '').replace('−', '-')
                specs.append({'skill': sk, 'pick': pick})
            elif it['k'] == 'lv-board':
                notes.append(f"{it['b']} opens: start its levelling route")
            elif it['k'] == 'lv-stig':
                stig.append({'slot': it['b'], 'skill': it['main'], 'small': it['small']})
                notes.append(f"{it['b']}: {it['main']}")
            elif it['k'] == 'lv-end':
                notes.append('Azphel (PvP) board opens. Reset skills into the Build tab order')
            elif it['k'] in ('lv-new', ''):
                pass
            else:
                notes.append(f"{it['b']}: {it['main']}")
        steps.append({'lvl': L, 'new': [grid[i]['name'] for i in st['new']], 'alloc': alloc,
                      'spend': sum(x['cost'] for x in alloc), 'gained': gained, 'keep': keep, 'specs': specs,
                      'note': '. '.join(notes), 'stig': stig, 'levels': lv})
    for s in skills:
        g = next((g for g in grid if g['name'] == s['name']), None)
        if g:
            s['t45'] = g['seq'][44]
    byname = {s['name']: s for s in skills}
    boards = [build_board(b, byname) for b in a['boards']]
    plan = schedule(boards, levels)
    lat, totals = later(boards, a['dv_legend'])
    # 45 build from the skill-points table
    build45 = []
    tb = sources.tables(a['sections'].get('skill-points', ''))
    if tb:
        for row in tb[0][1:]:
            order, sk, to, cum = row[0][0], row[1], row[2][0], row[3][0]
            nm = [n for n in sources.skill_names(sk[1])]
            alt = ''
            if ', or ' in sk[0]:
                alt = 'or ' + sk[0].split(', or ', 1)[1]
                nm = [n for n in nm if n not in alt]
            r = {'order': int(re.sub(r'\D', '', order) or 0), 'skills': nm, 'to': int(re.sub(r'\D', '', to) or 0),
                 'cum': int(re.sub(r'\D', '', cum) or 0), 'raw': sk[0]}
            if alt:
                r['alt'] = alt
            build45.append(r)
    for s in skills:
        rows = [r['to'] for r in build45 if s['name'] in r['skills']]
        if rows:
            s['t45'] = max(rows)
    return {'cls': cls, 'skills': skills, 'levels': levels, 'steps': steps, 'boards': boards, 'plan': plan,
            'later': lat, 'phaseTotals': totals, 'build45': build45, 'costTable': COST, 'order': a['order']}


if __name__ == '__main__':
    cls = sys.argv[1]
    d = build(cls)
    os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
    json.dump(d, open(os.path.join(HERE, 'out', f'{cls}.auto.json'), 'w'), indent=1, ensure_ascii=False)
    print(cls, len(d['skills']), 'skills,', len(d['plan']), 'plan steps,', [len(b['steps']) for b in d['boards']])
