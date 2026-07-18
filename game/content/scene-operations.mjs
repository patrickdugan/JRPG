/**
 * Finite on-map story operations for every canonical campaign beat.
 *
 * Coordinates are derived deterministically from the authored level topology.
 * A task is placed on a reachable open tile beside (never on) existing level
 * landmarks whenever the map provides enough unreserved space. Encounter tasks
 * bind the encounter already named by the beat; they never define another one.
 */

import { CAMPAIGN } from './campaign.mjs';
import {
  getLevel,
  isBlocked,
  isInBounds,
  parseTileKey,
  tileKey,
} from './levels.mjs';
import { ENCOUNTERS, getEncounter, getEncountersForLevel } from './encounters.mjs';

export const SCENE_OPERATION_SCHEMA_VERSION = 1;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export const SCENE_OPERATION_ACTIVITY_TYPES = deepFreeze({
  interview: 'Hear a person before acting on their information.',
  inspect: 'Read physical evidence or terrain without turning it into treasure.',
  'carry-deliver': 'Move a named practical item or record between people.',
  mechanism: 'Operate a declared physical device, signal, or route control.',
  'care-rescue': 'Protect, evacuate, treat, or account for people at risk.',
  council: 'Make a witnessed decision with affected people represented.',
  'combat-evidence': 'Resolve an already-authored encounter and preserve its humane or evidentiary result.',
});

export const SCENE_OPERATION_SCHEMA = deepFreeze({
  version: SCENE_OPERATION_SCHEMA_VERSION,
  minNodesPerBeat: 3,
  maxNodesPerBeat: 5,
  movement: 'eight-direction, no diagonal corner cutting',
  completion: 'once-per-save',
  encounterPolicy: 'bind-existing-only',
  activityTypes: Object.keys(SCENE_OPERATION_ACTIVITY_TYPES),
});

const task = (activityType, verb, instruction) => ({ activityType, verb, instruction });

/*
 * These instructions are deliberately authored per beat. Placement is derived;
 * narrative meaning is not. No operation adds a historical person, sacred
 * prize, movement gate, or borrowed franchise element.
 */
