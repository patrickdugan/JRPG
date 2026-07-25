import {
  KYOTO_ROUTE_IDS,
  confirmKyotoRoute,
  createKyotoRouteState,
  getKyotoRoute,
  reconsiderKyotoRoute,
  selectKyotoRoute,
} from './kyoto-route-map.mjs';
import {
  KYOTO_JUNCTION_PREVIEW_PROGRESS,
  getKyotoJunctionPartyPose,
  getKyotoJunctionRoute,
  getKyotoJunctionRouteForInput,
} from './kyoto-route-junction.mjs';

const elements = {
  canvas: document.querySelector('#routeMap'),
  junctionCanvas: document.querySelector('#routeJunction'),
  junctionRouteLabel: document.querySelector('#junctionRouteLabel'),
  mapRouteLabel: document.querySelector('#mapRouteLabel'),
  choices: [...document.querySelectorAll('[data-route-id]')],
  routeName: document.querySelector('#routeName'),
  routeSummary: document.querySelector('#routeSummary'),
  routeTravel: document.querySelector('#routeTravel'),
  routeThreat: document.querySelector('#routeThreat'),
  routeSupplies: document.querySelector('#routeSupplies'),
  routeWitnesses: document.querySelector('#routeWitnesses'),
  routeNodes: document.querySelector('#routeNodes'),
  confirm: document.querySelector('#confirmRoute'),
  reconsider: document.querySelector('#reconsiderRoute'),
  status: document.querySelector('#routeStatus'),
};

const context = elements.canvas.getContext('2d', { alpha: false });
context.imageSmoothingEnabled = false;
const junctionContext = elements.junctionCanvas.getContext('2d', { alpha: false });
junctionContext.imageSmoothingEnabled = false;
const mapBackground = new Image();
const junctionBackground = new Image();
const junctionPartyAtlas = new Image();
let mapBackgroundReady = false;
let junctionBackgroundReady = false;
let junctionPartyReady = false;
let state = createKyotoRouteState();
let animationHandle = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let junctionMotion = {
  routeId: state.selectedRouteId,
  from: 0,
  to: KYOTO_JUNCTION_PREVIEW_PROGRESS,
  startedAt: performance.now(),
  duration: reducedMotion ? 0 : 520,
};

function signed(value) {
  if (value > 0) return `+${value}`;
  if (value < 0) return String(value);
  return '±0';
}

function drawMapFallback() {
  context.fillStyle = '#948868';
  context.fillRect(0, 0, elements.canvas.width, elements.canvas.height);
  context.fillStyle = '#24180f';
  context.font = '12px monospace';
  context.fillText('NAGASAKI — KYOTO / MIYAKO', 16, 24);
}

function traceRoute(route, color, width) {
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineJoin = 'miter';
  context.lineCap = 'square';
  for (let index = 0; index < route.nodes.length - 1; index += 1) {
    const [x0, y0] = route.nodes[index].position;
    const [x1, y1] = route.nodes[index + 1].position;
    const length = Math.hypot(x1 - x0, y1 - y0);
    const inset = Math.min(12, length / 4);
    const dx = (x1 - x0) / length;
    const dy = (y1 - y0) / length;
    context.beginPath();
    context.moveTo(Math.round(x0 + dx * inset), Math.round(y0 + dy * inset));
    context.lineTo(Math.round(x1 - dx * inset), Math.round(y1 - dy * inset));
    context.stroke();
  }
}

function drawMap(timestamp = 0) {
  context.imageSmoothingEnabled = false;
  if (mapBackgroundReady) context.drawImage(mapBackground, 0, 0);
  else drawMapFallback();

  const selected = getKyotoRoute(state.selectedRouteId);
  traceRoute(selected, '#17151b', 8);
  traceRoute(selected, selected.color, 4);

  const phase = reducedMotion ? 0 : Math.floor(timestamp / 260) % selected.nodes.length;
  const [x, y] = selected.nodes[phase].position;
  context.strokeStyle = '#fff1b8';
  context.lineWidth = 1;
  context.strokeRect(x - 11, y - 11, 22, 22);
  context.strokeRect(x - 9, y - 9, 18, 18);
}

function junctionProgress(timestamp) {
  if (junctionMotion.duration === 0) return junctionMotion.to;
  const elapsed = Math.max(0, timestamp - junctionMotion.startedAt);
  const ratio = Math.min(1, elapsed / junctionMotion.duration);
  const eased = ratio * ratio * (3 - 2 * ratio);
  return junctionMotion.from + (junctionMotion.to - junctionMotion.from) * eased;
}

