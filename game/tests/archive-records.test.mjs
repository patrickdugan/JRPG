import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARCHIVE_RECORD_PLAN,
  ARCHIVE_RECORD_TARGETS,
  validateArchiveRecordPack,
} from '../archive-record-contract.mjs';
import {
  ARCHIVE_RECORD_METRICS,
  ARCHIVE_RECORDS,
  getArchiveRecord,
  getArchiveRecordsForChapter,
} from '../content/archive-records.mjs';
import { CAMPAIGN } from '../content/campaign.mjs';

test('complete public archive validates in exact canonical beat order', () => {
  const validation = validateArchiveRecordPack(ARCHIVE_RECORDS.records, { strictCatalogue: true });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.equal(ARCHIVE_RECORD_METRICS.recordCount, 60);
  assert.equal(ARCHIVE_RECORD_METRICS.chapterCount, 11);
  assert.ok(ARCHIVE_RECORD_METRICS.wordCount >= ARCHIVE_RECORD_TARGETS.minimumCatalogueWords);
  assert.deepEqual(
    ARCHIVE_RECORDS.records.map(({ id }) => id),
    ARCHIVE_RECORD_PLAN.map(({ id }) => id),
  );
});

test('archive lookups are null-safe, chapter-complete, and immutable', () => {
  assert.equal(getArchiveRecord('missing'), null);
  assert.deepEqual(getArchiveRecordsForChapter('missing'), []);
  for (const chapter of CAMPAIGN.chapters) {
    const records = getArchiveRecordsForChapter(chapter.id);
    assert.equal(records.length, chapter.beats.length);
    assert.equal(Object.isFrozen(records), true);
    assert.ok(records.every((record) => getArchiveRecord(record.id) === record));
  }
  assert.equal(Object.isFrozen(ARCHIVE_RECORDS), true);
  assert.equal(Object.isFrozen(ARCHIVE_RECORDS.records), true);
  assert.equal(Object.isFrozen(ARCHIVE_RECORDS.records[0].paragraphs), true);
  assert.equal(Object.isFrozen(ARCHIVE_RECORD_METRICS), true);
});
