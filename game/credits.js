import {
  completeRunCredits,
  createRunReceiptStorageAdapter,
  getRunProofReport,
  recordRunPlaytime,
} from './run-receipt.mjs';
import { formatPlaytime, isPlaytimeInactive } from './playtime.mjs';
import { createCampaignState, createLocalStorageAdapter } from './progression.mjs';
import { createAdvancementState, createAdvancementStorageAdapter } from './advancement.mjs';
import { createQuestState, createQuestStorageAdapter } from './quest-runtime.mjs';
import {
  createWitnessChronicleState,
  createWitnessChronicleStorageAdapter,
} from './witness-chronicle-runtime.mjs';
import {
  createCampConversationState,
  createCampConversationStorageAdapter,
} from './camp-conversation-runtime.mjs';
import {
  createPartyCouncilState,
  createPartyCouncilStorageAdapter,
} from './party-council-runtime.mjs';
import {
  createArchiveRecordState,
  createArchiveRecordStorageAdapter,
} from './archive-record-runtime.mjs';
import { deriveRequiredRouteProgress } from './required-route-progress.mjs';
import {
  createPlaytestEvidenceReport,
  serializePlaytestEvidenceReport,
} from './playtest-evidence.mjs';

const creditsStatus = document.querySelector('#creditsStatus');
const creditsProof = document.querySelector('#creditsProof');
const routeProof = document.querySelector('#routeProof');
const creditsActionHint = document.querySelector('#creditsActionHint');
const sealCredits = document.querySelector('#sealCredits');
const exportEvidence = document.querySelector('#exportEvidence');
const evidenceExportHint = document.querySelector('#evidenceExportHint');
const receiptAdapter = createRunReceiptStorageAdapter();
const campaignAdapter = createLocalStorageAdapter();
const loadedCampaign = campaignAdapter.load();
let campaignState = loadedCampaign.state ?? createCampaignState();
const loadedReceipt = receiptAdapter.load();
let receiptState = loadedReceipt.ok && loadedReceipt.found ? loadedReceipt.state : null;
let pendingMs = 0;
let lastSample = performance.now();
let lastActivity = lastSample;

function loadRequiredRouteProgress() {
  const advancement = createAdvancementStorageAdapter().load();
  const quests = createQuestStorageAdapter().load();
  const witnesses = createWitnessChronicleStorageAdapter().load();
  const conversations = createCampConversationStorageAdapter().load();
  const councils = createPartyCouncilStorageAdapter().load();
  const archives = createArchiveRecordStorageAdapter().load();
  return deriveRequiredRouteProgress({
    campaignState,
    advancementState: advancement.state ?? createAdvancementState(),
    questState: quests.state ?? createQuestState(),
    witnessChronicleState: witnesses.state ?? createWitnessChronicleState(),
    campConversationState: conversations.state ?? createCampConversationState(receiptState?.runId),
    partyCouncilState: councils.state ?? createPartyCouncilState(receiptState?.runId),
    archiveRecordState: archives.state ?? createArchiveRecordState(receiptState?.runId),
  });
}

let requiredRouteProgress = loadRequiredRouteProgress();

function render() {
  const routeTotals = requiredRouteProgress.metrics.total;
  const routeReady = requiredRouteProgress.creditsGate.creditsReady;
  routeProof.dataset.state = routeReady ? 'complete' : 'incomplete';
  routeProof.textContent = routeReady
    ? `${routeTotals.completedActivityCount}/${routeTotals.requiredActivityCount} intended-route activities complete · credits gate ready`
    : `${routeTotals.completedActivityCount}/${routeTotals.requiredActivityCount} intended-route activities complete · ${routeTotals.remainingActivityCount} remain`;
  if (!receiptState) {
    creditsStatus.dataset.state = 'error';
    creditsStatus.textContent = loadedReceipt.ok
      ? 'No clean-run receipt is attached to this save.'
      : 'The clean-run receipt could not be read.';
    creditsProof.textContent = 'Credits remain viewable, but there is no valid run evidence to seal.';
    creditsActionHint.textContent = 'Return to the campaign and start a clean New Game to create verified evidence.';
    sealCredits.disabled = true;
    exportEvidence.disabled = true;
    evidenceExportHint.textContent = 'A valid clean-run receipt is required before evidence can be exported.';
    return;
  }

  const report = getRunProofReport(receiptState);
  exportEvidence.disabled = false;
  evidenceExportHint.textContent = report.durationProven && routeReady
    ? 'The export contains a signed release-target proof with category, chapter, story, combat, and 215-activity evidence.'
    : 'The export records current evidence and names every missing condition; it never upgrades incomplete timing or route data.';
  const elapsed = formatPlaytime(report.totalMs);
  creditsProof.textContent = `${report.completedBeatCount}/${report.requiredBeatCount} story scenes · ${report.firstClearCount}/${report.requiredFirstClearCount} canonical first clears · ${elapsed} active play`;
  if (report.creditsComplete) {
    creditsStatus.dataset.state = 'sealed';
    creditsStatus.textContent = report.durationProven
      ? `Credits complete · receipt sealed · 20-hour run proven at ${elapsed}`
      : `Credits complete · receipt sealed at ${elapsed} · duration target not yet proven`;
    creditsActionHint.textContent = 'This clean-run receipt is immutable. Camp and campaign replay remain available outside the sealed proof.';
    sealCredits.textContent = 'Credits complete · receipt sealed';
    sealCredits.disabled = true;
    return;
  }
  if (!report.storyComplete) {
    creditsStatus.dataset.state = 'error';
    creditsStatus.textContent = 'Credits preview · story evidence is incomplete';
    creditsActionHint.textContent = 'Complete every canonical story scene before sealing the run.';
    sealCredits.disabled = true;
    return;
  }
  if (!routeReady) {
    creditsStatus.dataset.state = 'active';
    creditsStatus.textContent = `Story complete · intended route unfinished · receipt active at ${elapsed}`;
    creditsActionHint.textContent = 'Return to Campaign and Camp to finish every unlocked quest, chronicle, conversation, council, archive record, and required repeat circuit.';
    sealCredits.disabled = true;
    return;
  }
  creditsStatus.dataset.state = 'active';
  creditsStatus.textContent = `Story complete · receipt still active at ${elapsed}`;
  creditsActionHint.textContent = 'The 215-activity intended route is complete. This explicit action freezes the clean-run receipt.';
  sealCredits.disabled = false;
}

