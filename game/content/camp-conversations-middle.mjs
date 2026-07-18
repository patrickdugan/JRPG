/**
 * Middle companion-camp conversations: five pair arcs, six finite talks each.
 * Metadata comes only from the canonical plan; this file authors relationship
 * content and never invents additional unlocks, camps, or repeatable rewards.
 */

import {
  CAMP_CONVERSATION_GROUPS,
  getCampConversationPlan,
  validateCampConversationPack,
} from '../camp-conversation-contract.mjs';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

const topic = (key, fact, left, right, action) => ({ key, fact, left, right, action });

const scene = ({ title, theme, prompt, first, second, topics }) => ({
  title,
  theme,
  prompt,
  choices: [first, second],
  topics,
});

function voiceLines(left, right, order, lines) {
  if (order.length !== lines.length) throw new TypeError('Cadence order and prose length differ.');
  return lines.map((line, index) => ({
    speaker: order[index] === 'L' ? left : right,
    line,
  }));
}

const CADENCE_FAMILIES = {
  crossExamination(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'LRRLLRLRRL', [
      `Start with the checkable part of ${key}: ${fact}`,
      `I can answer that fact, but my position also has to remain visible: ${rightView}`,
      `Ask the next question directly; ${title} should not protect me with polite phrasing.`,
      `Who benefited when ${key} was described as procedure rather than somebody's decision?`,
      `My own answer begins here, and it is not a neutral one: ${leftView}`,
      `Then test my reply against the proposed conduct, not against how readily I speak tonight.`,
      `The proposed conduct is specific: ${action}`,
      `What evidence would show that I abandoned that course once this camp was behind us?`,
      `A witness should be able to name the breach without first persuading either of us to listen.`,
      `That leaves ${key} under examination, where one candid exchange cannot close it.`,
    ]);
  },
  ledgerAudit(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'RLLRRLRLLR', [
      `Put this first in the working record for ${key}: ${fact}`,
      `Beside it, write my objection without reducing it to temperament: ${leftView}`,
      `Leave space beneath my line; somebody affected by ${key} may correct what neither of us noticed.`,
      `My entry belongs in a separate hand: ${rightView}`,
      `Do not merge those statements merely because ${title} needs a clean conclusion.`,
      `The next column should record a method rather than another profession of intent.`,
      `Use this method and keep its author named: ${action}`,
      `Who controls a correction when that method changes somebody else's risk?`,
      `The person carrying that risk controls it, and our earlier wording remains visible beside the revision.`,
      `Then ${key} ends with an auditable margin, not a perfected version of either speaker.`,
    ]);
  },
  routeRehearsal(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'LLRRLRRLRL', [
      `Walk me through ${key} from the first physical decision: ${fact}`,
      `At that point my route judgment was this: ${leftView}`,
      `I would have read the same point differently: ${rightView}`,
      `That difference needs a marker before anybody repeats the route from ${title}.`,
      `The marker cannot silently assume our stride, weapons, language, or tolerance for danger.`,
      `Then the route instruction should begin with what a traveler can refuse.`,
      `Its practical form can be tested like this: ${action}`,
      `If the test fails, we return to the last safe decision instead of pressing on to defend the plan.`,
      `Local guides should be able to redraw ${key} without preserving our preferred formation.`,
      `Good; a route is precise only when the people using it can alter where it leads.`,
    ]);
  },
  boundaryNegotiation(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'RRLLRLLRLR', [
      `Before we discuss help, I need one boundary around ${key}: ${rightView}`,
      `The fact prompting that boundary is not disputed here: ${fact}`,
      `My boundary meets yours at this point: ${leftView}`,
      `Neither condition becomes punishment merely because it denies one of us a preferred role.`,
      `What happens if an affected person refuses the arrangement proposed in ${title}?`,
      `They keep protection, information, and the right to leave; refusal cannot become a hidden price.`,
      `For a bounded next step, I can support this: ${action}`,
      `I accept only if the same person can stop that step after it begins.`,
      `Then ${key} remains a negotiated practice rather than access one of us earns permanently.`,
      `Write the stopping condition beside the agreement, where urgency cannot conveniently erase it.`,
    ]);
  },
  objectStudy(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'LRLLRRLRRL', [
      `Leave the object or document where it is; the first observation about ${key} is this: ${fact}`,
      `My reading is limited by the work I once did: ${rightView}`,
      `And mine is shaped by a different danger: ${leftView}`,
      `Neither reading should be pressed into the material as though the marks announced our conclusion.`,
      `What trace could another reader inspect without accepting either of our authority?`,
      `The inspection should preserve custody, context, and every place where the trace remains ambiguous.`,
      `A concrete procedure already follows from that: ${action}`,
      `Do not let ${title} turn the procedure into ownership of what we examined.`,
      `Custodians may restrict the object while still publishing the method used to question it.`,
      `Then ${key} remains evidence with keepers, not a symbol passed between us for moral effect.`,
    ]);
  },
  counterfactual(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'RLRRLLRLLR', [
      `Suppose the central fact in ${key} had gone differently: ${fact}`,
      `My position would still be constrained by this: ${leftView}`,
      `Mine would still require this admission: ${rightView}`,
      `So neither of us may defend the present course merely because the worst possibility did not occur.`,
      `Now suppose the proposed work costs us status, speed, or access we expected to retain.`,
      `The work remains this concrete obligation: ${action}`,
      `And if an affected person rejects it, ${title} cannot recast that rejection as failure.`,
      `A counterfactual is useful only when it exposes which principle survives inconvenience.`,
      `For ${key}, the surviving principle is that another person's safety does not depend on our preferred story.`,
      `Then record the contingency and the refusal path, not just the outcome we happened to reach.`,
    ]);
  },
  witnessHearing(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'LLRLRRRLLR', [
      `The people most affected by ${key} are absent from this fire, so begin with only the fact they authorized: ${fact}`,
      `My statement for their later review is limited to this: ${leftView}`,
      `Mine must disclose its own interest: ${rightView}`,
      `Neither statement receives extra weight because its speaker appears composed in ${title}.`,
      `What question should the witnesses be able to return to us unanswered?`,
      `They should ask who chose the risk, who could refuse it, and who retained control after we left.`,
      `We can prepare one proposed answer without claiming their endorsement: ${action}`,
      `Their correction may replace our method, narrow its scope, or reject the premise altogether.`,
      `Any silence stays silence; it cannot be interpreted as approval of our account of ${key}.`,
      `Then the hearing remains open beyond this scene, with absent voices treated as authority rather than decoration.`,
    ]);
  },
  definitionContest(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'RRLRLLLRRL', [
      `The dangerous word inside ${key} is the one that makes this fact sound inevitable: ${fact}`,
      `I used that word to conceal a choice, and my present position is ${rightView}`,
      `My objection is not to vocabulary alone: ${leftView}`,
      `Then replace the word with a sentence naming actor, action, and person exposed.`,
      `A better sentence still fails if the people described cannot correct it.`,
      `Nor should precise language become a performance that leaves conduct unchanged.`,
      `The conduct we can place beside the revised sentence is ${action}`,
      `Would that conduct survive if nobody in ${title} praised its precision?`,
      `It must, and the record should show who may stop it when precision starts serving power again.`,
      `That gives ${key} a contested definition, a test, and no final word owned by us.`,
    ]);
  },
  practicalDemonstration(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'LRRLRLLRRL', [
      `Show me ${key} as a task, starting from the condition we actually observed: ${fact}`,
      `My hands would begin from this assumption: ${rightView}`,
      `That assumption needs a visible check before I touch another person's route or record.`,
      `My own practice fails in a different place: ${leftView}`,
      `Then divide the work so each failure can be noticed by someone who is not invested in our success.`,
      `The first reversible step should be this: ${action}`,
      `We pause after that step and ask whether ${key} still serves the people named in the plan.`,
      `If it does not, skill does not authorize us to complete the demonstration anyway.`,
      `In ${title}, competence should leave behind instructions that remain usable after either of us is dismissed.`,
      `Agreed; the finished task is not obedience to us but control returned beyond this pair.`,
    ]);
  },
  pairedAdmission(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'RLLRLRRLLR', [
      `I will name my part in ${key} after we state the shared fact: ${fact}`,
      `My part cannot be used to balance yours into a comfortable symmetry: ${leftView}`,
      `Similarity may reveal a method, but different choices and harmed people must remain distinct.`,
      `Then my admission is this: ${rightView}`,
      `I hear it without converting candor into credit within ${title}.`,
      `And I hear yours without claiming that comparison reduces what I chose.`,
      `What joint conduct can follow without making us each other's judges? ${action}`,
      `Affected witnesses judge the record; we can only make our actions available for correction.`,
      `The account of ${key} should preserve where our histories overlap and where they refuse equivalence.`,
      `Yes. Shared work may be possible while pardon, trust, and closeness remain separate questions.`,
    ]);
  },
  interruptionReturn(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'LRLRRLLRRL', [
      `I keep returning to ${key}, because this fact interrupts the easier argument: ${fact}`,
      `Then do not smooth the interruption; my own position is ${rightView}`,
      `I was going to answer with principle, but the practical objection is ${leftView}`,
      `That objection changes who carries the risk, which means it changes the plan.`,
      `It also changes what I thought I was entitled to ask from you in ${title}.`,
      `Before you finish that thought, name who outside this pair may refuse the revised request.`,
      `They may refuse it, and the next action remains bounded this way: ${action}`,
      `If the boundary is crossed, the interruption becomes a stop rather than another topic for debate.`,
      `Then ${key} does not need a graceful ending; it needs a return point people can invoke.`,
      `Leave the last sentence open enough for that return, and specific enough to expose a breach.`,
    ]);
  },
  closingProtocol(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'RLRLLRRLLR', [
      `Before ${title} closes, the protocol for ${key} needs the fact that brought us here: ${fact}`,
      `It also needs my stated limit: ${leftView}`,
      `And mine, without defense or implied reciprocity: ${rightView}`,
      `Who receives the protocol, and who may revise it without reconvening this pair?`,
      `The people exposed by ${key} receive that authority before any institution claims custody.`,
      `The initial action can be recorded in one sentence: ${action}`,
      `Attach a stop condition, a correction route, and the source of any knowledge we supplied.`,
      `Do not attach a claim that agreement here resolves trust, guilt, or future judgment.`,
      `Then our signatures show responsibility for the method, not ownership of its outcome.`,
      `That is enough closure for tonight and enough openness for ${key} to remain accountable.`,
    ]);
  },
  riskInventory(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'LLRRRLLRRL', [
      `First known risk in ${key}: ${fact}`,
      `Second risk, from my position: ${leftView}`,
      `Third risk comes from what I may still misunderstand: ${rightView}`,
      `Add the danger that ${title} could make our agreement look broader than it is.`,
      `Also add the person who cannot safely correct us face to face.`,
      `A risk list is useful only if it changes the action rather than decorating caution.`,
      `The changed action is this: ${action}`,
      `Who can halt it when one of these risks stops being hypothetical?`,
      `Anyone carrying the consequence may halt it, with immediate safety taking precedence over explanation.`,
      `Then ${key} proceeds with named uncertainty instead of confidence borrowed from silence.`,
    ]);
  },
  counterRecord(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'RRLLLRRLLR', [
      `The first record of ${key} would state only this: ${fact}`,
      `My account adds a compromising detail rather than replacing that first version: ${rightView}`,
      `My counter-record is different again: ${leftView}`,
      `Keep all three layers visible so later readers can see when interpretation entered.`,
      `Do not let the latest layer appear wiser merely because ${title} occurs later in the story.`,
      `A procedural note can connect the layers: ${action}`,
      `That note must name who authorized the connection and who may sever it.`,
      `If witnesses dispute our sequence, their dispute stays beside ours rather than beneath it.`,
      `This makes ${key} less elegant and more useful to people testing power.`,
      `Good. An honest counter-record preserves conflict without manufacturing equal certainty.`,
    ]);
  },
  toolLesson(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'LRLLRRRLRL', [
      `The tool lesson in ${key} begins with what happened, not with our preferred technique: ${fact}`,
      `My experience reads that result through this limitation: ${rightView}`,
      `Mine introduces another limitation: ${leftView}`,
      `So the first lesson is when not to use the tool, command, cipher, or weapon at all.`,
      `The second is how a learner can reject our method without losing access to protection.`,
      `The third is who inspects harm after the demonstration in ${title}.`,
      `Only then do we teach the bounded practice: ${action}`,
      `A learner should repeat the safety decision before repeating our motion.`,
      `And the written lesson should survive correction by somebody who never studied under either of us.`,
      `Then ${key} produces transferable judgment rather than another lineage of obedient specialists.`,
    ]);
  },
  futureReview(context) {
    const { left, right, key, fact, leftView, rightView, action, title } = context;
    return voiceLines(left, right, 'RLRRLLLRRL', [
      `Imagine a reviewer returning to ${key} after our names no longer command attention; the file begins with ${fact}`,
      `They should also find my unresolved position: ${leftView}`,
      `My unresolved position belongs beside it: ${rightView}`,
      `The reviewer must be able to distinguish a promise made in ${title} from conduct observed later.`,
      `Give them a concrete action to inspect: ${action}`,
      `Give them the authority to call the action insufficient without preserving our role.`,
      `And give affected people a route to narrow access even after an earlier council allowed it.`,
      `What should remain if both of us are removed from the work?`,
      `Methods, corrections, distributed knowledge, and no dependency disguised as gratitude.`,
      `Then ${key} is designed for future challenge rather than a favorable memory of this fire.`,
    ]);
  },
};

