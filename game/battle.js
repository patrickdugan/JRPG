import { getEncounter, ENCOUNTERS } from './content/encounters.mjs';
import {
  CAMPAIGN_COMBAT_PHASES,
  COMBAT_STATUS_DEFINITIONS,
  PARTY_PROFILES,
  CampaignCombatEngine,
  canMoveEightWay,
} from './campaign-combat.mjs';
import {
  createAdvancementState,
  createAdvancementStorageAdapter,
  getEncounterRewardPreview,
  getEncounterWinCount,
  getParty,
  getPartyMember,
  preparePartyForEncounter,
  recordEncounterWin,
  setSpeedMultiplier,
} from './advancement.mjs';
import {
  createPlaytimeState,
  createPlaytimeStorageAdapter,
  getBattlePlaytimeCategory,
  isPlaytimeInactive,
  recordPlaytime,
} from './playtime.mjs';
import {
  advanceQuestObjective,
  createQuestStorageAdapter,
  getQuestProgress,
} from './quest-runtime.mjs';
import {
  createFieldStorageAdapter,
  resolveFieldEncounter,
} from './field-runtime.mjs';
import {
  applyLoadoutToPartyProfile,
  createLoadoutState,
  createLoadoutStorageAdapter,
  grantInventory,
  setMemberVitals,
  syncPartyVitals,
} from './loadout.mjs';
import {
  chooseRepeatBattleCommand,
  getRepeatStepDelayMs,
  resolveBattlePresentationSpeed,
} from './repeat-battle.mjs';
import {
  cancelRepeatGrindQueue,
  createRepeatGrindQueue,
  recordRepeatGrindVictory,
  startRepeatGrindQueue,
} from './repeat-grind-queue.mjs';
import {
  createRunReceiptStorageAdapter,
  recordRunFirstClear,
  recordRunPlaytime,
} from './run-receipt.mjs';
import {
  PARTY_ATLAS,
  atlasDirectionForMovement,
  getPartyAtlasFrame,
} from './sprite-atlas.mjs';
import {
  ENEMY_ATLAS,
  getEnemyAtlasFrame,
} from './enemy-atlas.mjs';
import {
  formatObjectiveRequirement,
  getObjectiveActionPresentation,
  getObjectiveTokenPlacements,
} from './objective-presentation.mjs';
import {
  canStartAutoGrindPresentation,
  createEnemyIntentSchedule,
  createEnemyFamilyTimeline,
  createPartySkillTimeline,
  getBattlePresentationElapsedMs,
  getBattlePresentationActors,
  getNextBattleActionAt,
  isBattlePresentationSettled,
  rescaleEnemyIntentSchedule,
  sampleBattleAnimation,
} from './battle-animation.mjs';
import {
  advanceWitnessChronicle,
  createWitnessChronicleStorageAdapter,
  getWitnessChronicleProgress,
} from './witness-chronicle-runtime.mjs';
import { commitPersistenceTransaction, stateSaveStep } from './persistence-transaction.mjs';

const encounterTitle = document.querySelector('#encounterTitle');
const encounterSubtitle = document.querySelector('#encounterSubtitle');
const canvas = document.querySelector('#battleCanvas');
const context = canvas.getContext('2d');
const partyPanel = document.querySelector('#partyPanel');
const enemyPanel = document.querySelector('#enemyPanel');
const tempoQueue = document.querySelector('#tempoQueue');
const battleClock = document.querySelector('#battleClock');
const roundLabel = document.querySelector('#roundLabel');
const phaseLabel = document.querySelector('#phaseLabel');
const commandButtons = [...document.querySelectorAll('[data-command]')];
const skillSelect = document.querySelector('#skillSelect');
const targetSelect = document.querySelector('#targetSelect');
const confirmCommand = document.querySelector('#confirmCommand');
const commandHint = document.querySelector('#commandHint');
const activeActorLabel = document.querySelector('#activeActorLabel');
const speedButtons = [...document.querySelectorAll('[data-speed]')];
const speedStatus = document.querySelector('#speedStatus');
const autoGrind = document.querySelector('#autoGrind');
const autoGrindWins = document.querySelector('#autoGrindWins');
const autoGrindStatus = document.querySelector('#autoGrindStatus');
const objectiveText = document.querySelector('#objectiveText');
const objectiveProgress = document.querySelector('#objectiveProgress');
const resultLog = document.querySelector('#resultLog');
const battleStateBadge = document.querySelector('#battleStateBadge');
const announcements = document.querySelector('#battleAnnouncements');
const restartBattle = document.querySelector('#restartBattle');
const campaignLink = document.querySelector('.campaign-link');
const continueCampaign = document.querySelector('#continueCampaign');

context.imageSmoothingEnabled = false;
const battlePartyAtlasImage = new Image();
battlePartyAtlasImage.src = PARTY_ATLAS.url;
const battleEnemyAtlasImage = new Image();
battleEnemyAtlasImage.src = ENEMY_ATLAS.url;

const query = new URLSearchParams(window.location.search);
const requestedEncounterId = query.get('encounter');
const encounter = getEncounter(requestedEncounterId) ?? ENCOUNTERS[0];
const requestedReturn = query.get('return');
const requestedQuestId = query.get('quest');
const requestedQuestObjectiveId = query.get('objective');
const requestedFieldTriggerId = query.get('fieldTrigger');
const requestedChronicleId = query.get('chronicle');
const requestedChronicleStageId = query.get('chronicleStage');
const requestedChronicleChoiceId = query.get('chronicleChoice');
if (requestedReturn && /^[a-z0-9._/?=&-]+$/i.test(requestedReturn)) {
  campaignLink.href = requestedReturn;
  continueCampaign.href = requestedReturn;
}

const advancementAdapter = createAdvancementStorageAdapter();
const advancementLoad = advancementAdapter.load();
let advancementState = advancementLoad.ok ? advancementLoad.state : createAdvancementState();
advancementState = preparePartyForEncounter(advancementState, encounter.id);
advancementAdapter.save(advancementState);
const encounterWinsAtLoad = getEncounterWinCount(advancementState, encounter.id);
const repeatBattleAtLoad = encounterWinsAtLoad > 0;
let speedMultiplier = resolveBattlePresentationSpeed(encounterWinsAtLoad, advancementState.speedMultiplier);
let battlePlaytimeCategory = getBattlePlaytimeCategory(getEncounterWinCount(advancementState, encounter.id));
const playtimeAdapter = createPlaytimeStorageAdapter();
const playtimeLoad = playtimeAdapter.load();
let playtimeState = playtimeLoad.ok ? playtimeLoad.state : createPlaytimeState();
let playtimeLastSample = performance.now();
let playtimeLastActivity = playtimeLastSample;
let playtimeUnsavedMs = 0;
const runReceiptAdapter = createRunReceiptStorageAdapter();
const runReceiptLoad = runReceiptAdapter.load();
let runReceiptState = runReceiptLoad.ok && runReceiptLoad.found ? runReceiptLoad.state : null;
let runReceiptPendingMs = 0;
let runReceiptPendingCategory = null;
const questAdapter = createQuestStorageAdapter();
const witnessAdapter = createWitnessChronicleStorageAdapter();
const fieldAdapter = createFieldStorageAdapter();
const loadoutAdapter = createLoadoutStorageAdapter();
const loadoutLoaded = loadoutAdapter.load();
let loadoutState = loadoutLoaded.ok ? loadoutLoaded.value : createLoadoutState();
const syncedLoadout = syncPartyVitals(loadoutState, getParty(advancementState));
if (syncedLoadout.ok) {
  loadoutState = syncedLoadout.state;
  loadoutAdapter.save(loadoutState);
}
let selectedCommand = 'attack';
let selectedTargetId = '';
let rewardRecorded = false;
let victoryPersistenceError = null;
let victorySaveRetryAt = 0;
let enemyIntentSchedule = null;
let autoGrindActive = false;
let autoActionAt = null;
let autoSettleAt = null;
let repeatGrindQueue = createRepeatGrindQueue();
let queuedVictoryRecorded = false;
const battleFacingByActor = new Map();
const battleMotionUntil = new Map();
const battleEnemyPoseByActor = new Map();
const battleEnemyPoseUntil = new Map();
let activeBattleAnimation = null;
let uiMessages = [`Loaded ${encounter.name}. ${encounter.objective.text}`];
let engine;

function combatProfiles() {
  const profiles = {};
  for (const memberId of encounter.party?.roster ?? ['ren']) {
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
    profiles[memberId] = { ...adapted, currentHp: loadoutState.vitals[memberId]?.hp ?? adapted.stats.hp };
  }
  return profiles;
}

function createEngine() {
  return new CampaignCombatEngine({ encounterId: encounter.id, partyProfiles: combatProfiles() });
}

