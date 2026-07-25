/**
 * Save-stable playable schedules projected from the Act III war-table route.
 *
 * This module owns ordering only. The Storyworld record remains the authority
 * that selects Salt, Ash, or Paper; campaign and receipt states store the
 * resulting ordered prefixes as evidence.
 */

import { CAMPAIGN } from './content/campaign.mjs';
import {
  ACT3_OPERATION_POOL,
  ACT_ROUTE_THEATERS,
  buildAct3SequencePlan,
  resolveAct4ApproachMap,
} from './content/act-route-sequences.mjs';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const CANONICAL_CAMPAIGN_BEAT_IDS = deepFreeze(
  CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map(({ id }) => id)),
);

const canonicalBeatSet = new Set(CANONICAL_CAMPAIGN_BEAT_IDS);
const routeDecisionIndex = CANONICAL_CAMPAIGN_BEAT_IDS.indexOf('c3-01-separate-arrivals');
if (routeDecisionIndex < 0) throw new Error('The campaign route decision anchor is missing.');

const PRE_ROUTE_BEAT_IDS = CANONICAL_CAMPAIGN_BEAT_IDS.slice(0, routeDecisionIndex);
const ACT3_FIXED_END_BEAT_IDS = Object.freeze([
  'c7-01-decision-map-table',
  'c7-02-former-retainer',
  'c7-03-aqueduct-names',
  'c7-05-rescue-before-ring',
  'c7-04-lises-revised-oath',
]);
const POST_ACT3_BEAT_IDS = CANONICAL_CAMPAIGN_BEAT_IDS.slice(
  CANONICAL_CAMPAIGN_BEAT_IDS.indexOf('c8-01-three-homecomings'),
);
const operationById = new Map(ACT3_OPERATION_POOL.map((operation) => [operation.id, operation]));

const STORYWORLD_FIXED_BEFORE_OPERATIONS = Object.freeze([
  'sw1-clerks-second-copy',
  'sw2-witness-not-family',
  'sw3-sayos-warehouse-conditions',
]);
const STORYWORLD_FIXED_AFTER_OPERATIONS = Object.freeze([
  'sw7-soldier-will-not-follow',
  'sw8-boats-with-conditions',
  'sw-enma-three-terms',
  'sw9-mateus-living-archive',
  'sw10-corrections-desk',
]);

function unique(values) {
  return [...new Set(values)];
}

function buildNarrativeSchedule(priorityTheater) {
  const act3 = buildAct3SequencePlan({ priorityTheater });
  const operations = act3.selectedOperationIds.map((operationId) => operationById.get(operationId));
  const beatIds = unique([
    ...PRE_ROUTE_BEAT_IDS,
    'c3-01-separate-arrivals',
    ...operations.flatMap(({ beatIds: operationBeatIds }) => operationBeatIds),
    ...ACT3_FIXED_END_BEAT_IDS,
    ...POST_ACT3_BEAT_IDS,
  ]);
  const storyworldDecisionIds = unique([
    ...STORYWORLD_FIXED_BEFORE_OPERATIONS,
    ...operations.flatMap(({ storyworldClusterIds }) => storyworldClusterIds),
    ...STORYWORLD_FIXED_AFTER_OPERATIONS,
  ]);
  const omittedBeatIds = CANONICAL_CAMPAIGN_BEAT_IDS.filter((beatId) => !beatIds.includes(beatId));
  return deepFreeze({
    id: `narrative-${priorityTheater}`,
    mode: 'narrative',
    priorityTheater,
    priorityLabel: ACT_ROUTE_THEATERS[priorityTheater].label,
    selectedOperationIds: act3.selectedOperationIds,
    omittedOperationId: act3.omittedOperationId,
    beatIds,
    omittedBeatIds,
    storyworldDecisionIds,
    approachMapId: resolveAct4ApproachMap(priorityTheater),
    playedCanonicalSceneCount: beatIds.length,
    playedStoryworldSceneCount: storyworldDecisionIds.length * 2,
    playedSceneCount: beatIds.length + (storyworldDecisionIds.length * 2),
  });
}

