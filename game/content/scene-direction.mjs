/**
 * Bespoke presentation direction for every canonical campaign beat.
 *
 * These cues are renderer-agnostic: the campaign UI may translate them into
 * pixel staging, audio events, camera motion, or transition cards without this
 * module owning a DOM or a timing loop. The direction observes the campaign's
 * alternate-history guardrails: people remain subjects rather than scenery,
 * coerced testimony is never spectacle, and accountability is not absolution.
 */

import { CAMPAIGN } from './campaign.mjs';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function scene(chapterId, beatId, cues) {
  const [speaker, action] = cues.gestureCue;
  return {
    chapterId,
    beatId,
    atmosphere: cues.atmosphere,
    musicCue: cues.musicCue,
    cameraCue: cues.cameraCue,
    entranceCue: cues.entranceCue,
    gestureCue: { speaker, action },
    blockingCue: cues.blockingCue,
    transitionCue: cues.transitionCue,
  };
}

export const SCENE_DIRECTIONS = deepFreeze([
  scene('prologue', 'p00-delivery-in-rain', {
    atmosphere: 'Cold rain threads between shuttered homes; each covered lamp makes a small island in the lane.',
    musicCue: 'A dry three-note pluck answers the soft roof-rain, leaving long unclaimed silences.',
    cameraCue: 'Begin on the intact packet seal, then ease back until Ren and the waiting headman share the narrow frame.',
    entranceCue: 'Ren steps in from the river end, shielding the packet under his sleeve while the headman stays beneath the eave.',
    gestureCue: ['REN', 'Test the seal edge with one thumb, then lower the packet instead of offering it immediately.'],
    blockingCue: 'Keep a doorway between them, with warm interior light visible but no household member exposed in it.',
    transitionCue: 'Hold on rain beading over the seal; cut on the headman turning toward the altered order inside.',
  }),
  scene('prologue', 'p01-altered-order', {
    atmosphere: 'Porch lamplight catches wet ink that is darker and fresher than the original office hand.',
    musicCue: 'Low wooden taps enter beneath the rain motif, irregular as added marks in a ledger.',
    cameraCue: 'Track the page from Ren to the collector, then settle at table height so the disputed lines remain central.',
    entranceCue: 'The collector occupies the dry center of the porch; Ren and the headman arrive from opposite edges of the frame.',
    gestureCue: ['REN', 'Lay two fingers beside the added demand without touching or obscuring the original text.'],
    blockingCue: 'Place the collector behind the paper and the neighbors beyond Ren, making the public reading physically possible.',
    transitionCue: 'Follow the spoken order outward to listening windows, then pan toward Kiku crossing the side lane.',
  }),
  scene('prologue', 'p02-medicine-across-lane', {
    atmosphere: 'Steam from the clinic doorway briefly warms the blue rain; a corked bottle clicks against Kiku’s tray.',
    musicCue: 'The ledger taps recede; a steady hand-drum heartbeat supports a plain two-note care motif.',
    cameraCue: 'Frame the medicine at waist height, then tilt to the open side lane rather than turning the exchange heroic.',
    entranceCue: 'Kiku emerges only as far as the clinic threshold; Ren approaches with both hands free to receive the bottle.',
    gestureCue: ['KIKU', 'Press the bottle into Ren’s palm, then point once toward the Mori door and return to her patients.'],
    blockingCue: 'Keep the clinic active behind Kiku and the destination visible past Ren, joining giver, carrier, and need in one axis.',
    transitionCue: 'Match the bottle’s pale label to the white river-route mark as control returns to the lane.',
  }),
  scene('prologue', 'p03-bailiff-returns', {
    atmosphere: 'The census square falls unnaturally still before the black bell throws ash across the rain.',
    musicCue: 'Silence takes the first bell strike; a strained bass pulse enters only after the neighbor names Sato.',
    cameraCue: 'Show the transformed figure first at human eye level, then reveal the collector and escape route without a monster close-up.',
    entranceCue: 'The Bailiff walks from behind the census screen while neighbors back toward the marked river lane rather than scattering.',
    gestureCue: ['REN', 'Raise an open hand toward the neighbors, then turn the same hand into a clear point toward the river route.'],
    blockingCue: 'Keep civilians behind low cover, Ren between them and the telegraph lane, and the collector outside the protective line.',
    transitionCue: 'The first red attack line cuts across the composition and becomes the battle grid overlay.',
  }),
  scene('prologue', 'p04-river-escape', {
    atmosphere: 'River mist softens the far bank; hurried footprints end beside two safely shuttered skiffs.',
    musicCue: 'A tired reed phrase rises over slow water, refusing a victory cadence.',
    cameraCue: 'Open wide on the two households, then move closer to Ren and Kiku only after their safety is established.',
    entranceCue: 'Ren arrives last from the trail; Kiku counts blankets and breathing people before meeting him at the bank.',
    gestureCue: ['KIKU', 'Fold Ren’s marked route map open and tap the unsaved doors without crossing out their names.'],
    blockingCue: 'Seat survivors in small family groups while Ren remains standing at the edge of the incomplete route.',
    transitionCue: 'Dissolve the route marks into rows of names on Aya’s archive table.',
  }),
  scene('prologue', 'p05-archive-promise', {
    atmosphere: 'The shrine archive is dry but not serene; bowls catch roof leaks beside orderly stacks of copied names.',
    musicCue: 'A clear brush-on-paper rhythm joins the rain motif, forming the campaign’s first evidence theme.',
    cameraCue: 'Glide from the bell fragment to Aya’s comparison sheet, ending with Ren visible across the same worktable.',
    entranceCue: 'Aya is already cataloguing fragments when Ren enters and places his piece in an empty evidence tray.',
    gestureCue: ['AYA', 'Rotate the fragment until the Takamine seal catches lamplight, then slide a blank casebook page toward Ren.'],
    blockingCue: 'Keep Aya and Ren on equal sides of the table; neither owns the evidence or blocks the archive exit.',
    transitionCue: 'Close on the first copied name as the chapter title replaces the fading ink reflection.',
  }),

  scene('chapter-1', 'c1-01-registers-omissions', {
    atmosphere: 'Morning gray fills the archive, revealing black circles where household entries should continue.',
    musicCue: 'Measured brush strokes alternate with a questioning string interval that never resolves on the missing line.',
    cameraCue: 'Travel laterally across aligned documents until one omission stops the motion; tilt up to Aya and Ren.',
    entranceCue: 'Aya brings the official register from a locked shelf as Ren unfolds the courier packet beside it.',
    gestureCue: ['AYA', 'Place a removable marker beside the absent household, preserving the page while making the gap visible.'],
    blockingCue: 'Arrange both documents parallel, with the ferry map beyond them and the exit toward the landing in the same sightline.',
    transitionCue: 'Let Aya’s marker become the network sign hanging over Kiku’s clinic gate.',
  }),
  scene('chapter-1', 'c1-02-kikus-threshold', {
    atmosphere: 'Clinic mortar, drying herbs, and ferry damp mingle in a courtyard busy with ordinary care.',
    musicCue: 'A practical mallet-and-string pattern keeps time with pestle strokes rather than swelling under the request.',
    cameraCue: 'Start inside the working clinic and track outward to Aya and Ren waiting at the threshold.',
    entranceCue: 'Kiku crosses from patient shelves to the courtyard without abandoning her work station; the visitors do not enter unasked.',
    gestureCue: ['KIKU', 'Turn the network token face down, then set a medicine bundle beside it to clarify the order of obligations.'],
    blockingCue: 'Keep patients’ privacy behind a screen while the ferry road and optional medicine route split visibly beyond the gate.',
    transitionCue: 'Follow the lifted medicine bundle into a lateral wipe of ferry awnings and moving dock ropes.',
  }),
  scene('chapter-1', 'c1-03-ferry-gossip', {
    atmosphere: 'Wet rope creaks against posts while work continues around a conversation no one announces as secret.',
    musicCue: 'Pizzicato figures pass between left and right channels like information handed along a dock.',
    cameraCue: 'Use three modest conversation frames, then converge on the worker beside a crate marked paper, oil, and rope.',
    entranceCue: 'Ren and Aya arrive carrying medicine receipts, allowing the dock worker to approach on their own terms.',
    gestureCue: ['AYA', 'Copy the crate marks into her casebook while leaving the worker’s face outside the written record.'],
    blockingCue: 'Keep moving laborers between the party and distant officials, creating cover without turning the crowd into a prop.',
    transitionCue: 'A swinging cargo rope crosses frame and reveals the flooded cedar route beyond the landing.',
  }),
  scene('chapter-1', 'c1-04-flooded-cedars', {
    atmosphere: 'Rain dimples ankle-deep water; ember flecks on the hounds make every resisted strike readable.',
    musicCue: 'The evidence motif accelerates into clipped percussion, with a bright accent when the Ledger reveals a weakness.',
    cameraCue: 'Snap from Ren’s sliding blade to the resistance readout, then widen enough to show a safe Pierce route.',
    entranceCue: 'Ren regains footing in the shallows while Aya enters the tactical edge with the Ledger already open.',
    gestureCue: ['AYA', 'Trace the resistant hide mark, then point to the exposed seam rather than celebrating the failed hit.'],
    blockingCue: 'Place Aya outside the lunge lane and Ren one Pace from a flanking tile, keeping the lesson spatial.',
    transitionCue: 'The Analyze glyph resolves into the lock sigil on the abandoned storehouse door.',
  }),
  scene('chapter-1', 'c1-05-storehouse-clerk', {
    atmosphere: 'Dust hangs above damp account books; the clerk’s room is cramped by copies made under pressure.',
    musicCue: 'A restrained single-string ostinato sits beneath soft page turns and the building’s distant groan.',
    cameraCue: 'Reveal the clerk without a dramatic shadow, then include the open escape path in every closer frame.',
    entranceCue: 'Ren opens the door and steps aside; Aya waits where the clerk can see both her and the route out.',
    gestureCue: ['AYA', 'Offer an uncapped brush handle-first, asking before adding the clerk’s account to the casebook.'],
    blockingCue: 'Keep the clerk nearest the exit, Aya at the records, and Ren watching the next-room threshold rather than the witness.',
    transitionCue: 'Rack focus from the clerk’s copied route to firelight pulsing under the ledger-room door.',
  }),
  scene('chapter-1', 'c1-06-copy-before-fire', {
    atmosphere: 'Soot settles over a false ledger while clean copy sheets wait beyond the furnace glow.',
    musicCue: 'Fast brush percussion runs against a low ember drone, resolving only when the copied bundle is tied shut.',
    cameraCue: 'Alternate between names being copied and the defeated weapon, never lingering on flame as purification.',
    entranceCue: 'Ren approaches the brazier with the ledger; Aya intercepts by opening a clear workspace, not by blocking him bodily.',
    gestureCue: ['AYA', 'Tie the final annotation sheet into the evidence bundle and nod once before releasing the false ledger to destruction.'],
    blockingCue: 'Place the saved copy toward the exit and the weaponized original toward the furnace, visibly separating evidence from instrument.',
    transitionCue: 'Smoke lifts into a map-shaped cloud; Takamine’s rain gate emerges beneath the next chapter card.',
  }),

  scene('chapter-2', 'c2-01-rain-gate', {
    atmosphere: 'Rain runs down a sealed gate whose official lamps burn despite the absence of food carts.',
    musicCue: 'Hollow bell harmonics sit below the returning rain motif, muted before they can form a ring.',
    cameraCue: 'Descend from the closed inscription to the supply permit, then pan toward the overlooked service path.',
    entranceCue: 'Aya and Ren enter under one travel cloak but separate at the inspection line to study different evidence.',
    gestureCue: ['AYA', 'Shield the permit from rain, then angle it toward the blank forms on the cart for comparison.'],
    blockingCue: 'Keep the barred main gate dominant behind them while the viable side route remains open at frame edge.',
    transitionCue: 'Track a cart wheel through a puddle and continue the motion along wet cedar boards.',
  }),
  scene('chapter-2', 'c2-02-chapel-service-route', {
    atmosphere: 'Cedar walls narrow around prisoner grates; counted footsteps echo beneath a distant bell drone.',
    musicCue: 'Sparse footfall percussion repeats in groups, interrupted by a warm chord when witnesses answer.',
    cameraCue: 'Travel beside the party at grate height, letting speakers remain partly screened without treating confinement as a reveal.',
    entranceCue: 'Ren and Aya slow before the first grate after clearing the path; the prisoner chooses when to approach the bars.',
    gestureCue: ['AYA', 'Hold up the open casebook at a readable angle and wait for assent before writing a witness note.'],
    blockingCue: 'Keep the route forward clear while Ren marks the return path, making the promise actionable rather than ornamental.',
    transitionCue: 'A key turns offscreen; cut to the rear lock just before Nikola’s hand enters frame.',
  }),
  scene('chapter-2', 'c2-03-lises-interruption', {
    atmosphere: 'A torn paper screen stirs between three strangers, each carrying a different piece of court access.',
    musicCue: 'A taut bowed line meets two clipped plucks, then pauses beneath the exchange of names.',
    cameraCue: 'Use a triangular composition that shifts toward balance as introductions replace weapons and permits.',
    entranceCue: 'Nikola drops from the stair landing beside the rear lock, blade low but route-commanding; Ren turns without drawing first.',
    gestureCue: ['NIKOLA', 'Show the stolen key in an open palm after naming himself, keeping the blade pointed at the floor.'],
    blockingCue: 'Aya stands at the triangle’s open side with the fragment visible, preventing either armed figure from owning the frame.',
    transitionCue: 'Match the key’s rotation to the first moving beam on the bell stair.',
  }),
  scene('chapter-2', 'c2-04-bell-stair', {
    atmosphere: 'Wind pushes rain through the open tower while old beams telegraph every sweep with a cedar groan.',
    musicCue: 'A climbing five-note figure resets at each safe landing; beam creaks remain louder than the score.',
    cameraCue: 'Tilt up the full stair once, then lock to readable side angles that preserve hazard lanes and landing depth.',
    entranceCue: 'Nikola tests the first landing from the front, Ren watches the beam cycle, and Aya approaches the checkpoint lantern.',
    gestureCue: ['REN', 'Raise two fingers with the beam rhythm, then lower them on the safe crossing beat.'],
    blockingCue: 'Stage one character per landing so no sprite obscures a warning tile or implies a missing jump mechanic.',
    transitionCue: 'The checkpoint flame bends downward and becomes its reflection in the undercrypt water.',
  }),
  scene('chapter-2', 'c2-05-undercrypt-truth', {
    atmosphere: 'Name slips tremble above shin-deep water; storm charge turns marked pools briefly glass-blue.',
    musicCue: 'Submerged chimes answer a low pulse, with dry lantern notes marking safe ground.',
    cameraCue: 'Move from the slips to their bell cords, then pull wide to include brazier warning, water lanes, and enemies.',
    entranceCue: 'Aya enters first with her brush raised above the water; Nikola follows the cords while Ren checks the dry alcove.',
    gestureCue: ['NIKOLA', 'Separate one loose slip from the feeding cord with the flat of his glove, careful not to tear the name.'],
    blockingCue: 'Keep all three on distinct terrain tags so the spoken truth and tactical water rule occupy one composition.',
    transitionCue: 'A released slip drifts toward the sealed chamber door; cut as the lock answers from within.',
  }),
  scene('chapter-2', 'c2-06-name-from-europe', {
    atmosphere: 'The cracked bell chamber exhales cold dust into the cell block; open locks answer a fight ended without execution.',
    musicCue: 'The European bowed motif and evidence theme share a wary minor interval, neither resolving into reconciliation.',
    cameraCue: 'Begin with Mateus below the broken ward, then widen to include Nikola, witnesses, and the physical cell lever.',
    entranceCue: 'Mateus steps away from the guards’ passage with empty hands; Nikola approaches only far enough to see the Dražanić mark.',
    gestureCue: ['MATEUS', 'Place the bell key on the floor between himself and the party, then turn toward the approaching guards.'],
    blockingCue: 'Keep Ren beside the lever, Aya with the freed witnesses, and Nikola between Mateus and neither exit nor absolution.',
    transitionCue: 'The pulled lever opens six cell doors; their vertical bars dissolve into Sodegaura’s dock masts.',
  }),

  scene('chapter-3', 'c3-01-separate-arrivals', {
    atmosphere: 'Market awnings divide a busy port into overlapping errands, languages, and watchful inspection lanes.',
    musicCue: 'Three compact motifs enter from separate registers and align only at the eastern supply gate.',
    cameraCue: 'Follow Ren, Aya, and Nikola in successive lateral passes before joining them in a reflected shop window.',
    entranceCue: 'Ren carries supply tags, Aya joins a paper queue, and Nikola approaches ship brokers from another street.',
    gestureCue: ['AYA', 'Adjust one route marker on the shared map, then fold it so no single traveler carries the full plan.'],
    blockingCue: 'Keep the party separated by civilian traffic but within mutual sightlines, showing coordination without procession.',
    transitionCue: 'A customs pole lowers across frame and becomes the checkpoint’s dividing line.',
  }),
  scene('chapter-3', 'c3-02-the-checkpoint', {
    atmosphere: 'Inspection lanterns bleach color from permits while prisoner tags hang in the same ordered rows.',
    musicCue: 'A stern drum interval repeats until Genta recognizes the transport mark, when one beat drops away.',
    cameraCue: 'Hold a level two-shot between Genta and Ren, inserting only the mismatched permit and copied evidence.',
    entranceCue: 'Genta steps from the customs booth before the party crosses; Ren stops openly and leaves his hands visible.',
    gestureCue: ['GENTA', 'Turn the permit sideways to expose the prisoner tag, then lower his inspection staff rather than wave them through.'],
    blockingCue: 'Aya keeps the evidence between both men while Nikola watches the gate mechanism instead of threatening the guard.',
    transitionCue: 'Genta’s lowered staff points toward the archive door; the camera follows it inside.',
  }),
  scene('chapter-3', 'c3-03-ledger-customs-house', {
    atmosphere: 'Salt air reaches a sealed archive where port annotations have outlived the voices they displaced.',
    musicCue: 'The cipher motif clicks in uneven pairs beneath a sustained note that tightens through Mateus’s admission.',
    cameraCue: 'Push from the annotation to Mateus’s hand, then widen so Aya and an overhearing clerk remain present.',
    entranceCue: 'Mateus waits outside the archive cage until Aya opens it; he enters behind the record rather than ahead of her.',
    gestureCue: ['MATEUS', 'Point to his own cipher mark without touching the page, then withdraw his hand before Aya records the admission.'],
    blockingCue: 'Keep Aya at the writing surface, Mateus opposite, and the clerk in an unobstructed background line of hearing.',
    transitionCue: 'A copied annotation slides under twine; the twine becomes a lantern-boat mooring line.',
  }),
  scene('chapter-3', 'c3-04-lantern-boat-escort', {
    atmosphere: 'Rain docks glow in three route colors while families study risks beside a waiting low boat.',
    musicCue: 'Three route variations share the same calm pulse, refusing to label one choice morally superior.',
    cameraCue: 'Survey each route from the witnesses’ position, then return to the map without privileging the party’s viewpoint.',
    entranceCue: 'Aya carries the route board to the families; Ren and Nikola take stations only after a witness indicates a preference.',
    gestureCue: ['AYA', 'Turn the board outward and trace each danger with the same measured pace before stepping back.'],
    blockingCue: 'Place witnesses closest to the choice markers, party members at possible escort positions, and the boat operator at the exit.',
    transitionCue: 'The selected lantern color fills the frame and clears into the chosen playable route.',
  }),
  scene('chapter-3', 'c3-05-gentas-order', {
    atmosphere: 'Warehouse cranes hang above a family marked as cargo while dock workers stop without being commanded to watch.',
    musicCue: 'The checkpoint drum returns heavier, then fractures when Genta speaks in the past tense.',
    cameraCue: 'Frame Kaji and Genta across the transport manifest, with the family and listening workers held in depth.',
    entranceCue: 'Kaji strides down the loading ramp issuing the order; Genta steps out of formation and blocks the warehouse path.',
    gestureCue: ['GENTA', 'Remove his retainer token and set it on the manifest without asking anyone to accept the gesture as repair.'],
    blockingCue: 'Keep the family beside the open boat route, never trapped at the visual center of the officers’ confrontation.',
    transitionCue: 'A dock worker lifts the manifest as evidence; cut on its edge to the boss platform.',
  }),
  scene('chapter-3', 'c3-06-first-key', {
    atmosphere: 'Crane hooks settle above the wet platform; the captured captain’s voice remains audible among witnesses.',
    musicCue: 'A firm low cadence supports the first key motif, tempered by an unresolved seaward horn.',
    cameraCue: 'Open on workers securing Kaji alive, then move to the key’s compass-like point toward open water.',
    entranceCue: 'Aya joins Genta at the recovered mechanism while Ren helps clear the family’s path from the platform.',
    gestureCue: ['GENTA', 'Hand the binding rope to a dock worker, then offer the key to Aya with both palms visible.'],
    blockingCue: 'Workers hold custody in the foreground; the party gathers around the key only after that transfer is clear.',
    transitionCue: 'Follow the key’s seaward point across black water until fog erases the horizon.',
  }),

  scene('chapter-4', 'c4-01-nets-in-fog', {
    atmosphere: 'Bell fog knots fishing nets around empty stakes while village boats remain deliberately beached.',
    musicCue: 'Muted rope percussion and a low tide drone open space for Kiku’s practical terms.',
    cameraCue: 'Start among damaged nets at worker height, then reveal the party waiting inland from the boats.',
    entranceCue: 'Kiku walks in from the clinic shelter beside local fishers; Ren arrives from the fouled waterline.',
    gestureCue: ['KIKU', 'Place a clearing tool beside the nearest net and leave the boat rope untouched until help is offered.'],
    blockingCue: 'Keep fishers between their boats and the party, with the combat route toward the fog visible behind Ren.',
    transitionCue: 'A freed net drops cleanly into water; its ripple becomes the first cold pool in the caves.',
  }),
  scene('chapter-4', 'c4-02-tide-caves', {
    atmosphere: 'Cold pools steal color from the cave floor while dry lantern niches hold steady amber markers.',
    musicCue: 'Cool glass tones alternate with warm struck wood, mirroring Frost and Ember terrain language.',
    cameraCue: 'Trace a safe route from pool edge to lantern niche before returning control, never hiding a slowing tile.',
    entranceCue: 'Kiku tests the water with a staff; Aya enters the dry lane carrying an unlit marker.',
    gestureCue: ['KIKU', 'Lift her damp boot deliberately, then light the nearest safe marker with the Ember tool.'],
    blockingCue: 'Stage party silhouettes on contrasting terrain so reduced Pace and dry refuge read without explanatory spectacle.',
    transitionCue: 'The lantern flame reflects in a brass cabin fitting, carrying the scene into the wreck.',
  }),
  scene('chapter-4', 'c4-03-varga-journal', {
    atmosphere: 'The captain’s cabin lists with every swell; salt-stiff pages expose a family legend built over a sale.',
    musicCue: 'Nikola’s bowed theme loses its heroic upper note while Mateus’s cipher pulse remains quietly underneath.',
    cameraCue: 'Hold the journal open between Nikola and Mateus, giving the incriminating entry more weight than either reaction.',
    entranceCue: 'Nikola retrieves the journal from a collapsed locker; Mateus remains at the cabin door until he reads aloud.',
    gestureCue: ['NIKOLA', 'Close the journal around Aya’s evidence marker, not around the page that would flatter his inheritance.'],
    blockingCue: 'Keep Aya’s empty evidence sleeve visible beside Nikola and Mateus separated by the tilted chart table.',
    transitionCue: 'The journal enters the sleeve; a wave rocks the lamp and reveals the survivors’ hatch below.',
  }),
  scene('chapter-4', 'c4-04-survivors-hold', {
    atmosphere: 'Fog leaks between broken boards around blankets, splints, and a skiff route too narrow for haste.',
    musicCue: 'The care motif returns in low strings, crossed by the reef threat as a distant pulse rather than a countdown.',
    cameraCue: 'Survey injured sailors and the clear skiff path before framing Kiku’s two stated options.',
    entranceCue: 'The sailor opens the hold from within; Kiku kneels at the first injured person while the party remains on the stair.',
    gestureCue: ['KIKU', 'Set one hand on the medical pack and the other on the reef map, making both costs visible before the choice.'],
    blockingCue: 'Keep survivors closest to Kiku and the exit, with combat-ready party members farther toward the fog.',
    transitionCue: 'Whichever route is chosen, follow the first carried lantern through the hatch into reef wind.',
  }),
  scene('chapter-4', 'c4-05-names-returned', {
    atmosphere: 'The defeated fog thins over a storm-broken reef, revealing name fragments among ordinary wreckage.',
    musicCue: 'Voices hum one open interval beneath surf; no triumphant boss fanfare interrupts the work of recovery.',
    cameraCue: 'Remain at respectful middle distance from the Widow, then pan to living sailors moving shoreward.',
    entranceCue: 'Aya approaches only after the final hostile current fades; Kiku directs the first evacuation line past her.',
    gestureCue: ['AYA', 'Place a blank marker beside an unreadable fragment, recording uncertainty instead of inventing a name.'],
    blockingCue: 'Keep the released figure near open sea, rescuers on the shore axis, and the party outside a trophy composition.',
    transitionCue: 'Surf washes across the blank marker and recedes onto Nagi’s quieter shoreline.',
  }),
  scene('chapter-4', 'c4-06-kikus-terms', {
    atmosphere: 'Dawn work begins along the shore: nets are mended, medicines counted, and no crowd waits for a speech.',
    musicCue: 'The care motif gains a firm walking bass, signaling partnership through labor rather than ceremony.',
    cameraCue: 'Track Kiku between repair stations before settling into a level frame with Ren beside the supply list.',
    entranceCue: 'Ren joins Kiku while she finishes a medicine count; he waits until she closes the box before asking.',
    gestureCue: ['KIKU', 'Add rest, shelter, and noncombatants to the top of Ren’s plan, then hand the brush back.'],
    blockingCue: 'Place both among working villagers rather than in front of them, with the inland road open behind the supply table.',
    transitionCue: 'Kiku’s new planning line extends across the map and darkens into Kagura’s ash road.',
  }),

  scene('chapter-5', 'c5-01-requisition-town', {
    atmosphere: 'Coal grit covers ration notices whose neat official marks conceal threats against whole households.',
    musicCue: 'Heavy work beats fall under a clipped administrative rhythm, joined by the evidence motif as marks are named.',
    cameraCue: 'Move from workers’ hands to requisition seals and finally to the route, quota, and threat marked separately.',
    entranceCue: 'The party enters beside an empty coal cart; workers choose a shaded loading bay for the conversation.',
    gestureCue: ['GENTA', 'Identify each military mark with the blunt end of his weapon, keeping the sharp edge sheathed.'],
    blockingCue: 'Workers hold the notice board; Genta and Kiku stand to either side without enclosing the speaker.',
    transitionCue: 'Coal dust blows from the copied marks and spreads into the open ash fields.',
  }),
  scene('chapter-5', 'c5-02-ash-fields', {
    atmosphere: 'Wind exposes name slips beneath gray ash as bound figures pause when their own names are spoken.',
    musicCue: 'The battle pulse yields to a single human-scale melody whenever a recovered name becomes audible.',
    cameraCue: 'Show the responding figure and name slip in one frame, avoiding a transformation close-up or victory angle.',
    entranceCue: 'Aya stops the party line at the first spoken response; Ren lowers his blade and approaches the memorial basin.',
    gestureCue: ['REN', 'Carry the recovered slip flat in both hands and release it to flowing water without tearing it.'],
    blockingCue: 'Keep the bound figure’s exit path clear while the party forms a loose protective arc against remaining threats.',
    transitionCue: 'The released ash follows water into a dark channel that becomes the cipher room’s ink line.',
  }),
  scene('chapter-5', 'c5-03-cipher-room', {
    atmosphere: 'Court directives cover the archive wall in a code designed to move accusations without witnesses.',
    musicCue: 'The cipher clicks become exposed and regular, stripped of mystery beneath a low accountable drone.',
    cameraCue: 'Pan across the directives to Mateus’s matching hand, then settle with Aya’s evidence packet in foreground.',
    entranceCue: 'Mateus enters after Ren breaks the office seal and stops at the first directive bearing his notation.',
    gestureCue: ['MATEUS', 'Read his cipher aloud from the wall while Aya records the admission in a separate, clearly labeled hand.'],
    blockingCue: 'Keep Ren on the route the code enabled, Aya at the record, and Mateus with no object or doorway concealed behind him.',
    transitionCue: 'Aya closes the admission sheet; the clasp sound becomes a row of prison locks engaging.',
  }),
  scene('chapter-5', 'c5-04-prison-locks', {
    atmosphere: 'Heat trembles over two routes: a short blast corridor and a longer line of occupied cells.',
    musicCue: 'Two rhythmic paths share equal volume—one abrupt, one patient—without a hidden morality flourish.',
    cameraCue: 'Map both approaches from the prisoners’ side of the locks before returning to Genta and Kiku.',
    entranceCue: 'Genta arrives from the furnace survey; Kiku is already checking names and hinges along the cell route.',
    gestureCue: ['KIKU', 'Write “for whom?” across the route header, then turn the planning board toward the player choice.'],
    blockingCue: 'Keep visible prisoners out of the direct heat line and both route entrances equally readable behind the speakers.',
    transitionCue: 'The selected route line ignites on the map and carries forward into playable forge space.',
  }),
  scene('chapter-5', 'c5-05-sigil-burned', {
    atmosphere: 'The archive furnace throws harsh light across open locks while the Abbot’s sigil cracks under its own heat.',
    musicCue: 'Forge percussion stutters into a long recovery gap, leaving evacuation calls clear above the score.',
    cameraCue: 'Frame Mateus’s refusal without isolating him; immediately widen to Aya directing prisoners through the opening.',
    entranceCue: 'The Abbot rises behind the furnace seal; Mateus steps into its light as Aya opens the flank route.',
    gestureCue: ['AYA', 'Signal two evacuation lanes with her brush while the boss recovery indicator remains visible.'],
    blockingCue: 'Keep prisoners moving behind cover, Mateus short of the flames, and the Abbot contained within the tactical arena.',
    transitionCue: 'The broken sigil falls across the lens; lift from its ash to intact records in the vault.',
  }),
  scene('chapter-5', 'c5-06-midpoint-evidence', {
    atmosphere: 'Cool vault air preserves raid schedules, fuel counts, and a portrait that finally gives the system a face.',
    musicCue: 'The evidence theme broadens into a grave six-note statement, with Kurozane’s bell tone held underneath.',
    cameraCue: 'Reveal schedules and named routes before the portrait, keeping proof larger in the composition than the ruler.',
    entranceCue: 'Aya and Ren carry sealed copies into the vault; Mateus enters last and recognizes the portrait from a distance.',
    gestureCue: ['MATEUS', 'Turn the portrait face down after naming Kurozane, leaving the raid schedule visible beside it.'],
    blockingCue: 'Place the evidence bundle nearest the outgoing courier chute and every party member around the records, not the portrait.',
    transitionCue: 'A copied packet enters the chute; follow it along roads until Kozui’s printing blocks catch it.',
  }),

  scene('chapter-6', 'c6-01-city-competing-needs', {
    atmosphere: 'Kozui’s print lane layers block-cutting, canal bells, and neighborhood meetings without reducing the city to one crowd.',
    musicCue: 'Three work motifs overlap gently, each retaining its own pulse until the first visit is chosen.',
    cameraCue: 'Rise over the lane just enough to connect workshop, canal, and meeting house, then return to the shared route board.',
    entranceCue: 'Aya and Ren arrive at a public wayfinding post; local contacts remain at their workplaces rather than assembling for them.',
    gestureCue: ['AYA', 'Write each requested risk beside the help offered, leaving equal space for refusal and revision.'],
    blockingCue: 'Place the party at the map’s edge while the three destinations occupy distinct, equally reachable directions.',
    transitionCue: 'The chosen marker stamps the route card; its ink impression becomes the first printing block.',
  }),
  scene('chapter-6', 'c6-02-three-copies', {
    atmosphere: 'Fresh ink, damp testimony sheets, and sealed boat packets fill three linked workshops with purposeful disorder.',
    musicCue: 'Block strikes, brush scratches, and canal knocks interlock into the evidence theme without becoming martial.',
    cameraCue: 'Pass one claim through all three copying methods, showing differences and correction marks rather than identical relics.',
    entranceCue: 'Aya enters carrying the master notes; Kiku and the printmaker clear separate workspaces instead of one central altar.',
    gestureCue: ['KIKU', 'Hold a wet proof at arm’s length, check its legibility, and return it for one practical correction.'],
    blockingCue: 'Arrange copy teams in a triangle with open routes between them, keeping no document or person at a sacred center.',
    transitionCue: 'Three finished bundles leave through three frame edges; the last departing sheet wipes to the tribunal notice.',
  }),
  scene('chapter-6', 'c6-03-tribunal', {
    atmosphere: 'A public hall is arranged to make accusation look orderly, but copied evidence is already audible beyond its doors.',
    musicCue: 'Ujiro’s rigid court rhythm competes with distant printing beats that refuse to synchronize with him.',
    cameraCue: 'Begin from the public benches, not the dais; keep Mateus, Aya, Ujiro, and the open exits in the same geography.',
    entranceCue: 'Ujiro enters from behind the raised screen; Mateus walks to the speaking mark without escort or ceremonial welcome.',
    gestureCue: ['MATEUS', 'Open his written admission toward the listeners and keep his hands on the table through their silence.'],
    blockingCue: 'Aya stands beside the distributed-copy receipts, while no party member shields Mateus from the people hearing him.',
    transitionCue: 'A messenger carries one receipt through the side door; follow to masked clerks reaching the roof route.',
  }),
  scene('chapter-6', 'c6-04-printmaker-flight', {
    atmosphere: 'Rain slicks roof tiles around a civilian courier whose lighter bundle still cannot outrun armed clerks.',
    musicCue: 'Fast roof percussion follows foot placement, with Nikola’s protection motif anchored to the courier’s pace.',
    cameraCue: 'Track beside the courier and preserve landing tiles ahead; cut to Nikola only when he chooses the person over the crate.',
    entranceCue: 'The courier climbs from the workshop hatch; Nikola arrives from the rear roof as clerks close the other approach.',
    gestureCue: ['NIKOLA', 'Push the heavy crate into cover, then offer the courier a steady forearm across the roof gap.'],
    blockingCue: 'Keep the courier on the protected inside line, Nikola between them and attackers, and the bundle attached to the person.',
    transitionCue: 'The courier descends beyond the last roof; tilt down with them to the canal lock.',
  }),
  scene('chapter-6', 'c6-05-all-copies-leave', {
    atmosphere: 'Road dust, hand traffic, and canal current pull three evidence bundles away from any single point of failure.',
    musicCue: 'The three work motifs depart one by one, leaving a restrained key theme and a warning bass note.',
    cameraCue: 'Hold a wide lockside view until all routes are visible, then follow none of them long enough to imply a privileged copy.',
    entranceCue: 'Aya arrives with the boat packet, Ren sees off the hand courier, and Genta secures the key beside the lock keeper.',
    gestureCue: ['GENTA', 'Wrap the third key in an unmarked cloth and pass it into shared custody rather than fastening it to himself.'],
    blockingCue: 'Place each outgoing route behind its responsible local carrier, with the party regrouping only after all three move.',
    transitionCue: 'The canal gate closes on the last packet; its wooden bar becomes the Hushroad map-table edge.',
  }),

  scene('chapter-7', 'c7-01-decision-map-table', {
    atmosphere: 'A camp map shows the short castle route beside prisoner movements marked by fresh lantern reports.',
    musicCue: 'The key motif starts toward a march, then yields to a steadier rescue pulse when the human routes are named.',
    cameraCue: 'Look down on both paths without highlighting the castle shortcut, then lower to the party’s shared eye line.',
    entranceCue: 'Genta opens the map with all three keys; Ren adds the newest prisoner report before anyone reaches for them.',
    gestureCue: ['AYA', 'Move the prisoner markers out of the map margin and into the center of the route calculation.'],
    blockingCue: 'Keep the keys together but outside any one character’s reach, with the rescue road facing the camp exit.',
    transitionCue: 'Aya’s rescue line extends past the map edge into the abandoned post-town road.',
  }),
  scene('chapter-7', 'c7-02-former-retainer', {
    atmosphere: 'An abandoned checkpoint still bears Genta’s old unit marks, now weathered beside makeshift family shelters.',
    musicCue: 'His former rank cadence appears as distant drum memory, answered by an unadorned present-tense bass line.',
    cameraCue: 'Keep the former subordinate at equal height with Genta, using the old command post only as background evidence.',
    entranceCue: 'Former soldiers step from separate shelters rather than forming ranks; Genta stops before crossing their boundary rope.',
    gestureCue: ['GENTA', 'Set his route notes on the ground and step back, offering information without summoning anyone forward.'],
    blockingCue: 'Leave multiple exits behind the former soldiers and no party member positioned to close them.',
    transitionCue: 'One volunteer lifts the route notes while others remain; pan with the marked ferry line underground.',
  }),
  scene('chapter-7', 'c7-03-aqueduct-names', {
    atmosphere: 'Underground water carries ash beneath stone channels lined with damp, recoverable name slips.',
    musicCue: 'Flowing percussion supports the release melody, each returned name adding one warm but nontriumphant tone.',
    cameraCue: 'Follow the first slip from Ren’s hands to the current and keep the bound person’s release within the same wide frame.',
    entranceCue: 'Aya locates the inscribed channel; Kiku clears a safe bank while Ren approaches with the recovered slip.',
    gestureCue: ['REN', 'Read the name at speaking volume, then place the slip flat on moving water and open his hands.'],
    blockingCue: 'Form a protective corridor toward the released person’s exit, with weapons turned toward remaining hazards only.',
    transitionCue: 'The slip passes beneath a lantern reflection that expands into the quiet alcove ahead.',
  }),
  scene('chapter-7', 'c7-04-lises-revised-oath', {
    atmosphere: 'A single road lantern lights the inherited oath beside a clean page that has not yet claimed authority.',
    musicCue: 'Nikola’s bowed theme returns without its hunting cadence, supported by a plain sustained note.',
    cameraCue: 'Frame Nikola writing at the alcove ledge with Mateus outside his shoulder line, present but not made his subject.',
    entranceCue: 'Nikola enters alone and opens the family text; Mateus stops at the lantern edge when he recognizes it.',
    gestureCue: ['NIKOLA', 'Strike through the purge claim once, then write the protective promise on a separate titled page.'],
    blockingCue: 'Keep the revised oath nearest the public route and the inherited text farther inside the alcove for evidence storage.',
    transitionCue: 'The fresh ink dries under lantern heat; its protective line becomes the rescue-route boundary.',
  }),
  scene('chapter-7', 'c7-05-rescue-before-ring', {
    atmosphere: 'The aqueduct trembles with a bell already sounding elsewhere as survivors gather around copied route maps.',
    musicCue: 'Urgent low pulses run beneath the network lantern motif, which remains clearer than the distant bell.',
    cameraCue: 'Reveal the open survivor route before the upper bell glow, preserving escape as the scene’s primary action.',
    entranceCue: 'Survivors emerge through the released garrison gate; Aya and Ren meet them from the side rather than leading the line.',
    gestureCue: ['AYA', 'Divide the route copies among several carriers and mark alternate shelters on each before handing them over.'],
    blockingCue: 'Place survivors toward the next exit, the party alongside them, and the castle road behind rather than above.',
    transitionCue: 'Raised warning lanterns answer across the dark; their points of light map the three homecoming routes.',
  }),

  scene('chapter-8', 'c8-01-three-homecomings', {
    atmosphere: 'Three communities appear through working spaces—archive, dock, and clinic—each with its own unfinished needs.',
    musicCue: 'The rain, harbor, and care motifs trade short phrases without merging into a recruitment anthem.',
    cameraCue: 'Use matched table-height compositions at all three hubs, changing tools and people rather than hierarchy.',
    entranceCue: 'Aya and Kiku arrive with an empty contribution ledger and wait for each local meeting to begin.',
    gestureCue: ['AYA', 'Write offered assets beside stated limits, leaving every unoffered category visibly blank.'],
    blockingCue: 'Keep local representatives at the head of their own tables and the party among available chairs, never on a platform.',
    transitionCue: 'The three completed lists fold into adjacent panels, then align on the Black Gate planning table.',
  }),
  scene('chapter-8', 'c8-02-consent-not-conscription', {
    atmosphere: 'The planning shelter holds boat tokens, medical cloth, record boxes, and no ceremonial weapons pile.',
    musicCue: 'A grounded ensemble plays the network motif through distinct working timbres instead of a battle march.',
    cameraCue: 'Circle the concrete contributions and their risk notes before settling on Ren and the network elder.',
    entranceCue: 'Representatives place their own tokens on the table; Ren enters last with the needs list, not a command banner.',
    gestureCue: ['REN', 'Remove the unused fighter marker from the plan and replace it with a labeled safe-route token.'],
    blockingCue: 'Representatives retain reach to every contributed token while the party stands on the receiving side of the table.',
    transitionCue: 'Lantern colors illuminate the agreed routes one at a time, then dim beneath the Black Gate silhouette.',
  }),
  scene('chapter-8', 'c8-03-black-gate-bargain', {
    atmosphere: 'The causeway is flanked by visible evacuation boats and witnesses, making the offered exchange impossible to privatize.',
    musicCue: 'Enma’s polished bell chord meets the network motif as an unbroken, collective low note.',
    cameraCue: 'Keep the representative in the four-person confrontation; avoid isolating Mateus or Nikola as sacrificial portraits.',
    entranceCue: 'Lady Enma descends from the sealed gate while network representatives arrive from the protected causeway lanes.',
    gestureCue: ['MATEUS', 'Step beside Nikola rather than in front of him, then turn to hear the representative’s refusal.'],
    blockingCue: 'Place the offered pair within the network line and Enma alone before the closed gate, with no surrender lane between.',
    transitionCue: 'The representative raises the agreed lantern; its blue flare becomes the breach signal.',
  }),
  scene('chapter-8', 'c8-04-lantern-breach', {
    atmosphere: 'Blue records, green boats, and white medical lanes move behind the outer court as coordinated routes, not troops.',
    musicCue: 'Three lantern motifs pulse over spare battle percussion, each remaining audible while its route is active.',
    cameraCue: 'Sweep across all support lanes before dropping to the party grid, preserving their continuing work in the background.',
    entranceCue: 'Aya lights the signal from the causeway center; Genta opens the party route only after every color answers.',
    gestureCue: ['GENTA', 'Brace the outer-court door with his shield and point the released passage inward, never toward civilian lanes.'],
    blockingCue: 'Keep support assets outside combat tiles and visibly connected to exits, records, and tents rather than damage effects.',
    transitionCue: 'The three lantern reflections cross the wet court and lock into the battle interface borders.',
  }),
  scene('chapter-8', 'c8-05-gate-opened', {
    atmosphere: 'The opened gate reveals medical tents receiving released soldiers while the road network continues behind them.',
    musicCue: 'The gate theme resolves downward into the care motif, saving its forward cadence for the six entering the castle.',
    cameraCue: 'Begin on released people reaching tents, then pan to the full party only after care routes are established.',
    entranceCue: 'Kiku guides the first released soldier through the gate; Aya gathers the six-person roster at the inner threshold.',
    gestureCue: ['KIKU', 'Remove an enemy marker from a released soldier and replace it with a patient tag before directing transport.'],
    blockingCue: 'Local allies face outward along their chosen routes while the six party members face inward without a cheering corridor.',
    transitionCue: 'The party crosses as the gate remains open behind them; exterior lanterns narrow into archive-node lights.',
  }),

  scene('chapter-9', 'c9-01-archive-breathes', {
    atmosphere: 'Shelves flex with bell tissue while loose names pull toward red nodes; scores of crucified and impaled Kirishitan victims form a forced processional along the walls.',
    musicCue: 'The evidence theme is stretched through a living low drone, interrupted by clean tones when names are released.',
    cameraCue: 'Sweep the execution rows long enough to establish their scale, stop on two visible breaths, then show the names’ direction of pull, node locations, and safe archive core before granting movement control.',
    entranceCue: 'Aya enters with protective folios raised; Ren follows the first loose page to its node rather than striking the shelves.',
    gestureCue: ['AYA', 'Pin a falling name beneath a clear ward sheet and point Ren toward the node feeding on it.'],
    blockingCue: 'Keep party routes between nodes and the archive core, leaving authored forward openings instead of maze-like returns.',
    transitionCue: 'The first broken node exhales paper into the living audience hall’s tall doors.',
  }),
  scene('chapter-9', 'c9-02-ujiros-last-ledger', {
    atmosphere: 'The audience hall’s living walls recede from copied testimony; execution beams continue between lacquer pillars, with two living prisoners low enough to reach.',
    musicCue: 'Ujiro’s court rhythm loses instruments one by one while the witness motif remains steady and close.',
    cameraCue: 'Frame Ujiro at floor level with the harmed witness visible before his offer, denying him a solitary final tableau.',
    entranceCue: 'Kiku and Ren cut down the two living prisoners before Ujiro emerges from the breathing dais; witnesses enter through the opened archive route under their own escort.',
    gestureCue: ['REN', 'Close Ujiro’s ledger and slide it toward the witness custody table without drawing his weapon.'],
    blockingCue: 'Witnesses control the exit and evidence table; the party leaves an open path between them and Ujiro.',
    transitionCue: 'Custody doors close without impact; a conservatory petal drifts through the next opening.',
  }),
  scene('chapter-9', 'c9-03-conservatory-offers', {
    atmosphere: 'Black glass flowers reflect six impossible private futures while impalement stakes and execution beams climb the upper galleries; the real evacuation route remains dimly visible behind them.',
    musicCue: 'Six familiar character motifs appear as polished, incomplete imitations over Kurozane’s held bell tone.',
    cameraCue: 'Move past each reflection to the corresponding person in the shared chamber, always returning to the open group frame.',
    entranceCue: 'Kurozane speaks through reflections before appearing at the far end; the party enters together and does not separate.',
    gestureCue: ['AYA', 'Turn her perfect reflected archive to reveal that its shelves have no correction table or public door.'],
    blockingCue: 'Keep all six within speaking distance and every offer reflection outside the party’s protective circle.',
    transitionCue: 'Each refusal darkens one glass flower; the remaining bell light drains toward the spine chamber.',
  }),
  scene('chapter-9', 'c9-04-yearless-bell', {
    atmosphere: 'A vast bell spine pulses above an archive core; the castle has bound its densest rows of dead Kirishitan victims to the machinery as a final declaration of ownership.',
    musicCue: 'Kurozane’s ledger rhythm swells against the full evidence theme, with clear rests marking exposed-node windows.',
    cameraCue: 'Establish core, nodes, and party lanes before revealing Kurozane above them; return immediately to tactical height.',
    entranceCue: 'Kurozane descends with the bell stroke while Ren and Aya take positions on opposite sides of the archive core.',
    gestureCue: ['REN', 'Plant the route marker beside the core and direct allies toward protection before turning toward Kurozane.'],
    blockingCue: 'The core remains inside the party formation, exposed nodes outside it, and Kurozane never occupies a worshipful central axis.',
    transitionCue: 'A broken node sends dawn-colored light up the spine toward the observatory.',
  }),
  scene('chapter-9', 'c9-05-dawn-at-observatory', {
    atmosphere: 'First daylight reaches the observatory through cracked wards and the final ring of execution beams while the bell shadow still covers the floor.',
    musicCue: 'Mateus’s cipher motif sheds its destructive bass and joins Nikola’s revised theme on a spare protective chord.',
    cameraCue: 'Hold the blood rite as a boundary opening, not a bodily spectacle; track its light to the route it creates for others.',
    entranceCue: 'Mateus approaches the ward from the party line; Nikola holds the rear path open and Ren waits at the exposed threshold.',
    gestureCue: ['MATEUS', 'Press his marked palm to the ward, then deliberately close the destructive rite sigil with his other hand.'],
    blockingCue: 'Keep companions behind and beside Mateus, with the opened door extending past him rather than ending on him.',
    transitionCue: 'The ward cracks into a sunrise line that becomes the final battle boundary.',
  }),
  scene('chapter-9', 'c9-06-leave-evidence-alive', {
    atmosphere: 'Only bell-grown corridors collapse; stone stairs, witnesses, and packed records remain navigable in the dawn dust.',
    musicCue: 'The final battle cadence gives way to a carrying rhythm built from footsteps, page ties, and the care motif.',
    cameraCue: 'Track evidence moving hand to hand through safe halls, showing the collapse only as route information.',
    entranceCue: 'Aya arrives from the archive core with the first bundle; Genta braces a failing bell-grown lintel while Ren clears the stair.',
    gestureCue: ['AYA', 'Hand the heaviest record box to two carriers together and take a smaller bundle herself.'],
    blockingCue: 'Form an evacuation chain with survivors interspersed as agents, not a passive crowd behind the party.',
    transitionCue: 'The final bundle crosses into daylight; dissolve its dust into paper fibers at the public archive.',
  }),

  scene('epilogue', 'e00-open-archive', {
    atmosphere: 'Morning visitors enter a modest archive where correction slips, testimony shelves, and acknowledged gaps are equally visible.',
    musicCue: 'The evidence theme returns on warm, unforced instruments with room for page turns and ordinary conversation.',
    cameraCue: 'Travel from the public entrance past each labeled shelf to Aya and Ren opening the correction table.',
    entranceCue: 'Aya unlocks the doors from inside while local archivists carry in their own boxes; Ren joins the visitor line.',
    gestureCue: ['AYA', 'Set blank correction slips beside the testimony register and leave the pen within public reach.'],
    blockingCue: 'Keep the table accessible from several sides, with staff nearby but no raised custodian’s platform.',
    transitionCue: 'A visitor’s correction slip settles on the table; match its folded edge to a medical-crate label.',
  }),
  scene('epilogue', 'e01-repair-work', {
    atmosphere: 'Sodegaura’s storehouse is busy with medicine inventories, road tools, testimony appointments, and supervised cache maps.',
    musicCue: 'Care, road, oath, and admission motifs pass quietly between work stations without a reunion fanfare.',
    cameraCue: 'Move through each party member’s concrete task in one continuous warehouse path, ending at the outgoing crates.',
    entranceCue: 'Kiku opens the storehouse for deliveries; Genta, Nikola, and Mateus arrive separately with labeled work records.',
    gestureCue: ['KIKU', 'Check the first crate seal, hand its inventory to a local carrier, and lift the next box with Ren.'],
    blockingCue: 'Assign each speaker a working station under local oversight, with clear routes for staff to enter and correct them.',
    transitionCue: 'The delivered crate passes through the door; its lantern mark leads up Takamine’s repaired stair.',
  }),
  scene('epilogue', 'e02-repaired-tower', {
    atmosphere: 'Clear air crosses a repaired tower holding a lantern above a bell that remains still and unlit.',
    musicCue: 'The rain motif opens into a quiet major interval, ending on breath and the soft fold of a personal packet.',
    cameraCue: 'Follow Ren’s packet to Aya, then pull beyond them to the lantern, the silent bell, and roads visible below.',
    entranceCue: 'Ren climbs with the final packet among ordinary visitors; Aya waits beside the unlit lantern rather than the bell.',
    gestureCue: ['REN', 'Open the packet toward Aya so the requests for missing people are readable before passing it on.'],
    blockingCue: 'Place the lantern between the pair and the public stair, with the bell off-center and no throne-like viewpoint.',
    transitionCue: 'The player lights the lantern; hold on its reflection in the silent bell, then fade to the credits archive.',
  }),
]);

