import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTION_COMBAT_SNAPSHOT_VERSION } from '../action-combat.mjs';
import {
  ACTION_OBJECTIVE_TYPES,
  adaptActionObjective,
} from '../action-objectives.mjs';
import {
  ACTION_OBJECTIVE_RUNTIME_SCHEMA_VERSION,
  ActionObjectiveRuntime,
  createActionObjectiveRuntime,
} from '../action-objective-runtime.mjs';
import { getActionStage } from '../action-stages.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';

function encounter(id) {
  return ENCOUNTERS.find((entry) => entry.id === id);
}

function runtime(id) {
  return createActionObjectiveRuntime({ contract: adaptActionObjective(encounter(id)) });
}

function actor(id, faction, hp, maxHp, x, y, extra = {}) {
  return { id, faction, hp, maxHp, position: { x, y }, ...extra };
}

function kernelSnapshot(nowMs, actors, outcome = null) {
  return {
    schemaVersion: ACTION_COMBAT_SNAPSHOT_VERSION,
    nowMs,
    outcome,
    actors,
  };
}

function requirement(snapshot, id) {
  return snapshot.requirements.find((entry) => entry.id === id);
}

test('every authored contract and all 18 objective types instantiate as immutable pending runtimes', () => {
  const types = new Set();
  for (const source of ENCOUNTERS) {
    const contract = adaptActionObjective(source);
    const objective = new ActionObjectiveRuntime({
      contract,
      stage: getActionStage(source.levelId),
    });
    const snapshot = objective.snapshot();
    types.add(snapshot.objectiveType);
    assert.equal(snapshot.schemaVersion, ACTION_OBJECTIVE_RUNTIME_SCHEMA_VERSION, source.id);
    assert.equal(snapshot.status, 'pending', source.id);
    assert.equal(snapshot.requirements.length, contract.requirements.length, source.id);
    assert.equal(Object.isFrozen(snapshot), true, source.id);
    assert.equal(Object.isFrozen(snapshot.requirements), true, source.id);
    assert.equal(Object.isFrozen(snapshot.requirements[0]), true, source.id);
    assert.equal(objective.result(), null, source.id);
  }
  assert.deepEqual([...types].sort(), [...ACTION_OBJECTIVE_TYPES].sort());
});

test('surviveThenExit derives enemy completed actions and only latches the exit after survival', () => {
  const objective = runtime('prologue-ashen-bailiff');
  const stage = getActionStage('hsh-census-square');
  const exit = stage.objectiveAnchors.find(({ id }) => id === 'river-exit');
  const atExit = [
    actor('ren', 'player', 100, 100, exit.x, exit.y),
    actor('ashen-bailiff-1', 'enemy', 100, 100, 700, stage.groundY),
  ];

  let snapshot = objective.advance({
    kernelSnapshot: kernelSnapshot(20, atExit),
    events: [{ sequence: 1, type: 'attack-complete', nowMs: 20, actorId: 'ashen-bailiff-1' }],
  });
  assert.equal(requirement(snapshot, 'survive-enemy-actions').value, 1);
  assert.equal(requirement(snapshot, 'reach-exit').completed, false, 'locked overlap is not latched');

  const away = atExit.map((entry) => entry.id === 'ren'
    ? { ...entry, position: { x: 200, y: stage.groundY } }
    : entry);
  snapshot = objective.advance({
    kernelSnapshot: kernelSnapshot(60, away),
    events: [
      { sequence: 2, type: 'attack-complete', nowMs: 40, actorId: 'ashen-bailiff-1' },
      { sequence: 3, type: 'attack-complete', nowMs: 60, actorId: 'ashen-bailiff-1' },
    ],
  });
  assert.equal(requirement(snapshot, 'survive-enemy-actions').completed, true);
  assert.equal(requirement(snapshot, 'reach-exit').available, true);
  assert.equal(snapshot.status, 'pending');

  snapshot = objective.advance({ kernelSnapshot: kernelSnapshot(80, atExit) });
  assert.equal(snapshot.status, 'completed');
  assert.deepEqual(objective.result(), {
    schemaVersion: ACTION_OBJECTIVE_RUNTIME_SCHEMA_VERSION,
    encounterId: 'prologue-ashen-bailiff',
    objectiveType: 'surviveThenExit',
    outcome: 'success',
    status: 'completed',
    failureId: null,
    resolvedAtMs: 80,
  });
  assert.equal(Object.isFrozen(objective.result()), true);
});

