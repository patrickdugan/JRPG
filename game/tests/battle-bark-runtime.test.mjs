import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  DEFAULT_BATTLE_BARK_ACTOR_COOLDOWN_MS,
  DEFAULT_BATTLE_BARK_GLOBAL_COOLDOWN_MS,
  DIALOGUE_VOICE_STORAGE_KEY,
  createBattleBarkIndex,
  createBattleBarkRuntime,
  lookupBattleBarkCue,
  mapCombatEventToBarkRequest,
  normalizeBattleBarkActorId,
} from '../battle-bark-runtime.mjs';
import { RECOVERY_CHECKPOINT_AUTHORITIES } from '../recovery-checkpoint.mjs';
import { getFullDialogueScene } from '../content/full-dialogue.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    keys: () => [...map.keys()],
  };
}

function createFakeAudioFactory() {
  const instances = [];
  const createAudio = (src) => {
    const listeners = new Map();
    const audio = {
      src,
      volume: 1,
      played: false,
      paused: false,
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(fn);
      },
      removeEventListener(type, fn) {
        listeners.get(type)?.delete(fn);
      },
      play() {
        audio.played = true;
        return Promise.resolve();
      },
      pause() {
        audio.paused = true;
      },
      emit(type) {
        for (const fn of [...(listeners.get(type) ?? [])]) fn();
      },
    };
    instances.push(audio);
    return audio;
  };
  return { instances, createAudio };
}

const SAMPLE_BARK_MANIFEST = Object.freeze({
  id: 'voice-prototype-v1:last-command',
  scenes: [
    { id: 'battle-barks', lineIds: ['bb-01', 'bb-02', 'bb-08', 'bb-11', 'bb-17', 'bb-23', 'bb-57', 'bb-59', 'bb-61', 'bb-63', 'bb-65', 'bb-66', 'bb-99'] },
  ],
  lines: {
    'bb-01': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-01-ren.ogg',
        speaker: 'ren',
        actorId: 'ren',
        barkType: 'attack',
        sceneId: 'battle-barks',
        text: 'Opening!',
      },
      ja: {
        file: './assets/audio/voice-prototype-v1/ja/bb-01-ren.ogg',
        speaker: 'ren',
        actorId: 'ren',
        barkType: 'attack',
        sceneId: 'battle-barks',
        text: '今だ！',
      },
    },
    'bb-02': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-02-ren.ogg',
        speaker: 'ren',
        actorId: 'ren',
        barkType: 'art',
        sceneId: 'battle-barks',
        text: 'Cinder Route—cut through!',
      },
    },
    'bb-08': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-08-ren.ogg',
        speaker: 'ren',
        actorId: 'ren',
        barkType: 'victory',
        sceneId: 'battle-barks',
        text: "Route's clear. Keep moving.",
      },
    },
    'bb-11': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-11-aya.ogg',
        speaker: 'aya',
        actorId: 'aya',
        barkType: 'heal',
        sceneId: 'battle-barks',
        text: 'Breathe—I have the ward.',
      },
    },
    'bb-17': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-17-nikola.ogg',
        speaker: 'nikola',
        actorId: 'lise',
        barkType: 'attack',
        sceneId: 'battle-barks',
        text: 'Observe the form!',
      },
    },
    'bb-23': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-23-nikola.ogg',
        speaker: 'nikola',
        actorId: 'lise',
        barkType: 'tag',
        sceneId: 'battle-barks',
        text: 'Step aside. My turn.',
      },
    },
    'bb-57': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-57-nikola.ogg',
        speaker: 'nikola',
        actorId: 'lise',
        barkType: 'duo',
        sceneId: 'battle-barks',
        text: 'Avelar—Black Sun Concord! Pin the shadow!',
      },
    },
    'bb-59': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-59-kurozane.ogg',
        speaker: 'kurozane',
        actorId: 'kurozane',
        barkType: 'boss-intro',
        sceneId: 'battle-barks',
        text: 'Step into the court, and show me what your small mercy weighs.',
      },
    },
    'bb-61': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-61-kurozane.ogg',
        speaker: 'kurozane',
        actorId: 'kurozane',
        barkType: 'boss-phase',
        phaseId: 'bell',
        sceneId: 'battle-barks',
        text: 'Enough courtesies. Let the Yearless Bell keep your time.',
      },
    },
    'bb-63': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-63-kurozane.ogg',
        speaker: 'kurozane',
        actorId: 'kurozane',
        barkType: 'boss-phase',
        phaseId: 'dawn',
        sceneId: 'battle-barks',
        text: 'Dawn breaks nothing that was forged in blood! Stand and be judged!',
      },
    },
    'bb-65': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-65-kurozane.ogg',
        speaker: 'kurozane',
        actorId: 'kurozane',
        barkType: 'stagger',
        sceneId: 'battle-barks',
        text: 'Impossible—the ward broke!',
      },
    },
    'bb-66': {
      en: {
        file: './assets/audio/voice-prototype-v1/en/bb-66-kurozane.ogg',
        speaker: 'kurozane',
        actorId: 'kurozane',
        barkType: 'boss-defeat',
        sceneId: 'battle-barks',
        text: 'The bell... has gone quiet.',
      },
    },
    // Unrendered entry (missing file) must be ignored cleanly.
    'bb-99': {
      en: {
        speaker: 'genta',
        actorId: 'genta',
        barkType: 'attack',
        sceneId: 'battle-barks',
        text: 'Clear the brace!',
      },
    },
  },
});

