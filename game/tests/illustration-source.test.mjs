import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ILLUSTRATION_REFERENCES,
  ILLUSTRATION_REVIEW_STORAGE_KEY,
  allIllustrationFiles,
  runtimeIllustrationPath,
  validIllustrationReview,
} from '../illustration-catalog.mjs';

function gitBlobHash(buffer) {
  return createHash('sha1').update('blob ' + buffer.length + '\0').update(buffer).digest('hex');
}
function read(path) {
  return readFileSync(new URL('../../' + path, import.meta.url));
}
function validReview() {
  return {
    schemaVersion: 1,
    entries: ILLUSTRATION_REFERENCES.map((asset) => ({
      id: asset.id, sourceSha: asset.source.sha, verdict: 'unreviewed', note: '',
    })),
  };
}

test('July gallery maps the four exact image identities without path aliases colliding', () => {
  assert.deepEqual(ILLUSTRATION_REFERENCES.map((asset) => asset.id), ['nikola', 'mateus', 'kurozane', 'world']);
  const filenames = allIllustrationFiles();
  assert.equal(filenames.length, 8);
  assert.equal(new Set(filenames.map((x) => x.file)).size, filenames.length);
  for (const asset of ILLUSTRATION_REFERENCES) {
    assert.match(asset.source.commit, /^[0-9a-f]{40}$/);
    assert.match(asset.source.sha, /^[0-9a-f]{40}$/);
    assert.ok(asset.approvedUse.length > 25);
  }
});

test('gallery runtime PNGs retain the exact July source Git objects', () => {
  for (const item of allIllustrationFiles()) {
    const original = read(item.path);
    const servingCopy = read('game/' + runtimeIllustrationPath(item.file).slice(2));
    assert.equal(original.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', item.path);
    assert.equal(gitBlobHash(original), item.sha, item.path + ' original Git blob changed');
    assert.equal(gitBlobHash(servingCopy), item.sha, item.file + ' source alias changed');
    assert.ok(original.equals(servingCopy), item.file + ' must preserve identical source bytes');
  }
});

test('developer review is navigable without becoming canonical campaign art', () => {
  const html = read('game/illustration-review.html').toString('utf8');
  const js = read('game/illustration-review.js').toString('utf8');
  const css = read('game/illustration-review.css').toString('utf8');
  const title = read('game/index.html').toString('utf8');
  assert.match(title, /illustration-review\.html\?dev=1/);
  assert.match(title, /data-developer-only hidden>Review original illustrations/);
  for (const token of ['sourceImage', 'laterImage', 'exportReview', 'importReview', 'verdict', 'note']) {
    assert.match(html, new RegExp('id="' + token + '"'));
  }
  assert.match(js, /runtimeIllustrationPath/);
  assert.match(js, /validIllustrationReview/);
  assert.match(css, /\.art-canvas img \{[^}]+image-rendering: auto/);
  assert.match(css, /\.art-canvas img\.pixelated \{ image-rendering: pixelated/);
  assert.ok(!js.includes('bells-black-chrysanthemum.campaign'));
  assert.match(ILLUSTRATION_REVIEW_STORAGE_KEY, /illustration-review/);
});

test('import approvals remain bound to each source Git hash', () => {
  const correct = validReview();
  assert.ok(validIllustrationReview(correct));
  const tampered = structuredClone(correct);
  tampered.entries[0].sourceSha = '0'.repeat(40);
  assert.equal(validIllustrationReview(tampered), false);
  const duplicate = structuredClone(correct);
  duplicate.entries[1].id = duplicate.entries[0].id;
  assert.equal(validIllustrationReview(duplicate), false);
  const overlong = structuredClone(correct);
  overlong.entries[0].note = 'x'.repeat(2501);
  assert.equal(validIllustrationReview(overlong), false);
  const impossible = structuredClone(correct);
  impossible.entries[0].verdict = 'unconditionally-shippable';
  assert.equal(validIllustrationReview(impossible), false);
  const missing = structuredClone(correct);
  missing.schemaVersion = 3;
  assert.equal(validIllustrationReview(missing), false);
});

test('the review documentation distinguishes raster originals from editable vector source', () => {
  const doc = read('docs/45-july-illustration-recovery.md').toString('utf8');
  const art = read('docs/05-art-direction.md').toString('utf8');
  assert.match(doc, /original.*PNG/i);
  assert.match(doc, /vector-style/i);
  assert.match(doc, /August/i);
  assert.match(doc, /unchanged Git blobs/);
  assert.match(art, /45-july-illustration-recovery/);
});
