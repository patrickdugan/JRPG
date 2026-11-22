/**
 * Optional source-derived motion for exactly 16 typed NPC roles.
 * Presentation only; original 32x48 native sprites remain the fallback.
 */
import { NPC_FIELD_ROLES } from './npc-field-atlas.mjs';

export const NPC_MOTION_SCHEMA='bbc-npc-motion/1';
export const NPC_MOTION_ROOT='./assets/art/npc-motion-v1/';
export const NPC_MOTION_CLIPS=Object.freeze(['idle','walk','talk','work','react','leave']);
export const NPC_MOTION_FRAMES=24;
export const NPC_MOTION_CELL=Object.freeze([128,192]);
const HASH=/^[0-9a-f]{64}$/;

export function validateNpcMotionManifest(m){
  if(!m || m.schema!==NPC_MOTION_SCHEMA || m.sourceAsset!=='npc-field-suite-v1' ||
     !HASH.test(m.sourceAtlasSha256) || m.gameplayAuthority!=='none' ||
     m.roleCount!==16 || m.clipCount!==96 || m.frameCount!==2304 ||
     m.framesPerClip!==24 || m.cell?.[0]!==128 || m.cell?.[1]!==192 ||
     JSON.stringify(m.roleOrder)!==JSON.stringify(NPC_FIELD_ROLES) ||
     JSON.stringify(m.clipOrder)!==JSON.stringify(NPC_MOTION_CLIPS) ||
     !m.roles || Object.keys(m.roles).length!==16)
    return {ok:false,reason:'manifest'};
  for(const [j,role] of NPC_FIELD_ROLES.entries()){
    const actor=m.roles[role];
    if(!actor || actor.canonicalSourceColumn!==j || typeof actor.paletteId!=='string' ||
       !actor.clips || Object.keys(actor.clips).length!==6)
      return {ok:false,reason:'role:'+role};
    for(const clip of NPC_MOTION_CLIPS){
      const entry=actor.clips[clip];
      if(!entry || entry.file!=='motion/'+role+'/'+clip+'.webp' || !HASH.test(entry.sha256) ||
         entry.frames!==24 || !Number.isInteger(entry.frameMs) || entry.frameMs<25 ||
         entry.columns!==12 || entry.rows!==2 ||
         entry.cell?.[0]!==128 || entry.cell?.[1]!==192 ||
         entry.dimensions?.[0]!==1536 || entry.dimensions?.[1]!==384 ||
         !Array.isArray(entry.frameRGBAsha256) ||
         entry.frameRGBAsha256.length!==24 ||
         entry.frameRGBAsha256.some(x=>!HASH.test(x)) ||
         new Set(entry.frameRGBAsha256).size!==24)
        return {ok:false,reason:'clip:'+role+'/'+clip};
    }
  }
  return {ok:true,reason:'ok'};
}

export function selectNpcMotion(role, pose='south-idle', {
  clip=null,nowMs=0,reducedMotion=false,
}={}){
  if(!NPC_FIELD_ROLES.includes(role))return null;
  const chosen=clip??(pose==='south-gesture'?'talk':'idle');
  if(!NPC_MOTION_CLIPS.includes(chosen))return null;
  const frame=reducedMotion?0:Math.floor(Math.max(0,Number.isFinite(nowMs)?nowMs:0)/75)%24;
  return Object.freeze({role,clip:chosen,frame});
}

export function npcMotionPlan(selection, entry, {
  anchorX=0,footY=0,drawHeight=64,facing='right',
}={}){
  if(!selection || !entry || !Number.isFinite(drawHeight) || drawHeight<=0)
    return null;
  const i=selection.frame;
  if(!Number.isInteger(i)||i<0||i>=24)return null;
  const width=drawHeight*(128/192);
  return Object.freeze({
    sx:(i%12)*128,sy:Math.floor(i/12)*192,sw:128,sh:192,
    dx:-width/2,dy:-drawHeight*(176/192),dw:width,dh:drawHeight,
    anchorX,anchorY:footY,flip:facing==='left',
  });
}

export function createNpcMotionRuntime({
  enabled=false,root=NPC_MOTION_ROOT,fetchJson,createImage,
  maxCachedClips=24,onFrame=()=>{},onChange=()=>{},
}={}){
  if(typeof fetchJson!=='function'||typeof createImage!=='function')
    throw new TypeError('fetchJson and createImage required');
  const cache=new Map(),inflight=new Map(),failures=new Set();
  let promise=null,reason=null;
  function loadManifest(){
    if(!promise)promise=Promise.resolve()
      .then(()=>fetchJson(root+'manifest.json'))
      .then(m=>{
        const check=validateNpcMotionManifest(m);
        if(!check.ok)throw new Error('bad-npc-motion-'+check.reason);
        return m;
      })
      .catch(e=>{reason=String(e?.message||e);return null});
    return promise;
  }
  function request(role,clip){
    if(!enabled || !NPC_FIELD_ROLES.includes(role) || !NPC_MOTION_CLIPS.includes(clip))
      return Promise.resolve(null);
    const id=role+'/'+clip;
    if(cache.has(id))return Promise.resolve(cache.get(id));
    if(failures.has(id))return Promise.resolve(null);
    if(inflight.has(id))return inflight.get(id);
    onChange(role,clip,'loading');
    const task=loadManifest().then(manifest=>{
      const entry=manifest?.roles?.[role]?.clips?.[clip];
      if(!entry){failures.add(id);onChange(role,clip,'unavailable');return null;}
      return new Promise(resolve=>{
        const img=createImage();
        const loaded=()=>{
          if(img.naturalWidth!==1536||img.naturalHeight!==384){
            failures.add(id);onChange(role,clip,'wrong-size');resolve(null);return;
          }
          const item={image:img,entry};
          cache.set(id,item);
          while(cache.size>maxCachedClips)cache.delete(cache.keys().next().value);
          onChange(role,clip,'ready');resolve(item);
        };
        const failed=()=>{
          failures.add(id);onChange(role,clip,'unavailable');resolve(null);
        };
        if(typeof img.addEventListener==='function'){
          img.addEventListener('load',loaded,{once:true});
          img.addEventListener('error',failed,{once:true});
        }else{img.onload=loaded;img.onerror=failed;}
        img.decoding='async';img.src=root+entry.file;
      });
    });
    inflight.set(id,task);
    return task;
  }
  function draw(ctx,role,pose,options={}){
    if(!enabled)return false;
    const selected=selectNpcMotion(role,pose,options);
    if(!selected)return false;
    const id=selected.role+'/'+selected.clip;
    const item=cache.get(id);
    if(!item){void request(selected.role,selected.clip);return false;}
    const frame=options.reducedMotion?0:
      Math.floor(Math.max(0,Number.isFinite(options.nowMs)?options.nowMs:0)/item.entry.frameMs)%24;
    const plan=npcMotionPlan({...selected,frame},item.entry,options);
    if(!plan)return false;
    ctx.save();
    ctx.imageSmoothingEnabled=true;
    ctx.translate(plan.anchorX,plan.anchorY);
    if(plan.flip)ctx.scale(-1,1);
    ctx.drawImage(item.image,plan.sx,plan.sy,plan.sw,plan.sh,plan.dx,plan.dy,plan.dw,plan.dh);
    ctx.restore();
    onFrame(role,selected.clip,frame);
    return true;
  }
  return Object.freeze({
    request,draw,
    get(role,clip){return cache.get(role+'/'+clip)??null;},
    get enabled(){return enabled;},
    get failure(){return reason;},
  });
}