function addMessage(message) {
  uiMessages.push(message);
  uiMessages = uiMessages.slice(-24);
  announcements.textContent = message;
}

function clearPendingRunReceiptPlaytime() {
  runReceiptPendingMs = 0;
  runReceiptPendingCategory = null;
}

function flushRunReceiptPlaytime() {
  if (!runReceiptState || runReceiptState.status !== 'active') {
    clearPendingRunReceiptPlaytime();
    return true;
  }
  if (runReceiptPendingMs === 0) return true;
  const result = recordRunPlaytime(
    runReceiptState,
    runReceiptState.runId,
    runReceiptPendingCategory,
    runReceiptPendingMs,
    { chapterId: encounter.chapterId },
  );
  if (!result.ok) return false;
  const saved = runReceiptAdapter.save(result.state);
  if (!saved.ok) return false;
  runReceiptState = result.state;
  clearPendingRunReceiptPlaytime();
  return true;
}

function queueRunReceiptPlaytime(category, elapsedMs) {
  if (!runReceiptState || runReceiptState.status !== 'active') {
    clearPendingRunReceiptPlaytime();
    return;
  }
  if (runReceiptPendingMs > 0 && category !== runReceiptPendingCategory) flushRunReceiptPlaytime();
  if (runReceiptPendingMs === 0) runReceiptPendingCategory = category;
  runReceiptPendingMs += elapsedMs;
  if (runReceiptPendingMs >= 1000) flushRunReceiptPlaytime();
}

function autoInputLocked() {
  return autoGrindActive || autoSettleAt !== null;
}

function battleAnimationActive(now = performance.now()) {
  return Boolean(activeBattleAnimation && now < activeBattleAnimation.endsAt);
}

function manualInputLocked(now = performance.now()) {
  return autoInputLocked() || battleAnimationActive(now);
}

function clearEnemyIntentSchedule() {
  enemyIntentSchedule = null;
}

function scheduleEnemyIntent(now = performance.now()) {
  enemyIntentSchedule = createEnemyIntentSchedule(now, speedMultiplier);
  return enemyIntentSchedule;
}

function startCombatAnimation(result, attackerId, beforeSnapshot = engine.snapshot()) {
  if (!result?.ok || !attackerId || !result.targetId || !result.skillId) return null;
  const attacker = beforeSnapshot.actors.find((actor) => actor.instanceId === attackerId);
  const target = beforeSnapshot.actors.find((actor) => actor.instanceId === result.targetId);
  if (!attacker || !target) return null;
  const speed = autoGrindActive ? speedMultiplier : 1;
  const sourceTile = attacker.pos;
  const targetTile = target.pos;
  const skill = attacker.skills?.find((candidate) => candidate.id === result.skillId) ?? {
    id: result.skillId,
    delivery: result.delivery,
    essence: result.essence,
    effect: result.statusApplied ? { status: result.statusId } : undefined,
  };
  const selfStatusId = skill.effect?.selfStatus ?? null;
  const afterAttacker = engine.snapshot().actors.find((actor) => actor.instanceId === attackerId);
  const selfStatusApplied = Boolean(selfStatusId && afterAttacker?.statuses?.some((status) => status.id === selfStatusId));
  const animationOptions = {
    sourceTile,
    targetTile,
    statusId: result.statusId ?? null,
    statusApplied: Boolean(result.statusApplied),
    selfStatusId,
    selfStatusApplied,
    speed,
  };
  const timeline = attacker.faction === 'party'
    ? createPartySkillTimeline(result.skillId, animationOptions)
    : createEnemyFamilyTimeline(attacker.templateId, { ...animationOptions, skill });
  const startedAt = performance.now();
  clearEnemyIntentSchedule();
  activeBattleAnimation = Object.freeze({
    attackerId,
    targetId: result.targetId,
    retainedActors: Object.freeze([attacker, target]),
    timeline,
    startedAt,
    endsAt: startedAt + timeline.durationMs,
  });
  return activeBattleAnimation;
}

function currentBattleAnimationFrame(now = performance.now()) {
  if (!activeBattleAnimation) return null;
  if (now >= activeBattleAnimation.endsAt) return null;
  return {
    ...activeBattleAnimation,
    frame: sampleBattleAnimation(activeBattleAnimation.timeline, now - activeBattleAnimation.startedAt),
  };
}

function markBattleMotion(actorId, dx, dy) {
  battleFacingByActor.set(actorId, atlasDirectionForMovement(dx, dy, battleFacingByActor.get(actorId) ?? 'north'));
  const presentationSpeed = autoGrindActive ? speedMultiplier : 1;
  battleMotionUntil.set(actorId, performance.now() + (320 / presentationSpeed));
}

function markEnemyPose(actorId, pose, durationMs = 360) {
  const presentationSpeed = autoGrindActive ? speedMultiplier : 1;
  battleEnemyPoseByActor.set(actorId, pose);
  battleEnemyPoseUntil.set(actorId, performance.now() + (durationMs / presentationSpeed));
}

function markCombatResolutionPose(result, attackerId = null) {
  if (!result?.ok) return;
  if (attackerId && (result.skillId || Number.isFinite(result.finalDamage))) markEnemyPose(attackerId, 'attack');
  if (result.targetId && result.finalDamage > 0) markEnemyPose(result.targetId, 'stagger');
}

function livingEnemies(snapshot = engine.snapshot()) {
  return snapshot.actors.filter((actor) => actor.faction === 'enemy' && actor.hp > 0 && actor.active !== false);
}

function activePartyActor(snapshot = engine.snapshot()) {
  const actor = snapshot.actors.find((entry) => entry.instanceId === snapshot.activeActorId);
  return actor?.faction === 'party' ? actor : null;
}

