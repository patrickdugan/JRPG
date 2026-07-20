import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [source, markup, styles] = await Promise.all([
  readFile(new URL('../battle.js', import.meta.url), 'utf8'),
  readFile(new URL('../battle.html', import.meta.url), 'utf8'),
  readFile(new URL('../battle.css', import.meta.url), 'utf8'),
]);

test('Mateus mechanic card is accessible, encounter-gated, and hidden by default', () => {
  assert.match(markup, /id="mateusMechanicCard"[^>]*aria-labelledby="mateusMechanicHeading"[^>]*hidden/);
  assert.match(markup, /id="mateusWards"[^>]*aria-label="Blood Ward status"/);
  assert.match(markup, /id="mateusIntent"[^>]*aria-labelledby="mateusIntentHeading"[^>]*hidden/);
  assert.match(markup, /id="mateusIntentTiles"[^>]*aria-label="Crimson Litany targeted tiles"/);
  assert.match(styles, /\.mechanic-card\[hidden\], \.mechanic-intent\[hidden\] \{ display: none; \}/);
  const render = source.slice(source.indexOf('function renderBossMechanic'), source.indexOf('\nfunction recordVictoryIfNeeded'));
  assert.match(render, /mateusMechanicCard\.hidden = !mechanic/);
  assert.match(render, /ward\.active \? 'active' : ward\.hp <= 0 \? 'broken' : 'dormant'/);
  assert.match(render, /Math\.round\(mechanic\.incomingDamageMultiplier \* 100\)/);
  assert.match(render, /mateusIntentAnswer\.textContent = intent\?\.answer/);
  assert.match(render, /intent\?\.tiles/);
  assert.match(render, /mechanic\.recovery\.recoveryPulses/);
  assert.match(render, /mechanic\.resolution\.hp/);
});

test('pending Crimson Litany publishes exact read-only QA metadata and four-tile canvas overlay', () => {
  const publish = source.slice(source.indexOf('function publishRenderedBattleState'), source.indexOf('\nfunction renderTempo'));
  for (const field of [
    'bossMechanicId', 'bossActiveWardCount', 'bossIncomingDamageMultiplier',
    'bossIntentId', 'bossIntentSkillId', 'bossIntentKind', 'bossIntentTiles',
    'bossIntentAnswer', 'bossIntentRecoveryPulses',
  ]) {
    assert.match(publish, new RegExp(`'${field}'`));
  }
  assert.match(publish, /\]\) delete canvas\.dataset\[key\]/);
  assert.match(publish, /canvas\.dataset\.bossIntentTiles = mechanic\.pendingIntent\.tiles\.join\('\|'\)/);
  assert.match(publish, /canvas\.dataset\.bossIntentAnswer = mechanic\.pendingIntent\.answer/);
  assert.match(publish, /canvas\.dataset\.bossIntentRecoveryPulses = String\(mechanic\.pendingIntent\.recoveryPulses\)/);

  const overlay = source.slice(source.indexOf('function drawBossIntent'), source.indexOf('\nfunction drawBattle('));
  assert.match(overlay, /snapshot\.bossMechanic\?\.pendingIntent/);
  assert.match(overlay, /intent\.tiles\.forEach/);
  assert.match(overlay, /key\.split\(','\)\.map\(Number\)/);
  assert.match(source, /drawObjectiveTokens\(snapshot, level, geometry, now\);\s+drawBossIntent\(snapshot, geometry\);/);
});

test('Mateus simulation events have concise battle-log presentation without frame-loop cues', () => {
  const formatter = source.slice(source.indexOf('function formatEngineLog'), source.indexOf('\nfunction renderLog'));
  for (const type of [
    'summon', 'damage-mitigated', 'intent-published', 'intent-answered',
    'intent-resolved', 'ward-broken', 'surrender',
  ]) assert.match(formatter, new RegExp(`entry\\.type === '${type}'`));
  const overlay = source.slice(source.indexOf('function drawBossIntent'), source.indexOf('\nfunction drawBattle('));
  assert.doesNotMatch(overlay, /pageAudio|playCue|addMessage|render\(/);
});
