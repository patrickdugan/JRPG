import { CAMPAIGN, getAllChapters } from './content/campaign.mjs';
import { mountAudioControls } from './audio-controls.mjs';
import { LEVELS, TERRAIN_TAGS, getLevel, getLevelForChapter } from './content/levels.mjs';
import { ENCOUNTERS, getEncounter, getEncounterForChapter } from './content/encounters.mjs';
import { ALL_OPTIONAL_QUESTS, getOptionalQuestsForChapter, getSideQuest } from './content/sidequests.mjs';
import {
  WITNESS_CHRONICLES,
  getWitnessChronicle,
  getWitnessChroniclesForChapter,
} from './content/witness-chronicles.mjs';
import { getSceneDirection } from './content/scene-direction.mjs';
import { getFullDialogue } from './content/full-dialogue.mjs';
import { getSceneOperation } from './content/scene-operations.mjs';
import { getCampConversation } from './content/camp-conversations.mjs';
import { getPartyCouncil } from './content/party-councils.mjs';
import { getArchiveRecord } from './content/archive-records.mjs';
import { createBrowserRunUuid } from './browser-runtime.mjs';
import { commitPersistenceTransaction, stateSaveStep } from './persistence-transaction.mjs';
import { getRequiredRouteActivity } from './required-route-contract.mjs';
import { deriveRequiredRouteProgress } from './required-route-progress.mjs';
import {
  createRecoveryCheckpoint,
  restoreRecoveryCheckpoint,
  serializeRecoveryCheckpoint,
  validateRecoveryCheckpoint,
} from './recovery-checkpoint.mjs';
import {
  createAdvancementState,
  createAdvancementStorageAdapter,
  grantRewardBundle,
  getAdvancementSummary,
  getEncounterWinCount,
  unlockPartyMembers,
} from './advancement.mjs';
import {
  appendChoice,
  completeCurrentBeat,
  createCampaignState,
  createLocalStorageAdapter,
  getCurrentBeat,
  getCurrentChapter,
  getSelectedChoiceIds,
  getUnlockedBeatIds,
  isBeatCompleted,
  isCampaignComplete,
  moveToBeat,
  resetCampaignState,
  selectChoice,
} from './progression.mjs';
import {
  advanceFieldTime,
  createFieldState as createPersistentFieldState,
  createFieldStorageAdapter,
  enterField,
  grantFieldFlags,
  getCurrentFieldContext,
  getFieldStatus,
  interactField as performFieldInteraction,
  moveFieldBy,
  resolveFieldEncounter,
  useFieldExit,
} from './field-runtime.mjs';
import { selectNearbyFieldInteractable } from './field-interaction-priority.mjs';
import {
  createLoadoutState,
  createLoadoutStorageAdapter,
  grantInventory,
  setMemberVitals,
} from './loadout.mjs';
import {
  createPlaytimeState,
  createPlaytimeStorageAdapter,
  formatPlaytime,
  isPlaytimeInactive,
  recordPlaytime,
} from './playtime.mjs';
import {
  createRunReceipt,
  createRunReceiptStorageAdapter,
  getRunProofReport,
  recordRunBeatCompletion,
  recordRunPlaytime,
} from './run-receipt.mjs';
import {
  acceptQuest,
  advanceQuestObjective,
  completeQuest,
  createQuestState,
  createQuestStorageAdapter,
  getQuestAvailability,
  getQuestProgress,
} from './quest-runtime.mjs';
import {
  advanceNarrative,
  createNarrativeState,
  createNarrativeStorageAdapter,
  getNarrativeProgress,
} from './narrative-runtime.mjs';
import {
  PARTY_ATLAS,
  atlasDirectionForMovement,
  getPartyAtlasFrame,
} from './sprite-atlas.mjs';
import {
  acknowledgeWitnessChronicleLine,
  acceptWitnessChronicle,
  advanceWitnessChronicle,
  completeWitnessChronicle,
  createWitnessChronicleState,
  createWitnessChronicleStorageAdapter,
  getWitnessChronicleAvailability,
  getWitnessChronicleProgress,
  getWitnessChronicleRuntimeMetrics,
} from './witness-chronicle-runtime.mjs';
import { getWitnessStageFieldwork } from './witness-stage-fieldwork.mjs';
import {
  advanceSceneOperation,
  createSceneOperationState,
  createSceneOperationStorageAdapter,
  getSceneOperationProgress,
} from './scene-operation-runtime.mjs';
import {
  createCampConversationState,
  createCampConversationStorageAdapter,
} from './camp-conversation-runtime.mjs';
import {
  createPartyCouncilState,
  createPartyCouncilStorageAdapter,
} from './party-council-runtime.mjs';
import {
  createArchiveRecordState,
  createArchiveRecordStorageAdapter,
} from './archive-record-runtime.mjs';

const chapterList = document.querySelector('#chapterList');
const completionLabel = document.querySelector('#completionLabel');
const chapterKicker = document.querySelector('#chapterKicker');
const chapterTitle = document.querySelector('#chapterTitle');
const chapterObjective = document.querySelector('#chapterObjective');
const mapCanvas = document.querySelector('#mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
mapCtx.imageSmoothingEnabled = false;
const partyAtlasImage = new Image();
partyAtlasImage.src = PARTY_ATLAS.url;
partyAtlasImage.addEventListener('load', () => renderSceneDirection(getBeat()), { once: true });
const mapName = document.querySelector('#mapName');
const mapLegend = document.querySelector('#mapLegend');
const sceneNumber = document.querySelector('#sceneNumber');
const sceneTitle = document.querySelector('#sceneTitle');
const sceneLocation = document.querySelector('#sceneLocation');
const sceneText = document.querySelector('#sceneText');
const sceneAtmosphere = document.querySelector('#sceneAtmosphere');
const sceneFocusPortrait = document.querySelector('#sceneFocusPortrait');
const scenePortraitCtx = sceneFocusPortrait.getContext('2d');
scenePortraitCtx.imageSmoothingEnabled = false;
const sceneMusicCue = document.querySelector('#sceneMusicCue');
const sceneCameraCue = document.querySelector('#sceneCameraCue');
const sceneEntranceCue = document.querySelector('#sceneEntranceCue');
const sceneGestureCue = document.querySelector('#sceneGestureCue');
const sceneBlockingCue = document.querySelector('#sceneBlockingCue');
const sceneTransitionCue = document.querySelector('#sceneTransitionCue');
const dialogueProgress = document.querySelector('#dialogueProgress');
const continueDialogue = document.querySelector('#continueDialogue');
const choiceDeck = document.querySelector('#choiceDeck');
const choiceResult = document.querySelector('#choiceResult');
const previousScene = document.querySelector('#previousScene');
const nextScene = document.querySelector('#nextScene');
const progressLabel = document.querySelector('#progressLabel');
const progressFill = document.querySelector('#progressFill');
const resetCampaign = document.querySelector('#resetCampaign');
const runProofStatus = document.querySelector('#runProofStatus');
const recoveryStatus = document.querySelector('#recoveryStatus');
const exportRecovery = document.querySelector('#exportRecovery');
const importRecovery = document.querySelector('#importRecovery');
const recoveryFile = document.querySelector('#recoveryFile');
const encounterName = document.querySelector('#encounterName');
const encounterObjective = document.querySelector('#encounterObjective');
const encounterLesson = document.querySelector('#encounterLesson');
const encounterEnemies = document.querySelector('#encounterEnemies');
const bossMechanic = document.querySelector('#bossMechanic');
const chapterReward = document.querySelector('#chapterReward');
const partyList = document.querySelector('#partyList');
const keyArt = document.querySelector('#keyArt');
const fieldFeedback = document.querySelector('#fieldFeedback');
const fieldControls = document.querySelector('#fieldControls');
const launchBattle = document.querySelector('#launchBattle');
const battleStatus = document.querySelector('#battleStatus');
const fieldPlaytime = document.querySelector('#fieldPlaytime');
const questSummary = document.querySelector('#questSummary');
const questList = document.querySelector('#questList');
const returnStoryRoute = document.querySelector('#returnStoryRoute');
const interactFieldButton = document.querySelector('#interactField');
const fieldObjective = document.querySelector('#fieldObjective');
const fieldProgress = document.querySelector('#fieldProgress');
const witnessSummary = document.querySelector('#witnessSummary');
const witnessList = document.querySelector('#witnessList');
const witnessStageCard = document.querySelector('#witnessStageCard');
const witnessStageMeta = document.querySelector('#witnessStageMeta');
const witnessStageTitle = document.querySelector('#witnessStageTitle');
const witnessStageInstruction = document.querySelector('#witnessStageInstruction');
const witnessDialogue = document.querySelector('#witnessDialogue');
const witnessChoiceDeck = document.querySelector('#witnessChoiceDeck');
const witnessStageHint = document.querySelector('#witnessStageHint');
const routeSummary = document.querySelector('#routeSummary');
const routeStatus = document.querySelector('#routeStatus');
const routeDueList = document.querySelector('#routeDueList');
const pageAudio = mountAudioControls({ desiredLoop: 'exploration' });

const chapters = getAllChapters();
const allBeatRecords = chapters.flatMap((chapter) => chapter.beats.map((beat) => ({ chapterId: chapter.id, beat })));
const saveAdapter = createLocalStorageAdapter();
const loadedSave = saveAdapter.load();
let campaignState = loadedSave.ok ? loadedSave.state : createCampaignState();
const advancementAdapter = createAdvancementStorageAdapter();
const loadedAdvancement = advancementAdapter.load();
let advancementState = loadedAdvancement.ok ? loadedAdvancement.state : createAdvancementState();
const frontierPartyState = unlockPartyMembers(advancementState, getCurrentChapter(campaignState).party);
if (frontierPartyState !== advancementState && advancementAdapter.save(frontierPartyState).ok) {
  advancementState = frontierPartyState;
}
const playtimeAdapter = createPlaytimeStorageAdapter();
const loadedPlaytime = playtimeAdapter.load();
let playtimeState = loadedPlaytime.ok ? loadedPlaytime.state : createPlaytimeState();
const runReceiptAdapter = createRunReceiptStorageAdapter();
const loadedRunReceipt = runReceiptAdapter.load();
let runReceiptState = loadedRunReceipt.ok && loadedRunReceipt.found ? loadedRunReceipt.state : null;
const campConversationAdapter = createCampConversationStorageAdapter();
const loadedCampConversations = campConversationAdapter.load();
let campConversationState = loadedCampConversations.state ?? createCampConversationState(runReceiptState?.runId);
const partyCouncilAdapter = createPartyCouncilStorageAdapter();
const loadedPartyCouncils = partyCouncilAdapter.load();
let partyCouncilState = loadedPartyCouncils.state ?? createPartyCouncilState(runReceiptState?.runId);
const archiveRecordAdapter = createArchiveRecordStorageAdapter();
const loadedArchiveRecords = archiveRecordAdapter.load();
let archiveRecordState = loadedArchiveRecords.state ?? createArchiveRecordState(runReceiptState?.runId);
const questAdapter = createQuestStorageAdapter();
const loadedQuests = questAdapter.load();
let questState = loadedQuests.ok ? loadedQuests.state : createQuestState();
const narrativeAdapter = createNarrativeStorageAdapter();
const loadedNarrative = narrativeAdapter.load();
let narrativeState = loadedNarrative.ok ? loadedNarrative.state : createNarrativeState();
const witnessAdapter = createWitnessChronicleStorageAdapter();
const loadedWitnessChronicles = witnessAdapter.load();
let witnessChronicleState = loadedWitnessChronicles.ok ? loadedWitnessChronicles.state : createWitnessChronicleState();
const sceneOperationAdapter = createSceneOperationStorageAdapter();
const loadedSceneOperations = sceneOperationAdapter.load();
let sceneOperationState = loadedSceneOperations.ok ? loadedSceneOperations.state : createSceneOperationState();
const loadoutAdapter = createLoadoutStorageAdapter();
const loadedLoadout = loadoutAdapter.load();
let loadoutState = loadedLoadout.ok ? loadedLoadout.value : createLoadoutState();
let playtimeLastSample = performance.now();
let playtimeLastActivity = performance.now();
let playtimeCategory = 'narrative';
let playtimeUnsavedMs = 0;
let runReceiptPendingMs = 0;
let runReceiptPendingCategory = null;
let runReceiptPendingChapterId = null;
let recoveryReloadPending = false;
let animationNow = 0;
let fieldFacing = 'south';
let fieldWalkUntil = 0;
const openingLevel = getLevelForBeat(getCurrentChapter(campaignState), getCurrentBeat(campaignState));
const fieldAdapter = createFieldStorageAdapter();
const loadedField = fieldAdapter.load({ levelId: openingLevel.id, beatId: getCurrentBeat(campaignState).id });
let fieldRuntimeState = loadedField.ok
  ? loadedField.state
  : createPersistentFieldState({ levelId: openingLevel.id, beatId: getCurrentBeat(campaignState).id });
let fieldTickLast = performance.now();
let fieldTickAccumulator = 0;
let selectedWitnessChronicleId = witnessChronicleState.records.find((record) => record.status === 'active')?.id ?? null;
let selectedWitnessChoiceId = null;

const fallbackPalette = Object.freeze({
  floor: '#23314a',
  floorAlt: '#1d293d',
  blocked: '#101624',
  accent: '#b8944c',
  water: '#23556a',
  hazard: '#8d3f40',
  rain: true,
});

function getChapter() {
  return getCurrentChapter(campaignState);
}

function getBeat() {
  return getCurrentBeat(campaignState);
}

function getBeatEncounterState(beat = getBeat()) {
  const encounters = (beat.encounterIds ?? []).map(getEncounter).filter(Boolean);
  const pending = encounters.find((encounter) => getEncounterWinCount(advancementState, encounter.id) === 0) ?? null;
  return Object.freeze({ encounters, pending, selected: pending ?? encounters[0] ?? null });
}

function currentBeatBattlesCleared() {
  const { encounters } = getBeatEncounterState();
  return encounters.every((encounter) => getEncounterWinCount(advancementState, encounter.id) > 0);
}

function currentSceneOperationProgress(beat = getBeat()) {
  return getSceneOperationProgress(sceneOperationState, beat.id);
}

function currentSceneOperationComplete(beat = getBeat()) {
  return currentSceneOperationProgress(beat)?.complete === true;
}

function chapterSceneCount() {
  return chapters.reduce((sum, chapter) => sum + chapter.beats.length, 0);
}

function unlockedSceneCount() {
  return getUnlockedBeatIds(campaignState).length;
}

function currentChapterIndex() {
  return chapters.findIndex((chapter) => chapter.id === getChapter().id);
}

function currentBeatIndex() {
  return getChapter().beats.findIndex((beat) => beat.id === getBeat().id);
}

function persistenceFailureText(action, result) {
  const rollback = result.rollbackComplete
    ? 'No live progress was changed.'
    : `Storage rollback also failed for ${result.rollbackFailedIds.join(', ')}; reload before continuing.`;
  return `${action} could not be saved (${result.failedId}). ${rollback}`;
}

function commitStateChanges(action, changes, { report = true } = {}) {
  const result = commitPersistenceTransaction(changes.map(({ id, adapter, previousState, nextState }) => (
    stateSaveStep(id, adapter, previousState, nextState, { supportsOverwriteRollback: true })
  )));
  if (!result.ok && report) fieldFeedback.textContent = persistenceFailureText(action, result);
  return result;
}

function questContext() {
  return { campaignState, advancementState };
}

function witnessChronicleContext() {
  return { campaignState, advancementState };
}

function settleReadyQuests() {
  const completedTitles = [];
  const failures = [];
  for (const quest of ALL_OPTIONAL_QUESTS) {
    const progress = getQuestProgress(questState, quest.id);
    if (!progress?.readyToComplete) continue;
    const result = completeQuest(questState, quest.id);
    if (!result.ok) continue;
    let nextAdvancementState = advancementState;
    let nextLoadoutState = loadoutState;
    if (result.reward) {
      const advancementReward = grantRewardBundle(advancementState, result.reward);
      const loadoutReward = grantInventory(loadoutState, result.reward);
      if (!advancementReward.ok || !loadoutReward.ok) continue;
      nextAdvancementState = advancementReward.state;
      nextLoadoutState = loadoutReward.state;
    }
    const changes = [
      { id: 'quest', adapter: questAdapter, previousState: questState, nextState: result.state },
      ...(result.reward ? [
        { id: 'advancement', adapter: advancementAdapter, previousState: advancementState, nextState: nextAdvancementState },
        { id: 'loadout', adapter: loadoutAdapter, previousState: loadoutState, nextState: nextLoadoutState },
      ] : []),
    ];
    const persisted = commitStateChanges(`Side-story reward for ${quest.title}`, changes, { report: false });
    if (!persisted.ok) {
      failures.push(persistenceFailureText(`Side-story reward for ${quest.title}`, persisted));
      continue;
    }
    questState = result.state;
    advancementState = nextAdvancementState;
    loadoutState = nextLoadoutState;
    completedTitles.push(quest.title);
  }
  return Object.freeze({ completedTitles: Object.freeze(completedTitles), failures: Object.freeze(failures) });
}

function settleReadyWitnessChronicles() {
  const completedTitles = [];
  const failures = [];
  for (const entry of WITNESS_CHRONICLES) {
    const progress = getWitnessChronicleProgress(witnessChronicleState, entry.id);
    if (!progress?.readyToComplete) continue;
    const result = completeWitnessChronicle(witnessChronicleState, entry.id);
    if (!result.ok) continue;
    const advancementReward = grantRewardBundle(advancementState, result.reward);
    const loadoutReward = grantInventory(loadoutState, result.reward);
    if (!advancementReward.ok || !loadoutReward.ok) continue;
    const persisted = commitStateChanges(`Witness reward for ${entry.title}`, [
      { id: 'witness', adapter: witnessAdapter, previousState: witnessChronicleState, nextState: result.state },
      { id: 'advancement', adapter: advancementAdapter, previousState: advancementState, nextState: advancementReward.state },
      { id: 'loadout', adapter: loadoutAdapter, previousState: loadoutState, nextState: loadoutReward.state },
    ], { report: false });
    if (!persisted.ok) {
      failures.push(persistenceFailureText(`Witness reward for ${entry.title}`, persisted));
      continue;
    }
    witnessChronicleState = result.state;
    advancementState = advancementReward.state;
    loadoutState = loadoutReward.state;
    completedTitles.push(entry.title);
    if (selectedWitnessChronicleId === entry.id) {
      selectedWitnessChronicleId = null;
      selectedWitnessChoiceId = null;
    }
  }
  return Object.freeze({ completedTitles: Object.freeze(completedTitles), failures: Object.freeze(failures) });
}

function sampleCampaignPlaytime(now) {
  const elapsed = Math.min(1000, Math.max(0, Math.floor(now - playtimeLastSample)));
  playtimeLastSample = now;
  if (elapsed === 0 || isPlaytimeInactive({
    nowMs: now,
    lastActivityMs: playtimeLastActivity,
    visible: document.visibilityState === 'visible',
  })) return;
  const chapterId = getChapter().id;
  playtimeState = recordPlaytime(playtimeState, playtimeCategory, elapsed, { chapterId });
  queueRunReceiptPlaytime(playtimeCategory, elapsed, chapterId);
  fieldPlaytime.textContent = formatPlaytime(playtimeState.totalMs);
  playtimeUnsavedMs += elapsed;
  if (playtimeUnsavedMs >= 10_000) {
    playtimeAdapter.save(playtimeState);
    playtimeUnsavedMs = 0;
  }
}

function clearPendingRunReceiptPlaytime() {
  runReceiptPendingMs = 0;
  runReceiptPendingCategory = null;
  runReceiptPendingChapterId = null;
}

function flushRunReceiptPlaytime() {
  if (!runReceiptState || runReceiptState.status !== 'active') {
    clearPendingRunReceiptPlaytime();
    return Object.freeze({ ok: true, saved: false });
  }
  if (runReceiptPendingMs === 0) return Object.freeze({ ok: true, saved: false });
  const result = recordRunPlaytime(
    runReceiptState,
    runReceiptState.runId,
    runReceiptPendingCategory,
    runReceiptPendingMs,
    { chapterId: runReceiptPendingChapterId },
  );
  if (!result.ok) return Object.freeze({ ok: false, code: result.code ?? 'receipt-transition-failed' });
  const saved = runReceiptAdapter.save(result.state);
  if (!saved.ok) return Object.freeze({ ok: false, code: saved.code ?? 'receipt-write-failed' });
  runReceiptState = result.state;
  clearPendingRunReceiptPlaytime();
  return Object.freeze({ ok: true, saved: true });
}

function queueRunReceiptPlaytime(category, elapsedMs, chapterId) {
  if (!runReceiptState || runReceiptState.status !== 'active') {
    clearPendingRunReceiptPlaytime();
    return;
  }
  const changedBucket = runReceiptPendingMs > 0
    && (category !== runReceiptPendingCategory || chapterId !== runReceiptPendingChapterId);
  if (changedBucket) flushRunReceiptPlaytime();
  if (runReceiptPendingMs === 0) {
    runReceiptPendingCategory = category;
    runReceiptPendingChapterId = chapterId;
  }
  runReceiptPendingMs += elapsedMs;
  if (runReceiptPendingMs >= 1000) flushRunReceiptPlaytime();
}

function sampleFieldRuntime(now) {
  const elapsed = Math.min(1000, Math.max(0, Math.floor(now - fieldTickLast)));
  fieldTickLast = now;
  if (elapsed === 0 || isPlaytimeInactive({
    nowMs: now,
    lastActivityMs: playtimeLastActivity,
    visible: document.visibilityState === 'visible',
  })) return;
  fieldTickAccumulator += elapsed;
  if (fieldTickAccumulator < 250) return;
  const tickMs = fieldTickAccumulator;
  fieldTickAccumulator = 0;
  const result = advanceFieldTime(fieldRuntimeState, tickMs, { flags: externalFieldFlags() });
  const important = result.events.find((event) => event.type === 'hazard-hit' || event.type === 'hazard-warning');
  if (important?.type === 'hazard-hit') {
    const consequence = getFieldHazardConsequence(important, loadoutState);
    const changes = [
      { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: result.state },
      ...(consequence.state !== loadoutState ? [
        { id: 'loadout', adapter: loadoutAdapter, previousState: loadoutState, nextState: consequence.state },
      ] : []),
    ];
    if (!commitStateChanges('Field hazard', changes).ok) return;
    fieldRuntimeState = result.state;
    loadoutState = consequence.state;
    fieldFeedback.textContent = `Hazard ${important.hazardId} triggered${consequence.message ? `; ${consequence.message}` : ''}. The last safe tile is preserved.`;
    return;
  }
  fieldRuntimeState = result.state;
  if (important?.cue) fieldFeedback.textContent = important.cue;
  if (fieldRuntimeState.revision % 20 === 0) fieldAdapter.save(fieldRuntimeState);
}

function getFieldHazardConsequence(event, state) {
  const effect = event.effect ?? {};
  const leaderId = getChapter().party?.[0] ?? 'ren';
  const vitals = state.vitals?.[leaderId];
  if (!vitals) return Object.freeze({ state, message: '' });
  const patch = {};
  if (effect.type === 'fieldDamage' || effect.type === 'damage' || effect.type === 'physicalDamage') {
    const percent = effect.percentMaxHp ?? 10;
    const minimum = effect.minimumHp ?? 1;
    patch.hp = Math.max(minimum, vitals.hp - Math.ceil(vitals.maxHp * (percent / 100)));
  }
  if (effect.status) patch.statuses = [...new Set([...vitals.statuses, effect.status])];
  if (!Object.keys(patch).length) return Object.freeze({ state, message: '' });
  const result = setMemberVitals(state, leaderId, patch);
  if (!result.ok) return Object.freeze({ state, message: '' });
  const hpLoss = vitals.hp - result.state.vitals[leaderId].hp;
  return Object.freeze({
    state: result.state,
    message: `${CAMPAIGN.cast?.[leaderId]?.name ?? leaderId} loses ${hpLoss} HP${effect.status ? ` and gains ${effect.status}` : ''}`,
  });
}

function isMultiSelectBeat(beat) {
  return beat.id === 'c9-03-conservatory-offers';
}

function normalizedWords(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 2 && !['the', 'and', 'with', 'from', 'into', 'after', 'before'].includes(word));
}

