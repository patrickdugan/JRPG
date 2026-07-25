/** Runtime metadata and pure sampling for the complete party/encounter animation atlases. */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const PARTY_ANIMATION_GEOMETRY = deepFreeze({
  frameWidth: 48,
  frameHeight: 64,
  columns: 40,
  rows: 7,
  pivot: [24, 58],
  footPoint: [24, 58],
  atlasPath: './assets/art/roster-animation-runtime-v1/party-combat-animation-atlas-v1.png',
});

export const PARTY_ANIMATION_CHARACTERS = deepFreeze([
  { id: 'ren', name: 'Ren Ishikawa', row: 0 },
  { id: 'aya', name: 'Aya Shinohara', row: 1 },
  { id: 'lise', name: 'Nikola Dražanić', row: 2 },
  { id: 'mateus', name: 'Father Mateus Avelar', row: 3 },
  { id: 'genta', name: 'Genta Mononobe', row: 4 },
  { id: 'kiku', name: 'Kiku Nawa', row: 5 },
  { id: 'miyo', name: 'Miyo Senda', row: 6 },
]);

export const PARTY_ANIMATION_CLIPS = deepFreeze([
  { id: 'idle', start: 0, frames: 4, durationsMs: [180, 180, 180, 180], loop: true, event: null },
  { id: 'move', start: 4, frames: 6, durationsMs: [80, 75, 80, 75, 80, 90], loop: true, event: null },
  { id: 'guard', start: 10, frames: 4, durationsMs: [90, 120, 160, 120], loop: false, event: { name: 'guard', frame: 1 } },
  { id: 'hurt', start: 14, frames: 4, durationsMs: [60, 100, 120, 160], loop: false, event: null },
  { id: 'basic-strike', start: 18, frames: 6, durationsMs: [100, 110, 70, 80, 110, 150], loop: false, event: { name: 'damage', frame: 3 } },
  { id: 'signature-a', start: 24, frames: 6, durationsMs: [100, 140, 120, 100, 130, 180], loop: false, event: { name: 'skill-a', frame: 3 } },
  { id: 'signature-b', start: 30, frames: 6, durationsMs: [100, 150, 130, 110, 140, 190], loop: false, event: { name: 'skill-b', frame: 3 } },
  { id: 'defeat', start: 36, frames: 4, durationsMs: [80, 120, 180, 500], loop: false, event: null },
]);

export const ENEMY_TRIGGER_GEOMETRY = deepFreeze({
  frameWidth: 48,
  frameHeight: 48,
  columns: 12,
  rows: 32,
  pivot: [24, 46],
  footPoint: [24, 46],
  atlasPath: './assets/art/roster-animation-runtime-v1/enemy-encounter-trigger-atlas-v1.png',
});

