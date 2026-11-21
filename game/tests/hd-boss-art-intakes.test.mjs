import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const base=fileURLToPath(new URL('../../',import.meta.url));
const load=path=>JSON.parse(readFileSync(base+path,'utf8'));
const ledger=load('assets/art/roster-keystone/roster.json');
const byId=Object.fromEntries(ledger.identities.map(x=>[x.id,x]));

test('three premium boss animation candidate receipts are indexed by canonical boss ID',()=>{
  for(const id of ['captain-kaji','widow-of-fog','furnace-abbot']){
    const row=byId[id],p='assets/art/roster-keystone/'+id+'-hd-intake.json';
    assert.ok(existsSync(base+p),id);
    const receipt=load(p);
    assert.equal(receipt.bossId,id);
    assert.equal(row.kind,'named-boss');
    assert.equal(row.paintedKeyArt,row.assetInGit?'candidate-in-Git':'candidate-in-ZIP');
    assert.equal(row.sixKeyCelSheet,row.assetInGit?'candidate-in-Git':'candidate-in-ZIP');
    assert.equal(row.hdMotion24,row.assetInGit?'candidate-in-Git':'candidate-in-ZIP');
    if (id==='captain-kaji') assert.equal(row.reviewPackage,'JRPG_HD_Boss_CaptainKaji_v1.zip');
    else assert.equal(row.paintedCandidateReceipt,p);
    assert.equal(typeof row.assetInGit,'boolean');
    assert.equal(receipt.binarySourceInGit,row.assetInGit);
    assert.match(receipt.sourceSha256,/^[a-f0-9]{64}$/);
    assert.match(receipt.sixKeyAtlasSha256,/^[a-f0-9]{64}$/);
    assert.equal(receipt.sourceResolution[0],1536);
    assert.equal(receipt.sourceResolution[1],1024);
    assert.equal(receipt.motion.decodedHashesVerified ?? receipt.motion.decodedFrameHashesVerified,true);
    assert.match(receipt.visualApproval ?? receipt.reviewStatus,/pending/,id);
  }
});

test('final four named bosses have review-only body candidates with explicit provenance',()=>{
  for(const id of ['ujiro','bell-warden-chiyo','lady-enma','yearless-bell']){
    const row=byId[id],p='assets/art/roster-keystone/'+id+'-hd-intake.json';
    assert.ok(row && row.kind==='named-boss',id);
    assert.ok(existsSync(base+p),id);
    const receipt=load(p);
    assert.equal(receipt.bossId,id);
    assert.equal(row.paintedKeyArt,row.assetInGit?'candidate-in-Git':'candidate-in-ZIP');
    assert.equal(row.hdMotion24,row.assetInGit?'candidate-in-Git':'candidate-in-ZIP');
    assert.equal(receipt.binarySourceInGit,row.assetInGit);
    assert.equal(receipt.motion.clipCount,10);
    assert.equal(receipt.motion.frameCount,240);
    assert.equal(row.visualApproval,'pending');
    assert.match(receipt.qualityNote,id==='ujiro'?/Standalone six-pose/:id==='lady-enma'?/Individual full-resolution/:/premium/);
    assert.match(row.hdBossBodyCandidate.sourceSha256,/^[a-f0-9]{64}$/);
  }
});

test('source-authoring VFX and premium painted bodies remain independent statuses',()=>{
  for(const id of ['widow-of-fog','furnace-abbot','ujiro','bell-warden-chiyo','lady-enma','yearless-bell']){
    const row=byId[id];
    assert.equal(row.hdBossVfx.gameplayAuthority,false);
    assert.equal(row.hdBossVfx.bodyPaintingApproved,false);
    assert.deepEqual(row.hdBossVfx.stages,['windup','active']);
    assert.equal(row.hdBossVfx.optIn,'?art=hd');
  }
});

test('source-binary installer caps commits and rejects default branch',()=>{
  const content=readFileSync(base+'game/tools/import-hd-boss-pack.py','utf8');
  assert.match(content,/MAX_COMMIT_BYTES=90\*1024\*1024/);
  assert.match(content,/head in \{'main','master'\}/);
  assert.match(content,/frameRGBAsha256/);
  assert.match(content,/Existing art conflicts/);
  assert.match(content,/--push/);
});
