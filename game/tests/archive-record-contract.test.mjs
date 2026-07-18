import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARCHIVE_RECORD_SAVE_SCHEMA_VERSION,
  DEFAULT_ARCHIVE_RECORD_SAVE_KEY,
  ARCHIVE_RECORD_GROUP_NAMES,
  ARCHIVE_RECORD_GROUPS,
  ARCHIVE_RECORD_PLAN,
  ARCHIVE_RECORD_TARGETS,
  getArchiveRecordGroupPlan,
  getArchiveRecordPlan,
  validateArchiveRecordPack,
} from '../archive-record-contract.mjs';
import { CAMPAIGN } from '../content/campaign.mjs';

function assertDeepFrozen(value, path = 'root') {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const [key, nested] of Object.entries(value)) assertDeepFrozen(nested, `${path}.${key}`);
}

function paragraphFor(slot, paragraphIndex) {
  return `Reading ${slot.sequence}, passage ${paragraphIndex + 1}, preserves an original fictional community account under declared public access. The passage names its limits, keeps the correction route visible, and distinguishes witnessed knowledge from uncertainty. Readers may challenge the wording without purchasing, collecting, or owning another person's hardship. Custody remains accountable to the reading table, while affected households retain authority over private details and later amendments. This deliberately extended passage gives the contract enough substantive language to test paragraph and record volume without relying on a borrowed person or institution.`;
}

function validRecord(slot) {
  return {
    id: slot.id,
    sequence: slot.sequence,
    chapterId: slot.chapterId,
    unlockAfterBeatId: slot.unlockAfterBeatId,
    title: `Public Reading Ledger ${slot.sequence}`,
    recordType: `Witnessed route account number ${slot.sequence}`,
    custodian: `Community reading keeper number ${slot.sequence}`,
    accessNote: `Public access note ${slot.sequence}: readers may request correction while private household details remain restricted by consent.`,
    paragraphs: Array.from({ length: 8 }, (_, index) => paragraphFor(slot, index)),
  };
}

test('plan binds one non-repeatable slot to every canonical beat in exact order', () => {
  const beats = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => ({
    beatId: beat.id,
    chapterId: chapter.id,
  })));
  assert.equal(beats.length, 60);
  assert.equal(ARCHIVE_RECORD_PLAN.length, 60);
  assert.deepEqual(ARCHIVE_RECORD_PLAN.map(({ sequence }) => sequence), Array.from({ length: 60 }, (_, index) => index + 1));
  assert.deepEqual(ARCHIVE_RECORD_PLAN.map(({ unlockAfterBeatId }) => unlockAfterBeatId), beats.map(({ beatId }) => beatId));
  assert.deepEqual(ARCHIVE_RECORD_PLAN.map(({ chapterId }) => chapterId), beats.map(({ chapterId }) => chapterId));
  assert.ok(ARCHIVE_RECORD_PLAN.every(({ repeatable }) => repeatable === false));
  assert.equal(new Set(ARCHIVE_RECORD_PLAN.map(({ id }) => id)).size, 60);
  assert.equal(new Set(ARCHIVE_RECORD_PLAN.map(({ chapterId }) => chapterId)).size, 11);
  assertDeepFrozen(ARCHIVE_RECORD_PLAN);
});

test('early, middle, and late authoring groups contain exactly twenty contiguous slots', () => {
  assert.deepEqual(ARCHIVE_RECORD_GROUP_NAMES, ['early', 'middle', 'late']);
  assert.deepEqual(Object.values(ARCHIVE_RECORD_GROUPS).map((ids) => ids.length), [20, 20, 20]);
  for (const [groupIndex, group] of ARCHIVE_RECORD_GROUP_NAMES.entries()) {
    const slots = getArchiveRecordGroupPlan(group);
    assert.deepEqual(slots.map(({ sequence }) => sequence), Array.from({ length: 20 }, (_, index) => (groupIndex * 20) + index + 1));
    assert.deepEqual(slots.map(({ id }) => id), ARCHIVE_RECORD_GROUPS[group]);
    assertDeepFrozen(slots);
  }
  assert.equal(getArchiveRecordGroupPlan('missing'), null);
  assert.equal(getArchiveRecordPlan('missing'), null);
  assert.equal(getArchiveRecordPlan(ARCHIVE_RECORD_PLAN[0].id), ARCHIVE_RECORD_PLAN[0]);
});

