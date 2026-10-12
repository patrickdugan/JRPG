import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTION_COMBAT_SNAPSHOT_VERSION,
  ACTION_COMBO_POISE_BONUS,
  ACTION_DEFAULT_POISE_DAMAGE,
  ACTION_HIT_STUN_MS,
  ActionCombatKernel,
  levelAdjustedCooldownMs,
} from '../action-combat.mjs';

const POISE = Object.freeze({ max: 2, regenDelayMs: 400, regenIntervalMs: 200, staggerMs: 300 });

const ATTACKS = Object.freeze({
  jab: { name: 'Jab', delivery: 'cut', power: 6, windupMs: 20, activeMs: 20, recoveryMs: 20, hitbox: { offsetX: 4, offsetY: 0, width: 60, height: 48 } },
  art: { name: 'Art', delivery: 'arcane', power: 6, poiseDamage: 2, windupMs: 20, activeMs: 20, recoveryMs: 20, hitbox: { offsetX: 4, offsetY: 0, width: 60, height: 48 } },
  smash: { name: 'Smash', delivery: 'crush', power: 9, windupMs: 200, activeMs: 20, recoveryMs: 100, cooldownMs: 900, hitbox: { offsetX: 4, offsetY: 0, width: 60, height: 48 } },
  ward: { name: 'Ward', delivery: 'arcane', power: 0, selfCast: true, windupMs: 100, activeMs: 20, recoveryMs: 20, hitbox: { offsetX: -10, offsetY: 0, width: 20, height: 48 } },
  wardReach: { name: 'Reach Ward', delivery: 'arcane', power: 0, windupMs: 100, activeMs: 20, recoveryMs: 20, hitbox: { offsetX: -10, offsetY: 0, width: 20, height: 48 } },
});

function createKernel({ brute = {}, hero = {}, extraActors = [], statusHooks } = {}) {
  return new ActionCombatKernel({
    attacks: ATTACKS,
    statusHooks,
    actors: [
      {
        id: 'hero', faction: 'player', hp: 300, maxHp: 300, power: 10, offensiveCooldownMs: 200,
        position: { x: 100, y: 360 }, facing: 'right', attackIds: ['jab', 'art'], ...hero,
      },
      ...extraActors,
      {
        id: 'brute', faction: 'enemy', ai: null, hp: 400, maxHp: 400, power: 8, offensiveCooldownMs: 500,
        position: { x: 140, y: 360 }, facing: 'left', attackIds: ['smash'], poise: POISE, ...brute,
      },
    ],
  });
}

function stepUntil(kernel, predicate, limit = 200) {
  const events = [];
  for (let index = 0; index < limit; index += 1) {
    kernel.step(1);
    events.push(...kernel.drainEvents());
    if (predicate(events)) return events;
  }
  return events;
}

test('poise is opt-in, published in snapshots, and attacks default to one poise damage', () => {
  const kernel = createKernel({ brute: { poise: undefined } });
  const snapshot = kernel.snapshot();
  assert.equal(snapshot.schemaVersion, ACTION_COMBAT_SNAPSHOT_VERSION);
  const brute = snapshot.actors.find(({ id }) => id === 'brute');
  assert.deepEqual([brute.poise, brute.maxPoise, brute.staggerRemainingMs], [0, 0, 0]);
  assert.equal(kernel.attacks.jab.poiseDamage, ACTION_DEFAULT_POISE_DAMAGE);
  assert.equal(kernel.attacks.art.poiseDamage, 2);
  assert.equal(kernel.attacks.ward.selfCast, true);
  assert.equal(kernel.attacks.wardReach.selfCast, false);
  const poised = createKernel().snapshot().actors.find(({ id }) => id === 'brute');
  assert.deepEqual([poised.poise, poised.maxPoise], [2, 2]);
});

test('only hits that land during a wind-up drain poise', () => {
  const idle = createKernel();
  assert.equal(idle.requestAttack('hero', 'jab').ok, true);
  const idleHit = stepUntil(idle, (events) => events.some(({ type }) => type === 'hit')).find(({ type }) => type === 'hit');
  assert.equal(idleHit.poiseDamage, 0, 'a hit on an idle actor drains nothing');
  assert.equal(idleHit.poiseAfter, 2);

  const kernel = createKernel();
  assert.equal(kernel.requestAttack('brute', 'smash').ok, true);
  assert.equal(kernel.requestAttack('hero', 'jab').ok, true);
  const events = stepUntil(kernel, (log) => log.some(({ type }) => type === 'hit'));
  const hit = events.find(({ type }) => type === 'hit');
  assert.equal(hit.targetId, 'brute');
  assert.equal(hit.poiseDamage, 1);
  assert.equal(hit.poiseAfter, 1);
  assert.equal(hit.poiseBroken, false);
  assert.equal(kernel.getActor('brute').activeAttack.attackId, 'smash', 'one point short: the wind-up continues');
});

