/** Cross-page active-play telemetry used to prove campaign duration. */

import { CAMPAIGN } from './content/campaign.mjs';
import { getDefaultBrowserStorage } from './browser-storage.mjs';
import { ENCOUNTERS } from './content/encounters.mjs';
import { CAMPAIGN_PACING } from './advancement.mjs';

export const PLAYTIME_SCHEMA_VERSION = 1;
export const DEFAULT_PLAYTIME_SAVE_KEY = `${CAMPAIGN.id}.playtime.v${PLAYTIME_SCHEMA_VERSION}`;
export const PLAYTIME_INACTIVITY_THRESHOLD_MS = 30_000;
export const REQUIRED_FIRST_CLEAR_COUNT = ENCOUNTERS.length;
export const PLAYTIME_CATEGORIES = Object.freeze([
  'narrative',
  'exploration',
  'firstClearCombat',
  'grind',
  'menusAndRest',
]);

const CHAPTER_IDS = Object.freeze(CAMPAIGN.chapters.map((chapter) => chapter.id));
const CATEGORY_SET = new Set(PLAYTIME_CATEGORIES);
const CHAPTER_SET = new Set(CHAPTER_IDS);
const ENCOUNTER_ID_SET = new Set(ENCOUNTERS.map((encounter) => encounter.id));

/** Pure visibility/activity gate for callers sampling active playtime. */
export function isPlaytimeInactive({ nowMs, lastActivityMs, visible = true } = {}) {
  if (!visible || !Number.isFinite(nowMs) || !Number.isFinite(lastActivityMs)) return true;
  const idleMs = nowMs - lastActivityMs;
  return idleMs < 0 || idleMs >= PLAYTIME_INACTIVITY_THRESHOLD_MS;
}

export function getBattlePlaytimeCategory(encounterWinCount) {
  if (!Number.isSafeInteger(encounterWinCount) || encounterWinCount < 0) {
    throw new RangeError('Encounter win count must be a non-negative safe integer.');
  }
  return encounterWinCount > 0 ? 'grind' : 'firstClearCombat';
}

function orderedNumbers(keys, source = {}) {
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, source[key] ?? 0])));
}

function buildState({ categories, chapterMs, revision }) {
  const canonicalCategories = orderedNumbers(PLAYTIME_CATEGORIES, categories);
  return Object.freeze({
    schemaVersion: PLAYTIME_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    totalMs: Object.values(canonicalCategories).reduce((sum, value) => sum + value, 0),
    categories: canonicalCategories,
    chapterMs: orderedNumbers(CHAPTER_IDS, chapterMs),
    revision,
  });
}

export function createPlaytimeState() {
  return buildState({ categories: {}, chapterMs: {}, revision: 0 });
}

export function recordPlaytime(state, category, elapsedMs, { chapterId } = {}) {
  if (!CATEGORY_SET.has(category)) throw new RangeError(`Unknown playtime category ${category}.`);
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0 || elapsedMs > 60_000) {
    throw new RangeError('One playtime sample must be an integer from 0 to 60000 ms.');
  }
  if (chapterId != null && !CHAPTER_SET.has(chapterId)) throw new RangeError(`Unknown chapter ${chapterId}.`);
  if (elapsedMs === 0) return state;
  return buildState({
    categories: { ...state.categories, [category]: state.categories[category] + elapsedMs },
    chapterMs: chapterId ? { ...state.chapterMs, [chapterId]: state.chapterMs[chapterId] + elapsedMs } : state.chapterMs,
    revision: state.revision + 1,
  });
}

export function getPlaytimeReport(state, evidence = {}) {
  const targetMs = CAMPAIGN_PACING.targetMinutesAt1x * 60_000;
  const fixedTargetMs = (CAMPAIGN_PACING.targetMinutesAt1x - CAMPAIGN_PACING.grindMinutesAt1x) * 60_000;
  const fixedActualMs = state.totalMs - state.categories.grind;
  const suppliedIds = Array.isArray(evidence.firstClearEncounterIds)
    ? new Set(evidence.firstClearEncounterIds.filter((id) => ENCOUNTER_ID_SET.has(id)))
    : null;
  const firstClearCount = suppliedIds
    ? suppliedIds.size
    : (Number.isSafeInteger(evidence.firstClears) && evidence.firstClears >= 0 ? evidence.firstClears : 0);
  const campaignComplete = evidence.campaignComplete === true;
  const firstClearsComplete = firstClearCount >= REQUIRED_FIRST_CLEAR_COUNT;
  return Object.freeze({
    totalMs: state.totalMs,
    totalMinutes: state.totalMs / 60_000,
    targetMs,
    percentOfTarget: targetMs ? (state.totalMs / targetMs) * 100 : 0,
    remainingMs: Math.max(0, targetMs - state.totalMs),
    fixedActualMs,
    fixedTargetMs,
    grindMs: state.categories.grind,
    categories: state.categories,
    chapterMs: state.chapterMs,
    campaignComplete,
    firstClearCount,
    requiredFirstClearCount: REQUIRED_FIRST_CLEAR_COUNT,
    firstClearsComplete,
    durationProven: campaignComplete
      && firstClearsComplete
      && state.totalMs >= targetMs
      && fixedActualMs >= fixedTargetMs,
  });
}

