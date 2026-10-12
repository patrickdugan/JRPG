/**
 * Authored enemy AI priorities for side-view action combat.
 *
 * The kernel's deterministic chase AI begins the first ready attack whose
 * hitbox reaches its target. Encounter data (`content/encounters.mjs`) authors
 * richer `ai` priority lines for bosses and named elites. This table translates
 * those lines into deterministic attack priority orders and per-skill
 * preconditions evaluated at the kernel's `prioritizeAttacks` and
 * `canBeginAttack` seams.
 *
 * Every rule quotes its authored line verbatim in `line`; authored lines that
 * describe movement, targeting, or story beats owned elsewhere are quoted in
 * `notes` with the reason they are not an attack rule. Tests check every quote
 * against the encounter data, so the table cannot drift from its source.
 *
 * Distance bands use the tactical tile (64 px) measured centre to centre on the
 * side-view lane: "adjacent" is within 1.5 tiles (96 px) and "N+ distance" is at
 * least N - 0.5 tiles. "Activations" are completed attacks; interrupted wind-ups
 * are not activations. A template may opt into idle activations, where a full
 * shared-cooldown period spent ready but without a legal attack counts as an
 * activation spent advancing, matching tactical move-only turns.
 *
 * Self-casts (summons, wards, stances) normally still need their tiny caster-
 * centred hitbox to reach a foe. `selfCast: true` is an explicit opt-in that
 * lets an authored self-cast begin without reaching the target.
 */

import { actionActorHurtbox, attackWorldHitbox, levelAdjustedCooldownMs } from './action-combat.mjs';

