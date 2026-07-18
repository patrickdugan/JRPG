import { getEncounter, ENCOUNTERS } from './content/encounters.mjs';
import {
  CAMPAIGN_COMBAT_PHASES,
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
  createQuestState,
  createQuestStorageAdapter,
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
} from './repeat-battle.mjs';
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

const query = new URLSearchParams(window.location.search);
const requestedEncounterId = query.get('encounter');
const encounter = getEncounter(requestedEncounterId) ?? ENCOUNTERS[0];
const requestedReturn = query.get('return');
const requestedQuestId = query.get('quest');
const requestedQuestObjectiveId = query.get('objective');
const requestedFieldTriggerId = query.get('fieldTrigger');
if (requestedReturn && /^[a-z0-9._/?=&-]+$/i.test(requestedReturn)) {
  campaignLink.href = requestedReturn;
  continueCampaign.href = requestedReturn;
}

const advancementAdapter = createAdvancementStorageAdapter();
const advancementLoad = advancementAdapter.load();
let advancementState = advancementLoad.ok ? advancementLoad.state : createAdvancementState();
advancementState = preparePartyForEncounter(advancementState, encounter.id);
advancementAdapter.save(advancementState);
const repeatBattleAtLoad = getEncounterWinCount(advancementState, encounter.id) > 0;
let speedMultiplier = repeatBattleAtLoad ? advancementState.speedMultiplier : 1;
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
let vitalsRecorded = false;
let enemyActionAt = null;
let autoGrindActive = false;
let autoActionAt = null;
let autoSettleAt = null;
const battleFacingByActor = new Map();
const battleMotionUntil = new Map();
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
    return false;
  }
  if (runReceiptPendingMs === 0) return false;
  const result = recordRunPlaytime(
    runReceiptState,
    runReceiptState.runId,
    runReceiptPendingCategory,
    runReceiptPendingMs,
    { chapterId: encounter.chapterId },
  );
  if (!result.ok) return false;
  runReceiptState = result.state;
  clearPendingRunReceiptPlaytime();
  runReceiptAdapter.save(runReceiptState);
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

