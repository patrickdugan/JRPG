import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  HD_MOTION_SCHEMA,HD_MOTION_CLIPS,validateHdMotionManifest,
  selectHdMotionClip,selectHdMotionFrame,hdMotionDrawPlan,createHdMotionRuntime,
} from '../hd-painted-motion.mjs';
function record(){return {group:'party',drawHeight:124,foot:[192,368],sha256:'a'.repeat(64),facing:'right'}}
function f(changes={}){return {id:'ren',hp:100,active:true,grounded:true,facing:1,
  position:{x:200,y:300},movementIntent:{x:0},activeAttack:null,activeManeuver:null,
  staggerRemainingMs:0,hitStunRemainingMs:0,...changes}}
function clip(id){return {path:'motion/ren/'+id+'.webp',frames:24,columns:12,rows:2,
  width:2304,height:384,cell:[192,192],foot:[96,184],sourcePose:1,uniqueFrames:24,
  frameMs:40,sha256:'b'.repeat(64),
  frameRGBAsha256:Array.from({length:24},(_,i)=>String(i).padStart(64,'0'))}}
function manifest(){return {schema:HD_MOTION_SCHEMA,sourceSchema:'bbc-hd-painted/1',
 frameCount:24,motionClipCount:10,frameTotal:240,actors:{
 ren:{...record(),sourceSheetSha256:'a'.repeat(64),sourceFile:'sheets/ren.png',
 clipSet:Object.fromEntries(HD_MOTION_CLIPS.map(id=>[id,clip(id)]))}}}}
test('rigid source identity, 24-frame atlas geometry, and distinct frame hashes',()=>{
  const m=manifest();
  assert.deepEqual(validateHdMotionManifest(m),{ok:true,reason:'ok'});
  assert.equal(validateHdMotionManifest({...m,frameCount:6}).ok,false);
  const changed=structuredClone(m);
  changed.actors.ren.clipSet.active.path='https://outside.test/art.webp';
  assert.equal(validateHdMotionManifest(changed).ok,false);
  const changedHash=structuredClone(m);
  changedHash.actors.ren.clipSet.active.frameRGBAsha256[23]=changedHash.actors.ren.clipSet.active.frameRGBAsha256[22];
  assert.equal(validateHdMotionManifest(changedHash).ok,false);
});
test('simulator snapshot selects phase poses with interrupt and defeat priority',()=>{
  const r=record();
  assert.equal(selectHdMotionClip(f(),r).clip,'idle');
  assert.equal(selectHdMotionClip(f({movementIntent:{x:-1}}),r).clip,'locomotion');
  assert.equal(selectHdMotionClip(f({activeManeuver:{id:'guard'}}),r).clip,'guard');
  assert.equal(selectHdMotionClip(f({activeManeuver:{id:'uppercut',elapsedMs:200}}),r).clip,'signature');
  for(const phase of ['windup','active','recovery']){
    const s=selectHdMotionClip(f({activeAttack:{phase}}),r,{phaseProgress:.53});
    assert.equal(s.clip,phase);
    assert.equal(selectHdMotionFrame(s,clip(phase)),12);
  }
  assert.equal(selectHdMotionClip(f({activeAttack:{phase:'windup'},hitStunRemainingMs:50}),r).clip,'hurt');
  assert.equal(selectHdMotionClip(f({staggerRemainingMs:300}),r).clip,'stagger');
  assert.equal(selectHdMotionClip(f({hp:0}),r).clip,'defeat');
  assert.equal(selectHdMotionClip(f(),{...r,group:'boss-study'}),null);
  assert.equal(selectHdMotionClip(f(),{...r,group:'boss-study'},{bossForm:3}).clip,'form-03');
});
test('frame sampling aligns 12x2 source atlas to the original foot and respects reduced motion',()=>{
  const s=selectHdMotionClip(f(),record());
  assert.equal(selectHdMotionFrame(s,clip('idle'),{nowMs:400}),10);
  assert.equal(selectHdMotionFrame(s,clip('idle'),{nowMs:960}),0);
  const p=selectHdMotionClip(f({activeAttack:{phase:'active'}}),record(),{phaseProgress:1,reducedMotion:true});
  assert.equal(selectHdMotionFrame(p,clip('active')),11);
  const defeat=selectHdMotionClip(f({hp:0}),record());
  assert.equal(selectHdMotionFrame(defeat,clip('defeat'),{defeatAgeMs:1000}),23);
  const place=hdMotionDrawPlan(f({facing:-1,position:{x:500,y:470}}),record(),clip('idle'),23);
  assert.deepEqual([place.sx,place.sy,place.sw,place.sh],[2112,192,192,192]);
  assert.equal(place.dy,-184*(124/192));assert.equal(place.flip,true);
});
test('lazy clip loader uses painted fallback for missing or unverified motion',async()=>{
  const draws=[];const m=manifest();let count=0;
  const fakeImage=()=>{count++;const events={};
    return {naturalWidth:2304,naturalHeight:384,
      addEventListener(name,fn){events[name]=fn},
      set src(url){queueMicrotask(()=>events.load?.())}}
  };
  const loader=createHdMotionRuntime({enabled:true,fetchJson:async()=>m,createImage:fakeImage});
  const ctx={save(){},restore(){},translate(){},scale(){},drawImage(...args){draws.push(args)}};
  assert.equal(loader.draw(ctx,f(),'ren',record(),{nowMs:240}),false);
  await loader.request('ren','idle',record());
  assert.equal(loader.draw(ctx,f(),'ren',record(),{nowMs:240}),true);
  assert.equal(draws[0][1],1152);
  assert.equal(loader.cacheSize,1);assert.equal(count,1);
  assert.equal(loader.draw(ctx,f({activeAttack:{phase:'windup'}}),'ren',record(),{phaseProgress:.5}),false);
  await loader.request('ren','windup',record());
  assert.equal(loader.draw(ctx,f({activeAttack:{phase:'windup'}}),'ren',record(),{phaseProgress:.5}),true);
  const wrong=createHdMotionRuntime({enabled:true,fetchJson:async()=>m,createImage:fakeImage});
  assert.equal(await wrong.request('ren','idle',{...record(),sha256:'f'.repeat(64)}),null);
  assert.equal(wrong.cacheSize,0);
  const missing=createHdMotionRuntime({enabled:true,fetchJson:async()=>{throw Error('404')},createImage:fakeImage});
  assert.equal(await missing.request('ren','idle',record()),null);
  assert.match(missing.disabledReason,/404/);
});
