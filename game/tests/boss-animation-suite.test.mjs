import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import {
  ANIMATION_UNIQUE_FRAME_STANDARD,
  prepareAnimationManifest,
  sampleAttackPhase,
  validateAnimationManifest,
} from '../animation-clip-runtime.mjs';
import {
  BOSS_ANIMATION_SUITE,
  bossAttackClipId,
  hasBossAnimationClips,
  selectBossAnimationClip,
} from '../boss-animation-clips.mjs';
import { BOSS_COMBAT_BOSSES, hasBossCombatTemplate } from '../boss-combat-atlas.mjs';
import {
  createActionCampaignBattleSession,
  parseActionCampaignBattleQuery,
} from '../action-campaign-battle-model.mjs';

const gameRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(gameRoot, '..');
const suiteDir = join(repoRoot, 'assets', 'art', 'boss-animation-suite-v2');
const kurozaneDir = join(repoRoot, 'assets', 'art', 'kurozane-boss-clips-v2');
const runtimeDir = join(gameRoot, 'assets', 'art', 'boss-animation-suite-v2');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const suite = JSON.parse(readFileSync(join(suiteDir, 'manifest.json'), 'utf8'));
const source = JSON.parse(readFileSync(join(suiteDir, 'boss-animation-suite-v2.source.json'), 'utf8'));
const kurozaneBuild = JSON.parse(readFileSync(join(kurozaneDir, 'manifest.json'), 'utf8'));
const kurozaneSource = JSON.parse(readFileSync(join(kurozaneDir, 'kurozane-boss-clips-v2.source.json'), 'utf8'));
const manifestFor = (id) => JSON.parse(readFileSync(join(runtimeDir, `${id}.json`), 'utf8'));
const productionDirFor = (id) => (id === 'kurozane' ? kurozaneDir : suiteDir);
const CODE_BOSSES = BOSS_ANIMATION_SUITE.bosses.filter((id) => id !== 'kurozane');

/** Minimal PNG decoder for the suite's own sheets: 8-bit RGBA, non-interlaced. */
function decodeRgbaPng(bytes) {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.deepEqual([data[8], data[9], data[12]], [8, 6, 0], 'sheets are 8-bit RGBA, non-interlaced');
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x += 1) {
      const a = x >= 4 ? out[x - 4] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= 4 ? prev[x - 4] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[x] = value & 0xff;
    }
  }
  return { width, height, pixels };
}

