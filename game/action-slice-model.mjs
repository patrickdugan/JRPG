/**
 * DOM-free run model for the non-canonical action-combat vertical slice.
 *
 * This state is intentionally independent from the campaign save. It is small,
 * JSON-safe, and suitable for a single sessionStorage entry. Battle engines may
 * only advance it through the strict engine-neutral battle-result contract.
 */

import {
  BATTLE_RESULT_SCHEMA_VERSION,
  validateBattleResultRecord,
} from './battle-result-contract.mjs';

export const ACTION_SLICE_SCHEMA_VERSION = 1;
export const ACTION_SLICE_ID = 'action-combat-vertical-slice';
export const ACTION_SLICE_STORAGE_KEY = `${ACTION_SLICE_ID}.v${ACTION_SLICE_SCHEMA_VERSION}`;

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object') return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const clone = (value) => value == null ? value : structuredClone(value);

export const ACTION_SLICE_ROSTER = Object.freeze(['ren', 'lise', 'mateus', 'miyo']);
export const ACTION_SLICE_DEFAULT_FIGHTERS = Object.freeze(['lise', 'mateus']);

export const ACTION_SLICE_FIGHTERS = deepFreeze({
  ren: { id: 'ren', name: 'Ren Ishikawa', role: 'infiltrator', defaultHp: 104, defaultMaxHp: 122 },
  lise: { id: 'lise', name: 'Nikola Dražanić', role: 'hunter', defaultHp: 91, defaultMaxHp: 109 },
  mateus: { id: 'mateus', name: 'Father Mateus Avelar', role: 'vampire-priest', defaultHp: 98, defaultMaxHp: 98 },
  miyo: { id: 'miyo', name: 'Miyo Senda', role: 'elementalist', defaultHp: 84, defaultMaxHp: 84 },
});

/**
 * A compact, noncanonical lab route reusing three authored Chapter 1 fights.
 * The Ash Wisps use the Flooded Cedars side stage as the platform encounter.
 */
export const ACTION_SLICE_PHASES = deepFreeze([
  { id: 'briefing', kind: 'briefing', encounterId: null, title: 'Choose the Pair' },
  { id: 'ordinary-encounter', kind: 'battle', encounterId: 'c1-cinder-hounds', title: 'Cinder Hounds' },
  { id: 'platform-encounter', kind: 'battle', encounterId: 'c1-ash-wisps', title: 'Ash Wisps Above the Cedars' },
  { id: 'aya-sanctuary', kind: 'sanctuary', encounterId: null, title: 'Aya’s Wayside Ward' },
  { id: 'boss-encounter', kind: 'battle', encounterId: 'c1-tithe-hound', title: 'Tithe Hound' },
  { id: 'consequence', kind: 'consequence', encounterId: null, title: 'The Clerk’s Testimony' },
  { id: 'complete', kind: 'complete', encounterId: null, title: 'Return to Camp' },
]);

export const ACTION_SLICE_ENCOUNTER_IDS = Object.freeze(
  ACTION_SLICE_PHASES.filter(({ encounterId }) => encounterId).map(({ encounterId }) => encounterId),
);

export const ACTION_SLICE_CONSEQUENCE = deepFreeze({
  id: 'clerk-testimony-preserved',
  text: 'With the Tithe Hound broken, Aya carries the rescued clerk’s testimony back to camp.',
});

