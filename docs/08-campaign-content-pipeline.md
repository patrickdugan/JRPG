# Campaign content pipeline

## Purpose

`game/content/campaign.mjs` is the canonical runtime-facing campaign source for *Bells of the Black Chrysanthemum*. It translates the locked material in `docs/01-vision-doc.md`, `docs/03-beats-outline.md`, and `docs/04-detailed-outline.md` into plain JavaScript data without coupling story content to a renderer or combat engine. `game/content/scene-direction.mjs` supplies a separate immutable presentation script for the same beat IDs, so staging can grow without changing save-stable story records.

It covers the Prologue, Chapters 1-9, and Epilogue, plus the concrete 28-34 minute FP-1 Takamine first-playable sequence. It is a content contract, not an implementation of field movement, combat, save state, UI, animation, or localization.

## Runtime contract

The module exports:

- `CAMPAIGN`: immutable campaign data.
- `getChapter(id)`: returns a chapter by stable string ID or chapter number, otherwise `null`.
- `getAllChapters()`: returns chapters in canonical story order.

The presentation companion exports `SCENE_DIRECTIONS`, `getSceneDirection(beatId)`, chapter/all lookup helpers, and `validateSceneDirections()`. Its 60 records cover every beat exactly once and each author atmosphere, score, camera, entrance, cast gesture, blocking, and transition cues. The browser runtime renders atmosphere and a collapsed presentation transcript; the cues never alter simulation state or claim that unimplemented audio/animation has played.

The core shape is intentionally small:

```js
{
  title: 'Bells of the Black Chrysanthemum',
  chapters: [{
    id: 'chapter-2',
    number: 2,
    title: 'Bell at Takamine',
    subtitle: 'A temple registry keeps a buried mouth.',
    objective: 'Interrupt the midnight registry...',
    party: ['ren', 'aya', 'lise', 'mateus'],
    partyMeta: { activeAtStart: ['ren', 'aya'], joins: [] },
    boss: { id: 'father-mateus-avelar', name: 'Father Mateus Avelar' },
    reward: { keyItems: [], systems: [], story: '...' },
    maps: [],
    encounters: [],
    beats: [{
      id: 'c2-01-rain-gate',
      title: 'Rain Gate',
      location: 'Takamine Rain Gate',
      mapId: 'tkm-rain-gate',
      encounterIds: [],
      text: [{ speaker: 'AYA', line: '...' }],
      choices: [{ id: '...', label: '...', flag: '...', result: '...' }],
    }],
  }],
}
```

All player-visible text belongs in the data. Consumers may add presentation-only properties at runtime, but must not rewrite canonical dialogue, names, choices, or reward descriptions.

`party` is the ordered roster available by the chapter's conclusion; `partyMeta` records its start state, joins, guest support, and camp availability. This keeps simple UI consumption (`chapter.party`) separate from progression metadata.

## How to consume it

1. Use a chapter's `id` as the save/load and analytics key. Never use its visible title as an identifier.
2. Render `summary`, `objective`, `party`, `boss`, `reward`, `maps`, and `encounters` in journals, map screens, encounter setup, and planning UI as appropriate.
3. Drive story scenes from the ordered `beats` array. Every beat has a required resolving `mapId`; beats that gate combat list canonical `encounterIds`. `trigger` is a symbolic event name for the field/scene system and is deliberately not an executable callback.
4. For each selected choice, write its `flag` with a choice-specific value or record the selected choice ID beside it. The `result` is the immediate player-facing consequence.
5. Do not gate the critical path on optional-record flags. Choices may affect copy, a route setup, an opening resistance, a later cameo, or an optional reward, but preserve the canonical campaign outcome.
6. Use `CAMPAIGN.firstPlayable.sequence` for FP-1. Every sequence item specifies map, intended duration, objective, ordered events, and exit condition. Its durations total 32 minutes, within the 28-34 minute target.

Suggested save shape:

```js
{
  chapterId: 'chapter-2',
  completedBeatIds: ['c2-01-rain-gate'],
  choiceIds: ['c2-inspect-supply-cart'],
  flags: { c2_blank_forms_seen: true },
  firstPlayableSceneId: 'fp-01-cedar-service-path',
}
```

