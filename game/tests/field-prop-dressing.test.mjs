import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LEVELS, TERRAIN_TAGS, getLevel } from '../content/levels.mjs';
import { getFieldPropFrame } from '../field-prop-atlas.mjs';
import {
  FIELD_PROP_FAMILY_RULES,
  drawFieldPropDressing,
  fieldPropDressingCoverage,
  fieldPropHash,
  resolveFieldPropDressing,
} from '../field-prop-dressing.mjs';
import { resolveWorldThemeForLevel } from '../world-tileset-atlas.mjs';

function impassableCells(level) {
  const cells = new Set(level.blocked);
  for (const tile of level.terrain ?? []) {
    if (TERRAIN_TAGS[tile.tag]?.passable === false) cells.add(tile.at);
  }
  return cells;
}

function protectedCells(level) {
  const cells = new Set();
  for (const exit of level.exits ?? []) cells.add(exit.at);
  for (const interactable of level.interactables ?? []) cells.add(interactable.at);
  for (const hazard of level.hazards ?? []) (hazard.tiles ?? []).forEach((tile) => cells.add(tile));
  if (level.spawn) cells.add(`${level.spawn.x},${level.spawn.y}`);
  return cells;
}

function serialize(dressing) {
  return JSON.stringify({ ...dressing, dressedCells: [...dressing.dressedCells].sort() });
}

function synthetic(id, rows, extra = {}) {
  const blocked = [];
  rows.forEach((row, y) => [...row].forEach((character, x) => {
    if (character === '#') blocked.push(`${x},${y}`);
  }));
  return {
    id,
    kind: 'field',
    width: rows[0].length,
    height: rows.length,
    blocked,
    terrain: [],
    hazards: [],
    exits: [],
    interactables: [],
    spawn: { x: 0, y: rows.length - 1 },
    palette: { id: 'takamine-rain' },
    ...extra,
  };
}

