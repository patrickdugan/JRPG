import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceActionCampaignBattle,
  createActionCampaignBattleSession,
  getCanonicalActionFighterIds,
} from '../action-campaign-battle-model.mjs';
import { ACTION_FIXED_STEP_MS, levelAdjustedCooldownMs } from '../action-combat.mjs';
import {
  ACTION_BOSS_SHARED_COOLDOWN_FLOOR_MS,
  ACTION_ENEMY_POISE,
  ACTION_ENEMY_TELL_TIERS,
  actionEnemyAttackTiming,
  adaptActionEncounter,
  adaptAllActionEncounters,
} from '../action-encounter-adapter.mjs';
import { createAdvancementState, preparePartyForEncounter } from '../advancement.mjs';
import { ENCOUNTERS, getEncounter } from '../content/encounters.mjs';
import { createLoadoutState } from '../loadout.mjs';
import { buildTimingWindowsRows, renderTimingWindowsMarkdown } from '../tools/timing-windows-table.mjs';

const STEP = ACTION_FIXED_STEP_MS;
/** A human reads a tell and presses a button about 300 ms after it begins. */
const HUMAN_REACTION_MS = 300;
const TIER_WINDUP_BOUNDS = Object.freeze({
  standard: [380, 460],
  elite: [500, 600],
  boss: [650, 760],
  signature: [850, 1_000],
  command: [850, 1_000],
});

function enemyAttackRecords(spec) {
  return spec.attackManifest
    .filter(({ sourceKind, sourceVariant }) => sourceKind === 'enemy' && !sourceVariant)
    .map((entry) => ({ entry, attack: spec.kernelConfig.attacks[entry.adapterAttackId] }));
}

function bossProfile(spec) {
  return spec.profiles.enemies.find(({ tellTier }) => tellTier === 'boss') ?? null;
}

/** Primary bosses that can be staggered (the Yearless Bell is a phase object). */
function poisedBossEncounters() {
  return ENCOUNTERS.filter((encounter) => {
    if (encounter.format === 'noncombat-resolution') return false;
    const spec = adaptActionEncounter(encounter.id);
    const profile = bossProfile(spec);
    if (!profile) return false;
    const actor = spec.kernelConfig.actors.find(({ id }) => id === profile.instanceIds[0]);
    return actor.poise != null;
  }).map(({ id }) => id);
}

/**
 * The canonical lead fighter alone at chronological strength, facing the boss
 * at weapon reach, with every enemy AI paused so the test owns each tell.
 */
function duel(encounterId) {
  const encounter = getEncounter(encounterId);
  const advancementState = preparePartyForEncounter(createAdvancementState(), encounterId, {
    partyIds: encounter.party.roster,
  });
  const session = createActionCampaignBattleSession({
    encounterId,
    advancementState,
    loadoutState: createLoadoutState(),
    fighterActorIds: getCanonicalActionFighterIds(encounterId).slice(0, 1),
  });
  for (const actor of session.kernel.actors.values()) if (actor.faction !== 'player') actor.ai = null;
  const templateId = bossProfile(session.spec).templateId;
  const boss = [...session.kernel.actors.values()].find((actor) => (
    actor.faction === 'enemy' && session.actorTemplates[actor.id] === templateId
  ));
  const hero = session.kernel.getActor(session.kernel.snapshot().controlledActorId);
  boss.position.x = 480;
  boss.facing = -1;
  hero.position.x = 420;
  hero.position.y = boss.position.y;
  hero.facing = 1;
  return { session, boss, hero };
}

function beginTell(runtime, attackId) {
  const { session, boss } = runtime;
  if (!boss.attackIds.includes(attackId)) boss.attackIds = [...boss.attackIds, attackId];
  boss.offensiveCooldownRemainingMs = 0;
  boss.attackCooldowns[attackId] = 0;
  const started = session.kernel.requestAttack(boss.id, attackId);
  assert.equal(started.ok, true, `${attackId} begins`);
}

/**
 * Advance until the tell is interrupted or resolves. `presses` maps a time
 * since the tell began to an attack input (0 weapon, 1 art).
 */
