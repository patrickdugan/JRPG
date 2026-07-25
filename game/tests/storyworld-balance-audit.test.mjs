import assert from 'node:assert/strict';
import test from 'node:test';

import { runStoryworldBalanceAudit } from '../storyworld-balance-audit.mjs';

test('seeded whole-route rehearsal keeps both endings live and late gates earned', () => {
  const audit = runStoryworldBalanceAudit({ runsPerRoute: 250, seed: 42 });
  assert.equal(audit.totalRuns, 750);
  assert.ok(audit.globalEndings.accord > 0.25 && audit.globalEndings.accord < 0.75);
  assert.ok(audit.globalEndings.revision > 0.25 && audit.globalEndings.revision < 0.75);

  for (const route of audit.routes) {
    assert.ok(route.endings.accord > 0.15, `${route.route} accord collapsed`);
    assert.ok(route.endings.revision > 0.15, `${route.route} revision collapsed`);
  }

  const paper = audit.routes.find(({ route }) => route === 'paper');
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
  assert.ok(audit.historySensitiveEntryOptionCount >= 10);
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
});
