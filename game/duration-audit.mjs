/**
 * Deterministic content-volume and duration-estimate audit.
 *
 * Estimates in this module are arithmetic projections from explicit
 * assumptions. They are never playtime proof. Only a valid, clean-start,
 * completed run receipt accepted by run-receipt.mjs may prove duration.
 */

import {
  CAMPAIGN_PACING,
  createAdvancementState,
  getEncounterRewardPreview,
  getPartyMember,
  preparePartyForEncounter,
  recordEncounterWin,
} from './advancement.mjs';
import { runCanonicalCompletion } from './canonical-run.mjs';
import { runCampConversationCompletion } from './camp-conversation-run.mjs';
import { runPartyCouncilCompletion } from './party-council-run.mjs';
import { runArchiveRecordCompletion } from './archive-record-run.mjs';
import { PARTY_PROFILES } from './campaign-combat.mjs';
import { CAMPAIGN } from './content/campaign.mjs';
import {
  CAMP_CONVERSATION_METRICS,
  CAMP_CONVERSATION_PLAYABLE_METRICS,
} from './content/camp-conversations.mjs';
import { ARCHIVE_RECORD_METRICS } from './content/archive-records.mjs';
import {
  PARTY_COUNCIL_METRICS,
  PARTY_COUNCIL_PLAYABLE_METRICS,
} from './content/party-councils.mjs';
import { ENCOUNTERS } from './content/encounters.mjs';
import { FULL_DIALOGUE_SCRIPT } from './content/full-dialogue.mjs';
import { REPEATABLE_CONTRACTS, SIDE_QUESTS } from './content/sidequests.mjs';
import { getWitnessChronicleMetrics } from './content/witness-chronicles.mjs';
import { runFiniteContentCompletion } from './finite-content-run.mjs';
import {
  applyLoadoutToPartyProfile,
  createLoadoutState,
  grantInventory,
} from './loadout.mjs';
import { REPEAT_BATTLE_SPEEDS, runRepeatBattle } from './repeat-battle.mjs';
import {
  getRunProofReport,
  loadRunReceipt,
  validateRunReceiptPayload,
} from './run-receipt.mjs';
import { getWitnessStageFieldworkMetrics } from './witness-stage-fieldwork.mjs';

export const DURATION_AUDIT_VERSION = 6;
export const DURATION_TARGET_MINUTES = CAMPAIGN_PACING.targetMinutesAt1x;

const ASSUMPTION_KEYS = Object.freeze([
  'readingWordsPerMinute',
  'dialogueLineAdvanceSeconds',
  'choiceDecisionSeconds',
  'fieldMoveSeconds',
  'interactionSeconds',
  'exitTransitionSeconds',
  'playerCommandSeconds',
  'enemyActivationSeconds',
  'battleIntroAndSettlementSeconds',
  'campRestSeconds',
  'finiteQuestObjectiveSeconds',
  'finiteQuestAcceptAndTurnInSeconds',
]);

export const DURATION_WITNESS_METRIC_KEYS = Object.freeze([
  'dialogueWords',
  'dialogueLines',
  'choices',
  'fieldMoves',
  'interactions',
  'exits',
  'playerCommands',
  'enemyActivations',
  'campRests',
  'finiteEncounterCount',
  'finiteQuestCount',
  'finiteQuestObjectiveCount',
]);

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

/**
 * Low/reference/high are duration scenarios, not confidence intervals.
 * Every number is deliberately exposed so callers can replace the model.
 */
