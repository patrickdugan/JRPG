import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANIMATION_CLIP_SCHEMA,
  AnimationManifestError,
  animationDrawPlacement,
  animationSheetMatches,
  createAnimationSheetLoader,
  prepareAnimationManifest,
  sampleAttackPhase,
  sampleClipAtProgress,
  sampleClipAtTime,
  validateAnimationManifest,
} from '../animation-clip-runtime.mjs';

/** A synthetic manifest: frames laid out left to right on one 4096-wide sheet. */
function makeManifest({ uniqueLoop = 24, attack = [12, 4, 10], sheetWidth = 4096, sheetHeight = 64 } = {}) {
  let cursor = 0;
  const frame = (index, extra = {}) => {
    const x = (cursor % 64) * 64;
    const y = Math.floor(cursor / 64) * 64;
    cursor += 1;
    return { sheet: 0, rect: [x, y % sheetHeight, 60, 60], pivot: [30, 58], durationMs: 40, hash: `h${index}`, ...extra };
  };
  const loopFrames = Array.from({ length: 24 }, (_, i) => frame(i % uniqueLoop));
  const bands = [];
  const attackFrames = [];
  let start = 0;
  ['windup', 'active', 'recovery'].forEach((name, bandIndex) => {
    const count = attack[bandIndex];
    for (let i = 0; i < count; i += 1) {
      const weight = name === 'windup' && i === count - 1 ? 80 : 40; // a held peak tell
      attackFrames.push(frame(100 + start + i, { band: name, durationMs: weight,
        ...(name === 'active' && i === 1 ? { events: ['hit'] } : {}) }));
    }
    bands.push({ name, start, count, key: name === 'active' ? start + 1 : start + count - 1 });
    start += count;
  });
  const progressFrames = Array.from({ length: 22 }, (_, i) => frame(200 + i));
  return {
    schema: ANIMATION_CLIP_SCHEMA,
    characterId: 'demo',
    nativeFacing: 'right',
    logicalFrame: [120, 100],
    footPoint: [60, 92],
    sheets: [{ path: 'demo.png', width: sheetWidth, height: sheetHeight }],
    clips: [
      { id: 'idle', kind: 'loop', loop: true, frameCount: 24, keyFrames: [0], frames: loopFrames },
      { id: 'strike', kind: 'attack', loop: false, frameCount: attackFrames.length, keyFrames: [11, 13, 25], bands, frames: attackFrames },
      { id: 'stagger', kind: 'progress', loop: false, frameCount: 22, keyFrames: [1, 12], frames: progressFrames },
    ],
  };
}

test('valid manifests prepare, and every rule failure is reported', () => {
  const manifest = makeManifest();
  assert.deepEqual(validateAnimationManifest(manifest), { ok: true, errors: [] });
  const prepared = prepareAnimationManifest(manifest);
  assert.equal(prepared.characterId, 'demo');
  assert.equal(Object.isFrozen(prepared.manifest.clips[0].frames[0]), true);

  const fewUnique = validateAnimationManifest(makeManifest({ uniqueLoop: 19 }));
  assert.equal(fewUnique.ok, false);
  assert.match(fewUnique.errors.join('\n'), /idle: 19 unique frames; the standard is 20-30/u);

  const tooWide = validateAnimationManifest(makeManifest({ sheetWidth: 4097 }));
  assert.match(tooWide.errors.join('\n'), /4097px wide; the limit is 4096px/u);

  const outside = makeManifest();
  outside.clips[0].frames[3].rect = [4090, 0, 60, 60];
  assert.match(validateAnimationManifest(outside).errors.join('\n'), /idle\[3\]: rect lies outside sheet 0/u);

  const bandGap = makeManifest();
  bandGap.clips[1].bands[1].start = 13;
  assert.match(validateAnimationManifest(bandGap).errors.join('\n'), /band active is not contiguous/u);

  const mistagged = makeManifest();
  mistagged.clips[1].frames[12].band = 'windup';
  assert.match(validateAnimationManifest(mistagged).errors.join('\n'), /strike\[12\]: band tag is not active/u);

  assert.match(validateAnimationManifest(makeManifest(), { expectedCharacterId: 'other' }).errors.join(), /does not match other/u);
  assert.match(validateAnimationManifest(makeManifest(), { requiredClips: ['defeat'] }).errors.join(), /required clip defeat/u);
  assert.throws(() => prepareAnimationManifest(makeManifest({ uniqueLoop: 3 })), AnimationManifestError);
  assert.equal(validateAnimationManifest(null).ok, false);
});

