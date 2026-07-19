/**
 * Commit ordered persistence operations and compensate already-written steps
 * when a later operation fails. Callers retain their prior live state until
 * this function returns ok, so a successful rollback keeps storage and UI in
 * agreement.
 */

function freezeResult(value) {
  return Object.freeze({
    ...value,
    committedIds: Object.freeze([...(value.committedIds ?? [])]),
    rolledBackIds: Object.freeze([...(value.rolledBackIds ?? [])]),
    rollbackFailedIds: Object.freeze([...(value.rollbackFailedIds ?? [])]),
  });
}

export function commitPersistenceTransaction(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new TypeError('Persistence transaction requires at least one step.');
  }
  const ids = new Set();
  for (const [index, step] of steps.entries()) {
    if (!step || typeof step.id !== 'string' || !step.id.trim()) {
      throw new TypeError(`Persistence step ${index} requires an ID.`);
    }
    if (ids.has(step.id)) throw new TypeError(`Duplicate persistence step ID: ${step.id}.`);
    if (typeof step.commit !== 'function' || typeof step.rollback !== 'function') {
      throw new TypeError(`Persistence step ${step.id} requires commit and rollback functions.`);
    }
    ids.add(step.id);
  }

  const committed = [];
  for (const step of steps) {
    let result;
    try {
      result = step.commit();
    } catch (error) {
      result = { ok: false, error };
    }
    if (result?.ok === true) {
      committed.push(step);
      continue;
    }

    const rolledBackIds = [];
    const rollbackFailedIds = [];
    for (const applied of [...committed].reverse()) {
      let rollback;
      try {
        rollback = applied.rollback();
      } catch (error) {
        rollback = { ok: false, error };
      }
      if (rollback?.ok === true) rolledBackIds.push(applied.id);
      else rollbackFailedIds.push(applied.id);
    }
    return freezeResult({
      ok: false,
      failedId: step.id,
      failure: result,
      committedIds: committed.map(({ id }) => id),
      rolledBackIds,
      rollbackFailedIds,
      rollbackComplete: rollbackFailedIds.length === 0,
    });
  }

  return freezeResult({
    ok: true,
    committedIds: committed.map(({ id }) => id),
    rolledBackIds: [],
    rollbackFailedIds: [],
    rollbackComplete: true,
  });
}

/**
 * Build a compensating state write only for adapters whose save operation may
 * overwrite a valid earlier snapshot. Sequential/CAS adapters must not opt in;
 * they need a raw storage journal or their own restoration API instead.
 */
export function stateSaveStep(id, adapter, previousState, nextState, { supportsOverwriteRollback = false } = {}) {
  if (!adapter || typeof adapter.save !== 'function') {
    throw new TypeError(`Persistence adapter ${id} requires save(state).`);
  }
  if (!supportsOverwriteRollback) {
    throw new TypeError(`Persistence adapter ${id} must explicitly support overwrite rollback.`);
  }
  return Object.freeze({
    id,
    commit: () => adapter.save(nextState),
    rollback: () => adapter.save(previousState),
  });
}
