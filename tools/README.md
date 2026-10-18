# Building the class planners

Each `<class>-planner/` page is a static shell (`index.html`) plus a generated `data.js`. The shared engine and styles are in `shared/`. To rebuild:

```bash
python3 tools/build_class.py <class>   # fetch + parse sources -> tools/out/<class>.auto.json
python3 tools/notes_dump.py <class>    # optional: source sections as text -> tools/out/<class>.notes.md
python3 tools/render.py <class>        # merge with classes/<class>.guide.json -> <class>-planner/data.js and index.html
```

Fetched pages are cached in `tools/cache/` (git-ignored); delete a file there to refetch it.

## What is generated

`build_class.py` reads the class guide on [Aion 2 Maps](https://aion2maps.com/guides/) and the [Metabot skill list](https://metabot.gg/en/aion-2/skills):

- **Level steps**: new skills, skill point spends (from the stepper's per-level skill levels and the point cost table), keep notes, Specialty picks, board openings and Stigma slots.
- **Skills**: kind, unlock level, cooldown, MP, range, icon id, level at 45 (from the 45 build table).
- **Daevanion boards**: every node with its grade, cost and route phase; each numbered target's route is the cheapest connected path from the nodes already owned. A phase's leftover route nodes join its last numbered step, or form a "Filler nodes" step when the phase has no target on that board.
- **Crystal schedule while levelling**: each board's while-levelling steps are bought as soon as the crystals allow (4 a level from 12). A board's first two targets go ahead of older boards' remaining ones; otherwise older boards first, in step order.
- **45 build**: the skill points table, in order.

## The guide file

`classes/<class>.guide.json` holds what is written by hand. `classes/sorcerer.guide.json` is the reference example.

| Key | What |
|---|---|
| `meta` | `cls`, `name`, `title`, `sub` (header line), `build` (short build name), `brandIcon` (a skill icon id), `blurb` (one line for the menu), optional `storageKey` and `dbDoc` (progress storage names; default `<cls>-planner` and `progress-<cls>`) |
| `phases` | Four labels for the crystal phases: while levelling, quests and dungeons, Nightmare shop, Festival Shop, each with its crystal total |
| `text` | Notes: `levels`, `schedule`, `buildSub`, `build`, `passives`, `specs`, `stigmaSub`, `stigma`, `src` |
| `skills` | Per skill name, fields to set or override: `role` (one line), `spec` (`"8"` levelling pick, `"45"` picks at 45, `"12"`/`"16"` later options), `elem`, `t45` |
| `steps` | Per level number, `keep` or `note` text to override |
| `plan` | Optional `[level, board, step]` list to replace the computed crystal schedule |
| `build45` | Optional rows `{order, skills, to, cum, alt?}` to replace the parsed 45 build |
| `stigmas` | `{name, slot, lvl, t45, why}` for the four slots (levels 22, 27, 32, 37) |
| `passives` | Passive skill names in the order to raise them |
| `macro` | Cards `{title, eyebrow?, h?, gold?, blocks}`; a block is `note {text}`, `keys {items: [{cap, skill or label, sub, macro?}]}`, `stacks {items: [{tag, small?, cells: [{skill, extra?}]}]}` (cells in firing order), `seq {items: [{skill?, label?, arrow?}]}`, `hand {items: [{skills, why}]}` or `fix {items: [{b, text}]}` |
| `sources` | `{url, title, what}` or `{links: [[url, title], ...], what}` |

`render.py` stops with an error if the guide names a skill the class does not have (in `hand` and `keys` blocks other names are allowed and shown as plain text).
