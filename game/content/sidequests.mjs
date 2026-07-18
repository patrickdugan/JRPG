/**
 * Optional-content contract for Bells of the Black Chrysanthemum.
 *
 * These quests reuse the campaign's existing maps and readable encounters.
 * Quest tokens are data-owned interactables for a field runtime to place; none
 * of them unlocks a traversal ability or requires metroidvania backtracking.
 * Reward bundles deliberately match advancement.mjs vocabulary.
 */

export const SIDE_QUEST_SCHEMA_VERSION = 1;

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const rewardBundle = (xpPerMember, currency, items = [], keyItems = []) => ({
  xpPerMember,
  currency,
  items: items.map(([name, quantity]) => ({ name, quantity })),
  keyItems,
});

const saveKeys = (id, repeatable = false) => ({
  acceptedFlag: `optional.${id}.accepted`,
  progressKey: `optional.${id}.objective-index`,
  completionFlag: `optional.${id}.first-clear`,
  failedFlag: null,
  repeatCountKey: repeatable ? `optional.${id}.completions` : null,
});

const navigation = Object.freeze({
  backtrackingRequired: false,
  abilityGate: null,
  accessRule: 'All objectives use routes already open in the listed chapter.',
});

const storyQuest = (quest) => ({
  kind: 'story',
  linkedEncounterIds: [],
  ...quest,
  rewards: {
    firstClear: quest.rewards.firstClear,
    repeat: null,
  },
  failure: quest.failure ?? {
    mode: 'none',
    rule: 'No hidden timer or dialogue choice can fail this quest after acceptance.',
  },
  save: saveKeys(quest.id),
  navigation,
});

const contract = (quest) => ({
  kind: 'contract',
  ...quest,
  failure: {
    mode: 'reset-run',
    rule: 'Defeat resets only the current contract run; first-clear and campaign state remain intact.',
  },
  save: saveKeys(quest.id, true),
  navigation,
});

export const OPTIONAL_CONTENT_GUARDRAILS = deepFreeze([
  'Every named quest character is fictional; no portrait or performance should reproduce a real person.',
  'Local people define their own needs. Faith, ancestry, and survival choices are never shorthand for moral worth.',
  'Ashen people are released, named, or mourned rather than counted as trophies.',
  'Optional combat reuses already-cleared encounters as patrol remnants or bell echoes and cannot change a humane campaign resolution.',
  'No quest is gated by a movement ability, destructible-wall skill, or mandatory late-game return trip.',
]);

