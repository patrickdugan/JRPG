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
  getPartyMember,
  preparePartyForEncounter,
  recordEncounterWin,
  setSpeedMultiplier,
} from './advancement.mjs';

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
const objectiveText = document.querySelector('#objectiveText');
const objectiveProgress = document.querySelector('#objectiveProgress');
const resultLog = document.querySelector('#resultLog');
const battleStateBadge = document.querySelector('#battleStateBadge');
const announcements = document.querySelector('#battleAnnouncements');
const restartBattle = document.querySelector('#restartBattle');
const campaignLink = document.querySelector('.campaign-link');

context.imageSmoothingEnabled = false;

const query = new URLSearchParams(window.location.search);
const requestedEncounterId = query.get('encounter');
const encounter = getEncounter(requestedEncounterId) ?? ENCOUNTERS[0];
const requestedReturn = query.get('return');
if (requestedReturn && /^[a-z0-9._/?=&-]+$/i.test(requestedReturn)) campaignLink.href = requestedReturn;

const advancementAdapter = createAdvancementStorageAdapter();
const advancementLoad = advancementAdapter.load();
let advancementState = advancementLoad.ok ? advancementLoad.state : createAdvancementState();
advancementState = preparePartyForEncounter(advancementState, encounter.id);
advancementAdapter.save(advancementState);
let speedMultiplier = getEncounterWinCount(advancementState, encounter.id) > 0 ? advancementState.speedMultiplier : 1;
let selectedCommand = 'attack';
let selectedTargetId = '';
let rewardRecorded = false;
let enemyActionAt = null;
let uiMessages = [`Loaded ${encounter.name}. ${encounter.objective.text}`];
let engine;

function combatProfiles() {
  const profiles = {};
  for (const memberId of encounter.party?.roster ?? ['ren']) {
    const base = PARTY_PROFILES[memberId];
    const member = getPartyMember(advancementState, memberId);
    profiles[memberId] = {
      ...base,
      stats: {
        hp: member.stats.hp,
        power: Math.max(member.stats.power, member.stats.arcana),
        guard: member.stats.guard,
        speed: member.stats.speed,
      },
    };
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
    context.fillStyle = actor.instanceId === snapshot.activeActorId ? '#f5d77e' : party ? '#70c9c2' : '#d06459';
    context.fillRect(centerX - cell * 0.23, centerY - cell * 0.25, cell * 0.46, cell * 0.5);
    context.fillStyle = party ? '#102b39' : '#321824';
    context.fillRect(centerX - cell * 0.12, centerY - cell * 0.12, cell * 0.24, cell * 0.17);
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
  const available = new Set(actor ? engine.getAvailableCommands(actor.instanceId) : []);
  activeActorLabel.textContent = actor ? `${actor.name} · ${snapshot.pace} Pace` : 'Waiting for the next activation';
  commandButtons.forEach((button) => {
    const command = button.dataset.command;
    const enabled = Boolean(actor) && (command === 'attack' ? available.has('skill') : available.has(command));
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
  skillSelect.disabled = !actor || !needsSkill || selectedCommand === 'attack';
  targetSelect.disabled = !actor || !needsTarget;
  confirmCommand.disabled = !actor || selectedCommand === 'move'
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
  commandHint.textContent = actor ? hints[selectedCommand] : 'Enemy intent or recovery is resolving. Battle speed changes this wait, not command time.';
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
  advancementState = recordEncounterWin(advancementState, encounter.id, { partyIds: encounter.party?.roster });
  advancementAdapter.save(advancementState);
  speedMultiplier = advancementState.speedMultiplier;
  rewardRecorded = true;
  addMessage(`Victory reward: ${reward.xpPerMember} XP per active member, ${reward.currency} mon${reward.repeat ? ' (repeat grind reward)' : ' plus first-clear loot'}.`);
}

function renderSpeedControls() {
  const grindAvailable = getEncounterWinCount(advancementState, encounter.id) > 0;
  speedButtons.forEach((button) => {
    button.disabled = !grindAvailable;
    button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === speedMultiplier));
  });
  speedStatus.textContent = grindAvailable
    ? `Speed: ${speedMultiplier}× · repeat-battle intent and recovery presentation accelerated`
    : 'Speed unlocks after the first clear for repeat level grinding.';
}

function render() {
  const snapshot = engine.snapshot();
  recordVictoryIfNeeded(snapshot);
  encounterTitle.textContent = encounter.name;
  encounterSubtitle.textContent = `${encounter.chapterId} · ${engine.level.name} · ${encounter.format}`;
  document.title = `${encounter.name} — Bells Battle`;
  battleClock.textContent = formatClock(snapshot.nowMs);
  roundLabel.textContent = `ACTIVATION ${engine.activationCount}`;
  phaseLabel.textContent = phaseName(snapshot);
  battleStateBadge.textContent = snapshot.result?.toUpperCase() ?? (snapshot.phase === CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND ? 'COMMAND' : 'INTENT');
  renderCombatants(snapshot);
  renderTempo(snapshot);
  renderCommands(snapshot);
  renderSpeedControls();
  renderObjective(snapshot);
  renderLog(snapshot);
  drawBattle();
  if (snapshot.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND && !snapshot.result && enemyActionAt === null) {
    enemyActionAt = performance.now() + (650 / speedMultiplier);
  }
}

function selectCommand(command) {
  selectedCommand = command;
  if (command === 'attack') skillSelect.selectedIndex = Math.min(1, skillSelect.options.length - 1);
  render();
}

function executeSelectedCommand() {
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
  const snapshot = engine.snapshot();
  const actor = activePartyActor(snapshot);
  if (!actor) return;
  selectedCommand = 'move';
  const result = engine.move(actor.instanceId, dx, dy);
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
  const card = event.target.closest('[data-actor-id]');
  if (!card) return;
  selectedTargetId = card.dataset.actorId;
  targetSelect.value = selectedTargetId;
  render();
});

speedButtons.forEach((button) => button.addEventListener('click', () => {
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

restartBattle.addEventListener('click', () => {
  engine = createEngine();
  rewardRecorded = false;
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
  if (enemyActionAt !== null && now >= enemyActionAt && engine.snapshot().phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND) {
    const result = engine.resolveEnemyActivation();
    if (!result.ok) addMessage(result.reason);
    enemyActionAt = null;
    render();
  }
  drawBattle(now * speedMultiplier);
  requestAnimationFrame(tick);
}

engine = createEngine();
render();
requestAnimationFrame(tick);
