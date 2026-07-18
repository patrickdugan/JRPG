/**
 * Deterministic field exploration for Bells of the Black Chrysanthemum.
 *
 * The runtime is deliberately DOM-free. It owns exact tile movement, authored
 * interactions, field hazards, encounter and exit triggers, objective status,
 * immutable per-level/per-beat state, and a small save adapter. Rendering,
 * input binding, combat, party HP, audio, and story navigation are consumers.
 */

import { CAMPAIGN } from './content/campaign.mjs';
import {
  LEVELS,
  getLevel,
  isBlocked,
  isInBounds,
  parseTileKey,
  tileKey,
} from './content/levels.mjs';

export const FIELD_SCHEMA_VERSION = 1;
export const DEFAULT_FIELD_SAVE_KEY = `${CAMPAIGN.id}.field.v${FIELD_SCHEMA_VERSION}`;

export const FIELD_DIRECTIONS = Object.freeze({
  north: Object.freeze({ dx: 0, dy: -1, facing: 'north' }),
  'north-east': Object.freeze({ dx: 1, dy: -1, facing: 'north-east' }),
  east: Object.freeze({ dx: 1, dy: 0, facing: 'east' }),
  'south-east': Object.freeze({ dx: 1, dy: 1, facing: 'south-east' }),
  south: Object.freeze({ dx: 0, dy: 1, facing: 'south' }),
  'south-west': Object.freeze({ dx: -1, dy: 1, facing: 'south-west' }),
  west: Object.freeze({ dx: -1, dy: 0, facing: 'west' }),
  'north-west': Object.freeze({ dx: -1, dy: -1, facing: 'north-west' }),
});

const DIRECTION_ALIASES = Object.freeze({
  n: 'north', up: 'north',
  ne: 'north-east', northeast: 'north-east',
  e: 'east', right: 'east',
  se: 'south-east', southeast: 'south-east',
  s: 'south', down: 'south',
  sw: 'south-west', southwest: 'south-west',
  w: 'west', left: 'west',
  nw: 'north-west', northwest: 'north-west',
});

const STATE_KEYS = Object.freeze([
  'schemaVersion',
  'campaignId',
  'current',
  'contexts',
  'flags',
  'totalPlaytimeMs',
  'revision',
]);
const CURRENT_KEYS = Object.freeze(['levelId', 'beatId']);
const CONTEXT_KEYS = Object.freeze([
  'levelId',
  'beatId',
  'position',
  'facing',
  'safePosition',
  'discoveredInteractableIds',
  'consumedInteractableIds',
  'pendingEncounterTriggerIds',
  'triggeredEncounterIds',
  'resolvedEncounterIds',
  'armedHazards',
  'hazardHitCounts',
  'steps',
  'elapsedMs',
]);
const POSITION_KEYS = Object.freeze(['x', 'y']);
const ARMED_HAZARD_KEYS = Object.freeze(['hazardId', 'enteredAtMs']);
const EMPTY_ARRAY = Object.freeze([]);
const LEVEL_BY_ID = new Map(LEVELS.map((level) => [level.id, level]));
const LEVEL_INDEX = new Map(LEVELS.map((level, index) => [level.id, index]));
const BUILT_STATES = new WeakSet();

/**
 * Exit conditions whose level-local meaning is stated by the authored kit.
 * An exact global/story flag with the same name always satisfies a condition
 * first, allowing campaign and battle state to remain authoritative.
 */
const CONDITION_RULES = Object.freeze({
  'survived-three-activations': all(encounter('prologue-ashen-bailiff', 'Survive the Ashen Bailiff encounter')),
  'route-encounters-cleared': all(
    encounter('c1-cinder-hounds', 'Clear the Cinder Hounds'),
    encounter('c1-ash-wisps', 'Clear the Ash Wisps'),
  ),
  'inspect-supply-cart': all(interaction('supply-cart', 'Inspect the supply cart')),
  'fp1-cedar-path-cleared': all(encounter('fp1-cedar-path', 'Clear the cedar-path encounter')),
  'lise-key-used': all(interaction('rear-lock', 'Unlock the rear lock with Lise\'s key')),
  'inspect-varga-mark': all(interaction('varga-mark', 'Inspect the Varga mark')),
  'bell-room-key': all(flag('bell-room-key', 'Obtain the Bell-room key')),
  'cell-lever-pulled': all(interaction('cell-lever', 'Pull the cell lever')),
  'mateus-yields': all(encounter('fp1-mateus', 'Reach Mateus\'s nonlethal surrender condition')),
  'testimony-table-opened': all(interaction('testimony-table', 'Open the public testimony table')),
  'medicine-delivered': all(interaction('mori-house-door', 'Deliver Kiku\'s medicine')),
  'families-at-river': all(interaction('river-checkpoint', 'Guide the families to the river checkpoint')),
  'records-compared': all(interaction('register-table', 'Compare the three records')),
  'three-conversations-complete': all(
    interaction('dock-worker', 'Hear the dock worker'),
    interaction('ferry-captain', 'Hear the ferry captain'),
    interaction('market-seller', 'Hear the market seller'),
  ),
  'separate-arrivals-complete': all(
    interaction('trade-broker', 'Gather trade context'),
    interaction('printer-stall', 'Meet the printer contact'),
    interaction('checkpoint-sign', 'Read the transport mark'),
  ),
  'lantern-route-chosen': all(flag('lantern-route-chosen', 'Choose the lantern escort route')),
  'cipher-recorded': all(interaction('customs-ledger', 'Record the customs cipher')),
  'witnesses-escorted': all(encounter('c3-dock-patrol', 'Escort the witnesses through the dock patrol')),
  'nagi-bargain-accepted': all(interaction('fisher-council', 'Reach terms with the fisher council')),
  'net-anchors-cleared': all(
    interaction('net-anchor-a', 'Clear the first net anchor'),
    interaction('net-anchor-b', 'Clear the second net anchor'),
    interaction('net-anchor-c', 'Clear the third net anchor'),
  ),
  'survivor-choice-complete': all(interaction('survivor-hold', 'Choose Kiku\'s rescue position')),
  'requisition-marks-recorded': all(interaction('coal-ledger', 'Record the requisition marks')),
  'bound-oni-released': all(
    interaction('name-slip', 'Carry the bound Oni\'s name slip'),
    interaction('release-channel', 'Return the name slip to flowing water'),
  ),
  'furnace-route-open': any(
    interaction('forge-directives', 'Inspect the forge directives'),
    encounter('c5-furnace-abbot', 'Release the Furnace Abbot'),
  ),
  'prison-route-chosen': any(
    interaction('rescue-lock-panel', 'Choose the rescue route'),
    interaction('blast-charge', 'Choose the blast route'),
  ),
  'three-copies-complete': all(
    interaction('woodblock-bench', 'Complete the woodblock copy'),
    interaction('testimony-table', 'Complete the testimony copy'),
    interaction('boat-runner', 'Complete the boat copy'),
  ),
  'clerks-pursue': all(flag('clerks-pursue', 'Commit to the clerks\' roof route')),
  'copies-preserved': all(encounter('c6-masked-clerks', 'Preserve the courier and print blocks')),
  'three-print-blocks-preserved': all(encounter('c6-ujiro', 'Preserve the tribunal print blocks')),
  'three-bundles-departed': all(
    interaction('north-boat', 'Dispatch the north bundle'),
    interaction('central-courier', 'Dispatch the central bundle'),
    interaction('south-boat', 'Dispatch the south bundle'),
  ),
  'rescue-route-chosen': all(interaction('hushroad-map', 'Choose the rescue route')),
  'former-retainer-scene-complete': all(interaction('former-retainer', 'Offer a safe stand-down')),
  'bound-patrol-released': all(
    interaction('carried-name-slip', 'Carry the patrol\'s name slip'),
    interaction('north-current', 'Return the patrol\'s name slip to flowing water'),
  ),
  'archive-runners-confirmed': all(interaction('archive-runner-table', 'Confirm the archive runners')),
  'evacuation-boats-confirmed': all(interaction('boat-council', 'Confirm the evacuation boats')),
  'medical-tents-confirmed': all(interaction('medical-tent-list', 'Confirm the medical tents')),
  'ash-garrison-released': all(encounter('c8-lady-enma', 'Release the Black Gate garrison')),
  'three-archive-nodes-broken': all(encounter('c9-archive-nodes', 'Break the three archive nodes')),
  'kurozane-defeated-and-records-secured': all(encounter('c9-kurozane', 'Defeat Kurozane and secure the records')),
  'ujiro-custody-scene-complete': all(interaction('ujiro-ledger', 'Place Ujiro in public custody')),
  'six-offers-refused': all(
    interaction('ren-offer', 'Ren refuses the offer'),
    interaction('aya-offer', 'Aya refuses the offer'),
    interaction('lise-offer', 'Lise refuses the offer'),
    interaction('mateus-offer', 'Mateus refuses the offer'),
    interaction('genta-offer', 'Genta refuses the offer'),
    interaction('kiku-offer', 'Kiku refuses the offer'),
  ),
  'spine-nodes-broken': all(
    interaction('spine-node-a', 'Break the first spine node'),
    interaction('spine-node-b', 'Break the second spine node'),
  ),
  'supplies-delivered': all(
    interaction('medical-crate-a', 'Deliver the first medical crate'),
    interaction('medical-crate-b', 'Deliver the second medical crate'),
  ),
});