test('Mateus threshold-or-wards completes through either live HP projection or both explicit objects', () => {
  const stage = getActionStage('tkm-bell-chamber');
  const rosterAt = (hp) => [
    actor('ren', 'player', 100, 100, 150, stage.groundY),
    actor('mateus-1', 'enemy', hp, 100, 760, stage.groundY),
  ];

  const threshold = runtime('fp1-mateus');
  let snapshot = threshold.advance({ kernelSnapshot: kernelSnapshot(0, rosterAt(21)) });
  assert.equal(snapshot.status, 'pending');
  snapshot = threshold.advance({ kernelSnapshot: kernelSnapshot(20, rosterAt(20)) });
  assert.equal(requirement(snapshot, 'boss-hp-threshold').completed, true);
  assert.equal(snapshot.status, 'completed');

  const wards = runtime('fp1-mateus');
  snapshot = wards.advance({
    kernelSnapshot: kernelSnapshot(20, rosterAt(100)),
    events: [
      { type: 'objective-object-destroyed', objectId: 'blood-ward-west' },
      { type: 'objective-object-destroyed', objectId: 'blood-ward-east' },
    ],
  });
  assert.equal(requirement(snapshot, 'boss-hp-threshold').completed, false);
  assert.equal(requirement(snapshot, 'break:blood-ward-west').completed, true);
  assert.equal(requirement(snapshot, 'break:blood-ward-east').completed, true);
  assert.equal(snapshot.status, 'completed');
});

test('prisoners require interact-before-extract and four completed boss casts fail the countdown', () => {
  const stage = getActionStage('hsh-bell-aqueduct');
  const exit = stage.objectiveAnchors.find(({ id }) => id === 'prisoner-exit');
  const ren = actor('ren', 'player', 100, 100, 400, stage.groundY);
  const prisoners = ['prisoner-a', 'prisoner-b', 'prisoner-c'].map((tokenId) => ({
    kind: 'objective-token',
    tokenId,
    position: { x: exit.x, y: exit.y },
  }));

  const extraction = runtime('c7-bell-warden-chiyo');
  let snapshot = extraction.advance({
    kernelSnapshot: kernelSnapshot(0, [ren]),
    subjects: prisoners,
  });
  assert.equal(snapshot.requirements.every(({ completed }) => !completed), true);

  for (const tokenId of ['prisoner-a', 'prisoner-b', 'prisoner-c']) {
    snapshot = extraction.advance({
      interactions: [{ actionId: 'break-chain', anchorId: tokenId, actorId: 'ren' }],
      subjects: prisoners,
    });
    assert.equal(requirement(snapshot, `release:${tokenId}`).completed, true);
    assert.equal(requirement(snapshot, `extract:${tokenId}`).completed, true);
  }
  assert.equal(snapshot.status, 'completed');

  const countdown = runtime('c7-bell-warden-chiyo');
  countdown.advance({ kernelSnapshot: kernelSnapshot(0, [ren]) });
  snapshot = countdown.advance({
    events: [1, 2, 3].map((sequence) => ({ sequence, type: 'boss-cast-completed', castId: 'bell-count' })),
  });
  assert.equal(snapshot.status, 'pending');
  snapshot = countdown.advance({
    events: [{ sequence: 4, type: 'boss-cast-completed', castId: 'bell-count' }],
  });
  assert.equal(snapshot.status, 'failed');
  assert.equal(snapshot.result.failureId, 'bell-count-complete');
});

