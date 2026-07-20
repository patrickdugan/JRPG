/** DOM-free addressing for the authored Campaign scene-backdrop atlas. */

export const SCENE_BACKDROP_IDS = Object.freeze([
  'hoshigawa-rain-lane',
  'hoshigawa-record-room',
  'river-ferry-cedars',
  'tax-storehouse',
  'takamine-rain-temple',
  'takamine-undercrypt',
  'sodegaura-market-customs',
  'sodegaura-rain-docks',
  'nagi-fog-shore',
  'nagi-tide-wreck',
  'kagura-relay-ash',
  'kagura-forge-archive',
  'kozui-printmaker-lane',
  'kozui-tribunal-roof',
  'hushroad-camp',
  'hushroad-aqueduct',
  'black-gate-planning',
  'black-gate-causeway',
  'kurohana-living-archive',
  'daybreak-repair-montage',
]);

export const SCENE_BACKDROP_ATLAS = Object.freeze({
  id: 'campaign-scene-backdrop-suite-v1',
  url: './assets/art/scene-backdrop-suite/scene-backdrop-atlas.png',
  frameWidth: 320,
  frameHeight: 180,
  columns: 5,
  rows: 4,
  width: 1600,
  height: 720,
});

export const SCENE_BACKDROP_BY_BEAT_ID = Object.freeze({
  'p00-delivery-in-rain': 'hoshigawa-rain-lane',
  'p01-altered-order': 'hoshigawa-rain-lane',
  'p02-medicine-across-lane': 'hoshigawa-rain-lane',
  'p03-bailiff-returns': 'hoshigawa-rain-lane',
  'p04-river-escape': 'hoshigawa-rain-lane',
  'p05-archive-promise': 'hoshigawa-record-room',
  'c1-01-registers-omissions': 'hoshigawa-record-room',
  'c1-02-kikus-threshold': 'river-ferry-cedars',
  'c1-03-ferry-gossip': 'river-ferry-cedars',
  'c1-04-flooded-cedars': 'river-ferry-cedars',
  'c1-05-storehouse-clerk': 'tax-storehouse',
  'c1-06-copy-before-fire': 'tax-storehouse',
  'c2-01-rain-gate': 'takamine-rain-temple',
  'c2-02-chapel-service-route': 'takamine-rain-temple',
  'c2-03-lises-interruption': 'takamine-rain-temple',
  'c2-04-bell-stair': 'takamine-rain-temple',
  'c2-05-undercrypt-truth': 'takamine-undercrypt',
  'c2-06-name-from-europe': 'takamine-undercrypt',
  'c3-01-separate-arrivals': 'sodegaura-market-customs',
  'c3-02-the-checkpoint': 'sodegaura-market-customs',
  'c3-03-ledger-customs-house': 'sodegaura-market-customs',
  'c3-04-lantern-boat-escort': 'sodegaura-rain-docks',
  'c3-05-gentas-order': 'sodegaura-rain-docks',
  'c3-06-first-key': 'sodegaura-rain-docks',
  'c4-01-nets-in-fog': 'nagi-fog-shore',
  'c4-02-tide-caves': 'nagi-tide-wreck',
  'c4-03-varga-journal': 'nagi-tide-wreck',
  'c4-04-survivors-hold': 'nagi-tide-wreck',
  'c4-05-names-returned': 'nagi-fog-shore',
  'c4-06-kikus-terms': 'nagi-fog-shore',
  'c5-01-requisition-town': 'kagura-relay-ash',
  'c5-02-ash-fields': 'kagura-relay-ash',
  'c5-03-cipher-room': 'kagura-forge-archive',
  'c5-04-prison-locks': 'kagura-forge-archive',
  'c5-05-sigil-burned': 'kagura-forge-archive',
  'c5-06-midpoint-evidence': 'kagura-forge-archive',
  'c6-01-city-competing-needs': 'kozui-printmaker-lane',
  'c6-02-three-copies': 'kozui-printmaker-lane',
  'c6-03-tribunal': 'kozui-tribunal-roof',
  'c6-04-printmaker-flight': 'kozui-tribunal-roof',
  'c6-05-all-copies-leave': 'kozui-tribunal-roof',
  'c7-01-decision-map-table': 'hushroad-camp',
  'c7-02-former-retainer': 'hushroad-camp',
  'c7-03-aqueduct-names': 'hushroad-aqueduct',
  'c7-04-lises-revised-oath': 'hushroad-aqueduct',
  'c7-05-rescue-before-ring': 'hushroad-aqueduct',
  'c8-01-three-homecomings': 'black-gate-planning',
  'c8-02-consent-not-conscription': 'black-gate-planning',
  'c8-03-black-gate-bargain': 'black-gate-causeway',
  'c8-04-lantern-breach': 'black-gate-causeway',
  'c8-05-gate-opened': 'black-gate-causeway',
  'c9-01-archive-breathes': 'kurohana-living-archive',
  'c9-02-ujiros-last-ledger': 'kurohana-living-archive',
  'c9-03-conservatory-offers': 'kurohana-living-archive',
  'c9-04-yearless-bell': 'kurohana-living-archive',
  'c9-05-dawn-at-observatory': 'kurohana-living-archive',
  'c9-06-leave-evidence-alive': 'kurohana-living-archive',
  'e00-open-archive': 'daybreak-repair-montage',
  'e01-repair-work': 'daybreak-repair-montage',
  'e02-repaired-tower': 'daybreak-repair-montage',
});

