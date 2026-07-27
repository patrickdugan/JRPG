/**
 * Deterministic execution of authored encounter effects in side-view combat.
 *
 * The combat kernel owns hit timing and damage. This adapter interprets the
 * source encounter metadata at the kernel's existing status-hook seams.
 */

export const ACTION_EFFECT_SCHEMA_VERSION = 1;
export const ACTION_EFFECT_TILE_PX = 64;
export const ACTION_STATUS_DEFAULT_DURATION_MS = 4_000;
export const ACTION_SCORCH_TICK_MS = 500;

const MOVEMENT_MULTIPLIERS = Object.freeze({
  bound: 0,
  chill: 0.65,
  shock: 0.8,
});

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function effectMap(attackManifest) {
  return new Map(attackManifest
    .filter(({ sourceEffect }) => sourceEffect != null)
    .map(({ adapterAttackId, sourceEffect }) => [adapterAttackId, structuredClone(sourceEffect)]));
}

function findStatus(actor, id) {
  return actor.statuses.find((status) => status?.id === id) ?? null;
}

function removeStatus(actor, status) {
  const index = actor.statuses.indexOf(status);
  if (index >= 0) actor.statuses.splice(index, 1);
}

function statusDuration(effect, actionBound) {
  return actionBound || ['one-activation', 'next-activation', 'one-command'].includes(effect?.duration)
    ? { remainingActions: 1 }
    : { expiresAtMs: null };
}

function addStatus(actor, id, effect, kernel, provenance = {}, { actionBound = false } = {}) {
  if (!id) return null;
  const prior = findStatus(actor, id);
  if (prior) removeStatus(actor, prior);
  const duration = statusDuration(effect, actionBound);
  const status = {
    id,
    appliedAtMs: kernel.nowMs,
    ...(duration.remainingActions == null
      ? { expiresAtMs: kernel.nowMs + ACTION_STATUS_DEFAULT_DURATION_MS }
      : duration),
    ...provenance,
  };
  actor.statuses.push(status);
  kernel._emit('status-applied', {
    actorId: actor.id,
    statusId: id,
    ...(status.remainingActions == null ? { expiresAtMs: status.expiresAtMs } : { remainingActions: status.remainingActions }),
    ...provenance,
  });
  return status;
}

function expireStatus(actor, status, kernel, reason) {
  removeStatus(actor, status);
  kernel._emit('status-expired', {
    actorId: actor.id,
    statusId: status.id,
    reason,
  });
}

function displace(target, attacker, effect, kernel) {
  if (findStatus(target, 'forced-move-immune')) {
    kernel._emit('effect-blocked', {
      actorId: attacker.id,
      targetId: target.id,
      effect: 'forced-move',
      reason: 'immune',
    });
    return;
  }
  const pullSpaces = Number(effect.pull?.spaces) || 0;
  const pushSpaces = Number(effect.push?.spaces) || 0;
  if (pullSpaces === 0 && pushSpaces === 0) return;
  const directionToAttacker = attacker.position.x >= target.position.x ? 1 : -1;
  const signedSpaces = pullSpaces ? pullSpaces * directionToAttacker : pushSpaces * -directionToAttacker;
  const beforeX = target.position.x;
  target.position.x = clamp(
    target.position.x + signedSpaces * ACTION_EFFECT_TILE_PX,
    kernel.stage.minX,
    kernel.stage.maxX,
  );
  target.velocity.x = 0;
  kernel._emit('effect-displacement', {
    actorId: attacker.id,
    targetId: target.id,
    kind: pullSpaces ? 'pull' : 'push',
    spaces: pullSpaces || pushSpaces,
    fromX: beforeX,
    toX: target.position.x,
  });
}

function dormantActorIdsByTemplate(kernel, instanceIdsByTemplate, templateId) {
  return (instanceIdsByTemplate[templateId] ?? [])
    .filter((actorId) => kernel.getActor(actorId)?.hp <= 0);
}

function activateSummon(templateId, summoner, kernel, instanceIdsByTemplate) {
  const actorId = dormantActorIdsByTemplate(kernel, instanceIdsByTemplate, templateId)[0];
  const actor = actorId ? kernel.getActor(actorId) : null;
  if (!actor) {
    kernel._emit('summon-blocked', {
      actorId: summoner.id,
      templateId,
      reason: 'no-dormant-instance',
    });
    return null;
  }
  const ordinal = (instanceIdsByTemplate[templateId] ?? []).indexOf(actorId);
  actor.hp = actor.maxHp;
  actor.faction = 'enemy';
  actor.ai = 'deterministic-chase';
  actor.position.x = clamp(
    summoner.position.x + ((ordinal % 2 === 0 ? -1 : 1) * (72 + ordinal * 18)),
    kernel.stage.minX + 24,
    kernel.stage.maxX - 24,
  );
  actor.position.y = kernel.stage.groundY;
  actor.grounded = true;
  actor.activeAttack = null;
  actor.statuses.length = 0;
  kernel._emit('summon-activated', {
    actorId: summoner.id,
    summonedActorId: actor.id,
    templateId,
    hp: actor.hp,
  });
  return actor;
}