function mapReferenceForBeat(chapter, beat) {
  const maps = chapter.maps ?? [];
  const explicitLevel = beat.mapId ? getLevel(beat.mapId) : undefined;
  if (explicitLevel) return { id: explicitLevel.id, name: explicitLevel.name, purpose: explicitLevel.objective };
  const explicit = maps.find((map) => map.id === beat.mapId);
  if (explicit) return explicit;
  const location = String(beat.location ?? '').toLowerCase();
  const exact = maps.find((map) => String(map.name ?? '').toLowerCase() === location);
  if (exact) return exact;
  const locationWords = new Set(normalizedWords(beat.location));
  const scored = maps
    .map((map) => {
      const candidateText = `${map.name ?? ''} ${map.purpose ?? ''}`.toLowerCase();
      const candidateWords = normalizedWords(candidateText);
      const shared = candidateWords.filter((word) => locationWords.has(word)).length;
      const containment = location && (candidateText.includes(location) || location.includes(String(map.name ?? '').toLowerCase())) ? 4 : 0;
      return { map, score: shared + containment };
    })
    .sort((left, right) => right.score - left.score);
  return scored[0]?.score > 0 ? scored[0].map : undefined;
}

function getLevelForBeat(chapter, beat) {
  const authoredReference = mapReferenceForBeat(chapter, beat);
  return getLevel(authoredReference?.id) ?? getLevelForChapter(chapter.id) ?? LEVELS[0];
}

function getActiveLevelForBeat(chapter, beat) {
  const current = fieldRuntimeState?.current;
  const witnessContextId = getWitnessFieldContextId();
  if (current?.beatId === beat.id || (witnessContextId && current?.beatId === witnessContextId)) {
    const active = getLevel(current.levelId);
    if (active) return active;
  }
  return getLevelForBeat(chapter, beat);
}

function nextBeatRecord(beat = getBeat()) {
  const index = allBeatRecords.findIndex((record) => record.beat.id === beat.id);
  return index >= 0 ? allBeatRecords[index + 1] ?? null : null;
}

function fieldRouteReaches(startLevelId, targetLevelId) {
  if (startLevelId === targetLevelId) return true;
  const queue = [startLevelId];
  const visited = new Set(queue);
  while (queue.length) {
    const level = getLevel(queue.shift());
    for (const exit of level?.exits ?? []) {
      if (exit.destinationLevelId === targetLevelId) return true;
      if (getLevel(exit.destinationLevelId) && !visited.has(exit.destinationLevelId)) {
        visited.add(exit.destinationLevelId);
        queue.push(exit.destinationLevelId);
      }
    }
  }
  return false;
}

function beatRequiresFieldRoute(chapter = getChapter(), beat = getBeat()) {
  const next = nextBeatRecord(beat);
  if (!next) return false;
  const start = getLevelForBeat(chapter, beat);
  const targetChapter = chapters.find((entry) => entry.id === next.chapterId);
  const target = getLevelForBeat(targetChapter, next.beat);
  return start.id !== target.id && fieldRouteReaches(start.id, target.id);
}

function fieldRouteFlag(beat = getBeat()) {
  return `beat-route-complete-${beat.id}`;
}

function currentFieldRouteComplete() {
  return !beatRequiresFieldRoute() || fieldRuntimeState.flags.includes(fieldRouteFlag());
}

function keyOf(position) {
  if (typeof position === 'string') return position;
  if (Array.isArray(position)) return `${position[0]},${position[1]}`;
  if (position?.at) return position.at;
  return `${position.x},${position.y}`;
}

function asPositions(items = []) {
  return new Set(items.map(keyOf));
}

function coordinatesOf(position) {
  if (typeof position === 'string') {
    const [x, y] = position.split(',').map(Number);
    return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
  }
  if (Array.isArray(position)) {
    const [x, y] = position.map(Number);
    return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
  }
  if (position?.at) return coordinatesOf(position.at);
  const x = Number(position?.x);
  const y = Number(position?.y);
  return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
}

function terrainAt(level, x, y) {
  const terrain = level.terrain ?? [];
  const match = terrain.find((entry) => keyOf(entry) === `${x},${y}` || entry.key === `${x},${y}`);
  return match?.type ?? match?.terrain ?? match?.tag ?? 'stone';
}

function terrainColor(type, palette) {
  const colors = {
    stone: palette.floor,
    'wet-stone': palette.floor,
    'shallow-puddle': palette.water ?? '#24546b',
    'paper-litter': '#7d7361',
    'cracked-board': '#624a3c',
    'swing-beam-lane': '#765947',
    cedar: '#5b4135',
    water: palette.water ?? '#24546b',
    'storm-water': '#39718a',
    'cold-pool': '#5b9ab2',
    ash: '#4a4146',
    'ash-field': '#4a4146',
    'ember-ash': '#79433a',
    'umbral-ash': '#382c4b',
    bell: '#79633b',
    'bell-node': '#5c4b2d',
    forge: '#773f2f',
    'furnace-grate': '#773f2f',
    snow: '#7e94a8',
    'legal-seal': '#7d3540',
    'flowing-water': '#2d7490',
    'high-gallery': '#161823',
    'archive-floor': '#5b4b41',
    grass: '#36543e',
    lacquer: '#24202e',
  };
  return colors[type] ?? palette.floor;
}

