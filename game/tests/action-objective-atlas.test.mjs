import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createActionCampaignBattleSession,
  snapshotActionCampaignBattle,
} from '../action-campaign-battle-model.mjs';
import {
  ACTION_OBJECTIVE_ANCHOR_KIND_BY_STAGE_KIND,
  ACTION_OBJECTIVE_ATLAS,
  ACTION_OBJECTIVE_FALLBACK_ANCHOR_IDS,
  ACTION_OBJECTIVE_KINDS,
  ACTION_OBJECTIVE_KIND_IDS,
  actionObjectiveImageHasExpectedSize,
  createActionObjectiveArtView,
  getActionObjectiveAnchorKind,
  getActionObjectiveFrame,
  getActionObjectiveLabel,
  getActionObjectiveObjectKind,
  getActionObjectiveTokenKind,
  resolveActionObjectiveAnchorArt,
  resolveActionObjectiveObjectArt,
  resolveActionObjectiveTokenArt,
} from '../action-objective-atlas.mjs';
import { getActionStage } from '../action-stages.mjs';
import { createAdvancementState, preparePartyForEncounter } from '../advancement.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import { getFieldInteractionCopy } from '../content/field-interaction-copy.mjs';
import { createLoadoutState } from '../loadout.mjs';
import { getObjectiveActionPresentation } from '../objective-presentation.mjs';

function liveSession(encounterId) {
  return createActionCampaignBattleSession({
    encounterId,
    advancementState: preparePartyForEncounter(createAdvancementState(), encounterId),
    loadoutState: createLoadoutState(),
    fighterActorIds: ['lise', 'mateus'],
  });
}

function sessionView(session, overrides = {}) {
  const snapshot = snapshotActionCampaignBattle(session);
  return createActionObjectiveArtView({
    contractRequirements: session.objectiveContract.requirements,
    requirementProgress: snapshot.objective.requirements,
    entities: snapshot.objective.entities,
    outcome: session.outcome,
    maxBellCount: session.encounter.objective?.maxBossCounts ?? 0,
    ...overrides,
  });
}

function view(contractRequirements, progress = [], extra = {}) {
  return createActionObjectiveArtView({ contractRequirements, requirementProgress: progress, ...extra });
}

test('atlas addresses every kind and state, and rejects unknown pairs and wrong-size rasters', () => {
  assert.deepEqual(ACTION_OBJECTIVE_ATLAS, {
    id: 'action-objective-suite-v1',
    url: './assets/art/action-objective-suite-v1/action-objective-atlas-v1.png',
    cellWidth: 64, cellHeight: 80, columns: 5, rows: 28, width: 320, height: 2240,
    pivotX: 32, pivotY: 77, drawScale: 1.75,
  });
  assert.equal(ACTION_OBJECTIVE_KINDS.length, ACTION_OBJECTIVE_ATLAS.rows);
  const rects = new Set();
  ACTION_OBJECTIVE_KINDS.forEach((entry, row) => {
    assert.ok(entry.states.length <= ACTION_OBJECTIVE_ATLAS.columns);
    entry.states.forEach((state, column) => {
      const frame = getActionObjectiveFrame(entry.id, state);
      assert.equal(Object.isFrozen(frame), true);
      assert.deepEqual(
        [frame.x, frame.y, frame.width, frame.height, frame.pivotX, frame.pivotY, frame.scale],
        [column * 64, row * 80, 64, 80, 32, 77, 1.75],
      );
      assert.ok(frame.visualHeight > 0 && frame.visualHeight <= 78);
      rects.add(`${frame.x},${frame.y}`);
    });
  });
  assert.equal(rects.size, ACTION_OBJECTIVE_KINDS.reduce((sum, { states }) => sum + states.length, 0));
  assert.equal(getActionObjectiveFrame('unknown-kind', 'idle'), null);
  assert.equal(getActionObjectiveFrame('river-gate', 'unknown-state'), null);
  assert.equal(getActionObjectiveFrame('river-gate', undefined), null);
  assert.equal(actionObjectiveImageHasExpectedSize(null), false);
  assert.equal(actionObjectiveImageHasExpectedSize({ naturalWidth: 0, naturalHeight: 0 }), false);
  assert.equal(actionObjectiveImageHasExpectedSize({ naturalWidth: 320, naturalHeight: 2239 }), false);
  assert.equal(actionObjectiveImageHasExpectedSize({ naturalWidth: 321, naturalHeight: 2240 }), false);
  assert.equal(actionObjectiveImageHasExpectedSize({ naturalWidth: 320, naturalHeight: 2240 }), true);
});

