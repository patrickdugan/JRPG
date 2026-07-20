import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import {
  AUDIO_CUE_DEFINITIONS,
  DEFAULT_AUDIO_CROSSFADE_SECONDS,
  AUDIO_LOOP_DEFINITIONS,
  createAudioRuntime,
  synthesizeLoopBuffer,
} from '../audio-runtime.mjs';

class FakeParam {
  value = 0;
  events = [];

  setValueAtTime(value, time) {
    this.value = value;
    this.events.push(['set', value, time]);
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(['linear', value, time]);
  }

  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(['exponential', value, time]);
  }

  cancelScheduledValues(time) {
    this.events.push(['cancel', time]);
  }
}

class FakeNode {
  connections = [];
  disconnected = false;

  connect(node) {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.disconnected = true;
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeSource extends FakeNode {
  buffer = null;
  loop = false;
  starts = [];
  stops = [];

  start(time) { this.starts.push(time); }
  stop(time) { this.stops.push(time); }
}

class FakeOscillator extends FakeNode {
  frequency = new FakeParam();
  type = 'sine';
  starts = [];
  stops = [];
  onended = null;

  start(time) { this.starts.push(time); }
  stop(time) { this.stops.push(time); }
}

class FakeBuffer {
  constructor(frameCount) {
    this.channels = [new Float32Array(frameCount)];
  }

  getChannelData(channel) {
    return this.channels[channel];
  }
}

class FakeAudioContext {
  static instances = [];

  state = 'suspended';
  currentTime = 12;
  sampleRate = 8000;
  destination = new FakeNode();
  gains = [];
  sources = [];
  oscillators = [];
  buffers = [];
  resumeCalls = 0;
  closeCalls = 0;

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createBuffer(channels, frames) {
    assert.equal(channels, 1);
    const buffer = new FakeBuffer(frames);
    this.buffers.push(buffer);
    return buffer;
  }

  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  async resume() {
    this.resumeCalls += 1;
    this.state = 'running';
  }

  async close() {
    this.closeCalls += 1;
    this.state = 'closed';
  }
}

function resetFakeContexts() {
  FakeAudioContext.instances.length = 0;
}

test('public loop and cue definitions are deeply immutable and cover each context', () => {
  assert.deepEqual(Object.keys(AUDIO_LOOP_DEFINITIONS), [
    'exploration', 'battle', 'boss',
    'rain-evidence', 'care-lantern', 'road-water', 'court-cipher', 'fog-tide',
    'forge-ash', 'lantern-network', 'black-court', 'repair-dawn',
  ]);
  assert.notDeepEqual(AUDIO_LOOP_DEFINITIONS.exploration, AUDIO_LOOP_DEFINITIONS.battle);
  assert.notDeepEqual(AUDIO_LOOP_DEFINITIONS.battle, AUDIO_LOOP_DEFINITIONS.boss);
  assert.ok(Object.isFrozen(AUDIO_LOOP_DEFINITIONS));
  assert.ok(Object.isFrozen(AUDIO_LOOP_DEFINITIONS.exploration.voices[0].notes));
  assert.ok(Object.isFrozen(AUDIO_LOOP_DEFINITIONS['rain-evidence'].ambience.cycles));
  assert.ok(Object.values(AUDIO_LOOP_DEFINITIONS).every((loop) => loop.id && loop.label
    && loop.scoreFamily && loop.ambienceFamily));
  assert.deepEqual(new Set(Object.values(AUDIO_CUE_DEFINITIONS).map((cue) => cue.group)), new Set(['ui', 'field', 'combat']));
  assert.ok(Object.isFrozen(AUDIO_CUE_DEFINITIONS.combatCritical.segments[0]));
  assert.throws(() => { AUDIO_LOOP_DEFINITIONS.boss.bpm = 1; }, TypeError);
});

test('runtime creates no context or sound before explicit gesture unlock', async () => {
  resetFakeContexts();
  const audio = createAudioRuntime({ AudioContextClass: FakeAudioContext });
  assert.equal(FakeAudioContext.instances.length, 0);
  assert.equal(audio.playLoop('exploration'), false);
  assert.equal(audio.playCue('uiConfirm'), false);
  assert.equal(FakeAudioContext.instances.length, 0);

  assert.equal(await audio.unlock(), true);
  const context = FakeAudioContext.instances[0];
  assert.equal(FakeAudioContext.instances.length, 1);
  assert.equal(context.resumeCalls, 1);
  assert.equal(context.state, 'running');
  assert.equal(audio.getState().running, true);
  context.state = 'suspended';
  assert.equal(audio.getState().running, false);
  assert.equal((await audio.unlock()), true);
  assert.equal(context.resumeCalls, 2);
  assert.equal(audio.getState().running, true);
  assert.equal(FakeAudioContext.instances.length, 1);
});

test('deterministic synthesis repeats exactly and distinct loop scores differ', () => {
  const contextA = new FakeAudioContext();
  const contextB = new FakeAudioContext();
  const first = synthesizeLoopBuffer(contextA, AUDIO_LOOP_DEFINITIONS.exploration).getChannelData(0);
  const second = synthesizeLoopBuffer(contextB, AUDIO_LOOP_DEFINITIONS.exploration).getChannelData(0);
  const battle = synthesizeLoopBuffer(contextB, AUDIO_LOOP_DEFINITIONS.battle).getChannelData(0);
  assert.deepEqual(first, second);
  assert.notEqual(first.length, battle.length);
  assert.ok(first.some((sample) => sample !== 0));
  assert.ok(first.every((sample) => sample >= -1 && sample <= 1));
});

test('every synthesized family is a complete deterministic bar loop with a quiet seam', () => {
  for (const definition of Object.values(AUDIO_LOOP_DEFINITIONS)) {
    const contextA = new FakeAudioContext();
    const contextB = new FakeAudioContext();
    const first = synthesizeLoopBuffer(contextA, definition).getChannelData(0);
    const second = synthesizeLoopBuffer(contextB, definition).getChannelData(0);
    const expectedFrames = Math.round(
      contextA.sampleRate * definition.bars * definition.beatsPerBar * 60 / definition.bpm,
    );
    const expectedSteps = definition.bars * definition.beatsPerBar * definition.stepsPerBeat;
    assert.equal(first.length, expectedFrames, `${definition.id} frame seam`);
    assert.ok(definition.voices.every((voice) => voice.notes.length === expectedSteps), `${definition.id} bar coverage`);
    assert.deepEqual(first, second, `${definition.id} deterministic synthesis`);
    assert.ok(Math.abs(first[0] - first.at(-1)) < 0.001, `${definition.id} audible loop seam`);
  }
});

test('all campaign families synthesize at 48 kHz without per-frame trigonometry or a first-use stall', () => {
  const context = new FakeAudioContext();
  context.sampleRate = 48_000;
  const campaignFamilyIds = [
    'rain-evidence', 'care-lantern', 'road-water', 'court-cipher', 'fog-tide',
    'forge-ash', 'lantern-network', 'black-court', 'repair-dawn',
  ];
  const originalSin = Math.sin;
  const originalCos = Math.cos;
  let sineCalls = 0;
  let cosineCalls = 0;
  Math.sin = (...args) => { sineCalls += 1; return originalSin(...args); };
  Math.cos = (...args) => { cosineCalls += 1; return originalCos(...args); };

  const startedAt = performance.now();
  let buffers;
  try {
    buffers = campaignFamilyIds.map((id) => synthesizeLoopBuffer(context, AUDIO_LOOP_DEFINITIONS[id]));
  } finally {
    Math.sin = originalSin;
    Math.cos = originalCos;
  }
  const elapsedMs = performance.now() - startedAt;

  assert.equal(buffers.length, campaignFamilyIds.length);
  assert.ok(buffers.every((buffer) => buffer.getChannelData(0).length > 170_000));
  assert.ok(sineCalls < 400, `campaign synthesis made ${sineCalls} sine calls`);
  assert.ok(cosineCalls < 400, `campaign synthesis made ${cosineCalls} cosine calls`);
  assert.ok(elapsedMs < 1_500, `48 kHz campaign synthesis took ${elapsedMs.toFixed(1)}ms`);
});

test('music loops are cached, switched, and stopped through synthesized buffer sources', async () => {
  resetFakeContexts();
  const audio = createAudioRuntime({ AudioContextClass: FakeAudioContext });
  await audio.unlock();
  const context = FakeAudioContext.instances[0];

  assert.equal(audio.playLoop('exploration'), true);
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].loop, true);
  assert.equal(context.sources[0].starts[0], context.currentTime);
  assert.equal(audio.getState().loop, 'exploration');
  assert.equal(audio.playLoop('exploration'), true);
  assert.equal(context.sources.length, 1);

  assert.equal(audio.playLoop('battle'), true);
  assert.equal(context.sources[0].stops.length, 1);
  assert.equal(context.sources[0].disconnected, true);
  assert.equal(context.sources.length, 2);
  assert.equal(context.buffers.length, 2);
  assert.equal(audio.stopLoop(), true);
  assert.equal(audio.stopLoop(), false);
  assert.equal(audio.getState().loop, null);
  assert.throws(() => audio.playLoop('missing'), /Unknown audio loop/);
});