test('dressing is pure and deterministic and never consults Math.random', () => {
  const originalRandom = Math.random;
  Math.random = () => {
    throw new Error('Math.random must not be used by field prop dressing');
  };
  try {
    for (const level of LEVELS) {
      const first = resolveFieldPropDressing(level);
      const second = resolveFieldPropDressing(level);
      assert.equal(serialize(first), serialize(second), level.id);
      assert.notEqual(first.dressedCells, second.dressedCells, 'each call returns a fresh Set');
    }
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(fieldPropHash('hsh-river-lane|0,0|run1'), fieldPropHash('hsh-river-lane|0,0|run1'));
  assert.notEqual(fieldPropHash('a'), fieldPropHash('b'));
});

test('every placement covers only authored impassable cells and never walkable, exit, spawn, hazard, or interactable cells', () => {
  for (const level of LEVELS) {
    const dressing = resolveFieldPropDressing(level);
    const impassable = impassableCells(level);
    const guarded = protectedCells(level);
    const covered = new Set();
    assert.equal(dressing.themeId, resolveWorldThemeForLevel(level), level.id);
    for (const placement of dressing.placements) {
      const frame = getFieldPropFrame(placement.frameId);
      assert.ok(frame, `${level.id}: unknown frame ${placement.frameId}`);
      assert.ok(frame.family === dressing.familyId || frame.family === 'tall', `${level.id}: ${placement.frameId} is off-theme`);
      assert.equal(frame.widthCells, placement.widthCells);
      assert.equal(frame.heightCells, placement.heightCells);
      assert.equal(placement.cells.length, placement.widthCells * placement.heightCells);
      for (let dy = 0; dy < placement.heightCells; dy += 1) {
        for (let dx = 0; dx < placement.widthCells; dx += 1) {
          assert.ok(placement.cells.includes(`${placement.x + dx},${placement.y + dy}`));
        }
      }
      for (const cell of placement.cells) {
        assert.equal(impassable.has(cell), true, `${level.id}: ${placement.frameId} covers walkable ${cell}`);
        assert.equal(guarded.has(cell), false, `${level.id}: ${placement.frameId} covers protected ${cell}`);
        assert.equal(covered.has(cell), false, `${level.id}: overlapping dressing at ${cell}`);
        covered.add(cell);
      }
    }
    assert.deepEqual([...dressing.dressedCells].sort(), [...covered].sort(), level.id);
  }
});

test('coverage across all 48 levels dresses nearly every impassable cell', (t) => {
  assert.equal(LEVELS.length, 48);
  let impassable = 0;
  let dressed = 0;
  let fieldImpassable = 0;
  let fieldDressed = 0;
  const undressedLevels = [];
  const frames = new Set();
  for (const level of LEVELS) {
    const dressing = resolveFieldPropDressing(level);
    const coverage = fieldPropDressingCoverage(level, dressing);
    impassable += coverage.impassableCells;
    dressed += coverage.dressedCells;
    if (level.kind === 'field') {
      fieldImpassable += coverage.impassableCells;
      fieldDressed += coverage.dressedCells;
    }
    if (coverage.coverage < 1) undressedLevels.push(`${level.id} ${coverage.dressedCells}/${coverage.impassableCells}`);
    assert.ok(coverage.coverage >= 0.8, `${level.id} dresses only ${(coverage.coverage * 100).toFixed(1)}%`);
    dressing.placements.forEach((placement) => frames.add(placement.frameId));
  }
  const percent = (100 * dressed) / impassable;
  t.diagnostic(`field-prop coverage: ${dressed}/${impassable} impassable cells (${percent.toFixed(1)}%) across ${LEVELS.length} levels`);
  t.diagnostic(`field levels: ${fieldDressed}/${fieldImpassable} (${((100 * fieldDressed) / fieldImpassable).toFixed(1)}%); distinct frames used: ${frames.size}`);
  t.diagnostic(`partially dressed: ${undressedLevels.join('; ')}`);
  assert.equal(impassable, 1092);
  assert.ok(percent >= 97, `overall coverage ${percent.toFixed(1)}% is below 97%`);
  assert.ok(frames.size >= 80, `only ${frames.size} distinct frames are used`);
});

test('Hoshigawa River Lane house rows become river-ward buildings and the blocked cart stays clear', () => {
  const level = getLevel('hsh-river-lane');
  const dressing = resolveFieldPropDressing(level);
  assert.equal(dressing.themeId, 'hoshigawa-river-ward');
  assert.equal(dressing.familyId, 'river');
  const rows = [
    ...[0, 1, 2, 3, 4, 5, 14, 15, 16, 17, 18, 19].map((x) => `${x},0`),
    ...[1, 2, 3, 14, 15, 16].map((x) => `${x},3`),
  ];
  const byCell = new Map(dressing.placements.flatMap((placement) => placement.cells.map((cell) => [cell, placement])));
  for (const cell of rows) {
    const placement = byCell.get(cell);
    assert.ok(placement, `river lane cell ${cell} is undressed`);
    assert.match(placement.frameId, /^(river|tall):/u);
  }
  assert.ok(rows.filter((cell) => /strip1-/u.test(byCell.get(cell).frameId)).length >= 12, 'house rows read as buildings');
  assert.equal(dressing.dressedCells.has('6,7'), false, 'the inspectable cart cell is never covered');
  for (const cell of ['5,7', '7,7']) assert.equal(getFieldPropFrame(byCell.get(cell).frameId).kind, 'prop');
  assert.deepEqual(fieldPropDressingCoverage(level, dressing), { impassableCells: 21, dressedCells: 20, coverage: 20 / 21 });
});

test('Kurohana castle levels use lacquer castle walls and stay on theme', () => {
  for (const id of ['krh-audience-hall', 'krh-blood-conservatory', 'c8-black-gate']) {
    const dressing = resolveFieldPropDressing(getLevel(id));
    assert.equal(dressing.familyId, 'castle', id);
    assert.ok(dressing.placements.some((placement) => /^castle:(strip|wall|block)/u.test(placement.frameId)), id);
    assert.ok(dressing.placements.every((placement) => /^(castle|tall):/u.test(placement.frameId)), id);
  }
});

test('cluster shapes choose fitting pieces', () => {
  const block = resolveFieldPropDressing(synthetic('shape-3x3', ['.....', '.###.', '.###.', '.###.', '.....']));
  assert.deepEqual(block.placements.map((placement) => [placement.frameId, placement.x, placement.y]), [['village:block-3x3', 1, 1]]);

  const hall = resolveFieldPropDressing(synthetic('shape-3x2', ['.....', '.###.', '.###.', '.....']));
  assert.deepEqual(hall.placements.map((placement) => placement.frameId), ['village:block-3x2']);

  const pair = resolveFieldPropDressing(synthetic('shape-pair', ['...', '.#.', '.#.', '...']));
  assert.equal(pair.placements.length, 1);
  assert.match(pair.placements[0].frameId, /^tall:/u);
  assert.ok(FIELD_PROP_FAMILY_RULES.village.talls.includes(pair.placements[0].frameId.slice(5)));

  const walled = resolveFieldPropDressing(synthetic('shape-pair', ['...', '.#.', '.#.', '...']), { themeId: 'kurohana-black-castle' });
  assert.equal(walled.familyId, 'castle');
  assert.deepEqual(walled.placements.map((placement) => placement.frameId), ['castle:wall-top', 'castle:wall-bottom']);

  const single = resolveFieldPropDressing(synthetic('shape-single', ['...', '.#.', '...']));
  assert.equal(getFieldPropFrame(single.placements[0].frameId).kind, 'prop');

  const cell = resolveFieldPropDressing(synthetic('shape-cell', ['.....', '.###.', '.#.#.', '.....']), { themeId: 'hidden-archive-chapel' });
  const frames = Object.fromEntries(cell.placements.map((placement) => [`${placement.x},${placement.y}`, placement.frameId]));
  assert.equal(frames['1,1'], 'archive:strip1-left');
  assert.equal(frames['3,1'], 'archive:strip1-right');
  assert.equal(frames['1,2'], 'archive:wall-bottom');
  assert.equal(frames['3,2'], 'archive:wall-bottom');

  const longRow = resolveFieldPropDressing(synthetic('shape-row', ['####################', '....................']));
  assert.ok(longRow.placements.filter((placement) => placement.frameId.endsWith('strip1-left')).length >= 3, 'long rows split into several buildings');
  assert.equal(longRow.dressedCells.size, 20);
});

test('protected and authored-surface cells are left undressed while impassable terrain is dressed', () => {
  const guarded = synthetic('guarded', ['#####', '.....', '.....'], {
    interactables: [{ id: 'door', at: '2,0' }],
    exits: [{ id: 'out', at: '4,0' }],
  });
  const dressing = resolveFieldPropDressing(guarded);
  assert.equal(dressing.dressedCells.has('2,0'), false);
  assert.equal(dressing.dressedCells.has('4,0'), false);
  assert.equal(dressing.dressedCells.has('0,0'), true);

  const table = synthetic('table', ['.##.', '....'], { terrain: [{ at: '1,0', tag: 'archive-floor' }] });
  assert.equal(resolveFieldPropDressing(table).dressedCells.has('1,0'), false);

  const gallery = synthetic('gallery', ['....', '....', '....'], {
    terrain: [{ at: '0,0', tag: 'high-gallery' }, { at: '0,1', tag: 'high-gallery' }, { at: '0,2', tag: 'high-gallery' }],
    spawn: { x: 3, y: 2 },
  });
  assert.deepEqual([...resolveFieldPropDressing(gallery).dressedCells].sort(), ['0,0', '0,1', '0,2']);

  for (const invalid of [null, undefined, {}, { width: 0, height: 4 }, { width: 2.5, height: 3 }]) {
    const empty = resolveFieldPropDressing(invalid);
    assert.deepEqual(empty.placements, []);
    assert.equal(empty.dressedCells.size, 0);
  }
});

test('explicit theme overrides change only the family, never the covered cells', () => {
  const level = getLevel('tkm-rain-gate');
  const village = resolveFieldPropDressing(level);
  const forge = resolveFieldPropDressing(level, { themeId: 'oni-forge' });
  const fallback = resolveFieldPropDressing(level, { themeId: 'not-a-theme' });
  assert.equal(village.familyId, 'village');
  assert.equal(forge.familyId, 'forge');
  assert.equal(serialize(fallback), serialize(village));
  assert.deepEqual([...forge.dressedCells].sort(), [...village.dressedCells].sort());
  assert.ok(village.placements.some((placement) => placement.frameId === 'village:block-3x3'), 'the rain gate halls read as landmarks');
});

test('adjacent single props are never identical twins', () => {
  for (const level of LEVELS) {
    const singles = new Map();
    for (const placement of resolveFieldPropDressing(level).placements) {
      if (getFieldPropFrame(placement.frameId).kind === 'prop') singles.set(`${placement.x},${placement.y}`, placement.frameId);
    }
    for (const [cell, frameId] of singles) {
      const [x, y] = cell.split(',').map(Number);
      assert.notEqual(singles.get(`${x + 1},${y}`), frameId, `${level.id} ${cell}`);
      assert.notEqual(singles.get(`${x},${y + 1}`), frameId, `${level.id} ${cell}`);
    }
  }
});

test('draw helper scales exact frame rectangles and fails closed on a wrong-size atlas', () => {
  const calls = [];
  const ctx = {
    imageSmoothingEnabled: true,
    drawImage(...args) {
      calls.push({ args, smoothing: this.imageSmoothingEnabled });
    },
  };
  const image = { naturalWidth: 256, naturalHeight: 416 };
  const dressing = resolveFieldPropDressing(getLevel('hsh-river-lane'));
  const drawn = drawFieldPropDressing(ctx, image, dressing, 10, 20, 48);
  assert.equal(drawn, dressing.placements.length);
  assert.equal(calls.length, dressing.placements.length);
  assert.equal(ctx.imageSmoothingEnabled, true, 'smoothing state is restored');
  calls.forEach(({ args, smoothing }, index) => {
    const placement = dressing.placements[index];
    const frame = getFieldPropFrame(placement.frameId);
    assert.equal(smoothing, false);
    assert.deepEqual(args, [
      image, frame.x, frame.y, frame.width, frame.height,
      10 + placement.x * 48, 20 + placement.y * 48, placement.widthCells * 48, placement.heightCells * 48,
    ]);
  });
  assert.equal(drawFieldPropDressing(ctx, { naturalWidth: 255, naturalHeight: 416 }, dressing, 0, 0, 48), 0);
  assert.equal(drawFieldPropDressing(ctx, image, { placements: [] }, 0, 0, 48), 0);
  assert.equal(drawFieldPropDressing(null, image, dressing, 0, 0, 48), 0);
  assert.equal(calls.length, dressing.placements.length);
});
