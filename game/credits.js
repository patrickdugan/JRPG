import {
  completeRunCredits,
  createRunReceiptStorageAdapter,
  getRunProofReport,
  recordRunPlaytime,
  RUN_RECEIPT_PROFILE_IDS,
} from './run-receipt.mjs';
import { formatPlaytime, isPlaytimeInactive, PLAYTIME_CATEGORIES } from './playtime.mjs';
import { CAMPAIGN } from './content/campaign.mjs';
import { CHAPTER_PACING_CHECKPOINTS } from './chapter-pacing.mjs';
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
import { createStoryworldStorageAdapter } from './storyworld-runtime.mjs';
import { deriveNarrativeCreditsGate } from './narrative-credits-gate.mjs';
import {
  createPlaytestEvidenceReport,
  serializePlaytestEvidenceReport,
} from './playtest-evidence.mjs';
import { mountAudioControls } from './audio-controls.mjs';

const creditsStatus = document.querySelector('#creditsStatus');
const creditsProof = document.querySelector('#creditsProof');
const routeProof = document.querySelector('#routeProof');
const creditsActionHint = document.querySelector('#creditsActionHint');
const sealCredits = document.querySelector('#sealCredits');
const exportEvidence = document.querySelector('#exportEvidence');
const evidenceExportHint = document.querySelector('#evidenceExportHint');
const categoryTimingList = document.querySelector('#categoryTimingList');
const chapterTimingList = document.querySelector('#chapterTimingList');
const timingAttribution = document.querySelector('#timingAttribution');
const pacingBasis = document.querySelector('#pacingBasis');
const pageAudio = mountAudioControls({ desiredLoop: 'exploration' });
const receiptAdapter = createRunReceiptStorageAdapter();
const campaignAdapter = createLocalStorageAdapter();
const loadedCampaign = campaignAdapter.load();
let campaignState = loadedCampaign.state ?? createCampaignState();
const loadedReceipt = receiptAdapter.load();
let receiptState = loadedReceipt.ok && loadedReceipt.found ? loadedReceipt.state : null;
const storyworldAdapter = createStoryworldStorageAdapter();
const loadedStoryworld = storyworldAdapter.load();
let storyworldState = loadedStoryworld.ok && loadedStoryworld.found ? loadedStoryworld.state : null;
let pendingMs = 0;
let lastSample = performance.now();
let lastActivity = lastSample;
let evidenceExportNotice = null;

function publishEvidenceExportHint(readinessText) {
  const nextText = evidenceExportNotice ?? readinessText;
  if (evidenceExportHint.textContent !== nextText) evidenceExportHint.textContent = nextText;
}

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

const CATEGORY_LABELS = Object.freeze({
  narrative: 'Narrative',
  exploration: 'Exploration',
  firstClearCombat: 'First-clear combat',
  grind: 'Repeat grind',
  menusAndRest: 'Camp, menus & rest',
});

function timingRow(label, milliseconds) {
  const row = document.createElement('li');
  const name = document.createElement('span');
  const value = document.createElement('strong');
  name.textContent = label;
  value.textContent = formatPlaytime(milliseconds);
  row.append(name, value);
  return row;
}

function chapterTimingRow(chapter, actualMs, completedBeatIds, profileId = null) {
  const checkpoint = CHAPTER_PACING_CHECKPOINTS.chapters.find(({ chapterId }) => chapterId === chapter.id);
  if (!checkpoint) throw new Error(`No pacing checkpoint exists for ${chapter.id}.`);
  const targetMs = profileId === RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H
    ? Math.round(18_000_000 * checkpoint.share)
    : checkpoint.targetMs;
  const row = document.createElement('li');
  const copy = document.createElement('span');
  const name = document.createElement('span');
  const status = document.createElement('small');
  const value = document.createElement('strong');
  const completed = chapter.beats.every((beat) => completedBeatIds.has(beat.id));
  const started = actualMs > 0 || chapter.beats.some((beat) => completedBeatIds.has(beat.id));
  const percent = targetMs === 0 ? 100 : (actualMs / targetMs) * 100;
  const gapMs = actualMs - targetMs;
  name.textContent = `${chapter.number ?? '—'} · ${chapter.title}`;
  status.textContent = completed
    ? `${percent.toFixed(1)}% · ${gapMs >= 0 ? 'over' : 'short'} by ${formatPlaytime(Math.abs(gapMs))}`
    : started ? `${percent.toFixed(1)}% · in progress` : 'not started';
  value.textContent = `${formatPlaytime(actualMs)} / ${formatPlaytime(targetMs)}`;
  value.setAttribute('aria-label', `${formatPlaytime(actualMs)} actual of ${formatPlaytime(targetMs)} reference checkpoint`);
  copy.append(name, status);
  row.append(copy, value);
  return row;
}

