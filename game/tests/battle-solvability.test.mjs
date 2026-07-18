import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PARTY_PROFILES,
  CampaignCombatEngine,
} from '../campaign-combat.mjs';
import { solveCampaignCombat } from '../battle-solver.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import {
  createAdvancementState,
  getEncounterRewardPreview,
  getParty,
  getPartyMember,
  preparePartyForEncounter,
  recordEncounterWin,
} from '../advancement.mjs';
import {
  applyLoadoutToPartyProfile,
  createLoadoutState,
  grantInventory,
  syncPartyVitals,
} from '../loadout.mjs';

function canonicalProfiles(encounter, advancementState, loadoutState) {
  const profiles = {};
  for (const memberId of encounter.party.roster) {
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
    profiles[memberId] = { ...adapted, currentHp: loadoutState.vitals[memberId].hp };
  }
  return profiles;
}

function failureSummary(solution) {
  const livingParty = solution.snapshot.actors
    .filter((actor) => actor.faction === 'party' && actor.hp > 0)
    .map((actor) => `${actor.instanceId}:${actor.hp}/${actor.maxHp}`)
    .join(', ') || 'none';
  const livingEnemies = solution.snapshot.actors
    .filter((actor) => actor.faction === 'enemy' && actor.hp > 0)
    .map((actor) => `${actor.instanceId}:${actor.hp}/${actor.maxHp}`)
    .join(', ') || 'none';
  const remaining = solution.snapshot.objective.requirements
    .filter((requirement) => !requirement.complete)
    .map((requirement) => `${requirement.key}:${requirement.progress}/${requirement.count}`)
    .join(', ') || 'none';
  return `reason=${solution.reason}; commands=${solution.playerCommands}; enemyActivations=${solution.enemyActivations}; party=${livingParty}; enemies=${livingEnemies}; remaining=${remaining}`;
}

test('all canonical encounters have a deterministic valid first-clear victory trace', async (t) => {
  let advancementState = createAdvancementState();
  let loadoutState = createLoadoutState();

  for (const encounter of ENCOUNTERS) {
    advancementState = preparePartyForEncounter(advancementState, encounter.id);
    const synced = syncPartyVitals(loadoutState, getParty(advancementState));
    assert.equal(synced.ok, true, `${encounter.id} canonical vitality sync`);
    loadoutState = synced.state;

    const engine = new CampaignCombatEngine({
      encounterId: encounter.id,
      partyProfiles: canonicalProfiles(encounter, advancementState, loadoutState),
    });
    const first = solveCampaignCombat(engine);
    const replay = solveCampaignCombat(new CampaignCombatEngine({
      encounterId: encounter.id,
      partyProfiles: canonicalProfiles(encounter, advancementState, loadoutState),
    }));

    await t.test(encounter.id, () => {
      assert.equal(first.solved, true, failureSummary(first));
      assert.ok(first.trace.some((entry) => ['skill', 'objective', 'guard'].includes(entry.type)), 'trace must contain an accepted committing command');
      assert.deepEqual(replay.trace, first.trace, 'solver trace must be deterministic');
      assert.equal(replay.result, 'victory');
    });

    const reward = getEncounterRewardPreview(encounter.id, 0);
    advancementState = recordEncounterWin(advancementState, encounter.id, { partyIds: encounter.party.roster });
    const granted = grantInventory(loadoutState, { currency: reward.currency, items: reward.items });
    assert.equal(granted.ok, true, `${encounter.id} canonical loadout reward`);
    loadoutState = granted.state;
  }
});

