/**
 * Generic, DOM-free runtime for `bbc-animation-clips/1` character manifests.
 *
 * A manifest (written by skills/pixel-art-production/scripts/anim_sheet.py)
 * lists one character's sheets and clips; every clip frame carries its sheet
 * rectangle, pivot (the shared foot point in rect coordinates), duration,
 * optional band (windup / active / recovery), events, and a content hash.
 *
 * - `validateAnimationManifest` checks the schema, exact sheet geometry, frame
 *   rectangles, contiguous attack bands, and the 20-30 unique-frame standard.
 * - `sampleClipAtTime` samples loops and one-shots by elapsed milliseconds.
 * - `sampleClipAtProgress` samples a 0..1 fraction (stagger, transition, defeat).
 * - `sampleAttackPhase` samples one attack band by the simulation phase's
 *   progress, so the authored strike frame always lands on the active phase
 *   whatever duration gameplay tuning assigns to it.
 * - `createAnimationSheetLoader` lazily fetches one character's manifest and
 *   sheets on request, verifies exact image dimensions, and exposes a state
 *   per character so callers can fall back when anything is wrong.
 *
 * Reduced motion: loops hold their first key frame, attack bands show their
 * key frame (peak tell, strike, settle), and progress clips step only through
 * key frames. Tells stay visible; rapid cycling stops.
 */

export const ANIMATION_CLIP_SCHEMA = 'bbc-animation-clips/1';
export const ANIMATION_ATTACK_BANDS = Object.freeze(['windup', 'active', 'recovery']);
export const ANIMATION_CLIP_KINDS = Object.freeze(['loop', 'attack', 'progress', 'oneshot']);
export const ANIMATION_MAX_SHEET_WIDTH = 4096;
export const ANIMATION_UNIQUE_FRAME_STANDARD = Object.freeze([20, 30]);
export const ANIMATION_LOADER_STATES = Object.freeze(['unrequested', 'loading', 'ready', 'unavailable', 'invalid', 'wrong-size']);

