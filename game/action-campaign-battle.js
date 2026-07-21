import {
  advanceActionCampaignBattle,
  createActionCampaignBattleSession,
  getActionCampaignAttackChoices,
  parseActionCampaignBattleQuery,
  settleActionCampaignBattleVictory,
  snapshotActionCampaignBattle,
  switchActionCampaignActor,
} from './action-campaign-battle-model.mjs';
import {
  createAdvancementState,
  createAdvancementStorageAdapter,
  getEncounterWinCount,
  getParty,
  preparePartyForEncounter,
} from './advancement.mjs';
import { getBattleStageArt } from './battle-stage-art.mjs';
import { BOSS_COMBAT_ATLAS, getBossCombatDrawPlacement, getBossCombatFrame, hasBossCombatTemplate } from './boss-combat-atlas.mjs';
import { createFieldStorageAdapter } from './field-runtime.mjs';
import { ENEMY_ATLAS, getEnemyAtlasFrame } from './enemy-atlas.mjs';
import {
  createLoadoutState,
  createLoadoutStorageAdapter,
  syncPartyVitals,
} from './loadout.mjs';
import { PARTY_COMBAT_ATLAS, getPartyCombatFrame } from './party-combat-atlas.mjs';
import { createQuestStorageAdapter } from './quest-runtime.mjs';
import { createRunReceiptStorageAdapter, recordRunPlaytime } from './run-receipt.mjs';
import { loadStoryworldBattlePresentation } from './storyworld-battle-bridge.mjs';
import { createWitnessChronicleStorageAdapter } from './witness-chronicle-runtime.mjs';

const query = parseActionCampaignBattleQuery(window.location.search);
const advancementAdapter = createAdvancementStorageAdapter();
const advancementLoad = advancementAdapter.load();
let advancementState = preparePartyForEncounter(
  advancementLoad.ok ? advancementLoad.state : createAdvancementState(),
  query.encounterId,
);
const loadoutAdapter = createLoadoutStorageAdapter();
const loadoutLoad = loadoutAdapter.load();
let loadoutState = loadoutLoad.ok ? loadoutLoad.value : createLoadoutState();
const syncedLoadout = syncPartyVitals(loadoutState, getParty(advancementState));
if (syncedLoadout.ok) loadoutState = syncedLoadout.state;

const runReceiptAdapter = createRunReceiptStorageAdapter();
const runReceiptLoad = runReceiptAdapter.load();
let runReceiptState = runReceiptLoad.ok && runReceiptLoad.found ? runReceiptLoad.state : null;
const questAdapter = createQuestStorageAdapter();
const fieldAdapter = createFieldStorageAdapter();
const witnessAdapter = createWitnessChronicleStorageAdapter();

let session = createActionCampaignBattleSession({
  encounterId: query.encounterId,
  advancementState,
  loadoutState,
});

const elements = {
  canvas: document.querySelector('#actionCampaignCanvas'),
  pauseCurtain: document.querySelector('#pauseCurtain'),
  encounterTitle: document.querySelector('#encounterTitle'),
  encounterSubtitle: document.querySelector('#encounterSubtitle'),
  campaignLink: document.querySelector('#campaignLink'),
  continueCampaign: document.querySelector('#continueCampaign'),
  stageName: document.querySelector('#stageName'),
  stateBadge: document.querySelector('#battleStateBadge'),
  controlledActor: document.querySelector('#controlledActor'),
  partyReadout: document.querySelector('#partyReadout'),
  enemyReadout: document.querySelector('#enemyReadout'),
  objectiveText: document.querySelector('#objectiveText'),
  objectiveRuntimeStatus: document.querySelector('#objectiveRuntimeStatus'),
  objectiveRequirements: document.querySelector('#objectiveRequirements'),
  attackTimers: document.querySelector('#attackTimers'),
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
};

const context = elements.canvas.getContext('2d');
context.imageSmoothingEnabled = false;
const held = { left: false, right: false, interact: false };
const pressed = { jump: false, attackIndex: null, combo: false };
let lastTimestamp = performance.now();
let hidden = document.hidden;
let settled = false;
let settlementPending = false;
let settlementRetryAt = 0;
let runReceiptPendingMs = 0;
let runReceiptCategory = getEncounterWinCount(advancementState, session.encounter.id) > 0 ? 'grind' : 'firstClearCombat';
const recentMessages = [];
const flyouts = [];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

