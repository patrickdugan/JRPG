/**
 * DOM-free repeat-battle automation and deterministic speed benchmark.
 *
 * Speed changes only the presentation schedule. Combat decisions, engine
 * pulses, terminal state, and advancement rewards remain speed-independent.
 */

import {
  CAMPAIGN_COMBAT_PHASES,
  CampaignCombatEngine,
  RECOVERY_PULSE_MS,
} from './campaign-combat.mjs';
import { getEncounter } from './content/encounters.mjs';
import { getEncounterRewardPreview, SPEED_MULTIPLIERS } from './advancement.mjs';
import { chooseCampaignCombatCommand } from './battle-solver.mjs';

export const REPEAT_BATTLE_SPEEDS = SPEED_MULTIPLIERS;
export const REPEAT_LOOP_PRESENTATION_MS = Object.freeze({
  intro: 800,
  move: 240,
  skill: 480,
  guard: 400,
  analyze: 480,
  objective: 480,
  enemyActivation: 800,
  resolution: 600,
  reward: 800,
});

const clone = (value) => JSON.parse(JSON.stringify(value));

function validateSpeed(speedMultiplier) {
  if (!REPEAT_BATTLE_SPEEDS.includes(speedMultiplier)) {
    throw new RangeError('Repeat battle speed must be 1, 2, or 4.');
  }
}

/**
 * Resolve the presentation speed at the battle boundary.
 *
 * A saved preference is deliberately ignored until this exact encounter has
 * a prior win. This keeps every first clear at the authored 1x cadence while
 * allowing the same global preference to follow the player into any replay.
 */
export function resolveBattlePresentationSpeed(priorWins, savedSpeedMultiplier = 1) {
  if (!Number.isSafeInteger(priorWins) || priorWins < 0) {
    throw new RangeError('priorWins must be a non-negative safe integer.');
  }
  validateSpeed(savedSpeedMultiplier);
  return priorWins > 0 ? savedSpeedMultiplier : 1;
}

/** Shared UI/benchmark timing contract for one presented repeat-loop step. */
export function getRepeatStepDelayMs(type, speedMultiplier, recoveredPulses = 0) {
  validateSpeed(speedMultiplier);
  if (!Object.hasOwn(REPEAT_LOOP_PRESENTATION_MS, type)) throw new RangeError(`Unknown repeat presentation step: ${type}`);
  if (!Number.isSafeInteger(recoveredPulses) || recoveredPulses < 0) throw new RangeError('recoveredPulses must be a non-negative safe integer.');
  return (REPEAT_LOOP_PRESENTATION_MS[type] + (recoveredPulses * RECOVERY_PULSE_MS)) / speedMultiplier;
}

/** Purely deterministic command policy used only after an encounter's first clear. */
export function chooseRepeatBattleCommand(engine) {
  const snapshot = engine.snapshot();
  const actor = snapshot.actors.find((candidate) => candidate.instanceId === snapshot.activeActorId);
  if (snapshot.phase !== CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND || actor?.faction !== 'party') return null;
  return chooseCampaignCombatCommand(engine);
}

function executePlayerCommand(engine, actorId, command) {
  switch (command.type) {
    case 'move': return engine.move(actorId, command.dx, command.dy);
    case 'skill': return engine.useSkill(actorId, command.skillId, command.targetId);
    case 'objective': return engine.performObjectiveAction(actorId, command.action);
    case 'guard': return engine.guard(actorId);
    case 'analyze': return engine.analyze(actorId, command.targetId);
    default: return { ok: false, reason: `Unsupported repeat command ${command.type}.` };
  }
}

function canonicalDecision(actorId, command) {
  return clone({ actorId, ...command });
}

