/** Isolated opt-in for the two approved windup trial clips.
 * Canonical motion-manifest.json remains the source of gameplay clip timing.
 * Any missing, invalid, or mismatched overlay falls back to original WebP art.
 */
export const REVIEWED_MOTION_SCHEMA = 'jrpg-reviewed-hd-windup/1';
export const REVIEWED_MOTION_MANIFEST = 'reviewed-motion/manifest.json';
export const REVIEWED_BOSSES = Object.freeze(['yearless-bell','lady-enma']);
const HASH = /^[a-f0-9]{64}$/;
const equalPair = (a,b) =>
  Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>x===b[i]);

export function reviewedMotionFor(manifest, actorId, clipName, canonicalMotion) {
  if(!REVIEWED_BOSSES.includes(actorId)||clipName!=='windup'||
     manifest?.schema!==REVIEWED_MOTION_SCHEMA||
     manifest?.mode!=='explicit opt-in windup-only'||
     manifest.bossCount!==2||manifest.clipCount!==2||manifest.frameCount!==48||
     !manifest.entries||typeof manifest.entries!=='object') return null;
  const ids=Object.keys(manifest.entries);
  if(ids.length!==2||ids.some(id=>!REVIEWED_BOSSES.includes(id)))return null;
  const original=canonicalMotion?.actors?.[actorId];
  const source=original?.clipSet?.windup;
  const active=original?.clipSet?.active;
  const overlay=manifest.entries[actorId];
  if(!source||!active||!overlay||overlay.clip!=='windup'||
     overlay.path!=='reviewed-motion/'+actorId+'/windup.webp'||
     !HASH.test(overlay.sha256)||!HASH.test(overlay.sourceSheetSha256)||
     overlay.sourceSheetSha256!==original.sourceSheetSha256||
     overlay.originalWindupSha256!==source.sha256||
     overlay.originalActiveSha256!==active.sha256||
     overlay.sourcePose!==source.sourcePose||
     overlay.frameMs!==source.frameMs||
     !equalPair(overlay.foot,source.foot)||
     overlay.frames!==source.frames||
     overlay.columns!==source.columns||
     overlay.rows!==source.rows||
     overlay.width!==source.width||
     overlay.height!==source.height||
     !equalPair(overlay.cell,source.cell)||
     overlay.acceptance!=='user-approved-clip-trial'||
     overlay.bossVisualApproval!=='pending'||
     overlay.optIn!=='art=hd&motion=reviewed'||
     !Array.isArray(overlay.frameRGBAsha256)||
     overlay.frameRGBAsha256.length!==24||
     overlay.frameRGBAsha256.some(h=>!HASH.test(h))||
     new Set(overlay.frameRGBAsha256).size!==24)return null;
  return {...source, path:overlay.path, sha256:overlay.sha256,
    frameRGBAsha256:overlay.frameRGBAsha256, reviewedMotion:true};
}

export function reviewedModeFromSearch(search='') {
  const params=new URLSearchParams(String(search));
  return params.get('art')==='hd'&&params.get('motion')==='reviewed';
}
