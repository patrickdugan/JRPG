import test from 'node:test';
import assert from 'node:assert/strict';

import { CAMPAIGN } from '../content/campaign.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import { CAMPAIGN_PACING } from '../advancement.mjs';
import {
  createPlaytimeState,
  formatPlaytime,
  getBattlePlaytimeCategory,
  getPlaytimeReport,
  isPlaytimeInactive,
  loadPlaytimeState,
  PLAYTIME_INACTIVITY_THRESHOLD_MS,
  recordPlaytime,
  REQUIRED_FIRST_CLEAR_COUNT,
  serializePlaytimeState,
  validatePlaytimePayload,
} from '../playtime.mjs';

test('active play samples accumulate by category and chapter', () => {
  const chapterId = CAMPAIGN.chapters[0].id;
  let state = createPlaytimeState();
  state = recordPlaytime(state, 'exploration', 1000, { chapterId });
  state = recordPlaytime(state, 'narrative', 500, { chapterId });
  assert.equal(state.totalMs, 1500);
  assert.equal(state.chapterMs[chapterId], 1500);
  assert.equal(formatPlaytime(state.totalMs), '00:00:01');
  assert.deepEqual(loadPlaytimeState(serializePlaytimeState(state)).state, state);
});

test('the inactivity predicate stops samples at thirty seconds or while hidden', () => {
  assert.equal(PLAYTIME_INACTIVITY_THRESHOLD_MS, 30_000);
  assert.equal(isPlaytimeInactive({ nowMs: 29_999, lastActivityMs: 0 }), false);
  assert.equal(isPlaytimeInactive({ nowMs: 30_000, lastActivityMs: 0 }), true);
  assert.equal(isPlaytimeInactive({ nowMs: 1000, lastActivityMs: 0, visible: false }), true);
  assert.equal(isPlaytimeInactive({ nowMs: Number.NaN, lastActivityMs: 0 }), true);
});

test('battle telemetry changes from first clear to grind immediately after a win', () => {
  assert.equal(getBattlePlaytimeCategory(0), 'firstClearCombat');
  assert.equal(getBattlePlaytimeCategory(1), 'grind');
  assert.equal(getBattlePlaytimeCategory(12), 'grind');
  assert.throws(() => getBattlePlaytimeCategory(-1), RangeError);
});

test('elapsed time alone cannot prove campaign duration', () => {
  let state = createPlaytimeState();
  const fixedMinutes = CAMPAIGN_PACING.targetMinutesAt1x - CAMPAIGN_PACING.grindMinutesAt1x;
  for (let minute = 0; minute < fixedMinutes; minute += 1) state = recordPlaytime(state, 'exploration', 60_000);
  for (let minute = 0; minute < CAMPAIGN_PACING.grindMinutesAt1x; minute += 1) state = recordPlaytime(state, 'grind', 60_000);
  const report = getPlaytimeReport(state);
  assert.equal(report.totalMs >= report.targetMs, true);
  assert.equal(report.durationProven, false);
});

test('duration proof requires campaign completion and every canonical first clear', () => {
  let state = createPlaytimeState();
  const fixedMinutes = CAMPAIGN_PACING.targetMinutesAt1x - CAMPAIGN_PACING.grindMinutesAt1x;
  for (let minute = 0; minute < fixedMinutes; minute += 1) state = recordPlaytime(state, 'exploration', 60_000);
  for (let minute = 0; minute < CAMPAIGN_PACING.grindMinutesAt1x; minute += 1) state = recordPlaytime(state, 'grind', 60_000);
  const canonicalIds = ENCOUNTERS.map((encounter) => encounter.id);
  assert.equal(REQUIRED_FIRST_CLEAR_COUNT, canonicalIds.length);
  assert.equal(getPlaytimeReport(state, { campaignComplete: true, firstClearEncounterIds: canonicalIds.slice(1) }).durationProven, false);
  const report = getPlaytimeReport(state, { campaignComplete: true, firstClearEncounterIds: canonicalIds });
  assert.equal(report.firstClearCount, REQUIRED_FIRST_CLEAR_COUNT);
  assert.equal(report.firstClearsComplete, true);
  assert.equal(report.durationProven, true);
  assert.equal(getPlaytimeReport(state, { campaignComplete: true, firstClears: REQUIRED_FIRST_CLEAR_COUNT }).durationProven, true);
});

test('tampered totals are rejected', () => {
  const payload = JSON.parse(serializePlaytimeState(createPlaytimeState()));
  payload.totalMs = 1;
  const result = validatePlaytimePayload(payload);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /category sum/);
});
