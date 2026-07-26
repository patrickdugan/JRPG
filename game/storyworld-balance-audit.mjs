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
const TEXTURE_NUDGE_UNIT = 0.05;
const ACT_III_IV_CLUSTER_IDS = Object.freeze(new Set([
  'sw3-sayos-warehouse-conditions',
  'sw-sodegaura-lantern-manifests',
  'sw4-margin-varga-journal',
  'sw5-cipher-handoff',
  'sw6-tribunal-afterword',
  'sw7-soldier-will-not-follow',
  'sw8-boats-with-conditions',
  ENMA_CLUSTER_ID,
]));
const PROPERTY_IDS = Object.freeze(STORYWORLD_PROPERTIES.map(({ id }) => id));
const PROPERTY_DEFAULTS = Object.freeze(Object.fromEntries(
  STORYWORLD_PROPERTIES.map(({ id, defaultValue }) => [id, defaultValue]),
));

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

function roundMetric(value) {
  return Number(value.toFixed(4));
}

function projectionDistance(left, right) {
  let l1 = 0;
  let l2Squared = 0;
  let activePropertyCount = 0;
  for (const propertyId of PROPERTY_IDS) {
    const delta = (right[propertyId] ?? 0) - (left[propertyId] ?? 0);
    const magnitude = Math.abs(delta);
    l1 += magnitude;
    l2Squared += delta ** 2;
    if (magnitude >= TEXTURE_NUDGE_UNIT - Number.EPSILON) activePropertyCount += 1;
  }
  return Object.freeze({
    l1,
    l2: Math.sqrt(l2Squared),
    activePropertyCount,
  });
}

function createProjectionAccumulator() {
  return {
    count: 0,
    sums: Object.fromEntries(PROPERTY_IDS.map((propertyId) => [propertyId, 0])),
  };
}

function accumulateProjection(accumulator, projection) {
  accumulator.count += 1;
  for (const propertyId of PROPERTY_IDS) accumulator.sums[propertyId] += projection[propertyId];
}

function projectionCentroid(accumulator) {
  return Object.freeze(Object.fromEntries(PROPERTY_IDS.map((propertyId) => [
    propertyId,
    accumulator.count ? accumulator.sums[propertyId] / accumulator.count : 0,
  ])));
}

function pairwiseCentroidDistances(centroids) {
  const distances = {};
  for (let leftIndex = 0; leftIndex < centroids.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < centroids.length; rightIndex += 1) {
      const left = centroids[leftIndex];
      const right = centroids[rightIndex];
      const distance = projectionDistance(left.projection, right.projection).l2;
      distances[`${left.id}::${right.id}`] = Object.freeze({
        propertyPoints: roundMetric(distance),
        textureNudgeUnits: roundMetric(distance / TEXTURE_NUDGE_UNIT),
      });
    }
  }
  return Object.freeze(distances);
}

function meanPairwiseVectorDistance(vectors) {
  let total = 0;
  let pairs = 0;
  for (let leftIndex = 0; leftIndex < vectors.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < vectors.length; rightIndex += 1) {
      total += projectionDistance(vectors[leftIndex], vectors[rightIndex]).l2;
      pairs += 1;
    }
  }
  return pairs ? total / pairs : 0;
}

function reactionVector(reaction) {
  const vector = Object.fromEntries(PROPERTY_IDS.map((propertyId) => [propertyId, 0]));
  for (const effect of reaction.effects) {
    if (effect.operation === 'invert') continue;
    vector[effect.propertyId] += effect.delta;
  }
  return vector;
}

function reactionScore(reaction, projection) {
  const terms = reaction.score.terms ?? [{
    propertyId: reaction.score.propertyId,
    coefficient: 1,
    invert: reaction.score.invert,
  }];
  return terms.reduce((total, term) => (
    total + term.coefficient * (
      term.invert ? 1 - projection[term.propertyId] : projection[term.propertyId]
    )
  ), reaction.score.offset);
}

