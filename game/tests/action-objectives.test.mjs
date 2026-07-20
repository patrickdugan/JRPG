import test from 'node:test';
import assert from 'node:assert/strict';

import { ENCOUNTERS } from '../content/encounters.mjs';
import { getActionStage } from '../action-stages.mjs';
import {
  ACTION_OBJECTIVE_SEMANTICS,
  ACTION_OBJECTIVE_TYPES,
  adaptActionObjective,
  validateActionObjectiveContract,
} from '../action-objectives.mjs';

test('objective adapter type catalogue exactly covers current authored objective types', () => {
  const authoredTypes = [...new Set(ENCOUNTERS.map(({ objective }) => objective.type))].sort();
  assert.deepEqual([...ACTION_OBJECTIVE_TYPES].sort(), authoredTypes);
  assert.equal(ACTION_OBJECTIVE_TYPES.length, 18);
});

test('every current encounter produces a valid frozen real-time objective contract', () => {
  const encounteredSemantics = new Set();
  for (const encounter of ENCOUNTERS) {
    const stage = getActionStage(encounter.levelId);
    const contract = adaptActionObjective(encounter);
    assert.deepEqual(validateActionObjectiveContract(contract, stage), [], encounter.id);
    assert.equal(contract.encounterId, encounter.id);
    assert.equal(contract.levelId, encounter.levelId);
    assert.equal(contract.objectiveType, encounter.objective.type);
    assert.equal(Object.isFrozen(contract), true, encounter.id);
    for (const requirement of contract.requirements) {
      encounteredSemantics.add(requirement.semantics);
      for (const anchorId of requirement.anchorIds ?? []) {
        assert.ok(stage.objectiveAnchors.some(({ id }) => id === anchorId), `${encounter.id}:${anchorId}`);
      }
    }
  }
  assert.deepEqual(encounteredSemantics, new Set(ACTION_OBJECTIVE_SEMANTICS));
});

test('survival escape is event-gated before an exact side-view exit overlap', () => {
  const encounter = ENCOUNTERS.find(({ id }) => id === 'prologue-ashen-bailiff');
  const contract = adaptActionObjective(encounter);
  assert.deepEqual(contract.requirements, [
    {
      id: 'survive-enemy-actions', semantics: 'event-count', count: 3, after: [],
      eventType: 'enemy-action-completed', match: { faction: 'enemy' },
    },
    {
      id: 'reach-exit', semantics: 'overlap', count: 1, after: ['survive-enemy-actions'],
      subject: { kind: 'actor', actorId: 'ren' }, anchorIds: ['river-exit'],
    },
  ]);
});

test('Mateus nonlethal objective keeps threshold OR both wards as explicit logic', () => {
  const encounter = ENCOUNTERS.find(({ id }) => id === 'fp1-mateus');
  const contract = adaptActionObjective(encounter);
  assert.deepEqual(contract.completion, {
    operator: 'any',
    clauses: [
      { operator: 'requirement', id: 'boss-hp-threshold' },
      {
        operator: 'all',
        clauses: [
          { operator: 'requirement', id: 'break:blood-ward-west' },
          { operator: 'requirement', id: 'break:blood-ward-east' },
        ],
      },
    ],
  });
  assert.equal(contract.requirements[0].match.ratio, 0.2);
});

test('prisoner objective requires deterministic interact then overlap chains', () => {
  const encounter = ENCOUNTERS.find(({ id }) => id === 'c7-bell-warden-chiyo');
  const contract = adaptActionObjective(encounter);
  assert.equal(contract.requirements.length, 6);
  for (const prisonerId of encounter.objective.targets) {
    const release = contract.requirements.find(({ id }) => id === `release:${prisonerId}`);
    const extract = contract.requirements.find(({ id }) => id === `extract:${prisonerId}`);
    assert.equal(release.semantics, 'interact');
    assert.deepEqual(release.anchorIds, [prisonerId]);
    assert.equal(extract.semantics, 'overlap');
    assert.deepEqual(extract.after, [release.id]);
    assert.deepEqual(extract.anchorIds, ['prisoner-exit']);
  }
  assert.ok(contract.failures.some(({ eventType, count }) => eventType === 'boss-cast-completed' && count === 4));
});

test('cast-count adapters retain authored anchor cardinality', () => {
  const fog = adaptActionObjective(ENCOUNTERS.find(({ id }) => id === 'c4-fog-nets'));
  assert.equal(fog.requirements.length, 3);
  assert.ok(fog.requirements.every(({ semantics, castId, durationMs }) => (
    semantics === 'cast-count' && castId === 'clear-fog-anchor' && durationMs === 900
  )));

  const relays = adaptActionObjective(ENCOUNTERS.find(({ id }) => id === 'c8-outer-court'));
  assert.deepEqual(relays.requirements.map(({ anchorIds }) => anchorIds[0]), [
    'lantern-relay-west', 'lantern-relay-east',
  ]);
});

test('name-slip return preserves tile provenance without using it as collision', () => {
  const encounter = ENCOUNTERS.find(({ id }) => id === 'c7-name-slip-release');
  const contract = adaptActionObjective(encounter);
  assert.deepEqual(contract.requirements[0], {
    id: 'return:name-slip', semantics: 'overlap', count: 1, after: [],
    subject: { kind: 'carried-item', itemId: 'name-slip' },
    anchorIds: ['flowing-water-a', 'flowing-water-b'], overlapMode: 'any-anchor',
  });
});

test('all authored failure strings adapt and unknown data fails clearly', () => {
  const authoredFailures = new Set();
  for (const encounter of ENCOUNTERS) {
    authoredFailures.add(encounter.objective.failure);
    assert.doesNotThrow(() => adaptActionObjective(encounter));
  }
  assert.equal(authoredFailures.size, 11);

  const base = ENCOUNTERS.find(({ id }) => id === 'c1-cinder-hounds');
  assert.throws(
    () => adaptActionObjective({ ...base, objective: { ...base.objective, type: 'mysteryObjective' } }),
    /Unsupported action objective type: mysteryObjective/u,
  );
  assert.throws(
    () => adaptActionObjective({ ...base, objective: { ...base.objective, failure: 'mystery-failure' } }),
    /Unsupported action objective failure contract: mystery-failure/u,
  );
  assert.throws(
    () => adaptActionObjective({ ...base, levelId: 'missing-stage' }),
    /Unsupported action stage levelId: missing-stage/u,
  );
});

test('mismatched stage and malformed objective cardinality cannot validate silently', () => {
  const escape = ENCOUNTERS.find(({ id }) => id === 'prologue-ashen-bailiff');
  assert.throws(
    () => adaptActionObjective(escape, { stage: getActionStage('c1-flooded-cedars') }),
    /requires stage hsh-census-square/u,
  );

  const relays = ENCOUNTERS.find(({ id }) => id === 'c8-outer-court');
  assert.throws(
    () => adaptActionObjective({ ...relays, objective: { ...relays.objective, relays: [] } }),
    /activateRelays needs relays/u,
  );
});
