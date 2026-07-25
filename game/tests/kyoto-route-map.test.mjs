import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  KYOTO_ROUTE_IDS,
  KYOTO_ROUTES,
  buildKyotoRouteChoiceReceipt,
  confirmKyotoRoute,
  createKyotoRouteState,
  getKyotoRoute,
  reconsiderKyotoRoute,
  selectKyotoRoute,
  stepKyotoRouteSelection,
} from '../kyoto-route-map.mjs';

const suiteUrl = new URL('../../assets/art/southern-japan-route-map-v2/', import.meta.url);
const runtimeUrl = new URL('../assets/art/southern-japan-route-map-v2/', import.meta.url);

test('sea, northern, and southern routes begin at Nagasaki and converge at Kyoto', async () => {
  const source = JSON.parse(
    await readFile(new URL('southern-japan-route-map.source.json', suiteUrl), 'utf8'),
  );
  assert.deepEqual(KYOTO_ROUTE_IDS, source.routes.map(({ id }) => id));
  assert.equal(KYOTO_ROUTES.length, 3);
  assert.deepEqual(
    new Set(KYOTO_ROUTES.map(({ pathKind }) => pathKind)),
    new Set(['sea', 'land', 'mixed']),
  );

  const signatures = new Set();
  const flags = new Set();
  const intermediateSets = [];
  for (const route of KYOTO_ROUTES) {
    assert.equal(route.nodes[0].id, 'nagasaki');
    assert.equal(route.nodes.at(-1).id, 'kyoto');
    assert.equal(route.nodes.slice(1, -1).length, 6);
    signatures.add(route.nodes.map(({ id }) => id).join('>'));
    flags.add(route.campaignFlag);
    intermediateSets.push(new Set(route.nodes.slice(1, -1).map(({ id }) => id)));
    const authored = source.routes.find(({ id }) => id === route.id);
    assert.equal(route.campaignFlag, authored.campaignFlag);
    assert.equal(route.pathKind, authored.pathKind);
    assert.equal(route.color, source.palette[authored.color].toLowerCase());
    assert.deepEqual(route.effects, authored.effects);
    const authoredNodes = authored.nodes.map((node) => (
      node.shared
        ? { id: node.id, ...source.sharedNodes[node.id] }
        : node
    ));
    assert.deepEqual(
      route.nodes.map(({ id, name, position }) => ({ id, name, position })),
      authoredNodes.map(({ id, name, position }) => ({ id, name, position })),
    );
  }
  assert.equal(signatures.size, 3);
  assert.equal(flags.size, 3);
  intermediateSets.forEach((first, index) => {
    intermediateSets.slice(index + 1).forEach((second) => {
      assert.deepEqual([...first].filter((id) => second.has(id)), []);
    });
  });
});

test('route selection cycles, confirms, and emits a noncanonical immutable receipt', () => {
  const initial = createKyotoRouteState();
  assert.deepEqual(initial, {
    selectedRouteId: 'northern-road',
    confirmedRouteId: null,
    revision: 0,
  });
  const south = stepKyotoRouteSelection(initial, 1);
  assert.equal(south.selectedRouteId, 'southern-passage');
  const sea = stepKyotoRouteSelection(south, 1);
  assert.equal(sea.selectedRouteId, 'direct-sea');
  const selected = selectKyotoRoute(sea, 'northern-road');
  const result = confirmKyotoRoute(selected);
  assert.equal(result.state.confirmedRouteId, 'northern-road');
  assert.equal(result.receipt.routeId, 'northern-road');
  assert.equal(result.receipt.reachesKyoto, true);
  assert.equal(result.receipt.canonicalMutation, false);
  assert.equal(Object.isFrozen(result.receipt), true);
  assert.equal(reconsiderKyotoRoute(result.state).confirmedRouteId, null);
  assert.throws(() => selectKyotoRoute(initial, 'unknown'), RangeError);
  assert.throws(() => stepKyotoRouteSelection(initial, 0), RangeError);
  assert.equal(getKyotoRoute('unknown'), null);
  assert.equal(
    buildKyotoRouteChoiceReceipt('direct-sea').campaignFlag,
    'kyoto_route_direct_sea',
  );
});

test('direct sea route lands at Sakai before its inland Kyoto finish', () => {
  const sea = getKyotoRoute('direct-sea');
  assert.equal(sea.nodes.at(-2).id, 'sakai-harbor');
  assert.equal(sea.nodes.at(-1).id, 'kyoto');
  assert.equal(sea.pathKind, 'sea');
  assert.equal(sea.effects.navalIntel, 2);
});

test('runtime map assets are byte-identical to production outputs', async () => {
  for (const filename of [
    'southern-japan-route-map-base-v2.png',
    'southern-japan-route-icon-atlas-v2.png',
  ]) {
    const [source, runtime] = await Promise.all([
      readFile(new URL(filename, suiteUrl)),
      readFile(new URL(filename, runtimeUrl)),
    ]);
    assert.equal(runtime.equals(source), true, filename);
  }
});

test('standalone route screen exposes keyboard, radiogroup, live status, and art fallback contracts', async () => {
  const [html, source] = await Promise.all([
    readFile(new URL('../kyoto-route-map.html', import.meta.url), 'utf8'),
    readFile(new URL('../kyoto-route-map.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /role="radiogroup"/u);
  assert.equal((html.match(/role="radio"/gu) ?? []).length, 3);
  assert.match(html, /aria-live="polite"/u);
  assert.match(html, /<canvas[^>]+width="480"[^>]+height="270"/u);
  assert.match(html, /Stairs choose · Z confirm · X reconsider/u);
  assert.match(source, /arrowup/u);
  assert.match(source, /key === 'z'/u);
  assert.match(source, /key === 'x'/u);
  assert.match(source, /Map art unavailable\. Route choices remain usable\./u);
  assert.doesNotMatch(source, /localStorage|sessionStorage|campaign.*settle/iu);
});
