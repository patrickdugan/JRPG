import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMPAIGN } from '../content/campaign.mjs';
import { getEncounter } from '../content/encounters.mjs';
import { getLevel } from '../content/levels.mjs';
import {
  WITNESS_CHRONICLES,
  WITNESS_CHRONICLE_GUARDRAILS,
  getWitnessChronicle,
  getWitnessChronicleMetrics,
  validateWitnessChronicle,
  validateWitnessChronicleCatalog,
} from '../content/witness-chronicles.mjs';
import {
  acknowledgeWitnessChronicleLine,
  acceptWitnessChronicle,
  advanceWitnessChronicle,
  completeWitnessChronicle,
  createWitnessChronicleState,
  createWitnessChronicleStorageAdapter,
  getWitnessChronicleAvailability,
  getWitnessChronicleProgress,
  getWitnessChronicleRuntimeMetrics,
  loadWitnessChronicleState,
  serializeWitnessChronicleState,
  validateWitnessChroniclePayload,
} from '../witness-chronicle-runtime.mjs';

function openContext(entry) {
  return { campaignState: { completedBeatIds: [entry.opensAfterBeatId] } };
}

function evidenceFor(entry, currentStage, choiceIndex = 0) {
  const evidence = {};
  if (currentStage.encounterId) Object.assign(evidence, { encounterId: currentStage.encounterId, victory: true });
  if (entry.choice.stageId === currentStage.id) evidence.choiceId = entry.choice.options[choiceIndex].id;
  return evidence;
}

function acknowledgeStageDialogue(state, chronicleId) {
  let next = state;
  let progress = getWitnessChronicleProgress(next, chronicleId);
  while (progress.currentStage && !progress.dialogueComplete) {
    const acknowledged = acknowledgeWitnessChronicleLine(next, chronicleId);
    assert.equal(acknowledged.ok, true, acknowledged.reason);
    next = acknowledged.state;
    progress = acknowledged.progress;
  }
  return next;
}

test('catalog contains 18 immutable finite chronicles across every chapter', () => {
  assert.equal(WITNESS_CHRONICLES.length, 18);
  assert.ok(Object.isFrozen(WITNESS_CHRONICLES));
  assert.ok(Object.isFrozen(WITNESS_CHRONICLES[0].stages[0].dialogue[0]));
  assert.ok(Object.isFrozen(WITNESS_CHRONICLE_GUARDRAILS));
  assert.equal(validateWitnessChronicleCatalog().ok, true);

  const coveredChapters = new Set(WITNESS_CHRONICLES.map((entry) => entry.chapterId));
  assert.deepEqual(coveredChapters, new Set(CAMPAIGN.chapters.map((chapter) => chapter.id)));
  assert.equal(WITNESS_CHRONICLES.every((entry) => entry.repeatable === false), true);
});

test('each chronicle carries 16-24 unique authored lines and a concrete derived duration', () => {
  const allLines = [];
  for (const entry of WITNESS_CHRONICLES) {
    const lines = entry.stages.flatMap((current) => current.dialogue.map((item) => item.line));
    allLines.push(...lines);
    assert.ok(entry.stages.length >= 3 && entry.stages.length <= 5, entry.id);
    assert.ok(lines.length >= 16 && lines.length <= 24, `${entry.id}: ${lines.length}`);
    assert.equal(new Set(lines).size, lines.length, `${entry.id} repeats a dialogue line`);
    assert.equal(entry.estimatedMinutes, entry.stages.reduce((sum, current) => sum + current.activity.minutes, 0));
    assert.equal(validateWitnessChronicle(entry).ok, true, entry.id);
  }
  assert.equal(new Set(allLines).size, allLines.length, 'catalog dialogue should not duplicate authored lines');
});

test('canonical beats, forward maps, and encounter locations are reference-safe', () => {
  let combatChronicles = 0;
  for (const entry of WITNESS_CHRONICLES) {
    const chapter = CAMPAIGN.chapters.find((candidate) => candidate.id === entry.chapterId);
    assert.ok(chapter.beats.some((beat) => beat.id === entry.opensAfterBeatId), entry.id);
    assert.equal(entry.navigation.backtrackingRequired, false);
    assert.equal(entry.navigation.abilityGate, null);
    for (const current of entry.stages) {
      const level = getLevel(current.mapId);
      assert.equal(level.chapterId, entry.chapterId, `${entry.id}/${current.id}`);
      assert.ok(chapter.maps.some((map) => map.id === current.mapId), `${entry.id}/${current.mapId}`);
      if (current.encounterId) {
        const encounter = getEncounter(current.encounterId);
        assert.equal(encounter.chapterId, entry.chapterId);
        assert.equal(encounter.levelId, current.mapId);
      }
    }
    if (entry.stages.some((current) => current.encounterId)) combatChronicles += 1;
  }
  assert.ok(combatChronicles >= 6);
});

