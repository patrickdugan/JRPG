/**
 * Finite witness chronicles for Bells of the Black Chrysanthemum.
 *
 * These authored episodes add substantial, non-repeatable story play on routes
 * that are already open during their chapter. They introduce no traversal
 * abilities, lootable sacred objects, historical officials, or real-person
 * likenesses. Communities speak and decide for themselves.
 */

import { CAMPAIGN } from './campaign.mjs';
import { getEncounter } from './encounters.mjs';
import { LEVELS, getLevel } from './levels.mjs';

export const WITNESS_CHRONICLE_SCHEMA_VERSION = 1;

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const exactKeys = (value, expected) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
};

const dialogue = (speaker, line) => ({ speaker, line });

const stage = (id, mapId, type, minutes, instruction, lines, encounterId = null) => ({
  id,
  mapId,
  encounterId,
  activity: { type, minutes, instruction },
  dialogue: lines,
});

const option = (id, label, summary) => ({
  id,
  label,
  consequence: {
    flag: `witness.${id}`,
    summary,
  },
});

const choice = (stageId, prompt, options) => ({ stageId, prompt, options });

const reward = (xpPerMember, currency, items = [], keyItems = []) => ({
  xpPerMember,
  currency,
  items: items.map(([name, quantity]) => ({ name, quantity })),
  keyItems,
});

const chronicle = (entry) => ({
  kind: 'finite-witness-chronicle',
  repeatable: false,
  ...entry,
  estimatedMinutes: entry.stages.reduce((total, current) => total + current.activity.minutes, 0),
  navigation: {
    backtrackingRequired: false,
    abilityGate: null,
    accessRule: 'Stages follow a forward-reachable route already open during this chapter.',
  },
});

export const WITNESS_CHRONICLE_GUARDRAILS = deepFreeze([
  'Every person and institution introduced here is fictional; no performance or portrait may reproduce a real person.',
  'The alternate history does not retell a real victim biography or use suffering as collectible scenery.',
  'Persecuted households, workers, travelers, and congregations make decisions and retain the right to withhold information.',
  'Faith and survival choices do not determine moral worth, and no sacred object is a weapon, prize, or saleable reward.',
  'Combat, when present, is a single canonical encounter on the forward route and never repeatable filler.',
  'No chronicle requires a movement ability, hidden wall, late-game return, or metroidvania backtracking.',
]);

