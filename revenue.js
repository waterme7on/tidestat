// Canonical history and payment processing. Amounts remain in provider minor units.
const ID = /^[a-zA-Z0-9_.:-]{1,128}$/;
const TYPES = new Set(['page_view','click','custom','signup','checkout','purchase','revenue','identify','heartbeat']);
export function sites(env) {
  try { return JSON.parse(env.SITES_JSON || '{}'); } catch { return {}; }
}
export function cleanPath(value) {
  try { return new URL(String(value || '/'), 'https://path.invalid').pathname.slice(0,512); } catch { return '/'; }
}
export function normalizeEvent(body, now = Date.now()) {
  if (body.schema_version !== 1 || ![body.event_id,body.site_id,body.visitor_id,body.session_id].every(v => typeof v === 'string' && ID.test(v)) || !TYPES.has(body.type)) throw new Error('Invalid canonical event');
  const ts = Number(body.occurred_at);
  if (!Number.isSafeInteger(ts) || ts > now + 300000 || ts < now - 86400000 * 7) throw new Error('Event timestamp outside allowed window');
  const acquisition = body.acquisition || {};
  let source = String(acquisition.source || '').slice(0,128);
  if (!source) { try { source = new URL(body.referrer).hostname; } catch { source = 'Direct'; } }
  // Never store arbitrary client payloads: they can contain names, email or URL tokens.
  const properties = {};
  for (const key of ['name','label','target','product_id','plan','order_id']) if (typeof body.properties?.[key] === 'string') properties[key] = body.properties[key].slice(0,128);
  return {...body, occurred_at:ts,path:cleanPath(body.path),properties,acquisition:{source,medium:String(acquisition.medium||'').slice(0,128),campaign:String(acquisition.campaign||'').slice(0,128)}};
}
export async function ingest(db, event, edge) {
  const e = normalizeEvent(event), a = e.acquisition;
  const existing = await db.prepare('SELECT event_id FROM story_events WHERE site_id=? AND event_id=?').bind(e.site_id,e.event_id).first();
  if(existing) return;
  const session = await db.prepare('SELECT visitor_id FROM story_sessions WHERE site_id=? AND session_id=?').bind(e.site_id,e.session_id).first();
  if (session && session.visitor_id !== e.visitor_id) throw new Error('Session belongs to another visitor');
  await db.batch([
    db.prepare(`INSERT INTO story_visitors VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(site_id,visitor_id) DO UPDATE SET last_ts=MAX(last_ts,excluded.last_ts), source=CASE WHEN excluded.first_ts<first_ts THEN excluded.source ELSE source END, medium=CASE WHEN excluded.first_ts<first_ts THEN excluded.medium ELSE medium END, campaign=CASE WHEN excluded.first_ts<first_ts THEN excluded.campaign ELSE campaign END, landing_page=CASE WHEN excluded.first_ts<first_ts THEN excluded.landing_page ELSE landing_page END, first_ts=MIN(first_ts,excluded.first_ts)`).bind(e.site_id,e.visitor_id,e.occurred_at,e.occurred_at,a.source,a.medium,a.campaign,e.path),
    db.prepare(`INSERT INTO story_sessions VALUES (?,?,?,?,?,?,?) ON CONFLICT(site_id,session_id) DO UPDATE SET last_ts=MAX(last_ts,excluded.last_ts),source=CASE WHEN excluded.first_ts<first_ts THEN excluded.source ELSE source END,landing_page=CASE WHEN excluded.first_ts<first_ts THEN excluded.landing_page ELSE landing_page END,first_ts=MIN(first_ts,excluded.first_ts)`).bind(e.site_id,e.session_id,e.visitor_id,e.occurred_at,e.occurred_at,a.source,e.path),
    db.prepare('INSERT OR IGNORE INTO story_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(e.site_id,e.event_id,e.visitor_id,e.session_id,e.type,e.occurred_at,e.path,JSON.stringify(e.properties),edge.city||null,edge.country||null,edge.latitude?Number(edge.latitude):null,edge.longitude?Number(edge.longitude):null,edge.device||'desktop',edge.maskedIp||null)
  ]);
  await reconcilePayments(db,e.site_id);
}
export async function reconcilePayments(db,site) {
  await db.prepare(`UPDATE story_payments SET visitor_id=candidate_visitor_id,session_id=candidate_session_id,attribution='explicit_metadata' WHERE site_id=? AND visitor_id IS NULL AND EXISTS (SELECT 1 FROM story_sessions s WHERE s.site_id=story_payments.site_id AND s.session_id=candidate_session_id AND s.visitor_id=candidate_visitor_id)`).bind(site).run();
  await db.prepare(`UPDATE story_payments SET related_payment_id=COALESCE((SELECT a.payment_id FROM payment_aliases a WHERE a.site_id=story_payments.site_id AND a.provider=story_payments.provider AND a.external_id=story_payments.related_payment_id),related_payment_id) WHERE site_id=? AND related_payment_id IS NOT NULL`).bind(site).run();
  await db.prepare(`UPDATE story_payments SET visitor_id=(SELECT p.visitor_id FROM story_payments p WHERE p.site_id=story_payments.site_id AND p.provider=story_payments.provider AND p.payment_id=story_payments.related_payment_id),session_id=(SELECT p.session_id FROM story_payments p WHERE p.site_id=story_payments.site_id AND p.provider=story_payments.provider AND p.payment_id=story_payments.related_payment_id),attribution='linked_payment' WHERE site_id=? AND related_payment_id IS NOT NULL AND visitor_id IS NULL AND EXISTS (SELECT 1 FROM story_payments p WHERE p.site_id=story_payments.site_id AND p.provider=story_payments.provider AND p.payment_id=story_payments.related_payment_id AND p.visitor_id IS NOT NULL)`).bind(site).run();
}
function equal(a,b) { if (a.length !== b.length) return false; let mismatch=0; for(let i=0;i<a.length;i++) mismatch |= a.charCodeAt(i)^b.charCodeAt(i); return mismatch===0; }
async function hmac(secret, value, encoding) {
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)));
  return encoding==='hex' ? [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('') : btoa(String.fromCharCode(...bytes));
}
export async function verifyWebhook(provider, raw, headers, config, now=Date.now()) {
  if (provider==='stripe') {
    if (!config.stripeWebhookSecret) return false;
    const parts=(headers.get('stripe-signature')||'').split(',').map(v=>v.split('='));
    const timestamp=parts.find(v=>v[0]==='t')?.[1];
    if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now/1000-Number(timestamp))>300) return false;
    const expected=await hmac(config.stripeWebhookSecret,`${timestamp}.${raw}`,'hex');
    return parts.some(([key,value])=>key==='v1' && equal(value,expected));
  }
  if (!config.shopifyWebhookSecret || !config.shopDomain || headers.get('x-shopify-shop-domain')!==config.shopDomain) return false;
  return equal(headers.get('x-shopify-hmac-sha256')||'',await hmac(config.shopifyWebhookSecret,raw,'base64'));
}
export function minorAmount(value, currency) {
  const zero = new Set(['BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF']);
  const three = new Set(['BHD','JOD','KWD','OMR','TND']);
  const digits=zero.has(currency)?0:three.has(currency)?3:2;
  if (!/^\d+(\.\d+)?$/.test(String(value))) throw new Error('Invalid amount');
  const [whole,fraction='']=String(value).split('.');
  if (fraction.slice(digits).replace(/0/g,'')) throw new Error('Invalid currency precision');
  const amount=Number(whole)*10**digits+Number(fraction.slice(0,digits).padEnd(digits,'0'));
  if (!Number.isSafeInteger(amount)) throw new Error('Invalid amount');
  return amount;
}
export async function savePayment(db, provider, site, payload, headers) {
  let object, metadata={}, amount, currency, paymentId, webhookId, ts, related=null, refund=false;
  const idOf=value=>typeof value==='string'?value:value?.id;
  if (provider==='stripe') {
    object=payload.data?.object; if(!object)return {ignored:true};
    webhookId=payload.id;ts=Number(payload.created)*1000;
    if (['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(payload.type)) {
      if(object.payment_status!=='paid')return {ignored:true};
      metadata=object.metadata||{};amount=object.amount_total;currency=String(object.currency||'').toUpperCase();
      // Checkout's invoice pointer and invoice.paid use the same ledger identity.
      paymentId=idOf(object.invoice)||idOf(object.payment_intent)||object.id;
    } else if(payload.type==='invoice.paid') {
      if(!object.paid && object.status!=='paid')return {ignored:true};
      metadata={...(object.parent?.subscription_details?.metadata||object.subscription_details?.metadata||{}),...(object.metadata||{})};
      amount=object.amount_paid;currency=String(object.currency||'').toUpperCase();paymentId=object.id;
    } else if(payload.type==='charge.refunded') {
      // Expanded refunds may be a partial list. Each refund has its own stable ID;
      // independent refund.created/refund.updated deliveries fill any omitted entries.
      const refunds=object.refunds?.data||[];
      for(const entry of refunds)await savePayment(db,provider,site,{id:payload.id,type:'refund.updated',created:payload.created,data:{object:{...entry,payment_intent:entry.payment_intent||object.payment_intent,invoice:object.invoice,metadata:{...(object.metadata||{}),...(entry.metadata||{})}}}},headers);
      return {ok:true,refundsObserved:refunds.length};
    } else if(['refund.created','refund.updated'].includes(payload.type)) {
      if(object.status!=='succeeded')return {ignored:true};
      refund=true;amount=-object.amount;currency=String(object.currency||'').toUpperCase();
      paymentId=`refund:${object.id}`;related=idOf(object.invoice)||idOf(object.payment_intent)||idOf(object.charge)||null;metadata=object.metadata||{};ts=Number(object.created)*1000;
    } else return {ignored:true};
  } else {
    const topic=headers.get('x-shopify-topic');object=payload;
    webhookId=headers.get('x-shopify-webhook-id');ts=Date.parse(object.processed_at||object.created_at);
    metadata=Object.fromEntries((object.note_attributes||[]).map(v=>[v.name,v.value]));
    if(topic==='orders/paid' && object.financial_status==='paid') {
      currency=String(object.currency||'').toUpperCase();amount=minorAmount(object.total_price,currency);paymentId=String(object.id||'');
    } else if(topic==='refunds/create') {
      // Sum only successful refund transactions, not requested/failed refunds or adjustments.
      const transactions=(object.transactions||[]).filter(t=>t.kind==='refund'&&t.status==='success');
      if(!transactions.length)return {ignored:true};
      currency=String(transactions[0].currency||'').toUpperCase();
      if(transactions.some(t=>String(t.currency).toUpperCase()!==currency))throw new Error('Mixed refund currency');
      amount=-transactions.reduce((sum,t)=>sum+minorAmount(t.amount,currency),0);paymentId=`refund:${object.id}`;related=String(object.order_id||'');refund=true;
    } else return {ignored:true};
  }
  if (!ID.test(String(paymentId||'')) || !webhookId || !Number.isSafeInteger(amount) || (!refund&&amount<0) || (refund&&amount>0) || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(ts)) throw new Error('Malformed payment');
  const aliases=provider==='stripe'&&!refund?[object.id,idOf(object.invoice),idOf(object.payment_intent),idOf(object.charge),...(object.payments?.data||[]).map(p=>idOf(p.payment?.payment_intent))].filter(Boolean):[];
  for(const alias of aliases) { const existing=await db.prepare('SELECT payment_id FROM payment_aliases WHERE site_id=? AND provider=? AND external_id=?').bind(site,provider,alias).first();if(existing){paymentId=existing.payment_id;break;} }
  let visitor=null,session=null,attribution='unattributed',candidateVisitor=null,candidateSession=null;
  if (metadata.tidestat_site_id===site && ID.test(metadata.tidestat_visitor_id||'') && ID.test(metadata.tidestat_session_id||'')) {
    candidateVisitor=metadata.tidestat_visitor_id;candidateSession=metadata.tidestat_session_id;
    const match=await db.prepare('SELECT visitor_id FROM story_sessions WHERE site_id=? AND session_id=? AND visitor_id=?').bind(site,candidateSession,candidateVisitor).first();
    if(match) { visitor=candidateVisitor;session=candidateSession;attribution='explicit_metadata'; }
  }
  // Individual refund IDs make retries and partial refunds independent ledger rows.
  await db.prepare(`INSERT INTO story_payments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(site_id,provider,payment_id) DO UPDATE SET amount_minor=CASE WHEN excluded.amount_minor<0 THEN MIN(story_payments.amount_minor,excluded.amount_minor) ELSE story_payments.amount_minor END,candidate_visitor_id=COALESCE(story_payments.candidate_visitor_id,excluded.candidate_visitor_id),candidate_session_id=COALESCE(story_payments.candidate_session_id,excluded.candidate_session_id)`).bind(site,provider,paymentId,webhookId,visitor,session,ts,amount,currency,attribution,candidateVisitor,candidateSession,related).run();
  if(aliases.length)await db.batch(aliases.map(alias=>db.prepare('INSERT OR IGNORE INTO payment_aliases VALUES (?,?,?,?)').bind(site,provider,alias,paymentId)));
  await reconcilePayments(db,site);
  return {ok:true,attribution};
}
// Stripe timestamps have second precision; canonical browser timestamps use milliseconds.
// Only that provider's known precision interval is included in ordering comparisons.
function paymentCutoff(payment) { return payment.ts + (payment.provider === 'stripe' ? 999 : 0); }
export function summarize(events, payments, visitors, sessions, from, to, options={}) {
  const currencies = new Map(), sources=new Map(), pages=new Map(), journeys=new Map();
  const inWindow = events.filter(e=>e.ts>=from && e.ts<=to);
  const activeVisitors=new Set(inWindow.map(e=>e.visitor_id));
  const activeSessions=new Set(inWindow.map(e=>e.session_id));
  const visitorMap=new Map(visitors.map(v=>[v.visitor_id,v]));
  const group=(rows,key)=>{const map=new Map();for(const row of rows){if(!map.has(row[key]))map.set(row[key],[]);map.get(row[key]).push(row);}return map;};
  const visitorEvents=group(events,'visitor_id'),visitorSessions=group(sessions,'visitor_id'),windowEvents=group(inWindow,'visitor_id'),visitorPayments=group(payments,'visitor_id');
  const storyOffset=options.offset||0,storyLimit=options.limit||100;let storyCount=0;
  const money=(map,key,p)=>{ if(!map.has(key))map.set(key,{name:key,payments:0,revenue:{},visitors:0}); const row=map.get(key);if(p.amount_minor>0)row.payments++;row.revenue[p.currency]=(row.revenue[p.currency]||0)+p.amount_minor; };
  for(const v of visitors.filter(v=>activeVisitors.has(v.visitor_id))) {
    if(!sources.has(v.source))sources.set(v.source,{name:v.source,payments:0,revenue:{},visitors:0}); sources.get(v.source).visitors++;
  }
  const stories=payments.map(p=>{
    const v=visitorMap.get(p.visitor_id);
    const timeline=(visitorEvents.get(p.visitor_id)||[]).filter(e=>e.ts<=paymentCutoff(p));
    const journey=[];for(const e of timeline) { const label=e.type==='page_view'?e.path:e.type==='heartbeat'?null:e.type==='custom'?JSON.parse(e.properties||'{}').name||'custom':e.type; if(label && journey[journey.length-1]!==label)journey.push(label); }
    const priorSessions=(visitorSessions.get(p.visitor_id)||[]).filter(s=>s.first_ts<=paymentCutoff(p));
    const returning=priorSessions.length>1;
    const source=v?.source||'Unattributed';
    const path=[source,...journey].join(' → ');
    money(sources,source,p);money(pages,v?.landing_page||'Unattributed',p);money(journeys,path,p);
    if(!currencies.has(p.currency))currencies.set(p.currency,{currency:p.currency,revenue:0,payments:0,customers:new Set(),returningRevenue:0,unattributedRevenue:0});
    const c=currencies.get(p.currency);c.revenue+=p.amount_minor;if(p.amount_minor>=0)c.payments++;c.grossRevenue=(c.grossRevenue||0)+Math.max(0,p.amount_minor);c.refunds=(c.refunds||0)+Math.max(0,-p.amount_minor);if(p.visitor_id&&p.amount_minor>0)c.customers.add(p.visitor_id);if(returning)c.returningRevenue+=p.amount_minor;if(!p.visitor_id)c.unattributedRevenue+=p.amount_minor;
    const matches=(!options.visitor||p.visitor_id===options.visitor)&&(!options.source||source===options.source)&&(!options.currency||p.currency===options.currency)&&(!options.q||`${p.visitor_id||''} ${p.payment_id}`.toLowerCase().includes(String(options.q).toLowerCase()))&&(!options.returning||returning)&&(!options.attribution||p.attribution===options.attribution);
    if(!matches)return null;
    const index=storyCount++;if(index<storyOffset||index>=storyOffset+storyLimit)return null;
    return {timelineTruncated:timeline.length>200,id:`${p.provider}:${p.payment_id}`,visitorId:p.visitor_id,sessionId:p.session_id,source,landingPage:v?.landing_page||null,provider:p.provider,paymentId:p.payment_id,amountMinor:p.amount_minor,currency:p.currency,ts:p.ts,attribution:p.attribution,returning,sessionCount:priorSessions.length,durationMs:v?Math.max(0,p.ts-v.first_ts):null,journey,timeline:timeline.slice(-200).map(e=>({id:e.event_id,type:e.type,path:e.path,ts:e.ts,sessionId:e.session_id,properties:JSON.parse(e.properties||'{}')}))};
  }).filter(Boolean);
  // Ordered visitor funnel within this window. Paid is tied to the same visitor and follows checkout.
  const stages=['page_view','checkout','payment'].map(name=>({name,visitors:0}));
  const signupStages=['page_view','signup','checkout','payment'].map(name=>({name,visitors:0}));
  const checkoutVisitors=new Set(),paidAfterCheckout=new Set();
  for(const visitor of activeVisitors) {
    const timeline=(windowEvents.get(visitor)||[]).sort((a,b)=>a.ts-b.ts);
    for(const funnel of [stages,signupStages]) {
      let position=0,lastTs=0;
      for(const e of timeline)if(e.type===funnel[position]?.name){funnel[position].visitors++;lastTs=e.ts;position++;}
      if(position===funnel.length-1 && (visitorPayments.get(visitor)||[]).some(p=>p.amount_minor>0&&paymentCutoff(p)>=lastTs))funnel[position].visitors++;
    }
    const checkout=timeline.find(e=>e.type==='checkout');
    if(checkout){checkoutVisitors.add(visitor);if((visitorPayments.get(visitor)||[]).some(p=>p.amount_minor>0&&paymentCutoff(p)>=checkout.ts))paidAfterCheckout.add(visitor);}
  }
  return {overview:{visitors:activeVisitors.size,sessions:activeSessions.size,customers:new Set(payments.filter(p=>p.amount_minor>0).map(p=>p.visitor_id).filter(Boolean)).size,conversion:activeVisitors.size?new Set(payments.filter(p=>p.amount_minor>0).map(p=>p.visitor_id).filter(id=>activeVisitors.has(id))).size/activeVisitors.size:null,currencies:[...currencies.values()].map(c=>({...c,customers:c.customers.size,revenuePerVisitor:activeVisitors.size?c.revenue/activeVisitors.size:null}))},stories,storyCount,nextOffset:storyOffset+storyLimit<storyCount?storyOffset+storyLimit:null,sources:[...sources.values()],pages:[...pages.values()],journeys:[...journeys.values()],funnel:stages,signupFunnel:signupStages,leaks:[{name:'Checkout without observed payment',visitors:checkoutVisitors.size-paidAfterCheckout.size,entered:checkoutVisitors.size,converted:paidAfterCheckout.size}],definitions:{revenue:'Net observed receipts in minor units: paid checkouts, paid invoices and orders less successful observed refunds. Gross includes taxes/shipping; fees excluded. No MRR inference.',attribution:'First observed visitor source; payment links require matching site, visitor and session metadata.',funnel:'Ordered page_view → checkout → payment in selected window; includes guest checkout.',signupFunnel:'Ordered page_view → signup → checkout → payment in selected window.',leaks:'Observed checkout visitors without a later linked payment in this window. Not confirmed lost revenue.',pages:'First observed landing page credited once per payment.'}};
}
export async function report(db, site, from, to, options={}) {
  const queries=[
    ['SELECT * FROM story_events WHERE site_id=? AND ts<=? ORDER BY ts DESC LIMIT 20001',[site,to]],
    ['SELECT * FROM story_payments WHERE site_id=? AND ts>=? AND ts<=? ORDER BY ts DESC LIMIT 5001',[site,from,to]],
    ['SELECT * FROM story_visitors WHERE site_id=? ORDER BY first_ts DESC LIMIT 20001',[site]],
    ['SELECT * FROM story_sessions WHERE site_id=? AND first_ts<=? ORDER BY first_ts DESC LIMIT 20001',[site,to]]
  ];
  const results=await Promise.all(queries.map(([sql,args])=>db.prepare(sql).bind(...args).all()));
  const limits=[20000,5000,20000,20000],truncated=results.some((r,i)=>r.results.length>limits[i]);
  const [events,payments,visitors,sessions]=results.map((r,i)=>r.results.slice(0,limits[i]));
  const result=summarize(events.reverse(),payments,visitors,sessions,from,to,options);
  return {...result,site,from,to,truncated,historyComplete:!truncated,unit:'minor',searchDataLevel:'aggregate_only'};
}
