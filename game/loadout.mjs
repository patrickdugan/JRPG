/**
 * Deterministic camp, inventory, equipment, and character-build rules.
 *
 * This module is intentionally DOM-free. Expected transaction failures return
 * `{ ok: false, state, reason }` and never spend currency or consume an item.
 */

import { PARTY_MEMBER_IDS } from './advancement.mjs';
import { CAMPAIGN } from './content/campaign.mjs';

export const LOADOUT_SCHEMA_VERSION = 1;
export const DEFAULT_LOADOUT_SAVE_KEY = `${CAMPAIGN.id}.loadout.v${LOADOUT_SCHEMA_VERSION}`;
export const EQUIPMENT_SLOTS = Object.freeze(['weapon', 'armor', 'accessory']);
export const VOW_SLOTS = 2;
export const MAX_ITEM_STACK = 99;
export const MAX_UPGRADE_LEVEL = 3;

const DELIVERY_KEYS = Object.freeze(['cut', 'pierce', 'crush', 'arcane']);
const ESSENCE_KEYS = Object.freeze(['ember', 'frost', 'storm', 'radiance', 'umbral']);
const STAT_KEYS = Object.freeze(['hp', 'mp', 'spirit', 'power', 'guard', 'arcana', 'speed']);

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const gear = (id, name, slot, price, allowedMembers, modifiers, description, upgradePerLevel = {}, options = {}) => ({
  id, name, kind: 'equipment', slot, price, sellPrice: Math.floor(price / 2),
  allowedMembers, modifiers, upgradePerLevel, description, ...options,
});
const supply = (id, name, price, effect, description, options = {}) => ({
  id, name, kind: 'consumable', price, sellPrice: Math.floor(price / 2), effect, description, ...options,
});

/** Incoming-damage resistance values are multipliers: lower is better. */
export const ITEM_CATALOGUE = deepFreeze({
  'courier-saber': gear('courier-saber', 'Courier Saber', 'weapon', 90, ['ren'], { stats: { power: 4, speed: 2 } }, 'A short road blade balanced for exact changes of direction.', { power: 2 }),
  'warding-brush': gear('warding-brush', 'Ironwood Warding Brush', 'weapon', 95, ['aya', 'kiku'], { stats: { arcana: 5, mp: 8 } }, 'A lacquered brush that holds medicine ink and warding script.', { arcana: 2, mp: 2 }),
  'salt-etched-rapier': gear('salt-etched-rapier', 'Salt-Etched Rapier', 'weapon', 110, ['lise'], { stats: { power: 5, speed: 3 }, essence: { radiance: 0.95 } }, 'A foreign hunter blade reworked by a Hoshigawa smith.', { power: 2, speed: 1 }),
  'dusk-censer': gear('dusk-censer', 'Dusk Censer', 'weapon', 105, ['mateus'], { stats: { arcana: 5, spirit: 10 }, essence: { umbral: 0.9 } }, 'A sealed censer whose chain doubles as a measured weapon.', { arcana: 2, spirit: 3 }),
  'cedar-maul': gear('cedar-maul', 'Cedar-Heart Maul', 'weapon', 100, ['genta'], { stats: { power: 5, guard: 2 } }, 'A shrine-repair mallet reinforced for the road.', { power: 2, guard: 1 }),
  'pilgrim-knife': gear('pilgrim-knife', 'Pilgrim Utility Knife', 'weapon', 55, [...PARTY_MEMBER_IDS], { stats: { power: 2, speed: 1 } }, 'A plain tool that remains useful when fine weapons draw attention.', { power: 1 }),
  'dawnsteel-blade': gear('dawnsteel-blade', 'Dawnsteel Blade', 'weapon', 340, ['ren', 'lise'], { stats: { power: 10, speed: 4 }, essence: { radiance: 0.85 }, skillIds: ['dawn-bolt'] }, 'Bell metal folded with bright river iron.', { power: 3, speed: 1 }),
  'bellglass-focus': gear('bellglass-focus', 'Bellglass Focus', 'weapon', 360, ['aya', 'mateus', 'kiku'], { stats: { arcana: 11, mp: 14, spirit: 12 }, skillIds: ['warding-script'] }, 'A harmless fragment set behind layered paper and glass.', { arcana: 3, mp: 3 }),
  'quilted-haori': gear('quilted-haori', 'Quilted Road Haori', 'armor', 70, [...PARTY_MEMBER_IDS], { stats: { hp: 18, guard: 3 } }, 'Quiet, repairable protection for long journeys.', { hp: 5, guard: 1 }),
  'river-silk-robe': gear('river-silk-robe', 'River-Silk Robe', 'armor', 85, ['aya', 'lise', 'mateus', 'kiku'], { stats: { mp: 10, arcana: 2 }, essence: { ember: 0.9 } }, 'Closely woven silk treated to shed sparks.', { mp: 3, arcana: 1 }),
  'bell-iron-lamellar': gear('bell-iron-lamellar', 'Bell-Iron Lamellar', 'armor', 135, ['ren', 'genta'], { stats: { hp: 28, guard: 7, speed: -2 }, delivery: { cut: 0.85, pierce: 0.9 } }, 'Recovered plates relaced so no court crest remains.', { hp: 8, guard: 2 }),
  'ash-lacquer-coat': gear('ash-lacquer-coat', 'Ash-Lacquer Coat', 'armor', 210, [...PARTY_MEMBER_IDS], { stats: { hp: 24, guard: 5 }, essence: { ember: 0.8, umbral: 0.9 }, statusResistance: { burn: 0.3 } }, 'Layered lacquer marks heat before it reaches the wearer.', { hp: 7, guard: 2 }),
  'dawn-thread-mantle': gear('dawn-thread-mantle', 'Dawn-Thread Mantle', 'armor', 320, ['aya', 'lise', 'mateus', 'kiku'], { stats: { hp: 20, mp: 16, arcana: 5 }, essence: { radiance: 0.8, umbral: 0.75 }, statusResistance: { dread: 0.35 } }, 'Lantern thread catches violet light and makes it readable.', { hp: 6, mp: 4, arcana: 2 }),
  'road-sandals': gear('road-sandals', 'Measured-Step Sandals', 'accessory', 60, [...PARTY_MEMBER_IDS], { stats: { speed: 3 }, paceDelta: 1 }, 'Knotted soles make each Pace step easy to count.', { speed: 1 }),
  'lantern-bead-cord': gear('lantern-bead-cord', 'Lantern Bead Cord', 'accessory', 75, [...PARTY_MEMBER_IDS], { stats: { spirit: 8 }, statusResistance: { dread: 0.25, bound: 0.15 } }, 'A civic signal cord: one bead for every safe house.', { spirit: 3 }),
  'frostglass-pin': gear('frostglass-pin', 'Frostglass Pin', 'accessory', 105, [...PARTY_MEMBER_IDS], { essence: { frost: 0.75, ember: 1.1 }, statusResistance: { burn: 0.2 } }, 'Cold glass that warns of a sudden change in temperature.', {}),
  'storm-kite-toggle': gear('storm-kite-toggle', 'Storm-Kite Toggle', 'accessory', 110, [...PARTY_MEMBER_IDS], { essence: { storm: 0.75 }, stats: { speed: 2 } }, 'A bone toggle carved with the route of a summer squall.', { speed: 1 }),
  'iron-knot': gear('iron-knot', 'Iron Anchor Knot', 'accessory', 95, [...PARTY_MEMBER_IDS], { stats: { guard: 3 }, delivery: { crush: 0.8 }, statusResistance: { bound: 0.35 } }, 'A weighted knot used by rescue crews in flood water.', { guard: 1 }),
  'cedar-route-note': gear('cedar-route-note', 'Cedar Route Note', 'accessory', 0, [...PARTY_MEMBER_IDS], { stats: { speed: 1 }, recoveryPulsesDelta: -1 }, 'A reward-only courier note with every safe turn marked.', {}, { rewardOnly: true }),
  'temple-charm': gear('temple-charm', 'Temple Charm', 'accessory', 0, [...PARTY_MEMBER_IDS], { stats: { spirit: 6 }, essence: { radiance: 0.9 }, statusResistance: { dread: 0.15 } }, 'A recovered route charm kept as witness evidence, never treated as a sacred weapon.', {}, { rewardOnly: true, aliases: ['Temple Charm'] }),
  'river-salve': supply('river-salve', 'River Salve', 28, { hp: 80 }, 'Restores 80 HP to one ally.', { aliases: ['River Salve'] }),
  'ward-tonic': supply('ward-tonic', 'Ward Tonic', 42, { mp: 35, clearStatuses: ['bound', 'silenced'] }, 'Restores 35 MP and clears Bound or Silenced.', { aliases: ['Ward Tonic'] }),
  'spirit-tea': supply('spirit-tea', 'Smoked Spirit Tea', 38, { spirit: 35 }, 'Restores 35 Spirit.', { aliases: ['Spirit Tea'] }),
  'dawn-salt': supply('dawn-salt', 'Dawn Salt Packet', 55, { clearStatuses: ['dread', 'cursed', 'umbral-mark'] }, 'Clears Dread, Curse, and Umbral Mark.', { aliases: ['Dawn Salt'] }),
  'traveler-plum': supply('traveler-plum', 'Traveler Plum', 24, { hp: 35, mp: 15, spirit: 15 }, 'Restores a small amount of HP, MP, and Spirit.'),
});