/** Run one already-cleared encounter without wall-clock waits. */
export function runRepeatBattle({
  encounterId,
  priorWins = 1,
  speedMultiplier = 1,
  partyProfiles,
  maxSteps = 2_000,
} = {}) {
  validateSpeed(speedMultiplier);
  const encounter = getEncounter(encounterId);
  if (!encounter) throw new RangeError(`Unknown encounter ID: ${encounterId}`);
  if (!Number.isSafeInteger(priorWins) || priorWins < 1) throw new RangeError('Repeat automation requires at least one prior win.');
  if (!Number.isSafeInteger(maxSteps) || maxSteps < 1) throw new RangeError('maxSteps must be a positive safe integer.');

  const engine = new CampaignCombatEngine({ encounter, partyProfiles });
  const decisions = [];
  const timeline = [{ type: 'intro', baseMs: REPEAT_LOOP_PRESENTATION_MS.intro }];
  let steps = 0;
  while (!engine.result && steps < maxSteps) {
    const beforePulse = engine.nowPulse;
    if (engine.phase === CAMPAIGN_COMBAT_PHASES.PLAYER_COMMAND) {
      const actorId = engine.activeActorId;
      const command = chooseRepeatBattleCommand(engine);
      if (!command) throw new Error('Repeat policy could not produce a party command.');
      const result = executePlayerCommand(engine, actorId, command);
      if (!result.ok) throw new Error(`Repeat command failed: ${result.reason}`);
      decisions.push(canonicalDecision(actorId, command));
      timeline.push({ type: command.type, baseMs: REPEAT_LOOP_PRESENTATION_MS[command.type] });
    } else if (engine.phase === CAMPAIGN_COMBAT_PHASES.ENEMY_COMMAND) {
      const actorId = engine.activeActorId;
      const result = engine.resolveEnemyActivation();
      if (!result.ok) throw new Error(`Enemy activation failed: ${result.reason}`);
      timeline.push({ type: 'enemyActivation', actorId, baseMs: REPEAT_LOOP_PRESENTATION_MS.enemyActivation });
    } else {
      throw new Error(`Unexpected repeat battle phase: ${engine.phase}`);
    }
    const recoveredPulses = Math.max(0, engine.nowPulse - beforePulse);
    if (recoveredPulses) timeline.push({ type: 'recovery', pulses: recoveredPulses, baseMs: recoveredPulses * RECOVERY_PULSE_MS });
    steps += 1;
  }
  if (!engine.result) throw new Error(`Repeat battle exceeded ${maxSteps} policy steps.`);
  timeline.push({ type: 'resolution', result: engine.result, baseMs: REPEAT_LOOP_PRESENTATION_MS.resolution });
  const reward = engine.result === 'victory' ? getEncounterRewardPreview(encounterId, priorWins) : null;
  if (reward) timeline.push({ type: 'reward', baseMs: REPEAT_LOOP_PRESENTATION_MS.reward });
  const baseDurationMs = timeline.reduce((sum, event) => sum + event.baseMs, 0);
  return Object.freeze({
    encounterId,
    priorWins,
    speedMultiplier,
    result: engine.result,
    steps,
    decisions: Object.freeze(decisions),
    reward,
    combatLog: Object.freeze(engine.snapshot().log),
    timeline: Object.freeze(timeline.map((event) => Object.freeze({ ...event, scheduledMs: event.baseMs / speedMultiplier }))),
    baseDurationMs,
    simulatedDurationMs: baseDurationMs / speedMultiplier,
  });
}

function invariantSignature(run) {
  return JSON.stringify({ result: run.result, steps: run.steps, decisions: run.decisions, reward: run.reward, combatLog: run.combatLog });
}

/** Prove speed semantics from identical runs; this does not use CPU wall time. */
export function benchmarkRepeatBattleSpeeds(options = {}) {
  const runs = REPEAT_BATTLE_SPEEDS.map((speedMultiplier) => runRepeatBattle({ ...options, speedMultiplier }));
  const baseline = runs[0];
  const baselineSignature = invariantSignature(baseline);
  const invariant = runs.every((run) => invariantSignature(run) === baselineSignature);
  const ratios = Object.freeze(Object.fromEntries(runs.map((run) => [run.speedMultiplier, baseline.simulatedDurationMs / run.simulatedDurationMs])));
  const timingVerified = runs.every((run) => ratios[run.speedMultiplier] === run.speedMultiplier);
  return Object.freeze({
    encounterId: baseline.encounterId,
    runs: Object.freeze(runs),
    ratios,
    decisionsAndRewardsInvariant: invariant,
    timingVerified,
    verified: baseline.result === 'victory' && invariant && timingVerified,
  });
}
