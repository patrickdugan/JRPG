import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ENCOUNTERS, isBossEncounter } from '../content/encounters.mjs';

const surfaces = [
  ['campaign.html', 'campaign.js', 'exploration'],
  ['battle.html', 'battle.js', null],
  ['camp.html', 'camp.js', 'exploration'],
  ['index.html', 'game.js', 'battle'],
  ['credits.html', 'credits.js', 'exploration'],
];

function source(name) {
  return readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
}

test('every playable browser surface exposes one accessible shared sound control set', () => {
  for (const [htmlName, controllerName, loop] of surfaces) {
    const html = source(htmlName);
    const controller = source(controllerName);
    for (const id of ['audioToggle', 'audioVolume', 'audioStatus']) {
      assert.equal([...html.matchAll(new RegExp(`id=["']${id}["']`, 'g'))].length, 1, `${htmlName} #${id}`);
    }
    assert.match(html, /for=["']audioVolume["']/);
    assert.match(html, /class=["']audio-controls["'][^>]*role=["']group["']/);
    assert.match(html, /id=["']audioVolume["'][^>]*type=["']range["'][^>]*min=["']0["'][^>]*max=["']1["']/);
    assert.match(html, /id=["']audioStatus["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/);
    assert.match(html, /href=["']audio-controls\.css["']/);
    assert.match(controller, /import \{ mountAudioControls \} from '\.\/audio-controls\.mjs';/);
    assert.match(controller, /mountAudioControls\(/);
    if (loop) assert.match(controller, new RegExp(`desiredLoop: '${loop}'`));
  }
});

test('boss score classification identifies exactly the ten authored boss formats', () => {
  assert.deepEqual(
    ENCOUNTERS.filter(isBossEncounter).map((encounter) => encounter.id),
    [
      'c1-tithe-hound',
      'fp1-mateus',
      'c3-captain-kaji',
      'c4-widow-of-fog',
      'c5-furnace-abbot',
      'c6-ujiro',
      'c7-bell-warden-chiyo',
      'c8-lady-enma',
      'c9-yearless-bell',
      'c9-kurozane',
    ],
  );
  assert.ok(ENCOUNTERS.every((encounter) => encounter.bossMechanic));
  assert.equal(isBossEncounter({ format: 'teaching-battle', bossMechanic: {} }), false);
});

test('audio hooks consume score metadata and fire transition cues outside animation frames', () => {
  const campaign = source('campaign.js');
  const battle = source('battle.js');
  const sceneDirection = campaign.slice(
    campaign.indexOf('function renderSceneDirection'),
    campaign.indexOf('function renderChapterList'),
  );
  assert.match(sceneDirection, /getSceneDirection\(beat\.id\)/);
  assert.match(sceneDirection, /sceneMusicCue\.textContent = direction\.musicCue/);
  assert.match(sceneDirection, /pageAudio\.setLoop\('exploration'\)/);
  const animation = battle.slice(
    battle.indexOf('function startCombatAnimation'),
    battle.indexOf('function currentBattleAnimationFrame'),
  );
  for (const cue of ['combatHeal', 'combatGuard', 'combatCritical', 'combatHit']) {
    assert.match(animation, new RegExp(`pageAudio\\.playCue\\('${cue}'\\)`));
  }
  const battleRender = battle.slice(battle.indexOf('function render()'), battle.indexOf('function executeRepeatPolicyCommand'));
  assert.doesNotMatch(battleRender, /pageAudio\.playCue/);
});

test('device audio preference is not part of recovery or run-proof authority', () => {
  const recovery = source('recovery-checkpoint.mjs');
  const receipt = source('run-receipt.mjs');
  const evidence = source('playtest-evidence.mjs');
  for (const proofSource of [recovery, receipt, evidence]) {
    assert.doesNotMatch(proofSource, /bells-black-chrysanthemum\.audio\.v1/);
    assert.doesNotMatch(proofSource, /AUDIO_PREFERENCE_KEY/);
  }
});