function playTell(runtime, attackId, presses) {
  const { session, boss } = runtime;
  const events = [];
  for (let elapsed = 0; elapsed <= 2_000; elapsed += STEP) {
    const input = Object.hasOwn(presses, elapsed) ? { attackIndex: presses[elapsed] } : {};
    events.push(...advanceActionCampaignBattle(session, STEP, input).recentEvents);
    const broken = events.find(({ type, actorId }) => type === 'poise-broken' && actorId === boss.id);
    if (broken) return { broken, events };
    if (events.some(({ type, actorId }) => type === 'hitbox-resolved' && actorId === boss.id)) return { broken: null, events };
  }
  throw new Error(`${attackId} neither broke nor resolved`);
}

/** Land one weapon strike while the boss is idle, then wait until the weapon is ready again. */
function punishInNeutral(runtime) {
  const { session, boss, hero } = runtime;
  assert.equal(boss.activeAttack, null);
  const events = [];
  for (let step = 0; step < 20; step += 1) {
    events.push(...advanceActionCampaignBattle(session, STEP, step === 0 ? { attackIndex: 0 } : {}).recentEvents);
  }
  const hit = events.find(({ type, targetId }) => type === 'hit' && targetId === boss.id);
  assert.ok(hit, 'the punishing strike connects');
  assert.equal(hit.poiseDuringTell, false);
  const weaponId = hero.attackIds[0];
  for (let step = 0; step < 200 && !session.kernel.getAttackState(hero.id, weaponId).ready; step += 1) {
    advanceActionCampaignBattle(session, STEP, {});
  }
  boss.position.x = 480;
  hero.position.x = 420;
  hero.facing = 1;
  return hit;
}

function tellsOfClass(encounterId, classes) {
  const spec = adaptActionEncounter(encounterId);
  const templateId = bossProfile(spec).templateId;
  return enemyAttackRecords(spec)
    .filter(({ entry }) => entry.ownerTemplateId === templateId && classes.includes(entry.tellClass))
    .map(({ entry, attack }) => ({ attackId: entry.adapterAttackId, tellClass: entry.tellClass, attack }));
}

test('every enemy tell meets its tier band and keeps a crisp active frame', () => {
  let counted = 0;
  for (const spec of adaptAllActionEncounters()) {
    for (const { entry, attack } of enemyAttackRecords(spec)) {
      const [minimum, maximum] = TIER_WINDUP_BOUNDS[entry.tellClass];
      assert.ok(attack.windupMs >= minimum && attack.windupMs <= maximum,
        `${spec.encounterId} ${entry.sourceSkillId}: ${entry.tellClass} wind-up ${attack.windupMs} outside ${minimum}–${maximum}`);
      assert.ok(attack.activeMs <= 100, `${entry.sourceSkillId} active frame stays short`);
      assert.equal(attack.tellPoiseBonus, ACTION_ENEMY_TELL_TIERS[entry.tellClass].tellPoiseBonus);
      counted += 1;
    }
  }
  assert.ok(counted >= 55, `${counted} enemy tells checked`);
});

test('tell tiers follow each encounter’s boss role and authored kit', () => {
  const classOf = (encounterId, templateId, skillId) => adaptActionEncounter(encounterId).attackManifest
    .find((entry) => entry.adapterAttackId === `enemy:${templateId}:${skillId}`).tellClass;
  const tierOf = (encounterId, templateId) => adaptActionEncounter(encounterId).profiles.enemies
    .find((profile) => profile.templateId === templateId).tellTier;

  assert.equal(tierOf('prologue-ashen-bailiff', 'ashen-bailiff'), 'elite', 'the tutorial sentry teaches a long read');
  assert.equal(tierOf('c3-dock-patrol', 'lady-enma'), 'elite');
  assert.equal(tierOf('c6-masked-clerks', 'lady-enma'), 'elite');
  assert.equal(tierOf('c8-lady-enma', 'lady-enma'), 'boss');
  assert.equal(tierOf('c6-masked-clerks', 'masked-clerk'), 'standard');
  assert.equal(tierOf('c1-cinder-hounds', 'cinder-hound'), 'standard');

  assert.equal(classOf('c1-tithe-hound', 'tithe-hound', 'consume-ink'), 'signature', 'Recovery 3');
  assert.equal(classOf('c1-tithe-hound', 'tithe-hound', 'ledger-maul'), 'boss');
  assert.equal(classOf('c4-widow-of-fog', 'widow-of-fog', 'receding-call'), 'signature', 'highest Recovery when no art is Recovery 3');
  assert.equal(classOf('c4-widow-of-fog', 'widow-of-fog', 'name-drag'), 'boss');
  assert.equal(classOf('c9-kurozane', 'kurozane', 'blood-eclipse'), 'boss', 'Kurozane has a Recovery-3 art and a command');
  for (const [encounterId, templateId, skillId] of [
    ['fp1-mateus', 'mateus', 'blood-ward'],
    ['c6-ujiro', 'ujiro', 'seizure-order'],
    ['c6-ujiro', 'ujiro', 'call-clerks'],
    ['c7-bell-warden-chiyo', 'bell-warden-chiyo', 'ringing-count'],
    ['c9-kurozane', 'kurozane', 'court-command'],
    ['c6-masked-clerks', 'lady-enma', 'mirror-writ'],
  ]) {
    assert.equal(classOf(encounterId, templateId, skillId), 'command', `${skillId} is an order, summons, or countdown`);
  }
  assert.equal(classOf('c6-masked-clerks', 'masked-clerk', 'seize-copy'), 'standard', 'only boss and elite orders are commands');

  for (const encounterId of poisedBossEncounters()) {
    assert.ok(tellsOfClass(encounterId, ['signature', 'command']).length > 0, `${encounterId} has a signature or command tell`);
  }
});