const AUTHORED_CHRONICLES = [
  chronicle({
    id: 'wc-p-doors-before-numbers',
    title: 'Doors Before Numbers',
    chapterId: 'prologue',
    opensAfterBeatId: 'p01-altered-order',
    setup: 'Masa, an elected lane caller, asks Ren to verify which households have already chosen a river shelter before the false census turns choices into orders.',
    stages: [
      stage('ask-at-open-doors', 'hsh-river-lane', 'interview', 5, 'Speak only at doors whose blue cord invites a caller.', [
        dialogue('MASA', 'Blue cord means knock. Bare latch means leave the house its silence.'),
        dialogue('REN', 'The office list marks every door as answered.'),
        dialogue('HOUSEHOLDER', 'Then begin by writing that I answered for myself.'),
        dialogue('MASA', 'A caller carries invitations, not authority.'),
        dialogue('REN', 'I will ask the next door what its cord means before I touch the latch.'),
      ]),
      stage('separate-count-from-route', 'hsh-census-square', 'archive', 4, 'Compare the voluntary shelter marks with the collector\'s altered count.', [
        dialogue('AYA', 'Three shelter marks, five court circles. They are not the same record.'),
        dialogue('MASA', 'Keep the routes with me. The court needs no copy of where children sleep.'),
        dialogue('REN', 'I will carry only the difference in the totals.'),
        dialogue('HOUSEHOLDER', 'Write that two houses chose to stay together. Do not choose for us which one led.'),
        dialogue('AYA', 'The note will preserve the shared decision and omit the doors.'),
      ]),
      stage('post-the-lane-signal', 'hsh-riverbank', 'deliver', 4, 'Post the chosen river signal where arriving households can correct it.', [
        dialogue('HOUSEHOLDER', 'One lamp for room, two for medicine, none for names.'),
        dialogue('MASA', 'And if the shelter changes, the people here change the board.'),
        dialogue('REN', 'A count that can answer back. I had not carried one of those.'),
        dialogue('AYA', 'The chalk belongs beside the board, not locked in an office.'),
        dialogue('HOUSEHOLDER', 'Good. A wrong mark should survive only as long as it takes us to see it.'),
        dialogue('MASA', 'The river signal is ready. The lane will decide when to light it.'),
      ]),
    ],
    choice: choice('post-the-lane-signal', 'Who keeps the only detailed shelter list?', [
      option('masa-keeps-route-list', 'Leave the route list with Masa.', 'The lane caller keeps the revisable routes; the party carries only totals.'),
      option('households-split-route-list', 'Split the list among households.', 'Each household keeps its own route slip, reducing the risk of one seized ledger.'),
    ]),
    reward: reward(45, 20, [['River Salve', 1]], ['Lane signal tally']),
    resolution: 'The shelter board records capacity without turning refuge into another census.',
  }),

  chronicle({
    id: 'wc-c1-ferry-three-tides',
    title: 'The Ferry at Three Tides',
    chapterId: 'chapter-1',
    opensAfterBeatId: 'c1-01-registers-omissions',
    setup: 'Sayo and two ferry families reconstruct when unmarked court crates crossed the river, using tide knowledge the official ledger omitted.',
    stages: [
      stage('read-the-tide-post', 'c1-shrine-archive', 'inspect', 4, 'Copy water heights, not household destinations, from the archive tide post.', [
        dialogue('AYA', 'The clerk wrote noon, but the tide mark belongs to evening.'),
        dialogue('REN', 'A false hour can hide an entire crossing.'),
        dialogue('SAYO', 'Or reveal it, if you ask the river before the office.'),
        dialogue('AYA', 'I will copy the height, weather, and method so another reader can test us.'),
      ]),
      stage('hear-three-crossings', 'c1-ferry-landing', 'interview', 6, 'Hear each ferry account separately before comparing them.', [
        dialogue('FERRY ELDER', 'The first boat rode low. No passengers, only sealed paper.'),
        dialogue('YOUNG BOATKEEPER', 'The second carried a clerk who kept looking upriver.'),
        dialogue('SAYO', 'The third returned empty, which is why the ledger calls it nothing.'),
        dialogue('REN', 'Three crossings, three witnesses, and no need to make their memories identical.'),
      ]),
      stage('clear-the-wisp-bank', 'c1-flooded-cedars', 'combat', 9, 'Clear the canonical Ash Wisp encounter so the witnesses can inspect the bank.', [
        dialogue('REN', 'The lights are folding around the old landing.'),
        dialogue('AYA', 'Read their element, then make the route quiet enough for witnesses.'),
        dialogue('SAYO', 'We stay behind the cedar marker. Signal when the bank is ours.'),
        dialogue('YOUNG BOATKEEPER', 'The river edge is ours to read once your battle line clears.'),
      ], 'c1-ash-wisps'),
      stage('mark-the-missing-return', 'c1-tax-storehouse', 'archive', 5, 'Add the empty return crossing beside, not over, the official entry.', [
        dialogue('SAYO', 'Do not correct their ink until no one can see the lie.'),
        dialogue('AYA', 'Original, witness note, correction. Three layers.'),
        dialogue('REN', 'And the empty boat becomes evidence instead of nothing.'),
        dialogue('FERRY ELDER', 'Leave the tide stain visible. Paper also remembers where it traveled.'),
      ]),
    ],
    choice: choice('mark-the-missing-return', 'How should the conflicting hour remain visible?', [
      option('publish-both-ferry-hours', 'Print both hours side by side.', 'Readers see the official hour and the tide-supported witness hour together.'),
      option('publish-tide-method', 'Publish the tide method without names.', 'Other ferries can test altered ledgers without exposing these witnesses.'),
    ]),
    reward: reward(95, 48, [['Ward Tonic', 1]], ['Three-tide comparison']),
    resolution: 'Local knowledge establishes the hidden crossing while witnesses control how their testimony travels.',
  }),

  chronicle({
    id: 'wc-c1-clerks-red-thread',
    title: 'The Clerk\'s Red Thread',
    chapterId: 'chapter-1',
    opensAfterBeatId: 'c1-03-ferry-gossip',
    setup: 'The rescued clerk used red binding thread to distinguish coerced copies from voluntary ferry accounts, but the storehouse scattered the bundles.',
    stages: [
      stage('learn-the-binding-code', 'c1-ferry-landing', 'interview', 5, 'Let the clerk explain the thread code before anyone sorts a page.', [
        dialogue('CLERK', 'Red at the head meant copied under watch. Red at the foot meant I doubted the source.'),
        dialogue('SAYO', 'You made a language inside their binding.'),
        dialogue('CLERK', 'A small one. I was afraid to make it louder.'),
        dialogue('AYA', 'A small mark can still be precise. Show us where the knot begins.'),
        dialogue('CLERK', 'Two turns for coercion, one for doubt. Never three; three was the court seal.'),
      ]),
      stage('recover-scattered-bundles', 'c1-flooded-cedars', 'combat', 9, 'Clear the canonical Cinder Hounds and recover only the marked bundles.', [
        dialogue('REN', 'Two hounds between us and the paper shelf.'),
        dialogue('AYA', 'Pierce their ash seams. Do not let the loose pages draw you into the warning line.'),
        dialogue('CLERK', 'The red-foot bundle is mine. Leave the household letters closed.'),
        dialogue('SAYO', 'I have the shelf in sight. No page is worth stepping into that sweep.'),
        dialogue('REN', 'Then we win the space first and let the owner choose the paper.'),
      ], 'c1-cinder-hounds'),
      stage('bind-a-witness-copy', 'c1-tax-storehouse', 'archive', 6, 'Rebind the pages with a legend chosen by the clerk and Sayo.', [
        dialogue('CLERK', 'If I sign the legend, the court will say one frightened man invented it.'),
        dialogue('SAYO', 'Then I sign that the ferry used the marks before tonight.'),
        dialogue('AYA', 'Two kinds of knowledge, neither swallowed by my casebook.'),
        dialogue('REN', 'We can also preserve the thread itself without calling it a verdict.'),
        dialogue('CLERK', 'Write that I was frightened. Fear explains the code; it does not make the code false.'),
        dialogue('SAYO', 'And write that I checked it against crossings I witnessed.'),
      ]),
    ],
    choice: choice('bind-a-witness-copy', 'Whose custody should hold the decoded bundle?', [
      option('clerk-keeps-red-thread-copy', 'Return it to the clerk.', 'The clerk retains custody and chooses when to testify publicly.'),
      option('ferry-circle-keeps-red-thread-copy', 'Place it with the ferry circle.', 'Several ferry workers share custody and can corroborate the binding practice.'),
    ]),
    reward: reward(100, 52, [['River Salve', 1]], ['Red-thread legend']),
    resolution: 'The clerk\'s quiet resistance becomes usable testimony without erasing the fear that shaped it.',
  }),

  chronicle({
    id: 'wc-c2-the-unlocked-chapel',
    title: 'The Unlocked Chapel',
    chapterId: 'chapter-2',
    opensAfterBeatId: 'c2-01-rain-gate',
    setup: 'Tama kept one chapel door unlocked for any traveler, regardless of faith. The court calls that hospitality evidence of conspiracy.',
    stages: [
      stage('record-the-door-practice', 'tkm-rain-gate', 'interview', 5, 'Ask travelers what the open door offered without asking their beliefs.', [
        dialogue('TAMA', 'A dry floor, boiled water, and no question at the threshold.'),
        dialogue('TRAVELER', 'I slept there twice. No one asked me to pray.'),
        dialogue('AYA', 'Then hospitality is the fact we record.'),
        dialogue('TAMA', 'Also record that guests could leave before dawn without giving a destination.'),
      ]),
      stage('inspect-the-open-latch', 'tkm-abandoned-chapel', 'inspect', 4, 'Inspect the ordinary latch and the posted guest rules.', [
        dialogue('REN', 'No secret lock. No hidden passage.'),
        dialogue('TAMA', 'The dangerous part was leaving it open.'),
        dialogue('NIKOLA', 'Then we show the rule board, not turn the room into a legend.'),
        dialogue('TRAVELER', 'The latch stuck in wet weather. Ordinary trouble belongs in the account too.'),
      ]),
      stage('compare-the-seizure-list', 'tkm-flooded-undercroft', 'archive', 5, 'Compare seized bedding and kettles with the court\'s accusation list.', [
        dialogue('AYA', 'They have named blankets as contraband and a kettle as foreign supply.'),
        dialogue('TAMA', 'The kettle came from the next valley.'),
        dialogue('REN', 'Ordinary things made suspicious by the people who needed them.'),
        dialogue('NIKOLA', 'We list use and origin, then let the accusation collapse under its own excess.'),
      ]),
      stage('return-the-guest-board', 'tkm-cell-block', 'deliver', 4, 'Return a copy of the guest rules to Tama after the cells open.', [
        dialogue('TAMA', 'The door can open again, but not because you say it is safe.'),
        dialogue('NIKOLA', 'You choose the hours and who stands watch.'),
        dialogue('TAMA', 'Then write: open when the caretakers agree.'),
        dialogue('AYA', 'And closed without explanation whenever the caretakers judge the risk too high.'),
      ]),
    ],
    choice: choice('return-the-guest-board', 'How will the rebuilt shelter announce itself?', [
      option('chapel-posts-neutral-blue-cord', 'Use the lane\'s blue invitation cord.', 'The shelter joins a local hospitality signal shared beyond one congregation.'),
      option('chapel-posts-written-guest-rules', 'Post the guest rules in three scripts.', 'Travelers can read the limits before entering, while caretakers retain control.'),
    ]),
    reward: reward(150, 70, [['River Salve', 1], ['Ward Tonic', 1]], ['Hospitality practice copy']),
    resolution: 'The chapel is documented as a community shelter, not reduced to either accusation or romantic secrecy.',
  }),

  chronicle({
    id: 'wc-c2-mateus-first-testimony',
    title: 'A Testimony Without Pardon',
    chapterId: 'chapter-2',
    opensAfterBeatId: 'c2-04-bell-stair',
    setup: 'After the bell chamber confrontation, Mateus offers his first precise account of a registry transfer. Nikola insists that information is not absolution.',
    stages: [
      stage('collect-independent-marks', 'tkm-cedar-service-path', 'inspect', 4, 'Record cart ruts and crate marks before hearing Mateus\'s version.', [
        dialogue('NIKOLA', 'We begin with what the road says, not what he wants us to believe.'),
        dialogue('REN', 'Three axle cuts. One cart returned lighter.'),
        dialogue('AYA', 'And the black alloy mark was scraped after the rain.'),
        dialogue('NIKOLA', 'Photograph it in memory, copy it in charcoal, and leave the road itself untouched.'),
      ]),
      stage('hear-tamas-timeline', 'tkm-abandoned-chapel', 'interview', 5, 'Let Tama establish the prisoner timeline in her own words.', [
        dialogue('TAMA', 'The cart arrived before midnight. The cells answered after the second bell.'),
        dialogue('NIKOLA', 'Did you see the interpreter?'),
        dialogue('TAMA', 'I heard his voice. I will not claim the face I did not see.'),
        dialogue('AYA', 'That limit strengthens the account. We mark heard, not seen.'),
      ]),
      stage('survive-the-bell-chamber', 'tkm-bell-chamber', 'combat', 10, 'Complete the canonical Mateus confrontation and preserve both ward records.', [
        dialogue('MATEUS', 'Break the wards, then hear what I carried for them.'),
        dialogue('NIKOLA', 'You do not set the price of being heard.'),
        dialogue('AYA', 'Recovery window now. Evidence after everyone is standing.'),
        dialogue('REN', 'Left ward is open. We finish the danger without destroying the transfer seals.'),
      ], 'fp1-mateus'),
      stage('take-a-bounded-statement', 'tkm-cell-block', 'interview', 6, 'Record only claims Mateus can locate, date, and expose to contradiction.', [
        dialogue('MATEUS', 'I translated twelve names onto the transfer order. I knew the cells were full.'),
        dialogue('NIKOLA', 'Say what you chose, not only what you knew.'),
        dialogue('MATEUS', 'I chose the court because I feared what waited outside it. Others paid for that choice.'),
        dialogue('TAMA', 'Your fear enters the record after the names of those you delivered.'),
      ]),
    ],
    choice: choice('take-a-bounded-statement', 'Where should Mateus\'s first statement be held?', [
      option('tama-holds-mateus-statement', 'Leave the statement with Tama.', 'A harmed local caretaker controls whether and when this testimony travels.'),
      option('split-mateus-statement-custody', 'Make two witnessed copies.', 'Tama and Aya hold matching copies, each marked as allegation pending corroboration.'),
    ]),
    reward: reward(175, 82, [['Ward Tonic', 1]], ['Bounded transfer statement']),
    resolution: 'Mateus supplies actionable evidence, while accountability remains separate from forgiveness.',
  }),

  chronicle({
    id: 'wc-c3-uncrested-lamps',
    title: 'Lamps Without a Crest',
    chapterId: 'chapter-3',
    opensAfterBeatId: 'c3-01-separate-arrivals',
    setup: 'Miyo\'s blue quay lamps guide civilians in rain, but customs has seized them for lacking an official crest.',
    stages: [
      stage('hear-the-lamp-code', 'sdg-market-lane', 'interview', 5, 'Learn the civilian lamp colors and who may change them.', [
        dialogue('MIYO', 'Blue means dry steps. White means a boat has room. Red belongs only to fire.'),
        dialogue('KIKU', 'Who decides when a boat has room?'),
        dialogue('MIYO', 'The boat circle, not the harbor office and not me alone.'),
        dialogue('BOATKEEPER', 'A white lamp goes dark the moment the last safe place is taken.'),
      ]),
      stage('read-the-posted-rule', 'sdg-customs-house', 'inspect', 4, 'Use the customs office\'s posted release rule without forging authority.', [
        dialogue('AYA', 'Paid paper, civilian use, no military seal. Her lamps meet every written condition.'),
        dialogue('REN', 'The clerk still says a crest is customary.'),
        dialogue('MIYO', 'Custom is not the rule they nailed to the wall.'),
        dialogue('CUSTOMS CLERK', 'If you invoke the board, I must record why I refused it.'),
      ]),
      stage('clear-the-quay-line', 'sdg-rain-docks', 'combat', 9, 'Clear the canonical Dock Patrol before relighting the civilian route.', [
        dialogue('GENTA', 'Hooks across the quay. Their warning line is longer than their reach.'),
        dialogue('REN', 'We move outside it and keep the lamp posts standing.'),
        dialogue('MIYO', 'I will relight them. You do not need to speak for the quay.'),
        dialogue('KIKU', 'The clinic runners are sheltered. Take the east line when it opens.'),
      ], 'c3-dock-patrol'),
      stage('relight-by-consent', 'sdg-rain-docks', 'council', 5, 'Let the boat circle choose which safe lamps return tonight.', [
        dialogue('BOATKEEPER', 'Blue on the east steps. White stays dark until the injured are aboard.'),
        dialogue('KIKU', 'The clinic can send a runner when it is time.'),
        dialogue('MIYO', 'Then the lamps answer people, not a crest.'),
        dialogue('REN', 'And the signal changes when the people at the boats change it.'),
      ]),
    ],
    choice: choice('relight-by-consent', 'How should the lamp code be protected?', [
      option('quay-keeps-lamp-code-local', 'Keep the full code at the quay.', 'The boat circle retains the code; travelers receive only the signals they need.'),
      option('ports-share-civilian-lamp-code', 'Share it with two civilian ports.', 'Neighboring boat circles can recognize the signals, with no court crest added.'),
    ]),
    reward: reward(230, 104, [['River Salve', 2]], ['Uncrested lamp chart']),
    resolution: 'The lamps return as community infrastructure and the people using them retain control of the code.',
  }),

  chronicle({
    id: 'wc-c3-porters-weight-book',
    title: 'The Porters\' Weight Book',
    chapterId: 'chapter-3',
    opensAfterBeatId: 'c3-03-ledger-customs-house',
    setup: 'Salt porters kept a parallel weight book because Captain Kaji billed vanished workers for cargo they never carried.',
    stages: [
      stage('compare-shoulder-marks', 'sdg-customs-house', 'archive', 5, 'Compare loads with workers\' shoulder-pad marks, not assumptions about strength.', [
        dialogue('PORTER NAMI', 'A blue stitch is a half load. Kaji wrote every stitch as full.'),
        dialogue('GENTA', 'Then his totals cannot match the warehouse stacks.'),
        dialogue('AYA', 'We count the stacks with the porters who moved them.'),
        dialogue('PORTER NAMI', 'Count rests too. A body is not dishonest because it sets a sack down.'),
      ]),
      stage('hold-the-dry-route', 'sdg-rain-docks', 'escort', 6, 'Escort the bookkeepers along the declared dry quay.', [
        dialogue('REN', 'The west planks are flooding. East route, single line.'),
        dialogue('PORTER NAMI', 'We know the quay. Guard the rear and let us set the pace.'),
        dialogue('GENTA', 'Understood. Your route, my shield.'),
        dialogue('PORTER', 'Scale book is wrapped. Call the hook line before it crosses us.'),
      ]),
      stage('confront-the-false-total', 'sdg-salt-warehouse', 'combat', 10, 'Complete the canonical Captain Kaji encounter before opening the public scales.', [
        dialogue('CAPTAIN KAJI', 'A porter signs what the harbor weighs.'),
        dialogue('PORTER NAMI', 'A harbor is not your handwriting.'),
        dialogue('REN', 'His recovery is open. Break the command line, then protect the scales.'),
        dialogue('GENTA', 'The scales remain civilian ground. Drive him away from the platform.'),
      ], 'c3-captain-kaji'),
      stage('post-the-worker-total', 'sdg-salt-warehouse', 'council', 5, 'Post the corrected total with a method workers can audit.', [
        dialogue('AYA', 'Names only where workers consented. Stitch counts for everyone else.'),
        dialogue('PORTER NAMI', 'And unpaid weight in a separate column.'),
        dialogue('GENTA', 'A debt the warehouse owes, not a shame the workers carry.'),
        dialogue('PORTER', 'Leave room for tomorrow\'s crews to challenge our arithmetic.'),
      ]),
    ],
    choice: choice('post-the-worker-total', 'What should happen to the parallel weight book?', [
      option('porters-retain-weight-book', 'Return the original to the porters.', 'Workers keep the source book while a method-only copy enters Aya\'s archive.'),
      option('post-weight-book-facsimile', 'Post a witnessed facsimile.', 'The public sees Kaji\'s discrepancy while private worker notes remain covered.'),
    ]),
    reward: reward(260, 118, [['Ward Tonic', 2]], ['Auditable weight table']),
    resolution: 'The porters establish the missing labor and unpaid weight through their own measurement practice.',
  }),

  chronicle({
    id: 'wc-c4-tomoes-tide-list',
    title: 'Tomoe\'s Tide List',
    chapterId: 'chapter-4',
    opensAfterBeatId: 'c4-01-nets-in-fog',
    setup: 'Tomoe tracks which boats may safely enter the fog, including boats withheld for village rescue rather than the party\'s expedition.',
    stages: [
      stage('hear-the-boat-limits', 'ngi-fishing-village', 'council', 6, 'Record each boat offer together with its non-negotiable limit.', [
        dialogue('TOMOE', 'One skiff can guide you. Two remain for anyone the fog sends home.'),
        dialogue('NIKOLA', 'We could reach the wreck faster with all three.'),
        dialogue('KIKU', 'And leave no village boat for the people already here.'),
        dialogue('REN', 'One guide skiff, then. The expedition fits the village\'s limit.'),
      ]),
      stage('clear-the-net-anchors', 'ngi-tide-caves', 'combat', 9, 'Clear the canonical Fog Nets while preserving marked working rope.', [
        dialogue('TOMOE', 'White knot is working rope. Black knot stays where the family tied it.'),
        dialogue('REN', 'We cut only the bell-fouled strands.'),
        dialogue('AYA', 'Cold current is opening. Move after the warning fades.'),
        dialogue('NIKOLA', 'North anchor loosening. I will mark it without touching the memorial knot.'),
      ], 'c4-fog-nets'),
      stage('read-the-return-cuts', 'ngi-wrecked-carrack', 'inspect', 5, 'Inspect hull cuts that show which boats returned under their own crews.', [
        dialogue('NIKOLA', 'My family journal calls these boats deserters.'),
        dialogue('TOMOE', 'These cuts mean they carried survivors against the reef.'),
        dialogue('NIKOLA', 'Then the journal mistook rescue for retreat.'),
        dialogue('TOMOE', 'Ask the hull before you ask an officer who wanted every boat for himself.'),
      ]),
      stage('revise-the-tide-list', 'ngi-wrecked-carrack', 'archive', 4, 'Add the rescue boats without exposing current evacuation coves.', [
        dialogue('AYA', 'We can name the action and omit the living route.'),
        dialogue('TOMOE', 'Name the crews who agreed. Leave a line for the boat we cannot identify.'),
        dialogue('NIKOLA', 'And I will correct the Dražanić copy in my own hand.'),
        dialogue('KIKU', 'The village keeps the full cove list; our correction needs no such danger.'),
      ]),
    ],
    choice: choice('revise-the-tide-list', 'How should Nikola correct the inherited journal?', [
      option('lise-adds-visible-margin', 'Write the correction in its margin.', 'The old error remains visible beside testimony from the village.'),
      option('lise-inserts-witness-leaf', 'Insert a separate witness leaf.', 'Tomoe\'s tide list stands in its own voice rather than beneath Dražanić text.'),
    ]),
    reward: reward(300, 132, [['River Salve', 2]], ['Revised tide list']),
    resolution: 'The record recognizes local rescue work and Nikola changes an inherited accusation without claiming ownership of the testimony.',
  }),

  chronicle({
    id: 'wc-c4-weather-in-the-hold',
    title: 'Weather Written in the Hold',
    chapterId: 'chapter-4',
    opensAfterBeatId: 'c4-03-varga-journal',
    setup: 'Survivors in the wreck marked storms, fever, and shared rations on cargo boards, contradicting an officer\'s story of mutiny.',
    stages: [
      stage('learn-the-weather-marks', 'ngi-fishing-village', 'interview', 5, 'Ask survivor Hama to explain only the marks she chooses to share.', [
        dialogue('HAMA', 'Crossed wave means storm. Open circle means someone shared water.'),
        dialogue('KIKU', 'And the closed circles?'),
        dialogue('HAMA', 'Those names are not for your book yet.'),
        dialogue('AYA', 'Then I copy the legend and leave every closed circle unexpanded.'),
      ]),
      stage('verify-the-freshwater-line', 'ngi-tide-caves', 'inspect', 5, 'Compare mineral lines with the hold board\'s water record.', [
        dialogue('AYA', 'The pool rose on the date they recorded sharing.'),
        dialogue('REN', 'The officer wrote that the crew stole his stores.'),
        dialogue('HAMA', 'His stores were rain in a broken barrel.'),
        dialogue('KIKU', 'The mineral line can support the water level, not tell us who lifted the cup.'),
      ]),
      stage('recover-the-cargo-board', 'ngi-wrecked-carrack', 'archive', 6, 'Stabilize the ordinary cargo board without opening private letters.', [
        dialogue('NIKOLA', 'The board belongs with the people who survived it.'),
        dialogue('HAMA', 'Make a rubbing. The wood comes back to the village.'),
        dialogue('AYA', 'Your custody, our copy, and the closed circles remain closed.'),
        dialogue('REN', 'I will brace the split edge while Hama decides where the paper touches.'),
      ]),
      stage('name-the-shared-rations', 'ngi-wrecked-carrack', 'council', 5, 'Let survivors decide whether individual names or a collective credit appears.', [
        dialogue('HAMA', 'Some want their names. Some survived under names they no longer use.'),
        dialogue('KIKU', 'Then one line cannot answer for everyone.'),
        dialogue('REN', 'We can record both the named hands and the unnamed circle.'),
        dialogue('NIKOLA', 'And the officer\'s accusation stays beside the correction where readers can see it fail.'),
      ]),
    ],
    choice: choice('name-the-shared-rations', 'How should the ration-sharing entry be written?', [
      option('weather-board-mixed-attribution', 'Use names plus an unnamed circle.', 'Consenting survivors are named and others receive collective credit without exposure.'),
      option('weather-board-collective-attribution', 'Credit the whole hold collectively.', 'No individual is singled out; the shared act remains part of the record.'),
    ]),
    reward: reward(285, 126, [['Ward Tonic', 2]], ['Hold weather rubbing']),
    resolution: 'A mundane survival record overturns the mutiny claim while survivors determine attribution.',
  }),

  chronicle({
    id: 'wc-c5-kiln-shift',
    title: 'The Kiln Workers\' Missing Shift',
    chapterId: 'chapter-5',
    opensAfterBeatId: 'c5-01-requisition-town',
    setup: 'Genbei\'s kiln crew vanished from the requisition ledger after refusing to cast bell braces during a funeral watch.',
    stages: [
      stage('hear-the-shift-roll', 'kgr-requisition-town', 'interview', 5, 'Let workers reconstruct the shift from work tasks rather than court categories.', [
        dialogue('GENBEI', 'Maro stacked charcoal. Ichi watched the draft. Suna measured clay.'),
        dialogue('AYA', 'The court ledger says the shift never reported.'),
        dialogue('KILN WORKER', 'We reported to each other. That is how the kiln stayed alive.'),
        dialogue('GENBEI', 'Write the tasks first. The court erased people by erasing their work.'),
      ]),
      stage('release-the-ash-route', 'kgr-ash-fields', 'combat', 9, 'Complete the canonical Ashen Release so workers can reach the cooling channel.', [
        dialogue('REN', 'The name slip is pulling the patrol together.'),
        dialogue('GENBEI', 'Return it to water. Do not bring us ash as proof.'),
        dialogue('KIKU', 'We hold the route; Genbei performs the release.'),
        dialogue('KILN WORKER', 'The cooling channel is ready. We will say the name beyond the battle line.'),
      ], 'c5-ashen-release'),
      stage('measure-the-cooled-braces', 'kgr-archive-furnace', 'inspect', 5, 'Measure rejected braces after the furnace warning grate fades.', [
        dialogue('GENBEI', 'These bends were deliberate. A command bell hung from them would crack.'),
        dialogue('GENTA', 'Sabotage in the work, not a glorious charge.'),
        dialogue('AYA', 'And the makers decide whether that fact becomes public.'),
        dialogue('KILN WORKER', 'Measure the bend, but do not straighten what protected us.'),
      ]),
      stage('restore-the-shift-line', 'kgr-archive-furnace', 'archive', 4, 'Write the missing shift into a worker-owned requisition copy.', [
        dialogue('KILN WORKER', 'Write that we withheld the braces. Do not write who made each bend.'),
        dialogue('GENBEI', 'The court can know the shift resisted, not whom to punish.'),
        dialogue('AYA', 'Collective action, protected hands.'),
        dialogue('GENTA', 'I will testify that the defect stopped a military order, without naming a maker.'),
      ]),
    ],
    choice: choice('restore-the-shift-line', 'How visible should the brace refusal become?', [
      option('kiln-posts-collective-refusal', 'Post the shift\'s collective refusal.', 'The town sees that workers acted together, while individual roles stay private.'),
      option('kiln-seals-refusal-for-tribunal', 'Seal it for later testimony.', 'Genbei holds the statement until workers judge a public hearing safe.'),
    ]),
    reward: reward(390, 165, [['River Salve', 2]], ['Kiln shift roll']),
    resolution: 'The missing workers re-enter the record on terms that protect the people behind the resistance.',
  }),

  chronicle({
    id: 'wc-c5-gentas-supply-mark',
    title: 'The Mark Genta Carried',
    chapterId: 'chapter-5',
    opensAfterBeatId: 'c5-03-cipher-room',
    setup: 'A supply mark in Genta\'s old hand connects his unit to prison materials. He agrees to trace it without asking workers to soften his responsibility.',
    stages: [
      stage('identify-the-quartermark', 'kgr-requisition-town', 'archive', 5, 'Compare Genta\'s remembered mark with public coal and rope tallies.', [
        dialogue('GENTA', 'That hook stroke is mine. I approved the quartermaster\'s copy.'),
        dialogue('GENBEI', 'Then say what the rope became.'),
        dialogue('GENTA', 'Prison bindings. I did not inspect them, and I chose not to ask.'),
        dialogue('AYA', 'We will distinguish the mark you made from the use you enabled.'),
      ]),
      stage('walk-the-declared-route', 'kgr-ash-fields', 'escort', 6, 'Follow the open supply route with two worker witnesses setting the stops.', [
        dialogue('KILN WORKER', 'We stop at the cooling channel. The north path is not yours to map.'),
        dialogue('REN', 'We need the delivery chain, not every way through your fields.'),
        dialogue('GENTA', 'I will follow the boundary I once ignored.'),
        dialogue('GENBEI', 'At each stop, a worker speaks before the former officer does.'),
      ]),
      stage('compare-prison-fasteners', 'kgr-archive-furnace', 'inspect', 5, 'Compare discarded fasteners with the marked requisition batch.', [
        dialogue('AYA', 'Same hook stroke, same flawed count of twelve.'),
        dialogue('GENTA', 'The unit received eighteen. Six were never entered.'),
        dialogue('GENBEI', 'Then six families were billed for iron the prison already owned.'),
        dialogue('KILN WORKER', 'We kept the broken fastener because its number contradicted the invoice.'),
      ]),
      stage('sign-a-specific-account', 'kgr-archive-furnace', 'interview', 5, 'Record Genta\'s acts, omissions, and uncertainties as separate statements.', [
        dialogue('GENTA', 'I signed the order. I did not forge the family bills. I benefited from not looking.'),
        dialogue('AYA', 'Three statements, each testable.'),
        dialogue('GENBEI', 'Accountability begins where excuses stop combining them.'),
        dialogue('GENTA', 'I will answer each statement separately, including what I still cannot prove.'),
      ]),
    ],
    choice: choice('sign-a-specific-account', 'Who should present Genta\'s account if a tribunal opens?', [
      option('workers-present-genta-account', 'Let the kiln workers present it.', 'Affected workers frame the evidence and question Genta in public.'),
      option('genta-reads-account-under-questions', 'Have Genta read it under questions.', 'Genta speaks his responsibility directly while workers control the questions.'),
    ]),
    reward: reward(410, 176, [['Ward Tonic', 2]], ['Specific supply account']),
    resolution: 'Genta names his choices precisely and gives those affected control over how the testimony is used.',
  }),

  chronicle({
    id: 'wc-c6-rins-running-edition',
    title: 'Rin\'s Running Edition',
    chapterId: 'chapter-6',
    opensAfterBeatId: 'c6-02-three-copies',
    setup: 'Rin proposes an edition that prints corrections while the evidence is still moving, so no single seized block can become the final truth.',
    stages: [
      stage('set-the-correction-signs', 'kzu-printmaker-lane', 'archive', 5, 'Set visible symbols for confirmed, disputed, and withheld lines.', [
        dialogue('RIN', 'Square for confirmed. Open circle for disputed. Blank rule for withheld.'),
        dialogue('AYA', 'A blank must say why it is blank, or readers invent certainty.'),
        dialogue('REN', 'Then every omission carries its status, not a guessed name.'),
        dialogue('RIN', 'I will cut the key into every block so a seized page cannot lose its legend.'),
      ]),
      stage('defend-the-moving-blocks', 'kzu-archive-roof', 'combat', 9, 'Clear the canonical Masked Clerks while the print blocks remain in motion.', [
        dialogue('RIN', 'They are marking the north block for seizure.'),
        dialogue('NIKOLA', 'Keep moving. Their line commits before it turns.'),
        dialogue('AYA', 'Protect the courier, not the perfect page.'),
        dialogue('REN', 'South stair is clear. The blocks leave in different hands.'),
      ], 'c6-masked-clerks'),
      stage('read-a-disputed-line', 'kzu-public-tribunal', 'council', 6, 'Let witnesses test one disputed line before a public audience.', [
        dialogue('WITNESS ITO', 'The page says I arrived alone. My sister was beside me.'),
        dialogue('RIN', 'Do you want her name printed?'),
        dialogue('WITNESS ITO', 'Not while she is in hiding. Print that the count is disputed.'),
        dialogue('AYA', 'The correction records another person without turning a safe absence into a name.'),
      ]),
      stage('dispatch-the-revision-key', 'kzu-canal-lock', 'deliver', 5, 'Send the correction symbols with all three evidence routes.', [
        dialogue('REN', 'North boat has the key. Central courier has it. South boat confirms.'),
        dialogue('AYA', 'No copy is final merely because it left first.'),
        dialogue('RIN', 'Good. A running edition should know how to change.'),
        dialogue('COURIER', 'Each route will report its edition number before accepting a correction.'),
      ]),
    ],
    choice: choice('dispatch-the-revision-key', 'How should later corrections authenticate themselves?', [
      option('witness-pairs-sign-revisions', 'Require two witness marks.', 'Revisions travel when two affected witnesses approve the exact changed line.'),
      option('community-boards-sign-revisions', 'Use rotating community boards.', 'Local boards authenticate revisions without creating one permanent authority.'),
    ]),
    reward: reward(520, 215, [['River Salve', 2], ['Ward Tonic', 2]], ['Running-edition key']),
    resolution: 'The evidence network gains a transparent correction method without a master copy or permanent gatekeeper.',
  }),

  chronicle({
    id: 'wc-c6-the-empty-chair',
    title: 'The Empty Chair at Tribunal',
    chapterId: 'chapter-6',
    opensAfterBeatId: 'c6-03-tribunal',
    setup: 'A chair reserved for an absent witness becomes a dispute: some want the statement read; others insist absence must not become consent.',
    stages: [
      stage('confirm-the-witness-limit', 'kzu-printmaker-lane', 'interview', 5, 'Ask the witness\'s chosen courier what was and was not authorized.', [
        dialogue('COURIER SENA', 'They allowed the date and the seizure mark. They did not allow the family name.'),
        dialogue('AYA', 'Did they ask anyone to read it aloud?'),
        dialogue('COURIER SENA', 'No. They asked that the paper be available if challenged.'),
        dialogue('KIKU', 'Then availability is the permission. Performance is not.'),
        dialogue('REN', 'We can seal the name under a cover that states the limit.'),
      ]),
      stage('keep-the-chair-empty', 'kzu-public-tribunal', 'council', 7, 'Present the authorized facts without performing the absent witness.', [
        dialogue('TRIBUNAL CLERK', 'An empty chair proves nothing.'),
        dialogue('COURIER SENA', 'It proves someone declined your room and still supplied evidence.'),
        dialogue('KIKU', 'Absence is not silence for us to fill.'),
        dialogue('AYA', 'The date and seizure mark stand on their sources, not on a staged presence.'),
        dialogue('TRIBUNAL CLERK', 'Then the index must show exactly what remains sealed.'),
      ]),
      stage('route-the-sealed-copy', 'kzu-canal-lock', 'deliver', 5, 'Send the sealed statement by the route its author selected.', [
        dialogue('REN', 'Blue wrap, south boat, opened only under a direct challenge.'),
        dialogue('AYA', 'The public index lists its limits without revealing the line.'),
        dialogue('COURIER SENA', 'Then the witness remains the author, even from elsewhere.'),
        dialogue('KIKU', 'And the courier remains a courier, not a substitute voice.'),
        dialogue('REN', 'The seal number matches the public index. The route can depart.'),
        dialogue('COURIER SENA', 'I will return any answer by the same bounded path.'),
      ]),
    ],
    choice: choice('keep-the-chair-empty', 'What should the tribunal record beside the empty chair?', [
      option('record-withheld-presence', 'Record “presence withheld.”', 'The record acknowledges deliberate absence without implying fear or agreement.'),
      option('record-evidence-by-courier', 'Credit evidence delivered by courier.', 'The courier\'s limited role is visible and the absent witness is not impersonated.'),
    ]),
    reward: reward(480, 200, [['Ward Tonic', 2]], ['Limited testimony index']),
    resolution: 'The tribunal learns to receive bounded evidence without converting absence into permission.',
  }),

  chronicle({
    id: 'wc-c7-noes-road-count',
    title: 'Noe\'s Road Count',
    chapterId: 'chapter-7',
    opensAfterBeatId: 'c7-01-decision-map-table',
    setup: 'Noe knows how many travelers use the Hushroad but refuses to mark their shelters. The party helps make a rescue count without a pursuit map.',
    stages: [
      stage('separate-people-from-shelters', 'hsh-map-table', 'archive', 5, 'Count rescue capacity while removing shelter coordinates.', [
        dialogue('NOE', 'Twenty-three people used the road. The map does not need to say where they slept.'),
        dialogue('AYA', 'We need enough boats and food, not a trail to every door.'),
        dialogue('GENTA', 'Then capacity travels and locations remain here.'),
        dialogue('NOE', 'Even I keep only the next safe handoff, never the whole chain.'),
      ]),
      stage('hear-the-post-town-count', 'hsh-post-town', 'interview', 5, 'Let former retainers and road keepers submit separate counts.', [
        dialogue('FORMER RETAINER', 'I counted nine at the west shed.'),
        dialogue('NOE', 'The west shed is a signal name, not a place for your map.'),
        dialogue('FORMER RETAINER', 'Understood. Nine needing passage, location withheld.'),
        dialogue('REN', 'We will compare totals without joining the shelter names.'),
      ]),
      stage('release-the-ferry-patrol', 'hsh-prison-ferry', 'combat', 9, 'Complete the canonical Name Slip Release before loading rescue boats.', [
        dialogue('REN', 'The slip is bound to the patrol at the chain wall.'),
        dialogue('NOE', 'Return the name north. The current does the carrying.'),
        dialogue('NIKOLA', 'We open the lane and leave no trophy behind.'),
        dialogue('GENTA', 'Boat crews wait beyond the post. Our recovery ends before they enter.'),
      ], 'c7-name-slip-release'),
      stage('post-capacity-not-routes', 'hsh-bell-aqueduct', 'deliver', 5, 'Post boat and medicine capacity without shelter positions.', [
        dialogue('KIKU', 'Two boats, six walking escorts, medicine for thirty.'),
        dialogue('NOE', 'Enough to prepare, not enough to pursue.'),
        dialogue('AYA', 'A rescue count that refuses to become a hunting map.'),
        dialogue('FORMER RETAINER', 'I will guard the board and forget every shelter name I do not need.'),
      ]),
    ],
    choice: choice('post-capacity-not-routes', 'Who may update the public capacity board?', [
      option('road-keepers-update-capacity', 'Authorize rotating road keepers.', 'Local keepers update capacity while no single person holds every route.'),
      option('care-teams-update-capacity', 'Authorize care teams at departure.', 'Boat and clinic teams update only the resources they directly control.'),
    ]),
    reward: reward(680, 270, [['River Salve', 2], ['Ward Tonic', 2]], ['Route-safe rescue count']),
    resolution: 'The rescue can be provisioned without exposing the places that made survival possible.',
  }),

  chronicle({
    id: 'wc-c8-boats-before-banners',
    title: 'Boats Before Banners',
    chapterId: 'chapter-8',
    opensAfterBeatId: 'c8-01-three-homecomings',
    setup: 'Hoshigawa\'s runners receive three competing reports about assault supplies. They insist evacuation capacity be counted before any banner crosses the Black Gate.',
    stages: [
      stage('receive-the-three-reports', 'c8-hoshigawa-return', 'council', 7, 'Hear boat, medicine, and rope reports with each community\'s stated limits.', [
        dialogue('ARCHIVE RUNNER', 'Sodegaura offers two boats and keeps one quay defended.'),
        dialogue('KIKU', 'Takamine offers tent cloth, not its evacuation stores.'),
        dialogue('REN', 'Hoshigawa offers runners who choose their own routes.'),
        dialogue('ARCHIVE RUNNER', 'Each report carries a refusal in the same size of ink as its offer.'),
      ]),
      stage('build-the-evacuation-column', 'c8-hoshigawa-return', 'archive', 5, 'Put evacuation capacity before assault supplies on the command sheet.', [
        dialogue('GENTA', 'Command sheets usually begin with fighters.'),
        dialogue('ARCHIVE RUNNER', 'Then this one begins with who can leave and who needs carrying.'),
        dialogue('GENTA', 'Agreed. A breach without an exit is only another order.'),
        dialogue('KIKU', 'Count people who cannot walk before counting anyone assigned to a wall.'),
      ]),
      stage('hold-the-civilian-lane', 'c8-black-gate', 'combat', 10, 'Clear the canonical Outer Court while keeping the evacuation lane open.', [
        dialogue('NIKOLA', 'Court line turning toward the lantern wagons.'),
        dialogue('REN', 'Draw it east. The west lane belongs to evacuees.'),
        dialogue('KIKU', 'The care teams move on their own signal, not ours.'),
        dialogue('GENTA', 'I anchor the east tiles. No unit crosses the marked civilian lane.'),
      ], 'c8-outer-court'),
      stage('post-the-limits-first', 'c8-black-gate', 'deliver', 5, 'Post every withheld resource above the assault allotment.', [
        dialogue('ARCHIVE RUNNER', 'One quay withheld. Evacuation stores withheld. Runner routes withheld.'),
        dialogue('GENTA', 'Limits at the top, contributions beneath.'),
        dialogue('KIKU', 'Now no commander can call consent a footnote.'),
        dialogue('REN', 'Copies go to the gate, the clinic, and every contributing council.'),
      ]),
    ],
    choice: choice('post-the-limits-first', 'Who can alter a community limit during the breach?', [
      option('only-origin-community-alters-limit', 'Only that community\'s delegate.', 'No commander can spend a withheld resource without renewed local consent.'),
      option('two-community-delegates-confirm-limit', 'Require two affected delegates.', 'A limit changes only when the contributing and receiving communities both agree.'),
    ]),
    reward: reward(860, 340, [['River Salve', 3], ['Ward Tonic', 2]], ['Evacuation-first command sheet']),
    resolution: 'The breach plan treats evacuation and consent as operating constraints rather than ceremonial promises.',
  }),

  chronicle({
    id: 'wc-c9-the-custody-circle',
    title: 'The Custody Circle',
    chapterId: 'chapter-9',
    opensAfterBeatId: 'c9-01-archive-breathes',
    setup: 'People named in Ujiro\'s records form a custody circle to decide what happens to him and to the evidence he controlled.',
    stages: [
      stage('break-the-catalogue-nodes', 'krh-outer-archive', 'combat', 10, 'Complete the canonical Archive Nodes encounter without destroying witness indexes.', [
        dialogue('AYA', 'Three command nodes, but the plain shelves stay standing.'),
        dialogue('REN', 'Break the black joints and keep the breathing index clear.'),
        dialogue('WITNESS KAE', 'We will identify our records after the noise stops.'),
        dialogue('GENTA', 'North node warning. Witnesses remain behind the unmarked shelf.'),
        dialogue('AYA', 'The catalogue line is opening; strike only after its pulse resolves.'),
      ], 'c9-archive-nodes'),
      stage('set-custody-questions', 'krh-outer-archive', 'council', 6, 'Let the custody circle set the questions before confronting Ujiro.', [
        dialogue('WITNESS KAE', 'First: who gave him names. Second: where the living were moved.'),
        dialogue('GENTA', 'And punishment?'),
        dialogue('WITNESS KAE', 'After rescue. He does not get to make urgency serve him again.'),
        dialogue('AYA', 'The circle sets sequence, custody, and who may hear each answer.'),
        dialogue('WITNESS', 'Add a third question: which records he knows are false.'),
      ]),
      stage('confront-with-copies', 'krh-observatory', 'interview', 7, 'Question Ujiro with distributed copies and record refusals as refusals.', [
        dialogue('UJIRO', 'Without my order the archive becomes rumor.'),
        dialogue('WITNESS KAE', 'Without your order, we can finally compare what each of us knows.'),
        dialogue('AYA', 'Answer the movement question. Authority is not the subject.'),
        dialogue('UJIRO', 'The conservatory received the unnumbered transports.'),
        dialogue('WITNESS', 'Then name the route, and do not name a captive as your source.'),
        dialogue('GENTA', 'His answer is recorded as a claim until the rescue teams confirm it.'),
      ]),
    ],
    choice: choice('confront-with-copies', 'What immediate custody does the circle choose?', [
      option('ujiro-held-by-rotating-custodians', 'Use rotating civilian custodians.', 'No former court unit controls Ujiro or his access to the records.'),
      option('ujiro-held-under-public-watch', 'Hold him beside the public index.', 'Witnesses can question him in scheduled sessions while rescue information stays accessible.'),
    ]),
    reward: reward(1080, 430, [['River Salve', 3], ['Ward Tonic', 3]], ['Custody circle questions']),
    resolution: 'Those harmed by Ujiro\'s archive determine immediate custody and place rescue before spectacle.',
  }),

  chronicle({
    id: 'wc-c9-six-ordinary-refusals',
    title: 'Six Ordinary Refusals',
    chapterId: 'chapter-9',
    opensAfterBeatId: 'c9-03-conservatory-offers',
    setup: 'After Kurozane\'s grand offers, six workers record quieter refusals that kept people alive: a delayed cart, a blank line, a misplaced key.',
    stages: [
      stage('hear-the-audience-workers', 'krh-audience-hall', 'interview', 6, 'Hear workers separately so no single heroic account replaces the others.', [
        dialogue('HALL KEEPER', 'I polished every door except the one hiding the medicine room.'),
        dialogue('COPYIST', 'I left one line blank each night. Sometimes a blank was enough.'),
        dialogue('MATEUS', 'I called such acts small because admitting their cost would expose mine.'),
        dialogue('ATTENDANT', 'I delayed the collection cart by reporting a wheel that was not broken.'),
      ]),
      stage('mark-the-withheld-keys', 'krh-blood-conservatory', 'inspect', 5, 'Match ordinary work keys to doors workers chose not to open for the court.', [
        dialogue('KIKU', 'This key fits the cold cabinet.'),
        dialogue('ATTENDANT', 'It was always missing during collection rounds.'),
        dialogue('REN', 'Missing by a hand, not by luck.'),
        dialogue('HALL KEEPER', 'Put it back on the hook now. Medicine workers still need an ordinary key.'),
      ]),
      stage('carry-the-refusals-upward', 'krh-bell-spine', 'escort', 6, 'Escort the witness packet through declared pulse tiles without making workers join combat.', [
        dialogue('NIKOLA', 'Pulse on the lacquer lane. Wait, then cross.'),
        dialogue('COPYIST', 'We carry our own packet. You keep the path readable.'),
        dialogue('GENTA', 'Your testimony stays in your hands.'),
        dialogue('ATTENDANT', 'The rear pulse is fading. We move together on the next clear tile.'),
      ]),
      stage('survive-the-yearless-bell', 'krh-observatory', 'combat', 11, 'Complete the canonical Yearless Bell encounter while preserving the witness packet.', [
        dialogue('AYA', 'The bell is pulling every refusal into one accusation.'),
        dialogue('REN', 'Then we answer with six accounts, not one legend.'),
        dialogue('HALL KEEPER', 'We are behind the dawn wall. Finish what only you can fight.'),
        dialogue('MATEUS', 'I will hold the ward line and leave their words untouched.'),
      ], 'c9-yearless-bell'),
    ],
    choice: choice('survive-the-yearless-bell', 'How should the six accounts appear in the public archive?', [
      option('publish-six-separate-refusals', 'Keep all six accounts separate.', 'Each worker retains voice, uncertainty, and control over attribution.'),
      option('publish-refusal-methods-index', 'Publish an anonymous methods index.', 'Other communities can recognize everyday resistance while identities stay protected.'),
    ]),
    reward: reward(1160, 470, [['River Salve', 3], ['Ward Tonic', 3]], ['Six-refusal packet']),
    resolution: 'The archive remembers ordinary, distributed resistance without manufacturing a single spotless hero.',
  }),

  chronicle({
    id: 'wc-e-the-first-disagreement',
    title: 'The Archive\'s First Disagreement',
    chapterId: 'epilogue',
    opensAfterBeatId: 'e00-open-archive',
    setup: 'On its first public morning, the archive receives two honest but incompatible accounts of a family\'s arrival. Aya refuses to force an immediate verdict.',
    stages: [
      stage('hear-both-arrivals', 'epi-hoshigawa-archive', 'interview', 6, 'Hear the two accounts separately, with equal space and no cross-examination by the crowd.', [
        dialogue('WITNESS JUN', 'They arrived before the river froze. I shared the south room.'),
        dialogue('WITNESS EMI', 'After the thaw. I remember because my son carried the medicine.'),
        dialogue('AYA', 'Both memories enter as testimony, neither as a charge.'),
        dialogue('WITNESS JUN', 'I do not need Emi to be careless for my winter to be true.'),
        dialogue('WITNESS EMI', 'And I do not need Jun to be lying for my spring to remain.'),
      ]),
      stage('check-the-ordinary-receipts', 'epi-hoshigawa-archive', 'archive', 5, 'Compare meal tallies and repair receipts without treating either as perfect memory.', [
        dialogue('REN', 'The meal tally supports winter. The roof receipt supports spring.'),
        dialogue('KIKU', 'Or the family moved rooms. Documents can disagree without a liar.'),
        dialogue('WITNESS JUN', 'I can live beside that uncertainty.'),
        dialogue('WITNESS EMI', 'Ask whether the roof was repaired twice before asking us to choose one memory.'),
        dialogue('AYA', 'The receipt names a roof, not the room beneath it. Its limit goes in the note.'),
      ]),
      stage('open-a-disputed-margin', 'epi-takamine-tower', 'deliver', 5, 'Post both accounts in a revisable disputed margin.', [
        dialogue('WITNESS EMI', 'Do not make my son\'s medicine prove a date I cannot prove.'),
        dialogue('AYA', 'The margin will say what supports each account and what remains unknown.'),
        dialogue('REN', 'The first disagreement stays open. That is part of opening the archive.'),
        dialogue('WITNESS JUN', 'Leave space for the family to answer if they ever choose.'),
        dialogue('KIKU', 'And no runner will seek them merely to settle our page.'),
        dialogue('AYA', 'The margin opens with two accounts, two limits, and no forced verdict.'),
      ]),
    ],
    choice: choice('open-a-disputed-margin', 'When should the archive revisit the entry?', [
      option('review-when-new-witness-arrives', 'When a new witness volunteers.', 'The entry remains open without pressuring either witness to resolve it.'),
      option('review-at-seasonal-archive-day', 'At the next seasonal review.', 'A scheduled public review prevents the disagreement from quietly disappearing.'),
    ]),
    reward: reward(540, 380, [['River Salve', 2], ['Ward Tonic', 2]], ['First disputed margin']),
    resolution: 'The public archive demonstrates that repair can preserve disagreement instead of manufacturing certainty.',
  }),
];

