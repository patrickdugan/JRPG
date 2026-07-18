/**
 * Authored late-game party councils.
 *
 * These finite conversations follow the canonical council plan while keeping
 * every decision bounded by consent, observable evidence, and public revision.
 */

import {
  getPartyCouncilGroupPlan,
  validatePartyCouncilPack,
} from '../party-council-contract.mjs';

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const line = (speaker, text) => ({ speaker, line: text });

const VOICES = deepFreeze({
  ren: {
    lens: 'routes, burdens, and the difference between carrying a message and issuing an order',
    risk: 'decisive movement can make my preference look like permission already granted',
    reflex: 'I look for the fastest passable route before asking who was expected to clear it',
    offer: 'I can carry notices, stand an exposed watch, and leave the decision with the people who bear it',
    commitment: 'I will not turn speed, danger, or my willingness to be hurt into authority over another person',
  },
  aya: {
    lens: 'provenance, disputed margins, missing hands, and the right to amend a public account',
    risk: 'an orderly record can harden my interpretation into an order that outlives its evidence',
    reflex: 'I reach for a clean copy when the disputed page may be the more honest object',
    offer: 'I can preserve originals, publish uncertainty, and keep correction beside the claim it changes',
    commitment: 'I will mark every inference, preserve every challenge, and surrender control of a record when its witnesses require it',
  },
  lise: {
    lens: 'named protection, inherited violence, and the limit between teaching defense and claiming command',
    risk: 'competence with danger can make my protection feel like an authority nobody was free to request',
    reflex: 'I place myself between threat and witness before learning whether my presence creates another threat',
    offer: 'I can teach a bounded defense, identify a weapon pattern, and depart when local protectors ask me to leave',
    commitment: 'I will protect named people without converting their danger into a mandate for my lineage or methods',
  },
  mateus: {
    lens: 'translated clauses, court euphemisms, and the handoff where legible language became organized harm',
    risk: 'a detailed confession can center my remorse while the people harmed become supporting evidence',
    reflex: 'I explain the cipher completely when silence and supervised labor may be the more accountable response',
    offer: 'I can expose hidden wording, identify court caches, and work under a custodian chosen by affected witnesses',
    commitment: 'I will keep my admission separate from requests for comfort and accept correction without bargaining for absolution',
  },
  genta: {
    lens: 'supply lines, command habits, withdrawal routes, and the people whom an efficient map treats as terrain',
    risk: 'a disciplined plan can reproduce command even after I remove every rank from its language',
    reflex: 'I assign the strongest worker to the narrowest failure point and call the arrangement practical',
    offer: 'I can mark loads, repair roads, and follow civilian route keepers without taking their work into my command',
    commitment: 'I will make every withdrawal visible and will not treat obedience under pressure as proof of agreement',
  },
  kiku: {
    lens: 'triage, ordinary consent, interrupted sleep, and care that continues when a person refuses explanation',
    risk: 'urgent care can become coercion when the healer assumes survival makes every demand permissible',
    reflex: 'I move toward the worst wound first and must still tell the patient what my hands are about to do',
    offer: 'I can provide care without testimony, name medical limits, and place the patient above the council schedule',
    commitment: 'I will ask before touching, separate treatment from disclosure, and keep care available after refusal',
  },
});

