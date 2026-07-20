import assert from 'node:assert/strict';
import test from 'node:test';

import { LEVELS, LEVEL_SCHEMA_VERSION, getLevel } from '../content/levels.mjs';
import { resolveFieldCharacterPresentation } from '../field-character-presentation.mjs';

const typed = LEVELS.flatMap((level) => (level.interactables ?? [])
  .filter(({ fieldCharacter }) => fieldCharacter)
  .map((interactable) => ({ levelId: level.id, interactable })));

const keysFor = (predicate) => typed
  .filter(({ interactable }) => predicate(interactable.fieldCharacter))
  .map(({ levelId, interactable }) => `${levelId}/${interactable.id}`)
  .sort();

test('level schema publishes exactly the audited field-character set', () => {
  assert.equal(LEVEL_SCHEMA_VERSION, 2);
  assert.equal(typed.length, 18);
  assert.deepEqual(keysFor(({ kind, role }) => kind === 'npc' && role === 'speaker'), [
    'c1-ferry-landing/dock-worker',
    'c1-ferry-landing/ferry-captain',
    'c1-ferry-landing/market-seller',
    'hsh-post-town/former-retainer',
    'kgr-requisition-town/resident-kitchen',
    'ngi-fishing-village/kiku-remedy-basket',
    'sdg-customs-house/clerk-desk',
    'sdg-market-lane/printer-stall',
    'sdg-market-lane/trade-broker',
  ]);
  assert.deepEqual(keysFor(({ kind, role }) => kind === 'npc' && role === 'confined-person'), [
    'tkm-abandoned-chapel/prisoner-grate-east',
    'tkm-abandoned-chapel/prisoner-grate-west',
  ]);
  assert.deepEqual(keysFor(({ kind, role }) => kind === 'npc' && role === 'courier'), [
    'kzu-archive-roof/courier',
  ]);
  assert.deepEqual(keysFor(({ kind }) => kind === 'party'), [
    'krh-blood-conservatory/aya-offer',
    'krh-blood-conservatory/genta-offer',
    'krh-blood-conservatory/kiku-offer',
    'krh-blood-conservatory/lise-offer',
    'krh-blood-conservatory/mateus-offer',
    'krh-blood-conservatory/ren-offer',
  ]);
});

test('the six refusal actors resolve through exact party metadata', () => {
  const offers = getLevel('krh-blood-conservatory').interactables;
  for (const offer of offers) {
    assert.deepEqual(offer.fieldCharacter, { kind: 'party', memberId: offer.actor, facing: 'south' });
    assert.deepEqual(resolveFieldCharacterPresentation(offer.fieldCharacter), offer.fieldCharacter);
  }
});

test('resolver fails closed without structured metadata and never guesses a person', () => {
  for (const record of [
    null,
    'speaker',
    { kind: 'npc' },
    { kind: 'npc', role: 'unknown' },
    { kind: 'party', memberId: 'ren' },
    { kind: 'party', memberId: 'unknown', facing: 'south' },
    { kind: 'party', memberId: 'ren', facing: 'north-east' },
    { id: 'courier', action: 'escort', label: 'person' },
  ]) assert.equal(resolveFieldCharacterPresentation(record), null);

  const witnessCircle = getLevel('krh-audience-hall').interactables.find(({ id }) => id === 'witness-circle');
  assert.equal(witnessCircle.fieldCharacter, undefined);
  assert.equal(resolveFieldCharacterPresentation(witnessCircle.fieldCharacter), null);

  const typedTalks = LEVELS.flatMap(({ interactables = [] }) => interactables)
    .filter(({ action, fieldCharacter }) => action === 'talk' && fieldCharacter);
  assert.equal(typedTalks.length, 11);
  assert.equal(typedTalks.every(({ fieldCharacter }) => fieldCharacter.kind === 'npc'), true);
});
