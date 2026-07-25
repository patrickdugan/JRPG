/**
 * Deterministic whole-campaign Storyworld balance rehearsal.
 *
 * This uses the browser runtime itself rather than approximating reaction
 * selection. Each narrative route receives the same number of seeded runs,
 * with uniform player-option selection except for the route-defining war
 * table choice.
 */

import { pathToFileURL } from 'node:url';

import { deriveActRouteProfile } from './act-route-projection.mjs';
import { getNarrativeRouteSchedules } from './campaign-route-scheduler.mjs';
import {
  STORYWORLD_CLUSTERS,
  STORYWORLD_PROPERTIES,
} from './content/storyworld-encounters.generated.mjs';
import {
  advanceStoryworldEncounter,
  beginStoryworldEncounter,
  chooseStoryworldOption,
  createStoryworldState,
  deriveStoryworldProjection,
  getStoryworldProgress,
  getVisibleStoryworldOptions,
} from './storyworld-runtime.mjs';

const ROUTE_OPTION_INDEX = Object.freeze({ salt: 0, ash: 1, paper: 2 });
const FINAL_CLUSTER_ID = 'sw10-corrections-desk';
const ENMA_CLUSTER_ID = 'sw-enma-three-terms';

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function increment(record, key) {
  record[key] = (record[key] ?? 0) + 1;
}

function selectOption(options, random) {
  return options[Math.floor(random() * options.length)];
}

function resolveCluster(state, cluster, option) {
  const begun = beginStoryworldEncounter(state, cluster.id);
  if (!begun.ok) throw new Error(`${cluster.id}: ${begun.code}`);
  const entry = chooseStoryworldOption(begun.state, cluster.id, option.id);
  if (!entry.ok) throw new Error(`${cluster.id}: ${entry.code}`);
  const entryReactionId = entry.reaction.id;
  let next = advanceStoryworldEncounter(entry.state, cluster.id);
  if (!next.ok) throw new Error(`${cluster.id}: ${next.code}`);
  const outcome = getStoryworldProgress(next.state, cluster.id).outcome;
  const outcomeOptions = getVisibleStoryworldOptions(next.state, cluster.id);
  let outcomeReactionId = null;
  if (outcomeOptions.length) {
    const carried = chooseStoryworldOption(next.state, cluster.id, outcomeOptions[0].id);
    if (!carried.ok) throw new Error(`${cluster.id}: ${carried.code}`);
    outcomeReactionId = carried.reaction.id;
    next = advanceStoryworldEncounter(carried.state, cluster.id);
    if (!next.ok) throw new Error(`${cluster.id}: ${next.code}`);
  } else {
    next = advanceStoryworldEncounter(next.state, cluster.id);
    if (!next.ok) throw new Error(`${cluster.id}: ${next.code}`);
  }
  return Object.freeze({
    state: next.state,
    entryReactionId,
    outcomeReactionId,
    outcomeKey: outcome.resolutionKey,
  });
}

function staticThreadCoverage() {
  const coverage = Object.fromEntries(STORYWORLD_PROPERTIES.map(({ id }) => [
    id,
    { gateClusters: new Set(), effectClusters: new Set() },
  ]));
  for (const cluster of STORYWORLD_CLUSTERS) {
    const encounters = [cluster.entry, ...cluster.outcomes];
    for (const encounter of encounters) {
      for (const option of encounter.options) {
        for (const reaction of option.reactions) {
          const scorePropertyIds = reaction.score.terms
            ? reaction.score.terms.map(({ propertyId }) => propertyId)
            : [reaction.score.propertyId];
          for (const propertyId of scorePropertyIds) {
            coverage[propertyId]?.gateClusters.add(cluster.id);
          }
          for (const { propertyId } of reaction.effects) {
            coverage[propertyId]?.effectClusters.add(cluster.id);
          }
        }
      }
    }
  }
  return Object.fromEntries(Object.entries(coverage).map(([propertyId, record]) => [
    propertyId,
    Object.freeze({
      gateClusterCount: record.gateClusters.size,
      effectClusterCount: record.effectClusters.size,
      gateClusters: Object.freeze([...record.gateClusters]),
      effectClusters: Object.freeze([...record.effectClusters]),
    }),
  ]));
}

function summarizeRoute(route, runs, endingCounts, enmaCounts, finalOptionReactions, gateCounts, sums) {
  const fractionRecord = (record) => Object.fromEntries(Object.entries(record)
    .map(([key, count]) => [key, Number((count / runs).toFixed(4))]));
  return Object.freeze({
    route,
    runs,
    endings: Object.freeze(fractionRecord(endingCounts)),
    enmaOutcomes: Object.freeze(fractionRecord(enmaCounts)),
    finalOptionReactions: Object.freeze(Object.fromEntries(
      Object.entries(finalOptionReactions).map(([optionId, counts]) => [
        optionId,
        Object.freeze(fractionRecord(counts)),
      ]),
    )),
    act5GateAvailability: Object.freeze(fractionRecord(gateCounts)),
    meanCivilWarRisk: Number((sums.civilWarRisk / runs).toFixed(4)),
    meanSurrenderLeverage: Number((sums.surrenderLeverage / runs).toFixed(4)),
    meanEffectiveSuccessionReadiness: Number((sums.effectiveSuccessionReadiness / runs).toFixed(4)),
    meanGarrisonStandDownReadiness: Number((sums.garrisonStandDownReadiness / runs).toFixed(4)),
    meanEnmaCooperation: Number((sums.enmaCooperation / runs).toFixed(4)),
    meanEffectiveOniSupplyDisruption: Number((sums.effectiveOniSupplyDisruption / runs).toFixed(4)),
  });
}