/** Translation-invariant identity of one frame: alpha-trimmed RGBA, exactly as anim_sheet.content_hash. */
function frameContentHash(image, [rx, ry, rw, rh]) {
  let left = rw;
  let top = rh;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < rh; y += 1) {
    for (let x = 0; x < rw; x += 1) {
      if (image.pixels[((ry + y) * image.width + rx + x) * 4 + 3]) {
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  assert.ok(right >= 0, 'frame is not empty');
  const w = right - left + 1;
  const h = bottom - top + 1;
  const body = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    const start = ((ry + top + y) * image.width + rx + left) * 4;
    image.pixels.copy(body, y * w * 4, start, start + w * 4);
  }
  return sha256(Buffer.concat([Buffer.from(`${w}x${h}:`, 'ascii'), body])).slice(0, 16);
}

test('the v2 clips cover exactly the ten canonical bosses in the static atlas order', () => {
  assert.deepEqual(BOSS_ANIMATION_SUITE.bosses, BOSS_COMBAT_BOSSES.map(({ id }) => id));
  assert.deepEqual(suite.bosses.map(({ id }) => id), CODE_BOSSES);
  assert.deepEqual(source.bosses.map(({ id }) => id), CODE_BOSSES);
  assert.deepEqual(suite.externalBosses.map(({ id }) => id), ['kurozane']);
  assert.equal(suite.externalBosses[0].lane, 'deterministically-pixelified (rig-posed)');
  for (const id of BOSS_ANIMATION_SUITE.bosses) {
    assert.equal(hasBossAnimationClips(id), true);
    assert.equal(hasBossCombatTemplate(id), true, `${id} keeps its static fallback row`);
  }
  assert.equal(hasBossAnimationClips('cinder-hound'), false);
  assert.equal(suite.provenanceLane, 'pixel-authored');
  assert.equal(suite.authorship, 'original-code-native-pixel-primitives');
  assert.deepEqual(suite.safety, {
    gore: false,
    realEmblems: false,
    devotionalProps: false,
    actorLikeness: false,
    construction: 'Invented mechanical, docket, cable, lattice, ash, and fog geometry only.',
  });
  for (const entry of suite.sources) assert.equal(sha256(readFileSync(join(suiteDir, entry.path))), entry.sha256, entry.path);
  for (const entry of suite.toolkit) assert.equal(sha256(readFileSync(join(repoRoot, entry.path))), entry.sha256, entry.path);
});

test('Kurozane is built from his approved pixelified kits and keeps their provenance', () => {
  const manifest = manifestFor('kurozane');
  assert.equal(manifest.provenance.lane, 'deterministically-pixelified (rig-posed)');
  assert.equal(manifest.provenance.notPixelAuthored, true);
  assert.equal(kurozaneBuild.provenance.lane, manifest.provenance.lane);
  const kits = new Set(manifest.provenance.sources.map(({ path }) => path.split('/')[2]));
  assert.deepEqual([...kits].sort(), ['kurozane-final-battle-v1', 'kurozane-oni-attack-suite-v1']);
  for (const entry of manifest.provenance.sources) {
    assert.equal(sha256(readFileSync(join(repoRoot, entry.path))), entry.sha256, entry.path);
  }
  for (const kit of ['kurozane-final-battle-v1', 'kurozane-oni-attack-suite-v1']) {
    const kitManifest = JSON.parse(readFileSync(join(repoRoot, 'assets', 'art', kit, 'manifest.json'), 'utf8'));
    assert.equal(kitManifest.provenance.derivativeClassification, 'deterministically pixelified');
    assert.equal(kitManifest.provenance.notPixelAuthored, true);
  }
  const used = new Set(manifest.clips.flatMap((clip) => clip.notes.sourceKeys).map((key) => key.split(':')[0]));
  assert.deepEqual([...used].sort(), ['final', 'oni'], 'both kits supply keys');
  assert.deepEqual(manifest.phaseForms, { court: '', bell: 'demon', dawn: 'demon' });
  assert.deepEqual(manifest.attackClips, kurozaneSource.attackClips);
  for (const entry of kurozaneBuild.sources) assert.equal(sha256(readFileSync(join(kurozaneDir, entry.path))), entry.sha256, entry.path);
  for (const entry of kurozaneBuild.toolkit) assert.equal(sha256(readFileSync(join(repoRoot, entry.path))), entry.sha256, entry.path);
  assert.equal(manifest.nativeFacing, 'left');
});

test('builder --check rebuilds every sheet, manifest, runtime copy, and review file byte-for-byte', () => {
  const output = execFileSync('python', ['build_boss_animation_suite_v2.py', '--check', '--jobs', '4'], {
    cwd: suiteDir,
    encoding: 'utf8',
    timeout: 900_000,
  });
  for (const id of CODE_BOSSES) assert.match(output, new RegExp(`${id}: 6 file\\(s\\) byte-identical`, 'u'));
  assert.match(output, /suite manifest: 1 file\(s\) byte-identical/u);
  const kurozane = execFileSync('python', ['build_kurozane_boss_clips_v2.py', '--check'], {
    cwd: kurozaneDir,
    encoding: 'utf8',
    timeout: 900_000,
  });
  assert.match(kurozane, /kurozane: 7 file\(s\) byte-identical/u);
});

test('every boss manifest validates and its sheets have the exact manifested size', () => {
  for (const id of BOSS_ANIMATION_SUITE.bosses) {
    const runtimeJson = readFileSync(join(runtimeDir, `${id}.json`));
    assert.equal(runtimeJson.equals(readFileSync(join(productionDirFor(id), `${id}.json`))), true, `${id} runtime manifest copy`);
    const manifest = JSON.parse(runtimeJson);
    const result = validateAnimationManifest(manifest, { expectedCharacterId: id, requiredClips: BOSS_ANIMATION_SUITE.requiredClips });
    assert.deepEqual(result.errors, [], id);
    if (id !== 'kurozane') {
      assert.equal(manifest.nativeFacing, 'right');
      assert.equal(manifest.provenance.lane, 'pixel-authored');
      assert.equal(manifest.presentationPixelScale, BOSS_ANIMATION_SUITE.presentationPixelScale);
    }
    const summary = id === 'kurozane' ? kurozaneBuild : suite.bosses.find((boss) => boss.id === id);
    assert.deepEqual(summary.sheets, manifest.sheets);
    for (const sheet of manifest.sheets) {
      const bytes = readFileSync(join(runtimeDir, sheet.path));
      assert.equal(bytes.equals(readFileSync(join(productionDirFor(id), sheet.path))), true, `${id} runtime sheet copy`);
      assert.equal(sha256(bytes), sheet.sha256);
      assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [sheet.width, sheet.height]);
      assert.ok(sheet.width <= 4096, `${id} sheet width ${sheet.width}`);
    }
  }
});

