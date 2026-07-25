import {
  ENEMY_TRIGGER_CLIPS,
  ENEMY_TRIGGER_ENTRIES,
  ENEMY_TRIGGER_GEOMETRY,
  PARTY_ANIMATION_CHARACTERS,
  PARTY_ANIMATION_CLIPS,
  PARTY_ANIMATION_GEOMETRY,
  sampleEnemyTriggerAnimation,
  samplePartyAnimation,
} from './roster-animation-atlas.mjs';

const elements = {
  partyCanvas: document.querySelector('#partyCanvas'),
  enemyCanvas: document.querySelector('#enemyCanvas'),
  partyCharacter: document.querySelector('#partyCharacter'),
  enemyCharacter: document.querySelector('#enemyCharacter'),
  partyClips: document.querySelector('#partyClips'),
  enemyClips: document.querySelector('#enemyClips'),
  partyStatus: document.querySelector('#partyStatus'),
  enemyStatus: document.querySelector('#enemyStatus'),
  runTrigger: document.querySelector('#runTrigger'),
};

const partyContext = elements.partyCanvas.getContext('2d', { alpha: false });
const enemyContext = elements.enemyCanvas.getContext('2d', { alpha: false });
partyContext.imageSmoothingEnabled = false;
enemyContext.imageSmoothingEnabled = false;

const partyAtlas = new Image();
const enemyAtlas = new Image();
let partyReady = false;
let enemyReady = false;
let partyCharacterId = PARTY_ANIMATION_CHARACTERS[0].id;
let enemyId = ENEMY_TRIGGER_ENTRIES[0].id;
let partyClipId = 'idle';
let enemyClipId = 'dormant';
let partyStartedAt = performance.now();
let enemyStartedAt = performance.now();
let triggerSequenceStartedAt = null;
let animationHandle = null;

const triggerSequence = [
  { clipId: 'dormant', durationMs: 600 },
  { clipId: 'sense', durationMs: 390 },
  { clipId: 'alert', durationMs: 400 },
  { clipId: 'pursue', durationMs: 780 },
  { clipId: 'engage', durationMs: 380 },
  { clipId: 'cooldown', durationMs: 600 },
];

function fillOptions(select, entries) {
  select.replaceChildren(...entries.map((entry) => {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.name;
    return option;
  }));
}

function fillClipButtons(container, clips, onChoose, selectedId) {
  container.replaceChildren(...clips.map((clip) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = clip.id;
    button.dataset.clipId = clip.id;
    button.setAttribute('aria-pressed', String(clip.id === selectedId));
    button.addEventListener('click', () => onChoose(clip.id));
    return button;
  }));
}

function selectPartyClip(clipId) {
  partyClipId = clipId;
  partyStartedAt = performance.now();
  elements.partyClips.querySelectorAll('button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.clipId === clipId));
  });
}

function selectEnemyClip(clipId) {
  triggerSequenceStartedAt = null;
  enemyClipId = clipId;
  enemyStartedAt = performance.now();
  elements.enemyClips.querySelectorAll('button').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.clipId === clipId));
  });
}

function drawStage(context, width, height, accent) {
  context.fillStyle = '#17151e';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#24212b';
  for (let y = 8; y < height - 26; y += 16) {
    for (let x = (y / 16) % 2 ? 8 : 0; x < width; x += 16) {
      context.fillRect(x, y, 8, 8);
    }
  }
  context.fillStyle = '#0d0c11';
  context.fillRect(0, height - 28, width, 28);
  context.fillStyle = accent;
  context.fillRect(22, height - 28, width - 44, 2);
}

function drawAtlasFrame(context, atlas, rect, destination, ready) {
  if (!ready) {
    context.fillStyle = '#b08b58';
    context.fillRect(destination[0], destination[1], destination[2], destination[3]);
    return;
  }
  context.drawImage(atlas, ...rect, ...destination);
}

