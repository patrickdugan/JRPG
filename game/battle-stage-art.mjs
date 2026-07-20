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

const REGIONAL_BATTLE_STAGE_IDS = Object.freeze([
  'hsh-census-square',
  'c1-flooded-cedars',
  'fp1-wet-cedar-stage',
  'c1-tax-storehouse',
  'fp1-flooded-archive-stage',
  'hsh-prison-ferry',
  'hsh-bell-aqueduct',
  'sdg-rain-docks',
  'sdg-salt-warehouse',
  'ngi-tide-caves',
  'ngi-storm-reef',
  'kgr-ash-fields',
  'kgr-archive-furnace',
  'kzu-archive-roof',
  'kzu-public-tribunal',
  'c8-black-gate',
  'krh-outer-archive',
  'krh-observatory',
]);

function regionalBattleStageArt(levelId) {
  return Object.freeze({
    id: `${levelId}-board-v01`,
    levelId,
    url: `./assets/art/regional-battle-stages/${levelId}-board-v01.png`,
    sourceWidth: 384,
    sourceHeight: 224,
    sourceCell: 32,
    columns: 12,
    rows: 7,
  });
}

const REGIONAL_BATTLE_STAGE_ART = Object.fromEntries(
  REGIONAL_BATTLE_STAGE_IDS.map((levelId) => [levelId, regionalBattleStageArt(levelId)]),
);

export const BATTLE_STAGE_ART = Object.freeze({
  [TAKAMINE_BELL_CHAMBER_ART.levelId]: TAKAMINE_BELL_CHAMBER_ART,
  ...REGIONAL_BATTLE_STAGE_ART,
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