test('frame-count standard: every boss clip has 20-30 unique frames, proven from the sheet pixels', () => {
  const [min, max] = ANIMATION_UNIQUE_FRAME_STANDARD;
  const counts = {};
  for (const id of BOSS_ANIMATION_SUITE.bosses) {
    const manifest = manifestFor(id);
    const sheets = manifest.sheets.map((sheet) => decodeRgbaPng(readFileSync(join(runtimeDir, sheet.path))));
    counts[id] = {};
    for (const clip of manifest.clips) {
      const hashes = clip.frames.map((frame) => frameContentHash(sheets[frame.sheet], frame.rect));
      hashes.forEach((hash, index) => assert.equal(hash, clip.frames[index].hash, `${id}:${clip.id}[${index}] pixels match manifest`));
      const unique = new Set(hashes).size;
      assert.ok(unique >= min && unique <= max, `${id}:${clip.id} has ${unique} unique frames`);
      counts[id][clip.id] = unique;
    }
    sheets.length = 0; // release one boss's decoded pixels before the next
  }
  for (const id of CODE_BOSSES) {
    assert.deepEqual(Object.keys(counts[id]), ['idle', 'locomotion', 'strike', 'signature', 'stagger', 'transition', 'defeat']);
  }
  assert.deepEqual(Object.keys(counts.kurozane), [
    'idle', 'locomotion', 'strike', 'signature', 'stagger', 'transition', 'defeat',
    'idle@demon', 'locomotion@demon', 'stagger@demon', 'eclipse', 'chrysanthemum', 'transition@dawn',
  ]);
});

function encounterAttackTimings(encounterId, bossId) {
  const session = createActionCampaignBattleSession(parseActionCampaignBattleQuery(`?encounter=${encounterId}`));
  const actor = session.spec.kernelConfig.actors.find((entry) => session.actorTemplates[entry.id] === bossId);
  assert.ok(actor, `${bossId} is in ${encounterId}`);
  return actor.attackIds.map((attackId) => ({ attackId, ...session.spec.kernelConfig.attacks[attackId] }));
}

