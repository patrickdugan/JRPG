import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HD_ART_SCHEMA, HD_FRAME_SIZE, createHdPaintedArtRuntime,
  getHdArtMode, resolveHdActorId, selectHdPose, hdPaintedDrawPlan, validateHdArtManifest
} from '../hd-painted-animation.mjs';
const rec=(group='enemy')=>({file:'sheets/cinder-hound.png',width:2304,height:384,
  foot:[192,368],drawHeight:138,facing:'right',group,
  poses:['idle','move','windup','active','hurt','defeat'],sha256:'f'.repeat(64)});
const manifest=()=>({schema:HD_ART_SCHEMA,frameCount:6,actors:{'cinder-hound':rec()}});
const actor=(extra={})=>({hp:10,active:true,grounded:true,facing:-1,
  movementIntent:{x:0},position:{x:130,y:420},...extra});

test('HD mode requires query opt-in and sheet IDs stay local',()=>{
  assert.equal(getHdArtMode('?encounter=c1-cinder-hounds'),'classic');
  assert.equal(getHdArtMode('?encounter=c1-cinder-hounds&art=hd'),'hd');
  assert.equal(resolveHdActorId('nikola'),'lise');
  assert.equal(resolveHdActorId('miyo-senda'),'miyo');
  assert.equal(resolveHdActorId('../../.env'),null);
});
test('strict manifest validation',()=>{
  assert.equal(validateHdArtManifest(manifest()).ok,true);
  const wrong=manifest();wrong.actors['cinder-hound'].file='../secret.png';
  assert.equal(validateHdArtManifest(wrong).ok,false);
  const size=manifest();size.actors['cinder-hound'].width=0;
  assert.equal(validateHdArtManifest(size).ok,false);
  const hash=manifest();hash.actors['cinder-hound'].sha256='broken';
  assert.equal(validateHdArtManifest(hash).ok,false);
  assert.equal(validateHdArtManifest({schema:HD_ART_SCHEMA,frameCount:6,actors:{}}).ok,false);
});
test('fixed-step combat phases select the six painted keys',()=>{
  const r=rec();
  assert.equal(selectHdPose(actor(),r),0);
  assert.equal(selectHdPose(actor({movementIntent:{x:1}}),r),1);
  assert.equal(selectHdPose(actor({activeAttack:{phase:'windup'}}),r),2);
  assert.equal(selectHdPose(actor({activeAttack:{phase:'active'}}),r),3);
  assert.equal(selectHdPose(actor({hitStunRemainingMs:100}),r),4);
  assert.equal(selectHdPose(actor({hp:0}),r),5);
  assert.equal(selectHdPose(actor({activeAttack:{phase:'recovery'}}),r),0);
  assert.equal(selectHdPose(actor(),{...r,group:'boss-study'}),null);
  assert.equal(selectHdPose(actor({hitStunRemainingMs:100}),rec('party')),5);
  assert.equal(selectHdPose(actor({activeAttack:{phase:'recovery'}}),rec('party')),4);
});
test('draw planning preserves world-space foot anchor and facing',()=>{
  const p=hdPaintedDrawPlan(actor(),rec(),3);
  assert.equal(p.sx,3*HD_FRAME_SIZE);
  assert.equal(p.anchorX,130);assert.equal(p.anchorY,420);
  assert.equal(p.flip,true);assert.equal(p.dw,138);
  assert.equal(p.dy,-368*138/384);
  assert.equal(hdPaintedDrawPlan(actor(),rec(),7),null);
});
test('ready async art is drawn without mutating the actor, missing art falls back',async()=>{
  const states=[];
  const rt=createHdPaintedArtRuntime({enabled:true,fetchJson:async()=>manifest(),
    createImage:()=>({naturalWidth:2304,naturalHeight:384,
      addEventListener(n,cb){if(n==='load')this.done=cb;},
      set src(value){queueMicrotask(()=>this.done?.());}}),
    onChange:(id,state)=>states.push([id,state]),
  });
  const ctx={save(){},restore(){},translate(){},scale(){},
    drawImage(){this.draws=(this.draws||0)+1}};
  const a=actor(),before=JSON.stringify(a);
  assert.equal(rt.draw(ctx,a,'cinder-hound'),false);
  await rt.request('cinder-hound');
  assert.equal(rt.status('cinder-hound'),'ready');
  assert.equal(rt.draw(ctx,a,'cinder-hound'),true);
  assert.equal(ctx.draws,1);assert.equal(JSON.stringify(a),before);
  assert.deepEqual(states,[['cinder-hound','loading'],['cinder-hound','ready']]);
  await rt.request('missing');
  assert.equal(rt.draw(ctx,a,'missing'),false);
});
test('bad dimensions and disabled mode retain the classic fallback',async()=>{
  const rt=createHdPaintedArtRuntime({enabled:true,fetchJson:async()=>manifest(),
    createImage:()=>({naturalWidth:5,naturalHeight:5,
      addEventListener(n,cb){if(n==='load')this.done=cb;},
      set src(value){queueMicrotask(()=>this.done?.());}}),
  });
  await rt.request('cinder-hound');
  assert.equal(rt.status('cinder-hound'),'wrong-size');
  assert.equal(rt.draw({},actor(),'cinder-hound'),false);
  const off=createHdPaintedArtRuntime({enabled:false,fetchJson:()=>{throw Error('no fetch')},
    createImage:()=>{throw Error('no image')}});
  assert.equal(off.draw({},actor(),'cinder-hound'),false);
  assert.equal(off.status('cinder-hound'),'off');
});
