/** Portable all-authority recovery snapshots for long human playtests. */

import { CAMPAIGN } from './content/campaign.mjs';
import {
  DEFAULT_PROGRESSION_SAVE_KEY,
  loadCampaignState,
} from './progression.mjs';
import {
  DEFAULT_ADVANCEMENT_SAVE_KEY,
  getEncounterWinCount,
  loadAdvancementState,
} from './advancement.mjs';
import { DEFAULT_PLAYTIME_SAVE_KEY, loadPlaytimeState } from './playtime.mjs';
import {
  DEFAULT_RUN_RECEIPT_SAVE_KEY,
  LEGACY_RUN_RECEIPT_V2_SAVE_KEY,
  getRunProofReport,
  loadRunReceipt,
  serializeRunReceipt,
} from './run-receipt.mjs';
import { DEFAULT_QUEST_SAVE_KEY, loadQuestState } from './quest-runtime.mjs';
import { DEFAULT_NARRATIVE_SAVE_KEY, loadNarrativeState } from './narrative-runtime.mjs';
import {
  DEFAULT_WITNESS_CHRONICLE_SAVE_KEY,
  loadWitnessChronicleState,
} from './witness-chronicle-runtime.mjs';
import {
  DEFAULT_SCENE_OPERATION_SAVE_KEY,
  loadSceneOperationState,
} from './scene-operation-runtime.mjs';
import { DEFAULT_FIELD_SAVE_KEY, loadFieldState } from './field-runtime.mjs';
import { DEFAULT_LOADOUT_SAVE_KEY, hydrateLoadoutState } from './loadout.mjs';
import { DEFAULT_CAMP_CONVERSATION_SAVE_KEY } from './camp-conversation-contract.mjs';
import { loadCampConversationState } from './camp-conversation-runtime.mjs';
import { DEFAULT_PARTY_COUNCIL_SAVE_KEY } from './party-council-contract.mjs';
import { loadPartyCouncilState } from './party-council-runtime.mjs';
import { DEFAULT_ARCHIVE_RECORD_SAVE_KEY } from './archive-record-contract.mjs';
import { loadArchiveRecordState } from './archive-record-runtime.mjs';
import { deriveRequiredRouteProgress } from './required-route-progress.mjs';
import { REQUIRED_ROUTE_CONTRACT_SIGNATURE } from './required-route-contract.mjs';
import {
  DEFAULT_STORYWORLD_SAVE_KEY,
  createLegacyStoryworldState,
  getCompletedStoryworldClusterIds,
  isStoryworldNarrativeComplete,
  loadStoryworldState,
  serializeStoryworldState,
} from './storyworld-runtime.mjs';
import {
  STORYWORLD_CATALOG_SIGNATURE,
  STORYWORLD_CLUSTERS,
} from './content/storyworld-encounters.generated.mjs';

export const RECOVERY_CHECKPOINT_SCHEMA_VERSION = 2;
export const RECOVERY_CHECKPOINT_KIND = 'bells-recovery-checkpoint';

const LEGACY_RECOVERY_CHECKPOINT_SCHEMA_VERSION = 1;

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const LEGACY_AUTHORITY_CONFIG = Object.freeze([
  { id: 'campaign', key: DEFAULT_PROGRESSION_SAVE_KEY, load: loadCampaignState },
  { id: 'advancement', key: DEFAULT_ADVANCEMENT_SAVE_KEY, load: loadAdvancementState },
  { id: 'playtime', key: DEFAULT_PLAYTIME_SAVE_KEY, load: loadPlaytimeState },
  { id: 'runReceipt', key: LEGACY_RUN_RECEIPT_V2_SAVE_KEY, load: loadRunReceipt },
  { id: 'quests', key: DEFAULT_QUEST_SAVE_KEY, load: loadQuestState },
  { id: 'narrative', key: DEFAULT_NARRATIVE_SAVE_KEY, load: loadNarrativeState },
  { id: 'witnessChronicles', key: DEFAULT_WITNESS_CHRONICLE_SAVE_KEY, load: loadWitnessChronicleState },
  { id: 'sceneOperations', key: DEFAULT_SCENE_OPERATION_SAVE_KEY, load: loadSceneOperationState },
  { id: 'field', key: DEFAULT_FIELD_SAVE_KEY, load: loadFieldState },
  { id: 'loadout', key: DEFAULT_LOADOUT_SAVE_KEY, load: hydrateLoadoutState },
  { id: 'campConversations', key: DEFAULT_CAMP_CONVERSATION_SAVE_KEY, load: loadCampConversationState },
  { id: 'partyCouncils', key: DEFAULT_PARTY_COUNCIL_SAVE_KEY, load: loadPartyCouncilState },
  { id: 'archiveRecords', key: DEFAULT_ARCHIVE_RECORD_SAVE_KEY, load: loadArchiveRecordState },
]);