export const DEFAULT_DURATION_ASSUMPTIONS = deepFreeze({
  low: {
    readingWordsPerMinute: 260,
    dialogueLineAdvanceSeconds: 0.35,
    choiceDecisionSeconds: 2,
    fieldMoveSeconds: 0.18,
    interactionSeconds: 2,
    exitTransitionSeconds: 1.5,
    playerCommandSeconds: 1.5,
    enemyActivationSeconds: 1,
    battleIntroAndSettlementSeconds: 5,
    campRestSeconds: 4,
    finiteQuestObjectiveSeconds: 5,
    finiteQuestAcceptAndTurnInSeconds: 3,
  },
  reference: {
    readingWordsPerMinute: 180,
    dialogueLineAdvanceSeconds: 0.8,
    choiceDecisionSeconds: 6,
    fieldMoveSeconds: 0.35,
    interactionSeconds: 5,
    exitTransitionSeconds: 3,
    playerCommandSeconds: 4,
    enemyActivationSeconds: 2.5,
    battleIntroAndSettlementSeconds: 12,
    campRestSeconds: 10,
    finiteQuestObjectiveSeconds: 20,
    finiteQuestAcceptAndTurnInSeconds: 10,
  },
  high: {
    readingWordsPerMinute: 130,
    dialogueLineAdvanceSeconds: 1.5,
    choiceDecisionSeconds: 15,
    fieldMoveSeconds: 0.7,
    interactionSeconds: 12,
    exitTransitionSeconds: 6,
    playerCommandSeconds: 8,
    enemyActivationSeconds: 5,
    battleIntroAndSettlementSeconds: 30,
    campRestSeconds: 25,
    finiteQuestObjectiveSeconds: 60,
    finiteQuestAcceptAndTurnInSeconds: 30,
  },
});

function wordCount(value) {
  if (typeof value !== 'string') return 0;
  return value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function rounded(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function mergeAndValidateAssumptions(overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError('Duration assumptions must be an object keyed by low, reference, or high.');
  }
  const unknownScenarios = Object.keys(overrides).filter((key) => !Object.hasOwn(DEFAULT_DURATION_ASSUMPTIONS, key));
  if (unknownScenarios.length) throw new RangeError(`Unknown duration scenario: ${unknownScenarios.join(', ')}.`);

  const merged = {};
  for (const scenarioName of Object.keys(DEFAULT_DURATION_ASSUMPTIONS)) {
    const supplied = overrides[scenarioName] ?? {};
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) {
      throw new TypeError(`${scenarioName} assumptions must be an object.`);
    }
    const unknownKeys = Object.keys(supplied).filter((key) => !ASSUMPTION_KEYS.includes(key));
    if (unknownKeys.length) throw new RangeError(`Unknown ${scenarioName} assumption: ${unknownKeys.join(', ')}.`);
    const scenario = { ...DEFAULT_DURATION_ASSUMPTIONS[scenarioName], ...supplied };
    for (const key of ASSUMPTION_KEYS) {
      if (!Number.isFinite(scenario[key]) || scenario[key] < 0) {
        throw new RangeError(`${scenarioName}.${key} must be a finite non-negative number.`);
      }
    }
    if (scenario.readingWordsPerMinute <= 0) {
      throw new RangeError(`${scenarioName}.readingWordsPerMinute must be greater than zero.`);
    }
    merged[scenarioName] = scenario;
  }
  return deepFreeze(merged);
}

function normalizeWitnessMetrics(metrics) {
  if (metrics == null) {
    return deepFreeze({
      supplied: false,
      source: 'none',
      metrics: Object.fromEntries(DURATION_WITNESS_METRIC_KEYS.map((key) => [key, 0])),
    });
  }
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    throw new TypeError('witnessChronicleMetrics must be an object when supplied.');
  }
  const unknownKeys = Object.keys(metrics).filter((key) => key !== 'source' && !DURATION_WITNESS_METRIC_KEYS.includes(key));
  if (unknownKeys.length) throw new RangeError(`Unknown witness chronicle metric: ${unknownKeys.join(', ')}.`);
  const normalized = {};
  for (const key of DURATION_WITNESS_METRIC_KEYS) {
    const value = metrics[key] ?? 0;
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`witnessChronicleMetrics.${key} must be a non-negative safe integer.`);
    }
    normalized[key] = value;
  }
  if (metrics.source != null && (typeof metrics.source !== 'string' || !metrics.source.trim())) {
    throw new TypeError('witnessChronicleMetrics.source must be a non-empty string when supplied.');
  }
  return deepFreeze({
    supplied: true,
    source: metrics.source?.trim() ?? 'caller-supplied',
    metrics: normalized,
  });
}