test('breaking poise cancels the wind-up onto its normal cooldown and staggers the enemy', () => {
  const kernel = createKernel();
  assert.equal(kernel.requestAttack('brute', 'smash').ok, true);
  assert.equal(kernel.requestAttack('hero', 'art').ok, true);
  const events = stepUntil(kernel, (log) => log.some(({ type }) => type === 'attack-interrupted'));
  const broken = events.find(({ type }) => type === 'poise-broken');
  const interrupted = events.find(({ type }) => type === 'attack-interrupted');
  assert.deepEqual(
    { actorId: broken.actorId, sourceActorId: broken.sourceActorId, interruptedAttackId: broken.interruptedAttackId, poiseDamage: broken.poiseDamage, staggerMs: broken.staggerMs },
    { actorId: 'brute', sourceActorId: 'hero', interruptedAttackId: 'smash', poiseDamage: 2, staggerMs: POISE.staggerMs },
  );
  assert.equal(interrupted.reason, 'poise-broken');
  assert.equal(interrupted.byActorId, 'hero');
  assert.ok(interrupted.elapsedMs < ATTACKS.smash.windupMs, 'cancelled before the active frame');
  const shared = levelAdjustedCooldownMs(500, 1);
  assert.equal(interrupted.sharedCooldownMs, shared);
  assert.equal(interrupted.individualCooldownMs, Math.max(shared, levelAdjustedCooldownMs(900, 1)));

  const brute = kernel.getActor('brute');
  assert.equal(brute.activeAttack, null);
  assert.equal(brute.poise, 0);
  assert.equal(brute.staggerRemainingMs, POISE.staggerMs);
  assert.equal(brute.attackCooldowns.smash, interrupted.individualCooldownMs);
  // Hit stun still owns the first 100 ms; stagger owns the rest of the read.
  assert.equal(brute.hitStunRemainingMs, ACTION_HIT_STUN_MS);
  kernel.step(ACTION_HIT_STUN_MS / 20);
  assert.equal(kernel.getAttackState('brute', 'smash').reason, 'staggered');

  const heroHp = kernel.getActor('hero').hp;
  const later = stepUntil(kernel, (log) => log.some(({ type }) => type === 'poise-restored'), 40);
  assert.equal(later.some(({ type, actorId }) => type === 'hitbox-resolved' && actorId === 'brute'), false,
    'the interrupted smash never reaches its active frame');
  assert.equal(kernel.getActor('hero').hp, heroHp);
  const restored = later.find(({ type }) => type === 'poise-restored');
  assert.deepEqual([restored.actorId, restored.reason, restored.poise], ['brute', 'stagger-recovered', 2]);
  assert.equal(kernel.getActor('brute').staggerRemainingMs, 0);
});

test('staggered enemies make no AI decisions and hold their ground', () => {
  const kernel = createKernel({ brute: { ai: 'deterministic-chase', position: { x: 300, y: 360 } } });
  const brute = kernel.getActor('brute');
  brute.staggerRemainingMs = 200;
  brute.poise = 0;
  const startX = brute.position.x;
  const events = [];
  for (let index = 0; index < 9; index += 1) {
    kernel.step(1);
    events.push(...kernel.drainEvents());
  }
  assert.equal(events.some(({ type, actorId }) => type === 'enemy-decision' && actorId === 'brute'), false);
  assert.equal(brute.position.x, startX);
  stepUntil(kernel, (log) => log.some(({ type, actorId }) => type === 'enemy-decision' && actorId === 'brute'), 20);
  assert.equal(brute.staggerRemainingMs, 0);
});

test('poise regenerates one point per interval after the quiet delay, and restorePoise refills it', () => {
  const kernel = createKernel({ brute: { poise: { ...POISE, max: 4 } } });
  assert.equal(kernel.requestAttack('brute', 'smash').ok, true);
  assert.equal(kernel.requestAttack('hero', 'art').ok, true);
  stepUntil(kernel, (log) => log.some(({ type }) => type === 'hit'));
  const brute = kernel.getActor('brute');
  assert.equal(brute.poise, 2);
  kernel.step((POISE.regenDelayMs - 20) / 20);
  assert.equal(brute.poise, 2, 'no regen inside the quiet delay');
  kernel.step((POISE.regenIntervalMs + 20) / 20);
  assert.equal(brute.poise, 3);
  kernel.step(POISE.regenIntervalMs / 20);
  assert.equal(brute.poise, 4);

  brute.poise = 1;
  kernel.drainEvents();
  const result = kernel.restorePoise('brute', 'phase-change');
  assert.deepEqual(result, { ok: true, actorId: 'brute', previous: 1, poise: 4 });
  const [event] = kernel.drainEvents();
  assert.deepEqual([event.type, event.reason, event.poise], ['poise-restored', 'phase-change', 4]);
  assert.deepEqual(kernel.restorePoise('hero'), { ok: false, reason: 'no-poise' });
  assert.deepEqual(kernel.restorePoise('ghost'), { ok: false, reason: 'unknown-actor' });
});

