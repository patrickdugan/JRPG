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
    label: 'Exploration score',
    scoreFamily: 'exploration',
    ambienceFamily: 'quiet-road',
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
    label: 'Battle score',
    scoreFamily: 'battle',
    ambienceFamily: 'arena',
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
    label: 'Boss score',
    scoreFamily: 'boss',
    ambienceFamily: 'arena',
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
  'rain-evidence': {
    id: 'rain-evidence',
    label: 'Rain and evidence score',
    scoreFamily: 'evidence',
    ambienceFamily: 'rain',
    bpm: 88,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.22,
    ambience: { gain: 0.075, cycles: [17, 31, 47], phases: [0.2, 1.1, 2.4] },
    voices: [
      { waveform: 'triangle', gain: 0.62, notes: [57, null, 60, 64, 55, null, 59, 62, 57, 60, null, 65, 55, 59, 62, null] },
      { waveform: 'sine', gain: 0.42, notes: [45, null, 45, null, 43, null, 43, null, 41, null, 41, null, 43, null, 40, null] },
    ],
  },
  'care-lantern': {
    id: 'care-lantern',
    label: 'Care and lantern score',
    scoreFamily: 'care',
    ambienceFamily: 'hearth',
    bpm: 82,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.21,
    ambience: { gain: 0.042, cycles: [3, 7, 19], phases: [0.5, 1.7, 2.8] },
    voices: [
      { waveform: 'sine', gain: 0.7, notes: [60, null, 64, null, 67, 65, 64, null, 59, null, 62, null, 65, 64, 62, null] },
      { waveform: 'triangle', gain: 0.38, notes: [48, null, 48, null, 45, null, 45, null, 43, null, 43, null, 45, null, 47, null] },
    ],
  },
  'road-water': {
    id: 'road-water',
    label: 'Road and water score',
    scoreFamily: 'road',
    ambienceFamily: 'water',
    bpm: 96,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.21,
    ambience: { gain: 0.06, cycles: [5, 11, 23], phases: [0.1, 1.4, 2.1] },
    voices: [
      { waveform: 'triangle', gain: 0.58, notes: [55, 59, 62, null, 57, 60, 64, null, 59, 62, 65, 64, 57, 60, 62, null] },
      { waveform: 'sine', gain: 0.4, notes: [43, null, 43, null, 45, null, 45, null, 47, null, 47, null, 45, null, 43, null] },
    ],
  },
  'court-cipher': {
    id: 'court-cipher',
    label: 'Court and cipher score',
    scoreFamily: 'cipher',
    ambienceFamily: 'interior',
    bpm: 104,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.2,
    ambience: { gain: 0.035, cycles: [2, 13, 37], phases: [0.9, 1.9, 2.6] },
    voices: [
      { waveform: 'square', gain: 0.25, notes: [60, null, 61, null, 67, 66, null, 61, 60, null, 63, null, 68, 67, 61, null] },
      { waveform: 'triangle', gain: 0.56, notes: [40, 40, null, 43, 39, 39, null, 42, 40, null, 46, null, 43, 42, 39, null] },
    ],
  },
  'fog-tide': {
    id: 'fog-tide',
    label: 'Fog and tide score',
    scoreFamily: 'tide',
    ambienceFamily: 'coast',
    bpm: 76,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.2,
    ambience: { gain: 0.08, cycles: [4, 9, 21], phases: [0.3, 1.5, 2.9] },
    voices: [
      { waveform: 'sine', gain: 0.72, notes: [52, null, 57, null, 59, null, 55, null, 50, null, 55, null, 57, 55, 52, null] },
      { waveform: 'triangle', gain: 0.34, notes: [38, null, 38, null, 41, null, 41, null, 36, null, 36, null, 38, null, 40, null] },
    ],
  },
  'forge-ash': {
    id: 'forge-ash',
    label: 'Forge and ash score',
    scoreFamily: 'forge',
    ambienceFamily: 'forge',
    bpm: 118,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.2,
    ambience: { gain: 0.055, cycles: [7, 18, 41], phases: [0.4, 1.2, 2.2] },
    voices: [
      { waveform: 'square', gain: 0.28, notes: [57, 57, null, 60, 55, 55, 61, null, 57, null, 62, 60, 55, 58, 57, null] },
      { waveform: 'sawtooth', gain: 0.24, notes: [33, null, 33, 36, 31, null, 31, 35, 33, 33, null, 38, 36, null, 31, null] },
    ],
  },
  'lantern-network': {
    id: 'lantern-network',
    label: 'Lantern network score',
    scoreFamily: 'network',
    ambienceFamily: 'night-road',
    bpm: 110,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.21,
    ambience: { gain: 0.04, cycles: [6, 15, 33], phases: [0.2, 1.8, 2.7] },
    voices: [
      { waveform: 'triangle', gain: 0.62, notes: [60, 64, 67, null, 62, 65, 69, null, 64, 67, 71, 69, 62, 65, 67, null] },
      { waveform: 'sine', gain: 0.36, notes: [43, null, 47, null, 45, null, 48, null, 47, null, 50, null, 45, null, 43, null] },
    ],
  },
  'black-court': {
    id: 'black-court',
    label: 'Black Court score',
    scoreFamily: 'black-court',
    ambienceFamily: 'bell-hall',
    bpm: 132,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.19,
    ambience: { gain: 0.045, cycles: [1, 12, 35], phases: [0.7, 1.3, 2.5] },
    voices: [
      { waveform: 'sawtooth', gain: 0.25, notes: [52, 53, 59, null, 52, 55, 60, 59, 51, 52, 58, null, 47, 46, 52, null] },
      { waveform: 'square', gain: 0.22, notes: [35, 35, 36, null, 35, 38, 34, null, 35, 35, 41, 40, 34, 33, 35, null] },
      { waveform: 'sine', gain: 0.42, notes: [28, null, 29, null, 28, null, 31, null, 27, null, 28, null, 23, null, 22, null] },
    ],
  },
  'repair-dawn': {
    id: 'repair-dawn',
    label: 'Repair and dawn score',
    scoreFamily: 'repair',
    ambienceFamily: 'dawn',
    bpm: 84,
    beatsPerBar: 4,
    stepsPerBeat: 2,
    bars: 2,
    gain: 0.22,
    ambience: { gain: 0.035, cycles: [3, 10, 26], phases: [0.15, 1.6, 2.3] },
    voices: [
      { waveform: 'sine', gain: 0.68, notes: [57, 60, 64, null, 59, 62, 65, null, 60, 64, 67, 65, 59, 62, 64, null] },
      { waveform: 'triangle', gain: 0.36, notes: [45, null, 48, null, 47, null, 50, null, 48, null, 52, null, 47, null, 45, null] },
    ],
  },
});

