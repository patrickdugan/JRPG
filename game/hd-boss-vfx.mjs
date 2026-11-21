/**
 * Painted-boss presentation layer: authored VFX strips, decoupled from the
 * battle kernel, phase director, hitboxes, and objective/safe-zone authority.
 * The boss's current pixel/painted body remains the default drawing source.
 */
export const HD_BOSS_VFX_SCHEMA = 'bbc-hd-boss-vfx/1';
export const HD_BOSS_VFX_ROOT = './assets/art/hd-boss-vfx-v1/';
export const HD_BOSS_VFX_FRAMES = 12;
export const HD_BOSS_VFX_CELL = 256;
export const HD_BOSS_VFX_NAMES = Object.freeze([
  'widow-of-fog','furnace-abbot','ujiro','bell-warden-chiyo','lady-enma','yearless-bell',
]);
const NAMES = new Set(HD_BOSS_VFX_NAMES);
const STAGES = Object.freeze(['windup','active']);
const HEX64 = /^[0-9a-f]{64}$/;
const clamp = (n) => Number.isFinite(n) ? Math.max(0,Math.min(1,n)) : 0;

export function validateHdBossVfxManifest(manifest) {
  if (!manifest || manifest.schema !== HD_BOSS_VFX_SCHEMA ||
      manifest.framesPerStage !== 12 || manifest.stageCount !== 12 ||
      manifest.totalCells !== 144 || manifest.gameplayAuthority !== 'none' ||
      manifest.frameSize?.[0] !== 256 || manifest.frameSize?.[1] !== 256 ||
      !manifest.bosses || Object.keys(manifest.bosses).length !== 6) {
    return {ok:false,reason:'header'};
  }
  for (const id of HD_BOSS_VFX_NAMES) {
    const boss = manifest.bosses[id];
    if (!boss || typeof boss.label !== 'string' || !boss.strike || !boss.signature ||
        !boss.stages || Object.keys(boss.stages).length !== 2) return {ok:false,reason:'boss:'+id};
    for (const stage of STAGES) {
      const entry=boss.stages[stage];
      if (!entry || entry.file !== id+'-'+stage+'.png' || !HEX64.test(entry.sha256) ||
          entry.frames !== 12 || entry.dimensions?.[0] !== 3072 ||
          entry.dimensions?.[1] !== 256 || entry.cell?.[0] !== 256 ||
          entry.cell?.[1] !== 256 ||
          !Array.isArray(entry.decodedFrameSHA256) ||
          entry.decodedFrameSHA256.length !== 12 ||
          entry.decodedFrameSHA256.some(x=>!HEX64.test(x)) ||
          new Set(entry.decodedFrameSHA256).size !== 12) return {ok:false,reason:'stage:'+id+'/'+stage};
    }
  }
  return {ok:true,reason:'ok'};
}

/** Pure renderer selection; only the kernel's own attack phase can activate VFX. */
export function selectHdBossVfx(templateId, actor, {
  phaseProgress = 0, reducedMotion = false,
} = {}) {
  if (!NAMES.has(templateId) || !actor || actor.faction === 'player' ||
      actor.hp <= 0 || actor.active === false || actor.staggerRemainingMs > 0 ||
      actor.hitStunRemainingMs > 0) return null;
  const stage = actor.activeAttack?.phase;
  if (!STAGES.includes(stage)) return null;
  const progress=clamp(phaseProgress);
  const frame=reducedMotion ? (stage === 'active' ? 9 : 11)
                            : Math.min(11,Math.floor(progress*12));
  return Object.freeze({id:templateId,stage,frame,progress});
}

export function hdBossVfxDrawPlan(actor, selection, {
  renderWidth = 178,
} = {}) {
  if (!selection || !Number.isFinite(renderWidth) || renderWidth <= 0) return null;
  const scale=renderWidth/HD_BOSS_VFX_CELL;
  return Object.freeze({
    sx:selection.frame*256,sy:0,sw:256,sh:256,
    dx:-128*scale,dy:-174*scale,dw:renderWidth,dh:renderWidth,
    flip:Number(actor?.facing)<0,
    anchorX:Number(actor?.position?.x)||0,
    anchorY:Number(actor?.position?.y)||0,
  });
}

export function createHdBossVfxRuntime({
  enabled = false,
  root = HD_BOSS_VFX_ROOT,
  fetchJson,
  createImage,
  onFrame = ()=>{},
  onChange = ()=>{},
}={}) {
  if (typeof fetchJson !== 'function' || typeof createImage !== 'function')
    throw new TypeError('fetchJson and createImage required');
  const images = new Map();
  const inflight = new Map();
  let manifestPromise=null, failure=null;
  function manifest() {
    if (!manifestPromise) manifestPromise=Promise.resolve()
      .then(()=>fetchJson(root+'manifest.json'))
      .then(data=>{
        const v=validateHdBossVfxManifest(data);
        if (!v.ok) throw new Error(v.reason);
        return data;
      })
      .catch(e=>{failure=String(e?.message||e);return null});
    return manifestPromise;
  }
  function request(id,stage) {
    if (!enabled || !NAMES.has(id) || !STAGES.includes(stage)) return Promise.resolve(null);
    const key=id+'/'+stage;
    if (images.has(key)) return Promise.resolve(images.get(key));
    if (inflight.has(key)) return inflight.get(key);
    const task=manifest().then(meta=>{
      if (!meta) {onChange(id,stage,'invalid');return null;}
      const entry=meta.bosses[id]?.stages?.[stage];
      if (!entry) {onChange(id,stage,'unavailable');return null;}
      onChange(id,stage,'loading');
      return new Promise(resolve=>{
        const img=createImage();
        const loaded=()=>{
          if (img.naturalWidth===3072 && img.naturalHeight===256) {
            const data={image:img,stage,entry};
            images.set(key,data);onChange(id,stage,'ready');resolve(data);
          } else {onChange(id,stage,'wrong-size');resolve(null);}
        };
        const error=()=>{onChange(id,stage,'unavailable');resolve(null);};
        if (typeof img.addEventListener==='function') {
          img.addEventListener('load',loaded,{once:true});
          img.addEventListener('error',error,{once:true});
        } else {img.onload=loaded;img.onerror=error;}
        img.decoding='async';
        img.src=root+entry.file;
      });
    }).catch(e=>{failure=String(e?.message||e);onChange(id,stage,'unavailable');return null});
    inflight.set(key,task);
    return task;
  }
  function draw(ctx,actor,templateId,options={}) {
    if (!enabled) return false;
    const selection=selectHdBossVfx(templateId,actor,options);
    if (!selection) return false;
    const item=images.get(templateId+'/'+selection.stage);
    if (!item) {void request(templateId,selection.stage);return false;}
    const plan=hdBossVfxDrawPlan(actor,selection);
    if (!plan) return false;
    ctx.save();
    ctx.imageSmoothingEnabled=true;
    ctx.translate(plan.anchorX,plan.anchorY);
    if (plan.flip) ctx.scale(-1,1);
    ctx.drawImage(item.image,plan.sx,plan.sy,plan.sw,plan.sh,
                  plan.dx,plan.dy,plan.dw,plan.dh);
    ctx.restore();
    onFrame(templateId,selection.stage,selection.frame);
    return true;
  }
  return Object.freeze({
    request,draw,
    get status(){return enabled ? (failure?'unavailable':'enabled'):'off';},
    get failure(){return failure;},
    get(id,stage){return images.get(id+'/'+stage)||null;},
  });
}
