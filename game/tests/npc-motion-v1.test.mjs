import test from 'node:test';
import assert from 'node:assert/strict';
import { NPC_FIELD_ROLES } from '../npc-field-atlas.mjs';
import {
  NPC_MOTION_SCHEMA,NPC_MOTION_CLIPS,NPC_MOTION_FRAMES,
  validateNpcMotionManifest,selectNpcMotion,npcMotionPlan,createNpcMotionRuntime,
} from '../npc-motion-v1.mjs';

const sha=(n)=>n.toString(16).padStart(64,'0');
const fixture=()=>({
 schema:NPC_MOTION_SCHEMA,
 sourceAsset:'npc-field-suite-v1',sourceAtlasSha256:sha(2),
 gameplayAuthority:'none',
 roleCount:16,clipCount:96,frameCount:2304,framesPerClip:24,
 cell:[128,192],roleOrder:[...NPC_FIELD_ROLES],clipOrder:[...NPC_MOTION_CLIPS],
 roles:Object.fromEntries(NPC_FIELD_ROLES.map((id,j)=>[id,{
   canonicalSourceColumn:j,paletteId:'npc-role-'+id,
   clips:Object.fromEntries(NPC_MOTION_CLIPS.map((clip,k)=>[clip,{
     file:'motion/'+id+'/'+clip+'.webp',sha256:sha(j*100+k+4),
     frames:24,frameMs:40,columns:12,rows:2,
     cell:[128,192],dimensions:[1536,384],
     frameRGBAsha256:Array.from({length:24},(_,i)=>sha(100+j*200+k*30+i)),
   }])),
 }])),
});

test('exactly sixteen authorized role IDs and six motion clips',()=>{
 assert.equal(NPC_FIELD_ROLES.length,16);
 assert.equal(NPC_MOTION_CLIPS.length,6);
 assert.equal(NPC_MOTION_FRAMES,24);
 assert.deepEqual(validateNpcMotionManifest(fixture()),{ok:true,reason:'ok'});
});

test('wrong role order, wrong frame geometry and duplicated pixels fail closed',()=>{
 const x=fixture();
 x.roleOrder.reverse();
 assert.equal(validateNpcMotionManifest(x).ok,false);
 const y=fixture();
 y.roles['speaker'].clips.idle.dimensions=[1535,384];
 assert.equal(validateNpcMotionManifest(y).ok,false);
 const z=fixture();
 const c=z.roles['courier'].clips.walk.frameRGBAsha256;
 c[1]=c[0];
 assert.equal(validateNpcMotionManifest(z).ok,false);
});

test('unknown role and prose-like labels cannot acquire an NPC animation',()=>{
 for(const role of [null,'unknown','an interviewee','ferry captain','sacred shrine','the trader']){
   assert.equal(selectNpcMotion(role),null);
 }
 assert.equal(selectNpcMotion('speaker','south-idle').clip,'idle');
 assert.equal(selectNpcMotion('speaker','south-gesture').clip,'talk');
 assert.equal(selectNpcMotion('courier','south-idle',{clip:'walk'}).clip,'walk');
 assert.equal(selectNpcMotion('courier','south-idle',{clip:'invalid'}),null);
});

test('reduced motion freezes on frame zero, drawing keeps the foot anchor',()=>{
 assert.equal(selectNpcMotion('resident','south-gesture',{nowMs:200,reducedMotion:true}).frame,0);
 const sel=selectNpcMotion('resident','south-idle',{nowMs:375});
 const plan=npcMotionPlan(sel,{}, {anchorX:204,footY:311,drawHeight:68,facing:'left'});
 assert.equal(plan.anchorX,204);
 assert.equal(plan.anchorY,311);
 assert.equal(plan.sw,128);
 assert.equal(plan.sh,192);
 assert.equal(plan.flip,true);
 assert.ok(Math.abs(plan.dw - (68*128/192)) < 1e-10);
 assert.equal(npcMotionPlan(null,{}),null);
});

test('lazy loader validates manifest and decoded image geometry before drawing',async()=>{
 let fetchCount=0;
 class ImageStub{
   handlers={}; naturalWidth=1536;naturalHeight=384;
   addEventListener(event,fn){this.handlers[event]=fn;}
   set src(value){this.value=value;this.handlers.load();}
 }
 const frames=[];
 const loader=createNpcMotionRuntime({
   enabled:true,fetchJson:async()=>{fetchCount++;return fixture()},
   createImage:()=>new ImageStub(),onFrame:(...args)=>frames.push(args),
 });
 const drawCalls=[];
 const ctx={save(){},restore(){},translate(){},scale(){},
            drawImage(...a){drawCalls.push(a)}};
 assert.equal(loader.draw(ctx,'speaker','south-idle',{anchorX:200,footY:300,drawHeight:64}),false);
 await loader.request('speaker','idle');
 assert.equal(fetchCount,1);
 assert.equal(loader.draw(ctx,'speaker','south-idle',{anchorX:200,footY:300,drawHeight:64,nowMs:100}),true);
 assert.equal(drawCalls.length,1);
 assert.deepEqual(frames[0],['speaker','idle',2]);
 assert.equal(loader.get('speaker','idle').image.naturalWidth,1536);
});

test('classic field mode never requests or draws motion assets',async()=>{
 let fetches=0;
 const loader=createNpcMotionRuntime({
   enabled:false,fetchJson:async()=>{fetches++;return fixture()},
   createImage:()=>({}),
 });
 assert.equal(await loader.request('speaker','idle'),null);
 assert.equal(loader.draw({},'speaker','south-gesture'),false);
 assert.equal(fetches,0);
});
