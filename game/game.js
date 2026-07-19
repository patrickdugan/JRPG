import {
  CombatEngine,
  DELIVERY_TYPES,
  ESSENCE_TYPES,
  PHASES,
  combatData,
} from './engine.mjs';
import { mountAudioControls } from './audio-controls.mjs';

const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const feedback = document.querySelector('#feedback');
const accessLog = document.querySelector('#access-log');
const commandButtons = [...document.querySelectorAll('[data-action]')];
const pageAudio = mountAudioControls({ desiredLoop: 'battle' });

ctx.imageSmoothingEnabled = false;

const engine = new CombatEngine({ seed: 0x4b1c0de });
const board = { x: 28, y: 122, cell: 48, width: 12, height: 7 };
const boardWidth = board.width * board.cell;
const boardHeight = board.height * board.cell;
const lastInputAt = new Map();

let previousFrameAt = performance.now();
let seenResolution = null;
let actionFlash = null;
let announcedSignature = '';

const palette = Object.freeze({
  ink: '#080a15',
  deep: '#0e1123',
  panel: '#181b34',
  panelLight: '#242a4a',
  outline: '#58618c',
  parchment: '#eee2c5',
  muted: '#aeb6cc',
  gold: '#d5b45c',
  cedar: '#6a3d33',
  cedarLight: '#9b5a43',
  vermilion: '#b54945',
  rain: '#6c9ebb',
  teal: '#79b3b0',
  violet: '#9c83c5',
  ember: '#e66c42',
});

const keyDirections = Object.freeze({
  arrowleft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
  arrowup: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  q: { x: -1, y: -1 },
  e: { x: 1, y: -1 },
  z: { x: -1, y: 1 },
  c: { x: 1, y: 1 },
});

function cellCenter(position) {
  return {
    x: board.x + position.x * board.cell + board.cell / 2,
    y: board.y + position.y * board.cell + board.cell / 2,
  };
}

function drawPanel(x, y, width, height, fill = palette.panel, outline = palette.outline) {
  ctx.fillStyle = '#060812';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = outline;
  ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 3, y + 3, width - 6, height - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x + 4, y + 4, width - 8, 2);
}

