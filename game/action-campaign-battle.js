import {
  advanceActionCampaignBattle,
  createActionCampaignBattleResult,
  createActionCampaignBattleSession,
  getActionCampaignAttackChoices,
  getActionCampaignManeuverChoices,
  getActionCampaignSubweaponChoices,
  getCanonicalActionFighterIds,
  parseActionCampaignBattleQuery,
  snapshotActionCampaignBattle,
  switchActionCampaignActor,
} from './action-campaign-battle-model.mjs';
import { getActionBattleCoaching } from './action-battle-coaching.mjs';
import {
  createAdvancementStorageAdapter,
  createAdvancementState,
  getEncounterWinCount,
  getParty,
  preparePartyForEncounter,
} from './advancement.mjs';
import {
  captureCanonicalStorageSnapshot,
  canonicalStorageSnapshotsMatch,
  loadActionLaboratorySeed,
} from './action-laboratory-storage.mjs';
import {
  resolveCompactActionKeyDown,
  resolveCompactActionKeyUp,
} from './action-input-grammar.mjs';
import { getDefaultBrowserStorage } from './browser-storage.mjs';
import { getBattleStageArt } from './battle-stage-art.mjs';
import { BOSS_COMBAT_ATLAS, getBossCombatDrawPlacement, getBossCombatFrame, hasBossCombatTemplate } from './boss-combat-atlas.mjs';
import {
  ENEMY_COMBAT_ANIMATION_ATLAS,
  getEnemyCombatAnimationFrame,
  hasEnemyCombatAnimation,
  sampleEnemyCombatAnimation,
  sampleEnemyCombatAnimationPhase,
} from './enemy-combat-animation-atlas.mjs';
import { ENEMY_ATLAS, getEnemyAtlasFrame } from './enemy-atlas.mjs';
import {
  createLoadoutStorageAdapter,
  createLoadoutState,
  syncPartyVitals,
} from './loadout.mjs';
import {
  createPlaytimeState,
  createPlaytimeStorageAdapter,
  getBattlePlaytimeCategory,
  isPlaytimeInactive,
  recordPlaytime,
} from './playtime.mjs';
import { createQuestStorageAdapter } from './quest-runtime.mjs';
import { createFieldStorageAdapter } from './field-runtime.mjs';
import {
  createRunReceiptStorageAdapter,
  recordRunPlaytime,
} from './run-receipt.mjs';
import { createWitnessChronicleStorageAdapter } from './witness-chronicle-runtime.mjs';
import { settleBattleVictory } from './battle-settlement.mjs';
import { PARTY_COMBAT_ATLAS, getPartyCombatFrame } from './party-combat-atlas.mjs';
import {
  PARTY_ANIMATION_GEOMETRY,
  samplePartyAnimation,
  samplePartyAnimationPhase,
} from './roster-animation-atlas.mjs';
import { loadStoryworldBattlePresentation } from './storyworld-battle-bridge.mjs';
import {
  ACTION_SLICE_STORAGE_KEY,
  getActionSliceExpectedEncounter,
  hydrateActionSliceRun,
  recordActionSliceBattleReceipt,
  serializeActionSliceRun,
} from './action-slice-model.mjs';

const query = parseActionCampaignBattleQuery(window.location.search);
const publicFighterIds = Object.freeze({
  ren: 'ren',
  nikola: 'lise',
  lise: 'lise',
  mateus: 'mateus',
  miyo: 'miyo',
});
const laboratoryQuery = new URLSearchParams(window.location.search);
const sliceRequested = laboratoryQuery.get('slice') === '1';
let sliceRun = null;
if (sliceRequested) {
  const hydrated = hydrateActionSliceRun(sessionStorage.getItem(ACTION_SLICE_STORAGE_KEY));
  const expected = hydrated.ok ? getActionSliceExpectedEncounter(hydrated.value) : null;
  if (hydrated.ok && expected?.encounterId === query.encounterId) sliceRun = hydrated.value;
  else window.location.replace('action-slice.html?checkpoint=invalid');
}
const sliceMode = sliceRun != null;
const canonicalMode = query.canonical && !sliceMode;
const canonicalFighterIds = getCanonicalActionFighterIds(query.encounterId);
const defaultLeadId = canonicalMode ? canonicalFighterIds[0] : 'lise';
const defaultSupportId = canonicalMode ? canonicalFighterIds[1] : 'mateus';
const requestedLeadId = publicFighterIds[String(laboratoryQuery.get('lead') ?? '').toLowerCase()] ?? defaultLeadId;
let requestedSupportId = publicFighterIds[String(laboratoryQuery.get('support') ?? '').toLowerCase()] ?? defaultSupportId;
if (requestedSupportId != null && requestedSupportId === requestedLeadId) {
  requestedSupportId = requestedLeadId === 'mateus' ? 'lise' : 'mateus';
}
const BATTLE_FIGHTER_ACTOR_IDS = Object.freeze(canonicalMode
  ? [...canonicalFighterIds]
  : sliceMode
    ? [...sliceRun.fighters]
    : [requestedLeadId, requestedSupportId]);
const sliceBattleVitals = sliceMode ? structuredClone(sliceRun.vitals) : null;
const canonicalStorage = getDefaultBrowserStorage();
const canonicalStorageAtEntry = captureCanonicalStorageSnapshot(canonicalStorage);
const advancementAdapter = createAdvancementStorageAdapter(canonicalStorage);
const loadoutAdapter = createLoadoutStorageAdapter(canonicalStorage);
const runReceiptAdapter = createRunReceiptStorageAdapter(canonicalStorage);
const playtimeAdapter = createPlaytimeStorageAdapter(canonicalStorage);
const questAdapter = createQuestStorageAdapter(canonicalStorage);
const witnessAdapter = createWitnessChronicleStorageAdapter(canonicalStorage);
const fieldAdapter = createFieldStorageAdapter(canonicalStorage);
const advancementLoad = canonicalMode ? advancementAdapter.load() : null;
const loadoutLoad = canonicalMode ? loadoutAdapter.load() : null;
const receiptLoad = canonicalMode ? runReceiptAdapter.load() : null;
const playtimeLoad = canonicalMode ? playtimeAdapter.load() : null;
const laboratorySeed = sliceMode
  ? { advancement: createAdvancementState(), loadout: createLoadoutState(), runReceipt: null }
  : canonicalMode
    ? {
        advancement: advancementLoad?.ok ? advancementLoad.state : createAdvancementState(),
        loadout: loadoutLoad?.ok ? loadoutLoad.value : createLoadoutState(),
        runReceipt: receiptLoad?.ok && receiptLoad.found ? receiptLoad.state : null,
      }
    : loadActionLaboratorySeed(canonicalStorage);
let advancementState = preparePartyForEncounter(
  laboratorySeed.advancement,
  query.encounterId,
);
let loadoutState = laboratorySeed.loadout;
const syncedLoadout = syncPartyVitals(loadoutState, getParty(advancementState));
if (syncedLoadout.ok) loadoutState = syncedLoadout.state;
let runReceiptState = laboratorySeed.runReceipt;
let playtimeState = canonicalMode && playtimeLoad?.ok ? playtimeLoad.state : createPlaytimeState();
let battlePlaytimeCategory = getBattlePlaytimeCategory(getEncounterWinCount(advancementState, query.encounterId));
let playtimeLastSample = performance.now();
let playtimeLastActivity = playtimeLastSample;
let playtimeUnsavedMs = 0;
let runReceiptPendingMs = 0;
let runReceiptPendingCategory = null;
if (canonicalMode) {
  advancementAdapter.save(advancementState);
  loadoutAdapter.save(loadoutState);
}

let session = createActionCampaignBattleSession({
  encounterId: query.encounterId,
  advancementState,
  loadoutState,
  fighterActorIds: BATTLE_FIGHTER_ACTOR_IDS,
  partyVitals: sliceBattleVitals,
});

const elements = {
  canvas: document.querySelector('#actionCampaignCanvas'),
  pauseCurtain: document.querySelector('#pauseCurtain'),
  battleModeLabel: document.querySelector('#battleModeLabel'),
  encounterTitle: document.querySelector('#encounterTitle'),
  encounterSubtitle: document.querySelector('#encounterSubtitle'),
  campaignLink: document.querySelector('#campaignLink'),
  continueCampaign: document.querySelector('#continueCampaign'),
  stageName: document.querySelector('#stageName'),
  stateBadge: document.querySelector('#battleStateBadge'),
  controlledActor: document.querySelector('#controlledActor'),
  reserveSupport: document.querySelector('#reserveSupport'),
  partyReadout: document.querySelector('#partyReadout'),
  enemyReadout: document.querySelector('#enemyReadout'),
  objectiveText: document.querySelector('#objectiveText'),
  objectiveRuntimeStatus: document.querySelector('#objectiveRuntimeStatus'),
  objectiveRequirements: document.querySelector('#objectiveRequirements'),
  attackTimers: document.querySelector('#attackTimers'),
  subweaponTimers: document.querySelector('#subweaponTimers'),
  movementReadout: document.querySelector('#movementReadout'),
  risingGuide: document.querySelector('#risingGuide'),
  airGuide: document.querySelector('#airGuide'),
  risingTouch: document.querySelector('#risingTouch'),
  airTouch: document.querySelector('#airTouch'),
  comboAvailability: document.querySelector('#comboAvailability'),
  comboArts: document.querySelector('#comboArts'),
  comboProximity: document.querySelector('#comboProximity'),
  comboTitle: document.querySelector('#comboTitle'),
  announcement: document.querySelector('#battleAnnouncement'),
  eventLog: document.querySelector('#eventLog'),
  settlementStatus: document.querySelector('#settlementStatus'),
  restartBattle: document.querySelector('#restartBattle'),
  storyworldCard: document.querySelector('#storyworldCard'),
  storyworldEyebrow: document.querySelector('#storyworldEyebrow'),
  storyworldTitle: document.querySelector('#storyworldTitle'),
  storyworldDecision: document.querySelector('#storyworldDecision'),
  storyworldConsequence: document.querySelector('#storyworldConsequence'),
  battleCoachTitle: document.querySelector('#battleCoachTitle'),
  battleCoachSummary: document.querySelector('#battleCoachSummary'),
  battleCoachSteps: document.querySelector('#battleCoachSteps'),
};