function isFieldOpen(level, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= level.width || y >= level.height) {
    return false;
  }
  if (asPositions(level.blocked ?? []).has(`${x},${y}`)) return false;
  const terrain = terrainAt(level, x, y);
  return TERRAIN_TAGS[terrain]?.passable !== false;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function reachableFieldPositions(level) {
  const rawSpawn = Array.isArray(level.spawn) ? level.spawn[0] : level.spawn;
  const start = firstOpenFieldPosition(level, coordinatesOf(rawSpawn));
  const queue = [start];
  const visited = new Set([keyOf(start)]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const target = { x: current.x + dx, y: current.y + dy };
      const key = keyOf(target);
      if (!visited.has(key) && isFieldOpen(level, target.x, target.y)) {
        visited.add(key);
        queue.push(target);
      }
    }
  }
  const reserved = new Set([
    ...(level.exits ?? []).map(keyOf),
    ...(level.interactables ?? []).map(keyOf),
    keyOf(start),
  ]);
  const open = queue.filter((position) => !reserved.has(keyOf(position)));
  return open.length ? open : queue;
}

function getActiveQuestMarker(level) {
  for (const quest of ALL_OPTIONAL_QUESTS) {
    const progress = getQuestProgress(questState, quest.id);
    const objective = progress?.currentObjective;
    if (progress?.status !== 'active' || objective?.mapId !== level.id) continue;
    const positions = reachableFieldPositions(level);
    if (!positions.length) return null;
    return Object.freeze({ quest, progress, objective, position: positions[stableHash(objective.targetId ?? objective.id) % positions.length] });
  }
  return null;
}

function getSelectedWitnessProgress() {
  if (!selectedWitnessChronicleId) return null;
  const progress = getWitnessChronicleProgress(witnessChronicleState, selectedWitnessChronicleId);
  return progress?.status === 'active' ? progress : null;
}

function getWitnessFieldContextId(progress = getSelectedWitnessProgress()) {
  return progress?.currentStage
    ? `witness:${progress.chronicle.id}:${progress.currentStage.id}`
    : null;
}

function getWitnessTaskView(progress = getSelectedWitnessProgress()) {
  const stage = progress?.currentStage;
  if (!stage) return null;
  const fieldwork = getWitnessStageFieldwork(progress.chronicle.id, stage.id);
  if (!fieldwork?.nodes.length) return null;
  const dialogueNodeCount = Math.max(1, fieldwork.nodes.length - 1);
  const taskIndex = progress.dialogueComplete
    ? fieldwork.nodes.length - 1
    : Math.min(dialogueNodeCount - 1, Math.floor(
      (progress.acknowledgedLines * dialogueNodeCount) / Math.max(1, progress.dialogueLineCount),
    ));
  return Object.freeze({ fieldwork, taskIndex, task: fieldwork.nodes[taskIndex] });
}

function getActiveWitnessMarker(level) {
  const progress = getSelectedWitnessProgress();
  const currentStage = progress?.currentStage;
  if (!currentStage || currentStage.mapId !== level.id) return null;
  const taskView = getWitnessTaskView(progress);
  if (!taskView) return null;
  const { fieldwork, task, taskIndex } = taskView;
  return Object.freeze({
    chronicle: progress.chronicle,
    progress,
    stage: currentStage,
    fieldwork,
    task,
    taskIndex,
    position: coordinatesOf(task.at),
  });
}

function getActiveSceneOperationMarker(level, beat = getBeat()) {
  const operation = getSceneOperation(beat.id);
  const progress = currentSceneOperationProgress(beat);
  const current = fieldRuntimeState?.current;
  if (!operation || !progress?.currentNode || progress.complete) return null;
  if (operation.levelId !== level.id || current?.levelId !== level.id || current?.beatId !== beat.id) return null;
  return Object.freeze({
    operation,
    progress,
    node: progress.currentNode,
    nodeIndex: progress.currentNodeIndex,
    position: coordinatesOf(progress.currentNode.at),
  });
}

function inInteractionRange(left, right) {
  return left && right && Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y)) <= 1;
}

function onExactFieldPosition(left, right) {
  return Boolean(left && right && left.x === right.x && left.y === right.y);
}

function firstOpenFieldPosition(level, requested) {
  if (requested && isFieldOpen(level, requested.x, requested.y)) return requested;
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if (isFieldOpen(level, x, y)) return { x, y };
    }
  }
  return requested ?? { x: 0, y: 0 };
}

function externalFieldFlags() {
  const wonEncounterIds = Object.entries(advancementState.encounterWins ?? {})
    .filter(([, wins]) => wins > 0)
    .map(([id]) => id);
  const encounterFlags = wonEncounterIds.flatMap((id) => {
    const reward = getEncounter(id)?.reward ?? {};
    return [id, `${id}-cleared`, ...(reward.flags ?? []), ...(reward.keyItems ?? [])];
  });
  const questFlags = questState.records
    .filter((record) => record.status === 'completed')
    .flatMap((record) => [record.id, `${record.id}-complete`]);
  const witnessFlags = witnessChronicleState.records
    .filter((record) => record.status === 'completed')
    .flatMap((record) => {
      const entry = getWitnessChronicle(record.id);
      const selected = entry?.choice.options.find((option) => option.id === record.choiceId);
      return [record.id, `${record.id}-complete`, selected?.consequence.flag].filter(Boolean);
    });
  const operationFlags = sceneOperationState.records
    .filter((record) => record.status === 'completed')
    .flatMap((record) => [`scene-operation:${record.beatId}`, `scene-operation:${record.beatId}:complete`]);
  const campaignFlags = Object.keys(campaignState.flags ?? {});
  const derivedCampaignFlags = campaignFlags.includes('c3_genta_evidence_seen') ? ['lantern-route-chosen'] : [];
  return [
    ...campaignFlags,
    ...derivedCampaignFlags,
    ...(advancementState.inventory?.keyItems ?? []),
    ...encounterFlags,
    ...questFlags,
    ...witnessFlags,
    ...operationFlags,
  ];
}

function fieldPosition() {
  return getCurrentFieldContext(fieldRuntimeState).position;
}

function ensureFieldPosition(level) {
  const progress = getSelectedWitnessProgress();
  const witnessContextId = progress?.currentStage?.mapId === level.id ? getWitnessFieldContextId(progress) : null;
  const beatId = witnessContextId ?? getBeat().id;
  const current = fieldRuntimeState.current;
  const changed = current.levelId !== level.id || current.beatId !== beatId;
  const next = enterField(fieldRuntimeState, level.id, beatId, { flags: externalFieldFlags() });
  if (next !== fieldRuntimeState) {
    if (!commitStateChanges('Field entry', [
      { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: next },
    ]).ok) return Object.freeze({ ok: false, changed: false });
    fieldRuntimeState = next;
  }
  return Object.freeze({ ok: true, changed });
}

function describeFieldPosition(level, prefix = 'Field position') {
  const position = fieldPosition();
  return `${prefix}: ${level.name}, space ${position.x + 1},${position.y + 1}. W/A/S/D orthogonal · Q/E/Z/C diagonal.`;
}

function fieldEventMessage(level, result) {
  const event = result.events.find((entry) => entry.type !== 'moved') ?? result.events.at(-1);
  if (!result.moved) return `Blocked ${event?.direction?.includes('-') ? 'diagonal' : 'orthogonal'} step (${event?.reason ?? 'collision'}). ${describeFieldPosition(level)}`;
  if (!event || event.type === 'moved') return describeFieldPosition(level, 'Moved one exact space');
  if (event.type === 'encounter-triggered') return `Encounter triggered: ${getEncounter(event.encounterId)?.name ?? event.encounterId}.`;
  if (event.type === 'exit-ready') return `Exit ready: ${event.destinationLevelId}. Press Interact to continue the route.`;
  if (event.type === 'exit-locked') return `Exit locked until ${event.condition}.`;
  if (event.type === 'hazard-warning') return event.cue ?? `Hazard ${event.hazardId} is warning.`;
  if (event.type === 'hazard-hit') return `Hazard ${event.hazardId} triggered. The field record marked a safe recovery tile.`;
  return describeFieldPosition(level, 'Moved one exact space');
}

function launchPlacedEncounter(event, beat) {
  const parameters = new URLSearchParams({
    encounter: event.encounterId,
    return: 'campaign.html',
    beat: beat.id,
    fieldTrigger: event.triggerId,
  });
  window.location.href = `battle.html?${parameters.toString()}`;
}

function attemptFieldMove(dx, dy) {
  playtimeCategory = 'exploration';
  fieldFacing = atlasDirectionForMovement(dx, dy, fieldFacing);
  const chapter = getChapter();
  const beat = getBeat();
  const level = getActiveLevelForBeat(chapter, beat);
  if (!ensureFieldPosition(level).ok) return;
  const result = moveFieldBy(fieldRuntimeState, dx, dy, { flags: externalFieldFlags() });
  let nextLoadoutState = loadoutState;
  const consequenceMessages = [];
  for (const event of result.events.filter((entry) => entry.type === 'hazard-hit')) {
    const consequence = getFieldHazardConsequence(event, nextLoadoutState);
    nextLoadoutState = consequence.state;
    if (consequence.message) consequenceMessages.push(consequence.message);
  }
  const changes = [
    { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: result.state },
    ...(nextLoadoutState !== loadoutState ? [
      { id: 'loadout', adapter: loadoutAdapter, previousState: loadoutState, nextState: nextLoadoutState },
    ] : []),
  ];
  if (!commitStateChanges('Field movement', changes).ok) return;
  fieldRuntimeState = result.state;
  loadoutState = nextLoadoutState;
  if (result.moved) {
    fieldWalkUntil = performance.now() + 320;
    pageAudio.playCue('fieldStep');
  }
  fieldFeedback.textContent = fieldEventMessage(level, result);
  if (consequenceMessages.length) fieldFeedback.textContent += ` ${consequenceMessages.join(' ')}.`;
  const encounterEvent = result.events.find((event) => event.type === 'encounter-triggered');
  if (encounterEvent) {
    launchPlacedEncounter(encounterEvent, beat);
    return;
  }
  updateFieldDashboard(level);
}

function drawMap(level, encounter, now) {
  const width = level?.width ?? 12;
  const height = level?.height ?? 7;
  const authoredPalette = level?.palette ?? {};
  const palette = {
    ...fallbackPalette,
    ...authoredPalette,
    floor: authoredPalette.floor ?? authoredPalette.ground ?? fallbackPalette.floor,
    blocked: authoredPalette.blocked ?? authoredPalette.shadow ?? fallbackPalette.blocked,
    accent: authoredPalette.accent ?? fallbackPalette.accent,
  };
  const blocked = asPositions(level?.blocked ?? []);
  const exits = asPositions(level?.exits ?? []);
  const spawn = asPositions(Array.isArray(level?.spawn) ? level.spawn : level?.spawn ? [level.spawn] : []);
  if (!ensureFieldPosition(level).ok) return;
  const cell = Math.floor(Math.min(mapCanvas.width / width, mapCanvas.height / height));
  const originX = Math.floor((mapCanvas.width - width * cell) / 2);
  const originY = Math.floor((mapCanvas.height - height * cell) / 2);

  mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
  mapCtx.fillStyle = '#080c16';
  mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key = `${x},${y}`;
      const px = originX + x * cell;
      const py = originY + y * cell;
      const terrain = terrainAt(level ?? {}, x, y);
      mapCtx.fillStyle = terrainColor(terrain, palette);
      mapCtx.fillRect(px, py, cell, cell);
      mapCtx.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)';
      mapCtx.fillRect(px, py, cell, cell);
      mapCtx.strokeStyle = 'rgba(219,227,242,0.11)';
      mapCtx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);

      if (blocked.has(key)) {
        mapCtx.fillStyle = palette.blocked;
        mapCtx.fillRect(px + 3, py + 3, cell - 6, cell - 6);
        mapCtx.fillStyle = 'rgba(255,255,255,0.13)';
        mapCtx.fillRect(px + 5, py + 5, cell - 10, 3);
      }
      if (terrain === 'water') {
        const wave = Math.sin(now / 360 + x * 1.7 + y) * 2;
        mapCtx.strokeStyle = 'rgba(196,241,255,0.42)';
        mapCtx.beginPath();
        mapCtx.moveTo(px + 6, py + cell / 2 + wave);
        mapCtx.lineTo(px + cell - 6, py + cell / 2 - wave);
        mapCtx.stroke();
      }
      if (terrain === 'forge' || terrain === 'ash') {
        mapCtx.fillStyle = terrain === 'forge' ? 'rgba(255,142,75,0.2)' : 'rgba(216,206,201,0.12)';
        mapCtx.fillRect(px + cell * 0.38, py + cell * 0.38, Math.max(2, cell * 0.22), Math.max(2, cell * 0.22));
      }
      if (exits.has(key)) {
        mapCtx.strokeStyle = '#72d7d0';
        mapCtx.lineWidth = 2;
        mapCtx.strokeRect(px + 5, py + 5, cell - 10, cell - 10);
      }
      if (spawn.has(key)) {
        mapCtx.fillStyle = '#72d7d0';
        mapCtx.beginPath();
        mapCtx.moveTo(px + cell / 2, py + Math.max(4, cell * 0.15));
        mapCtx.lineTo(px + cell - Math.max(4, cell * 0.15), py + cell / 2);
        mapCtx.lineTo(px + cell / 2, py + cell - Math.max(4, cell * 0.15));
        mapCtx.lineTo(px + Math.max(4, cell * 0.15), py + cell / 2);
        mapCtx.closePath();
        mapCtx.fill();
      }
    }
  }

  const sceneOperationMarker = getActiveSceneOperationMarker(level);
  if (sceneOperationMarker) {
    const px = originX + sceneOperationMarker.position.x * cell + cell / 2;
    const py = originY + sceneOperationMarker.position.y * cell + cell / 2;
    const pulse = 0.7 + (Math.sin(now / 230) * 0.18);
    mapCtx.fillStyle = `rgba(244, 190, 92, ${pulse})`;
    mapCtx.fillRect(px - cell * 0.23, py - cell * 0.23, cell * 0.46, cell * 0.46);
    mapCtx.strokeStyle = '#fff0bb';
    mapCtx.lineWidth = 2;
    mapCtx.strokeRect(px - cell * 0.28, py - cell * 0.28, cell * 0.56, cell * 0.56);
    mapCtx.fillStyle = '#21170b';
    mapCtx.font = `${Math.max(8, Math.floor(cell * 0.27))}px monospace`;
    mapCtx.textAlign = 'center';
    mapCtx.textBaseline = 'middle';
    mapCtx.fillText(String(sceneOperationMarker.nodeIndex + 1), px, py + 1);
  }

  const questMarker = getActiveQuestMarker(level);
  if (questMarker) {
    const px = originX + questMarker.position.x * cell + cell / 2;
    const py = originY + questMarker.position.y * cell + cell / 2;
    const pulse = 0.68 + (Math.sin(now / 210) * 0.15);
    mapCtx.fillStyle = `rgba(244, 221, 148, ${pulse})`;
    mapCtx.beginPath();
    mapCtx.moveTo(px, py - cell * 0.28);
    mapCtx.lineTo(px + cell * 0.24, py);
    mapCtx.lineTo(px, py + cell * 0.28);
    mapCtx.lineTo(px - cell * 0.24, py);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.strokeStyle = '#a08ad1';
    mapCtx.stroke();
  }

  const witnessMarker = getActiveWitnessMarker(level);
  if (witnessMarker) {
    const px = originX + witnessMarker.position.x * cell + cell / 2;
    const py = originY + witnessMarker.position.y * cell + cell / 2;
    const pulse = 0.72 + (Math.sin(now / 250) * 0.16);
    mapCtx.fillStyle = `rgba(160, 138, 209, ${pulse})`;
    mapCtx.beginPath();
    mapCtx.arc(px, py, cell * 0.24, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.strokeStyle = '#fff0bb';
    mapCtx.lineWidth = 2;
    mapCtx.stroke();
    mapCtx.fillStyle = '#fff0bb';
    mapCtx.fillRect(px - 1, py - cell * 0.16, 2, cell * 0.22);
    mapCtx.fillRect(px - 1, py + cell * 0.1, 2, 2);
  }

  const enemyTokens = (encounter?.enemies ?? []).flatMap((enemy, enemyIndex) => {
    const positions = enemy.positions ?? (enemy.position ? [enemy.position] : []);
    return positions.map((position, positionIndex) => ({
      enemy,
      position: coordinatesOf(position) ?? { x: width - 2 - enemyIndex - positionIndex, y: Math.min(height - 2, 1 + enemyIndex + positionIndex) },
    }));
  });
  enemyTokens.slice(0, 8).forEach(({ enemy, position }, index) => {
    const px = originX + position.x * cell + cell / 2;
    const py = originY + position.y * cell + cell / 2;
    mapCtx.fillStyle = index === 0 && encounter?.format === 'boss' ? '#d76b57' : '#9b5d76';
    mapCtx.fillRect(px - cell * 0.18, py - cell * 0.2, cell * 0.36, cell * 0.42);
    mapCtx.fillStyle = '#e5d8c8';
    mapCtx.fillRect(px - cell * 0.08, py - cell * 0.1, cell * 0.16, cell * 0.1);
  });

  const partyPosition = fieldPosition();
  const partyX = originX + partyPosition.x * cell + cell / 2;
  const partyY = originY + partyPosition.y * cell + cell / 2;
  mapCtx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  mapCtx.beginPath();
  mapCtx.ellipse(partyX, partyY + cell * 0.27, cell * 0.25, cell * 0.09, 0, 0, Math.PI * 2);
  mapCtx.fill();
  if (partyAtlasImage.complete && partyAtlasImage.naturalWidth > 0) {
    const moving = now < fieldWalkUntil;
    const phase = moving ? Math.floor(now / 110) % 2 : 0;
    const frame = getPartyAtlasFrame('ren', fieldFacing, phase);
    const drawHeight = cell * 1.38;
    const drawWidth = drawHeight * (frame.width / frame.height);
    mapCtx.drawImage(
      partyAtlasImage,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      partyX - drawWidth / 2,
      partyY - drawHeight * 0.68,
      drawWidth,
      drawHeight,
    );
  } else {
    mapCtx.fillStyle = '#0b1020';
    mapCtx.fillRect(partyX - cell * 0.2, partyY - cell * 0.24, cell * 0.4, cell * 0.48);
    mapCtx.fillStyle = '#f6d47e';
    mapCtx.fillRect(partyX - cell * 0.14, partyY - cell * 0.2, cell * 0.28, cell * 0.38);
  }

  if (palette.rain !== false) {
    mapCtx.strokeStyle = 'rgba(177,218,255,0.27)';
    mapCtx.lineWidth = 1;
    for (let i = 0; i < 78; i += 1) {
      const x = (i * 67 + now * 0.08) % mapCanvas.width;
      const y = (i * 41 + now * 0.16) % mapCanvas.height;
      mapCtx.beginPath();
      mapCtx.moveTo(x, y);
      mapCtx.lineTo(x - 5, y + 12);
      mapCtx.stroke();
    }
  }

  mapName.textContent = level?.name ?? 'Campaign map pending';
  const terrainTags = [...new Set((level?.terrain ?? []).map((entry) => entry.type ?? entry.terrain ?? entry.tag).filter(Boolean))];
  const terrainLegend = terrainTags.length ? terrainTags.join(' · ') : 'Tactical preview';
  mapLegend.textContent = `${terrainLegend} · Story operation ■ · Witness ● · Side story ◆`;
}