const SAMPLE_SNAPSHOT = Object.freeze({
  encounterId: 'c9-kurozane',
  bossPhase: { bossActorId: 'kurozane-1', phaseId: 'court' },
  kernel: {
    controlledActorId: 'ren',
    actors: [
      { id: 'ren', faction: 'player', name: 'Ren Ishikawa' },
      { id: 'aya', faction: 'player', name: 'Aya' },
      { id: 'lise', faction: 'player', name: 'Nikola Dražanić' },
      { id: 'mateus', faction: 'player', name: 'Father Mateus Avelar' },
      { id: 'kurozane-1', faction: 'enemy', name: 'Shogun Kurozane' },
      { id: 'court-clone-1', faction: 'enemy', name: 'Court Clone 1' },
    ],
  },
});

test('battle bark runtime defaults to OFF with zero fetches, zero Audio objects, and strict storage isolation', async () => {
  const canonicalKeys = new Set(RECOVERY_CHECKPOINT_AUTHORITIES.map((entry) => entry.storageKey));
  assert.equal(canonicalKeys.has(DIALOGUE_VOICE_STORAGE_KEY), false);

  const storage = createMemoryStorage();
  let fetchCount = 0;
  const { instances, createAudio } = createFakeAudioFactory();
  const runtime = createBattleBarkRuntime({
    storage,
    fetchImpl: async () => {
      fetchCount += 1;
      return { ok: true, json: async () => SAMPLE_BARK_MANIFEST };
    },
    createAudio,
  });

  assert.equal(runtime.getState().enabled, false);
  assert.equal(runtime.getState().statusKind, 'off');

  const playedIntro = await runtime.playEncounterIntro(SAMPLE_SNAPSHOT);
  const playedEvents = await runtime.handleCombatEvents([
    { type: 'combo-start', initiatorActorId: 'lise' },
    { type: 'attack-start', actorId: 'ren', attackId: 'party:ren:courier-cut' },
    { type: 'boss-phase-entered', bossActorId: 'kurozane-1', toPhaseId: 'bell' },
  ], SAMPLE_SNAPSHOT);

  assert.equal(playedIntro, false);
  assert.equal(playedEvents, false);
  assert.equal(fetchCount, 0);
  assert.equal(instances.length, 0);
  assert.deepEqual(storage.keys(), []);
});

