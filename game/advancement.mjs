/**
 * Deterministic party advancement for Bells of the Black Chrysanthemum.
 *
 * This module is DOM-free and keeps combat rewards separate from narrative
 * progression. Stats and levels are derived from XP, so a save cannot contain
 * contradictory values. All returned state and view objects are immutable.
 */

import { CAMPAIGN } from './content/campaign.mjs';
import { ENCOUNTERS } from './content/encounters.mjs';

export const ADVANCEMENT_SCHEMA_VERSION = 1;
export const DEFAULT_ADVANCEMENT_SAVE_KEY = `${CAMPAIGN.id}.advancement.v${ADVANCEMENT_SCHEMA_VERSION}`;
export const LEVEL_CAP = 50;
export const SPEED_MULTIPLIERS = Object.freeze([1, 2, 4]);

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

/**
 * Legacy production-planning allocation plus the release-evidence target.
 * This is not a critical-path estimate: the measured quantity model lives in
 * duration-audit.mjs. The 180-minute grind allocation is also the maximum
 * amount of repeat time that can satisfy the proof gate; all other required
 * active time must come from non-grind play.
 */
export const CAMPAIGN_PACING = deepFreeze({
  targetMinutesAt1x: 1200,
  fixedMinutes: {
    narrative: 480,
    exploration: 300,
    firstClearCombat: 180,
    menusAndRest: 60,
  },
  grindMinutesAt1x: 180,
  chapterLevelTargets: {
    prologue: 2,
    'chapter-1': 5,
    'chapter-2': 8,
    'chapter-3': 12,
    'chapter-4': 16,
    'chapter-5': 20,
    'chapter-6': 24,
    'chapter-7': 29,
    'chapter-8': 34,
    'chapter-9': 40,
    epilogue: 40,
  },
});

const PARTY_DEFINITIONS = deepFreeze([
  { id: 'ren', name: 'Ren Ishikawa', base: { hp: 104, mp: 24, power: 15, guard: 12, arcana: 8, speed: 15 }, growth: { hp: 9, mp: 2, power: 3, guard: 2, arcana: 1, speed: 2 } },
  { id: 'aya', name: 'Aya Shinohara', base: { hp: 82, mp: 42, power: 8, guard: 11, arcana: 16, speed: 12 }, growth: { hp: 7, mp: 4, power: 1, guard: 2, arcana: 3, speed: 2 } },
  // `lise` is the save-stable legacy slot for Nikola; never expose it as his name.
  { id: 'lise', name: 'Nikola Dražanić', base: { hp: 91, mp: 29, power: 16, guard: 10, arcana: 11, speed: 16 }, growth: { hp: 8, mp: 3, power: 3, guard: 2, arcana: 2, speed: 3 } },
  { id: 'mateus', name: 'Father Mateus Avelar', base: { hp: 98, mp: 48, power: 12, guard: 12, arcana: 18, speed: 11 }, growth: { hp: 8, mp: 4, power: 2, guard: 2, arcana: 3, speed: 2 } },
  { id: 'genta', name: 'Genta Mononobe', base: { hp: 128, mp: 18, power: 17, guard: 18, arcana: 6, speed: 8 }, growth: { hp: 11, mp: 1, power: 3, guard: 3, arcana: 1, speed: 1 } },
  { id: 'kiku', name: 'Kiku Nawa', base: { hp: 86, mp: 45, power: 9, guard: 10, arcana: 17, speed: 13 }, growth: { hp: 7, mp: 4, power: 1, guard: 2, arcana: 3, speed: 2 } },
]);

export const PARTY_MEMBER_IDS = Object.freeze(PARTY_DEFINITIONS.map(({ id }) => id));

