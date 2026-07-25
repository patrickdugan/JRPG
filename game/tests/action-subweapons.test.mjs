import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceActionCampaignBattle,
  createActionCampaignBattleSession,
  getActionCampaignAttackChoices,
  snapshotActionCampaignBattle,
} from '../action-campaign-battle-model.mjs';
import { calculateActionDamage } from '../action-combat.mjs';
import { ACTION_SUBWEAPONS, createActionSubweaponStock } from '../action-subweapons.mjs';
import { createAdvancementState } from '../advancement.mjs';
import { createLoadoutState } from '../loadout.mjs';

test('holy subweapons are finite session-local stock and remain outside ordinary attack selection', () => {
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: createAdvancementState(),
    loadoutState: createLoadoutState(),
    fighterActorIds: ['lise', 'mateus'],
  });
  let snapshot = snapshotActionCampaignBattle(session);
  assert.deepEqual(Object.fromEntries(snapshot.subweapons.map(({ id, stock }) => [id, stock])), {
    'holy-water': 3,
    'throwing-cross': 2,
  });
  assert.equal(getActionCampaignAttackChoices(session).every(({ id }) => !id.startsWith('subweapon:')), true);

  snapshot = advanceActionCampaignBattle(session, 0, { subweaponPressed: 'holy-water' });
  assert.equal(snapshot.subweapons.find(({ id }) => id === 'holy-water').stock, 2);
  assert.equal(snapshot.recentEvents.some(({ type, subweaponId }) => (
    type === 'subweapon-used' && subweaponId === 'holy-water'
  )), true);

  snapshot = advanceActionCampaignBattle(session, 0, { subweaponPressed: 'throwing-cross' });
  assert.equal(snapshot.subweapons.find(({ id }) => id === 'throwing-cross').stock, 2);
  assert.equal(snapshot.recentEvents.some(({ type, reason }) => (
    type === 'subweapon-blocked' && reason === 'animation-commitment'
  )), true);
  assert.deepEqual(createActionSubweaponStock(), { 'holy-water': 3, 'throwing-cross': 2 });
});

test('holy water is the close armor answer while the cross pays for reach and Radiance weakness is explicit', () => {
  const attacker = { power: 20 };
  const target = (radiance) => ({
    guard: 15,
    resistances: {
      delivery: { cut: 1, pierce: 1, arcane: 1 },
      essence: { radiance },
    },
  });
  const weapon = { power: 10, delivery: 'cut', essence: null };
  const holyWater = ACTION_SUBWEAPONS['holy-water'].attack;
  const cross = ACTION_SUBWEAPONS['throwing-cross'].attack;

  assert.equal(calculateActionDamage(attacker, target(1), weapon).damage, 24);
  assert.equal(calculateActionDamage(attacker, target(1), holyWater).damage, 30);
  assert.equal(calculateActionDamage(attacker, target(1), cross).damage, 20);
  assert.equal(calculateActionDamage(attacker, target(1.25), holyWater).damage, 38);
  assert.equal(calculateActionDamage(attacker, target(1.25), cross).damage, 25);
});

test('holy water requires the ground while the throwing cross remains available in the air', () => {
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: createAdvancementState(),
    loadoutState: createLoadoutState(),
    fighterActorIds: ['lise', 'mateus'],
  });
  const actor = session.kernel.getActor(session.kernel.snapshot().controlledActorId);
  actor.grounded = false;
  actor.position.y -= 20;
  let snapshot = advanceActionCampaignBattle(session, 0, { subweaponPressed: 'holy-water' });
  assert.equal(snapshot.subweapons.find(({ id }) => id === 'holy-water').stock, 3);
  assert.equal(snapshot.recentEvents.some(({ type, reason }) => (
    type === 'subweapon-blocked' && reason === 'requires-ground'
  )), true);

  snapshot = advanceActionCampaignBattle(session, 0, { subweaponPressed: 'throwing-cross' });
  assert.equal(snapshot.subweapons.find(({ id }) => id === 'throwing-cross').stock, 1);
});
