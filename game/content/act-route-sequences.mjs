/**
 * Macro-sequence contract for the nonlinear coalition war and palace approach.
 *
 * Canonical beats remain the authored production units. This layer groups
 * those beats, maps, encounters, and Storyworld decisions into the eight
 * major sequences a player sees in Acts III and IV.
 */

import { CAMPAIGN } from './campaign.mjs';
import { getEncounter } from './encounters.mjs';
import { getLevel } from './levels.mjs';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const ACT_ROUTE_THEATERS = deepFreeze({
  salt: {
    id: 'salt',
    label: 'Salt Road',
    doctrine: 'Evacuate households, preserve separate testimony routes, and approach Kurohana by water.',
    approachMapId: 'c8-sodegaura-return',
  },
  ash: {
    id: 'ash',
    label: 'Ash Road',
    doctrine: 'Break collar production, release bound Oni, and turn the court garrisons before the siege.',
    approachMapId: 'c8-takamine-return',
  },
  paper: {
    id: 'paper',
    label: 'Paper Road',
    doctrine: 'Distribute evidence and prepare offices capable of receiving surrendered seals.',
    approachMapId: 'c8-hoshigawa-return',
  },
});

export const ACT3_OPERATION_POOL = deepFreeze([
  {
    id: 'sodegaura-lanterns',
    theater: 'salt',
    title: 'Sodegaura: Lanterns Under Inspection',
    chapterId: 'chapter-3',
    beatIds: [
      'c3-02-the-checkpoint',
      'c3-03-ledger-customs-house',
      'c3-04-lantern-boat-escort',
      'c3-05-gentas-order',
      'c3-06-first-key',
    ],
    mapIds: ['sdg-market-lane', 'sdg-customs-house', 'sdg-rain-docks', 'sdg-salt-warehouse'],
    encounterIds: ['c3-dock-patrol', 'c3-captain-kaji'],
    storyworldClusterIds: [],
    finalConsequence: 'Evacuation boats and separated testimony custody become available at the Black Gate.',
  },
  {
    id: 'nagi-sea-ledger',
    theater: 'salt',
    title: 'Nagi: The Sea Ledger',
    chapterId: 'chapter-4',
    beatIds: [
      'c4-01-nets-in-fog',
      'c4-02-tide-caves',
      'c4-03-varga-journal',
      'c4-04-survivors-hold',
      'c4-05-names-returned',
      'c4-06-kikus-terms',
    ],
    mapIds: ['ngi-fishing-village', 'ngi-tide-caves', 'ngi-wrecked-carrack', 'ngi-storm-reef'],
    encounterIds: ['c4-fog-nets', 'c4-widow-of-fog'],
    storyworldClusterIds: ['sw4-margin-varga-journal'],
    finalConsequence: 'Bell routes and the Severed Dragon history reach the palace approach with independent custody.',
  },
  {
    id: 'kagura-furnace',
    theater: 'ash',
    title: 'Kagura: Break the Collar Furnace',
    chapterId: 'chapter-5',
    beatIds: [
      'c5-01-requisition-town',
      'c5-02-ash-fields',
      'c5-03-cipher-room',
      'c5-04-prison-locks',
      'c5-05-sigil-burned',
      'c5-06-midpoint-evidence',
    ],
    mapIds: ['kgr-requisition-town', 'kgr-ash-fields', 'kgr-archive-furnace', 'kgr-prison-locks'],
    encounterIds: ['c5-ashen-release', 'c5-furnace-abbot'],
    storyworldClusterIds: ['sw5-cipher-handoff'],
    finalConsequence: 'Fewer bound Oni reinforce Kurohana, and released patrols can refuse the final command.',
  },
  {
    id: 'kozui-print-war',
    theater: 'paper',
    title: 'Kozui: The War of Three Copies',
    chapterId: 'chapter-6',
    beatIds: [
      'c6-01-city-competing-needs',
      'c6-02-three-copies',
      'c6-03-tribunal',
      'c6-04-printmaker-flight',
      'c6-05-all-copies-leave',
    ],
    mapIds: ['kzu-printmaker-lane', 'kzu-public-tribunal', 'kzu-archive-roof', 'kzu-canal-lock'],
    encounterIds: ['c6-masked-clerks', 'c6-ujiro'],
    storyworldClusterIds: ['sw6-tribunal-afterword'],
    finalConsequence: 'Distributed printers and provisional offices can receive Kurozane’s seals without crowning his killer.',
  },
]);

