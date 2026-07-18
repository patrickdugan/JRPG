/** Persistent, DOM-free line staging for campaign dialogue. */

import { CAMPAIGN } from './content/campaign.mjs';

export const NARRATIVE_SCHEMA_VERSION = 1;
export const DEFAULT_NARRATIVE_SAVE_KEY = `${CAMPAIGN.id}.narrative.v${NARRATIVE_SCHEMA_VERSION}`;

const BEAT_IDS = Object.freeze(CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.id)));
const BEAT_ORDER = new Map(BEAT_IDS.map((id, index) => [id, index]));

const freezeState = (records, revision) => Object.freeze({
  schemaVersion: NARRATIVE_SCHEMA_VERSION,
  campaignId: CAMPAIGN.id,
  records: Object.freeze(records.map((record) => Object.freeze({ ...record }))),
  revision,
});

function assertBeat(beatId) {
  if (!BEAT_ORDER.has(beatId)) throw new RangeError(`Unknown beat ID: ${beatId}`);
}

function assertLineCount(lineCount) {
  if (!Number.isSafeInteger(lineCount) || lineCount < 0 || lineCount > 10_000) {
    throw new RangeError('Narrative line count must be an integer from 0 to 10000.');
  }
}

export function createNarrativeState() {
  return freezeState([], 0);
}

export function getNarrativeProgress(state, beatId, lineCount) {
  assertBeat(beatId);
  assertLineCount(lineCount);
  const record = state.records.find((entry) => entry.beatId === beatId);
  const acknowledgedLines = Math.min(lineCount, record?.acknowledgedLines ?? 0);
  return Object.freeze({
    beatId,
    acknowledgedLines,
    lineCount,
    currentLineIndex: lineCount ? Math.min(acknowledgedLines, lineCount - 1) : null,
    complete: acknowledgedLines >= lineCount,
  });
}

export function advanceNarrative(state, beatId, lineCount) {
  const progress = getNarrativeProgress(state, beatId, lineCount);
  if (progress.complete) return Object.freeze({ ok: true, state, progress, advanced: false });
  const replacement = { beatId, acknowledgedLines: progress.acknowledgedLines + 1 };
  const records = state.records.filter((entry) => entry.beatId !== beatId);
  records.push(replacement);
  records.sort((left, right) => BEAT_ORDER.get(left.beatId) - BEAT_ORDER.get(right.beatId));
  const next = freezeState(records, state.revision + 1);
  return Object.freeze({ ok: true, state: next, progress: getNarrativeProgress(next, beatId, lineCount), advanced: true });
}

export function validateNarrativePayload(payload) {
  const errors = [];
  const expected = ['schemaVersion', 'campaignId', 'records', 'revision'];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return Object.freeze({ ok: false, state: createNarrativeState(), errors: Object.freeze(['Narrative save must be an object.']) });
  }
  if (Object.keys(payload).length !== expected.length || Object.keys(payload).some((key, index) => key !== expected[index])) errors.push('Narrative save keys or order are invalid.');
  if (payload.schemaVersion !== NARRATIVE_SCHEMA_VERSION) errors.push(`schemaVersion must equal ${NARRATIVE_SCHEMA_VERSION}.`);
  if (payload.campaignId !== CAMPAIGN.id) errors.push(`campaignId must equal ${CAMPAIGN.id}.`);
  if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) errors.push('revision must be a non-negative safe integer.');
  if (!Array.isArray(payload.records)) errors.push('records must be an array.');
  else {
    const seen = new Set();
    let priorOrder = -1;
    for (const [index, record] of payload.records.entries()) {
      if (!record || typeof record !== 'object' || Array.isArray(record)
        || Object.keys(record).length !== 2 || Object.keys(record)[0] !== 'beatId' || Object.keys(record)[1] !== 'acknowledgedLines') {
        errors.push(`records[${index}] has invalid keys.`);
        continue;
      }
      if (!BEAT_ORDER.has(record.beatId)) errors.push(`records[${index}] has unknown beatId.`);
      if (seen.has(record.beatId)) errors.push(`records[${index}] duplicates beatId.`);
      seen.add(record.beatId);
      const order = BEAT_ORDER.get(record.beatId) ?? -1;
      if (order <= priorOrder) errors.push('records must use canonical beat order.');
      priorOrder = order;
      if (!Number.isSafeInteger(record.acknowledgedLines) || record.acknowledgedLines < 1 || record.acknowledgedLines > 10_000) {
        errors.push(`records[${index}].acknowledgedLines is invalid.`);
      }
    }
  }
  if (errors.length) return Object.freeze({ ok: false, state: createNarrativeState(), errors: Object.freeze(errors) });
  return Object.freeze({ ok: true, state: freezeState(payload.records, payload.revision), errors: Object.freeze([]) });
}

export function serializeNarrativeState(state) {
  const validation = validateNarrativePayload(state);
  if (!validation.ok) throw new TypeError(validation.errors.join(' '));
  return JSON.stringify(validation.state);
}

export function loadNarrativeState(serialized) {
  if (serialized == null || serialized === '') return Object.freeze({ ok: true, state: createNarrativeState(), fresh: true, errors: Object.freeze([]) });
  try {
    const result = validateNarrativePayload(JSON.parse(serialized));
    return Object.freeze({ ...result, fresh: false });
  } catch {
    return Object.freeze({ ok: false, state: createNarrativeState(), fresh: false, errors: Object.freeze(['Narrative save is not valid JSON.']) });
  }
}

export function createNarrativeStorageAdapter(storage = globalThis.localStorage, key = DEFAULT_NARRATIVE_SAVE_KEY) {
  return Object.freeze({
    load() {
      try { return loadNarrativeState(storage?.getItem?.(key)); }
      catch { return Object.freeze({ ok: false, state: createNarrativeState(), errors: Object.freeze(['Narrative storage could not be read.']) }); }
    },
    save(state) {
      try { storage?.setItem?.(key, serializeNarrativeState(state)); return Object.freeze({ ok: true }); }
      catch { return Object.freeze({ ok: false, errors: Object.freeze(['Narrative storage could not be written.']) }); }
    },
    clear() {
      try { storage?.removeItem?.(key); return Object.freeze({ ok: true }); }
      catch { return Object.freeze({ ok: false, errors: Object.freeze(['Narrative storage could not be cleared.']) }); }
    },
  });
}
