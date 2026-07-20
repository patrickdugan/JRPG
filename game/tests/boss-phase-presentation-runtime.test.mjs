import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser presents typed boss phases in manual, enemy, Auto-Grind, HUD, and live-region paths', async () => {
  const source = await readFile(new URL('../battle.js', import.meta.url), 'utf8');
  assert.match(source, /mergeBossTransitionPresentationRecord,/u);
  assert.ok(
    (source.match(/activeBattleAnimation = mergeBossTransitionPresentationRecord\(/gu) ?? []).length >= 3,
    'manual commands, enemy intent, and Auto-Grind must all merge transition holds',
  );
  assert.match(source, /bossTransitionWindow: Boolean\(activeBattleAnimation\.bossTransition/u);
  assert.match(source, /transitionActive: Boolean\(animation\?\.bossTransitionWindow/u);
  assert.match(source, /animation\.bossTransition\?\.bossId === actor\.instanceId/u);
  assert.match(source, /canvas\.dataset\.bossPhaseId = snapshot\.bossPhase\.phaseId/u);
  assert.match(source, /canvas\.dataset\.bossPhaseWarningTo = snapshot\.bossPhase\.warning\.toPhaseId/u);
  assert.match(source, /const phaseSummary = bossPhaseSummary\(snapshot\)/u);
  assert.match(source, /entry\.type === 'boss-phase-warning'/u);
  assert.match(source, /entry\.type === 'boss-phase-entered'/u);
  assert.match(source, /announceBossPhaseLogDelta\(before, after\)/u);
  assert.match(
    source,
    /const animation = reducedMotion\.matches && !sampledAnimation\?\.terminalDefeatWindow \? null : sampledAnimation/u,
    'reduced motion retains the static HUD and announcement while suppressing the nonterminal pose animation',
  );
});
