import test from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS } from '../content/encounters.mjs';

import {
  ADVANCEMENT_SCHEMA_VERSION,
  CAMPAIGN_PACING,
  MAX_MEMBER_XP,
  PARTY_MEMBER_IDS,
  createAdvancementState,
  createAdvancementStorageAdapter,
  grantRewardBundle,
  getAdvancementSummary,
  getChapterLevelTarget,
  getEncounterRewardPreview,
  getEncounterWinCount,
  getPacingEstimate,
  getParty,
  getPartyMember,
  levelForXp,
  loadAdvancementState,
  preparePartyForEncounter,
  recordEncounterWin,
  serializeAdvancementState,
  setSpeedMultiplier,
  unlockPartyMember,
  validateAdvancementPayload,
  xpForNextLevel,
  xpToReachLevel,
} from '../advancement.mjs';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('fresh advancement state tracks six canonical members and begins with Ren', () => {
  const state = createAdvancementState();

  assert.equal(state.schemaVersion, ADVANCEMENT_SCHEMA_VERSION);
  assert.deepEqual(PARTY_MEMBER_IDS, ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']);
  assert.equal(state.party.length, 6);
  assert.deepEqual(getParty(state, { unlockedOnly: true }).map(({ id }) => id), ['ren']);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.party), true);
});

test('XP curve, levels, and member stats are exact and predictable', () => {
  assert.equal(xpForNextLevel(1), 60);
  assert.equal(xpForNextLevel(2), 105);
  assert.equal(xpToReachLevel(1), 0);
  assert.equal(xpToReachLevel(3), 165);
  assert.equal(levelForXp(164), 2);
  assert.equal(levelForXp(165), 3);
  assert.equal(levelForXp(MAX_MEMBER_XP), 50);

  let state = createAdvancementState();
  state = recordEncounterWin(state, 'prologue-ashen-bailiff');
  const ren = getPartyMember(state, 'ren');
  assert.equal(ren.level, levelForXp(ren.xp));
  assert.equal(ren.stats.hp, 104 + (9 * (ren.level - 1)));
  assert.equal(ren.stats.power, 15 + (3 * (ren.level - 1)));
  assert.equal(ren.xpRemaining, xpToReachLevel(ren.level + 1) - ren.xp);
  assert.equal(Object.isFrozen(ren.stats), true);
});

test('unlocking a party member is immutable and idempotent', () => {
  const fresh = createAdvancementState();
  const unlocked = unlockPartyMember(fresh, 'aya');

  assert.notEqual(unlocked, fresh);
  assert.equal(getPartyMember(fresh, 'aya').unlocked, false);
  assert.equal(getPartyMember(unlocked, 'aya').unlocked, true);
  assert.equal(unlocked.revision, 1);
  const unchanged = unlockPartyMember(unlocked, 'aya');
  assert.deepEqual(unchanged, unlocked);
  assert.equal(unchanged.revision, unlocked.revision);
  assert.throws(() => unlockPartyMember(unlocked, 'unknown'), /Unknown party member/);
});

test('first clear awards authored loot while repeats diminish XP and cannot duplicate key items', () => {
  const firstPreview = getEncounterRewardPreview('c1-cinder-hounds', 0);
  const secondPreview = getEncounterRewardPreview('c1-cinder-hounds', 1);
  const thirdPreview = getEncounterRewardPreview('c1-cinder-hounds', 2);
  const floorPreview = getEncounterRewardPreview('c1-cinder-hounds', 9);

  assert.equal(firstPreview.repeat, false);
  assert.deepEqual(firstPreview.items, [{ name: 'River Salve', quantity: 1 }]);
  assert.equal(secondPreview.xpPerMember, Math.round(firstPreview.xpPerMember * 0.55));
  assert.equal(thirdPreview.xpPerMember, Math.round(firstPreview.xpPerMember * 0.35));
  assert.equal(floorPreview.xpPerMember, Math.round(firstPreview.xpPerMember * 0.2));
  assert.deepEqual(secondPreview.items, []);

  let state = createAdvancementState();
  state = recordEncounterWin(state, 'c1-cinder-hounds');
  const firstXp = getPartyMember(state, 'ren').xp;
  assert.equal(getPartyMember(state, 'aya').unlocked, true);
  assert.equal(state.inventory.items['River Salve'], 1);
  state = recordEncounterWin(state, 'c1-cinder-hounds');
  assert.equal(getEncounterWinCount(state, 'c1-cinder-hounds'), 2);
  assert.equal(getPartyMember(state, 'ren').xp, firstXp + secondPreview.xpPerMember);
  assert.equal(state.inventory.items['River Salve'], 1);

  state = recordEncounterWin(state, 'prologue-ashen-bailiff');
  state = recordEncounterWin(state, 'prologue-ashen-bailiff');
  assert.deepEqual(state.inventory.keyItems, ['Hot black bell fragment']);
});