function renderTimingLedger(report = null) {
  const categories = report?.categories ?? Object.fromEntries(PLAYTIME_CATEGORIES.map((category) => [category, 0]));
  const chapterMs = report?.chapterMs ?? Object.fromEntries(CAMPAIGN.chapters.map((chapter) => [chapter.id, 0]));
  categoryTimingList.replaceChildren(...PLAYTIME_CATEGORIES.map((category) => (
    timingRow(CATEGORY_LABELS[category], categories[category] ?? 0)
  )));
  const completedBeatIds = new Set(report?.completedBeatIds ?? []);
  chapterTimingList.replaceChildren(...CAMPAIGN.chapters.map((chapter) => (
    chapterTimingRow(chapter, chapterMs[chapter.id] ?? 0, completedBeatIds, report?.profileId ?? null)
  )));
  pacingBasis.textContent = report?.profileId === RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H
    ? `Narrative target 05:00:00 minimum / 06:00:00 pacing ceiling · observed active play is authoritative.`
    : `Reference checkpoint total ${formatPlaytime(CHAPTER_PACING_CHECKPOINTS.aggregateTargetMs)} · complete 215-activity route at 1× · diagnostic model, not observed proof.`;
  const totalMs = report?.totalMs ?? 0;
  const attributedMs = Object.values(chapterMs).reduce((sum, value) => sum + value, 0);
  const unattributedMs = totalMs - attributedMs;
  timingAttribution.dataset.state = unattributedMs === 0 ? 'complete' : 'incomplete';
  timingAttribution.textContent = report
    ? unattributedMs === 0
      ? `All ${formatPlaytime(totalMs)} is assigned to a canonical chapter.`
      : `${formatPlaytime(unattributedMs)} is not assigned to a chapter; combined release proof remains unavailable.`
    : 'No valid clean-run timing receipt is attached.';
}

