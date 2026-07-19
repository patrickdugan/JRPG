import { CAMPAIGN } from './content/campaign.mjs';
import {
  PARTY_MEMBER_IDS,
  createAdvancementState,
  createAdvancementStorageAdapter,
  getParty,
  getPartyMember,
} from './advancement.mjs';
import {
  CAMP_CATALOGUE,
  EQUIPMENT_SLOTS,
  ITEM_CATALOGUE,
  VOW_CATALOGUE,
  buyItem,
  createLoadoutState,
  createLoadoutStorageAdapter,
  equipItem,
  equipVow,
  getCharacterSummary,
  learnVow,
  restAtCamp,
  sellItem,
  syncPartyVitals,
  unequipItem,
  unequipVow,
  upgradeItem,
  useConsumable,
} from './loadout.mjs';
import {
  createPlaytimeState,
  createPlaytimeStorageAdapter,
  formatPlaytime,
  isPlaytimeInactive,
  recordPlaytime,
} from './playtime.mjs';
import {
  createRunReceiptStorageAdapter,
  recordRunPlaytime,
} from './run-receipt.mjs';
import {
  createCampaignState,
  createLocalStorageAdapter,
} from './progression.mjs';
import { CAMP_CONVERSATIONS } from './content/camp-conversations.mjs';
import { getCampConversationPlan } from './camp-conversation-contract.mjs';
import {
  acknowledgeCampConversationLine,
  acknowledgeCampConversationResponse,
  beginCampConversation,
  chooseCampConversationOption,
  createCampConversationState,
  createCampConversationStorageAdapter,
  getCampConversationAvailability,
  getCampConversationProgress,
  getCampConversationRecord,
  getCampConversationRuntimeMetrics,
} from './camp-conversation-runtime.mjs';
import { ARCHIVE_RECORDS } from './content/archive-records.mjs';
import {
  acknowledgeArchiveRecordParagraph,
  beginArchiveRecord,
  createArchiveRecordState,
  createArchiveRecordStorageAdapter,
  getArchiveRecordAvailability,
  getArchiveRecordProgress,
  getArchiveRecordProgressRecord,
  getArchiveRecordRuntimeMetrics,
} from './archive-record-runtime.mjs';
import { PARTY_COUNCILS } from './content/party-councils.mjs';
import {
  acknowledgePartyCouncilLine,
  acknowledgePartyCouncilResponse,
  beginPartyCouncil,
  choosePartyCouncilOption,
  createPartyCouncilState,
  createPartyCouncilStorageAdapter,
  getPartyCouncilAvailability,
  getPartyCouncilProgress,
  getPartyCouncilRecord,
  getPartyCouncilRuntimeMetrics,
} from './party-council-runtime.mjs';

const partyList = document.querySelector('#campPartyList');
const partyCurrency = document.querySelector('#partyCurrency');
const campSelect = document.querySelector('#campSelect');
const campDescription = document.querySelector('#campDescription');
const restParty = document.querySelector('#restParty');
const memberRole = document.querySelector('#memberRole');
const memberName = document.querySelector('#memberName');
const memberVitals = document.querySelector('#memberVitals');
const memberLevel = document.querySelector('#memberLevel');
const memberStats = document.querySelector('#memberStats');
const equipmentSummary = document.querySelector('#equipmentSummary');
const equipmentSlots = document.querySelector('#equipmentSlots');
const vowSlotSummary = document.querySelector('#vowSlotSummary');
const equippedVows = document.querySelector('#equippedVows');
const vowCatalogue = document.querySelector('#vowCatalogue');
const inventoryCount = document.querySelector('#inventoryCount');
const inventoryList = document.querySelector('#inventoryList');
const inventoryTabs = document.querySelector('.inventory-tabs');
const shopList = document.querySelector('#shopList');
const campFeedback = document.querySelector('#campFeedback');
const campPlaytime = document.querySelector('#campPlaytime');
const portraitToken = document.querySelector('#portraitToken');
const campConversationSummary = document.querySelector('#campConversationSummary');
const campConversationList = document.querySelector('#campConversationList');
const campConversationStage = document.querySelector('#campConversationStage');
const campConversationMeta = document.querySelector('#campConversationMeta');
const campConversationTitle = document.querySelector('#campConversationTitle');
const campConversationTheme = document.querySelector('#campConversationTheme');
const campConversationLine = document.querySelector('#campConversationLine');
const campConversationChoices = document.querySelector('#campConversationChoices');
const advanceCampConversation = document.querySelector('#advanceCampConversation');
const partyCouncilSummary = document.querySelector('#partyCouncilSummary');
const partyCouncilList = document.querySelector('#partyCouncilList');
const partyCouncilStage = document.querySelector('#partyCouncilStage');
const partyCouncilMeta = document.querySelector('#partyCouncilMeta');
const partyCouncilTitle = document.querySelector('#partyCouncilTitle');
const partyCouncilTheme = document.querySelector('#partyCouncilTheme');
const partyCouncilLine = document.querySelector('#partyCouncilLine');
const partyCouncilChoices = document.querySelector('#partyCouncilChoices');
const advancePartyCouncil = document.querySelector('#advancePartyCouncil');
const archiveRecordSummary = document.querySelector('#archiveRecordSummary');
const archiveRecordList = document.querySelector('#archiveRecordList');
const archiveRecordStage = document.querySelector('#archiveRecordStage');
const archiveRecordMeta = document.querySelector('#archiveRecordMeta');
const archiveRecordTitle = document.querySelector('#archiveRecordTitle');
const archiveRecordAccess = document.querySelector('#archiveRecordAccess');
const archiveRecordParagraph = document.querySelector('#archiveRecordParagraph');
const advanceArchiveRecord = document.querySelector('#advanceArchiveRecord');

const campaignAdapter = createLocalStorageAdapter();
const campaignLoaded = campaignAdapter.load();
let campaignState = campaignLoaded.ok ? campaignLoaded.state : createCampaignState();
const advancementAdapter = createAdvancementStorageAdapter();
const advancementLoaded = advancementAdapter.load();
let advancementState = advancementLoaded.ok ? advancementLoaded.state : createAdvancementState();
const loadoutAdapter = createLoadoutStorageAdapter();
const loadoutLoaded = loadoutAdapter.load();
let loadoutState = loadoutLoaded.ok ? loadoutLoaded.value : createLoadoutState();
const synced = syncPartyVitals(loadoutState, getParty(advancementState));
if (synced.ok) loadoutState = synced.state;
loadoutAdapter.save(loadoutState);

