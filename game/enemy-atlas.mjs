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

export const ENEMY_ATLAS = deepFreeze({
  url: './assets/production/bells-enemy-combat-atlas-v1.png',
  width: 896,
  height: 1792,
  columns: 4,
  rows: 8,
  cellWidth: 224,
  cellHeight: 224,
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
  return Object.freeze({
    familyId: family.id,
    pose: ENEMY_ATLAS.poses[resolvedColumn],
    row: family.row,
    column: resolvedColumn,
    x: resolvedColumn * ENEMY_ATLAS.cellWidth,
    y: family.row * ENEMY_ATLAS.cellHeight,
    width: ENEMY_ATLAS.cellWidth,
    height: ENEMY_ATLAS.cellHeight,
  });
}

export function hasAuthoredEnemyFamily(templateId) {
  return FAMILY_BY_TEMPLATE.has(templateId);
}

