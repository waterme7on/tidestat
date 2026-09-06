import {registerMessages} from './product-ui.js';
registerMessages({'Revenue Stories ↗':'收入故事 ↗','View revenue story →':'查看收入故事 →','External link clicked':'点击外部链接','Verified payment':'已验证付款','Verified refund':'已验证退款','Signed up':'完成注册','Started checkout':'进入结账','Purchase reported (unverified)':'购买事件（未验证）','Live signals':'实时访客画像','Sources':'来源','Countries':'国家','Devices':'设备','Acquisition':'流量来源','Entry page':'进入页面','Campaign term':'推广词','Viewport':'视口','Sessions':'访问次数'});
const icons={source:'M4 17 17 4M5 4h12v12',location:'M18 9c0 5-6 11-6 11S6 14 6 9a6 6 0 1 1 12 0Z M14 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0',device:'M3 4h18v12H3z M8 20h8 M12 16v4',coin:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0 M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9 M12 6v12',page:'M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h5',session:'M4 8h16 M8 4 4 8l4 4 M20 16H4 M16 12l4 4-4 4'};
const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${`<path d="${icons[name]||icons.page}"/>`}</svg>`;
const isEnglish=()=>window.__tideI18n?.language==='en';
const label=(en,zh)=>isEnglish()?en:zh;
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(className)e.className=className;return e;};
export function visitorContextCard(visitor) {
 const c=visitor.context||{}, wrapper=node('div',null,'visitor-context-grid');
 const unknown=label('Unknown','未知');
 const values=[['source',label('Acquisition','流量来源'),[c.channel,visitor.source||c.referrer].filter(Boolean).join(' · ')||unknown],['location',label('Location','地理位置'),[c.country,c.region,c.city].filter(Boolean).join(' / ')||unknown],['device',label('Device','设备'),[c.device||visitor.device,c.os,c.browser].filter(Boolean).join(' · ')||unknown],['page',label('Entry page','进入页面'),visitor.entryPage||visitor.paths?.[0]?.path||unknown]];
 if(c.campaign)values.push(['source',label('Campaign','推广活动'),c.campaign]);
 if(c.keyword)values.push(['source',label('Campaign term','推广词'),c.keyword]);
 if(c.viewportWidth&&c.viewportHeight)values.push(['device',label('Viewport','视口'),`${c.viewportWidth} × ${c.viewportHeight}`]);
 if(visitor.sessionCount)values.push(['session',label('Sessions','访问次数'),String(visitor.sessionCount)]);
 for(const [icon,title,value] of values){const row=node('div');const visual=node('i');visual.innerHTML=svg(icon);const copy=node('div');copy.append(node('small',title),node('b',value));row.append(visual,copy);wrapper.append(row);}
 return wrapper;
}
const signals=document.getElementById('liveSignals');
function top(values) {const map=new Map();for(const value of values)map.set(value,(map.get(value)||0)+1);return [...map].sort((a,b)=>b[1]-a[1]).slice(0,3);}
function renderSignals() {
 if(!signals||document.hidden)return;
 const bridge=window.__tide||{}, people=[...(bridge.visitors?.values()||[])].filter(v=>v.state!=='leaving');
 const stale=bridge.status==='error';
 const summary=signals.querySelector('summary span');summary.textContent=label('Live signals','实时访客画像');
 const body=signals.querySelector('.signals-body');body.replaceChildren();
 for(const [icon,title,values] of [['source',label('Sources','来源'),people.map(v=>v.source||v.context?.referrer||label('Unknown','未知'))],['location',label('Countries','国家'),people.map(v=>v.context?.country||v.city?.[1]||label('Unknown','未知'))],['device',label('Devices','设备'),people.map(v=>v.context?.device||v.device||label('Unknown','未知'))]]) {
  const row=node('div',null,'signal-row'),heading=node('div',null,'signal-label');heading.innerHTML=svg(icon);heading.append(node('span',title));const chips=node('div',null,'signal-chips');
  for(const [name,count] of top(values)){const chip=node('span',null,'signal-chip');chip.append(node('b',name),node('small',String(count)));chips.append(chip);}
  if(!values.length)chips.append(node('span',label('No visitors','暂无访客'),'signals-empty'));
  row.append(heading,chips);body.append(row);
 }
 const amount=new Map();for(const v of people)for(const event of v.events||[])if(['payment','refund'].includes(event.type)&&Number.isSafeInteger(event.amountMinor)){amount.set(event.currency,(amount.get(event.currency)||0)+event.amountMinor);}
 const footer=node('p',null,'signals-receipts');
 if(amount.size){const parts=[...amount].map(([currency,minor])=>{try{const format=new Intl.NumberFormat(undefined,{style:'currency',currency});return format.format(minor/10**format.resolvedOptions().maximumFractionDigits);}catch{return `${currency} ${minor}`;}});footer.textContent=label('Observed receipts · ','已记录收款 · ')+parts.join(' / ');}else footer.textContent=bridge.demo?label('Sample visitors · no estimated revenue','演示访客 · 不估算收入'):label('No payments in this live window','当前实时窗口暂无付款');
 body.append(footer);signals.classList.toggle('signals-stale',stale);if(stale)body.append(node('p',label('Last received data · reconnecting','上次收到的数据 · 正在重连'),'signals-receipts'));
}
if(signals){if(matchMedia('(min-width: 900px)').matches)signals.open=true;renderSignals();const timer=setInterval(renderSignals,1000);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});window.addEventListener('tide:languagechange',renderSignals);}
window.__tideVisitorContext=visitorContextCard;
