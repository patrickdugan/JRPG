/** Deterministic, DOM-free competent policy for campaign solvability audits. */

import { CAMPAIGN_COMBAT_PHASES, canMoveEightWay } from './campaign-combat.mjs';

const DIRECTIONS = Object.freeze([
  Object.freeze({ dx: -1, dy: 0 }),
  Object.freeze({ dx: -1, dy: -1 }),
  Object.freeze({ dx: 0, dy: -1 }),
  Object.freeze({ dx: 1, dy: -1 }),
  Object.freeze({ dx: 1, dy: 0 }),
  Object.freeze({ dx: 1, dy: 1 }),
  Object.freeze({ dx: 0, dy: 1 }),
  Object.freeze({ dx: -1, dy: 1 }),
]);

const BOSS_OBJECTIVES = new Set([
  'defeatBoss',
  'defeatBossWithProtection',
  'defeatBossAndRelease',
  'defeatBossAndEvacuate',
]);

const keyOf = ({ x, y }) => `${x},${y}`;
const distance = (left, right) => Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
const parseTile = (key) => {
  const [x, y] = String(key).split(',').map(Number);
  return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
};

function livingEnemies(snapshot) {
  return snapshot.actors.filter((actor) => actor.faction === 'enemy' && actor.hp > 0 && actor.active !== false);
}

function occupiedTiles(snapshot, actorId) {
  return new Set(snapshot.actors
    .filter((actor) => actor.instanceId !== actorId && actor.hp > 0 && actor.active !== false)
    .map((actor) => keyOf(actor.pos)));
}

function shortestPath(engine, snapshot, actor, goal) {
  if (goal(actor.pos)) return [];
  const occupied = occupiedTiles(snapshot, actor.instanceId);
  const queue = [{ position: actor.pos, path: [] }];
  const visited = new Set([keyOf(actor.pos)]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const direction of DIRECTIONS) {
      const movement = canMoveEightWay(engine.level, current.position, direction.dx, direction.dy, occupied);
      if (!movement.ok) continue;
      const key = keyOf(movement.position);
      if (visited.has(key)) continue;
      const path = [...current.path, direction];
      if (goal(movement.position)) return path;
      visited.add(key);
      queue.push({ position: movement.position, path });
    }
  }
  return null;
}

function reachablePositions(engine, snapshot, actor) {
  const occupied = occupiedTiles(snapshot, actor.instanceId);
  const queue = [{ position: actor.pos, path: [] }];
  const visited = new Set([keyOf(actor.pos)]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current.path.length >= snapshot.pace) continue;
    for (const direction of DIRECTIONS) {
      const movement = canMoveEightWay(engine.level, current.position, direction.dx, direction.dy, occupied);
      if (!movement.ok) continue;
      const key = keyOf(movement.position);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ position: movement.position, path: [...current.path, direction] });
    }
  }
  return queue;
}

function maximumSkillRange(actor) {
  return Math.max(1, ...actor.skills.map((skill) => skill.range ?? 1));
}

function attackPositionSafety(snapshot, actor, position, defeatedTargetId) {
  const enemies = livingEnemies(snapshot).filter((enemy) => enemy.instanceId !== defeatedTargetId);
  if (!enemies.length) return { threatenedBy: 0, activeDistance: 1_000, teamDistance: 1_000 };
  const partyPositions = snapshot.actors
    .filter((candidate) => candidate.faction === 'party' && candidate.hp > 0 && candidate.active !== false)
    .map((candidate) => candidate.instanceId === actor.instanceId ? position : candidate.pos);
  let threatenedBy = 0;
  let activeDistance = Number.POSITIVE_INFINITY;
  let teamDistance = 0;
  for (const enemy of enemies) {
    const activeActorDistance = distance(position, enemy.pos);
    const nearestPartyDistance = Math.min(...partyPositions.map((partyPosition) => distance(partyPosition, enemy.pos)));
    if (activeActorDistance <= maximumSkillRange(enemy)) threatenedBy += 1;
    activeDistance = Math.min(activeDistance, activeActorDistance);
    teamDistance += nearestPartyDistance;
  }
  return { threatenedBy, activeDistance, teamDistance };
}

/**
 * Enumerate every legal move-then-attack command available this activation.
 * Target choice rewards focus fire against fast enemies; once a target and
 * skill are selected, positioning spends spare Pace to leave as many hostile
 * ranges as the board permits.
 */
