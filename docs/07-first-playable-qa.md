# First-Playable QA Card

Use this card for every internal test build. The purpose is to collect evidence about the hook—turn-based, positional duels with recovery commitment—not to tune the entire game by instinct.

## Build smoke test

- [ ] The documented local run command opens the playable build without an uncaught error.
- [ ] A fresh start reaches the first decision state without a manual data edit.
- [ ] Keyboard controls are visible in-game or in the run instructions.
- [ ] Restart returns to a valid initial state and does not duplicate actors, statuses, or input handlers.

## Hook comprehension test

Ask a new tester to play with no explanation beyond the controls. Observe whether they can:

- [ ] identify whose turn / phase it is;
- [ ] tell the meaningful positions or ranges apart;
- [ ] see that an attack has a wind-up or commitment;
- [ ] understand why an attacker cannot immediately attack again;
- [ ] choose a guard, dodge, interrupt, or positional response before a threatening enemy action;
- [ ] predict an elemental weakness/resistance from the UI or combat feedback;
- [ ] recover from one mistake without the encounter becoming unwinnable.

If any answer is no, capture the exact UI state and player quote before proposing a change.

## Encounter validation

| Test | Expected result | Pass |
| --- | --- | --- |
| Basic attack | Damage applies once; recovery is visibly communicated; re-use is blocked until recovery ends. | ☐ |
| Element match | Advantage and resistance produce distinct, legible damage/results. | ☐ |
| Guard | Guard reduces or negates the documented attack class, then resolves cleanly. | ☐ |
| Dodge / move | Position changes only when legal and changes at least one tactical option. | ☐ |
| Interrupt | A valid interrupt cancels or weakens the intended committed action and updates initiative correctly. | ☐ |
| Defeat | Loss state is understandable and restart works. | ☐ |
| Victory | Win state presents next-step/end-card feedback and can restart. | ☐ |

## Minimum feedback record

For each tester, record:

| Field | Notes |
| --- | --- |
| Build / commit | |
| Minutes to first meaningful choice | |
| Completion / wipe / quit | |
| First rule misunderstood | |
| Most satisfying decision | |
| Most confusing UI element | |
| Crash or logic bug | |
| One recommended small change | |

## Change discipline

Make the smallest change that addresses a repeated observation. Do not add unrelated abilities, an additional party member, new enemy types, map scope, or story chapters in response to a single test session.

