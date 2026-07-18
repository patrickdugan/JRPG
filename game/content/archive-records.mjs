/** Complete finite public-archive catalogue in canonical campaign order. */

import {
  ARCHIVE_RECORD_PLAN,
  ARCHIVE_RECORD_SCHEMA_VERSION,
  validateArchiveRecordPack,
} from '../archive-record-contract.mjs';
import { ARCHIVE_RECORDS_EARLY } from './archive-records-early.mjs';
import { ARCHIVE_RECORDS_MIDDLE } from './archive-records-middle.mjs';
import { ARCHIVE_RECORDS_LATE } from './archive-records-late.mjs';

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const records = [
  ...ARCHIVE_RECORDS_EARLY,
  ...ARCHIVE_RECORDS_MIDDLE,
  ...ARCHIVE_RECORDS_LATE,
];
const validation = validateArchiveRecordPack(records, { strictCatalogue: true });
if (!validation.ok) throw new Error(`Invalid complete archive-record catalogue:\n${validation.errors.join('\n')}`);

export const ARCHIVE_RECORD_METRICS = validation.metrics;
export const ARCHIVE_RECORDS = deepFreeze({
  schemaVersion: ARCHIVE_RECORD_SCHEMA_VERSION,
  finite: true,
  repeatable: false,
  completionPolicy: 'once-per-save',
  records,
  metrics: ARCHIVE_RECORD_METRICS,
});

const byId = new Map(records.map((record) => [record.id, record]));
const byChapter = new Map([...new Set(ARCHIVE_RECORD_PLAN.map((slot) => slot.chapterId))].map((chapterId) => [
  chapterId,
  deepFreeze(records.filter((record) => record.chapterId === chapterId)),
]));
const EMPTY_RECORDS = Object.freeze([]);

export function getArchiveRecord(recordId) {
  return byId.get(recordId) ?? null;
}

export function getArchiveRecordsForChapter(chapterId) {
  return byChapter.get(chapterId) ?? EMPTY_RECORDS;
}