export function formatPlaytime(milliseconds) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function validNumberMap(value, allowedKeys, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  const keys = Object.keys(value);
  if (keys.length !== allowedKeys.length || keys.some((key, index) => key !== allowedKeys[index])) {
    errors.push(`${label} must use exact canonical key order.`);
  }
  for (const key of keys) {
    if (!allowedKeys.includes(key)) errors.push(`${label} contains unknown key ${key}.`);
    if (!Number.isSafeInteger(value[key]) || value[key] < 0) errors.push(`${label}.${key} must be a non-negative safe integer.`);
  }
}

export function validatePlaytimePayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return Object.freeze({ ok: false, errors: Object.freeze(['Playtime save must be an object.']) });
  }
  const expected = ['schemaVersion', 'campaignId', 'totalMs', 'categories', 'chapterMs', 'revision'];
  const keys = Object.keys(payload);
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) errors.push('Playtime save keys or order are invalid.');
  if (payload.schemaVersion !== PLAYTIME_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${PLAYTIME_SCHEMA_VERSION}.`);
  if (payload.campaignId !== CAMPAIGN.id) errors.push(`campaignId must equal ${CAMPAIGN.id}.`);
  if (!Number.isSafeInteger(payload.totalMs) || payload.totalMs < 0) errors.push('totalMs must be a non-negative safe integer.');
  if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) errors.push('revision must be a non-negative safe integer.');
  validNumberMap(payload.categories, PLAYTIME_CATEGORIES, 'categories', errors);
  validNumberMap(payload.chapterMs, CHAPTER_IDS, 'chapterMs', errors);
  if (!errors.length && Object.values(payload.categories).reduce((sum, value) => sum + value, 0) !== payload.totalMs) {
    errors.push('totalMs must equal the category sum.');
  }
  if (errors.length) return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  return Object.freeze({ ok: true, state: buildState(payload), errors: Object.freeze([]) });
}

export function serializePlaytimeState(state) {
  const validation = validatePlaytimePayload(state);
  if (!validation.ok) throw new TypeError(validation.errors.join(' '));
  return JSON.stringify(validation.state);
}

export function loadPlaytimeState(serialized) {
  if (serialized == null || serialized === '') return Object.freeze({ ok: true, state: createPlaytimeState(), fresh: true, errors: Object.freeze([]) });
  try {
    const validation = validatePlaytimePayload(JSON.parse(serialized));
    return Object.freeze({ ...validation, fresh: false });
  } catch {
    return Object.freeze({ ok: false, state: createPlaytimeState(), fresh: false, errors: Object.freeze(['Playtime save is not valid JSON.']) });
  }
}

export function createPlaytimeStorageAdapter(storage = getDefaultBrowserStorage(), key = DEFAULT_PLAYTIME_SAVE_KEY) {
  return Object.freeze({
    load() {
      try { return loadPlaytimeState(storage?.getItem?.(key)); }
      catch { return Object.freeze({ ok: false, state: createPlaytimeState(), errors: Object.freeze(['Playtime storage could not be read.']) }); }
    },
    save(state) {
      try { storage?.setItem?.(key, serializePlaytimeState(state)); return Object.freeze({ ok: true }); }
      catch { return Object.freeze({ ok: false, errors: Object.freeze(['Playtime storage could not be written.']) }); }
    },
    clear() {
      try { storage?.removeItem?.(key); return Object.freeze({ ok: true }); }
      catch { return Object.freeze({ ok: false, errors: Object.freeze(['Playtime storage could not be cleared.']) }); }
    },
  });
}
