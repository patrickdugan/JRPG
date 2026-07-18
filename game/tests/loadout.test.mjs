import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMP_CATALOGUE,
  ITEM_CATALOGUE,
  VOW_CATALOGUE,
  applyLoadoutToPartyProfile,
  buyItem,
  createLoadoutStorageAdapter,
  createLoadoutState,
  equipItem,
  equipVow,
  getCharacterSummary,
  getLoadoutModifiers,
  grantInventory,
  hydrateLoadoutState,
  learnVow,
  restAtCamp,
  sellItem,
  serializeLoadoutState,
  setMemberVitals,
  syncPartyVitals,
  unequipItem,
  upgradeItem,
  useConsumable,
  validateLoadoutPayload,
} from '../loadout.mjs';

test('catalogues provide original gear, consumables, Vows, and three camp tiers', () => {
  assert.ok(Object.keys(ITEM_CATALOGUE).length >= 20);
  assert.ok(Object.keys(VOW_CATALOGUE).length >= 10);
  assert.deepEqual(Object.keys(CAMP_CATALOGUE), ['roadside-lantern', 'lantern-safehouse', 'hidden-infirmary']);
  assert.equal(ITEM_CATALOGUE['dawnsteel-blade'].kind, 'equipment');
  assert.equal(ITEM_CATALOGUE['river-salve'].effect.hp, 80);
});

test('new state is immutable, canonical, and round-trips byte-for-byte', () => {
  const state = createLoadoutState();
  assert.equal(state.campaignId, 'bells-black-chrysanthemum');
  assert.equal(state.currency, 80);
  assert.equal(state.equipment.ren.weapon, 'courier-saber');
  assert.equal(Object.isFrozen(state.vitals.ren), true);
  const serialized = serializeLoadoutState(state);
  const hydrated = hydrateLoadoutState(serialized);
  assert.equal(hydrated.ok, true, hydrated.errors?.join(' '));
  assert.equal(serializeLoadoutState(hydrated.value), serialized);
  assert.equal(validateLoadoutPayload({ ...state, currency: -1 }).ok, false);
  assert.equal(hydrateLoadoutState('{broken').ok, false);
});

test('injectable storage adapter loads defaults, saves, reloads, and clears', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const adapter = createLoadoutStorageAdapter(storage, 'test.loadout');
  assert.equal(adapter.load().source, 'default');
  const state = buyItem(createLoadoutState(), 'traveler-plum').state;
  assert.equal(adapter.save(state).ok, true);
  const loaded = adapter.load();
  assert.equal(loaded.source, 'storage');
  assert.equal(loaded.value.inventory['traveler-plum'], 1);
  assert.equal(adapter.clear().ok, true);
  assert.equal(values.size, 0);
});

test('inventory grants recognize advancement and field reward names and report unknown loot', () => {
  const start = createLoadoutState();
  const result = grantInventory(start, { currency: 120, items: [{ name: 'River Salve', quantity: 2 }, { name: 'Cedar Route Note', quantity: 1 }, { name: 'Temple Charm', quantity: 1 }, 'Uncatalogued Token'] });
  assert.equal(result.ok, true);
  assert.equal(result.state.currency, 200);
  assert.equal(result.state.inventory['river-salve'], 5);
  assert.equal(result.state.inventory['cedar-route-note'], 1);
  assert.equal(result.state.inventory['temple-charm'], 1);
  assert.deepEqual(result.receipt.unknown, ['Uncatalogued Token']);
  assert.equal(start.inventory['river-salve'], 3);
});

test('shop failures are atomic and successful buy/sell transactions are exact', () => {
  const start = createLoadoutState();
  const tooExpensive = buyItem(start, 'dawnsteel-blade');
  assert.equal(tooExpensive.ok, false);
  assert.equal(tooExpensive.state, start);
  const bought = buyItem(start, 'river-salve', 2);
  assert.equal(bought.ok, true);
  assert.equal(bought.state.currency, 24);
  assert.equal(bought.state.inventory['river-salve'], 5);
  const sold = sellItem(bought.state, 'river-salve', 2);
  assert.equal(sold.ok, true);
  assert.equal(sold.state.currency, 52);
  assert.equal(sold.state.inventory['river-salve'], 3);
});

test('equipping swaps inventory safely and respects character restrictions', () => {
  const start = createLoadoutState();
  const denied = equipItem(start, 'aya', 'pilgrim-knife');
  assert.equal(denied.ok, true);
  assert.equal(denied.state.equipment.aya.weapon, 'pilgrim-knife');
  assert.equal(denied.state.inventory['warding-brush'], 1);
  const restricted = equipItem(denied.state, 'aya', 'courier-saber');
  assert.equal(restricted.ok, false);
  const unequipped = unequipItem(denied.state, 'aya', 'weapon');
  assert.equal(unequipped.ok, true);
  assert.equal(unequipped.state.equipment.aya.weapon, null);
  assert.equal(unequipped.state.inventory['pilgrim-knife'], 1);
});