function beginJunctionMotion(routeId, to, { from = 0, duration = 520 } = {}) {
  junctionMotion = {
    routeId,
    from,
    to,
    startedAt: performance.now(),
    duration: reducedMotion ? 0 : duration,
  };
}

function drawJunctionFallback() {
  junctionContext.fillStyle = '#17172c';
  junctionContext.fillRect(0, 0, elements.junctionCanvas.width, elements.junctionCanvas.height);
  junctionContext.fillStyle = '#f6e7b0';
  junctionContext.font = '8px monospace';
  junctionContext.fillText('THE THREE WAYS', 8, 14);
}

function traceJunctionPath(route) {
  junctionContext.lineJoin = 'miter';
  junctionContext.lineCap = 'square';
  junctionContext.strokeStyle = '#0e0d13';
  junctionContext.lineWidth = 6;
  junctionContext.beginPath();
  route.path.forEach(([x, y], index) => {
    if (index === 0) junctionContext.moveTo(x, y);
    else junctionContext.lineTo(x, y);
  });
  junctionContext.stroke();
  junctionContext.strokeStyle = route.color;
  junctionContext.lineWidth = 2;
  junctionContext.stroke();
}

function drawJunctionSprite(frame, footX, footY, mirrored) {
  if (!junctionPartyReady) {
    junctionContext.fillStyle = frame < 4 ? '#b08b58' : '#7a3d45';
    junctionContext.fillRect(footX - 4, footY - 16, 8, 16);
    return;
  }
  const sourceX = frame * 16;
  if (mirrored) {
    junctionContext.save();
    junctionContext.translate(footX, 0);
    junctionContext.scale(-1, 1);
    junctionContext.drawImage(junctionPartyAtlas, sourceX, 0, 16, 24, -8, footY - 24, 16, 24);
    junctionContext.restore();
  } else {
    junctionContext.drawImage(junctionPartyAtlas, sourceX, 0, 16, 24, footX - 8, footY - 24, 16, 24);
  }
}

function drawJunction(timestamp = 0) {
  junctionContext.imageSmoothingEnabled = false;
  if (junctionBackgroundReady) junctionContext.drawImage(junctionBackground, 0, 0);
  else drawJunctionFallback();

  const route = getKyotoJunctionRoute(state.selectedRouteId);
  const progress = junctionProgress(timestamp);
  const party = getKyotoJunctionPartyPose(route.routeId, progress);
  traceJunctionPath(route);

  const pulse = reducedMotion ? 0 : Math.floor(timestamp / 220) % 2;
  const [exitX, exitY] = route.path.at(-1);
  junctionContext.strokeStyle = pulse ? '#f6e7b0' : route.color;
  junctionContext.lineWidth = 1;
  junctionContext.strokeRect(exitX - 6, exitY - 6, 12, 12);

  junctionContext.fillStyle = '#0e0d13';
  junctionContext.fillRect(party.support.x - 5, party.support.y - 2, 10, 2);
  junctionContext.fillRect(party.leader.x - 5, party.leader.y - 2, 10, 2);
  drawJunctionSprite(
    party.support.frame,
    party.support.x,
    party.support.y,
    party.support.mirrored,
  );
  drawJunctionSprite(
    party.leader.frame,
    party.leader.x,
    party.leader.y,
    party.leader.mirrored,
  );
}

function drawFrame(timestamp) {
  drawMap(timestamp);
  drawJunction(timestamp);
  animationHandle = requestAnimationFrame(drawFrame);
}

function render() {
  const selected = getKyotoRoute(state.selectedRouteId);
  const junctionRoute = getKyotoJunctionRoute(selected.id);
  elements.junctionRouteLabel.textContent = `${junctionRoute.label} selected`;
  elements.mapRouteLabel.textContent = `${selected.name} selected`;
  elements.routeName.textContent = selected.name;
  elements.routeSummary.textContent = selected.summary;
  elements.routeTravel.textContent = selected.effects.travelTime;
  elements.routeThreat.textContent = selected.effects.threat;
  elements.routeSupplies.textContent = signed(selected.effects.supplies);
  elements.routeWitnesses.textContent = signed(selected.effects.witnessSupport);
  elements.routeNodes.replaceChildren(...selected.nodes.map((node) => {
    const item = document.createElement('li');
    item.textContent = node.name;
    return item;
  }));
  elements.choices.forEach((choice) => {
    const active = choice.dataset.routeId === selected.id;
    choice.setAttribute('aria-checked', String(active));
    choice.tabIndex = active ? 0 : -1;
  });
  const confirmed = state.confirmedRouteId === selected.id;
  elements.reconsider.disabled = !state.confirmedRouteId;
  elements.confirm.disabled = confirmed;
  elements.status.dataset.confirmed = String(confirmed);
}