const context = elements.canvas.getContext('2d');
context.imageSmoothingEnabled = false;
const held = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  interact: false,
};
const gamepadHeld = { left: false, right: false, up: false, down: false, jump: false, interact: false };
const previousGamepadButtons = [];
const pressed = { jump: false, attackIndex: null, subweaponId: null, combo: false };
const lastDirectionTapAt = { left: -Infinity, right: -Infinity };
let lastTimestamp = performance.now();
let hidden = document.hidden;
let laboratoryComplete = false;
let laboratoryResult = null;
let settlementRetryAt = 0;
const recentMessages = [];
const flyouts = [];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const displayedObjectiveText = sliceMode && session.encounter.id === 'c1-tithe-hound'
  ? 'Defeat the Tithe Hound.'
  : session.encounter.objective.text;

elements.encounterTitle.textContent = session.encounter.name;
elements.encounterSubtitle.textContent = displayedObjectiveText;
elements.stageName.textContent = session.stage.id.replaceAll('-', ' ').toUpperCase();
elements.campaignLink.href = query.returnTarget;
elements.continueCampaign.href = query.returnTarget;
elements.canvas.dataset.encounterId = session.encounter.id;
elements.canvas.dataset.objectiveType = session.encounter.objective.type;
elements.canvas.dataset.stageId = session.stage.id;
elements.canvas.dataset.stageMinX = String(session.stage.bounds.minX);
elements.canvas.dataset.stageMaxX = String(session.stage.bounds.maxX);
elements.canvas.dataset.sliceMode = String(sliceMode);
elements.canvas.dataset.canonicalMode = String(canonicalMode);
if (sliceMode) {
  elements.battleModeLabel.textContent = 'ACTION SLICE · SESSION CHECKPOINT';
  elements.campaignLink.textContent = 'Leave slice';
  elements.continueCampaign.textContent = 'Continue slice';
  elements.settlementStatus.textContent = 'Victory preserves duo HP only in this session-local slice checkpoint.';
} else if (canonicalMode) {
  elements.battleModeLabel.textContent = 'CAMPAIGN BATTLE · LIVE CONSEQUENCES';
  elements.campaignLink.textContent = 'Leave battle';
  elements.continueCampaign.textContent = 'Continue campaign';
  elements.settlementStatus.textContent = 'Victory will atomically save rewards, surviving HP, route evidence, and first-clear telemetry.';
}

const storyworld = loadStoryworldBattlePresentation({
  encounterId: session.encounter.id,
  runId: runReceiptState?.runId,
});
if (storyworld) {
  elements.storyworldCard.hidden = false;
  elements.storyworldEyebrow.textContent = storyworld.eyebrow;
  elements.storyworldTitle.textContent = storyworld.title;
  elements.storyworldDecision.textContent = storyworld.decisionText;
  elements.storyworldConsequence.textContent = storyworld.consequenceText;
}

const art = {
  party: { image: new Image(), ready: false, source: PARTY_COMBAT_ATLAS },
  partyAnimation: { image: new Image(), ready: false, source: PARTY_ANIMATION_GEOMETRY },
  enemy: { image: new Image(), ready: false, source: ENEMY_ATLAS },
  enemyAnimation: { image: new Image(), ready: false, source: ENEMY_COMBAT_ANIMATION_ATLAS },
  boss: { image: new Image(), ready: false, source: BOSS_COMBAT_ATLAS },
  stage: { image: new Image(), ready: false, source: getBattleStageArt(session.encounter.levelId) },
};

function loadArt(key) {
  const record = art[key];
  if (!record.source) return;
  elements.canvas.dataset[`${key}ArtState`] = 'loading';
  record.image.decoding = 'async';
  record.image.addEventListener('load', () => {
    const width = record.source.width ?? record.source.sourceWidth;
    const height = record.source.height ?? record.source.sourceHeight;
    record.ready = record.image.naturalWidth === width && record.image.naturalHeight === height;
    elements.canvas.dataset[`${key}ArtState`] = record.ready ? 'ready' : 'wrong-size';
  }, { once: true });
  record.image.addEventListener('error', () => {
    elements.canvas.dataset[`${key}ArtState`] = 'unavailable';
  }, { once: true });
  record.image.src = record.source.url;
}

for (const key of ['party', 'partyAnimation', 'enemy', 'enemyAnimation', 'boss', 'stage']) loadArt(key);

function clearHeld() {
  held.left = false;
  held.right = false;
  held.up = false;
  held.down = false;
  held.jump = false;
  held.interact = false;
  lastDirectionTapAt.left = -Infinity;
  lastDirectionTapAt.right = -Infinity;
  pressed.jump = false;
  pressed.attackIndex = null;
  pressed.subweaponId = null;
  pressed.combo = false;
  Object.assign(gamepadHeld, { left: false, right: false, up: false, down: false, jump: false, interact: false });
  previousGamepadButtons.length = 0;
}

function announce(message) {
  if (!message) return;
  const existingIndex = recentMessages.indexOf(message);
  if (existingIndex >= 0) recentMessages.splice(existingIndex, 1);
  recentMessages.unshift(message);
  recentMessages.splice(8);
  elements.announcement.textContent = message;
}

function templateId(actorId) {
  return session.actorTemplates[actorId] ?? actorId;
}

function attackName(attackId) {
  return session.spec.kernelConfig.attacks[attackId]?.name ?? attackId;
}

function maneuverName(maneuverId, actorId = null) {
  return getActionCampaignManeuverChoices(session, actorId ?? undefined)
    .find(({ id }) => id === maneuverId)?.name ?? maneuverId;
}

function queueManeuver(maneuverId) {
  if (hidden || session.outcome) return;
  const inputRequest = { id: maneuverId, requestedAt: performance.now() };
  const snapshot = advanceActionCampaignBattle(session, 0, {
    left: held.left,
    right: held.right,
    jumpHeld: held.jump,
    maneuverPressed: maneuverId,
  });
  consumeSnapshotEvents(snapshot, inputRequest);
  renderDom(snapshot);
}

function queueTagSwitch(direction = 1) {
  if (hidden || session.outcome) return;
  const result = switchActionCampaignActor(session, direction);
  if (!result.ok) {
    const wait = result.remainingMs > 0 ? ` (${result.remainingMs} ms)` : '';
    announce(`Tag unavailable: ${String(result.reason).replaceAll('-', ' ')}${wait}.`);
  }
  renderDom(snapshotActionCampaignBattle(session));
}

function controlledActorIsGrounded() {
  const kernel = snapshotActionCampaignBattle(session).kernel;
  return kernel.actors.find(({ id }) => id === kernel.controlledActorId)?.grounded ?? true;
}

function applyCompactEdge(edge) {
  if (edge?.type === 'maneuver') queueManeuver(edge.id);
  else if (edge?.type === 'jump') pressed.jump = true;
  else if (edge?.type === 'attack') pressed.attackIndex = edge.index;
  else if (edge?.type === 'subweapon') pressed.subweaponId = edge.id;
}

