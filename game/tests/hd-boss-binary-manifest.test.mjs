import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
const ROOT=path.resolve(import.meta.dirname,'../..');
const m=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/art/hd-boss-binary-import-v1/manifest.json'),'utf8'));
test('three premium boss sources are committed in Git chunks below 1.5 MiB',()=>{
  assert.equal(m.schema,'jrpg-hd-boss-binary-archives/1');
  assert.equal(m.readyForImport,true);
  assert.deepEqual(Object.keys(m.packages).sort(),['bell-warden-chiyo','lady-enma','yearless-bell']);
  assert.equal(Object.values(m.packages).reduce((n,p)=>n+p.bytes,0),36623667);
  assert.equal(Object.values(m.packages).reduce((n,p)=>n+p.parts.length,0),26);
  for(const [boss,p] of Object.entries(m.packages)){
    assert.match(p.sha256,/^[a-f0-9]{64}$/);
    assert.ok(p.archive.startsWith('JRPG_HD_Boss_')&&p.archive.endsWith('_v2.zip'));
    assert.equal(p.parts.reduce((n,c)=>n+c.bytes,0),p.bytes);
    for(const part of p.parts){
      assert.match(part.gitBlobSHA1,/^[a-f0-9]{40}$/);
      assert.ok(part.bytes>0&&part.bytes<=1500000);
      const file=path.join(ROOT,part.path);
      assert.ok(fs.existsSync(file),boss+' '+part.path);
      assert.equal(fs.statSync(file).size,part.bytes);
    }
  }
});
