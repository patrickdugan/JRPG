import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '../..');
const IDS = [
  'captain-kaji', 'widow-of-fog', 'furnace-abbot', 'ujiro',
  'bell-warden-chiyo', 'lady-enma', 'yearless-bell',
];
const CLIPS = [
  'idle', 'locomotion', 'windup', 'active', 'recovery',
  'guard', 'hurt', 'defeat', 'signature', 'stagger',
];
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex');
const keys = readJson('game/assets/art/hd-painted-v1/manifest.json');
const motion = readJson('game/assets/art/hd-painted-v1/motion-manifest.json');
const roster = readJson('assets/art/roster-keystone/roster.json');

test('all seven named bosses have physically committed, byte-verified source paintings and six-pose atlases', () => {
  assert.deepEqual(IDS.length, 7);
  for (const id of IDS) {
    const row = roster.identities.find(x => x.id === id);
    assert.equal(row?.kind, 'named-boss', id);
    assert.equal(row.assetInGit, true, id);
    assert.equal(row.paintedKeyArt, 'candidate-in-Git', id);
    assert.equal(row.visualApproval, 'pending', id);
    const art = keys.actors?.[id];
    assert.equal(art?.file, 'sheets/' + id + '.png', id);
    assert.equal(art.group, 'enemy', id);
    assert.equal(art.width, 2304, id);
    assert.equal(art.height, 384, id);
    assert.equal(art.poses.length, 6, id);
    assert.equal(sha256('game/assets/art/hd-painted-v1/' + art.file), art.sha256, id);
    const original = 'assets/art/hd-painted-boss-review-v1/' + id + '/' + id + '-six-poses-original.png';
    assert.ok(fs.existsSync(path.join(ROOT, original)), id);
    const intakePath = 'assets/art/roster-keystone/' + id + '-hd-intake.json';
    const intake = readJson(intakePath);
    assert.equal(intake.bossId, id);
    assert.equal(sha256(original), intake.sourceSha256, id);
  }
});

test('all seven named bosses have ten distinct 24-frame HD motion clips committed in Git', () => {
  assert.equal(motion.motionClipCount, 70);
  assert.equal(motion.frameTotal, 1680);
  const names = new Set(CLIPS);
  for (const id of IDS) {
    const entry = motion.actors?.[id];
    assert.equal(entry?.group, 'enemy', id);
    assert.equal(entry.sourceSheetSha256, keys.actors[id].sha256, id);
    assert.deepEqual(new Set(Object.keys(entry.clipSet)), names, id);
    for (const name of CLIPS) {
      const clip = entry.clipSet[name];
      assert.equal(clip.frames, 24, id + '/' + name);
      assert.equal(clip.width, 2304, id + '/' + name);
      assert.equal(clip.height, 384, id + '/' + name);
      assert.equal(clip.path, 'motion/' + id + '/' + name + '.webp');
      assert.equal(sha256('game/assets/art/hd-painted-v1/' + clip.path), clip.sha256, id + '/' + name);
      assert.equal(new Set(clip.frameRGBAsha256).size, 24);
    }
  }
});

test('both exact Git archive manifests preserve their own independent original ZIP receipts', () => {
  const a = readJson('assets/art/hd-boss-binary-import-v1/manifest.json');
  const b = readJson('assets/art/hd-boss-binary-import-v2/manifest.json');
  assert.equal(a.readyForImport, true);
  assert.equal(b.readyForImport, true);
  assert.equal(Object.keys(a.packages).length, 3);
  assert.equal(Object.keys(b.packages).length, 4);
  assert.equal(Object.values(a.packages).reduce((n,p)=>n+p.bytes,0), 36623667);
  assert.equal(Object.values(b.packages).reduce((n,p)=>n+p.bytes,0), 43933244);
  for (const m of [a,b]) {
    for (const p of Object.values(m.packages)) {
      assert.ok(p.parts.length>0);
      assert.equal(p.parts.reduce((n,x)=>n+x.bytes,0), p.bytes);
      for (const chunk of p.parts) {
        assert.ok(chunk.bytes>0 && chunk.bytes<=1500000);
        assert.ok(fs.existsSync(path.join(ROOT,chunk.path)));
      }
    }
  }
});