function optionScoreMargin(option, projection) {
  const scores = option.reactions
    .map((reaction) => reactionScore(reaction, projection))
    .sort((left, right) => right - left);
  return scores.length > 1 ? scores[0] - scores[1] : scores[0];
}

function accumulateMargin(record, margin) {
  record.count += 1;
  record.total += margin;
  if (margin < 0.05) record.close += 1;
}

function summarizeMargins(records) {
  return Object.freeze(Object.fromEntries([...records.entries()].map(([clusterId, record]) => [
    clusterId,
    Object.freeze({
      meanWinningMargin: roundMetric(record.total / record.count),
      closeDecisionRate: roundMetric(record.close / record.count),
    }),
  ])));
}

function staticEffectGeometry() {
  const clusters = [];
  let branchDistanceTotal = 0;
  let branchOptionCount = 0;
  let optionCentroidDistanceTotal = 0;
  let optionCentroidClusterCount = 0;
  let entryFormulaTermTotal = 0;
  let entryReactionCount = 0;
  let outcomeFormulaTermTotal = 0;
  let outcomeReactionCount = 0;

  for (const cluster of STORYWORLD_CLUSTERS.filter(({ id }) => ACT_III_IV_CLUSTER_IDS.has(id))) {
    const effectPropertyIds = new Set();
    const optionCentroids = [];
    const branchDistances = [];
    for (const option of cluster.entry.options) {
      const vectors = option.reactions.map((reaction) => {
        for (const effect of reaction.effects) effectPropertyIds.add(effect.propertyId);
        entryFormulaTermTotal += (reaction.score.terms ?? [reaction.score]).length;
        entryReactionCount += 1;
        return reactionVector(reaction);
      });
      const branchDistance = meanPairwiseVectorDistance(vectors);
      branchDistances.push(branchDistance);
      branchDistanceTotal += branchDistance;
      branchOptionCount += 1;
      optionCentroids.push(Object.fromEntries(PROPERTY_IDS.map((propertyId) => [
        propertyId,
        vectors.reduce((sum, vector) => sum + vector[propertyId], 0) / vectors.length,
      ])));
    }
    for (const outcome of cluster.outcomes) {
      for (const option of outcome.options) {
        for (const reaction of option.reactions) {
          for (const effect of reaction.effects) effectPropertyIds.add(effect.propertyId);
          outcomeFormulaTermTotal += (reaction.score.terms ?? [reaction.score]).length;
          outcomeReactionCount += 1;
        }
      }
    }
    const optionCentroidDistance = meanPairwiseVectorDistance(optionCentroids);
    optionCentroidDistanceTotal += optionCentroidDistance;
    optionCentroidClusterCount += 1;
    clusters.push(Object.freeze({
      clusterId: cluster.id,
      entryOptionCount: cluster.entry.options.length,
      meanEntryReactionCount: roundMetric(
        cluster.entry.options.reduce((sum, option) => sum + option.reactions.length, 0)
          / cluster.entry.options.length,
      ),
      meanEntryFormulaTermCount: roundMetric(
        cluster.entry.options.reduce(
          (sum, option) => sum + option.reactions.reduce(
            (reactionSum, reaction) => reactionSum + (reaction.score.terms ?? [reaction.score]).length,
            0,
          ),
          0,
        ) / cluster.entry.options.reduce((sum, option) => sum + option.reactions.length, 0),
      ),
      meanReactionBranchDistance: roundMetric(
        branchDistances.reduce((sum, value) => sum + value, 0) / branchDistances.length,
      ),
      optionCentroidDistance: roundMetric(optionCentroidDistance),
      effectPropertyCount: effectPropertyIds.size,
    }));
  }

  return Object.freeze({
    textureNudgeUnit: TEXTURE_NUDGE_UNIT,
    meanReactionBranchDistance: roundMetric(branchDistanceTotal / branchOptionCount),
    meanReactionBranchDistanceInNudgeUnits: roundMetric(
      branchDistanceTotal / branchOptionCount / TEXTURE_NUDGE_UNIT,
    ),
    meanOptionCentroidDistance: roundMetric(optionCentroidDistanceTotal / optionCentroidClusterCount),
    meanOptionCentroidDistanceInNudgeUnits: roundMetric(
      optionCentroidDistanceTotal / optionCentroidClusterCount / TEXTURE_NUDGE_UNIT,
    ),
    meanEntryFormulaTermCount: roundMetric(entryFormulaTermTotal / entryReactionCount),
    meanOutcomeFormulaTermCount: roundMetric(outcomeFormulaTermTotal / outcomeReactionCount),
    clusters: Object.freeze(clusters),
  });
}

