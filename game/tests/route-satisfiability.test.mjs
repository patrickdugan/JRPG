import assert from 'node:assert/strict';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import { ENCOUNTERS, getEncounter } from '../content/encounters.mjs';
import { LEVELS, getLevel } from '../content/levels.mjs';
import {
  createFieldState,
  enterField,
  grantFieldFlags,
  interactField,
  useFieldExit,
} from '../field-runtime.mjs';

const LEVEL_BY_ID = new Map(LEVELS.map((level) => [level.id, level]));
const ENCOUNTER_BY_ID = new Map(ENCOUNTERS.map((encounter) => [encounter.id, encounter]));
const BEATS = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => ({
  chapterId: chapter.id,
  beat,
})));

function canonicalPaths(startLevelId, targetLevelId) {
  const paths = [];
  const visit = (levelId, edges, visited) => {
    if (paths.length >= 64) return;
    for (const exit of getLevel(levelId)?.exits ?? []) {
      const edge = Object.freeze({ fromLevelId: levelId, exit });
      if (exit.destinationLevelId === targetLevelId) {
        paths.push(Object.freeze([...edges, edge]));
        continue;
      }
      if (!LEVEL_BY_ID.has(exit.destinationLevelId) || visited.has(exit.destinationLevelId)) continue;
      visit(
        exit.destinationLevelId,
        [...edges, edge],
        new Set([...visited, exit.destinationLevelId]),
      );
    }
  };
  visit(startLevelId, [], new Set([startLevelId]));
  return Object.freeze(paths);
}

function choiceFlagsThrough(beatIndex) {
  return BEATS.slice(0, beatIndex + 1)
    .flatMap(({ beat }) => beat.choices ?? [])
    .map((choice) => choice.flag)
    .filter(Boolean);
}

function wonEncounterIdsThrough(beatIndex, path) {
  const ids = new Set(
    BEATS.slice(0, beatIndex + 1).flatMap(({ beat }) => beat.encounterIds ?? []),
  );
  for (const { fromLevelId } of path) {
    for (const trigger of getLevel(fromLevelId)?.encounterTriggers ?? []) ids.add(trigger.encounterId);
  }
  return [...ids];
}

function flagsFromWonEncounters(encounterIds) {
  const flags = [];
  for (const encounterId of encounterIds) {
    const encounter = getEncounter(encounterId);
    assert.ok(encounter, `Route references unknown encounter ${encounterId}.`);
    flags.push(encounterId, `${encounterId}-cleared`);
    flags.push(...(encounter.reward?.flags ?? []));
    flags.push(...(encounter.reward?.keyItems ?? []));
  }
  return flags;
}

function consumeAvailableInteractions(state, level, externalFlags) {
  let current = state;
  const remaining = new Set((level.interactables ?? []).map(({ id }) => id));
  const range = Math.max(level.width, level.height);

  // Requirements may refer to a flag produced by an interactable authored
  // later in the same array, so retry until a complete pass makes no progress.
  for (let pass = 0; pass <= remaining.size && remaining.size; pass += 1) {
    let progressed = false;
    for (const item of level.interactables ?? []) {
      if (!remaining.has(item.id)) continue;
      const result = interactField(current, item.id, {
        range,
        flags: externalFlags,
        choice: item.options?.[0],
      });
      if (!result.ok) continue;
      current = result.state;
      remaining.delete(item.id);
      progressed = true;
    }
    if (!progressed) break;
  }
  return current;
}

function exercisePath(path, beatId, externalFlags) {
  const first = path[0];
  let state = createFieldState({
    levelId: first.fromLevelId,
    beatId,
    position: first.exit.at,
    flags: externalFlags,
  });
  state = grantFieldFlags(state, externalFlags);

  for (let index = 0; index < path.length; index += 1) {
    const { fromLevelId, exit } = path[index];
    const level = getLevel(fromLevelId);
    if (index > 0) {
      state = enterField(state, fromLevelId, beatId, {
        position: exit.at,
        flags: externalFlags,
      });
    }
    state = consumeAvailableInteractions(state, level, externalFlags);
    const result = useFieldExit(state, exit.id, { flags: externalFlags });
    if (!result.ok) {
      return Object.freeze({
        ok: false,
        edge: `${fromLevelId}/${exit.id} -> ${exit.destinationLevelId}`,
        condition: exit.condition ?? '(none)',
        code: result.code,
      });
    }
    state = result.state;
  }
  return Object.freeze({ ok: true });
}

test('every canonical beat-to-next-map route has a satisfiable authored exit chain', async (t) => {
  for (let beatIndex = 0; beatIndex < BEATS.length - 1; beatIndex += 1) {
    const current = BEATS[beatIndex];
    const next = BEATS[beatIndex + 1];
    const startLevelId = current.beat.mapId;
    const targetLevelId = next.beat.mapId;
    if (!startLevelId || !targetLevelId || startLevelId === targetLevelId) continue;

    const paths = canonicalPaths(startLevelId, targetLevelId);
    if (!paths.length) continue;

    await t.test(`${current.beat.id} -> ${next.beat.id}`, () => {
      const failures = [];
      for (const path of paths) {
        const wonEncounterIds = wonEncounterIdsThrough(beatIndex, path);
        const externalFlags = [
          ...choiceFlagsThrough(beatIndex),
          ...flagsFromWonEncounters(wonEncounterIds),
        ];
        const result = exercisePath(path, current.beat.id, externalFlags);
        if (result.ok) return;
        failures.push(`${result.edge} locked by "${result.condition}" (${result.code})`);
      }

      assert.fail(
        `No satisfiable route from ${startLevelId} to ${targetLevelId}. ${failures.join(' | ')}`,
      );
    });
  }
});

test('every encounter referenced by a route source remains canonical', () => {
  for (const { beat } of BEATS) {
    for (const encounterId of beat.encounterIds ?? []) {
      assert.ok(ENCOUNTER_BY_ID.has(encounterId), `${beat.id} references ${encounterId}.`);
    }
  }
  for (const level of LEVELS) {
    for (const trigger of level.encounterTriggers ?? []) {
      assert.ok(ENCOUNTER_BY_ID.has(trigger.encounterId), `${level.id} trigger references ${trigger.encounterId}.`);
    }
  }
});
