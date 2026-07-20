function canonicalLevelMap(levels) {
  return new Map((levels ?? []).filter((level) => level?.id).map((level) => [level.id, level]));
}

/**
 * Choose the first authored exit on the shortest directed route to a story
 * destination. Authored exit order is the stable tie-breaker.
 */
export function resolveIntendedRouteExit(levels, startLevelId, targetLevelId) {
  if (!startLevelId || !targetLevelId || startLevelId === targetLevelId) return null;
  const levelById = canonicalLevelMap(levels);
  if (!levelById.has(startLevelId) || !levelById.has(targetLevelId)) return null;

  const queue = [{ levelId: startLevelId, firstExit: null }];
  const visited = new Set([startLevelId]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const entry = queue[cursor];
    const level = levelById.get(entry.levelId);
    for (const exit of level.exits ?? []) {
      const firstExit = entry.firstExit ?? exit;
      if (exit.destinationLevelId === targetLevelId) return firstExit;
      if (!levelById.has(exit.destinationLevelId) || visited.has(exit.destinationLevelId)) continue;
      visited.add(exit.destinationLevelId);
      queue.push({ levelId: exit.destinationLevelId, firstExit });
    }
  }
  return null;
}
