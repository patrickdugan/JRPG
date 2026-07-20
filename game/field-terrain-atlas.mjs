/** DOM-free addressing for decorative Campaign terrain overlays. */

export const FIELD_TERRAIN_IDS = Object.freeze([
  'stone', 'wet-stone', 'shallow-puddle', 'paper-litter', 'cracked-board',
  'swing-beam-lane', 'water', 'storm-water', 'cold-pool', 'ash-field',
  'ember-ash', 'umbral-ash', 'bell-node', 'furnace-grate', 'legal-seal',
  'flowing-water', 'high-gallery', 'archive-floor', 'dry-lantern',
]);

export const FIELD_TERRAIN_ATLAS = Object.freeze({
  id: 'field-terrain-overlay-suite-v1',
  url: './assets/art/field-terrain-suite/field-terrain-atlas.png',
  frameWidth: 16,
  frameHeight: 16,
  columns: 5,
  rows: 4,
  width: 80,
  height: 64,
});

const FRAMES = Object.freeze(Object.fromEntries(FIELD_TERRAIN_IDS.map((id, index) => [id, Object.freeze({
  id,
  index,
  column: index % FIELD_TERRAIN_ATLAS.columns,
  row: Math.floor(index / FIELD_TERRAIN_ATLAS.columns),
  x: (index % FIELD_TERRAIN_ATLAS.columns) * FIELD_TERRAIN_ATLAS.frameWidth,
  y: Math.floor(index / FIELD_TERRAIN_ATLAS.columns) * FIELD_TERRAIN_ATLAS.frameHeight,
  width: FIELD_TERRAIN_ATLAS.frameWidth,
  height: FIELD_TERRAIN_ATLAS.frameHeight,
})])));

export function getFieldTerrainFrame(terrainId) {
  return FRAMES[terrainId] ?? null;
}

export function fieldTerrainImageHasExpectedSize(image) {
  return Boolean(image
    && Number(image.naturalWidth) === FIELD_TERRAIN_ATLAS.width
    && Number(image.naturalHeight) === FIELD_TERRAIN_ATLAS.height);
}
