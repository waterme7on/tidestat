import {icon} from './ui-icons.js';
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const t=(message,values)=>window.__tideI18n?.t(message,values)||message;
const actionAnimations=new WeakMap();

// Small state changes keep the original control and its accessible name.
export function actionState(button,state,label){
 if(!button)return;
 actionAnimations.get(button)?.cancel();
 if(!button.style.minInlineSize&&button.getBoundingClientRect().width)button.style.minInlineSize=`min(100%, ${Math.ceil(button.getBoundingClientRect().width)}px)`;
 button.dataset.actionState=state;
 button.setAttribute('aria-busy',String(state==='pending'));
 const content=document.createElement('span');content.className='action-state-content';
 const glyph={pending:'refresh',success:'check',error:'close',waiting:'clock',idle:button.id==='copyAgent'?'copy':'arrow'}[state];
 content.innerHTML=icon(glyph,'action-state-icon');
 const text=document.createElement('span');text.textContent=t(label);content.append(text);button.replaceChildren(content);
 if(!reduced())actionAnimations.set(button,content.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:170,easing:'cubic-bezier(.2,.8,.2,1)'}));
}

export function verificationState(element,state,message,receivedAt){
 element.dataset.status=state;
 const visual=document.createElement('span');visual.className='verification-symbol';visual.innerHTML=icon({pending:'refresh',success:'verified',error:'close',waiting:'clock'}[state]||'clock');
 const copy=document.createElement('span');copy.className='verification-copy';const text=document.createElement('span');text.textContent=t(message);copy.append(text);
 if(state==='success'&&Number.isFinite(receivedAt)){const receipt=document.createElement('time');receipt.dateTime=new Date(receivedAt).toISOString();receipt.textContent=t('Received at {time}',{time:new Date(receivedAt).toLocaleTimeString(window.__tideI18n?.locale)});copy.append(receipt);}
 element.replaceChildren(visual,copy);
 if(!reduced())element.animate([{opacity:.4,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'ease-out'});
}

function settingsSheet(){
 const details=document.querySelector('.workspace-settings'),panel=details?.querySelector('.settings-panel');if(!panel)return;
 const trigger=details.querySelector('summary'),mobile=matchMedia('(max-width:760px)');
 const dialog=document.createElement('dialog');dialog.id='settingsSheet';dialog.className='settings-sheet';dialog.setAttribute('aria-labelledby','settingsSheetTitle');
 dialog.innerHTML=`<button type="button" class="sheet-grip" aria-label="Close settings"><span></span></button><div class="sheet-heading"><div><p class="sheet-eyebrow">Your workspace</p><h2 id="settingsSheetTitle">Settings</h2></div><button type="button" class="sheet-close" aria-label="Close settings">${icon('close')}</button></div><div class="sheet-content"></div>`;
 document.body.append(dialog);
 let opened=false,closing=false,animation,scrollStyle='',drag=null,suppressClick=false;
 const grip=dialog.querySelector('.sheet-grip');
 function restore({focus=true,popover=false}={}){
  animation?.cancel();animation=null;closing=false;opened=false;dialog.style.transform='';
  details.append(panel);details.open=popover;trigger.setAttribute('aria-expanded',String(popover));document.body.style.overflow=scrollStyle;
  if(dialog.open)dialog.close();
  if(focus&&trigger.isConnected)trigger.focus({preventScroll:true});
 }
 function close({animate=true,focus=true,popover=false}={}){
  if(!opened||closing)return;
  closing=true;
  if(!animate||reduced()){restore({focus,popover});return;}
  const from=getComputedStyle(dialog).transform;
  animation?.cancel();animation=dialog.animate([{transform:from==='none'?'translateY(0)':from,opacity:1},{transform:'translateY(105%)',opacity:.7}],{duration:190,easing:'cubic-bezier(.4,0,1,1)',fill:'forwards'});
  animation.finished.then(()=>restore({focus,popover})).catch(()=>{});
 }
 function open(){
  if(opened)return;
  opened=true;closing=false;scrollStyle=document.body.style.overflow;document.body.style.overflow='hidden';details.open=true;trigger.setAttribute('aria-expanded','true');
  dialog.querySelector('.sheet-content').append(panel);dialog.showModal();dialog.querySelector('.sheet-close').focus({preventScroll:true});
  if(!reduced())animation=dialog.animate([{transform:'translateY(100%)',opacity:.6},{transform:'translateY(0)',opacity:1}],{duration:280,easing:'cubic-bezier(.16,1,.3,1)'});
 }
 trigger.addEventListener('click',event=>{if(mobile.matches){event.preventDefault();if(opened)close();else open();}});
 details.addEventListener('toggle',()=>{if(!opened)trigger.setAttribute('aria-expanded',String(details.open));});
 dialog.querySelector('.sheet-close').onclick=()=>close();
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('close',()=>{if(opened)restore();});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
 // Close before another modal opens; retain the actual controls and their listeners.
 dialog.addEventListener('click',event=>{if(event.target.closest('#manageConnection,a'))close({animate:false,focus:false});},true);
 grip.addEventListener('pointerdown',event=>{if(!event.isPrimary||event.button!==0||closing)return;animation?.cancel();drag={id:event.pointerId,y:event.clientY,lastY:event.clientY,lastTime:event.timeStamp,velocity:0,distance:0};grip.setPointerCapture(event.pointerId);});
 grip.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;drag.velocity=(event.clientY-drag.lastY)/Math.max(1,event.timeStamp-drag.lastTime);drag.lastY=event.clientY;drag.lastTime=event.timeStamp;drag.distance=Math.max(0,event.clientY-drag.y);dialog.style.transform=`translateY(${drag.distance}px)`;});
 function endDrag(event,cancel=false){if(!drag||drag.id!==event.pointerId)return;const {distance,velocity}=drag;drag=null;suppressClick=distance>6;if(grip.hasPointerCapture(event.pointerId))grip.releasePointerCapture(event.pointerId);if(!cancel&&(distance>90||(distance>24&&velocity>.55)))close();else{const from=dialog.style.transform;dialog.style.transform='';if(distance&&!reduced())animation=dialog.animate([{transform:from},{transform:'translateY(0)'}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'});}}
 grip.addEventListener('pointerup',event=>endDrag(event));grip.addEventListener('pointercancel',event=>endDrag(event,true));
 grip.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}close();});
 mobile.addEventListener('change',()=>{if(!mobile.matches&&opened){animation?.cancel();closing=false;close({animate:false,popover:true});}else if(mobile.matches&&details.open)open();});
 if(mobile.matches&&details.open)open();
}

