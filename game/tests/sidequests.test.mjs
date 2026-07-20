import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMPAIGN } from '../content/campaign.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import { LEVELS } from '../content/levels.mjs';
import { createFieldState, enterField } from '../field-runtime.mjs';
import {
  ALL_OPTIONAL_QUESTS,
  OPTIONAL_CONTENT_GUARDRAILS,
  REPEATABLE_CONTRACTS,
  SIDE_QUEST_SCHEMA_VERSION,
  SIDE_QUESTS,
  getOptionalContentPacing,
  getOptionalQuestsForChapter,
  getSideQuest,
} from '../content/sidequests.mjs';

const chapterById = new Map(CAMPAIGN.chapters.map((chapter) => [chapter.id, chapter]));
const beatById = new Map(CAMPAIGN.chapters.flatMap((chapter) => (
  chapter.beats.map((beat) => [beat.id, { ...beat, chapterId: chapter.id }])
)));
const levelById = new Map(LEVELS.map((level) => [level.id, level]));
const encounterById = new Map(ENCOUNTERS.map((encounter) => [encounter.id, encounter]));
const optionalById = new Map(ALL_OPTIONAL_QUESTS.map((quest) => [quest.id, quest]));

function assertRewardBundle(bundle, label) {
  assert.equal(Number.isSafeInteger(bundle.xpPerMember) && bundle.xpPerMember >= 0, true, `${label} XP`);
  assert.equal(Number.isSafeInteger(bundle.currency) && bundle.currency >= 0, true, `${label} currency`);
  assert.equal(Array.isArray(bundle.items), true, `${label} items`);
  assert.equal(Array.isArray(bundle.keyItems), true, `${label} key items`);
  for (const item of bundle.items) {
    assert.equal(typeof item.name === 'string' && item.name.trim().length > 0, true, `${label} item name`);
    assert.equal(Number.isSafeInteger(item.quantity) && item.quantity > 0, true, `${label} item quantity`);
  }
  for (const keyItem of bundle.keyItems) {
    assert.equal(typeof keyItem === 'string' && keyItem.trim().length > 0, true, `${label} key item`);
  }
}

test('optional-content module has a versioned, immutable public contract', () => {
  assert.equal(SIDE_QUEST_SCHEMA_VERSION, 2);
  assert.equal(SIDE_QUESTS.length, 13);
  assert.equal(REPEATABLE_CONTRACTS.length, 4);
  assert.equal(ALL_OPTIONAL_QUESTS.length, 17);
  assert.equal(Object.isFrozen(SIDE_QUESTS), true);
  assert.equal(Object.isFrozen(REPEATABLE_CONTRACTS), true);
  assert.equal(Object.isFrozen(ALL_OPTIONAL_QUESTS), true);
  assert.equal(Object.isFrozen(ALL_OPTIONAL_QUESTS[0].objectives), true);
  assert.ok(OPTIONAL_CONTENT_GUARDRAILS.length >= 5);
});

test('talk objectives explicitly distinguish individual people from collectives', () => {
  const talks = ALL_OPTIONAL_QUESTS.flatMap((quest) => quest.objectives).filter(({ type }) => type === 'talk');
  assert.equal(talks.length, 8);
  assert.deepEqual(
    talks.filter(({ targetKind }) => targetKind === 'person').map(({ id }) => id),
    ['ask-sayo-format', 'take-reader-instructions', 'learn-knot-marks', 'confirm-fog-signal'],
  );
  assert.deepEqual(
    talks.filter(({ targetKind }) => targetKind === 'group').map(({ id }) => id),
    ['record-hoshigawa-offer', 'record-sodegaura-offer', 'record-takamine-offer', 'verify-storehouse-date'],
  );
  assert.equal(talks.every(({ targetKind }) => ['person', 'group'].includes(targetKind)), true);
});

