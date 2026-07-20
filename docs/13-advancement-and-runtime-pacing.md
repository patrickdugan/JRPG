# Advancement and runtime pacing

`game/advancement.mjs` is the deterministic, DOM-free advancement authority. It complements `progression.mjs`: story progression owns chapters, beats, choices, and flags; advancement owns party unlocks, XP, encounter victories, loot, grind rewards, speed preference, and its own save slot.

## Party and level curve

The six canonical records are Ren, Aya, Lise, Mateus, Genta, and Kiku. A fresh state unlocks Ren. `preparePartyForEncounter` unlocks the active authored roster and applies the prior chapter’s XP floor, so a new member enters at a usable level instead of requiring back-grinding. `unlockPartyMember` remains available for story-driven joins. Everyone has distinct base HP, MP, Power, Guard, Arcana, and Speed plus fixed per-level growth.

The cap is level 50. Stats are never stored in the save: they are derived from XP and character growth, preventing edited or stale saves from claiming contradictory levels and stats.

For level `L`, the XP required to reach the next level is:

```text
60 + 35(L - 1) + 10(L - 1)^2
```

`xpForNextLevel`, `xpToReachLevel`, and `levelForXp` expose the exact curve. `getPartyMember` returns the derived level, stats, XP within the level, and XP remaining.

## Encounter rewards and grinding

`recordEncounterWin(state, encounterId, { partyIds? })` uses canonical encounter data. First-clear XP divides the chapter’s exact XP budget across its authored encounters; completing the canonical first clears therefore reaches the chapter level target without mandatory grinding. XP goes to the active party; the result is a new frozen state. The encounter's authored consumables and key items are awarded once. Currency and XP remain available on repeats with explicit anti-exploit scaling:

| Clear | XP | Currency | Unique loot |
| --- | ---: | ---: | --- |
| First | 100% | 100% | Yes |
| Second | 55% | 65% | No |
| Third | 35% | 45% | No |
| Fourth and later | 20% | 30% | No |

The 20% XP floor keeps optional grinding viable without making one early encounter the dominant leveling strategy. `getEncounterRewardPreview` shows the exact next reward before a fight, and `getEncounterWinCount` distinguishes first clears from repeats.

## Twenty-hour pacing target

The advancement module retains `CAMPAIGN_PACING` and `getPacingEstimate` as production-planning declarations. Their category allocations—including the old hypothetical 180-minute grind allocation—are not observations and are not inputs to duration audit v8. They must not be quoted as shipped playtime or used to pad the intended route.

The player-facing route is instead defined by an exact chronological contract: 60 canonical beats and 215 activities entered at their unlock frontier. Those activities are 13 finite side quests, 18 witness chronicles, 90 companion talks, 30 party councils, 60 archive readings, and exactly four repeat-grind milestones. Each grind milestone is one circuit of its linked repeatable contract. Later repetition is available for leveling but is not required and contributes no authored contract-minute allowance.

The speed preference remains restricted to `1x`, `2x`, or `4x`. It affects only repeat-battle presentation, never scenes, exploration, first-clear combat, decisions, or rewards. Duration audit v8 adds the measured engine schedule for the four required repeat wins and reports this reference sensitivity:

| Required repeat speed | Intended-route reference estimate | Hours |
| --- | ---: | ---: |
| 1× | 1,232.136 min | 20.54 |
| 2× | 1,231.829 min | 20.53 |
| 4× | 1,231.676 min | 20.53 |

Only 0.614 reference minute at 1× belongs to the four required repeat presentation schedules, so speed-up changes the estimate by seconds rather than removing hours of authored play.

Optional leveling has a separate finite queue: after a manual first clear, Battle offers 1, 5, or 10 Auto-Grind wins. Each victory uses the normal durable reward transaction before the next engine begins; cancellation, defeat, restart, or reload stops the session-only queue. At base Cinder Hound conditions, five deterministic wins schedule 155.00 seconds at 1×, 77.50 seconds at 2×, and 38.75 seconds at 4×. That 116.25-second saving is player-visible leveling convenience, but these optional extra wins remain excluded from the intended-route duration estimate and proof.

Chapter level targets rise from level 2 after the Prologue to level 40 for Chapter 9 and the Epilogue. Canonical first clears attain those targets; repeat grinding provides optional over-leveling, currency, recovery from skipped party participation, or a lower-difficulty route through later encounters.

The independent quantity audit in `15-content-volume-and-duration-evidence.md` estimates canonical-only play at 186.724/309.130/499.269 minutes and the complete intended route at 776.801/1,232.136/1,918.247 minutes low/reference/high. The 1× reference route is 32.136 minutes above the arithmetic target. These estimates remain unproven until one clean human run completes all route activities, explicitly finishes credits, and records at least 1,200 active minutes on the same receipt.

## Save contract

The advancement schema is version 1 and persists separately at `bells-black-chrysanthemum.advancement.v1`. A valid payload contains:

```js
{
  schemaVersion: 1,
  campaignId: 'bells-black-chrysanthemum',
  speedMultiplier: 1,
  party: [
    { id: 'ren', unlocked: true, xp: 0 },
    // five more canonical member records
  ],
  encounterWins: {},
  inventory: { currency: 0, items: {}, keyItems: [] },
  revision: 0,
}
```

All state transitions return frozen snapshots. Serialization has canonical party, encounter, and item ordering. Untrusted payloads reject unknown fields, IDs, schema versions, malformed counts, reordered members, invalid speed values, and XP beyond the level cap. `loadAdvancementState` and `validateAdvancementPayload` return result objects instead of throwing.

`createAdvancementStorageAdapter` safely accepts browser `localStorage` or an injected Storage-like object. Missing, corrupt, unavailable, read-failed, write-failed, and clear-failed cases are reported without deleting data or throwing through the UI.

## Runtime integration

On a battle victory:

```js
advancement = recordEncounterWin(advancement, encounter.id, {
  partyIds: deployedPartyIds,
});
advancementStorage.save(advancement);
```

The runtime should read `advancement.speedMultiplier` only for repeat-battle simulation, animation, and recovery timing. Reward amounts are independent of playback speed, so `4x` saves real time without multiplying XP per clear.

Focused verification from `game/`:

```powershell
node --check advancement.mjs
node --test tests/advancement.test.mjs
```