const playtimeAdapter = createPlaytimeStorageAdapter();
const playtimeLoaded = playtimeAdapter.load();
let playtimeState = playtimeLoaded.ok ? playtimeLoaded.state : createPlaytimeState();
const runReceiptAdapter = createRunReceiptStorageAdapter();
const runReceiptLoaded = runReceiptAdapter.load();
let runReceiptState = runReceiptLoaded.ok && runReceiptLoaded.found ? runReceiptLoaded.state : null;
const campConversationAdapter = createCampConversationStorageAdapter();
const campConversationLoaded = campConversationAdapter.load();
let campConversationState = campConversationLoaded.state ?? createCampConversationState(runReceiptState?.runId);
const partyCouncilAdapter = createPartyCouncilStorageAdapter();
const partyCouncilLoaded = partyCouncilAdapter.load();
let partyCouncilState = partyCouncilLoaded.state ?? createPartyCouncilState(runReceiptState?.runId);
const archiveRecordAdapter = createArchiveRecordStorageAdapter();
const archiveRecordLoaded = archiveRecordAdapter.load();
let archiveRecordState = archiveRecordLoaded.state ?? createArchiveRecordState(runReceiptState?.runId);
const finiteNarrativeLoadWarnings = [
  !campConversationLoaded.ok ? 'Companion progress was unreadable and reset for this run.' : null,
  campConversationLoaded.resetForRun ? 'Companion progress from another run was reset.' : null,
  !partyCouncilLoaded.ok ? 'Party-council progress was unreadable and reset for this run.' : null,
  partyCouncilLoaded.resetForRun ? 'Party-council progress from another run was reset.' : null,
  !archiveRecordLoaded.ok ? 'Archive-reading progress was unreadable and reset for this run.' : null,
  archiveRecordLoaded.resetForRun ? 'Archive-reading progress from another run was reset.' : null,
].filter(Boolean);
let playtimeLast = performance.now();
let playtimeLastActivity = performance.now();
let playtimeUnsaved = 0;
let runReceiptPendingMs = 0;
let selectedMemberId = getParty(advancementState, { unlockedOnly: true })[0]?.id ?? 'ren';
let inventoryFilter = 'all';
let selectedCampConversationId = campConversationState.records.find((record) => record.status === 'active')?.id ?? null;
let selectedPartyCouncilId = partyCouncilState.records.find((record) => record.status === 'active')?.id ?? null;
let selectedArchiveRecordId = archiveRecordState.records.find((record) => record.status === 'active')?.id ?? null;
let archiveReviewParagraphIndex = null;
const routeParameters = new URLSearchParams(window.location.search);
const requestedRouteType = routeParameters.get('routeType');
const requestedRouteId = routeParameters.get('routeId');
const ROUTE_FOCUS_SELECTORS = Object.freeze({
  'camp-conversation': 'campConversationId',
  'party-council': 'partyCouncilId',
  'archive-record': 'archiveRecordId',
});
let routeFocusPending = Boolean(ROUTE_FOCUS_SELECTORS[requestedRouteType] && requestedRouteId);

const ROLES = Object.freeze({
  ren: 'Courier Vanguard', aya: 'Ledger Arcanist', lise: 'Dawn Hunter',
  mateus: 'Penitent Censer', genta: 'Bridge Warden', kiku: 'Cold Remedy Keeper',
});

function castName(memberId) {
  return CAMPAIGN.cast?.[memberId]?.name ?? getPartyMember(advancementState, memberId).name;
}

function itemName(itemId) {
  return ITEM_CATALOGUE[itemId]?.name ?? itemId;
}

function resultMessage(result) {
  if (!result.ok) return result.reason;
  const receipt = result.receipt ?? {};
  if (receipt.type === 'buy') return `Bought ${receipt.quantity} × ${itemName(receipt.itemId)} for ${receipt.cost} mon.`;
  if (receipt.type === 'sell') return `Sold ${receipt.quantity} × ${itemName(receipt.itemId)} for ${receipt.proceeds} mon.`;
  if (receipt.type === 'equip') return `${castName(receipt.memberId)} equipped ${itemName(receipt.itemId)}.`;
  if (receipt.type === 'unequip') return `${castName(receipt.memberId)} stored ${itemName(receipt.itemId)}.`;
  if (receipt.type === 'upgrade') return `${itemName(receipt.itemId)} reached forge rank ${receipt.level}.`;
  if (receipt.type === 'learn-vow') return `Learned ${VOW_CATALOGUE[receipt.vowId]?.name ?? receipt.vowId}.`;
  if (receipt.type === 'equip-vow') return `${castName(receipt.memberId)} bound ${VOW_CATALOGUE[receipt.vowId]?.name ?? receipt.vowId}.`;
  if (receipt.type === 'unequip-vow') return `${castName(receipt.memberId)} released ${VOW_CATALOGUE[receipt.vowId]?.name ?? receipt.vowId}.`;
  if (receipt.type === 'use') return `${castName(receipt.memberId)} used ${itemName(receipt.itemId)}.`;
  if (receipt.type === 'camp-rest') return `The party rested at ${CAMP_CATALOGUE[receipt.campId].name} for ${receipt.cost} mon.`;
  return 'Camp state updated.';
}

