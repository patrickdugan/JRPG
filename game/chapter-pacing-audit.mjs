/**
 * Derive chapter pacing checkpoints from shipped, player-visible quantities.
 *
 * This is a build/test audit, not browser runtime code. Its targets are model
 * diagnostics only; observed clean-run receipt time remains the sole duration
 * proof accepted by the game.
 */

import { runCanonicalCompletion } from './canonical-run.mjs';
import { CAMPAIGN } from './content/campaign.mjs';
import { FULL_DIALOGUE_SCRIPT } from './content/full-dialogue.mjs';
import { CAMP_CONVERSATIONS } from './content/camp-conversations.mjs';
import { PARTY_COUNCILS } from './content/party-councils.mjs';
import { ARCHIVE_RECORDS } from './content/archive-records.mjs';
import { SIDE_QUESTS } from './content/sidequests.mjs';
import { WITNESS_CHRONICLES } from './content/witness-chronicles.mjs';
import { runWitnessFieldworkTraversal } from './witness-fieldwork-run.mjs';
import { runRequiredRouteCompletion } from './required-route-run.mjs';
import {
  createDurationAudit,
  DEFAULT_DURATION_ASSUMPTIONS,
  DURATION_WITNESS_METRIC_KEYS,
} from './duration-audit.mjs';

export const CHAPTER_PACING_AUDIT_VERSION = 1;

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const sum = (values) => values.reduce((total, value) => total + value, 0);

