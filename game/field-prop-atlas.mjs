/**
 * DOM-free addressing for the top-down field prop / landmark atlas
 * (assets/art/field-prop-suite-v1). Frames are whole 16 x 16 cell multiples;
 * the rectangles below mirror the deterministic builder's layout exactly.
 * Prop pixels are presentation only and never define collision.
 */

export const FIELD_PROP_CELL = 16;

export const FIELD_PROP_FAMILY_IDS = Object.freeze([
  'village', 'river', 'relay', 'ash', 'castle', 'archive', 'forge', 'engine',
]);

/** World tileset theme -> architectural prop family (one to one). */
export const FIELD_PROP_THEME_FAMILIES = Object.freeze({
  'takamine-rain-village': 'village',
  'hoshigawa-river-ward': 'river',
  'sodegaura-relay-road': 'relay',
  'kagura-ash-pass': 'ash',
  'kurohana-black-castle': 'castle',
  'hidden-archive-chapel': 'archive',
  'oni-forge': 'forge',
  'black-bell-engine': 'engine',
});

/** Structural pieces shared by every family band (column/row inside the band). */
export const FIELD_PROP_FAMILY_PIECES = Object.freeze([
  Object.freeze({ id: 'strip1-left', column: 0, row: 0, widthCells: 1, heightCells: 1 }),
  Object.freeze({ id: 'strip1-mid-a', column: 1, row: 0, widthCells: 1, heightCells: 1 }),
  Object.freeze({ id: 'strip1-mid-b', column: 2, row: 0, widthCells: 1, heightCells: 1 }),
  Object.freeze({ id: 'strip1-right', column: 3, row: 0, widthCells: 1, heightCells: 1 }),
  Object.freeze({ id: 'wall-top', column: 0, row: 1, widthCells: 1, heightCells: 1 }),
  Object.freeze({ id: 'wall-mid', column: 1, row: 1, widthCells: 1, heightCells: 1 }),
  Object.freeze({ id: 'wall-bottom', column: 2, row: 1, widthCells: 1, heightCells: 1 }),
  Object.freeze({ id: 'strip1-mid-c', column: 3, row: 1, widthCells: 1, heightCells: 1 }),
  Object.freeze({ id: 'strip2-left', column: 4, row: 0, widthCells: 1, heightCells: 2 }),
  Object.freeze({ id: 'strip2-mid-a', column: 5, row: 0, widthCells: 1, heightCells: 2 }),
  Object.freeze({ id: 'strip2-mid-b', column: 6, row: 0, widthCells: 1, heightCells: 2 }),
  Object.freeze({ id: 'strip2-right', column: 7, row: 0, widthCells: 1, heightCells: 2 }),
  Object.freeze({ id: 'block-2x2', column: 8, row: 0, widthCells: 2, heightCells: 2 }),
  Object.freeze({ id: 'block-3x2', column: 10, row: 0, widthCells: 3, heightCells: 2 }),
  Object.freeze({ id: 'block-3x3', column: 13, row: 0, widthCells: 3, heightCells: 3 }),
]);

/** Nine single-cell props per family, drawn in that family's palette (band row 2, columns 0-8). */
export const FIELD_PROP_FAMILY_PROPS = Object.freeze({
  village: Object.freeze(['cedar-canopy', 'pine-canopy', 'stone-lantern', 'rice-sacks', 'firewood-stack', 'water-jar', 'fire-bell-frame', 'hydrangea-shrub', 'boulder']),
  river: Object.freeze(['crates', 'barrels', 'net-rack', 'water-jar', 'cedar-canopy', 'notice-board', 'rice-sacks', 'beached-skiff', 'stone-lantern']),
  relay: Object.freeze(['handcart', 'notice-board', 'rice-sacks', 'crates', 'barrels', 'pine-canopy', 'stone-lantern', 'firewood-stack', 'water-jar']),
  ash: Object.freeze(['boulder', 'ash-cairn', 'pine-canopy', 'rice-sacks', 'handcart', 'crates', 'barrels', 'firewood-stack', 'stone-lantern']),
  castle: Object.freeze(['lacquer-screen', 'stone-lantern', 'registry-desk', 'prisoner-lattice', 'crates', 'notice-board', 'pine-canopy', 'water-jar', 'barrels']),
  archive: Object.freeze(['registry-desk', 'scroll-shelf', 'prisoner-lattice', 'crates', 'rice-sacks', 'water-jar', 'stone-lantern', 'cedar-canopy', 'barrels']),
  forge: Object.freeze(['forge-anvil', 'coal-bin', 'crates', 'barrels', 'boulder', 'prisoner-lattice', 'water-jar', 'handcart', 'firewood-stack']),
  engine: Object.freeze(['gear-housing', 'pipe-valve', 'fire-bell-frame', 'crates', 'coal-bin', 'barrels', 'forge-anvil', 'boulder', 'registry-desk']),
});