function formatEnemies(enemies = []) {
  if (!enemies.length) return 'Story encounter / no enemy roster assigned.';
  return enemies.map((enemy) => enemy.name ?? enemy.id ?? 'Unknown threat').join(', ');
}

function dialogueLinesForBeat(beat = getBeat()) {
  const compiled = getFullDialogue(beat.id);
  if (compiled) return compiled;
  const source = Array.isArray(beat.text) && beat.text.length
    ? beat.text
    : [{ speaker: 'NARRATOR', line: String(beat.text ?? 'Scene text pending.') }];
  return Object.freeze(source.map((entry) => Object.freeze({
    speaker: String(entry.speaker ?? 'NARRATOR'),
    line: String(entry.line ?? entry.text ?? ''),
  })));
}

function narrativeProgressForBeat(beat = getBeat()) {
  return getNarrativeProgress(narrativeState, beat.id, dialogueLinesForBeat(beat).length);
}

function currentNarrativeComplete(beat = getBeat()) {
  return isBeatCompleted(campaignState, beat.id) || narrativeProgressForBeat(beat).complete;
}

function currentChoicesComplete(beat = getBeat()) {
  if (isBeatCompleted(campaignState, beat.id) || !(beat.choices ?? []).length) return true;
  const selected = getSelectedChoiceIds(campaignState, beat.id);
  return isMultiSelectBeat(beat) ? selected.length >= beat.choices.length : selected.length >= 1;
}

function renderDialogue(beat) {
  const lines = dialogueLinesForBeat(beat);
  const progress = narrativeProgressForBeat(beat);
  if (isBeatCompleted(campaignState, beat.id)) {
    sceneText.textContent = lines.map((line) => `${line.speaker}: ${line.line}`).join('\n\n');
    dialogueProgress.textContent = `${lines.length}/${lines.length} lines · completed scene replay`;
    continueDialogue.disabled = true;
    continueDialogue.textContent = 'Scene acknowledged';
    return;
  }
  const line = lines[progress.currentLineIndex ?? 0];
  sceneText.textContent = `${line.speaker}: ${line.line}`;
  dialogueProgress.textContent = progress.complete
    ? `${progress.lineCount}/${progress.lineCount} lines acknowledged`
    : `Line ${progress.currentLineIndex + 1}/${progress.lineCount}`;
  continueDialogue.disabled = progress.complete || isBeatCompleted(campaignState, beat.id);
  continueDialogue.textContent = progress.acknowledgedLines === progress.lineCount - 1
    ? 'Acknowledge scene'
    : 'Continue dialogue';
}

function renderSceneDirection(beat) {
  const direction = getSceneDirection(beat.id);
  pageAudio.setLoop('exploration');
  if (!direction) return;
  sceneAtmosphere.textContent = direction.atmosphere;
  sceneMusicCue.textContent = direction.musicCue;
  sceneCameraCue.textContent = direction.cameraCue;
  sceneEntranceCue.textContent = direction.entranceCue;
  sceneGestureCue.textContent = `${direction.gestureCue.speaker}: ${direction.gestureCue.action}`;
  sceneBlockingCue.textContent = direction.blockingCue;
  sceneTransitionCue.textContent = direction.transitionCue;
  sceneFocusPortrait.setAttribute('aria-label', `${direction.gestureCue.speaker} scene focus portrait`);
  scenePortraitCtx.clearRect(0, 0, sceneFocusPortrait.width, sceneFocusPortrait.height);
  if (partyAtlasImage.complete && partyAtlasImage.naturalWidth > 0) {
    const frame = getPartyAtlasFrame(direction.gestureCue.speaker.toLowerCase(), 'south', 0);
    scenePortraitCtx.drawImage(
      partyAtlasImage,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      sceneFocusPortrait.width,
      sceneFocusPortrait.height,
    );
  }
}

function formatParty(party = []) {
  return party
    .map((entry) => {
      const id = typeof entry === 'string' ? entry : entry.id;
      return CAMPAIGN.cast?.[id]?.name ?? entry.name ?? id;
    })
    .join(' · ');
}

function formatValue(value, fallback) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((entry) => entry.name ?? entry.id ?? entry).join(' · ');
  if (value && typeof value === 'object') {
    if (value.name ?? value.title ?? value.id) return value.name ?? value.title ?? value.id;
    const keyItems = formatValue(value.keyItems ?? [], '');
    const systems = formatValue(value.systems ?? [], '');
    return [keyItems, systems, value.story].filter(Boolean).join(' · ') || fallback;
  }
  return fallback;
}

function formatBrief(value, fallback) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((entry) => formatBrief(entry, '')).filter(Boolean).join(' · ') || fallback;
  if (value && typeof value === 'object') {
    return value.text
      ?? value.primary
      ?? value.rule
      ?? value.counterplay
      ?? value.humaneResolution
      ?? formatValue(value, fallback);
  }
  return fallback;
}

function renderChapterList() {
  chapterList.replaceChildren();
  const unlocked = new Set(getUnlockedBeatIds(campaignState));
  const activeChapterId = getChapter().id;
  chapters.forEach((chapter, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chapter-button';
    button.role = 'tab';
    button.dataset.chapterId = chapter.id;
    button.setAttribute('aria-selected', String(chapter.id === activeChapterId));
    const availableBeats = chapter.beats.filter((beat) => unlocked.has(beat.id));
    button.disabled = availableBeats.length === 0;
    if (chapter.beats.every((beat) => isBeatCompleted(campaignState, beat.id))) button.classList.add('is-finished');
    const number = String(chapter.number ?? index).padStart(2, '0');
    button.innerHTML = `<span class="chapter-index">${number}</span><span class="chapter-copy"><strong>${chapter.title}</strong><small>${chapter.subtitle ?? chapter.objective}</small></span>`;
    chapterList.append(button);
  });
  completionLabel.textContent = `${campaignState.completedBeatIds.length} / ${chapterSceneCount()} scenes`;
}

function renderChoices(beat) {
  choiceDeck.replaceChildren();
  choiceResult.textContent = '';
  const pickedIds = new Set(getSelectedChoiceIds(campaignState, beat.id));
  const choices = beat.choices ?? [];
  choices.forEach((choice, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'story-choice';
    button.dataset.choiceId = choice.id;
    button.innerHTML = `<strong>${index + 1}.</strong> ${choice.label}`;
    button.disabled = isBeatCompleted(campaignState, beat.id) || !currentNarrativeComplete(beat);
    if (pickedIds.has(choice.id)) button.classList.add('is-picked');
    choiceDeck.append(button);
  });
  const results = choices
    .filter((choice) => pickedIds.has(choice.id))
    .map((choice) => choice.result ?? 'This decision is recorded in the campaign ledger.');
  if (results.length) choiceResult.textContent = results.join(' ');
}

function renderQuestJournal(chapter) {
  const active = ALL_OPTIONAL_QUESTS.filter((quest) => getQuestProgress(questState, quest.id)?.status === 'active');
  const candidates = [...new Map([...active, ...getOptionalQuestsForChapter(chapter.id)].map((quest) => [quest.id, quest])).values()];
  const availableCount = candidates.filter((quest) => getQuestAvailability(questState, quest.id, questContext()).available).length;
  const activeCount = active.length;
  questSummary.textContent = `${activeCount} active · ${availableCount} available`;
  returnStoryRoute.disabled = fieldRuntimeState.current.levelId === getLevelForBeat(chapter, getBeat()).id;
  questList.replaceChildren(...candidates.map((quest) => {
    const progress = getQuestProgress(questState, quest.id);
    const availability = getQuestAvailability(questState, quest.id, questContext());
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quest-entry';
    button.dataset.questId = quest.id;
    const status = progress.status === 'active'
      ? `Objective ${Math.min(progress.objectiveIndex + 1, progress.objectiveCount)}/${progress.objectiveCount}`
      : progress.status === 'completed' ? `Completed ${progress.completions}×` : availability.available ? 'Accept side story' : 'Not yet available';
    const detail = progress.currentObjective?.instruction
      ?? (availability.available ? quest.hook : availability.reason);
    const mapName = progress.currentObjective?.mapId ?? quest.mapIds[0];
    const small = document.createElement('small');
    small.textContent = `${status} · ${quest.estimatedMinutes} min`;
    const strong = document.createElement('strong');
    strong.textContent = quest.title;
    const span = document.createElement('span');
    span.textContent = `${detail ?? quest.summary ?? 'Optional regional story.'} · ${mapName}`;
    button.append(small, strong, span);
    button.disabled = progress.status !== 'active' && !availability.available;
    if (progress.status === 'active') button.title = `Travel to ${mapName}`;
    if (progress.status === 'active') button.classList.add('is-active');
    if (progress.status === 'completed') button.classList.add('is-complete');
    return button;
  }));
}

