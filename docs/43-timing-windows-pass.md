# Timing-windows pass: readable tells, punish windows, discoverable interrupts

**Status:** implemented on `feature/timing-windows` from `main` at `a9b7add`. 1,361/1,361 tests and `npm run check` pass, and the rendered-control route from New Game reaches the intended `credits-seal-gate` with "Story complete" (resumed once from its own recovery export after a driver-policy block at Kurozane, fixed in the driver). Human feel review is still pending.

**Authority:** `game/action-encounter-adapter.mjs` (tell tiers, recovery, boss shared-cooldown floor, poise profiles), `game/action-combat.mjs` (leniency windows, input buffer, neutral poise chip, tell poise bonus), `game/action-campaign-battle-model.mjs` (buffered controller input), `game/action-battle-coaching.mjs` (interrupt copy). Tests: `action-timing-windows`, `action-combat-leniency`, plus updated `action-combat`, `action-enemy-ai`, `action-combat-pacing-audit`, `action-battle-coaching`. Table: `game/tools/timing-windows-table.mjs`. Route driver fixes: `game/tools/browser-route-playthrough.py`.

Before this pass every enemy wind-up was 220–360 ms (180 + 40 telegraph + 60 complex shape + min(80, range × 20)), recovery was 180–280 ms, and poise drained only during those wind-ups. A boss tell was over before most people could read it, and an interrupt needed four weapon hits inside it, so poise was effectively invisible.

## Tell tiers

Every enemy attack now takes its timing from `ACTION_ENEMY_TELL_TIERS`, chosen by the attacker's tier in that encounter and the attack's authored kit:

```text
wind-up  = base + committed (not dodgeable) + complex (cross, ring, marked tiles, lane endpoint) + min(cap, range × step)
recovery = recoveryBase + min(3, Recovery pulses) × perPulse + committed (not dodgeable)
```

| Class | Who | Wind-up base / committed / complex / range | Wind-ups now | Recovery base / per pulse / committed | Tell poise bonus |
| --- | --- | --- | ---: | --- | ---: |
| standard | ordinary enemies and summons | 380 / 40 / 20 / 5 per tile, cap 20 | 380–460 | 220 / 30 / 40 | 0 |
| elite | an encounter's named boss outside a boss format (Lady Enma at the Rain Docks and the archive), the immovable tutorial sentry | 500 / 40 / 20 / 10, cap 40 | 540–580 | 300 / 40 / 40 | +1 |
| boss | the primary enemy of a boss, boss-rescue, boss-phase, or final-boss encounter | 660 / 40 / 20 / 10, cap 40 | 680–760 | 360 / 60 / 40 | +1 |
| signature | a boss's Recovery-3 art; a boss with no Recovery-3 art and no command marks its highest-Recovery (2+) art | 880 / 40 / 20 / 10, cap 60 | 920–1,000 | 520 / 40 / 40 | +2 |
| command | a boss or elite order, summons, countdown, or objective seizure (`summons`, `countdownDelta`, `objectiveDamage`) | as signature | 920–1,000 | as signature | +2 |

Every authored enemy skill carries a telegraph, so not-dodgeable and complex shapes are what earn the longer end of a band. Active frames are unchanged (80–100 ms) and the hitbox still resolves once. Signature tells: Consume Ink, Crimson Litany, Crane Surge, Receding Call (highest Recovery), Forge Sermon, Cinder Parasol Wing, Yearless Ring (highest Recovery), Black Chrysanthemum. Command tells: Blood Ward, Seizure Order, Call Clerks, Ringing Count, Court Command, Mirror Writ. Masked clerks' Seize Copy stays standard: only boss and elite orders are commands.

Party animations are unchanged. The animation-foundation clips sample tells by phase-progress fraction, so a longer wind-up plays the same full tell clip more slowly.

## Punish windows

Recovery is the window in which the attacker cannot move. Boss recovery is now 360–520 ms for ordinary attacks (480+ for any Recovery-2 attack) and 600–680 ms after every signature or command tell, against 180–280 ms before.

The primary-boss shared-cooldown floor drops from 2,000 to 1,400 ms before level scaling. The old floor existed to keep 300 ms boss tells apart; with three-times-longer tells it made bosses act about a third less often. At 1,400 ms a boss's full cycle (wind-up, active, recovery, cooldown) is still longer than before for every boss attack (Tithe Hound Ledger Maul 2,400 → 2,510 ms, Black Chrysanthemum 1,840 → 2,550 ms), and recovery plus the level-adjusted floor keeps every boss's next tell at least 1.1 s after its previous strike (1,190 ms for Kurozane at level 40, the lowest). A test drives each boss's AI after a whiffed signature tell and confirms its next attack starts no sooner than recovery plus shared cooldown. Summons and companions of a boss (clerks, court clones) keep their own timers and can still act during its recovery.

