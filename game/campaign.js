import { CAMPAIGN, getAllChapters } from './content/campaign.mjs';
import { LEVELS, TERRAIN_TAGS, getLevel, getLevelForChapter } from './content/levels.mjs';
import { ENCOUNTERS, getEncounterForChapter } from './content/encounters.mjs';
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

const chapterList = document.querySelector('#chapterList');
const completionLabel = document.querySelector('#completionLabel');
const chapterKicker = document.querySelector('#chapterKicker');
const chapterTitle = document.querySelector('#chapterTitle');
const chapterObjective = document.querySelector('#chapterObjective');
const mapCanvas = document.querySelector('#mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
const mapName = document.querySelector('#mapName');
const mapLegend = document.querySelector('#mapLegend');
const sceneNumber = document.querySelector('#sceneNumber');
const sceneTitle = document.querySelector('#sceneTitle');
const sceneLocation = document.querySelector('#sceneLocation');
const sceneText = document.querySelector('#sceneText');
const choiceDeck = document.querySelector('#choiceDeck');
const choiceResult = document.querySelector('#choiceResult');
const previousScene = document.querySelector('#previousScene');
const nextScene = document.querySelector('#nextScene');
const progressLabel = document.querySelector('#progressLabel');
const progressFill = document.querySelector('#progressFill');
const resetCampaign = document.querySelector('#resetCampaign');
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

const chapters = getAllChapters();
const allBeatRecords = chapters.flatMap((chapter) => chapter.beats.map((beat) => ({ chapterId: chapter.id, beat })));
const saveAdapter = createLocalStorageAdapter();
const loadedSave = saveAdapter.load();
let campaignState = loadedSave.ok ? loadedSave.state : createCampaignState();
let animationNow = 0;
const fieldState = {
  levelId: null,
  position: null,
};

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

function firstOpenFieldPosition(level, requested) {
  if (requested && isFieldOpen(level, requested.x, requested.y)) return requested;
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if (isFieldOpen(level, x, y)) return { x, y };
    }
  }
  return requested ?? { x: 0, y: 0 };
}

function ensureFieldPosition(level) {
  if (fieldState.levelId === level.id && fieldState.position) return false;
  const rawSpawn = Array.isArray(level.spawn) ? level.spawn[0] : level.spawn;
  fieldState.levelId = level.id;
  fieldState.position = firstOpenFieldPosition(level, coordinatesOf(rawSpawn));
  return true;
}

function describeFieldPosition(level, prefix = 'Field position') {
  const position = fieldState.position;
  return `${prefix}: ${level.name}, space ${position.x + 1},${position.y + 1}. W/A/S/D orthogonal · Q/E/Z/C diagonal.`;
}

function attemptFieldMove(dx, dy) {
  const chapter = getChapter();
  const beat = getBeat();
  const level = getLevelForBeat(chapter, beat);
  ensureFieldPosition(level);
  const current = fieldState.position;
  const target = { x: current.x + dx, y: current.y + dy };
  const direction = dx && dy ? 'diagonal' : 'orthogonal';

  if (!isFieldOpen(level, target.x, target.y)) {
    fieldFeedback.textContent = `Blocked ${direction} step. ${describeFieldPosition(level)}`;
    return;
  }
  if (dx && dy && (!isFieldOpen(level, current.x + dx, current.y) || !isFieldOpen(level, current.x, current.y + dy))) {
    fieldFeedback.textContent = `Diagonal corner blocked; use an open orthogonal route. ${describeFieldPosition(level)}`;
    return;
  }

  fieldState.position = target;
  const reachedExit = (level.exits ?? []).find((exit) => keyOf(exit) === `${target.x},${target.y}`);
  fieldFeedback.textContent = reachedExit
    ? `Reached exit: ${reachedExit.id ?? 'route marker'} → ${reachedExit.destinationLevelId ?? 'next story route'}. Story progression stays under your control.`
    : describeFieldPosition(level, `Moved one ${direction} space`);
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

  const partyPosition = fieldState.position;
  const partyX = originX + partyPosition.x * cell + cell / 2;
  const partyY = originY + partyPosition.y * cell + cell / 2 + Math.sin(now / 150) * Math.max(1, cell * 0.045);
  mapCtx.fillStyle = '#0b1020';
  mapCtx.fillRect(partyX - cell * 0.2, partyY - cell * 0.24, cell * 0.4, cell * 0.48);
  mapCtx.fillStyle = '#f6d47e';
  mapCtx.fillRect(partyX - cell * 0.14, partyY - cell * 0.2, cell * 0.28, cell * 0.38);
  mapCtx.fillStyle = '#e6cb80';
  mapCtx.fillRect(partyX - cell * 0.055, partyY - cell * 0.13, cell * 0.11, cell * 0.11);

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

function formatDialogue(text) {
  if (Array.isArray(text)) {
    return text
      .map((line) => `${line.speaker ?? 'NARRATOR'}: ${line.line ?? line.text ?? ''}`)
      .join('\n\n');
  }
  return String(text ?? 'Scene text pending.');
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
    if (pickedIds.has(choice.id)) button.classList.add('is-picked');
    choiceDeck.append(button);
  });
  const results = choices
    .filter((choice) => pickedIds.has(choice.id))
    .map((choice) => choice.result ?? 'This decision is recorded in the campaign ledger.');
  if (results.length) choiceResult.textContent = results.join(' ');
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

