import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMPAIGN } from '../content/campaign.mjs';
import {
  FULL_SCRIPT_VOLUME_TARGET,
  compileDialogueScript,
  getCompiledDialogue,
  getCompiledScene,
} from '../dialogue-script-contract.mjs';

const beatRecords = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => ({ chapter, beat })));

function completeSmallPack() {
  return beatRecords.map(({ beat }) => ({
    beatId: beat.id,
    before: [{ speaker: 'NARRATOR', line: `Rain and footfalls establish ${beat.title} before the recorded exchange.` }],
    after: [{ speaker: 'NARRATOR', line: `The party carries the consequence of ${beat.title} into the next task.` }],
  }));
}

test('compiler covers canonical order and preserves every original line in the middle', () => {
  const result = compileDialogueScript([completeSmallPack()]);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.scenes.length, FULL_SCRIPT_VOLUME_TARGET.coveredBeats);
  assert.deepEqual(result.scenes.map(({ beatId }) => beatId), beatRecords.map(({ beat }) => beat.id));
  assert.equal(result.metrics.coveredBeats, beatRecords.length);
  assert.equal(result.metrics.volumeTargetMet, false);

  for (const { beat } of beatRecords) {
    const scene = getCompiledScene(result, beat.id);
    const original = Array.isArray(beat.text) ? beat.text : [{ speaker: 'NARRATOR', line: String(beat.text) }];
    assert.equal(scene.originalLineCount, original.length);
    assert.deepEqual(
      scene.dialogue.slice(1, 1 + original.length).map(({ speaker, line }) => ({ speaker, line })),
      original,
    );
    assert.equal(getCompiledDialogue(result, beat.id), scene.dialogue);
  }
});

test('compiler rejects missing, duplicate, unknown, placeholder, and borrowed-reference entries', () => {
  const firstBeatId = beatRecords[0].beat.id;
  const result = compileDialogueScript([[
    { beatId: firstBeatId, before: [{ speaker: '', line: 'TODO placeholder.' }] },
    { beatId: firstBeatId, after: [{ speaker: 'REN', line: 'A duplicate.' }] },
    { beatId: 'not-a-beat', after: [{ speaker: 'REN', line: 'Unknown.' }] },
  ]]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('duplicates beat')));
  assert.ok(result.errors.some((error) => error.includes('unknown beat ID')));
  assert.ok(result.errors.some((error) => error.includes('Missing expansion')));
  assert.ok(result.errors.some((error) => error.includes('needs a speaker')));
  assert.ok(result.errors.some((error) => error.includes('placeholder prose')));

  const borrowed = compileDialogueScript([[
    { beatId: firstBeatId, before: [{ speaker: 'REN', line: 'This is just like Castlevania.' }] },
  ]], { strictCoverage: false });
  assert.equal(borrowed.ok, false);
  assert.ok(borrowed.errors.some((error) => error.includes('prohibited real/franchise')));
});

test('partial packs are usable only when strict coverage is explicitly disabled', () => {
  const beatId = beatRecords[0].beat.id;
  const partial = [{ beatId, after: [{ speaker: 'REN', line: 'I will carry this scene forward.' }] }];
  assert.equal(compileDialogueScript([partial]).ok, false);
  const allowed = compileDialogueScript([partial], { strictCoverage: false });
  assert.equal(allowed.ok, true, allowed.errors.join('\n'));
  assert.equal(allowed.metrics.coveredBeats, 1);
  assert.equal(Object.isFrozen(allowed.scenes[0].dialogue), true);
});
