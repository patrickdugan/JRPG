/**
 * DOM-free addressing and presentation-state resolution for the side-view
 * action objective sprite suite (assets/art/action-objective-suite-v1).
 *
 * The resolvers only *read* objective authority (stage anchors, runtime
 * requirement progress, objective entities, combat outcome). They never decide
 * completion, collision, damage, or settlement. Unknown kinds and unknown
 * states resolve to null so the page keeps its rectangle fallback.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const ACTION_OBJECTIVE_ATLAS = deepFreeze({
  id: 'action-objective-suite-v1',
  url: './assets/art/action-objective-suite-v1/action-objective-atlas-v1.png',
  cellWidth: 64,
  cellHeight: 80,
  columns: 5,
  rows: 28,
  width: 320,
  height: 2240,
  pivotX: 32,
  pivotY: 77,
  drawScale: 1.75,
});

function kind(id, role, visualHeights) {
  return { id, role, states: Object.keys(visualHeights), visualHeights };
}

/** Row order, state order, and per-frame opaque heights mirror manifest.json. */
export const ACTION_OBJECTIVE_KINDS = deepFreeze([
  kind('river-gate', 'anchor', { locked: 71, open: 71, complete: 71 }),
  kind('archive-door', 'anchor', { locked: 72, open: 72, complete: 72 }),
  kind('lantern-boat', 'anchor', { waiting: 55, boarding: 56, complete: 60 }),
  kind('safe-shelter', 'anchor', { waiting: 51, complete: 51 }),
  kind('escape-arch', 'anchor', { waiting: 56, complete: 56 }),
  kind('canal-lock', 'anchor', { closed: 70, open: 70 }),
  kind('chain-post', 'anchor', { chained: 56, broken: 56 }),
  kind('release-gate', 'anchor', { locked: 64, ready: 64, open: 64 }),
  kind('lantern-relay', 'anchor', { dark: 76, charging: 77, lit: 76 }),
  kind('net-post', 'anchor', { fogged: 53, clearing: 53, cleared: 53 }),
  kind('seal-dais', 'anchor', { dormant: 15, active: 38, broken: 16 }),
  kind('fog-bell', 'anchor', { ringing: 67, silenced: 67 }),
  kind('slip-box', 'anchor', { full: 34, empty: 23 }),
  kind('water-trough', 'anchor', { flowing: 34, released: 34 }),
  kind('release-mark', 'anchor', { waiting: 22, complete: 41 }),
  kind('orders-lectern', 'anchor', { active: 62, disabling: 60, disabled: 34 }),
  kind('testimony-table', 'anchor', { pending: 29, complete: 35 }),
  kind('corrections-shelf', 'anchor', { pending: 55, complete: 55 }),
  kind('record-chest', 'anchor', { pending: 24, complete: 34 }),
  kind('tower-lantern', 'anchor', { unlit: 75, lit: 75 }),
  kind('shelter-crates', 'anchor', { idle: 44 }),
  kind('courier', 'protected-object', { safe: 39, hurt: 39, down: 30 }),
  kind('print-block', 'protected-object', { intact: 33, damaged: 33, cracked: 33, destroyed: 15 }),
  kind('archive-core', 'protected-object', { intact: 73, damaged: 73, critical: 73, destroyed: 31 }),
  kind('bell-node', 'attackable-object', { active: 61, charging: 65, broken: 39, dormant: 59 }),
  kind('civilian-a', 'token', { idle: 43, walk: 44, bound: 35, safe: 49, down: 29 }),
  kind('civilian-b', 'token', { idle: 44, walk: 45, bound: 36, safe: 49, down: 30 }),
  kind('civilian-c', 'token', { idle: 42, walk: 43, bound: 34, safe: 49, down: 28 }),
]);

export const ACTION_OBJECTIVE_KIND_IDS = Object.freeze(ACTION_OBJECTIVE_KINDS.map(({ id }) => id));

