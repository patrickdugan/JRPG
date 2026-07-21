import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import { getLevel } from '../content/levels.mjs';
import { ITEM_CATALOGUE } from '../loadout.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const readRepoFile = (relativePath) => readFileSync(new URL(relativePath.replaceAll('\\', '/'), new URL(`file:///${REPO_ROOT.replaceAll('\\', '/')}/`)), 'utf8');

test('campaign exposes the locked alternate-history frame', () => {
  assert.match(CAMPAIGN.premise, /Genna 8 \(1622\)/u);
  assert.match(CAMPAIGN.historicalFraming.date, /Great Genna Martyrdom/u);
  assert.match(CAMPAIGN.historicalFraming.missions, /1614 nationwide ban/u);
  assert.match(CAMPAIGN.historicalFraming.missions, /clandestine/u);
  assert.match(CAMPAIGN.historicalFraming.registry, /fictional local experiment/u);
  assert.match(CAMPAIGN.historicalFraming.registry, /(?:not|rather than) the later nationwide temple-certification system/u);
  assert.match(CAMPAIGN.historicalFraming.symbols, /steals and blackens imperial chrysanthemum imagery/u);
  assert.match(CAMPAIGN.historicalFraming.symbols, /not the Imperial Court in Kyoto/u);
  assert.ok(CAMPAIGN.narrativeGuardrails.some((entry) => /deliberate fictional synthesis/u.test(entry)));
});

test('Sayo is a named Japanese Kirishitan organizer with consequential agency', () => {
  const sayo = CAMPAIGN.supportingCast.sayo;
  assert.equal(sayo.name, 'Sayo of Sodegaura');
  assert.match(sayo.role, /Japanese Kirishitan lay catechist/u);
  assert.match(sayo.agency, /Conceals her community’s prayer sheets/u);
  assert.match(sayo.agency, /assigns the Takamine families to her warehouse route/u);
  assert.match(sayo.agency, /carries their testimony copy separately/u);

  const camp = readRepoFile('game/content/camp-conversations-early.mjs');
  assert.match(camp, /title: 'An Alias at the Lantern Dock'/u);
  assert.match(camp, /Sayo, Kirishitan catechist, concealed prayer sheets before inspection/u);
  assert.match(camp, /assigned families to her warehouse route, carrying their testimony separately/u);

  const stall = getLevel('sdg-market-lane').interactables.find(({ id }) => id === 'printer-stall');
  assert.equal(stall.id, 'printer-stall');
  assert.equal(stall.label, 'Sayo’s Print Stall');
});

test('sacred-object display corrections preserve save-stable identifiers', () => {
  const token = ITEM_CATALOGUE['temple-charm'];
  assert.equal(token.id, 'temple-charm');
  assert.equal(token.name, 'Defaced Registry Token');
  assert.ok(token.aliases.includes('Temple Charm'), 'legacy item-name compatibility must remain intact');

  const sideChest = getLevel('tkm-cedar-service-path').interactables.find(({ id }) => id === 'temple-charm-chest');
  assert.equal(sideChest.id, 'temple-charm-chest');
  assert.equal(sideChest.reward, 'Defaced Registry Token');

  const strongbox = getLevel('ngi-wrecked-carrack').interactables.find(({ id }) => id === 'reliquary-lock');
  assert.equal(strongbox.id, 'reliquary-lock');
  assert.equal(strongbox.label, 'Dražanić Strongbox');
});

test('canonical content and production directions avoid superseded sacred-object language', () => {
  const files = [
    'docs/03-beats-outline.md',
    'docs/04-detailed-outline.md',
    'docs/05-art-direction.md',
    'docs/10-animation-bible.md',
    'assets/concepts/README.md',
    'assets/production/README.md',
    'game/content/campaign.mjs',
    'game/content/levels.mjs',
    'game/content/camp-conversations-early.mjs',
  ];

  for (const file of files) {
    const source = readRepoFile(file);
    assert.doesNotMatch(source, /\bofuda\b/iu, `${file} still directs devotional talisman use`);
    assert.doesNotMatch(source, /foreign reliquary/iu, `${file} still treats a reliquary as a neutral puzzle object`);
    assert.doesNotMatch(source, /Temple Charm/iu, `${file} still exposes the superseded item display name`);
    assert.doesNotMatch(source, /assigns practice/iu, `${file} still uses incorrect confession terminology`);
  }
});

test('travel, confession, and consultant requirements are explicit', () => {
  const camp = readRepoFile('game/content/camp-conversations-early.mjs');
  const audit = readRepoFile('docs/20-historical-cultural-audit.md');
  const packet = readRepoFile('docs/24-external-cultural-review-packet.md');

  assert.match(CAMPAIGN.cast.mateus.background, /Goa and Macao before 1614/u);
  assert.match(CAMPAIGN.cast.mateus.background, /remained clandestinely after the ban/u);
  assert.match(CAMPAIGN.cast.lise.background, /Ragusa–Lisbon–Goa–Melaka–Macao route/u);
  assert.match(CAMPAIGN.cast.lise.background, /almost no Japanese beyond memorized port phrases/u);
  assert.match(camp, /hears confession, imposes penance, and guards the sacramental seal/u);
  assert.match(audit, /external consultant review remains pending/u);
  assert.match(audit, /https:\/\/www\.mlit\.go\.jp\/tagengo-db\/en\/R1-00781\.html/u);
  assert.match(audit, /https:\/\/www\.bunka\.go\.jp\/seisaku\/bunkazai/u);
  assert.match(audit, /https:\/\/www\.kunaicho\.go\.jp/u);
  assert.match(audit, /https:\/\/www\.vatican\.va/u);
  assert.match(audit, /do not back-project its objects wholesale into 1622/iu);
  assert.match(audit, /cannot approve it/iu);
  assert.match(packet, /ready for independent review; no external approval recorded/iu);
  assert.match(packet, /Japanese organizers retain authority/iu);
  assert.match(packet, /named independent reviewer/iu);
  assert.match(packet, /https:\/\/whc\.unesco\.org\/en\/list\/1495/u);
  assert.match(packet, /https:\/\/kirishitan\.jp\/histories_en\/his001/u);
  assert.match(packet, /https:\/\/online\.bunka\.go\.jp\/heritages\/detail\/611963/u);
});