test('every objective anchor, object, and token in all 23 encounters maps to a frame or explicit fallback', () => {
  assert.equal(ENCOUNTERS.length, 23);
  assert.deepEqual(ACTION_OBJECTIVE_FALLBACK_ANCHOR_IDS, []);
  const seenKinds = new Set();
  let anchorCount = 0;
  let entityCount = 0;
  for (const encounter of ENCOUNTERS) {
    const session = liveSession(encounter.id);
    const snapshot = snapshotActionCampaignBattle(session);
    const artView = sessionView(session);
    for (const anchor of getActionStage(encounter.levelId).objectiveAnchors) {
      anchorCount += 1;
      const resolved = resolveActionObjectiveAnchorArt(anchor, artView);
      if (ACTION_OBJECTIVE_FALLBACK_ANCHOR_IDS.includes(anchor.id)) continue;
      if (resolved.owner === 'entity') {
        const object = snapshot.objective.entities.objects.find(({ id }) => id === anchor.id);
        assert.ok(object, `${encounter.id}:${anchor.id} entity owner must exist`);
        assert.ok(resolveActionObjectiveObjectArt(object, artView).frame, `${encounter.id}:${anchor.id} entity frame`);
        continue;
      }
      assert.ok(resolved.frame, `${encounter.id}:${anchor.id} (${anchor.kind}) needs a sprite frame`);
      seenKinds.add(resolved.kind);
    }
    for (const object of snapshot.objective.entities?.objects ?? []) {
      entityCount += 1;
      const resolved = resolveActionObjectiveObjectArt(object, artView);
      assert.ok(resolved.frame, `${encounter.id}:${object.id} object frame`);
      assert.ok(resolved.label, `${encounter.id}:${object.id} object label`);
      seenKinds.add(resolved.kind);
    }
    for (const token of snapshot.objective.entities?.tokens ?? []) {
      entityCount += 1;
      const resolved = resolveActionObjectiveTokenArt(token, artView);
      assert.ok(resolved.frame, `${encounter.id}:${token.id} token frame`);
      assert.ok(resolved.label, `${encounter.id}:${token.id} token label`);
      seenKinds.add(resolved.kind);
    }
  }
  assert.ok(anchorCount >= 50);
  assert.ok(entityCount >= 15);
  assert.deepEqual([...seenKinds].sort(), [...ACTION_OBJECTIVE_KIND_IDS].sort(), 'every authored kind is used by content');
  for (const stageKind of Object.keys(ACTION_OBJECTIVE_ANCHOR_KIND_BY_STAGE_KIND)) {
    assert.ok(ACTION_OBJECTIVE_KIND_IDS.includes(ACTION_OBJECTIVE_ANCHOR_KIND_BY_STAGE_KIND[stageKind]));
  }
  assert.equal(getActionObjectiveAnchorKind({ id: 'mystery', kind: 'object' }), null);
  assert.equal(getActionObjectiveAnchorKind({ id: 'mystery', kind: 'interaction' }), null);
  assert.equal(getActionObjectiveObjectKind({ id: 'mystery-scenery' }), null);
});

test('unknown kinds resolve to null frames so the page keeps its rectangle fallback', () => {
  const empty = view([]);
  const anchor = resolveActionObjectiveAnchorArt({ id: 'mystery', kind: 'interaction', x: 0, y: 0 }, empty);
  assert.equal(anchor.owner, 'anchor');
  assert.equal(anchor.frame, null);
  const object = resolveActionObjectiveObjectArt({ id: 'mystery', hp: 1, maxHp: 1, attackable: false, destroyed: false }, empty);
  assert.equal(object.frame, null);
  const objectView = createActionObjectiveArtView({ entities: { objects: [{ id: 'mystery', hp: 1, maxHp: 1 }], tokens: [] } });
  const hosted = resolveActionObjectiveAnchorArt({ id: 'mystery', kind: 'object' }, objectView);
  assert.equal(hosted.owner, 'anchor', 'an unknown entity leaves its anchor on the fallback');
  assert.equal(hosted.frame, null);
});

