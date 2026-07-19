/**
 * Executable chronological witness for the all-finite intended route.
 *
 * Canonical play is first proven by runCanonicalCompletion(). This runner then
 * reconstructs the canonical campaign frontier with public immutable state
 * transitions and consumes each required activity at its exact unlock beat.
 * It records no elapsed time. Repeat milestones execute one logical replay and
 * benchmark identical 1x/2x/4x presentation schedules without wall-clock waits.
 */

import {
  createAdvancementState,
  getEncounterRewardPreview,
  getEncounterWinCount,
  getPartyMember,
  grantRewardBundle,
  preparePartyForEncounter,
  recordEncounterWin,
  unlockPartyMember,
} from './advancement.mjs';
import {
  acknowledgeArchiveRecordParagraph,
  beginArchiveRecord,
  createArchiveRecordState,
  getArchiveRecordRuntimeMetrics,
} from './archive-record-runtime.mjs';
import {
  acknowledgeCampConversationLine,
  acknowledgeCampConversationResponse,
  beginCampConversation,
  chooseCampConversationOption,
  createCampConversationState,
  getCampConversationRuntimeMetrics,
} from './camp-conversation-runtime.mjs';
import { runCanonicalCompletion } from './canonical-run.mjs';
import { PARTY_PROFILES } from './campaign-combat.mjs';
import { getArchiveRecord } from './content/archive-records.mjs';
import { getCampConversation } from './content/camp-conversations.mjs';
import { CAMPAIGN } from './content/campaign.mjs';
import { getEncounter } from './content/encounters.mjs';
import { getPartyCouncil } from './content/party-councils.mjs';
import { getSideQuest } from './content/sidequests.mjs';
import { getWitnessChronicle } from './content/witness-chronicles.mjs';
import {
  applyLoadoutToPartyProfile,
  createLoadoutState,
  grantInventory,
} from './loadout.mjs';
import {
  acknowledgePartyCouncilLine,
  acknowledgePartyCouncilResponse,
  beginPartyCouncil,
  choosePartyCouncilOption,
  createPartyCouncilState,
  getPartyCouncilRuntimeMetrics,
} from './party-council-runtime.mjs';
import {
  appendChoice,
  completeCurrentBeat,
  createCampaignState,
  getCurrentBeat,
  isCampaignComplete,
  selectChoice,
} from './progression.mjs';
import {
  acceptQuest,
  advanceQuestObjective,
  completeQuest,
  createQuestState,
  getQuestAvailability,
} from './quest-runtime.mjs';
import {
  REQUIRED_ROUTE_CONTRACT,
  REQUIRED_ROUTE_METRICS,
  getRequiredRouteCreditsGate,
  getRequiredRouteStageGate,
  validateRequiredRouteContract,
} from './required-route-contract.mjs';
import { benchmarkRepeatBattleSpeeds } from './repeat-battle.mjs';
import {
  WITNESS_CHRONICLE_STATUSES,
  acceptWitnessChronicle,
  acknowledgeWitnessChronicleLine,
  advanceWitnessChronicle,
  completeWitnessChronicle,
  createWitnessChronicleState,
  getWitnessChronicleProgress,
  getWitnessChronicleRuntimeMetrics,
} from './witness-chronicle-runtime.mjs';
import {
  WITNESS_STAGE_FIELDWORK,
  getWitnessStageFieldwork,
  getWitnessStageFieldworkMetrics,
  validateWitnessStageFieldwork,
} from './witness-stage-fieldwork.mjs';
import { runWitnessFieldworkTraversal } from './witness-fieldwork-run.mjs';

export const REQUIRED_ROUTE_RUN_VERSION = 1;
export const DEFAULT_REQUIRED_ROUTE_RUN_ID = 'required-route-audit-0001';

const MULTI_SELECT_BEAT_IDS = new Set(['c9-03-conservatory-offers']);
const BEATS = Object.freeze(CAMPAIGN.chapters.flatMap((chapter) => chapter.beats));
const CHAPTER_BY_ID = new Map(CAMPAIGN.chapters.map((chapter) => [chapter.id, chapter]));

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

function detailFor(result) {
  if (result?.reason) return result.reason;
  if (result?.code) return result.code;
  if (result?.errors?.length) return result.errors.join(' ');
  return 'unknown transition failure';
}