const FINAL_LEVEL_RULES = Object.freeze({
  'epi-takamine-tower': all(
    interaction('final-packet', 'Deliver Ren\'s final packet'),
    interaction('tower-lantern', 'Light the repaired tower lantern'),
  ),
});

function interaction(id, label) {
  return Object.freeze({ type: 'interaction', id, label });
}

function encounter(id, label) {
  return Object.freeze({ type: 'encounter', id, label });
}

function flag(id, label) {
  return Object.freeze({ type: 'flag', id, label });
}

function expression(mode, items) {
  return Object.freeze({ mode, items: Object.freeze(items) });
}

function all(...items) {
  return expression('all', items);
}

function any(...items) {
  return expression('any', items);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function freezeArray(values) {
  return Object.freeze([...values]);
}

function deepFreezeCopy(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(deepFreezeCopy));
  if (isPlainObject(value)) {
    const copy = {};
    for (const [key, child] of Object.entries(value)) copy[key] = deepFreezeCopy(child);
    return Object.freeze(copy);
  }
  return value;
}

function freezeEvents(events) {
  return Object.freeze(events.map(deepFreezeCopy));
}

function normalizeFlag(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function addFlagsToSet(target, source) {
  if (source === undefined || source === null || source === false) return;
  if (typeof source === 'string' || typeof source === 'number') {
    const normalized = normalizeFlag(source);
    if (normalized) target.add(normalized);
    return;
  }
  if (Array.isArray(source) || source instanceof Set) {
    for (const value of source) addFlagsToSet(target, value);
    return;
  }
  if (isPlainObject(source)) {
    for (const [key, value] of Object.entries(source)) {
      if (value) addFlagsToSet(target, key);
      if (typeof value === 'string' || Array.isArray(value) || value instanceof Set) addFlagsToSet(target, value);
    }
  }
}

function collectFlags(...sources) {
  const flags = new Set();
  for (const source of sources) addFlagsToSet(flags, source);
  return flags;
}

function normalizeFlags(...sources) {
  return [...collectFlags(...sources)].sort();
}

function contextKey(levelId, beatId) {
  return `${levelId}\u0000${beatId}`;
}

function compareContexts(left, right) {
  const levelDifference = (LEVEL_INDEX.get(left.levelId) ?? Number.MAX_SAFE_INTEGER)
    - (LEVEL_INDEX.get(right.levelId) ?? Number.MAX_SAFE_INTEGER);
  return levelDifference || left.beatId.localeCompare(right.beatId);
}

function canonicalIds(level, ids, sourceName, idKey = 'id') {
  const source = level[sourceName] ?? [];
  const allowed = new Set(ids);
  return source.map((entry) => entry[idKey]).filter((id) => allowed.has(id));
}

function canonicalResolvedEncounterIds(level, ids) {
  const allowed = new Set(ids);
  const authored = [];
  for (const trigger of level.encounterTriggers ?? []) {
    if (allowed.has(trigger.encounterId) && !authored.includes(trigger.encounterId)) authored.push(trigger.encounterId);
  }
  return authored;
}

function freezePosition(position) {
  return Object.freeze({ x: position.x, y: position.y });
}

function freezeHazardHitCounts(level, counts = {}) {
  const result = {};
  for (const hazard of level.hazards ?? []) {
    const count = counts[hazard.id] ?? 0;
    if (count > 0) result[hazard.id] = count;
  }
  return Object.freeze(result);
}

function buildContext(context) {
  const level = LEVEL_BY_ID.get(context.levelId);
  const armedById = new Map((context.armedHazards ?? []).map((entry) => [entry.hazardId, entry]));
  return Object.freeze({
    levelId: context.levelId,
    beatId: context.beatId,
    position: freezePosition(context.position),
    facing: context.facing,
    safePosition: freezePosition(context.safePosition),
    discoveredInteractableIds: freezeArray(canonicalIds(level, context.discoveredInteractableIds ?? [], 'interactables')),
    consumedInteractableIds: freezeArray(canonicalIds(level, context.consumedInteractableIds ?? [], 'interactables')),
    pendingEncounterTriggerIds: freezeArray(canonicalIds(level, context.pendingEncounterTriggerIds ?? [], 'encounterTriggers')),
    triggeredEncounterIds: freezeArray(canonicalIds(level, context.triggeredEncounterIds ?? [], 'encounterTriggers')),
    resolvedEncounterIds: freezeArray(canonicalResolvedEncounterIds(level, context.resolvedEncounterIds ?? [])),
    armedHazards: freezeArray((level.hazards ?? [])
      .filter((hazard) => armedById.has(hazard.id))
      .map((hazard) => Object.freeze({
        hazardId: hazard.id,
        enteredAtMs: armedById.get(hazard.id).enteredAtMs,
      }))),
    hazardHitCounts: freezeHazardHitCounts(level, context.hazardHitCounts),
    steps: context.steps,
    elapsedMs: context.elapsedMs,
  });
}

function buildState({ current, contexts, flags, totalPlaytimeMs, revision }) {
  const normalizedContexts = [...contexts].sort(compareContexts).map(buildContext);
  const state = Object.freeze({
    schemaVersion: FIELD_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    current: Object.freeze({ levelId: current.levelId, beatId: current.beatId }),
    contexts: Object.freeze(normalizedContexts),
    flags: freezeArray(normalizeFlags(flags)),
    totalPlaytimeMs,
    revision,
  });
  BUILT_STATES.add(state);
  return state;
}

function validateExactKeys(value, expectedKeys, label, errors) {
  const expected = new Set(expectedKeys);
  for (const key of expectedKeys) if (!hasOwn(value, key)) errors.push(`${label}.${key} is required.`);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) errors.push(`${label}.${key} is not supported by schema v${FIELD_SCHEMA_VERSION}.`);
  }
}

