# Combat-feel pass: authored AI, poise, telegraphs, impact

**Status:** implemented on `feature/combat-feel`; 1,339/1,339 tests and `npm run check` pass, and the rendered-control route from New Game reaches the intended `credits-seal-gate` with "Story complete" (resumed once from its own recovery export after an environmental browser stall). Human feel review is still pending.

**Authority:** `game/action-enemy-ai.mjs`, `game/action-combat.mjs` (poise and AI seams), `game/action-encounter-adapter.mjs` (poise profiles, ring variants), `game/action-combat-feedback.mjs` (presentation budgets), `game/action-campaign-battle.js` (rendering). Tests: `action-enemy-ai`, `action-combat-poise`, `action-combat-feedback`, `action-campaign-battle-source`.

## Authored AI priority table

The kernel's chase AI still begins the first ready attack whose hitbox reaches its target. Two status-hook seams now carry the authored `ai` lines from `content/encounters.mjs`:

- `prioritizeAttacks({ actor, target, attackIds })` returns the template's authored order.
- `canBeginAttack({ actor, attackId, target })` vetoes a skill whose authored precondition does not hold.

`AUTHORED_ENEMY_AI` is keyed by enemy template. Each skill rule quotes its authored line verbatim in `line` (and `also` where a second line applies); lines that belong to movement, targeting, or story beats are quoted in `notes` with the reason. A test fails if any quote differs from the encounter data, if any authored line of a covered template is left untranslated, or if a primary or named boss lacks a table.

Preconditions are deterministic: distance bands in tactical tiles (adjacent is within 1.5 tiles, about 96 px; "N+ distance" is at least N − 0.5 tiles), boss phase, every-Nth activation, alternation, summons alive, own skill cast this phase, warded strikes, status, an ally's declaration, two hostiles in reach, surrounded, isolated target, target near a protected object, and reach (for sentries). An activation is a completed attack; an interrupted wind-up is not one. Templates whose otherwise-branch is "advance" opt into idle activations: a full shared-cooldown period spent ready without a legal attack counts as an activation, as a tactical move-only turn would.

Authored self-casts normally still need their caster-centred hitbox to touch a foe. `selfCast: true` is an explicit opt-in that lets such a cast begin from any distance. Only Mateus's Blood Ward uses it: Phase 2 is built on the ward-then-Litany lesson. Call Clerks, Registry Guard, and Ringing Count already fire whenever their caster reaches a hero, and opting them in would add clerk, guard, or countdown pressure beyond the tactical cadence.

`interruptOnHit: true` marks an authored command action: any damaging hit during its wind-up breaks the caster's poise, and its telegraph reads "HIT TO INTERRUPT". Only Ujiro's Seizure Order and Call Clerks use it, each quoting the Tribunal counterplay "Interrupt orders, protect the print blocks"; a test checks the quote.

| Boss or elite | Rules |
| --- | --- |
| Tithe Hound | Consume Ink at 3+ tiles; Ledger Maul at adjacency; approach in between. |
| Father Mateus | Phase 1: Pale Cut adjacent, Sanguine Step beyond. Phase 2: Blood Ward from any range while no ward lives; Crimson Litany only after Blood Ward and two strikes on warded Mateus (there is no Analyze command in action combat). Phase 3: no hostile arts. |
| Lady Enma (docks) | Rain Mirror Step at adjacency; Cinder Fan Draw at range. |
| Lady Enma (roof) | Mirror Writ only after a clerk completes Seize Copy, once per declaration; Parasol Shear when the target stands within two tiles of a protected objective. |
| Lady Enma (last mask) | Paired Ashes every other activation; Abandonment Cry only against an ally three or more tiles from any other; Cinder Parasol Wing only in the cinder-wing phase. Idle activations count. |
| Captain Kaji | Crane Surge every third activation; Chain Haul beyond adjacency; Salt Cut at adjacency. |
| Widow of Fog | Strict alternation of Receding Call and Name Drag; the tide cadence stays with the phase director. |
| Furnace Abbot | Forge Sermon every third activation; Hammer Decree only with two heroes in front; idle activations count ("Otherwise advance."). |
| Magistrate Ujiro | Seizure Order only when a print block is below 2 HP; Call Clerks only while fewer than two clerks live; Gavel Line otherwise. Both orders break on any hit during their wind-up. |
| Bell Warden Chiyo | Ringing Count every second activation; Warden Bell only when surrounded (two heroes within 1.5 tiles, or one on each side); Chain Cast otherwise. |
| Yearless Bell | Alternates its radius 3 and radius 2 rings (the adapter now emits one attack per authored radius). |
| Shogun Kurozane | Court: Court Command and Yearless Thrust alternate. Bell: Blood Eclipse. Dawn: Black Chrysanthemum. |
| Ashen Bailiff | Census Sweep only when Ren stands in its line; Ash Step otherwise. |
| Tithe Enforcer, Dock Retainer, Masked Clerk | Pull or hook only beyond adjacency; short strikes only at adjacency; Registry Guard only when not already Guarded; Seal Snap only when blocked. |