export class AnimationManifestError extends Error {
  constructor(errors) {
    super(`Invalid animation manifest: ${errors.slice(0, 4).join('; ')}${errors.length > 4 ? ` (+${errors.length - 4} more)` : ''}`);
    this.name = 'AnimationManifestError';
    this.errors = Object.freeze([...errors]);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const isInteger = (value) => Number.isSafeInteger(value);
const isPoint = (value) => Array.isArray(value) && value.length === 2 && value.every(isInteger);

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

/**
 * Validate a manifest. Returns `{ ok, errors }`; never throws.
 *
 * Options: `minUnique` / `maxUnique` (the frame standard), `maxSheetWidth`,
 * `expectedCharacterId`, `requiredClips` (ids that must exist).
 */
export function validateAnimationManifest(manifest, {
  minUnique = ANIMATION_UNIQUE_FRAME_STANDARD[0],
  maxUnique = ANIMATION_UNIQUE_FRAME_STANDARD[1],
  maxSheetWidth = ANIMATION_MAX_SHEET_WIDTH,
  expectedCharacterId = null,
  requiredClips = [],
} = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest is not an object'] };
  if (manifest.schema !== ANIMATION_CLIP_SCHEMA) errors.push(`schema must be ${ANIMATION_CLIP_SCHEMA}`);
  if (typeof manifest.characterId !== 'string' || !manifest.characterId) errors.push('characterId is required');
  if (expectedCharacterId != null && manifest.characterId !== expectedCharacterId) {
    errors.push(`characterId ${manifest.characterId} does not match ${expectedCharacterId}`);
  }
  if (!['left', 'right'].includes(manifest.nativeFacing)) errors.push('nativeFacing must be left or right');
  if (!isPoint(manifest.logicalFrame) || !manifest.logicalFrame.every((v) => v > 0)) errors.push('logicalFrame must be [w, h]');
  if (!isPoint(manifest.footPoint)) errors.push('footPoint must be [x, y]');
  const sheets = Array.isArray(manifest.sheets) ? manifest.sheets : [];
  if (!sheets.length) errors.push('at least one sheet is required');
  sheets.forEach((sheet, index) => {
    if (typeof sheet?.path !== 'string' || !sheet.path || sheet.path.includes('..')) errors.push(`sheet ${index} path is invalid`);
    if (!isPositiveInteger(sheet?.width) || !isPositiveInteger(sheet?.height)) {
      errors.push(`sheet ${index} needs integer width and height`);
    } else if (sheet.width > maxSheetWidth) {
      errors.push(`sheet ${index} is ${sheet.width}px wide; the limit is ${maxSheetWidth}px`);
    }
  });
  const clips = Array.isArray(manifest.clips) ? manifest.clips : [];
  if (!clips.length) errors.push('at least one clip is required');
  const ids = new Set();
  for (const clip of clips) {
    const id = clip?.id;
    if (typeof id !== 'string' || !id) { errors.push('clip without id'); continue; }
    if (ids.has(id)) errors.push(`duplicate clip ${id}`);
    ids.add(id);
    if (!ANIMATION_CLIP_KINDS.includes(clip.kind)) errors.push(`${id}: unknown kind ${clip.kind}`);
    if (clip.loop !== (clip.kind === 'loop')) errors.push(`${id}: loop flag disagrees with kind`);
    const frames = Array.isArray(clip.frames) ? clip.frames : [];
    if (!frames.length) { errors.push(`${id}: no frames`); continue; }
    if (clip.frameCount !== undefined && clip.frameCount !== frames.length) errors.push(`${id}: frameCount mismatch`);
    frames.forEach((frame, index) => {
      const sheet = sheets[frame?.sheet];
      if (!isInteger(frame?.sheet) || !sheet) { errors.push(`${id}[${index}]: bad sheet index`); return; }
      const rect = frame.rect;
      if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(isInteger)) { errors.push(`${id}[${index}]: rect must be 4 integers`); return; }
      const [x, y, w, h] = rect;
      if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > sheet.width || y + h > sheet.height) {
        errors.push(`${id}[${index}]: rect lies outside sheet ${frame.sheet}`);
      }
      if (!isPoint(frame.pivot)) errors.push(`${id}[${index}]: pivot must be [x, y]`);
      if (!isPositiveInteger(frame.durationMs)) errors.push(`${id}[${index}]: durationMs must be a positive integer`);
      if (typeof frame.hash !== 'string' || !frame.hash) errors.push(`${id}[${index}]: content hash missing`);
      if (frame.events !== undefined && !Array.isArray(frame.events)) errors.push(`${id}[${index}]: events must be an array`);
    });
    const unique = new Set(frames.map((frame) => frame?.hash)).size;
    if (unique < minUnique || unique > maxUnique) {
      errors.push(`${id}: ${unique} unique frames; the standard is ${minUnique}-${maxUnique}`);
    }
    if (clip.uniqueFrames !== undefined && clip.uniqueFrames !== unique) errors.push(`${id}: uniqueFrames disagrees with frame hashes`);
    const keys = Array.isArray(clip.keyFrames) ? clip.keyFrames : [];
    if (!keys.length || keys.some((key) => !isInteger(key) || key < 0 || key >= frames.length)) {
      errors.push(`${id}: keyFrames must index frames`);
    }
    if (clip.kind === 'attack') {
      const bands = Array.isArray(clip.bands) ? clip.bands : [];
      if (bands.map((band) => band?.name).join() !== ANIMATION_ATTACK_BANDS.join()) {
        errors.push(`${id}: bands must be windup, active, recovery`);
      } else {
        let cursor = 0;
        for (const band of bands) {
          if (band.start !== cursor || !isPositiveInteger(band.count)) errors.push(`${id}: band ${band.name} is not contiguous`);
          if (!isInteger(band.key) || band.key < band.start || band.key >= band.start + band.count) {
            errors.push(`${id}: band ${band.name} key frame lies outside the band`);
          }
          for (let index = band.start; index < band.start + band.count && index < frames.length; index += 1) {
            if (frames[index].band !== band.name) { errors.push(`${id}[${index}]: band tag is not ${band.name}`); break; }
          }
          cursor = band.start + band.count;
        }
        if (cursor !== frames.length) errors.push(`${id}: bands do not cover every frame`);
      }
    } else if (frames.some((frame) => frame.band !== undefined)) {
      errors.push(`${id}: only attack clips carry bands`);
    }
  }
  for (const required of requiredClips) if (!ids.has(required)) errors.push(`required clip ${required} is missing`);
  return { ok: errors.length === 0, errors };
}

