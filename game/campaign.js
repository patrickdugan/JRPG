import { CAMPAIGN, getAllChapters } from './content/campaign.mjs';
import { LEVELS, TERRAIN_TAGS, getLevel, getLevelForChapter } from './content/levels.mjs';
import { ENCOUNTERS, getEncounter, getEncounterForChapter } from './content/encounters.mjs';
import { ALL_OPTIONAL_QUESTS, getOptionalQuestsForChapter } from './content/sidequests.mjs';
import { getSceneDirection } from './content/scene-direction.mjs';
import {
  createAdvancementState,
  createAdvancementStorageAdapter,
  grantRewardBundle,
  getAdvancementSummary,
  getEncounterWinCount,
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

const chapters = getAllChapters();
const allBeatRecords = chapters.flatMap((chapter) => chapter.beats.map((beat) => ({ chapterId: chapter.id, beat })));
const saveAdapter = createLocalStorageAdapter();
const loadedSave = saveAdapter.load();
let campaignState = loadedSave.ok ? loadedSave.state : createCampaignState();
const advancementAdapter = createAdvancementStorageAdapter();
const loadedAdvancement = advancementAdapter.load();
let advancementState = loadedAdvancement.ok ? loadedAdvancement.state : createAdvancementState();
const playtimeAdapter = createPlaytimeStorageAdapter();
const loadedPlaytime = playtimeAdapter.load();
let playtimeState = loadedPlaytime.ok ? loadedPlaytime.state : createPlaytimeState();
const runReceiptAdapter = createRunReceiptStorageAdapter();
const loadedRunReceipt = runReceiptAdapter.load();
let runReceiptState = loadedRunReceipt.ok && loadedRunReceipt.found ? loadedRunReceipt.state : null;
const questAdapter = createQuestStorageAdapter();
const loadedQuests = questAdapter.load();
let questState = loadedQuests.ok ? loadedQuests.state : createQuestState();
const narrativeAdapter = createNarrativeStorageAdapter();
const loadedNarrative = narrativeAdapter.load();
let narrativeState = loadedNarrative.ok ? loadedNarrative.state : createNarrativeState();
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

function persistCampaignState() {
  saveAdapter.save(campaignState);
}

function questContext() {
  return { campaignState, advancementState };
}

function settleReadyQuests() {
  let changed = false;
  const completedTitles = [];
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
    questState = result.state;
    advancementState = nextAdvancementState;
    loadoutState = nextLoadoutState;
    advancementAdapter.save(advancementState);
    loadoutAdapter.save(loadoutState);
    changed = true;
    completedTitles.push(quest.title);
  }
  if (changed) questAdapter.save(questState);
  return completedTitles;
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
    return false;
  }
  if (runReceiptPendingMs === 0) return false;
  const result = recordRunPlaytime(
    runReceiptState,
    runReceiptState.runId,
    runReceiptPendingCategory,
    runReceiptPendingMs,
    { chapterId: runReceiptPendingChapterId },
  );
  if (!result.ok) return false;
  runReceiptState = result.state;
  clearPendingRunReceiptPlaytime();
  runReceiptAdapter.save(runReceiptState);
  return true;
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
  fieldRuntimeState = result.state;
  const important = result.events.find((event) => event.type === 'hazard-hit' || event.type === 'hazard-warning');
  if (important?.type === 'hazard-hit') {
    const consequence = applyFieldHazardConsequence(important);
    fieldFeedback.textContent = `Hazard ${important.hazardId} triggered${consequence ? `; ${consequence}` : ''}. The last safe tile is preserved.`;
  }
  else if (important?.cue) fieldFeedback.textContent = important.cue;
  if (fieldRuntimeState.revision % 20 === 0) fieldAdapter.save(fieldRuntimeState);
}

