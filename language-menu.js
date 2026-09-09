import {icon} from './ui-icons.js';
// Popovers stay above maps and dialogs without adopting the OS select menu.
export function createLanguageMenu(engine){
 const host=document.createElement('div');host.className='language-control language-menu';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='language-trigger';trigger.dataset.productLanguage='';trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
 const menu=document.createElement('div');menu.className='language-options';menu.setAttribute('popover','auto');menu.setAttribute('role','menu');menu.setAttribute('aria-label','Language');
 menu.id=`language-options-${document.querySelectorAll('.language-menu').length}`;trigger.setAttribute('aria-controls',menu.id);
 const choices=[['system','Auto'],['en','English'],['zh','简体中文']];
 const buttons=choices.map(([value,label])=>{const button=document.createElement('button');button.type='button';button.dataset.language=value;button.setAttribute('role','menuitemradio');button.innerHTML=`<span>${label}</span>${icon('check')}`;button.onclick=()=>{engine.setLanguage(value);menu.hidePopover();trigger.focus();};menu.append(button);return button;});
 const position=()=>{const r=trigger.getBoundingClientRect();menu.style.left=`${Math.max(8,Math.min(r.left,innerWidth-208))}px`;menu.style.top=`${Math.max(8,Math.min(r.bottom+8,innerHeight-menu.offsetHeight-8))}px`;};
 const sync=()=>{const value=engine.preference,label=choices.find(c=>c[0]===value)?.[1]||'Auto';trigger.innerHTML=`${icon('language')}<span>${engine.t(label)}</span>${icon('chevron')}`;trigger.setAttribute('aria-label',`${engine.t('Language')}: ${engine.t(label)}`);buttons.forEach(b=>b.setAttribute('aria-checked',String(b.dataset.language===value)));};
 const open=(last=false)=>{menu.showPopover();position();(last?buttons.at(-1):buttons.find(b=>b.dataset.language===engine.preference)||buttons[0]).focus();};
 trigger.onclick=()=>menu.matches(':popover-open')?menu.hidePopover():open();
 trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open(e.key==='ArrowUp');}};
 menu.onkeydown=e=>{const i=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();menu.hidePopover();trigger.focus();}if(e.key==='Tab')menu.hidePopover();};
 menu.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(menu.matches(':popover-open'))));
 window.addEventListener('resize',()=>{if(menu.matches(':popover-open'))position();});window.addEventListener('scroll',()=>{if(menu.matches(':popover-open'))position();},true);
 window.addEventListener('tide:languagechange',sync);host.append(trigger,menu);sync();return host;
}
