/**
 * Contract for finite public-archive readings.
 *
 * One record slot follows every canonical campaign beat. Records are public
 * reading material with explicit custody and access language; they are not
 * collectibles, prizes, or containers for anonymous suffering.
 */

import { CAMPAIGN } from './content/campaign.mjs';

export const ARCHIVE_RECORD_SCHEMA_VERSION = 1;
export const ARCHIVE_RECORD_SAVE_SCHEMA_VERSION = 1;
export const DEFAULT_ARCHIVE_RECORD_SAVE_KEY = `${CAMPAIGN.id}.archive-records.v${ARCHIVE_RECORD_SAVE_SCHEMA_VERSION}`;

export const ARCHIVE_RECORD_TARGETS = Object.freeze({
  recordCount: 60,
  groupCount: 3,
  recordsPerGroup: 20,
  minimumParagraphsPerRecord: 8,
  maximumParagraphsPerRecord: 12,
  minimumWordsPerRecord: 500,
  minimumCatalogueWords: 30_000,
  minimumTitleCharacters: 8,
  minimumRecordTypeCharacters: 12,
  minimumCustodianCharacters: 12,
  minimumAccessNoteCharacters: 40,
  minimumParagraphCharacters: 80,
  minimumParagraphWords: 35,
});

export const ARCHIVE_RECORD_GUARDRAILS = deepFreeze([
  'Every named person, office, court, and supernatural event is original fictional material.',
  'A record preserves custody, access conditions, correction routes, and acknowledged gaps.',
  'No record turns testimony, persecution, illness, death, or survival into a collectible or prize.',
  'No record grants rewards, playtime, completion bonuses, inventory objects, or combat power.',
  'No record uses a real official, historical individual, performer likeness, or borrowed fictional character.',
  'Sacred practice and community memory are never framed as loot, treasure, weapons, or ownership claims.',
]);

export const ARCHIVE_RECORD_GROUP_NAMES = Object.freeze(['early', 'middle', 'late']);

const RECORD_KEYS = Object.freeze([
  'id',
  'sequence',
  'chapterId',
  'unlockAfterBeatId',
  'title',
  'recordType',
  'custodian',
  'accessNote',
  'paragraphs',
]);

const PLAN_KEYS = Object.freeze([
  'id',
  'group',
  'sequence',
  'chapterId',
  'unlockAfterBeatId',
  'repeatable',
]);

const RECORD_TYPE_LANGUAGE = /account|annotation|brief|case note|catalogue|correction|correspondence|guide|ledger|letter|map|memorandum|minute|notice|record|register|report|statement|testimony|transcript/i;
const ACCESS_LANGUAGE = /access|consent|correction|open|public|read|request|restricted|review|community/i;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function wordCount(value) {
  return typeof value === 'string'
    ? value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0
    : 0;
}

function prohibited(text) {
  return /adam\s+driver|castlevania|symphony\s+of\s+the\s+night|final\s+fantasy|metroidvania|dracula|belmont|alucard|tokugawa|ieyasu|hidetada|iemitsu|oda\s+nobunaga|toyotomi\s+hideyoshi|francis\s+xavier|alessandro\s+valignano|jo[aã]o\s+rodrigues|william\s+adams|date\s+masamune|portrayed\s+by|played\s+by|likeness\s+of|celebrity\s+likeness|real[-\s]world\s+(?:official|person)|historical\s+(?:official|person)\s+likeness|TODO|TBD|placeholder|lorem\s+ipsum|holy\s+relic|sacred\s+(?:artifact|loot|object|relic|treasure|weapon)|collectible|trophy|loot|treasure\s+chest|rare\s+drop|quest\s+reward|completion\s+(?:bonus|prize|reward)|archive\s+(?:points|token)|record\s+token|experience\s+points/i.test(text);
}

const canonicalBeats = CAMPAIGN.chapters.flatMap((chapter) => (
  chapter.beats.map((beat) => ({ beatId: beat.id, chapterId: chapter.id }))
));

const plan = canonicalBeats.map((beat, index) => {
  const sequence = index + 1;
  const group = ARCHIVE_RECORD_GROUP_NAMES[Math.floor(index / ARCHIVE_RECORD_TARGETS.recordsPerGroup)];
  return {
    id: `archive-${beat.beatId}`,
    group,
    sequence,
    chapterId: beat.chapterId,
    unlockAfterBeatId: beat.beatId,
    repeatable: false,
  };
});