function applyFieldHazardConsequence(event) {
  const effect = event.effect ?? {};
  const leaderId = getChapter().party?.[0] ?? 'ren';
  const vitals = loadoutState.vitals?.[leaderId];
  if (!vitals) return '';
  const patch = {};
  if (effect.type === 'fieldDamage' || effect.type === 'damage' || effect.type === 'physicalDamage') {
    const percent = effect.percentMaxHp ?? 10;
    const minimum = effect.minimumHp ?? 1;
    patch.hp = Math.max(minimum, vitals.hp - Math.ceil(vitals.maxHp * (percent / 100)));
  }
  if (effect.status) patch.statuses = [...new Set([...vitals.statuses, effect.status])];
  if (!Object.keys(patch).length) return '';
  const result = setMemberVitals(loadoutState, leaderId, patch);
  if (!result.ok) return '';
  loadoutState = result.state;
  loadoutAdapter.save(loadoutState);
  const hpLoss = vitals.hp - loadoutState.vitals[leaderId].hp;
  return `${CAMPAIGN.cast?.[leaderId]?.name ?? leaderId} loses ${hpLoss} HP${effect.status ? ` and gains ${effect.status}` : ''}`;
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
  if (current?.beatId === beat.id) {
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

function inInteractionRange(left, right) {
  return left && right && Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y)) <= 1;
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
  return [
    ...Object.keys(campaignState.flags ?? {}),
    ...(advancementState.inventory?.keyItems ?? []),
    ...encounterFlags,
    ...questFlags,
  ];
}

function fieldPosition() {
  return getCurrentFieldContext(fieldRuntimeState).position;
}

function ensureFieldPosition(level) {
  const beatId = getBeat().id;
  const current = fieldRuntimeState.current;
  const changed = current.levelId !== level.id || current.beatId !== beatId;
  const next = enterField(fieldRuntimeState, level.id, beatId, { flags: externalFieldFlags() });
  if (next !== fieldRuntimeState) {
    fieldRuntimeState = next;
    fieldAdapter.save(fieldRuntimeState);
  }
  return changed;
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
  fieldAdapter.save(fieldRuntimeState);
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
  ensureFieldPosition(level);
  const result = moveFieldBy(fieldRuntimeState, dx, dy, { flags: externalFieldFlags() });
  fieldRuntimeState = result.state;
  if (result.moved) fieldWalkUntil = performance.now() + 320;
  fieldAdapter.save(fieldRuntimeState);
  fieldFeedback.textContent = fieldEventMessage(level, result);
  for (const event of result.events.filter((entry) => entry.type === 'hazard-hit')) {
    const consequence = applyFieldHazardConsequence(event);
    if (consequence) fieldFeedback.textContent += ` ${consequence}.`;
  }
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
  ensureFieldPosition(level);
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
  mapLegend.textContent = terrainTags.length ? terrainTags.join(' · ') : 'Tactical preview';
}

function formatEnemies(enemies = []) {
  if (!enemies.length) return 'Story encounter / no enemy roster assigned.';
  return enemies.map((enemy) => enemy.name ?? enemy.id ?? 'Unknown threat').join(', ');
}