test('phase-band alignment: every live boss attack lands its strike frame inside the active phase', () => {
  for (const id of BOSS_ANIMATION_SUITE.bosses) {
    const prepared = prepareAnimationManifest(manifestFor(id));
    const plan = source.bosses.find((boss) => boss.id === id);
    for (const clip of prepared.manifest.clips.filter(({ kind }) => kind === 'attack')) {
      const [windup, active, recovery] = clip.bands;
      const unique = new Set(clip.frames.map((frame) => frame.hash)).size;
      assert.ok(unique >= 20 && unique <= 30, `${id}:${clip.id} bands total ${unique}`);
      assert.deepEqual(clip.frames[windup.start].events, ['windupStart']);
      assert.deepEqual(clip.frames[windup.start + windup.count - 1].events, ['telegraphPeak']);
      assert.equal(windup.key, windup.start + windup.count - 1, 'reduced motion holds the peak tell');
      assert.deepEqual(clip.frames[active.start].events, ['activeStart']);
      assert.ok(clip.frames.slice(active.start, active.start + active.count).some((frame) => frame.events?.includes('hit')));
      assert.deepEqual(clip.frames[recovery.start].events, ['recoveryStart']);
    }
    for (const timing of encounterAttackTimings(prepared.manifest.encounterId, id)) {
      const clipId = bossAttackClipId(prepared.manifest, timing.attackId);
      assert.equal(prepared.clips.get(clipId)?.clip.kind, 'attack', `${timing.attackId} -> ${clipId}`);
      assert.ok(prepared.manifest.attackClips[timing.attackId], `${timing.attackId} is bound explicitly`);
      if (plan) {
        const expected = plan.signature.attacks.includes(timing.attackId.split(':').at(-1)) ? 'signature' : 'strike';
        assert.equal(clipId, expected, `${timing.attackId} -> ${clipId}`);
      }
      const total = timing.windupMs + timing.activeMs + timing.recoveryMs;
      for (let elapsed = 0; elapsed < total; elapsed += 5) {
        const phase = elapsed < timing.windupMs ? 'windup' : elapsed < timing.windupMs + timing.activeMs ? 'active' : 'recovery';
        const start = phase === 'windup' ? 0 : phase === 'active' ? timing.windupMs : timing.windupMs + timing.activeMs;
        const length = phase === 'windup' ? timing.windupMs : phase === 'active' ? timing.activeMs : timing.recoveryMs;
        const sample = sampleAttackPhase(prepared, clipId, phase, (elapsed - start) / length);
        assert.equal(sample.band, phase, `${timing.attackId} at ${elapsed} ms`);
        if (elapsed === timing.windupMs) assert.deepEqual(sample.events, ['activeStart']);
      }
      // Gameplay can retune any phase length; the band mapping is unchanged.
      for (const scale of [0.5, 1.7, 3]) {
        assert.equal(sampleAttackPhase(prepared, clipId, 'active', 0).band, 'active');
        assert.equal(sampleAttackPhase(prepared, clipId, 'windup', 1 - 1 / (timing.windupMs * scale)).band, 'windup');
      }
    }
  }
});

test('clip selection mirrors the static pose priority and drives stagger, phase, and defeat from their timers', () => {
  const manifest = manifestFor('ujiro');
  const base = { hp: 10, grounded: true, movementIntent: { x: 0 }, staggerRemainingMs: 0, activeAttack: null };
  assert.deepEqual(selectBossAnimationClip({ manifest, actor: base, timeMs: 5 }), { clipId: 'idle', mode: 'time', timeMs: 5, form: '' });
  assert.equal(selectBossAnimationClip({ manifest, actor: { ...base, movementIntent: { x: -1 } } }).clipId, 'locomotion');
  const command = selectBossAnimationClip({
    manifest,
    actor: { ...base, activeAttack: { attackId: 'enemy:ujiro:seizure-order', phase: 'windup' } },
    attackProgress: 0.4,
  });
  assert.deepEqual(command, { clipId: 'signature', mode: 'phase', phase: 'windup', progress: 0.4, form: '' });
  assert.equal(selectBossAnimationClip({
    manifest, actor: { ...base, activeAttack: { attackId: 'enemy:ujiro:gavel-line', phase: 'active' } },
  }).clipId, 'strike');
  const stagger = selectBossAnimationClip({
    manifest, actor: { ...base, staggerRemainingMs: 175, activeAttack: { attackId: 'enemy:ujiro:gavel-line', phase: 'windup' } },
    staggerTotalMs: 700,
  });
  assert.deepEqual(stagger, { clipId: 'stagger', mode: 'progress', progress: 0.75, form: '' });
  const transition = selectBossAnimationClip({
    manifest, actor: { ...base, staggerRemainingMs: 300 }, transitionElapsedMs: 70, transitionHoldMs: 280,
  });
  assert.deepEqual(transition, { clipId: 'transition', mode: 'progress', progress: 0.25, form: '' });
  assert.equal(selectBossAnimationClip({ manifest, actor: base, transitionElapsedMs: 280, transitionHoldMs: 280 }).clipId, 'idle');
  assert.deepEqual(
    selectBossAnimationClip({ manifest, actor: { ...base, hp: 0 }, defeatElapsedMs: 210, defeatHoldMs: 420, transitionElapsedMs: 0, transitionHoldMs: 280 }),
    { clipId: 'defeat', mode: 'progress', progress: 0.5, form: '' },
  );
  assert.equal(selectBossAnimationClip({ manifest, actor: { ...base, active: false } }).clipId, 'defeat');
  assert.equal(bossAttackClipId(manifestFor('yearless-bell'), 'enemy:yearless-bell:yearless-ring@r2'), 'strike');
  assert.equal(bossAttackClipId(manifestFor('yearless-bell'), 'enemy:yearless-bell:yearless-ring'), 'signature');
  assert.equal(bossAttackClipId(manifest, 'enemy:ujiro:unknown-future-art'), 'strike');

  // Kurozane's phases switch forms: the bell and dawn phases use the demon-form variants.
  const kurozane = manifestFor('kurozane');
  const pick = (actor, phaseId, extra = {}) => selectBossAnimationClip({ manifest: kurozane, actor, phaseId, ...extra });
  assert.equal(pick(base, 'court').clipId, 'idle');
  assert.equal(pick(base, 'bell').clipId, 'idle@demon');
  assert.equal(pick({ ...base, movementIntent: { x: 1 } }, 'dawn').clipId, 'locomotion@demon');
  assert.equal(pick({ ...base, staggerRemainingMs: 100 }, 'bell', { staggerTotalMs: 700 }).clipId, 'stagger@demon');
  assert.equal(pick(base, 'bell', { transitionElapsedMs: 10, transitionHoldMs: 280 }).clipId, 'transition');
  assert.equal(pick(base, 'dawn', { transitionElapsedMs: 10, transitionHoldMs: 280 }).clipId, 'transition@dawn');
  assert.equal(pick({ ...base, hp: 0 }, 'dawn').clipId, 'defeat');
  for (const [attack, clip] of [['court-command', 'signature'], ['yearless-thrust', 'strike'], ['blood-eclipse', 'eclipse'],
    ['black-chrysanthemum', 'chrysanthemum']]) {
    assert.equal(pick({ ...base, activeAttack: { attackId: `enemy:kurozane:${attack}`, phase: 'active' } }, 'bell').clipId, clip);
  }
});