const SCENE_SPECS = deepFreeze([
  {
    title: 'The Road Outside the Gate',
    theme: 'The party defines the opened gate as a voluntary civic route, not a new command post or a claim over released soldiers.',
    anchor: 'the opened Black Gate road',
    setting: 'the lantern safehouse while released soldiers settle under care chosen outside the party',
    evidence: 'road keepers held the passage voluntarily, and released soldiers asked not to be treated as a captured unit',
    affected: 'released soldiers, tent healers, and the road keepers remaining outside the six-person entry party',
    tension: 'entry urgency can quietly turn voluntary support into an order that nobody feels free to refuse',
    boundary: 'the six may enter while outside allies retain control of care, departure, and access to the gate',
    proposal: 'publish a roster separating voluntary road work, medical authority, and the interior party',
    objection: 'a public roster may expose frightened workers unless each person controls the name or mark attached to a role',
    alternative: 'delay entry until every outside group has named its own stop condition and private contact route',
    proof: 'a person can leave a gate role without losing shelter, food, care, or standing among the allies',
    pressure: 'the interior party sends an urgent request while several road keepers are already exhausted',
    contingency: 'the party retreats rather than drafting replacements when the road keepers withdraw',
    repair: 'remove military labels from released soldiers and ask what names they use for themselves',
    future: 'a road kept alive by people who remain able to close it as well as open it',
    options: [
      {
        label: 'Honor the outside roster',
        action: 'post only roles whose holders approved the wording and keep medical names off the public sheet',
        safeguard: 'each road keeper controls whether a name, household mark, or anonymous role appears',
        review: 'the roster is withdrawn whenever its holders say visibility has become unsafe',
        summary: 'The gate roster distinguishes voluntary work from command and leaves identity disclosure with each outside ally.',
      },
      {
        label: 'Reconfirm every stop condition',
        action: 'visit each outside group once and record the condition under which it will close its part of the road',
        safeguard: 'the visit cannot become pressure to justify a withdrawal or extend a commitment',
        review: 'route keepers may revise the conditions through their own messenger',
        summary: 'The party records independent withdrawal conditions and accepts retreat if voluntary gate support ends.',
      },
    ],
  },
  {
    title: 'Shelves With a Pulse',
    theme: 'The three examine how to release names from a living archive without treating trapped testimony as raw material they own.',
    anchor: 'the breathing outer archive',
    setting: 'the hidden infirmary beside paper bundles that still contract when a bell node stirs',
    evidence: 'broken nodes released several names, while other sheets tightened around voices whose consent cannot yet be known',
    affected: 'people named in the pulsing sheets, their surviving households, and patients carrying echoes from the archive',
    tension: 'breaking a node may free a voice while scattering its words beyond the control of the person who spoke them',
    boundary: 'no released name is copied into a public account until provenance and disclosure wishes can be checked',
    proposal: 'map each node, release only the sheets in immediate distress, and seal every uncertain bundle separately',
    objection: 'waiting may leave voices inside the archive longer while the building continues to feed on them',
    alternative: 'open a narrow exit channel for names without copying their testimony into the party archive',
    proof: 'released sheets stop pulsing and remain traceable without forcing their words into public circulation',
    pressure: 'a distant node begins drawing loose names toward itself while the party is treating an archive-burned patient',
    contingency: 'seal the chamber and preserve an exit channel rather than breaking every node at once',
    repair: 'separate the first released names from the party notes and assign them temporary anonymous wrappers',
    future: 'an archive whose first duty is releasing people from custody rather than enlarging itself',
    options: [
      {
        label: 'Release only named nodes',
        action: 'break nodes whose sheets can be traced to a requesting household and isolate the remaining pulse network',
        safeguard: 'household connection informs release but does not grant relatives automatic control of testimony',
        review: 'each released sheet remains sealed until a legitimate disclosure route is established',
        summary: 'The party limits node release to traceable requests while keeping the resulting testimony outside automatic publication.',
      },
      {
        label: 'Map an exit before release',
        action: 'prepare a protected channel that carries freed names away from every surviving archive node',
        safeguard: 'the channel preserves separation between names instead of combining them into one convenient bundle',
        review: 'Ren closes the route if any sheet begins pulling another voice behind it',
        summary: 'The party builds a bounded release route first and stops if the archive starts joining distinct testimonies together.',
      },
    ],
  },
  {
    title: 'Custody Without Possession',
    theme: 'The council separates Ujiro’s secure escort, public testimony, and medical needs so custody cannot become another form of ownership.',
    anchor: 'Ujiro’s witness-led custody',
    setting: 'the roadside lantern after harmed witnesses accept responsibility for the prisoner’s destination',
    evidence: 'the witnesses requested a public hearing, while several ledgers still require authentication from people Ujiro displaced',
    affected: 'harmed witnesses, displaced ledger keepers, escort workers, and households whose names Ujiro treated as inventory',
    tension: 'the party’s knowledge can assist a hearing while also overwhelming the authority of the people who demanded it',
    boundary: 'witness custodians control access, and no party member trades testimony for proximity, forgiveness, or influence',
    proposal: 'publish separate terms for escort safety, evidence access, medical care, and the later hearing',
    objection: 'too much public detail could expose custodians or give former officials a map to the evidence',
    alternative: 'place sealed terms with three independent holders and publish only the rights available to Ujiro and witnesses',
    proof: 'custodians can deny party access while Ujiro still receives care and the ledgers remain available for supervised review',
    pressure: 'a former court clerk offers another ledger in exchange for a private interview with Ujiro',
    contingency: 'refuse the private interview and let witness custodians decide whether the ledger enters the hearing record',
    repair: 'return copied custody notes to the custodians and retain only the route facts they authorize',
    future: 'a hearing where security protects testimony without making the prisoner or witnesses anyone’s possession',
    options: [
      {
        label: 'Publish the custody rights',
        action: 'post the rights to care, counsel, silence, witness correction, and independent observation without exposing locations',
        safeguard: 'public rights do not include the names or routes of the people enforcing them',
        review: 'witness custodians revise the posting whenever practice fails to match its language',
        summary: 'The council publishes enforceable custody rights while withholding details that would endanger witness custodians.',
      },
      {
        label: 'Separate escort from testimony',
        action: 'assign different witness-approved teams to physical escort and ledger review',
        safeguard: 'neither team may use its task to demand access to the other team’s information',
        review: 'a disagreement pauses the handoff and returns authority to the custodians',
        summary: 'Distinct teams handle escort and evidence so physical control cannot become control over the public account.',
      },
    ],
  },
  {
    title: 'After the Offered Lives',
    theme: 'Each companion names how the tailored offers exploited a real need, then builds mutual safeguards without claiming immunity from desire.',
    anchor: 'the conservatory’s tailored offers',
    setting: 'the lantern safehouse where six refusals are remembered without turning them into claims of moral purity',
    evidence: 'each offer joined an intimate hope to another person’s obedience, silence, erasure, rank, suffering, or exposure',
    affected: 'the companions targeted by the offers and the unnamed people whose freedom would have paid for each promised life',
    tension: 'speaking a vulnerability can support mutual care while also creating knowledge that an institution could later weaponize',
    boundary: 'nobody must disclose the private shape of an offer, and refusal today does not prove permanent incorruptibility',
    proposal: 'record the coercive terms collectively while each person controls whether any personal detail is attached',
    objection: 'a collective record may flatten six different wounds into one reassuring story about unity',
    alternative: 'keep six separately held accounts with a shared index naming only the kinds of coercion used',
    proof: 'a companion can ask for help with a recurring desire without surrendering privacy or decision authority',
    pressure: 'one offer returns in a dream and the affected companion fears that admitting it will alarm the group',
    contingency: 'offer company and practical safety without demanding the dream, the original offer, or another declaration of refusal',
    repair: 'remove celebratory language from the refusal notes and name the continuing need each offer exploited',
    future: 'a party able to discuss susceptibility without converting vulnerability into suspicion or rank',
    options: [
      {
        label: 'Name the coercive pattern',
        action: 'write a shared account of how every promise transferred its cost to someone without consent',
        safeguard: 'personal details remain absent unless their owner later chooses to attach them',
        review: 'each companion may remove or revise the description of the pattern that targeted them',
        summary: 'The party records the common coercive design while leaving every private detail under its owner’s control.',
      },
      {
        label: 'Keep six separate accounts',
        action: 'let each companion choose a custodian, disclosure boundary, and destruction condition for a private account',
        safeguard: 'no account becomes evidence of fitness, loyalty, or danger within the party',
        review: 'the owner may replace silence with disclosure or disclosure with silence without penalty',
        summary: 'Each tailored offer remains separately governed, preventing a shared record from flattening distinct vulnerabilities.',
      },
    ],
  },
  {
    title: 'The Bell and the Patient',
    theme: 'The group treats bell exposure first as a condition affecting people, then as evidence, never as a shortcut to strategy.',
    anchor: 'the Yearless Bell aftermath',
    setting: 'the hidden infirmary where echoes still alter breath, balance, memory, and the behavior of nearby paper',
    evidence: 'some exposed people hear names, some lose ordinary sounds, and others show no symptom that the healers can observe',
    affected: 'bell-exposed patients, archive workers, companions carrying prior marks, and families waiting outside the ward',
    tension: 'symptoms may reveal the Bell’s structure while patients need freedom from interrogation and tactical use',
    boundary: 'treatment never depends on describing an echo, and no symptom enters strategy without specific permission',
    proposal: 'create separate care, observation, and voluntary research tables with distinct custodians',
    objection: 'separation may slow recognition of a dangerous pattern moving between patients and the archive core',
    alternative: 'use an anonymous medical signal that warns of a shared hazard without circulating patient accounts',
    proof: 'patients receive the same care after refusing observation, research, or discussion of what they heard',
    pressure: 'a new pulse crosses the ward while the archive core begins answering with the same rhythm',
    contingency: 'move patients away from the core and suspend interpretation until their immediate condition stabilizes',
    repair: 'strike tactical labels from the first symptom chart and restore the patients’ own descriptions where offered',
    future: 'a care practice capable of recognizing shared danger without converting patients into instruments',
    options: [
      {
        label: 'Triage before interpretation',
        action: 'stabilize breath, balance, and orientation before asking whether an echo carried useful information',
        safeguard: 'declining every question leaves access to treatment unchanged',
        review: 'patients decide whether their later descriptions remain medical, become public, or are withdrawn',
        summary: 'The infirmary places stabilization before interpretation and keeps every account under the patient’s disclosure choice.',
      },
      {
        label: 'Signal hazards anonymously',
        action: 'share only the minimum pattern needed to move people away from a demonstrated bell hazard',
        safeguard: 'the signal contains no patient identity, quoted testimony, or speculative diagnosis',
        review: 'Kiku withdraws the signal when observed conditions no longer support it',
        summary: 'An anonymous warning communicates demonstrated bell danger without circulating individual symptoms or testimony.',
      },
    ],
  },
  {
    title: 'What the Ward Took',
    theme: 'The companions account for Mateus’s ward-breaking rite as a bounded act he chose, not an erasure of guilt or a debt owed by survivors.',
    anchor: 'the ward cracked at dawn',
    setting: 'the roadside lantern after the protective blood rite opened a vulnerable passage through the observatory ward',
    evidence: 'the rite disabled Mateus’s destructive working, exposed the ward, and left him alive with pain requiring ordinary care',
    affected: 'Mateus, the companions who relied on the opening, people harmed by his former service, and future readers of the battle account',
    tension: 'the act mattered to survival while any heroic retelling could exchange one costly choice for unearned absolution',
    boundary: 'Mateus controls medical disclosure, harmed witnesses control whether the act affects their judgment, and neither decision cancels the record',
    proposal: 'document the rite’s tactical effect, consent conditions, lasting limit, and explicit inability to settle prior responsibility',
    objection: 'technical detail about the rite could teach another institution to demand the same act from a marked person',
    alternative: 'seal the method while publishing only its ethical conditions and observed consequences',
    proof: 'the account preserves Mateus’s agency and pain without calling the act payment, purification, or ownership of anyone’s forgiveness',
    pressure: 'allied leaders ask whether another marked survivor could be trained to reproduce the opening',
    contingency: 'refuse replication and direct questions toward dismantling wards without using a person’s body as authorization',
    repair: 'remove language that calls the rite inevitable and record the alternatives the party considered before accepting it',
    future: 'a history able to honor a bounded protective act without turning sacrifice into institutional demand',
    options: [
      {
        label: 'Publish the ethical limits',
        action: 'state the consent, supervision, alternatives, and lasting harm while withholding reproducible ritual details',
        safeguard: 'the account cannot be cited to compel another marked person to imitate the rite',
        review: 'Mateus may correct the account, while harmed witnesses separately judge what significance it carries',
        summary: 'The public account preserves the rite’s ethical limits without providing a method others could impose on marked people.',
      },
      {
        label: 'Seal the technical method',
        action: 'place the ritual sequence under independent custody and publish only the ward failure it demonstrated',
        safeguard: 'no single party member controls access to the sealed method',
        review: 'future access requires both a technical need and consent safeguards judged outside the party',
        summary: 'The technical rite remains sealed under divided custody while its observed ward weakness enters the public record.',
      },
    ],
  },
  {
    title: 'Carrying an Unfinished Archive',
    theme: 'The party divides evacuated evidence among accountable custodians while preserving disputes, separations, and the right not to circulate.',
    anchor: 'the Kurohana archive evacuation',
    setting: 'the lantern safehouse among smoke-marked bundles carried from halls that failed around the living archive',
    evidence: 'records survived in mixed condition, several bundles contain joined voices, and survivors carried material under different instructions',
    affected: 'survivors, named households, couriers, future custodians, and people whose testimony remains trapped beside official accusations',
    tension: 'rapid distribution protects against seizure while careless copying can spread accusation farther than correction can follow',
    boundary: 'no master bundle controls the account, and no copy outruns the disclosure limit attached to its source',
    proposal: 'sort materials by custody instruction before condition, subject, usefulness, or apparent historical importance',
    objection: 'some damaged instructions cannot be read without opening bundles that may forbid party access',
    alternative: 'stabilize the wrapper, record only its condition and carrier, then transfer interpretation to a witness-approved table',
    proof: 'every moved bundle keeps provenance, dispute marks, disclosure limits, and a reachable correction route attached',
    pressure: 'rain threatens the courtyard while three custodians request incompatible destinations for a joined bundle',
    contingency: 'stabilize the joined bundle without copying it and let the custodians convene after immediate danger passes',
    repair: 'restore carrier notes removed during the escape and identify every emergency handoff made without prior permission',
    future: 'a distributed archive that survives attack without treating circulation itself as truth or consent',
    options: [
      {
        label: 'Distribute clear-custody bundles',
        action: 'send only materials with readable custody and disclosure instructions to their approved destinations',
        safeguard: 'couriers receive handling directions without unnecessary access to contents',
        review: 'each receiving custodian confirms provenance or sends the bundle back unopened',
        summary: 'Clearly governed bundles travel immediately while couriers receive only the information required for safe handling.',
      },
      {
        label: 'Stabilize every disputed bundle',
        action: 'protect uncertain materials from weather and separation without deciding their ownership or publication',
        safeguard: 'condition notes describe the object without interpreting the people named inside',
        review: 'witness-approved custodians control the later opening and correction process',
        summary: 'Disputed bundles receive physical care without the party deciding custody, meaning, or permission to circulate.',
      },
    ],
  },
  {
    title: 'Charter for an Open Shelf',
    theme: 'The six draft ordinary rules that keep the public archive correctable, accessible, and unable to disguise authority as completeness.',
    anchor: 'the Hoshigawa public archive',
    setting: 'the hidden infirmary beside a first shelf for testimony, another for corrections, and an empty shelf for acknowledged gaps',
    evidence: 'residents want access through different routes, witnesses disagree about visibility, and several corrections challenge celebrated accounts',
    affected: 'testifiers, correcting witnesses, readers with limited mobility, private households, and workers maintaining the shelves',
    tension: 'public access can resist official erasure while exposing people whose safety depends on controlled disclosure',
    boundary: 'openness describes a governed route to records, never permission to expose every person or remove every seal',
    proposal: 'establish rotating witness review, private consultation, correction beside claim, and multiple forms of access',
    objection: 'rotation can become ceremonial if trained archivists retain all practical knowledge and define every agenda',
    alternative: 'pair each trained worker with a community-selected reviewer who can pause use and require plain-language explanation',
    proof: 'a correction becomes as findable as the claim it changes, while a sealed testimony remains genuinely unavailable',
    pressure: 'an official requests the entire shelf in one copy and describes restricted access as evidence of disorder',
    contingency: 'deny the bulk copy and provide only records whose custodians approved that use through ordinary public procedure',
    repair: 'move the first corrections from a rear table to the same sightline as the claims they challenge',
    future: 'a public archive that can be argued with, corrected, entered by several routes, and safely refused',
    options: [
      {
        label: 'Open correction beside claim',
        action: 'place each accepted correction at every catalogue point where the challenged account can be found',
        safeguard: 'visibility follows the correction author’s disclosure limit rather than the original claim’s reach',
        review: 'the rotating table checks whether readers can discover the dispute without archivist assistance',
        summary: 'Corrections become equally discoverable while retaining disclosure limits set independently from the challenged claim.',
      },
      {
        label: 'Seat a rotating review table',
        action: 'give community-selected reviewers authority to pause access, request explanation, and alter ordinary procedure',
        safeguard: 'archival training supports the table but does not reserve final judgment to specialists',
        review: 'terms end predictably and outgoing reviewers leave public notes about unresolved problems',
        summary: 'A rotating community table governs practical access and can interrupt specialist habits that harden into authority.',
      },
    ],
  },
  {
    title: 'Roadwork After Command',
    theme: 'Repair begins with medicine and resident direction, while Genta’s labor remains accountable without becoming a performance of redemption.',
    anchor: 'the Sodegaura medical road repair',
    setting: 'the roadside lantern beside crates awaiting delivery and a road once closed through Genta’s command chain',
    evidence: 'residents requested medicine first, marked two unsafe road sections, and assigned no ceremonial role to the former officer',
    affected: 'patients awaiting supplies, residents directing repairs, carriers, and workers who remember the former closure',
    tension: 'visible labor may repair a road while also pressuring residents to witness or affirm the worker’s personal change',
    boundary: 'care and road access do not depend on hearing testimony, accepting apology, or assigning Genta a trusted role',
    proposal: 'deliver medical crates under Kiku’s care plan, then let resident route keepers assign bounded repair tasks',
    objection: 'the party’s strength may still pull difficult work toward itself and displace local workers’ judgment',
    alternative: 'provide tools, hauling, and watch labor while residents retain design, sequencing, and inspection',
    proof: 'medicine arrives without debt and residents can reject the party’s labor without delaying access to supplies',
    pressure: 'a damaged crossing blocks the shortest cart route while one patient’s requested medicine is fragile',
    contingency: 'use the resident-marked longer path and carry the fragile crate rather than overruling the road closure',
    repair: 'remove Genta’s old unit mark from the tool cart and replace it only with labels requested by current workers',
    future: 'repair work measured by safe use and resident control rather than the former commander’s visible effort',
    options: [
      {
        label: 'Put medicine before ceremony',
        action: 'deliver every requested crate before testimony, speeches, or discussion of the former road closure',
        safeguard: 'recipients incur no obligation to attend the later account or accept party labor',
        review: 'Kiku checks access and condition with patients rather than reporting success through the party',
        summary: 'Medical delivery proceeds independently from public accounting, apology, and any request for resident approval of the party.',
      },
      {
        label: 'Let residents assign roadwork',
        action: 'offer labor and tools to the resident route table without proposing which section the party should control',
        safeguard: 'workers may decline individuals, equipment, or the entire offer while keeping the delivered supplies',
        review: 'resident inspectors decide whether completed work remains, changes, or is removed',
        summary: 'Residents direct and inspect the road labor, with an explicit right to refuse the party without losing supplies.',
      },
    ],
  },
  {
    title: 'The Lantern Without a Bell',
    theme: 'At the repaired tower, the party chooses a quiet exchange of inquiries and memory rather than closing history with a triumphant signal.',
    anchor: 'the repaired Takamine tower gathering',
    setting: 'the lantern safehouse before a final packet of people asking after one another reaches the silent tower',
    evidence: 'the packet contains questions, corrections, ordinary news, and several requests that no answer be read publicly',
    affected: 'senders, recipients, tower keepers, absent companions, and families for whom silence carries different meanings',
    tension: 'a shared lantern can mark continued relation while a public ritual may flatten grief, survival, disagreement, and refusal',
    boundary: 'the bell remains silent, private messages remain private, and nobody must attend or interpret the light alike',
    proposal: 'deliver the packet by its separate instructions, then light one ordinary lantern without naming it a conclusion',
    objection: 'even a quiet shared light can become an official symbol if the party defines its meaning for everyone',
    alternative: 'leave lantern materials with the tower keepers and let them decide whether, when, and how any light appears',
    proof: 'messages reach intended hands without public reading, and people may approach or ignore the tower without explanation',
    pressure: 'visitors ask the six to ring the repaired bell so every district will know the conflict has ended',
    contingency: 'decline the bell and explain only that no single sound can certify safety, memory, or agreement for everyone',
    repair: 'separate questions from announcements and restore every sender’s chosen route, reader, and privacy mark',
    future: 'a tower used for people asking after one another rather than an institution declaring history complete',
    options: [
      {
        label: 'Deliver the inquiry packet',
        action: 'follow each sender’s route and privacy instruction without combining the messages into a public reading',
        safeguard: 'unanswered questions remain unanswered rather than becoming invitations for party interpretation',
        review: 'tower keepers return any message whose handling instruction cannot be honored',
        summary: 'The final packet travels as separate governed messages, preserving privacy, unanswered questions, and correction routes.',
      },
      {
        label: 'Offer the silent lantern',
        action: 'leave an uninscribed lantern for tower keepers to light, alter, postpone, or refuse',
        safeguard: 'the party attaches no official meaning and asks for no attendance',
        review: 'future keepers may change the practice without treating the six as founders whose permission is needed',
        summary: 'Tower keepers control whether the ordinary lantern is used, and no official interpretation follows the light.',
      },
    ],
  },
]);

