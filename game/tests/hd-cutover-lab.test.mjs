import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  BOSSES,CUTOVER_SCHEMA,HASH,atlasRect,timelinePhase,stepFrame,
  validateCatalog,extractCandidateReceipt,reviewWindow,readDraft,exportReviewReceipt,
} from '../hd-cutover-lab-contract.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const json=path=>JSON.parse(readFileSync(root+path,'utf8'));
const keys=json('game/assets/art/hd-painted-v1/manifest.json');
const motion=json('game/assets/art/hd-painted-v1/motion-manifest.json');
const roster=json('assets/art/roster-keystone/roster.json');

test('both original bosses load exact pending 24-frame windup and active clips',()=>{
  assert.deepEqual(validateCatalog(keys,motion,roster),
    {bosses:2,sourceClips:4,sourceFrames:96,approval:'pending'});
  assert.equal(BOSSES.length,2);
  for(const b of BOSSES) {
    const row=roster.identities.find(x=>x.id===b.id);
    assert.equal(row.visualApproval,'pending');
    assert.equal(row.assetInGit,true);
    assert.equal(motion.actors[b.id].clipSet.active.frames,24);
  }
});

test('frame sampling exactly crosses windup last frame into active first',()=>{
  const c=motion.actors['yearless-bell'].clipSet;
  assert.deepEqual(atlasRect(0),{x:0,y:0,w:192,h:192});
  assert.deepEqual(atlasRect(23),{x:2112,y:192,w:192,h:192});
  assert.deepEqual(timelinePhase(23,c),{phase:'windup',frame:23,frameNumber:24,frameMs:c.windup.frameMs});
  assert.deepEqual(timelinePhase(24,c),{phase:'active',frame:0,frameNumber:1,frameMs:c.active.frameMs});
  assert.throws(()=>timelinePhase(48,c),RangeError);
  assert.throws(()=>atlasRect(-1),RangeError);
  assert.deepEqual(reviewWindow('cutover'),{min:20,max:27});
  assert.deepEqual(reviewWindow('full'),{min:0,max:47});
  assert.equal(stepFrame(23,1,reviewWindow('cutover')),24);
  assert.equal(stepFrame(27,1,reviewWindow('cutover')),20);
  assert.equal(stepFrame(20,-1,reviewWindow('cutover')),27);
});

test('receipt accepts both CI candidate schemas and preserves active source identity',()=>{
  const bossId='lady-enma';
  const hashes=Array.from({length:24},(_,i)=>i.toString(16).padStart(64,'0'));
  const source=motion.actors[bossId].clipSet;
  const receiptA={schema:'jrpg-hd-boss-two-windup-studies/1',candidates:{
    [bossId]:{
      candidateWebPSha256:'a'.repeat(64),candidateFrameRGBAsha256:hashes,
      originalWindupWebPSha256:source.windup.sha256,
    }
  }};
  const v=extractCandidateReceipt(receiptA,bossId,motion);
  assert.equal(v.candidateHash,'a'.repeat(64));
  assert.equal(v.originalActiveHash,source.active.sha256);
  assert.equal(v.frameRGBAsha256.length,24);
  const receiptB={schema:'jrpg-hd-boss-attack-effect-leadin/1',bosses:{
    [bossId]:{leadInWebPSha256:'b'.repeat(64),decodedFrameHashes:hashes,
      immutableActiveSha256:source.active.sha256}
  }};
  assert.equal(extractCandidateReceipt(receiptB,bossId,motion).candidateHash,'b'.repeat(64));
  receiptB.bosses[bossId].immutableActiveSha256='f'.repeat(64);
  assert.throws(()=>extractCandidateReceipt(receiptB,bossId,motion),/Active attack source/);
  receiptB.bosses[bossId].immutableActiveSha256=source.active.sha256;
  receiptB.bosses[bossId].decodedFrameHashes[23]=receiptB.bosses[bossId].decodedFrameHashes[22];
  assert.throws(()=>extractCandidateReceipt(receiptB,bossId,motion),/decoded frame receipts/);
});

test('review-only local notes cannot assign approval and screenshot receipt binds exact clip',()=>{
  const draft=readDraft({entries:{
    'yearless-bell':{decision:'ready-for-human-signoff',note:'Check hinge'},
    'other-boss':{decision:'ready-for-human-signoff',note:'Injected'},
  }});
  assert.deepEqual(Object.keys(draft.entries),BOSSES.map(x=>x.id));
  assert.equal(draft.entries['lady-enma'].decision,'unreviewed');
  assert.equal(Object.hasOwn(draft.entries,'other-boss'),false);
  const a=motion.actors['yearless-bell'].clipSet;
  const receipt=exportReviewReceipt({
    bossId:'yearless-bell',index:24,mode:'cutover',backdrop:'checker',speed:.5,
    clipSet:a,candidate:{candidateHash:'a'.repeat(64),schema:'candidate',
      frameRGBAsha256:Array.from({length:24},(_,i)=>i.toString(16).padStart(64,'0'))},
    notes:{decision:'needs-keys',note:'Articulated release missing'},
    screenshotSha256:'f'.repeat(64),
  });
  assert.equal(receipt.schema,CUTOVER_SCHEMA);
  assert.equal(receipt.phase.phase,'active');
  assert.equal(receipt.phase.frameNumber,1);
  assert.equal(receipt.originalActiveSha256,a.active.sha256);
  assert.equal(receipt.canonicalVisualApproval,'pending');
  assert.equal(receipt.humanReview.decision,'needs-keys');
  assert.ok(HASH.test(receipt.screenshotSha256));
  assert.equal(receipt.evidenceType,'review-only-browser-capture');
});
