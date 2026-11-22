import { reviewedMotionFor, REVIEWED_BOSSES, REVIEWED_MOTION_MANIFEST } from './hd-reviewed-motion.mjs';
/**
 * 24-frame painted-key motion delivery. Presentation only.
 * WebP clips are derived single-pose deformations, not individually hand-drawn frames.
 */
export const HD_MOTION_SCHEMA = 'bbc-hd-motion/2';
export const HD_MOTION_MANIFEST = 'motion-manifest.json';
export const HD_MOTION_FRAME_SIZE = 192;
export const HD_MOTION_FRAME_COUNT = 24;
export const HD_MOTION_CLIPS = Object.freeze(['idle','locomotion','windup','active','recovery','guard','hurt','defeat','signature','stagger']);
const SAFE=/^[a-z][a-z0-9-]{0,50}$/, HEX=/^[a-f0-9]{64}$/;
const clamp=n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
const point=(a,max)=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isFinite(n)&&n>=0&&n<=max);
export function validateHdMotionManifest(m) {
  if(m?.schema!==HD_MOTION_SCHEMA||m.sourceSchema!=='bbc-hd-painted/1'||m.frameCount!==24||
     !m.actors||typeof m.actors!=='object'||Array.isArray(m.actors)) return {ok:false,reason:'bad-manifest'};
  const actors=Object.entries(m.actors);
  if(actors.length<1||actors.length>80) return {ok:false,reason:'actor-count'};
  let n=0;
  for(const [id,a] of actors){
    if(!SAFE.test(id)||!HEX.test(a?.sourceSheetSha256)||a.sourceFile!=='sheets/'+id+'.png'||
       !point(a.foot,384)||!['party','enemy','boss-study'].includes(a.group)||
       a.facing!=='right'||!Number.isFinite(a.drawHeight)||!a.clipSet) return {ok:false,reason:'actor-invalid:'+id};
    const wanted=a.group==='boss-study'?Array.from({length:6},(_,i)=>'form-0'+(i+1)):HD_MOTION_CLIPS;
    const entries=Object.entries(a.clipSet);
    if(entries.length!==wanted.length) return {ok:false,reason:'clip-count:'+id};
    for(const [name,c] of entries){
      if(!wanted.includes(name)||c?.path!=='motion/'+id+'/'+name+'.webp'||
         c.frames!==24||c.columns!==12||c.rows!==2||c.width!==2304||c.height!==384||
         c.cell?.[0]!==192||c.cell?.[1]!==192||!point(c.foot,192)||
         !HEX.test(c.sha256)||!Number.isInteger(c.sourcePose)||c.sourcePose<0||c.sourcePose>5||
         c.uniqueFrames!==24||!Number.isFinite(c.frameMs)||c.frameMs<16||c.frameMs>150||
         !Array.isArray(c.frameRGBAsha256)||c.frameRGBAsha256.length!==24||
         new Set(c.frameRGBAsha256).size!==24||c.frameRGBAsha256.some(h=>!HEX.test(h)))
        return {ok:false,reason:'clip-invalid:'+id+'/'+name};
      n++;
    }
  }
  return m.motionClipCount===n&&m.frameTotal===n*24?{ok:true,reason:'ok'}:{ok:false,reason:'declared-counts'};
}
export function selectHdMotionClip(actor,rec,{phaseProgress=0,reducedMotion=false,bossForm=null}={}) {
  if(!actor||!rec)return null;
  if(rec.group==='boss-study'){
    if(!Number.isInteger(bossForm)||bossForm<1||bossForm>6)return null;
    return {clip:'form-0'+bossForm,mode:'loop',progress:0,fixedFrame:reducedMotion?0:null};
  }
  if(actor.hp<=0||actor.active===false)return {clip:'defeat',mode:'terminal',progress:0,fixedFrame:reducedMotion?23:null};
  if(actor.staggerRemainingMs>0)return {clip:'stagger',mode:'progress',progress:clamp(1-actor.staggerRemainingMs/600),fixedFrame:reducedMotion?12:null};
  if(actor.hitStunRemainingMs>0)return {clip:'hurt',mode:'progress',progress:clamp(1-actor.hitStunRemainingMs/100),fixedFrame:reducedMotion?12:null};
  if(['windup','active','recovery'].includes(actor.activeAttack?.phase)){
    const clip=actor.activeAttack.phase;
    return {clip,mode:'progress',progress:clamp(phaseProgress),fixedFrame:reducedMotion?(clip==='active'?11:23):null};
  }
  if(['uppercut','thunder-kick'].includes(actor.activeManeuver?.id))
    return {clip:'signature',mode:'progress',progress:clamp((actor.activeManeuver.elapsedMs||0)/500),fixedFrame:reducedMotion?11:null};
  if(actor.activeManeuver?.id==='guard')return {clip:'guard',mode:'loop',progress:0,fixedFrame:reducedMotion?0:null};
  if(!actor.grounded||['dash','slide'].includes(actor.activeManeuver?.id)||Math.abs(Number(actor.movementIntent?.x)||0)>0)
    return {clip:'locomotion',mode:'loop',progress:0,fixedFrame:reducedMotion?0:null};
  return {clip:'idle',mode:'loop',progress:0,fixedFrame:reducedMotion?0:null};
}
export function selectHdMotionFrame(s,clip,{nowMs=0,defeatAgeMs=0}={}){
  if(!s||!clip)return null;
  if(Number.isInteger(s.fixedFrame))return Math.max(0,Math.min(23,s.fixedFrame));
  if(s.mode==='terminal')return Math.min(23,Math.floor(clamp(defeatAgeMs/720)*24));
  if(s.mode==='progress')return Math.min(23,Math.floor(clamp(s.progress)*24));
  return Math.floor(Math.max(0,Number.isFinite(nowMs)?nowMs:0)/clip.frameMs)%24;
}
export function hdMotionDrawPlan(actor,original,c,index){
  if(!c||!original||!Number.isInteger(index)||index<0||index>=24)return null;
  const scale=original.drawHeight/192;
  return {sx:(index%12)*192,sy:Math.floor(index/12)*192,sw:192,sh:192,
    dx:-c.foot[0]*scale,dy:-c.foot[1]*scale,dw:192*scale,dh:192*scale,
    anchorX:Number(actor?.position?.x)||0,anchorY:Number(actor?.position?.y)||0,
    flip:Number(actor?.facing)<0};
}
export function createHdMotionRuntime({fetchJson,createImage,root='./assets/art/hd-painted-v1/',
  enabled=false,reviewedMotionEnabled=false,maxCachedClips=24,onChange=()=>{},onFrame=()=>{}}={}){
  if(typeof fetchJson!=='function'||typeof createImage!=='function')throw new TypeError('fetchJson and createImage required');
  if(!Number.isInteger(maxCachedClips)||maxCachedClips<1)throw new RangeError('invalid cache capacity');
  const cached=new Map(),pending=new Map(),failed=new Set(),deathAt=new Map();
  let manifestPromise=null,manifestError=null,reviewedPromise=null;
  const key=(id,clip)=>id+'/'+clip;
  function manifest(){
    if(!manifestPromise)manifestPromise=Promise.resolve().then(()=>fetchJson(root+HD_MOTION_MANIFEST))
       .then(m=>{const checked=validateHdMotionManifest(m);if(!checked.ok)throw new Error(checked.reason);return m})
       .catch(e=>{manifestError=String(e?.message||e);return null});
    return manifestPromise;
  }
  function reviewedManifest(){
    if(!reviewedMotionEnabled)return Promise.resolve(null);
    if(!reviewedPromise)reviewedPromise=Promise.resolve().then(()=>fetchJson(root+REVIEWED_MOTION_MANIFEST))
      .catch(()=>null);
    return reviewedPromise;
  }
  function loadImage(path){
    return new Promise((resolve,reject)=>{
      const image=createImage();
      if(typeof image.addEventListener==='function'){
        image.addEventListener('load',()=>resolve(image),{once:true});
        image.addEventListener('error',()=>reject(new Error('failed motion image')),{once:true});
      }else{image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('failed motion image'))}
      image.decoding='async';image.src=path;
    });
  }
  function request(id,name,source){
    if(!enabled||!SAFE.test(id)||!SAFE.test(name)||!source)return Promise.resolve(null);
    const k=key(id,name);
    if(cached.has(k))return Promise.resolve(cached.get(k));
    if(failed.has(k))return Promise.resolve(null);
    if(pending.has(k))return pending.get(k);
    onChange(id,name,'loading');
    const task=manifest().then(async m=>{
      const record=m?.actors?.[id],clip=record?.clipSet?.[name];
      if(!clip||record.sourceSheetSha256!==source.sha256||record.drawHeight!==source.drawHeight||
         record.group!==source.group)return null;
      // Reviewed clip art is a separate optional lane, never a manifest rewrite.
      // Its source hash and attack timing must match canonical HD source metadata.
      const approved=reviewedMotionFor(await reviewedManifest(),id,name,m);
      if(approved){
        try{
          const image=await loadImage(root+approved.path);
          if(image.naturalWidth===approved.width&&image.naturalHeight===approved.height){
            const result={image,clip:approved,record,origin:'reviewed'};
            cached.set(k,result);
            while(cached.size>maxCachedClips)cached.delete(cached.keys().next().value);
            return result;
          }
        }catch{ /* A missing preview should use the SHA-receipted canonical WebP. */ }
      }
      const image=await loadImage(root+clip.path);
      if(image.naturalWidth!==clip.width||image.naturalHeight!==clip.height)return null;
      const result={image,clip,record,origin:'canonical'};
      cached.set(k,result);
      while(cached.size>maxCachedClips)cached.delete(cached.keys().next().value);
      return result;
    }).catch(()=>null).then(r=>{pending.delete(k);if(!r)failed.add(k);onChange(id,name,r?'ready':'unavailable');return r});
    pending.set(k,task);return task;
  }
  function get(id,name){
    const k=key(id,name),entry=cached.get(k);
    if(entry){cached.delete(k);cached.set(k,entry)}
    return entry??null;
  }
  function draw(ctx,actor,id,original,options={}){
    if(!enabled||!original)return false;
    const s=selectHdMotionClip(actor,original,options);
    if(!s)return false;
    const entry=get(id,s.clip);
    if(!entry)request(id,s.clip,original);
    // In the short attack-active phase, a cold WebP fetch can miss the
    // release's opening frames. Prefetch the canonical active clip during
    // the preceding windup for the two explicitly reviewed boss trials.
    // This remains presentation-only and never changes attack state/timing.
    if(reviewedMotionEnabled && s.clip==='windup' && REVIEWED_BOSSES.includes(id)
       && !get(id,'active'))request(id,'active',original);
    if(!entry)return false;
    const now=Number.isFinite(options.nowMs)?options.nowMs:0;
    if(actor.hp<=0||actor.active===false){
      if(!deathAt.has(actor.id))deathAt.set(actor.id,now);
    }else deathAt.delete(actor.id);
    const index=selectHdMotionFrame(s,entry.clip,{nowMs:now,defeatAgeMs:now-(deathAt.get(actor.id)??now)});
    const p=hdMotionDrawPlan(actor,original,entry.clip,index);
    if(!p)return false;
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.translate(p.anchorX,p.anchorY);
    if(p.flip)ctx.scale(-1,1);
    ctx.drawImage(entry.image,p.sx,p.sy,p.sw,p.sh,p.dx,p.dy,p.dw,p.dh);
    ctx.restore();onFrame(id,s.clip,index,entry.origin);return true;
  }
  return Object.freeze({request,draw,get,
    get cacheSize(){return cached.size},get pendingCount(){return pending.size},
    get disabledReason(){return manifestError},get enabled(){return enabled}});
}