function describeEvent(event, snapshot) {
  const actor = snapshot.kernel.actors.find(({ id }) => id === event.actorId);
  const target = snapshot.kernel.actors.find(({ id }) => id === event.targetId);
  if (event.type === 'combo-start') {
    const arts = snapshot.combo.participants.map(({ attackName }) => attackName).join(' + ');
    return `${snapshot.combo.name} begins: ${arts}.`;
  }
  if (event.type === 'combo-blocked') {
    return `${event.name} unavailable: ${formatComboReason(event.reasons?.[0])}.`;
  }
  if (event.type === 'subweapon-used') {
    return `${actor?.name ?? event.actorId} spends ${event.name}; ${event.stockRemaining} remaining.`;
  }
  if (event.type === 'subweapon-blocked') {
    const wait = event.remainingMs > 0 ? ` (${event.remainingMs} ms)` : '';
    return `${event.name} unavailable: ${String(event.reason).replaceAll('-', ' ')}${wait}.`;
  }
  if (event.type === 'attack-start') return event.comboId
    ? `${actor?.name ?? event.actorId} links ${attackName(event.attackId)} into ${snapshot.combo.name}.`
    : `${actor?.name ?? event.actorId} commits ${attackName(event.attackId)}.`;
  if (event.type === 'attack-complete') return event.comboId
    ? `${actor?.name ?? event.actorId} completes ${attackName(event.attackId)} and can move again.`
    : `${actor?.name ?? event.actorId} can move again; attack ready in ${event.sharedCooldownMs} ms.`;
  if (event.type === 'boss-phase-warning') {
    return `Boss phase warning: ${String(event.toPhaseId).replaceAll('-', ' ')} is next.`;
  }
  if (event.type === 'boss-phase-entered') {
    return `Boss phase: ${String(event.toPhaseId).replaceAll('-', ' ')}.`;
  }
  if (event.type === 'summon-activated') {
    const summoned = snapshot.kernel.actors.find(({ id }) => id === event.summonedActorId);
    return `${actor?.name ?? event.actorId} summons ${summoned?.name ?? event.templateId}.`;
  }
  if (event.type === 'status-applied') {
    return `${actor?.name ?? event.actorId}: ${String(event.statusId).replaceAll('-', ' ')}.`;
  }
  if (event.type === 'effect-displacement') {
    return `${target?.name ?? event.targetId} is ${event.kind === 'pull' ? 'pulled' : 'driven'} ${event.spaces} space${event.spaces === 1 ? '' : 's'}.`;
  }
  if (event.type === 'maneuver-start') return `${actor?.name ?? event.actorId}: ${event.name}.`;
  if (event.type === 'maneuver-complete' && event.reason === 'cancelled') {
    return `${actor?.name ?? event.actorId} cancels ${event.name} into ${String(event.nextAction).replaceAll('-', ' ')}.`;
  }
  if (event.type === 'maneuver-blocked') {
    const wait = event.remainingMs > 0 ? ` (${event.remainingMs} ms)` : '';
    return `${maneuverName(event.maneuverId)} unavailable: ${String(event.reason).replaceAll('-', ' ')}${wait}.`;
  }
  if (event.type === 'hit') {
    const elementalRead = event.essenceMultiplier > 1
      ? ' WEAK'
      : event.essenceMultiplier < 1 ? ' RESIST' : '';
    flyouts.push({
      x: target?.position.x ?? 480,
      y: (target?.position.y ?? 400) - 70,
      text: `${event.damage} ${event.delivery ?? ''}${elementalRead}`.trim(),
      tone: event.essenceMultiplier > 1 ? 'weak' : event.essenceMultiplier < 1 ? 'resist' : 'normal',
      life: 850,
      maxLife: 850,
    });
    const actionName = event.maneuverId ? maneuverName(event.maneuverId, event.actorId) : attackName(event.attackId);
    return `${event.comboId ? `${snapshot.combo.name} linked hit — ` : ''}${actor?.name ?? event.actorId} hits ${target?.name ?? event.targetId} with ${actionName}: ${event.damage} ${event.delivery ?? 'typed'} damage${event.essence ? ` · ${event.essence}` : ''}.`;
  }
  if (event.type === 'hit-ignored') {
    flyouts.push({
      x: target?.position.x ?? 480,
      y: (target?.position.y ?? 400) - 70,
      text: 'INVULNERABLE',
      tone: 'resist',
      life: 520,
      maxLife: 520,
    });
    return `${target?.name ?? event.targetId} is briefly invulnerable.`;
  }
  if (event.type === 'control-switch') return `${actor?.name ?? event.actorId} is now under direct control.`;
  if (event.type === 'combat-end') return event.outcome === 'victory' ? 'Objective and combat conditions complete.' : 'The active party has fallen.';
  return null;
}

function consumeSnapshotEvents(snapshot, inputRequest = null) {
  for (const event of snapshot.recentEvents) {
    announce(describeEvent(event, snapshot));
    if (event.type === 'hit') {
      elements.canvas.dataset.lastHitTargetId = event.targetId;
      elements.canvas.dataset.lastHitDamage = String(event.damage);
      elements.canvas.dataset.lastHitAtMs = String(event.nowMs);
    }
    if (event.type !== 'maneuver-start') continue;
    elements.canvas.dataset.lastManeuverId = event.maneuverId;
    elements.canvas.dataset.lastManeuverStartedAtMs = String(event.nowMs);
    if (inputRequest?.id === event.maneuverId) {
      elements.canvas.dataset.lastManeuverInputLatencyMs = String(Math.max(
        0,
        Math.round((performance.now() - inputRequest.requestedAt) * 100) / 100,
      ));
    }
  }
}

function formatComboReason(reason) {
  if (!reason) return 'formation is not ready';
  if (reason.code === 'initiator-not-participant') return 'control Nikola or Mateus to initiate';
  if (reason.code === 'participant-missing') return `${reason.actorId} is not deployed`;
  if (reason.code === 'participant-defeated') return `${reason.actorId} is defeated`;
  if (reason.code === 'participant-committed') return `${reason.actorId} is committed to another animation`;
  if (reason.code === 'signature-attack-unavailable') return `${reason.actorId}'s contributing art is unavailable`;
  if (reason.code === 'signature-attack-not-ready') return `${reason.actorId}'s contributing art has ${Math.ceil(reason.remainingMs ?? 0)} ms cooldown`;
  if (reason.code === 'allies-too-far') return `allies are ${Math.round(reason.separationPx)} px apart; maximum ${reason.maxAllySeparationPx} px`;
  if (reason.code === 'combat-ended') return 'combat has ended';
  return String(reason.code).replaceAll('-', ' ');
}

function clearPendingRunReceiptPlaytime() {
  runReceiptPendingMs = 0;
  runReceiptPendingCategory = null;
}

function flushRunReceiptPlaytime() {
  if (!canonicalMode || !runReceiptState || runReceiptState.status !== 'active') {
    clearPendingRunReceiptPlaytime();
    return true;
  }
  if (runReceiptPendingMs === 0) return true;
  const result = recordRunPlaytime(
    runReceiptState,
    runReceiptState.runId,
    runReceiptPendingCategory,
    runReceiptPendingMs,
    { chapterId: session.encounter.chapterId },
  );
  if (!result.ok) return false;
  const saved = runReceiptAdapter.save(result.state);
  if (!saved.ok) return false;
  runReceiptState = result.state;
  clearPendingRunReceiptPlaytime();
  return true;
}

function queueRunReceiptPlaytime(category, elapsedMs) {
  if (!canonicalMode || !runReceiptState || runReceiptState.status !== 'active') {
    clearPendingRunReceiptPlaytime();
    return;
  }
  if (runReceiptPendingMs > 0 && category !== runReceiptPendingCategory) flushRunReceiptPlaytime();
  if (runReceiptPendingMs === 0) runReceiptPendingCategory = category;
  runReceiptPendingMs += elapsedMs;
  if (runReceiptPendingMs >= 1000) flushRunReceiptPlaytime();
}

function sampleCanonicalPlaytime(now, elapsedMs) {
  if (!canonicalMode || laboratoryComplete || session.outcome != null) return;
  const sample = Math.max(0, Math.min(1000, Math.floor(elapsedMs)));
  if (sample === 0 || isPlaytimeInactive({
    nowMs: now,
    lastActivityMs: playtimeLastActivity,
    visible: document.visibilityState === 'visible',
  })) return;
  playtimeState = recordPlaytime(
    playtimeState,
    battlePlaytimeCategory,
    sample,
    { chapterId: session.encounter.chapterId },
  );
  queueRunReceiptPlaytime(battlePlaytimeCategory, sample);
  playtimeUnsavedMs += sample;
  if (playtimeUnsavedMs >= 10_000) {
    playtimeAdapter.save(playtimeState);
    playtimeUnsavedMs = 0;
  }
}

function flushCanonicalPlaytime() {
  if (!canonicalMode) return true;
  const receiptSaved = flushRunReceiptPlaytime();
  const playtimeSaved = playtimeAdapter.save(playtimeState);
  if (playtimeSaved.ok) playtimeUnsavedMs = 0;
  return receiptSaved && playtimeSaved.ok;
}