const PARTY_BY_ID = new Map(PARTY_DEFINITIONS.map((member) => [member.id, member]));
const ENCOUNTER_BY_ID = new Map(ENCOUNTERS.map((encounter) => [encounter.id, encounter]));
const ENCOUNTER_ORDER = new Map(ENCOUNTERS.map((encounter, index) => [encounter.id, index]));
const CHAPTER_TIER = new Map(CAMPAIGN.chapters.map((chapter, index) => [chapter.id, index]));
const ENCOUNTERS_BY_CHAPTER = new Map(CAMPAIGN.chapters.map((chapter) => [
  chapter.id,
  ENCOUNTERS.filter((encounter) => encounter.chapterId === chapter.id),
]));
const STATE_KEYS = Object.freeze(['schemaVersion', 'campaignId', 'speedMultiplier', 'party', 'encounterWins', 'inventory', 'revision']);
const MEMBER_KEYS = Object.freeze(['id', 'unlocked', 'xp']);
const INVENTORY_KEYS = Object.freeze(['currency', 'items', 'keyItems']);
const REWARD_KEYS = Object.freeze(['xpPerMember', 'currency', 'items', 'keyItems']);
const REWARD_ITEM_KEYS = Object.freeze(['name', 'quantity']);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function validateExactKeys(value, expectedKeys, label, errors) {
  const expected = new Set(expectedKeys);
  for (const key of expectedKeys) {
    if (!hasOwn(value, key)) errors.push(`${label}.${key} is required.`);
  }
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) errors.push(`${label}.${key} is not supported by schema v${ADVANCEMENT_SCHEMA_VERSION}.`);
  }
}

function freezeStringNumberMap(values) {
  const copy = {};
  for (const key of Object.keys(values).sort()) copy[key] = values[key];
  return Object.freeze(copy);
}

function sortEncounterWins(wins) {
  const copy = {};
  for (const encounter of ENCOUNTERS) {
    if (wins[encounter.id]) copy[encounter.id] = wins[encounter.id];
  }
  return Object.freeze(copy);
}

function buildState({ speedMultiplier, party, encounterWins, inventory, revision }) {
  return Object.freeze({
    schemaVersion: ADVANCEMENT_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    speedMultiplier,
    party: Object.freeze(party.map((member) => Object.freeze({ ...member }))),
    encounterWins: sortEncounterWins(encounterWins),
    inventory: Object.freeze({
      currency: inventory.currency,
      items: freezeStringNumberMap(inventory.items),
      keyItems: Object.freeze([...inventory.keyItems]),
    }),
    revision,
  });
}

/** XP required to advance from the given level to the next. */
export function xpForNextLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_CAP) {
    throw new RangeError(`Level must be an integer from 1 to ${LEVEL_CAP}.`);
  }
  if (level === LEVEL_CAP) return 0;
  const step = level - 1;
  return 60 + (35 * step) + (10 * step * step);
}

/** Total lifetime XP at the start of a level. */
export function xpToReachLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_CAP) {
    throw new RangeError(`Level must be an integer from 1 to ${LEVEL_CAP}.`);
  }
  let total = 0;
  for (let current = 1; current < level; current += 1) total += xpForNextLevel(current);
  return total;
}

export const MAX_MEMBER_XP = xpToReachLevel(LEVEL_CAP);

export function levelForXp(xp) {
  if (!Number.isSafeInteger(xp) || xp < 0) throw new RangeError('XP must be a non-negative safe integer.');
  let level = 1;
  while (level < LEVEL_CAP && xp >= xpToReachLevel(level + 1)) level += 1;
  return level;
}

function statsAtLevel(definition, level) {
  const stats = {};
  for (const key of Object.keys(definition.base)) {
    stats[key] = definition.base[key] + (definition.growth[key] * (level - 1));
  }
  return Object.freeze(stats);
}

function memberView(member) {
  const definition = PARTY_BY_ID.get(member.id);
  const level = levelForXp(member.xp);
  const levelStart = xpToReachLevel(level);
  const nextThreshold = level === LEVEL_CAP ? MAX_MEMBER_XP : xpToReachLevel(level + 1);
  return Object.freeze({
    ...member,
    name: definition.name,
    level,
    stats: statsAtLevel(definition, level),
    xpIntoLevel: member.xp - levelStart,
    xpForNextLevel: level === LEVEL_CAP ? 0 : nextThreshold - levelStart,
    xpRemaining: level === LEVEL_CAP ? 0 : nextThreshold - member.xp,
  });
}

