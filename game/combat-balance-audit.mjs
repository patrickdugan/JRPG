/** Deterministic first-clear and replay balance audit; no wall-clock timing. */

import { CampaignCombatEngine, PARTY_PROFILES } from './campaign-combat.mjs';
import { solveCampaignCombat } from './battle-solver.mjs';
import { ENCOUNTERS } from './content/encounters.mjs';
import {
  createAdvancementState,
  getEncounterRewardPreview,
  getParty,
  getPartyMember,
  preparePartyForEncounter,
  recordEncounterWin,
} from './advancement.mjs';
import {
  applyLoadoutToPartyProfile,
  createLoadoutState,
  grantInventory,
  syncPartyVitals,
} from './loadout.mjs';
import { benchmarkRepeatBattleSpeeds } from './repeat-battle.mjs';

export const COMBAT_BALANCE_AUDIT_SCHEMA_VERSION = 1;
export const COMBAT_BALANCE_LIMITS = Object.freeze({
  minimumFirstClearSurvivorHpRatio: 0.1,
  maximumFirstClearPlayerCommands: 60,
  maximumFirstClearGuardShare: 0.75,
  maximumRepeatPolicySteps: 125,
  maximumRepeatBasePresentationMs: 60_000,
});

const sum = (values) => values.reduce((total, value) => total + value, 0);
const rounded = (value, places = 6) => Number(value.toFixed(places));

function combatProfiles(encounter, advancementState, loadoutState, rested = false) {
  return Object.fromEntries(encounter.party.roster.map((memberId) => {
    const base = PARTY_PROFILES[memberId];
    const member = getPartyMember(advancementState, memberId);
    const adapted = applyLoadoutToPartyProfile({
      ...base,
      stats: {
        hp: member.stats.hp,
        power: Math.max(member.stats.power, member.stats.arcana),
        guard: member.stats.guard,
        speed: member.stats.speed,
      },
    }, loadoutState, memberId);
    return [memberId, { ...adapted, currentHp: rested ? adapted.stats.hp : loadoutState.vitals[memberId].hp }];
  }));
}

function firstClearMetrics(encounter, solution) {
  const party = solution.snapshot.actors.filter((actor) => actor.faction === 'party');
  const partyIds = new Set(party.map(({ instanceId }) => instanceId));
  const damageEvents = solution.snapshot.log.filter((event) => (
    ['damage', 'status-damage'].includes(event.type)
      && partyIds.has(event.targetId)
      && event.finalDamage > 0
  ));
  const guardCommands = solution.trace.filter(({ type }) => type === 'guard').length;
  const enemySkillIds = [...new Set(damageEvents
    .filter(({ attackerId }) => attackerId?.endsWith('-1') || attackerId)
    .map(({ skillId, sourceSkillId }) => skillId ?? sourceSkillId)
    .filter(Boolean))].sort();
  const observedRecoveryPulses = [...new Set(encounter.enemies
    .flatMap(({ skills }) => skills ?? [])
    .filter(({ id }) => enemySkillIds.includes(id))
    .map(({ recoveryPulses }) => recoveryPulses ?? 1))].sort((left, right) => left - right);
  const minimumSurvivorHpRatio = Math.min(...party.map(({ hp, maxHp }) => hp / maxHp));
  const aggregatePartyHpRatio = sum(party.map(({ hp }) => hp)) / sum(party.map(({ maxHp }) => maxHp));
  return Object.freeze({
    encounterId: encounter.id,
    result: solution.result,
    solved: solution.solved,
    playerCommands: solution.playerCommands,
    enemyActivations: solution.enemyActivations,
    finalPulse: solution.snapshot.nowPulse,
    skillCommands: solution.trace.filter(({ type }) => type === 'skill').length,
    objectiveCommands: solution.trace.filter(({ type }) => type === 'objective').length,
    guardCommands,
    guardShare: rounded(guardCommands / solution.playerCommands),
    partyKnockouts: party.filter(({ hp }) => hp <= 0).length,
    minimumSurvivorHpRatio: rounded(minimumSurvivorHpRatio),
    aggregatePartyHpRatio: rounded(aggregatePartyHpRatio),
    partyDamageTaken: sum(damageEvents.map(({ finalDamage }) => finalDamage)),
    maximumSingleHit: Math.max(0, ...damageEvents.map(({ finalDamage }) => finalDamage)),
    observedEnemySkillIds: Object.freeze(enemySkillIds),
    observedEnemyRecoveryPulses: Object.freeze(observedRecoveryPulses),
  });
}

function repeatMetrics(encounter, benchmark) {
  const baseline = benchmark.runs[0];
  return Object.freeze({
    encounterId: encounter.id,
    result: baseline.result,
    policySteps: baseline.steps,
    playerDecisions: baseline.decisions.length,
    enemyActivations: baseline.timeline.filter(({ type }) => type === 'enemyActivation').length,
    basePresentationMs: baseline.baseDurationMs,
    scheduledMsBySpeed: Object.freeze(Object.fromEntries(benchmark.runs.map((run) => [
      run.speedMultiplier,
      run.simulatedDurationMs,
    ]))),
    exactSpeedRatios: benchmark.ratios,
    decisionsAndRewardsInvariant: benchmark.decisionsAndRewardsInvariant,
    verified: benchmark.verified,
  });
}

