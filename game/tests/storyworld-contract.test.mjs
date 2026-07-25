import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CAMPAIGN } from '../content/campaign.mjs';
import {
  STORYWORLD_CATALOG,
  STORYWORLD_CLUSTERS,
  STORYWORLD_METRICS,
  STORYWORLD_PROPERTIES,
} from '../content/storyworld-encounters.generated.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..');
const ROOT = path.resolve(GAME, '..');
const wordCount = (value) => value.trim().split(/\s+/u).length;

test('generated Storyworld catalog supplies ninety-five authored scenes and exact nonlinear route totals', () => {
  assert.deepEqual(STORYWORLD_METRICS, {
    canonicalSceneCount: 60,
    storyworldAuthoredSceneCount: 35,
    authoredSceneCount: 95,
    narrativeRoutes: {
      salt: { canonicalSceneCount: 55, storyworldSceneCount: 20, playedSceneCount: 75 },
      ash: { canonicalSceneCount: 54, storyworldSceneCount: 20, playedSceneCount: 74 },
      paper: { canonicalSceneCount: 55, storyworldSceneCount: 22, playedSceneCount: 77 },
    },
    completeRunStoryworldSceneCountRange: { minimum: 20, maximum: 22 },
    completeRunSceneCountRange: { minimum: 74, maximum: 77 },
    clusterCount: 11,
    entryOptionCount: 33,
  });
  assert.equal(STORYWORLD_CLUSTERS.length, 11);
  assert.equal(Object.isFrozen(STORYWORLD_CATALOG), true);
  assert.equal(Object.isFrozen(STORYWORLD_CLUSTERS[0].entry.options[0].reactions[0].effects), true);
});
test('eleven exact anchors cover the Act III route decision plus post-level, pre-boss, and post-boss sequencing', () => {
  const canonical = new Map(CAMPAIGN.chapters.flatMap((chapter) => (
    chapter.beats.map((beat) => [beat.id, { chapterId: chapter.id, encounterIds: beat.encounterIds ?? [] }])
  )));
  const anchors = new Set();
  const roleCounts = new Map();
  for (const cluster of STORYWORLD_CLUSTERS) {
    const anchor = canonical.get(cluster.anchorBeatId);
    assert.ok(anchor, cluster.anchorBeatId);
    assert.equal(anchor.chapterId, cluster.chapterId);
    assert.equal(anchors.has(cluster.anchorBeatId), false);
    anchors.add(cluster.anchorBeatId);
    assert.ok(['before-beat', 'after-beat'].includes(cluster.placement));
    assert.ok(['act-route-decision', 'after-level-consequence', 'before-boss-decision', 'after-boss-consequence'].includes(cluster.sequenceRole));
    roleCounts.set(cluster.sequenceRole, (roleCounts.get(cluster.sequenceRole) ?? 0) + 1);
    if (cluster.sequenceRole.includes('boss')) {
      assert.ok(cluster.relatedEncounterIds.length > 0, cluster.id);
      assert.deepEqual(cluster.relatedEncounterIds, anchor.encounterIds);
    }
  }
  assert.deepEqual(Object.fromEntries(roleCounts), {
    'after-level-consequence': 2,
    'after-boss-consequence': 4,
    'act-route-decision': 1,
    'before-boss-decision': 4,
  });
  assert.equal(canonical.size, 60);
});

