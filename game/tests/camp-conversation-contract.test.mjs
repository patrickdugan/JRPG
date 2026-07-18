import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAMP_CONVERSATION_GROUPS,
  CAMP_CONVERSATION_PLAN,
  CAMP_CONVERSATION_TARGETS,
  getCampConversationPlan,
  validateCampConversationPack,
} from '../camp-conversation-contract.mjs';

test('conversation plan owns all unordered party pairs and 90 exact slots', () => {
  assert.equal(CAMP_CONVERSATION_PLAN.length, 15);
  assert.equal(CAMP_CONVERSATION_PLAN.flatMap((entry) => entry.conversations).length, 90);
  assert.deepEqual(Object.values(CAMP_CONVERSATION_GROUPS).map((pairs) => pairs.length), [5, 5, 5]);
  const unordered = new Set(CAMP_CONVERSATION_PLAN.map((entry) => [...entry.participants].sort().join(':')));
  assert.equal(unordered.size, 15);
  assert.equal(CAMP_CONVERSATION_TARGETS.minimumCatalogueWords, 40_500);
  assert.equal(Object.isFrozen(CAMP_CONVERSATION_PLAN[0].conversations), true);
});

test('lookup is null-safe and every planned slot is canonical', () => {
  assert.equal(getCampConversationPlan('missing'), null);
  for (const entry of CAMP_CONVERSATION_PLAN) {
    assert.equal(getCampConversationPlan(entry.pairId), entry);
    entry.conversations.forEach((conversation, index) => {
      assert.equal(conversation.sequence, index + 1);
      assert.equal(conversation.id, `camp-${entry.pairId}-${String(index + 1).padStart(2, '0')}`);
    });
  }
});

test('validator rejects empty, out-of-scope, and malformed packs', () => {
  assert.equal(validateCampConversationPack([], { expectedPairIds: CAMP_CONVERSATION_GROUPS.early }).ok, false);
  const malformed = [{
    id: 'wrong', pairId: 'ren-aya', sequence: 1, unlockAfterBeatId: 'p05-archive-promise', campId: 'roadside-lantern',
    title: 'TODO', theme: 'placeholder', dialogue: [], choice: { prompt: '', options: [] }, invented: true,
  }];
  const result = validateCampConversationPack(malformed, { expectedPairIds: ['ren-aya'] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /Expected 6|exactly|plan|borrowed|40 main lines|two options/);
});