function validatePlan(entries) {
  const errors = [];
  if (entries.length !== ARCHIVE_RECORD_TARGETS.recordCount) {
    errors.push(`Archive record plan must contain ${ARCHIVE_RECORD_TARGETS.recordCount} slots.`);
  }
  const ids = new Set();
  entries.forEach((slot, index) => {
    const beat = canonicalBeats[index];
    const expectedGroup = ARCHIVE_RECORD_GROUP_NAMES[Math.floor(index / ARCHIVE_RECORD_TARGETS.recordsPerGroup)];
    if (!exactKeys(slot, PLAN_KEYS)) errors.push(`Plan slot ${index + 1} has unsupported keys.`);
    if (slot.sequence !== index + 1) errors.push(`Plan slot ${index + 1} sequence is not canonical.`);
    if (slot.id !== `archive-${beat?.beatId}`) errors.push(`Plan slot ${index + 1} id is not canonical.`);
    if (slot.chapterId !== beat?.chapterId || slot.unlockAfterBeatId !== beat?.beatId) {
      errors.push(`Plan slot ${index + 1} chapter or unlock beat is not canonical.`);
    }
    if (slot.group !== expectedGroup) errors.push(`Plan slot ${index + 1} group is not canonical.`);
    if (slot.repeatable !== false) errors.push(`Plan slot ${index + 1} must be non-repeatable.`);
    if (ids.has(slot.id)) errors.push(`Plan slot ${index + 1} duplicates ${slot.id}.`);
    ids.add(slot.id);
  });
  for (const group of ARCHIVE_RECORD_GROUP_NAMES) {
    if (entries.filter((slot) => slot.group === group).length !== ARCHIVE_RECORD_TARGETS.recordsPerGroup) {
      errors.push(`Archive record group ${group} must contain ${ARCHIVE_RECORD_TARGETS.recordsPerGroup} slots.`);
    }
  }
  return deepFreeze({ ok: errors.length === 0, errors });
}

const planValidation = validatePlan(plan);
if (!planValidation.ok) throw new Error(`Invalid archive record plan:\n${planValidation.errors.join('\n')}`);

export const ARCHIVE_RECORD_PLAN = deepFreeze(plan);

export const ARCHIVE_RECORD_GROUPS = deepFreeze(Object.fromEntries(
  ARCHIVE_RECORD_GROUP_NAMES.map((group) => [
    group,
    ARCHIVE_RECORD_PLAN.filter((slot) => slot.group === group).map((slot) => slot.id),
  ]),
));

const PLAN_BY_ID = new Map(ARCHIVE_RECORD_PLAN.map((slot) => [slot.id, slot]));

export function getArchiveRecordPlan(recordId) {
  return PLAN_BY_ID.get(recordId) ?? null;
}

export function getArchiveRecordGroupPlan(group) {
  if (!ARCHIVE_RECORD_GROUP_NAMES.includes(group)) return null;
  return deepFreeze(ARCHIVE_RECORD_GROUPS[group].map((id) => PLAN_BY_ID.get(id)));
}

function metricsFor(records) {
  const inferredGroups = records.map((record) => PLAN_BY_ID.get(record?.id)?.group).filter(Boolean);
  const chapterIds = records.map((record) => record?.chapterId).filter(Boolean);
  return {
    recordCount: records.length,
    paragraphCount: records.reduce((sum, record) => sum + (record?.paragraphs?.length ?? 0), 0),
    wordCount: records.reduce((sum, record) => sum
      + wordCount(record?.title)
      + wordCount(record?.recordType)
      + wordCount(record?.custodian)
      + wordCount(record?.accessNote)
      + (record?.paragraphs ?? []).reduce((paragraphSum, paragraph) => paragraphSum + wordCount(paragraph), 0), 0),
    chapterCount: new Set(chapterIds).size,
    byGroup: Object.fromEntries(ARCHIVE_RECORD_GROUP_NAMES.map((group) => [
      group,
      inferredGroups.filter((candidate) => candidate === group).length,
    ])),
  };
}

function failClosed(message) {
  return deepFreeze({ ok: false, errors: [message], metrics: metricsFor([]) });
}

function expectedSlotsFor(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return { error: 'Archive record validation options must be an object.' };
  }
  const allowed = new Set(['expectedGroup', 'strictCatalogue']);
  if (Object.keys(options).some((key) => !allowed.has(key))) {
    return { error: 'Archive record validation options contain unsupported keys.' };
  }
  const strictCatalogue = options.strictCatalogue === true;
  const expectedGroup = options.expectedGroup ?? null;
  if (options.strictCatalogue != null && typeof options.strictCatalogue !== 'boolean') {
    return { error: 'strictCatalogue must be a boolean.' };
  }
  if (strictCatalogue) {
    if (expectedGroup != null) return { error: 'A full catalogue cannot also select a partial group.' };
    return { slots: ARCHIVE_RECORD_PLAN, strictCatalogue: true };
  }
  if (!ARCHIVE_RECORD_GROUP_NAMES.includes(expectedGroup)) {
    return { error: 'A partial pack must select expectedGroup early, middle, or late.' };
  }
  return {
    slots: ARCHIVE_RECORD_GROUPS[expectedGroup].map((id) => PLAN_BY_ID.get(id)),
    strictCatalogue: false,
  };
}

/**
 * Validate one exact twenty-record authoring group or the complete catalogue.
 *
 * Partial: `validateArchiveRecordPack(records, { expectedGroup: 'early' })`
 * Full:    `validateArchiveRecordPack(records, { strictCatalogue: true })`
 */