export const REQUIRED_SCENE_CUE_FIELDS = Object.freeze([
  'atmosphere',
  'musicCue',
  'cameraCue',
  'entranceCue',
  'blockingCue',
  'transitionCue',
]);

const MIN_AUTHORED_CUE_LENGTH = 20;
const PLACEHOLDER_PATTERN = /\b(?:todo|tbd|placeholder|lorem ipsum|fill[ -]?in|same as above|generic cue|n\/?a)\b/i;
const NON_ORIGINAL_REFERENCE_PATTERN = /\b(?:Adam Driver|Martin Scorsese|Castlevania|Final Fantasy|Symphony of the Night|Konami)\b/i;
const GENERIC_CUES = new Set([
  'add atmosphere',
  'play music',
  'camera moves',
  'characters enter',
  'character gestures',
  'block the scene',
  'transition to next scene',
]);

function canonicalBeatEntries(campaign) {
  return campaign.chapters.flatMap((chapter, chapterIndex) => chapter.beats.map((beat, beatIndex) => ({
    chapter,
    chapterIndex,
    beat,
    beatIndex,
    key: `${chapter.id}/${beat.id}`,
  })));
}

function cueText(direction) {
  return [
    ...REQUIRED_SCENE_CUE_FIELDS.map((field) => direction?.[field]),
    direction?.gestureCue?.action,
  ].filter((value) => typeof value === 'string').join(' ');
}

