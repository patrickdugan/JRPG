/**
 * Immutable action-combo contracts and DOM-free availability evaluation.
 *
 * A combo is an agreement to start existing participant attacks together. It
 * does not synthesize a third damage packet or own/reset participant cooldowns.
 */

import { ACTION_COMBAT_SNAPSHOT_VERSION } from './action-combat.mjs';

export const ACTION_COMBO_SCHEMA_VERSION = 1;
export const ACTION_COMBO_COOLDOWN_POLICY = 'preserve-participant-cooldowns';
export const ACTION_COMBO_RESOLUTION_POLICY = 'separate-participant-hits';

export const HUNTER_DAWN_BOLT_ACTION_ATTACK_ID = 'party:lise:dawn-bolt';
// Backward-compatible code alias; the serialized attack ID retains its old slot.
export const LISE_DAWN_BOLT_ACTION_ATTACK_ID = HUNTER_DAWN_BOLT_ACTION_ATTACK_ID;
export const MATEUS_PENITENT_NIGHT_ACTION_ATTACK_ID = 'party:mateus:penitent-night';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function finitePosition(actor) {
  return Number.isFinite(actor?.position?.x) && Number.isFinite(actor?.position?.y);
}

export const HUNTER_PRIEST_COMBO_CONTRACT = deepFreeze({
  schemaVersion: ACTION_COMBO_SCHEMA_VERSION,
  id: 'hunter-priest:black-sun-concord',
  name: 'Black Sun Concord',
  description: 'Nikola pins the quarry in dawnfire while Mateus drives a penitent night through the same wound—a radiant and umbral verdict struck in perfect accord.',
  participantActorIds: ['lise', 'mateus'],
  initiatorActorIds: ['lise', 'mateus'],
  maxAllySeparationPx: 180,
  cooldownPolicy: ACTION_COMBO_COOLDOWN_POLICY,
  resolutionPolicy: ACTION_COMBO_RESOLUTION_POLICY,
  attacks: [
    {
      actorId: 'lise',
      role: 'hunter',
      sourceSkillId: 'dawn-bolt',
      attackId: HUNTER_DAWN_BOLT_ACTION_ATTACK_ID,
      delivery: 'arcane',
      essence: 'radiance',
    },
    {
      actorId: 'mateus',
      role: 'priest',
      sourceSkillId: 'penitent-night',
      attackId: MATEUS_PENITENT_NIGHT_ACTION_ATTACK_ID,
      delivery: 'arcane',
      essence: 'umbral',
    },
  ],
});

