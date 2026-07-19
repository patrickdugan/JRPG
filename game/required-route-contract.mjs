/**
 * Chronological all-finite route contract.
 *
 * The contract does not contain authored minute claims. It identifies the
 * exact campaign frontier at which every shipped finite activity must enter
 * the intended route, plus one transparent first circuit of each repeatable
 * contract. Repeat battle speed is presentation-only and remains selectable
 * at 1x, 2x, or 4x.
 */

import { CAMPAIGN } from './content/campaign.mjs';
import { ARCHIVE_RECORDS } from './content/archive-records.mjs';
import { CAMP_CONVERSATIONS } from './content/camp-conversations.mjs';
import { PARTY_COUNCILS } from './content/party-councils.mjs';
import { REPEATABLE_CONTRACTS, SIDE_QUESTS } from './content/sidequests.mjs';
import { WITNESS_CHRONICLES } from './content/witness-chronicles.mjs';
import { REPEAT_BATTLE_SPEEDS } from './repeat-battle.mjs';

export const REQUIRED_ROUTE_CONTRACT_VERSION = 1;

export const REQUIRED_ROUTE_ACTIVITY_TYPES = Object.freeze([
  'finite-sidequest',
  'witness-chronicle',
  'camp-conversation',
  'party-council',
  'archive-record',
  'repeat-grind-milestone',
]);

const TYPE_ORDER = new Map(REQUIRED_ROUTE_ACTIVITY_TYPES.map((type, index) => [type, index]));
const BEAT_RECORDS = Object.freeze(CAMPAIGN.chapters.flatMap((chapter) =>
  chapter.beats.map((beat) => Object.freeze({ chapterId: chapter.id, beatId: beat.id }))));
const BEAT_INDEX = new Map(BEAT_RECORDS.map(({ beatId }, index) => [beatId, index]));
const ACTIVITY_KEYS = Object.freeze([
  'sequence',
  'type',
  'id',
  'unlockAfterBeatId',
  'campId',
  'questId',
  'encounterId',
  'requiredContractCircuits',
  'requiredRepeatWins',
  'speedMultipliers',
]);
const STAGE_KEYS = Object.freeze(['sequence', 'chapterId', 'beatId', 'activities']);
const CONTRACT_KEYS = Object.freeze([
  'version',
  'campaignId',
  'required',
  'completionPolicy',
  'grindPolicy',
  'stages',
  'metrics',
]);

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function activity(type, id, unlockAfterBeatId, properties = {}) {
  return {
    sequence: 0,
    type,
    id,
    unlockAfterBeatId,
    campId: properties.campId ?? null,
    questId: properties.questId ?? null,
    encounterId: properties.encounterId ?? null,
    requiredContractCircuits: properties.requiredContractCircuits ?? 0,
    requiredRepeatWins: properties.requiredRepeatWins ?? 0,
    speedMultipliers: properties.speedMultipliers ?? [],
  };
}

function grindMilestone(contract) {
  const replayObjective = contract.objectives.filter((objective) => objective.type === 'battle-replay');
  if (replayObjective.length !== 1 || replayObjective[0].encounterId !== contract.linkedEncounterIds[0]) {
    throw new TypeError(`${contract.id} must expose one exact linked repeat battle.`);
  }
  return activity(
    'repeat-grind-milestone',
    `grind-${contract.id}`,
    contract.prerequisites.opensAfterBeatId,
    {
      questId: contract.id,
      encounterId: replayObjective[0].encounterId,
      requiredContractCircuits: 1,
      requiredRepeatWins: 1,
      speedMultipliers: [...REPEAT_BATTLE_SPEEDS],
    },
  );
}

function sourceActivities() {
  return [
    ...SIDE_QUESTS.map((quest) => activity(
      'finite-sidequest',
      quest.id,
      quest.prerequisites.opensAfterBeatId,
      { questId: quest.id },
    )),
    ...WITNESS_CHRONICLES.map((chronicle) => activity(
      'witness-chronicle',
      chronicle.id,
      chronicle.opensAfterBeatId,
    )),
    ...CAMP_CONVERSATIONS.conversations.map((conversation) => activity(
      'camp-conversation',
      conversation.id,
      conversation.unlockAfterBeatId,
      { campId: conversation.campId },
    )),
    ...PARTY_COUNCILS.councils.map((council) => activity(
      'party-council',
      council.id,
      council.unlockAfterBeatId,
      { campId: council.campId },
    )),
    ...ARCHIVE_RECORDS.records.map((record) => activity(
      'archive-record',
      record.id,
      record.unlockAfterBeatId,
    )),
    ...REPEATABLE_CONTRACTS.map(grindMilestone),
  ];
}

