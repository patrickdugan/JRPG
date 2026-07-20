export const BATTLE_VFX_EFFECTS = Object.freeze([
  'cut',
  'pierce',
  'crush',
  'arcane',
  'ember',
  'frost',
  'storm',
  'radiance',
  'umbral',
]);

export const BATTLE_VFX_ATLAS = Object.freeze({
  url: './assets/art/battle-vfx-suite/battle-vfx-suite-atlas.png',
  width: 384,
  height: 576,
  columns: 6,
  rows: 9,
  cellWidth: 64,
  cellHeight: 64,
  anchorX: 32,
  anchorY: 32,
});

function frameColumn(phase, progress = 0) {
  const amount = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  if (phase === 'windup') return amount < 0.5 ? 0 : 1;
  if (phase === 'movement') return 1;
  if (phase === 'projectile-or-trail') return amount < 0.34 ? 1 : amount < 0.8 ? 2 : 3;
  if (phase === 'impact') return amount < 0.6 ? 2 : 3;
  if (phase === 'stagger') return amount < 0.65 ? 3 : 4;
  if (phase === 'status-glyph') return 4;
  if (phase === 'recovery') return amount < 0.5 ? 4 : 5;
  return null;
}

export function getBattleVfxFrame({ delivery, essence, phase, phaseProgress } = {}) {
  const effectId = BATTLE_VFX_EFFECTS.includes(essence) ? essence : delivery;
  const row = BATTLE_VFX_EFFECTS.indexOf(effectId);
  const column = frameColumn(phase, phaseProgress);
  if (row < 0 || column === null) return null;
  return Object.freeze({
    effectId,
    row,
    column,
    x: column * BATTLE_VFX_ATLAS.cellWidth,
    y: row * BATTLE_VFX_ATLAS.cellHeight,
    width: BATTLE_VFX_ATLAS.cellWidth,
    height: BATTLE_VFX_ATLAS.cellHeight,
    anchorX: BATTLE_VFX_ATLAS.anchorX,
    anchorY: BATTLE_VFX_ATLAS.anchorY,
  });
}

export function battleVfxImageHasExpectedSize(image) {
  return Boolean(image)
    && image.naturalWidth === BATTLE_VFX_ATLAS.width
    && image.naturalHeight === BATTLE_VFX_ATLAS.height;
}
