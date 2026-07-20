import { AUDIO_LOOP_DEFINITIONS } from './audio-runtime.mjs';
import { SCENE_DIRECTIONS } from './content/scene-direction.mjs';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

/**
 * Reusable procedural score families. These route the authored direction prose
 * into synthesized presentation; they are not recorded or bespoke soundtrack
 * assets. Each score currently owns one matching ambience texture.
 */
export const CAMPAIGN_SCORE_FAMILIES = deepFreeze({
  evidence: {
    id: 'evidence',
    label: 'Evidence motif',
    loop: 'rain-evidence',
    ambienceFamily: 'rain',
  },
  care: {
    id: 'care',
    label: 'Care motif',
    loop: 'care-lantern',
    ambienceFamily: 'hearth',
  },
  road: {
    id: 'road',
    label: 'Road motif',
    loop: 'road-water',
    ambienceFamily: 'water',
  },
  cipher: {
    id: 'cipher',
    label: 'Cipher motif',
    loop: 'court-cipher',
    ambienceFamily: 'interior',
  },
  tide: {
    id: 'tide',
    label: 'Tide motif',
    loop: 'fog-tide',
    ambienceFamily: 'coast',
  },
  forge: {
    id: 'forge',
    label: 'Forge motif',
    loop: 'forge-ash',
    ambienceFamily: 'forge',
  },
  network: {
    id: 'network',
    label: 'Lantern-network motif',
    loop: 'lantern-network',
    ambienceFamily: 'night-road',
  },
  'black-court': {
    id: 'black-court',
    label: 'Black Court motif',
    loop: 'black-court',
    ambienceFamily: 'bell-hall',
  },
  repair: {
    id: 'repair',
    label: 'Repair motif',
    loop: 'repair-dawn',
    ambienceFamily: 'dawn',
  },
});

export const CAMPAIGN_AMBIENCE_FAMILIES = deepFreeze({
  rain: { id: 'rain', label: 'roof rain' },
  hearth: { id: 'hearth', label: 'sheltered lantern' },
  water: { id: 'water', label: 'road and water' },
  interior: { id: 'interior', label: 'court interior' },
  coast: { id: 'coast', label: 'fog coast' },
  forge: { id: 'forge', label: 'forge and ash' },
  'night-road': { id: 'night-road', label: 'lantern road' },
  'bell-hall': { id: 'bell-hall', label: 'bell hall' },
  dawn: { id: 'dawn', label: 'repair at dawn' },
});

/** One intentional family decision per canonical scene, keyed for reorder safety. */
export const SCENE_SCORE_FAMILY_BY_BEAT = deepFreeze({
  'p00-delivery-in-rain': 'evidence',
  'p01-altered-order': 'evidence',
  'p02-medicine-across-lane': 'care',
  'p03-bailiff-returns': 'cipher',
  'p04-river-escape': 'road',
  'p05-archive-promise': 'evidence',
  'c1-01-registers-omissions': 'evidence',
  'c1-02-kikus-threshold': 'care',
  'c1-03-ferry-gossip': 'road',
  'c1-04-flooded-cedars': 'evidence',
  'c1-05-storehouse-clerk': 'evidence',
  'c1-06-copy-before-fire': 'forge',
  'c2-01-rain-gate': 'evidence',
  'c2-02-chapel-service-route': 'road',
  'c2-03-lises-interruption': 'cipher',
  'c2-04-bell-stair': 'road',
  'c2-05-undercrypt-truth': 'cipher',
  'c2-06-name-from-europe': 'cipher',
  'c3-01-separate-arrivals': 'network',
  'c3-02-the-checkpoint': 'cipher',
  'c3-03-ledger-customs-house': 'cipher',
  'c3-04-lantern-boat-escort': 'road',
  'c3-05-gentas-order': 'cipher',
  'c3-06-first-key': 'cipher',
  'c4-01-nets-in-fog': 'tide',
  'c4-02-tide-caves': 'tide',
  'c4-03-varga-journal': 'tide',
  'c4-04-survivors-hold': 'care',
  'c4-05-names-returned': 'tide',
  'c4-06-kikus-terms': 'care',
  'c5-01-requisition-town': 'forge',
  'c5-02-ash-fields': 'forge',
  'c5-03-cipher-room': 'cipher',
  'c5-04-prison-locks': 'cipher',
  'c5-05-sigil-burned': 'forge',
  'c5-06-midpoint-evidence': 'black-court',
  'c6-01-city-competing-needs': 'network',
  'c6-02-three-copies': 'network',
  'c6-03-tribunal': 'cipher',
  'c6-04-printmaker-flight': 'network',
  'c6-05-all-copies-leave': 'network',
  'c7-01-decision-map-table': 'network',
  'c7-02-former-retainer': 'cipher',
  'c7-03-aqueduct-names': 'road',
  'c7-04-lises-revised-oath': 'cipher',
  'c7-05-rescue-before-ring': 'network',
  'c8-01-three-homecomings': 'network',
  'c8-02-consent-not-conscription': 'network',
  'c8-03-black-gate-bargain': 'black-court',
  'c8-04-lantern-breach': 'network',
  'c8-05-gate-opened': 'care',
  'c9-01-archive-breathes': 'black-court',
  'c9-02-ujiros-last-ledger': 'black-court',
  'c9-03-conservatory-offers': 'black-court',
  'c9-04-yearless-bell': 'black-court',
  'c9-05-dawn-at-observatory': 'repair',
  'c9-06-leave-evidence-alive': 'repair',
  'e00-open-archive': 'repair',
  'e01-repair-work': 'repair',
  'e02-repaired-tower': 'repair',
});