/** Two 2 x 1 props per family (band row 2, columns 9-10 and 11-12). */
export const FIELD_PROP_FAMILY_WIDE_PROPS = Object.freeze({
  village: Object.freeze(['drying-rack', 'lumber-stack']),
  river: Object.freeze(['drying-rack', 'cargo-stack']),
  relay: Object.freeze(['market-stall', 'freight-cart']),
  ash: Object.freeze(['rock-pile', 'freight-cart']),
  castle: Object.freeze(['checkpoint-barrier', 'cargo-stack']),
  archive: Object.freeze(['long-shelf', 'cargo-stack']),
  forge: Object.freeze(['quench-trough', 'freight-cart']),
  engine: Object.freeze(['bellows-machine', 'cargo-stack']),
});

/** Shared 1 x 2 tall props in the bottom band. */
export const FIELD_PROP_TALL_IDS = Object.freeze([
  'cedar', 'pine', 'dead-pine', 'watch-post', 'fire-bell-tower', 'chimney', 'pipe-stack', 'lacquer-lantern',
]);

const FAMILY_BAND_ROWS = 3;
const PROP_ROW = 2;
const WIDE_FIRST_COLUMN = 9;
const TALL_BAND_ROW = FIELD_PROP_FAMILY_IDS.length * FAMILY_BAND_ROWS;

export const FIELD_PROP_ATLAS = Object.freeze({
  id: 'field-prop-suite-v1',
  url: './assets/art/field-prop-suite-v1/field-prop-atlas.png',
  cell: FIELD_PROP_CELL,
  columns: 16,
  familyBandRows: FAMILY_BAND_ROWS,
  tallBandRow: TALL_BAND_ROW,
  width: 256,
  height: 416,
  alphaPolicy: 'binary art alpha plus one fixed ink shadow value',
});

function makeFrame(id, family, kind, name, column, row, widthCells, heightCells) {
  return Object.freeze({
    id,
    family,
    kind,
    name,
    x: column * FIELD_PROP_CELL,
    y: row * FIELD_PROP_CELL,
    width: widthCells * FIELD_PROP_CELL,
    height: heightCells * FIELD_PROP_CELL,
    widthCells,
    heightCells,
  });
}

const FRAME_LIST = Object.freeze([
  ...FIELD_PROP_FAMILY_IDS.flatMap((family, familyIndex) => {
    const bandRow = familyIndex * FAMILY_BAND_ROWS;
    return [
      ...FIELD_PROP_FAMILY_PIECES.map((piece) => makeFrame(
        `${family}:${piece.id}`, family, 'structure', piece.id,
        piece.column, bandRow + piece.row, piece.widthCells, piece.heightCells,
      )),
      ...FIELD_PROP_FAMILY_PROPS[family].map((name, index) => makeFrame(
        `${family}:${name}`, family, 'prop', name, index, bandRow + PROP_ROW, 1, 1,
      )),
      ...FIELD_PROP_FAMILY_WIDE_PROPS[family].map((name, index) => makeFrame(
        `${family}:${name}`, family, 'wide-prop', name, WIDE_FIRST_COLUMN + index * 2, bandRow + PROP_ROW, 2, 1,
      )),
    ];
  }),
  ...FIELD_PROP_TALL_IDS.map((name, index) => makeFrame(`tall:${name}`, 'tall', 'tall-prop', name, index, TALL_BAND_ROW, 1, 2)),
]);

const FRAMES = new Map(FRAME_LIST.map((frame) => [frame.id, frame]));

export const FIELD_PROP_FRAME_IDS = Object.freeze(FRAME_LIST.map((frame) => frame.id));

export function listFieldPropFrames() {
  return FRAME_LIST;
}

export function getFieldPropFrame(frameId) {
  return FRAMES.get(frameId) ?? null;
}

export function fieldPropFamilyForTheme(themeId) {
  return FIELD_PROP_THEME_FAMILIES[themeId] ?? null;
}

export function fieldPropImageHasExpectedSize(image) {
  return Boolean(image
    && Number(image.naturalWidth) === FIELD_PROP_ATLAS.width
    && Number(image.naturalHeight) === FIELD_PROP_ATLAS.height);
}