const vow = (id, name, cost, allowedMembers, modifiers, description) => ({ id, name, cost, allowedMembers, modifiers, description });

export const VOW_CATALOGUE = deepFreeze({
  'open-lantern': vow('open-lantern', 'Vow of the Open Lantern', 0, [...PARTY_MEMBER_IDS], { stats: { spirit: 8 }, statusResistance: { dread: 0.2 } }, 'Keep a route visible for anyone who follows.'),
  'measured-breath': vow('measured-breath', 'Vow of Measured Breath', 0, [...PARTY_MEMBER_IDS], { stats: { speed: 2 }, recoveryPulsesDelta: -1 }, 'Never spend movement or recovery without counting it.'),
  'shared-burden': vow('shared-burden', 'Vow of the Shared Burden', 0, [...PARTY_MEMBER_IDS], { stats: { hp: 16, guard: 2 }, statusResistance: { bound: 0.15 } }, 'Stand where another person would otherwise be struck.'),
  'unbroken-route': vow('unbroken-route', 'Courier\'s Vow: Unbroken Route', 0, ['ren'], { stats: { speed: 3, power: 2 }, paceDelta: 1 }, 'Ren finishes the route even after the plan changes.'),
  'witnessing-ink': vow('witnessing-ink', 'Scribe\'s Vow: Witnessing Ink', 0, ['aya'], { stats: { arcana: 4, mp: 8 }, skillIds: ['warding-script'] }, 'Aya records a name before she records a victory.'),
  'hunter-dawn': vow('hunter-dawn', 'Hunter\'s Vow: Answer the Dawn', 0, ['lise'], { stats: { power: 3 }, essence: { radiance: 0.85 }, skillIds: ['dawn-bolt'] }, 'Lise turns inherited knowledge toward rescue.'),
  'returned-name': vow('returned-name', 'Vow of the Returned Name', 0, ['mateus'], { stats: { arcana: 4, spirit: 10 }, essence: { umbral: 0.8 }, statusResistance: { dread: 0.3 } }, 'Mateus refuses the title the court made for him.'),
  'standing-bridge': vow('standing-bridge', 'Vow of the Standing Bridge', 0, ['genta'], { stats: { hp: 24, guard: 4 }, delivery: { crush: 0.85 } }, 'Genta holds until every traveler is across.'),
  'cold-remedy': vow('cold-remedy', 'Vow of the Cold Remedy', 0, ['kiku'], { stats: { arcana: 3, mp: 6 }, essence: { frost: 0.8 }, statusResistance: { burn: 0.35 } }, 'Kiku treats the wound and the cause.'),
  'no-secret-chain': vow('no-secret-chain', 'Vow Against the Secret Chain', 180, [...PARTY_MEMBER_IDS], { statusResistance: { bound: 0.5, silenced: 0.25 }, delivery: { pierce: 0.9 } }, 'No command is allowed to remain invisible.'),
  'clear-morning': vow('clear-morning', 'Vow of the Clear Morning', 220, [...PARTY_MEMBER_IDS], { essence: { radiance: 0.8, umbral: 0.8 }, statusResistance: { dread: 0.4 } }, 'Make the next morning possible, then let others choose it.'),
  'patient-strike': vow('patient-strike', 'Vow of the Patient Strike', 200, ['ren', 'lise', 'genta'], { stats: { power: 5, speed: -1 }, recoveryPulsesDelta: 1 }, 'Trade quick recovery for one deliberate opening.'),
});