function formatClock(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function phaseName(snapshot) {
  if (snapshot.result === 'victory') return 'VICTORY';
  if (snapshot.result === 'defeat') return 'DEFEAT';
  return snapshot.phase === CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND ? 'PARTY COMMAND' : 'ENEMY INTENT';
}

function terrainColor(tag) {
  const colors = {
    'wet-stone': '#293a54', 'shallow-puddle': '#24556d', water: '#275e78',
    'storm-water': '#39758a', 'cold-pool': '#5b91a8', 'ash-field': '#4b4146',
    'ember-ash': '#7a4538', 'umbral-ash': '#3c3150', 'furnace-grate': '#743b2d',
    'archive-floor': '#55483f', 'high-gallery': '#141824', 'flowing-water': '#2d7692',
    'paper-litter': '#706957', 'bell-node': '#5c4d31', 'legal-seal': '#78333e',
  };
  return colors[tag] ?? '#202b42';
}

function mapGeometry() {
  const level = engine.level;
  const cell = Math.floor(Math.min(canvas.width / level.width, canvas.height / level.height));
  return {
    cell,
    originX: Math.floor((canvas.width - level.width * cell) / 2),
    originY: Math.floor((canvas.height - level.height * cell) / 2),
  };
}

function traceObjectiveMarker(marker, radius) {
  context.beginPath();
  if (marker === 'node') {
    context.moveTo(0, -radius); context.lineTo(radius, 0); context.lineTo(0, radius); context.lineTo(-radius, 0); context.closePath();
  } else if (marker === 'gate') {
    context.rect(-radius * 0.72, -radius, radius * 1.44, radius * 1.9);
    context.moveTo(0, -radius); context.lineTo(0, radius * 0.9);
  } else if (marker === 'shield') {
    context.moveTo(0, -radius); context.lineTo(radius * 0.78, -radius * 0.55); context.lineTo(radius * 0.58, radius * 0.55);
    context.lineTo(0, radius); context.lineTo(-radius * 0.58, radius * 0.55); context.lineTo(-radius * 0.78, -radius * 0.55); context.closePath();
  } else if (marker === 'anchor') {
    context.moveTo(0, -radius); context.lineTo(0, radius * 0.75); context.moveTo(-radius * 0.7, radius * 0.2);
    context.quadraticCurveTo(0, radius * 1.15, radius * 0.7, radius * 0.2);
  } else if (marker === 'water') {
    context.moveTo(-radius, -radius * 0.25); context.quadraticCurveTo(-radius * 0.5, -radius * 0.75, 0, -radius * 0.25);
    context.quadraticCurveTo(radius * 0.5, radius * 0.25, radius, -radius * 0.25);
    context.moveTo(-radius, radius * 0.45); context.quadraticCurveTo(-radius * 0.5, -radius * 0.05, 0, radius * 0.45);
    context.quadraticCurveTo(radius * 0.5, radius * 0.95, radius, radius * 0.45);
  } else if (marker === 'chain') {
    context.ellipse(-radius * 0.38, 0, radius * 0.48, radius * 0.3, -0.5, 0, Math.PI * 2);
    context.moveTo(radius * 0.1, -radius * 0.18);
    context.ellipse(radius * 0.38, 0, radius * 0.48, radius * 0.3, -0.5, 0, Math.PI * 2);
  } else if (marker === 'lantern') {
    context.rect(-radius * 0.55, -radius * 0.75, radius * 1.1, radius * 1.5);
    context.moveTo(-radius * 0.35, -radius); context.lineTo(radius * 0.35, -radius);
  } else if (marker === 'record' || marker === 'orders') {
    context.rect(-radius * 0.65, -radius * 0.9, radius * 1.3, radius * 1.8);
    context.moveTo(-radius * 0.4, -radius * 0.35); context.lineTo(radius * 0.4, -radius * 0.35);
    context.moveTo(-radius * 0.4, radius * 0.15); context.lineTo(radius * 0.4, radius * 0.15);
  } else if (marker === 'release') {
    context.arc(0, 0, radius * 0.82, 0.35, Math.PI * 1.75);
    context.moveTo(radius * 0.82, -radius * 0.25); context.lineTo(radius * 0.95, radius * 0.15); context.lineTo(radius * 0.52, radius * 0.08);
  } else if (marker === 'chevron') {
    context.moveTo(-radius, -radius * 0.6); context.lineTo(0, 0); context.lineTo(-radius, radius * 0.6);
    context.moveTo(0, -radius * 0.6); context.lineTo(radius, 0); context.lineTo(0, radius * 0.6);
  } else {
    context.arc(0, 0, radius * 0.82, 0, Math.PI * 2);
  }
}

function drawObjectiveTokens(snapshot, level, geometry, now) {
  const occupied = snapshot.actors
    .filter((actor) => actor.hp > 0 && actor.active !== false)
    .map((actor) => `${actor.pos.x},${actor.pos.y}`);
  const placements = getObjectiveTokenPlacements(level, snapshot.objective.requirements, occupied);
  for (const placement of placements) {
    const centerX = geometry.originX + placement.x * geometry.cell + geometry.cell / 2;
    const centerY = geometry.originY + placement.y * geometry.cell + geometry.cell / 2;
    const radius = Math.max(4, geometry.cell * 0.22);
    context.save();
    context.translate(centerX, centerY);
    context.globalAlpha = placement.complete ? 0.28 : 0.72 + Math.sin(now / 180 + placement.index) * 0.12;
    context.fillStyle = '#07111d';
    context.beginPath();
    context.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = placement.presentation.color;
    context.lineWidth = Math.max(1.5, geometry.cell * 0.055);
    traceObjectiveMarker(placement.presentation.marker, radius);
    context.stroke();
    context.restore();
  }
}

function battleCanvasPoint(tile, geometry) {
  return {
    x: geometry.originX + tile.x * geometry.cell + geometry.cell / 2,
    y: geometry.originY + tile.y * geometry.cell + geometry.cell / 2,
  };
}

function drawBattleAnimationFx(animation, geometry) {
  const frame = animation?.frame;
  if (!frame) return;
  context.save();
  context.imageSmoothingEnabled = false;
  if (frame.emission) {
    const from = battleCanvasPoint(frame.emission.fromTile, geometry);
    const head = battleCanvasPoint(frame.emission.headTile, geometry);
    context.strokeStyle = frame.emission.color;
    context.lineWidth = Math.max(2, geometry.cell * (frame.emission.leavesTrail ? 0.12 : 0.07));
    context.globalAlpha = 0.82;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(head.x, head.y);
    context.stroke();
    context.fillStyle = frame.emission.accentColor;
    const size = Math.max(3, geometry.cell * 0.13);
    context.fillRect(Math.round(head.x - size / 2), Math.round(head.y - size / 2), Math.round(size), Math.round(size));
  }
  if (frame.impact) {
    const at = battleCanvasPoint(frame.impact.tile, geometry);
    context.globalAlpha = frame.impact.opacity;
    context.fillStyle = frame.impact.color;
    context.beginPath();
    context.arc(at.x, at.y, frame.impact.radiusTiles * geometry.cell, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = frame.impact.accentColor;
    context.lineWidth = Math.max(2, geometry.cell * 0.06);
    context.stroke();
  }
  for (const glyph of [frame.statusGlyph, frame.selfStatusGlyph].filter(Boolean)) {
    const at = battleCanvasPoint(glyph.tile, geometry);
    context.globalAlpha = glyph.opacity;
    context.fillStyle = glyph.color;
    context.font = `${Math.max(12, Math.round(geometry.cell * 0.36 * glyph.scale))}px monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph.glyph, Math.round(at.x), Math.round(at.y));
  }
  context.restore();
}

function drawBattle(now = performance.now()) {
  const snapshot = engine.snapshot();
  const level = engine.level;
  const { cell, originX, originY } = mapGeometry();
  const geometry = { cell, originX, originY };
  const animation = currentBattleAnimationFrame(now);
  const blocked = new Set(level.blocked ?? []);
  const exits = new Set((level.exits ?? []).map((exit) => exit.at));
  const terrain = new Map((level.terrain ?? []).map((tile) => [tile.at, tile.tag]));
  context.fillStyle = '#070a13';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      const key = `${x},${y}`;
      const px = originX + x * cell;
      const py = originY + y * cell;
      context.fillStyle = terrainColor(terrain.get(key));
      context.fillRect(px, py, cell, cell);
      context.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.045)';
      context.fillRect(px, py, cell, cell);
      context.strokeStyle = 'rgba(210,224,244,0.12)';
      context.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
      if (blocked.has(key)) {
        context.fillStyle = '#0b1020';
        context.fillRect(px + 3, py + 3, cell - 6, cell - 6);
        context.fillStyle = '#4a3340';
        context.fillRect(px + 6, py + 7, cell - 12, Math.max(2, cell * 0.12));
      }
      if (exits.has(key)) {
        context.strokeStyle = '#74d4ce';
        context.lineWidth = 2;
        context.strokeRect(px + 5, py + 5, cell - 10, cell - 10);
      }
    }
  }

  const active = activePartyActor(snapshot);
  if (active && snapshot.pace > 0) {
    const occupied = new Set(snapshot.actors
      .filter((actor) => actor.instanceId !== active.instanceId && actor.hp > 0 && actor.active !== false)
      .map((actor) => `${actor.pos.x},${actor.pos.y}`));
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!dx && !dy) continue;
        const result = canMoveEightWay(level, active.pos, dx, dy, occupied);
        if (!result.ok) continue;
        const x = active.pos.x + dx;
        const y = active.pos.y + dy;
        context.fillStyle = 'rgba(105, 200, 190, 0.12)';
        context.fillRect(originX + x * cell + 3, originY + y * cell + 3, cell - 6, cell - 6);
      }
    }
  }

  drawObjectiveTokens(snapshot, level, geometry, now);

  const presentationActors = getBattlePresentationActors(snapshot.actors, animation?.retainedActors ?? []);
  for (const actor of presentationActors) {
    const animatedActor = animation && actor.instanceId === animation.attackerId ? animation.frame.actor : null;
    const animatedTarget = animation && actor.instanceId === animation.targetId ? animation.frame.target : null;
    const renderTile = animatedActor?.renderTile ?? animatedTarget?.renderTile ?? actor.pos;
    const centerX = originX + renderTile.x * cell + cell / 2;
    const centerY = originY + renderTile.y * cell + cell / 2 + Math.sin(now / 170 + actor.pos.x) * Math.max(1, cell * 0.035);
    const animationScale = animatedActor?.scale ?? 1;
    const party = actor.faction === 'party';
    if (party && actor.instanceId === snapshot.activeActorId) {
      context.strokeStyle = '#f5d77e';
      context.lineWidth = 2;
      context.strokeRect(centerX - cell * 0.3, centerY - cell * 0.34, cell * 0.6, cell * 0.68);
    }
    if (party && battlePartyAtlasImage.complete && battlePartyAtlasImage.naturalWidth > 0) {
      const nearestEnemy = snapshot.actors
        .filter((candidate) => candidate.faction === 'enemy' && candidate.hp > 0 && candidate.active !== false)
        .sort((left, right) => Math.max(Math.abs(left.pos.x - actor.pos.x), Math.abs(left.pos.y - actor.pos.y))
          - Math.max(Math.abs(right.pos.x - actor.pos.x), Math.abs(right.pos.y - actor.pos.y))
          || left.instanceId.localeCompare(right.instanceId))[0];
      const fallbackFacing = nearestEnemy
        ? atlasDirectionForMovement(Math.sign(nearestEnemy.pos.x - actor.pos.x), Math.sign(nearestEnemy.pos.y - actor.pos.y), 'north')
        : 'north';
      const animationFacing = animatedActor?.facing
        ? atlasDirectionForMovement(animatedActor.facing.x, animatedActor.facing.y, fallbackFacing)
        : null;
      const facing = animationFacing ?? battleFacingByActor.get(actor.instanceId) ?? fallbackFacing;
      const presentationSpeed = autoGrindActive ? speedMultiplier : 1;
      const phase = now < (battleMotionUntil.get(actor.instanceId) ?? 0)
        ? Math.floor((now * presentationSpeed) / 110) % 2
        : 0;
      const frame = getPartyAtlasFrame(actor.templateId, facing, phase);
      const drawHeight = cell * 1.18 * animationScale;
      const drawWidth = drawHeight * (frame.width / frame.height);
      context.drawImage(
        battlePartyAtlasImage,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        centerX - drawWidth / 2,
        centerY - drawHeight * 0.57,
        drawWidth,
        drawHeight,
      );
    } else if (!party && battleEnemyAtlasImage.complete && battleEnemyAtlasImage.naturalWidth > 0) {
      const animationPose = animatedActor?.pose ?? animatedTarget?.pose;
      const transientPose = now < (battleEnemyPoseUntil.get(actor.instanceId) ?? 0)
        ? battleEnemyPoseByActor.get(actor.instanceId)
        : null;
      const pose = animationPose
        ?? transientPose
        ?? (snapshot.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND && actor.instanceId === snapshot.activeActorId
          ? 'windup'
          : 'neutral');
      const frame = getEnemyAtlasFrame(actor.templateId, pose);
      const scaleByFamily = {
        hound: 0.98,
        wisp: 0.9,
        'ashen-oni': 1.25,
        'court-retainer': 1.18,
        widow: 1.3,
        furnace: 1.42,
        'bell-warden': 1.38,
        'black-court': 1.4,
      };
      const drawHeight = cell * (scaleByFamily[frame.familyId] ?? 1.2) * animationScale;
      const drawWidth = drawHeight * (frame.width / frame.height);
      const nearestParty = snapshot.actors
        .filter((candidate) => candidate.faction === 'party' && candidate.hp > 0 && candidate.active !== false)
        .sort((left, right) => Math.max(Math.abs(left.pos.x - actor.pos.x), Math.abs(left.pos.y - actor.pos.y))
          - Math.max(Math.abs(right.pos.x - actor.pos.x), Math.abs(right.pos.y - actor.pos.y))
          || left.instanceId.localeCompare(right.instanceId))[0];
      const faceLeft = animatedActor?.facing?.x
        ? animatedActor.facing.x < 0
        : !nearestParty || nearestParty.pos.x <= actor.pos.x;
      context.save();
      context.translate(centerX, 0);
      context.scale(faceLeft ? -1 : 1, 1);
      context.drawImage(
        battleEnemyAtlasImage,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        -drawWidth / 2,
        centerY - drawHeight * 0.58,
        drawWidth,
        drawHeight,
      );
      context.restore();
    } else {
      context.fillStyle = actor.instanceId === snapshot.activeActorId ? '#f5d77e' : party ? '#70c9c2' : '#d06459';
      context.fillRect(centerX - cell * 0.23, centerY - cell * 0.25, cell * 0.46, cell * 0.5);
      context.fillStyle = party ? '#102b39' : '#321824';
      context.fillRect(centerX - cell * 0.12, centerY - cell * 0.12, cell * 0.24, cell * 0.17);
    }
    if (actor.instanceId === selectedTargetId) {
      context.strokeStyle = '#fff2ab';
      context.lineWidth = 2;
      context.strokeRect(centerX - cell * 0.31, centerY - cell * 0.33, cell * 0.62, cell * 0.66);
    }
  }
  drawBattleAnimationFx(animation, geometry);
}

function createCombatantCard(actor, selected = false) {
  const card = document.createElement(actor.faction === 'enemy' ? 'button' : 'div');
  if (card instanceof HTMLButtonElement) card.type = 'button';
  card.className = `combatant-card${actor.hp <= 0 ? ' is-defeated' : ''}`;
  card.role = 'listitem';
  card.dataset.actorId = actor.instanceId;
  card.setAttribute('aria-selected', String(selected));
  const name = document.createElement('div');
  name.className = 'combatant-name';
  const strong = document.createElement('strong');
  strong.textContent = actor.name;
  const hp = document.createElement('span');
  hp.textContent = `${actor.hp}/${actor.maxHp}`;
  name.append(strong, hp);
  const meter = document.createElement('div');
  meter.className = 'meter';
  const fill = document.createElement('span');
  fill.style.setProperty('--meter-value', `${Math.max(0, Math.round((actor.hp / actor.maxHp) * 100))}%`);
  fill.style.setProperty('--meter-color', actor.faction === 'party' ? '#77c9c5' : '#d76555');
  meter.append(fill);
  const spirit = document.createElement('div');
  spirit.className = 'combatant-resource';
  if (actor.maxSpirit > 0) {
    const spiritLabel = document.createElement('span');
    spiritLabel.textContent = `Spirit ${actor.spirit}/${actor.maxSpirit}`;
    const spiritMeter = document.createElement('div');
    spiritMeter.className = 'meter spirit-meter';
    const spiritFill = document.createElement('span');
    spiritFill.style.setProperty('--meter-value', `${Math.round((actor.spirit / actor.maxSpirit) * 100)}%`);
    spiritFill.style.setProperty('--meter-color', '#a68ee8');
    spiritMeter.append(spiritFill);
    spirit.append(spiritLabel, spiritMeter);
  }
  const meta = document.createElement('div');
  meta.className = 'combatant-meta';
  const statuses = actor.statuses?.map((status) => (
    `${COMBAT_STATUS_DEFINITIONS[status.id]?.name ?? status.id} ${status.remainingActivations}`
  )) ?? [];
  meta.textContent = `${actor.stance.toUpperCase()} · ready pulse ${actor.readyAtPulse}${actor.analyzed ? ' · ANALYZED' : ''}${statuses.length ? ` · ${statuses.join(', ')}` : ''}`;
  card.append(name, meter);
  if (spirit.childElementCount) card.append(spirit);
  card.append(meta);
  return card;
}

function renderCombatants(snapshot) {
  partyPanel.replaceChildren(...snapshot.actors.filter((actor) => actor.faction === 'party').map((actor) => createCombatantCard(actor)));
  enemyPanel.replaceChildren(...snapshot.actors.filter((actor) => actor.faction !== 'party').map((actor) => createCombatantCard(actor, actor.instanceId === selectedTargetId)));
}

function publishRenderedBattleState(snapshot) {
  const actor = activePartyActor(snapshot);
  for (const key of [
    'activeActorId', 'activeActorX', 'activeActorY',
    'objectiveAction', 'objectiveRequirementKey', 'objectiveTargetX', 'objectiveTargetY',
    'combatTargetId', 'combatTargetX', 'combatTargetY', 'combatSkillRange',
  ]) delete canvas.dataset[key];

  if (actor) {
    canvas.dataset.activeActorId = actor.instanceId;
    canvas.dataset.activeActorX = String(actor.pos.x);
    canvas.dataset.activeActorY = String(actor.pos.y);
    const target = livingEnemies(snapshot)
      .sort((left, right) => (
        left.hp - right.hp
        || left.instanceId.localeCompare(right.instanceId)
        || Math.max(Math.abs(left.pos.x - actor.pos.x), Math.abs(left.pos.y - actor.pos.y))
        - Math.max(Math.abs(right.pos.x - actor.pos.x), Math.abs(right.pos.y - actor.pos.y))
      ))[0];
    if (target && actor.skills[0]) {
      canvas.dataset.combatTargetId = target.instanceId;
      canvas.dataset.combatTargetX = String(target.pos.x);
      canvas.dataset.combatTargetY = String(target.pos.y);
      canvas.dataset.combatSkillRange = String(actor.skills[0].range ?? 1);
    }
  }

  const pending = snapshot.objective.requirements
    .find((requirement) => !requirement.automatic && !requirement.complete);
  if (!pending) return;
  canvas.dataset.objectiveAction = pending.action;
  canvas.dataset.objectiveRequirementKey = pending.key;

  // Only publish a navigation target when the simulation itself enforces a
  // tile. Presentation-only fallback markers must never become false rules.
  if (!pending.tile && !pending.tiles?.length) return;
  const occupied = snapshot.actors
    .filter((entry) => entry.hp > 0 && entry.active !== false)
    .map((entry) => `${entry.pos.x},${entry.pos.y}`);
  const target = getObjectiveTokenPlacements(engine.level, [pending], occupied)
    .find((placement) => !placement.complete);
  if (!target) return;
  canvas.dataset.objectiveTargetX = String(target.x);
  canvas.dataset.objectiveTargetY = String(target.y);
}

function renderTempo(snapshot) {
  const actors = snapshot.actors.filter((actor) => actor.hp > 0 && actor.active !== false && actor.faction !== 'neutral')
    .sort((left, right) => left.readyAtPulse - right.readyAtPulse || right.speed - left.speed || left.instanceId.localeCompare(right.instanceId));
  tempoQueue.replaceChildren(...actors.map((actor) => {
    const entry = document.createElement('li');
    entry.className = 'tempo-entry';
    entry.style.setProperty('--tempo-color', actor.faction === 'party' ? '#77c9c5' : '#d76555');
    entry.textContent = `${actor.name} · ${actor.instanceId === snapshot.activeActorId ? 'ACTIVE' : `pulse ${actor.readyAtPulse}`}`;
    return entry;
  }));
}

function replaceOptions(select, entries, placeholder) {
  const prior = select.value;
  const placeholderOption = new Option(placeholder, '');
  const options = entries.map((entry) => {
    const option = new Option(entry.label, entry.value);
    option.disabled = Boolean(entry.disabled);
    return option;
  });
  select.replaceChildren(placeholderOption, ...options);
  if (entries.some((entry) => entry.value === prior && !entry.disabled)) select.value = prior;
  else {
    const firstEnabled = entries.find((entry) => !entry.disabled);
    if (firstEnabled) select.value = firstEnabled.value;
  }
}

function renderCommands(snapshot) {
  const actor = activePartyActor(snapshot);
  const inputLocked = manualInputLocked();
  const available = new Set(actor ? engine.getAvailableCommands(actor.instanceId) : []);
  activeActorLabel.textContent = actor
    ? `${actor.name} · ${snapshot.pace} Pace · ${actor.spirit}/${actor.maxSpirit} Spirit${autoInputLocked() ? ' · AUTO' : battleAnimationActive() ? ' · ANIMATING' : ''}`
    : 'Waiting for the next activation';
  commandButtons.forEach((button) => {
    const command = button.dataset.command;
    const enabled = !inputLocked && Boolean(actor) && (command === 'attack' ? available.has('skill') : available.has(command));
    button.disabled = !enabled;
    button.setAttribute('aria-pressed', String(command === selectedCommand));
  });
  const pendingObjective = snapshot.objective.requirements
    .find((requirement) => !requirement.automatic && !requirement.complete);
  const objectivePresentation = getObjectiveActionPresentation(pendingObjective);
  const objectiveButton = commandButtons.find((button) => button.dataset.command === 'objective');
  if (objectiveButton) objectiveButton.textContent = pendingObjective ? objectivePresentation.buttonLabel : 'Objective';

  const skills = actor?.skills ?? [];
  replaceOptions(skillSelect, skills.map((skill) => {
    const quote = engine.getSkillSpiritQuote(actor.instanceId, skill.id);
    const economy = skill.spiritCost > 0 ? `${skill.spiritCost} SP` : `+${skill.spiritGain} SP`;
    return {
      value: skill.id,
      label: `${skill.name} · R${skill.recoveryPulses} · ${economy}${quote.affordable ? '' : ' · NEED SPIRIT'}`,
      disabled: !quote.affordable,
    };
  }), 'Select an art');
  replaceOptions(targetSelect, livingEnemies(snapshot).map((target) => ({ value: target.instanceId, label: `${target.name} · ${target.hp} HP` })), 'Select a target');
  if (selectedTargetId && livingEnemies(snapshot).some((target) => target.instanceId === selectedTargetId)) targetSelect.value = selectedTargetId;
  selectedTargetId = targetSelect.value;

  const needsSkill = ['attack', 'skill'].includes(selectedCommand);
  const needsTarget = ['attack', 'skill', 'analyze'].includes(selectedCommand);
  skillSelect.disabled = inputLocked || !actor || !needsSkill || selectedCommand === 'attack';
  targetSelect.disabled = inputLocked || !actor || !needsTarget;
  confirmCommand.disabled = inputLocked || !actor || selectedCommand === 'move'
    || (needsSkill && !skillSelect.value) || (needsTarget && !targetSelect.value)
    || (needsSkill && skillSelect.selectedOptions[0]?.disabled)
    || (selectedCommand === 'objective' && !available.has('objective'));
  const hints = {
    move: 'Use W/A/S/D, Q/E/Z/C, arrow keys, or click an adjacent space. Movement spends one Pace and does not end the activation.',
    attack: 'Use the active character’s first combat art against the selected target.',
    skill: 'Choose an art and target. Recovery controls when this character returns to Tempo.',
    guard: 'Reduce the next incoming hit, then recover for one pulse.',
    analyze: 'Reveal the selected enemy’s delivery and essence multipliers.',
    objective: pendingObjective ? objectivePresentation.hint : 'No manual encounter requirement remains.',
  };
  commandHint.textContent = inputLocked
    ? autoInputLocked()
      ? 'Auto-Grind is issuing the deterministic repeat policy; manual commands are paused.'
      : 'The current action timeline is resolving; simulation positions remain exact and unchanged.'
    : actor ? hints[selectedCommand] : 'Enemy intent or recovery is resolving. Manual repeat speed changes this wait, not command time.';
}

function formatEngineLog(entry, actors) {
  const name = (id) => actors.find((actor) => actor.instanceId === id)?.name ?? id;
  if (entry.type === 'move') return `${name(entry.actorId)} moves to ${entry.at}.`;
  if (entry.type === 'damage') return `${name(entry.attackerId)} uses ${entry.skillId} on ${name(entry.targetId)}: ${entry.finalDamage} damage (${Math.round(entry.deliveryMultiplier * 100)}% delivery${entry.essenceMultiplier !== 1 ? `, ${Math.round(entry.essenceMultiplier * 100)}% essence` : ''})${entry.statusApplied ? ` and applies ${COMBAT_STATUS_DEFINITIONS[entry.statusId]?.name ?? entry.statusId}` : ''}.`;
  if (entry.type === 'guard') return `${name(entry.actorId)} guards.`;
  if (entry.type === 'analyze') return `${name(entry.actorId)} analyzes ${name(entry.targetId)}.`;
  if (entry.type === 'spirit-change' && entry.delta !== 0) return `${name(entry.actorId)} Spirit ${entry.delta > 0 ? '+' : ''}${entry.delta} (${entry.after}/${entry.maxSpirit}).`;
  if (entry.type === 'status-applied' || entry.type === 'status-refreshed') return `${name(entry.targetId)}: ${COMBAT_STATUS_DEFINITIONS[entry.statusId]?.name ?? entry.statusId} ${entry.type === 'status-refreshed' ? 'refreshed' : 'applied'} for ${entry.durationActivations} activation${entry.durationActivations === 1 ? '' : 's'}.`;
  if (entry.type === 'status-effect') return `${name(entry.actorId)}: ${COMBAT_STATUS_DEFINITIONS[entry.statusId]?.name ?? entry.statusId} changes ${entry.effect} by ${entry.delta}.`;
  if (entry.type === 'status-damage') return `${name(entry.targetId)} takes ${entry.finalDamage} ${COMBAT_STATUS_DEFINITIONS[entry.statusId]?.name ?? entry.statusId} damage.`;
  if (entry.type === 'objective') {
    const presentation = getObjectiveActionPresentation({ action: entry.action, targetId: entry.targetId });
    return `${name(entry.actorId)}: ${presentation.label}.`;
  }
  if (entry.type === 'objective-failure') return `Objective failed: ${entry.reason}.`;
  return null;
}

function renderLog(snapshot) {
  const engineLines = snapshot.log.map((entry) => formatEngineLog(entry, snapshot.actors)).filter(Boolean);
  const lines = [...uiMessages, ...engineLines].slice(-30);
  resultLog.replaceChildren(...lines.map((line) => {
    const item = document.createElement('li');
    item.textContent = line;
    return item;
  }));
  resultLog.scrollTop = resultLog.scrollHeight;
}

function renderObjective(snapshot) {
  objectiveText.textContent = snapshot.objective.text;
  const requirements = snapshot.objective.requirements;
  const completed = requirements.filter((requirement) => requirement.complete).length;
  const requirementText = requirements.length
    ? requirements.map((requirement) => `${requirement.complete ? '✓' : '○'} ${formatObjectiveRequirement(requirement)}`).join(' · ')
    : 'Defeat the required hostile formation.';
  objectiveProgress.textContent = `${completed}/${requirements.length} objective requirements · ${snapshot.objective.combatComplete ? 'combat condition met' : 'combat condition pending'} · ${requirementText}`;
}

function recordVictoryIfNeeded(snapshot) {
  if (snapshot.result !== 'victory') return false;
  if (rewardRecorded) return true;
  if (victoryPersistenceError && performance.now() < victorySaveRetryAt) return false;
  const priorWins = getEncounterWinCount(advancementState, encounter.id);
  const reward = getEncounterRewardPreview(encounter.id, priorWins);
  const failSettlement = (message) => {
    if (victoryPersistenceError !== message) addMessage(message);
    victoryPersistenceError = message;
    victorySaveRetryAt = performance.now() + 1000;
    return false;
  };
  if (!flushRunReceiptPlaytime()) {
    return failSettlement('Victory is earned, but active clean-run time could not be saved. Continue remains locked while the battle retries the write.');
  }

  let nextRunReceiptState = runReceiptState;
  if (priorWins === 0 && runReceiptState?.status === 'active') {
    const receiptResult = recordRunFirstClear(runReceiptState, runReceiptState.runId, encounter.id);
    if (!receiptResult.ok) {
      return failSettlement(`Victory is earned, but first-clear evidence was rejected (${receiptResult.code ?? 'unknown receipt error'}). Continue remains locked.`);
    }
    nextRunReceiptState = receiptResult.state;
  }

  const nextAdvancementState = recordEncounterWin(advancementState, encounter.id, { partyIds: encounter.party?.roster });
  const loadoutReward = grantInventory(loadoutState, { currency: reward.currency, items: reward.items });
  if (!loadoutReward.ok) {
    return failSettlement(`Victory is earned, but its camp reward could not be prepared: ${loadoutReward.reason}`);
  }
  let nextLoadoutState = loadoutReward.state;
  for (const actor of snapshot.actors.filter((entry) => entry.faction === 'party')) {
    const vitals = setMemberVitals(nextLoadoutState, actor.templateId, { hp: Math.max(1, actor.hp) });
    if (!vitals.ok) return failSettlement(`Victory is earned, but ${actor.name}'s camp vitals could not be prepared.`);
    nextLoadoutState = vitals.state;
  }

  const changes = [
    { id: 'advancement', adapter: advancementAdapter, previousState: advancementState, nextState: nextAdvancementState },
    { id: 'loadout', adapter: loadoutAdapter, previousState: loadoutState, nextState: nextLoadoutState },
  ];
  let questCompletionMessage = null;
  if (requestedQuestId && requestedQuestObjectiveId) {
    const loadedQuestState = questAdapter.load();
    if (!loadedQuestState.ok) {
      return failSettlement('Victory is earned, but the side-story save could not be read. Continue remains locked.');
    }
    const questResult = advanceQuestObjective(
      loadedQuestState.state,
      requestedQuestId,
      requestedQuestObjectiveId,
    );
    if (questResult.ok) {
      changes.push({ id: 'quest', adapter: questAdapter, previousState: loadedQuestState.state, nextState: questResult.state });
      questCompletionMessage = `Side-story objective recorded: ${requestedQuestObjectiveId}.`;
    } else {
      const progress = getQuestProgress(loadedQuestState.state, requestedQuestId);
      const requestedIndex = progress?.quest.objectives.findIndex((objective, index) => (
        (objective.id ?? `objective-${index + 1}`) === requestedQuestObjectiveId
      )) ?? -1;
      if (requestedIndex < 0 || progress.objectiveIndex <= requestedIndex) {
        return failSettlement(`Victory is earned, but side-story evidence was rejected: ${questResult.reason}`);
      }
    }
  }

  let witnessCompletionMessage = null;
  if (requestedChronicleId && requestedChronicleStageId) {
    const loadedWitnessState = witnessAdapter.load();
    if (!loadedWitnessState.ok) {
      return failSettlement('Victory is earned, but the witness-chronicle save could not be read. Continue remains locked.');
    }
    const evidence = {
      encounterId: encounter.id,
      victory: true,
      ...(requestedChronicleChoiceId ? { choiceId: requestedChronicleChoiceId } : {}),
    };
    const witnessResult = advanceWitnessChronicle(
      loadedWitnessState.state,
      requestedChronicleId,
      requestedChronicleStageId,
      evidence,
    );
    if (witnessResult.ok) {
      changes.push({ id: 'witness', adapter: witnessAdapter, previousState: loadedWitnessState.state, nextState: witnessResult.state });
      witnessCompletionMessage = `Witness chronicle stage recorded: ${requestedChronicleStageId}.`;
    } else {
      const progress = getWitnessChronicleProgress(loadedWitnessState.state, requestedChronicleId);
      const requestedIndex = progress?.chronicle.stages.findIndex(({ id }) => id === requestedChronicleStageId) ?? -1;
      if (requestedIndex < 0 || progress.stageIndex <= requestedIndex) {
        return failSettlement(`Victory is earned, but witness evidence was rejected: ${witnessResult.reason}`);
      }
    }
  }

  let fieldCompletionMessage = null;
  if (requestedFieldTriggerId) {
    const loadedFieldState = fieldAdapter.load();
    if (!loadedFieldState.ok || !loadedFieldState.found) {
      return failSettlement('Victory is earned, but its field route could not be read. Continue remains locked.');
    }
    const fieldResult = resolveFieldEncounter(loadedFieldState.state, requestedFieldTriggerId);
    if (!fieldResult.ok) {
      return failSettlement(`Victory is earned, but its field trigger was rejected (${fieldResult.code}). Continue remains locked.`);
    }
    if (fieldResult.state !== loadedFieldState.state) {
      changes.push({ id: 'field', adapter: fieldAdapter, previousState: loadedFieldState.state, nextState: fieldResult.state });
    }
    fieldCompletionMessage = `Field encounter ${requestedFieldTriggerId} resolved for the route.`;
  }

  if (nextRunReceiptState !== runReceiptState) {
    changes.push({ id: 'run-receipt', adapter: runReceiptAdapter, previousState: runReceiptState, nextState: nextRunReceiptState });
  }
  const persisted = commitPersistenceTransaction(changes.map(({ id, adapter, previousState, nextState }) => (
    stateSaveStep(id, adapter, previousState, nextState, { supportsOverwriteRollback: true })
  )));
  if (!persisted.ok) {
    const rollback = persisted.rollbackComplete
      ? 'Earlier writes were restored.'
      : `Rollback also failed for ${persisted.rollbackFailedIds.join(', ')}; reload before continuing.`;
    return failSettlement(`Victory is earned, but ${persisted.failedId} could not be saved. ${rollback} Continue remains locked while the battle retries.`);
  }

  advancementState = nextAdvancementState;
  loadoutState = nextLoadoutState;
  runReceiptState = nextRunReceiptState;
  victoryPersistenceError = null;
  victorySaveRetryAt = 0;
  if (questCompletionMessage) addMessage(questCompletionMessage);
  if (witnessCompletionMessage) addMessage(witnessCompletionMessage);
  if (fieldCompletionMessage) addMessage(fieldCompletionMessage);
  speedMultiplier = resolveBattlePresentationSpeed(
    getEncounterWinCount(advancementState, encounter.id),
    advancementState.speedMultiplier,
  );
  rewardRecorded = true;
  addMessage(`Victory reward: ${reward.xpPerMember} XP per active member, ${reward.currency} mon${reward.repeat ? ' (repeat grind reward)' : ' plus first-clear loot'}.`);
  return true;
}

function renderSpeedControls() {
  const grindAvailable = getEncounterWinCount(advancementState, encounter.id) > 0;
  const snapshot = engine.snapshot();
  const settling = autoSettleAt !== null;
  const manualAnimation = !autoGrindActive && !settling && battleAnimationActive();
  const queueInProgress = repeatGrindQueue.active;
  speedButtons.forEach((button) => {
    button.disabled = !grindAvailable || queueInProgress || settling || manualAnimation || Boolean(snapshot.result);
    button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === speedMultiplier));
  });
  speedStatus.textContent = grindAvailable
    ? `Saved repeat speed: ${speedMultiplier}× · full-loop only in Auto-Grind; manual play only shortens enemy presentation`
    : 'Speed unlocks after the first clear for repeat level grinding.';
  autoGrindWins.disabled = !grindAvailable || queueInProgress || settling || Boolean(snapshot.result) || manualAnimation;
  autoGrind.disabled = !grindAvailable || manualAnimation || (!queueInProgress && (settling || Boolean(snapshot.result)));
  autoGrind.setAttribute('aria-pressed', String(queueInProgress));
  autoGrind.textContent = queueInProgress
    ? `Cancel Auto-Grind ${repeatGrindQueue.completedWins}/${repeatGrindQueue.plannedWins}`
    : 'Start Auto-Grind';
  autoGrindStatus.textContent = !grindAvailable
    ? 'First-clear play remains manual. Clear this encounter once to unlock deterministic Auto-Grind.'
    : manualAnimation
      ? 'Finish the current action animation before starting Auto-Grind.'
      : queueInProgress && settling
        ? `Auto-Grind saved win ${repeatGrindQueue.completedWins}/${repeatGrindQueue.plannedWins}; the next repeat starts after the result hold.`
      : settling
      ? `Auto-Grind ${speedMultiplier}× is presenting the terminal result and reward.`
      : queueInProgress
        ? `Auto-Grind ${speedMultiplier}× is running win ${repeatGrindQueue.completedWins + 1}/${repeatGrindQueue.plannedWins}; every reward is saved before another repeat starts.`
        : 'Repeat-only. Choose 1, 5, or 10 wins; the queue stops on cancellation, defeat, or reload.';
}