const CHRONICLE_KEYS = Object.freeze([
  'kind', 'repeatable', 'id', 'title', 'chapterId', 'opensAfterBeatId', 'setup', 'stages',
  'choice', 'reward', 'resolution', 'estimatedMinutes', 'navigation',
]);
const STAGE_KEYS = Object.freeze(['id', 'mapId', 'encounterId', 'activity', 'dialogue']);
const ACTIVITY_KEYS = Object.freeze(['type', 'minutes', 'instruction']);
const CHOICE_KEYS = Object.freeze(['stageId', 'prompt', 'options']);
const OPTION_KEYS = Object.freeze(['id', 'label', 'consequence']);
const CONSEQUENCE_KEYS = Object.freeze(['flag', 'summary']);
const REWARD_KEYS = Object.freeze(['xpPerMember', 'currency', 'items', 'keyItems']);
const ITEM_KEYS = Object.freeze(['name', 'quantity']);
const NAVIGATION_KEYS = Object.freeze(['backtrackingRequired', 'abilityGate', 'accessRule']);
const ACTIVITY_TYPES = new Set(['interview', 'inspect', 'archive', 'deliver', 'combat', 'council', 'escort']);
const ACTIVITY_MINIMUMS = Object.freeze({ interview: 5, inspect: 4, archive: 4, deliver: 4, combat: 9, council: 5, escort: 6 });
const SACRED_REWARD_TERMS = /\b(?:altar|chapel|crucifix|relic|reliquary|rosary|scripture|sutra|icon|tabernacle)\b/i;