export const SIDE_QUESTS = deepFreeze([
  storyQuest({
    id: 'sq-p-three-dry-bottles',
    title: 'Three Dry Bottles',
    arcId: 'care-in-the-margins',
    chapterId: 'prologue',
    mapIds: ['hsh-river-lane', 'hsh-riverbank'],
    estimatedMinutes: 8,
    questGiver: { id: 'kiku', name: 'Kiku Nawa', mapId: 'hsh-river-lane' },
    setup: 'Kiku has medicine for the river shelter but no dry wrapping. Ren can salvage three stoppered bottles and carry them without promising more than a courier can deliver.',
    prerequisites: {
      opensAfterBeatId: 'p02-medicine-across-lane',
      questIds: [],
      campaignFlags: [],
      encounterIds: [],
    },
    objectives: [
      { id: 'find-bottle-a', order: 1, type: 'collect', mapId: 'hsh-river-lane', targetId: 'dry-bottle-east-eave', instruction: 'Take the stoppered bottle beneath the east eave.' },
      { id: 'find-bottle-b', order: 2, type: 'collect', mapId: 'hsh-river-lane', targetId: 'dry-bottle-headman-porch', instruction: 'Recover the bottle beside the headman\'s porch.' },
      { id: 'find-bottle-c', order: 3, type: 'collect', mapId: 'hsh-riverbank', targetId: 'dry-bottle-reed-basket', instruction: 'Lift the last bottle from the reed basket above the waterline.' },
      { id: 'deliver-bottles', order: 4, type: 'deliver', mapId: 'hsh-riverbank', targetId: 'shelter-medicine-box', instruction: 'Pack the three bottles into the river shelter medicine box.' },
    ],
    rewards: { firstClear: rewardBundle(40, 18, [['River Salve', 1]]) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['find-bottle-a', 'find-bottle-b', 'find-bottle-c', 'deliver-bottles'],
      setsFlags: ['optional.care-network-started'],
      resolution: 'Kiku labels the bottles by dose and household; Ren learns that accuracy is a form of care.',
    },
  }),

  storyQuest({
    id: 'sq-c1-blank-lines',
    title: 'Blank Lines, Living Names',
    arcId: 'records-belong-to-people',
    chapterId: 'chapter-1',
    mapIds: ['c1-shrine-archive', 'c1-ferry-landing', 'c1-tax-storehouse'],
    estimatedMinutes: 16,
    questGiver: { id: 'sayo', name: 'Sayo, a fictional ferry clerk', mapId: 'c1-ferry-landing' },
    setup: 'Sayo keeps a private list of travelers omitted from the tax register. Aya proposes a corrected copy that records consent and destination without giving the court another route map.',
    prerequisites: {
      opensAfterBeatId: 'c1-01-registers-omissions',
      questIds: [],
      campaignFlags: [],
      encounterIds: [],
    },
    objectives: [
      { id: 'ask-sayo-format', order: 1, type: 'talk', mapId: 'c1-ferry-landing', targetId: 'sayo-ferry-clerk', instruction: 'Ask Sayo which details travelers agreed to preserve.' },
      { id: 'compare-shrine-copy', order: 2, type: 'inspect', mapId: 'c1-shrine-archive', targetId: 'omission-register', instruction: 'Compare Sayo\'s list with the shrine copy without adding unconfirmed names.' },
      { id: 'recover-blank-paper', order: 3, type: 'collect', mapId: 'c1-tax-storehouse', targetId: 'unsealed-paper-bale', instruction: 'Take unsealed paper that cannot be mistaken for an official writ.' },
      { id: 'return-consent-copy', order: 4, type: 'deliver', mapId: 'c1-ferry-landing', targetId: 'sayo-ferry-clerk', instruction: 'Return the consent copy to Sayo for correction before it travels.' },
    ],
    rewards: { firstClear: rewardBundle(85, 44, [['Ward Tonic', 1]], ['Sayo\'s consent copy']) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['ask-sayo-format', 'compare-shrine-copy', 'recover-blank-paper', 'return-consent-copy'],
      setsFlags: ['optional.sayo-consent-copy-made'],
      resolution: 'Sayo keeps the master copy; Aya carries only a route-safe excerpt with no household locations.',
    },
  }),

  storyQuest({
    id: 'sq-c1-mud-seal',
    title: 'The Seal in the Mud',
    arcId: 'records-belong-to-people',
    chapterId: 'chapter-1',
    mapIds: ['c1-ferry-landing', 'c1-flooded-cedars', 'c1-tax-storehouse'],
    estimatedMinutes: 13,
    questGiver: { id: 'sayo', name: 'Sayo, a fictional ferry clerk', mapId: 'c1-ferry-landing' },
    setup: 'A clay seal washed from the storehouse could authenticate Sayo\'s correction or expose every signer. The party must learn what it marked before deciding where it belongs.',
    prerequisites: {
      opensAfterBeatId: 'c1-04-flooded-cedars',
      questIds: ['sq-c1-blank-lines'],
      campaignFlags: [],
      encounterIds: ['c1-cinder-hounds'],
    },
    objectives: [
      { id: 'read-seal-track', order: 1, type: 'inspect', mapId: 'c1-flooded-cedars', targetId: 'mud-seal-track', instruction: 'Follow the seal\'s square impression through the flooded cedars.' },
      { id: 'recover-clay-seal', order: 2, type: 'collect', mapId: 'c1-flooded-cedars', targetId: 'clay-seal-shallows', instruction: 'Recover the clay seal from the marked shallows.' },
      { id: 'compare-storehouse-mark', order: 3, type: 'inspect', mapId: 'c1-tax-storehouse', targetId: 'storehouse-seal-board', instruction: 'Compare it with the public receiving marks.' },
      { id: 'give-seal-to-sayo', order: 4, type: 'deliver', mapId: 'c1-ferry-landing', targetId: 'sayo-ferry-clerk', instruction: 'Give the seal to Sayo, who breaks it after witnesses verify the copy.' },
    ],
    linkedEncounterIds: ['c1-cinder-hounds'],
    rewards: { firstClear: rewardBundle(105, 58, [['River Salve', 2]]) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['read-seal-track', 'recover-clay-seal', 'compare-storehouse-mark', 'give-seal-to-sayo'],
      setsFlags: ['optional.mud-seal-broken-by-witnesses'],
      resolution: 'The correction remains credible because people witnessed the seal before Sayo destroyed its power to trace them.',
    },
  }),

  storyQuest({
    id: 'sq-c2-letters-without-roads',
    title: 'Letters Without Roads',
    arcId: 'translation-with-consent',
    chapterId: 'chapter-2',
    mapIds: ['tkm-abandoned-chapel', 'tkm-flooded-undercroft', 'tkm-cell-block'],
    estimatedMinutes: 18,
    questGiver: { id: 'tama', name: 'Tama, a fictional chapel caretaker', mapId: 'tkm-abandoned-chapel' },
    setup: 'Tama hid three letters written in mixed Portuguese and Japanese. Lise can translate them, but each author left different instructions about who may read the result.',
    prerequisites: {
      opensAfterBeatId: 'c2-03-lises-interruption',
      questIds: [],
      campaignFlags: [],
      encounterIds: [],
    },
    objectives: [
      { id: 'take-reader-instructions', order: 1, type: 'talk', mapId: 'tkm-abandoned-chapel', targetId: 'tama-caretaker', instruction: 'Record Tama\'s reader instructions before touching the letters.' },
      { id: 'recover-dry-letter', order: 2, type: 'collect', mapId: 'tkm-abandoned-chapel', targetId: 'letter-altar-step', instruction: 'Recover the letter meant for any surviving relative.' },
      { id: 'recover-sealed-letter', order: 3, type: 'collect', mapId: 'tkm-flooded-undercroft', targetId: 'letter-waterproof-tube', instruction: 'Recover the sealed letter whose text must remain closed.' },
      { id: 'recover-cell-letter', order: 4, type: 'collect', mapId: 'tkm-cell-block', targetId: 'letter-cell-brick', instruction: 'Recover the cell letter addressed to a named neighbor.' },
      { id: 'prepare-three-answers', order: 5, type: 'interact', mapId: 'tkm-abandoned-chapel', targetId: 'chapel-writing-board', instruction: 'Translate one letter, route one unopened, and copy only the address from the third.' },
    ],
    rewards: { firstClear: rewardBundle(150, 72, [['Ward Tonic', 1]], ['Three-reader instructions']) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['take-reader-instructions', 'recover-dry-letter', 'recover-sealed-letter', 'recover-cell-letter', 'prepare-three-answers'],
      setsFlags: ['optional.letters-routed-by-consent'],
      resolution: 'Lise treats translation as custody rather than ownership, and Tama chooses the couriers.',
    },
  }),

  storyQuest({
    id: 'sq-c2-bellmakers-measure',
    title: 'The Bellmaker\'s Measure',
    arcId: 'translation-with-consent',
    chapterId: 'chapter-2',
    mapIds: ['tkm-rain-gate', 'tkm-cedar-service-path', 'tkm-bell-stair'],
    estimatedMinutes: 16,
    questGiver: { id: 'tama', name: 'Tama, a fictional chapel caretaker', mapId: 'tkm-rain-gate' },
    setup: 'A carpenter\'s gauge records changes made to Takamine\'s bell stair. Tama asks for measurements that can expose the court retrofit without teaching anyone how to rebuild it.',
    prerequisites: {
      opensAfterBeatId: 'c2-04-bell-stair',
      questIds: ['sq-c2-letters-without-roads'],
      campaignFlags: [],
      encounterIds: ['fp1-cedar-path'],
    },
    objectives: [
      { id: 'recover-gauge', order: 1, type: 'collect', mapId: 'tkm-cedar-service-path', targetId: 'carpenter-gauge', instruction: 'Recover the notched gauge from the already-open service path.' },
      { id: 'measure-gate-bracket', order: 2, type: 'inspect', mapId: 'tkm-rain-gate', targetId: 'court-bell-bracket', instruction: 'Measure the replacement bracket at the rain gate.' },
      { id: 'measure-stair-anchor', order: 3, type: 'inspect', mapId: 'tkm-bell-stair', targetId: 'bell-stair-anchor', instruction: 'Measure the lacquered stair anchor after its pulse passes.' },
      { id: 'score-safe-diagram', order: 4, type: 'interact', mapId: 'tkm-rain-gate', targetId: 'tama-charcoal-board', instruction: 'Score a diagram of the alterations while omitting load-bearing assembly details.' },
    ],
    linkedEncounterIds: ['fp1-cedar-path'],
    rewards: { firstClear: rewardBundle(175, 86, [['Ward Tonic', 1]]) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['recover-gauge', 'measure-gate-bracket', 'measure-stair-anchor', 'score-safe-diagram'],
      setsFlags: ['optional.takamine-retrofit-documented'],
      resolution: 'Tama receives evidence of the retrofit, not a blueprint for another bell weapon.',
    },
  }),

  storyQuest({
    id: 'sq-c3-lanterns-no-office',
    title: 'Lanterns for No Office',
    arcId: 'care-in-the-margins',
    chapterId: 'chapter-3',
    mapIds: ['sdg-market-lane', 'sdg-customs-house', 'sdg-rain-docks'],
    estimatedMinutes: 16,
    questGiver: { id: 'miyo', name: 'Miyo, a fictional lampwright', mapId: 'sdg-market-lane' },
    setup: 'Miyo makes harbor lanterns with no office crest so displaced families can recognize safe boats. Customs has seized the blue paper as undeclared signaling stock.',
    prerequisites: {
      opensAfterBeatId: 'c3-02-the-checkpoint',
      questIds: [],
      campaignFlags: [],
      encounterIds: [],
    },
    objectives: [
      { id: 'inspect-seizure-tag', order: 1, type: 'inspect', mapId: 'sdg-customs-house', targetId: 'blue-paper-seizure-tag', instruction: 'Read the public seizure tag and note its lawful release condition.' },
      { id: 'bring-tax-receipt', order: 2, type: 'collect', mapId: 'sdg-market-lane', targetId: 'miyo-paper-receipt', instruction: 'Take Miyo\'s paid paper receipt to customs.' },
      { id: 'release-blue-paper', order: 3, type: 'interact', mapId: 'sdg-customs-house', targetId: 'customs-paper-cage', instruction: 'Release the blue paper under the clerk\'s own posted rule.' },
      { id: 'hang-safe-lanterns', order: 4, type: 'deliver', mapId: 'sdg-rain-docks', targetId: 'uncrested-lantern-line', instruction: 'Hang the uncrested lanterns along the agreed civilian quay.' },
    ],
    rewards: { firstClear: rewardBundle(230, 112, [['River Salve', 2]]) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['inspect-seizure-tag', 'bring-tax-receipt', 'release-blue-paper', 'hang-safe-lanterns'],
      setsFlags: ['optional.uncrested-lanterns-lit'],
      resolution: 'The lamps identify a safe quay without becoming another government mark.',
    },
  }),

  storyQuest({
    id: 'sq-c4-every-boat-a-net',
    title: 'A Net for Every Boat',
    arcId: 'care-in-the-margins',
    chapterId: 'chapter-4',
    mapIds: ['ngi-fishing-village', 'ngi-tide-caves', 'ngi-wrecked-carrack'],
    estimatedMinutes: 18,
    questGiver: { id: 'tomoe', name: 'Tomoe, a fictional net mender', mapId: 'ngi-fishing-village' },
    setup: 'Tomoe needs rope from the wreck, but one coil holds a memorial knot and another is fouled by bell ash. Kiku insists the village decide what can be reused.',
    prerequisites: {
      opensAfterBeatId: 'c4-02-tide-caves',
      questIds: [],
      campaignFlags: [],
      encounterIds: [],
    },
    objectives: [
      { id: 'learn-knot-marks', order: 1, type: 'talk', mapId: 'ngi-fishing-village', targetId: 'tomoe-net-mender', instruction: 'Learn the village marks for working rope, memorial rope, and fouled rope.' },
      { id: 'collect-working-rope', order: 2, type: 'collect', mapId: 'ngi-wrecked-carrack', targetId: 'working-rope-coil', instruction: 'Collect only the coil marked for reuse.' },
      { id: 'wash-ash-rope', order: 3, type: 'interact', mapId: 'ngi-tide-caves', targetId: 'rope-washing-pool', instruction: 'Wash the fouled coil in the declared current until its ash cue clears.' },
      { id: 'leave-memorial-knot', order: 4, type: 'inspect', mapId: 'ngi-wrecked-carrack', targetId: 'memorial-rope-knot', instruction: 'Record the memorial knot and leave it where survivors placed it.' },
      { id: 'deliver-rope', order: 5, type: 'deliver', mapId: 'ngi-fishing-village', targetId: 'tomoe-net-mender', instruction: 'Return the two usable coils to Tomoe.' },
    ],
    rewards: { firstClear: rewardBundle(300, 138, [['River Salve', 2], ['Ward Tonic', 1]]) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['learn-knot-marks', 'collect-working-rope', 'wash-ash-rope', 'leave-memorial-knot', 'deliver-rope'],
      setsFlags: ['optional.nagi-working-rope-returned'],
      resolution: 'Tomoe repairs the evacuation nets and leaves the memorial knot untouched.',
    },
  }),

  storyQuest({
    id: 'sq-c5-names-in-slag',
    title: 'Names in the Slag',
    arcId: 'records-belong-to-people',
    chapterId: 'chapter-5',
    mapIds: ['kgr-requisition-town', 'kgr-ash-fields', 'kgr-archive-furnace'],
    estimatedMinutes: 19,
    questGiver: { id: 'genbei', name: 'Genbei, a fictional kiln worker', mapId: 'kgr-requisition-town' },
    setup: 'Genbei recognizes household marks fused into slag from the archive furnace. Aya can recover impressions, but only flowing water can separate the bell ash safely.',
    prerequisites: {
      opensAfterBeatId: 'c5-03-cipher-room',
      questIds: [],
      campaignFlags: [],
      encounterIds: ['c5-ashen-release'],
    },
    objectives: [
      { id: 'take-slag-tongs', order: 1, type: 'collect', mapId: 'kgr-requisition-town', targetId: 'genbei-slag-tongs', instruction: 'Take Genbei\'s long tongs instead of touching the bell slag.' },
      { id: 'recover-marked-slag-a', order: 2, type: 'collect', mapId: 'kgr-archive-furnace', targetId: 'marked-slag-north', instruction: 'Lift the north fragment after the grate warning fades.' },
      { id: 'recover-marked-slag-b', order: 3, type: 'collect', mapId: 'kgr-archive-furnace', targetId: 'marked-slag-south', instruction: 'Lift the south fragment after the grate warning fades.' },
      { id: 'cool-slag-in-channel', order: 4, type: 'interact', mapId: 'kgr-ash-fields', targetId: 'slag-cooling-channel', instruction: 'Cool both fragments in the open field channel.' },
      { id: 'return-impressions', order: 5, type: 'deliver', mapId: 'kgr-requisition-town', targetId: 'genbei-slag-table', instruction: 'Give the readable impressions to Genbei for local identification.' },
    ],
    linkedEncounterIds: ['c5-ashen-release'],
    rewards: { firstClear: rewardBundle(390, 168, [['Ward Tonic', 2]], ['Kagura slag impressions']) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['take-slag-tongs', 'recover-marked-slag-a', 'recover-marked-slag-b', 'cool-slag-in-channel', 'return-impressions'],
      setsFlags: ['optional.kagura-slag-names-recovered'],
      resolution: 'Genbei recognizes two families and posts blank space for marks no survivor can yet identify.',
    },
  }),

  storyQuest({
    id: 'sq-c6-three-inks',
    title: 'Three Inks, No Master',
    arcId: 'records-belong-to-people',
    chapterId: 'chapter-6',
    mapIds: ['kzu-printmaker-lane', 'kzu-public-tribunal', 'kzu-archive-roof', 'kzu-canal-lock'],
    estimatedMinutes: 20,
    questGiver: { id: 'rin', name: 'Rin, a fictional apprentice printer', mapId: 'kzu-printmaker-lane' },
    setup: 'Rin can print the court evidence in three inks: durable black, cheap soot, and water-soluble blue. Each copy needs a different route and risk profile.',
    prerequisites: {
      opensAfterBeatId: 'c6-02-three-copies',
      questIds: [],
      campaignFlags: [],
      encounterIds: [],
    },
    objectives: [
      { id: 'collect-black-ink', order: 1, type: 'collect', mapId: 'kzu-printmaker-lane', targetId: 'durable-black-ink', instruction: 'Take durable black ink for the public tribunal copy.' },
      { id: 'collect-soot-ink', order: 2, type: 'collect', mapId: 'kzu-archive-roof', targetId: 'cheap-soot-ink', instruction: 'Recover cheap soot ink for many short-lived handbills.' },
      { id: 'collect-blue-ink', order: 3, type: 'collect', mapId: 'kzu-canal-lock', targetId: 'washable-blue-ink', instruction: 'Collect blue ink that can be erased if a courier is searched.' },
      { id: 'print-route-bundles', order: 4, type: 'interact', mapId: 'kzu-printmaker-lane', targetId: 'rin-three-ink-press', instruction: 'Print each evidence bundle with the ink suited to its route.' },
      { id: 'post-public-copy', order: 5, type: 'deliver', mapId: 'kzu-public-tribunal', targetId: 'tribunal-public-board', instruction: 'Post the durable copy where removal will itself be witnessed.' },
    ],
    rewards: { firstClear: rewardBundle(500, 204, [['River Salve', 2], ['Ward Tonic', 2]], ['Rin\'s three-ink key']) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['collect-black-ink', 'collect-soot-ink', 'collect-blue-ink', 'print-route-bundles', 'post-public-copy'],
      setsFlags: ['optional.three-ink-copies-dispatched'],
      resolution: 'No master copy controls the truth: one is public, many circulate, and one can disappear safely.',
    },
  }),

  storyQuest({
    id: 'sq-c7-roadside-bells',
    title: 'Roadside Bells',
    arcId: 'names-returned',
    chapterId: 'chapter-7',
    mapIds: ['hsh-map-table', 'hsh-post-town', 'hsh-prison-ferry', 'hsh-bell-aqueduct'],
    estimatedMinutes: 20,
    questGiver: { id: 'noe', name: 'Noe, a fictional post-road keeper', mapId: 'hsh-post-town' },
    setup: 'Small warning bells along the post road now answer Kurohana\'s network. Noe asks the party to mute them without silencing the hand bells used to find travelers in fog.',
    prerequisites: {
      opensAfterBeatId: 'c7-03-aqueduct-names',
      questIds: [],
      campaignFlags: [],
      encounterIds: ['c7-name-slip-release'],
    },
    objectives: [
      { id: 'mark-civilian-tone', order: 1, type: 'interact', mapId: 'hsh-post-town', targetId: 'noe-fog-handbell', instruction: 'Record the two-note civilian fog signal.' },
      { id: 'mute-road-bell', order: 2, type: 'interact', mapId: 'hsh-prison-ferry', targetId: 'court-road-bell', instruction: 'Wrap the court road bell without removing the ferry\'s hand signal.' },
      { id: 'break-aqueduct-clapper', order: 3, type: 'interact', mapId: 'hsh-bell-aqueduct', targetId: 'aqueduct-command-clapper', instruction: 'Break the command clapper after its declared pulse.' },
      { id: 'update-safe-map', order: 4, type: 'interact', mapId: 'hsh-map-table', targetId: 'roadside-bell-map', instruction: 'Mark the remaining civilian signals and muted court bells on the route map.' },
      { id: 'confirm-fog-signal', order: 5, type: 'talk', mapId: 'hsh-post-town', targetId: 'noe-post-keeper', instruction: 'Let Noe confirm that the fog signal still carries.' },
    ],
    linkedEncounterIds: ['c7-name-slip-release'],
    rewards: { firstClear: rewardBundle(650, 252, [['Ward Tonic', 2]]) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['mark-civilian-tone', 'mute-road-bell', 'break-aqueduct-clapper', 'update-safe-map', 'confirm-fog-signal'],
      setsFlags: ['optional.roadside-command-bells-muted'],
      resolution: 'The court signal goes quiet while the road\'s practical call-and-answer remains.',
    },
  }),

  storyQuest({
    id: 'sq-c8-consent-ledger',
    title: 'The Consent Ledger',
    arcId: 'care-in-the-margins',
    chapterId: 'chapter-8',
    mapIds: ['c8-hoshigawa-return', 'c8-sodegaura-return', 'c8-takamine-return', 'c8-black-gate'],
    estimatedMinutes: 22,
    questGiver: { id: 'kiku', name: 'Kiku Nawa', mapId: 'c8-hoshigawa-return' },
    setup: 'The Lantern Network has offers of boats, medicine, rope, and fighters. Kiku asks for a consent ledger that records what each community offered and what it explicitly withheld.',
    prerequisites: {
      opensAfterBeatId: 'c8-01-three-homecomings',
      questIds: [],
      campaignFlags: [],
      encounterIds: [],
    },
    objectives: [
      { id: 'record-hoshigawa-offer', order: 1, type: 'talk', mapId: 'c8-hoshigawa-return', targetId: 'hoshigawa-council', instruction: 'Record Hoshigawa\'s medicine offer and its refusal to send untrained fighters.' },
      { id: 'record-sodegaura-offer', order: 2, type: 'talk', mapId: 'c8-sodegaura-return', targetId: 'sodegaura-boat-circle', instruction: 'Record Sodegaura\'s two boats and the quay that must remain defended.' },
      { id: 'record-takamine-offer', order: 3, type: 'talk', mapId: 'c8-takamine-return', targetId: 'takamine-repair-group', instruction: 'Record Takamine\'s rope and its protected evacuation stores.' },
      { id: 'post-limits-at-gate', order: 4, type: 'deliver', mapId: 'c8-black-gate', targetId: 'lantern-command-board', instruction: 'Post both contributions and limits where every assault leader can read them.' },
      { id: 'confirm-no-conscription', order: 5, type: 'interact', mapId: 'c8-black-gate', targetId: 'consent-ledger-seal', instruction: 'Seal the plan only after every stated limit is represented.' },
    ],
    rewards: { firstClear: rewardBundle(820, 318, [['River Salve', 3], ['Ward Tonic', 2]], ['Community consent ledger']) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['record-hoshigawa-offer', 'record-sodegaura-offer', 'record-takamine-offer', 'post-limits-at-gate', 'confirm-no-conscription'],
      setsFlags: ['optional.community-limits-honored'],
      resolution: 'The breach plan becomes stronger because it names what commanders may not take.',
    },
  }),

  storyQuest({
    id: 'sq-c9-breathing-index',
    title: 'The Breathing Index',
    arcId: 'names-returned',
    chapterId: 'chapter-9',
    mapIds: ['krh-outer-archive', 'krh-audience-hall', 'krh-blood-conservatory'],
    estimatedMinutes: 24,
    questGiver: { id: 'aya', name: 'Aya Shinohara', mapId: 'krh-outer-archive' },
    setup: 'Kurohana\'s archive files living people beside the dead. Aya proposes a breathing index: marks that identify records requiring immediate rescue without pretending the dead matter less.',
    prerequisites: {
      opensAfterBeatId: 'c9-02-ujiros-last-ledger',
      questIds: [],
      campaignFlags: [],
      encounterIds: ['c9-archive-nodes'],
    },
    objectives: [
      { id: 'recover-intake-tabs', order: 1, type: 'collect', mapId: 'krh-outer-archive', targetId: 'living-intake-tabs', instruction: 'Recover the recent intake tabs after the archive nodes fall.' },
      { id: 'compare-audience-roster', order: 2, type: 'inspect', mapId: 'krh-audience-hall', targetId: 'audience-roster', instruction: 'Compare the tabs with the court attendance roster.' },
      { id: 'check-conservatory-cots', order: 3, type: 'inspect', mapId: 'krh-blood-conservatory', targetId: 'conservatory-cot-marks', instruction: 'Check cot marks for people moved without names.' },
      { id: 'mark-immediate-rescue', order: 4, type: 'interact', mapId: 'krh-outer-archive', targetId: 'breathing-index-board', instruction: 'Mark confirmed living records for immediate rescue routes.' },
      { id: 'mark-uncertain-records', order: 5, type: 'interact', mapId: 'krh-outer-archive', targetId: 'uncertain-index-board', instruction: 'Preserve uncertain records without declaring anyone dead by omission.' },
    ],
    linkedEncounterIds: ['c9-archive-nodes'],
    rewards: { firstClear: rewardBundle(1050, 410, [['River Salve', 3], ['Ward Tonic', 3]], ['Breathing index']) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['recover-intake-tabs', 'compare-audience-roster', 'check-conservatory-cots', 'mark-immediate-rescue', 'mark-uncertain-records'],
      setsFlags: ['optional.breathing-index-opened'],
      resolution: 'Rescue teams receive urgent routes while uncertain and memorial records remain visible for later correction.',
    },
  }),

  storyQuest({
    id: 'sq-e-corrections-margin',
    title: 'Corrections in the Margin',
    arcId: 'records-belong-to-people',
    chapterId: 'epilogue',
    mapIds: ['epi-hoshigawa-archive', 'epi-sodegaura-storehouse', 'epi-takamine-tower'],
    estimatedMinutes: 14,
    questGiver: { id: 'aya', name: 'Aya Shinohara', mapId: 'epi-hoshigawa-archive' },
    setup: 'The first public archive copy already contains mistakes. Aya asks Ren to carry corrections from two communities before the repaired tower opens its reading room.',
    prerequisites: {
      opensAfterBeatId: 'e00-open-archive',
      questIds: [],
      campaignFlags: [],
      encounterIds: [],
    },
    objectives: [
      { id: 'take-correction-slips', order: 1, type: 'collect', mapId: 'epi-hoshigawa-archive', targetId: 'public-correction-box', instruction: 'Take only signed or witnessed correction slips.' },
      { id: 'verify-storehouse-date', order: 2, type: 'talk', mapId: 'epi-sodegaura-storehouse', targetId: 'storehouse-care-circle', instruction: 'Verify a disputed arrival date with the care circle, not one official.' },
      { id: 'post-corrections', order: 3, type: 'deliver', mapId: 'epi-takamine-tower', targetId: 'tower-correction-margin', instruction: 'Post the corrections beside the original page so the change remains visible.' },
      { id: 'leave-blank-line', order: 4, type: 'interact', mapId: 'epi-takamine-tower', targetId: 'tower-unknown-name-line', instruction: 'Leave a ruled blank for the name no witness can yet supply.' },
    ],
    rewards: { firstClear: rewardBundle(500, 360, [['River Salve', 2], ['Ward Tonic', 2]], ['First correction folio']) },
    completion: {
      mode: 'ordered',
      requiredObjectiveIds: ['take-correction-slips', 'verify-storehouse-date', 'post-corrections', 'leave-blank-line'],
      setsFlags: ['optional.first-public-corrections-posted'],
      resolution: 'The archive opens as a revisable public practice, not a perfect monument.',
    },
  }),
]);

