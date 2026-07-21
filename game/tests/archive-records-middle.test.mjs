import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARCHIVE_RECORD_GROUPS,
  ARCHIVE_RECORD_TARGETS,
  getArchiveRecordGroupPlan,
  validateArchiveRecordPack,
} from '../archive-record-contract.mjs';
import {
  ARCHIVE_RECORDS_MIDDLE,
  ARCHIVE_RECORDS_MIDDLE_METRICS,
} from '../content/archive-records-middle.mjs';

function words(value) {
  return typeof value === 'string'
    ? value.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu)?.length ?? 0
    : 0;
}

function authoredText(record) {
  return [
    record.title,
    record.recordType,
    record.custodian,
    record.accessNote,
    ...record.paragraphs,
  ];
}

function assertDeepFrozen(value, path = 'root', seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const [key, nested] of Object.entries(value)) {
    assertDeepFrozen(nested, `${path}.${key}`, seen);
  }
}

test('middle archive pack fills exactly the twenty canonical slots in plan order', () => {
  const plan = getArchiveRecordGroupPlan('middle');
  assert.equal(ARCHIVE_RECORDS_MIDDLE.length, 20);
  assert.deepEqual(ARCHIVE_RECORDS_MIDDLE.map(({ id }) => id), ARCHIVE_RECORD_GROUPS.middle);
  assert.deepEqual(ARCHIVE_RECORDS_MIDDLE.map((record) => ({
    id: record.id,
    sequence: record.sequence,
    chapterId: record.chapterId,
    unlockAfterBeatId: record.unlockAfterBeatId,
  })), plan.map((slot) => ({
    id: slot.id,
    sequence: slot.sequence,
    chapterId: slot.chapterId,
    unlockAfterBeatId: slot.unlockAfterBeatId,
  })));
  assert.deepEqual(ARCHIVE_RECORDS_MIDDLE.map(({ sequence }) => sequence),
    Array.from({ length: 20 }, (_, index) => index + 21));
});

test('contract validator accepts the middle pack and reports complete authored volume', () => {
  const validation = validateArchiveRecordPack(ARCHIVE_RECORDS_MIDDLE, { expectedGroup: 'middle' });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.metrics, ARCHIVE_RECORDS_MIDDLE_METRICS);
  assert.deepEqual(validation.metrics, {
    recordCount: 20,
    paragraphCount: 162,
    wordCount: 10_581,
    chapterCount: 4,
    byGroup: { early: 0, middle: 20, late: 0 },
  });
});

test('every reading clears paragraph and word floors with substantial passages', () => {
  for (const record of ARCHIVE_RECORDS_MIDDLE) {
    assert.ok(
      record.paragraphs.length >= ARCHIVE_RECORD_TARGETS.minimumParagraphsPerRecord
        && record.paragraphs.length <= ARCHIVE_RECORD_TARGETS.maximumParagraphsPerRecord,
      `${record.id} paragraph count`,
    );
    record.paragraphs.forEach((paragraph, index) => {
      assert.ok(paragraph.trim().length >= ARCHIVE_RECORD_TARGETS.minimumParagraphCharacters,
        `${record.id} paragraph ${index + 1} character floor`);
      assert.ok(words(paragraph) >= ARCHIVE_RECORD_TARGETS.minimumParagraphWords,
        `${record.id} paragraph ${index + 1} word floor`);
    });
    const recordWords = authoredText(record).reduce((sum, value) => sum + words(value), 0);
    assert.ok(recordWords >= ARCHIVE_RECORD_TARGETS.minimumWordsPerRecord,
      `${record.id} has only ${recordWords} counted words`);
  }
});

test('record forms, custodians, access language, and all authored passages remain distinct', () => {
  assert.equal(new Set(ARCHIVE_RECORDS_MIDDLE.map(({ recordType }) => recordType)).size, 20);
  assert.equal(new Set(ARCHIVE_RECORDS_MIDDLE.map(({ custodian }) => custodian)).size, 20);
  assert.ok(ARCHIVE_RECORDS_MIDDLE.every(({ accessNote }) =>
    /access|consent|correction|open|public|read|request|restricted|review|community/i.test(accessNote)));

  const normalized = ARCHIVE_RECORDS_MIDDLE
    .flatMap(authoredText)
    .map((value) => value.trim().toLocaleLowerCase('en-US'));
  assert.equal(new Set(normalized).size, normalized.length);
});

test('middle archive records expose no unsupported reward, timing, or repeat fields', () => {
  const exactKeys = [
    'accessNote',
    'chapterId',
    'custodian',
    'id',
    'paragraphs',
    'recordType',
    'sequence',
    'title',
    'unlockAfterBeatId',
  ].sort();
  for (const record of ARCHIVE_RECORDS_MIDDLE) {
    assert.deepEqual(Object.keys(record).sort(), exactKeys, record.id);
    assert.equal('reward' in record, false);
    assert.equal('minutes' in record, false);
    assert.equal('repeatable' in record, false);
  }
});

test('middle archive pack and exported metrics are deeply immutable', () => {
  assertDeepFrozen(ARCHIVE_RECORDS_MIDDLE);
  assertDeepFrozen(ARCHIVE_RECORDS_MIDDLE_METRICS);
  assert.throws(() => { ARCHIVE_RECORDS_MIDDLE.push({}); }, TypeError);
  assert.throws(() => { ARCHIVE_RECORDS_MIDDLE[0].title = 'mutated'; }, TypeError);
  assert.throws(() => { ARCHIVE_RECORDS_MIDDLE[0].paragraphs[0] = 'mutated'; }, TypeError);
});
