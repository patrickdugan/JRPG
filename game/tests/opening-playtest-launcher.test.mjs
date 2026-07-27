import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const launcher = readFileSync(
  new URL('../tools/launch-opening-playtest.py', import.meta.url),
  'utf8',
);
const windowsEntry = readFileSync(
  new URL('../../PLAYTEST_OPENING.cmd', import.meta.url),
  'utf8',
);

test('blind-opening launcher serves a clean New Game without exposing design documentation', () => {
  assert.match(launcher, /ThreadingHTTPServer\(\("127\.0\.0\.1", 0\)/u);
  assert.match(launcher, /"new": "1"/u);
  assert.match(launcher, /"openingTest": "1"/u);
  assert.match(launcher, /"candidate": commit/u);
  assert.match(launcher, /campaign\.html\?\{query\}/u);
  assert.match(launcher, /git", "status", "--porcelain"/u);
  assert.match(launcher, /f"\{commit\}-dirty"/u);
  assert.match(launcher, /Play until the game tells you the opening is complete\./u);
  assert.match(launcher, /Do not explain controls, story, navigation, or objectives\./u);
  assert.match(launcher, /let the tester complete the in-game feedback before discussing it/u);
  assert.match(launcher, /bells-opening-playtest JSON receipt/u);
  assert.doesNotMatch(launcher, /28-opening-slice|docs[/\\]/u);
  assert.match(windowsEntry, /python tools\\launch-opening-playtest\.py/u);
});