test('quest, save, objective, and completion identifiers are unique and deterministic', () => {
  const questIds = ALL_OPTIONAL_QUESTS.map(({ id }) => id);
  assert.equal(new Set(questIds).size, questIds.length);

  const saveKeys = [];
  const completionFlags = [];
  for (const quest of ALL_OPTIONAL_QUESTS) {
    assert.match(quest.id, /^(sq|contract)-[a-z0-9-]+$/);
    const objectiveIds = quest.objectives.map(({ id }) => id);
    assert.equal(new Set(objectiveIds).size, objectiveIds.length, `${quest.id} objective IDs`);
    assert.deepEqual(
      quest.objectives.map(({ order }) => order),
      quest.objectives.map((_, index) => index + 1),
      `${quest.id} objective order`,
    );
    assert.deepEqual(quest.completion.requiredObjectiveIds, objectiveIds, `${quest.id} completion contract`);

    assert.match(quest.save.acceptedFlag, new RegExp(`^optional\\.${quest.id}\\.`));
    assert.match(quest.save.progressKey, new RegExp(`^optional\\.${quest.id}\\.`));
    assert.match(quest.save.completionFlag, new RegExp(`^optional\\.${quest.id}\\.`));
    assert.equal(quest.save.failedFlag, null);
    saveKeys.push(quest.save.acceptedFlag, quest.save.progressKey, quest.save.completionFlag);
    if (quest.save.repeatCountKey) saveKeys.push(quest.save.repeatCountKey);
    completionFlags.push(...quest.completion.setsFlags);
  }
  assert.equal(new Set(saveKeys).size, saveKeys.length, 'save keys must not alias');
  assert.equal(new Set(completionFlags).size, completionFlags.length, 'completion flags must not alias');
});

test('every chapter, beat, map, and linked encounter reference is canonical', () => {
  for (const quest of ALL_OPTIONAL_QUESTS) {
    const chapter = chapterById.get(quest.chapterId);
    assert.ok(chapter, `${quest.id} chapter`);
    assert.ok(quest.mapIds.length > 0, `${quest.id} map list`);
    assert.equal(new Set(quest.mapIds).size, quest.mapIds.length, `${quest.id} duplicate map`);

    const chapterMapIds = new Set(chapter.maps.map(({ id }) => id));
    for (const mapId of quest.mapIds) {
      assert.ok(chapterMapIds.has(mapId), `${quest.id} map ${mapId} belongs to ${chapter.id}`);
      assert.equal(levelById.get(mapId)?.chapterId, chapter.id, `${quest.id} level ${mapId} chapter`);
    }
    assert.ok(quest.mapIds.includes(quest.questGiver.mapId), `${quest.id} giver map`);

    const openingBeat = beatById.get(quest.prerequisites.opensAfterBeatId);
    assert.ok(openingBeat, `${quest.id} opening beat`);
    assert.equal(openingBeat.chapterId, chapter.id, `${quest.id} opening beat chapter`);

    assert.equal(new Set(quest.linkedEncounterIds).size, quest.linkedEncounterIds.length, `${quest.id} encounter links`);
    for (const encounterId of quest.linkedEncounterIds) {
      assert.ok(encounterById.has(encounterId), `${quest.id} linked encounter ${encounterId}`);
      assert.equal(encounterById.get(encounterId).chapterId, chapter.id, `${quest.id} linked encounter chapter`);
    }
    for (const encounterId of quest.prerequisites.encounterIds) {
      assert.ok(encounterById.has(encounterId), `${quest.id} encounter prerequisite ${encounterId}`);
      assert.equal(encounterById.get(encounterId).chapterId, chapter.id, `${quest.id} encounter prerequisite chapter`);
    }
    for (const objective of quest.objectives) {
      assert.ok(quest.mapIds.includes(objective.mapId), `${quest.id}/${objective.id} objective map`);
      assert.equal(typeof objective.targetId === 'string' && objective.targetId.length > 0, true);
      assert.equal(typeof objective.instruction === 'string' && objective.instruction.length >= 20, true);
      if (objective.type === 'battle-replay') {
        assert.ok(encounterById.has(objective.encounterId), `${quest.id}/${objective.id} battle encounter`);
        assert.ok(quest.linkedEncounterIds.includes(objective.encounterId));
        assert.ok(quest.prerequisites.encounterIds.includes(objective.encounterId));
      }
    }
  }
});

test('every side-story objective map can be entered directly by the journal route', () => {
  let field = createFieldState({ levelId: LEVELS[0].id, beatId: 'side-story-route-test' });
  for (const quest of ALL_OPTIONAL_QUESTS) {
    for (const objective of quest.objectives) {
      field = enterField(field, objective.mapId, 'side-story-route-test');
      assert.equal(field.current.levelId, objective.mapId, `${quest.id}/${objective.id}`);
    }
  }
});