export const CAMP_CATALOGUE = deepFreeze({
  'roadside-lantern': { id: 'roadside-lantern', name: 'Roadside Lantern', cost: 0, restore: { hp: 0.5, mp: 0.25, spirit: 0.35 }, clearStatuses: [], description: 'A free, exposed pause. It restores only part of the party.' },
  'lantern-safehouse': { id: 'lantern-safehouse', name: 'Lantern Safehouse', cost: 35, restore: { hp: 1, mp: 0.75, spirit: 1 }, clearStatuses: ['burn', 'bleed', 'bound', 'silenced'], description: 'A concealed kitchen, clean water, and a guarded sleeping room.' },
  'hidden-infirmary': { id: 'hidden-infirmary', name: 'Hidden Infirmary', cost: 70, restore: { hp: 1, mp: 1, spirit: 1 }, clearStatuses: 'all', description: 'Full care, status treatment, and a careful equipment check.' },
});

export const ITEM_IDS = Object.freeze(Object.keys(ITEM_CATALOGUE));
export const VOW_IDS = Object.freeze(Object.keys(VOW_CATALOGUE));

const BASE_VITALS = deepFreeze({
  ren: { hp: 104, mp: 24, spirit: 30 }, aya: { hp: 82, mp: 42, spirit: 42 },
  lise: { hp: 91, mp: 29, spirit: 34 }, mateus: { hp: 98, mp: 48, spirit: 48 },
  genta: { hp: 128, mp: 18, spirit: 24 }, kiku: { hp: 86, mp: 45, spirit: 44 },
});

const STARTING_EQUIPMENT = deepFreeze({
  ren: { weapon: 'courier-saber', armor: 'quilted-haori', accessory: 'road-sandals' },
  aya: { weapon: 'warding-brush', armor: 'river-silk-robe', accessory: 'lantern-bead-cord' },
  lise: { weapon: 'salt-etched-rapier', armor: 'quilted-haori', accessory: 'road-sandals' },
  mateus: { weapon: 'dusk-censer', armor: 'river-silk-robe', accessory: 'lantern-bead-cord' },
  genta: { weapon: 'cedar-maul', armor: 'bell-iron-lamellar', accessory: 'iron-knot' },
  kiku: { weapon: 'warding-brush', armor: 'river-silk-robe', accessory: 'frostglass-pin' },
});

const STARTING_VOWS = deepFreeze({
  ren: ['unbroken-route'], aya: ['witnessing-ink'], lise: ['hunter-dawn'],
  mateus: ['returned-name'], genta: ['standing-bridge'], kiku: ['cold-remedy'],
});

const STARTING_UNLOCKED_VOWS = Object.freeze(VOW_IDS.filter((id) => VOW_CATALOGUE[id].cost === 0));
const STATE_KEYS = Object.freeze(['schemaVersion', 'campaignId', 'currency', 'inventory', 'equipment', 'vows', 'unlockedVows', 'upgrades', 'vitals', 'revision']);
const VITAL_KEYS = Object.freeze(['hp', 'maxHp', 'mp', 'maxMp', 'spirit', 'maxSpirit', 'statuses']);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalMap(source, order, include = () => true) {
  const result = {};
  for (const key of order) if (Object.hasOwn(source, key) && include(source[key], key)) result[key] = source[key];
  return result;
}

function buildState({ currency, inventory, equipment, vows, unlockedVows, upgrades, vitals, revision }) {
  const canonicalEquipment = {};
  const canonicalVows = {};
  const canonicalVitals = {};
  for (const memberId of PARTY_MEMBER_IDS) {
    canonicalEquipment[memberId] = Object.freeze(Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, equipment[memberId][slot] ?? null])));
    canonicalVows[memberId] = Object.freeze([...vows[memberId]]);
    canonicalVitals[memberId] = Object.freeze({ ...vitals[memberId], statuses: Object.freeze([...vitals[memberId].statuses].sort()) });
  }
  return Object.freeze({
    schemaVersion: LOADOUT_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    currency,
    inventory: Object.freeze(canonicalMap(inventory, ITEM_IDS, (quantity) => quantity > 0)),
    equipment: Object.freeze(canonicalEquipment),
    vows: Object.freeze(canonicalVows),
    unlockedVows: Object.freeze(VOW_IDS.filter((id) => unlockedVows.includes(id))),
    upgrades: Object.freeze(canonicalMap(upgrades, ITEM_IDS, (level, id) => ITEM_CATALOGUE[id].kind === 'equipment' && level > 0)),
    vitals: Object.freeze(canonicalVitals),
    revision,
  });
}

export function createLoadoutState() {
  const vitals = {};
  for (const memberId of PARTY_MEMBER_IDS) {
    const base = BASE_VITALS[memberId];
    vitals[memberId] = { hp: base.hp, maxHp: base.hp, mp: base.mp, maxMp: base.mp, spirit: base.spirit, maxSpirit: base.spirit, statuses: [] };
  }
  return buildState({
    currency: 80,
    inventory: { 'river-salve': 3, 'ward-tonic': 2, 'spirit-tea': 1, 'pilgrim-knife': 1 },
    equipment: STARTING_EQUIPMENT,
    vows: STARTING_VOWS,
    unlockedVows: STARTING_UNLOCKED_VOWS,
    upgrades: {},
    vitals,
    revision: 0,
  });
}

const validation = (ok, value, errors = []) => Object.freeze({ ok, ...(ok ? { value } : {}), errors: Object.freeze([...errors]) });
const exactKeys = (object, keys, label, errors) => {
  const expected = new Set(keys);
  for (const key of keys) if (!Object.hasOwn(object, key)) errors.push(`${label}.${key} is required.`);
  for (const key of Object.keys(object)) if (!expected.has(key)) errors.push(`${label}.${key} is not supported.`);
};