test('not-dodgeable and complex tells take the longer end of each tier', () => {
  const base = { range: 2, delivery: 'crush', dodgeable: true, recoveryPulses: 1 };
  for (const [tellClass, tier] of Object.entries(ACTION_ENEMY_TELL_TIERS)) {
    const dodgeable = actionEnemyAttackTiming(base, tellClass);
    const committed = actionEnemyAttackTiming({ ...base, dodgeable: false }, tellClass);
    const ring = actionEnemyAttackTiming({ ...base, shape: { type: 'ring', radius: 2 } }, tellClass);
    assert.equal(committed.windupMs - dodgeable.windupMs, tier.committedMs, tellClass);
    assert.equal(committed.recoveryMs - dodgeable.recoveryMs, tier.recoveryCommittedMs, tellClass);
    assert.equal(ring.windupMs - dodgeable.windupMs, tier.complexMs, tellClass);
    for (const timing of [dodgeable, committed, ring]) {
      for (const value of Object.values(timing)) assert.equal(value % STEP, 0);
    }
  }
});

test('the pass lengthens every enemy tell and leaves party animations unchanged', () => {
  const rows = buildTimingWindowsRows();
  for (const row of rows) {
    assert.ok(row.after.windupMs > row.before.windupMs, `${row.encounterId} ${row.skillId} wind-up grows`);
    assert.ok(row.after.recoveryMs >= row.before.recoveryMs, `${row.encounterId} ${row.skillId} recovery never shrinks`);
    assert.equal(row.after.activeMs, row.before.activeMs, 'active frames are unchanged');
    if (row.tier === 'boss') assert.ok(row.after.windupMs - row.before.windupMs >= 300, `${row.skillId} boss tell gains 300 ms+`);
  }
  assert.match(renderTimingWindowsMarkdown(rows), /\| Tithe Hound \| Tithe Hound \(boss, L5\) \| Consume Ink \(signature, not dodgeable\) \| 300 → 980 \|/u);

  const spec = adaptActionEncounter('c6-ujiro');
  const party = (id) => spec.kernelConfig.attacks[id];
  assert.deepEqual(
    ['windupMs', 'activeMs', 'recoveryMs'].map((key) => party('party:lise:hunter-thrust')[key]),
    [120, 100, 160],
  );
  assert.deepEqual(
    ['windupMs', 'activeMs', 'recoveryMs'].map((key) => party('party:lise:dawn-bolt')[key]),
    [240, 100, 220],
  );
});

