const KEY='tidestat:idle-rotation', reduced=matchMedia('(prefers-reduced-motion: reduce)');
let enabled=true,lastActivity=performance.now(),pressed=false;
try{enabled=localStorage.getItem(KEY)!=='off';}catch{}
const listeners=new Set();
const notify=()=>listeners.forEach(fn=>fn());
function touch(){lastActivity=performance.now();}
function down(){pressed=true;touch();}
function up(){pressed=false;touch();}
for(const event of ['pointermove','wheel','keydown','focusin'])document.addEventListener(event,touch,{passive:true});
document.addEventListener('pointerdown',down,{passive:true});
for(const event of ['pointerup','pointercancel'])document.addEventListener(event,up,{passive:true});
window.addEventListener('blur',up);document.addEventListener('visibilitychange',touch);
reduced.addEventListener('change',()=>{touch();notify();});
window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null){try{enabled=localStorage.getItem(KEY)!=='off';}catch{}touch();notify();}});
export const idleMotion={
  get enabled(){return enabled;},get reduced(){return reduced.matches;},
  reset:touch,
  canRotate(){return enabled&&!reduced.matches&&!pressed&&!document.activeElement?.matches('select,input,textarea')&&!document.hidden&&document.hasFocus()&&performance.now()-lastActivity>=12000&&!window.__tide?.selectedId&&!window.__tide?.timelineOpen;},
  toggle(){enabled=!enabled;try{localStorage.setItem(KEY,enabled?'on':'off');}catch{}touch();notify();},
  subscribe(fn){listeners.add(fn);fn();return()=>listeners.delete(fn);}
};