function render() {
  const snapshot = engine.snapshot();
  const settlementReady = isBattlePresentationSettled({
    result: snapshot.result,
    animationActive: battleAnimationActive(),
    settling: autoSettleAt !== null,
  });
  // Auto-Grind may delay the terminal reveal, but an earned victory must be
  // durable before the player can restart, leave, reload, or enter BFCache.
  const durableVictory = recordVictoryIfNeeded(snapshot);
  if (durableVictory && repeatGrindQueue.active && !queuedVictoryRecorded) {
    const recorded = recordRepeatGrindVictory(repeatGrindQueue);
    repeatGrindQueue = recorded.state;
    queuedVictoryRecorded = true;
    if (recorded.complete) {
      addMessage(`Auto-Grind queue complete: ${repeatGrindQueue.completedWins}/${repeatGrindQueue.plannedWins} repeat rewards saved.`);
    }
  }
  encounterTitle.textContent = encounter.name;
  encounterSubtitle.textContent = `${encounter.chapterId} · ${engine.level.name} · ${encounter.format}`;
  document.title = `${encounter.name} — Bells Battle`;
  battleClock.textContent = formatClock(snapshot.nowMs);
  roundLabel.textContent = `ACTIVATION ${engine.activationCount}`;
  phaseLabel.textContent = phaseName(snapshot);
  battleStateBadge.textContent = autoSettleAt !== null
    ? 'RESOLVING'
    : snapshot.result?.toUpperCase() ?? (snapshot.phase === CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND ? 'COMMAND' : 'INTENT');
  publishRenderedBattleState(snapshot);
  renderCombatants(snapshot);
  renderTempo(snapshot);
  renderCommands(snapshot);
  renderSpeedControls();
  renderObjective(snapshot);
  renderLog(snapshot);
  continueCampaign.hidden = snapshot.result !== 'victory' || !settlementReady || !durableVictory;
  if (snapshot.result === 'victory' && settlementReady && durableVictory) continueCampaign.focus({ preventScroll: true });
  drawBattle();
  if (!autoInputLocked() && !battleAnimationActive() && snapshot.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND && !snapshot.result && enemyIntentSchedule === null) {
    scheduleEnemyIntent();
  }
}

