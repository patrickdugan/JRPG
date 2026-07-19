import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const campHtml = readFileSync(new URL('../camp.html', import.meta.url), 'utf8');
const campSource = readFileSync(new URL('../camp.js', import.meta.url), 'utf8');
const campaignSource = readFileSync(new URL('../campaign.js', import.meta.url), 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source boundary: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source boundary: ${endMarker}`);
  assert.ok(end > start, `Invalid source boundaries: ${startMarker} / ${endMarker}`);
  return source.slice(start, end);
}

test('camp exposes each public-reading control consumed by its module', () => {
  for (const id of [
    'archiveRecordSummary',
    'archiveRecordList',
    'archiveRecordStage',
    'archiveRecordMeta',
    'archiveRecordTitle',
    'archiveRecordAccess',
    'archiveRecordParagraph',
    'advanceArchiveRecord',
  ]) {
    const matches = campHtml.match(new RegExp(`\\bid=["']${escapeRegExp(id)}["']`, 'g')) ?? [];
    assert.equal(matches.length, 1, `camp.html must expose one #${id} control`);
    assert.match(campSource, new RegExp(`querySelector\\(\\s*['"]#${escapeRegExp(id)}['"]\\s*\\)`));
  }
  assert.match(campSource, /from '\.\/content\/archive-records\.mjs'/);
  assert.match(campSource, /from '\.\/archive-record-runtime\.mjs'/);
  assert.match(campSource, /createArchiveRecordStorageAdapter\(\)/);
  assert.match(campSource, /button\.classList\.toggle\('is-complete', progressRecord\?\.status === 'completed'\)/);
});

test('public reading begins once, advances one paragraph, and saves every mutation', () => {
  const begin = sourceSection(
    campSource,
    "archiveRecordList.addEventListener('click'",
    "advanceArchiveRecord.addEventListener('click'",
  );
  assert.match(begin, /beginArchiveRecord\(archiveRecordState, record\.id, archiveRecordContext\(\)\)/);
  assert.match(begin, /archiveRecordState = result\.state/);
  assert.match(begin, /const saved = archiveRecordAdapter\.save\(result\.state\)/);
  assert.match(begin, /if \(!saved\.ok\)/);

  const advance = sourceSection(
    campSource,
    "advanceArchiveRecord.addEventListener('click'",
    'function tick(now)',
  );
  assert.match(advance, /acknowledgeArchiveRecordParagraph\(archiveRecordState, selectedArchiveRecordId\)/);
  assert.match(advance, /archiveRecordState = result\.state/);
  assert.match(advance, /const saved = archiveRecordAdapter\.save\(result\.state\)/);
  assert.match(advance, /if \(!saved\.ok\)/);
  assert.match(advance, /No reward or ownership claim was created/);
  assert.match(advance, /progress\?\.complete && Number\.isSafeInteger\(archiveReviewParagraphIndex\)/);
  assert.match(advance, /finite state was unchanged/);
});

test('archive mutations persist synchronously, cached pages reload, and New Game clears their save namespace', () => {
  const pagehide = sourceSection(
    campSource,
    "window.addEventListener('pagehide'",
    "document.addEventListener('visibilitychange'",
  );
  assert.doesNotMatch(pagehide, /archiveRecordAdapter\.save\(archiveRecordState\)/);

  const pageshow = sourceSection(
    campSource,
    "window.addEventListener('pageshow'",
    'document.title',
  );
  assert.match(pageshow, /const refreshedArchiveRecords = archiveRecordAdapter\.load\(\)/);
  assert.match(pageshow, /archiveRecordState = refreshedArchiveRecords\.state/);
  assert.match(pageshow, /selectedArchiveRecordId = archiveRecordState\.records\.find/);

  const reset = sourceSection(
    campaignSource,
    "resetCampaign.addEventListener('click'",
    "window.addEventListener('keydown'",
  );
  assert.match(reset, /archiveRecordAdapter\.clear\(\)/);
});
