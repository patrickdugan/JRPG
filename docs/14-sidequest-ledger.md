# Optional-content and side-quest ledger

`game/content/sidequests.mjs` is the presentation-independent authority for optional campaign content. It contains thirteen finite story quests and four repeatable combat contracts, all on routes already opened by the critical path.

## Pacing receipt

| Content | Entries | First-pass minutes |
| --- | ---: | ---: |
| Story quests | 13 | 224 |
| Witness chronicles | 18 | 398 |
| First circuit of contracts | 4 | 40 |
| Total authored optional pass | 35 | 662 (11.03 hours) |

These are authored declarations, not measured playtime and not inputs to the quantity-based duration estimate. The standalone finite-content witness excludes repeat contracts, while the 215-activity intended-route contract requires exactly one circuit of each of the four contracts at its unlock frontier. Duration audit v8 counts only those four engine-measured presentation schedules; later repeats remain available as transparent level-grind loops without padding finite state-transition evidence or changing first-clear campaign resolutions.

## Witness chronicles

The 18 witness chronicles are a second finite optional-content lane spanning every chapter. Together they contain 67 stages, 288 acknowledged dialogue lines, 18 explicit consequence choices, and 152 ordered exact-tile fieldwork nodes. Twelve stages bind an existing canonical encounter and accept only explicit victory evidence; they never register a new or duplicate fight. Each chronicle settles one reward exactly once across chronicle, advancement, and loadout state.

`game/finite-content-run.mjs` completes every story quest and witness chronicle, audits all 31 atomic reward settlements, and proves that replay/duplicate completion is refused. Its zero-time result is state-transition evidence only. The 729-step witness fieldwork figure is a deterministic minimum-path catalog audit, not observed traversal time.

## Story quests

| ID | Chapter | Minutes | Maps | Linked encounter |
| --- | --- | ---: | --- | --- |
| `sq-p-three-dry-bottles` | Prologue | 8 | River Lane, Riverbank | None |
| `sq-c1-blank-lines` | Chapter 1 | 16 | Shrine Archive, Ferry Landing, Tax Storehouse | None |
| `sq-c1-mud-seal` | Chapter 1 | 13 | Ferry Landing, Flooded Cedars, Tax Storehouse | `c1-cinder-hounds` |
| `sq-c2-letters-without-roads` | Chapter 2 | 18 | Abandoned Chapel, Flooded Undercroft, Cell Block | None |
| `sq-c2-bellmakers-measure` | Chapter 2 | 16 | Rain Gate, Cedar Service Path, Bell Stair | `fp1-cedar-path` |
| `sq-c3-lanterns-no-office` | Chapter 3 | 16 | Market Lane, Customs House, Rain Docks | None |
| `sq-c4-every-boat-a-net` | Chapter 4 | 18 | Fishing Village, Tide Caves, Wrecked Carrack | None |
| `sq-c5-names-in-slag` | Chapter 5 | 19 | Requisition Town, Ash Fields, Archive Furnace | `c5-ashen-release` |
| `sq-c6-three-inks` | Chapter 6 | 20 | Printmaker Lane, Public Tribunal, Archive Roof, Canal Lock | None |
| `sq-c7-roadside-bells` | Chapter 7 | 20 | Map Table, Post Town, Prison Ferry, Bell Aqueduct | `c7-name-slip-release` |
| `sq-c8-consent-ledger` | Chapter 8 | 22 | Three return hubs, Black Gate | None |
| `sq-c9-breathing-index` | Chapter 9 | 24 | Outer Archive, Audience Hall, Blood Conservatory | `c9-archive-nodes` |
| `sq-e-corrections-margin` | Epilogue | 14 | Hoshigawa Archive, Sodegaura Storehouse, Takamine Tower | None |

The Chapter 1 pair and Chapter 2 pair are short chapter-local chains. Their second entries name the first in `prerequisites.questIds`; no quest requires a visit after its chapter or a traversal unlock. The other entries stand alone so skipping an earlier optional story does not erase later playtime.

## Repeatable contracts

| ID | Chapter | Minutes per run | Encounter replay | Repeat role |
| --- | --- | ---: | --- | --- |
| `contract-c1-cinder-route` | Chapter 1 | 10 | `c1-cinder-hounds` | Early Analyze and delivery-type practice |
| `contract-c3-dock-watch` | Chapter 3 | 10 | `c3-dock-patrol` | Midgame formation and escort pressure |
| `contract-c5-ash-release` | Chapter 5 | 10 | `c5-ashen-release` | Name-release objective rehearsal |
| `contract-c7-aqueduct-watch` | Chapter 7 | 10 | `c7-name-slip-release` | Late pulse-window practice |

Each contract opens only after the canonical encounter has a first clear. A defeat resets the current run and never rolls back campaign progress. First completion grants its larger bundle and first-clear flag; later runs grant reduced XP and currency with no items or key items. The advancement speed setting may accelerate these repeat runs because they are explicitly grind content.

## Runtime contract

Every entry exposes these predictable fields:

```js
{
  id,
  title,
  chapterId,
  mapIds,
  estimatedMinutes,
  kind, // 'story' or 'contract'
  prerequisites: {
    opensAfterBeatId,
    questIds,
    campaignFlags,
    encounterIds,
  },
  objectives: [
    { id, order, type, mapId, targetId, instruction, encounterId? },
  ],
  linkedEncounterIds,
  rewards: {
    firstClear: { xpPerMember, currency, items, keyItems },
    repeat: null | { xpPerMember, currency, items, keyItems },
  },
  completion: { mode, requiredObjectiveIds, setsFlags, resolution },
  failure: { mode, rule },
  save: {
    acceptedFlag,
    progressKey,
    completionFlag,
    failedFlag,
    repeatCountKey,
  },
  navigation: { backtrackingRequired: false, abilityGate: null, accessRule },
}
```

The item arrays match the advancement reward-preview shape: `{ name, quantity }`. Currency and `xpPerMember` are non-negative integers. A runtime can therefore apply a quest bundle through the same inventory transition used for encounter loot once a dedicated optional-progress state owns completion idempotence.

`getSideQuest(id)` resolves either kind, `getOptionalQuestsForChapter(chapterId)` preserves authored order, and `getOptionalContentPacing()` returns the finite pacing receipt. `ALL_OPTIONAL_QUESTS` combines both collections for menus and validation.

## Save and field rules

- Accept, progress, first-clear, and repeat-count keys use the `optional.<quest-id>.*` namespace.
- Story quests cannot fail after acceptance. Contract defeat resets only the active run.
- Objectives are ordered and every completion contract repeats their IDs exactly.
- Quest-specific `targetId` values are field tokens placed by the optional-content runtime; map, beat, chapter, and encounter IDs are canonical references.
- No objective requires a double jump, wall break, grappling tool, hidden movement power, or mandatory late-game backtrack.
- Named supporting characters are original fictional people. Local communities own their records, offers, limits, and memorial practices.

Focused verification from the repository root:

```powershell
node --check game/content/sidequests.mjs
node --test game/tests/sidequests.test.mjs
```