Fixed on the way: when the laboratory party included Mateus, the boss-phase director and boss lookup resolved the party member (same template id) as the boss. Both now skip player actors.

## Poise and interrupts

Poise is opt-in per actor. A hit that deals damage during the target's wind-up drains poise: weapon strikes 1, Recovery-3 arts 2, a linked combo hit +1. At zero the wind-up is cancelled before its active frame, the attack starts its normal shared and per-art cooldown, and the enemy staggers (no AI, no movement). The kernel emits `poise-broken` and `attack-interrupted`; `hit` events carry `poiseDamage`, `poiseAfter`, and `poiseBroken`; `poise-restored` reports refills. Hits outside a wind-up never drain poise, and player actors have none.

| Profile | Poise | Regen | Stagger |
| --- | --- | --- | --- |
| Standard enemy | 2 | 1 point per 600 ms after 1.8 s without a wind-up hit | 450 ms |
| Primary or named boss | 4 | 1 point per 2.5 s after 3 s; refilled on every HP or objective phase change | 700 ms |
| Tutorial sentry, phase object, neutral | none | — | — |

A boss interrupt therefore takes two punished wind-ups with arts, or four with weapon strikes, inside a short window, and the phase reset stops it carrying across a phase beat. Authored command actions (`interruptOnHit`) are the exception: one damaging hit during the wind-up breaks them. Interrupted attacks are not activations, so interrupting Chiyo's count or Ujiro's call actually denies it.

## Telegraphs

During every enemy wind-up the page draws the exact world hitbox the active frame will test (`attackWorldHitbox`): a translucent area, a dashed outline, and a ground band at the feet. The fill sweeps from the attacker toward the far edge (or outward from the centre for caster-centred rings) as the wind-up approaches its active frame; the active frame flashes the whole area. Colour follows essence (Ember orange, Frost blue, Storm yellow, Radiance pale gold, Umbral violet), else delivery. An interrupted telegraph turns grey with a cross and fades. Poise pips sit under each enemy (always for bosses, during wind-ups or after damage for others); a staggered enemy shows a gold ring, a burst, and STAGGERED. Reduced motion draws a static full marker with no sweep or pulse. The canvas exposes `data-telegraph-count` and `data-telegraph-attack-ids`; enemy rows add `data-poise`, `data-max-poise`, `data-stagger-remaining-ms`, and `data-active-attack-id`.

## Hit-stop and screen shake

Hit-stop never edits a fixed step. A simulation pacer decides how much wall-clock time an animation frame hands to the kernel: a frozen frame runs no steps and keeps queued presses, then the same steps run unchanged. A test runs a kernel paced by real impact freezes against an unpaced one and checks identical events and final state.

| Impact | Hit-stop | Shake |
| --- | --- | --- |
| Party hit on an enemy | 40 ms + 250 × damage / max HP, +10 ms for arts, capped at 90 ms | 1.5–5 px |
| Combo hit | 90 ms | as above |
| Kill / boss kill | 90 / 120 ms | 6 px |
| Stagger / boss stagger | 90 / 110 ms | 5 / 6 px |
| Enemy hit on the party | 50–70 ms | 3 px |

Overlapping impacts take the strongest, never the sum. Reduced motion caps hit-stop at 30 ms and removes shake. Playtime telemetry is sampled from wall-clock frames before pacing, so frozen frames count as active play, as they are; the inactivity rule still depends only on player input and visibility. The rendered-route driver now records `simulatedSeconds` (kernel time) and `hitStopSeconds` beside wall-clock duration.

## Phase-change beats