function slidingTabs(nav){
 const links=[...nav.querySelectorAll('a[data-tab],button[role=tab],button[id^=tab-]')];if(!links.length)return;
 const indicator=document.createElement('span');indicator.className='sliding-tab-indicator';indicator.setAttribute('aria-hidden','true');nav.append(indicator);nav.classList.add('motion-tabs');
 let frame,animation,lastTransform='';
 function sync(){
  const active=links.find(link=>link.classList.contains('active')||link.getAttribute('aria-selected')==='true');if(!active)return;
  const rect=active.getBoundingClientRect(),parent=nav.getBoundingClientRect();if(!rect.width||!parent.width){indicator.style.opacity='0';lastTransform='';return;}
  const next=`translateX(${rect.left-parent.left+nav.scrollLeft}px) scaleX(${rect.width})`;
  if(next===lastTransform)return;
  const from=lastTransform?getComputedStyle(indicator).transform:next;animation?.cancel();indicator.style.opacity='1';indicator.style.transform=next;
  if(lastTransform&&!reduced())animation=indicator.animate([{transform:from},{transform:next}],{duration:260,easing:'cubic-bezier(.16,1,.3,1)'});
  lastTransform=next;
 }
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(sync);};
 new MutationObserver(schedule).observe(nav,{attributes:true,subtree:true,attributeFilter:['class','aria-selected'],characterData:true,childList:true});
 const resize=new ResizeObserver(schedule);resize.observe(nav);links.forEach(link=>resize.observe(link));nav.addEventListener('scroll',schedule,{passive:true});schedule();
 nav.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||!links.includes(event.target))return;event.preventDefault();const current=links.indexOf(event.target),index=event.key==='Home'?0:event.key==='End'?links.length-1:(current+(event.key==='ArrowRight'?1:-1)+links.length)%links.length;links[index].focus();links[index].click();});
}

export function initProductMotion(){
 settingsSheet();
 document.querySelectorAll('.top-tabs,.demo-tabs,body[data-view] header .tabs').forEach(slidingTabs);
 window.addEventListener('hashchange',()=>{if(reduced())return;requestAnimationFrame(()=>document.getElementById('content')?.animate([{opacity:.35,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'ease-out'}));});
}