function compilePresentation(direction, assignments = SCENE_SCORE_FAMILY_BY_BEAT) {
  const scoreFamily = assignments?.[direction.beatId] ?? null;
  const score = CAMPAIGN_SCORE_FAMILIES[scoreFamily] ?? null;
  const ambience = score ? CAMPAIGN_AMBIENCE_FAMILIES[score.ambienceFamily] : null;
  return deepFreeze({
    chapterId: direction.chapterId,
    beatId: direction.beatId,
    sourceMusicCue: direction.musicCue,
    scoreFamily,
    scoreLabel: score?.label ?? null,
    ambienceFamily: ambience?.id ?? null,
    ambienceLabel: ambience?.label ?? null,
    loop: score?.loop ?? null,
  });
}

export function compileSceneAudioPresentations({
  directions = SCENE_DIRECTIONS,
  assignments = SCENE_SCORE_FAMILY_BY_BEAT,
} = {}) {
  if (!Array.isArray(directions)) return Object.freeze([]);
  return deepFreeze(directions.map((direction) => compilePresentation(direction, assignments)));
}

export const SCENE_AUDIO_PRESENTATIONS = compileSceneAudioPresentations();

/** Validate exact direction coverage and every loop/family seam in canonical order. */
export function validateSceneAudioPresentations({
  presentations = SCENE_AUDIO_PRESENTATIONS,
  directions = SCENE_DIRECTIONS,
  assignments = SCENE_SCORE_FAMILY_BY_BEAT,
} = {}) {
  const errors = [];
  const records = Array.isArray(presentations) ? presentations : [];
  const expectedDirections = Array.isArray(directions) ? directions : [];
  const assignmentKeys = assignments && typeof assignments === 'object' ? Object.keys(assignments) : [];
  const expectedIds = new Set(expectedDirections.map((direction) => direction.beatId));

  if (!Array.isArray(presentations)) errors.push('Presentations must be an array.');
  if (records.length !== expectedDirections.length) {
    errors.push(`Expected ${expectedDirections.length} presentations, received ${records.length}.`);
  }
  const extras = assignmentKeys.filter((beatId) => !expectedIds.has(beatId));
  if (assignmentKeys.length !== expectedDirections.length || extras.length) {
    errors.push(`Assignments must cover exactly ${expectedDirections.length} canonical beats.`);
  }

  const seen = new Set();
  records.forEach((presentation, index) => {
    const direction = expectedDirections[index];
    if (!presentation || typeof presentation !== 'object') {
      errors.push(`Presentation ${index} is invalid.`);
      return;
    }
    if (seen.has(presentation.beatId)) errors.push(`${presentation.beatId} is duplicated.`);
    seen.add(presentation.beatId);
    if (!direction || presentation.beatId !== direction.beatId || presentation.chapterId !== direction.chapterId) {
      errors.push(`Presentation ${index} is out of canonical order.`);
    }
    if (direction && presentation.sourceMusicCue !== direction.musicCue) {
      errors.push(`${presentation.beatId} is detached from its authored music cue.`);
    }
    const score = CAMPAIGN_SCORE_FAMILIES[presentation.scoreFamily];
    if (!score) errors.push(`${presentation.beatId} has unknown score family ${String(presentation.scoreFamily)}.`);
    const ambience = CAMPAIGN_AMBIENCE_FAMILIES[presentation.ambienceFamily];
    if (!ambience) errors.push(`${presentation.beatId} has unknown ambience family ${String(presentation.ambienceFamily)}.`);
    if (!presentation.loop || !AUDIO_LOOP_DEFINITIONS[presentation.loop]) {
      errors.push(`${presentation.beatId} has unknown loop ${String(presentation.loop)}.`);
    }
    if (score && (score.loop !== presentation.loop || score.ambienceFamily !== presentation.ambienceFamily)) {
      errors.push(`${presentation.beatId} score and ambience families do not meet at one loop seam.`);
    }
  });

  for (const direction of expectedDirections) {
    if (!seen.has(direction.beatId)) errors.push(`${direction.beatId} has no audio presentation.`);
  }
  for (const score of Object.values(CAMPAIGN_SCORE_FAMILIES)) {
    if (!records.some((presentation) => presentation.scoreFamily === score.id)) {
      errors.push(`${score.id} score family is unused.`);
    }
  }
  for (const ambience of Object.values(CAMPAIGN_AMBIENCE_FAMILIES)) {
    if (!records.some((presentation) => presentation.ambienceFamily === ambience.id)) {
      errors.push(`${ambience.id} ambience family is unused.`);
    }
  }

  return deepFreeze({
    valid: errors.length === 0,
    presentationCount: records.length,
    scoreFamilyCount: new Set(records.map((presentation) => presentation?.scoreFamily)).size,
    ambienceFamilyCount: new Set(records.map((presentation) => presentation?.ambienceFamily)).size,
    errors,
  });
}

const PRESENTATION_BY_BEAT = new Map(SCENE_AUDIO_PRESENTATIONS.map((presentation) => [
  presentation.beatId,
  presentation,
]));

export function getSceneAudioPresentation(beatId) {
  return PRESENTATION_BY_BEAT.get(beatId) ?? null;
}
