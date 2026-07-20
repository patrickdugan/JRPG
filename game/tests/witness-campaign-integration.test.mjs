import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WITNESS_CHRONICLES } from '../content/witness-chronicles.mjs';
import {
  acknowledgeWitnessChronicleLine,
  acceptWitnessChronicle,
  advanceWitnessChronicle,
  completeWitnessChronicle,
  createWitnessChronicleState,
  getWitnessChronicleAvailability,
  getWitnessChronicleProgress,
} from '../witness-chronicle-runtime.mjs';

const campaignHtml = readFileSync(new URL('../campaign.html', import.meta.url), 'utf8');
const campaignSource = readFileSync(new URL('../campaign.js', import.meta.url), 'utf8');
const battleSource = readFileSync(new URL('../battle.js', import.meta.url), 'utf8');
const battleSettlementSource = readFileSync(new URL('../battle-settlement.mjs', import.meta.url), 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source boundary: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source boundary: ${endMarker}`);
  assert.ok(end > start, `Invalid source boundaries: ${startMarker} / ${endMarker}`);
  return source.slice(start, end);
}

function importedNames(source, modulePath) {
  const pattern = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['\"]${escapeRegExp(modulePath)}['\"]`);
  const match = source.match(pattern);
  assert.ok(match, `Missing imports from ${modulePath}`);
  return new Set(match[1].split(',').map((name) => name.trim()).filter(Boolean));
}

function openContext(entry) {
  return { campaignState: { completedBeatIds: [entry.opensAfterBeatId] } };
}

function acknowledgeCurrentStage(state, entry) {
  const before = getWitnessChronicleProgress(state, entry.id);
  assert.ok(before?.currentStage, `${entry.id} should have a current stage`);
  const expectedLines = before.currentStage.dialogue;
  let next = state;
  for (let index = 0; index < expectedLines.length; index += 1) {
    const result = acknowledgeWitnessChronicleLine(next, entry.id);
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.line, expectedLines[index], 'acknowledgement must return the exact next authored line');
    assert.equal(result.progress.acknowledgedLines, index + 1);
    next = result.state;
  }
  const progress = getWitnessChronicleProgress(next, entry.id);
  assert.equal(progress.dialogueComplete, true);
  assert.equal(progress.currentDialogueLine, null);
  return next;
}

function assertOneTimeReward(result, entry, option) {
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(result.reward, entry.reward);
  assert.deepEqual(Object.keys(result.reward).sort(), ['currency', 'items', 'keyItems', 'xpPerMember']);
  assert.equal(Number.isSafeInteger(result.reward.xpPerMember), true);
  assert.equal(Number.isSafeInteger(result.reward.currency), true);
  assert.equal(Array.isArray(result.reward.items), true);
  assert.equal(Array.isArray(result.reward.keyItems), true);
  assert.deepEqual(result.consequence, option.consequence);
  assert.deepEqual(Object.keys(result.consequence).sort(), ['flag', 'summary']);
  assert.match(result.consequence.flag, /^witness\./);
}

test('campaign page exposes every witness control consumed by its module and wires the finite runtime', () => {
  const requiredControlIds = [
    'witnessSummary',
    'witnessList',
    'witnessStageCard',
    'witnessStageMeta',
    'witnessStageTitle',
    'witnessStageInstruction',
    'witnessDialogue',
    'witnessChoiceDeck',
    'witnessStageHint',
  ];
  for (const id of requiredControlIds) {
    const htmlMatches = campaignHtml.match(new RegExp(`\\bid=[\"']${escapeRegExp(id)}[\"']`, 'g')) ?? [];
    assert.equal(htmlMatches.length, 1, `campaign.html must expose one #${id} control`);
    assert.match(campaignSource, new RegExp(`querySelector\\(\\s*['\"]#${escapeRegExp(id)}['\"]\\s*\\)`));
  }

  const names = importedNames(campaignSource, './witness-chronicle-runtime.mjs');
  for (const required of [
    'acknowledgeWitnessChronicleLine',
    'acceptWitnessChronicle',
    'advanceWitnessChronicle',
    'completeWitnessChronicle',
    'createWitnessChronicleState',
    'createWitnessChronicleStorageAdapter',
    'getWitnessChronicleAvailability',
    'getWitnessChronicleProgress',
    'getWitnessChronicleRuntimeMetrics',
  ]) assert.equal(names.has(required), true, `campaign.js must import ${required}`);

  assert.match(campaignSource, /const\s+witnessAdapter\s*=\s*createWitnessChronicleStorageAdapter\(\s*\)/);
  assert.match(campaignSource, /const\s+loadedWitnessChronicles\s*=\s*witnessAdapter\.load\(\s*\)/);
});