/** Validate and canonicalize an untrusted loadout payload. */
export function validateLoadoutPayload(payload) {
  try {
    const errors = [];
    if (!isPlainObject(payload)) return validation(false, undefined, ['Save payload must be a plain object.']);
    exactKeys(payload, STATE_KEYS, 'save', errors);
    if (payload.schemaVersion !== LOADOUT_SCHEMA_VERSION) errors.push(`save.schemaVersion must equal ${LOADOUT_SCHEMA_VERSION}.`);
    if (payload.campaignId !== CAMPAIGN.id) errors.push(`save.campaignId must equal ${CAMPAIGN.id}.`);
    if (!Number.isSafeInteger(payload.currency) || payload.currency < 0) errors.push('save.currency must be a non-negative safe integer.');
    if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) errors.push('save.revision must be a non-negative safe integer.');

    const inventory = isPlainObject(payload.inventory) ? payload.inventory : {};
    if (!isPlainObject(payload.inventory)) errors.push('save.inventory must be a plain object.');
    for (const [id, quantity] of Object.entries(inventory)) {
      if (!ITEM_CATALOGUE[id]) errors.push(`save.inventory contains unknown item ${id}.`);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_ITEM_STACK) errors.push(`save.inventory.${id} must be an integer from 1 to ${MAX_ITEM_STACK}.`);
    }
    const canonicalInventoryKeys = ITEM_IDS.filter((id) => Object.hasOwn(inventory, id));
    if (canonicalInventoryKeys.some((id, index) => id !== Object.keys(inventory)[index])) errors.push('save.inventory must use catalogue order.');

    const equipment = isPlainObject(payload.equipment) ? payload.equipment : {};
    if (!isPlainObject(payload.equipment)) errors.push('save.equipment must be a plain object.');
    exactKeys(equipment, PARTY_MEMBER_IDS, 'save.equipment', errors);
    for (const memberId of PARTY_MEMBER_IDS) {
      const memberEquipment = equipment[memberId];
      if (!isPlainObject(memberEquipment)) { errors.push(`save.equipment.${memberId} must be a plain object.`); continue; }
      exactKeys(memberEquipment, EQUIPMENT_SLOTS, `save.equipment.${memberId}`, errors);
      for (const slot of EQUIPMENT_SLOTS) {
        const id = memberEquipment[slot];
        if (id === null) continue;
        const item = ITEM_CATALOGUE[id];
        if (!item || item.kind !== 'equipment' || item.slot !== slot) errors.push(`save.equipment.${memberId}.${slot} is not valid ${slot} equipment.`);
        else if (!item.allowedMembers.includes(memberId)) errors.push(`${item.name} cannot be equipped by ${memberId}.`);
      }
    }

    const unlockedVows = Array.isArray(payload.unlockedVows) ? payload.unlockedVows : [];
    if (!Array.isArray(payload.unlockedVows)) errors.push('save.unlockedVows must be an array.');
    const seenUnlocked = new Set();
    for (const id of unlockedVows) {
      if (!VOW_CATALOGUE[id]) errors.push(`save.unlockedVows contains unknown vow ${id}.`);
      if (seenUnlocked.has(id)) errors.push(`save.unlockedVows contains duplicate ${id}.`);
      seenUnlocked.add(id);
    }
    const canonicalUnlocked = VOW_IDS.filter((id) => seenUnlocked.has(id));
    if (canonicalUnlocked.some((id, index) => id !== unlockedVows[index])) errors.push('save.unlockedVows must use catalogue order.');

    const vows = isPlainObject(payload.vows) ? payload.vows : {};
    if (!isPlainObject(payload.vows)) errors.push('save.vows must be a plain object.');
    exactKeys(vows, PARTY_MEMBER_IDS, 'save.vows', errors);
    for (const memberId of PARTY_MEMBER_IDS) {
      const memberVows = vows[memberId];
      if (!Array.isArray(memberVows) || memberVows.length > VOW_SLOTS) { errors.push(`save.vows.${memberId} must contain at most ${VOW_SLOTS} vows.`); continue; }
      const seen = new Set();
      for (const id of memberVows) {
        const definition = VOW_CATALOGUE[id];
        if (!definition) errors.push(`save.vows.${memberId} contains unknown vow ${id}.`);
        else {
          if (!seenUnlocked.has(id)) errors.push(`save.vows.${memberId} contains locked vow ${id}.`);
          if (!definition.allowedMembers.includes(memberId)) errors.push(`${definition.name} cannot be used by ${memberId}.`);
        }
        if (seen.has(id)) errors.push(`save.vows.${memberId} contains duplicate ${id}.`);
        seen.add(id);
      }
    }

    const upgrades = isPlainObject(payload.upgrades) ? payload.upgrades : {};
    if (!isPlainObject(payload.upgrades)) errors.push('save.upgrades must be a plain object.');
    for (const [id, level] of Object.entries(upgrades)) {
      if (ITEM_CATALOGUE[id]?.kind !== 'equipment') errors.push(`save.upgrades contains non-equipment item ${id}.`);
      if (!Number.isInteger(level) || level < 1 || level > MAX_UPGRADE_LEVEL) errors.push(`save.upgrades.${id} must be from 1 to ${MAX_UPGRADE_LEVEL}.`);
    }
    const canonicalUpgradeKeys = ITEM_IDS.filter((id) => Object.hasOwn(upgrades, id));
    if (canonicalUpgradeKeys.some((id, index) => id !== Object.keys(upgrades)[index])) errors.push('save.upgrades must use catalogue order.');

    const vitals = isPlainObject(payload.vitals) ? payload.vitals : {};
    if (!isPlainObject(payload.vitals)) errors.push('save.vitals must be a plain object.');
    exactKeys(vitals, PARTY_MEMBER_IDS, 'save.vitals', errors);
    for (const memberId of PARTY_MEMBER_IDS) {
      const memberVitals = vitals[memberId];
      if (!isPlainObject(memberVitals)) { errors.push(`save.vitals.${memberId} must be a plain object.`); continue; }
      exactKeys(memberVitals, VITAL_KEYS, `save.vitals.${memberId}`, errors);
      for (const [current, maximum] of [['hp', 'maxHp'], ['mp', 'maxMp'], ['spirit', 'maxSpirit']]) {
        if (!Number.isSafeInteger(memberVitals[maximum]) || memberVitals[maximum] < 1) errors.push(`save.vitals.${memberId}.${maximum} must be a positive safe integer.`);
        if (!Number.isSafeInteger(memberVitals[current]) || memberVitals[current] < 0 || memberVitals[current] > memberVitals[maximum]) errors.push(`save.vitals.${memberId}.${current} must be between 0 and ${maximum}.`);
      }
      if (!Array.isArray(memberVitals.statuses)) errors.push(`save.vitals.${memberId}.statuses must be an array.`);
      else {
        const sorted = [...new Set(memberVitals.statuses)].sort();
        if (memberVitals.statuses.some((status, index) => typeof status !== 'string' || !status.trim() || status !== sorted[index])) errors.push(`save.vitals.${memberId}.statuses must contain unique non-empty strings in alphabetical order.`);
      }
    }

    if (errors.length) return validation(false, undefined, errors);
    return validation(true, buildState({ currency: payload.currency, inventory, equipment, vows, unlockedVows, upgrades, vitals, revision: payload.revision }));
  } catch {
    return validation(false, undefined, ['Save payload could not be read safely.']);
  }
}

