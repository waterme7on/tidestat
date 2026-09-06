import {billingAvailable,priceFor,planForPrice,planById} from './plans.js';
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const network=(env,url,options={})=>(env.FETCH||fetch)(url,{...options,signal:AbortSignal.timeout(10000)});
export async function stripeRequest(env,path,params=null,idempotencyKey){
 const headers={Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'Stripe-Version':'2025-06-30.basil'};
 if(params)headers['Content-Type']='application/x-www-form-urlencoded';if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;
 const response=await network(env,`https://api.stripe.com/v1/${path}`,{method:params?'POST':'GET',headers,...(params?{body:new URLSearchParams(params).toString()}:{} )});
 if(!response.ok)throw new Error('Billing provider unavailable');return response.json();
}
async function verify(raw,header,secret){
 if(!secret)return false;const parts=(header||'').split(',').map(p=>p.split('=')),timestamp=parts.find(p=>p[0]==='t')?.[1];
 if(!/^\d+$/.test(timestamp||'')||Math.abs(Date.now()/1000-Number(timestamp))>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}.${raw}`))),expected=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
 return parts.some(([name,value])=>{if(name!=='v1'||value?.length!==expected.length)return false;let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^value.charCodeAt(i);return diff===0;});
}
async function webhook(request,env){
 const raw=await request.text();if(raw.length>1048576)return respond({error:'Payload too large'},413);
 if(!await verify(raw,request.headers.get('stripe-signature'),env.BILLING_WEBHOOK_SECRET))return respond({error:'Invalid billing signature'},401);
 const event=JSON.parse(raw);if(typeof event.id!=='string'||!Number.isSafeInteger(event.created))return respond({error:'Invalid billing event'},400);
 if(await env.DB.prepare('SELECT id FROM account_billing_events WHERE id=?').bind(event.id).first())return respond({ok:true,duplicate:true});
 if(!['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','checkout.session.completed','invoice.paid','invoice.payment_failed'].includes(event.type))return respond({ok:true,ignored:true});
 const obj=event.data?.object||{},idOf=v=>typeof v==='string'?v:v?.id;
 const subscriptionId=event.type.startsWith('customer.subscription.')?obj.id:idOf(obj.subscription)||idOf(obj.parent?.subscription_details?.subscription);
 if(!subscriptionId)return respond({ok:true,ignored:true});
 // Never derive an entitlement from checkout metadata or an old webhook snapshot.
 const subscription=await stripeRequest(env,`subscriptions/${encodeURIComponent(subscriptionId)}`);
 const customer=idOf(subscription.customer),account=await env.DB.prepare('SELECT * FROM account_billing WHERE customer_id=?').bind(customer||'').first();
 if(!account)return respond({ok:true,ignored:true});
 const items=subscription.items?.data||[],selection=items.length===1?planForPrice(env,idOf(items[0].price)):null;
 const enabled=selection&&['active','trialing'].includes(subscription.status),plan=enabled?selection.plan:'free',interval=selection?.interval||null,created=Number(subscription.created)||0;
 await env.DB.batch([
  env.DB.prepare(`UPDATE account_billing SET subscription_id=?,plan=?,status=?,interval=?,subscription_created=?,last_event_created=? WHERE user_id=? AND (subscription_created<? OR (subscription_id=? AND last_event_created<=?))`).bind(subscription.id,plan,subscription.status||'unknown',interval,created,event.created,account.user_id,created,subscription.id,event.created),
  env.DB.prepare('INSERT OR IGNORE INTO account_billing_events VALUES (?,?)').bind(event.id,Date.now())
 ]);
 return respond({ok:true});
}
export async function handleBillingRequest(request,env,user){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/billing/'))return null;
 try{
  if(url.pathname==='/api/billing/webhook'&&request.method==='POST'){if(!env.STRIPE_SECRET_KEY||!env.BILLING_WEBHOOK_SECRET)return respond({error:'Billing is not configured'},503);return await webhook(request,env);}
  if(!user)return respond({error:'Sign in required'},401);
  if(request.method!=='POST')return respond({error:'Method not allowed'},405);
  if(request.headers.get('origin')!==env.APP_ORIGIN)return respond({error:'Same-origin request required'},403);
  if(!billingAvailable(env))return respond({error:'Billing is not configured'},503);
  let account=await env.DB.prepare('SELECT * FROM account_billing WHERE user_id=?').bind(user.id).first();
  if(url.pathname==='/api/billing/portal'){
   if(!account?.customer_id)return respond({error:'No billing customer yet'},409);
   const portal=await stripeRequest(env,'billing_portal/sessions',{customer:account.customer_id,return_url:`${env.APP_ORIGIN}/account.html`});return respond({url:portal.url});
  }
  if(url.pathname==='/api/billing/checkout'){
   let body;try{body=await request.json();}catch{return respond({error:'Invalid JSON'},400);}
   const price=priceFor(env,body.plan,body.interval);if(!price)return respond({error:'Choose a supported plan and billing interval'},400);
   const configuredPrice=await stripeRequest(env,`prices/${encodeURIComponent(price)}`),plan=planById(body.plan),expectedAmount=(body.interval==='yearly'?plan.yearlyPrice:plan.monthlyPrice)*100;
   if(configuredPrice.active!==true||configuredPrice.currency!=='usd'||configuredPrice.unit_amount!==expectedAmount||configuredPrice.recurring?.interval!==(body.interval==='yearly'?'year':'month')||configuredPrice.recurring?.interval_count!==1||configuredPrice.billing_scheme!=='per_unit'||configuredPrice.recurring?.usage_type==='metered')return respond({error:'Billing price configuration does not match the published plan'},503);
   if(account?.subscription_id&&!['canceled','incomplete_expired'].includes(account.status))return respond({error:'Manage the existing subscription in the billing portal'},409);
   if(!account?.customer_id){
    const customer=await stripeRequest(env,'customers',{'metadata[tidestat_user_id]':user.id,email:user.email},`tidestat-customer-${user.id}`);
    await env.DB.prepare('INSERT INTO account_billing(user_id,customer_id) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET customer_id=COALESCE(account_billing.customer_id,excluded.customer_id)').bind(user.id,customer.id).run();
    account=await env.DB.prepare('SELECT * FROM account_billing WHERE user_id=?').bind(user.id).first();
   }
   let pending=await env.DB.prepare('SELECT * FROM account_checkouts WHERE user_id=?').bind(user.id).first();
   if(pending?.session_id){
    const previous=await stripeRequest(env,`checkout/sessions/${encodeURIComponent(pending.session_id)}`);
    if(previous.status==='complete'&&((typeof previous.subscription==='string'?previous.subscription:previous.subscription?.id)!==account.subscription_id))return respond({error:'Your checkout is complete; the billing update is still processing'},409);
    if(previous.status==='open'&&Number(previous.expires_at)*1000>Date.now()){
     if(pending.plan!==body.plan||pending.interval!==body.interval)return respond({error:'Finish or cancel your existing checkout before choosing another plan'},409);
     return respond({url:previous.url});
    }
    await env.DB.prepare('DELETE FROM account_checkouts WHERE user_id=? AND nonce=?').bind(user.id,pending.nonce).run();
   }
   const expires=Math.floor(Date.now()/1000)+3600;
   await env.DB.prepare('INSERT INTO account_checkouts VALUES (?,?,?,?,NULL,NULL,?) ON CONFLICT(user_id) DO UPDATE SET nonce=excluded.nonce,plan=excluded.plan,interval=excluded.interval,session_id=NULL,url=NULL,expires_at=excluded.expires_at WHERE account_checkouts.expires_at<?').bind(user.id,crypto.randomUUID(),body.plan,body.interval,expires*1000,Date.now()).run();
   pending=await env.DB.prepare('SELECT * FROM account_checkouts WHERE user_id=?').bind(user.id).first();
   if(pending.plan!==body.plan||pending.interval!==body.interval)return respond({error:'Finish or cancel your existing checkout before choosing another plan'},409);
   const session=await stripeRequest(env,'checkout/sessions',{mode:'subscription',customer:account.customer_id,expires_at:String(Math.floor(pending.expires_at/1000)),'line_items[0][price]':price,'line_items[0][quantity]':'1',client_reference_id:user.id,'subscription_data[metadata][tidestat_user_id]':user.id,success_url:`${env.APP_ORIGIN}/account.html?billing=processing`,cancel_url:`${env.APP_ORIGIN}/account.html?billing=canceled`},`tidestat-checkout-${pending.nonce}`);
   await env.DB.prepare('UPDATE account_checkouts SET session_id=?,url=?,expires_at=? WHERE user_id=? AND nonce=?').bind(session.id,session.url,Number(session.expires_at||pending.expires_at/1000)*1000,user.id,pending.nonce).run();
   return respond({url:session.url});
  }
  return respond({error:'Not found'},404);
 }catch{return respond({error:'Billing could not be completed. Please retry.'},503);}
}
