/**
 * Run-scoped completion and playtime evidence.
 *
 * The general playtime save is intentionally cumulative across pages. A run
 * receipt instead starts from zero beside pristine campaign/advancement
 * states and requires its run ID on every transition. It owns the time,
 * canonical beat prefix, and first-clear IDs used by its proof report, so old
 * cumulative time cannot be paired with a later New Game completion.
 */

import { CAMPAIGN } from './content/campaign.mjs';
import { ENCOUNTERS } from './content/encounters.mjs';
import { getDefaultBrowserStorage } from './browser-storage.mjs';
import {
  createAdvancementState,
  validateAdvancementPayload,
} from './advancement.mjs';
import {
  createCampaignState,
  validateSavePayload as validateCampaignPayload,
} from './progression.mjs';
import {
  createPlaytimeState,
  getPlaytimeReport,
  recordPlaytime,
  validatePlaytimePayload,
} from './playtime.mjs';

export const RUN_RECEIPT_SCHEMA_VERSION = 2;
export const DEFAULT_RUN_RECEIPT_SAVE_KEY = `${CAMPAIGN.id}.run-receipt.v${RUN_RECEIPT_SCHEMA_VERSION}`;
export const LEGACY_RUN_RECEIPT_SAVE_KEY = `${CAMPAIGN.id}.run-receipt.v1`;
export const RUN_RECEIPT_STATUSES = Object.freeze({ ACTIVE: 'active', COMPLETE: 'complete' });

const RUN_KEYS = Object.freeze([
  'schemaVersion',
  'campaignId',
  'runId',
  'cleanStart',
  'status',
  'creditsCompleted',
  'playtime',
  'completedBeatIds',
  'firstClearEncounterIds',
  'revision',
]);
const LEGACY_RUN_KEYS = Object.freeze(RUN_KEYS.filter((key) => key !== 'creditsCompleted'));
const BEAT_IDS = Object.freeze(CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.id)));
const ENCOUNTER_IDS = Object.freeze(ENCOUNTERS.map((encounter) => encounter.id));
const ENCOUNTER_ID_SET = new Set(ENCOUNTER_IDS);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function validRunId(runId) {
  return typeof runId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(runId);
}

function statusFor(creditsCompleted) {
  return creditsCompleted ? RUN_RECEIPT_STATUSES.COMPLETE : RUN_RECEIPT_STATUSES.ACTIVE;
}

function buildState({ runId, creditsCompleted = false, playtime, completedBeatIds, firstClearEncounterIds, revision }) {
  return Object.freeze({
    schemaVersion: RUN_RECEIPT_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    runId,
    cleanStart: true,
    status: statusFor(creditsCompleted),
    creditsCompleted,
    playtime,
    completedBeatIds: Object.freeze([...completedBeatIds]),
    firstClearEncounterIds: Object.freeze([...firstClearEncounterIds]),
    revision,
  });
}

function failure(code, errors, state = undefined) {
  return Object.freeze({
    ok: false,
    code,
    ...(state ? { state } : {}),
    errors: Object.freeze([...errors]),
  });
}

function success(state, details = {}) {
  return Object.freeze({ ok: true, state, ...details });
}

function pristineStartErrors(campaignState, advancementState) {
  const errors = [];
  const campaign = validateCampaignPayload(campaignState);
  if (!campaign.ok) errors.push(...campaign.errors.map((error) => `campaign: ${error}`));
  else if (JSON.stringify(campaign.value) !== JSON.stringify(createCampaignState())) {
    errors.push('campaign state must be the pristine New Game state.');
  }
  const advancement = validateAdvancementPayload(advancementState);
  if (!advancement.ok) errors.push(...advancement.errors.map((error) => `advancement: ${error}`));
  else if (JSON.stringify(advancement.value) !== JSON.stringify(createAdvancementState())) {
    errors.push('advancement state must be the pristine New Game state.');
  }
  return errors;
}

/** Start a zero-based receipt only beside clean New Game authorities. */
export function createRunReceipt({ runId, campaignState, advancementState } = {}) {
  const errors = [];
  if (!validRunId(runId)) errors.push('runId must be 8-128 URL-safe identifier characters.');
  errors.push(...pristineStartErrors(campaignState, advancementState));
  if (errors.length) return failure('invalid-run-start', errors);
  return success(buildState({
    runId,
    creditsCompleted: false,
    playtime: createPlaytimeState(),
    completedBeatIds: [],
    firstClearEncounterIds: [],
    revision: 0,
  }), { created: true });
}

function validateCanonicalPrefix(ids, canonicalIds, label, errors) {
  if (!Array.isArray(ids)) {
    errors.push(`${label} must be an array.`);
    return [];
  }
  ids.forEach((id, index) => {
    if (id !== canonicalIds[index]) errors.push(`${label} must be the canonical contiguous prefix.`);
  });
  if (ids.length > canonicalIds.length) errors.push(`${label} contains too many entries.`);
  return ids;
}