const AUTHORITY_CONFIG = Object.freeze([
  ...LEGACY_AUTHORITY_CONFIG.map((config) => (
    config.id === 'runReceipt'
      ? { id: 'runReceipt', key: DEFAULT_RUN_RECEIPT_SAVE_KEY, load: loadRunReceipt }
      : config
  )),
  { id: 'storyworld', key: DEFAULT_STORYWORLD_SAVE_KEY, load: loadStoryworldState },
]);

export const RECOVERY_CHECKPOINT_AUTHORITIES = Object.freeze(AUTHORITY_CONFIG.map(({ id, key }) => (
  Object.freeze({ id, key })
)));

function result(ok, properties = {}) {
  return deepFreeze({ ok, ...properties });
}

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function signatureFor(value) {
  return `fnv1a32:${fnv1a32(JSON.stringify(value))}`;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function requireStorage(storage) {
  if (!storage || ['getItem', 'setItem', 'removeItem'].some((name) => typeof storage[name] !== 'function')) {
    throw new TypeError('Recovery storage must implement getItem, setItem, and removeItem.');
  }
  return storage;
}

function stateFromLoad(loaded) {
  return loaded?.state ?? loaded?.value ?? null;
}

function parseCheckpoint(input) {
  if (typeof input !== 'string') return input;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function inspectRecords(records, authorityConfig = AUTHORITY_CONFIG) {
  const errors = [];
  const states = {};
  if (!Array.isArray(records) || records.length !== authorityConfig.length) {
    return { errors: [`Recovery checkpoint must contain exactly ${authorityConfig.length} authority records.`], states };
  }
  authorityConfig.forEach((config, index) => {
    const record = records[index];
    if (!exactKeys(record, ['id', 'key', 'serialized'])) {
      errors.push(`Recovery authority record ${index} has unsupported or missing keys.`);
      return;
    }
    if (record.id !== config.id || record.key !== config.key) {
      errors.push(`Recovery authority record ${index} is not canonical ${config.id}.`);
      return;
    }
    if (typeof record.serialized !== 'string' || !record.serialized) {
      errors.push(`Recovery authority ${config.id} has no serialized state.`);
      return;
    }
    const loaded = config.load(record.serialized);
    const state = stateFromLoad(loaded);
    if (!loaded?.ok || !state) {
      errors.push(`Recovery authority ${config.id} is invalid: ${(loaded?.errors ?? ['unknown validation error']).join(' ')}`);
      return;
    }
    states[config.id] = state;
  });
  return { errors, states };
}

function deriveSummary(states, schemaVersion = RECOVERY_CHECKPOINT_SCHEMA_VERSION) {
  const proof = getRunProofReport(states.runReceipt);
  const route = deriveRequiredRouteProgress({
    campaignState: states.campaign,
    advancementState: states.advancement,
    questState: states.quests,
    witnessChronicleState: states.witnessChronicles,
    campConversationState: states.campConversations,
    partyCouncilState: states.partyCouncils,
    archiveRecordState: states.archiveRecords,
  });
  const summary = {
    runId: proof.runId,
    receiptStatus: proof.status,
    currentChapterId: states.campaign.current.chapterId,
    currentBeatId: states.campaign.current.beatId,
    completedBeatCount: states.campaign.completedBeatIds.length,
    firstClearCount: proof.firstClearEncounterIds.length,
    activePlaytimeMs: proof.totalMs,
    routeCompletedActivityCount: route.metrics.total.completedActivityCount,
    routeRequiredActivityCount: route.metrics.total.requiredActivityCount,
    routeCreditsReady: route.creditsGate.creditsReady,
    routeContractSignature: REQUIRED_ROUTE_CONTRACT_SIGNATURE,
  };
  if (schemaVersion >= RECOVERY_CHECKPOINT_SCHEMA_VERSION) {
    const campaignBeatIds = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.id));
    const campaignBeatIndex = new Map(campaignBeatIds.map((beatId, index) => [beatId, index]));
    const requiredClusterCount = STORYWORLD_CLUSTERS.filter((cluster) => (
      campaignBeatIndex.get(cluster.anchorBeatId) >= states.storyworld.coverageStartBeatIndex
    )).length;
    Object.assign(summary, {
      storyworldCompletedClusterCount: getCompletedStoryworldClusterIds(states.storyworld).length,
      storyworldRequiredClusterCount: requiredClusterCount,
      storyworldNarrativeComplete: isStoryworldNarrativeComplete(states.storyworld),
      storyworldProofEligible: states.storyworld.proofEligible,
      storyworldCatalogSignature: STORYWORLD_CATALOG_SIGNATURE,
    });
  }
  return deepFreeze(summary);
}