function livingWardCount(kernel, wardIds) {
  return wardIds.filter((actorId) => kernel.getActor(actorId)?.hp > 0).length;
}

function mostWoundedAlly(kernel, {
  faction = 'player',
  triggerRatio = 0.8,
} = {}) {
  return kernel.actorOrder
    .map((candidateId) => kernel.getActor(candidateId))
    .filter((candidate) => (
      candidate.faction === faction
      && candidate.hp > 0
      && candidate.hp < candidate.maxHp
      && candidate.hp / candidate.maxHp < triggerRatio
    ))
    .sort((first, second) => (
      (first.hp / first.maxHp) - (second.hp / second.maxHp)
      || kernel.actorOrder.indexOf(first.id) - kernel.actorOrder.indexOf(second.id)
    ))[0] ?? null;
}

function tickReserveSupport(nowMs, kernel, support) {
  if (!support?.actorIds?.includes('aya') || nowMs < support.nextTickAtMs) return;
  support.nextTickAtMs += support.intervalMs;
  const target = mostWoundedAlly(kernel, { triggerRatio: support.triggerRatio });
  if (!target) return;
  const restore = Math.max(
    support.minimumRestore,
    Math.ceil(target.maxHp * support.restoreFraction),
  );
  const hpBefore = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + restore);
  kernel._emit('status-heal', {
    actorId: 'aya',
    actorName: 'Aya Shinohara',
    targetId: target.id,
    statusId: 'reserve-healer',
    restoredHp: target.hp - hpBefore,
    hpBefore,
    hpAfter: target.hp,
  });
}

function tickStatuses(nowMs, kernel, reserveSupport = null) {
  tickReserveSupport(nowMs, kernel, reserveSupport);
  for (const actorId of kernel.actorOrder) {
    const actor = kernel.getActor(actorId);
    for (const status of [...actor.statuses]) {
      if (status.id === 'blood-ward' && livingWardCount(kernel, status.wardActorIds ?? []) === 0) {
        expireStatus(actor, status, kernel, 'wards-broken');
        continue;
      }
      if (status.expiresAtMs != null && nowMs >= status.expiresAtMs) {
        expireStatus(actor, status, kernel, 'duration');
        continue;
      }
      if (status.id === 'passive-healer' && actor.hp > 0) {
        const nextTickAtMs = status.nextTickAtMs ?? nowMs;
        if (nowMs < nextTickAtMs) continue;
        const intervalMs = Math.max(1, Math.trunc(status.intervalMs ?? 1_600));
        status.nextTickAtMs = nextTickAtMs + intervalMs;
        const triggerRatio = clamp(Number(status.triggerRatio ?? 0.72), 0, 1);
        const target = mostWoundedAlly(kernel, {
          faction: actor.faction,
          triggerRatio,
        });
        if (!target) continue;
        const restore = Math.max(
          Math.trunc(status.minimumRestore ?? 1),
          Math.ceil(target.maxHp * Number(status.restoreFraction ?? 0)),
        );
        const hpBefore = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + restore);
        kernel._emit('status-heal', {
          actorId: actor.id,
          targetId: target.id,
          statusId: status.id,
          restoredHp: target.hp - hpBefore,
          hpBefore,
          hpAfter: target.hp,
        });
        continue;
      }
      if (status.id !== 'scorch' || actor.hp <= 0) continue;
      const nextTickAtMs = status.nextTickAtMs ?? (status.appliedAtMs + ACTION_SCORCH_TICK_MS);
      if (nowMs < nextTickAtMs) continue;
      status.nextTickAtMs = nextTickAtMs + ACTION_SCORCH_TICK_MS;
      const hpBefore = actor.hp;
      actor.hp = Math.max(0, actor.hp - 1);
      kernel._emit('status-damage', {
        actorId,
        statusId: status.id,
        damage: hpBefore - actor.hp,
        hpBefore,
        hpAfter: actor.hp,
      });
    }
  }
}

/**
 * Build one hook object per encounter. `instanceIdsByTemplate` includes dormant
 * summon actors already normalized into the kernel at zero HP.
 */
