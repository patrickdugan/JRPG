import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  labelBoxesOverlap,
  layoutCanvasLabels,
  shortenActorName,
} from '../action-label-layout.mjs';

function assertNoOverlap(result, obstacles = [], requests = []) {
  const visible = result.labels.filter((label) => !label.hidden);
  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      assert.equal(labelBoxesOverlap(visible[i], visible[j]), false, `${visible[i].id} overlaps ${visible[j].id}`);
    }
  }
  result.labels.forEach((label, index) => {
    if (label.hidden) return;
    for (const obstacle of obstacles) {
      if (obstacle.only != null && obstacle.only !== requests[index]?.type) continue;
      assert.equal(labelBoxesOverlap(label, obstacle), false, `${label.id} overlaps an obstacle`);
    }
    assert.ok(label.left >= 0 && label.right <= 960 && label.top >= 0 && label.bottom <= 540, `${label.id} leaves the canvas`);
  });
}

// Deterministic linear congruential generator for stress fixtures.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

test('c9-kurozane fighters standing together no longer render overlapping names', () => {
  // Nikola (controlled) and Father Mateus Avelar spawn 54 px apart on the observatory floor.
  const requests = [
    { id: 'actor:lise', type: 'actor', x: 122, bottom: 334, width: 104, shortWidth: 46, height: 22, priority: 0, lockFull: true },
    { id: 'actor:mateus', type: 'actor', x: 176, bottom: 334, width: 128, shortWidth: 46, height: 22, priority: 1 },
    { id: 'actor:kurozane-1', type: 'actor', x: 718, bottom: 314, width: 98, shortWidth: 58, height: 12, priority: 3 },
  ];
  const result = layoutCanvasLabels(requests);
  assertNoOverlap(result);
  const [lise, mateus, boss] = result.labels;
  assert.equal(lise.hidden, false);
  assert.equal(lise.short, false, 'the controlled fighter keeps the full name');
  assert.equal(lise.lift, 0, 'the controlled fighter keeps the preferred position');
  assert.equal(mateus.hidden, false);
  assert.ok(mateus.lift > 0 || mateus.short, 'the support label is stacked or shortened');
  assert.equal(boss.lift, 0);
  assert.deepEqual(result.summary, { placed: 3, shortened: mateus.short ? 1 : 0, moved: mateus.lift !== 0 ? 1 : 0, hidden: 0 });
});

test('crowded label clusters never overlap, stay in bounds, and respect typed obstacles', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const next = random(seed);
    const count = 3 + Math.floor(next() * 12);
    const requests = Array.from({ length: count }, (_, index) => {
      const type = next() < 0.6 ? 'actor' : 'objective';
      const width = 30 + Math.floor(next() * 120);
      return {
        id: `label-${index}`,
        type,
        x: 80 + Math.floor(next() * 200),
        bottom: 200 + Math.floor(next() * 220),
        width,
        shortWidth: Math.max(12, Math.floor(width * next())),
        height: type === 'actor' ? 22 : 12,
        priority: Math.floor(next() * 5),
        lockFull: index === 0,
        maxLift: type === 'objective' ? 2 : undefined,
        fallbackBottoms: type === 'objective' ? [460, 474] : undefined,
      };
    });
    const obstacles = [
      { left: 120, top: 300, right: 150, bottom: 306 },
      { left: 90, top: 330, right: 140, bottom: 440, only: 'objective' },
    ];
    const result = layoutCanvasLabels(requests, { obstacles });
    assertNoOverlap(result, obstacles, requests);
    assert.equal(result.labels.length, requests.length);
    assert.equal(result.summary.placed + result.summary.hidden, requests.length);
  }
});

test('layout is deterministic and independent of request order', () => {
  const requests = [
    { id: 'a', type: 'actor', x: 200, bottom: 300, width: 90, shortWidth: 40, height: 22, priority: 1 },
    { id: 'b', type: 'actor', x: 220, bottom: 300, width: 110, shortWidth: 44, height: 22, priority: 1 },
    { id: 'c', type: 'actor', x: 240, bottom: 290, width: 70, shortWidth: 30, height: 12, priority: 3 },
    { id: 'd', type: 'objective', x: 210, bottom: 330, width: 80, shortWidth: 40, height: 12, priority: 2, maxLift: 2, fallbackBottoms: [470] },
  ];
  const first = layoutCanvasLabels(requests);
  assert.deepEqual(layoutCanvasLabels(requests), first);
  const byId = Object.fromEntries(first.labels.map((label) => [label.id, label]));
  const reversed = layoutCanvasLabels([...requests].reverse());
  for (const label of reversed.labels) assert.deepEqual(label, byId[label.id]);
  assertNoOverlap(first);
});

test('typed obstacles push objective tags below the feet instead of over a fighter', () => {
  const body = { left: 200, top: 356, right: 244, bottom: 448, only: 'objective' };
  const tag = { id: 'objective:testimony-table', type: 'objective', x: 226, bottom: 384, width: 150, shortWidth: 70, height: 12, priority: 2, maxLift: 2, fallbackBottoms: [464, 478] };
  const result = layoutCanvasLabels([tag], { obstacles: [body] });
  assert.equal(result.labels[0].hidden, false);
  assert.equal(result.labels[0].bottom, 464);
  assert.ok(result.labels[0].lift < 0);
  const actorResult = layoutCanvasLabels([{ ...tag, type: 'actor' }], { obstacles: [body] });
  assert.equal(actorResult.labels[0].lift, 0, 'objective-only obstacles do not move actor labels');
});

test('labels that cannot fit are hidden rather than drawn on top of each other', () => {
  const requests = Array.from({ length: 8 }, (_, index) => ({
    id: `n${index}`, type: 'actor', x: 480, bottom: 40, width: 200, height: 22, priority: index,
  }));
  const result = layoutCanvasLabels(requests, { maxLift: 1 });
  assertNoOverlap(result);
  assert.equal(result.labels[0].hidden, false);
  assert.ok(result.summary.hidden > 0);
});

test('short actor names are deterministic and human', () => {
  assert.equal(shortenActorName('Father Mateus Avelar', { actorId: 'mateus' }), 'Mateus');
  assert.equal(shortenActorName('Nikola Dražanić', { actorId: 'lise' }), 'Nikola');
  assert.equal(shortenActorName('Father Mateus Avelar', { actorId: 'mateus-1' }), 'Mateus');
  assert.equal(shortenActorName('Lady Enma of Ash — Archive Mask'), 'Enma');
  assert.equal(shortenActorName('Shogun Kurozane'), 'Kurozane');
  assert.equal(shortenActorName('Magistrate Ujiro Arata'), 'Ujiro');
  assert.equal(shortenActorName('Bell Warden Chiyo'), 'Chiyo');
  assert.equal(shortenActorName('Masked Clerk'), 'Clerk');
  assert.equal(shortenActorName('Court Clone 2'), 'Clone 2');
  assert.equal(shortenActorName('Widow-of-Fog'), 'Widow-of-Fog');
});
