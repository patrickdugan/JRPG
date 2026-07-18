import test from 'node:test';
import assert from 'node:assert/strict';

import { CampaignCombatEngine } from '../campaign-combat.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import { getLevel, isBlocked, isInBounds } from '../content/levels.mjs';
import {
  formatObjectiveRequirement,
  getObjectiveActionPresentation,
  getObjectiveTokenPlacements,
} from '../objective-presentation.mjs';

test('every authored nonautomatic objective gets deterministic open-board presentation', () => {
  for (const encounter of ENCOUNTERS) {
    const engine = new CampaignCombatEngine({ encounterId: encounter.id });
    const snapshot = engine.snapshot();
    const level = getLevel(encounter.levelId);
    const occupied = snapshot.actors.map((actor) => `${actor.pos.x},${actor.pos.y}`);
    const first = getObjectiveTokenPlacements(level, snapshot.objective.requirements, occupied);
    const second = getObjectiveTokenPlacements(level, snapshot.objective.requirements, occupied);
    assert.deepEqual(first, second, encounter.id);
    for (const placement of first) {
      assert.equal(isInBounds(level, placement.x, placement.y), true, `${encounter.id}:${placement.at}`);
      assert.equal(isBlocked(level, placement.x, placement.y), false, `${encounter.id}:${placement.at}`);
      assert.ok(placement.presentation.label.length > 4);
      assert.ok(placement.presentation.buttonLabel.length > 3);
      assert.match(placement.presentation.color, /^#[0-9a-f]{6}$/i);
    }
  }
});

test('explicit level interactables and objective tiles remain the presentation authority', () => {
  const relayEngine = new CampaignCombatEngine({ encounterId: 'c8-outer-court' });
  const relayLevel = getLevel(relayEngine.encounter.levelId);
  const relays = getObjectiveTokenPlacements(relayLevel, relayEngine.snapshot().objective.requirements);
  assert.deepEqual(relays.map(({ at }) => at), ['4,3', '7,3']);

  const exitEngine = new CampaignCombatEngine({ encounterId: 'prologue-ashen-bailiff' });
  const exitLevel = getLevel(exitEngine.encounter.levelId);
  const exit = getObjectiveTokenPlacements(exitLevel, exitEngine.snapshot().objective.requirements);
  assert.equal(exit[0].at, '11,5');

  const waterEngine = new CampaignCombatEngine({ encounterId: 'c7-name-slip-release' });
  const waterLevel = getLevel(waterEngine.encounter.levelId);
  const water = getObjectiveTokenPlacements(waterLevel, waterEngine.snapshot().objective.requirements);
  assert.deepEqual(water.map(({ at }) => at), ['2,1', '3,1']);
});

test('objective actions have player-facing verbs instead of generic internal keys', () => {
  const presentation = getObjectiveActionPresentation({ action: 'extract', targetId: 'prisoner-a' });
  assert.equal(presentation.label, 'Extract Prisoner A');
  assert.equal(presentation.buttonLabel, 'Extract Prisoner A');
  assert.equal(formatObjectiveRequirement({
    action: 'activateRelay', targetId: 'lantern-relay-west', progress: 0, count: 1, complete: false,
  }), 'Light Lantern Relay West 0/1');
  assert.equal(Object.isFrozen(presentation), true);
});
