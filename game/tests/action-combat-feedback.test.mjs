import assert from 'node:assert/strict';
import test from 'node:test';

import { ACTION_FIXED_STEP_MS, attackWorldHitbox } from '../action-combat.mjs';
import {
  ACTION_HIT_STOP,
  ACTION_PHASE_BEAT,
  ACTION_TELEGRAPH_COLORS,
  collectEnemyTelegraphs,
  createSimulationPacer,
  impactFeedbackForEvents,
  paceSimulation,
  phaseBeatForEvents,
  requestHitStop,
  requestSlowMotion,
  screenShakeOffset,
  telegraphColor,
} from '../action-combat-feedback.mjs';
import { createActionEncounterKernel } from '../action-encounter-adapter.mjs';

const ATTACKS = Object.freeze({
  lunge: { name: 'Cinder Lunge', delivery: 'pierce', essence: 'ember', windupMs: 200, activeMs: 80, recoveryMs: 100, hitbox: { offsetX: 14, offsetY: 0, width: 192, height: 64 } },
  ring: { name: 'Receding Call', delivery: 'arcane', essence: null, windupMs: 300, activeMs: 100, recoveryMs: 100, hitbox: { offsetX: -160, offsetY: 0, width: 320, height: 112 } },
});

function actor(overrides) {
  return {
    id: 'hound-1', faction: 'enemy', hp: 80, maxHp: 100, position: { x: 400, y: 440 }, facing: -1,
    activeAttack: null, ...overrides,
  };
}

test('telegraph colours follow essence first, then delivery', () => {
  assert.equal(telegraphColor({ essence: 'ember', delivery: 'pierce' }), ACTION_TELEGRAPH_COLORS.essence.ember);
  assert.equal(telegraphColor({ essence: null, delivery: 'arcane' }), ACTION_TELEGRAPH_COLORS.delivery.arcane);
  assert.equal(telegraphColor({}), ACTION_TELEGRAPH_COLORS.neutral);
});

test('every enemy wind-up publishes its committed world hitbox and fill progress', () => {
  const winding = actor({ activeAttack: { attackId: 'lunge', phase: 'windup', elapsedMs: 50 } });
  const ringing = actor({ id: 'widow-1', facing: 1, activeAttack: { attackId: 'ring', phase: 'active', elapsedMs: 320 } });
  const recovering = actor({ id: 'hound-2', activeAttack: { attackId: 'lunge', phase: 'recovery', elapsedMs: 300 } });
  const hero = actor({ id: 'ren', faction: 'player', activeAttack: { attackId: 'lunge', phase: 'windup', elapsedMs: 50 } });
  const telegraphs = collectEnemyTelegraphs({ actors: [winding, ringing, recovering, hero] }, ATTACKS);
  assert.deepEqual(telegraphs.map(({ actorId }) => actorId), ['hound-1', 'widow-1']);
  const [lunge, ring] = telegraphs;
  assert.deepEqual(lunge.hitbox, attackWorldHitbox(winding, ATTACKS.lunge));
  assert.equal(lunge.progress, 0.25);
  assert.equal(lunge.remainingMs, 150);
  assert.equal(lunge.centred, false);
  assert.equal(lunge.color, ACTION_TELEGRAPH_COLORS.essence.ember);
  assert.equal(ring.phase, 'active');
  assert.equal(ring.progress, 1);
  assert.equal(ring.centred, true);
  assert.deepEqual(ring.hitbox, attackWorldHitbox(ringing, ATTACKS.ring));
});

