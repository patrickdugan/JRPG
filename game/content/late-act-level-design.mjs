/**
 * Playable level-flow contract for Acts IV and V.
 *
 * The ordinary level records remain collision and rendering authority. This
 * layer states how those maps are visited, which authored interactions form
 * the critical path, where encounters and Storyworld decisions occur, and
 * which exits make the late-game topology real rather than a list of names.
 */

import { getEncounter } from './encounters.mjs';
import { getLevel } from './levels.mjs';
import { STORYWORLD_CLUSTERS } from './storyworld-encounters.generated.mjs';
import { getActionStage } from '../action-stages.mjs';

export const LATE_ACT_LEVEL_DESIGN_SCHEMA_VERSION = 1;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const step = (id, kind, refId = null, details = {}) => ({
  id,
  kind,
  ...(refId ? { refId } : {}),
  ...details,
});

export const ACT4_APPROACH_LEVEL_PLANS = deepFreeze({
  salt: {
    theater: 'salt',
    title: 'Salt Road — The Tidal Causeway',
    levelId: 'c8-sodegaura-return',
    spatialThesis: 'A broad lower dock lane carries households toward boats while the party uses the raised customs walk; neither route becomes military reinforcement.',
    pressure: 'The tide closes loading windows, but water is navigation information rather than damage.',
    criticalPath: [
      step('inspect-dock-supplies', 'interactable', 'dock-supplies'),
      step('receive-boat-terms', 'interactable', 'boat-council'),
      step('take-salt-road', 'exit', 'black-gate-route'),
    ],
    consequenceRead: 'Evacuation capacity and separate testimony custody remain visible behind the gate battle.',
  },
  ash: {
    theater: 'ash',
    title: 'Ash Road — The Bellless Stair',
    levelId: 'c8-takamine-return',
    spatialThesis: 'The party climbs beside medical tents and released patrols, using the old service stair that once carried prisoners into Takamine.',
    pressure: 'Narrow landings force clear marching order without adding a reflex hazard or stealth failure.',
    criticalPath: [
      step('confirm-medical-line', 'interactable', 'medical-tent-list'),
      step('read-bellless-route', 'interactable', 'lantern-route-map'),
      step('take-ash-road', 'exit', 'black-gate-route'),
    ],
    consequenceRead: 'Released soldiers can refuse the final command while treatment remains outside the assault lane.',
  },
  paper: {
    theater: 'paper',
    title: 'Paper Road — The Distributed Relay',
    levelId: 'c8-hoshigawa-return',
    spatialThesis: 'Two visible courier lanes pass records around the occupied center so no single runner or archive becomes the route’s point of failure.',
    pressure: 'The player must inspect the evacuation crossing before confirming the archive handoff.',
    criticalPath: [
      step('confirm-archive-runners', 'interactable', 'archive-runner-table'),
      step('read-evacuation-crossing', 'interactable', 'evacuation-map'),
      step('take-paper-road', 'exit', 'black-gate-route'),
    ],
    consequenceRead: 'Distributed office and registry copies can receive surrendered seals without enthroning Kurozane’s killer.',
  },
});

export const ACT4_BLACK_GATE_PLAN = deepFreeze({
  actId: 'act-iv',
  title: 'The Black Gate Causeway',
  levelId: 'c8-black-gate',
  spatialThesis: 'A blocked central gatehouse divides the board into Ember and Umbral flanks joined only by two lantern relay pockets.',
  zones: [
    { id: 'coalition-entry', role: 'safe deployment and role assignment', anchor: '2,3' },
    { id: 'west-ash-lane', role: 'first relay and alternating Umbral/Ember pressure', anchor: '4,3' },
    { id: 'gatehouse-mass', role: 'hard central blocker that prevents a straight damage rush', anchor: '5,3' },
    { id: 'east-ash-lane', role: 'second relay, released-garrison route, and Enma approach', anchor: '7,3' },
    { id: 'palace-threshold', role: 'Storyworld hearing and castle entry', anchor: '11,3' },
  ],
  criticalPath: [
    step('boats-with-conditions', 'storyworld', 'sw8-boats-with-conditions'),
    step('stabilize-west-relay', 'interactable', 'lantern-relay-west'),
    step('stabilize-east-relay', 'interactable', 'lantern-relay-east'),
    step('break-outer-court', 'encounter', 'c8-outer-court'),
    step('subdue-last-mask', 'encounter', 'c8-lady-enma'),
    step('three-terms', 'storyworld', 'sw-enma-three-terms'),
    step('enter-kurohana', 'exit', 'kurohana-gate'),
  ],
  resetRule: 'The Outer Court clear resets formation and recovery before Lady Enma; it does not silently heal route consequences or remove failed relay state.',
});

