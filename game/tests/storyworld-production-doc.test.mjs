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
const MASTER_PLAN = readFileSync(
  new URL('../../docs/38-five-act-master-storyworld-plan.md', import.meta.url),
  'utf8',
);

const placementLabel = Object.freeze({
  'act-route-decision': 'act route',
  'after-level-consequence': 'after level',
  'after-boss-consequence': 'after boss',
  'before-boss-decision': 'before boss',
});

test('production map covers every authored sequence binding and consequence title', () => {
  const roleCounts = {};
  assert.equal(STORYWORLD_SOURCE_CLUSTERS.length, 12);
  for (const cluster of STORYWORLD_SOURCE_CLUSTERS) {
    roleCounts[cluster.sequenceRole] = (roleCounts[cluster.sequenceRole] ?? 0) + 1;
    assert.match(DOC, new RegExp(`\\b${cluster.id}\\b`));
    assert.match(DOC, new RegExp(`\\b${cluster.anchorBeatId}\\b`));
    assert.match(DOC, new RegExp(`placement: \\*\\*${placementLabel[cluster.sequenceRole]}\\*\\*`));
    for (const encounterId of cluster.relatedEncounterIds) {
      assert.match(DOC, new RegExp(`\\b${encounterId}\\b`));
    }
    for (const outcome of [cluster.accordOutcome, cluster.revisionOutcome, cluster.thirdOutcome].filter(Boolean)) {
      assert.ok(DOC.includes(`**${outcome.title}**`), `missing consequence title ${outcome.title}`);
    }
  }
  assert.deepEqual(roleCounts, {
    'after-level-consequence': 2,
    'after-boss-consequence': 5,
    'act-route-decision': 1,
    'before-boss-decision': 4,
  });
});

test('production map locks authored-versus-played arithmetic and core guardrails', () => {
  assert.equal(STORYWORLD_METRICS.authoredSceneCount, 100);
  assert.deepEqual(STORYWORLD_METRICS.completeRunSceneCountRange, { minimum: 76, maximum: 77 });
  assert.match(DOC, /\*\*100 scenes\*\*/);
  assert.match(DOC, /\*\*76 played scenes\*\*/);
  assert.match(DOC, /\*\*77 played scenes\*\*/);
  assert.equal(STORYWORLD_PACING_REPORT.diagnosticOnly, true);
  assert.match(DOC, /\*\*The Last Command\*\*/u);
  assert.match(
    DOC,
    /\*\*The Seals Returned\*\* \/ \*\*The Last Seal at Dawn\*\* \/ \*\*The Necessary Blade\*\* \/ \*\*The Empty Throne Mobilizes\*\*/u,
  );
  assert.match(DOC, /\*\*Custody Without a Trophy\*\* \/ \*\*The Cinder Fan Ends\*\* \/ \*\*A Defection Under Witness\*\*/u);
  assert.match(DOC, /Sacred and devotional objects are not loot/);
  assert.match(DOC, /Japanese organizers, witnesses, crews, and custodians retain authority/);
  assert.match(DOC, /not absolution, command authority, private access, restored office/);
  assert.match(DOC, /no celebrity or actor likeness is permitted/);
});

test('five-act master plan locks dramatic authority and the Act III-IV conversion contract', () => {
  for (const act of [
    'Act I — The Hidden Shore',
    'Act II — The Bishop Beneath the Bell',
    'Act III — The Three-Road War',
    'Act IV — The Black Gate',
    'Act V — The Living Castle',
  ]) {
    assert.ok(MASTER_PLAN.includes(act), act);
  }
  assert.match(MASTER_PLAN, /compatibility seams, not instructions to restore superseded characterization/u);
  assert.match(MASTER_PLAN, /five player tactics, thirteen deterministic confrontation flows, and four political endings/u);
  assert.match(MASTER_PLAN, /No Act III–IV revision in this plan adds another state property/u);
  assert.match(MASTER_PLAN, /inherited anti-vampire authority becomes publicly limited technique/u);
  assert.match(MASTER_PLAN, /a confession about machinery becomes an actionable release map/u);
  assert.match(MASTER_PLAN, /a public accusation becomes a distributed inventory of offices/u);
  assert.match(MASTER_PLAN, /rescue and refusal become a garrison stand-down/u);
  assert.match(MASTER_PLAN, /all thirteen final confrontation flows remain reachable/u);
});
