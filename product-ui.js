// Shared product identity and preferences; never translate customer content or code.
const engine=window.__tideI18n;
export const locale=()=>engine?.locale||'en-US';
export const tr=(message,values={})=>engine?.t(message,values)||message;
const remembered=new WeakMap(),attributes=new WeakMap();
const excluded='script,style,pre,code,textarea,[contenteditable],[data-no-translate],.visitor-face';
export function translate(root=document){
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
 document.querySelectorAll('[data-product-language]').forEach(select=>select.value=engine.preference);
 document.querySelectorAll('[data-product-theme]').forEach(button=>button.setAttribute('aria-checked',String(window.__tideTheme.resolved==='dark')));
}
export function registerMessages(messages){engine?.registerMessages(messages);translate();}
registerMessages({'Language':'语言','Browser language':'跟随浏览器','Theme':'主题','System':'跟随系统','Light':'浅色','Dark':'深色','TideStat home':'TideStat 首页','Dark theme':'深色主题','Auto':'自动'});
export const brandSVG='<svg class="tide-brand-mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M3 19c5 0 5-9 10-9s5 12 10 12 5-9 6-9M3 25c5 0 5-9 10-9s5 12 10 12 5-9 6-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
export function createThemeSwitch() {
 const wrapper=document.createElement('div');
 wrapper.innerHTML='<button type="button" class="theme-switch" data-product-theme role="switch" aria-label="Dark theme" aria-checked="false"><span class="theme-switch-thumb" aria-hidden="true"></span><svg class="theme-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><svg class="theme-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z"/></svg></button>';
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
  host.classList.add('product-controls');host.innerHTML='<label class="language-control"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/></svg><span class="product-sr-only">Language</span><select data-product-language aria-label="Language"><option value="system">Auto</option><option value="en">English</option><option value="zh">简体中文</option></select></label>';
  host.append(createThemeSwitch());
  const language=host.querySelector('[data-product-language]');if(!document.getElementById('languageSelect'))language.id='languageSelect';
  language.onchange=e=>engine.setLanguage(e.target.value);host.querySelector('[data-product-theme]').onclick=()=>window.__tideTheme.setPreference(window.__tideTheme.resolved==='dark'?'light':'dark');
 }
 translate();let pending=false;
 new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;translate();});}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','alt']});
}
window.addEventListener('tide:languagechange',()=>translate());window.addEventListener('tide:themechange',()=>translate());
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
