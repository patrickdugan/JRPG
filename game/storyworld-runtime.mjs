/** Deterministic, run-bound runtime for Campaign Storyworld encounters. */

import { CAMPAIGN } from './content/campaign.mjs';
import {
  STORYWORLD_CATALOG,
  STORYWORLD_CATALOG_SIGNATURE,
  STORYWORLD_CLUSTERS,
  STORYWORLD_CLUSTER_BY_ANCHOR_BEAT_ID,
  STORYWORLD_CLUSTER_BY_ID,
  STORYWORLD_PROPERTIES,
} from './content/storyworld-encounters.generated.mjs';
import { getDefaultBrowserStorage } from './browser-storage.mjs';

export const STORYWORLD_SCHEMA_VERSION = 1;
export const DEFAULT_STORYWORLD_SAVE_KEY = `${CAMPAIGN.id}.storyworld.v${STORYWORLD_SCHEMA_VERSION}`;

// Exact former identities may migrate only while their record prefix predates
// the structurally revised Chapter 9 sequence. Later saves are rejected rather
// than reinterpreting the old Corrections Desk as a surrender or execution the
// player never chose. Accepted early saves are validated against the current
// structural catalog and immediately re-frozen with current hashes.
export const LEGACY_STORYWORLD_CATALOG_IDENTITIES = Object.freeze([
  Object.freeze({
    sourceIFID: '7fd2f9d9-8d85-4f53-bcc9-7cb31ddd30d4',
    sourceHash: 'sha256:0066e58a7aaf8d749c2937c356015210277a86b730f467c032c6ceec9f1156c5',
    catalogSignature: 'sha256:fc3584c223773b6df0da2986a26a9393aba46a6d749d2d2b8186b22898c0a3ec',
    migrationId: 'lise-to-nikola-canon-v1',
    maximumCompatibleRecordCount: 8,
  }),
  Object.freeze({
    sourceIFID: '7fd2f9d9-8d85-4f53-bcc9-7cb31ddd30d4',
    sourceHash: 'sha256:3ea35ca34387a6844506552dc52f8edef4844859c568d5a1c236aa6ae93510f5',
    catalogSignature: 'sha256:7f439953b6dac6d20d1283f0c3b564005aa99770584cbe9838cd55deee962fee',
    migrationId: 'severed-dragon-ending-v1',
    maximumCompatibleRecordCount: 8,
  }),
]);

const CAMPAIGN_BEAT_IDS = Object.freeze(CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.id)));
const CAMPAIGN_BEAT_INDEX = new Map(CAMPAIGN_BEAT_IDS.map((beatId, index) => [beatId, index]));
const CLUSTER_INDEX = new Map(STORYWORLD_CLUSTERS.map((cluster, index) => [cluster.id, index]));
const PROPERTY_DEFAULTS = Object.freeze(Object.fromEntries(
  STORYWORLD_PROPERTIES.map(({ id, defaultValue }) => [id, defaultValue]),
));
const STATE_KEYS = Object.freeze([
  'schemaVersion',
  'campaignId',
  'sourceIFID',
  'sourceHash',
  'catalogSignature',
  'runId',
  'coverageStartBeatIndex',
  'proofEligible',
  'records',
  'revision',
]);
const RECORD_KEYS = Object.freeze([
  'clusterId',
  'phase',
  'entryOptionId',
  'entryReactionId',
  'outcomeEncounterId',
  'outcomeOptionId',
  'outcomeReactionId',
]);
const PHASES = Object.freeze(['entry', 'entry-reaction', 'outcome', 'outcome-reaction', 'complete']);

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function clampProperty(value) {
  return Math.round(Math.min(1, Math.max(0, value)) * 10_000) / 10_000;
}

function freezeRecord(record) {
  return Object.freeze({ ...record });
}

function freezeState({ runId, coverageStartBeatIndex, proofEligible, records, revision }) {
  return Object.freeze({
    schemaVersion: STORYWORLD_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    sourceIFID: STORYWORLD_CATALOG.sourceIFID,
    sourceHash: STORYWORLD_CATALOG.sourceHash,
    catalogSignature: STORYWORLD_CATALOG_SIGNATURE,
    runId,
    coverageStartBeatIndex,
    proofEligible,
    records: Object.freeze(records.map(freezeRecord)),
    revision,
  });
}

