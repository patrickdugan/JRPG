/**
 * Runtime addressing for the reviewed V2/V3 side-view enemy animation roster.
 *
 * The atlas is a lossless repack of deterministically pixelified derivatives.
 * Combat simulation continues to own movement, facing, collision, and damage.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const ENEMY_COMBAT_ANIMATION_ATLAS = deepFreeze({
  url: './assets/art/enemy-combat-animation-runtime-v1/enemy-combat-animation-atlas-v1.png',
  width: 3840,
  height: 4480,
  columns: 24,
  rows: 28,
  cellWidth: 160,
  cellHeight: 160,
  facing: 'screen-left',
  rootMotionOwnership: 'runtime-simulation',
});

export const ENEMY_COMBAT_ANIMATION_CLIPS = deepFreeze([
  {
    id: 'locomotion',
    startColumn: 0,
    durationsMs: [120, 100, 90, 100, 90, 120],
    phases: ['contact', 'compression', 'passing', 'extension', 'second-contact', 'ready'],
    loop: true,
    events: {},
  },
  {
    id: 'basic-attack',
    startColumn: 6,
    durationsMs: [180, 150, 100, 80, 130, 240],
    phases: ['ready', 'anticipation', 'commitment', 'active', 'follow-through', 'recovery'],
    loop: false,
    events: { 3: 'damage' },
  },
  {
    id: 'signature-attack',
    startColumn: 12,
    durationsMs: [220, 180, 140, 100, 180, 300],
    phases: ['ready', 'anticipation', 'charge', 'active', 'recoil', 'recovery'],
    loop: false,
    events: { 3: 'enemy-signature' },
  },
  {
    id: 'hurt-defeat',
    startColumn: 18,
    durationsMs: [100, 100, 120, 160, 300, 600],
    phases: ['hurt-contact', 'compression', 'stagger', 'collapse', 'defeated', 'defeated-hold'],
    loop: false,
    events: { 0: 'hurt', 5: 'defeatedHold' },
  },
]);

const PROFILE_GEOMETRY = deepFreeze({
  quadruped: { pivot: [80, 142], footPoint: [80, 151], hurtBounds: [22, 52, 116, 80], scale: 0.94 },
  flyer: { pivot: [80, 100], footPoint: [80, 151], hurtBounds: [35, 30, 90, 100], scale: 0.86 },
  'broad-humanoid': { pivot: [80, 146], footPoint: [80, 151], hurtBounds: [32, 14, 96, 140], scale: 0.98 },
  'lean-humanoid': { pivot: [80, 146], footPoint: [80, 151], hurtBounds: [40, 14, 80, 138], scale: 0.91 },
  crawler: { pivot: [80, 132], footPoint: [80, 151], hurtBounds: [20, 52, 120, 85], scale: 0.9 },
  human: { pivot: [80, 146], footPoint: [80, 151], hurtBounds: [40, 14, 80, 138], scale: 0.91 },
  'armored-human': { pivot: [80, 146], footPoint: [80, 151], hurtBounds: [34, 14, 92, 138], scale: 0.97 },
  'broad-beast': { pivot: [80, 141], footPoint: [80, 151], hurtBounds: [18, 42, 124, 98], scale: 1.04 },
  arachnid: { pivot: [80, 138], footPoint: [80, 151], hurtBounds: [18, 55, 124, 84], scale: 1 },
  'serpent-plant': { pivot: [80, 145], footPoint: [80, 151], hurtBounds: [30, 12, 100, 140], scale: 1.04 },
  'rooted-plant': { pivot: [80, 146], footPoint: [80, 151], hurtBounds: [24, 28, 112, 120], scale: 1 },
});

const ENTRY_ROWS = [
  ['cinder-hound', 'Cinder Hound', 'quadruped', 'cinder-overload'],
  ['ash-wisp', 'Ash Wisp', 'flyer', 'ash-nova'],
  ['bell-moth', 'Bell Moth', 'flyer', 'bell-resonance'],
  ['tithe-enforcer', 'Tithe Enforcer', 'broad-humanoid', 'tithe-seal'],
  ['registry-hound', 'Registry Hound', 'lean-humanoid', 'registry-mark'],
  ['drowned-retainer', 'Drowned Retainer', 'lean-humanoid', 'undertow-bind'],
  ['lantern-leech', 'Lantern Leech', 'crawler', 'lantern-drain'],
  ['salt-warden', 'Salt Warden', 'broad-humanoid', 'salt-rampart'],
  ['ashen-spearman', 'Ashen Spearman', 'lean-humanoid', 'ash-lane-charge'],
  ['ashen-banner-guard', 'Ashen Banner Guard', 'broad-humanoid', 'banner-wall'],
  ['forge-thrall', 'Forge Thrall', 'broad-humanoid', 'ember-vent'],
  ['bell-scribe', 'Bell Scribe', 'lean-humanoid', 'docket-mark'],
  ['mourning-ronin', 'Mourning Ronin', 'human', 'last-vow-draw'],
  ['court-arquebusier', 'Court Arquebusier', 'armored-human', 'ash-match-volley'],
  ['veil-courier', 'Veil Courier', 'human', 'smoke-relay'],
  ['provincial-banner-guard', 'Provincial Banner Guard', 'armored-human', 'banner-wall'],
  ['storm-nue', 'Storm Nue', 'quadruped', 'storm-tail'],
  ['dream-baku', 'Dream Baku', 'broad-beast', 'dream-vacuum'],
  ['twin-tail-nekomata', 'Twin-Tail Nekomata', 'quadruped', 'twin-flame-lash'],
  ['silk-jorogumo', 'Silk Jorogumo', 'arachnid', 'silk-prison'],
  ['sickle-weasel', 'Sickle Weasel', 'quadruped', 'crosswind-dash'],
  ['drum-tanuki', 'Drum Tanuki', 'broad-beast', 'belly-drum-quake'],
  ['marsh-kappa-beast', 'Marsh Kappa-Beast', 'broad-beast', 'shell-surge'],
  ['ushi-oni-behemoth', 'Ushi-Oni Behemoth', 'broad-beast', 'earth-gore-charge'],
  ['black-chrysanthemum-nest-woman', 'Black Chrysanthemum Nest-Woman', 'serpent-plant', 'black-bloom-devour'],
  ['razor-bamboo-stalker', 'Razor Bamboo Stalker', 'rooted-plant', 'razor-canopy'],
  ['spider-lily-ambusher', 'Spider-Lily Ambusher', 'rooted-plant', 'crimson-pollen-ambush'],
  ['lantern-vine-maw', 'Lantern-Vine Maw', 'rooted-plant', 'false-lantern-lure'],
];

export const ENEMY_COMBAT_ANIMATION_ENTRIES = deepFreeze(ENTRY_ROWS.map(
  ([id, name, profile, signatureId], row) => ({
    id,
    name,
    profile,
    signatureId,
    row,
    ...PROFILE_GEOMETRY[profile],
  }),
));

/**
 * Canonical combat templates reuse the nearest reviewed silhouette only when
 * they do not have a bespoke boss atlas. Exact IDs always win over aliases.
 */