`boss-phase-entered` shows a banner with the boss name, the phase position, and the phase name for 1.8 s, a 220 ms flash, and 400 ms of half-speed simulation (200 ms of delay, inside the 600 ms budget). It never pauses input; presses queue through it. Warnings (the Widow's tide) show a smaller banner only. Reduced motion shows a static banner with no flash or slow motion. The canvas exposes `data-phase-banner` while it is visible.

## Route comparison

Command (from `game/`): the doc 41 command, `--max-scenes 100 --max-seconds 10800 --max-action-restarts 3 --require-complete` with evidence and recovery exports, installed Chrome headless, rendered controls only. Baseline is the doc 41 receipt (21 battles, 1 restart, median 12.1 s, longest 37.2 s, lowest surviving fighter 33.6%).

- **Run 1** (`e0da8c3`, before the Ujiro and driver fixes): New Game to Credits in one session; all 21 battles won, 3 restarts (Ujiro 1, Chiyo 2), median 14.5 s wall / 13.2 s simulated. Credits showed "Story complete · 00:18:58", but the driver read `#sealCredits` before credits.js disabled it and timed out. Resuming from its recovery export ended at `credits-seal-gate` ("Story complete · 00:19:03").
- **Final** (`a69856b`): New Game through Bound Ashen Oni (8 battles, 0 restarts); the browser then stalled loading the Furnace Abbot page (no page or console errors; the machine was at 100% CPU with 0.8 GB free from unrelated workloads, and the same battle loads and wins in isolation). Resumed from that run's recovery export, with the driver's Playwright timeouts scaled ×4 by an external wrapper for this loaded machine, it won the remaining 13 battles and ended at **`credits-seal-gate`, "Story complete · 00:22:13"** with 04:37:46 left on the five-hour floor. Across the 21 battles: **1 restart** (Kurozane), median **14.0 s wall / 12.6 s simulated**, longest 59.9 s (Yearless Bell, driver pathing), 21.1 s of hit-stop in total, 21 interrupts, lowest surviving fighter 29.0% (Cinder Hounds), no console, page, or HTTP errors.

| Encounter | Baseline s (restarts) | Run 1 wall / sim s (restarts) | Final wall / sim s (restarts) | Final hit-stop s | Final interrupts |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ashen Bailiff — River Escape | 12.1 (0) | 10.8 / 10.4 (0) | 10.7 / 10.4 (0) | 0.1 | 0 |
| Flooded Cedars — Cinder Hounds | 18.7 (0) | 24.5 / 22.8 (0) | 14.4 / 12.6 (0) | 1.6 | 1 |
| Flooded Cedars — Ash Wisps | 9.4 (0) | 10.4 / 9.6 (0) | 9.0 / 8.2 (0) | 0.8 | 0 |
| Tithe Hound | 24.1 (0) | 29.5 / 27.7 (0) | 24.4 / 22.6 (0) | 1.4 | 0 |
| Cedar Service Path — Cinder Hounds and Ash Wisp | 10.4 (0) | 21.8 / 19.1 (0) | 16.3 / 14.6 (0) | 1.6 | 1 |
| Flooded Archive — Tithe Enforcer and Bell Moths | 12.6 (0) | 14.7 / 13.2 (0) | 25.1 / 23.7 (0) | 1.5 | 2 |
| Father Mateus Avelar | 24.0 (0) | 29.4 / 26.7 (0) | 20.2 / 18.4 (0) | 1.3 | 1 |
| Bound Ashen Oni — Name Release | 6.5 (0) | 7.2 / 6.5 (0) | 7.1 / 6.9 (0) | 0.3 | 1 |
| Furnace Abbot | 13.0 (0) | 14.0 / 12.6 (0) | 13.2 / 11.7 (0) | 1.0 | 1 |
| Magistrate Ujiro Arata | 24.0 (0) | 48.7 / 34.0 (1) | 22.5 / 20.3 (0) | 1.9 | 4 |
| Cinder Fan Above the Archive — Second Mask | 10.4 (0) | 6.4 / 5.7 (0) | 11.8 / 10.3 (0) | 1.3 | 0 |
| The Cinder Fan at Rain Docks — First Mask | 8.2 (0) | 9.7 / 8.8 (0) | 10.4 / 9.2 (0) | 1.0 | 1 |
| Captain Kaji | 9.2 (0) | 10.4 / 9.5 (0) | 9.4 / 8.7 (0) | 0.7 | 0 |
| Hushroad Name-Slip Release | 9.0 (0) | 9.1 / 8.1 (0) | 7.6 / 6.9 (0) | 0.5 | 2 |
| Bell Warden Chiyo | 37.2 (1) | 58.5 / 18.7 (2) | 21.5 / 20.0 (0) | 1.2 | 1 |
| Outer Court Lantern Breach | 8.3 (0) | 10.6 / 9.1 (0) | 9.1 / 8.3 (0) | 0.5 | 3 |
| Lady Enma of Ash — Last Mask | 18.3 (0) | 21.0 / 19.3 (0) | 18.2 / 16.8 (0) | 0.9 | 0 |
| Kurohana Archive Node Release | 11.2 (0) | 14.5 / 13.9 (0) | 14.0 / 12.9 (0) | 0.8 | 2 |
| Yearless Bell | 17.1 (0) | 17.5 / 16.9 (0) | 59.9 / 57.8 (0) | 1.2 | 0 |
| Shogun Kurozane, the Black Chrysanthemum | 22.4 (0) | 22.0 / 20.2 (0) | 49.3 / 19.9 (1) | 1.7 | 1 |
| Memorial Walk — Open Archive | 7.9 (0) | 8.6 / 8.9 (0) | 9.2 / 8.8 (0) | 0.0 | 0 |

Wall time includes hit-stop and phase slow motion (about 1 s per fight); simulated time does not. Single-run timings vary widely with machine load and driver pathing, so the tightest fights were replayed with the route driver's own `play_action_battle` policy against the canonical battle page, seeded at chronological progression:

| Fight | Baseline (`8cea4f7`) | Final build |
| --- | --- | --- |
| Magistrate Ujiro | 14 trials, 14 wins, 5 restarts | 16 trials, 16 wins, 3 restarts |
| Bell Warden Chiyo | 6 trials, 6 wins, 3 restarts | 6 trials, 6 wins, 4 restarts |
| Furnace Abbot | 5 trials, 3 wins, 2 driver stalls, lowest HP 37–69% | 6 trials, 4 wins, 2 driver stalls, lowest HP 72–85% |
| Yearless Bell | 5 trials, 5 wins, 3 core-loss restarts, median 84.9 s | 5 trials, 5 wins, 0 restarts, median 22.3 s |
| Shogun Kurozane | 6 trials, 3 wins, 13 core-loss restarts | 6 trials, 6 wins, 1 restart |

### Tribunal tuning

Run 1's Ujiro restart was a print-block failure about 9–10 s in with a healthy party. Trials isolated the cause: the authored "If fewer than two clerks live, Call Clerks" gate turns the baseline's wasted adjacent Call Clerks casts into Gavel Lines (Bound) while both clerks seize blocks (6 restarts in 12 trials). Requiring a two-hero cluster for Gavel Line was worse (18 restarts in 8): with nothing legal to do, Ujiro waited ready and fired Seizure Order the instant a block fell below 2 HP; restarting his cooldown on idle activations was also worse (12 in 8). The shipped answer is the encounter's own counterplay, "Interrupt orders": Seizure Order and Call Clerks break on any hit (3 restarts in 16). The driver also held Ujiro's 1.2 s disable-orders cast for a fixed wall-clock time, which hit-stop could cut short; it now holds until the rendered cast completes.

## Open risks

- The authored kits change boss pressure. A scratch harness bot (a simplified port of the route driver, three decision cadences per fight) showed Furnace Abbot, Captain Kaji, Widow of Fog, Lady Enma's last mask, and the Flooded Archive taking 25–60% less party damage. Kurozane's phase kit hits harder per activation than the old Court Command spam, but the spam destroyed the archive core; Widow of Fog is off the route and was checked only by the harness.
- Interrupt windows are short (boss wind-ups are 220–360 ms), so most boss interrupts will come from arts, companions, combos, or Ujiro's command actions; a human may not discover them without coaching copy.
- The Tribunal and Bell Warden Chiyo stay the tightest fights for the automated driver in both builds (see the trial tables); neither is proven fair for a first-time human.
- Telegraph rectangles are honest but large for 640–768 px area casts (Court Command, Seizure Order, Black Chrysanthemum); human readability review is still required.
- Hit-stop adds wall-clock time to every fight; simulated time is unaffected.