const KIND_BY_ID = new Map(ACTION_OBJECTIVE_KINDS.map((entry, row) => [entry.id, { ...entry, row }]));

const FRAMES = new Map();
for (const [id, entry] of KIND_BY_ID) {
  entry.states.forEach((state, column) => {
    FRAMES.set(`${id}:${state}`, Object.freeze({
      kind: id,
      state,
      row: entry.row,
      column,
      x: column * ACTION_OBJECTIVE_ATLAS.cellWidth,
      y: entry.row * ACTION_OBJECTIVE_ATLAS.cellHeight,
      width: ACTION_OBJECTIVE_ATLAS.cellWidth,
      height: ACTION_OBJECTIVE_ATLAS.cellHeight,
      pivotX: ACTION_OBJECTIVE_ATLAS.pivotX,
      pivotY: ACTION_OBJECTIVE_ATLAS.pivotY,
      scale: ACTION_OBJECTIVE_ATLAS.drawScale,
      visualHeight: entry.visualHeights[state],
    }));
  });
}

/** kind + state -> frozen atlas frame, or null for any unknown pair. */
export function getActionObjectiveFrame(kindId, state) {
  return FRAMES.get(`${kindId}:${state}`) ?? null;
}

export function actionObjectiveImageHasExpectedSize(image) {
  return Boolean(image
    && Number(image.naturalWidth) === ACTION_OBJECTIVE_ATLAS.width
    && Number(image.naturalHeight) === ACTION_OBJECTIVE_ATLAS.height);
}

/** Explicit stage-anchor id -> sprite kind. */
export const ACTION_OBJECTIVE_ANCHOR_KIND_BY_ID = deepFreeze({
  'river-exit': 'river-gate',
  'evacuation-exit': 'archive-door',
  'spirit-exit': 'archive-door',
  'boat-exit': 'lantern-boat',
  'witness-safe-a': 'safe-shelter',
  'witness-safe-b': 'safe-shelter',
  'prisoner-exit': 'escape-arch',
  'canal-lock': 'canal-lock',
  'prison-locks': 'release-gate',
  'garrison-release': 'release-gate',
  'tithe-seal': 'seal-dais',
  'blood-ward-west': 'seal-dais',
  'blood-ward-east': 'seal-dais',
  'fog-bell': 'fog-bell',
  'name-slip-source': 'slip-box',
  'bound-ashen-oni': 'release-mark',
  'orders-ledger': 'orders-lectern',
  'testimony-table': 'testimony-table',
  'corrections-shelf': 'corrections-shelf',
  'unfiled-names': 'record-chest',
  'tower-lantern': 'tower-lantern',
  'archive-core': 'archive-core',
});

/** Ordered id-pattern rules for families of anchors. */
const ANCHOR_ID_RULES = Object.freeze([
  [/^prisoner-[a-z]$/u, 'chain-post'],
  [/^witness-[a-z]$/u, 'shelter-crates'],
  [/^lantern-relay-/u, 'lantern-relay'],
  [/^net-anchor-\d+$/u, 'net-post'],
  [/^flowing-water-/u, 'water-trough'],
  [/^(?:north|east|south|west)-node$/u, 'bell-node'],
  [/^archive-node-[a-z]$/u, 'bell-node'],
]);

/** Stage anchor kind -> sprite kind when no id rule matches. */
export const ACTION_OBJECTIVE_ANCHOR_KIND_BY_STAGE_KIND = deepFreeze({
  exit: 'river-gate',
  'escort-exit': 'lantern-boat',
  extraction: 'safe-shelter',
  prisoner: 'chain-post',
  release: 'release-gate',
  relay: 'lantern-relay',
  'route-anchor': 'net-post',
  'item-source': 'slip-box',
  'item-return': 'water-trough',
  target: 'release-mark',
  orders: 'orders-lectern',
  core: 'archive-core',
});

