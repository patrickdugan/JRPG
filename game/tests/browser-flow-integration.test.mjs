import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');
const pageRecords = [
  ['index.html', 'game.js'],
  ['campaign.html', 'campaign.js'],
  ['battle.html', 'battle.js'],
  ['camp.html', 'camp.js'],
  ['credits.html', 'credits.js'],
].map(([htmlName, sourceName]) => ({
  htmlName,
  html: readFileSync(resolve(ROOT, htmlName), 'utf8'),
  sourceName,
  source: readFileSync(resolve(ROOT, sourceName), 'utf8'),
}));

function occurrences(source, pattern) {
  return source.match(pattern) ?? [];
}

test('every browser controller selector has exactly one element on its owning page', async (t) => {
  for (const page of pageRecords) {
    await t.test(page.htmlName, () => {
      const selectorIds = [...page.source.matchAll(/querySelector\(\s*['"]#([^'"]+)['"]\s*\)/g)]
        .map((match) => match[1]);
      for (const id of selectorIds) {
        const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.equal(
          occurrences(page.html, new RegExp(`\\bid=["']${escaped}["']`, 'g')).length,
          1,
          `${page.sourceName} expects one #${id} in ${page.htmlName}`,
        );
      }
    });
  }
});

test('every static local page, stylesheet, script, and image reference resolves', () => {
  for (const page of pageRecords) {
    for (const match of page.html.matchAll(/(?:href|src)=["']([^"'#?]+)["']/g)) {
      const reference = match[1];
      if (/^(?:[a-z]+:|\/)/i.test(reference)) continue;
      assert.equal(
        existsSync(resolve(dirname(resolve(ROOT, page.htmlName)), reference)),
        true,
        `${page.htmlName} references missing ${reference}`,
      );
    }
  }
});

