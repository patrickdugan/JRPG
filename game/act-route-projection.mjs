/** Translate Storyworld properties into map selection and final-act parameters. */

import { ACT_ROUTE_THEATERS, resolveAct4ApproachMap } from './content/act-route-sequences.mjs';

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function score(projection, propertyId) {
  return clamp(projection?.[propertyId]);
}

function gainAbove(projection, propertyId, baseline) {
  return Math.max(0, score(projection, propertyId) - baseline);
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
  const enmaCustody = score(projection, 'enma_custody');
  const enmaCompact = score(projection, 'enma_compact');
  const enmaTestimony = score(projection, 'enma_testimony');
  const enmaAliveUnderTerms = clamp(Math.max(enmaCustody, enmaCompact) * 10);
  const enmaCooperation = clamp(enmaAliveUnderTerms * enmaTestimony);
  const effectiveSuccessionReadiness = clamp(
    successionReadiness
      + gainAbove(projection, 'paper_commitment', 0.20) * 0.50
      + gainAbove(projection, 'public_reach', 0.35) * 0.15,
  );
  const garrisonStandDownReadiness = clamp(
    garrisonDefection
      + gainAbove(projection, 'genta_accountability', 0.30) * 0.50
      + gainAbove(projection, 'network_consent', 0.45) * 0.25
      + enmaCooperation * 0.20,
  );
  const effectiveOniSupplyDisruption = clamp(
    oniSupplyDisruption + enmaCooperation * 0.25,
  );
  const civilWarRisk = clamp(
    0.82
      - effectiveSuccessionReadiness * 0.30
      - garrisonStandDownReadiness * 0.25
      - networkConsent * 0.12
      - proofIntegrity * 0.10
      - enmaCooperation * 0.10,
  );
  const surrenderLeverage = clamp(
    effectiveSuccessionReadiness * 0.22
      + garrisonStandDownReadiness * 0.18
      + bellIntelligence * 0.14
      + networkConsent * 0.18
      + proofIntegrity * 0.14
      + enmaCooperation * 0.14,
  );
  const cleanSuccessionPrepared = effectiveSuccessionReadiness >= 0.25
    && proofIntegrity >= 0.60;
  const outerGarrisonCanStandDown = garrisonStandDownReadiness >= 0.30;
  const ashExecutionContinuity = commitments.ash >= 0.30
    && effectiveOniSupplyDisruption >= 0.25
    && garrisonStandDownReadiness >= 0.32
    && proofIntegrity >= 0.55;

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
      effectiveSuccessionReadiness,
      bellIntelligence,
      garrisonDefection,
      garrisonStandDownReadiness,
      enmaCooperation,
      effectiveOniSupplyDisruption,
      civilWarRisk,
      surrenderLeverage,
      cleanSuccessionPrepared,
      ashExecutionContinuity,
      massOniReinforcement: effectiveOniSupplyDisruption < 0.20,
      outerGarrisonCanStandDown,
      executionAvoidsImmediateCivilWar: outerGarrisonCanStandDown
        && (
          (cleanSuccessionPrepared && bellIntelligence >= 0.15)
          || ashExecutionContinuity
        ),
      witnessedSeppukuAtDawnAvailable: effectiveSuccessionReadiness >= 0.25
        && bellIntelligence >= 0.15
        && proofIntegrity >= 0.55,
      negotiatedSealReturnAvailable: surrenderLeverage >= 0.30,
    }),
  });
}

export function formatActRouteSummary(projection = {}) {
  const profile = deriveActRouteProfile(projection);
  if (!profile.routeDecisionMade) return 'Act III route priority undecided';
  const { act5Parameters } = profile;
  return `${profile.priorityLabel} first · palace approach ${profile.act4ApproachMapId} · `
    + `succession ${Math.round(act5Parameters.effectiveSuccessionReadiness * 100)} · `
    + `Oni disruption ${Math.round(act5Parameters.effectiveOniSupplyDisruption * 100)} · `
    + `Enma intel ${Math.round(act5Parameters.enmaCooperation * 100)} · `
    + `civil-war risk ${Math.round(act5Parameters.civilWarRisk * 100)}`;
}
