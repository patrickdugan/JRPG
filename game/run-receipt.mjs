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

export const RUN_RECEIPT_SCHEMA_VERSION = 3;
export const DEFAULT_RUN_RECEIPT_SAVE_KEY = `${CAMPAIGN.id}.run-receipt.v${RUN_RECEIPT_SCHEMA_VERSION}`;
export const LEGACY_RUN_RECEIPT_SAVE_KEY = `${CAMPAIGN.id}.run-receipt.v1`;
export const LEGACY_RUN_RECEIPT_V2_SAVE_KEY = `${CAMPAIGN.id}.run-receipt.v2`;
export const RUN_RECEIPT_STATUSES = Object.freeze({ ACTIVE: 'active', COMPLETE: 'complete' });
export const RUN_RECEIPT_PROFILE_IDS = Object.freeze({
  COMPLETIONIST_20H: 'completionist-20h-v1',
  NARRATIVE_5_6H: 'narrative-5-6h-v1',
});

/**
 * Stable Storyworld decision IDs required by the narrative profile.
 *
 * The receipt deliberately does not import the Storyworld runtime. Callers
 * bridge a completed Storyworld cluster through recordRunStoryworldDecision;
 * this ordered contract keeps proof validation strict and independently
 * serializable.
 */
export const NARRATIVE_STORYWORLD_DECISION_IDS = Object.freeze([
  'sw1-clerks-second-copy',
  'sw2-witness-not-family',
  'sw3-sayos-warehouse-conditions',
  'sw4-margin-varga-journal',
  'sw5-cipher-handoff',
  'sw6-tribunal-afterword',
  'sw7-soldier-will-not-follow',
  'sw8-boats-with-conditions',
  'sw-enma-three-terms',
  'sw9-mateus-living-archive',
  'sw10-corrections-desk',
]);

const MINUTE_MS = 60_000;
export const RUN_RECEIPT_PROFILE_CONTRACTS = Object.freeze({
  [RUN_RECEIPT_PROFILE_IDS.COMPLETIONIST_20H]: Object.freeze({
    id: RUN_RECEIPT_PROFILE_IDS.COMPLETIONIST_20H,
    label: 'Completionist 20-hour route',
    minimumActiveMinutes: 1_200,
    maximumActiveMinutes: null,
    requiredCanonicalBeatCount: CAMPAIGN.chapters.reduce((sum, chapter) => sum + chapter.beats.length, 0),
    requiredStoryworldDecisionIds: Object.freeze([]),
    requiresAllFirstClears: true,
  }),
  [RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H]: Object.freeze({
    id: RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H,
    label: 'Narrative 5-6 hour route',
    minimumActiveMinutes: 300,
    maximumActiveMinutes: 360,
    requiredCanonicalBeatCount: CAMPAIGN.chapters.reduce((sum, chapter) => sum + chapter.beats.length, 0),
    requiredStoryworldDecisionIds: NARRATIVE_STORYWORLD_DECISION_IDS,
    requiresAllFirstClears: false,
  }),
});

