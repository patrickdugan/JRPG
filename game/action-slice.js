import {
  ACTION_SLICE_CONSEQUENCE,
  ACTION_SLICE_DEFAULT_FIGHTERS,
  ACTION_SLICE_FIGHTERS,
  ACTION_SLICE_PHASES,
  ACTION_SLICE_STORAGE_KEY,
  acknowledgeActionSliceConsequence,
  beginActionSliceRun,
  createActionSliceRun,
  getActionSliceExpectedEncounter,
  hydrateActionSliceRun,
  leaveActionSliceSanctuary,
  serializeActionSliceRun,
  useActionSliceSanctuary,
} from './action-slice-model.mjs';

const elements = {
  app: document.querySelector('#actionSliceApp'),
  form: document.querySelector('#fighterSelectionForm'),
  fighterSelect: document.querySelector('#fighterSelect'),
  fighterInputs: [...document.querySelectorAll('[data-fighter-id]')],
  selectionStatus: document.querySelector('#fighterSelectionStatus'),
  start: document.querySelector('#startSliceButton'),
  resume: document.querySelector('#resumeSliceButton'),
  resumeHint: document.querySelector('#resumeHint'),
  reset: document.querySelector('#resetSliceButton'),
  runtime: document.querySelector('#sliceRuntimeMount'),
  buildStatus: document.querySelector('#sliceBuildStatus'),
  routeItems: [...document.querySelectorAll('[data-route-step]')],
  routeLegend: document.querySelector('.route-legend'),
  duo: document.querySelector('#activeDuoReadout'),
  checkpoint: document.querySelector('#currentCheckpoint'),
  progress: document.querySelector('#sliceProgressStatus'),
  announcement: document.querySelector('#sliceAnnouncement'),
};

let run = createActionSliceRun();
let persistedRun = null;
let active = false;
let storageMessage = '';

function selectedFighterIds() {
  return elements.fighterInputs.filter(({ checked }) => checked).map(({ value }) => value);
}

function fighterNames(fighterIds) {
  return fighterIds.map((fighterId) => ACTION_SLICE_FIGHTERS[fighterId].name);
}

function setSelectedFighters(fighterIds) {
  const selected = new Set(fighterIds);
  for (const input of elements.fighterInputs) input.checked = selected.has(input.value);
}

function saveRun(nextRun) {
  sessionStorage.setItem(ACTION_SLICE_STORAGE_KEY, serializeActionSliceRun(nextRun));
  persistedRun = nextRun;
}

function clearSavedRun() {
  sessionStorage.removeItem(ACTION_SLICE_STORAGE_KEY);
  persistedRun = null;
}

function readSavedRun() {
  const serialized = sessionStorage.getItem(ACTION_SLICE_STORAGE_KEY);
  if (serialized == null) return null;
  const hydrated = hydrateActionSliceRun(serialized);
  if (hydrated.ok) return hydrated.value;
  sessionStorage.removeItem(ACTION_SLICE_STORAGE_KEY);
  storageMessage = 'An invalid slice checkpoint was discarded without touching campaign data.';
  return null;
}

function battleUrl(currentRun) {
  const expected = getActionSliceExpectedEncounter(currentRun);
  if (!expected) return null;
  const params = new URLSearchParams({
    encounter: expected.encounterId,
    return: 'action-slice.html',
    slice: '1',
    lead: currentRun.fighters[0],
    support: currentRun.fighters[1],
  });
  return `action-campaign-battle.html?${params}`;
}

function phaseIndex(phaseId) {
  return ACTION_SLICE_PHASES.findIndex(({ id }) => id === phaseId);
}

function phaseFor(currentRun) {
  return ACTION_SLICE_PHASES[phaseIndex(currentRun.phase)];
}

function renderSelection() {
  const fighterIds = selectedFighterIds();
  const valid = fighterIds.length === 2;
  elements.selectionStatus.dataset.valid = String(valid);
  elements.selectionStatus.textContent = valid
    ? `2 of 2 selected: ${fighterNames(fighterIds).join(' and ')}.`
    : `${fighterIds.length} of 2 selected. Choose exactly two fighters.`;
  elements.start.disabled = !valid || active;
  elements.duo.textContent = fighterNames(fighterIds).join(' + ') || 'No valid duo selected';
}