export const ENEMY_COMBAT_ANIMATION_ALIASES = deepFreeze({
  'ashen-bailiff': 'tithe-enforcer',
  'ashen-garrison': 'provincial-banner-guard',
  'archive-warden': 'bell-scribe',
  'blood-ward-east': 'ashen-banner-guard',
  'blood-ward-west': 'ashen-spearman',
  'bound-ashen-oni': 'forge-thrall',
  'bound-ashen-patrol': 'ashen-spearman',
  'court-clone': 'mourning-ronin',
  'dock-retainer': 'drowned-retainer',
  'fog-skimmer': 'lantern-leech',
  'masked-clerk': 'bell-scribe',
  'tithe-seal': 'salt-warden',
  'unfiled-testimony': 'ash-wisp',
});

const ENTRY_BY_ID = new Map(ENEMY_COMBAT_ANIMATION_ENTRIES.map((entry) => [entry.id, entry]));
const CLIP_BY_ID = new Map(ENEMY_COMBAT_ANIMATION_CLIPS.map((clip) => [clip.id, clip]));

export function getEnemyCombatAnimationEntry(templateId) {
  const resolvedId = ENTRY_BY_ID.has(templateId)
    ? templateId
    : ENEMY_COMBAT_ANIMATION_ALIASES[templateId];
  return resolvedId ? ENTRY_BY_ID.get(resolvedId) ?? null : null;
}

export function hasEnemyCombatAnimation(templateId) {
  return getEnemyCombatAnimationEntry(templateId) !== null;
}

