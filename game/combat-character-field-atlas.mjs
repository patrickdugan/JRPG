/** DOM-free addressing for the PlayStation-density 32-row enemy field atlas. */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const COMBAT_CHARACTER_FIELD_ENTRIES = deepFreeze([
  ['cinder-hound', 'rush'],
  ['ash-wisp', 'hover'],
  ['bell-moth', 'hover'],
  ['tithe-enforcer', 'humanoid'],
  ['registry-hound', 'rush'],
  ['drowned-retainer', 'humanoid'],
  ['lantern-leech', 'hover'],
  ['salt-warden', 'humanoid'],
  ['ashen-spearman', 'humanoid'],
  ['ashen-banner-guard', 'humanoid'],
  ['forge-thrall', 'heavy'],
  ['bell-scribe', 'humanoid'],
  ['mourning-ronin', 'humanoid'],
  ['court-arquebusier', 'humanoid'],
  ['veil-courier', 'humanoid'],
  ['provincial-banner-guard', 'humanoid'],
  ['storm-nue', 'hover'],
  ['dream-baku', 'beast'],
  ['twin-tail-nekomata', 'beast'],
  ['silk-jorogumo', 'beast'],
  ['sickle-weasel', 'rush'],
  ['drum-tanuki', 'beast'],
  ['marsh-kappa-beast', 'beast'],
  ['ushi-oni-behemoth', 'heavy'],
  ['black-chrysanthemum-nest-woman', 'ambush'],
  ['razor-bamboo-stalker', 'ambush'],
  ['spider-lily-ambusher', 'ambush'],
  ['lantern-vine-maw', 'ambush'],
  ['kurozane-court-human', 'humanoid'],
  ['kurozane-oni-armor', 'heavy'],
  ['kurozane-demon-mode', 'heavy'],
  ['kurozane-ward-broken', 'humanoid'],
].map(([id, profile], row) => ({ id, profile, row })));

export const COMBAT_CHARACTER_FIELD_IDS = deepFreeze(
  COMBAT_CHARACTER_FIELD_ENTRIES.map(({ id }) => id),
);
export const COMBAT_CHARACTER_FIELD_DIRECTIONS = deepFreeze(['north', 'east', 'south', 'west']);
export const COMBAT_CHARACTER_FIELD_WALK_PHASES = deepFreeze([
  'contact-a',
  'compression-a',
  'passing-a',
  'extension-a',
  'contact-b',
  'compression-b',
  'passing-b',
  'extension-b',
]);
export const COMBAT_CHARACTER_FIELD_PHASES = deepFreeze([
  'idle',
  ...COMBAT_CHARACTER_FIELD_WALK_PHASES,
]);
export const COMBAT_CHARACTER_FIELD_EVENTS = deepFreeze(['alert', 'hurt']);
export const COMBAT_CHARACTER_FIELD_WALK_DURATIONS_MS = deepFreeze([54, 46, 54, 58, 54, 46, 54, 58]);
export const COMBAT_CHARACTER_FIELD_WALK_CYCLE_MS = COMBAT_CHARACTER_FIELD_WALK_DURATIONS_MS
  .reduce((total, duration) => total + duration, 0);

export const COMBAT_CHARACTER_FIELD_ATLAS = deepFreeze({
  id: 'enemy-field-suite-v3',
  url: './assets/art/enemy-field-suite-v3/enemy-field-atlas-v3.png',
  frameWidth: 80,
  frameHeight: 80,
  columns: 38,
  rows: 32,
  width: 3040,
  height: 2560,
  pivotX: 40,
  pivotY: 77,
  footX: 40,
  footY: 77,
  alphaPolicy: 'binary',
  rootMotionOwnership: 'runtime-simulation',
});

const PROFILE_DISPLAY_SCALE = deepFreeze({
  humanoid: 1,
  rush: 0.98,
  hover: 0.98,
  beast: 1.08,
  heavy: 1.16,
  ambush: 1.08,
});

/**
 * Canonical encounter templates may reuse one of the richer inventory
 * silhouettes. Direct inventory IDs always win over this presentation map.
 */
export const COMBAT_CHARACTER_FIELD_TEMPLATE_ALIASES = deepFreeze({
  'archive-warden': 'salt-warden',
  'ashen-bailiff': 'ashen-spearman',
  'ashen-garrison': 'ashen-banner-guard',
  'bell-warden-chiyo': 'provincial-banner-guard',
  'blood-ward-east': 'lantern-leech',
  'blood-ward-west': 'lantern-leech',
  'bound-ashen-oni': 'forge-thrall',
  'bound-ashen-patrol': 'ashen-spearman',
  'captain-kaji': 'salt-warden',
  'court-clone': 'kurozane-ward-broken',
  'dock-retainer': 'drowned-retainer',
  'fog-skimmer': 'bell-moth',
  'furnace-abbot': 'forge-thrall',
  kurozane: 'kurozane-oni-armor',
  'lady-enma': 'black-chrysanthemum-nest-woman',
  'masked-clerk': 'bell-scribe',
  mateus: 'mourning-ronin',
  'tithe-hound': 'registry-hound',
  'tithe-seal': 'ash-wisp',
  ujiro: 'kurozane-court-human',
  'unfiled-testimony': 'ash-wisp',
  'widow-of-fog': 'black-chrysanthemum-nest-woman',
  'yearless-bell': 'ash-wisp',
});