export const ACTION_ENEMY_AI_SCHEMA_VERSION = 1;
export const ACTION_AI_TILE_PX = 64;
export const ACTION_AI_ADJACENT_PX = 1.5 * ACTION_AI_TILE_PX;
export const ACTION_AI_ISOLATION_PX = 3 * ACTION_AI_TILE_PX;
export const ACTION_AI_OBJECTIVE_CLUSTER_PX = 2 * ACTION_AI_TILE_PX;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const AUTHORED_ENEMY_AI = deepFreeze({
  'ashen-bailiff': {
    order: ['census-sweep', 'ash-step'],
    skills: {
      'census-sweep': { line: 'Telegraph Census Sweep if Ren can stand in its line.', when: { inReach: true } },
      'ash-step': { line: 'Otherwise Ash Step toward Ren.', when: {} },
    },
    notes: [
      { line: 'Never pursue beyond the river threshold.', reason: 'The Bailiff is an immovable tutorial sentry.' },
    ],
  },
  'tithe-hound': {
    order: ['consume-ink', 'ledger-maul'],
    skills: {
      'consume-ink': { line: 'At 3+ distance, telegraph Consume Ink.', when: { minGapTiles: 3 } },
      'ledger-maul': { line: 'At adjacency, Ledger Maul.', when: { maxGapTiles: 1 } },
    },
    notes: [
      { line: 'Otherwise approach the nearest target.', reason: 'The kernel chase AI approaches when no rule holds.' },
    ],
  },
  'tithe-enforcer': {
    order: ['shield-hook', 'registry-guard'],
    skills: {
      'shield-hook': {
        line: 'If a target can be pulled into water, telegraph Shield Hook.',
        // Only a target beyond adjacency can be hauled a space.
        when: { minGapTiles: 2 },
      },
      'registry-guard': { line: 'If not Guarded, use Registry Guard.', when: { notStatus: 'guard' } },
    },
    notes: [
      { line: 'Otherwise advance toward Nikola or Aya.', reason: 'The kernel chase AI advances on the nearest foe.' },
    ],
  },
  mateus: {
    order: ['blood-ward', 'crimson-litany', 'pale-cut', 'sanguine-step'],
    skills: {
      'pale-cut': { line: 'Phase 1: Pale Cut, Sanguine Step, then Blood Ward.', when: { maxGapTiles: 1 } },
      'sanguine-step': { line: 'Phase 1: Pale Cut, Sanguine Step, then Blood Ward.', when: { minGapTiles: 2 } },
      'blood-ward': {
        line: 'Phase 1: Pale Cut, Sanguine Step, then Blood Ward.',
        selfCast: true,
        when: { livingSummonsBelow: { templateIds: ['blood-ward-west', 'blood-ward-east'], count: 1 } },
      },
      'crimson-litany': {
        line: 'Phase 2: use Crimson Litany after Blood Ward; prefer a lane containing two heroes.',
        also: 'Do not select Crimson Litany until the player has seen Analyze or struck a Warded Mateus twice.',
        // Action combat has no Analyze command, so only warded strikes count.
        when: { afterOwnSkillThisPhase: 'blood-ward', wardedStrikesAtLeast: 2 },
      },
    },
    notes: [
      { line: 'Phase 3: cancel hostile AI and resolve the surrender scene.', reason: 'Phase 3 authors an empty move list.' },
    ],
  },
  'lady-enma': {
    order: [
      'rain-mirror-step', 'cinder-fan-draw',
      'mirror-writ', 'parasol-shear', 'blood-ink-step',
      'paired-ashes', 'cinder-parasol-wing', 'abandonment-cry',
    ],
    idleActivations: { line: 'Use Paired Ashes every other activation.' },
    skills: {
      // c3-dock-patrol
      'cinder-fan-draw': { line: 'Use Cinder Fan Draw across the boat approach.', when: { minGapTiles: 2 } },
      'rain-mirror-step': { line: 'Use Rain Mirror Step away from adjacency.', when: { maxGapTiles: 1 } },
      // c6-masked-clerks
      'mirror-writ': {
        line: 'Use Mirror Writ after a clerk declares Seize Copy.',
        when: { afterAllySkill: 'seize-copy' },
      },
      'parasol-shear': {
        line: 'Use Parasol Shear against defenders clustered around one objective.',
        when: { targetNearProtectedObject: true },
      },
      'blood-ink-step': { line: null, reason: 'No authored line; unconditioned fallback.', when: {} },
      // c8-lady-enma
      'paired-ashes': { line: 'Use Paired Ashes every other activation.', when: { otherActivationsBetween: 1 } },
      'abandonment-cry': { line: 'Use Abandonment Cry against an isolated ally.', when: { targetIsolated: true } },
      'cinder-parasol-wing': {
        line: null,
        reason: 'The cinder-wing phase rule: "Cinder Parasol Wing joins the cadence".',
        when: { phases: ['cinder-wing'] },
      },
    },
    notes: [
      { line: 'Retreat when the rain mask reaches 55% HP after at least one witness boards.', reason: 'The force-retreat objective resolution owns the exit.' },
      { line: 'At 30% HP, burn the archive mask and retreat toward Kurohana.', reason: 'The force-retreat objective resolution owns the exit.' },
      { line: 'Prioritize an unlit relay.', reason: 'Relays belong to the Outer Court; this arena has none.' },
    ],
  },
  'dock-retainer': {
    order: ['dock-hook', 'baton-check'],
    skills: {
      'dock-hook': { line: 'Otherwise hook the nearest unguarded hero.', when: { minGapTiles: 2 } },
      'baton-check': { line: 'Baton at adjacency.', when: { maxGapTiles: 1 } },
    },
    notes: [
      { line: 'Hook a witness if possible.', reason: 'Witnesses are objective tokens, not kernel targets.' },
    ],
  },
  'captain-kaji': {
    order: ['crane-surge', 'chain-haul', 'salt-cut'],
    skills: {
      'crane-surge': { line: 'Every third activation, Crane Surge.', when: { everyNthActivation: 3 } },
      'chain-haul': {
        line: 'If a witness can be pulled into water, Chain Haul.',
        // Witnesses are tokens; the hook hauls a hero from beyond adjacency.
        when: { minGapTiles: 2 },
      },
      'salt-cut': { line: 'Salt Cut at adjacency.', when: { maxGapTiles: 1 } },
    },
  },
  'widow-of-fog': {
    order: ['receding-call', 'name-drag'],
    skills: {
      'receding-call': { line: 'Alternate Receding Call and Name Drag.', when: { alternate: true } },
      'name-drag': { line: 'Alternate Receding Call and Name Drag.', when: { alternate: true } },
    },
    notes: [
      { line: 'Switch tide state every two boss activations.', reason: 'The boss phase director owns the tide cadence.' },
    ],
  },
  'furnace-abbot': {
    order: ['forge-sermon', 'hammer-decree'],
    idleActivations: { line: 'Otherwise advance.' },
    skills: {
      'forge-sermon': { line: 'Use Forge Sermon every third activation.', when: { everyNthActivation: 3 } },
      'hammer-decree': { line: 'Use Hammer Decree if two targets are in front.', when: { minHostilesInReach: 2 } },
    },
  },
  'masked-clerk': {
    order: ['seize-copy', 'seal-snap'],
    skills: {
      'seize-copy': { line: 'Target the least-protected print block.', when: {} },
      'seal-snap': { line: 'Seal Snap only when blocked.', when: { maxGapTiles: 1 } },
    },
    notes: [
      { line: 'Target the courier if two blocks are guarded.', reason: 'Objective targets are chosen by the objective director.' },
    ],
  },
  ujiro: {
    order: ['seizure-order', 'call-clerks', 'gavel-line'],
    skills: {
      'seizure-order': { line: 'If a print block is below 2 HP, use Seizure Order.', when: { protectedObjectBelowHp: 2 } },
      'call-clerks': {
        line: 'If fewer than two clerks live, Call Clerks.',
        when: { livingSummonsBelow: { templateIds: ['masked-clerk'], count: 2 } },
      },
      'gavel-line': { line: 'Otherwise Gavel Line at the largest cluster.', when: {} },
    },
  },
  'bell-warden-chiyo': {
    order: ['ringing-count', 'warden-bell', 'chain-cast'],
    skills: {
      'ringing-count': { line: 'Use Ringing Count every second activation.', when: { otherActivationsBetween: 1 } },
      'chain-cast': { line: 'Chain Cast at the nearest rescuer.', when: {} },
      'warden-bell': { line: 'Warden Bell when surrounded.', when: { surrounded: true } },
    },
  },
  'yearless-bell': {
    order: ['yearless-ring'],
    skills: {
      'yearless-ring': { line: 'Alternate radius 2 and radius 3 rings.', when: { alternate: true } },
    },
    notes: [
      { line: 'Target the archive core only if no hero occupies its protection lane.', reason: 'The objective director applies protection lanes to stray rings.' },
    ],
  },
  kurozane: {
    order: ['court-command', 'yearless-thrust', 'blood-eclipse', 'black-chrysanthemum'],
    skills: {
      'court-command': { line: 'Phase 1: Court Command and Yearless Thrust.', when: { phases: ['court'], alternate: true } },
      'yearless-thrust': { line: 'Phase 1: Court Command and Yearless Thrust.', when: { phases: ['court'], alternate: true } },
      'blood-eclipse': { line: 'Phase 2: move around nodes, then Blood Eclipse.', when: { phases: ['bell'] } },
      'black-chrysanthemum': {
        line: 'Phase 3: Black Chrysanthemum opens a Recovery 3 dawn window after Mateus cracks the ward.',
        when: { phases: ['dawn'] },
      },
    },
  },
});