export function createAdvancementState() {
  return buildState({
    speedMultiplier: 1,
    party: PARTY_MEMBER_IDS.map((id) => ({ id, unlocked: id === 'ren', xp: 0 })),
    encounterWins: {},
    inventory: { currency: 0, items: {}, keyItems: [] },
    revision: 0,
  });
}

export function resetAdvancementState() {
  return createAdvancementState();
}

function validationResult(ok, value, errors = []) {
  return Object.freeze({ ok, ...(ok ? { value } : {}), errors: Object.freeze([...errors]) });
}

/** Validate an untrusted object and return a normalized immutable state. */
export function validateAdvancementPayload(payload) {
  try {
    const errors = [];
    if (!isPlainObject(payload)) return validationResult(false, undefined, ['Save payload must be a plain object.']);
    validateExactKeys(payload, STATE_KEYS, 'save', errors);
    if (payload.schemaVersion !== ADVANCEMENT_SCHEMA_VERSION) errors.push(`save.schemaVersion must equal ${ADVANCEMENT_SCHEMA_VERSION}.`);
    if (payload.campaignId !== CAMPAIGN.id) errors.push(`save.campaignId must equal ${CAMPAIGN.id}.`);
    if (!SPEED_MULTIPLIERS.includes(payload.speedMultiplier)) errors.push('save.speedMultiplier must be 1, 2, or 4.');
    if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) errors.push('save.revision must be a non-negative safe integer.');

    let party = [];
    if (!Array.isArray(payload.party) || payload.party.length !== PARTY_MEMBER_IDS.length) {
      errors.push(`save.party must contain exactly ${PARTY_MEMBER_IDS.length} members.`);
    } else {
      party = payload.party;
      party.forEach((member, index) => {
        if (!isPlainObject(member)) {
          errors.push(`save.party[${index}] must be a plain object.`);
          return;
        }
        validateExactKeys(member, MEMBER_KEYS, `save.party[${index}]`, errors);
        if (member.id !== PARTY_MEMBER_IDS[index]) errors.push(`save.party[${index}].id must equal ${PARTY_MEMBER_IDS[index]}.`);
        if (typeof member.unlocked !== 'boolean') errors.push(`save.party[${index}].unlocked must be boolean.`);
        if (!Number.isSafeInteger(member.xp) || member.xp < 0 || member.xp > MAX_MEMBER_XP) {
          errors.push(`save.party[${index}].xp must be an integer from 0 to ${MAX_MEMBER_XP}.`);
        }
      });
      if (party[0]?.unlocked !== true) errors.push('save.party[0] (Ren) must remain unlocked.');
    }

    let encounterWins = {};
    if (!isPlainObject(payload.encounterWins)) {
      errors.push('save.encounterWins must be a plain object.');
    } else {
      encounterWins = payload.encounterWins;
      const keys = Object.keys(encounterWins);
      for (const id of keys) {
        if (!ENCOUNTER_BY_ID.has(id)) errors.push(`save.encounterWins contains unknown encounter ID ${id}.`);
        if (!Number.isSafeInteger(encounterWins[id]) || encounterWins[id] < 1) errors.push(`save.encounterWins.${id} must be a positive safe integer.`);
      }
      const sorted = [...keys].sort((a, b) => (ENCOUNTER_ORDER.get(a) ?? Infinity) - (ENCOUNTER_ORDER.get(b) ?? Infinity));
      if (sorted.some((id, index) => id !== keys[index])) errors.push('save.encounterWins must use canonical encounter order.');
    }

    let inventory = { currency: 0, items: {}, keyItems: [] };
    if (!isPlainObject(payload.inventory)) {
      errors.push('save.inventory must be a plain object.');
    } else {
      inventory = payload.inventory;
      validateExactKeys(inventory, INVENTORY_KEYS, 'save.inventory', errors);
      if (!Number.isSafeInteger(inventory.currency) || inventory.currency < 0) errors.push('save.inventory.currency must be a non-negative safe integer.');
      if (!isPlainObject(inventory.items)) {
        errors.push('save.inventory.items must be a plain object.');
      } else {
        const itemKeys = Object.keys(inventory.items);
        if ([...itemKeys].sort().some((key, index) => key !== itemKeys[index])) errors.push('save.inventory.items must use alphabetical order.');
        for (const key of itemKeys) {
          if (!key.trim()) errors.push('save.inventory.items cannot contain an empty item name.');
          if (!Number.isSafeInteger(inventory.items[key]) || inventory.items[key] < 1) errors.push(`save.inventory.items.${key} must be a positive safe integer.`);
        }
      }
      if (!Array.isArray(inventory.keyItems)) {
        errors.push('save.inventory.keyItems must be an array.');
      } else {
        const seen = new Set();
        for (const item of inventory.keyItems) {
          if (typeof item !== 'string' || !item.trim()) errors.push('save.inventory.keyItems must contain non-empty strings.');
          if (seen.has(item)) errors.push(`save.inventory.keyItems contains duplicate ${item}.`);
          seen.add(item);
        }
      }
    }

    if (errors.length) return validationResult(false, undefined, errors);
    return validationResult(true, buildState({
      speedMultiplier: payload.speedMultiplier,
      party,
      encounterWins,
      inventory,
      revision: payload.revision,
    }));
  } catch {
    return validationResult(false, undefined, ['Save payload could not be read safely.']);
  }
}

