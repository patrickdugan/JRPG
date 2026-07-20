import { NPC_FIELD_ROLES } from './npc-field-atlas.mjs';
import { PARTY_ATLAS_DIRECTIONS, PARTY_ATLAS_MEMBERS } from './sprite-atlas.mjs';

/**
 * Resolve only the structured presentation record owned by a level
 * interactable. Action, ID, label, result, and prose are deliberately absent
 * from this boundary so an untyped interactable always fails closed.
 */
export function resolveFieldCharacterPresentation(fieldCharacter) {
  if (!fieldCharacter || typeof fieldCharacter !== 'object' || Array.isArray(fieldCharacter)) return null;
  if (fieldCharacter.kind === 'npc' && NPC_FIELD_ROLES.includes(fieldCharacter.role)) {
    return Object.freeze({ kind: 'npc', role: fieldCharacter.role });
  }
  if (
    fieldCharacter.kind === 'party'
    && PARTY_ATLAS_MEMBERS.includes(fieldCharacter.memberId)
    && PARTY_ATLAS_DIRECTIONS.includes(fieldCharacter.facing)
  ) {
    return Object.freeze({
      kind: 'party',
      memberId: fieldCharacter.memberId,
      facing: fieldCharacter.facing,
    });
  }
  return null;
}
