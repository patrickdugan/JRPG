import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=path.resolve(import.meta.dirname,'../..');
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/art/roster-keystone/roster.json'),'utf8'));
const IDs=['ujiro','bell-warden-chiyo','lady-enma','yearless-bell'];
const sha=/^[a-f0-9]{64}$/;
function readIntake(id){
  return JSON.parse(fs.readFileSync(path.join(ROOT,'assets/art/roster-keystone',id+'-hd-intake.json'),'utf8'));
}
test('four canonical names have independent six-pose and 240-cell receipts',()=>{
  assert.equal(new Set(IDs).size,4);
  for(const id of IDs){
    const rows=ledger.identities.filter(x=>x.id===id&&x.kind==='named-boss');
    assert.equal(rows.length,1,id);
    const row=rows[0],intake=readIntake(id);
    assert.equal(intake.bossId,id);
    assert.equal(intake.poses.length,6);
    assert.equal(intake.motion.clipCount,10);
    assert.equal(intake.motion.framesPerClip,24);
    assert.equal(intake.motion.frameCount,240);
    assert.match(intake.sourceSha256,sha);
    assert.match(intake.sixKeyAtlasSha256,sha);
    assert.equal(intake.sourceSha256,row.hdBossBodyCandidate.sourceSha256);
    assert.equal(intake.sixKeyAtlasSha256,row.hdBossBodyCandidate.sixKeySheetSha256);
    assert.equal(intake.binarySourceInGit,row.assetInGit);
    assert.equal(row.visualApproval,'pending');
    assert.equal(intake.reviewStatus,'manual-visual-approval-pending');
    assert.ok(fs.existsSync(path.join(ROOT,'game/assets/art/boss-animation-suite-v2',id+'.json')),id);
  }
});
test('low-resolution sources are labeled and never promoted to individual painted masters',()=>{
  assert.equal(readIntake('ujiro').figureSourcePixels[0],512);
  assert.equal(readIntake('lady-enma').figureSourcePixels[0],512);
  assert.equal(ledger.identities.find(x=>x.id==='lady-enma').hdBossBodyCandidate.sourceQuality,'individual-high-resolution-rgb-matted');
  for(const id of IDs.filter(x=>!['ujiro','lady-enma'].includes(x))){
    assert.equal(readIntake(id).figureSourcePixels[0],128,id);
    assert.equal(ledger.identities.find(x=>x.id===id).hdBossBodyCandidate.sourceQuality,'small-comparison-extraction');
  }
});
test('total new review batch is exactly 40 clips and 960 frames',()=>{
  assert.deepEqual(ledger.knownPackage.bossFinalFour.motionClips,40);
  assert.deepEqual(ledger.knownPackage.bossFinalFour.frameCount,960);
  assert.equal(ledger.targets.allIdentities,62);
  assert.equal(ledger.targets.regularEnemies,28);
  assert.equal(ledger.targets.additionalBosses,7);
});