function commit(result) {
  campFeedback.textContent = resultMessage(result);
  if (!result.ok) return false;
  const saved = loadoutAdapter.save(result.state);
  if (!saved.ok) {
    campFeedback.textContent = 'Camp change was not applied because its save could not be written.';
    return false;
  }
  loadoutState = result.state;
  render();
  return true;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderParty() {
  const views = getParty(advancementState);
  partyList.replaceChildren(...views.map((view, index) => {
    const button = element('button', 'party-button');
    button.type = 'button';
    button.dataset.memberId = view.id;
    button.role = 'tab';
    button.disabled = !view.unlocked;
    button.setAttribute('aria-selected', String(view.id === selectedMemberId));
    const glyph = element('span', 'party-glyph', String(index + 1));
    const copy = element('span');
    copy.append(element('strong', '', view.name), element('small', '', view.unlocked ? ROLES[view.id] : 'Joins during the campaign'));
    button.append(glyph, copy, element('span', '', `LV ${view.level}`));
    return button;
  }));
}

function combinedStats(member, modifiers) {
  return Object.fromEntries(Object.entries(member.stats).map(([key, value]) => [key, value + (modifiers.stats[key] ?? 0)]));
}

function renderMember() {
  const member = getPartyMember(advancementState, selectedMemberId);
  const summary = getCharacterSummary(loadoutState, selectedMemberId);
  const stats = combinedStats(member, summary.modifiers);
  memberRole.textContent = ROLES[selectedMemberId];
  memberName.textContent = member.name;
  const atlasRow = Math.max(0, PARTY_MEMBER_IDS.indexOf(selectedMemberId));
  portraitToken.classList.add('has-atlas');
  portraitToken.style.backgroundImage = "url('assets/production/bells-party-field-atlas-v1.png')";
  portraitToken.style.backgroundSize = '540px 360px';
  portraitToken.style.backgroundPosition = `-278px -${atlasRow * 60}px`;
  memberLevel.textContent = `LV ${member.level}`;
  memberVitals.textContent = `HP ${summary.vitals.hp}/${summary.vitals.maxHp} · MP ${summary.vitals.mp}/${summary.vitals.maxMp} · Spirit ${summary.vitals.spirit}/${summary.vitals.maxSpirit}${summary.vitals.statuses.length ? ` · ${summary.vitals.statuses.join(', ')}` : ''}`;
  memberStats.replaceChildren(...['hp', 'mp', 'power', 'guard', 'arcana', 'speed'].map((key) => {
    const card = element('div', 'stat');
    card.append(element('small', '', key), element('strong', '', String(stats[key] ?? 0)));
    return card;
  }));
  equipmentSummary.textContent = `${summary.modifiers.paceDelta >= 0 ? '+' : ''}${summary.modifiers.paceDelta} Pace · ${summary.modifiers.recoveryPulsesDelta} Recovery`;
  equipmentSlots.replaceChildren(...EQUIPMENT_SLOTS.map((slot) => {
    const card = element('div', 'equipment-slot');
    const label = element('label', '', slot);
    const select = document.createElement('select');
    select.dataset.equipmentSlot = slot;
    const current = summary.equipment[slot]?.id ?? '';
    const candidates = Object.values(ITEM_CATALOGUE).filter((item) => item.kind === 'equipment'
      && item.slot === slot && item.allowedMembers.includes(selectedMemberId)
      && ((loadoutState.inventory[item.id] ?? 0) > 0 || item.id === current));
    select.append(new Option('— Empty —', ''), ...candidates.map((item) => new Option(`${item.name}${item.id === current ? ' · equipped' : ` · ${loadoutState.inventory[item.id]} stored`}`, item.id)));
    select.value = current;
    const button = element('button', '', 'Unequip');
    button.type = 'button';
    button.dataset.unequipSlot = slot;
    button.disabled = !current;
    card.append(label, select, button);
    return card;
  }));
  vowSlotSummary.textContent = `${summary.vows.length}/2 slots`;
  equippedVows.replaceChildren(...(summary.vows.length ? summary.vows.map((vow) => {
    const card = element('article', 'vow-card');
    card.append(element('small', '', 'Bound'), element('strong', '', vow.name), element('span', '', vow.description));
    const button = element('button', '', 'Release Vow');
    button.type = 'button';
    button.dataset.unequipVow = vow.id;
    card.append(button);
    return card;
  }) : [element('p', 'subtitle', 'One or two Vows may be bound to each character')]));
  const availableVows = Object.values(VOW_CATALOGUE).filter((vow) => vow.allowedMembers.includes(selectedMemberId) && !summary.vows.some((entry) => entry.id === vow.id));
  vowCatalogue.replaceChildren(...availableVows.map((vow) => {
    const unlocked = loadoutState.unlockedVows.includes(vow.id);
    const card = element('article', 'vow-card');
    card.append(element('small', '', unlocked ? 'Learned' : `${vow.cost} mon`), element('strong', '', vow.name), element('span', '', vow.description));
    const button = element('button', '', unlocked ? 'Bind Vow' : 'Learn Vow');
    button.type = 'button';
    button.dataset[unlocked ? 'equipVow' : 'learnVow'] = vow.id;
    button.disabled = unlocked && summary.openVowSlots === 0;
    card.append(button);
    return card;
  }));
}

function renderInventory() {
  const entries = Object.entries(loadoutState.inventory)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ item: ITEM_CATALOGUE[id], quantity }))
    .filter(({ item }) => inventoryFilter === 'all' || (inventoryFilter === 'gear' ? item.kind === 'equipment' : item.kind === inventoryFilter));
  inventoryCount.textContent = `${Object.values(loadoutState.inventory).reduce((sum, count) => sum + count, 0)} stored`;
  inventoryList.replaceChildren(...(entries.length ? entries.map(({ item, quantity }) => {
    const card = element('article', 'inventory-entry');
    card.append(element('small', '', `${item.kind} · ${quantity} held`), element('strong', '', item.name), element('span', '', item.description));
    const actions = element('div', 'inventory-entry-actions');
    if (item.kind === 'consumable') {
      const use = element('button', '', `Use on ${castName(selectedMemberId).split(' ')[0]}`);
      use.type = 'button'; use.dataset.useItem = item.id; actions.append(use);
    } else if (item.allowedMembers.includes(selectedMemberId)) {
      const equip = element('button', '', 'Equip');
      equip.type = 'button'; equip.dataset.equipItem = item.id; actions.append(equip);
    }
    const sell = element('button', '', `Sell · ${item.sellPrice} mon`);
    sell.type = 'button'; sell.dataset.sellItem = item.id; actions.append(sell);
    card.append(actions);
    return card;
  }) : [element('p', 'subtitle', 'No items match this filter.')]));
}