function assertState(state) {
  const checked = validateLoadoutPayload(state);
  if (!checked.ok) throw new TypeError(`Invalid loadout state: ${checked.errors.join(' ')}`);
  // Validation proves the supplied state is canonical. Keeping its identity is
  // useful to UI stores: a failed transaction can return the exact same object.
  return state;
}

export function serializeLoadoutState(state) {
  return JSON.stringify(assertState(state));
}

/** Parse and validate a string or validate an already-parsed payload. */
export function hydrateLoadoutState(payload) {
  try {
    return validateLoadoutPayload(typeof payload === 'string' ? JSON.parse(payload) : payload);
  } catch {
    return validation(false, undefined, ['Save payload is not valid JSON.']);
  }
}

/** Small injectable adapter for localStorage or any compatible key/value store. */
export function createLoadoutStorageAdapter(storage = globalThis.localStorage, key = DEFAULT_LOADOUT_SAVE_KEY) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    throw new TypeError('Storage must implement getItem, setItem, and removeItem.');
  }
  if (typeof key !== 'string' || !key.trim()) throw new TypeError('Storage key must be a non-empty string.');
  return Object.freeze({
    key,
    load() {
      try {
        const serialized = storage.getItem(key);
        if (serialized === null) return deepFreeze({ ok: true, value: createLoadoutState(), errors: [], source: 'default' });
        const result = hydrateLoadoutState(serialized);
        return deepFreeze({ ...result, source: 'storage' });
      } catch {
        return deepFreeze({ ok: false, errors: ['Loadout save could not be read from storage.'], source: 'storage' });
      }
    },
    save(state) {
      try {
        storage.setItem(key, serializeLoadoutState(state));
        return deepFreeze({ ok: true, state, key });
      } catch {
        return deepFreeze({ ok: false, state, key, reason: 'Loadout save could not be written to storage.' });
      }
    },
    clear() {
      try {
        storage.removeItem(key);
        return deepFreeze({ ok: true, key });
      } catch {
        return deepFreeze({ ok: false, key, reason: 'Loadout save could not be removed from storage.' });
      }
    },
  });
}

function nextState(snapshot, changes) {
  return buildState({ ...snapshot, ...changes, revision: snapshot.revision + 1 });
}
const failed = (state, reason) => Object.freeze({ ok: false, state, reason });
const succeeded = (state, receipt) => Object.freeze({ ok: true, state, receipt: deepFreeze(receipt) });
const memberExists = (id) => PARTY_MEMBER_IDS.includes(id);

function resolveItemId(idOrName) {
  if (ITEM_CATALOGUE[idOrName]) return idOrName;
  const normalized = String(idOrName ?? '').trim().toLocaleLowerCase('en-US');
  return ITEM_IDS.find((id) => {
    const item = ITEM_CATALOGUE[id];
    return item.name.toLocaleLowerCase('en-US') === normalized || (item.aliases ?? []).some((alias) => alias.toLocaleLowerCase('en-US') === normalized);
  }) ?? null;
}

/** Grant battle/shop rewards by catalogue ID or authored display name. Unknown entries are reported and ignored. */
export function grantInventory(state, grant = {}) {
  const snapshot = assertState(state);
  const currency = grant.currency ?? 0;
  if (!Number.isSafeInteger(currency) || currency < 0) return failed(snapshot, 'Granted currency must be a non-negative safe integer.');
  const entries = Array.isArray(grant.items) ? grant.items : Object.entries(grant.items ?? {}).map(([id, quantity]) => ({ id, quantity }));
  const inventory = { ...snapshot.inventory };
  const granted = [];
  const unknown = [];
  for (const entry of entries) {
    const rawId = typeof entry === 'string' ? entry : (entry.id ?? entry.name);
    const quantity = typeof entry === 'string' ? 1 : (entry.quantity ?? 1);
    const id = resolveItemId(rawId);
    if (!id) { unknown.push(String(rawId)); continue; }
    if (!Number.isSafeInteger(quantity) || quantity < 1) return failed(snapshot, `Grant quantity for ${rawId} must be a positive safe integer.`);
    if ((inventory[id] ?? 0) + quantity > MAX_ITEM_STACK) return failed(snapshot, `${ITEM_CATALOGUE[id].name} would exceed the stack limit.`);
    inventory[id] = (inventory[id] ?? 0) + quantity;
    granted.push({ id, quantity });
  }
  if (!currency && !granted.length) return failed(snapshot, unknown.length ? 'No recognized items were granted.' : 'The grant is empty.');
  if (!Number.isSafeInteger(snapshot.currency + currency)) return failed(snapshot, 'The currency grant would exceed the safe integer limit.');
  const updated = nextState(snapshot, { currency: snapshot.currency + currency, inventory });
  return succeeded(updated, { type: 'grant', currency, items: granted, unknown });
}

export function buyItem(state, itemId, quantity = 1) {
  const snapshot = assertState(state);
  const item = ITEM_CATALOGUE[itemId];
  if (!item) return failed(snapshot, `Unknown item: ${itemId}`);
  if (!Number.isSafeInteger(quantity) || quantity < 1) return failed(snapshot, 'Purchase quantity must be a positive safe integer.');
  if (item.rewardOnly || item.price <= 0) return failed(snapshot, `${item.name} is not sold in shops.`);
  if ((snapshot.inventory[itemId] ?? 0) + quantity > MAX_ITEM_STACK) return failed(snapshot, `${item.name} would exceed the stack limit.`);
  const cost = item.price * quantity;
  if (!Number.isSafeInteger(cost) || snapshot.currency < cost) return failed(snapshot, `Not enough currency for ${item.name}.`);
  const inventory = { ...snapshot.inventory, [itemId]: (snapshot.inventory[itemId] ?? 0) + quantity };
  return succeeded(nextState(snapshot, { currency: snapshot.currency - cost, inventory }), { type: 'buy', itemId, quantity, cost });
}