export const ACT5_LEVEL_VISITS = deepFreeze([
  {
    id: 'act5-visit-01-outer-archive',
    ordinal: 1,
    title: 'Outer Archive — Three Keys, Three Name Routes',
    levelId: 'krh-outer-archive',
    spatialThesis: 'The central archive mass splits the battle into upper and lower release lanes; each broken node opens a named route behind the party.',
    criticalPath: [
      step('break-key-node-a', 'interactable', 'archive-node-a'),
      step('break-key-node-b', 'interactable', 'archive-node-b'),
      step('break-key-node-c', 'interactable', 'archive-node-c'),
      step('release-outer-archive', 'encounter', 'c9-archive-nodes'),
      step('enter-audience-hall', 'exit', 'audience-hall-door'),
    ],
    antiBacktracking: 'The three nodes are a single clockwise combat read. Once released, their routes stay open and are reused only during the evacuation pass.',
  },
  {
    id: 'act5-visit-02-audience-hall',
    ordinal: 2,
    title: 'Living Audience Hall — Rescue Before Custody',
    levelId: 'krh-audience-hall',
    spatialThesis: 'The throne block occupies the center while the two living prisoners sit on the lower approach and witnesses hold the clear western edge.',
    criticalPath: [
      step('cut-down-west-prisoner', 'interactable', 'living-martyr-west'),
      step('cut-down-east-prisoner', 'interactable', 'living-martyr-east'),
      step('compare-ujiro-ledger', 'interactable', 'ujiro-ledger'),
      step('hear-witness-circle', 'interactable', 'witness-circle'),
      step('enter-conservatory', 'exit', 'conservatory'),
    ],
    antiBacktracking: 'The second rescue unlocks the ledger confrontation; custody opens the east door permanently.',
  },
  {
    id: 'act5-visit-03-conservatory',
    ordinal: 3,
    title: 'Blood Conservatory — Six Petals and a Seventh Refusal',
    levelId: 'krh-blood-conservatory',
    spatialThesis: 'Six offer reflections occupy one visible arc around the real eastbound route; the player never enters an isolated dream map.',
    criticalPath: [
      step('miyo-refuses-classification', 'dialogue', null, { beatId: 'c9-03-conservatory-offers' }),
      step('ren-refuses', 'interactable', 'ren-offer'),
      step('aya-refuses', 'interactable', 'aya-offer'),
      step('nikola-refuses', 'interactable', 'lise-offer'),
      step('mateus-refuses', 'interactable', 'mateus-offer'),
      step('genta-refuses', 'interactable', 'genta-offer'),
      step('kiku-refuses', 'interactable', 'kiku-offer'),
      step('enter-bell-spine', 'exit', 'bell-spine'),
    ],
    antiBacktracking: 'Each touched reflection darkens in place. The real route remains visible throughout and opens after the sixth authored refusal.',
  },
  {
    id: 'act5-visit-04-bell-spine',
    ordinal: 4,
    title: 'Bell Spine — Alternating Pulse Ascent',
    levelId: 'krh-bell-spine',
    combatStageLevelId: 'krh-observatory',
    spatialThesis: 'Two safe landings flank an eight-tile pulse band; the field ascent teaches the ring rhythm before the transformed observatory stage asks the player to protect the archive core.',
    criticalPath: [
      step('break-lower-spine-node', 'interactable', 'spine-node-a'),
      step('cross-declared-pulse', 'hazard', 'spine-pulse'),
      step('break-upper-spine-node', 'interactable', 'spine-node-b'),
      step('set-mateus-terms', 'storyworld', 'sw9-mateus-living-archive'),
      step('break-north-stage-node', 'interactable', 'north-node', { levelId: 'krh-observatory' }),
      step('break-east-stage-node', 'interactable', 'east-node', { levelId: 'krh-observatory' }),
      step('break-south-stage-node', 'interactable', 'south-node', { levelId: 'krh-observatory' }),
      step('break-west-stage-node', 'interactable', 'west-node', { levelId: 'krh-observatory' }),
      step('silence-yearless-bell', 'encounter', 'c9-yearless-bell'),
      step('reach-observatory', 'exit', 'observatory'),
    ],
    antiBacktracking: 'Pulse damage cannot kill and every broken node remains broken. The boss stage is a transformed continuation, not a trip back through prior rooms.',
  },
  {
    id: 'act5-visit-05-observatory',
    ordinal: 5,
    title: 'Throne Observatory — Dawn, Duel, Last Command',
    levelId: 'krh-observatory',
    spatialThesis: 'The broken Bell core remains central while dawn opens a west lane and Kurozane controls the eastern command circle.',
    criticalPath: [
      step('defeat-kurozane', 'encounter', 'c9-kurozane'),
      step('resolve-last-command', 'storyworld', 'sw10-corrections-desk'),
      step('begin-archive-evacuation', 'exit', 'archive-evacuation'),
    ],
    antiBacktracking: 'The boss fall and political decision happen in one room. The only return is the short evacuation pass through the now-safe archive edge.',
  },
  {
    id: 'act5-visit-06-evacuation',
    ordinal: 6,
    title: 'Outer Archive Return — People, Testimony, Unstable Evidence',
    levelId: 'krh-outer-archive',
    spatialThesis: 'The entry battle board is read in reverse as a three-column evacuation route; broken nodes are landmarks rather than respawned objectives.',
    criticalPath: [
      step('separate-evacuation-bundles', 'dialogue', null, { beatId: 'c9-06-leave-evidence-alive' }),
      step('leave-kurohana', 'exit', 'dawn-archive-exit'),
    ],
    antiBacktracking: 'No enemies or nodes respawn. The short return exists to show what the player preserved and how the chosen political ending changes the road outside.',
  },
]);

