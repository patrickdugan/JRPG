import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceActionCampaignBattle,
  createActionCampaignBattleSession,
  getCanonicalActionFighterIds,
} from '../action-campaign-battle-model.mjs';
import {
  ACTION_AI_ADJACENT_PX,
  ACTION_AI_TILE_PX,
  AUTHORED_ENEMY_AI,
  authoredSelfCastKeys,
} from '../action-enemy-ai.mjs';
import { createAdvancementState } from '../advancement.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import { createLoadoutState } from '../loadout.mjs';

const BOSS_FORMATS = new Set(['boss', 'boss-rescue', 'boss-phase', 'final-boss']);

function session(encounterId) {
  return createActionCampaignBattleSession({
    encounterId,
    advancementState: createAdvancementState(),
    loadoutState: createLoadoutState(),
    fighterActorIds: getCanonicalActionFighterIds(encounterId),
  });
}

function actorOf(runtime, templateId, ordinal = 0) {
  return [...runtime.kernel.actors.values()].filter(({ id }) => runtime.actorTemplates[id] === templateId
    && runtime.kernel.getActor(id).faction !== 'player')[ordinal];
}

function party(runtime) {
  return [...runtime.kernel.actors.values()].filter(({ faction }) => faction === 'player');
}

function attackId(templateId, skillId) {
  return `enemy:${templateId}:${skillId}`;
}

function place(actor, x) {
  actor.position = { x, y: actor.position.y };
}

function allows(runtime, actor, skillOrAttack, target = party(runtime)[0]) {
  const id = skillOrAttack.includes(':') ? skillOrAttack : attackId(runtime.actorTemplates[actor.id], skillOrAttack);
  return runtime.spec.kernelConfig.statusHooks.canBeginAttack({ actor, attackId: id, target, kernel: runtime.kernel });
}

/** Pause every AI so a test drives exactly the attacks it requests. */
function pauseAi(runtime) {
  const saved = new Map();
  for (const actor of runtime.kernel.actors.values()) {
    saved.set(actor.id, actor.ai);
    actor.ai = null;
  }
  return () => {
    for (const [actorId, ai] of saved) runtime.kernel.getActor(actorId).ai = ai;
  };
}

/**
 * Drive one enemy attack to completion through the kernel, as an activation.
 * Companions always act, so the party is held far from the attacker.
 */
function complete(runtime, actor, id) {
  const resume = pauseAi(runtime);
  const heroes = party(runtime).map((hero) => ({ hero, x: hero.position.x }));
  const holdPartyAway = () => {
    for (const { hero } of heroes) place(hero, actor.position.x > 480 ? 60 : 900);
  };
  try {
    for (let step = 0; step < 400 && !runtime.kernel.getAttackState(actor.id, id).ready; step += 1) {
      holdPartyAway();
      runtime.kernel.step(1);
    }
    assert.equal(runtime.kernel.requestAttack(actor.id, id).ok, true, id);
    for (let step = 0; step < 200 && runtime.kernel.getActor(actor.id).activeAttack; step += 1) {
      holdPartyAway();
      runtime.kernel.step(1);
    }
    for (const { hero, x } of heroes) place(hero, x);
    assert.equal(runtime.kernel.getActor(actor.id).activeAttack, null, `${id} completes`);
    assert.equal(runtime.kernel.getActor(actor.id).staggerRemainingMs, 0, `${id} was not interrupted`);
  } finally {
    resume();
  }
}

function authoredLinesByTemplate() {
  const lines = new Map();
  const skills = new Map();
  for (const encounter of ENCOUNTERS) {
    for (const enemy of encounter.enemies) {
      const known = lines.get(enemy.id) ?? new Set();
      for (const line of enemy.ai ?? []) known.add(line);
      lines.set(enemy.id, known);
      const skillIds = skills.get(enemy.id) ?? new Set();
      for (const skill of enemy.skills ?? []) skillIds.add(skill.id);
      skills.set(enemy.id, skillIds);
    }
  }
  return { lines, skills };
}