elements.encounterTitle.textContent = session.encounter.name;
elements.encounterSubtitle.textContent = `${session.encounter.format} · ${session.encounter.objective.text}`;
elements.stageName.textContent = session.stage.id.replaceAll('-', ' ').toUpperCase();
elements.campaignLink.href = query.returnTarget;
elements.continueCampaign.href = query.returnTarget;
elements.canvas.dataset.encounterId = session.encounter.id;
elements.canvas.dataset.stageId = session.stage.id;

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
  enemy: { image: new Image(), ready: false, source: ENEMY_ATLAS },
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

for (const key of ['party', 'enemy', 'boss', 'stage']) loadArt(key);

function clearHeld() {
  held.left = false;
  held.right = false;
  held.interact = false;
  pressed.jump = false;
  pressed.attackIndex = null;
  pressed.combo = false;
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

function describeEvent(event, snapshot) {
  const actor = snapshot.kernel.actors.find(({ id }) => id === event.actorId);
  const target = snapshot.kernel.actors.find(({ id }) => id === event.targetId);
  if (event.type === 'combo-start') {
    const arts = snapshot.combo.participants.map(({ attackName }) => attackName).join(' + ');
    return `${snapshot.combo.name} begins atomically: ${arts}.`;
  }
  if (event.type === 'combo-blocked') {
    return `${event.name} unavailable: ${formatComboReason(event.reasons?.[0])}.`;
  }
  if (event.type === 'attack-start') return event.comboId
    ? `${actor?.name ?? event.actorId} links ${attackName(event.attackId)} into ${snapshot.combo.name}.`
    : `${actor?.name ?? event.actorId} commits ${attackName(event.attackId)}.`;
  if (event.type === 'attack-complete') return event.comboId
    ? `${actor?.name ?? event.actorId}'s linked ${attackName(event.attackId)} completes; its own cooldown is preserved at ${event.individualCooldownMs} ms.`
    : `${actor?.name ?? event.actorId} recovers movement; offense cooldown ${event.sharedCooldownMs} ms.`;
  if (event.type === 'hit') {
    flyouts.push({ x: target?.position.x ?? 480, y: (target?.position.y ?? 400) - 70, text: `${event.damage} ${event.delivery ?? ''}`.trim(), life: 850 });
    return `${event.comboId ? `${snapshot.combo.name} linked hit — ` : ''}${actor?.name ?? event.actorId} hits ${target?.name ?? event.targetId} with ${attackName(event.attackId)}: ${event.damage} ${event.delivery ?? 'typed'} damage${event.essence ? ` · ${event.essence}` : ''}.`;
  }
  if (event.type === 'control-switch') return `${actor?.name ?? event.actorId} is now under direct control.`;
  if (event.type === 'combat-end') return event.outcome === 'victory' ? 'Objective and combat conditions complete.' : 'The active party has fallen.';
  return null;
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

function flushRunReceiptPlaytime() {
  if (!runReceiptState || runReceiptState.status !== 'active') {
    runReceiptPendingMs = 0;
    return true;
  }
  if (runReceiptPendingMs <= 0) return true;
  const result = recordRunPlaytime(
    runReceiptState,
    runReceiptState.runId,
    runReceiptCategory,
    Math.min(60_000, Math.round(runReceiptPendingMs)),
    { chapterId: session.encounter.chapterId },
  );
  if (!result.ok || !runReceiptAdapter.save(result.state).ok) return false;
  runReceiptState = result.state;
  runReceiptPendingMs = 0;
  return true;
}

function queueRunReceiptPlaytime(elapsedMs) {
  if (!runReceiptState || runReceiptState.status !== 'active' || session.outcome) return;
  runReceiptPendingMs += Math.max(0, Math.round(elapsedMs));
  if (runReceiptPendingMs >= 1_000) flushRunReceiptPlaytime();
}

function trySettlement(now) {
  if (settled || settlementPending || session.outcome !== 'victory' || now < settlementRetryAt) return;
  settlementPending = true;
  elements.settlementStatus.textContent = 'Victory earned. Committing advancement, vitals, rewards, and route evidence…';
  let result;
  try {
    result = settleActionCampaignBattleVictory({
      session,
      states: { advancement: advancementState, loadout: loadoutState, runReceipt: runReceiptState },
      adapters: {
        advancement: advancementAdapter,
        loadout: loadoutAdapter,
        quest: questAdapter,
        field: fieldAdapter,
        witness: witnessAdapter,
        runReceipt: runReceiptAdapter,
      },
      handoff: query.handoff,
      flushPlaytime: () => ({ ok: flushRunReceiptPlaytime(), state: runReceiptState }),
    });
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : 'The victory record could not be created.' };
  }
  settlementPending = false;
  if (!result.ok) {
    elements.settlementStatus.textContent = result.message;
    settlementRetryAt = now + 1_000;
    announce(result.message);
    return;
  }
  advancementState = result.states.advancement;
  loadoutState = result.states.loadout;
  runReceiptState = result.states.runReceipt;
  settled = true;
  elements.canvas.dataset.settlement = 'settled';
  elements.settlementStatus.textContent = result.messages.join(' ');
  elements.continueCampaign.hidden = false;
  elements.continueCampaign.setAttribute('aria-disabled', 'false');
  elements.continueCampaign.focus();
  announce('Victory settled. Continue is unlocked.');
}

function actorPhase(actor) {
  if (actor.hp <= 0) return 'defeat';
  if (actor.activeAttack) return actor.activeAttack.phase;
  if (Math.abs(actor.movementIntent.x) > 0) return 'move';
  return 'idle';
}

function partyPose(actor) {
  const phase = actorPhase(actor);
  if (phase === 'defeat') return 'defeat';
  if (phase === 'windup') return 'basic-strike-windup';
  if (phase === 'active') return actor.activeAttack?.attackId.includes('courier-cut') ? 'basic-strike-active' : 'signature-a';
  if (phase === 'recovery') return 'recovery';
  if (phase === 'move' && !reducedMotion.matches) return 'move';
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

function drawFallback(actor, color) {
  context.fillStyle = color;
  context.fillRect(actor.position.x - 18, actor.position.y - 52, 36, 52);
}

function drawParty(actor) {
  const frame = getPartyCombatFrame(templateId(actor.id), partyPose(actor));
  const scale = 1.75;
  if (!art.party.ready) return drawFallback(actor, '#78c4c1');
  context.save();
  context.translate(actor.position.x, actor.position.y);
  if (actor.facing < 0) context.scale(-1, 1);
  context.drawImage(art.party.image, frame.x, frame.y, frame.width, frame.height,
    -frame.pivotX * scale, -frame.pivotY * scale, frame.width * scale, frame.height * scale);
  context.restore();
}

function drawEnemy(actor) {
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
  const ordered = [...snapshot.kernel.actors].sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id));
  for (const actor of ordered) {
    context.fillStyle = 'rgba(0,0,0,.42)';
    context.beginPath();
    context.ellipse(actor.position.x, actor.position.y + 2, actor.faction === 'player' ? 26 : 34, 7, 0, 0, Math.PI * 2);
    context.fill();
    if (actor.faction === 'player') drawParty(actor);
    else if (actor.faction === 'enemy') drawEnemy(actor);
    context.fillStyle = actor.id === snapshot.kernel.controlledActorId ? '#ffe18b' : '#ddd2bf';
    context.font = '700 10px ui-monospace, monospace';
    context.textAlign = 'center';
    context.fillText(actor.name.toUpperCase(), actor.position.x, actor.position.y - (actor.faction === 'player' ? 118 : 126));
  }
}