const RUN_KEYS = Object.freeze([
  'schemaVersion',
  'campaignId',
  'profileId',
  'runId',
  'cleanStart',
  'status',
  'creditsCompleted',
  'playtime',
  'completedBeatIds',
  'completedStoryworldDecisionIds',
  'firstClearEncounterIds',
  'revision',
]);
const V2_RUN_KEYS = Object.freeze([
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
const LEGACY_RUN_KEYS = Object.freeze(V2_RUN_KEYS.filter((key) => key !== 'creditsCompleted'));
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

function buildState({
  profileId = RUN_RECEIPT_PROFILE_IDS.COMPLETIONIST_20H,
  runId,
  creditsCompleted = false,
  playtime,
  completedBeatIds,
  completedStoryworldDecisionIds = [],
  firstClearEncounterIds,
  revision,
}) {
  return Object.freeze({
    schemaVersion: RUN_RECEIPT_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    profileId,
    runId,
    cleanStart: true,
    status: statusFor(creditsCompleted),
    creditsCompleted,
    playtime,
    completedBeatIds: Object.freeze([...completedBeatIds]),
    completedStoryworldDecisionIds: Object.freeze([...completedStoryworldDecisionIds]),
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
export function createRunReceipt({
  runId,
  campaignState,
  advancementState,
  profileId = RUN_RECEIPT_PROFILE_IDS.COMPLETIONIST_20H,
} = {}) {
  const errors = [];
  if (!validRunId(runId)) errors.push('runId must be 8-128 URL-safe identifier characters.');
  if (!Object.hasOwn(RUN_RECEIPT_PROFILE_CONTRACTS, profileId)) errors.push('profileId is not a supported run profile.');
  errors.push(...pristineStartErrors(campaignState, advancementState));
  if (errors.length) return failure('invalid-run-start', errors);
  return success(buildState({
    profileId,
    runId,
    creditsCompleted: false,
    playtime: createPlaytimeState(),
    completedBeatIds: [],
    completedStoryworldDecisionIds: [],
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

function profileContract(profileId) {
  return RUN_RECEIPT_PROFILE_CONTRACTS[profileId] ?? null;
}

function validateStoryworldDecisionIds(ids, contract, errors) {
  if (!Array.isArray(ids)) {
    errors.push('completedStoryworldDecisionIds must be an array.');
    return [];
  }
  const canonicalIds = contract?.requiredStoryworldDecisionIds ?? [];
  ids.forEach((id, index) => {
    if (id !== canonicalIds[index]) {
      errors.push('completedStoryworldDecisionIds must be the profile\'s canonical contiguous prefix.');
    }
  });
  if (ids.length > canonicalIds.length) {
    errors.push('completedStoryworldDecisionIds contains too many entries for the run profile.');
  }
  return ids;
}

function completionErrors(profileId, completedBeatIds, completedStoryworldDecisionIds) {
  const contract = profileContract(profileId);
  if (!contract) return ['Run profile is unsupported.'];
  const errors = [];
  if (completedBeatIds.length !== BEAT_IDS.length) errors.push('every canonical beat');
  if (completedStoryworldDecisionIds.length !== contract.requiredStoryworldDecisionIds.length) {
    errors.push('every required Storyworld decision');
  }
  return errors;
}

/** Validate serialized or object-shaped run evidence without trusting callers. */
export function validateRunReceiptPayload(payload) {
  const errors = [];
  if (!isPlainObject(payload)) return failure('invalid-run-receipt', ['Run receipt must be a plain object.']);
  if (payload.schemaVersion === 1) return validateLegacyRunReceiptPayload(payload);
  if (payload.schemaVersion === 2) return validateV2RunReceiptPayload(payload);
  const keys = Object.keys(payload);
  if (keys.length !== RUN_KEYS.length || keys.some((key, index) => key !== RUN_KEYS[index])) {
    errors.push('Run receipt keys or order are invalid.');
  }
  if (payload.schemaVersion !== RUN_RECEIPT_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${RUN_RECEIPT_SCHEMA_VERSION}.`);
  if (payload.campaignId !== CAMPAIGN.id) errors.push(`campaignId must equal ${CAMPAIGN.id}.`);
  const contract = profileContract(payload.profileId);
  if (!contract) errors.push('profileId is not a supported run profile.');
  if (!validRunId(payload.runId)) errors.push('runId is invalid.');
  if (payload.cleanStart !== true) errors.push('cleanStart must be true.');
  if (!Object.values(RUN_RECEIPT_STATUSES).includes(payload.status)) errors.push('status is invalid.');
  if (typeof payload.creditsCompleted !== 'boolean') errors.push('creditsCompleted must be a boolean.');
  if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) errors.push('revision must be a non-negative safe integer.');

  const playtimeValidation = validatePlaytimePayload(payload.playtime);
  if (!playtimeValidation.ok) errors.push(...playtimeValidation.errors.map((error) => `playtime: ${error}`));
  const completedBeatIds = validateCanonicalPrefix(payload.completedBeatIds, BEAT_IDS, 'completedBeatIds', errors);
  const completedStoryworldDecisionIds = validateStoryworldDecisionIds(
    payload.completedStoryworldDecisionIds,
    contract,
    errors,
  );
  const firstClearEncounterIds = validateFirstClearIds(payload.firstClearEncounterIds, errors);
  if (payload.creditsCompleted === true) {
    const missing = completionErrors(payload.profileId, completedBeatIds, completedStoryworldDecisionIds);
    if (missing.length) errors.push(`credits cannot be completed before ${missing.join(' and ')}.`);
    if (payload.profileId === RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H && contract && playtimeValidation.ok
      && playtimeValidation.state.totalMs < contract.minimumActiveMinutes * MINUTE_MS) {
      errors.push(`credits cannot be completed before ${contract.minimumActiveMinutes} active minutes.`);
    }
  }
  if (typeof payload.creditsCompleted === 'boolean' && payload.status !== statusFor(payload.creditsCompleted)) {
    errors.push('status must match credits completion.');
  }
  if (playtimeValidation.ok && Number.isSafeInteger(payload.revision)) {
    const expectedRevision = playtimeValidation.state.revision + completedBeatIds.length
      + completedStoryworldDecisionIds.length + firstClearEncounterIds.length
      + (payload.creditsCompleted === true ? 1 : 0);
    if (payload.revision !== expectedRevision) errors.push('revision does not match the run transition receipt.');
  }
  if (errors.length) return failure('invalid-run-receipt', errors);
  return Object.freeze({
    ok: true,
    state: buildState({
      profileId: payload.profileId,
      runId: payload.runId,
      creditsCompleted: payload.creditsCompleted,
      playtime: playtimeValidation.state,
      completedBeatIds,
      completedStoryworldDecisionIds,
      firstClearEncounterIds,
      revision: payload.revision,
    }),
    errors: Object.freeze([]),
  });
}

function validateV2RunReceiptPayload(payload) {
  const errors = [];
  const keys = Object.keys(payload);
  if (keys.length !== V2_RUN_KEYS.length || keys.some((key, index) => key !== V2_RUN_KEYS[index])) {
    errors.push('Schema-two run receipt keys or order are invalid.');
  }
  if (payload.schemaVersion !== 2) errors.push('Schema-two schemaVersion must equal 2.');
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
    if (payload.revision !== expectedRevision) errors.push('revision does not match the schema-two run transition receipt.');
  }
  if (errors.length) return failure('invalid-run-receipt', errors);
  return Object.freeze({
    ok: true,
    state: buildState({
      profileId: RUN_RECEIPT_PROFILE_IDS.COMPLETIONIST_20H,
      runId: payload.runId,
      creditsCompleted: payload.creditsCompleted,
      playtime: playtimeValidation.state,
      completedBeatIds,
      completedStoryworldDecisionIds: [],
      firstClearEncounterIds,
      revision: payload.revision,
    }),
    migrated: true,
    fromSchemaVersion: 2,
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
      profileId: RUN_RECEIPT_PROFILE_IDS.COMPLETIONIST_20H,
      runId: payload.runId,
      creditsCompleted: false,
      playtime: playtimeValidation.state,
      completedBeatIds,
      completedStoryworldDecisionIds: [],
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
    storyComplete: completionErrors(
      snapshot.profileId,
      completedBeatIds,
      snapshot.completedStoryworldDecisionIds,
    ).length === 0,
    campaignComplete: false,
    completedBeatCount: completedBeatIds.length,
  });
}

/**
 * Bridge one completed Storyworld cluster into the run receipt.
 *
 * IDs are an exact ordered profile contract, so a caller cannot substitute an
 * arbitrary encounter or skip a decision. Completionist receipts intentionally
 * reject this transition because Storyworld evidence is not part of that
 * legacy proof definition.
 */
export function recordRunStoryworldDecision(state, runId, decisionId) {
  const snapshot = assertReceipt(state);
  const blocked = transitionGuard(snapshot, runId);
  if (blocked) return blocked;
  const contract = profileContract(snapshot.profileId);
  const requiredIds = contract.requiredStoryworldDecisionIds;
  if (requiredIds.length === 0) {
    return failure('profile-does-not-track-storyworld', [
      `Run profile ${snapshot.profileId} does not track Storyworld decisions.`,
    ], snapshot);
  }
  if (snapshot.completedStoryworldDecisionIds.includes(decisionId)) {
    return success(snapshot, {
      recorded: false,
      storyworldComplete: snapshot.completedStoryworldDecisionIds.length === requiredIds.length,
      completedStoryworldDecisionCount: snapshot.completedStoryworldDecisionIds.length,
    });
  }
  const expected = requiredIds[snapshot.completedStoryworldDecisionIds.length];
  if (decisionId !== expected) {
    return failure('out-of-order-storyworld-decision', [
      `Expected Storyworld decision ${expected}; received ${decisionId}.`,
    ], snapshot);
  }
  const completedStoryworldDecisionIds = [...snapshot.completedStoryworldDecisionIds, decisionId];
  return success(buildState({
    ...snapshot,
    completedStoryworldDecisionIds,
    revision: snapshot.revision + 1,
  }), {
    recorded: true,
    storyworldComplete: completedStoryworldDecisionIds.length === requiredIds.length,
    completedStoryworldDecisionCount: completedStoryworldDecisionIds.length,
  });
}

/** Explicitly finish the credits and seal an otherwise complete story receipt. */
export function completeRunCredits(state, runId) {
  const snapshot = assertReceipt(state);
  const blocked = transitionGuard(snapshot, runId);
  if (blocked) return blocked;
  const missing = completionErrors(
    snapshot.profileId,
    snapshot.completedBeatIds,
    snapshot.completedStoryworldDecisionIds,
  );
  if (missing.length) {
    return failure('story-incomplete', [`Credits cannot seal the run before ${missing.join(' and ')}.`], snapshot);
  }
  const contract = profileContract(snapshot.profileId);
  const minimumActiveMs = contract.minimumActiveMinutes * MINUTE_MS;
  if (snapshot.profileId === RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H
    && snapshot.playtime.totalMs < minimumActiveMs) {
    return failure('playtime-incomplete', [
      `Credits cannot seal the narrative run before ${contract.minimumActiveMinutes} active minutes.`,
    ], snapshot);
  }
  return success(buildState({
    ...snapshot,
    creditsCompleted: true,
    revision: snapshot.revision + 1,
  }), { recorded: true, storyComplete: true, campaignComplete: true });
}

function getNarrativePlaytimeReport(state, campaignComplete, firstClearEncounterIds, contract) {
  const targetMs = contract.minimumActiveMinutes * MINUTE_MS;
  const maximumTargetMs = contract.maximumActiveMinutes * MINUTE_MS;
  const fixedTargetMs = 0;
  const fixedActualMs = state.totalMs - state.categories.grind;
  const firstClearCount = firstClearEncounterIds.length;
  const durationWithinTarget = state.totalMs >= targetMs && state.totalMs <= maximumTargetMs;
  return Object.freeze({
    totalMs: state.totalMs,
    totalMinutes: state.totalMs / MINUTE_MS,
    targetMs,
    maximumTargetMs,
    targetMinimumMinutes: contract.minimumActiveMinutes,
    targetMaximumMinutes: contract.maximumActiveMinutes,
    percentOfTarget: targetMs ? (state.totalMs / targetMs) * 100 : 0,
    remainingMs: Math.max(0, targetMs - state.totalMs),
    overTargetMs: Math.max(0, state.totalMs - maximumTargetMs),
    durationWithinTarget,
    fixedActualMs,
    fixedTargetMs,
    grindMs: state.categories.grind,
    categories: state.categories,
    chapterMs: state.chapterMs,
    campaignComplete,
    firstClearCount,
    requiredFirstClearCount: 0,
    firstClearsComplete: true,
    durationProven: campaignComplete && state.totalMs >= targetMs,
  });
}

/** Return a validated proof that can only consume evidence owned by this run. */
export function getRunProofReport(state) {
  const snapshot = assertReceipt(state);
  const contract = profileContract(snapshot.profileId);
  const canonicalStoryComplete = snapshot.completedBeatIds.length === BEAT_IDS.length;
  const storyworldDecisionsComplete = snapshot.completedStoryworldDecisionIds.length
    === contract.requiredStoryworldDecisionIds.length;
  const storyComplete = canonicalStoryComplete && storyworldDecisionsComplete;
  const creditsComplete = snapshot.creditsCompleted === true;
  const campaignComplete = storyComplete && creditsComplete
    && snapshot.status === RUN_RECEIPT_STATUSES.COMPLETE;
  const pacing = snapshot.profileId === RUN_RECEIPT_PROFILE_IDS.COMPLETIONIST_20H
    ? getPlaytimeReport(snapshot.playtime, {
      campaignComplete,
      firstClearEncounterIds: snapshot.firstClearEncounterIds,
    })
    : getNarrativePlaytimeReport(
      snapshot.playtime,
      campaignComplete,
      snapshot.firstClearEncounterIds,
      contract,
    );
  return deepFreeze({
    valid: true,
    runScoped: true,
    runId: snapshot.runId,
    profileId: snapshot.profileId,
    profileLabel: contract.label,
    cleanStart: snapshot.cleanStart,
    status: snapshot.status,
    canonicalStoryComplete,
    storyComplete,
    storyworldDecisionsComplete,
    creditsComplete,
    completedBeatCount: snapshot.completedBeatIds.length,
    requiredBeatCount: BEAT_IDS.length,
    missingBeatIds: BEAT_IDS.slice(snapshot.completedBeatIds.length),
    completedBeatIds: snapshot.completedBeatIds,
    completedStoryworldDecisionCount: snapshot.completedStoryworldDecisionIds.length,
    requiredStoryworldDecisionCount: contract.requiredStoryworldDecisionIds.length,
    completedStoryworldDecisionIds: snapshot.completedStoryworldDecisionIds,
    missingStoryworldDecisionIds: contract.requiredStoryworldDecisionIds.slice(
      snapshot.completedStoryworldDecisionIds.length,
    ),
    completedStoryworldPlayedSceneCount: snapshot.completedStoryworldDecisionIds.length * 2,
    requiredStoryworldPlayedSceneCount: contract.requiredStoryworldDecisionIds.length * 2,
    playedSceneCount: snapshot.completedBeatIds.length
      + (snapshot.completedStoryworldDecisionIds.length * 2),
    requiredPlayedSceneCount: BEAT_IDS.length
      + (contract.requiredStoryworldDecisionIds.length * 2),
    targetMinimumMinutes: contract.minimumActiveMinutes,
    targetMaximumMinutes: contract.maximumActiveMinutes,
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
        const legacyEntries = [
          [LEGACY_RUN_RECEIPT_V2_SAVE_KEY, target.getItem(LEGACY_RUN_RECEIPT_V2_SAVE_KEY)],
          [LEGACY_RUN_RECEIPT_SAVE_KEY, target.getItem(LEGACY_RUN_RECEIPT_SAVE_KEY)],
        ];
        const [legacyKey, legacy] = legacyEntries.find(([, value]) => value != null && value !== '') ?? [];
        const loaded = loadRunReceipt(legacy);
        if (!loaded.ok || !loaded.found || !loaded.migrated) return loaded;
        let migrationPersisted = false;
        try {
          target.setItem(key, serializeRunReceipt(loaded.state));
          target.removeItem(legacyKey);
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
        if (key === DEFAULT_RUN_RECEIPT_SAVE_KEY) {
          target.removeItem(LEGACY_RUN_RECEIPT_V2_SAVE_KEY);
          target.removeItem(LEGACY_RUN_RECEIPT_SAVE_KEY);
        }
        return Object.freeze({ ok: true });
      }
      catch { return Object.freeze({ ok: false, code: 'storage-clear-failed' }); }
    },
  });
}
