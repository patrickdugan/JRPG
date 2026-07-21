import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../tools/browser-smoke.py', import.meta.url), 'utf8');

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Missing browser-smoke section ${startMarker} / ${endMarker}.`);
  return source.slice(start, end);
}

test('current Chrome smoke keeps narrative completion separate from observed timing proof', () => {
  const credits = section('            credits_seed = page.evaluate(', '            context.close()');
  assert.match(credits, /STORYWORLD_CLUSTERS/);
  assert.match(credits, /recordRunStoryworldDecision/);
  assert.match(credits, /"playedScenes"\]\s*==\s*82/);
  assert.match(credits, /"storyworldScenes"\]\s*==\s*22/);
  assert.match(credits, /"active-playtime-incomplete"/);
  assert.match(credits, /locator\("#sealCredits"\)\.is_disabled\(\)/);
  assert.match(credits, /exported_report\.get\("schemaVersion"\)\s*==\s*3/);
  assert.match(credits, /get\("releaseTargetProven"\) is False/);
  assert.doesNotMatch(credits, /recordRunPlaytime|completeRunCredits/,
    'bounded browser setup must never synthesize time or seal its narrative receipt');
});

test('current Chrome smoke exercises a rendered pre-boss Storyworld lock and mirrored decision', () => {
  const recovery = section(
    '            recovery_context = browser.new_context',
    '            recovery_context.close()',
  );
  assert.match(recovery, /c3-04-lantern-boat-escort/);
  assert.match(recovery, /sw3-sayos-warehouse-conditions/);
  assert.match(recovery, /"fieldMoveDisabled"\]\s*is True/);
  assert.match(recovery, /"battleHref"\]\s*is None/);
  assert.match(recovery, /keyboard\.press\("w"\)/);
  assert.match(recovery, /keyboard\.press\("1"\)/);
  assert.match(recovery, /keyboard\.press\("n"\)/);
  assert.match(recovery, /storyworldDecisionIds/);
  assert.match(recovery, /receiptDecisionIds/);
  assert.match(recovery, /"receiptMirrored"/);
});

test('current Chrome smoke round-trips all fourteen recovery authorities and rejects browser errors', () => {
  assert.match(source, /recovery_checkpoint\.get\("schemaVersion"\)\s*==\s*2/);
  assert.match(source, /len\(recovery_checkpoint\.get\("records", \[\]\)\)\s*==\s*14/);
  assert.match(source, /"storyworldCompletedClusterCount"\)\s*==\s*3/);
  assert.match(source, /"exactStringsRestored": True/);
  assert.match(source, /require\(not console_errors/);
  assert.match(source, /require\(not page_errors/);
  assert.match(source, /require\(not delivery_errors/);
});