const PHASE_BY_ID = new Map(ACTION_SLICE_PHASES.map((phase) => [phase.id, phase]));
const ROOT_KEYS = Object.freeze([
  'schemaVersion',
  'sliceId',
  'canonical',
  'fighters',
  'phase',
  'vitals',
  'sanctuary',
  'battleReceipts',
  'consequence',
]);
const VITAL_KEYS = Object.freeze(['hp', 'maxHp']);
const SANCTUARY_KEYS = Object.freeze(['resolved', 'used']);
const CONSEQUENCE_KEYS = Object.freeze(['unlocked', 'acknowledged']);
const RECEIPT_COUNTS = Object.freeze({
  briefing: 0,
  'ordinary-encounter': 0,
  'platform-encounter': 1,
  'aya-sanctuary': 2,
  'boss-encounter': 2,
  consequence: 3,
  complete: 3,
});

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys, label, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${label} must be a plain object.`);
    return false;
  }
  const expected = new Set(keys);
  for (const key of keys) if (!Object.hasOwn(value, key)) errors.push(`${label}.${key} is required.`);
  for (const key of Object.keys(value)) if (!expected.has(key)) errors.push(`${label}.${key} is not supported.`);
  return true;
}

function validateFighterIds(fighters, errors, label = 'run.fighters') {
  if (!Array.isArray(fighters) || fighters.length !== 2) {
    errors.push(`${label} must contain exactly two fighters.`);
    return false;
  }
  if (new Set(fighters).size !== 2) errors.push(`${label} must contain two unique fighters.`);
  for (const fighterId of fighters) {
    if (!ACTION_SLICE_ROSTER.includes(fighterId)) errors.push(`${label} contains unavailable fighter ${fighterId}.`);
  }
  return errors.length === 0;
}

function receiptVitals(receipt, fighters) {
  return Object.fromEntries(fighters.map((fighterId) => [
    fighterId,
    receipt.partyVitals[fighterId]?.hp ?? 0,
  ]));
}

function vitalsMatchReceipt(vitals, receipt, fighters) {
  const expected = receiptVitals(receipt, fighters);
  return fighters.every((fighterId) => vitals[fighterId]?.hp === expected[fighterId]);
}

function validation(ok, value, errors) {
  return deepFreeze({
    ok,
    ...(ok ? { value } : {}),
    errors: [...errors],
  });
}

/** Validate and detach an untrusted session-local run. No repair is attempted. */
export function validateActionSliceRun(candidate) {
  const errors = [];
  if (!exactKeys(candidate, ROOT_KEYS, 'run', errors)) return validation(false, undefined, errors);

  if (candidate.schemaVersion !== ACTION_SLICE_SCHEMA_VERSION) {
    errors.push(`run.schemaVersion must equal ${ACTION_SLICE_SCHEMA_VERSION}.`);
  }
  if (candidate.sliceId !== ACTION_SLICE_ID) errors.push(`run.sliceId must equal ${ACTION_SLICE_ID}.`);
  if (candidate.canonical !== false) errors.push('run.canonical must be false.');

  const fighterErrorStart = errors.length;
  validateFighterIds(candidate.fighters, errors);
  const fightersValid = errors.length === fighterErrorStart;
  const fighters = fightersValid ? [...candidate.fighters] : [];

  if (!PHASE_BY_ID.has(candidate.phase)) errors.push(`run.phase ${candidate.phase} is not a slice phase.`);

  if (!isPlainObject(candidate.vitals)) {
    errors.push('run.vitals must be a plain object.');
  } else if (fightersValid) {
    const fighterSet = new Set(fighters);
    for (const fighterId of fighters) {
      if (!Object.hasOwn(candidate.vitals, fighterId)) {
        errors.push(`run.vitals.${fighterId} is required.`);
        continue;
      }
      const vital = candidate.vitals[fighterId];
      if (!exactKeys(vital, VITAL_KEYS, `run.vitals.${fighterId}`, errors)) continue;
      if (!Number.isSafeInteger(vital.maxHp) || vital.maxHp < 1 || vital.maxHp > 999_999) {
        errors.push(`run.vitals.${fighterId}.maxHp must be a positive safe integer at most 999999.`);
      }
      if (!Number.isSafeInteger(vital.hp) || vital.hp < 0 || vital.hp > vital.maxHp) {
        errors.push(`run.vitals.${fighterId}.hp must be a safe integer from zero through maxHp.`);
      }
    }
    for (const fighterId of Object.keys(candidate.vitals)) {
      if (!fighterSet.has(fighterId)) errors.push(`run.vitals contains unselected fighter ${fighterId}.`);
    }
  }

  const sanctuaryShape = exactKeys(candidate.sanctuary, SANCTUARY_KEYS, 'run.sanctuary', errors);
  if (sanctuaryShape) {
    if (typeof candidate.sanctuary.resolved !== 'boolean') errors.push('run.sanctuary.resolved must be boolean.');
    if (typeof candidate.sanctuary.used !== 'boolean') errors.push('run.sanctuary.used must be boolean.');
    if (candidate.sanctuary.used && !candidate.sanctuary.resolved) {
      errors.push('run.sanctuary.used requires the sanctuary to be resolved.');
    }
  }

  const consequenceShape = exactKeys(candidate.consequence, CONSEQUENCE_KEYS, 'run.consequence', errors);
  if (consequenceShape) {
    if (typeof candidate.consequence.unlocked !== 'boolean') errors.push('run.consequence.unlocked must be boolean.');
    if (typeof candidate.consequence.acknowledged !== 'boolean') errors.push('run.consequence.acknowledged must be boolean.');
    if (candidate.consequence.acknowledged && !candidate.consequence.unlocked) {
      errors.push('run.consequence.acknowledged requires an unlocked consequence.');
    }
  }

  const receipts = [];
  if (!Array.isArray(candidate.battleReceipts)) {
    errors.push('run.battleReceipts must be an array.');
  } else {
    if (candidate.battleReceipts.length > ACTION_SLICE_ENCOUNTER_IDS.length) {
      errors.push(`run.battleReceipts cannot contain more than ${ACTION_SLICE_ENCOUNTER_IDS.length} receipts.`);
    }
    candidate.battleReceipts.forEach((receipt, index) => {
      const expectedEncounterId = ACTION_SLICE_ENCOUNTER_IDS[index];
      if (!expectedEncounterId) return;
      const checked = validateBattleResultRecord(receipt, { expectedEncounterId });
      if (!checked.ok) {
        checked.errors.forEach((error) => errors.push(`run.battleReceipts[${index}]: ${error}`));
        return;
      }
      if (checked.value.result !== 'victory') {
        errors.push(`run.battleReceipts[${index}] must record a victory.`);
      }
      if (fightersValid) {
        for (const fighterId of Object.keys(checked.value.partyVitals)) {
          if (!fighters.includes(fighterId)) {
            errors.push(`run.battleReceipts[${index}] contains unselected fighter ${fighterId}.`);
          }
        }
        for (const fighterId of fighters) {
          const hp = checked.value.partyVitals[fighterId]?.hp;
          const maximum = candidate.vitals?.[fighterId]?.maxHp;
          if (Number.isSafeInteger(hp) && Number.isSafeInteger(maximum) && hp > maximum) {
            errors.push(`run.battleReceipts[${index}].partyVitals.${fighterId}.hp exceeds slice maxHp.`);
          }
        }
      }
      receipts.push(checked.value);
    });
  }

  if (PHASE_BY_ID.has(candidate.phase) && Array.isArray(candidate.battleReceipts)) {
    const expectedCount = RECEIPT_COUNTS[candidate.phase];
    if (candidate.battleReceipts.length !== expectedCount) {
      errors.push(`run.phase ${candidate.phase} requires exactly ${expectedCount} battle receipts.`);
    }
  }

  const sanctuaryShouldBeResolved = ['boss-encounter', 'consequence', 'complete'].includes(candidate.phase);
  if (sanctuaryShape && PHASE_BY_ID.has(candidate.phase)
      && candidate.sanctuary.resolved !== sanctuaryShouldBeResolved) {
    errors.push(`run.sanctuary.resolved is inconsistent with phase ${candidate.phase}.`);
  }
  const consequenceShouldBeUnlocked = ['consequence', 'complete'].includes(candidate.phase);
  if (consequenceShape && PHASE_BY_ID.has(candidate.phase)
      && candidate.consequence.unlocked !== consequenceShouldBeUnlocked) {
    errors.push(`run.consequence.unlocked is inconsistent with phase ${candidate.phase}.`);
  }
  if (consequenceShape && PHASE_BY_ID.has(candidate.phase)
      && candidate.consequence.acknowledged !== (candidate.phase === 'complete')) {
    errors.push(`run.consequence.acknowledged is inconsistent with phase ${candidate.phase}.`);
  }

  const vitalShapeAvailable = fightersValid && fighters.every((fighterId) => (
    isPlainObject(candidate.vitals?.[fighterId])
    && Number.isSafeInteger(candidate.vitals[fighterId].hp)
    && Number.isSafeInteger(candidate.vitals[fighterId].maxHp)
  ));
  if (vitalShapeAvailable && receipts.length === candidate.battleReceipts?.length) {
    const receiptIndexByPhase = {
      'platform-encounter': 0,
      'aya-sanctuary': 1,
      consequence: 2,
      complete: 2,
    };
    const receiptIndex = receiptIndexByPhase[candidate.phase];
    if (receiptIndex !== undefined && receipts[receiptIndex]
        && !vitalsMatchReceipt(candidate.vitals, receipts[receiptIndex], fighters)) {
      errors.push(`run.vitals must preserve attrition from receipt ${receipts[receiptIndex].encounterId}.`);
    }
    if (candidate.phase === 'boss-encounter' && receipts[1]) {
      if (candidate.sanctuary?.used) {
        if (!fighters.every((fighterId) => candidate.vitals[fighterId].hp === candidate.vitals[fighterId].maxHp)) {
          errors.push('run.vitals must be fully healed after using Aya’s sanctuary.');
        }
      } else if (!vitalsMatchReceipt(candidate.vitals, receipts[1], fighters)) {
        errors.push('run.vitals must preserve platform-encounter attrition when sanctuary healing is skipped.');
      }
    }
  }

  if (errors.length) return validation(false, undefined, errors);
  return validation(true, deepFreeze({
    schemaVersion: ACTION_SLICE_SCHEMA_VERSION,
    sliceId: ACTION_SLICE_ID,
    canonical: false,
    fighters,
    phase: candidate.phase,
    vitals: Object.fromEntries(fighters.map((fighterId) => [fighterId, {
      hp: candidate.vitals[fighterId].hp,
      maxHp: candidate.vitals[fighterId].maxHp,
    }])),
    sanctuary: {
      resolved: candidate.sanctuary.resolved,
      used: candidate.sanctuary.used,
    },
    battleReceipts: receipts.map(clone),
    consequence: {
      unlocked: candidate.consequence.unlocked,
      acknowledged: candidate.consequence.acknowledged,
    },
  }), []);
}

function requireRun(candidate) {
  const checked = validateActionSliceRun(candidate);
  if (!checked.ok) throw new TypeError(checked.errors.join(' '));
  return checked.value;
}

function requireFighters(fighters) {
  const errors = [];
  validateFighterIds(fighters, errors, 'fighters');
  if (errors.length) throw new TypeError(errors.join(' '));
  return [...fighters];
}

function createVitals(fighters, supplied) {
  if (supplied !== undefined && !isPlainObject(supplied)) {
    throw new TypeError('fighterVitals must be a plain object.');
  }
  const result = {};
  for (const fighterId of fighters) {
    const provided = supplied?.[fighterId];
    if (provided !== undefined) {
      const providedErrors = [];
      exactKeys(provided, VITAL_KEYS, `fighterVitals.${fighterId}`, providedErrors);
      if (providedErrors.length) throw new TypeError(providedErrors.join(' '));
    }
    const maxHp = provided?.maxHp ?? ACTION_SLICE_FIGHTERS[fighterId].defaultMaxHp;
    const hp = provided?.hp ?? ACTION_SLICE_FIGHTERS[fighterId].defaultHp ?? maxHp;
    if (!Number.isSafeInteger(maxHp) || maxHp < 1 || maxHp > 999_999) {
      throw new TypeError(`fighterVitals.${fighterId}.maxHp must be a positive safe integer at most 999999.`);
    }
    if (!Number.isSafeInteger(hp) || hp < 0 || hp > maxHp) {
      throw new TypeError(`fighterVitals.${fighterId}.hp must be a safe integer from zero through maxHp.`);
    }
    result[fighterId] = { hp, maxHp };
  }
  for (const fighterId of Object.keys(supplied ?? {})) {
    if (!fighters.includes(fighterId)) throw new TypeError(`fighterVitals contains unselected fighter ${fighterId}.`);
  }
  return result;
}

export function createActionSliceRun({
  fighters = ACTION_SLICE_DEFAULT_FIGHTERS,
  fighterVitals,
} = {}) {
  const selected = requireFighters(fighters);
  return requireRun({
    schemaVersion: ACTION_SLICE_SCHEMA_VERSION,
    sliceId: ACTION_SLICE_ID,
    canonical: false,
    fighters: selected,
    phase: 'briefing',
    vitals: createVitals(selected, fighterVitals),
    sanctuary: { resolved: false, used: false },
    battleReceipts: [],
    consequence: { unlocked: false, acknowledged: false },
  });
}

/** Change the pair during briefing; selection resets the unstarted lab run. */
export function selectActionSliceFighters(run, fighters, { fighterVitals } = {}) {
  const current = requireRun(run);
  if (current.phase !== 'briefing') throw new RangeError('Fighters can only be selected during briefing.');
  return createActionSliceRun({ fighters, fighterVitals });
}

export function beginActionSliceRun(run) {
  const current = requireRun(run);
  if (current.phase !== 'briefing') throw new RangeError('The slice can only begin from briefing.');
  return requireRun({ ...clone(current), phase: 'ordinary-encounter' });
}

/** Return the one encounter the current phase is authorized to launch. */
export function getActionSliceExpectedEncounter(run) {
  const current = requireRun(run);
  const phase = PHASE_BY_ID.get(current.phase);
  return phase.encounterId ? deepFreeze(clone(phase)) : null;
}

/**
 * Settle a victory, preserve both selected fighters' resulting HP (zero for a
 * downed fighter omitted by the battle contract), and move to the next phase.
 */
export function recordActionSliceBattleReceipt(run, receipt) {
  const current = requireRun(run);
  const phase = PHASE_BY_ID.get(current.phase);
  if (phase.kind !== 'battle' || !phase.encounterId) {
    throw new RangeError(`Phase ${current.phase} does not accept a battle receipt.`);
  }
  const checked = validateBattleResultRecord(receipt, { expectedEncounterId: phase.encounterId });
  if (!checked.ok) throw new TypeError(checked.errors.join(' '));
  if (checked.value.result !== 'victory') throw new RangeError('A defeat cannot advance the vertical slice.');
  for (const fighterId of Object.keys(checked.value.partyVitals)) {
    if (!current.fighters.includes(fighterId)) {
      throw new TypeError(`Battle receipt contains unselected fighter ${fighterId}.`);
    }
  }
  const nextVitals = clone(current.vitals);
  for (const fighterId of current.fighters) {
    const hp = checked.value.partyVitals[fighterId]?.hp ?? 0;
    if (hp > nextVitals[fighterId].maxHp) {
      throw new RangeError(`Battle receipt HP for ${fighterId} exceeds slice maxHp.`);
    }
    nextVitals[fighterId].hp = hp;
  }
  const nextPhase = {
    'ordinary-encounter': 'platform-encounter',
    'platform-encounter': 'aya-sanctuary',
    'boss-encounter': 'consequence',
  }[current.phase];
  const consequence = current.phase === 'boss-encounter'
    ? { unlocked: true, acknowledged: false }
    : clone(current.consequence);
  return requireRun({
    ...clone(current),
    phase: nextPhase,
    vitals: nextVitals,
    battleReceipts: [...current.battleReceipts.map(clone), clone(checked.value)],
    consequence,
  });
}

/** Resolve Aya's stop once, either consuming its full-pair heal or declining it. */
export function resolveActionSliceSanctuary(run, { heal = true } = {}) {
  const current = requireRun(run);
  if (current.phase !== 'aya-sanctuary') throw new RangeError('Aya’s sanctuary is not available in this phase.');
  if (current.sanctuary.resolved) throw new RangeError('Aya’s sanctuary has already been resolved.');
  if (typeof heal !== 'boolean') throw new TypeError('heal must be boolean.');
  const vitals = clone(current.vitals);
  if (heal) {
    for (const fighterId of current.fighters) vitals[fighterId].hp = vitals[fighterId].maxHp;
  }
  return requireRun({
    ...clone(current),
    phase: 'boss-encounter',
    vitals,
    sanctuary: { resolved: true, used: heal },
  });
}

export function useActionSliceSanctuary(run) {
  return resolveActionSliceSanctuary(run, { heal: true });
}

export function leaveActionSliceSanctuary(run) {
  return resolveActionSliceSanctuary(run, { heal: false });
}

export function acknowledgeActionSliceConsequence(run) {
  const current = requireRun(run);
  if (current.phase !== 'consequence' || !current.consequence.unlocked) {
    throw new RangeError('The consequence is only available after the boss victory.');
  }
  if (current.consequence.acknowledged) throw new RangeError('The consequence is already acknowledged.');
  return requireRun({
    ...clone(current),
    phase: 'complete',
    consequence: { unlocked: true, acknowledged: true },
  });
}

/** A detached, deeply immutable view suitable for UI consumption. */
export function snapshotActionSliceRun(run) {
  return deepFreeze(clone(requireRun(run)));
}

export function serializeActionSliceRun(run) {
  return JSON.stringify(requireRun(run));
}

/**
 * There are deliberately no permissive legacy migrations yet. Unknown or
 * malformed schemas fail closed so session state cannot silently skip gates.
 */
export function migrateActionSliceRun(candidate) {
  if (!isPlainObject(candidate)) return validation(false, undefined, ['run must be a plain object.']);
  if (candidate.schemaVersion !== ACTION_SLICE_SCHEMA_VERSION) {
    return validation(false, undefined, [
      `No action-slice migration is available for schema version ${candidate.schemaVersion}.`,
    ]);
  }
  return validateActionSliceRun(candidate);
}

/** Parse and validate one sessionStorage value without fallback or repair. */
export function hydrateActionSliceRun(serialized) {
  if (typeof serialized !== 'string') {
    return validation(false, undefined, ['Serialized action-slice state must be a string.']);
  }
  let candidate;
  try {
    candidate = JSON.parse(serialized);
  } catch {
    return validation(false, undefined, ['Serialized action-slice state is not valid JSON.']);
  }
  return migrateActionSliceRun(candidate);
}