function completeLaboratoryResult() {
  if (laboratoryComplete || session.outcome !== 'victory') return;
  if (canonicalMode && performance.now() < settlementRetryAt) return;
  try {
    laboratoryResult ??= createActionCampaignBattleResult(session);
    if (sliceMode) {
      sliceRun = recordActionSliceBattleReceipt(sliceRun, laboratoryResult);
      sessionStorage.setItem(ACTION_SLICE_STORAGE_KEY, serializeActionSliceRun(sliceRun));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The laboratory result could not be created.';
    elements.settlementStatus.textContent = message;
    announce(message);
    return;
  }
  if (canonicalMode) {
    const settlement = settleBattleVictory({
      resultRecord: laboratoryResult,
      encounter: session.encounter,
      states: {
        advancement: advancementState,
        loadout: loadoutState,
        runReceipt: runReceiptState,
      },
      adapters: {
        advancement: advancementAdapter,
        loadout: loadoutAdapter,
        quest: questAdapter,
        witness: witnessAdapter,
        field: fieldAdapter,
        runReceipt: runReceiptAdapter,
      },
      handoff: query.handoff,
      flushPlaytime: () => ({
        ok: flushCanonicalPlaytime(),
        state: runReceiptState,
      }),
    });
    if (!settlement.ok) {
      settlementRetryAt = performance.now() + 1000;
      elements.canvas.dataset.settlementState = 'retrying';
      elements.settlementStatus.textContent = settlement.message;
      announce(settlement.message);
      return;
    }
    advancementState = settlement.states.advancement;
    loadoutState = settlement.states.loadout;
    runReceiptState = settlement.states.runReceipt;
    settlementRetryAt = 0;
    elements.canvas.dataset.settlementState = 'committed';
    settlement.messages.forEach(announce);
  }
  laboratoryComplete = true;
  elements.canvas.dataset.laboratoryResult = 'complete';
  elements.settlementStatus.textContent = canonicalMode
    ? 'Victory committed atomically: rewards, party vitals, route evidence, and clean-run first-clear proof are saved.'
    : sliceMode
    ? 'Victory and surviving duo HP were saved to the session-only slice checkpoint. Campaign progress, inventory, and rewards are unchanged.'
    : 'Training victory recorded for this session only. Campaign progress, party health, inventory, and rewards are unchanged.';
  elements.continueCampaign.hidden = false;
  elements.continueCampaign.setAttribute('aria-disabled', 'false');
  elements.continueCampaign.focus();
  announce(canonicalMode
    ? 'Victory saved. Continue the campaign when ready.'
    : sliceMode
      ? 'Encounter complete. Continue the combat slice when ready.'
      : 'Training complete. Return to the campaign when ready.');
}

function actorPhase(actor) {
  if (actor.hp <= 0) return 'defeat';
  if (actor.activeAttack) return actor.activeAttack.phase;
  if (actor.activeManeuver) return actor.activeManeuver.id;
  if (!actor.grounded) return 'airborne';
  if (Math.abs(actor.movementIntent.x) > 0) return 'move';
  return 'idle';
}

function partyPose(actor) {
  const phase = actorPhase(actor);
  if (phase === 'defeat') return 'defeat';
  if (phase === 'windup') return 'basic-strike-windup';
  if (phase === 'active') return actor.activeAttack?.attackId.includes('courier-cut') ? 'basic-strike-active' : 'signature-a';
  if (phase === 'recovery') return 'recovery';
  if (phase === 'uppercut') return 'signature-a';
  if (phase === 'thunder-kick') return 'signature-b';
  if (['dash', 'slide', 'move', 'airborne'].includes(phase) && !reducedMotion.matches) return 'move';
  return 'idle';
}

function enemyPose(actor) {
  const phase = actorPhase(actor);
  if (phase === 'defeat') return 'defeat';
  if (phase === 'windup') return 'windup';
  if (phase === 'active') return 'attack';
  if (phase === 'recovery') return 'recovery';
  return 'neutral';
}

function bossPose(actor) {
  const phase = actorPhase(actor);
  if (phase === 'defeat') return 'defeat';
  if (phase === 'windup') return 'telegraph';
  if (phase === 'active') return 'active';
  if (phase === 'recovery') return 'recovery';
  return 'neutral';
}

function drawStage() {
  const gradient = context.createLinearGradient(0, 0, 0, 540);
  gradient.addColorStop(0, '#0a0810');
  gradient.addColorStop(1, '#17101a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 960, 540);
  if (art.stage.ready) {
    context.save();
    context.globalAlpha = .68;
    context.drawImage(art.stage.image, 0, -10, 960, 560);
    context.restore();
  }
  context.fillStyle = 'rgba(4, 3, 8, .38)';
  context.fillRect(0, session.stage.groundY, 960, 540 - session.stage.groundY);
  context.strokeStyle = '#695163';
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(0, session.stage.groundY);
  context.lineTo(960, session.stage.groundY);
  context.stroke();
  for (const platform of session.stage.platforms) {
    context.strokeStyle = '#8b6d78';
    context.lineWidth = 5;
    context.beginPath();
    context.moveTo(platform.left, platform.y);
    context.lineTo(platform.right, platform.y);
    context.stroke();
  }
  for (const anchor of session.stage.objectiveAnchors) {
    context.fillStyle = 'rgba(214, 184, 102, .12)';
    context.strokeStyle = 'rgba(229, 199, 116, .62)';
    context.lineWidth = 2;
    context.fillRect(anchor.x - anchor.width / 2, anchor.y - anchor.height, anchor.width, anchor.height);
    context.strokeRect(anchor.x - anchor.width / 2, anchor.y - anchor.height, anchor.width, anchor.height);
    context.fillStyle = '#e1c675';
    context.font = '700 9px ui-monospace, monospace';
    context.textAlign = 'center';
    context.fillText(anchor.id.toUpperCase(), anchor.x, anchor.y - anchor.height - 6);
  }
}

function drawObjectiveEntities(snapshot) {
  const entities = snapshot.objective.entities;
  if (!entities) return;
  for (const object of entities.objects) {
    const left = object.position.x - object.bounds.width / 2;
    const top = object.position.y - object.bounds.height;
    context.save();
    context.globalAlpha = object.destroyed ? 0.38 : 1;
    context.fillStyle = object.attackable ? '#6f4f86' : '#7e6849';
    context.strokeStyle = object.attackable ? '#dfb4ff' : '#f1d386';
    context.lineWidth = object.attackable ? 3 : 2;
    context.fillRect(left, top, object.bounds.width, object.bounds.height);
    context.strokeRect(left, top, object.bounds.width, object.bounds.height);
    context.fillStyle = '#fff4c8';
    context.font = '800 9px ui-monospace, monospace';
    context.textAlign = 'center';
    context.fillText(
      `${object.id.toUpperCase()} ${object.hp}/${object.maxHp}`,
      object.position.x,
      top - 7,
    );
    context.restore();
  }
  for (const token of entities.tokens) {
    context.save();
    context.translate(token.position.x, token.position.y);
    context.globalAlpha = token.hp <= 0 ? 0.4 : 1;
    context.fillStyle = token.released ? '#d7cab2' : '#8d7897';
    context.strokeStyle = token.secured ? '#8be0a4' : '#f1d386';
    context.lineWidth = token.secured ? 4 : 2;
    context.fillRect(
      -token.bounds.width / 2,
      -token.bounds.height,
      token.bounds.width,
      token.bounds.height,
    );
    context.strokeRect(
      -token.bounds.width / 2,
      -token.bounds.height,
      token.bounds.width,
      token.bounds.height,
    );
    context.fillStyle = '#fff4c8';
    context.font = '800 9px ui-monospace, monospace';
    context.textAlign = 'center';
    context.fillText(
      `${token.id.toUpperCase()} ${token.hp}/${token.maxHp}`,
      0,
      -token.bounds.height - 7,
    );
    context.restore();
  }
}

function drawFallback(actor, color) {
  const sliding = actor.activeManeuver?.id === 'slide';
  const height = sliding ? 28 : 52;
  context.fillStyle = color;
  context.fillRect(actor.position.x - 18, actor.position.y - height, 36, height);
}

function attackPhaseProgress(actor) {
  const active = actor.activeAttack;
  const attack = active ? session.spec.kernelConfig.attacks[active.attackId] : null;
  if (!active || !attack) return 0;
  if (active.phase === 'windup') return attack.windupMs ? active.elapsedMs / attack.windupMs : 1;
  if (active.phase === 'active') {
    return attack.activeMs ? (active.elapsedMs - attack.windupMs) / attack.activeMs : 1;
  }
  const recoveryElapsed = active.elapsedMs - attack.windupMs - attack.activeMs;
  return attack.recoveryMs ? recoveryElapsed / attack.recoveryMs : 1;
}

function partyActionClip(actor) {
  const attackId = actor.activeAttack?.attackId;
  if (!attackId) return null;
  if (actor.activeAttack.comboId || attackId.startsWith('subweapon:')) return 'signature-b';
  const index = Object.keys(actor.attackStates ?? {}).indexOf(attackId);
  return index <= 0 ? 'basic-strike' : index === 1 ? 'signature-a' : 'signature-b';
}

function richPartyFrame(actor, nowMs) {
  const memberId = templateId(actor.id);
  if (actor.hp <= 0) return samplePartyAnimation(memberId, 'defeat', Number.MAX_SAFE_INTEGER);
  if (actor.hitStunRemainingMs > 0) {
    return samplePartyAnimation(memberId, 'hurt', (100 - actor.hitStunRemainingMs) * 4.4);
  }
  if (actor.activeAttack) {
    return samplePartyAnimationPhase(
      memberId,
      partyActionClip(actor),
      actor.activeAttack.phase,
      attackPhaseProgress(actor),
    );
  }
  if (actor.activeManeuver?.id === 'uppercut') {
    return samplePartyAnimation(memberId, 'signature-a', actor.activeManeuver.elapsedMs * 3);
  }
  if (actor.activeManeuver?.id === 'thunder-kick') {
    return samplePartyAnimation(memberId, 'signature-b', actor.activeManeuver.elapsedMs * 2);
  }
  if (!actor.grounded || actor.activeManeuver || Math.abs(actor.movementIntent.x) > 0) {
    return samplePartyAnimation(memberId, 'move', reducedMotion.matches ? 0 : nowMs);
  }
  return samplePartyAnimation(memberId, 'idle', reducedMotion.matches ? 0 : nowMs);
}

function drawParty(actor, nowMs) {
  const fallbackFrame = getPartyCombatFrame(templateId(actor.id), partyPose(actor));
  const richFrame = art.partyAnimation.ready ? richPartyFrame(actor, nowMs) : null;
  const frame = richFrame
    ? {
        x: richFrame.rect[0],
        y: richFrame.rect[1],
        width: richFrame.rect[2],
        height: richFrame.rect[3],
        pivotX: richFrame.pivot[0],
        pivotY: richFrame.pivot[1],
      }
    : fallbackFrame;
  const image = richFrame ? art.partyAnimation.image : art.party.image;
  const scale = 1.75;
  if (!richFrame && !art.party.ready) return drawFallback(actor, '#78c4c1');
  const maneuver = actor.activeManeuver;
  if (maneuver && ['dash', 'slide'].includes(maneuver.id) && !reducedMotion.matches) {
    for (const [index, distance] of [18, 34].entries()) {
      context.save();
      context.globalAlpha = index === 0 ? 0.2 : 0.09;
      context.translate(actor.position.x - maneuver.direction * distance, actor.position.y);
      if (actor.facing < 0) context.scale(-1, 1);
      context.drawImage(image, frame.x, frame.y, frame.width, frame.height,
        -frame.pivotX * scale, -frame.pivotY * scale, frame.width * scale, frame.height * scale);
      context.restore();
    }
  }
  context.save();
  context.translate(actor.position.x, actor.position.y);
  if (actor.facing < 0) context.scale(-1, 1);
  if (maneuver?.id === 'slide') {
    context.translate(0, 5);
    context.scale(1.08, 0.72);
  } else if (maneuver?.id === 'thunder-kick') {
    context.rotate(actor.facing * 0.34);
  }
  context.drawImage(image, frame.x, frame.y, frame.width, frame.height,
    -frame.pivotX * scale, -frame.pivotY * scale, frame.width * scale, frame.height * scale);
  context.restore();
}

function richEnemyFrame(actor, nowMs) {
  const template = templateId(actor.id);
  if (!hasEnemyCombatAnimation(template)) return null;
  if (actor.hp <= 0) {
    return sampleEnemyCombatAnimationPhase(template, 'hurt-defeat', 'defeat', 1);
  }
  if (actor.hitStunRemainingMs > 0) {
    return sampleEnemyCombatAnimationPhase(
      template,
      'hurt-defeat',
      'hurt',
      1 - (actor.hitStunRemainingMs / 100),
    );
  }
  if (actor.activeAttack) {
    const attackIndex = Object.keys(actor.attackStates ?? {}).indexOf(actor.activeAttack.attackId);
    return sampleEnemyCombatAnimationPhase(
      template,
      attackIndex <= 0 ? 'basic-attack' : 'signature-attack',
      actor.activeAttack.phase,
      attackPhaseProgress(actor),
    );
  }
  if (!actor.grounded || Math.abs(actor.movementIntent.x) > 0) {
    return sampleEnemyCombatAnimation(template, 'locomotion', reducedMotion.matches ? 0 : nowMs);
  }
  return getEnemyCombatAnimationFrame(template, 'locomotion', 5);
}

function drawEnemy(actor, nowMs) {
  const template = templateId(actor.id);
  if (hasBossCombatTemplate(template)) {
    const frame = getBossCombatFrame(template, bossPose(actor));
    const placement = getBossCombatDrawPlacement(frame, {
      anchorX: actor.position.x,
      groundY: actor.position.y,
      drawHeight: frame.height * Math.min(1.35, frame.scale),
    });
    if (!art.boss.ready) return drawFallback(actor, '#cb4652');
    context.save();
    if (actor.facing > 0) {
      context.translate(actor.position.x * 2, 0);
      context.scale(-1, 1);
    }
    context.drawImage(art.boss.image, frame.x, frame.y, frame.width, frame.height,
      placement.x, placement.y, placement.width, placement.height);
    context.restore();
    return;
  }
  const richFrame = art.enemyAnimation.ready ? richEnemyFrame(actor, nowMs) : null;
  if (richFrame) {
    context.save();
    context.translate(actor.position.x, actor.position.y);
    if (actor.facing > 0) context.scale(-1, 1);
    const scale = richFrame.presentationScale;
    context.drawImage(
      art.enemyAnimation.image,
      richFrame.x,
      richFrame.y,
      richFrame.width,
      richFrame.height,
      -richFrame.pivotX * scale,
      -richFrame.pivotY * scale,
      richFrame.width * scale,
      richFrame.height * scale,
    );
    context.restore();
    return;
  }
  const frame = getEnemyAtlasFrame(template, enemyPose(actor));
  const scale = 1.45;
  if (!art.enemy.ready) return drawFallback(actor, '#cb4652');
  context.save();
  context.translate(actor.position.x, actor.position.y);
  if (actor.facing > 0) context.scale(-1, 1);
  context.drawImage(art.enemy.image, frame.x, frame.y, frame.width, frame.height,
    -(frame.width / 2) * scale, -(frame.height - 7) * scale, frame.width * scale, frame.height * scale);
  context.restore();
}

function drawActors(snapshot) {
  const nowMs = snapshot.kernel.nowMs;
  const ordered = [...snapshot.kernel.actors].sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id));
  for (const actor of ordered) {
    if (actor.hp <= 0 && actor.statuses.some(({ id }) => id === 'dormant-summon')) continue;
    context.fillStyle = 'rgba(0,0,0,.42)';
    context.beginPath();
    context.ellipse(actor.position.x, actor.position.y + 2, actor.faction === 'player' ? 26 : 34, 7, 0, 0, Math.PI * 2);
    context.fill();
    const drawActorBody = () => {
      if (actor.faction === 'player') drawParty(actor, nowMs);
      else if (actor.faction === 'enemy') drawEnemy(actor, nowMs);
    };
    drawActorBody();
    if (actor.hitFlashRemainingMs > 0) {
      context.save();
      context.globalAlpha = Math.min(0.72, actor.hitFlashRemainingMs / 120);
      context.filter = 'brightness(3) saturate(0)';
      drawActorBody();
      context.restore();
      const hurtbox = actor.effectiveHurtbox;
      context.save();
      context.globalAlpha = Math.min(0.9, actor.hitFlashRemainingMs / 90);
      context.strokeStyle = '#fff3d0';
      context.lineWidth = 3;
      context.strokeRect(hurtbox.left - 3, hurtbox.top - 3,
        hurtbox.right - hurtbox.left + 6, hurtbox.bottom - hurtbox.top + 6);
      context.restore();
    }
    const isDirectlyControlled = actor.id === snapshot.kernel.controlledActorId;
    context.fillStyle = isDirectlyControlled ? '#ffe18b' : '#ddd2bf';
    context.font = '700 10px ui-monospace, monospace';
    context.textAlign = 'center';
    context.fillText(actor.name.toUpperCase(), actor.position.x, actor.position.y - (actor.faction === 'player' ? 118 : 126));
    if (actor.faction === 'player') {
      context.fillStyle = isDirectlyControlled ? '#ffe18b' : '#78c4c1';
      context.font = '800 8px ui-monospace, monospace';
      context.fillText(isDirectlyControlled ? 'YOU' : 'AI SUPPORT', actor.position.x, actor.position.y - 106);
    }
  }
}

