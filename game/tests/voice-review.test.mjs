import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VOICE_REVIEW_STORAGE_KEY,
  emptyVoiceReviewBook,
  updateVoiceReview,
  validateVoiceReviewBook,
  voiceReviewIdentity,
  voiceReviewKey,
  voiceReviewSummary,
} from '../voice-review.mjs';

const manifest = {
  lines: {
    '01': {
      en: { text: 'Dawn has come.', speaker: 'ren', file: 'en/01.ogg', seed: 100, chosenTake: 0 },
      ja: { text: '夜が明けた。', speaker: 'ren', file: 'ja/01.ogg', seed: 101, chosenTake: 1 },
    },
    '02': {
      en: { text: 'Listen to the bell.', speaker: 'mateus' },
    },
  },
};
const at = '2026-11-20T06:00:00.000Z';

test('auditions are isolated from game save authority', () => {
  assert.match(VOICE_REVIEW_STORAGE_KEY, /voice-review/);
  assert.doesNotMatch(VOICE_REVIEW_STORAGE_KEY, /campaign|receipt|recovery|playtime/);
  assert.equal(voiceReviewKey('ja', '01'), 'ja:01');
  assert.throws(() => voiceReviewKey('it', '01'));
  assert.throws(() => voiceReviewKey('en', '../01'));
});

test('review updates preserve language separation and export roundtrip', () => {
  let book = emptyVoiceReviewBook();
  book = updateVoiceReview(book, manifest, 'en', '01', 'accepted', 'Diction good.', at);
  book = updateVoiceReview(book, manifest, 'ja', '01', 'pronunciation', 'Pitch accent needs native check.', at);
  const imported = validateVoiceReviewBook(JSON.parse(JSON.stringify(book)), manifest);
  assert.equal(imported.valid, true);
  assert.deepEqual(imported.book, book);
  assert.deepEqual(voiceReviewSummary(imported.book, manifest), {
    total: 3, audioReady: 2, pending: 1, accepted: 1, retake: 0, pronunciation: 1, script: 0,
  });
  assert.equal(voiceReviewSummary(book, manifest, 'en').total, 2);
  book = updateVoiceReview(book, manifest, 'en', '01', 'pending', '', at);
  assert.equal(book.entries['en:01'], undefined);
  assert.equal(book.entries['ja:01'].status, 'pronunciation');
});

test('review identity invalidates changed text or selected audio take', () => {
  const book = updateVoiceReview(emptyVoiceReviewBook(), manifest, 'en', '01', 'accepted', '', at);
  const changedText = structuredClone(manifest);
  changedText.lines['01'].en.text = 'Dawn is coming.';
  assert.equal(validateVoiceReviewBook(book, changedText).valid, false);
  assert.equal(voiceReviewSummary(book, changedText).pending, 3);
  const changedTake = structuredClone(manifest);
  changedTake.lines['01'].en.chosenTake = 2;
  assert.equal(validateVoiceReviewBook(book, changedTake).valid, false);
  assert.notEqual(voiceReviewIdentity(manifest, 'en', '01'), voiceReviewIdentity(changedTake, 'en', '01'));
});

test('reject malformed or malicious imports and protect pending records', () => {
  const book = updateVoiceReview(emptyVoiceReviewBook(), manifest, 'en', '01', 'retake', 'Clip pops.', at);
  assert.equal(validateVoiceReviewBook({ schemaVersion: 2, entries: {} }, manifest).valid, false);
  const unknown = structuredClone(book);
  unknown.entries['en:03'] = unknown.entries['en:01'];
  assert.equal(validateVoiceReviewBook(unknown, manifest).valid, false);
  const badStatus = structuredClone(book);
  badStatus.entries['en:01'].status = 'run arbitrary code';
  assert.equal(validateVoiceReviewBook(badStatus, manifest).valid, false);
  const oversized = structuredClone(book);
  oversized.entries['en:01'].note = 'x'.repeat(1201);
  assert.equal(validateVoiceReviewBook(oversized, manifest).valid, false);
  assert.throws(() => updateVoiceReview(book, manifest, 'en', '01', 'accepted', 'x'.repeat(1201), at));
  assert.equal(validateVoiceReviewBook(JSON.parse('{"schemaVersion":1,"entries":{"__proto__":{}}}'), manifest).valid, false);
});

test('missing audio can collect script review notes without claiming a playable take', () => {
  const book = updateVoiceReview(emptyVoiceReviewBook(), manifest, 'en', '02', 'script', 'Check register.', at);
  assert.equal(voiceReviewSummary(book, manifest).audioReady, 2);
  assert.equal(voiceReviewSummary(book, manifest).script, 1);
});
