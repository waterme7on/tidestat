import {PLANS,billingAvailable,billingState} from './plans.js';
import {handleBillingRequest} from './billing.js';
export {consumeEventQuota} from './plans.js';
const SESSION='__Host-tidestat_session',STATE='__Host-tidestat_oauth';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random=()=>base64url(crypto.getRandomValues(new Uint8Array(32)));
export const hashToken=async token=>base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
const cookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
function cookies(request){return Object.fromEntries((request.headers.get('cookie')||'').split(';').map(v=>v.trim().split('=')));}
function appOrigin(env){try{const url=new URL(env.APP_ORIGIN);return url.protocol==='https:'&&url.origin===env.APP_ORIGIN?url.origin:null;}catch{return null;}}
const googleAvailable=env=>!!(appOrigin(env)&&env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET);
const network=(env,url,options={})=>(env.FETCH||fetch)(url,{...options,signal:AbortSignal.timeout(10000)});
export async function getSessionUser(request,env){
 const token=cookies(request)[SESSION];if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
 return await env.DB.prepare('SELECT u.id,u.email,u.name FROM account_sessions s JOIN account_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hashToken(token),Date.now()).first();
}
export async function getManagedSite(db,id){const site=await db.prepare('SELECT id,user_id,name,origin,created_at FROM account_sites WHERE id=?').bind(id).first();return site?{origin:site.origin,ownerId:site.user_id,name:site.name,managed:true}:null;}
export async function canReadSite(request,env,siteId){const user=await getSessionUser(request,env);return !!(user&&await env.DB.prepare('SELECT id FROM account_sites WHERE id=? AND user_id=?').bind(siteId,user.id).first());}
function decode(value){const normalized=value.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'=')),c=>c.charCodeAt(0));}
async function verifyIdToken(token,env,nonce){
 const parts=String(token||'').split('.');if(parts.length!==3)throw new Error('Invalid identity token');
 const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw new Error('Invalid identity token');
 const response=await network(env,'https://www.googleapis.com/oauth2/v3/certs');if(!response.ok)throw new Error('Identity unavailable');
 const jwks=await response.json(),jwk=jwks.keys?.find(key=>key.kid===header.kid&&key.kty==='RSA');if(!jwk)throw new Error('Unknown identity key');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`)))throw new Error('Invalid identity signature');
 const now=Date.now()/1000;
 if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||claims.aud!==env.GOOGLE_CLIENT_ID||(claims.azp&&claims.azp!==env.GOOGLE_CLIENT_ID)||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||claims.nonce!==nonce||typeof claims.sub!=='string'||!claims.sub)throw new Error('Invalid identity claims');
 return claims;
}
async function googleStart(request,env){
 if(!googleAvailable(env))return json({error:'Google sign-in is not configured'},503);
 const state=random(),binding=random(),verifier=random()+random(),nonce=random();
 await env.DB.batch([env.DB.prepare('DELETE FROM account_oauth_states WHERE expires_at<?').bind(Date.now()),env.DB.prepare('INSERT INTO account_oauth_states VALUES (?,?,?,?,?)').bind(await hashToken(state),await hashToken(binding),verifier,nonce,Date.now()+600000)]);
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:`${env.APP_ORIGIN}/api/auth/callback`,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:await hashToken(verifier),code_challenge_method:'S256',prompt:'select_account'}).toString();
 return new Response(null,{status:302,headers:{Location:url.href,'Set-Cookie':cookie(STATE,binding,600),'Cache-Control':'no-store'}});
}
async function googleCallback(request,env){
 if(!googleAvailable(env))return json({error:'Google sign-in is not configured'},503);
 const url=new URL(request.url),state=url.searchParams.get('state'),binding=cookies(request)[STATE],code=url.searchParams.get('code');
 if(!state||!binding||!code)return json({error:'Sign-in expired or canceled. Please start again.'},400,{'Set-Cookie':cookie(STATE,'',0)});
 // DELETE ... RETURNING atomically consumes state before any external exchange.
 const challenge=await env.DB.prepare('DELETE FROM account_oauth_states WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING verifier,nonce').bind(await hashToken(state),await hashToken(binding),Date.now()).first();
 if(!challenge)return json({error:'Sign-in expired or was already used. Please start again.'},400,{'Set-Cookie':cookie(STATE,'',0)});
 try{
  const exchange=await network(env,'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:`${env.APP_ORIGIN}/api/auth/callback`,grant_type:'authorization_code',code_verifier:challenge.verifier}).toString()});
  if(!exchange.ok)throw new Error('Exchange failed');const tokens=await exchange.json(),claims=await verifyIdToken(tokens.id_token,env,challenge.nonce);
  if(typeof tokens.access_token!=='string')throw new Error('Missing token');
  const profileResponse=await network(env,'https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`}});if(!profileResponse.ok)throw new Error('Profile unavailable');const profile=await profileResponse.json();
  if(profile.sub!==claims.sub||profile.email_verified!==true||typeof profile.email!=='string'||profile.email.length>320)throw new Error('Verified Google email required');
  const id=crypto.randomUUID(),name=String(profile.name||'').slice(0,160);
  await env.DB.prepare('INSERT INTO account_users VALUES (?,?,?,?,?) ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email,name=excluded.name').bind(id,claims.sub,profile.email,name,Date.now()).run();
  const user=await env.DB.prepare('SELECT id FROM account_users WHERE google_sub=?').bind(claims.sub).first(),session=random(),previous=cookies(request)[SESSION];
  await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO account_sites SELECT id,?,name,origin,created_at FROM account_site_claims WHERE LOWER(owner_email)=?').bind(user.id,profile.email.toLowerCase()),env.DB.prepare('DELETE FROM account_site_claims WHERE LOWER(owner_email)=? AND EXISTS(SELECT 1 FROM account_sites s WHERE s.id=account_site_claims.id AND s.user_id=?)').bind(profile.email.toLowerCase(),user.id)]);
  const statements=[env.DB.prepare('DELETE FROM account_sessions WHERE expires_at<?').bind(Date.now()),env.DB.prepare('INSERT INTO account_sessions VALUES (?,?,?)').bind(await hashToken(session),user.id,Date.now()+30*86400000)];
  if(previous)statements.push(env.DB.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(await hashToken(previous)));await env.DB.batch(statements);
  const headers=new Headers({Location:`${env.APP_ORIGIN}/account.html`,'Cache-Control':'no-store'});headers.append('Set-Cookie',cookie(STATE,'',0));headers.append('Set-Cookie',cookie(SESSION,session,30*86400));return new Response(null,{status:302,headers});
 }catch{return json({error:'Google sign-in could not be verified. Please start again.'},400,{'Set-Cookie':cookie(STATE,'',0)});}
}
export async function handleAccountRequest(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(!path.startsWith('/api/auth/')&&!path.startsWith('/api/billing/')&&path!=='/api/sites'&&path!=='/api/plans')return null;
 try{
  if(path==='/api/plans'&&request.method==='GET')return json({plans:PLANS,billingAvailable:billingAvailable(env)});
  if(path==='/api/auth/google'&&request.method==='GET')return await googleStart(request,env);
  if(path==='/api/auth/callback'&&request.method==='GET')return await googleCallback(request,env);
  // The webhook must not depend on a browser session or CSRF header.
  if(path==='/api/billing/webhook')return await handleBillingRequest(request,env,null);
  const user=await getSessionUser(request,env);
  if(path==='/api/auth/me'&&request.method==='GET')return json({user,billing:user?await billingState(env.DB,user.id):null,capabilities:{google:googleAvailable(env),billing:billingAvailable(env)}});
  if(path.startsWith('/api/billing/'))return await handleBillingRequest(request,env,user);
  if(!user)return json({error:'Sign in required'},401);
  if(request.method==='POST'&&(!appOrigin(env)||request.headers.get('origin')!==env.APP_ORIGIN))return json({error:'Same-origin request required'},403);
  if(path==='/api/auth/logout'&&request.method==='POST'){await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(await hashToken(cookies(request)[SESSION])).run();return json({ok:true},200,{'Set-Cookie':cookie(SESSION,'',0)});}
  if(path==='/api/sites'&&request.method==='GET'){const {results}=await env.DB.prepare('SELECT id,name,origin,created_at AS createdAt,(SELECT MAX(ts) FROM story_events WHERE site_id=account_sites.id AND type=\'page_view\') AS lastPageviewAt FROM account_sites WHERE user_id=? ORDER BY created_at').bind(user.id).all();return json({sites:results});}
  if(path==='/api/sites'&&request.method==='POST'){
   let body;try{body=await request.json();}catch{return json({error:'Invalid JSON'},400);}
   let origin;try{const parsed=new URL(body.origin);if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw new Error();origin=parsed.origin;}catch{return json({error:'Use the HTTPS origin only, for example https://example.com'},400);}
   const name=String(body.name||'').trim();if(!name||name.length>100)return json({error:'Website name must be 1–100 characters'},400);
   const state=await billingState(env.DB,user.id),site={id:`site_${crypto.randomUUID().replace(/-/g,'')}`,name,origin,createdAt:Date.now()};
   await env.DB.prepare('INSERT INTO account_sites SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM account_sites WHERE user_id=?)<?').bind(site.id,user.id,name,origin,site.createdAt,user.id,state.limits.sites).run();
   if(!await env.DB.prepare('SELECT id FROM account_sites WHERE id=?').bind(site.id).first())return json({error:'Website limit reached for your current plan',limit:state.limits.sites},409);
   return json({site},201);
  }
  return json({error:'Not found'},404);
 }catch{return json({error:'Account service is temporarily unavailable'},503);}
}
