// Prototype adapter boundary: swap this import for action-combat.mjs when the
// canonical real-time kernel adopts the same create/step/cooldown interface.
import {
  ACTION_PROTOTYPE,
  createActionBattleState,
  getAttackCooldownMs,
  getEnemyCombatPhase,
  getLevelCooldownMultiplier,
  getPlayerAttackDamage,
  getPlayerCombatPhase,
  getPlayerSkillDamage,
  getSkillCooldownMs,
  setActionBattleLevel,
  stepActionBattle,
} from './action-battle-prototype-model.mjs';
import {
  PARTY_COMBAT_ATLAS,
  getPartyCombatFrame,
} from './party-combat-atlas.mjs';
import {
  ENEMY_ATLAS,
  getEnemyAtlasFrame,
} from './enemy-atlas.mjs';

const canvas = document.querySelector('#actionBattleCanvas');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;

const elements = {
  canvasWrap: document.querySelector('#canvasWrap'),
  motionMode: document.querySelector('#motionMode'),
  restartButton: document.querySelector('#restartButton'),
  playerHpText: document.querySelector('#playerHpText'),
  playerHpBar: document.querySelector('#playerHpBar'),
  playerHpMeter: document.querySelector('[aria-label="Ren health"]'),
  playerStateText: document.querySelector('#playerStateText'),
  playerPositionText: document.querySelector('#playerPositionText'),
  playerDamageText: document.querySelector('#playerDamageText'),
  enemyHpText: document.querySelector('#enemyHpText'),
  enemyHpBar: document.querySelector('#enemyHpBar'),
  enemyHpMeter: document.querySelector('[aria-label="Ashen Bailiff health"]'),
  enemyStateText: document.querySelector('#enemyStateText'),
  enemyPositionText: document.querySelector('#enemyPositionText'),
  cooldownValue: document.querySelector('#cooldownValue'),
  cooldownBar: document.querySelector('#cooldownBar'),
  cooldownMeter: document.querySelector('[aria-label="Shared offense cooldown"]'),
  skillCooldownValue: document.querySelector('#skillCooldownValue'),
  skillCooldownBar: document.querySelector('#skillCooldownBar'),
  skillCooldownMeter: document.querySelector('[aria-label="Cinder Route cooldown"]'),
  levelSlider: document.querySelector('#levelSlider'),
  levelValue: document.querySelector('#levelValue'),
  levelEffect: document.querySelector('#levelEffect'),
  announcement: document.querySelector('#battleAnnouncement'),
  eventLog: document.querySelector('#eventLog'),
};

const reducedMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = reducedMotionPreference.matches;
let state = createActionBattleState({ level: Number(elements.levelSlider.value) });
let lastTimestamp = performance.now();
let accumulatorMs = 0;
const FIXED_STEP_MS = 1_000 / 60;
const held = { left: false, right: false };
const pressed = { attack: false, skill: false, jump: false };
const flyouts = [];
let shakeRemainingMs = 0;

const art = {
  party: new Image(),
  enemy: new Image(),
  partyReady: false,
  enemyReady: false,
};

function loadAtlas(image, url, key, expectedWidth, expectedHeight) {
  canvas.dataset[`${key}ArtState`] = 'loading';
  image.addEventListener('load', () => {
    const valid = image.naturalWidth === expectedWidth && image.naturalHeight === expectedHeight;
    art[`${key}Ready`] = valid;
    canvas.dataset[`${key}ArtState`] = valid ? 'ready' : 'wrong-size';
  });
  image.addEventListener('error', () => {
    canvas.dataset[`${key}ArtState`] = 'unavailable';
  });
  image.src = url;
}

loadAtlas(art.party, PARTY_COMBAT_ATLAS.url, 'party', PARTY_COMBAT_ATLAS.width, PARTY_COMBAT_ATLAS.height);
loadAtlas(art.enemy, ENEMY_ATLAS.url, 'enemy', ENEMY_ATLAS.width, ENEMY_ATLAS.height);

function formatSeconds(milliseconds) {
  return `${(Math.max(0, milliseconds) / 1_000).toFixed(2)} s`;
}

function pushEventLog(text) {
  const item = document.createElement('li');
  item.textContent = text;
  elements.eventLog.prepend(item);
  while (elements.eventLog.children.length > 5) elements.eventLog.lastElementChild.remove();
  elements.announcement.textContent = text;
}