/**
 * Action-cutover arena variants. These do not replace top-down collision or
 * encounter authority; they state how a shared side-view stage is dressed and
 * paced for a specific encounter. Movement techniques create combat options,
 * never required progression gates.
 */
export const LATE_ACT_ACTION_ARENAS = deepFreeze([
  {
    id: 'act4-black-gate-outer-court',
    levelId: 'c8-black-gate',
    encounterId: 'c8-outer-court',
    title: 'Black Gate — Relay Breach',
    requiredAnchorIds: ['lantern-relay-west', 'lantern-relay-east', 'garrison-release'],
    opening: 'The duo enters on the lower west causeway while the garrison occupies the lower east and both relays remain visible above.',
    movementLanes: [
      { id: 'lower-causeway', surface: 'ground', purpose: 'continuous cooldown movement and broad enemy-line avoidance' },
      { id: 'west-relay-pocket', surface: 'gate-wall-west', purpose: 'first protected signal and tag reset' },
      { id: 'east-relay-pocket', surface: 'gate-wall-east', purpose: 'second signal and released-garrison route' },
    ],
    phaseFlow: [
      'Clear a route to either relay; route carry-in changes which background crew answers first.',
      'Activate the opposite relay while the court captain paints the vacated lane.',
      'Release the garrison at ground east, then end on a clean checkpoint before Enma.',
    ],
    cooldownRule: 'Normal attacks never root the player after their authored animation. The 880-pixel causeway exists so cooldown recovery is repositioning time.',
    tagRule: 'Either upper relay is a readable tag pocket; tagging there does not erase enemy telegraphs or reset a failed relay.',
  },
  {
    id: 'act4-black-gate-enma',
    levelId: 'c8-black-gate',
    encounterId: 'c8-lady-enma',
    title: 'Black Gate — Lady Enma, Last Mask',
    requiredAnchorIds: ['lantern-relay-west', 'lantern-relay-east', 'garrison-release'],
    opening: 'The checkpoint preserves relay state. Enma enters from the released eastern threshold and claims the center without occupying an objective.',
    movementLanes: [
      { id: 'ember-run', surface: 'ground-west', purpose: 'bait the orange fan away from the active relay' },
      { id: 'umbral-run', surface: 'ground-east', purpose: 'cross under the opposite upper wall during violet reflection' },
      { id: 'paired-relays', surface: 'gate-wall-west+gate-wall-east', purpose: 'telegraphed elevation changes, not safety forever' },
    ],
    phaseFlow: [
      'Rain-mask remnants teach a single fan and a full recovery punish.',
      'Archive-mask reflection makes the opposite relay the answer, forcing one deliberate cross-stage transfer.',
      'Last Mask paints orange and violet lanes, then Cinder Parasol Wing exposes Recovery 3.',
    ],
    cooldownRule: 'Enma cannot be stun-looped by ordinary attacks; the reliable damage turn is her declared Recovery 3 after the full parasol arc.',
    tagRule: 'A tag can preserve spacing after crossing a painted lane, but its own 240 ms recovery cannot cancel a committed attack.',
  },
  {
    id: 'act5-outer-archive-release',
    levelId: 'krh-outer-archive',
    encounterId: 'c9-archive-nodes',
    title: 'Outer Archive — Three Named Routes',
    requiredAnchorIds: ['archive-node-a', 'archive-node-b', 'archive-node-c', 'spirit-exit'],
    opening: 'Node A is visible on the west stack, Node B on the lower central line, and Node C on the east stack; the exit behind the party is a spirit route, not the next room.',
    movementLanes: [
      { id: 'west-stack', surface: 'archive-stack-west', purpose: 'first node and early ranged pressure break' },
      { id: 'catalogue-floor', surface: 'ground', purpose: 'binding-line chase and central node commitment' },
      { id: 'east-stack', surface: 'archive-stack-east', purpose: 'third node and audience-door approach' },
    ],
    phaseFlow: [
      'Break Node A and escort released names toward the west spirit exit.',
      'Drop to the central node while the Warden telegraphs a straight catalogue line.',
      'Cross to Node C, then defeat or release the Warden without closing any opened name route.',
    ],
    cooldownRule: 'Node strikes use the same post-animation cooldown as attacks; players remain free to escort a released name while the node art recovers.',
    tagRule: 'The inactive partner protects the nearest released route. Tagging changes the controlled fighter, never the custody state of a name.',
  },
  {
    id: 'act5-yearless-bell',
    levelId: 'krh-observatory',
    encounterId: 'c9-yearless-bell',
    title: 'Transformed Observatory — The Yearless Bell',
    requiredAnchorIds: ['north-node', 'east-node', 'south-node', 'west-node', 'archive-core'],
    opening: 'The Bell Spine opens directly into a darkened observatory. The core remains at ground center, two nodes sit on upper rings, one hangs above the core, and one is exposed below.',
    movementLanes: [
      { id: 'west-ring', surface: 'observatory-ring-west', purpose: 'west-node break and first ring safe read' },
      { id: 'core-floor', surface: 'ground-center', purpose: 'archive defense and south-node commitment' },
      { id: 'east-ring', surface: 'observatory-ring-east', purpose: 'east-node break and boss-facing reversal' },
    ],
    phaseFlow: [
      'Protect the archive core while the first ring declares itself; nodes are invulnerable between pulses.',
      'Break west/east nodes from the rings and south from ground during exposed recovery.',
      'The north node drops into reach only after three nodes break; destroying it silences the Bell and holds a hard checkpoint.',
    ],
    cooldownRule: 'The player can run through a safe ring while a node-breaking attack cools down; pulse warnings outlast any mandatory attack animation.',
    tagRule: 'A tagged partner inherits the live arena and protected-core state. Black Sun Concord is unavailable until the Bell encounter is complete.',
  },
  {
    id: 'act5-kurozane',
    levelId: 'krh-observatory',
    encounterId: 'c9-kurozane',
    title: 'Dawn Observatory — Kurozane',
    requiredAnchorIds: ['archive-core', 'evacuation-exit'],
    opening: 'The defeated Bell leaves the core as coverless evidence at center. Kurozane begins east; dawn first cuts through the west ring.',
    movementLanes: [
      { id: 'dawn-west', surface: 'ground-west+observatory-ring-west', purpose: 'Radiance vulnerability and recovery regroup' },
      { id: 'command-center', surface: 'ground-center', purpose: 'dangerous short route past the archive core' },
      { id: 'sovereign-east', surface: 'ground-east+observatory-ring-east', purpose: 'Kurozane command pressure and execution-threat tell' },
    ],
    phaseFlow: [
      'Human-form Kurozane tests spear lines and command clones while arguments stay inside movement beats.',
      'Escalation invokes Oni form; the duo survives the ring and earns the Black Sun Concord alignment window.',
      'Concord separates blood access and Severed Dragon Radiance hits, strips the sovereign ward, and opens Recovery 3.',
      'At defeat, weapons remain live while the Last Command Storyworld choice resolves transfer, execution, or failed transfer consequences.',
    ],
    cooldownRule: 'The final boss never requires standing still to wait out a timer. The west/east loops support movement during cooldown, with damage concentrated in declared ward-break windows.',
    tagRule: 'Black Sun Concord requires Nikola and Mateus within 180 pixels; both commit, neither cooldown is bypassed, and the player regains movement only after their authored animations.',
  },
]);

