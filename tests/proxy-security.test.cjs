'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {createCache,boundedJson}=require('../server/proxy-cache.cjs');
test('cache combines simultaneous requests before upstream work and handles void writes',async()=>{
 let prepares=0,loads=0;
 const cache=createCache('rail',{secret:'a'.repeat(64),callRpc:async name=>{if(name.endsWith('prepare')){prepares++;return {state:'claimed'}}return null}});
 const load=async()=>{loads++;return {ok:true,trains:[]}};
 const rows=await Promise.all(Array.from({length:5},()=>cache.get('fixed',{headers:{}},load)));
 assert.equal(prepares,1);assert.equal(loads,1);assert(rows.every(x=>x.ok));
});
test('fresh shared cache works across separate process caches without upstream calls',async()=>{
 let loads=0;
 for(let i=0;i<2;i++){const cache=createCache('openf1',{secret:'a'.repeat(64),callRpc:async()=>({state:'cached',payload:[]})});assert.deepEqual(await cache.get('same',{headers:{}},async()=>{loads++;return []}),[])}
 assert.equal(loads,0);
});
test('missing credentials, exhausted budget and another lease prevent upstream work',async()=>{
 for(const [secret,state,status] of [['','claimed',503],['a'.repeat(64),'limited',429],['a'.repeat(64),'pending',503]]){
  let loads=0;const cache=createCache('rail',{secret,callRpc:async()=>({state})});
  await assert.rejects(()=>cache.get('fixed',{headers:{}},async()=>{loads++}),e=>e.status===status);assert.equal(loads,0);
 }
});
test('failed refresh releases its lease and serves only a prepared stale payload',async()=>{
 let completed;const cache=createCache('rail',{secret:'a'.repeat(64),callRpc:async(name,args)=>name.endsWith('prepare')?{state:'claimed',stale_payload:{ok:true,trains:[]}}:(completed=args)});
 assert.deepEqual(await cache.get('fixed',{headers:{}},async()=>{throw Error('private failure')}),{ok:true,trains:[]});
 assert.equal(completed.p_success,false);assert.equal(completed.p_payload,null);
});
test('response size is checked on headers and actual streamed bytes',async()=>{
 await assert.rejects(()=>boundedJson(new Response('12345',{headers:{'Content-Length':'5'}}),4),/too_large/);
 await assert.rejects(()=>boundedJson(new Response('12345'),4),/too_large/);
 assert.deepEqual(await boundedJson(new Response('[{"ok":true}]'),32),[{ok:true}]);
});

test('OpenF1 rejects unbounded/duplicate/unknown filters and canonicalizes query order',async()=>{
 const {canonicalQuery}=await import('../api/openf1.js');
 const good='https://test.invalid/api/openf1?endpoint=sessions&year=2026&session_name=Race';
 assert.equal(canonicalQuery(new URL(good)).key,canonicalQuery(new URL('https://test.invalid/api/openf1?session_name=Race&year=2026&endpoint=sessions')).key);
 for(const q of ['endpoint=laps','endpoint=laps&session_key=0','endpoint=sessions&year=1999','endpoint=sessions&year=2026&nonce=1','endpoint=sessions&year=2026&year=2025','endpoint=laps&session_key=100&date>=2026-01-01'])assert.throws(()=>canonicalQuery(new URL('https://test.invalid/?'+q)));
});
test('OpenF1 enforces response shape, safe failures and bounded request timeout',async()=>{
 const {createHandler}=await import('../api/openf1.js');let signal;
 const cache={get:async(_,req,load)=>load()};
 const handler=createHandler({cache,fetcher:async(_,options)=>{signal=options.signal;return new Response('[{"session_key":1}]',{status:200})}});
 const r=await handler(new Request('https://test.invalid/api/openf1?endpoint=laps&session_key=100'));assert.equal(r.status,200);assert(signal instanceof AbortSignal);
 const failed=createHandler({cache,fetcher:async()=>{throw Error('private-credential-value')}});
 const bad=await failed(new Request('https://test.invalid/api/openf1?endpoint=laps&session_key=100'));assert.equal(bad.status,502);assert(!(await bad.text()).includes('private-credential-value'));
});

