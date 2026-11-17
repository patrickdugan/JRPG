/**
 * Runtime metadata and pure sampling for party-animation-suite-v2: the 20-30
 * frame idle, move, tired, banded strike, guard, hurt, signature and defeat
 * clips. The atlas is optional; callers fall back to the 4-6 frame clips in
 * roster-animation-atlas.mjs when it has not loaded.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const PARTY_EXTENDED_GEOMETRY = deepFreeze({
  frameWidth: 48,
  frameHeight: 64,
  columns: 30,
  rows: 70,
  width: 1440,
  height: 4480,
  pivot: [24, 58],
  url: './assets/art/party-animation-suite-v2/party-animation-atlas-v2.png',
});

export const PARTY_EXTENDED_CHARACTERS = deepFreeze(['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku', 'miyo']);

const BANDS = { windup: [0, 6], active: [7, 12], recovery: [13, 20] };

export const PARTY_EXTENDED_CLIPS = deepFreeze([
  { id: 'idle', frames: 24, ms: 90, loop: true },
  { id: 'move', frames: 20, ms: 40, loop: true },
  { id: 'tired', frames: 24, ms: 60, loop: false, bands: { 'slump-in': [0, 5], 'heavy-breath': [6, 17], straighten: [18, 23] } },
  { id: 'ready-snap', frames: 6, ms: 45, loop: false },
  { id: 'basic-strike', frames: 21, ms: 40, loop: false, bands: BANDS, event: { name: 'damage', frame: 7 } },
  { id: 'guard', frames: 24, ms: 35, loop: false, event: { name: 'guard', frame: 3 } },
  { id: 'hurt', frames: 22, ms: 20, loop: false },
  { id: 'signature-a', frames: 21, ms: 40, loop: false, bands: BANDS, event: { name: 'skill-a', frame: 7 } },
  { id: 'signature-b', frames: 21, ms: 40, loop: false, bands: BANDS, event: { name: 'skill-b', frame: 7 } },
  { id: 'defeat', frames: 20, ms: 55, loop: false },
]);

/** Cooldowns up to this long play the whole tired clip once, scaled to the cooldown. */
export const TIRED_SCALED_MAX_MS = 1100;
const TIRED_EDGE_FRAMES = 6;
const TIRED_EDGE_MS = 55;
const TIRED_LOOP_MS = 80;
export const READY_SNAP_MS = 6 * 45;

const CHARACTER_INDEX = new Map(PARTY_EXTENDED_CHARACTERS.map((id, index) => [id, index]));
const CLIP_INDEX = new Map(PARTY_EXTENDED_CLIPS.map((clip, index) => [clip.id, index]));

function lookup(characterId, clipId) {
  const characterIndex = CHARACTER_INDEX.get(characterId);
  const clipIndex = CLIP_INDEX.get(clipId);
  if (characterIndex == null) throw new RangeError(`Unknown party extended character: ${characterId}`);
  if (clipIndex == null) throw new RangeError(`Unknown party extended clip: ${clipId}`);
  return { clip: PARTY_EXTENDED_CLIPS[clipIndex], row: characterIndex * PARTY_EXTENDED_CLIPS.length + clipIndex };
}

function result(characterId, clip, row, localFrame, extra = {}) {
  const frame = Math.max(0, Math.min(clip.frames - 1, localFrame));
  return deepFreeze({
    characterId,
    clipId: clip.id,
    localFrame: frame,
    event: clip.event?.frame === frame ? clip.event.name : null,
    rect: [frame * PARTY_EXTENDED_GEOMETRY.frameWidth, row * PARTY_EXTENDED_GEOMETRY.frameHeight,
      PARTY_EXTENDED_GEOMETRY.frameWidth, PARTY_EXTENDED_GEOMETRY.frameHeight],
    pivot: [...PARTY_EXTENDED_GEOMETRY.pivot],
    atlas: 'extended',
    ...extra,
  });
}

