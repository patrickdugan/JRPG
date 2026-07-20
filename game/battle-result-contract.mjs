/**
 * Engine-independent terminal battle result.
 *
 * Combat engines may expose richer snapshots, but persistence is authorized to
 * consume only this small JSON record. Keeping the record free of positions,
 * clocks, animation phases, and engine-specific state lets another combat
 * implementation settle through the same campaign boundary.
 */

import { PARTY_MEMBER_IDS } from './advancement.mjs';
import { BATTLE_ITEM_IDS } from './loadout.mjs';

export const BATTLE_RESULT_SCHEMA_VERSION = 1;
export const BATTLE_RESULT_OUTCOMES = Object.freeze(['victory', 'defeat']);

const RESULT_KEYS = Object.freeze([
  'schemaVersion',
  'encounterId',
  'result',
  'partyVitals',
  'itemDebits',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected, label, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${label} must be a plain object.`);
    return;
  }
  const expectedSet = new Set(expected);
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) errors.push(`${label}.${key} is required.`);
  }
  for (const key of Object.keys(value)) {
    if (!expectedSet.has(key)) errors.push(`${label}.${key} is not supported.`);
  }
}

function validation(ok, value, errors) {
  return deepFreeze({
    ok,
    ...(ok ? { value } : {}),
    errors: [...errors],
  });
}

/** Validate and canonicalize an untrusted terminal result record. */
export function validateBattleResultRecord(record, { expectedEncounterId } = {}) {
  const errors = [];
  exactKeys(record, RESULT_KEYS, 'result', errors);
  if (!isPlainObject(record)) return validation(false, undefined, errors);

  if (record.schemaVersion !== BATTLE_RESULT_SCHEMA_VERSION) {
    errors.push(`result.schemaVersion must equal ${BATTLE_RESULT_SCHEMA_VERSION}.`);
  }
  if (typeof record.encounterId !== 'string' || !record.encounterId.trim()
      || record.encounterId !== record.encounterId.trim()) {
    errors.push('result.encounterId must be a trimmed non-empty string.');
  }
  if (expectedEncounterId !== undefined && record.encounterId !== expectedEncounterId) {
    errors.push(`result.encounterId must equal ${expectedEncounterId}.`);
  }
  if (!BATTLE_RESULT_OUTCOMES.includes(record.result)) {
    errors.push('result.result must be victory or defeat.');
  }

  const partyVitals = {};
  if (!isPlainObject(record.partyVitals)) {
    errors.push('result.partyVitals must be a plain object.');
  } else {
    for (const memberId of Object.keys(record.partyVitals)) {
      const vitals = record.partyVitals[memberId];
      if (!PARTY_MEMBER_IDS.includes(memberId)) {
        errors.push(`result.partyVitals contains unknown party member ${memberId}.`);
        continue;
      }
      exactKeys(vitals, ['hp'], `result.partyVitals.${memberId}`, errors);
      if (!isPlainObject(vitals)) continue;
      if (!Number.isSafeInteger(vitals.hp) || vitals.hp < 1) {
        errors.push(`result.partyVitals.${memberId}.hp must be a positive safe integer.`);
        continue;
      }
      partyVitals[memberId] = { hp: vitals.hp };
    }
  }
  if (record.result === 'victory' && Object.keys(partyVitals).length === 0) {
    errors.push('A victory result must contain at least one living party member.');
  }

  const itemDebits = {};
  exactKeys(record.itemDebits, BATTLE_ITEM_IDS, 'result.itemDebits', errors);
  if (isPlainObject(record.itemDebits)) {
    for (const itemId of BATTLE_ITEM_IDS) {
      const quantity = record.itemDebits[itemId];
      if (!Number.isSafeInteger(quantity) || quantity < 0) {
        errors.push(`result.itemDebits.${itemId} must be a non-negative safe integer.`);
        continue;
      }
      itemDebits[itemId] = quantity;
    }
  }

  if (errors.length) return validation(false, undefined, errors);
  const orderedVitals = Object.fromEntries(PARTY_MEMBER_IDS
    .filter((memberId) => Object.hasOwn(partyVitals, memberId))
    .map((memberId) => [memberId, partyVitals[memberId]]));
  const orderedDebits = Object.fromEntries(BATTLE_ITEM_IDS.map((itemId) => [itemId, itemDebits[itemId]]));
  return validation(true, deepFreeze({
    schemaVersion: BATTLE_RESULT_SCHEMA_VERSION,
    encounterId: record.encounterId,
    result: record.result,
    partyVitals: orderedVitals,
    itemDebits: orderedDebits,
  }), []);
}

/** Create a strict immutable record from engine-neutral terminal values. */
export function createBattleResultRecord({ encounterId, result, partyVitals, itemDebits } = {}) {
  const validated = validateBattleResultRecord({
    schemaVersion: BATTLE_RESULT_SCHEMA_VERSION,
    encounterId,
    result,
    partyVitals,
    itemDebits,
  });
  if (!validated.ok) throw new TypeError(validated.errors.join(' '));
  return validated.value;
}

/**
 * Compatibility adapter for the canonical turn engine's terminal snapshot.
 * Future engines should preferably emit createBattleResultRecord() directly.
 */
export function createBattleResultFromSnapshot(snapshot, encounterId = snapshot?.encounterId) {
  if (!isPlainObject(snapshot)) throw new TypeError('A terminal battle snapshot is required.');
  if (!BATTLE_RESULT_OUTCOMES.includes(snapshot.result)) {
    throw new TypeError('A terminal victory or defeat snapshot is required.');
  }
  if (!Array.isArray(snapshot.actors)) throw new TypeError('Battle snapshot actors must be an array.');
  const partyVitals = {};
  for (const actor of snapshot.actors) {
    if (actor?.faction !== 'party' || !(actor.hp > 0)) continue;
    if (Object.hasOwn(partyVitals, actor.templateId)) {
      throw new TypeError(`Battle snapshot contains duplicate party member ${actor.templateId}.`);
    }
    partyVitals[actor.templateId] = { hp: actor.hp };
  }
  const itemDebits = Object.fromEntries(BATTLE_ITEM_IDS.map((itemId) => [
    itemId,
    snapshot.itemConsumption?.[itemId] ?? 0,
  ]));
  return createBattleResultRecord({
    encounterId,
    result: snapshot.result,
    partyVitals,
    itemDebits,
  });
}
