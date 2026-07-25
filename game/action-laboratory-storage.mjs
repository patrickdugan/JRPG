/**
 * Read-only bridge from the canonical campaign into the experimental Action Lab.
 *
 * The laboratory may borrow a cloned party snapshot as an initial condition,
 * but it never owns a canonical storage adapter and cannot write campaign state.
 */

import {
  DEFAULT_ADVANCEMENT_SAVE_KEY,
  createAdvancementState,
  loadAdvancementState,
} from './advancement.mjs';
import {
  DEFAULT_LOADOUT_SAVE_KEY,
  createLoadoutState,
  hydrateLoadoutState,
} from './loadout.mjs';
import { RECOVERY_CHECKPOINT_AUTHORITIES } from './recovery-checkpoint.mjs';
import {
  DEFAULT_RUN_RECEIPT_SAVE_KEY,
  loadRunReceipt,
} from './run-receipt.mjs';

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function readRaw(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

/** Capture the exact raw canonical authority bytes, including missing values. */
export function captureCanonicalStorageSnapshot(storage) {
  return deepFreeze(RECOVERY_CHECKPOINT_AUTHORITIES.map(({ id, key }) => ({
    id,
    key,
    value: readRaw(storage, key),
  })));
}

export function canonicalStorageSnapshotsMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Load validated canonical input without adapters, migrations, repairs, or
 * writes. Every returned state is a detached clone.
 */
export function loadActionLaboratorySeed(storage) {
  const advancementRaw = readRaw(storage, DEFAULT_ADVANCEMENT_SAVE_KEY);
  const advancementLoaded = advancementRaw == null ? null : loadAdvancementState(advancementRaw);
  const loadoutRaw = readRaw(storage, DEFAULT_LOADOUT_SAVE_KEY);
  const loadoutLoaded = loadoutRaw == null ? null : hydrateLoadoutState(loadoutRaw);
  const receiptLoaded = loadRunReceipt(readRaw(storage, DEFAULT_RUN_RECEIPT_SAVE_KEY));
  return deepFreeze({
    advancement: clone(advancementLoaded?.ok ? advancementLoaded.value : createAdvancementState()),
    loadout: clone(loadoutLoaded?.ok ? loadoutLoaded.value : createLoadoutState()),
    runReceipt: clone(receiptLoaded.ok && receiptLoaded.found ? receiptLoaded.state : null),
  });
}
