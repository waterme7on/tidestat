export const PLANS=Object.freeze([
 {id:'free',name:'Free',monthlyPrice:0,yearlyPrice:0,currency:'USD',limits:{sites:1,monthlyEvents:10000}},
 {id:'starter',name:'Starter',monthlyPrice:9,yearlyPrice:90,currency:'USD',limits:{sites:3,monthlyEvents:100000}},
 {id:'growth',name:'Growth',monthlyPrice:29,yearlyPrice:290,currency:'USD',limits:{sites:10,monthlyEvents:1000000}}
]);
export const planById=id=>PLANS.find(plan=>plan.id===id)||PLANS[0];
const validOrigin=env=>{try{return new URL(env.APP_ORIGIN).origin===env.APP_ORIGIN&&new URL(env.APP_ORIGIN).protocol==='https:';}catch{return false;}};
export const billingAvailable=env=>!!(validOrigin(env)&&env.STRIPE_SECRET_KEY&&env.BILLING_WEBHOOK_SECRET&&env.STRIPE_PRICE_STARTER_MONTHLY&&env.STRIPE_PRICE_STARTER_YEARLY&&env.STRIPE_PRICE_GROWTH_MONTHLY&&env.STRIPE_PRICE_GROWTH_YEARLY);
export const priceFor=(env,plan,interval)=>['starter','growth'].includes(plan)&&['monthly','yearly'].includes(interval)?env[`STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`]:null;
export function planForPrice(env,id){for(const plan of ['starter','growth'])for(const interval of ['monthly','yearly'])if(id&&priceFor(env,plan,interval)===id)return {plan,interval};return null;}
export async function billingState(db,userId){
 const row=await db.prepare('SELECT plan,status,interval FROM account_billing WHERE user_id=?').bind(userId).first();
 const plan=['active','trialing'].includes(row?.status)?planById(row.plan):planById('free'),month=new Date().toISOString().slice(0,7);
 const usage=await db.prepare('SELECT events FROM account_usage WHERE user_id=? AND month=?').bind(userId,month).first();
 return {plan:plan.id,status:row?.status||'free',interval:row?.interval||null,limits:plan.limits,usage:{month,events:usage?.events||0}};
}
// Transactional reservation: duplicate event IDs do not consume the monthly allowance twice.
export async function consumeEventQuota(env,siteId,eventId){
 const site=await env.DB.prepare('SELECT user_id FROM account_sites WHERE id=?').bind(siteId).first();
 if(!site)return {allowed:true,managed:false};
 const state=await billingState(env.DB,site.user_id),month=state.usage.month,limit=state.limits.monthlyEvents,nonce=crypto.randomUUID();
 await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO account_usage VALUES (?,?,0)').bind(site.user_id,month),
  env.DB.prepare('INSERT OR IGNORE INTO account_event_reservations SELECT ?,?,?,? WHERE (SELECT events FROM account_usage WHERE user_id=? AND month=?)<?').bind(siteId,eventId,month,nonce,site.user_id,month,limit),
  env.DB.prepare('UPDATE account_usage SET events=events+1 WHERE user_id=? AND month=? AND EXISTS(SELECT 1 FROM account_event_reservations WHERE site_id=? AND event_id=? AND nonce=?)').bind(site.user_id,month,siteId,eventId,nonce)
 ]);
 const reserved=await env.DB.prepare('SELECT event_id FROM account_event_reservations WHERE site_id=? AND event_id=?').bind(siteId,eventId).first();
 const usage=await env.DB.prepare('SELECT events FROM account_usage WHERE user_id=? AND month=?').bind(site.user_id,month).first();
 return {allowed:!!reserved,managed:true,limit,used:usage.events,month};
}
