import assert from 'node:assert/strict';
import test from 'node:test';

import {
  benchmarkRepeatBattleSpeeds,
  getRepeatStepDelayMs,
  REPEAT_BATTLE_SPEEDS,
  resolveBattlePresentationSpeed,
  runRepeatBattle,
} from '../repeat-battle.mjs';
import { PARTY_PROFILES } from '../campaign-combat.mjs';
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
  assert.ok(run.timeline.some((event) => event.type === 'enemyActivation'));
  assert.ok(run.timeline.some((event) => event.type === 'recovery'));
  assert.equal(run.simulatedDurationMs, run.baseDurationMs);
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

test('Auto-Grind clears every canonical encounter from its leveled full-rest repeat state', async (t) => {
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
    const first = runRepeatBattle(options);
    const replay = runRepeatBattle(options);
    await t.test(encounter.id, () => {
      assert.equal(first.result, 'victory');
      assert.deepEqual(replay.decisions, first.decisions);
      assert.deepEqual(replay.reward, first.reward);
    });
  }
});
