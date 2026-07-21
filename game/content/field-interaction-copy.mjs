/**
 * Exact English presentation copy for every authored field interactable.
 *
 * Runtime identifiers remain authoritative for saves and simulation. This
 * catalogue is presentation-only: lookup requires an exact level ID and exact
 * interactable ID, and no visible string is inferred from an ID, action,
 * result, requirement, reward, or prose fragment.
 */

import { LEVELS } from './levels.mjs';

export const FIELD_INTERACTION_COPY_SCHEMA_VERSION = 1;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const DEFAULT_REPEAT = 'This interaction is already complete; its result remains in the field record.';
const DEFAULT_BLOCKED = 'This interaction is not available yet. Complete the current route requirement first.';

function copy(levelId, interactableId, label, completion, choices = []) {
  return {
    levelId,
    interactableId,
    copyKey: `field.${levelId}.${interactableId}`,
    label,
    completion,
    repeat: DEFAULT_REPEAT,
    blocked: DEFAULT_BLOCKED,
    choices,
  };
}

function choice(id, label, completion) {
  return { id, label, completion };
}

const entries = [
  copy('hsh-census-square', 'fractured-bell', 'Fractured census bell', 'The broken bell is recorded as evidence and left in place.'),
  copy('c1-tax-storehouse', 'copy-table', 'Copied-name table', 'Aya secures a witnessed copy of the names and annotations.'),
  copy('c1-tax-storehouse', 'ledger-brazier', 'Weaponized ledger brazier', 'The weaponized binding is destroyed after the evidence copy is secured.'),
  copy('tkm-rain-gate', 'locked-main-gate', 'Barred main gate', 'The gate is barred from within; the service path remains the safe route.'),
  copy('tkm-rain-gate', 'supply-cart', 'Registry supply cart', 'Blank forms and fresh ink confirm that this shipment carried no food.'),
  copy('tkm-cedar-service-path', 'temple-charm-chest', 'Tampered registry cache', 'A Defaced Registry Token is recovered from the court supply cache.'),
  copy('tkm-cedar-service-path', 'loading-alcove-sheet', 'Unsigned accusation sheet', 'The torn sheet is recorded without supplying the signature it was designed to coerce.'),
  copy('tkm-abandoned-chapel', 'prisoner-grate-west', 'West holding-room witness', 'The witness’s warning is entered in the casebook without delaying the promised release.'),
  copy('tkm-abandoned-chapel', 'prisoner-grate-east', 'East holding-room witnesses', 'The people behind the grate are counted and their chosen warning is recorded.'),
  copy('tkm-abandoned-chapel', 'hidden-key-screen', 'Disturbed paper screen', 'The shifted screen reveals the route Nikola used to reach the rear lock.'),
  copy('tkm-abandoned-chapel', 'rear-lock', 'Rear service lock', 'Nikola’s stolen key opens the rear service route.'),
  copy('tkm-bell-stair', 'checkpoint-lantern', 'Stair checkpoint lantern', 'The lantern marks the last safe landing without restoring the party.'),
  copy('tkm-bell-stair', 'varga-mark', 'Dražanić route mark', 'Nikola records the mark and confirms that his family’s trail reached Takamine.'),
  copy('tkm-flooded-undercroft', 'name-slip-shelf', 'Bell-feed name slips', 'Aya records how copied names were fed into the buried bell network.'),
  copy('tkm-flooded-undercroft', 'storm-brazier', 'Storm-water warning brazier', 'The warning confirms that charged water causes Chill and the dry lantern space remains safe.'),
  copy('tkm-flooded-undercroft', 'sealed-bell-door', 'Sealed bell-room door', 'The Bell-room key releases the undercroft lock.'),
  copy('tkm-bell-chamber', 'buried-black-bell', 'Buried black bell', 'The bell’s court markings are preserved as evidence of the registry mechanism.'),
  copy('tkm-bell-chamber', 'blood-ward-west', 'West Blood Ward', 'The west ward’s position is recorded for the nonlethal confrontation.'),
  copy('tkm-bell-chamber', 'blood-ward-east', 'East Blood Ward', 'The east ward’s position is recorded for the nonlethal confrontation.'),
  copy('tkm-cell-block', 'cell-lever', 'Cell-block release lever', 'The lever opens all six cells so the witnesses can leave by their own route.'),
  copy('tkm-cell-block', 'rain-exit-door', 'Rain-lit service exit', 'The released witnesses reach the service exit.'),
  copy('sdg-salt-warehouse', 'first-bell-key-crane', 'Seaward bell key', 'The first bell key is secured with its seaward mark documented.'),
  copy('ngi-storm-reef', 'second-bell-key', 'Storm-reef bell key', 'The second bell key is secured after the names are returned.'),
  copy('kgr-archive-furnace', 'forge-directives', 'Forge directive bundle', 'The party records the cipher links between requisitions, raids, and the furnace.'),
  copy('kgr-archive-furnace', 'court-sigil-lock', 'Court sigil lock', 'Mateus breaks his court sigil under witness; the act records accountability, not forgiveness.'),
  copy('kzu-public-tribunal', 'print-block-a', 'First testimony print block', 'The first print block remains protected for public copying.'),
  copy('kzu-public-tribunal', 'print-block-b', 'Second testimony print block', 'The second print block remains protected for public copying.'),
  copy('kzu-public-tribunal', 'print-block-c', 'Third testimony print block', 'The third print block remains protected for public copying.'),
  copy('hsh-bell-aqueduct', 'rescue-space-north', 'North prisoner rescue space', 'The northern prisoner reaches the marked extraction space.'),
  copy('hsh-bell-aqueduct', 'rescue-space-south', 'South prisoner rescue space', 'The southern prisoner reaches the marked extraction space.'),
  copy('hsh-bell-aqueduct', 'name-slip-water', 'Aqueduct release current', 'The recovered name slip returns to flowing water and breaks the court command.'),
  copy('c8-black-gate', 'lantern-relay-west', 'West lantern relay', 'The west relay carries the agreed evacuation signal through the gate.'),
  copy('c8-black-gate', 'lantern-relay-east', 'East lantern relay', 'The east relay carries the agreed evacuation signal through the gate.'),
  copy('krh-observatory', 'north-node', 'North bell node', 'The north node is severed while the archive evidence remains intact.'),
  copy('krh-observatory', 'east-node', 'East bell node', 'The east node is severed while the archive evidence remains intact.'),
  copy('krh-observatory', 'south-node', 'South bell node', 'The south node is severed while the archive evidence remains intact.'),
  copy('krh-observatory', 'west-node', 'West bell node', 'The west node is severed while the archive evidence remains intact.'),
  copy('epi-hoshigawa-archive', 'testimony-table', 'Public testimony table', 'The public table opens with correction and access routes visible.'),
  copy('epi-hoshigawa-archive', 'corrections-shelf', 'Corrections shelf', 'Corrections remain beside the testimony they amend, not hidden beneath it.'),
  copy('epi-hoshigawa-archive', 'unfiled-names', 'Acknowledged record gaps', 'The archive marks what it does not yet know and leaves room for later testimony.'),
  copy('c1-flooded-cedars', 'dry-ledge-chest', 'Dry-ledge supply cache', 'A River Salve is recovered from the dry supply cache.'),
  copy('sdg-rain-docks', 'lantern-boat-signal', 'Lantern boat signal', 'The chosen witness route is signaled to the waiting boat.'),
  copy('ngi-tide-caves', 'net-anchor-a', 'First fog-net anchor', 'The first fouled anchor is cleared from the village launch route.'),
  copy('ngi-tide-caves', 'net-anchor-b', 'Second fog-net anchor', 'The second fouled anchor is cleared from the village launch route.'),
  copy('ngi-tide-caves', 'net-anchor-c', 'Third fog-net anchor', 'The third fouled anchor is cleared from the village launch route.'),
  copy('kgr-ash-fields', 'name-slip', 'Bound person’s name slip', 'The name slip is carried toward the release channel without treating it as loot.'),
  copy('kgr-ash-fields', 'release-channel', 'Flowing-water release channel', 'The name slip returns to flowing water and releases the bound person from the court command.'),
  copy('kzu-archive-roof', 'courier', 'Civilian evidence courier', 'The courier’s chosen route remains open; the person’s safety outranks any single copy.'),
  copy('kzu-archive-roof', 'print-block-a', 'Roof-route print block one', 'The first roof-route print block remains protected.'),
  copy('kzu-archive-roof', 'print-block-b', 'Roof-route print block two', 'The second roof-route print block remains protected.'),
  copy('kzu-archive-roof', 'print-block-c', 'Roof-route print block three', 'The third roof-route print block remains protected.'),
  copy('hsh-prison-ferry', 'carried-name-slip', 'Patrol member’s name slip', 'The recovered name slip is carried toward the north current.'),
  copy('hsh-prison-ferry', 'north-current', 'North release current', 'The patrol member’s name returns to flowing water and breaks the court command.'),
  copy('krh-outer-archive', 'archive-node-a', 'First key-bound archive node', 'The first archive node is severed with the matching bell key.'),
  copy('krh-outer-archive', 'archive-node-b', 'Second key-bound archive node', 'The second archive node is severed with the matching bell key.'),
  copy('krh-outer-archive', 'archive-node-c', 'Third key-bound archive node', 'The third archive node is severed with the matching bell key.'),
  copy('hsh-river-lane', 'medicine-bottle', 'Kiku’s medicine bottle', 'Ren receives the closed bottle and repeats the Mori household as its destination.'),
  copy('hsh-river-lane', 'mori-house-door', 'Mori household door', 'Kiku’s medicine reaches the Mori household before the census bell.'),
  copy('hsh-river-lane', 'blocked-cart', 'Lane-blocking cart', 'The cart’s position confirms a clear side-lane detour.'),
  copy('hsh-riverbank', 'river-checkpoint', 'Household river checkpoint', 'The escaping households are counted at the river and immediate care is assigned.'),
  copy('hsh-riverbank', 'marked-doors-note', 'Marked-door field note', 'Ren records the marked doors as leads to missing households.'),
  copy('c1-shrine-archive', 'register-table', 'Three-record comparison table', 'The register, packet, and bell-fragment impression reveal the omitted household route.'),
  copy('c1-shrine-archive', 'casebook-shelf', 'Aya’s casebook shelf', 'The casebook keeps people and correction routes visible beside the evidence.'),
  copy('c1-ferry-landing', 'dock-worker', 'Dock worker', 'The dock worker identifies the uphill shipment as paper, oil, and rope rather than food.'),
  copy('c1-ferry-landing', 'ferry-captain', 'Ferry captain', 'The captain confirms the sealed crates traveled toward the old tax storehouse.'),
  copy('c1-ferry-landing', 'market-seller', 'Market seller', 'The seller identifies the clerk who was taken after copying the shipment list.'),
  copy('sdg-market-lane', 'trade-broker', 'Sodegaura trade broker', 'The broker explains the current port notices and a safe way to enter separately.'),
  copy('sdg-market-lane', 'printer-stall', 'Sayo’s Print Stall', 'Sayo’s local printing route is recorded without exposing the people who use it.'),
  copy('sdg-market-lane', 'checkpoint-sign', 'Prisoner-transport mark', 'The checkpoint sign confirms the transport mark Genta recognized.'),
  copy('sdg-customs-house', 'customs-ledger', 'Annotated customs ledger', 'Mateus’s cipher handwriting is recorded beside the copied port entry.'),
  copy('sdg-customs-house', 'clerk-desk', 'Customs clerk', 'The clerk provides a witnessed account of how the port annotation traveled.'),
  copy('ngi-fishing-village', 'net-pile', 'Bell-fogged net pile', 'The fouled nets identify the route that must be cleared before requesting passage.'),
  copy('ngi-fishing-village', 'kiku-remedy-basket', 'Kiku’s remedy basket', 'Kiku offers practical support while retaining her authority over where that care is used.'),
  copy('ngi-fishing-village', 'fisher-council', 'Fisher council', 'The council agrees to passage after the launch route is made usable.'),
  copy('ngi-wrecked-carrack', 'varga-journal', 'Dražanić voyage journal', 'The journal records the Dražanić route and its failures without turning inheritance into authority.'),
  copy(
    'ngi-wrecked-carrack',
    'survivor-hold',
    'Wreck survivors’ care plan',
    'Kiku’s initial care position is recorded with the survivors’ needs visible.',
    [
      choice('send-kiku', 'Ask Kiku to begin with the survivors', 'Kiku begins with the survivors while the party keeps a clear return route.'),
      choice('keep-kiku', 'Keep Kiku with the route party for now', 'Kiku remains with the route party while supplies and a return visit are arranged for the survivors.'),
    ],
  ),
  copy('ngi-wrecked-carrack', 'reliquary-lock', 'Dražanić Strongbox', 'The Dražanić Strongbox yields a documented lead toward the second bell key.'),
  copy('kgr-requisition-town', 'coal-ledger', 'Coal requisition ledger', 'The court’s fuel marks and household costs are entered in the public case record.'),
  copy('kgr-requisition-town', 'resident-kitchen', 'Residents’ shared kitchen', 'Residents describe the local cost of refusing the furnace requisition.'),
  copy('kgr-requisition-town', 'genta-supply-mark', 'Military supply mark', 'Genta identifies the supply-chain mark and records his former role in carrying it.'),
  copy('kgr-prison-locks', 'rescue-lock-panel', 'Prison rescue lock panel', 'The slower rescue route is selected with every occupied cell kept in the plan.'),
  copy('kgr-prison-locks', 'blast-charge', 'Furnace breach charge', 'The faster breach route is selected with its risks stated to the rescue team.'),
  copy('kzu-printmaker-lane', 'woodblock-bench', 'Woodblock copy bench', 'The woodblock copy is completed under the print workers’ custody terms.'),
  copy('kzu-printmaker-lane', 'testimony-table', 'Witness testimony table', 'The testimony copy is completed with speaker permissions attached.'),
  copy('kzu-printmaker-lane', 'boat-runner', 'Canal copy runner', 'The boat copy is prepared without exposing the runner’s active route.'),
  copy('kzu-canal-lock', 'north-boat', 'North evidence boat', 'The north evidence bundle departs under its keeper’s custody.'),
  copy('kzu-canal-lock', 'central-courier', 'Central evidence courier', 'The central evidence bundle departs by hand under its keeper’s custody.'),
  copy('kzu-canal-lock', 'south-boat', 'South evidence boat', 'The south evidence bundle departs under its keeper’s custody.'),
  copy('hsh-map-table', 'hushroad-map', 'Hushroad rescue map', 'The party commits to the prisoner rescue route before any early strike.'),
  copy('hsh-map-table', 'prisoner-list', 'Aqueduct prisoner list', 'The prisoner count is recorded so the route cannot close with anyone unaccounted for.'),
  copy('hsh-post-town', 'former-retainer', 'Former Kurohana retainer', 'Genta offers a concrete safe stand-down without demanding trust or service.'),
  copy('hsh-post-town', 'food-cache', 'Roadside food cache', 'Supplies are shared with the stand-down route without making aid conditional.'),
  copy('c8-hoshigawa-return', 'archive-runner-table', 'Hoshigawa archive-runner table', 'Hoshigawa confirms the archive runners it can safely contribute.'),
  copy('c8-hoshigawa-return', 'evacuation-map', 'Hoshigawa evacuation map', 'The community’s own risk and benefit limits remain attached to the route.'),
  copy('c8-sodegaura-return', 'boat-council', 'Sodegaura boat council', 'Sodegaura confirms evacuation boats for civilian movement, not conscription.'),
  copy('c8-sodegaura-return', 'dock-supplies', 'Evacuation dock supplies', 'The supplies are reserved for moving people before supporting the breach.'),
  copy('c8-takamine-return', 'medical-tent-list', 'Takamine medical-tent list', 'Takamine confirms the care tents it can staff and supply.'),
  copy('c8-takamine-return', 'lantern-route-map', 'Takamine lantern route', 'The local safe route is recorded under Takamine’s stated limits.'),
  copy('krh-audience-hall', 'ujiro-ledger', 'Ujiro’s final ledger', 'The copied evidence places Ujiro under public custody rather than private revenge.'),
  copy('krh-audience-hall', 'witness-circle', 'Public custody circle', 'People harmed by the system take part in the custody decision and may refuse to speak.'),
  copy('krh-audience-hall', 'living-martyr-west', 'Living prisoner on the west execution beam', 'The prisoner is cut down, stabilized, and passed to the castle evacuation route under their chosen name.'),
  copy('krh-audience-hall', 'living-martyr-east', 'Living prisoner on the east impalement stake', 'The prisoner is lifted free, stabilized, and passed to the castle evacuation route under their chosen name.'),
  copy('krh-blood-conservatory', 'ren-offer', 'Ren’s court offer', 'Ren refuses power purchased with other people’s routes.'),
  copy('krh-blood-conservatory', 'aya-offer', 'Aya’s court offer', 'Aya refuses an archive that makes correction answer to one keeper.'),
  copy('krh-blood-conservatory', 'lise-offer', 'Nikola’s court offer', 'Nikola refuses to turn his inherited oath into authority over local lives.'),
  copy('krh-blood-conservatory', 'mateus-offer', 'Mateus’s court offer', 'Mateus refuses restored court power and remains answerable for what he already enabled.'),
  copy('krh-blood-conservatory', 'genta-offer', 'Genta’s court offer', 'Genta refuses command without accountability to the people placed at risk.'),
  copy('krh-blood-conservatory', 'kiku-offer', 'Kiku’s court offer', 'Kiku refuses a victory that treats care as a resource owned by the court.'),
  copy('krh-bell-spine', 'spine-node-a', 'Lower bell-spine node', 'The lower node is severed without damaging the evidence route.'),
  copy('krh-bell-spine', 'spine-node-b', 'Upper bell-spine node', 'The upper node is severed and the observatory route opens.'),
  copy('epi-sodegaura-storehouse', 'medical-crate-a', 'First medical supply crate', 'The first medical crate is delivered to the storehouse care table.'),
  copy('epi-sodegaura-storehouse', 'medical-crate-b', 'Second medical supply crate', 'The second medical crate is delivered to the storehouse care table.'),
  copy('epi-sodegaura-storehouse', 'genta-testimony-note', 'Genta’s rebuilding testimony', 'Genta’s testimony remains public before he takes part in rebuilding the road.'),
  copy('epi-takamine-tower', 'final-packet', 'Ren’s final route packet', 'Ren delivers the final packet with corrections and people’s questions still attached.'),
  copy('epi-takamine-tower', 'tower-lantern', 'Repaired tower lantern', 'The repaired tower lantern is lit while the bell remains silent.'),
];

