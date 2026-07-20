/** Deterministic, simulation-free presentation records for non-attack commands. */

import { getObjectiveTokenPlacements } from './objective-presentation.mjs';

export const BATTLE_COMMAND_PRESENTATION_SPEEDS = Object.freeze([1, 2, 4]);

export const BATTLE_COMMAND_PRESENTATION_MS = Object.freeze({
  guard: 400,
  dodge: 400,
  analyze: 480,
  objective: 480,
});

export const BATTLE_COMMAND_PRESENTATION_BOUNDS = Object.freeze({
  minimumBaseDurationMs: 400,
  maximumBaseDurationMs: 480,
});

const DEFAULT_VISUALS = Object.freeze({
  guard: Object.freeze({ marker: 'shield', color: '#82c8ef', accentColor: '#d8f2ff' }),
  dodge: Object.freeze({ marker: 'chevron', color: '#a98ae6', accentColor: '#f0e5ff' }),
  analyze: Object.freeze({ marker: 'scan', color: '#f1d386', accentColor: '#fff2ab' }),
  objective: Object.freeze({ marker: 'objective', color: '#d0b36b', accentColor: '#fff0bd' }),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function safeTime(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function exactTile(tile, field) {
  if (!Number.isSafeInteger(tile?.x) || !Number.isSafeInteger(tile?.y)) {
    throw new TypeError(`${field} must be an exact integer tile.`);
  }
  return { x: tile.x, y: tile.y };
}

/** Match the board's first-incomplete objective-token authority exactly. */
export function getBattleObjectiveCommandTile({ level, requirement, actors = [], fallbackTile } = {}) {
  const fallback = exactTile(fallbackTile, 'fallbackTile');
  if (!level || !requirement) return Object.freeze(fallback);
  const occupied = actors
    .filter((actor) => actor?.hp > 0 && actor.active !== false)
    .map((actor) => `${actor.pos.x},${actor.pos.y}`);
  const placement = getObjectiveTokenPlacements(level, [requirement], occupied)
    .find((candidate) => !candidate.complete);
  return Object.freeze(placement ? { x: placement.x, y: placement.y } : fallback);
}

function nonempty(value, fallback) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function announcementFor(type, actorName, targetName, label, detail) {
  let announcement;
  if (type === 'guard') announcement = `${actorName} guards.`;
  else if (type === 'dodge') announcement = `${actorName} readies Dodge.`;
  else if (type === 'analyze') announcement = `${actorName} analyzes ${targetName}.`;
  else announcement = `${actorName}: ${label}.`;
  return detail ? `${announcement} ${detail}` : announcement;
}

/** Create one bounded record after, never before, a successful engine command. */
export function createBattleCommandPresentation({
  type,
  actorId,
  actorName,
  actorTile,
  targetId = null,
  targetName = null,
  targetTile = null,
  objectiveAction = null,
  label = null,
  marker = null,
  color = null,
  accentColor = null,
  detail = null,
  startedAt = 0,
  speed = 1,
} = {}) {
  if (!Object.hasOwn(BATTLE_COMMAND_PRESENTATION_MS, type)) {
    throw new RangeError(`Unsupported battle command presentation: ${type}`);
  }
  if (!BATTLE_COMMAND_PRESENTATION_SPEEDS.includes(speed)) {
    throw new RangeError('Battle command presentation speed must be 1, 2, or 4.');
  }
  const source = exactTile(actorTile, 'actorTile');
  const actorLocal = type === 'guard' || type === 'dodge';
  const target = actorLocal
    ? source
    : exactTile(targetTile, 'targetTile');
  const resolvedActorId = nonempty(actorId, 'actor');
  const resolvedActorName = nonempty(actorName, resolvedActorId);
  const resolvedTargetId = actorLocal ? resolvedActorId : nonempty(targetId, 'target');
  const resolvedTargetName = actorLocal ? resolvedActorName : nonempty(targetName, resolvedTargetId);
  const defaultVisual = DEFAULT_VISUALS[type];
  const resolvedLabel = type === 'objective' ? nonempty(label, 'Advance Objective') : null;
  const baseDurationMs = BATTLE_COMMAND_PRESENTATION_MS[type];
  const durationMs = baseDurationMs / speed;
  const safeStartedAt = safeTime(startedAt);
  return deepFreeze({
    type,
    actorId: resolvedActorId,
    actorName: resolvedActorName,
    actorTile: source,
    targetId: resolvedTargetId,
    targetName: resolvedTargetName,
    targetTile: target,
    objectiveAction: type === 'objective' ? nonempty(objectiveAction, 'objective') : null,
    label: resolvedLabel,
    marker: nonempty(marker, defaultVisual.marker),
    color: nonempty(color, defaultVisual.color),
    accentColor: nonempty(accentColor, defaultVisual.accentColor),
    announcement: announcementFor(type, resolvedActorName, resolvedTargetName, resolvedLabel, nonempty(detail, '')),
    startedAt: safeStartedAt,
    baseDurationMs,
    durationMs,
    endsAt: safeStartedAt + durationMs,
    presentationSpeed: speed,
  });
}

function round(value) {
  return Math.round(value * 10_000) / 10_000;
}

/** Sample a record without clocks, DOM, canvas, or combat-state mutation. */
export function sampleBattleCommandPresentation(record, nowMs, { reducedMotion = false } = {}) {
  if (!record || !Object.hasOwn(BATTLE_COMMAND_PRESENTATION_MS, record.type)) return null;
  const now = safeTime(nowMs);
  if (now < record.startedAt || now >= record.endsAt) return null;
  const rawProgress = record.durationMs > 0 ? (now - record.startedAt) / record.durationMs : 1;
  const progress = Math.max(0, Math.min(1, rawProgress));
  const pulse = reducedMotion ? 1 : 1 - Math.abs((progress * 2) - 1);
  const phase = reducedMotion ? 'hold' : progress < 0.25 ? 'appear' : progress < 0.75 ? 'hold' : 'release';
  return deepFreeze({
    type: record.type,
    phase,
    actorTile: record.actorTile,
    targetTile: record.targetTile,
    marker: record.marker,
    color: record.color,
    accentColor: record.accentColor,
    progress: round(reducedMotion ? 0.5 : progress),
    pulse: round(pulse),
    opacity: round(reducedMotion ? 0.9 : 0.55 + (pulse * 0.4)),
    radiusScale: round(reducedMotion ? 1 : 0.84 + (progress * 0.24)),
    linkProgress: ['guard', 'dodge'].includes(record.type) ? 0 : round(reducedMotion ? 1 : Math.min(1, progress * 2.5)),
    reducedMotion: Boolean(reducedMotion),
  });
}

export function battleCommandPresentationIsActive(record, nowMs) {
  const now = safeTime(nowMs);
  return Boolean(record && now >= record.startedAt && now < record.endsAt);
}

/** Latest wall-clock boundary across attack and command presentation records. */
export function getBattlePresentationBoundary(...records) {
  const ends = records.map((record) => record?.endsAt).filter(Number.isFinite);
  return ends.length ? Math.max(...ends) : null;
}