test('hit-stop stays in the 40-90 ms band and lengthens for kills, boss staggers, and combo finishers', () => {
  const snapshot = {
    actors: [
      actor({ id: 'boss-1', maxHp: 600 }),
      actor({ id: 'hound-1', maxHp: 100 }),
      actor({ id: 'ren', faction: 'player', maxHp: 120 }),
    ],
  };
  const hit = (overrides) => ({ type: 'hit', actorId: 'ren', targetId: 'hound-1', attackId: 'jab', damage: 12, hpBefore: 80, hpAfter: 68, ...overrides });
  const light = impactFeedbackForEvents([hit({ targetId: 'boss-1', damage: 6, hpBefore: 600, hpAfter: 594 })], snapshot);
  const heavy = impactFeedbackForEvents([hit({ damage: 40, hpAfter: 40 })], snapshot);
  assert.ok(light.hitStopMs >= ACTION_HIT_STOP.minimumMs && light.hitStopMs < heavy.hitStopMs);
  assert.ok(heavy.hitStopMs <= ACTION_HIT_STOP.maximumMs);
  const art = impactFeedbackForEvents([hit({ attackId: 'art' })], snapshot, { attacks: { art: { poiseDamage: 2 } } });
  assert.equal(art.hitStopMs, impactFeedbackForEvents([hit()], snapshot).hitStopMs + ACTION_HIT_STOP.artBonusMs);
  const combo = impactFeedbackForEvents([hit({ comboId: 'concord' })], snapshot);
  assert.equal(combo.hitStopMs, ACTION_HIT_STOP.comboFinisherMs);
  const kill = impactFeedbackForEvents([hit({ damage: 80, hpAfter: 0 })], snapshot);
  assert.equal(kill.hitStopMs, ACTION_HIT_STOP.killMs);
  assert.deepEqual([...kill.kills], ['hound-1']);
  const bossKill = impactFeedbackForEvents([hit({ targetId: 'boss-1', damage: 9, hpBefore: 9, hpAfter: 0 })], snapshot, { bossActorIds: ['boss-1'] });
  assert.equal(bossKill.hitStopMs, ACTION_HIT_STOP.bossKillMs);
  const stagger = impactFeedbackForEvents([{ type: 'poise-broken', actorId: 'hound-1' }], snapshot);
  const bossStagger = impactFeedbackForEvents([{ type: 'poise-broken', actorId: 'boss-1' }], snapshot, { bossActorIds: ['boss-1'] });
  assert.equal(stagger.hitStopMs, ACTION_HIT_STOP.staggerMs);
  assert.equal(bossStagger.hitStopMs, ACTION_HIT_STOP.bossStaggerMs);
  assert.ok(bossStagger.shakePx > stagger.shakePx);
  const hurt = impactFeedbackForEvents([hit({ actorId: 'hound-1', targetId: 'ren', damage: 30, hpBefore: 120, hpAfter: 90 })], snapshot);
  assert.ok(hurt.hitStopMs >= ACTION_HIT_STOP.partyHurtMs && hurt.hitStopMs <= 70);
  assert.equal(impactFeedbackForEvents([hit({ damage: 0 })], snapshot).hitStopMs, 0, 'zero-damage hits do not freeze');
  const several = impactFeedbackForEvents([hit(), hit({ damage: 80, hpAfter: 0 })], snapshot);
  assert.equal(several.hitStopMs, ACTION_HIT_STOP.killMs, 'overlapping impacts never stack');
});

test('reduced motion removes shake and caps hit-stop short', () => {
  const snapshot = { actors: [actor({ id: 'boss-1', maxHp: 600 })] };
  const reduced = impactFeedbackForEvents([{ type: 'poise-broken', actorId: 'boss-1' }], snapshot, {
    reducedMotion: true,
    bossActorIds: ['boss-1'],
  });
  assert.equal(reduced.hitStopMs, ACTION_HIT_STOP.reducedMotionCapMs);
  assert.equal(reduced.shakePx, 0);
  assert.deepEqual(screenShakeOffset({ amplitudePx: 0, durationMs: 0, remainingMs: 0 }, 50), { x: 0, y: 0 });
  const shake = screenShakeOffset({ amplitudePx: 5, durationMs: 200, remainingMs: 100 }, 50);
  assert.ok(Math.abs(shake.x) <= 2.5 && Math.abs(shake.y) <= 2.5);
  assert.deepEqual(screenShakeOffset({ amplitudePx: 5, durationMs: 200, remainingMs: 100 }, 50), shake, 'shake is deterministic');
});

