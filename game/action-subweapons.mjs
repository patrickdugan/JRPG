/**
 * Session-local subweapons for the non-canonical Action Lab.
 *
 * These definitions never enter canonical inventory or campaign settlement.
 * Their limited stock exists only for the lifetime of one laboratory session.
 */

export const ACTION_SUBWEAPON_IDS = Object.freeze(['holy-water', 'throwing-cross']);

export const ACTION_SUBWEAPONS = Object.freeze({
  'holy-water': Object.freeze({
    id: 'holy-water',
    attackId: 'subweapon:holy-water',
    name: 'Holy Water',
    stock: 3,
    input: 'Down + X',
    description: 'Close ground splash; high armor penetration; Radiance weakness applies.',
    attack: Object.freeze({
      name: 'Holy Water',
      kind: 'subweapon',
      delivery: 'arcane',
      essence: 'radiance',
      power: 22,
      powerScale: 0.55,
      guardPierce: 0.65,
      windupMs: 100,
      activeMs: 120,
      recoveryMs: 180,
      cooldownMs: 900,
      hitbox: Object.freeze({ offsetX: 8, offsetY: 0, width: 112, height: 48 }),
      tags: Object.freeze(['subweapon', 'holy', 'ground-splash']),
    }),
  }),
  'throwing-cross': Object.freeze({
    id: 'throwing-cross',
    attackId: 'subweapon:throwing-cross',
    name: 'Throwing Cross',
    stock: 2,
    input: 'Up + X',
    description: 'Long Radiance lane; modest armor penetration; lower neutral damage.',
    attack: Object.freeze({
      name: 'Throwing Cross',
      kind: 'subweapon',
      delivery: 'pierce',
      essence: 'radiance',
      power: 14,
      powerScale: 0.45,
      guardPierce: 0.45,
      windupMs: 80,
      activeMs: 120,
      recoveryMs: 160,
      cooldownMs: 700,
      hitbox: Object.freeze({ offsetX: 12, offsetY: 8, width: 256, height: 72 }),
      tags: Object.freeze(['subweapon', 'holy', 'returning-lane']),
    }),
  }),
});

export function createActionSubweaponStock() {
  return Object.fromEntries(ACTION_SUBWEAPON_IDS.map((id) => [id, ACTION_SUBWEAPONS[id].stock]));
}

export function getActionSubweapon(id) {
  return ACTION_SUBWEAPONS[id] ?? null;
}