function bestAttackPlan(engine, snapshot, actor) {
  const enemies = livingEnemies(snapshot);
  const bossId = enemies[0]?.instanceId;
  const bossObjective = BOSS_OBJECTIVES.has(snapshot.objective.type);
  const candidates = [];
  for (const reachable of reachablePositions(engine, snapshot, actor)) {
    for (const target of enemies) {
      for (const skill of actor.skills) {
        if (distance(reachable.position, target.pos) > (skill.range ?? 1)) continue;
        const preview = engine.previewDamage(actor.instanceId, target.instanceId, skill.id);
        if (!preview || preview.typedDamage <= 0) continue;
        const lethal = preview.typedDamage >= target.hp;
        candidates.push({
          ...reachable,
          target,
          skill,
          damage: preview.typedDamage,
          boss: bossObjective && target.instanceId === bossId,
          lethal,
          safety: attackPositionSafety(snapshot, actor, reachable.position, lethal ? target.instanceId : null),
        });
      }
    }
  }
  return candidates.sort((left, right) => Number(right.boss) - Number(left.boss)
    || Number(right.lethal) - Number(left.lethal)
    || right.target.speed - left.target.speed
    || right.damage - left.damage
    || (left.skill.recoveryPulses ?? 1) - (right.skill.recoveryPulses ?? 1)
    || left.safety.threatenedBy - right.safety.threatenedBy
    || right.safety.activeDistance - left.safety.activeDistance
    || right.safety.teamDistance - left.safety.teamDistance
    || right.path.length - left.path.length
    || keyOf(left.position).localeCompare(keyOf(right.position))
    || left.target.instanceId.localeCompare(right.target.instanceId)
    || left.skill.id.localeCompare(right.skill.id))[0] ?? null;
}

function objectiveGoal(requirement) {
  const tiles = [requirement.tile, ...(requirement.tiles ?? [])].filter(Boolean).map(parseTile).filter(Boolean);
  if (!tiles.length) return null;
  return (position) => tiles.some((tile) => tile.x === position.x && tile.y === position.y);
}

function incompleteManualRequirement(snapshot) {
  return snapshot.objective.requirements.find((requirement) => !requirement.automatic && !requirement.complete) ?? null;
}

function moveAlong(engine, actorId, path, trace) {
  let moved = 0;
  for (const direction of path ?? []) {
    if (engine.snapshot().pace <= 0) break;
    const result = engine.move(actorId, direction.dx, direction.dy);
    if (!result.ok) break;
    trace.push(Object.freeze({ type: 'move', actorId, dx: direction.dx, dy: direction.dy, at: keyOf(result.position) }));
    moved += 1;
  }
  return moved;
}

function performManualObjective(engine, snapshot, actor, requirement, trace) {
  const goal = objectiveGoal(requirement);
  if (goal && !goal(actor.pos)) {
    const path = shortestPath(engine, snapshot, actor, goal);
    if (path) moveAlong(engine, actor.instanceId, path, trace);
  }
  const refreshedActor = engine.getActor(actor.instanceId);
  if (goal && !goal(refreshedActor.pos)) return false;
  const action = { type: requirement.action, targetId: requirement.targetId, amount: 1 };
  const result = engine.performObjectiveAction(actor.instanceId, action);
  if (!result.ok) return false;
  trace.push(Object.freeze({ type: 'objective', actorId: actor.instanceId, action: requirement.action, targetId: requirement.targetId ?? null, requirement: result.requirement }));
  return true;
}

function performAttackTurn(engine, snapshot, actor, trace) {
  const attack = bestAttackPlan(engine, snapshot, actor);
  if (!attack) return false;
  moveAlong(engine, actor.instanceId, attack.path, trace);
  const result = engine.useSkill(actor.instanceId, attack.skill.id, attack.target.instanceId);
  if (!result.ok) return false;
  trace.push(Object.freeze({
    type: 'skill',
    actorId: actor.instanceId,
    skillId: attack.skill.id,
    targetId: attack.target.instanceId,
    damage: result.finalDamage,
    targetHp: result.targetHp,
  }));
  return true;
}

