import assert from 'node:assert/strict';
import test from 'node:test';

import {
  benchmarkRepeatBattleSpeeds,
  chooseRepeatBattleCommand,
  executeRepeatBattleCommand,
  getRepeatStepDelayMs,
  REPEAT_LOOP_PRESENTATION_MS,
  REPEAT_BATTLE_SPEEDS,
  resolveBattlePresentationSpeed,
  runRepeatBattle,
} from '../repeat-battle.mjs';
import { CampaignCombatEngine, PARTY_PROFILES } from '../campaign-combat.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import {
  createAdvancementState,
  createAdvancementStorageAdapter,
  getEncounterRewardPreview,
  getPartyMember,
  preparePartyForEncounter,
  recordEncounterWin,
  setSpeedMultiplier,
} from '../advancement.mjs';
import {
  applyLoadoutToPartyProfile,
  createLoadoutState,
  grantInventory,
} from '../loadout.mjs';

const ENCOUNTER_ID = 'c1-ash-wisps';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('saved 1x/2x/4x preferences apply only at an encounter replay boundary', () => {
  for (const selectedSpeed of REPEAT_BATTLE_SPEEDS) {
    const storage = new MemoryStorage();
    const key = `repeat-speed-${selectedSpeed}`;
    const writer = createAdvancementStorageAdapter(storage, key);
    let state = recordEncounterWin(createAdvancementState(), ENCOUNTER_ID);
    state = setSpeedMultiplier(state, selectedSpeed);
    assert.deepEqual(writer.save(state), { ok: true });

    const reloaded = createAdvancementStorageAdapter(storage, key).load();
    assert.equal(reloaded.ok, true);
    assert.equal(reloaded.found, true);
    assert.equal(reloaded.state.speedMultiplier, selectedSpeed);
    assert.equal(resolveBattlePresentationSpeed(1, reloaded.state.speedMultiplier), selectedSpeed);
    assert.equal(resolveBattlePresentationSpeed(0, reloaded.state.speedMultiplier), 1, 'another encounter first clear remains 1x');
  }
  assert.throws(() => resolveBattlePresentationSpeed(-1, 1), /priorWins/);
  assert.throws(() => resolveBattlePresentationSpeed(1, 3), /must be 1, 2, or 4/);
});

test('repeat automation is unavailable before a canonical first clear', () => {
  assert.throws(
    () => runRepeatBattle({ encounterId: ENCOUNTER_ID, priorWins: 0 }),
    /at least one prior win/,
  );
});

test('a deterministic repeat policy clears an authored grind encounter', () => {
  const run = runRepeatBattle({ encounterId: ENCOUNTER_ID, priorWins: 1 });
  assert.equal(run.result, 'victory');
  assert.equal(run.reward.repeat, true);
  assert.ok(run.decisions.some((decision) => decision.type === 'skill'));
  assert.equal(run.decisions.some((decision) => decision.type === 'item'), false, 'repeat policy never selects Item');
  assert.equal(run.combatLog.some((event) => event.type === 'item-used'), false, 'repeat traces never consume inventory');
  assert.ok(run.timeline.some((event) => event.type === 'enemyActivation'));
  assert.ok(run.timeline.some((event) => event.type === 'recovery'));
  assert.equal(run.simulatedDurationMs, run.baseDurationMs);
});

test('repeat automation can execute bounded Dodge without selecting it in the aggressive policy', () => {
  const engine = new CampaignCombatEngine({ encounterId: 'c1-cinder-hounds' });
  const actorId = engine.activeActorId;
  assert.notEqual(chooseRepeatBattleCommand(engine)?.type, 'dodge');
  assert.equal(REPEAT_LOOP_PRESENTATION_MS.dodge, 400);
  assert.equal(getRepeatStepDelayMs('dodge', 1), 400);
  assert.equal(getRepeatStepDelayMs('dodge', 4), 100);

  const result = executeRepeatBattleCommand(engine, actorId, { type: 'dodge' });
  assert.deepEqual(result, { ok: true, stance: 'dodge', recoveryPulses: 1 });
  assert.equal(engine.getActor(actorId).stance, 'dodge');
  assert.equal(engine.log.some((entry) => entry.type === 'dodge'
    && entry.actorId === actorId && entry.recoveryPulses === 1), true);
  assert.equal(engine.log.some((entry) => entry.type === 'commit'
    && entry.actorId === actorId && entry.command === 'dodge'), true);
  assert.match(
    executeRepeatBattleCommand(engine, actorId, { type: 'unsupported' }).reason,
    /Unsupported repeat command/,
  );
});

