/**
 * Bounded, DOM-free completion witness for every shipped finite optional arc.
 *
 * This harness starts from runCanonicalCompletion(), then uses only the public
 * quest, witness-chronicle, advancement, and loadout transitions. It proves
 * deterministic reachability and one-time reward settlement. It deliberately
 * records no elapsed time and must never be treated as duration evidence.
 */

import {
  getEncounterWinCount,
  grantRewardBundle,
} from './advancement.mjs';
import { runCanonicalCompletion } from './canonical-run.mjs';
import {
  REPEATABLE_CONTRACTS,
  SIDE_QUESTS,
} from './content/sidequests.mjs';
import {
  WITNESS_CHRONICLES,
  getWitnessChronicleMetrics,
} from './content/witness-chronicles.mjs';
import { grantInventory } from './loadout.mjs';
import {
  QUEST_STATUSES,
  acceptQuest,
  advanceQuestObjective,
  completeQuest,
  createQuestState,
  getQuestAvailability,
} from './quest-runtime.mjs';
import {
  WITNESS_CHRONICLE_STATUSES,
  acceptWitnessChronicle,
  acknowledgeWitnessChronicleLine,
  advanceWitnessChronicle,
  completeWitnessChronicle,
  createWitnessChronicleState,
  getWitnessChronicleAvailability,
} from './witness-chronicle-runtime.mjs';
import {
  WITNESS_STAGE_FIELDWORK,
  getWitnessStageFieldworkMetrics,
  validateWitnessStageFieldwork,
} from './witness-stage-fieldwork.mjs';

export const FINITE_CONTENT_RUN_VERSION = 1;
export const DEFAULT_FINITE_CONTENT_RUN_ID = 'finite-content-audit-0001';

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const SIDE_QUEST_OBJECTIVE_COUNT = SIDE_QUESTS.reduce(
  (sum, quest) => sum + quest.objectives.length,
  0,
);
const WITNESS_METRICS = getWitnessChronicleMetrics();
const FIELDWORK_METRICS = getWitnessStageFieldworkMetrics();
const FINITE_REWARD_COUNT = SIDE_QUESTS.length + WITNESS_CHRONICLES.length;

// Accept/objective-or-line/stage/complete transitions plus two public reward
// ledger transitions for every finite completion.
const REQUIRED_TRANSITION_COUNT = (
  SIDE_QUESTS.length
  + SIDE_QUEST_OBJECTIVE_COUNT
  + SIDE_QUESTS.length
  + (SIDE_QUESTS.length * 2)
  + WITNESS_CHRONICLES.length
  + WITNESS_METRICS.lineCount
  + WITNESS_METRICS.stageCount
  + WITNESS_CHRONICLES.length
  + (WITNESS_CHRONICLES.length * 2)
);

// One trace event for each content transition, one atomic reward event and one
// replay-refusal event per completion, plus canonical-seed and fieldwork audit.
const REQUIRED_TRACE_EVENT_COUNT = (
  2
  + SIDE_QUESTS.length
  + SIDE_QUEST_OBJECTIVE_COUNT
  + SIDE_QUESTS.length
  + SIDE_QUESTS.length
  + SIDE_QUESTS.length
  + WITNESS_CHRONICLES.length
  + WITNESS_METRICS.lineCount
  + WITNESS_METRICS.stageCount
  + WITNESS_CHRONICLES.length
  + WITNESS_CHRONICLES.length
  + WITNESS_CHRONICLES.length
);

export const FINITE_CONTENT_RUN_EXPECTATIONS = deepFreeze({
  finiteSideQuestCount: 13,
  sideQuestObjectiveCount: 59,
  witnessChronicleCount: 18,
  witnessDialogueLineCount: 288,
  witnessStageCount: 67,
  witnessCombatStageCount: 12,
  finiteRewardCount: 31,
  fieldworkNodeCount: 152,
  minimumExactMovementSteps: 729,
  requiredTransitionCount: 538,
  requiredTraceEventCount: 540,
});

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

function detailFor(result) {
  if (result?.reason) return result.reason;
  if (result?.code) return result.code;
  if (result?.errors?.length) return result.errors.join(' ');
  return 'unknown transition failure';
}

function objectiveId(objective, index) {
  return objective?.id ?? `objective-${index + 1}`;
}

function sortedNumberMap(values) {
  return Object.freeze(Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => left.localeCompare(right)),
  ));
}

function increment(map, key, quantity) {
  map[key] = (map[key] ?? 0) + quantity;
}

