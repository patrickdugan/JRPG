# Campaign progression and save contract

`game/progression.mjs` is the DOM-free, versioned progression authority for *Bells of the Black Chrysanthemum*. It consumes the immutable authored data in `game/content/campaign.mjs`; it does not render UI, invoke combat, alter campaign content, or access browser storage until an adapter is explicitly created.

## Scope and invariants

The current schema is `PROGRESSION_SCHEMA_VERSION === 1`. A valid state always has these properties:

```js
{
  schemaVersion: 1,
  campaignId: 'bells-black-chrysanthemum',
  current: {
    chapterId: 'prologue',
    beatId: 'p00-delivery-in-rain',
  },
  completedBeatIds: [],
  choiceIds: [],
  flags: {},
  revision: 0,
}
```

- `chapterId`, `beatId`, and every recorded choice use canonical IDs from `campaign.mjs`, never visible titles or UI indexes.
- `completedBeatIds` is an ordered, contiguous prefix of the authored campaign. A save cannot skip from the Prologue to a later chapter.
- The cursor may point to a completed beat for journal replay, or to the one next unlocked beat. It cannot point at a future beat.
- `choiceIds` are stored in canonical campaign order and cannot be duplicated.
- `flags` are derived from `choiceIds`, so external data cannot claim a consequence that was not selected. A one-choice flag is the selected choice ID; a deliberate multi-interaction flag is an ordered array of choice IDs.
- API functions return new frozen state snapshots. Do not mutate a state object in a renderer.
- `revision` starts at zero and increases by one for each state-changing navigation, completion, or choice operation. It is deterministic; this schema records no wall-clock time.

The only supported way to add a flag in v1 is to record its authored choice. This is intentional: all current campaign flags originate from authored choices, and deriving them prevents stale route flags when a player changes a selection before leaving a beat.

## Runtime API

```js
import {
  appendChoice,
  completeCurrentBeat,
  createCampaignState,
  getCurrentBeat,
  getFlagValue,
  moveToBeat,
  selectChoice,
} from './progression.mjs';

let state = createCampaignState();

// Finish the opening beat and move to its next canonical beat.
state = completeCurrentBeat(state);

// Normal route/dialogue selection: replaces a prior choice on this same beat.
state = selectChoice(state, 'p01-read-order-aloud');
console.log(getFlagValue(state, 'prologue_order_read'));
// 'p01-read-order-aloud'

console.log(getCurrentBeat(state).id);
// 'p01-altered-order'
```

Main exports:

| Export | Use |
| --- | --- |
| `createCampaignState()` / `resetCampaignState()` | Create a fresh immutable state. Reset is deterministic and does not mutate a prior state. |
| `getCanonicalChapterIds()` / `getCanonicalBeatIds()` | Read stable authored IDs in story order. |
| `getCurrentChapter(state)` / `getCurrentBeat(state)` / `getNextBeat(state)` | Resolve the authored immutable content at the cursor. |
| `getUnlockedBeatIds(state)` / `isBeatCompleted(state, id)` / `isCampaignComplete(state)` | Render progress without duplicating progression logic. |
| `moveToBeat(state, chapterId, beatId)` | Move to a completed beat or next unlocked beat; throws `RangeError` for a locked or mismatched ID. |
| `completeCurrentBeat(state)` | Completes the current frontier beat and moves one beat forward. On replayed beats, it only advances the cursor. |
| `selectChoice(state, choiceId)` | Select one choice for the current beat, replacing a prior selection there. Use for mutually exclusive routes. |
| `appendChoice(state, choiceId)` | Adds another choice on the current beat. Reserve this for authored multi-interaction scenes. |
| `getSelectedChoiceIds(state, beatId?)`, `hasFlag(state, flagId)`, `getFlagValue(state, flagId)` | Read selected choices and their derived flags. |

`selectChoice` is the safe default for choices such as the three `c3_lantern_route` options: it removes any existing selection on that beat and recomputes derived flags. Use `appendChoice` only when the authored beat represents separate interactions. Chapter 9's six individual conservatory-offer refusals are the intended example; recording several of them produces:

```js
flags: {
  c9_offer_responses: [
    'c9-ren-refuses-obedience',
    'c9-aya-refuses-perfect-archive',
  ],
}
```