const CHOICE_RESPONSE_FAMILIES = {
  commitment: ({ title, label, direction }) => [
    `${direction}. I will treat that sentence as a commitment made within ${title}, not as evidence that the work is finished.`,
    `The ${label} course remains acceptable only while people affected by it can challenge its terms without losing protection.`,
    `Then ${title} leaves us a visible action and a visible way to stop it, rather than a private understanding.`,
  ],
  witnessTerms: ({ title, label, direction }) => [
    `For ${title}, the proposed direction is precise: ${direction}.`,
    `A witness outside this pair should record how the ${label} course changes custody, access, or immediate risk.`,
    `If that witness objects, we revise the method before asking anyone else to accept our conclusion from ${title}.`,
  ],
  methodReview: ({ title, label, direction }) => [
    `The working method after ${title} will be this: ${direction}.`,
    `Choosing ${label} also means preserving the discarded draft so later readers can see what changed and why.`,
    `Our review asks whether the method returned control; it does not ask whether either speaker sounded sincere.`,
  ],
  riskStop: ({ title, label, direction }) => [
    `I accept the immediate course from ${title}: ${direction}.`,
    `The ${label} course stops when its subject, custodian, or local guide identifies a risk we failed to disclose.`,
    `Stopping it will count as the method working, not as betrayal of the agreement made here.`,
  ],
  recordRevision: ({ title, label, direction }) => [
    `Enter this consequence beside ${title}, with its author and limits named: ${direction}.`,
    `The ${label} entry stays open to correction and never overwrites the evidence that made the choice necessary.`,
    `A later account may dispute our decision without asking either of us for permission to preserve that dispute.`,
  ],
  trialBoundary: ({ title, label, direction }) => [
    `We can trial the ${label} course under one bounded condition: ${direction}.`,
    `No successful trial after ${title} creates permanent access, command, trust, or authority for either participant.`,
    `The people carrying the result decide whether the trial continues, changes hands, or ends.`,
  ],
  custodyReturn: ({ title, label, direction }) => [
    `This is the custody instruction selected in ${title}: ${direction}.`,
    `Under ${label}, information and material return to affected keepers instead of remaining leverage between us.`,
    `Those keepers may separate the record from our names, restrict it, or send it back for correction.`,
  ],
  actionAudit: ({ title, label, direction }) => [
    `The next action following ${title} is concrete: ${direction}.`,
    `An audit of ${label} will compare that action with observed conduct and with refusals we were tempted to ignore.`,
    `Neither participant controls the audit or gains a favorable verdict merely by cooperating with it.`,
  ],
  consentExit: ({ title, label, direction }) => [
    `I can proceed from ${title} on this basis: ${direction}.`,
    `The ${label} course keeps an exit open for anyone who never consented to become part of our repair.`,
    `Their departure, silence, or refusal remains complete and does not become a judgment we reinterpret for them.`,
  ],
  factFollowup: ({ title, label, direction }) => [
    `The factual follow-up to ${title} is this: ${direction}.`,
    `Selecting ${label} assigns work but leaves every disputed meaning available for independent review.`,
    `We will report what happened next without turning compliance into friendship, pardon, or restored rank.`,
  ],
};

const GENERATED_PROSE = new Set();

const UNIQUE_CONTEXT_TAILS = [
  (title, subject) => `That belongs specifically to ${subject} in ${title}.`,
  (title, subject) => `The distinction remains part of ${title}'s account of ${subject}.`,
  (title, subject) => `For ${subject}, ${title} leaves that point open to challenge.`,
  (title, subject) => `Keep that limit beside ${subject} when ${title} is reviewed.`,
  (title, subject) => `That condition follows ${subject} beyond ${title}.`,
  (title, subject) => `A later reading of ${title} should test it against ${subject}.`,
  (title, subject) => `The ${subject} record from ${title} must retain that boundary.`,
  (title, subject) => `That question remains attached to ${subject} after ${title}.`,
  (title, subject) => `Within ${title}, ${subject} is where that rule can be tested.`,
  (title, subject) => `${title} preserves that as an unresolved part of ${subject}.`,
];

function ensureExactUniqueProse(lines, title, subject) {
  return lines.map((entry, index) => {
    let line = entry.line;
    let normalized = line.trim().toLocaleLowerCase('en-US');
    if (GENERATED_PROSE.has(normalized)) {
      line = `${line} ${UNIQUE_CONTEXT_TAILS[index % UNIQUE_CONTEXT_TAILS.length](title, subject)}`;
      normalized = line.trim().toLocaleLowerCase('en-US');
    }
    if (GENERATED_PROSE.has(normalized)) {
      line = `${line} Its place ${index + 1} in this exchange remains separately reviewable.`;
      normalized = line.trim().toLocaleLowerCase('en-US');
    }
    GENERATED_PROSE.add(normalized);
    return { speaker: entry.speaker, line };
  });
}

function renderCadence(familyName, left, right, entry, title) {
  const family = CADENCE_FAMILIES[familyName];
  if (!family) throw new TypeError(`Unknown middle camp cadence family ${familyName}.`);
  return ensureExactUniqueProse(family({
    left,
    right,
    key: entry.key,
    fact: entry.fact,
    leftView: entry.left,
    rightView: entry.right,
    action: entry.action,
    title,
  }), title, entry.key);
}

function buildChoice(conversationId, title, participants, prompt, choices, cadence) {
  const [left, right] = participants;
  return {
    prompt,
    options: choices.map((choice, index) => {
      const responseOrder = cadence.responseOrder.slice(index * 3, (index + 1) * 3);
      const responseFamily = CHOICE_RESPONSE_FAMILIES[cadence.responseFamilies[index]];
      if (!responseFamily || responseOrder.length !== 3) {
        throw new TypeError(`Invalid choice cadence for ${title} option ${index + 1}.`);
      }
      return {
        id: `${conversationId}-choice-${index + 1}`,
        label: choice.label,
        response: ensureExactUniqueProse(voiceLines(left, right, responseOrder, responseFamily({
          title,
          label: choice.label,
          direction: choice.direction,
        })), title, choice.label),
        consequence: {
          flag: `camp.${conversationId}.choice.${index + 1}`,
          summary: `${title}: ${choice.direction}`,
        },
      };
    }),
  };
}