function crossStateErrors(states) {
  const errors = [];
  const receipt = states.runReceipt;
  if (JSON.stringify(receipt.completedBeatIds) !== JSON.stringify(states.campaign.completedBeatIds)) {
    errors.push('Campaign and clean-run receipt beat evidence do not match exactly.');
  }
  for (const encounterId of receipt.firstClearEncounterIds) {
    if (getEncounterWinCount(states.advancement, encounterId) < 1) {
      errors.push(`Receipt first clear ${encounterId} is absent from advancement.`);
    }
  }
  for (const id of ['campConversations', 'partyCouncils', 'archiveRecords']) {
    if (states[id].runId !== receipt.runId) errors.push(`${id} is not bound to clean run ${receipt.runId}.`);
  }
  if (states.storyworld.runId !== receipt.runId) {
    errors.push(`storyworld is not bound to clean run ${receipt.runId}.`);
  }
  if (states.storyworld.coverageStartBeatIndex > states.campaign.completedBeatIds.length) {
    errors.push('Storyworld coverage begins after the campaign progress captured by this checkpoint.');
  }
  return errors;
}

function synthesizeLegacyStoryworldAuthority(states) {
  const state = createLegacyStoryworldState({
    runId: states.runReceipt.runId,
    coverageStartBeatIndex: states.campaign.completedBeatIds.length,
  });
  return {
    state,
    record: {
      id: 'storyworld',
      key: DEFAULT_STORYWORLD_SAVE_KEY,
      serialized: serializeStoryworldState(state),
    },
  };
}

/** Validate structure, signature, every authority, and cross-state ownership before any write. */
export function validateRecoveryCheckpoint(input) {
  const checkpoint = parseCheckpoint(input);
  if (!checkpoint || !exactKeys(checkpoint, [
    'schemaVersion', 'kind', 'campaignId', 'recoveryOnly', 'createdAtEpochMs', 'summary', 'records', 'signature',
  ])) return result(false, { errors: ['Recovery checkpoint envelope is malformed.'] });
  const body = Object.fromEntries(Object.entries(checkpoint).filter(([key]) => key !== 'signature'));
  const errors = [];
  const supportedSchema = [LEGACY_RECOVERY_CHECKPOINT_SCHEMA_VERSION, RECOVERY_CHECKPOINT_SCHEMA_VERSION]
    .includes(checkpoint.schemaVersion);
  if (!supportedSchema) errors.push('Recovery checkpoint schema is unsupported.');
  if (checkpoint.kind !== RECOVERY_CHECKPOINT_KIND) errors.push('Recovery checkpoint kind is invalid.');
  if (checkpoint.campaignId !== CAMPAIGN.id) errors.push('Recovery checkpoint campaign is incompatible.');
  if (checkpoint.recoveryOnly !== true) errors.push('Recovery checkpoint must be labeled recovery-only.');
  if (!Number.isSafeInteger(checkpoint.createdAtEpochMs) || checkpoint.createdAtEpochMs < 0) errors.push('Recovery checkpoint timestamp is invalid.');
  if (checkpoint.signature !== signatureFor(body)) errors.push('Recovery checkpoint signature is invalid.');
  const authorityConfig = checkpoint.schemaVersion === LEGACY_RECOVERY_CHECKPOINT_SCHEMA_VERSION
    ? LEGACY_AUTHORITY_CONFIG
    : AUTHORITY_CONFIG;
  const inspected = supportedSchema
    ? inspectRecords(checkpoint.records, authorityConfig)
    : { errors: [], states: {} };
  errors.push(...inspected.errors);
  let legacyStoryworld = null;
  if (supportedSchema && inspected.errors.length === 0) {
    if (checkpoint.schemaVersion === LEGACY_RECOVERY_CHECKPOINT_SCHEMA_VERSION) {
      legacyStoryworld = synthesizeLegacyStoryworldAuthority(inspected.states);
      inspected.states.storyworld = legacyStoryworld.state;
    }
    errors.push(...crossStateErrors(inspected.states));
    if (errors.length === 0) {
      const expectedSummary = deriveSummary(inspected.states, checkpoint.schemaVersion);
      if (JSON.stringify(checkpoint.summary) !== JSON.stringify(expectedSummary)) {
        errors.push('Recovery checkpoint summary does not reconcile with its authority states.');
      }
    }
  }
  return errors.length
    ? result(false, { errors })
    : result(true, {
      checkpoint: deepFreeze(checkpoint),
      states: deepFreeze(inspected.states),
      migrationRecord: legacyStoryworld ? deepFreeze(legacyStoryworld.record) : null,
      migratedRunReceiptRecord: legacyStoryworld ? deepFreeze({
        id: 'runReceipt',
        key: DEFAULT_RUN_RECEIPT_SAVE_KEY,
        serialized: serializeRunReceipt(inspected.states.runReceipt),
      }) : null,
      sourceSchemaVersion: checkpoint.schemaVersion,
      requiresMigration: checkpoint.schemaVersion !== RECOVERY_CHECKPOINT_SCHEMA_VERSION,
      errors: [],
    });
}

