import { validateHdArtManifest } from './hd-painted-animation.mjs';
import { HD_MOTION_CLIPS, validateHdMotionManifest } from './hd-painted-motion.mjs';

export const HD_BOSSES = Object.freeze([
  { id: 'captain-kaji', name: 'Captain Kaji' },
  { id: 'widow-of-fog', name: 'Widow of Fog' },
  { id: 'furnace-abbot', name: 'Furnace Abbot' },
  { id: 'ujiro', name: 'Magistrate Ujiro Arata' },
  { id: 'bell-warden-chiyo', name: 'Bell Warden Chiyo' },
  { id: 'lady-enma', name: 'Lady Enma' },
  { id: 'yearless-bell', name: 'Yearless Bell' },
]);
export const REVIEW_CLIPS = HD_MOTION_CLIPS;
export const REVIEW_SCHEMA = 'jrpg-hd-boss-visual-review/1';
export const REVIEW_DECISIONS = Object.freeze(['unreviewed', 'needs-fixes', 'ready-for-signoff']);
export const REVIEW_BACKDROPS = Object.freeze(['checker', 'light', 'dark', 'arena']);
export const REVIEW_STORAGE_KEY = 'jrpg-hd-boss-review-draft-v1';

const SHA = /^[a-f0-9]{64}$/;
const has = (object, property) => Object.prototype.hasOwnProperty.call(object, property);
const validId = id => HD_BOSSES.some(boss => boss.id === id);

export function originalSourcePath(id) {
  if (!validId(id)) throw new RangeError('Unknown boss ID');
  return '../assets/art/hd-painted-boss-review-v1/' + id + '/' + id + '-six-poses-original.png';
}
export function intakeSourcePath(id) {
  if (!validId(id)) throw new RangeError('Unknown boss ID');
  return '../assets/art/roster-keystone/' + id + '-hd-intake.json';
}
export function frameRect(index, size = 192, columns = 12) {
  if (!Number.isInteger(index) || index < 0 || index >= 24 ||
      !Number.isInteger(size) || size < 1 || !Number.isInteger(columns) || columns < 1)
    throw new RangeError('Invalid atlas frame');
  return { sx: (index % columns) * size, sy: Math.floor(index / columns) * size, sw: size, sh: size };
}
export function validateReviewCatalog(keys, motion, roster) {
  const painted = validateHdArtManifest(keys);
  const moving = validateHdMotionManifest(motion);
  if (!painted.ok || !moving.ok) throw new Error('Invalid HD art manifests: ' + painted.reason + ' / ' + moving.reason);
  if (!Array.isArray(roster?.identities)) throw new Error('Roster Keystone missing');
  const expected = new Set(HD_BOSSES.map(boss => boss.id));
  let clips = 0;
  for (const boss of HD_BOSSES) {
    const id = boss.id;
    const actor = keys.actors[id];
    const animated = motion.actors[id];
    const rows = roster.identities.filter(row => row.id === id && row.kind === 'named-boss');
    if (rows.length !== 1 || rows[0].assetInGit !== true || !actor || !animated)
      throw new Error('Missing Git-tracked named boss: ' + id);
    if (actor.group !== 'enemy' || actor.width !== 2304 || actor.height !== 384 ||
        actor.poses.length !== 6 || animated.group !== 'enemy' ||
        animated.sourceFile !== actor.file || animated.sourceSheetSha256 !== actor.sha256)
      throw new Error('Painting / animation mismatch: ' + id);
    if (Object.keys(animated.clipSet).length !== 10)
      throw new Error('Incomplete clip set: ' + id);
    for (const name of REVIEW_CLIPS) {
      const clip = animated.clipSet[name];
      if (!clip || clip.frames !== 24 || clip.columns !== 12 || clip.rows !== 2 ||
          clip.width !== 2304 || clip.height !== 384 || !SHA.test(clip.sha256))
        throw new Error('Incomplete frame contract: ' + id + '/' + name);
      clips++;
    }
  }
  const extra = Object.keys(motion.actors).filter(id => !expected.has(id) && keys.actors[id]?.group === 'enemy');
  if (extra.length) throw new Error('Unexpected enemy manifest entries: ' + extra.join(', '));
  if (clips !== 70 || motion.motionClipCount < 70 || motion.frameTotal < 1680)
    throw new Error('Seven-boss coverage mismatch');
  return { bosses: 7, clips, frames: clips * 24 };
}

function note(value) {
  return typeof value === 'string' ? value.slice(0, 3000) : '';
}
function choice(value) {
  return REVIEW_DECISIONS.includes(value) ? value : 'unreviewed';
}
export function sanitizeReviewDraft(raw) {
  const bosses = {};
  for (const { id } of HD_BOSSES) {
    const from = raw?.bosses?.[id] || {};
    const clips = {};
    for (const name of REVIEW_CLIPS) {
      const entry = from?.clips?.[name] || {};
      clips[name] = { decision: choice(entry.decision), note: note(entry.note) };
    }
    bosses[id] = { decision: choice(from.decision), note: note(from.note), clips };
  }
  return { schema: REVIEW_SCHEMA, bosses };
}
export function buildVisualReceipt({
  bossId, clipId, frame, backdrop, speed, timestamp, screenshotSha256,
  intake, keys, motion, roster, draft,
}) {
  if (!validId(bossId) || !REVIEW_CLIPS.includes(clipId) ||
      !Number.isInteger(frame) || frame < 0 || frame >= 24 ||
      !REVIEW_BACKDROPS.includes(backdrop) || !Number.isFinite(speed) || speed <= 0 ||
      typeof timestamp !== 'string' || !SHA.test(screenshotSha256))
    throw new Error('Invalid review capture selection');
  const actor = keys.actors[bossId];
  const clip = motion.actors[bossId]?.clipSet?.[clipId];
  const row = roster.identities.find(x => x.id === bossId && x.kind === 'named-boss');
  if (!actor || !clip || !row || intake?.bossId !== bossId ||
      intake.sourceSha256?.length !== 64 || intake.sixKeyAtlasSha256 !== actor.sha256)
    throw new Error('Review provenance mismatch');
  const review = sanitizeReviewDraft(draft).bosses[bossId];
  return {
    schema: REVIEW_SCHEMA,
    evidenceType: 'human-visual-candidate-capture',
    timestamp,
    bossId, bossName: HD_BOSSES.find(x => x.id === bossId).name,
    clipId, frameIndex: frame, frameNumber: frame + 1,
    playbackSpeed: speed,
    backdrop,
    originalPainting: { file: originalSourcePath(bossId), sha256: intake.sourceSha256 },
    sixKeyAtlas: { file: './assets/art/hd-painted-v1/' + actor.file, sha256: actor.sha256 },
    animationAtlas: { file: './assets/art/hd-painted-v1/' + clip.path, sha256: clip.sha256,
      sourcePose: clip.sourcePose, frameCount: clip.frames, frameMs: clip.frameMs },
    screenshotSha256,
    canonicalVisualApproval: row.visualApproval,
    review: { decision: review.decision, note: review.note,
      clipDecision: review.clips[clipId].decision, clipNote: review.clips[clipId].note },
    reviewAuthority: 'local draft only; no Roster Keystone write',
    provenance: 'source-derived 24-frame deformation studies; manual quality review pending',
  };
}
