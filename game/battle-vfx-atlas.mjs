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

export const BATTLE_VFX_ANCHORS = Object.freeze({
  source: 'source',
  target: 'target',
  emission: 'emission',
});

function frameColumn(phase, progress = 0) {
  const amount = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  if (phase === 'windup') return amount < 0.5 ? 0 : 1;
  if (phase === 'movement') return 1;
  if (['projectile', 'trail', 'projectile-or-trail'].includes(phase)) {
    return amount < 0.34 ? 1 : amount < 0.8 ? 2 : 3;
  }
  if (phase === 'impact') return amount < 0.6 ? 2 : 3;
  if (phase === 'stagger') return amount < 0.65 ? 3 : 4;
  if (phase === 'status-glyph') return 4;
  if (phase === 'recovery') return amount < 0.5 ? 4 : 5;
  return null;
}

function freezeAnchor(channel, anchor) {
  return Object.freeze({ channel, anchor });
}

/**
 * Resolve authored overlay placement without depending on canvas or battle state.
 * A status phase may intentionally produce two overlays when the action applies
 * both a target status and a self status.
 */
export function resolveBattleVfxAnchors({
  phase,
  statusGlyph = null,
  selfStatusGlyph = null,
} = {}) {
  if (phase === 'status-glyph') {
    const anchors = [];
    if (statusGlyph) anchors.push(freezeAnchor('status', BATTLE_VFX_ANCHORS.target));
    if (selfStatusGlyph) anchors.push(freezeAnchor('self-status', BATTLE_VFX_ANCHORS.source));
    return Object.freeze(anchors);
  }
  if (['projectile', 'trail', 'projectile-or-trail'].includes(phase)) {
    return Object.freeze([freezeAnchor('phase', BATTLE_VFX_ANCHORS.emission)]);
  }
  if (['impact', 'stagger'].includes(phase)) {
    return Object.freeze([freezeAnchor('phase', BATTLE_VFX_ANCHORS.target)]);
  }
  if (['windup', 'movement', 'recovery'].includes(phase)) {
    return Object.freeze([freezeAnchor('phase', BATTLE_VFX_ANCHORS.source)]);
  }
  return Object.freeze([]);
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