function describeEvent(event) {
  if (event.type === 'attack-started') {
    const name = event.kind === 'skill' ? 'Cinder Route' : 'Courier’s Cut';
    return `${name} committed. Movement locked for ${formatSeconds(event.commitmentMs)}.`;
  }
  if (event.type === 'attack-blocked') {
    const name = event.kind === 'skill' ? 'Cinder Route' : 'Courier’s Cut';
    if (event.reason === 'airborne') return `${name} denied: this attack is ground-only.`;
    if (event.reason === 'commitment') return `${name} denied: attack animation still committed.`;
    if (event.reason === 'skill-cooldown') return `${name} denied: skill cooldown ${formatSeconds(event.remainingMs)}.`;
    return `${name} denied: shared offense cooldown ${formatSeconds(event.remainingMs)}.`;
  }
  if (event.type === 'cooldown-started') {
    const skillText = event.skillDurationMs > 0
      ? ` Cinder Route cooldown ${formatSeconds(event.skillDurationMs)}.`
      : '';
    return `Animation complete. Movement free; shared offense cooldown ${formatSeconds(event.offenseDurationMs)}.${skillText}`;
  }
  if (event.type === 'damage') {
    const attacker = event.actor === 'player' ? 'Ren' : 'Ashen Bailiff';
    const target = event.target === 'player' ? 'Ren' : 'Ashen Bailiff';
    return `${attacker} hits ${target}: ${event.label} damage.`;
  }
  if (event.type === 'attack-missed') return 'Ren’s committed strike misses.';
  if (event.type === 'enemy-telegraph') return 'Ashen Bailiff winds up an Arcane · Umbral sweep. Move or jump clear.';
  if (event.type === 'attack-evaded') return 'Enemy sweep evaded. Cooldowns continue ticking.';
  if (event.type === 'battle-ended') {
    return event.result === 'victory'
      ? 'Victory. The Ashen Bailiff falls.'
      : 'Defeat. Press R or choose Restart duel.';
  }
  return null;
}

function handleEvents(events) {
  for (const event of events) {
    const description = describeEvent(event);
    if (description) pushEventLog(description);
    if (event.type === 'damage') {
      const target = event.target === 'player' ? state.player : state.enemy;
      flyouts.push({
        x: target.x,
        y: event.target === 'player' ? 282 - state.player.y : 260,
        text: event.label,
        color: event.essence === 'umbral' ? '#bd87f0' : event.essence === 'ember' ? '#ff9d55' : '#f1dfb6',
        remainingMs: 850,
      });
      if (!reducedMotion) shakeRemainingMs = 130;
    }
  }
}

function restart() {
  state = createActionBattleState({ level: Number(elements.levelSlider.value) });
  accumulatorMs = 0;
  flyouts.length = 0;
  held.left = false;
  held.right = false;
  pushEventLog('Duel restarted. Close distance, commit a strike, then reposition during cooldown.');
  canvas.focus();
  updateDom();
}

function updateMotionMode() {
  reducedMotion = reducedMotionPreference.matches;
  elements.motionMode.textContent = reducedMotion ? 'Reduced motion' : 'Full motion';
  canvas.dataset.reducedMotion = String(reducedMotion);
  if (reducedMotion) shakeRemainingMs = 0;
}

reducedMotionPreference.addEventListener?.('change', updateMotionMode);
updateMotionMode();

function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLButtonElement;
}

window.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) return;
  const key = event.key.toLowerCase();
  if (key === 'a' || key === 'arrowleft') held.left = true;
  else if (key === 'd' || key === 'arrowright') held.right = true;
  else if ((key === 'j' || key === ' ') && !event.repeat) pressed.attack = true;
  else if (key === 'k' && !event.repeat) pressed.skill = true;
  else if ((key === 'w' || key === 'arrowup') && !event.repeat) pressed.jump = true;
  else if (key === 'r' && !event.repeat) restart();
  else return;
  event.preventDefault();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'a' || key === 'arrowleft') held.left = false;
  else if (key === 'd' || key === 'arrowright') held.right = false;
});

window.addEventListener('blur', () => {
  held.left = false;
  held.right = false;
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
    pressed[button.dataset.actionControl] = true;
    canvas.focus();
  });
}

elements.restartButton.addEventListener('click', restart);
canvas.addEventListener('pointerdown', () => canvas.focus());
elements.levelSlider.addEventListener('input', () => {
  state = setActionBattleLevel(state, Number(elements.levelSlider.value));
  updateDom();
});

function setMeter(element, bar, value, maximum) {
  const fraction = maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0;
  element.setAttribute('aria-valuemax', String(maximum));
  element.setAttribute('aria-valuenow', String(Math.round(value)));
  bar.style.transform = `scaleX(${fraction})`;
}