test('actor normalization and bark index resolve party aliases, boss instance suffixes, and phase cues', () => {
  assert.equal(normalizeBattleBarkActorId('nikola'), 'lise');
  assert.equal(normalizeBattleBarkActorId('lise'), 'lise');
  assert.equal(normalizeBattleBarkActorId('kurozane-1'), 'kurozane');
  assert.equal(normalizeBattleBarkActorId('captain-kaji-1'), 'captain-kaji');
  assert.equal(normalizeBattleBarkActorId('bell-warden-chiyo-1'), 'bell-warden-chiyo');

  const index = createBattleBarkIndex(SAMPLE_BARK_MANIFEST);
  // bb-99 has no file so it must not be indexed.
  assert.equal(lookupBattleBarkCue(index, { actorId: 'genta', barkType: 'attack', language: 'en' }), null);

  const bellPhase = lookupBattleBarkCue(index, {
    actorId: 'kurozane-1',
    barkType: 'boss-phase',
    phaseId: 'bell',
    language: 'en',
  });
  const dawnPhase = lookupBattleBarkCue(index, {
    actorId: 'kurozane-1',
    barkType: 'boss-phase',
    phaseId: 'dawn',
    language: 'en',
  });
  assert.equal(bellPhase?.lineId, 'bb-61');
  assert.equal(dawnPhase?.lineId, 'bb-63');

  // Aya's subweapon event falls back cleanly to her heal bark.
  const ayaAid = lookupBattleBarkCue(index, {
    actorId: 'aya',
    barkType: 'subweapon',
    fallbackBarkType: 'heal',
    language: 'en',
  });
  assert.equal(ayaAid?.lineId, 'bb-11');
});

test('event mapper covers weapon vs art, subweapon, stagger, tag, boss phases, duo combo, and victory', () => {
  const resolveAttackSlot = (_actorId, attackId) => (attackId.endsWith(':courier-cut') ? 0 : 1);

  const weaponReq = mapCombatEventToBarkRequest(
    { type: 'attack-start', actorId: 'ren', attackId: 'party:ren:courier-cut' },
    SAMPLE_SNAPSHOT,
    { resolveAttackSlot },
  );
  assert.equal(weaponReq?.actorId, 'ren');
  assert.equal(weaponReq?.barkType, 'attack');
  assert.equal(weaponReq?.overrideThrottle, false);

  const artReq = mapCombatEventToBarkRequest(
    { type: 'attack-start', actorId: 'ren', attackId: 'party:ren:cinder-route' },
    SAMPLE_SNAPSHOT,
    { resolveAttackSlot },
  );
  assert.equal(artReq?.barkType, 'art');

  // Linked combo attacks defer to combo-start so duo barks are not stepped on.
  assert.equal(
    mapCombatEventToBarkRequest(
      { type: 'attack-start', actorId: 'lise', attackId: 'party:lise:dawn-bolt', comboId: 'black-sun-concord' },
      SAMPLE_SNAPSHOT,
    ),
    null,
  );

  const duoReq = mapCombatEventToBarkRequest(
    { type: 'combo-start', initiatorActorId: 'lise' },
    SAMPLE_SNAPSHOT,
  );
  assert.equal(duoReq?.actorId, 'lise');
  assert.equal(duoReq?.barkType, 'duo');
  assert.equal(duoReq?.overrideThrottle, true);

  const subweaponReq = mapCombatEventToBarkRequest(
    { type: 'subweapon-used', actorId: 'aya', subweaponId: 'holy-water' },
    SAMPLE_SNAPSHOT,
  );
  assert.equal(subweaponReq?.barkType, 'subweapon');
  assert.equal(subweaponReq?.fallbackBarkType, 'heal');

  const phaseReq = mapCombatEventToBarkRequest(
    { type: 'boss-phase-entered', bossActorId: 'kurozane-1', toPhaseId: 'dawn' },
    SAMPLE_SNAPSHOT,
  );
  assert.equal(phaseReq?.actorId, 'kurozane');
  assert.equal(phaseReq?.barkType, 'boss-phase');
  assert.equal(phaseReq?.phaseId, 'dawn');
  assert.equal(phaseReq?.overrideThrottle, true);

  const bossStaggerReq = mapCombatEventToBarkRequest(
    { type: 'poise-broken', actorId: 'kurozane-1', sourceActorId: 'ren' },
    SAMPLE_SNAPSHOT,
  );
  assert.equal(bossStaggerReq?.actorId, 'kurozane');
  assert.equal(bossStaggerReq?.barkType, 'stagger');
  assert.equal(bossStaggerReq?.fallbackActorId, 'ren');

  const tagReq = mapCombatEventToBarkRequest(
    { type: 'control-switch', actorId: 'lise' },
    SAMPLE_SNAPSHOT,
  );
  assert.equal(tagReq?.actorId, 'lise');
  assert.equal(tagReq?.barkType, 'tag');

  const bossDefeatReq = mapCombatEventToBarkRequest(
    { type: 'combat-end', outcome: 'victory' },
    SAMPLE_SNAPSHOT,
  );
  assert.equal(bossDefeatReq?.actorId, 'kurozane');
  assert.equal(bossDefeatReq?.barkType, 'boss-defeat');
  assert.equal(bossDefeatReq?.fallbackActorId, 'ren');
  assert.equal(bossDefeatReq?.fallbackBarkType, 'victory');
  assert.equal(bossDefeatReq?.overrideThrottle, true);
});

