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
let playtimeLast = performance.now();
let playtimeLastActivity = performance.now();
let playtimeUnsaved = 0;
let selectedMemberId = getParty(advancementState, { unlockedOnly: true })[0]?.id ?? 'ren';
let inventoryFilter = 'all';

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
  loadoutState = result.state;
  loadoutAdapter.save(loadoutState);
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
  campSelect.value = CAMP_CATALOGUE[prior] ? prior : Object.keys(CAMP_CATALOGUE)[0];
  const camp = CAMP_CATALOGUE[campSelect.value];
  campDescription.textContent = camp.description;
  restParty.textContent = `Rest party · ${camp.cost} mon`;
}

function render() {
  partyCurrency.textContent = `${loadoutState.currency} mon`;
  renderParty();
  renderMember();
  renderInventory();
  renderShop();
  renderCamps();
  campPlaytime.textContent = `${formatPlaytime(playtimeState.totalMs)} active play`;
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

campSelect.addEventListener('change', renderCamps);
restParty.addEventListener('click', () => {
  const unlocked = getParty(advancementState, { unlockedOnly: true }).map((member) => member.id);
  commit(restAtCamp(loadoutState, campSelect.value, unlocked));
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
    playtimeUnsaved += elapsed;
    campPlaytime.textContent = `${formatPlaytime(playtimeState.totalMs)} active play`;
    if (playtimeUnsaved >= 10_000) { playtimeAdapter.save(playtimeState); playtimeUnsaved = 0; }
  }
  requestAnimationFrame(tick);
}

window.addEventListener('pagehide', () => {
  loadoutAdapter.save(loadoutState);
  playtimeAdapter.save(playtimeState);
});
document.addEventListener('visibilitychange', () => {
  playtimeLast = performance.now();
  playtimeLastActivity = performance.now();
  if (document.visibilityState === 'hidden') playtimeAdapter.save(playtimeState);
});
window.addEventListener('pointerdown', () => { playtimeLastActivity = performance.now(); }, { passive: true });
window.addEventListener('keydown', () => { playtimeLastActivity = performance.now(); }, { passive: true });
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  const refreshedAdvancement = advancementAdapter.load();
  if (refreshedAdvancement.ok) advancementState = refreshedAdvancement.state;
  const refreshedLoadout = loadoutAdapter.load();
  if (refreshedLoadout.ok) loadoutState = refreshedLoadout.value;
  const refreshedPlaytime = playtimeAdapter.load();
  if (refreshedPlaytime.ok) playtimeState = refreshedPlaytime.state;
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
requestAnimationFrame(tick);