function markBattleMotion(actorId, dx, dy) {
  battleFacingByActor.set(actorId, atlasDirectionForMovement(dx, dy, battleFacingByActor.get(actorId) ?? 'north'));
  const presentationSpeed = autoGrindActive ? speedMultiplier : 1;
  battleMotionUntil.set(actorId, performance.now() + (320 / presentationSpeed));
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

function drawBattle(now = performance.now()) {
  const snapshot = engine.snapshot();
  const level = engine.level;
  const { cell, originX, originY } = mapGeometry();
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

  for (const actor of snapshot.actors.filter((entry) => entry.hp > 0 && entry.active !== false)) {
    const centerX = originX + actor.pos.x * cell + cell / 2;
    const centerY = originY + actor.pos.y * cell + cell / 2 + Math.sin(now / 170 + actor.pos.x) * Math.max(1, cell * 0.035);
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
      const facing = battleFacingByActor.get(actor.instanceId) ?? fallbackFacing;
      const presentationSpeed = autoGrindActive ? speedMultiplier : 1;
      const phase = now < (battleMotionUntil.get(actor.instanceId) ?? 0)
        ? Math.floor((now * presentationSpeed) / 110) % 2
        : 0;
      const frame = getPartyAtlasFrame(actor.templateId, facing, phase);
      const drawHeight = cell * 1.18;
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
  const meta = document.createElement('div');
  meta.className = 'combatant-meta';
  meta.textContent = `${actor.stance.toUpperCase()} · ready pulse ${actor.readyAtPulse}${actor.analyzed ? ' · ANALYZED' : ''}`;
  card.append(name, meter, meta);
  return card;
}

function renderCombatants(snapshot) {
  partyPanel.replaceChildren(...snapshot.actors.filter((actor) => actor.faction === 'party').map((actor) => createCombatantCard(actor)));
  enemyPanel.replaceChildren(...snapshot.actors.filter((actor) => actor.faction !== 'party').map((actor) => createCombatantCard(actor, actor.instanceId === selectedTargetId)));
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
  select.replaceChildren(placeholderOption, ...entries.map((entry) => new Option(entry.label, entry.value)));
  if (entries.some((entry) => entry.value === prior)) select.value = prior;
  else if (entries.length) select.value = entries[0].value;
}

function renderCommands(snapshot) {
  const actor = activePartyActor(snapshot);
  const inputLocked = autoInputLocked();
  const available = new Set(actor ? engine.getAvailableCommands(actor.instanceId) : []);
  activeActorLabel.textContent = actor ? `${actor.name} · ${snapshot.pace} Pace${inputLocked ? ' · AUTO' : ''}` : 'Waiting for the next activation';
  commandButtons.forEach((button) => {
    const command = button.dataset.command;
    const enabled = !inputLocked && Boolean(actor) && (command === 'attack' ? available.has('skill') : available.has(command));
    button.disabled = !enabled;
    button.setAttribute('aria-pressed', String(command === selectedCommand));
  });

  const skills = actor?.skills ?? [];
  replaceOptions(skillSelect, skills.map((skill) => ({ value: skill.id, label: `${skill.name} · R${skill.recoveryPulses}` })), 'Select an art');
  replaceOptions(targetSelect, livingEnemies(snapshot).map((target) => ({ value: target.instanceId, label: `${target.name} · ${target.hp} HP` })), 'Select a target');
  if (selectedTargetId && livingEnemies(snapshot).some((target) => target.instanceId === selectedTargetId)) targetSelect.value = selectedTargetId;
  selectedTargetId = targetSelect.value;

  const needsSkill = ['attack', 'skill'].includes(selectedCommand);
  const needsTarget = ['attack', 'skill', 'analyze'].includes(selectedCommand);
  skillSelect.disabled = inputLocked || !actor || !needsSkill || selectedCommand === 'attack';
  targetSelect.disabled = inputLocked || !actor || !needsTarget;
  confirmCommand.disabled = inputLocked || !actor || selectedCommand === 'move'
    || (needsSkill && !skillSelect.value) || (needsTarget && !targetSelect.value)
    || (selectedCommand === 'objective' && !available.has('objective'));
  const hints = {
    move: 'Use W/A/S/D, Q/E/Z/C, arrow keys, or click an adjacent space. Movement spends one Pace and does not end the activation.',
    attack: 'Use the active character’s first combat art against the selected target.',
    skill: 'Choose an art and target. Recovery controls when this character returns to Tempo.',
    guard: 'Reduce the next incoming hit, then recover for one pulse.',
    analyze: 'Reveal the selected enemy’s delivery and essence multipliers.',
    objective: 'Advance the next explicit rescue, escort, release, relay, archive, or evacuation requirement.',
  };
  commandHint.textContent = inputLocked
    ? 'Auto-Grind is issuing the deterministic repeat policy; manual commands are paused.'
    : actor ? hints[selectedCommand] : 'Enemy intent or recovery is resolving. Manual repeat speed changes this wait, not command time.';
}

function formatEngineLog(entry, actors) {
  const name = (id) => actors.find((actor) => actor.instanceId === id)?.name ?? id;
  if (entry.type === 'move') return `${name(entry.actorId)} moves to ${entry.at}.`;
  if (entry.type === 'damage') return `${name(entry.attackerId)} uses ${entry.skillId} on ${name(entry.targetId)}: ${entry.finalDamage} damage (${Math.round(entry.deliveryMultiplier * 100)}% delivery${entry.essenceMultiplier !== 1 ? `, ${Math.round(entry.essenceMultiplier * 100)}% essence` : ''}).`;
  if (entry.type === 'guard') return `${name(entry.actorId)} guards.`;
  if (entry.type === 'analyze') return `${name(entry.actorId)} analyzes ${name(entry.targetId)}.`;
  if (entry.type === 'objective') return `${name(entry.actorId)} advances objective action ${entry.action}.`;
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
    ? requirements.map((requirement) => `${requirement.complete ? '✓' : '○'} ${requirement.key} ${requirement.progress}/${requirement.count}`).join(' · ')
    : 'Defeat the required hostile formation.';
  objectiveProgress.textContent = `${completed}/${requirements.length} objective requirements · ${snapshot.objective.combatComplete ? 'combat condition met' : 'combat condition pending'} · ${requirementText}`;
}

function recordVictoryIfNeeded(snapshot) {
  if (snapshot.result !== 'victory' || rewardRecorded) return;
  const priorWins = getEncounterWinCount(advancementState, encounter.id);
  const reward = getEncounterRewardPreview(encounter.id, priorWins);
  flushRunReceiptPlaytime();
  if (priorWins === 0 && runReceiptState?.status === 'active') {
    const receiptResult = recordRunFirstClear(runReceiptState, runReceiptState.runId, encounter.id);
    if (receiptResult.ok) {
      runReceiptState = receiptResult.state;
      runReceiptAdapter.save(runReceiptState);
    }
  }
  advancementState = recordEncounterWin(advancementState, encounter.id, { partyIds: encounter.party?.roster });
  advancementAdapter.save(advancementState);
  const loadoutReward = grantInventory(loadoutState, { currency: reward.currency, items: reward.items });
  if (loadoutReward.ok) {
    loadoutState = loadoutReward.state;
    loadoutAdapter.save(loadoutState);
  }
  if (requestedQuestId && requestedQuestObjectiveId) {
    const loadedQuestState = questAdapter.load();
    const questResult = advanceQuestObjective(
      loadedQuestState.ok ? loadedQuestState.state : createQuestState(),
      requestedQuestId,
      requestedQuestObjectiveId,
    );
    if (questResult.ok) {
      questAdapter.save(questResult.state);
      addMessage(`Side-story objective recorded: ${requestedQuestObjectiveId}.`);
    }
  }
  if (requestedFieldTriggerId) {
    const loadedFieldState = fieldAdapter.load();
    if (loadedFieldState.ok && loadedFieldState.found) {
      const fieldResult = resolveFieldEncounter(loadedFieldState.state, requestedFieldTriggerId);
      if (fieldResult.ok) {
        fieldAdapter.save(fieldResult.state);
        addMessage(`Field encounter ${requestedFieldTriggerId} resolved for the route.`);
      }
    }
  }
  speedMultiplier = advancementState.speedMultiplier;
  rewardRecorded = true;
  addMessage(`Victory reward: ${reward.xpPerMember} XP per active member, ${reward.currency} mon${reward.repeat ? ' (repeat grind reward)' : ' plus first-clear loot'}.`);
}

function recordBattleVitalsIfNeeded(snapshot) {
  if (snapshot.result !== 'victory' || vitalsRecorded) return;
  for (const actor of snapshot.actors.filter((entry) => entry.faction === 'party')) {
    const result = setMemberVitals(loadoutState, actor.templateId, { hp: Math.max(1, actor.hp) });
    if (result.ok) loadoutState = result.state;
  }
  loadoutAdapter.save(loadoutState);
  vitalsRecorded = true;
}

function renderSpeedControls() {
  const grindAvailable = getEncounterWinCount(advancementState, encounter.id) > 0;
  const snapshot = engine.snapshot();
  const settling = autoSettleAt !== null;
  speedButtons.forEach((button) => {
    button.disabled = !grindAvailable || autoGrindActive || settling || Boolean(snapshot.result);
    button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === speedMultiplier));
  });
  speedStatus.textContent = grindAvailable
    ? `Saved repeat speed: ${speedMultiplier}× · full-loop only in Auto-Grind; manual play only shortens enemy presentation`
    : 'Speed unlocks after the first clear for repeat level grinding.';
  autoGrind.disabled = !grindAvailable || settling || Boolean(snapshot.result);
  autoGrind.setAttribute('aria-pressed', String(autoGrindActive));
  autoGrind.textContent = autoGrindActive ? 'Stop Auto-Grind' : 'Start Auto-Grind';
  autoGrindStatus.textContent = !grindAvailable
    ? 'First-clear play remains manual. Clear this encounter once to unlock deterministic Auto-Grind.'
    : settling
      ? `Auto-Grind ${speedMultiplier}× is presenting the terminal result and reward.`
      : autoGrindActive
        ? `Auto-Grind ${speedMultiplier}× schedules commands, enemy turns, recovery, result, and reward at the saved speed.`
        : 'Repeat-only. Uses the deterministic policy; speed does not alter decisions or rewards.';
}