function drawText(text, x, y, size = 12, color = palette.parchment, align = 'left') {
  ctx.font = `${size}px ui-monospace, Cascadia Mono, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function truncate(text, maxCharacters) {
  return text.length <= maxCharacters ? text : `${text.slice(0, Math.max(0, maxCharacters - 1))}…`;
}

function drawWrappedText(text, x, y, maxWidth, lineHeight, size = 10, color = palette.parchment, maxLines = 3) {
  ctx.font = `${size}px ui-monospace, Cascadia Mono, Consolas, monospace`;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (words.length && lines.length === maxLines && lines.join(' ').length < text.length) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1], Math.max(4, Math.floor(maxWidth / (size * 0.59)) - 1));
  }
  lines.forEach((lineText, index) => drawText(lineText, x, y + index * lineHeight, size, color));
  return lines.length;
}

function drawPixelChrysanthemum(x, y, color = palette.gold) {
  ctx.fillStyle = color;
  const petals = [
    [-4, -12], [0, -14], [4, -12], [-11, -5], [11, -5],
    [-13, 0], [13, 0], [-11, 5], [11, 5], [-4, 12], [0, 14], [4, 12],
  ];
  petals.forEach(([px, py]) => ctx.fillRect(x + px, y + py, 5, 5));
  ctx.fillStyle = '#f4d983';
  ctx.fillRect(x - 3, y - 3, 7, 7);
}

function drawHeader() {
  ctx.fillStyle = '#10132a';
  ctx.fillRect(0, 0, canvas.width, 108);
  ctx.fillStyle = '#262a4a';
  ctx.fillRect(0, 104, canvas.width, 4);
  ctx.fillStyle = 'rgba(156, 131, 197, 0.22)';
  ctx.fillRect(0, 0, 390, 2);
  drawPixelChrysanthemum(36, 35);
  drawText('BELLS OF THE BLACK CHRYSANTHEMUM', 62, 29, 16, palette.parchment);
  drawText('BELL COURT AT TAKAMINE  ·  FP-0 COMBAT PROOF', 62, 49, 9, palette.gold);
  drawText('REN + LISE  /  MATEUS’S SEAL  /  ASHEN ONI TITHE', 30, 83, 10, palette.muted);

  drawPanel(560, 14, 370, 72, '#171b32', '#4d567e');
  const phaseName = {
    [PHASES.PLAYER_COMMAND]: 'REN’S ACTIVATION',
    [PHASES.ENEMY_THINK]: 'ONI INTENT',
    [PHASES.WAITING]: 'RECOVERY WINDOW',
    [PHASES.VICTORY]: 'BANNER FALLEN',
    [PHASES.DEFEAT]: 'COURT CLAIMED',
  }[engine.phase] || 'BELL COURT';
  drawText(phaseName, 575, 37, 12, engine.phase === PHASES.PLAYER_COMMAND ? palette.teal : palette.gold);
  const pace = engine.phase === PHASES.PLAYER_COMMAND ? `${engine.movementPoints} PACE` : '— PACE';
  drawText(pace, 914, 37, 11, palette.parchment, 'right');
  drawText('TEMPO / NEXT ACTIVATIONS', 575, 57, 8, palette.muted);
  drawTempoRibbon(575, 66, 338);
}

function drawTempoRibbon(x, y, width) {
  const upcoming = engine.getUpcoming();
  const slotWidth = Math.floor(width / Math.max(1, upcoming.length));
  upcoming.forEach((unit, index) => {
    const left = x + index * slotWidth;
    const fill = unit.id === engine.player.id ? '#315a64' : '#5e384c';
    ctx.fillStyle = '#0b0e1c';
    ctx.fillRect(left, y, slotWidth - 4, 14);
    ctx.fillStyle = fill;
    const ratio = unit.readyInMs === 0 ? 1 : Math.max(0.1, 1 - Math.min(unit.readyInMs, 3200) / 3200);
    ctx.fillRect(left + 1, y + 1, Math.max(2, (slotWidth - 6) * ratio), 12);
    drawText(unit.id === engine.player.id ? 'REN' : 'ONI', left + 5, y + 10, 8, palette.parchment);
    drawText(unit.readyInMs === 0 ? 'READY' : `+${(unit.readyInMs / 1000).toFixed(1)}s`, left + slotWidth - 8, y + 10, 8, palette.parchment, 'right');
  });
}

function drawStage(time) {
  drawPanel(board.x - 5, board.y - 5, boardWidth + 10, boardHeight + 10, '#11152a', '#59648c');
  for (let row = 0; row < board.height; row += 1) {
    for (let column = 0; column < board.width; column += 1) {
      const x = board.x + column * board.cell;
      const y = board.y + row * board.cell;
      const alternate = (column + row) % 2 === 0;
      ctx.fillStyle = alternate ? '#1b2138' : '#171d32';
      ctx.fillRect(x, y, board.cell, board.cell);
      ctx.fillStyle = alternate ? '#252b46' : '#222942';
      ctx.fillRect(x + 2, y + 2, board.cell - 4, 2);
      ctx.fillStyle = 'rgba(4, 7, 16, 0.25)';
      ctx.fillRect(x, y + board.cell - 3, board.cell, 3);
      if ((column * 3 + row * 5) % 4 === 0) {
        ctx.fillStyle = '#313850';
        ctx.fillRect(x + 9, y + 25, 3, 2);
        ctx.fillRect(x + 28, y + 14, 2, 3);
      }
    }
  }

  const legalMoves = engine.phase === PHASES.PLAYER_COMMAND && engine.movementPoints > 0
    ? engine.getLegalMoves('ren')
    : [];
  legalMoves.forEach((move) => {
    const x = board.x + move.destination.x * board.cell;
    const y = board.y + move.destination.y * board.cell;
    ctx.fillStyle = 'rgba(103, 196, 186, 0.22)';
    ctx.fillRect(x + 3, y + 3, board.cell - 6, board.cell - 6);
    ctx.fillStyle = palette.teal;
    ctx.fillRect(x + 21, y + 21, 6, 6);
  });

  engine.map.blocked.forEach((key) => {
    const [column, row] = key.split(',').map(Number);
    drawGateSpace(board.x + column * board.cell, board.y + row * board.cell);
  });

  drawRain(time);
  drawAxisLabels();
  drawUnit(engine.player, true);
  drawUnit(engine.enemy, false);
  drawAttackFlash(time);
}

function drawGateSpace(x, y) {
  ctx.fillStyle = '#0a0b16';
  ctx.fillRect(x + 2, y + 2, board.cell - 4, board.cell - 4);
  ctx.fillStyle = '#512e2d';
  ctx.fillRect(x + 5, y + 6, board.cell - 10, 8);
  ctx.fillRect(x + 8, y + 17, board.cell - 16, 6);
  ctx.fillRect(x + 5, y + 27, board.cell - 10, 8);
  ctx.fillStyle = '#9f5c42';
  ctx.fillRect(x + 6, y + 7, board.cell - 12, 2);
  ctx.fillRect(x + 9, y + 18, board.cell - 18, 2);
  ctx.fillStyle = '#c5a956';
  ctx.fillRect(x + 21, y + 11, 6, 17);
  ctx.fillStyle = '#16101c';
  ctx.fillRect(x + 23, y + 13, 2, 13);
}

function drawRain(time) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(board.x, board.y, boardWidth, boardHeight);
  ctx.clip();
  ctx.globalAlpha = 0.32;
  ctx.strokeStyle = palette.rain;
  ctx.lineWidth = 1;
  for (let index = 0; index < 54; index += 1) {
    const x = board.x + ((index * 89 + Math.floor(time / 9) * 2) % boardWidth);
    const y = board.y + ((index * 47 + Math.floor(time / 12) * 3) % boardHeight);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 11);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAxisLabels() {
  for (let column = 0; column < board.width; column += 1) {
    drawText(String(column + 1).padStart(2, '0'), board.x + column * board.cell + 4, board.y - 9, 7, '#8893b3');
  }
  for (let row = 0; row < board.height; row += 1) {
    drawText(String(row + 1).padStart(2, '0'), board.x - 18, board.y + row * board.cell + 12, 7, '#8893b3');
  }
}

function drawUnit(unit, playerControlled) {
  const center = cellCenter(unit.pos);
  const isActive = engine.activeId === unit.id;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
  ctx.fillRect(center.x - 15, center.y + 16, 30, 6);
  if (playerControlled) drawRen(center.x, center.y, unit.stance, isActive);
  else drawOni(center.x, center.y, unit.stance, isActive);

  const barWidth = 38;
  const barX = center.x - Math.floor(barWidth / 2);
  const barY = center.y - 27;
  ctx.fillStyle = '#070914';
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, 7);
  ctx.fillStyle = playerControlled ? '#55a6a1' : '#b04e50';
  ctx.fillRect(barX, barY, Math.max(0, Math.round(barWidth * (unit.hp / unit.maxHp))), 5);
  const label = playerControlled ? 'REN' : 'ONI';
  drawText(label, center.x, center.y - 32, 8, palette.parchment, 'center');
  if (unit.stance !== 'neutral') drawStanceGlyph(center.x + 18, center.y - 19, unit.stance);
  if (isActive) {
    ctx.strokeStyle = playerControlled ? palette.teal : palette.vermilion;
    ctx.lineWidth = 2;
    ctx.strokeRect(board.x + unit.pos.x * board.cell + 3, board.y + unit.pos.y * board.cell + 3, board.cell - 6, board.cell - 6);
  }
}

function drawRen(x, y, stance, active) {
  const pulse = active ? (Math.floor(performance.now() / 180) % 2) : 0;
  ctx.fillStyle = '#0b0d19';
  ctx.fillRect(x - 9, y + 8, 7, 12);
  ctx.fillRect(x + 2, y + 8, 7, 12);
  ctx.fillStyle = '#25485c';
  ctx.fillRect(x - 11, y - 3, 22, 16);
  ctx.fillStyle = '#396e7a';
  ctx.fillRect(x - 8, y - 6, 16, 11);
  ctx.fillStyle = '#d0a27d';
  ctx.fillRect(x - 6, y - 15, 12, 10);
  ctx.fillStyle = '#141522';
  ctx.fillRect(x - 8, y - 18, 16, 6);
  ctx.fillRect(x - 11, y - 15, 5, 5);
  ctx.fillStyle = '#d9c68e';
  ctx.fillRect(x + 9, y - 2, 13, 3);
  ctx.fillStyle = '#b6d9d6';
  ctx.fillRect(x + 19, y - 3, 7, 2);
  if (pulse) {
    ctx.fillStyle = '#7ccbc5';
    ctx.fillRect(x - 13, y + 15, 4, 2);
  }
  if (stance === 'guard') {
    ctx.fillStyle = '#74beb9';
    ctx.fillRect(x - 16, y - 3, 4, 18);
    ctx.fillRect(x - 19, y + 1, 3, 10);
  }
}

function drawOni(x, y, stance, active) {
  const pulse = active ? (Math.floor(performance.now() / 150) % 2) : 0;
  ctx.fillStyle = '#0b0813';
  ctx.fillRect(x - 12, y + 7, 9, 14);
  ctx.fillRect(x + 4, y + 7, 9, 14);
  ctx.fillStyle = '#4d2638';
  ctx.fillRect(x - 16, y - 7, 32, 19);
  ctx.fillStyle = '#7d3c44';
  ctx.fillRect(x - 11, y - 13, 22, 13);
  ctx.fillStyle = '#9c6251';
  ctx.fillRect(x - 8, y - 18, 16, 8);
  ctx.fillStyle = '#e6d0a0';
  ctx.fillRect(x - 11, y - 24, 5, 8);
  ctx.fillRect(x + 6, y - 24, 5, 8);
  ctx.fillStyle = '#ffcb73';
  ctx.fillRect(x - 5, y - 14, 3, 3);
  ctx.fillRect(x + 4, y - 14, 3, 3);
  ctx.fillStyle = '#252034';
  ctx.fillRect(x - 26, y - 1, 12, 5);
  ctx.fillRect(x - 29, y - 5, 4, 15);
  if (pulse) {
    ctx.fillStyle = '#d9554b';
    ctx.fillRect(x + 13, y + 15, 4, 2);
  }
  if (stance === 'guard') {
    ctx.fillStyle = '#c9a36a';
    ctx.fillRect(x + 17, y - 6, 4, 18);
  }
}

function drawStanceGlyph(x, y, stance) {
  const color = stance === 'guard' ? palette.teal : palette.violet;
  ctx.fillStyle = '#0a0c18';
  ctx.fillRect(x - 5, y - 5, 11, 11);
  ctx.fillStyle = color;
  if (stance === 'guard') {
    ctx.fillRect(x - 2, y - 4, 5, 9);
    ctx.fillRect(x - 4, y - 2, 9, 3);
  } else {
    ctx.fillRect(x - 4, y - 4, 3, 3);
    ctx.fillRect(x + 2, y + 2, 3, 3);
    ctx.fillRect(x + 2, y - 4, 3, 3);
    ctx.fillRect(x - 4, y + 2, 3, 3);
  }
}

function drawAttackFlash(time) {
  if (!actionFlash) return;
  const age = time - actionFlash.startedAt;
  if (age > 620) {
    actionFlash = null;
    return;
  }
  const resolution = actionFlash.resolution;
  const attacker = engine.getActor(resolution.attackerId);
  const target = engine.getActor(resolution.targetId);
  if (!attacker || !target) return;
  const from = cellCenter(attacker.pos);
  const to = cellCenter(target.pos);
  const skill = engine.getSkill(resolution.skillId);
  const color = skill.essence ? ESSENCE_TYPES[skill.essence].color : DELIVERY_TYPES[skill.delivery].color;
  const progress = age / 620;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.strokeStyle = color;
  ctx.lineWidth = resolution.dodged ? 2 : 4;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y - 4);
  ctx.lineTo(to.x, to.y - 4);
  ctx.stroke();
  ctx.fillStyle = color;
  const radius = Math.floor(5 + progress * 14);
  if (resolution.dodged) {
    ctx.fillRect(to.x - radius, to.y - radius, radius * 2, 3);
    ctx.fillRect(to.x - radius, to.y + radius - 3, radius * 2, 3);
  } else {
    ctx.fillRect(to.x - radius, to.y - radius, radius * 2, radius * 2);
    ctx.fillStyle = '#fff1c2';
    ctx.fillRect(to.x - 3, to.y - 3, 6, 6);
  }
  ctx.restore();
}

function drawLedger() {
  const x = 622;
  const y = 117;
  const width = 310;
  const height = 346;
  drawPanel(x, y, width, height, '#151932', '#555f89');
  drawText('COMBAT LEDGER', x + 14, y + 23, 12, palette.gold);
  drawText('READ THE ROOM · THEN TAKE THE TURN', x + 14, y + 37, 8, palette.muted);

  drawActorReadout(engine.player, x + 14, y + 58, true);
  drawActorReadout(engine.enemy, x + 14, y + 118, false);

  ctx.fillStyle = '#515c84';
  ctx.fillRect(x + 14, y + 181, width - 28, 1);
  drawText('ONI RESISTANCE', x + 14, y + 198, 9, palette.gold);
  drawText('CUT 100%   PIERCE 125%   CRUSH 75%', x + 14, y + 214, 9, palette.parchment);
  drawText('ARCANE 100% · EMBER 125% · RADIANCE 125%', x + 14, y + 228, 8, palette.parchment);
  drawText('UMBRAL 75%     /     REN UMBRAL 75%', x + 14, y + 242, 8, palette.violet);

  const last = engine.lastResolution;
  ctx.fillStyle = '#515c84';
  ctx.fillRect(x + 14, y + 253, width - 28, 1);
  drawText('LAST RESOLUTION', x + 14, y + 270, 9, palette.gold);
  if (last) {
    drawWrappedText(last.text, x + 14, y + 287, width - 28, 13, 8, palette.parchment, 3);
  } else {
    drawText('No strike resolved. Position before you commit.', x + 14, y + 288, 8, palette.muted);
  }

  const targetReadout = `DIST ${engine.distance}  ·  PACE ${engine.movementPoints}  ·  ${engine.result ? engine.result.toUpperCase() : 'LIVE'}`;
  drawText(targetReadout, x + 14, y + 330, 9, engine.result ? palette.gold : palette.teal);
}

function drawActorReadout(actor, x, y, isPlayer) {
  const color = isPlayer ? palette.teal : palette.vermilion;
  drawText(actor.name.toUpperCase(), x, y, 10, color);
  drawText(`${actor.hp}/${actor.maxHp} HP   ·   ${actor.stance.toUpperCase()}`, x, y + 14, 9, palette.parchment);
  drawText(`[${actor.pos.x + 1}, ${actor.pos.y + 1}]  POW ${actor.power}  GRD ${actor.guard}`, x, y + 28, 8, palette.muted);
}

function drawMessageBar() {
  drawPanel(28, 474, 904, 51, '#121630', '#4e587f');
  drawText('COURT RECORD', 42, 493, 8, palette.gold);
  const latest = engine.log[0]?.text || engine.message;
  drawWrappedText(latest, 42, 509, 872, 11, 9, palette.parchment, 2);
}

function drawOutcomeOverlay() {
  if (!engine.result) return;
  const victory = engine.result === 'victory';
  ctx.fillStyle = 'rgba(5, 6, 14, 0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawPanel(220, 176, 520, 164, victory ? '#193038' : '#351d2a', victory ? '#70b9ad' : '#bb5b5b');
  drawPixelChrysanthemum(480, 209, victory ? palette.gold : palette.vermilion);
  drawText(victory ? 'THE BANNER FALLS' : 'THE COURT COLLECTS', 480, 251, 18, palette.parchment, 'center');
  const copy = victory
    ? 'Lise finds Mateus’s seal beneath the lacquer. The next bell has a name.'
    : 'Ren is taken beneath the bell. Read the ledger, reposition, and try again.';
  drawWrappedText(copy, 281, 274, 398, 15, 10, palette.parchment, 3);
  drawText('PRESS R OR USE RESTART TO RESET THE ENCOUNTER', 480, 319, 9, palette.gold, 'center');
}

function render(time) {
  if (engine.lastResolution !== seenResolution) {
    seenResolution = engine.lastResolution;
    actionFlash = seenResolution ? { resolution: seenResolution, startedAt: time } : null;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = palette.ink;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawHeader();
  drawStage(time);
  drawLedger();
  drawMessageBar();
  drawOutcomeOverlay();
  updateInterface();
}

function updateInterface() {
  feedback.textContent = engine.message;
  const skills = new Map(engine.getActionAvailability().map((skill) => [skill.id, skill]));
  commandButtons.forEach((button) => {
    const [kind, value] = button.dataset.action.split(':');
    if (kind === 'restart') {
      button.disabled = false;
      return;
    }
    if (kind === 'skill') {
      const skill = skills.get(value);
      button.disabled = !skill?.available;
      button.title = skill?.inRange
        ? 'Use during Ren’s Activation.'
        : `Out of range: ${engine.distance}/${skill?.range ?? '?'}.`;
      return;
    }
    button.disabled = engine.phase !== PHASES.PLAYER_COMMAND;
  });

  const accessibilityMessage = `${engine.phase.replaceAll('_', ' ')}. ${engine.message}`;
  if (accessibilityMessage !== announcedSignature) {
    announcedSignature = accessibilityMessage;
    accessLog.textContent = accessibilityMessage;
  }
}

function applyAction(action) {
  pageAudio.playCue('uiConfirm');
  const [kind, value] = action.split(':');
  if (kind === 'skill') engine.usePlayerSkill(value);
  if (kind === 'stance') engine.takeStance(value);
  if (kind === 'restart') {
    engine.restart();
    seenResolution = null;
    actionFlash = null;
  }
  render(performance.now());
}

commandButtons.forEach((button) => {
  button.addEventListener('click', () => applyAction(button.dataset.action));
});

window.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  const direction = keyDirections[key];
  if (direction) {
    event.preventDefault();
    const now = performance.now();
    const previous = lastInputAt.get(key) || 0;
    if (!event.repeat || now - previous >= 145) {
      lastInputAt.set(key, now);
      engine.movePlayer(direction.x, direction.y);
      render(now);
    }
    return;
  }
  if (event.repeat) return;
  const shortcuts = {
    '1': 'skill:courier-cut',
    '2': 'skill:cinder-route',
    '3': 'skill:dawn-signal',
    g: 'stance:guard',
    f: 'stance:dodge',
    r: 'restart',
  };
  if (shortcuts[key]) {
    event.preventDefault();
    applyAction(shortcuts[key]);
  }
});

function gameLoop(now) {
  const elapsed = Math.min(100, Math.max(0, now - previousFrameAt));
  previousFrameAt = now;
  engine.advance(elapsed);
  render(now);
  window.requestAnimationFrame(gameLoop);
}

render(previousFrameAt);
window.requestAnimationFrame(gameLoop);

// Expose a tiny manual-inspection seam in development tools without coupling
// combat rules to the DOM. It is intentionally not used by the game itself.
window.bellsPrototype = Object.freeze({ engine, combatData });
