/** Presentation-only bridge from a validated Storyworld record to a related battle. */

import {
  STORYWORLD_CLUSTERS,
} from './content/storyworld-encounters.generated.mjs';
import {
  createStoryworldStorageAdapter,
  validateStoryworldPayload,
} from './storyworld-runtime.mjs';

export const STORYWORLD_BATTLE_PRESENTATION_SCHEMA_VERSION = 1;

const CLUSTERS_BY_RELATED_ENCOUNTER_ID = new Map();
for (const cluster of STORYWORLD_CLUSTERS) {
  for (const encounterId of cluster.relatedEncounterIds) {
    if (CLUSTERS_BY_RELATED_ENCOUNTER_ID.has(encounterId)) {
      throw new Error(`Encounter ${encounterId} is related to more than one Storyworld cluster.`);
    }
    CLUSTERS_BY_RELATED_ENCOUNTER_ID.set(encounterId, cluster);
  }
}
function optionById(encounter, optionId) {
  return encounter?.options.find(({ id }) => id === optionId) ?? null;
}

function reactionById(option, reactionId) {
  return option?.reactions.find(({ id }) => id === reactionId) ?? null;
}

function freezePresentation(value) {
  return Object.freeze(value);
}

export function getStoryworldBattlePresentation({ encounterId, storyworldState, runId } = {}) {
  if (typeof encounterId !== 'string' || typeof runId !== 'string' || !runId) return null;
  const cluster = CLUSTERS_BY_RELATED_ENCOUNTER_ID.get(encounterId);
  if (!cluster) return null;

  const validation = validateStoryworldPayload(storyworldState);
  if (!validation.ok || validation.state.runId !== runId) return null;
  const record = validation.state.records.find(({ clusterId }) => clusterId === cluster.id);
  if (!record || record.phase !== 'complete') return null;

  const entryOption = optionById(cluster.entry, record.entryOptionId);
  const entryReaction = reactionById(entryOption, record.entryReactionId);
  const outcome = cluster.outcomes.find(({ id }) => id === record.outcomeEncounterId) ?? null;
  const outcomeOption = optionById(outcome, record.outcomeOptionId);
  const outcomeReaction = reactionById(outcomeOption, record.outcomeReactionId);
  if (!entryOption || !entryReaction || !outcome) return null;

  const beforeBattle = cluster.sequenceRole === 'before-boss-decision';
  return freezePresentation({
    schemaVersion: STORYWORLD_BATTLE_PRESENTATION_SCHEMA_VERSION,
    encounterId,
    clusterId: cluster.id,
    sequenceRole: cluster.sequenceRole,
    eyebrow: beforeBattle ? 'Decision carried into encounter' : 'Recorded aftermath',
    title: outcome.title,
    decisionText: entryOption.text,
    consequenceText: outcomeReaction?.text ?? outcome.text,
  });
}

export function loadStoryworldBattlePresentation({ encounterId, runId, storage } = {}) {
  if (typeof runId !== 'string' || !runId) return null;
  const loaded = createStoryworldStorageAdapter(storage).load();
  if (!loaded.ok || !loaded.found) return null;
  return getStoryworldBattlePresentation({ encounterId, storyworldState: loaded.state, runId });
}
