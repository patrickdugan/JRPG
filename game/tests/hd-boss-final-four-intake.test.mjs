import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/art/roster-keystone/roster.json'), 'utf8'));
const keys = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/assets/art/hd-painted-v1/manifest.json'), 'utf8'));
const motion = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/assets/art/hd-painted-v1/motion-manifest.json'), 'utf8'));
const IDS = ['captain-kaji', 'widow-of-fog', 'furnace-abbot', 'ujiro'];
const sha = /^[a-f0-9]{64}$/;
const intakeOf = id => JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/art/roster-keystone', id + '-hd-intake.json'), 'utf8'));

test('the actual four-boss import has four canonical six-pose, 240-cell receipts', () => {
  assert.equal(new Set(IDS).size, 4);
  for (const id of IDS) {
    const rows = ledger.identities.filter(x => x.id === id && x.kind === 'named-boss');
    assert.equal(rows.length, 1, id);
    const row = rows[0], intake = intakeOf(id);
    assert.equal(intake.bossId, id);
    assert.equal(intake.poses.length, 6, id);
    assert.equal(intake.sourceResolution[0], 1536, id);
    assert.equal(intake.sourceResolution[1], 1024, id);
    assert.match(intake.sourceSha256, sha, id);
    assert.match(intake.sixKeyAtlasSha256, sha, id);
    assert.equal(intake.sixKeyAtlasSha256, keys.actors[id].sha256, id);
    assert.equal(motion.actors[id].sourceSheetSha256, keys.actors[id].sha256, id);
    assert.equal(Object.keys(motion.actors[id].clipSet).length, 10, id);
    assert.equal(Object.values(motion.actors[id].clipSet).reduce((n, c) => n + c.frames, 0), 240, id);
    assert.equal(intake.binarySourceInGit, true, id);
    assert.equal(row.assetInGit, true, id);
    assert.equal(row.visualApproval, 'pending', id);
    assert.equal(intake.gitImport.visualApproval, 'pending', id);
    assert.ok(fs.existsSync(path.join(ROOT, 'game/assets/art/boss-animation-suite-v2', id + '.json')), id);
  }
});
test('the new four-boss group is sourced from four real paintings in Git', () => {
  for (const id of IDS) {
    const source = path.join(ROOT, 'assets/art/hd-painted-boss-review-v1', id, id + '-six-poses-original.png');
    assert.ok(fs.existsSync(source), id);
    assert.equal(keys.actors[id].poses.length, 6, id);
  }
  assert.match(intakeOf('furnace-abbot').matteStatus, /cleanup pending/);
});
test('the imported group supplies exactly 40 clips and 960 frames', () => {
  const clips = IDS.flatMap(id => Object.values(motion.actors[id].clipSet));
  assert.equal(clips.length, 40);
  assert.equal(clips.reduce((n, c) => n + c.frames, 0), 960);
  assert.equal(ledger.targets.allIdentities, 62);
  assert.equal(ledger.targets.regularEnemies, 28);
  assert.equal(ledger.targets.additionalBosses, 7);
});
