# aion2-planner

Interactive levelling planners for AION 2 (Global). Exact skill point spends, Daevanion crystal routes and stigma plans, level by level, with the in-game icons and node frames, for all eight classes. Also an Essence Extraction guide for levelling gathering proficiency.

**Live site: https://austinsc.github.io/aion2-planner/**

## Planners

Open [`index.html`](index.html) for the menu. Every page also has a menu bar along the top that links to the others.

| Class | Path | Build |
|---|---|---|
| Gladiator | [`gladiator-planner/`](gladiator-planner/index.html) | PvE Overhead Slam, levels 1-45 |
| Templar | [`templar-planner/`](templar-planner/index.html) | PvE Judgment tank, levels 1-45 |
| Assassin | [`assassin-planner/`](assassin-planner/index.html) | PvE Heart Gore, levels 1-45 |
| Ranger | [`ranger-planner/`](ranger-planner/index.html) | PvE Deadshot, levels 1-45 |
| Sorcerer | [`sorcerer-planner/`](sorcerer-planner/index.html) | PvE Hellfire, levels 1-45 |
| Spiritmaster | [`spiritmaster-planner/`](spiritmaster-planner/index.html) | PvE Elemental Fusion, levels 1-45 |
| Cleric | [`cleric-planner/`](cleric-planner/index.html) | PvE Condemnation, levels 1-45 |
| Chanter | [`chanter-planner/`](chanter-planner/index.html) | PvE Dark Crush, levels 1-45 |

| Guide | Path | What |
|---|---|---|
| Macro Guide | [`macros/`](macros/index.html) | How the in-game skill macro and basic-attack cancelling work, setting it up step by step, what goes in it, fixes, and every class's boss setup |
| Crafting | [`crafting/`](crafting/index.html) | The five crafts: proficiency 1-100 with each craft tracked separately, what unlocks when, success rates, the Dragon Lord gear ladder to item level 102, materials, and what alts need |
| Essence Extraction | [`essence-extraction/`](essence-extraction/index.html) | Gathering proficiency 1-100: route, spots per faction, Professional test, skill points |

## Run it

The site is static, with no build step to view it. Serve the repository root and open the menu:

```bash
python -m http.server 8765
# then open http://localhost:8765/
```

Opening `index.html` straight from disk also works. Progress (level, completed levels, owned Daevanion nodes, notes; proficiency, faction and main material on the gathering page) is kept in the browser's local storage, separately for each page. The published Claude artifact version also saves it to your account.

## What is in each class planner

- **Now**: the current level's skill point spends, what to hold back, new skills, Specialty picks and Daevanion nodes to buy. Every skill's level is shown as the points you assign plus the Daevanion skill nodes, which is the level the game displays, with a switch between the planned nodes and the ones you marked owned.
- **Levels 1-45**: the whole route with per-level points, crystals and unlocks.
- **Skills**: every active, passive and stigma skill with cooldowns, MP and Specialty picks.
- **Daevanion**: the five boards with numbered routes, a crystal schedule while levelling, and the route after 45.
- **Build at 45**, **Stigmas**, **Macro**: the reset order for 383 points, stigma plan, and the boss and trash macro setups.
- **Arcana**: the five cards to keep at 45, each with its version (set), Pantheon stat and the skill lines to aim for, plus the set bonuses they give, the alternatives players use, and how cards level and craft.
- **Stones**: which Manastone lines to keep and what to fill the rest with, which Theostone to engrave for dungeons and for PvP, what the top 100 players of the class run, all 51 Theostones with their chances and damage, an odds calculator for Manastone rolls, and how to get and combine stones.

## What is in the Essence Extraction planner

- **Now**: your proficiency, XP to the next level, to 50 and to 100 (with a rough attempt count), what to gather and where for your faction, and the skill points to spend at this proficiency.
- **Route**: the fastest route in three stages (Novice 1-50, the Professional test at 50, Professional 51-100), the densest spots for both factions, and mistakes that cost XP.
- **Proficiency 1-100**: the XP table with the points each level gives and what to buy.
- **Skill points**: the Common skills (Proficient Handling, Delicate Touch, Lady Luck) and the Specialty trees, with a plan for your main material.
- **Materials**: every material on your faction's map, with gauge size, node count and what it crafts.

## Hosting

The site is published on GitHub Pages from the `gh-pages` branch. [`.github/workflows/pages.yml`](.github/workflows/pages.yml) rebuilds that branch on every push to `main`: `tools/build_site.sh` copies the menu, `shared/`, every planner folder, `macros/`, `crafting/` and `essence-extraction/` into `_site/` and adds `.nojekyll`, and the workflow pushes it to `gh-pages`. You can also run it by hand from the Actions tab.

## How it is built

`shared/` holds the planner engine, styles, node frames and the site menu. Each class folder has a generated `data.js`, its icons and a page shell. The level steps, skill levels, Daevanion routes and crystal schedule are generated from the sources by the scripts in [`tools/`](tools/README.md). The written parts (skill roles, notes, Stigma plan, macro cards) are in `classes/<class>.guide.json`. The Essence Extraction and Crafting data are compiled by hand in `essence-extraction/data.js` and `crafting/data.js`. The Macro Guide is `tools/templates/macros.html`; `python3 tools/render_macros.py` fills in each class's setup from the guide files and writes `macros/index.html`.

## Data and sources

Compiled 18 Oct 2026 for the Global launch build. The levelling steppers, 45 builds, stigma plans, macros and Daevanion routes follow the [Aion 2 Maps class guides](https://aion2maps.com/guides/classes/). Skill data and icons come from [Metabot](https://metabot.gg/en/aion-2/skills), board layouts and node frames from [Wikily](https://wikily.gg/aion-2/daevanion/sorcerer/nezekan), and per-level point tables from [Fextralife](https://aion2.wiki.fextralife.com/Level_Progression) and [Questlog](https://questlog.gg/aion-2/en/table/character-levels). Essence Extraction data comes from Questlog's client data, Wikily, Metabot, Aion 2 Maps, AION2 Vault and the guides listed on its Sources tab. Numbers can change with patches; the in-game tooltip wins.

## License and attribution

The code and text are [MIT licensed](LICENSE).

The skill icons and Daevanion node frames are game art owned by NCSOFT Corporation and are not covered by the MIT license. [NOTICE.md](NOTICE.md) lists each asset, who owns it and where it came from (Metabot and Wikily), along with the data sources.

Unofficial fan tool, not affiliated with or endorsed by NCSOFT. AION is a trademark of NCSOFT Corporation.