function renderWitnessChronicleJournal(chapter) {
  const metrics = getWitnessChronicleRuntimeMetrics(witnessChronicleState);
  witnessSummary.textContent = `${metrics.completedChronicles}/${metrics.totalChronicles} complete · ${metrics.completedStages}/${metrics.totalStages} stages`;
  const active = WITNESS_CHRONICLES.filter((entry) => getWitnessChronicleProgress(witnessChronicleState, entry.id)?.status === 'active');
  const candidates = [...new Map([
    ...active,
    ...getWitnessChroniclesForChapter(chapter.id),
  ].map((entry) => [entry.id, entry])).values()];
  witnessList.replaceChildren(...candidates.map((entry) => {
    const progress = getWitnessChronicleProgress(witnessChronicleState, entry.id);
    const availability = getWitnessChronicleAvailability(witnessChronicleState, entry.id, witnessChronicleContext());
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quest-entry';
    button.dataset.witnessChronicleId = entry.id;
    const status = progress.status === 'active'
      ? `Stage ${Math.min(progress.stageIndex + 1, progress.stageCount)}/${progress.stageCount}`
      : progress.status === 'completed' ? 'Finite route complete' : availability.available ? 'Accept chronicle' : 'Not yet available';
    const map = getLevel(progress.currentStage?.mapId ?? entry.stages[0].mapId);
    const detail = progress.currentStage?.activity.instruction ?? (availability.available ? entry.setup : availability.reason);
    const small = document.createElement('small');
    small.textContent = `${status} · ${entry.estimatedMinutes} min authored activity`;
    const strong = document.createElement('strong');
    strong.textContent = entry.title;
    const span = document.createElement('span');
    span.textContent = `${detail} · ${map?.name ?? progress.currentStage?.mapId ?? entry.stages[0].mapId}`;
    button.append(small, strong, span);
    button.disabled = progress.status !== 'active' && !availability.available;
    if (progress.status === 'active') button.classList.add('is-active');
    if (progress.status === 'completed') button.classList.add('is-complete');
    if (selectedWitnessChronicleId === entry.id) button.classList.add('is-selected');
    return button;
  }));

  const progress = getSelectedWitnessProgress();
  const stage = progress?.currentStage;
  const taskView = getWitnessTaskView(progress);
  witnessStageCard.hidden = !stage;
  witnessChoiceDeck.replaceChildren();
  if (!stage) return;
  const level = getLevel(stage.mapId);
  witnessStageMeta.textContent = `Stage ${progress.stageIndex + 1}/${progress.stageCount} · task ${(taskView?.taskIndex ?? 0) + 1}/${taskView?.fieldwork.nodes.length ?? 1} · ${stage.activity.type} · ${level?.name ?? stage.mapId}`;
  witnessStageTitle.textContent = progress.chronicle.title;
  witnessStageInstruction.textContent = taskView
    ? `${taskView.task.verb}: ${taskView.task.instruction}`
    : stage.activity.instruction;
  const currentLine = progress.currentDialogueLine;
  witnessDialogue.textContent = currentLine
    ? `${currentLine.speaker}: ${currentLine.line}`
    : `All ${progress.dialogueLineCount} testimony lines acknowledged. The stage action can now be recorded.`;

  const isChoiceStage = progress.chronicle.choice.stageId === stage.id;
  if (isChoiceStage && progress.dialogueComplete) {
    const prompt = document.createElement('p');
    prompt.textContent = progress.chronicle.choice.prompt;
    witnessChoiceDeck.append(prompt, ...progress.chronicle.choice.options.map((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.witnessChoiceId = option.id;
      button.setAttribute('aria-pressed', String(selectedWitnessChoiceId === option.id));
      button.textContent = `${option.label} ${option.consequence.summary}`;
      return button;
    }));
  }

  const activeLevel = getActiveLevelForBeat(getChapter(), getBeat());
  const marker = getActiveWitnessMarker(activeLevel);
  const nearby = marker && onExactFieldPosition(fieldPosition(), marker.position);
  witnessStageHint.textContent = activeLevel.id !== stage.mapId
    ? `Select this chronicle to travel to ${level?.name ?? stage.mapId}.`
    : !nearby ? `Step onto fieldwork node ${(taskView?.taskIndex ?? 0) + 1}/${taskView?.fieldwork.nodes.length ?? 1}.`
      : !progress.dialogueComplete ? `Press X / Interact to acknowledge line ${progress.acknowledgedLines + 1}/${progress.dialogueLineCount}.`
        : isChoiceStage && !selectedWitnessChoiceId ? 'Choose one explicit custody consequence, then press X / Interact.'
          : stage.encounterId ? `Press X / Interact to enter ${getEncounter(stage.encounterId)?.name ?? stage.encounterId}.`
            : 'Press X / Interact once more to record this finite stage.';
}

function updateFieldDashboard(level) {
  const status = getFieldStatus(fieldRuntimeState, { flags: externalFieldFlags() });
  const sceneOperationMarker = getActiveSceneOperationMarker(level);
  const sceneOperationNearby = sceneOperationMarker && onExactFieldPosition(status.position, sceneOperationMarker.position);
  const witnessMarker = getActiveWitnessMarker(level);
  const witnessNearby = witnessMarker && onExactFieldPosition(status.position, witnessMarker.position);
  const marker = getActiveQuestMarker(level);
  const markerNearby = marker && inInteractionRange(status.position, marker.position);
  const authored = selectNearbyFieldInteractable(status);
  mapCanvas.dataset.beatId = getBeat().id;
  mapCanvas.dataset.levelId = level.id;
  mapCanvas.dataset.fieldX = String(status.position.x);
  mapCanvas.dataset.fieldY = String(status.position.y);
  mapCanvas.dataset.fieldState = sceneOperationMarker
    ? 'story-operation'
    : witnessMarker ? 'witness-chronicle'
      : marker ? 'side-story'
        : status.exit?.ready ? 'route-exit-ready' : 'field-route';
  if (sceneOperationMarker?.position) {
    mapCanvas.dataset.storyOperationNodeId = sceneOperationMarker.node.id;
    mapCanvas.dataset.storyOperationX = String(sceneOperationMarker.position.x);
    mapCanvas.dataset.storyOperationY = String(sceneOperationMarker.position.y);
  } else {
    delete mapCanvas.dataset.storyOperationNodeId;
    delete mapCanvas.dataset.storyOperationX;
    delete mapCanvas.dataset.storyOperationY;
  }
  const routeMarker = witnessMarker?.position
    ? {
      type: 'witness-chronicle',
      id: witnessMarker.task.id ?? `${witnessMarker.chronicle.id}:${witnessMarker.stage.id}:${witnessMarker.taskIndex}`,
      ownerId: witnessMarker.chronicle.id,
      position: witnessMarker.position,
    }
    : marker?.position ? {
      type: 'side-story',
      id: marker.objective.id,
      ownerId: marker.quest.id,
      position: marker.position,
    } : null;
  if (routeMarker) {
    mapCanvas.dataset.routeMarkerType = routeMarker.type;
    mapCanvas.dataset.routeMarkerId = routeMarker.id;
    mapCanvas.dataset.routeMarkerOwnerId = routeMarker.ownerId;
    mapCanvas.dataset.routeMarkerX = String(routeMarker.position.x);
    mapCanvas.dataset.routeMarkerY = String(routeMarker.position.y);
  } else {
    delete mapCanvas.dataset.routeMarkerType;
    delete mapCanvas.dataset.routeMarkerId;
    delete mapCanvas.dataset.routeMarkerOwnerId;
    delete mapCanvas.dataset.routeMarkerX;
    delete mapCanvas.dataset.routeMarkerY;
  }
  const unfinishedFieldRequirement = status.objective.requirements.find((requirement) => !requirement.complete);
  const requiredInteractable = unfinishedFieldRequirement?.type === 'interaction'
    ? (level.interactables ?? []).find((item) => item.id === unfinishedFieldRequirement.id)
    : unfinishedFieldRequirement?.type === 'flag'
      ? (level.interactables ?? []).find((item) => item.result === unfinishedFieldRequirement.id || item.id === unfinishedFieldRequirement.id)
      : null;
  const missingInteractablePrerequisite = requiredInteractable?.requires
    && !status.flags.includes(requiredInteractable.requires)
    ? (level.interactables ?? []).find((item) => item.id === requiredInteractable.requires)
    : null;
  const readyExit = unfinishedFieldRequirement
    ? null
    : status.objective.exits.find((exit) => exit.ready) ?? null;
  const exitBlockingInteractable = readyExit && authored && !authored.consumed ? authored : null;
  const nextRequiredInteractable = missingInteractablePrerequisite ?? requiredInteractable ?? exitBlockingInteractable;
  const fieldTarget = nextRequiredInteractable?.at
    ? { type: 'interaction', id: nextRequiredInteractable.id, at: nextRequiredInteractable.at, range: 1 }
    : readyExit?.at ? { type: 'route-exit', id: readyExit.id, at: readyExit.at, range: 0 } : null;
  const [fieldTargetX, fieldTargetY] = fieldTarget?.at?.split(',').map(Number) ?? [];
  if (fieldTarget && Number.isSafeInteger(fieldTargetX) && Number.isSafeInteger(fieldTargetY)) {
    mapCanvas.dataset.fieldObjectiveTargetType = fieldTarget.type;
    mapCanvas.dataset.fieldObjectiveTargetId = fieldTarget.id;
    mapCanvas.dataset.fieldObjectiveTargetX = String(fieldTargetX);
    mapCanvas.dataset.fieldObjectiveTargetY = String(fieldTargetY);
    mapCanvas.dataset.fieldObjectiveTargetRange = String(fieldTarget.range);
  } else {
    delete mapCanvas.dataset.fieldObjectiveTargetType;
    delete mapCanvas.dataset.fieldObjectiveTargetId;
    delete mapCanvas.dataset.fieldObjectiveTargetX;
    delete mapCanvas.dataset.fieldObjectiveTargetY;
    delete mapCanvas.dataset.fieldObjectiveTargetRange;
  }
  fieldObjective.textContent = sceneOperationMarker
    ? sceneOperationMarker.node.instruction
    : status.objective.text ?? level.objective ?? 'Explore the scene and follow its marked exit.';
  const requirements = status.objective.requirements.length
    ? status.objective.requirements.map((item) => `${item.complete ? '✓' : '○'} ${item.label}`).join(' · ')
    : `${(level.interactables ?? []).length} authored interactions`;
  fieldProgress.textContent = sceneOperationMarker
    ? `Story operation ${sceneOperationMarker.nodeIndex + 1}/${sceneOperationMarker.progress.nodeCount} · ${sceneOperationMarker.node.verb} · ${sceneOperationMarker.node.activityType}`
    : witnessMarker
      ? `Witness chronicle: ${witnessMarker.chronicle.title} · ${witnessMarker.task.verb} ${witnessMarker.taskIndex + 1}/${witnessMarker.fieldwork.nodes.length} · ${witnessMarker.task.instruction}`
    : marker
      ? `Side story: ${marker.quest.title} · ${marker.objective.instruction}`
    : `${status.objective.completedCount}/${status.objective.totalCount} route requirements · ${requirements}`;
  interactFieldButton.disabled = !sceneOperationNearby && !witnessNearby && !markerNearby && !authored && !status.exit;
  interactFieldButton.textContent = sceneOperationNearby
    ? `${sceneOperationMarker.node.verb} story operation (X)`
    : witnessNearby
      ? (witnessMarker.progress.dialogueComplete
      ? witnessMarker.stage.encounterId ? 'Enter chronicle battle (X)' : 'Record witness stage (X)'
      : `Hear testimony ${witnessMarker.progress.acknowledgedLines + 1}/${witnessMarker.progress.dialogueLineCount} (X)`)
    : markerNearby ? 'Advance side story (X)'
    : authored ? `${authored.consumed ? 'Review' : 'Interact'}: ${authored.id} (X)`
      : status.exit ? `${status.exit.ready ? 'Use' : 'Inspect'} exit (X)` : 'Nothing nearby (X)';
}

function moveCampaignThroughExit(transition, enteredFieldState) {
  const currentIndex = allBeatRecords.findIndex((record) => record.beat.id === getBeat().id);
  const targetIndex = allBeatRecords.findIndex((record, index) => index > currentIndex
    && getLevelForBeat(chapters.find((chapter) => chapter.id === record.chapterId), record.beat).id === transition.destinationLevelId);
  if (targetIndex === currentIndex + 1 && currentBeatBattlesCleared()) {
    const routedFieldState = grantFieldFlags(enteredFieldState, fieldRouteFlag());
    if (currentSceneOperationComplete() && currentNarrativeComplete() && currentChoicesComplete()) {
      const storyAdvanced = persistCurrentBeatCompletion({ nextFieldState: routedFieldState, action: 'Route and scene completion' });
      return Object.freeze({
        ok: storyAdvanced,
        storyAdvanced,
      });
    }
    if (!commitStateChanges('Route completion', [
      { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: routedFieldState },
    ]).ok) return Object.freeze({ ok: false, storyAdvanced: false });
    fieldRuntimeState = routedFieldState;
    render();
    fieldFeedback.textContent = 'Route exit recorded. Finish the remaining dialogue or decision before advancing the scene.';
    return Object.freeze({ ok: true, storyAdvanced: false });
  }
  const target = targetIndex >= 0 ? allBeatRecords[targetIndex] : null;
  if (target && getUnlockedBeatIds(campaignState).includes(target.beat.id)) {
    const nextCampaignState = moveToBeat(campaignState, target.chapterId, target.beat.id);
    if (!commitStateChanges('Unlocked route transition', [
      { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: enteredFieldState },
      { id: 'campaign', adapter: saveAdapter, previousState: campaignState, nextState: nextCampaignState },
    ]).ok) return Object.freeze({ ok: false, storyAdvanced: false });
    fieldRuntimeState = enteredFieldState;
    campaignState = nextCampaignState;
    render();
    return Object.freeze({ ok: true, storyAdvanced: true });
  }
  if (!commitStateChanges('Field exit', [
    { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: enteredFieldState },
  ]).ok) return Object.freeze({ ok: false, storyAdvanced: false });
  fieldRuntimeState = enteredFieldState;
  render();
  return Object.freeze({ ok: true, storyAdvanced: false });
}

function setKeyArt(chapter) {
  const artByChapter = {
    prologue: {
      path: 'assets/production/bells-takamine-keyframe-v1.png',
      alt: 'Original Takamine rain-gate production key art',
    },
    'chapter-2': {
      path: 'assets/production/bells-takamine-keyframe-v1.png',
      alt: 'Original Takamine rain-gate production key art',
    },
    'chapter-9': {
      path: 'assets/production/bells-enemy-bosses-v1.png',
      alt: 'Original Black Chrysanthemum enemy and boss production reference',
    },
  };
  const selected = artByChapter[chapter.id] ?? {
    path: 'assets/production/bells-party-roster-v1.png',
    alt: 'Original Bells of the Black Chrysanthemum party production reference',
  };
  keyArt.src = selected.path;
  keyArt.alt = selected.alt;
}

function renderBattleLaunch(beat, beatBattleState) {
  const summary = getAdvancementSummary(advancementState);
  const { encounters, pending, selected } = beatBattleState;
  if (!selected) {
    launchBattle.removeAttribute('href');
    launchBattle.setAttribute('aria-disabled', 'true');
    launchBattle.textContent = 'No encounter in this scene';
    battleStatus.textContent = `${summary.firstClears}/${ENCOUNTERS.length} first clears · average level ${summary.averageUnlockedLevel.toFixed(1)}`;
    return;
  }

  launchBattle.removeAttribute('aria-disabled');
  const parameters = new URLSearchParams({ encounter: selected.id, return: 'campaign.html', beat: beat.id });
  launchBattle.href = `battle.html?${parameters.toString()}`;
  const winCount = getEncounterWinCount(advancementState, selected.id);
  launchBattle.textContent = pending ? `Enter encounter: ${selected.name}` : `Replay for grind XP: ${selected.name}`;
  const clearedHere = encounters.filter((encounter) => getEncounterWinCount(advancementState, encounter.id) > 0).length;
  battleStatus.textContent = `${clearedHere}/${encounters.length} scene encounters cleared · ${winCount} wins here · saved repeat speed ${summary.speedMultiplier}×`;
}

function requiredRouteProgress() {
  return deriveRequiredRouteProgress({
    campaignState,
    questState,
    witnessChronicleState,
    campConversationState,
    partyCouncilState,
    archiveRecordState,
    advancementState,
  });
}

function requiredRouteActivityLabel(activityId) {
  const activity = getRequiredRouteActivity(activityId);
  if (!activity) return activityId;
  if (activity.type === 'finite-sidequest' || activity.type === 'repeat-grind-milestone') {
    return getSideQuest(activity.questId)?.title ?? activity.id;
  }
  if (activity.type === 'witness-chronicle') return getWitnessChronicle(activity.id)?.title ?? activity.id;
  if (activity.type === 'camp-conversation') return getCampConversation(activity.id)?.title ?? activity.id;
  if (activity.type === 'party-council') return getPartyCouncil(activity.id)?.title ?? activity.id;
  if (activity.type === 'archive-record') return getArchiveRecord(activity.id)?.title ?? activity.id;
  return activity.id;
}

