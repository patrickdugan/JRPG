import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  EDO_ROUTE_IDS,
  EDO_ROUTES,
  buildEdoRouteChoiceReceipt,
  confirmEdoRoute,
  createEdoRouteState,
  getEdoRoute,
  reconsiderEdoRoute,
  selectEdoRoute,
  stepEdoRouteSelection,
} from '../edo-route-map.mjs';

const suiteUrl = new URL('../../assets/art/edo-route-map-v1/', import.meta.url);
const runtimeUrl = new URL('../assets/art/edo-route-map-v1/', import.meta.url);

test('three materially distinct route signatures begin at Hoshigawa and converge at Edo', async () => {
  const source = JSON.parse(await readFile(new URL('edo-route-map.source.json', suiteUrl), 'utf8'));
  assert.deepEqual(EDO_ROUTE_IDS, source.routes.map(({ id }) => id));
  assert.equal(EDO_ROUTES.length, 3);
  const signatures = new Set();
  const flags = new Set();
  const intermediateSets = [];
  for (const route of EDO_ROUTES) {
    assert.equal(route.nodes[0].id, 'hoshigawa-council');
    assert.equal(route.nodes.at(-1).id, 'edo');
    assert.equal(route.nodes.slice(1, -1).length, 4);
    signatures.add(route.nodes.map(({ id }) => id).join('>'));
    flags.add(route.campaignFlag);
    intermediateSets.push(new Set(route.nodes.slice(1, -1).map(({ id }) => id)));
    const authored = source.routes.find(({ id }) => id === route.id);
    assert.equal(route.campaignFlag, authored.campaignFlag);
    assert.deepEqual(route.effects, authored.effects);
  }
  assert.equal(signatures.size, 3);
  assert.equal(flags.size, 3);
  intermediateSets.forEach((first, index) => intermediateSets.slice(index + 1).forEach((second) => {
    assert.deepEqual([...first].filter((id) => second.has(id)), []);
  }));
});

test('route selection cycles, confirms, and emits a noncanonical immutable receipt', () => {
  const initial = createEdoRouteState();
  assert.deepEqual(initial, { selectedRouteId: 'witness-road', confirmedRouteId: null, revision: 0 });
  const coast = stepEdoRouteSelection(initial, 1);
  assert.equal(coast.selectedRouteId, 'lantern-coast');
  const ridge = stepEdoRouteSelection(coast, 1);
  assert.equal(ridge.selectedRouteId, 'cedar-ridge');
  const selected = selectEdoRoute(ridge, 'witness-road');
  const result = confirmEdoRoute(selected);
  assert.equal(result.state.confirmedRouteId, 'witness-road');
  assert.equal(result.receipt.routeId, 'witness-road');
  assert.equal(result.receipt.reachesEdo, true);
  assert.equal(result.receipt.canonicalMutation, false);
  assert.equal(Object.isFrozen(result.receipt), true);
  assert.equal(reconsiderEdoRoute(result.state).confirmedRouteId, null);
  assert.throws(() => selectEdoRoute(initial, 'unknown'), RangeError);
  assert.throws(() => stepEdoRouteSelection(initial, 0), RangeError);
  assert.equal(getEdoRoute('unknown'), null);
  assert.equal(buildEdoRouteChoiceReceipt('cedar-ridge').campaignFlag, 'edo_route_cedar_ridge');
});

test('runtime map assets are byte-identical to production outputs', async () => {
  for (const filename of ['edo-route-map-base-v1.png', 'edo-route-icon-atlas-v1.png']) {
    const [source, runtime] = await Promise.all([
      readFile(new URL(filename, suiteUrl)),
      readFile(new URL(filename, runtimeUrl)),
    ]);
    assert.equal(runtime.equals(source), true, filename);
  }
});

test('standalone route screen exposes keyboard, radiogroup, live status, and art fallback contracts', async () => {
  const [html, source] = await Promise.all([
    readFile(new URL('../edo-route-map.html', import.meta.url), 'utf8'),
    readFile(new URL('../edo-route-map.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /role="radiogroup"/u);
  assert.equal((html.match(/role="radio"/gu) ?? []).length, 3);
  assert.match(html, /aria-live="polite"/u);
  assert.match(html, /<canvas[^>]+width="320"[^>]+height="180"/u);
  assert.match(html, /↑ ↓ choose · Z confirm · X reconsider/u);
  assert.match(source, /arrowup/u);
  assert.match(source, /key === 'z'/u);
  assert.match(source, /key === 'x'/u);
  assert.match(source, /Map art unavailable\. Route choices remain usable\./u);
  assert.doesNotMatch(source, /localStorage|sessionStorage|campaign.*settle/iu);
});
