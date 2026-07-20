const TAKAMINE_BELL_CHAMBER_ART = Object.freeze({
  id: 'takamine-bell-chamber-board-v1',
  levelId: 'tkm-bell-chamber',
  url: './assets/art/takamine-bell-chamber/takamine-bell-chamber-board.png',
  sourceWidth: 384,
  sourceHeight: 224,
  sourceCell: 32,
  columns: 12,
  rows: 7,
});

export const BATTLE_STAGE_ART = Object.freeze({
  [TAKAMINE_BELL_CHAMBER_ART.levelId]: TAKAMINE_BELL_CHAMBER_ART,
});

export function getBattleStageArt(levelId) {
  return BATTLE_STAGE_ART[levelId] ?? null;
}

export function battleStageArtMatchesLevel(stageArt, level) {
  if (!stageArt || !level) return false;
  return stageArt.levelId === level.id
    && stageArt.columns === level.width
    && stageArt.rows === level.height
    && stageArt.sourceCell === level.spacePx
    && stageArt.sourceWidth === level.width * level.spacePx
    && stageArt.sourceHeight === level.height * level.spacePx;
}

export function battleStageImageHasExpectedSize(stageArt, image) {
  return Boolean(stageArt && image)
    && image.naturalWidth === stageArt.sourceWidth
    && image.naturalHeight === stageArt.sourceHeight;
}