export const SCENE_BACKDROP_CANONICAL_LEVEL_BY_BEAT_ID = Object.freeze({
  'p00-delivery-in-rain': 'hsh-river-lane',
  'p01-altered-order': 'hsh-river-lane',
  'p02-medicine-across-lane': 'hsh-river-lane',
  'p03-bailiff-returns': 'hsh-census-square',
  'p04-river-escape': 'hsh-riverbank',
  'p05-archive-promise': 'c1-shrine-archive',
  'c1-01-registers-omissions': 'c1-shrine-archive',
  'c1-02-kikus-threshold': 'c1-shrine-archive',
  'c1-03-ferry-gossip': 'c1-ferry-landing',
  'c1-04-flooded-cedars': 'c1-flooded-cedars',
  'c1-05-storehouse-clerk': 'c1-tax-storehouse',
  'c1-06-copy-before-fire': 'c1-tax-storehouse',
  'c2-01-rain-gate': 'tkm-rain-gate',
  'c2-02-chapel-service-route': 'tkm-abandoned-chapel',
  'c2-03-lises-interruption': 'tkm-abandoned-chapel',
  'c2-04-bell-stair': 'tkm-bell-stair',
  'c2-05-undercrypt-truth': 'tkm-flooded-undercroft',
  'c2-06-name-from-europe': 'tkm-bell-chamber',
  'c3-01-separate-arrivals': 'sdg-market-lane',
  'c3-02-the-checkpoint': 'sdg-market-lane',
  'c3-03-ledger-customs-house': 'sdg-customs-house',
  'c3-04-lantern-boat-escort': 'sdg-rain-docks',
  'c3-05-gentas-order': 'sdg-salt-warehouse',
  'c3-06-first-key': 'sdg-salt-warehouse',
  'c4-01-nets-in-fog': 'ngi-fishing-village',
  'c4-02-tide-caves': 'ngi-tide-caves',
  'c4-03-varga-journal': 'ngi-wrecked-carrack',
  'c4-04-survivors-hold': 'ngi-wrecked-carrack',
  'c4-05-names-returned': 'ngi-storm-reef',
  'c4-06-kikus-terms': 'ngi-fishing-village',
  'c5-01-requisition-town': 'kgr-requisition-town',
  'c5-02-ash-fields': 'kgr-ash-fields',
  'c5-03-cipher-room': 'kgr-archive-furnace',
  'c5-04-prison-locks': 'kgr-prison-locks',
  'c5-05-sigil-burned': 'kgr-archive-furnace',
  'c5-06-midpoint-evidence': 'kgr-archive-furnace',
  'c6-01-city-competing-needs': 'kzu-printmaker-lane',
  'c6-02-three-copies': 'kzu-printmaker-lane',
  'c6-03-tribunal': 'kzu-public-tribunal',
  'c6-04-printmaker-flight': 'kzu-archive-roof',
  'c6-05-all-copies-leave': 'kzu-canal-lock',
  'c7-01-decision-map-table': 'hsh-map-table',
  'c7-02-former-retainer': 'hsh-post-town',
  'c7-03-aqueduct-names': 'hsh-bell-aqueduct',
  'c7-04-lises-revised-oath': 'hsh-map-table',
  'c7-05-rescue-before-ring': 'hsh-bell-aqueduct',
  'c8-01-three-homecomings': 'c8-hoshigawa-return',
  'c8-02-consent-not-conscription': 'c8-black-gate',
  'c8-03-black-gate-bargain': 'c8-black-gate',
  'c8-04-lantern-breach': 'c8-black-gate',
  'c8-05-gate-opened': 'c8-black-gate',
  'c9-01-archive-breathes': 'krh-outer-archive',
  'c9-02-ujiros-last-ledger': 'krh-audience-hall',
  'c9-03-conservatory-offers': 'krh-blood-conservatory',
  'c9-04-yearless-bell': 'krh-bell-spine',
  'c9-05-dawn-at-observatory': 'krh-observatory',
  'c9-06-leave-evidence-alive': 'krh-outer-archive',
  'e00-open-archive': 'epi-hoshigawa-archive',
  'e01-repair-work': 'epi-sodegaura-storehouse',
  'e02-repaired-tower': 'epi-takamine-tower',
});