function sequenceSample(timestamp) {
  if (triggerSequenceStartedAt === null) {
    return { clipId: enemyClipId, elapsedMs: timestamp - enemyStartedAt };
  }
  let elapsed = timestamp - triggerSequenceStartedAt;
  for (const step of triggerSequence) {
    if (elapsed < step.durationMs) return { clipId: step.clipId, elapsedMs: elapsed };
    elapsed -= step.durationMs;
  }
  triggerSequenceStartedAt = null;
  enemyClipId = 'dormant';
  enemyStartedAt = timestamp;
  return { clipId: 'dormant', elapsedMs: 0 };
}

function draw(timestamp) {
  drawStage(partyContext, elements.partyCanvas.width, elements.partyCanvas.height, '#d8ac4d');
  drawStage(enemyContext, elements.enemyCanvas.width, elements.enemyCanvas.height, '#c4473a');

  const partySample = samplePartyAnimation(
    partyCharacterId,
    partyClipId,
    timestamp - partyStartedAt,
  );
  drawAtlasFrame(
    partyContext,
    partyAtlas,
    partySample.rect,
    [48, 4, 144, 192],
    partyReady,
  );
  elements.partyStatus.textContent = `${partyCharacterId} · ${partyClipId} · frame ${partySample.localFrame + 1}${partySample.event ? ` · ${partySample.event}` : ''}`;

  const sequence = sequenceSample(timestamp);
  const enemySample = sampleEnemyTriggerAnimation(enemyId, sequence.clipId, sequence.elapsedMs);
  drawAtlasFrame(
    enemyContext,
    enemyAtlas,
    enemySample.rect,
    [48, 22, 144, 144],
    enemyReady,
  );
  elements.enemyStatus.textContent = `${enemyId} · ${sequence.clipId} · frame ${enemySample.localFrame + 1}${enemySample.event ? ` · ${enemySample.event}` : ''}`;

  animationHandle = requestAnimationFrame(draw);
}

fillOptions(elements.partyCharacter, PARTY_ANIMATION_CHARACTERS);
fillOptions(elements.enemyCharacter, ENEMY_TRIGGER_ENTRIES);
fillClipButtons(elements.partyClips, PARTY_ANIMATION_CLIPS, selectPartyClip, partyClipId);
fillClipButtons(elements.enemyClips, ENEMY_TRIGGER_CLIPS, selectEnemyClip, enemyClipId);

elements.partyCharacter.addEventListener('change', () => {
  partyCharacterId = elements.partyCharacter.value;
  selectPartyClip(partyClipId);
});
elements.enemyCharacter.addEventListener('change', () => {
  enemyId = elements.enemyCharacter.value;
  selectEnemyClip(enemyClipId);
});
elements.runTrigger.addEventListener('click', () => {
  triggerSequenceStartedAt = performance.now();
});

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    selectPartyClip(partyClipId);
  } else if (key === 'x' || key === 'escape') {
    event.preventDefault();
    selectEnemyClip('dormant');
  }
});

partyAtlas.addEventListener('load', () => {
  partyReady = (
    partyAtlas.naturalWidth === PARTY_ANIMATION_GEOMETRY.columns * PARTY_ANIMATION_GEOMETRY.frameWidth
    && partyAtlas.naturalHeight === PARTY_ANIMATION_GEOMETRY.rows * PARTY_ANIMATION_GEOMETRY.frameHeight
  );
});
enemyAtlas.addEventListener('load', () => {
  enemyReady = (
    enemyAtlas.naturalWidth === ENEMY_TRIGGER_GEOMETRY.columns * ENEMY_TRIGGER_GEOMETRY.frameWidth
    && enemyAtlas.naturalHeight === ENEMY_TRIGGER_GEOMETRY.rows * ENEMY_TRIGGER_GEOMETRY.frameHeight
  );
});
partyAtlas.src = PARTY_ANIMATION_GEOMETRY.atlasPath;
enemyAtlas.src = ENEMY_TRIGGER_GEOMETRY.atlasPath;

animationHandle = requestAnimationFrame(draw);
window.addEventListener('pagehide', () => cancelAnimationFrame(animationHandle), { once: true });