function encounterViolations(firstClear, repeat) {
  const violations = [];
  if (!firstClear.solved) violations.push('first-clear-not-solved');
  if (firstClear.partyKnockouts > 0) violations.push('first-clear-party-knockout');
  if (firstClear.minimumSurvivorHpRatio < COMBAT_BALANCE_LIMITS.minimumFirstClearSurvivorHpRatio) violations.push('first-clear-survivor-margin');
  if (firstClear.playerCommands > COMBAT_BALANCE_LIMITS.maximumFirstClearPlayerCommands) violations.push('first-clear-command-load');
  if (firstClear.guardShare > COMBAT_BALANCE_LIMITS.maximumFirstClearGuardShare) violations.push('first-clear-guard-share');
  if (!repeat.verified) violations.push('repeat-speed-invariance');
  if (repeat.policySteps > COMBAT_BALANCE_LIMITS.maximumRepeatPolicySteps) violations.push('repeat-policy-step-load');
  if (repeat.basePresentationMs > COMBAT_BALANCE_LIMITS.maximumRepeatBasePresentationMs) violations.push('repeat-presentation-load');
  return Object.freeze(violations);
}

/**
 * Exercise the same chronological progression/loadout path as canonical play,
 * then a rested first replay at exact 1x/2x/4x presentation schedules.
 */
export function createCombatBalanceAudit() {
  let advancementState = createAdvancementState();
  let loadoutState = createLoadoutState();
  const encounters = [];

  for (const encounter of ENCOUNTERS) {
    advancementState = preparePartyForEncounter(advancementState, encounter.id);
    const synced = syncPartyVitals(loadoutState, getParty(advancementState));
    if (!synced.ok) throw new Error(`Combat balance audit could not synchronize ${encounter.id}.`);
    loadoutState = synced.state;

    const profiles = combatProfiles(encounter, advancementState, loadoutState);
    const solution = solveCampaignCombat(new CampaignCombatEngine({ encounterId: encounter.id, partyProfiles: profiles }));
    const firstClear = firstClearMetrics(encounter, solution);

    const reward = getEncounterRewardPreview(encounter.id, 0);
    advancementState = recordEncounterWin(advancementState, encounter.id, { partyIds: encounter.party.roster });
    const granted = grantInventory(loadoutState, { currency: reward.currency, items: reward.items });
    if (!granted.ok) throw new Error(`Combat balance audit could not stage repeat inventory for ${encounter.id}.`);
    loadoutState = granted.state;

    const repeatProfiles = combatProfiles(encounter, advancementState, loadoutState, true);
    const benchmark = benchmarkRepeatBattleSpeeds({
      encounterId: encounter.id,
      priorWins: 1,
      partyProfiles: repeatProfiles,
    });
    const repeat = repeatMetrics(encounter, benchmark);
    encounters.push(Object.freeze({
      encounterId: encounter.id,
      objectiveType: encounter.objective.type,
      firstClear,
      repeat,
      violations: encounterViolations(firstClear, repeat),
    }));
  }

  const firstClears = encounters.map(({ firstClear }) => firstClear);
  const repeats = encounters.map(({ repeat }) => repeat);
  const minimumMargin = [...firstClears].sort((left, right) => (
    left.minimumSurvivorHpRatio - right.minimumSurvivorHpRatio
      || left.encounterId.localeCompare(right.encounterId)
  ))[0];
  const maximumCommandLoad = [...firstClears].sort((left, right) => (
    right.playerCommands - left.playerCommands
      || left.encounterId.localeCompare(right.encounterId)
  ))[0];
  const maximumRepeatLoad = [...repeats].sort((left, right) => (
    right.basePresentationMs - left.basePresentationMs
      || left.encounterId.localeCompare(right.encounterId)
  ))[0];
  const violations = encounters.flatMap(({ encounterId, violations: reasons }) => (
    reasons.map((reason) => Object.freeze({ encounterId, reason }))
  ));
  const kurozane = encounters.find(({ encounterId }) => encounterId === 'c9-kurozane').firstClear;

  return Object.freeze({
    schemaVersion: COMBAT_BALANCE_AUDIT_SCHEMA_VERSION,
    scheduleOnly: true,
    wallClockTimingUsed: false,
    encounterCount: encounters.length,
    encounters: Object.freeze(encounters),
    summary: Object.freeze({
      firstClearVictories: firstClears.filter(({ solved }) => solved).length,
      firstClearPlayerCommands: sum(firstClears.map(({ playerCommands }) => playerCommands)),
      firstClearEnemyActivations: sum(firstClears.map(({ enemyActivations }) => enemyActivations)),
      firstClearPartyKnockouts: sum(firstClears.map(({ partyKnockouts }) => partyKnockouts)),
      minimumSurvivorHpRatio: minimumMargin.minimumSurvivorHpRatio,
      minimumSurvivorEncounterId: minimumMargin.encounterId,
      maximumPlayerCommands: maximumCommandLoad.playerCommands,
      maximumPlayerCommandEncounterId: maximumCommandLoad.encounterId,
      repeatPolicySteps: sum(repeats.map(({ policySteps }) => policySteps)),
      repeatBasePresentationMs: sum(repeats.map(({ basePresentationMs }) => basePresentationMs)),
      maximumRepeatBasePresentationMs: maximumRepeatLoad.basePresentationMs,
      maximumRepeatEncounterId: maximumRepeatLoad.encounterId,
      speedInvariantEncounterCount: repeats.filter(({ verified }) => verified).length,
      kurozaneObservedSkillIds: kurozane.observedEnemySkillIds,
      kurozaneObservedRecoveryPulses: kurozane.observedEnemyRecoveryPulses,
      violationCount: violations.length,
    }),
    violations: Object.freeze(violations),
  });
}