function wordCount(value) {
  if (typeof value !== 'string') return 0;
  return value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function whitespaceWordCount(value) {
  return typeof value === 'string' ? value.trim().split(/\s+/u).filter(Boolean).length : 0;
}

function emptyQuantities() {
  return Object.fromEntries(DURATION_WITNESS_METRIC_KEYS.map((key) => [key, 0]));
}

function add(target, additions) {
  for (const key of DURATION_WITNESS_METRIC_KEYS) target[key] += additions[key] ?? 0;
}

function chapterLookup() {
  const byBeatId = new Map();
  for (const chapter of CAMPAIGN.chapters) {
    for (const beat of chapter.beats) byBeatId.set(beat.id, chapter.id);
  }
  return byBeatId;
}

function chapterForBeat(byBeatId, beatId) {
  const chapterId = byBeatId.get(beatId);
  if (!chapterId) throw new Error(`Pacing audit cannot assign beat ${beatId} to a chapter.`);
  return chapterId;
}

function addCanonicalQuantities(byChapter, byBeatId) {
  for (const scene of FULL_DIALOGUE_SCRIPT.scenes) {
    const quantities = byChapter[chapterForBeat(byBeatId, scene.beatId)];
    quantities.dialogueWords += sum(scene.dialogue.map(({ line }) => wordCount(line)));
    quantities.dialogueLines += scene.dialogue.length;
  }

  const canonical = runCanonicalCompletion();
  if (!canonical.fullyIntegrated || canonical.summary.receiptPlaytimeMs !== 0) {
    throw new Error('Canonical pacing evidence must be complete and must not claim elapsed time.');
  }
  for (const event of canonical.trace) {
    const quantities = byChapter[chapterForBeat(byBeatId, event.beatId)];
    if (event.type === 'story-choice') quantities.choices += 1;
    if (event.type === 'field-move') quantities.fieldMoves += 1;
    if (event.type === 'field-interaction' || event.type === 'scene-operation-node') quantities.interactions += 1;
    if (event.type === 'field-exit') quantities.exits += 1;
    if (event.type === 'battle-first-clear') {
      quantities.playerCommands += event.playerCommands;
      quantities.enemyActivations += event.enemyActivations;
      quantities.finiteEncounterCount += 1;
      if (event.rest) quantities.campRests += 1;
    }
  }
  return canonical;
}

function addSideQuestQuantities(byChapter) {
  for (const quest of SIDE_QUESTS) {
    const quantities = byChapter[quest.chapterId];
    quantities.dialogueWords += wordCount(quest.title)
      + sum(quest.objectives.map(({ instruction }) => wordCount(instruction)));
    quantities.finiteQuestCount += 1;
    quantities.finiteQuestObjectiveCount += quest.objectives.length;
  }
}

function addWitnessQuantities(byChapter) {
  const traversal = runWitnessFieldworkTraversal();
  if (!traversal.ok || traversal.summary.recordedPlaytimeMs !== 0) {
    throw new Error('Witness pacing evidence must be complete and must not claim elapsed time.');
  }
  const byChronicleId = new Map(WITNESS_CHRONICLES.map((chronicle) => [chronicle.id, chronicle]));
  for (const chronicle of WITNESS_CHRONICLES) {
    const quantities = byChapter[chronicle.chapterId];
    const lines = chronicle.stages.flatMap((stage) => stage.dialogue);
    quantities.dialogueWords += sum(lines.map(({ line }) => whitespaceWordCount(line)));
    quantities.dialogueLines += lines.length;
    quantities.choices += 1;
    quantities.interactions += lines.length + chronicle.stages.length;
    quantities.finiteQuestCount += 1;
  }
  for (const stage of traversal.stages) {
    const chronicle = byChronicleId.get(stage.chronicleId);
    if (!chronicle) throw new Error(`Unknown witness chronicle ${stage.chronicleId}.`);
    byChapter[chronicle.chapterId].fieldMoves += stage.exactMovementSteps;
  }
  return traversal;
}

function selectedConversationMetrics(entry) {
  const selectedOption = entry.choice.options[0];
  const visibleText = [
    entry.title,
    entry.theme,
    entry.choice.prompt,
    ...entry.dialogue.map(({ line }) => line),
    ...entry.choice.options.map(({ label }) => label),
    ...selectedOption.response.map(({ line }) => line),
    selectedOption.consequence.summary,
  ];
  return {
    dialogueWords: sum(visibleText.map(wordCount)),
    dialogueLines: entry.dialogue.length + selectedOption.response.length,
    choices: 1,
    interactions: 1,
  };
}

function addCampAndArchiveQuantities(byChapter, byBeatId) {
  for (const conversation of CAMP_CONVERSATIONS.conversations) {
    add(byChapter[chapterForBeat(byBeatId, conversation.unlockAfterBeatId)], selectedConversationMetrics(conversation));
  }
  for (const council of PARTY_COUNCILS.councils) {
    add(byChapter[council.chapterId], selectedConversationMetrics(council));
  }
  for (const record of ARCHIVE_RECORDS.records) {
    const visibleText = [record.title, record.recordType, record.custodian, record.accessNote, ...record.paragraphs];
    add(byChapter[record.chapterId], {
      dialogueWords: sum(visibleText.map(wordCount)),
      dialogueLines: record.paragraphs.length,
      interactions: 1,
    });
  }
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
  return { narrative, exploration, combat, camp, finiteQuests };
}

function allocateWholeMilliseconds(rows, aggregateTargetMs) {
  const floors = rows.map((row) => Math.floor(row.rawTargetMs));
  let remaining = aggregateTargetMs - sum(floors);
  const ranked = rows.map((row, index) => ({ index, fraction: row.rawTargetMs - floors[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);
  for (let index = 0; index < remaining; index += 1) floors[ranked[index].index] += 1;
  return floors;
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

/** Derive the reference intended-route checkpoint catalogue and reconciliation evidence. */
export function createChapterPacingAudit() {
  const byBeatId = chapterLookup();
  const byChapter = Object.fromEntries(CAMPAIGN.chapters.map((chapter) => [chapter.id, emptyQuantities()]));
  const canonical = addCanonicalQuantities(byChapter, byBeatId);
  addSideQuestQuantities(byChapter);
  const witnessTraversal = addWitnessQuantities(byChapter);
  addCampAndArchiveQuantities(byChapter, byBeatId);

  const requiredRoute = runRequiredRouteCompletion();
  if (!requiredRoute.completionProof.valid || requiredRoute.repeatScheduleAudit.elapsedTimeRecordedMs !== 0) {
    throw new Error('Required-route pacing evidence must be valid and must not claim elapsed time.');
  }
  const repeatPresentationMs = Object.fromEntries(CAMPAIGN.chapters.map((chapter) => [chapter.id, 0]));
  for (const schedule of requiredRoute.repeatScheduleAudit.schedules) {
    repeatPresentationMs[chapterForBeat(byBeatId, schedule.beatId)] += schedule.scheduledMsBySpeed[1];
  }

  const assumptions = DEFAULT_DURATION_ASSUMPTIONS.reference;
  const rawRows = CAMPAIGN.chapters.map((chapter) => {
    const quantities = byChapter[chapter.id];
    const seconds = estimateSeconds(quantities, assumptions);
    const requiredRepeatPresentationMs = repeatPresentationMs[chapter.id];
    return {
      chapterId: chapter.id,
      number: chapter.number,
      title: chapter.title,
      quantities,
      breakdownSeconds: seconds,
      requiredRepeatPresentationMs,
      rawTargetMs: (sum(Object.values(seconds)) * 1_000) + requiredRepeatPresentationMs,
    };
  });

  const durationAudit = createDurationAudit();
  const aggregateQuantities = Object.fromEntries(DURATION_WITNESS_METRIC_KEYS.map((key) => [
    key,
    sum(rawRows.map((row) => row.quantities[key])),
  ]));
  const expected = durationAudit.estimates.reference.allFiniteContent;
  for (const key of DURATION_WITNESS_METRIC_KEYS) {
    if (aggregateQuantities[key] !== expected.quantities[key]) {
      throw new Error(`Chapter pacing ${key} does not reconcile: ${aggregateQuantities[key]} != ${expected.quantities[key]}.`);
    }
  }
  const aggregateRawMs = sum(rawRows.map((row) => row.rawTargetMs));
  const expectedRawMs = expected.estimatedSeconds * 1_000;
  if (Math.abs(aggregateRawMs - expectedRawMs) > 0.001) {
    throw new Error(`Chapter pacing duration does not reconcile: ${aggregateRawMs} != ${expectedRawMs}.`);
  }
  const aggregateTargetMs = Math.round(expectedRawMs);
  const targetMilliseconds = allocateWholeMilliseconds(rawRows, aggregateTargetMs);
  const chapterEvidence = rawRows.map((row, index) => ({
    chapterId: row.chapterId,
    number: row.number,
    title: row.title,
    targetMs: targetMilliseconds[index],
    targetMinutes: Number((targetMilliseconds[index] / 60_000).toFixed(3)),
    share: Number((targetMilliseconds[index] / aggregateTargetMs).toFixed(6)),
    quantities: row.quantities,
    breakdownMinutes: Object.fromEntries(Object.entries(row.breakdownSeconds)
      .map(([key, seconds]) => [key, Number((seconds / 60).toFixed(3))])),
    requiredRepeatPresentationMs: row.requiredRepeatPresentationMs,
  }));
  const checkpointBody = {
    schemaVersion: CHAPTER_PACING_AUDIT_VERSION,
    campaignId: CAMPAIGN.id,
    scenario: 'reference',
    scope: 'complete-215-activity-intended-route-at-1x',
    diagnosticOnly: true,
    observedPlaytimeProof: false,
    aggregateTargetMs,
    aggregateTargetMinutes: Number((aggregateTargetMs / 60_000).toFixed(3)),
    allocation: 'component-attributed shipped quantities; whole milliseconds reconciled by largest remainder',
    chapters: chapterEvidence.map((chapter) => ({
      chapterId: chapter.chapterId,
      number: chapter.number,
      title: chapter.title,
      targetMs: chapter.targetMs,
      targetMinutes: chapter.targetMinutes,
      share: chapter.share,
    })),
  };
  const checkpoints = deepFreeze({ ...checkpointBody, signature: signatureFor(checkpointBody) });
  return deepFreeze({
    checkpoints,
    reconciliation: {
      aggregateQuantities,
      durationAuditEstimatedSeconds: expected.estimatedSeconds,
      durationAuditEstimatedMinutes: expected.estimatedMinutes,
      requiredRepeatPresentationMs: sum(Object.values(repeatPresentationMs)),
      chapterTargetMs: sum(chapterEvidence.map((chapter) => chapter.targetMs)),
      chapterEvidence,
      canonicalSignature: canonical.signature,
      witnessFieldworkSignature: witnessTraversal.signature,
      requiredRouteSignature: requiredRoute.signature,
      authoredMinutesUsed: false,
      elapsedTimeClaimed: false,
    },
  });
}

export function serializeChapterPacingCheckpoints(checkpoints = createChapterPacingAudit().checkpoints) {
  return `${JSON.stringify(checkpoints, null, 2)}\n`;
}
