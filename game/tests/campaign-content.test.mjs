import assert from 'node:assert/strict';
import test from 'node:test';
import { STATUS_GLYPH_PRESENTATION } from '../battle-animation.mjs';
import { COMBAT_STATUS_DEFINITIONS } from '../campaign-combat.mjs';
import { CAMPAIGN, getAllChapters, getChapter } from '../content/campaign.mjs';
import { LEVELS, getLevel, getLevelForChapter } from '../content/levels.mjs';
import { ENCOUNTERS, getEncounterForChapter } from '../content/encounters.mjs';

test('campaign declares the full prologue-to-epilogue chapter spine', () => {
  const chapters = getAllChapters();
  assert.equal(CAMPAIGN.title, 'Bells of the Black Chrysanthemum');
  assert.equal(chapters.length, 11);
  assert.equal(chapters[0].id, 'prologue');
  assert.equal(chapters.at(-1).id, 'epilogue');
});

test('every chapter has playable beats, a party, objective, reward, boss, map, and encounter references', () => {
  for (const chapter of getAllChapters()) {
    assert.ok(chapter.objective, `${chapter.id} needs an objective`);
    assert.ok(chapter.reward, `${chapter.id} needs a reward`);
    assert.ok(chapter.boss, `${chapter.id} needs a boss`);
    assert.ok(Array.isArray(chapter.party) && chapter.party.length > 0, `${chapter.id} needs a party`);
    assert.ok(Array.isArray(chapter.beats) && chapter.beats.length >= 3, `${chapter.id} needs at least three beats`);
    assert.ok(Array.isArray(chapter.maps) && chapter.maps.length > 0, `${chapter.id} needs map references`);
    assert.ok(Array.isArray(chapter.encounters) && chapter.encounters.length > 0, `${chapter.id} needs encounter references`);
    assert.equal(getChapter(chapter.id), chapter, `${chapter.id} lookup should return canonical data`);
    for (const beat of chapter.beats) {
      assert.ok(beat.id && beat.title && beat.location && beat.text, `${chapter.id} has an incomplete beat`);
      assert.ok(beat.mapId, `${beat.id} needs an explicit map binding`);
      assert.ok(getLevel(beat.mapId), `${beat.id} map binding ${beat.mapId} must resolve`);
      for (const choice of beat.choices ?? []) {
        assert.ok(choice.id && choice.label && choice.result, `${beat.id} has an incomplete choice`);
      }
    }
  }
});

test('map and encounter kits cover every chapter with tactical data', () => {
  const chapterIds = new Set(getAllChapters().map((chapter) => chapter.id));
  assert.ok(LEVELS.length >= chapterIds.size);
  assert.ok(ENCOUNTERS.length >= chapterIds.size);

  for (const chapterId of chapterIds) {
    const level = getLevelForChapter(chapterId);
    const encounter = getEncounterForChapter(chapterId);
    assert.ok(level, `${chapterId} needs a primary level`);
    assert.ok(encounter, `${chapterId} needs a primary encounter`);
    assert.ok(level.width >= 7 && level.height >= 5, `${level.id} needs a usable grid`);
    assert.ok(Array.isArray(level.blocked) && Array.isArray(level.terrain), `${level.id} needs map tiles`);
    assert.ok(encounter.objective && encounter.lesson && encounter.bossMechanic, `${encounter.id} needs gameplay framing`);
    assert.ok(Array.isArray(encounter.enemies) && encounter.enemies.length > 0, `${encounter.id} needs enemies`);
  }
});

test('every runtime encounter is bound to exactly one canonical story beat', () => {
  const bindings = new Map();
  for (const chapter of getAllChapters()) {
    for (const beat of chapter.beats) {
      for (const encounterId of beat.encounterIds ?? []) {
        assert.ok(!bindings.has(encounterId), `${encounterId} is bound to more than one beat`);
        bindings.set(encounterId, { chapterId: chapter.id, beatId: beat.id });
      }
    }
  }
  assert.equal(bindings.size, ENCOUNTERS.length);
  for (const encounter of ENCOUNTERS) {
    const binding = bindings.get(encounter.id);
    assert.ok(binding, `${encounter.id} needs a story-beat binding`);
    assert.equal(binding.chapterId, encounter.chapterId, `${encounter.id} must be bound inside ${encounter.chapterId}`);
  }
});

test('every authored combat status resolves to engine mechanics and presentation vocabulary', () => {
  const authored = new Map();
  for (const encounter of ENCOUNTERS) {
    for (const enemy of encounter.enemies) {
      for (const skill of enemy.skills ?? []) {
        for (const field of ['status', 'selfStatus']) {
          const statusId = skill.effect?.[field];
          if (statusId) authored.set(statusId, `${encounter.id}/${enemy.id}/${skill.id}/${field}`);
        }
      }
    }
  }
  assert.ok(authored.size > 0);
  for (const [statusId, source] of authored) {
    assert.ok(COMBAT_STATUS_DEFINITIONS[statusId], `${source} references undefined status ${statusId}`);
    assert.ok(STATUS_GLYPH_PRESENTATION[statusId], `${source} has no presentation glyph for ${statusId}`);
  }

  const kurozane = ENCOUNTERS.find(({ id }) => id === 'c9-kurozane')
    .enemies.find(({ id }) => id === 'kurozane');
  const window = kurozane.skills.find(({ id }) => id === 'black-chrysanthemum');
  assert.equal(window.effect.selfStatus, 'final-ward-open');
  assert.equal(window.recoveryPulses, 3);
  assert.equal(kurozane.resistances.essence.radiance, 1.25);
  assert.equal(COMBAT_STATUS_DEFINITIONS['final-ward-open'].kind, 'tactical-marker');
});
