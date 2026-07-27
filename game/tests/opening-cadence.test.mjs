import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPENING_BATTLE_DIALOGUE_GATES,
  getOpeningInteractionGate,
  OPENING_BEAT_ID,
} from '../opening-cadence.mjs';
import { getEncounter } from '../content/encounters.mjs';

test('the opening asks for play after eight lines and braids later dialogue through field tasks', () => {
  assert.equal(getOpeningInteractionGate({ beatId: OPENING_BEAT_ID, acknowledgedLines: 7, completedNodeCount: 0 }), null);
  assert.equal(getOpeningInteractionGate({ beatId: OPENING_BEAT_ID, acknowledgedLines: 8, completedNodeCount: 0 })?.requiredCompletedNodeCount, 1);
  assert.equal(getOpeningInteractionGate({ beatId: OPENING_BEAT_ID, acknowledgedLines: 18, completedNodeCount: 1 })?.requiredCompletedNodeCount, 2);
  assert.equal(getOpeningInteractionGate({ beatId: OPENING_BEAT_ID, acknowledgedLines: 27, completedNodeCount: 2 })?.requiredCompletedNodeCount, 3);
  assert.equal(getOpeningInteractionGate({ beatId: OPENING_BEAT_ID, acknowledgedLines: 27, completedNodeCount: 3 }), null);
});

test('opening cadence gates never affect later scenes', () => {
  assert.equal(getOpeningInteractionGate({ beatId: 'c01-somewhere-else', acknowledgedLines: 30, completedNodeCount: 0 }), null);
});

test('post-battle dialogue cannot spoil the result before each opening encounter clears', () => {
  assert.equal(OPENING_BATTLE_DIALOGUE_GATES.length, 3);
  for (const gate of OPENING_BATTLE_DIALOGUE_GATES) {
    assert.equal(getEncounter(gate.encounterId)?.id, gate.encounterId);
    assert.equal(
      getOpeningInteractionGate({
        beatId: gate.beatId,
        acknowledgedLines: gate.afterLine - 1,
      }),
      null,
    );
    assert.equal(
      getOpeningInteractionGate({
        beatId: gate.beatId,
        acknowledgedLines: gate.afterLine,
      })?.encounterId,
      gate.encounterId,
    );
    assert.equal(
      getOpeningInteractionGate({
        beatId: gate.beatId,
        acknowledgedLines: gate.afterLine,
        clearedEncounterIds: [gate.encounterId],
      }),
      null,
    );
  }
});