const DEFAULT_OPERATION_ORDER = deepFreeze({
  salt: ['sodegaura-lanterns', 'nagi-sea-ledger', 'kagura-furnace'],
  ash: ['kagura-furnace', 'kozui-print-war', 'sodegaura-lanterns'],
  paper: ['kozui-print-war', 'nagi-sea-ledger', 'kagura-furnace'],
});

const operationById = new Map(ACT3_OPERATION_POOL.map((operation) => [operation.id, operation]));

function sequence(id, ordinal, title, kind, details = {}) {
  return deepFreeze({ id, ordinal, title, kind, ...details });
}

export function buildAct3SequencePlan({
  priorityTheater = 'salt',
  selectedOperationIds = DEFAULT_OPERATION_ORDER[priorityTheater],
} = {}) {
  if (!ACT_ROUTE_THEATERS[priorityTheater]) throw new Error(`Unknown Act III priority theater ${priorityTheater}.`);
  if (!Array.isArray(selectedOperationIds) || selectedOperationIds.length !== 3) {
    throw new Error('Act III requires exactly three regional operations.');
  }
  const selectedIds = [...selectedOperationIds];
  if (new Set(selectedIds).size !== selectedIds.length) throw new Error('Act III regional operation ids must be unique.');
  const operations = selectedIds.map((id) => {
    const operation = operationById.get(id);
    if (!operation) throw new Error(`Unknown Act III operation ${id}.`);
    return operation;
  });
  if (!operations.some(({ theater }) => theater === priorityTheater)) {
    throw new Error(`Act III selection must include its priority ${priorityTheater} theater.`);
  }

  const first = operations[0];
  return deepFreeze({
    actId: 'act-iii',
    title: 'Act III — The Three-Road War',
    priorityTheater,
    selectedOperationIds: selectedIds,
    omittedOperationId: ACT3_OPERATION_POOL.find(({ id }) => !selectedIds.includes(id))?.id ?? null,
    sequences: [
      sequence('act3-sequence-01', 1, 'The Bellless House War Table', 'route-decision', {
        anchorBeatIds: ['c3-01-separate-arrivals'],
        storyworldClusterIds: ['sw3-sayos-warehouse-conditions'],
        mapIds: ['hsh-map-table'],
      }),
      sequence('act3-sequence-02', 2, first.title, 'regional-operation', {
        operationId: first.id,
        routeTheater: first.theater,
        beatIds: first.beatIds,
        mapIds: first.mapIds,
        encounterIds: first.encounterIds,
        storyworldClusterIds: first.storyworldClusterIds,
      }),
      sequence('act3-sequence-03', 3, `Kurozane’s ${ACT_ROUTE_THEATERS[first.theater].label} Counterstroke`, 'counterstroke', {
        routeTheater: first.theater,
        mapIds: [first.mapIds.at(-1)],
        encounterIds: [first.encounterIds.at(-1)],
      }),
      sequence('act3-sequence-04', 4, operations[1].title, 'regional-operation', {
        operationId: operations[1].id,
        routeTheater: operations[1].theater,
        beatIds: operations[1].beatIds,
        mapIds: operations[1].mapIds,
        encounterIds: operations[1].encounterIds,
        storyworldClusterIds: operations[1].storyworldClusterIds,
      }),
      sequence('act3-sequence-05', 5, 'Live Families at the Bellless House', 'coalition-consequence', {
        mapIds: ['hsh-map-table'],
        result: 'The first two operations report who can still move, print, defect, and survive the final approach.',
      }),
      sequence('act3-sequence-06', 6, operations[2].title, 'regional-operation', {
        operationId: operations[2].id,
        routeTheater: operations[2].theater,
        beatIds: operations[2].beatIds,
        mapIds: operations[2].mapIds,
        encounterIds: operations[2].encounterIds,
        storyworldClusterIds: operations[2].storyworldClusterIds,
      }),
      sequence('act3-sequence-07', 7, 'The Hushroad Emergency', 'fixed-emergency', {
        routeTheater: 'ash',
        beatIds: ['c7-01-decision-map-table', 'c7-02-former-retainer', 'c7-03-aqueduct-names', 'c7-05-rescue-before-ring'],
        mapIds: ['hsh-map-table', 'hsh-post-town', 'hsh-prison-ferry', 'hsh-bell-aqueduct'],
        encounterIds: ['c7-name-slip-release', 'c7-bell-warden-chiyo'],
        storyworldClusterIds: ['sw7-soldier-will-not-follow'],
      }),
      sequence('act3-sequence-08', 8, 'The Coalition Commits', 'act-consequence', {
        beatIds: ['c7-04-lises-revised-oath'],
        mapIds: ['hsh-map-table'],
        result: 'Available palace approaches and Act V political parameters are frozen from completed operations.',
      }),
    ],
  });
}

