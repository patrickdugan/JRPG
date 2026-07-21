/**
 * Deterministic, DOM-free runtime for action objective contracts.
 *
 * `advance` consumes an ActionCombatKernel snapshot/event batch plus explicit
 * objective subjects, interactions, and continuous casts. Kernel facts are
 * projected into the domain event names authored by action-objectives.mjs;
 * objective-only facts remain explicit inputs instead of being guessed here.
 */

import { ACTION_COMBAT_SNAPSHOT_VERSION } from './action-combat.mjs';
import {
  ACTION_OBJECTIVE_SEMANTICS,
  validateActionObjectiveContract,
} from './action-objectives.mjs';
import { getActionStage, validateActionStage } from './action-stages.mjs';

export const ACTION_OBJECTIVE_RUNTIME_SCHEMA_VERSION = 1;
export const ACTION_OBJECTIVE_RUNTIME_STATUSES = Object.freeze([
  'pending',
  'completed',
  'failed',
]);

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer.`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value;
}

function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function partialMatch(actual, expected) {
  if (!isObject(expected)) return Object.is(actual, expected);
  if (!isObject(actual)) return false;
  return Object.entries(expected).every(([key, value]) => partialMatch(actual[key], value));
}

function actorTemplateId(actor) {
  if (typeof actor?.templateId === 'string' && actor.templateId) return actor.templateId;
  if (typeof actor?.actorTemplateId === 'string' && actor.actorTemplateId) return actor.actorTemplateId;
  return String(actor?.id ?? '').replace(/-\d+$/u, '');
}

function validateKernelSnapshot(snapshot) {
  if (!isObject(snapshot)) throw new TypeError('kernelSnapshot must be an object.');
  if (snapshot.schemaVersion !== ACTION_COMBAT_SNAPSHOT_VERSION) {
    throw new TypeError(`Unsupported action kernel snapshot schema version: ${snapshot.schemaVersion}.`);
  }
  nonNegativeInteger(snapshot.nowMs, 'kernelSnapshot.nowMs');
  if (!Array.isArray(snapshot.actors)) throw new TypeError('kernelSnapshot.actors must be an array.');
  const ids = new Set();
  for (const [index, actor] of snapshot.actors.entries()) {
    const path = `kernelSnapshot.actors[${index}]`;
    const id = requireString(actor?.id, `${path}.id`);
    if (ids.has(id)) throw new RangeError(`Duplicate action kernel actor id: ${id}.`);
    ids.add(id);
    requireString(actor?.faction, `${path}.faction`);
    finite(actor?.hp, `${path}.hp`);
    const maxHp = finite(actor?.maxHp, `${path}.maxHp`);
    if (maxHp <= 0) throw new RangeError(`${path}.maxHp must be greater than zero.`);
    finite(actor?.position?.x, `${path}.position.x`);
    finite(actor?.position?.y, `${path}.position.y`);
  }
  if (snapshot.outcome != null && typeof snapshot.outcome !== 'string') {
    throw new TypeError('kernelSnapshot.outcome must be null or a string.');
  }
}

function normalizeEvent(event, index) {
  if (!isObject(event)) throw new TypeError(`events[${index}] must be an object.`);
  const result = clone(event);
  requireString(result.type, `events[${index}].type`);
  if (result.sequence != null) nonNegativeInteger(result.sequence, `events[${index}].sequence`);
  if (result.nowMs != null) nonNegativeInteger(result.nowMs, `events[${index}].nowMs`);
  return result;
}

function normalizeSubject(subject, index) {
  if (!isObject(subject)) throw new TypeError(`subjects[${index}] must be an object.`);
  const kind = requireString(subject.kind, `subjects[${index}].kind`);
  if (!['objective-token', 'carried-item'].includes(kind)) {
    throw new RangeError(`subjects[${index}] has unsupported kind: ${kind}.`);
  }
  const identityKey = kind === 'objective-token' ? 'tokenId' : 'itemId';
  const identity = requireString(subject[identityKey], `subjects[${index}].${identityKey}`);
  const result = {
    kind,
    [identityKey]: identity,
    position: {
      x: finite(subject.position?.x, `subjects[${index}].position.x`),
      y: finite(subject.position?.y, `subjects[${index}].position.y`),
    },
    active: subject.active !== false,
  };
  if (subject.bounds != null) {
    const bounds = subject.bounds;
    const width = finite(bounds?.width, `subjects[${index}].bounds.width`);
    const height = finite(bounds?.height, `subjects[${index}].bounds.height`);
    if (width <= 0 || height <= 0) throw new RangeError(`subjects[${index}].bounds must be positive.`);
    result.bounds = { width, height };
  }
  return result;
}

function normalizeInteraction(interaction, index) {
  if (!isObject(interaction)) throw new TypeError(`interactions[${index}] must be an object.`);
  const result = {
    actionId: requireString(interaction.actionId, `interactions[${index}].actionId`),
    anchorId: requireString(interaction.anchorId, `interactions[${index}].anchorId`),
  };
  if (interaction.actorId != null) result.actorId = requireString(interaction.actorId, `interactions[${index}].actorId`);
  if (interaction.payload != null) {
    if (!isObject(interaction.payload)) throw new TypeError(`interactions[${index}].payload must be an object.`);
    result.payload = clone(interaction.payload);
  }
  return result;
}

function normalizeCast(cast, index) {
  if (!isObject(cast)) throw new TypeError(`casts[${index}] must be an object.`);
  const state = cast.state ?? 'active';
  if (!['active', 'interrupted'].includes(state)) {
    throw new RangeError(`casts[${index}] has unsupported state: ${state}.`);
  }
  const result = {
    castId: requireString(cast.castId, `casts[${index}].castId`),
    anchorId: requireString(cast.anchorId, `casts[${index}].anchorId`),
    state,
  };
  if (cast.actorId != null) result.actorId = requireString(cast.actorId, `casts[${index}].actorId`);
  return result;
}

function eventMatches(event, match = {}) {
  for (const [key, expected] of Object.entries(match)) {
    if (key === 'ratio') {
      if (!Number.isFinite(event.ratio) || event.ratio > expected) return false;
      continue;
    }
    if (key === 'actorTemplateId') {
      const actual = event.actorTemplateId
        ?? (event.actorId ? String(event.actorId).replace(/-\d+$/u, '') : null);
      if (actual !== expected) return false;
      continue;
    }
    if (key === 'actorIds') {
      const actualIds = Array.isArray(event.actorIds) ? event.actorIds : [event.actorId];
      if (!actualIds.some((id) => expected.includes(id))) return false;
      continue;
    }
    if (key === 'idPrefix') {
      const actual = event.objectId ?? event.actorId ?? event.id;
      if (typeof actual !== 'string' || !actual.startsWith(expected)) return false;
      continue;
    }
    if (!partialMatch(event[key], expected)) return false;
  }
  return true;
}

function completionValue(node, progressById) {
  if (node.operator === 'requirement') return progressById.get(node.id)?.completed === true;
  if (node.operator === 'all') return node.clauses.every((clause) => completionValue(clause, progressById));
  if (node.operator === 'any') return node.clauses.some((clause) => completionValue(clause, progressById));
  return false;
}

function anchorBounds(anchor) {
  return {
    left: anchor.x - anchor.width / 2,
    right: anchor.x + anchor.width / 2,
    top: anchor.y - anchor.height,
    bottom: anchor.y,
  };
}

function subjectBounds(subject) {
  if (!subject.bounds) {
    return {
      left: subject.position.x,
      right: subject.position.x,
      top: subject.position.y,
      bottom: subject.position.y,
    };
  }
  return {
    left: subject.position.x - subject.bounds.width / 2,
    right: subject.position.x + subject.bounds.width / 2,
    top: subject.position.y - subject.bounds.height,
    bottom: subject.position.y,
  };
}

function overlaps(left, right) {
  return left.left <= right.right
    && left.right >= right.left
    && left.top <= right.bottom
    && left.bottom >= right.top;
}

function subjectMatches(actual, expected) {
  if (actual.kind !== expected.kind || actual.active === false) return false;
  if (expected.kind === 'actor') {
    if (expected.actorId != null && actual.actorId !== expected.actorId) return false;
    if (expected.faction != null && actual.faction !== expected.faction) return false;
    if (expected.selection === 'any-living' && actual.hp <= 0) return false;
    return true;
  }
  if (expected.kind === 'objective-token') return actual.tokenId === expected.tokenId;
  if (expected.kind === 'carried-item') return actual.itemId === expected.itemId;
  return false;
}

function actorSubjects(snapshot) {
  return (snapshot?.actors ?? []).map((actor) => ({
    kind: 'actor',
    actorId: actor.id,
    faction: actor.faction,
    hp: actor.hp,
    position: { ...actor.position },
    active: true,
  }));
}

function validateActorAuthority(actorId, snapshot, label) {
  if (actorId == null) return;
  const actor = snapshot?.actors?.find(({ id }) => id === actorId);
  if (!actor) throw new RangeError(`${label} references unknown actor ${actorId}.`);
  if (actor.faction !== 'player' || actor.hp <= 0) {
    throw new RangeError(`${label} requires a living player actor.`);
  }
}

function eventSignature(event) {
  return JSON.stringify([
    event.type,
    event.sequence ?? event.sourceSequence ?? null,
    event.actorId ?? null,
    event.objectId ?? null,
    event.castId ?? null,
    event.faction ?? null,
    event.ratio ?? null,
  ]);
}

/** Stateful evaluator for one frozen action objective contract. */
export class ActionObjectiveRuntime {
  constructor(options = {}) {
    const contract = options.contract;
    if (!isObject(contract)) throw new TypeError('Action objective runtime requires a contract.');
    const stage = options.stage ?? getActionStage(contract.levelId);
    const stageErrors = validateActionStage(stage);
    if (stageErrors.length) throw new TypeError(`Invalid action objective stage: ${stageErrors.join('; ')}`);
    if (stage.id !== contract.levelId) {
      throw new RangeError(`Objective ${contract.encounterId} requires stage ${contract.levelId}, not ${stage.id}.`);
    }
    const errors = validateActionObjectiveContract(contract, stage);
    if (errors.length) {
      throw new TypeError(`Invalid action objective contract for runtime: ${errors.join('; ')}`);
    }
    for (const requirement of contract.requirements) {
      if (!ACTION_OBJECTIVE_SEMANTICS.includes(requirement.semantics)) {
        throw new RangeError(`Unsupported action objective runtime semantics: ${requirement.semantics}.`);
      }
    }

    this.contract = deepFreeze(clone(contract));
    this.stage = deepFreeze(clone(stage));
    this.requirementById = new Map(this.contract.requirements.map((entry) => [entry.id, entry]));
    this.progressById = new Map(this.contract.requirements.map((entry) => [entry.id, {
      id: entry.id,
      semantics: entry.semantics,
      value: 0,
      target: entry.count,
      completed: false,
      completedAtMs: null,
      castElapsedMs: 0,
    }]));
    this.failureById = new Map(this.contract.failures.map((entry) => [entry.id, entry]));
    this.failureProgressById = new Map(this.contract.failures.map((entry) => [entry.id, {
      id: entry.id,
      value: 0,
      target: entry.count,
      triggered: false,
      triggeredAtMs: null,
    }]));
    this.status = 'pending';
    this.nowMs = 0;
    this.lastKernelSnapshot = null;
    this.terminalResult = null;
    this.seenSequencedEvents = new Set();

    if (options.initialKernelSnapshot != null) {
      this.advance({ kernelSnapshot: options.initialKernelSnapshot });
    }
  }

  _available(requirement) {
    return requirement.after.every((id) => this.progressById.get(id)?.completed === true);
  }

  _incrementRequirement(requirement, amount = 1) {
    const progress = this.progressById.get(requirement.id);
    if (progress.completed || !this._available(requirement)) return false;
    progress.value = Math.min(progress.target, progress.value + amount);
    if (progress.value >= progress.target) {
      progress.completed = true;
      progress.completedAtMs = this.nowMs;
      progress.castElapsedMs = 0;
    }
    return true;
  }

  _consumeEvent(event) {
    for (const failure of this.contract.failures) {
      if (failure.eventType !== event.type || !eventMatches(event, failure.match)) continue;
      const progress = this.failureProgressById.get(failure.id);
      if (progress.triggered) continue;
      progress.value = Math.min(progress.target, progress.value + 1);
      if (progress.value >= progress.target) {
        progress.triggered = true;
        progress.triggeredAtMs = this.nowMs;
      }
    }
    for (const requirement of this.contract.requirements) {
      if (requirement.semantics !== 'event-count'
          || requirement.eventType !== event.type
          || !eventMatches(event, requirement.match)) continue;
      this._incrementRequirement(requirement);
    }
  }

  _projectEvents(rawEvents, snapshot, previousSnapshot) {
    const result = [];
    const signatures = new Set();
    const append = (event) => {
      const signature = eventSignature(event);
      if (event.projected === true && signatures.has(signature)) return;
      signatures.add(signature);
      result.push(event);
    };

    const actors = new Map((snapshot?.actors ?? previousSnapshot?.actors ?? []).map((actor) => [actor.id, actor]));
    for (const event of rawEvents) {
      append(event);
      if (event.type === 'attack-complete') {
        const actor = actors.get(event.actorId);
        if (actor?.faction === 'enemy') {
          append({
            type: 'enemy-action-completed',
            sequence: event.sequence,
            nowMs: event.nowMs ?? this.nowMs,
            actorId: actor.id,
            actorTemplateId: actorTemplateId(actor),
            faction: 'enemy',
            sourceEventType: event.type,
            projected: true,
          });
        }
      }
    }

    if (!snapshot) return result;
    const previousActors = new Map((previousSnapshot?.actors ?? []).map((actor) => [actor.id, actor]));
    for (const actor of snapshot.actors) {
      const previous = previousActors.get(actor.id);
      if (actor.hp <= 0 && (!previous || previous.hp > 0)) {
        const defeated = {
          type: 'actor-defeated',
          nowMs: snapshot.nowMs,
          actorId: actor.id,
          actorTemplateId: actorTemplateId(actor),
          faction: actor.faction,
          projected: true,
        };
        append(defeated);
        if (actor.faction === 'enemy') append({ ...defeated, type: 'enemy-defeated' });
      }
      const ratio = Math.max(0, actor.hp) / actor.maxHp;
      append({
        type: 'actor-hp-ratio-at-or-below',
        nowMs: snapshot.nowMs,
        actorId: actor.id,
        actorTemplateId: actorTemplateId(actor),
        faction: actor.faction,
        ratio,
        projected: true,
      });
    }

    for (const faction of new Set(snapshot.actors.map((actor) => actor.faction))) {
      if (faction === 'neutral') continue;
      const factionActors = snapshot.actors.filter((actor) => actor.faction === faction);
      const previousFactionActors = previousSnapshot?.actors?.filter((actor) => actor.faction === faction) ?? [];
      const defeated = factionActors.length > 0 && factionActors.every((actor) => actor.hp <= 0);
      const wasDefeated = previousFactionActors.length > 0 && previousFactionActors.every((actor) => actor.hp <= 0);
      if (defeated && !wasDefeated) {
        append({ type: 'faction-defeated', nowMs: snapshot.nowMs, faction, projected: true });
      }
    }
    return result;
  }

  _consumeInteractions(interactions) {
    for (const interaction of interactions) {
      for (const requirement of this.contract.requirements) {
        if (requirement.semantics !== 'interact'
            || requirement.actionId !== interaction.actionId
            || !requirement.anchorIds.includes(interaction.anchorId)
            || (requirement.payload && !partialMatch(interaction.payload, requirement.payload))) continue;
        this._incrementRequirement(requirement);
      }
    }
  }

  _consumeCasts(casts, elapsedMs) {
    const matchingByRequirement = new Map();
    for (const cast of casts) {
      for (const requirement of this.contract.requirements) {
        if (requirement.semantics !== 'cast-count'
            || requirement.castId !== cast.castId
            || !requirement.anchorIds.includes(cast.anchorId)) continue;
        matchingByRequirement.set(requirement.id, cast);
      }
    }

    for (const requirement of this.contract.requirements) {
      if (requirement.semantics !== 'cast-count') continue;
      const progress = this.progressById.get(requirement.id);
      if (progress.completed) continue;
      const cast = matchingByRequirement.get(requirement.id);
      if (!this._available(requirement) || !cast || cast.state === 'interrupted') {
        progress.castElapsedMs = 0;
        continue;
      }
      progress.castElapsedMs = Math.min(requirement.durationMs, progress.castElapsedMs + elapsedMs);
      if (progress.castElapsedMs >= requirement.durationMs) this._incrementRequirement(requirement);
    }
  }

  _consumeOverlaps(subjects, snapshot) {
    const actualSubjects = [...actorSubjects(snapshot), ...subjects];
    for (const requirement of this.contract.requirements) {
      if (requirement.semantics !== 'overlap' || !this._available(requirement)) continue;
      const anchors = requirement.anchorIds.map((anchorId) => this.stage.objectiveAnchors.find(({ id }) => id === anchorId));
      const matched = actualSubjects.some((subject) => (
        subjectMatches(subject, requirement.subject)
        && anchors.some((anchor) => overlaps(subjectBounds(subject), anchorBounds(anchor)))
      ));
      if (matched) this._incrementRequirement(requirement);
    }
  }

  _settle() {
    const failure = this.contract.failures.find((entry) => this.failureProgressById.get(entry.id).triggered);
    if (failure) {
      this.status = 'failed';
      this.terminalResult = deepFreeze({
        schemaVersion: ACTION_OBJECTIVE_RUNTIME_SCHEMA_VERSION,
        encounterId: this.contract.encounterId,
        objectiveType: this.contract.objectiveType,
        outcome: 'failure',
        status: this.status,
        failureId: failure.id,
        resolvedAtMs: this.nowMs,
      });
      return;
    }
    if (this.lastKernelSnapshot?.outcome === 'defeat') {
      this.status = 'failed';
      this.terminalResult = deepFreeze({
        schemaVersion: ACTION_OBJECTIVE_RUNTIME_SCHEMA_VERSION,
        encounterId: this.contract.encounterId,
        objectiveType: this.contract.objectiveType,
        outcome: 'failure',
        status: this.status,
        failureId: 'kernel-defeat',
        resolvedAtMs: this.nowMs,
      });
      return;
    }
    if (completionValue(this.contract.completion, this.progressById)) {
      this.status = 'completed';
      this.terminalResult = deepFreeze({
        schemaVersion: ACTION_OBJECTIVE_RUNTIME_SCHEMA_VERSION,
        encounterId: this.contract.encounterId,
        objectiveType: this.contract.objectiveType,
        outcome: 'success',
        status: this.status,
        failureId: null,
        resolvedAtMs: this.nowMs,
      });
    }
  }

  /**
   * Consume one deterministic real-time batch.
   *
   * Cast signals describe the whole elapsed interval and must be repeated while
   * held; a missing or interrupted signal resets that requirement's cast timer.
   */
  advance(input = {}) {
    if (!isObject(input)) throw new TypeError('Action objective advance input must be an object.');
    if (this.status !== 'pending') return this.snapshot();

    const kernelSnapshot = input.kernelSnapshot == null ? null : clone(input.kernelSnapshot);
    if (kernelSnapshot) validateKernelSnapshot(kernelSnapshot);
    if (kernelSnapshot && kernelSnapshot.nowMs < this.nowMs) {
      throw new RangeError('Action objective kernel time cannot move backwards.');
    }
    let elapsedMs;
    if (input.elapsedMs != null) {
      elapsedMs = nonNegativeInteger(input.elapsedMs, 'elapsedMs');
      if (kernelSnapshot && kernelSnapshot.nowMs - this.nowMs !== elapsedMs) {
        throw new RangeError('elapsedMs must equal the action kernel snapshot time delta.');
      }
    } else {
      elapsedMs = kernelSnapshot ? kernelSnapshot.nowMs - this.nowMs : 0;
    }

    for (const [name, value] of Object.entries({
      events: input.events ?? [],
      subjects: input.subjects ?? [],
      interactions: input.interactions ?? [],
      casts: input.casts ?? [],
    })) {
      if (!Array.isArray(value)) throw new TypeError(`${name} must be an array.`);
    }
    const events = (input.events ?? []).map(normalizeEvent);
    const subjects = (input.subjects ?? []).map(normalizeSubject);
    const interactions = (input.interactions ?? []).map(normalizeInteraction);
    const casts = (input.casts ?? []).map(normalizeCast);

    const authoritySnapshot = kernelSnapshot ?? this.lastKernelSnapshot;
    for (const interaction of interactions) {
      validateActorAuthority(interaction.actorId, authoritySnapshot, `Interaction ${interaction.actionId}`);
    }
    const castRequirementIds = new Set();
    for (const cast of casts) {
      validateActorAuthority(cast.actorId, authoritySnapshot, `Cast ${cast.castId}`);
      for (const requirement of this.contract.requirements) {
        if (requirement.semantics !== 'cast-count'
            || requirement.castId !== cast.castId
            || !requirement.anchorIds.includes(cast.anchorId)) continue;
        if (castRequirementIds.has(requirement.id)) {
          throw new RangeError(`Multiple cast signals target requirement ${requirement.id} in one advance.`);
        }
        castRequirementIds.add(requirement.id);
      }
    }

    const previousSnapshot = this.lastKernelSnapshot;
    this.nowMs = kernelSnapshot ? kernelSnapshot.nowMs : this.nowMs + elapsedMs;
    this.lastKernelSnapshot = kernelSnapshot ?? this.lastKernelSnapshot;

    const projectedEvents = this._projectEvents(events, kernelSnapshot, previousSnapshot);
    for (const event of projectedEvents) {
      if (event.sequence != null) {
        const key = `${event.sequence}:${event.type}`;
        if (this.seenSequencedEvents.has(key)) continue;
        this.seenSequencedEvents.add(key);
      }
      this._consumeEvent(event);
    }
    this._consumeInteractions(interactions);
    this._consumeCasts(casts, elapsedMs);
    this._consumeOverlaps(subjects, this.lastKernelSnapshot);
    this._settle();
    return this.snapshot();
  }

  snapshot() {
    const requirements = this.contract.requirements.map((requirement) => {
      const progress = this.progressById.get(requirement.id);
      return {
        id: requirement.id,
        semantics: requirement.semantics,
        available: this._available(requirement),
        value: progress.value,
        target: progress.target,
        completed: progress.completed,
        completedAtMs: progress.completedAtMs,
        castElapsedMs: requirement.semantics === 'cast-count' ? progress.castElapsedMs : null,
        castDurationMs: requirement.semantics === 'cast-count' ? requirement.durationMs : null,
      };
    });
    const failures = this.contract.failures.map((failure) => {
      const progress = this.failureProgressById.get(failure.id);
      return {
        id: failure.id,
        value: progress.value,
        target: progress.target,
        triggered: progress.triggered,
        triggeredAtMs: progress.triggeredAtMs,
      };
    });
    return deepFreeze({
      schemaVersion: ACTION_OBJECTIVE_RUNTIME_SCHEMA_VERSION,
      encounterId: this.contract.encounterId,
      objectiveType: this.contract.objectiveType,
      status: this.status,
      nowMs: this.nowMs,
      requirements,
      failures,
      result: this.terminalResult,
    });
  }

  result() {
    return this.terminalResult;
  }
}

/** Convenience constructor matching the runtime's named option surface. */
export function createActionObjectiveRuntime(options) {
  return new ActionObjectiveRuntime(options);
}
