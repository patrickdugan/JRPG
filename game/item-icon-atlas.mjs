export const ITEM_ICON_IDS = Object.freeze([
  'courier-saber', 'warding-brush', 'salt-etched-rapier', 'dusk-censer', 'cedar-maul',
  'pilgrim-knife', 'dawnsteel-blade', 'bellglass-focus', 'quilted-haori', 'river-silk-robe',
  'bell-iron-lamellar', 'ash-lacquer-coat', 'dawn-thread-mantle', 'road-sandals', 'lantern-bead-cord',
  'frostglass-pin', 'storm-kite-toggle', 'iron-knot', 'cedar-route-note', 'temple-charm',
  'river-salve', 'ward-tonic', 'spirit-tea', 'dawn-salt', 'traveler-plum',
]);

export const ITEM_ICON_ATLAS = Object.freeze({
  id: 'item-icon-suite-v1',
  url: './assets/art/item-icon-suite/item-icon-atlas.png',
  frameWidth: 16,
  frameHeight: 16,
  columns: 5,
  rows: 5,
  width: 80,
  height: 80,
});

const FRAMES = Object.freeze(Object.fromEntries(ITEM_ICON_IDS.map((id, index) => [id, Object.freeze({
  id,
  index,
  column: index % ITEM_ICON_ATLAS.columns,
  row: Math.floor(index / ITEM_ICON_ATLAS.columns),
  x: (index % ITEM_ICON_ATLAS.columns) * ITEM_ICON_ATLAS.frameWidth,
  y: Math.floor(index / ITEM_ICON_ATLAS.columns) * ITEM_ICON_ATLAS.frameHeight,
  width: ITEM_ICON_ATLAS.frameWidth,
  height: ITEM_ICON_ATLAS.frameHeight,
})])));

export function getItemIconFrame(itemId) {
  return FRAMES[itemId] ?? null;
}

export function itemIconImageHasExpectedSize(image) {
  return Boolean(image
    && Number(image.naturalWidth) === ITEM_ICON_ATLAS.width
    && Number(image.naturalHeight) === ITEM_ICON_ATLAS.height);
}