test('content validation rejects invented routes, unsupported keys, false pacing, and sacred loot', () => {
  const invalid = structuredClone(WITNESS_CHRONICLES[0]);
  invalid.invented = true;
  invalid.stages[0].mapId = 'not-a-canonical-map';
  invalid.stages[0].activity.minutes = 1;
  invalid.estimatedMinutes = 999;
  invalid.reward.keyItems.push('Looted altar relic');
  const validation = validateWitnessChronicle(invalid);
  assert.equal(validation.ok, false);
  const errors = validation.errors.join(' ');
  assert.match(errors, /unsupported or missing chronicle keys/);
  assert.match(errors, /canonical campaign map/);
  assert.match(errors, /conservative bounded estimate/);
  assert.match(errors, /sum of concrete stage activities/);
  assert.match(errors, /sacred object as loot/);
  assert.ok(Object.isFrozen(validation));
  assert.ok(Object.isFrozen(validation.errors));
});

test('aggregate metrics expose real finite script and activity volume', () => {
  const metrics = getWitnessChronicleMetrics();
  const derivedLines = WITNESS_CHRONICLES.flatMap((entry) => entry.stages.flatMap((current) => current.dialogue)).length;
  const derivedWords = WITNESS_CHRONICLES.reduce(
    (sum, entry) => sum + entry.stages.reduce(
      (stageSum, current) => stageSum + current.dialogue.reduce(
        (lineSum, item) => lineSum + item.line.trim().split(/\s+/u).filter(Boolean).length,
        0,
      ),
      0,
    ),
    0,
  );
  assert.equal(metrics.chronicleCount, 18);
  assert.equal(metrics.lineCount, derivedLines);
  assert.equal(metrics.dialogueWordCount, derivedWords);
  assert.ok(metrics.dialogueWordCount >= 3000);
  assert.ok(metrics.totalMinutes >= 390);
  assert.ok(metrics.totalHours >= 6.5);
  assert.equal(metrics.repeatableMinutes, 0);
  assert.equal(Object.keys(metrics.byChapter).length, CAMPAIGN.chapters.length);
});

test('all 18 chronicles accept, advance in order, choose, and complete exactly once', () => {
  let state = createWitnessChronicleState();
  let transitionCount = 0;
  for (const entry of WITNESS_CHRONICLES) {
    const accepted = acceptWitnessChronicle(state, entry.id, openContext(entry));
    assert.equal(accepted.ok, true, accepted.reason);
    state = accepted.state;
    transitionCount += 1;
    for (const current of entry.stages) {
      state = acknowledgeStageDialogue(state, entry.id);
      transitionCount += current.dialogue.length;
      const advanced = advanceWitnessChronicle(state, entry.id, current.id, evidenceFor(entry, current));
      assert.equal(advanced.ok, true, `${entry.id}/${current.id}: ${advanced.reason}`);
      state = advanced.state;
      transitionCount += 1;
    }
    assert.equal(getWitnessChronicleProgress(state, entry.id).readyToComplete, true);
    const completed = completeWitnessChronicle(state, entry.id);
    assert.equal(completed.ok, true, completed.reason);
    assert.equal(completed.reward, entry.reward);
    assert.ok(completed.consequence.flag.startsWith('witness.'));
    state = completed.state;
    transitionCount += 1;
    const replay = acceptWitnessChronicle(state, entry.id, openContext(entry));
    assert.equal(replay.ok, false);
    assert.match(replay.reason, /finite and already complete/);
  }
  assert.equal(state.revision, transitionCount);
  const metrics = getWitnessChronicleRuntimeMetrics(state);
  assert.equal(metrics.completedChronicles, 18);
  assert.equal(metrics.activeChronicles, 0);
  assert.equal(metrics.completedStages, getWitnessChronicleMetrics().stageCount);
  assert.equal(metrics.completedMinutes, getWitnessChronicleMetrics().totalMinutes);
  assert.equal(metrics.remainingFiniteMinutes, 0);
  assert.equal(metrics.percentChroniclesComplete, 100);
});