/** Time-driven sample for looping and one-shot clips. */
export function samplePartyExtended(characterId, clipId, elapsedMs = 0) {
  const { clip, row } = lookup(characterId, clipId);
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  const total = clip.frames * clip.ms;
  const local = clip.loop ? Math.floor((elapsed % total) / clip.ms) : Math.min(clip.frames - 1, Math.floor(elapsed / clip.ms));
  return result(characterId, clip, row, local, { complete: !clip.loop && elapsed >= total });
}

/** Progress-driven sample for clips banded by simulation phase (windup, active, recovery). */
export function samplePartyExtendedPhase(characterId, clipId, phase, phaseProgress = 0) {
  const { clip, row } = lookup(characterId, clipId);
  const band = clip.bands?.[phase];
  if (!band) return samplePartyExtendedProgress(characterId, clipId, phaseProgress);
  const [start, end] = band;
  const progress = Math.max(0, Math.min(1, Number.isFinite(phaseProgress) ? phaseProgress : 0));
  const local = start + Math.min(end - start, Math.floor(progress * (end - start + 1)));
  return result(characterId, clip, row, local, { phase, phaseProgress: progress });
}

/** Progress-driven sample across the whole clip (hit-stun fraction, for example). */
export function samplePartyExtendedProgress(characterId, clipId, progress = 0) {
  const { clip, row } = lookup(characterId, clipId);
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return result(characterId, clip, row, Math.floor(p * clip.frames), { phaseProgress: p });
}

/**
 * Tired loop, driven by the shared offensive cooldown. Short cooldowns play the
 * whole clip once so the straighten band lands exactly as the ring completes.
 * Long cooldowns slump in, loop the heavy-breath band, then straighten over the
 * last stretch so the pose still ends the moment the ring does.
 */
export function samplePartyTired(characterId, remainingMs, totalMs) {
  const { clip, row } = lookup(characterId, 'tired');
  const total = Math.max(0, Number.isFinite(totalMs) ? totalMs : 0);
  const remaining = Math.max(0, Math.min(total, Number.isFinite(remainingMs) ? remainingMs : 0));
  const elapsed = total - remaining;
  const edgeSpan = TIRED_EDGE_FRAMES * TIRED_EDGE_MS;
  let local;
  let band;
  if (total <= TIRED_SCALED_MAX_MS || total < edgeSpan * 2 + TIRED_LOOP_MS) {
    local = Math.min(clip.frames - 1, Math.floor((elapsed / Math.max(1, total)) * clip.frames));
    band = bandFor(clip, local);
  } else if (elapsed < edgeSpan) {
    local = Math.floor(elapsed / TIRED_EDGE_MS);
    band = 'slump-in';
  } else if (remaining <= edgeSpan) {
    local = 18 + Math.min(TIRED_EDGE_FRAMES - 1, Math.floor((edgeSpan - remaining) / TIRED_EDGE_MS));
    band = 'straighten';
  } else {
    local = 6 + (Math.floor((elapsed - edgeSpan) / TIRED_LOOP_MS) % 12);
    band = 'heavy-breath';
  }
  return result(characterId, clip, row, local, { band, progress: total ? elapsed / total : 1 });
}

function bandFor(clip, local) {
  for (const [name, [start, end]] of Object.entries(clip.bands)) if (local >= start && local <= end) return name;
  return null;
}

/**
 * Pure policy for the cooldown pose. The tired loop plays only while the fighter
 * stands free (no commitment, hit-stun, maneuver or movement) and the shared
 * offensive cooldown runs. The snap-to-ready clip follows completion.
 *
 * @returns {{clipId:'tired'|'ready-snap'|null, sampling?:object}}
 */
export function resolveCooldownPose({
  free, sharedRemainingMs, sharedTotalMs, completedAtMs = null, nowMs = 0, reducedMotion = false,
}) {
  if (!free) return { clipId: null };
  if (sharedRemainingMs > 0 && sharedTotalMs > 0) return { clipId: 'tired' };
  if (!reducedMotion && completedAtMs != null) {
    const since = nowMs - completedAtMs;
    if (since >= 0 && since < READY_SNAP_MS) return { clipId: 'ready-snap', sinceMs: since };
  }
  return { clipId: null };
}
