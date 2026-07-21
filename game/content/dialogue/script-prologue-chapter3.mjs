function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function dialogue(block) {
  return block.trim().split('\n').map((row) => {
    const divider = row.indexOf('|');
    if (divider < 1) throw new Error(`Malformed dialogue row: ${row}`);
    return {
      speaker: row.slice(0, divider).trim(),
      line: row.slice(divider + 1).trim(),
    };
  });
}

export const SCRIPT_PROLOGUE_CHAPTER3 = deepFreeze([
  {
    beatId: 'p00-delivery-in-rain',
    before: dialogue(`
NARRATOR|Cold rain threads between Hoshigawa's shuttered homes, leaving each covered lamp alone in the lane.
HEADMAN|You are late enough that every dog has stopped barking at you, courier.
REN|The upper road washed out. I carried the packet under my coat and my complaints in my mouth.
HEADMAN|Keep the complaints. The packet came from the district office, and its messenger came after sunset.
REN|The clerk stamped it before noon. Someone held it six hours while the river climbed the pilings.
HEADMAN|Did anyone follow you from the ferry bend?
REN|A tax rider watched the bridge. He counted my steps but did not dirty his boots.
HEADMAN|That is almost worse than following. Come beneath the eave before your sleeves flood my floor.
REN|I stay here. If this concerns one household, the others should not see my sandals at your door.
HEADMAN|It concerns every household whenever officials decide privacy is a favor they can withdraw.
NARRATOR|A child shifts behind the warm doorway; the headman closes the screen without exposing the room.
REN|The packet weighs less than last month's grain notice and carries twice the sealing cord.
HEADMAN|Our levy was paid. The fishing register was copied. No complaint is waiting in my box.
REN|Then the office has discovered a new way to make finished work unfinished.
HEADMAN|You joke when you are frightened, just as your mother did when the river broke its bank.
REN|I joke when someone asks me to deliver trouble and forbids me from reading its name.
HEADMAN|You are permitted to inspect a damaged seal. Has this one been disturbed?
REN|Not by rain, knife, steam, or a clerk pretending not to own fingernails.
HEADMAN|And the cord?
REN|District blue over plain hemp. The blue knot is official. The second knot was tied elsewhere.
HEADMAN|Elsewhere in the office, or elsewhere on the road?
REN|I cannot prove either. I can tell you the second hand pulled left and shook while tying.
HEADMAN|Fear leaves a signature even when a person is forbidden to sign.
REN|So does haste. We should not turn a crooked knot into an accusation.
HEADMAN|Spoken like a courier who has been blamed for messages he did not compose.
REN|Spoken like someone who wants the right person blamed when the message begins biting.
HEADMAN|The lamps were ordered covered an hour ago. No one has explained why.
REN|Kiku's clinic still burns bright. She will not hide a fever to satisfy a patrol.
HEADMAN|That is why I worry first for her doorway and then for mine.
REN|Before you open this, name one person who can carry word if the order closes the lane.
HEADMAN|Miyo at the dye house. She knows the drainage path and owes no official an honest answer.
REN|Good. Keep her name in your head, not on the packet. Now let me check the edge once more.
    `),
    after: dialogue(`
HEADMAN|Because a routine order does not wait for darkness, and a routine messenger does not study escape routes.
REN|The office asked for delivery, not obedience. Opening it does not make every sentence lawful.
HEADMAN|That distinction comforts clerks. It rarely comforts families standing before armed men.
REN|Then we separate what the page says from what someone later claims it says.
HEADMAN|You will witness the reading?
REN|I will witness the ink, the seal, and every added word. I will not witness for a lie.
HEADMAN|Stand beside the table, then. Leave the doorway clear if anyone needs to leave quickly.
NARRATOR|The headman turns toward the table while rain beads on the intact seal in Ren's lowered hand.
REN|Call Miyo without raising your voice. Tell her only that the river path may be needed.
HEADMAN|And if the order is harmless?
REN|Then she loses a few dry minutes, and I apologize before morning.
NARRATOR|Warm light narrows across the packet as the screen closes on the watching lane.
    `),
  },
  {
    beatId: 'p01-altered-order',
    before: dialogue(`
NARRATOR|Porch light catches two shades of ink: an orderly office hand and darker strokes still shining wet.
HEADMAN|The first paragraph requests household totals before the next market day. That is inconvenient, not impossible.
COLLECTOR|Continue. The night has enough rain without your pauses adding to it.
REN|He reads at his own table. You can wait for the punctuation.
COLLECTOR|Couriers should know that punctuation has never stopped an arrest.
HEADMAN|The second paragraph asks for occupations, dependents, and temporary guests by dawn.
NEIGHBOR|My sister's family is stranded here because the ferry stopped. Are they guests or dependents?
COLLECTOR|They are names. Give them plainly and let the district decide what they mean.
HEADMAN|This line says declarations may be delivered at the office within three days.
COLLECTOR|The district revised its schedule after your packet departed.
REN|A revision needs a seal, a clerk's countersign, and a page that was not folded in somebody's sleeve.
COLLECTOR|You have become remarkably educated during one wet walk.
REN|I became educated after paying twice for another man's altered delivery mark.
HEADMAN|Your black ledger already contains our house symbols. Who supplied them?
COLLECTOR|Prior records. Efficient government remembers what villagers conveniently forget.
NEIGHBOR|That circle is beside the Mori house, but their entry is three lines lower.
COLLECTOR|Then perhaps their conduct moved faster than their ink.
REN|Do not answer that. He wants a voice to attach to the mark.
COLLECTOR|I want cooperation before the census bell makes cooperation unnecessary.
HEADMAN|There is no bell authority in the packet.
COLLECTOR|There is authority in the men carrying it to the square.
NARRATOR|Beyond Ren, shutter gaps brighten as neighbors draw close enough to hear without entering the porch.
REN|Read the final office line exactly, including the date and the permitted delivery place.
HEADMAN|Household answers are due at the district office three days from issuance.
COLLECTOR|And the amended demand requires names, household ties, foreign contamination, and immediate surrender of suspect objects.
NEIGHBOR|What does contamination mean when written by a man who will not define it?
COLLECTOR|It means the court need not debate your private vocabulary.
REN|Show us where those words appear beneath the district seal.
COLLECTOR|They appear where I have written them, under delegated necessity.
HEADMAN|You wrote across the margin after the packet was opened.
COLLECTOR|I completed an incomplete instrument. Your gratitude may be silent.
REN|Move your hand. If the addition is lawful, it will survive being seen.
    `),
    after: dialogue(`
NEIGHBOR|We heard four extra demands and no second seal. Is hearing enough to protect anyone?
HEADMAN|Hearing together keeps him from telling each house a different sentence.
COLLECTOR|A crowd repeating an error does not turn it into law.
REN|Nor does a collector repeating an invention. The original order remains here in the office hand.
COLLECTOR|Read it publicly and you make yourself responsible for whatever resistance follows.
REN|Responsibility begins with the person who changed the demand. Mine begins with deciding whether silence helps him.
HEADMAN|The lane can hear from this porch if the screen is opened.
NEIGHBOR|Kiku is crossing toward the clinic. She can carry the wording past the square.
COLLECTOR|Choose carefully, courier. Paper cuts deepest when officials remember who unfolded it.
REN|And memory cuts both ways when a whole lane hears the same page.
NARRATOR|The original order lies unobscured between Ren's fingers as listening windows brighten through the rain.
REN|The words are ready. The question is whether I lend them my voice before yours replaces them.
    `),
  },
  {
    beatId: 'p02-medicine-across-lane',
    before: dialogue(`
NARRATOR|Steam rolls from Kiku's clinic into the blue rain while a corked bottle clicks against her tray.
KIKU|If you came to repeat the order, use the waiting room. Sick people deserve accurate bad news.
REN|The original grants three days. The collector invented tonight's surrender and whatever he calls contamination.
KIKU|Good. Now say it without expecting the truth to lower anyone's fever.
REN|What happened here while we argued?
KIKU|The Mori child's breathing tightened. Their mother cannot cross the square without passing the census table.
REN|I can bring them here.
KIKU|Moving a frightened child through cold rain is not the first treatment I would prescribe.
REN|Then I bring the treatment. Which bottle?
KIKU|Not until you show me both hands and tell me whether a patrol touched your sleeves.
REN|No patrol, no blood, no ash. Only rain and one collector's temper.
KIKU|Temper travels. Wash at the basin, then hold the lamp where I can see your palms.
NARRATOR|Ren rinses road grit away while Kiku measures powder into a narrow paper fold.
REN|The lane is blocked by their records cart.
KIKU|The side lane remains open between the dyer's wall and the empty storehouse, beyond the patrol's direct view.
REN|A broken axle narrows it to one person.
KIKU|Then be one person. Precision is useful when bravado occupies too much space.
PATIENT|Physician, will the bell ring before my husband returns from the boats?
KIKU|I do not know. Drink this while it cools, and keep your shoes beside you.
REN|You have everyone prepared to leave.
KIKU|I have everyone prepared to choose. Those are not the same arrangement.
REN|Miyo knows the drainage path. The headman has her ready to carry word.
KIKU|Miyo has an old knee and three people depending on her. Do not turn readiness into command.
REN|I asked for a messenger, not a conscript.
KIKU|Intent is invisible when spoken by someone standing between a door and danger.
REN|Then I ask her face-to-face, with the door behind her and room to refuse.
KIKU|Better. First, this bottle reaches Mori without announcing why their house was circled.
REN|The collector circled them before asking a single question.
KIKU|Which means his ledger may be hunting an answer already supplied by someone else.
REN|Should I warn every marked house on the way?
KIKU|You should not turn one open path into six promises and arrive after the child's breath fails.
REN|One bottle, one house, one return route. I understand.
    `),
    after: dialogue(`
KIKU|Keep it upright. The dose line is charcoal, and rain will blur it if your thumb rubs the label.
REN|What should I tell the mother?
KIKU|One spoon now, another after the coughing loosens, and no smoke in the room.
REN|And about the census?
KIKU|Tell her the side lane is open. Let her decide what that knowledge requires.
PATIENT|The cart moved closer to the clinic while you spoke.
KIKU|Then our useful distance is shortening. Ren, look from this threshold and choose every step before taking the first.
REN|Dyer's wall, broken axle, rain barrel, Mori door. No crossing the square.
KIKU|If someone calls your name, the bottle remains the task. Pride can wait under an eave.
REN|I can do small work without making it sound small.
KIKU|Prove that with your feet. The lane is open now, and nothing guarantees it stays open.
NARRATOR|The pale medicine label aligns with the white route mark beyond Ren's waiting hand.
    `),
  },
  {
    beatId: 'p03-bailiff-returns',
    before: dialogue(`
NARRATOR|The census square falls silent before the black bell throws a breath of ash across the rain.
NEIGHBOR|The Mori shutters are closed. Ren came back alone. Did the medicine reach them?
REN|It reached the child's hand. Save questions for the river path and keep the eastern lane clear.
COLLECTOR|No one leaves until the count is complete.
HEADMAN|Your legal count is due in three days. Your invented one ends at this porch.
COLLECTOR|The court has prepared a more persuasive reader for stubborn households.
KIKU|That bell has no village rope. Who carried it here?
COLLECTOR|People who understand that obedience should not depend on local craftsmanship.
REN|Everyone behind the grain bins. Do not cluster at the river marker.
NEIGHBOR|My father cannot crouch that low.
REN|Use the rain trough. Keep his shoulder below the square window and move only when I point.
KIKU|Miyo has the south houses. I have the clinic group. Ren, count the open stretch.
REN|Seven paces to the first barrel, four to the woodpile, six to the river lane.
HEADMAN|There are children in the dye house.
KIKU|Their mother has them under the floor passage. Do not call them into the square.
NARRATOR|A single bell stroke swallows the rain sound; black grains climb instead of falling from the mud.
NEIGHBOR|Something is walking behind the census screen.
COLLECTOR|Present every unrecorded person, and the Bailiff may find no correction necessary.
REN|You knew what the bell would do before you wrote those circles.
COLLECTOR|I knew the district would supply what your village refused to name.
KIKU|The ash is gathering around footprints from noon.
HEADMAN|Sato's footprints. He stood there when they bound him.
REN|Do not rush him if he comes through. Whoever remains inside may hear us.
NEIGHBOR|They took Sato for arguing over his sister's entry. He never carried a weapon.
COLLECTOR|His present office carries sufficient authority.
KIKU|Authority does not change the name his mother gave him.
REN|Miyo, show the first household the white river mark. Wait for my open hand.
MIYO|I will show them. I will not leave the second household without their grandmother.
REN|Agreed. No one separates them to save time.
NARRATOR|Ash armor clears the screen at a human height, rain hissing where it meets Sato's altered shoulders.
KIKU|His left hand still closes when he hears his name.
REN|Then keep saying it, but stay outside the red line forming under the bell.
    `),
    after: dialogue(`
KIKU|Sato, your sister waits beyond the south roofs. You are not the title they gave you.
COLLECTOR|Sentiment will not change his activation. The bell has already entered your defiance.
REN|We do not need to change the bell here. We need three openings and a road behind us.
HEADMAN|The first families are ready, but the river route is unmarked past the woodpile.
MIYO|Give me the chalk. My knee can still draw a line faster than frightened feet can find one.
REN|Mark only the safe stones. Leave the deep bank blank so nobody mistakes it for a shortcut.
KIKU|The attack line sweeps after the bell's red pulse. Move before striking, not after wishing.
NEIGHBOR|Are we supposed to fight Sato?
REN|We are supposed to keep his neighbors alive and deny the collector another body.
COLLECTOR|Run, then. The count follows every household attached to your names.
REN|Names can lead people home as easily as they lead your men to doors.
NARRATOR|Ren's open hand turns toward the river route as the first red telegraph cuts across the square.
    `),
  },
  {
    beatId: 'p04-river-escape',
    before: dialogue(`
NARRATOR|River mist softens the far bank where two shuttered skiffs hold blankets, wet shoes, and breathing families.
KIKU|Set the coughing child nearest the charcoal pan, but leave enough air between them and the coals.
MIYO|The grandmother crossed last. She refused the boat until she counted every grandchild twice.
REN|She was right. I counted one red sleeve twice and nearly left the smallest behind.
HEADMAN|The dye-house family is together. The Mori family is together. Sato's sister is not here.
KIKU|She took the south drainage path with the clinic group. I saw her pass the willow marker.
REN|Saw her, or saw someone carrying her shawl?
KIKU|Saw her face, heard her curse the mud, and watched her choose the rear skiff.
REN|Good. I needed the whole answer.
MIYO|You need to sit before your knees make that choice without you.
REN|The collector can reach the upper ford in an hour. We need watchers on both banks.
HEADMAN|I will take the western bend.
KIKU|You will stay where your people can ask what happened. Send someone without a public office.
MIYO|I know the reed cutters. They can watch without carrying a village title on their backs.
REN|Ask, do not assign. Tell them the patrol may follow the white marks.
MIYO|I listened when Kiku corrected you the first time.
NARRATOR|Kiku counts blankets, pulses, and pairs of shoes before approaching Ren at the incomplete route map.
KIKU|Your right sleeve is burned.
REN|The fragment landed in my dispatch pouch when the bell cracked.
KIKU|Put the pouch on the stone. Slowly. Burned cloth can hide heat longer than skin admits.
REN|If it rings again, throw it into the river.
KIKU|No. We do not poison a river because a courier is tired of carrying evidence.
HEADMAN|Can the fragment call the Bailiff after us?
KIKU|I do not know. That is why nobody touches it with bare hands or confident guesses.
REN|Four doors still had black circles when we left the square.
MIYO|One family may have used the mill road before the bell.
REN|May have is not a person standing here.
KIKU|Neither is blame. Give me the doors in order.
REN|Potter's corner, Sato's house, the basket maker, and the widow beside the north well.
HEADMAN|The basket maker sleeps at his son's farm this week.
REN|Then one mark may point to an empty room while three point to people.
KIKU|That difference is why memory must become a map before exhaustion edits it.
    `),
    after: dialogue(`
MIYO|I have charcoal and the back of a fish invoice. Speak while your road is still in your legs.
REN|Draw the square first. Put the collector's table south, the bell west, and every marked door exactly where it stood.
HEADMAN|What of Sato?
KIKU|Write his name beside the bell, not beneath it. His condition does not erase the taking that came first.
REN|The route saved two houses because people carried each other, not because my chalk defeated anything.
MIYO|No one here mistook chalk for courage. We used it because it told wet feet where to go.
KIKU|Aya Shinohara is at the shrine archive with rolls rescued from the rain. She can compare these marks.
REN|An archivist will want the fragment kept dry and the account kept exact.
KIKU|An archivist will want the people fed before questioning them. Aya knows records serve lives or serve power.
HEADMAN|Take her the map. I will remain where returning families know to look.
REN|I will go after the watchers report. No more leaving on an assumption.
NARRATOR|Charcoal route marks dissolve into rows of names waiting on Aya's archive table.
    `),
  },
  {
    beatId: 'p05-archive-promise',
    before: dialogue(`
NARRATOR|The shrine archive is dry but unsettled, with bowls beneath leaks and copied names raised above the floor.
AYA|Place the pouch in the empty tray. Do not set it beside the rescued rolls.
REN|Kiku said you would ask about people before paper.
AYA|How many crossed the river under their own names?
REN|Two households together, a clinic group by the south path, and watchers now checking the mill road.
AYA|How many doors remained marked?
REN|Four that I saw. One may have been empty. I will not subtract it until someone confirms that.
AYA|Good. Uncertainty belongs in the account, but it does not belong disguised as absence.
REN|Sato returned inside ash armor. The collector called him a Bailiff as if a title repaired abduction.
AYA|Did Sato respond to anyone?
REN|His left hand moved when Kiku named his sister. He was still inside whatever the bell made.
AYA|Then record the response. Do not promise what it means, and do not let the court claim there was nothing left.
REN|You make grief sound like inventory.
AYA|Inventory counts objects. An archive preserves relations, testimony, contradiction, and the right to correct me later.
REN|The collector is climbing toward the district road while we correct brush strokes.
AYA|And if you catch him alone, whom will his office say you attacked?
REN|A liar with a black ledger.
AYA|He will say a lawful collector, killed by a frightened courier who destroyed the only record.
REN|I did not say kill him.
AYA|You said pursue him while your jaw offered the rest of the sentence.
NARRATOR|Aya turns the fragment until a shallow temple seal catches the archive lamp without touching burned cloth.
REN|The mark resembles a bell tower behind three cedar strokes.
AYA|Takamine's store seal. It appears on ritual metal accounts, roof timber orders, and nothing sent to Hoshigawa.
REN|So the collector brought temple property to perform a census.
AYA|Or someone routed a temple instrument through the district and used the census to test it.
REN|There were black circles in his ledger before anyone answered.
AYA|Which means the questions justified decisions already recorded elsewhere.
REN|Can these damaged rolls tell us who supplied the names?
AYA|Not alone. Your sealed packet, the headman's copy, the route map, and this impression can contradict one another productively.
REN|That is an archivist's way to describe a fight.
AYA|A fight is loud enough to hide weak claims. Comparison forces each claim to remain on the table.
REN|Then show me the first claim that can lead back to a door.
    `),
    after: dialogue(`
AYA|The collector's ferry mark repeats beside a missing household, but the official register preserves their kinship line.
REN|A copied name becomes a trail if someone refuses to treat the blank as finished.
AYA|Exactly. We mark the omission, ask the living, and follow the transport route toward Takamine.
REN|You intend to come.
AYA|I intend to carry my casebook where its evidence is being manufactured and its people are being moved.
REN|The office will call that theft.
AYA|The office may inspect my citations when it produces an honest page and an unharmed witness.
REN|If I take the fragment to you instead of reporting it, my courier seal is finished.
AYA|That is your cost to weigh. I will not turn your anger into my authority.
REN|And if I choose the office?
AYA|I copy what you told me and continue without your fragment, slower and less certain.
NARRATOR|Aya slides a blank casebook page toward Ren while the evidence tray remains between equal sides of the table.
    `),
  },
  {
    beatId: 'c1-01-registers-omissions',
    before: dialogue(`
NARRATOR|Morning gray reveals three documents aligned across Aya's table and one household-sized silence between their marks.
AYA|Before we follow a road, tell me which page you believe and why.
REN|The official register. It was copied before the collector arrived.
AYA|Age does not make a record honest. It only gives dishonesty more time to become familiar.
REN|Then the headman's copy, because he read it before the black ink appeared.
AYA|His copy preserves the order, not every household. Useful evidence, incomplete reach.
REN|My packet carries the district seal and the original delivery date.
AYA|And your testimony establishes custody from office to porch. Now we have three limited things that overlap.
REN|You enjoy making certainty surrender one finger at a time.
AYA|Certainty should surrender whatever it cannot defend. People have been punished for less courtesy.
NARRATOR|Aya unlocks the village register while Ren unfolds the courier packet parallel to its ruled columns.
REN|The Mori line is present here. Their circle in the collector's ledger had no relation to this entry.
AYA|Look below it. The ink circle replaced the Hara household, then a later hand shifted the Mori mark upward.
REN|So one mark concealed a family and implicated another.
AYA|A single alteration can scatter harm efficiently when officials pretend columns are neutral.
REN|The Hara family traded baskets near the north well. Their workshop was empty last week.
AYA|Empty by choice, by travel, or after removal?
REN|I do not know. The headman mentioned a son across the river, but not which family.
AYA|Then write the uncertainty beside the kinship line, not across the name.
REN|Why use a removable marker instead of copying the blank directly?
AYA|Because a blank can be corrected. Ink that declares disappearance becomes another official pretending to know too much.
REN|There is a small hook beside the circle.
AYA|Ferry notation. Cargo uphill, payment deferred, receiver unstated.
REN|Names were entered as cargo.
AYA|Or the notation points to papers copied before people moved. We distinguish sequence before accusation.
REN|That restraint would impress me more if the collector had shown any.
AYA|His failure is not permission for ours. Our account must survive a hostile reader and a frightened witness.
REN|What can the fragment impression add?
AYA|Its Takamine seal matches the ferry receiver's abbreviated temple mark.
REN|Then the missing household, the false census, and the broken bell share a route.
AYA|They share marks. The landing can tell us whether the route carried crates, records, or people.
REN|And if the ferrymen refuse to speak?
AYA|We ask what work changed, what supplies moved, and who stopped appearing. Testimony need not begin as confession.
    `),
    after: dialogue(`
REN|The gap is small enough that a hurried reader would pass it without noticing.
AYA|That is why omissions serve power well. The page appears calm while a household loses its place.
REN|Give me the marker.
AYA|Decide what it says first. A mark can preserve a question or smother it.
REN|Missing household; last known trade at the north well; possible kin across the river; movement unconfirmed.
AYA|Add that the ferry symbol appears in another hand. Do not merge two people's decisions into one convenient culprit.
REN|You expect the casebook to be read by someone who wants us wrong.
AYA|I expect it to be read by people whose safety depends on finding our mistakes before the court exploits them.
REN|The landing opens at first bell. We can ask Kiku for the network sign on the way.
AYA|We can ask. A sign requests attention; it does not purchase trust or labor.
NARRATOR|Aya holds the removable marker beside the absent line while the ferry map waits beyond both documents.
REN|Then let the page keep the family recoverable, and let the road test what we think we know.
    `),
  },
  {
    beatId: 'c1-02-kikus-threshold',
    before: dialogue(`
NARRATOR|Mortar, drying herbs, and ferry damp mingle in Kiku's courtyard while work continues behind a privacy screen.
KIKU|Stop at the threshold. The person behind that screen did not agree to become part of your investigation.
AYA|We need no patient names. We need the sign used to request a conversation at the landing.
KIKU|Requests grow teeth when carried by armed travelers. Set your sword outside, Ren.
REN|The collector's riders may pass this road.
KIKU|Then lean it where your hand cannot close around it before your manners return.
REN|I remember your lesson.
KIKU|Memory is cheap. Distance between steel and a clinic bed is visible.
NARRATOR|Ren rests his sheathed blade beside the rain barrel and returns with both hands open.
AYA|The missing Hara household carries a ferry mark. We want to ask who moved sealed crates uphill.
KIKU|And the landing workers should risk wages, patrol attention, and family safety because your page has a careful margin?
AYA|No. They should decide after hearing exactly what we know and what we cannot protect them from.
KIKU|Better. What will you do if they decline?
REN|Watch cargo ourselves and ask public questions about route prices.
KIKU|Public questions announce your interest before they earn a useful answer.
AYA|Then we begin with work they already need done and accept that help does not buy testimony.
KIKU|Now you sound almost practical.
REN|Almost?
KIKU|Your boots say you planned a straight road through a town full of obligations.
PATIENT|Physician, the landing runner left this bundle. He said the salve jars must reach the ferry before noon.
KIKU|And there is the crooked road arriving on schedule.
AYA|What prevents your apprentice from taking it?
KIKU|A fever in the east room and three dressings due before the tide turns.
REN|We can carry the bundle.
KIKU|You can choose to carry it. Do not dress my shortage as your invitation to heroics.
AYA|What does delivery require beyond reaching the marked stall?
KIKU|Keep the jars upright, avoid the flooded culvert, and obtain a receipt from the woman with the blue cord.
REN|And if we go directly to the ferry?
KIKU|The medicine waits safely here until my runner returns. No patient dies because you follow your urgent lead.
AYA|So the route is useful, optional, and honest about its reward.
KIKU|Its reward is medicine arriving sooner. Anything the dock workers offer afterward remains theirs to choose.
REN|Show us the network token before we decide.
    `),
    after: dialogue(`
KIKU|Face down means listen without approaching. Face up means the holder permits one plain question.
AYA|And the diagonal notch?
KIKU|Someone nearby is unsafe. Leave, remember the place, and do not expose the person who warned you.
REN|The ferry road splits beyond your gate: medicine path left, direct landing right.
KIKU|Both remain open. Urgency does not turn one into a moral examination.
PATIENT|The rain has eased over the culvert, but the lower boards are still underwater.
KIKU|Use the stone edge if you carry the bundle. Careful feet, no jumping with glass jars.
AYA|At the landing we ask about paper, oil, rope, and the missing clerk without writing anyone's face.
KIKU|You ask one question at a time, after the work crews choose where to speak.
REN|We have the route, the bundle, and the option to leave the bundle here without penalty.
KIKU|Then choose based on the time you can carry, not the virtue you hope to display.
NARRATOR|Kiku turns the network token face down and places the medicine bundle beside the diverging roads.
    `),
  },
  {
    beatId: 'c1-03-ferry-gossip',
    before: dialogue(`
NARRATOR|Wet rope creaks against ferry posts while labor continues around conversations no one announces as secret.
REN|The woman with the blue cord signed for six salve jars and counted seven twice.
AYA|She counted the sealed jar separately because its dose is different. You nearly corrected the correct person.
REN|I noticed before opening my mouth. Growth can be silent.
FERRY WOMAN|If you two finished admiring yourselves, move the empty crate out of the rain channel.
REN|Where does it belong?
FERRY WOMAN|Under the red awning, stamp upward. Ask before lifting the cracked side.
AYA|We can move it together and leave your crew's stacking order unchanged.
FERRY WOMAN|Do that, and perhaps someone will decide your questions are less troublesome than your posture.
NARRATOR|Ren and Aya carry the crate through active ropes, waiting twice while workers signal loads overhead.
BOATMAN|You came from Kiku. Her medicine buys gratitude, not information.
AYA|Agreed. Which ferry rates are public today?
BOATMAN|People, grain, roof tile, and sealed district cargo all cost differently.
REN|Why does sealed district cargo cost more when no one may inspect its weight?
BOATMAN|Because officials pay for silence and complain when silence has a spine.
AYA|Did that rate change after the overnight census order?
BOATMAN|It changed three days before. Someone expected more sealed loads.
FERRY WOMAN|That is public enough. Do not press him for a face he must see again tomorrow.
AYA|Understood. We can ask about the goods without asking who rowed them.
NET MENDER|Paper crates went uphill. Oil followed. Rope followed. Food did not.
REN|Temple repairs without provisions for workers.
NET MENDER|Or workers who are not expected to eat where the books can see them.
AYA|Were the crate marks all from one office?
NET MENDER|District seal outside, Takamine hook beneath. One had a north-well basket fiber caught under its cord.
REN|The Hara workshop used that reed.
AYA|It could be reused packing material. We record connection, not certainty.
FERRY WOMAN|A clerk objected to the weights. Young fellow with ink permanently under one thumbnail.
REN|Where did he go?
FERRY WOMAN|Two men escorted him to the abandoned tax storehouse beyond the flooded cedars.
AYA|Did he leave any copy or message with the crew?
BOATMAN|He tapped the third paper crate and said the numbers had learned to travel without owners.
REN|That sounds like a warning from someone who understood the list too late.
    `),
    after: dialogue(`
FERRY WOMAN|The cedar path is ankle-deep, and ember hounds have been seen near the dry ridge since yesterday's sealed cargo passed.
AYA|We have salve, a marked route, and no reason to drag workers away from the tide.
REN|What does the clerk look like, if he wants to be found?
FERRY WOMAN|He may not. Ask him before you make his description part of your case.
AYA|Then we look for a locked room, fresh copying supplies, and a person who chooses whether to name himself.
NET MENDER|The storehouse roof sags east. Enter west unless you enjoy debating wet beams with your skull during a patrol visit alone.
REN|Any patrol schedule?
BOATMAN|One rider at midday, two near dusk. That is observation, not a promise.
AYA|We will treat it as time-sensitive and uncertain.
FERRY WOMAN|Take the dry ledge when the cedars split. The lower water hides roots sharp enough to stop a boot.
REN|You have given us a route. We will not attach your names to it.
NARRATOR|A swinging cargo rope reveals the flooded cedar road and three sealed loads climbing toward Takamine.
    `),
  },
  {
    beatId: 'c1-04-flooded-cedars',
    before: dialogue(`
NARRATOR|Rain dimples shallow water while ember flecks move between cedar roots ahead of the abandoned storehouse.
REN|The dry ledge begins past that fallen trunk. We can reach it if we cross the narrow water first.
AYA|The hounds are circling the same crossing. They understand the route better than we do.
REN|Then we force them away from it.
AYA|Or observe what they protect, resist, and expose before spending strength on an assumption.
REN|You have a tool named Analyze. This would be a dramatic moment to explain it.
AYA|It records visible reactions in the Ledger. It does not whisper secret truth into my ear.
REN|So I must strike the dangerous animal before the book admits it is dangerous.
AYA|You may watch its movement, inspect its hide, or use a quick attack to test one delivery type.
REN|Its plates overlap backward along the shoulder. A cut will slide with the grain.
AYA|Good. What remains exposed when it lunges?
REN|The seam beneath the foreleg, if I stand somewhere its teeth are not.
AYA|That condition improves most tactics.
NARRATOR|The nearest Cinder Hound lowers its head, tracing a clear lunge lane through the rippling water.
REN|Red line from muzzle to stump. I can move two spaces and keep enough Pace for a quick thrust.
AYA|Do not spend a long technique until you know what Recovery leaves you inside.
REN|You make combat sound like balancing transport accounts.
AYA|Both punish people who pretend time and distance are free.
REN|The second hound hangs behind it. If I flank, it can reach you.
AYA|I will stand beyond its lunge and keep the Ledger open. Protecting me does not require blocking my choices.
REN|You have practiced saying that.
AYA|Archivists frequently meet men who confuse standing in front with taking responsibility.
REN|Point received. I move right, test the shoulder, then reassess.
NARRATOR|Ren's blade crosses the plated hide with a bright skid and almost no wound.
REN|That should have bitten deeper.
AYA|The Ledger marked resistance at contact. The hide refused the delivery, not the strength behind it.
REN|And the seam flashed pale when it twisted.
AYA|Likely Pierce vulnerability, still unconfirmed until a thrust lands.
REN|The first failure gave us enough to avoid repeating it.
AYA|Only if pride does not demand a louder version of the same mistake.
REN|Pride is currently interested in keeping its fingers attached.
AYA|Then open the Ledger before the hound's next activation and choose the exact property to reveal.
    `),
    after: dialogue(`
REN|The readout separates Cut, Pierce, Ember, and Storm instead of calling the creature simply strong.
AYA|Specific knowledge creates specific options. A vague warning usually serves the person giving it.
REN|If Analyze confirms the seam, I can thrust from the flank and end outside the second lunge.
AYA|Yes, but check your Pace after movement. A perfect angle reached too late is still a bad position.
REN|The dry ledge also holds a supply chest.
AYA|Optional, visible, and reachable by careful steps. We do not need to pretend the road requires a new power.
REN|First the crossing, then the chest if our Recovery allows it.
AYA|First the question in front of us: spend this activation learning, or gamble on another untested strike.
REN|The hound's telegraph is widening. The decision will not wait for a lecture.
AYA|It never does. That is why the Ledger must make its answer readable at a glance.
NARRATOR|The resistance glyph settles beside the exposed seam as the Analyze command waits under Ren's cursor.
REN|Show me exactly what the hide refuses, and I will choose where the next point lands.
    `),
  },
  {
    beatId: 'c1-05-storehouse-clerk',
    before: dialogue(`
NARRATOR|Dust hangs over damp account books while firelight pulses beneath the locked room beyond the clerk's cell.
REN|The west door was barred from outside. Whoever locked you here expected the roof to finish the work.
CLERK|Do not come closer. They said anyone carrying a fragment would make the ledger wake.
AYA|I am placing my brush on the floor. The exit is behind Ren, and he will step aside.
REN|I am moving left. You can see the cedar path from where you stand.
CLERK|Are the district riders gone?
REN|One passes at midday, two near dusk. We have an observed gap, not safety.
CLERK|Then I should run before you ask what I copied.
AYA|You may. Your account belongs to you even when we urgently need it.
CLERK|That sounds generous from someone who already opened my door.
AYA|It is not generosity. A forced statement would repeat the process we are trying to expose.
REN|The next room contains something moving around a brazier. We cannot remain here long.
CLERK|The collector fed it rejected pages. At night it scratched wherever a name was crossed out.
AYA|Did you see the pages before they were rejected?
CLERK|I copied household lists from ferry receipts onto temple forms. The circles looked like accounting marks.
REN|People told you the clerk at the landing objected to the weights.
CLERK|I objected after the third crate. The totals counted children as units and widows as unclaimed property.
AYA|What did the supervisor say?
CLERK|He said categories prevent sentiment from ruining efficient transport.
REN|And you continued copying.
CLERK|For two pages. Then I changed one route mark and tried to hide the original list.
AYA|Where is it now?
CLERK|Behind the loose hearthstone. Unless the thing in the ledger ate it.
REN|Late resistance is still later than the people on those pages needed.
CLERK|I know. I kept expecting one more proof before risking my position.
AYA|Knowing the harm now does not erase the pages you completed. It can shape what you do next.
CLERK|You want testimony.
AYA|I want an exact description of hands, copies, routes, and orders, if you freely choose to provide it.
CLERK|Will you promise the court cannot find me?
AYA|No. I can promise to omit your name until you choose otherwise and separate your account from identifying details.
REN|I can promise to clear the cedar exit before the riders return. That is the task within my reach.
CLERK|Then show me the route before you open your casebook.
    `),
    after: dialogue(`
CLERK|The first copy went to the district office, the second uphill, and a third into the black ledger room.
AYA|Did one person order all three?
CLERK|The collector ordered the first and third. A Takamine receiver signed for the second with a bell-hook mark.
REN|That matches the ferry crates and the fragment seal.
CLERK|The manifest is under the hearthstone. It lists paper, oil, rope, blank confessions, and one sealed chamber key.
AYA|If I write your process now, you may review every line and stop before giving a name.
CLERK|Write that I understood the categories before I understood the arrests. Do not make ignorance cleaner than it was.
REN|The thing beyond that door just struck the wall.
AYA|We have time for one deliberate choice, then we clear the weapon and leave by the west route.
CLERK|Open the casebook. I will describe the copying table, but my name waits until I can speak it publicly.
AYA|That boundary goes at the top of the page, before any useful detail.
NARRATOR|Aya offers the uncapped brush handle-first while the clerk keeps the visible exit nearest his hand.
    `),
  },
  {
    beatId: 'c1-06-copy-before-fire',
    before: dialogue(`
NARRATOR|The defeated Tithe Hound collapses into soot around a false ledger whose exposed seal still pulses by the brazier.
REN|It is down, but the names keep moving under the cover.
AYA|Do not touch the binding. The seal consumed ink whenever we struck before its Recovery opened.
CLERK|That cover holds the third copy. I recognize the red thread I used at the copying table.
REN|Can the thing rise again?
AYA|Its bell cord is severed. The instrument is inactive, not harmless.
CLERK|The collector said fire would erase any clerical mistake once the transport was complete.
REN|For once, his method is tempting.
AYA|Fire destroys the weapon and every contradiction trapped inside it.
REN|The people are already gone. What good is preserving the page that carried them away?
AYA|The route annotations can lead Kiku to families, identify receivers, and prevent the court from calling each disappearance unrelated.
REN|They can also teach another collector how to rebuild the ledger.
AYA|Which is why we copy evidence selectively, record custody, and destroy the operational binding afterward.
CLERK|I can identify which columns are transport instructions and which are household details.
REN|You helped design those columns.
CLERK|I copied the supervisor's layout and suggested abbreviations that made it faster.
AYA|Then your knowledge can limit what we preserve and establish how the system worked.
REN|That sounds close to letting the author edit his confession.
AYA|He reviews his testimony. I decide what the archive cites, and later witnesses can contradict both of us.
CLERK|Do not leave me alone with the original. I still hear it scratching when the room is quiet.
NARRATOR|A line of ember crosses the floor but stops short of the clean copy sheets Aya places beyond the furnace glow.
REN|How long for names, annotations, and the Takamine manifest mark?
AYA|Six minutes if the clerk reads, I write, and you keep soot from crossing the workspace.
REN|Riders may arrive in eight.
CLERK|The west trail gains three minutes if the dry ledge remains clear.
REN|It does. I checked after the battle.
AYA|Then our constraint is real but not impossible. Panic does not get to shorten the account without argument.
REN|Start with every household circle.
AYA|Start with the legend explaining what circles mean. A list without its mechanism can be dismissed as coincidence.
CLERK|The hook means uphill transfer. Double hook means a person moved without a witness signature.
REN|There are twelve double hooks.
AYA|Copy each adjacent name exactly, including crossed characters. A correction can reveal who changed the destination.
    `),
    after: dialogue(`
CLERK|The final annotation names Kurozane’s experimental local registry beneath Takamine Bell Temple.
AYA|And the receiver's seal matches Ren's fragment impression. Tie that sheet separately.
REN|The furnace draft is strengthening. We cannot carry the original through the cedar firebreak.
AYA|We do not need to. The evidentiary copy is complete, witnessed, and marked with what we omitted.
CLERK|Write that I verified the abbreviations and that my earlier work helped create them.
AYA|Already written. Accountability does not begin by making you uniquely monstrous or conveniently innocent.
REN|The false ledger remains a weapon even without the hound standing over it.
AYA|Yes. Once the bundle is tied and moved toward the exit, destruction no longer erases the only trail.
CLERK|Kiku can use the copied kinship lines without seeing the transport cipher.
AYA|Exactly. Different work receives only the information it requires.
REN|Then the choice is finally what I wanted it to be: preserve the names, destroy the instrument, follow the receiver.
NARRATOR|Clean sheets wait beside the exit while the soot-dark ledger lies within reach of the furnace and Ren's decision.
    `),
  },
  {
    beatId: 'c2-01-rain-gate',
    before: dialogue(`
NARRATOR|Rain runs down Takamine's sealed gate while official lamps burn over a road carrying no food carts.
REN|The public inscription promises shelter until evening. The bar went down before sunset.
AYA|Promises carved in wood are easy to admire after someone closes the door beneath them.
REN|Our supply permit expires at midnight. The guard can reject it by waiting without speaking.
AYA|Then we make the inspection concrete before delay becomes an invisible refusal.
GATE GUARD|Temple deliveries use the eastern yard tomorrow morning. Return when the bell marks first light.
REN|This permit lists the western receiving room and today's date.
GATE GUARD|The receiving room is under repair.
AYA|The roof tiles above it are dry, the drainage chain is straight, and no repair workers entered at the ferry.
GATE GUARD|Archivists should inspect archives, not gutters.
AYA|Gutters record whether a roof has been opened. They are less obedient than clerks.
REN|We have paper, lamp oil, and rope declared on the manifest. Where should we leave them dry?
GATE GUARD|Under the awning until a receiver comes.
REN|There is no food in our cart because our cover follows the manifest. The other cart also carries none.
AYA|Yet its wheel sank deep enough for a load heavier than blank paper.
GATE GUARD|Touch district cargo and your permit becomes evidence of trespass.
REN|An interesting threat from someone who claims our permitted destination does not exist.
NARRATOR|Aya shields their permit from rain and angles it toward stacks of unstamped forms visible beneath canvas.
AYA|Fresh ink, blank confession sheets, and wax sized for thumb seals. None belongs in a roof repair.
REN|The rope is cut into wrist lengths.
AYA|Say only what we can see. Short lengths, doubled knots, no stated purpose.
GATE GUARD|Your receiver has declined the delivery. Leave now.
REN|Who declined it?
GATE GUARD|You are not authorized to know temple personnel.
AYA|Then mark the refusal on our permit with your station and time.
GATE GUARD|No mark is required for a rejected load.
REN|Without one, the district says we abandoned supplies and charges the village.
AYA|He wants us gone without creating a page that admits the gate closed early.
REN|The service path behind the cart reaches the chapel wall.
AYA|Its boards are wet but recently used. Mud points inward, not out.
REN|We can inspect the cart without crossing the gate line.
AYA|We can choose to inspect. The guard has made the risk visible, and the service route remains our likely objective.
    `),
    after: dialogue(`
GATE GUARD|Step away from the district cart. Last warning.
REN|Your hand is on the alarm cord, but the bell rope beside it has already been cut.
AYA|The cart inventory could establish prisoners are being prepared before we enter, or alert the temple to our purpose.
REN|Either way, the main gate is theater. The cedar service path is the actual route.
AYA|If we inspect, we read only visible labels and leave every seal intact.
REN|If we do not, we keep the permit unchallenged a little longer.
GATE GUARD|Decide whether you are carriers or thieves.
AYA|Those are not the only categories available, regardless of how your form is printed.
REN|The wheel track reaches the overlooked boards. One close look gives us the cargo and the path together.
AYA|Then the task is precise: inspect without opening, record without taking, withdraw before the alarm hand closes.
NARRATOR|Rain pools beneath the cart as its blank forms and the cedar service path share the edge of view.
REN|We have a narrow moment to learn what enters this temple when food does not.
    `),
  },
  {
    beatId: 'c2-02-chapel-service-route',
    before: dialogue(`
NARRATOR|Cedar walls narrow around two prisoner grates while footsteps repeat in counted groups beneath a bell drone.
REN|Four guard steps from the corner to the lamp, three back, then a pause near the key rack.
AYA|The pause is long enough to cross, not long enough to force a lock quietly.
PRISONER|Keep walking. They punish anyone who makes the service crews look toward us.
REN|We are not a service crew.
PRISONER|Your permit hangs like theirs. From inside the grate, paper wears every face the same.
AYA|I am holding my casebook closed where you can see it. Do you want us to stop?
PRISONER|I want the stamping table overturned. Wanting has not made the corridor safe.
REN|What do they force you to stamp?
PRISONER|Blank sheets. They fill the accusations later and say our marks approved the words.
AYA|May I write that without your name or cell number?
PRISONER|Not while the guard can count silence. Match his steps if you speak.
NARRATOR|Aya walks at grate height, timing each quiet question beneath the returning guard's footfall.
AYA|First step: blank sheets. Second: marks taken before text. Third: later accusation.
PRISONER|Fourth: families threatened if we refuse. Do not soften that because it crowds your rhythm.
REN|The western latch has a return spring. Opening it from here would ring the small brass tag.
PRISONER|The rear lock has no tag. A guard carries its key to the stair every sixth circuit.
AYA|Is the second grate connected to this cell block?
PRISONER|Different room, same stamping table. Ask them separately. Our accounts should not borrow each other's certainty.
REN|You sound like Aya.
PRISONER|Then Aya sounds like someone who has been made to sign another person's sentence.
AYA|I have copied such sentences. That is not the same harm, but it taught me where coercion hides.
PRISONER|Good. Keep walking before empathy becomes another reason the guard looks here.
REN|I am marking the return route on the inner beam. One chalk stroke, low enough to miss casual inspection.
AYA|A mark can expose the cell if a guard notices it.
PRISONER|Put it beneath the split knot. We already use that crack to track flood height.
REN|Your route, your placement. Done.
SECOND PRISONER|The next guard sleeps after the water bell if no alarm has sounded.
AYA|Do you consent to a separate note about the second stamping room?
SECOND PRISONER|Yes, but call me second witness. My name waits until the door opens.
REN|The rear lock is ahead. We can return with the key instead of breaking the tagged latch now.
AYA|Then our promise needs a mechanism: find key, open rear route, signal twice, escort by the marked boards.
    `),
    after: dialogue(`
FIRST PRISONER|Do not say you will save us. Say which door you can open and when.
REN|Rear door, after we secure the bell-room key, before the midnight registry begins.
AYA|If the route closes, we return to the grate and tell you. We do not let silence impersonate a plan.
SECOND PRISONER|Two guards may become one after the water bell. Being seen changes the fight, not our right to leave.
REN|No failure loop, then. We adapt to whoever remains awake.
AYA|I can take both witness notes now, with no names, if each of you still agrees.
FIRST PRISONER|Take mine. Include that we chose separate accounts.
SECOND PRISONER|Take mine, and include the family threat exactly.
NARRATOR|A key turns beyond the torn screen; an unfamiliar hand enters frame at the rear lock.
REN|Someone reached our mechanism before us.
AYA|Blade low, permit visible, questions first. The prisoners have waited long enough for strangers to posture.
PRISONER|Go. The footsteps are counting again, and the rear lock is deciding for you.
    `),
  },
  {
    beatId: 'c2-03-lises-interruption',
    before: dialogue(`
NARRATOR|A torn paper screen stirs between three strangers, one stolen key, and a corridor about to fill with guards.
NIKOLA|That permit bears a lawful Takamine seal. Explain why an authorized carrier is opening a court lock incorrectly.
REN|Your key says thief. Your boots say you landed on the expensive side of quiet.
NIKOLA|I landed where the guard stopped being attached to it.
AYA|Is he dead?
NIKOLA|Sleeping with a headache and fewer professional options.
REN|That answer was almost reassuring.
NIKOLA|I was not offering reassurance. I was measuring whether you would shout before thinking.
AYA|The prisoners behind us have already endured enough measurements made without consent.
NIKOLA|Then explain why two apparent carriers are mapping their locks.
REN|Explain why an armed foreign traveler is collecting keys from a prison chapel.
NIKOLA|Because a black-alloy bell crossed an ocean after burning an archive that should have remained beyond its reach.
AYA|That is a claim, not an introduction.
NIKOLA|Names are expensive in buildings that stamp blank confessions.
AYA|So are misunderstandings when a patrol is thirty steps away.
REN|Twenty-four now. The guard shortens his western circuit when the rain strikes that window.
NIKOLA|You counted. Good. You may be an unusually observant liar.
REN|And you may be an unusually talkative thief.
NIKOLA|Count Nikola Dražanić of Branik. In your language, I seek the evil bell beneath this honorable prison.
AYA|Aya Shinohara. You called the prison seasick, but your meaning survived.
REN|Ren Ishikawa. Is Branik a county, or does the Count title travel without one?
NIKOLA|A frontier does not wait for a distant clerk to ratify the man defending it. Dražanić will suffice here.
AYA|Suspicion can remain. The local task cannot. We need the rear cell lock opened before midnight.
NIKOLA|I need the bell-room route before whoever owns this key notices his belt feels philosophical.
REN|Those goals share a stair.
NIKOLA|Until the landing, perhaps. After that, no one stands behind me.
AYA|Reasonable. No one stands behind Ren either; his pride takes the entire width.
REN|I had begun to respect your mediation.
NIKOLA|I respect it more with each sentence.
NARRATOR|Nikola shows the key in an open palm while keeping his blade lowered and the escape route unobstructed.
AYA|You mentioned black alloy. We carry evidence from a bell used against Hoshigawa households.
NIKOLA|Evidence in what form?
REN|A fragment with Takamine's store seal, wrapped and recorded.
AYA|We can show it without surrendering custody, if doing so creates a shared factual basis.
    `),
    after: dialogue(`
NIKOLA|If the fracture shows three hooked veins, it belongs to a network larger than this tower.
REN|And if it does not?
NIKOLA|I return the key to no one, open your prisoners' door, and continue alone with less certainty.
AYA|If it matches, you join this route temporarily and explain only what you can substantiate.
NIKOLA|Temporarily is an excellent length for trust.
REN|You keep the blade low, I keep the fragment wrapped, and Aya keeps both of us from improving the corridor with blood.
AYA|I will keep the evidence centered. Your choices remain your own responsibility.
NIKOLA|The patrol is sixteen steps away. Your decision should become practical soon.
REN|The fragment can identify his claim, and his key can open the route we promised.
AYA|Neither exchange purchases loyalty. It creates one testable cooperation.
NARRATOR|Aya raises the wrapped alloy into the open side of their triangle as the stolen key turns in Nikola's palm.
NIKOLA|Show me the fracture, and we will learn whether three separate hunts have found the same stair.
    `),
  },
  {
    beatId: 'c2-04-bell-stair',
    before: dialogue(`
NARRATOR|Wind drives rain through the open tower while an old beam sweeps each landing after a readable cedar groan.
NIKOLA|The fragment has all three veins. Someone recast the same alloy through at least four bell mouths.
AYA|You said larger network. What establishes four?
NIKOLA|Three cuts converge toward a missing center. The pattern marks this node as an outer branch.
REN|Explain while facing the stair. The beam has begun another cycle.
NIKOLA|A man who jokes during danger is either calm or desperate to be mistaken for calm.
REN|A man who analyzes jokes during danger is using the same time less efficiently.
AYA|The beam groans high, pauses, sweeps low, and resets. Both of you may compete after crossing.
REN|First landing is six exact steps. No jump, no need to race the entire arc.
NIKOLA|The loose board at step four tilts toward the drop.
AYA|Then we mark it and leave a clear lane beside it.
REN|I cross on the low sweep, stop before the board, then signal from the landing.
NIKOLA|I go first. My coat catches less wind.
REN|Your stolen key catches more attention if it falls three floors.
NIKOLA|The key is tied. Is your confidence?
AYA|Nikola tests the first landing. Ren counts. I mark the checkpoint. That uses the strengths already visible.
NARRATOR|Nikola advances only when the beam's shadow clears, then plants both feet inside the painted safe square.
NIKOLA|Landing holds. The second beam begins half a beat after the first returns.
REN|I see it. High groan, pause, low sweep, two-count opening.
AYA|Say the count with your fingers. Wind steals voices before it steals footing.
REN|One, two, move. One, two, stop.
NIKOLA|Your silent counting is less irritating.
REN|Your safe arrival has improved my mood enough to ignore that.
AYA|The checkpoint lantern sits after the second landing. Its oil channel is dry but intact.
NIKOLA|Lighting it may reveal us below.
REN|Not lighting it means one mistake repeats the entire climb.
AYA|The shutter directs light inward. A guard outside would see only a brief edge during ignition.
NIKOLA|Then the trade is a momentary detection risk for a reliable recovery point.
REN|And we choose after reaching it, not while balancing on this beam.
NARRATOR|A collapse marker sheds pale dust two beats before a stair section drops into a catch frame below.
AYA|The falling boards reset through counterweights. The hazard is designed to frighten workers into rushing.
REN|We refuse the invitation. Step, wait, read, step.
NIKOLA|An undignified method. I approve completely.
    `),
    after: dialogue(`
REN|Second landing secure. The lantern wick is fresh, which means someone expects this route to be used tonight.
AYA|The flame would also mark this as our return point when we bring prisoners through.
NIKOLA|Assuming the return route survives what waits above.
REN|We promised a mechanism, not certainty. This is one piece we can make real now.
AYA|If lit, failure returns us here without injury or repeated performance. If dark, stealth improves slightly.
NIKOLA|The exterior patrol is facing north for another ten counts.
REN|Enough time to spark, shutter, and move before the next beam cycle.
AYA|The choice is visible: a recoverable landing against a small chance of attention.
NIKOLA|Whatever you decide, do it before the wind drowns the striker.
REN|I have the beam rhythm. Aya has the shutter. Nikola watches the patrol reflection.
NARRATOR|The checkpoint wick bends toward the undercrypt while the ignition striker waits beside Ren's hand.
AYA|One deliberate light can turn this dangerous stair into a route people may traverse twice.
    `),
  },
  {
    beatId: 'c2-05-undercrypt-truth',
    before: dialogue(`
NARRATOR|Name slips tremble above shin-deep water as cords descend from them into a buried bell mechanism.
AYA|Do not pull the first cord. It crosses five others beneath the surface.
REN|The dry alcove holds a brazier and a warning plate covered in mineral scale.
NIKOLA|The nearest slip bears my house's severed-dragon cut beneath the court annotation.
AYA|Can you separate the marks without touching the name?
NIKOLA|We are Croatian-born; our house claims Wallachian origins, which proves nothing.
REN|Why would it appear on a bell beneath a Japanese temple?
NIKOLA|The Severed Dragon covenant traveled east, perhaps sold by my line.
AYA|Those are different histories. Which does the metal support?
NIKOLA|Neither alone. I can recognize the tool, not the hand that held it.
REN|A useful limit stated without argument. We are all growing.
NIKOLA|Do not become accustomed to it.
NARRATOR|Nikola lifts one loose slip with the flat of his glove, preserving the ink while exposing its feeding cord.
AYA|The court annotation pairs a household name with a charge written later in different ink.
REN|Like the blank confessions above.
AYA|Worse in reach. These cords make every later charge feed the same bell network.
NIKOLA|Someone made accusation into fuel and bureaucracy into a mouth.
REN|Can we cut the cords without harming the people named?
AYA|Paper is not the person, but destroying the only surviving relation can help the court erase them.
NIKOLA|We release each slip, copy its routing mark, and sever only the metal feed.
REN|That takes time in water already reacting to the charged pillars.
AYA|Which is why the warning plate matters before anyone uses Storm delivery.
NIKOLA|I can scrape mineral scale without damaging the inscription.
REN|Use the wood edge, not your blade. We need readable grooves, not faster scratches.
NIKOLA|Your precision becomes charming when it stops being aimed at my motives.
REN|I am conserving suspicion for the sealed door.
NARRATOR|A blue charge travels through one marked pool, glassing its surface with cold before fading into the drain.
AYA|The water lanes change state after the pillar discharges. Dry lantern tiles remain stable.
REN|Storm may spread through the marked pools and leave Chill behind.
NIKOLA|Which can trap the person who casts it if they mistake range for safety.
AYA|The plate likely states duration and affected markings. Reading it turns hazard into a rule.
REN|The lock beyond us just moved.
NIKOLA|Someone has been listening from the bell chamber.
    `),
    after: dialogue(`
AYA|The slips are evidence and people’s relations, not switches for us to pull until a door opens.
NIKOLA|Agreed. I can release the nearest cord while Ren keeps the dry path clear.
REN|First we decide whether to clean and read the warning or enter with only our observation.
AYA|Reading costs one activation of time and may prevent repeated Chill across the party.
NIKOLA|Ignoring it preserves surprise against whoever waits beyond the lock.
REN|They already know we are here. The moving bolt settled that argument.
AYA|Then knowledge has the stronger claim, but the player still chooses when to spend the moment.
NIKOLA|The inscription edge shows a three-pulse symbol. Likely duration, not damage.
REN|Likely remains a word that can freeze a boot to the floor.
AYA|The warning is ready to inspect, the dry alcove is safe, and no sacred practice is being disturbed.
NARRATOR|A released name slip drifts toward the chamber door while the scaled brazier plate waits beside blue water.
NIKOLA|Read the rule or accept the uncertainty; afterward, we meet the person holding that bolt.
    `),
  },
  {
    beatId: 'c2-06-name-from-europe',
    before: dialogue(`
NARRATOR|The cracked bell chamber exhales cold dust after Mateus's Blood Ward breaks and his final rite gutters harmlessly.
REN|Stay down. The next strike will not stop at your ward.
MATEUS|The ward is finished. I have neither breath nor argument enough to rebuild it.
NIKOLA|You had argument enough to order guards against prisoners and call it necessity before the whole chamber heard us.
MATEUS|Yes.
AYA|Do not make a single word perform the labor of an account.
MATEUS|I ordered the witnesses contained. I intended to take the Dražanić heir alive. I intended to burn these records.
REN|And the rite that drank your blood?
MATEUS|A threat designed to look like sacrifice. It harmed me visibly so others would mistake spectacle for reluctance.
NIKOLA|Was the reluctance false?
MATEUS|The pain was real. The moral use I made of it was false.
AYA|That distinction belongs in the record.
NARRATOR|Mateus moves away from the guards' passage with empty hands while Nikola keeps the broken ward between them.
NIKOLA|Turn your left cuff outward.
MATEUS|You recognize the stitch.
NIKOLA|That cipher belonged to my teacher. You are the quarry named in the last letter he sent west.
MATEUS|I adapted his method after his death. Your hunt found the correct thief.
NIKOLA|A correct answer does not yet earn you the dignity of surrender. After whose death?
MATEUS|Miklos Dražanić's, outside Branik. I was told no student survived the archive fire.
NIKOLA|You were told what made your theft feel ownerless.
MATEUS|I accepted what made it useful.
REN|There. A complete sentence with the person responsible still inside it.
AYA|What did you adapt the cipher to do?
MATEUS|Translate denunciations into categories the court could route without carrying witnesses alongside them.
NIKOLA|You made accusation portable.
MATEUS|And made distance resemble verification. A copied mark could condemn someone no listener had ever met.
AYA|Which precedent did Kurozane commission?
MATEUS|Disputed history says Vlad III used vampirism in the 1462 Ottoman campaign; witnesses answered with the Severed Dragon covenant.
REN|That invention asserts no real vampire rite.
MATEUS|I translated its legal check: witnesses severed an immortal ruler from office and army.
NIKOLA|My house corrupted that check into hereditary purge authority.
MATEUS|Kurozane rewarded my willing translation because it made permanent rule appear lawful.
NARRATOR|Nikola notices the Dražanić mark inside the fallen bell key while approaching only far enough to read it.
    `),
    after: dialogue(`
NIKOLA|The mark names a sea route and a hunter's warning. You inverted both into a transport key.
MATEUS|Yes. I can identify the remaining keys, but that knowledge does not make me safe company.
AYA|It makes you a source whose claims require corroboration and whose movements require boundaries.
REN|The cell lever is here. Guards are moving through the passage you controlled.
MATEUS|Pull it. I can delay them by giving the counter-order in the same cipher.
NIKOLA|You remain my quarry, Avelar. Opening these cells changes how I take you, not whether I do.
MATEUS|I am not asking for forgiveness. I am naming one action available before my superiors revoke it.
AYA|The witnesses decide whether to leave. We open the doors and the marked route; we do not command their gratitude.
REN|Nikola, you stay between him and neither exit. Aya, signal the two grates. I hold the lever.
MATEUS|Place the bell key on the floor after the doors open. Do not accept it from my hand as though this were a pledge.
NARRATOR|Six cell locks wait on the lever while approaching boots answer Mateus from the dark passage.
REN|Opening the block begins an escape we can support. Whatever happens to Mateus is not absolution attached to the handle.
    `),
  },
  {
    beatId: 'c3-01-separate-arrivals',
    before: dialogue(`
NARRATOR|Market awnings divide Sodegaura into overlapping errands, languages, cargo lanes, and inspections that never quite meet.
AYA|The eastern market offers three entries and only one shared mistake: arriving together.
REN|The patrol description includes a courier, an archivist, and a foreign swordsman. They were thorough.
NIKOLA|They omitted my better coat, which wounds me more than the accusation.
AYA|Your coat is exactly why you take the broker street. Traders expect foreign cloth there.
NIKOLA|My Japanese is sufficient for prices, directions, and obvious lies. Its habit of omitting subjects is the language's defect.
REN|Use whichever insult does not close the gate.
NIKOLA|Conversation opens information, not gates. I listened when you explained that distinction repeatedly.
AYA|Good. Ren carries supply tags through the east queue. I join the registry line with copied ferry receipts.
REN|And Mateus?
AYA|He enters later with the salt porters, face covered by an ordinary rain hood and no court permit displayed.
NIKOLA|His old permit would pass faster.
AYA|It would also compel local clerks to serve the authority that harmed them. We do not use it without consent.
REN|He agreed to wait at the rope yard.
NIKOLA|He agreed because I kept his cipher ring and the porters refused to be ordered.
AYA|Both boundaries can be true. Neither transforms him into a trusted companion.
NARRATOR|Aya shifts one marker on the shared map, then folds it so no traveler carries the complete route.
REN|My segment ends at the grain scales. If the customs pole lowers, I set the blue tag on the second sack.
AYA|That means inspection delayed, not danger. Do not turn every inconvenience into an alarm.
NIKOLA|My yellow cord on the broker rail means a patrol asked after Takamine.
REN|And no signal?
NIKOLA|We continue separately until the printer's reflected window aligns with the awning stripe.
AYA|The local printer chose the meeting point. We follow her conditions and never enter the back room uninvited.
REN|What exactly do we need from her?
AYA|Port closure notices, a current customs layout, and whether witness families have a route to the lantern boats.
NIKOLA|I need a broker who knows which sealed warehouse received black-alloy salvage.
AYA|Ask as trade history. Do not expose our witnesses to improve your family search.
NIKOLA|You believe I might.
AYA|I believe grief narrows vision. Mine does too, which is why we state boundaries before the street tests them.
REN|The supply cover is ordinary enough to survive one bored inspection.
NIKOLA|Nothing survives a bored official like giving him a small error he can correct.
AYA|The third tag uses last month's rope rate. Let the clerk amend it and feel the system functioning.
REN|I dislike plans that depend on satisfying a petty appetite.
AYA|Then remember the plan serves families waiting at the docks, not your satisfaction.
    `),
    after: dialogue(`
NIKOLA|Broker street is clear for six minutes. After that, a court launch unloads inspectors near the west arch.
AYA|Registry queue advances slowly enough for me to observe the customs cage without forcing conversation.
REN|The eastern supply gate has one guard and a lowering pole. My wrong rope rate will occupy his brush.
NIKOLA|If your charm fails, do not improvise a speech about justice.
REN|I had planned a brief complaint about accounting.
AYA|Even worse. Use the cover, accept correction, and place the blue tag only if movement stops.
REN|Our paths cross once in the printer's window, but we do not gather there.
NIKOLA|A reflection confirms survival without advertising companionship.
AYA|Exactly. Local workers remain people conducting business, not scenery behind our clever entry.
REN|Then each errand stands alone, and the supply route gives us the least coercive first contact.
NARRATOR|Civilian traffic separates the three while keeping their chosen signals visible beneath the eastern awnings.
AYA|Enter as ordinary needs, learn who controls the route, and leave every local person room to refuse us.
    `),
  },
  {
    beatId: 'c3-02-the-checkpoint',
    before: dialogue(`
NARRATOR|Inspection lamps bleach color from permits while prisoner tags hang in the same ordered rows behind Genta's booth.
GENTA|Supply carriers stop at the white line. Archivists join the northern queue. Foreign brokers use the west desk.
REN|Convenient. Your categories separate everyone described in the patrol notice.
GENTA|Your observation does not alter the lanes.
AYA|Nor does the lane alter why our permit names an eastern delivery during open market hours.
GENTA|The rope rate is obsolete.
REN|We were told a clerk might enjoy correcting it.
GENTA|Do not mistake a visible error for innocence. Smugglers often carry one flaw to distract from another.
NIKOLA|And officials often discover smuggling after deciding whom they dislike. We can both recite patterns.
GENTA|You are not standing at the broker desk.
NIKOLA|The broker sent me to confirm whether your east gate accepts imported cordage.
GENTA|Name the broker.
NIKOLA|No. Her trade survives this conversation only if your question remains unanswered.
REN|Inspect the goods or reject the permit in writing. We are blocking workers behind us.
GENTA|You presume to instruct my station.
AYA|We are asking for a decision the next person can see instead of an indefinite delay no one owns.
NARRATOR|Genta takes the permit sideways, exposing a small hook hidden beneath its inspection stamp.
GENTA|Where did you obtain this tag?
REN|From a Takamine supply bundle whose declared cargo did not match its destination.
GENTA|This is not a supply annotation.
AYA|Then identify it before your staff moves anyone attached to it.
GENTA|It marks prisoner transport through a civilian gate.
NIKOLA|Your surprise is limited. How many times have you seen it?
GENTA|Enough to know it is usually covered by a valid inspection seal.
REN|And you let those covered tags pass.
GENTA|I verified seals assigned by my captain.
AYA|That answers procedure, not responsibility.
GENTA|No. I watched families become cargo because the forms arrived complete.
REN|This one did not arrive complete, so now your conscience has found punctuation.
GENTA|Your anger is earned. It does not tell me whether your evidence is genuine.
AYA|We carry copied Takamine records with custody marks, witness limits, and the cipher used to detach accusations from speakers.
GENTA|Show the copy here and you expose it to every inspector entering this booth.
NIKOLA|At last, a useful objection.
GENTA|The archive door behind my station has a blind angle from the inspection lane.
    `),
    after: dialogue(`
REN|A blind angle chosen by the person who controlled this checkpoint does not become trust.
GENTA|It becomes a place where evidence can be compared before Captain Kaji seizes it.
AYA|You may inspect one copied annotation while I retain the bundle and record exactly what you see.
GENTA|If the handwriting matches the port ledger, the transport system reaches beyond my captain's orders.
NIKOLA|And if the handwriting refuses the match?
GENTA|I still must account for the prisoner mark on a false supply permit issued through this station.
REN|You do not join us, command us, or make detained families wait while you reconsider your career.
GENTA|Agreed. I lower my staff, not the gate. You choose whether to show the copy.
AYA|The local question is narrow: can this evidence be verified without surrendering witnesses or custody?
GENTA|The archive can answer that, and my prior obedience remains part of what must be answered afterward.
NARRATOR|Genta's lowered staff points toward the archive while the copied Takamine sheet remains inside Aya's closed casebook.
REN|One page may test his claim. The decision belongs to us before his captain notices the pause.
    `),
  },
  {
    beatId: 'c3-03-ledger-customs-house',
    before: dialogue(`
NARRATOR|Salt air reaches a sealed customs archive where annotations have outlived the voices they displaced from each case.
PORT CLERK|Retainer, the archive cage requires Captain Kaji's counterseal after sunset.
GENTA|It is not sunset, and the inspection lamp remains on the day notch.
PORT CLERK|The captain ordered sunset rules at noon.
AYA|Was that order written?
PORT CLERK|He prefers instructions that leave no paper when they inconvenience the law.
GENTA|Open the cage under my station mark. Record that I requested access without his counterseal.
PORT CLERK|That record may remove both of us from our posts.
GENTA|Then you choose whether to make it. I will not borrow your risk to prove my change of mind.
AYA|We can compare from outside the bars if the relevant ledger is brought to the shelf.
PORT CLERK|That limits your view and leaves me inside my ordinary duties. I consent to that much.
NARRATOR|Aya waits beyond the cage while the clerk places the port ledger on a reading shelf between them.
REN|The hook under yesterday's inspection seal matches the tag on our permit.
AYA|And this paired mark matches the Takamine copy, though the final stroke bends differently.
GENTA|The final stroke indicates accusation verified elsewhere.
PORT CLERK|There is no elsewhere column. I asked about that and was told the court holds it centrally.
AYA|A verification without place, witness, or accountable reader.
REN|Mateus can identify whether the cipher is his, but bringing him here exposes the clerk.
PORT CLERK|The hooded porter outside has watched this shelf since entering the yard. Is that your source?
AYA|Yes. He helped design the system and has harmed people through it. You may refuse his presence.
PORT CLERK|Bring him only to the threshold. I want to hear what kind of man calls this handwriting necessary.
MATEUS|You should not have to look at me to learn that. The page is sufficient indictment.
PORT CLERK|The page did not choose its marks.
MATEUS|No. I did.
REN|State only what you know. Do not make remorse do decorative work.
MATEUS|The paired hook means an accusation may travel without its witness. The bent stroke declares a court reader substituted for testimony.
AYA|Who taught the port clerks to apply it?
MATEUS|I trained Ujiro's supervisors. They trained local offices through specimen sheets I prepared.
GENTA|I approved manifests carrying this mark.
PORT CLERK|I copied it after being told the witness column had moved. Each of us names our hand separately.
AYA|Exactly. A system can coordinate harm without dissolving individual decisions into fog.
MATEUS|This annotation is mine, not merely my design. The pressure notch beside the hook follows my injured finger.
REN|Then say its function before the clerk and accept that the account leaves this room.
    `),
    after: dialogue(`
PORT CLERK|I heard you claim the hand and explain the mark. I have not decided whether my name travels with that account.
AYA|It will not unless you choose. I can record an overhearing clerk and preserve your wording for later review.
MATEUS|Do not list me as corroborating authority. List me as the author admitting what he made.
GENTA|The ledger routes three witness families toward the salt warehouse tonight.
REN|Then the immediate task is moving those families before Kaji converts another annotation into cargo.
AYA|I can copy the route marks and Mateus's admission without copying household details beyond what the escort requires.
PORT CLERK|Use this blank receipt. Its twine color tells the lantern operator the travelers chose their own route.
MATEUS|My cipher can open the warehouse manifest, but I do not decide whether it is used.
GENTA|I will return to the checkpoint and verify which patrols Kaji moved. That is information, not a claim to join you.
AYA|First we decide whether Mateus's admission enters the casebook beside this exact page.
NARRATOR|His copied annotation waits beneath twine while the port clerk remains clearly within hearing and outside the party.
REN|Record the hand, the function, and the witness boundary; then we turn evidence into a route people can choose.
    `),
  },
  {
    beatId: 'c3-04-lantern-boat-escort',
    before: dialogue(`
NARRATOR|Rain docks glow in three route colors while families study visible risks beside a low lantern boat.
BOAT OPERATOR|I can hold departure for one tide turn. After that, the patrol chain closes the canal mouth.
AYA|We need enough time for each traveler to hear all three routes without turning urgency into command.
WITNESS|Say first who knows these risks and who only copied them from a patrol slate.
REN|I walked the warehouse lane. Cover is strong until the final crane platform.
NIKOLA|I observed the crowded market from the broker rail. Many eyes discourage arrests, but movement is slow.
GENTA|The quiet canal schedule comes from my station. A small patrol crosses twice, and water leaves little lateral cover.
WITNESS|You controlled the patrol schedule.
GENTA|I enforced it and approved prior transport through that canal.
WITNESS|Then stand farther from the route board while we discuss it.
GENTA|Understood.
NARRATOR|Genta steps behind the party line while Aya turns the map outward toward the waiting families.
AYA|Warehouse route: strongest cover, shortest distance, one crane hook may already be armed.
REN|I can hold the narrow defense point, but the platform offers little room if we are forced sideways.
AYA|Crowded route: no expected battle, many independent observers, enough delay for Kaji to prepare machinery.
NIKOLA|The crowd is not a shield we own. We move at its pace and never draw danger toward a stall deliberately.
AYA|Quiet route: fastest access to the boat, one small patrol likely, water hazards visible under blue lanterns.
GENTA|My schedule may be stale because Kaji noticed the archive delay.
WITNESS|Which route keeps children away from the cranes?
REN|Crowded market, though the extra time could arm both hooks at the boss platform later.
WITNESS|Our safety now is not less important because a later fight becomes harder for you.
REN|Agreed. I gave the tradeoff badly.
NIKOLA|The party can handle prepared hooks. Families should not be priced against our convenience.
SECOND WITNESS|The market includes people who may recognize us from the stamping room.
AYA|Recognition could bring assistance, fear, or unwanted attention. We cannot guarantee which.
BOAT OPERATOR|The warehouse lane has a covered waiting alcove if anyone needs to stop.
WITNESS|My mother cannot move quickly across open water boards.
REN|Then the quiet canal's speed may be false for your group.
GENTA|I can describe board width from duty maps, but I do not volunteer to escort unless requested.
SECOND WITNESS|Stay available. Do not stand close enough that your uniform chooses for us.
GENTA|I removed the station sash. The history remains visible without it.
AYA|No route is the righteous answer. Each preserves something and exposes something else.
    `),
    after: dialogue(`
WITNESS|Show us the final turns again, beginning from where the boat will actually wait.
AYA|Quiet canal ends at the blue post. Crowded market joins the green stair. Warehouse lane exits beneath the amber crane.
REN|I can take front or rear position after you choose, depending on which danger needs the clearest response.
NIKOLA|I can watch the water lane or broker crossings. I do not decide whose family accepts which exposure.
GENTA|I can signal a false inspection delay once. Using it may reveal my refusal to Kaji before we reach him.
SECOND WITNESS|That cost belongs to you, not to us. Do not attach a debt to it later.
GENTA|I will not.
BOAT OPERATOR|One tide turn remains. Any route chosen together will reach my lantern if we begin soon.
AYA|The board holds all known risks, including our uncertainty. We step back now.
WITNESS|Good. We will speak among ourselves, then point to the color we choose.
NARRATOR|The three lantern colors remain equal in the rain while witnesses stand closest to the choice markers.
AYA|Choose with the people who must walk it; the party's task begins after their answer.
    `),
  },
  {
    beatId: 'c3-05-gentas-order',
    before: dialogue(`
NARRATOR|Warehouse cranes hang over a family marked as cargo while dock workers stop nearby without being commanded to watch.
KAJI|The lantern boat missed its assigned inspection window. Move every passenger into sealed holding.
DOCK WORKER|That window was changed after the tide bell. We received no written notice.
KAJI|Then your ears have failed along with your discipline.
REN|The family carries a route receipt signed by the boat operator and witnessed at the dock.
KAJI|A private receipt does not outrank port security.
AYA|Show the security order, its issue time, and the charge attached to each person.
KAJI|Archivists do not conduct examinations on my platform.
AYA|Then stop presenting unsupported commands as records.
NIKOLA|The western crane is armed. Its hook line reaches the boat path if he starts the engine.
REN|I can move the family behind the salt stacks, but only if workers keep the east lane clear.
DOCK WORKER|We will clear it if the family asks us, not because an armed stranger orders the pier.
WITNESS|Clear the east lane. Keep the children beside me and do not separate our bundles.
DOCK WORKER|Heard and agreed.
NARRATOR|Kaji descends the loading ramp while Genta stands between the transport manifest and the open boat route.
KAJI|Retainer Mononobe, correct this spectacle.
GENTA|Which lawful charge authorizes holding?
KAJI|Contamination inquiry under the chrysanthemum emergency code.
GENTA|That code requires an identified accusation and a trial mark.
KAJI|The central court supplied both through sealed annotation.
GENTA|The manifest shows neither. It shows a cargo hook covering a prisoner tag.
KAJI|You verified that method for six months.
GENTA|I did.
REN|Do not let him turn prior obedience into a reason for one more obedient act.
GENTA|He cannot. It remains a reason the family may never trust my refusal.
KAJI|Your concern is sentimental contamination. Complete the transport and report for discipline afterward.
AYA|That is how systems make each harmful act feel temporary while consequences accumulate elsewhere.
GENTA|Captain, name the receiving officer at the warehouse.
KAJI|The manifest will explain custody later.
WITNESS|There has never been a later for anyone taken through that door.
DOCK WORKER|We unload salt there. No prisoner leaves through the road side.
GENTA|Then the order has no trial, no named custody, and no visible return.
KAJI|You were sworn to execute it, not compose commentary.
    `),
    after: dialogue(`
GENTA|My oath did not remove my choices. I used it to avoid naming them.
KAJI|One confession before laborers does not change your service record.
GENTA|No. It exposes one refusal while leaving the record intact for judgment.
REN|The workers need the exact order before the cranes start, not a speech about your soul.
AYA|Genta can name who commanded what, which manifest concealed it, and what he previously approved.
WITNESS|If he speaks, he does it facing us and leaves the boat path open.
GENTA|Agreed. I remove my retainer token and place it on the manifest, not in anyone's hands.
NIKOLA|Kaji is reaching for the crane signal. The public account must be brief enough to become action.
DOCK WORKER|We are listening by our own choice. Say the order plainly if the party permits the delay.
REN|This is the handoff: let him testify before the fight, or move immediately and preserve the account for custody.
NARRATOR|Genta's token waits above the hidden prisoner mark while workers, family, and open route remain in one frame.
GENTA|I am ready to name the captain's order and my own prior compliance without asking either to excuse the other.
    `),
  },
  {
    beatId: 'c3-06-first-key',
    before: dialogue(`
NARRATOR|Crane hooks settle over the rain-dark platform while dock workers bind Captain Kaji within hearing of his witnesses.
KAJI|You have attacked a court officer and stolen port machinery.
DOCK WORKER|We watched you arm hooks against a family and heard the order you gave.
KAJI|Laborers do not determine lawful custody.
WITNESS|Neither did your hidden cargo mark. We determine that we will testify to what happened here.
GENTA|Use the standard dock restraint, not my service knots. Custody belongs to those who witnessed the platform.
DOCK WORKER|You will show us how to release it safely, then step away.
GENTA|Agreed.
REN|The east lane is clear. Is every family member on the boat side of the salt stacks?
WITNESS|All present, all bundles present, and no one separated for questioning.
AYA|I will record that count only if you want it attached to the route account.
WITNESS|Record the number, not our names. We choose names after reaching the safe landing.
AYA|The boundary is written first.
NIKOLA|Kaji's mechanism has a black-alloy core beneath the crane brake.
REN|The hook housing opened when his Guard broke. Is that the bell key?
NIKOLA|One of three, shaped to align a network node toward its paired route.
AYA|We need custody before interpretation. Who recovered it?
DOCK WORKER|I lifted the brake plate. Genta stopped the engine. Nikola identified the alloy without touching it.
AYA|Good. Each hand remains distinct.
KAJI|The key belongs to the Shogun's port authority.
REN|Then the authority may explain why its key sat inside a weapon aimed at civilians.
GENTA|Do not argue ownership with him as if he can grant legitimacy. Record the location and transfer.
NARRATOR|Genta hands the binding rope to a dock worker before approaching the recovered mechanism with empty palms.
GENTA|I approved earlier manifests that moved through this port. Three families disappeared under forms I accepted.
WITNESS|Names?
GENTA|I know two household marks and one trade mark, not their chosen names.
AYA|Then give only those marks privately to the archive. Do not rename people by the categories that carried them.
GENTA|Understood. I also ordered a porter detained last winter for refusing an unsealed inspection.
DOCK WORKER|That porter was my brother. He returned after two weeks and never worked this dock again.
GENTA|I remember approving the confinement. I did not ask where he went after release.
DOCK WORKER|Your joining these travelers does not settle that.
GENTA|No. I will give him my account if he requests it and accept if he refuses contact.
REN|The immediate platform is secure. Accountability continues beyond our party formation.
    `),
    after: dialogue(`
NIKOLA|The key's inner point swings seaward no matter how I turn the housing.
AYA|Toward which chart line?
DOCK WORKER|Nagi Sea Road. A foreign wreck lies beyond the fog bank, and court divers hired passage this morning.
REN|Then they know the key's pair is still aboard.
GENTA|I can identify the patrol signals along the sea road, but local boat crews choose whether I travel with them.
WITNESS|First help the port write what happened tonight in words Kaji cannot seal away.
GENTA|Yes. The next objective does not erase this consequence.
KAJI|You think a ledger can survive the court because laborers watched one fight?
AYA|No single copy survives by confidence. We make several, assign custody by consent, and let testimony travel with context.
NIKOLA|Then we follow the key before the divers strip the wreck, carrying evidence instead of a victory story.
REN|Families depart first. Copies depart separately. Kaji remains alive to answer the voices around him.
NARRATOR|The key's point carries the frame across black water until Sodegaura's lanterns vanish inside the Nagi fog.
    `),
  },
]);
