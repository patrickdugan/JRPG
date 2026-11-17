import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  PARTY_EXTENDED_CHARACTERS,
  PARTY_EXTENDED_CLIPS,
  PARTY_EXTENDED_GEOMETRY,
  READY_SNAP_MS,
  TIRED_SCALED_MAX_MS,
  resolveCooldownPose,
  samplePartyExtended,
  samplePartyExtendedPhase,
  samplePartyTired,
} from '../party-extended-animation.mjs';

const suite = new URL('../../assets/art/party-animation-suite-v2/', import.meta.url);
const runtime = new URL('../assets/art/party-animation-suite-v2/', import.meta.url);

test('metadata matches the suite manifest and atlas dimensions', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', suite), 'utf8'));
  assert.deepEqual(PARTY_EXTENDED_CHARACTERS, manifest.characters.map(({ id }) => id));
  assert.deepEqual(
    PARTY_EXTENDED_CLIPS.map(({ id, frames }) => [id, frames]),
    manifest.clips.map(({ id, frames }) => [id, frames]),
  );
  for (const key of ['frameWidth', 'frameHeight', 'columns', 'rows', 'width', 'height']) {
    assert.equal(PARTY_EXTENDED_GEOMETRY[key], manifest.geometry[key], key);
  }
  const a = await readFile(new URL('party-animation-atlas-v2.png', suite));
  const b = await readFile(new URL('party-animation-atlas-v2.png', runtime));
  assert.equal(a.readUInt32BE(16), PARTY_EXTENDED_GEOMETRY.width);
  assert.equal(a.readUInt32BE(20), PARTY_EXTENDED_GEOMETRY.height);
  assert.ok(a.equals(b), 'runtime copy is byte-identical to the suite atlas');
});

test('every upgraded clip has at least 20 unique frames (hashed) for every character', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', suite), 'utf8'));
  for (const id of PARTY_EXTENDED_CHARACTERS) {
    for (const clip of PARTY_EXTENDED_CLIPS) {
      const hashes = manifest.frames
        .filter((frame) => frame.id.startsWith(`${id}:${clip.id}:`))
        .map((frame) => frame.rgbaSha256);
      assert.equal(hashes.length, clip.frames, `${id}:${clip.id} frame records`);
      const need = clip.id === 'ready-snap' ? 6 : 20;
      assert.ok(new Set(hashes).size >= need, `${id}:${clip.id} has ${new Set(hashes).size} unique frames`);
    }
    const tired = manifest.frames.filter((frame) => frame.id.startsWith(`${id}:tired:`));
    assert.ok(tired.length >= 20 && tired.length <= 30, `${id} tired loop is 20-30 frames`);
  }
});

test('time sampling loops and rectangles address the character-major atlas', () => {
  const first = samplePartyExtended('ren', 'idle', 0);
  assert.deepEqual(first.rect, [0, 0, 48, 64]);
  assert.equal(samplePartyExtended('ren', 'idle', 24 * 90).localFrame, 0);
  assert.equal(samplePartyExtended('ren', 'idle', 90 * 5 + 1).localFrame, 5);
  const miyo = samplePartyExtended('miyo', 'defeat', 99999);
  assert.equal(miyo.localFrame, 19);
  assert.equal(miyo.rect[1], (6 * 10 + 9) * 64);
  assert.throws(() => samplePartyExtended('nobody', 'idle', 0), RangeError);
  assert.throws(() => samplePartyExtended('ren', 'nope', 0), RangeError);
});

test('banded strikes keep wind-up, active and recovery frames inside their bands', () => {
  for (const clipId of ['basic-strike', 'signature-a', 'signature-b']) {
    const bands = PARTY_EXTENDED_CLIPS.find(({ id }) => id === clipId).bands;
    for (const [phase, [start, end]] of Object.entries(bands)) {
      for (const progress of [0, 0.25, 0.5, 0.99, 1]) {
        const { localFrame } = samplePartyExtendedPhase('aya', clipId, phase, progress);
        assert.ok(localFrame >= start && localFrame <= end, `${clipId}:${phase}@${progress}`);
      }
    }
  }
  assert.equal(samplePartyExtendedPhase('ren', 'basic-strike', 'active', 0).event, 'damage');
});

test('tired clip ends on its straighten band exactly when the cooldown completes', () => {
  for (const total of [300, 420, 640, TIRED_SCALED_MAX_MS, 1600, 4000]) {
    assert.equal(samplePartyTired('genta', total, total).localFrame, 0, `start ${total}`);
    const last = samplePartyTired('genta', 1, total);
    assert.equal(last.band, 'straighten', `end band ${total}`);
    assert.ok(last.localFrame >= 21, `end frame ${total}: ${last.localFrame}`);
    let previous = -1;
    for (let remaining = total; remaining >= 0; remaining -= 10) {
      const { localFrame, band } = samplePartyTired('genta', remaining, total);
      if (total <= TIRED_SCALED_MAX_MS) assert.ok(localFrame >= previous, 'scaled clip never rewinds');
      assert.ok(['slump-in', 'heavy-breath', 'straighten'].includes(band));
      previous = localFrame;
    }
  }
  const seen = new Set();
  for (let t = 0; t < 400; t += 1) seen.add(samplePartyTired('kiku', 400 - t, 400).localFrame);
  assert.equal(seen.size, 24, 'a 400 ms cooldown walks all 24 tired frames');
});

test('cooldown pose policy: tired only when free, snap after completion, nothing during commitment', () => {
  const base = { sharedRemainingMs: 300, sharedTotalMs: 400, nowMs: 1000 };
  assert.equal(resolveCooldownPose({ ...base, free: true }).clipId, 'tired');
  assert.equal(resolveCooldownPose({ ...base, free: false }).clipId, null);
  const done = { free: true, sharedRemainingMs: 0, sharedTotalMs: 400, completedAtMs: 1000 };
  assert.equal(resolveCooldownPose({ ...done, nowMs: 1100 }).clipId, 'ready-snap');
  assert.equal(resolveCooldownPose({ ...done, nowMs: 1000 + READY_SNAP_MS }).clipId, null);
  assert.equal(resolveCooldownPose({ ...done, nowMs: 1100, reducedMotion: true }).clipId, null);
  assert.equal(resolveCooldownPose({ free: true, sharedRemainingMs: 0, sharedTotalMs: 0, nowMs: 1 }).clipId, null);
});