function validateShippedQuantities() {
  const actual = {
    finiteSideQuestCount: SIDE_QUESTS.length,
    sideQuestObjectiveCount: SIDE_QUEST_OBJECTIVE_COUNT,
    witnessChronicleCount: WITNESS_CHRONICLES.length,
    witnessDialogueLineCount: WITNESS_METRICS.lineCount,
    witnessStageCount: WITNESS_METRICS.stageCount,
    witnessCombatStageCount: FIELDWORK_METRICS.combatStageCount,
    finiteRewardCount: FINITE_REWARD_COUNT,
    fieldworkNodeCount: FIELDWORK_METRICS.nodeCount,
    minimumExactMovementSteps: FIELDWORK_METRICS.minimumExactMovementSteps,
    requiredTransitionCount: REQUIRED_TRANSITION_COUNT,
    requiredTraceEventCount: REQUIRED_TRACE_EVENT_COUNT,
  };
  for (const [key, expected] of Object.entries(FINITE_CONTENT_RUN_EXPECTATIONS)) {
    if (actual[key] !== expected) {
      throw new Error(`Finite-content audit expected ${key}=${expected}, found ${actual[key]}.`);
    }
  }
  const fieldworkValidation = validateWitnessStageFieldwork(WITNESS_STAGE_FIELDWORK);
  if (!fieldworkValidation.ok) {
    throw new Error(`Finite-content fieldwork audit failed: ${fieldworkValidation.errors.join(' ')}`);
  }
}

function validateBounds(options) {
  const bounds = {
    maxTransitions: options.maxTransitions ?? 2_000,
    maxTraceEvents: options.maxTraceEvents ?? 2_000,
  };
  for (const [name, value] of Object.entries(bounds)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`${name} must be a positive safe integer.`);
    }
  }
  if (bounds.maxTransitions < REQUIRED_TRANSITION_COUNT) {
    throw new RangeError(`maxTransitions must allow the ${REQUIRED_TRANSITION_COUNT} required finite transitions.`);
  }
  if (bounds.maxTraceEvents < REQUIRED_TRACE_EVENT_COUNT) {
    throw new RangeError(`maxTraceEvents must allow the ${REQUIRED_TRACE_EVENT_COUNT} required finite trace events.`);
  }
  return Object.freeze(bounds);
}

/**
 * Complete every finite sidequest and witness chronicle exactly once.
 *
 * The returned fieldwork figures are catalog-audit quantities, not a claim
 * that this DOM-free harness spent time walking them. Both playtime ledgers
 * remain at zero and durationProven is always false.
 */
