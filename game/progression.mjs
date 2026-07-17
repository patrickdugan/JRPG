/**
 * Campaign progression and save-state contract for Bells of the Black
 * Chrysanthemum.
 *
 * This module is intentionally DOM-free. It owns only deterministic campaign
 * navigation, choice/flag recording, serialisation, validation, and optional
 * browser-storage adaptation. Rendering, field triggers, combat, audio, and
 * save-slot UI remain consumers of this API.
 */

import { CAMPAIGN, getAllChapters } from './content/campaign.mjs';

export const PROGRESSION_SCHEMA_VERSION = 1;
export const DEFAULT_PROGRESSION_SAVE_KEY = `${CAMPAIGN.id}.progression.v${PROGRESSION_SCHEMA_VERSION}`;

const EMPTY_ARRAY = Object.freeze([]);
const SAVE_KEYS = Object.freeze([
  'schemaVersion',
  'campaignId',
  'current',
  'completedBeatIds',
  'choiceIds',
  'flags',
  'revision',
]);
const CURRENT_KEYS = Object.freeze(['chapterId', 'beatId']);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function freezeArray(values) {
  return Object.freeze([...values]);
}

function freezeFlagMap(flags) {
  const frozen = {};
  for (const key of Object.keys(flags).sort()) {
    const value = flags[key];
    frozen[key] = Array.isArray(value) ? freezeArray(value) : value;
  }
  return Object.freeze(frozen);
}

function createCatalog() {
  const chapters = getAllChapters();
  const chapterById = new Map();
  const beatById = new Map();
  const choiceById = new Map();
  const beatIds = [];
  const chapterIds = [];

  for (const chapter of chapters) {
    if (!chapter?.id || chapterById.has(chapter.id)) {
      throw new Error('Campaign content must provide unique chapter IDs.');
    }
    const chapterRecord = Object.freeze({
      id: chapter.id,
      chapter,
      beatIds: freezeArray((chapter.beats ?? []).map((beat) => beat.id)),
    });
    chapterById.set(chapter.id, chapterRecord);
    chapterIds.push(chapter.id);

    for (const beat of chapter.beats ?? []) {
      if (!beat?.id || beatById.has(beat.id)) {
        throw new Error('Campaign content must provide unique beat IDs.');
      }
      const beatRecord = Object.freeze({
        id: beat.id,
        chapterId: chapter.id,
        chapter,
        beat,
        index: beatIds.length,
      });
      beatById.set(beat.id, beatRecord);
      beatIds.push(beat.id);

      for (const choice of beat.choices ?? []) {
        if (!choice?.id || choiceById.has(choice.id)) {
          throw new Error('Campaign content must provide unique choice IDs.');
        }
        choiceById.set(choice.id, Object.freeze({
          id: choice.id,
          beatId: beat.id,
          chapterId: chapter.id,
          beatIndex: beatRecord.index,
          choice,
          index: choiceById.size,
        }));
      }
    }
  }

  if (!beatIds.length) throw new Error('Campaign content must provide at least one beat.');

  return Object.freeze({
    chapterById,
    beatById,
    choiceById,
    chapterIds: freezeArray(chapterIds),
    beatIds: freezeArray(beatIds),
  });
}

const CATALOG = createCatalog();

function compareChoiceIds(left, right) {
  return CATALOG.choiceById.get(left).index - CATALOG.choiceById.get(right).index;
}

function sortChoiceIds(choiceIds) {
  return [...choiceIds].sort(compareChoiceIds);
}

function deriveFlags(choiceIds) {
  const selectedByFlag = new Map();

  for (const choiceId of choiceIds) {
    const choiceRecord = CATALOG.choiceById.get(choiceId);
    const flag = choiceRecord.choice.flag;
    if (!flag) continue;
    const selected = selectedByFlag.get(flag) ?? [];
    selected.push(choiceId);
    selectedByFlag.set(flag, selected);
  }

  const flags = {};
  for (const flag of [...selectedByFlag.keys()].sort()) {
    const selected = selectedByFlag.get(flag);
    flags[flag] = selected.length === 1 ? selected[0] : selected;
  }
  return flags;
}

