import assert from 'node:assert/strict';
import test from 'node:test';

import { runStoryworldBalanceAudit } from '../storyworld-balance-audit.mjs';

test('seeded whole-route rehearsal keeps four endings live and late gates earned', () => {
  const audit = runStoryworldBalanceAudit({ runsPerRoute: 250, seed: 42 });
  assert.equal(audit.totalRuns, 750);
  for (const ending of ['accord', 'revision', 'dawn', 'prepared-execution']) {
    assert.ok(audit.globalEndings[ending] > 0.02, `${ending} is effectively unreachable`);
    assert.ok(audit.globalEndings[ending] < 0.40, `${ending} dominates the whole campaign`);
  }

  const paper = audit.routes.find(({ route }) => route === 'paper');
  const salt = audit.routes.find(({ route }) => route === 'salt');
  const ash = audit.routes.find(({ route }) => route === 'ash');
  assert.ok(paper.endings.dawn > 0.10);
  assert.ok(paper.endings['prepared-execution'] > 0.10);
  assert.ok(salt.endings.revision > 0.30);
  assert.ok(ash.endings.revision > 0.15);
  assert.ok(ash.endings['prepared-execution'] > salt.endings['prepared-execution']);
  const confessionFlowId = 'page_sw11_decision_opt_name-the-crime_r_confession-reversal';
  const fearSurrenderFlowId = 'page_sw11_decision_opt_execution-demand_r_accord';
  assert.equal(Object.keys(audit.globalFinalFlows).length, 13);
  assert.ok(audit.globalFinalFlows[fearSurrenderFlowId] > 0.001);
  assert.ok(audit.globalFinalFlows[fearSurrenderFlowId] < 0.03);
  assert.ok(audit.globalFinalFlows[confessionFlowId] > 0.005);
  assert.ok(audit.globalFinalFlows[confessionFlowId] < 0.05);
  assert.ok(paper.finalFlows[confessionFlowId] > 0.02);
  assert.ok(paper.finalFlows[confessionFlowId] < 0.10);
  for (const route of audit.routes) {
    assert.ok(route.meanKurozanePride > 0.70 && route.meanKurozanePride < 0.90);
    assert.ok(route.meanKurozaneIndispensability > 0.40);
    assert.ok(route.meanKurozaneIndispensability < 0.70);
    assert.ok(route.meanKurozaneGuiltPressure > 0.15);
    assert.ok(route.meanKurozaneGuiltPressure < 0.40);
  }
  for (const gate of [
    'cleanSuccessionPrepared',
    'executionAvoidsImmediateCivilWar',
    'witnessedSeppukuAtDawnAvailable',
  ]) {
    assert.ok(paper.act5GateAvailability[gate] > 0.15, `${gate} is effectively unreachable`);
    assert.ok(paper.act5GateAvailability[gate] < 0.75, `${gate} is automatic`);
  }

  const enmaOutcomes = audit.clusterOutcomeCounts['sw-enma-three-terms'];
  assert.ok(enmaOutcomes.accord > 0);
  assert.ok(enmaOutcomes.revision > 0);
  assert.ok(enmaOutcomes.negotiated > 0);
  assert.ok(audit.historySensitiveEntryOptionCount >= 25);
});