function validatePosition(value, label, level, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${label} must be a plain object.`);
    return;
  }
  validateExactKeys(value, POSITION_KEYS, label, errors);
  if (!Number.isInteger(value.x) || !Number.isInteger(value.y)) {
    errors.push(`${label} must contain integer coordinates.`);
  } else if (!isInBounds(level, value.x, value.y) || isBlocked(level, value.x, value.y)) {
    errors.push(`${label} must be an open tile in ${level.id}.`);
  }
}

function validateCanonicalIdArray(value, label, authoredIds, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return [];
  }
  const allowed = new Set(authoredIds);
  const seen = new Set();
  let lastIndex = -1;
  for (let index = 0; index < value.length; index += 1) {
    const id = value[index];
    const authoredIndex = authoredIds.indexOf(id);
    if (typeof id !== 'string' || !allowed.has(id)) errors.push(`${label}[${index}] must be an authored ID.`);
    if (seen.has(id)) errors.push(`${label} contains duplicate ID ${id}.`);
    if (authoredIndex <= lastIndex) errors.push(`${label} must use authored order.`);
    seen.add(id);
    lastIndex = authoredIndex;
  }
  return value;
}

function validateContext(context, index, errors) {
  const label = `save.contexts[${index}]`;
  if (!isPlainObject(context)) {
    errors.push(`${label} must be a plain object.`);
    return;
  }
  validateExactKeys(context, CONTEXT_KEYS, label, errors);
  const level = getLevel(context.levelId);
  if (!level) errors.push(`${label}.levelId must be a canonical level ID.`);
  if (typeof context.beatId !== 'string' || !context.beatId.trim()) errors.push(`${label}.beatId must be a non-empty string.`);
  if (!level) return;

  validatePosition(context.position, `${label}.position`, level, errors);
  validatePosition(context.safePosition, `${label}.safePosition`, level, errors);
  if (!FIELD_DIRECTIONS[context.facing]) errors.push(`${label}.facing must be a canonical eight-way direction.`);

  const interactableIds = (level.interactables ?? []).map(({ id }) => id);
  const triggerIds = (level.encounterTriggers ?? []).map(({ id }) => id);
  const encounterIds = [...new Set((level.encounterTriggers ?? []).map(({ encounterId }) => encounterId))];
  const discovered = validateCanonicalIdArray(context.discoveredInteractableIds, `${label}.discoveredInteractableIds`, interactableIds, errors);
  const consumed = validateCanonicalIdArray(context.consumedInteractableIds, `${label}.consumedInteractableIds`, interactableIds, errors);
  validateCanonicalIdArray(context.pendingEncounterTriggerIds, `${label}.pendingEncounterTriggerIds`, triggerIds, errors);
  const triggered = validateCanonicalIdArray(context.triggeredEncounterIds, `${label}.triggeredEncounterIds`, triggerIds, errors);
  validateCanonicalIdArray(context.resolvedEncounterIds, `${label}.resolvedEncounterIds`, encounterIds, errors);
  for (const id of consumed) if (!discovered.includes(id)) errors.push(`${label}.consumedInteractableIds must be discovered first.`);
  for (const id of context.pendingEncounterTriggerIds ?? []) {
    if (!triggered.includes(id)) errors.push(`${label}.pendingEncounterTriggerIds must already be triggered.`);
  }

  if (!Array.isArray(context.armedHazards)) {
    errors.push(`${label}.armedHazards must be an array.`);
  } else {
    const hazardIds = (level.hazards ?? []).map(({ id }) => id);
    const seen = new Set();
    let lastIndex = -1;
    for (let armedIndex = 0; armedIndex < context.armedHazards.length; armedIndex += 1) {
      const armed = context.armedHazards[armedIndex];
      const armedLabel = `${label}.armedHazards[${armedIndex}]`;
      if (!isPlainObject(armed)) {
        errors.push(`${armedLabel} must be a plain object.`);
        continue;
      }
      validateExactKeys(armed, ARMED_HAZARD_KEYS, armedLabel, errors);
      const hazardIndex = hazardIds.indexOf(armed.hazardId);
      if (hazardIndex < 0) errors.push(`${armedLabel}.hazardId must be authored on the level.`);
      if (seen.has(armed.hazardId)) errors.push(`${label}.armedHazards contains a duplicate hazard.`);
      if (hazardIndex <= lastIndex) errors.push(`${label}.armedHazards must use authored order.`);
      if (!Number.isSafeInteger(armed.enteredAtMs) || armed.enteredAtMs < 0 || armed.enteredAtMs > context.elapsedMs) {
        errors.push(`${armedLabel}.enteredAtMs must be within the context clock.`);
      }
      seen.add(armed.hazardId);
      lastIndex = hazardIndex;
    }
  }

  if (!isPlainObject(context.hazardHitCounts)) {
    errors.push(`${label}.hazardHitCounts must be a plain object.`);
  } else {
    const hazardIds = new Set((level.hazards ?? []).map(({ id }) => id));
    for (const [hazardId, count] of Object.entries(context.hazardHitCounts)) {
      if (!hazardIds.has(hazardId)) errors.push(`${label}.hazardHitCounts contains an unknown hazard ID.`);
      if (!Number.isSafeInteger(count) || count <= 0) errors.push(`${label}.hazardHitCounts values must be positive safe integers.`);
    }
  }
  if (!Number.isSafeInteger(context.steps) || context.steps < 0) errors.push(`${label}.steps must be a non-negative safe integer.`);
  if (!Number.isSafeInteger(context.elapsedMs) || context.elapsedMs < 0) errors.push(`${label}.elapsedMs must be a non-negative safe integer.`);
}

function validationResult(ok, value, errors = EMPTY_ARRAY) {
  return Object.freeze({ ok, ...(ok ? { value } : {}), errors: freezeArray(errors) });
}

/** Validate an untrusted v1 save payload and normalize it to a frozen state. */
export function validateFieldPayload(payload) {
  try {
    const errors = [];
    if (!isPlainObject(payload)) return validationResult(false, undefined, ['Save payload must be a plain object.']);
    validateExactKeys(payload, STATE_KEYS, 'save', errors);
    if (payload.schemaVersion !== FIELD_SCHEMA_VERSION) errors.push(`save.schemaVersion must equal ${FIELD_SCHEMA_VERSION}.`);
    if (payload.campaignId !== CAMPAIGN.id) errors.push(`save.campaignId must equal ${CAMPAIGN.id}.`);
    if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) errors.push('save.revision must be a non-negative safe integer.');
    if (!Number.isSafeInteger(payload.totalPlaytimeMs) || payload.totalPlaytimeMs < 0) {
      errors.push('save.totalPlaytimeMs must be a non-negative safe integer.');
    }

    if (!isPlainObject(payload.current)) {
      errors.push('save.current must be a plain object.');
    } else {
      validateExactKeys(payload.current, CURRENT_KEYS, 'save.current', errors);
      if (!getLevel(payload.current.levelId)) errors.push('save.current.levelId must be a canonical level ID.');
      if (typeof payload.current.beatId !== 'string' || !payload.current.beatId.trim()) errors.push('save.current.beatId must be a non-empty string.');
    }

    if (!Array.isArray(payload.flags)) {
      errors.push('save.flags must be an array.');
    } else {
      const normalized = normalizeFlags(payload.flags);
      if (normalized.length !== payload.flags.length || normalized.some((value, index) => value !== payload.flags[index])) {
        errors.push('save.flags must contain unique normalized flags in lexical order.');
      }
    }

    if (!Array.isArray(payload.contexts) || payload.contexts.length === 0) {
      errors.push('save.contexts must be a non-empty array.');
    } else {
      const seen = new Set();
      let prior = null;
      for (let index = 0; index < payload.contexts.length; index += 1) {
        const context = payload.contexts[index];
        validateContext(context, index, errors);
        if (!isPlainObject(context)) continue;
        const key = contextKey(context.levelId, context.beatId);
        if (seen.has(key)) errors.push('save.contexts must contain one state per level/beat pair.');
        if (prior && compareContexts(prior, context) >= 0) errors.push('save.contexts must use canonical level/beat order.');
        seen.add(key);
        prior = context;
      }
      if (isPlainObject(payload.current) && !seen.has(contextKey(payload.current.levelId, payload.current.beatId))) {
        errors.push('save.current must identify a saved field context.');
      }
      const elapsedTotal = payload.contexts.reduce((sum, context) => sum + (Number.isSafeInteger(context?.elapsedMs) ? context.elapsedMs : 0), 0);
      if (Number.isSafeInteger(payload.totalPlaytimeMs) && elapsedTotal !== payload.totalPlaytimeMs) {
        errors.push('save.totalPlaytimeMs must equal the sum of context elapsed time.');
      }
    }

    if (errors.length) return validationResult(false, undefined, errors);
    return validationResult(true, buildState(payload));
  } catch {
    return validationResult(false, undefined, ['Save payload could not be read safely.']);
  }
}

function assertValidState(state) {
  if (BUILT_STATES.has(state)) return state;
  const validation = validateFieldPayload(state);
  if (!validation.ok) throw new TypeError(`Invalid field state: ${validation.errors.join(' ')}`);
  return validation.value;
}

function coordinatesOf(value) {
  if (typeof value === 'string') return parseTileKey(value);
  if (Array.isArray(value)) return { x: Number(value[0]), y: Number(value[1]) };
  if (value?.at) return coordinatesOf(value.at);
  return { x: Number(value?.x), y: Number(value?.y) };
}

function normalizeDirection(direction) {
  const normalized = String(direction ?? '').toLowerCase().replace(/[_ ]+/g, '-');
  const canonical = DIRECTION_ALIASES[normalized] ?? normalized;
  if (!FIELD_DIRECTIONS[canonical]) throw new RangeError(`Unknown field direction: ${direction}`);
  return canonical;
}

function directionForDelta(dx, dy) {
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx === 0 && dy === 0)) {
    throw new RangeError('Field movement delta must be one non-zero eight-way step.');
  }
  return Object.keys(FIELD_DIRECTIONS).find((direction) => {
    const vector = FIELD_DIRECTIONS[direction];
    return vector.dx === dx && vector.dy === dy;
  });
}

function getOpenSpawn(level, requested = undefined) {
  const candidate = requested ? coordinatesOf(requested) : coordinatesOf(level.spawn);
  if (Number.isInteger(candidate.x) && Number.isInteger(candidate.y) && !isBlocked(level, candidate.x, candidate.y)) return candidate;
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) if (!isBlocked(level, x, y)) return { x, y };
  }
  throw new Error(`Level ${level.id} has no open field tile.`);
}

function interactablesNear(level, position, range = 1) {
  return (level.interactables ?? [])
    .map((item, index) => {
      const at = coordinatesOf(item.at);
      const dx = Math.abs(at.x - position.x);
      const dy = Math.abs(at.y - position.y);
      return { item, index, at, distance: Math.max(dx, dy) };
    })
    .filter(({ distance }) => distance <= range)
    .sort((left, right) => left.distance - right.distance || left.index - right.index);
}

function discoverNearby(level, context, events = []) {
  const discovered = new Set(context.discoveredInteractableIds);
  for (const { item } of interactablesNear(level, context.position)) {
    if (!discovered.has(item.id)) {
      discovered.add(item.id);
      events.push({ type: 'interactable-discovered', interactableId: item.id, at: item.at });
    }
  }
  return { ...context, discoveredInteractableIds: [...discovered] };
}

function createContext(level, beatId, options = {}) {
  const position = getOpenSpawn(level, options.position);
  const requestedFacing = options.facing ?? level.spawn?.facing ?? 'south';
  const facing = normalizeDirection(requestedFacing);
  return discoverNearby(level, {
    levelId: level.id,
    beatId,
    position,
    facing,
    safePosition: position,
    discoveredInteractableIds: [],
    consumedInteractableIds: [],
    pendingEncounterTriggerIds: [],
    triggeredEncounterIds: [],
    resolvedEncounterIds: [],
    armedHazards: [],
    hazardHitCounts: {},
    steps: 0,
    elapsedMs: 0,
  });
}

/** Create a pristine field save at a canonical level. */
export function createFieldState(options = {}) {
  const level = getLevel(options.levelId) ?? LEVELS.find(({ kind }) => kind === 'field') ?? LEVELS[0];
  if (!level) throw new Error('Field content must provide at least one level.');
  if (options.levelId && level.id !== options.levelId) throw new RangeError(`Unknown level ID: ${options.levelId}`);
  const beatId = options.beatId ?? 'unbound';
  if (typeof beatId !== 'string' || !beatId.trim()) throw new TypeError('beatId must be a non-empty string.');
  const context = createContext(level, beatId, options);
  return buildState({
    current: { levelId: level.id, beatId },
    contexts: [context],
    flags: normalizeFlags(options.flags),
    totalPlaytimeMs: 0,
    revision: 0,
  });
}

function contextIndex(state, levelId = state.current.levelId, beatId = state.current.beatId) {
  return state.contexts.findIndex((context) => context.levelId === levelId && context.beatId === beatId);
}

/** Return the immutable current level/beat record. */
export function getCurrentFieldContext(state) {
  const snapshot = assertValidState(state);
  return snapshot.contexts[contextIndex(snapshot)];
}

function replaceContext(state, context, overrides = {}) {
  const index = contextIndex(state, context.levelId, context.beatId);
  const contexts = [...state.contexts];
  if (index < 0) contexts.push(context);
  else contexts[index] = context;
  return buildState({
    current: overrides.current ?? state.current,
    contexts,
    flags: overrides.flags ?? state.flags,
    totalPlaytimeMs: overrides.totalPlaytimeMs ?? state.totalPlaytimeMs,
    revision: overrides.revision ?? state.revision + 1,
  });
}

/** Enter a level/beat context, restoring it when previously visited. */
export function enterField(state, levelId, beatId = 'unbound', options = {}) {
  const snapshot = assertValidState(state);
  const level = getLevel(levelId);
  if (!level) throw new RangeError(`Unknown level ID: ${levelId}`);
  if (typeof beatId !== 'string' || !beatId.trim()) throw new TypeError('beatId must be a non-empty string.');
  const flags = normalizeFlags(snapshot.flags, options.flags);
  const existingIndex = contextIndex(snapshot, levelId, beatId);
  const sameCurrent = snapshot.current.levelId === levelId && snapshot.current.beatId === beatId;
  const sameFlags = flags.length === snapshot.flags.length && flags.every((value, index) => value === snapshot.flags[index]);
  if (existingIndex >= 0 && sameCurrent && sameFlags) return snapshot;
  const contexts = [...snapshot.contexts];
  if (existingIndex < 0) contexts.push(createContext(level, beatId, options));
  return buildState({
    current: { levelId, beatId },
    contexts,
    flags,
    totalPlaytimeMs: snapshot.totalPlaytimeMs,
    revision: snapshot.revision + 1,
  });
}

/** Add normalized story, inventory, or battle flags without coupling modules. */
export function grantFieldFlags(state, flags) {
  const snapshot = assertValidState(state);
  const merged = normalizeFlags(snapshot.flags, flags);
  if (merged.length === snapshot.flags.length && merged.every((value, index) => value === snapshot.flags[index])) return snapshot;
  return buildState({ ...snapshot, flags: merged, revision: snapshot.revision + 1 });
}

function combinedFlagSet(state, externalFlags) {
  return collectFlags(state.flags, externalFlags);
}

function atomComplete(atom, context, flags) {
  if (atom.type === 'interaction') return context.consumedInteractableIds.includes(atom.id);
  if (atom.type === 'encounter') {
    const encounterId = normalizeFlag(atom.id);
    return context.resolvedEncounterIds.includes(atom.id)
      || flags.has(encounterId)
      || flags.has(`${encounterId}-cleared`);
  }
  return flags.has(normalizeFlag(atom.id));
}

function expressionComplete(rule, context, flags) {
  const values = rule.items.map((item) => atomComplete(item, context, flags));
  return rule.mode === 'any' ? values.some(Boolean) : values.every(Boolean);
}

function conditionRule(condition) {
  const normalized = normalizeFlag(condition);
  return CONDITION_RULES[normalized] ?? all(flag(normalized, String(condition || 'Complete the story requirement')));
}

function isConditionSatisfied(condition, context, flags) {
  if (!condition) return true;
  const normalized = normalizeFlag(condition);
  return flags.has(normalized) || expressionComplete(conditionRule(normalized), context, flags);
}

function exitView(exit, context, flags) {
  const rule = conditionRule(exit.condition);
  return Object.freeze({
    id: exit.id,
    at: exit.at,
    destinationLevelId: exit.destinationLevelId,
    condition: exit.condition ?? null,
    ready: isConditionSatisfied(exit.condition, context, flags),
    requirements: Object.freeze(rule.items.map((item) => Object.freeze({
      ...item,
      complete: atomComplete(item, context, flags),
    }))),
    mode: rule.mode,
  });
}

function conditionMissing(requirement, flags) {
  if (!requirement) return null;
  const normalized = normalizeFlag(requirement);
  return flags.has(normalized) ? null : normalized;
}

/** Return interactables within Chebyshev range, closest/authored first. */
export function getNearbyInteractables(state, options = {}) {
  const snapshot = assertValidState(state);
  const context = getCurrentFieldContext(snapshot);
  const level = getLevel(context.levelId);
  const range = options.range ?? 1;
  if (!Number.isInteger(range) || range < 0) throw new RangeError('Interaction range must be a non-negative integer.');
  const flags = combinedFlagSet(snapshot, options.flags);
  return Object.freeze(interactablesNear(level, context.position, range).map(({ item, at, distance }) => {
    const missing = conditionMissing(item.requires, flags);
    return deepFreezeCopy({
      ...item,
      at: tileKey(at.x, at.y),
      distance,
      discovered: context.discoveredInteractableIds.includes(item.id),
      consumed: context.consumedInteractableIds.includes(item.id),
      available: missing === null,
      blockedBy: missing,
    });
  }));
}

const PAST_ACTIONS = Object.freeze({
  inspect: 'inspected',
  loot: 'looted',
  talk: 'talked',
  unlock: 'unlocked',
  checkpoint: 'checkpointed',
  pull: 'pulled',
  exit: 'exited',
  open: 'opened',
  listen: 'listened',
  receive: 'received',
  deliver: 'delivered',
  record: 'recorded',
  'compare-records': 'compared',
  'inspect-cipher': 'inspected',
  bargain: 'accepted',
  read: 'read',
  'choose-support': 'chosen',
  'choose-route': 'chosen',
  'support-task': 'completed',
  'dispatch-copy': 'departed',
  'story-choice': 'chosen',
  'share-supplies': 'shared',
  'confirm-contribution': 'confirmed',
  'confront-with-copies': 'completed',
  'refuse-offer': 'refused',
  'break-node': 'broken',
  'deliver-supplies': 'delivered',
  light: 'lit',
});

function producedInteractionFlags(item, selectedOption) {
  const produced = collectFlags(item.id, item.result, item.reward, item.contribution, item.route, item.option, selectedOption);
  const action = normalizeFlag(item.action);
  if (action) produced.add(`${action}-${normalizeFlag(item.id)}`);
  const past = PAST_ACTIONS[item.action];
  if (past) produced.add(`${normalizeFlag(item.id)}-${past}`);
  if (item.contribution) produced.add(`${normalizeFlag(item.contribution)}-confirmed`);
  return [...produced];
}

/** Consume one nearby authored interaction and emit its UI-ready result. */
export function interactField(state, interactableId = undefined, options = {}) {
  const snapshot = assertValidState(state);
  const context = getCurrentFieldContext(snapshot);
  const level = getLevel(context.levelId);
  const nearby = interactablesNear(level, context.position, options.range ?? 1);
  const selected = interactableId
    ? nearby.find(({ item }) => item.id === interactableId)
    : nearby.find(({ item }) => !context.consumedInteractableIds.includes(item.id)) ?? nearby[0];
  if (!selected) {
    const authored = interactableId && (level.interactables ?? []).some(({ id }) => id === interactableId);
    return Object.freeze({
      state: snapshot,
      ok: false,
      code: authored ? 'out-of-range' : interactableId ? 'unknown-interactable' : 'nothing-nearby',
      events: EMPTY_ARRAY,
    });
  }

  const { item } = selected;
  const flags = combinedFlagSet(snapshot, options.flags);
  const missing = conditionMissing(item.requires, flags);
  if (missing) {
    return Object.freeze({
      state: snapshot,
      ok: false,
      code: 'requirement-missing',
      blockedBy: missing,
      interaction: deepFreezeCopy(item),
      events: freezeEvents([{ type: 'interaction-blocked', interactableId: item.id, requirement: missing }]),
    });
  }

  let selectedOption = options.choice ?? item.option ?? null;
  if (item.options) {
    if (selectedOption === null) {
      return Object.freeze({
        state: snapshot,
        ok: false,
        code: 'choice-required',
        choices: freezeArray(item.options),
        interaction: deepFreezeCopy(item),
        events: EMPTY_ARRAY,
      });
    }
    if (!item.options.includes(selectedOption)) throw new RangeError(`Unknown choice ${selectedOption} for ${item.id}.`);
  }

  if (context.consumedInteractableIds.includes(item.id)) {
    return Object.freeze({
      state: snapshot,
      ok: true,
      repeated: true,
      interaction: deepFreezeCopy(item),
      producedFlags: EMPTY_ARRAY,
      events: freezeEvents([{ type: 'interaction-repeat', interactableId: item.id, text: item.text ?? null }]),
    });
  }

  const consumed = [...context.consumedInteractableIds, item.id];
  const discovered = context.discoveredInteractableIds.includes(item.id)
    ? context.discoveredInteractableIds
    : [...context.discoveredInteractableIds, item.id];
  const producedFlags = producedInteractionFlags(item, selectedOption);
  const nextFlags = normalizeFlags(snapshot.flags, producedFlags);
  const nextContext = {
    ...context,
    discoveredInteractableIds: discovered,
    consumedInteractableIds: consumed,
  };
  const nextState = replaceContext(snapshot, nextContext, { flags: nextFlags });
  const event = {
    type: 'interaction-complete',
    interactableId: item.id,
    action: item.action,
    selectedOption,
    text: item.text ?? null,
    result: item.result ?? null,
    reward: item.reward ?? null,
    saves: Boolean(item.saves),
    restores: Boolean(item.restores),
    producedFlags,
  };
  return Object.freeze({
    state: nextState,
    ok: true,
    repeated: false,
    interaction: deepFreezeCopy(item),
    producedFlags: freezeArray(normalizeFlags(producedFlags)),
    events: freezeEvents([event]),
  });
}

function tileInList(position, tiles = []) {
  return tiles.includes(tileKey(position.x, position.y));
}

function incrementHazardHit(context, hazard) {
  return {
    ...context,
    hazardHitCounts: {
      ...context.hazardHitCounts,
      [hazard.id]: (context.hazardHitCounts[hazard.id] ?? 0) + 1,
    },
  };
}

function applyHazardHit(context, hazard, events) {
  let next = incrementHazardHit(context, hazard);
  const returnTarget = hazard.effect?.returnTo ?? hazard.effect?.target;
  if (returnTarget === 'prior-safe-landing') next = { ...next, position: next.safePosition };
  events.push({
    type: 'hazard-hit',
    hazardId: hazard.id,
    effect: hazard.effect ?? null,
    cue: hazard.cue ?? null,
    returnedTo: returnTarget === 'prior-safe-landing' ? next.safePosition : null,
  });
  return next;
}

function processCycleHazards(level, context, oldTime, newTime, events) {
  let next = context;
  for (const hazard of level.hazards ?? []) {
    if (hazard.trigger !== 'cycle' || !Number.isSafeInteger(hazard.periodMs) || hazard.periodMs <= 0) continue;
    const firstCycle = Math.floor(oldTime / hazard.periodMs) + 1;
    const finalCycle = Math.floor(newTime / hazard.periodMs);
    const warningMs = Math.max(0, hazard.warningMs ?? 0);
    for (let cycle = firstCycle; cycle <= finalCycle; cycle += 1) {
      const warningAt = cycle * hazard.periodMs - warningMs;
      if (warningMs && warningAt > oldTime && warningAt <= newTime) {
        events.push({ type: 'hazard-warning', hazardId: hazard.id, impactAtMs: cycle * hazard.periodMs, cue: hazard.cue ?? null });
      }
      if (tileInList(next.position, hazard.tiles)) next = applyHazardHit(next, hazard, events);
    }
    if (finalCycle < firstCycle && warningMs) {
      const nextImpact = (Math.floor(oldTime / hazard.periodMs) + 1) * hazard.periodMs;
      const warningAt = nextImpact - warningMs;
      if (warningAt > oldTime && warningAt <= newTime) {
        events.push({ type: 'hazard-warning', hazardId: hazard.id, impactAtMs: nextImpact, cue: hazard.cue ?? null });
      }
    }
  }
  return next;
}

function processDelayedHazards(level, context, oldTime, newTime, events) {
  let next = context;
  const retained = [];
  for (const armed of context.armedHazards) {
    const hazard = (level.hazards ?? []).find(({ id }) => id === armed.hazardId);
    const hitAt = armed.enteredAtMs + (hazard?.delayMs ?? 0);
    if (hazard && oldTime < hitAt && newTime >= hitAt && tileInList(next.position, hazard.tiles)) {
      next = applyHazardHit(next, hazard, events);
    } else if (hazard && tileInList(next.position, hazard.tiles)) {
      retained.push(armed);
    }
  }
  return { ...next, armedHazards: retained };
}

/** Advance deterministic field/playtime clocks and resolve timed hazards. */
export function advanceFieldTime(state, elapsedMs, options = {}) {
  const snapshot = assertValidState(state);
  if (!Number.isSafeInteger(elapsedMs) || elapsedMs < 0) throw new RangeError('elapsedMs must be a non-negative safe integer.');
  if (elapsedMs === 0) return Object.freeze({ state: snapshot, events: EMPTY_ARRAY });
  const context = getCurrentFieldContext(snapshot);
  const level = getLevel(context.levelId);
  const oldTime = context.elapsedMs;
  const newTime = oldTime + elapsedMs;
  if (!Number.isSafeInteger(newTime) || !Number.isSafeInteger(snapshot.totalPlaytimeMs + elapsedMs)) {
    throw new RangeError('Field playtime exceeds the safe integer range.');
  }
  const events = [];
  let nextContext = { ...context, elapsedMs: newTime };
  nextContext = processCycleHazards(level, nextContext, oldTime, newTime, events);
  nextContext = processDelayedHazards(level, nextContext, oldTime, newTime, events);
  const nextState = replaceContext(snapshot, nextContext, { totalPlaytimeMs: snapshot.totalPlaytimeMs + elapsedMs });
  return Object.freeze({ state: nextState, events: freezeEvents(events) });
}

function collisionReason(level, from, vector) {
  const target = { x: from.x + vector.dx, y: from.y + vector.dy };
  if (!isInBounds(level, target.x, target.y)) return 'boundary';
  if (isBlocked(level, target.x, target.y)) return 'blocked-tile';
  if (vector.dx !== 0 && vector.dy !== 0) {
    if (isBlocked(level, from.x + vector.dx, from.y) || isBlocked(level, from.x, from.y + vector.dy)) return 'diagonal-corner';
  }
  return null;
}

function encounterEventsOnEntry(level, context, events) {
  const pending = new Set(context.pendingEncounterTriggerIds);
  const triggered = new Set(context.triggeredEncounterIds);
  for (const trigger of level.encounterTriggers ?? []) {
    if (!tileInList(context.position, trigger.tiles)) continue;
    if (pending.has(trigger.id)) continue;
    if (trigger.once && triggered.has(trigger.id)) continue;
    pending.add(trigger.id);
    triggered.add(trigger.id);
    events.push({ type: 'encounter-triggered', triggerId: trigger.id, encounterId: trigger.encounterId, once: Boolean(trigger.once) });
  }
  return { ...context, pendingEncounterTriggerIds: [...pending], triggeredEncounterIds: [...triggered] };
}

function hazardsOnEntry(level, context, flags, events) {
  let next = context;
  const armed = new Map(context.armedHazards.map((entry) => [entry.hazardId, entry]));
  for (const hazard of level.hazards ?? []) {
    if (!tileInList(next.position, hazard.tiles)) continue;
    if (hazard.trigger === 'onEnterDelay') {
      if (!armed.has(hazard.id)) {
        armed.set(hazard.id, { hazardId: hazard.id, enteredAtMs: next.elapsedMs });
        events.push({
          type: 'hazard-armed',
          hazardId: hazard.id,
          impactAtMs: next.elapsedMs + (hazard.delayMs ?? 0),
          cue: hazard.cue ?? null,
        });
      }
    } else if (hazard.trigger === 'onEnterConditional' && isConditionSatisfied(hazard.condition, next, flags)) {
      next = applyHazardHit(next, hazard, events);
    }
  }
  const retained = [...armed.values()].filter((entry) => {
    const hazard = (level.hazards ?? []).find(({ id }) => id === entry.hazardId);
    return hazard && tileInList(next.position, hazard.tiles);
  });
  return { ...next, armedHazards: retained };
}

function exitEventsAtPosition(level, context, flags, events) {
  for (const exit of level.exits ?? []) {
    if (exit.at !== tileKey(context.position.x, context.position.y)) continue;
    const ready = isConditionSatisfied(exit.condition, context, flags);
    events.push({
      type: ready ? 'exit-ready' : 'exit-locked',
      exitId: exit.id,
      destinationLevelId: exit.destinationLevelId,
      condition: exit.condition ?? null,
    });
  }
}

/** Attempt one exact eight-way step. Diagonals cannot cut blocked corners. */
export function moveField(state, direction, options = {}) {
  const canonicalDirection = normalizeDirection(direction);
  const vector = FIELD_DIRECTIONS[canonicalDirection];
  let snapshot = assertValidState(state);
  const events = [];
  if (options.elapsedMs !== undefined) {
    const tick = advanceFieldTime(snapshot, options.elapsedMs, options);
    snapshot = tick.state;
    events.push(...tick.events);
  }
  const context = getCurrentFieldContext(snapshot);
  const level = getLevel(context.levelId);
  const reason = collisionReason(level, context.position, vector);
  if (reason) {
    events.push({ type: 'movement-blocked', reason, direction: canonicalDirection, from: context.position });
    return Object.freeze({
      state: snapshot,
      moved: false,
      events: freezeEvents(events),
      position: context.position,
    });
  }

  const target = { x: context.position.x + vector.dx, y: context.position.y + vector.dy };
  events.push({ type: 'moved', direction: canonicalDirection, from: context.position, to: target });
  let nextContext = {
    ...context,
    position: target,
    facing: canonicalDirection,
    steps: context.steps + 1,
    armedHazards: [],
  };
  const hazardsAtTarget = (level.hazards ?? []).filter((hazard) => tileInList(target, hazard.tiles));
  if (hazardsAtTarget.length === 0) nextContext.safePosition = target;
  nextContext = discoverNearby(level, nextContext, events);
  const flags = combinedFlagSet(snapshot, options.flags);
  nextContext = hazardsOnEntry(level, nextContext, flags, events);
  nextContext = encounterEventsOnEntry(level, nextContext, events);
  exitEventsAtPosition(level, nextContext, flags, events);
  const nextState = replaceContext(snapshot, nextContext);
  return Object.freeze({
    state: nextState,
    moved: true,
    events: freezeEvents(events),
    position: getCurrentFieldContext(nextState).position,
  });
}

/** Attempt one exact step expressed as integer deltas. */
export function moveFieldBy(state, dx, dy, options = {}) {
  return moveField(state, directionForDelta(dx, dy), options);
}

/** Mark a pending placed encounter complete and grant battle-result flags. */
export function resolveFieldEncounter(state, encounterOrTriggerId, options = {}) {
  const snapshot = assertValidState(state);
  const context = getCurrentFieldContext(snapshot);
  const level = getLevel(context.levelId);
  const trigger = (level.encounterTriggers ?? []).find(({ id, encounterId }) => id === encounterOrTriggerId || encounterId === encounterOrTriggerId);
  if (!trigger) return Object.freeze({ state: snapshot, ok: false, code: 'unknown-encounter', events: EMPTY_ARRAY });
  const pending = context.pendingEncounterTriggerIds.includes(trigger.id);
  if (!pending && !options.allowUntriggered) {
    if (context.resolvedEncounterIds.includes(trigger.encounterId)) {
      return Object.freeze({ state: snapshot, ok: true, repeated: true, events: EMPTY_ARRAY });
    }
    return Object.freeze({ state: snapshot, ok: false, code: 'encounter-not-pending', events: EMPTY_ARRAY });
  }
  const pendingIds = context.pendingEncounterTriggerIds.filter((id) => {
    const candidate = (level.encounterTriggers ?? []).find((entry) => entry.id === id);
    return candidate?.encounterId !== trigger.encounterId;
  });
  const triggered = context.triggeredEncounterIds.includes(trigger.id)
    ? context.triggeredEncounterIds
    : [...context.triggeredEncounterIds, trigger.id];
  const resolved = context.resolvedEncounterIds.includes(trigger.encounterId)
    ? context.resolvedEncounterIds
    : [...context.resolvedEncounterIds, trigger.encounterId];
  const grantedFlags = normalizeFlags(`${trigger.encounterId}-cleared`, options.flags);
  const nextContext = {
    ...context,
    pendingEncounterTriggerIds: pendingIds,
    triggeredEncounterIds: triggered,
    resolvedEncounterIds: resolved,
  };
  const nextState = replaceContext(snapshot, nextContext, { flags: normalizeFlags(snapshot.flags, grantedFlags) });
  return Object.freeze({
    state: nextState,
    ok: true,
    repeated: false,
    grantedFlags: freezeArray(grantedFlags),
    events: freezeEvents([{ type: 'encounter-resolved', triggerId: trigger.id, encounterId: trigger.encounterId, grantedFlags }]),
  });
}

/** Query the authored objective, its atomic dependencies, and every exit. */
export function getFieldObjectiveProgress(state, options = {}) {
  const snapshot = assertValidState(state);
  const context = getCurrentFieldContext(snapshot);
  const level = getLevel(context.levelId);
  const flags = combinedFlagSet(snapshot, options.flags);
  const exits = Object.freeze((level.exits ?? []).map((exit) => exitView(exit, context, flags)));
  const fallbackRule = FINAL_LEVEL_RULES[level.id]
    ?? all(...(level.interactables ?? []).filter((item) => !item.optional).map((item) => interaction(item.id, `Complete ${item.id}`)));
  const rules = exits.length ? exits.map((exit) => conditionRule(exit.condition)) : [fallbackRule];
  const atoms = [];
  const seen = new Set();
  for (const rule of rules) {
    for (const atom of rule.items) {
      const key = `${atom.type}:${atom.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        atoms.push(Object.freeze({ ...atom, complete: atomComplete(atom, context, flags) }));
      }
    }
  }
  const completed = exits.length
    ? exits.some(({ ready }) => ready)
    : expressionComplete(fallbackRule, context, flags);
  const completedCount = atoms.filter(({ complete }) => complete).length;
  return Object.freeze({
    levelId: level.id,
    text: level.objective,
    completed,
    completedCount,
    totalCount: atoms.length,
    requirements: Object.freeze(atoms),
    exits,
  });
}