export const SCENE_BACKDROP_BINDINGS = Object.freeze(Object.fromEntries(
  Object.entries(SCENE_BACKDROP_BY_BEAT_ID).map(([beatId, backdropId]) => {
    const canonicalLevelId = SCENE_BACKDROP_CANONICAL_LEVEL_BY_BEAT_ID[beatId];
    return [beatId, Object.freeze({
      beatId,
      backdropId,
      canonicalLevelId,
      compatibleLevelIds: Object.freeze([canonicalLevelId]),
    })];
  }),
));

const FRAMES = Object.freeze(Object.fromEntries(SCENE_BACKDROP_IDS.map((id, index) => [id, Object.freeze({
  id,
  index,
  column: index % SCENE_BACKDROP_ATLAS.columns,
  row: Math.floor(index / SCENE_BACKDROP_ATLAS.columns),
  x: (index % SCENE_BACKDROP_ATLAS.columns) * SCENE_BACKDROP_ATLAS.frameWidth,
  y: Math.floor(index / SCENE_BACKDROP_ATLAS.columns) * SCENE_BACKDROP_ATLAS.frameHeight,
  width: SCENE_BACKDROP_ATLAS.frameWidth,
  height: SCENE_BACKDROP_ATLAS.frameHeight,
})])));

export function getSceneBackdropIdForBeat(beatId) {
  return SCENE_BACKDROP_BY_BEAT_ID[beatId] ?? null;
}

export function getSceneBackdropBindingForBeat(beatId) {
  return SCENE_BACKDROP_BINDINGS[beatId] ?? null;
}

export function isSceneBackdropCompatibleWithLevel(beatId, activeLevelId) {
  const binding = getSceneBackdropBindingForBeat(beatId);
  return Boolean(binding && binding.compatibleLevelIds.includes(activeLevelId));
}

export function getSceneBackdropFrame(backdropId) {
  return FRAMES[backdropId] ?? null;
}

export function getSceneBackdropFrameForBeat(beatId, activeLevelId) {
  const binding = getSceneBackdropBindingForBeat(beatId);
  return binding && binding.compatibleLevelIds.includes(activeLevelId)
    ? getSceneBackdropFrame(binding.backdropId)
    : null;
}

export function sceneBackdropImageHasExpectedSize(image) {
  return Boolean(image
    && Number(image.naturalWidth) === SCENE_BACKDROP_ATLAS.width
    && Number(image.naturalHeight) === SCENE_BACKDROP_ATLAS.height);
}
