import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { STORYWORLD_METRICS } from '../content/storyworld-encounters.generated.mjs';
import { STORYWORLD_PACING_REPORT } from '../storyworld-pacing.mjs';
import { STORYWORLD_CLUSTERS as STORYWORLD_SOURCE_CLUSTERS } from '../../storyworlds/bells-black-chrysanthemum.source.mjs';

const DOC = readFileSync(
  new URL('../../docs/22-storyworld-sequence-production-map.md', import.meta.url),
  'utf8',
);

const placementLabel = Object.freeze({
  'after-level-consequence': 'after level',
  'after-boss-consequence': 'after boss',
  'before-boss-decision': 'before boss',
});

test('production map covers every authored sequence binding and consequence title', () => {
  const roleCounts = {};
  assert.equal(STORYWORLD_SOURCE_CLUSTERS.length, 10);
  for (const cluster of STORYWORLD_SOURCE_CLUSTERS) {
    roleCounts[cluster.sequenceRole] = (roleCounts[cluster.sequenceRole] ?? 0) + 1;
    assert.match(DOC, new RegExp(`\\b${cluster.id}\\b`));
    assert.match(DOC, new RegExp(`\\b${cluster.anchorBeatId}\\b`));
    assert.match(DOC, new RegExp(`placement: \\*\\*${placementLabel[cluster.sequenceRole]}\\*\\*`));
    for (const encounterId of cluster.relatedEncounterIds) {
      assert.match(DOC, new RegExp(`\\b${encounterId}\\b`));
    }
    for (const outcome of [cluster.accordOutcome, cluster.revisionOutcome]) {
      assert.ok(DOC.includes(`**${outcome.title}**`), `missing consequence title ${outcome.title}`);
    }
  }
  assert.deepEqual(roleCounts, {
    'after-level-consequence': 2,
    'after-boss-consequence': 3,
    'before-boss-decision': 5,
  });
});

test('production map locks authored-versus-played arithmetic and core guardrails', () => {
  assert.equal(STORYWORLD_METRICS.authoredSceneCount, 90);
  assert.equal(STORYWORLD_METRICS.completeRunSceneCount, 80);
  assert.match(DOC, /\*\*90 scenes\*\*/);
  assert.match(DOC, /\*\*80 played scenes\*\*/);
  assert.equal(STORYWORLD_PACING_REPORT.withinFiveToSixHourTarget, true);
  assert.match(DOC, /326\.010 minutes \(about 5\.43 hours\)/);
  assert.match(DOC, /\*\*The Last Command\*\*/u);
  assert.match(DOC, /\*\*The Seals Returned\*\* \/ \*\*The Empty Throne Mobilizes\*\*/u);
  assert.match(DOC, /Sacred and devotional objects are not loot/);
  assert.match(DOC, /Japanese organizers, witnesses, crews, and custodians retain authority/);
  assert.match(DOC, /not absolution, command authority, private access, restored office/);
  assert.match(DOC, /no celebrity or actor likeness is permitted/);
});