function renderShop() {
  shopList.replaceChildren(...Object.values(ITEM_CATALOGUE).filter((item) => !item.rewardOnly && item.price > 0).map((item) => {
    const card = element('article', 'shop-entry');
    const upgrade = loadoutState.upgrades[item.id] ?? 0;
    card.append(element('small', '', `${item.kind}${item.slot ? ` · ${item.slot}` : ''}${upgrade ? ` · forge ${upgrade}` : ''}`), element('strong', '', item.name), element('span', '', item.description));
    const actions = element('div', 'shop-entry-actions');
    const buy = element('button', '', `Buy · ${item.price}`);
    buy.type = 'button'; buy.dataset.buyItem = item.id; actions.append(buy);
    if (item.kind === 'equipment') {
      const forge = element('button', '', upgrade >= 3 ? 'Forge max' : `Forge +1`);
      forge.type = 'button'; forge.dataset.upgradeItem = item.id; forge.disabled = upgrade >= 3; actions.append(forge);
    }
    card.append(actions);
    return card;
  }));
}

function renderCamps() {
  const prior = campSelect.value;
  campSelect.replaceChildren(...Object.values(CAMP_CATALOGUE).map((camp) => new Option(`${camp.name} · ${camp.cost} mon`, camp.id)));
  const requestedCampId = routeFocusPending && requestedRouteType === 'camp-conversation'
    ? CAMP_CONVERSATIONS.conversations.find(({ id }) => id === requestedRouteId)?.campId
    : routeFocusPending && requestedRouteType === 'party-council'
      ? PARTY_COUNCILS.councils.find(({ id }) => id === requestedRouteId)?.campId
      : null;
  campSelect.value = CAMP_CATALOGUE[requestedCampId]
    ? requestedCampId
    : CAMP_CATALOGUE[prior] ? prior : Object.keys(CAMP_CATALOGUE)[0];
  const camp = CAMP_CATALOGUE[campSelect.value];
  campDescription.textContent = camp.description;
  restParty.textContent = `Rest party · ${camp.cost} mon`;
}

function campConversationContext() {
  return {
    campaignState,
    advancementState,
    campId: campSelect.value,
  };
}

function conversationPairNames(conversation) {
  const plan = getCampConversationPlan(conversation.pairId);
  return (plan?.participants ?? []).map(castName).join(' & ');
}

function renderCampConversationStage() {
  const progress = selectedCampConversationId
    ? getCampConversationProgress(campConversationState, selectedCampConversationId)
    : null;
  campConversationStage.hidden = !progress || progress.phase === 'not-started';
  campConversationChoices.replaceChildren();
  if (!progress || progress.phase === 'not-started') return;
  const { conversation } = progress;
  campConversationMeta.textContent = `${conversationPairNames(conversation)} · Talk ${conversation.sequence}/6 · ${CAMP_CATALOGUE[conversation.campId].name}`;
  campConversationTitle.textContent = conversation.title;
  campConversationTheme.textContent = conversation.theme;
  advanceCampConversation.hidden = false;
  advanceCampConversation.disabled = false;

  if (progress.phase === 'main-dialogue') {
    const line = progress.currentMainLine;
    campConversationLine.textContent = `${castName(line.speaker)}: ${line.line}`;
    advanceCampConversation.textContent = `Acknowledge line ${progress.mainLineIndex + 1}/${progress.mainLineCount}`;
    return;
  }
  if (progress.phase === 'choice') {
    campConversationLine.textContent = conversation.choice.prompt;
    advanceCampConversation.hidden = true;
    campConversationChoices.append(...conversation.choice.options.map((option) => {
      const button = element('button', '', option.label);
      button.type = 'button';
      button.dataset.campConversationChoice = option.id;
      button.dataset.campConversationId = conversation.id;
      return button;
    }));
    return;
  }
  if (progress.phase === 'choice-response') {
    const line = progress.currentResponseLine;
    campConversationLine.textContent = `${castName(line.speaker)}: ${line.line}`;
    advanceCampConversation.textContent = `Acknowledge response ${progress.responseLineIndex + 1}/${progress.responseLineCount}`;
    return;
  }
  campConversationLine.textContent = progress.selectedOption
    ? `${progress.selectedOption.label} — ${progress.selectedOption.consequence.summary}`
    : 'This conversation is recorded.';
  advanceCampConversation.textContent = 'Conversation complete';
  advanceCampConversation.disabled = true;
}

function renderCampConversations() {
  const metrics = getCampConversationRuntimeMetrics(campConversationState);
  campConversationSummary.textContent = `${metrics.completedConversationCount} / ${metrics.conversationCount} complete`;
  const completedBeats = new Set(campaignState.completedBeatIds ?? []);
  const activeId = campConversationState.records.find((record) => record.status === 'active')?.id ?? null;
  const visible = CAMP_CONVERSATIONS.conversations.filter((conversation) => {
    const record = getCampConversationRecord(campConversationState, conversation.id);
    if (record?.status === 'active') return true;
    if (conversation.campId !== campSelect.value || !completedBeats.has(conversation.unlockAfterBeatId)) return false;
    return record?.status === 'completed'
      || getCampConversationAvailability(campConversationState, conversation.id, campConversationContext()).available;
  });
  if (!visible.length) {
    campConversationList.replaceChildren(element('p', 'subtitle', 'No companion conversation is currently available at this rest point.'));
  } else {
    campConversationList.replaceChildren(...visible.map((conversation) => {
      const record = getCampConversationRecord(campConversationState, conversation.id);
      const button = element('button', 'camp-conversation-entry');
      button.type = 'button';
      button.dataset.campConversationId = conversation.id;
      button.classList.toggle('is-active', conversation.id === selectedCampConversationId || conversation.id === activeId);
      button.classList.toggle('is-complete', record?.status === 'completed');
      const status = record?.status === 'completed' ? 'Recorded' : record?.status === 'active' ? 'Continue' : 'Available';
      button.append(
        element('strong', '', conversation.title),
        element('span', '', `${conversationPairNames(conversation)} · ${status}`),
        element('small', '', conversation.theme),
      );
      return button;
    }));
  }
  if (!selectedCampConversationId && activeId) selectedCampConversationId = activeId;
  renderCampConversationStage();
}

function partyCouncilContext() {
  return {
    campaignState,
    advancementState,
    campId: campSelect.value,
  };
}