function routeResolvedCount(currentRun) {
  const currentIndex = phaseIndex(currentRun.phase);
  return currentRun.phase === 'complete' ? ACTION_SLICE_PHASES.length : currentIndex;
}

function renderRoute(currentRun, showProgress) {
  const currentIndex = phaseIndex(currentRun.phase);
  for (const [index, item] of elements.routeItems.entries()) {
    const state = !showProgress
      ? 'pending'
      : currentRun.phase === 'complete' || index < currentIndex
        ? 'resolved'
        : index === currentIndex ? 'active' : 'pending';
    item.dataset.stepState = state;
    item.querySelector('.route-state').textContent = state === 'resolved'
      ? 'Resolved'
      : state === 'active' ? 'Current' : 'Pending';
  }
  const resolved = showProgress ? routeResolvedCount(currentRun) : 0;
  elements.routeLegend.innerHTML = `<span aria-hidden="true"></span> ${resolved} of ${ACTION_SLICE_PHASES.length} resolved`;
  elements.progress.textContent = `${resolved} of ${ACTION_SLICE_PHASES.length} route stages resolved.`;
}

function runtimeButton(label, action, { secondary = false } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.runtimeAction = action;
  if (!secondary) button.className = 'primary-action';
  return button;
}

function vitalsText(currentRun) {
  return currentRun.fighters.map((fighterId) => {
    const vital = currentRun.vitals[fighterId];
    return `${ACTION_SLICE_FIGHTERS[fighterId].name}: ${vital.hp}/${vital.maxHp} HP`;
  }).join(' · ');
}

function renderRuntime(currentRun) {
  const phase = phaseFor(currentRun);
  const wrapper = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = phase.title;
  const copy = document.createElement('p');
  const actions = document.createElement('div');
  actions.className = 'runtime-actions';
  wrapper.append(title, copy, actions);

  if (phase.kind === 'battle') {
    copy.textContent = `${vitalsText(currentRun)}. Restarting this encounter restores these checkpoint vitals.`;
    actions.append(runtimeButton(`Enter: ${phase.title}`, 'battle'));
  } else if (phase.kind === 'sanctuary') {
    copy.textContent = `Aya can restore the pair once before the boss. Current state: ${vitalsText(currentRun)}.`;
    actions.append(
      runtimeButton('Accept Aya’s full heal', 'heal'),
      runtimeButton('Keep current attrition', 'decline', { secondary: true }),
    );
  } else if (phase.kind === 'consequence') {
    copy.textContent = ACTION_SLICE_CONSEQUENCE.text;
    actions.append(runtimeButton('Preserve the testimony', 'consequence'));
  } else if (phase.kind === 'complete') {
    copy.textContent = `Slice complete with ${vitalsText(currentRun)}. No campaign save, inventory, or reward state was changed.`;
    const camp = document.createElement('a');
    camp.className = 'continue-link';
    camp.href = 'camp.html';
    camp.textContent = 'Return to Camp';
    actions.append(camp);
  } else {
    copy.textContent = 'Choose exactly two fighters to begin the isolated route.';
  }
  elements.runtime.replaceChildren(wrapper);
}

function render() {
  const current = active ? run : (persistedRun ?? run);
  const phase = phaseFor(current);
  const hasSavedProgress = persistedRun != null && persistedRun.phase !== 'briefing';
  const showProgress = active || hasSavedProgress;

  elements.app.dataset.sliceState = active ? current.phase : hasSavedProgress ? 'saved' : 'not-started';
  elements.buildStatus.textContent = active
    ? (current.phase === 'complete' ? 'COMPLETE' : 'RUN ACTIVE')
    : hasSavedProgress ? 'CHECKPOINT FOUND' : 'NOT STARTED';
  elements.checkpoint.textContent = showProgress ? phase.title : 'Not started';
  elements.resume.disabled = !hasSavedProgress || active;
  elements.resumeHint.textContent = storageMessage || (hasSavedProgress
    ? `Checkpoint ready: ${phase.title}.`
    : 'No resumable slice has been found.');
  elements.start.textContent = hasSavedProgress ? 'Start new slice' : 'Start new slice';
  for (const input of elements.fighterInputs) input.disabled = active;
  renderSelection();
  renderRoute(current, showProgress);
  renderRuntime(active ? current : createActionSliceRun({ fighters: selectedFighterIds().length === 2
    ? selectedFighterIds() : ACTION_SLICE_DEFAULT_FIGHTERS }));
}

