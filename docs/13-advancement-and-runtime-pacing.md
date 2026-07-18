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

The model targets 1,200 minutes at normal speed:

| Activity | Minutes at 1x |
| --- | ---: |
| Narrative and dialogue | 480 |
| Exploration and field objectives | 300 |
| First-clear combat | 180 |
| Menus, camps, and rest | 60 |
| Optional/recommended level grind | 180 |
| Total | 1,200 (20 hours) |

The speed preference is restricted to `1x`, `2x`, or `4x` and accelerates repeat/grind time only. It does not shorten authored scenes or first-clear encounters. `getPacingEstimate` therefore returns:

| Speed | Estimated grind | Estimated campaign |
| --- | ---: | ---: |
| 1x | 180 min | 20 h |
| 2x | 90 min | 18.5 h |
| 4x | 45 min | 17.75 h |

Chapter level targets rise from level 2 after the Prologue to level 40 for Chapter 9 and the Epilogue. Canonical first clears attain those targets; repeat grinding provides optional over-leveling, currency, recovery from skipped party participation, or a lower-difficulty route through later encounters.

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