test('quest prerequisites exist, precede their dependants, and contain no cycles', () => {
  const order = new Map(ALL_OPTIONAL_QUESTS.map((quest, index) => [quest.id, index]));
  for (const quest of ALL_OPTIONAL_QUESTS) {
    assert.equal(Array.isArray(quest.prerequisites.questIds), true);
    assert.equal(Array.isArray(quest.prerequisites.campaignFlags), true);
    assert.equal(Array.isArray(quest.prerequisites.encounterIds), true);
    for (const prerequisiteId of quest.prerequisites.questIds) {
      assert.ok(optionalById.has(prerequisiteId), `${quest.id} prerequisite ${prerequisiteId}`);
      assert.ok(order.get(prerequisiteId) < order.get(quest.id), `${quest.id} prerequisite must be authored first`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) assert.fail(`quest prerequisite cycle at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisiteId of optionalById.get(id).prerequisites.questIds) visit(prerequisiteId);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of optionalById.keys()) visit(id);
});

test('reward bundles can map directly into advancement XP and inventory vocabulary', () => {
  for (const quest of SIDE_QUESTS) {
    assertRewardBundle(quest.rewards.firstClear, `${quest.id} first clear`);
    assert.equal(quest.rewards.repeat, null);
  }
  for (const quest of REPEATABLE_CONTRACTS) {
    assertRewardBundle(quest.rewards.firstClear, `${quest.id} first clear`);
    assertRewardBundle(quest.rewards.repeat, `${quest.id} repeat`);
    assert.ok(quest.rewards.repeat.xpPerMember < quest.rewards.firstClear.xpPerMember);
    assert.ok(quest.rewards.repeat.currency < quest.rewards.firstClear.currency);
    assert.deepEqual(quest.rewards.repeat.items, []);
    assert.deepEqual(quest.rewards.repeat.keyItems, []);
  }
});

test('optional pacing supplies 3-5 finite hours before repeat grinding', () => {
  const pacing = getOptionalContentPacing();
  assert.deepEqual(pacing, {
    storyMinutes: 224,
    firstContractCircuitMinutes: 40,
    firstPassMinutes: 264,
    firstPassHours: 4.4,
    repeatableAfterFirstCircuit: true,
  });
  assert.ok(pacing.firstPassMinutes >= 180);
  assert.ok(pacing.firstPassMinutes <= 300);
  assert.equal(
    pacing.storyMinutes,
    SIDE_QUESTS.reduce((minutes, quest) => minutes + quest.estimatedMinutes, 0),
  );
});

test('optional routes explicitly reject ability gates and mandatory backtracking', () => {
  for (const quest of ALL_OPTIONAL_QUESTS) {
    assert.equal(quest.navigation.backtrackingRequired, false, quest.id);
    assert.equal(quest.navigation.abilityGate, null, quest.id);
    assert.equal(quest.failure.mode === 'none' || quest.failure.mode === 'reset-run', true, quest.id);
    assert.ok(quest.setup.length >= 80, `${quest.id} setup should carry narrative context`);
    assert.ok(quest.completion.resolution.length >= 60, `${quest.id} resolution should carry consequence`);
  }
  const serialized = JSON.stringify(ALL_OPTIONAL_QUESTS).toLowerCase();
  for (const forbidden of ['adam driver', 'celebrity likeness', 'double jump', 'grappling hook', 'breakable wall']) {
    assert.equal(serialized.includes(forbidden), false, `forbidden optional-content phrase: ${forbidden}`);
  }
});

test('lookup helpers are null-safe and preserve campaign order', () => {
  assert.equal(getSideQuest('sq-c6-three-inks')?.title, 'Three Inks, No Master');
  assert.equal(getSideQuest('not-a-quest'), null);
  assert.deepEqual(
    getOptionalQuestsForChapter('chapter-1').map(({ id }) => id),
    ['sq-c1-blank-lines', 'sq-c1-mud-seal', 'contract-c1-cinder-route'],
  );
  assert.deepEqual(getOptionalQuestsForChapter('not-a-chapter'), []);
});
