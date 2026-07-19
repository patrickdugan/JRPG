/**
 * Autoplay-safe, asset-free Web Audio for the browser game.
 *
 * Creating a runtime never creates an AudioContext. Call unlock() directly from
 * a pointer, keyboard, or other trusted user-gesture handler before playback.
 */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const AUDIO_LOOP_DEFINITIONS = deepFreeze({
  exploration: {
    id: 'exploration',
    bpm: 92,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.24,
    voices: [
      {
        waveform: 'triangle',
        gain: 0.72,
        notes: [57, 60, 64, 60, 55, 59, 62, 59, 57, 60, 65, 64, 55, 59, 62, null],
      },
      {
        waveform: 'sine',
        gain: 0.52,
        notes: [45, null, 45, null, 43, null, 43, null, 41, null, 41, null, 43, null, 40, null],
      },
    ],
  },
  battle: {
    id: 'battle',
    bpm: 126,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.22,
    voices: [
      {
        waveform: 'square',
        gain: 0.42,
        notes: [64, 67, 69, 71, 69, 67, 64, 62, 64, 67, 72, 71, 69, 67, 66, 62],
      },
      {
        waveform: 'triangle',
        gain: 0.66,
        notes: [40, 40, 43, 40, 45, 45, 43, 38, 40, 40, 43, 45, 47, 45, 43, 38],
      },
    ],
  },
  boss: {
    id: 'boss',
    bpm: 148,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.2,
    voices: [
      {
        waveform: 'sawtooth',
        gain: 0.34,
        notes: [52, 53, 59, 58, 52, 53, 61, 59, 52, 55, 60, 59, 53, 52, 47, 46],
      },
      {
        waveform: 'square',
        gain: 0.34,
        notes: [40, 40, 41, 35, 40, 40, 43, 35, 40, 40, 41, 35, 37, 36, 35, 34],
      },
      {
        waveform: 'sine',
        gain: 0.46,
        notes: [28, null, 29, null, 28, null, 31, null, 28, null, 29, null, 25, null, 23, null],
      },
    ],
  },
});

export const AUDIO_CUE_DEFINITIONS = deepFreeze({
  uiConfirm: {
    group: 'ui',
    gain: 0.2,
    segments: [{ at: 0, duration: 0.07, fromHz: 520, toHz: 760, waveform: 'sine' }],
  },
  uiCancel: {
    group: 'ui',
    gain: 0.18,
    segments: [{ at: 0, duration: 0.09, fromHz: 420, toHz: 240, waveform: 'triangle' }],
  },
  fieldStep: {
    group: 'field',
    gain: 0.08,
    segments: [{ at: 0, duration: 0.035, fromHz: 105, toHz: 82, waveform: 'sine' }],
  },
  fieldInteract: {
    group: 'field',
    gain: 0.16,
    segments: [
      { at: 0, duration: 0.06, fromHz: 330, toHz: 440, waveform: 'triangle' },
      { at: 0.055, duration: 0.09, fromHz: 440, toHz: 660, waveform: 'triangle' },
    ],
  },
  combatHit: {
    group: 'combat',
    gain: 0.22,
    segments: [{ at: 0, duration: 0.08, fromHz: 150, toHz: 62, waveform: 'sawtooth' }],
  },
  combatCritical: {
    group: 'combat',
    gain: 0.24,
    segments: [
      { at: 0, duration: 0.07, fromHz: 220, toHz: 72, waveform: 'square' },
      { at: 0.045, duration: 0.13, fromHz: 880, toHz: 1320, waveform: 'triangle' },
    ],
  },
  combatHeal: {
    group: 'combat',
    gain: 0.17,
    segments: [
      { at: 0, duration: 0.12, fromHz: 440, toHz: 660, waveform: 'sine' },
      { at: 0.09, duration: 0.16, fromHz: 660, toHz: 990, waveform: 'sine' },
    ],
  },
  combatGuard: {
    group: 'combat',
    gain: 0.15,
    segments: [{ at: 0, duration: 0.12, fromHz: 196, toHz: 147, waveform: 'triangle' }],
  },
  combatDefeat: {
    group: 'combat',
    gain: 0.2,
    segments: [
      { at: 0, duration: 0.18, fromHz: 220, toHz: 110, waveform: 'sawtooth' },
      { at: 0.14, duration: 0.28, fromHz: 146, toHz: 55, waveform: 'triangle' },
    ],
  },
});

function browserAudioContextClass() {
  return globalThis.AudioContext ?? globalThis.webkitAudioContext ?? null;
}

function midiToHz(note) {
  return 440 * (2 ** ((note - 69) / 12));
}

function oscillatorSample(waveform, phase) {
  const cycle = phase / (Math.PI * 2);
  if (waveform === 'square') return Math.sin(phase) >= 0 ? 1 : -1;
  if (waveform === 'sawtooth') return 2 * (cycle - Math.floor(cycle + 0.5));
  if (waveform === 'triangle') return 2 * Math.abs(2 * (cycle - Math.floor(cycle + 0.5))) - 1;
  return Math.sin(phase);
}