function templateRules(templateId) {
  return AUTHORED_ENEMY_AI[templateId] ?? null;
}

function skillRule(templateId, skillId) {
  return templateRules(templateId)?.skills?.[skillId] ?? null;
}

/** Template/skill keys whose authored self-cast may begin without reach. */
export function authoredSelfCastKeys() {
  const keys = [];
  for (const [templateId, rules] of Object.entries(AUTHORED_ENEMY_AI)) {
    for (const [skillId, rule] of Object.entries(rules.skills ?? {})) {
      if (rule.selfCast) keys.push(`${templateId}:${skillId}`);
    }
  }
  return Object.freeze(keys);
}

function horizontalGap(actor, target) {
  return Math.abs(target.position.x - actor.position.x);
}

function overlaps(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function livingHostiles(kernel, actor) {
  const result = [];
  for (const actorId of kernel.actorOrder) {
    const candidate = kernel.getActor(actorId);
    if (candidate.hp <= 0 || candidate.faction === actor.faction || candidate.faction === 'neutral') continue;
    result.push(candidate);
  }
  return result;
}

function hasStatus(actor, statusId) {
  return (actor?.statuses ?? []).some((status) => status?.id === statusId);
}

/**
 * Per-session authored AI director. `session` must expose `kernel`,
 * `actorTemplates`, `spec.attackManifest`, `objectiveEntities`, and optionally
 * `bossPhaseDirector`.
 */
export function createEnemyAiDirector(session) {
  const manifest = new Map(session.spec.attackManifest.map((entry) => [entry.adapterAttackId, entry]));
  const state = {
    activationCount: new Map(),
    lastActivationIndex: new Map(),
    lastSkillId: new Map(),
    lastAttackId: new Map(),
    phaseCasts: new Map(),
    allySkillCompletions: new Map(),
    allySkillSeen: new Map(),
    wardedStrikes: new Map(),
    idleReadyMs: new Map(),
    passedActivations: new Map(),
  };

  const templateOf = (actorId) => session.actorTemplates[actorId] ?? null;
  const skillOf = (attackId) => manifest.get(attackId)?.sourceSkillId ?? null;
  const phaseRevision = () => session.bossPhaseDirector?.revision ?? 0;
  const phaseId = () => {
    const director = session.bossPhaseDirector;
    return director ? director.phases[director.phaseIndex]?.id ?? null : null;
  };

  function activationIndex(actorId) {
    return state.activationCount.get(actorId) ?? 0;
  }

  function conditionHolds(when, { actor, target, attackId, templateId, skillId, kernel }) {
    if (!when) return true;
    if (when.phases && !when.phases.includes(phaseId())) return false;
    if (when.everyNthActivation != null) {
      const nth = when.everyNthActivation;
      if (!actor || activationIndex(actor.id) % nth !== nth - 1) return false;
    }
    if (when.otherActivationsBetween != null) {
      if (!actor) return false;
      const lastIndex = state.lastActivationIndex.get(`${actor.id}:${skillId}`) ?? -1;
      if (activationIndex(actor.id) - lastIndex - 1 < when.otherActivationsBetween) return false;
    }
    // Alternation compares attack ids so radius variants of one ring alternate too.
    if (when.alternate && actor && state.lastAttackId.get(actor.id) === attackId) return false;
    if (when.protectedObjectBelowHp != null) {
      const below = session.objectiveEntities?.objects?.some((object) => (
        object.protected && !object.destroyed && object.hp < when.protectedObjectBelowHp
      ));
      if (!below) return false;
    }
    if (when.livingSummonsBelow) {
      const templates = new Set(when.livingSummonsBelow.templateIds);
      let living = 0;
      for (const actorId of session.kernel.actorOrder) {
        const candidate = session.kernel.getActor(actorId);
        if (candidate.hp > 0 && templates.has(templateOf(actorId))) living += 1;
      }
      if (living >= when.livingSummonsBelow.count) return false;
    }
    if (when.afterOwnSkillThisPhase) {
      const casts = actor ? state.phaseCasts.get(actor.id) : null;
      if (!casts || casts.revision !== phaseRevision() || !casts.skills.has(when.afterOwnSkillThisPhase)) return false;
    }
    if (when.wardedStrikesAtLeast != null) {
      if (!actor || (state.wardedStrikes.get(actor.id) ?? 0) < when.wardedStrikesAtLeast) return false;
    }
    if (when.notStatus && hasStatus(actor, when.notStatus)) return false;
    if (when.afterAllySkill) {
      const completed = state.allySkillCompletions.get(when.afterAllySkill) ?? 0;
      const seen = actor ? state.allySkillSeen.get(`${actor.id}:${skillId}`) ?? 0 : 0;
      if (completed <= seen) return false;
    }
    const needsGeometry = when.minGapTiles != null || when.maxGapTiles != null || when.inReach
      || when.minHostilesInReach != null || when.surrounded || when.targetIsolated
      || when.targetNearProtectedObject;
    if (needsGeometry && (!actor || !target)) return false;
    if (when.minGapTiles != null
      && horizontalGap(actor, target) < (when.minGapTiles - 0.5) * ACTION_AI_TILE_PX) return false;
    if (when.maxGapTiles != null
      && horizontalGap(actor, target) > (when.maxGapTiles + 0.5) * ACTION_AI_TILE_PX) return false;
    const attack = kernel?.attacks?.[attackId];
    if (when.inReach && (!attack || !overlaps(attackWorldHitbox(actor, attack), actionActorHurtbox(target)))) {
      return false;
    }
    if (when.minHostilesInReach != null) {
      if (!attack) return false;
      const hitbox = attackWorldHitbox(actor, attack);
      const inReach = livingHostiles(session.kernel, actor)
        .filter((candidate) => overlaps(hitbox, actionActorHurtbox(candidate))).length;
      if (inReach < when.minHostilesInReach) return false;
    }
    if (when.surrounded) {
      const near = livingHostiles(session.kernel, actor)
        .filter((candidate) => horizontalGap(actor, candidate) <= ACTION_AI_ADJACENT_PX);
      const left = near.some((candidate) => candidate.position.x < actor.position.x);
      const right = near.some((candidate) => candidate.position.x > actor.position.x);
      if (near.length < 2 && !(left && right)) return false;
    }
    if (when.targetIsolated) {
      const allies = livingHostiles(session.kernel, actor).filter((candidate) => candidate.id !== target.id);
      if (allies.some((ally) => horizontalGap(ally, target) < ACTION_AI_ISOLATION_PX)) return false;
    }
    if (when.targetNearProtectedObject) {
      const near = session.objectiveEntities?.objects?.some((object) => (
        object.protected && !object.destroyed
          && Math.abs(object.position.x - target.position.x) <= ACTION_AI_OBJECTIVE_CLUSTER_PX
      ));
      if (!near) return false;
    }
    return true;
  }

  function canBeginAttack({ actor = null, attackId, target = null, kernel = session.kernel } = {}) {
    const entry = manifest.get(attackId);
    if (!entry || entry.sourceKind !== 'enemy') return true;
    const templateId = entry.ownerTemplateId;
    const rule = skillRule(templateId, entry.sourceSkillId);
    if (!rule) return true;
    return conditionHolds(rule.when, {
      actor, target, attackId, templateId, skillId: entry.sourceSkillId, kernel,
    });
  }

  function prioritizeAttacks({ actor, attackIds }) {
    if (actor?.faction !== 'enemy') return attackIds;
    const order = templateRules(templateOf(actor.id))?.order;
    if (!order) return attackIds;
    const rank = (attackId) => {
      const index = order.indexOf(skillOf(attackId));
      return index < 0 ? order.length : index;
    };
    return attackIds
      .map((attackId, index) => ({ attackId, index }))
      .sort((left, right) => rank(left.attackId) - rank(right.attackId) || left.index - right.index)
      .map(({ attackId }) => attackId);
  }

  function recordActivation(actor, skillId) {
    const index = activationIndex(actor.id);
    if (skillId != null) state.lastActivationIndex.set(`${actor.id}:${skillId}`, index);
    state.activationCount.set(actor.id, index + 1);
  }

  function afterAttackComplete({ actor, attack }) {
    if (actor?.faction !== 'enemy') return;
    const skillId = skillOf(attack.id);
    recordActivation(actor, skillId);
    state.idleReadyMs.set(actor.id, 0);
    state.lastAttackId.set(actor.id, attack.id);
    if (skillId == null) return;
    state.lastSkillId.set(actor.id, skillId);
    const revision = phaseRevision();
    const casts = state.phaseCasts.get(actor.id);
    if (!casts || casts.revision !== revision) state.phaseCasts.set(actor.id, { revision, skills: new Set([skillId]) });
    else casts.skills.add(skillId);
    // A gated reply (Mirror Writ) consumes every ally declaration seen so far.
    for (const [templateSkillId, rule] of Object.entries(templateRules(templateOf(actor.id))?.skills ?? {})) {
      if (templateSkillId === skillId && rule.when?.afterAllySkill) {
        state.allySkillSeen.set(`${actor.id}:${skillId}`, state.allySkillCompletions.get(rule.when.afterAllySkill) ?? 0);
      }
    }
    state.allySkillCompletions.set(skillId, (state.allySkillCompletions.get(skillId) ?? 0) + 1);
  }

  function afterHit({ target, event }) {
    if (target?.faction !== 'enemy' || !(event?.damage > 0)) return;
    if (hasStatus(target, 'blood-ward')) {
      state.wardedStrikes.set(target.id, (state.wardedStrikes.get(target.id) ?? 0) + 1);
    }
  }

  function onFixedStep({ stepMs, kernel }) {
    for (const actorId of kernel.actorOrder) {
      const actor = kernel.getActor(actorId);
      if (actor.faction !== 'enemy' || actor.hp <= 0) continue;
      if (!templateRules(templateOf(actorId))?.idleActivations) continue;
      const ready = !actor.activeAttack
        && actor.hitStunRemainingMs === 0
        && actor.staggerRemainingMs === 0
        && actor.offensiveCooldownRemainingMs === 0
        && actor.attackIds.length > 0;
      if (!ready) {
        state.idleReadyMs.set(actorId, 0);
        continue;
      }
      const idle = (state.idleReadyMs.get(actorId) ?? 0) + stepMs;
      const cadenceMs = Math.max(stepMs, levelAdjustedCooldownMs(actor.offensiveCooldownMs, actor.level));
      if (idle < cadenceMs) {
        state.idleReadyMs.set(actorId, idle);
        continue;
      }
      state.idleReadyMs.set(actorId, 0);
      recordActivation(actor, null);
      state.passedActivations.set(actorId, (state.passedActivations.get(actorId) ?? 0) + 1);
      kernel._emit('enemy-activation-passed', {
        actorId,
        activation: activationIndex(actorId),
        reason: 'advanced-without-legal-attack',
      });
    }
  }

  function snapshot() {
    return deepFreeze({
      activationCount: Object.fromEntries(state.activationCount),
      lastSkillId: Object.fromEntries(state.lastSkillId),
      wardedStrikes: Object.fromEntries(state.wardedStrikes),
      passedActivations: Object.fromEntries(state.passedActivations),
    });
  }

  return Object.freeze({
    canBeginAttack,
    prioritizeAttacks,
    afterAttackComplete,
    afterHit,
    onFixedStep,
    snapshot,
    activationIndex,
  });
}
