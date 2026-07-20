import { getNewStatusVfxSignals } from './status-vfx-atlas.mjs';

export const STATUS_VFX_EXPIRY_MS = 520;
export const STATUS_VFX_PRESENTATION_SPEEDS = Object.freeze([1, 2, 4]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function safeTime(value) {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function exactTile(tile) {
  if (!Number.isSafeInteger(tile?.x) || !Number.isSafeInteger(tile?.y)) return null;
  return { x: tile.x, y: tile.y };
}

function round(value) {
  return Math.round(value * 10_000) / 10_000;
}

/** Prefix safety and status mapping remain owned by the authored resolver. */
export function createStatusVfxExpiryPresentations({
  beforeSnapshot,
  afterSnapshot,
  startedAt = 0,
  speed = 1,
} = {}) {
  if (!STATUS_VFX_PRESENTATION_SPEEDS.includes(speed)) {
    throw new RangeError('Status VFX presentation speed must be 1, 2, or 4.');
  }
  const actors = Array.isArray(afterSnapshot?.actors) ? afterSnapshot.actors : [];
  const safeStartedAt = safeTime(startedAt);
  const durationMs = STATUS_VFX_EXPIRY_MS / speed;
  const records = getNewStatusVfxSignals(beforeSnapshot, afterSnapshot)
    .filter((signal) => signal.kind === 'expiry')
    .flatMap((signal) => {
      const actor = actors.find((candidate) => candidate.instanceId === signal.actorId);
      const tile = exactTile(actor?.pos);
      if (!actor || !tile) return [];
      return [{
        kind: 'status-expiry',
        eventType: signal.eventType,
        actorId: signal.actorId,
        actorName: String(actor.name ?? signal.actorId),
        statusId: signal.statusId,
        tile,
        pulse: signal.pulse,
        frame: signal.frame,
        baseDurationMs: STATUS_VFX_EXPIRY_MS,
        durationMs,
        startedAt: safeStartedAt,
        endsAt: safeStartedAt + durationMs,
        presentationSpeed: speed,
      }];
    });
  return deepFreeze(records);
}

export function sampleStatusVfxExpiryPresentations(records, nowMs, { reducedMotion = false } = {}) {
  const now = safeTime(nowMs);
  const sampled = (Array.isArray(records) ? records : []).flatMap((record) => {
    if (record?.kind !== 'status-expiry' || now < record.startedAt || now >= record.endsAt) return [];
    const progress = Math.max(0, Math.min(1, (now - record.startedAt) / record.durationMs));
    const pulse = reducedMotion ? 1 : 1 - Math.abs((progress * 2) - 1);
    return [{
      kind: record.kind,
      actorId: record.actorId,
      statusId: record.statusId,
      tile: record.tile,
      frame: record.frame,
      progress: round(reducedMotion ? 0.5 : progress),
      opacity: round(reducedMotion ? 0.9 : 0.88 - (progress * 0.56)),
      scale: round(reducedMotion ? 0.82 : 0.72 + (pulse * 0.24)),
      reducedMotion: Boolean(reducedMotion),
    }];
  });
  return deepFreeze(sampled);
}