function dialogueLinesForBeat(beat = getBeat()) {
  const source = Array.isArray(beat.text) && beat.text.length
    ? beat.text
    : [{ speaker: 'NARRATOR', line: String(beat.text ?? 'Scene text pending.') }];
  return source.map((entry) => Object.freeze({
    speaker: String(entry.speaker ?? 'NARRATOR'),
    line: String(entry.line ?? entry.text ?? ''),
  }));
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

function updateFieldDashboard(level) {
  const status = getFieldStatus(fieldRuntimeState, { flags: externalFieldFlags() });
  const marker = getActiveQuestMarker(level);
  const markerNearby = marker && inInteractionRange(status.position, marker.position);
  const authored = status.nearbyInteractables.find((item) => !item.consumed) ?? status.nearbyInteractables[0] ?? null;
  fieldObjective.textContent = status.objective.text ?? level.objective ?? 'Explore the scene and follow its marked exit.';
  const requirements = status.objective.requirements.length
    ? status.objective.requirements.map((item) => `${item.complete ? '✓' : '○'} ${item.label}`).join(' · ')
    : `${(level.interactables ?? []).length} authored interactions`;
  fieldProgress.textContent = marker
    ? `Side story: ${marker.quest.title} · ${marker.objective.instruction}`
    : `${status.objective.completedCount}/${status.objective.totalCount} route requirements · ${requirements}`;
  interactFieldButton.disabled = !markerNearby && !authored && !status.exit;
  interactFieldButton.textContent = markerNearby
    ? 'Advance side story (X)'
    : authored ? `${authored.consumed ? 'Review' : 'Interact'}: ${authored.id} (X)`
      : status.exit ? `${status.exit.ready ? 'Use' : 'Inspect'} exit (X)` : 'Nothing nearby (X)';
}

function moveCampaignThroughExit(transition) {
  const currentIndex = allBeatRecords.findIndex((record) => record.beat.id === getBeat().id);
  const targetIndex = allBeatRecords.findIndex((record, index) => index > currentIndex
    && getLevelForBeat(chapters.find((chapter) => chapter.id === record.chapterId), record.beat).id === transition.destinationLevelId);
  if (targetIndex === currentIndex + 1 && currentBeatBattlesCleared()) {
    fieldRuntimeState = grantFieldFlags(fieldRuntimeState, fieldRouteFlag());
    fieldAdapter.save(fieldRuntimeState);
    advance(1);
    return true;
  }
  const target = targetIndex >= 0 ? allBeatRecords[targetIndex] : null;
  if (target && getUnlockedBeatIds(campaignState).includes(target.beat.id)) {
    campaignState = moveToBeat(campaignState, target.chapterId, target.beat.id);
    persistCampaignState();
    render();
    return true;
  }
  return false;
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
  battleStatus.textContent = `${clearedHere}/${encounters.length} scene encounters cleared · ${winCount} wins here · ${summary.speedMultiplier}× battle speed`;
}

function render() {
  const newlyCompletedQuests = settleReadyQuests();
  const chapter = getChapter();
  const beat = getBeat();
  const level = getActiveLevelForBeat(chapter, beat);
  const enteredNewLevel = ensureFieldPosition(level);
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
  const battlesCleared = currentBeatBattlesCleared();
  const fieldRouteCleared = currentFieldRouteComplete();
  const narrativeCleared = currentNarrativeComplete(beat);
  const choicesCleared = currentChoicesComplete(beat);
  nextScene.disabled = isCampaignComplete(campaignState) || !battlesCleared || !fieldRouteCleared || !narrativeCleared || !choicesCleared;
  nextScene.textContent = isCampaignComplete(campaignState)
    ? 'Campaign complete'
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
  renderChapterList();
  renderBattleLaunch(beat, beatBattleState);
  fieldFeedback.textContent = newlyCompletedQuests.length
    ? `Side story complete: ${newlyCompletedQuests.join(', ')}. Rewards recorded in the regional journal.`
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
  campaignState = isMultiSelectBeat(beat)
    ? appendChoice(campaignState, choice.id)
    : selectChoice(campaignState, choice.id);
  persistCampaignState();
  render();
}

function advance(direction) {
  playtimeCategory = 'narrative';
  const currentIndex = allBeatRecords.findIndex((record) => record.beat.id === getBeat().id);
  if (direction < 0) {
    if (currentIndex <= 0) return;
    const previous = allBeatRecords[currentIndex - 1];
    campaignState = moveToBeat(campaignState, previous.chapterId, previous.beat.id);
    persistCampaignState();
    render();
    return;
  }
  if (isCampaignComplete(campaignState)) return;
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
  const completedBeatId = getBeat().id;
  const completedCount = campaignState.completedBeatIds.length;
  flushRunReceiptPlaytime();
  campaignState = completeCurrentBeat(campaignState);
  if (campaignState.completedBeatIds.length > completedCount && runReceiptState) {
    const receiptResult = recordRunBeatCompletion(runReceiptState, runReceiptState.runId, completedBeatId);
    if (receiptResult.ok) {
      runReceiptState = receiptResult.state;
      runReceiptAdapter.save(runReceiptState);
    }
  }
  persistCampaignState();
  render();
}

chapterList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-chapter-id]');
  if (!button) return;
  const chapter = chapters.find((entry) => entry.id === button.dataset.chapterId);
  const unlocked = new Set(getUnlockedBeatIds(campaignState));
  const target = chapter?.beats.filter((beat) => unlocked.has(beat.id)).at(-1);
  if (!chapter || !target) return;
  playtimeCategory = 'narrative';
  campaignState = moveToBeat(campaignState, chapter.id, target.id);
  const storyLevel = getLevelForBeat(chapter, target);
  fieldRuntimeState = enterField(fieldRuntimeState, storyLevel.id, target.id, { flags: externalFieldFlags() });
  persistCampaignState();
  fieldAdapter.save(fieldRuntimeState);
  render();
});