function assertValidState(state) {
  const checked = validateAdvancementPayload(state);
  if (!checked.ok) throw new TypeError(`Invalid advancement state: ${checked.errors.join(' ')}`);
  return checked.value;
}

export function getPartyMember(state, memberId) {
  const snapshot = assertValidState(state);
  const member = snapshot.party.find(({ id }) => id === memberId);
  if (!member) throw new RangeError(`Unknown party member ID: ${memberId}`);
  return memberView(member);
}

export function getParty(state, { unlockedOnly = false } = {}) {
  const snapshot = assertValidState(state);
  return Object.freeze(snapshot.party
    .filter((member) => !unlockedOnly || member.unlocked)
    .map(memberView));
}

export function unlockPartyMember(state, memberId) {
  const snapshot = assertValidState(state);
  if (!PARTY_BY_ID.has(memberId)) throw new RangeError(`Unknown party member ID: ${memberId}`);
  const index = snapshot.party.findIndex(({ id }) => id === memberId);
  if (snapshot.party[index].unlocked) return snapshot;
  const party = snapshot.party.map((member, memberIndex) => memberIndex === index ? { ...member, unlocked: true } : member);
  return buildState({ ...snapshot, party, revision: snapshot.revision + 1 });
}

/** Unlock an authored campaign roster atomically in its declared order. */
export function unlockPartyMembers(state, memberIds) {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw new TypeError('Party member IDs must be a non-empty array.');
  }
  if (new Set(memberIds).size !== memberIds.length) {
    throw new RangeError('Party member IDs must be unique.');
  }
  const snapshot = assertValidState(state);
  for (const memberId of memberIds) {
    if (!PARTY_BY_ID.has(memberId)) throw new RangeError(`Unknown party member ID: ${memberId}`);
  }
  if (memberIds.every((memberId) => snapshot.party.find((member) => member.id === memberId).unlocked)) return state;
  return memberIds.reduce((next, memberId) => unlockPartyMember(next, memberId), state);
}

export function setSpeedMultiplier(state, speedMultiplier) {
  const snapshot = assertValidState(state);
  if (!SPEED_MULTIPLIERS.includes(speedMultiplier)) throw new RangeError('Speed multiplier must be 1, 2, or 4.');
  if (snapshot.speedMultiplier === speedMultiplier) return snapshot;
  return buildState({ ...snapshot, speedMultiplier, revision: snapshot.revision + 1 });
}

export function getPacingEstimate(speedMultiplier = 1) {
  if (!SPEED_MULTIPLIERS.includes(speedMultiplier)) throw new RangeError('Speed multiplier must be 1, 2, or 4.');
  const fixedMinutes = Object.values(CAMPAIGN_PACING.fixedMinutes).reduce((sum, minutes) => sum + minutes, 0);
  const grindMinutes = CAMPAIGN_PACING.grindMinutesAt1x / speedMultiplier;
  const totalMinutes = fixedMinutes + grindMinutes;
  return Object.freeze({
    speedMultiplier,
    fixedMinutes,
    grindMinutes,
    totalMinutes,
    totalHours: totalMinutes / 60,
    minutesSaved: CAMPAIGN_PACING.targetMinutesAt1x - totalMinutes,
  });
}