test('global forge upgrades are paid, capped, and reflected in deterministic modifiers', () => {
  let state = grantInventory(createLoadoutState(), { currency: 1000 }).state;
  const before = getLoadoutModifiers(state, 'ren');
  const upgraded = upgradeItem(state, 'courier-saber');
  assert.equal(upgraded.ok, true);
  state = upgraded.state;
  const after = getLoadoutModifiers(state, 'ren');
  assert.equal(after.stats.power, before.stats.power + 2);
  assert.equal(state.upgrades['courier-saber'], 1);
  for (let i = 1; i < 3; i += 1) state = upgradeItem(state, 'courier-saber').state;
  const capped = upgradeItem(state, 'courier-saber');
  assert.equal(capped.ok, false);
  assert.equal(capped.state.upgrades['courier-saber'], 3);
});

test('Vows have two slots, require learning, and combine resistance probabilities', () => {
  let state = createLoadoutState();
  const locked = equipVow(state, 'ren', 'clear-morning');
  assert.equal(locked.ok, false);
  state = grantInventory(state, { currency: 500 }).state;
  state = learnVow(state, 'clear-morning').state;
  state = equipVow(state, 'ren', 'clear-morning').state;
  const full = equipVow(state, 'ren', 'shared-burden');
  assert.equal(full.ok, false);
  const modifiers = getLoadoutModifiers(state, 'ren');
  assert.equal(modifiers.statusResistance.dread, 0.4);
  assert.equal(modifiers.resistances.essence.umbral, 0.8);
  assert.equal(getCharacterSummary(state, 'ren').openVowSlots, 0);
});

test('consumables heal and clear statuses without being wasted at full effect', () => {
  let state = createLoadoutState();
  const wasted = useConsumable(state, 'river-salve', 'ren');
  assert.equal(wasted.ok, false);
  state = setMemberVitals(state, 'ren', { hp: 10, statuses: ['bound', 'dread', 'silenced'] }).state;
  const salve = useConsumable(state, 'river-salve', 'ren');
  assert.equal(salve.ok, true);
  assert.equal(salve.state.vitals.ren.hp, 90);
  const tonic = useConsumable(salve.state, 'ward-tonic', 'ren');
  assert.equal(tonic.ok, true);
  assert.deepEqual(tonic.state.vitals.ren.statuses, ['dread']);
});

test('camp rests are deterministic, partial or full, and never charge on failure', () => {
  let state = createLoadoutState();
  state = setMemberVitals(state, 'ren', { hp: 1, mp: 1, spirit: 1, statuses: ['burn', 'dread'] }).state;
  const roadside = restAtCamp(state, 'roadside-lantern', ['ren']);
  assert.equal(roadside.ok, true);
  assert.equal(roadside.state.vitals.ren.hp, 52);
  assert.deepEqual(roadside.state.vitals.ren.statuses, ['burn', 'dread']);
  const infirmary = restAtCamp(roadside.state, 'hidden-infirmary', ['ren']);
  assert.equal(infirmary.ok, true);
  assert.equal(infirmary.state.currency, 10);
  assert.equal(infirmary.state.vitals.ren.hp, infirmary.state.vitals.ren.maxHp);
  assert.deepEqual(infirmary.state.vitals.ren.statuses, []);
  const repeat = restAtCamp(infirmary.state, 'hidden-infirmary', ['ren']);
  assert.equal(repeat.ok, false);
  assert.equal(repeat.state.currency, 10);
});

test('advancement caps sync without erasing damage and combat profile adapter is compatible', () => {
  let state = createLoadoutState();
  state = setMemberVitals(state, 'ren', { hp: 50 }).state;
  const synced = syncPartyVitals(state, [{ id: 'ren', stats: { hp: 150, mp: 40, arcana: 20 } }]);
  assert.equal(synced.ok, true);
  assert.equal(synced.state.vitals.ren.maxHp, 168); // 150 advancement HP + 18 from the road haori
  assert.equal(synced.state.vitals.ren.hp, 114); // preserves 54 damage from the old 104 cap
  const profile = {
    id: 'ren', name: 'Ren', stats: { hp: 118, power: 12, guard: 10, speed: 104 },
    skillIds: ['courier-cut'],
    resistances: { delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 }, essence: { ember: 1, frost: 1, storm: 1, radiance: 1, umbral: 1 } },
  };
  const adapted = applyLoadoutToPartyProfile(profile, state);
  assert.equal(adapted.stats.hp, 136);
  assert.equal(adapted.stats.power, 18);
  assert.equal(adapted.stats.speed, 112);
  assert.deepEqual(profile.skillIds, ['courier-cut']);
  assert.equal(Object.isFrozen(adapted.loadout), true);
});