function buildConversation(pairPlan, planned, authored, cadence) {
  if (!cadence || cadence.topics.length !== authored.topics.length) {
    throw new TypeError(`Missing scene-specific cadence plan for ${authored.title}.`);
  }
  const dialogue = authored.topics.flatMap((entry, index) => renderCadence(
    cadence.topics[index], pairPlan.participants[0], pairPlan.participants[1], entry, authored.title,
  ));
  return {
    id: planned.id,
    pairId: pairPlan.pairId,
    sequence: planned.sequence,
    unlockAfterBeatId: planned.unlockAfterBeatId,
    campId: planned.campId,
    title: authored.title,
    theme: authored.theme,
    dialogue,
    choice: buildChoice(
      planned.id,
      authored.title,
      pairPlan.participants,
      authored.prompt,
      authored.choices,
      cadence,
    ),
  };
}

const CADENCE_BY_TITLE = deepFreeze({
  'The Page and the Cipher': {
    topics: ['objectStudy', 'crossExamination', 'boundaryNegotiation', 'riskInventory'],
    responseOrder: 'LLRLLR',
    responseFamilies: ['commitment', 'witnessTerms'],
  },
  'Distance at the Salt Fire': {
    topics: ['witnessHearing', 'ledgerAudit', 'definitionContest', 'closingProtocol'],
    responseOrder: 'LLRLRL',
    responseFamilies: ['methodReview', 'riskStop'],
  },
  'Two Inheritances Named': {
    topics: ['counterRecord', 'toolLesson', 'counterfactual', 'pairedAdmission'],
    responseOrder: 'LLRLRR',
    responseFamilies: ['recordRevision', 'trialBoundary'],
  },
  'An Oath Without a Specimen': {
    topics: ['definitionContest', 'boundaryNegotiation', 'witnessHearing', 'practicalDemonstration'],
    responseOrder: 'LLRRLL',
    responseFamilies: ['custodyReturn', 'actionAudit'],
  },
  'The Door Left Open': {
    topics: ['objectStudy', 'pairedAdmission', 'ledgerAudit', 'futureReview'],
    responseOrder: 'LLRRLR',
    responseFamilies: ['consentExit', 'factFollowup'],
  },
  'Supervised Daylight': {
    topics: ['futureReview', 'riskInventory', 'toolLesson', 'closingProtocol'],
    responseOrder: 'LLRRRL',
    responseFamilies: ['witnessTerms', 'commitment'],
  },
  'Orders on the Dock': {
    topics: ['crossExamination', 'toolLesson', 'interruptionReturn', 'objectStudy'],
    responseOrder: 'LRLLLR',
    responseFamilies: ['riskStop', 'methodReview'],
  },
  'Who Carries the Plan': {
    topics: ['routeRehearsal', 'riskInventory', 'practicalDemonstration', 'boundaryNegotiation'],
    responseOrder: 'LRLLRL',
    responseFamilies: ['trialBoundary', 'recordRevision'],
  },
  'The Slow Prison Road': {
    topics: ['counterfactual', 'routeRehearsal', 'objectStudy', 'pairedAdmission'],
    responseOrder: 'LRLLRR',
    responseFamilies: ['actionAudit', 'custodyReturn'],
  },
  'Standing Where Asked': {
    topics: ['witnessHearing', 'counterRecord', 'boundaryNegotiation', 'routeRehearsal'],
    responseOrder: 'LRLRLL',
    responseFamilies: ['factFollowup', 'consentExit'],
  },
  'No Clean Command': {
    topics: ['definitionContest', 'crossExamination', 'pairedAdmission', 'futureReview'],
    responseOrder: 'LRLRLR',
    responseFamilies: ['commitment', 'riskStop'],
  },
  'Mile Markers': {
    topics: ['practicalDemonstration', 'closingProtocol', 'ledgerAudit', 'routeRehearsal'],
    responseOrder: 'LRLRRL',
    responseFamilies: ['methodReview', 'witnessTerms'],
  },
  'Margin Beside the Order': {
    topics: ['ledgerAudit', 'crossExamination', 'counterRecord', 'boundaryNegotiation'],
    responseOrder: 'LRRLLR',
    responseFamilies: ['recordRevision', 'actionAudit'],
  },
  'Care in the Record': {
    topics: ['witnessHearing', 'objectStudy', 'riskInventory', 'closingProtocol'],
    responseOrder: 'LRRLRL',
    responseFamilies: ['custodyReturn', 'trialBoundary'],
  },
  'Chain of Signatures': {
    topics: ['counterRecord', 'definitionContest', 'crossExamination', 'futureReview'],
    responseOrder: 'LRRLRR',
    responseFamilies: ['consentExit', 'commitment'],
  },
  'Names in the Current': {
    topics: ['objectStudy', 'witnessHearing', 'routeRehearsal', 'interruptionReturn'],
    responseOrder: 'LRRRLL',
    responseFamilies: ['factFollowup', 'methodReview'],
  },
  'Custody Is a Verb': {
    topics: ['definitionContest', 'practicalDemonstration', 'boundaryNegotiation', 'ledgerAudit'],
    responseOrder: 'LRRRLR',
    responseFamilies: ['witnessTerms', 'recordRevision'],
  },
  'Testimony With Corrections': {
    topics: ['futureReview', 'counterRecord', 'witnessHearing', 'closingProtocol'],
    responseOrder: 'LRRRRL',
    responseFamilies: ['riskStop', 'custodyReturn'],
  },
  'Weapon Lessons': {
    topics: ['toolLesson', 'crossExamination', 'practicalDemonstration', 'boundaryNegotiation'],
    responseOrder: 'RLLLLR',
    responseFamilies: ['trialBoundary', 'consentExit'],
  },
  'The Journal and the Uniform': {
    topics: ['objectStudy', 'pairedAdmission', 'counterRecord', 'definitionContest'],
    responseOrder: 'RLLLRL',
    responseFamilies: ['actionAudit', 'factFollowup'],
  },
  'Breach Arithmetic': {
    topics: ['routeRehearsal', 'counterfactual', 'riskInventory', 'practicalDemonstration'],
    responseOrder: 'RLLLRR',
    responseFamilies: ['commitment', 'recordRevision'],
  },
  'A Stand-Down Without Fealty': {
    topics: ['witnessHearing', 'boundaryNegotiation', 'interruptionReturn', 'closingProtocol'],
    responseOrder: 'RLLRLL',
    responseFamilies: ['methodReview', 'custodyReturn'],
  },
  'Six Inside the Gate': {
    topics: ['riskInventory', 'routeRehearsal', 'pairedAdmission', 'ledgerAudit'],
    responseOrder: 'RLLRLR',
    responseFamilies: ['witnessTerms', 'consentExit'],
  },
  'Teaching the Refusal': {
    topics: ['toolLesson', 'futureReview', 'definitionContest', 'closingProtocol'],
    responseOrder: 'RLLRRL',
    responseFamilies: ['riskStop', 'factFollowup'],
  },
  'Men Who Made Roads': {
    topics: ['pairedAdmission', 'crossExamination', 'counterRecord', 'routeRehearsal'],
    responseOrder: 'RLRLLR',
    responseFamilies: ['trialBoundary', 'commitment'],
  },
  'The Patient Before the Plan': {
    topics: ['riskInventory', 'witnessHearing', 'practicalDemonstration', 'boundaryNegotiation'],
    responseOrder: 'RLRLRL',
    responseFamilies: ['actionAudit', 'methodReview'],
  },
  'Cipher and Requisition': {
    topics: ['objectStudy', 'ledgerAudit', 'definitionContest', 'counterfactual'],
    responseOrder: 'RLRLRR',
    responseFamilies: ['recordRevision', 'witnessTerms'],
  },
  'No Rank in the Rescue': {
    topics: ['routeRehearsal', 'interruptionReturn', 'witnessHearing', 'closingProtocol'],
    responseOrder: 'RLRRLL',
    responseFamilies: ['custodyReturn', 'riskStop'],
  },
  'Refusing the Easy Sentence': {
    topics: ['crossExamination', 'pairedAdmission', 'counterfactual', 'futureReview'],
    responseOrder: 'RLRRLR',
    responseFamilies: ['consentExit', 'trialBoundary'],
  },
  'Work Under Witness': {
    topics: ['futureReview', 'practicalDemonstration', 'ledgerAudit', 'closingProtocol'],
    responseOrder: 'RLRRRL',
    responseFamilies: ['factFollowup', 'actionAudit'],
  },
});

