/**
 * Deterministic, forward-only field task placement for every witness-chronicle stage.
 *
 * Nodes add no story facts. Their final instruction is either the stage's
 * authored activity instruction or, for combat, the exact encounter objective.
 */

import { getEncounter } from './content/encounters.mjs';
import {
  WITNESS_CHRONICLES,
  getWitnessChronicleMetrics,
} from './content/witness-chronicles.mjs';
import {
  getLevel,
  isBlocked,
  parseTileKey,
  tileKey,
} from './content/levels.mjs';

export const WITNESS_STAGE_FIELDWORK_SCHEMA_VERSION = 1;
export const WITNESS_STAGE_FIELDWORK_KEYS = Object.freeze([
  'chronicleId', 'stageId', 'mapId', 'activityType', 'nodes',
]);
export const WITNESS_STAGE_TASK_NODE_KEYS = Object.freeze([
  'id', 'order', 'at', 'verb', 'instruction', 'encounterId',
]);

const ACTIVITY_TYPES = Object.freeze([
  'interview', 'inspect', 'archive', 'deliver', 'combat', 'council', 'escort',
]);
const NEIGHBOR_DELTAS = Object.freeze([
  [0, -1], [1, 0], [0, 1], [-1, 0],
  [1, -1], [1, 1], [-1, 1], [-1, -1],
]);

