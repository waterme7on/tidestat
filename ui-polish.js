import {icon} from './ui-icons.js';
const symbolIcons={'↗':'external','→':'arrow','↓':'down','×':'close','✕':'close','+':'plus','−':'minus','↺':'refresh','↻':'refresh','⛶':'expand'};
// Only decorate interface controls, never customer text, code, data, charts or avatars.
export function polishUI(root=document){
 for(const host of root.querySelectorAll('[data-ui]')){if(host.querySelector('[data-ui-icon]'))continue;host.innerHTML=icon(host.dataset.ui);}
 for(const control of root.querySelectorAll('button,a,summary,.visitor-arrow,.path-chips i,.integration-arrow')){
  if(control.closest('[data-no-translate],pre,code,.visitor-face')||control.matches('[data-ui]'))continue;
  for(const node of [...control.childNodes]){
   if(node.nodeType!==Node.TEXT_NODE)continue;
   const match=node.textContent.match(/^(.*?)([↗→↓×✕+−↺↻⛶])\s*$/s);if(!match)continue;
   // Signs embedded in a numeric value or business copy are not interface icons.
   if(['+','−','×'].includes(match[2])&&match[1].trim())continue;
   if(match[1].trim())node.textContent=match[1].trimEnd()+' ';
   const span=document.createElement('span');span.className='ui-symbol';span.setAttribute('aria-hidden','true');span.innerHTML=icon(symbolIcons[match[2]]);
   if(match[1].trim())node.after(span);else node.replaceWith(span);
  }
 }
 for(const [selector,name] of Object.entries({'#mobileMenu':'menu','#refresh':'refresh','#mapReset':'target','#vdClose':'close','.menu':'menu','#copySnippet':'copy','#copyAgent':'copy','#signOut':'exit','#startWebsiteSetup':'code','#manageConnection':'settings','#setupProgress':'layers'})){
  for(const button of root.querySelectorAll(selector)){if(button.querySelector('[data-ui-icon],[data-icon]'))continue;button.insertAdjacentHTML('afterbegin',icon(name));}
 }
 for(const summary of root.querySelectorAll('details>summary')){if(summary.querySelector('.disclosure-icon'))continue;summary.insertAdjacentHTML('beforeend',icon('chevron','disclosure-icon'));}
}
