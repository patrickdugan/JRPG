import { createAudioRuntime, AUDIO_LOOP_DEFINITIONS } from './audio-runtime.mjs';
import { getDefaultBrowserStorage } from './browser-storage.mjs';

export const AUDIO_PREFERENCE_KEY = 'bells-black-chrysanthemum.audio.v1';
export const DEFAULT_AUDIO_PREFERENCES = Object.freeze({
  schemaVersion: 1,
  muted: true,
  masterVolume: 0.7,
});

function validPreferences(value) {
  return value
    && value.schemaVersion === 1
    && typeof value.muted === 'boolean'
    && Number.isFinite(value.masterVolume)
    && value.masterVolume >= 0
    && value.masterVolume <= 1;
}

export function loadAudioPreferences(storage = getDefaultBrowserStorage()) {
  try {
    const parsed = JSON.parse(storage.getItem(AUDIO_PREFERENCE_KEY));
    return validPreferences(parsed) ? Object.freeze({ ...parsed }) : DEFAULT_AUDIO_PREFERENCES;
  } catch {
    return DEFAULT_AUDIO_PREFERENCES;
  }
}

export function saveAudioPreferences(storage, preferences) {
  if (!validPreferences(preferences)) return false;
  try {
    storage.setItem(AUDIO_PREFERENCE_KEY, JSON.stringify(preferences));
    return true;
  } catch {
    return false;
  }
}

function loopLabel(loop) {
  return AUDIO_LOOP_DEFINITIONS[loop]?.label ?? 'Game score';
}

/**
 * Bind one page's static sound controls to the shared Web Audio runtime.
 * No AudioContext is created until the visible toggle is activated.
 */
export function mountAudioControls({
  root = document,
  storage = getDefaultBrowserStorage(),
  desiredLoop = 'exploration',
  runtimeFactory = createAudioRuntime,
} = {}) {
  if (!AUDIO_LOOP_DEFINITIONS[desiredLoop]) throw new RangeError(`Unknown desired audio loop: ${desiredLoop}`);
  const toggle = root.querySelector('#audioToggle');
  const volume = root.querySelector('#audioVolume');
  const status = root.querySelector('#audioStatus');
  if (!toggle || !volume || !status) throw new Error('Audio controls require #audioToggle, #audioVolume, and #audioStatus.');

  const preferences = loadAudioPreferences(storage);
  const runtime = runtimeFactory({
    initialVolume: preferences.masterVolume,
    initiallyMuted: preferences.muted,
  });
  let loop = desiredLoop;
  let busy = false;
  let destroyed = false;

  function persist() {
    const state = runtime.getState();
    saveAudioPreferences(storage, {
      schemaVersion: 1,
      muted: state.muted,
      masterVolume: state.masterVolume,
    });
  }

  function render() {
    const state = runtime.getState();
    volume.value = String(state.masterVolume);
    volume.setAttribute('aria-valuetext', `${Math.round(state.masterVolume * 100)} percent`);
    toggle.disabled = busy || !state.available || state.destroyed;
    toggle.setAttribute('aria-pressed', String(state.running && !state.muted));
    if (!state.available) {
      toggle.textContent = 'Sound unavailable';
      status.textContent = 'This browser cannot start Web Audio.';
    } else if (!state.unlocked) {
      toggle.textContent = 'Sound: Off';
      status.textContent = `${loopLabel(loop)} ready; activation requires this button.`;
    } else if (!state.running) {
      toggle.textContent = 'Sound: Paused';
      status.textContent = 'Sound was paused by the browser; activate this button to resume.';
    } else if (state.muted) {
      toggle.textContent = 'Sound: Off';
      status.textContent = 'Sound muted.';
    } else {
      toggle.textContent = 'Sound: On';
      status.textContent = `${loopLabel(loop)} playing at ${Math.round(state.masterVolume * 100)}%.`;
    }
  }

  async function handleToggle() {
    if (busy || destroyed) return false;
    busy = true;
    render();
    try {
      let state = runtime.getState();
      if (!state.unlocked || !state.running) {
        const unlocked = await runtime.unlock();
        if (!unlocked) return false;
        runtime.setMuted(false);
        runtime.playLoop(loop);
      } else {
        const muted = runtime.toggleMuted();
        if (!muted) runtime.playLoop(loop);
      }
      persist();
      return true;
    } finally {
      busy = false;
      render();
    }
  }

  function handleVolume() {
    if (destroyed) return;
    runtime.setMasterVolume(Number(volume.value));
    persist();
    render();
  }

  function setLoop(nextLoop) {
    if (!AUDIO_LOOP_DEFINITIONS[nextLoop]) throw new RangeError(`Unknown desired audio loop: ${nextLoop}`);
    loop = nextLoop;
    const state = runtime.getState();
    if (state.running && !state.muted) {
      if (typeof runtime.transitionLoop === 'function') runtime.transitionLoop(loop);
      else runtime.playLoop(loop);
    }
    render();
    return loop;
  }

  function playCue(name) {
    return destroyed ? false : runtime.playCue(name);
  }

  async function destroy() {
    if (destroyed) return;
    destroyed = true;
    toggle.removeEventListener('click', handleToggle);
    volume.removeEventListener('input', handleVolume);
    await runtime.destroy();
    render();
  }

  toggle.addEventListener('click', handleToggle);
  volume.addEventListener('input', handleVolume);
  render();

  return Object.freeze({ handleToggle, setLoop, playCue, getState: runtime.getState, destroy });
}
