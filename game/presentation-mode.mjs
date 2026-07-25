export const PRESENTATION_MODES = Object.freeze({
  PLAYER: 'player',
  DEVELOPER: 'developer',
});

export function getPresentationMode(search = '') {
  const parameters = new URLSearchParams(String(search ?? ''));
  return parameters.get('dev') === '1'
    ? PRESENTATION_MODES.DEVELOPER
    : PRESENTATION_MODES.PLAYER;
}

export function applyPresentationMode(documentRef = globalThis.document, search = globalThis.location?.search ?? '') {
  const mode = getPresentationMode(search);
  if (!documentRef?.documentElement) return mode;
  documentRef.documentElement.dataset.presentationMode = mode;
  documentRef.querySelectorAll('[data-developer-only]').forEach((element) => {
    element.hidden = mode !== PRESENTATION_MODES.DEVELOPER;
  });
  return mode;
}