function renderRequiredRouteLedger(progress) {
  const totals = progress.metrics.total;
  routeSummary.textContent = `${totals.completedActivityCount} / ${totals.requiredActivityCount} complete`;
  const invalidSources = Object.entries(progress.sourceValidity)
    .filter(([, valid]) => !valid)
    .map(([source]) => source);
  if (invalidSources.length) {
    routeStatus.dataset.state = 'due';
    routeStatus.textContent = `Route evidence is unavailable for: ${invalidSources.join(', ')}. Progress fails closed.`;
  } else if (progress.creditsGate.creditsReady) {
    routeStatus.dataset.state = 'ready';
    routeStatus.textContent = 'All 215 activities are complete. The intended route is ready for credits.';
  } else if (totals.entryDueActivityCount > 0) {
    routeStatus.dataset.state = 'due';
    routeStatus.textContent = `${totals.entryDueActivityCount} unlocked ${totals.entryDueActivityCount === 1 ? 'entry must' : 'entries must'} be started before the next story frontier closes.`;
  } else if (totals.dueActivityCount > 0) {
    routeStatus.dataset.state = 'ready';
    routeStatus.textContent = `${totals.dueActivityCount} entered ${totals.dueActivityCount === 1 ? 'activity remains' : 'activities remain'} finite; story may continue, but credits will wait.`;
  } else {
    routeStatus.dataset.state = 'ready';
    routeStatus.textContent = 'No intended-route entry is due at this story frontier.';
  }

  const prioritized = progress.entryDueActivityIds.length > 0
    ? [...new Set([...progress.inProgressActivityIds, ...progress.entryDueActivityIds])]
    : progress.dueActivityIds;
  const highlighted = prioritized.slice(0, 5);
  const nodes = highlighted.map((activityId) => {
    const item = document.createElement('li');
    const activity = getRequiredRouteActivity(activityId);
    const needsEntry = progress.entryDueActivityIds.includes(activityId);
    const action = document.createElement('button');
    action.type = 'button';
    action.dataset.routeActivityId = activityId;
    action.dataset.routeActivityType = activity?.type ?? 'unknown';
    action.textContent = `${needsEntry ? 'Start' : 'Continue'} · ${requiredRouteActivityLabel(activityId)}`;
    item.append(action);
    return item;
  });
  const hiddenCount = prioritized.length - highlighted.length;
  if (hiddenCount > 0) {
    const more = document.createElement('li');
    more.className = 'more';
    more.textContent = `+ ${hiddenCount} more in the route ledger`;
    nodes.push(more);
  }
  if (!nodes.length) {
    const empty = document.createElement('li');
    empty.className = 'more';
    empty.textContent = totals.lockedActivityCount > 0 ? 'Continue the story to unlock the next entries.' : 'The ledger is complete.';
    nodes.push(empty);
  }
  routeDueList.replaceChildren(...nodes);
}

function campRouteHref(activity) {
  const parameters = new URLSearchParams({ routeType: activity.type, routeId: activity.id });
  return `camp.html?${parameters.toString()}`;
}

function focusAndActivateRouteEntry(activity) {
  if (['camp-conversation', 'party-council', 'archive-record'].includes(activity.type)) {
    window.location.href = campRouteHref(activity);
    return;
  }
  const selector = activity.type === 'witness-chronicle'
    ? `[data-witness-chronicle-id="${CSS.escape(activity.id)}"]`
    : `[data-quest-id="${CSS.escape(activity.questId)}"]`;
  const target = document.querySelector(selector);
  if (!target) {
    fieldFeedback.textContent = `${requiredRouteActivityLabel(activity.id)} is not available on this story frontier.`;
    return;
  }
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.focus();
  target.click();
}

function render() {
  const questSettlements = settleReadyQuests();
  const witnessSettlements = settleReadyWitnessChronicles();
  const chapter = getChapter();
  const beat = getBeat();
  const level = getActiveLevelForBeat(chapter, beat);
  const fieldEntry = ensureFieldPosition(level);
  const enteredNewLevel = fieldEntry.ok && fieldEntry.changed;
  const beatBattleState = getBeatEncounterState(beat);
  const encounter = beatBattleState.selected ?? getEncounterForChapter(chapter.id) ?? ENCOUNTERS[0];
  const chapterIndex = currentChapterIndex();
  const beatIndex = currentBeatIndex();
  const recordIndex = allBeatRecords.findIndex((record) => record.beat.id === beat.id);
  chapterKicker.textContent = `${chapter.act ?? 'Campaign'} · ${chapter.number ?? chapterIndex}`;
  chapterTitle.textContent = chapter.title;
  chapterObjective.textContent = chapter.objective;
  sceneNumber.textContent = `SCENE ${String(beatIndex + 1).padStart(2, '0')}/${String(chapter.beats.length).padStart(2, '0')}`;
  sceneTitle.textContent = beat.title;
  sceneLocation.textContent = beat.location ?? chapter.maps?.[0]?.name ?? 'Campaign route';
  renderDialogue(beat);
  renderSceneDirection(beat);
  partyList.textContent = formatParty(chapter.party);
  chapterReward.textContent = formatValue(chapter.reward, 'Narrative progress');
  encounterName.textContent = encounter?.name ?? formatValue(chapter.boss, 'Chapter encounter pending');
  encounterObjective.textContent = formatBrief(encounter?.objective, chapter.objective);
  encounterLesson.textContent = formatBrief(encounter?.lesson, 'Scene and party progression');
  encounterEnemies.textContent = formatEnemies(encounter?.enemies);
  bossMechanic.textContent = formatBrief(encounter?.bossMechanic, 'No boss mechanic assigned.');
  previousScene.disabled = recordIndex <= 0;
  const operationCleared = currentSceneOperationComplete(beat);
  const battlesCleared = currentBeatBattlesCleared();
  const fieldRouteCleared = currentFieldRouteComplete();
  const narrativeCleared = currentNarrativeComplete(beat);
  const choicesCleared = currentChoicesComplete(beat);
  const campaignComplete = isCampaignComplete(campaignState);
  const routeProgress = requiredRouteProgress();
  const routeEntryCleared = routeProgress.metrics.total.entryDueActivityCount === 0;
  nextScene.disabled = !campaignComplete
    && (!routeEntryCleared || !operationCleared || !battlesCleared || !fieldRouteCleared || !narrativeCleared || !choicesCleared);
  nextScene.textContent = isCampaignComplete(campaignState)
    ? 'View credits & seal run →'
    : !routeEntryCleared ? `Start ${routeProgress.metrics.total.entryDueActivityCount} route ${routeProgress.metrics.total.entryDueActivityCount === 1 ? 'entry' : 'entries'}`
      : !operationCleared ? 'Complete the scene operation'
      : !battlesCleared ? 'Clear encounter to continue'
      : !narrativeCleared ? 'Finish the scene dialogue'
        : !choicesCleared ? 'Record the scene decision'
          : fieldRouteCleared ? 'Next scene →' : 'Reach and use the route exit';
  const progress = (beatIndex + 1) / chapter.beats.length;
  progressLabel.textContent = `${beatIndex + 1} of ${chapter.beats.length} scenes`;
  progressFill.style.width = `${Math.round(progress * 100)}%`;
  fieldPlaytime.textContent = formatPlaytime(playtimeState.totalMs);
  renderRunProofStatus();
  updateFieldDashboard(level);
  setKeyArt(chapter);
  renderChoices(beat);
  renderQuestJournal(chapter);
  renderWitnessChronicleJournal(chapter);
  renderRequiredRouteLedger(routeProgress);
  renderChapterList();
  renderBattleLaunch(beat, beatBattleState);
  const completionNotices = [
    questSettlements.completedTitles.length ? `Side story complete: ${questSettlements.completedTitles.join(', ')}.` : '',
    witnessSettlements.completedTitles.length ? `Witness chronicle complete: ${witnessSettlements.completedTitles.join(', ')}.` : '',
  ].filter(Boolean);
  const persistenceFailures = [...questSettlements.failures, ...witnessSettlements.failures];
  fieldFeedback.textContent = persistenceFailures.length
    ? persistenceFailures.join(' ')
    : completionNotices.length
      ? `${completionNotices.join(' ')} One-time rewards recorded.`
      : describeFieldPosition(level, enteredNewLevel ? 'Entered field' : 'Field position');
  drawMap(level, encounter, animationNow);
}

function renderRunProofStatus() {
  if (!runReceiptState) {
    runProofStatus.dataset.proof = 'failed';
    runProofStatus.textContent = 'Unverified save · choose New Game for a clean-run receipt';
    return;
  }
  const report = getRunProofReport(runReceiptState);
  const elapsed = formatPlaytime(report.totalMs);
  if (report.durationProven) {
    runProofStatus.dataset.proof = 'proven';
    runProofStatus.textContent = `20-hour run proven · ${elapsed} · ${report.requiredBeatCount} scenes · ${report.requiredFirstClearCount} first clears`;
    return;
  }
  if (report.storyComplete && !report.creditsComplete) {
    runProofStatus.dataset.proof = 'active';
    runProofStatus.textContent = `Story complete · ${elapsed} · receipt active until credits finish`;
    return;
  }
  if (report.status === 'complete') {
    runProofStatus.dataset.proof = 'failed';
    runProofStatus.textContent = `Clean run complete · ${elapsed}; 20-hour duration not proven`;
    return;
  }
  runProofStatus.dataset.proof = 'active';
  runProofStatus.textContent = `Clean run ${runReceiptState.runId.slice(0, 8)} · ${elapsed} · ${report.completedBeatCount}/${report.requiredBeatCount} scenes · ${report.firstClearCount}/${report.requiredFirstClearCount} first clears`;
}

function choose(choiceId) {
  const beat = getBeat();
  if (isBeatCompleted(campaignState, beat.id)) {
    fieldFeedback.textContent = 'Completed-scene decisions are read-only in replay.';
    return;
  }
  if (!currentNarrativeComplete(beat)) {
    fieldFeedback.textContent = 'Finish the scene dialogue before recording its decision.';
    return;
  }
  const choice = (beat.choices ?? []).find((entry) => entry.id === choiceId);
  if (!choice) return;
  playtimeCategory = 'narrative';
  const nextCampaignState = isMultiSelectBeat(beat)
    ? appendChoice(campaignState, choice.id)
    : selectChoice(campaignState, choice.id);
  if (!commitStateChanges('Scene decision', [
    { id: 'campaign', adapter: saveAdapter, previousState: campaignState, nextState: nextCampaignState },
  ]).ok) return;
  campaignState = nextCampaignState;
  render();
}

function persistCurrentBeatCompletion({ nextFieldState = null, action = 'Scene completion' } = {}) {
  const routeProgress = requiredRouteProgress();
  if (routeProgress.metrics.total.entryDueActivityCount > 0) {
    fieldFeedback.textContent = `${action} is paused until the ${routeProgress.metrics.total.entryDueActivityCount} unlocked intended-route ${routeProgress.metrics.total.entryDueActivityCount === 1 ? 'entry is' : 'entries are'} started.`;
    return false;
  }
  const completedBeatId = getBeat().id;
  const completedCount = campaignState.completedBeatIds.length;
  const flushed = flushRunReceiptPlaytime();
  if (!flushed.ok) {
    fieldFeedback.textContent = `${action} is paused because active run time could not be saved.`;
    return false;
  }
  const nextCampaignState = completeCurrentBeat(campaignState);
  const nextAdvancementState = isCampaignComplete(nextCampaignState)
    ? advancementState
    : unlockPartyMembers(advancementState, getCurrentChapter(nextCampaignState).party);
  let persistedFieldState = nextFieldState ?? fieldRuntimeState;
  if (!isCampaignComplete(nextCampaignState)) {
    const nextChapter = getCurrentChapter(nextCampaignState);
    const nextBeat = getCurrentBeat(nextCampaignState);
    const nextLevel = getLevelForBeat(nextChapter, nextBeat);
    persistedFieldState = enterField(persistedFieldState, nextLevel.id, nextBeat.id, { flags: externalFieldFlags() });
  }
  let nextRunReceiptState = runReceiptState;
  if (nextCampaignState.completedBeatIds.length > completedCount && runReceiptState) {
    const receiptResult = recordRunBeatCompletion(runReceiptState, runReceiptState.runId, completedBeatId);
    if (!receiptResult.ok) {
      fieldFeedback.textContent = `${action} could not update the clean-run receipt (${receiptResult.code}).`;
      return false;
    }
    nextRunReceiptState = receiptResult.state;
  }
  const changes = [
    ...(persistedFieldState !== fieldRuntimeState ? [
      { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: persistedFieldState },
    ] : []),
    { id: 'campaign', adapter: saveAdapter, previousState: campaignState, nextState: nextCampaignState },
    ...(nextAdvancementState !== advancementState ? [
      { id: 'advancement', adapter: advancementAdapter, previousState: advancementState, nextState: nextAdvancementState },
    ] : []),
    ...(nextRunReceiptState !== runReceiptState ? [
      { id: 'run-receipt', adapter: runReceiptAdapter, previousState: runReceiptState, nextState: nextRunReceiptState },
    ] : []),
  ];
  if (!commitStateChanges(action, changes).ok) return false;
  fieldRuntimeState = persistedFieldState;
  campaignState = nextCampaignState;
  advancementState = nextAdvancementState;
  runReceiptState = nextRunReceiptState;
  render();
  return true;
}

function advance(direction) {
  playtimeCategory = 'narrative';
  const currentIndex = allBeatRecords.findIndex((record) => record.beat.id === getBeat().id);
  if (direction < 0) {
    if (currentIndex <= 0) return;
    const previous = allBeatRecords[currentIndex - 1];
    const nextCampaignState = moveToBeat(campaignState, previous.chapterId, previous.beat.id);
    if (!commitStateChanges('Previous-scene navigation', [
      { id: 'campaign', adapter: saveAdapter, previousState: campaignState, nextState: nextCampaignState },
    ]).ok) return;
    campaignState = nextCampaignState;
    render();
    return;
  }
  if (isCampaignComplete(campaignState)) {
    const flushed = flushRunReceiptPlaytime();
    if (!flushed.ok) {
      fieldFeedback.textContent = 'Credits navigation is paused because active run time could not be saved.';
      return;
    }
    window.location.href = 'credits.html';
    return;
  }
  const routeProgress = requiredRouteProgress();
  if (routeProgress.metrics.total.entryDueActivityCount > 0) {
    fieldFeedback.textContent = `Start the ${routeProgress.metrics.total.entryDueActivityCount} unlocked intended-route ${routeProgress.metrics.total.entryDueActivityCount === 1 ? 'entry' : 'entries'} shown in the route ledger before closing this story frontier.`;
    return;
  }
  if (!currentSceneOperationComplete()) {
    fieldFeedback.textContent = 'Complete every ordered field node in this scene operation before advancing the story.';
    return;
  }
  if (!currentBeatBattlesCleared()) {
    battleStatus.textContent = 'Clear every encounter bound to this scene before advancing.';
    return;
  }
  if (!currentNarrativeComplete()) {
    fieldFeedback.textContent = 'Acknowledge every dialogue line before advancing the story.';
    return;
  }
  if (!currentChoicesComplete()) {
    fieldFeedback.textContent = 'Record the scene decision before advancing the story.';
    return;
  }
  if (!currentFieldRouteComplete()) {
    fieldFeedback.textContent = 'Complete this beat’s authored field route and use its terminal exit before advancing.';
    return;
  }
  persistCurrentBeatCompletion();
}