export function getChapterLevelTarget(chapterId) {
  const target = CAMPAIGN_PACING.chapterLevelTargets[chapterId];
  if (!Number.isInteger(target)) throw new RangeError(`Unknown chapter ID: ${chapterId}`);
  return target;
}

function previousChapterLevelTarget(chapterId) {
  const chapterIndex = CAMPAIGN.chapters.findIndex((chapter) => chapter.id === chapterId);
  if (chapterIndex <= 0) return 1;
  return getChapterLevelTarget(CAMPAIGN.chapters[chapterIndex - 1].id);
}

/** Unlock and catch the authored roster up to the prior chapter's level floor. */
export function preparePartyForEncounter(state, encounterId, options = {}) {
  const snapshot = assertValidState(state);
  const encounter = ENCOUNTER_BY_ID.get(encounterId);
  if (!encounter) throw new RangeError(`Unknown encounter ID: ${encounterId}`);
  const activeIds = new Set(validateActiveParty(encounter, options.partyIds));
  const catchUpXp = xpToReachLevel(previousChapterLevelTarget(encounter.chapterId));
  let changed = false;
  const party = snapshot.party.map((member) => {
    if (!activeIds.has(member.id)) return member;
    const prepared = { ...member, unlocked: true, xp: Math.max(member.xp, catchUpXp) };
    if (prepared.unlocked !== member.unlocked || prepared.xp !== member.xp) changed = true;
    return prepared;
  });
  return changed ? buildState({ ...snapshot, party, revision: snapshot.revision + 1 }) : snapshot;
}

function rewardScale(priorWins) {
  if (priorWins === 0) return Object.freeze({ xp: 1, currency: 1, tier: 'first-clear' });
  if (priorWins === 1) return Object.freeze({ xp: 0.55, currency: 0.65, tier: 'repeat-1' });
  if (priorWins === 2) return Object.freeze({ xp: 0.35, currency: 0.45, tier: 'repeat-2' });
  return Object.freeze({ xp: 0.2, currency: 0.3, tier: 'repeat-floor' });
}

function encounterBaseReward(encounter) {
  const tier = CHAPTER_TIER.get(encounter.chapterId) ?? 0;
  const isBoss = Boolean(encounter.bossMechanic) && !['teaching-battle', 'objective-battle', 'field-battle'].includes(encounter.format);
  const enemyUnits = (encounter.enemies ?? []).reduce((sum, enemy) => sum + (enemy.count ?? 1), 0);
  const targetXp = xpToReachLevel(getChapterLevelTarget(encounter.chapterId));
  const entryXp = xpToReachLevel(previousChapterLevelTarget(encounter.chapterId));
  const chapterEncounterCount = Math.max(1, ENCOUNTERS_BY_CHAPTER.get(encounter.chapterId)?.length ?? 1);
  return Object.freeze({
    xp: Math.max(60, Math.ceil((targetXp - entryXp) / chapterEncounterCount)),
    currency: 24 + (tier * 18) + (enemyUnits * 6) + (isBoss ? 30 : 0),
  });
}

function parseStack(text) {
  const match = /^(.*?)(?:\s+x(\d+))?$/.exec(text.trim());
  return Object.freeze({ name: match[1], quantity: match[2] ? Number(match[2]) : 1 });
}

/** Preview the deterministic reward for the next clear without changing state. */
export function getEncounterRewardPreview(encounterId, priorWins = 0) {
  const encounter = ENCOUNTER_BY_ID.get(encounterId);
  if (!encounter) throw new RangeError(`Unknown encounter ID: ${encounterId}`);
  if (!Number.isSafeInteger(priorWins) || priorWins < 0) throw new RangeError('priorWins must be a non-negative safe integer.');
  const base = encounterBaseReward(encounter);
  const scale = rewardScale(priorWins);
  const firstClear = priorWins === 0;
  return Object.freeze({
    encounterId,
    clearNumber: priorWins + 1,
    tier: scale.tier,
    xpPerMember: Math.max(1, Math.round(base.xp * scale.xp)),
    currency: Math.max(1, Math.round(base.currency * scale.currency)),
    items: Object.freeze(firstClear ? (encounter.reward?.items ?? []).map(parseStack) : []),
    keyItems: Object.freeze(firstClear ? [...(encounter.reward?.keyItems ?? [])] : []),
    repeat: !firstClear,
  });
}