const DIALOGUE_MOVES = deepFreeze([
  (spec) => `${spec.anchor} has reached ${spec.setting}, yet arrival alone does not tell us what conduct is justified next.`,
  (spec, voice) => `My discipline begins with ${voice.lens}; for ${spec.anchor}, that lens reveals something and conceals something else.`,
  (spec) => `The report we actually possess about ${spec.anchor} says ${spec.evidence}, and confidence must not enlarge it.`,
  (spec) => `${spec.affected} hold the greatest claim on this discussion of ${spec.anchor}, even when none of them sits beside our lamp.`,
  (spec) => `Before ${spec.anchor} becomes a plan, each of us should state where another person may interrupt our authority.`,
  (spec) => `The unresolved question around ${spec.anchor} is whether ${spec.tension}; an honest council must keep that question open.`,

  (spec) => `I can verify one part of ${spec.anchor}: ${spec.evidence}. The rest remains inference and should be labeled that way.`,
  (spec) => `What testimony would contradict our preferred account of ${spec.anchor}, and have we made a safe route for that contradiction to reach us?`,
  (spec, voice) => `My recurring danger is that ${voice.risk}; the evidence around ${spec.anchor} does not exempt me from that danger.`,
  (spec) => `Let the record of ${spec.anchor} separate what we saw, what we were told, and what we decided under pressure.`,
  (spec) => `A person affected by ${spec.anchor} may remember the event differently without becoming an obstacle to our work.`,
  (spec) => `If new evidence changes ${spec.anchor}, our correction must change practice rather than merely add a courteous note.`,

  (spec) => `I favor this proposal for ${spec.anchor}: ${spec.proposal}. My preference does not settle the conflict.`,
  (spec) => `The strongest objection around ${spec.anchor} is ${spec.objection}; I want it answered rather than outvoted.`,
  (spec, voice) => `${voice.reflex} is my first reflex, and ${spec.anchor} is exactly where that reflex needs a visible brake.`,
  (spec) => `Our nonnegotiable boundary for ${spec.anchor} remains ${spec.boundary}; urgency cannot quietly erase it.`,
  (spec) => `I can accept disagreement about method, but not a method that transfers every risk of ${spec.anchor} to ${spec.affected}.`,
  (spec) => `Name the least powerful person who can stop our ${spec.anchor} decision, then show how that stop would work.`,

  (spec) => `The bounded proposal for ${spec.anchor} is ${spec.proposal}; it should be offered once and remain genuinely optional.`,
  (spec) => `A second route for ${spec.anchor} is ${spec.alternative}, preserving care if the first route becomes unsafe.`,
  (spec, voice) => `My useful contribution is this: ${voice.offer}. I will place it under the ${spec.anchor} boundary rather than above it.`,
  (spec) => `The success test for ${spec.anchor} is concrete: ${spec.proof}. We should reject any prettier substitute.`,
  (spec) => `Responsibility for checking the ${spec.anchor} test cannot belong only to the person who designed the plan.`,
  (spec) => `Write the withdrawal route beside the ${spec.anchor} proposal, so nobody must invent permission to leave under pressure.`,

  (spec) => `Suppose ${spec.pressure}; which part of our ${spec.anchor} plan fails first, and who feels that failure before we do?`,
  (spec) => `If that pressure reaches ${spec.anchor}, ${spec.contingency}; the contingency must not punish the people who warned us.`,
  (spec) => `The immediate repair attached to ${spec.anchor} is ${spec.repair}, whether or not anyone accepts our broader proposal.`,
  (spec) => `A refusal during ${spec.anchor} should alter the task without erasing the refuser from food, shelter, care, or later deliberation.`,
  (spec, voice) => `We need a witness to our restraint around ${spec.anchor}, because ${voice.risk} whenever scrutiny becomes inconvenient.`,
  (spec) => `The next review of ${spec.anchor} should begin with those who carried its cost, not with our account of our intentions.`,

  (spec, voice) => `My commitment concerning ${spec.anchor} is this: ${voice.commitment}. Anyone here may cite that sentence back to me.`,
  (spec) => `I will ask whether ${spec.proof}, and treat a negative answer about ${spec.anchor} as evidence rather than ingratitude.`,
  (spec) => `The ${spec.anchor} decision remains bounded by ${spec.boundary}, with this fallback available: ${spec.contingency}.`,
  (spec) => `What we leave unfinished around ${spec.anchor} should stay named, because false closure would narrow future testimony.`,
  (spec) => `If maintained, this ${spec.anchor} council could support ${spec.future}, but affected people must judge whether that future is arriving.`,
  (spec) => `We close ${spec.anchor} without unanimity theater: a limited action, a public check, and a correction route remain.`,
]);