function partyCouncilNames(council) {
  return council.participants.map(castName).join(' · ');
}

function renderPartyCouncilStage() {
  const progress = selectedPartyCouncilId
    ? getPartyCouncilProgress(partyCouncilState, selectedPartyCouncilId)
    : null;
  partyCouncilStage.hidden = !progress || progress.phase === 'not-started';
  partyCouncilChoices.replaceChildren();
  if (!progress || progress.phase === 'not-started') return;
  const { council } = progress;
  partyCouncilMeta.textContent = `${partyCouncilNames(council)} · Council ${council.sequence}/30 · ${CAMP_CATALOGUE[council.campId].name}`;
  partyCouncilTitle.textContent = council.title;
  partyCouncilTheme.textContent = council.theme;
  advancePartyCouncil.hidden = false;
  advancePartyCouncil.disabled = false;

  if (progress.phase === 'main-dialogue') {
    const line = progress.currentMainLine;
    partyCouncilLine.textContent = `${castName(line.speaker)}: ${line.line}`;
    advancePartyCouncil.textContent = `Acknowledge line ${progress.mainLineIndex + 1}/${progress.mainLineCount}`;
    return;
  }
  if (progress.phase === 'choice') {
    partyCouncilLine.textContent = council.choice.prompt;
    advancePartyCouncil.hidden = true;
    partyCouncilChoices.append(...council.choice.options.map((option) => {
      const button = element('button', '', option.label);
      button.type = 'button';
      button.dataset.partyCouncilChoice = option.id;
      button.dataset.partyCouncilId = council.id;
      return button;
    }));
    return;
  }
  if (progress.phase === 'choice-response') {
    const line = progress.currentResponseLine;
    partyCouncilLine.textContent = `${castName(line.speaker)}: ${line.line}`;
    advancePartyCouncil.textContent = `Acknowledge response ${progress.responseLineIndex + 1}/${progress.responseLineCount}`;
    return;
  }
  partyCouncilLine.textContent = progress.selectedOption
    ? `${progress.selectedOption.label} — ${progress.selectedOption.consequence.summary}`
    : 'This finite council is recorded.';
  advancePartyCouncil.textContent = 'Council complete';
  advancePartyCouncil.disabled = true;
}

function renderPartyCouncils() {
  const metrics = getPartyCouncilRuntimeMetrics(partyCouncilState);
  partyCouncilSummary.textContent = `${metrics.completedCouncilCount} / ${metrics.councilCount} complete`;
  const completedBeats = new Set(campaignState.completedBeatIds ?? []);
  const activeId = partyCouncilState.records.find((record) => record.status === 'active')?.id ?? null;
  const visible = PARTY_COUNCILS.councils.filter((council) => {
    const record = getPartyCouncilRecord(partyCouncilState, council.id);
    if (record?.status === 'active') return true;
    if (council.campId !== campSelect.value || !completedBeats.has(council.unlockAfterBeatId)) return false;
    return record?.status === 'completed'
      || getPartyCouncilAvailability(partyCouncilState, council.id, partyCouncilContext()).available;
  });
  if (selectedPartyCouncilId
    && selectedPartyCouncilId !== activeId
    && !visible.some((council) => council.id === selectedPartyCouncilId)) {
    selectedPartyCouncilId = null;
  }
  if (!visible.length) {
    partyCouncilList.replaceChildren(element('p', 'subtitle', 'No party council is currently available at this rest point.'));
  } else {
    partyCouncilList.replaceChildren(...visible.map((council) => {
      const record = getPartyCouncilRecord(partyCouncilState, council.id);
      const button = element('button', 'party-council-entry');
      button.type = 'button';
      button.dataset.partyCouncilId = council.id;
      button.classList.toggle('is-active', council.id === selectedPartyCouncilId || council.id === activeId);
      button.classList.toggle('is-complete', record?.status === 'completed');
      const status = record?.status === 'completed' ? 'Recorded' : record?.status === 'active' ? 'Continue' : 'Available';
      button.append(
        element('strong', '', council.title),
        element('span', '', `Council ${council.sequence} · ${status}`),
        element('small', '', partyCouncilNames(council)),
      );
      return button;
    }));
  }
  if (!selectedPartyCouncilId && activeId) selectedPartyCouncilId = activeId;
  renderPartyCouncilStage();
}

function archiveRecordContext() {
  return { campaignState };
}

function renderArchiveRecordStage() {
  const progress = selectedArchiveRecordId
    ? getArchiveRecordProgress(archiveRecordState, selectedArchiveRecordId)
    : null;
  archiveRecordStage.hidden = !progress || progress.phase === 'not-started';
  if (!progress || progress.phase === 'not-started') return;
  const { record } = progress;
  archiveRecordMeta.textContent = `${record.recordType} · ${record.custodian}`;
  archiveRecordTitle.textContent = record.title;
  archiveRecordAccess.textContent = record.accessNote;
  advanceArchiveRecord.disabled = false;
  if (progress.phase === 'reading') {
    archiveRecordParagraph.textContent = progress.currentParagraph;
    advanceArchiveRecord.textContent = `Acknowledge passage ${progress.paragraphIndex + 1}/${progress.paragraphCount}`;
    return;
  }
  if (Number.isSafeInteger(archiveReviewParagraphIndex)
    && archiveReviewParagraphIndex >= 0
    && archiveReviewParagraphIndex < progress.paragraphCount) {
    archiveRecordParagraph.textContent = record.paragraphs[archiveReviewParagraphIndex];
    advanceArchiveRecord.textContent = `Review passage ${archiveReviewParagraphIndex + 1}/${progress.paragraphCount}`;
    return;
  }
  archiveRecordParagraph.textContent = 'This finite public reading is recorded. Its correction and access terms remain attached.';
  advanceArchiveRecord.textContent = 'Reading complete';
  advanceArchiveRecord.disabled = true;
}