test('time sampling loops, holds one-shots, and freezes loops under reduced motion', () => {
  const prepared = prepareAnimationManifest(makeManifest());
  assert.equal(sampleClipAtTime(prepared, 'idle', 0).index, 0);
  assert.equal(sampleClipAtTime(prepared, 'idle', 41).index, 1);
  const wrapped = sampleClipAtTime(prepared, 'idle', 24 * 40 + 85);
  assert.equal(wrapped.index, 2);
  assert.equal(wrapped.cycle, 1);
  assert.equal(sampleClipAtTime(prepared, 'idle', 500, { reducedMotion: true }).index, 0);
  const done = sampleClipAtTime(prepared, 'stagger', 10_000);
  assert.equal(done.index, 21);
  assert.equal(done.complete, true);
  assert.throws(() => sampleClipAtTime(prepared, 'missing', 0), RangeError);
});

test('progress sampling covers the clip once and steps through key frames under reduced motion', () => {
  const prepared = prepareAnimationManifest(makeManifest());
  assert.equal(sampleClipAtProgress(prepared, 'stagger', 0).index, 0);
  assert.equal(sampleClipAtProgress(prepared, 'stagger', 0.5).index, 11);
  assert.equal(sampleClipAtProgress(prepared, 'stagger', 1).index, 21);
  assert.equal(sampleClipAtProgress(prepared, 'stagger', 7).index, 21);
  assert.equal(sampleClipAtProgress(prepared, 'stagger', Number.NaN).index, 0);
  const seen = new Set();
  for (let p = 0; p <= 1; p += 0.01) seen.add(sampleClipAtProgress(prepared, 'stagger', p, { reducedMotion: true }).index);
  assert.deepEqual([...seen], [1, 12]);
});

test('attack bands are sampled by phase progress so the strike frame always meets the hitbox frame', () => {
  const prepared = prepareAnimationManifest(makeManifest());
  const indices = (phase) => {
    const out = [];
    for (let i = 0; i <= 200; i += 1) out.push(sampleAttackPhase(prepared, 'strike', phase, i / 200).index);
    return out;
  };
  const windup = indices('windup');
  assert.equal(windup[0], 0);
  assert.equal(windup.at(-1), 11);
  assert.equal(new Set(windup).size, 12);
  assert.ok(windup.every((index, i) => i === 0 || index >= windup[i - 1]), 'wind-up only moves forward');
  // The held peak (double weight) occupies more of the wind-up than an ordinary frame.
  assert.ok(windup.filter((i) => i === 11).length > windup.filter((i) => i === 5).length * 1.6);
  assert.deepEqual([...new Set(indices('active'))], [12, 13, 14, 15]);
  assert.deepEqual([Math.min(...indices('recovery')), Math.max(...indices('recovery'))], [16, 25]);
  // Whatever the gameplay timing, the frame on screen when the kernel enters `active` is the band start.
  for (const activeMs of [60, 80, 100, 140, 400]) {
    for (let t = 0; t < activeMs; t += 10) {
      const sample = sampleAttackPhase(prepared, 'strike', 'active', t / activeMs);
      assert.equal(sample.band, 'active');
    }
    assert.equal(sampleAttackPhase(prepared, 'strike', 'active', 0).index, 12);
  }
  assert.equal(sampleAttackPhase(prepared, 'strike', 'windup', 0.3, { reducedMotion: true }).index, 11);
  assert.equal(sampleAttackPhase(prepared, 'strike', 'active', 0.9, { reducedMotion: true }).index, 13);
  assert.deepEqual(sampleAttackPhase(prepared, 'strike', 'active', 0.3).events, ['hit']);
  assert.throws(() => sampleAttackPhase(prepared, 'idle', 'windup', 0), RangeError);
});

