import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HD_BOSS_VFX_NAMES,
  HD_BOSS_VFX_SCHEMA,
  validateHdBossVfxManifest,
  selectHdBossVfx,
  hdBossVfxDrawPlan,
  createHdBossVfxRuntime,
} from '../hd-boss-vfx.mjs';

const sha=n=>n.toString(16).padStart(64,'0');
const sampleManifest=()=>({
  schema:HD_BOSS_VFX_SCHEMA,
  gameplayAuthority:'none',frameSize:[256,256],framesPerStage:12,
  stageCount:12,totalCells:144,
  bosses:Object.fromEntries(HD_BOSS_VFX_NAMES.map((id,i)=>[
    id,{
      label:id,strike:'Strike',signature:'Signature',
      stages:Object.fromEntries(['windup','active'].map((stage,j)=>[
        stage,{file:id+'-'+stage+'.png',sha256:sha(i*2+j+1),
          frames:12,cell:[256,256],dimensions:[3072,256],
          decodedFrameSHA256:Array.from({length:12},(_,k)=>sha(i*40+j*12+k+30))}
      ])),
    },
  ])),
});
const actor=(overrides={})=>({
  id:'boss#1',faction:'enemy',hp:10,active:true,staggerRemainingMs:0,hitStunRemainingMs:0,
  facing:1,position:{x:400,y:390},
  activeAttack:{attackId:'enemy:furnace-abbot:forge-sermon',phase:'windup'},...overrides,
});

test('keystone bosscast has exactly six HD presentation effect identities',()=>{
  assert.deepEqual(HD_BOSS_VFX_NAMES,[
    'widow-of-fog','furnace-abbot','ujiro','bell-warden-chiyo','lady-enma','yearless-bell',
  ]);
  assert.deepEqual(validateHdBossVfxManifest(sampleManifest()),{ok:true,reason:'ok'});
});

test('manifest requires source-hashed unique frames, canonical IDs and exact geometry',()=>{
  const a=sampleManifest();
  a.bosses['widow-of-fog'].stages.windup.dimensions=[3073,256];
  assert.equal(validateHdBossVfxManifest(a).ok,false);
  a.bosses['widow-of-fog'].stages.windup.dimensions=[3072,256];
  a.bosses['widow-of-fog'].stages.windup.decodedFrameSHA256[1]=a.bosses['widow-of-fog'].stages.windup.decodedFrameSHA256[0];
  assert.equal(validateHdBossVfxManifest(a).ok,false);
  assert.equal(validateHdBossVfxManifest({...sampleManifest(),totalCells:143}).ok,false);
});

test('only actual windup or attack phase renders; no fabricated combat states',()=>{
  for(const id of HD_BOSS_VFX_NAMES){
    assert.deepEqual(selectHdBossVfx(id,actor(),{phaseProgress:0}).stage,'windup');
    assert.deepEqual(selectHdBossVfx(id,actor({activeAttack:{phase:'active'}}),{phaseProgress:.5}).frame,6);
    assert.equal(selectHdBossVfx(id,actor({activeAttack:{phase:'recovery'}})),null);
    assert.equal(selectHdBossVfx(id,actor({activeAttack:null})),null);
    assert.equal(selectHdBossVfx(id,actor({hp:0})),null);
    assert.equal(selectHdBossVfx(id,actor({staggerRemainingMs:180})),null);
    assert.equal(selectHdBossVfx(id,actor({faction:'player'})),null);
  }
  assert.equal(selectHdBossVfx('cinder-hound',actor()),null);
  assert.equal(selectHdBossVfx('kurozane',actor()),null);
});

test('phase progress clamps safely; reduced-motion uses stable telegraphs',()=>{
  assert.equal(selectHdBossVfx('ujiro',actor(),{phaseProgress:-10}).frame,0);
  assert.equal(selectHdBossVfx('ujiro',actor(),{phaseProgress:10}).frame,11);
  assert.equal(selectHdBossVfx('ujiro',actor(),{reducedMotion:true}).frame,11);
  assert.equal(selectHdBossVfx('ujiro',actor({activeAttack:{phase:'active'}}),{reducedMotion:true}).frame,9);
});

test('effect image anchoring never edits world location or sprite hurtbox',()=>{
  const a=actor({facing:-1});
  const before=JSON.stringify(a);
  const selection=selectHdBossVfx('furnace-abbot',a,{phaseProgress:1});
  const plan=hdBossVfxDrawPlan(a,selection);
  assert.equal(plan.sx,11*256);
  assert.equal(plan.sy,0);
  assert.equal(plan.flip,true);
  assert.equal(plan.anchorX,400);
  assert.equal(plan.anchorY,390);
  assert.deepEqual(JSON.stringify(a),before);
  assert.equal(hdBossVfxDrawPlan(a,null),null);
});

test('runtime lazy-loads, dimension-checks and falls back on absence',async()=>{
  const loaded=[],status=[],render=[];
  class FakeImage{
    naturalWidth=3072;naturalHeight=256;
    handlers={};
    addEventListener(name,cb){this.handlers[name]=cb;}
    set src(value){loaded.push(value);this.handlers.load();}
  }
  const runtime=createHdBossVfxRuntime({
    enabled:true,
    fetchJson:async()=>sampleManifest(),
    createImage:()=>new FakeImage(),
    onChange:(...r)=>status.push(r),
    onFrame:(...r)=>render.push(r),
  });
  const calls=[];
  const ctx={
    save(){calls.push('save')},restore(){calls.push('restore')},
    translate(){calls.push('translate')},scale(){calls.push('scale')},
    drawImage(){calls.push('drawImage')},
  };
  assert.equal(runtime.draw(ctx,actor(),'furnace-abbot'),false);
  const entry=await runtime.request('furnace-abbot','windup');
  assert.ok(entry);
  assert.equal(loaded.length,1);
  assert.equal(runtime.draw(ctx,actor(),'furnace-abbot',{phaseProgress:.4}),true);
  assert.equal(calls.filter(x=>x==='drawImage').length,1);
  assert.deepEqual(render[0],['furnace-abbot','windup',4]);
  assert.deepEqual(status.at(-1),['furnace-abbot','windup','ready']);
  assert.equal(runtime.draw(ctx,actor({activeAttack:null}),'furnace-abbot'),false);
});

test('disabled runtime never fetches or changes canvas',async()=>{
  let fetched=0;
  const runtime=createHdBossVfxRuntime({
    enabled:false,fetchJson:async()=>{fetched++;return sampleManifest();},
    createImage:()=>({}),
  });
  const data=await runtime.request('furnace-abbot','windup');
  assert.equal(data,null);
  assert.equal(runtime.status,'off');
  assert.equal(fetched,0);
});