function renderArchiveRecords() {
  const metrics = getArchiveRecordRuntimeMetrics(archiveRecordState);
  archiveRecordSummary.textContent = `${metrics.completedRecordCount} / ${metrics.recordCount} read`;
  const completedBeats = new Set(campaignState.completedBeatIds ?? []);
  const activeId = archiveRecordState.records.find((record) => record.status === 'active')?.id ?? null;
  const visible = ARCHIVE_RECORDS.records.filter((record) => {
    const progressRecord = getArchiveRecordProgressRecord(archiveRecordState, record.id);
    return progressRecord?.status === 'active'
      || (completedBeats.has(record.unlockAfterBeatId) && (
        progressRecord?.status === 'completed'
        || getArchiveRecordAvailability(archiveRecordState, record.id, archiveRecordContext()).available
      ));
  });
  if (!visible.length) {
    archiveRecordList.replaceChildren(element('p', 'subtitle', 'No public archive reading has opened yet.'));
  } else {
    archiveRecordList.replaceChildren(...visible.map((record) => {
      const progressRecord = getArchiveRecordProgressRecord(archiveRecordState, record.id);
      const button = element('button', 'archive-record-entry');
      button.type = 'button';
      button.dataset.archiveRecordId = record.id;
      button.classList.toggle('is-active', record.id === selectedArchiveRecordId || record.id === activeId);
      button.classList.toggle('is-complete', progressRecord?.status === 'completed');
      const status = progressRecord?.status === 'completed' ? 'Read' : progressRecord?.status === 'active' ? 'Continue' : 'Available';
      button.append(
        element('strong', '', record.title),
        element('span', '', `${record.recordType} · ${status}`),
        element('small', '', record.custodian),
      );
      return button;
    }));
  }
  if (!selectedArchiveRecordId && activeId) selectedArchiveRecordId = activeId;
  renderArchiveRecordStage();
}

function render() {
  partyCurrency.textContent = `${loadoutState.currency} mon`;
  renderParty();
  renderMember();
  renderInventory();
  renderShop();
  renderCamps();
  renderCampConversations();
  renderPartyCouncils();
  renderArchiveRecords();
  campPlaytime.textContent = `${formatPlaytime(playtimeState.totalMs)} active play`;
  applyRequestedRouteFocus();
}

function applyRequestedRouteFocus() {
  if (!routeFocusPending) return;
  const datasetKey = ROUTE_FOCUS_SELECTORS[requestedRouteType];
  const selector = datasetKey ? `[data-${datasetKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${CSS.escape(requestedRouteId)}"]` : null;
  const target = selector ? document.querySelector(selector) : null;
  routeFocusPending = false;
  if (!target) {
    campFeedback.textContent = 'The requested route entry is not available for this save frontier.';
    return;
  }
  target.classList.add('is-route-focus');
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.focus();
  target.click();
}

partyList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-member-id]');
  if (!button || button.disabled) return;
  selectedMemberId = button.dataset.memberId;
  render();
});

equipmentSlots.addEventListener('change', (event) => {
  const select = event.target.closest('[data-equipment-slot]');
  if (!select) return;
  const current = loadoutState.equipment[selectedMemberId][select.dataset.equipmentSlot];
  if (select.value === current) return;
  commit(select.value ? equipItem(loadoutState, selectedMemberId, select.value) : unequipItem(loadoutState, selectedMemberId, select.dataset.equipmentSlot));
});

equipmentSlots.addEventListener('click', (event) => {
  const button = event.target.closest('[data-unequip-slot]');
  if (button) commit(unequipItem(loadoutState, selectedMemberId, button.dataset.unequipSlot));
});

vowCatalogue.addEventListener('click', (event) => {
  const learn = event.target.closest('[data-learn-vow]');
  const equip = event.target.closest('[data-equip-vow]');
  if (learn) commit(learnVow(loadoutState, learn.dataset.learnVow));
  else if (equip) commit(equipVow(loadoutState, selectedMemberId, equip.dataset.equipVow));
});

equippedVows.addEventListener('click', (event) => {
  const button = event.target.closest('[data-unequip-vow]');
  if (button) commit(unequipVow(loadoutState, selectedMemberId, button.dataset.unequipVow));
});

inventoryTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-inventory-filter]');
  if (!button) return;
  inventoryFilter = button.dataset.inventoryFilter;
  [...inventoryTabs.querySelectorAll('button')].forEach((entry) => entry.setAttribute('aria-selected', String(entry === button)));
  renderInventory();
});

inventoryList.addEventListener('click', (event) => {
  const use = event.target.closest('[data-use-item]');
  const equip = event.target.closest('[data-equip-item]');
  const sell = event.target.closest('[data-sell-item]');
  if (use) commit(useConsumable(loadoutState, use.dataset.useItem, selectedMemberId));
  else if (equip) commit(equipItem(loadoutState, selectedMemberId, equip.dataset.equipItem));
  else if (sell) commit(sellItem(loadoutState, sell.dataset.sellItem));
});

shopList.addEventListener('click', (event) => {
  const buy = event.target.closest('[data-buy-item]');
  const upgrade = event.target.closest('[data-upgrade-item]');
  if (buy) commit(buyItem(loadoutState, buy.dataset.buyItem));
  else if (upgrade) commit(upgradeItem(loadoutState, upgrade.dataset.upgradeItem));
});

campSelect.addEventListener('change', () => {
  renderCamps();
  renderCampConversations();
  renderPartyCouncils();
});
restParty.addEventListener('click', () => {
  const unlocked = getParty(advancementState, { unlockedOnly: true }).map((member) => member.id);
  commit(restAtCamp(loadoutState, campSelect.value, unlocked));
});

campConversationList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-camp-conversation-id]');
  if (!button || button.disabled) return;
  const conversation = CAMP_CONVERSATIONS.conversations.find((entry) => entry.id === button.dataset.campConversationId);
  if (!conversation) return;
  selectedCampConversationId = conversation.id;
  const record = getCampConversationRecord(campConversationState, conversation.id);
  if (!record) {
    const result = beginCampConversation(campConversationState, conversation.id, campConversationContext());
    if (!result.ok) {
      campFeedback.textContent = result.reason;
      return;
    }
    const saved = campConversationAdapter.save(result.state);
    if (!saved.ok) {
      campFeedback.textContent = 'Camp conversation could not start because its save could not be written.';
      return;
    }
    campConversationState = result.state;
    render();
    campFeedback.textContent = `Camp conversation begun: ${conversation.title}. Every line and one explicit response will be recorded once.`;
    return;
  }
  renderCampConversations();
});

