"""Write tools/out/<class>.notes.md: the source guide's sections as plain text, for writing the guide file."""
import os, re, sys, json
import sources

HERE = os.path.dirname(os.path.abspath(__file__))


def loadout(s):
    out = []
    fig = re.search(r'<figure class="loadout">(.*?)</figure>', s, flags=re.S)
    if not fig:
        return ''
    f = fig.group(1)
    for col in re.findall(r'<section class="lo-col[^"]*">(.*?)</section>', f, flags=re.S):
        for part in re.split(r'(?=<h4)', col):
            h = re.search(r'<h4[^>]*>(.*?)</h4>', part, flags=re.S)
            if not h:
                continue
            out.append(f"\n### {sources.text(h.group(1))}")
            for k in re.findall(r'<li class="lo-key">(.*?)</li>', part, flags=re.S):
                kb = sources.text(re.search(r'<kbd>(.*?)</kbd>', k, flags=re.S).group(1))
                sm = re.search(r'<small>(.*?)</small>', k, flags=re.S)
                out.append(f"- HOLD [{kb}]: {sources.text(sm.group(1)) if sm else ''}")
            for st in re.findall(r'<div class="lo-stack[^"]*">(.*?)</div>', part, flags=re.S):
                tag = re.search(r'<span class="lo-tag">(.*?)</span>', st)
                name = re.search(r'<span class="lo-name">(.*?)</span>', st)
                cells = []
                for c in re.findall(r'<li class="([^"]*)">(.*?)</li>', st, flags=re.S):
                    sm = re.search(r'<small>(.*?)</small>', c[1], flags=re.S)
                    nm = sources.text(re.sub(r'<small>.*?</small>', '', c[1], flags=re.S))
                    cells.append(nm + (' (fires first)' if 'lo-first' in c[0] else '') + (f' [{sources.text(sm.group(1))}]' if sm and 'fires first' not in sm.group(1) else ''))
                out.append(f"- STACK {sources.text(tag.group(1)) if tag else ''} / {sources.text(name.group(1)) if name else ''}: drawn top to bottom (bottom fires first): " + ' | '.join(cells))
            for li in re.findall(r'<ul class="lo-hand[^"]*">(.*?)</ul>', part, flags=re.S):
                for it in re.findall(r'<li>(.*?)</li>', li, flags=re.S):
                    b = re.search(r'<b>(.*?)</b>', it, flags=re.S)
                    sm = re.search(r'<small>(.*?)</small>', it, flags=re.S)
                    out.append(f"- {sources.text(b.group(1)) if b else ''}: {sources.text(sm.group(1)) if sm else ''}")
    note = re.search(r'<p class="ar-note">(.*?)</p>', f, flags=re.S)
    if note:
        out.append('\nFigure note: ' + sources.text_ev(note.group(1)))
    return '\n'.join(out)


def prose(s):
    s = re.sub(r'<figure class="loadout">.*?</figure>', '', s, flags=re.S)
    s = re.sub(r'<figure.*?</figure>', '[figure omitted]', s, flags=re.S)
    s = re.sub(r'</(p|li|tr|h\d)>', '\n', s)
    s = re.sub(r'<li>', '- ', s)
    s = re.sub(r'</t[dh]>', ' | ', s)
    return '\n'.join(l.strip() for l in sources.text_ev(s.replace('\n', '\x00')).split('\x00') if l.strip())


def dump(cls):
    a = sources.a2m_class(cls)
    auto = json.load(open(os.path.join(HERE, 'out', f'{cls}.auto.json')))
    o = [f'# {cls} — source notes (Aion 2 Maps, https://aion2maps.com/guides/{cls}/)\n',
         'Evidence tags in [brackets] are the source\'s own confidence labels.\n']
    o.append('## Level stepper (per level: new skills, skill point spends, keep notes, specialty picks, stigma slots)')
    for st in a['steps']:
        bits = []
        for it in st['items']:
            bits.append(f"{it['b']}: {it['main']}" + (f" ({'; '.join(it['small'])})" if it['small'] else ''))
        o.append(f"- L{st['lvl']}: " + ' || '.join(bits))
    o.append('\nWhere points go: ' + a['order'])
    o.append('\n## Skills (name, kind, learn level, level at 45 in the build, cooldown, MP, range — Metabot)')
    for s in auto['skills']:
        o.append(f"- {s['name']} [{s['kind']}] learn {s['learn']}, t45 {s['t45']}, cd {s['cd']}, mp {s['mp']}, range {s['range']}")
    o.append('\n## Daevanion route summary (numbered targets per board; phase 0 = while levelling, 1 = quest/dungeon crystals, 2 = Nightmare shop, 3 = Festival Shop)')
    for b in auto['boards']:
        o.append(f"- {b['name']} (opens {b['opens']}): " + '; '.join(f"{s['n']}. {s['label']} [ph{s['phase']}, {s['cost']} cr]" for s in b['steps']) + (f" — on the way: {b['way']}" if b['way'] else ''))
    o.append('\nCrystal schedule computed while levelling: ' + '; '.join(f"L{p['lvl']} {p['board']} #{p['n']} {p['label']} ({p['cost']})" for p in auto['plan']))
    for sid, s in a['sections'].items():
        o.append(f'\n## Section: {sid}\n')
        if sid == 'set-it-up':
            o.append(loadout(s))
        o.append(prose(s)[:12000])
    open(os.path.join(HERE, 'out', f'{cls}.notes.md'), 'w').write('\n'.join(o))


if __name__ == '__main__':
    for c in sys.argv[1:]:
        dump(c)
        print(c, os.path.getsize(os.path.join(HERE, 'out', f'{c}.notes.md')))
