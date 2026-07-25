import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveActRouteProfile, formatActRouteSummary } from '../act-route-projection.mjs';

test('an unresolved war table stays visibly undecided', () => {
  const profile = deriveActRouteProfile({});
  assert.equal(profile.routeDecisionMade, false);
  assert.equal(formatActRouteSummary({}), 'Act III route priority undecided');
});

test('Salt, Ash, and Paper priorities select their distinct palace approach maps', () => {
  const cases = [
    ['salt', 'act3_salt_priority', 'c8-sodegaura-return'],
    ['ash', 'act3_ash_priority', 'c8-takamine-return'],
    ['paper', 'act3_paper_priority', 'c8-hoshigawa-return'],
  ];
  for (const [theater, propertyId, mapId] of cases) {
    const profile = deriveActRouteProfile({ [propertyId]: 0.10 });
    assert.equal(profile.routeDecisionMade, true);
    assert.equal(profile.priorityTheater, theater);
    assert.equal(profile.act4ApproachMapId, mapId);
    assert.match(formatActRouteSummary({ [propertyId]: 0.10 }), new RegExp(profile.priorityLabel));
  }
});

test('operation consequences expose explicit Act V surrender and civil-war parameters', () => {
  const prepared = deriveActRouteProfile({
    act3_paper_priority: 0.10,
    paper_commitment: 0.40,
    succession_readiness: 0.45,
    garrison_defection: 0.35,
    bell_intelligence: 0.30,
    network_consent: 0.70,
    proof_integrity: 0.70,
    oni_supply_disruption: 0.30,
    evacuation_capacity: 0.40,
  });
  assert.equal(prepared.act5Parameters.cleanSuccessionPrepared, true);
  assert.equal(prepared.act5Parameters.executionAvoidsImmediateCivilWar, true);
  assert.equal(prepared.act5Parameters.witnessedSeppukuAtDawnAvailable, true);
  assert.equal(prepared.act5Parameters.negotiatedSealReturnAvailable, true);
  assert.equal(prepared.act5Parameters.massOniReinforcement, false);

  const unprepared = deriveActRouteProfile({ act3_ash_priority: 0.10 });
  assert.equal(unprepared.act5Parameters.executionAvoidsImmediateCivilWar, false);
  assert.equal(unprepared.act5Parameters.massOniReinforcement, true);
  assert.ok(unprepared.act5Parameters.civilWarRisk > prepared.act5Parameters.civilWarRisk);
});
