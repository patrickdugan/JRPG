/**
 * Addressing contract for the authored 8 x 7 enemy combat key-pose atlas.
 *
 * Rows are reusable silhouette families rather than one-off encounter IDs.
 * Columns are neutral, wind-up, attack, stagger, defeat, recovery, and hurt poses. Combat rules never
 * depend on this mapping; an unknown enemy safely falls back to Ashen Oni.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const ENEMY_SOURCE_INSET = 0;
const ENEMY_CELL_WIDTH = 64;
const ENEMY_CELL_HEIGHT = 80;
const ENEMY_SOURCE_WIDTH = ENEMY_CELL_WIDTH - ENEMY_SOURCE_INSET * 2;
const ENEMY_SOURCE_HEIGHT = ENEMY_CELL_HEIGHT - ENEMY_SOURCE_INSET * 2;

const ENEMY_ROW_CELLS = deepFreeze([
  { y: 0, height: ENEMY_CELL_HEIGHT },
  { y: 80, height: ENEMY_CELL_HEIGHT },
  { y: 160, height: ENEMY_CELL_HEIGHT },
  { y: 240, height: ENEMY_CELL_HEIGHT },
  { y: 320, height: ENEMY_CELL_HEIGHT },
  { y: 400, height: ENEMY_CELL_HEIGHT },
  { y: 480, height: ENEMY_CELL_HEIGHT },
  { y: 560, height: ENEMY_CELL_HEIGHT },
]);

export const ENEMY_ATLAS = deepFreeze({
  url: './assets/art/enemy-combat-suite/enemy-combat-atlas.png',
  width: 448,
  height: 640,
  columns: 7,
  rows: 8,
  cellWidth: ENEMY_CELL_WIDTH,
  cellHeight: ENEMY_CELL_HEIGHT,
  sourceInset: ENEMY_SOURCE_INSET,
  sourceWidth: ENEMY_SOURCE_WIDTH,
  sourceHeight: ENEMY_SOURCE_HEIGHT,
  rowCells: ENEMY_ROW_CELLS,
  poses: ['neutral', 'windup', 'attack', 'stagger', 'defeat', 'recovery', 'hurt'],
});

export const ENEMY_DEFEAT_HOLD_MS = 420;

export const ENEMY_FAMILIES = deepFreeze([
  { id: 'hound', row: 0, templateIds: ['cinder-hound', 'tithe-hound'] },
  { id: 'wisp', row: 1, templateIds: ['ash-wisp', 'bell-moth', 'fog-skimmer', 'unfiled-testimony'] },
  {
    id: 'ashen-oni',
    row: 2,
    templateIds: [
      'ashen-bailiff', 'tithe-seal', 'tithe-enforcer', 'blood-ward-west',
      'blood-ward-east', 'bound-ashen-oni', 'bound-ashen-patrol',
      'ashen-garrison', 'archive-warden',
    ],
  },
  { id: 'court-retainer', row: 3, templateIds: ['mateus', 'dock-retainer', 'captain-kaji', 'masked-clerk', 'ujiro'] },
  { id: 'widow', row: 4, templateIds: ['widow-of-fog'] },
  { id: 'furnace', row: 5, templateIds: ['furnace-abbot', 'lady-enma'] },
  { id: 'bell-warden', row: 6, templateIds: ['bell-warden-chiyo', 'yearless-bell'] },
  { id: 'black-court', row: 7, templateIds: ['kurozane', 'court-clone'] },
]);

const FAMILY_BY_TEMPLATE = new Map(ENEMY_FAMILIES.flatMap((family) => (
  family.templateIds.map((templateId) => [templateId, family])
)));

export function getEnemyFamily(templateId) {
  return FAMILY_BY_TEMPLATE.get(templateId) ?? ENEMY_FAMILIES[2];
}

export function getEnemyAtlasFrame(templateId, pose = 'neutral') {
  const family = getEnemyFamily(templateId);
  const column = ENEMY_ATLAS.poses.indexOf(pose);
  const resolvedColumn = column >= 0 ? column : 0;
  const cellX = resolvedColumn * ENEMY_ATLAS.cellWidth;
  const cell = ENEMY_ATLAS.rowCells[family.row];
  return Object.freeze({
    familyId: family.id,
    pose: ENEMY_ATLAS.poses[resolvedColumn],
    row: family.row,
    column: resolvedColumn,
    cellX,
    cellY: cell.y,
    cellWidth: ENEMY_ATLAS.cellWidth,
    cellHeight: cell.height,
    sourceInset: ENEMY_ATLAS.sourceInset,
    x: cellX + ENEMY_ATLAS.sourceInset,
    y: cell.y + ENEMY_ATLAS.sourceInset,
    width: ENEMY_ATLAS.sourceWidth,
    height: ENEMY_ATLAS.sourceHeight,
  });
}

export function hasAuthoredEnemyFamily(templateId) {
  return FAMILY_BY_TEMPLATE.has(templateId);
}

export function getEnemyCombatPresentationPose({
  hp = 1,
  active = true,
  phase = null,
  animationPose = null,
  transientPose = null,
  windingUp = false,
} = {}) {
  if (!active || hp <= 0) return 'defeat';
  if (phase === 'recovery') return 'recovery';
  if (animationPose === 'stagger') return 'hurt';
  if (ENEMY_ATLAS.poses.includes(animationPose)) return animationPose;
  if (transientPose === 'stagger') return 'hurt';
  if (ENEMY_ATLAS.poses.includes(transientPose)) return transientPose;
  return windingUp ? 'windup' : 'neutral';
}

/** Capture authored enemy-family actors that newly reached a terminal state. */
export function getNewlyTerminalEnemyCombatActors(beforeActors = [], afterActors = []) {
  const beforeById = new Map(beforeActors.map((actor) => [actor?.instanceId, actor]));
  return Object.freeze(afterActors.filter((actor) => {
    if (!actor?.instanceId || actor.faction !== 'enemy' || !hasAuthoredEnemyFamily(actor.templateId)) return false;
    const before = beforeById.get(actor.instanceId);
    const wasPresent = before?.hp > 0 && before.active !== false;
    const isTerminal = actor.hp <= 0 || actor.active === false;
    return wasPresent && isTerminal;
  }));
}

/** Replace a pre-action ghost with its post-resolution enemy during the hold. */
export function mergeEnemyTerminalPresentationActors(
  presentationActors = [],
  terminalEnemyActors = [],
  terminalWindow = false,
) {
  if (!terminalWindow || !terminalEnemyActors.length) return presentationActors;
  const terminalById = new Map(terminalEnemyActors.map((actor) => [actor.instanceId, actor]));
  const merged = presentationActors.map((actor) => terminalById.get(actor.instanceId) ?? actor);
  const mergedIds = new Set(merged.map((actor) => actor.instanceId));
  for (const actor of terminalEnemyActors) {
    if (!mergedIds.has(actor.instanceId)) merged.push(actor);
  }
  return Object.freeze(merged);
}

export function enemyAtlasImageHasExpectedSize(image) {
  return Boolean(image)
    && image.naturalWidth === ENEMY_ATLAS.width
    && image.naturalHeight === ENEMY_ATLAS.height;
}
