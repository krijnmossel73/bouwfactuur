import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { onRequestPost } from '../functions/api/peppol/webhook.js';
function d1(db){const wrap=(sql)=>{let args=[];const st={bind:(...a)=>{args=a;return st;},first:async()=>db.prepare(sql).get(...args)??null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:db.prepare(sql).run(...args).changes}})};return st;};return{prepare:wrap};}
const raw=new DatabaseSync(':memory:'); raw.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url),'utf8'));
raw.prepare("INSERT INTO invoices (id,user_id,number,year,date,data,peppol,peppol_ref) VALUES ('i1','u1','2026-0001',2026,'2026-09-01','{}','{\"invoiceId\":\"555\",\"state\":\"sent\"}','555')").run();
const secret='shh'; const body=JSON.stringify({ event: 'invoice.state_change', invoice: { id: 555, state: 'refused' } });
const t=Math.floor(Date.now()/1000);
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
const sig=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${t}.${body}`)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const mk=(h)=>({ env:{B2BROUTER_WEBHOOK_SECRET:secret,DB:d1(raw)}, request:new Request('https://x/api/peppol/webhook',{method:'POST',headers:{'X-B2Brouter-Signature':h},body}) });
console.log('good:', (await onRequestPost(mk(`t=${t},s=${sig}`))).status, raw.prepare("SELECT peppol FROM invoices").get().peppol);
console.log('bad :', (await onRequestPost(mk(`t=${t},s=${'0'.repeat(64)}`))).status);
console.log('old :', (await onRequestPost(mk(`t=${t-5000},s=${sig}`))).status);
