import assert from 'node:assert/strict';
import test from 'node:test';

import { ENCOUNTERS } from '../content/encounters.mjs';
import { runCanonicalCompletion } from '../canonical-run.mjs';
import { getEncounterWinCount, getParty } from '../advancement.mjs';
import { getNarrativeProgress } from '../narrative-runtime.mjs';
import { isCampaignComplete } from '../progression.mjs';
import { CAMPAIGN } from '../content/campaign.mjs';

const BEATS = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats);

test('canonical DOM-free run legally completes every authority without fabricating duration', () => {
  const run = runCanonicalCompletion();

  assert.equal(run.ok, true);
  assert.equal(isCampaignComplete(run.states.campaign), true);
  assert.equal(run.summary.beatCount, 60);
  assert.equal(run.summary.battleCount, 23);
  assert.equal(run.summary.firstClearCount, ENCOUNTERS.length);
  assert.deepEqual(run.states.receipt.completedBeatIds, BEATS.map(({ id }) => id));
  assert.deepEqual(run.states.receipt.firstClearEncounterIds, ENCOUNTERS.map(({ id }) => id));
  assert.deepEqual(run.proof.missingBeatIds, []);
  assert.deepEqual(run.proof.missingFirstClearEncounterIds, []);
  assert.equal(run.proof.campaignComplete, true);
  assert.equal(run.proof.firstClearsComplete, true);
  assert.equal(run.proof.totalMs, 0);
  assert.equal(run.proof.durationProven, false);
  assert.equal(run.summary.receiptPlaytimeMs, 0);
  assert.equal(run.summary.fieldPlaytimeMs, 0);
  assert.ok(run.summary.routeCount > 0);
  assert.ok(run.summary.fieldSteps > run.summary.routeCount);
  assert.equal(run.summary.choiceCount, 59);

  assert.equal(run.fullyIntegrated, true);
  assert.equal(run.fieldCoverage.complete, true);
  assert.equal(run.summary.requiredRouteCount, 34);
  assert.equal(run.summary.routeCount, run.summary.requiredRouteCount);
  assert.equal(run.summary.fieldSteps, 599);
  assert.equal(run.summary.interactionCount, 53);
  assert.equal(run.summary.exitCount, 41);
  assert.equal(run.summary.restCount, 16);
  assert.equal(run.summary.playerCommands, 224);
  assert.equal(run.summary.enemyActivations, 100);
  assert.deepEqual(run.fieldCoverage.routeGaps, []);
  assert.deepEqual(run.fieldCoverage.finalObjectiveGaps, []);

  for (const encounter of ENCOUNTERS) {
    assert.equal(getEncounterWinCount(run.states.advancement, encounter.id), 1, encounter.id);
  }
  const party = getParty(run.states.advancement, { unlockedOnly: true });
  assert.equal(party.length, 6);
  assert.ok(party.every(({ level }) => level === 40));
  assert.equal(run.states.advancement.inventory.currency, 3396);
  assert.equal(run.states.loadout.currency, 2916);
  assert.ok(Object.values(run.states.loadout.vitals).every((vitals) =>
    vitals.hp === vitals.maxHp && vitals.statuses.length === 0));
  for (const beat of BEATS) {
    const lineCount = Array.isArray(beat.text) && beat.text.length ? beat.text.length : 1;
    assert.equal(getNarrativeProgress(run.states.narrative, beat.id, lineCount).complete, true, beat.id);
  }
});

test('canonical trace and signature replay identically under the same hard bounds', () => {
  const first = runCanonicalCompletion();
  const replay = runCanonicalCompletion();

  assert.match(first.signature, /^fnv1a32:[0-9a-f]{8}$/);
  assert.equal(first.signature, 'fnv1a32:79a6adbd');
  assert.equal(replay.signature, first.signature);
  assert.deepEqual(replay.summary, first.summary);
  assert.deepEqual(replay.trace, first.trace);
});