function result(ok, state, properties = {}) {
  return Object.freeze({ ok, state, ...properties });
}

function assertRunId(runId) {
  if (typeof runId !== 'string' || !runId.trim() || runId.length > 128) {
    throw new TypeError('Storyworld runId must be a non-empty string of at most 128 characters.');
  }
}

function assertCoverageStart(coverageStartBeatIndex) {
  if (!Number.isSafeInteger(coverageStartBeatIndex)
    || coverageStartBeatIndex < 0
    || coverageStartBeatIndex > CAMPAIGN_BEAT_IDS.length) {
    throw new RangeError(`coverageStartBeatIndex must be from 0 to ${CAMPAIGN_BEAT_IDS.length}.`);
  }
}

function expectedRecordRevision(record, cluster) {
  if (record.phase === 'entry') return 1;
  if (record.phase === 'entry-reaction') return 2;
  if (record.phase === 'outcome') return 3;
  if (record.phase === 'outcome-reaction') return 4;
  if (record.phase === 'complete') {
    const outcome = cluster.outcomes.find(({ id }) => id === record.outcomeEncounterId);
    return outcome?.terminal ? 4 : 5;
  }
  return 0;
}

function optionById(encounter, optionId) {
  return encounter?.options.find(({ id }) => id === optionId) ?? null;
}

function reactionById(option, reactionId) {
  return option?.reactions.find(({ id }) => id === reactionId) ?? null;
}

function validateRecord(record, index, errors) {
  if (!exactKeys(record, RECORD_KEYS)) {
    errors.push(`records[${index}] has invalid keys or key order.`);
    return null;
  }
  const cluster = STORYWORLD_CLUSTER_BY_ID.get(record.clusterId);
  if (!cluster) {
    errors.push(`records[${index}].clusterId is unknown.`);
    return null;
  }
  if (!PHASES.includes(record.phase)) errors.push(`records[${index}].phase is invalid.`);
  const entryOption = record.entryOptionId == null ? null : optionById(cluster.entry, record.entryOptionId);
  if (record.entryOptionId != null && !entryOption) errors.push(`records[${index}].entryOptionId is invalid.`);
  const entryReaction = record.entryReactionId == null ? null : reactionById(entryOption, record.entryReactionId);
  if (record.entryReactionId != null && !entryReaction) errors.push(`records[${index}].entryReactionId is invalid.`);
  const outcome = record.outcomeEncounterId == null
    ? null
    : cluster.outcomes.find(({ id }) => id === record.outcomeEncounterId) ?? null;
  if (record.outcomeEncounterId != null && !outcome) errors.push(`records[${index}].outcomeEncounterId is invalid.`);
  if (entryReaction && entryReaction.consequenceId !== record.outcomeEncounterId) {
    errors.push(`records[${index}] outcome does not match its entry reaction consequence.`);
  }
  const outcomeOption = record.outcomeOptionId == null ? null : optionById(outcome, record.outcomeOptionId);
  if (record.outcomeOptionId != null && !outcomeOption) errors.push(`records[${index}].outcomeOptionId is invalid.`);
  const outcomeReaction = record.outcomeReactionId == null ? null : reactionById(outcomeOption, record.outcomeReactionId);
  if (record.outcomeReactionId != null && !outcomeReaction) errors.push(`records[${index}].outcomeReactionId is invalid.`);

  const phaseIndex = PHASES.indexOf(record.phase);
  if (phaseIndex < 1 && [record.entryOptionId, record.entryReactionId, record.outcomeEncounterId].some((value) => value != null)) {
    errors.push(`records[${index}] contains entry resolution before its phase permits it.`);
  }
  if (phaseIndex >= 1 && (!entryOption || !entryReaction || !outcome)) {
    errors.push(`records[${index}] is missing its entry resolution.`);
  }
  if (phaseIndex < 3 && [record.outcomeOptionId, record.outcomeReactionId].some((value) => value != null)) {
    errors.push(`records[${index}] contains outcome resolution before its phase permits it.`);
  }
  if (phaseIndex >= 3 && outcome && !outcome.terminal && (!outcomeOption || !outcomeReaction)) {
    errors.push(`records[${index}] is missing its outcome resolution.`);
  }
  if (outcome?.terminal && [record.outcomeOptionId, record.outcomeReactionId].some((value) => value != null)) {
    errors.push(`records[${index}] terminal outcomes cannot contain an outcome option or reaction.`);
  }
  return cluster;
}