/** Return a frozen list of structural contract errors. */
export function validateActionComboContract(contract) {
  const errors = [];
  if (contract?.schemaVersion !== ACTION_COMBO_SCHEMA_VERSION) errors.push('unsupported combo schema version');
  for (const key of ['id', 'name', 'description']) {
    if (!nonEmptyString(contract?.[key])) errors.push(`combo ${key} must be a non-empty string`);
  }

  const participants = contract?.participantActorIds;
  if (!Array.isArray(participants) || participants.length !== 2
      || participants.some((id) => !nonEmptyString(id))
      || new Set(participants).size !== 2) {
    errors.push('combo must declare exactly two unique participant actor ids');
  }
  const initiators = contract?.initiatorActorIds;
  if (!Array.isArray(initiators) || !Array.isArray(participants)
      || initiators.length !== participants.length
      || new Set(initiators).size !== initiators.length
      || initiators.some((id) => !participants.includes(id))) {
    errors.push('combo initiators must be exactly its two participants');
  }
  if (!Number.isFinite(contract?.maxAllySeparationPx) || contract.maxAllySeparationPx <= 0) {
    errors.push('combo maxAllySeparationPx must be positive');
  }
  if (contract?.cooldownPolicy !== ACTION_COMBO_COOLDOWN_POLICY) {
    errors.push(`combo cooldownPolicy must be ${ACTION_COMBO_COOLDOWN_POLICY}`);
  }
  if (contract?.resolutionPolicy !== ACTION_COMBO_RESOLUTION_POLICY) {
    errors.push(`combo resolutionPolicy must be ${ACTION_COMBO_RESOLUTION_POLICY}`);
  }
  for (const forbidden of ['cooldownMs', 'sharedCooldownMs', 'cooldownReset', 'resetCooldowns']) {
    if (Object.hasOwn(contract ?? {}, forbidden)) errors.push(`combo must not author ${forbidden}`);
  }

  const attacks = contract?.attacks;
  if (!Array.isArray(attacks) || !Array.isArray(participants) || attacks.length !== participants.length) {
    errors.push('combo must declare one existing attack per participant');
  } else {
    const attackActors = new Set();
    const attackIds = new Set();
    for (const [index, attack] of attacks.entries()) {
      if (!nonEmptyString(attack?.actorId) || !participants.includes(attack.actorId) || attackActors.has(attack.actorId)) {
        errors.push(`combo attack ${index} must map one unique participant`);
      }
      attackActors.add(attack?.actorId);
      if (!nonEmptyString(attack?.attackId) || attackIds.has(attack.attackId)) {
        errors.push(`combo attack ${index} must reference a unique existing attack id`);
      }
      attackIds.add(attack?.attackId);
      if (!nonEmptyString(attack?.sourceSkillId)) errors.push(`combo attack ${index} needs sourceSkillId`);
      if (!nonEmptyString(attack?.delivery) || !nonEmptyString(attack?.essence)) {
        errors.push(`combo attack ${index} must retain delivery and essence`);
      }
      for (const forbidden of ['cooldownMs', 'sharedCooldownMs', 'cooldownReset', 'resetCooldowns']) {
        if (Object.hasOwn(attack ?? {}, forbidden)) errors.push(`combo attack ${index} must not author ${forbidden}`);
      }
    }
  }
  return deepFreeze(errors);
}

function validateAvailabilityInput(contract, options) {
  const errors = validateActionComboContract(contract);
  if (errors.length) throw new TypeError(`Invalid action combo contract: ${errors.join('; ')}.`);
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Action combo availability options must be an object.');
  }
  const snapshot = options.kernelSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new TypeError('Action combo availability requires a kernelSnapshot.');
  }
  if (snapshot.schemaVersion !== ACTION_COMBAT_SNAPSHOT_VERSION) {
    throw new TypeError(`Unsupported action kernel snapshot schema version: ${snapshot.schemaVersion}.`);
  }
  if (!Array.isArray(snapshot.actors)) throw new TypeError('Action kernel snapshot actors must be an array.');
  if (typeof options.getAttackState !== 'function') {
    throw new TypeError('Action combo availability requires getAttackState(actorId, attackId).');
  }
}

function separation(left, right) {
  return Math.hypot(
    left.position.x - right.position.x,
    left.position.y - right.position.y,
  );
}

function normalizedAttackState(state, expected) {
  if (!state || typeof state !== 'object' || typeof state.ready !== 'boolean') return null;
  if (state.actorId != null && state.actorId !== expected.actorId) return null;
  if (state.attackId != null && state.attackId !== expected.attackId) return null;
  return {
    ready: state.ready,
    reason: state.reason ?? null,
    animationPhase: state.animationPhase ?? null,
    sharedCooldownRemainingMs: state.sharedCooldownRemainingMs ?? null,
    individualCooldownRemainingMs: state.individualCooldownRemainingMs ?? null,
    effectiveCooldownRemainingMs: state.effectiveCooldownRemainingMs ?? null,
  };
}

function pushReason(reasons, code, details = {}) {
  reasons.push({ code, ...details });
}

/**
 * Evaluate one combo against a kernel snapshot and its authoritative attack
 * state lookup. The helper is read-only and returns a deeply frozen record.
 */