const deepFreeze = (value) => {
  if (!value || (typeof value !== 'object' && typeof value !== 'function') || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function pointOf(value) {
  if (typeof value === 'string') return { ...parseTileKey(value), key: value };
  const x = Number(value?.x);
  const y = Number(value?.y);
  return { x, y, key: tileKey(x, y) };
}

function isOpen(level, value) {
  const { x, y } = pointOf(value);
  return Number.isInteger(x) && Number.isInteger(y) && !isBlocked(level, x, y);
}

function legalNeighbors(level, value) {
  const origin = pointOf(value);
  const neighbors = [];
  for (const [dx, dy] of NEIGHBOR_DELTAS) {
    const target = { x: origin.x + dx, y: origin.y + dy };
    if (!isOpen(level, target)) continue;
    if (dx !== 0 && dy !== 0
      && (!isOpen(level, { x: origin.x + dx, y: origin.y })
        || !isOpen(level, { x: origin.x, y: origin.y + dy }))) continue;
    neighbors.push(pointOf(target));
  }
  return neighbors;
}

function routeTree(level) {
  const start = pointOf(level.spawn);
  const queue = [start];
  const parent = new Map([[start.key, null]]);
  const distance = new Map([[start.key, 0]]);
  while (queue.length) {
    const current = queue.shift();
    for (const next of legalNeighbors(level, current)) {
      if (parent.has(next.key)) continue;
      parent.set(next.key, current.key);
      distance.set(next.key, distance.get(current.key) + 1);
      queue.push(next);
    }
  }
  return { start, parent, distance };
}

function pathFromTree(tree, targetKey) {
  if (!tree.parent.has(targetKey)) return [];
  const reversed = [];
  let cursor = targetKey;
  while (cursor != null) {
    reversed.push(cursor);
    cursor = tree.parent.get(cursor);
  }
  return reversed.reverse();
}

function occupiedKeys(level, encounter) {
  const occupied = new Set([
    tileKey(level.spawn.x, level.spawn.y),
    ...(level.interactables ?? []).map((entry) => entry.at),
    ...(level.exits ?? []).map((entry) => entry.at),
    ...(level.hazards ?? []).flatMap((hazard) => hazard.tiles ?? []),
    ...(encounter?.party?.deployment ?? []).map((entry) => entry.at),
    ...(encounter?.enemies ?? []).flatMap((enemy) => enemy.positions ?? []),
  ]);
  return occupied;
}

function farthestReachableKey(tree, keys = tree.parent.keys()) {
  return [...keys]
    .filter((key) => tree.distance.has(key))
    .sort((left, right) => (
      tree.distance.get(right) - tree.distance.get(left)
      || left.localeCompare(right)
    ))[0] ?? tree.start.key;
}

function authoredAnchor(level, encounter, nextMapId, tree) {
  if (encounter) {
    const enemyKeys = encounter.enemies.flatMap((enemy) => enemy.positions ?? []);
    const enemyAnchor = farthestReachableKey(tree, enemyKeys);
    if (tree.parent.has(enemyAnchor)) return enemyAnchor;
  }
  const forwardExit = (level.exits ?? []).find((exit) => exit.destinationLevelId === nextMapId)
    ?? level.exits?.[0];
  if (forwardExit && tree.parent.has(forwardExit.at)) return forwardExit.at;
  return farthestReachableKey(tree);
}

function bestForwardPath(level, encounter, nextMapId, minimumCandidates = 2) {
  const tree = routeTree(level);
  const occupied = occupiedKeys(level, encounter);
  const preferred = authoredAnchor(level, encounter, nextMapId, tree);
  const candidatePaths = [preferred, ...[...tree.parent.keys()]
    .sort((left, right) => (
      tree.distance.get(right) - tree.distance.get(left)
      || left.localeCompare(right)
    ))]
    .filter((key, index, all) => all.indexOf(key) === index)
    .map((target) => {
      const path = pathFromTree(tree, target);
      return {
        target,
        path,
        eligible: path.filter((key) => !occupied.has(key)),
        preferred: target === preferred,
      };
    })
    .sort((left, right) => (
      Number(right.preferred && right.eligible.length >= minimumCandidates)
        - Number(left.preferred && left.eligible.length >= minimumCandidates)
      || right.eligible.length - left.eligible.length
      || right.path.length - left.path.length
      || left.target.localeCompare(right.target)
    ));
  return { ...candidatePaths[0], tree, occupied };
}

const generic = (instruction) => () => instruction;
const authored = ({ stage }) => stage.activity.instruction;
const combatPreparation = ({ stage }) => stage.activity.instruction;
const encounterObjective = ({ encounter }) => encounter.objective.text;

export const WITNESS_FIELDWORK_ACTIVITY_BLUEPRINTS = deepFreeze({
  interview: [
    { verb: 'Approach', instruction: generic('Move to the marked interview point by the open route.') },
    { verb: 'Invite', instruction: generic('Invite the authored speaker to begin without triggering another map interaction.') },
    { verb: 'Listen', instruction: generic('Acknowledge the authored dialogue at this marked interview point.') },
    { verb: 'Clarify', instruction: generic('Keep the account’s stated limits and uncertainty attached to it.') },
    { verb: 'Confirm', instruction: authored },
  ],
  inspect: [
    { verb: 'Locate', instruction: generic('Move to the marked inspection point without crossing blocked terrain.') },
    { verb: 'Observe', instruction: generic('Observe the authored map subject before interacting with it.') },
    { verb: 'Examine', instruction: generic('Examine only the visible subject named by this stage.') },
    { verb: 'Cross-check', instruction: generic('Cross-check the observation against the authored stage instruction.') },
    { verb: 'Document', instruction: authored },
  ],
  archive: [
    { verb: 'Gather', instruction: generic('Move to the marked record point using the forward-open route.') },
    { verb: 'Sort', instruction: generic('Keep the stage’s authored records separate while sorting them.') },
    { verb: 'Compare', instruction: generic('Compare only the records identified by the authored stage.') },
    { verb: 'Annotate', instruction: generic('Preserve stated limits and uncertainty in the working note.') },
    { verb: 'File', instruction: authored },
  ],
  deliver: [
    { verb: 'Collect', instruction: generic('Reach the marked collection point without activating another interactable.') },
    { verb: 'Plot route', instruction: generic('Confirm the remaining route uses only reachable open tiles.') },
    { verb: 'Carry', instruction: generic('Carry the authored delivery forward without taking an ability-gated shortcut.') },
    { verb: 'Verify handoff', instruction: generic('Verify the authored recipient or destination before completing the handoff.') },
    { verb: 'Deliver', instruction: authored },
  ],
  combat: [
    { verb: 'Survey arena', instruction: generic('Reach the marked battle approach without entering blocked or occupied tiles.') },
    { verb: 'Take position', instruction: generic('Take the next open staging point on the forward route.') },
    { verb: 'Prepare', instruction: generic('Review the exact canonical encounter before committing the party.') },
    { verb: 'Ready', instruction: combatPreparation },
    { verb: 'Fight', instruction: encounterObjective },
  ],
  council: [
    { verb: 'Convene', instruction: generic('Move to the marked council point and leave authored exits unobstructed.') },
    { verb: 'Hear positions', instruction: generic('Hear the authored positions before presenting a resolution.') },
    { verb: 'Present limits', instruction: generic('Keep each stated limit attached to the position that supplied it.') },
    { verb: 'Deliberate', instruction: generic('Leave the authored participants control of the council decision.') },
    { verb: 'Resolve', instruction: authored },
  ],
  escort: [
    { verb: 'Assemble', instruction: generic('Reach the marked assembly point by the open route.') },
    { verb: 'Mark route', instruction: generic('Confirm the forward route without adding an ability gate.') },
    { verb: 'Guide', instruction: generic('Guide the authored group to the next marked open tile.') },
    { verb: 'Check group', instruction: generic('Check the authored group before leaving the current marked point.') },
    { verb: 'Arrive', instruction: authored },
  ],
});

function desiredNodeCount(stage) {
  return Math.max(2, Math.min(5, Math.ceil(stage.activity.minutes / 3)));
}

function selectedBlueprint(type, count) {
  const blueprint = WITNESS_FIELDWORK_ACTIVITY_BLUEPRINTS[type];
  const selections = {
    2: [0, 4],
    3: [0, 3, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 3, 4],
  };
  return selections[count].map((index) => blueprint[index]);
}

function distributedKeys(keys, count) {
  if (count === 1) return [keys[keys.length - 1]];
  return Array.from({ length: count }, (_, index) => (
    keys[Math.round((index * (keys.length - 1)) / (count - 1))]
  ));
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function deriveOneStage(chronicle, stage, stageIndex) {
  const level = getLevel(stage.mapId);
  const encounter = stage.encounterId ? getEncounter(stage.encounterId) : null;
  const nextMapId = chronicle.stages[stageIndex + 1]?.mapId ?? null;
  const route = bestForwardPath(level, encounter, nextMapId);
  const count = Math.min(desiredNodeCount(stage), route.eligible.length);
  if (count < 2) throw new TypeError(`${chronicle.id}:${stage.id} has fewer than two legal forward task tiles.`);
  const positions = distributedKeys(route.eligible, count);
  const steps = selectedBlueprint(stage.activity.type, count);
  const nodes = steps.map((step, index) => {
    const order = index + 1;
    return {
      id: `${chronicle.id}.${stage.id}.task-${String(order).padStart(2, '0')}-${slug(step.verb)}`,
      order,
      at: positions[index],
      verb: step.verb,
      instruction: step.instruction({ chronicle, stage, level, encounter }),
      encounterId: stage.activity.type === 'combat' && order === count ? stage.encounterId : null,
    };
  });
  return {
    chronicleId: chronicle.id,
    stageId: stage.id,
    mapId: stage.mapId,
    activityType: stage.activity.type,
    nodes,
  };
}

function buildFieldworkCatalog() {
  return WITNESS_CHRONICLES.flatMap((chronicle) => (
    chronicle.stages.map((stage, stageIndex) => deriveOneStage(chronicle, stage, stageIndex))
  ));
}

/** Returns a fresh, deeply frozen deterministic fieldwork catalog. */
export function deriveWitnessStageFieldwork() {
  return deepFreeze(buildFieldworkCatalog());
}

export const WITNESS_STAGE_FIELDWORK = deriveWitnessStageFieldwork();

export function getWitnessStageFieldwork(chronicleId, stageId) {
  return WITNESS_STAGE_FIELDWORK.find((entry) => (
    entry.chronicleId === chronicleId && entry.stageId === stageId
  )) ?? null;
}

/** Strictly validates coverage, schemas, exact derivation, topology, and encounter handoffs. */
export function validateWitnessStageFieldwork(catalog = WITNESS_STAGE_FIELDWORK) {
  const errors = [];
  const expected = buildFieldworkCatalog();
  const canonicalStages = WITNESS_CHRONICLES.flatMap((chronicle) => chronicle.stages.map((stage) => ({ chronicle, stage })));
  if (!Array.isArray(catalog)) {
    return deepFreeze({ ok: false, errors: ['Witness stage fieldwork must be an array.'] });
  }
  if (catalog.length !== canonicalStages.length) {
    errors.push(`Witness stage fieldwork must cover exactly ${canonicalStages.length} canonical stages.`);
  }
  const identities = new Set();
  catalog.forEach((entry, index) => {
    const identity = `${entry?.chronicleId ?? ''}\u0000${entry?.stageId ?? ''}`;
    if (identities.has(identity)) errors.push(`Entry ${index} duplicates its chronicle and stage identity.`);
    identities.add(identity);
    if (!exactKeys(entry, WITNESS_STAGE_FIELDWORK_KEYS)) errors.push(`Entry ${index} has unsupported or missing keys.`);
    const expectedEntry = expected[index];
    if (!expectedEntry) return;
    for (const key of ['chronicleId', 'stageId', 'mapId', 'activityType']) {
      if (entry?.[key] !== expectedEntry[key]) errors.push(`Entry ${index}.${key} is not in deterministic canonical order.`);
    }
    if (!Array.isArray(entry?.nodes) || entry.nodes.length < 2 || entry.nodes.length > 5) {
      errors.push(`${expectedEntry.chronicleId}:${expectedEntry.stageId} must contain 2-5 task nodes.`);
      return;
    }
    const level = getLevel(expectedEntry.mapId);
    const canonical = canonicalStages[index]?.stage;
    const encounter = canonical?.encounterId ? getEncounter(canonical.encounterId) : null;
    const route = bestForwardPath(level, encounter, canonicalStages[index]?.chronicle.stages[
      canonicalStages[index].chronicle.stages.indexOf(canonical) + 1
    ]?.mapId ?? null);
    let priorPathIndex = -1;
    const positions = new Set();
    entry.nodes.forEach((node, nodeIndex) => {
      const expectedNode = expectedEntry.nodes[nodeIndex];
      if (!exactKeys(node, WITNESS_STAGE_TASK_NODE_KEYS)) errors.push(`${entry.stageId} node ${nodeIndex} has unsupported or missing keys.`);
      if (!expectedNode) return;
      for (const key of WITNESS_STAGE_TASK_NODE_KEYS) {
        if (node?.[key] !== expectedNode[key]) errors.push(`${entry.stageId} node ${nodeIndex}.${key} differs from deterministic derivation.`);
      }
      if (!isOpen(level, node?.at) || !route.tree.parent.has(node?.at)) errors.push(`${entry.stageId} node ${nodeIndex} is not reachable open terrain.`);
      if (route.occupied.has(node?.at)) errors.push(`${entry.stageId} node ${nodeIndex} overlaps an authored object, exit, hazard, spawn, or deployment.`);
      if (positions.has(node?.at)) errors.push(`${entry.stageId} node ${nodeIndex} overlaps another node.`);
      positions.add(node?.at);
      const pathIndex = route.path.indexOf(node?.at);
      if (pathIndex < 0 || pathIndex <= priorPathIndex) errors.push(`${entry.stageId} node ${nodeIndex} requires backtracking or leaves the derived forward path.`);
      priorPathIndex = pathIndex;
    });
    const finalNode = entry.nodes.at(-1);
    if (canonical?.activity.type === 'combat') {
      if (!encounter || finalNode?.encounterId !== canonical.encounterId
        || finalNode?.verb !== 'Fight' || finalNode?.instruction !== encounter.objective.text) {
        errors.push(`${entry.stageId} must end with its exact canonical encounter objective.`);
      }
      if (entry.nodes.slice(0, -1).some((node) => node.encounterId != null)) {
        errors.push(`${entry.stageId} may attach encounter evidence only to its final task.`);
      }
    } else if (entry.nodes.some((node) => node.encounterId != null)) {
      errors.push(`${entry.stageId} is non-combat and cannot attach encounter evidence.`);
    } else if (finalNode?.instruction !== canonical?.activity.instruction) {
      errors.push(`${entry.stageId} must end with its exact authored activity instruction.`);
    }
  });
  return deepFreeze({ ok: errors.length === 0, errors });
}

export function getWitnessStageFieldworkMetrics(catalog = WITNESS_STAGE_FIELDWORK) {
  const content = getWitnessChronicleMetrics();
  const nodes = catalog.flatMap((entry) => entry.nodes);
  const stageCountsByActivity = Object.fromEntries(ACTIVITY_TYPES.map((type) => [
    type, catalog.filter((entry) => entry.activityType === type).length,
  ]));
  const nodeCountsByActivity = Object.fromEntries(ACTIVITY_TYPES.map((type) => [
    type, catalog.filter((entry) => entry.activityType === type).reduce((sum, entry) => sum + entry.nodes.length, 0),
  ]));
  const minimumExactMovementSteps = catalog.reduce((sum, entry) => {
    const level = getLevel(entry.mapId);
    const distance = routeTree(level).distance.get(entry.nodes.at(-1).at);
    return sum + (distance ?? 0);
  }, 0);
  return deepFreeze({
    schemaVersion: WITNESS_STAGE_FIELDWORK_SCHEMA_VERSION,
    chronicleCount: content.chronicleCount,
    stageCount: catalog.length,
    nodeCount: nodes.length,
    mapCount: new Set(catalog.map((entry) => entry.mapId)).size,
    combatStageCount: catalog.filter((entry) => entry.activityType === 'combat').length,
    exactEncounterTaskCount: nodes.filter((node) => node.encounterId != null).length,
    minNodesPerStage: Math.min(...catalog.map((entry) => entry.nodes.length)),
    maxNodesPerStage: Math.max(...catalog.map((entry) => entry.nodes.length)),
    forwardOnlyStageCount: catalog.length,
    abilityGateCount: 0,
    minimumExactMovementSteps,
    stageCountsByActivity,
    nodeCountsByActivity,
  });
}

const validation = validateWitnessStageFieldwork(WITNESS_STAGE_FIELDWORK);
if (!validation.ok) throw new TypeError(validation.errors.join(' '));