function executeRepeatPolicyCommand(actorId, command, beforeSnapshot = engine.snapshot()) {
  if (command.type === 'move') {
    const result = engine.move(actorId, command.dx, command.dy);
    if (result.ok) markBattleMotion(actorId, command.dx, command.dy);
    return result;
  }
  if (command.type === 'skill') {
    const result = engine.useSkill(actorId, command.skillId, command.targetId);
    markCombatResolutionPose(result);
    startCombatAnimation(result, actorId, beforeSnapshot);
    return result;
  }
  if (command.type === 'objective') return engine.performObjectiveAction(actorId, command.action);
  if (command.type === 'guard') return engine.guard(actorId);
  return { ok: false, reason: `Unsupported Auto-Grind command ${command.type}.` };
}

function stopAutoGrind(message) {
  autoGrindActive = false;
  autoActionAt = null;
  if (message) addMessage(message);
}

function cancelQueuedAutoGrind(message) {
  repeatGrindQueue = cancelRepeatGrindQueue(repeatGrindQueue);
  stopAutoGrind(message);
}

function executeAutoGrindStep(now) {
  if (!autoGrindActive || engine.result) return;
  const before = engine.snapshot();
  const beforePulse = before.nowPulse;
  let stepType;
  let result;
  try {
    if (before.phase === CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND) {
      const command = chooseRepeatBattleCommand(engine);
      if (!command) throw new Error('The repeat policy could not select a party command.');
      stepType = command.type;
      result = executeRepeatPolicyCommand(before.activeActorId, command, before);
    } else if (before.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND) {
      stepType = 'enemyActivation';
      result = engine.resolveEnemyActivation();
      markCombatResolutionPose({ ok: result.ok, ...result.resolution }, before.activeActorId);
      startCombatAnimation({ ok: result.ok, ...result.resolution }, before.activeActorId, before);
    } else {
      throw new Error(`Unexpected Auto-Grind phase ${before.phase}.`);
    }
  } catch (error) {
    cancelQueuedAutoGrind(`Auto-Grind stopped: ${error.message}`);
    render();
    return;
  }
  if (!result?.ok) {
    cancelQueuedAutoGrind(`Auto-Grind stopped: ${result?.reason ?? 'a deterministic command failed.'}`);
    render();
    return;
  }
  const after = engine.snapshot();
  const recoveredPulses = Math.max(0, after.nowPulse - beforePulse);
  const stepDelay = getRepeatStepDelayMs(stepType, speedMultiplier, recoveredPulses);
  const animationEnd = activeBattleAnimation?.endsAt ?? 0;
  if (after.result) {
    stopAutoGrind();
    if (after.result !== 'victory') repeatGrindQueue = cancelRepeatGrindQueue(repeatGrindQueue);
    const terminalDelay = getRepeatStepDelayMs('resolution', speedMultiplier)
      + (after.result === 'victory' ? getRepeatStepDelayMs('reward', speedMultiplier) : 0);
    autoSettleAt = Math.max(now + stepDelay, animationEnd) + terminalDelay;
    addMessage(`Auto-Grind reached ${after.result}; presenting the deterministic result${after.result === 'victory' ? ' and reward' : ''}.`);
  } else {
    autoActionAt = getNextBattleActionAt({
      nowMs: now,
      stepDelayMs: stepDelay,
      animationEndsAt: activeBattleAnimation ? animationEnd : null,
      nextIsEnemy: after.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND,
      speed: speedMultiplier,
    });
  }
  render();
}

