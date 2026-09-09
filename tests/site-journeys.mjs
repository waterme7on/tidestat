import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker.js';
import {hashToken} from '../accounts.js';
import {ingest} from '../revenue.js';
import {siteJourneys} from '../site-journeys.js';
import {journey} from '../footprint-model.js';

test('observed pages retain distinct URLs, strip query data, and connect only consecutive same-session observations',()=>{
 const paths=[{path:'/shop?secret=1',ts:1,sessionId:'a'},{path:'/products/a',ts:2,sessionId:'a'},{path:'/products/b',ts:3,sessionId:'b'},{path:'/checkout',ts:4,sessionId:'b'}];
 const graph=siteJourneys([{paths}]);
 assert.deepEqual(graph.nodes.map(n=>n.id),['/checkout','/products/a','/products/b','/shop']);
 assert.deepEqual(graph.edges,[['/shop','/products/a',1],['/products/b','/checkout',1]]);
 assert.deepEqual(siteJourneys([{paths:paths.map(({sessionId,...step})=>step)}]).edges,[]);
 const small=siteJourneys([{paths}],2);assert.equal(small.omittedPages,2);assert.equal(small.nodes.length,2);
 assert.deepEqual(journey({visited:[{node:'/checkout',sessionId:'b'},{node:'omitted',sessionId:'b'},{node:'/products/b',sessionId:'b'}]},small),[]);
 assert.deepEqual(journey({visited:paths.map(p=>({node:p.path.split('?')[0],sessionId:p.sessionId}))},graph),graph.edges.map(e=>e.slice(0,2)));
 assert.deepEqual(siteJourneys([]).nodes,[]);
});

test('live journeys enforce tenant cookies and site tokens even with identical event, visitor and session IDs',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const db={prepare(query){return{bind(...args){return{first:async()=>sql.prepare(query).get(...args)||null,all:async()=>({results:sql.prepare(query).all(...args)}),run:async()=>sql.prepare(query).run(...args)}}}},async batch(statements){return Promise.all(statements.map(s=>s.run()));}};
 const now=Date.now(),cookies={};
 for(const site of ['one','two']){
  sql.prepare('INSERT INTO account_users VALUES (?,?,?,?,?)').run(site,'google-'+site,site+'@test.local',site,now);
  sql.prepare('INSERT INTO account_sites VALUES (?,?,?,?,?)').run(site,site,site,'https://'+site+'.test',now);
  const token=Buffer.alloc(32,site==='one'?1:2).toString('base64url');cookies[site]='__Host-tidestat_session='+token;
  sql.prepare('INSERT INTO account_sessions VALUES (?,?,?)').run(await hashToken(token),site,now+60000);
  for(let i=0;i<3;i++) await ingest(db,{schema_version:1,event_id:'event'+i,site_id:site,visitor_id:'same-visitor',session_id:i===2?'new-session':'same-session',type:'page_view',path:`/${site}/page${i}`,occurred_at:now-3000+i*1000},{});
 }
 const env={DB:db,SITES_JSON:JSON.stringify({one:{readToken:'one-token'},two:{readToken:'two-token'}})};
 const read=(site,headers)=>worker.fetch(new Request(`https://tide.test/api/live?site=${site}`,{headers}),env);
 assert.equal((await read('two',{cookie:cookies.one})).status,401);
 assert.equal((await read('two',{authorization:'Bearer one-token'})).status,401);
 assert.equal((await read('one',{})).status,401);
 for(const site of ['one','two']){
  const response=await read(site,{cookie:cookies[site]});assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.site,site);assert.equal(data.visitors.length,1);
  assert.ok(data.visitors[0].paths.every(p=>p.path.startsWith('/'+site+'/')));
  assert.deepEqual(siteJourneys(data.visitors).edges,[[`/${site}/page0`,`/${site}/page1`,1]]);
  assert.equal((await read(site,{authorization:`Bearer ${site}-token`})).status,200);
 }
 sql.close();
});
