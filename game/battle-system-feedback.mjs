/** Pure, code-native feedback records for exact board interaction. */

export const BATTLE_SYSTEM_FEEDBACK_SPEEDS = Object.freeze([1, 2, 4]);

export const BATTLE_SYSTEM_FEEDBACK_MS = Object.freeze({
  'move-destination': 320,
  'move-blocked': 480,
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
  if (!record || !Object.hasOwn(BATTLE_SYSTEM_FEEDBACK_MS, record.kind)) return null;
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
