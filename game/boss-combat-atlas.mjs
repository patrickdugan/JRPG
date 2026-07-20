export const BOSS_COMBAT_POSES = Object.freeze([
  'neutral',
  'telegraph',
  'active',
  'break',
  'transition',
  'defeat',
]);

export const BOSS_DEFEAT_HOLD_MS = 420;

const point = (x, y) => Object.freeze({ x, y });

// Audited from boss-combat-suite.source.json. These are runtime data rather
// than a parsed asset dependency so the browser build remains self-contained.
export const BOSS_COMBAT_ANCHOR_PROFILES = Object.freeze({
  grounded: Object.freeze({
    neutral: Object.freeze({ pivot: point(56, 110), ground: point(56, 116) }),
    telegraph: Object.freeze({ pivot: point(53, 110), ground: point(53, 116) }),
    active: Object.freeze({ pivot: point(63, 110), ground: point(63, 116) }),
    break: Object.freeze({ pivot: point(48, 112), ground: point(48, 116) }),
    transition: Object.freeze({ pivot: point(56, 106), ground: point(56, 116) }),
    defeat: Object.freeze({ pivot: point(48, 114), ground: point(48, 118) }),
  }),
  low: Object.freeze({
    neutral: Object.freeze({ pivot: point(53, 105), ground: point(53, 116) }),
    telegraph: Object.freeze({ pivot: point(50, 108), ground: point(50, 116) }),
    active: Object.freeze({ pivot: point(63, 106), ground: point(63, 116) }),
    break: Object.freeze({ pivot: point(44, 110), ground: point(44, 116) }),
    transition: Object.freeze({ pivot: point(55, 102), ground: point(55, 116) }),
    defeat: Object.freeze({ pivot: point(48, 114), ground: point(48, 118) }),
  }),
  hover: Object.freeze({
    neutral: Object.freeze({ pivot: point(56, 82), ground: point(56, 116) }),
    telegraph: Object.freeze({ pivot: point(53, 84), ground: point(53, 116) }),
    active: Object.freeze({ pivot: point(63, 78), ground: point(63, 116) }),
    break: Object.freeze({ pivot: point(47, 87), ground: point(47, 116) }),
    transition: Object.freeze({ pivot: point(56, 74), ground: point(56, 116) }),
    defeat: Object.freeze({ pivot: point(49, 103), ground: point(49, 118) }),
  }),
  object: Object.freeze({
    neutral: Object.freeze({ pivot: point(56, 92), ground: point(56, 116) }),
    telegraph: Object.freeze({ pivot: point(56, 92), ground: point(56, 116) }),
    active: Object.freeze({ pivot: point(60, 88), ground: point(60, 116) }),
    break: Object.freeze({ pivot: point(50, 99), ground: point(50, 116) }),
    transition: Object.freeze({ pivot: point(56, 83), ground: point(56, 116) }),
    defeat: Object.freeze({ pivot: point(49, 112), ground: point(49, 118) }),
  }),
});

export const BOSS_COMBAT_BOSSES = Object.freeze([
  Object.freeze({ id: 'tithe-hound', row: 0, encounterId: 'c1-tithe-hound', scale: 1.56, anchorProfile: 'low' }),
  Object.freeze({ id: 'mateus', row: 1, encounterId: 'fp1-mateus', scale: 1.58, anchorProfile: 'grounded' }),
  Object.freeze({ id: 'captain-kaji', row: 2, encounterId: 'c3-captain-kaji', scale: 1.6, anchorProfile: 'grounded' }),
  Object.freeze({ id: 'widow-of-fog', row: 3, encounterId: 'c4-widow-of-fog', scale: 1.64, anchorProfile: 'hover' }),
  Object.freeze({ id: 'furnace-abbot', row: 4, encounterId: 'c5-furnace-abbot', scale: 1.68, anchorProfile: 'grounded' }),
  Object.freeze({ id: 'ujiro', row: 5, encounterId: 'c6-ujiro', scale: 1.58, anchorProfile: 'grounded' }),
  Object.freeze({ id: 'bell-warden-chiyo', row: 6, encounterId: 'c7-bell-warden-chiyo', scale: 1.68, anchorProfile: 'grounded' }),
  Object.freeze({ id: 'lady-enma', row: 7, encounterId: 'c8-lady-enma', scale: 1.68, anchorProfile: 'hover' }),
  Object.freeze({ id: 'yearless-bell', row: 8, encounterId: 'c9-yearless-bell', scale: 1.72, anchorProfile: 'object' }),
  Object.freeze({ id: 'kurozane', row: 9, encounterId: 'c9-kurozane', scale: 1.7, anchorProfile: 'grounded' }),
]);