function flagMapsMatch(actual, expected) {
  if (!isPlainObject(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.length !== expectedKeys.length) return false;

  for (let index = 0; index < expectedKeys.length; index += 1) {
    const key = expectedKeys[index];
    if (actualKeys[index] !== key) return false;
    const actualValue = actual[key];
    const expectedValue = expected[key];
    if (Array.isArray(expectedValue)) {
      if (!Array.isArray(actualValue) || actualValue.length !== expectedValue.length) return false;
      for (let valueIndex = 0; valueIndex < expectedValue.length; valueIndex += 1) {
        if (actualValue[valueIndex] !== expectedValue[valueIndex]) return false;
      }
    } else if (actualValue !== expectedValue) {
      return false;
    }
  }
  return true;
}

function buildState({ currentBeatId, completedBeatIds, choiceIds, revision }) {
  const currentRecord = CATALOG.beatById.get(currentBeatId);
  const normalizedChoiceIds = sortChoiceIds(choiceIds);
  const flags = deriveFlags(normalizedChoiceIds);

  return Object.freeze({
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    current: Object.freeze({
      chapterId: currentRecord.chapterId,
      beatId: currentRecord.id,
    }),
    completedBeatIds: freezeArray(completedBeatIds),
    choiceIds: freezeArray(normalizedChoiceIds),
    flags: freezeFlagMap(flags),
    revision,
  });
}

function validationResult(ok, value, errors = EMPTY_ARRAY) {
  return Object.freeze({
    ok,
    ...(ok ? { value } : {}),
    errors: freezeArray(errors),
  });
}

function validateExactKeys(value, expectedKeys, label, errors) {
  const expected = new Set(expectedKeys);
  for (const key of expectedKeys) {
    if (!hasOwn(value, key)) errors.push(`${label}.${key} is required.`);
  }
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) errors.push(`${label}.${key} is not supported by schema v${PROGRESSION_SCHEMA_VERSION}.`);
  }
}

/**
 * Validate an object-shaped v1 save payload without throwing on untrusted
 * data. Successful validation returns a normalized, frozen campaign state.
 */