test('big boss attacks open a punish window and the shared floor keeps the next tell away', () => {
  assert.equal(ACTION_BOSS_SHARED_COOLDOWN_FLOOR_MS, 1_400);
  for (const spec of adaptAllActionEncounters()) {
    const profile = bossProfile(spec);
    if (!profile) continue;
    const boss = spec.kernelConfig.actors.find(({ id }) => id === profile.instanceIds[0]);
    assert.ok(boss.offensiveCooldownMs >= ACTION_BOSS_SHARED_COOLDOWN_FLOOR_MS, `${spec.encounterId} boss floor`);
    const sharedMs = levelAdjustedCooldownMs(boss.offensiveCooldownMs, boss.level);
    for (const { entry, attack } of enemyAttackRecords(spec)) {
      if (entry.ownerTemplateId !== profile.templateId) continue;
      if (['signature', 'command'].includes(entry.tellClass)) {
        assert.ok(attack.recoveryMs >= 600, `${entry.sourceSkillId} signature/command recovery ${attack.recoveryMs}`);
      } else if (entry.sourceRecoveryPulses >= 2) {
        assert.ok(attack.recoveryMs >= 480, `${entry.sourceSkillId} big-attack recovery ${attack.recoveryMs}`);
      } else {
        assert.ok(attack.recoveryMs >= 360, `${entry.sourceSkillId} recovery ${attack.recoveryMs}`);
      }
      assert.ok(attack.recoveryMs + sharedMs >= 1_100,
        `${spec.encounterId} ${entry.sourceSkillId}: next tell ${attack.recoveryMs + sharedMs} ms after the strike`);
    }
  }
});

test('the authored boss AI never chains a new tell over a whiffed signature tell', () => {
  let observed = 0;
  for (const encounterId of poisedBossEncounters()) {
    for (const { attackId, attack } of tellsOfClass(encounterId, ['signature'])) {
      const runtime = duel(encounterId);
      const { session, boss, hero } = runtime;
      hero.position.x = 60; // the tell whiffs
      beginTell(runtime, attackId);
      boss.ai = 'deterministic-chase';
      const events = [];
      for (let step = 0; step < 300; step += 1) {
        hero.position.x = step * STEP < attack.windupMs + attack.activeMs ? 60 : boss.position.x - 70;
        events.push(...advanceActionCampaignBattle(session, STEP, {}).recentEvents);
        if (events.some(({ type, actorId, attackId: id }) => type === 'attack-start' && actorId === boss.id && id !== attackId)) break;
        if (session.outcome) break;
      }
      const resolved = events.find(({ type, actorId }) => type === 'hitbox-resolved' && actorId === boss.id);
      assert.deepEqual(resolved.targetIds, [], `${attackId} whiffs`);
      const next = events.find(({ type, actorId, nowMs }) => (
        type === 'attack-start' && actorId === boss.id && nowMs > resolved.nowMs
      ));
      if (!next) continue;
      observed += 1;
      const minimumGap = attack.recoveryMs + levelAdjustedCooldownMs(boss.offensiveCooldownMs, boss.level);
      assert.ok(next.nowMs - resolved.nowMs >= minimumGap,
        `${encounterId}: next tell ${next.nowMs - resolved.nowMs} ms after ${attackId}; punish window ${minimumGap} ms`);
    }
  }
  assert.ok(observed >= 4, `${observed} bosses followed a whiffed signature tell with a new attack`);
});

test('one art pressed 300 ms into any boss signature or command tell interrupts it', () => {
  let checked = 0;
  for (const encounterId of poisedBossEncounters()) {
    for (const { attackId } of tellsOfClass(encounterId, ['signature', 'command'])) {
      const runtime = duel(encounterId);
      assert.equal(runtime.boss.poise, ACTION_ENEMY_POISE.boss.max);
      beginTell(runtime, attackId);
      const { broken } = playTell(runtime, attackId, { [HUMAN_REACTION_MS]: 1 });
      assert.ok(broken, `${encounterId} ${attackId} breaks before its active frame`);
      assert.equal(broken.interruptedAttackId, attackId);
      assert.ok(runtime.boss.staggerRemainingMs > 0);
      checked += 1;
    }
  }
  assert.ok(checked >= 12, `${checked} signature and command tells checked`);
});

test('a standard string — punish in neutral, then strike the tell — interrupts every boss signature tell', () => {
  let checked = 0;
  for (const encounterId of poisedBossEncounters()) {
    for (const { attackId } of tellsOfClass(encounterId, ['signature', 'command'])) {
      const runtime = duel(encounterId);
      const punish = punishInNeutral(runtime);
      assert.equal(punish.poiseAfter, ACTION_ENEMY_POISE.boss.neutralFloor, 'neutral pressure primes poise');
      beginTell(runtime, attackId);
      const { broken } = playTell(runtime, attackId, { [HUMAN_REACTION_MS]: 0 });
      assert.ok(broken, `${encounterId} ${attackId}: weapon strike into a primed tell breaks it`);
      checked += 1;
    }
  }
  assert.ok(checked >= 12);
});

