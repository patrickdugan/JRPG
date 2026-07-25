/** Translate Storyworld properties into map selection and final-act parameters. */

import { ACT_ROUTE_THEATERS, resolveAct4ApproachMap } from './content/act-route-sequences.mjs';

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function score(projection, propertyId) {
  return clamp(projection?.[propertyId]);
}

const PRIORITY_PROPERTIES = Object.freeze({
  salt: 'act3_salt_priority',
  ash: 'act3_ash_priority',
  paper: 'act3_paper_priority',
});

export function deriveActRouteProfile(projection = {}) {
  const priorityScores = Object.fromEntries(Object.entries(PRIORITY_PROPERTIES).map(([theater, propertyId]) => [
    theater,
    score(projection, propertyId),
  ]));
  const priorityTheater = Object.keys(ACT_ROUTE_THEATERS)
    .sort((left, right) => priorityScores[right] - priorityScores[left])[0];
  const routeDecisionMade = Object.values(priorityScores).some((value) => value > 0);
  const commitments = {
    salt: score(projection, 'salt_commitment'),
    ash: score(projection, 'ash_commitment'),
    paper: score(projection, 'paper_commitment'),
  };
  const evacuationCapacity = score(projection, 'evacuation_capacity');
  const oniSupplyDisruption = score(projection, 'oni_supply_disruption');
  const successionReadiness = score(projection, 'succession_readiness');
  const bellIntelligence = score(projection, 'bell_intelligence');
  const garrisonDefection = score(projection, 'garrison_defection');
  const networkConsent = score(projection, 'network_consent');
  const proofIntegrity = score(projection, 'proof_integrity');
  const civilWarRisk = clamp(
    0.82
      - successionReadiness * 0.36
      - garrisonDefection * 0.24
      - networkConsent * 0.12
      - proofIntegrity * 0.10,
  );
  const surrenderLeverage = clamp(
    successionReadiness * 0.28
      + garrisonDefection * 0.20
      + bellIntelligence * 0.16
      + networkConsent * 0.20
      + proofIntegrity * 0.16,
  );

  return Object.freeze({
    priorityTheater,
    priorityLabel: ACT_ROUTE_THEATERS[priorityTheater].label,
    routeDecisionMade,
    priorityScores: Object.freeze(priorityScores),
    commitments: Object.freeze(commitments),
    act4ApproachMapId: resolveAct4ApproachMap(priorityTheater),
    availableApproachMapIds: Object.freeze(Object.values(ACT_ROUTE_THEATERS)
      .filter(({ id }) => commitments[id] >= 0.25 || id === priorityTheater)
      .map(({ approachMapId }) => approachMapId)),
    act5Parameters: Object.freeze({
      evacuationCapacity,
      oniSupplyDisruption,
      successionReadiness,
      bellIntelligence,
      garrisonDefection,
      civilWarRisk,
      surrenderLeverage,
      cleanSuccessionPrepared: successionReadiness >= 0.25 && proofIntegrity >= 0.45,
      massOniReinforcement: oniSupplyDisruption < 0.20,
      outerGarrisonCanStandDown: garrisonDefection >= 0.20,
      executionAvoidsImmediateCivilWar: successionReadiness >= 0.40 && garrisonDefection >= 0.30,
      witnessedSeppukuAtDawnAvailable: successionReadiness >= 0.25 && bellIntelligence >= 0.15,
      negotiatedSealReturnAvailable: surrenderLeverage >= 0.30,
    }),
  });
}

export function formatActRouteSummary(projection = {}) {
  const profile = deriveActRouteProfile(projection);
  if (!profile.routeDecisionMade) return 'Act III route priority undecided';
  const { act5Parameters } = profile;
  return `${profile.priorityLabel} first · palace approach ${profile.act4ApproachMapId} · `
    + `succession ${Math.round(act5Parameters.successionReadiness * 100)} · `
    + `Oni disruption ${Math.round(act5Parameters.oniSupplyDisruption * 100)} · `
    + `civil-war risk ${Math.round(act5Parameters.civilWarRisk * 100)}`;
}
