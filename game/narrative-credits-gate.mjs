/** Cross-authority gate for the ordinary 80-scene narrative credits route. */

import {
  RUN_RECEIPT_PROFILE_IDS,
  getRunProofReport,
  validateRunReceiptPayload,
} from './run-receipt.mjs';
import {
  getCompletedStoryworldClusterIds,
  isStoryworldNarrativeComplete,
  validateStoryworldPayload,
} from './storyworld-runtime.mjs';

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

export function deriveNarrativeCreditsGate(receiptCandidate, storyworldCandidate) {
  const receiptValidation = validateRunReceiptPayload(receiptCandidate);
  const storyworldValidation = validateStoryworldPayload(storyworldCandidate);
  const receipt = receiptValidation.ok ? receiptValidation.state : null;
  const storyworld = storyworldValidation.ok ? storyworldValidation.state : null;
  const report = receipt ? getRunProofReport(receipt) : null;
  const completedClusterIds = storyworld ? getCompletedStoryworldClusterIds(storyworld) : [];
  const runBound = Boolean(receipt && storyworld && receipt.runId === storyworld.runId);
  const receiptMirrorsStoryworld = Boolean(report && storyworld
    && JSON.stringify(report.completedStoryworldDecisionIds) === JSON.stringify(completedClusterIds));
  const narrativeProfile = report?.profileId === RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H;
  const storyworldComplete = Boolean(storyworld && isStoryworldNarrativeComplete(storyworld));
  const proofEligible = storyworld?.proofEligible === true && storyworld?.coverageStartBeatIndex === 0;
  const minimumPlaytimeMet = Boolean(report && report.totalMs >= report.targetMs);
  const reasons = [];
  if (!receiptValidation.ok) reasons.push('run-receipt-invalid');
  if (!storyworldValidation.ok) reasons.push('storyworld-invalid');
  if (receipt && !narrativeProfile) reasons.push('narrative-profile-required');
  if (receipt && storyworld && !runBound) reasons.push('run-binding-mismatch');
  if (storyworld && !proofEligible) reasons.push('storyworld-proof-ineligible');
  if (storyworld && !storyworldComplete) reasons.push('storyworld-incomplete');
  if (report && !report.canonicalStoryComplete) reasons.push('canonical-story-incomplete');
  if (report && !report.storyworldDecisionsComplete) reasons.push('receipt-storyworld-incomplete');
  if (report && storyworld && !receiptMirrorsStoryworld) reasons.push('storyworld-receipt-mismatch');
  if (report && !minimumPlaytimeMet) reasons.push('active-playtime-incomplete');
  return deepFreeze({
    ready: reasons.length === 0,
    reasons,
    narrativeProfile,
    runBound,
    proofEligible,
    storyworldComplete,
    receiptMirrorsStoryworld,
    minimumPlaytimeMet,
    completedCanonicalSceneCount: report?.completedBeatCount ?? 0,
    requiredCanonicalSceneCount: report?.requiredBeatCount ?? 60,
    completedStoryworldSceneCount: report?.completedStoryworldPlayedSceneCount ?? 0,
    requiredStoryworldSceneCount: report?.requiredStoryworldPlayedSceneCount ?? 20,
    completedStoryworldClusterIds: completedClusterIds,
    totalMs: report?.totalMs ?? 0,
    targetMs: report?.targetMs ?? 18_000_000,
  });
}
