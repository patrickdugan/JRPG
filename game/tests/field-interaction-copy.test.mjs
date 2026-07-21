import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  FIELD_INTERACTION_COPY,
  FIELD_INTERACTION_COPY_SCHEMA_VERSION,
  NEUTRAL_FIELD_INTERACTION_COPY,
  getFieldInteractionChoiceCopy,
  getFieldInteractionCopy,
} from '../content/field-interaction-copy.mjs';
import { LEVELS } from '../content/levels.mjs';

function deeplyFrozen(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((child) => deeplyFrozen(child, seen));
}

function visibleStrings(entry) {
  return [
    entry.label,
    entry.completion,
    entry.repeat,
    entry.blocked,
    ...entry.choices.flatMap((choice) => [choice.label, choice.completion]),
  ];
}

test('field interaction copy exactly covers all 115 authored interactables in level order', () => {
  const expected = LEVELS.flatMap((level) => (
    (level.interactables ?? []).map((interactable) => ({
      levelId: level.id,
      interactableId: interactable.id,
      options: interactable.options ?? [],
    }))
  ));
  const actual = FIELD_INTERACTION_COPY.entries;

  assert.equal(FIELD_INTERACTION_COPY_SCHEMA_VERSION, 1);
  assert.equal(FIELD_INTERACTION_COPY.schemaVersion, 1);
  assert.equal(FIELD_INTERACTION_COPY.locale, 'en');
  assert.equal(expected.length, 115);
  assert.equal(actual.length, expected.length);
  assert.deepEqual(
    actual.map(({ levelId, interactableId }) => ({ levelId, interactableId })),
    expected.map(({ levelId, interactableId }) => ({ levelId, interactableId })),
  );

  const keys = actual.map(({ levelId, interactableId }) => `${levelId}\u0000${interactableId}`);
  assert.equal(new Set(keys).size, 115, 'compound level/interactable keys must be unique');
  assert.equal(new Set(actual.map(({ copyKey }) => copyKey)).size, 115, 'copy keys must be unique');

  for (const [index, entry] of actual.entries()) {
    const expectedEntry = expected[index];
    assert.deepEqual(
      Object.keys(entry).sort(),
      ['blocked', 'choices', 'completion', 'copyKey', 'interactableId', 'label', 'levelId', 'repeat'].sort(),
      `${entry.copyKey} has an unexpected field shape`,
    );
    assert.equal(entry.copyKey, `field.${entry.levelId}.${entry.interactableId}`);
    for (const value of [entry.label, entry.completion, entry.repeat, entry.blocked]) {
      assert.equal(typeof value, 'string');
      assert.ok(value.trim().length > 0, `${entry.copyKey} has blank visible copy`);
    }
    assert.deepEqual(
      entry.choices.map(({ id }) => id),
      expectedEntry.options,
      `${entry.copyKey} choice IDs must exactly preserve runtime order`,
    );
    for (const choice of entry.choices) {
      assert.deepEqual(Object.keys(choice).sort(), ['completion', 'id', 'label']);
      assert.ok(choice.label.trim());
      assert.ok(choice.completion.trim());
    }
  }
});

