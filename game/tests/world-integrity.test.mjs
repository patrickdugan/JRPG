import assert from 'node:assert/strict';
import test from 'node:test';
import { getAllChapters } from '../content/campaign.mjs';
import { LEVELS, TERRAIN_TAGS, getLevel } from '../content/levels.mjs';
import { ENCOUNTERS } from '../content/encounters.mjs';

function pointOf(value) {
  const key = typeof value === 'string' ? value : value?.at ?? `${value?.x},${value?.y}`;
  const [x, y] = key.split(',').map(Number);
  return { x, y, key };
}

function terrainAt(level, key) {
  return (level.terrain ?? []).find((entry) => (entry.at ?? entry.key) === key)?.tag;
}

function isOpen(level, value) {
  const { x, y, key } = pointOf(value);
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= level.width || y >= level.height) return false;
  if ((level.blocked ?? []).includes(key)) return false;
  return TERRAIN_TAGS[terrainAt(level, key)]?.passable !== false;
}

function legalNeighbors(level, value) {
  const origin = pointOf(value);
  const neighbors = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const target = { x: origin.x + dx, y: origin.y + dy };
      if (!isOpen(level, target)) continue;
      if (dx !== 0 && dy !== 0 && (!isOpen(level, { x: origin.x + dx, y: origin.y }) || !isOpen(level, { x: origin.x, y: origin.y + dy }))) continue;
      neighbors.push(target);
    }
  }
  return neighbors;
}

function canReach(level, from, destination) {
  const start = pointOf(from);
  const target = pointOf(destination).key;
  const seen = new Set([start.key]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    if (current.key === target) return true;
    for (const next of legalNeighbors(level, current)) {
      const normalized = pointOf(next);
      if (seen.has(normalized.key)) continue;
      seen.add(normalized.key);
      queue.push(normalized);
    }
  }
  return false;
}

test('every authored scene and named campaign map has an explicit resolvable level', () => {
  const chapters = getAllChapters();
  const mapReferences = chapters.flatMap((chapter) => chapter.maps ?? []);
  assert.equal(mapReferences.length, 46);
  assert.equal(new Set(mapReferences.map((entry) => entry.id)).size, 46);
  for (const map of mapReferences) assert.ok(getLevel(map.id), `missing campaign map ${map.id}`);
  for (const beat of chapters.flatMap((chapter) => chapter.beats)) {
    assert.ok(beat.mapId, `${beat.id} needs an explicit mapId`);
    assert.ok(getLevel(beat.mapId), `${beat.id} has unresolved mapId ${beat.mapId}`);
  }
});

test('every level spawn and exit honors exact collision rules and exits remain reachable', () => {
  for (const level of LEVELS) {
    assert.ok(isOpen(level, level.spawn), `${level.id} spawn must be open`);
    for (const exit of level.exits ?? []) {
      assert.ok(getLevel(exit.destinationLevelId), `${level.id}:${exit.id} has an unresolved destination`);
      assert.ok(isOpen(level, exit), `${level.id}:${exit.id} must be on an open space`);
      assert.ok(canReach(level, level.spawn, exit), `${level.id}:${exit.id} must be reachable with exact 8-way movement`);
    }
  }
});

test('encounter deployments are in bounds, open, and non-overlapping', () => {
  for (const encounter of ENCOUNTERS) {
    const level = getLevel(encounter.levelId);
    assert.ok(level, `${encounter.id} has an unresolved level`);
    const placements = [
      ...(encounter.party?.deployment ?? []).map((entry) => ({ id: entry.actorId, at: entry.at })),
      ...(encounter.party?.guestSupport ?? []).map((entry) => ({ id: entry.id, at: entry.at })),
      ...(encounter.enemies ?? []).flatMap((enemy) => (enemy.positions ?? [])
        .map((at, index) => ({ id: `${enemy.id}-${index}`, at }))),
    ];
    const occupied = new Set();
    for (const placement of placements) {
      const { key } = pointOf(placement.at);
      assert.ok(isOpen(level, placement.at), `${encounter.id}:${placement.id} must deploy on an open space`);
      assert.ok(!occupied.has(key), `${encounter.id} has overlapping deployment at ${key}`);
      occupied.add(key);
    }
  }
});