chapterList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-chapter-id]');
  if (!button) return;
  const chapter = chapters.find((entry) => entry.id === button.dataset.chapterId);
  const unlocked = new Set(getUnlockedBeatIds(campaignState));
  const target = chapter?.beats.filter((beat) => unlocked.has(beat.id)).at(-1);
  if (!chapter || !target) return;
  playtimeCategory = 'narrative';
  const nextCampaignState = moveToBeat(campaignState, chapter.id, target.id);
  const storyLevel = getLevelForBeat(chapter, target);
  const nextFieldState = enterField(fieldRuntimeState, storyLevel.id, target.id, { flags: externalFieldFlags() });
  if (!commitStateChanges('Chapter navigation', [
    { id: 'campaign', adapter: saveAdapter, previousState: campaignState, nextState: nextCampaignState },
    { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: nextFieldState },
  ]).ok) return;
  campaignState = nextCampaignState;
  fieldRuntimeState = nextFieldState;
  render();
});

choiceDeck.addEventListener('click', (event) => {
  const button = event.target.closest('[data-choice-id]');
  if (button) {
    pageAudio.playCue('uiConfirm');
    choose(button.dataset.choiceId);
  }
});

continueDialogue.addEventListener('click', () => {
  playtimeCategory = 'narrative';
  const beat = getBeat();
  const result = advanceNarrative(narrativeState, beat.id, dialogueLinesForBeat(beat).length);
  if (!commitStateChanges('Dialogue progress', [
    { id: 'narrative', adapter: narrativeAdapter, previousState: narrativeState, nextState: result.state },
  ]).ok) return;
  narrativeState = result.state;
  pageAudio.playCue('uiConfirm');
  render();
});

questList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-quest-id]');
  if (!button) return;
  const progress = getQuestProgress(questState, button.dataset.questId);
  if (progress?.status === 'active' && progress.currentObjective?.mapId) {
    const destination = getLevel(progress.currentObjective.mapId);
    if (!destination) {
      fieldFeedback.textContent = `The side-story destination ${progress.currentObjective.mapId} is not authored.`;
      return;
    }
    playtimeCategory = 'exploration';
    const nextFieldState = enterField(fieldRuntimeState, destination.id, getBeat().id, { flags: externalFieldFlags() });
    if (!commitStateChanges('Side-story travel', [
      { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: nextFieldState },
    ]).ok) return;
    fieldRuntimeState = nextFieldState;
    render();
    fieldFeedback.textContent = `Side-story route: ${progress.currentObjective.instruction} (${destination.name}).`;
    return;
  }
  playtimeCategory = 'narrative';
  const result = acceptQuest(questState, button.dataset.questId, questContext());
  if (!result.ok) {
    fieldFeedback.textContent = result.reason;
    return;
  }
  if (!commitStateChanges('Side-story acceptance', [
    { id: 'quest', adapter: questAdapter, previousState: questState, nextState: result.state },
  ]).ok) return;
  questState = result.state;
  render();
  fieldFeedback.textContent = `Side story accepted: ${result.progress.quest.title}. ${result.progress.currentObjective?.instruction ?? ''}`;
});

routeDueList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-route-activity-id]');
  if (!button) return;
  const activity = getRequiredRouteActivity(button.dataset.routeActivityId);
  if (!activity) {
    fieldFeedback.textContent = 'This route entry is no longer part of the canonical itinerary.';
    return;
  }
  focusAndActivateRouteEntry(activity);
});

witnessList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-witness-chronicle-id]');
  if (!button) return;
  const chronicleId = button.dataset.witnessChronicleId;
  const previousWitnessState = witnessChronicleState;
  let nextWitnessState = witnessChronicleState;
  let progress = getWitnessChronicleProgress(witnessChronicleState, chronicleId);
  if (progress?.status !== 'active') {
    playtimeCategory = 'narrative';
    const accepted = acceptWitnessChronicle(witnessChronicleState, chronicleId, witnessChronicleContext());
    if (!accepted.ok) {
      fieldFeedback.textContent = accepted.reason;
      return;
    }
    nextWitnessState = accepted.state;
    progress = accepted.progress;
  }
  if (!progress?.currentStage) return;
  const destination = getLevel(progress.currentStage.mapId);
  if (!destination) {
    fieldFeedback.textContent = `The witness destination ${progress.currentStage.mapId} is not authored.`;
    return;
  }
  const nextFieldState = enterField(fieldRuntimeState, destination.id, getWitnessFieldContextId(progress), { flags: externalFieldFlags() });
  const changes = [
    ...(nextWitnessState !== previousWitnessState ? [
      { id: 'witness', adapter: witnessAdapter, previousState: previousWitnessState, nextState: nextWitnessState },
    ] : []),
    { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: nextFieldState },
  ];
  if (!commitStateChanges('Witness-route entry', changes).ok) return;
  witnessChronicleState = nextWitnessState;
  fieldRuntimeState = nextFieldState;
  selectedWitnessChronicleId = chronicleId;
  selectedWitnessChoiceId = null;
  playtimeCategory = 'exploration';
  render();
  fieldFeedback.textContent = `Witness route: ${progress.currentStage.activity.instruction} (${destination.name}). Follow the violet marker.`;
});

witnessChoiceDeck.addEventListener('click', (event) => {
  const button = event.target.closest('[data-witness-choice-id]');
  const progress = getSelectedWitnessProgress();
  if (!button || !progress?.currentStage || progress.chronicle.choice.stageId !== progress.currentStage.id) return;
  const option = progress.chronicle.choice.options.find((candidate) => candidate.id === button.dataset.witnessChoiceId);
  if (!option) return;
  selectedWitnessChoiceId = option.id;
  playtimeCategory = 'narrative';
  renderWitnessChronicleJournal(getChapter());
  fieldFeedback.textContent = `Witness consequence selected: ${option.label}`;
});

returnStoryRoute.addEventListener('click', () => {
  playtimeCategory = 'exploration';
  const chapter = getChapter();
  const beat = getBeat();
  const destination = getLevelForBeat(chapter, beat);
  const nextFieldState = enterField(fieldRuntimeState, destination.id, beat.id, { flags: externalFieldFlags() });
  if (!commitStateChanges('Story-route return', [
    { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: nextFieldState },
  ]).ok) return;
  fieldRuntimeState = nextFieldState;
  selectedWitnessChronicleId = null;
  selectedWitnessChoiceId = null;
  render();
  fieldFeedback.textContent = `Returned to the main story route at ${destination.name}.`;
});

fieldControls.addEventListener('click', (event) => {
  const button = event.target.closest('[data-field-move]');
  if (!button) return;
  const [dx, dy] = button.dataset.fieldMove.split(',').map(Number);
  attemptFieldMove(dx, dy);
});

interactFieldButton.addEventListener('click', () => {
  playtimeCategory = 'exploration';
  const chapter = getChapter();
  const beat = getBeat();
  const level = getActiveLevelForBeat(chapter, beat);
  if (!ensureFieldPosition(level).ok) return;
  const sceneOperationMarker = getActiveSceneOperationMarker(level, beat);
  if (sceneOperationMarker && onExactFieldPosition(fieldPosition(), sceneOperationMarker.position)) {
    const result = advanceSceneOperation(
      sceneOperationState,
      beat.id,
      sceneOperationMarker.node.id,
      { at: keyOf(fieldPosition()), encounterWins: advancementState.encounterWins ?? {} },
    );
    if (!result.ok && result.code === 'encounter-victory-required') {
      const encounterId = result.pendingEncounterIds[0];
      const parameters = new URLSearchParams({
        encounter: encounterId,
        return: 'campaign.html',
        beat: beat.id,
        sceneOperation: beat.id,
        sceneOperationNode: sceneOperationMarker.node.id,
      });
      if (!commitStateChanges('Scene-operation battle handoff', [
        { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: fieldRuntimeState },
        { id: 'scene-operation', adapter: sceneOperationAdapter, previousState: sceneOperationState, nextState: sceneOperationState },
      ]).ok) return;
      window.location.href = `battle.html?${parameters.toString()}`;
      return;
    }
    if (!result.ok) {
      fieldFeedback.textContent = result.reason;
      return;
    }
    if (!commitStateChanges('Scene operation', [
      { id: 'scene-operation', adapter: sceneOperationAdapter, previousState: sceneOperationState, nextState: result.state },
    ]).ok) return;
    sceneOperationState = result.state;
    pageAudio.playCue('fieldInteract');
    render();
    fieldFeedback.textContent = result.beatCompleted
      ? `Scene operation complete: all ${result.progress.nodeCount} finite field nodes are recorded.`
      : `${result.node.verb} complete. Continue to story operation ${result.progress.currentNodeIndex + 1}/${result.progress.nodeCount}: ${result.progress.currentNode.instruction}`;
    return;
  }
  const witnessMarker = getActiveWitnessMarker(level);
  if (witnessMarker && onExactFieldPosition(fieldPosition(), witnessMarker.position)) {
    const { chronicle, progress, stage } = witnessMarker;
    if (!progress.dialogueComplete) {
      const acknowledged = acknowledgeWitnessChronicleLine(witnessChronicleState, chronicle.id);
      if (!acknowledged.ok) {
        fieldFeedback.textContent = acknowledged.reason;
        return;
      }
      if (!commitStateChanges('Witness testimony', [
        { id: 'witness', adapter: witnessAdapter, previousState: witnessChronicleState, nextState: acknowledged.state },
      ]).ok) return;
      witnessChronicleState = acknowledged.state;
      playtimeCategory = 'narrative';
      renderWitnessChronicleJournal(chapter);
      updateFieldDashboard(level);
      fieldFeedback.textContent = `${acknowledged.line.speaker}: ${acknowledged.line.line}`;
      return;
    }
    const isChoiceStage = chronicle.choice.stageId === stage.id;
    if (isChoiceStage && !selectedWitnessChoiceId) {
      fieldFeedback.textContent = 'Choose one explicit witness consequence in the chronicle panel before recording this stage.';
      return;
    }
    if (stage.encounterId) {
      if (getEncounterWinCount(advancementState, stage.encounterId) > 0) {
        const evidence = { encounterId: stage.encounterId, victory: true };
        if (selectedWitnessChoiceId) evidence.choiceId = selectedWitnessChoiceId;
        const advanced = advanceWitnessChronicle(witnessChronicleState, chronicle.id, stage.id, evidence);
        if (!advanced.ok) {
          fieldFeedback.textContent = advanced.reason;
          return;
        }
        if (!commitStateChanges('Witness canonical battle evidence', [
          { id: 'witness', adapter: witnessAdapter, previousState: witnessChronicleState, nextState: advanced.state },
        ]).ok) return;
        witnessChronicleState = advanced.state;
        selectedWitnessChoiceId = null;
        render();
        fieldFeedback.textContent = `${chronicle.title}: the recorded ${stage.encounterId} victory satisfies this witness stage without a duplicate battle.`;
        return;
      }
      const parameters = new URLSearchParams({
        encounter: stage.encounterId,
        return: 'campaign.html',
        beat: beat.id,
        chronicle: chronicle.id,
        chronicleStage: stage.id,
      });
      if (selectedWitnessChoiceId) parameters.set('chronicleChoice', selectedWitnessChoiceId);
      if (!commitStateChanges('Witness battle handoff', [
        { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: fieldRuntimeState },
        { id: 'witness', adapter: witnessAdapter, previousState: witnessChronicleState, nextState: witnessChronicleState },
      ]).ok) return;
      window.location.href = `battle.html?${parameters.toString()}`;
      return;
    }
    const evidence = isChoiceStage ? { choiceId: selectedWitnessChoiceId } : {};
    const advanced = advanceWitnessChronicle(witnessChronicleState, chronicle.id, stage.id, evidence);
    if (!advanced.ok) {
      fieldFeedback.textContent = advanced.reason;
      return;
    }
    if (!commitStateChanges('Witness stage', [
      { id: 'witness', adapter: witnessAdapter, previousState: witnessChronicleState, nextState: advanced.state },
    ]).ok) return;
    witnessChronicleState = advanced.state;
    selectedWitnessChoiceId = null;
    render();
    fieldFeedback.textContent = advanced.progress.readyToComplete
      ? `${chronicle.title}: every finite stage is recorded; its one-time reward has been settled.`
      : `${chronicle.title}: stage recorded. Next: ${advanced.progress.currentStage.activity.instruction}`;
    return;
  }
  const marker = getActiveQuestMarker(level);
  if (marker && inInteractionRange(fieldPosition(), marker.position)) {
    if (marker.objective.type === 'battle-replay' && marker.objective.encounterId) {
      const parameters = new URLSearchParams({
        encounter: marker.objective.encounterId,
        return: 'campaign.html',
        beat: beat.id,
        quest: marker.quest.id,
        objective: marker.objective.id,
      });
      if (!commitStateChanges('Side-story battle handoff', [
        { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: fieldRuntimeState },
        { id: 'quest', adapter: questAdapter, previousState: questState, nextState: questState },
      ]).ok) return;
      window.location.href = `battle.html?${parameters.toString()}`;
      return;
    }
    const result = advanceQuestObjective(questState, marker.quest.id, marker.objective.id);
    if (!result.ok) {
      fieldFeedback.textContent = result.reason;
      return;
    }
    if (!commitStateChanges('Side-story objective', [
      { id: 'quest', adapter: questAdapter, previousState: questState, nextState: result.state },
    ]).ok) return;
    questState = result.state;
    pageAudio.playCue('fieldInteract');
    fieldFeedback.textContent = `Side-story objective complete: ${marker.objective.instruction}`;
    render();
    return;
  }
  const status = getFieldStatus(fieldRuntimeState, { flags: externalFieldFlags() });
  const nearby = selectNearbyFieldInteractable(status);
  if (nearby) {
    let result = performFieldInteraction(fieldRuntimeState, nearby.id, { flags: externalFieldFlags() });
    if (!result.ok && result.code === 'choice-required') {
      const chosen = window.prompt(`Choose for ${nearby.id}: ${result.choices.join(' / ')}`, result.choices[0]);
      if (chosen === null) return;
      try {
        result = performFieldInteraction(fieldRuntimeState, nearby.id, { flags: externalFieldFlags(), choice: chosen });
      } catch {
        fieldFeedback.textContent = `Choose exactly one of: ${result.choices.join(', ')}.`;
        return;
      }
    }
    if (!result.ok) {
      fieldFeedback.textContent = result.code === 'requirement-missing'
        ? `${nearby.id} requires ${result.blockedBy}.`
        : `Interaction unavailable: ${result.code}.`;
      return;
    }
    const event = result.events[0];
    let lootText = '';
    let nextLoadoutState = loadoutState;
    if (!result.repeated && event?.reward) {
      const loot = grantInventory(loadoutState, { items: [{ name: event.reward, quantity: 1 }] });
      if (loot.ok) {
        nextLoadoutState = loot.state;
        lootText = loot.receipt.unknown.length
          ? ` ${event.reward} is recorded as uncatalogued evidence.`
          : ` ${event.reward} was added to camp inventory.`;
      }
    }
    const changes = [
      { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: result.state },
      ...(nextLoadoutState !== loadoutState ? [
        { id: 'loadout', adapter: loadoutAdapter, previousState: loadoutState, nextState: nextLoadoutState },
      ] : []),
    ];
    if (!commitStateChanges('Field interaction', changes).ok) return;
    fieldRuntimeState = result.state;
    loadoutState = nextLoadoutState;
    pageAudio.playCue('fieldInteract');
    fieldFeedback.textContent = result.repeated
      ? `${nearby.id} was already completed.${event?.text ? ` ${event.text}` : ''}`
      : `${nearby.id}: ${event?.text ?? event?.result ?? event?.reward ?? `${event?.action ?? 'interaction'} complete`}.${lootText}`;
    updateFieldDashboard(level);
    return;
  }
  if (status.exit) {
    if (fieldRuntimeState.current.beatId === beat.id && !currentSceneOperationComplete(beat)) {
      fieldFeedback.textContent = 'This route remains open, but the ordered scene operation must be completed before leaving its story field.';
      return;
    }
    const result = useFieldExit(fieldRuntimeState, status.exit.id, {
      flags: externalFieldFlags(),
      enterDestination: true,
      destinationBeatId: beat.id,
    });
    if (!result.ok) {
      fieldFeedback.textContent = `Exit locked: ${result.condition ?? status.exit.condition ?? 'route objective incomplete'}.`;
      return;
    }
    const transitionResult = moveCampaignThroughExit(result.transition, result.state);
    if (!transitionResult.ok) return;
    if (!transitionResult.storyAdvanced) {
      fieldFeedback.textContent = `Entered ${getLevel(result.transition.destinationLevelId)?.name ?? result.transition.destinationLevelId}. The current story beat continues across this route.`;
    }
    return;
  }
  fieldFeedback.textContent = 'No interaction is within the marked one-space range.';
});