const TASKS_BY_BEAT = {
  'p00-delivery-in-rain': [
    task('inspect', 'Check', 'Check the dry state seal against the rain-soaked delivery packet.'),
    task('interview', 'Ask', 'Ask the headman why an ordinary packet arrived after the lane lamps were lit.'),
    task('carry-deliver', 'Present', 'Present the sealed packet without accepting any demand that is not written inside it.'),
  ],
  'p01-altered-order': [
    task('inspect', 'Compare', 'Compare the collector\'s added demand with the wording in Ren\'s original packet.'),
    task('interview', 'Confirm', 'Confirm with the headman which census duties the lane was told to expect.'),
    task('council', 'Read', 'Read the original order where the neighboring households can hear the alteration.'),
  ],
  'p02-medicine-across-lane': [
    task('care-rescue', 'Receive', 'Receive Kiku\'s medicine and repeat the Mori household as the intended recipient.'),
    task('carry-deliver', 'Carry', 'Carry the closed medicine bottle through the open side lane.'),
    task('care-rescue', 'Deliver', 'Deliver the bottle at the Mori door before the census bell rings.'),
  ],
  'p03-bailiff-returns': [
    task('interview', 'Identify', 'Let the neighbor identify Sato inside the Ashen Bailiff before anyone calls him a monster.'),
    task('council', 'Mark', 'Mark the river route with the civilians who must use it.'),
    task('combat-evidence', 'Protect', 'Resolve the registered Ashen Bailiff escape while preserving Sato as a person, not a trophy.'),
  ],
  'p04-river-escape': [
    task('care-rescue', 'Count', 'Count the households that reached the river and check who needs immediate care.'),
    task('inspect', 'Record', 'Record the marked doors Ren saw before the lane closed.'),
    task('council', 'Map', 'Set the next search from named doors and missing households rather than from grief alone.'),
  ],
  'p05-archive-promise': [
    task('carry-deliver', 'Bring', 'Bring the hot bell fragment to Aya instead of returning it to the office.'),
    task('inspect', 'Trace', 'Trace the Takamine seal impressed into the fragment.'),
    task('council', 'Promise', 'Agree to follow copied names toward people and keep them from becoming numbers.'),
  ],
  'c1-01-registers-omissions': [
    task('inspect', 'Compare', 'Compare the household register, Ren\'s packet, and the black-ink circles side by side.'),
    task('inspect', 'Trace', 'Trace the ferry mark attached to the omitted household.'),
    task('carry-deliver', 'Enter', 'Enter the missing household in Aya\'s casebook as a recoverable lead.'),
  ],
  'c1-02-kikus-threshold': [
    task('interview', 'Listen', 'Listen to Kiku\'s limit: a network sign opens a request, not an obligation.'),
    task('care-rescue', 'Prepare', 'Prepare the medicine needed at the ferry landing before asking for a rumor.'),
    task('council', 'Choose', 'Choose the direct or supply route while leaving the deferred route open.'),
  ],
  'c1-03-ferry-gossip': [
    task('interview', 'Ask', 'Ask the dock worker what the sealed uphill crates carried instead of food.'),
    task('interview', 'Cross-check', 'Cross-check the captain\'s route with the ferry and market accounts.'),
    task('inspect', 'Mark', 'Mark the old tax storehouse and the copied clerk in Aya\'s route notes.'),
  ],
  'c1-04-flooded-cedars': [
    task('inspect', 'Read', 'Read the flooded trail and the first resisted Cut as evidence, not bad luck.'),
    task('inspect', 'Analyze', 'Analyze the Cinder Hound before committing another delivery type.'),
    task('combat-evidence', 'Clear', 'Resolve both registered Cedar encounters and keep their Ledger findings in the route record.'),
  ],
  'c1-05-storehouse-clerk': [
    task('mechanism', 'Open', 'Open the clerk route without disturbing the copied-name room.'),
    task('interview', 'Document', 'Document the clerk\'s exact copying process and when he learned what the circles meant.'),
    task('care-rescue', 'Escort', 'Escort the clerk away from the ledger room before confronting what is inside.'),
  ],
  'c1-06-copy-before-fire': [
    task('inspect', 'Separate', 'Separate legible names and annotations from the weaponized ledger pages.'),
    task('carry-deliver', 'Copy', 'Copy the names into Aya\'s casebook before any page is destroyed.'),
    task('combat-evidence', 'Expose', 'Resolve the registered Tithe Hound fight and preserve the exposed-seal evidence.'),
  ],
  'c2-01-rain-gate': [
    task('inspect', 'Inspect', 'Inspect the supply cart for forms, ink, food, and signs of who passed the closed gate.'),
    task('inspect', 'Verify', 'Verify the supply permit remains readable and carries no added instruction.'),
    task('mechanism', 'Mark', 'Mark the service-path threshold as the lawful route around the locked main gate.'),
  ],
  'c2-02-chapel-service-route': [
    task('interview', 'Hear', 'Hear the west prisoner through the grate without stopping their warning.'),
    task('interview', 'Count', 'Count the east grate\'s witnesses and promise only that the door will be opened.'),
    task('combat-evidence', 'Secure', 'Bind the already-registered Cedar Service Path defense to this witness route; do not start a second fight.'),
  ],
  'c2-03-lises-interruption': [
    task('inspect', 'Compare', 'Compare Lise\'s stolen key with the party\'s supply permit before judging either introduction.'),
    task('interview', 'Ask', 'Ask what Lise knows about the black alloy and the bell below Takamine.'),
    task('carry-deliver', 'Show', 'Show Lise the black bell fragment while Aya keeps possession of the evidence.'),
  ],
  'c2-04-bell-stair': [
    task('inspect', 'Watch', 'Watch one full bell-beam cycle and confirm the creak precedes the swing.'),
    task('mechanism', 'Cross', 'Cross the declared safe landing without treating the stair as a jump route.'),
    task('mechanism', 'Light', 'Light the checkpoint lantern after the second landing.'),
  ],
  'c2-05-undercrypt-truth': [
    task('inspect', 'Read', 'Read the brazier warning before anyone enters the storm-charged water.'),
    task('inspect', 'Record', 'Record how the name slips feed the buried bell.'),
    task('combat-evidence', 'Recover', 'Resolve the registered Flooded Archive encounter and recover its bell-room key once.'),
  ],
  'c2-06-name-from-europe': [
    task('interview', 'Confront', 'Confront Mateus with the Varga mark and record his part in the denunciation cipher.'),
    task('mechanism', 'Release', 'Pull the cell-block lever so the witnesses leave by their own route.'),
    task('combat-evidence', 'Stay', 'Resolve the registered nonlethal Mateus encounter and preserve his testimony without granting forgiveness.'),
  ],
  'c3-01-separate-arrivals': [
    task('council', 'Assign', 'Assign the supply, broker, and market arrivals as separate visible errands.'),
    task('inspect', 'Check', 'Check the east-market cover against the current port notices.'),
    task('mechanism', 'Enter', 'Use the supply-cover entry without converting a conversation into a gate key.'),
  ],
  'c3-02-the-checkpoint': [
    task('inspect', 'Read', 'Read the prisoner-transport mark Genta found on the party\'s tag.'),
    task('interview', 'Question', 'Question Genta about the checkpoint hour and who authorized the mark.'),
    task('carry-deliver', 'Present', 'Present the copied Takamine evidence while Aya retains the original packet.'),
  ],
  'c3-03-ledger-customs-house': [
    task('inspect', 'Locate', 'Locate Mateus\'s annotation in the port ledger and isolate the relevant line.'),
    task('interview', 'Record', 'Record Mateus explaining how an accusation traveled without its witness.'),
    task('carry-deliver', 'Attach', 'Attach the admission beside the copied ledger entry for later testimony.'),
  ],
  'c3-04-lantern-boat-escort': [
    task('council', 'Compare', 'Compare the quiet, crowded, and warehouse routes with the witnesses who will travel them.'),
    task('care-rescue', 'Board', 'Board the witnesses only after they confirm the risk they accept.'),
    task('combat-evidence', 'Escort', 'Resolve the registered dock patrol while keeping the chosen witness route open.'),
  ],
  'c3-05-gentas-order': [
    task('interview', 'Hear', 'Hear Kaji\'s transport order in front of the dock workers who would carry it out.'),
    task('inspect', 'Verify', 'Verify the family has no charge or trial mark in the manifest.'),
    task('council', 'Refuse', 'Let Genta name and refuse the order before the workers.'),
  ],
  'c3-06-first-key': [
    task('interview', 'Witness', 'Let the dock worker repeat Kaji\'s treatment of people as cargo.'),
    task('care-rescue', 'Secure', 'Secure Kaji alive so his orders remain answerable in the record.'),
    task('combat-evidence', 'Claim', 'Resolve the registered Captain Kaji encounter and document the first bell key\'s seaward mark.'),
  ],
  'c4-01-nets-in-fog': [
    task('interview', 'Ask', 'Ask the fishers what the bell fog is doing to their nets and launch route.'),
    task('care-rescue', 'Clear', 'Clear the fouled water before requesting the use of a village boat.'),
    task('combat-evidence', 'Free', 'Resolve the registered fog-net encounter as service to the village, not payment for passage.'),
  ],
  'c4-02-tide-caves': [
    task('inspect', 'Sound', 'Sound the cold pool edge and mark where it will slow a crossing.'),
    task('mechanism', 'Kindle', 'Kindle the declared dry lantern spaces before the tide turns.'),
    task('care-rescue', 'Guide', 'Guide the party between safe markers without leaving an injured traveler in cold water.'),
  ],
  'c4-03-varga-journal': [
    task('inspect', 'Read', 'Read the port-list entry in the Varga journal without treating inheritance as a defense.'),
    task('interview', 'Record', 'Record Lise and Mateus naming their separate choices around the wreck.'),
    task('carry-deliver', 'File', 'File the journal with Aya\'s evidence and keep the ownership history attached.'),
  ],
  'c4-04-survivors-hold': [
    task('care-rescue', 'Assess', 'Assess which sailors can walk and which must be carried to the skiff.'),
    task('interview', 'Ask', 'Ask the survivors where the fog enters the wreck and what route remains breathable.'),
    task('council', 'Choose', 'Choose Kiku\'s rescue or reef role with the cost to the injured stated aloud.'),
  ],
  'c4-05-names-returned': [
    task('inspect', 'Gather', 'Gather the names the reef released and mark every gap that remains unknown.'),
    task('care-rescue', 'Breathe', 'Move the living sailors toward clear air before beginning the memorial record.'),
    task('combat-evidence', 'Release', 'Resolve the registered Widow-of-Fog encounter and preserve names instead of claiming a kill trophy.'),
  ],
  'c4-06-kikus-terms': [
    task('interview', 'Listen', 'Listen to Kiku state who every later plan must include.'),
    task('council', 'Amend', 'Amend the next plan for people who cannot or should not fight.'),
    task('care-rescue', 'Welcome', 'Welcome Kiku as a full partner with authority over the care route.'),
  ],
  'c5-01-requisition-town': [
    task('interview', 'Hear', 'Hear coal workers describe the quota threat and its effect on family rations.'),
    task('inspect', 'Copy', 'Copy the military route, quota, and threat marks before entering the ash fields.'),
    task('council', 'Name', 'Name each coercive choice where residents can decide what pressure is safe.'),
  ],
  'c5-02-ash-fields': [
    task('interview', 'Listen', 'Listen for the bound person answering to the recovered name.'),
    task('carry-deliver', 'Return', 'Return the matching name slip to the memorial basin.'),
    task('combat-evidence', 'Release', 'Resolve the registered Ashen release encounter without treating the bound people as road enemies.'),
  ],
  'c5-03-cipher-room': [
    task('inspect', 'Decode', 'Decode one court directive using the cipher Mateus admits he designed.'),
    task('interview', 'Record', 'Record the distinction between useful information and forgiveness.'),
    task('carry-deliver', 'Add', 'Add Mateus\'s admission to the evidence packet with responsibility left visible.'),
  ],
  'c5-04-prison-locks': [
    task('inspect', 'Survey', 'Survey the cell lock route and the blast route before choosing either.'),
    task('interview', 'Count', 'Count the occupied cells and ask who cannot move without help.'),
    task('council', 'Choose', 'Choose rescue or blast with the human cost and boss preparation cost both stated.'),
  ],
  'c5-05-sigil-burned': [
    task('mechanism', 'Open', 'Keep the chosen prison locks open while the furnace sigil changes phase.'),
    task('care-rescue', 'Move', 'Move prisoners through the safe lane during the Abbot\'s recovery.'),
    task('combat-evidence', 'Break', 'Resolve the registered Furnace Abbot encounter and preserve the opened rescue route.'),
  ],
  'c5-06-midpoint-evidence': [
    task('inspect', 'Assemble', 'Assemble the raid schedules, fear inventories, and Kurozane portrait as one evidence chain.'),
    task('interview', 'Name', 'Record Mateus naming the vampire who occupies the fictional shogunal court.'),
    task('carry-deliver', 'Dispatch', 'Dispatch a forge-proof copy toward Kozui by a route separate from the original.'),
  ],
  'c6-01-city-competing-needs': [
    task('interview', 'Ask', 'Ask the printmaker what speed and exposure a copy would cost.'),
    task('interview', 'Ask', 'Ask the canal keeper and neighborhood elder what support is possible.'),
    task('council', 'Order', 'Set a visit order without declaring one community\'s cost correct for the others.'),
  ],
  'c6-02-three-copies': [
    task('mechanism', 'Cut', 'Cut the fast woodblock copy with its uncertainties still legible.'),
    task('carry-deliver', 'Bundle', 'Bundle the witnessed testimony copy for a hand courier.'),
    task('carry-deliver', 'Seal', 'Seal the ledger copy for the boat route.'),
    task('council', 'Verify', 'Verify that all three copies can disagree, survive, and be corrected.'),
  ],
  'c6-03-tribunal': [
    task('interview', 'Admit', 'Let Mateus make his full admission without anyone speaking it into a defense.'),
    task('council', 'Witness', 'Let the tribunal hear that independent copies are already leaving Kozui.'),
    task('combat-evidence', 'Hold', 'Resolve the registered Ujiro tribunal encounter while the evidence routes remain active.'),
  ],
  'c6-04-printmaker-flight': [
    task('inspect', 'Scout', 'Scout the roof route for a path wide enough for the civilian courier.'),
    task('care-rescue', 'Shield', 'Shield the courier rather than the heavier print crate.'),
    task('combat-evidence', 'Escort', 'Resolve the registered masked-clerk encounter and escort the living copy carrier across.'),
  ],
  'c6-05-all-copies-leave': [
    task('carry-deliver', 'Send', 'Send the woodblock bundle by road.'),
    task('carry-deliver', 'Send', 'Send the testimony bundle by hand.'),
    task('carry-deliver', 'Send', 'Send the ledger copy by boat.'),
    task('council', 'Confirm', 'Confirm no single route or archive holds every surviving copy.'),
  ],
  'c7-01-decision-map-table': [
    task('inspect', 'Count', 'Count the prisoners moving along Hushroad before comparing strike routes.'),
    task('council', 'Reject', 'Reject the early assault calculation that writes those prisoners off.'),
    task('mechanism', 'Mark', 'Mark the rescue route on the map table and leave the gate route for later.'),
  ],
  'c7-02-former-retainer': [
    task('interview', 'Hear', 'Hear why Genta\'s former subordinates refuse his authority.'),
    task('care-rescue', 'Offer', 'Offer food and a safe place to stand down without requiring allegiance.'),
    task('council', 'Witness', 'Witness Genta name his old orders without asking the soldiers for forgiveness.'),
  ],
  'c7-03-aqueduct-names': [
    task('inspect', 'Match', 'Match the first recovered slip to the name spoken through the ash.'),
    task('carry-deliver', 'Return', 'Return that name slip to the aqueduct\'s flowing water.'),
    task('combat-evidence', 'Release', 'Resolve the registered name-slip encounter by release wherever its humane objective permits.'),
  ],
  'c7-04-lises-revised-oath': [
    task('interview', 'Hear', 'Hear Lise reject an inherited right to target a bloodline.'),
    task('council', 'Review', 'Review the revised promise with Mateus absent from any claim of mercy.'),
    task('carry-deliver', 'Write', 'Write the named-person protection oath into Aya\'s correctable casebook.'),
  ],
  'c7-05-rescue-before-ring': [
    task('care-rescue', 'Gather', 'Gather the survivors before the upper bell closes another route.'),
    task('carry-deliver', 'Give', 'Give the survivors the copied route map and warning.'),
    task('combat-evidence', 'Open', 'Resolve the registered Bell Warden encounter and keep the rescue road open behind the party.'),
  ],
  'c8-01-three-homecomings': [
    task('interview', 'Ask', 'Ask Hoshigawa what archive work it can safely contribute.'),
    task('council', 'List', 'List need, danger, benefit, rest, and shelter before accepting any contribution.'),
    task('care-rescue', 'Confirm', 'Confirm archive runners only after the community sets its own limits.'),
  ],
  'c8-02-consent-not-conscription': [
    task('interview', 'Hear', 'Hear the network elder offer records, boats, shelter, and a route instead of children with blades.'),
    task('council', 'Confirm', 'Confirm every contribution beside its risk and the people who consented to it.'),
    task('care-rescue', 'Reserve', 'Reserve the gate\'s medical and evacuation lanes before any breach begins.'),
  ],
  'c8-03-black-gate-bargain': [
    task('interview', 'Hear', 'Hear Lady Enma\'s demand without letting Mateus or Lise answer for villages.'),
    task('council', 'Reject', 'Reject the exchange with the network representatives present.'),
    task('mechanism', 'Hold', 'Hold the gate signal at closed until the agreed breach, not the bargain, opens it.'),
  ],
  'c8-04-lantern-breach': [
    task('mechanism', 'Light', 'Light blue for records moving, green for clear boats, and white for the medical lane.'),
    task('care-rescue', 'Hold', 'Hold the routes those lanterns describe rather than treating them as attack bonuses.'),
    task('combat-evidence', 'Breach', 'Resolve the registered Outer Court encounter while every agreed civilian route remains legible.'),
  ],
  'c8-05-gate-opened': [
    task('care-rescue', 'Receive', 'Receive released soldiers at the tents instead of marking them as a second enemy.'),
    task('council', 'Assign', 'Assign the six-person entry while the network keeps the road alive.'),
    task('combat-evidence', 'Open', 'Resolve the registered Lady Enma encounter and preserve the witnessed refusal that opened the gate.'),
  ],
  'c9-01-archive-breathes': [
    task('inspect', 'Trace', 'Trace the paper veins from the shelves to the first bell node.'),
    task('care-rescue', 'Secure', 'Secure loose name slips before the breathing archive draws them inward.'),
    task('combat-evidence', 'Break', 'Resolve the registered Archive Nodes encounter and release its names into safe hands.'),
  ],
  'c9-02-ujiros-last-ledger': [
    task('inspect', 'Compare', 'Compare Ujiro\'s last ledger with the copies already outside Kurohana.'),
    task('interview', 'Hear', 'Hear the harmed witness state where Ujiro must answer.'),
    task('council', 'Transfer', 'Transfer Ujiro to public custody without destroying the evidence in his room.'),
  ],
  'c9-03-conservatory-offers': [
    task('interview', 'Hear', 'Hear each tailored offer without allowing Kurozane to address the party as one will.'),
    task('council', 'Refuse', 'Let Ren, Aya, and Lise state their own refusals.'),
    task('council', 'Refuse', 'Let Mateus, Genta, and Kiku state their own refusals.'),
    task('inspect', 'Record', 'Record all six refusals as choices, never as proof that the offers were harmless.'),
  ],
  'c9-04-yearless-bell': [
    task('inspect', 'Read', 'Read the Yearless Bell\'s exposed node cycle before assigning the party.'),
    task('council', 'Assign', 'Assign protectors to the archive core before anyone attacks Kurozane.'),
    task('combat-evidence', 'Silence', 'Resolve the registered Yearless Bell encounter while keeping the archive core intact.'),
  ],
  'c9-05-dawn-at-observatory': [
    task('council', 'Consent', 'Confirm Mateus offers the protective blood rite as responsibility, not absolution.'),
    task('mechanism', 'Expose', 'Use the rite to expose the Umbral ward during its declared opening.'),
    task('combat-evidence', 'Endure', 'Resolve the registered Kurozane encounter and carry the living evidence into dawn.'),
  ],
  'c9-06-leave-evidence-alive': [
    task('care-rescue', 'Gather', 'Gather survivors from the unsafe archive halls before moving records.'),
    task('carry-deliver', 'Carry', 'Carry testimony, corrections, and acknowledged gaps out in separate bundles.'),
    task('council', 'Count', 'Count people and bundles at the safe threshold without inventing a clean ending.'),
  ],
  'e00-open-archive': [
    task('inspect', 'Arrange', 'Arrange testimony, corrections, and unknown names on separate public shelves.'),
    task('interview', 'Invite', 'Invite the first visitor to challenge an entry and state what they know.'),
    task('council', 'Open', 'Open the testimony table with corrections and acknowledged gaps allowed.'),
  ],
  'e01-repair-work': [
    task('care-rescue', 'Load', 'Load Kiku\'s first medical crates before preparing any memorial speech.'),
    task('carry-deliver', 'Deliver', 'Deliver both crates to the marked care route.'),
    task('interview', 'Record', 'Record Genta\'s testimony plan and Mateus\'s supervised cache work as unfinished obligations.'),
  ],
  'e02-repaired-tower': [
    task('carry-deliver', 'Deliver', 'Deliver Ren\'s final packet of people asking after one another.'),
    task('interview', 'Read', 'Read one request aloud and leave space for an answer.'),
    task('care-rescue', 'Light', 'Complete the registered noncombat memorial walk by lighting the repaired tower lantern once.'),
  ],
};