function checkedClip(clipId) {
  const clip = CLIP_BY_ID.get(clipId);
  if (!clip) throw new RangeError(`Unknown enemy combat animation clip: ${clipId}`);
  return clip;
}

function checkedFrameIndex(localFrame) {
  if (!Number.isInteger(localFrame) || localFrame < 0 || localFrame >= 6) {
    throw new RangeError(`Enemy combat local frame must be an integer from 0 through 5: ${localFrame}`);
  }
  return localFrame;
}

export function getEnemyCombatAnimationFrame(templateId, clipId, localFrame = 0) {
  const entry = getEnemyCombatAnimationEntry(templateId);
  if (!entry) throw new RangeError(`Unknown enemy combat animation template: ${templateId}`);
  const clip = checkedClip(clipId);
  const resolvedFrame = checkedFrameIndex(localFrame);
  const column = clip.startColumn + resolvedFrame;
  return deepFreeze({
    templateId,
    assetId: entry.id,
    clipId,
    localFrame: resolvedFrame,
    phase: clip.phases[resolvedFrame],
    event: resolvedFrame === 3 && clipId === 'signature-attack'
      ? entry.signatureId
      : clip.events[resolvedFrame] ?? null,
    row: entry.row,
    column,
    x: column * ENEMY_COMBAT_ANIMATION_ATLAS.cellWidth,
    y: entry.row * ENEMY_COMBAT_ANIMATION_ATLAS.cellHeight,
    width: ENEMY_COMBAT_ANIMATION_ATLAS.cellWidth,
    height: ENEMY_COMBAT_ANIMATION_ATLAS.cellHeight,
    pivotX: entry.pivot[0],
    pivotY: entry.pivot[1],
    footPoint: [...entry.footPoint],
    hurtBounds: [...entry.hurtBounds],
    presentationScale: entry.scale,
  });
}

export function sampleEnemyCombatAnimation(templateId, clipId, elapsedMs = 0) {
  const clip = checkedClip(clipId);
  const safeElapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const totalDurationMs = clip.durationsMs.reduce((sum, duration) => sum + duration, 0);
  let localTime = clip.loop && totalDurationMs
    ? safeElapsed % totalDurationMs
    : Math.min(safeElapsed, Math.max(0, totalDurationMs - 1));
  let localFrame = clip.durationsMs.length - 1;
  for (let index = 0; index < clip.durationsMs.length; index += 1) {
    if (localTime < clip.durationsMs[index]) {
      localFrame = index;
      break;
    }
    localTime -= clip.durationsMs[index];
  }
  return deepFreeze({
    ...getEnemyCombatAnimationFrame(templateId, clipId, localFrame),
    frameElapsedMs: localTime,
    frameDurationMs: clip.durationsMs[localFrame],
    totalDurationMs,
    complete: !clip.loop && safeElapsed >= totalDurationMs,
  });
}

function segmentForPhase(clipId, phase) {
  if (clipId === 'hurt-defeat') return phase === 'defeat' ? [3, 5] : [0, 2];
  if (phase === 'windup') return [0, 2];
  if (phase === 'active') return [3, 3];
  if (phase === 'recovery') return [4, 5];
  return [0, 5];
}

export function sampleEnemyCombatAnimationPhase(
  templateId,
  clipId,
  phase,
  phaseProgress = 0,
) {
  const clip = checkedClip(clipId);
  const [start, end] = segmentForPhase(clipId, phase);
  const progress = Math.max(0, Math.min(1, Number.isFinite(phaseProgress) ? phaseProgress : 0));
  const segmentDurations = clip.durationsMs.slice(start, end + 1);
  const segmentTotal = segmentDurations.reduce((sum, duration) => sum + duration, 0);
  let cursor = Math.min(Math.max(0, segmentTotal - 1), Math.floor(segmentTotal * progress));
  let localFrame = end;
  for (let index = start; index <= end; index += 1) {
    if (cursor < clip.durationsMs[index]) {
      localFrame = index;
      break;
    }
    cursor -= clip.durationsMs[index];
  }
  return deepFreeze({
    ...getEnemyCombatAnimationFrame(templateId, clipId, localFrame),
    phaseProgress: progress,
  });
}

export function enemyCombatAnimationImageHasExpectedSize(image) {
  return Boolean(image)
    && image.naturalWidth === ENEMY_COMBAT_ANIMATION_ATLAS.width
    && image.naturalHeight === ENEMY_COMBAT_ANIMATION_ATLAS.height;
}