/** Use an exit while standing exactly on its tile. Transition is opt-in. */
export function useFieldExit(state, exitId = undefined, options = {}) {
  const snapshot = assertValidState(state);
  const context = getCurrentFieldContext(snapshot);
  const level = getLevel(context.levelId);
  const at = tileKey(context.position.x, context.position.y);
  const exit = exitId
    ? (level.exits ?? []).find(({ id }) => id === exitId)
    : (level.exits ?? []).find((candidate) => candidate.at === at);
  if (!exit) return Object.freeze({ state: snapshot, ok: false, code: exitId ? 'unknown-exit' : 'no-exit-here', events: EMPTY_ARRAY });
  if (exit.at !== at) return Object.freeze({ state: snapshot, ok: false, code: 'not-at-exit', events: EMPTY_ARRAY });
  const flags = combinedFlagSet(snapshot, options.flags);
  if (!isConditionSatisfied(exit.condition, context, flags)) {
    return Object.freeze({
      state: snapshot,
      ok: false,
      code: 'exit-locked',
      condition: exit.condition ?? null,
      events: freezeEvents([{ type: 'exit-locked', exitId: exit.id, destinationLevelId: exit.destinationLevelId, condition: exit.condition ?? null }]),
    });
  }
  const transition = Object.freeze({ exitId: exit.id, fromLevelId: level.id, destinationLevelId: exit.destinationLevelId });
  const nextState = options.enterDestination && getLevel(exit.destinationLevelId)
    ? enterField(snapshot, exit.destinationLevelId, options.destinationBeatId ?? context.beatId, options)
    : snapshot;
  return Object.freeze({
    state: nextState,
    ok: true,
    transition,
    events: freezeEvents([{ type: 'exit-used', ...transition }]),
  });
}

