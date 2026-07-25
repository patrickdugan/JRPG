import {
  KYOTO_ROUTE_IDS,
  confirmKyotoRoute,
  createKyotoRouteState,
  getKyotoRoute,
  reconsiderKyotoRoute,
  selectKyotoRoute,
  stepKyotoRouteSelection,
} from './kyoto-route-map.mjs';

const elements = {
  canvas: document.querySelector('#routeMap'),
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
const background = new Image();
let backgroundReady = false;
let state = createKyotoRouteState();
let animationHandle = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function signed(value) {
  if (value > 0) return `+${value}`;
  if (value < 0) return String(value);
  return '±0';
}

function drawFallback() {
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
  if (backgroundReady) context.drawImage(background, 0, 0);
  else drawFallback();

  const selected = getKyotoRoute(state.selectedRouteId);
  traceRoute(selected, '#17151b', 8);
  traceRoute(selected, selected.color, 4);

  const phase = reducedMotion ? 0 : Math.floor(timestamp / 260) % selected.nodes.length;
  const [x, y] = selected.nodes[phase].position;
  context.strokeStyle = '#fff1b8';
  context.lineWidth = 1;
  context.strokeRect(x - 11, y - 11, 22, 22);
  context.strokeRect(x - 9, y - 9, 18, 18);
  animationHandle = requestAnimationFrame(drawMap);
}

function render() {
  const selected = getKyotoRoute(state.selectedRouteId);
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
  elements.status.textContent = `${selected.name} is ready for review.`;
  render();
  if (focus) {
    elements.choices.find((choice) => choice.dataset.routeId === routeId)?.focus();
  }
}

function confirmSelection() {
  const result = confirmKyotoRoute(state);
  state = result.state;
  const selected = getKyotoRoute(state.selectedRouteId);
  elements.status.textContent = `${selected.name} chosen. The party will reach Kyoto by way of ${selected.nodes.at(-2).name}.`;
  document.dispatchEvent(new CustomEvent('kyoto-route-confirmed', { detail: result.receipt }));
  render();
}

function reconsiderSelection() {
  state = reconsiderKyotoRoute(state);
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
    const direction = ['arrowup', 'arrowleft'].includes(key) ? -1 : 1;
    state = stepKyotoRouteSelection(state, direction);
    choose(state.selectedRouteId, { focus: true });
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

background.addEventListener('load', () => {
  backgroundReady = background.naturalWidth === 480 && background.naturalHeight === 270;
});
background.addEventListener('error', () => {
  backgroundReady = false;
  elements.status.textContent = 'Map art unavailable. Route choices remain usable.';
});
background.src = './assets/art/southern-japan-route-map-v2/southern-japan-route-map-base-v2.png';

render();
animationHandle = requestAnimationFrame(drawMap);
window.addEventListener('pagehide', () => cancelAnimationFrame(animationHandle), { once: true });
