import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HD_KUROZANE_PHASE_FORMS,
  hdKurozanePhaseId,
  selectHdKurozaneForm,
  hdKurozaneClipName,
} from '../hd-kurozane-phase.mjs';
import {
  createHdPaintedArtRuntime,
  selectHdPose,
  validateHdArtManifest,
} from '../hd-painted-animation.mjs';

const actor = (changes={})=>({
  id:'kurozane-encounter-actor',faction:'enemy',hp:250,active:true,
  grounded:true,position:{x:620,y:430},facing:-1,
  staggerRemainingMs:0,hitStunRemainingMs:0,activeAttack:null,...changes,
});
const director = (phase='court',changes={})=>({
  bossTemplateId:'kurozane',bossActorId:'kurozane-encounter-actor',
  phaseIndex:0,phases:[{id:phase}],revision:0,...changes,
});
const record=()=>({
  file:'sheets/kurozane.png',width:2304,height:384,
  foot:[192,368],drawHeight:176,facing:'right',group:'boss-study',
  poses:['court-idle','court-cast','oni-idle','oni-slash','demon-rise','demon-bloom'],
  bossFormsOnly:true,sha256:'a'.repeat(64),
});
const manifest=()=>({schema:'bbc-hd-painted/1',frameCount:6,actors:{kurozane:record()}});

test('all canonical Kurozane phases select stable idle and committed attack keys',()=>{
  assert.deepEqual(Object.keys(HD_KUROZANE_PHASE_FORMS),['court','bell','dawn']);
  const cases=[['court',1,2],['bell',3,4],['dawn',5,6]];
  for(const [phase,rest,committed] of cases){
    assert.equal(hdKurozanePhaseId(director(phase),actor()),phase);
    assert.equal(selectHdKurozaneForm(actor(),director(phase)),rest);
    assert.equal(selectHdKurozaneForm(actor({activeAttack:{phase:'windup'}}),director(phase)),committed);
    assert.equal(selectHdKurozaneForm(actor({activeAttack:{phase:'active'}}),director(phase)),committed);
    assert.equal(selectHdKurozaneForm(actor({activeAttack:{phase:'recovery'}}),director(phase)),rest);
    assert.equal(selectHdKurozaneForm(actor({staggerRemainingMs:400}),director(phase)),rest);
  }
});
test('terminal state holds final study while other bosses and wrong phases use classic',()=>{
  assert.equal(selectHdKurozaneForm(actor({hp:0}),director('court')),6);
  assert.equal(selectHdKurozaneForm(actor({active:false}),director('bell')),6);
  assert.equal(selectHdKurozaneForm(actor(),director('unknown')),null);
  assert.equal(selectHdKurozaneForm(actor(),director('court',{bossActorId:'other'})),null);
  assert.equal(selectHdKurozaneForm(actor(),director('court',{bossTemplateId:'captain-kaji'})),null);
  assert.equal(selectHdKurozaneForm(actor(),director('court',{phaseIndex:9})),null);
  assert.equal(selectHdKurozaneForm(actor(),null),null);
  assert.equal(hdKurozaneClipName(1),'form-01');
  assert.equal(hdKurozaneClipName(6),'form-06');
  assert.equal(hdKurozaneClipName(7),null);
});
test('six painterly frames use one form key without changing non-boss six-key mapping',()=>{
  assert.equal(validateHdArtManifest(manifest()).ok,true);
  const rec=record();
  assert.equal(selectHdPose(actor(),rec),null);
  for(let i=1;i<=6;i++)assert.equal(selectHdPose(actor(),rec,{bossForm:i}),i-1);
  assert.equal(selectHdPose(actor(),rec,{bossForm:7}),null);
  assert.equal(selectHdPose(actor(),rec,{bossForm:2.5}),null);
});
test('Kurozane runtime stays opt-in and uses only the allowed boss-study identity',async()=>{
  const load=()=>({
    naturalWidth:2304,naturalHeight:384,
    addEventListener(name,cb){if(name==='load')this.completeLoad=cb;},
    set src(value){queueMicrotask(()=>this.completeLoad?.());}
  });
  const display={sx:null,draws:0,save(){},restore(){},translate(){},scale(){},drawImage(image,sx){this.sx=sx;this.draws++}};
  const a=actor();
  const before=JSON.stringify(a);
  const off=createHdPaintedArtRuntime({enabled:true,allowBossStudies:false,
    fetchJson:async()=>manifest(),createImage:load});
  assert.equal(await off.request('kurozane'),null);
  assert.equal(off.draw(display,a,'kurozane',{bossForm:3}),false);
  const on=createHdPaintedArtRuntime({enabled:true,allowBossStudies:true,
    fetchJson:async()=>manifest(),createImage:load});
  assert.equal(on.draw(display,a,'kurozane',{bossForm:3}),false);
  await on.request('kurozane');
  assert.equal(on.status('kurozane'),'ready');
  assert.equal(on.draw(display,a,'kurozane',{bossForm:3}),true);
  assert.equal(display.sx,2*384);
  assert.equal(on.draw(display,a,'kurozane',{bossForm:6}),true);
  assert.equal(display.sx,5*384);
  assert.equal(display.draws,2);
  assert.equal(JSON.stringify(a),before);
  assert.equal(on.draw(display,a,'kurozane',{}),false);
});