choiceDeck.addEventListener('click', (event) => {
  const button = event.target.closest('[data-choice-id]');
  if (button) choose(button.dataset.choiceId);
});

continueDialogue.addEventListener('click', () => {
  playtimeCategory = 'narrative';
  const beat = getBeat();
  const result = advanceNarrative(narrativeState, beat.id, dialogueLinesForBeat(beat).length);
  narrativeState = result.state;
  narrativeAdapter.save(narrativeState);
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
    fieldRuntimeState = enterField(fieldRuntimeState, destination.id, getBeat().id, { flags: externalFieldFlags() });
    fieldAdapter.save(fieldRuntimeState);
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
  questState = result.state;
  questAdapter.save(questState);
  fieldFeedback.textContent = `Side story accepted: ${result.progress.quest.title}. ${result.progress.currentObjective?.instruction ?? ''}`;
  renderQuestJournal(getChapter());
});

returnStoryRoute.addEventListener('click', () => {
  playtimeCategory = 'exploration';
  const chapter = getChapter();
  const beat = getBeat();
  const destination = getLevelForBeat(chapter, beat);
  fieldRuntimeState = enterField(fieldRuntimeState, destination.id, beat.id, { flags: externalFieldFlags() });
  fieldAdapter.save(fieldRuntimeState);
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
  ensureFieldPosition(level);
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
      window.location.href = `battle.html?${parameters.toString()}`;
      return;
    }
    const result = advanceQuestObjective(questState, marker.quest.id, marker.objective.id);
    if (!result.ok) {
      fieldFeedback.textContent = result.reason;
      return;
    }
    questState = result.state;
    questAdapter.save(questState);
    fieldFeedback.textContent = `Side-story objective complete: ${marker.objective.instruction}`;
    render();
    return;
  }
  const status = getFieldStatus(fieldRuntimeState, { flags: externalFieldFlags() });
  const nearby = status.nearbyInteractables.find((item) => !item.consumed) ?? status.nearbyInteractables[0];
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
    fieldRuntimeState = result.state;
    fieldAdapter.save(fieldRuntimeState);
    const event = result.events[0];
    let lootText = '';
    if (!result.repeated && event?.reward) {
      const loot = grantInventory(loadoutState, { items: [{ name: event.reward, quantity: 1 }] });
      if (loot.ok) {
        loadoutState = loot.state;
        loadoutAdapter.save(loadoutState);
        lootText = loot.receipt.unknown.length
          ? ` ${event.reward} is recorded as uncatalogued evidence.`
          : ` ${event.reward} was added to camp inventory.`;
      }
    }
    fieldFeedback.textContent = result.repeated
      ? `${nearby.id} was already completed.${event?.text ? ` ${event.text}` : ''}`
      : `${nearby.id}: ${event?.text ?? event?.result ?? event?.reward ?? `${event?.action ?? 'interaction'} complete`}.${lootText}`;
    updateFieldDashboard(level);
    return;
  }
  if (status.exit) {
    const result = useFieldExit(fieldRuntimeState, status.exit.id, {
      flags: externalFieldFlags(),
      enterDestination: true,
      destinationBeatId: beat.id,
    });
    if (!result.ok) {
      fieldFeedback.textContent = `Exit locked: ${result.condition ?? status.exit.condition ?? 'route objective incomplete'}.`;
      return;
    }
    fieldRuntimeState = result.state;
    fieldAdapter.save(fieldRuntimeState);
    if (!moveCampaignThroughExit(result.transition)) {
      render();
      fieldFeedback.textContent = `Entered ${getLevel(result.transition.destinationLevelId)?.name ?? result.transition.destinationLevelId}. The current story beat continues across this route.`;
    }
    return;
  }
  fieldFeedback.textContent = 'No interaction is within the marked one-space range.';
});