test('every authored AI rule quotes its encounter line verbatim and covers every authored line', () => {
  const { lines, skills } = authoredLinesByTemplate();
  for (const [templateId, rules] of Object.entries(AUTHORED_ENEMY_AI)) {
    const authored = lines.get(templateId);
    assert.ok(authored, `${templateId} exists in encounter data`);
    const quoted = new Set();
    for (const [skillId, rule] of Object.entries(rules.skills)) {
      assert.ok(skills.get(templateId).has(skillId), `${templateId}:${skillId} is an authored skill`);
      for (const line of [rule.line, rule.also].filter((value) => value != null)) {
        assert.ok(authored.has(line), `${templateId}:${skillId} quotes "${line}" verbatim`);
        quoted.add(line);
      }
      if (rule.line == null) assert.match(rule.reason, /\S/u, `${templateId}:${skillId} explains its unauthored rule`);
    }
    for (const note of rules.notes ?? []) {
      assert.ok(authored.has(note.line), `${templateId} note quotes "${note.line}" verbatim`);
      assert.match(note.reason, /\S/u);
      quoted.add(note.line);
    }
    if (rules.idleActivations) {
      assert.ok(authored.has(rules.idleActivations.line), `${templateId} idle activation line is authored`);
      quoted.add(rules.idleActivations.line);
    }
    for (const skillId of rules.order) assert.ok(rules.skills[skillId], `${templateId} orders known skill ${skillId}`);
    assert.deepEqual([...authored].filter((line) => !quoted.has(line)), [], `${templateId} leaves no authored line untranslated`);
  }
});

test('every primary boss and named boss has authored priorities', () => {
  for (const encounter of ENCOUNTERS) {
    const bosses = [
      BOSS_FORMATS.has(encounter.format) ? encounter.enemies[0]?.id : null,
      encounter.objective?.bossId ?? null,
    ].filter(Boolean);
    for (const templateId of bosses) {
      assert.ok(AUTHORED_ENEMY_AI[templateId], `${encounter.id}: ${templateId} has an authored AI table`);
    }
  }
  for (const elite of ['tithe-enforcer', 'masked-clerk', 'dock-retainer', 'ashen-bailiff']) {
    assert.ok(AUTHORED_ENEMY_AI[elite], `${elite} has an authored AI table`);
  }
});

test('only explicitly authored self-casts skip the reach test', () => {
  assert.deepEqual([...authoredSelfCastKeys()], ['mateus:blood-ward']);
  const runtime = session('fp1-mateus');
  const flagged = Object.entries(runtime.spec.kernelConfig.attacks)
    .filter(([, attack]) => attack.selfCast)
    .map(([id]) => id);
  assert.deepEqual(flagged, ['enemy:mateus:blood-ward']);
  assert.equal(runtime.kernel.attacks['enemy:mateus:blood-ward'].selfCast, true);
});

test('Tithe Hound inks at range and mauls at adjacency, in authored priority', () => {
  const runtime = session('c1-tithe-hound');
  const hound = actorOf(runtime, 'tithe-hound');
  const [ren] = party(runtime);
  place(ren, 300);
  place(hound, 300 + ACTION_AI_TILE_PX);
  assert.equal(allows(runtime, hound, 'consume-ink', ren), false, 'adjacent: no Consume Ink');
  assert.equal(allows(runtime, hound, 'ledger-maul', ren), true);
  place(hound, 300 + 3 * ACTION_AI_TILE_PX);
  assert.equal(allows(runtime, hound, 'consume-ink', ren), true, '3+ distance: Consume Ink');
  assert.equal(allows(runtime, hound, 'ledger-maul', ren), false);
  place(hound, 300 + 2 * ACTION_AI_TILE_PX);
  assert.equal(allows(runtime, hound, 'consume-ink', ren) || allows(runtime, hound, 'ledger-maul', ren), false,
    'between the bands the hound approaches');
  const order = runtime.spec.kernelConfig.statusHooks.prioritizeAttacks({
    actor: hound, target: ren, attackIds: [attackId('tithe-hound', 'ledger-maul'), attackId('tithe-hound', 'consume-ink')], kernel: runtime.kernel,
  });
  assert.deepEqual(order, [attackId('tithe-hound', 'consume-ink'), attackId('tithe-hound', 'ledger-maul')]);
});