/** Validate, index, and freeze a manifest for sampling. Throws AnimationManifestError. */
export function prepareAnimationManifest(manifest, options = {}) {
  const { ok, errors } = validateAnimationManifest(manifest, options);
  if (!ok) throw new AnimationManifestError(errors);
  const frozen = deepFreeze(structuredClone(manifest));
  const clips = new Map();
  for (const clip of frozen.clips) {
    const total = clip.frames.reduce((sum, frame) => sum + frame.durationMs, 0);
    const bands = new Map((clip.bands ?? []).map((band) => [band.name, band]));
    clips.set(clip.id, Object.freeze({
      clip,
      totalMs: total,
      bands,
      uniqueFrames: new Set(clip.frames.map((frame) => frame.hash)).size,
    }));
  }
  return Object.freeze({ manifest: frozen, characterId: frozen.characterId, clips });
}

function clipRecord(prepared, clipId) {
  const record = prepared?.clips?.get(clipId);
  if (!record) throw new RangeError(`Unknown animation clip ${clipId} for ${prepared?.characterId}`);
  return record;
}

function sampleRecord(prepared, record, index, extra) {
  const frame = record.clip.frames[index];
  return Object.freeze({
    characterId: prepared.characterId,
    clipId: record.clip.id,
    kind: record.clip.kind,
    index,
    frameCount: record.clip.frames.length,
    uniqueFrames: record.uniqueFrames,
    band: frame.band ?? null,
    events: frame.events ?? [],
    key: frame.key === true,
    sheet: frame.sheet,
    rect: frame.rect,
    pivot: frame.pivot,
    hash: frame.hash,
    ...extra,
  });
}

/** Index of the frame active at `cursorMs` across frames `start..end` (inclusive) by duration. */
function indexByDuration(frames, start, end, cursorMs) {
  let cursor = cursorMs;
  for (let index = start; index <= end; index += 1) {
    if (cursor < frames[index].durationMs) return index;
    cursor -= frames[index].durationMs;
  }
  return end;
}

function reducedKeyIndex(clip, wanted) {
  const keys = clip.keyFrames;
  let chosen = keys[0];
  for (const key of keys) if (key <= wanted) chosen = key;
  return chosen;
}

/** Sample by elapsed time. Loops wrap; one-shots and progress clips hold their last frame. */
export function sampleClipAtTime(prepared, clipId, elapsedMs = 0, { reducedMotion = false } = {}) {
  const record = clipRecord(prepared, clipId);
  const { clip, totalMs } = record;
  const safe = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  if (clip.loop) {
    if (reducedMotion) return sampleRecord(prepared, record, clip.keyFrames[0], { cycle: 0, complete: false, progress: 0 });
    const cycle = Math.floor(safe / totalMs);
    const local = safe - cycle * totalMs;
    const index = indexByDuration(clip.frames, 0, clip.frames.length - 1, local);
    return sampleRecord(prepared, record, index, { cycle, complete: false, progress: local / totalMs });
  }
  const complete = safe >= totalMs;
  const local = Math.min(safe, totalMs - 1);
  let index = indexByDuration(clip.frames, 0, clip.frames.length - 1, local);
  if (reducedMotion) index = reducedKeyIndex(clip, index);
  return sampleRecord(prepared, record, index, { cycle: 0, complete, progress: Math.min(1, safe / totalMs) });
}