const DIRECTIONS = deepFreeze([
  { dx: 0, dy: -1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 0 }, { dx: 1, dy: 1 },
  { dx: 0, dy: 1 }, { dx: -1, dy: 1 }, { dx: -1, dy: 0 }, { dx: -1, dy: -1 },
]);

function canStep(level, from, to) {
  if (!isInBounds(level, to.x, to.y) || isBlocked(level, to.x, to.y)) return false;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx !== 0 && dy !== 0) {
    if (isBlocked(level, from.x + dx, from.y) || isBlocked(level, from.x, from.y + dy)) return false;
  }
  return true;
}

function shortestPathSteps(level, start, goal) {
  const startKey = tileKey(start.x, start.y);
  const goalKey = tileKey(goal.x, goal.y);
  if (startKey === goalKey) return 0;
  const queue = [{ x: start.x, y: start.y, steps: 0 }];
  const seen = new Set([startKey]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const direction of DIRECTIONS) {
      const next = { x: current.x + direction.dx, y: current.y + direction.dy };
      const key = tileKey(next.x, next.y);
      if (seen.has(key) || !canStep(level, current, next)) continue;
      if (key === goalKey) return current.steps + 1;
      seen.add(key);
      queue.push({ x: next.x, y: next.y, steps: current.steps + 1 });
    }
  }
  return null;
}

