import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUDIO_PREFERENCE_KEY,
  DEFAULT_AUDIO_PREFERENCES,
  loadAudioPreferences,
  mountAudioControls,
  saveAudioPreferences,
} from '../audio-controls.mjs';

class FakeControl extends EventTarget {
  constructor(value = '') {
    super();
    this.value = value;
    this.textContent = '';
    this.disabled = false;
    this.attributes = new Map();
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
}

function controlsRoot() {
  const controls = {
    '#audioToggle': new FakeControl(),
    '#audioVolume': new FakeControl('0.7'),
    '#audioStatus': new FakeControl(),
  };
  return { controls, root: { querySelector: (selector) => controls[selector] ?? null } };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
}

function fakeRuntimeFactory(log) {
  return ({ initialVolume, initiallyMuted }) => {
    const state = {
      available: true,
      unlocked: false,
      running: false,
      muted: initiallyMuted,
      masterVolume: initialVolume,
      loop: null,
      destroyed: false,
    };
    Object.defineProperty(log, 'state', { value: state, configurable: true });
    return {
      async unlock() { log.push('unlock'); state.unlocked = true; state.running = true; return true; },
      playLoop(name) { log.push(`loop:${name}`); state.loop = name; return state.unlocked; },
      transitionLoop(name) { log.push(`transition:${name}`); state.loop = name; return state.unlocked; },
      playCue(name) { log.push(`cue:${name}`); return state.unlocked; },
      setMuted(value) { state.muted = Boolean(value); return state.muted; },
      toggleMuted() { state.muted = !state.muted; return state.muted; },
      setMasterVolume(value) { state.masterVolume = Number(value); return state.masterVolume; },
      getState() { return Object.freeze({ ...state }); },
      async destroy() { state.destroyed = true; state.unlocked = false; state.running = false; log.push('destroy'); },
    };
  };
}

test('audio preferences validate strictly and denied storage falls back safely', () => {
  assert.deepEqual(loadAudioPreferences(memoryStorage()), DEFAULT_AUDIO_PREFERENCES);
  const storage = memoryStorage();
  assert.equal(saveAudioPreferences(storage, { schemaVersion: 1, muted: false, masterVolume: 0.45 }), true);
  assert.deepEqual(loadAudioPreferences(storage), { schemaVersion: 1, muted: false, masterVolume: 0.45 });
  assert.equal(saveAudioPreferences(storage, { schemaVersion: 1, muted: false, masterVolume: 2 }), false);
  assert.deepEqual(loadAudioPreferences({ getItem() { throw new Error('denied'); } }), DEFAULT_AUDIO_PREFERENCES);
});

test('mount stays silent until the visible toggle unlocks and starts the desired loop', async () => {
  const log = [];
  const { controls, root } = controlsRoot();
  const storage = memoryStorage();
  const audio = mountAudioControls({ root, storage, desiredLoop: 'battle', runtimeFactory: fakeRuntimeFactory(log) });
  assert.deepEqual(log, []);
  assert.equal(controls['#audioToggle'].textContent, 'Sound: Off');
  assert.equal(await audio.handleToggle(), true);
  assert.deepEqual(log, ['unlock', 'loop:battle']);
  assert.equal(controls['#audioToggle'].attributes.get('aria-pressed'), 'true');
  assert.match(storage.values.get(AUDIO_PREFERENCE_KEY), /"muted":false/);
  assert.equal(audio.playCue('combatHit'), true);
  audio.setLoop('boss');
  assert.deepEqual(log.slice(-2), ['cue:combatHit', 'transition:boss']);
  log.state.running = false;
  assert.equal(await audio.handleToggle(), true);
  assert.deepEqual(log.slice(-2), ['unlock', 'loop:boss']);
  await audio.destroy();
  assert.equal(log.at(-1), 'destroy');
});

test('volume changes persist without unlocking and invalid desired loops fail early', () => {
  const log = [];
  const { controls, root } = controlsRoot();
  const storage = memoryStorage();
  mountAudioControls({ root, storage, runtimeFactory: fakeRuntimeFactory(log) });
  controls['#audioVolume'].value = '0.35';
  controls['#audioVolume'].dispatchEvent(new Event('input'));
  assert.deepEqual(log, []);
  assert.match(storage.values.get(AUDIO_PREFERENCE_KEY), /"masterVolume":0.35/);
  assert.throws(() => mountAudioControls({ root, desiredLoop: 'missing' }), /Unknown desired audio loop/);
});
