/** Complete finite camp-conversation catalogue, assembled in canonical pair order. */

import {
  CAMP_CONVERSATION_PLAN,
  CAMP_CONVERSATION_SCHEMA_VERSION,
  validateCampConversationPack,
} from '../camp-conversation-contract.mjs';
import { CAMP_CONVERSATIONS_EARLY } from './camp-conversations-early.mjs';
import { CAMP_CONVERSATIONS_MIDDLE } from './camp-conversations-middle.mjs';
import { CAMP_CONVERSATIONS_LATE } from './camp-conversations-late.mjs';

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};

const wordCount = (value) => typeof value === 'string'
  ? value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0
  : 0;

const conversations = [
  ...CAMP_CONVERSATIONS_EARLY,
  ...CAMP_CONVERSATIONS_MIDDLE,
  ...CAMP_CONVERSATIONS_LATE,
];

const validation = validateCampConversationPack(conversations, { strictCatalogue: true });
if (!validation.ok) throw new Error(`Invalid complete camp-conversation catalogue:\n${validation.errors.join('\n')}`);

export const CAMP_CONVERSATION_METRICS = validation.metrics;
export const CAMP_CONVERSATION_PLAYABLE_METRICS = deepFreeze(conversations.reduce((metrics, conversation) => {
  const selectedOption = conversation.choice.options[0];
  const visibleText = [
    conversation.title,
    conversation.theme,
    conversation.choice.prompt,
    ...conversation.dialogue.map((line) => line.line),
    ...conversation.choice.options.map((option) => option.label),
    ...selectedOption.response.map((line) => line.line),
    selectedOption.consequence.summary,
  ];
  return {
    conversationCount: metrics.conversationCount + 1,
    mainLineCount: metrics.mainLineCount + conversation.dialogue.length,
    selectedResponseLineCount: metrics.selectedResponseLineCount + selectedOption.response.length,
    dialogueLineCount: metrics.dialogueLineCount + conversation.dialogue.length + selectedOption.response.length,
    choiceCount: metrics.choiceCount + 1,
    visibleWordCount: metrics.visibleWordCount + visibleText.reduce((sum, text) => sum + wordCount(text), 0),
  };
}, {
  conversationCount: 0,
  mainLineCount: 0,
  selectedResponseLineCount: 0,
  dialogueLineCount: 0,
  choiceCount: 0,
  visibleWordCount: 0,
}));
export const CAMP_CONVERSATIONS = deepFreeze({
  schemaVersion: CAMP_CONVERSATION_SCHEMA_VERSION,
  finite: true,
  repeatable: false,
  completionPolicy: 'once-per-save',
  conversations,
  metrics: CAMP_CONVERSATION_METRICS,
  playableMetrics: CAMP_CONVERSATION_PLAYABLE_METRICS,
});

const byId = new Map(conversations.map((conversation) => [conversation.id, conversation]));
const byPair = new Map(CAMP_CONVERSATION_PLAN.map((entry) => [
  entry.pairId,
  deepFreeze(conversations.filter((conversation) => conversation.pairId === entry.pairId)),
]));
const EMPTY_CONVERSATIONS = Object.freeze([]);

export function getCampConversation(conversationId) {
  return byId.get(conversationId) ?? null;
}

export function getCampConversationsForPair(pairId) {
  return byPair.get(pairId) ?? EMPTY_CONVERSATIONS;
}

export function getCampConversationsForCamp(campId) {
  return deepFreeze(conversations.filter((conversation) => conversation.campId === campId));
}