function flushPlaytime() {
  if (!receiptState || receiptState.status !== 'active' || pendingMs === 0) {
    pendingMs = 0;
    return true;
  }
  const result = recordRunPlaytime(receiptState, receiptState.runId, 'narrative', pendingMs, {
    chapterId: campaignState.current.chapterId,
  });
  if (!result.ok) return false;
  const saved = receiptAdapter.save(result.state);
  if (!saved.ok) return false;
  receiptState = result.state;
  pendingMs = 0;
  return true;
}

function tick(now) {
  const elapsed = Math.min(1000, Math.max(0, Math.floor(now - lastSample)));
  lastSample = now;
  if (receiptState?.status === 'active' && elapsed > 0 && !isPlaytimeInactive({
    nowMs: now,
    lastActivityMs: lastActivity,
    visible: document.visibilityState === 'visible',
  })) {
    pendingMs += elapsed;
    if (pendingMs >= 1000 && flushPlaytime()) render();
  }
  requestAnimationFrame(tick);
}

sealCredits.addEventListener('click', () => {
  if (!receiptState) return;
  requiredRouteProgress = loadRequiredRouteProgress();
  if (!requiredRouteProgress.creditsGate.creditsReady) {
    render();
    creditsStatus.focus();
    return;
  }
  if (!flushPlaytime()) {
    creditsStatus.dataset.state = 'error';
    creditsStatus.textContent = 'Active credits time could not be saved; the receipt remains open.';
    creditsStatus.focus();
    return;
  }
  const result = completeRunCredits(receiptState, receiptState.runId);
  if (!result.ok) {
    creditsStatus.dataset.state = 'error';
    creditsStatus.textContent = result.errors.join(' ');
    creditsStatus.focus();
    return;
  }
  const saved = receiptAdapter.save(result.state);
  if (!saved.ok) {
    creditsStatus.dataset.state = 'error';
    creditsStatus.textContent = 'The sealed receipt could not be saved; the receipt remains open.';
    creditsStatus.focus();
    return;
  }
  receiptState = result.state;
  pendingMs = 0;
  render();
  creditsStatus.focus();
});

exportEvidence.addEventListener('click', () => {
  if (!receiptState) return;
  if (!flushPlaytime()) {
    evidenceExportHint.textContent = 'Pending active time could not be saved, so no stale evidence file was created.';
    return;
  }
  requiredRouteProgress = loadRequiredRouteProgress();
  try {
    const report = createPlaytestEvidenceReport(receiptState, requiredRouteProgress);
    const blob = new Blob([serializePlaytestEvidenceReport(report)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bells-playtest-evidence-${report.runId}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    render();
    evidenceExportHint.textContent = `Evidence ${report.signature} exported for run ${report.runId}.`;
  } catch (error) {
    evidenceExportHint.textContent = error instanceof Error ? error.message : 'Playtest evidence could not be exported.';
  }
});

window.addEventListener('pointerdown', () => { lastActivity = performance.now(); }, { passive: true });
window.addEventListener('keydown', () => { lastActivity = performance.now(); }, { passive: true });
window.addEventListener('pagehide', flushPlaytime);
document.addEventListener('visibilitychange', () => {
  lastSample = performance.now();
  if (document.visibilityState === 'hidden') flushPlaytime();
});
window.addEventListener('pageshow', () => {
  const refreshedCampaign = campaignAdapter.load();
  if (refreshedCampaign.ok) campaignState = refreshedCampaign.state;
  const refreshedReceipt = receiptAdapter.load();
  receiptState = refreshedReceipt.ok && refreshedReceipt.found ? refreshedReceipt.state : null;
  requiredRouteProgress = loadRequiredRouteProgress();
  pendingMs = 0;
  lastSample = performance.now();
  lastActivity = lastSample;
  render();
});

render();
requestAnimationFrame(tick);
