import { mountAudioControls } from './audio-controls.mjs';
import { applyPresentationMode } from './presentation-mode.mjs';

applyPresentationMode(document, window.location.search);
mountAudioControls({ desiredLoop: 'exploration' });

const newGame = document.querySelector('#newGame');
const newGameConfirm = document.querySelector('#newGameConfirm');
const confirmNewGame = document.querySelector('#confirmNewGame');
const cancelNewGame = document.querySelector('#cancelNewGame');
const newGameStatus = document.querySelector('#newGameStatus');
const toggleOptions = document.querySelector('#toggleOptions');
const optionsPanel = document.querySelector('#optionsPanel');

function setDrawer(button, drawer, open) {
  drawer.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
}

newGame.addEventListener('click', () => {
  const opening = newGameConfirm.hidden;
  setDrawer(newGame, newGameConfirm, opening);
  if (opening) {
    setDrawer(toggleOptions, optionsPanel, false);
    confirmNewGame.focus({ preventScroll: true });
  }
});

cancelNewGame.addEventListener('click', () => {
  setDrawer(newGame, newGameConfirm, false);
  newGame.focus({ preventScroll: true });
});

confirmNewGame.addEventListener('click', () => {
  window.location.href = 'campaign.html?new=1';
});

toggleOptions.addEventListener('click', () => {
  const opening = optionsPanel.hidden;
  setDrawer(toggleOptions, optionsPanel, opening);
  if (opening) {
    setDrawer(newGame, newGameConfirm, false);
    optionsPanel.querySelector('button, input')?.focus({ preventScroll: true });
  }
});