export const LATE_ACT_TOPOLOGY_EDGES = deepFreeze([
  { from: 'c8-sodegaura-return', exitId: 'black-gate-route', to: 'c8-black-gate', route: 'salt' },
  { from: 'c8-takamine-return', exitId: 'black-gate-route', to: 'c8-black-gate', route: 'ash' },
  { from: 'c8-hoshigawa-return', exitId: 'black-gate-route', to: 'c8-black-gate', route: 'paper' },
  { from: 'c8-black-gate', exitId: 'kurohana-gate', to: 'krh-outer-archive' },
  { from: 'krh-outer-archive', exitId: 'audience-hall-door', to: 'krh-audience-hall' },
  { from: 'krh-audience-hall', exitId: 'conservatory', to: 'krh-blood-conservatory' },
  { from: 'krh-blood-conservatory', exitId: 'bell-spine', to: 'krh-bell-spine' },
  { from: 'krh-bell-spine', exitId: 'observatory', to: 'krh-observatory' },
  { from: 'krh-observatory', exitId: 'archive-evacuation', to: 'krh-outer-archive' },
  { from: 'krh-outer-archive', exitId: 'dawn-archive-exit', to: 'epi-hoshigawa-archive' },
]);

const storyworldClusterIds = new Set(STORYWORLD_CLUSTERS.map(({ id }) => id));