function toggleAutoGrind() {
  if (repeatGrindQueue.active) {
    cancelQueuedAutoGrind(`Auto-Grind cancelled after ${repeatGrindQueue.completedWins}/${repeatGrindQueue.plannedWins} saved wins. Manual repeat controls restored.`);
    autoSettleAt = null;
    render();
    return;
  }
  const grindAvailable = getEncounterWinCount(advancementState, encounter.id) > 0;
  if (!grindAvailable) {
    addMessage('Auto-Grind unlocks only after this encounter\'s first clear.');
    render();
    return;
  }
  const animationActive = battleAnimationActive();
  if (animationActive) {
    addMessage('Finish the current action animation before starting Auto-Grind.');
    render();
    return;
  }
  if (!canStartAutoGrindPresentation({
    unlocked: grindAvailable,
    animationActive,
    result: engine.result,
    settling: autoSettleAt !== null,
  })) return;
  repeatGrindQueue = startRepeatGrindQueue(createRepeatGrindQueue(Number(autoGrindWins.value)));
  queuedVictoryRecorded = false;
  autoGrindActive = true;
  activeBattleAnimation = null;
  clearEnemyIntentSchedule();
  autoActionAt = performance.now() + getRepeatStepDelayMs('intro', speedMultiplier);
  addMessage(`Auto-Grind started for ${repeatGrindQueue.plannedWins} win${repeatGrindQueue.plannedWins === 1 ? '' : 's'} at ${speedMultiplier}×. Every reward saves before the next repeat.`);
  render();
}