const ENTRY_BY_ID = new Map(COMBAT_CHARACTER_FIELD_ENTRIES.map((entry) => [entry.id, entry]));
const DIRECTION_COLUMN = deepFreeze({ north: 0, east: 9, south: 18, west: 27 });
const EVENT_COLUMN = deepFreeze({ alert: 36, hurt: 37 });

/** Resolve a canonical encounter template to one authored field identity. */
export function getCombatCharacterFieldPresentationId(templateId) {
  if (ENTRY_BY_ID.has(templateId)) return templateId;
  return COMBAT_CHARACTER_FIELD_TEMPLATE_ALIASES[templateId] ?? 'tithe-enforcer';
}

export function getCombatCharacterFieldProfile(assetOrTemplateId) {
  const assetId = getCombatCharacterFieldPresentationId(assetOrTemplateId);
  return ENTRY_BY_ID.get(assetId)?.profile ?? 'humanoid';
}

function frameFor(entry, column, direction, phase) {
  return deepFreeze({
    id: `${entry.id}:${direction}-${phase}`,
    assetId: entry.id,
    profile: entry.profile,
    displayScale: PROFILE_DISPLAY_SCALE[entry.profile],
    direction,
    phase,
    index: entry.row * COMBAT_CHARACTER_FIELD_ATLAS.columns + column,
    row: entry.row,
    column,
    x: column * COMBAT_CHARACTER_FIELD_ATLAS.frameWidth,
    y: entry.row * COMBAT_CHARACTER_FIELD_ATLAS.frameHeight,
    width: COMBAT_CHARACTER_FIELD_ATLAS.frameWidth,
    height: COMBAT_CHARACTER_FIELD_ATLAS.frameHeight,
    pivotX: COMBAT_CHARACTER_FIELD_ATLAS.pivotX,
    pivotY: COMBAT_CHARACTER_FIELD_ATLAS.pivotY,
    footX: COMBAT_CHARACTER_FIELD_ATLAS.footX,
    footY: COMBAT_CHARACTER_FIELD_ATLAS.footY,
  });
}

/** Return one exact directional idle/walk frame, or null for an invalid address. */
export function getCombatCharacterFieldFrame(assetId, direction = 'south', phase = 'idle') {
  const entry = ENTRY_BY_ID.get(assetId);
  const directionBase = DIRECTION_COLUMN[direction];
  const phaseIndex = COMBAT_CHARACTER_FIELD_PHASES.indexOf(phase);
  if (!entry || directionBase == null || phaseIndex < 0) return null;
  return frameFor(entry, directionBase + phaseIndex, direction, phase);
}

/** Resolve a canonical encounter template and return one exact presentation frame. */
export function getCombatCharacterFieldTemplateFrame(templateId, direction = 'south', phase = 'idle') {
  return getCombatCharacterFieldFrame(
    getCombatCharacterFieldPresentationId(templateId),
    direction,
    phase,
  );
}

/** Return one appended south-facing alert or hurt event frame. */
export function getCombatCharacterFieldEventFrame(assetOrTemplateId, event) {
  const entry = ENTRY_BY_ID.get(getCombatCharacterFieldPresentationId(assetOrTemplateId));
  const column = EVENT_COLUMN[event];
  if (!entry || column == null) return null;
  return frameFor(entry, column, 'south', event);
}

/**
 * Sample the eight-phase authored walk loop. Root translation remains owned by
 * simulation; elapsed time selects presentation only.
 */
export function getCombatCharacterFieldWalkFrame(assetOrTemplateId, direction = 'south', elapsedMs = 0) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError('Walk elapsed time must be a finite non-negative number.');
  }
  const assetId = getCombatCharacterFieldPresentationId(assetOrTemplateId);
  let cursor = elapsedMs % COMBAT_CHARACTER_FIELD_WALK_CYCLE_MS;
  for (let index = 0; index < COMBAT_CHARACTER_FIELD_WALK_PHASES.length; index += 1) {
    const duration = COMBAT_CHARACTER_FIELD_WALK_DURATIONS_MS[index];
    if (cursor < duration) {
      return getCombatCharacterFieldFrame(
        assetId,
        direction,
        COMBAT_CHARACTER_FIELD_WALK_PHASES[index],
      );
    }
    cursor -= duration;
  }
  return getCombatCharacterFieldFrame(assetId, direction, COMBAT_CHARACTER_FIELD_WALK_PHASES[0]);
}

export function combatCharacterFieldImageHasExpectedSize(image) {
  return Boolean(image)
    && Number(image.naturalWidth) === COMBAT_CHARACTER_FIELD_ATLAS.width
    && Number(image.naturalHeight) === COMBAT_CHARACTER_FIELD_ATLAS.height;
}