/** Campaign family changes use this bounded presentation fade after unlock. */
export const DEFAULT_AUDIO_CROSSFADE_SECONDS = 0.24;

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

const FULL_CYCLE = Math.PI * 2;

function compileVoiceState(voice, sampleRate) {
  return {
    waveform: voice.waveform,
    gain: voice.gain,
    notes: voice.notes,
    activeNote: undefined,
    phase: 0,
    phaseStep: 0,
    sine: 0,
    cosine: 1,
    sineStep: 0,
    cosineStep: 1,
    sampleRate,
  };
}

function selectVoiceNote(voice, note) {
  if (voice.activeNote === note) return;
  voice.activeNote = note;
  if (note === null) return;
  const phaseStep = midiToHz(note) / voice.sampleRate;
  voice.phaseStep = phaseStep;
  if (voice.waveform === 'sine') {
    const radians = FULL_CYCLE * phaseStep;
    voice.sineStep = Math.sin(radians);
    voice.cosineStep = Math.cos(radians);
  }
}

function advanceVoice(voice) {
  if (voice.waveform === 'sine') {
    const sine = voice.sine * voice.cosineStep + voice.cosine * voice.sineStep;
    voice.cosine = voice.cosine * voice.cosineStep - voice.sine * voice.sineStep;
    voice.sine = sine;
    return sine;
  }

  voice.phase += voice.phaseStep;
  voice.phase -= Math.floor(voice.phase);
  if (voice.waveform === 'square') return voice.phase < 0.5 ? 1 : -1;
  if (voice.waveform === 'sawtooth') return 2 * (voice.phase - Math.floor(voice.phase + 0.5));
  return 2 * Math.abs(2 * (voice.phase - Math.floor(voice.phase + 0.5))) - 1;
}

function compileAmbienceStates(ambience, frameCount) {
  if (!ambience) return [];
  return ambience.cycles.map((cycles, index) => {
    const phase = ambience.phases[index];
    const step = FULL_CYCLE * cycles / frameCount;
    return {
      sine: Math.sin(phase),
      cosine: Math.cos(phase),
      sineStep: Math.sin(step),
      cosineStep: Math.cos(step),
    };
  });
}

function advancePeriodicState(state) {
  const sine = state.sine * state.cosineStep + state.cosine * state.sineStep;
  state.cosine = state.cosine * state.cosineStep - state.sine * state.sineStep;
  state.sine = sine;
}

