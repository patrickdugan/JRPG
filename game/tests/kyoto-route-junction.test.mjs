import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  KYOTO_JUNCTION_ORIGIN,
  KYOTO_JUNCTION_PREVIEW_PROGRESS,
  KYOTO_JUNCTION_ROUTES,
  getKyotoJunctionPartyPose,
  getKyotoJunctionRoute,
  getKyotoJunctionRouteForInput,
  sampleKyotoJunctionPath,
} from '../kyoto-route-junction.mjs';

const suiteUrl = new URL('../../assets/art/kyoto-route-junction-v1/', import.meta.url);
const runtimeUrl = new URL('../assets/art/kyoto-route-junction-v1/', import.meta.url);

test('three authored stair exits share one landing and map to three Kyoto routes', async () => {
  const source = JSON.parse(
    await readFile(new URL('kyoto-route-junction.source.json', suiteUrl), 'utf8'),
  );
  assert.deepEqual(KYOTO_JUNCTION_ORIGIN, source.junction.origin);
  assert.equal(KYOTO_JUNCTION_PREVIEW_PROGRESS, source.junction.previewProgress);
  assert.equal(KYOTO_JUNCTION_ROUTES.length, 3);
  assert.deepEqual(
    new Set(KYOTO_JUNCTION_ROUTES.map(({ routeId }) => routeId)),
    new Set(['direct-sea', 'northern-road', 'southern-passage']),
  );
  assert.deepEqual(
    new Set(KYOTO_JUNCTION_ROUTES.map(({ direction }) => direction)),
    new Set(['down-left', 'up', 'down-right']),
  );

  for (const route of KYOTO_JUNCTION_ROUTES) {
    const authored = source.junction.routes.find(({ routeId }) => routeId === route.routeId);
    assert.ok(authored);
    assert.equal(route.exitId, authored.exitId);
    assert.equal(route.direction, authored.direction);
    assert.equal(route.color, source.palette[authored.color].toLowerCase());
    assert.deepEqual(route.inputs, authored.inputs.map((input) => input.toLowerCase()));
    assert.deepEqual(route.path, authored.path);
    assert.deepEqual(route.path[0], KYOTO_JUNCTION_ORIGIN);
    route.path.flat().forEach((coordinate) => assert.equal(Number.isInteger(coordinate), true));
  }
});

test('physical directional inputs select their spatial exits', () => {
  assert.equal(getKyotoJunctionRouteForInput('ArrowUp').routeId, 'northern-road');
  assert.equal(getKyotoJunctionRouteForInput('ArrowLeft').routeId, 'direct-sea');
  assert.equal(getKyotoJunctionRouteForInput('ArrowDown').routeId, 'direct-sea');
  assert.equal(getKyotoJunctionRouteForInput('ArrowRight').routeId, 'southern-passage');
  assert.equal(getKyotoJunctionRouteForInput('q'), null);
  assert.equal(getKyotoJunctionRoute('unknown'), null);
});

test('path sampling begins on the landing, reaches each exit, and keeps support behind leader', () => {
  for (const route of KYOTO_JUNCTION_ROUTES) {
    const start = sampleKyotoJunctionPath(route.routeId, 0);
    const end = sampleKyotoJunctionPath(route.routeId, 1);
    assert.deepEqual([start.x, start.y], KYOTO_JUNCTION_ORIGIN);
    assert.deepEqual([end.x, end.y], route.path.at(-1));
    const party = getKyotoJunctionPartyPose(route.routeId, 0.65);
    assert.equal(party.routeId, route.routeId);
    assert.ok(party.leader.progress > party.support.progress);
    assert.ok(party.leader.frame >= 1 && party.leader.frame <= 2);
    assert.ok(party.support.frame >= 5 && party.support.frame <= 6);
  }
  assert.throws(() => sampleKyotoJunctionPath('unknown', 0.5), RangeError);
});

test('runtime junction assets are byte-identical to production outputs', async () => {
  for (const filename of [
    'kyoto-route-junction-base-v1.png',
    'kyoto-route-junction-party-atlas-v1.png',
  ]) {
    const [source, runtime] = await Promise.all([
      readFile(new URL(filename, suiteUrl)),
      readFile(new URL(filename, runtimeUrl)),
    ]);
    assert.equal(runtime.equals(source), true, filename);
  }
});

test('route screen exposes the playable junction and preserves the isolated receipt boundary', async () => {
  const [html, source] = await Promise.all([
    readFile(new URL('../kyoto-route-map.html', import.meta.url), 'utf8'),
    readFile(new URL('../kyoto-route-map.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /<canvas[^>]+id="routeJunction"[^>]+width="320"[^>]+height="180"/u);
  assert.match(html, /←<\/kbd>\/<kbd>↓<\/kbd> Sea/u);
  assert.match(html, /<kbd>↑<\/kbd> North/u);
  assert.match(html, /<kbd>→<\/kbd> South/u);
  assert.match(source, /getKyotoJunctionRouteForInput/u);
  assert.match(source, /getKyotoJunctionPartyPose/u);
  assert.match(source, /kyoto-route-junction-party-atlas-v1\.png/u);
  assert.doesNotMatch(source, /localStorage|sessionStorage|campaign.*settle/iu);
});