test('static thread coverage reaches the tribunal, Enma hearing, and last command', () => {
  const { propertyThreadCoverage: coverage } = runStoryworldBalanceAudit({
    runsPerRoute: 1,
    seed: 7,
  });
  assert.ok(coverage.care_capacity.gateClusters.includes('sw6-tribunal-afterword'));
  assert.ok(coverage.enma_killed.gateClusters.includes('sw10-corrections-desk'));
  assert.ok(coverage.enma_testimony.gateClusters.includes('sw10-corrections-desk'));
  assert.ok(coverage.bell_intelligence.gateClusters.includes('sw10-corrections-desk'));
  assert.ok(coverage.garrison_defection.gateClusters.includes('sw10-corrections-desk'));
  assert.ok(coverage.kurozane_pride.gateClusters.includes('sw10-corrections-desk'));
  assert.ok(coverage.kurozane_pride.effectClusters.includes('sw-enma-three-terms'));
  assert.ok(coverage.kurozane_pride.effectClusters.includes('sw10-corrections-desk'));
  assert.ok(coverage.kurozane_indispensability.effectClusters.includes('sw7-soldier-will-not-follow'));
  assert.ok(coverage.kurozane_indispensability.effectClusters.includes('sw8-boats-with-conditions'));
  assert.ok(coverage.kurozane_guilt_pressure.effectClusters.includes('sw2-witness-not-family'));
  assert.ok(coverage.kurozane_guilt_pressure.effectClusters.includes('sw9-mateus-living-archive'));
  assert.ok(coverage.evacuation_capacity.effectClusters.includes('sw4-margin-varga-journal'));
  assert.ok(coverage.evacuation_capacity.effectClusters.includes('sw7-soldier-will-not-follow'));
  assert.ok(coverage.evacuation_capacity.effectClusters.includes('sw8-boats-with-conditions'));
  assert.ok(coverage.bell_intelligence.effectClusters.includes('sw5-cipher-handoff'));
  assert.ok(coverage.bell_intelligence.effectClusters.includes('sw6-tribunal-afterword'));
  assert.ok(coverage.bell_intelligence.effectClusters.includes('sw-enma-three-terms'));
  assert.ok(coverage.garrison_defection.effectClusters.includes('sw5-cipher-handoff'));
  assert.ok(coverage.garrison_defection.effectClusters.includes('sw7-soldier-will-not-follow'));
  assert.ok(coverage.garrison_defection.effectClusters.includes('sw-enma-three-terms'));
  assert.ok(coverage.kiku_capacity.effectClusters.includes('sw6-tribunal-afterword'));
  assert.ok(coverage.kiku_capacity.effectClusters.includes('sw8-boats-with-conditions'));
});

test('path geometry keeps routes equally deep while choices and endings remain metrically distinct', () => {
  const audit = runStoryworldBalanceAudit({ runsPerRoute: 250, seed: 42 });
  const routePathLengths = audit.routes.map(({ metricDistance }) => (
    metricDistance.meanCumulativeL2NudgeUnits
  ));
  assert.ok(Math.max(...routePathLengths) - Math.min(...routePathLengths) < 4);
  for (const route of audit.routes) {
    assert.ok(route.metricDistance.meanCumulativeL2NudgeUnits > 40);
    assert.ok(route.metricDistance.meanCumulativeL2NudgeUnits < 52);
    assert.ok(route.metricDistance.meanPrefinalDisplacementL2NudgeUnits > 20);
    assert.ok(route.metricDistance.meanPrefinalDisplacementL2NudgeUnits < 30);
    assert.ok(route.metricDistance.meanPrefinalActivePropertyCount >= 24);
    assert.ok(route.metricDistance.meanDisplacementEfficiency > 0.45);
    assert.ok(route.metricDistance.meanDisplacementEfficiency < 0.65);
  }

  const { effectGeometry } = audit;
  assert.ok(effectGeometry.meanReactionBranchDistanceInNudgeUnits > 3.5);
  assert.ok(effectGeometry.meanOptionCentroidDistanceInNudgeUnits > 2.2);
  assert.ok(effectGeometry.meanEntryFormulaTermCount >= 4.3);
  assert.equal(effectGeometry.meanOutcomeFormulaTermCount, 4);
  const sodegaura = effectGeometry.clusters
    .find(({ clusterId }) => clusterId === 'sw-sodegaura-lantern-manifests');
  assert.equal(sodegaura.entryOptionCount, 4);
  assert.equal(sodegaura.meanEntryReactionCount, 3);
  for (const cluster of effectGeometry.clusters) {
    assert.ok(cluster.optionCentroidDistance >= 0.085, cluster.clusterId);
  }
  for (const distance of Object.values(audit.routePrefinalCentroidDistances)) {
    assert.ok(distance.textureNudgeUnits > 6);
  }
  for (const distance of Object.values(audit.endingFinalCentroidDistances)) {
    assert.ok(distance.textureNudgeUnits > 1.5);
  }
});