function drawFlyouts(elapsedMs) {
  context.save();
  context.font = '900 15px ui-monospace, monospace';
  context.textAlign = 'center';
  for (let index = flyouts.length - 1; index >= 0; index -= 1) {
    const item = flyouts[index];
    item.life -= elapsedMs;
    if (item.life <= 0) { flyouts.splice(index, 1); continue; }
    context.globalAlpha = Math.min(1, item.life / 180);
    context.fillStyle = '#f3d795';
    context.fillText(item.text.toUpperCase(), item.x, item.y - (reducedMotion.matches ? 0 : (850 - item.life) * .03));
  }
  context.restore();
}

function draw(snapshot, elapsedMs) {
  drawStage();
  drawActors(snapshot);
  drawFlyouts(elapsedMs);
  if (snapshot.outcome) {
    context.fillStyle = 'rgba(5, 4, 9, .64)';
    context.fillRect(0, 0, 960, 540);
    context.fillStyle = snapshot.outcome === 'victory' ? '#e8cf7b' : '#e26772';
    context.font = '500 48px Georgia, serif';
    context.textAlign = 'center';
    context.fillText(snapshot.outcome === 'victory' ? 'Record Secured' : 'Route Broken', 480, 250);
    context.fillStyle = '#d2c7b5';
    context.font = '700 12px ui-monospace, monospace';
    context.fillText(snapshot.outcome === 'victory' ? (settled ? 'CONTINUE UNLOCKED' : 'SETTLING VICTORY…') : 'PRESS R TO RESTART', 480, 278);
  }
}