export function validateArchiveRecordPack(records, options = {}) {
  if (!Array.isArray(records)) return failClosed('Archive record pack must be an array.');
  const expected = expectedSlotsFor(options);
  if (expected.error) return failClosed(expected.error);

  const errors = [];
  const seenIds = new Set();
  const seenText = new Set();
  if (records.length !== expected.slots.length) {
    errors.push(`Expected ${expected.slots.length} archive records; received ${records.length}.`);
  }

  records.forEach((record, index) => {
    const label = `record ${index + 1}`;
    const slot = expected.slots[index];
    const planned = PLAN_BY_ID.get(record?.id);
    if (!exactKeys(record, RECORD_KEYS)) errors.push(`${label} must contain exactly the archive record keys.`);
    if (!planned || record?.id !== slot?.id) errors.push(`${label} is outside canonical pack order.`);
    if (seenIds.has(record?.id)) errors.push(`${label} duplicates id ${record?.id}.`);
    seenIds.add(record?.id);
    if (record?.sequence !== slot?.sequence) errors.push(`${label} sequence does not match the plan.`);
    if (record?.chapterId !== slot?.chapterId) errors.push(`${label} chapterId does not match the plan.`);
    if (record?.unlockAfterBeatId !== slot?.unlockAfterBeatId) errors.push(`${label} unlock beat does not match the plan.`);

    if (typeof record?.title !== 'string' || record.title.trim().length < ARCHIVE_RECORD_TARGETS.minimumTitleCharacters
      || record.title.trim().split(/\s+/).length < 2) {
      errors.push(`${label} needs a concrete multi-word title.`);
    }
    if (typeof record?.recordType !== 'string' || record.recordType.trim().length < ARCHIVE_RECORD_TARGETS.minimumRecordTypeCharacters
      || !RECORD_TYPE_LANGUAGE.test(record.recordType)) {
      errors.push(`${label} needs a descriptive archive recordType.`);
    }
    if (typeof record?.custodian !== 'string' || record.custodian.trim().length < ARCHIVE_RECORD_TARGETS.minimumCustodianCharacters
      || record.custodian.trim().split(/\s+/).length < 2) {
      errors.push(`${label} needs a specific accountable custodian.`);
    }
    if (typeof record?.accessNote !== 'string' || record.accessNote.trim().length < ARCHIVE_RECORD_TARGETS.minimumAccessNoteCharacters
      || !ACCESS_LANGUAGE.test(record.accessNote)) {
      errors.push(`${label} needs a meaningful public access or restriction note.`);
    }

    const paragraphs = record?.paragraphs;
    if (!Array.isArray(paragraphs) || paragraphs.length < ARCHIVE_RECORD_TARGETS.minimumParagraphsPerRecord
      || paragraphs.length > ARCHIVE_RECORD_TARGETS.maximumParagraphsPerRecord) {
      errors.push(`${label} must contain 8-12 paragraphs.`);
    } else {
      paragraphs.forEach((paragraph, paragraphIndex) => {
        if (typeof paragraph !== 'string'
          || paragraph.trim().length < ARCHIVE_RECORD_TARGETS.minimumParagraphCharacters
          || wordCount(paragraph) < ARCHIVE_RECORD_TARGETS.minimumParagraphWords) {
          errors.push(`${label} paragraph ${paragraphIndex + 1} is too short to be a meaningful reading passage.`);
        }
      });
    }

    const authoredText = [
      record?.title,
      record?.recordType,
      record?.custodian,
      record?.accessNote,
      ...(paragraphs ?? []),
    ].filter((value) => typeof value === 'string');
    for (const text of authoredText) {
      if (prohibited(text)) errors.push(`${label} contains a prohibited borrowed, real-person, collectible, or loot reference.`);
      const normalized = text.trim().toLowerCase();
      if (seenText.has(normalized)) errors.push(`${label} repeats exact authored text: ${text}`);
      seenText.add(normalized);
    }
    const words = authoredText.reduce((sum, text) => sum + wordCount(text), 0);
    if (words < ARCHIVE_RECORD_TARGETS.minimumWordsPerRecord) {
      errors.push(`${label} is below ${ARCHIVE_RECORD_TARGETS.minimumWordsPerRecord} counted words.`);
    }
  });

  const metrics = metricsFor(records);
  if (expected.strictCatalogue) {
    if (metrics.recordCount !== ARCHIVE_RECORD_TARGETS.recordCount) errors.push('Full catalogue must contain 60 records.');
    if (metrics.chapterCount !== CAMPAIGN.chapters.length) errors.push('Full catalogue must cover all campaign chapters.');
    if (metrics.wordCount < ARCHIVE_RECORD_TARGETS.minimumCatalogueWords) errors.push('Full catalogue is below the minimum word target.');
    for (const group of ARCHIVE_RECORD_GROUP_NAMES) {
      if (metrics.byGroup[group] !== ARCHIVE_RECORD_TARGETS.recordsPerGroup) {
        errors.push(`Full catalogue must contain 20 ${group} records.`);
      }
    }
  }
  return deepFreeze({ ok: errors.length === 0, errors, metrics });
}
