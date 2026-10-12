import assert from 'node:assert/strict';
import test from 'node:test';

import { ACTION_STAGES } from '../action-stages.mjs';

// The lowest standing jump among canonical fighters peaks about 66 px; a jump
// attack's hitbox extends that reach by roughly another 64 px.
const JUMP_ATTACK_REACH_PX = 110;

test('every objective a fighter must strike or touch sits within reach of a surface beneath it', () => {
  for (const stage of ACTION_STAGES) {
    for (const anchor of stage.objectiveAnchors) {
      if (!['object', 'orders', 'target', 'protected', 'prisoner', 'item-source'].includes(anchor.kind)) continue;
      const surfaces = [
        stage.groundY,
        ...stage.platforms.filter(({ left, right }) => left <= anchor.x && anchor.x <= right).map(({ y }) => y),
      ].filter((y) => y >= anchor.y);
      const gap = Math.min(...surfaces.map((y) => y - anchor.y));
      assert.ok(gap <= JUMP_ATTACK_REACH_PX, `${stage.id} ${anchor.id} floats ${gap} px above its nearest surface`);
    }
  }
});