test('catalogue and neutral fallback are deeply immutable and exact-only', () => {
  assert.equal(deeplyFrozen(FIELD_INTERACTION_COPY), true);
  assert.equal(deeplyFrozen(NEUTRAL_FIELD_INTERACTION_COPY), true);

  const strongbox = getFieldInteractionCopy('ngi-wrecked-carrack', 'reliquary-lock');
  assert.equal(strongbox.label, 'Dražanić Strongbox');
  assert.equal(getFieldInteractionCopy('ngi-wrecked-carrack', 'RELIQUARY-LOCK'), NEUTRAL_FIELD_INTERACTION_COPY);
  assert.equal(getFieldInteractionCopy('wrong-level', 'reliquary-lock'), NEUTRAL_FIELD_INTERACTION_COPY);
  assert.equal(getFieldInteractionCopy(null, 'reliquary-lock'), NEUTRAL_FIELD_INTERACTION_COPY);
  assert.equal(NEUTRAL_FIELD_INTERACTION_COPY.label, 'Interaction');
  assert.doesNotMatch(JSON.stringify(NEUTRAL_FIELD_INTERACTION_COPY), /wrong-level|reliquary-lock/u);

  const carePlan = getFieldInteractionCopy('ngi-wrecked-carrack', 'survivor-hold');
  assert.equal(getFieldInteractionChoiceCopy(carePlan, 'send-kiku').label, 'Ask Kiku to begin with the survivors');
  assert.equal(getFieldInteractionChoiceCopy(carePlan, 'SEND-KIKU'), null);
  assert.equal(getFieldInteractionChoiceCopy(strongbox, 'send-kiku'), null);
  assert.equal(getFieldInteractionChoiceCopy(null, 'send-kiku'), null);
});

test('visible field copy contains no machine slugs or superseded devotional-object wording', () => {
  for (const entry of FIELD_INTERACTION_COPY.entries) {
    const visible = visibleStrings(entry).join('\n');
    assert.doesNotMatch(visible, /_/u, `${entry.copyKey} exposes an underscore identifier`);
    if (entry.interactableId.includes('-')) {
      assert.ok(!visible.includes(entry.interactableId), `${entry.copyKey} exposes its raw interactable ID`);
    }
    assert.doesNotMatch(visible, /temple-charm-chest|reliquary-lock|send-kiku|keep-kiku/iu);
    assert.doesNotMatch(visible, /\bTemple Charm\b|\breliquary\b/iu);
  }

  assert.equal(getFieldInteractionCopy('tkm-cedar-service-path', 'temple-charm-chest').label, 'Tampered registry cache');
  assert.match(getFieldInteractionCopy('tkm-cedar-service-path', 'temple-charm-chest').completion, /Defaced Registry Token/u);
  assert.equal(getFieldInteractionCopy('sdg-market-lane', 'printer-stall').label, 'Sayo’s Print Stall');
  assert.equal(getFieldInteractionCopy('ngi-wrecked-carrack', 'reliquary-lock').label, 'Dražanić Strongbox');
});

test('Campaign uses exact presentation copy while retaining stable runtime IDs', () => {
  const source = readFileSync(new URL('../campaign.js', import.meta.url), 'utf8');
  const handlerStart = source.indexOf("interactFieldButton.addEventListener('click'");
  const handlerEnd = source.indexOf("fieldLeaderSelect.addEventListener('change'", handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);

  assert.match(source, /getFieldInteractionCopy\(level\.id, authored\?\.id\)/u);
  assert.match(source, /authoredCopy\.label/u);
  assert.match(handler, /getFieldInteractionCopy\(level\.id, nearby\.id\)/u);
  assert.match(handler, /performFieldInteraction\(fieldRuntimeState, nearby\.id/u);
  assert.match(handler, /getFieldInteractionChoiceCopy\(interactionCopy, choiceId\)/u);
  assert.match(handler, /getFieldInteractionChoiceCopy\(interactionCopy, event\?\.selectedOption\)/u);
  assert.match(handler, /interactionCopy\.blocked/u);
  assert.match(handler, /interactionCopy\.repeat/u);
  assert.match(handler, /selectedChoiceCopy\?\.completion \?\? interactionCopy\.completion/u);

  assert.doesNotMatch(handler, /`Choose for \$\{nearby\.id\}/u);
  assert.doesNotMatch(handler, /result\.choices\.join/u);
  assert.doesNotMatch(handler, /result\.blockedBy/u);
  assert.doesNotMatch(handler, /`\$\{nearby\.id\} (?:was|requires|:)/u);
  assert.doesNotMatch(handler, /event\?\.(?:text|result|action)/u);
});