test('availability, ordered stages, choices, and combat proof fail closed', () => {
  const entry = WITNESS_CHRONICLES.find((candidate) => candidate.stages.some((current) => current.encounterId));
  let state = createWitnessChronicleState();
  assert.equal(getWitnessChronicleAvailability(state, entry.id).available, false);
  const accepted = acceptWitnessChronicle(state, entry.id, openContext(entry));
  assert.equal(accepted.ok, true);
  state = accepted.state;

  const wrongOrder = advanceWitnessChronicle(state, entry.id, entry.stages[1].id);
  assert.equal(wrongOrder.ok, false);
  assert.equal(wrongOrder.state, state);

  for (const current of entry.stages) {
    state = acknowledgeStageDialogue(state, entry.id);
    if (current.encounterId) {
      const missingVictory = advanceWitnessChronicle(state, entry.id, current.id, { encounterId: current.encounterId, victory: false });
      assert.equal(missingVictory.ok, false);
      assert.equal(missingVictory.state, state);
    }
    if (entry.choice.stageId === current.id) {
      const missingChoice = advanceWitnessChronicle(state, entry.id, current.id, current.encounterId
        ? { encounterId: current.encounterId, victory: true }
        : {});
      assert.equal(missingChoice.ok, false);
      assert.equal(missingChoice.state, state);
    }
    const advanced = advanceWitnessChronicle(state, entry.id, current.id, evidenceFor(entry, current, 1));
    assert.equal(advanced.ok, true, advanced.reason);
    state = advanced.state;
  }
  const completion = completeWitnessChronicle(state, entry.id);
  assert.equal(completion.ok, true);
  assert.equal(completion.consequence, entry.choice.options[1].consequence);
});

test('stage testimony is acknowledged one authored line at a time before resolution', () => {
  const entry = WITNESS_CHRONICLES[0];
  let state = acceptWitnessChronicle(createWitnessChronicleState(), entry.id, openContext(entry)).state;
  const stage = entry.stages[0];
  const premature = advanceWitnessChronicle(state, entry.id, stage.id);
  assert.equal(premature.ok, false);
  assert.match(premature.reason, /requires all .* authored dialogue lines/);

  for (let index = 0; index < stage.dialogue.length; index += 1) {
    const acknowledged = acknowledgeWitnessChronicleLine(state, entry.id);
    assert.equal(acknowledged.ok, true);
    assert.equal(acknowledged.line, stage.dialogue[index]);
    state = acknowledged.state;
    assert.equal(acknowledged.progress.acknowledgedLines, index + 1);
  }
  const overflow = acknowledgeWitnessChronicleLine(state, entry.id);
  assert.equal(overflow.ok, false);
  assert.equal(overflow.state, state);
  const completed = advanceWitnessChronicle(state, entry.id, stage.id);
  assert.equal(completed.ok, true);
  assert.equal(completed.progress.acknowledgedLines, 0);
});

test('versioned saves round-trip immutably and reject incoherent records', () => {
  const entry = WITNESS_CHRONICLES[0];
  let state = acceptWitnessChronicle(createWitnessChronicleState(), entry.id, openContext(entry)).state;
  const loaded = loadWitnessChronicleState(serializeWitnessChronicleState(state));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.state, state);
  assert.ok(Object.isFrozen(loaded.state.records[0]));

  const unknown = JSON.parse(serializeWitnessChronicleState(state));
  unknown.records[0].id = 'wc-not-canonical';
  assert.equal(validateWitnessChroniclePayload(unknown).ok, false);

  const earlyChoice = JSON.parse(serializeWitnessChronicleState(state));
  earlyChoice.records[0].choiceId = entry.choice.options[0].id;
  assert.match(validateWitnessChroniclePayload(earlyChoice).errors.join(' '), /choiceId is set before/);

  const impossibleCompletion = JSON.parse(serializeWitnessChronicleState(state));
  impossibleCompletion.records[0].status = 'completed';
  assert.match(validateWitnessChroniclePayload(impossibleCompletion).errors.join(' '), /completed status requires every stage/);

  const extraKey = JSON.parse(serializeWitnessChronicleState(state));
  extraKey.records[0].invented = true;
  assert.match(validateWitnessChroniclePayload(extraKey).errors.join(' '), /unsupported keys/);
});

test('storage adapter persists, clears, and recovers safely from malformed JSON', () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  const adapter = createWitnessChronicleStorageAdapter(storage, 'test.witness');
  const state = createWitnessChronicleState();
  assert.equal(adapter.save(state).ok, true);
  assert.deepEqual(adapter.load().state, state);
  memory.set('test.witness', '{bad json');
  const recovered = adapter.load();
  assert.equal(recovered.ok, false);
  assert.deepEqual(recovered.state, createWitnessChronicleState());
  assert.equal(adapter.clear().ok, true);
  assert.equal(memory.has('test.witness'), false);
});

test('lookup returns canonical immutable entries and null for unknown IDs', () => {
  const entry = WITNESS_CHRONICLES[5];
  assert.equal(getWitnessChronicle(entry.id), entry);
  assert.equal(getWitnessChronicle('wc-missing'), null);
});