test('actors without poise keep the uninterruptible attack contract', () => {
  const kernel = createKernel({ brute: { poise: null } });
  assert.equal(kernel.requestAttack('brute', 'smash').ok, true);
  assert.equal(kernel.requestAttack('hero', 'art').ok, true);
  const events = stepUntil(kernel, (log) => log.some(({ type, actorId }) => type === 'attack-complete' && actorId === 'brute'));
  assert.equal(events.some(({ type }) => type === 'poise-broken' || type === 'attack-interrupted'), false);
  assert.equal(events.find(({ type, targetId }) => type === 'hit' && targetId === 'brute').poiseAfter, null);
  assert.equal(events.some(({ type, actorId }) => type === 'hitbox-resolved' && actorId === 'brute'), true);
});

test('linked combo hits add the combo poise bonus', () => {
  const kernel = createKernel({
    extraActors: [{
      id: 'ally', faction: 'player', hp: 300, maxHp: 300, power: 10, offensiveCooldownMs: 200,
      position: { x: 110, y: 360 }, facing: 'right', attackIds: ['jab'],
    }],
  });
  assert.equal(kernel.requestAttack('brute', 'smash').ok, true);
  const combo = kernel.requestCombo('test-combo', 'hero', [
    { actorId: 'hero', attackId: 'jab' },
    { actorId: 'ally', attackId: 'jab' },
  ]);
  assert.equal(combo.ok, true);
  const events = stepUntil(kernel, (log) => log.some(({ type }) => type === 'hit'));
  const hit = events.find(({ type }) => type === 'hit');
  assert.equal(hit.comboId, 'test-combo');
  assert.equal(hit.poiseDamage, ACTION_DEFAULT_POISE_DAMAGE + ACTION_COMBO_POISE_BONUS);
  assert.equal(events.some(({ type }) => type === 'poise-broken'), true);
});

test('AI begins an explicit self-cast without reaching its target; reach-gated casts still approach', () => {
  const far = { position: { x: 600, y: 360 }, ai: 'deterministic-chase' };
  const selfCast = createKernel({ brute: { ...far, attackIds: ['ward'] } });
  selfCast.step(1);
  const decision = selfCast.drainEvents().find(({ type, actorId }) => type === 'enemy-decision' && actorId === 'brute');
  assert.deepEqual([decision.action, decision.attackId], ['attack', 'ward']);

  const reachGated = createKernel({ brute: { ...far, attackIds: ['wardReach'] } });
  reachGated.step(1);
  const move = reachGated.drainEvents().find(({ type, actorId }) => type === 'enemy-decision' && actorId === 'brute');
  assert.equal(move.action, 'move');
});

test('prioritizeAttacks reorders AI selection while canBeginAttack can still veto', () => {
  const seen = [];
  const hooks = {
    prioritizeAttacks: ({ actor, attackIds }) => (actor.id === 'brute' ? [...attackIds].reverse() : attackIds),
    canBeginAttack: ({ actor, attackId }) => {
      if (actor.id === 'brute') seen.push(attackId);
      return true;
    },
  };
  const kernel = createKernel({ brute: { ai: 'deterministic-chase', attackIds: ['smash', 'ward'] }, statusHooks: hooks });
  kernel.step(1);
  const decision = kernel.drainEvents().find(({ type, actorId }) => type === 'enemy-decision' && actorId === 'brute');
  assert.equal(decision.attackId, 'ward', 'authored priority wins over attack-list order');
  assert.equal(seen[0], 'ward');

  const vetoing = createKernel({
    brute: { ai: 'deterministic-chase', attackIds: ['smash', 'ward'] },
    statusHooks: { ...hooks, canBeginAttack: ({ attackId }) => attackId !== 'ward' },
  });
  vetoing.step(1);
  const fallback = vetoing.drainEvents().find(({ type, actorId }) => type === 'enemy-decision' && actorId === 'brute');
  assert.equal(fallback.attackId, 'smash');
});

test('identical inputs produce identical poise, interrupt, and stagger logs', () => {
  const run = () => {
    const kernel = createKernel({ brute: { ai: 'deterministic-chase' } });
    const log = [];
    for (let step = 0; step < 240; step += 1) {
      if (step % 7 === 0) kernel.requestAttack('hero', step % 21 === 0 ? 'art' : 'jab');
      kernel.step(1);
      log.push(...kernel.drainEvents());
    }
    return { log, snapshot: kernel.snapshot() };
  };
  const first = run();
  const second = run();
  assert.deepEqual(second, first);
  assert.ok(first.log.some(({ type }) => type === 'attack-interrupted'), 'the scripted run exercises an interrupt');
});