/** Build one exactly repeating, deterministic mono buffer from a loop definition. */
export function synthesizeLoopBuffer(context, definition) {
  const stepSeconds = 60 / definition.bpm / definition.stepsPerBeat;
  const duration = definition.bars * definition.beatsPerBar * 60 / definition.bpm;
  const frameCount = Math.max(1, Math.round(context.sampleRate * duration));
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const output = buffer.getChannelData(0);
  const samplesPerStep = context.sampleRate * stepSeconds;
  const voices = definition.voices.map((voice) => compileVoiceState(voice, context.sampleRate));
  const ambienceStates = compileAmbienceStates(definition.ambience, frameCount);
  const ambienceDivisor = ambienceStates.length || 1;
  const ambienceGain = definition.ambience?.gain ?? 0;
  const voiceDivisor = voices.length;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const stepPosition = frame / samplesPerStep;
    const step = Math.floor(stepPosition);
    const stepPhase = stepPosition - step;
    const envelope = Math.min(1, stepPhase / 0.045, (1 - stepPhase) / 0.12);
    let sample = 0;

    for (const voice of voices) {
      const note = voice.notes[step % voice.notes.length];
      selectVoiceNote(voice, note);
      if (note !== null) sample += advanceVoice(voice) * voice.gain * Math.max(0, envelope);
    }
    if (ambienceStates.length) {
      let texture = 0;
      for (const state of ambienceStates) {
        texture += state.sine;
        advancePeriodicState(state);
      }
      sample += texture / ambienceDivisor * ambienceGain;
    }
    output[frame] = Math.max(-1, Math.min(1, sample / voiceDivisor));
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
  const retiringLoops = new Set();
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

  function disconnectLoop(loop) {
    loop.source.onended = null;
    loop.source.disconnect?.();
    loop.gain.disconnect?.();
    retiringLoops.delete(loop);
  }

  function stopLoopNode(loop, at = undefined) {
    try {
      if (at === undefined) loop.source.stop();
      else loop.source.stop(at);
    } catch { /* A naturally ended source needs no further stop. */ }
  }

  function stopLoop() {
    const loops = [...retiringLoops];
    if (activeLoop) loops.push(activeLoop);
    if (!loops.length) return false;
    activeLoop = null;
    for (const loop of loops) {
      stopLoopNode(loop);
      disconnectLoop(loop);
    }
    return true;
  }

  function loopBuffer(name, definition) {
    let buffer = loopBuffers.get(name);
    if (!buffer) {
      buffer = synthesizeLoopBuffer(context, definition);
      loopBuffers.set(name, buffer);
    }
    return buffer;
  }

  function startLoopNode(name, definition, initialGain = definition.gain) {
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = loopBuffer(name, definition);
    source.loop = true;
    gain.gain.setValueAtTime?.(initialGain, context.currentTime);
    if (typeof gain.gain.setValueAtTime !== 'function') gain.gain.value = initialGain;
    source.connect(gain);
    gain.connect(master);
    source.start(context.currentTime);
    return { name, definition, source, gain };
  }

  function playLoop(name) {
    const definition = AUDIO_LOOP_DEFINITIONS[name];
    if (!definition) throw new RangeError(`Unknown audio loop: ${name}`);
    if (!usable() || context.state !== 'running') return false;
    if (activeLoop?.name === name) return true;
    stopLoop();
    activeLoop = startLoopNode(name, definition);
    return true;
  }

  /** Crossfade to another synthesized family without bypassing gesture unlock. */
  function transitionLoop(name, { fadeSeconds = DEFAULT_AUDIO_CROSSFADE_SECONDS } = {}) {
    const definition = AUDIO_LOOP_DEFINITIONS[name];
    if (!definition) throw new RangeError(`Unknown audio loop: ${name}`);
    if (!Number.isFinite(fadeSeconds) || fadeSeconds < 0 || fadeSeconds > 2) {
      throw new RangeError('Audio crossfade must be between 0 and 2 seconds.');
    }
    if (!usable() || context.state !== 'running') return false;
    if (!activeLoop || fadeSeconds === 0) return playLoop(name);
    if (activeLoop.name === name) return true;

    const now = context.currentTime;
    const end = now + fadeSeconds;
    const previous = activeLoop;
    const next = startLoopNode(name, definition, 0);
    next.gain.gain.linearRampToValueAtTime?.(definition.gain, end);
    if (typeof next.gain.gain.linearRampToValueAtTime !== 'function') next.gain.gain.value = definition.gain;
    const previousGain = Number.isFinite(previous.gain.gain.value)
      ? previous.gain.gain.value
      : previous.definition.gain;
    previous.gain.gain.cancelScheduledValues?.(now);
    previous.gain.gain.setValueAtTime?.(previousGain, now);
    previous.gain.gain.linearRampToValueAtTime?.(0, end);
    if (typeof previous.gain.gain.linearRampToValueAtTime !== 'function') previous.gain.gain.value = 0;
    retiringLoops.add(previous);
    previous.source.onended = () => disconnectLoop(previous);
    stopLoopNode(previous, end);
    activeLoop = next;
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
    transitionLoop,
    stopLoop,
    playCue,
    setMuted,
    toggleMuted,
    setMasterVolume,
    getState,
    destroy,
  });
}
