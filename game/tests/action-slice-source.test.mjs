import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../action-slice.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../action-slice.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../action-slice.js', import.meta.url), 'utf8');

function tags(name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gu'))].map((match) => match[0]);
}

test('combat slice exposes a titled, iframe-free launch shell', () => {
  assert.match(html, /<html lang="en">/u);
  assert.match(html, /<meta name="viewport"/u);
  assert.match(html, /<h1>The Widow's Bell<\/h1>/u);
  assert.match(html, /action-campaign-battle\.css/u);
  assert.match(html, /action-slice\.css/u);
  assert.match(html, /<script type="module" src="action-slice\.js"><\/script>/u);
  assert.match(html, /id="actionSliceApp"[^>]*data-slice-state="not-started"/u);
  assert.match(html, /id="sliceLaunchArea"[^>]*data-slice-launch-area/u);
  assert.match(html, /id="sliceRuntimeMount"[^>]*data-slice-runtime-mount/u);
  assert.doesNotMatch(html, /<iframe\b/iu);
});

test('fighter selector contains four canonical choices and exactly two checked defaults', () => {
  const fighterInputs = tags('input').filter((tag) => /data-fighter-id=/u.test(tag));
  const checkedInputs = fighterInputs.filter((tag) => /\schecked(?:\s|>)/u.test(tag));

  assert.equal(fighterInputs.length, 4);
  assert.deepEqual(
    fighterInputs.map((tag) => tag.match(/data-fighter-id="([^"]+)"/u)?.[1]),
    ['ren', 'lise', 'mateus', 'miyo'],
  );
  assert.equal(checkedInputs.length, 2);
  assert.deepEqual(
    checkedInputs.map((tag) => tag.match(/data-fighter-id="([^"]+)"/u)?.[1]),
    ['lise', 'mateus'],
  );
  assert.match(html, /id="fighterSelect"[^>]*aria-describedby="fighterSelectionGuidance fighterSelectionStatus"[^>]*data-selection-min="2"[^>]*data-selection-max="2"/u);
  assert.match(html, /id="fighterSelectionGuidance"[\s\S]*Choose exactly two\./u);
  for (const name of ['Ren Ishikawa', 'Nikola Dražanić', 'Father Mateus Avelar', 'Miyo Senda']) assert.match(html, new RegExp(name, 'u'));
  assert.match(html, /id="fighterSelectionStatus"[^>]*role="status"[^>]*aria-live="polite"/u);
});

test('start, resume, and reset controls have stable runtime hooks and honest initial state', () => {
  assert.match(html, /id="startSliceButton"[^>]*type="button"[^>]*data-slice-action="start"/u);
  assert.match(html, /id="resumeSliceButton"[^>]*type="button"[^>]*data-slice-action="resume"[^>]*disabled/u);
  assert.match(html, /id="resetSliceButton"[^>]*type="button"[^>]*data-slice-action="reset"[^>]*aria-describedby="resetWarning"/u);
  assert.match(html, /id="sliceBuildStatus"[^>]*role="status"[\s\S]*NOT STARTED/u);
  assert.match(html, /id="currentCheckpoint"[^>]*data-slice-readout="checkpoint">Not started/u);
  assert.match(html, /id="sliceProgressStatus"[^>]*role="status"[^>]*aria-live="polite"[\s\S]*0 of 7 route stages resolved/u);
  assert.doesNotMatch(html, /data-step-state="(?:complete|completed|victory)"/u);
});

test('route timeline covers the playable loop and begins entirely pending', () => {
  const routeSteps = tags('li').filter((tag) => /data-route-step=/u.test(tag));
  const kinds = routeSteps.map((tag) => tag.match(/data-step-kind="([^"]+)"/u)?.[1]);

  assert.equal(routeSteps.length, 7);
  assert.equal(kinds.filter((kind) => kind === 'ordinary').length, 2);
  for (const kind of ['briefing', 'sanctuary', 'boss', 'consequence', 'camp-return']) assert.ok(kinds.includes(kind), `missing ${kind} route step`);
  assert.ok(routeSteps.every((tag) => /data-step-state="pending"/u.test(tag)));
  assert.match(html, /id="sliceRouteTimeline"[^>]*aria-label="Combat slice route progress"/u);
  assert.match(html, /Aya's Sanctuary/u);
  assert.match(html, /Tithe Hound/u);
  assert.match(html, /Return to Camp/u);
});

test('runtime uses only the isolated session checkpoint and launches validated action battles', () => {
  assert.match(js, /ACTION_SLICE_STORAGE_KEY/u);
  assert.match(js, /sessionStorage\.setItem/u);
  assert.match(js, /sessionStorage\.removeItem/u);
  assert.doesNotMatch(js, /localStorage/u);
  assert.match(js, /action-campaign-battle\.html/u);
  assert.match(js, /slice: '1'/u);
  assert.match(js, /useActionSliceSanctuary/u);
  assert.match(js, /acknowledgeActionSliceConsequence/u);
});

test('text readouts and both input guides remain available without the visual runtime', () => {
  assert.match(html, /id="sliceStatusReadout"[^>]*aria-label="Combat slice text status"/u);
  for (const readout of ['activeDuoReadout', 'currentCheckpoint', 'sliceProgressStatus', 'sliceAnnouncement']) assert.match(html, new RegExp(`id="${readout}"`, 'u'));
  assert.match(html, /id="sliceControlGuide"[^>]*aria-labelledby="controlsTitle"/u);
  assert.match(html, /id="keyboardGuideTitle">Keyboard/u);
  assert.match(html, /id="controllerGuideTitle">Controller/u);
  assert.match(html, /<kbd>Tab<\/kbd>[\s\S]*Tag fighters/u);
  assert.match(html, /Right bumper[\s\S]*Tag fighters/u);
});

test('source supplies keyboard focus, responsive layout, selected-state cues, and reduced-motion handling', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'all document ids must be unique');
  assert.match(html, /class="skip-link" href="#fighterSelection"/u);
  assert.match(html, /class="skip-link skip-link-secondary" href="#sliceRoute"/u);
  assert.match(html, /<fieldset[\s\S]*<legend/u);
  assert.match(css, /\.fighter-card:focus-within/u);
  assert.match(css, /\.fighter-card:has\(input:checked\)/u);
  assert.match(css, /@media \(max-width: 680px\)/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
});
