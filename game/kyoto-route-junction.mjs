/** Pure traversal model for the playable three-stair Kyoto route junction. */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const KYOTO_JUNCTION_ROUTES = deepFreeze([
  {
    routeId: 'direct-sea',
    exitId: 'sea-stair',
    label: 'Sea Gate',
    direction: 'down-left',
    color: '#5eb3bc',
    inputs: ['arrowleft', 'arrowdown'],
    path: [[160, 129], [143, 136], [124, 144], [101, 151], [74, 158]],
  },
  {
    routeId: 'northern-road',
    exitId: 'north-stair',
    label: 'North Road',
    direction: 'up',
    color: '#e0b850',
    inputs: ['arrowup'],
    path: [[160, 129], [160, 113], [161, 96], [160, 79], [158, 61]],
  },
  {
    routeId: 'southern-passage',
    exitId: 'south-stair',
    label: 'South Road',
    direction: 'down-right',
    color: '#d45b48',
    inputs: ['arrowright'],
    path: [[160, 129], [181, 136], [205, 144], [231, 152], [260, 158]],
  },
]);

const JUNCTION_BY_ROUTE = new Map(
  KYOTO_JUNCTION_ROUTES.map((entry) => [entry.routeId, entry]),
);
const JUNCTION_BY_INPUT = new Map(
  KYOTO_JUNCTION_ROUTES.flatMap((entry) => entry.inputs.map((input) => [input, entry])),
);

export const KYOTO_JUNCTION_ORIGIN = Object.freeze([160, 129]);
export const KYOTO_JUNCTION_PREVIEW_PROGRESS = 0.56;

export function getKyotoJunctionRoute(routeId) {
  return JUNCTION_BY_ROUTE.get(routeId) ?? null;
}

export function getKyotoJunctionRouteForInput(input) {
  return JUNCTION_BY_INPUT.get(String(input).toLowerCase()) ?? null;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function segmentLengths(path) {
  const lengths = [];
  let total = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const [x0, y0] = path[index];
    const [x1, y1] = path[index + 1];
    const length = Math.hypot(x1 - x0, y1 - y0);
    lengths.push(length);
    total += length;
  }
  return { lengths, total };
}

export function sampleKyotoJunctionPath(routeId, progress) {
  const route = getKyotoJunctionRoute(routeId);
  if (!route) throw new RangeError(`Unknown Kyoto junction route: ${routeId}`);
  const t = clamp01(progress);
  const { lengths, total } = segmentLengths(route.path);
  let remaining = t * total;
  for (let index = 0; index < lengths.length; index += 1) {
    const segmentLength = lengths[index];
    if (remaining <= segmentLength || index === lengths.length - 1) {
      const ratio = segmentLength ? Math.min(1, remaining / segmentLength) : 0;
      const [x0, y0] = route.path[index];
      const [x1, y1] = route.path[index + 1];
      return deepFreeze({
        x: Math.round(x0 + (x1 - x0) * ratio),
        y: Math.round(y0 + (y1 - y0) * ratio),
        headingX: Math.sign(x1 - x0),
        headingY: Math.sign(y1 - y0),
        segmentIndex: index,
        progress: t,
      });
    }
    remaining -= segmentLength;
  }
  const [x, y] = route.path.at(-1);
  return deepFreeze({ x, y, headingX: 0, headingY: 0, segmentIndex: lengths.length - 1, progress: 1 });
}

export function getKyotoJunctionPartyPose(routeId, progress) {
  const leader = sampleKyotoJunctionPath(routeId, progress);
  const support = sampleKyotoJunctionPath(routeId, Math.max(0, progress - 0.12));
  const moving = progress > 0 && progress < 1;
  const step = moving ? 1 + (Math.floor(progress * 16) % 2) : progress >= 1 ? 3 : 0;
  return deepFreeze({
    routeId,
    leader: {
      ...leader,
      frame: step,
      mirrored: leader.headingX < 0,
    },
    support: {
      ...support,
      frame: 4 + step,
      mirrored: support.headingX < 0,
    },
  });
}