test('repeat chooser remains Item-free even when usable River Salve stock is available', () => {
  const engine = new CampaignCombatEngine({
    encounterId: 'c1-cinder-hounds',
    itemStock: { 'river-salve': 3 },
  });
  const actor = engine.getActor(engine.activeActorId);
  actor.hp = Math.max(1, actor.maxHp - 20);
  assert.equal(engine.getAvailableCommands().includes('item'), true);
  assert.equal(engine.getBattleItemQuote(actor.instanceId, 'river-salve', actor.instanceId).usable, true);
  assert.notEqual(chooseRepeatBattleCommand(engine)?.type, 'item');
});

test('1x, 2x, and 4x schedule the whole identical repeat loop at proven ratios', () => {
  const benchmark = benchmarkRepeatBattleSpeeds({ encounterId: ENCOUNTER_ID, priorWins: 2 });
  assert.deepEqual(REPEAT_BATTLE_SPEEDS, [1, 2, 4]);
  assert.equal(benchmark.verified, true);
  assert.equal(benchmark.decisionsAndRewardsInvariant, true);
  assert.equal(benchmark.timingVerified, true);
  assert.deepEqual(benchmark.ratios, { 1: 1, 2: 2, 4: 4 });
  const [normal, double, quadruple] = benchmark.runs;
  assert.deepEqual(double.decisions, normal.decisions);
  assert.deepEqual(quadruple.combatLog, normal.combatLog);
  assert.deepEqual(quadruple.reward, normal.reward);
  assert.equal(normal.simulatedDurationMs, double.simulatedDurationMs * 2);
  assert.equal(normal.simulatedDurationMs, quadruple.simulatedDurationMs * 4);
  for (const event of quadruple.timeline) assert.equal(event.scheduledMs, event.baseMs / 4);
});

test('unsupported speed multipliers are rejected instead of silently approximated', () => {
  assert.throws(
    () => runRepeatBattle({ encounterId: ENCOUNTER_ID, priorWins: 1, speedMultiplier: 3 }),
    /must be 1, 2, or 4/,
  );
  assert.equal(getRepeatStepDelayMs('skill', 4, 2), 520);
  assert.equal(getRepeatStepDelayMs('analyze', 4), 120);
  assert.throws(() => getRepeatStepDelayMs('unknown', 1), /Unknown repeat presentation step/);
});

function canonicalRestedProfiles(encounter, advancementState, loadoutState) {
  return Object.fromEntries(encounter.party.roster.map((memberId) => {
    const base = PARTY_PROFILES[memberId];
    const member = getPartyMember(advancementState, memberId);
    const adapted = applyLoadoutToPartyProfile({
      ...base,
      stats: {
        hp: member.stats.hp,
        power: Math.max(member.stats.power, member.stats.arcana),
        guard: member.stats.guard,
        speed: member.stats.speed,
      },
    }, loadoutState, memberId);
    return [memberId, { ...adapted, currentHp: adapted.stats.hp }];
  }));
}

test('Auto-Grind clears every canonical encounter with exact 1x/2x/4x invariance', async (t) => {
  let advancementState = createAdvancementState();
  let loadoutState = createLoadoutState();
  for (const encounter of ENCOUNTERS) {
    advancementState = preparePartyForEncounter(advancementState, encounter.id);
    const reward = getEncounterRewardPreview(encounter.id, 0);
    advancementState = recordEncounterWin(advancementState, encounter.id, { partyIds: encounter.party.roster });
    const granted = grantInventory(loadoutState, { currency: reward.currency, items: reward.items });
    assert.equal(granted.ok, true);
    loadoutState = granted.state;
    const options = {
      encounterId: encounter.id,
      priorWins: 1,
      partyProfiles: canonicalRestedProfiles(encounter, advancementState, loadoutState),
    };
    const benchmark = benchmarkRepeatBattleSpeeds(options);
    const [normal, double, quadruple] = benchmark.runs;
    await t.test(encounter.id, () => {
      assert.equal(benchmark.verified, true);
      assert.equal(benchmark.decisionsAndRewardsInvariant, true);
      assert.equal(benchmark.timingVerified, true);
      assert.deepEqual(benchmark.ratios, { 1: 1, 2: 2, 4: 4 });
      assert.equal(normal.result, 'victory');
      assert.equal(double.result, 'victory');
      assert.equal(quadruple.result, 'victory');
      assert.deepEqual(double.decisions, normal.decisions);
      assert.deepEqual(quadruple.combatLog, normal.combatLog);
      assert.deepEqual(quadruple.reward, normal.reward);
      assert.equal(normal.decisions.some((decision) => decision.type === 'item'), false, 'Auto-Grind remains Item-free');
      assert.equal(normal.combatLog.some((event) => event.type === 'item-used'), false, 'Auto-Grind has no item consumption log');
    });
  }
});
