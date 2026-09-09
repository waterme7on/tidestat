import {createLanguageMenu} from './language-menu.js';
import {icon} from './ui-icons.js';
import {initProductMotion} from './ui-motion.js';
import {polishUI} from './ui-polish.js';
// Shared product identity and preferences; never translate customer content or code.
const engine=window.__tideI18n;
export const locale=()=>engine?.locale||'en-US';
export const tr=(message,values={})=>engine?.t(message,values)||message;
const remembered=new WeakMap(),attributes=new WeakMap();
const excluded='script,style,pre,code,textarea,[contenteditable],[data-no-translate],.visitor-face';
export function translate(root=document){
 polishUI(root);
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){
  const node=walker.currentNode;if(node.parentElement?.closest(excluded))continue;
  const current=node.nodeValue,prior=remembered.get(node),source=prior&&current===prior.rendered?prior.source:current;
  const trimmed=source.trim();if(!trimmed)continue;
  const rendered=source.replace(trimmed,tr(trimmed));remembered.set(node,{source,rendered});if(current!==rendered)node.nodeValue=rendered;
 }
 for(const element of root.querySelectorAll('[placeholder],[aria-label],[title],[alt]')){
  if(element.closest(excluded))continue;
  const cache=attributes.get(element)||{};
  for(const key of ['placeholder','aria-label','title','alt']){
   if(!element.hasAttribute(key))continue;
   const current=element.getAttribute(key),prior=cache[key],source=prior&&current===prior.rendered?prior.source:current,rendered=tr(source);
   cache[key]={source,rendered};if(rendered!==current)element.setAttribute(key,rendered);
  }attributes.set(element,cache);
 }

 document.querySelectorAll('[data-product-theme]').forEach(button=>button.setAttribute('aria-checked',String(window.__tideTheme.resolved==='dark')));
}
export function registerMessages(messages){engine?.registerMessages(messages);engine?.registerMessages(Object.fromEntries(Object.entries(messages).map(([en,zh])=>[en.replace(/\s*[↗→↓]$/u,''),zh.replace(/\s*[↗→↓]$/u,'')])));translate();}
registerMessages({'Close settings':'关闭设置','Your workspace':'你的工作区','Settings':'设置','Language':'语言','Browser language':'跟随浏览器','Theme':'主题','System':'跟随系统','Light':'浅色','Dark':'深色','TideStat home':'TideStat 首页','Dark theme':'深色主题','Auto':'自动'});
export const brandSVG='<svg class="tide-brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M3 19c5 0 5-9 10-9s5 12 10 12 5-9 6-9M3 25c5 0 5-9 10-9s5 12 10 12 5-9 6-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
export function createThemeSwitch() {
 const wrapper=document.createElement('div');
 wrapper.innerHTML='<button type="button" class="theme-switch" data-product-theme role="switch" aria-label="Dark theme" aria-checked="false"><span class="theme-switch-thumb" aria-hidden="true"></span>'+icon('sun','theme-sun')+''+icon('moon','theme-moon')+'</button>';
 const button=wrapper.firstElementChild;
 button.setAttribute('aria-checked',String(window.__tideTheme.resolved==='dark'));
 button.onclick=()=>window.__tideTheme.setPreference(window.__tideTheme.resolved==='dark'?'light':'dark');
 return button;
}
function init(){
 for(const brand of document.querySelectorAll('.brand')){
  if(brand.querySelector('.tide-brand-mark'))continue;
  brand.querySelectorAll('svg,.mark,#brandMark').forEach(mark=>mark.remove());brand.insertAdjacentHTML('afterbegin',brandSVG);
 }
 for(const host of document.querySelectorAll('[data-product-controls]')){
  if(host.children.length)continue;
  host.classList.add('product-controls');host.append(createLanguageMenu(engine),createThemeSwitch());
 }
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('#settingsSheet[open]'))for(const menu of document.querySelectorAll('.workspace-settings[open]')){menu.open=false;menu.querySelector('summary').focus();}});
 document.addEventListener('pointerdown',e=>{for(const menu of document.querySelectorAll('.workspace-settings[open]'))if(!document.querySelector('#settingsSheet[open]')&&!menu.contains(e.target))menu.open=false;});
 initProductMotion();translate();let pending=false;
 new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;translate();});}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','alt']});
}
window.addEventListener('tide:languagechange',()=>translate());window.addEventListener('tide:themechange',()=>translate());
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
