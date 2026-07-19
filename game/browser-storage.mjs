/**
 * Resolve the browser save store without letting a denied localStorage getter
 * abort module initialization. Some privacy and embedding policies throw while
 * merely reading `window.localStorage`, before an adapter can use its own
 * no-throw load/save boundary.
 */

const UNAVAILABLE_STORAGE = Object.freeze({
  getItem() {
    return null;
  },
  setItem() {
    throw new Error('Browser storage is unavailable.');
  },
  removeItem() {
    throw new Error('Browser storage is unavailable.');
  },
});

export function getDefaultBrowserStorage(scope = globalThis) {
  try {
    const storage = scope?.localStorage;
    return storage
      && typeof storage.getItem === 'function'
      && typeof storage.setItem === 'function'
      && typeof storage.removeItem === 'function'
      ? storage
      : UNAVAILABLE_STORAGE;
  } catch {
    return UNAVAILABLE_STORAGE;
  }
}
