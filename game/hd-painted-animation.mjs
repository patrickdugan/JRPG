import { createHdMotionRuntime } from './hd-painted-motion.mjs';
/**
 * Optional six-key painted animation source for Action Campaign.
 * Presentation only. No changes to fixed-step physics, hitboxes, objectives,
 * attack time, settlement, persistence or encounter state.
 */
export const HD_ART_SCHEMA = 'bbc-hd-painted/1';
export const HD_ART_ROOT = './assets/art/hd-painted-v1/';
export const HD_FRAME_SIZE = 384;
export const HD_FRAME_COUNT = 6;
export const HD_PARTY_POSES = Object.freeze(['idle','move','windup','active','guard','hurt']);
export const HD_ENEMY_POSES = Object.freeze(['idle','move','windup','active','hurt','defeat']);
const SAFE_ID = /^[a-z][a-z0-9-]{0,50}$/;
const ALIASES = Object.freeze({'nikola':'lise','nikola-drazanic':'lise','nikola-dražanić':'lise','miyo-senda':'miyo'});

export function resolveHdActorId(templateId) {
  if (typeof templateId !== 'string') return null;
  const id = ALIASES[templateId] ?? templateId;
  return SAFE_ID.test(id) ? id : null;
}
export function getHdArtMode(search = '') {
  return new URLSearchParams(String(search)).get('art') === 'hd' ? 'hd' : 'classic';
}
export function validateHdArtManifest(manifest) {
  if (manifest?.schema !== HD_ART_SCHEMA || manifest.frameCount !== HD_FRAME_COUNT ||
      !manifest.actors || typeof manifest.actors !== 'object' || Array.isArray(manifest.actors))
    return {ok:false,reason:'bad-manifest'};
  const entries = Object.entries(manifest.actors);
  if (!entries.length || entries.length > 80) return {ok:false,reason:'actor-count'};
  for (const [id, record] of entries) {
    if (!SAFE_ID.test(id) || !record || typeof record !== 'object') return {ok:false,reason:'actor-id'};
    if (record.file !== 'sheets/' + id + '.png' || record.width !== HD_FRAME_COUNT * HD_FRAME_SIZE ||
        record.height !== HD_FRAME_SIZE || !Array.isArray(record.foot) || record.foot.length !== 2 ||
        record.foot.some(value => !Number.isFinite(value) || value < 0 || value > HD_FRAME_SIZE))
      return {ok:false,reason:'bad-geometry:' + id};
    if (!Number.isFinite(record.drawHeight) || record.drawHeight < 60 || record.drawHeight > 225)
      return {ok:false,reason:'bad-scale:' + id};
    if (!['party','enemy','boss-study'].includes(record.group) ||
        record.facing !== 'right' || !Array.isArray(record.poses) ||
        record.poses.length !== HD_FRAME_COUNT || record.poses.some(name => typeof name !== 'string'))
      return {ok:false,reason:'bad-poses:' + id};
    if (record.group === 'boss-study' && record.bossFormsOnly !== true)
      return {ok:false,reason:'unsafe-boss:' + id};
    if (typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256))
      return {ok:false,reason:'missing-hash:' + id};
  }
  return {ok:true,reason:'ok'};
}
/** Select one key from immutable game state. Kurozane forms need separate mapping. */
export function selectHdPose(actor, record, { bossForm = null } = {}) {
  if (!actor || !record) return null;
  if (record.group === 'boss-study') return Number.isInteger(bossForm) && bossForm >= 1 && bossForm <= 6 ? bossForm - 1 : null;
  if (actor.hp <= 0 || actor.active === false) return 5;
  if (actor.staggerRemainingMs > 0 || actor.hitStunRemainingMs > 0)
    return record.group === 'party' ? 5 : 4;
  if (actor.activeAttack) {
    if (actor.activeAttack.phase === 'windup') return 2;
    if (actor.activeAttack.phase === 'active') return 3;
    if (actor.activeAttack.phase === 'recovery') return record.group === 'party' ? 4 : 0;
  }
  if (actor.activeManeuver?.id === 'uppercut' || actor.activeManeuver?.id === 'thunder-kick') return 3;
  if (actor.activeManeuver?.id === 'guard') return 4;
  if (!actor.grounded || ['dash','slide'].includes(actor.activeManeuver?.id) ||
      Math.abs(Number(actor.movementIntent?.x) || 0) > 0) return 1;
  return 0;
}
export function hdPaintedDrawPlan(actor,record,frame) {
  if (!record || !Number.isInteger(frame) || frame < 0 || frame >= HD_FRAME_COUNT) return null;
  const scale = record.drawHeight / HD_FRAME_SIZE;
  return Object.freeze({
    sx:frame*HD_FRAME_SIZE, sy:0, sw:HD_FRAME_SIZE, sh:HD_FRAME_SIZE,
    dx:-record.foot[0]*scale, dy:-record.foot[1]*scale,
    dw:HD_FRAME_SIZE*scale, dh:HD_FRAME_SIZE*scale,
    flip:Number(actor?.facing)<0,
    anchorX:Number(actor?.position?.x)||0, anchorY:Number(actor?.position?.y)||0,
  });
}
export function createHdPaintedArtRuntime({
  fetchJson, createImage, root=HD_ART_ROOT, enabled=false, motionEnabled=false, reviewedMotionEnabled=false, allowBossStudies=false, onMotionChange=()=>{}, onMotionFrame=()=>{}, onChange=()=>{},
}={}) {
  if (typeof fetchJson !== 'function' || typeof createImage !== 'function')
    throw new TypeError('fetchJson and createImage must be functions');
  const motion=createHdMotionRuntime({fetchJson,createImage,root,enabled:enabled&&motionEnabled,reviewedMotionEnabled,onChange:onMotionChange,onFrame:onMotionFrame});
  const states=new Map(),images=new Map(),inflight=new Map();
  let manifestPromise=null,disabledReason=null;
  function state(id,next) {
    if (states.get(id) === next) return;
    states.set(id,next);
    onChange(id,next);
  }
  function loadManifest() {
    if (!manifestPromise) manifestPromise=Promise.resolve()
      .then(()=>fetchJson(root+'manifest.json'))
      .then(json=>{
        const verdict=validateHdArtManifest(json);
        if (!verdict.ok) throw new Error(verdict.reason);
        return json;
      });
    return manifestPromise;
  }
  function loadImage(path) {
    return new Promise((resolve,reject)=>{
      const image=createImage();
      if (typeof image.addEventListener === 'function') {
        image.addEventListener('load',()=>resolve(image),{once:true});
        image.addEventListener('error',()=>reject(new Error('image failed')),{once:true});
      } else {
        image.onload=()=>resolve(image);
        image.onerror=()=>reject(new Error('image failed'));
      }
      image.decoding='async';
      image.src=path;
    });
  }
  function request(template) {
    const id=resolveHdActorId(template);
    if (!enabled || !id) return Promise.resolve(null);
    if (inflight.has(id)) return inflight.get(id);
    state(id,'loading');
    const task=loadManifest().then(manifest=>{
      const rec=manifest.actors[id];
      if (!rec || (rec.group==='boss-study' && (!allowBossStudies || id !== 'kurozane'))) { state(id,'unavailable'); return null; }
      return loadImage(root+rec.file).then(image=>{
        if (image.naturalWidth !== rec.width || image.naturalHeight !== rec.height) {
          state(id,'wrong-size');return null;
        }
        const entry=Object.freeze({image,record:rec});
        images.set(id,entry);
        state(id,'ready');
        return entry;
      });
    }).catch(error=>{
      disabledReason=String(error.message||error);
      state(id,disabledReason.startsWith('bad-')?'invalid':'unavailable');
      return null;
    });
    inflight.set(id,task);
    return task;
  }
  function status(template) {
    const id=resolveHdActorId(template);
    return enabled && id ? states.get(id)??'off' : 'off';
  }
  function draw(ctx,actor,template,options={}) {
    if (!enabled) return false;
    const id=resolveHdActorId(template);
    if (!id) return false;
    const item=images.get(id);
    if (!item) { request(id);return false; }
    if(motion.draw(ctx,actor,id,item.record,options))return true;
    const frame=selectHdPose(actor,item.record,options);
    if (frame==null) return false;
    const plan=hdPaintedDrawPlan(actor,item.record,frame);
    if (!plan) return false;
    ctx.save();
    ctx.imageSmoothingEnabled=true;
    ctx.translate(plan.anchorX,plan.anchorY);
    if (plan.flip) ctx.scale(-1,1);
    ctx.drawImage(item.image,plan.sx,plan.sy,plan.sw,plan.sh,plan.dx,plan.dy,plan.dw,plan.dh);
    ctx.restore();
    return true;
  }
  return Object.freeze({
    request,draw,status,
    get(template){return images.get(resolveHdActorId(template))??null;},
    get enabled(){return enabled;},
    get disabledReason(){return disabledReason;},
    motion,
  });
}
