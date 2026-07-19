/**
 * Executable exact-movement witness for every canonical witness-stage task.
 *
 * Each stage begins in a fresh authored field context and reaches its ordered
 * task nodes only through the public one-step field runtime. No coordinate
 * jump or elapsed-time sample is permitted.
 */

import { getLevel, isBlocked, parseTileKey, tileKey } from './content/levels.mjs';
import {
  createFieldState,
  getCurrentFieldContext,
  moveFieldBy,
} from './field-runtime.mjs';
import {
  WITNESS_STAGE_FIELDWORK,
  validateWitnessStageFieldwork,
} from './witness-stage-fieldwork.mjs';

export const WITNESS_FIELDWORK_RUN_VERSION = 1;

const DELTAS = Object.freeze([
  [0, -1], [1, 0], [0, 1], [-1, 0],
  [1, -1], [1, 1], [-1, 1], [-1, -1],
]);

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function signatureFor(value) {
  return `fnv1a32:${fnv1a32(JSON.stringify(value))}`;
}

function pointOf(value) {
  if (typeof value === 'string') return { ...parseTileKey(value), key: value };
  return { x: Number(value?.x), y: Number(value?.y), key: tileKey(value?.x, value?.y) };
}

function isOpen(level, point) {
  return Number.isInteger(point.x) && Number.isInteger(point.y) && !isBlocked(level, point.x, point.y);
}

function legalNeighbors(level, value) {
  const origin = pointOf(value);
  return DELTAS.flatMap(([dx, dy]) => {
    const target = pointOf({ x: origin.x + dx, y: origin.y + dy });
    if (!isOpen(level, target)) return [];
    if (dx !== 0 && dy !== 0
      && (!isOpen(level, { x: origin.x + dx, y: origin.y })
        || !isOpen(level, { x: origin.x, y: origin.y + dy }))) return [];
    return [target];
  });
}

function shortestPath(level, destination) {
  const start = pointOf(level.spawn);
  const target = pointOf(destination);
  const parent = new Map([[start.key, null]]);
  const queue = [start];
  while (queue.length && !parent.has(target.key)) {
    const current = queue.shift();
    for (const next of legalNeighbors(level, current)) {
      if (parent.has(next.key)) continue;
      parent.set(next.key, current.key);
      queue.push(next);
    }
  }
  if (!parent.has(target.key)) throw new Error(`${level.id} cannot reach fieldwork destination ${target.key}.`);
  const reversed = [];
  for (let cursor = target.key; cursor != null; cursor = parent.get(cursor)) reversed.push(cursor);
  return reversed.reverse();
}

function positiveBound(value, fallback, name) {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1) throw new RangeError(`${name} must be a positive safe integer.`);
  return resolved;
}

/** Execute every fieldwork stage through exact public runtime movement. */
export function runWitnessFieldworkTraversal(options = {}) {
  const catalog = options.catalog ?? WITNESS_STAGE_FIELDWORK;
  const validation = validateWitnessStageFieldwork(catalog);
  if (!validation.ok) throw new Error(`Invalid witness fieldwork: ${validation.errors.join(' ')}`);
  const maxStages = positiveBound(options.maxStages, 100, 'maxStages');
  const maxMovementSteps = positiveBound(options.maxMovementSteps, 2_000, 'maxMovementSteps');
  if (catalog.length > maxStages) throw new Error(`Witness fieldwork exceeds the ${maxStages}-stage bound.`);

  let exactMovementSteps = 0;
  let completedNodeCount = 0;
  let movementEventCount = 0;
  const stages = [];

  for (const entry of catalog) {
    const level = getLevel(entry.mapId);
    const path = shortestPath(level, entry.nodes.at(-1).at);
    const expectedNodeIdsByPosition = new Map(entry.nodes.map((node) => [node.at, node.id]));
    const completedNodeIds = [];
    let fieldState = createFieldState({ levelId: entry.mapId, beatId: `fieldwork:${entry.stageId}` });
    const startContext = getCurrentFieldContext(fieldState);
    if (tileKey(startContext.position.x, startContext.position.y) !== path[0]) {
      throw new Error(`${entry.stageId} did not begin at its authored spawn.`);
    }

    for (let index = 1; index < path.length; index += 1) {
      if (exactMovementSteps >= maxMovementSteps) {
        throw new Error(`Witness fieldwork exceeded the ${maxMovementSteps}-movement bound.`);
      }
      const from = pointOf(path[index - 1]);
      const to = pointOf(path[index]);
      const moved = moveFieldBy(fieldState, to.x - from.x, to.y - from.y);
      if (!moved.moved || moved.position.x !== to.x || moved.position.y !== to.y) {
        throw new Error(`${entry.stageId} failed exact movement from ${from.key} to ${to.key}.`);
      }
      fieldState = moved.state;
      exactMovementSteps += 1;
      movementEventCount += moved.events.filter(({ type }) => type === 'moved').length;
      const nodeId = expectedNodeIdsByPosition.get(to.key);
      if (nodeId) completedNodeIds.push(nodeId);
    }

    const context = getCurrentFieldContext(fieldState);
    const expectedNodeIds = entry.nodes.map(({ id }) => id);
    if (JSON.stringify(completedNodeIds) !== JSON.stringify(expectedNodeIds)) {
      throw new Error(`${entry.stageId} did not reach every task node in canonical order.`);
    }
    if (context.steps !== path.length - 1 || context.elapsedMs !== 0 || fieldState.totalPlaytimeMs !== 0) {
      throw new Error(`${entry.stageId} traversal counters are inconsistent or contain elapsed time.`);
    }
    completedNodeCount += completedNodeIds.length;
    stages.push({
      chronicleId: entry.chronicleId,
      stageId: entry.stageId,
      mapId: entry.mapId,
      startAt: path[0],
      finalAt: path.at(-1),
      exactMovementSteps: context.steps,
      completedNodeIds,
      path,
      recordedPlaytimeMs: 0,
    });
  }

  if (movementEventCount !== exactMovementSteps) throw new Error('Exact movement did not emit one moved event per step.');
  const summary = {
    stageCount: stages.length,
    completedStageCount: stages.length,
    nodeCount: catalog.flatMap(({ nodes }) => nodes).length,
    completedNodeCount,
    exactMovementSteps,
    movementEventCount,
    coordinateJumpCount: 0,
    recordedPlaytimeMs: 0,
    elapsedTimeClaimed: false,
  };
  const signature = signatureFor({ catalog, stages, summary });
  return deepFreeze({
    ok: true,
    version: WITNESS_FIELDWORK_RUN_VERSION,
    signature,
    catalogSignature: signatureFor(catalog),
    summary,
    stages,
  });
}