export function validateSavePayload(payload) {
  try {
    const errors = [];
    if (!isPlainObject(payload)) {
      return validationResult(false, undefined, ['Save payload must be a plain object.']);
    }

    validateExactKeys(payload, SAVE_KEYS, 'save', errors);
    if (payload.schemaVersion !== PROGRESSION_SCHEMA_VERSION) {
      errors.push(`save.schemaVersion must equal ${PROGRESSION_SCHEMA_VERSION}.`);
    }
    if (payload.campaignId !== CAMPAIGN.id) {
      errors.push(`save.campaignId must equal ${CAMPAIGN.id}.`);
    }
    if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) {
      errors.push('save.revision must be a non-negative safe integer.');
    }

    let currentRecord = null;
    if (!isPlainObject(payload.current)) {
      errors.push('save.current must be a plain object.');
    } else {
      validateExactKeys(payload.current, CURRENT_KEYS, 'save.current', errors);
      if (typeof payload.current.chapterId !== 'string') errors.push('save.current.chapterId must be a string.');
      if (typeof payload.current.beatId !== 'string') errors.push('save.current.beatId must be a string.');
      currentRecord = CATALOG.beatById.get(payload.current.beatId) ?? null;
      if (!currentRecord) {
        errors.push('save.current.beatId must be a canonical beat ID.');
      } else if (currentRecord.chapterId !== payload.current.chapterId) {
        errors.push('save.current.chapterId must own save.current.beatId.');
      }
    }

    let completedBeatIds = [];
    if (!Array.isArray(payload.completedBeatIds)) {
      errors.push('save.completedBeatIds must be an array.');
    } else {
      completedBeatIds = payload.completedBeatIds;
      const seen = new Set();
      for (let index = 0; index < completedBeatIds.length; index += 1) {
        const beatId = completedBeatIds[index];
        if (typeof beatId !== 'string' || !CATALOG.beatById.has(beatId)) {
          errors.push(`save.completedBeatIds[${index}] must be a canonical beat ID.`);
          continue;
        }
        if (seen.has(beatId)) errors.push(`save.completedBeatIds contains duplicate ID ${beatId}.`);
        seen.add(beatId);
        if (CATALOG.beatIds[index] !== beatId) {
          errors.push('save.completedBeatIds must be the canonical contiguous campaign prefix.');
        }
      }
    }

    if (currentRecord && Array.isArray(payload.completedBeatIds) && currentRecord.index > completedBeatIds.length) {
      errors.push('save.current must be a completed beat or the next canonical beat.');
    }

    let choiceIds = [];
    if (!Array.isArray(payload.choiceIds)) {
      errors.push('save.choiceIds must be an array.');
    } else {
      choiceIds = payload.choiceIds;
      const seen = new Set();
      for (let index = 0; index < choiceIds.length; index += 1) {
        const choiceId = choiceIds[index];
        const choiceRecord = CATALOG.choiceById.get(choiceId);
        if (typeof choiceId !== 'string' || !choiceRecord) {
          errors.push(`save.choiceIds[${index}] must be a canonical choice ID.`);
          continue;
        }
        if (seen.has(choiceId)) errors.push(`save.choiceIds contains duplicate ID ${choiceId}.`);
        seen.add(choiceId);
        if (choiceRecord.beatIndex > completedBeatIds.length) {
          errors.push(`save.choiceIds contains a choice from locked beat ${choiceRecord.beatId}.`);
        }
      }
      if (!errors.some((error) => error.startsWith('save.choiceIds'))) {
        const normalizedChoiceIds = sortChoiceIds(choiceIds);
        if (normalizedChoiceIds.some((choiceId, index) => choiceId !== choiceIds[index])) {
          errors.push('save.choiceIds must use canonical campaign order.');
        }
      }
    }

    if (!isPlainObject(payload.flags)) {
      errors.push('save.flags must be a plain object.');
    } else if (Array.isArray(payload.choiceIds) && !errors.some((error) => error.startsWith('save.choiceIds'))) {
      const expectedFlags = deriveFlags(sortChoiceIds(choiceIds));
      if (!flagMapsMatch(payload.flags, expectedFlags)) {
        errors.push('save.flags must exactly match the flags derived from save.choiceIds.');
      }
    }

    if (errors.length) return validationResult(false, undefined, errors);
    return validationResult(true, buildState({
      currentBeatId: currentRecord.id,
      completedBeatIds,
      choiceIds,
      revision: payload.revision,
    }));
  } catch {
    return validationResult(false, undefined, ['Save payload could not be read safely.']);
  }
}

function assertValidState(state) {
  const validation = validateSavePayload(state);
  if (!validation.ok) {
    throw new TypeError(`Invalid campaign state: ${validation.errors.join(' ')}`);
  }
  return validation.value;
}

/** Return a pristine, immutable campaign state at the canonical opening beat. */
export function createCampaignState() {
  return buildState({
    currentBeatId: CATALOG.beatIds[0],
    completedBeatIds: [],
    choiceIds: [],
    revision: 0,
  });
}

/** Return a pristine state. Reset is intentionally deterministic and does not mutate its input. */
export function resetCampaignState() {
  return createCampaignState();
}

/** Return canonical chapter IDs in authored story order. */
export function getCanonicalChapterIds() {
  return CATALOG.chapterIds;
}

/** Return canonical beat IDs in authored story order. */
export function getCanonicalBeatIds() {
  return CATALOG.beatIds;
}

/** Return the authored chapter for the state cursor. */
export function getCurrentChapter(state) {
  const snapshot = assertValidState(state);
  return CATALOG.chapterById.get(snapshot.current.chapterId).chapter;
}

/** Return the authored beat for the state cursor. */
export function getCurrentBeat(state) {
  const snapshot = assertValidState(state);
  return CATALOG.beatById.get(snapshot.current.beatId).beat;
}

/** Return the next canonical beat after the cursor, or null at campaign end. */
export function getNextBeat(state) {
  const snapshot = assertValidState(state);
  const currentRecord = CATALOG.beatById.get(snapshot.current.beatId);
  return CATALOG.beatById.get(CATALOG.beatIds[currentRecord.index + 1])?.beat ?? null;
}

