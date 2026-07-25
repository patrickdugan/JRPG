/** DOM-free addressing for the 32-row enemy and boss field-animation atlas. */

export const COMBAT_CHARACTER_FIELD_IDS = Object.freeze([
  'cinder-hound',
  'ash-wisp',
  'bell-moth',
  'tithe-enforcer',
  'registry-hound',
  'drowned-retainer',
  'lantern-leech',
  'salt-warden',
  'ashen-spearman',
  'ashen-banner-guard',
  'forge-thrall',
  'bell-scribe',
  'mourning-ronin',
  'court-arquebusier',
  'veil-courier',
  'provincial-banner-guard',
  'storm-nue',
  'dream-baku',
  'twin-tail-nekomata',
  'silk-jorogumo',
  'sickle-weasel',
  'drum-tanuki',
  'marsh-kappa-beast',
  'ushi-oni-behemoth',
  'black-chrysanthemum-nest-woman',
  'razor-bamboo-stalker',
  'spider-lily-ambusher',
  'lantern-vine-maw',
  'kurozane-court-human',
  'kurozane-oni-armor',
  'kurozane-demon-mode',
  'kurozane-ward-broken',
]);

export const COMBAT_CHARACTER_FIELD_DIRECTIONS = Object.freeze(['north', 'east', 'south', 'west']);
export const COMBAT_CHARACTER_FIELD_PHASES = Object.freeze(['idle', 'contact', 'compression', 'passing', 'extension']);
export const COMBAT_CHARACTER_FIELD_WALK_PHASES = Object.freeze(['contact', 'compression', 'passing', 'extension']);
export const COMBAT_CHARACTER_FIELD_WALK_DURATIONS_MS = Object.freeze([90, 75, 90, 105]);
export const COMBAT_CHARACTER_FIELD_WALK_CYCLE_MS = COMBAT_CHARACTER_FIELD_WALK_DURATIONS_MS
  .reduce((total, duration) => total + duration, 0);

export const COMBAT_CHARACTER_FIELD_ATLAS = Object.freeze({
  id: 'combat-character-field-animation-v1',
  url: './assets/art/combat-character-field-animation-v1/combat-character-field-animation-atlas-v1.png',
  frameWidth: 48,
  frameHeight: 48,
  columns: 20,
  rows: 32,
  width: 960,
  height: 1536,
  pivotX: 24,
  pivotY: 46,
  footX: 24,
  footY: 46,
  alphaPolicy: 'binary',
  rootMotionOwnership: 'runtime-simulation',
});

function frameFor(row, column, assetId, direction, phase) {
  return Object.freeze({
    id: `${assetId}:${direction}:${phase}`,
    assetId,
    direction,
    phase,
    index: row * COMBAT_CHARACTER_FIELD_ATLAS.columns + column,
    row,
    column,
    x: column * COMBAT_CHARACTER_FIELD_ATLAS.frameWidth,
    y: row * COMBAT_CHARACTER_FIELD_ATLAS.frameHeight,
    width: COMBAT_CHARACTER_FIELD_ATLAS.frameWidth,
    height: COMBAT_CHARACTER_FIELD_ATLAS.frameHeight,
    pivotX: COMBAT_CHARACTER_FIELD_ATLAS.pivotX,
    pivotY: COMBAT_CHARACTER_FIELD_ATLAS.pivotY,
    footX: COMBAT_CHARACTER_FIELD_ATLAS.footX,
    footY: COMBAT_CHARACTER_FIELD_ATLAS.footY,
  });
}

const FRAMES = Object.freeze(Object.fromEntries(COMBAT_CHARACTER_FIELD_IDS.flatMap((assetId, row) => (
  COMBAT_CHARACTER_FIELD_DIRECTIONS.flatMap((direction, directionIndex) => (
    COMBAT_CHARACTER_FIELD_PHASES.map((phase, phaseIndex) => {
      const column = directionIndex * COMBAT_CHARACTER_FIELD_PHASES.length + phaseIndex;
      const frame = frameFor(row, column, assetId, direction, phase);
      return [frame.id, frame];
    })
  ))
))));

/** Return one exact atlas frame, or null when any address component is unknown. */
export function getCombatCharacterFieldFrame(assetId, direction = 'south', phase = 'idle') {
  return FRAMES[`${assetId}:${direction}:${phase}`] ?? null;
}

/**
 * Sample the authored four-phase walk loop. Root translation remains owned by
 * simulation; elapsed time selects presentation only.
 */
export function getCombatCharacterFieldWalkFrame(assetId, direction = 'south', elapsedMs = 0) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError('Walk elapsed time must be a finite non-negative number.');
  }
  let cursor = elapsedMs % COMBAT_CHARACTER_FIELD_WALK_CYCLE_MS;
  for (let index = 0; index < COMBAT_CHARACTER_FIELD_WALK_PHASES.length; index += 1) {
    const duration = COMBAT_CHARACTER_FIELD_WALK_DURATIONS_MS[index];
    if (cursor < duration) {
      return getCombatCharacterFieldFrame(assetId, direction, COMBAT_CHARACTER_FIELD_WALK_PHASES[index]);
    }
    cursor -= duration;
  }
  return getCombatCharacterFieldFrame(assetId, direction, 'contact');
}

export function combatCharacterFieldImageHasExpectedSize(image) {
  return Boolean(image)
    && Number(image.naturalWidth) === COMBAT_CHARACTER_FIELD_ATLAS.width
    && Number(image.naturalHeight) === COMBAT_CHARACTER_FIELD_ATLAS.height;
}
