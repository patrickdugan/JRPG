export const NPC_FIELD_ROLES = Object.freeze([
  'speaker', 'interviewee', 'confined-person', 'courier',
  'dock-worker', 'ferry-captain', 'market-seller', 'trade-broker',
  'print-organizer', 'port-clerk', 'physician', 'resident',
  'former-retainer', 'caretaker', 'net-mender', 'post-keeper',
]);
export const NPC_FIELD_POSES = Object.freeze(['south-idle', 'south-gesture']);

export const NPC_FIELD_ATLAS = Object.freeze({
  url: './assets/art/npc-field-suite/npc-field-atlas.png',
  width: 512,
  height: 96,
  columns: 16,
  rows: 2,
  cellWidth: 32,
  cellHeight: 48,
  pivot: Object.freeze([16, 44]),
  footPoint: Object.freeze([16, 44]),
});

/**
 * Resolve only explicit person metadata. Labels, IDs, instructions, and names
 * are intentionally ignored so props and ambiguous operation points stay on
 * Campaign's existing geometric fallback path.
 */
export function resolveNpcFieldRole({ markerType, objectiveType, targetKind, activityType, presentationRole } = {}) {
  if (markerType === 'side-story' && objectiveType === 'talk' && targetKind === 'person') {
    return NPC_FIELD_ROLES.includes(presentationRole) ? presentationRole : 'speaker';
  }
  if (markerType === 'scene-operation' && activityType === 'interview') return 'interviewee';
  return null;
}

export function getNpcFieldFrame(role, pose = 'south-idle') {
  const column = NPC_FIELD_ROLES.indexOf(role);
  if (column < 0) throw new RangeError(`Unknown NPC field role: ${role}`);
  const row = NPC_FIELD_POSES.indexOf(pose);
  if (row < 0) throw new RangeError(`Unknown NPC field pose: ${pose}`);
  return Object.freeze({
    role,
    pose,
    column,
    row,
    x: column * NPC_FIELD_ATLAS.cellWidth,
    y: row * NPC_FIELD_ATLAS.cellHeight,
    width: NPC_FIELD_ATLAS.cellWidth,
    height: NPC_FIELD_ATLAS.cellHeight,
    pivot: NPC_FIELD_ATLAS.pivot,
    footPoint: NPC_FIELD_ATLAS.footPoint,
  });
}

export function npcFieldAtlasImageHasExpectedSize(image) {
  return Boolean(image)
    && image.naturalWidth === NPC_FIELD_ATLAS.width
    && image.naturalHeight === NPC_FIELD_ATLAS.height;
}