export function sellItem(state, itemId, quantity = 1) {
  const snapshot = assertState(state);
  const item = ITEM_CATALOGUE[itemId];
  if (!item) return failed(snapshot, `Unknown item: ${itemId}`);
  if (!Number.isSafeInteger(quantity) || quantity < 1) return failed(snapshot, 'Sale quantity must be a positive safe integer.');
  if (!item.sellPrice) return failed(snapshot, `${item.name} cannot be sold.`);
  if ((snapshot.inventory[itemId] ?? 0) < quantity) return failed(snapshot, `Not enough unequipped ${item.name} to sell.`);
  const inventory = { ...snapshot.inventory, [itemId]: snapshot.inventory[itemId] - quantity };
  const proceeds = item.sellPrice * quantity;
  if (!Number.isSafeInteger(snapshot.currency + proceeds)) return failed(snapshot, 'The sale would exceed the safe currency limit.');
  return succeeded(nextState(snapshot, { currency: snapshot.currency + proceeds, inventory }), { type: 'sell', itemId, quantity, proceeds });
}

export function equipItem(state, memberId, itemId) {
  const snapshot = assertState(state);
  if (!memberExists(memberId)) return failed(snapshot, `Unknown party member: ${memberId}`);
  const item = ITEM_CATALOGUE[itemId];
  if (!item || item.kind !== 'equipment') return failed(snapshot, `Unknown equipment item: ${itemId}`);
  if (!item.allowedMembers.includes(memberId)) return failed(snapshot, `${item.name} cannot be equipped by ${memberId}.`);
  if (snapshot.equipment[memberId][item.slot] === itemId) return succeeded(snapshot, { type: 'equip', memberId, itemId, slot: item.slot, changed: false });
  if (!(snapshot.inventory[itemId] > 0)) return failed(snapshot, `${item.name} is not available in inventory.`);
  const replacedItemId = snapshot.equipment[memberId][item.slot];
  if (replacedItemId && (snapshot.inventory[replacedItemId] ?? 0) >= MAX_ITEM_STACK) return failed(snapshot, `${ITEM_CATALOGUE[replacedItemId].name} inventory is full.`);
  const equipment = Object.fromEntries(PARTY_MEMBER_IDS.map((id) => [id, { ...snapshot.equipment[id] }]));
  const inventory = { ...snapshot.inventory, [itemId]: snapshot.inventory[itemId] - 1 };
  if (replacedItemId) inventory[replacedItemId] = (inventory[replacedItemId] ?? 0) + 1;
  equipment[memberId][item.slot] = itemId;
  return succeeded(nextState(snapshot, { equipment, inventory }), { type: 'equip', memberId, itemId, slot: item.slot, replacedItemId, changed: true });
}

export function unequipItem(state, memberId, slot) {
  const snapshot = assertState(state);
  if (!memberExists(memberId)) return failed(snapshot, `Unknown party member: ${memberId}`);
  if (!EQUIPMENT_SLOTS.includes(slot)) return failed(snapshot, `Unknown equipment slot: ${slot}`);
  const itemId = snapshot.equipment[memberId][slot];
  if (!itemId) return failed(snapshot, `${memberId} has no ${slot} equipped.`);
  if ((snapshot.inventory[itemId] ?? 0) >= MAX_ITEM_STACK) return failed(snapshot, `${ITEM_CATALOGUE[itemId].name} inventory is full.`);
  const equipment = Object.fromEntries(PARTY_MEMBER_IDS.map((id) => [id, { ...snapshot.equipment[id] }]));
  equipment[memberId][slot] = null;
  const inventory = { ...snapshot.inventory, [itemId]: (snapshot.inventory[itemId] ?? 0) + 1 };
  return succeeded(nextState(snapshot, { equipment, inventory }), { type: 'unequip', memberId, itemId, slot });
}

function ownsItem(snapshot, itemId) {
  return Boolean(snapshot.inventory[itemId]) || PARTY_MEMBER_IDS.some((memberId) => EQUIPMENT_SLOTS.some((slot) => snapshot.equipment[memberId][slot] === itemId));
}

export function upgradeItem(state, itemId) {
  const snapshot = assertState(state);
  const item = ITEM_CATALOGUE[itemId];
  if (!item || item.kind !== 'equipment') return failed(snapshot, `Unknown equipment item: ${itemId}`);
  if (!ownsItem(snapshot, itemId)) return failed(snapshot, `${item.name} must be owned before it can be upgraded.`);
  const currentLevel = snapshot.upgrades[itemId] ?? 0;
  if (currentLevel >= MAX_UPGRADE_LEVEL) return failed(snapshot, `${item.name} is already at upgrade +${MAX_UPGRADE_LEVEL}.`);
  const cost = Math.max(30, Math.ceil(Math.max(60, item.price) * (0.5 + (currentLevel * 0.35))));
  if (snapshot.currency < cost) return failed(snapshot, `Not enough currency to upgrade ${item.name}.`);
  const upgrades = { ...snapshot.upgrades, [itemId]: currentLevel + 1 };
  return succeeded(nextState(snapshot, { currency: snapshot.currency - cost, upgrades }), { type: 'upgrade', itemId, from: currentLevel, to: currentLevel + 1, cost });
}

export function learnVow(state, vowId) {
  const snapshot = assertState(state);
  const definition = VOW_CATALOGUE[vowId];
  if (!definition) return failed(snapshot, `Unknown vow: ${vowId}`);
  if (snapshot.unlockedVows.includes(vowId)) return succeeded(snapshot, { type: 'learn-vow', vowId, changed: false, cost: 0 });
  if (snapshot.currency < definition.cost) return failed(snapshot, `Not enough currency to learn ${definition.name}.`);
  return succeeded(nextState(snapshot, { currency: snapshot.currency - definition.cost, unlockedVows: [...snapshot.unlockedVows, vowId] }), { type: 'learn-vow', vowId, changed: true, cost: definition.cost });
}

export function equipVow(state, memberId, vowId) {
  const snapshot = assertState(state);
  if (!memberExists(memberId)) return failed(snapshot, `Unknown party member: ${memberId}`);
  const definition = VOW_CATALOGUE[vowId];
  if (!definition) return failed(snapshot, `Unknown vow: ${vowId}`);
  if (!snapshot.unlockedVows.includes(vowId)) return failed(snapshot, `${definition.name} has not been learned.`);
  if (!definition.allowedMembers.includes(memberId)) return failed(snapshot, `${definition.name} cannot be used by ${memberId}.`);
  if (snapshot.vows[memberId].includes(vowId)) return succeeded(snapshot, { type: 'equip-vow', memberId, vowId, changed: false });
  if (snapshot.vows[memberId].length >= VOW_SLOTS) return failed(snapshot, `${memberId} has no open Vow slot.`);
  const vows = Object.fromEntries(PARTY_MEMBER_IDS.map((id) => [id, [...snapshot.vows[id]]]));
  vows[memberId].push(vowId);
  return succeeded(nextState(snapshot, { vows }), { type: 'equip-vow', memberId, vowId, changed: true });
}