test('phase beats are short and non-locking, and static under reduced motion', () => {
  const entered = phaseBeatForEvents([{ type: 'boss-phase-entered', toPhaseId: 'cinder-wing' }]);
  assert.equal(entered.kind, 'entered');
  assert.equal(entered.title, 'Cinder Wing');
  assert.ok(entered.flashMs <= 600);
  assert.ok(entered.slowMotionMs <= 600);
  assert.ok(entered.slowMotionMs * (1 - entered.slowMotionScale) <= 600, 'slow motion delays the simulation by at most 600 ms');
  const reduced = phaseBeatForEvents([{ type: 'boss-phase-entered', toPhaseId: 'dawn' }], { reducedMotion: true });
  assert.deepEqual([reduced.flashMs, reduced.slowMotionMs, reduced.animated], [0, 0, false]);
  assert.equal(reduced.bannerMs, ACTION_PHASE_BEAT.bannerMs);
  const warning = phaseBeatForEvents([{ type: 'boss-phase-warning', toPhaseId: 'low-tide' }]);
  assert.deepEqual([warning.kind, warning.slowMotionMs, warning.flashMs], ['warning', 0, 0]);
  assert.equal(phaseBeatForEvents([{ type: 'hit' }]), null);
  assert.equal(
    phaseBeatForEvents([{ type: 'boss-phase-warning', toPhaseId: 'a' }, { type: 'boss-phase-entered', toPhaseId: 'b' }]).kind,
    'entered',
  );
});

test('the pacer freezes frames for hit-stop and scales them for slow motion', () => {
  const pacer = createSimulationPacer();
  assert.deepEqual({ ...paceSimulation(pacer, 16) }, { simulatedMs: 16, frozenMs: 0, slowedMs: 0, frozen: false });
  requestHitStop(pacer, 40);
  requestHitStop(pacer, 30);
  assert.equal(pacer.hitStopRemainingMs, 40, 'hit-stops never stack');
  assert.equal(paceSimulation(pacer, 16).frozen, true);
  assert.equal(paceSimulation(pacer, 16).frozen, true);
  const thaw = paceSimulation(pacer, 16);
  assert.deepEqual([thaw.frozenMs, thaw.simulatedMs, thaw.frozen], [8, 8, false]);
  requestSlowMotion(pacer, 20, 0.5);
  const slowed = paceSimulation(pacer, 16);
  assert.deepEqual([slowed.slowedMs, slowed.simulatedMs], [16, 8]);
  const tail = paceSimulation(pacer, 16);
  assert.deepEqual([tail.slowedMs, tail.simulatedMs], [4, 14]);
  assert.equal(pacer.slowMotionScale, 1);
  assert.equal(pacer.frozenTotalMs, 40);
});

test('hit-stop only delays fixed steps: a paced kernel reaches the same states and events', () => {
  const reference = createActionEncounterKernel('c1-cinder-hounds').kernel;
  const paced = createActionEncounterKernel('c1-cinder-hounds').kernel;
  const pacer = createSimulationPacer();
  const referenceLog = [];
  const pacedLog = [];
  const frames = 900;
  for (let frame = 0; frame < frames; frame += 1) {
    reference.advance(ACTION_FIXED_STEP_MS);
    referenceLog.push(...reference.drainEvents());
  }
  let carry = 0;
  for (let frame = 0; pacedLog.length < referenceLog.length || paced.nowMs < reference.nowMs; frame += 1) {
    assert.ok(frame < frames * 4, 'the paced run catches up');
    const step = paceSimulation(pacer, ACTION_FIXED_STEP_MS);
    carry += step.simulatedMs;
    const whole = Math.min(Math.floor(carry), reference.nowMs - paced.nowMs - paced.accumulatorMs);
    carry -= whole;
    if (whole > 0) paced.advance(whole);
    const events = paced.drainEvents();
    pacedLog.push(...events);
    const impact = impactFeedbackForEvents(events, paced.snapshot());
    if (impact.hitStopMs > 0) requestHitStop(pacer, impact.hitStopMs);
  }
  assert.ok(pacer.frozenTotalMs > 0, 'the run froze for impacts');
  assert.equal(paced.nowMs, reference.nowMs);
  assert.deepEqual(pacedLog, referenceLog);
  const strip = ({ accumulatorMs, ...rest }) => rest;
  assert.deepEqual(strip(paced.snapshot()), strip(reference.snapshot()));
});
