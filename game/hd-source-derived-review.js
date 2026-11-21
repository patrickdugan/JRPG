const ROOT='./assets/art/hd-painted-v1/overlay-missing-v1/';
const canvas=document.querySelector('#stage'), ctx=canvas.getContext('2d',{willReadFrequently:true});
const actorSelect=document.querySelector('#actor'),clipSelect=document.querySelector('#clip');
const status=document.querySelector('#status'),trace=document.querySelector('#trace');
const play=document.querySelector('#play'),step=document.querySelector('#step');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let manifest=null,actorId='',clipId='',clip=null,image=null,frame=0,running=false,handle=null,last=0;

function stop(){
  running=false;if(handle!==null)cancelAnimationFrame(handle);handle=null;
  play.textContent='Play motion';play.setAttribute('aria-pressed','false');
}
function paint(){
  if(!image||!clip)return;
  ctx.clearRect(0,0,384,384);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(image,(frame%12)*192,Math.floor(frame/12)*192,192,192,0,0,384,384);
  canvas.dataset.imageReady='true';canvas.dataset.frame=String(frame);
  status.textContent=actorId+' / '+clipId+' / frame '+(frame+1)+'/24';
}
function selectClip(){
  stop();frame=0;canvas.dataset.imageReady='false';
  clipId=clipSelect.value;clip=manifest.actors[actorId].clipSet[clipId];
  trace.textContent='Source: '+manifest.actors[actorId].sourceFile+'; '+clip.uniqueFrames+' unique source-derived frames';
  const next=new Image();next.decoding='async';
  next.onload=()=>{if(clipId===clipSelect.value&&actorId===actorSelect.value){image=next;paint();}};
  next.onerror=()=>{status.textContent='Asset unavailable: '+clip.path;};
  image=null;next.src=ROOT+clip.path;
}
function selectActor(){
  stop();actorId=actorSelect.value;canvas.dataset.actor=actorId;
  clipSelect.replaceChildren();
  for(const id of Object.keys(manifest.actors[actorId].clipSet)){
    const option=document.createElement('option');option.value=id;option.textContent=id;clipSelect.append(option);
  }
  clipSelect.value=clipSelect.options[0].value;selectClip();
}
function animate(now){
  if(!running)return;
  if(now-last>=40){frame=(frame+1)%24;last=now;paint();}
  handle=requestAnimationFrame(animate);
}
play.addEventListener('click',()=>{
  if(running){stop();return;}
  if(reduced.matches){status.textContent='Reduced-motion preference: step frames manually.';return;}
  if(!image)return;running=true;last=0;play.textContent='Stop';play.setAttribute('aria-pressed','true');handle=requestAnimationFrame(animate);
});
step.addEventListener('click',()=>{stop();frame=(frame+1)%24;paint();});
clipSelect.addEventListener('change',selectClip);
actorSelect.addEventListener('change',selectActor);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
reduced.addEventListener('change',()=>{if(reduced.matches)stop();});

const response=await fetch(ROOT+'motion-manifest.json');
if(!response.ok){status.textContent='Motion assets unavailable (HTTP '+response.status+')';}
else {
  manifest=await response.json();
  const sorted=Object.keys(manifest.actors).sort();
  for(const id of sorted){const opt=document.createElement('option');opt.value=id;opt.textContent=id.replaceAll('-',' ');actorSelect.append(opt);}
  const requested=new URLSearchParams(location.search).get('enemy');
  actorSelect.value=sorted.includes(requested)?requested:sorted[0];
  selectActor();
}
