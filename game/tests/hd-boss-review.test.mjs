import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import {
  HD_BOSSES, REVIEW_CLIPS, REVIEW_SCHEMA, REVIEW_BACKDROPS,
  frameRect, originalSourcePath, intakeSourcePath, validateReviewCatalog,
  sanitizeReviewDraft, buildVisualReceipt,
} from '../hd-boss-review-contract.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const load = path => JSON.parse(readFileSync(root + path, 'utf8'));
const keys = load('game/assets/art/hd-painted-v1/manifest.json');
const motion = load('game/assets/art/hd-painted-v1/motion-manifest.json');
const roster = load('assets/art/roster-keystone/roster.json');
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

test('review covers seven actual Git-tracked bosses without changing canonical approvals', () => {
  assert.deepEqual(validateReviewCatalog(keys, motion, roster), { bosses: 7, clips: 70, frames: 1680 });
  assert.equal(new Set(HD_BOSSES.map(x => x.id)).size, 7);
  for (const { id } of HD_BOSSES) {
    const intake = load('assets/art/roster-keystone/' + id + '-hd-intake.json');
    assert.equal(intake.bossId, id);
    assert.equal(intake.sixKeyAtlasSha256, keys.actors[id].sha256);
    const file = root + originalSourcePath(id).replace('../', '');
    assert.ok(existsSync(file), id);
    assert.equal(sha256(readFileSync(file)), intake.sourceSha256, id);
    assert.ok(intakeSourcePath(id).includes(id + '-hd-intake.json'));
    assert.equal(roster.identities.find(x => x.id === id).visualApproval, 'pending');
    assert.deepEqual(new Set(Object.keys(motion.actors[id].clipSet)), new Set(REVIEW_CLIPS));
  }
});

test('frame scrubbing computes exact grid locations', () => {
  assert.deepEqual(frameRect(0), { sx: 0, sy: 0, sw: 192, sh: 192 });
  assert.deepEqual(frameRect(11), { sx: 2112, sy: 0, sw: 192, sh: 192 });
  assert.deepEqual(frameRect(12), { sx: 0, sy: 192, sw: 192, sh: 192 });
  assert.deepEqual(frameRect(23), { sx: 2112, sy: 192, sw: 192, sh: 192 });
  assert.throws(() => frameRect(24), RangeError);
});

test('draft parser drops unknown identities and never changes canonical approval', () => {
  const raw = { bosses: { 'captain-kaji': {
    decision: 'ready-for-signoff', note: 'Edge cleanup', clips: {
      idle: { decision: 'needs-fixes', note: 'Foot jitter' },
      fake: { decision: 'ready-for-signoff', note: 'Injected' },
    },
  }, unknown: { decision: 'ready-for-signoff' } } };
  const clean = sanitizeReviewDraft(raw);
  assert.equal(clean.schema, REVIEW_SCHEMA);
  assert.deepEqual(Object.keys(clean.bosses), HD_BOSSES.map(x => x.id));
  assert.equal(clean.bosses['captain-kaji'].decision, 'ready-for-signoff');
  assert.deepEqual(clean.bosses['captain-kaji'].clips.idle, { decision: 'needs-fixes', note: 'Foot jitter' });
  assert.equal(clean.bosses['captain-kaji'].clips.active.decision, 'unreviewed');
  assert.equal(Object.hasOwn(clean.bosses['captain-kaji'].clips, 'fake'), false);
  assert.equal(Object.hasOwn(clean.bosses['captain-kaji'], 'visualApproval'), false);
});

test('JSON screenshot receipt ties pixels to canonical provenance, without claiming approval', () => {
  const id = 'captain-kaji';
  const draft = sanitizeReviewDraft({ bosses: { [id]: {
    decision: 'ready-for-signoff', note: 'needs human inspection',
    clips: { windup: { decision: 'needs-fixes', note: 'matte edge' } },
  } } });
  const receipt = buildVisualReceipt({
    bossId: id, clipId: 'windup', frame: 23, backdrop: REVIEW_BACKDROPS[0],
    speed: .5, timestamp: '2026-11-22T00:00:00.000Z', screenshotSha256: 'a'.repeat(64),
    intake: load('assets/art/roster-keystone/' + id + '-hd-intake.json'),
    keys, motion, roster, draft,
  });
  assert.equal(receipt.animationAtlas.sha256, motion.actors[id].clipSet.windup.sha256);
  assert.equal(receipt.frameNumber, 24);
  assert.equal(receipt.canonicalVisualApproval, 'pending');
  assert.equal(receipt.review.clipDecision, 'needs-fixes');
  assert.match(receipt.reviewAuthority, /no Roster Keystone write/);
  assert.throws(() => buildVisualReceipt({
    bossId: 'bad-id', clipId: 'windup', frame: 0, backdrop: 'checker',
    speed: 1, timestamp: '', screenshotSha256: 'b'.repeat(64), intake: {}, keys, motion, roster, draft,
  }));
});
