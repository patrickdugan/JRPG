/**
 * Canonical first-play dialogue for the opening through Father Mateus.
 *
 * The full dialogue compilation remains available as an extended script and
 * production archive. This cut is the player-facing route: it preserves every
 * required fact, choice, field operation, encounter handoff, and character
 * turn without asking a first-time player to read a novel before learning the
 * game.
 */

export const OPENING_SLICE_TARGET_MINUTES = Object.freeze({
  minimum: 30,
  maximum: 45,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function dialogue(block) {
  return block.trim().split('\n').map((row) => {
    const divider = row.indexOf('|');
    if (divider < 1) throw new Error(`Malformed opening-slice dialogue row: ${row}`);
    return {
      speaker: row.slice(0, divider).trim(),
      line: row.slice(divider + 1).trim(),
    };
  });
}

function scene(beatId, block) {
  return { beatId, dialogue: dialogue(block) };
}

export const OPENING_SLICE_SCENES = deepFreeze([
  scene('p00-delivery-in-rain', `
NARRATOR|Cold rain threads between Hoshigawa's shuttered homes. Ren keeps a sealed district packet beneath his sleeve.
HEADMAN|You are late enough that every dog has stopped barking at you, courier.
REN|The upper road washed out. The packet stayed dry.
HEADMAN|The office stamped it before noon. Why send it after the lamps were covered?
REN|Someone wanted the message delivered after the lane stopped asking questions.
HEADMAN|Did anyone follow you?
REN|A tax rider watched the bridge and counted my steps.
HEADMAN|Then inspect the seal before this enters my house.
REN|District blue over plain hemp. The official knot is intact.
HEADMAN|And the second knot?
REN|Tied later. The hand pulled left and shook.
HEADMAN|Fear leaves a signature.
REN|So does haste. We prove what we can before accusing anyone.
HEADMAN|The levy was paid. The register was copied. No order should be waiting.
REN|Then the packet is ordinary, and the hour is the threat.
HEADMAN|Bring it beneath the eave. Leave the doorway clear.
NARRATOR|The headman holds the lamp low while rain beads on the dry seal.
REN|Before we open it, who can carry word if the lane closes?
HEADMAN|Miyo at the dye house. She knows the drainage path.
REN|Keep her name in your head, not on this paper.
HEADMAN|You sound as though you expect an arrest.
REN|I expect officials to call an addition a clarification.
HEADMAN|And if the page orders obedience?
REN|Opening an order does not make every sentence lawful.
HEADMAN|That distinction comforts clerks more than families.
REN|Then we read the original words where every family can hear them.
HEADMAN|You will witness the reading?
REN|I will witness the ink, the seal, and every added mark. I will not witness for a lie.
HEADMAN|Call Miyo quietly. We open this with the river path ready.
NARRATOR|Warm light narrows over the packet as the rain swallows the far end of the lane.
  `),
  scene('p01-altered-order', `
NARRATOR|Two hands of ink share the page: the district order and darker strokes still shining wet.
HEADMAN|Household totals by next market day. That is the order I expected.
COLLECTOR|Continue.
HEADMAN|The added lines demand occupations, guests, and devotional objects before dawn.
REN|Those lines were not in the packet when it left the office.
COLLECTOR|Couriers carry orders. They do not interpret them.
REN|Then you will not object when I read the original aloud.
HEADMAN|The lane has already paid what the district required.
COLLECTOR|Tonight the district requires names.
REN|Neighbors—hear the office wording, and hear what was added afterward.
COLLECTOR|When the bell rings, your distinction will not matter.
NARRATOR|Covered windows open one finger-width as Ren begins to read.
  `),
  scene('p02-medicine-across-lane', `
KIKU|The Mori child needs this before the bell. I need both hands here.
REN|I can carry a bottle.
KIKU|Then carry the bottle. Let someone else make the speech.
REN|Mori house, blue screen, river side.
KIKU|Correct. Do not promise safety you cannot deliver.
NARRATOR|Ren takes the open side lane while the collector argues at the porch.
MORI MOTHER|Kiku sent you?
REN|Medicine first. Questions after the fever breaks.
NARRATOR|The bottle reaches the child before the first black bell note.
KIKU|Good. A concrete task completed is worth more than a heroic promise.
  `),
  scene('p03-bailiff-returns', `
NARRATOR|The census square falls silent. Ash walks out from behind the collector's screen in the shape of a man.
NEIGHBOR|That is Sato. They took him at noon.
COLLECTOR|The Bailiff will complete the count.
REN|No. He is still someone you took.
KIKU|The river marks are ready. Three attacks, then the lane opens.
REN|Everyone behind the low wall. Move when the red line leaves the river path.
COLLECTOR|You cannot kill an officer of the census.
REN|I am not here to kill him.
NARRATOR|The Bailiff raises one arm. A long red warning cuts across the wet stones.
REN|Read the line. Leave it. Survive long enough to reach the river.
  `),
  scene('p04-river-escape', `
NARRATOR|Two households reach the skiffs. The river mist hides the lane they could not empty.
REN|Two houses made it. I saw the marks on the others.
KIKU|Then remember which doors.
REN|Sato stopped when the bell cracked. For one breath, he knew me.
KIKU|Write that he was there. Do not reduce him to what they made.
REN|I should have saved the whole lane.
KIKU|Grief is not a map, Ren.
REN|No.
KIKU|But named doors are a beginning.
NARRATOR|They mark the missing households before the rain erases the footprints.
  `),
  scene('p05-archive-promise', `
NARRATOR|At dawn, Ren places a hot black fragment in an empty tray at the shrine archive.
AYA|Takamine's seal. This did not come from an ordinary census bell.
REN|The collector escaped. The lane did not.
AYA|Then we follow what he altered.
REN|A copied name cannot free anyone.
AYA|It can prove a person existed when an office says otherwise.
REN|And if proof leads to another locked door?
AYA|We bring the person and the proof through it together.
REN|All right. No more private chase.
AYA|Good. Help me keep these names from becoming numbers.
  `),
  scene('c1-01-registers-omissions', `
AYA|Official register. Courier packet. Collector's copy.
REN|The same family appears in two and becomes a black circle in the third.
AYA|The circle carries a ferry mark.
REN|Someone moved the record before moving the people.
AYA|Mark the household as missing, not erased.
REN|Recoverable lead?
AYA|Until we have exhausted every road.
NARRATOR|Aya enters the household in her casebook and draws a line toward the ferry.
  `),
  scene('c1-02-kikus-threshold', `
KIKU|A Lantern sign means someone will hear a request. It does not mean they owe you danger.
AYA|We need a ferry rumor.
KIKU|Then bring medicine to the landing first. Need travels faster than proof.
REN|We can take the supply path or go directly.
AYA|Either way, the other road remains open.
KIKU|Good. A network survives because refusal is allowed.
REN|We carry the medicine.
NARRATOR|Kiku turns the hidden token face down and places the bundle on top of it.
  `),
  scene('c1-03-ferry-gossip', `
DOCK WORKER|The captain took sealed crates uphill. Paper, oil, rope. No food.
AYA|Takamine supplies.
REN|And the clerk who copied the list?
DOCK WORKER|Old tax storehouse. They took him for knowing what the circles meant.
AYA|Did the captain choose the route?
DOCK WORKER|He chose to be paid. The collector chose the cargo.
REN|Then we rescue the clerk before we settle accounts with either.
NARRATOR|Aya marks the flooded cedar road without writing the worker's name.
  `),
  scene('c1-04-flooded-cedars', `
NARRATOR|Ren's first cut slides from a soot-hardened hide.
AYA|Your blade did not fail. It told you what the hound was made to resist.
REN|Cut is weak. What opens it?
AYA|Read the Ledger. The throat seam takes Pierce.
REN|And the wisps?
AYA|Radiance separates their paper ash. Umbral feeds it.
REN|So the damage numbers are evidence.
AYA|Exactly. Keep moving while an attack cools, then choose the right answer.
  `),
  scene('c1-05-storehouse-clerk', `
CLERK|I copied what they gave me. I did not know the circles meant arrests.
AYA|When did you learn?
CLERK|When the same names returned on prisoner tags.
REN|Tell her how the copies moved. Then we get you out.
CLERK|Ferry to storehouse. Storehouse to Takamine. One copy went inside the thing next door.
AYA|May I record your account?
CLERK|If you write that I understood too late.
AYA|I will write exactly that.
REN|The exit is behind you. We face the ledger after you are clear.
  `),
  scene('c1-06-copy-before-fire', `
REN|The false ledger is below. Burn it before it eats another name.
AYA|After we copy what survives.
REN|If it tries to eat them first, watch the seal beneath its jaw.
AYA|It opened after Consume Ink. The weakness and the crime belong in the same account.
CLERK|Then write that I helped you find both.
AYA|Exactly that.
REN|Copy fast.
NARRATOR|Aya ties the saved pages shut before Ren feeds the weaponized original to the fire.
AYA|The supply manifest points to Takamine's service gate.
REN|Then we arrive before the next midnight registry.
  `),
  scene('c2-01-rain-gate', `
NARRATOR|Takamine's official lamps burn above a gate closed before sunset.
AYA|They expect someone—or they do not want anyone to see who leaves.
REN|The supply permit is still readable.
AYA|The cart carries blank forms, fresh ink, and no food.
REN|A prison supplied as an office.
AYA|The main gate is theater. The service path is the working route.
REN|We use their permit until the paper stops protecting us.
NARRATOR|Aya marks the cedar threshold and keeps the permit dry.
  `),
  scene('c2-02-chapel-service-route', `
PRISONER|Do not stop. They count footsteps.
AYA|Then count ours. We will not write your name without permission.
REN|How many cells?
PRISONER|Six below. Two here. A foreign priest keeps the keys.
AYA|We will come back with the door open.
PRISONER|Promise the door, not the rescue.
REN|The door, then.
NARRATOR|They secure the service path and mark both grates for the return.
  `),
  scene('c2-03-lises-interruption', `
NIKOLA|Step away from the lock.
REN|You first.
AYA|You wear their permit. He stole their key. Neither is an introduction.
NIKOLA|Count Nikola Dražanić of Branik.
AYA|That is a title, not authority over this lock.
NIKOLA|Fair. I am hunting the man who bought this black alloy through Ragusa.
REN|You crossed the world for a piece of metal?
NIKOLA|For the vampire who thinks it makes a throne lawful.
AYA|Look at this fragment. Do not touch it.
NIKOLA|The Severed Dragon pattern. The apostate below believes my house extinct.
REN|Help us open the cells, and surprise him in person.
NIKOLA|At last, a sensible introduction.
  `),
  scene('c2-04-bell-stair', `
NARRATOR|A cedar groan warns each beam before it sweeps the stair.
NIKOLA|In my country, old towers lean. Here they attack.
REN|The tower is honest. It warns us.
AYA|Watch one cycle. Cross on the silence.
NIKOLA|No dramatic leap?
REN|No leap at all.
NARRATOR|They cross one landing at a time and light the checkpoint lantern.
AYA|If we fall back, we return here. Precision is not cowardice.
  `),
  scene('c2-05-undercrypt-truth', `
AYA|These name slips are tied to the buried bell.
NIKOLA|Not tied. Fed. Someone made a mouth and gave it names.
REN|Then we break its teeth.
AYA|First read the brazier: Storm turns marked water to Chill.
NIKOLA|Dry ground, Pierce against the shield, Radiance against the court ward.
REN|And the moths first. Fewer attacks to read.
NARRATOR|Beyond the flooded archive, a bell-room key turns in a lock by itself.
MATEUS|You have brought me a courier, an archivist, and a family embarrassment. How industrious.
  `),
  scene('c2-06-name-from-europe', `
MATEUS|Dražanić. The Severed Dragon survived the archive fire.
NIKOLA|Disappointed?
MATEUS|I am deciding whether your title has grown longer than your lance.
REN|You can compare them after the cells open.
MATEUS|Kurozane ordered me to retrieve Nikola and erase the witnesses.
AYA|And what will you do?
MATEUS|What I have always done. Call obedience prudence until the blood dries.
NIKOLA|Then let us interrupt the habit.
MATEUS|Break the Blood Wards or force me below one fifth. I will not make you murder me to win.
NARRATOR|After the duel, Mateus kneels beneath the cracked bell while Nikola keeps the lance lowered.
NIKOLA|You knew my house because you translated the Dracul precedent.
MATEUS|I translated it—and wrote part of the cipher that turns denunciation into command.
REN|You expect trust for confessing after defeat?
MATEUS|No. Use what I know before Kurozane makes it useless.
AYA|Information first. Judgment remains with the people named in your work.
MATEUS|A better arrangement than I deserve.
REN|Open the cells.
NARRATOR|Mateus places the key on the floor. Ren pulls the lever; six doors open into the cold chamber.
NIKOLA|You are coming with us.
MATEUS|As prisoner, source, or penance?
AYA|As a source under watch. Do not promote yourself.
MATEUS|Madam, I would not dare.
  `),
]);

export const OPENING_SLICE_BEAT_IDS = Object.freeze(
  OPENING_SLICE_SCENES.map(({ beatId }) => beatId),
);

const SCENE_BY_BEAT_ID = new Map(
  OPENING_SLICE_SCENES.map(({ beatId, dialogue: lines }) => [beatId, lines]),
);

export const OPENING_SLICE_DIALOGUE_METRICS = deepFreeze({
  sceneCount: OPENING_SLICE_SCENES.length,
  dialogueLines: OPENING_SLICE_SCENES.reduce((sum, entry) => sum + entry.dialogue.length, 0),
  dialogueWords: OPENING_SLICE_SCENES.reduce((sum, entry) => (
    sum + entry.dialogue.reduce((lineSum, row) => (
      lineSum + row.line.trim().split(/\s+/u).filter(Boolean).length
    ), 0)
  ), 0),
});

export function isOpeningSliceBeat(beatId) {
  return SCENE_BY_BEAT_ID.has(beatId);
}

export function getOpeningSliceDialogue(beatId) {
  return SCENE_BY_BEAT_ID.get(beatId) ?? null;
}

export function getOpeningSliceProgress(completedBeatIds = [], currentBeatId = null) {
  const completed = new Set(completedBeatIds);
  const completedSceneCount = OPENING_SLICE_BEAT_IDS.filter((beatId) => completed.has(beatId)).length;
  const currentSceneNumber = currentBeatId == null
    ? null
    : Math.max(0, OPENING_SLICE_BEAT_IDS.indexOf(currentBeatId)) + 1 || null;
  return deepFreeze({
    complete: completedSceneCount === OPENING_SLICE_BEAT_IDS.length,
    completedSceneCount,
    requiredSceneCount: OPENING_SLICE_BEAT_IDS.length,
    currentSceneNumber,
    targetMinutes: { ...OPENING_SLICE_TARGET_MINUTES },
  });
}

const OPENING_SLICE_NEXT_STEPS = deepFreeze({
  dialogue: { id: 'dialogue', label: 'Continue dialogue' },
  field: { id: 'field', label: 'Show field objective' },
  battle: { id: 'battle', label: 'Open encounter briefing' },
  choice: { id: 'choice', label: 'Show story choice' },
  storyworld: { id: 'storyworld', label: 'Continue consequence' },
  next: { id: 'next', label: 'Go to next scene' },
  feedback: { id: 'feedback', label: 'Finish opening feedback' },
});

export function getOpeningSliceNextStep({
  complete = false,
  feedbackRequired = false,
  interactionKind = '',
  narrativeComplete = false,
  choicesComplete = false,
  operationComplete = false,
  battlesCleared = false,
  fieldRouteComplete = false,
  storyworldPlacement = '',
} = {}) {
  if (complete) {
    return feedbackRequired
      ? OPENING_SLICE_NEXT_STEPS.feedback
      : OPENING_SLICE_NEXT_STEPS.next;
  }
  if (storyworldPlacement === 'before-beat') return OPENING_SLICE_NEXT_STEPS.storyworld;
  if (interactionKind === 'battle') return OPENING_SLICE_NEXT_STEPS.battle;
  if (interactionKind === 'field') return OPENING_SLICE_NEXT_STEPS.field;
  if (!narrativeComplete) return OPENING_SLICE_NEXT_STEPS.dialogue;
  if (!choicesComplete) return OPENING_SLICE_NEXT_STEPS.choice;
  if (!operationComplete) return OPENING_SLICE_NEXT_STEPS.field;
  if (!battlesCleared) return OPENING_SLICE_NEXT_STEPS.battle;
  if (!fieldRouteComplete) return OPENING_SLICE_NEXT_STEPS.field;
  if (storyworldPlacement === 'after-beat') return OPENING_SLICE_NEXT_STEPS.storyworld;
  return OPENING_SLICE_NEXT_STEPS.next;
}

export function getOpeningSliceGuidance({
  complete = false,
  feedbackRequired = false,
  interactionPrompt = '',
  interactionKind = 'field',
  narrativeComplete = false,
  choicesComplete = false,
  operationComplete = false,
  battlesCleared = false,
  fieldRouteComplete = false,
  pendingEncounterName = '',
  storyworldPlacement = '',
} = {}) {
  if (complete) {
    return feedbackRequired
      ? 'The cells are open and Mateus has yielded. Complete the feedback before anyone explains the game.'
      : 'The cells are open and Mateus has yielded. The opening chapter is complete; continue when ready.';
  }
  if (storyworldPlacement === 'before-beat') {
    return 'Resolve the displayed decision before continuing the scene.';
  }
  if (interactionPrompt) {
    if (interactionKind === 'battle') {
      return `${interactionPrompt} Open the encounter briefing and begin when ready.`;
    }
    return `${interactionPrompt} Move with WASD or Q/E/Z/C; interact with X or Enter.`;
  }
  if (!narrativeComplete) {
    return 'Continue the scene with N or the dialogue button. When the story asks you to act, follow the gold field objective.';
  }
  if (!choicesComplete) {
    return 'Choose the displayed story response to record how the party proceeds.';
  }
  if (!operationComplete) {
    return 'Follow the gold marker. Move with WASD or Q/E/Z/C; interact with X or Enter.';
  }
  if (!battlesCleared) {
    return pendingEncounterName
      ? `Enter ${pendingEncounterName}. Its battle screen teaches the controls and the immediate counterplay.`
      : 'Enter the displayed encounter. Its battle screen teaches the controls and the immediate counterplay.';
  }
  if (!fieldRouteComplete) {
    return 'Follow the gold route marker and use the lit exit with X or Enter.';
  }
  if (storyworldPlacement === 'after-beat') {
    return 'Record what this scene changed before continuing the journey.';
  }
  return 'This scene is complete. Choose Next scene to continue.';
}