function render() {
  const snapshot = engine.snapshot();
  const settlementReady = autoSettleAt === null;
  // Auto-Grind may delay the terminal reveal, but an earned victory must be
  // durable before the player can restart, leave, reload, or enter BFCache.
  recordVictoryIfNeeded(snapshot);
  recordBattleVitalsIfNeeded(snapshot);
  encounterTitle.textContent = encounter.name;
  encounterSubtitle.textContent = `${encounter.chapterId} · ${engine.level.name} · ${encounter.format}`;
  document.title = `${encounter.name} — Bells Battle`;
  battleClock.textContent = formatClock(snapshot.nowMs);
  roundLabel.textContent = `ACTIVATION ${engine.activationCount}`;
  phaseLabel.textContent = phaseName(snapshot);
  battleStateBadge.textContent = autoSettleAt !== null
    ? 'RESOLVING'
    : snapshot.result?.toUpperCase() ?? (snapshot.phase === CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND ? 'COMMAND' : 'INTENT');
  renderCombatants(snapshot);
  renderTempo(snapshot);
  renderCommands(snapshot);
  renderSpeedControls();
  renderObjective(snapshot);
  renderLog(snapshot);
  continueCampaign.hidden = snapshot.result !== 'victory' || !settlementReady;
  if (snapshot.result === 'victory' && settlementReady) continueCampaign.focus({ preventScroll: true });
  drawBattle();
  if (!autoInputLocked() && snapshot.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND && !snapshot.result && enemyActionAt === null) {
    enemyActionAt = performance.now() + (650 / speedMultiplier);
  }
}