function reachableTiles(level) {
  const start = { x: level.spawn.x, y: level.spawn.y };
  const queue = [start];
  const seen = new Set([tileKey(start.x, start.y)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    for (const direction of DIRECTIONS) {
      const next = { x: current.x + direction.dx, y: current.y + direction.dy };
      const key = tileKey(next.x, next.y);
      if (seen.has(key) || !canStep(level, current, next)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return [...seen].map(parseTileKey);
}

function encounterDeploymentTiles(encounter) {
  return [
    ...(encounter?.party?.deployment ?? []).map((entry) => entry.at),
    ...(encounter?.party?.guestSupport ?? []).map((entry) => entry.at),
    ...(encounter?.enemies ?? []).flatMap((enemy) => enemy.positions ?? []),
  ].filter(Boolean);
}

function reservedTiles(level) {
  const keys = new Set([tileKey(level.spawn.x, level.spawn.y)]);
  for (const exit of level.exits ?? []) if (exit.at) keys.add(exit.at);
  for (const entry of level.interactables ?? []) if (entry.at) keys.add(entry.at);
  for (const hazard of level.hazards ?? []) for (const at of hazard.tiles ?? []) keys.add(at);
  for (const trigger of level.encounterTriggers ?? []) for (const at of trigger.tiles ?? []) keys.add(at);
  for (const encounter of getEncountersForLevel(level.id)) {
    for (const at of encounterDeploymentTiles(encounter)) keys.add(at);
  }
  return keys;
}

function stableHash(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pointDistance(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function levelLandmarks(level) {
  const keys = [
    ...(level.interactables ?? []).map((entry) => entry.at),
    ...(level.terrain ?? []).map((entry) => entry.at),
    ...(level.exits ?? []).map((entry) => entry.at),
  ].filter(Boolean);
  return (keys.length ? keys : [tileKey(Math.floor(level.width / 2), Math.floor(level.height / 2))]).map(parseTileKey);
}

function combatAnchor(beat, level) {
  const points = (beat.encounterIds ?? [])
    .map(getEncounter)
    .filter((encounter) => encounter?.levelId === level.id)
    .flatMap(encounterDeploymentTiles)
    .map(parseTileKey);
  if (!points.length) return null;
  return {
    x: Math.round(points.reduce((sum, point) => sum + point.x, 0) / points.length),
    y: Math.round(points.reduce((sum, point) => sum + point.y, 0) / points.length),
  };
}

function deriveRoute(beat, tasks) {
  const level = getLevel(beat.mapId);
  if (!level) throw new Error(`Scene operation references missing level ${beat.mapId}.`);
  const reserved = reservedTiles(level);
  const reachable = reachableTiles(level);
  let candidates = reachable.filter((point) => !reserved.has(tileKey(point.x, point.y)));
  let placement = 'reserved-free';
  if (candidates.length < tasks.length) {
    candidates = reachable.filter((point) => tileKey(point.x, point.y) !== tileKey(level.spawn.x, level.spawn.y));
    placement = 'reserved-fallback';
  }
  if (candidates.length < tasks.length) throw new Error(`Level ${level.id} lacks ${tasks.length} distinct reachable operation tiles.`);

  const landmarks = levelLandmarks(level);
  const battleAnchor = combatAnchor(beat, level);
  const used = new Set();
  const nodes = [];
  let previous = { x: level.spawn.x, y: level.spawn.y };

  tasks.forEach((definition, index) => {
    const isFinalEncounterNode = index === tasks.length - 1 && (beat.encounterIds?.length ?? 0) > 0;
    const anchor = isFinalEncounterNode && battleAnchor
      ? battleAnchor
      : landmarks[(stableHash(`${beat.id}:${index}`) + index) % landmarks.length];
    const targetStride = 3 + ((stableHash(`${beat.id}:stride:${index}`) >>> 2) % 4);
    const options = candidates
      .filter((point) => !used.has(tileKey(point.x, point.y)))
      .map((point) => {
        const steps = shortestPathSteps(level, previous, point);
        return {
          point,
          steps,
          score: pointDistance(point, anchor) * 100
            + Math.abs(steps - targetStride) * 7
            + (stableHash(`${beat.id}:${index}:${point.x},${point.y}`) % 7),
        };
      })
      .filter((option) => option.steps !== null)
      .sort((a, b) => a.score - b.score || a.steps - b.steps || a.point.y - b.point.y || a.point.x - b.point.x);
    if (!options.length) throw new Error(`No route tile available for ${beat.id} node ${index + 1}.`);
    const selected = options[0];
    const encounterIds = isFinalEncounterNode ? [...beat.encounterIds] : [];
    nodes.push({
      id: `${beat.id}-operation-${String(index + 1).padStart(2, '0')}`,
      order: index + 1,
      activityType: definition.activityType,
      verb: definition.verb,
      instruction: definition.instruction,
      at: tileKey(selected.point.x, selected.point.y),
      pathFromPreviousSteps: selected.steps,
      once: true,
      encounterIds,
      encounterPolicy: encounterIds.length ? 'bind-existing-once' : null,
      noNewBattle: encounterIds.length ? true : null,
    });
    used.add(tileKey(selected.point.x, selected.point.y));
    previous = selected.point;
  });

  return {
    beatId: beat.id,
    chapterId: beat.chapterId,
    levelId: beat.mapId,
    repeatable: false,
    completionPolicy: 'once-per-save',
    placement,
    shortestPathSteps: nodes.reduce((sum, node) => sum + node.pathFromPreviousSteps, 0),
    nodes,
  };
}

const CANONICAL_BEATS = CAMPAIGN.chapters.flatMap((chapter) => chapter.beats.map((beat) => ({ ...beat, chapterId: chapter.id })));

const operations = CANONICAL_BEATS.map((beat) => {
  const tasks = TASKS_BY_BEAT[beat.id];
  if (!tasks) throw new Error(`Missing authored scene-operation tasks for ${beat.id}.`);
  return deriveRoute(beat, tasks);
});

const authoredTaskIds = Object.keys(TASKS_BY_BEAT);
const canonicalBeatIds = CANONICAL_BEATS.map((beat) => beat.id);
if (authoredTaskIds.length !== canonicalBeatIds.length || authoredTaskIds.some((id, index) => id !== canonicalBeatIds[index])) {
  throw new Error('Scene-operation task keys must exactly match canonical beat order.');
}

function buildMetrics(entries) {
  const byActivityType = Object.fromEntries(Object.keys(SCENE_OPERATION_ACTIVITY_TYPES).map((type) => [type, 0]));
  let nodeCount = 0;
  let shortestPathStepCount = 0;
  let encounterBindingCount = 0;
  let reservedFallbackCount = 0;
  const byChapter = {};
  for (const operation of entries) {
    nodeCount += operation.nodes.length;
    shortestPathStepCount += operation.shortestPathSteps;
    if (operation.placement !== 'reserved-free') reservedFallbackCount += 1;
    const chapter = byChapter[operation.chapterId] ?? { operationCount: 0, nodeCount: 0, shortestPathStepCount: 0 };
    chapter.operationCount += 1;
    chapter.nodeCount += operation.nodes.length;
    chapter.shortestPathStepCount += operation.shortestPathSteps;
    byChapter[operation.chapterId] = chapter;
    for (const node of operation.nodes) {
      byActivityType[node.activityType] += 1;
      if (node.encounterIds.length) encounterBindingCount += node.encounterIds.length;
    }
  }
  return {
    operationCount: entries.length,
    nodeCount,
    shortestPathStepCount,
    encounterBindingCount,
    reservedFallbackCount,
    byActivityType,
    byChapter,
  };
}

export const SCENE_OPERATION_METRICS = deepFreeze(buildMetrics(operations));

export const SCENE_OPERATIONS = deepFreeze({
  schemaVersion: SCENE_OPERATION_SCHEMA_VERSION,
  campaignId: CAMPAIGN.id,
  finite: true,
  repeatable: false,
  completionPolicy: 'once-per-save',
  operations,
  metrics: SCENE_OPERATION_METRICS,
});

const operationByBeatId = new Map(SCENE_OPERATIONS.operations.map((operation) => [operation.beatId, operation]));

/** Return the immutable on-map operation for one canonical beat, or null. */
export function getSceneOperation(beatId) {
  return operationByBeatId.get(beatId) ?? null;
}

/** Return exact finite node and shortest-path counts; no time estimate is declared. */
export function getSceneOperationMetrics() {
  return SCENE_OPERATION_METRICS;
}

function containsForbiddenReference(text) {
  return /adam driver|castlevania|symphony of the night|final fantasy|dracula|metroidvania|\bgame loot\b|sacred (?:loot|treasure|weapon)|holy relic|ability gate|double jump|grappling hook|dash gate/i.test(text);
}

/**
 * Validate coverage, topology, one-save semantics, and exact encounter binding.
 * Returns a frozen report so QA callers cannot mutate evidence after checking.
 */
export function validateSceneOperations(catalog = SCENE_OPERATIONS) {
  const errors = [];
  const entries = catalog?.operations ?? [];
  const seenOperations = new Set();
  const seenNodes = new Set();

  if (catalog?.schemaVersion !== SCENE_OPERATION_SCHEMA_VERSION) errors.push('schemaVersion does not match.');
  if (catalog?.campaignId !== CAMPAIGN.id) errors.push('campaignId does not match.');
  if (catalog?.finite !== true || catalog?.repeatable !== false || catalog?.completionPolicy !== 'once-per-save') {
    errors.push('catalog must be finite and once-per-save.');
  }
  if (entries.length !== CANONICAL_BEATS.length) errors.push(`expected ${CANONICAL_BEATS.length} operations; received ${entries.length}.`);

  CANONICAL_BEATS.forEach((beat, operationIndex) => {
    const operation = entries[operationIndex];
    if (!operation) return;
    const level = getLevel(beat.mapId);
    const expectedEncounterIds = beat.encounterIds ?? [];
    if (operation.beatId !== beat.id) errors.push(`operation ${operationIndex} must cover ${beat.id}.`);
    if (operation.chapterId !== beat.chapterId) errors.push(`${beat.id} chapterId does not match.`);
    if (operation.levelId !== beat.mapId || !level) errors.push(`${beat.id} levelId does not match its canonical map.`);
    if (operation.repeatable !== false || operation.completionPolicy !== 'once-per-save') errors.push(`${beat.id} is not once-per-save.`);
    if (seenOperations.has(operation.beatId)) errors.push(`duplicate operation ${operation.beatId}.`);
    seenOperations.add(operation.beatId);
    if (!Array.isArray(operation.nodes) || operation.nodes.length < 3 || operation.nodes.length > 5) {
      errors.push(`${beat.id} must have 3-5 nodes.`);
      return;
    }
    const usedTiles = new Set();
    const reserved = level ? reservedTiles(level) : new Set();
    const safeTileCount = level ? reachableTiles(level).filter((point) => !reserved.has(tileKey(point.x, point.y))).length : 0;
    let previous = level ? { x: level.spawn.x, y: level.spawn.y } : null;
    let computedSteps = 0;

    operation.nodes.forEach((node, nodeIndex) => {
      const label = `${beat.id} node ${nodeIndex + 1}`;
      if (node.order !== nodeIndex + 1) errors.push(`${label} order is not canonical.`);
      if (seenNodes.has(node.id)) errors.push(`duplicate node id ${node.id}.`);
      seenNodes.add(node.id);
      if (node.once !== true) errors.push(`${label} is not finite.`);
      if (!SCENE_OPERATION_ACTIVITY_TYPES[node.activityType]) errors.push(`${label} has unknown activity type ${node.activityType}.`);
      if (typeof node.verb !== 'string' || node.verb.length < 2 || typeof node.instruction !== 'string' || node.instruction.length < 20) {
        errors.push(`${label} lacks a bespoke verb or instruction.`);
      }
      if (containsForbiddenReference(`${node.verb} ${node.instruction}`)) errors.push(`${label} contains a forbidden borrowed or gated reference.`);
      const point = parseTileKey(node.at);
      if (!level || !isInBounds(level, point.x, point.y) || isBlocked(level, point.x, point.y)) errors.push(`${label} is not on an open canonical tile.`);
      if (usedTiles.has(node.at)) errors.push(`${beat.id} repeats operation tile ${node.at}.`);
      usedTiles.add(node.at);
      if (operation.placement === 'reserved-free' && reserved.has(node.at)) errors.push(`${label} occupies a reserved authored tile.`);
      if (operation.placement !== 'reserved-free' && safeTileCount >= operation.nodes.length) errors.push(`${beat.id} used a reserved fallback despite sufficient safe tiles.`);
      if (level && previous) {
        const exactSteps = shortestPathSteps(level, previous, point);
        if (exactSteps === null) errors.push(`${label} is unreachable from the previous route point.`);
        if (node.pathFromPreviousSteps !== exactSteps) errors.push(`${label} shortest-path count should be ${exactSteps}.`);
        if (exactSteps !== null) computedSteps += exactSteps;
      }
      previous = point;

      const isFinal = nodeIndex === operation.nodes.length - 1;
      const encounterIds = node.encounterIds ?? [];
      if (!isFinal && encounterIds.length) errors.push(`${label} binds an encounter before the final node.`);
      for (const encounterId of encounterIds) if (!getEncounter(encounterId)) errors.push(`${label} references missing encounter ${encounterId}.`);
      if (isFinal) {
        if (JSON.stringify(encounterIds) !== JSON.stringify(expectedEncounterIds)) errors.push(`${label} does not bind the beat's exact encounter list.`);
        if (expectedEncounterIds.length && (node.encounterPolicy !== 'bind-existing-once' || node.noNewBattle !== true)) {
          errors.push(`${label} may create a duplicate encounter.`);
        }
        const hostileEncounter = expectedEncounterIds.some((id) => getEncounter(id)?.format !== 'noncombat-resolution');
        if (hostileEncounter && node.activityType !== 'combat-evidence') errors.push(`${label} must distinguish combat evidence.`);
        if (!hostileEncounter && expectedEncounterIds.length && node.activityType === 'combat-evidence') errors.push(`${label} mislabels a noncombat resolution as combat.`);
      }
    });
    if (operation.shortestPathSteps !== computedSteps) errors.push(`${beat.id} route step total should be ${computedSteps}.`);
  });

  const actualMetrics = buildMetrics(entries);
  if (JSON.stringify(catalog?.metrics) !== JSON.stringify(actualMetrics)) errors.push('catalog metrics are not exact.');
  for (const type of Object.keys(SCENE_OPERATION_ACTIVITY_TYPES)) {
    if ((actualMetrics.byActivityType[type] ?? 0) < 1) errors.push(`activity type ${type} is not represented.`);
  }
  return deepFreeze({ ok: errors.length === 0, errors, metrics: actualMetrics });
}

// Fail fast during authoring; importing invalid route data is never a soft error.
const validation = validateSceneOperations(SCENE_OPERATIONS);
if (!validation.ok) throw new Error(`Invalid scene operations:\n${validation.errors.join('\n')}`);