export function resolveAct4ApproachMap(priorityTheater = 'salt') {
  const theater = ACT_ROUTE_THEATERS[priorityTheater];
  if (!theater) throw new Error(`Unknown Act IV approach theater ${priorityTheater}.`);
  return theater.approachMapId;
}

export function buildAct4SequencePlan({ priorityTheater = 'salt' } = {}) {
  const approachMapId = resolveAct4ApproachMap(priorityTheater);
  return deepFreeze({
    actId: 'act-iv',
    title: 'Act IV — The Black Gate',
    priorityTheater,
    approachMapId,
    sequences: [
      sequence('act4-sequence-01', 1, 'Three Homecomings', 'coalition-muster', {
        beatIds: ['c8-01-three-homecomings'],
        mapIds: ['c8-hoshigawa-return', 'c8-sodegaura-return', 'c8-takamine-return'],
      }),
      sequence('act4-sequence-02', 2, `${ACT_ROUTE_THEATERS[priorityTheater].label} Approach`, 'route-specific-approach', {
        routeTheater: priorityTheater,
        beatIds: ['c8-02-consent-not-conscription'],
        mapIds: [approachMapId],
      }),
      sequence('act4-sequence-03', 3, 'The Black Gate Bargain', 'palace-exterior-decision', {
        beatIds: ['c8-03-black-gate-bargain'],
        mapIds: ['c8-black-gate'],
      }),
      sequence('act4-sequence-04', 4, 'Boats With Conditions', 'storyworld-consequence', {
        anchorBeatIds: ['c8-04-lantern-breach'],
        storyworldClusterIds: ['sw8-boats-with-conditions'],
        mapIds: ['c8-black-gate'],
      }),
      sequence('act4-sequence-05', 5, 'The Lantern Breach', 'palace-exterior-battle', {
        beatIds: ['c8-04-lantern-breach'],
        mapIds: ['c8-black-gate'],
        encounterIds: ['c8-outer-court'],
      }),
      sequence('act4-sequence-06', 6, 'Lady Enma — The Last Mask', 'gate-boss', {
        beatIds: ['c8-05-gate-opened'],
        mapIds: ['c8-black-gate'],
        encounterIds: ['c8-lady-enma'],
      }),
      sequence('act4-sequence-07', 7, 'Three Terms for the Cinder Fan', 'storyworld-consequence', {
        anchorBeatIds: ['c8-05-gate-opened'],
        storyworldClusterIds: ['sw-enma-three-terms'],
        mapIds: ['c8-black-gate'],
      }),
      sequence('act4-sequence-08', 8, 'The Outer Archive Breathes', 'palace-threshold', {
        beatIds: ['c9-01-archive-breathes'],
        mapIds: ['krh-outer-archive'],
        encounterIds: ['c9-archive-nodes'],
      }),
    ],
  });
}

const STATIC_CONTEXT_BY_BEAT = new Map();
function registerBeatContext(beatIds, context) {
  for (const beatId of beatIds) STATIC_CONTEXT_BY_BEAT.set(beatId, deepFreeze({ beatId, ...context }));
}