test('custom active party shares XP only with selected canonical members', () => {
  let state = createAdvancementState();
  state = recordEncounterWin(state, 'c4-fog-nets', { partyIds: ['genta', 'kiku'] });

  assert.equal(getPartyMember(state, 'ren').xp, 0);
  assert.ok(getPartyMember(state, 'genta').xp > 0);
  assert.equal(getPartyMember(state, 'genta').xp, getPartyMember(state, 'kiku').xp);
  assert.deepEqual(getParty(state, { unlockedOnly: true }).map(({ id }) => id), ['ren', 'genta', 'kiku']);
  assert.throws(
    () => recordEncounterWin(state, 'c4-fog-nets', { partyIds: ['ren', 'ren'] }),
    /Duplicate active party member/,
  );
});

test('optional reward bundles atomically grant XP and inventory to every unlocked member', () => {
  const fresh = createAdvancementState();
  const reward = {
    xpPerMember: 100,
    currency: 25,
    items: [{ name: 'Ward Tonic', quantity: 1 }, { name: 'River Salve', quantity: 2 }],
    keyItems: ['Sayo\'s consent copy'],
  };
  const result = grantRewardBundle(fresh, reward);

  assert.equal(result.ok, true);
  assert.equal(result.state.revision, fresh.revision + 1);
  assert.equal(getPartyMember(result.state, 'ren').xp, 100);
  assert.equal(getPartyMember(result.state, 'aya').xp, 0, 'locked members do not receive default quest XP');
  assert.deepEqual(result.state.inventory, {
    currency: 25,
    items: { 'River Salve': 2, 'Ward Tonic': 1 },
    keyItems: ['Sayo\'s consent copy'],
  });
  assert.deepEqual(result.receipt.partyIds, ['ren']);
  assert.deepEqual(result.receipt.xpAwards, [{
    memberId: 'ren', before: 0, requested: 100, awarded: 100, after: 100, capped: false,
  }]);
  assert.deepEqual(result.receipt.currency, { before: 0, awarded: 25, after: 25 });
  assert.equal(result.receipt.revision, result.state.revision);
  assert.equal(Object.isFrozen(result.receipt), true);
  assert.equal(getPartyMember(fresh, 'ren').xp, 0, 'the source state remains unchanged');
});

test('optional reward targeting requires unlocked canonical members and caps XP exactly', () => {
  let prepared = unlockPartyMember(createAdvancementState(), 'aya');
  const payload = JSON.parse(serializeAdvancementState(prepared));
  payload.party[0].xp = MAX_MEMBER_XP - 5;
  payload.party[1].xp = MAX_MEMBER_XP;
  prepared = loadAdvancementState(payload).value;

  const result = grantRewardBundle(prepared, {
    xpPerMember: 50,
    currency: 1,
    items: [],
    keyItems: [],
  }, { partyIds: ['ren', 'aya'] });

  assert.equal(result.ok, true);
  assert.equal(getPartyMember(result.state, 'ren').xp, MAX_MEMBER_XP);
  assert.equal(getPartyMember(result.state, 'aya').xp, MAX_MEMBER_XP);
  assert.deepEqual(result.receipt.xpAwards.map(({ memberId, awarded, capped }) => ({ memberId, awarded, capped })), [
    { memberId: 'ren', awarded: 5, capped: true },
    { memberId: 'aya', awarded: 0, capped: true },
  ]);
  assert.equal(result.state.revision, prepared.revision + 1);

  const locked = grantRewardBundle(prepared, {
    xpPerMember: 1, currency: 0, items: [], keyItems: [],
  }, { partyIds: ['lise'] });
  assert.equal(locked.ok, false);
  assert.equal(locked.code, 'invalid-reward');
  assert.match(locked.errors.join(' '), /lise is locked/);
  assert.deepEqual(locked.state, prepared);
});

test('invalid optional reward bundles fail without partial XP, currency, or inventory changes', () => {
  const fresh = createAdvancementState();
  const malformed = grantRewardBundle(fresh, {
    xpPerMember: 10,
    currency: -1,
    items: [{ name: 'River Salve', quantity: 1 }, { name: 'River Salve', quantity: 2 }],
    keyItems: ['Duplicate folio', 'Duplicate folio'],
  }, { partyIds: ['ren', 'ren'] });

  assert.equal(malformed.ok, false);
  assert.equal(malformed.code, 'invalid-reward');
  assert.match(malformed.errors.join(' '), /currency.*non-negative/);
  assert.match(malformed.errors.join(' '), /duplicate River Salve/);
  assert.match(malformed.errors.join(' '), /duplicate Duplicate folio/);
  assert.match(malformed.errors.join(' '), /duplicate ren/);
  assert.deepEqual(malformed.state, fresh);
  assert.equal(malformed.state.revision, fresh.revision);

  const payload = JSON.parse(serializeAdvancementState(fresh));
  payload.inventory.currency = Number.MAX_SAFE_INTEGER;
  const wealthy = loadAdvancementState(payload).value;
  const overflow = grantRewardBundle(wealthy, {
    xpPerMember: 0, currency: 1, items: [], keyItems: [],
  });
  assert.equal(overflow.ok, false);
  assert.match(overflow.errors.join(' '), /currency limit/);
  assert.deepEqual(overflow.state, wealthy);

  const empty = grantRewardBundle(fresh, {
    xpPerMember: 0, currency: 0, items: [], keyItems: [],
  });
  assert.equal(empty.ok, false);
  assert.match(empty.errors.join(' '), /at least one/);
});