The state-changing functions validate their input and throw `TypeError` for a state object that did not originate from this contract. That makes programmer errors visible during development. Untrusted save data uses result objects instead.

## Save and load

```js
import {
  loadCampaignState,
  serializeCampaignState,
  validateSavePayload,
} from './progression.mjs';

const text = serializeCampaignState(state); // Stable JSON string
const loaded = loadCampaignState(text);

if (loaded.ok) {
  state = loaded.value;
} else {
  console.warn('Save rejected:', loaded.errors);
}

// A parsed JSON object can be validated directly as well.
const checked = validateSavePayload(JSON.parse(text));
```

`validateSavePayload(payload)` and `loadCampaignState(serializedOrPayload)` never throw for malformed external data. They return one of:

```js
{ ok: true, value: frozenNormalizedState, errors: [] }
{ ok: false, errors: ['Human-readable validation reason'] }
```

V1 rejects the following rather than silently repairing them:

- a different schema version or campaign ID;
- unknown fields;
- a mismatched chapter/beat cursor;
- skipped or reordered completed beats;
- future, duplicate, or noncanonical choice IDs;
- flags that do not exactly match the recorded choices;
- malformed JSON.

This strict behavior prevents an old or edited file from producing story states that the authored campaign never permits. A future schema must add an explicit migration before calling the V1 validator; do not coerce an unknown version in UI code.

## Safe localStorage adapter

The API does not assume `localStorage` exists. `createLocalStorageAdapter` accepts an injected Storage-like object for tests, or safely tries `globalThis.localStorage` when no first argument is supplied.

```js
import {
  createLocalStorageAdapter,
  DEFAULT_PROGRESSION_SAVE_KEY,
} from './progression.mjs';

const saves = createLocalStorageAdapter(undefined, DEFAULT_PROGRESSION_SAVE_KEY);

const loaded = saves.load();
if (loaded.ok) {
  state = loaded.state; // A fresh state when loaded.found is false.
}

const persisted = saves.save(state);
if (!persisted.ok) console.warn('Could not persist:', persisted.code);
```

The frozen adapter has `key`, `available`, `save(state)`, `load()`, and `clear()`.

- `load()` returns `{ ok: true, found: false, state: freshState }` for an empty slot and `{ ok: true, found: true, state }` for a valid save.
- Failures are no-throw results with `code`: `storage-unavailable`, `storage-read-failed`, `storage-write-failed`, `storage-clear-failed`, `invalid-state`, or `invalid-save`.
- A corrupted save is never deleted automatically. The save-slot UI should show recovery/reset options after displaying the failure.

## Campaign UI integration surface

`game/campaign.js` currently owns a renderer-local object with `chapterIndex`, `beatIndex`, `flags`, `picks`, and `completed`. Replace that local ownership during integration; do not maintain a second source of truth.

The import surface is deliberately small:

```js
import {
  completeCurrentBeat,
  createCampaignState,
  createLocalStorageAdapter,
  getCurrentBeat,
  getCurrentChapter,
  getSelectedChoiceIds,
  moveToBeat,
  selectChoice,
} from './progression.mjs';
```

Use `getCurrentChapter(state)` and `getCurrentBeat(state)` inside rendering in place of array-index lookups. A choice button should call `selectChoice(state, choiceId)` and then re-render. The next-scene control should call `completeCurrentBeat(state)`. A chapter/scene picker should call `moveToBeat(state, chapterId, beatId)` and handle its locked-beat `RangeError` as a disabled UI target rather than a save error. `getSelectedChoiceIds(state, beat.id)` replaces the renderer's `picks` map.

Persist after a successful state-changing action with the adapter's `save(state)`. On load, use the returned state before first render; if a slot is absent, use the fresh state returned by `load()`. The existing campaign data, map renderer, and encounter renderer require no mutation to adopt this contract.

## Verification

Run from `game/`:

```powershell
node --check progression.mjs
node --test tests/progression.test.mjs
```

To run every test on PowerShell after all runtime content modules are present, pass the resolved file list rather than a POSIX glob:

```powershell
node --test (Get-ChildItem -Path tests -Filter '*.test.mjs' | ForEach-Object { $_.FullName })
```

The focused test suite covers canonical navigation, replay, selection replacement, additive Chapter 9 choices, flag derivation, stable round trips, rejected tampering, reset behavior, and safe storage failure paths.
