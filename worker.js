// Live visitors and durable Revenue Stories share a site-scoped canonical event stream.
import { readContext } from './analytics.js';
import { maskIp, validMaskedIp } from './privacy.js';
import { sites, ingest, verifyWebhook, savePayment, report } from './revenue.js';
const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'86400' };
function json(data,status=200) { return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors}}); }
function authorized(request, config) { return !!config?.readToken && request.headers.get('authorization')===`Bearer ${config.readToken}`; }
function device(ua){return /iPad|Tablet/i.test(ua)?'tablet':/Mobile|Android|iPhone/i.test(ua)?'mobile':'desktop';}
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  // The browser package is shipped as a static asset and is also the legacy snippet URL.
  if(url.pathname==='/t.js')return new Response(null,{status:302,headers:{Location:new URL('/sdk/browser.js',url).href,...cors}});
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  const configMap=sites(env);
  try {
   if(url.pathname==='/api/collect' && request.method==='POST') {
    if(Number(request.headers.get('content-length')||0)>16384)return json({error:'Payload too large'},413);
    const raw=await request.text();if(raw.length>16384)return json({error:'Payload too large'},413);
    let body;try {body=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
    const config=configMap[body.site_id];
    if(!config)return json({error:'Unknown site'},400);
    const origin=request.headers.get('origin');
    const allowedOrigins=[config.origin,...(Array.isArray(config.allowedOrigins)?config.allowedOrigins:[])].filter(Boolean);
    if(!origin || !allowedOrigins.includes(origin))return json({error:'Origin not allowed'},403);
    try {await ingest(env.DB,body,{...(request.cf||{}),userAgent:request.headers.get('user-agent')||'',device:device(request.headers.get('user-agent')||''),maskedIp:maskIp(request.headers.get('CF-Connecting-IPv6')||request.headers.get('CF-Connecting-IP'))});}catch(error){if(/Invalid|outside|Session belongs/.test(error.message))return json({error:error.message},400);throw error;}
    return json({ok:true});
   }
   const site=url.searchParams.get('site'), config=configMap[site];
   if(!site || !config)return json({error:'A configured site is required'},400);
   if(url.pathname.startsWith('/api/webhooks/') && request.method==='POST') {
    const provider=url.pathname.split('/').pop();if(!['stripe','shopify'].includes(provider))return json({error:'Unknown connector'},404);
    const raw=await request.text();if(raw.length>1048576)return json({error:'Payload too large'},413);
    if(!await verifyWebhook(provider,raw,request.headers,config))return json({error:'Invalid signature'},401);
    let payload;try{payload=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
    return json(await savePayment(env.DB,provider,site,payload,request.headers));
   }
   if(!authorized(request,config))return json({error:'Site read token required'},401);
   if(url.pathname==='/api/search-console') {
    if(request.method==='POST') {
     const raw=await request.text();if(raw.length>1048576)return json({error:'Payload too large'},413);
     let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
     if(!Array.isArray(body.rows)||body.rows.length>1000)return json({error:'rows must contain at most 1000 aggregate records'},400);
     const valid=body.rows.every(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&typeof r.page==='string'&&r.page.length<=512&&typeof r.query==='string'&&r.query.length<=512&&Number.isSafeInteger(r.clicks)&&r.clicks>=0&&Number.isSafeInteger(r.impressions)&&r.impressions>=r.clicks&&Number.isFinite(r.position)&&r.position>=0);
     if(!valid)return json({error:'Invalid aggregate search data'},400);
     if(body.rows.length)await env.DB.batch(body.rows.map(r=>env.DB.prepare('INSERT INTO search_console_daily VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(site_id,date,page,query) DO UPDATE SET clicks=excluded.clicks,impressions=excluded.impressions,ctr=excluded.ctr,position=excluded.position').bind(site,r.date,r.page,r.query,r.clicks,r.impressions,r.impressions?r.clicks/r.impressions:0,r.position)));
     return json({ok:true,rows:body.rows.length,dataLevel:'aggregate_only'});
    }
    if(request.method==='GET') {
     const {results}=await env.DB.prepare('SELECT date,page,query,clicks,impressions,ctr,position FROM search_console_daily WHERE site_id=? ORDER BY date DESC LIMIT 1001').bind(site).all();
     return json({site,dataLevel:'aggregate_only',rows:results.slice(0,1000),truncated:results.length>1000,integration:'manual_import'});
    }
   }
   if(url.pathname==='/api/live' && request.method==='GET') {
    const now=Date.now(),onlineMs=90000,limit=2000;
    const {results}=await env.DB.prepare('SELECT * FROM story_events WHERE site_id=? AND ts>? ORDER BY ts DESC, rowid DESC LIMIT ?').bind(site,now-600000,limit+1).all();
    const map=new Map();
    for(const row of results.slice(0,limit).reverse()) {
     let v=map.get(row.visitor_id);
     if(!v){v={id:row.visitor_id,maskedIp:validMaskedIp(row.masked_ip),city:row.city||'未知',country:row.country||'',lat:row.lat,lng:row.lng,device:row.device||'desktop',firstTs:row.ts,lastTs:row.ts,paths:[],events:[]};map.set(v.id,v);}
     v.lastTs=row.ts;if(row.lat!=null){v.lat=row.lat;v.lng=row.lng;}if(row.city)v.city=row.city;
     const previous=v.paths.at(-1);if(!previous||previous.path!==row.path)v.paths.push({path:row.path,ts:row.ts});if(v.paths.length>12)v.paths.shift();
     if(row.type!=='heartbeat')v.events.push({id:row.event_id,type:row.type,path:row.path,ts:row.ts,properties:readContext(row.properties)});if(v.events.length>12)v.events.shift();
    }
    const {results:payments}=await env.DB.prepare('SELECT provider,payment_id,visitor_id,ts,amount_minor,currency FROM story_payments WHERE site_id=? AND ts>? AND ts<=? ORDER BY ts DESC LIMIT ?').bind(site,now-600000,now,limit+1).all();
    for(const payment of payments.slice(0,limit)) {
     const visitor=map.get(payment.visitor_id);
     if(visitor && now-visitor.lastTs<onlineMs)visitor.events.push({id:`${payment.provider}:${payment.payment_id}`,type:payment.amount_minor<0?'refund':'payment',ts:payment.ts,path:'',amountMinor:payment.amount_minor,currency:payment.currency});
    }
    const {results:summaries}=await env.DB.prepare(`SELECT v.visitor_id,v.source,v.first_ts,v.landing_page,c.context,(SELECT COUNT(*) FROM story_sessions s WHERE s.site_id=v.site_id AND s.visitor_id=v.visitor_id) AS session_count,(SELECT COUNT(*) FROM story_events e WHERE e.site_id=v.site_id AND e.visitor_id=v.visitor_id AND e.type='page_view') AS pageviews,(SELECT e.path FROM story_events e WHERE e.site_id=v.site_id AND e.visitor_id=v.visitor_id AND e.type='page_view' ORDER BY e.ts DESC LIMIT 1) AS exit_page FROM story_visitors v LEFT JOIN visitor_context c ON c.site_id=v.site_id AND c.visitor_id=v.visitor_id WHERE v.site_id=? AND v.last_ts>? LIMIT ?`).bind(site,now-onlineMs,limit+1).all();
    for(const summary of summaries.slice(0,limit)){const visitor=map.get(summary.visitor_id);if(visitor){const context=readContext(summary.context);Object.assign(visitor,{context,source:summary.source,channel:context.channel||'Unknown',referrer:context.referrer||'',campaign:context.campaign||'',keyword:context.keyword||'',browser:context.browser||'Unknown',os:context.os||'Unknown',region:context.region||'',viewportWidth:context.viewportWidth||null,viewportHeight:context.viewportHeight||null,firstVisitTs:summary.first_ts,sessionCount:summary.session_count,pageviews:summary.pageviews,entryPage:summary.landing_page,exitPage:summary.exit_page});}}
    const visitors=[...map.values()].filter(v=>now-v.lastTs<onlineMs);
    for(const visitor of visitors)visitor.events=visitor.events.sort((a,b)=>a.ts-b.ts||a.id.localeCompare(b.id)).slice(-12);
    return json({now,onlineMs,visitors,truncated:results.length>limit||payments.length>limit||summaries.length>limit});
   }
   if(['/api/revenue','/api/stories'].includes(url.pathname) && request.method==='GET') {
    const days=Math.min(365,Math.max(1,Number(url.searchParams.get('days')||30))),to=url.searchParams.has('to')?Number(url.searchParams.get('to')):Date.now(),from=url.searchParams.has('from')?Number(url.searchParams.get('from')):to-days*86400000;
    if(!Number.isFinite(from)||!Number.isFinite(to)||from>to||to-from>365*86400000)return json({error:'Invalid date window (maximum 365 days)'},400);
    const offset=Math.max(0,parseInt(url.searchParams.get('offset')||'0')||0),limit=Math.min(100,Math.max(1,parseInt(url.searchParams.get('limit')||'50')||50));
    const options={offset,limit,visitor:url.searchParams.get('visitor'),source:url.searchParams.get('source'),currency:url.searchParams.get('currency'),q:url.searchParams.get('q'),returning:url.searchParams.get('returning')==='true',attribution:url.searchParams.get('attribution')};
    const result=await report(env.DB,site,from,to,url.pathname==='/api/stories'?options:{});
    if(url.pathname==='/api/stories')return json({site,from,to,stories:result.stories,total:result.storyCount,nextOffset:result.nextOffset,truncated:result.truncated});
    return json(result);
   }
   return json({error:'Not found'},404);
  } catch(error) { console.error('TideStat request failed',error.message);return json({error:'Storage or processing unavailable; retry later'},503); }
 }
};