function buildContract() {
  const sources = sourceActivities();
  const catalogOrder = new Map(sources.map((entry, index) => [entry.id, index]));
  const unknownUnlocks = sources.filter((entry) => !BEAT_INDEX.has(entry.unlockAfterBeatId));
  if (unknownUnlocks.length) {
    throw new TypeError(`Required-route content has unknown unlock beats: ${unknownUnlocks.map(({ id }) => id).join(', ')}.`);
  }
  let activitySequence = 0;
  const stages = BEAT_RECORDS.map((beat, stageIndex) => {
    const activities = sources
      .filter((entry) => entry.unlockAfterBeatId === beat.beatId)
      .sort((left, right) => TYPE_ORDER.get(left.type) - TYPE_ORDER.get(right.type)
        || catalogOrder.get(left.id) - catalogOrder.get(right.id))
      .map((entry) => ({ ...entry, sequence: ++activitySequence }));
    return {
      sequence: stageIndex + 1,
      chapterId: beat.chapterId,
      beatId: beat.beatId,
      activities,
    };
  });
  const activities = stages.flatMap((stage) => stage.activities);
  const metrics = {
    canonicalBeatCount: stages.length,
    requiredActivityCount: activities.length,
    finiteSideQuestCount: activities.filter(({ type }) => type === 'finite-sidequest').length,
    witnessChronicleCount: activities.filter(({ type }) => type === 'witness-chronicle').length,
    campConversationCount: activities.filter(({ type }) => type === 'camp-conversation').length,
    partyCouncilCount: activities.filter(({ type }) => type === 'party-council').length,
    archiveRecordCount: activities.filter(({ type }) => type === 'archive-record').length,
    repeatGrindMilestoneCount: activities.filter(({ type }) => type === 'repeat-grind-milestone').length,
    requiredRepeatWinCount: activities.reduce((sum, entry) => sum + entry.requiredRepeatWins, 0),
    firstActivityAfterBeatId: activities[0]?.unlockAfterBeatId ?? null,
    finalActivityAfterBeatId: activities.at(-1)?.unlockAfterBeatId ?? null,
  };
  return deepFreeze({
    version: REQUIRED_ROUTE_CONTRACT_VERSION,
    campaignId: CAMPAIGN.id,
    required: true,
    completionPolicy: 'enter-each-activity-at-its-unlock; witness-arcs-may-pause-until-their-canonical-combat-evidence-frontier',
    grindPolicy: {
      firstClearsAt1x: true,
      repeatPresentationSpeeds: [...REPEAT_BATTLE_SPEEDS],
      speedChangesCombatDecisions: false,
      speedChangesRewards: false,
      elapsedTimeClaimed: false,
    },
    stages,
    metrics,
  });
}

function activityIdentity(entry) {
  return JSON.stringify(entry);
}

/** Validate chronology and exact catalogue coverage without executing gameplay. */
export function validateRequiredRouteContract(candidate) {
  const errors = [];
  if (!exactKeys(candidate, CONTRACT_KEYS)) errors.push('Route contract must use the exact v1 top-level keys.');
  if (candidate?.version !== REQUIRED_ROUTE_CONTRACT_VERSION) errors.push(`version must equal ${REQUIRED_ROUTE_CONTRACT_VERSION}.`);
  if (candidate?.campaignId !== CAMPAIGN.id) errors.push(`campaignId must equal ${CAMPAIGN.id}.`);
  if (candidate?.required !== true) errors.push('The intended route must be explicitly required.');
  if (!Array.isArray(candidate?.stages)) {
    errors.push('stages must be an array.');
  } else {
    if (candidate.stages.length !== BEAT_RECORDS.length) errors.push(`stages must cover all ${BEAT_RECORDS.length} canonical beats.`);
    let expectedActivitySequence = 1;
    candidate.stages.forEach((stage, index) => {
      const expectedBeat = BEAT_RECORDS[index];
      if (!exactKeys(stage, STAGE_KEYS)) errors.push(`stages[${index}] must use exact stage keys.`);
      if (stage?.sequence !== index + 1) errors.push(`stages[${index}].sequence must be ${index + 1}.`);
      if (stage?.chapterId !== expectedBeat?.chapterId || stage?.beatId !== expectedBeat?.beatId) {
        errors.push(`stages[${index}] must be canonical beat ${expectedBeat?.beatId}.`);
      }
      if (!Array.isArray(stage?.activities)) {
        errors.push(`stages[${index}].activities must be an array.`);
        return;
      }
      stage.activities.forEach((entry, activityIndex) => {
        if (!exactKeys(entry, ACTIVITY_KEYS)) errors.push(`${stage?.beatId} activity ${activityIndex} must use exact activity keys.`);
        if (entry?.sequence !== expectedActivitySequence) errors.push(`${stage?.beatId} activity sequence must be ${expectedActivitySequence}.`);
        if (entry?.unlockAfterBeatId !== stage?.beatId) errors.push(`${entry?.id ?? 'activity'} is displaced from its exact unlock beat.`);
        if (!TYPE_ORDER.has(entry?.type)) errors.push(`${entry?.id ?? 'activity'} has an unsupported activity type.`);
        expectedActivitySequence += 1;
      });
    });
  }

  const expected = buildContract();
  const actualActivities = Array.isArray(candidate?.stages)
    ? candidate.stages.flatMap((stage) => Array.isArray(stage?.activities) ? stage.activities : [])
    : [];
  const expectedActivities = expected.stages.flatMap((stage) => stage.activities);
  const actualIds = actualActivities.map(({ id }) => id);
  if (new Set(actualIds).size !== actualIds.length) errors.push('Required-route activity IDs must be unique.');
  if (actualActivities.length !== expectedActivities.length) {
    errors.push(`Route must contain exactly ${expectedActivities.length} required activities.`);
  } else {
    actualActivities.forEach((entry, index) => {
      if (activityIdentity(entry) !== activityIdentity(expectedActivities[index])) {
        errors.push(`Required activity ${index + 1} differs from the canonical catalogue itinerary.`);
      }
    });
  }
  if (JSON.stringify(candidate?.metrics) !== JSON.stringify(expected.metrics)) errors.push('metrics must exactly match the canonical itinerary.');
  if (JSON.stringify(candidate?.grindPolicy) !== JSON.stringify(expected.grindPolicy)) errors.push('grindPolicy must preserve exact 1x/2x/4x schedule-only semantics.');
  if (candidate?.completionPolicy !== expected.completionPolicy) errors.push('completionPolicy must match the intended chronological route.');
  return deepFreeze({ ok: errors.length === 0, errors });
}