/** Return completed beats plus the next beat available for play. */
export function getUnlockedBeatIds(state) {
  const snapshot = assertValidState(state);
  const unlocked = [...snapshot.completedBeatIds];
  const nextBeatId = CATALOG.beatIds[snapshot.completedBeatIds.length];
  if (nextBeatId) unlocked.push(nextBeatId);
  return freezeArray(unlocked);
}

export function isBeatCompleted(state, beatId) {
  const snapshot = assertValidState(state);
  return snapshot.completedBeatIds.includes(beatId);
}

export function isCampaignComplete(state) {
  const snapshot = assertValidState(state);
  return snapshot.completedBeatIds.length === CATALOG.beatIds.length;
}

/**
 * Move the cursor to an already completed beat or the next unlocked beat.
 * This supports journal replay without permitting access to future story data.
 */
export function moveToBeat(state, chapterId, beatId) {
  const snapshot = assertValidState(state);
  const chapterRecord = CATALOG.chapterById.get(chapterId);
  const beatRecord = CATALOG.beatById.get(beatId);
  if (!chapterRecord) throw new RangeError(`Unknown chapter ID: ${chapterId}`);
  if (!beatRecord || beatRecord.chapterId !== chapterRecord.id) {
    throw new RangeError(`Beat ${beatId} does not belong to chapter ${chapterId}.`);
  }
  const finalUnlockedIndex = Math.min(snapshot.completedBeatIds.length, CATALOG.beatIds.length - 1);
  if (beatRecord.index > finalUnlockedIndex) {
    throw new RangeError(`Beat ${beatId} is not unlocked.`);
  }
  if (snapshot.current.beatId === beatId) return snapshot;
  return buildState({
    currentBeatId: beatId,
    completedBeatIds: snapshot.completedBeatIds,
    choiceIds: snapshot.choiceIds,
    revision: snapshot.revision + 1,
  });
}

/**
 * Complete the cursor beat when it is the campaign frontier, then advance the
 * cursor by one beat. Replaying a completed beat advances without completing
 * additional unseen content.
 */
export function completeCurrentBeat(state) {
  const snapshot = assertValidState(state);
  const currentRecord = CATALOG.beatById.get(snapshot.current.beatId);
  const completedCount = snapshot.completedBeatIds.length;
  const isFrontierBeat = currentRecord.index === completedCount;
  const completedBeatIds = isFrontierBeat
    ? [...snapshot.completedBeatIds, currentRecord.id]
    : snapshot.completedBeatIds;
  const nextIndex = Math.min(currentRecord.index + 1, CATALOG.beatIds.length - 1);
  const nextBeatId = CATALOG.beatIds[nextIndex];

  if (!isFrontierBeat && nextBeatId === snapshot.current.beatId) return snapshot;
  return buildState({
    currentBeatId: nextBeatId,
    completedBeatIds,
    choiceIds: snapshot.choiceIds,
    revision: snapshot.revision + 1,
  });
}

function updateCurrentChoice(state, choiceId, append) {
  const snapshot = assertValidState(state);
  const choiceRecord = CATALOG.choiceById.get(choiceId);
  if (!choiceRecord) throw new RangeError(`Unknown choice ID: ${choiceId}`);
  if (choiceRecord.beatId !== snapshot.current.beatId) {
    throw new RangeError(`Choice ${choiceId} does not belong to the current beat.`);
  }

  const selected = new Set(snapshot.choiceIds);
  if (!append) {
    for (const existingChoiceId of snapshot.choiceIds) {
      if (CATALOG.choiceById.get(existingChoiceId).beatId === snapshot.current.beatId) {
        selected.delete(existingChoiceId);
      }
    }
  }
  selected.add(choiceId);
  const choiceIds = sortChoiceIds(selected);
  const unchanged = choiceIds.length === snapshot.choiceIds.length
    && choiceIds.every((id, index) => id === snapshot.choiceIds[index]);
  if (unchanged) return snapshot;

  return buildState({
    currentBeatId: snapshot.current.beatId,
    completedBeatIds: snapshot.completedBeatIds,
    choiceIds,
    revision: snapshot.revision + 1,
  });
}

/**
 * Select one choice for the current beat. A new selection replaces any earlier
 * selection on that beat, which is the safe default for route-choice groups.
 */
