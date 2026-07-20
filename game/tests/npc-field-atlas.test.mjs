import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  NPC_FIELD_ATLAS,
  NPC_FIELD_ROLES,
  getNpcFieldFrame,
  npcFieldAtlasImageHasExpectedSize,
  resolveNpcFieldRole,
} from '../npc-field-atlas.mjs';
import { ALL_OPTIONAL_QUESTS } from '../content/sidequests.mjs';
import { SCENE_OPERATIONS } from '../content/scene-operations.mjs';
import { WITNESS_STAGE_FIELDWORK } from '../witness-stage-fieldwork.mjs';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SUITE_ROOT = resolve(GAME_ROOT, '..', 'assets', 'art', 'npc-field-suite');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('NPC field taxonomy and frame geometry are compact and exact', () => {
  assert.deepEqual(NPC_FIELD_ROLES, ['speaker', 'interviewee']);
  assert.deepEqual(NPC_FIELD_ATLAS, {
    url: './assets/art/npc-field-suite/npc-field-atlas.png',
    width: 64, height: 48, columns: 2, rows: 1, cellWidth: 32, cellHeight: 48,
    pivot: [16, 44], footPoint: [16, 44],
  });
  assert.deepEqual(getNpcFieldFrame('speaker'), {
    role: 'speaker', column: 0, row: 0, x: 0, y: 0, width: 32, height: 48,
    pivot: [16, 44], footPoint: [16, 44],
  });
  assert.equal(getNpcFieldFrame('interviewee').x, 32);
  assert.throws(() => getNpcFieldFrame('prop'), /Unknown NPC field role/u);
  assert.equal(npcFieldAtlasImageHasExpectedSize({ naturalWidth: 64, naturalHeight: 48 }), true);
  assert.equal(npcFieldAtlasImageHasExpectedSize({ naturalWidth: 63, naturalHeight: 48 }), false);
});

test('resolver uses authored person metadata and never guesses from labels', () => {
  assert.equal(resolveNpcFieldRole({ markerType: 'side-story', objectiveType: 'talk', targetKind: 'person' }), 'speaker');
  assert.equal(resolveNpcFieldRole({ markerType: 'scene-operation', activityType: 'interview' }), 'interviewee');
  for (const record of [
    { markerType: 'side-story', objectiveType: 'talk' },
    { markerType: 'side-story', objectiveType: 'talk', targetKind: 'group', label: 'council' },
    { markerType: 'side-story', objectiveType: 'collect', label: 'person' },
    { markerType: 'scene-operation', activityType: 'care-rescue', instruction: 'a person' },
    { markerType: 'scene-operation', activityType: 'council' },
    { markerType: 'witness-chronicle', activityType: 'interview', verb: 'Approach' },
    { markerType: 'witness-chronicle', activityType: 'combat', verb: 'Fight' },
  ]) assert.equal(resolveNpcFieldRole(record), null);
});

test('every mapped live record is covered only by exact metadata contracts', () => {
  const objectives = ALL_OPTIONAL_QUESTS.flatMap((quest) => quest.objectives);
  assert.equal(objectives.filter(({ type }) => type === 'talk').length, 8);
  assert.equal(objectives.filter((objective) => resolveNpcFieldRole({
    markerType: 'side-story', objectiveType: objective.type, targetKind: objective.targetKind,
  })).length, 4);
  assert.equal(objectives.filter(({ type, targetKind }) => type === 'talk' && targetKind === 'group').length, 4);

  const operationNodes = SCENE_OPERATIONS.operations.flatMap((operation) => operation.nodes);
  assert.equal(operationNodes.filter(({ activityType }) => activityType === 'interview').length, 37);
  assert.equal(operationNodes.filter((node) => resolveNpcFieldRole({ markerType: 'scene-operation', activityType: node.activityType, verb: node.verb })).length, 37);

  const witnessNodes = WITNESS_STAGE_FIELDWORK.flatMap((stage) => stage.nodes.map((node) => ({ ...node, activityType: stage.activityType })));
  assert.equal(witnessNodes.filter(({ verb }) => verb === 'Invite').length, 0,
    'the generated fieldwork catalogue emits only the first and final interview blueprint nodes');
  assert.equal(witnessNodes.filter((node) => resolveNpcFieldRole({ markerType: 'witness-chronicle', activityType: node.activityType })).length, 0);
});

test('production atlas, runtime copy, contact sheet, manifest, and builder agree', async () => {
  const [sourceText, manifestText, atlas, runtime, contact, builder] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'npc-field-suite.source.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'npc-field-atlas.png')),
    readFile(resolve(GAME_ROOT, 'assets', 'art', 'npc-field-suite', 'npc-field-atlas.png')),
    readFile(resolve(SUITE_ROOT, 'npc-field-contact-sheet.png')),
    readFile(resolve(SUITE_ROOT, 'build_npc_field_suite.py'), 'utf8'),
  ]);
  const source = JSON.parse(sourceText);
  const manifest = JSON.parse(manifestText);
  assert.equal(source.authorship, 'original-code-native-pixel-primitives');
  assert.deepEqual(source.sheet.columns, NPC_FIELD_ROLES);
  assert.deepEqual(manifest.roleOrder, NPC_FIELD_ROLES);
  assert.deepEqual(manifest.geometry, {
    frameWidth: 32, frameHeight: 48, columns: 2, rows: 1,
    sheetWidth: 64, sheetHeight: 48, pivot: [16, 44], footPoint: [16, 44],
    transparentGutter: 1, alphaBoundingBox: [6, 6, 59, 44],
  });
  assert.equal(runtime.equals(atlas), true);
  assert.equal(manifest.exports[0].sha256, sha256(atlas));
  assert.equal(manifest.exports[1].sha256, sha256(contact));
  assert.doesNotMatch(builder, /Adam Driver|celebrity likeness|holy relic|real insignia/iu);
});