test('strict partial and full validators accept canonical, sufficiently authored packs', () => {
  for (const group of ARCHIVE_RECORD_GROUP_NAMES) {
    const records = getArchiveRecordGroupPlan(group).map(validRecord);
    const validation = validateArchiveRecordPack(records, { expectedGroup: group });
    assert.equal(validation.ok, true, validation.errors.join('\n'));
    assert.equal(validation.metrics.recordCount, 20);
    assert.equal(validation.metrics.paragraphCount, 160);
    assert.equal(validation.metrics.byGroup[group], 20);
    assert.ok(validation.metrics.wordCount >= 10_000);
    assertDeepFrozen(validation);
  }

  const catalogue = ARCHIVE_RECORD_PLAN.map(validRecord);
  const full = validateArchiveRecordPack(catalogue, { strictCatalogue: true });
  assert.equal(full.ok, true, full.errors.join('\n'));
  assert.equal(full.metrics.recordCount, ARCHIVE_RECORD_TARGETS.recordCount);
  assert.equal(full.metrics.paragraphCount, 480);
  assert.equal(full.metrics.chapterCount, CAMPAIGN.chapters.length);
  assert.deepEqual(full.metrics.byGroup, { early: 20, middle: 20, late: 20 });
  assert.ok(full.metrics.wordCount >= ARCHIVE_RECORD_TARGETS.minimumCatalogueWords);
});

test('validator fails closed without an explicit partial group or full-catalogue mode', () => {
  const record = validRecord(ARCHIVE_RECORD_PLAN[0]);
  assert.match(validateArchiveRecordPack([record]).errors.join(' '), /must select expectedGroup/);
  assert.match(validateArchiveRecordPack([record], { expectedGroup: 'unknown' }).errors.join(' '), /must select expectedGroup/);
  assert.match(validateArchiveRecordPack([record], { strictCatalogue: true, expectedGroup: 'early' }).errors.join(' '), /cannot also select/);
  assert.match(validateArchiveRecordPack([record], { expectedGroup: 'early', invented: true }).errors.join(' '), /unsupported keys/);
  assert.match(validateArchiveRecordPack({}, { expectedGroup: 'early' }).errors.join(' '), /must be an array/);
});

test('malformed records reject wrong order, extra fields, short volume, duplicate text, borrowed references, real people, and loot framing', () => {
  const records = getArchiveRecordGroupPlan('early').map(validRecord);
  const malformed = structuredClone(records);
  malformed[0].reward = 100;
  malformed[0].minutes = 5;
  malformed[0].paragraphs = malformed[0].paragraphs.slice(0, 7);
  malformed[0].title = 'Short';
  malformed[0].recordType = 'object';
  malformed[0].custodian = 'none';
  malformed[0].accessNote = 'closed';
  malformed[1].id = malformed[0].id;
  malformed[1].sequence = 99;
  malformed[2].paragraphs[0] = malformed[2].paragraphs[1];
  malformed[3].paragraphs[0] = 'Adam Driver portrayed a borrowed vampire in this placeholder account, which remains deliberately too short.';
  malformed[4].paragraphs[0] = 'Tokugawa Ieyasu appears here as a real official likeness, repeated until the paragraph becomes long enough but never acceptable as original fictional content for this public archive reading contract.';
  malformed[5].paragraphs[0] = 'A sacred weapon becomes collectible loot and a completion reward, repeated as a treasure claim until this malformed paragraph exceeds the minimum character threshold while remaining prohibited by the archive guardrails.';

  const validation = validateArchiveRecordPack(malformed, { expectedGroup: 'early' });
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join(' '), /exactly the archive record keys/);
  assert.match(validation.errors.join(' '), /8-12 paragraphs/);
  assert.match(validation.errors.join(' '), /concrete multi-word title/);
  assert.match(validation.errors.join(' '), /recordType/);
  assert.match(validation.errors.join(' '), /custodian/);
  assert.match(validation.errors.join(' '), /access/);
  assert.match(validation.errors.join(' '), /outside canonical pack order|duplicates id/);
  assert.match(validation.errors.join(' '), /sequence/);
  assert.match(validation.errors.join(' '), /repeats exact authored text/);
  assert.match(validation.errors.join(' '), /prohibited borrowed, real-person, collectible, or loot reference/);
});

test('archive save namespace is versioned independently from authored records', () => {
  assert.equal(ARCHIVE_RECORD_SAVE_SCHEMA_VERSION, 1);
  assert.equal(DEFAULT_ARCHIVE_RECORD_SAVE_KEY, `${CAMPAIGN.id}.archive-records.v1`);
});