function activeHazardViews(level, context) {
  return Object.freeze((level.hazards ?? []).map((hazard) => {
    const onTile = tileInList(context.position, hazard.tiles);
    const armed = context.armedHazards.find(({ hazardId }) => hazardId === hazard.id);
    const cyclePositionMs = hazard.trigger === 'cycle' && hazard.periodMs ? context.elapsedMs % hazard.periodMs : null;
    const warning = cyclePositionMs !== null && hazard.warningMs
      ? cyclePositionMs >= hazard.periodMs - hazard.warningMs
      : false;
    return deepFreezeCopy({
      id: hazard.id,
      trigger: hazard.trigger,
      onTile,
      armed: Boolean(armed),
      remainingMs: armed ? Math.max(0, armed.enteredAtMs + (hazard.delayMs ?? 0) - context.elapsedMs) : null,
      cyclePositionMs,
      warning,
      hits: context.hazardHitCounts[hazard.id] ?? 0,
      cue: hazard.cue ?? null,
      effect: hazard.effect ?? null,
    });
  }));
}

/** Return one render-friendly field snapshot without exposing mutable state. */
export function getFieldStatus(state, options = {}) {
  const snapshot = assertValidState(state);
  const context = getCurrentFieldContext(snapshot);
  const level = getLevel(context.levelId);
  const flags = combinedFlagSet(snapshot, options.flags);
  const exit = (level.exits ?? []).find(({ at }) => at === tileKey(context.position.x, context.position.y));
  return Object.freeze({
    level: Object.freeze({ id: level.id, name: level.name, chapterId: level.chapterId, kind: level.kind, width: level.width, height: level.height }),
    beatId: context.beatId,
    position: context.position,
    facing: context.facing,
    safePosition: context.safePosition,
    steps: context.steps,
    elapsedMs: context.elapsedMs,
    totalPlaytimeMs: snapshot.totalPlaytimeMs,
    nearbyInteractables: getNearbyInteractables(snapshot, options),
    pendingEncounters: Object.freeze(context.pendingEncounterTriggerIds.map((triggerId) => {
      const trigger = (level.encounterTriggers ?? []).find(({ id }) => id === triggerId);
      return Object.freeze({ triggerId, encounterId: trigger.encounterId });
    })),
    hazards: activeHazardViews(level, context),
    exit: exit ? exitView(exit, context, flags) : null,
    objective: getFieldObjectiveProgress(snapshot, options),
    flags: snapshot.flags,
  });
}