campConversationChoices.addEventListener('click', (event) => {
  const button = event.target.closest('[data-camp-conversation-choice]');
  if (!button) return;
  const result = chooseCampConversationOption(
    campConversationState,
    button.dataset.campConversationId,
    button.dataset.campConversationChoice,
  );
  if (!result.ok) {
    campFeedback.textContent = result.reason;
    return;
  }
  const saved = campConversationAdapter.save(result.state);
  if (!saved.ok) {
    campFeedback.textContent = 'Response was not recorded because the camp-conversation save could not be written.';
    return;
  }
  campConversationState = result.state;
  renderCampConversations();
  campFeedback.textContent = `Response recorded: ${result.option.label}`;
});

advanceCampConversation.addEventListener('click', () => {
  if (!selectedCampConversationId) return;
  const progress = getCampConversationProgress(campConversationState, selectedCampConversationId);
  const result = progress?.phase === 'main-dialogue'
    ? acknowledgeCampConversationLine(campConversationState, selectedCampConversationId)
    : progress?.phase === 'choice-response'
      ? acknowledgeCampConversationResponse(campConversationState, selectedCampConversationId)
      : null;
  if (!result?.ok) {
    if (result) campFeedback.textContent = result.reason;
    return;
  }
  const saved = campConversationAdapter.save(result.state);
  if (!saved.ok) {
    campFeedback.textContent = 'Line progress was not recorded because the camp-conversation save could not be written.';
    return;
  }
  campConversationState = result.state;
  renderCampConversations();
  if (result.code === 'conversation-complete') {
    campFeedback.textContent = `Finite conversation complete. ${result.consequence.summary}`;
  }
});

partyCouncilList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-party-council-id]');
  if (!button || button.disabled) return;
  const council = PARTY_COUNCILS.councils.find((entry) => entry.id === button.dataset.partyCouncilId);
  if (!council) return;
  selectedPartyCouncilId = council.id;
  const record = getPartyCouncilRecord(partyCouncilState, council.id);
  if (!record) {
    const result = beginPartyCouncil(partyCouncilState, council.id, partyCouncilContext());
    if (!result.ok) {
      campFeedback.textContent = result.reason;
      return;
    }
    const saved = partyCouncilAdapter.save(result.state);
    if (!saved.ok) {
      campFeedback.textContent = 'Party council could not start because its save could not be written.';
      return;
    }
    partyCouncilState = result.state;
    render();
    advancePartyCouncil.focus();
    campFeedback.textContent = `Party council begun: ${council.title}. Every speaker and one explicit decision will be recorded once.`;
    return;
  }
  renderPartyCouncils();
  if (record.status === 'completed') partyCouncilTitle.focus();
  else advancePartyCouncil.focus();
  campFeedback.textContent = record.status === 'completed'
    ? `Reviewing the recorded consequence of ${council.title}; finite state remains unchanged.`
    : `Continuing ${council.title}.`;
});

partyCouncilChoices.addEventListener('click', (event) => {
  const button = event.target.closest('[data-party-council-choice]');
  if (!button) return;
  const result = choosePartyCouncilOption(
    partyCouncilState,
    button.dataset.partyCouncilId,
    button.dataset.partyCouncilChoice,
  );
  if (!result.ok) {
    campFeedback.textContent = result.reason;
    return;
  }
  const saved = partyCouncilAdapter.save(result.state);
  if (!saved.ok) {
    campFeedback.textContent = 'Council decision was not recorded because its save could not be written.';
    return;
  }
  partyCouncilState = result.state;
  renderPartyCouncils();
  advancePartyCouncil.focus();
  campFeedback.textContent = `Council decision recorded: ${result.option.label}`;
});

advancePartyCouncil.addEventListener('click', () => {
  if (!selectedPartyCouncilId) return;
  const progress = getPartyCouncilProgress(partyCouncilState, selectedPartyCouncilId);
  const result = progress?.phase === 'main-dialogue'
    ? acknowledgePartyCouncilLine(partyCouncilState, selectedPartyCouncilId)
    : progress?.phase === 'choice-response'
      ? acknowledgePartyCouncilResponse(partyCouncilState, selectedPartyCouncilId)
      : null;
  if (!result?.ok) {
    if (result) campFeedback.textContent = result.reason;
    return;
  }
  const saved = partyCouncilAdapter.save(result.state);
  if (!saved.ok) {
    campFeedback.textContent = 'Council line progress was not recorded because its save could not be written.';
    return;
  }
  partyCouncilState = result.state;
  renderPartyCouncils();
  if (result.progress?.phase === 'choice') {
    partyCouncilChoices.querySelector('[data-party-council-choice]')?.focus();
  } else if (result.code === 'council-complete') {
    partyCouncilTitle.focus();
  }
});

archiveRecordList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-archive-record-id]');
  if (!button || button.disabled) return;
  const record = ARCHIVE_RECORDS.records.find((entry) => entry.id === button.dataset.archiveRecordId);
  if (!record) return;
  selectedArchiveRecordId = record.id;
  const progressRecord = getArchiveRecordProgressRecord(archiveRecordState, record.id);
  if (progressRecord?.status === 'completed') {
    archiveReviewParagraphIndex = 0;
    renderArchiveRecords();
    campFeedback.textContent = `Reviewing ${record.title}. Review does not change finite completion state.`;
    return;
  }
  archiveReviewParagraphIndex = null;
  if (!progressRecord) {
    const result = beginArchiveRecord(archiveRecordState, record.id, archiveRecordContext());
    if (!result.ok) {
      campFeedback.textContent = result.reason;
      return;
    }
    const saved = archiveRecordAdapter.save(result.state);
    if (!saved.ok) {
      campFeedback.textContent = 'Public reading could not start because its save could not be written.';
      return;
    }
    archiveRecordState = result.state;
    render();
    campFeedback.textContent = `Public reading begun: ${record.title}. Its custody and correction terms remain visible.`;
    return;
  }
  renderArchiveRecords();
});