export function createActionEffectHooks({
  attackManifest = [],
  instanceIdsByTemplate = {},
  passiveSupportActorIds = [],
} = {}) {
  const effects = effectMap(attackManifest);
  const reserveSupport = {
    actorIds: [...new Set(passiveSupportActorIds)],
    nextTickAtMs: 1_600,
    intervalMs: 1_600,
    restoreFraction: 0.12,
    minimumRestore: 10,
    triggerRatio: 0.85,
  };
  return Object.freeze({
    modifyMovement({ actor, speed }) {
      const multiplier = actor.statuses.reduce(
        (value, status) => value * (MOVEMENT_MULTIPLIERS[status?.id] ?? 1),
        1,
      );
      return speed * multiplier;
    },

    modifyDamage({ attacker, target, attack, resolution, kernel }) {
      let multiplier = 1;
      if (findStatus(attacker, 'dread')) multiplier *= 0.8;
      if (findStatus(attacker, 'shock')) multiplier *= 0.85;
      const groupPressure = findStatus(attacker, 'group-pressure');
      if (groupPressure) multiplier *= Number(groupPressure.damageMultiplier ?? 1);
      if (findStatus(target, 'guard')) multiplier *= 0.5;
      if (findStatus(target, 'overheated')) multiplier *= 1.2;
      if (findStatus(target, 'final-ward-open')) multiplier *= 1.25;
      const ward = findStatus(target, 'blood-ward');
      if (ward && livingWardCount(kernel, ward.wardActorIds ?? []) > 0) {
        multiplier *= ward.incomingDamageMultiplier ?? 0.25;
      }
      const effect = effects.get(attack.id);
      if (effect?.essenceByTag) {
        const essences = Object.values(effect.essenceByTag);
        const essence = essences[target.position.x < attacker.position.x ? 0 : Math.min(1, essences.length - 1)];
        multiplier *= target.resistances?.essence?.[essence] ?? 1;
      }
      return { damage: Math.max(0, Math.round(resolution.damage * multiplier)) };
    },

    afterHit({ attacker, target, attack, kernel }) {
      const effect = effects.get(attack.id);
      if (!effect) return;
      if (effect.status) addStatus(target, effect.status, effect, kernel, {
        sourceActorId: attacker.id,
        sourceAttackId: attack.id,
      }, { actionBound: true });
      displace(target, attacker, effect, kernel);
      if (effect.exposes) activateSummon(effect.exposes, attacker, kernel, instanceIdsByTemplate);
    },

    afterAttackComplete({ actor, attack, kernel }) {
      const existingActionStatuses = actor.statuses.filter(({ remainingActions }) => remainingActions != null);
      const effect = effects.get(attack.id);
      for (const status of existingActionStatuses) {
        status.remainingActions -= 1;
        if (status.remainingActions <= 0) expireStatus(actor, status, kernel, 'activation');
      }
      if (!effect) return;
      if (effect.stance) addStatus(actor, effect.stance, effect, kernel, {
        sourceActorId: actor.id,
        sourceAttackId: attack.id,
      });
      if (effect.immuneToForcedMove) addStatus(actor, 'forced-move-immune', effect, kernel, {
        sourceActorId: actor.id,
        sourceAttackId: attack.id,
      });
      if (effect.selfStatus) addStatus(actor, effect.selfStatus, effect, kernel, {
        sourceActorId: actor.id,
        sourceAttackId: attack.id,
      });
      if (effect.reposition?.spaces) {
        const beforeX = actor.position.x;
        actor.position.x = clamp(
          actor.position.x + actor.facing * effect.reposition.spaces * ACTION_EFFECT_TILE_PX,
          kernel.stage.minX,
          kernel.stage.maxX,
        );
        kernel._emit('effect-reposition', {
          actorId: actor.id,
          spaces: effect.reposition.spaces,
          fromX: beforeX,
          toX: actor.position.x,
        });
      }
      const summoned = (effect.summons ?? [])
        .map((templateId) => activateSummon(templateId, actor, kernel, instanceIdsByTemplate))
        .filter(Boolean);
      if (effect.incomingDamageMultiplier != null) {
        addStatus(actor, 'blood-ward', effect, kernel, {
          sourceActorId: actor.id,
          sourceAttackId: attack.id,
          incomingDamageMultiplier: effect.incomingDamageMultiplier,
          wardActorIds: summoned.map(({ id }) => id),
        });
      }
      if (effect.createsWeakPoint) {
        activateSummon(effect.createsWeakPoint, actor, kernel, instanceIdsByTemplate);
      }
    },

    onFixedStep({ nowMs, kernel }) {
      tickStatuses(nowMs, kernel, reserveSupport);
    },
  });
}