export function unequipVow(state, memberId, vowId) {
  const snapshot = assertState(state);
  if (!memberExists(memberId)) return failed(snapshot, `Unknown party member: ${memberId}`);
  if (!snapshot.vows[memberId].includes(vowId)) return failed(snapshot, `${memberId} does not have ${vowId} equipped.`);
  const vows = Object.fromEntries(PARTY_MEMBER_IDS.map((id) => [id, snapshot.vows[id].filter((id) => id !== vowId)]));
  return succeeded(nextState(snapshot, { vows }), { type: 'unequip-vow', memberId, vowId });
}

const rounded = (value) => Math.round(value * 10000) / 10000;
const emptyStats = () => Object.fromEntries(STAT_KEYS.map((key) => [key, 0]));
const neutral = (keys) => Object.fromEntries(keys.map((key) => [key, 1]));

/** Return deterministic modifiers ready to merge into a battle party profile. */
export function getLoadoutModifiers(state, memberId) {
  const snapshot = assertState(state);
  if (!memberExists(memberId)) throw new RangeError(`Unknown party member: ${memberId}`);
  const equippedIds = EQUIPMENT_SLOTS.map((slot) => snapshot.equipment[memberId][slot]).filter(Boolean);
  const vowIds = [...snapshot.vows[memberId]];
  const stats = emptyStats();
  const delivery = neutral(DELIVERY_KEYS);
  const essence = neutral(ESSENCE_KEYS);
  const statusFailure = {};
  const skillIds = [];
  let recoveryPulsesDelta = 0;
  let paceDelta = 0;
  const apply = (modifiers = {}, upgradePerLevel = {}, level = 0) => {
    for (const key of STAT_KEYS) stats[key] += (modifiers.stats?.[key] ?? 0) + ((upgradePerLevel[key] ?? 0) * level);
    for (const key of DELIVERY_KEYS) delivery[key] *= modifiers.delivery?.[key] ?? 1;
    for (const key of ESSENCE_KEYS) essence[key] *= modifiers.essence?.[key] ?? 1;
    for (const [status, resistance] of Object.entries(modifiers.statusResistance ?? {})) statusFailure[status] = (statusFailure[status] ?? 1) * (1 - resistance);
    recoveryPulsesDelta += modifiers.recoveryPulsesDelta ?? 0;
    paceDelta += modifiers.paceDelta ?? 0;
    for (const skillId of modifiers.skillIds ?? []) if (!skillIds.includes(skillId)) skillIds.push(skillId);
  };
  for (const id of equippedIds) {
    const item = ITEM_CATALOGUE[id];
    apply(item.modifiers, item.upgradePerLevel, snapshot.upgrades[id] ?? 0);
  }
  for (const id of vowIds) apply(VOW_CATALOGUE[id].modifiers);
  return deepFreeze({
    stats,
    resistances: { delivery: Object.fromEntries(DELIVERY_KEYS.map((key) => [key, rounded(delivery[key])])), essence: Object.fromEntries(ESSENCE_KEYS.map((key) => [key, rounded(essence[key])])) },
    statusResistance: Object.fromEntries(Object.keys(statusFailure).sort().map((key) => [key, rounded(1 - statusFailure[key])])),
    recoveryPulsesDelta: Math.max(-2, recoveryPulsesDelta),
    paceDelta,
    skillIds,
    sources: { equipment: equippedIds, vows: vowIds },
  });
}

/** Adapt a campaign-combat party profile without mutating the source profile. */
export function applyLoadoutToPartyProfile(profile, state, memberId = profile?.id) {
  if (!profile || !isPlainObject(profile.stats)) throw new TypeError('A party profile with stats is required.');
  const summary = getLoadoutModifiers(state, memberId);
  const stats = { ...profile.stats };
  for (const key of STAT_KEYS) if (Object.hasOwn(stats, key) || summary.stats[key]) stats[key] = (stats[key] ?? 0) + summary.stats[key];
  const resistances = { delivery: {}, essence: {} };
  for (const key of DELIVERY_KEYS) resistances.delivery[key] = rounded((profile.resistances?.delivery?.[key] ?? 1) * summary.resistances.delivery[key]);
  for (const key of ESSENCE_KEYS) resistances.essence[key] = rounded((profile.resistances?.essence?.[key] ?? 1) * summary.resistances.essence[key]);
  const skillIds = [...new Set([...(profile.skillIds ?? []), ...summary.skillIds])];
  return deepFreeze({ ...profile, stats, resistances, skillIds, loadout: summary });
}

export function getCharacterSummary(state, memberId) {
  const snapshot = assertState(state);
  if (!memberExists(memberId)) throw new RangeError(`Unknown party member: ${memberId}`);
  return deepFreeze({
    memberId,
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => {
      const id = snapshot.equipment[memberId][slot];
      return [slot, id ? { ...ITEM_CATALOGUE[id], upgradeLevel: snapshot.upgrades[id] ?? 0 } : null];
    })),
    vows: snapshot.vows[memberId].map((id) => VOW_CATALOGUE[id]),
    openVowSlots: VOW_SLOTS - snapshot.vows[memberId].length,
    vitals: snapshot.vitals[memberId],
    modifiers: getLoadoutModifiers(snapshot, memberId),
  });
}

export function setMemberVitals(state, memberId, patch = {}) {
  const snapshot = assertState(state);
  if (!memberExists(memberId)) return failed(snapshot, `Unknown party member: ${memberId}`);
  const supported = new Set(['hp', 'mp', 'spirit', 'statuses']);
  if (Object.keys(patch).some((key) => !supported.has(key))) return failed(snapshot, 'Vitals patch contains unsupported fields.');
  const current = snapshot.vitals[memberId];
  const next = { ...current };
  for (const [field, maximum] of [['hp', 'maxHp'], ['mp', 'maxMp'], ['spirit', 'maxSpirit']]) {
    if (!Object.hasOwn(patch, field)) continue;
    if (!Number.isSafeInteger(patch[field]) || patch[field] < 0 || patch[field] > current[maximum]) return failed(snapshot, `${field} must be between 0 and ${current[maximum]}.`);
    next[field] = patch[field];
  }
  if (Object.hasOwn(patch, 'statuses')) {
    if (!Array.isArray(patch.statuses) || patch.statuses.some((status) => typeof status !== 'string' || !status.trim())) return failed(snapshot, 'Statuses must be non-empty strings.');
    next.statuses = [...new Set(patch.statuses)].sort();
  }
  if (JSON.stringify(next) === JSON.stringify(current)) return succeeded(snapshot, { type: 'set-vitals', memberId, changed: false });
  const vitals = Object.fromEntries(PARTY_MEMBER_IDS.map((id) => [id, id === memberId ? next : snapshot.vitals[id]]));
  return succeeded(nextState(snapshot, { vitals }), { type: 'set-vitals', memberId, changed: true });
}

