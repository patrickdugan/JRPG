/** Pure route-choice model for the standalone Road to Edo planning screen. */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const route = (definition) => deepFreeze(definition);

export const EDO_ROUTES = Object.freeze([
  route({
    id: 'cedar-ridge',
    name: 'Cedar Ridge',
    shortLabel: 'Ridge',
    color: '#b64b3f',
    summary: 'The shortest ascent: hard patrols, thin supplies, and forge salvage.',
    strategy: 'Fast / dangerous',
    campaignFlag: 'edo_route_cedar_ridge',
    openingLevelId: 'tkm-rain-gate',
    supportBias: ['ren', 'genta'],
    effects: { travelTime: 1, threat: 3, supplies: -1, witnessSupport: 0, forgeSalvage: 2 },
    nodes: [
      { id: 'hoshigawa-council', name: 'Hoshigawa Council', position: [24, 91] },
      { id: 'takamine-watch', name: 'Takamine Watch', position: [72, 53] },
      { id: 'kagura-pass', name: 'Kagura Pass', position: [126, 31] },
      { id: 'koshu-watch', name: 'Koshu Watch', position: [181, 37] },
      { id: 'edo-west-gate', name: 'Edo West Gate', position: [243, 54] },
      { id: 'edo', name: 'Edo', position: [294, 82] },
    ],
  }),
  route({
    id: 'witness-road',
    name: 'Witness Road',
    shortLabel: 'Witness',
    color: '#d1a958',
    summary: 'A measured road through printers and post towns, carrying testimony east.',
    strategy: 'Balanced / political',
    campaignFlag: 'edo_route_witness_road',
    openingLevelId: 'kzu-printmaker-lane',
    supportBias: ['aya', 'mateus'],
    effects: { travelTime: 2, threat: 2, supplies: 0, witnessSupport: 2, forgeSalvage: 0 },
    nodes: [
      { id: 'hoshigawa-council', name: 'Hoshigawa Council', position: [24, 91] },
      { id: 'kozui-print-road', name: 'Kozui Print Road', position: [75, 91] },
      { id: 'hushroad-post', name: 'Hushroad Post', position: [130, 85] },
      { id: 'musashi-post', name: 'Musashi Post', position: [184, 91] },
      { id: 'edo-north-gate', name: 'Edo North Gate', position: [244, 79] },
      { id: 'edo', name: 'Edo', position: [294, 82] },
    ],
  }),
  route({
    id: 'lantern-coast',
    name: 'Lantern Coast',
    shortLabel: 'Coast',
    color: '#5fa5aa',
    summary: 'A long coastal approach: ferries, storm water, and reliable resupply.',
    strategy: 'Slow / supplied',
    campaignFlag: 'edo_route_lantern_coast',
    openingLevelId: 'sdg-rain-docks',
    supportBias: ['kiku', 'lise'],
    effects: { travelTime: 3, threat: 2, supplies: 2, witnessSupport: 1, forgeSalvage: 0 },
    nodes: [
      { id: 'hoshigawa-council', name: 'Hoshigawa Council', position: [24, 91] },
      { id: 'sodegaura-docks', name: 'Sodegaura Docks', position: [72, 132] },
      { id: 'nagi-ferry', name: 'Nagi Ferry', position: [128, 148] },
      { id: 'shinagawa', name: 'Shinagawa', position: [186, 139] },
      { id: 'edo-bay-gate', name: 'Edo Bay Gate', position: [246, 119] },
      { id: 'edo', name: 'Edo', position: [294, 82] },
    ],
  }),
]);

export const EDO_ROUTE_IDS = Object.freeze(EDO_ROUTES.map(({ id }) => id));
const ROUTE_BY_ID = new Map(EDO_ROUTES.map((entry) => [entry.id, entry]));

export function getEdoRoute(routeId) {
  return ROUTE_BY_ID.get(routeId) ?? null;
}

export function createEdoRouteState(options = {}) {
  const selectedRouteId = EDO_ROUTE_IDS.includes(options.selectedRouteId)
    ? options.selectedRouteId
    : 'witness-road';
  return deepFreeze({
    selectedRouteId,
    confirmedRouteId: null,
    revision: 0,
  });
}

export function selectEdoRoute(state, routeId) {
  if (!getEdoRoute(routeId)) throw new RangeError(`Unknown Edo route: ${routeId}`);
  if (state.selectedRouteId === routeId && state.confirmedRouteId === null) return state;
  return deepFreeze({
    selectedRouteId: routeId,
    confirmedRouteId: null,
    revision: state.revision + 1,
  });
}

export function stepEdoRouteSelection(state, direction = 1) {
  if (!Number.isInteger(direction) || direction === 0) {
    throw new RangeError('Route-selection direction must be a non-zero integer.');
  }
  const currentIndex = EDO_ROUTE_IDS.indexOf(state.selectedRouteId);
  const nextIndex = (currentIndex + Math.sign(direction) + EDO_ROUTE_IDS.length) % EDO_ROUTE_IDS.length;
  return selectEdoRoute(state, EDO_ROUTE_IDS[nextIndex]);
}

export function buildEdoRouteChoiceReceipt(routeId) {
  const selected = getEdoRoute(routeId);
  if (!selected) throw new RangeError(`Unknown Edo route: ${routeId}`);
  return deepFreeze({
    schemaVersion: 1,
    kind: 'edo-route-choice',
    routeId: selected.id,
    campaignFlag: selected.campaignFlag,
    openingLevelId: selected.openingLevelId,
    supportBias: [...selected.supportBias],
    effects: { ...selected.effects },
    pathSignature: selected.nodes.map(({ id }) => id).join('>'),
    reachesEdo: selected.nodes.at(-1)?.id === 'edo',
    canonicalMutation: false,
  });
}

export function confirmEdoRoute(state) {
  const receipt = buildEdoRouteChoiceReceipt(state.selectedRouteId);
  return deepFreeze({
    state: {
      selectedRouteId: state.selectedRouteId,
      confirmedRouteId: state.selectedRouteId,
      revision: state.revision + 1,
    },
    receipt,
  });
}

export function reconsiderEdoRoute(state) {
  if (state.confirmedRouteId === null) return state;
  return deepFreeze({
    selectedRouteId: state.selectedRouteId,
    confirmedRouteId: null,
    revision: state.revision + 1,
  });
}