export function validateLateActLevelDesign() {
  const errors = [];
  const plans = [
    ...Object.values(ACT4_APPROACH_LEVEL_PLANS),
    ACT4_BLACK_GATE_PLAN,
    ...ACT5_LEVEL_VISITS,
  ];

  for (const plan of plans) {
    const level = getLevel(plan.levelId);
    if (!level) {
      errors.push(`${plan.title} references missing level ${plan.levelId}.`);
      continue;
    }
    if (plan.combatStageLevelId && !getLevel(plan.combatStageLevelId)) {
      errors.push(`${plan.title} references missing combat stage ${plan.combatStageLevelId}.`);
    }
    const stepIds = new Set();
    for (const pathStep of plan.criticalPath) {
      if (stepIds.has(pathStep.id)) errors.push(`${plan.title} repeats critical step ${pathStep.id}.`);
      stepIds.add(pathStep.id);
      const stepLevel = getLevel(pathStep.levelId ?? plan.levelId);
      if (pathStep.kind === 'interactable' && !stepLevel?.interactables.some(({ id }) => id === pathStep.refId)) {
        errors.push(`${plan.title} cannot resolve interactable ${pathStep.refId}.`);
      }
      if (pathStep.kind === 'exit' && !stepLevel?.exits.some(({ id }) => id === pathStep.refId)) {
        errors.push(`${plan.title} cannot resolve exit ${pathStep.refId}.`);
      }
      if (pathStep.kind === 'hazard' && !stepLevel?.hazards.some(({ id }) => id === pathStep.refId)) {
        errors.push(`${plan.title} cannot resolve hazard ${pathStep.refId}.`);
      }
      if (pathStep.kind === 'encounter' && !getEncounter(pathStep.refId)) {
        errors.push(`${plan.title} cannot resolve encounter ${pathStep.refId}.`);
      }
      if (pathStep.kind === 'storyworld' && !storyworldClusterIds.has(pathStep.refId)) {
        errors.push(`${plan.title} cannot resolve Storyworld cluster ${pathStep.refId}.`);
      }
    }
  }

  for (const edge of LATE_ACT_TOPOLOGY_EDGES) {
    const level = getLevel(edge.from);
    const exit = level?.exits.find(({ id }) => id === edge.exitId);
    if (!exit) errors.push(`Topology edge ${edge.from}:${edge.exitId} cannot resolve.`);
    else if (exit.destinationLevelId !== edge.to) {
      errors.push(`Topology edge ${edge.from}:${edge.exitId} reaches ${exit.destinationLevelId}, not ${edge.to}.`);
    }
  }

  for (const arena of LATE_ACT_ACTION_ARENAS) {
    let actionStage;
    try {
      actionStage = getActionStage(arena.levelId);
    } catch {
      errors.push(`${arena.title} cannot resolve action stage ${arena.levelId}.`);
      continue;
    }
    if (!getEncounter(arena.encounterId)) {
      errors.push(`${arena.title} cannot resolve encounter ${arena.encounterId}.`);
    }
    const anchorIds = new Set(actionStage.objectiveAnchors.map(({ id }) => id));
    for (const anchorId of arena.requiredAnchorIds) {
      if (!anchorIds.has(anchorId)) errors.push(`${arena.title} cannot resolve action anchor ${anchorId}.`);
    }
    if (!Array.isArray(arena.movementLanes) || arena.movementLanes.length < 3) {
      errors.push(`${arena.title} needs at least three movement lanes.`);
    }
    if (!Array.isArray(arena.phaseFlow) || arena.phaseFlow.length < 3) {
      errors.push(`${arena.title} needs at least three authored phase beats.`);
    }
  }

  return deepFreeze(errors);
}

const designErrors = validateLateActLevelDesign();
if (designErrors.length) throw new Error(`Invalid late-act level design:\n${designErrors.join('\n')}`);

export function getAct5LevelVisit(id) {
  return ACT5_LEVEL_VISITS.find((visit) => visit.id === id) ?? null;
}

export function getLateActTopologyFrom(levelId) {
  return LATE_ACT_TOPOLOGY_EDGES.filter(({ from }) => from === levelId);
}

export function getLateActActionArena(id) {
  return LATE_ACT_ACTION_ARENAS.find((arena) => arena.id === id) ?? null;
}
