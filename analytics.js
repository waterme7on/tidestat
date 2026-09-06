// Sanitized context and deterministic breakdowns. Search keywords are never visitor-level inference.
export function safeUrl(value) {
  try { const url=new URL(value);return ['http:','https:'].includes(url.protocol)?`${url.origin}${url.pathname}`.slice(0,512):''; } catch{return '';}
}
export function browserContext(userAgent='') {
  const ua=String(userAgent).slice(0,1024);
  const browser=/Edg\//.test(ua)?'Edge':/OPR\//.test(ua)?'Opera':/Firefox\/|FxiOS\//.test(ua)?'Firefox':/Chrome\/|CriOS\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':ua?'Other':'Unknown';
  const os=/Android/i.test(ua)?'Android':/iPhone|iPad|iPod/i.test(ua)?'iOS':/Windows/i.test(ua)?'Windows':/Macintosh|Mac OS X/i.test(ua)?'macOS':/Linux/i.test(ua)?'Linux':ua?'Other':'Unknown';
  return {browser,os};
}
export function channelOf(acquisition={}) {
  const medium=String(acquisition.medium||'').toLowerCase(),source=String(acquisition.source||'').toLowerCase();
  if(['cpc','ppc','paidsearch','paid_search'].includes(medium))return 'Paid Search';
  if(['paid_social','paidsocial'].includes(medium))return 'Paid Social';
  if(medium==='organic')return 'Organic Search';
  if(medium==='email')return 'Email';
  if(['social','social-network','social_media'].includes(medium))return 'Organic Social';
  if(['display','banner','cpm'].includes(medium))return 'Display';
  if(medium==='affiliate')return 'Affiliate';
  if(medium==='referral')return 'Referral';
  if((!source||source==='direct')&&(!medium||medium==='none'))return 'Direct';
  return 'Other';
}
export function captureContext(event,edge={}) {
  const width=Number(event.context?.viewport_width),height=Number(event.context?.viewport_height);
  return {channel:channelOf(event.acquisition),referrer:safeUrl(event.referrer),campaign:event.acquisition.campaign||'',keyword:event.acquisition.term||'',country:String(edge.country||'').slice(0,80),region:String(edge.region||edge.regionCode||'').slice(0,128),city:String(edge.city||'').slice(0,128),...browserContext(edge.userAgent),device:edge.device||'unknown',viewportWidth:Number.isInteger(width)&&width>0&&width<=20000?width:null,viewportHeight:Number.isInteger(height)&&height>0&&height<=20000?height:null};
}
export function readContext(value) {try{return typeof value==='string'?JSON.parse(value):value||{};}catch{return {};}}
export function analyticsReport(events,payments,visitors,sessions,from,to) {
  const maps={},keys=['channels','referrers','campaigns','keywords','countries','regions','cities','pages','entryPages','exitPages','outboundLinks','browsers','operatingSystems','devices'];
  for(const key of keys)maps[key]=new Map();
  const row=(key,name)=>{name=String(name||'Unknown');if(!maps[key].has(name))maps[key].set(name,{name,visitorSet:new Set(),pageviews:0,events:0,payments:0,revenue:{}});return maps[key].get(name);};
  const touch=(key,name,visitor,event)=>{const r=row(key,name);if(visitor)r.visitorSet.add(visitor);if(event){r.events++;if(event.type==='page_view')r.pageviews++;}return r;};
  const credit=(key,name,p)=>{const r=row(key,name);if(p.amount_minor>0)r.payments++;r.revenue[p.currency]=(r.revenue[p.currency]||0)+p.amount_minor;};
  const windowEvents=events.filter(e=>e.ts>=from&&e.ts<=to),activeVisitors=new Set(windowEvents.map(e=>e.visitor_id));
  const byVisitor=new Map(),bySession=new Map();
  for(const event of events){if(!byVisitor.has(event.visitor_id))byVisitor.set(event.visitor_id,[]);byVisitor.get(event.visitor_id).push(event);if(!bySession.has(event.session_id))bySession.set(event.session_id,[]);bySession.get(event.session_id).push(event);}
  const visitorMap=new Map(visitors.map(v=>[v.visitor_id,v])),sessionMap=new Map(sessions.map(s=>[s.session_id,s]));
  const dimensionNames=v=>{const c=readContext(v?.context);return {channels:c.channel||channelOf({source:v?.source,medium:v?.medium}),referrers:c.referrer||'Direct / unknown',campaigns:c.campaign||'No campaign',keywords:c.keyword||'No campaign keyword',countries:c.country||'Unknown',regions:c.region||'Unknown',cities:c.city||'Unknown',browsers:c.browser||'Unknown',operatingSystems:c.os||'Unknown',devices:c.device||'Unknown'};};
  for(const visitor of activeVisitors)for(const [key,name] of Object.entries(dimensionNames(visitorMap.get(visitor))))touch(key,name,visitor);
  const daily=new Map();
  const dayKey=ts=>new Date(ts).toISOString().slice(0,10);
  for(let day=Math.floor(from/86400000)*86400000;day<=to;day+=86400000)daily.set(dayKey(day),{date:dayKey(day),visitors:new Set(),pageviews:0,revenue:{}});
  const getDay=ts=>{const key=dayKey(ts);if(!daily.has(key))daily.set(key,{date:key,visitors:new Set(),pageviews:0,revenue:{}});return daily.get(key);};
  const activeSessions=new Set();
  for(const e of windowEvents){const day=getDay(e.ts);day.visitors.add(e.visitor_id);activeSessions.add(e.session_id);if(e.type==='page_view'){day.pageviews++;touch('pages',e.path,e.visitor_id,e);}if(e.type==='outbound_click'){const link=readContext(e.properties).outbound_url;if(link)touch('outboundLinks',link,e.visitor_id,e);}}
  for(const id of activeSessions){const session=sessionMap.get(id),pageEvents=(bySession.get(id)||[]).filter(e=>e.type==='page_view'&&e.ts<=to);if(!session)continue;touch('entryPages',pageEvents[0]?.path||session.landing_page,session.visitor_id);if(pageEvents.length)touch('exitPages',pageEvents.at(-1).path,session.visitor_id);}
  const timeBuckets=[{name:'Under 1 minute',payments:0},{name:'1–10 minutes',payments:0},{name:'10–60 minutes',payments:0},{name:'1–24 hours',payments:0},{name:'1–7 days',payments:0},{name:'7+ days',payments:0}];
  const visitBuckets=[{name:'1 visit',payments:0},{name:'2 visits',payments:0},{name:'3 visits',payments:0},{name:'4+ visits',payments:0}];
  const heat=Array.from({length:168},(_,i)=>({weekday:Math.floor(i/24),hour:i%24,payments:0,revenue:{}}));
  const visitorSessions=new Map();for(const s of sessions){if(!visitorSessions.has(s.visitor_id))visitorSessions.set(s.visitor_id,[]);visitorSessions.get(s.visitor_id).push(s);}
  for(const p of payments){
    const day=getDay(p.ts);day.revenue[p.currency]=(day.revenue[p.currency]||0)+p.amount_minor;
    const date=new Date(p.ts),cell=heat[date.getUTCDay()*24+date.getUTCHours()];if(p.amount_minor>0)cell.payments++;cell.revenue[p.currency]=(cell.revenue[p.currency]||0)+p.amount_minor;
    const visitor=visitorMap.get(p.visitor_id),cutoff=(p.amount_minor<0?(p.related_payment_ts??Number.NEGATIVE_INFINITY):p.ts)+(p.provider==='stripe'?999:0);
    for(const [key,name] of Object.entries(dimensionNames(visitor)))credit(key,p.visitor_id?name:'Unattributed',p);
    const timeline=p.visitor_id?(byVisitor.get(p.visitor_id)||[]).filter(e=>e.ts<=cutoff):[];
    for(const page of new Set(timeline.filter(e=>e.type==='page_view').map(e=>e.path)))credit('pages',page,p);
    for(const link of new Set(timeline.filter(e=>e.type==='outbound_click').map(e=>readContext(e.properties).outbound_url).filter(Boolean)))credit('outboundLinks',link,p);
    const session=sessionMap.get(p.session_id),sessionPages=(bySession.get(p.session_id)||[]).filter(e=>e.type==='page_view'&&e.ts<=cutoff);
    credit('entryPages',Number.isFinite(cutoff)&&session?(sessionPages[0]?.path||session.landing_page):'Unattributed',p);credit('exitPages',sessionPages.at(-1)?.path||'Unknown',p);
    if(p.amount_minor>0&&visitor&&p.is_first_payment!==0){const duration=Math.max(0,p.ts-visitor.first_ts);const bucket=[60000,600000,3600000,86400000,604800000].findIndex(ms=>duration<ms);timeBuckets[bucket===-1?5:bucket].payments++;const visits=(visitorSessions.get(p.visitor_id)||[]).filter(s=>s.first_ts<=cutoff).length;if(visits)visitBuckets[Math.min(3,visits-1)].payments++;}
  }
  const dimensions=Object.fromEntries(keys.map(key=>[key,[...maps[key].values()].map(({visitorSet,...r})=>({...r,visitors:visitorSet.size})).sort((a,b)=>b.visitors-a.visitors||b.payments-a.payments||a.name.localeCompare(b.name))]));
  dimensions.outbound=dimensions.outboundLinks;dimensions.os=dimensions.operatingSystems;
  return {dimensions,daily:[...daily.values()].map(d=>({...d,visitors:d.visitors.size})).sort((a,b)=>a.date.localeCompare(b.date)),distributions:{timeToPurchase:timeBuckets,visitsToPurchase:visitBuckets,weekdayHours:heat},analyticsDefinitions:{timezone:'UTC',context:'Revenue uses first captured visitor acquisition, geography and device context. Unknown data is not inferred or backfilled.',keywords:'Explicit utm_term campaign keyword only. Organic queries remain aggregate-only in Search Console.',pages:'Observed page touchpoints preceding payment; a payment can credit multiple pages. Do not sum page rows as total revenue.',outboundLinks:'Sanitized external links clicked before payment; overlapping assisted revenue, not causal attribution.',entryPages:'Payment session first observed page.',exitPages:'Last observed page in the session at payment/report cutoff, not a confirmed browser exit.',refunds:'Refunds retain their accounting date but reverse the original linked payment touchpoints. Missing original receipts do not invent assisted paths.',distributions:'Time and visits to the first known positive payment per visitor. Payment weekday/hour uses UTC and includes renewals.'}};
}