/** Build one exactly repeating, deterministic mono buffer from a loop definition. */
export function synthesizeLoopBuffer(context, definition) {
  const stepSeconds = 60 / definition.bpm / definition.stepsPerBeat;
  const duration = definition.bars * definition.beatsPerBar * 60 / definition.bpm;
  const frameCount = Math.max(1, Math.round(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const output = buffer.getChannelData(0);
  const phases = definition.voices.map(() => 0);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame / context.sampleRate;
    const step = Math.floor(time / stepSeconds);
    const stepPhase = (time % stepSeconds) / stepSeconds;
    const envelope = Math.min(1, stepPhase / 0.045, (1 - stepPhase) / 0.12);
    let sample = 0;

    definition.voices.forEach((voice, index) => {
      const note = voice.notes[step % voice.notes.length];
      if (note === null) return;
      phases[index] += Math.PI * 2 * midiToHz(note) / context.sampleRate;
      sample += oscillatorSample(voice.waveform, phases[index]) * voice.gain * Math.max(0, envelope);
    });
    output[frame] = Math.max(-1, Math.min(1, sample / definition.voices.length));
  }
  return buffer;
}

function clampVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError('Master volume must be a finite number.');
  return Math.max(0, Math.min(1, number));
}

/**
 * Create an isolated audio controller. It does not install listeners, touch
 * storage, use timers, fetch assets, or create an AudioContext until unlock().
 */
export function createAudioRuntime({
  AudioContextClass = browserAudioContextClass(),
  initialVolume = 0.7,
  initiallyMuted = false,
} = {}) {
  let context = null;
  let master = null;
  let unlockPromise = null;
  let destroyed = false;
  let muted = Boolean(initiallyMuted);
  let masterVolume = clampVolume(initialVolume);
  let activeLoop = null;
  const activeCueNodes = new Set();
  const loopBuffers = new Map();

  function usable() {
    return !destroyed && context !== null && master !== null && context.state !== 'closed';
  }

  function applyMasterVolume() {
    if (!usable()) return;
    const value = muted ? 0 : masterVolume;
    master.gain.cancelScheduledValues?.(context.currentTime);
    master.gain.setValueAtTime?.(value, context.currentTime);
    if (typeof master.gain.setValueAtTime !== 'function') master.gain.value = value;
  }

  async function unlock() {
    if (destroyed || typeof AudioContextClass !== 'function') return false;
    if (usable()) {
      if (context.state === 'suspended') await context.resume?.();
      return context.state !== 'closed';
    }
    if (unlockPromise) return unlockPromise;

    unlockPromise = (async () => {
      try {
        context = new AudioContextClass();
        master = context.createGain();
        master.connect(context.destination);
        applyMasterVolume();
        if (context.state === 'suspended') await context.resume?.();
        return context.state !== 'closed';
      } catch {
        try { await context?.close?.(); } catch { /* A failed context is already unusable. */ }
        context = null;
        master = null;
        return false;
      } finally {
        unlockPromise = null;
      }
    })();
    return unlockPromise;
  }

  function stopLoop() {
    if (!activeLoop) return false;
    const { source, gain } = activeLoop;
    activeLoop = null;
    try { source.stop(); } catch { /* A naturally ended source needs no further stop. */ }
    source.disconnect?.();
    gain.disconnect?.();
    return true;
  }

  function playLoop(name) {
    const definition = AUDIO_LOOP_DEFINITIONS[name];
    if (!definition) throw new RangeError(`Unknown audio loop: ${name}`);
    if (!usable() || context.state !== 'running') return false;
    if (activeLoop?.name === name) return true;
    stopLoop();

    let buffer = loopBuffers.get(name);
    if (!buffer) {
      buffer = synthesizeLoopBuffer(context, definition);
      loopBuffers.set(name, buffer);
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime?.(definition.gain, context.currentTime);
    if (typeof gain.gain.setValueAtTime !== 'function') gain.gain.value = definition.gain;
    source.connect(gain);
    gain.connect(master);
    source.start(context.currentTime);
    activeLoop = { name, source, gain };
    return true;
  }

  function playCue(name) {
    const definition = AUDIO_CUE_DEFINITIONS[name];
    if (!definition) throw new RangeError(`Unknown audio cue: ${name}`);
    if (!usable() || context.state !== 'running') return false;

    for (const segment of definition.segments) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + segment.at;
      const end = start + segment.duration;
      oscillator.type = segment.waveform;
      oscillator.frequency.setValueAtTime(segment.fromHz, start);
      oscillator.frequency.linearRampToValueAtTime(segment.toHz, end);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(definition.gain, start + Math.min(0.012, segment.duration / 3));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(gain);
      gain.connect(master);
      const node = { oscillator, gain };
      activeCueNodes.add(node);
      oscillator.onended = () => {
        oscillator.disconnect?.();
        gain.disconnect?.();
        activeCueNodes.delete(node);
      };
      oscillator.start(start);
      oscillator.stop(end);
    }
    return true;
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    applyMasterVolume();
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  function setMasterVolume(value) {
    masterVolume = clampVolume(value);
    applyMasterVolume();
    return masterVolume;
  }

  function getState() {
    return Object.freeze({
      available: typeof AudioContextClass === 'function',
      unlocked: usable(),
      running: usable() && context.state === 'running',
      muted,
      masterVolume,
      loop: activeLoop?.name ?? null,
      destroyed,
    });
  }

  async function destroy() {
    if (destroyed) return;
    destroyed = true;
    stopLoop();
    for (const { oscillator, gain } of activeCueNodes) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* An ended cue is already clean. */ }
      oscillator.disconnect?.();
      gain.disconnect?.();
    }
    activeCueNodes.clear();
    loopBuffers.clear();
    master?.disconnect?.();
    try { await context?.close?.(); } catch { /* Cleanup remains best-effort. */ }
    context = null;
    master = null;
  }

  return Object.freeze({
    unlock,
    playLoop,
    stopLoop,
    playCue,
    setMuted,
    toggleMuted,
    setMasterVolume,
    getState,
    destroy,
  });
}
