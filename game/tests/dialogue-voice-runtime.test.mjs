import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  DEFAULT_DIALOGUE_VOICE_PREFERENCES,
  DIALOGUE_VOICE_STORAGE_KEY,
  createDialogueVoiceRuntime,
  createVoiceManifestIndex,
  loadDialogueVoicePreferences,
  matchManifestDialogueLine,
  matchStoryworldVoiceSequence,
  mountDialogueVoiceControls,
  normalizeDialogueSpeaker,
  normalizeDialogueText,
  resolvePauseBeforeMs,
  saveDialogueVoicePreferences,
} from '../dialogue-voice-runtime.mjs';
import { RECOVERY_CHECKPOINT_AUTHORITIES } from '../recovery-checkpoint.mjs';

const GAME_ROOT = resolve(import.meta.dirname, '..');

const SAMPLE_MANIFEST = Object.freeze({
  id: 'voice-prototype-v1:last-command',
  defaultPauseSeconds: 0.4,
  pauseBeforeSeconds: {
    '18': 1.2,
    '25': 1.5,
    'ca-08': 0.8,
  },
  scenes: [
    { id: 'last-command', defaultPauseSeconds: 0.4, lineIds: ['10', '12', '18', '25'] },
    { id: 'cast-auditions', defaultPauseSeconds: 0.5, lineIds: ['ca-03', 'ca-08'] },
  ],
  lines: {
    '10': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/10-kurozane.ogg',
        speaker: 'kurozane',
        sceneId: 'last-command',
        text: 'Avelar, come home. I never asked you to become good, only useful.',
      },
      ja: {
        file: './assets/audio/voice-prototype-v1/ja/10-kurozane.ogg',
        speaker: 'kurozane',
        sceneId: 'last-command',
        text: 'アヴェラール、帰ってこい。善くなれと言ったことはない。役に立てと言っただけだ。',
      },
    },
    '12': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/12-mateus.ogg',
        speaker: 'mateus',
        sceneId: 'last-command',
        text: 'Black Sun Concord!',
      },
      ja: {
        file: './assets/audio/voice-prototype-v1/ja/12-mateus.ogg',
        speaker: 'mateus',
        sceneId: 'last-command',
        text: '黒陽の盟約！',
      },
    },
    '18': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/18-mateus.ogg',
        speaker: 'mateus',
        sceneId: 'last-command',
        text: 'You killed my son!',
      },
      ja: {
        file: './assets/audio/voice-prototype-v1/ja/18-mateus.ogg',
        speaker: 'mateus',
        sceneId: 'last-command',
        text: 'お前は私の息子を殺した！',
      },
    },
    '25': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/25-kurozane.ogg',
        speaker: 'kurozane',
        sceneId: 'last-command',
        text: '...Yes.',
      },
      ja: {
        file: './assets/audio/voice-prototype-v1/ja/25-kurozane.ogg',
        speaker: 'kurozane',
        sceneId: 'last-command',
        text: '……はい。',
      },
    },
    'ca-03': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/ca-03-kiku.ogg',
        speaker: 'kiku',
        sceneId: 'cast-auditions',
        text: 'Then carry the bottle. Let someone else make the speech.',
      },
      ja: {
        file: './assets/audio/voice-prototype-v1/ja/ca-03-kiku.ogg',
        speaker: 'kiku',
        sceneId: 'cast-auditions',
        text: 'ならこの薬を運びなさい。演説は他の誰かに任せておけばいい。',
      },
    },
    'ca-08': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/ca-08-lady-enma.ogg',
        speaker: 'lady-enma',
        sceneId: 'cast-auditions',
        text: 'He will offer each of you the room where your oldest ache appears reasonable. Refuse the room, not the ache.',
      },
      ja: {
        file: './assets/audio/voice-prototype-v1/ja/ca-08-lady-enma.ogg',
        speaker: 'lady-enma',
        sceneId: 'cast-auditions',
        text: 'あの方は、あなた方それぞれの古い痛みが筋の通ったものに見える部屋を差し出します。痛みをではなく、その部屋を拒みなさいませ。',
      },
    },
  },
});

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
    values,
  };
}

function createFakeClock() {
  let nextId = 1;
  const active = new Map();
  return {
    active,
    setTimer(fn, ms) {
      const id = nextId++;
      active.set(id, { fn, ms });
      return id;
    },
    clearTimer(id) {
      active.delete(id);
    },
    flushNext() {
      const first = active.entries().next();
      if (first.done) return null;
      const [id, entry] = first.value;
      active.delete(id);
      entry.fn();
      return entry.ms;
    },
  };
}

function flushAsync() {
  return new Promise((resolvePromise) => setImmediate(resolvePromise));
}