test('active loop families crossfade on one bounded seam without creating a new context', async () => {
  resetFakeContexts();
  const audio = createAudioRuntime({ AudioContextClass: FakeAudioContext });
  await audio.unlock();
  const context = FakeAudioContext.instances[0];
  audio.playLoop('rain-evidence');
  const firstSource = context.sources[0];
  const firstGain = context.gains[1].gain;

  assert.equal(audio.transitionLoop('care-lantern'), true);
  assert.equal(FakeAudioContext.instances.length, 1);
  assert.equal(context.sources.length, 2);
  assert.equal(audio.getState().loop, 'care-lantern');
  assert.deepEqual(firstSource.stops, [context.currentTime + DEFAULT_AUDIO_CROSSFADE_SECONDS]);
  assert.ok(firstGain.events.some((event) => event[0] === 'linear' && event[1] === 0
    && event[2] === context.currentTime + DEFAULT_AUDIO_CROSSFADE_SECONDS));
  const nextGain = context.gains[2].gain;
  assert.deepEqual(nextGain.events[0], ['set', 0, context.currentTime]);
  assert.ok(nextGain.events.some((event) => event[0] === 'linear'
    && event[1] === AUDIO_LOOP_DEFINITIONS['care-lantern'].gain));
  assert.equal(firstSource.disconnected, false, 'retiring score remains connected during its fade');
  firstSource.onended();
  assert.equal(firstSource.disconnected, true);
  assert.equal(audio.transitionLoop('care-lantern'), true);
  assert.equal(context.sources.length, 2, 'same-family render is a no-op');
  assert.throws(() => audio.transitionLoop('missing'), /Unknown audio loop/);
  assert.throws(() => audio.transitionLoop('repair-dawn', { fadeSeconds: 3 }), /between 0 and 2/);
});

