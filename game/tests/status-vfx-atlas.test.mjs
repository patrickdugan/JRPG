import test from 'node:test';
import assert from 'node:assert/strict';

import { createPartySkillTimeline } from '../battle-animation.mjs';
import {
  COMBAT_STATUS_DEFINITIONS,
  CampaignCombatEngine,
  PARTY_PROFILES,
} from '../campaign-combat.mjs';
import {
  STATUS_VFX_ATLAS,
  STATUS_VFX_SIGNAL_CONTRACT,
  STATUS_VFX_STATES,
  STATUS_VFX_STATUSES,
  getNewStatusVfxSignals,
  getPersistentStatusVfxMarkers,
  getStatusVfxFrame,
  hasAuthoredStatusVfx,
  resolveStatusGlyphVfx,
  statusVfxImageHasExpectedSize,
} from '../status-vfx-atlas.mjs';

const STATUS_IDS = ['dread', 'chill', 'shock', 'scorch', 'bound', 'overheated'];

function statusEngine(statusId) {
  return new CampaignCombatEngine({
    level: { id: 'status-vfx-test', width: 6, height: 6, blocked: [], terrain: [], spawn: { x: 0, y: 0 } },
    partyProfiles: { ren: { ...PARTY_PROFILES.ren, currentSpirit: 20 } },
    encounter: {
      id: `status-vfx-${statusId}`,
      levelId: 'status-vfx-test',
      format: 'battle',
      objective: { type: 'defeatAll', text: 'Defeat the test attacker.' },
      party: { roster: ['ren'], deployment: [{ actorId: 'ren', at: '1,3' }] },
      enemies: [{
        id: 'status-attacker', name: 'Status Attacker', count: 1, positions: ['2,3'],
        ledger: 'A deterministic status fixture.',
        stats: { hp: 500, power: 6, guard: 4, speed: 10 },
        resistances: {
          delivery: { cut: 1, pierce: 1, crush: 1, arcane: 1 },
          essence: { ember: 1, frost: 1, storm: 1, radiance: 1, umbral: 1 },
        },
        skills: [{
          id: `apply-${statusId}`, name: `Apply ${statusId}`, delivery: 'arcane', power: 4,
          range: 1, recoveryPulses: 2, dodgeable: false,
          effect: { status: statusId, duration: 'one-activation' },
        }],
      }],
    },
  });
}

test('status VFX atlas maps exactly the six live statuses across three reachable states', () => {
  assert.deepEqual(STATUS_VFX_STATUSES.map(({ id }) => id), STATUS_IDS);
  assert.deepEqual(STATUS_VFX_STATES.map(({ id }) => id), ['apply', 'active', 'expire']);
  assert.deepEqual([STATUS_VFX_ATLAS.columns, STATUS_VFX_ATLAS.rows], [3, 6]);
  assert.deepEqual([STATUS_VFX_ATLAS.width, STATUS_VFX_ATLAS.height], [96, 192]);
  assert.equal(STATUS_VFX_SIGNAL_CONTRACT.cleanse, null);
  const rects = new Set();
  for (const [row, statusId] of STATUS_IDS.entries()) {
    assert.equal(COMBAT_STATUS_DEFINITIONS[statusId].name, STATUS_VFX_STATUSES[row].name);
    assert.equal(hasAuthoredStatusVfx(statusId), true);
    for (const [column, state] of ['apply', 'active', 'expire'].entries()) {
      const frame = getStatusVfxFrame(statusId, state);
      assert.deepEqual([frame.row, frame.column, frame.x, frame.y], [row, column, column * 32, row * 32]);
      assert.equal(Object.isFrozen(frame), true);
      rects.add(`${frame.x},${frame.y},${frame.width},${frame.height}`);
    }
  }
  assert.equal(rects.size, 18);
  assert.equal(hasAuthoredStatusVfx('final-ward-open'), false);
  assert.equal(getStatusVfxFrame('unknown', 'active'), null);
});

test('already-gated status glyphs resolve to authored application frames', () => {
  for (const statusId of STATUS_IDS) {
    const timeline = createPartySkillTimeline('courier-cut', {
      sourceTile: { x: 1, y: 1 }, targetTile: { x: 2, y: 1 }, statusId,
    });
    const glyph = timeline.frames.find(({ statusGlyph }) => statusGlyph)?.statusGlyph;
    const resolved = resolveStatusGlyphVfx(glyph);
    assert.equal(resolved.statusId, statusId);
    assert.equal(resolved.frame.state, 'apply');
    assert.deepEqual(resolved.tile, glyph.tile);
    assert.equal(Object.isFrozen(resolved), true);
  }
  assert.equal(resolveStatusGlyphVfx(null), null);
  assert.equal(resolveStatusGlyphVfx({ id: 'unknown', tile: { x: 1, y: 1 } }), null);
});

test('real engine application, persistence, and expiry signals resolve without a cleanse fiction', () => {
  for (const statusId of STATUS_IDS) {
    const engine = statusEngine(statusId);
    assert.equal(engine.guard('ren').ok, true);
    const beforeApply = engine.snapshot();
    engine.advanceUntilPlayerCommand();
    const afterApply = engine.snapshot();
    const apply = getNewStatusVfxSignals(beforeApply, afterApply);
    assert.equal(apply.some((signal) => signal.eventType === 'status-applied'
      && signal.statusId === statusId && signal.frame.state === 'apply'), true);
    const markers = getPersistentStatusVfxMarkers(afterApply);
    assert.equal(markers.some((marker) => marker.actorId === 'ren'
      && marker.statusId === statusId && marker.frame.state === 'active'), true);

    assert.equal(engine.guard('ren').ok, true);
    const afterExpiry = engine.snapshot();
    const expiry = getNewStatusVfxSignals(afterApply, afterExpiry);
    assert.equal(expiry.some((signal) => signal.eventType === 'status-expired'
      && signal.statusId === statusId && signal.frame.state === 'expire'), true);
    assert.equal(getPersistentStatusVfxMarkers(afterExpiry)
      .some((marker) => marker.actorId === 'ren' && marker.statusId === statusId), false);
    assert.equal(expiry.some((signal) => signal.eventType.includes('cleanse')), false);
  }
});

test('status signal resolution fails closed on divergent logs and unsupported markers', () => {
  assert.deepEqual(getNewStatusVfxSignals(
    { log: [{ type: 'commit', pulse: 1 }] },
    { log: [{ type: 'different', pulse: 1 }, { type: 'status-expired', statusId: 'dread' }] },
  ), []);
  assert.deepEqual(getPersistentStatusVfxMarkers({
    actors: [{ instanceId: 'boss', pos: { x: 4, y: 3 }, statuses: [{ id: 'final-ward-open' }] }],
  }), []);
  assert.equal(statusVfxImageHasExpectedSize({ naturalWidth: 96, naturalHeight: 192 }), true);
  assert.equal(statusVfxImageHasExpectedSize({ naturalWidth: 95, naturalHeight: 192 }), false);
  assert.equal(statusVfxImageHasExpectedSize(null), false);
});