function drawFlyouts(elapsedMs) {
  context.save();
  context.font = '900 15px ui-monospace, monospace';
  context.textAlign = 'center';
  context.lineJoin = 'round';
  for (let index = flyouts.length - 1; index >= 0; index -= 1) {
    const item = flyouts[index];
    item.life -= elapsedMs;
    if (item.life <= 0) { flyouts.splice(index, 1); continue; }
    context.globalAlpha = Math.min(1, item.life / 180);
    context.fillStyle = item.tone === 'weak' ? '#fff0a6' : item.tone === 'resist' ? '#9fd8e8' : '#f3d795';
    context.strokeStyle = 'rgba(8, 5, 12, .92)';
    context.lineWidth = 4;
    const y = item.y - (reducedMotion.matches ? 0 : (item.maxLife - item.life) * .03);
    context.strokeText(item.text.toUpperCase(), item.x, y);
    context.fillText(item.text.toUpperCase(), item.x, y);
  }
  context.restore();
}

function draw(snapshot, elapsedMs) {
  drawStage();
  drawObjectiveEntities(snapshot);
  drawActors(snapshot);
  drawFlyouts(elapsedMs);
  if (snapshot.outcome) {
    context.fillStyle = 'rgba(5, 4, 9, .64)';
    context.fillRect(0, 0, 960, 540);
    context.fillStyle = snapshot.outcome === 'victory' ? '#e8cf7b' : '#e26772';
    context.font = '500 48px Georgia, serif';
    context.textAlign = 'center';
    context.fillText(
      snapshot.outcome === 'victory' ? (canonicalMode ? 'Victory' : 'Training Complete') : 'Party Defeated',
      480,
      250,
    );
    context.fillStyle = '#d2c7b5';
    context.font = '700 12px ui-monospace, monospace';
    context.fillText(
      snapshot.outcome === 'victory'
        ? laboratoryComplete
          ? (canonicalMode ? 'CAMPAIGN SAVED' : 'TRAINING COMPLETE')
          : (canonicalMode ? 'COMMITTING VICTORY…' : 'RECORDING RESULT…')
        : 'PRESS R TO RESTART',
      480,
      278,
    );
  }
}

