/**
 * Addressing contract for the provisional 8 x 4 enemy combat atlas.
 *
 * Rows are reusable silhouette families rather than one-off encounter IDs.
 * Columns are neutral, wind-up, attack, and stagger poses. Combat rules never
 * depend on this mapping; an unknown enemy safely falls back to Ashen Oni.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const ENEMY_SOURCE_INSET = 4;
const ENEMY_CELL_WIDTH = 224;
const ENEMY_CELL_HEIGHT = 224;
const ENEMY_SOURCE_WIDTH = ENEMY_CELL_WIDTH - ENEMY_SOURCE_INSET * 2;
const ENEMY_SOURCE_HEIGHT = ENEMY_CELL_HEIGHT - ENEMY_SOURCE_INSET * 2;

/*
 * The visual rows are not aligned to y = row * 224 in the generated bitmap.
 * These measured, integer-authored cells keep each inset source window on its
 * own silhouette family. Overlap between raw cells is confined to transparent
 * margin; drawImage receives only the inset 216px source window.
 */
const ENEMY_ROW_CELLS = deepFreeze([
  { y: 0, height: ENEMY_CELL_HEIGHT },
  { y: 197, height: ENEMY_CELL_HEIGHT },
  { y: 404, height: ENEMY_CELL_HEIGHT },
  { y: 629, height: ENEMY_CELL_HEIGHT },
  { y: 856, height: ENEMY_CELL_HEIGHT },
  { y: 1094, height: ENEMY_CELL_HEIGHT },
  { y: 1316, height: ENEMY_CELL_HEIGHT },
  { y: 1545, height: ENEMY_CELL_HEIGHT },
]);

export const ENEMY_ATLAS = deepFreeze({
  url: './assets/production/bells-enemy-combat-atlas-v1.png',
  width: 896,
  height: 1792,
  columns: 4,
  rows: 8,
  cellWidth: ENEMY_CELL_WIDTH,
  cellHeight: ENEMY_CELL_HEIGHT,
  sourceInset: ENEMY_SOURCE_INSET,
  sourceWidth: ENEMY_SOURCE_WIDTH,
  sourceHeight: ENEMY_SOURCE_HEIGHT,
  rowCells: ENEMY_ROW_CELLS,
  poses: ['neutral', 'windup', 'attack', 'stagger'],
});

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