export function runStoryworldBalanceAudit({ runsPerRoute = 5_000, seed = 42 } = {}) {
  if (!Number.isSafeInteger(runsPerRoute) || runsPerRoute < 1) {
    throw new RangeError('runsPerRoute must be a positive safe integer.');
  }
  if (!Number.isSafeInteger(seed)) throw new TypeError('seed must be a safe integer.');

  const clusterById = new Map(STORYWORLD_CLUSTERS.map((cluster) => [cluster.id, cluster]));
  const routes = [];
  const globalEndings = {};
  const globalClusterOutcomes = {};
  const globalEntryReactions = new Map();

  for (const [routeIndex, schedule] of getNarrativeRouteSchedules().entries()) {
    const random = seededRandom(seed + routeIndex * 10_007);
    const endingCounts = {};
    const enmaCounts = {};
    const finalOptionReactions = {};
    const gateCounts = {};
    const sums = {
      civilWarRisk: 0,
      surrenderLeverage: 0,
      effectiveSuccessionReadiness: 0,
      garrisonStandDownReadiness: 0,
      enmaCooperation: 0,
      effectiveOniSupplyDisruption: 0,
    };

    for (let run = 0; run < runsPerRoute; run += 1) {
      let state = createStoryworldState({
        runId: `balance-${schedule.priorityTheater}-${seed}-${run}`,
      });
      for (const clusterId of schedule.storyworldDecisionIds) {
        const cluster = clusterById.get(clusterId);
        const option = clusterId === 'sw3-sayos-warehouse-conditions'
          ? cluster.entry.options[ROUTE_OPTION_INDEX[schedule.priorityTheater]]
          : selectOption(cluster.entry.options, random);

        if (clusterId === FINAL_CLUSTER_ID) {
          const profile = deriveActRouteProfile(deriveStoryworldProjection(state));
          const { act5Parameters } = profile;
          for (const gate of [
            'cleanSuccessionPrepared',
            'massOniReinforcement',
            'outerGarrisonCanStandDown',
            'executionAvoidsImmediateCivilWar',
            'witnessedSeppukuAtDawnAvailable',
            'negotiatedSealReturnAvailable',
          ]) {
            if (act5Parameters[gate]) increment(gateCounts, gate);
          }
          sums.civilWarRisk += act5Parameters.civilWarRisk;
          sums.surrenderLeverage += act5Parameters.surrenderLeverage;
          sums.effectiveSuccessionReadiness += act5Parameters.effectiveSuccessionReadiness;
          sums.garrisonStandDownReadiness += act5Parameters.garrisonStandDownReadiness;
          sums.enmaCooperation += act5Parameters.enmaCooperation;
          sums.effectiveOniSupplyDisruption += act5Parameters.effectiveOniSupplyDisruption;
        }

        const resolution = resolveCluster(state, cluster, option);
        state = resolution.state;
        const optionReactions = globalEntryReactions.get(option.id) ?? new Set();
        optionReactions.add(resolution.entryReactionId);
        globalEntryReactions.set(option.id, optionReactions);
        const clusterOutcomes = globalClusterOutcomes[cluster.id] ?? {};
        increment(clusterOutcomes, resolution.outcomeKey);
        globalClusterOutcomes[cluster.id] = clusterOutcomes;
        if (clusterId === ENMA_CLUSTER_ID) increment(enmaCounts, resolution.outcomeKey);
        if (clusterId === FINAL_CLUSTER_ID) {
          increment(endingCounts, resolution.outcomeKey);
          increment(globalEndings, resolution.outcomeKey);
          const optionCounts = finalOptionReactions[option.id] ?? {};
          increment(optionCounts, resolution.entryReactionId.endsWith('_r_accord') ? 'accord' : 'revision');
          finalOptionReactions[option.id] = optionCounts;
        }
      }
    }
    routes.push(summarizeRoute(
      schedule.priorityTheater,
      runsPerRoute,
      endingCounts,
      enmaCounts,
      finalOptionReactions,
      gateCounts,
      sums,
    ));
  }

  const totalRuns = runsPerRoute * routes.length;
  return Object.freeze({
    seed,
    runsPerRoute,
    totalRuns,
    globalEndings: Object.freeze(Object.fromEntries(Object.entries(globalEndings)
      .map(([key, count]) => [key, Number((count / totalRuns).toFixed(4))]))),
    clusterOutcomeCounts: Object.freeze(globalClusterOutcomes),
    routes: Object.freeze(routes),
    historySensitiveEntryOptionCount: [...globalEntryReactions.values()]
      .filter((reactions) => reactions.size > 1).length,
    propertyThreadCoverage: Object.freeze(staticThreadCoverage()),
  });
}

function printAudit(audit) {
  process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runsIndex = process.argv.indexOf('--runs');
  const seedIndex = process.argv.indexOf('--seed');
  printAudit(runStoryworldBalanceAudit({
    runsPerRoute: runsIndex >= 0 ? Number(process.argv[runsIndex + 1]) : 5_000,
    seed: seedIndex >= 0 ? Number(process.argv[seedIndex + 1]) : 42,
  }));
}
