# Deterministic combat-balance audit

**Status:** source/runtime pass; human balance and input-feel review pending
**Scope:** all 23 chronological first clears, one rested replay of every encounter, and exact 1×/2×/4× replay schedules
**Authority:** `game/combat-balance-audit.mjs` and `game/tests/combat-balance-audit.test.mjs`

This is a bounded simulation audit, not a human timing run. It uses the shipped chronological advancement and loadout path, the same deterministic aggressive policy as canonical reachability, no items, no Dodge, no wall-clock waits, and no Storyworld-derived combat modifiers.

## Result

- First clears: 23/23 victories, 231 player commands, 98 enemy activations, zero party knockouts.
- Lowest surviving actor: 15.4545% HP in `fp1-cedar-path`; the checked lower bound is 10%.
- Highest command load: 55 in `c9-kurozane`; its 37 Guard commands are a 67.2727% Spirit-recovery share under the deliberately aggressive policy, below the 75% audit ceiling.
- Replays: all 23 victories, 608 policy steps total, 353,880 ms of schedule-only 1× presentation, and exact decision/reward identity at 1×/2×/4×.
- Longest replay schedule: `c9-kurozane`, 111 steps and 53,800/26,900/13,450 ms at 1×/2×/4×, below the 125-step and 60,000 ms bounds.
- Kurozane now exercises all four authored skills (`Court Command`, `Yearless Thrust`, `Blood Eclipse`, and `Black Chrysanthemum`) and all authored 1/2/3-pulse Recovery bands during the canonical trace.
- Audit violations after tuning: zero.

## Evidence-backed corrections

Before this pass, the aggressive chronological solver cleared `fp1-cedar-path` with one party member at 0 HP: 18 enemy activations, 150 party damage, and a 0% minimum survivor ratio. The teaching encounter is intended to permit a calculated hit, not silently require a casualty. Cinder Hound actor power changed from 14 to 10, Cinder Lunge from 13 to 10, and Ash Bite from 11 to 8. The resulting trace retains both 1- and 2-pulse enemy Recovery reads and remains the hardest survivor-margin check: 17 enemy activations, 119 party damage, zero knockouts, and 15.4545% minimum HP.

Before this pass, Kurozane's generic first-in-range selection repeated only zero-power `Court Command`: 13 activations, 13 party damage, and none of the phase-specific Recovery grammar. The engine now selects a deterministic boss-phase kit: Court Command/Yearless Thrust alternate in `court`, Blood Eclipse owns `bell`, and Black Chrysanthemum owns `dawn`, with an ordinary legal-skill fallback. The new canonical trace uses all four skills, deals 141 party damage over nine activations, leaves the lowest member at 80.2198%, and exposes authored Recovery 1/2/3. Storyworld records remain encounter-briefing presentation only and never participate in this selection.

## Per-encounter receipt

| Encounter | Commands | Enemy acts | Minimum HP | KOs | Guards | Replay steps | Replay 1× ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `prologue-ashen-bailiff` | 3 | 4 | 33.6% | 0 | 0 | 16 | 10,680 |
| `c1-cinder-hounds` | 8 | 13 | 19.1% | 0 | 0 | 34 | 22,200 |
| `c1-ash-wisps` | 4 | 3 | 43.8% | 0 | 0 | 19 | 11,800 |
| `c1-tithe-hound` | 15 | 5 | 35.9% | 0 | 4 | 48 | 29,000 |
| `fp1-cedar-path` | 8 | 17 | 15.5% | 0 | 0 | 42 | 29,000 |
| `fp1-flooded-archive` | 9 | 10 | 43.6% | 0 | 0 | 35 | 19,400 |
| `fp1-mateus` | 5 | 3 | 78.5% | 0 | 0 | 17 | 10,760 |
| `c3-dock-patrol` | 2 | 2 | 100.0% | 0 | 0 | 4 | 4,760 |
| `c3-captain-kaji` | 22 | 4 | 40.3% | 0 | 8 | 53 | 26,200 |
| `c4-fog-nets` | 3 | 3 | 91.4% | 0 | 0 | 6 | 6,040 |
| `c4-widow-of-fog` | 18 | 3 | 81.6% | 0 | 4 | 53 | 23,560 |
| `c5-ashen-release` | 1 | 1 | 100.0% | 0 | 0 | 2 | 3,480 |
| `c5-furnace-abbot` | 28 | 3 | 62.9% | 0 | 17 | 56 | 30,360 |
| `c6-masked-clerks` | 11 | 4 | 99.6% | 0 | 3 | 26 | 14,680 |
| `c6-ujiro` | 4 | 1 | 99.6% | 0 | 0 | 5 | 4,920 |
| `c7-name-slip-release` | 2 | 2 | 100.0% | 0 | 0 | 11 | 6,360 |
| `c7-bell-warden-chiyo` | 3 | 1 | 93.9% | 0 | 0 | 4 | 4,440 |
| `c8-outer-court` | 2 | 3 | 100.0% | 0 | 0 | 5 | 5,560 |
| `c8-lady-enma` | 17 | 3 | 92.2% | 0 | 6 | 44 | 21,240 |
| `c9-archive-nodes` | 3 | 2 | 100.0% | 0 | 0 | 5 | 5,240 |
| `c9-yearless-bell` | 4 | 1 | 94.9% | 0 | 0 | 5 | 4,920 |
| `c9-kurozane` | 55 | 9 | 80.2% | 0 | 37 | 111 | 53,800 |
| `epilogue-memorial-walk` | 4 | 0 | 100.0% | 0 | 0 | 4 | 4,120 |

## Interpretation limits

The policy is intentionally aggressive, deterministic, Item-free, and Dodge-free. Its low Cedar Path margin is a useful pressure bound, not proof that an unfamiliar player understands the telegraphs. Conversely, late objective encounters with 94–100% minimum HP and Kurozane's 80.2% minimum HP may feel too easy to a skilled human even though their mechanics and recovery cadences execute correctly. The audit cannot judge target-selection clarity, whether Guard-heavy Spirit recovery feels repetitive, controller latency, animation readability, emotional boss pacing, build diversity, accessibility, or whether a player discovers elemental counterplay without solver knowledge. Those require bounded human combat sessions, but no human timing run was performed here.

## Reproduction

From `game/`:

```powershell
node --test tests/combat-balance-audit.test.mjs tests/battle-solvability.test.mjs tests/repeat-battle.test.mjs tests/boss-phase-contract.test.mjs tests/combat-status.test.mjs
npm run check
```

The canonical receipt changes are intentional: 98 enemy activations and signature `fnv1a32:462b7ff8`. Updated low/reference/high projections are 188.936/312.481/504.237 canonical-only minutes, 225.645/396.929/697.827 canonical-plus-quest/chronicle minutes, and 779.587/1,236.311/1,924.351 all-finite minutes. The narrative-plus-Storyworld reference is 330.726 minutes after the Lady Enma spool. None is observed duration evidence.
