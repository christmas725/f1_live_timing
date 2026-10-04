'use strict';
const {createHash,createHmac,randomUUID}=require('node:crypto');
const DATABASE='https://ksskewvaxfudijbferhc.supabase.co';
const PUBLISHABLE='sb_publishable_up5AOzsWaF3HycVCaACQjw_3pfm_A10';
function clientHash(req,secret){
 const headers=req?.headers;let ip='unknown';
 if(headers?.get)ip=headers.get('x-vercel-forwarded-for')||'unknown';
 else ip=String(headers?.['x-vercel-forwarded-for']||'unknown');
 return createHmac('sha256',secret).update(ip.split(',')[0].trim()).digest('hex');
}
async function rpc(name,params,secret,fetcher=fetch){
 const response=await fetcher(DATABASE+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:PUBLISHABLE,'Content-Type':'application/json','x-proxy-resource-secret':secret},
  body:JSON.stringify(params),signal:AbortSignal.timeout(4000)
 });
 if(!response.ok)throw Object.assign(new Error('proxy_storage_unavailable'),{status:503});
 if(response.status===204)return null;
 return response.json();
}
function createCache(scope,{secret=process.env.PROXY_RESOURCE_SECRET,fetcher=fetch,callRpc=rpc,maxConcurrent=12}={}){
 const pending=new Map();
 return {
  async get(key,request,load){
   if(!secret||!/^[0-9a-f]{64}$/.test(secret))throw Object.assign(new Error('proxy_storage_unavailable'),{status:503});
   const cacheKey=createHash('sha256').update(key).digest('hex');
   if(pending.has(cacheKey))return pending.get(cacheKey);
   if(pending.size>=maxConcurrent)throw Object.assign(new Error('proxy_busy'),{status:429});
   const promise=(async()=>{
    const lease=randomUUID();let claimed=false,prepared;
    try{
     prepared=await callRpc('proxy_resource_prepare',{p_scope:scope,p_key:cacheKey,p_client_key:clientHash(request,secret),p_lease_id:lease},secret,fetcher);
     if(prepared?.state==='cached')return prepared.payload;
     if(prepared?.state!=='claimed')throw Object.assign(new Error(prepared?.state==='limited'?'proxy_budget_exceeded':'proxy_refresh_pending'),{status:prepared?.state==='limited'?429:503});
     claimed=true;
     const payload=await load();
     await callRpc('proxy_resource_finish',{p_scope:scope,p_key:cacheKey,p_lease_id:lease,p_payload:payload,p_success:true},secret,fetcher);
     claimed=false;
     return payload;
    }catch(error){
     if(claimed){
      try{await callRpc('proxy_resource_finish',{p_scope:scope,p_key:cacheKey,p_lease_id:lease,p_payload:null,p_success:false},secret,fetcher)}catch{}
      if(prepared?.stale_payload)return prepared.stale_payload;
     }
     throw error;
    }
   })();
   pending.set(cacheKey,promise);
   try{return await promise}finally{pending.delete(cacheKey)}
  }
 };
}
async function boundedJson(response,maxBytes){
 if(!response.body)throw Object.assign(new Error('proxy_invalid_response'),{status:502});
 if(Number(response.headers.get('content-length')||0)>maxBytes)throw Object.assign(new Error('proxy_response_too_large'),{status:502});
 const reader=response.body.getReader();const chunks=[];let bytes=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
   if(bytes>maxBytes)throw Object.assign(new Error('proxy_response_too_large'),{status:502});
   chunks.push(Buffer.from(value));}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }finally{await reader.cancel().catch(()=>{})}
}
module.exports={createCache,boundedJson,clientHash};