function executeRepeatPolicyCommand(actorId, command) {
  if (command.type === 'move') {
    const result = engine.move(actorId, command.dx, command.dy);
    if (result.ok) markBattleMotion(actorId, command.dx, command.dy);
    return result;
  }
  if (command.type === 'skill') return engine.useSkill(actorId, command.skillId, command.targetId);
  if (command.type === 'objective') return engine.performObjectiveAction(actorId, command.action);
  if (command.type === 'guard') return engine.guard(actorId);
  return { ok: false, reason: `Unsupported Auto-Grind command ${command.type}.` };
}

function stopAutoGrind(message) {
  autoGrindActive = false;
  autoActionAt = null;
  if (message) addMessage(message);
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
      result = executeRepeatPolicyCommand(before.activeActorId, command);
    } else if (before.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND) {
      stepType = 'enemyActivation';
      result = engine.resolveEnemyActivation();
    } else {
      throw new Error(`Unexpected Auto-Grind phase ${before.phase}.`);
    }
  } catch (error) {
    stopAutoGrind(`Auto-Grind stopped: ${error.message}`);
    render();
    return;
  }
  if (!result?.ok) {
    stopAutoGrind(`Auto-Grind stopped: ${result?.reason ?? 'a deterministic command failed.'}`);
    render();
    return;
  }
  const after = engine.snapshot();
  const recoveredPulses = Math.max(0, after.nowPulse - beforePulse);
  const stepDelay = getRepeatStepDelayMs(stepType, speedMultiplier, recoveredPulses);
  if (after.result) {
    stopAutoGrind();
    const terminalDelay = getRepeatStepDelayMs('resolution', speedMultiplier)
      + (after.result === 'victory' ? getRepeatStepDelayMs('reward', speedMultiplier) : 0);
    autoSettleAt = now + stepDelay + terminalDelay;
    addMessage(`Auto-Grind reached ${after.result}; presenting the deterministic result${after.result === 'victory' ? ' and reward' : ''}.`);
  } else {
    autoActionAt = now + stepDelay;
  }
  render();
}