function validateActiveParty(encounter, partyIds) {
  const ids = partyIds ?? encounter.party?.roster ?? ['ren'];
  if (!Array.isArray(ids) || !ids.length) throw new RangeError('An encounter win requires at least one active party member.');
  const seen = new Set();
  for (const id of ids) {
    if (!PARTY_BY_ID.has(id)) throw new RangeError(`Unknown party member ID: ${id}`);
    if (seen.has(id)) throw new RangeError(`Duplicate active party member ID: ${id}`);
    seen.add(id);
  }
  return Object.freeze([...ids]);
}

function rewardFailure(state, errors) {
  return Object.freeze({
    ok: false,
    code: 'invalid-reward',
    state,
    errors: Object.freeze([...errors]),
  });
}

function validateRewardPartyIds(snapshot, options, errors) {
  if (!isPlainObject(options)) {
    errors.push('reward options must be a plain object.');
    return [];
  }
  for (const key of Object.keys(options)) {
    if (key !== 'partyIds') errors.push(`reward options.${key} is not supported.`);
  }
  const ids = hasOwn(options, 'partyIds')
    ? options.partyIds
    : snapshot.party.filter(({ unlocked }) => unlocked).map(({ id }) => id);
  if (!Array.isArray(ids) || !ids.length) {
    errors.push('reward partyIds must contain at least one unlocked canonical party member.');
    return [];
  }
  const seen = new Set();
  for (const id of ids) {
    if (!PARTY_BY_ID.has(id)) errors.push(`reward partyIds contains unknown party member ${id}.`);
    else if (!snapshot.party.find((member) => member.id === id)?.unlocked) errors.push(`reward party member ${id} is locked.`);
    if (seen.has(id)) errors.push(`reward partyIds contains duplicate ${id}.`);
    seen.add(id);
  }
  return [...ids];
}

function validateRewardBundle(snapshot, reward, options) {
  const errors = [];
  const partyIds = validateRewardPartyIds(snapshot, options, errors);
  const normalized = { xpPerMember: 0, currency: 0, items: [], keyItems: [] };
  if (!isPlainObject(reward)) {
    errors.push('reward must be a plain object.');
    return { errors, partyIds, reward: normalized };
  }
  validateExactKeys(reward, REWARD_KEYS, 'reward', errors);
  if (!Number.isSafeInteger(reward.xpPerMember) || reward.xpPerMember < 0) {
    errors.push('reward.xpPerMember must be a non-negative safe integer.');
  } else {
    normalized.xpPerMember = reward.xpPerMember;
  }
  if (!Number.isSafeInteger(reward.currency) || reward.currency < 0) {
    errors.push('reward.currency must be a non-negative safe integer.');
  } else {
    normalized.currency = reward.currency;
    if (reward.currency > Number.MAX_SAFE_INTEGER - snapshot.inventory.currency) {
      errors.push('reward.currency would exceed the inventory currency limit.');
    }
  }

  if (!Array.isArray(reward.items)) {
    errors.push('reward.items must be an array.');
  } else {
    const seen = new Set();
    reward.items.forEach((item, index) => {
      const label = `reward.items[${index}]`;
      if (!isPlainObject(item)) {
        errors.push(`${label} must be a plain object.`);
        return;
      }
      validateExactKeys(item, REWARD_ITEM_KEYS, label, errors);
      const validName = typeof item.name === 'string' && item.name.trim() && item.name === item.name.trim();
      if (!validName) errors.push(`${label}.name must be a trimmed non-empty string.`);
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) errors.push(`${label}.quantity must be a positive safe integer.`);
      if (!validName || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return;
      if (seen.has(item.name)) errors.push(`reward.items contains duplicate ${item.name}.`);
      seen.add(item.name);
      const existing = snapshot.inventory.items[item.name] ?? 0;
      if (item.quantity > Number.MAX_SAFE_INTEGER - existing) errors.push(`${label}.quantity would exceed the item stack limit.`);
      normalized.items.push({ name: item.name, quantity: item.quantity });
    });
  }

  if (!Array.isArray(reward.keyItems)) {
    errors.push('reward.keyItems must be an array.');
  } else {
    const seen = new Set();
    reward.keyItems.forEach((item, index) => {
      if (typeof item !== 'string' || !item.trim() || item !== item.trim()) {
        errors.push(`reward.keyItems[${index}] must be a trimmed non-empty string.`);
        return;
      }
      if (seen.has(item)) errors.push(`reward.keyItems contains duplicate ${item}.`);
      seen.add(item);
      normalized.keyItems.push(item);
    });
  }

  if (normalized.xpPerMember === 0 && normalized.currency === 0 && normalized.items.length === 0 && normalized.keyItems.length === 0) {
    errors.push('reward must contain at least one XP, currency, item, or key-item grant.');
  }
  return { errors, partyIds, reward: normalized };
}