/** Update caps from advancement views, preserving damage while filling newly gained cap points. */
export function syncPartyVitals(state, partyViews) {
  const snapshot = assertState(state);
  if (!Array.isArray(partyViews)) return failed(snapshot, 'Party views must be an array.');
  const seen = new Set();
  const vitals = Object.fromEntries(PARTY_MEMBER_IDS.map((id) => [id, { ...snapshot.vitals[id], statuses: [...snapshot.vitals[id].statuses] }]));
  for (const view of partyViews) {
    if (!memberExists(view?.id) || seen.has(view.id) || !isPlainObject(view.stats)) return failed(snapshot, 'Party views must contain unique canonical members with stats.');
    const capInputs = ['hp', 'mp', 'arcana'].filter((key) => Object.hasOwn(view.stats, key));
    if (!Object.hasOwn(view.stats, 'hp') || !Object.hasOwn(view.stats, 'mp') || capInputs.some((key) => !Number.isSafeInteger(view.stats[key]) || view.stats[key] < 0) || (Object.hasOwn(view.stats, 'spirit') && (!Number.isSafeInteger(view.stats.spirit) || view.stats.spirit < 0))) {
      return failed(snapshot, 'Party HP, MP, Arcana, and optional Spirit caps must be non-negative safe integers.');
    }
    seen.add(view.id);
    const mods = getLoadoutModifiers(snapshot, view.id).stats;
    const caps = {
      maxHp: Math.max(1, (view.stats.hp ?? 1) + mods.hp),
      maxMp: Math.max(1, (view.stats.mp ?? 1) + mods.mp),
      maxSpirit: Math.max(1, (view.stats.spirit ?? ((view.stats.arcana ?? 10) * 2)) + mods.spirit),
    };
    const previous = vitals[view.id];
    for (const [maximum, current] of [['maxHp', 'hp'], ['maxMp', 'mp'], ['maxSpirit', 'spirit']]) {
      previous[current] = Math.min(caps[maximum], previous[current] + Math.max(0, caps[maximum] - previous[maximum]));
      previous[maximum] = caps[maximum];
    }
  }
  if (!seen.size) return failed(snapshot, 'At least one party view is required.');
  return succeeded(nextState(snapshot, { vitals }), { type: 'sync-vitals', members: [...seen] });
}

export function useConsumable(state, itemId, memberId) {
  const snapshot = assertState(state);
  if (!memberExists(memberId)) return failed(snapshot, `Unknown party member: ${memberId}`);
  const item = ITEM_CATALOGUE[itemId];
  if (!item || item.kind !== 'consumable') return failed(snapshot, `Unknown consumable: ${itemId}`);
  if (!(snapshot.inventory[itemId] > 0)) return failed(snapshot, `${item.name} is not available in inventory.`);
  const before = snapshot.vitals[memberId];
  const after = { ...before, statuses: [...before.statuses] };
  for (const [field, maximum] of [['hp', 'maxHp'], ['mp', 'maxMp'], ['spirit', 'maxSpirit']]) after[field] = Math.min(after[maximum], after[field] + (item.effect[field] ?? 0));
  if (item.effect.clearStatuses === 'all') after.statuses = [];
  else if (item.effect.clearStatuses) after.statuses = after.statuses.filter((status) => !item.effect.clearStatuses.includes(status));
  if (JSON.stringify(before) === JSON.stringify(after)) return failed(snapshot, `${item.name} would have no effect.`);
  const inventory = { ...snapshot.inventory, [itemId]: snapshot.inventory[itemId] - 1 };
  const vitals = Object.fromEntries(PARTY_MEMBER_IDS.map((id) => [id, id === memberId ? after : snapshot.vitals[id]]));
  return succeeded(nextState(snapshot, { inventory, vitals }), { type: 'use', itemId, memberId, before, after });
}

export function restAtCamp(state, campId, memberIds = PARTY_MEMBER_IDS) {
  const snapshot = assertState(state);
  const camp = CAMP_CATALOGUE[campId];
  if (!camp) return failed(snapshot, `Unknown camp: ${campId}`);
  if (!Array.isArray(memberIds) || !memberIds.length || new Set(memberIds).size !== memberIds.length || memberIds.some((id) => !memberExists(id))) return failed(snapshot, 'Camp members must be unique canonical party IDs.');
  if (snapshot.currency < camp.cost) return failed(snapshot, `Not enough currency to rest at ${camp.name}.`);
  const selected = new Set(memberIds);
  const vitals = {};
  const recovered = {};
  let changed = false;
  for (const memberId of PARTY_MEMBER_IDS) {
    const before = snapshot.vitals[memberId];
    if (!selected.has(memberId)) { vitals[memberId] = before; continue; }
    const after = { ...before };
    for (const [field, maximum] of [['hp', 'maxHp'], ['mp', 'maxMp'], ['spirit', 'maxSpirit']]) {
      const target = Math.min(after[maximum], Math.ceil(after[maximum] * camp.restore[field]));
      after[field] = Math.max(after[field], target);
    }
    after.statuses = camp.clearStatuses === 'all' ? [] : before.statuses.filter((status) => !camp.clearStatuses.includes(status));
    if (JSON.stringify(before) !== JSON.stringify(after)) changed = true;
    recovered[memberId] = { hp: after.hp - before.hp, mp: after.mp - before.mp, spirit: after.spirit - before.spirit, clearedStatuses: before.statuses.filter((status) => !after.statuses.includes(status)) };
    vitals[memberId] = after;
  }
  if (!changed) return failed(snapshot, 'The selected party members are already rested for this camp.');
  return succeeded(nextState(snapshot, { currency: snapshot.currency - camp.cost, vitals }), { type: 'camp-rest', campId, cost: camp.cost, recovered });
}
