/** Pure route-choice model for the standalone Nagasaki-to-Kyoto planning screen. */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const route = (definition) => deepFreeze(definition);

export const KYOTO_ROUTES = Object.freeze([
  route({
    id: 'direct-sea',
    name: 'Direct Sea Passage',
    shortLabel: 'Sea',
    color: '#4f9399',
    summary: 'Ride tide and cannon smoke through Kanmon and the Inland Sea, then climb from Sakai to Miyako.',
    strategy: 'Fast / volatile',
    campaignFlag: 'kyoto_route_direct_sea',
    openingLevelId: 'ngs-night-roads',
    supportBias: ['kiku', 'mateus'],
    pathKind: 'sea',
    effects: {
      travelTime: 1,
      threat: 3,
      supplies: 1,
      witnessSupport: 0,
      navalIntel: 2,
      forgeSalvage: 0,
    },
    nodes: [
      { id: 'nagasaki', name: 'Nagasaki', position: [43, 153] },
      { id: 'hirado-roads', name: 'Hirado Roads', position: [39, 114] },
      { id: 'genkai-reach', name: 'Genkai Reach', position: [78, 85] },
      { id: 'kanmon-pilotage', name: 'Kanmon Pilotage', position: [123, 99] },
      { id: 'aki-waters', name: 'Aki Waters', position: [217, 137] },
      { id: 'shodo-roads', name: 'Shodo Roads', position: [310, 134] },
      { id: 'sakai-harbor', name: 'Sakai Harbor', position: [386, 119] },
      { id: 'kyoto', name: 'Kyoto (Miyako)', position: [423, 82] },
    ],
  }),
  route({
    id: 'northern-road',
    name: 'Northern Road',
    shortLabel: 'North',
    color: '#e1b34b',
    summary: "Cross Kyushu by post road, take the Kanmon gate, and carry testimony east along San'yo.",
    strategy: 'Balanced / witnessed',
    campaignFlag: 'kyoto_route_northern_road',
    openingLevelId: 'sga-rain-post',
    supportBias: ['aya', 'ren'],
    pathKind: 'land',
    effects: {
      travelTime: 2,
      threat: 2,
      supplies: 0,
      witnessSupport: 2,
      navalIntel: 0,
      forgeSalvage: 0,
    },
    nodes: [
      { id: 'nagasaki', name: 'Nagasaki', position: [43, 153] },
      { id: 'saga-post', name: 'Saga Post', position: [68, 128] },
      { id: 'hakata', name: 'Hakata', position: [91, 108] },
      { id: 'kokura', name: 'Kokura', position: [112, 113] },
      { id: 'shimonoseki', name: 'Shimonoseki', position: [129, 105] },
      { id: 'hiroshima', name: 'Hiroshima', position: [218, 102] },
      { id: 'himeji', name: 'Himeji', position: [327, 105] },
      { id: 'kyoto', name: 'Kyoto (Miyako)', position: [423, 82] },
    ],
  }),
  route({
    id: 'southern-passage',
    name: 'Southern Passage',
    shortLabel: 'South',
    color: '#b94d3c',
    summary: "Turn through Shimabara and Bungo, then bind Shikoku's castles and ferries into one long march.",
    strategy: 'Slow / supplied',
    campaignFlag: 'kyoto_route_southern_passage',
    openingLevelId: 'smb-ash-shore',
    supportBias: ['genta', 'lise'],
    pathKind: 'mixed',
    effects: {
      travelTime: 3,
      threat: 2,
      supplies: 2,
      witnessSupport: 1,
      navalIntel: 0,
      forgeSalvage: 1,
    },
    nodes: [
      { id: 'nagasaki', name: 'Nagasaki', position: [43, 153] },
      { id: 'shimabara', name: 'Shimabara', position: [79, 158] },
      { id: 'kumamoto', name: 'Kumamoto', position: [88, 182] },
      { id: 'bungo-crossing', name: 'Bungo Crossing', position: [126, 149] },
      { id: 'matsuyama', name: 'Matsuyama', position: [222, 165] },
      { id: 'takamatsu', name: 'Takamatsu', position: [307, 159] },
      { id: 'awaji-crossing', name: 'Awaji Crossing', position: [350, 142] },
      { id: 'kyoto', name: 'Kyoto (Miyako)', position: [423, 82] },
    ],
  }),
]);

export const KYOTO_ROUTE_IDS = Object.freeze(KYOTO_ROUTES.map(({ id }) => id));
const ROUTE_BY_ID = new Map(KYOTO_ROUTES.map((entry) => [entry.id, entry]));

export function getKyotoRoute(routeId) {
  return ROUTE_BY_ID.get(routeId) ?? null;
}

export function createKyotoRouteState(options = {}) {
  const selectedRouteId = KYOTO_ROUTE_IDS.includes(options.selectedRouteId)
    ? options.selectedRouteId
    : 'northern-road';
  return deepFreeze({
    selectedRouteId,
    confirmedRouteId: null,
    revision: 0,
  });
}

export function selectKyotoRoute(state, routeId) {
  if (!getKyotoRoute(routeId)) throw new RangeError(`Unknown Kyoto route: ${routeId}`);
  if (state.selectedRouteId === routeId && state.confirmedRouteId === null) return state;
  return deepFreeze({
    selectedRouteId: routeId,
    confirmedRouteId: null,
    revision: state.revision + 1,
  });
}

export function stepKyotoRouteSelection(state, direction = 1) {
  if (!Number.isInteger(direction) || direction === 0) {
    throw new RangeError('Route-selection direction must be a non-zero integer.');
  }
  const currentIndex = KYOTO_ROUTE_IDS.indexOf(state.selectedRouteId);
  const nextIndex = (
    currentIndex + Math.sign(direction) + KYOTO_ROUTE_IDS.length
  ) % KYOTO_ROUTE_IDS.length;
  return selectKyotoRoute(state, KYOTO_ROUTE_IDS[nextIndex]);
}

export function buildKyotoRouteChoiceReceipt(routeId) {
  const selected = getKyotoRoute(routeId);
  if (!selected) throw new RangeError(`Unknown Kyoto route: ${routeId}`);
  return deepFreeze({
    schemaVersion: 2,
    kind: 'kyoto-route-choice',
    routeId: selected.id,
    pathKind: selected.pathKind,
    campaignFlag: selected.campaignFlag,
    openingLevelId: selected.openingLevelId,
    supportBias: [...selected.supportBias],
    effects: { ...selected.effects },
    pathSignature: selected.nodes.map(({ id }) => id).join('>'),
    reachesKyoto: selected.nodes[0]?.id === 'nagasaki' && selected.nodes.at(-1)?.id === 'kyoto',
    canonicalMutation: false,
  });
}

export function confirmKyotoRoute(state) {
  const receipt = buildKyotoRouteChoiceReceipt(state.selectedRouteId);
  return deepFreeze({
    state: {
      selectedRouteId: state.selectedRouteId,
      confirmedRouteId: state.selectedRouteId,
      revision: state.revision + 1,
    },
    receipt,
  });
}

export function reconsiderKyotoRoute(state) {
  if (state.confirmedRouteId === null) return state;
  return deepFreeze({
    selectedRouteId: state.selectedRouteId,
    confirmedRouteId: null,
    revision: state.revision + 1,
  });
}
