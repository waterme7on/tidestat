import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs/promises';
import worker from '../worker.js';
import {maskIp,validMaskedIp} from '../privacy.js';
for(const [value,wanted]of [['203.0.113.42','203.*.*.42'],['198.51.100.7','198.*.*.7'],['2001:db8:1234:5678::a01','2001:*:*:a01'],['::1','0:*:*:1'],['::','0:*:*:0'],['::ffff:192.0.2.42','0:*:*:22a'],['invalid',null],['203.0.113.999',null],['2001::db8::1',null],['<script>',null],[null,null],['',null]])assert.equal(maskIp(value),wanted,value);
assert.equal(validMaskedIp('203.0.113.42'),null);assert.equal(validMaskedIp('2001:db8::1'),null);
assert.equal(validMaskedIp('203.*.*.42'),'203.*.*.42');assert.equal(validMaskedIp('999.*.*.42'),null);
const db=new DatabaseSync(':memory:');
const schema=await fs.readFile(new URL('../schema.sql',import.meta.url),'utf8');
db.exec(schema);db.exec("INSERT INTO events(visitor_id,ts,path) VALUES ('legacy',"+Date.now()+",'/existing')");db.exec(schema);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM events').get().n,1);
const bindings=[];
const DB={prepare(sql){return {bind(...args){bindings.push(args);return {run:async()=>db.prepare(sql).run(...args),all:async()=>({results:db.prepare(sql).all(...args)})}}}},async batch(statements){db.exec('BEGIN');try{const results=await Promise.all(statements.map(s=>s.run()));db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};
const env={DB,ASSETS:{fetch:()=>new Response('asset')}};
async function collect(id,ip,path='/zh/work',extra={}){const req=new Request('https://example.test/api/collect',{method:'POST',headers:{'content-type':'application/json',...(ip?{'CF-Connecting-IP':ip}:{})},body:JSON.stringify({v:id,p:path,ip:'192.0.2.99',...extra})});Object.defineProperty(req,'cf',{value:{city:'Tokyo',country:'JP',latitude:'35.7',longitude:'139.7'}});return worker.fetch(req,env);}
assert.equal((await collect('visitor-one','203.0.113.42')).status,200);
assert.equal((await collect('visitor-two','203.0.113.42')).status,200); // shared IP must never merge identities
assert.equal((await collect('unknown',null)).status,200);
assert.equal((await collect('ipv6','2001:db8::a01')).status,200);
const body=await (await worker.fetch(new Request('https://example.test/api/live'),env)).json();
assert.equal(body.onlineMs,90000);assert.equal(body.visitors.length,5);
assert.equal(body.visitors.find(v=>v.id==='visitor-one').maskedIp,'203.*.*.42');
assert.equal(body.visitors.find(v=>v.id==='legacy').maskedIp,null);assert.equal(body.visitors.find(v=>v.id==='unknown').maskedIp,null);
const serialized=JSON.stringify([bindings,body,db.prepare('SELECT * FROM visitor_display').all()]);
for(const ip of ['203.0.113.42','192.0.2.99','2001:db8::a01'])assert.equal(serialized.includes(ip),false,ip);
await fs.mkdir('visual-review',{recursive:true});await fs.writeFile('visual-review/privacy-results.json',JSON.stringify({passed:true,checks:['IPv4/IPv6 malformed inputs','No raw source IP in DB bindings or live response','Idempotent additive SQL preserves existing events','Shared masked IPs keep distinct IDs','Missing and legacy IPs remain null','Real SQLite integration of collect and live endpoints']}));
console.log('Privacy and SQLite-backed Worker integration passed');db.close();
