import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('every browser surface has a keyboard-visible main-content bypass', () => {
  for (const page of ['index.html', 'campaign.html', 'battle.html', 'camp.html', 'credits.html']) {
    const html = source(page);
    assert.match(html, /<a class="skip-link" href="#mainContent">Skip to main content<\/a>/);
    assert.match(html, /<main id="mainContent"/);
  }
  assert.match(source('audio-controls.css'), /\.skip-link:focus/);
});

test('FP-0 exposes eight touch directions and a textual tactical summary', () => {
  const html = source('index.html');
  assert.equal([...html.matchAll(/data-move="-?\d,-?\d"/g)].length, 8);
  assert.match(html, /id="boardSummary"/);
  assert.match(source('game.js'), /Legal destinations:/);
  assert.match(source('style.css'), /grid-template-columns: repeat\(3, 44px\)/);
  assert.match(source('tools/browser-smoke.py'), /FP-0 touch-only gameplay path ended at/);
});

test('global gameplay handlers leave form controls and editable content alone', () => {
  for (const controller of ['game.js', 'campaign.js', 'battle.js']) {
    const js = source(controller);
    assert.match(js, /event\.altKey \|\| event\.ctrlKey \|\| event\.metaKey/);
    assert.match(js, /input, select, textarea, button, a, \[contenteditable="true"\]/);
  }
});

test('canvas controllers implement reduced-motion visual clocks', () => {
  for (const controller of ['game.js', 'campaign.js', 'battle.js']) {
    const js = source(controller);
    assert.match(js, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
    assert.match(js, /reducedMotion\.matches/);
  }
  const smoke = source('tools/browser-smoke.py');
  assert.match(smoke, /reduced_motion="reduce"/);
  assert.match(smoke, /Reduced-motion canvas kept animating/);
});

test('rebuilding logical selectors restores focus to their replacements', () => {
  assert.match(source('campaign.js'), /data-chapter-id=.*\.focus\(\{ preventScroll: true \}\)/s);
  assert.match(source('battle.js'), /data-actor-id=.*\.focus\(\{ preventScroll: true \}\)/s);
  const smoke = source('tools/browser-smoke.py');
  assert.match(smoke, /Campaign chapter focus was lost/);
  assert.match(smoke, /Battle enemy focus was lost/);
});

test('rapidly replaced battle histories are not live regions', () => {
  const html = source('battle.html');
  assert.doesNotMatch(html, /id="tempoQueue"[^>]*aria-live/);
  assert.doesNotMatch(html, /id="resultLog"[^>]*aria-live/);
  assert.match(html, /id="battleAnnouncements"[^>]*role="status"[^>]*aria-live="assertive"/);
  const battle = source('battle.js');
  assert.match(battle, /function announceEngineLogDelta\(beforeSnapshot, afterSnapshot\)/);
  assert.ok((battle.match(/announceEngineLogDelta\(/g) ?? []).length >= 4);
  assert.match(battle, /const result = engine\.resolveEnemyActivation\(\);\s+const after = engine\.snapshot\(\);\s+if \(!result\.ok\) addMessage\(result\.reason\);\s+else announceEngineLogDelta\(before, after\);/);
  assert.match(source('credits.html'), /id="evidenceExportHint"[^>]*role="status"[^>]*aria-live="polite"/);
});

test('battle target cards disable defeated and temporarily locked enemies', () => {
  const battle = source('battle.js');
  assert.match(battle, /card\.disabled = !targetable/);
  assert.match(battle, /const enemyTargetingAvailable = snapshot\.phase === CAMPAIGN_COMBAT_PHASES\.PLAYER_COMMAND[\s\S]*?!manualInputLocked\(\)/);
  assert.match(battle, /const targetable = enemyTargetingAvailable && actor\.active !== false && actor\.hp > 0/);
  assert.match(battle, /actor\.instanceId === selectedEnemyTargetId/);
});

test('Campaign Dodge and Item have native controls and isolated non-repeating keyboard shortcuts', () => {
  const html = source('battle.html');
  const battle = source('battle.js');
  const css = source('battle.css');
  assert.match(html, /<button type="button" data-command="dodge" aria-keyshortcuts="F">F · Dodge<\/button>/);
  assert.equal((html.match(/data-command="dodge"/g) ?? []).length, 1);
  assert.match(html, /<button type="button" data-command="item" aria-keyshortcuts="I">I · Item<\/button>/);
  assert.equal((html.match(/data-command="item"/g) ?? []).length, 1);
  assert.match(html, /<label for="itemSelect">[\s\S]*?<select id="itemSelect" name="item" aria-describedby="commandHint" disabled>/);
  assert.match(battle, /f: 'dodge'/);
  assert.match(battle, /i: 'item'/);
  assert.match(battle, /if \(commandShortcuts\[key\] && !event\.repeat\)/);
  assert.match(battle, /event\.target\.closest\('input, select, textarea, button, a, \[contenteditable="true"\]'\)/);
  assert.match(battle, /selectedCommand === 'dodge'[\s\S]*?engine\.dodge\(actor\.instanceId\)/);
  assert.match(battle, /selectedCommand === 'item'[\s\S]*?engine\.useItem\(actor\.instanceId, itemSelect\.value, targetSelect\.value\)/);
  assert.match(battle, /if \(selectedCommand === 'item' && partyTarget\)/);
  assert.match(battle, /if \(!\['attack', 'skill', 'analyze'\]\.includes\(selectedCommand\)\) return;/,
    'Item and targetless commands suppress enemy canvas targeting');
  assert.match(battle, /quote\?\.usable/);
  assert.match(battle, /No item, Recovery, or turn will be spent/);
  assert.match(battle, /reducedMotion\.matches \? 0\.5 : \(visualNow % 640\) \/ 640/,
    'persistent Dodge cue has one static reduced-motion frame');
  assert.match(css, /\.command-grid \{[^}]*repeat\(8, minmax\(58px, 1fr\)\)/);
  assert.match(css, /\.selection-grid \{[^}]*repeat\(3, minmax\(0, 1fr\)\)/);
});