test('throttling prevents overlap and spam while high-priority duo/phase/victory barks override', async () => {
  const storage = createMemoryStorage({
    [DIALOGUE_VOICE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, enabled: true, language: 'en' }),
  });
  let clockMs = 10_000;
  const { instances, createAudio } = createFakeAudioFactory();
  const runtime = createBattleBarkRuntime({
    storage,
    now: () => clockMs,
    fetchImpl: async () => ({ ok: true, json: async () => SAMPLE_BARK_MANIFEST }),
    createAudio,
    resolveAttackSlot: (_actorId, attackId) => (attackId.endsWith(':courier-cut') ? 0 : 1),
  });

  // 1. Ren weapon attack plays.
  assert.equal(
    await runtime.handleCombatEvents([{ type: 'attack-start', actorId: 'ren', attackId: 'party:ren:courier-cut' }], SAMPLE_SNAPSHOT),
    true,
  );
  assert.equal(instances.length, 1);
  assert.match(instances[0].src, /bb-01-ren\.ogg$/);

  // 2. While active clip is still playing, routine tag bark is suppressed.
  clockMs += 500;
  assert.equal(
    await runtime.handleCombatEvents([{ type: 'control-switch', actorId: 'lise' }], SAMPLE_SNAPSHOT),
    false,
  );
  assert.equal(instances.length, 1);

  // 3. End clip, advance within global cooldown (< 1800 ms): still suppressed.
  instances[0].emit('ended');
  clockMs += DEFAULT_BATTLE_BARK_GLOBAL_COOLDOWN_MS - 600;
  assert.equal(
    await runtime.handleCombatEvents([{ type: 'control-switch', actorId: 'lise' }], SAMPLE_SNAPSHOT),
    false,
  );

  // 4. Advance past global cooldown (>= 1800 ms): Nikola tag bark plays, while Ren's per-actor cooldown (4000 ms) still blocks Ren.
  clockMs += 1000;
  assert.equal(
    await runtime.handleCombatEvents([{ type: 'attack-start', actorId: 'ren', attackId: 'party:ren:cinder-route' }], SAMPLE_SNAPSHOT),
    false,
  );
  assert.equal(
    await runtime.handleCombatEvents([{ type: 'control-switch', actorId: 'lise' }], SAMPLE_SNAPSHOT),
    true,
  );
  assert.equal(instances.length, 2);
  assert.match(instances[1].src, /bb-23-nikola\.ogg$/);

  // 5. High-priority combo-start overrides both active playback and cooldowns, pausing previous clip cleanly.
  clockMs += 100;
  assert.equal(
    await runtime.handleCombatEvents([{ type: 'combo-start', initiatorActorId: 'lise' }], SAMPLE_SNAPSHOT),
    true,
  );
  assert.equal(instances[1].paused, true);
  assert.equal(instances.length, 3);
  assert.match(instances[2].src, /bb-57-nikola\.ogg$/);

  // 6. High-priority boss-phase-entered overrides and selects the Dawn phase clip.
  clockMs += 200;
  assert.equal(
    await runtime.handleCombatEvents([{ type: 'boss-phase-entered', bossActorId: 'kurozane-1', toPhaseId: 'dawn' }], SAMPLE_SNAPSHOT),
    true,
  );
  assert.equal(instances[2].paused, true);
  assert.equal(instances.length, 4);
  assert.match(instances[3].src, /bb-63-kurozane\.ogg$/);

  // 7. After per-actor cooldown expires and active clip ends, Ren can bark again.
  instances[3].emit('ended');
  clockMs += DEFAULT_BATTLE_BARK_ACTOR_COOLDOWN_MS + 100;
  assert.equal(
    await runtime.handleCombatEvents([{ type: 'attack-start', actorId: 'ren', attackId: 'party:ren:cinder-route' }], SAMPLE_SNAPSHOT),
    true,
  );
  assert.match(instances[4].src, /bb-02-ren\.ogg$/);
});