previousScene.addEventListener('click', () => advance(-1));
nextScene.addEventListener('click', () => advance(1));
resetCampaign.addEventListener('click', () => {
  if (!window.confirm('Start a clean New Game? This clears story, battles, quests, camp inventory, field positions, playtime, and the prior run receipt.')) return;
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    fieldFeedback.textContent = 'A verified New Game requires crypto.randomUUID support in this browser.';
    return;
  }
  const nextCampaignState = resetCampaignState();
  const nextAdvancementState = createAdvancementState();
  const receipt = createRunReceipt({
    runId: globalThis.crypto.randomUUID(),
    campaignState: nextCampaignState,
    advancementState: nextAdvancementState,
  });
  if (!receipt.ok || !runReceiptAdapter.save(receipt.state).ok) {
    fieldFeedback.textContent = 'The verified run receipt could not be created; the current game was left intact.';
    return;
  }
  campaignState = nextCampaignState;
  advancementState = nextAdvancementState;
  runReceiptState = receipt.state;
  clearPendingRunReceiptPlaytime();
  questState = createQuestState();
  narrativeState = createNarrativeState();
  loadoutState = createLoadoutState();
  playtimeState = createPlaytimeState();
  const level = getLevelForBeat(getCurrentChapter(campaignState), getCurrentBeat(campaignState));
  fieldRuntimeState = createPersistentFieldState({ levelId: level.id, beatId: getCurrentBeat(campaignState).id });
  saveAdapter.clear();
  advancementAdapter.clear();
  questAdapter.clear();
  narrativeAdapter.clear();
  fieldAdapter.clear();
  loadoutAdapter.clear();
  playtimeAdapter.clear();
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
  const refreshedField = fieldAdapter.load();
  if (refreshedField.ok && refreshedField.found) fieldRuntimeState = refreshedField.state;
  const refreshedLoadout = loadoutAdapter.load();
  if (refreshedLoadout.ok) loadoutState = refreshedLoadout.value;
  const refreshedPlaytime = playtimeAdapter.load();
  if (refreshedPlaytime.ok) playtimeState = refreshedPlaytime.state;
  const refreshedRunReceipt = runReceiptAdapter.load();
  runReceiptState = refreshedRunReceipt.ok && refreshedRunReceipt.found ? refreshedRunReceipt.state : null;
  clearPendingRunReceiptPlaytime();
  playtimeLastSample = performance.now();
  playtimeLastActivity = playtimeLastSample;
  fieldTickLast = playtimeLastSample;
  fieldTickAccumulator = 0;
  render();
});

window.addEventListener('pagehide', () => {
  flushRunReceiptPlaytime();
  playtimeAdapter.save(playtimeState);
  if (runReceiptState) runReceiptAdapter.save(runReceiptState);
  narrativeAdapter.save(narrativeState);
  fieldAdapter.save(fieldRuntimeState);
});
document.addEventListener('visibilitychange', () => {
  playtimeLastSample = performance.now();
  fieldTickLast = performance.now();
  if (document.visibilityState === 'hidden') {
    flushRunReceiptPlaytime();
    playtimeAdapter.save(playtimeState);
    if (runReceiptState) runReceiptAdapter.save(runReceiptState);
    narrativeAdapter.save(narrativeState);
    fieldAdapter.save(fieldRuntimeState);
  }
});
window.addEventListener('pointerdown', () => { playtimeLastActivity = performance.now(); }, { passive: true });
window.addEventListener('keydown', () => { playtimeLastActivity = performance.now(); }, { passive: true });