test('Mateus casts Blood Ward from range in phase two and gates Crimson Litany on warded strikes', () => {
  const runtime = session('fp1-mateus');
  const mateus = actorOf(runtime, 'mateus');
  for (const hero of party(runtime)) place(hero, 80);
  place(mateus, 800);
  mateus.hp = Math.floor(mateus.maxHp * 0.55);
  const events = [];
  for (let step = 0; step < 80; step += 1) {
    for (const hero of party(runtime)) place(hero, 80);
    events.push(...advanceActionCampaignBattle(runtime, 20).recentEvents);
  }
  assert.ok(events.some(({ type, toPhaseId }) => type === 'boss-phase-entered' && toPhaseId === 'phase-2'));
  assert.ok(events.some(({ type, actorId, attackId: id }) => type === 'attack-start' && actorId === mateus.id && id === 'enemy:mateus:blood-ward'),
    'Blood Ward begins although no hero is within its caster-centred hitbox');
  assert.equal(events.filter(({ type }) => type === 'summon-activated').length, 2);
  assert.equal(allows(runtime, mateus, 'blood-ward'), false, 'living wards block a recast');
  assert.equal(allows(runtime, mateus, 'crimson-litany'), false, 'no Litany before two warded strikes');
  const hooks = runtime.spec.kernelConfig.statusHooks;
  const strike = runtime.kernel.attacks['party:lise:hunter-thrust'];
  hooks.afterHit({ attacker: party(runtime)[0], target: mateus, attack: strike, event: { damage: 4 } });
  assert.equal(allows(runtime, mateus, 'crimson-litany'), false);
  hooks.afterHit({ attacker: party(runtime)[0], target: mateus, attack: strike, event: { damage: 4 } });
  assert.equal(allows(runtime, mateus, 'crimson-litany'), true);
  assert.equal(runtime.enemyAi.snapshot().wardedStrikes[mateus.id], 2);
});

test('Widow of Fog and Kurozane alternate their authored pairs', () => {
  const widowRuntime = session('c4-widow-of-fog');
  const widow = actorOf(widowRuntime, 'widow-of-fog');
  const [hero] = party(widowRuntime);
  place(hero, 300);
  place(widow, 340);
  assert.equal(allows(widowRuntime, widow, 'receding-call', hero), true);
  assert.equal(allows(widowRuntime, widow, 'name-drag', hero), true);
  complete(widowRuntime, widow, attackId('widow-of-fog', 'receding-call'));
  assert.equal(allows(widowRuntime, widow, 'receding-call', hero), false);
  assert.equal(allows(widowRuntime, widow, 'name-drag', hero), true);
  complete(widowRuntime, widow, attackId('widow-of-fog', 'name-drag'));
  assert.equal(allows(widowRuntime, widow, 'receding-call', hero), true);
  assert.equal(allows(widowRuntime, widow, 'name-drag', hero), false);

  const runtime = session('c9-kurozane');
  const kurozane = actorOf(runtime, 'kurozane');
  assert.equal(allows(runtime, kurozane, 'court-command'), true);
  assert.equal(allows(runtime, kurozane, 'yearless-thrust'), true);
  assert.equal(allows(runtime, kurozane, 'blood-eclipse'), false, 'Blood Eclipse belongs to the bell phase');
  assert.equal(allows(runtime, kurozane, 'black-chrysanthemum'), false, 'Black Chrysanthemum belongs to dawn');
  complete(runtime, kurozane, attackId('kurozane', 'court-command'));
  assert.equal(allows(runtime, kurozane, 'court-command'), false);
  assert.equal(allows(runtime, kurozane, 'yearless-thrust'), true);
  kurozane.hp = Math.floor(kurozane.maxHp * 0.6);
  advanceActionCampaignBattle(runtime, 20);
  assert.equal(runtime.bossPhaseDirector.phases[runtime.bossPhaseDirector.phaseIndex].id, 'bell');
  assert.deepEqual(
    ['court-command', 'yearless-thrust', 'blood-eclipse', 'black-chrysanthemum'].map((skill) => allows(runtime, kurozane, skill)),
    [false, false, true, false],
  );
  kurozane.hp = Math.floor(kurozane.maxHp * 0.3);
  advanceActionCampaignBattle(runtime, 20);
  assert.deepEqual(
    ['court-command', 'yearless-thrust', 'blood-eclipse', 'black-chrysanthemum'].map((skill) => allows(runtime, kurozane, skill)),
    [false, false, false, true],
  );
});