test('fail-closed behavior when manifest is unavailable or audio playback rejects', async () => {
  const storage = createMemoryStorage({
    [DIALOGUE_VOICE_STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, enabled: true, language: 'ja' }),
  });

  const failingFetchRuntime = createBattleBarkRuntime({
    storage,
    fetchImpl: async () => ({ ok: false, status: 404 }),
    createAudio: () => { throw new Error('should not instantiate audio'); },
  });
  assert.equal(
    await failingFetchRuntime.handleCombatEvents([{ type: 'combo-start', initiatorActorId: 'lise' }], SAMPLE_SNAPSHOT),
    false,
  );
  assert.equal(failingFetchRuntime.getState().statusKind, 'unavailable');

  // Missing JA clip for combo-start fails closed without throwing; available JA clip for Ren plays.
  const partialJaRuntime = createBattleBarkRuntime({
    storage,
    fetchImpl: async () => ({ ok: true, json: async () => SAMPLE_BARK_MANIFEST }),
    createAudio: () => ({
      addEventListener() {},
      removeEventListener() {},
      play: () => Promise.reject(new Error('autoplay blocked')),
      pause() {},
    }),
  });
  assert.equal(
    await partialJaRuntime.handleCombatEvents([{ type: 'combo-start', initiatorActorId: 'lise' }], SAMPLE_SNAPSHOT),
    false,
  );
  assert.equal(
    await partialJaRuntime.handleCombatEvents([{ type: 'attack-start', actorId: 'ren', attackId: 'party:ren:courier-cut' }], SAMPLE_SNAPSHOT),
    true,
  );
});

test('authored voice prototype scripts satisfy 14-cast, 90-bark, and 80-verbatim-trio invariants', () => {
  const cast = JSON.parse(readFileSync(resolve(REPO_ROOT, 'assets/audio/voice-prototype-v1/cast.json'), 'utf8'));
  const barks = JSON.parse(readFileSync(resolve(REPO_ROOT, 'assets/audio/voice-prototype-v1/scene-battle-barks.json'), 'utf8'));
  const trio = JSON.parse(readFileSync(resolve(REPO_ROOT, 'assets/audio/voice-prototype-v1/scene-trio-highlights.json'), 'utf8'));

  assert.equal(Object.keys(cast.characters).length, 14);
  assert.equal(barks.sceneId, 'battle-barks');
  assert.equal(barks.lines.length, 90);
  const barkSpeakers = new Set(barks.lines.map((line) => line.speaker));
  assert.equal(barkSpeakers.size, 14, 'All 14 speaking cast roles must have battle barks');

  assert.equal(trio.sceneId, 'trio-highlights');
  assert.equal(trio.lines.length, 80);
  let kurozaneC903 = 0;
  let kurozaneC904 = 0;
  for (const line of trio.lines) {
    assert.ok(cast.characters[line.speaker], `Unknown speaker ${line.speaker}`);
    const scene = getFullDialogueScene(line.beatId);
    assert.ok(scene, `Unknown beat ${line.beatId}`);
    const verbatim = scene.dialogue.some(
      (entry) => entry.speaker.toLowerCase() === line.speaker && entry.line === line.en,
    );
    assert.equal(verbatim, true, `Line ${line.id} must match canonical script verbatim`);
    if (line.speaker === 'kurozane' && line.beatId === 'c9-03-conservatory-offers') kurozaneC903 += 1;
    if (line.speaker === 'kurozane' && line.beatId === 'c9-04-yearless-bell') kurozaneC904 += 1;
  }
  assert.equal(kurozaneC903, 21);
  assert.equal(kurozaneC904, 9);
});