/**
 * Select one deterministic legal command from the same competent plan used by
 * the full solvability audit. Repeated calls naturally spend one Pace step at
 * a time before committing the planned skill or objective action.
 */
export function chooseCampaignCombatCommand(engine) {
  const snapshot = engine.snapshot();
  if (snapshot.phase !== CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND || snapshot.result) return null;
  const actor = snapshot.actors.find((candidate) => candidate.instanceId === snapshot.activeActorId);
  if (!actor || actor.faction !== 'party') return null;

  const requirement = incompleteManualRequirement(snapshot);
  if (requirement) {
    const goal = objectiveGoal(requirement);
    if (goal && !goal(actor.pos)) {
      const path = shortestPath(engine, snapshot, actor, goal);
      if (path?.length && snapshot.pace > 0) return Object.freeze({ type: 'move', ...path[0] });
    }
    if (!goal || goal(actor.pos)) {
      return Object.freeze({
        type: 'objective',
        action: Object.freeze({ type: requirement.action, targetId: requirement.targetId, amount: 1 }),
      });
    }
    return Object.freeze({ type: 'guard' });
  }

  if (livingEnemies(snapshot).length) {
    const attack = bestAttackPlan(engine, snapshot, actor);
    if (attack?.path.length && snapshot.pace > 0) {
      return Object.freeze({ type: 'move', ...attack.path[0] });
    }
    if (attack) return Object.freeze({ type: 'skill', skillId: attack.skill.id, targetId: attack.target.instanceId });
  }
  return Object.freeze({ type: 'guard' });
}

/**
 * Execute accepted commands until the supplied campaign engine resolves.
 * The policy completes explicit objectives, paths to exact objective tiles,
 * prioritizes required bosses, and otherwise chooses the strongest reachable
 * positive-damage attack. It never mutates actors or objective counters.
 */
export function solveCampaignCombat(engine, options = {}) {
  const maxPlayerCommands = options.maxPlayerCommands ?? 2_000;
  const maxEnemyActivations = options.maxEnemyActivations ?? 5_000;
  if (!Number.isSafeInteger(maxPlayerCommands) || maxPlayerCommands < 1) throw new RangeError('maxPlayerCommands must be a positive safe integer.');
  if (!Number.isSafeInteger(maxEnemyActivations) || maxEnemyActivations < 1) throw new RangeError('maxEnemyActivations must be a positive safe integer.');

  const trace = [];
  let playerCommands = 0;
  let enemyActivations = 0;
  let reason = 'command-bound';

  while (!engine.result && playerCommands < maxPlayerCommands && enemyActivations <= maxEnemyActivations) {
    if (engine.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND) {
      const advanced = engine.advanceUntilPlayerCommand(Math.max(1, maxEnemyActivations - enemyActivations));
      enemyActivations += advanced.enemyActivations;
      trace.push(Object.freeze({ type: 'enemy-sequence', count: advanced.enemyActivations, pulse: advanced.snapshot.nowPulse }));
      if (enemyActivations > maxEnemyActivations) {
        reason = 'enemy-activation-bound';
        break;
      }
      continue;
    }

    const snapshot = engine.snapshot();
    const actor = snapshot.actors.find((candidate) => candidate.instanceId === snapshot.activeActorId);
    if (!actor || actor.faction !== 'party') {
      reason = 'invalid-player-phase';
      break;
    }

    let committed = false;
    const requirement = incompleteManualRequirement(snapshot);
    if (requirement) committed = performManualObjective(engine, snapshot, actor, requirement, trace);
    if (!committed && livingEnemies(engine.snapshot()).length) {
      committed = performAttackTurn(engine, engine.snapshot(), engine.getActor(actor.instanceId), trace);
    }
    if (!committed) {
      const result = engine.guard(actor.instanceId);
      if (!result.ok) {
        reason = result.reason ?? 'no-valid-command';
        break;
      }
      trace.push(Object.freeze({ type: 'guard', actorId: actor.instanceId }));
    }
    playerCommands += 1;
  }

  if (engine.result === 'victory') reason = 'victory';
  else if (engine.result === 'defeat') reason = 'defeat';
  const snapshot = engine.snapshot();
  return Object.freeze({
    solved: engine.result === 'victory',
    result: engine.result,
    reason,
    playerCommands,
    enemyActivations,
    trace: Object.freeze(trace),
    snapshot,
  });
}