previousScene.addEventListener('click', () => advance(-1));
nextScene.addEventListener('click', () => advance(1));
resetCampaign.addEventListener('click', () => {
  if (!window.confirm('Start a clean New Game? This clears story, scene operations, battles, quests, companion conversations, party councils, public archive readings, camp inventory, field positions, playtime, and the prior run receipt.')) return;
  const nextCampaignState = resetCampaignState();
  const pristineAdvancementState = createAdvancementState();
  const nextAdvancementState = unlockPartyMembers(pristineAdvancementState, getCurrentChapter(nextCampaignState).party);
  const nextQuestState = createQuestState();
  const nextNarrativeState = createNarrativeState();
  const nextWitnessState = createWitnessChronicleState();
  const nextSceneOperationState = createSceneOperationState();
  const nextLoadoutState = createLoadoutState();
  const nextPlaytimeState = createPlaytimeState();
  const level = getLevelForBeat(getCurrentChapter(nextCampaignState), getCurrentBeat(nextCampaignState));
  const nextFieldState = createPersistentFieldState({ levelId: level.id, beatId: getCurrentBeat(nextCampaignState).id });
  const receipt = createRunReceipt({
    runId: createBrowserRunUuid(),
    campaignState: nextCampaignState,
    advancementState: pristineAdvancementState,
  });
  if (!receipt.ok) {
    fieldFeedback.textContent = 'The verified run receipt could not be created; the current game was left intact.';
    return;
  }
  const resetPersisted = commitStateChanges('New Game', [
    { id: 'campaign', adapter: saveAdapter, previousState: campaignState, nextState: nextCampaignState },
    { id: 'advancement', adapter: advancementAdapter, previousState: advancementState, nextState: nextAdvancementState },
    { id: 'quest', adapter: questAdapter, previousState: questState, nextState: nextQuestState },
    { id: 'narrative', adapter: narrativeAdapter, previousState: narrativeState, nextState: nextNarrativeState },
    { id: 'witness', adapter: witnessAdapter, previousState: witnessChronicleState, nextState: nextWitnessState },
    { id: 'scene-operation', adapter: sceneOperationAdapter, previousState: sceneOperationState, nextState: nextSceneOperationState },
    { id: 'field', adapter: fieldAdapter, previousState: fieldRuntimeState, nextState: nextFieldState },
    { id: 'loadout', adapter: loadoutAdapter, previousState: loadoutState, nextState: nextLoadoutState },
    { id: 'playtime', adapter: playtimeAdapter, previousState: playtimeState, nextState: nextPlaytimeState },
    { id: 'run-receipt', adapter: runReceiptAdapter, previousState: runReceiptState, nextState: receipt.state },
  ]);
  if (!resetPersisted.ok) return;
  campaignState = nextCampaignState;
  advancementState = nextAdvancementState;
  runReceiptState = receipt.state;
  clearPendingRunReceiptPlaytime();
  questState = nextQuestState;
  narrativeState = nextNarrativeState;
  witnessChronicleState = nextWitnessState;
  sceneOperationState = nextSceneOperationState;
  selectedWitnessChronicleId = null;
  selectedWitnessChoiceId = null;
  loadoutState = nextLoadoutState;
  playtimeState = nextPlaytimeState;
  fieldRuntimeState = nextFieldState;
  campConversationAdapter.clear();
  partyCouncilAdapter.clear();
  archiveRecordAdapter.clear();
  campConversationState = createCampConversationState(receipt.state.runId);
  partyCouncilState = createPartyCouncilState(receipt.state.runId);
  archiveRecordState = createArchiveRecordState(receipt.state.runId);
  playtimeLastSample = performance.now();
  playtimeLastActivity = playtimeLastSample;
  playtimeUnsavedMs = 0;
  playtimeCategory = 'narrative';
  render();
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof Element && event.target.closest('button, a')) return;
  if (event.repeat) return;
  const direction = {
    w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0],
    q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1],
  }[event.key.toLowerCase()];
  if (direction) {
    event.preventDefault();
    attemptFieldMove(...direction);
    return;
  }
  if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    continueDialogue.click();
    return;
  }
  if ((event.key.toLowerCase() === 'x' || event.key === 'Enter') && !event.repeat) {
    event.preventDefault();
    interactFieldButton.click();
    return;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    advance(-1);
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    advance(1);
  }
  const choiceNumber = Number(event.key);
  if (choiceNumber > 0 && choiceNumber <= (getBeat().choices ?? []).length) {
    choose(getBeat().choices[choiceNumber - 1].id);
  }
});

function persistRecoveryAuthorities() {
  sampleCampaignPlaytime(performance.now());
  const flushed = flushRunReceiptPlaytime();
  if (!flushed.ok || !runReceiptState) {
    return { ok: false, reason: 'A valid clean-run receipt is required before exporting recovery.' };
  }
  const saves = [
    saveAdapter.save(campaignState),
    advancementAdapter.save(advancementState),
    playtimeAdapter.save(playtimeState),
    runReceiptAdapter.save(runReceiptState),
    questAdapter.save(questState),
    narrativeAdapter.save(narrativeState),
    witnessAdapter.save(witnessChronicleState),
    sceneOperationAdapter.save(sceneOperationState),
    fieldAdapter.save(fieldRuntimeState),
    loadoutAdapter.save(loadoutState),
    campConversationAdapter.save(campConversationState),
    partyCouncilAdapter.save(partyCouncilState),
    archiveRecordAdapter.save(archiveRecordState),
  ];
  const failed = saves.find((entry) => !entry?.ok);
  return failed
    ? { ok: false, reason: failed.reason ?? failed.code ?? 'One recovery authority could not be saved.' }
    : { ok: true };
}

function downloadRecoveryCheckpoint(checkpoint) {
  const blob = new Blob([serializeRecoveryCheckpoint(checkpoint)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `bells-recovery-${checkpoint.summary.runId}-${checkpoint.createdAtEpochMs}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

exportRecovery.addEventListener('click', () => {
  recoveryStatus.dataset.state = '';
  const persisted = persistRecoveryAuthorities();
  if (!persisted.ok) {
    recoveryStatus.dataset.state = 'error';
    recoveryStatus.textContent = persisted.reason;
    return;
  }
  const created = createRecoveryCheckpoint(globalThis.localStorage);
  if (!created.ok) {
    recoveryStatus.dataset.state = 'error';
    recoveryStatus.textContent = `Recovery export refused: ${created.errors.join(' ')}`;
    return;
  }
  downloadRecoveryCheckpoint(created.checkpoint);
  recoveryStatus.dataset.state = 'ready';
  recoveryStatus.textContent = `Recovery-only checkpoint exported for run ${created.checkpoint.summary.runId.slice(0, 8)} at ${formatPlaytime(created.checkpoint.summary.activePlaytimeMs)}. It is not playtest proof.`;
});

importRecovery.addEventListener('click', () => {
  recoveryFile.value = '';
  recoveryFile.click();
});

recoveryFile.addEventListener('change', async () => {
  const file = recoveryFile.files?.[0];
  if (!file) return;
  let serialized;
  try {
    serialized = await file.text();
  } catch {
    recoveryStatus.dataset.state = 'error';
    recoveryStatus.textContent = 'Recovery file could not be read.';
    return;
  }
  const validation = validateRecoveryCheckpoint(serialized);
  if (!validation.ok) {
    recoveryStatus.dataset.state = 'error';
    recoveryStatus.textContent = `Recovery restore refused before writing: ${validation.errors.join(' ')}`;
    return;
  }
  const { summary } = validation.checkpoint;
  const confirmed = window.confirm(
    `Restore the complete recovery-only checkpoint for run ${summary.runId.slice(0, 8)}?\n\n`
      + `${summary.completedBeatCount}/60 scenes · ${summary.routeCompletedActivityCount}/${summary.routeRequiredActivityCount} route activities · ${formatPlaytime(summary.activePlaytimeMs)} active play.\n\n`
      + 'This replaces all thirteen current save records. Close other game tabs first. This is recovery, not independent playtest proof.',
  );
  if (!confirmed) return;
  recoveryReloadPending = true;
  const restored = restoreRecoveryCheckpoint(globalThis.localStorage, validation.checkpoint);
  if (!restored.ok) {
    recoveryReloadPending = false;
    recoveryStatus.dataset.state = 'error';
    recoveryStatus.textContent = `Recovery restore failed; rollback ${restored.rollbackComplete ? 'completed' : 'was incomplete'}: ${restored.errors.join(' ')}`;
    return;
  }
  recoveryStatus.dataset.state = 'ready';
  recoveryStatus.textContent = 'All thirteen save records restored exactly. Reloading the recovered run…';
  window.location.reload();
});

function animate(now) {
  sampleCampaignPlaytime(now);
  sampleFieldRuntime(now);
  animationNow = now;
  const chapter = getChapter();
  const level = getActiveLevelForBeat(chapter, getBeat());
  const encounter = getBeatEncounterState().selected ?? getEncounterForChapter(chapter.id) ?? ENCOUNTERS[0];
  drawMap(level, encounter, now);
  requestAnimationFrame(animate);
}

document.title = `${CAMPAIGN.title} — Campaign Atlas`;
render();
requestAnimationFrame(animate);

window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  const refreshed = advancementAdapter.load();
  if (refreshed.ok) advancementState = refreshed.state;
  const refreshedQuests = questAdapter.load();
  if (refreshedQuests.ok) questState = refreshedQuests.state;
  const refreshedNarrative = narrativeAdapter.load();
  if (refreshedNarrative.ok) narrativeState = refreshedNarrative.state;
  const refreshedWitnessChronicles = witnessAdapter.load();
  if (refreshedWitnessChronicles.ok) witnessChronicleState = refreshedWitnessChronicles.state;
  const refreshedSceneOperations = sceneOperationAdapter.load();
  if (refreshedSceneOperations.ok) sceneOperationState = refreshedSceneOperations.state;
  const refreshedField = fieldAdapter.load();
  if (refreshedField.ok && refreshedField.found) fieldRuntimeState = refreshedField.state;
  const refreshedLoadout = loadoutAdapter.load();
  if (refreshedLoadout.ok) loadoutState = refreshedLoadout.value;
  const refreshedPlaytime = playtimeAdapter.load();
  if (refreshedPlaytime.ok) playtimeState = refreshedPlaytime.state;
  const refreshedRunReceipt = runReceiptAdapter.load();
  runReceiptState = refreshedRunReceipt.ok && refreshedRunReceipt.found ? refreshedRunReceipt.state : null;
  const refreshedCampConversations = campConversationAdapter.load();
  if (refreshedCampConversations.ok) campConversationState = refreshedCampConversations.state;
  const refreshedPartyCouncils = partyCouncilAdapter.load();
  if (refreshedPartyCouncils.ok) partyCouncilState = refreshedPartyCouncils.state;
  const refreshedArchiveRecords = archiveRecordAdapter.load();
  if (refreshedArchiveRecords.ok) archiveRecordState = refreshedArchiveRecords.state;
  clearPendingRunReceiptPlaytime();
  playtimeLastSample = performance.now();
  playtimeLastActivity = playtimeLastSample;
  fieldTickLast = playtimeLastSample;
  fieldTickAccumulator = 0;
  render();
});

window.addEventListener('pagehide', () => {
  if (recoveryReloadPending) return;
  flushRunReceiptPlaytime();
  playtimeAdapter.save(playtimeState);
  if (runReceiptState) runReceiptAdapter.save(runReceiptState);
  narrativeAdapter.save(narrativeState);
  witnessAdapter.save(witnessChronicleState);
  sceneOperationAdapter.save(sceneOperationState);
  fieldAdapter.save(fieldRuntimeState);
});
document.addEventListener('visibilitychange', () => {
  playtimeLastSample = performance.now();
  fieldTickLast = performance.now();
  if (document.visibilityState === 'hidden') {
    if (recoveryReloadPending) return;
    flushRunReceiptPlaytime();
    playtimeAdapter.save(playtimeState);
    if (runReceiptState) runReceiptAdapter.save(runReceiptState);
    narrativeAdapter.save(narrativeState);
    witnessAdapter.save(witnessChronicleState);
    sceneOperationAdapter.save(sceneOperationState);
    fieldAdapter.save(fieldRuntimeState);
  }
});
window.addEventListener('pointerdown', () => { playtimeLastActivity = performance.now(); }, { passive: true });
window.addEventListener('keydown', () => { playtimeLastActivity = performance.now(); }, { passive: true });
