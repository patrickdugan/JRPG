import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  ENEMY_TRIGGER_CLIPS,
  ENEMY_TRIGGER_ENTRIES,
  ENEMY_TRIGGER_GEOMETRY,
  PARTY_ANIMATION_CHARACTERS,
  PARTY_ANIMATION_CLIPS,
  PARTY_ANIMATION_GEOMETRY,
  createEnemyEncounterTriggerState,
  sampleEnemyTriggerAnimation,
  samplePartyAnimation,
  transitionEnemyEncounterTrigger,
} from '../roster-animation-atlas.mjs';

const suiteUrl = new URL('../../assets/art/roster-animation-runtime-v1/', import.meta.url);
const runtimeUrl = new URL('../assets/art/roster-animation-runtime-v1/', import.meta.url);
const enemySuiteUrl = new URL('../../assets/art/enemy-field-suite-v3/', import.meta.url);
const enemyRuntimeUrl = new URL('../assets/art/enemy-field-suite-v3/', import.meta.url);

test('runtime metadata covers all seven party and thirty-two PS1-density enemy/boss entries', async () => {
  const partySource = JSON.parse(
    await readFile(new URL('roster-animation-runtime.source.json', suiteUrl), 'utf8'),
  );
  const enemyManifest = JSON.parse(await readFile(new URL('manifest.json', enemySuiteUrl), 'utf8'));
  assert.equal(PARTY_ANIMATION_CHARACTERS.length, 7);
  assert.equal(ENEMY_TRIGGER_ENTRIES.length, 32);
  assert.equal(PARTY_ANIMATION_CHARACTERS.length + ENEMY_TRIGGER_ENTRIES.length, 39);
  assert.deepEqual(
    PARTY_ANIMATION_CHARACTERS.map(({ id }) => id),
    partySource.party.characters.map(({ id }) => id),
  );
  assert.deepEqual(
    ENEMY_TRIGGER_ENTRIES.map(({ id }) => id),
    enemyManifest.rows.map(({ id }) => id),
  );
  assert.deepEqual(
    ENEMY_TRIGGER_ENTRIES.map(({ profile }) => profile),
    enemyManifest.rows.map(({ profile }) => profile),
  );
  assert.deepEqual(PARTY_ANIMATION_CLIPS, partySource.party.clips);
  assert.deepEqual(ENEMY_TRIGGER_CLIPS, enemyManifest.triggerClips);
  assert.deepEqual(PARTY_ANIMATION_GEOMETRY.pivot, [24, 58]);
  assert.deepEqual(ENEMY_TRIGGER_GEOMETRY.pivot, [40, 77]);
});

test('party sampling exposes exact attack events and stable atlas rectangles', () => {
  const before = samplePartyAnimation('lise', 'basic-strike', 279);
  const active = samplePartyAnimation('lise', 'basic-strike', 280);
  assert.equal(before.localFrame, 2);
  assert.equal(before.event, null);
  assert.equal(active.localFrame, 3);
  assert.equal(active.event, 'damage');
  assert.equal(active.eventToken, 'basic-strike:0:3');
  assert.deepEqual(active.rect, [21 * 48, 2 * 64, 48, 64]);

  const skillA = samplePartyAnimation('mateus', 'signature-a', 360);
  const skillB = samplePartyAnimation('miyo', 'signature-b', 380);
  assert.equal(skillA.event, 'skill-a');
  assert.equal(skillB.event, 'skill-b');
  assert.equal(samplePartyAnimation('ren', 'idle', 720).cycle, 1);
  assert.throws(() => samplePartyAnimation('unknown', 'idle', 0), RangeError);
  assert.throws(() => samplePartyAnimation('ren', 'unknown', 0), RangeError);
});