test('the battle page keeps the exact static atlas path as the fallback and exposes art state', () => {
  const browser = readFileSync(join(gameRoot, 'action-campaign-battle.js'), 'utf8');
  const v1 = /if \(drawBossAnimation\(actor, template, nowMs\)\) return;[\s\S]*?const frame = getBossCombatFrame\(template, bossPose\(actor\)\);\s*const placement = getBossCombatDrawPlacement\(frame, \{\s*anchorX: actor\.position\.x,\s*groundY: actor\.position\.y,\s*drawHeight: frame\.height \* Math\.min\(1\.35, frame\.scale\),\s*\}\);\s*if \(!art\.boss\.ready\) return drawFallback\(actor, '#cb4652'\);/u;
  assert.match(browser, v1);
  assert.match(browser, /const entry = bossAnimationLoader\.get\(template\);\s*if \(!entry\) return false;/u);
  assert.match(browser, /for \(const key of \['party', 'partyAnimation',(?: 'partyExtended',)? 'enemy', 'enemyAnimation', 'boss',/u);
  assert.match(browser, /setCanvasDataset\('bossAnimArtState', state\)/u);
  assert.match(browser, /setCanvasDataset\('bossAnimSource', read\.source\)/u);
  assert.match(browser, /setCanvasDataset\('bossAnimClip', read\.clip\)/u);
  assert.match(browser, /setCanvasDataset\('bossAnimBand', read\.band\)/u);
  assert.match(browser, /source: art\.boss\.ready \? 'static-v1' : 'token'/u);
  assert.match(browser, /defeatHoldMs: BOSS_DEFEAT_HOLD_MS/u);
  assert.match(browser, /transitionHoldMs: BOSS_TRANSITION_HOLD_MS/u);
  assert.match(browser, /reducedMotion: reducedMotion\.matches/u);
  assert.match(browser, /bossAnimationLoader\.request\(bossTemplateId\)/u);
  assert.match(browser, /encounterBossAnimationTemplates\(\) \{\s*return \[\.\.\.new Set\(Object\.values\(session\.actorTemplates/u);
});