export function createStoryworldState({
  runId,
  coverageStartBeatIndex = 0,
  proofEligible = coverageStartBeatIndex === 0,
} = {}) {
  assertRunId(runId);
  assertCoverageStart(coverageStartBeatIndex);
  if (typeof proofEligible !== 'boolean') throw new TypeError('proofEligible must be a boolean.');
  if (coverageStartBeatIndex > 0 && proofEligible) {
    throw new RangeError('A Storyworld state beginning after beat zero cannot be proof eligible.');
  }
  return freezeState({ runId, coverageStartBeatIndex, proofEligible, records: [], revision: 0 });
}

export function createLegacyStoryworldState({ runId, coverageStartBeatIndex }) {
  return createStoryworldState({ runId, coverageStartBeatIndex, proofEligible: false });
}

export function validateStoryworldPayload(payload) {
  const errors = [];
  if (!exactKeys(payload, STATE_KEYS)) {
    return Object.freeze({ ok: false, errors: Object.freeze(['Storyworld save keys or key order are invalid.']) });
  }
  if (payload.schemaVersion !== STORYWORLD_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${STORYWORLD_SCHEMA_VERSION}.`);
  if (payload.campaignId !== CAMPAIGN.id) errors.push(`campaignId must equal ${CAMPAIGN.id}.`);
  if (payload.sourceIFID !== STORYWORLD_CATALOG.sourceIFID) errors.push('sourceIFID does not match the authored Storyworld.');
  if (payload.sourceHash !== STORYWORLD_CATALOG.sourceHash) errors.push('sourceHash does not match the authored Storyworld.');
  if (payload.catalogSignature !== STORYWORLD_CATALOG_SIGNATURE) errors.push('catalogSignature does not match the compiled Storyworld.');
  if (typeof payload.runId !== 'string' || !payload.runId.trim() || payload.runId.length > 128) errors.push('runId is invalid.');
  if (!Number.isSafeInteger(payload.coverageStartBeatIndex)
    || payload.coverageStartBeatIndex < 0
    || payload.coverageStartBeatIndex > CAMPAIGN_BEAT_IDS.length) errors.push('coverageStartBeatIndex is invalid.');
  if (typeof payload.proofEligible !== 'boolean') errors.push('proofEligible must be a boolean.');
  if (payload.coverageStartBeatIndex > 0 && payload.proofEligible) errors.push('late coverage cannot be proof eligible.');
  if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) errors.push('revision is invalid.');
  if (!Array.isArray(payload.records)) errors.push('records must be an array.');
  else {
    const seen = new Set();
    let priorIndex = -1;
    let expectedRevision = 0;
    for (const [index, record] of payload.records.entries()) {
      const cluster = validateRecord(record, index, errors);
      if (!cluster) continue;
      const clusterIndex = CLUSTER_INDEX.get(cluster.id);
      if (seen.has(cluster.id)) errors.push(`records[${index}] duplicates cluster ${cluster.id}.`);
      seen.add(cluster.id);
      if (clusterIndex <= priorIndex) errors.push('records must use canonical Storyworld cluster order.');
      priorIndex = clusterIndex;
      const anchorIndex = CAMPAIGN_BEAT_INDEX.get(cluster.anchorBeatId);
      if (anchorIndex < payload.coverageStartBeatIndex) errors.push(`records[${index}] predates coverageStartBeatIndex.`);
      expectedRevision += expectedRecordRevision(record, cluster);
    }
    if (payload.revision !== expectedRevision) errors.push(`revision must equal the exact transition count ${expectedRevision}.`);
  }
  if (errors.length) return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  return Object.freeze({
    ok: true,
    state: freezeState(payload),
    errors: Object.freeze([]),
  });
}

function assertState(state) {
  const validation = validateStoryworldPayload(state);
  if (!validation.ok) throw new TypeError(validation.errors.join(' '));
  return validation.state;
}

function replaceRecord(state, replacement) {
  const records = state.records.filter(({ clusterId }) => clusterId !== replacement.clusterId);
  records.push(replacement);
  records.sort((left, right) => CLUSTER_INDEX.get(left.clusterId) - CLUSTER_INDEX.get(right.clusterId));
  return freezeState({ ...state, records, revision: state.revision + 1 });
}

function applyEffects(projection, effects) {
  for (const { propertyId, delta } of effects) {
    if (!Object.hasOwn(projection, propertyId)) throw new RangeError(`Unknown Storyworld property ${propertyId}.`);
    projection[propertyId] = clampProperty(projection[propertyId] + delta);
  }
}

function recordedReactions(record, cluster) {
  const reactions = [];
  const entryOption = optionById(cluster.entry, record.entryOptionId);
  const entryReaction = reactionById(entryOption, record.entryReactionId);
  if (entryReaction) reactions.push(entryReaction);
  const outcome = cluster.outcomes.find(({ id }) => id === record.outcomeEncounterId);
  const outcomeOption = optionById(outcome, record.outcomeOptionId);
  const outcomeReaction = reactionById(outcomeOption, record.outcomeReactionId);
  if (outcomeReaction) reactions.push(outcomeReaction);
  return reactions;
}

export function deriveStoryworldProjection(state) {
  const snapshot = assertState(state);
  const projection = { ...PROPERTY_DEFAULTS };
  for (const record of snapshot.records) {
    const cluster = STORYWORLD_CLUSTER_BY_ID.get(record.clusterId);
    for (const reaction of recordedReactions(record, cluster)) applyEffects(projection, reaction.effects);
  }
  return Object.freeze(projection);
}

function reactionScore(reaction, projection) {
  const value = projection[reaction.score.propertyId];
  return reaction.score.offset + (reaction.score.invert ? 1 - value : value);
}

export function selectStoryworldReaction(option, projection) {
  if (!option?.reactions?.length) throw new RangeError('A Storyworld option must contain reactions.');
  let selected = option.reactions[0];
  let selectedScore = reactionScore(selected, projection);
  for (const reaction of option.reactions.slice(1)) {
    const score = reactionScore(reaction, projection);
    if (score >= selectedScore) {
      selected = reaction;
      selectedScore = score;
    }
  }
  return Object.freeze({ reaction: selected, score: selectedScore });
}

export function getStoryworldClusterForBeat(beatId) {
  return STORYWORLD_CLUSTER_BY_ANCHOR_BEAT_ID.get(beatId) ?? null;
}

export function getStoryworldProgress(state, clusterId) {
  const snapshot = assertState(state);
  const cluster = STORYWORLD_CLUSTER_BY_ID.get(clusterId);
  if (!cluster) throw new RangeError(`Unknown Storyworld cluster ${clusterId}.`);
  const record = snapshot.records.find((entry) => entry.clusterId === clusterId) ?? null;
  const outcome = record?.outcomeEncounterId
    ? cluster.outcomes.find(({ id }) => id === record.outcomeEncounterId) ?? null
    : null;
  return Object.freeze({ cluster, record, outcome, phase: record?.phase ?? 'unseen', complete: record?.phase === 'complete' });
}

export function getStoryworldGateForBeat(state, beatId, placement = 'after-beat') {
  const snapshot = assertState(state);
  const cluster = getStoryworldClusterForBeat(beatId);
  if (!cluster || cluster.placement !== placement) {
    return Object.freeze({ required: false, complete: true, cluster: cluster ?? null, phase: null, placement });
  }
  const anchorIndex = CAMPAIGN_BEAT_INDEX.get(beatId);
  if (anchorIndex < snapshot.coverageStartBeatIndex) {
    return Object.freeze({ required: false, complete: true, cluster, phase: 'legacy-exempt', placement });
  }
  const progress = getStoryworldProgress(snapshot, cluster.id);
  return Object.freeze({ required: true, complete: progress.complete, cluster, phase: progress.phase, placement });
}

export function beginStoryworldEncounter(state, clusterId) {
  const snapshot = assertState(state);
  const cluster = STORYWORLD_CLUSTER_BY_ID.get(clusterId);
  if (!cluster) return result(false, snapshot, { code: 'unknown-cluster' });
  const anchorIndex = CAMPAIGN_BEAT_INDEX.get(cluster.anchorBeatId);
  if (anchorIndex < snapshot.coverageStartBeatIndex) return result(false, snapshot, { code: 'legacy-exempt' });
  const existing = snapshot.records.find((record) => record.clusterId === clusterId);
  if (existing) return result(false, snapshot, { code: existing.phase === 'complete' ? 'already-complete' : 'already-started' });
  const record = {
    clusterId,
    phase: 'entry',
    entryOptionId: null,
    entryReactionId: null,
    outcomeEncounterId: null,
    outcomeOptionId: null,
    outcomeReactionId: null,
  };
  const next = replaceRecord(snapshot, record);
  return result(true, next, { code: 'started', progress: getStoryworldProgress(next, clusterId) });
}

export function getVisibleStoryworldOptions(state, clusterId) {
  const progress = getStoryworldProgress(state, clusterId);
  if (progress.phase === 'entry') return progress.cluster.entry.options;
  if (progress.phase === 'outcome' && !progress.outcome?.terminal) return progress.outcome.options;
  return Object.freeze([]);
}

export function chooseStoryworldOption(state, clusterId, optionId) {
  const snapshot = assertState(state);
  const progress = getStoryworldProgress(snapshot, clusterId);
  if (!progress.record) return result(false, snapshot, { code: 'not-started' });
  if (!['entry', 'outcome'].includes(progress.phase)) return result(false, snapshot, { code: 'choice-unavailable' });
  const encounter = progress.phase === 'entry' ? progress.cluster.entry : progress.outcome;
  if (encounter?.terminal) return result(false, snapshot, { code: 'terminal-outcome' });
  const option = optionById(encounter, optionId);
  if (!option) return result(false, snapshot, { code: 'unknown-option' });
  if (!option.visible || !option.performable) return result(false, snapshot, { code: 'option-unavailable' });
  const projectionBefore = deriveStoryworldProjection(snapshot);
  const { reaction, score } = selectStoryworldReaction(option, projectionBefore);
  const record = progress.phase === 'entry'
    ? {
      ...progress.record,
      phase: 'entry-reaction',
      entryOptionId: option.id,
      entryReactionId: reaction.id,
      outcomeEncounterId: reaction.consequenceId,
    }
    : {
      ...progress.record,
      phase: 'outcome-reaction',
      outcomeOptionId: option.id,
      outcomeReactionId: reaction.id,
    };
  const next = replaceRecord(snapshot, record);
  return result(true, next, {
    code: 'reaction-selected',
    option,
    reaction,
    score,
    projectionBefore,
    projectionAfter: deriveStoryworldProjection(next),
    progress: getStoryworldProgress(next, clusterId),
  });
}

export function advanceStoryworldEncounter(state, clusterId) {
  const snapshot = assertState(state);
  const progress = getStoryworldProgress(snapshot, clusterId);
  if (!progress.record) return result(false, snapshot, { code: 'not-started' });
  let record;
  if (progress.phase === 'entry-reaction') {
    record = { ...progress.record, phase: 'outcome' };
  } else if (progress.phase === 'outcome' && progress.outcome?.terminal) {
    record = { ...progress.record, phase: 'complete' };
  } else if (progress.phase === 'outcome-reaction') {
    record = { ...progress.record, phase: 'complete' };
  } else {
    return result(false, snapshot, { code: 'advance-unavailable' });
  }
  const next = replaceRecord(snapshot, record);
  return result(true, next, {
    code: record.phase === 'complete' ? 'completed' : 'advanced',
    progress: getStoryworldProgress(next, clusterId),
    projection: deriveStoryworldProjection(next),
  });
}

export function getCompletedStoryworldClusterIds(state) {
  const snapshot = assertState(state);
  return Object.freeze(snapshot.records.filter(({ phase }) => phase === 'complete').map(({ clusterId }) => clusterId));
}

export function isStoryworldNarrativeComplete(state) {
  const snapshot = assertState(state);
  return STORYWORLD_CLUSTERS.every((cluster) => {
    const anchorIndex = CAMPAIGN_BEAT_INDEX.get(cluster.anchorBeatId);
    if (anchorIndex < snapshot.coverageStartBeatIndex) return true;
    return snapshot.records.some((record) => record.clusterId === cluster.id && record.phase === 'complete');
  });
}

export function serializeStoryworldState(state) {
  return JSON.stringify(assertState(state));
}

export function loadStoryworldState(serializedOrPayload) {
  let payload = serializedOrPayload;
  if (typeof serializedOrPayload === 'string') {
    try { payload = JSON.parse(serializedOrPayload); }
    catch { return Object.freeze({ ok: false, errors: Object.freeze(['Storyworld save is not valid JSON.']) }); }
  }
  const current = validateStoryworldPayload(payload);
  if (current.ok) return current;
  const legacyIdentity = LEGACY_STORYWORLD_CATALOG_IDENTITIES.find((identity) => (
    payload?.sourceIFID === identity.sourceIFID
      && payload?.sourceHash === identity.sourceHash
      && payload?.catalogSignature === identity.catalogSignature
  ));
  if (!legacyIdentity) return current;
  if (!Array.isArray(payload?.records)
    || payload.records.length > legacyIdentity.maximumCompatibleRecordCount) {
    return Object.freeze({
      ok: false,
      errors: Object.freeze([
        ...current.errors,
        'Legacy Storyworld progress reached the structurally revised Chapter 9 ending and cannot be migrated without inventing a political choice.',
      ]),
    });
  }
  const migrated = validateStoryworldPayload({
    ...payload,
    sourceIFID: STORYWORLD_CATALOG.sourceIFID,
    sourceHash: STORYWORLD_CATALOG.sourceHash,
    catalogSignature: STORYWORLD_CATALOG_SIGNATURE,
  });
  if (!migrated.ok) return migrated;
  return Object.freeze({
    ...migrated,
    migrated: true,
    migrationId: legacyIdentity.migrationId,
    previousIdentity: legacyIdentity,
  });
}

export function createStoryworldStorageAdapter(storage = getDefaultBrowserStorage(), key = DEFAULT_STORYWORLD_SAVE_KEY) {
  return Object.freeze({
    key,
    load() {
      try {
        const serialized = storage?.getItem?.(key);
        if (serialized == null) return Object.freeze({ ok: true, found: false });
        const loaded = loadStoryworldState(serialized);
        if (loaded.ok && loaded.migrated) {
          storage?.setItem?.(key, serializeStoryworldState(loaded.state));
        }
        return loaded.ok
          ? Object.freeze({
            ok: true,
            found: true,
            state: loaded.state,
            ...(loaded.migrated ? { migrated: true, migrationId: loaded.migrationId } : {}),
          })
          : Object.freeze({ ok: false, found: true, errors: loaded.errors });
      } catch {
        return Object.freeze({ ok: false, found: false, errors: Object.freeze(['Storyworld storage could not be read.']) });
      }
    },
    save(state) {
      try {
        storage?.setItem?.(key, serializeStoryworldState(state));
        return Object.freeze({ ok: true });
      } catch {
        return Object.freeze({ ok: false, errors: Object.freeze(['Storyworld storage could not be written.']) });
      }
    },
    clear() {
      try {
        storage?.removeItem?.(key);
        return Object.freeze({ ok: true });
      } catch {
        return Object.freeze({ ok: false, errors: Object.freeze(['Storyworld storage could not be cleared.']) });
      }
    },
  });
}