/**
 * Anchors intentionally left on the rectangle fallback. Empty: every anchor in
 * the authored catalogue maps to a sprite or to an objective entity sprite.
 */
export const ACTION_OBJECTIVE_FALLBACK_ANCHOR_IDS = Object.freeze([]);

/**
 * Short readable labels. Sources: Campaign field-interaction copy for the
 * epilogue archive, objective-presentation nouns (River Exit, Fog Anchor,
 * Command Orders, Lantern Relay, Archive Evidence, Witness, Prisoner, Bell
 * Node), and the encounter objective text for the rest.
 */
export const ACTION_OBJECTIVE_LABELS = deepFreeze({
  'river-exit': ['River exit', 'Exit'],
  'evacuation-exit': ['Evacuation exit', 'Exit'],
  'spirit-exit': ['Spirit passage', 'Passage'],
  'boat-exit': ['Lantern boat', 'Boat'],
  'witness-safe-a': ['Safe shelter', 'Shelter'],
  'witness-safe-b': ['Safe shelter', 'Shelter'],
  'prisoner-exit': ['Escape culvert', 'Escape'],
  'canal-lock': ['Canal lock', 'Lock'],
  'prison-locks': ['Prison locks', 'Locks'],
  'garrison-release': ['Garrison release', 'Release'],
  'lantern-relay-west': ['West lantern relay', 'Relay'],
  'lantern-relay-east': ['East lantern relay', 'Relay'],
  'net-anchor-1': ['Fog anchor', 'Anchor'],
  'net-anchor-2': ['Fog anchor', 'Anchor'],
  'net-anchor-3': ['Fog anchor', 'Anchor'],
  'tithe-seal': ['Seal mount', 'Seal'],
  'blood-ward-west': ['West ward dais', 'Ward'],
  'blood-ward-east': ['East ward dais', 'Ward'],
  'fog-bell': ['Fog bell', 'Bell'],
  'name-slip-source': ['Name slips', 'Slips'],
  'flowing-water-a': ['Flowing water', 'Water'],
  'flowing-water-b': ['Flowing water', 'Water'],
  'bound-ashen-oni': ['Return name slip', 'Release'],
  'orders-ledger': ['Command orders', 'Orders'],
  'testimony-table': ['Public testimony table', 'Testimony'],
  'corrections-shelf': ['Corrections shelf', 'Corrections'],
  'unfiled-names': ['Acknowledged record gaps', 'Record gaps'],
  'tower-lantern': ['Tower lantern', 'Lantern'],
  courier: ['Civilian courier', 'Courier'],
  'print-block-a': ['Print block A', 'Block A'],
  'print-block-b': ['Print block B', 'Block B'],
  'print-block-c': ['Print block C', 'Block C'],
  'archive-core': ['Archive evidence', 'Evidence'],
  'north-node': ['North bell node', 'Node N'],
  'east-node': ['East bell node', 'Node E'],
  'south-node': ['South bell node', 'Node S'],
  'west-node': ['West bell node', 'Node W'],
  'archive-node-a': ['Archive node A', 'Node A'],
  'archive-node-b': ['Archive node B', 'Node B'],
  'archive-node-c': ['Archive node C', 'Node C'],
  'witness-a': ['Witness A', 'Witness'],
  'witness-b': ['Witness B', 'Witness'],
  'prisoner-a': ['Prisoner A', 'Prisoner'],
  'prisoner-b': ['Prisoner B', 'Prisoner'],
  'prisoner-c': ['Prisoner C', 'Prisoner'],
});

/** Kinds whose anchor sprites are scenery only and never carry a tag. */
const UNTAGGED_ANCHOR_KINDS = new Set(['chain-post', 'shelter-crates']);

export function getActionObjectiveLabel(id) {
  const entry = ACTION_OBJECTIVE_LABELS[id];
  return entry ? Object.freeze({ full: entry[0], short: entry[1] }) : null;
}

