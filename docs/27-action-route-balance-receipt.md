# Canonical action-route balance receipt

**Date:** 2026-07-26
**Run:** `af41d14d-31a5-47a3-b5db-3cdb1d0147ea`
**Scope:** automated rendered-control evidence; not a human playtest or duration proof

## What the route now proves

`game/tools/browser-route-playthrough.py` defaults to `action-campaign-battle.html`. It reads published text and `data-*` state, then uses ordinary keyboard, link, Camp, file-import, and file-export controls. It does not write web storage directly or invoke runtime transition functions. `--legacy-battle` retains the tactical controller as an explicit rollback.

Recovery-linked segments advanced the same clean run from the Chapter I Cedar frontier to **Bell at Takamine — Scene 06/06**, or **19/82 played scenes**. The action route recorded first clears for:

1. Prologue — Ashen Bailiff
2. Flooded Cedars — Cinder Hounds
3. Flooded Cedars — Ash Wisps
4. Tithe Hound
5. Cedar Service Path — Cinder Hounds and Ash Wisp
6. Flooded Archive — Tithe Enforcer and Bell Moths

The Tithe Hound cleared in **20.11 seconds**, **208 visible inputs**, and **zero restarts**, then returned through Campaign, performed the normal Camp recovery flow, and advanced to the Takamine package. The two Takamine approach encounters cleared in **7.031 seconds** and **8.890 seconds**, both with zero restarts. All recorded segments ended with empty console and page-error arrays.

## Defects found and corrected

- Campaign route automation had still been selecting the tactical controller. Canonical action is now the default, with a named rollback flag.
- Early canonical fighter selection could carry a locked guest's damaged HP into later encounters. The prologue now deploys Ren; Cinder Hounds deploy Ren/Aya; the route converges on Nikola/Mateus only when authored rosters support them.
- The immovable Ashen Bailiff was chasing like an ordinary enemy. It now uses a deterministic sentry profile.
- Aya's promised passive-healer role had no action implementation. Her deterministic ward pulse now restores the most wounded living ally on a fixed cadence.
- Simultaneous turn-authored enemies were applying independent full-rate real-time pressure. Group cadence and bounded damage coefficients now preserve positional pressure without multiplying unavoidable DPS.
- Primary bosses now retain a visible post-animation shared recovery floor before level scaling.
- The verifier was walking toward enemies while attacks cooled, attacking while facing away, spreading damage across targets, and ignoring available Camp quality. It now kites during cooldown, faces before committing, focuses lower-HP objects/adds, selects ready arts/subweapons by published reach, and chooses the affordable full-HP safehouse.
- Rendered recovery import/export now uses the developer presentation and visible file controls; recovery remains continuity-only and never claims proof.

## Honest stopping point

The next unresolved gate is **Father Mateus Avelar**. The verifier reaches his second phase but exhausts the Nikola/Ren party while Blood Ward objects remain active. The latest bounded attempt left Mateus at 375/634 HP; earlier timing variants reached 293/634. This is a real balance/strategy frontier, not a route or browser crash. The next pass should tune ward-breaking priorities and the non-healer duel economy, then continue the same recovery chain into Acts III–V.

No current full-route, human-feel, accessibility-technology, five-hour-duration, or ending-distribution claim is made.