function campaignContentMetrics(canonicalRun) {
  const beats = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats);
  const dialogue = FULL_DIALOGUE_SCRIPT.scenes.flatMap((scene) => scene.dialogue);
  const finiteQuestObjectiveCount = sum(SIDE_QUESTS.map((quest) => quest.objectives.length));
  const repeatableContractObjectiveCount = sum(REPEATABLE_CONTRACTS.map((quest) => quest.objectives.length));
  const finiteQuestTitleWords = sum(SIDE_QUESTS.map((quest) => wordCount(quest.title)));
  const finiteQuestInstructionWords = sum(SIDE_QUESTS.flatMap((quest) =>
    quest.objectives.map((objective) => wordCount(objective.instruction))));
  const finiteQuestSetupWords = sum(SIDE_QUESTS.map((quest) => wordCount(quest.setup)));
  const finiteQuestResolutionWords = sum(SIDE_QUESTS.map((quest) => wordCount(quest.completion?.resolution)));

  return deepFreeze({
    chapterCount: CAMPAIGN.chapters.length,
    beatCount: beats.length,
    dialogueLineCount: dialogue.length,
    dialogueWordCount: sum(dialogue.map((entry) => wordCount(entry.line))),
    authoredChoiceOptionCount: sum(beats.map((beat) => beat.choices?.length ?? 0)),
    canonicalChoiceCount: canonicalRun.summary.choiceCount,
    fieldMoveCount: canonicalRun.summary.fieldSteps,
    interactionCount: canonicalRun.summary.interactionCount,
    sceneOperationCount: canonicalRun.summary.sceneOperationCount,
    sceneOperationNodeCount: canonicalRun.summary.sceneOperationNodeCount,
    exitCount: canonicalRun.summary.exitCount,
    firstClearEncounterCount: canonicalRun.summary.firstClearCount,
    playerCommandCount: canonicalRun.summary.playerCommands,
    enemyActivationCount: canonicalRun.summary.enemyActivations,
    campRestCount: canonicalRun.summary.restCount,
    finiteQuestCount: SIDE_QUESTS.length,
    finiteQuestObjectiveCount,
    finiteQuestRuntimeTextWordCount: finiteQuestTitleWords + finiteQuestInstructionWords,
    finiteQuestTitleWordCount: finiteQuestTitleWords,
    finiteQuestInstructionWordCount: finiteQuestInstructionWords,
    finiteQuestAuthoredButNotRuntimeExposedWordCount: finiteQuestSetupWords + finiteQuestResolutionWords,
    repeatableContractCount: REPEATABLE_CONTRACTS.length,
    repeatableContractObjectiveCount,
    encounterCatalogCount: ENCOUNTERS.length,
  });
}

function shippedWitnessChronicleMetrics() {
  const content = getWitnessChronicleMetrics();
  const fieldwork = getWitnessStageFieldworkMetrics();
  return deepFreeze({
    source: 'shipped-witness-chronicle-runtime-v2',
    dialogueWords: content.dialogueWordCount,
    dialogueLines: content.lineCount,
    choices: content.chronicleCount,
    fieldMoves: fieldwork.minimumExactMovementSteps,
    interactions: content.lineCount + content.stageCount,
    exits: 0,
    playerCommands: 0,
    enemyActivations: 0,
    campRests: 0,
    finiteEncounterCount: 0,
    finiteQuestCount: content.chronicleCount,
    finiteQuestObjectiveCount: 0,
  });
}