## Poise and interrupts

| Profile | Poise | Neutral floor | Regen | Stagger |
| --- | ---: | ---: | --- | --- |
| Standard enemy | 2 | 1 | 1 per 600 ms after 1.8 s | 450 → 500 ms |
| Primary or named boss | 4 | 3 | 1 per 2.5 s after 3 s; refilled on every HP or objective phase change | 700 → 800 ms |

- **Neutral chip.** A damaging hit outside a wind-up now drains poise down to the profile's neutral floor and never breaks it, so the pips under an enemy react to every hit, not only to the rare hit inside a tell. Every neutral hit restarts the regen delay, so sustained pressure keeps an enemy primed. Actors without a `neutralFloor` keep the old contract (no neutral drain).
- **Tell bonus.** A hit during a wind-up deals its poise damage (weapon 1, Recovery-3 art 2, linked combo +1) plus that tell's `tellPoiseBonus`.
- **Maneuver strikes** (uppercut and dive variants) now drain one point. Before, a maneuver hit during a wind-up set poise to `NaN`, which made that enemy uninterruptible for the rest of the fight.

What breaks a boss (4 poise, floor 3):

| Boss state | Ordinary tell (+1) | Signature or command tell (+2) |
| --- | --- | --- |
| Fresh | weapon leaves 2, art leaves 1; any two hits break | weapon leaves 1; **one art breaks** |
| Primed by one neutral hit (3) | weapon leaves 1; **one art breaks** | **one weapon strike or one art breaks** |

Ujiro's authored orders (`interruptOnHit`) still break on any damaging hit. A standard enemy (2, floor 1, no bonus) breaks to one art in a tell, or to one weapon strike once a neutral hit has primed it.

The long tells make these windows human: an art's own wind-up is 220–240 ms, so an art pressed up to about 680–760 ms into a 920–1,000 ms signature tell still lands first (each earlier hit adds 100 ms of hit-stun to the tell). Tests check, for every poised boss: one art pressed 300 ms into any signature or command tell breaks it; the standard string (one weapon strike that punishes the boss in neutral, then one weapon strike 300 ms into its next signature or command tell) breaks it; a single weapon strike never breaks a fresh boss; one art cannot break a fresh boss's ordinary tell but breaks it after a neutral hit; repeated neutral hits stop at 3 and never stagger.

Discovery: poise pips now move on every hit, and the opening coaching names the read. The shared coaching adds "Hits drain the poise pips under an enemy; a hit during a glowing wind-up can break it and stagger the enemy." Ash Wisps ("Break the charge", authored as interruptible) coach breaking the charge with an art, and the Tithe Hound offers Cinder Route against Consume Ink's long wind-up.

## Player leniency

| Window | Before | After |
| --- | ---: | ---: |
| Coyote jump after leaving a ledge | 100 ms | 140 ms (`ACTION_COYOTE_WINDOW_MS`) |
| Landing jump buffer | 120 ms | 160 ms (`ACTION_JUMP_BUFFER_WINDOW_MS`) |
| Party post-hit invulnerability | 240 ms | 360 ms (`ACTION_PARTY_HIT_INVULNERABILITY_MS`); enemies keep 240 |
| Attack and maneuver input buffer | none | 160 ms (`ACTION_INPUT_BUFFER_WINDOW_MS`) |

The input buffer holds a controlled fighter's attack or maneuver press that is blocked only by timing (animation or maneuver commitment, shared or per-art cooldown, hit-stun) and starts it on the first fixed step it becomes legal. It never shortens a commitment or skips a cooldown, the latest press replaces an earlier one, a tag switch clears it, and a held dash that expires still reports "Dash unavailable". An attack still cooling down no longer cancels a cancellable dash. Enemy post-hit invulnerability stays at 240 ms so party damage and poise pressure are unchanged.

Dodge and Guard: action combat has no timed dodge or parry; avoiding a tell means leaving its published hitbox (walk, jump, dash, slide) before the active frame, and Guard is the armour stat. Those verbs gain the coyote, jump-buffer, and input-buffer windows above. The tactical rollback (`campaign.html?legacyBattle=1`, `campaign-combat.mjs`) is untouched: its Guard and Dodge remain pre-committed stance commands (Dodge evades the next dodgeable hit outright for one Recovery pulse; Guard reduces it), and `dodgeable: false` still means what it did there. In action combat the same flag now lengthens the tell by the tier's committed bonus.