test('anchor presentation states follow objective authority without deciding it', () => {
  const gate = { id: 'river-exit', kind: 'exit' };
  const reach = [{ id: 'reach-exit', semantics: 'overlap', anchorIds: ['river-exit'] }];
  assert.equal(resolveActionObjectiveAnchorArt(gate, view(reach, [{ id: 'reach-exit', available: false }])).state, 'locked');
  assert.equal(resolveActionObjectiveAnchorArt(gate, view(reach, [{ id: 'reach-exit', available: true }])).state, 'open');
  assert.equal(resolveActionObjectiveAnchorArt(gate, view(reach, [{ id: 'reach-exit', completed: true }])).state, 'complete');
  const spirit = { id: 'spirit-exit', kind: 'extraction' };
  assert.equal(resolveActionObjectiveAnchorArt(spirit, view([])).state, 'locked');
  assert.equal(resolveActionObjectiveAnchorArt(spirit, view([], [], { outcome: 'victory' })).state, 'open');

  const relay = { id: 'lantern-relay-west', kind: 'relay' };
  const cast = [{ id: 'relay:lantern-relay-west', semantics: 'cast-count', anchorIds: ['lantern-relay-west'], durationMs: 1000 }];
  assert.equal(resolveActionObjectiveAnchorArt(relay, view(cast)).state, 'dark');
  const charging = resolveActionObjectiveAnchorArt(relay, view(cast, [{ id: 'relay:lantern-relay-west', castElapsedMs: 250, castDurationMs: 1000 }]));
  assert.equal(charging.state, 'charging');
  assert.equal(charging.progress, 0.25);
  assert.equal(resolveActionObjectiveAnchorArt(relay, view(cast, [{ id: 'relay:lantern-relay-west', complete: true }])).state, 'lit');
  assert.equal(resolveActionObjectiveAnchorArt(relay, view([])).state, 'dark', 'decorative relays stay dark');

  const boat = { id: 'boat-exit', kind: 'escort-exit' };
  const escort = ['witness-a', 'witness-b'].map((id) => ({ id: `escort:${id}`, semantics: 'overlap', anchorIds: ['boat-exit'] }));
  assert.equal(resolveActionObjectiveAnchorArt(boat, view(escort)).state, 'waiting');
  assert.equal(resolveActionObjectiveAnchorArt(boat, view(escort, [{ id: 'escort:witness-a', complete: true }])).state, 'boarding');
  assert.equal(resolveActionObjectiveAnchorArt(boat, view(escort, escort.map(({ id }) => ({ id, complete: true })))).state, 'complete');

  const post = { id: 'prisoner-a', kind: 'prisoner' };
  const chained = createActionObjectiveArtView({ entities: { objects: [], tokens: [{ id: 'prisoner-a', released: false }] } });
  const freed = createActionObjectiveArtView({ entities: { objects: [], tokens: [{ id: 'prisoner-a', released: true }] } });
  assert.equal(resolveActionObjectiveAnchorArt(post, chained).state, 'chained');
  assert.equal(resolveActionObjectiveAnchorArt(post, freed).state, 'broken');
  assert.equal(resolveActionObjectiveAnchorArt(post, freed).label, null, 'chain posts carry no tag');

  const exitArch = { id: 'prisoner-exit', kind: 'extraction' };
  const countdown = resolveActionObjectiveAnchorArt(exitArch, createActionObjectiveArtView({
    entities: { objects: [], tokens: [], bellCount: 2 }, maxBellCount: 4,
  }));
  assert.deepEqual(countdown.countdown, { filled: 2, total: 4 });

  const dais = { id: 'blood-ward-west', kind: 'object' };
  const breakWard = [{ id: 'break:blood-ward-west', semantics: 'event-count', anchorIds: [] }];
  assert.equal(resolveActionObjectiveAnchorArt(dais, view(breakWard)).state, 'dormant');
  assert.equal(resolveActionObjectiveAnchorArt(dais, view(breakWard, [], { aliveTemplateIds: ['blood-ward-west'] })).state, 'active');
  assert.equal(resolveActionObjectiveAnchorArt(dais, view(breakWard, [{ id: 'break:blood-ward-west', completed: true }])).state, 'broken');

  const node = { id: 'north-node', kind: 'object' };
  assert.equal(resolveActionObjectiveAnchorArt(node, view([])).state, 'dormant', 'nodes without requirements are dormant scenery');
  const lantern = { id: 'tower-lantern', kind: 'interaction' };
  const interact = [{ id: 'interact:tower-lantern', semantics: 'interact', anchorIds: ['tower-lantern'] }];
  assert.equal(resolveActionObjectiveAnchorArt(lantern, view(interact)).state, 'unlit');
  assert.equal(resolveActionObjectiveAnchorArt(lantern, view(interact, [{ id: 'interact:tower-lantern', complete: true }])).state, 'lit');
});