export const BOSS_COMBAT_ATLAS = Object.freeze({
  url: './assets/art/boss-combat-suite/boss-combat-atlas.png',
  width: 672,
  height: 1280,
  columns: 6,
  rows: 10,
  cellWidth: 112,
  cellHeight: 128,
});

const BOSS_BY_TEMPLATE = new Map(BOSS_COMBAT_BOSSES.map((boss) => [boss.id, boss]));

export function hasBossCombatTemplate(templateId) {
  return BOSS_BY_TEMPLATE.has(templateId);
}

export function getBossCombatFrame(templateId, pose = 'neutral') {
  const boss = BOSS_BY_TEMPLATE.get(templateId);
  if (!boss) throw new RangeError(`Unknown boss combat template: ${templateId}`);
  const column = BOSS_COMBAT_POSES.indexOf(pose);
  if (column < 0) throw new RangeError(`Unknown boss combat pose: ${pose}`);
  const anchors = BOSS_COMBAT_ANCHOR_PROFILES[boss.anchorProfile][pose];
  return Object.freeze({
    templateId,
    encounterId: boss.encounterId,
    pose,
    row: boss.row,
    column,
    x: column * BOSS_COMBAT_ATLAS.cellWidth,
    y: boss.row * BOSS_COMBAT_ATLAS.cellHeight,
    width: BOSS_COMBAT_ATLAS.cellWidth,
    height: BOSS_COMBAT_ATLAS.cellHeight,
    scale: boss.scale,
    anchorProfile: boss.anchorProfile,
    pivot: anchors.pivot,
    ground: anchors.ground,
  });
}

/** Resolve an authored pivot and ground anchor into a stable destination rect. */
export function getBossCombatDrawPlacement(frame, {
  anchorX = 0,
  groundY = 0,
  drawHeight = frame?.height,
} = {}) {
  if (!frame?.pivot || !frame?.ground || !(drawHeight > 0)) throw new TypeError('A boss frame and positive drawHeight are required.');
  const pixelScale = drawHeight / frame.height;
  const pivotX = anchorX - ((frame.ground.x - frame.pivot.x) * pixelScale);
  const pivotY = groundY - ((frame.ground.y - frame.pivot.y) * pixelScale);
  return Object.freeze({
    x: pivotX - (frame.pivot.x * pixelScale),
    y: pivotY - (frame.pivot.y * pixelScale),
    width: frame.width * pixelScale,
    height: drawHeight,
    pivotX,
    pivotY,
    groundX: anchorX,
    groundY,
    pixelScale,
  });
}

export function getBossCombatPresentationPose({
  hp = 1,
  active = true,
  phase = null,
  actorPose = null,
  targetPose = null,
} = {}) {
  if (!active || hp <= 0) return 'defeat';
  if (targetPose === 'stagger') return 'break';
  if (phase === 'windup' || actorPose === 'windup') return 'telegraph';
  // `transition` remains reserved until the simulation publishes an explicit,
  // reliable boss phase-boundary signal. A generic status glyph is not one.
  if (actorPose === 'attack') return 'active';
  return 'neutral';
}

/** Capture only bosses that newly reached a lethal or nonlethal terminal state. */
export function getNewlyTerminalBossCombatActors(beforeActors = [], afterActors = []) {
  const beforeById = new Map(beforeActors.map((actor) => [actor?.instanceId, actor]));
  return Object.freeze(afterActors.filter((actor) => {
    if (!actor?.instanceId || !hasBossCombatTemplate(actor.templateId)) return false;
    const before = beforeById.get(actor.instanceId);
    const wasPresent = before?.hp > 0 && before.active !== false;
    const isTerminal = actor.hp <= 0 || actor.active === false;
    return wasPresent && isTerminal;
  }));
}

/** Replace a pre-action ghost with its post-resolution boss during the hold. */
export function mergeBossTerminalPresentationActors(
  presentationActors = [],
  terminalBossActors = [],
  terminalWindow = false,
) {
  if (!terminalWindow || !terminalBossActors.length) return presentationActors;
  const terminalById = new Map(terminalBossActors.map((actor) => [actor.instanceId, actor]));
  const merged = presentationActors.map((actor) => terminalById.get(actor.instanceId) ?? actor);
  const mergedIds = new Set(merged.map((actor) => actor.instanceId));
  for (const actor of terminalBossActors) {
    if (!mergedIds.has(actor.instanceId)) merged.push(actor);
  }
  return Object.freeze(merged);
}

export function bossCombatImageHasExpectedSize(image) {
  return Boolean(image)
    && image.naturalWidth === BOSS_COMBAT_ATLAS.width
    && image.naturalHeight === BOSS_COMBAT_ATLAS.height;
}
