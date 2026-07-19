/** Versioned, deterministic export for a clean-run timing playtest. */

import { CAMPAIGN } from './content/campaign.mjs';
import { getRunProofReport, validateRunReceiptPayload } from './run-receipt.mjs';
import {
  REQUIRED_ROUTE_ACTIVITY_TYPES,
  REQUIRED_ROUTE_METRICS,
} from './required-route-contract.mjs';
import { REQUIRED_ROUTE_PROGRESS_VERSION } from './required-route-progress.mjs';

export const PLAYTEST_EVIDENCE_SCHEMA_VERSION = 1;

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

function fnv1a32(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function signatureFor(value) {
  return `fnv1a32:${fnv1a32(JSON.stringify(value))}`;
}

function validateRouteProgress(progress) {
  const errors = [];
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) {
    return ['required-route progress must be an object.'];
  }
  if (progress.version !== REQUIRED_ROUTE_PROGRESS_VERSION) errors.push('required-route progress version is invalid.');
  const validityKeys = ['campaign', 'quests', 'witnessChronicles', 'campConversations', 'partyCouncils', 'archiveRecords', 'advancement'];
  if (!progress.sourceValidity || validityKeys.some((key) => typeof progress.sourceValidity[key] !== 'boolean')) {
    errors.push('required-route source validity is incomplete.');
  }
  const runBoundKeys = ['campConversations', 'partyCouncils', 'archiveRecords'];
  if (!progress.runBinding || runBoundKeys.some((key) => (
    progress.runBinding[key] !== null && typeof progress.runBinding[key] !== 'string'
  ))) errors.push('required-route run binding is incomplete.');
  const total = progress.metrics?.total;
  for (const key of ['requiredActivityCount', 'enteredActivityCount', 'completedActivityCount', 'remainingActivityCount']) {
    if (!Number.isSafeInteger(total?.[key]) || total[key] < 0) errors.push(`required-route ${key} is invalid.`);
  }
  if (total?.requiredActivityCount !== REQUIRED_ROUTE_METRICS.requiredActivityCount) {
    errors.push('required-route activity count differs from the canonical contract.');
  }
  if (Number.isSafeInteger(total?.completedActivityCount) && Number.isSafeInteger(total?.remainingActivityCount)
    && total.completedActivityCount + total.remainingActivityCount !== total.requiredActivityCount) {
    errors.push('required-route completed and remaining counts do not reconcile.');
  }
  if (!Array.isArray(progress.completedActivityIds) || !Array.isArray(progress.remainingActivityIds)
    || progress.completedActivityIds.length !== total?.completedActivityCount
    || progress.remainingActivityIds.length !== total?.remainingActivityCount) {
    errors.push('required-route activity ID evidence does not reconcile.');
  }
  if (!progress.metrics?.byType || REQUIRED_ROUTE_ACTIVITY_TYPES.some((type) => {
    const metric = progress.metrics.byType[type];
    return !Number.isSafeInteger(metric?.requiredActivityCount)
      || !Number.isSafeInteger(metric?.completedActivityCount);
  })) errors.push('required-route type metrics are incomplete.');
  if (typeof progress.creditsGate?.creditsReady !== 'boolean') errors.push('required-route credits gate is invalid.');
  return errors;
}

/** Build a self-contained JSON-safe report without inventing time or completion. */
export function createPlaytestEvidenceReport(receipt, requiredRouteProgress) {
  const receiptValidation = validateRunReceiptPayload(receipt);
  if (!receiptValidation.ok) throw new TypeError(`Invalid run receipt: ${receiptValidation.errors.join(' ')}`);
  const routeErrors = validateRouteProgress(requiredRouteProgress);
  if (routeErrors.length) throw new TypeError(`Invalid required-route progress: ${routeErrors.join(' ')}`);

  const proof = getRunProofReport(receiptValidation.state);
  const total = requiredRouteProgress.metrics.total;
  const allSourcesValid = Object.values(requiredRouteProgress.sourceValidity).every(Boolean);
  const runBoundSourcesMatchReceipt = Object.values(requiredRouteProgress.runBinding)
    .every((runId) => runId === proof.runId);
  const routeComplete = allSourcesValid
    && runBoundSourcesMatchReceipt
    && requiredRouteProgress.creditsGate.creditsReady
    && total.completedActivityCount === total.requiredActivityCount
    && requiredRouteProgress.remainingActivityIds.length === 0;
  const body = {
    schemaVersion: PLAYTEST_EVIDENCE_SCHEMA_VERSION,
    campaignId: CAMPAIGN.id,
    runId: proof.runId,
    receiptRevision: receiptValidation.state.revision,
    status: proof.status,
    cleanStart: proof.cleanStart,
    story: {
      complete: proof.storyComplete,
      creditsComplete: proof.creditsComplete,
      completedBeatCount: proof.completedBeatCount,
      requiredBeatCount: proof.requiredBeatCount,
      completedBeatIds: proof.completedBeatIds,
      missingBeatIds: proof.missingBeatIds,
    },
    combat: {
      firstClearCount: proof.firstClearCount,
      requiredFirstClearCount: proof.requiredFirstClearCount,
      complete: proof.firstClearsComplete,
      firstClearEncounterIds: proof.firstClearEncounterIds,
      missingFirstClearEncounterIds: proof.missingFirstClearEncounterIds,
    },
    requiredRoute: {
      progressVersion: requiredRouteProgress.version,
      allSourcesValid,
      runBoundSourcesMatchReceipt,
      sourceValidity: requiredRouteProgress.sourceValidity,
      runBinding: requiredRouteProgress.runBinding,
      complete: routeComplete,
      creditsGateReady: requiredRouteProgress.creditsGate.creditsReady,
      requiredActivityCount: total.requiredActivityCount,
      enteredActivityCount: total.enteredActivityCount,
      completedActivityCount: total.completedActivityCount,
      remainingActivityCount: total.remainingActivityCount,
      byType: Object.fromEntries(REQUIRED_ROUTE_ACTIVITY_TYPES.map((type) => [type, {
        requiredActivityCount: requiredRouteProgress.metrics.byType[type].requiredActivityCount,
        completedActivityCount: requiredRouteProgress.metrics.byType[type].completedActivityCount,
      }])),
      completedActivityIds: requiredRouteProgress.completedActivityIds,
      remainingActivityIds: requiredRouteProgress.remainingActivityIds,
    },
    playtime: {
      totalMs: proof.totalMs,
      totalMinutes: proof.totalMinutes,
      targetMs: proof.targetMs,
      percentOfTarget: proof.percentOfTarget,
      remainingMs: proof.remainingMs,
      fixedActualMs: proof.fixedActualMs,
      fixedTargetMs: proof.fixedTargetMs,
      grindMs: proof.grindMs,
      categories: proof.categories,
      chapterMs: proof.chapterMs,
    },
    proof: {
      validRunReceipt: proof.valid,
      runScoped: proof.runScoped,
      routeComplete,
      durationProven: proof.durationProven,
      releaseTargetProven: proof.durationProven && routeComplete,
    },
  };
  return deepFreeze({ ...body, signature: signatureFor(body) });
}

export function serializePlaytestEvidenceReport(report) {
  if (!report || report.schemaVersion !== PLAYTEST_EVIDENCE_SCHEMA_VERSION
    || report.signature !== signatureFor(Object.fromEntries(Object.entries(report).filter(([key]) => key !== 'signature')))) {
    throw new TypeError('Playtest evidence report signature is invalid.');
  }
  return `${JSON.stringify(report, null, 2)}\n`;
}