test('Captain Kaji surges every third activation and splits haul and cut by distance', () => {
  const runtime = session('c3-captain-kaji');
  const kaji = actorOf(runtime, 'captain-kaji');
  const [hero] = party(runtime);
  place(hero, 200);
  place(kaji, 200 + ACTION_AI_TILE_PX);
  assert.equal(allows(runtime, kaji, 'salt-cut', hero), true);
  assert.equal(allows(runtime, kaji, 'chain-haul', hero), false);
  place(kaji, 200 + 4 * ACTION_AI_TILE_PX);
  assert.equal(allows(runtime, kaji, 'salt-cut', hero), false);
  assert.equal(allows(runtime, kaji, 'chain-haul', hero), true);
  assert.equal(allows(runtime, kaji, 'crane-surge', hero), false, 'first activation');
  complete(runtime, kaji, attackId('captain-kaji', 'salt-cut'));
  assert.equal(allows(runtime, kaji, 'crane-surge', hero), false, 'second activation');
  complete(runtime, kaji, attackId('captain-kaji', 'salt-cut'));
  assert.equal(allows(runtime, kaji, 'crane-surge', hero), true, 'every third activation');
  complete(runtime, kaji, attackId('captain-kaji', 'crane-surge'));
  assert.equal(allows(runtime, kaji, 'crane-surge', hero), false);
});

test('Furnace Abbot counts advancing activations toward its third-activation sermon', () => {
  const runtime = session('c5-furnace-abbot');
  const abbot = actorOf(runtime, 'furnace-abbot');
  const heroes = party(runtime);
  assert.equal(allows(runtime, abbot, 'forge-sermon', heroes[0]), false);
  for (const hero of heroes) place(hero, abbot.position.x - 100);
  assert.equal(allows(runtime, abbot, 'hammer-decree', heroes[0]), heroes.length >= 2,
    'Hammer Decree needs two targets in front');
  place(heroes[0], abbot.position.x - 100);
  if (heroes[1]) place(heroes[1], 60);
  assert.equal(allows(runtime, abbot, 'hammer-decree', heroes[0]), false);

  // Hold the party out of reach: the Abbot spends whole cadences advancing.
  const passed = [];
  for (let step = 0; step < 400 && passed.length < 2; step += 1) {
    for (const hero of heroes) place(hero, 60);
    place(abbot, 900);
    abbot.activeAttack = null;
    runtime.kernel.step(1);
    passed.push(...runtime.kernel.drainEvents().filter(({ type, actorId }) => type === 'enemy-activation-passed' && actorId === abbot.id));
  }
  assert.deepEqual(passed.map(({ activation }) => activation), [1, 2]);
  assert.equal(allows(runtime, abbot, 'forge-sermon', heroes[0]), true, 'the third activation is a sermon');
});