/**
 * Apply one optional-content reward as a single advancement transaction.
 * XP defaults to every currently unlocked member; callers may provide a
 * unique unlocked canonical partyIds subset. Invalid grants leave the state
 * unchanged, while a valid grant increments revision exactly once.
 */
export function grantRewardBundle(state, reward, options = {}) {
  const snapshot = assertValidState(state);
  const validation = validateRewardBundle(snapshot, reward, options);
  if (validation.errors.length) return rewardFailure(snapshot, validation.errors);

  const targeted = new Set(validation.partyIds);
  const xpAwards = [];
  const party = snapshot.party.map((member) => {
    if (!targeted.has(member.id)) return member;
    const awarded = Math.min(validation.reward.xpPerMember, MAX_MEMBER_XP - member.xp);
    const after = member.xp + awarded;
    xpAwards.push({
      memberId: member.id,
      before: member.xp,
      requested: validation.reward.xpPerMember,
      awarded,
      after,
      capped: after === MAX_MEMBER_XP,
    });
    return { ...member, xp: after };
  });

  const items = { ...snapshot.inventory.items };
  for (const item of validation.reward.items) items[item.name] = (items[item.name] ?? 0) + item.quantity;
  const keyItems = [...snapshot.inventory.keyItems];
  const addedKeyItems = [];
  const existingKeyItems = [];
  for (const item of validation.reward.keyItems) {
    if (keyItems.includes(item)) existingKeyItems.push(item);
    else {
      keyItems.push(item);
      addedKeyItems.push(item);
    }
  }
  const next = buildState({
    speedMultiplier: snapshot.speedMultiplier,
    party,
    encounterWins: snapshot.encounterWins,
    inventory: {
      currency: snapshot.inventory.currency + validation.reward.currency,
      items,
      keyItems,
    },
    revision: snapshot.revision + 1,
  });
  const receipt = deepFreeze({
    type: 'reward-bundle',
    partyIds: validation.partyIds,
    xpPerMember: validation.reward.xpPerMember,
    xpAwards,
    currency: {
      before: snapshot.inventory.currency,
      awarded: validation.reward.currency,
      after: next.inventory.currency,
    },
    items: validation.reward.items,
    keyItems: { added: addedKeyItems, alreadyOwned: existingKeyItems },
    revision: next.revision,
  });
  return Object.freeze({ ok: true, state: next, receipt });
}

/**
 * Record one victory. First clears grant authored items/key items; repeat
 * clears grant only diminished XP and currency. XP is capped at level 50.
 */
