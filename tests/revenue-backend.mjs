import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import worker from '../worker.js';
import { ingest, savePayment, report, verifyWebhook, minorAmount } from '../revenue.js';
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const db={prepare(sql){return {bind(...args){return {first:async()=>sqlite.prepare(sql).get(...args)||null,all:async()=>({results:sqlite.prepare(sql).all(...args)}),run:async()=>sqlite.prepare(sql).run(...args)};}}},async batch(statements){sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};return {db,sqlite};
}
const now=Date.now();
function event(site='one',id='evt1',visitor='visitor1',session='session1',type='page_view',ts=now-10000){return {schema_version:1,event_id:id,site_id:site,visitor_id:visitor,session_id:session,type,path:'/pricing?email=secret#x',occurred_at:ts,acquisition:{source:'Google'},properties:{email:'secret'}};}
function payment(id='cs_1',metadata={tidestat_site_id:'one',tidestat_visitor_id:'visitor1',tidestat_session_id:'session1'}){return {id:'evt_pay',type:'checkout.session.completed',created:Math.floor(now/1000),data:{object:{id,payment_status:'paid',amount_total:1900,currency:'usd',metadata}}};}
test('canonical ingestion durable, idempotent, strips URL and custom PII; site isolation',async()=>{
 const {db,sqlite}=database();await ingest(db,event(),{});await ingest(db,event(),{});await ingest(db,event('two'),{});
 assert.equal(sqlite.prepare('SELECT count(*) AS n FROM story_events').get().n,2);
 assert.equal(sqlite.prepare('SELECT path FROM story_events LIMIT 1').get().path,'/pricing');
 assert.equal(sqlite.prepare('SELECT properties FROM story_events LIMIT 1').get().properties,'{}');
 await assert.rejects(ingest(db,event('one','evil','other'),{}),/Session belongs/);
 await savePayment(db,'stripe','one',payment(),new Headers());await savePayment(db,'stripe','one',payment(),new Headers());
 const one=await report(db,'one',now-86400000,now+1000),two=await report(db,'two',now-86400000,now+1000);
 assert.equal(one.overview.currencies[0].revenue,1900);assert.equal(one.stories[0].source,'Google');assert.equal(two.stories.length,0);
 assert.equal(one.stories[0].timeline.length,1);
});
test('forged client revenue is only behavior; unknown/cross-site correlation stays unattributed',async()=>{
 const {db}=database();await ingest(db,event('one','revenue','visitor1','session1','revenue'),{});
 assert.equal((await report(db,'one',0,now+1000)).stories.length,0);
 await savePayment(db,'stripe','one',payment('cs_unmatched',{tidestat_site_id:'two',tidestat_visitor_id:'visitor1',tidestat_session_id:'session1'}),new Headers());
 const r=await report(db,'one',0,now+1000);assert.equal(r.stories[0].attribution,'unattributed');assert.equal(r.stories[0].visitorId,null);assert.equal(r.overview.currencies[0].unattributedRevenue,1900);
});
test('Stripe signature enforces raw bytes and replay age; Shopify binds shop domain',async()=>{
 const raw=JSON.stringify(payment()),secret='test-secret',t=Math.floor(now/1000);
 const sig=createHmac('sha256',secret).update(`${t}.${raw}`).digest('hex');
 const h=new Headers({'stripe-signature':`t=${t},v1=${sig}`});
 assert.equal(await verifyWebhook('stripe',raw,h,{stripeWebhookSecret:secret},now),true);
 assert.equal(await verifyWebhook('stripe',raw+' ',h,{stripeWebhookSecret:secret},now),false);
 assert.equal(await verifyWebhook('stripe',raw,h,{stripeWebhookSecret:secret},now+301000),false);
 const sh=new Headers({'x-shopify-hmac-sha256':createHmac('sha256',secret).update(raw).digest('base64'),'x-shopify-shop-domain':'example.myshopify.com'});
 assert.equal(await verifyWebhook('shopify',raw,sh,{shopifyWebhookSecret:secret,shopDomain:'other.myshopify.com'}),false);
 assert.equal(await verifyWebhook('shopify',raw,sh,{shopifyWebhookSecret:secret,shopDomain:'example.myshopify.com'}),true);
});
test('Shopify paid orders dedupe; currencies stay separate and decimal precision exact',async()=>{
 const {db}=database();await ingest(db,event(),{});await savePayment(db,'stripe','one',payment(),new Headers());
 const h=new Headers({'x-shopify-topic':'orders/paid','x-shopify-webhook-id':'delivery'});
 const order={id:123,financial_status:'paid',total_price:'19.99',currency:'EUR',processed_at:new Date(now).toISOString(),note_attributes:[{name:'tidestat_site_id',value:'one'},{name:'tidestat_visitor_id',value:'visitor1'},{name:'tidestat_session_id',value:'session1'}]};
 await savePayment(db,'shopify','one',order,h);await savePayment(db,'shopify','one',order,h);
 const r=await report(db,'one',0,now+1000);assert.deepEqual(r.overview.currencies.map(c=>c.currency).sort(),['EUR','USD']);assert.equal(r.stories.find(s=>s.currency==='EUR').amountMinor,1999);
 assert.equal(minorAmount('100','JPY'),100);assert.equal(minorAmount('1.234','KWD'),1234);assert.throws(()=>minorAmount('1.001','USD'));
});
test('API read token protects site scope; origin protects writes; aggregate import has no visitor identity',async()=>{
 const {db}=database(),env={DB:db,SITES_JSON:JSON.stringify({one:{origin:'https://one.test',readToken:'one-token'},two:{origin:'https://two.test',readToken:'two-token'}})};
 const get=(path,token)=>worker.fetch(new Request(`https://tide.test${path}`,{headers:token?{authorization:`Bearer ${token}`}:{}}),env);
 assert.equal((await get('/api/revenue?site=one')).status,401);assert.equal((await get('/api/revenue?site=two','one-token')).status,401);assert.equal((await get('/api/revenue?site=one','one-token')).status,200);
 const wrong=await worker.fetch(new Request('https://tide.test/api/collect',{method:'POST',headers:{origin:'https://evil.test'},body:JSON.stringify(event())}),env);assert.equal(wrong.status,403);
 const ok=await worker.fetch(new Request('https://tide.test/api/collect',{method:'POST',headers:{origin:'https://one.test'},body:JSON.stringify(event())}),env);assert.equal(ok.status,200);
 const imported=await worker.fetch(new Request('https://tide.test/api/search-console?site=one',{method:'POST',headers:{authorization:'Bearer one-token'},body:JSON.stringify({rows:[{date:'2026-09-06',page:'/pricing',query:'analytics',clicks:2,impressions:10,position:3,visitor_id:'forged'}]})}),env);assert.equal(imported.status,200);
 const search=await (await get('/api/search-console?site=one','one-token')).json();assert.equal(search.dataLevel,'aggregate_only');assert.equal(search.rows[0].visitor_id,undefined);assert.equal(search.rows[0].ctr,0.2);
});
test('returning contribution and ordered funnel use observed timestamps',async()=>{
 const {db}=database();for(const e of [event(),event('one','signup','visitor1','session1','signup',now-9000),event('one','checkout','visitor1','session2','checkout',now-8000)])await ingest(db,e,{});
 await savePayment(db,'stripe','one',payment('cs2',{tidestat_site_id:'one',tidestat_visitor_id:'visitor1',tidestat_session_id:'session2'}),new Headers());
 const r=await report(db,'one',now-20000,now+1000);assert.equal(r.stories[0].returning,true);assert.equal(r.overview.currencies[0].returningRevenue,1900);assert.deepEqual(r.funnel.map(s=>s.visitors),[1,1,1]);assert.equal(r.leaks[0].visitors,0);
});
test('late explicit metadata reconciles; invoices dedupe initial checkout and renewals count once',async()=>{
 const {db}=database();const first=payment();first.data.object.invoice='in_first';first.data.object.payment_intent='pi_first';
 await savePayment(db,'stripe','one',first,new Headers());
 assert.equal((await report(db,'one',0,now+1000)).stories[0].visitorId,null);
 await ingest(db,event(),{});
 assert.equal((await report(db,'one',0,now+1000)).stories[0].visitorId,'visitor1');
 const invoice={id:'evt_invoice',type:'invoice.paid',created:Math.floor(now/1000),data:{object:{id:'in_first',payment_intent:'pi_first',paid:true,amount_paid:1900,currency:'usd',parent:{subscription_details:{metadata:first.data.object.metadata}}}}};
 await savePayment(db,'stripe','one',invoice,new Headers());
 invoice.data.object.id='in_renewal';invoice.data.object.payment_intent='pi_renewal';await savePayment(db,'stripe','one',invoice,new Headers());
 const r=await report(db,'one',0,now+1000);assert.equal(r.stories.length,2);assert.equal(r.overview.currencies[0].revenue,3800);
});
test('Stripe individual refunds retain their own dates and dedupe expanded charge deliveries',async()=>{
 const {db}=database();await ingest(db,event(),{});const pay=payment();pay.data.object.invoice='in_first';pay.data.object.payment_intent='pi_first';await savePayment(db,'stripe','one',pay,new Headers());
 const first={id:'re_1',payment_intent:'pi_first',amount:500,currency:'usd',status:'succeeded',created:Math.floor(now/1000)};
 const refund={id:'evt_refund',type:'refund.created',created:Math.floor(now/1000),data:{object:first}};
 await savePayment(db,'stripe','one',refund,new Headers());await savePayment(db,'stripe','one',refund,new Headers());
 const second={...first,id:'re_2',created:Math.floor(now/1000)+86400};
 await savePayment(db,'stripe','one',{id:'evt_charge',type:'charge.refunded',created:Math.floor(now/1000)+86400,data:{object:{id:'ch_1',payment_intent:'pi_first',refunds:{data:[first,second]}}}},new Headers());
 const r=await report(db,'one',0,now+1000);assert.equal(r.overview.currencies[0].revenue,1400);assert.equal(r.overview.currencies[0].grossRevenue,1900);assert.equal(r.overview.currencies[0].refunds,500);assert.equal(r.stories.find(s=>s.amountMinor<0).visitorId,'visitor1');
 const next=await report(db,'one',now+1000,now+86401000);assert.equal(next.overview.currencies[0].revenue,-500);assert.equal(next.sources[0].payments,0);
});
test('Shopify successful refund transactions offset matched order only once',async()=>{
 const {db}=database();await ingest(db,event(),{});
 await savePayment(db,'shopify','one',{id:123,financial_status:'paid',total_price:'19.00',currency:'USD',processed_at:new Date(now).toISOString(),note_attributes:[{name:'tidestat_site_id',value:'one'},{name:'tidestat_visitor_id',value:'visitor1'},{name:'tidestat_session_id',value:'session1'}]},new Headers({'x-shopify-topic':'orders/paid','x-shopify-webhook-id':'order-delivery'}));
 const r={id:456,order_id:123,created_at:new Date(now).toISOString(),transactions:[{kind:'refund',status:'success',amount:'5.00',currency:'USD'},{kind:'refund',status:'failure',amount:'9.00',currency:'USD'}]};
 const h=new Headers({'x-shopify-topic':'refunds/create','x-shopify-webhook-id':'refund-delivery'});await savePayment(db,'shopify','one',r,h);await savePayment(db,'shopify','one',r,h);
 const result=await report(db,'one',0,now+1000);assert.equal(result.overview.currencies[0].revenue,1400);assert.equal(result.stories.find(s=>s.amountMinor<0).visitorId,'visitor1');
});
test('historical story pagination preserves full aggregate totals and exact visitor filtering',async()=>{
 const {db}=database();await ingest(db,event(),{});
 for(let i=0;i<105;i++)await savePayment(db,'stripe','one',payment(`cs_${i}`),new Headers());
 const all=await report(db,'one',0,now+1000);assert.equal(all.storyCount,105);assert.equal(all.stories.length,100);assert.equal(all.nextOffset,100);assert.equal(all.overview.currencies[0].revenue,199500);
 const page=await report(db,'one',0,now+1000,{offset:100,limit:10,visitor:'visitor1'});assert.equal(page.stories.length,5);assert.equal(page.nextOffset,null);
 const empty=await report(db,'one',0,now+1000,{visitor:'unknown'});assert.equal(empty.storyCount,0);
});
test('opaque pixel origins require an explicit site opt-in',async()=>{
 const {db}=database();let site={origin:'https://one.test',readToken:'token'};
 const request=()=>new Request('https://tide.test/api/collect',{method:'POST',headers:{origin:'null'},body:JSON.stringify(event())});
 assert.equal((await worker.fetch(request(),{DB:db,SITES_JSON:JSON.stringify({one:site})})).status,403);
 site.allowedOrigins=['null'];assert.equal((await worker.fetch(request(),{DB:db,SITES_JSON:JSON.stringify({one:site})})).status,200);
});
test('Stripe second precision includes same-second browser steps without including later seconds',async()=>{
 const {db}=database();const second=Math.floor(now/1000)*1000;
 for(const [id,type,offset] of [['view','page_view',100],['signup','signup',200],['checkout','checkout',300]])await ingest(db,event('one',id,'visitor1','session1',type,second+offset),{});
 await ingest(db,event('one','later','custom','later-session','page_view',second+1100),{});
 const p=payment('cs_precision');p.created=second/1000;await savePayment(db,'stripe','one',p,new Headers());
 const result=await report(db,'one',second-10000,second+2000);
 assert.equal(result.stories[0].sessionCount,1);assert.deepEqual(result.stories[0].timeline.map(e=>e.type),['page_view','signup','checkout']);
 assert.deepEqual(result.funnel.map(s=>s.visitors),[2,1,1]);assert.equal(result.leaks[0].visitors,0);
 // The tolerance must not admit this visitor's events in the next second either.
 await ingest(db,event('one','next-second','visitor1','session2','page_view',second+1000),{});
 const next=await report(db,'one',second-10000,second+2000);assert.equal(next.stories[0].sessionCount,1);assert.equal(next.stories[0].timeline.length,3);
});
test('guest checkout enters commerce funnel without inventing a signup',async()=>{
 const {db}=database();await ingest(db,event(),{});await ingest(db,event('one','guest-checkout','visitor1','session1','checkout',now-9000),{});
 await savePayment(db,'shopify','one',{id:900,financial_status:'paid',total_price:'19.00',currency:'USD',processed_at:new Date(now).toISOString(),note_attributes:[{name:'tidestat_site_id',value:'one'},{name:'tidestat_visitor_id',value:'visitor1'},{name:'tidestat_session_id',value:'session1'}]},new Headers({'x-shopify-topic':'orders/paid','x-shopify-webhook-id':'guest-order'}));
 const result=await report(db,'one',now-20000,now+1000);
 assert.deepEqual(result.funnel.map(s=>[s.name,s.visitors]),[['page_view',1],['checkout',1],['payment',1]]);
 assert.deepEqual(result.signupFunnel.map(s=>s.visitors),[1,0,0,0]);
});
test('live stream includes only same-site verified payments with stable event IDs',async()=>{
 const {db}=database();await ingest(db,event('one','behavior-one'),{});await ingest(db,event('two','behavior-two'),{});
 await savePayment(db,'stripe','one',payment('cs_live_one'),new Headers());
 const other=payment('cs_live_other',{tidestat_site_id:'two',tidestat_visitor_id:'visitor1',tidestat_session_id:'session1'});await savePayment(db,'stripe','two',other,new Headers());
 const env={DB:db,SITES_JSON:JSON.stringify({one:{readToken:'secret'}})};
 const response=await worker.fetch(new Request('https://tide.test/api/live?site=one',{headers:{authorization:'Bearer secret'}}),env);
 const live=await response.json(),events=live.visitors[0].events;
 assert.equal(events.find(e=>e.type==='page_view').id,'behavior-one');assert.equal(events.find(e=>e.type==='payment').id,'stripe:cs_live_one');assert.equal(events.find(e=>e.type==='payment').amountMinor,1900);assert.equal(events.some(e=>e.id==='stripe:cs_live_other'),false);
});
test('payment-only periods leave visitor ratios unavailable rather than zero',async()=>{
 const {db}=database();await savePayment(db,'stripe','one',payment('cs_no_visit',{}),new Headers());
 const result=await report(db,'one',now-1000,now+1000);
 assert.equal(result.overview.conversion,null);assert.equal(result.overview.currencies[0].revenuePerVisitor,null);assert.equal(result.overview.currencies[0].revenue,1900);
});
