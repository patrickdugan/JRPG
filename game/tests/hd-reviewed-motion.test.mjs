import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  reviewedMotionFor,reviewedModeFromSearch,
  REVIEWED_MOTION_SCHEMA, REVIEWED_BOSSES,
} from '../hd-reviewed-motion.mjs';
import {createHdMotionRuntime} from '../hd-painted-motion.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const motion=JSON.parse(fs.readFileSync(path.join(ROOT,'game/assets/art/hd-painted-v1/motion-manifest.json'),'utf8'));
const PINS={
  'yearless-bell':'914bf7f42c7535f18e91177a29e5f6b6e7415e796739fe98e51c717c992e07e1',
  'lady-enma':'2c2e18d0486c4f10aa9d73f6c8d6ea13b85bde80bf7bc678b5d9786bbffc1a47',
};
const fileSha=(file)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function exampleManifest(){
  const entries={};
  for(const id of REVIEWED_BOSSES){
    const actor=motion.actors[id],source=actor.clipSet.windup;
    entries[id]={
      clip:'windup',path:'reviewed-motion/'+id+'/windup.webp',sha256:PINS[id],
      frameRGBAsha256:Array.from({length:24},(_,i)=>i.toString(16).padStart(64,'0')),
      sourceSheetSha256:actor.sourceSheetSha256,
      originalWindupSha256:source.sha256,
      originalActiveSha256:actor.clipSet.active.sha256,
      sourcePose:source.sourcePose,foot:source.foot,frameMs:source.frameMs,
      frames:24,columns:12,rows:2,cell:[192,192],width:2304,height:384,
      optIn:'art=hd&motion=reviewed',
      acceptance:'user-approved-clip-trial',bossVisualApproval:'pending',
    };
  }
  return {schema:REVIEWED_MOTION_SCHEMA,bossCount:2,clipCount:2,frameCount:48,
    mode:'explicit opt-in windup-only',entries};
}
const sourceFor=(id)=>({sha256:motion.actors[id].sourceSheetSha256,
  drawHeight:motion.actors[id].drawHeight,group:'enemy'});

test('reviewed mode is explicit and cannot alter classic or normal HD',()=>{
  assert.equal(reviewedModeFromSearch('?art=hd&motion=reviewed'),true);
  for(const query of ['','?art=hd','?art=hd&motion=0','?art=classic&motion=reviewed','?motion=reviewed'])
    assert.equal(reviewedModeFromSearch(query),false,query);
});

test('canonical source identities and phase timing match both pinned trial clips',()=>{
  const catalog=exampleManifest();
  for(const id of REVIEWED_BOSSES){
    const item=reviewedMotionFor(catalog,id,'windup',motion);
    assert.equal(item.path,'reviewed-motion/'+id+'/windup.webp');
    assert.equal(item.sha256,PINS[id]);
    assert.equal(item.frameMs,motion.actors[id].clipSet.windup.frameMs);
    assert.equal(item.sourcePose,motion.actors[id].clipSet.windup.sourcePose);
    assert.equal(item.reviewedMotion,true);
    assert.equal(reviewedMotionFor(catalog,id,'active',motion),null);
    assert.equal(reviewedMotionFor(catalog,id,'idle',motion),null);
  }
  assert.equal(reviewedMotionFor(catalog,'captain-kaji','windup',motion),null);
});

test('reviewed motion rejects alternate paths, changed originals, bad hashes and approval metadata',()=>{
  const catalog=exampleManifest();
  const failures=[
    c=>{c.entries['yearless-bell'].path='https://unsafe.test/a.webp';},
    c=>{c.entries['yearless-bell'].frameMs+=1;},
    c=>{c.entries['yearless-bell'].originalActiveSha256='f'.repeat(64);},
    c=>{c.entries['yearless-bell'].originalWindupSha256='e'.repeat(64);},
    c=>{c.entries['yearless-bell'].sourceSheetSha256='d'.repeat(64);},
    c=>{c.entries['yearless-bell'].frameRGBAsha256[23]=c.entries['yearless-bell'].frameRGBAsha256[22];},
    c=>{c.entries['yearless-bell'].bossVisualApproval='approved';},
    c=>{c.entries['yearless-bell'].optIn='art=hd';},
    c=>{c.entries['yearless-bell'].foot=[0,0];},
    c=>{c.entries['captain-kaji']={};},
    c=>{c.frameCount=50;},
  ];
  for(const mutate of failures){
    const copy=structuredClone(catalog);
    mutate(copy);
    assert.equal(reviewedMotionFor(copy,'yearless-bell','windup',motion),null);
  }
});

