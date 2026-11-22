import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VOICE_CAST_NAMES,
  VOICE_REVIEW_STORAGE_KEY,
  emptyVoiceReviewBook,
  filterVoiceManifestLines,
  updateVoiceReview,
  validateVoiceReviewBook,
  voiceManifestScenes,
  voiceManifestSpeakers,
  voiceReviewIdentity,
  voiceReviewKey,
  voiceReviewSummary,
} from '../voice-review.mjs';

const manifest = {
  defaultPauseSeconds: 0.4,
  scenes: [
    {
      id: 'last-command',
      title: 'Dawn at the Observatory — The Last Command',
      defaultPauseSeconds: 0.4,
      lineIds: ['01', '02'],
    },
    {
      id: 'cast-auditions',
      title: 'Extended Cast Auditions',
      defaultPauseSeconds: 0.5,
      lineIds: ['ca-01', 'ca-07'],
    },
  ],
  cast: {
    ren: { name: 'Ren Ishikawa', brief: 'Young, plain, quick.' },
    mateus: { name: 'Father Mateus Avelar', brief: 'Weary baritone.' },
    aya: { name: 'Aya Shinohara', brief: 'Measured archivist.' },
    'lady-enma': { name: 'Lady Enma of Ash', brief: 'Former court entertainer.' },
  },
  lines: {
    '01': {
      en: { text: 'Dawn has come.', speaker: 'ren', sceneId: 'last-command', file: 'en/01.ogg', seed: 100, chosenTake: 0 },
      ja: { text: '夜が明けた。', speaker: 'ren', sceneId: 'last-command', file: 'ja/01.ogg', seed: 101, chosenTake: 1 },
    },
    '02': {
      en: { text: 'Listen to the bell.', speaker: 'mateus', sceneId: 'last-command' },
    },
    'ca-01': {
      en: { text: 'It can prove a person existed when an office says otherwise.', speaker: 'aya', sceneId: 'cast-auditions', file: 'en/ca-01.ogg', seed: 10100, chosenTake: 0 },
      ja: { text: '役所の帳面が人を消しても、その人が確かにいたという証にはなります。', speaker: 'aya', sceneId: 'cast-auditions', file: 'ja/ca-01.ogg', seed: 10101, chosenTake: 1 },
    },
    'ca-07': {
      en: { text: 'I offer arithmetic.', speaker: 'lady-enma', sceneId: 'cast-auditions', file: 'en/ca-07.ogg', seed: 10700, chosenTake: 0 },
      ja: { text: 'わたくしが差し出すのは算術でございます。', speaker: 'lady-enma', sceneId: 'cast-auditions', file: 'ja/ca-07.ogg', seed: 10702, chosenTake: 2 },
    },
  },
};
const at = '2026-11-20T06:00:00.000Z';

test('auditions are isolated from game save authority and cover all ten cast members', () => {
  assert.match(VOICE_REVIEW_STORAGE_KEY, /voice-review/);
  assert.doesNotMatch(VOICE_REVIEW_STORAGE_KEY, /campaign|receipt|recovery|playtime/);
  assert.deepEqual(Object.keys(VOICE_CAST_NAMES), [
    'kurozane', 'mateus', 'nikola', 'ren', 'miyo',
    'aya', 'kiku', 'genta', 'lady-enma', 'ujiro',
  ]);
  assert.equal(voiceReviewKey('ja', '01'), 'ja:01');
  assert.equal(voiceReviewKey('en', 'ca-07'), 'en:ca-07');
  assert.throws(() => voiceReviewKey('it', '01'));
  assert.throws(() => voiceReviewKey('en', '../01'));
});

test('review updates preserve language separation and export roundtrip across scenes', () => {
  let book = emptyVoiceReviewBook();
  book = updateVoiceReview(book, manifest, 'en', '01', 'accepted', 'Diction good.', at);
  book = updateVoiceReview(book, manifest, 'ja', '01', 'pronunciation', 'Pitch accent needs native check.', at);
  book = updateVoiceReview(book, manifest, 'en', 'ca-07', 'accepted', 'Poised court cadence.', at);
  const imported = validateVoiceReviewBook(JSON.parse(JSON.stringify(book)), manifest);
  assert.equal(imported.valid, true);
  assert.deepEqual(imported.book, book);
  assert.deepEqual(voiceReviewSummary(imported.book, manifest), {
    total: 7, audioReady: 6, pending: 4, accepted: 2, retake: 0, pronunciation: 1, script: 0,
  });
  assert.equal(voiceReviewSummary(book, manifest, 'en').total, 4);
  assert.deepEqual(voiceReviewSummary(book, manifest, 'en', { sceneId: 'cast-auditions' }), {
    total: 2, audioReady: 2, pending: 1, accepted: 1, retake: 0, pronunciation: 0, script: 0,
  });
  assert.deepEqual(voiceReviewSummary(book, manifest, 'en', { speaker: 'lady-enma' }), {
    total: 1, audioReady: 1, pending: 0, accepted: 1, retake: 0, pronunciation: 0, script: 0,
  });
  book = updateVoiceReview(book, manifest, 'en', '01', 'pending', '', at);
  assert.equal(book.entries['en:01'], undefined);
  assert.equal(book.entries['ja:01'].status, 'pronunciation');
});

test('multi-scene and speaker filters preserve canonical scene ordering and legacy fallback', () => {
  const scenes = voiceManifestScenes(manifest);
  assert.equal(scenes.length, 2);
  assert.deepEqual(scenes.map((scene) => scene.id), ['last-command', 'cast-auditions']);
  const speakers = voiceManifestSpeakers(manifest);
  assert.deepEqual(speakers.map((speaker) => speaker.id), ['mateus', 'ren', 'aya', 'lady-enma']);

  const auditionEntries = filterVoiceManifestLines(manifest, { language: 'ja', sceneId: 'cast-auditions' });
  assert.deepEqual(auditionEntries.map((entry) => entry.id), ['ca-01', 'ca-07']);
  const enmaEntries = filterVoiceManifestLines(manifest, { language: 'en', speaker: 'lady-enma' });
  assert.deepEqual(enmaEntries.map((entry) => entry.id), ['ca-07']);

  const legacyManifest = { lines: { '02': manifest.lines['02'], '01': manifest.lines['01'] } };
  assert.equal(voiceManifestScenes(legacyManifest).length, 1);
  assert.deepEqual(filterVoiceManifestLines(legacyManifest, { language: 'en' }).map((entry) => entry.id), ['01', '02']);
});

test('review identity invalidates changed text or selected audio take', () => {
  const book = updateVoiceReview(emptyVoiceReviewBook(), manifest, 'en', '01', 'accepted', '', at);
  const changedText = structuredClone(manifest);
  changedText.lines['01'].en.text = 'Dawn is coming.';
  assert.equal(validateVoiceReviewBook(book, changedText).valid, false);
  assert.equal(voiceReviewSummary(book, changedText).pending, 7);
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
  assert.equal(voiceReviewSummary(book, manifest).audioReady, 6);
  assert.equal(voiceReviewSummary(book, manifest).script, 1);
});