function actorListItem(actor, controlledActorId) {
  const item = document.createElement('li');
  item.dataset.defeated = String(actor.hp <= 0);
  const name = document.createElement('span');
  name.textContent = `${actor.id === controlledActorId ? '◆ ' : ''}${actor.name}`;
  const hp = document.createElement('strong');
  hp.textContent = `${Math.ceil(actor.hp)} / ${Math.ceil(actor.maxHp)} HP`;
  const state = document.createElement('small');
  state.textContent = actor.hp <= 0 ? 'DEFEATED' : actor.activeAttack ? `${attackName(actor.activeAttack.attackId)} · ${actor.activeAttack.phase}` : 'FREE MOVEMENT';
  item.append(name, hp, state);
  return item;
}

function renderDom(snapshot) {
  const controlled = snapshot.kernel.actors.find(({ id }) => id === snapshot.kernel.controlledActorId);
  elements.controlledActor.textContent = controlled
    ? `${controlled.name} · Level ${controlled.level} · ${controlled.grounded ? 'grounded' : 'airborne'} · X ${Math.round(controlled.position.x)}`
    : 'No living controlled fighter';
  const party = snapshot.kernel.actors.filter(({ faction }) => faction === 'player');
  const enemies = snapshot.kernel.actors.filter(({ faction }) => faction === 'enemy');
  elements.partyReadout.replaceChildren(...party.map((actor) => actorListItem(actor, snapshot.kernel.controlledActorId)));
  elements.enemyReadout.replaceChildren(...enemies.map((actor) => actorListItem(actor, snapshot.kernel.controlledActorId)));

  elements.objectiveText.textContent = session.objectiveContract.text;
  elements.objectiveRuntimeStatus.dataset.supported = String(snapshot.objective.supported);
  elements.objectiveRuntimeStatus.textContent = `${snapshot.objective.status.toUpperCase()} · ${snapshot.objective.message}`;
  elements.objectiveRequirements.replaceChildren(...snapshot.objective.requirements.map((requirement) => {
    const item = document.createElement('li');
    item.dataset.complete = String(requirement.complete);
    item.textContent = `${requirement.complete ? '✓' : '○'} ${requirement.id.replaceAll('-', ' ')} · ${requirement.semantics}`;
    return item;
  }));

  elements.comboTitle.textContent = snapshot.combo.name;
  elements.comboAvailability.dataset.available = String(snapshot.combo.available || snapshot.combo.active);
  elements.comboAvailability.textContent = snapshot.combo.active
    ? 'LINKED · both contributing arts are committed atomically'
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
  elements.attackTimers.replaceChildren(...choices.map((choice) => {
    const row = document.createElement('div');
    row.className = 'attack-timer';
    const name = document.createElement('strong');
    name.textContent = `${choice.name} · ${choice.delivery}${choice.essence ? ` · ${choice.essence}` : ''}`;
    const output = document.createElement('output');
    const remaining = choice.state.effectiveCooldownRemainingMs;
    output.textContent = choice.state.reason === 'animation-commitment' ? 'COMMITTED' : remaining > 0 ? `${remaining} ms` : 'READY';
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
  elements.canvas.dataset.combatSatisfied = String(snapshot.combatSatisfied);
  elements.canvas.dataset.controlledActorId = snapshot.kernel.controlledActorId ?? '';
  elements.canvas.dataset.comboId = snapshot.combo.comboId;
  elements.canvas.dataset.comboAvailable = String(snapshot.combo.available);
  elements.canvas.dataset.comboActive = String(snapshot.combo.active);
  elements.canvas.dataset.comboSeparationPx = snapshot.combo.separationPx == null ? '' : String(Math.round(snapshot.combo.separationPx));
  elements.canvas.dataset.paused = String(hidden);
}

function restart() {
  if (settled) return;
  session = createActionCampaignBattleSession({ encounterId: query.encounterId, advancementState, loadoutState });
  settlementRetryAt = 0;
  recentMessages.length = 0;
  flyouts.length = 0;
  clearHeld();
  announce(`Restarted ${session.encounter.name}.`);
  elements.canvas.focus();
}

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement;
}

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target) || hidden) return;
  const key = event.key.toLowerCase();
  if (key === 'a' || key === 'arrowleft') held.left = true;
  else if (key === 'd' || key === 'arrowright') held.right = true;
  else if ((key === 'w' || key === 'arrowup') && !event.repeat) pressed.jump = true;
  else if ((key === 'j' || key === ' ') && !event.repeat) pressed.attackIndex = 0;
  else if (key === 'k' && !event.repeat) pressed.attackIndex = 1;
  else if (key === 'l' && !event.repeat) pressed.combo = true;
  else if (key === 'e') held.interact = true;
  else if (key === 'tab' && !event.repeat) switchActionCampaignActor(session, event.shiftKey ? -1 : 1);
  else if (key === 'r' && !event.repeat) restart();
  else return;
  event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'a' || key === 'arrowleft') held.left = false;
  else if (key === 'd' || key === 'arrowright') held.right = false;
  else if (key === 'e') held.interact = false;
});