test('encounter preparation unlocks the roster and applies the prior-chapter catch-up floor', () => {
  const fresh = createAdvancementState();
  const prepared = preparePartyForEncounter(fresh, 'c3-dock-patrol');
  const expectedFloor = xpToReachLevel(getChapterLevelTarget('chapter-2'));

  assert.equal(getPartyMember(prepared, 'ren').xp, expectedFloor);
  assert.equal(getPartyMember(prepared, 'mateus').xp, expectedFloor);
  assert.equal(getPartyMember(prepared, 'mateus').unlocked, true);
  assert.equal(getPartyMember(prepared, 'genta').unlocked, false);
  assert.equal(getPartyMember(fresh, 'mateus').xp, 0);
});

test('canonical first clears reach the authored final chapter level target without mandatory grinding', () => {
  let state = createAdvancementState();
  for (const encounter of ENCOUNTERS) state = recordEncounterWin(state, encounter.id);

  const finalTarget = getChapterLevelTarget('chapter-9');
  for (const member of getParty(state, { unlockedOnly: true })) {
    assert.ok(member.level >= finalTarget, `${member.id} should reach level ${finalTarget}`);
  }
  const repeat = getEncounterRewardPreview('c9-kurozane', 8);
  assert.ok(repeat.xpPerMember > 0, 'post-target speed-up grinding must remain available');
});

test('pacing model is 20 hours at 1x and speeds only the grind budget', () => {
  assert.equal(CAMPAIGN_PACING.targetMinutesAt1x, 1200);
  assert.deepEqual(getPacingEstimate(1), {
    speedMultiplier: 1,
    fixedMinutes: 1020,
    grindMinutes: 180,
    totalMinutes: 1200,
    totalHours: 20,
    minutesSaved: 0,
  });
  assert.equal(getPacingEstimate(2).totalMinutes, 1110);
  assert.equal(getPacingEstimate(4).totalMinutes, 1065);

  const fresh = createAdvancementState();
  const fast = setSpeedMultiplier(fresh, 4);
  assert.equal(fast.speedMultiplier, 4);
  assert.equal(getAdvancementSummary(fast).pacing.totalHours, 17.75);
  assert.throws(() => setSpeedMultiplier(fast, 3), /1, 2, or 4/);
});

test('versioned serialization round-trips and rejects tampering safely', () => {
  let state = createAdvancementState();
  state = recordEncounterWin(state, 'c1-cinder-hounds');
  state = setSpeedMultiplier(state, 2);

  const serialized = serializeAdvancementState(state);
  const loaded = loadAdvancementState(serialized);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.value, state);
  assert.equal(Object.isFrozen(loaded.value), true);

  const wrongVersion = JSON.parse(serialized);
  wrongVersion.schemaVersion = 99;
  assert.equal(validateAdvancementPayload(wrongVersion).ok, false);

  const badPartyOrder = JSON.parse(serialized);
  [badPartyOrder.party[0], badPartyOrder.party[1]] = [badPartyOrder.party[1], badPartyOrder.party[0]];
  assert.equal(validateAdvancementPayload(badPartyOrder).ok, false);

  const unknownEncounter = JSON.parse(serialized);
  unknownEncounter.encounterWins['invented-fight'] = 1;
  assert.equal(validateAdvancementPayload(unknownEncounter).ok, false);
  assert.deepEqual(loadAdvancementState('{broken').errors, ['Save payload is not valid JSON.']);
});

test('storage adapter handles empty, valid, corrupt, and unavailable slots without throwing', () => {
  const storage = new MemoryStorage();
  const adapter = createAdvancementStorageAdapter(storage, 'advancement-test');
  const state = recordEncounterWin(createAdvancementState(), 'prologue-ashen-bailiff');

  assert.deepEqual(adapter.load(), { ok: true, found: false, state: createAdvancementState() });
  assert.deepEqual(adapter.save(state), { ok: true });
  assert.deepEqual(adapter.load(), { ok: true, found: true, state });
  assert.deepEqual(adapter.clear(), { ok: true });

  storage.setItem('advancement-test', '{bad');
  assert.equal(adapter.load().code, 'invalid-save');

  const unavailable = createAdvancementStorageAdapter(null);
  assert.equal(unavailable.available, false);
  assert.deepEqual(unavailable.save(state), { ok: false, code: 'storage-unavailable' });
  assert.deepEqual(unavailable.load(), { ok: false, code: 'storage-unavailable' });
});