export function getActionObjectiveAnchorKind(anchor) {
  const id = String(anchor?.id ?? '');
  if (ACTION_OBJECTIVE_FALLBACK_ANCHOR_IDS.includes(id)) return null;
  if (ACTION_OBJECTIVE_ANCHOR_KIND_BY_ID[id]) return ACTION_OBJECTIVE_ANCHOR_KIND_BY_ID[id];
  for (const [pattern, kindId] of ANCHOR_ID_RULES) if (pattern.test(id)) return kindId;
  return ACTION_OBJECTIVE_ANCHOR_KIND_BY_STAGE_KIND[anchor?.kind] ?? null;
}

export function getActionObjectiveObjectKind(object) {
  const id = String(object?.id ?? '');
  if (id === 'courier') return 'courier';
  if (/^print-block-[a-z]$/u.test(id)) return 'print-block';
  if (id === 'archive-core') return 'archive-core';
  if (/(?:^|-)node(?:-[a-z])?$/u.test(id)) return 'bell-node';
  return null;
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getActionObjectiveTokenKind(token) {
  const id = String(token?.id ?? '');
  if (!id) return null;
  const suffix = /-([a-c])$/u.exec(id)?.[1];
  const variant = suffix ?? ['a', 'b', 'c'][stableHash(id) % 3];
  return `civilian-${variant}`;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

/**
 * Normalise live or snapshot objective state into one read-only view.
 * Accepts runtime (`completed`) and page snapshot (`complete`) shapes.
 */
export function createActionObjectiveArtView({
  contractRequirements = [],
  requirementProgress = [],
  entities = null,
  outcome = null,
  aliveTemplateIds = [],
  maxBellCount = 0,
} = {}) {
  const progressById = new Map((requirementProgress ?? []).map((entry) => [entry.id, entry]));
  const requirements = (contractRequirements ?? []).map((requirement) => {
    const progress = progressById.get(requirement.id) ?? {};
    return {
      id: requirement.id,
      semantics: requirement.semantics,
      anchorIds: [...(requirement.anchorIds ?? [])],
      complete: progress.complete === true || progress.completed === true,
      available: progress.available !== false,
      castElapsedMs: finiteOrNull(progress.castElapsedMs) ?? 0,
      castDurationMs: finiteOrNull(progress.castDurationMs) ?? finiteOrNull(requirement.durationMs),
    };
  });
  return {
    requirements,
    objects: new Map((entities?.objects ?? []).map((entry) => [entry.id, entry])),
    tokens: new Map((entities?.tokens ?? []).map((entry) => [entry.id, entry])),
    outcome: outcome ?? null,
    aliveTemplateIds: new Set(aliveTemplateIds ?? []),
    bellCount: Number.isFinite(entities?.bellCount) ? entities.bellCount : 0,
    maxBellCount: Number.isSafeInteger(maxBellCount) && maxBellCount > 0 ? maxBellCount : 0,
  };
}

function requirementsFor(view, anchorId) {
  return view.requirements.filter((entry) => (
    entry.anchorIds.includes(anchorId) || entry.id.endsWith(`:${anchorId}`)
  ));
}

function castState(requirements, complete, charging, idle) {
  if (requirements.length && requirements.every((entry) => entry.complete)) return complete;
  if (requirements.some((entry) => !entry.complete && entry.castElapsedMs > 0)) return charging;
  return idle;
}

function castProgress(requirements) {
  const active = requirements.find((entry) => (
    !entry.complete && entry.castElapsedMs > 0 && entry.castDurationMs > 0
  ));
  return active ? Math.max(0, Math.min(1, active.castElapsedMs / active.castDurationMs)) : null;
}

function victory(view) {
  return view.outcome === 'victory';
}

const ANCHOR_STATE_RULES = {
  'river-gate': gateState,
  'archive-door': gateState,
  'lantern-boat': (anchor, view, reqs) => {
    const done = reqs.filter((entry) => entry.complete).length;
    if (reqs.length && done === reqs.length) return 'complete';
    return done > 0 ? 'boarding' : 'waiting';
  },
  'safe-shelter': (anchor, view, reqs) => (reqs.some((entry) => entry.complete) ? 'complete' : 'waiting'),
  'escape-arch': (anchor, view, reqs) => (
    (reqs.length ? reqs.every((entry) => entry.complete) : victory(view)) ? 'complete' : 'waiting'
  ),
  'canal-lock': (anchor, view, reqs) => (
    (reqs.length ? reqs.every((entry) => entry.complete) : victory(view)) ? 'open' : 'closed'
  ),
  'chain-post': (anchor, view, reqs) => (
    view.tokens.get(anchor.id)?.released || reqs.some((entry) => entry.complete) ? 'broken' : 'chained'
  ),
  'release-gate': (anchor, view, reqs) => {
    if (!reqs.length) return victory(view) ? 'open' : 'locked';
    if (reqs.every((entry) => entry.complete)) return 'open';
    return reqs.some((entry) => entry.available) ? 'ready' : 'locked';
  },
  'lantern-relay': (anchor, view, reqs) => castState(reqs, 'lit', 'charging', 'dark'),
  'net-post': (anchor, view, reqs) => castState(reqs, 'cleared', 'clearing', 'fogged'),
  'seal-dais': (anchor, view, reqs) => {
    if (reqs.length && reqs.every((entry) => entry.complete)) return 'broken';
    return view.aliveTemplateIds.has(anchor.id) ? 'active' : 'dormant';
  },
  'fog-bell': (anchor, view) => (victory(view) ? 'silenced' : 'ringing'),
  'slip-box': (anchor, view) => (
    view.requirements.length && view.requirements.every((entry) => entry.complete) ? 'empty' : 'full'
  ),
  'water-trough': (anchor, view, reqs) => (reqs.some((entry) => entry.complete) ? 'released' : 'flowing'),
  'release-mark': (anchor, view, reqs) => (reqs.some((entry) => entry.complete) ? 'complete' : 'waiting'),
  'orders-lectern': (anchor, view, reqs) => castState(reqs, 'disabled', 'disabling', 'active'),
  'testimony-table': completeOrPending,
  'corrections-shelf': completeOrPending,
  'record-chest': completeOrPending,
  'tower-lantern': (anchor, view, reqs) => (reqs.some((entry) => entry.complete) ? 'lit' : 'unlit'),
  'shelter-crates': () => 'idle',
  'bell-node': (anchor, view, reqs) => (reqs.length ? castState(reqs, 'broken', 'charging', 'active') : 'dormant'),
  'archive-core': () => 'intact',
};

function gateState(anchor, view, reqs) {
  if (!reqs.length) return victory(view) ? 'open' : 'locked';
  if (reqs.some((entry) => entry.complete)) return 'complete';
  return reqs.every((entry) => entry.available) ? 'open' : 'locked';
}

function completeOrPending(anchor, view, reqs) {
  return reqs.some((entry) => entry.complete) ? 'complete' : 'pending';
}

function hpPips(hp, maxHp) {
  if (!Number.isFinite(maxHp) || maxHp <= 1) return null;
  return { filled: Math.max(0, Math.min(maxHp, Math.ceil(hp))), total: maxHp };
}

/**
 * Resolve one stage anchor. Anchors that host an objective object (same id)
 * are owned by that entity's sprite when it resolves; otherwise `frame` may be
 * null, which the page must draw with its exact rectangle fallback.
 */
export function resolveActionObjectiveAnchorArt(anchor, view) {
  const object = view.objects.get(anchor?.id);
  if (object) {
    const entity = resolveActionObjectiveObjectArt(object, view);
    if (entity.frame) return Object.freeze({ owner: 'entity', anchorId: anchor.id, kind: entity.kind, state: entity.state, frame: null });
    return Object.freeze({ owner: 'anchor', anchorId: anchor.id, kind: null, state: null, frame: null });
  }
  const kindId = getActionObjectiveAnchorKind(anchor);
  const rule = kindId ? ANCHOR_STATE_RULES[kindId] : null;
  const reqs = requirementsFor(view, anchor.id);
  const state = rule ? rule(anchor, view, reqs) : null;
  const frame = kindId && state ? getActionObjectiveFrame(kindId, state) : null;
  const label = UNTAGGED_ANCHOR_KINDS.has(kindId) ? null : getActionObjectiveLabel(anchor.id);
  const countdown = kindId === 'escape-arch' && view.maxBellCount > 0
    ? { filled: Math.min(view.maxBellCount, view.bellCount), total: view.maxBellCount }
    : null;
  return Object.freeze({
    owner: 'anchor',
    anchorId: anchor.id,
    kind: frame ? kindId : null,
    state: frame ? state : null,
    frame,
    label,
    relevant: reqs.length > 0,
    complete: reqs.length > 0 && reqs.every((entry) => entry.complete),
    progress: castProgress(reqs),
    countdown,
    pips: null,
  });
}

export function resolveActionObjectiveObjectArt(object, view = null) {
  const kindId = getActionObjectiveObjectKind(object);
  let state = null;
  if (kindId === 'courier') {
    state = object.destroyed ? 'down' : object.hp < object.maxHp ? 'hurt' : 'safe';
  } else if (kindId === 'print-block' || kindId === 'archive-core') {
    const low = kindId === 'print-block' ? 'cracked' : 'critical';
    state = object.destroyed ? 'destroyed'
      : object.hp >= object.maxHp ? 'intact'
        : object.hp * 2 > object.maxHp ? 'damaged' : low;
  } else if (kindId === 'bell-node') {
    state = object.destroyed ? 'broken' : 'active';
  }
  const frame = kindId && state ? getActionObjectiveFrame(kindId, state) : null;
  const completedRequirement = view
    ? view.requirements.some((entry) => entry.complete && entry.id.endsWith(`:${object.id}`))
    : false;
  return Object.freeze({
    owner: 'entity',
    entityType: 'object',
    id: object.id,
    kind: frame ? kindId : null,
    state: frame ? state : null,
    frame,
    label: getActionObjectiveLabel(object.id),
    relevant: true,
    complete: object.attackable ? object.destroyed === true : completedRequirement,
    urgent: !object.attackable && (object.destroyed || object.hp < object.maxHp),
    progress: null,
    countdown: null,
    pips: hpPips(object.hp, object.maxHp),
  });
}

/**
 * Resolve one escort/extraction token. `motion.moving` alternates the walk
 * frame every 180 ms of kernel time; reduced motion holds the walk frame.
 */
export function resolveActionObjectiveTokenArt(token, view = null, motion = {}) {
  const kindId = getActionObjectiveTokenKind(token);
  const moving = motion.moving === true;
  const nowMs = Number.isFinite(motion.nowMs) ? motion.nowMs : 0;
  let state;
  if (token.hp <= 0) state = 'down';
  else if (token.secured) state = 'safe';
  else if (!token.released) state = 'bound';
  else if (moving) state = motion.reducedMotion || Math.floor(nowMs / 180) % 2 === 0 ? 'walk' : 'idle';
  else state = 'idle';
  const frame = kindId ? getActionObjectiveFrame(kindId, state) : null;
  return Object.freeze({
    owner: 'entity',
    entityType: 'token',
    id: token.id,
    kind: frame ? kindId : null,
    state: frame ? state : null,
    frame,
    label: getActionObjectiveLabel(token.id),
    relevant: true,
    complete: token.secured === true,
    urgent: token.hp > 0 && token.hp < token.maxHp,
    progress: null,
    countdown: null,
    pips: hpPips(token.hp, token.maxHp),
  });
}
