/** Pure, code-native feedback records for exact board interaction. */

export const BATTLE_SYSTEM_FEEDBACK_SPEEDS = Object.freeze([1, 2, 4]);

export const BATTLE_SYSTEM_FEEDBACK_MS = Object.freeze({
  'move-destination': 320,
  'move-blocked': 480,
  'recovery-lock': 560,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function exactTile(tile, field) {
  if (!Number.isSafeInteger(tile?.x) || !Number.isSafeInteger(tile?.y)) {
    throw new TypeError(`${field} must be an exact integer tile.`);
  }
  return { x: tile.x, y: tile.y };
}

function safeTime(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function boardSize(board) {
  if (!Number.isSafeInteger(board?.width) || board.width < 1
    || !Number.isSafeInteger(board?.height) || board.height < 1) {
    throw new TypeError('board width and height must be positive integers.');
  }
  return { width: board.width, height: board.height };
}

function clampTile(tile, board) {
  return {
    x: Math.max(0, Math.min(board.width - 1, tile.x)),
    y: Math.max(0, Math.min(board.height - 1, tile.y)),
  };
}

function round(value) {
  return Math.round(value * 10_000) / 10_000;
}

/** Create feedback after an engine move result without mutating that result. */
export function createBattleMoveFeedback({
  result,
  actorId,
  actorName,
  sourceTile,
  dx,
  dy,
  board,
  startedAt = 0,
  speed = 1,
} = {}) {
  if (!result || typeof result.ok !== 'boolean') throw new TypeError('result must be an engine move result.');
  if (!Number.isSafeInteger(dx) || !Number.isSafeInteger(dy)) throw new TypeError('movement delta must use exact integers.');
  if (!BATTLE_SYSTEM_FEEDBACK_SPEEDS.includes(speed)) throw new RangeError('Battle system feedback speed must be 1, 2, or 4.');
  const source = exactTile(sourceTile, 'sourceTile');
  const bounds = boardSize(board);
  const attemptedTile = { x: source.x + dx, y: source.y + dy };
  const kind = result.ok ? 'move-destination' : 'move-blocked';
  const destinationTile = result.ok ? exactTile(result.position, 'result.position') : attemptedTile;
  const displayTile = clampTile(destinationTile, bounds);
  const outOfBounds = displayTile.x !== destinationTile.x || displayTile.y !== destinationTile.y;
  const resolvedActorId = String(actorId ?? 'actor');
  const resolvedActorName = String(actorName ?? resolvedActorId);
  const reason = result.ok ? null : String(result.reason ?? 'Movement was rejected.');
  const baseDurationMs = BATTLE_SYSTEM_FEEDBACK_MS[kind];
  const durationMs = baseDurationMs / speed;
  const safeStartedAt = safeTime(startedAt);
  const destination = `${attemptedTile.x},${attemptedTile.y}`;
  return deepFreeze({
    kind,
    actorId: resolvedActorId,
    actorName: resolvedActorName,
    sourceTile: source,
    attemptedTile,
    displayTile,
    outOfBounds,
    reason,
    announcement: result.ok
      ? `${resolvedActorName} moves to ${result.position.x},${result.position.y}.`
      : `${resolvedActorName} cannot move to ${destination}. ${reason}`,
    baseDurationMs,
    durationMs,
    startedAt: safeStartedAt,
    endsAt: safeStartedAt + durationMs,
    presentationSpeed: speed,
  });
}

export function sampleBattleMoveFeedback(record, nowMs, { reducedMotion = false } = {}) {
  if (!record || !['move-destination', 'move-blocked'].includes(record.kind)) return null;
  const now = safeTime(nowMs);
  if (now < record.startedAt || now >= record.endsAt) return null;
  const progress = Math.max(0, Math.min(1, (now - record.startedAt) / record.durationMs));
  const pulse = reducedMotion ? 1 : 1 - Math.abs((progress * 2) - 1);
  return deepFreeze({
    kind: record.kind,
    sourceTile: record.sourceTile,
    attemptedTile: record.attemptedTile,
    displayTile: record.displayTile,
    outOfBounds: record.outOfBounds,
    progress: round(reducedMotion ? 0.5 : progress),
    pulse: round(pulse),
    opacity: round(reducedMotion ? 0.9 : 0.58 + (pulse * 0.36)),
    routeProgress: record.kind === 'move-destination'
      ? round(reducedMotion ? 1 : Math.min(1, progress * 3))
      : 1,
    reducedMotion: Boolean(reducedMotion),
  });
}

/** A command-selection attempt on a party actor that the snapshot proves is in Recovery. */
export function createRecoveryLockFeedback({
  actor,
  nowPulse,
  activeActorId = null,
  startedAt = 0,
  speed = 1,
} = {}) {
  if (!Number.isSafeInteger(nowPulse) || nowPulse < 0) {
    throw new TypeError('nowPulse must be a non-negative integer.');
  }
  if (!BATTLE_SYSTEM_FEEDBACK_SPEEDS.includes(speed)) {
    throw new RangeError('Battle system feedback speed must be 1, 2, or 4.');
  }
  if (!actor || actor.faction !== 'party' || actor.hp <= 0 || actor.active === false
    || actor.instanceId === activeActorId || !Number.isSafeInteger(actor.readyAtPulse)
    || actor.readyAtPulse <= nowPulse) return null;

  const actorId = String(actor.instanceId);
  const actorName = String(actor.name ?? actorId);
  const tile = exactTile(actor.pos, 'actor.pos');
  const remainingPulses = actor.readyAtPulse - nowPulse;
  const baseDurationMs = BATTLE_SYSTEM_FEEDBACK_MS['recovery-lock'];
  const durationMs = baseDurationMs / speed;
  const safeStartedAt = safeTime(startedAt);
  return deepFreeze({
    kind: 'recovery-lock',
    actorId,
    actorName,
    tile,
    attemptedAtPulse: nowPulse,
    readyAtPulse: actor.readyAtPulse,
    remainingPulses,
    announcement: `${actorName} cannot take a command: Recovery locked for ${remainingPulses} more pulse${remainingPulses === 1 ? '' : 's'}; ready at pulse ${actor.readyAtPulse}.`,
    baseDurationMs,
    durationMs,
    startedAt: safeStartedAt,
    endsAt: safeStartedAt + durationMs,
    presentationSpeed: speed,
  });
}

export function sampleRecoveryLockFeedback(record, nowMs, { reducedMotion = false } = {}) {
  if (!record || record.kind !== 'recovery-lock') return null;
  const now = safeTime(nowMs);
  if (now < record.startedAt || now >= record.endsAt) return null;
  const progress = Math.max(0, Math.min(1, (now - record.startedAt) / record.durationMs));
  const pulse = reducedMotion ? 1 : 1 - Math.abs((progress * 2) - 1);
  return deepFreeze({
    kind: record.kind,
    actorId: record.actorId,
    tile: record.tile,
    attemptedAtPulse: record.attemptedAtPulse,
    readyAtPulse: record.readyAtPulse,
    remainingPulses: record.remainingPulses,
    progress: round(reducedMotion ? 0.5 : progress),
    pulse: round(pulse),
    opacity: round(reducedMotion ? 0.92 : 0.66 + (pulse * 0.3)),
    reducedMotion: Boolean(reducedMotion),
  });
}

/**
 * Readiness is pulse-exact. visualNowMs only moves a scan across the proven fill;
 * it never advances the fill or changes Recovery arithmetic.
 */
export function createBattleTempoPresentation(snapshot, {
  visualNowMs = 0,
  reducedMotion = false,
} = {}) {
  if (!Number.isSafeInteger(snapshot?.nowPulse) || snapshot.nowPulse < 0) {
    throw new TypeError('snapshot.nowPulse must be a non-negative integer.');
  }
  if (!Array.isArray(snapshot.actors) || !Array.isArray(snapshot.log)) {
    throw new TypeError('snapshot actors and log must be arrays.');
  }

  const scan = reducedMotion ? 0.5 : (safeTime(visualNowMs) % 800) / 800;
  const records = snapshot.actors
    .filter((actor) => actor.hp > 0 && actor.active !== false && actor.faction !== 'neutral')
    .map((actor) => {
      const readyAtPulse = Number.isSafeInteger(actor.readyAtPulse) ? actor.readyAtPulse : snapshot.nowPulse;
      const remainingPulses = Math.max(0, readyAtPulse - snapshot.nowPulse);
      const active = actor.instanceId === snapshot.activeActorId;
      let matchingCommit = null;
      for (let index = snapshot.log.length - 1; index >= 0; index -= 1) {
        const event = snapshot.log[index];
        if (event?.type === 'commit' && event.actorId === actor.instanceId
          && event.readyAtPulse === readyAtPulse && Number.isSafeInteger(event.pulse)
          && event.pulse <= snapshot.nowPulse) {
          matchingCommit = event;
          break;
        }
      }
      const recoveryStartPulse = matchingCommit?.pulse ?? null;
      const totalRecoveryPulses = recoveryStartPulse === null
        ? null
        : Math.max(0, readyAtPulse - recoveryStartPulse);
      const readiness = remainingPulses === 0 || active
        ? 1
        : totalRecoveryPulses > 0
          ? Math.max(0, Math.min(1, (snapshot.nowPulse - recoveryStartPulse) / totalRecoveryPulses))
          : 0;
      const status = active ? 'active' : remainingPulses === 0 ? 'ready' : 'recovery';
      const actorId = String(actor.instanceId);
      const actorName = String(actor.name ?? actorId);
      return {
        kind: 'tempo-readiness',
        actorId,
        actorName,
        faction: actor.faction,
        tile: exactTile(actor.pos, 'actor.pos'),
        status,
        nowPulse: snapshot.nowPulse,
        recoveryStartPulse,
        readyAtPulse,
        totalRecoveryPulses,
        remainingPulses,
        readiness: round(readiness),
        scan: round(scan),
        reducedMotion: Boolean(reducedMotion),
        label: active
          ? `${actorName}: active and ready.`
          : remainingPulses === 0
            ? `${actorName}: ready at pulse ${snapshot.nowPulse}.`
            : `${actorName}: Recovery ${remainingPulses} pulse${remainingPulses === 1 ? '' : 's'} remaining; ready at pulse ${readyAtPulse}; ${Math.round(readiness * 100)} percent ready.`,
      };
    });
  return deepFreeze(records);
}

/** Persistent selected-cell frame; it owns no simulation or wall-clock hold. */
export function createSelectedTargetFeedback({
  targetId,
  targetName,
  targetTile,
  nowMs = 0,
  reducedMotion = false,
} = {}) {
  const tile = exactTile(targetTile, 'targetTile');
  const id = String(targetId ?? 'target');
  const name = String(targetName ?? id);
  const cycle = (safeTime(nowMs) % 800) / 800;
  const pulse = reducedMotion ? 1 : 1 - Math.abs((cycle * 2) - 1);
  return deepFreeze({
    kind: 'selected-target',
    targetId: id,
    targetName: name,
    targetTile: tile,
    pulse: round(pulse),
    opacity: round(reducedMotion ? 0.92 : 0.72 + (pulse * 0.24)),
    reducedMotion: Boolean(reducedMotion),
    announcement: `Selected target ${name}, space ${tile.x},${tile.y}.`,
  });
}