const levelGraph = new Map(LEVELS.map((level) => [level.id, new Set((level.exits ?? []).map((exit) => exit.destinationLevelId))]));

function isForwardReachable(fromId, toId) {
  if (fromId === toId) return true;
  const seen = new Set([fromId]);
  const pending = [fromId];
  while (pending.length) {
    const current = pending.shift();
    for (const next of levelGraph.get(current) ?? []) {
      if (next === toId) return true;
      if (!seen.has(next)) {
        seen.add(next);
        pending.push(next);
      }
    }
  }
  return false;
}

function filledString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Strictly validates one chronicle against the live campaign, map, and encounter catalogs. */
export function validateWitnessChronicle(entry) {
  const errors = [];
  const fail = (message) => errors.push(`${entry?.id ?? 'unknown chronicle'}: ${message}`);
  if (!exactKeys(entry, CHRONICLE_KEYS)) fail('unsupported or missing chronicle keys.');
  if (entry?.kind !== 'finite-witness-chronicle' || entry?.repeatable !== false) fail('must be explicitly finite and non-repeatable.');
  if (!/^wc-[a-z0-9-]+$/.test(entry?.id ?? '')) fail('id must use the wc- slug format.');
  for (const [field, value] of [['title', entry?.title], ['setup', entry?.setup], ['resolution', entry?.resolution]]) {
    if (!filledString(value)) fail(`${field} must be non-empty.`);
  }

  const chapter = CAMPAIGN.chapters.find((candidate) => candidate.id === entry?.chapterId);
  if (!chapter) fail('chapterId is not canonical.');
  if (!chapter?.beats.some((beat) => beat.id === entry?.opensAfterBeatId)) fail('opensAfterBeatId is not a beat in the same chapter.');

  if (!Array.isArray(entry?.stages) || entry.stages.length < 3 || entry.stages.length > 5) {
    fail('must contain 3-5 ordered stages.');
  } else {
    const stageIds = new Set();
    let priorMapId = null;
    let dialogueCount = 0;
    entry.stages.forEach((current, index) => {
      if (!exactKeys(current, STAGE_KEYS)) fail(`stages[${index}] has unsupported keys.`);
      if (!filledString(current?.id) || stageIds.has(current?.id)) fail(`stages[${index}].id must be unique and non-empty.`);
      stageIds.add(current?.id);
      const level = getLevel(current?.mapId);
      if (!level || level.chapterId !== entry.chapterId || !chapter?.maps.some((map) => map.id === current.mapId)) {
        fail(`stages[${index}].mapId must be a canonical campaign map in ${entry.chapterId}.`);
      }
      if (priorMapId && !isForwardReachable(priorMapId, current.mapId)) {
        fail(`stages[${index}].mapId is not forward-reachable from the prior stage.`);
      }
      priorMapId = current.mapId;

      if (!exactKeys(current?.activity, ACTIVITY_KEYS)) fail(`stages[${index}].activity has unsupported keys.`);
      const type = current?.activity?.type;
      if (!ACTIVITY_TYPES.has(type)) fail(`stages[${index}].activity.type is invalid.`);
      if (!Number.isSafeInteger(current?.activity?.minutes) || current.activity.minutes < (ACTIVITY_MINIMUMS[type] ?? 1) || current.activity.minutes > 14) {
        fail(`stages[${index}].activity.minutes is not a conservative bounded estimate.`);
      }
      if (!filledString(current?.activity?.instruction)) fail(`stages[${index}].activity.instruction is required.`);

      if (!Array.isArray(current?.dialogue) || current.dialogue.length < 3 || current.dialogue.length > 6) {
        fail(`stages[${index}].dialogue must contain 3-6 lines.`);
      } else {
        dialogueCount += current.dialogue.length;
        current.dialogue.forEach((line, lineIndex) => {
          if (!exactKeys(line, ['speaker', 'line']) || !filledString(line.speaker) || !filledString(line.line)) {
            fail(`stages[${index}].dialogue[${lineIndex}] is invalid.`);
          }
        });
      }

      if (current?.encounterId == null) {
        if (type === 'combat') fail(`stages[${index}] combat activity requires an encounter.`);
      } else {
        const encounter = getEncounter(current.encounterId);
        if (!encounter || encounter.chapterId !== entry.chapterId || encounter.levelId !== current.mapId) {
          fail(`stages[${index}].encounterId must be canonical and located on the stage map.`);
        }
        if (type !== 'combat') fail(`stages[${index}] with an encounter must use combat activity.`);
      }
    });
    if (dialogueCount < 16 || dialogueCount > 24) fail('must contain 16-24 dialogue lines across all stages.');
  }

  if (!exactKeys(entry?.choice, CHOICE_KEYS)) fail('choice has unsupported keys.');
  if (!entry?.stages?.some((current) => current.id === entry?.choice?.stageId)) fail('choice.stageId must identify one authored stage.');
  if (!filledString(entry?.choice?.prompt)) fail('choice.prompt is required.');
  if (!Array.isArray(entry?.choice?.options) || entry.choice.options.length !== 2) {
    fail('choice must have exactly two explicit options.');
  } else {
    const optionIds = new Set();
    entry.choice.options.forEach((current, index) => {
      if (!exactKeys(current, OPTION_KEYS) || !exactKeys(current?.consequence, CONSEQUENCE_KEYS)) fail(`choice.options[${index}] has unsupported keys.`);
      if (!filledString(current?.id) || optionIds.has(current.id)) fail(`choice.options[${index}].id must be unique.`);
      optionIds.add(current?.id);
      if (!filledString(current?.label) || !filledString(current?.consequence?.flag) || !filledString(current?.consequence?.summary)) {
        fail(`choice.options[${index}] requires a label and explicit consequence.`);
      }
    });
  }

  if (!exactKeys(entry?.reward, REWARD_KEYS)) fail('reward has unsupported keys.');
  if (!Number.isSafeInteger(entry?.reward?.xpPerMember) || entry.reward.xpPerMember < 0) fail('reward.xpPerMember is invalid.');
  if (!Number.isSafeInteger(entry?.reward?.currency) || entry.reward.currency < 0) fail('reward.currency is invalid.');
  if (!Array.isArray(entry?.reward?.items) || !Array.isArray(entry?.reward?.keyItems)) fail('reward item collections must be arrays.');
  for (const [index, item] of (entry?.reward?.items ?? []).entries()) {
    if (!exactKeys(item, ITEM_KEYS) || !filledString(item.name) || !Number.isSafeInteger(item.quantity) || item.quantity < 1) fail(`reward.items[${index}] is invalid.`);
    if (SACRED_REWARD_TERMS.test(item?.name ?? '')) fail(`reward.items[${index}] treats a sacred object as loot.`);
  }
  for (const [index, item] of (entry?.reward?.keyItems ?? []).entries()) {
    if (!filledString(item)) fail(`reward.keyItems[${index}] is invalid.`);
    if (SACRED_REWARD_TERMS.test(item ?? '')) fail(`reward.keyItems[${index}] treats a sacred object as loot.`);
  }

  const derivedMinutes = (entry?.stages ?? []).reduce((total, current) => total + (current?.activity?.minutes ?? 0), 0);
  if (entry?.estimatedMinutes !== derivedMinutes || !Number.isSafeInteger(entry?.estimatedMinutes)) fail('estimatedMinutes must equal the sum of concrete stage activities.');
  if (!exactKeys(entry?.navigation, NAVIGATION_KEYS)
    || entry.navigation.backtrackingRequired !== false
    || entry.navigation.abilityGate !== null
    || !filledString(entry.navigation.accessRule)) {
    fail('navigation must prohibit ability gates and mandatory backtracking.');
  }

  return deepFreeze({ ok: errors.length === 0, errors });
}