export const REQUIRED_ROUTE_CONTRACT = buildContract();
export const REQUIRED_ROUTE_CONTRACT_SIGNATURE = `fnv1a32:${fnv1a32(JSON.stringify(REQUIRED_ROUTE_CONTRACT))}`;
export const REQUIRED_ROUTE_METRICS = REQUIRED_ROUTE_CONTRACT.metrics;
export const REQUIRED_ROUTE_GRIND_MILESTONES = deepFreeze(
  REQUIRED_ROUTE_CONTRACT.stages.flatMap((stage) => stage.activities)
    .filter(({ type }) => type === 'repeat-grind-milestone'),
);

const STAGE_BY_BEAT_ID = new Map(REQUIRED_ROUTE_CONTRACT.stages.map((stage) => [stage.beatId, stage]));
const ALL_REQUIRED_ACTIVITIES = REQUIRED_ROUTE_CONTRACT.stages.flatMap((stage) => stage.activities);
const ACTIVITY_BY_ID = new Map(ALL_REQUIRED_ACTIVITIES.map((entry) => [entry.id, entry]));

/** Exact immutable stage lookup for journal and campaign route surfaces. */
export function getRequiredRouteStage(beatId) {
  return STAGE_BY_BEAT_ID.get(beatId) ?? null;
}

/** Exact immutable activity lookup across every finite and grind catalogue. */
export function getRequiredRouteActivity(activityId) {
  return ACTIVITY_BY_ID.get(activityId) ?? null;
}

/**
 * Pure campaign-UI gate. `enteredActivityIds` means an activity was begun at
 * its frontier; witness arcs are allowed to remain active until later combat
 * evidence, as declared by completionPolicy.
 */
export function getRequiredRouteStageGate(campaignState, beatId, enteredActivityIds = []) {
  const stage = getRequiredRouteStage(beatId);
  if (!stage) return null;
  const completedBeats = new Set(campaignState?.completedBeatIds ?? []);
  const entered = new Set(Array.isArray(enteredActivityIds) ? enteredActivityIds : []);
  const remainingActivities = stage.activities.filter((entry) => !entered.has(entry.id));
  const unlocked = completedBeats.has(stage.beatId);
  return deepFreeze({
    stage,
    unlocked,
    requiredActivityCount: stage.activities.length,
    enteredActivityCount: stage.activities.length - remainingActivities.length,
    remainingActivityIds: remainingActivities.map(({ id }) => id),
    entryGateSatisfied: unlocked && remainingActivities.length === 0,
    readyForNextFrontier: unlocked && remainingActivities.length === 0,
  });
}

/**
 * Separate ending gate. Entry at an earlier frontier is insufficient: credits
 * require all 60 beats and completed evidence for all 215 required activities.
 */
export function getRequiredRouteCreditsGate(campaignState, completedActivityIds = []) {
  const completedBeats = new Set(campaignState?.completedBeatIds ?? []);
  const completed = new Set(Array.isArray(completedActivityIds) ? completedActivityIds : []);
  const remainingActivities = ALL_REQUIRED_ACTIVITIES.filter((entry) => !completed.has(entry.id));
  const campaignComplete = BEAT_RECORDS.every(({ beatId }) => completedBeats.has(beatId));
  return deepFreeze({
    campaignComplete,
    requiredActivityCount: ALL_REQUIRED_ACTIVITIES.length,
    completedActivityCount: ALL_REQUIRED_ACTIVITIES.length - remainingActivities.length,
    remainingActivityIds: remainingActivities.map(({ id }) => id),
    creditsReady: campaignComplete && remainingActivities.length === 0,
  });
}

const validation = validateRequiredRouteContract(REQUIRED_ROUTE_CONTRACT);
if (!validation.ok) throw new TypeError(validation.errors.join(' '));
