export const PARTY_COMBAT_MEMBERS = Object.freeze([
  'ren',
  'aya',
  'lise',
  'mateus',
  'genta',
  'kiku',
]);

export const PARTY_COMBAT_POSES = Object.freeze([
  'idle',
  'move',
  'guard',
  'hit',
  'basic-strike-windup',
  'basic-strike-active',
  'signature-a',
  'signature-b',
  'defeat',
]);

export const PARTY_DEFEAT_HOLD_MS = 420;

export const PARTY_COMBAT_ATLAS = Object.freeze({
  url: './assets/art/party-combat-suite/party-combat-actions.png',
  width: 432,
  height: 384,
  columns: 9,
  rows: 6,
  cellWidth: 48,
  cellHeight: 64,
  pivotX: 24,
  pivotY: 58,
});

export const PARTY_COMBAT_SKILL_POSES = Object.freeze({
  'courier-cut': 'signature-a',
  'cinder-route': 'signature-b',
  'warding-script': 'signature-a',
  'hunter-thrust': 'signature-a',
  'dawn-bolt': 'signature-b',
  'penitent-night': 'signature-a',
  'pilgrim-maul': 'signature-a',
  'cold-medicine': 'signature-a',
});

export function getPartyCombatFrame(memberId, pose = 'idle') {
  const row = PARTY_COMBAT_MEMBERS.indexOf(memberId);
  if (row < 0) throw new RangeError(`Unknown party combat member: ${memberId}`);
  const column = PARTY_COMBAT_POSES.indexOf(pose);
  if (column < 0) throw new RangeError(`Unknown party combat pose: ${pose}`);
  return Object.freeze({
    memberId,
    pose,
    row,
    column,
    x: column * PARTY_COMBAT_ATLAS.cellWidth,
    y: row * PARTY_COMBAT_ATLAS.cellHeight,
    width: PARTY_COMBAT_ATLAS.cellWidth,
    height: PARTY_COMBAT_ATLAS.cellHeight,
    pivotX: PARTY_COMBAT_ATLAS.pivotX,
    pivotY: PARTY_COMBAT_ATLAS.pivotY,
  });
}

export function getPartyCombatPresentationPose({
  hp = 1,
  active = true,
  actionId = null,
  phase = null,
  actorPose = null,
  targetPose = null,
  stance = 'neutral',
  moving = false,
} = {}) {
  if (!active || hp <= 0) return 'defeat';
  if (targetPose === 'stagger') return 'hit';
  if (phase === 'windup' || actorPose === 'windup') return 'basic-strike-windup';
  if (phase === 'movement' || moving) return 'move';
  if (phase === 'recovery') return 'idle';
  if (actorPose === 'attack') {
    return PARTY_COMBAT_SKILL_POSES[actionId] ?? 'basic-strike-active';
  }
  if (stance === 'guard') return 'guard';
  return 'idle';
}

/** Capture party members that newly reached a lethal or inactive state. */
export function getNewlyTerminalPartyCombatActors(beforeActors = [], afterActors = []) {
  const beforeById = new Map(beforeActors.map((actor) => [actor?.instanceId, actor]));
  return Object.freeze(afterActors.filter((actor) => {
    if (!actor?.instanceId || actor.faction !== 'party' || !PARTY_COMBAT_MEMBERS.includes(actor.templateId)) return false;
    const before = beforeById.get(actor.instanceId);
    const wasPresent = before?.hp > 0 && before.active !== false;
    const isTerminal = actor.hp <= 0 || actor.active === false;
    return wasPresent && isTerminal;
  }));
}

/** Replace a pre-action ghost with its post-resolution party member during the hold. */
export function mergePartyTerminalPresentationActors(
  presentationActors = [],
  terminalPartyActors = [],
  terminalWindow = false,
) {
  if (!terminalWindow || !terminalPartyActors.length) return presentationActors;
  const terminalById = new Map(terminalPartyActors.map((actor) => [actor.instanceId, actor]));
  const merged = presentationActors.map((actor) => terminalById.get(actor.instanceId) ?? actor);
  const mergedIds = new Set(merged.map((actor) => actor.instanceId));
  for (const actor of terminalPartyActors) {
    if (!mergedIds.has(actor.instanceId)) merged.push(actor);
  }
  return Object.freeze(merged);
}

export function partyCombatImageHasExpectedSize(image) {
  return Boolean(image)
    && image.naturalWidth === PARTY_COMBAT_ATLAS.width
    && image.naturalHeight === PARTY_COMBAT_ATLAS.height;
}