test('reusable cue definitions schedule envelopes and clean their nodes on end', async () => {
  resetFakeContexts();
  const audio = createAudioRuntime({ AudioContextClass: FakeAudioContext });
  await audio.unlock();
  const context = FakeAudioContext.instances[0];

  for (const cue of ['uiCancel', 'fieldInteract', 'combatCritical', 'combatHeal']) {
    assert.equal(audio.playCue(cue), true);
  }
  const expectedSegments = ['uiCancel', 'fieldInteract', 'combatCritical', 'combatHeal']
    .reduce((sum, cue) => sum + AUDIO_CUE_DEFINITIONS[cue].segments.length, 0);
  assert.equal(context.oscillators.length, expectedSegments);
  assert.ok(context.oscillators.every((oscillator) => oscillator.starts.length === 1 && oscillator.stops.length === 1));
  assert.ok(context.oscillators.every((oscillator) => oscillator.frequency.events.some(([kind]) => kind === 'linear')));
  context.oscillators[0].onended();
  assert.equal(context.oscillators[0].disconnected, true);
  assert.throws(() => audio.playCue('missing'), /Unknown audio cue/);
});

test('mute and clamped master volume work before and after unlock', async () => {
  resetFakeContexts();
  const audio = createAudioRuntime({
    AudioContextClass: FakeAudioContext,
    initialVolume: 0.4,
    initiallyMuted: true,
  });
  assert.equal(audio.setMasterVolume(2), 1);
  assert.equal(audio.getState().masterVolume, 1);
  await audio.unlock();
  const masterGain = FakeAudioContext.instances[0].gains[0].gain;
  assert.equal(masterGain.value, 0);
  assert.equal(audio.toggleMuted(), false);
  assert.equal(masterGain.value, 1);
  assert.equal(audio.setMasterVolume(-10), 0);
  assert.equal(masterGain.value, 0);
  assert.throws(() => audio.setMasterVolume(Number.NaN), /finite number/);
  assert.ok(Object.isFrozen(audio.getState()));
});

test('missing or failing AudioContext degrades to safe no-op behavior', async () => {
  const unavailable = createAudioRuntime({ AudioContextClass: null });
  assert.equal(unavailable.getState().available, false);
  assert.equal(await unavailable.unlock(), false);
  assert.equal(unavailable.playLoop('boss'), false);
  assert.equal(unavailable.playCue('combatHit'), false);

  class FailingAudioContext {
    constructor() { throw new Error('audio denied'); }
  }
  const failing = createAudioRuntime({ AudioContextClass: FailingAudioContext });
  assert.equal(await failing.unlock(), false);
  assert.equal(failing.getState().unlocked, false);
});

test('destroy stops sources, disconnects nodes, closes context, and is idempotent', async () => {
  resetFakeContexts();
  const audio = createAudioRuntime({ AudioContextClass: FakeAudioContext });
  await audio.unlock();
  const context = FakeAudioContext.instances[0];
  audio.playLoop('boss');
  audio.playCue('combatDefeat');
  await audio.destroy();

  assert.equal(context.sources[0].stops.length, 1);
  assert.ok(context.oscillators.every((oscillator) => oscillator.stops.length === 2));
  assert.ok(context.oscillators.every((oscillator) => oscillator.disconnected));
  assert.equal(context.closeCalls, 1);
  assert.deepEqual(audio.getState(), {
    available: true,
    unlocked: false,
    running: false,
    muted: false,
    masterVolume: 0.7,
    loop: null,
    destroyed: true,
  });
  assert.equal(audio.playLoop('exploration'), false);
  assert.equal(await audio.unlock(), false);
  await audio.destroy();
  assert.equal(context.closeCalls, 1);
});