function updateDom() {
  const playerPhase = getPlayerCombatPhase(state);
  const enemyPhase = getEnemyCombatPhase(state);
  const offenseMax = getAttackCooldownMs(state.level);
  const skillMax = getSkillCooldownMs(state.level);
  const offenseRemaining = state.player.offenseCooldownRemainingMs;
  const skillRemaining = state.player.skillCooldownRemainingMs;

  elements.playerHpText.textContent = `${state.player.hp} / ${state.player.maxHp} HP`;
  elements.playerHpMeter.setAttribute('aria-valuenow', String(state.player.hp));
  elements.playerHpBar.style.transform = `scaleX(${state.player.hp / state.player.maxHp})`;
  elements.playerStateText.textContent = state.player.grounded
    ? playerPhase.toUpperCase()
    : `AIRBORNE · ${playerPhase.toUpperCase()}`;
  elements.playerPositionText.textContent = `${Math.round(state.player.x)} · ${Math.round(state.player.y)} high`;
  elements.playerDamageText.textContent = `Cut ${getPlayerAttackDamage(state.level)} · Ember ${getPlayerSkillDamage(state.level)}`;

  elements.enemyHpText.textContent = `${state.enemy.hp} / ${state.enemy.maxHp} HP`;
  elements.enemyHpMeter.setAttribute('aria-valuenow', String(state.enemy.hp));
  elements.enemyHpBar.style.transform = `scaleX(${state.enemy.hp / state.enemy.maxHp})`;
  elements.enemyStateText.textContent = enemyPhase.toUpperCase();
  elements.enemyPositionText.textContent = String(Math.round(state.enemy.x));

  const commitment = Boolean(state.player.attack);
  elements.cooldownValue.textContent = commitment
    ? 'WAITS FOR ANIMATION'
    : offenseRemaining > 0 ? formatSeconds(offenseRemaining) : 'READY';
  elements.skillCooldownValue.textContent = commitment && state.player.attack.kind === 'skill'
    ? 'WAITS FOR ANIMATION'
    : skillRemaining > 0 ? formatSeconds(skillRemaining) : 'READY';
  setMeter(elements.cooldownMeter, elements.cooldownBar, offenseRemaining, offenseMax);
  setMeter(elements.skillCooldownMeter, elements.skillCooldownBar, skillRemaining, skillMax);

  elements.levelValue.textContent = String(state.level);
  elements.levelEffect.textContent = `${(getLevelCooldownMultiplier(state.level) * 100).toFixed(1)}% cooldown multiplier · animations unchanged`;

  canvas.dataset.playerPhase = playerPhase;
  canvas.dataset.playerGrounded = String(state.player.grounded);
  canvas.dataset.playerX = String(Math.round(state.player.x));
  canvas.dataset.playerY = String(Math.round(state.player.y));
  canvas.dataset.offenseCooldownMs = String(Math.ceil(offenseRemaining));
  canvas.dataset.skillCooldownMs = String(Math.ceil(skillRemaining));
  canvas.dataset.enemyPhase = enemyPhase;
  canvas.dataset.result = state.result ?? 'active';
}