const PHASES = deepFreeze([
  [0, 1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10, 11],
  [12, 13, 14, 15, 16, 17],
  [18, 19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28, 29],
  [30, 31, 32, 33, 34, 35],
]);

const PHASE_ORDERS = deepFreeze([
  [0, 1, 2, 3, 4, 5],
  [0, 2, 1, 4, 3, 5],
  [1, 0, 2, 3, 4, 5],
  [0, 1, 3, 2, 4, 5],
  [2, 0, 1, 3, 4, 5],
  [0, 4, 1, 2, 3, 5],
  [1, 2, 0, 4, 3, 5],
  [0, 3, 1, 2, 4, 5],
  [2, 1, 0, 3, 4, 5],
  [1, 0, 3, 2, 4, 5],
]);

function rotate(values, count) {
  const offset = ((count % values.length) + values.length) % values.length;
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function buildMoveOrder(structureIndex) {
  return PHASE_ORDERS[structureIndex].flatMap((phaseIndex, position) => {
    const phase = [...PHASES[phaseIndex]];
    return (structureIndex + position) % 4 === 3 ? phase.reverse() : phase;
  });
}

function buildSpeakerOrder(participants, structureIndex) {
  const cycleCount = DIALOGUE_MOVES.length / participants.length;
  return Array.from({ length: cycleCount }, (_, cycleIndex) => {
    let cycle = rotate(participants, structureIndex + (cycleIndex * ((structureIndex % 3) + 1)));
    if ((structureIndex + cycleIndex) % 2 === 1) cycle = [...cycle].reverse();
    if (structureIndex % 4 === 2 && cycle.length > 3) {
      cycle = [...cycle.filter((_, index) => index % 2 === 0), ...cycle.filter((_, index) => index % 2 === 1)];
    }
    if (structureIndex >= 8 && cycleIndex % 2 === 0) {
      [cycle[0], cycle[1]] = [cycle[1], cycle[0]];
    }
    return cycle;
  }).flat();
}

function buildDialogue(participants, spec, structureIndex) {
  const moveOrder = buildMoveOrder(structureIndex);
  const speakerOrder = buildSpeakerOrder(participants, structureIndex);
  return moveOrder.map((moveIndex, lineIndex) => {
    const speaker = speakerOrder[lineIndex];
    return line(speaker, DIALOGUE_MOVES[moveIndex](spec, VOICES[speaker]));
  });
}

function buildChoice(slot, spec, structureIndex) {
  const participants = slot.participants;
  return {
    prompt: `Which bounded action should govern the council’s next step concerning ${spec.anchor}?`,
    options: spec.options.map((option, optionIndex) => ({
      id: `${slot.id}-choice-${optionIndex + 1}`,
      label: option.label,
      response: [
        line(
          participants[(structureIndex + optionIndex) % participants.length],
          `For ${spec.anchor}, I support “${option.label}” only as this bounded action: ${option.action}.`,
        ),
        line(
          participants[(structureIndex + optionIndex + 1) % participants.length],
          `The safeguard attached to “${option.label}” during ${spec.anchor} is this: ${option.safeguard}.`,
        ),
        line(
          participants[(structureIndex + optionIndex + 2) % participants.length],
          `We will review “${option.label}” by asking whether ${spec.proof}; ${option.review}.`,
        ),
      ],
      consequence: {
        flag: `party-council.${slot.id}.choice.${optionIndex + 1}`,
        summary: option.summary,
      },
    })),
  };
}

const latePlan = getPartyCouncilGroupPlan('late');
if (latePlan.length !== SCENE_SPECS.length) {
  throw new Error(`Late party council specifications must cover ${latePlan.length} canonical slots.`);
}

const councils = latePlan.map((slot, structureIndex) => {
  const spec = SCENE_SPECS[structureIndex];
  return {
    id: slot.id,
    sequence: slot.sequence,
    chapterId: slot.chapterId,
    unlockAfterBeatId: slot.unlockAfterBeatId,
    campId: slot.campId,
    participants: [...slot.participants],
    title: spec.title,
    theme: spec.theme,
    dialogue: buildDialogue(slot.participants, spec, structureIndex),
    choice: buildChoice(slot, spec, structureIndex),
  };
});

export const PARTY_COUNCILS_LATE = deepFreeze(councils);

export const PARTY_COUNCILS_LATE_VALIDATION = validatePartyCouncilPack(PARTY_COUNCILS_LATE, {
  expectedGroup: 'late',
});

if (!PARTY_COUNCILS_LATE_VALIDATION.ok) {
  throw new Error(`Invalid late party council pack:\n${PARTY_COUNCILS_LATE_VALIDATION.errors.join('\n')}`);
}