export const REPEATABLE_CONTRACTS = deepFreeze([
  contract({
    id: 'contract-c1-cinder-route',
    title: 'Cinder Route Patrol',
    arcId: 'lantern-contracts',
    chapterId: 'chapter-1',
    mapIds: ['c1-flooded-cedars'],
    estimatedMinutes: 10,
    questGiver: { id: 'sayo', name: 'Sayo, a fictional ferry clerk', mapId: 'c1-flooded-cedars' },
    setup: 'A bell echo keeps reforming two cinder hounds along the marked ferry route. Sayo pays for a readable patrol, not trophies.',
    prerequisites: {
      opensAfterBeatId: 'c1-04-flooded-cedars',
      questIds: [],
      campaignFlags: [],
      encounterIds: ['c1-cinder-hounds'],
    },
    objectives: [
      { id: 'check-ferry-marker', order: 1, type: 'inspect', mapId: 'c1-flooded-cedars', targetId: 'contract-ferry-marker', instruction: 'Check the ferry marker for a fresh bell echo.' },
      { id: 'clear-cinder-echo', order: 2, type: 'battle-replay', mapId: 'c1-flooded-cedars', targetId: 'cinder-hound-echo', encounterId: 'c1-cinder-hounds', instruction: 'Clear the telegraphed hound echo.' },
      { id: 'report-clear-route', order: 3, type: 'report', mapId: 'c1-flooded-cedars', targetId: 'sayo-route-board', instruction: 'Mark the route clear until the next echo cycle.' },
    ],
    linkedEncounterIds: ['c1-cinder-hounds'],
    rewards: {
      firstClear: rewardBundle(70, 36, [['River Salve', 1]]),
      repeat: rewardBundle(28, 18),
    },
    completion: {
      mode: 'ordered-repeatable',
      requiredObjectiveIds: ['check-ferry-marker', 'clear-cinder-echo', 'report-clear-route'],
      setsFlags: ['optional.contract-c1-first-clear'],
      resolution: 'The route board receives a dated clearance; future echoes remain a transparent grind option.',
    },
  }),

  contract({
    id: 'contract-c3-dock-watch',
    title: 'Uncrested Dock Watch',
    arcId: 'lantern-contracts',
    chapterId: 'chapter-3',
    mapIds: ['sdg-rain-docks'],
    estimatedMinutes: 10,
    questGiver: { id: 'miyo', name: 'Miyo, a fictional lampwright', mapId: 'sdg-rain-docks' },
    setup: 'Court patrol echoes gather beneath Miyo\'s uncrested lanterns. The watch contract keeps the civilian signal visible and the battle optional.',
    prerequisites: {
      opensAfterBeatId: 'c3-04-lantern-boat-escort',
      questIds: [],
      campaignFlags: [],
      encounterIds: ['c3-dock-patrol'],
    },
    objectives: [
      { id: 'light-watch-lantern', order: 1, type: 'interact', mapId: 'sdg-rain-docks', targetId: 'contract-watch-lantern', instruction: 'Light the blue watch lantern to declare the patrol.' },
      { id: 'clear-dock-echo', order: 2, type: 'battle-replay', mapId: 'sdg-rain-docks', targetId: 'dock-patrol-echo', encounterId: 'c3-dock-patrol', instruction: 'Clear the readable dock-patrol echo.' },
      { id: 'lower-watch-lantern', order: 3, type: 'interact', mapId: 'sdg-rain-docks', targetId: 'contract-watch-lantern', instruction: 'Lower the watch lantern so it cannot be confused with an emergency.' },
    ],
    linkedEncounterIds: ['c3-dock-patrol'],
    rewards: {
      firstClear: rewardBundle(190, 82, [['Ward Tonic', 1]]),
      repeat: rewardBundle(76, 41),
    },
    completion: {
      mode: 'ordered-repeatable',
      requiredObjectiveIds: ['light-watch-lantern', 'clear-dock-echo', 'lower-watch-lantern'],
      setsFlags: ['optional.contract-c3-first-clear'],
      resolution: 'Miyo records the watch without turning her safe lantern into a permanent alarm.',
    },
  }),

  contract({
    id: 'contract-c5-ash-release',
    title: 'Ash-Field Name Watch',
    arcId: 'lantern-contracts',
    chapterId: 'chapter-5',
    mapIds: ['kgr-ash-fields'],
    estimatedMinutes: 10,
    questGiver: { id: 'genbei', name: 'Genbei, a fictional kiln worker', mapId: 'kgr-ash-fields' },
    setup: 'A released name slip can draw a fading patrol echo. Genbei asks the party to return the slip to water and disperse the echo without farming remains.',
    prerequisites: {
      opensAfterBeatId: 'c5-03-cipher-room',
      questIds: [],
      campaignFlags: [],
      encounterIds: ['c5-ashen-release'],
    },
    objectives: [
      { id: 'take-return-slip', order: 1, type: 'collect', mapId: 'kgr-ash-fields', targetId: 'contract-name-slip', instruction: 'Take one marked return slip from Genbei.' },
      { id: 'release-ash-echo', order: 2, type: 'battle-replay', mapId: 'kgr-ash-fields', targetId: 'ashen-release-echo', encounterId: 'c5-ashen-release', instruction: 'Complete the name-release encounter without treating the released person as loot.' },
      { id: 'wash-return-slip', order: 3, type: 'interact', mapId: 'kgr-ash-fields', targetId: 'contract-flowing-water', instruction: 'Return the marked slip to the field channel.' },
    ],
    linkedEncounterIds: ['c5-ashen-release'],
    rewards: {
      firstClear: rewardBundle(360, 136, [['Ward Tonic', 1]]),
      repeat: rewardBundle(144, 68),
    },
    completion: {
      mode: 'ordered-repeatable',
      requiredObjectiveIds: ['take-return-slip', 'release-ash-echo', 'wash-return-slip'],
      setsFlags: ['optional.contract-c5-first-clear'],
      resolution: 'The name is returned; only ordinary training rewards persist between runs.',
    },
  }),

  contract({
    id: 'contract-c7-aqueduct-watch',
    title: 'Aqueduct Pulse Watch',
    arcId: 'lantern-contracts',
    chapterId: 'chapter-7',
    mapIds: ['hsh-bell-aqueduct'],
    estimatedMinutes: 10,
    questGiver: { id: 'noe', name: 'Noe, a fictional post-road keeper', mapId: 'hsh-bell-aqueduct' },
    setup: 'Residual commands collect at the aqueduct during one declared pulse window. Noe keeps a timed watch so travelers know when the route is clear.',
    prerequisites: {
      opensAfterBeatId: 'c7-03-aqueduct-names',
      questIds: [],
      campaignFlags: [],
      encounterIds: ['c7-name-slip-release'],
    },
    objectives: [
      { id: 'start-pulse-clock', order: 1, type: 'interact', mapId: 'hsh-bell-aqueduct', targetId: 'contract-pulse-clock', instruction: 'Start the visible pulse clock.' },
      { id: 'clear-aqueduct-echo', order: 2, type: 'battle-replay', mapId: 'hsh-bell-aqueduct', targetId: 'name-slip-echo', encounterId: 'c7-name-slip-release', instruction: 'Release the patrol echo before the marked watch ends.' },
      { id: 'post-watch-time', order: 3, type: 'report', mapId: 'hsh-bell-aqueduct', targetId: 'contract-aqueduct-board', instruction: 'Post the measured clear interval for travelers.' },
    ],
    linkedEncounterIds: ['c7-name-slip-release'],
    rewards: {
      firstClear: rewardBundle(610, 222, [['River Salve', 1], ['Ward Tonic', 1]]),
      repeat: rewardBundle(244, 111),
    },
    completion: {
      mode: 'ordered-repeatable',
      requiredObjectiveIds: ['start-pulse-clock', 'clear-aqueduct-echo', 'post-watch-time'],
      setsFlags: ['optional.contract-c7-first-clear'],
      resolution: 'The posted interval makes the repeatable fight an informed choice, not a surprise interruption.',
    },
  }),
]);

export const ALL_OPTIONAL_QUESTS = deepFreeze([...SIDE_QUESTS, ...REPEATABLE_CONTRACTS]);

export function getSideQuest(id) {
  return ALL_OPTIONAL_QUESTS.find((quest) => quest.id === id) ?? null;
}

export function getOptionalQuestsForChapter(chapterId) {
  return ALL_OPTIONAL_QUESTS.filter((quest) => quest.chapterId === chapterId);
}

export function getOptionalContentPacing() {
  const storyMinutes = SIDE_QUESTS.reduce((total, quest) => total + quest.estimatedMinutes, 0);
  const firstContractCircuitMinutes = REPEATABLE_CONTRACTS.reduce((total, quest) => total + quest.estimatedMinutes, 0);
  const firstPassMinutes = storyMinutes + firstContractCircuitMinutes;
  return deepFreeze({
    storyMinutes,
    firstContractCircuitMinutes,
    firstPassMinutes,
    firstPassHours: Number((firstPassMinutes / 60).toFixed(2)),
    repeatableAfterFirstCircuit: true,
  });
}