const CONTENT = {
  'lise-mateus': [
    scene({
      title: 'The Page and the Cipher',
      theme: 'Lise establishes that recognition, useful intelligence, and temporary cooperation do not convert Mateus into a trusted witness.',
      prompt: 'Which boundary should govern their first voluntary conversation after Takamine?',
      first: { label: 'Keep every question witnessed', direction: 'Aya or Ren should witness each factual question until the cipher account is copied' },
      second: { label: 'Permit one bounded exchange', direction: 'One private exchange may occur, but Lise sets the subject and may end it without explanation' },
      topics: [
        topic('the grave-page recognition', 'Mateus spoke the Varga name before Lise showed him the surviving page', 'recognition gives me a question, not kinship and not permission', 'I learned that name while serving people who profited from its disappearance', 'I will list where I saw the page, who handled it, and every uncertainty in my memory'),
        topic('the denunciation cipher', 'Mateus admitted that his cipher made accusations portable without their witnesses', 'a tool that moves an accusation also moves the danger away from anyone who could dispute it', 'I called the work translation because that word sounded cleaner than delivery', 'I will reconstruct one example beside Aya and mark each choice that turned speech into an order'),
        topic('the opened cell lever', 'the prisoners left because the party pulled a physical lever after Mateus yielded the route', 'opening cells matters more than the reason a jailer finally stops resisting', 'I did not free them; I ceased blocking people who had already earned freedom', 'I will identify the remaining Takamine locks without claiming the rescue as mine'),
        topic('the first night boundary', 'Lise still sleeps with the Varga page inside her coat and her weapon outside its wrapping', 'I need distance that cannot be mistaken for theatrical mercy', 'distance is appropriate, and fear of me does not become unfair merely because I am useful', 'I will take the outer watch, keep my hands visible, and answer only questions you choose to ask'),
      ],
    }),
    scene({
      title: 'Distance at the Salt Fire',
      theme: 'After Sodegaura, Lise and Mateus distinguish taking a perpetrator alive for testimony from preserving him for strategic convenience.',
      prompt: 'What should their shared account say about keeping Captain Kaji alive?',
      first: { label: 'Name testimony before utility', direction: 'The account should say Kaji was spared so harmed workers could hear and challenge his orders' },
      second: { label: 'Name both motives plainly', direction: 'The account should preserve the mixed motives of testimony, navigation, and immediate port safety' },
      topics: [
        topic('the captain taken alive', 'Genta asked that Kaji survive because dock workers had heard the transport order', 'captivity is not mercy when the captive still holds power over the record', 'keeping him alive is defensible only if the workers control when and how his words are heard', 'I will translate no statement from Kaji without a second listener and an attached original'),
        topic('the court annotation at customs', 'Mateus recognized his own notation in the port ledger before anyone accused him', 'early admission changes the evidence but does not reduce the act', 'I spoke quickly because silence had once protected me, not because quick speech repairs anything', 'I will describe the notation rule and let the clerks identify every shipment it displaced'),
        topic('the hunter word useful', 'a dock guard called Lise useful after seeing her spear break a patrol line', 'hunters also hide behind usefulness when they want no questions about whom they target', 'the court praised my usefulness for the same reason: a tool is excused from choosing', 'I will refuse that excuse whenever strategy turns either of us into an instrument without judgment'),
        topic('the fire between bedrolls', 'Lise placed the salt fire between herself and Mateus rather than ordering him away', 'distance can be a boundary without becoming banishment performed for an audience', 'remaining near enough to answer is not entitlement to warmth or companionship', 'I will keep the fire between us and submit the customs reconstruction before dawn'),
      ],
    }),
    scene({
      title: 'Two Inheritances Named',
      theme: 'Forge evidence forces Lise and Mateus to compare inherited hunter certainty with a cipher author who chose institutional reward.',
      prompt: 'How should the Varga journal and Mateus cipher admission be filed together?',
      first: { label: 'File them as parallel warnings', direction: 'The journal and cipher should show how inherited missions and rewarded expertise both evade responsibility' },
      second: { label: 'File distinct chains of choice', direction: 'The archive should connect the records while preserving their different actors, victims, and decisions' },
      topics: [
        topic('the Varga port list', 'Lise learned that her ancestor sold a port list and later described the resulting raid as a hunt', 'my family turned betrayal into lineage by changing the noun after people died', 'I cannot use your ancestor to make my own court service look ordinary or shared', 'I will annotate only the places where my cipher touched that list and leave the Varga account to you'),
        topic('the forge directive code', 'the archive furnace preserved orders that Mateus could decode because he designed their grammar', 'expertise is evidence here, but expertise does not appoint its author judge', 'I will explain the grammar and surrender every conclusion to readers with other records', 'I will create a key that exposes ambiguity instead of silently resolving it in my favor'),
        topic('the room the court offered', 'the Furnace Abbot offered Mateus a place in the court while prisoners crossed the open route', 'refusing a room today does not erase the people delivered to its earlier rooms', 'I know, and I will not stage refusal as if it were the difficult part of accountability', 'I will name the deliveries I remember and accept supervision where memory affects a search'),
        topic('the inherited right to purge', 'Lise has begun striking the word purge from the oath her family preserved', 'a bloodline cannot be a target category, even when one member has become dangerous', 'do not rewrite the oath around me as a demonstration that you can spare one vampire', 'I will write it around named protection and consent, with no specimen required to prove restraint'),
      ],
    }),
    scene({
      title: 'An Oath Without a Specimen',
      theme: 'After Hushroad, Lise tests her revised oath while Mateus refuses to become evidence of her moral improvement.',
      prompt: 'Who should review the revised Varga oath before it enters Aya casebook?',
      first: { label: 'Ask protected communities first', direction: 'People asked to rely on the oath should review its limits before any hunter or vampire comments' },
      second: { label: 'Publish a draft with objections', direction: 'The draft should travel with Lise and Mateus objections visibly attached for public revision' },
      topics: [
        topic('the named-person promise', 'Lise now promises protection to named people rather than war against a lineage', 'the new object of the oath must be consent and safety, not my image of a worthy victim', 'that change matters because it removes my body from the center of your moral drama', 'I will help identify language that makes protection conditional on gratitude or resemblance'),
        topic('the refusal of proof', 'Mateus told Lise not to write him into the oath as proof of her mercy', 'I was angry because the warning was accurate before I had admitted it to myself', 'accuracy gives me no ownership over the oath and no right to demand a gracious response', 'I will offer objections only when asked and will not appear in the final text as an exception'),
        topic('the aqueduct releases', 'name slips returned through flowing water released people whom the court had weaponized', 'the release proves identity can guide rescue without defining a class for extermination', 'my old court reports erased names for the same reason hunters erased distinctions: categories travel faster', 'I will cross-reference every released name with the routes my reports helped close'),
        topic('the watcher at the lantern', 'Lise noticed Mateus guarding the survivor route without asking anyone to observe him', 'unwitnessed help may be sincere, but sincerity is still not the measure', 'the measure is whether the route remained open and whether survivors retained choices', 'I will report the route condition, not the fact that I happened to stand there'),
      ],
    }),
    scene({
      title: 'The Door Left Open',
      theme: 'With Kurohana broken, Lise and Mateus assess a protective rite that opened the final ward without converting sacrifice into absolution.',
      prompt: 'How should the archive describe Mateus use of the protective blood rite?',
      first: { label: 'Record effect and prior harm', direction: 'The rite entry should name the opened ward beside the court service that made the rite possible' },
      second: { label: 'Center those who passed through', direction: 'The entry should foreground the people and evidence protected by the opening, not the person who made it' },
      topics: [
        topic('the ward cracked at dawn', 'Mateus used his blood to expose Kurozane ward while Lise held the path behind him', 'a costly act can be necessary without purchasing a different past', 'pain is not payment when the debt belongs to people who did not choose the exchange', 'I will describe the ward mechanism and refuse any memorial language that calls the act redemption'),
        topic('the hand not taken', 'Lise offered Mateus balance after the rite but did not call the gesture forgiveness', 'helping someone stand can preserve a route without revising judgment about them', 'I accepted the hand because falling would have closed the door on those behind us', 'I will remember the gesture as coordination under danger, not a private pardon'),
        topic('the surviving archive bundles', 'records left Kurohana because the party carried them rather than burning the living archive clean', 'my family preferred a clean ruin because ruins do not contradict heroic accounts', 'the court preferred one perfect ledger because a single record can be owned', 'I will help sort contradictory bundles without selecting the version kindest to either inheritance'),
        topic('the future boundary', 'the final battle ended but Mateus caches and Lise hunting knowledge remain dangerous', 'both kinds of knowledge need consent, witnesses, and a right of refusal around their use', 'supervision must constrain me without turning you into my permanent jailer', 'I will inventory caches with local witnesses while you place your manuals under community control'),
      ],
    }),
    scene({
      title: 'Supervised Daylight',
      theme: 'At the open archive, Lise and Mateus define an accountable future based on correction, supervision, and separable work rather than friendship.',
      prompt: 'What continuing arrangement should the public archive record for them?',
      first: { label: 'Maintain separate supervised duties', direction: 'Lise defense teaching and Mateus cache work should remain separately supervised and publicly reviewable' },
      second: { label: 'Convene periodic joint testimony', direction: 'They should meet only for scheduled testimony where overlapping records require direct comparison' },
      topics: [
        topic('the correction shelf', 'Aya placed corrections beside testimony instead of hiding later disputes', 'my revised oath belongs there because revision is part of its authority, not a flaw', 'my admissions belong there because memory under pressure can still be wrong or self-serving', 'I will return when a witness challenges my account and answer without controlling the session'),
        topic('the supervised cache list', 'Mateus cache locations will be checked by people from the routes those caches endangered', 'supervision is not humiliation; it is a way to redistribute the power hidden knowledge creates', 'I agree, provided witnesses can stop a search when its risk changes', 'I will surrender the map in sections so no single interpreter owns every location'),
        topic('the defense lesson ledger', 'Lise plans to teach defense while leaving communities free to reject her methods', 'a lesson must include when not to draw a weapon and who decides that threshold', 'that boundary is one my court training deliberately removed from local hands', 'I will translate requests without turning them into recruitment or threat assessments'),
        topic('the absence of friendship', 'neither Lise nor Mateus promises friendship at the testimony table', 'honesty about distance is kinder than a reconciliation demanded for public comfort', 'I can work beside your refusal without making your refusal a punishment', 'I will keep the work correctable and let any warmer relation remain unnecessary'),
      ],
    }),
  ],

  'ren-genta': [
    scene({
      title: 'Orders on the Dock',
      theme: 'Ren tests whether Genta refusal of Kaji was a durable break with command habits or one dramatic exception.',
      prompt: 'What should Ren ask Genta to do before joining the road beyond Sodegaura?',
      first: { label: 'List every enforceable order', direction: 'Genta should identify current orders he can still countermand and the people affected by them' },
      second: { label: 'Submit to route decisions', direction: 'Genta should accept that civilians and couriers, not his former rank, decide the next route' },
      topics: [
        topic('the transport order refused', 'Genta refused Kaji in front of workers after seeing a family marked as cargo', 'one refusal matters, but I need to know what happens when nobody is watching', 'I obeyed similar language before because procedure let me avoid picturing the family', 'I will name every subordinate who may still treat my old signals as binding and revoke them openly'),
        topic('the wrong-hour permit', 'Genta stopped Ren because the party permit did not fit the checkpoint hour', 'precision can protect people, but it can also make an unjust checkpoint efficient', 'I was proud of noticing errors even when the correct paper served a cruel route', 'I will use checkpoint knowledge to expose prisoner marks and never to demand cleaner papers from refugees'),
        topic('the courier command voice', 'Ren noticed Genta turning suggestions into clipped orders during the dock escape', 'I will not trade one captain for another just because the second captain chose us', 'command speech returns before I notice it, especially when I am frightened of delay', 'I will state hazards and ask who accepts the task instead of assigning bodies to positions'),
        topic('the first key custody', 'Genta carried the first bell key because his armor made the crane route safer', 'carrying the key is a task, not a claim that you lead the party', 'I agree, and the key should pass to Aya whenever evidence decisions begin', 'I will announce each transfer and keep no duplicate mark that could become private authority'),
      ],
    }),
    scene({
      title: 'Who Carries the Plan',
      theme: 'Kiku terms make Ren and Genta examine how urgency turns capable people into compulsory labor.',
      prompt: 'How should they divide planning authority for the next dangerous route?',
      first: { label: 'Let care set the timetable', direction: 'Kiku care assessment should determine departure before tactical convenience is considered' },
      second: { label: 'Use a consent roll call', direction: 'Every assigned role should be restated as a request with a visible refusal option' },
      topics: [
        topic('the sailors who could not move', 'Kiku delayed the reef approach because injured sailors needed the skiff first', 'a fast route that leaves someone behind is only fast for the people doing the counting', 'my training called such people impediments and praised officers who stopped seeing faces', 'I will put care limits at the top of the plan instead of adding them after formations'),
        topic('the courier who says yes', 'Ren has accepted dangerous deliveries before anyone finished explaining the risk', 'my willingness can become an excuse for leaders to stop asking others properly', 'I have used reliable volunteers that way, rewarding courage until refusal looked shameful', 'I will ask twice when someone answers too quickly and name an alternate route before accepting'),
        topic('the shield position', 'Genta habitually places himself where a route is most likely to break', 'choosing danger for yourself is different from choosing it for the person behind you', 'the distinction is obvious now and was professionally inconvenient then', 'I will offer my shield position and let the group decide whether it helps or narrows escape'),
        topic('the plan copied in plain words', 'Ren rewrote Genta tactical shorthand so witnesses could understand the route', 'a plan people cannot read is a plan they cannot meaningfully accept', 'clarity feels slower because it exposes assumptions officers usually leave unspoken', 'I will write distances, exits, and likely costs in ordinary words before anyone commits'),
      ],
    }),
    scene({
      title: 'The Slow Prison Road',
      theme: 'At the midpoint, Ren confronts Genta with the human arithmetic behind rescue and blast routes.',
      prompt: 'What lesson should they preserve from the prison-lock decision?',
      first: { label: 'Preserve the names behind delay', direction: 'The record should list the people reached because the party accepted a slower route' },
      second: { label: 'Preserve both route costs', direction: 'The record should state rescue gains and the additional danger created at the furnace' },
      topics: [
        topic('the blast route arithmetic', 'the blast route saved approach time by leaving occupied cells behind pressure doors', 'minutes are not neutral when the people paying them were excluded from the calculation', 'I presented the route as arithmetic because numbers kept me from saying whom I would abandon', 'I will attach names and mobility needs to every future time estimate'),
        topic('the slower locks', 'the rescue route opened each cell while the Furnace Abbot prepared stronger defenses', 'accepting greater combat risk was not charity; it kept our stated purpose intact', 'I feared the stronger defense and nearly let fear masquerade as strategic objectivity', 'I will say when a recommendation protects me from danger rather than protecting the mission'),
        topic('the prisoners during recovery', 'the party moved prisoners while the furnace attack entered a visible recovery window', 'combat timing mattered because it created care time, not because it made a stylish opening', 'that changes how I should call a window: first for movement, then for damage', 'I will name evacuation actions before attack actions whenever the same window serves both'),
        topic('the command after the door', 'Genta tried to count everyone himself once the prison doors opened', 'you cannot repair command by becoming the most responsible commander in every room', 'I was afraid a missed count would become another death assigned to me', 'I will share the count and accept that vigilance must be distributed to remain humane'),
      ],
    }),
    scene({
      title: 'Standing Where Asked',
      theme: 'After Hushroad, Ren and Genta define accountability toward former subordinates who refuse renewed allegiance.',
      prompt: 'What promise should Genta make before approaching another former unit?',
      first: { label: 'Offer facts without command', direction: 'Genta should provide route knowledge and supplies without asking anyone to follow him' },
      second: { label: 'Bring an independent witness', direction: 'A person outside the old chain should witness every stand-down conversation' },
      topics: [
        topic('the former subordinate refusal', 'a former soldier told Genta that useful information was not forgiveness', 'that refusal must remain complete even if the soldier accepts food or a route', 'I felt the old urge to earn obedience by proving I had changed', 'I will offer what I know and leave before gratitude can be mistaken for enlistment'),
        topic('the ferry route knowledge', 'Genta knows where prisoner ferries turn because he once helped secure them', 'knowledge gained through harm can serve rescue only when its source stays visible', 'I will not call the map experience as if it came from neutral travel', 'I will mark which closures I ordered and let survivors decide whether to use those passages'),
        topic('the place a shield should stand', 'Genta offered to stand where former soldiers needed him during the ferry breach', 'the phrase matters because they choose the place and can choose no place at all', 'obedience reversed is not accountability unless refusal remains safe', 'I will ask where to stand once, accept the answer, and not bargain for a more heroic position'),
        topic('the route map handed away', 'Ren gave survivors a copied warning map rather than keeping the best route for the party', 'information becomes protection when the person carrying it can alter their own path', 'officers hoard maps because dependence looks like coordination from above', 'I will copy maps early and never make access conditional on joining our operation'),
      ],
    }),
    scene({
      title: 'No Clean Command',
      theme: 'Inside the broken court, Ren and Genta reject the fantasy that one final correct order can repair a system of coerced obedience.',
      prompt: 'How should Genta role in the Kurohana evacuation be described?',
      first: { label: 'Describe a bounded coordinator', direction: 'The account should show Genta coordinating one route under survivor and healer direction' },
      second: { label: 'Describe tasks without rank', direction: 'The account should list carried bundles, held doors, and warnings without restoring a command title' },
      topics: [
        topic('the six-person entry', 'Genta entered Kurohana with five companions while the network kept the road outside alive', 'being inside the gate did not make us the center of everyone else work', 'battle habit made the inner team feel decisive even while evacuation routes sustained it', 'I will name the outside work first whenever I describe the breach'),
        topic('the archive collapse orders', 'unsafe halls forced rapid choices about people, bundles, and doors', 'urgency required coordination but did not erase the right to challenge a direction', 'I gave short instructions and must still distinguish which were requests and which allowed no answer', 'I will review each instruction with those present and record where urgency became coercion'),
        topic('the offer of restored rank', 'Kurozane offered Genta his former rank as if authority could erase guilt', 'rank was tempting because it promised a clean place from which to fix everything', 'I refused the offer, but the desire for clean authority did not vanish with the words', 'I will work without title where a title would make disagreement harder'),
        topic('the final enemy window', 'Ren waited through Kurozane recovery instead of rushing the exposed ward alone', 'discipline can mean refusing the dramatic move that would strand everyone else', 'I once called that restraint hesitation when reviewing younger soldiers', 'I will teach timing as protection of shared routes rather than proof of personal nerve'),
      ],
    }),
    scene({
      title: 'Mile Markers',
      theme: 'During repair, Ren and Genta turn courier routes and rebuilt roads into public measures of unfinished responsibility.',
      prompt: 'How should they organize work on the road Genta once helped close?',
      first: { label: 'Let residents set each section', direction: 'Residents should choose repair order while Ren carries requests and Genta supplies labor' },
      second: { label: 'Publish a closure ledger', direction: 'Each repaired section should display who closed it, who restored it, and what remains unsafe' },
      topics: [
        topic('the first rebuilt marker', 'Genta plans to repair a road marker after giving public testimony', 'repair after testimony keeps the labor from replacing the account', 'labor feels safer to me because stones do not ask difficult questions', 'I will testify first and return to the marker only when the road council assigns it'),
        topic('the packet that is not an order', 'Ren final packet contains people asking after one another instead of state commands', 'a courier route can carry questions without claiming authority over the answer', 'I closed roads to make every packet travel through military hands', 'I will reopen junctions and leave their local signs intact rather than replacing them with mine'),
        topic('the visible unfinished section', 'one washed-out stretch will remain unsafe after the first repair season', 'we should mark the gap honestly instead of painting a finished route on the map', 'officers hide incomplete work because completion protects budgets and reputations', 'I will post the limit, the next review date, and the name of the council that can revise it'),
        topic('the companionship without command', 'Ren and Genta can now walk a route without either assigning the other a role', 'working beside you is easier because I know I can reject your plan without rejecting you', 'that distinction is one I never offered my soldiers and must practice without praise', 'I will ask what you are carrying, offer a shoulder, and accept a simple no'),
      ],
    }),
  ],

  'aya-genta': [
    scene({
      title: 'Margin Beside the Order',
      theme: 'Aya requires Genta to place his refusal and earlier compliance in the same record rather than preserving only the heroic turn.',
      prompt: 'How should Aya structure Genta first written statement?',
      first: { label: 'Begin with the orders obeyed', direction: 'The statement should begin with orders Genta carried before describing the order he refused' },
      second: { label: 'Begin with affected witnesses', direction: 'The statement should open with worker and prisoner accounts before adding Genta explanation' },
      topics: [
        topic('the margin beside Kaji order', 'Aya copied Genta refusal beside the transport order rather than on a separate heroic page', 'the margin shows a change while leaving the original chain visible', 'I wanted the refusal copied alone because I was ashamed of the company it kept', 'I will dictate the earlier orders that make this refusal meaningful and difficult'),
        topic('the missing trial mark', 'Genta identified that the detained family had no charge or trial mark', 'procedural knowledge can expose abuse without making valid procedure automatically just', 'I used proper marks to reassure myself even when the destination remained cruel', 'I will explain what each mark authorized and where legality still concealed coercion'),
        topic('the witness who heard him', 'dock workers heard Genta name the order before he acted against Kaji', 'a witness is not scenery for your conscience; their account may contradict yours', 'I accept that their memory of my tone and delay carries equal or greater weight', 'I will not revise their statements for military vocabulary or apparent inconsistency'),
        topic('the signature under uncertainty', 'Aya asked Genta to sign a statement containing a gap he could not remember', 'an admitted gap is stronger evidence than a confident invention', 'command reports trained me to close gaps before superiors noticed them', 'I will sign beside the uncertainty and return if another record changes what I know'),
      ],
    }),
    scene({
      title: 'Care in the Record',
      theme: 'Kiku terms teach Aya and Genta that an archive of operations must record care work, refusals, and people who never fought.',
      prompt: 'What should Aya add to the standard operation record?',
      first: { label: 'Add a care-route ledger', direction: 'Every operation should record evacuation, rest, medicine, and who controlled those decisions' },
      second: { label: 'Add a refusal column', direction: 'Every assigned role should preserve who declined and what protection remained available' },
      topics: [
        topic('the uncounted skiff work', 'the reef account originally gave one line to sailors carried from the wreck', 'records imitate command when they count the battle and compress the care', 'my reports called evacuation support because combat was treated as the central action', 'I will reconstruct names, trips, injuries, and decisions with Kiku and the sailors'),
        topic('the person absent from battle', 'some survivors never saw the Widow-of-Fog encounter but determined whether others lived', 'absence from combat is not absence from the event or its authority', 'I used battle presence as the test for who could speak about an operation', 'I will ask people along the route what our plan cost them before reviewing tactics'),
        topic('the refused assignment', 'one fisher declined the night crossing and still repaired nets for the rescue boat', 'refusal changed the contribution without canceling membership in the village effort', 'under my old system refusal erased every later act and marked the person unreliable', 'I will record alternative work without presenting it as compensation for saying no'),
        topic('the healer final word', 'Kiku ended the reef scene by ordering breath before mourning', 'the sequence is evidence about priority, not merely a memorable line', 'I would once have placed a commander final order in that position', 'I will place Kiku care decision in the operation summary and explain why it governed us'),
      ],
    }),
    scene({
      title: 'Chain of Signatures',
      theme: 'Forge directives let Aya trace institutional responsibility through Genta signatures without treating a chain of command as diluted blame.',
      prompt: 'How should signatures be connected to the requisition system?',
      first: { label: 'Map each decision point', direction: 'The archive should connect every signature to the choice it enabled and the people affected' },
      second: { label: 'Pair orders with local accounts', direction: 'Each military directive should sit beside testimony from the town or route where it operated' },
      topics: [
        topic('the requisition route mark', 'Genta recognized military marks on coal quotas presented as civil protection', 'recognition must show who selected the route rather than merely proving military involvement', 'I approved route categories while telling myself quotas came from another office', 'I will identify which categories bore my review and which names sat above mine'),
        topic('the signature that forwarded harm', 'one Genta mark did not create a quota but moved it to the next checkpoint', 'forwarding is an action when the system depends on uninterrupted passage', 'I treated forwarding as absence of judgment because I did not write the first sentence', 'I will describe what authority I had to delay, question, or expose each forwarded order'),
        topic('the cipher beside the command', 'Mateus code and Genta route marks met on the same forge directive', 'different technical roles can form one harmful chain without becoming identical', 'I will not hide behind the interpreter or pretend my logistics authored his cipher', 'I will mark the handoff where translated accusation became a route I enforced'),
        topic('the copied proof leaving Kozui', 'Aya sent multiple forge copies so no single tribunal could contain the evidence', 'redundancy protects the record from the hierarchy your signatures once served', 'a distributed record also prevents my confession from becoming the official final version', 'I will give each copy my statement while inviting local annotations before reunion'),
      ],
    }),
    scene({
      title: 'Names in the Current',
      theme: 'The aqueduct releases push Aya and Genta to record transformed soldiers as named people while documenting Genta former authority over them.',
      prompt: 'What should accompany each recovered name slip?',
      first: { label: 'Attach service and capture history', direction: 'Each slip should carry what is known about recruitment, orders, capture, and release' },
      second: { label: 'Let families choose the entry', direction: 'Families and survivors should decide which details enter the public archive' },
      topics: [
        topic('the first name answered', 'an Ashen soldier responded when Aya read the recovered name beside flowing water', 'the response disproves every report that reduced the person to a hostile type', 'I signed reports that used unit counts after names had already been taken away', 'I will help match unit movements to names without claiming authority over their stories'),
        topic('the order before transformation', 'some captives reached the bell system through routes Genta former command guarded', 'the release record must include the road before the ash, not begin at transformation', 'beginning at transformation would make the court seem like a sudden disaster I merely discovered', 'I will trace checkpoint dates and submit my role before asking families for details'),
        topic('the family right to silence', 'one family wants a returned name kept outside the public copy', 'restoring a name does not give the archive ownership of the person', 'military records treated privacy as obstruction whenever it limited tracking', 'I will keep operational notes sealed where consent requires and accept an acknowledged gap'),
        topic('the current that carries ash', 'the aqueduct physically separated ash from a spoken name during release', 'the image is powerful, but an image cannot replace the difficult record around it', 'I am tempted by symbols because they promise one clean moment of change', 'I will describe the release precisely and leave interpretation open to those who survived it'),
      ],
    }),
    scene({
      title: 'Custody Is a Verb',
      theme: 'Aya and Genta distinguish public custody of Ujiro from vengeance, passive confinement, or transfer into another closed hierarchy.',
      prompt: 'What safeguards should govern Ujiro custody?',
      first: { label: 'Rotate witnessed custody', direction: 'Custody decisions should rotate among harmed communities with every transfer recorded' },
      second: { label: 'Separate evidence from jailers', direction: 'No custodian should control the only copy of evidence used to question Ujiro' },
      topics: [
        topic('the living witness circle', 'people harmed by Ujiro stood in the audience hall when custody was decided', 'their presence gives authority, but no individual should be forced into guarding him', 'I can provide physical security without turning that service into command over the hearing', 'I will take shifts assigned by the witness council and submit to removal from them'),
        topic('the ledger not burned', 'Ren and Aya kept Ujiro last ledger alive despite the urge to destroy his instrument', 'evidence can remain dangerous, so preservation requires controlled access and copies', 'guards often confuse securing an object with owning every decision around it', 'I will guard the room while archivists and witnesses control keys, reading, and duplication'),
        topic('the prisoner with former rank', 'Genta knows how rank can survive inside custody through deference and private channels', 'Ujiro title must not continue governing how guards interpret his requests', 'I once carried messages because a detained superior still sounded like a superior', 'I will require witnessed written requests and refuse informal chains through old subordinates'),
        topic('the custody record correction', 'a witness disputed the first account of when Ujiro was disarmed', 'a security report must accept correction from people without military credentials', 'defensiveness would only reproduce the hierarchy custody is meant to interrupt', 'I will amend the time, preserve the original error, and name who corrected it with consent'),
      ],
    }),
    scene({
      title: 'Testimony With Corrections',
      theme: 'At the open archive, Aya and Genta build a testimony practice where confession is evidence subject to correction rather than a final moral performance.',
      prompt: 'How should Genta public testimony remain open after delivery?',
      first: { label: 'Schedule correction sessions', direction: 'The archive should reconvene whenever affected witnesses challenge a material part of the testimony' },
      second: { label: 'Publish an annotated transcript', direction: 'Every correction should appear beside the original statement without silently replacing it' },
      topics: [
        topic('the first-person statement', 'Genta testimony uses I ordered and I carried instead of passive military phrasing', 'grammar cannot guarantee honesty, but it can stop agency from disappearing automatically', 'saying I repeatedly feels smaller than the harm and still more truthful than procedure occurred', 'I will keep active verbs wherever I can name my decision and mark uncertainty elsewhere'),
        topic('the witness interruption', 'Aya plans to let witnesses interrupt rather than waiting for a polished statement to end', 'testimony is not theater, and sequence should not protect the speaker from contradiction', 'I will pause when challenged even if the interruption breaks the account I prepared', 'I will answer the challenged point first and return to chronology only with permission'),
        topic('the road repair after speech', 'Genta will help rebuild a road after testimony instead of offering labor in place of it', 'repair work and public account answer different needs and neither purchases closure', 'I expect some people to refuse my labor after accepting my information', 'I will accept separate decisions about testimony access, work assignment, and personal contact'),
        topic('the shelf that stays unfinished', 'Aya open archive includes a shelf for what remains unknown', 'your testimony belongs beside that shelf because memory cannot make the system complete', 'I once believed a complete report proved command competence', 'I will leave gaps visible and resist filling them with the version most favorable to me'),
      ],
    }),
  ],

  'lise-genta': [
    scene({
      title: 'Weapon Lessons',
      theme: 'Lise and Genta compare hunter training with military discipline while refusing the idea that skill removes personal judgment.',
      prompt: 'What rule should govern their first shared training session?',
      first: { label: 'Name the protected person first', direction: 'Every drill should begin by naming whom the movement protects and who may refuse participation' },
      second: { label: 'End each drill with critique', direction: 'Either partner may stop the drill and identify where technique encouraged coercion' },
      topics: [
        topic('the spear and shield line', 'Lise thrust and Genta shield can control a lane without striking everyone inside it', 'control is dangerous language when the people in the lane have nowhere else to go', 'soldiers praise a held lane and forget to ask whether it was also an exit', 'we will mark a civilian route before each drill and lose the exercise if we close it'),
        topic('the inherited target', 'Lise training named bloodlines while Genta training named enemy units', 'both names can make an individual disappear inside an approved category', 'unit language let me punish a group for one action without asking who chose it', 'we will identify behavior, immediate threat, and surrender path instead of inherited labels'),
        topic('the command to advance', 'Genta still says advance when he means he is offering a safer position', 'a command can outrun judgment because trained bodies move before thought catches up', 'I relied on that speed and called it cohesion', 'I will use questions in practice and reserve commands for immediate hazards with visible reasons'),
        topic('the useful foreign weapon', 'port brokers praised Lise reach as if her origin explained her skill', 'exotic praise makes a person into equipment while avoiding what she believes', 'military praise did the same by reducing soldiers to functions in formation', 'we will describe technique plainly and ask before adapting it for another group'),
      ],
    }),
    scene({
      title: 'The Journal and the Uniform',
      theme: 'The Varga journal makes Lise and Genta examine how families and institutions edit betrayal into honorable inheritance.',
      prompt: 'How should they compare family and military records?',
      first: { label: 'Trace who benefited from honor', direction: 'Each record should identify who gained status when betrayal was renamed duty' },
      second: { label: 'Place dissent beside ceremony', direction: 'Accounts from people who refused should sit beside oaths, citations, and formal praise' },
      topics: [
        topic('the raid renamed a hunt', 'the Varga journal converted a sold port list into a heroic hunt narrative', 'my inheritance preserved the weapon and discarded the people betrayed to justify it', 'uniform histories preserve maneuvers while treating requisitioned towns as background', 'we will compare what each proud account omits before accepting its stated purpose'),
        topic('the citation for a closed road', 'Genta received praise for securing a route later used to transport prisoners', 'honor attached to efficiency can make the purpose feel already judged', 'I displayed the citation because it discouraged questions from younger soldiers', 'I will place the citation beside transport testimony and state why I no longer accept it'),
        topic('the family correction resisted', 'Lise first impulse was to hide the journal until she could rewrite the oath herself', 'control over correction can repeat the ownership that produced the false inheritance', 'I understand the impulse because institutions call private revision responsibility', 'we will publish the source with context and let affected readers challenge our framing'),
        topic('the uniform set aside', 'Genta no longer wears his command badge but keeps the armor that protects others', 'objects can change use without pretending their history vanished', 'discarding the armor would be easier than answering what I did while wearing it', 'I will keep its old marks visible and accept when their sight makes someone refuse me'),
      ],
    }),
    scene({
      title: 'Breach Arithmetic',
      theme: 'The prison-lock choice forces a hunter and former officer to expose how tactical speed can conceal whose body pays for a breach.',
      prompt: 'What should they require before proposing force against a locked route?',
      first: { label: 'Produce a person-cost ledger', direction: 'Every breach plan should list who faces blast, delay, displacement, and lost escape options' },
      second: { label: 'Require a non-force route', direction: 'A slower non-force alternative must be described honestly before anyone approves a breach' },
      topics: [
        topic('the charge beside occupied cells', 'the quick route placed a blast charge near people who could not move themselves', 'calling the charge precise did not make the surrounding choices precise', 'officers use blast radius as if measurable harm were the only harm', 'we will map panic, blocked exits, hearing loss, and who controls the warning'),
        topic('the hunter shortcut', 'Lise knew a way to pierce the lock assembly without opening every cell corridor', 'technical elegance tempted me because it made rescue look like a weapon problem', 'I trusted elegant force for the same reason: it kept command inside expert hands', 'we will ask the people behind the lock what opening means before selecting a method'),
        topic('the Abbot preparation time', 'the rescue route gave the Furnace Abbot time to strengthen his defense', 'increased risk to fighters was real and should not be hidden to make rescue sound pure', 'honesty about combat cost must not become pressure on prisoners to waive rescue', 'we will state the risk to volunteers after confirming prisoners retain the route'),
        topic('the window used for evacuation', 'the party spent the furnace recovery window moving prisoners before attacking', 'a tactical opening can be judged by who escapes through it', 'I was trained to measure openings in damage delivered', 'we will score the drill by people cleared, choices preserved, and only then hostile control'),
      ],
    }),
    scene({
      title: 'A Stand-Down Without Fealty',
      theme: 'Former soldiers test whether Lise and Genta can offer safety without recruiting them into a hunter campaign or renewed command.',
      prompt: 'What should accompany a stand-down offer?',
      first: { label: 'Offer an unarmed exit map', direction: 'The soldiers should receive food and a route that requires no service to the party' },
      second: { label: 'Let a local council speak', direction: 'Someone outside both military and hunter traditions should present the terms and limits' },
      topics: [
        topic('the soldiers who distrust Genta', 'former subordinates refused to treat Genta new purpose as restored authority', 'their distrust should not make them attractive recruits for my revised oath', 'I cannot answer lost obedience by directing them toward your cause', 'we will offer safe routes and let each person choose civilian, witness, or no contact'),
        topic('the weapon laid down visibly', 'Lise placed her spear beyond reach before asking one soldier about a name slip', 'disarmament can lower immediate pressure without demanding the other person disarm first', 'officers often call mutual disarmament fair when only one side controls the room', 'we will create distance, name the exit, and accept silence before asking questions'),
        topic('the food without enlistment', 'Genta shared a cache that had once supplied his patrol route', 'food must not become a debt that later appears as consent to fight', 'military rations taught soldiers that every meal belonged to the chain of command', 'we will state that the cache is restitution and keep no list of recipients for recruitment'),
        topic('the hunter oath heard by soldiers', 'one former soldier asked whether Lise new oath would make court retainers protected people', 'named protection must apply even when a person wore an enemy uniform', 'uniform alone cannot settle responsibility, though orders and actions still matter', 'we will separate immediate safety from later testimony and never promise immunity from account'),
      ],
    }),
    scene({
      title: 'Six Inside the Gate',
      theme: 'At Kurohana, Lise and Genta examine elite-team mythology against the civilian routes that made the inner battle possible.',
      prompt: 'How should the breach story identify the six-person party?',
      first: { label: 'Call them one route team', direction: 'The six should be described as one bounded team among archive, boat, shelter, and medical routes' },
      second: { label: 'List dependencies before actions', direction: 'Every inner-court action should be preceded by the outside contribution that enabled it' },
      topics: [
        topic('the lantern signals outside', 'blue, green, and white lanterns marked records, boats, and medicine during the breach', 'those lights were not support effects for our weapons; they were separate plans with their own authority', 'I felt the gate battle as central because danger was loudest where I stood', 'we will narrate each signal result before describing our movement through the court'),
        topic('the six-person roster', 'the final entry allowed every companion into the active formation', 'availability is not a demand that every person attack or accept the same risk', 'formation language can turn presence into compulsory function', 'we will confirm roles at each phase and preserve a protected position for refusal or care'),
        topic('the offer tailored to rank and purge', 'Kurozane offered Lise an end to monsters and Genta restored rank', 'both offers promised certainty by returning us to identities we had learned to question', 'my offer made command sound like repair while yours made destruction sound like safety', 'we will record why each certainty was attractive instead of preserving only the refusal'),
        topic('the dawn account', 'the final opening depended on timing, records, a protective rite, and routes held elsewhere', 'no single weapon or officer can honestly claim the dawn', 'victory stories seek one decisive hand because distributed agency resists ownership', 'we will write the dependencies as a network and leave room for unnamed contributors'),
      ],
    }),
    scene({
      title: 'Teaching the Refusal',
      theme: 'In the repaired world, Lise and Genta design defense teaching that includes disobedience, withdrawal, and community authority.',
      prompt: 'What should be the first lesson in their shared defense workshop?',
      first: { label: 'Practice stopping the drill', direction: 'Participants should learn to halt an exercise and question its purpose without penalty' },
      second: { label: 'Map exits before weapons', direction: 'Every lesson should begin with evacuation, care points, and routes for nonparticipants' },
      topics: [
        topic('the right to stop practice', 'traditional hunter and military drills both punished hesitation', 'a trainee must be able to stop when the target, order, or risk becomes unclear', 'discipline should preserve judgment rather than replace it', 'we will reward a well-explained stop and review any instructor who pressures continuation'),
        topic('the community-owned armory', 'Lise does not want her family weapons to become a private Varga school', 'knowledge should stay local enough that people can refuse my presence later', 'central armories gave my officers leverage over every village defense choice', 'we will place tools under a rotating council with public inventory and withdrawal rules'),
        topic('the scenario without an enemy', 'one planned exercise focuses entirely on moving injured people through a blocked lane', 'defense is visible there without inventing a body that deserves harm', 'soldiers may find the exercise less glorious and more relevant', 'we will measure communication, consent, and arrival rather than aggression'),
        topic('the instructors under review', 'Lise and Genta agree that students may document and challenge their methods', 'our histories make review necessary, not insulting', 'expertise becomes dangerous when gratitude protects it from correction', 'we will publish criticism beside lesson notes and step aside when the council asks'),
      ],
    }),
  ],

  'mateus-genta': [
    scene({
      title: 'Men Who Made Roads',
      theme: 'Mateus and Genta recognize complementary roles in a court system without collapsing different choices into mutual absolution.',
      prompt: 'How should their first shared statement divide responsibility?',
      first: { label: 'Describe each handoff', direction: 'They should identify where Mateus language became a route Genta guarded or supplied' },
      second: { label: 'Write separate admissions first', direction: 'Each man should complete an independent account before comparing overlap' },
      topics: [
        topic('the accusation that traveled', 'Mateus cipher allowed a denunciation to move without its witness', 'I enforced destinations without asking what sentence had started the route', 'I made the sentence portable and pretended I had not chosen where it would arrive', 'we will map one order from accusation through translation, checkpoint, cell, and bell'),
        topic('the prisoner transport mark', 'Genta recognized a mark Mateus had seen in court registries', 'knowledge met too late because I trained myself to inspect form instead of purpose', 'I knew the purpose earlier and accepted rewards for making the form legible', 'we will name what each of us knew at every handoff and where we chose not to ask'),
        topic('the comfort of being useful', 'both men were praised for solving difficult administrative problems', 'competence let me feel honorable while the result remained cruel', 'I used sophistication as distance from men who carried out the order', 'we will describe skill as capacity that increased responsibility rather than reduced it'),
        topic('the refusal to trade confessions', 'neither admission can serve as payment for sympathy from the other', 'your guilt does not make mine ordinary and mine does not make you understood', 'agreement between perpetrators can become another closed room', 'we will submit separate statements to people outside our bond before discussing them together'),
      ],
    }),
    scene({
      title: 'The Patient Before the Plan',
      theme: 'Kiku care terms force Mateus and Genta to confront how administration and command both treat vulnerable people as delays.',
      prompt: 'What constraint should care place on their operational advice?',
      first: { label: 'Require healer approval', direction: 'No route using injured or displaced people should proceed before a healer confirms conditions' },
      second: { label: 'Give civilians a stop signal', direction: 'People on the route should hold a signal that pauses the operation without officer approval' },
      topics: [
        topic('the body called a delay', 'court schedules and military plans both assigned costs to people who could not move quickly', 'I wrote slow transport as risk to the operation rather than risk to the person', 'I translated illness into an exception code that made neglect look orderly', 'we will put the patient condition first and recalculate the plan around that fact'),
        topic('the healer outside hierarchy', 'Kiku instructions do not derive authority from rank or court office', 'I must follow care knowledge without converting her into a medical subordinate', 'I must translate her terms without polishing them for officials', 'we will repeat her limit exactly and let her revise any plan that cites it'),
        topic('the night watch assignment', 'Mateus and Genta both volunteer for watches other people may not want them near', 'volunteering does not override the camp right to choose a different watcher', 'usefulness can become a way to make our presence unavoidable', 'we will offer the task through Kiku and accept a reassignment beyond the sleeping area'),
        topic('the supply list with names', 'care supplies once traveled under anonymous household categories', 'a name can protect a delivery but also expose the recipient to tracking', 'my ciphers exploited names while your patrols exploited categories', 'we will let recipients choose coded, named, or unrecorded delivery with risks explained'),
      ],
    }),
    scene({
      title: 'Cipher and Requisition',
      theme: 'Forge evidence lets Mateus and Genta reconstruct how language, quotas, and routes became one apparatus of coercion.',
      prompt: 'What form should their joint reconstruction take?',
      first: { label: 'Build a public process map', direction: 'The reconstruction should show each office, decision, handoff, and available refusal point' },
      second: { label: 'Build witness-led case files', direction: 'Specific households should anchor the reconstruction instead of an abstract system diagram' },
      topics: [
        topic('the quota called protection', 'coal requisitions used civil language while military marks threatened family rations', 'I guarded the route and let the civil label narrow what I believed I could question', 'I helped choose words that made coercion sound like administration', 'we will place the threat, euphemism, signature, and household result on the same page'),
        topic('the portable court code', 'Mateus cipher standardized how local accusations entered central records', 'standardization increased the speed at which my patrols received apparently complete orders', 'the code removed hesitation by hiding the missing witness behind consistent grammar', 'we will restore every omitted witness field and show which offices benefited from the omission'),
        topic('the inventory of fear', 'forge schedules counted fear as material for bell production', 'I protected shipments without knowing fear was the cargo and without trying hard enough to know', 'I knew the metaphor was literal and chose survival inside the court', 'we will state different knowledge levels without using ignorance as innocence'),
        topic('the copy beyond their control', 'Aya sent forge proof away before either man could perfect his account', 'losing control of the narrative is part of making the evidence useful', 'I cannot revise every reader interpretation into the one I consider accurate', 'we will answer corrections and never demand the copies return to a central authority'),
      ],
    }),
    scene({
      title: 'No Rank in the Rescue',
      theme: 'Hushroad rescue requires Mateus and Genta to use dangerous knowledge without recreating interpreter and officer authority.',
      prompt: 'How should survivors direct their expertise during the rescue?',
      first: { label: 'Use question-based briefings', direction: 'Mateus and Genta should offer hazards and options while survivors select the route' },
      second: { label: 'Assign removable roles', direction: 'The survivor council should assign each man a role it can revoke at any moment' },
      topics: [
        topic('the aqueduct cipher marks', 'Mateus can read bell marks while Genta knows patrol spacing around them', 'combined knowledge creates power unless the people moving can reject our conclusion', 'I should describe what the mark predicts without declaring the only route', 'we will present two routes, uncertainties, and the point where either can be abandoned'),
        topic('the former soldiers nearby', 'some rescuers once served under Genta and know Mateus as a court interpreter', 'our presence may feel like the old hierarchy even when our instructions change', 'tone and vocabulary can restore rank before anyone consents', 'we will ask a trusted survivor to relay technical warnings in their own words'),
        topic('the name slip release', 'the first release succeeded through water and a returned name rather than force', 'the result challenges every command category that called the transformed person irrecoverable', 'my registry work helped remove names before your orders treated ash as a unit', 'we will prioritize locating slips and protect the person during the slower release'),
        topic('the warning map copied outward', 'survivors carried the route warning beyond the party control', 'a copied map reduces dependence on our continued presence', 'officers and interpreters both gain leverage when knowledge must pass through them', 'we will teach the symbols, distribute copies, and accept local alterations'),
      ],
    }),
    scene({
      title: 'Refusing the Easy Sentence',
      theme: 'Kurozane offers expose the simple stories Mateus and Genta still desire: guilt erased for one and rank restored for the other.',
      prompt: 'What should their refusal record preserve besides the spoken no?',
      first: { label: 'Preserve why each offer tempted', direction: 'The account should name the relief each offer promised and the people who would have paid' },
      second: { label: 'Preserve the next constraint', direction: 'Each refusal should be followed by a concrete limit on future authority and secrecy' },
      topics: [
        topic('the offer of no guilt', 'Kurozane offered Mateus freedom from guilt without responsibility', 'I wanted silence inside myself even knowing someone else would bear its price', 'your temptation resembles my wish that restored rank could turn repair into command', 'we will state the desire plainly and identify whose suffering the offer required us to ignore'),
        topic('the offer of restored rank', 'Genta was offered the authority he once believed defined his value', 'I imagined using the rank correctly, which is how the offer disguised its hierarchy', 'I imagined serving without pain, which is how mine disguised abandoned account', 'we will refuse not only Kurozane but the easy self-story inside each offer'),
        topic('the protective rite and formation', 'Mateus opened a ward while Genta held a route during the final phase', 'necessary conduct after refusal does not prove the refusal permanent', 'one correct formation cannot certify a future life', 'we will attach continuing supervision and role limits to the record of what worked'),
        topic('the court archive carried out', 'both men helped move evidence that could condemn them', 'carrying the record is not courage if we select what survives', 'I felt the impulse to save tactical records and leave personal accusations behind', 'we will carry bundles assigned by Aya and witnesses without opening or exchanging them'),
      ],
    }),
    scene({
      title: 'Work Under Witness',
      theme: 'In the epilogue, Mateus and Genta choose supervised repair practices that keep their expertise useful, bounded, and removable.',
      prompt: 'How should their ongoing work be reviewed?',
      first: { label: 'Use separate public supervisors', direction: 'Cache searches and road repair should answer to different local councils with published limits' },
      second: { label: 'Hold joint process audits', direction: 'Periodic hearings should compare how hidden knowledge and old authority are being constrained' },
      topics: [
        topic('the cache search witness', 'Mateus will locate court caches only with a witness authorized to stop the search', 'the witness needs practical control, not ceremonial presence', 'I will disclose hazards before entry and surrender any object without private examination', 'we will record who stopped or changed a search and why the decision remained valid'),
        topic('the road repair assignment', 'Genta will rebuild sections selected by communities whose movement he restricted', 'labor must follow their priority rather than the route that best displays effort', 'I will take ordinary assignments and not reorganize crews around my experience', 'we will publish task requests so refusal or reassignment cannot be treated as disrespect'),
        topic('the expertise that can be removed', 'both men possess knowledge that institutions once made indispensable', 'accountable work must remain possible when either of us is dismissed', 'I will train multiple readers and leave a cipher key that records uncertainty', 'I will document methods and avoid becoming the only person who knows a repair sequence'),
        topic('the meeting without absolution', 'Mateus and Genta can review work together without declaring each other forgiven', 'shared responsibility does not require shared comfort or a mutual pardon', 'we can challenge each other because neither challenge settles what victims decide', 'we will keep the meeting public, bounded to work, and open to correction from outside'),
      ],
    }),
  ],
};

const middlePairs = CAMP_CONVERSATION_GROUPS.middle;
const built = middlePairs.flatMap((pairId) => {
  const pairPlan = getCampConversationPlan(pairId);
  const authored = CONTENT[pairId];
  if (!pairPlan || !authored || authored.length !== pairPlan.conversations.length) {
    throw new Error(`Middle camp content does not match the six-conversation plan for ${pairId}.`);
  }
  return pairPlan.conversations.map((planned, index) => buildConversation(
    pairPlan,
    planned,
    authored[index],
    CADENCE_BY_TITLE[authored[index].title],
  ));
});

export const CAMP_CONVERSATIONS_MIDDLE = deepFreeze(built);

const validation = validateCampConversationPack(CAMP_CONVERSATIONS_MIDDLE, {
  expectedPairIds: CAMP_CONVERSATION_GROUPS.middle,
});

if (!validation.ok) {
  throw new Error(`Invalid middle camp conversation pack:\n${validation.errors.join('\n')}`);
}

export const CAMP_CONVERSATIONS_MIDDLE_METRICS = validation.metrics;