test('objects and tokens expose damage, destruction, escort, and incapacitation states with pips', () => {
  const core = (hp, destroyed = false) => resolveActionObjectiveObjectArt({ id: 'archive-core', hp, maxHp: 6, protected: true, attackable: false, destroyed });
  assert.deepEqual([6, 5, 4, 3, 1].map((hp) => core(hp).state), ['intact', 'damaged', 'damaged', 'critical', 'critical']);
  assert.equal(core(0, true).state, 'destroyed');
  assert.deepEqual(core(4).pips, { filled: 4, total: 6 });
  assert.equal(core(4).urgent, true);
  const block = (hp, destroyed = false) => resolveActionObjectiveObjectArt({ id: 'print-block-b', hp, maxHp: 3, protected: true, destroyed });
  assert.deepEqual([3, 2, 1].map((hp) => block(hp).state), ['intact', 'damaged', 'cracked']);
  assert.equal(block(0, true).state, 'destroyed');
  const courier = resolveActionObjectiveObjectArt({ id: 'courier', hp: 2, maxHp: 3, protected: true, destroyed: false });
  assert.equal(courier.state, 'hurt');
  const node = resolveActionObjectiveObjectArt({ id: 'east-node', hp: 1, maxHp: 1, attackable: true, destroyed: false });
  assert.equal(node.kind, 'bell-node');
  assert.equal(node.state, 'active');
  assert.equal(node.pips, null, 'single-hit nodes show no pip row');
  assert.equal(resolveActionObjectiveObjectArt({ id: 'east-node', hp: 0, maxHp: 1, attackable: true, destroyed: true }).state, 'broken');

  assert.deepEqual(['witness-a', 'witness-b', 'prisoner-c'].map((id) => getActionObjectiveTokenKind({ id })), ['civilian-a', 'civilian-b', 'civilian-c']);
  assert.match(getActionObjectiveTokenKind({ id: 'released-spirit' }), /^civilian-[abc]$/u);
  const token = (fields) => ({ id: 'witness-a', hp: 3, maxHp: 3, released: true, recruited: true, secured: false, ...fields });
  assert.equal(resolveActionObjectiveTokenArt(token({ released: false })).state, 'bound');
  assert.equal(resolveActionObjectiveTokenArt(token({})).state, 'idle');
  assert.equal(resolveActionObjectiveTokenArt(token({}), null, { moving: true, nowMs: 0 }).state, 'walk');
  assert.equal(resolveActionObjectiveTokenArt(token({}), null, { moving: true, nowMs: 180 }).state, 'idle');
  assert.equal(resolveActionObjectiveTokenArt(token({}), null, { moving: true, nowMs: 180, reducedMotion: true }).state, 'walk');
  assert.equal(resolveActionObjectiveTokenArt(token({ secured: true })).state, 'safe');
  assert.equal(resolveActionObjectiveTokenArt(token({ hp: 0 })).state, 'down');
  assert.deepEqual(resolveActionObjectiveTokenArt(token({ hp: 2 })).pips, { filled: 2, total: 3 });
});

test('tags use authored human labels instead of raw ids', () => {
  assert.equal(getActionObjectiveLabel('testimony-table').full, getFieldInteractionCopy('epi-hoshigawa-archive', 'testimony-table').label);
  assert.equal(getActionObjectiveLabel('corrections-shelf').full, getFieldInteractionCopy('epi-hoshigawa-archive', 'corrections-shelf').label);
  assert.equal(getActionObjectiveLabel('unfiled-names').full, getFieldInteractionCopy('epi-hoshigawa-archive', 'unfiled-names').label);
  for (const [id, action] of [['river-exit', 'exit'], ['orders-ledger', 'disableOrders'], ['archive-core', 'evacuate'], ['net-anchor-1', 'clearAnchor']]) {
    assert.equal(getActionObjectiveLabel(id).full.toLowerCase(), getObjectiveActionPresentation(action).noun.toLowerCase(), id);
  }
  for (const encounter of ENCOUNTERS) {
    for (const anchor of getActionStage(encounter.levelId).objectiveAnchors) {
      const label = getActionObjectiveLabel(anchor.id);
      const kindId = getActionObjectiveAnchorKind(anchor);
      if (['chain-post', 'shelter-crates'].includes(kindId)) continue;
      assert.ok(label, `${anchor.id} needs a readable label`);
      assert.notEqual(label.full.toLowerCase(), anchor.id, `${anchor.id} must not reuse the raw id`);
      assert.ok(label.short.length <= label.full.length);
    }
  }
});