function validateFirstClearIds(ids, errors) {
  if (!Array.isArray(ids)) {
    errors.push('firstClearEncounterIds must be an array.');
    return [];
  }
  const seen = new Set();
  let priorIndex = -1;
  ids.forEach((id, index) => {
    const canonicalIndex = ENCOUNTER_IDS.indexOf(id);
    if (!ENCOUNTER_ID_SET.has(id)) errors.push(`firstClearEncounterIds[${index}] is not canonical.`);
    if (seen.has(id)) errors.push(`firstClearEncounterIds contains duplicate ${id}.`);
    if (canonicalIndex <= priorIndex) errors.push('firstClearEncounterIds must use canonical encounter order.');
    seen.add(id);
    priorIndex = canonicalIndex;
  });
  return ids;
}

/** Validate serialized or object-shaped run evidence without trusting callers. */
export function validateRunReceiptPayload(payload) {
  const errors = [];
  if (!isPlainObject(payload)) return failure('invalid-run-receipt', ['Run receipt must be a plain object.']);
  if (payload.schemaVersion === 1) return validateLegacyRunReceiptPayload(payload);
  const keys = Object.keys(payload);
  if (keys.length !== RUN_KEYS.length || keys.some((key, index) => key !== RUN_KEYS[index])) {
    errors.push('Run receipt keys or order are invalid.');
  }
  if (payload.schemaVersion !== RUN_RECEIPT_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${RUN_RECEIPT_SCHEMA_VERSION}.`);
  if (payload.campaignId !== CAMPAIGN.id) errors.push(`campaignId must equal ${CAMPAIGN.id}.`);
  if (!validRunId(payload.runId)) errors.push('runId is invalid.');
  if (payload.cleanStart !== true) errors.push('cleanStart must be true.');
  if (!Object.values(RUN_RECEIPT_STATUSES).includes(payload.status)) errors.push('status is invalid.');
  if (typeof payload.creditsCompleted !== 'boolean') errors.push('creditsCompleted must be a boolean.');
  if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) errors.push('revision must be a non-negative safe integer.');

  const playtimeValidation = validatePlaytimePayload(payload.playtime);
  if (!playtimeValidation.ok) errors.push(...playtimeValidation.errors.map((error) => `playtime: ${error}`));
  const completedBeatIds = validateCanonicalPrefix(payload.completedBeatIds, BEAT_IDS, 'completedBeatIds', errors);
  const firstClearEncounterIds = validateFirstClearIds(payload.firstClearEncounterIds, errors);
  if (payload.creditsCompleted === true && completedBeatIds.length !== BEAT_IDS.length) {
    errors.push('credits cannot be completed before every canonical beat.');
  }
  if (typeof payload.creditsCompleted === 'boolean' && payload.status !== statusFor(payload.creditsCompleted)) {
    errors.push('status must match credits completion.');
  }
  if (playtimeValidation.ok && Number.isSafeInteger(payload.revision)) {
    const expectedRevision = playtimeValidation.state.revision + completedBeatIds.length
      + firstClearEncounterIds.length + (payload.creditsCompleted === true ? 1 : 0);
    if (payload.revision !== expectedRevision) errors.push('revision does not match the run transition receipt.');
  }
  if (errors.length) return failure('invalid-run-receipt', errors);
  return Object.freeze({
    ok: true,
    state: buildState({
      runId: payload.runId,
      creditsCompleted: payload.creditsCompleted,
      playtime: playtimeValidation.state,
      completedBeatIds,
      firstClearEncounterIds,
      revision: payload.revision,
    }),
    errors: Object.freeze([]),
  });
}

function validateLegacyRunReceiptPayload(payload) {
  const errors = [];
  const keys = Object.keys(payload);
  if (keys.length !== LEGACY_RUN_KEYS.length || keys.some((key, index) => key !== LEGACY_RUN_KEYS[index])) {
    errors.push('Legacy run receipt keys or order are invalid.');
  }
  if (payload.schemaVersion !== 1) errors.push('Legacy schemaVersion must equal 1.');
  if (payload.campaignId !== CAMPAIGN.id) errors.push(`campaignId must equal ${CAMPAIGN.id}.`);
  if (!validRunId(payload.runId)) errors.push('runId is invalid.');
  if (payload.cleanStart !== true) errors.push('cleanStart must be true.');
  if (!Object.values(RUN_RECEIPT_STATUSES).includes(payload.status)) errors.push('status is invalid.');
  if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) errors.push('revision must be a non-negative safe integer.');

  const playtimeValidation = validatePlaytimePayload(payload.playtime);
  if (!playtimeValidation.ok) errors.push(...playtimeValidation.errors.map((error) => `playtime: ${error}`));
  const completedBeatIds = validateCanonicalPrefix(payload.completedBeatIds, BEAT_IDS, 'completedBeatIds', errors);
  const firstClearEncounterIds = validateFirstClearIds(payload.firstClearEncounterIds, errors);
  const legacyStatus = completedBeatIds.length === BEAT_IDS.length
    ? RUN_RECEIPT_STATUSES.COMPLETE
    : RUN_RECEIPT_STATUSES.ACTIVE;
  if (payload.status !== legacyStatus) errors.push('Legacy status must match canonical campaign completion.');
  if (playtimeValidation.ok && Number.isSafeInteger(payload.revision)) {
    const expectedRevision = playtimeValidation.state.revision + completedBeatIds.length + firstClearEncounterIds.length;
    if (payload.revision !== expectedRevision) errors.push('revision does not match the legacy run transition receipt.');
  }
  if (errors.length) return failure('invalid-run-receipt', errors);
  return Object.freeze({
    ok: true,
    state: buildState({
      runId: payload.runId,
      creditsCompleted: false,
      playtime: playtimeValidation.state,
      completedBeatIds,
      firstClearEncounterIds,
      revision: payload.revision,
    }),
    migrated: true,
    fromSchemaVersion: 1,
    errors: Object.freeze([]),
  });
}

function assertReceipt(state) {
  const validation = validateRunReceiptPayload(state);
  if (!validation.ok) throw new TypeError(validation.errors.join(' '));
  return validation.state;
}

function transitionGuard(state, runId) {
  if (runId !== state.runId) return failure('run-id-mismatch', ['Transition runId does not match the active receipt.'], state);
  if (state.status === RUN_RECEIPT_STATUSES.COMPLETE) return failure('run-complete', ['Completed run receipts are immutable.'], state);
  return null;
}

/** Record one already activity-gated sample inside this run only. */
export function recordRunPlaytime(state, runId, category, elapsedMs, options = {}) {
  const snapshot = assertReceipt(state);
  const blocked = transitionGuard(snapshot, runId);
  if (blocked) return blocked;
  let playtime;
  try {
    playtime = recordPlaytime(snapshot.playtime, category, elapsedMs, options);
  } catch (error) {
    return failure('invalid-playtime-sample', [error instanceof Error ? error.message : 'Playtime sample is invalid.'], snapshot);
  }
  if (playtime === snapshot.playtime) return success(snapshot, { recordedMs: 0 });
  return success(buildState({
    ...snapshot,
    playtime,
    revision: snapshot.revision + 1,
  }), { recordedMs: elapsedMs });
}

/** Record one encounter's first clear for this run, once, in canonical order. */
export function recordRunFirstClear(state, runId, encounterId) {
  const snapshot = assertReceipt(state);
  const blocked = transitionGuard(snapshot, runId);
  if (blocked) return blocked;
  if (!ENCOUNTER_ID_SET.has(encounterId)) return failure('unknown-encounter', [`Unknown encounter ID: ${encounterId}.`], snapshot);
  if (snapshot.firstClearEncounterIds.includes(encounterId)) {
    return success(snapshot, { recorded: false, firstClearCount: snapshot.firstClearEncounterIds.length });
  }
  const selected = new Set([...snapshot.firstClearEncounterIds, encounterId]);
  const firstClearEncounterIds = ENCOUNTER_IDS.filter((id) => selected.has(id));
  const next = buildState({
    ...snapshot,
    firstClearEncounterIds,
    revision: snapshot.revision + 1,
  });
  return success(next, { recorded: true, firstClearCount: firstClearEncounterIds.length });
}

/** Advance the same run's canonical beat prefix; story completion remains active through post-final camp. */
export function recordRunBeatCompletion(state, runId, beatId) {
  const snapshot = assertReceipt(state);
  const blocked = transitionGuard(snapshot, runId);
  if (blocked) return blocked;
  if (snapshot.completedBeatIds.includes(beatId)) {
    return success(snapshot, { recorded: false, campaignComplete: false });
  }
  const expected = BEAT_IDS[snapshot.completedBeatIds.length];
  if (beatId !== expected) {
    return failure('out-of-order-beat', [`Expected canonical beat ${expected}; received ${beatId}.`], snapshot);
  }
  const completedBeatIds = [...snapshot.completedBeatIds, beatId];
  const next = buildState({
    ...snapshot,
    completedBeatIds,
    revision: snapshot.revision + 1,
  });
  return success(next, {
    recorded: true,
    storyComplete: completedBeatIds.length === BEAT_IDS.length,
    campaignComplete: false,
    completedBeatCount: completedBeatIds.length,
  });
}

/** Explicitly finish the credits and seal an otherwise complete story receipt. */
export function completeRunCredits(state, runId) {
  const snapshot = assertReceipt(state);
  const blocked = transitionGuard(snapshot, runId);
  if (blocked) return blocked;
  if (snapshot.completedBeatIds.length !== BEAT_IDS.length) {
    return failure('story-incomplete', ['Credits cannot seal the run before every canonical beat is complete.'], snapshot);
  }
  return success(buildState({
    ...snapshot,
    creditsCompleted: true,
    revision: snapshot.revision + 1,
  }), { recorded: true, storyComplete: true, campaignComplete: true });
}

/** Return a validated proof that can only consume evidence owned by this run. */
export function getRunProofReport(state) {
  const snapshot = assertReceipt(state);
  const storyComplete = snapshot.completedBeatIds.length === BEAT_IDS.length;
  const creditsComplete = snapshot.creditsCompleted === true;
  const campaignComplete = storyComplete && creditsComplete
    && snapshot.status === RUN_RECEIPT_STATUSES.COMPLETE;
  const pacing = getPlaytimeReport(snapshot.playtime, {
    campaignComplete,
    firstClearEncounterIds: snapshot.firstClearEncounterIds,
  });
  return deepFreeze({
    valid: true,
    runScoped: true,
    runId: snapshot.runId,
    cleanStart: snapshot.cleanStart,
    status: snapshot.status,
    storyComplete,
    creditsComplete,
    completedBeatCount: snapshot.completedBeatIds.length,
    requiredBeatCount: BEAT_IDS.length,
    missingBeatIds: BEAT_IDS.slice(snapshot.completedBeatIds.length),
    completedBeatIds: snapshot.completedBeatIds,
    firstClearEncounterIds: snapshot.firstClearEncounterIds,
    missingFirstClearEncounterIds: ENCOUNTER_IDS.filter((id) => !snapshot.firstClearEncounterIds.includes(id)),
    ...pacing,
  });
}

export function serializeRunReceipt(state) {
  return JSON.stringify(assertReceipt(state));
}

export function loadRunReceipt(serializedOrPayload) {
  if (serializedOrPayload == null || serializedOrPayload === '') {
    return Object.freeze({ ok: true, found: false, state: null, errors: Object.freeze([]) });
  }
  if (typeof serializedOrPayload === 'string') {
    try {
      const validation = validateRunReceiptPayload(JSON.parse(serializedOrPayload));
      return Object.freeze({ ...validation, found: validation.ok });
    } catch {
      return failure('invalid-run-receipt', ['Run receipt is not valid JSON.']);
    }
  }
  const validation = validateRunReceiptPayload(serializedOrPayload);
  return Object.freeze({ ...validation, found: validation.ok });
}

export function createRunReceiptStorageAdapter(storage = undefined, key = DEFAULT_RUN_RECEIPT_SAVE_KEY) {
  const target = storage === undefined ? getDefaultBrowserStorage() : storage;
  const available = Boolean(target && typeof target.getItem === 'function' && typeof target.setItem === 'function' && typeof target.removeItem === 'function');
  const unavailable = () => Object.freeze({ ok: false, code: 'storage-unavailable' });
  return Object.freeze({
    key,
    available,
    load() {
      if (!available) return unavailable();
      try {
        const current = target.getItem(key);
        if (current != null && current !== '') return loadRunReceipt(current);
        if (key !== DEFAULT_RUN_RECEIPT_SAVE_KEY) return loadRunReceipt(current);
        const legacy = target.getItem(LEGACY_RUN_RECEIPT_SAVE_KEY);
        const loaded = loadRunReceipt(legacy);
        if (!loaded.ok || !loaded.found || !loaded.migrated) return loaded;
        let migrationPersisted = false;
        try {
          target.setItem(key, serializeRunReceipt(loaded.state));
          target.removeItem(LEGACY_RUN_RECEIPT_SAVE_KEY);
          migrationPersisted = true;
        } catch {
          // A valid in-memory migration remains usable; the next load can retry persistence.
        }
        return Object.freeze({ ...loaded, migrationPersisted });
      }
      catch { return Object.freeze({ ok: false, code: 'storage-read-failed' }); }
    },
    save(state) {
      if (!available) return unavailable();
      let serialized;
      try { serialized = serializeRunReceipt(state); }
      catch { return Object.freeze({ ok: false, code: 'invalid-state' }); }
      try { target.setItem(key, serialized); return Object.freeze({ ok: true }); }
      catch { return Object.freeze({ ok: false, code: 'storage-write-failed' }); }
    },
    clear() {
      if (!available) return unavailable();
      try {
        target.removeItem(key);
        if (key === DEFAULT_RUN_RECEIPT_SAVE_KEY) target.removeItem(LEGACY_RUN_RECEIPT_SAVE_KEY);
        return Object.freeze({ ok: true });
      }
      catch { return Object.freeze({ ok: false, code: 'storage-clear-failed' }); }
    },
  });
}