test('campaign interaction requires the selected on-map marker and hands exact chronicle evidence to battle', () => {
  const interaction = sourceSection(
    campaignSource,
    "interactFieldButton.addEventListener('click'",
    "previousScene.addEventListener('click'",
  );
  const markerLookup = interaction.indexOf('const witnessMarker = getActiveWitnessMarker(level)');
  const exactGate = interaction.search(/if\s*\(\s*witnessMarker\s*&&\s*onExactFieldPosition\(\s*fieldPosition\(\),\s*witnessMarker\.position\s*\)\s*\)/);
  const acknowledgement = interaction.indexOf('acknowledgeWitnessChronicleLine(');
  const battleNavigation = interaction.indexOf('window.location.href = `battle.html?', exactGate);
  assert.ok(markerLookup >= 0 && exactGate > markerLookup, 'witness work must be gated by its exact current map marker');
  assert.ok(acknowledgement > exactGate, 'testimony acknowledgement must occur inside the exact marker gate');
  assert.ok(battleNavigation > exactGate, 'battle navigation must occur inside the exact marker gate');
  assert.match(interaction, /if\s*\(\s*!progress\.dialogueComplete\s*\)/);
  assert.match(interaction, /if\s*\(\s*isChoiceStage\s*&&\s*!selectedWitnessChoiceId\s*\)/);

  for (const exactParameter of [
    /encounter\s*:\s*stage\.encounterId/,
    /return\s*:\s*['\"]campaign\.html['\"]/,
    /beat\s*:\s*beat\.id/,
    /chronicle\s*:\s*chronicle\.id/,
    /chronicleStage\s*:\s*stage\.id/,
  ]) assert.match(interaction, exactParameter);
  assert.match(interaction, /parameters\.set\(\s*['\"]chronicleChoice['\"]\s*,\s*selectedWitnessChoiceId\s*\)/);
  assert.match(interaction, /advanceWitnessChronicle\(\s*witnessChronicleState\s*,\s*chronicle\.id\s*,\s*stage\.id\s*,\s*evidence\s*\)/);
  assert.match(interaction, /commitStateChanges\('Witness stage',[\s\S]*?adapter: witnessAdapter[\s\S]*?nextState: advanced\.state/);
});

test('New Game and browser lifecycle clear, reload, and save witness progress', () => {
  const reset = sourceSection(
    campaignSource,
    "resetCampaign.addEventListener('click'",
    "window.addEventListener('keydown'",
  );
  assert.match(reset, /const\s+nextWitnessState\s*=\s*createWitnessChronicleState\(\s*\)/);
  assert.match(reset, /selectedWitnessChronicleId\s*=\s*null/);
  assert.match(reset, /selectedWitnessChoiceId\s*=\s*null/);
  assert.match(reset, /commitStateChanges\('New Game',[\s\S]*?adapter: witnessAdapter[\s\S]*?nextState: nextWitnessState/);

  const pageshow = sourceSection(
    campaignSource,
    "window.addEventListener('pageshow'",
    "window.addEventListener('pagehide'",
  );
  assert.match(pageshow, /if\s*\(\s*!event\.persisted\s*\)\s*return/);
  assert.match(pageshow, /const\s+refreshedWitnessChronicles\s*=\s*witnessAdapter\.load\(\s*\)/);
  assert.match(pageshow, /if\s*\(\s*refreshedWitnessChronicles\.ok\s*\)\s*witnessChronicleState\s*=\s*refreshedWitnessChronicles\.state/);
  assert.match(pageshow, /render\(\s*\)/);

  const pagehide = sourceSection(
    campaignSource,
    "window.addEventListener('pagehide'",
    "document.addEventListener('visibilitychange'",
  );
  assert.match(pagehide, /witnessAdapter\.save\(\s*witnessChronicleState\s*\)/);
});

test('battle consumes the exact handoff and advances a chronicle only after victory', () => {
  const browserNames = importedNames(battleSource, './witness-chronicle-runtime.mjs');
  assert.equal(browserNames.has('createWitnessChronicleStorageAdapter'), true);
  const settlementNames = importedNames(battleSettlementSource, './witness-chronicle-runtime.mjs');
  for (const required of ['advanceWitnessChronicle', 'getWitnessChronicleProgress']) {
    assert.equal(settlementNames.has(required), true, `battle-settlement.mjs must import ${required}`);
  }
  assert.match(battleSource, /const\s+requestedChronicleId\s*=\s*query\.get\(\s*['\"]chronicle['\"]\s*\)/);
  assert.match(battleSource, /const\s+requestedChronicleStageId\s*=\s*query\.get\(\s*['\"]chronicleStage['\"]\s*\)/);
  assert.match(battleSource, /const\s+requestedChronicleChoiceId\s*=\s*query\.get\(\s*['\"]chronicleChoice['\"]\s*\)/);

  const victorySettlement = sourceSection(
    battleSource,
    'function recordVictoryIfNeeded',
    'function renderSpeedControls',
  );
  const victoryGate = victorySettlement.search(/if\s*\(\s*snapshot\.result\s*!==\s*['\"]victory['\"]\s*\)\s*return false;[\s\S]*?if\s*\(\s*rewardRecorded\s*\)\s*return true/);
  const settleCall = victorySettlement.indexOf('settleBattleVictory({');
  assert.ok(victoryGate >= 0 && settleCall > victoryGate, 'chronicle handoff must remain inside victory settlement');
  assert.match(victorySettlement, /chronicleId\s*:\s*requestedChronicleId/);
  assert.match(victorySettlement, /chronicleStageId\s*:\s*requestedChronicleStageId/);
  assert.match(victorySettlement, /chronicleChoiceId\s*:\s*requestedChronicleChoiceId/);
  assert.match(battleSettlementSource, /if\s*\(\s*handoff\.chronicleId\s*&&\s*handoff\.chronicleStageId\s*\)/);
  assert.match(battleSettlementSource, /encounterId\s*:\s*encounter\.id/);
  assert.match(battleSettlementSource, /victory\s*:\s*true/);
  assert.match(battleSettlementSource, /handoff\.chronicleChoiceId\s*\?\s*\{\s*choiceId\s*:\s*handoff\.chronicleChoiceId\s*\}\s*:\s*\{\s*\}/);
  assert.match(battleSettlementSource, /advanceWitnessChronicle\(\s*[\s\S]*?handoff\.chronicleId\s*,\s*handoff\.chronicleStageId\s*,\s*evidence\s*,?\s*\)/);
  assert.match(battleSettlementSource, /if\s*\(\s*witnessResult\.ok\s*\)\s*\{\s*changes\.push\(\{\s*id:\s*['"]witness['"]/);
  assert.match(battleSettlementSource, /commitPersistenceTransaction\(changes\.map/);
  assert.doesNotMatch(battleSettlementSource, /adapters\.witness\.save\(/);
  assert.equal((battleSettlementSource.match(/advanceWitnessChronicle\s*\(/g) ?? []).length, 1,
    'settlement must have one guarded chronicle transition site');
});

test('a non-combat chronicle acknowledges every line, chooses explicitly, rewards once, and refuses replay', () => {
  const entry = WITNESS_CHRONICLES.find((candidate) => candidate.stages.every((stage) => stage.encounterId === null));
  assert.ok(entry, 'catalog needs a wholly non-combat chronicle');
  const option = entry.choice.options[1];
  let state = createWitnessChronicleState();
  assert.equal(getWitnessChronicleAvailability(state, entry.id, openContext(entry)).available, true);
  state = acceptWitnessChronicle(state, entry.id, openContext(entry)).state;

  for (const stage of entry.stages) {
    const premature = advanceWitnessChronicle(state, entry.id, stage.id);
    assert.equal(premature.ok, false);
    assert.equal(premature.state, state);
    state = acknowledgeCurrentStage(state, entry);

    const encounterSpoof = advanceWitnessChronicle(state, entry.id, stage.id, {
      encounterId: 'not-part-of-this-stage',
      victory: true,
      ...(entry.choice.stageId === stage.id ? { choiceId: option.id } : {}),
    });
    assert.equal(encounterSpoof.ok, false);
    assert.equal(encounterSpoof.state, state);
    assert.match(encounterSpoof.reason, /Non-combat stage does not accept encounter evidence/);

    const evidence = entry.choice.stageId === stage.id ? { choiceId: option.id } : {};
    const advanced = advanceWitnessChronicle(state, entry.id, stage.id, evidence);
    assert.equal(advanced.ok, true, advanced.reason);
    state = advanced.state;
  }

  assert.equal(getWitnessChronicleProgress(state, entry.id).readyToComplete, true);
  const completed = completeWitnessChronicle(state, entry.id);
  assertOneTimeReward(completed, entry, option);
  state = completed.state;
  const duplicateCompletion = completeWitnessChronicle(state, entry.id);
  assert.equal(duplicateCompletion.ok, false);
  assert.equal(duplicateCompletion.state, state);
  const replay = acceptWitnessChronicle(state, entry.id, openContext(entry));
  assert.equal(replay.ok, false);
  assert.equal(replay.state, state);
  assert.match(replay.reason, /finite and already complete/);
});

test('a combat chronicle rejects false evidence, accepts its exact victory, rewards once, and refuses replay', () => {
  const entry = WITNESS_CHRONICLES.find((candidate) => candidate.stages.some((stage) => stage.encounterId));
  assert.ok(entry, 'catalog needs a combat chronicle');
  const option = entry.choice.options[0];
  let state = acceptWitnessChronicle(createWitnessChronicleState(), entry.id, openContext(entry)).state;
  let verifiedCombatStages = 0;

  for (const stage of entry.stages) {
    state = acknowledgeCurrentStage(state, entry);
    const choiceEvidence = entry.choice.stageId === stage.id ? { choiceId: option.id } : {};
    if (stage.encounterId) {
      for (const invalidEvidence of [
        choiceEvidence,
        { encounterId: `${stage.encounterId}-wrong`, victory: true, ...choiceEvidence },
        { encounterId: stage.encounterId, victory: false, ...choiceEvidence },
      ]) {
        const rejected = advanceWitnessChronicle(state, entry.id, stage.id, invalidEvidence);
        assert.equal(rejected.ok, false);
        assert.equal(rejected.state, state);
        assert.match(rejected.reason, new RegExp(`requires victory in ${escapeRegExp(stage.encounterId)}`));
      }
      const advanced = advanceWitnessChronicle(state, entry.id, stage.id, {
        encounterId: stage.encounterId,
        victory: true,
        ...choiceEvidence,
      });
      assert.equal(advanced.ok, true, advanced.reason);
      state = advanced.state;
      verifiedCombatStages += 1;
    } else {
      const advanced = advanceWitnessChronicle(state, entry.id, stage.id, choiceEvidence);
      assert.equal(advanced.ok, true, advanced.reason);
      state = advanced.state;
    }
  }

  assert.ok(verifiedCombatStages >= 1);
  const completed = completeWitnessChronicle(state, entry.id);
  assertOneTimeReward(completed, entry, option);
  state = completed.state;
  const duplicateCompletion = completeWitnessChronicle(state, entry.id);
  assert.equal(duplicateCompletion.ok, false);
  assert.equal(duplicateCompletion.state, state);
  const replay = acceptWitnessChronicle(state, entry.id, openContext(entry));
  assert.equal(replay.ok, false);
  assert.equal(replay.state, state);
  assert.match(replay.reason, /finite and already complete/);
});