test('every decision and reaction meets the authored density, bounded-effect, and identity floors', () => {
  const propertyIds = new Set(STORYWORLD_PROPERTIES.map(({ id }) => id));
  const encounterIds = new Set();
  const optionIds = new Set();
  const reactionIds = new Set();
  let terminalCount = 0;
  for (const cluster of STORYWORLD_CLUSTERS) {
    const encounters = [cluster.entry, ...cluster.outcomes];
    assert.equal(cluster.entry.options.length, 3, cluster.id);
    assert.equal(
      cluster.outcomes.length,
      ['sw3-sayos-warehouse-conditions', 'sw-enma-three-terms'].includes(cluster.id) ? 3 : 2,
      cluster.id,
    );
    for (const encounter of encounters) {
      assert.equal(encounterIds.has(encounter.id), false, encounter.id);
      encounterIds.add(encounter.id);
      assert.ok(wordCount(encounter.text) >= 50, `${encounter.id} has ${wordCount(encounter.text)} words`);
      assert.ok(wordCount(encounter.text) <= 300, encounter.id);
      if (encounter.terminal) {
        terminalCount += 1;
        assert.equal(encounter.options.length, 0);
        assert.match(encounter.id, /^page_end/u);
        continue;
      }
      assert.ok(encounter.options.length >= 1);
      for (const option of encounter.options) {
        assert.equal(optionIds.has(option.id), false, option.id);
        optionIds.add(option.id);
        assert.equal(option.visible, true);
        assert.equal(option.performable, true);
        assert.equal(option.reactions.length, 2, option.id);
        for (const reaction of option.reactions) {
          assert.equal(reactionIds.has(reaction.id), false, reaction.id);
          reactionIds.add(reaction.id);
          assert.ok(wordCount(reaction.text) >= 20, `${reaction.id} has ${wordCount(reaction.text)} words`);
          assert.ok(wordCount(reaction.text) <= 150, reaction.id);
          const scoreTerms = reaction.score.terms ?? [{
            propertyId: reaction.score.propertyId,
            coefficient: 1,
          }];
          assert.ok(scoreTerms.length >= 1);
          for (const term of scoreTerms) {
            assert.ok(propertyIds.has(term.propertyId));
            assert.ok(Number.isFinite(term.coefficient));
            assert.ok(term.coefficient > 0);
          }
          assert.ok(reaction.effects.length >= 3, reaction.id);
          for (const effect of reaction.effects) {
            assert.ok(propertyIds.has(effect.propertyId));
            assert.ok(Number.isFinite(effect.delta));
            assert.ok(Math.abs(effect.delta) <= 0.1);
          }
        }
      }
    }
  }
  assert.equal(encounterIds.size, 35);
  assert.equal(optionIds.size, 55);
  assert.equal(reactionIds.size, 110);
  assert.equal(terminalCount, 2);
});

test('authored JSON, binding sidecar, and browser registry remain deterministic generated artifacts', () => {
  const run = spawnSync(process.execPath, ['tools/build-storyworld.mjs', '--check'], {
    cwd: GAME,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /generated artifacts are current/u);
  const world = JSON.parse(fs.readFileSync(path.join(ROOT, 'storyworlds', 'bells-black-chrysanthemum.storyworld.json'), 'utf8'));
  const bindings = JSON.parse(fs.readFileSync(path.join(ROOT, 'storyworlds', 'bells-black-chrysanthemum.bindings.json'), 'utf8'));
  assert.equal(world.encounters.length, 35);
  assert.equal(world.meta.complete_run_total_scene_count, 82);
  assert.equal(world.spools.length, 6);
  assert.equal(world.spools.filter(({ starts_active: startsActive }) => startsActive).length, 1);
  assert.equal(world.spools.some(({ id }) => id === 'spool_enma'), true);
  assert.equal(world.spools.some((spool) => Object.hasOwn(spool, 'spool_type')), false);
  assert.equal(bindings.authoredSceneCount, 35);
  assert.equal(bindings.clusters.length, 11);
  const routeRequirements = Object.fromEntries(
    bindings.clusters.map(({ id, requiredOnRoutes }) => [id, requiredOnRoutes]),
  );
  assert.deepEqual(routeRequirements['sw4-margin-varga-journal'], ['salt', 'paper']);
  assert.deepEqual(routeRequirements['sw5-cipher-handoff'], ['salt', 'ash', 'paper']);
  assert.deepEqual(routeRequirements['sw6-tribunal-afterword'], ['ash', 'paper']);
  assert.equal(
    bindings.clusters.every(({ requiredForNarrativeCredits, requiredOnRoutes }) => (
      requiredForNarrativeCredits === (requiredOnRoutes.length === 3)
    )),
    true,
  );
  assert.equal(bindings.clusters.find(({ id }) => id === 'sw3-sayos-warehouse-conditions').actIntegration.majorSequenceId, 'act3-sequence-01');
  assert.equal(bindings.clusters.find(({ id }) => id === 'sw9-mateus-living-archive').actIntegration.majorSequenceId, 'act5-sequence-03');
  assert.equal(bindings.clusters.find(({ id }) => id === 'sw10-corrections-desk').actIntegration.majorSequenceId, 'act5-sequence-04');
});