function actorListItem(actor, controlledActorId) {
  const item = document.createElement('li');
  item.dataset.actorId = actor.id;
  item.dataset.faction = actor.faction;
  item.dataset.defeated = String(actor.hp <= 0);
  item.dataset.hp = String(Math.ceil(actor.hp));
  item.dataset.maxHp = String(Math.ceil(actor.maxHp));
  item.dataset.positionX = String(Math.round(actor.position.x * 100) / 100);
  item.dataset.positionY = String(Math.round(actor.position.y * 100) / 100);
  item.dataset.activePhase = actor.activeAttack?.phase ?? '';
  const isDirectlyControlled = actor.id === controlledActorId;
  const controlRole = actor.faction === 'player' ? (isDirectlyControlled ? 'direct' : 'support') : 'hostile';
  item.dataset.controlRole = controlRole;
  const name = document.createElement('span');
  name.textContent = `${controlRole === 'direct' ? 'YOU · ' : controlRole === 'support' ? 'AI SUPPORT · ' : ''}${actor.name}`;
  const hp = document.createElement('strong');
  hp.textContent = `${Math.ceil(actor.hp)} / ${Math.ceil(actor.maxHp)} HP · ${Math.round(actor.guard)} Armor`;
  const radiance = document.createElement('small');
  const radianceMultiplier = actor.resistances?.essence?.radiance ?? 1;
  radiance.textContent = radianceMultiplier === 1
    ? 'Radiance neutral'
    : `Radiance ${Math.round(radianceMultiplier * 100)}% · ${radianceMultiplier > 1 ? 'WEAK' : 'RESIST'}`;
  const state = document.createElement('small');
  const statuses = actor.statuses
    .filter(({ id }) => id !== 'dormant-summon')
    .map(({ id }) => String(id).replaceAll('-', ' ').toUpperCase());
  state.textContent = actor.hp <= 0
    ? actor.statuses.some(({ id }) => id === 'dormant-summon') ? 'DORMANT SUMMON' : 'DEFEATED'
    : actor.hitStunRemainingMs > 0
      ? `HIT STUN · ${actor.hitStunRemainingMs} ms`
      : actor.activeAttack
      ? `${attackName(actor.activeAttack.attackId)} · ${actor.activeAttack.phase}`
      : actor.activeManeuver
        ? maneuverName(actor.activeManeuver.id, actor.id).toUpperCase()
        : `FREE MOVEMENT${statuses.length ? ` · ${statuses.join(' / ')}` : ''}`;
  item.append(name, hp, radiance, state);
  return item;
}