test('Ujiro calls clerks only while fewer than two live; Chiyo rings her bell only when surrounded', () => {
  const runtime = session('c6-ujiro');
  const ujiro = actorOf(runtime, 'ujiro');
  assert.equal(allows(runtime, ujiro, 'call-clerks'), true);
  for (const clerk of [actorOf(runtime, 'masked-clerk', 0), actorOf(runtime, 'masked-clerk', 1)]) clerk.hp = clerk.maxHp;
  assert.equal(allows(runtime, ujiro, 'call-clerks'), false);
  assert.equal(allows(runtime, ujiro, 'gavel-line'), true);

  const rescue = session('c7-bell-warden-chiyo');
  const chiyo = actorOf(rescue, 'bell-warden-chiyo');
  const [first, second] = party(rescue);
  place(chiyo, 500);
  place(first, 500 - ACTION_AI_TILE_PX);
  place(second, 900);
  assert.equal(allows(rescue, chiyo, 'warden-bell', first), false, 'one hero is not a surround');
  place(second, 500 - ACTION_AI_ADJACENT_PX + 8);
  assert.equal(allows(rescue, chiyo, 'warden-bell', first), true, 'two heroes inside the bell guard');
  place(second, 500 + ACTION_AI_TILE_PX);
  assert.equal(allows(rescue, chiyo, 'warden-bell', first), true, 'heroes on both sides');
  assert.equal(allows(rescue, chiyo, 'chain-cast', first), true);
});

test('Lady Enma follows each arena: mirror step at adjacency, writs after a clerk seizes, paired ashes on alternate activations', () => {
  const docks = session('c3-dock-patrol');
  const enmaDocks = actorOf(docks, 'lady-enma');
  const [hero] = party(docks);
  place(hero, 300);
  place(enmaDocks, 340);
  assert.equal(allows(docks, enmaDocks, 'rain-mirror-step', hero), true);
  assert.equal(allows(docks, enmaDocks, 'cinder-fan-draw', hero), false);
  place(enmaDocks, 600);
  assert.equal(allows(docks, enmaDocks, 'rain-mirror-step', hero), false);
  assert.equal(allows(docks, enmaDocks, 'cinder-fan-draw', hero), true);
  const retainer = actorOf(docks, 'dock-retainer');
  place(retainer, 340);
  assert.equal(allows(docks, retainer, 'baton-check', hero), true);
  assert.equal(allows(docks, retainer, 'dock-hook', hero), false);

  const roof = session('c6-masked-clerks');
  const enmaRoof = actorOf(roof, 'lady-enma');
  const clerk = actorOf(roof, 'masked-clerk');
  assert.equal(allows(roof, enmaRoof, 'mirror-writ'), false, 'no clerk writ declared yet');
  complete(roof, clerk, attackId('masked-clerk', 'seize-copy'));
  assert.equal(allows(roof, enmaRoof, 'mirror-writ'), true);
  complete(roof, enmaRoof, attackId('lady-enma', 'mirror-writ'));
  assert.equal(allows(roof, enmaRoof, 'mirror-writ'), false, 'each writ reflects only the latest declaration');
  const [defender] = party(roof);
  place(clerk, 400);
  place(defender, 400 + 3 * ACTION_AI_TILE_PX);
  assert.equal(allows(roof, clerk, 'seal-snap', defender), false, 'Seal Snap only when blocked');
  place(defender, 430);
  assert.equal(allows(roof, clerk, 'seal-snap', defender), true);

  const court = session('c8-lady-enma');
  const enma = actorOf(court, 'lady-enma');
  const [lead, support] = party(court);
  assert.equal(allows(court, enma, 'paired-ashes', lead), false, 'the first activation is not Paired Ashes');
  complete(court, enma, attackId('lady-enma', 'abandonment-cry'));
  assert.equal(allows(court, enma, 'paired-ashes', lead), true, 'every other activation');
  complete(court, enma, attackId('lady-enma', 'paired-ashes'));
  assert.equal(allows(court, enma, 'paired-ashes', lead), false, 'never twice in a row');
  assert.equal(allows(court, enma, 'cinder-parasol-wing', lead), false, 'the wing waits for its phase');
  place(lead, 200);
  if (support) place(support, 220);
  assert.equal(allows(court, enma, 'abandonment-cry', lead), false, 'a covered ally is not isolated');
  if (support) place(support, 800);
  assert.equal(allows(court, enma, 'abandonment-cry', lead), true);
  enma.hp = Math.floor(enma.maxHp * 0.5);
  advanceActionCampaignBattle(court, 20);
  assert.equal(allows(court, enma, 'cinder-parasol-wing', lead), true);
});

