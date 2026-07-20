/**
 * Explicit side-view stage contracts for the authored encounter catalogue.
 *
 * These coordinates are independent of the 12 x 7 tactical boards. Canonical
 * tile keys appear only as optional objective-anchor provenance; blocked tiles
 * are never interpreted as platforms, walls, or traversal geometry.
 */

export const ACTION_STAGE_SCHEMA_VERSION = 1;

const ANCHOR_KINDS = Object.freeze([
  'exit', 'escort-exit', 'target', 'object', 'protected', 'item-source',
  'item-return', 'prisoner', 'relay', 'release', 'core', 'interaction',
  'orders', 'route-anchor', 'extraction',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function spawnSlots(groundY, partyX, enemyX) {
  return {
    party: partyX.map((x, index) => ({ id: `party-${index + 1}`, x, y: groundY, facing: 1 })),
    enemy: enemyX.map((x, index) => ({ id: `enemy-${index + 1}`, x, y: groundY, facing: -1 })),
  };
}

function anchor(id, kind, x, y, options = {}) {
  return {
    id,
    kind,
    x,
    y,
    width: options.width ?? 56,
    height: options.height ?? 82,
    ...options,
  };
}

function stage({ id, groundY = 444, partyX, enemyX, platforms = [], objectiveAnchors = [] }) {
  return {
    schemaVersion: ACTION_STAGE_SCHEMA_VERSION,
    id,
    coordinateSystem: 'side-view-world-pixels',
    bounds: { minX: 40, maxX: 920, minY: 44, maxY: 500 },
    groundY,
    spawns: spawnSlots(groundY, partyX, enemyX),
    platforms,
    objectiveAnchors,
  };
}

export const ACTION_STAGES = deepFreeze([
  stage({
    id: 'hsh-census-square', groundY: 446,
    partyX: [116, 164], enemyX: [748, 816],
    platforms: [{ id: 'river-stair', left: 754, right: 906, y: 350, oneWay: true }],
    objectiveAnchors: [anchor('river-exit', 'exit', 884, 446, { sourceTile: '11,5', width: 72 })],
  }),
  stage({
    id: 'c1-flooded-cedars', groundY: 452,
    partyX: [318, 382, 254, 446, 190, 510], enemyX: [122, 696, 808],
    platforms: [
      { id: 'cedar-root-west', left: 76, right: 238, y: 342, oneWay: true },
      { id: 'cedar-root-east', left: 650, right: 852, y: 318, oneWay: true },
    ],
  }),
  stage({
    id: 'c1-tax-storehouse', groundY: 442,
    partyX: [220, 278, 162], enemyX: [684, 786],
    platforms: [{ id: 'ledger-loft', left: 610, right: 858, y: 294, oneWay: true }],
    objectiveAnchors: [anchor('tithe-seal', 'object', 754, 294)],
  }),
  stage({
    id: 'fp1-wet-cedar-stage', groundY: 452,
    partyX: [334, 390, 278], enemyX: [112, 680, 832],
    platforms: [
      { id: 'wet-root-west', left: 66, right: 232, y: 334, oneWay: true },
      { id: 'wet-root-east', left: 704, right: 878, y: 350, oneWay: true },
    ],
  }),
  stage({
    id: 'fp1-flooded-archive-stage', groundY: 448,
    partyX: [248, 304, 360], enemyX: [662, 754, 840],
    platforms: [
      { id: 'archive-gallery-west', left: 72, right: 292, y: 294, oneWay: true },
      { id: 'archive-gallery-east', left: 656, right: 888, y: 294, oneWay: true },
    ],
  }),
  stage({
    id: 'tkm-bell-chamber', groundY: 440,
    partyX: [154, 212, 270], enemyX: [760, 828, 694],
    platforms: [
      { id: 'ward-dais-west', left: 102, right: 282, y: 304, oneWay: true },
      { id: 'ward-dais-east', left: 678, right: 858, y: 304, oneWay: true },
    ],
    objectiveAnchors: [
      anchor('blood-ward-west', 'object', 186, 304),
      anchor('blood-ward-east', 'object', 774, 304),
    ],
  }),
  stage({
    id: 'sdg-rain-docks', groundY: 454,
    partyX: [148, 204, 260, 316], enemyX: [706, 790, 854],
    platforms: [{ id: 'cargo-crane-walk', left: 552, right: 792, y: 318, oneWay: true }],
    objectiveAnchors: [
      anchor('witness-a', 'protected', 86, 454),
      anchor('witness-b', 'protected', 132, 454),
      anchor('boat-exit', 'escort-exit', 876, 454, { width: 78 }),
    ],
  }),
  stage({
    id: 'sdg-salt-warehouse', groundY: 446,
    partyX: [144, 198, 252, 306, 360], enemyX: [760, 826],
    platforms: [
      { id: 'salt-stack-west', left: 70, right: 272, y: 312, oneWay: true },
      { id: 'salt-stack-east', left: 688, right: 888, y: 312, oneWay: true },
    ],
    objectiveAnchors: [
      anchor('witness-a', 'protected', 112, 446),
      anchor('witness-b', 'protected', 850, 446),
      anchor('witness-safe-a', 'extraction', 90, 446, { accepts: ['witness-a'], width: 94 }),
      anchor('witness-safe-b', 'extraction', 870, 446, { accepts: ['witness-b'], width: 94 }),
    ],
  }),
  stage({
    id: 'ngi-tide-caves', groundY: 456,
    partyX: [130, 184, 238, 292, 346, 400], enemyX: [650, 758, 852],
    platforms: [
      { id: 'tide-shelf-west', left: 58, right: 264, y: 324, oneWay: true },
      { id: 'tide-shelf-east', left: 690, right: 904, y: 286, oneWay: true },
    ],
    objectiveAnchors: [
      anchor('net-anchor-1', 'route-anchor', 196, 324),
      anchor('net-anchor-2', 'route-anchor', 520, 456),
      anchor('net-anchor-3', 'route-anchor', 802, 286),
    ],
  }),
  stage({
    id: 'ngi-storm-reef', groundY: 458,
    partyX: [126, 180, 234, 288, 342, 396], enemyX: [724, 812],
    platforms: [
      { id: 'reef-spine-west', left: 84, right: 310, y: 326, oneWay: true },
      { id: 'reef-spine-east', left: 638, right: 878, y: 298, oneWay: true },
    ],
    objectiveAnchors: [anchor('fog-bell', 'object', 758, 298)],
  }),
  stage({
    id: 'kgr-ash-fields', groundY: 448,
    partyX: [130, 184, 238, 292, 346, 400], enemyX: [748, 820],
    platforms: [{ id: 'ash-barrow', left: 624, right: 864, y: 320, oneWay: true }],
    objectiveAnchors: [
      anchor('name-slip-source', 'item-source', 288, 448),
      anchor('bound-ashen-oni', 'target', 786, 448),
    ],
  }),
  stage({
    id: 'kgr-archive-furnace', groundY: 440,
    partyX: [126, 180, 234, 288, 342, 396], enemyX: [734, 814],
    platforms: [
      { id: 'furnace-gantry-west', left: 58, right: 294, y: 284, oneWay: true },
      { id: 'furnace-gantry-east', left: 662, right: 898, y: 284, oneWay: true },
    ],
    objectiveAnchors: [anchor('prison-locks', 'release', 870, 440)],
  }),
  stage({
    id: 'kzu-archive-roof', groundY: 450,
    partyX: [158, 212, 266, 320, 374, 428], enemyX: [692, 774, 850],
    platforms: [
      { id: 'roof-ridge-west', left: 64, right: 326, y: 308, oneWay: true },
      { id: 'roof-ridge-east', left: 634, right: 896, y: 308, oneWay: true },
    ],
    objectiveAnchors: [
      anchor('courier', 'protected', 112, 450),
      anchor('print-block-a', 'protected', 350, 450),
      anchor('print-block-b', 'protected', 480, 450),
      anchor('print-block-c', 'protected', 610, 450),
    ],
  }),
  stage({
    id: 'kzu-public-tribunal', groundY: 442,
    partyX: [124, 178, 232, 286, 340, 394], enemyX: [744, 824],
    platforms: [{ id: 'tribunal-bench', left: 620, right: 876, y: 300, oneWay: true }],
    objectiveAnchors: [
      anchor('orders-ledger', 'orders', 760, 300),
      anchor('print-block-a', 'protected', 326, 442),
      anchor('print-block-b', 'protected', 480, 442),
      anchor('print-block-c', 'protected', 634, 442),
      anchor('canal-lock', 'extraction', 884, 442),
    ],
  }),
  stage({
    id: 'hsh-prison-ferry', groundY: 452,
    partyX: [130, 184, 238, 292, 346, 400], enemyX: [720, 802, 858],
    platforms: [{ id: 'ferry-deck', left: 602, right: 892, y: 316, oneWay: true }],
    objectiveAnchors: [
      anchor('name-slip-source', 'item-source', 442, 452),
      anchor('flowing-water-a', 'item-return', 168, 452, { sourceTile: '2,1' }),
      anchor('flowing-water-b', 'item-return', 232, 452, { sourceTile: '3,1' }),
    ],
  }),
  stage({
    id: 'hsh-bell-aqueduct', groundY: 448,
    partyX: [124, 178, 232, 286, 340, 394], enemyX: [690, 772, 850],
    platforms: [
      { id: 'aqueduct-west', left: 52, right: 298, y: 304, oneWay: true },
      { id: 'aqueduct-east', left: 662, right: 908, y: 304, oneWay: true },
    ],
    objectiveAnchors: [
      anchor('prisoner-a', 'prisoner', 714, 304),
      anchor('prisoner-b', 'prisoner', 792, 448),
      anchor('prisoner-c', 'prisoner', 858, 304),
      anchor('prisoner-exit', 'extraction', 84, 448, { width: 84 }),
    ],
  }),
  stage({
    id: 'c8-black-gate', groundY: 444,
    partyX: [126, 180, 234, 288, 342, 396], enemyX: [714, 788, 856],
    platforms: [
      { id: 'gate-wall-west', left: 54, right: 284, y: 290, oneWay: true },
      { id: 'gate-wall-east', left: 676, right: 906, y: 290, oneWay: true },
    ],
    objectiveAnchors: [
      anchor('lantern-relay-west', 'relay', 176, 290),
      anchor('lantern-relay-east', 'relay', 784, 290),
      anchor('garrison-release', 'release', 858, 444),
    ],
  }),
  stage({
    id: 'krh-outer-archive', groundY: 442,
    partyX: [124, 178, 232, 286, 340, 394], enemyX: [706, 784, 850],
    platforms: [
      { id: 'archive-stack-west', left: 52, right: 300, y: 300, oneWay: true },
      { id: 'archive-stack-east', left: 660, right: 908, y: 300, oneWay: true },
    ],
    objectiveAnchors: [
      anchor('archive-node-a', 'object', 184, 300),
      anchor('archive-node-b', 'object', 480, 442),
      anchor('archive-node-c', 'object', 780, 300),
      anchor('spirit-exit', 'extraction', 72, 442),
    ],
  }),
  stage({
    id: 'krh-observatory', groundY: 438,
    partyX: [122, 176, 230, 284, 338, 392], enemyX: [718, 790, 852],
    platforms: [
      { id: 'observatory-ring-west', left: 64, right: 306, y: 296, oneWay: true },
      { id: 'observatory-ring-east', left: 654, right: 896, y: 296, oneWay: true },
    ],
    objectiveAnchors: [
      anchor('north-node', 'object', 480, 214),
      anchor('east-node', 'object', 782, 296),
      anchor('south-node', 'object', 480, 438),
      anchor('west-node', 'object', 178, 296),
      anchor('archive-core', 'core', 480, 438, { width: 96, height: 118 }),
      anchor('evacuation-exit', 'exit', 884, 438, { width: 70 }),
    ],
  }),
  stage({
    id: 'epi-hoshigawa-archive', groundY: 448,
    partyX: [226, 280, 334, 388, 442, 496], enemyX: [824],
    platforms: [{ id: 'memorial-gallery', left: 612, right: 892, y: 310, oneWay: true }],
    objectiveAnchors: [
      anchor('testimony-table', 'interaction', 226, 448),
      anchor('corrections-shelf', 'interaction', 426, 448),
      anchor('unfiled-names', 'interaction', 700, 310),
      anchor('tower-lantern', 'interaction', 862, 310),
    ],
  }),
]);

export const ACTION_STAGE_IDS = Object.freeze(ACTION_STAGES.map(({ id }) => id));

const ACTION_STAGE_BY_ID = new Map(ACTION_STAGES.map((entry) => [entry.id, entry]));

function finite(value) {
  return Number.isFinite(value);
}

function isStandingSurface(stageContract, x, y) {
  if (y === stageContract.groundY) return true;
  return stageContract.platforms.some((platform) => (
    y === platform.y && x >= platform.left && x <= platform.right
  ));
}

export function validateActionStage(stageContract) {
  const errors = [];
  const path = stageContract?.id || '(missing stage id)';
  if (!stageContract?.id || typeof stageContract.id !== 'string') errors.push('missing stage id');
  if (stageContract?.schemaVersion !== ACTION_STAGE_SCHEMA_VERSION) errors.push(`${path} has unsupported schema version`);
  if (stageContract?.coordinateSystem !== 'side-view-world-pixels') errors.push(`${path} must declare side-view world pixels`);
  const bounds = stageContract?.bounds ?? {};
  if (![bounds.minX, bounds.maxX, bounds.minY, bounds.maxY].every(finite)
      || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) {
    errors.push(`${path} has invalid bounds`);
  }
  if (!finite(stageContract?.groundY)
      || stageContract.groundY < bounds.minY || stageContract.groundY > bounds.maxY) {
    errors.push(`${path} groundY must be inside bounds`);
  }

  const platformIds = new Set();
  for (const platform of stageContract?.platforms ?? []) {
    if (!platform?.id || platformIds.has(platform.id)) errors.push(`${path} has duplicate or missing platform id`);
    platformIds.add(platform?.id);
    if (![platform?.left, platform?.right, platform?.y].every(finite)
        || platform.left >= platform.right
        || platform.left < bounds.minX || platform.right > bounds.maxX
        || platform.y < bounds.minY || platform.y >= stageContract.groundY) {
      errors.push(`${path} platform ${platform?.id ?? '(missing)'} is outside side-view bounds`);
    }
    if (platform?.oneWay !== true) errors.push(`${path} platform ${platform?.id ?? '(missing)'} must be explicitly one-way`);
  }

  const spawnIds = new Set();
  for (const faction of ['party', 'enemy']) {
    const slots = stageContract?.spawns?.[faction];
    if (!Array.isArray(slots) || slots.length === 0) {
      errors.push(`${path} needs at least one ${faction} spawn`);
      continue;
    }
    for (const slot of slots) {
      if (!slot?.id || spawnIds.has(slot.id)) errors.push(`${path} has duplicate or missing spawn id`);
      spawnIds.add(slot?.id);
      if (!finite(slot?.x) || !finite(slot?.y)
          || slot.x < bounds.minX || slot.x > bounds.maxX
          || slot.y < bounds.minY || slot.y > bounds.maxY) {
        errors.push(`${path} spawn ${slot?.id ?? '(missing)'} is outside bounds`);
      } else if (!isStandingSurface(stageContract, slot.x, slot.y)) {
        errors.push(`${path} spawn ${slot.id} is not on an authored side-view surface`);
      }
      if (![1, -1].includes(slot?.facing)) errors.push(`${path} spawn ${slot?.id ?? '(missing)'} has invalid facing`);
    }
  }

  const anchorIds = new Set();
  for (const objectiveAnchor of stageContract?.objectiveAnchors ?? []) {
    if (!objectiveAnchor?.id || anchorIds.has(objectiveAnchor.id)) errors.push(`${path} has duplicate or missing objective anchor id`);
    anchorIds.add(objectiveAnchor?.id);
    if (!ANCHOR_KINDS.includes(objectiveAnchor?.kind)) errors.push(`${path} anchor ${objectiveAnchor?.id ?? '(missing)'} has unsupported kind`);
    if (![objectiveAnchor?.x, objectiveAnchor?.y, objectiveAnchor?.width, objectiveAnchor?.height].every(finite)
        || objectiveAnchor.width <= 0 || objectiveAnchor.height <= 0
        || objectiveAnchor.x - objectiveAnchor.width / 2 < bounds.minX
        || objectiveAnchor.x + objectiveAnchor.width / 2 > bounds.maxX
        || objectiveAnchor.y > bounds.maxY
        || objectiveAnchor.y - objectiveAnchor.height < bounds.minY) {
      errors.push(`${path} anchor ${objectiveAnchor?.id ?? '(missing)'} is outside bounds`);
    }
    if (objectiveAnchor?.sourceTile != null && !/^\d+,\d+$/u.test(objectiveAnchor.sourceTile)) {
      errors.push(`${path} anchor ${objectiveAnchor.id} has invalid source-tile provenance`);
    }
  }
  return errors;
}

export function getActionStage(levelId) {
  const result = ACTION_STAGE_BY_ID.get(String(levelId));
  if (!result) throw new RangeError(`Unsupported action stage levelId: ${levelId}.`);
  return result;
}

export function getActionStageAnchor(levelId, anchorId) {
  const stageContract = getActionStage(levelId);
  const result = stageContract.objectiveAnchors.find(({ id }) => id === anchorId);
  if (!result) throw new RangeError(`Action stage ${levelId} has no objective anchor: ${anchorId}.`);
  return result;
}

export function toActionKernelStage(levelIdOrContract) {
  const stageContract = typeof levelIdOrContract === 'string'
    ? getActionStage(levelIdOrContract)
    : levelIdOrContract;
  const errors = validateActionStage(stageContract);
  if (errors.length) throw new TypeError(`Invalid action stage contract: ${errors.join('; ')}`);
  return deepFreeze({
    minX: stageContract.bounds.minX,
    maxX: stageContract.bounds.maxX,
    minY: stageContract.bounds.minY,
    maxY: stageContract.bounds.maxY,
    groundY: stageContract.groundY,
  });
}

/**
 * Build the deterministic one-way-platform hook expected by ActionCombatKernel.
 * A platform catches only a downward crossing; top-down blocked cells are not read.
 */
export function createActionStagePhysicsHooks(levelId) {
  const stageContract = getActionStage(levelId);
  return deepFreeze({
    resolveGround({ actor, previousPosition, proposedPosition }) {
      const falling = (actor?.velocity?.y ?? 0) >= 0;
      if (!falling) return { grounded: false, groundY: stageContract.groundY };
      const crossedPlatforms = stageContract.platforms
        .filter((platform) => proposedPosition.x >= platform.left && proposedPosition.x <= platform.right)
        .filter((platform) => previousPosition.y <= platform.y && proposedPosition.y >= platform.y)
        .sort((a, b) => a.y - b.y);
      if (crossedPlatforms.length) return { grounded: true, groundY: crossedPlatforms[0].y };
      if (proposedPosition.y >= stageContract.groundY) return { grounded: true, groundY: stageContract.groundY };
      return { grounded: false, groundY: stageContract.groundY };
    },
  });
}