function fakeImage(path){
  const callbacks={};
  return {
    naturalWidth:2304,naturalHeight:384,
    addEventListener(event,cb){callbacks[event]=cb;},
    set src(value){
      path.push(value);
      queueMicrotask(()=>value.includes('fail-me')?callbacks.error?.():callbacks.load?.());
    },
  };
}
test('reviewed loader uses candidate only with opt-in and keeps canonical fallback',async()=>{
  const catalog=exampleManifest();
  const make=(enabled,overlay)=> {
    const urls=[],frames=[];
    const runtime=createHdMotionRuntime({
      enabled:true,reviewedMotionEnabled:enabled,
      fetchJson:async url=>url.endsWith('motion-manifest.json')?motion:overlay,
      createImage:()=>fakeImage(urls),
      onFrame:(id,clip,index,origin)=>frames.push({id,clip,index,origin}),
    });
    return {runtime,urls,frames};
  };
  let {runtime,urls,frames}=make(true,catalog);
  const reviewed=await runtime.request('yearless-bell','windup',sourceFor('yearless-bell'));
  assert.equal(reviewed.origin,'reviewed');
  assert.match(urls[0],/reviewed-motion\/yearless-bell\/windup\.webp$/);
  const actor={id:'yearless-bell',hp:100,active:true,grounded:true,facing:1,
    position:{x:120,y:220},movementIntent:{x:0},activeAttack:{phase:'windup'},
    activeManeuver:null,hitStunRemainingMs:0,staggerRemainingMs:0};
  const ctx={save(){},restore(){},translate(){},scale(){},drawImage(){}};
  assert.equal(runtime.draw(ctx,actor,'yearless-bell',sourceFor('yearless-bell'),
    {phaseProgress:.98,nowMs:140}),true);
  assert.deepEqual(frames.at(-1),{id:'yearless-bell',clip:'windup',index:23,origin:'reviewed'});
  const active=await runtime.request('yearless-bell','active',sourceFor('yearless-bell'));
  assert.equal(active.origin,'canonical');
  assert.match(urls[1],/motion\/yearless-bell\/active\.webp$/);
  const one=await runtime.request('captain-kaji','windup',sourceFor('captain-kaji'));
  assert.equal(one.origin,'canonical');
  assert.equal(runtime.cacheSize,3);
  ({runtime,urls}=make(false,catalog));
  assert.equal((await runtime.request('lady-enma','windup',sourceFor('lady-enma'))).origin,'canonical');
  assert.equal(urls.length,1);
  ({runtime}=make(true,{...catalog,frameCount:55}));
  assert.equal((await runtime.request('lady-enma','windup',sourceFor('lady-enma'))).origin,'canonical');
  ({runtime}=make(true,null));
  assert.equal((await runtime.request('yearless-bell','windup',sourceFor('yearless-bell'))).origin,'canonical');
});

test('installed clip assets are byte-identical to user-approved CI candidate receipts',()=>{
  const previewRoot=path.join(ROOT,'game/assets/art/hd-painted-v1/reviewed-motion');
  const manifest=JSON.parse(fs.readFileSync(path.join(previewRoot,'manifest.json'),'utf8'));
  assert.equal(manifest.schema,REVIEWED_MOTION_SCHEMA);
  assert.deepEqual(new Set(Object.keys(manifest.entries)),new Set(REVIEWED_BOSSES));
  for(const id of REVIEWED_BOSSES){
    const clip=reviewedMotionFor(manifest,id,'windup',motion);
    assert.ok(clip,id);
    assert.equal(fileSha(path.join(ROOT,'game/assets/art/hd-painted-v1',clip.path)),PINS[id]);
    assert.equal(clip.frameRGBAsha256.length,24);
  }
});


test('short active attacks prefetch canonical release art during reviewed boss windup',async()=>{
  const catalog=exampleManifest();
  const ctx={save(){},restore(){},translate(){},scale(){},drawImage(){}};
  const actor={id:'yearless-bell',hp:100,active:true,grounded:true,facing:1,
    position:{x:200,y:250},movementIntent:{x:0},
    activeAttack:{phase:'windup',elapsedMs:300},activeManeuver:null,
    staggerRemainingMs:0,hitStunRemainingMs:0};

  function make(reviewedMotionEnabled){
    const urls=[];
    const rt=createHdMotionRuntime({
      enabled:true,reviewedMotionEnabled,
      fetchJson:async url=>url.endsWith('/motion-manifest.json')?motion:catalog,
      createImage:()=>fakeImage(urls),
    });
    return {rt,urls};
  }
  const reviewed=make(true);
  const origin=sourceFor('yearless-bell');
  await reviewed.rt.request('yearless-bell','windup',origin);
  assert.equal(reviewed.rt.get('yearless-bell','active'),null);
  assert.equal(reviewed.rt.draw(ctx,actor,'yearless-bell',origin,
    {phaseProgress:.45,nowMs:300}),true);
  // Active is fetched before the short phase starts, without changing the
  // actor's activeAttack, source manifest, or the original frame timing.
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(reviewed.urls.some(url=>url.endsWith('/motion/yearless-bell/active.webp')),reviewed.urls);
  assert.equal(reviewed.rt.get('yearless-bell','active')?.origin,'canonical');
  assert.equal(reviewed.rt.get('yearless-bell','active')?.clip.frameMs,
    motion.actors['yearless-bell'].clipSet.active.frameMs);
  assert.equal(actor.activeAttack.phase,'windup');

  const canonical=make(false);
  await canonical.rt.request('yearless-bell','windup',origin);
  assert.equal(canonical.rt.draw(ctx,actor,'yearless-bell',origin,
    {phaseProgress:.45,nowMs:300}),true);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(canonical.rt.get('yearless-bell','active'),null);
  assert.ok(!canonical.urls.some(url=>url.endsWith('/motion/yearless-bell/active.webp')));

  const enma=make(true);
  const enmaActor={...actor,id:'lady-enma'};
  const enmaSource=sourceFor('lady-enma');
  await enma.rt.request('lady-enma','windup',enmaSource);
  enma.rt.draw(ctx,enmaActor,'lady-enma',enmaSource,{phaseProgress:.55,nowMs:450});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(enma.rt.get('lady-enma','active')?.origin,'canonical');
});