test('the Yearless Bell alternates its radius 3 and radius 2 rings; the Bailiff sweeps only a reachable line', () => {
  const runtime = session('c9-yearless-bell');
  const bell = actorOf(runtime, 'yearless-bell');
  assert.deepEqual(bell.attackIds, ['enemy:yearless-bell:yearless-ring', 'enemy:yearless-bell:yearless-ring@r2']);
  const outer = runtime.kernel.attacks['enemy:yearless-bell:yearless-ring'].hitbox.width;
  const inner = runtime.kernel.attacks['enemy:yearless-bell:yearless-ring@r2'].hitbox.width;
  assert.ok(inner < outer, `radius 2 (${inner}) is smaller than radius 3 (${outer})`);
  const rings = [];
  for (let step = 0; step < 600 && rings.length < 4; step += 1) {
    advanceActionCampaignBattle(runtime, 20).recentEvents
      .filter(({ type, actorId }) => type === 'attack-start' && actorId === bell.id)
      .forEach(({ attackId: id }) => rings.push(id));
  }
  assert.deepEqual(rings, [
    'enemy:yearless-bell:yearless-ring',
    'enemy:yearless-bell:yearless-ring@r2',
    'enemy:yearless-bell:yearless-ring',
    'enemy:yearless-bell:yearless-ring@r2',
  ]);

  const escape = session('prologue-ashen-bailiff');
  const bailiff = actorOf(escape, 'ashen-bailiff');
  const [ren] = party(escape);
  bailiff.facing = -1;
  place(bailiff, 600);
  place(ren, 450);
  assert.equal(allows(escape, bailiff, 'census-sweep', ren), true, 'Ren stands in the line');
  place(ren, 100);
  assert.equal(allows(escape, bailiff, 'census-sweep', ren), false);
  assert.equal(allows(escape, bailiff, 'ash-step', ren), true);
});

test('an authored HP phase change refills boss poise', () => {
  const runtime = session('c1-tithe-hound');
  const hound = actorOf(runtime, 'tithe-hound');
  assert.equal(hound.maxPoise, 4, 'primary bosses carry boss poise');
  hound.poise = 1;
  hound.hp = Math.floor(hound.maxHp * 0.5);
  advanceActionCampaignBattle(runtime, 20);
  assert.equal(hound.poise, hound.maxPoise);
  const events = advanceActionCampaignBattle(runtime, 20).recentEvents;
  assert.ok(events.some(({ type, actorId, reason }) => type === 'poise-restored' && actorId === hound.id && reason === 'phase-change'));
});

test('the kernel begins the authored priority, not the first attack in list order', () => {
  const runtime = session('c3-captain-kaji');
  const kaji = actorOf(runtime, 'captain-kaji');
  const heroes = party(runtime);
  complete(runtime, kaji, attackId('captain-kaji', 'salt-cut'));
  complete(runtime, kaji, attackId('captain-kaji', 'salt-cut'));
  const resume = pauseAi(runtime);
  for (let step = 0; step < 400 && !runtime.kernel.getAttackState(kaji.id, attackId('captain-kaji', 'crane-surge')).ready; step += 1) {
    runtime.kernel.step(1);
  }
  for (const hero of heroes) place(hero, kaji.position.x - 3 * ACTION_AI_TILE_PX);
  kaji.facing = -1;
  kaji.ai = 'deterministic-chase';
  runtime.kernel.drainEvents();
  runtime.kernel.step(1);
  resume();
  const decision = runtime.kernel.drainEvents().find(({ type, actorId }) => type === 'enemy-decision' && actorId === kaji.id);
  assert.equal(decision?.attackId, attackId('captain-kaji', 'crane-surge'),
    'Crane Surge outranks Chain Haul on the third activation even though Chain Haul is listed first');
});