function toggleAutoGrind() {
  if (autoGrindActive) {
    stopAutoGrind('Auto-Grind stopped. Manual repeat controls restored.');
    render();
    return;
  }
  if (getEncounterWinCount(advancementState, encounter.id) === 0) {
    addMessage('Auto-Grind unlocks only after this encounter\'s first clear.');
    render();
    return;
  }
  if (engine.result || autoSettleAt !== null) return;
  autoGrindActive = true;
  enemyActionAt = null;
  autoActionAt = performance.now() + getRepeatStepDelayMs('intro', speedMultiplier);
  addMessage(`Auto-Grind started at ${speedMultiplier}×. The full repeat presentation uses the saved speed.`);
  render();
}

function selectCommand(command) {
  if (autoInputLocked()) return;
  selectedCommand = command;
  if (command === 'attack') skillSelect.selectedIndex = Math.min(1, skillSelect.options.length - 1);
  render();
}

function executeSelectedCommand() {
  if (autoInputLocked()) return;
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
  enemyActionAt = null;
  render();
}

function moveActive(dx, dy) {
  if (autoInputLocked()) return;
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
  if (autoInputLocked()) return;
  const card = event.target.closest('[data-actor-id]');
  if (!card) return;
  selectedTargetId = card.dataset.actorId;
  targetSelect.value = selectedTargetId;
  render();
});

speedButtons.forEach((button) => button.addEventListener('click', () => {
  if (autoInputLocked() || engine.result) return;
  if (getEncounterWinCount(advancementState, encounter.id) === 0) {
    addMessage('Battle speed unlocks after this encounter’s first clear.');
    render();
    return;
  }
  speedMultiplier = Number(button.dataset.speed);
  advancementState = setSpeedMultiplier(advancementState, speedMultiplier);
  advancementAdapter.save(advancementState);
  enemyActionAt = null;
  render();
}));

autoGrind.addEventListener('click', toggleAutoGrind);

restartBattle.addEventListener('click', () => {
  stopAutoGrind();
  autoSettleAt = null;
  engine = createEngine();
  rewardRecorded = false;
  vitalsRecorded = false;
  selectedTargetId = '';
  enemyActionAt = null;
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
  if (autoInputLocked()) return;
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
  const battleResolved = engine.snapshot().result !== null && autoSettleAt === null;
  if (!inactive && !battleResolved && elapsed > 0) {
    const category = getBattlePlaytimeCategory(getEncounterWinCount(advancementState, encounter.id));
    playtimeState = recordPlaytime(playtimeState, category, elapsed, { chapterId: encounter.chapterId });
    queueRunReceiptPlaytime(category, elapsed);
    playtimeUnsavedMs += elapsed;
    if (playtimeUnsavedMs >= 10_000) {
      playtimeAdapter.save(playtimeState);
      playtimeUnsavedMs = 0;
    }
  }
  if (autoSettleAt !== null && now >= autoSettleAt) {
    autoSettleAt = null;
    render();
  }
  if (autoGrindActive && autoActionAt !== null && now >= autoActionAt) {
    autoActionAt = null;
    executeAutoGrindStep(now);
  } else if (!autoInputLocked() && enemyActionAt !== null && now >= enemyActionAt && engine.snapshot().phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND) {
    const result = engine.resolveEnemyActivation();
    if (!result.ok) addMessage(result.reason);
    enemyActionAt = null;
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
