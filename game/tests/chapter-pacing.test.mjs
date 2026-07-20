import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import { CHAPTER_PACING_CHECKPOINTS, getChapterPacingCheckpoint } from '../chapter-pacing.mjs';
import { createChapterPacingAudit, serializeChapterPacingCheckpoints } from '../chapter-pacing-audit.mjs';

const audit = createChapterPacingAudit();

test('checked-in chapter checkpoints exactly match the quantity-derived audit', () => {
  assert.deepEqual(CHAPTER_PACING_CHECKPOINTS, audit.checkpoints);
  assert.equal(CHAPTER_PACING_CHECKPOINTS.signature, 'fnv1a32:dd7a4469');
  assert.equal(Object.isFrozen(CHAPTER_PACING_CHECKPOINTS), true);
  assert.equal(Object.isFrozen(CHAPTER_PACING_CHECKPOINTS.chapters[0]), true);
  assert.equal(serializeChapterPacingCheckpoints(audit.checkpoints), `${JSON.stringify(audit.checkpoints, null, 2)}\n`);
});

test('chapter checkpoints cover the canonical campaign and reconcile to the reference intended route', () => {
  assert.deepEqual(
    CHAPTER_PACING_CHECKPOINTS.chapters.map(({ chapterId }) => chapterId),
    CAMPAIGN.chapters.map(({ id }) => id),
  );
  assert.equal(CHAPTER_PACING_CHECKPOINTS.chapters.length, 11);
  assert.equal(
    CHAPTER_PACING_CHECKPOINTS.chapters.reduce((total, chapter) => total + chapter.targetMs, 0),
    CHAPTER_PACING_CHECKPOINTS.aggregateTargetMs,
  );
  assert.equal(CHAPTER_PACING_CHECKPOINTS.aggregateTargetMs, 73_915_967);
  assert.equal(CHAPTER_PACING_CHECKPOINTS.aggregateTargetMinutes, 1_231.933);
  assert.equal(audit.reconciliation.durationAuditEstimatedMinutes, 1_231.933);
  assert.equal(audit.reconciliation.chapterTargetMs, CHAPTER_PACING_CHECKPOINTS.aggregateTargetMs);
  assert.equal(audit.reconciliation.requiredRepeatPresentationMs, 36_800);
  for (const chapter of CAMPAIGN.chapters) {
    const checkpoint = getChapterPacingCheckpoint(chapter.id);
    assert.ok(checkpoint);
    assert.equal(checkpoint.title, chapter.title);
    assert.equal(checkpoint.number, chapter.number);
    assert.ok(checkpoint.targetMs > 0);
  }
  assert.equal(getChapterPacingCheckpoint('not-a-chapter'), null);
});

test('pacing checkpoints remain diagnostics built without authored minutes or fabricated elapsed time', async () => {
  const source = await readFile(new URL('../chapter-pacing-audit.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /(?:chapter|quest|chronicle|activity)\.estimatedMinutes\b/u);
  assert.doesNotMatch(source, /activity\.minutes\b/u);
  assert.equal(CHAPTER_PACING_CHECKPOINTS.diagnosticOnly, true);
  assert.equal(CHAPTER_PACING_CHECKPOINTS.observedPlaytimeProof, false);
  assert.equal(audit.reconciliation.authoredMinutesUsed, false);
  assert.equal(audit.reconciliation.elapsedTimeClaimed, false);
  assert.equal(audit.reconciliation.canonicalSignature, 'fnv1a32:ff4e1361');
  assert.equal(audit.reconciliation.witnessFieldworkSignature, 'fnv1a32:18eed422');
  assert.equal(audit.reconciliation.requiredRouteSignature, 'fnv1a32:deee52ef');
});
