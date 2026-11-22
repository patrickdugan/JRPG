import {
  BOSSES,STORAGE_KEY,CUTOVER_SCHEMA,HASH,atlasRect,timelinePhase,stepFrame,
  validateCatalog,extractCandidateReceipt,reviewWindow,readDraft,exportReviewReceipt,
} from './hd-cutover-lab-contract.mjs';

const $ = selector => document.querySelector(selector);
const ui = {
 boss:$('#boss'),mode:$('#mode'),backdrop:$('#backdrop'),speed:$('#speed'),
 input:$('#candidate'),receiptFile:$('#receiptFile'),status:$('#status'),
 original:$('#original'),proposed:$('#proposed'),originalCounter:$('#originalCounter'),
 candidateCounter:$('#candidateCounter'),candidateCaption:$('#candidateCaption'),
 play:$('#play'),prev:$('#prev'),next:$('#next'),timeline:$('#timeline'),
 readout:$('#readout'),baselineScore:$('#baselineScore'),
 candidateScore:$('#candidateScore'),ratioScore:$('#ratioScore'),verifiedStatus:$('#verifiedStatus'),
 decision:$('#decision'),notes:$('#notes'),capture:$('#capture'),
 downloadReceipt:$('#downloadReceipt'),exportNotes:$('#exportNotes'),
};
const ROOT='./assets/art/hd-painted-v1/';
const COLORS={charcoal:'#303640',parchment:'#d2c5b0',checker:'#67717a'};
const motionMedia=matchMedia('(prefers-reduced-motion:reduce)');
const sourceContexts=[ui.original,ui.proposed].map(canvas=>canvas.getContext('2d',{willReadFrequently:true}));
let manifests=null,bossId='yearless-bell',sourceImgs=null,uploadedImage=null,uploadedFile=null,uploadedHash='';
let uploadedReceipt=null,verifiedCandidate=null,candidateURL='',sequence=20,playing=false,raf=null;
let previousTime=0,carry=0,version=0,exportedReceipt=null,notes,storageAvailable=true;