test('enemy trigger sampling exposes alert and contact only on active frames', () => {
  const alertWindup = sampleEnemyTriggerAnimation('cinder-hound', 'alert', 169);
  const alertActive = sampleEnemyTriggerAnimation('cinder-hound', 'alert', 170);
  const contact = sampleEnemyTriggerAnimation('black-chrysanthemum-nest-woman', 'engage', 120);
  assert.equal(alertWindup.event, null);
  assert.equal(alertActive.event, 'encounter-alert');
  assert.equal(alertActive.atlasFrame, 6);
  assert.equal(contact.event, 'encounter-contact');
  assert.equal(contact.atlasFrame, 10);
  assert.equal(contact.profile, 'ambush');
  assert.deepEqual(contact.rect, [10 * 80, 24 * 80, 80, 80]);
  assert.throws(() => sampleEnemyTriggerAnimation('unknown', 'alert', 0), RangeError);
});

test('encounter trigger state moves through readable grace phases and emits an isolated contact receipt', () => {
  const dormant = createEnemyEncounterTriggerState('storm-nue');
  const sense = transitionEnemyEncounterTrigger(dormant, 'player-enter-sense');
  const alert = transitionEnemyEncounterTrigger(sense, 'sense-confirmed');
  const pursue = transitionEnemyEncounterTrigger(alert, 'animation-complete');
  const engage = transitionEnemyEncounterTrigger(pursue, 'player-contact');

  assert.deepEqual(
    [dormant.clipId, sense.clipId, alert.clipId, pursue.clipId, engage.clipId],
    ['dormant', 'sense', 'alert', 'pursue', 'engage'],
  );
  assert.deepEqual(engage.encounterContactReceipt, {
    schemaVersion: 1,
    kind: 'field-encounter-contact',
    enemyId: 'storm-nue',
    triggerRevision: 4,
    canonicalMutation: false,
  });
  assert.equal(Object.isFrozen(engage.encounterContactReceipt), true);
  assert.equal(transitionEnemyEncounterTrigger(engage, 'player-left'), engage);

  const cooldown = transitionEnemyEncounterTrigger(pursue, 'player-left');
  assert.equal(cooldown.clipId, 'cooldown');
  assert.equal(transitionEnemyEncounterTrigger(cooldown, 'animation-complete').clipId, 'dormant');
  assert.throws(() => createEnemyEncounterTriggerState('unknown'), RangeError);
});

test('runtime atlases are byte-identical to production outputs and module stays storage-free', async () => {
  const [partySource, partyRuntime, enemySource, enemyRuntime] = await Promise.all([
    readFile(new URL('party-combat-animation-atlas-v1.png', suiteUrl)),
    readFile(new URL('party-combat-animation-atlas-v1.png', runtimeUrl)),
    readFile(new URL('enemy-encounter-trigger-atlas-v3.png', enemySuiteUrl)),
    readFile(new URL('enemy-encounter-trigger-atlas-v3.png', enemyRuntimeUrl)),
  ]);
  assert.equal(partyRuntime.equals(partySource), true, 'party-combat-animation-atlas-v1.png');
  assert.equal(enemyRuntime.equals(enemySource), true, 'enemy-encounter-trigger-atlas-v3.png');
  const moduleSource = await readFile(new URL('../roster-animation-atlas.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(moduleSource, /localStorage|sessionStorage|campaign.*settle/iu);
});

test('standalone review surface exposes both atlases, clip controls, and the full trigger sequence', async () => {
  const [html, source] = await Promise.all([
    readFile(new URL('../roster-animation-review.html', import.meta.url), 'utf8'),
    readFile(new URL('../roster-animation-review.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="partyCanvas"/u);
  assert.match(html, /id="enemyCanvas"/u);
  assert.match(html, /id="partyCharacter"/u);
  assert.match(html, /id="enemyCharacter"/u);
  assert.match(html, /Run full encounter trigger/u);
  assert.match(source, /samplePartyAnimation/u);
  assert.match(source, /sampleEnemyTriggerAnimation/u);
  assert.match(source, /triggerSequenceStartedAt/u);
  assert.match(source, /requestAnimationFrame/u);
  assert.doesNotMatch(source, /localStorage|sessionStorage|campaign.*settle/iu);
});