test('cast-count timers require an uninterrupted matching cast at each authored anchor', () => {
  const objective = runtime('c4-fog-nets');
  const stage = getActionStage('ngi-tide-caves');
  const ren = actor('ren', 'player', 100, 100, 200, stage.groundY);
  objective.advance({ kernelSnapshot: kernelSnapshot(0, [ren]) });

  let snapshot = objective.advance({
    kernelSnapshot: kernelSnapshot(600, [ren]),
    casts: [{ castId: 'clear-fog-anchor', anchorId: 'net-anchor-1', actorId: 'ren' }],
  });
  assert.equal(requirement(snapshot, 'clear:net-anchor-1').castElapsedMs, 600);
  snapshot = objective.advance({
    kernelSnapshot: kernelSnapshot(700, [ren]),
    casts: [{ castId: 'clear-fog-anchor', anchorId: 'net-anchor-1', actorId: 'ren', state: 'interrupted' }],
  });
  assert.equal(requirement(snapshot, 'clear:net-anchor-1').castElapsedMs, 0);

  for (const [index, anchorId] of ['net-anchor-1', 'net-anchor-2', 'net-anchor-3'].entries()) {
    const nowMs = 1_600 + index * 900;
    snapshot = objective.advance({
      kernelSnapshot: kernelSnapshot(nowMs, [ren]),
      casts: [{ castId: 'clear-fog-anchor', anchorId, actorId: 'ren' }],
    });
    assert.equal(requirement(snapshot, `clear:${anchorId}`).completed, true);
  }
  assert.equal(snapshot.status, 'completed');
});

test('protected objects only accept intact checkpoints after survival and failures win the same batch', () => {
  const objective = runtime('c6-masked-clerks');
  const stage = getActionStage('kzu-archive-roof');
  const roster = [
    actor('ren', 'player', 100, 100, 150, stage.groundY),
    actor('masked-clerk-1', 'enemy', 100, 100, 750, stage.groundY),
  ];
  const intact = ['courier', 'print-block-a', 'print-block-b', 'print-block-c']
    .map((objectId) => ({ type: 'objective-object-intact-at-checkpoint', objectId }));

  let snapshot = objective.advance({
    kernelSnapshot: kernelSnapshot(0, roster),
    events: intact,
  });
  assert.equal(snapshot.requirements.filter(({ id }) => id.startsWith('intact:')).every(({ value }) => value === 0), true);

  const turns = adaptActionObjective(encounter('c6-masked-clerks')).requirements
    .find(({ id }) => id === 'survive-enemy-actions').count;
  snapshot = objective.advance({
    kernelSnapshot: kernelSnapshot(turns * 20, roster),
    events: Array.from({ length: turns }, (_, index) => ({
      sequence: index + 1,
      type: 'attack-complete',
      actorId: 'masked-clerk-1',
    })),
  });
  assert.equal(requirement(snapshot, 'survive-enemy-actions').completed, true);
  snapshot = objective.advance({ events: intact });
  assert.equal(snapshot.status, 'completed');

  const failed = runtime('c6-masked-clerks');
  snapshot = failed.advance({
    kernelSnapshot: kernelSnapshot(20, roster),
    events: [
      { type: 'objective-object-destroyed', objectId: 'print-block-a' },
      { type: 'objective-object-destroyed', objectId: 'print-block-b' },
      ...intact,
      ...Array.from({ length: turns }, (_, index) => ({
        sequence: index + 1,
        type: 'attack-complete',
        actorId: 'masked-clerk-1',
      })),
    ],
  });
  assert.equal(snapshot.status, 'failed');
  assert.equal(snapshot.result.failureId, 'two-print-blocks-destroyed');
});

test('malformed contracts, snapshots, and semantic inputs fail closed without false progress', () => {
  const contract = adaptActionObjective(encounter('c4-fog-nets'));
  assert.throws(
    () => createActionObjectiveRuntime({ contract: { ...contract, schemaVersion: 999 } }),
    /Invalid action objective contract/u,
  );

  const objective = runtime('c4-fog-nets');
  const before = objective.snapshot();
  assert.throws(
    () => objective.advance({ kernelSnapshot: { schemaVersion: 999, nowMs: 20, actors: [] } }),
    /Unsupported action kernel snapshot schema/u,
  );
  assert.deepEqual(objective.snapshot(), before);
  assert.throws(
    () => objective.advance({ subjects: [{ kind: 'mystery', position: { x: 0, y: 0 } }] }),
    /unsupported kind/u,
  );
  assert.deepEqual(objective.snapshot(), before);
  const snapshot = objective.advance({
    interactions: [{ actionId: 'clear-fog-anchor', anchorId: 'net-anchor-1' }],
  });
  assert.equal(snapshot.status, 'pending');
  assert.equal(snapshot.requirements.every(({ value }) => value === 0), true);
});