export function serializeFieldState(state) {
  return JSON.stringify(assertValidState(state));
}

export function loadFieldState(serializedOrPayload) {
  if (typeof serializedOrPayload === 'string') {
    try {
      return validateFieldPayload(JSON.parse(serializedOrPayload));
    } catch {
      return validationResult(false, undefined, ['Save payload is not valid JSON.']);
    }
  }
  return validateFieldPayload(serializedOrPayload);
}

function resolveDefaultStorage() {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

/** No-throw localStorage adapter suitable for browsers and injected tests. */
export function createFieldStorageAdapter(storage = undefined, key = DEFAULT_FIELD_SAVE_KEY) {
  if (typeof key !== 'string' || !key.trim()) throw new TypeError('Save key must be a non-empty string.');
  const target = storage === undefined ? resolveDefaultStorage() : storage;
  const available = Boolean(target
    && typeof target.getItem === 'function'
    && typeof target.setItem === 'function'
    && typeof target.removeItem === 'function');
  const result = (ok, properties = {}) => Object.freeze({ ok, ...properties });
  const unavailable = () => result(false, { code: 'storage-unavailable' });
  return Object.freeze({
    key,
    available,
    save(state) {
      const validation = validateFieldPayload(state);
      if (!validation.ok) return result(false, { code: 'invalid-state', errors: validation.errors });
      if (!available) return unavailable();
      try {
        target.setItem(key, JSON.stringify(validation.value));
        return result(true);
      } catch {
        return result(false, { code: 'storage-write-failed' });
      }
    },
    load(options = {}) {
      if (!available) return unavailable();
      try {
        const raw = target.getItem(key);
        if (raw === null) return result(true, { found: false, state: createFieldState(options) });
        const loaded = loadFieldState(raw);
        if (!loaded.ok) return result(false, { code: 'invalid-save', errors: loaded.errors });
        return result(true, { found: true, state: loaded.value });
      } catch {
        return result(false, { code: 'storage-read-failed' });
      }
    },
    clear() {
      if (!available) return unavailable();
      try {
        target.removeItem(key);
        return result(true);
      } catch {
        return result(false, { code: 'storage-clear-failed' });
      }
    },
  });
}