function restartQueuedAutoGrind(now) {
  battlePlaytimeCategory = getBattlePlaytimeCategory(getEncounterWinCount(advancementState, encounter.id));
  engine = createEngine();
  rewardRecorded = false;
  queuedVictoryRecorded = false;
  victoryPersistenceError = null;
  victorySaveRetryAt = 0;
  selectedTargetId = '';
  clearEnemyIntentSchedule();
  battleFacingByActor.clear();
  battleMotionUntil.clear();
  battleEnemyPoseByActor.clear();
  battleEnemyPoseUntil.clear();
  activeBattleAnimation = null;
  autoGrindActive = true;
  autoActionAt = now + getRepeatStepDelayMs('intro', speedMultiplier);
  addMessage(`Auto-Grind starting win ${repeatGrindQueue.completedWins + 1}/${repeatGrindQueue.plannedWins} at ${speedMultiplier}×.`);
  render();
}

function selectCommand(command) {
  if (manualInputLocked()) return;
  selectedCommand = command;
  if (command === 'attack') skillSelect.selectedIndex = Math.min(1, skillSelect.options.length - 1);
  render();
}

function executeSelectedCommand() {
  if (manualInputLocked()) return;
  const snapshot = engine.snapshot();
  const actor = activePartyActor(snapshot);
  if (!actor) return;
  let result;
  if (selectedCommand === 'attack' || selectedCommand === 'skill') {
    const skillId = selectedCommand === 'attack' ? actor.skills[0]?.id : skillSelect.value;
    result = engine.useSkill(actor.instanceId, skillId, targetSelect.value);
  } else if (selectedCommand === 'guard') {
    result = engine.guard(actor.instanceId);
  } else if (selectedCommand === 'analyze') {
    result = engine.analyze(actor.instanceId, targetSelect.value);
  } else if (selectedCommand === 'objective') {
    const requirement = snapshot.objective.requirements.find((entry) => !entry.automatic && !entry.complete);
    result = requirement
      ? engine.performObjectiveAction(actor.instanceId, { type: requirement.action, targetId: requirement.targetId, amount: 1 })
      : { ok: false, reason: 'No objective action is pending.' };
  }
  if (!result?.ok) addMessage(result?.reason ?? 'Command failed.');
  else if (result.readout) addMessage(`${targetSelect.options[targetSelect.selectedIndex]?.text ?? 'Target'} Ledger: ${result.readout.ledger || 'No note.'}`);
  if (selectedCommand === 'attack' || selectedCommand === 'skill') {
    markCombatResolutionPose(result);
    startCombatAnimation(result, actor.instanceId, snapshot);
  }
  clearEnemyIntentSchedule();
  render();
}