export const CAMPAIGN_ROUTE_SCHEDULES = deepFreeze({
  canonical: {
    id: 'canonical',
    mode: 'canonical',
    priorityTheater: null,
    priorityLabel: 'Canonical production order',
    selectedOperationIds: ACT3_OPERATION_POOL.map(({ id }) => id),
    omittedOperationId: null,
    beatIds: CANONICAL_CAMPAIGN_BEAT_IDS,
    omittedBeatIds: [],
    storyworldDecisionIds: [
      ...STORYWORLD_FIXED_BEFORE_OPERATIONS,
      ...ACT3_OPERATION_POOL.flatMap(({ storyworldClusterIds }) => storyworldClusterIds),
      ...STORYWORLD_FIXED_AFTER_OPERATIONS,
    ],
    approachMapId: 'c8-black-gate',
    playedCanonicalSceneCount: CANONICAL_CAMPAIGN_BEAT_IDS.length,
    playedStoryworldSceneCount: 22,
    playedSceneCount: CANONICAL_CAMPAIGN_BEAT_IDS.length + 22,
  },
  salt: buildNarrativeSchedule('salt'),
  ash: buildNarrativeSchedule('ash'),
  paper: buildNarrativeSchedule('paper'),
});

export function getCampaignRouteSchedule(priorityTheater = null) {
  if (priorityTheater == null) return CAMPAIGN_ROUTE_SCHEDULES.canonical;
  const schedule = CAMPAIGN_ROUTE_SCHEDULES[priorityTheater];
  if (!schedule) throw new RangeError(`Unknown campaign route theater ${priorityTheater}.`);
  return schedule;
}

export function getNarrativeRouteSchedules() {
  return Object.freeze(Object.keys(ACT_ROUTE_THEATERS).map((theater) => CAMPAIGN_ROUTE_SCHEDULES[theater]));
}

export function getRouteMapIdForBeat(beatId, priorityTheater = null, fallbackMapId = null) {
  if (beatId === 'c8-02-consent-not-conscription' && priorityTheater) {
    return getCampaignRouteSchedule(priorityTheater).approachMapId;
  }
  return fallbackMapId;
}

export function inferRouteScheduleFromPrefix(completedBeatIds, currentBeatId = null) {
  const candidates = [
    ...getNarrativeRouteSchedules(),
    CAMPAIGN_ROUTE_SCHEDULES.canonical,
  ].filter((schedule) => (
    completedBeatIds.every((beatId, index) => schedule.beatIds[index] === beatId)
      && (
        currentBeatId == null
        || completedBeatIds.includes(currentBeatId)
        || schedule.beatIds[completedBeatIds.length] === currentBeatId
      )
  ));
  return Object.freeze(candidates);
}

function validateSchedules() {
  const errors = [];
  for (const schedule of Object.values(CAMPAIGN_ROUTE_SCHEDULES)) {
    if (new Set(schedule.beatIds).size !== schedule.beatIds.length) errors.push(`${schedule.id} repeats a beat.`);
    for (const beatId of schedule.beatIds) if (!canonicalBeatSet.has(beatId)) errors.push(`${schedule.id} has unknown beat ${beatId}.`);
    if (schedule.mode === 'narrative') {
      if (schedule.selectedOperationIds.length !== 3) errors.push(`${schedule.id} must select three operations.`);
      if (schedule.omittedBeatIds.length < 1) errors.push(`${schedule.id} must omit one regional operation.`);
      if (schedule.beatIds.at(-1) !== CANONICAL_CAMPAIGN_BEAT_IDS.at(-1)) errors.push(`${schedule.id} must reach the epilogue ending.`);
    }
  }
  if (errors.length) throw new Error(`Invalid campaign route schedules:\n${errors.join('\n')}`);
}

validateSchedules();