function drawStage() {
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#090815');
  gradient.addColorStop(.5, '#191326');
  gradient.addColorStop(1, '#0a0910');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#d9d5c4';
  context.globalAlpha = .7;
  context.beginPath();
  context.arc(735, 124, 64, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = '#0c0b14';
  for (let x = 74; x < 960; x += 184) {
    context.fillRect(x, 55, 34, 366);
    context.fillRect(x - 12, 52, 58, 18);
    context.fillRect(x - 14, 399, 62, 24);
  }

  context.strokeStyle = '#40364e';
  context.lineWidth = 5;
  for (let x = 122; x < 930; x += 184) {
    context.beginPath();
    context.moveTo(x, 300);
    context.lineTo(x, 129);
    context.arc(x + 54, 129, 54, Math.PI, 0);
    context.lineTo(x + 108, 300);
    context.stroke();
  }

  context.fillStyle = '#201827';
  context.fillRect(0, 410, 960, 130);
  context.fillStyle = '#584451';
  context.fillRect(0, 410, 960, 6);
  context.fillStyle = '#0e0c13';
  for (let x = 0; x < 960; x += 64) context.fillRect(x, 468 + (x % 128 ? 7 : 0), 48, 3);

  context.fillStyle = 'rgba(152, 115, 212, .07)';
  context.fillRect(0, 350, 960, 60);
}

function drawShadow(x, width, elevation = 0) {
  context.save();
  context.globalAlpha = Math.max(.12, .42 - elevation / 500);
  context.fillStyle = '#030307';
  context.beginPath();
  context.ellipse(x, 416, width, 9, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawAtlasFrame(image, frame, x, footY, scale, facing, baseFacing, ready, label) {
  const width = frame.width * scale;
  const height = frame.height * scale;
  if (!ready) {
    context.save();
    context.strokeStyle = '#c9b46e';
    context.strokeRect(x - width / 2, footY - height, width, height);
    context.fillStyle = '#eee8da';
    context.font = '700 13px ui-monospace, monospace';
    context.textAlign = 'center';
    context.fillText(label, x, footY - height / 2);
    context.restore();
    return;
  }
  context.save();
  context.translate(x, footY);
  if (facing !== baseFacing) context.scale(-1, 1);
  context.drawImage(
    image,
    frame.x,
    frame.y,
    frame.width,
    frame.height,
    -frame.pivotX * scale,
    -frame.pivotY * scale,
    width,
    height,
  );
  context.restore();
}

function playerPose() {
  const phase = getPlayerCombatPhase(state);
  if (phase === 'defeat') return 'defeat';
  if (phase === 'hurt') return 'hit';
  if (phase === 'windup') return 'basic-strike-windup';
  if (phase === 'active') return state.player.attack?.kind === 'skill' ? 'signature-b' : 'basic-strike-active';
  if (phase === 'recovery') return 'recovery';
  if ((held.left || held.right) && !reducedMotion) return 'move';
  return 'idle';
}

function enemyPose() {
  const phase = getEnemyCombatPhase(state);
  if (phase === 'defeat') return 'defeat';
  if (phase === 'hurt') return 'hurt';
  if (phase === 'telegraph') return 'windup';
  if (phase === 'recovery') return 'recovery';
  return 'neutral';
}

function drawTelegraph() {
  if (getEnemyCombatPhase(state) !== 'telegraph') return;
  const progress = state.enemy.attack.elapsedMs / ACTION_PROTOTYPE.enemyAttackHitAtMs;
  const left = state.enemy.facing < 0
    ? state.enemy.x - ACTION_PROTOTYPE.enemyAttackRange
    : state.enemy.x;
  context.save();
  context.globalAlpha = reducedMotion ? .36 : .2 + progress * .34;
  context.fillStyle = '#9a4dd0';
  context.fillRect(left, 389, ACTION_PROTOTYPE.enemyAttackRange, 21);
  context.strokeStyle = '#df9fff';
  context.lineWidth = 2;
  context.strokeRect(left, 389, ACTION_PROTOTYPE.enemyAttackRange, 21);
  context.restore();
}

function drawAttackEffect() {
  if (getPlayerCombatPhase(state) !== 'active') return;
  const isSkill = state.player.attack?.kind === 'skill';
  context.save();
  context.strokeStyle = isSkill ? '#ff944d' : '#f0dfb7';
  context.lineWidth = isSkill ? 10 : 6;
  context.globalAlpha = .82;
  context.beginPath();
  const direction = state.player.facing;
  context.arc(
    state.player.x + direction * 25,
    338 - state.player.y,
    isSkill ? 74 : 55,
    direction > 0 ? -.9 : Math.PI - .9,
    direction > 0 ? .8 : Math.PI + .8,
  );
  context.stroke();
  context.restore();
}

function drawCanvasHud() {
  context.save();
  context.fillStyle = 'rgba(7,6,12,.78)';
  context.fillRect(22, 20, 332, 58);
  context.fillRect(606, 20, 332, 58);
  context.fillStyle = '#e9e0cc';
  context.font = '700 13px ui-monospace, monospace';
  context.textAlign = 'left';
  context.fillText('REN ISHIKAWA', 34, 40);
  context.fillStyle = '#263b42';
  context.fillRect(34, 52, 284, 10);
  context.fillStyle = '#77c3c3';
  context.fillRect(34, 52, 284 * state.player.hp / state.player.maxHp, 10);
  context.fillStyle = '#e9e0cc';
  context.textAlign = 'right';
  context.fillText('ASHEN BAILIFF', 926, 40);
  context.fillStyle = '#44222c';
  context.fillRect(642, 52, 284, 10);
  context.fillStyle = '#ca3e48';
  context.fillRect(926 - 284 * state.enemy.hp / state.enemy.maxHp, 52, 284 * state.enemy.hp / state.enemy.maxHp, 10);

  context.textAlign = 'center';
  context.fillStyle = 'rgba(7,6,12,.83)';
  context.fillRect(355, 20, 250, 70);
  context.fillStyle = state.player.attack ? '#e6c96f' : '#d7d0c2';
  context.fillText(
    state.player.attack
      ? `${state.player.attack.kind === 'skill' ? 'CINDER ROUTE' : 'COURIER’S CUT'} · COMMITTED`
      : `OFFENSE · ${state.player.offenseCooldownRemainingMs > 0 ? formatSeconds(state.player.offenseCooldownRemainingMs) : 'READY'}`,
    480,
    44,
  );
  context.fillStyle = '#f09a5e';
  context.font = '700 11px ui-monospace, monospace';
  context.fillText(`CINDER · ${state.player.skillCooldownRemainingMs > 0 ? formatSeconds(state.player.skillCooldownRemainingMs) : 'READY'}`, 480, 67);
  context.restore();
}

function drawFlyouts(deltaMs) {
  context.save();
  context.textAlign = 'center';
  context.font = '900 17px ui-monospace, monospace';
  for (let index = flyouts.length - 1; index >= 0; index -= 1) {
    const flyout = flyouts[index];
    flyout.remainingMs -= deltaMs;
    if (flyout.remainingMs <= 0) {
      flyouts.splice(index, 1);
      continue;
    }
    const elapsed = 850 - flyout.remainingMs;
    context.globalAlpha = Math.min(1, flyout.remainingMs / 220);
    context.fillStyle = '#07060c';
    context.fillText(flyout.text, flyout.x + 2, flyout.y + 2 - (reducedMotion ? 0 : elapsed * .035));
    context.fillStyle = flyout.color;
    context.fillText(flyout.text, flyout.x, flyout.y - (reducedMotion ? 0 : elapsed * .035));
  }
  context.restore();
}

function draw(deltaMs) {
  context.save();
  if (shakeRemainingMs > 0 && !reducedMotion) {
    shakeRemainingMs = Math.max(0, shakeRemainingMs - deltaMs);
    const magnitude = Math.ceil(shakeRemainingMs / 45);
    context.translate(Math.sin(state.elapsedMs * .37) * magnitude, Math.cos(state.elapsedMs * .29) * magnitude);
  }
  drawStage();
  drawTelegraph();
  drawShadow(state.player.x, 41, state.player.y);
  drawShadow(state.enemy.x, 54);

  const playerFrame = getPartyCombatFrame('ren', playerPose());
  const enemyFrame = getEnemyAtlasFrame('ashen-bailiff', enemyPose());
  drawAtlasFrame(
    art.party,
    playerFrame,
    state.player.x,
    415 - state.player.y,
    2.35,
    state.player.facing,
    1,
    art.partyReady,
    'REN',
  );
  drawAtlasFrame(
    art.enemy,
    {
      ...enemyFrame,
      pivotX: enemyFrame.width / 2,
      pivotY: enemyFrame.height - 7,
    },
    state.enemy.x,
    415,
    2.05,
    state.enemy.facing,
    -1,
    art.enemyReady,
    'BAILIFF',
  );
  drawAttackEffect();
  drawFlyouts(deltaMs);
  drawCanvasHud();

  if (state.result) {
    context.fillStyle = 'rgba(5,4,9,.68)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = 'center';
    context.fillStyle = state.result === 'victory' ? '#e7c875' : '#df6670';
    context.font = '500 52px Georgia, serif';
    context.fillText(state.result === 'victory' ? 'Bailiff Broken' : 'The Bell Takes Its Due', 480, 248);
    context.fillStyle = '#d6cfbf';
    context.font = '700 13px ui-monospace, monospace';
    context.fillText('PRESS R TO RESTART', 480, 282);
  }
  context.restore();
}

function frame(timestamp) {
  const elapsed = Math.min(100, Math.max(0, timestamp - lastTimestamp));
  lastTimestamp = timestamp;
  accumulatorMs += elapsed;

  let firstStep = true;
  let processedStep = false;
  while (accumulatorMs >= FIXED_STEP_MS) {
    const events = stepActionBattle(state, {
      left: held.left,
      right: held.right,
      attackPressed: firstStep && pressed.attack,
      skillPressed: firstStep && pressed.skill,
      jumpPressed: firstStep && pressed.jump,
    }, FIXED_STEP_MS);
    handleEvents(events);
    accumulatorMs -= FIXED_STEP_MS;
    firstStep = false;
    processedStep = true;
  }
  if (processedStep) {
    pressed.attack = false;
    pressed.skill = false;
    pressed.jump = false;
  }

  updateDom();
  draw(elapsed);
  requestAnimationFrame(frame);
}

updateDom();
requestAnimationFrame(frame);