function requireOk(result, label) {
  if (!result?.ok) throw new Error(`${label}: ${detailFor(result)}`);
  return result;
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

function objectiveId(objective, index) {
  return objective?.id ?? `objective-${index + 1}`;
}

function validateBounds(options) {
  const bounds = {
    maxTransitions: options.maxTransitions ?? 10_000,
    maxTraceEvents: options.maxTraceEvents ?? 1_000,
  };
  for (const [name, value] of Object.entries(bounds)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive safe integer.`);
  }
  return Object.freeze(bounds);
}

function restedProfiles(encounter, advancementState, loadoutState) {
  return Object.fromEntries(encounter.party.roster.map((memberId) => {
    const member = getPartyMember(advancementState, memberId);
    const adapted = applyLoadoutToPartyProfile({
      ...PARTY_PROFILES[memberId],
      stats: {
        hp: member.stats.hp,
        power: Math.max(member.stats.power, member.stats.arcana),
        guard: member.stats.guard,
        speed: member.stats.speed,
      },
    }, loadoutState, memberId);
    return [memberId, { ...adapted, currentHp: adapted.stats.hp }];
  }));
}

/** Execute the intended route without inventing or sampling elapsed time. */
export function runRequiredRouteCompletion(options = {}) {
  const contractValidation = validateRequiredRouteContract(REQUIRED_ROUTE_CONTRACT);
  if (!contractValidation.ok) throw new Error(`Invalid required-route contract: ${contractValidation.errors.join(' ')}`);
  const fieldworkValidation = validateWitnessStageFieldwork(WITNESS_STAGE_FIELDWORK);
  if (!fieldworkValidation.ok) throw new Error(`Invalid witness fieldwork: ${fieldworkValidation.errors.join(' ')}`);
  const bounds = validateBounds(options);
  const runId = options.runId ?? DEFAULT_REQUIRED_ROUTE_RUN_ID;
  if (typeof runId !== 'string' || !runId.trim()) throw new TypeError('runId must be a non-empty string.');

  const canonical = runCanonicalCompletion({ runId });
  if (!canonical.ok || !canonical.fullyIntegrated || !canonical.proof.valid
    || !canonical.proof.campaignComplete || !canonical.proof.firstClearsComplete) {
    throw new Error('Required route needs a fully integrated canonical completion witness.');
  }
  if (canonical.proof.totalMs !== 0 || canonical.proof.durationProven !== false
    || canonical.summary.receiptPlaytimeMs !== 0 || canonical.summary.fieldPlaytimeMs !== 0) {
    throw new Error('Canonical route seed unexpectedly contains elapsed-time evidence.');
  }

  const canonicalBattlesByBeat = new Map(BEATS.map((beat) => [beat.id, []]));
  const canonicalFirstClearIds = [];
  for (const event of canonical.trace) {
    if (event.type !== 'battle-first-clear') continue;
    const bucket = canonicalBattlesByBeat.get(event.beatId);
    if (!bucket) throw new Error(`Canonical trace placed ${event.encounterId} outside the beat catalogue.`);
    bucket.push(event.encounterId);
    canonicalFirstClearIds.push(event.encounterId);
  }
  if (new Set(canonicalFirstClearIds).size !== canonicalFirstClearIds.length
    || canonicalFirstClearIds.length !== canonical.summary.firstClearCount) {
    throw new Error('Canonical trace does not expose one unique event per first clear.');
  }

  let campaignState = createCampaignState();
  let advancementState = createAdvancementState();
  let loadoutState = createLoadoutState();
  let questState = createQuestState();
  let witnessState = createWitnessChronicleState();
  let campState = createCampConversationState(runId);
  let councilState = createPartyCouncilState(runId);
  let archiveState = createArchiveRecordState(runId);
  let transitionCount = 0;
  let requiredActivityCount = 0;
  let canonicalChoiceCount = 0;
  let canonicalFirstClearCount = 0;
  let questObjectiveCount = 0;
  let witnessLineCount = 0;
  let witnessStageCount = 0;
  let witnessChoiceCount = 0;
  let witnessPauseCount = 0;
  let witnessResumeCount = 0;
  let campMainLineCount = 0;
  let campResponseLineCount = 0;
  let councilMainLineCount = 0;
  let councilResponseLineCount = 0;
  let archiveParagraphCount = 0;
  let rewardSettlementCount = 0;
  let repeatWinCount = 0;
  const pendingWitnessIds = new Set();
  const pausedWitnessStage = new Map();
  const completedWitnessIds = new Set();
  const enteredActivityIds = new Set();
  const completedActivityIds = new Set();
  const trace = [];
  const repeatSchedules = [];

  const emit = (event) => {
    if (trace.length >= bounds.maxTraceEvents) throw new Error(`Required-route trace exceeded ${bounds.maxTraceEvents} events.`);
    trace.push(deepFreeze({ sequence: trace.length + 1, ...event }));
  };

  const consumeTransitions = (count, label) => {
    if (transitionCount + count > bounds.maxTransitions) {
      throw new Error(`${label} would exceed the ${bounds.maxTransitions}-transition bound.`);
    }
    transitionCount += count;
  };

  const settleReward = (reward, label) => {
    const advancementGrant = requireOk(grantRewardBundle(advancementState, reward), `${label} advancement reward`);
    const loadoutGrant = requireOk(grantInventory(loadoutState, {
      currency: reward.currency,
      items: reward.items,
    }), `${label} loadout reward`);
    if (loadoutGrant.receipt.unknown.length) {
      throw new Error(`${label} has uncatalogued loadout rewards: ${loadoutGrant.receipt.unknown.join(', ')}.`);
    }
    advancementState = advancementGrant.state;
    loadoutState = loadoutGrant.state;
    rewardSettlementCount += 1;
    consumeTransitions(2, `${label} reward settlement`);
  };

  const reconstructFirstClear = (encounterId, beatId) => {
    const encounter = getEncounter(encounterId);
    if (!encounter) throw new Error(`Unknown canonical encounter ${encounterId}.`);
    if (getEncounterWinCount(advancementState, encounterId) !== 0) {
      throw new Error(`${encounterId} is not a first clear at ${beatId}.`);
    }
    advancementState = preparePartyForEncounter(advancementState, encounterId, { partyIds: encounter.party.roster });
    const reward = getEncounterRewardPreview(encounterId, 0);
    advancementState = recordEncounterWin(advancementState, encounterId, { partyIds: encounter.party.roster });
    const granted = requireOk(grantInventory(loadoutState, {
      currency: reward.currency,
      items: reward.items,
    }), `reconstruct ${encounterId} loadout reward`);
    if (granted.receipt.unknown.length) throw new Error(`${encounterId} has uncatalogued encounter loot.`);
    loadoutState = granted.state;
    canonicalFirstClearCount += 1;
    consumeTransitions(3, `reconstruct ${encounterId}`);
    emit({ type: 'canonical-first-clear-reconstructed', beatId, encounterId, winCount: 1 });
  };

  const executeRepeatWin = (milestone, beatId) => {
    const encounter = getEncounter(milestone.encounterId);
    if (!encounter) throw new Error(`Unknown grind encounter ${milestone.encounterId}.`);
    const priorWins = getEncounterWinCount(advancementState, encounter.id);
    if (priorWins < 1) throw new Error(`${milestone.id} requires a canonical first clear before repeat grinding.`);
    const benchmark = benchmarkRepeatBattleSpeeds({
      encounterId: encounter.id,
      priorWins,
      partyProfiles: restedProfiles(encounter, advancementState, loadoutState),
    });
    if (!benchmark.verified || !benchmark.decisionsAndRewardsInvariant || !benchmark.timingVerified
      || JSON.stringify(Object.keys(benchmark.ratios).map(Number)) !== JSON.stringify(milestone.speedMultipliers)
      || benchmark.ratios[1] !== 1 || benchmark.ratios[2] !== 2 || benchmark.ratios[4] !== 4) {
      throw new Error(`${milestone.id} did not preserve exact repeat speed semantics.`);
    }
    const reward = getEncounterRewardPreview(encounter.id, priorWins);
    if (JSON.stringify(reward) !== JSON.stringify(benchmark.runs[0].reward)) {
      throw new Error(`${milestone.id} benchmark reward differs from the public advancement preview.`);
    }
    advancementState = recordEncounterWin(advancementState, encounter.id, { partyIds: encounter.party.roster });
    const granted = requireOk(grantInventory(loadoutState, {
      currency: reward.currency,
      items: reward.items,
    }), `${milestone.id} repeat reward`);
    if (granted.receipt.unknown.length) throw new Error(`${milestone.id} has uncatalogued repeat loot.`);
    loadoutState = granted.state;
    repeatWinCount += 1;
    consumeTransitions(2, `${milestone.id} repeat win`);
    const schedule = deepFreeze({
      milestoneId: milestone.id,
      beatId,
      encounterId: encounter.id,
      priorWins,
      requiredRepeatWins: milestone.requiredRepeatWins,
      scheduledMsBySpeed: Object.fromEntries(benchmark.runs.map((run) => [run.speedMultiplier, run.simulatedDurationMs])),
      ratios: benchmark.ratios,
      decisionsAndRewardsInvariant: benchmark.decisionsAndRewardsInvariant,
      elapsedTimeRecordedMs: 0,
    });
    repeatSchedules.push(schedule);
    return schedule;
  };

  const executeQuest = (routeActivity, beatId) => {
    const quest = getSideQuest(routeActivity.questId);
    if (!quest) throw new Error(`Unknown route quest ${routeActivity.questId}.`);
    const context = { campaignState, advancementState };
    const availability = getQuestAvailability(questState, quest.id, context);
    if (!availability.available) throw new Error(`${quest.id} is unavailable after ${beatId}: ${availability.reason}`);
    const accepted = requireOk(acceptQuest(questState, quest.id, context), `accept ${quest.id}`);
    questState = accepted.state;
    consumeTransitions(1, `accept ${quest.id}`);
    let repeatSchedule = null;
    for (const [index, objective] of quest.objectives.entries()) {
      if (objective.encounterId && getEncounterWinCount(advancementState, objective.encounterId) < 1) {
        throw new Error(`${quest.id}/${objective.id} lacks required encounter evidence.`);
      }
      if (routeActivity.type === 'repeat-grind-milestone' && objective.type === 'battle-replay') {
        repeatSchedule = executeRepeatWin(routeActivity, beatId);
      }
      const advanced = requireOk(
        advanceQuestObjective(questState, quest.id, objectiveId(objective, index)),
        `advance ${quest.id}/${objective.id}`,
      );
      questState = advanced.state;
      questObjectiveCount += 1;
      consumeTransitions(1, `advance ${quest.id}/${objective.id}`);
    }
    const completed = requireOk(completeQuest(questState, quest.id), `complete ${quest.id}`);
    questState = completed.state;
    consumeTransitions(1, `complete ${quest.id}`);
    if (completed.reward !== quest.rewards.firstClear) throw new Error(`${quest.id} returned a non-canonical first-circuit reward.`);
    settleReward(completed.reward, quest.id);
    if (routeActivity.type === 'repeat-grind-milestone') {
      const replay = getQuestAvailability(questState, quest.id, { campaignState, advancementState });
      if (!replay.available || !repeatSchedule) throw new Error(`${quest.id} did not remain repeatable after its required first circuit.`);
      emit({
        type: 'repeat-grind-milestone-complete',
        beatId,
        activityId: routeActivity.id,
        questId: quest.id,
        encounterId: routeActivity.encounterId,
        completionCount: completed.progress.completions,
        schedule: repeatSchedule,
      });
    } else {
      emit({
        type: 'finite-sidequest-complete',
        beatId,
        activityId: routeActivity.id,
        objectiveCount: quest.objectives.length,
        completionCount: completed.progress.completions,
      });
    }
  };

  const processWitness = (chronicleId, beatId) => {
    const chronicle = getWitnessChronicle(chronicleId);
    if (!chronicle) throw new Error(`Unknown witness chronicle ${chronicleId}.`);
    const pausedStageId = pausedWitnessStage.get(chronicleId);
    if (pausedStageId) {
      const pausedProgress = getWitnessChronicleProgress(witnessState, chronicleId);
      if (pausedProgress.currentStage?.id !== pausedStageId) {
        throw new Error(`${chronicleId} moved while paused at ${pausedStageId}.`);
      }
      if (getEncounterWinCount(advancementState, pausedProgress.currentStage.encounterId) < 1) return false;
      witnessResumeCount += 1;
      pausedWitnessStage.delete(chronicleId);
      emit({ type: 'witness-chronicle-resumed', beatId, chronicleId });
    }
    while (true) {
      const progress = getWitnessChronicleProgress(witnessState, chronicleId);
      if (progress.status !== WITNESS_CHRONICLE_STATUSES.ACTIVE) {
        if (progress.status === WITNESS_CHRONICLE_STATUSES.COMPLETED) return true;
        throw new Error(`${chronicleId} is not active while processing its route.`);
      }
      if (progress.readyToComplete) {
        const completed = requireOk(completeWitnessChronicle(witnessState, chronicleId), `complete ${chronicleId}`);
        witnessState = completed.state;
        consumeTransitions(1, `complete ${chronicleId}`);
        settleReward(completed.reward, chronicleId);
        pendingWitnessIds.delete(chronicleId);
        completedWitnessIds.add(chronicleId);
        completedActivityIds.add(chronicleId);
        emit({
          type: 'witness-chronicle-complete',
          beatId,
          chronicleId,
          acceptedAfterBeatId: chronicle.opensAfterBeatId,
          completionAfterBeatId: beatId,
          choiceId: completed.progress.choiceId,
        });
        return true;
      }
      const stage = progress.currentStage;
      while (getWitnessChronicleProgress(witnessState, chronicleId).currentDialogueLine) {
        const acknowledged = requireOk(
          acknowledgeWitnessChronicleLine(witnessState, chronicleId),
          `acknowledge ${chronicleId}/${stage.id}`,
        );
        witnessState = acknowledged.state;
        witnessLineCount += 1;
        consumeTransitions(1, `acknowledge ${chronicleId}/${stage.id}`);
      }
      if (stage.encounterId && getEncounterWinCount(advancementState, stage.encounterId) < 1) {
        if (!pausedWitnessStage.has(chronicleId)) {
          pausedWitnessStage.set(chronicleId, stage.id);
          witnessPauseCount += 1;
          emit({
            type: 'witness-chronicle-paused-for-canonical-evidence',
            beatId,
            chronicleId,
            stageId: stage.id,
            encounterId: stage.encounterId,
          });
        }
        return false;
      }
      const evidence = {};
      if (stage.encounterId) {
        evidence.encounterId = stage.encounterId;
        evidence.victory = true;
      }
      if (chronicle.choice.stageId === stage.id) {
        evidence.choiceId = chronicle.choice.options[0]?.id;
        if (!evidence.choiceId) throw new Error(`${chronicleId} has no canonical first choice.`);
        witnessChoiceCount += 1;
      }
      const advanced = requireOk(
        advanceWitnessChronicle(witnessState, chronicleId, stage.id, evidence),
        `advance ${chronicleId}/${stage.id}`,
      );
      witnessState = advanced.state;
      witnessStageCount += 1;
      consumeTransitions(1, `advance ${chronicleId}/${stage.id}`);
      const fieldwork = getWitnessStageFieldwork(chronicleId, stage.id);
      if (!fieldwork) throw new Error(`${chronicleId}/${stage.id} lacks canonical fieldwork.`);
    }
  };

  const acceptWitness = (routeActivity, beatId) => {
    const chronicle = getWitnessChronicle(routeActivity.id);
    const accepted = requireOk(
      acceptWitnessChronicle(witnessState, chronicle.id, { campaignState }),
      `accept ${chronicle.id}`,
    );
    witnessState = accepted.state;
    pendingWitnessIds.add(chronicle.id);
    consumeTransitions(1, `accept ${chronicle.id}`);
    emit({
      type: 'witness-chronicle-accepted-at-unlock',
      beatId,
      activityId: routeActivity.id,
      chronicleId: chronicle.id,
      unlockAfterBeatId: chronicle.opensAfterBeatId,
    });
    processWitness(chronicle.id, beatId);
  };

  const executeCampConversation = (routeActivity, beatId) => {
    const conversation = getCampConversation(routeActivity.id);
    const context = { campaignState, advancementState, campId: routeActivity.campId };
    const begun = requireOk(beginCampConversation(campState, conversation.id, context), `begin ${conversation.id}`);
    campState = begun.state;
    consumeTransitions(1, `begin ${conversation.id}`);
    for (let index = 0; index < conversation.dialogue.length; index += 1) {
      const acknowledged = requireOk(
        acknowledgeCampConversationLine(campState, conversation.id),
        `acknowledge ${conversation.id} main line ${index + 1}`,
      );
      campState = acknowledged.state;
      campMainLineCount += 1;
      consumeTransitions(1, `acknowledge ${conversation.id} main line`);
    }
    const choiceId = conversation.choice.options[0]?.id;
    const chosen = requireOk(chooseCampConversationOption(campState, conversation.id, choiceId), `choose ${conversation.id}`);
    campState = chosen.state;
    consumeTransitions(1, `choose ${conversation.id}`);
    for (let index = 0; index < chosen.option.response.length; index += 1) {
      const acknowledged = requireOk(
        acknowledgeCampConversationResponse(campState, conversation.id),
        `acknowledge ${conversation.id} response ${index + 1}`,
      );
      campState = acknowledged.state;
      campResponseLineCount += 1;
      consumeTransitions(1, `acknowledge ${conversation.id} response`);
    }
    emit({ type: 'camp-conversation-complete', beatId, activityId: conversation.id, campId: routeActivity.campId });
  };

  const executePartyCouncil = (routeActivity, beatId) => {
    const council = getPartyCouncil(routeActivity.id);
    const context = { campaignState, advancementState, campId: routeActivity.campId };
    const begun = requireOk(beginPartyCouncil(councilState, council.id, context), `begin ${council.id}`);
    councilState = begun.state;
    consumeTransitions(1, `begin ${council.id}`);
    for (let index = 0; index < council.dialogue.length; index += 1) {
      const acknowledged = requireOk(
        acknowledgePartyCouncilLine(councilState, council.id),
        `acknowledge ${council.id} main line ${index + 1}`,
      );
      councilState = acknowledged.state;
      councilMainLineCount += 1;
      consumeTransitions(1, `acknowledge ${council.id} main line`);
    }
    const choiceId = council.choice.options[0]?.id;
    const chosen = requireOk(choosePartyCouncilOption(councilState, council.id, choiceId), `choose ${council.id}`);
    councilState = chosen.state;
    consumeTransitions(1, `choose ${council.id}`);
    for (let index = 0; index < chosen.option.response.length; index += 1) {
      const acknowledged = requireOk(
        acknowledgePartyCouncilResponse(councilState, council.id),
        `acknowledge ${council.id} response ${index + 1}`,
      );
      councilState = acknowledged.state;
      councilResponseLineCount += 1;
      consumeTransitions(1, `acknowledge ${council.id} response`);
    }
    emit({ type: 'party-council-complete', beatId, activityId: council.id, campId: routeActivity.campId });
  };

  const executeArchiveRecord = (routeActivity, beatId) => {
    const record = getArchiveRecord(routeActivity.id);
    const begun = requireOk(beginArchiveRecord(archiveState, record.id, { campaignState }), `begin ${record.id}`);
    archiveState = begun.state;
    consumeTransitions(1, `begin ${record.id}`);
    for (let index = 0; index < record.paragraphs.length; index += 1) {
      const acknowledged = requireOk(
        acknowledgeArchiveRecordParagraph(archiveState, record.id),
        `acknowledge ${record.id} paragraph ${index + 1}`,
      );
      archiveState = acknowledged.state;
      archiveParagraphCount += 1;
      consumeTransitions(1, `acknowledge ${record.id} paragraph`);
    }
    emit({ type: 'archive-record-complete', beatId, activityId: record.id, paragraphCount: record.paragraphs.length });
  };

  for (const stage of REQUIRED_ROUTE_CONTRACT.stages) {
    const beat = getCurrentBeat(campaignState);
    if (beat.id !== stage.beatId) throw new Error(`Campaign frontier expected ${stage.beatId}, found ${beat.id}.`);
    const chapter = CHAPTER_BY_ID.get(stage.chapterId);
    for (const memberId of chapter?.party ?? []) {
      const unlocked = unlockPartyMember(advancementState, memberId);
      if (unlocked !== advancementState) {
        advancementState = unlocked;
        consumeTransitions(1, `unlock ${memberId} for ${stage.chapterId}`);
        emit({ type: 'chapter-party-member-unlocked', beatId: beat.id, chapterId: stage.chapterId, memberId });
      }
    }
    const selectedChoices = MULTI_SELECT_BEAT_IDS.has(beat.id)
      ? (beat.choices ?? [])
      : (beat.choices ?? []).slice(0, 1);
    for (const choice of selectedChoices) {
      campaignState = MULTI_SELECT_BEAT_IDS.has(beat.id)
        ? appendChoice(campaignState, choice.id)
        : selectChoice(campaignState, choice.id);
      canonicalChoiceCount += 1;
      consumeTransitions(1, `select ${choice.id}`);
    }
    for (const encounterId of canonicalBattlesByBeat.get(beat.id)) reconstructFirstClear(encounterId, beat.id);
    const priorCompletedCount = campaignState.completedBeatIds.length;
    campaignState = completeCurrentBeat(campaignState);
    if (campaignState.completedBeatIds.length !== priorCompletedCount + 1) {
      throw new Error(`${beat.id} did not advance the reconstructed campaign frontier.`);
    }
    consumeTransitions(1, `complete ${beat.id}`);
    emit({
      type: 'canonical-beat-complete',
      beatId: beat.id,
      chapterId: stage.chapterId,
      beatNumber: stage.sequence,
      unlockedRequiredActivityCount: stage.activities.length,
    });

    for (const chronicleId of [...pendingWitnessIds]) processWitness(chronicleId, beat.id);

    for (const routeActivity of stage.activities) {
      if (routeActivity.unlockAfterBeatId !== beat.id) {
        throw new Error(`${routeActivity.id} is displaced from its required unlock frontier.`);
      }
      if (routeActivity.type === 'finite-sidequest' || routeActivity.type === 'repeat-grind-milestone') {
        executeQuest(routeActivity, beat.id);
        completedActivityIds.add(routeActivity.id);
      } else if (routeActivity.type === 'witness-chronicle') {
        acceptWitness(routeActivity, beat.id);
      } else if (routeActivity.type === 'camp-conversation') {
        executeCampConversation(routeActivity, beat.id);
        completedActivityIds.add(routeActivity.id);
      } else if (routeActivity.type === 'party-council') {
        executePartyCouncil(routeActivity, beat.id);
        completedActivityIds.add(routeActivity.id);
      } else if (routeActivity.type === 'archive-record') {
        executeArchiveRecord(routeActivity, beat.id);
        completedActivityIds.add(routeActivity.id);
      } else {
        throw new Error(`Unsupported required-route activity ${routeActivity.type}.`);
      }
      enteredActivityIds.add(routeActivity.id);
      requiredActivityCount += 1;
    }
    const stageGate = getRequiredRouteStageGate(campaignState, beat.id, [...enteredActivityIds]);
    if (!stageGate?.entryGateSatisfied) {
      throw new Error(`${beat.id} did not satisfy its exact required-route entry gate.`);
    }
  }

  for (const chronicleId of [...pendingWitnessIds]) processWitness(chronicleId, BEATS.at(-1).id);
  if (pendingWitnessIds.size) throw new Error(`Witness chronicles remain pending: ${[...pendingWitnessIds].join(', ')}.`);
  if (!isCampaignComplete(campaignState)) throw new Error('Reconstructed campaign did not reach its canonical ending.');
  const creditsGate = getRequiredRouteCreditsGate(campaignState, [...completedActivityIds]);
  if (!creditsGate.creditsReady) {
    throw new Error(`Required-route credits gate has ${creditsGate.remainingActivityIds.length} unfinished activities.`);
  }
  if (JSON.stringify(campaignState) !== JSON.stringify(canonical.states.campaign)) {
    throw new Error('Reconstructed campaign state differs from the canonical integrated witness.');
  }
  if (canonicalFirstClearCount !== canonical.summary.firstClearCount) {
    throw new Error('Reconstructed first-clear count differs from canonical proof.');
  }
  const grindEncounterIds = new Set(repeatSchedules.map(({ encounterId }) => encounterId));
  for (const encounterId of canonicalFirstClearIds) {
    const expectedWins = grindEncounterIds.has(encounterId) ? 2 : 1;
    if (getEncounterWinCount(advancementState, encounterId) !== expectedWins) {
      throw new Error(`${encounterId} expected ${expectedWins} route wins.`);
    }
  }

  const campMetrics = getCampConversationRuntimeMetrics(campState);
  const councilMetrics = getPartyCouncilRuntimeMetrics(councilState);
  const archiveMetrics = getArchiveRecordRuntimeMetrics(archiveState);
  const witnessMetrics = getWitnessChronicleRuntimeMetrics(witnessState);
  const fieldworkMetrics = getWitnessStageFieldworkMetrics();
  const fieldworkTraversal = runWitnessFieldworkTraversal({
    maxStages: fieldworkMetrics.stageCount,
    maxMovementSteps: fieldworkMetrics.minimumExactMovementSteps,
  });
  if (fieldworkTraversal.summary.completedStageCount !== fieldworkMetrics.stageCount
    || fieldworkTraversal.summary.completedNodeCount !== fieldworkMetrics.nodeCount
    || fieldworkTraversal.summary.exactMovementSteps !== fieldworkMetrics.minimumExactMovementSteps
    || fieldworkTraversal.summary.recordedPlaytimeMs !== 0) {
    throw new Error('Executable witness fieldwork differs from its canonical catalogue metrics.');
  }
  consumeTransitions(fieldworkTraversal.summary.exactMovementSteps, 'exact witness fieldwork traversal');
  if (!campMetrics.complete || !councilMetrics.complete || !archiveMetrics.complete
    || witnessMetrics.completedChronicles !== REQUIRED_ROUTE_METRICS.witnessChronicleCount
    || completedWitnessIds.size !== REQUIRED_ROUTE_METRICS.witnessChronicleCount
    || requiredActivityCount !== REQUIRED_ROUTE_METRICS.requiredActivityCount
    || repeatWinCount !== REQUIRED_ROUTE_METRICS.requiredRepeatWinCount) {
    throw new Error(`Required-route completion totals diverged: camp=${campMetrics.completedConversationCount}/${campMetrics.conversationCount}, council=${councilMetrics.completedCouncilCount}/${councilMetrics.councilCount}, archive=${archiveMetrics.completedRecordCount}/${archiveMetrics.recordCount}, witness=${witnessMetrics.completedChronicles}/${REQUIRED_ROUTE_METRICS.witnessChronicleCount}, witnessSet=${completedWitnessIds.size}, activities=${requiredActivityCount}/${REQUIRED_ROUTE_METRICS.requiredActivityCount}, repeatWins=${repeatWinCount}/${REQUIRED_ROUTE_METRICS.requiredRepeatWinCount}.`);
  }

  const scheduledRepeatPresentationMsBySpeed = Object.freeze(Object.fromEntries([1, 2, 4].map((speed) => [
    speed,
    repeatSchedules.reduce((sum, schedule) => sum + schedule.scheduledMsBySpeed[speed], 0),
  ])));
  if (scheduledRepeatPresentationMsBySpeed[1] !== scheduledRepeatPresentationMsBySpeed[2] * 2
    || scheduledRepeatPresentationMsBySpeed[1] !== scheduledRepeatPresentationMsBySpeed[4] * 4) {
    throw new Error('Aggregate required grind presentation does not scale exactly at 1x/2x/4x.');
  }

  const summary = deepFreeze({
    canonicalBeatCount: campaignState.completedBeatIds.length,
    canonicalFirstClearCount,
    canonicalChoiceCount,
    requiredActivityCount,
    completedRequiredActivityCount: creditsGate.completedActivityCount,
    finiteSideQuestCount: REQUIRED_ROUTE_METRICS.finiteSideQuestCount,
    sidequestAndContractObjectiveCount: questObjectiveCount,
    witnessChronicleCount: completedWitnessIds.size,
    witnessDialogueLineAcknowledgementCount: witnessLineCount,
    witnessStageCount,
    witnessChoiceCount,
    witnessPauseCount,
    witnessResumeCount,
    campConversationCount: campMetrics.completedConversationCount,
    campMainLineAcknowledgementCount: campMainLineCount,
    campResponseLineAcknowledgementCount: campResponseLineCount,
    partyCouncilCount: councilMetrics.completedCouncilCount,
    councilMainLineAcknowledgementCount: councilMainLineCount,
    councilResponseLineAcknowledgementCount: councilResponseLineCount,
    archiveRecordCount: archiveMetrics.completedRecordCount,
    archiveParagraphAcknowledgementCount: archiveParagraphCount,
    repeatGrindMilestoneCount: repeatSchedules.length,
    requiredRepeatWinCount: repeatWinCount,
    rewardSettlementCount,
    transitionCount,
    traceEventCount: trace.length,
    fieldworkStageCount: fieldworkMetrics.stageCount,
    fieldworkNodeCount: fieldworkMetrics.nodeCount,
    fieldworkTraversalExecuted: true,
    recordedPlaytimeMs: 0,
    durationProven: false,
  });
  const completionProof = deepFreeze({
    valid: true,
    chronological: true,
    canonicalCampaignComplete: true,
    canonicalFirstClearsComplete: true,
    allRequiredActivitiesEnteredAtExactUnlock: requiredActivityCount === REQUIRED_ROUTE_METRICS.requiredActivityCount,
    allFiniteActivitiesComplete: campMetrics.complete && councilMetrics.complete && archiveMetrics.complete
      && completedWitnessIds.size === REQUIRED_ROUTE_METRICS.witnessChronicleCount,
    grindMilestonesComplete: repeatWinCount === REQUIRED_ROUTE_METRICS.requiredRepeatWinCount,
    repeatDecisionsAndRewardsSpeedInvariant: repeatSchedules.every((schedule) => schedule.decisionsAndRewardsInvariant),
    fieldworkTraversalComplete: fieldworkTraversal.ok,
    creditsCompletionGateSatisfied: creditsGate.creditsReady,
    durationProven: false,
  });
  const durationEvidence = deepFreeze({
    recordedPlaytimeMs: 0,
    elapsedTimeClaimed: false,
    durationProven: false,
    repeatPresentationScheduleOnly: true,
    statement: 'This run proves chronological reachability, finite transition coverage, and exact repeat presentation ratios; it does not prove human elapsed duration.',
  });
  const frozenTrace = deepFreeze([...trace]);
  const frozenRepeatSchedules = deepFreeze([...repeatSchedules]);
  return deepFreeze({
    ok: true,
    version: REQUIRED_ROUTE_RUN_VERSION,
    runId,
    signature: signatureFor({
      contract: REQUIRED_ROUTE_CONTRACT,
      trace: frozenTrace,
      summary,
      repeatSchedules: frozenRepeatSchedules,
      fieldworkTraversalSignature: fieldworkTraversal.signature,
    }),
    contractSignature: signatureFor(REQUIRED_ROUTE_CONTRACT),
    summary,
    completionProof,
    durationEvidence,
    repeatScheduleAudit: {
      schedules: frozenRepeatSchedules,
      aggregateScheduledMsBySpeed: scheduledRepeatPresentationMsBySpeed,
      exactRatios: { 1: 1, 2: 2, 4: 4 },
      scheduleOnly: true,
      elapsedTimeRecordedMs: 0,
    },
    fieldworkAudit: {
      catalogSignature: signatureFor(WITNESS_STAGE_FIELDWORK),
      stageCount: fieldworkMetrics.stageCount,
      nodeCount: fieldworkMetrics.nodeCount,
      minimumExactMovementSteps: fieldworkMetrics.minimumExactMovementSteps,
      traversalSignature: fieldworkTraversal.signature,
      exactMovementSteps: fieldworkTraversal.summary.exactMovementSteps,
      coordinateJumpCount: fieldworkTraversal.summary.coordinateJumpCount,
      recordedPlaytimeMs: fieldworkTraversal.summary.recordedPlaytimeMs,
      traversalExecuted: true,
    },
    fieldworkTraversal,
    canonical: {
      signature: canonical.signature,
      summary: canonical.summary,
      proof: canonical.proof,
    },
    trace: frozenTrace,
    states: {
      campaign: campaignState,
      advancement: advancementState,
      loadout: loadoutState,
      quests: questState,
      witnessChronicles: witnessState,
      campConversations: campState,
      partyCouncils: councilState,
      archiveRecords: archiveState,
    },
  });
}