function choose(routeId, { focus = false } = {}) {
  state = selectKyotoRoute(state, routeId);
  const selected = getKyotoRoute(routeId);
  beginJunctionMotion(routeId, KYOTO_JUNCTION_PREVIEW_PROGRESS, { from: 0, duration: 480 });
  elements.status.textContent = `${selected.name} is ready for review.`;
  render();
  if (focus) {
    elements.choices.find((choice) => choice.dataset.routeId === routeId)?.focus();
  }
}

function confirmSelection() {
  if (state.confirmedRouteId === state.selectedRouteId) return;
  const from = junctionProgress(performance.now());
  const result = confirmKyotoRoute(state);
  state = result.state;
  const selected = getKyotoRoute(state.selectedRouteId);
  beginJunctionMotion(selected.id, 1, { from, duration: 680 });
  elements.status.textContent = `${selected.name} chosen. The party will reach Kyoto by way of ${selected.nodes.at(-2).name}.`;
  document.dispatchEvent(new CustomEvent('kyoto-route-confirmed', { detail: result.receipt }));
  render();
}

function reconsiderSelection() {
  const from = junctionProgress(performance.now());
  state = reconsiderKyotoRoute(state);
  beginJunctionMotion(state.selectedRouteId, KYOTO_JUNCTION_PREVIEW_PROGRESS, { from, duration: 360 });
  elements.status.textContent = `${getKyotoRoute(state.selectedRouteId).name} is ready for review.`;
  render();
}

elements.choices.forEach((choice) => {
  choice.addEventListener('click', () => choose(choice.dataset.routeId));
});
elements.confirm.addEventListener('click', confirmSelection);
elements.reconsider.addEventListener('click', reconsiderSelection);

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  const nativeButtonKey = (key === 'enter' || key === ' ') && event.target.closest?.('button');
  if (['arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
    event.preventDefault();
    const junctionRoute = getKyotoJunctionRouteForInput(key);
    choose(junctionRoute.routeId, { focus: true });
  } else if (key === 'z' || ((key === 'enter' || key === ' ') && !nativeButtonKey)) {
    event.preventDefault();
    confirmSelection();
  } else if (key === 'x' || key === 'escape') {
    event.preventDefault();
    reconsiderSelection();
  } else if (/^[1-3]$/u.test(key)) {
    event.preventDefault();
    choose(KYOTO_ROUTE_IDS[Number(key) - 1], { focus: true });
  }
});

mapBackground.addEventListener('load', () => {
  mapBackgroundReady = mapBackground.naturalWidth === 480 && mapBackground.naturalHeight === 270;
});
mapBackground.addEventListener('error', () => {
  mapBackgroundReady = false;
  elements.status.textContent = 'Map art unavailable. Route choices remain usable.';
});
mapBackground.src = './assets/art/southern-japan-route-map-v2/southern-japan-route-map-base-v2.png';

junctionBackground.addEventListener('load', () => {
  junctionBackgroundReady = (
    junctionBackground.naturalWidth === 320 && junctionBackground.naturalHeight === 180
  );
});
junctionBackground.addEventListener('error', () => {
  junctionBackgroundReady = false;
  elements.status.textContent = 'Junction art unavailable. Route choices remain usable.';
});
junctionBackground.src = './assets/art/kyoto-route-junction-v1/kyoto-route-junction-base-v1.png';

junctionPartyAtlas.addEventListener('load', () => {
  junctionPartyReady = (
    junctionPartyAtlas.naturalWidth === 128 && junctionPartyAtlas.naturalHeight === 24
  );
});
junctionPartyAtlas.addEventListener('error', () => {
  junctionPartyReady = false;
});
junctionPartyAtlas.src = './assets/art/kyoto-route-junction-v1/kyoto-route-junction-party-atlas-v1.png';

render();
animationHandle = requestAnimationFrame(drawFrame);
window.addEventListener('pagehide', () => cancelAnimationFrame(animationHandle), { once: true });