registerBeatContext(['c3-01-separate-arrivals'], {
  actId: 'act-iii',
  actLabel: 'Act III — The Three-Road War',
  majorSequenceId: 'act3-sequence-01',
  majorSequenceLabel: 'The Bellless House War Table',
  routeTheater: null,
  operationId: null,
});
for (const operation of ACT3_OPERATION_POOL) {
  registerBeatContext(operation.beatIds, {
    actId: 'act-iii',
    actLabel: 'Act III — The Three-Road War',
    majorSequenceId: `act3-operation-${operation.id}`,
    majorSequenceLabel: operation.title,
    routeTheater: operation.theater,
    operationId: operation.id,
  });
}
registerBeatContext(['c7-01-decision-map-table', 'c7-02-former-retainer', 'c7-03-aqueduct-names', 'c7-05-rescue-before-ring'], {
  actId: 'act-iii',
  actLabel: 'Act III — The Three-Road War',
  majorSequenceId: 'act3-sequence-07',
  majorSequenceLabel: 'The Hushroad Emergency',
  routeTheater: 'ash',
  operationId: null,
});
registerBeatContext(['c7-04-lises-revised-oath'], {
  actId: 'act-iii',
  actLabel: 'Act III — The Three-Road War',
  majorSequenceId: 'act3-sequence-08',
  majorSequenceLabel: 'The Coalition Commits',
  routeTheater: null,
  operationId: null,
});

for (const entry of [
  ['c8-01-three-homecomings', 'act4-sequence-01', 'Three Homecomings'],
  ['c8-02-consent-not-conscription', 'act4-sequence-02', 'Route-Specific Approach'],
  ['c8-03-black-gate-bargain', 'act4-sequence-03', 'The Black Gate Bargain'],
  ['c8-04-lantern-breach', 'act4-sequence-05', 'The Lantern Breach'],
  ['c8-05-gate-opened', 'act4-sequence-06', 'Lady Enma — The Last Mask'],
  ['c9-01-archive-breathes', 'act4-sequence-08', 'The Outer Archive Breathes'],
]) {
  registerBeatContext([entry[0]], {
    actId: 'act-iv',
    actLabel: 'Act IV — The Black Gate',
    majorSequenceId: entry[1],
    majorSequenceLabel: entry[2],
    routeTheater: null,
    operationId: null,
  });
}

registerBeatContext([
  'c9-02-ujiros-last-ledger',
  'c9-03-conservatory-offers',
  'c9-04-yearless-bell',
  'c9-05-dawn-at-observatory',
  'c9-06-leave-evidence-alive',
], {
  actId: 'act-v',
  actLabel: 'Act V — The Living Castle',
  majorSequenceId: 'act5-inner-castle',
  majorSequenceLabel: 'The Living Castle and the Last Command',
  routeTheater: null,
  operationId: null,
});

export function getActSequenceContextForBeat(beatId) {
  return STATIC_CONTEXT_BY_BEAT.get(beatId) ?? null;
}

function validateCatalog() {
  const errors = [];
  const canonicalBeatIds = new Set(CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map(({ id }) => id)));
  for (const priorityTheater of Object.keys(ACT_ROUTE_THEATERS)) {
    const act3 = buildAct3SequencePlan({ priorityTheater });
    const act4 = buildAct4SequencePlan({ priorityTheater });
    if (act3.sequences.length !== 8) errors.push(`${priorityTheater} Act III must contain exactly eight sequences.`);
    if (act4.sequences.length !== 8) errors.push(`${priorityTheater} Act IV must contain exactly eight sequences.`);
    for (const entry of [...act3.sequences, ...act4.sequences]) {
      for (const beatId of [...(entry.beatIds ?? []), ...(entry.anchorBeatIds ?? [])]) {
        if (!canonicalBeatIds.has(beatId)) errors.push(`${entry.id} references missing beat ${beatId}.`);
      }
      for (const mapId of entry.mapIds ?? []) if (!getLevel(mapId)) errors.push(`${entry.id} references missing map ${mapId}.`);
      for (const encounterId of entry.encounterIds ?? []) {
        if (!getEncounter(encounterId)) errors.push(`${entry.id} references missing encounter ${encounterId}.`);
      }
    }
  }
  if (errors.length) throw new Error(`Invalid act route sequence catalog:\n${errors.join('\n')}`);
}

validateCatalog();