export const ENEMY_TRIGGER_ENTRIES = deepFreeze([
  ['cinder-hound', 'Cinder Hound', 'rush'],
  ['ash-wisp', 'Ash Wisp', 'hover'],
  ['bell-moth', 'Bell Moth', 'hover'],
  ['tithe-enforcer', 'Tithe Enforcer', 'humanoid'],
  ['registry-hound', 'Registry Hound', 'rush'],
  ['drowned-retainer', 'Drowned Retainer', 'humanoid'],
  ['lantern-leech', 'Lantern Leech', 'hover'],
  ['salt-warden', 'Salt Warden', 'humanoid'],
  ['ashen-spearman', 'Ashen Spearman', 'humanoid'],
  ['ashen-banner-guard', 'Ashen Banner Guard', 'humanoid'],
  ['forge-thrall', 'Forge Thrall', 'beast'],
  ['bell-scribe', 'Bell Scribe', 'humanoid'],
  ['mourning-ronin', 'Mourning Ronin', 'humanoid'],
  ['court-arquebusier', 'Court Arquebusier', 'humanoid'],
  ['veil-courier', 'Veil Courier', 'humanoid'],
  ['provincial-banner-guard', 'Provincial Banner Guard', 'humanoid'],
  ['storm-nue', 'Storm Nue', 'hover'],
  ['dream-baku', 'Dream Baku', 'beast'],
  ['twin-tail-nekomata', 'Twin-Tail Nekomata', 'beast'],
  ['silk-jorogumo', 'Silk Jorogumo', 'beast'],
  ['sickle-weasel', 'Sickle Weasel', 'rush'],
  ['drum-tanuki', 'Drum Tanuki', 'beast'],
  ['marsh-kappa-beast', 'Marsh Kappa-Beast', 'beast'],
  ['ushi-oni-behemoth', 'Ushi-Oni Behemoth', 'beast'],
  ['black-chrysanthemum-nest-woman', 'Black Chrysanthemum Nest-Woman', 'ambush'],
  ['razor-bamboo-stalker', 'Razor Bamboo Stalker', 'ambush'],
  ['spider-lily-ambusher', 'Spider-Lily Ambusher', 'ambush'],
  ['lantern-vine-maw', 'Lantern-Vine Maw', 'ambush'],
  ['kurozane-court-human', 'Kurozane — Court Human', 'humanoid'],
  ['kurozane-oni-armor', 'Kurozane — Oni Armor', 'humanoid'],
  ['kurozane-demon-mode', 'Kurozane — Demon Mode', 'beast'],
  ['kurozane-ward-broken', 'Kurozane — Ward Broken', 'humanoid'],
].map(([id, name, profile], row) => ({ id, name, profile, row })));

export const ENEMY_TRIGGER_CLIPS = deepFreeze([
  { id: 'dormant', frames: [0, 1], durationsMs: [280, 320], loop: true, event: null },
  { id: 'sense', frames: [2, 3, 4], durationsMs: [110, 160, 120], loop: false, event: null },
  { id: 'alert', frames: [5, 6], durationsMs: [170, 230], loop: false, event: { name: 'encounter-alert', frame: 1 } },
  { id: 'pursue', frames: [7, 8], durationsMs: [90, 105], loop: true, event: null },
  { id: 'engage', frames: [9, 10, 11], durationsMs: [120, 80, 180], loop: false, event: { name: 'encounter-contact', frame: 1 } },
  { id: 'cooldown', frames: [11, 2, 0], durationsMs: [180, 160, 260], loop: false, event: null },
]);

const PARTY_BY_ID = new Map(PARTY_ANIMATION_CHARACTERS.map((entry) => [entry.id, entry]));
const PARTY_CLIP_BY_ID = new Map(PARTY_ANIMATION_CLIPS.map((entry) => [entry.id, entry]));
const ENEMY_BY_ID = new Map(ENEMY_TRIGGER_ENTRIES.map((entry) => [entry.id, entry]));
const ENEMY_CLIP_BY_ID = new Map(ENEMY_TRIGGER_CLIPS.map((entry) => [entry.id, entry]));

function sampleTimedClip(clip, elapsedMs) {
  const safeElapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const totalDurationMs = clip.durationsMs.reduce((sum, duration) => sum + duration, 0);
  const cycle = clip.loop && totalDurationMs ? Math.floor(safeElapsed / totalDurationMs) : 0;
  let localTime = clip.loop && totalDurationMs
    ? safeElapsed % totalDurationMs
    : Math.min(safeElapsed, Math.max(0, totalDurationMs - 1));
  const frameCount = Number.isInteger(clip.frames) ? clip.frames : clip.frames.length;
  let localFrame = frameCount - 1;
  for (let index = 0; index < frameCount; index += 1) {
    if (localTime < clip.durationsMs[index]) {
      localFrame = index;
      break;
    }
    localTime -= clip.durationsMs[index];
  }
  const atlasFrame = Number.isInteger(clip.frames)
    ? clip.start + localFrame
    : clip.frames[localFrame];
  const event = clip.event?.frame === localFrame ? clip.event.name : null;
  return {
    localFrame,
    atlasFrame,
    frameElapsedMs: localTime,
    frameDurationMs: clip.durationsMs[localFrame],
    totalDurationMs,
    cycle,
    complete: !clip.loop && safeElapsed >= totalDurationMs,
    event,
    eventToken: event ? `${clip.id}:${cycle}:${localFrame}` : null,
  };
}

