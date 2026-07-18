import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getArchiveRecordGroupPlan,
  validateArchiveRecordPack,
} from '../archive-record-contract.mjs';
import {
  ARCHIVE_RECORDS_LATE,
  ARCHIVE_RECORDS_LATE_VALIDATION,
} from '../content/archive-records-late.mjs';

const wordCount = (value) => value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;

function authoredText(record) {
  return [record.title, record.recordType, record.custodian, record.accessNote, ...record.paragraphs];
}

function assertDeepFrozen(value, path = 'root') {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const [key, nested] of Object.entries(value)) assertDeepFrozen(nested, `${path}.${key}`);
}

test('late pack fills the exact twenty canonical slots with verbatim identity and unlock metadata', () => {
  const plan = getArchiveRecordGroupPlan('late');
  assert.equal(ARCHIVE_RECORDS_LATE.length, 20);
  assert.deepEqual(ARCHIVE_RECORDS_LATE.map((record) => ({
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
  assert.deepEqual(ARCHIVE_RECORDS_LATE.map(({ sequence }) => sequence), Array.from({ length: 20 }, (_, index) => index + 41));
  assert.deepEqual(
    Object.fromEntries([...new Set(ARCHIVE_RECORDS_LATE.map(({ chapterId }) => chapterId))].map((chapterId) => [
      chapterId,
      ARCHIVE_RECORDS_LATE.filter((record) => record.chapterId === chapterId).length,
    ])),
    { 'chapter-6': 1, 'chapter-7': 5, 'chapter-8': 5, 'chapter-9': 6, epilogue: 3 },
  );
});

test('every late reading has substantial finite paragraphs and at least five hundred counted words', () => {
  for (const record of ARCHIVE_RECORDS_LATE) {
    assert.ok(record.paragraphs.length >= 8 && record.paragraphs.length <= 12, `${record.id} paragraph count`);
    assert.ok(record.paragraphs.every((paragraph) => wordCount(paragraph) >= 35), `${record.id} paragraph substance`);
    const words = authoredText(record).reduce((sum, text) => sum + wordCount(text), 0);
    assert.ok(words >= 500, `${record.id} has ${words} words`);
    assert.equal(Object.hasOwn(record, 'reward'), false);
    assert.equal(Object.hasOwn(record, 'minutes'), false);
  }
});

test('shared contract accepts the pack and reports its exact authored volume', () => {
  const validation = validateArchiveRecordPack(ARCHIVE_RECORDS_LATE, { expectedGroup: 'late' });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.deepEqual(ARCHIVE_RECORDS_LATE_VALIDATION, validation);
  assert.deepEqual(validation.metrics, {
    recordCount: 20,
    paragraphCount: 176,
    wordCount: 10_512,
    chapterCount: 5,
    byGroup: { early: 0, middle: 0, late: 20 },
  });
});

test('all visible authored fields and paragraphs are globally exact-text unique', () => {
  const text = ARCHIVE_RECORDS_LATE.flatMap(authoredText).map((value) => value.trim().toLowerCase());
  assert.equal(new Set(text).size, text.length);
  assert.equal(new Set(ARCHIVE_RECORDS_LATE.map(({ title }) => title)).size, 20);
  assert.equal(new Set(ARCHIVE_RECORDS_LATE.map(({ recordType }) => recordType)).size, 20);
  assert.equal(new Set(ARCHIVE_RECORDS_LATE.map(({ custodian }) => custodian)).size, 20);
});

test('late records and fail-fast validation evidence are deeply immutable', () => {
  assertDeepFrozen(ARCHIVE_RECORDS_LATE);
  assertDeepFrozen(ARCHIVE_RECORDS_LATE_VALIDATION);
});
