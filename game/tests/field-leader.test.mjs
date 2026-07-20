import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { LEVELS } from '../content/levels.mjs';
import {
  FIELD_PRESENTATION_LEADER_IDS,
  createFieldState,
  getEffectiveFieldPresentationLeader,
  getFieldPresentationLeaderPreference,
  loadFieldState,
  serializeFieldState,
  setFieldPresentationLeader,
} from '../field-runtime.mjs';

test('field leader preference replaces only its normalized flag and preserves old-save compatibility', () => {
  const oldSave = createFieldState({ levelId: 'hsh-river-lane', beatId: 'prologue-01-ash-road', flags: ['route-open'] });
  assert.equal(getFieldPresentationLeaderPreference(oldSave), null);
  assert.equal(getEffectiveFieldPresentationLeader(oldSave, ['ren']), 'ren');

  const aya = setFieldPresentationLeader(oldSave, 'aya');
  assert.equal(aya.revision, oldSave.revision + 1);
  assert.deepEqual(aya.flags, ['presentation-field-leader-aya', 'route-open']);
  assert.equal(getFieldPresentationLeaderPreference(aya), 'aya');
  assert.equal(getEffectiveFieldPresentationLeader(aya, ['ren', 'aya']), 'aya');
  assert.equal(getEffectiveFieldPresentationLeader(aya, ['ren']), 'ren', 'early formations fall back without erasing preference');
  assert.equal(getFieldPresentationLeaderPreference(aya), 'aya');
  assert.equal(setFieldPresentationLeader(aya, 'aya'), aya, 'reselecting the exact preference is immutable and idempotent');

  const kiku = setFieldPresentationLeader(aya, 'kiku');
  assert.deepEqual(kiku.flags, ['presentation-field-leader-kiku', 'route-open']);
  assert.equal(kiku.flags.some((flag) => flag === 'presentation-field-leader-aya'), false);
  const loaded = loadFieldState(serializeFieldState(kiku));
  assert.equal(loaded.ok, true);
  assert.equal(loaded.value.schemaVersion, 1);
  assert.equal(getFieldPresentationLeaderPreference(loaded.value), 'kiku');
  assert.throws(() => setFieldPresentationLeader(kiku, 'ujiro'), /Unknown field presentation leader/);
  assert.throws(() => getEffectiveFieldPresentationLeader(kiku, []), /formation/);
  assert.throws(() => getEffectiveFieldPresentationLeader(kiku, ['ren', 'ren']), /formation/);
});

test('all 48 level formations are exact and make every authored party row selectable', () => {
  assert.equal(LEVELS.length, 48);
  const counts = Object.fromEntries(FIELD_PRESENTATION_LEADER_IDS.map((id) => [id, 0]));
  for (const level of LEVELS) {
    const formation = level.spawn?.formation;
    assert.ok(Array.isArray(formation) && formation.length > 0, `${level.id} formation`);
    assert.equal(new Set(formation).size, formation.length, `${level.id} formation uniqueness`);
    for (const memberId of formation) {
      assert.equal(FIELD_PRESENTATION_LEADER_IDS.includes(memberId), true, `${level.id}/${memberId}`);
      counts[memberId] += 1;
    }
  }
  assert.deepEqual(counts, { ren: 48, aya: 45, lise: 37, mateus: 30, genta: 29, kiku: 27 });
});

test('Campaign exposes one accessible formation-owned selector and uses its effective ID everywhere visible', async () => {
  const [markup, source] = await Promise.all([
    readFile(new URL('../campaign.html', import.meta.url), 'utf8'),
    readFile(new URL('../campaign.js', import.meta.url), 'utf8'),
  ]);
  assert.match(markup, /<label class="field-leader-control" for="fieldLeader">/);
  assert.match(markup, /<select id="fieldLeader" aria-describedby="fieldLeaderHint"><\/select>/);
  assert.match(source, /function renderFieldLeaderControl\(level\)/);
  assert.match(source, /fieldFormation\(level\)\.includes\(memberId\)/);
  assert.match(source, /setFieldPresentationLeader\(fieldRuntimeState, memberId\)/);
  assert.match(source, /getPartyAtlasFieldPoseFrame\(fieldLeaderId, heldPose\)/);
  assert.match(source, /getPartyAtlasWalkFrame\(fieldLeaderId, fieldFacing, phase\)/);
  assert.match(source, /getPartyAtlasFrame\(fieldLeaderId, fieldFacing, 0\)/);
  assert.match(source, /getFieldHazardConsequence\(event, nextLoadoutState, effectiveFieldLeader\(level\)\)/);
  assert.match(source, /mapCanvas\.dataset\.fieldLeaderId = fieldLeaderId/);
  assert.doesNotMatch(source, /getPartyAtlasWalkFrame\('ren'/);
});
