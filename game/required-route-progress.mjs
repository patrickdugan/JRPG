/**
 * Pure evidence ledger for the chronological all-finite route.
 *
 * This module never mutates runtime state and never infers credit from malformed
 * saves. Evidence is counted only when both its owning runtime state and the
 * campaign frontier validate, so completed activity IDs can be passed directly
 * to getRequiredRouteCreditsGate.
 */

import { validateAdvancementPayload } from './advancement.mjs';
import { validateArchiveRecordPayload } from './archive-record-runtime.mjs';
import { validateCampConversationPayload } from './camp-conversation-runtime.mjs';
import { validatePartyCouncilPayload } from './party-council-runtime.mjs';
import { validateSavePayload } from './progression.mjs';
import { validateQuestPayload } from './quest-runtime.mjs';
import {
  REQUIRED_ROUTE_ACTIVITY_TYPES,
  REQUIRED_ROUTE_CONTRACT,
  getRequiredRouteCreditsGate,
} from './required-route-contract.mjs';
import { validateWitnessChroniclePayload } from './witness-chronicle-runtime.mjs';

export const REQUIRED_ROUTE_PROGRESS_VERSION = 1;

const ALL_ACTIVITIES = Object.freeze(
  REQUIRED_ROUTE_CONTRACT.stages.flatMap((stage) => stage.activities),
);

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

function validatedState(candidate, validator) {
  try {
    const result = validator(candidate);
    if (!result?.ok) return null;
    return result.state ?? result.value ?? null;
  } catch {
    return null;
  }
}
function recordMap(state) {
  return new Map((state?.records ?? []).map((record) => [record.id, record]));
}

function isEntered(activity, evidence) {
  if (activity.type === 'finite-sidequest' || activity.type === 'repeat-grind-milestone') {
    return evidence.quests.has(activity.questId);
  }
  if (activity.type === 'witness-chronicle') return evidence.witnessChronicles.has(activity.id);
  if (activity.type === 'camp-conversation') return evidence.campConversations.has(activity.id);
  if (activity.type === 'party-council') return evidence.partyCouncils.has(activity.id);
  if (activity.type === 'archive-record') return evidence.archiveRecords.has(activity.id);
  return false;
}

function isCompleted(activity, evidence) {
  if (activity.type === 'finite-sidequest') {
    const record = evidence.quests.get(activity.questId);
    return record?.status === 'completed' && record.completions >= 1;
  }
  if (activity.type === 'repeat-grind-milestone') {
    const record = evidence.quests.get(activity.questId);
    const wins = evidence.advancement?.encounterWins?.[activity.encounterId] ?? 0;
    // `completions` persists when a repeatable contract is accepted again, so
    // an in-progress later circuit cannot erase an already-proven first circuit.
    return Number.isSafeInteger(record?.completions)
      && record.completions >= activity.requiredContractCircuits
      && Number.isSafeInteger(wins)
      && wins >= 1 + activity.requiredRepeatWins;
  }
  if (activity.type === 'witness-chronicle') {
    return evidence.witnessChronicles.get(activity.id)?.status === 'completed';
  }
  if (activity.type === 'camp-conversation') {
    return evidence.campConversations.get(activity.id)?.status === 'completed';
  }
  if (activity.type === 'party-council') {
    return evidence.partyCouncils.get(activity.id)?.status === 'completed';
  }
  if (activity.type === 'archive-record') {
    return evidence.archiveRecords.get(activity.id)?.status === 'completed';
  }
  return false;
}

function countMetrics(activities, sets) {
  const ids = activities.map(({ id }) => id);
  const count = (set) => ids.reduce((sum, id) => sum + Number(set.has(id)), 0);
  return {
    requiredActivityCount: ids.length,
    unlockedActivityCount: count(sets.unlocked),
    enteredActivityCount: count(sets.entered),
    completedActivityCount: count(sets.completed),
    dueActivityCount: count(sets.due),
    entryDueActivityCount: count(sets.entryDue),
    inProgressActivityCount: count(sets.inProgress),
    remainingActivityCount: count(sets.remaining),
    lockedActivityCount: count(sets.locked),
  };
}

