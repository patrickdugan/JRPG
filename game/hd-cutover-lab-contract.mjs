/**
 * Review-only contracts for comparing a candidate windup WebP against the
 * immutable source windup and active clip. No game-state or roster writes.
 */
export const BOSSES = Object.freeze([
  {id:'yearless-bell', label:'Yearless Bell'},
  {id:'lady-enma', label:'Lady Enma'},
]);
export const CUTOVER_SCHEMA = 'jrpg-hd-attack-cutover-review/1';
export const STORAGE_KEY = 'jrpg-hd-attack-cutover-review-v1';
export const HASH = /^[0-9a-f]{64}$/;
export const CELL = 192;
export const FRAMES_PER_PHASE = 24;
export const TIMELINE_FRAMES = 48;
export const CUTOVER_WINDOW = Object.freeze({min:20,max:27});
const own = (obj,field) => Object.prototype.hasOwnProperty.call(obj,field);
export const supportedBoss = id => BOSSES.some(b=>b.id===id);

export function atlasRect(index) {
  if (!Number.isInteger(index)||index<0||index>=24) throw new RangeError('Invalid frame index');
  return {x:(index%12)*CELL,y:Math.floor(index/12)*CELL,w:CELL,h:CELL};
}
export function timelinePhase(index, clipSet) {
  if(!Number.isInteger(index)||index<0||index>=TIMELINE_FRAMES)
    throw new RangeError('Invalid timeline frame');
  const phase=index<24?'windup':'active';
  const clip=clipSet?.[phase];
  if(!clip||clip.frames!==24||!Number.isFinite(clip.frameMs))
    throw new Error('Missing canonical phase metadata: '+phase);
  return {phase,frame:index%24,frameNumber:index%24+1,frameMs:clip.frameMs};
}
export function stepFrame(current,amount,window) {
  const {min,max}=window;
  if(!Number.isInteger(current)||!Number.isInteger(amount)||!Number.isInteger(min)||
     !Number.isInteger(max)||min<0||max>=48||min>=max) throw new RangeError('Invalid review window');
  const len=max-min+1;
  return min + ((current-min+amount)%len+len)%len;
}
export function validateCatalog(keys,motion,roster) {
  if(keys?.schema!=='bbc-hd-painted/1'||motion?.schema!=='bbc-hd-motion/2'||
     !Array.isArray(roster?.identities)) throw new Error('Incompatible seven-boss manifests');
  for(const {id} of BOSSES) {
    const row=roster.identities.filter(x=>x.id===id&&x.kind==='named-boss');
    const art=keys.actors?.[id];
    const actor=motion.actors?.[id];
    if(row.length!==1||row[0].visualApproval!=='pending'||row[0].assetInGit!==true||
       !art||art.group!=='enemy'||actor?.sourceSheetSha256!==art.sha256||
       actor.sourceFile!==art.file||!HASH.test(art.sha256))
      throw new Error('Missing immutable approved-for-review source: '+id);
    for(const clipName of ['windup','active']){
      const c=actor.clipSet?.[clipName];
      if(!c||c.frames!==24||c.columns!==12||c.rows!==2||
         c.width!==2304||c.height!==384||c.cell?.[0]!==192||c.cell?.[1]!==192||
         c.path!=='motion/'+id+'/'+clipName+'.webp'||!HASH.test(c.sha256)||
         !Number.isInteger(c.frameMs)||c.frameMs<16||c.frameMs>150||
         !Array.isArray(c.frameRGBAsha256)||c.frameRGBAsha256.length!==24)
        throw new Error('Invalid canonical clip: '+id+'/'+clipName);
    }
  }
  return {bosses:2,sourceClips:4,sourceFrames:96,approval:'pending'};
}
export function extractCandidateReceipt(raw,bossId,motion) {
  if(!supportedBoss(bossId)) throw new Error('Unsupported boss');
  const source=raw?.bosses?.[bossId] ?? raw?.candidates?.[bossId];
  if(!source||typeof source!=='object') throw new Error('Candidate absent from receipt: '+bossId);
  const candidateHash=source.leadInWebPSha256??source.candidateWebPSha256;
  const decoded=source.decodedFrameHashes??source.candidateFrameRGBAsha256;
  const expectedActive=motion.actors[bossId].clipSet.active.sha256;
  const expectedWindup=motion.actors[bossId].clipSet.windup.sha256;
  if(!HASH.test(candidateHash)||!Array.isArray(decoded)||decoded.length!==24||
     decoded.some(hash=>!HASH.test(hash))||new Set(decoded).size!==24)
    throw new Error('Candidate SHA-256 or decoded frame receipts are invalid');
  if(source.immutableActiveSha256!==undefined&&source.immutableActiveSha256!==expectedActive)
    throw new Error('Active attack source hash changed');
  if(source.originalWindupWebPSha256!==undefined&&source.originalWindupWebPSha256!==expectedWindup)
    throw new Error('Windup source hash changed');
  return {
    bossId,candidateHash,frameRGBAsha256:decoded,
    schema:raw.schema??'unknown',
    originalActiveHash:expectedActive,originalWindupHash:expectedWindup,
    note:'The original CI generator verified decoded RGBA frames. The browser compares the uploaded WebP file SHA-256.',
  };
}
export function reviewWindow(mode){
  return mode==='full'?{min:0,max:47}:{min:CUTOVER_WINDOW.min,max:CUTOVER_WINDOW.max};
}
export function safeNote(input) {
  return typeof input==='string'?input.slice(0,2400):'';
}
export function readDraft(raw){
  const entries={};
  for(const {id} of BOSSES){
    const d=raw?.entries?.[id]??{};
    entries[id]={
      decision:['unreviewed','needs-keys','ready-for-human-signoff'].includes(d.decision)?d.decision:'unreviewed',
      note:safeNote(d.note),
    };
  }
  return {schema:CUTOVER_SCHEMA,entries};
}
export function exportReviewReceipt({bossId,index,mode,backdrop,speed,clipSet,candidate,notes,screenshotSha256}){
  if(!supportedBoss(bossId)||!HASH.test(screenshotSha256)||!HASH.test(candidate?.candidateHash)||
     !['full','cutover'].includes(mode)||!['charcoal','parchment','checker'].includes(backdrop)||
     !Number.isFinite(speed)||speed<=0||!Number.isInteger(index)||index<0||index>=48)
    throw new Error('Invalid review screenshot metadata');
  const phase=timelinePhase(index,clipSet);
  return {
    schema:CUTOVER_SCHEMA,bossId,
    evidenceType:'review-only-browser-capture',
    capturedAt:new Date().toISOString(),
    phase, timelineFrame:index,mode,backdrop,playbackSpeed:speed,
    originalWindupSha256:clipSet.windup.sha256,
    originalActiveSha256:clipSet.active.sha256,
    candidateWindupSha256:candidate.candidateHash,
    candidateSourceReceiptSchema:candidate.schema,
    expectedCandidateFrameRGBAsha256:candidate.frameRGBAsha256,
    screenshotSha256,
    humanReview:notes,
    canonicalVisualApproval:'pending',
    evidenceAuthority:'local review only; no game or Roster Keystone modification',
  };
}