function render() {
  const chapter = getChapter();
  const beat = getBeat();
  const level = getLevelForBeat(chapter, beat);
  const enteredNewLevel = ensureFieldPosition(level);
  const encounter = getEncounterForChapter(chapter.id) ?? ENCOUNTERS[0];
  const chapterIndex = currentChapterIndex();
  const beatIndex = currentBeatIndex();
  const recordIndex = allBeatRecords.findIndex((record) => record.beat.id === beat.id);
  chapterKicker.textContent = `${chapter.act ?? 'Campaign'} · ${chapter.number ?? chapterIndex}`;
  chapterTitle.textContent = chapter.title;
  chapterObjective.textContent = chapter.objective;
  sceneNumber.textContent = `SCENE ${String(beatIndex + 1).padStart(2, '0')}/${String(chapter.beats.length).padStart(2, '0')}`;
  sceneTitle.textContent = beat.title;
  sceneLocation.textContent = beat.location ?? chapter.maps?.[0]?.name ?? 'Campaign route';
  sceneText.textContent = formatDialogue(beat.text);
  partyList.textContent = formatParty(chapter.party);
  chapterReward.textContent = formatValue(chapter.reward, 'Narrative progress');
  encounterName.textContent = encounter?.name ?? formatValue(chapter.boss, 'Chapter encounter pending');
  encounterObjective.textContent = formatBrief(encounter?.objective, chapter.objective);
  encounterLesson.textContent = formatBrief(encounter?.lesson, 'Scene and party progression');
  encounterEnemies.textContent = formatEnemies(encounter?.enemies);
  bossMechanic.textContent = formatBrief(encounter?.bossMechanic, 'No boss mechanic assigned.');
  previousScene.disabled = recordIndex <= 0;
  nextScene.disabled = isCampaignComplete(campaignState);
  nextScene.textContent = isCampaignComplete(campaignState) ? 'Campaign complete' : 'Next scene →';
  const progress = (beatIndex + 1) / chapter.beats.length;
  progressLabel.textContent = `${beatIndex + 1} of ${chapter.beats.length} scenes`;
  progressFill.style.width = `${Math.round(progress * 100)}%`;
  setKeyArt(chapter);
  renderChoices(beat);
  renderChapterList();
  fieldFeedback.textContent = describeFieldPosition(level, enteredNewLevel ? 'Entered field' : 'Field position');
  drawMap(level, encounter, animationNow);
}

function choose(choiceId) {
  const beat = getBeat();
  const choice = (beat.choices ?? []).find((entry) => entry.id === choiceId);
  if (!choice) return;
  campaignState = isMultiSelectBeat(beat)
    ? appendChoice(campaignState, choice.id)
    : selectChoice(campaignState, choice.id);
  persistCampaignState();
  render();
}

function advance(direction) {
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
  campaignState = completeCurrentBeat(campaignState);
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
  campaignState = moveToBeat(campaignState, chapter.id, target.id);
  persistCampaignState();
  render();
});

choiceDeck.addEventListener('click', (event) => {
  const button = event.target.closest('[data-choice-id]');
  if (button) choose(button.dataset.choiceId);
});

fieldControls.addEventListener('click', (event) => {
  const button = event.target.closest('[data-field-move]');
  if (!button) return;
  const [dx, dy] = button.dataset.fieldMove.split(',').map(Number);
  attemptFieldMove(dx, dy);
});

previousScene.addEventListener('click', () => advance(-1));
nextScene.addEventListener('click', () => advance(1));
resetCampaign.addEventListener('click', () => {
  campaignState = resetCampaignState();
  saveAdapter.clear();
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
  animationNow = now;
  const chapter = getChapter();
  const level = getLevelForBeat(chapter, getBeat());
  const encounter = getEncounterForChapter(chapter.id) ?? ENCOUNTERS[0];
  drawMap(level, encounter, now);
  requestAnimationFrame(animate);
}

document.title = `${CAMPAIGN.title} — Campaign Atlas`;
render();
requestAnimationFrame(animate);