/** Sample a non-attack clip by a 0..1 fraction of its gameplay-owned duration. */
export function sampleClipAtProgress(prepared, clipId, progress = 0, { reducedMotion = false } = {}) {
  const record = clipRecord(prepared, clipId);
  const { clip, totalMs } = record;
  const fraction = clamp01(progress);
  const cursor = Math.min(totalMs - 1, Math.floor(totalMs * fraction));
  let index = indexByDuration(clip.frames, 0, clip.frames.length - 1, cursor);
  if (reducedMotion) index = reducedKeyIndex(clip, index);
  return sampleRecord(prepared, record, index, { cycle: 0, complete: fraction >= 1, progress: fraction });
}

/**
 * Sample one attack band by the simulation phase's progress (0..1). Frame
 * durations inside the band are relative weights, so holds authored on the
 * peak tell stretch with whatever wind-up length gameplay chooses.
 */
export function sampleAttackPhase(prepared, clipId, phase, phaseProgress = 0, { reducedMotion = false } = {}) {
  const record = clipRecord(prepared, clipId);
  const band = record.bands.get(phase);
  if (!band) throw new RangeError(`Clip ${clipId} has no ${phase} band`);
  const fraction = clamp01(phaseProgress);
  const frames = record.clip.frames;
  const end = band.start + band.count - 1;
  let index;
  if (reducedMotion) {
    index = band.key;
  } else {
    let bandTotal = 0;
    for (let i = band.start; i <= end; i += 1) bandTotal += frames[i].durationMs;
    index = indexByDuration(frames, band.start, end, Math.min(bandTotal - 1, Math.floor(bandTotal * fraction)));
  }
  return sampleRecord(prepared, record, index, {
    cycle: 0,
    complete: phase === 'recovery' && fraction >= 1,
    progress: fraction,
    phase,
    bandIndex: index - band.start,
    bandCount: band.count,
  });
}

/**
 * Destination geometry for drawing a sample with its pivot on (anchorX,
 * anchorY). `flip` is true when the actor faces away from the art's native
 * facing; callers mirror around anchorX (translate, scale(-1, 1)).
 */
export function animationDrawPlacement(prepared, sample, { anchorX = 0, anchorY = 0, scale = 1, facing = 1 } = {}) {
  if (!(scale > 0)) throw new RangeError('scale must be positive');
  const native = prepared.manifest.nativeFacing === 'left' ? -1 : 1;
  const [sx, sy, sw, sh] = sample.rect;
  const [px, py] = sample.pivot;
  return Object.freeze({
    sheet: sample.sheet,
    sx,
    sy,
    sw,
    sh,
    flip: Math.sign(facing || native) !== native,
    // Offsets relative to the anchor, for drawing after translate(anchorX, anchorY).
    ox: -px * scale,
    oy: -py * scale,
    dw: sw * scale,
    dh: sh * scale,
    anchorX,
    anchorY,
  });
}

/** True only for a decoded image whose natural size equals the manifest sheet exactly. */
export function animationSheetMatches(image, sheet) {
  return Boolean(image && sheet)
    && image.naturalWidth === sheet.width
    && image.naturalHeight === sheet.height;
}

function sheetUrl(manifestUrl, path) {
  const slash = manifestUrl.lastIndexOf('/');
  return `${slash >= 0 ? manifestUrl.slice(0, slash + 1) : ''}${path}`;
}