export function validateWitnessChronicleCatalog(catalog = AUTHORED_CHRONICLES) {
  const errors = [];
  if (!Array.isArray(catalog) || catalog.length !== 18) errors.push('Witness chronicle catalog must contain exactly 18 finite chronicles.');
  const ids = new Set();
  for (const entry of catalog ?? []) {
    const validation = validateWitnessChronicle(entry);
    errors.push(...validation.errors);
    if (ids.has(entry?.id)) errors.push(`Duplicate witness chronicle ID: ${entry.id}.`);
    ids.add(entry?.id);
  }
  for (const chapter of CAMPAIGN.chapters) {
    if (!(catalog ?? []).some((entry) => entry.chapterId === chapter.id)) errors.push(`No witness chronicle is authored for ${chapter.id}.`);
  }
  const combatCount = (catalog ?? []).filter((entry) => entry.stages.some((current) => current.encounterId)).length;
  if (combatCount < 6) errors.push('At least six chronicles must include a canonical combat encounter.');
  return deepFreeze({ ok: errors.length === 0, errors, combatCount });
}

const catalogValidation = validateWitnessChronicleCatalog(AUTHORED_CHRONICLES);
if (!catalogValidation.ok) throw new TypeError(catalogValidation.errors.join(' '));

export const WITNESS_CHRONICLES = deepFreeze(AUTHORED_CHRONICLES);