export function samplePartyAnimation(characterId, clipId, elapsedMs = 0) {
  const character = PARTY_BY_ID.get(characterId);
  const clip = PARTY_CLIP_BY_ID.get(clipId);
  if (!character) throw new RangeError(`Unknown party animation character: ${characterId}`);
  if (!clip) throw new RangeError(`Unknown party animation clip: ${clipId}`);
  const sample = sampleTimedClip(clip, elapsedMs);
  return deepFreeze({
    characterId,
    clipId,
    ...sample,
    rect: [
      sample.atlasFrame * PARTY_ANIMATION_GEOMETRY.frameWidth,
      character.row * PARTY_ANIMATION_GEOMETRY.frameHeight,
      PARTY_ANIMATION_GEOMETRY.frameWidth,
      PARTY_ANIMATION_GEOMETRY.frameHeight,
    ],
    pivot: [...PARTY_ANIMATION_GEOMETRY.pivot],
  });
}

export function sampleEnemyTriggerAnimation(enemyId, clipId, elapsedMs = 0) {
  const enemy = ENEMY_BY_ID.get(enemyId);
  const clip = ENEMY_CLIP_BY_ID.get(clipId);
  if (!enemy) throw new RangeError(`Unknown enemy trigger entry: ${enemyId}`);
  if (!clip) throw new RangeError(`Unknown enemy trigger clip: ${clipId}`);
  const sample = sampleTimedClip(clip, elapsedMs);
  return deepFreeze({
    enemyId,
    clipId,
    profile: enemy.profile,
    ...sample,
    rect: [
      sample.atlasFrame * ENEMY_TRIGGER_GEOMETRY.frameWidth,
      enemy.row * ENEMY_TRIGGER_GEOMETRY.frameHeight,
      ENEMY_TRIGGER_GEOMETRY.frameWidth,
      ENEMY_TRIGGER_GEOMETRY.frameHeight,
    ],
    pivot: [...ENEMY_TRIGGER_GEOMETRY.pivot],
  });
}

const TRIGGER_TRANSITIONS = deepFreeze({
  dormant: { 'player-enter-sense': 'sense' },
  sense: { 'sense-confirmed': 'alert', 'player-left': 'cooldown' },
  alert: { 'animation-complete': 'pursue', 'player-left': 'cooldown' },
  pursue: { 'player-contact': 'engage', 'player-left': 'cooldown' },
  engage: {},
  cooldown: { 'animation-complete': 'dormant', 'player-enter-sense': 'sense' },
});

export function createEnemyEncounterTriggerState(enemyId) {
  if (!ENEMY_BY_ID.has(enemyId)) throw new RangeError(`Unknown enemy trigger entry: ${enemyId}`);
  return deepFreeze({
    enemyId,
    clipId: 'dormant',
    revision: 0,
    encounterContactReceipt: null,
  });
}

export function transitionEnemyEncounterTrigger(state, signal) {
  const nextClipId = TRIGGER_TRANSITIONS[state.clipId]?.[signal] ?? null;
  if (!nextClipId) return state;
  const revision = state.revision + 1;
  const encounterContactReceipt = nextClipId === 'engage'
    ? deepFreeze({
      schemaVersion: 1,
      kind: 'field-encounter-contact',
      enemyId: state.enemyId,
      triggerRevision: revision,
      canonicalMutation: false,
    })
    : null;
  return deepFreeze({
    enemyId: state.enemyId,
    clipId: nextClipId,
    revision,
    encounterContactReceipt,
  });
}