function moveActive(dx, dy) {
  if (manualInputLocked()) return;
  const snapshot = engine.snapshot();
  const actor = activePartyActor(snapshot);
  if (!actor) return;
  selectedCommand = 'move';
  const result = engine.move(actor.instanceId, dx, dy);
  if (result.ok) markBattleMotion(actor.instanceId, dx, dy);
  if (!result.ok) addMessage(result.reason);
  render();
}

commandButtons.forEach((button) => button.addEventListener('click', () => selectCommand(button.dataset.command)));
confirmCommand.addEventListener('click', executeSelectedCommand);
targetSelect.addEventListener('change', () => {
  selectedTargetId = targetSelect.value;
  drawBattle();
});
enemyPanel.addEventListener('click', (event) => {
  if (manualInputLocked()) return;
  const card = event.target.closest('[data-actor-id]');
  if (!card) return;
  selectedTargetId = card.dataset.actorId;
  targetSelect.value = selectedTargetId;
  render();
});

speedButtons.forEach((button) => button.addEventListener('click', () => {
  if (manualInputLocked() || engine.result) return;
  if (getEncounterWinCount(advancementState, encounter.id) === 0) {
    addMessage('Battle speed unlocks after this encounter’s first clear.');
    render();
    return;
  }
  const nextSpeed = Number(button.dataset.speed);
  if (enemyIntentSchedule) {
    enemyIntentSchedule = rescaleEnemyIntentSchedule(enemyIntentSchedule, performance.now(), nextSpeed);
  }
  speedMultiplier = nextSpeed;
  advancementState = setSpeedMultiplier(advancementState, speedMultiplier);
  advancementAdapter.save(advancementState);
  render();
}));

autoGrind.addEventListener('click', toggleAutoGrind);

restartBattle.addEventListener('click', () => {
  cancelQueuedAutoGrind();
  autoSettleAt = null;
  battlePlaytimeCategory = getBattlePlaytimeCategory(getEncounterWinCount(advancementState, encounter.id));
  engine = createEngine();
  rewardRecorded = false;
  queuedVictoryRecorded = false;
  victoryPersistenceError = null;
  victorySaveRetryAt = 0;
  selectedTargetId = '';
  clearEnemyIntentSchedule();
  battleFacingByActor.clear();
  battleMotionUntil.clear();
  battleEnemyPoseByActor.clear();
  battleEnemyPoseUntil.clear();
  activeBattleAnimation = null;
  uiMessages = [`Restarted ${encounter.name}. First-clear rewards remain saved; victories can be replayed for grind XP.`];
  render();
});

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return;
  const directions = {
    arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
    arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
    q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1],
  };
  const direction = directions[event.key.toLowerCase()];
  if (direction && !event.repeat) {
    event.preventDefault();
    moveActive(...direction);
  }
});

canvas.addEventListener('click', (event) => {
  if (manualInputLocked()) return;
  const bounds = canvas.getBoundingClientRect();
  const scaleX = canvas.width / bounds.width;
  const scaleY = canvas.height / bounds.height;
  const pointerX = (event.clientX - bounds.left) * scaleX;
  const pointerY = (event.clientY - bounds.top) * scaleY;
  const { cell, originX, originY } = mapGeometry();
  const tile = { x: Math.floor((pointerX - originX) / cell), y: Math.floor((pointerY - originY) / cell) };
  const snapshot = engine.snapshot();
  const actor = activePartyActor(snapshot);
  if (!actor) return;
  const enemy = livingEnemies(snapshot).find((entry) => entry.pos.x === tile.x && entry.pos.y === tile.y);
  if (enemy) {
    selectedTargetId = enemy.instanceId;
    targetSelect.value = selectedTargetId;
    render();
    return;
  }
  moveActive(tile.x - actor.pos.x, tile.y - actor.pos.y);
});

function tick(now) {
  const elapsed = Math.min(1000, Math.max(0, Math.floor(now - playtimeLastSample)));
  playtimeLastSample = now;
  const inactive = isPlaytimeInactive({
    nowMs: now,
    lastActivityMs: playtimeLastActivity,
    visible: document.visibilityState === 'visible',
  });
  const countableElapsed = getBattlePresentationElapsedMs({
    elapsedMs: elapsed,
    intervalEndMs: now,
    result: engine.snapshot().result,
    settling: autoSettleAt !== null,
    animationEndsAt: activeBattleAnimation?.endsAt ?? null,
  });
  if (!inactive && countableElapsed > 0) {
    const category = battlePlaytimeCategory;
    playtimeState = recordPlaytime(playtimeState, category, countableElapsed, { chapterId: encounter.chapterId });
    queueRunReceiptPlaytime(category, countableElapsed);
    playtimeUnsavedMs += countableElapsed;
    if (playtimeUnsavedMs >= 10_000) {
      playtimeAdapter.save(playtimeState);
      playtimeUnsavedMs = 0;
    }
  }
  if (activeBattleAnimation && now >= activeBattleAnimation.endsAt) {
    activeBattleAnimation = null;
    clearEnemyIntentSchedule();
    render();
  }
  if (autoSettleAt !== null && now >= autoSettleAt) {
    autoSettleAt = null;
    if (repeatGrindQueue.active && queuedVictoryRecorded) restartQueuedAutoGrind(now);
    else render();
  }
  if (autoGrindActive && autoActionAt !== null && now >= autoActionAt) {
    autoActionAt = null;
    executeAutoGrindStep(now);
  } else if (!autoInputLocked() && enemyIntentSchedule !== null && now >= enemyIntentSchedule.dueAt && engine.snapshot().phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND) {
    const before = engine.snapshot();
    const enemyActorId = before.activeActorId;
    clearEnemyIntentSchedule();
    const result = engine.resolveEnemyActivation();
    if (!result.ok) addMessage(result.reason);
    markCombatResolutionPose({ ok: result.ok, ...result.resolution }, enemyActorId);
    startCombatAnimation({ ok: result.ok, ...result.resolution }, enemyActorId, before);
    render();
  }
  drawBattle(now);
  requestAnimationFrame(tick);
}

engine = createEngine();
render();
requestAnimationFrame(tick);

function markPlaytimeActivity() {
  playtimeLastActivity = performance.now();
}

window.addEventListener('pointerdown', markPlaytimeActivity, { capture: true, passive: true });
window.addEventListener('keydown', markPlaytimeActivity, { capture: true });
window.addEventListener('pagehide', () => {
  flushRunReceiptPlaytime();
  playtimeAdapter.save(playtimeState);
  if (runReceiptState) runReceiptAdapter.save(runReceiptState);
});
window.addEventListener('pageshow', (event) => {
  // A cached battle owns an engine and settlement flags from the old run.
  // Reloading is the smallest safe rehydration boundary after New Game or
  // any camp/loadout changes made while this page was cached.
  if (event.persisted) window.location.reload();
});
document.addEventListener('visibilitychange', () => {
  playtimeLastSample = performance.now();
  if (document.visibilityState === 'hidden') {
    flushRunReceiptPlaytime();
    playtimeAdapter.save(playtimeState);
    if (runReceiptState) runReceiptAdapter.save(runReceiptState);
  }
});