test('interrupts stay earned: one weapon strike cannot break a fresh boss, neutral hits never stagger', () => {
  for (const encounterId of poisedBossEncounters()) {
    if (encounterId === 'c6-ujiro') continue; // authored orders break on any hit (below)
    const [signature] = tellsOfClass(encounterId, ['signature', 'command']);
    const runtime = duel(encounterId);
    beginTell(runtime, signature.attackId);
    const { broken, events } = playTell(runtime, signature.attackId, { [HUMAN_REACTION_MS]: 0 });
    assert.equal(broken, null, `${encounterId}: a lone weapon strike leaves poise`);
    const hit = events.find(({ type, targetId }) => type === 'hit' && targetId === runtime.boss.id);
    assert.equal(hit.poiseAfter, ACTION_ENEMY_POISE.boss.max - 3, `${encounterId}: ${JSON.stringify(hit)}`);

    const [regular] = tellsOfClass(encounterId, ['boss']);
    if (regular) {
      const fresh = duel(encounterId);
      beginTell(fresh, regular.attackId);
      assert.equal(playTell(fresh, regular.attackId, { [HUMAN_REACTION_MS]: 1 }).broken, null,
        `${encounterId}: one art cannot break a fresh boss's ordinary tell`);
      const primed = duel(encounterId);
      punishInNeutral(primed);
      beginTell(primed, regular.attackId);
      assert.ok(playTell(primed, regular.attackId, { [HUMAN_REACTION_MS]: 1 }).broken,
        `${encounterId}: after a neutral hit, one art breaks an ordinary tell`);
    }
  }

  const pressure = duel('c3-captain-kaji');
  for (let swing = 0; swing < 4; swing += 1) punishInNeutral(pressure);
  assert.equal(pressure.boss.poise, ACTION_ENEMY_POISE.boss.neutralFloor);
  assert.equal(pressure.boss.staggerRemainingMs, 0);
});

test('Ujiro’s authored orders break on a single weapon strike', () => {
  for (const { attackId } of tellsOfClass('c6-ujiro', ['command'])) {
    const runtime = duel('c6-ujiro');
    beginTell(runtime, attackId);
    const { broken } = playTell(runtime, attackId, { [HUMAN_REACTION_MS]: 0 });
    assert.ok(broken, attackId);
  }
});

test('the campaign controller buffers attack and dash presses and reports a dash that never became legal', () => {
  const session = createActionCampaignBattleSession({
    encounterId: 'c1-cinder-hounds',
    advancementState: createAdvancementState(),
    loadoutState: createLoadoutState(),
  });
  for (const actor of session.kernel.actors.values()) if (actor.faction !== 'player') actor.ai = null;
  const heroId = session.kernel.snapshot().controlledActorId;
  const hero = session.kernel.getActor(heroId);
  const [weaponId, artId] = hero.attackIds;
  advanceActionCampaignBattle(session, STEP, { attackIndex: 0 });
  assert.equal(hero.activeAttack.attackId, weaponId);

  // A dash pressed with most of the swing left waits, then reports the block.
  const early = advanceActionCampaignBattle(session, 0, { maneuverPressed: 'dash' });
  assert.equal(early.recentEvents.some(({ type }) => type === 'maneuver-blocked'), false, 'the press is held, not refused');
  const held = [];
  for (let step = 0; step < 8; step += 1) held.push(...advanceActionCampaignBattle(session, STEP, {}).recentEvents);
  const blocked = held.find(({ type }) => type === 'maneuver-blocked');
  assert.deepEqual([blocked.maneuverId, blocked.reason], ['dash', 'animation-commitment']);

  // An art pressed shortly before the shared cooldown ends starts the moment it ends.
  while (hero.activeAttack || hero.offensiveCooldownRemainingMs > 100) advanceActionCampaignBattle(session, STEP, {});
  const readyAt = session.kernel.nowMs + hero.offensiveCooldownRemainingMs;
  const events = [...advanceActionCampaignBattle(session, STEP, { attackIndex: 1 }).recentEvents];
  for (let step = 0; step < 8 && !hero.activeAttack; step += 1) events.push(...advanceActionCampaignBattle(session, STEP, {}).recentEvents);
  const start = events.find(({ type, attackId }) => type === 'attack-start' && attackId === artId);
  assert.equal(start.nowMs, readyAt);
});