function exactKey(levelId, interactableId) {
  return `${levelId}\u0000${interactableId}`;
}

const expectedKeys = LEVELS.flatMap((level) => (
  (level.interactables ?? []).map((interactable) => exactKey(level.id, interactable.id))
));
const authoredKeys = entries.map((entry) => exactKey(entry.levelId, entry.interactableId));
if (authoredKeys.length !== expectedKeys.length
  || new Set(authoredKeys).size !== authoredKeys.length
  || authoredKeys.some((key, index) => key !== expectedKeys[index])) {
  throw new Error('Field interaction copy must exactly match authored level/interactable order.');
}

export const FIELD_INTERACTION_COPY = deepFreeze({
  schemaVersion: FIELD_INTERACTION_COPY_SCHEMA_VERSION,
  locale: 'en',
  entries,
});

export const NEUTRAL_FIELD_INTERACTION_COPY = deepFreeze({
  levelId: null,
  interactableId: null,
  copyKey: 'field.unknown.interaction',
  label: 'Interaction',
  completion: 'Interaction complete.',
  repeat: 'This interaction is already complete.',
  blocked: 'This interaction is not available yet.',
  choices: [],
});

const COPY_BY_KEY = new Map(FIELD_INTERACTION_COPY.entries.map((entry) => (
  [exactKey(entry.levelId, entry.interactableId), entry]
)));

/** Return exact authored copy, or neutral human copy for an unknown pair. */
export function getFieldInteractionCopy(levelId, interactableId) {
  if (typeof levelId !== 'string' || typeof interactableId !== 'string') return NEUTRAL_FIELD_INTERACTION_COPY;
  return COPY_BY_KEY.get(exactKey(levelId, interactableId)) ?? NEUTRAL_FIELD_INTERACTION_COPY;
}

/** Return an exact authored choice row, or null without guessing from its ID. */
export function getFieldInteractionChoiceCopy(presentation, choiceId) {
  if (!presentation || typeof choiceId !== 'string') return null;
  return presentation.choices.find((entry) => entry.id === choiceId) ?? null;
}
