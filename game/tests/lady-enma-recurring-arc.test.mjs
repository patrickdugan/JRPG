import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';
import { STORYWORLD_CLUSTERS } from '../content/storyworld-encounters.generated.mjs';

const encounterById = new Map(ENCOUNTERS.map((encounter) => [encounter.id, encounter]));

test('Lady Enma escalates through three authored boss encounters without an early kill', () => {
  const expected = [
    ['c3-dock-patrol', 'lady-enma', 'first-mask-broken', 0.55],
    ['c6-masked-clerks', 'lady-enma', 'second-mask-broken', 0.30],
    ['c8-lady-enma', 'lady-enma', 'subdued-for-terms', 0.01],
  ];
  for (const [encounterId, enemyId, finalPhaseId, threshold] of expected) {
    const encounter = encounterById.get(encounterId);
    assert.ok(encounter, encounterId);
    const enma = encounter.enemies.find(({ id }) => id === enemyId);
    assert.ok(enma, `${encounterId}:${enemyId}`);
    assert.equal(enma.role.includes('vampire'), true);
    assert.equal(enma.skills.some(({ recoveryPulses }) => recoveryPulses === 3), true);
    const finalPhase = encounter.bossMechanic.phases.at(-1);
    assert.equal(finalPhase.id, finalPhaseId);
    assert.equal(finalPhase.enter.value, threshold);
  }
  assert.match(encounterById.get('c3-dock-patrol').bossMechanic.phases.at(-1).rule, /cannot be killed/u);
  assert.match(encounterById.get('c6-masked-clerks').bossMechanic.phases.at(-1).rule, /cannot be killed/u);
  assert.match(encounterById.get('c8-lady-enma').bossMechanic.phases.at(-1).rule, /death, rotating custody, or bounded defection/u);
});

test('campaign and pixel-art inventories bind the same original recurring antagonist', () => {
  const chapter = CAMPAIGN.chapters.find(({ id }) => id === 'chapter-8');
  assert.deepEqual(chapter.boss.recurringEncounterIds, ['c3-dock-patrol', 'c6-masked-clerks', 'c8-lady-enma']);
  assert.match(chapter.boss.role, /former court entertainer/u);

  const source = JSON.parse(readFileSync(
    new URL('../../assets/art/boss-combat-suite/boss-combat-suite.source.json', import.meta.url),
    'utf8',
  ));
  const enma = source.bosses.find(({ id }) => id === 'lady-enma');
  assert.deepEqual(enma.recurringEncounterIds, chapter.boss.recurringEncounterIds);
  assert.match(enma.motif, /folding fan/u);
  assert.match(enma.motif, /paper parasol/u);
  assert.match(enma.likenessPolicy, /no copyrighted character, actor, or celebrity likeness/u);
  assert.equal(enma.resolution, 'subdued-for-death-custody-or-compact');
});

test('Cinder Fan spool exposes three distinct and reachable consequence keys', () => {
  const cluster = STORYWORLD_CLUSTERS.find(({ id }) => id === 'sw-enma-three-terms');
  assert.ok(cluster);
  assert.equal(cluster.anchorBeatId, 'c8-05-gate-opened');
  assert.deepEqual(cluster.relatedEncounterIds, ['c8-lady-enma']);
  assert.deepEqual(cluster.outcomes.map(({ resolutionKey }) => resolutionKey), ['accord', 'revision', 'negotiated']);
  assert.deepEqual(cluster.outcomes.map(({ title }) => title), [
    'Custody Without a Trophy',
    'The Cinder Fan Ends',
    'A Defection Under Witness',
  ]);
  const consequenceIds = new Set(cluster.entry.options.flatMap((option) => (
    option.reactions.map(({ consequenceId }) => consequenceId)
  )));
  assert.deepEqual(consequenceIds, new Set(cluster.outcomes.map(({ id }) => id)));
});