export function recordEncounterWin(state, encounterId, options = {}) {
  const snapshot = preparePartyForEncounter(state, encounterId, { partyIds: options.partyIds });
  const encounter = ENCOUNTER_BY_ID.get(encounterId);
  if (!encounter) throw new RangeError(`Unknown encounter ID: ${encounterId}`);
  const partyIds = validateActiveParty(encounter, options.partyIds);
  const priorWins = snapshot.encounterWins[encounterId] ?? 0;
  const reward = getEncounterRewardPreview(encounterId, priorWins);
  const active = new Set(partyIds);
  const party = snapshot.party.map((member) => active.has(member.id)
    ? { ...member, unlocked: true, xp: Math.min(MAX_MEMBER_XP, member.xp + reward.xpPerMember) }
    : member);
  const items = { ...snapshot.inventory.items };
  for (const item of reward.items) items[item.name] = (items[item.name] ?? 0) + item.quantity;
  const keyItems = [...snapshot.inventory.keyItems];
  for (const item of reward.keyItems) if (!keyItems.includes(item)) keyItems.push(item);
  return buildState({
    speedMultiplier: snapshot.speedMultiplier,
    party,
    encounterWins: { ...snapshot.encounterWins, [encounterId]: priorWins + 1 },
    inventory: {
      currency: snapshot.inventory.currency + reward.currency,
      items,
      keyItems,
    },
    revision: snapshot.revision + 1,
  });
}

export function getEncounterWinCount(state, encounterId) {
  const snapshot = assertValidState(state);
  if (!ENCOUNTER_BY_ID.has(encounterId)) throw new RangeError(`Unknown encounter ID: ${encounterId}`);
  return snapshot.encounterWins[encounterId] ?? 0;
}

export function getAdvancementSummary(state) {
  const snapshot = assertValidState(state);
  const wins = Object.values(snapshot.encounterWins).reduce((sum, count) => sum + count, 0);
  const firstClears = Object.keys(snapshot.encounterWins).length;
  return Object.freeze({
    speedMultiplier: snapshot.speedMultiplier,
    pacing: getPacingEstimate(snapshot.speedMultiplier),
    wins,
    firstClears,
    grindWins: wins - firstClears,
    unlockedPartyCount: snapshot.party.filter(({ unlocked }) => unlocked).length,
    averageUnlockedLevel: snapshot.party.filter(({ unlocked }) => unlocked)
      .reduce((sum, member, _, members) => sum + (levelForXp(member.xp) / members.length), 0),
    currency: snapshot.inventory.currency,
  });
}

export function serializeAdvancementState(state) {
  return JSON.stringify(assertValidState(state));
}

export function loadAdvancementState(serializedOrPayload) {
  if (typeof serializedOrPayload === 'string') {
    try {
      return validateAdvancementPayload(JSON.parse(serializedOrPayload));
    } catch {
      return validationResult(false, undefined, ['Save payload is not valid JSON.']);
    }
  }
  return validateAdvancementPayload(serializedOrPayload);
}

function resolveDefaultStorage() {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

/** No-throw localStorage adapter suitable for browsers and injected tests. */
export function createAdvancementStorageAdapter(storage = undefined, key = DEFAULT_ADVANCEMENT_SAVE_KEY) {
  const target = storage === undefined ? resolveDefaultStorage() : storage;
  const available = Boolean(target && typeof target.getItem === 'function' && typeof target.setItem === 'function' && typeof target.removeItem === 'function');
  const unavailable = () => Object.freeze({ ok: false, code: 'storage-unavailable' });
  return Object.freeze({
    key,
    available,
    save(state) {
      if (!available) return unavailable();
      let serialized;
      try {
        serialized = serializeAdvancementState(state);
      } catch {
        return Object.freeze({ ok: false, code: 'invalid-state' });
      }
      try {
        target.setItem(key, serialized);
        return Object.freeze({ ok: true });
      } catch {
        return Object.freeze({ ok: false, code: 'storage-write-failed' });
      }
    },
    load() {
      if (!available) return unavailable();
      let serialized;
      try {
        serialized = target.getItem(key);
      } catch {
        return Object.freeze({ ok: false, code: 'storage-read-failed' });
      }
      if (serialized === null) return Object.freeze({ ok: true, found: false, state: createAdvancementState() });
      const loaded = loadAdvancementState(serialized);
      if (!loaded.ok) return Object.freeze({ ok: false, code: 'invalid-save', errors: loaded.errors });
      return Object.freeze({ ok: true, found: true, state: loaded.value });
    },
    clear() {
      if (!available) return unavailable();
      try {
        target.removeItem(key);
        return Object.freeze({ ok: true });
      } catch {
        return Object.freeze({ ok: false, code: 'storage-clear-failed' });
      }
    },
  });
}