window.addEventListener('blur', clearHeld);
document.addEventListener('visibilitychange', () => {
  hidden = document.hidden;
  clearHeld();
  elements.pauseCurtain.hidden = !hidden;
  elements.canvas.dataset.paused = String(hidden);
  if (!hidden) {
    lastTimestamp = performance.now();
    announce('Battle resumed. Hidden-tab time was not simulated.');
  }
});

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
    if (action === 'jump') pressed.jump = true;
    else if (action === 'attack-0') pressed.attackIndex = 0;
    else if (action === 'attack-1') pressed.attackIndex = 1;
    else if (action === 'combo') pressed.combo = true;
    else if (action === 'switch') switchActionCampaignActor(session, 1);
    elements.canvas.focus();
  });
}

elements.canvas.addEventListener('pointerdown', () => elements.canvas.focus());
elements.restartBattle.addEventListener('click', restart);

function frame(timestamp) {
  const elapsedMs = Math.max(0, Math.min(100, timestamp - lastTimestamp));
  lastTimestamp = timestamp;
  let snapshot;
  if (!hidden && !session.outcome) {
    queueRunReceiptPlaytime(elapsedMs);
    snapshot = advanceActionCampaignBattle(session, elapsedMs, {
      left: held.left,
      right: held.right,
      jumpPressed: pressed.jump,
      attackIndex: pressed.attackIndex,
      comboPressed: pressed.combo,
      interactHeld: held.interact,
      interactPressed: held.interact,
    });
    pressed.jump = false;
    pressed.attackIndex = null;
    pressed.combo = false;
    for (const event of snapshot.recentEvents) announce(describeEvent(event, snapshot));
    const comboResponseEvent = snapshot.recentEvents.find((event) => (
      event.type === 'combo-start' || event.type === 'combo-blocked'
    ));
    if (comboResponseEvent) announce(describeEvent(comboResponseEvent, snapshot));
  } else {
    snapshot = snapshotActionCampaignBattle(session);
  }
  renderDom(snapshot);
  draw(snapshot, elapsedMs);
  trySettlement(timestamp);
  requestAnimationFrame(frame);
}

const initial = snapshotActionCampaignBattle(session);
announce(initial.objective.supported
  ? `${session.encounter.name} loaded. Objective and combat conditions are authoritative.`
  : initial.objective.message);
renderDom(initial);
requestAnimationFrame(frame);

globalThis.__ACTION_CAMPAIGN_BATTLE__ = Object.freeze({
  getSnapshot: () => snapshotActionCampaignBattle(session),
  get settlementComplete() { return settled; },
});
