/**
 * Pure geometry and progress mapping for the post-animation cooldown ring drawn
 * above party fighters. Presentation only: these functions read cooldown
 * numbers and never change combat state.
 *
 * The ring is a stepped circle of square pips (no arcs, no anti-aliasing). It
 * sweeps clockwise from 12 o'clock and is fully lit exactly when the shared
 * offensive cooldown reaches zero. An optional outer ring shows a longer
 * per-art cooldown.
 */

export const COOLDOWN_RING_INNER = Object.freeze({ radius: 6, segments: 12, pip: 3 });
export const COOLDOWN_RING_OUTER = Object.freeze({ radius: 10, segments: 18, pip: 3 });
/** Vertical distance from the fighter's feet to the ring centre. */
export const COOLDOWN_RING_CENTER_OFFSET = 98;
/** Distance from the feet to the bottom edge of a party name label above the ring. */
export const PARTY_LABEL_BOTTOM_OFFSET = 113;
export const COOLDOWN_GLINT_MS = 240;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

/**
 * Pip centres for a ring, clockwise from 12 o'clock, rounded to whole pixels.
 * @returns {Array<{x:number,y:number}>} offsets from the ring centre
 */
export function cooldownRingPips({ radius, segments }) {
  const pips = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    pips.push({
      x: Math.round(Math.sin(angle) * radius) + 0,
      y: 0 - Math.round(Math.cos(angle) * radius),
    });
  }
  return pips;
}

/**
 * Map remaining/total milliseconds to a swept fraction and a lit-pip count.
 * Nothing is lit at the start of a cooldown; every pip is lit at zero.
 */
export function cooldownRingProgress(remainingMs, totalMs, segments = COOLDOWN_RING_INNER.segments) {
  const total = Number.isFinite(totalMs) ? totalMs : 0;
  const remaining = Number.isFinite(remainingMs) ? remainingMs : 0;
  if (total <= 0 || remaining <= 0) {
    return { fraction: 1, filled: segments, segments, ready: true };
  }
  const fraction = clamp01(1 - remaining / total);
  return { fraction, filled: Math.min(segments - 1, Math.floor(fraction * segments)), segments, ready: false };
}

/** Bounding box of a ring around a centre, including pip size and one pixel of backing. */
export function cooldownRingBox(centerX, centerY, ring = COOLDOWN_RING_INNER) {
  const reach = ring.radius + Math.ceil(ring.pip / 2) + 1;
  return {
    left: Math.round(centerX) - reach,
    right: Math.round(centerX) + reach + 1,
    top: Math.round(centerY) - reach,
    bottom: Math.round(centerY) + reach + 1,
  };
}

/** Where the ring sits for a fighter standing at the given foot position. */
export function cooldownRingCenter(footX, footY) {
  return { x: Math.round(footX), y: Math.round(footY - COOLDOWN_RING_CENTER_OFFSET) };
}

/**
 * Advance one fighter's ring tracker. `total` is the largest remaining value
 * seen since the cooldown began (the kernel only exposes remaining time), so a
 * jump upward starts a new sweep. Completion stamps `completedAtMs` once.
 */
export function advanceCooldownTracker(previous, remainingMs, nowMs) {
  const remaining = Math.max(0, Number.isFinite(remainingMs) ? remainingMs : 0);
  const prev = previous ?? { totalMs: 0, remainingMs: 0, completedAtMs: null };
  let totalMs = prev.totalMs;
  let completedAtMs = prev.completedAtMs;
  if (remaining > prev.remainingMs) {
    totalMs = remaining;
    completedAtMs = null;
  } else if (remaining === 0 && prev.remainingMs > 0) {
    completedAtMs = nowMs;
  }
  if (remaining === 0 && prev.remainingMs === 0 && completedAtMs == null) totalMs = 0;
  return { totalMs, remainingMs: remaining, completedAtMs };
}

/** Glint stage 0..3 while the ready flash plays; null when finished or reduced motion. */
export function cooldownGlintStage(completedAtMs, nowMs, reducedMotion = false) {
  if (reducedMotion || completedAtMs == null) return null;
  const since = nowMs - completedAtMs;
  if (since < 0 || since >= COOLDOWN_GLINT_MS) return null;
  return Math.min(3, Math.floor(since / (COOLDOWN_GLINT_MS / 4)));
}

/**
 * Decide which rings to show. The outer ring appears only when a per-art
 * cooldown is still running longer than the shared offensive cooldown.
 */
export function cooldownRingPlan({ sharedRemainingMs = 0, sharedTotalMs = 0, artRemainingMs = 0, artTotalMs = 0,
  completedAtMs = null, nowMs = 0, reducedMotion = false } = {}) {
  const sharedActive = sharedRemainingMs > 0;
  const artActive = artRemainingMs > sharedRemainingMs && artRemainingMs > 0;
  const glint = !sharedActive && !artActive ? cooldownGlintStage(completedAtMs, nowMs, reducedMotion) : null;
  const visible = sharedActive || artActive || glint != null;
  return {
    visible,
    inner: sharedActive || glint != null
      ? cooldownRingProgress(sharedRemainingMs, sharedTotalMs, COOLDOWN_RING_INNER.segments)
      : null,
    outer: artActive ? cooldownRingProgress(artRemainingMs, artTotalMs, COOLDOWN_RING_OUTER.segments) : null,
    glint,
    reducedMotion,
  };
}
