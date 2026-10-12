# Action-combat full-route playthrough receipt

**Date:** 2026-10-12

**Build:** `integrate/art-and-fixes` at `05602d2`

**Status:** a fresh New Game reaches Story complete and the Credits page with canonical side-view action combat. The Credits seal stays closed at the five-hour narrative floor, as designed. This is reachability evidence, not human timing, comprehension, or enjoyment.

## Command

```powershell
python tools/browser-route-playthrough.py --max-scenes 100 --max-seconds 10800 --max-action-restarts 3 --require-complete --evidence-out <path> --recovery-out <path>
```

The driver started from the rendered New Game control, used installed Chrome headless, and changed the game only through rendered controls. It returned `credits-seal-gate` after Credits reported `Story complete · 00:14:20` with 04:45:39 of the five-hour floor remaining. The runner does not synthesize playtime, so the schema-v3 evidence export did not run.

## Result

| Measure | Value |
| --- | --- |
| Elapsed wall time | 1,174 s |
| Recorded active time at Credits | 00:14:20 |
| Scene transitions | 54 |
| Field moves | 2,414 |
| Action battles | 21 |
| Action-battle restarts | 1 (Bell Warden Chiyo) |
| Median / longest battle | 12.1 s / 37.2 s |
| Lowest surviving fighter HP | 33.6% |
| Console, page, and HTTP errors | none |

| Encounter | Seconds | Restarts |
| --- | ---: | ---: |
| Ashen Bailiff — River Escape | 12.1 | 0 |
| Flooded Cedars — Cinder Hounds | 18.7 | 0 |
| Flooded Cedars — Ash Wisps | 9.4 | 0 |
| Tithe Hound | 24.1 | 0 |
| Cedar Service Path — Cinder Hounds and Ash Wisp | 10.4 | 0 |
| Flooded Archive — Tithe Enforcer and Bell Moths | 12.6 | 0 |
| Father Mateus Avelar | 24.0 | 0 |
| Bound Ashen Oni — Name Release | 6.5 | 0 |
| Furnace Abbot | 13.0 | 0 |
| Magistrate Ujiro Arata | 24.0 | 0 |
| Cinder Fan Above the Archive — Second Mask | 10.4 | 0 |
| The Cinder Fan at Rain Docks — First Mask | 8.2 | 0 |
| Captain Kaji | 9.2 | 0 |
| Hushroad Name-Slip Release | 9.0 | 0 |
| Bell Warden Chiyo | 37.2 | 1 |
| Outer Court Lantern Breach | 8.3 | 0 |
| Lady Enma of Ash — Last Mask | 18.3 | 0 |
| Kurohana Archive Node Release | 11.2 | 0 |
| Yearless Bell | 17.1 | 0 |
| Shogun Kurozane, the Black Chrysanthemum | 22.4 | 0 |
| Memorial Walk — Open Archive | 7.9 | 0 |

## Defects found and fixed on the way

The first attempt stopped at Ujiro with the party near full health. Each later stop exposed one side-view conversion or guidance defect:

| Where | Defect | Fix |
| --- | --- | --- |
| Ujiro | Seizure Order became a 768 px ring, every enemy hitbox chipped print blocks, and the chase AI cast Seizure Order whenever ready; two blocks fell in about six seconds. | Authored objective-damage skills alone damage protected objects, hitting their authored count of nearest targets; a `canBeginAttack` kernel hook enforces "Seizure Order when a print block is below 2 HP"; the encounter also requires Ujiro to be subdued, matching the tactical contract. |
| Any bound fighter | The status read "FREE MOVEMENT · BOUND". | It reads "BOUND · ATTACK TO BREAK FREE"; party rows expose `data-statuses`. |
| Rain Docks | Witnesses trailed 34 px behind the fighter on the facing side, and Rain Mirror Step's radius-1 cross became a 512 px ring; both witnesses fell in about four seconds. | Escorts shelter 110 px behind the fighter away from the nearest hostile, hold position near hostiles, and gain 1.2 s of hit invulnerability; caster-centred rings and crosses use their authored radius. |
| Hushroad release | The carried slip counted from spawn, so the fight resolved in 0.24 s. | The return requires a `take-item` interaction at the authored item source. |
| Bell Warden Chiyo | Ringing Count fired on every activation, landing the fourth count in about eleven seconds. | It rings every second activation, as authored. |
| Ujiro's Last Ledger | The next-step field target followed one prerequisite by id only, so the two-prisoner chain published nothing. | The resolver walks the whole chain and matches ids or result flags. |
| Yearless Bell | The invulnerable bell chased the party, its ring always struck the archive core, and the north node floated beyond every jump. | Phase objects hold station; a fighter in a protected object's lane shields it from stray hits; the north node sits within jump-attack reach, with a geometry check over every stage. |

The rendered-route driver also learned to hold casts for their published duration, climb with grounded rising maneuvers, break binds by attacking, free every chained token before escorting, stand within objective anchors, and strike raised objects with jump attacks.

## Still open

- A clean-start human route with chapter timing notes, per the [human playtest protocol](19-human-playtest-protocol.md).
- The blind opening playtest in [doc 28](28-opening-slice-blind-playtest.md).
- Human readability review of the new field tiles, props, stage backdrops, objective sprites, and enemy art, plus the external cultural review.
- Balance by feel: the Cinder Fan's Second Mask can end in about ten seconds through its weak point, and Chiyo remains the tightest fight.