class FakeAudio extends EventTarget {
  constructor(src, { rejectPlay = false } = {}) {
    super();
    this.src = src;
    this.volume = 1;
    this.paused = true;
    this.pauseCalls = 0;
    this.playCalls = 0;
    this.rejectPlay = rejectPlay;
  }

  play() {
    this.playCalls += 1;
    if (this.rejectPlay) {
      return Promise.reject(new Error('NotAllowedError: play() failed because user did not interact.'));
    }
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.pauseCalls += 1;
  }

  finishEnded() {
    this.paused = true;
    this.dispatchEvent(new Event('ended'));
  }

  finishError() {
    this.paused = true;
    this.dispatchEvent(new Event('error'));
  }
}

class FakeControl extends EventTarget {
  constructor(value = '') {
    super();
    this.value = value;
    this.textContent = '';
    this.disabled = false;
    this.hidden = false;
    this.attributes = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
}

test('storage key stays strictly isolated from all 14 canonical save authorities', () => {
  assert.equal(DIALOGUE_VOICE_STORAGE_KEY, 'bbc.dialogueVoice.v1');
  const authorityKeys = new Set(RECOVERY_CHECKPOINT_AUTHORITIES.map(({ key }) => key));
  assert.equal(authorityKeys.size, 14);
  assert.equal(authorityKeys.has(DIALOGUE_VOICE_STORAGE_KEY), false);
  for (const { key } of RECOVERY_CHECKPOINT_AUTHORITIES) {
    assert.notEqual(key, DIALOGUE_VOICE_STORAGE_KEY);
  }

  assert.deepEqual(loadDialogueVoicePreferences(memoryStorage()), DEFAULT_DIALOGUE_VOICE_PREFERENCES);
  assert.equal(DEFAULT_DIALOGUE_VOICE_PREFERENCES.enabled, false);
  assert.equal(DEFAULT_DIALOGUE_VOICE_PREFERENCES.language, 'en');

  const storage = memoryStorage();
  assert.equal(saveDialogueVoicePreferences(storage, { schemaVersion: 1, enabled: true, language: 'ja' }), true);
  assert.deepEqual(loadDialogueVoicePreferences(storage), { schemaVersion: 1, enabled: true, language: 'ja' });
  assert.equal(saveDialogueVoicePreferences(storage, { schemaVersion: 1, enabled: true, language: 'fr' }), false);
  assert.equal(saveDialogueVoicePreferences(storage, { schemaVersion: 2, enabled: false, language: 'en' }), false);
  assert.deepEqual(
    loadDialogueVoicePreferences({ getItem() { throw new Error('blocked'); } }),
    DEFAULT_DIALOGUE_VOICE_PREFERENCES,
  );
});

test('speaker and punctuation normalization match canonical Campaign script to both EN and JA takes', () => {
  assert.equal(normalizeDialogueSpeaker('LADY ENMA'), 'lady-enma');
  assert.equal(normalizeDialogueSpeaker('Count Nikola Dražanić'), 'nikola');
  assert.equal(normalizeDialogueSpeaker('LISE'), 'nikola');
  assert.equal(normalizeDialogueSpeaker('Magistrate Ujiro Arata'), 'ujiro');
  assert.equal(
    normalizeDialogueText('Avelar, come home. I never asked you to become good—only useful.'),
    normalizeDialogueText('Avelar, come home. I never asked you to become good, only useful.'),
  );

  const index = createVoiceManifestIndex(SAMPLE_MANIFEST);
  const enMatch = matchManifestDialogueLine(index, {
    speaker: 'KUROZANE',
    text: 'Avelar, come home. I never asked you to become good—only useful.',
    language: 'en',
  });
  assert.equal(enMatch?.lineId, '10');
  assert.equal(enMatch?.pauseBeforeMs, 400);
  assert.match(enMatch?.file ?? '', /\/en\/10-kurozane\.ogg$/);

  const jaDualAudioMatch = matchManifestDialogueLine(index, {
    speaker: 'MATEUS',
    text: 'Black Sun Concord.',
    language: 'ja',
  });
  assert.equal(jaDualAudioMatch?.lineId, '12');
  assert.match(jaDualAudioMatch?.file ?? '', /\/ja\/12-mateus\.ogg$/);

  const enmaMatch = matchManifestDialogueLine(index, {
    speaker: 'LADY ENMA',
    text: 'He will offer each of you the room where your oldest ache appears reasonable. Refuse the room, not the ache.',
    language: 'ja',
  });
  assert.equal(enmaMatch?.lineId, 'ca-08');
  assert.equal(enmaMatch?.pauseBeforeMs, 800);

  assert.equal(resolvePauseBeforeMs(SAMPLE_MANIFEST, '25', 'last-command'), 1500);
  assert.equal(resolvePauseBeforeMs(SAMPLE_MANIFEST, 'ca-03', 'cast-auditions'), 500);
  assert.equal(matchManifestDialogueLine(index, { speaker: 'NARRATOR', text: 'Rain falls.', language: 'en' }), null);
});

test('default OFF performs zero network or audio work; enabling lazily fetches once and honours pauses', async () => {
  const storage = memoryStorage();
  const clock = createFakeClock();
  const audios = [];
  let fetchCalls = 0;

  const runtime = createDialogueVoiceRuntime({
    storage,
    fetchImpl: async () => {
      fetchCalls += 1;
      return { ok: true, json: async () => SAMPLE_MANIFEST };
    },
    createAudio: (src) => {
      const audio = new FakeAudio(src);
      audios.push(audio);
      return audio;
    },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    getVolume: () => 0.65,
  });

  assert.equal(runtime.getState().enabled, false);
  assert.equal(runtime.getState().subtitlesAlwaysOn, true);

  await runtime.presentDialogueLine({
    beatId: 'p02-medicine-across-lane',
    lineIndex: 2,
    speaker: 'KIKU',
    text: 'Then carry the bottle. Let someone else make the speech.',
  });
  assert.equal(fetchCalls, 0);
  assert.equal(audios.length, 0);
  assert.equal(clock.active.size, 0);

  // Toggling Voice ON replays the remembered active line after loading the manifest lazily.
  const enablePromise = runtime.toggleEnabled();
  await flushAsync();
  assert.equal(fetchCalls, 1);
  assert.equal(clock.active.size, 1);
  const pausedMs = clock.flushNext();
  assert.equal(pausedMs, 500);
  await flushAsync();
  assert.equal(audios.length, 1);
  assert.match(audios[0].src, /\/en\/ca-03-kiku\.ogg$/);
  assert.equal(audios[0].volume, 0.65);

  // Re-presenting the identical active line does not restart or duplicate playback.
  await runtime.presentDialogueLine({
    beatId: 'p02-medicine-across-lane',
    lineIndex: 2,
    speaker: 'KIKU',
    text: 'Then carry the bottle. Let someone else make the speech.',
  });
  assert.equal(audios.length, 1);
  assert.equal(audios[0].pauseCalls, 0);

  audios[0].finishEnded();
  await enablePromise;
  assert.equal(runtime.getState().playing, false);
  assert.equal(fetchCalls, 1);
});

test('advancing dialogue, cancelling, switching language, or toggling OFF cancels timers and audio without leaks', async () => {
  const storage = memoryStorage({
    [DIALOGUE_VOICE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, enabled: true, language: 'en' }),
  });
  const clock = createFakeClock();
  const audios = [];

  const runtime = createDialogueVoiceRuntime({
    storage,
    fetchImpl: async () => ({ ok: true, json: async () => SAMPLE_MANIFEST }),
    createAudio: (src) => {
      const audio = new FakeAudio(src);
      audios.push(audio);
      return audio;
    },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  // Start line 18 (1200 ms pause) and cancel mid-pause (simulating quick N press).
  const firstRun = runtime.presentDialogueLine({
    beatId: 'sw10',
    lineIndex: 0,
    speaker: 'MATEUS',
    text: 'You killed my son!',
  });
  await flushAsync();
  assert.equal(clock.active.size, 1);
  runtime.cancel();
  assert.equal(clock.active.size, 0);
  assert.equal(await firstRun, false);
  assert.equal(audios.length, 0);

  // Start line 10, flush its 400 ms pause so Audio starts playing, then switch EN -> JA mid-clip.
  const secondRun = runtime.presentDialogueLine({
    beatId: 'c9-05-dawn-at-observatory',
    lineIndex: 9,
    speaker: 'KUROZANE',
    text: 'Avelar, come home. I never asked you to become good—only useful.',
  });
  await flushAsync();
  assert.equal(clock.flushNext(), 400);
  await flushAsync();
  assert.equal(audios.length, 1);
  assert.equal(audios[0].paused, false);

  const switchPromise = runtime.setLanguage('ja');
  assert.equal(audios[0].pauseCalls, 1);
  assert.equal(await secondRun, false);
  await flushAsync();
  assert.equal(clock.flushNext(), 400);
  await flushAsync();
  assert.equal(audios.length, 2);
  assert.match(audios[1].src, /\/ja\/10-kurozane\.ogg$/);

  // Toggling Voice OFF stops the JA take immediately and leaves zero active timers.
  await runtime.setEnabled(false);
  assert.equal(audios[1].pauseCalls, 1);
  assert.equal(clock.active.size, 0);
  await switchPromise;
  assert.equal(runtime.getState().playing, false);
});

test('Storyworld confession-reversal sequence honours dramatic pauses and fails closed on errors', async () => {
  const storage = memoryStorage({
    [DIALOGUE_VOICE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, enabled: true, language: 'ja' }),
  });
  const clock = createFakeClock();
  const audios = [];

  const runtime = createDialogueVoiceRuntime({
    storage,
    fetchImpl: async () => ({ ok: true, json: async () => SAMPLE_MANIFEST }),
    createAudio: (src) => {
      const audio = new FakeAudio(src);
      audios.push(audio);
      return audio;
    },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });

  const sequence = matchStoryworldVoiceSequence(createVoiceManifestIndex(SAMPLE_MANIFEST), {
    reactionId: 'page_sw11_decision_opt_name-the-crime_r_confession-reversal',
    language: 'ja',
  });
  assert.deepEqual(sequence.map((cue) => cue.lineId), ['18', '25']);
  assert.deepEqual(sequence.map((cue) => cue.pauseBeforeMs), [1200, 1500]);

  const storyRun = runtime.presentStoryworld({
    clusterId: 'sw10-corrections-desk',
    phase: 'entry-reaction',
    reactionId: 'page_sw11_decision_opt_name-the-crime_r_confession-reversal',
    reactionText: '「お前は私の息子を殺した」',
  });
  await flushAsync();
  assert.equal(clock.flushNext(), 1200);
  await flushAsync();
  assert.equal(audios.length, 1);
  assert.match(audios[0].src, /\/ja\/18-mateus\.ogg$/);
  audios[0].finishEnded();
  await flushAsync();
  assert.equal(clock.flushNext(), 1500);
  await flushAsync();
  assert.equal(audios.length, 2);
  assert.match(audios[1].src, /\/ja\/25-kurozane\.ogg$/);
  audios[1].finishEnded();
  assert.equal(await storyRun, true);

  // Autoplay rejection and HTTP errors fail closed silently without throwing or leaking timers.
  const blockedRuntime = createDialogueVoiceRuntime({
    storage,
    fetchImpl: async () => ({ ok: true, json: async () => SAMPLE_MANIFEST }),
    createAudio: (src) => new FakeAudio(src, { rejectPlay: true }),
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  });
  const blockedPromise = blockedRuntime.presentDialogueLine({
    beatId: 'p02',
    lineIndex: 0,
    speaker: 'KIKU',
    text: 'Then carry the bottle. Let someone else make the speech.',
  });
  await flushAsync();
  clock.flushNext();
  await flushAsync();
  assert.equal(await blockedPromise, false);
  assert.equal(clock.active.size, 0);
});

test('DOM mount binds #voiceToggle, #voiceLanguage, and #voiceStatus with subtitles always affirmed', async () => {
  const controls = {
    '#voiceToggle': new FakeControl(),
    '#voiceLanguageWrap': new FakeControl(),
    '#voiceLanguage': new FakeControl('en'),
    '#voiceStatus': new FakeControl(),
  };
  const root = { querySelector: (selector) => controls[selector] ?? null };
  const storage = memoryStorage();
  const mounted = mountDialogueVoiceControls({
    root,
    storage,
    runtimeOptions: {
      fetchImpl: async () => ({ ok: false, status: 404 }),
    },
  });

  assert.equal(controls['#voiceToggle'].textContent, 'Voice: Off');
  assert.equal(controls['#voiceToggle'].attributes.get('aria-pressed'), 'false');
  assert.equal(controls['#voiceLanguageWrap'].hidden, true);
  assert.match(controls['#voiceStatus'].textContent, /Subtitles always on/i);

  controls['#voiceToggle'].dispatchEvent(new Event('click'));
  await Promise.resolve();
  assert.equal(controls['#voiceToggle'].textContent, 'Voice: On');
  assert.equal(controls['#voiceLanguageWrap'].hidden, false);
  assert.match(controls['#voiceStatus'].textContent, /subtitles/i);

  controls['#voiceLanguage'].value = 'ja';
  controls['#voiceLanguage'].dispatchEvent(new Event('change'));
  await Promise.resolve();
  assert.match(storage.values.get(DIALOGUE_VOICE_STORAGE_KEY), /"language":"ja"/);

  mounted.destroy();
  assert.equal(controls['#voiceToggle'].disabled, true);
});

test('committed voice manifest resolves canonical Campaign lines to existing OGG files', () => {
  const manifestPath = resolve(GAME_ROOT, 'assets/audio/voice-prototype-v1/manifest.json');
  assert.equal(existsSync(manifestPath), true);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const index = createVoiceManifestIndex(manifest);
  for (const lang of ['en', 'ja']) {
    const cue = matchManifestDialogueLine(index, {
      speaker: 'KUROZANE',
      text: 'You have cracked my Bell and mistaken damage for mortality. Dawn is an old clerk; it has declared me dead before.',
      language: lang,
    });
    assert.ok(cue, `Expected observatory opening line in ${lang}`);
    assert.equal(existsSync(resolve(GAME_ROOT, cue.file)), true, `Missing runtime audio ${cue.file}`);
  }
});
