/**
 * Deterministic side-view combat cadence rehearsal.
 *
 * This is a mechanical regression lane, not a human feel verdict. A deliberately
 * simple player policy closes distance, dashes across dead space, and commits the
 * first ready authored attack while companion AI remains authoritative. The
 * resulting windows catch opening encounters that collapse before their first
 * telegraph or become low-risk health sponges.
 */

import { pathToFileURL } from 'node:url';

import { ACTION_FIXED_STEP_MS } from './action-combat.mjs';
import { createActionEncounterKernel } from './action-encounter-adapter.mjs';

export const ACTION_COMBAT_PACING_CASES = Object.freeze([
  Object.freeze({
    encounterId: 'c1-cinder-hounds',
    minimumMs: 10_000,
    maximumMs: 35_000,
    minimumSurvivorRatio: 0.25,
  }),
  Object.freeze({
    encounterId: 'c1-ash-wisps',
    minimumMs: 7_000,
    maximumMs: 30_000,
    minimumSurvivorRatio: 0.20,
  }),
  Object.freeze({
    encounterId: 'fp1-cedar-path',
    minimumMs: 12_000,
    maximumMs: 40_000,
    minimumSurvivorRatio: 0.25,
  }),
  Object.freeze({
    encounterId: 'fp1-flooded-archive',
    minimumMs: 20_000,
    maximumMs: 55_000,
    minimumSurvivorRatio: 0.25,
  }),
]);

function nearestLivingEnemy(snapshot, actor) {
  return snapshot.actors
    .filter((candidate) => candidate.faction === 'enemy' && candidate.hp > 0)
    .sort((left, right) => (
      Math.abs(left.position.x - actor.position.x)
        - Math.abs(right.position.x - actor.position.x)
      || left.id.localeCompare(right.id)
    ))[0] ?? null;
}

function ensureLivingControlledActor(kernel, snapshot) {
  const controlled = snapshot.actors.find((actor) => (
    actor.id === snapshot.controlledActorId && actor.hp > 0
  ));
  if (controlled) return controlled;
  const replacement = snapshot.actors.find((actor) => actor.faction === 'player' && actor.hp > 0);
  if (replacement) kernel.switchControlledActor(replacement.id);
  return replacement ?? null;
}

function applySimplePlayerPolicy(kernel) {
  const snapshot = kernel.snapshot();
  const actor = ensureLivingControlledActor(kernel, snapshot);
  if (!actor) return;
  const target = nearestLivingEnemy(snapshot, actor);
  if (!target) {
    kernel.setMovement(actor.id, { x: 0, y: 0 });
    return;
  }

  const distance = Math.abs(target.position.x - actor.position.x);
  kernel.setMovement(actor.id, {
    x: Math.sign(target.position.x - actor.position.x),
    y: 0,
  });
  if (distance > 180) kernel.requestManeuver(actor.id, 'dash');
  for (const attackId of Object.keys(actor.attackStates)) {
    if (kernel.requestAttack(actor.id, attackId).ok) break;
  }
}

function survivorRatio(snapshot) {
  const livingParty = snapshot.actors.filter((actor) => actor.faction === 'player' && actor.hp > 0);
  if (!livingParty.length) return 0;
  return Math.min(...livingParty.map((actor) => actor.hp / actor.maxHp));
}

export function runActionCombatPacingCase(testCase) {
  const { kernel } = createActionEncounterKernel(testCase.encounterId);
  const hardStopMs = Math.max(testCase.maximumMs * 2, 60_000);
  let elapsedMs = 0;
  let hitCount = 0;
  let attackStartCount = 0;

  while (!kernel.snapshot().outcome && elapsedMs < hardStopMs) {
    applySimplePlayerPolicy(kernel);
    kernel.advance(ACTION_FIXED_STEP_MS);
    elapsedMs += ACTION_FIXED_STEP_MS;
    for (const event of kernel.drainEvents()) {
      if (event.type === 'hit') hitCount += 1;
      if (event.type === 'attack-start') attackStartCount += 1;
    }
  }

  const snapshot = kernel.snapshot();
  const minimumSurvivorRatio = survivorRatio(snapshot);
  const violations = [];
  if (snapshot.outcome !== 'victory') violations.push(`expected victory; received ${snapshot.outcome ?? 'timeout'}`);
  if (elapsedMs < testCase.minimumMs) violations.push(`resolved in ${elapsedMs} ms; minimum is ${testCase.minimumMs} ms`);
  if (elapsedMs > testCase.maximumMs) violations.push(`resolved in ${elapsedMs} ms; maximum is ${testCase.maximumMs} ms`);
  if (minimumSurvivorRatio < testCase.minimumSurvivorRatio) {
    violations.push(
      `minimum survivor ratio ${minimumSurvivorRatio.toFixed(3)} is below ${testCase.minimumSurvivorRatio.toFixed(3)}`,
    );
  }

  return Object.freeze({
    encounterId: testCase.encounterId,
    elapsedMs,
    outcome: snapshot.outcome,
    minimumSurvivorRatio: Number(minimumSurvivorRatio.toFixed(4)),
    hitCount,
    attackStartCount,
    violations: Object.freeze(violations),
  });
}

export function runActionCombatPacingAudit() {
  const encounters = ACTION_COMBAT_PACING_CASES.map(runActionCombatPacingCase);
  const violations = encounters.flatMap((entry) => (
    entry.violations.map((message) => `${entry.encounterId}: ${message}`)
  ));
  return Object.freeze({
    version: 1,
    policy: 'close-distance-dash-first-ready-attack',
    passed: violations.length === 0,
    encounters: Object.freeze(encounters),
    violations: Object.freeze(violations),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${JSON.stringify(runActionCombatPacingAudit(), null, 2)}\n`);
}
