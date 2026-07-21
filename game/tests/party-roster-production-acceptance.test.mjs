import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(GAME_ROOT, '..');
const SUITE_ROOT = resolve(REPO_ROOT, 'assets', 'art', 'party-roster-suite');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const NIKOLA_LINEAGE = {
  birthAndStation: 'Croatian-born frontier minor aristocrat',
  claimedDescent: 'Nikola claims descent from a Wallachian hunter line',
  affiliation: 'Covenant of the Severed Dragon',
  historicity: 'entirely invented alternate-history lore; makes no real-world claim that vampires, vampire hunters, or this Covenant existed',
};

test('deterministic roster retains the legacy row key but presents Nikola Dražanić', async () => {
  const [sourceText, manifestText] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'party-roster-suite.source.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
  ]);
  const source = JSON.parse(sourceText);
  const manifest = JSON.parse(manifestText);
  assert.equal(source.assetId, 'party-roster-key-art-v2');
  assert.equal(source.formatVersion, 2);
  assert.equal(manifest.assetId, source.assetId);
  assert.deepEqual(source.rowOrder, ['ren', 'aya', 'lise', 'mateus', 'genta', 'kiku']);
  assert.equal(source.presentationNames.lise, 'Nikola Dražanić');
  assert.match(source.legacyCompatibility.lise, /stable internal actor and atlas row key/u);
  assert.deepEqual(source.nikolaLineage, NIKOLA_LINEAGE);
  assert.equal(manifest.presentationNames.lise, 'Nikola Dražanić');
  assert.deepEqual(manifest.nikolaLineage, NIKOLA_LINEAGE);
  assert.equal(manifest.sources.find(({ role }) => role === 'editable-composition-contract').sha256,
    sha256(Buffer.from(sourceText)));
});

test('player-facing roster is exact, manifested, and byte-identical in the browser', async () => {
  const [manifestText, productionBytes, runtimeBytes] = await Promise.all([
    readFile(resolve(SUITE_ROOT, 'manifest.json'), 'utf8'),
    readFile(resolve(SUITE_ROOT, 'party-roster-key-art.png')),
    readFile(resolve(GAME_ROOT, 'assets', 'art', 'party-roster-suite', 'party-roster-key-art.png')),
  ]);
  const manifest = JSON.parse(manifestText);
  const output = manifest.exports.find(({ role }) => role === 'player-facing-runtime-key-art');
  assert.deepEqual([output.width, output.height, output.mode], [1440, 900, 'RGBA']);
  assert.equal(productionBytes.subarray(1, 4).toString('ascii'), 'PNG');
  assert.deepEqual([productionBytes.readUInt32BE(16), productionBytes.readUInt32BE(20)], [1440, 900]);
  assert.equal(sha256(productionBytes), output.sha256);
  assert.equal(runtimeBytes.equals(productionBytes), true);
});

test('Campaign loads the deterministic roster and no longer loads the obsolete female roster', async () => {
  const campaign = await readFile(resolve(GAME_ROOT, 'campaign.js'), 'utf8');
  assert.match(campaign, /assets\/art\/party-roster-suite\/party-roster-key-art\.png/u);
  assert.match(campaign, /Ren, Aya, Nikola, Mateus, Genta, and Kiku/u);
  assert.doesNotMatch(campaign, /bells-party-roster-v1\.png/u);
});
