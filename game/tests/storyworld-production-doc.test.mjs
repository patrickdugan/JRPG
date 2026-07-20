import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  STORYWORLD_CLUSTERS,
  STORYWORLD_METRICS,
} from '../content/storyworld-encounters.generated.mjs';
import { STORYWORLD_PACING_REPORT } from '../storyworld-pacing.mjs';

const DOC = readFileSync(
  new URL('../../docs/22-storyworld-sequence-production-map.md', import.meta.url),
  'utf8',
);

const placementLabel = Object.freeze({
  'after-level-consequence': 'after level',
  'after-boss-consequence': 'after boss',
  'before-boss-decision': 'before boss',
});

test('production map covers every generated sequence binding and consequence title', () => {
  assert.equal(STORYWORLD_CLUSTERS.length, 10);
  for (const cluster of STORYWORLD_CLUSTERS) {
    assert.match(DOC, new RegExp(`\\b${cluster.id}\\b`));
    assert.match(DOC, new RegExp(`\\b${cluster.anchorBeatId}\\b`));
    assert.match(DOC, new RegExp(`placement: \\*\\*${placementLabel[cluster.sequenceRole]}\\*\\*`));
    for (const encounterId of cluster.relatedEncounterIds) {
      assert.match(DOC, new RegExp(`\\b${encounterId}\\b`));
    }
    for (const outcome of cluster.outcomes) {
      assert.ok(DOC.includes(`**${outcome.title}**`), `missing consequence title ${outcome.title}`);
    }
  }
});

test('production map locks authored-versus-played arithmetic and core guardrails', () => {
  assert.equal(STORYWORLD_METRICS.authoredSceneCount, 90);
  assert.equal(STORYWORLD_METRICS.completeRunSceneCount, 80);
  assert.match(DOC, /\*\*90 scenes\*\*/);
  assert.match(DOC, /\*\*80 played scenes\*\*/);
  assert.equal(STORYWORLD_PACING_REPORT.withinFiveToSixHourTarget, true);
  assert.match(DOC, /323\.733 minutes \(about 5\.40 hours\)/);
  assert.match(DOC, /Sacred and devotional objects are not loot/);
  assert.match(DOC, /Japanese organizers, witnesses, crews, and custodians retain authority/);
  assert.match(DOC, /not absolution, command authority, private access, restored office/);
  assert.match(DOC, /no celebrity or actor likeness is permitted/);
});