export function getActionComboAvailability(contract, options) {
  validateAvailabilityInput(contract, options);
  const snapshot = options.kernelSnapshot;
  const initiatorActorId = options.initiatorActorId ?? snapshot.controlledActorId ?? null;
  const reasons = [];

  if (snapshot.outcome != null) pushReason(reasons, 'combat-ended', { outcome: snapshot.outcome });
  if (!contract.initiatorActorIds.includes(initiatorActorId)) {
    pushReason(reasons, 'initiator-not-participant', { actorId: initiatorActorId });
  }
  if (initiatorActorId !== snapshot.controlledActorId) {
    pushReason(reasons, 'initiator-not-controlled', {
      actorId: initiatorActorId,
      controlledActorId: snapshot.controlledActorId ?? null,
    });
  }

  const actorsById = new Map(snapshot.actors.map((actor) => [actor?.id, actor]));
  const participants = contract.attacks.map((attack) => {
    const actor = actorsById.get(attack.actorId) ?? null;
    const living = actor != null && actor.hp > 0;
    const committed = actor?.activeAttack != null;
    let attackState = null;

    if (!actor) {
      pushReason(reasons, 'participant-missing', { actorId: attack.actorId });
    } else {
      if (actor.faction !== 'player') pushReason(reasons, 'participant-not-player', { actorId: attack.actorId });
      if (!finitePosition(actor)) pushReason(reasons, 'participant-position-invalid', { actorId: attack.actorId });
      if (!living) pushReason(reasons, 'participant-defeated', { actorId: attack.actorId });
      if (committed) pushReason(reasons, 'participant-committed', { actorId: attack.actorId });
      attackState = normalizedAttackState(options.getAttackState(attack.actorId, attack.attackId), attack);
      if (!attackState) {
        pushReason(reasons, 'signature-attack-unavailable', {
          actorId: attack.actorId,
          attackId: attack.attackId,
        });
      } else if (!attackState.ready) {
        pushReason(reasons, 'signature-attack-not-ready', {
          actorId: attack.actorId,
          attackId: attack.attackId,
          reason: attackState.reason,
          remainingMs: attackState.effectiveCooldownRemainingMs,
        });
      }
    }

    return {
      actorId: attack.actorId,
      role: attack.role,
      attackId: attack.attackId,
      sourceSkillId: attack.sourceSkillId,
      delivery: attack.delivery,
      essence: attack.essence,
      present: actor != null,
      living,
      committed,
      ready: attackState?.ready === true && !committed && living,
      attackState,
    };
  });

  const participantActors = contract.participantActorIds.map((actorId) => actorsById.get(actorId));
  let separationPx = null;
  if (participantActors.every((actor) => actor && finitePosition(actor))) {
    separationPx = separation(participantActors[0], participantActors[1]);
    if (separationPx > contract.maxAllySeparationPx) {
      pushReason(reasons, 'allies-too-far', {
        separationPx,
        maxAllySeparationPx: contract.maxAllySeparationPx,
      });
    }
  }

  const attackRequests = contract.attacks.map((attack) => ({
    actorId: attack.actorId,
    attackId: attack.attackId,
    delivery: attack.delivery,
    essence: attack.essence,
  }));
  return deepFreeze({
    schemaVersion: ACTION_COMBO_SCHEMA_VERSION,
    comboId: contract.id,
    name: contract.name,
    description: contract.description,
    available: reasons.length === 0,
    initiatorActorId,
    controlledActorId: snapshot.controlledActorId ?? null,
    separationPx,
    maxAllySeparationPx: contract.maxAllySeparationPx,
    cooldownPolicy: contract.cooldownPolicy,
    resolutionPolicy: contract.resolutionPolicy,
    participants,
    attackRequests,
    reasons,
  });
}

/** Convenience evaluator for the canonical Nikola + Mateus contract. */
export function getHunterPriestComboAvailability(options) {
  return getActionComboAvailability(HUNTER_PRIEST_COMBO_CONTRACT, options);
}

// Guard the exported authored contract at module load without mutating it.
const HUNTER_PRIEST_CONTRACT_ERRORS = validateActionComboContract(HUNTER_PRIEST_COMBO_CONTRACT);
if (HUNTER_PRIEST_CONTRACT_ERRORS.length) {
  throw new TypeError(`Invalid Hunter-Priest combo contract: ${HUNTER_PRIEST_CONTRACT_ERRORS.join('; ')}.`);
}