function say(message){ui.status.textContent=message;}
function fileDownload(blob,name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);
  a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);
}
function saveNotes(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(notes));}
  catch{storageAvailable=false;}
  forgetScreenshot();
}
function loadNotes(){
  try{return readDraft(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'));}
  catch{storageAvailable=false;return readDraft(null);}
}
function rememberReview(){
  const entry=notes.entries[bossId];
  entry.decision=ui.decision.value;entry.note=ui.notes.value.slice(0,2400);
  saveNotes();
  if(!storageAvailable)say('Local storage blocked. Export notes to retain this review.');
}
function fillReview(){
  ui.decision.value=notes.entries[bossId].decision;
  ui.notes.value=notes.entries[bossId].note;
}
function forgetScreenshot(){
  exportedReceipt=null;ui.downloadReceipt.disabled=true;
}
function stop(){
  playing=false;if(raf!==null)cancelAnimationFrame(raf);raf=null;
  previousTime=0;carry=0;
  ui.play.textContent='Play both';ui.play.setAttribute('aria-pressed','false');
}
function resetCandidate(){
  stop();forgetScreenshot();
  if(candidateURL)URL.revokeObjectURL(candidateURL);
  candidateURL='';uploadedImage=null;uploadedFile=null;uploadedHash='';
  uploadedReceipt=null;verifiedCandidate=null;
  ui.input.value='';ui.receiptFile.value='';
  ui.capture.disabled=true;ui.verifiedStatus.textContent='Pending';
  ui.candidateCaption.textContent='Identical to original until a verified candidate is loaded';
}
async function fetchJson(path){
 const r=await fetch(path,{cache:'no-cache'});
 if(!r.ok)throw new Error('HTTP '+r.status+': '+path);
 return r.json();
}
function imageFromURL(src){
 return new Promise((resolve,reject)=>{
  const image=new Image();image.decoding='async';
  image.onload=()=>image.naturalWidth===2304&&image.naturalHeight===384?
   resolve(image):reject(new Error('Atlas must have exact 2304 × 384 geometry'));
  image.onerror=()=>reject(new Error('WebP source could not be decoded'));
  image.src=src;
 });
}
function sourceFrame(index,proposed=false){
 const position=timelinePhase(index,manifests.motion.actors[bossId].clipSet);
 const image=position.phase==='active'?sourceImgs.active:
  proposed&&verifiedCandidate?uploadedImage:sourceImgs.windup;
 return {image,phase:position};
}
function applyBackdrop(){
 for(const stage of document.querySelectorAll('.stage'))stage.dataset.backdrop=ui.backdrop.value;
}
function draw(){
 if(!sourceImgs)return;
 for(let n=0;n<2;n++){
  const {image,phase}=sourceFrame(sequence,n===1);
  const ctx=sourceContexts[n];
  const rect=atlasRect(phase.frame);
  ctx.clearRect(0,0,384,384);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(image,rect.x,rect.y,rect.w,rect.h,0,0,384,384);
  const label=phase.phase.toUpperCase()+' '+String(phase.frameNumber).padStart(2,'0')+' / 24';
  (n===0?ui.originalCounter:ui.candidateCounter).textContent=label;
 }
 ui.timeline.value=String(sequence);
 ui.readout.textContent=timelinePhase(sequence,manifests.motion.actors[bossId].clipSet)
   .phase.toUpperCase()+' '+String(sequence%24+1).padStart(2,'0')+' / 24';
 ui.original.dataset.phase=sequence<24?'windup':'active';
 ui.proposed.dataset.phase=ui.original.dataset.phase;
 ui.original.dataset.frame=String(sequence);
 ui.proposed.dataset.frame=String(sequence);
 ui.proposed.dataset.verified=String(Boolean(verifiedCandidate));
 forgetScreenshot();
}
function setWindow(){
 stop();
 const w=reviewWindow(ui.mode.value);
 ui.timeline.min=String(w.min);ui.timeline.max=String(w.max);
 if(sequence<w.min||sequence>w.max)sequence=w.min;
 if(sourceImgs)draw();
}
function step(amount){
 stop();if(!sourceImgs)return;
 sequence=stepFrame(sequence,amount,reviewWindow(ui.mode.value));draw();
}
function tick(now){
 if(!playing||!sourceImgs)return;
 if(previousTime>0)carry+=Math.min(250,now-previousTime);
 previousTime=now;
 const clips=manifests.motion.actors[bossId].clipSet;
 const frameTime=timelinePhase(sequence,clips).frameMs/Number(ui.speed.value);
 let steps=0;
 while(carry>=frameTime && steps<10){
  carry-=frameTime;
  sequence=stepFrame(sequence,1,reviewWindow(ui.mode.value));
  steps++;
 }
 if(steps)draw();
 raf=requestAnimationFrame(tick);
}
function toggle(){
 if(playing){stop();return;}
 if(!sourceImgs)return;
 if(motionMedia.matches){say('Reduced-motion preference is active. Use frame stepping.');return;}
 playing=true;previousTime=0;carry=0;
 ui.play.textContent='Pause both';ui.play.setAttribute('aria-pressed','true');
 raf=requestAnimationFrame(tick);
}
function shaHex(buf){
 return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function verifyCandidate(){
 if(!manifests||!sourceImgs||!uploadedFile||!uploadedImage||!uploadedReceipt){
  verifiedCandidate=null;ui.capture.disabled=true;ui.verifiedStatus.textContent='Pending';
  draw();return;
 }
 try{
  const evidence=extractCandidateReceipt(uploadedReceipt,bossId,manifests.motion);
  if(evidence.candidateHash!==uploadedHash)
    throw new Error('SHA-256 mismatch: proposed WebP differs from the CI receipt');
  verifiedCandidate=evidence;
  ui.verifiedStatus.textContent='Verified';
  ui.capture.disabled=false;
  ui.candidateCaption.textContent='Uploaded '+uploadedFile.name+' · SHA-256 matched the CI generator receipt';
  const result=compareSeams();
  ui.candidateScore.textContent=result.candidate.toFixed(2);
  ui.ratioScore.textContent=result.original>0?(result.candidate/result.original).toFixed(2)+'×':'—';
  say('Candidate verified for '+bossId+'. Inspect frame 24 → active frame 1.');
 }catch(error){
  verifiedCandidate=null;ui.verifiedStatus.textContent='Rejected';
  ui.capture.disabled=true;
  ui.candidateCaption.textContent='Rejected candidate: '+String(error.message||error);
  say('Candidate verification failed: '+String(error.message||error));
 }
 draw();
}
async function loadCandidate(){
 stop();forgetScreenshot();
 const file=ui.input.files?.[0];
 verifiedCandidate=null;uploadedImage=null;uploadedFile=null;uploadedHash='';
 ui.capture.disabled=true;ui.verifiedStatus.textContent='Pending';
 if(candidateURL){URL.revokeObjectURL(candidateURL);candidateURL='';}
 if(!file){draw();return;}
 const epoch=version;
 try{
  if(file.size===0||file.size>30_000_000||!file.name.toLowerCase().endsWith('.webp'))
    throw new Error('Please choose one WebP strip smaller than 30 MB');
  const data=await file.arrayBuffer();
  if(!crypto.subtle)throw new Error('A secure localhost context is required for SHA-256');
  const hash=shaHex(await crypto.subtle.digest('SHA-256',data));
  const url=URL.createObjectURL(file);
  const image=await imageFromURL(url).catch(error=>{URL.revokeObjectURL(url);throw error;});
  if(epoch!==version){URL.revokeObjectURL(url);return;}
  candidateURL=url;uploadedFile=file;uploadedImage=image;uploadedHash=hash;
  await verifyCandidate();
 }catch(error){
  if(epoch!==version)return;
  say('Candidate load failed: '+String(error.message||error));
  ui.verifiedStatus.textContent='Rejected';
  draw();
 }
}
async function loadReceiptFile(){
 stop();forgetScreenshot();
 const file=ui.receiptFile.files?.[0];
 uploadedReceipt=null;verifiedCandidate=null;ui.capture.disabled=true;
 if(!file){draw();return;}
 if(file.size===0||file.size>2_000_000){say('Receipt file exceeds the 2 MB limit');return;}
 const epoch=version;
 try{
  const parsed=JSON.parse(await file.text());
  if(epoch!==version)return;
  uploadedReceipt=parsed;await verifyCandidate();
 }catch(error){
  if(epoch!==version)return;
  say('Receipt parsing failed: '+String(error.message||error));
  ui.verifiedStatus.textContent='Rejected';draw();
 }
}
function sampleThumb(image,frame){
 const alphaCanvas=document.createElement('canvas');
 alphaCanvas.width=alphaCanvas.height=48;
 const alphaCtx=alphaCanvas.getContext('2d',{willReadFrequently:true});
 const colorCanvas=document.createElement('canvas');
 colorCanvas.width=colorCanvas.height=48;
 const colorCtx=colorCanvas.getContext('2d',{willReadFrequently:true});
 const box=atlasRect(frame);
 for(const ctx of [alphaCtx,colorCtx])ctx.imageSmoothingEnabled=true;
 alphaCtx.drawImage(image,box.x,box.y,box.w,box.h,0,0,48,48);
 colorCtx.fillStyle='rgb(79,84,92)';
 colorCtx.fillRect(0,0,48,48);
 colorCtx.drawImage(image,box.x,box.y,box.w,box.h,0,0,48,48);
 const colored=colorCtx.getImageData(0,0,48,48).data;
 const alpha=alphaCtx.getImageData(0,0,48,48).data;
 return {colored,alpha};
}
function foregroundDifference(windup,active){
 const a=sampleThumb(windup,23),b=sampleThumb(active,0);
 let total=0,count=0;
 for(let i=0;i<48*48;i++){
  const p=4*i;
  if(a.alpha[p+3]<24&&b.alpha[p+3]<24)continue;
  const la=.2126*a.colored[p]+.7152*a.colored[p+1]+.0722*a.colored[p+2];
  const lb=.2126*b.colored[p]+.7152*b.colored[p+1]+.0722*b.colored[p+2];
  total+=Math.abs(la-lb);count++;
 }
 return count?total/count:0;
}
function compareSeams(){
 const original=foregroundDifference(sourceImgs.windup,sourceImgs.active);
 const candidate=foregroundDifference(verifiedCandidate?uploadedImage:sourceImgs.windup,sourceImgs.active);
 return {original,candidate};
}
async function selectBoss(){
 stop();resetCandidate();sourceImgs=null;version++;const stamp=version;
 bossId=ui.boss.value;fillReview();
 ui.baselineScore.textContent='—';ui.candidateScore.textContent='—';ui.ratioScore.textContent='—';
 ui.play.disabled=true;ui.prev.disabled=true;ui.next.disabled=true;
 say('Loading original '+bossId+' windup and active WebP strips…');
 try{
  const clips=manifests.motion.actors[bossId].clipSet;
  const [windup,active]=await Promise.all([
   imageFromURL(ROOT+clips.windup.path),imageFromURL(ROOT+clips.active.path)
  ]);
  if(stamp!==version)return;
  sourceImgs={windup,active};
  sequence=reviewWindow(ui.mode.value).min;
  ui.play.disabled=false;ui.prev.disabled=false;ui.next.disabled=false;
  const score=compareSeams().original;
  ui.baselineScore.textContent=score.toFixed(2);
  ui.candidateScore.textContent='—';
  ui.ratioScore.textContent='—';
  draw();say('Original phase boundary loaded. Choose a candidate WebP and its JSON receipt.');
 }catch(error){
  if(stamp!==version)return;
  say('Original art unavailable: '+String(error.message||error));
 }
}
function backdropDraw(ctx,x,y,w,h){
 const kind=ui.backdrop.value;
 if(kind==='checker'){
  ctx.fillStyle='#565f67';ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#77828a';
  for(let i=0;i<Math.ceil(w/20);i++)for(let j=0;j<Math.ceil(h/20);j++)
   if((i+j)%2===0)ctx.fillRect(x+20*i,y+20*j,20,20);
 }else{
  ctx.fillStyle=COLORS[kind];ctx.fillRect(x,y,w,h);
 }
}
function wrapLines(ctx,text,x,y,width,step,max){
 let line='',lineNo=0;
 for(const word of String(text||'No review notes.').split(/\s+/)){
  const next=line?line+' '+word:word;
  if(line&&ctx.measureText(next).width>width){
   ctx.fillText(line,x,y+lineNo*step);
   if(++lineNo>=max)return;
   line=word;
  }else line=next;
 }
 if(line&&lineNo<max)ctx.fillText(line,x,y+lineNo*step);
}
function makeScreenshot(){
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=720;
 const ctx=canvas.getContext('2d');
 ctx.fillStyle='#111821';ctx.fillRect(0,0,1080,720);
 ctx.fillStyle='#e5c38d';ctx.font='16px sans-serif';
 ctx.fillText('BELLS OF THE BLACK CHRYSANTHEMUM / ATTACK CUTOVER REVIEW ONLY',20,32);
 ctx.font='35px Georgia,serif';ctx.fillStyle='#f0e3cc';
 ctx.fillText(BOSSES.find(x=>x.id===bossId).label,20,76);
 ctx.font='18px sans-serif';
 ctx.fillText('ORIGINAL WINDUP → ACTIVE',24,116);
 ctx.fillText('UPLOADED WINDUP → ACTIVE',546,116);
 for(let n=0;n<2;n++){
  const x=n?544:20,y=130;
  backdropDraw(ctx,x,y,512,446);
  const {image,phase}=sourceFrame(sequence,n===1);
  const box=atlasRect(phase.frame);
  ctx.drawImage(image,box.x,box.y,box.w,box.h,x+49,y+7,425,425);
 }
 ctx.fillStyle='#e8c692';ctx.font='17px sans-serif';
 ctx.fillText(ui.readout.textContent,25,605);
 const m=compareSeams();
 ctx.fillText('Original seam: '+m.original.toFixed(2)+'  Candidate seam: '+m.candidate.toFixed(2),545,605);
 ctx.fillStyle='#d4c8b8';ctx.font='15px sans-serif';
 wrapLines(ctx,notes.entries[bossId].note,25,638,995,23,3);
 return canvas;
}
async function capture(){
 if(!verifiedCandidate||!uploadedImage||!sourceImgs)return;
 stop();ui.capture.disabled=true;forgetScreenshot();
 const state=JSON.stringify({bossId,sequence,speed:ui.speed.value,mode:ui.mode.value,
  backdrop:ui.backdrop.value,notes:notes.entries[bossId],hash:uploadedHash,version});
 try{
  const screenshot=makeScreenshot();
  const blob=await new Promise(resolve=>screenshot.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('PNG capture failed');
  const screenshotSha256=shaHex(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));
  const again=JSON.stringify({bossId,sequence,speed:ui.speed.value,mode:ui.mode.value,
   backdrop:ui.backdrop.value,notes:notes.entries[bossId],hash:uploadedHash,version});
  if(again!==state)throw new Error('Review state changed during PNG hashing; capture again');
  exportedReceipt=exportReviewReceipt({
   bossId,index:sequence,mode:ui.mode.value,backdrop:ui.backdrop.value,
   speed:Number(ui.speed.value),clipSet:manifests.motion.actors[bossId].clipSet,
   candidate:verifiedCandidate,notes:{...notes.entries[bossId]},screenshotSha256
  });
  ui.downloadReceipt.disabled=false;
  fileDownload(blob,'jrpg-'+bossId+'-cutover-frame-'+sequence+'.png');
  say('PNG captured. Download its paired JSON SHA-256 evidence.');
 }catch(error){say('Capture failed: '+String(error.message||error));}
 finally{ui.capture.disabled=!verifiedCandidate;}
}
function exportNotes(){
 const payload={
  schema:CUTOVER_SCHEMA,generatedAt:new Date().toISOString(),
  reviewAuthority:'local only; seven original approvals remain pending',
  entries:notes.entries,
 };
 fileDownload(new Blob([JSON.stringify(payload,null,2)+'\n'],{type:'application/json'}),
  'jrpg-attack-cutover-human-review.json');
}
function wire(){
 ui.boss.addEventListener('change',selectBoss);
 ui.mode.addEventListener('change',setWindow);
 ui.backdrop.addEventListener('change',()=>{applyBackdrop();forgetScreenshot();});
 ui.speed.addEventListener('change',()=>{carry=0;forgetScreenshot();});
 ui.candidate.addEventListener('change',loadCandidate);
 ui.receiptFile.addEventListener('change',loadReceiptFile);
 ui.timeline.addEventListener('input',()=>{stop();sequence=Number(ui.timeline.value);draw();});
 ui.prev.addEventListener('click',()=>step(-1));
 ui.next.addEventListener('click',()=>step(1));
 ui.play.addEventListener('click',toggle);
 ui.decision.addEventListener('input',rememberReview);
 ui.notes.addEventListener('input',rememberReview);
 ui.capture.addEventListener('click',capture);
 ui.downloadReceipt.addEventListener('click',()=>{
  if(!exportedReceipt)return;
  fileDownload(new Blob([JSON.stringify(exportedReceipt,null,2)+'\n'],{type:'application/json'}),
   'jrpg-'+bossId+'-cutover-frame-'+sequence+'.json');
 });
 ui.exportNotes.addEventListener('click',exportNotes);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 motionMedia.addEventListener('change',()=>{if(motionMedia.matches)stop();});
}
async function main(){
 notes=loadNotes();
 fillReview();ui.capture.disabled=true;ui.downloadReceipt.disabled=true;
 ui.play.disabled=true;ui.prev.disabled=true;ui.next.disabled=true;
 wire();applyBackdrop();
 try{
  const [keys,motion,roster]=await Promise.all([
   fetchJson(ROOT+'manifest.json'),fetchJson(ROOT+'motion-manifest.json'),
   fetchJson('../assets/art/roster-keystone/roster.json')
  ]);
  validateCatalog(keys,motion,roster);manifests={keys,motion,roster};
  const requested=new URLSearchParams(location.search).get('boss');
  if(BOSSES.some(x=>x.id===requested))ui.boss.value=requested;
  setWindow();await selectBoss();
 }catch(error){say('Original art manifest unavailable: '+String(error.message||error)+'. Serve from repository root.');}
}
main();