test('the player-facing navigation graph and battle return handoff remain connected', () => {
  const pages = Object.fromEntries(pageRecords.map((page) => [page.htmlName, page]));
  assert.match(pages['index.html'].html, /href=["']campaign\.html["']/);
  assert.match(pages['campaign.html'].html, /href=["']camp\.html["']/);
  assert.match(pages['camp.html'].html, /href=["']campaign\.html["']/);
  assert.match(pages['campaign.html'].source, /window\.location\.href = 'credits\.html'/);
  assert.match(pages['credits.html'].html, /href=["']camp\.html["']/);
  assert.match(pages['credits.html'].html, /href=["']campaign\.html["']/);
  assert.ok(occurrences(pages['battle.html'].html, /href=["']campaign\.html["']/g).length >= 2);
  assert.match(pages['campaign.html'].source, /new URLSearchParams\(\{ encounter: selected\.id, return: 'campaign\.html', beat: beat\.id \}\)/);
  assert.match(pages['battle.html'].source, /const requestedReturn = query\.get\('return'\)/);
  assert.match(pages['battle.html'].source, /continueCampaign\.href = requestedReturn/);
});

test('credits are an explicit durable seal boundary after story completion', () => {
  const campaignSource = pageRecords.find(({ sourceName }) => sourceName === 'campaign.js').source;
  const creditsSource = pageRecords.find(({ sourceName }) => sourceName === 'credits.js').source;
  assert.match(campaignSource, /View credits & seal run/);
  assert.doesNotMatch(campaignSource, /completeRunCredits/);

  const start = creditsSource.indexOf("sealCredits.addEventListener('click'");
  const end = creditsSource.indexOf("window.addEventListener('pointerdown'", start);
  assert.ok(start >= 0 && end > start, 'credits click boundary must exist');
  const sealBoundary = creditsSource.slice(start, end);
  const completeIndex = sealBoundary.indexOf('completeRunCredits(receiptState, receiptState.runId)');
  const saveIndex = sealBoundary.indexOf('receiptAdapter.save(result.state)');
  const replaceIndex = sealBoundary.indexOf('receiptState = result.state');
  assert.ok(completeIndex >= 0 && saveIndex > completeIndex && replaceIndex > saveIndex);
  assert.match(sealBoundary, /if \(!saved\.ok\)/);
  assert.match(creditsSource, /report\.storyComplete/);
  assert.match(creditsSource, /report\.creditsComplete/);
  assert.match(creditsSource, /createPlaytestEvidenceReport\(receiptState, requiredRouteProgress\)/);
  assert.match(creditsSource, /serializePlaytestEvidenceReport\(report\)/);
  assert.match(creditsSource, /chapterId: campaignState\.current\.chapterId/);
  assert.match(creditsSource, /renderTimingLedger\(report\)/);
  assert.match(creditsSource, /CAMPAIGN\.chapters\.map/);
  assert.match(creditsSource, /CHAPTER_PACING_CHECKPOINTS\.aggregateTargetMs/);
  assert.match(creditsSource, /chapterTimingRow\(chapter, chapterMs\[chapter\.id\] \?\? 0, completedBeatIds\)/);
  assert.match(creditsSource, /diagnostic model, not observed proof/);
  assert.match(pageRecords.find(({ htmlName }) => htmlName === 'credits.html').html, /id=["']chapterTimingList["']/);
  assert.match(pageRecords.find(({ htmlName }) => htmlName === 'credits.html').html, /id=["']pacingBasis["']/);
  assert.match(pageRecords.find(({ htmlName }) => htmlName === 'credits.html').html, /id=["']exportEvidence["']/);
});

test('all player-facing clean-run timers attach their samples to a canonical chapter', () => {
  const campaign = pageRecords.find(({ sourceName }) => sourceName === 'campaign.js').source;
  const battle = pageRecords.find(({ sourceName }) => sourceName === 'battle.js').source;
  const camp = pageRecords.find(({ sourceName }) => sourceName === 'camp.js').source;
  const credits = pageRecords.find(({ sourceName }) => sourceName === 'credits.js').source;
  assert.match(campaign, /recordRunPlaytime\([\s\S]*?chapterId: runReceiptPendingChapterId/);
  assert.match(battle, /recordRunPlaytime\([\s\S]*?chapterId: encounter\.chapterId/);
  assert.match(camp, /recordRunPlaytime\([\s\S]*?chapterId: campaignState\.current\.chapterId/);
  assert.match(credits, /recordRunPlaytime\([\s\S]*?chapterId: campaignState\.current\.chapterId/);
});

test('Camp narrative surfaces expose deterministic keyboard reading controls', () => {
  const camp = pageRecords.find(({ sourceName }) => sourceName === 'camp.js');
  assert.match(camp.html, /<kbd>N<\/kbd> next line/);
  assert.match(camp.source, /function handleNarrativeKeyboard\(event\)/);
  assert.match(camp.source, /event\.key\.toLowerCase\(\) === 'n'/);
  assert.match(camp.source, /event\.key === '1' \|\| event\.key === '2'/);
  assert.match(camp.source, /surface\.advance\.click\(\)/);
  assert.match(camp.source, /choice\.click\(\)/);
  assert.match(camp.source, /event\.repeat/);
});

test('the intended-route ledger blocks story frontiers and credits from real save evidence', () => {
  const campaign = pageRecords.find(({ sourceName }) => sourceName === 'campaign.js');
  const credits = pageRecords.find(({ sourceName }) => sourceName === 'credits.js');
  assert.match(campaign.html, /id=["']routeSummary["']/);
  assert.match(campaign.html, /id=["']routeDueList["']/);
  assert.match(campaign.source, /deriveRequiredRouteProgress\(\{/);
  assert.match(campaign.source, /routeProgress\.metrics\.total\.entryDueActivityCount/);
  assert.match(campaign.source, /\.\.\.progress\.inProgressActivityIds, \.\.\.progress\.entryDueActivityIds/);
  assert.match(campaign.source, /const needsEntry = progress\.entryDueActivityIds\.includes\(activityId\)/);
  assert.match(campaign.source, /needsEntry \? 'Start' : 'Continue'/);
  assert.match(campaign.source, /if \(routeProgress\.metrics\.total\.entryDueActivityCount > 0\)/);
  assert.match(
    campaign.source,
    /function persistCurrentBeatCompletion[\s\S]*?const routeProgress = requiredRouteProgress\(\);[\s\S]*?entryDueActivityCount > 0/,
    'field exits and Next must share the same route-frontier gate',
  );

  assert.match(credits.html, /id=["']routeProof["']/);
  const start = credits.source.indexOf("sealCredits.addEventListener('click'");
  const completeIndex = credits.source.indexOf('completeRunCredits(receiptState, receiptState.runId)', start);
  const refreshIndex = credits.source.indexOf('requiredRouteProgress = loadRequiredRouteProgress()', start);
  const gateIndex = credits.source.indexOf('if (!requiredRouteProgress.creditsGate.creditsReady)', start);
  assert.ok(start >= 0 && refreshIndex > start && gateIndex > refreshIndex && completeIndex > gateIndex,
    'credits must refresh and pass the 215-activity gate before sealing');
  assert.match(credits.source, /routeTotals\.completedActivityCount/);
  assert.match(campaign.source, /routeDueList\.addEventListener\('click'/);
  assert.match(campaign.source, /campRouteHref\(activity\)/);
  const camp = pageRecords.find(({ sourceName }) => sourceName === 'camp.js');
  assert.match(camp.source, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(camp.source, /applyRequestedRouteFocus\(\)/);
  assert.match(camp.source, /target\.click\(\)/);
  assert.match(campaign.source, /unlockPartyMembers\(advancementState, getCurrentChapter\(nextCampaignState\)\.party\)/);
  assert.match(campaign.source, /const pristineAdvancementState = createAdvancementState\(\)/);
  assert.match(campaign.source, /unlockPartyMembers\(pristineAdvancementState, getCurrentChapter\(nextCampaignState\)\.party\)/);
  assert.match(campaign.source, /advancementState: pristineAdvancementState/);
  assert.match(campaign.source, /getEncounterWinCount\(advancementState, stage\.encounterId\) > 0/);
  assert.match(campaign.source, /Witness canonical battle evidence/);
  assert.match(campaign.source, /victory satisfies this witness stage without a duplicate battle/);
});

test('New Game does not depend exclusively on randomUUID support', () => {
  const campaignSource = pageRecords.find(({ sourceName }) => sourceName === 'campaign.js').source;
  assert.match(campaignSource, /runId: createBrowserRunUuid\(\)/);
  assert.doesNotMatch(campaignSource, /requires crypto\.randomUUID/);
});

test('camp loadout mutations persist before replacing the live cross-page state', () => {
  const campSource = pageRecords.find(({ sourceName }) => sourceName === 'camp.js').source;
  const start = campSource.indexOf('function commit(result)');
  const end = campSource.indexOf('\n}', start) + 2;
  assert.ok(start >= 0 && end > start, 'camp commit boundary must exist');
  const commit = campSource.slice(start, end);
  const saveIndex = commit.indexOf('loadoutAdapter.save(result.state)');
  const replaceIndex = commit.indexOf('loadoutState = result.state');
  assert.ok(saveIndex >= 0 && replaceIndex > saveIndex, 'camp state may change only after a successful write');
  assert.match(commit, /if \(!saved\.ok\)/);
  assert.match(commit, /save could not be written/);
});

test('battle victory is durable before the campaign continuation is exposed', () => {
  const battleSource = pageRecords.find(({ sourceName }) => sourceName === 'battle.js').source;
  const start = battleSource.indexOf('function recordVictoryIfNeeded(snapshot)');
  const end = battleSource.indexOf('\nfunction renderSpeedControls', start);
  assert.ok(start >= 0 && end > start, 'victory persistence boundary must exist');
  const victory = battleSource.slice(start, end);
  const nextStateIndex = victory.indexOf('const nextAdvancementState = recordEncounterWin');
  const saveIndex = victory.indexOf('commitPersistenceTransaction(');
  const replaceIndex = victory.indexOf('advancementState = nextAdvancementState');
  assert.ok(nextStateIndex >= 0 && saveIndex > nextStateIndex && replaceIndex > saveIndex,
    'live battle authorities may change only after the complete transaction succeeds');
  assert.doesNotMatch(victory, /\b\w+Adapter\.save\(/, 'victory settlement must not bypass its transaction');
  for (const authority of ['advancement', 'loadout', 'quest', 'witness', 'field', 'run-receipt']) {
    assert.match(victory, new RegExp(`id: '${authority}'`));
  }
  assert.match(victory, /stateSaveStep\(id, adapter, previousState, nextState, \{ supportsOverwriteRollback: true \}\)/);
  assert.match(victory, /if \(!persisted\.ok\)[\s\S]*?return failSettlement/);
  assert.match(victory, /victorySaveRetryAt = performance\.now\(\) \+ 1000/);
  assert.match(victory, /setMemberVitals\(nextLoadoutState/);
  assert.match(battleSource, /continueCampaign\.hidden = [^;]+\|\| !durableVictory;/);
});

test('player-triggered campaign mutations use the transactional persistence boundary', () => {
  const campaignSource = pageRecords.find(({ sourceName }) => sourceName === 'campaign.js').source;
  const start = campaignSource.indexOf('function choose(choiceId)');
  const end = campaignSource.indexOf("window.addEventListener('keydown'", start);
  assert.ok(start >= 0 && end > start);
  const playerTransitions = campaignSource.slice(start, end);
  assert.doesNotMatch(playerTransitions, /\b\w+Adapter\.save\(/, 'handlers must not bypass transaction results');
  for (const action of [
    'Scene decision',
    'Chapter navigation',
    'Dialogue progress',
    'Side-story acceptance',
    'Witness-route entry',
    'Scene operation',
    'Witness stage',
    'Field interaction',
    'New Game',
  ]) assert.match(playerTransitions, new RegExp(`commitStateChanges\\('${action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(playerTransitions, /function persistCurrentBeatCompletion[\s\S]*?commitStateChanges\(action, changes\)/);
});