export function getWitnessChronicle(id) {
  return WITNESS_CHRONICLES.find((entry) => entry.id === id) ?? null;
}

export function getWitnessChroniclesForChapter(chapterId) {
  return WITNESS_CHRONICLES.filter((entry) => entry.chapterId === chapterId);
}

export function getWitnessChronicleMetrics() {
  const totalMinutes = WITNESS_CHRONICLES.reduce((sum, entry) => sum + entry.estimatedMinutes, 0);
  const lineCount = WITNESS_CHRONICLES.reduce(
    (sum, entry) => sum + entry.stages.reduce((stageSum, current) => stageSum + current.dialogue.length, 0),
    0,
  );
  const dialogueWordCount = WITNESS_CHRONICLES.reduce(
    (sum, entry) => sum + entry.stages.reduce(
      (stageSum, current) => stageSum + current.dialogue.reduce(
        (lineSum, currentLine) => lineSum + currentLine.line.trim().split(/\s+/u).filter(Boolean).length,
        0,
      ),
      0,
    ),
    0,
  );
  const stageCount = WITNESS_CHRONICLES.reduce((sum, entry) => sum + entry.stages.length, 0);
  const combatChronicles = WITNESS_CHRONICLES.filter((entry) => entry.stages.some((current) => current.encounterId)).length;
  const byChapter = Object.fromEntries(CAMPAIGN.chapters.map((chapter) => {
    const entries = getWitnessChroniclesForChapter(chapter.id);
    return [chapter.id, {
      chronicleCount: entries.length,
      estimatedMinutes: entries.reduce((sum, entry) => sum + entry.estimatedMinutes, 0),
    }];
  }));
  return deepFreeze({
    chronicleCount: WITNESS_CHRONICLES.length,
    stageCount,
    lineCount,
    dialogueWordCount,
    combatChronicles,
    totalMinutes,
    totalHours: Number((totalMinutes / 60).toFixed(2)),
    repeatableMinutes: 0,
    byChapter,
  });
}