function loadImage(createImage, url) {
  return new Promise((resolve, reject) => {
    const image = createImage();
    const onLoad = () => resolve(image);
    const onError = () => reject(new Error(`Sheet failed to load: ${url}`));
    if (typeof image.addEventListener === 'function') {
      image.addEventListener('load', onLoad, { once: true });
      image.addEventListener('error', onError, { once: true });
    } else {
      image.onload = onLoad;
      image.onerror = onError;
    }
    if ('decoding' in image) image.decoding = 'async';
    image.src = url;
  });
}

/**
 * Lazy per-character loader. Nothing is fetched until `request(id)`; each
 * character's manifest and only its own sheets are loaded, once.
 *
 * States: unrequested -> loading -> ready | unavailable (fetch/decode error,
 * unknown character) | invalid (manifest failed validation) | wrong-size
 * (a sheet's natural size differs from the manifest). `get(id)` returns a
 * record only when ready, so callers fall back on every other state.
 */
export function createAnimationSheetLoader({
  resolveManifestUrl,
  fetchJson,
  createImage,
  validateOptions = {},
  onChange = () => {},
} = {}) {
  if (typeof resolveManifestUrl !== 'function' || typeof fetchJson !== 'function' || typeof createImage !== 'function') {
    throw new TypeError('resolveManifestUrl, fetchJson, and createImage are required');
  }
  const entries = new Map();

  function setState(id, entry) {
    entries.set(id, entry);
    onChange(id, entry.state, entry);
  }

  async function load(id) {
    const manifestUrl = resolveManifestUrl(id);
    if (!manifestUrl) {
      setState(id, Object.freeze({ state: 'unavailable', error: 'unmapped character' }));
      return entries.get(id);
    }
    let manifest;
    try {
      manifest = await fetchJson(manifestUrl);
    } catch (error) {
      setState(id, Object.freeze({ state: 'unavailable', error: String(error?.message ?? error) }));
      return entries.get(id);
    }
    let prepared;
    try {
      prepared = prepareAnimationManifest(manifest, { expectedCharacterId: id, ...validateOptions });
    } catch (error) {
      setState(id, Object.freeze({ state: 'invalid', error: String(error?.message ?? error), errors: error?.errors ?? [] }));
      return entries.get(id);
    }
    let images;
    try {
      images = await Promise.all(prepared.manifest.sheets.map((sheet) => loadImage(createImage, sheetUrl(manifestUrl, sheet.path))));
    } catch (error) {
      setState(id, Object.freeze({ state: 'unavailable', error: String(error?.message ?? error) }));
      return entries.get(id);
    }
    const mismatch = prepared.manifest.sheets.findIndex((sheet, index) => !animationSheetMatches(images[index], sheet));
    if (mismatch >= 0) {
      const sheet = prepared.manifest.sheets[mismatch];
      setState(id, Object.freeze({
        state: 'wrong-size',
        error: `sheet ${sheet.path} is ${images[mismatch]?.naturalWidth}x${images[mismatch]?.naturalHeight}, expected ${sheet.width}x${sheet.height}`,
      }));
      return entries.get(id);
    }
    setState(id, Object.freeze({ state: 'ready', prepared, images: Object.freeze(images) }));
    return entries.get(id);
  }

  return Object.freeze({
    request(id) {
      const existing = entries.get(id);
      if (existing?.promise) return existing.promise;
      if (existing && existing.state !== 'loading') return Promise.resolve(existing);
      // Enter `loading` before any work runs, so a synchronous failure cannot be overwritten.
      const promise = Promise.resolve().then(() => load(id));
      setState(id, Object.freeze({ state: 'loading', promise }));
      return promise;
    },
    get(id) {
      const entry = entries.get(id);
      return entry?.state === 'ready' ? entry : null;
    },
    state(id) {
      return entries.get(id)?.state ?? 'unrequested';
    },
    states() {
      return Object.freeze(Object.fromEntries([...entries].map(([id, entry]) => [id, entry.state])));
    },
    release(id) {
      entries.delete(id);
    },
  });
}