function render() {
  const routeTotals = requiredRouteProgress.metrics.total;
  const routeReady = requiredRouteProgress.creditsGate.creditsReady;
  if (!receiptState) {
    routeProof.dataset.state = routeReady ? 'complete' : 'incomplete';
    routeProof.textContent = `Completionist · ${routeTotals.completedActivityCount}/${routeTotals.requiredActivityCount} optional activities`;
    renderTimingLedger();
    creditsStatus.dataset.state = 'error';
    creditsStatus.textContent = loadedReceipt.ok
      ? 'No clean-run receipt is attached to this save.'
      : 'The clean-run receipt could not be read.';
    creditsProof.textContent = 'Credits remain viewable, but there is no valid run evidence to seal.';
    creditsActionHint.textContent = 'Return to the campaign and start a clean New Game to create verified evidence.';
    sealCredits.disabled = true;
    exportEvidence.disabled = true;
    publishEvidenceExportHint('A valid clean-run receipt is required before evidence can be exported.');
    return;
  }

  const report = getRunProofReport(receiptState);
  const narrativeRun = report.profileId === RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H;
  const narrativeGate = narrativeRun ? deriveNarrativeCreditsGate(receiptState, storyworldState) : null;
  routeProof.dataset.state = routeReady ? 'complete' : 'incomplete';
  routeProof.textContent = routeReady
    ? `Completionist · ${routeTotals.completedActivityCount}/${routeTotals.requiredActivityCount} optional activities complete`
    : `Completionist · ${routeTotals.completedActivityCount}/${routeTotals.requiredActivityCount} optional activities · ${routeTotals.remainingActivityCount} remain`;
  renderTimingLedger(report);
  exportEvidence.disabled = false;
  publishEvidenceExportHint(narrativeRun
    ? 'The export records current narrative timing and optional completionist evidence; incomplete conditions remain explicit.'
    : report.durationProven && routeReady
      ? 'The export contains a signed completionist proof with category, chapter, story, combat, and 215-activity evidence.'
      : 'The export records current evidence and names every missing condition; it never upgrades incomplete timing or route data.');
  const elapsed = formatPlaytime(report.totalMs);
  creditsProof.textContent = narrativeRun
    ? `${report.completedBeatCount}/${report.requiredBeatCount} canonical · ${report.completedStoryworldPlayedSceneCount}/${report.requiredStoryworldPlayedSceneCount} Storyworld · ${elapsed} active / 05:00:00 minimum`
    : `${report.completedBeatCount}/${report.requiredBeatCount} story scenes · ${report.firstClearCount}/${report.requiredFirstClearCount} canonical first clears · ${elapsed} active play`;
  if (report.creditsComplete) {
    creditsStatus.dataset.state = 'sealed';
    creditsStatus.textContent = narrativeRun
      ? `Credits complete · 80-scene narrative receipt sealed at ${elapsed}`
      : report.durationProven
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
    creditsActionHint.textContent = narrativeRun
      ? 'Complete all 60 canonical scenes and all ten Storyworld decision/consequence pairs before sealing the run.'
      : 'Complete every canonical story scene before sealing the run.';
    sealCredits.disabled = true;
    return;
  }
  if (narrativeRun && !narrativeGate.ready) {
    creditsStatus.dataset.state = 'active';
    creditsStatus.textContent = `Narrative complete · receipt active at ${elapsed}`;
    creditsActionHint.textContent = narrativeGate.reasons.includes('active-playtime-incomplete')
      ? `Keep playing with the game visible for ${formatPlaytime(Math.max(0, narrativeGate.targetMs - narrativeGate.totalMs))} before sealing. Optional completionist activities count toward active play.`
      : `Narrative proof is not ready: ${narrativeGate.reasons.join(', ')}.`;
    sealCredits.disabled = true;
    return;
  }
  if (!narrativeRun && !routeReady) {
    creditsStatus.dataset.state = 'active';
    creditsStatus.textContent = `Story complete · intended route unfinished · receipt active at ${elapsed}`;
    creditsActionHint.textContent = 'Return to Campaign and Camp to finish every unlocked quest, chronicle, conversation, council, archive record, and required repeat circuit.';
    sealCredits.disabled = true;
    return;
  }
  creditsStatus.dataset.state = 'active';
  creditsStatus.textContent = `${narrativeRun ? 'Narrative proof ready' : 'Story complete'} · receipt still active at ${elapsed}`;
  creditsActionHint.textContent = narrativeRun
    ? 'The 80-scene narrative and five-hour active-play floor are complete. This explicit action freezes the clean-run receipt.'
    : 'The 215-activity completionist route is complete. This explicit action freezes the clean-run receipt.';
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
  if (!flushPlaytime()) {
    creditsStatus.dataset.state = 'error';
    creditsStatus.textContent = 'Active credits time could not be saved; the receipt remains open.';
    creditsStatus.focus();
    return;
  }
  requiredRouteProgress = loadRequiredRouteProgress();
  const report = getRunProofReport(receiptState);
  if (report.profileId === RUN_RECEIPT_PROFILE_IDS.NARRATIVE_5_6H) {
    const refreshedStoryworld = storyworldAdapter.load();
    storyworldState = refreshedStoryworld.ok && refreshedStoryworld.found ? refreshedStoryworld.state : null;
    if (!deriveNarrativeCreditsGate(receiptState, storyworldState).ready) {
      render();
      creditsStatus.focus();
      return;
    }
  } else if (!requiredRouteProgress.creditsGate.creditsReady) {
    render();
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
  pageAudio.playCue('uiConfirm');
  render();
  creditsStatus.focus();
});

exportEvidence.addEventListener('click', () => {
  if (!receiptState) return;
  if (!flushPlaytime()) {
    evidenceExportNotice = 'Pending active time could not be saved, so no stale evidence file was created.';
    publishEvidenceExportHint('');
    return;
  }
  requiredRouteProgress = loadRequiredRouteProgress();
  const refreshedStoryworld = storyworldAdapter.load();
  storyworldState = refreshedStoryworld.ok && refreshedStoryworld.found ? refreshedStoryworld.state : null;
  try {
    const report = createPlaytestEvidenceReport(receiptState, requiredRouteProgress, storyworldState);
    const blob = new Blob([serializePlaytestEvidenceReport(report)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bells-playtest-evidence-${report.runId}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    evidenceExportNotice = `Evidence ${report.signature} exported for run ${report.runId}.`;
    render();
  } catch (error) {
    evidenceExportNotice = error instanceof Error ? error.message : 'Playtest evidence could not be exported.';
    publishEvidenceExportHint('');
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
  evidenceExportNotice = null;
  const refreshedCampaign = campaignAdapter.load();
  if (refreshedCampaign.ok) campaignState = refreshedCampaign.state;
  const refreshedReceipt = receiptAdapter.load();
  receiptState = refreshedReceipt.ok && refreshedReceipt.found ? refreshedReceipt.state : null;
  const refreshedStoryworld = storyworldAdapter.load();
  storyworldState = refreshedStoryworld.ok && refreshedStoryworld.found ? refreshedStoryworld.state : null;
  requiredRouteProgress = loadRequiredRouteProgress();
  pendingMs = 0;
  lastSample = performance.now();
  lastActivity = lastSample;
  render();
});

render();
requestAnimationFrame(tick);
