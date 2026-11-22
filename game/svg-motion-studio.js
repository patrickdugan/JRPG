/** Developer-only SVG production studio. SVG sheets stay inert display images. */
const SCRIPT_DIR = './assets/art/svg-cel-suite-v1/';
const response=await fetch(SCRIPT_DIR+'cast.json',{cache:'no-store'});
if(!response.ok)throw new Error('No committed SVG cast manifest: '+response.status);
const CAST=await response.json();
const id=(key)=>document.getElementById(key);
const list=id('castList');
const search=id('filter');
const poses=id('poseButtons');
const view=id('viewMode');
const img=id('sheetImage');
const toggle=id('playToggle');
let actor=CAST.cast[0],mode='action',frame=0;
let timer=null;
let playStarted=0;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const poseNames=()=>mode==='action'?CAST.actionFrame.frames:actor.group==='npc'?CAST.npcFieldFrame.frames:CAST.fieldFrame.frames;
const sheetPath=()=>SCRIPT_DIR+'sheets/'+actor.id+'-'+mode+'.svg';
function stop() {
 if(timer!==null)cancelAnimationFrame(timer);
 timer=null;toggle.setAttribute('aria-pressed','false');toggle.textContent='Play animation';
}
function showFrame(index) {
 const names=poseNames();frame=(index+names.length)%names.length;
 img.setAttribute('x',String(-frame*CAST.actionFrame.width));
 img.setAttribute('width',String(names.length*CAST.actionFrame.width));
 img.setAttribute('href',sheetPath());
 id('poseName').textContent=names[frame]+' · '+(frame+1)+'/'+names.length;
 for(const b of poses.querySelectorAll('button'))b.setAttribute('aria-pressed',String(Number(b.dataset.pose)===frame));
}
function loadAsset(next) {
 stop();
 actor=next;
 if(actor.group==='npc')mode='field';
 if(mode==='field'&&actor.group!=='party'&&actor.group!=='npc')mode='action';
 view.value=mode;
 view.querySelector('option[value=field]').disabled=actor.group!=='party'&&actor.group!=='npc';
 view.querySelector('option[value=action]').disabled=actor.group==='npc';
 id('characterName').textContent=actor.name;
 id('identityNote').textContent=actor.group+' · '+actor.rig+' vector rig · '+actor.equipment+' · '+actor.outfit;
 id('conceptLink').href='https://github.com/patrickdugan/JRPG/blob/main/'+actor.reference;
 id('conceptLink').textContent=actor.reference;
 id('downloadSheet').href=sheetPath();
 id('downloadSheet').setAttribute('download',actor.id+'-'+mode+'.svg');
 id('status').textContent='Identity '+(CAST.cast.indexOf(actor)+1)+' of '+CAST.cast.length;
 for(const b of list.querySelectorAll('button'))b.setAttribute('aria-current',String(b.dataset.actor===actor.id));
 poses.replaceChildren();
 poseNames().forEach((name,i)=>{
   const b=document.createElement('button');
   b.type='button';b.dataset.pose=String(i);b.textContent=name.replace(/-/g,' ');
   b.addEventListener('click',()=>{stop();showFrame(i)});
   poses.append(b);
 });
 showFrame(0);
}
function fillList(query='') {
 const needle=query.trim().toLowerCase();list.replaceChildren();
 const matches=CAST.cast.filter(a=>(a.name+' '+a.group+' '+a.equipment).toLowerCase().includes(needle));
 for(const a of matches) {
   const b=document.createElement('button');
   b.type='button';b.dataset.actor=a.id;b.textContent=a.name;
   b.addEventListener('click',()=>loadAsset(a));
   list.append(b);
 }
}
function playMotion() {
 if(timer!==null){stop();return}
 if(reducedMotion.matches){id('status').textContent='Reduced motion active; step poses manually.';return}
 toggle.setAttribute('aria-pressed','true');toggle.textContent='Stop animation';
 playStarted=performance.now();
 let oldIndex=-1;
 function tick(now) {
   if(timer===null)return;
   // Cycle meaningful animation bands, avoiding random time-based phase mixing.
   const cycle=mode==='action'?[0,1,2,3,5,5,6,6,7,0,9,9,7,0]:actor.group==='npc'?[0,1,0,1]:[0,1,0,1];
   const current=cycle[Math.floor(Math.max(0,now-playStarted)/170)%cycle.length];
   if(current!==oldIndex)showFrame(current);
   oldIndex=current;timer=requestAnimationFrame(tick);
 }
 timer=requestAnimationFrame(tick);
}
view.addEventListener('change',()=>{
 mode=view.value;
 loadAsset(actor);
});
search.addEventListener('input',()=>fillList(search.value));
toggle.addEventListener('click',playMotion);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)stop()});
fillList();
const query=new URLSearchParams(location.search).get('actor');
loadAsset(CAST.cast.find(a=>a.id===query)||CAST.cast[0]);
