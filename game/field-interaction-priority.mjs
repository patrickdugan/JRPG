/**
 * Select the authored interaction that should own the field action button.
 * A ready exit wins only after every nearby authored interaction is complete;
 * locked exits keep completed content available for Review.
 */
export function selectNearbyFieldInteractable(status) {
  const nearby = Array.isArray(status?.nearbyInteractables) ? status.nearbyInteractables : [];
  const incomplete = nearby.find((item) => !item.consumed) ?? null;
  return incomplete ?? (status?.exit?.ready ? null : nearby[0] ?? null);
}