function renderDom(snapshot) {
  const controlled = snapshot.kernel.actors.find(({ id }) => id === snapshot.kernel.controlledActorId);
  const party = snapshot.kernel.actors.filter(({ faction }) => faction === 'player');
  const support = party.find(({ id }) => id === snapshot.duo.supportActorId);
  const movementState = controlled?.activeManeuver
    ? maneuverName(controlled.activeManeuver.id)
    : controlled?.grounded ? 'Grounded' : 'Airborne';
  elements.controlledActor.textContent = controlled
    ? `${controlled.name} · Level ${controlled.level} · ${movementState} · ${Math.round(Math.abs(controlled.velocity.x))} px/s · Support: ${support?.name ?? 'none'}`
    : 'No living controlled fighter';
  const reserveSupportIds = session.spec.passiveSupportActorIds ?? [];
  elements.reserveSupport.hidden = reserveSupportIds.length === 0;
  elements.reserveSupport.textContent = reserveSupportIds.includes('aya')
    ? 'Reserve support · Aya heals the most wounded living fighter below 80% HP every 2.2 seconds.'
    : '';
  const enemies = snapshot.kernel.actors.filter(({ faction }) => faction === 'enemy');
  elements.partyReadout.replaceChildren(...party.map((actor) => actorListItem(actor, snapshot.kernel.controlledActorId)));
  elements.enemyReadout.replaceChildren(...enemies.map((actor) => actorListItem(actor, snapshot.kernel.controlledActorId)));
  const phaseLabel = snapshot.bossPhase
    ? /\bphase\b/iu.test(snapshot.bossPhase.name)
      ? snapshot.bossPhase.name
      : `${snapshot.bossPhase.name} phase`
    : '';
  elements.encounterSubtitle.textContent = snapshot.bossPhase
    ? `${displayedObjectiveText} · ${phaseLabel}`
    : displayedObjectiveText;
  const coaching = getActionBattleCoaching(session.encounter.id, snapshot);
  elements.battleCoachTitle.textContent = coaching.title;
  elements.battleCoachSummary.textContent = coaching.summary;
  elements.battleCoachSteps.replaceChildren(...coaching.steps.map((step) => {
    const item = document.createElement('li');
    item.textContent = step;
    return item;
  }));

  elements.objectiveText.textContent = displayedObjectiveText;
  elements.objectiveRuntimeStatus.dataset.supported = String(snapshot.objective.supported);
  elements.objectiveRuntimeStatus.textContent = snapshot.objective.supported
    ? (snapshot.objective.complete ? 'Completed' : 'In progress')
    : 'This scenario is not available in Action Lab yet.';
  const requirementItems = snapshot.objective.requirements.map((requirement) => {
    const item = document.createElement('li');
    item.dataset.complete = String(requirement.complete);
    item.dataset.available = String(requirement.available);
    item.dataset.semantics = requirement.semantics;
    item.dataset.requirementId = requirement.id;
    item.dataset.targetX = requirement.targetAnchor == null ? '' : String(requirement.targetAnchor.x);
    item.dataset.targetY = requirement.targetAnchor == null ? '' : String(requirement.targetAnchor.y);
    item.dataset.castDurationMs = requirement.castDurationMs == null ? '' : String(requirement.castDurationMs);
    item.dataset.castElapsedMs = requirement.castElapsedMs == null ? '' : String(requirement.castElapsedMs);
    item.textContent = `${requirement.complete ? '✓' : '○'} ${requirement.id.replaceAll('-', ' ')}`;
    return item;
  });
  const entityItems = [
    ...(snapshot.objective.entities?.tokens ?? []).map((token) => {
      const item = document.createElement('li');
      const destination = token.destination;
      item.dataset.entityType = 'token';
      item.dataset.entityId = token.id;
      item.dataset.complete = String(token.secured);
      item.dataset.released = String(token.released);
      item.dataset.recruited = String(token.recruited);
      item.dataset.positionX = String(Math.round(token.position.x * 100) / 100);
      item.dataset.positionY = String(Math.round(token.position.y * 100) / 100);
      item.dataset.destinationX = destination == null ? '' : String(Math.round(destination.x * 100) / 100);
      item.dataset.destinationY = destination == null ? '' : String(Math.round(destination.y * 100) / 100);
      item.textContent = `${token.secured ? '✓' : token.released ? '→' : '○'} ${token.id.replaceAll('-', ' ')} · ${token.hp}/${token.maxHp} HP · ${
        token.secured ? 'secured' : token.released ? token.recruited ? 'following' : 'awaiting escort' : 'chained'
      }`;
      return item;
    }),
    ...(snapshot.objective.entities?.objects ?? []).map((object) => {
      const item = document.createElement('li');
      item.dataset.entityType = 'object';
      item.dataset.entityId = object.id;
      item.dataset.complete = String(object.attackable ? object.destroyed : !object.destroyed);
      item.dataset.attackable = String(object.attackable);
      item.dataset.protected = String(object.protected);
      item.dataset.positionX = String(Math.round(object.position.x * 100) / 100);
      item.dataset.positionY = String(Math.round(object.position.y * 100) / 100);
      item.textContent = `${object.destroyed ? '×' : object.attackable ? '◇' : '◆'} ${object.id.replaceAll('-', ' ')} · ${object.hp}/${object.maxHp} HP`;
      return item;
    }),
  ];
  elements.objectiveRequirements.replaceChildren(...requirementItems, ...entityItems);

  elements.comboTitle.textContent = snapshot.combo.name;
  elements.comboAvailability.dataset.available = String(snapshot.combo.available || snapshot.combo.active);
  elements.comboAvailability.textContent = snapshot.combo.active
    ? 'LINKED · both fighters are committed'
    : snapshot.combo.available
      ? 'READY · press L to invoke the linked cast'
      : `LOCKED · ${formatComboReason(snapshot.combo.reasons[0])}`;
  elements.comboArts.replaceChildren(...snapshot.combo.participants.map((participant) => {
    const item = document.createElement('li');
    item.textContent = `${participant.role.toUpperCase()} · ${participant.attackName} · ${participant.delivery} · ${participant.essence}`;
    return item;
  }));
  elements.comboProximity.textContent = snapshot.combo.separationPx == null
    ? `Proximity unavailable · maximum ${snapshot.combo.maxAllySeparationPx} px`
    : `Nikola ↔ Mateus ${Math.round(snapshot.combo.separationPx)} px · maximum ${snapshot.combo.maxAllySeparationPx} px`;

  const choices = getActionCampaignAttackChoices(session, snapshot.kernel.controlledActorId);
  elements.attackTimers.replaceChildren(...choices.map((choice, index) => {
    const row = document.createElement('div');
    row.className = 'attack-timer';
    row.dataset.attackId = choice.id;
    row.dataset.attackIndex = String(index);
    row.dataset.ready = String(choice.state.ready);
    row.dataset.reason = choice.state.reason ?? '';
    row.dataset.cooldownRemainingMs = String(choice.state.effectiveCooldownRemainingMs);
    row.dataset.reachPx = String(session.spec.kernelConfig.attacks[choice.id].hitbox.width);
    const name = document.createElement('strong');
    name.textContent = `${choice.name} · ${choice.delivery}${choice.essence ? ` · ${choice.essence}` : ''}`;
    const output = document.createElement('output');
    const remaining = choice.state.effectiveCooldownRemainingMs;
    output.textContent = choice.state.reason === 'hit-stun'
      ? 'HIT STUN'
      : ['animation-commitment', 'maneuver-commitment'].includes(choice.state.reason)
      ? 'COMMITTED'
      : remaining > 0 ? `${remaining} ms` : 'READY';
    const meter = document.createElement('div');
    meter.className = 'meter';
    meter.setAttribute('role', 'meter');
    meter.setAttribute('aria-label', `${choice.name} cooldown`);
    meter.setAttribute('aria-valuemin', '0');
    meter.setAttribute('aria-valuemax', String(Math.max(1, session.spec.kernelConfig.attacks[choice.id].cooldownMs ?? 1)));
    meter.setAttribute('aria-valuenow', String(remaining));
    const bar = document.createElement('span');
    bar.style.transform = `scaleX(${Math.min(1, remaining / Math.max(1, session.spec.kernelConfig.attacks[choice.id].cooldownMs ?? 1))})`;
    meter.append(bar);
    row.append(name, output, meter);
    return row;
  }));

  const subweapons = getActionCampaignSubweaponChoices(session, snapshot.kernel.controlledActorId);
  elements.subweaponTimers.replaceChildren(...subweapons.map((choice) => {
    const row = document.createElement('div');
    row.className = 'attack-timer';
    row.dataset.ready = String(choice.state.ready);
    row.dataset.subweaponId = choice.id;
    row.dataset.input = choice.input;
    row.dataset.stock = String(choice.stock);
    row.dataset.reachPx = String(session.spec.kernelConfig.attacks[choice.attackId].hitbox.width);
    const name = document.createElement('strong');
    name.textContent = `${choice.name} ×${choice.stock} · ${choice.input}`;
    const output = document.createElement('output');
    output.textContent = choice.stock <= 0
      ? 'EMPTY'
      : choice.state.effectiveCooldownRemainingMs > 0
        ? `${choice.state.effectiveCooldownRemainingMs} ms`
        : choice.state.ready ? 'READY' : String(choice.state.reason).replaceAll('-', ' ');
    const detail = document.createElement('small');
    detail.textContent = choice.description;
    row.append(name, output, detail);
    return row;
  }));

  const maneuvers = getActionCampaignManeuverChoices(session, snapshot.kernel.controlledActorId);
  const risingName = maneuvers.find(({ id }) => id === 'uppercut')?.name ?? 'Rising maneuver';
  const airName = maneuvers.find(({ id }) => id === 'thunder-kick')?.name ?? 'Air descent';
  if (elements.risingGuide) elements.risingGuide.textContent = risingName;
  if (elements.airGuide) elements.airGuide.textContent = airName;
  if (elements.risingTouch) elements.risingTouch.textContent = risingName;
  if (elements.airTouch) elements.airTouch.textContent = airName;
  elements.movementReadout.replaceChildren(...maneuvers.map((choice) => {
    const item = document.createElement('span');
    item.dataset.ready = String(choice.state.ready);
    const remaining = choice.state.cooldownRemainingMs;
    item.textContent = `${choice.name}: ${remaining > 0 ? `${remaining} ms` : choice.state.ready ? 'READY' : String(choice.state.reason).replaceAll('-', ' ')}`;
    return item;
  }));

  elements.stateBadge.dataset.state = snapshot.outcome ?? snapshot.objective.status;
  elements.stateBadge.textContent = snapshot.outcome?.toUpperCase() ?? (hidden ? 'PAUSED' : snapshot.objective.status.toUpperCase());
  elements.eventLog.replaceChildren(...recentMessages.map((message) => {
    const item = document.createElement('li');
    item.textContent = message;
    return item;
  }));
  elements.canvas.dataset.outcome = snapshot.outcome ?? 'active';
  elements.canvas.dataset.objectiveSupported = String(snapshot.objective.supported);
  elements.canvas.dataset.objectiveComplete = String(snapshot.objective.complete);
  elements.canvas.dataset.objectiveTokenCount = String(snapshot.objective.entities?.tokens.length ?? 0);
  elements.canvas.dataset.objectiveObjectCount = String(snapshot.objective.entities?.objects.length ?? 0);
  elements.canvas.dataset.objectiveBellCount = String(snapshot.objective.entities?.bellCount ?? 0);
  elements.canvas.dataset.bossPhaseId = snapshot.bossPhase?.phaseId ?? '';
  elements.canvas.dataset.bossPhaseRevision = String(snapshot.bossPhase?.revision ?? 0);
  elements.canvas.dataset.combatSatisfied = String(snapshot.combatSatisfied);
  elements.canvas.dataset.controlledActorId = snapshot.kernel.controlledActorId ?? '';
  elements.canvas.dataset.duoEnabled = String(snapshot.duo.enabled);
  elements.canvas.dataset.supportActorId = snapshot.duo.supportActorId ?? '';
  elements.canvas.dataset.supportState = support == null
    ? 'unavailable'
    : support.activeAttack ? 'attacking' : Math.abs(support.velocity.x) > 0 ? 'moving' : 'guarding';
  elements.canvas.dataset.tagCooldownRemainingMs = String(snapshot.kernel.tagCooldownRemainingMs);
  elements.canvas.dataset.movementState = controlled?.activeManeuver?.id ?? (controlled?.grounded ? 'grounded' : 'airborne');
  elements.canvas.dataset.movementProfileId = controlled?.movementProfileId ?? '';
  elements.canvas.dataset.movementVelocityX = controlled == null ? '' : String(Math.round(controlled.velocity.x));
  elements.canvas.dataset.movementVelocityY = controlled == null ? '' : String(Math.round(controlled.velocity.y));
  elements.canvas.dataset.movementPositionX = controlled == null ? '' : String(Math.round(controlled.position.x * 100) / 100);
  elements.canvas.dataset.airDashUsesRemaining = controlled == null ? '' : String(controlled.airDashUsesRemaining);
  elements.canvas.dataset.airJumpUsesRemaining = controlled == null ? '' : String(controlled.airJumpUsesRemaining);
  elements.canvas.dataset.wallContactSide = controlled?.wallContactSide == null ? '' : String(controlled.wallContactSide);
  elements.canvas.dataset.hitStunRemainingMs = controlled == null ? '' : String(controlled.hitStunRemainingMs);
  elements.canvas.dataset.hitInvulnerabilityRemainingMs = controlled == null
    ? ''
    : String(controlled.hitInvulnerabilityRemainingMs);
  elements.canvas.dataset.comboId = snapshot.combo.comboId;
  elements.canvas.dataset.comboAvailable = String(snapshot.combo.available);
  elements.canvas.dataset.comboActive = String(snapshot.combo.active);
  elements.canvas.dataset.comboSeparationPx = snapshot.combo.separationPx == null ? '' : String(Math.round(snapshot.combo.separationPx));
  elements.canvas.dataset.paused = String(hidden);
}