function resolveCluster(state, cluster, option) {
  const begun = beginStoryworldEncounter(state, cluster.id);
  if (!begun.ok) throw new Error(`${cluster.id}: ${begun.code}`);
  const entryScoreMargin = optionScoreMargin(option, deriveStoryworldProjection(begun.state));
  const entry = chooseStoryworldOption(begun.state, cluster.id, option.id);
  if (!entry.ok) throw new Error(`${cluster.id}: ${entry.code}`);
  const entryReactionId = entry.reaction.id;
  let next = advanceStoryworldEncounter(entry.state, cluster.id);
  if (!next.ok) throw new Error(`${cluster.id}: ${next.code}`);
  const outcome = getStoryworldProgress(next.state, cluster.id).outcome;
  const outcomeOptions = getVisibleStoryworldOptions(next.state, cluster.id);
  let outcomeReactionId = null;
  let outcomeScoreMargin = null;
  if (outcomeOptions.length) {
    outcomeScoreMargin = optionScoreMargin(
      outcomeOptions[0],
      deriveStoryworldProjection(next.state),
    );
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
    entryScoreMargin,
    outcomeScoreMargin,
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

function summarizeRoute(
  route,
  runs,
  endingCounts,
  enmaCounts,
  finalOptionOutcomes,
  finalFlowCounts,
  gateCounts,
  sums,
) {
  const fractionRecord = (record) => Object.fromEntries(Object.entries(record)
    .map(([key, count]) => [key, Number((count / runs).toFixed(4))]));
  return Object.freeze({
    route,
    runs,
    endings: Object.freeze(fractionRecord(endingCounts)),
    enmaOutcomes: Object.freeze(fractionRecord(enmaCounts)),
    finalOptionOutcomes: Object.freeze(Object.fromEntries(
      Object.entries(finalOptionOutcomes).map(([optionId, counts]) => [
        optionId,
        Object.freeze(fractionRecord(counts)),
      ]),
    )),
    finalFlows: Object.freeze(fractionRecord(finalFlowCounts)),
    act5GateAvailability: Object.freeze(fractionRecord(gateCounts)),
    meanCivilWarRisk: Number((sums.civilWarRisk / runs).toFixed(4)),
    meanSurrenderLeverage: Number((sums.surrenderLeverage / runs).toFixed(4)),
    meanEffectiveSuccessionReadiness: Number((sums.effectiveSuccessionReadiness / runs).toFixed(4)),
    meanGarrisonStandDownReadiness: Number((sums.garrisonStandDownReadiness / runs).toFixed(4)),
    meanEnmaCooperation: Number((sums.enmaCooperation / runs).toFixed(4)),
    meanEffectiveOniSupplyDisruption: Number((sums.effectiveOniSupplyDisruption / runs).toFixed(4)),
    meanKurozanePride: Number((sums.kurozanePride / runs).toFixed(4)),
    meanKurozaneIndispensability: Number((sums.kurozaneIndispensability / runs).toFixed(4)),
    meanKurozaneGuiltPressure: Number((sums.kurozaneGuiltPressure / runs).toFixed(4)),
    metricDistance: Object.freeze({
      textureNudgeUnit: TEXTURE_NUDGE_UNIT,
      meanCumulativeL1PropertyPoints: roundMetric(sums.cumulativeL1 / runs),
      meanCumulativeL1NudgeUnits: roundMetric(sums.cumulativeL1 / runs / TEXTURE_NUDGE_UNIT),
      meanCumulativeL2PropertyPoints: roundMetric(sums.cumulativeL2 / runs),
      meanCumulativeL2NudgeUnits: roundMetric(sums.cumulativeL2 / runs / TEXTURE_NUDGE_UNIT),
      meanPrefinalDisplacementL2PropertyPoints: roundMetric(sums.prefinalDisplacementL2 / runs),
      meanPrefinalDisplacementL2NudgeUnits: roundMetric(
        sums.prefinalDisplacementL2 / runs / TEXTURE_NUDGE_UNIT,
      ),
      meanFinalDisplacementL2PropertyPoints: roundMetric(sums.finalDisplacementL2 / runs),
      meanFinalDisplacementL2NudgeUnits: roundMetric(
        sums.finalDisplacementL2 / runs / TEXTURE_NUDGE_UNIT,
      ),
      meanPrefinalActivePropertyCount: roundMetric(sums.prefinalActivePropertyCount / runs),
      meanFinalActivePropertyCount: roundMetric(sums.finalActivePropertyCount / runs),
      meanDisplacementEfficiency: roundMetric(sums.displacementEfficiency / runs),
    }),
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
  const globalFinalFlows = {};
  const entryScoreMargins = new Map();
  const outcomeScoreMargins = new Map();
  const routePrefinalProjectionAccumulators = new Map();
  const endingProjectionAccumulators = new Map();

  for (const [routeIndex, schedule] of getNarrativeRouteSchedules().entries()) {
    const random = seededRandom(seed + routeIndex * 10_007);
    const endingCounts = {};
    const enmaCounts = {};
    const finalOptionOutcomes = {};
    const finalFlowCounts = {};
    const gateCounts = {};
    const sums = {
      civilWarRisk: 0,
      surrenderLeverage: 0,
      effectiveSuccessionReadiness: 0,
      garrisonStandDownReadiness: 0,
      enmaCooperation: 0,
      effectiveOniSupplyDisruption: 0,
      kurozanePride: 0,
      kurozaneIndispensability: 0,
      kurozaneGuiltPressure: 0,
      cumulativeL1: 0,
      cumulativeL2: 0,
      prefinalDisplacementL2: 0,
      finalDisplacementL2: 0,
      prefinalActivePropertyCount: 0,
      finalActivePropertyCount: 0,
      displacementEfficiency: 0,
    };
    const routePrefinalAccumulator = createProjectionAccumulator();
    routePrefinalProjectionAccumulators.set(schedule.priorityTheater, routePrefinalAccumulator);

    for (let run = 0; run < runsPerRoute; run += 1) {
      let state = createStoryworldState({
        runId: `balance-${schedule.priorityTheater}-${seed}-${run}`,
      });
      let cumulativeL1 = 0;
      let cumulativeL2 = 0;
      let prefinalProjection = null;
      for (const clusterId of schedule.storyworldDecisionIds) {
        const cluster = clusterById.get(clusterId);
        const option = clusterId === 'sw3-sayos-warehouse-conditions'
          ? cluster.entry.options[ROUTE_OPTION_INDEX[schedule.priorityTheater]]
          : selectOption(cluster.entry.options, random);

        if (clusterId === FINAL_CLUSTER_ID) {
          const projection = deriveStoryworldProjection(state);
          prefinalProjection = projection;
          accumulateProjection(routePrefinalAccumulator, projection);
          const profile = deriveActRouteProfile(projection);
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
          sums.kurozanePride += projection.kurozane_pride;
          sums.kurozaneIndispensability += projection.kurozane_indispensability;
          sums.kurozaneGuiltPressure += projection.kurozane_guilt_pressure;
        }

        const projectionBeforeCluster = deriveStoryworldProjection(state);
        const resolution = resolveCluster(state, cluster, option);
        state = resolution.state;
        const entryMarginRecord = entryScoreMargins.get(cluster.id) ?? { count: 0, total: 0, close: 0 };
        accumulateMargin(entryMarginRecord, resolution.entryScoreMargin);
        entryScoreMargins.set(cluster.id, entryMarginRecord);
        if (resolution.outcomeScoreMargin != null) {
          const outcomeMarginRecord = outcomeScoreMargins.get(cluster.id) ?? { count: 0, total: 0, close: 0 };
          accumulateMargin(outcomeMarginRecord, resolution.outcomeScoreMargin);
          outcomeScoreMargins.set(cluster.id, outcomeMarginRecord);
        }
        const projectionAfterCluster = deriveStoryworldProjection(state);
        const clusterDistance = projectionDistance(projectionBeforeCluster, projectionAfterCluster);
        cumulativeL1 += clusterDistance.l1;
        cumulativeL2 += clusterDistance.l2;
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
          increment(finalFlowCounts, resolution.entryReactionId);
          increment(globalFinalFlows, resolution.entryReactionId);
          const optionCounts = finalOptionOutcomes[option.id] ?? {};
          increment(optionCounts, resolution.outcomeKey);
          finalOptionOutcomes[option.id] = optionCounts;
          const endingAccumulator = endingProjectionAccumulators.get(resolution.outcomeKey)
            ?? createProjectionAccumulator();
          accumulateProjection(endingAccumulator, projectionAfterCluster);
          endingProjectionAccumulators.set(resolution.outcomeKey, endingAccumulator);
        }
      }
      const finalProjection = deriveStoryworldProjection(state);
      const prefinalDistance = projectionDistance(PROPERTY_DEFAULTS, prefinalProjection);
      const finalDistance = projectionDistance(PROPERTY_DEFAULTS, finalProjection);
      sums.cumulativeL1 += cumulativeL1;
      sums.cumulativeL2 += cumulativeL2;
      sums.prefinalDisplacementL2 += prefinalDistance.l2;
      sums.finalDisplacementL2 += finalDistance.l2;
      sums.prefinalActivePropertyCount += prefinalDistance.activePropertyCount;
      sums.finalActivePropertyCount += finalDistance.activePropertyCount;
      sums.displacementEfficiency += cumulativeL2 ? finalDistance.l2 / cumulativeL2 : 0;
    }
    routes.push(summarizeRoute(
      schedule.priorityTheater,
      runsPerRoute,
      endingCounts,
      enmaCounts,
      finalOptionOutcomes,
      finalFlowCounts,
      gateCounts,
      sums,
    ));
  }

  const totalRuns = runsPerRoute * routes.length;
  const routeCentroids = [...routePrefinalProjectionAccumulators.entries()].map(([id, accumulator]) => ({
    id,
    projection: projectionCentroid(accumulator),
  }));
  const endingCentroids = [...endingProjectionAccumulators.entries()].map(([id, accumulator]) => ({
    id,
    projection: projectionCentroid(accumulator),
  }));
  return Object.freeze({
    seed,
    runsPerRoute,
    totalRuns,
    globalEndings: Object.freeze(Object.fromEntries(Object.entries(globalEndings)
      .map(([key, count]) => [key, Number((count / totalRuns).toFixed(4))]))),
    globalFinalFlows: Object.freeze(Object.fromEntries(Object.entries(globalFinalFlows)
      .map(([key, count]) => [key, Number((count / totalRuns).toFixed(4))]))),
    clusterOutcomeCounts: Object.freeze(globalClusterOutcomes),
    routes: Object.freeze(routes),
    historySensitiveEntryOptionCount: [...globalEntryReactions.values()]
      .filter((reactions) => reactions.size > 1).length,
    propertyThreadCoverage: Object.freeze(staticThreadCoverage()),
    effectGeometry: staticEffectGeometry(),
    inclinationDynamics: Object.freeze({
      entry: summarizeMargins(entryScoreMargins),
      outcome: summarizeMargins(outcomeScoreMargins),
    }),
    routePrefinalCentroidDistances: pairwiseCentroidDistances(routeCentroids),
    endingFinalCentroidDistances: pairwiseCentroidDistances(endingCentroids),
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
