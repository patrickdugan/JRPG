import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTION_COMBAT_PACING_CASES,
  runActionCombatPacingAudit,
} from '../action-combat-pacing-audit.mjs';

test('opening action encounters survive long enough to teach without becoming attrition walls', () => {
  const audit = runActionCombatPacingAudit();
  assert.equal(audit.encounters.length, ACTION_COMBAT_PACING_CASES.length);
  assert.equal(audit.passed, true, audit.violations.join('\n'));
  for (const encounter of audit.encounters) {
    assert.equal(encounter.outcome, 'victory');
    assert.ok(encounter.hitCount > 0, `${encounter.encounterId} never produced contact`);
    assert.ok(encounter.attackStartCount > 0, `${encounter.encounterId} never began an attack`);
  }
});