export function selectChoice(state, choiceId) {
  return updateCurrentChoice(state, choiceId, false);
}

/**
 * Record an additional choice for the current beat without replacing earlier
 * selections. Use this only for authored multi-interaction beats such as the
 * six separate Chapter 9 offer refusals.
 */
export function appendChoice(state, choiceId) {
  return updateCurrentChoice(state, choiceId, true);
}

/** Return selected canonical choice IDs for one beat (the cursor beat by default). */
export function getSelectedChoiceIds(state, beatId = undefined) {
  const snapshot = assertValidState(state);
  const targetBeatId = beatId ?? snapshot.current.beatId;
  if (!CATALOG.beatById.has(targetBeatId)) throw new RangeError(`Unknown beat ID: ${targetBeatId}`);
  return freezeArray(snapshot.choiceIds.filter((choiceId) => CATALOG.choiceById.get(choiceId).beatId === targetBeatId));
}

/** Return the choice-derived value for a flag: a choice ID, choice-ID array, or undefined. */
export function getFlagValue(state, flagId) {
  const snapshot = assertValidState(state);
  return snapshot.flags[flagId];
}

export function hasFlag(state, flagId) {
  const snapshot = assertValidState(state);
  return hasOwn(snapshot.flags, flagId);
}

/** Convert a valid state to a stable JSON string suitable for a save slot. */
export function serializeCampaignState(state) {
  return JSON.stringify(assertValidState(state));
}

/**
 * Parse a JSON string (or validate a parsed object) into a normalized state.
 * Invalid data is returned as { ok: false, errors } rather than throwing.
 */
export function loadCampaignState(serializedOrPayload) {
  if (typeof serializedOrPayload === 'string') {
    try {
      return validateSavePayload(JSON.parse(serializedOrPayload));
    } catch {
      return validationResult(false, undefined, ['Save payload is not valid JSON.']);
    }
  }
  return validateSavePayload(serializedOrPayload);
}

function resolveDefaultStorage() {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function isStorageLike(storage) {
  return Boolean(storage)
    && typeof storage.getItem === 'function'
    && typeof storage.setItem === 'function'
    && typeof storage.removeItem === 'function';
}

function storageResult(ok, properties = {}) {
  return Object.freeze({ ok, ...properties });
}

/**
 * Create a no-throw adapter around localStorage or an injected Storage-like
 * object. Browser privacy mode, missing globals, corrupted JSON, quota errors,
 * and disabled storage are reported as result objects and never clear a save.
 */
export function createLocalStorageAdapter(storage = undefined, key = DEFAULT_PROGRESSION_SAVE_KEY) {
  if (typeof key !== 'string' || !key.trim()) throw new TypeError('Save key must be a non-empty string.');
  const target = storage === undefined ? resolveDefaultStorage() : storage;
  const available = isStorageLike(target);
  const unavailable = () => storageResult(false, { code: 'storage-unavailable' });

  return Object.freeze({
    key,
    available,
    save(state) {
      const validation = validateSavePayload(state);
      if (!validation.ok) return storageResult(false, { code: 'invalid-state', errors: validation.errors });
      if (!available) return unavailable();
      try {
        target.setItem(key, JSON.stringify(validation.value));
        return storageResult(true);
      } catch {
        return storageResult(false, { code: 'storage-write-failed' });
      }
    },
    load() {
      if (!available) return unavailable();
      try {
        const raw = target.getItem(key);
        if (raw === null) return storageResult(true, { found: false, state: createCampaignState() });
        if (typeof raw !== 'string') return storageResult(false, { code: 'invalid-save', errors: freezeArray(['Stored save must be a JSON string.']) });
        const validation = loadCampaignState(raw);
        if (!validation.ok) return storageResult(false, { code: 'invalid-save', errors: validation.errors });
        return storageResult(true, { found: true, state: validation.value });
      } catch {
        return storageResult(false, { code: 'storage-read-failed' });
      }
    },
    clear() {
      if (!available) return unavailable();
      try {
        target.removeItem(key);
        return storageResult(true);
      } catch {
        return storageResult(false, { code: 'storage-clear-failed' });
      }
    },
  });
}
