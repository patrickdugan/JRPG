import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  readFileSync,
  readdirSync,
} from 'node:fs';
import {
  extname,
  join,
  relative,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { CAMPAIGN } from '../content/campaign.mjs';
import {
  createAdvancementState,
  getPartyMember,
} from '../advancement.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const LEGACY_RECEIPT_PATH = 'docs/rendered-route-playtest-evidence.json';
const LEGACY_RECEIPT_SHA256 = 'bdf021e41dc7dbd42948756d19dec25e5bb25b682bb5874b19cb9f5366baa57a';
const RETIRED_DISPLAY_NAME = /(?<![\p{L}\p{N}_-])(?:Elisabet|Lise|Varga|ELISABET|LISE|VARGA)(?:['’]s|s)?(?![\p{L}\p{N}_-])/u;
const CURRENT_SURFACE_EXTENSIONS = new Set(['.html', '.js', '.json', '.md', '.mjs']);

function collectFiles(directory, { ignoredDirectories = new Set() } = {}) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(path, { ignoredDirectories }));
    else if (entry.isFile() && CURRENT_SURFACE_EXTENSIONS.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function repoPath(path) {
  return relative(REPO_ROOT, path).replaceAll('\\', '/');
}

function isExplicitLegacyExplanation(path, line) {
  return path === 'docs/20-historical-cultural-audit.md'
    && line.startsWith('- Migration note: **Elisabet “Lise” Varga** is the retired display identity.')
    && line.includes('historical receipts are not rewritten.');
}

test('current runtime and documentation do not expose the retired display identity', () => {
  const files = [
    join(REPO_ROOT, 'README.md'),
    ...collectFiles(join(REPO_ROOT, 'docs')),
    ...collectFiles(join(REPO_ROOT, 'game'), {
      ignoredDirectories: new Set(['node_modules', 'tests', 'tools']),
    }),
  ];
  const violations = [];

  for (const file of files) {
    const path = repoPath(file);
    if (path === LEGACY_RECEIPT_PATH) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/u);
    lines.forEach((line, index) => {
      if (RETIRED_DISPLAY_NAME.test(line) && !isExplicitLegacyExplanation(path, line)) {
        violations.push(`${path}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(violations, [], `retired player-visible name escaped migration:\n${violations.join('\n')}`);
});

test('save-stable party slot resolves to Nikola Dražanić and masculine characterization', () => {
  const cast = CAMPAIGN.cast.lise;
  const runtimeMember = getPartyMember(createAdvancementState(), 'lise');

  assert.equal(cast.id, 'lise');
  assert.equal(cast.name, 'Nikola Dražanić');
  assert.equal(runtimeMember.id, 'lise');
  assert.equal(runtimeMember.name, 'Nikola Dražanić');
  assert.match(cast.role, /self-styled Count of a minor Croatian frontier house/u);
  assert.match(`${cast.arc} ${cast.background}`, /\bhis\b/u);
});

test('pre-migration rendered-route receipt remains byte-historical', () => {
  const receipt = readFileSync(join(REPO_ROOT, LEGACY_RECEIPT_PATH));
  const actualSha256 = createHash('sha256').update(receipt).digest('hex');
  assert.equal(actualSha256, LEGACY_RECEIPT_SHA256);
});
