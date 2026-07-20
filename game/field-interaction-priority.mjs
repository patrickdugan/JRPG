/**
 * Select the authored interaction that should own the field action button.
 * A ready exit wins after every nearby available authored interaction is complete.
 * Future-locked interactions cannot trap the player beside an already-ready exit;
 * locked exits keep completed content available for Review.
 */
export function selectNearbyFieldInteractable(status) {
  const nearby = Array.isArray(status?.nearbyInteractables) ? status.nearbyInteractables : [];
  const incomplete = nearby.find((item) => !item.consumed && item.available !== false) ?? null;
  return incomplete ?? (status?.exit?.ready ? null : nearby[0] ?? null);
}
