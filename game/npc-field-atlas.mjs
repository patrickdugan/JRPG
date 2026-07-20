export const NPC_FIELD_ROLES = Object.freeze(['speaker', 'interviewee']);

export const NPC_FIELD_ATLAS = Object.freeze({
  url: './assets/art/npc-field-suite/npc-field-atlas.png',
  width: 64,
  height: 48,
  columns: 2,
  rows: 1,
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
export function resolveNpcFieldRole({ markerType, objectiveType, targetKind, activityType } = {}) {
  if (markerType === 'side-story' && objectiveType === 'talk' && targetKind === 'person') return 'speaker';
  if (markerType === 'scene-operation' && activityType === 'interview') return 'interviewee';
  return null;
}

export function getNpcFieldFrame(role) {
  const column = NPC_FIELD_ROLES.indexOf(role);
  if (column < 0) throw new RangeError(`Unknown NPC field role: ${role}`);
  return Object.freeze({
    role,
    column,
    row: 0,
    x: column * NPC_FIELD_ATLAS.cellWidth,
    y: 0,
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
