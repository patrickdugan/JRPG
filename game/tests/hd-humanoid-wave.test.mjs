import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HD_HUMANOID_ENEMY_WAVE, HD_HUMANOID_CLIPS,
  HD_REGULAR_ENEMY_TOTAL, HD_REGULAR_ENEMY_COMPLETED, HD_PENDING_ENEMIES
} from '../hd-humanoid-wave-catalog.mjs';
import {resolveHdActorId,validateHdArtManifest} from '../hd-painted-animation.mjs';
import {
  HD_MOTION_CLIPS,validateHdMotionManifest,
  selectHdMotionClip,selectHdMotionFrame
} from '../hd-painted-motion.mjs';

const HEX='a'.repeat(64);
const prior=['ren','aya','lise','mateus','genta','kiku','miyo',
  'silk-jorogumo','bell-moth','cinder-hound','razor-bamboo-stalker','kurozane'];
const party=new Set(['ren','aya','lise','mateus','genta','kiku','miyo']);
function group(id){return id==='kurozane'?'boss-study':party.has(id)?'party':'enemy'}
function key(id){
 return {file:'sheets/'+id+'.png',width:2304,height:384,foot:[192,368],drawHeight:144,
   group:group(id),facing:'right',sha256:HEX,poses:['idle','move','windup','active','hurt','defeat'],
   ...(id==='kurozane'?{bossFormsOnly:true}:{})};
}
function motion(id){
 const clips=id==='kurozane'?Array.from({length:6},(_,i)=>'form-0'+(i+1)):HD_MOTION_CLIPS;
 return {sourceSheetSha256:HEX,sourceFile:'sheets/'+id+'.png',foot:[192,368],
   group:group(id),facing:'right',drawHeight:144,
   clipSet:Object.fromEntries(clips.map(clip=>[clip,{
     path:'motion/'+id+'/'+clip+'.webp',frames:24,columns:12,rows:2,
     width:2304,height:384,cell:[192,192],foot:[96,184],
     sourcePose:0,uniqueFrames:24,frameMs:60,sha256:HEX,
     frameRGBAsha256:Array.from({length:24},(_,i)=>i.toString(16).padStart(64,'0')),
   }]))};
}
test('wave has eight canonical humanoid identities and exact pending inventory',()=>{
 assert.equal(HD_HUMANOID_ENEMY_WAVE.length,8);
 assert.equal(new Set(HD_HUMANOID_ENEMY_WAVE.map(a=>a.id)).size,8);
 assert.equal(HD_REGULAR_ENEMY_TOTAL,28);
 assert.equal(HD_REGULAR_ENEMY_COMPLETED,12);
 assert.equal(Object.values(HD_PENDING_ENEMIES).flat().length,16);
 assert.deepEqual(HD_HUMANOID_CLIPS,HD_MOTION_CLIPS);
 for(const {id} of HD_HUMANOID_ENEMY_WAVE)assert.equal(resolveHdActorId(id),id);
});
test('existing six-key and 24-frame runtimes accept the 20-actor merged manifests',()=>{
 const ids=[...prior,...HD_HUMANOID_ENEMY_WAVE.map(a=>a.id)];
 const v1={schema:'bbc-hd-painted/1',frameCount:6,
   actors:Object.fromEntries(ids.map(id=>[id,key(id)]))};
 assert.deepEqual(validateHdArtManifest(v1),{ok:true,reason:'ok'});
 const motionActors=Object.fromEntries(ids.map(id=>[id,motion(id)]));
 const n=Object.values(motionActors).reduce((v,a)=>v+Object.keys(a.clipSet).length,0);
 assert.equal(n,196);
 const v2={schema:'bbc-hd-motion/2',sourceSchema:'bbc-hd-painted/1',
   frameCount:24,actors:motionActors,motionClipCount:n,frameTotal:n*24};
 assert.deepEqual(validateHdMotionManifest(v2),{ok:true,reason:'ok'});
 assert.equal(v2.frameTotal,4704);
});
test('attacks select their 24 frames from the engine phase',()=>{
 const actor={id:'enemy-1',hp:100,active:true,grounded:true,
   movementIntent:{x:0},activeAttack:{phase:'active'},
   staggerRemainingMs:0,hitStunRemainingMs:0};
 const rec=motion('ashen-spearman');
 const selection=selectHdMotionClip(actor,rec,{phaseProgress:.5,nowMs:10000});
 assert.equal(selection.clip,'active');
 assert.equal(selectHdMotionFrame(selection,rec.clipSet.active,{nowMs:10000}),12);
 actor.activeAttack=null;actor.movementIntent.x=1;
 assert.equal(selectHdMotionClip(actor,rec,{nowMs:10000}).clip,'locomotion');
});