function shippedCampConversationMetrics() {
  return deepFreeze({
    supplied: true,
    source: 'shipped-camp-conversation-runtime-v1',
    finite: true,
    repeatable: false,
    catalogueMetrics: CAMP_CONVERSATION_METRICS,
    playableMetrics: CAMP_CONVERSATION_PLAYABLE_METRICS,
    metrics: {
      dialogueWords: CAMP_CONVERSATION_PLAYABLE_METRICS.visibleWordCount,
      dialogueLines: CAMP_CONVERSATION_PLAYABLE_METRICS.dialogueLineCount,
      choices: CAMP_CONVERSATION_PLAYABLE_METRICS.choiceCount,
      fieldMoves: 0,
      interactions: CAMP_CONVERSATION_PLAYABLE_METRICS.conversationCount,
      exits: 0,
      playerCommands: 0,
      enemyActivations: 0,
      campRests: 0,
      finiteEncounterCount: 0,
      finiteQuestCount: 0,
      finiteQuestObjectiveCount: 0,
    },
  });
}

function shippedArchiveRecordMetrics() {
  return deepFreeze({
    supplied: true,
    source: 'shipped-public-archive-runtime-v1',
    finite: true,
    repeatable: false,
    catalogueMetrics: ARCHIVE_RECORD_METRICS,
    metrics: {
      dialogueWords: ARCHIVE_RECORD_METRICS.wordCount,
      dialogueLines: ARCHIVE_RECORD_METRICS.paragraphCount,
      choices: 0,
      fieldMoves: 0,
      interactions: ARCHIVE_RECORD_METRICS.recordCount,
      exits: 0,
      playerCommands: 0,
      enemyActivations: 0,
      campRests: 0,
      finiteEncounterCount: 0,
      finiteQuestCount: 0,
      finiteQuestObjectiveCount: 0,
    },
  });
}

function shippedPartyCouncilMetrics() {
  return deepFreeze({
    supplied: true,
    source: 'shipped-party-council-runtime-v1',
    finite: true,
    repeatable: false,
    catalogueMetrics: PARTY_COUNCIL_METRICS,
    playableMetrics: PARTY_COUNCIL_PLAYABLE_METRICS,
    metrics: {
      dialogueWords: PARTY_COUNCIL_PLAYABLE_METRICS.visibleWordCount,
      dialogueLines: PARTY_COUNCIL_PLAYABLE_METRICS.dialogueLineCount,
      choices: PARTY_COUNCIL_PLAYABLE_METRICS.choiceCount,
      fieldMoves: 0,
      interactions: PARTY_COUNCIL_PLAYABLE_METRICS.councilCount,
      exits: 0,
      playerCommands: 0,
      enemyActivations: 0,
      campRests: 0,
      finiteEncounterCount: 0,
      finiteQuestCount: 0,
      finiteQuestObjectiveCount: 0,
    },
  });
}