/** Read an exact all-authority snapshot. Missing or invalid authorities fail closed. */
export function createRecoveryCheckpoint(storage, { createdAtEpochMs = Date.now() } = {}) {
  try {
    const target = requireStorage(storage);
    if (!Number.isSafeInteger(createdAtEpochMs) || createdAtEpochMs < 0) {
      return result(false, { errors: ['Recovery checkpoint timestamp is invalid.'] });
    }
    const records = AUTHORITY_CONFIG.map(({ id, key }) => ({ id, key, serialized: target.getItem(key) }));
    const inspected = inspectRecords(records);
    const errors = [...inspected.errors];
    if (inspected.errors.length === 0) errors.push(...crossStateErrors(inspected.states));
    if (errors.length) return result(false, { errors });
    const body = {
      schemaVersion: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
      kind: RECOVERY_CHECKPOINT_KIND,
      campaignId: CAMPAIGN.id,
      recoveryOnly: true,
      createdAtEpochMs,
      summary: deriveSummary(inspected.states),
      records,
    };
    const checkpoint = deepFreeze({ ...body, signature: signatureFor(body) });
    return result(true, { checkpoint, errors: [] });
  } catch (error) {
    return result(false, { errors: [error instanceof Error ? error.message : 'Recovery checkpoint could not read storage.'] });
  }
}

export function serializeRecoveryCheckpoint(checkpoint) {
  const validation = validateRecoveryCheckpoint(checkpoint);
  if (!validation.ok) throw new TypeError(`Invalid recovery checkpoint: ${validation.errors.join(' ')}`);
  return `${JSON.stringify(validation.checkpoint, null, 2)}\n`;
}

/** Replace the complete snapshot with exact-string rollback on any write failure. */
export function restoreRecoveryCheckpoint(storage, input) {
  const validation = validateRecoveryCheckpoint(input);
  if (!validation.ok) return result(false, { code: 'invalid-checkpoint', errors: validation.errors, writesApplied: 0, rollbackComplete: true });
  let target;
  try {
    target = requireStorage(storage);
  } catch (error) {
    return result(false, { code: 'storage-unavailable', errors: [error.message], writesApplied: 0, rollbackComplete: true });
  }
  const restoreRecords = validation.migrationRecord
    ? [
      ...validation.checkpoint.records.map((record) => (
        record.id === 'runReceipt' ? validation.migratedRunReceiptRecord : record
      )),
      validation.migrationRecord,
    ]
    : validation.checkpoint.records;
  const prior = [];
  let writesApplied = 0;
  try {
    for (const record of restoreRecords) {
      prior.push({ key: record.key, serialized: target.getItem(record.key) });
      target.setItem(record.key, record.serialized);
      if (target.getItem(record.key) !== record.serialized) throw new Error(`Storage did not retain ${record.id} exactly.`);
      writesApplied += 1;
    }
    return result(true, {
      code: 'restored',
      checkpoint: validation.checkpoint,
      summary: validation.checkpoint.summary,
      migratedFromSchemaVersion: validation.requiresMigration ? validation.sourceSchemaVersion : null,
      writesApplied,
      rollbackComplete: true,
      errors: [],
    });
  } catch (error) {
    const rollbackErrors = [];
    for (const entry of [...prior].reverse()) {
      try {
        if (entry.serialized === null) target.removeItem(entry.key);
        else target.setItem(entry.key, entry.serialized);
        if (target.getItem(entry.key) !== entry.serialized) rollbackErrors.push(`Rollback did not retain ${entry.key} exactly.`);
      } catch {
        rollbackErrors.push(`Rollback failed for ${entry.key}.`);
      }
    }
    return result(false, {
      code: 'restore-write-failed',
      errors: [error instanceof Error ? error.message : 'Recovery restore failed.', ...rollbackErrors],
      writesApplied,
      rollbackComplete: rollbackErrors.length === 0,
    });
  }
}