function addError(errors, code, message, index = null) {
  errors.push({ code, message, index });
}

function validateAuthoredCue(errors, value, field, direction, index) {
  if (typeof value !== 'string' || !value.trim()) {
    addError(errors, 'missing-cue', `${direction?.beatId ?? `Direction ${index}`} needs ${field}.`, index);
    return;
  }
  const normalized = value.trim().toLowerCase();
  if (value.trim().length < MIN_AUTHORED_CUE_LENGTH || PLACEHOLDER_PATTERN.test(value) || GENERIC_CUES.has(normalized)) {
    addError(errors, 'generic-cue', `${direction.beatId} has a placeholder or generic ${field}.`, index);
  }
}

/**
 * Validate exact coverage, canonical order, authored cue quality, and gesture
 * references without requiring a renderer or browser environment.
 */
export function validateSceneDirections(directions = SCENE_DIRECTIONS, campaign = CAMPAIGN) {
  const errors = [];
  const canonical = canonicalBeatEntries(campaign);
  const canonicalByKey = new Map(canonical.map((entry) => [entry.key, entry]));
  const canonicalByBeatId = new Map(canonical.map((entry) => [entry.beat.id, entry]));
  const castSpeakers = new Set(Object.values(campaign.cast).map((member) => (
    member.speakerId ?? String(member.id).toUpperCase()
  )));
  const records = Array.isArray(directions) ? directions : [];

  if (!Array.isArray(directions)) addError(errors, 'invalid-collection', 'Scene directions must be an array.');
  if (records.length !== canonical.length) {
    addError(errors, 'coverage-count', `Expected ${canonical.length} directions, received ${records.length}.`);
  }

  const seen = new Set();
  for (let index = 0; index < records.length; index += 1) {
    const direction = records[index];
    if (!direction || typeof direction !== 'object') {
      addError(errors, 'invalid-direction', `Direction ${index} must be an object.`, index);
      continue;
    }
    const key = `${direction.chapterId}/${direction.beatId}`;
    const expected = canonical[index];
    const entry = canonicalByKey.get(key);
    if (expected && key !== expected.key) {
      addError(errors, 'order-mismatch', `Direction ${index} is ${key}; expected ${expected.key}.`, index);
    }
    if (!entry) {
      const correctChapter = canonicalByBeatId.get(direction.beatId);
      addError(errors, correctChapter ? 'chapter-mismatch' : 'unknown-beat', correctChapter
        ? `${direction.beatId} belongs to ${correctChapter.chapter.id}, not ${direction.chapterId}.`
        : `${key} is not a canonical campaign beat.`, index);
    }
    if (seen.has(key)) addError(errors, 'duplicate-beat', `${key} has more than one direction.`, index);
    seen.add(key);

    for (const field of REQUIRED_SCENE_CUE_FIELDS) {
      validateAuthoredCue(errors, direction[field], field, direction, index);
    }
    validateAuthoredCue(errors, direction.gestureCue?.action, 'gestureCue.action', direction, index);

    const speaker = direction.gestureCue?.speaker;
    if (!castSpeakers.has(speaker)) {
      addError(errors, 'invalid-cast-speaker', `${direction.beatId} gesture speaker ${String(speaker)} is not registered in campaign.cast.`, index);
    } else if (entry && !(entry.beat.text ?? []).some((line) => line.speaker === speaker)) {
      addError(errors, 'speaker-not-in-beat', `${speaker} does not speak in ${direction.beatId}.`, index);
    }
    if (NON_ORIGINAL_REFERENCE_PATTERN.test(cueText(direction))) {
      addError(errors, 'non-original-reference', `${direction.beatId} contains an external franchise or celebrity reference.`, index);
    }
  }

  for (const entry of canonical) {
    if (!seen.has(entry.key)) addError(errors, 'missing-beat', `${entry.key} has no scene direction.`);
  }

  return deepFreeze({
    valid: errors.length === 0,
    directionCount: records.length,
    canonicalBeatCount: canonical.length,
    errors,
  });
}

const EMPTY_DIRECTIONS = Object.freeze([]);
const DIRECTIONS_BY_BEAT = new Map(SCENE_DIRECTIONS.map((direction) => [direction.beatId, direction]));
const DIRECTIONS_BY_CHAPTER = new Map(CAMPAIGN.chapters.map((chapter) => [
  chapter.id,
  Object.freeze(SCENE_DIRECTIONS.filter((direction) => direction.chapterId === chapter.id)),
]));

/** Return one immutable direction record by canonical beat id, or null. */
export function getSceneDirection(beatId) {
  return DIRECTIONS_BY_BEAT.get(beatId) ?? null;
}

/** Return immutable direction records for a chapter in canonical beat order. */
export function getSceneDirectionsForChapter(chapterId) {
  return DIRECTIONS_BY_CHAPTER.get(chapterId) ?? EMPTY_DIRECTIONS;
}

/** Return the complete immutable presentation script in canonical order. */
export function getAllSceneDirections() {
  return SCENE_DIRECTIONS;
}