function canonicalRestedProfiles(encounter, advancementState, loadoutState) {
  return Object.fromEntries(encounter.party.roster.map((memberId) => {
    const base = PARTY_PROFILES[memberId];
    const member = getPartyMember(advancementState, memberId);
    const adapted = applyLoadoutToPartyProfile({
      ...base,
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

function repeatCircuitMetrics() {
  let advancementState = createAdvancementState();
  let loadoutState = createLoadoutState();
  const encounters = [];
  for (const encounter of ENCOUNTERS) {
    advancementState = preparePartyForEncounter(advancementState, encounter.id);
    const firstClearReward = getEncounterRewardPreview(encounter.id, 0);
    advancementState = recordEncounterWin(advancementState, encounter.id, { partyIds: encounter.party.roster });
    const granted = grantInventory(loadoutState, {
      currency: firstClearReward.currency,
      items: firstClearReward.items,
    });
    if (!granted.ok) throw new Error(`Duration audit could not stage repeat inventory for ${encounter.id}.`);
    loadoutState = granted.state;
    const run = runRepeatBattle({
      encounterId: encounter.id,
      priorWins: 1,
      partyProfiles: canonicalRestedProfiles(encounter, advancementState, loadoutState),
    });
    if (run.result !== 'victory') throw new Error(`Duration audit repeat circuit lost ${encounter.id}.`);
    encounters.push({
      encounterId: encounter.id,
      basePresentationMs: run.baseDurationMs,
      policyStepCount: run.steps,
      playerDecisionCount: run.decisions.length,
      enemyActivationCount: run.timeline.filter(({ type }) => type === 'enemyActivation').length,
    });
  }
  const basePresentationMs = sum(encounters.map(({ basePresentationMs }) => basePresentationMs));
  return deepFreeze({
    scheduleOnly: true,
    estimateOrProof: false,
    requiredRepeatBattleCountForCanonicalCompletion: 0,
    encounterCount: encounters.length,
    policyStepCount: sum(encounters.map(({ policyStepCount }) => policyStepCount)),
    playerDecisionCount: sum(encounters.map(({ playerDecisionCount }) => playerDecisionCount)),
    enemyActivationCount: sum(encounters.map(({ enemyActivationCount }) => enemyActivationCount)),
    basePresentationMs,
    fullCircuitBySpeed: Object.fromEntries(REPEAT_BATTLE_SPEEDS.map((speedMultiplier) => [speedMultiplier, {
      speedMultiplier,
      scheduledMs: basePresentationMs / speedMultiplier,
      scheduledMinutes: rounded(basePresentationMs / speedMultiplier / 60_000, 6),
    }])),
    encounters,
  });
}

function inspectReceipt(receipt) {
  if (receipt == null || receipt === '') {
    return deepFreeze({
      supplied: false,
      valid: false,
      durationProven: false,
      status: 'not-supplied',
      report: null,
      errors: [],
    });
  }
  const validation = typeof receipt === 'string'
    ? loadRunReceipt(receipt)
    : validateRunReceiptPayload(receipt);
  if (!validation.ok || !validation.state) {
    return deepFreeze({
      supplied: true,
      valid: false,
      durationProven: false,
      status: 'invalid',
      report: null,
      errors: [...(validation.errors ?? ['Run receipt is invalid.'])],
    });
  }
  const report = getRunProofReport(validation.state);
  return deepFreeze({
    supplied: true,
    valid: true,
    durationProven: report.durationProven === true,
    status: report.durationProven ? 'duration-proven' : 'valid-but-insufficient',
    report,
    errors: [],
  });
}

function quantitiesForEstimate(base, witness, campConversation, partyCouncil, archiveRecord, includeFiniteQuests) {
  const campMetrics = includeFiniteQuests ? campConversation.metrics : Object.fromEntries(
    DURATION_WITNESS_METRIC_KEYS.map((key) => [key, 0]),
  );
  const archiveMetrics = includeFiniteQuests ? archiveRecord.metrics : Object.fromEntries(
    DURATION_WITNESS_METRIC_KEYS.map((key) => [key, 0]),
  );
  const councilMetrics = includeFiniteQuests ? partyCouncil.metrics : Object.fromEntries(
    DURATION_WITNESS_METRIC_KEYS.map((key) => [key, 0]),
  );
  const additions = Object.fromEntries(DURATION_WITNESS_METRIC_KEYS.map((key) => [
    key,
    witness.metrics[key] + campMetrics[key] + councilMetrics[key] + archiveMetrics[key],
  ]));
  return deepFreeze({
    dialogueWords: base.dialogueWordCount
      + additions.dialogueWords
      + (includeFiniteQuests ? base.finiteQuestRuntimeTextWordCount : 0),
    dialogueLines: base.dialogueLineCount + additions.dialogueLines,
    choices: base.canonicalChoiceCount + additions.choices,
    fieldMoves: base.fieldMoveCount + additions.fieldMoves,
    interactions: base.interactionCount + additions.interactions,
    exits: base.exitCount + additions.exits,
    playerCommands: base.playerCommandCount + additions.playerCommands,
    enemyActivations: base.enemyActivationCount + additions.enemyActivations,
    campRests: base.campRestCount + additions.campRests,
    finiteEncounterCount: base.firstClearEncounterCount + additions.finiteEncounterCount,
    finiteQuestCount: (includeFiniteQuests ? base.finiteQuestCount : 0) + additions.finiteQuestCount,
    finiteQuestObjectiveCount: (includeFiniteQuests ? base.finiteQuestObjectiveCount : 0)
      + additions.finiteQuestObjectiveCount,
  });
}

function estimateSeconds(quantities, assumptions) {
  const narrative = (quantities.dialogueWords / assumptions.readingWordsPerMinute * 60)
    + (quantities.dialogueLines * assumptions.dialogueLineAdvanceSeconds)
    + (quantities.choices * assumptions.choiceDecisionSeconds);
  const exploration = (quantities.fieldMoves * assumptions.fieldMoveSeconds)
    + (quantities.interactions * assumptions.interactionSeconds)
    + (quantities.exits * assumptions.exitTransitionSeconds);
  const combat = (quantities.playerCommands * assumptions.playerCommandSeconds)
    + (quantities.enemyActivations * assumptions.enemyActivationSeconds)
    + (quantities.finiteEncounterCount * assumptions.battleIntroAndSettlementSeconds);
  const camp = quantities.campRests * assumptions.campRestSeconds;
  const finiteQuests = (quantities.finiteQuestObjectiveCount * assumptions.finiteQuestObjectiveSeconds)
    + (quantities.finiteQuestCount * assumptions.finiteQuestAcceptAndTurnInSeconds);
  return deepFreeze({
    narrative,
    exploration,
    combat,
    camp,
    finiteQuests,
    total: narrative + exploration + combat + camp + finiteQuests,
  });
}

function estimateScenario(name, assumptions, criticalQuantities, allFiniteQuantities) {
  const criticalSeconds = estimateSeconds(criticalQuantities, assumptions);
  const allFiniteSeconds = estimateSeconds(allFiniteQuantities, assumptions);
  const allFiniteMinutes = allFiniteSeconds.total / 60;
  return deepFreeze({
    scenario: name,
    assumptions,
    estimateIsProof: false,
    criticalPath: {
      quantities: criticalQuantities,
      breakdownMinutes: Object.fromEntries(Object.entries(criticalSeconds)
        .filter(([key]) => key !== 'total')
        .map(([key, seconds]) => [key, rounded(seconds / 60)])),
      estimatedSeconds: criticalSeconds.total,
      estimatedMinutes: rounded(criticalSeconds.total / 60),
    },
    allFiniteContent: {
      quantities: allFiniteQuantities,
      breakdownMinutes: Object.fromEntries(Object.entries(allFiniteSeconds)
        .filter(([key]) => key !== 'total')
        .map(([key, seconds]) => [key, rounded(seconds / 60)])),
      estimatedSeconds: allFiniteSeconds.total,
      estimatedMinutes: rounded(allFiniteMinutes),
      exactModelGapSecondsTo20Hours: Math.max(0, (DURATION_TARGET_MINUTES * 60) - allFiniteSeconds.total),
      modelGapMinutesTo20Hours: rounded(Math.max(0, DURATION_TARGET_MINUTES - allFiniteMinutes)),
      reaches20HoursUnderModel: allFiniteMinutes >= DURATION_TARGET_MINUTES,
    },
  });
}

let shippedEvidenceCache = null;

function getShippedEvidence() {
  if (shippedEvidenceCache) return shippedEvidenceCache;
  const canonicalRun = runCanonicalCompletion();
  const finiteContentRun = runFiniteContentCompletion();
  const campConversationRun = runCampConversationCompletion();
  const partyCouncilRun = runPartyCouncilCompletion();
  const archiveRecordRun = runArchiveRecordCompletion();
  if (finiteContentRun.canonical.signature !== canonicalRun.signature) {
    throw new Error('Finite-content evidence was not seeded from the current canonical campaign signature.');
  }
  if (campConversationRun.canonical.signature !== canonicalRun.signature) {
    throw new Error('Camp-conversation evidence was not seeded from the current canonical campaign signature.');
  }
  if (archiveRecordRun.canonical.signature !== canonicalRun.signature) {
    throw new Error('Archive-record evidence was not seeded from the current canonical campaign signature.');
  }
  if (partyCouncilRun.canonical.signature !== canonicalRun.signature) {
    throw new Error('Party-council evidence was not seeded from the current canonical campaign signature.');
  }
  shippedEvidenceCache = deepFreeze({
    canonicalEvidence: {
      signature: canonicalRun.signature,
      fullyIntegrated: canonicalRun.fullyIntegrated,
      summary: canonicalRun.summary,
      durationProven: canonicalRun.proof.durationProven,
    },
    finiteContentEvidence: {
      signature: finiteContentRun.signature,
      completionProof: finiteContentRun.completionProof,
      summary: finiteContentRun.summary,
      rewardAudit: finiteContentRun.rewardAudit,
      durationEvidence: finiteContentRun.durationEvidence,
    },
    campConversationEvidence: {
      signature: campConversationRun.signature,
      completionProof: campConversationRun.completionProof,
      summary: campConversationRun.summary,
      catalogueMetrics: campConversationRun.catalogueMetrics,
      durationEvidence: campConversationRun.durationEvidence,
    },
    partyCouncilEvidence: {
      signature: partyCouncilRun.signature,
      completionProof: partyCouncilRun.completionProof,
      summary: partyCouncilRun.summary,
      catalogueMetrics: partyCouncilRun.catalogueMetrics,
      durationEvidence: partyCouncilRun.durationEvidence,
    },
    archiveRecordEvidence: {
      signature: archiveRecordRun.signature,
      completionProof: archiveRecordRun.completionProof,
      summary: archiveRecordRun.summary,
      catalogueMetrics: archiveRecordRun.catalogueMetrics,
      durationEvidence: archiveRecordRun.durationEvidence,
    },
    content: campaignContentMetrics(canonicalRun),
    repeatBattle: repeatCircuitMetrics(),
  });
  return shippedEvidenceCache;
}

/**
 * Build a fresh audit from shipped content and optional caller-owned evidence.
 * `witnessChronicleMetrics` is deliberately data-only: a future chronicle can
 * supply its measured quantities without this module importing a file that
 * does not exist yet.
 */
export function createDurationAudit({
  assumptions: assumptionOverrides = {},
  witnessChronicleMetrics = shippedWitnessChronicleMetrics(),
  runReceipt = null,
} = {}) {
  const assumptions = mergeAndValidateAssumptions(assumptionOverrides);
  const witnessChronicle = normalizeWitnessMetrics(witnessChronicleMetrics);
  const campConversation = shippedCampConversationMetrics();
  const partyCouncil = shippedPartyCouncilMetrics();
  const archiveRecord = shippedArchiveRecordMetrics();
  const shipped = getShippedEvidence();
  const { content, repeatBattle } = shipped;
  const receipt = inspectReceipt(runReceipt);
  const criticalQuantities = quantitiesForEstimate(content, witnessChronicle, campConversation, partyCouncil, archiveRecord, false);
  const allFiniteQuantities = quantitiesForEstimate(content, witnessChronicle, campConversation, partyCouncil, archiveRecord, true);
  const estimates = Object.fromEntries(Object.entries(assumptions).map(([name, scenarioAssumptions]) => [
    name,
    estimateScenario(name, scenarioAssumptions, criticalQuantities, allFiniteQuantities),
  ]));

  return deepFreeze({
    schemaVersion: DURATION_AUDIT_VERSION,
    campaignId: CAMPAIGN.id,
    targetMinutes: DURATION_TARGET_MINUTES,
    targetHours: DURATION_TARGET_MINUTES / 60,
    estimateScope: 'active-player-minutes',
    status: receipt.durationProven
      ? 'duration-proven-by-valid-run-receipt'
      : (receipt.valid ? 'duration-unproven-valid-receipt' : 'duration-unproven'),
    durationProven: receipt.durationProven,
    estimateIsProof: false,
    canonicalEvidence: shipped.canonicalEvidence,
    finiteContentEvidence: shipped.finiteContentEvidence,
    campConversationEvidence: shipped.campConversationEvidence,
    partyCouncilEvidence: shipped.partyCouncilEvidence,
    archiveRecordEvidence: shipped.archiveRecordEvidence,
    content,
    authoredDurationDeclarations: {
      campaignChapterMinutes: sum(CAMPAIGN.chapters.map((chapter) => chapter.estimatedMinutes ?? 0)),
      finiteSideQuestMinutes: sum(SIDE_QUESTS.map((quest) => quest.estimatedMinutes ?? 0)),
      finiteWitnessChronicleMinutes: getWitnessChronicleMetrics().totalMinutes,
      firstRepeatableContractCircuitMinutes: sum(REPEATABLE_CONTRACTS.map((quest) => quest.estimatedMinutes ?? 0)),
      usedAsMeasuredEvidence: false,
      usedInQuantityEstimate: false,
    },
    witnessChronicle,
    campConversation,
    partyCouncil,
    archiveRecord,
    repeatBattle,
    estimates,
    estimateMethod: {
      narrative: '(words / readingWordsPerMinute * 60) + (lines * dialogueLineAdvanceSeconds) + (choices * choiceDecisionSeconds)',
      exploration: '(moves * fieldMoveSeconds) + (interactions * interactionSeconds) + (exits * exitTransitionSeconds)',
      combat: '(playerCommands * playerCommandSeconds) + (enemyActivations * enemyActivationSeconds) + (encounters * battleIntroAndSettlementSeconds)',
      camp: 'campRests * campRestSeconds',
      finiteQuests: '(objectives * finiteQuestObjectiveSeconds) + (quests * finiteQuestAcceptAndTurnInSeconds)',
      unit: 'seconds',
    },
    finiteContentGapTo20Hours: {
      basis: 'All canonical finite content, all finite side-quest objectives, supplied witness metrics, all finite camp conversations, all finite party councils, and all finite public archive readings; repeatable loops and authored minute declarations excluded.',
      arithmeticIsExactUnderEachAssumptionSet: true,
      isObservedPlaytime: false,
      lowSeconds: estimates.low.allFiniteContent.exactModelGapSecondsTo20Hours,
      referenceSeconds: estimates.reference.allFiniteContent.exactModelGapSecondsTo20Hours,
      highSeconds: estimates.high.allFiniteContent.exactModelGapSecondsTo20Hours,
      lowMinutes: estimates.low.allFiniteContent.modelGapMinutesTo20Hours,
      referenceMinutes: estimates.reference.allFiniteContent.modelGapMinutesTo20Hours,
      highMinutes: estimates.high.allFiniteContent.modelGapMinutesTo20Hours,
    },
    proofReceipt: receipt,
    limitations: [
      'Quantity estimates are not observed playtime and cannot prove campaign duration.',
      'Finite side-quest route movement is not measured by the canonical runner; objective handling is represented only by the explicit per-objective assumption.',
      'Mandatory scene-operation traversal is included in the canonical runner as one combined exact route with authored exits: 183 nodes across 60 beats, without adding the standalone 920-step placement audit on top.',
      'Witness-chronicle field movement uses the deterministic minimum spawn-to-final-node paths across all 67 fresh stage contexts; detours and authored activity-minute declarations remain excluded until observed.',
      'Camp-conversation words include the title, theme, prompt, both visible option labels, the chosen first response, and its visible consequence; the unseen alternative response is excluded.',
      'Party-council words include each title, theme, prompt, both visible option labels, every multi-character main line, the chosen first response, and its visible consequence; unseen alternative responses are excluded.',
      'Public-archive words include only the player-visible title, record type, custodian, access note, and acknowledged paragraphs; the records grant no rewards or authored minutes.',
      'Side-quest setup and resolution prose exists in data but is not exposed by the current campaign runtime, so those words are reported but excluded.',
      'The canonical completion requires no repeat battles; repeat timing is an optional presentation schedule and is excluded from finite content.',
      'Only proofReceipt.report.durationProven from a valid completed clean-start run can make durationProven true.',
    ],
  });
}
