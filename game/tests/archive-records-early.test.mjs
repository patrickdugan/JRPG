import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARCHIVE_RECORD_GROUPS,
  getArchiveRecordGroupPlan,
  validateArchiveRecordPack,
} from '../archive-record-contract.mjs';
import {
  ARCHIVE_RECORDS_EARLY,
  ARCHIVE_RECORDS_EARLY_METRICS,
} from '../content/archive-records-early.mjs';

function words(value) {
  return typeof value === 'string'
    ? value.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu)?.length ?? 0
    : 0;
}

function recursivelyFrozen(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => recursivelyFrozen(child, seen));
}

test('early archive pack fills exactly twenty canonical slots in plan order', () => {
  const plan = getArchiveRecordGroupPlan('early');
  assert.equal(ARCHIVE_RECORDS_EARLY.length, 20);
  assert.deepEqual(ARCHIVE_RECORDS_EARLY.map(({ id }) => id), ARCHIVE_RECORD_GROUPS.early);
  assert.deepEqual(ARCHIVE_RECORDS_EARLY.map((record) => ({
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
  const validation = validateArchiveRecordPack(ARCHIVE_RECORDS_EARLY, { expectedGroup: 'early' });
  assert.equal(validation.ok, true, validation.errors.join('\n'));
  assert.deepEqual(validation.metrics, ARCHIVE_RECORDS_EARLY_METRICS);
});

test('every early record clears exact paragraph and substantive word floors', () => {
  for (const record of ARCHIVE_RECORDS_EARLY) {
    assert.ok(record.paragraphs.length >= 8 && record.paragraphs.length <= 12, record.id);
    assert.ok(record.title.trim().split(/\s+/).length >= 2, record.id);
    assert.ok(record.recordType.length >= 12, record.id);
    assert.ok(record.custodian.trim().split(/\s+/).length >= 2, record.id);
    assert.ok(record.accessNote.length >= 40, record.id);
    assert.ok(record.paragraphs.every((paragraph) => paragraph.length >= 80 && words(paragraph) >= 35), record.id);
    const total = [record.title, record.recordType, record.custodian, record.accessNote, ...record.paragraphs]
      .reduce((sum, text) => sum + words(text), 0);
    assert.ok(total >= 500, `${record.id} has only ${total} words`);
  }
  assert.equal(ARCHIVE_RECORDS_EARLY_METRICS.recordCount, 20);
  assert.equal(ARCHIVE_RECORDS_EARLY_METRICS.byGroup.early, 20);
  assert.ok(ARCHIVE_RECORDS_EARLY_METRICS.paragraphCount >= 160);
  assert.ok(ARCHIVE_RECORDS_EARLY_METRICS.wordCount >= 10_000);
});

test('record forms, custodians, access terms, and all authored passages are exact-unique', () => {
  assert.equal(new Set(ARCHIVE_RECORDS_EARLY.map(({ title }) => title)).size, 20);
  assert.ok(new Set(ARCHIVE_RECORDS_EARLY.map(({ recordType }) => recordType)).size >= 16);
  assert.equal(new Set(ARCHIVE_RECORDS_EARLY.map(({ custodian }) => custodian)).size, 20);
  assert.equal(new Set(ARCHIVE_RECORDS_EARLY.map(({ accessNote }) => accessNote)).size, 20);
  const text = ARCHIVE_RECORDS_EARLY.flatMap((record) => [
    record.title,
    record.recordType,
    record.custodian,
    record.accessNote,
    ...record.paragraphs,
  ]).map((entry) => entry.trim().toLowerCase());
  assert.equal(new Set(text).size, text.length);
});

test('early archive export and every nested paragraph collection are immutable', () => {
  assert.equal(recursivelyFrozen(ARCHIVE_RECORDS_EARLY), true);
  assert.equal(recursivelyFrozen(ARCHIVE_RECORDS_EARLY_METRICS), true);
  assert.throws(() => { ARCHIVE_RECORDS_EARLY.push({}); }, TypeError);
  assert.throws(() => { ARCHIVE_RECORDS_EARLY[0].paragraphs[0] = 'changed'; }, TypeError);
});