/**
 * Derive immutable route evidence from the seven independent runtime states.
 * Missing or invalid sources contribute no evidence. Activity order always
 * follows the canonical 215-entry route contract.
 */
export function deriveRequiredRouteProgress({
  campaignState,
  questState,
  witnessChronicleState,
  campConversationState,
  partyCouncilState,
  archiveRecordState,
  advancementState,
} = {}) {
  const validated = {
    campaign: validatedState(campaignState, validateSavePayload),
    quests: validatedState(questState, validateQuestPayload),
    witnessChronicles: validatedState(witnessChronicleState, validateWitnessChroniclePayload),
    campConversations: validatedState(campConversationState, validateCampConversationPayload),
    partyCouncils: validatedState(partyCouncilState, validatePartyCouncilPayload),
    archiveRecords: validatedState(archiveRecordState, validateArchiveRecordPayload),
    advancement: validatedState(advancementState, validateAdvancementPayload),
  };
  const completedBeats = new Set(validated.campaign?.completedBeatIds ?? []);
  const evidence = {
    quests: recordMap(validated.quests),
    witnessChronicles: recordMap(validated.witnessChronicles),
    campConversations: recordMap(validated.campConversations),
    partyCouncils: recordMap(validated.partyCouncils),
    archiveRecords: recordMap(validated.archiveRecords),
    advancement: validated.advancement,
  };

  const sets = {
    unlocked: new Set(),
    entered: new Set(),
    completed: new Set(),
    due: new Set(),
    entryDue: new Set(),
    inProgress: new Set(),
    remaining: new Set(),
    locked: new Set(),
  };
  for (const activity of ALL_ACTIVITIES) {
    const unlocked = completedBeats.has(activity.unlockAfterBeatId);
    const entered = unlocked && isEntered(activity, evidence);
    const completed = unlocked && isCompleted(activity, evidence);
    if (unlocked) sets.unlocked.add(activity.id);
    else sets.locked.add(activity.id);
    if (entered || completed) sets.entered.add(activity.id);
    if (completed) sets.completed.add(activity.id);
    else sets.remaining.add(activity.id);
    if (unlocked && !completed) sets.due.add(activity.id);
    if (unlocked && !entered) sets.entryDue.add(activity.id);
    if (entered && !completed) sets.inProgress.add(activity.id);
  }

  const orderedIds = (set) => ALL_ACTIVITIES.filter(({ id }) => set.has(id)).map(({ id }) => id);
  const enteredActivityIds = orderedIds(sets.entered);
  const completedActivityIds = orderedIds(sets.completed);
  const byType = Object.fromEntries(REQUIRED_ROUTE_ACTIVITY_TYPES.map((type) => [
    type,
    countMetrics(ALL_ACTIVITIES.filter((activity) => activity.type === type), sets),
  ]));
  const creditsGate = getRequiredRouteCreditsGate(validated.campaign, completedActivityIds);

  return deepFreeze({
    version: REQUIRED_ROUTE_PROGRESS_VERSION,
    sourceValidity: {
      campaign: Boolean(validated.campaign),
      quests: Boolean(validated.quests),
      witnessChronicles: Boolean(validated.witnessChronicles),
      campConversations: Boolean(validated.campConversations),
      partyCouncils: Boolean(validated.partyCouncils),
      archiveRecords: Boolean(validated.archiveRecords),
      advancement: Boolean(validated.advancement),
    },
    runBinding: {
      campConversations: validated.campConversations?.runId ?? null,
      partyCouncils: validated.partyCouncils?.runId ?? null,
      archiveRecords: validated.archiveRecords?.runId ?? null,
    },
    unlockedActivityIds: orderedIds(sets.unlocked),
    enteredActivityIds,
    completedActivityIds,
    dueActivityIds: orderedIds(sets.due),
    entryDueActivityIds: orderedIds(sets.entryDue),
    inProgressActivityIds: orderedIds(sets.inProgress),
    remainingActivityIds: orderedIds(sets.remaining),
    lockedActivityIds: orderedIds(sets.locked),
    metrics: {
      total: countMetrics(ALL_ACTIVITIES, sets),
      byType,
    },
    creditsGate,
  });
}
