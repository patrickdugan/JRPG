import assert from 'node:assert/strict';
import test from 'node:test';

import { createBrowserRunUuid } from '../browser-runtime.mjs';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('New Game uses native randomUUID when the browser provides it', () => {
  const expected = 'b44ddd35-4be6-48e9-b243-1de76f63dd76';
  assert.equal(createBrowserRunUuid({
    cryptoSource: { randomUUID: () => expected },
    randomSource: () => 0,
  }), expected);
});
test('New Game retains a valid UUID when randomUUID is unavailable or denied', () => {
  const generated = createBrowserRunUuid({
    cryptoSource: {
      randomUUID() {
        throw new Error('NotAllowedError');
      },
      getRandomValues(bytes) {
        bytes.forEach((_, index) => { bytes[index] = index; });
        return bytes;
      },
    },
    randomSource: () => 0,
  });
  assert.match(generated, UUID_V4);
  assert.equal(generated, '00010203-0405-4607-8809-0a0b0c0d0e0f');

  const compatibility = createBrowserRunUuid({ cryptoSource: null, randomSource: () => 0.5 });
  assert.match(compatibility, UUID_V4);
});