Flags are intentionally descriptive, not morality values. For multi-option choice groups such as `c3_lantern_route`, store the selected choice ID or a specific string value rather than attempting to combine mutually exclusive options.

## FP-1 sequencing

FP-1 is the Chapter 2 slice from the rain gate to the cell-block exit. Its required sequence is:

| Scene | Target time | Contract |
| --- | ---: | --- |
| FP-00 Rain Gate | 2 min | Field movement, interaction highlight, no combat |
| FP-01 Cedar Service Path | 4 min | Pace, Analyze, Ledger, telegraph battle |
| FP-02 Abandoned Chapel | 4 min | Witness notes and Lise party join |
| FP-03 Bell Stair | 4 min | Exact but non-lethal field hazard; no jump |
| FP-04 Flooded Undercroft | 5 min | Terrain/Ledger teaching battle |
| FP-05 Bell Chamber | 9 min | Mateus boss, Blood Ward, Crimson Litany Recovery 3 |
| FP-06 Cell Block Exit | 4 min | Player-triggered rescue, relationship consequence, end card |

The 32-minute expected clear remains a first-playable target, not permission to extend FP-0. FP-0 stays a separate 5-10 minute combat-risk proof.

## Authoring rules

- Keep a normal playable beat under roughly 90 seconds. Put a movement, interaction, or battle between longer turning points.
- Use IDs in the existing naming pattern: `pNN-*`, `cN-NN-*`, `eNN-*`, and `fp-NN-*`. Do not rename an existing ID after it has entered a save or telemetry build.
- Bind every beat to an existing `game/content/levels.mjs` ID through `mapId`. Do not rely on location-name matching or a chapter-primary fallback; a scene may use a nearby subarea map when it has no dedicated kit, but that choice must be explicit.
- Bind every runtime encounter to exactly one canonical beat through `encounterIds`. Multiple learning encounters may share a beat, but no encounter may be orphaned or duplicated in the critical path.
- A beat must change a relationship, goal, or player understanding. Atmosphere-only writing belongs in an inspectable description, ambient bark, or map art brief.
- Dialogue choices must make their immediate consequence visible in `result`. Do not add hidden good/evil points, false abandon-rescue branches, or mutually contradictory canon.
- Bosses must state the lesson in their `battleLesson`; battle implementation needs to expose that lesson through telegraphs, Ledger information, and recovery readouts.
- New maps and encounters must retain the game contract: chapter/quest-led exploration, exact movement, no required movement-power gate, and no real-time reaction requirement.

## Narrative and IP safeguards

- All people, institutions, sacred objects, events, and supernatural systems are fictional. Do not turn real victims, historical officials, or living religious practice into enemy fodder.
- The historical backdrop needs Japanese cultural-historian and sensitivity review before production dialogue, garments, practices, or regional details are locked.
- Japanese characters retain local authority and decision-making. Lise and Mateus cannot become default interpreters of Japanese stakes because they are European.
- Mateus is original. Do not use a celebrity likeness, a real actor reference, copied scene behavior, or a film adaptation shorthand.
- The Ashen Oni are court-made bell constructs, not a depiction of Japanese religious oni or a claim about living folklore.
- Redemption is evidence-based and ongoing: Mateus protects people, confesses, loses power, and remains under supervision. The content must never turn a single helpful act into forgiveness owed by victims.

## Validation

After changing the module, run:

```powershell
node --check game/content/campaign.mjs
node --check game/content/scene-direction.mjs
node --test game/tests/scene-direction.test.mjs
node -e "import('./game/content/campaign.mjs').then(({ CAMPAIGN, getChapter }) => { if (CAMPAIGN.chapters.length !== 11) throw new Error('Expected 11 campaign entries'); if (!getChapter('chapter-2')) throw new Error('Chapter 2 missing'); if (CAMPAIGN.firstPlayable.expectedMinutes !== 32) throw new Error('FP-1 duration drift'); console.log('campaign content OK'); })"
```

Review every changed chapter against the canonical vision, beats, and detailed outline before a narrative-lock build. Runtime consumers should be smoke-tested separately; this module intentionally has no DOM or combat imports.