## Timing contract

The doc 26 contract holds: animation commitment (wind-up, one active window, recovery) then post-animation cooldown; level scales cooldowns only (`levelAdjustedCooldownMs`), never animations; poise breaks are the only cancellation and still start the interrupted attack's cooldown; hit-stop and phase slow motion never edit a fixed step. The input buffer only decides on which fixed step a legal request begins. Every new window is a whole number of 20 ms steps, and a test replays buffered inputs, neutral chips, and tell bonuses twice with identical events and snapshots.

## Pressure check (deterministic harness)

To tune the boss floor and poise bonuses, a scratch harness (a simplified port of the route driver's action policy on the DOM-free campaign model: approach, use the highest ready attack, back off and dash when it notices a tell) played each fight six times: notice delays of 200, 300, and 400 ms, each at two decision cadences, chronological party floor, 90 s cap. It is a relative pressure gauge, not a human; it handles no escort, cast, or relay objectives, so those fights time out in both builds.

| Fight | Party damage per 10 s, before → after | Lowest surviving HP, before → after | Wins of 6, before → after | Interrupts, before → after |
| --- | ---: | ---: | ---: | ---: |
| Father Mateus | 119 → 60 | 6% → 54% | 6 → 6 | 0 → 19 |
| Captain Kaji | 133 → 94 | 21% → 43% | 6 → 6 | 4 → 12 |
| Widow-of-Fog | 166 → 75 | 18% → 44% | 6 → 6 | 1 → 12 |
| Furnace Abbot | 260 → 136 | 1% → 38% | 0 → 6 | 0 → 12 |
| Cinder Hounds | 160 → 50 | 1% → 8% | 1 → 2 | 2 → 5 |
| Ash Wisps | 135 → 116 | 5% → 16% | 5 → 6 | 0 → 1 |
| Cedar Service Path | 39 → 62 | 11% → 42% | 2 → 5 | 4 → 3 |
| Flooded Archive | 55 → 62 | 46% → 47% | 6 → 6 | 10 → 10 |

Bosses now deal about 45–71% of their old damage rate to a reader with a human-scale delay, and ordinary fights stay close to their old pressure (Cedar Path's rate rises because the fights are half as long and the bot now wins them). The floor was chosen with the same harness: keeping 2,000 ms (with +1 on signature tells) left bosses at 28–46% of their old rate, which reads as trivial; 1,600 ms gave 37–68%; 1,400 ms gives 45–71%.

## Per-encounter timing, before → after

Generated by `node tools/timing-windows-table.mjs` (from `game/`; `--json` for rows). "Before" re-derives the `a9b7add` adapter; "Next tell ≥" is recovery plus the level-adjusted shared cooldown (the soonest a new wind-up can begin after a strike), and "Cycle" is one full loop of that attack. Ring variants share their base attack's timing.

| Tell class | Wind-up ms (before → after) | Recovery ms (before → after) | Tell poise bonus |
| --- | ---: | ---: | ---: |
| standard (21) | 220–360 → 380–460 | 180–280 → 220–320 | 0 |
| elite (6) | 280–360 → 540–580 | 180–240 → 340–420 | 1 |
| boss (14) | 240–360 → 680–760 | 180–280 → 360–520 | 1 |
| signature (8) | 300–360 → 920–1000 | 180–280 → 640–680 | 2 |
| command (6) | 220–360 → 920–1000 | 220–280 → 600–680 | 2 |

Primary-boss shared cooldown floor: 2000 → 1400 ms before level scaling.

| Encounter | Enemy (tier, level) | Attack (class) | Wind-up ms | Active ms | Recovery ms | Next tell ≥ ms | Cycle ms | Tell poise bonus |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Ashen Bailiff — River Escape | Ashen Bailiff (elite, L2) | Census Sweep (elite) | 300 → 540 | 100 | 180 → 380 | 1365 → 1565 | 1765 → 2205 | no poise |
| Ashen Bailiff — River Escape | Ashen Bailiff (elite, L2) | Ash Step (elite, not dodgeable) | 300 → 580 | 100 | 220 → 380 | 1405 → 1565 | 1805 → 2245 | no poise |
| Flooded Cedars — Cinder Hounds | Cinder Hound (standard, L5) | Cinder Lunge (standard) | 280 → 400 | 100 | 180 → 260 | 636 → 716 | 1016 → 1216 | 0 |
| Flooded Cedars — Cinder Hounds | Cinder Hound (standard, L5) | Ash Bite (standard) | 240 → 380 | 80 | 180 → 220 | 636 → 676 | 956 → 1136 | 0 |
| Flooded Cedars — Ash Wisps | Ash Wisp (standard, L5) | Paper Ash Burst (standard, not dodgeable) | 360 → 460 | 100 | 280 → 320 | 774 → 814 | 1234 → 1374 | 0 |
| Tithe Hound | Tithe Hound (boss, L5) | Consume Ink (signature, not dodgeable) | 300 → 980 | 100 | 220 → 680 | 2120 → 2010 | 2520 → 3090 | 0 → 2 |
| Tithe Hound | Tithe Hound (boss, L5) | Ledger Maul (boss) | 240 → 680 | 80 | 180 → 420 | 2080 → 1750 | 2400 → 2510 | 0 → 1 |
| Cedar Service Path — Cinder Hounds and Ash Wisp | Cinder Hound (standard, L8) | Cinder Lunge (standard) | 280 → 400 | 100 | 180 → 260 | 764 → 844 | 1144 → 1344 | 0 |
| Cedar Service Path — Cinder Hounds and Ash Wisp | Cinder Hound (standard, L8) | Ash Bite (standard) | 240 → 380 | 80 | 180 → 220 | 764 → 804 | 1084 → 1264 | 0 |
| Cedar Service Path — Cinder Hounds and Ash Wisp | Ash Wisp (standard, L8) | Paper Ash Burst (standard, not dodgeable) | 360 → 460 | 100 | 280 → 320 | 901 → 941 | 1361 → 1501 | 0 |
| Flooded Archive — Tithe Enforcer and Bell Moths | Tithe Enforcer (standard, L8) | Shield Hook (standard) | 260 → 400 | 100 | 180 → 260 | 801 → 881 | 1161 → 1381 | 0 |
| Flooded Archive — Tithe Enforcer and Bell Moths | Tithe Enforcer (standard, L8) | Registry Guard (standard, not dodgeable) | 220 → 420 | 100 | 220 → 300 | 841 → 921 | 1161 → 1441 | 0 |
| Flooded Archive — Tithe Enforcer and Bell Moths | Bell Moth (standard, L8) | Bell Dust (standard, not dodgeable) | 300 → 440 | 100 | 220 → 320 | 768 → 868 | 1168 → 1408 | 0 |
| Father Mateus Avelar | Father Mateus Avelar (boss, L8) | Pale Cut (boss) | 240 → 680 | 80 | 180 → 360 | 2005 → 1638 | 2325 → 2398 | 0 → 1 |
| Father Mateus Avelar | Father Mateus Avelar (boss, L8) | Sanguine Step (boss, not dodgeable) | 360 → 760 | 100 | 280 → 460 | 2105 → 1738 | 2565 → 2598 | 0 → 1 |
| Father Mateus Avelar | Father Mateus Avelar (boss, L8) | Blood Ward (command, not dodgeable) | 220 → 920 | 100 | 220 → 600 | 2045 → 1878 | 2365 → 2898 | 0 → 2 |
| Father Mateus Avelar | Father Mateus Avelar (boss, L8) | Crimson Litany (signature, not dodgeable) | 300 → 960 | 100 | 220 → 680 | 2045 → 1958 | 2445 → 3018 | 0 → 2 |
| The Cinder Fan at Rain Docks — First Mask | Lady Enma of Ash — Rain Mask (elite, L12) | Cinder Fan Draw (elite) | 300 → 540 | 100 | 180 → 420 | 698 → 938 | 1098 → 1578 | 0 → 1 |
| The Cinder Fan at Rain Docks — First Mask | Lady Enma of Ash — Rain Mask (elite, L12) | Rain Mirror Step (elite) | 360 → 560 | 100 | 240 → 380 | 758 → 898 | 1218 → 1558 | 0 → 1 |
| The Cinder Fan at Rain Docks — First Mask | Dock Retainer (standard, L12) | Dock Hook (standard) | 300 → 400 | 100 | 180 → 280 | 732 → 832 | 1132 → 1332 | 0 |
| The Cinder Fan at Rain Docks — First Mask | Dock Retainer (standard, L12) | Baton Check (standard) | 240 → 380 | 80 | 180 → 220 | 732 → 772 | 1052 → 1232 | 0 |
| Captain Kaji | Captain Kaji (boss, L12) | Chain Haul (boss) | 300 → 700 | 100 | 180 → 480 | 1905 → 1688 | 2305 → 2488 | 0 → 1 |
| Captain Kaji | Captain Kaji (boss, L12) | Crane Surge (signature, not dodgeable) | 300 → 980 | 100 | 220 → 680 | 1945 → 1888 | 2345 → 2968 | 0 → 2 |
| Captain Kaji | Captain Kaji (boss, L12) | Salt Cut (boss) | 240 → 680 | 80 | 180 → 360 | 1905 → 1568 | 2225 → 2328 | 0 → 1 |
| Bell-Fog Nets | Fog Skimmer (standard, L16) | Cold Wake (standard, not dodgeable) | 280 → 440 | 100 | 220 → 300 | 740 → 820 | 1120 → 1360 | 0 |
| Widow-of-Fog | Widow-of-Fog (boss, L16) | Receding Call (signature, not dodgeable) | 360 → 980 | 100 | 280 → 640 | 1905 → 1778 | 2365 → 2858 | 0 → 2 |
| Widow-of-Fog | Widow-of-Fog (boss, L16) | Name Drag (boss, not dodgeable) | 300 → 740 | 100 | 220 → 460 | 1845 → 1598 | 2245 → 2438 | 0 → 1 |
| Bound Ashen Oni — Name Release | Bound Ashen Oni (standard, L20) | Ash Guard Swing (standard) | 240 → 380 | 80 | 180 → 280 | 439 → 539 | 759 → 999 | 0 |
| Furnace Abbot | Furnace Abbot (boss, L20) | Forge Sermon (signature, not dodgeable) | 360 → 1000 | 100 | 280 → 680 | 1805 → 1748 | 2265 → 2848 | 0 → 2 |
| Furnace Abbot | Furnace Abbot (boss, L20) | Hammer Decree (boss) | 260 → 680 | 100 | 180 → 420 | 1705 → 1488 | 2065 → 2268 | 0 → 1 |
| Cinder Fan Above the Archive — Second Mask | Lady Enma of Ash — Archive Mask (elite, L24) | Mirror Writ (command, not dodgeable) | 300 → 980 | 100 | 220 → 680 | 619 → 1079 | 1019 → 2159 | 0 → 2 |
| Cinder Fan Above the Archive — Second Mask | Lady Enma of Ash — Archive Mask (elite, L24) | Parasol Shear (elite) | 280 → 540 | 100 | 180 → 380 | 579 → 779 | 959 → 1419 | 0 → 1 |
| Cinder Fan Above the Archive — Second Mask | Lady Enma of Ash — Archive Mask (elite, L24) | Blood-Ink Step (elite) | 300 → 540 | 100 | 180 → 340 | 579 → 739 | 979 → 1379 | 0 → 1 |
| Cinder Fan Above the Archive — Second Mask | Masked Clerk (standard, L24) | Seize Copy (standard, not dodgeable) | 300 → 440 | 100 | 220 → 320 | 647 → 747 | 1047 → 1287 | 0 |
| Cinder Fan Above the Archive — Second Mask | Masked Clerk (standard, L24) | Seal Snap (standard) | 240 → 380 | 80 | 180 → 220 | 607 → 647 | 927 → 1107 | 0 |
| Magistrate Ujiro Arata | Magistrate Ujiro Arata (boss, L24) | Seizure Order (command, not dodgeable) | 360 → 1000 | 100 | 280 → 640 | 1705 → 1637 | 2165 → 2737 | 0 → 2 |
| Magistrate Ujiro Arata | Magistrate Ujiro Arata (boss, L24) | Call Clerks (command, not dodgeable) | 220 → 920 | 100 | 220 → 600 | 1645 → 1597 | 1965 → 2617 | 0 → 2 |
| Magistrate Ujiro Arata | Magistrate Ujiro Arata (boss, L24) | Gavel Line (boss) | 300 → 700 | 100 | 180 → 420 | 1605 → 1417 | 2005 → 2217 | 0 → 1 |
| Magistrate Ujiro Arata | Masked Clerk (standard, L24) | Seize Copy (standard, not dodgeable) | 300 → 440 | 100 | 220 → 320 | 434 → 534 | 834 → 1074 | 0 |
| Magistrate Ujiro Arata | Masked Clerk (standard, L24) | Seal Snap (standard) | 240 → 380 | 80 | 180 → 220 | 394 → 434 | 714 → 894 | 0 |
| Hushroad Name-Slip Release | Bound Ashen Patrol (standard, L29) | Chain Wall (standard) | 260 → 400 | 100 | 180 → 280 | 518 → 618 | 878 → 1118 | 0 |
| Bell Warden Chiyo | Bell Warden Chiyo (boss, L29) | Ringing Count (command, not dodgeable) | 220 → 920 | 100 | 220 → 640 | 1520 → 1550 | 1840 → 2570 | 0 → 2 |
| Bell Warden Chiyo | Bell Warden Chiyo (boss, L29) | Chain Cast (boss) | 300 → 700 | 100 | 180 → 420 | 1480 → 1330 | 1880 → 2130 | 0 → 1 |
| Bell Warden Chiyo | Bell Warden Chiyo (boss, L29) | Warden Bell (boss) | 260 → 680 | 100 | 180 → 420 | 1480 → 1330 | 1840 → 2110 | 0 → 1 |
| Outer Court Lantern Breach | Ashen Garrison (standard, L34) | Ash Lane Guard (standard, not dodgeable) | 280 → 440 | 100 | 220 → 300 | 596 → 676 | 976 → 1216 | 0 |
| Lady Enma of Ash — Last Mask | Lady Enma of Ash — Last Mask (boss, L34) | Paired Ashes (boss, not dodgeable) | 300 → 740 | 100 | 220 → 520 | 1395 → 1342 | 1795 → 2182 | 0 → 1 |
| Lady Enma of Ash — Last Mask | Lady Enma of Ash — Last Mask (boss, L34) | Abandonment Cry (boss, not dodgeable) | 300 → 740 | 100 | 220 → 460 | 1395 → 1282 | 1795 → 2122 | 0 → 1 |
| Lady Enma of Ash — Last Mask | Lady Enma of Ash — Last Mask (boss, L34) | Cinder Parasol Wing (signature) | 300 → 920 | 100 | 180 → 640 | 1355 → 1462 | 1755 → 2482 | 0 → 2 |
| Kurohana Archive Node Release | Archive Warden (standard, L40) | Catalogue Line (standard, not dodgeable) | 300 → 440 | 100 | 220 → 320 | 484 → 584 | 884 → 1124 | 0 |
| Yearless Bell | Yearless Bell (boss, L40) | Yearless Ring (signature, not dodgeable) | 360 → 980 | 100 | 280 → 640 | 1380 → 1410 | 1840 → 2490 | no poise |
| Shogun Kurozane, the Black Chrysanthemum | Shogun Kurozane (boss, L40) | Court Command (command, not dodgeable) | 360 → 1000 | 100 | 280 → 600 | 1380 → 1370 | 1840 → 2470 | 0 → 2 |
| Shogun Kurozane, the Black Chrysanthemum | Shogun Kurozane (boss, L40) | Blood Eclipse (boss, not dodgeable) | 360 → 760 | 100 | 280 → 520 | 1380 → 1290 | 1840 → 2150 | 0 → 1 |
| Shogun Kurozane, the Black Chrysanthemum | Shogun Kurozane (boss, L40) | Yearless Thrust (boss) | 300 → 700 | 100 | 180 → 420 | 1280 → 1190 | 1680 → 1990 | 0 → 1 |
| Shogun Kurozane, the Black Chrysanthemum | Shogun Kurozane (boss, L40) | Black Chrysanthemum (signature, not dodgeable) | 360 → 1000 | 100 | 280 → 680 | 1380 → 1450 | 1840 → 2550 | 0 → 2 |
| Shogun Kurozane, the Black Chrysanthemum | Court Clone (standard, L40) | Clone Order (standard, not dodgeable) | 280 → 440 | 100 | 220 → 300 | 385 → 465 | 765 → 1005 | 0 |

## Route comparison

Command (from `game/`): the doc 41 command, `--max-scenes 100 --max-seconds 10800 --max-action-restarts 3 --require-complete` with evidence and recovery exports, installed Chrome headless, rendered controls only. Baselines are doc 41 (21 battles, 1 restart, median 12.1 s, longest 37.2 s, lowest surviving fighter 33.6%) and doc 42's final run (1 restart, median 14.0 s wall / 12.6 s simulated, longest 59.9 s, lowest 29.0%).

The machine was saturated by unrelated jobs throughout (shell commands took minutes; several Python and Chrome workloads were running), so the attempts below were run in this order:

1. **New Game, default timeouts:** a Playwright page load timed out about 19 minutes in, and the driver's error handler crashed reading the stalled page, so no evidence or recovery export was written. Fixed in the driver (`safe_checkpoint`, one reload before the recovery return).
2. **New Game, default timeouts:** another load timeout about 13 minutes in; the recovery return then waited for an exact `campaign.html` URL while the battle's Leave link carries a query, and timed out without evidence. Fixed in the driver (path match, recovery-path timeouts recorded instead of raised).
3. **New Game, Playwright waits scaled ×4 by an external wrapper for this loaded machine** (as in doc 42; the driver's own timeouts are unchanged): 19 battles won with **0 restarts** from New Game through the Yearless Bell, then **blocked at Kurozane** (`action-battle-defeat`): four defeats; at the last, Nikola had 84% HP, Mateus 82%, and Kurozane 25%, so the archive core had fallen. Cause: with long tells the driver's step-back-and-dash fired on every poll for the whole wind-up, so it spent each tell running and left the core's protection lane open. Fixed in the driver (one step back per tell, hold an intact protected object's lane when one is within 160 px). The run exported its recovery checkpoint at the Kurozane scene (69/76 played).
4. **Resumed with `--recovery-in`** from attempt 3's export (same wrapper, fixed driver): Kurozane won after **1 restart**, the Memorial Walk followed, and the route ended at **`credits-seal-gate`, "Story complete · 00:37:25"**, with 04:22:34 left on the five-hour floor.

Across the 21 battles (attempt 3 plus the resume): **1 restart** (Kurozane, as in doc 42), median **17.2 s wall / 14.2 s simulated**, longest 222.1 s (Ujiro, see below), 20.7 s of hit-stop, **29 interrupts** (doc 42: 21), lowest surviving fighter **41.2%** (Cinder Hounds; doc 42: 29.0%, doc 41: 33.6%), and no console, page, or HTTP errors. No battle that won before blocked; the one new block was the driver policy at Kurozane, fixed and resumed.

| Encounter | Doc 41 s (restarts) | Doc 42 wall / sim s (restarts, interrupts) | This pass wall / sim s (restarts, interrupts) | Lowest survivor HP |
| --- | ---: | ---: | ---: | ---: |
| Ashen Bailiff — River Escape | 12.1 (0) | 10.7 / 10.4 (0, 0) | 14.8 / 14.2 (0, 0) | 74% |
| Flooded Cedars — Cinder Hounds | 18.7 (0) | 14.4 / 12.6 (0, 1) | 15.0 / 13.7 (0, 0) | 41% |
| Flooded Cedars — Ash Wisps | 9.4 (0) | 9.0 / 8.2 (0, 0) | 8.2 / 7.2 (0, 1) | 83% |
| Tithe Hound | 24.1 (0) | 24.4 / 22.6 (0, 0) | 25.2 / 23.6 (0, 0) | 87% |
| Cedar Service Path — Cinder Hounds and Ash Wisp | 10.4 (0) | 16.3 / 14.6 (0, 1) | 15.1 / 13.7 (0, 1) | 81% |
| Flooded Archive — Tithe Enforcer and Bell Moths | 12.6 (0) | 25.1 / 23.7 (0, 2) | 17.2 / 15.8 (0, 0) | 90% |
| Father Mateus Avelar | 24.0 (0) | 20.2 / 18.4 (0, 1) | 23.5 / 21.1 (0, 2) | 91% |
| Bound Ashen Oni — Name Release | 6.5 (0) | 7.1 / 6.9 (0, 1) | 8.4 / 8.4 (0, 1) | 92% |
| Furnace Abbot | 13.0 (0) | 13.2 / 11.7 (0, 1) | 17.9 / 16.4 (0, 6) | 76% |
| Magistrate Ujiro Arata | 24.0 (0) | 22.5 / 20.3 (0, 4) | 222.1 / 197.8 (0, 5) | 87% |
| Cinder Fan Above the Archive — Second Mask | 10.4 (0) | 11.8 / 10.3 (0, 0) | 31.9 / 8.3 (0, 4) | 85% |
| The Cinder Fan at Rain Docks — First Mask | 8.2 (0) | 10.4 / 9.2 (0, 1) | 13.8 / 12.6 (0, 2) | 85% |
| Captain Kaji | 9.2 (0) | 9.4 / 8.7 (0, 0) | 12.0 / 11.4 (0, 1) | 92% |
| Hushroad Name-Slip Release | 9.0 (0) | 7.6 / 6.9 (0, 2) | 14.2 / 11.2 (0, 1) | 89% |
| Bell Warden Chiyo | 37.2 (1) | 21.5 / 20.0 (0, 1) | 26.1 / 25.5 (0, 1) | 92% |
| Outer Court Lantern Breach | 8.3 (0) | 9.1 / 8.3 (0, 3) | 23.7 / 11.7 (0, 1) | 84% |
| Lady Enma of Ash — Last Mask | 18.3 (0) | 18.2 / 16.8 (0, 0) | 23.0 / 21.9 (0, 0) | 87% |
| Kurohana Archive Node Release | 11.2 (0) | 14.0 / 12.9 (0, 2) | 15.6 / 15.3 (0, 0) | 90% |
| Yearless Bell | 17.1 (0) | 59.9 / 57.8 (0, 0) | 125.2 / 123.5 (0, 0) | 87% |
| Shogun Kurozane, the Black Chrysanthemum | 22.4 (0) | 49.3 / 19.9 (1, 1) | 52.8 / 30.1 (1, 3) | 93% |
| Memorial Walk — Open Archive | 7.9 (0) | 9.2 / 8.8 (0, 0) | 9.6 / 10.0 (0, 0) | 100% |

Attempt 3 ran the pre-fix driver policy for its 19 battles; the resume ran the fixed policy. Wall time includes hit-stop, phase slow motion, and page stalls on this machine (Second Mask and Outer Court spent 12–24 s of wall time outside simulation).

Two fights ran much longer for the driver:

- **Magistrate Ujiro** took 197.8 simulated seconds in attempt 3 (doc 42: 20.3), with the party at 87–91% HP and no restart; the pre-fix policy stepped back on every poll of each 700–1,000 ms Ujiro tell. With the fixed policy, Action Lab trials end in 26–34 s with no restarts (below).
- **Yearless Bell** took 123.5 s (doc 42: 57.8). The driver spends most of it under the raised north node, where its open-loop jump attack is timing- and load-sensitive. Action Lab trials on this machine vary widely in both builds (below), the fight never restarted, and a variant with the attack input buffer disabled was just as slow, so the buffer is not the cause. The driver now re-reads attack readiness after its jump before striking a raised target; this fight remains the route's slowest for the automated policy and has not been shown fair for a human.

### Action Lab spot checks

The route driver's own `play_action_battle` policy against `action-campaign-battle.html?encounter=…` (lab mode, which applies the chronological party floor; Nikola and Mateus), on the same loaded machine. The baseline column is `a9b7add` (game and driver) exported and run under identical conditions.

| Fight | Baseline `a9b7add`, same machine | This pass |
| --- | --- | --- |
| Shogun Kurozane | 4 trials, 4 wins, 7 restarts (0, 1, 0, 6) | 8 trials with the lane-guarding driver, 8 wins, 11 restarts (0–4 each) |
| Magistrate Ujiro | — | 2 trials, 2 wins, 0 restarts, 26.0 / 34.1 s, 7–8 interrupts each |
| Bell Warden Chiyo | — | 2 trials, 2 wins, 0 restarts, 23.9 / 24.7 s, 3–4 interrupts each |
| Yearless Bell | 2 trials, 2 wins, 0 restarts, 67.7 / 147.8 s | 3 trials (before the jump-readiness change), 3 wins, 0 restarts, 121.0 / 300.9 / 375.5 s; with the attack buffer disabled 100.7 / 235.1 s |

Kurozane's archive core is high-variance for the automated policy in both builds on this machine (doc 42 measured 1 restart in 6 trials on a quieter one); a run with four or more core losses would still block a route that allows three restarts.

## Open risks

- **Human review is still pending.** The tiers were chosen from the brief's targets and checked by a harness and the route driver, not by people. Signature tells near 1 s may feel slow to skilled players, and the long boss tells make melee boss attacks easy to walk out of; most remaining boss threat comes from area attacks, summons, objectives, and multi-enemy fights.
- **Interrupts are now common.** One art breaks any boss signature or command tell, and a punish-then-strike string breaks it reliably; the route logged 29 interrupts. Players who learn it can deny most signature moves, including Chiyo's count and Kurozane's Court Command. That is intended, but it lowers those fights' pressure further.
- **Boss pressure dropped** to roughly half for a human-paced reader (harness above). If playtests find bosses too gentle, the levers are `ACTION_BOSS_SHARED_COOLDOWN_FLOOR_MS` (1,400 ms) and the boss tell bonus (+1), not the wind-ups.
- **Kurozane's archive core** and the **Yearless Bell north node** remain the automated route's weakest points (variance above). Ujiro's long attempt-3 time came from the old driver policy.
- **Telegraph presentation.** The page draws every wind-up with the existing telegraph, sweeping over the full wind-up; the animation-foundation tell clips will play at their phase-progress fraction, so a 1 s tell plays the same clip more slowly. Whether that reads well needs the art pass.
- The 160 ms input buffer can make a mashed press come out once more than intended; a held press is dropped after 160 ms.
