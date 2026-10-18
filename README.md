# aion2-planner

Interactive levelling planners for AION 2 (Global). Exact skill point spends, Daevanion crystal routes and stigma plans, level by level, with the in-game icons and node frames.

## Planners

| Class | Path | Build |
|---|---|---|
| Sorcerer | [`sorcerer-planner/`](sorcerer-planner/index.html) | PvE Hellfire, levels 1-45 |

## Run it

It is a static page with no build step. Open `sorcerer-planner/index.html` in a browser, or serve the folder:

```bash
python -m http.server 8765 --directory sorcerer-planner
```

Progress (level, completed levels, owned Daevanion nodes, notes) is kept in the browser's local storage. The published Claude artifact version also saves it to your account.

## What is in the Sorcerer planner

- **Now**: the current level's skill point spends, what to hold back, new skills, Specialty picks and Daevanion nodes to buy.
- **Levels 1-45**: the whole route with per-level points, crystals and unlocks.
- **Skills**: every active, passive and stigma skill with cooldowns, MP and Specialty picks.
- **Daevanion**: the five boards with numbered routes, a crystal schedule while levelling, and the route after 45.
- **Build at 45**, **Stigmas**, **Macro**: the reset order for 383 points, stigma plan, and the boss and trash macro setups.

## Data and sources

Compiled 18 Oct 2026 for the Global launch build. The levelling stepper, 45 build, stigma plan, macro and Daevanion routes follow [Aion 2 Maps](https://aion2maps.com/guides/sorcerer/). Skill data and icons come from [Metabot](https://metabot.gg/en/aion-2/skills), board layouts and node frames from [Wikily](https://wikily.gg/aion-2/daevanion/sorcerer/nezekan), and per-level point tables from [Fextralife](https://aion2.wiki.fextralife.com/Level_Progression) and [Questlog](https://questlog.gg/aion-2/en/table/character-levels). Numbers can change with patches; the in-game tooltip wins.

## License and attribution

The code and text are [MIT licensed](LICENSE).

The skill icons and Daevanion node frames are game art owned by NCSOFT Corporation and are not covered by the MIT license. [NOTICE.md](NOTICE.md) lists each asset, who owns it and where it came from (Metabot and Wikily), along with the data sources.

Unofficial fan tool, not affiliated with or endorsed by NCSOFT. AION is a trademark of NCSOFT Corporation.