test('draw placement anchors the pivot and flips against the native facing', () => {
  const prepared = prepareAnimationManifest(makeManifest());
  const sample = sampleClipAtTime(prepared, 'idle', 0);
  const right = animationDrawPlacement(prepared, sample, { anchorX: 300, anchorY: 400, scale: 2, facing: 1 });
  assert.equal(right.flip, false);
  assert.equal(right.ox, -60);
  assert.equal(right.oy, -116);
  assert.equal(right.dw, 120);
  assert.equal(animationDrawPlacement(prepared, sample, { facing: -1 }).flip, true);
  assert.throws(() => animationDrawPlacement(prepared, sample, { scale: 0 }), RangeError);
  assert.equal(animationSheetMatches({ naturalWidth: 4096, naturalHeight: 64 }, { width: 4096, height: 64 }), true);
  assert.equal(animationSheetMatches({ naturalWidth: 4095, naturalHeight: 64 }, { width: 4096, height: 64 }), false);
  assert.equal(animationSheetMatches(null, { width: 1, height: 1 }), false);
});

function fakeImageFactory(sizes, failing = new Set()) {
  const created = [];
  const factory = () => {
    const listeners = {};
    const image = {
      naturalWidth: 0,
      naturalHeight: 0,
      addEventListener(type, fn) { listeners[type] = fn; },
      set src(url) {
        created.push(url);
        queueMicrotask(() => {
          if (failing.has(url)) return listeners.error?.();
          const [w, h] = sizes[url] ?? [0, 0];
          image.naturalWidth = w;
          image.naturalHeight = h;
          listeners.load?.();
        });
      },
    };
    return image;
  };
  factory.created = created;
  return factory;
}

test('the loader is lazy and per character, and every failure leaves get() empty for the fallback', async () => {
  const manifests = {
    './suite/demo.json': makeManifest(),
    './suite/thin.json': { ...makeManifest({ uniqueLoop: 10 }), characterId: 'thin' },
    './suite/shrunk.json': { ...makeManifest(), characterId: 'shrunk', sheets: [{ path: 'shrunk.png', width: 4096, height: 64 }] },
  };
  const fetched = [];
  const fetchJson = async (url) => {
    fetched.push(url);
    if (!manifests[url]) throw new Error('404');
    return structuredClone(manifests[url]);
  };
  const images = fakeImageFactory({ './suite/demo.png': [4096, 64] });
  const changes = [];
  const loader = createAnimationSheetLoader({
    resolveManifestUrl: (id) => (id === 'unmapped' ? null : `./suite/${id}.json`),
    fetchJson,
    createImage: images,
    onChange: (id, state) => changes.push(`${id}:${state}`),
  });
  assert.equal(loader.state('demo'), 'unrequested');
  assert.deepEqual(fetched, [], 'nothing loads before a request');

  const first = loader.request('demo');
  assert.equal(loader.state('demo'), 'loading');
  assert.equal(loader.get('demo'), null);
  assert.equal(loader.request('demo'), first, 'concurrent requests share one load');
  const entry = await first;
  assert.equal(entry.state, 'ready');
  assert.equal(loader.get('demo').prepared.characterId, 'demo');
  assert.deepEqual(images.created, ['./suite/demo.png']);
  assert.deepEqual(fetched, ['./suite/demo.json']);

  assert.equal((await loader.request('missing')).state, 'unavailable');
  assert.equal((await loader.request('unmapped')).state, 'unavailable');
  assert.equal((await loader.request('thin')).state, 'invalid');
  assert.equal((await loader.request('shrunk')).state, 'wrong-size', 'a sheet decoding to another size is rejected');

  const wrongSize = createAnimationSheetLoader({
    resolveManifestUrl: (id) => `./suite/${id}.json`,
    fetchJson,
    createImage: fakeImageFactory({ './suite/demo.png': [4096, 63] }),
  });
  const wrong = await wrongSize.request('demo');
  assert.equal(wrong.state, 'wrong-size');
  assert.match(wrong.error, /4096x63, expected 4096x64/u);
  assert.equal(wrongSize.get('demo'), null);

  const broken = createAnimationSheetLoader({
    resolveManifestUrl: (id) => `./suite/${id}.json`,
    fetchJson,
    createImage: fakeImageFactory({}, new Set(['./suite/demo.png'])),
  });
  assert.equal((await broken.request('demo')).state, 'unavailable');
  assert.ok(changes.includes('demo:loading') && changes.includes('demo:ready'));
  assert.deepEqual(loader.states(), { demo: 'ready', missing: 'unavailable', unmapped: 'unavailable', thin: 'invalid', shrunk: 'wrong-size' });
  assert.throws(() => createAnimationSheetLoader({}), TypeError);
});