function restart() {
  session = createActionCampaignBattleSession({
    encounterId: query.encounterId,
  advancementState,
  loadoutState,
    fighterActorIds: BATTLE_FIGHTER_ACTOR_IDS,
  partyVitals: sliceBattleVitals,
});
  laboratoryComplete = false;
  laboratoryResult = null;
  settlementRetryAt = 0;
  battlePlaytimeCategory = getBattlePlaytimeCategory(getEncounterWinCount(advancementState, query.encounterId));
  playtimeLastSample = performance.now();
  playtimeLastActivity = playtimeLastSample;
  recentMessages.length = 0;
  flyouts.length = 0;
  elements.canvas.dataset.laboratoryResult = 'active';
  delete elements.canvas.dataset.lastManeuverId;
  delete elements.canvas.dataset.lastManeuverInputLatencyMs;
  delete elements.canvas.dataset.lastManeuverStartedAtMs;
  elements.settlementStatus.textContent = canonicalMode
    ? 'Battle restarted from the last committed campaign state; no unfinished victory was saved.'
    : sliceMode
    ? 'Encounter restored from the session-only slice checkpoint.'
    : 'This training session never changes campaign progress or party state.';
  elements.continueCampaign.hidden = true;
  elements.continueCampaign.setAttribute('aria-disabled', 'true');
  clearHeld();
  announce(`Restarted ${session.encounter.name}.`);
  elements.canvas.focus();
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement;
}

function pollBattleGamepad() {
  const pad = navigator.getGamepads?.().find(Boolean);
  if (!pad || hidden) {
    Object.assign(gamepadHeld, { left: false, right: false, up: false, down: false, jump: false, interact: false });
    previousGamepadButtons.length = 0;
    return;
  }
  const down = (index) => Boolean(pad.buttons[index]?.pressed);
  const edge = (index) => down(index) && !previousGamepadButtons[index];
  const axisX = Math.abs(pad.axes[0] ?? 0) >= .28 ? pad.axes[0] : 0;
  const axisY = Math.abs(pad.axes[1] ?? 0) >= .4 ? pad.axes[1] : 0;
  gamepadHeld.left = down(14) || axisX < 0;
  gamepadHeld.right = down(15) || axisX > 0;
  gamepadHeld.up = down(12) || axisY < 0;
  gamepadHeld.down = down(13) || axisY > 0;
  gamepadHeld.jump = down(0);
  gamepadHeld.interact = down(1);

  if (edge(0)) {
    if (gamepadHeld.down) queueManeuver('slide');
    else pressed.jump = true;
  }
  if (edge(2)) {
    if (gamepadHeld.up) queueManeuver('uppercut');
    else if (gamepadHeld.down && !controlledActorIsGrounded()) queueManeuver('thunder-kick');
    else pressed.attackIndex = 0;
  }
  if (edge(3)) {
    if (gamepadHeld.up) pressed.subweaponId = 'throwing-cross';
    else if (gamepadHeld.down) pressed.subweaponId = 'holy-water';
    else pressed.attackIndex = 1;
  }
  if (edge(4)) pressed.combo = true;
  if (edge(5)) queueTagSwitch(1);
  if (edge(6)) queueManeuver('slide');
  if (edge(7)) queueManeuver('dash');
  for (let index = 0; index < pad.buttons.length; index += 1) previousGamepadButtons[index] = down(index);
}

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target) || hidden) return;
  const key = event.key.toLowerCase();
  const compactInput = resolveCompactActionKeyDown({
    key,
    repeat: event.repeat,
    held,
    grounded: controlledActorIsGrounded(),
    lastDirectionTapAt,
    nowMs: performance.now(),
  });
  if (compactInput.handled) {
    Object.assign(held, compactInput.held);
    if (compactInput.tap) lastDirectionTapAt[compactInput.tap.direction] = compactInput.tap.at;
    applyCompactEdge(compactInput.edge);
    event.preventDefault();
    return;
  }

  if (key === 'a') held.left = true;
  else if (key === 'd') held.right = true;
  else if (key === 'w') {
    held.jump = true;
    if (!event.repeat) pressed.jump = true;
  }
  else if ((key === 'q' || key === 'shift') && !event.repeat) queueManeuver('dash');
  else if (key === 's' && !event.repeat) queueManeuver('slide');
  else if (key === 'u' && !event.repeat) queueManeuver('uppercut');
  else if (key === 'i' && !event.repeat) queueManeuver('thunder-kick');
  else if (key === 'j' && !event.repeat) pressed.attackIndex = 0;
  else if (key === 'k' && !event.repeat) pressed.attackIndex = 1;
  else if (key === 'c' && !event.repeat) pressed.subweaponId = 'holy-water';
  else if (key === 'v' && !event.repeat) pressed.subweaponId = 'throwing-cross';
  else if (key === 'l' && !event.repeat) pressed.combo = true;
  else if (key === 'e') held.interact = true;
  else if (key === 'tab' && !event.repeat) queueTagSwitch(event.shiftKey ? -1 : 1);
  else if (key === 'r' && !event.repeat) restart();
  else return;
  event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  const compactInput = resolveCompactActionKeyUp(key);
  if (compactInput.handled) {
    Object.assign(held, compactInput.held);
    event.preventDefault();
    return;
  }
  if (key === 'a') held.left = false;
  else if (key === 'd') held.right = false;
  else if (key === 'w') held.jump = false;
  else if (key === 'e') held.interact = false;
});

window.addEventListener('blur', clearHeld);
document.addEventListener('visibilitychange', () => {
  hidden = document.hidden;
  clearHeld();
  elements.pauseCurtain.hidden = !hidden;
  elements.canvas.dataset.paused = String(hidden);
  playtimeLastSample = performance.now();
  if (hidden) flushCanonicalPlaytime();
  if (!hidden) {
    lastTimestamp = performance.now();
    announce('Battle resumed. Hidden-tab time was not simulated.');
  }
});

function markPlaytimeActivity() {
  playtimeLastActivity = performance.now();
}

window.addEventListener('pointerdown', markPlaytimeActivity, { capture: true, passive: true });
window.addEventListener('keydown', markPlaytimeActivity, { capture: true });
window.addEventListener('pagehide', flushCanonicalPlaytime);

for (const button of document.querySelectorAll('[data-held-control]')) {
  const control = button.dataset.heldControl;
  const release = () => { held[control] = false; };
  button.addEventListener('pointerdown', (event) => {
    held[control] = true;
    button.setPointerCapture?.(event.pointerId);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

for (const button of document.querySelectorAll('[data-action-control]')) {
  button.addEventListener('click', () => {
    const action = button.dataset.actionControl;
    if (action === 'jump') {
      held.jump = false;
      pressed.jump = true;
    }
    else if (['dash', 'slide', 'uppercut', 'thunder-kick'].includes(action)) queueManeuver(action);
    else if (action === 'attack-0') pressed.attackIndex = 0;
    else if (action === 'attack-1') pressed.attackIndex = 1;
    else if (action === 'holy-water') pressed.subweaponId = 'holy-water';
    else if (action === 'throwing-cross') pressed.subweaponId = 'throwing-cross';
    else if (action === 'combo') pressed.combo = true;
    else if (action === 'switch') queueTagSwitch(1);
    elements.canvas.focus();
  });
}

elements.canvas.addEventListener('pointerdown', () => elements.canvas.focus());
elements.restartBattle.addEventListener('click', restart);

function frame(timestamp) {
  const elapsedMs = Math.max(0, Math.min(100, timestamp - lastTimestamp));
  lastTimestamp = timestamp;
  sampleCanonicalPlaytime(timestamp, timestamp - playtimeLastSample);
  playtimeLastSample = timestamp;
  pollBattleGamepad();
  let snapshot;
  if (!hidden && !session.outcome) {
    snapshot = advanceActionCampaignBattle(session, elapsedMs, {
      left: held.left || gamepadHeld.left,
      right: held.right || gamepadHeld.right,
      jumpPressed: pressed.jump,
      jumpHeld: held.jump || gamepadHeld.jump,
      attackIndex: pressed.attackIndex,
      subweaponPressed: pressed.subweaponId,
      comboPressed: pressed.combo,
      interactHeld: held.interact || gamepadHeld.interact,
      interactPressed: held.interact || gamepadHeld.interact,
    });
    pressed.jump = false;
    pressed.attackIndex = null;
    pressed.subweaponId = null;
    pressed.combo = false;
    consumeSnapshotEvents(snapshot);
    const comboResponseEvent = snapshot.recentEvents.find((event) => (
      event.type === 'combo-start' || event.type === 'combo-blocked'
    ));
    if (comboResponseEvent) announce(describeEvent(comboResponseEvent, snapshot));
  } else {
    snapshot = snapshotActionCampaignBattle(session);
  }
  renderDom(snapshot);
  draw(snapshot, elapsedMs);
  completeLaboratoryResult();
  requestAnimationFrame(frame);
}

const initial = snapshotActionCampaignBattle(session);
announce(initial.objective.supported
  ? canonicalMode
    ? `${session.encounter.name} loaded. Victory will commit to the campaign.`
    : `${session.encounter.name} loaded. This is an isolated training session.`
  : initial.objective.message);
renderDom(initial);
requestAnimationFrame(frame);

globalThis.__ACTION_CAMPAIGN_BATTLE__ = Object.freeze({
  getSnapshot: () => snapshotActionCampaignBattle(session),
  getResult: () => laboratoryResult,
  get laboratoryComplete() { return laboratoryComplete; },
  get canonicalComplete() { return canonicalMode && laboratoryComplete; },
  canonicalStorageUnchanged: () => canonicalStorageSnapshotsMatch(
    canonicalStorageAtEntry,
    captureCanonicalStorageSnapshot(canonicalStorage),
  ),
});
