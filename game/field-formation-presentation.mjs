import { PARTY_ATLAS_DIRECTIONS, PARTY_ATLAS_MEMBERS } from './sprite-atlas.mjs';

export const FIELD_FORMATION_TRAIL_LIMIT = 84;

const EMPTY_TRAIL = Object.freeze([]);
const EMPTY_PLACEMENTS = Object.freeze([]);

function isExactId(value) {
  return typeof value === 'string' && value.length > 0 && value.trim() === value;
}

function isExactPosition(position) {
  return Boolean(position)
    && Number.isSafeInteger(position.x)
    && Number.isSafeInteger(position.y)
    && position.x >= 0
    && position.y >= 0;
}

function isCanonicalFormation(formation, leaderId) {
  return Array.isArray(formation)
    && formation.length > 0
    && formation.every((memberId) => PARTY_ATLAS_MEMBERS.includes(memberId))
    && new Set(formation).size === formation.length
    && formation.includes(leaderId);
}

function createState(contextKey, trail = EMPTY_TRAIL) {
  return Object.freeze({ contextKey, trail: Object.freeze(trail) });
}

function isOwnedStateForContext(state, contextKey) {
  return Boolean(state)
    && state.contextKey === contextKey
    && Array.isArray(state.trail)
    && Object.isFrozen(state)
    && Object.isFrozen(state.trail);
}

function blockedPositionKeys(blocked) {
  if (!Array.isArray(blocked) && !(blocked instanceof Set)) return null;
  const keys = new Set();
  for (const entry of blocked) {
    if (typeof entry === 'string' && /^\d+,\d+$/u.test(entry)) {
      keys.add(entry);
      continue;
    }
    if (isExactPosition(entry)) {
      keys.add(`${entry.x},${entry.y}`);
      continue;
    }
    return null;
  }
  return keys;
}

/**
 * Address one presentation context without observing saves, route flags, or
 * simulation events. JSON encoding keeps every component and formation order
 * unambiguous while the version tag permits a future presentation-only reset.
 */
export function getFieldFormationPresentationContextKey({
  levelId,
  beatId,
  formation,
  leaderId,
} = {}) {
  if (!isExactId(levelId) || !isExactId(beatId) || !isExactId(leaderId)) return null;
  if (!isCanonicalFormation(formation, leaderId)) return null;
  return JSON.stringify(['field-formation-v1', levelId, beatId, formation, leaderId]);
}

export function createFieldFormationPresentation(context = {}) {
  return createState(getFieldFormationPresentationContextKey(context));
}

/** Reset only when the level, beat, canonical formation, or effective leader changes. */
export function syncFieldFormationPresentation(state, context = {}) {
  const contextKey = getFieldFormationPresentationContextKey(context);
  return isOwnedStateForContext(state, contextKey) ? state : createState(contextKey);
}

/**
 * Record the exact tile the leader departed, but only after the caller confirms
 * that an authoritative move and its persistence transaction both succeeded.
 */
export function recordFieldFormationDeparture(state, {
  levelId,
  beatId,
  formation,
  leaderId,
  moved = false,
  position,
  facing,
} = {}) {
  const next = syncFieldFormationPresentation(state, { levelId, beatId, formation, leaderId });
  if (moved !== true || next.contextKey === null) return next;
  if (!isExactPosition(position) || !PARTY_ATLAS_DIRECTIONS.includes(facing)) return next;
  const node = Object.freeze({ x: position.x, y: position.y, facing });
  return createState(next.contextKey, [node, ...next.trail].slice(0, FIELD_FORMATION_TRAIL_LIMIT));
}

/**
 * Resolve decorative followers from successful departed tiles. The current
 * party tile and every blocked, duplicate, malformed, or out-of-bounds node is
 * suppressed; missing history simply produces fewer followers.
 */
export function resolveFieldFollowerPlacements(state, {
  levelId,
  beatId,
  formation,
  leaderId,
  currentPosition,
  width,
  height,
  blocked = EMPTY_TRAIL,
} = {}) {
  const contextKey = getFieldFormationPresentationContextKey({ levelId, beatId, formation, leaderId });
  if (!contextKey || state?.contextKey !== contextKey || !Array.isArray(state?.trail)) return EMPTY_PLACEMENTS;
  if (!isExactPosition(currentPosition)
    || !Number.isSafeInteger(width) || width <= 0
    || !Number.isSafeInteger(height) || height <= 0
    || currentPosition.x >= width || currentPosition.y >= height) return EMPTY_PLACEMENTS;
  const blockedKeys = blockedPositionKeys(blocked);
  if (!blockedKeys) return EMPTY_PLACEMENTS;

  const followerIds = formation.filter((memberId) => memberId !== leaderId);
  if (!followerIds.length) return EMPTY_PLACEMENTS;
  const currentKey = `${currentPosition.x},${currentPosition.y}`;
  const usedKeys = new Set([currentKey]);
  const placements = [];

  for (const node of state.trail) {
    if (placements.length >= followerIds.length) break;
    if (!isExactPosition(node) || !PARTY_ATLAS_DIRECTIONS.includes(node.facing)) continue;
    if (node.x >= width || node.y >= height) continue;
    const key = `${node.x},${node.y}`;
    if (usedKeys.has(key) || blockedKeys.has(key)) continue;
    usedKeys.add(key);
    placements.push(Object.freeze({
      memberId: followerIds[placements.length],
      position: Object.freeze({ x: node.x, y: node.y }),
      facing: node.facing,
    }));
  }
  return placements.length ? Object.freeze(placements) : EMPTY_PLACEMENTS;
}