export function runFiniteContentCompletion(options = {}) {
  validateShippedQuantities();
  const bounds = validateBounds(options);
  const runId = options.runId ?? DEFAULT_FINITE_CONTENT_RUN_ID;
  if (typeof runId !== 'string' || !runId.trim()) {
    throw new TypeError('runId must be a non-empty string.');
  }

  const canonical = runCanonicalCompletion({ runId });
  if (!canonical.ok || !canonical.fullyIntegrated || !canonical.proof.valid
    || !canonical.proof.campaignComplete || !canonical.proof.firstClearsComplete) {
    throw new Error('Finite-content audit requires a fully integrated canonical completion seed.');
  }
  if (canonical.summary.receiptPlaytimeMs !== 0
    || canonical.summary.fieldPlaytimeMs !== 0
    || canonical.proof.totalMs !== 0
    || canonical.proof.durationProven !== false) {
    throw new Error('Canonical audit seed unexpectedly contains duration evidence.');
  }

  const canonicalAdvancementState = canonical.states.advancement;
  let advancementState = canonicalAdvancementState;
  let loadoutState = canonical.states.loadout;
  let questState = createQuestState();
  let witnessState = createWitnessChronicleState();
  let transitionCount = 0;
  let replayRefusalCount = 0;
  let replayAttemptCount = 0;
  let witnessChoiceCount = 0;
  let witnessCombatEvidenceCount = 0;
  let atomicRewardSettlementCount = 0;
  const trace = [];
  const rewardTotals = {
    authoredXpPerMember: 0,
    actualXpAwarded: 0,
    currency: 0,
    advancementItems: {},
    loadoutItems: {},
    authoredKeyItems: 0,
    addedKeyItems: 0,
    alreadyOwnedKeyItems: 0,
  };

  const emit = (event) => {
    if (trace.length >= bounds.maxTraceEvents) {
      throw new Error(`Finite-content trace exceeded ${bounds.maxTraceEvents} events.`);
    }
    trace.push(deepFreeze({ sequence: trace.length + 1, ...event }));
  };

  const reserveTransitions = (count, label) => {
    if (transitionCount + count > bounds.maxTransitions) {
      throw new Error(`${label} would exceed the ${bounds.maxTransitions}-transition bound.`);
    }
  };

  const executeTransition = (factory, label) => {
    reserveTransitions(1, label);
    const result = factory();
    if (!result?.ok) throw new Error(`${label}: ${detailFor(result)}`);
    transitionCount += 1;
    return result;
  };

  const settleRewardAtomically = ({
    sourceType,
    sourceId,
    reward,
    complete,
    assignCompletionState,
  }) => {
    reserveTransitions(3, `settle ${sourceType} ${sourceId}`);
    const completed = complete();
    if (!completed?.ok) throw new Error(`complete ${sourceType} ${sourceId}: ${detailFor(completed)}`);
    if (completed.reward !== reward) {
      throw new Error(`${sourceType} ${sourceId} returned a non-canonical reward object.`);
    }

    const advancementGrant = grantRewardBundle(advancementState, reward);
    if (!advancementGrant.ok) {
      throw new Error(`grant ${sourceType} ${sourceId} advancement reward: ${detailFor(advancementGrant)}`);
    }
    const loadoutGrant = grantInventory(loadoutState, {
      currency: reward.currency,
      items: reward.items,
    });
    if (!loadoutGrant.ok) {
      throw new Error(`grant ${sourceType} ${sourceId} loadout reward: ${detailFor(loadoutGrant)}`);
    }
    if (loadoutGrant.receipt.unknown.length) {
      throw new Error(`${sourceType} ${sourceId} contains uncatalogued loadout items: ${loadoutGrant.receipt.unknown.join(', ')}.`);
    }

    // The APIs are immutable. Assign all three successful results together so
    // no authority can observe a partially settled completion in this witness.
    assignCompletionState(completed.state);
    advancementState = advancementGrant.state;
    loadoutState = loadoutGrant.state;
    transitionCount += 3;
    atomicRewardSettlementCount += 1;

    rewardTotals.authoredXpPerMember += reward.xpPerMember;
    rewardTotals.actualXpAwarded += advancementGrant.receipt.xpAwards.reduce(
      (sum, award) => sum + award.awarded,
      0,
    );
    rewardTotals.currency += reward.currency;
    rewardTotals.authoredKeyItems += reward.keyItems.length;
    rewardTotals.addedKeyItems += advancementGrant.receipt.keyItems.added.length;
    rewardTotals.alreadyOwnedKeyItems += advancementGrant.receipt.keyItems.alreadyOwned.length;
    for (const item of advancementGrant.receipt.items) {
      increment(rewardTotals.advancementItems, item.name, item.quantity);
    }
    for (const item of loadoutGrant.receipt.items) {
      increment(rewardTotals.loadoutItems, item.id, item.quantity);
    }

    emit({
      type: 'reward-settled-atomically',
      sourceType,
      sourceId,
      reward,
      advancementReceipt: advancementGrant.receipt,
      loadoutReceipt: loadoutGrant.receipt,
    });
    return completed;
  };

  emit({
    type: 'canonical-completion-seed',
    runId,
    canonicalSignature: canonical.signature,
    beatCount: canonical.summary.beatCount,
    firstClearCount: canonical.summary.firstClearCount,
    recordedPlaytimeMs: 0,
    durationProven: false,
  });

  for (const [questIndex, quest] of SIDE_QUESTS.entries()) {
    const context = { campaignState: canonical.states.campaign, advancementState };
    const availability = getQuestAvailability(questState, quest.id, context);
    if (!availability.available) {
      throw new Error(`Finite sidequest ${quest.id} is unavailable in canonical order: ${availability.reason}`);
    }
    const accepted = executeTransition(
      () => acceptQuest(questState, quest.id, context),
      `accept sidequest ${quest.id}`,
    );
    questState = accepted.state;
    emit({
      type: 'sidequest-accepted',
      questId: quest.id,
      canonicalOrder: questIndex + 1,
      prerequisiteQuestIds: quest.prerequisites?.questIds ?? [],
    });

    for (const [objectiveIndex, objective] of quest.objectives.entries()) {
      const id = objectiveId(objective, objectiveIndex);
      const advanced = executeTransition(
        () => advanceQuestObjective(questState, quest.id, id),
        `advance ${quest.id}/${id}`,
      );
      questState = advanced.state;
      emit({
        type: 'sidequest-objective-complete',
        questId: quest.id,
        objectiveId: id,
        objectiveNumber: objectiveIndex + 1,
        objectiveType: objective.type,
        mapId: objective.mapId,
        targetId: objective.targetId,
      });
    }

    const completed = settleRewardAtomically({
      sourceType: 'sidequest',
      sourceId: quest.id,
      reward: quest.rewards.firstClear,
      complete: () => completeQuest(questState, quest.id),
      assignCompletionState: (state) => { questState = state; },
    });
    emit({
      type: 'sidequest-complete',
      questId: quest.id,
      status: completed.progress.status,
      completions: completed.progress.completions,
    });

    const replay = acceptQuest(questState, quest.id, { campaignState: canonical.states.campaign, advancementState });
    const duplicateCompletion = completeQuest(questState, quest.id);
    if (replay.ok || replay.state !== questState || duplicateCompletion.ok || duplicateCompletion.state !== questState) {
      throw new Error(`Finite sidequest ${quest.id} accepted a replay or duplicate completion.`);
    }
    replayRefusalCount += 1;
    replayAttemptCount += 2;
    emit({
      type: 'finite-replay-refused',
      sourceType: 'sidequest',
      sourceId: quest.id,
      acceptanceReason: replay.reason,
      duplicateCompletionReason: duplicateCompletion.reason,
    });
  }

  for (const [chronicleIndex, chronicle] of WITNESS_CHRONICLES.entries()) {
    const context = { campaignState: canonical.states.campaign };
    const availability = getWitnessChronicleAvailability(witnessState, chronicle.id, context);
    if (!availability.available) {
      throw new Error(`Witness chronicle ${chronicle.id} is unavailable in canonical order: ${availability.reason}`);
    }
    const accepted = executeTransition(
      () => acceptWitnessChronicle(witnessState, chronicle.id, context),
      `accept witness chronicle ${chronicle.id}`,
    );
    witnessState = accepted.state;
    emit({
      type: 'witness-chronicle-accepted',
      chronicleId: chronicle.id,
      canonicalOrder: chronicleIndex + 1,
      opensAfterBeatId: chronicle.opensAfterBeatId,
    });

    for (const [stageIndex, stage] of chronicle.stages.entries()) {
      for (const [lineIndex, line] of stage.dialogue.entries()) {
        const acknowledged = executeTransition(
          () => acknowledgeWitnessChronicleLine(witnessState, chronicle.id),
          `acknowledge ${chronicle.id}/${stage.id} line ${lineIndex + 1}`,
        );
        if (acknowledged.line !== line) {
          throw new Error(`${chronicle.id}/${stage.id} acknowledged a non-canonical dialogue line.`);
        }
        witnessState = acknowledged.state;
        emit({
          type: 'witness-line-acknowledged',
          chronicleId: chronicle.id,
          stageId: stage.id,
          lineNumber: lineIndex + 1,
          speaker: line.speaker,
          line: line.line,
        });
      }

      const evidence = {};
      let canonicalWinCount = null;
      if (stage.encounterId) {
        canonicalWinCount = getEncounterWinCount(canonicalAdvancementState, stage.encounterId);
        if (canonicalWinCount < 1) {
          throw new Error(`${chronicle.id}/${stage.id} lacks canonical victory evidence for ${stage.encounterId}.`);
        }
        evidence.encounterId = stage.encounterId;
        evidence.victory = true;
        witnessCombatEvidenceCount += 1;
      }
      let selectedChoiceId = null;
      if (chronicle.choice.stageId === stage.id) {
        selectedChoiceId = chronicle.choice.options[0]?.id ?? null;
        if (!selectedChoiceId) throw new Error(`${chronicle.id} has no first authored choice option.`);
        evidence.choiceId = selectedChoiceId;
        witnessChoiceCount += 1;
      }
      const advanced = executeTransition(
        () => advanceWitnessChronicle(witnessState, chronicle.id, stage.id, evidence),
        `advance witness stage ${chronicle.id}/${stage.id}`,
      );
      witnessState = advanced.state;
      emit({
        type: 'witness-stage-complete',
        chronicleId: chronicle.id,
        stageId: stage.id,
        stageNumber: stageIndex + 1,
        choiceId: selectedChoiceId,
        combatEvidence: stage.encounterId
          ? { encounterId: stage.encounterId, victory: true, canonicalWinCount }
          : null,
      });
    }

    const completed = settleRewardAtomically({
      sourceType: 'witness-chronicle',
      sourceId: chronicle.id,
      reward: chronicle.reward,
      complete: () => completeWitnessChronicle(witnessState, chronicle.id),
      assignCompletionState: (state) => { witnessState = state; },
    });
    emit({
      type: 'witness-chronicle-complete',
      chronicleId: chronicle.id,
      status: completed.progress.status,
      choiceId: completed.progress.choiceId,
      consequence: completed.consequence,
    });

    const replay = acceptWitnessChronicle(witnessState, chronicle.id, context);
    const duplicateCompletion = completeWitnessChronicle(witnessState, chronicle.id);
    if (replay.ok || replay.state !== witnessState || duplicateCompletion.ok || duplicateCompletion.state !== witnessState) {
      throw new Error(`Witness chronicle ${chronicle.id} accepted a replay or duplicate completion.`);
    }
    replayRefusalCount += 1;
    replayAttemptCount += 2;
    emit({
      type: 'finite-replay-refused',
      sourceType: 'witness-chronicle',
      sourceId: chronicle.id,
      acceptanceReason: replay.reason,
      duplicateCompletionReason: duplicateCompletion.reason,
    });
  }

  const fieldworkCatalogSignature = signatureFor(WITNESS_STAGE_FIELDWORK);
  emit({
    type: 'fieldwork-catalog-audited',
    catalogSignature: fieldworkCatalogSignature,
    stageCount: FIELDWORK_METRICS.stageCount,
    nodeCount: FIELDWORK_METRICS.nodeCount,
    minimumExactMovementSteps: FIELDWORK_METRICS.minimumExactMovementSteps,
    traversalPerformedByHarness: false,
    exactMovementStepsRecorded: 0,
  });

  const completedSideQuestIds = questState.records
    .filter((record) => record.status === QUEST_STATUSES.COMPLETED)
    .map((record) => record.id);
  const completedChronicleIds = witnessState.records
    .filter((record) => record.status === WITNESS_CHRONICLE_STATUSES.COMPLETED)
    .map((record) => record.id);
  const repeatContractIds = new Set(REPEATABLE_CONTRACTS.map((contract) => contract.id));
  const repeatContractCompletionCount = questState.records.filter((record) => (
    repeatContractIds.has(record.id) && record.status === QUEST_STATUSES.COMPLETED
  )).length;

  if (completedSideQuestIds.length !== SIDE_QUESTS.length
    || completedChronicleIds.length !== WITNESS_CHRONICLES.length
    || repeatContractCompletionCount !== 0
    || transitionCount !== REQUIRED_TRANSITION_COUNT
    || trace.length !== REQUIRED_TRACE_EVENT_COUNT
    || atomicRewardSettlementCount !== FINITE_REWARD_COUNT
    || replayRefusalCount !== FINITE_REWARD_COUNT
    || witnessChoiceCount !== WITNESS_CHRONICLES.length
    || witnessCombatEvidenceCount !== FIELDWORK_METRICS.combatStageCount) {
    throw new Error('Finite-content completion totals diverged from the shipped audit contract.');
  }
  if (canonical.states.receipt.playtime.totalMs !== 0
    || canonical.states.field.totalPlaytimeMs !== 0
    || canonical.proof.durationProven !== false) {
    throw new Error('Finite-content harness must leave all duration evidence at zero.');
  }

  const summary = deepFreeze({
    canonicalBeatCount: canonical.summary.beatCount,
    canonicalFirstClearCount: canonical.summary.firstClearCount,
    finiteSideQuestCount: completedSideQuestIds.length,
    sideQuestObjectiveCount: SIDE_QUEST_OBJECTIVE_COUNT,
    witnessChronicleCount: completedChronicleIds.length,
    witnessDialogueLineAcknowledgements: WITNESS_METRICS.lineCount,
    witnessStageCount: WITNESS_METRICS.stageCount,
    witnessChoiceCount,
    witnessCombatEvidenceCount,
    finiteRewardCount: FINITE_REWARD_COUNT,
    atomicRewardSettlementCount,
    advancementRewardTransactionCount: FINITE_REWARD_COUNT,
    loadoutRewardTransactionCount: FINITE_REWARD_COUNT,
    optionalTransitionCount: transitionCount,
    replayRefusalCount,
    replayAttemptCount,
    repeatContractCatalogCount: REPEATABLE_CONTRACTS.length,
    repeatContractCompletionCount,
    fieldworkStageCount: FIELDWORK_METRICS.stageCount,
    fieldworkNodeCount: FIELDWORK_METRICS.nodeCount,
    auditedMinimumExactMovementSteps: FIELDWORK_METRICS.minimumExactMovementSteps,
    exactMovementStepsRecorded: 0,
    recordedPlaytimeMs: 0,
    durationClaimed: false,
    durationProven: false,
  });
  const rewardAudit = deepFreeze({
    settlementCount: atomicRewardSettlementCount,
    authoredXpPerMember: rewardTotals.authoredXpPerMember,
    actualXpAwarded: rewardTotals.actualXpAwarded,
    currency: rewardTotals.currency,
    advancementItems: sortedNumberMap(rewardTotals.advancementItems),
    loadoutItems: sortedNumberMap(rewardTotals.loadoutItems),
    authoredKeyItems: rewardTotals.authoredKeyItems,
    addedKeyItems: rewardTotals.addedKeyItems,
    alreadyOwnedKeyItems: rewardTotals.alreadyOwnedKeyItems,
    advancementCurrencyBefore: canonicalAdvancementState.inventory.currency,
    advancementCurrencyAfter: advancementState.inventory.currency,
    loadoutCurrencyBefore: canonical.states.loadout.currency,
    loadoutCurrencyAfter: loadoutState.currency,
    advancementRevisionBefore: canonicalAdvancementState.revision,
    advancementRevisionAfter: advancementState.revision,
    loadoutRevisionBefore: canonical.states.loadout.revision,
    loadoutRevisionAfter: loadoutState.revision,
    atomicAcrossCompletionAndBothRewardLedgers: true,
  });
  if (rewardAudit.advancementCurrencyAfter - rewardAudit.advancementCurrencyBefore !== rewardAudit.currency
    || rewardAudit.loadoutCurrencyAfter - rewardAudit.loadoutCurrencyBefore !== rewardAudit.currency
    || rewardAudit.advancementRevisionAfter - rewardAudit.advancementRevisionBefore !== FINITE_REWARD_COUNT
    || rewardAudit.loadoutRevisionAfter - rewardAudit.loadoutRevisionBefore !== FINITE_REWARD_COUNT) {
    throw new Error('Finite-content reward ledgers did not settle every authored currency grant exactly once.');
  }

  const durationEvidence = deepFreeze({
    recordedPlaytimeMs: 0,
    durationClaimed: false,
    durationProven: false,
    statement: 'This completion witness proves finite state transitions and audited traversal quantities only; it is not timed-play evidence.',
  });
  const completionProof = deepFreeze({
    valid: true,
    campaignComplete: canonical.proof.campaignComplete,
    canonicalFirstClearsComplete: canonical.proof.firstClearsComplete,
    finiteSideQuestsComplete: completedSideQuestIds.length === SIDE_QUESTS.length,
    witnessChroniclesComplete: completedChronicleIds.length === WITNESS_CHRONICLES.length,
    allFiniteRewardsSettledOnce: atomicRewardSettlementCount === FINITE_REWARD_COUNT,
    repeatContractsCounted: false,
    durationProven: false,
  });
  const frozenTrace = deepFreeze([...trace]);

  return deepFreeze({
    ok: true,
    version: FINITE_CONTENT_RUN_VERSION,
    runId,
    signature: signatureFor(frozenTrace),
    summary,
    completionProof,
    durationEvidence,
    rewardAudit,
    fieldworkAudit: {
      catalogSignature: fieldworkCatalogSignature,
      stageCount: FIELDWORK_METRICS.stageCount,
      nodeCount: FIELDWORK_METRICS.nodeCount,
      minimumExactMovementSteps: FIELDWORK_METRICS.minimumExactMovementSteps,
      traversalPerformedByHarness: false,
      exactMovementStepsRecorded: 0,
    },
    canonical: {
      signature: canonical.signature,
      summary: canonical.summary,
      proof: canonical.proof,
    },
    trace: frozenTrace,
    states: {
      campaign: canonical.states.campaign,
      advancement: advancementState,
      loadout: loadoutState,
      field: canonical.states.field,
      narrative: canonical.states.narrative,
      receipt: canonical.states.receipt,
      quests: questState,
      witnessChronicles: witnessState,
    },
  });
}