advanceArchiveRecord.addEventListener('click', () => {
  if (!selectedArchiveRecordId) return;
  const progress = getArchiveRecordProgress(archiveRecordState, selectedArchiveRecordId);
  if (progress?.complete && Number.isSafeInteger(archiveReviewParagraphIndex)) {
    archiveReviewParagraphIndex += 1;
    if (archiveReviewParagraphIndex >= progress.paragraphCount) {
      archiveReviewParagraphIndex = null;
      campFeedback.textContent = 'Read-only archive review complete; finite state was unchanged.';
    } else {
      campFeedback.textContent = 'Review passage advanced without changing finite completion state.';
    }
    renderArchiveRecordStage();
    return;
  }
  const result = acknowledgeArchiveRecordParagraph(archiveRecordState, selectedArchiveRecordId);
  if (!result.ok) {
    campFeedback.textContent = result.reason;
    return;
  }
  const saved = archiveRecordAdapter.save(result.state);
  if (!saved.ok) {
    campFeedback.textContent = 'Passage progress was not recorded because the archive save could not be written.';
    return;
  }
  archiveRecordState = result.state;
  renderArchiveRecords();
  campFeedback.textContent = result.code === 'archive-reading-complete'
    ? 'Finite public reading complete. No reward or ownership claim was created.'
    : 'Passage acknowledged; the next public passage is ready.';
});

function tick(now) {
  const elapsed = Math.min(1000, Math.max(0, Math.floor(now - playtimeLast)));
  playtimeLast = now;
  const inactive = isPlaytimeInactive({
    nowMs: now,
    lastActivityMs: playtimeLastActivity,
    visible: document.visibilityState === 'visible',
  });
  if (!inactive && elapsed) {
    playtimeState = recordPlaytime(playtimeState, 'menusAndRest', elapsed);
    queueRunReceiptPlaytime(elapsed);
    playtimeUnsaved += elapsed;
    campPlaytime.textContent = `${formatPlaytime(playtimeState.totalMs)} active play`;
    if (playtimeUnsaved >= 10_000) { playtimeAdapter.save(playtimeState); playtimeUnsaved = 0; }
  }
  requestAnimationFrame(tick);
}

function flushRunReceiptPlaytime() {
  if (!runReceiptState || runReceiptState.status !== 'active') {
    runReceiptPendingMs = 0;
    return false;
  }
  if (runReceiptPendingMs === 0) return false;
  const result = recordRunPlaytime(
    runReceiptState,
    runReceiptState.runId,
    'menusAndRest',
    runReceiptPendingMs,
  );
  if (!result.ok) return false;
  runReceiptState = result.state;
  runReceiptPendingMs = 0;
  runReceiptAdapter.save(runReceiptState);
  return true;
}

function queueRunReceiptPlaytime(elapsedMs) {
  if (!runReceiptState || runReceiptState.status !== 'active') {
    runReceiptPendingMs = 0;
    return;
  }
  runReceiptPendingMs += elapsedMs;
  if (runReceiptPendingMs >= 1000) flushRunReceiptPlaytime();
}

window.addEventListener('pagehide', () => {
  flushRunReceiptPlaytime();
  loadoutAdapter.save(loadoutState);
  playtimeAdapter.save(playtimeState);
  if (runReceiptState) runReceiptAdapter.save(runReceiptState);
  // Finite narrative mutations are written synchronously at each accepted transition.
});
document.addEventListener('visibilitychange', () => {
  playtimeLast = performance.now();
  playtimeLastActivity = performance.now();
  if (document.visibilityState === 'hidden') {
    flushRunReceiptPlaytime();
    playtimeAdapter.save(playtimeState);
    if (runReceiptState) runReceiptAdapter.save(runReceiptState);
    // Avoid stale-tab rollback: narrative saves never need a redundant lifecycle write.
  }
});
window.addEventListener('pointerdown', () => { playtimeLastActivity = performance.now(); }, { passive: true });
window.addEventListener('keydown', () => { playtimeLastActivity = performance.now(); }, { passive: true });
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  const refreshedAdvancement = advancementAdapter.load();
  if (refreshedAdvancement.ok) advancementState = refreshedAdvancement.state;
  const refreshedCampaign = campaignAdapter.load();
  if (refreshedCampaign.ok) campaignState = refreshedCampaign.state;
  const refreshedCampConversations = campConversationAdapter.load();
  if (refreshedCampConversations.state) {
    campConversationState = refreshedCampConversations.state;
    selectedCampConversationId = campConversationState.records.find((record) => record.status === 'active')?.id ?? null;
  }
  const refreshedPartyCouncils = partyCouncilAdapter.load();
  if (refreshedPartyCouncils.state) {
    partyCouncilState = refreshedPartyCouncils.state;
    selectedPartyCouncilId = partyCouncilState.records.find((record) => record.status === 'active')?.id ?? null;
  }
  const refreshedArchiveRecords = archiveRecordAdapter.load();
  if (refreshedArchiveRecords.state) {
    archiveRecordState = refreshedArchiveRecords.state;
    selectedArchiveRecordId = archiveRecordState.records.find((record) => record.status === 'active')?.id ?? null;
    archiveReviewParagraphIndex = null;
  }
  const refreshedLoadout = loadoutAdapter.load();
  if (refreshedLoadout.ok) loadoutState = refreshedLoadout.value;
  const refreshedPlaytime = playtimeAdapter.load();
  if (refreshedPlaytime.ok) playtimeState = refreshedPlaytime.state;
  const refreshedRunReceipt = runReceiptAdapter.load();
  runReceiptState = refreshedRunReceipt.ok && refreshedRunReceipt.found ? refreshedRunReceipt.state : null;
  runReceiptPendingMs = 0;
  const syncedParty = syncPartyVitals(loadoutState, getParty(advancementState));
  if (syncedParty.ok) loadoutState = syncedParty.state;
  const unlockedIds = new Set(getParty(advancementState, { unlockedOnly: true }).map((member) => member.id));
  if (!unlockedIds.has(selectedMemberId)) selectedMemberId = [...unlockedIds][0] ?? 'ren';
  playtimeLast = performance.now();
  playtimeLastActivity = playtimeLast;
  render();
});

document.title = `${CAMPAIGN.title} — Camp & Loadout`;
render();
if (finiteNarrativeLoadWarnings.length) campFeedback.textContent = finiteNarrativeLoadWarnings.join(' ');
requestAnimationFrame(tick);