function announce(message) {
  elements.announcement.textContent = message;
}

function launchCurrentBattle() {
  const target = battleUrl(run);
  if (!target) return;
  window.location.assign(target);
}

function beginNewRun() {
  const fighters = selectedFighterIds();
  if (fighters.length !== 2) return;
  run = beginActionSliceRun(createActionSliceRun({ fighters }));
  saveRun(run);
  active = true;
  render();
  launchCurrentBattle();
}

function resumeRun() {
  if (!persistedRun) return;
  run = persistedRun;
  active = true;
  setSelectedFighters(run.fighters);
  render();
  announce(`Resumed at ${phaseFor(run).title}.`);
  elements.runtime.focus();
}

function resetRun() {
  clearSavedRun();
  run = createActionSliceRun();
  active = false;
  storageMessage = '';
  setSelectedFighters(ACTION_SLICE_DEFAULT_FIGHTERS);
  render();
  announce('Combat slice reset. Campaign data was not changed.');
  elements.form.focus?.();
}

function settleSanctuary(heal) {
  run = heal ? useActionSliceSanctuary(run) : leaveActionSliceSanctuary(run);
  saveRun(run);
  render();
  announce(heal ? 'Aya restored both fighters. The boss checkpoint is ready.' : 'Aya’s heal was declined. Attrition carries into the boss.');
}

function settleConsequence() {
  run = acknowledgeActionSliceConsequence(run);
  saveRun(run);
  render();
  announce('The clerk’s testimony is preserved. The combat slice is complete.');
}

elements.form.addEventListener('change', () => {
  if (active) return;
  renderSelection();
  const selected = selectedFighterIds();
  if (selected.length === 2) renderRuntime(createActionSliceRun({ fighters: selected }));
});
elements.start.addEventListener('click', beginNewRun);
elements.resume.addEventListener('click', resumeRun);
elements.reset.addEventListener('click', resetRun);
elements.runtime.addEventListener('click', (event) => {
  const action = event.target.closest('[data-runtime-action]')?.dataset.runtimeAction;
  if (action === 'battle') launchCurrentBattle();
  else if (action === 'heal') settleSanctuary(true);
  else if (action === 'decline') settleSanctuary(false);
  else if (action === 'consequence') settleConsequence();
});

const previousPadButtons = [];
let previousPadHorizontal = 0;
function pollGamepad() {
  const pad = navigator.getGamepads?.().find(Boolean);
  if (pad) {
    const pressed = (index) => Boolean(pad.buttons[index]?.pressed);
    const edge = (index) => pressed(index) && !previousPadButtons[index];
    const horizontal = pressed(15) || (pad.axes[0] ?? 0) > .55
      ? 1
      : pressed(14) || (pad.axes[0] ?? 0) < -.55 ? -1 : 0;
    if (horizontal && horizontal !== previousPadHorizontal) {
      const enabled = elements.fighterInputs.filter(({ disabled }) => !disabled);
      const focusedIndex = Math.max(0, enabled.indexOf(document.activeElement));
      enabled[(focusedIndex + horizontal + enabled.length) % enabled.length]?.focus();
    }
    if (edge(0) && elements.fighterInputs.includes(document.activeElement) && !document.activeElement.disabled) {
      document.activeElement.click();
    }
    if (edge(9)) {
      if (!elements.resume.disabled) elements.resume.click();
      else if (!elements.start.disabled) elements.start.click();
    }
    for (let index = 0; index < pad.buttons.length; index += 1) previousPadButtons[index] = pressed(index);
    previousPadHorizontal = horizontal;
  } else {
    previousPadButtons.length = 0;
    previousPadHorizontal = 0;
  }
  requestAnimationFrame(pollGamepad);
}

try {
  persistedRun = readSavedRun();
} catch {
  storageMessage = 'Session checkpoints are unavailable in this browser; the slice can still run without resume.';
}
if (persistedRun) {
  run = persistedRun;
  setSelectedFighters(run.fighters);
}
render();
requestAnimationFrame(pollGamepad);

globalThis.__ACTION_SLICE__ = Object.freeze({
  getRun: () => run,
  get persistedRun() { return persistedRun; },
  resume: resumeRun,
  reset: resetRun,
});
