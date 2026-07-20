/** Pure addressing and lifecycle resolver for the six campaign-combat status VFX rows. */

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const CELL_SIZE = 32;

export const STATUS_VFX_STATES = deepFreeze([
  { id: 'apply', column: 0 },
  { id: 'active', column: 1 },
  { id: 'expire', column: 2 },
]);

export const STATUS_VFX_STATUSES = deepFreeze([
  { id: 'dread', name: 'Dread', row: 0 },
  { id: 'chill', name: 'Chill', row: 1 },
  { id: 'shock', name: 'Shock', row: 2 },
  { id: 'scorch', name: 'Scorch', row: 3 },
  { id: 'bound', name: 'Bound', row: 4 },
  { id: 'overheated', name: 'Overheated', row: 5 },
]);

export const STATUS_VFX_ATLAS = deepFreeze({
  url: './assets/art/status-vfx-suite/status-vfx-atlas.png',
  width: 96,
  height: 192,
  columns: 3,
  rows: 6,
  cellWidth: CELL_SIZE,
  cellHeight: CELL_SIZE,
  states: STATUS_VFX_STATES.map(({ id }) => id),
});

export const STATUS_VFX_SIGNAL_CONTRACT = deepFreeze({
  apply: { eventTypes: ['status-applied', 'status-refreshed'], animationSignal: 'status-glyph' },
  active: { snapshotSignal: 'actor.statuses' },
  expire: { eventTypes: ['status-expired'] },
  cleanse: null,
});

const STATUS_BY_ID = new Map(STATUS_VFX_STATUSES.map((status) => [status.id, status]));
const STATE_BY_ID = new Map(STATUS_VFX_STATES.map((state) => [state.id, state]));
const EVENT_STATE = new Map([
  ['status-applied', 'apply'],
  ['status-refreshed', 'apply'],
  ['status-expired', 'expire'],
]);

export function hasAuthoredStatusVfx(statusId) {
  return STATUS_BY_ID.has(statusId);
}

export function getStatusVfxFrame(statusId, stateId = 'active') {
  const status = STATUS_BY_ID.get(statusId);
  const state = STATE_BY_ID.get(stateId);
  if (!status || !state) return null;
  return deepFreeze({
    statusId: status.id,
    statusName: status.name,
    state: state.id,
    row: status.row,
    column: state.column,
    x: state.column * CELL_SIZE,
    y: status.row * CELL_SIZE,
    width: CELL_SIZE,
    height: CELL_SIZE,
    pivot: { x: 16, y: 16 },
    actorAnchor: { x: 16, y: 24 },
  });
}

/** Map the already-gated battle-animation status glyph to authored application art. */
export function resolveStatusGlyphVfx(statusGlyph = null) {
  if (!statusGlyph || !hasAuthoredStatusVfx(statusGlyph.id)) return null;
  const tile = statusGlyph.tile;
  if (!Number.isFinite(tile?.x) || !Number.isFinite(tile?.y)) return null;
  return deepFreeze({
    kind: 'application',
    statusId: statusGlyph.id,
    placement: statusGlyph.placement === 'source' ? 'source' : 'target',
    tile: { x: tile.x, y: tile.y },
    scale: Number.isFinite(statusGlyph.scale) ? statusGlyph.scale : 1,
    opacity: Number.isFinite(statusGlyph.opacity) ? statusGlyph.opacity : 1,
    frame: getStatusVfxFrame(statusGlyph.id, 'apply'),
  });
}

/** Resolve persistent snapshot membership without inventing new status state. */
export function getPersistentStatusVfxMarkers(snapshot = {}) {
  const markers = [];
  for (const actor of Array.isArray(snapshot.actors) ? snapshot.actors : []) {
    let ordinal = 0;
    for (const status of Array.isArray(actor?.statuses) ? actor.statuses : []) {
      if (!hasAuthoredStatusVfx(status?.id)) continue;
      markers.push({
        kind: 'persistent',
        actorId: actor.instanceId,
        actorTile: Number.isFinite(actor.pos?.x) && Number.isFinite(actor.pos?.y)
          ? { x: actor.pos.x, y: actor.pos.y }
          : null,
        statusId: status.id,
        remainingActivations: status.remainingActivations,
        ordinal,
        frame: getStatusVfxFrame(status.id, 'active'),
      });
      ordinal += 1;
    }
  }
  return deepFreeze(markers);
}

function logsSharePrefix(beforeLog, afterLog) {
  if (beforeLog.length > afterLog.length) return false;
  return beforeLog.every((entry, index) => JSON.stringify(entry) === JSON.stringify(afterLog[index]));
}

/** Resolve only newly appended, engine-authored application/refresh/expiry events. */
export function getNewStatusVfxSignals(beforeSnapshot = {}, afterSnapshot = {}) {
  const beforeLog = Array.isArray(beforeSnapshot.log) ? beforeSnapshot.log : [];
  const afterLog = Array.isArray(afterSnapshot.log) ? afterSnapshot.log : [];
  if (!logsSharePrefix(beforeLog, afterLog)) return deepFreeze([]);
  const signals = [];
  for (const entry of afterLog.slice(beforeLog.length)) {
    const state = EVENT_STATE.get(entry?.type);
    if (!state || !hasAuthoredStatusVfx(entry.statusId)) continue;
    signals.push({
      kind: state === 'apply' ? 'application' : 'expiry',
      eventType: entry.type,
      statusId: entry.statusId,
      actorId: entry.targetId ?? entry.actorId ?? null,
      pulse: entry.pulse,
      frame: getStatusVfxFrame(entry.statusId, state),
    });
  }
  return deepFreeze(signals);
}

export function statusVfxImageHasExpectedSize(image) {
  return Boolean(image)
    && image.naturalWidth === STATUS_VFX_ATLAS.width
    && image.naturalHeight === STATUS_VFX_ATLAS.height;
}
