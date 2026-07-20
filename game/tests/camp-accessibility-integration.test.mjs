import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const campHtml = readFileSync(new URL('../camp.html', import.meta.url), 'utf8');
const campSource = readFileSync(new URL('../camp.js', import.meta.url), 'utf8');
const campCss = readFileSync(new URL('../camp.css', import.meta.url), 'utf8');

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source boundary: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source boundary: ${endMarker}`);
  assert.ok(end > start, `Invalid source boundaries: ${startMarker} / ${endMarker}`);
  return source.slice(start, end);
}

test('Camp selection controls use complete ordinary button-group semantics', () => {
  assert.match(campHtml, /id="campPartyList"[^>]*role="group"[^>]*aria-label="Choose a party member"/);
  assert.match(campHtml, /class="inventory-tabs"[^>]*role="group"[^>]*aria-label="Inventory filters"/);
  assert.equal((campHtml.match(/data-inventory-filter=/g) ?? []).length, 3);
  assert.equal((campHtml.match(/data-inventory-filter=[^>]*aria-pressed=/g) ?? []).length, 3);
  assert.doesNotMatch(campHtml, /role="tab(?:list)?"/);
  assert.doesNotMatch(campSource, /button\.role = 'tab'|aria-selected/);
  assert.match(campSource, /button\.setAttribute\('aria-pressed', String\(view\.id === selectedMemberId\)\)/);
  assert.match(campSource, /entry\.setAttribute\('aria-pressed', String\(entry === button\)\)/);
  assert.match(campCss, /\.party-button\[aria-pressed="true"\]/);
  assert.match(campCss, /\.inventory-tabs button\[aria-pressed="true"\]/);
});

test('Camp gives equipment and repeated item actions contextual accessible names', () => {
  const member = sourceSection(campSource, 'function renderMember()', 'function renderInventory()');
  assert.match(member, /const controlId = `equipment-\$\{selectedMemberId\}-/);
  assert.match(member, /select\.id = controlId/);
  assert.match(member, /label\.htmlFor = controlId/);
  assert.match(member, /`Unequip \$\{itemName\(current\)\} from \$\{member\.name\}'s \$\{slot\}`/);
  assert.match(member, /`Release \$\{vow\.name\} from \$\{member\.name\}`/);
  assert.match(member, /`Bind \$\{vow\.name\} to \$\{member\.name\}`/);
  assert.match(member, /`Learn \$\{vow\.name\}`/);

  const inventory = sourceSection(campSource, 'function renderInventory()', 'function renderCamps()');
  for (const pattern of [
    /`Use \$\{item\.name\} on \$\{castName\(selectedMemberId\)\}`/,
    /`Equip \$\{item\.name\} on \$\{castName\(selectedMemberId\)\}`/,
    /`Sell \$\{item\.name\} for \$\{item\.sellPrice\} mon`/,
    /`Buy \$\{item\.name\} for \$\{item\.price\} mon`/,
    /`Forge \$\{item\.name\} to rank \$\{upgrade \+ 1\}`/,
  ]) assert.match(inventory, pattern);
});

test('Camp restores focus after party, conversation, and archive render boundaries', () => {
  assert.match(campHtml, /id="campConversationTitle" tabindex="-1"/);
  assert.match(campHtml, /id="archiveRecordTitle" tabindex="-1"/);
  assert.match(campSource, /function focusWithoutScroll\(target\)[\s\S]*?target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(campSource, /function focusSelectedPartyMember\(\)/);
  assert.match(campSource, /function focusCampConversationStage\(\)/);
  assert.match(campSource, /function focusArchiveRecordStage\(\)/);

  const party = sourceSection(
    campSource,
    "partyList.addEventListener('click'",
    "equipmentSlots.addEventListener('change'",
  );
  assert.match(party, /render\(\);\s+focusSelectedPartyMember\(\)/);

  const conversation = sourceSection(
    campSource,
    "campConversationList.addEventListener('click'",
    "partyCouncilList.addEventListener('click'",
  );
  assert.ok((conversation.match(/focusCampConversationStage\(\)/g) ?? []).length >= 4);
  assert.match(campSource, /progress\.phase === 'choice'[\s\S]*?data-camp-conversation-choice/);
  assert.match(campSource, /progress\.phase === 'completed'[\s\S]*?campConversationTitle/);

  const archive = sourceSection(
    campSource,
    "archiveRecordList.addEventListener('click'",
    'function tick(now)',
  );
  assert.ok((archive.match(/focusArchiveRecordStage\(\)/g) ?? []).length >= 5);
  assert.match(campSource, /reviewing \|\| !progress\.complete[\s\S]*?advanceArchiveRecord[\s\S]*?archiveRecordTitle/);
});

test('Camp route focus respects reduced motion and mobile controls remain touch-readable', () => {
  assert.match(campSource, /window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(campSource, /behavior: reducedMotionPreference\?\.matches \? 'auto' : 'smooth'/);
  assert.match(campCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important/);
  assert.match(campCss, /@media \(max-width: 700px\)[\s\S]*?\.camp-layout button, \.camp-layout select \{ min-height: 44px; font-size: \.72rem; \}/);
  assert.match(campCss, /\.audio-volume input \{ min-height: 24px; \}/);
  assert.match(campCss, /\.party-button small \{[^}]*color: #a8b1c7/);
});
