import cacheModule from '../server/proxy-cache.cjs';
const {createCache,boundedJson}=cacheModule;
const SESSION_ENDPOINTS=new Set(['drivers','position','intervals','laps','stints','pit','race_control','weather','starting_grid','session_result','championship_drivers','championship_teams']);
const SESSION_NAMES=new Set(['Race','Sprint','Practice 1','Practice 2','Practice 3','Qualifying','Sprint Qualifying','Sprint Shootout']);
export function canonicalQuery(url){
 const params=url.searchParams;
 if(params.toString().length>256)throw Object.assign(new Error('invalid_query'),{status:400});
 const endpoint=params.get('endpoint');
 const allowed=(endpoint==='sessions'||endpoint==='meetings')?new Set(['endpoint','year',...(endpoint==='sessions'?['session_name']:[])]):new Set(['endpoint','session_key','driver_number']);
 if(!['sessions','meetings'].includes(endpoint)&&!SESSION_ENDPOINTS.has(endpoint))throw Object.assign(new Error('invalid_endpoint'),{status:400});
 for(const [key] of params)if(!allowed.has(key)||params.getAll(key).length!==1)throw Object.assign(new Error('invalid_query'),{status:400});
 const out=new URLSearchParams();
 if(endpoint==='sessions'||endpoint==='meetings'){
  const year=params.get('year');
  if(!/^20[0-9]{2}$/.test(year||'')||Number(year)<2023||Number(year)>new Date().getUTCFullYear())throw Object.assign(new Error('invalid_year'),{status:400});
  out.set('year',year);
  if(params.has('session_name')){const name=params.get('session_name');if(!SESSION_NAMES.has(name))throw Object.assign(new Error('invalid_session_name'),{status:400});out.set('session_name',name)}
 }else{
  const session=params.get('session_key');
  if(!/^[1-9][0-9]{0,5}$/.test(session||''))throw Object.assign(new Error('session_required'),{status:400});
  out.set('session_key',session);
  if(params.has('driver_number')){const driver=params.get('driver_number');if(!/^[1-9][0-9]?$/.test(driver||''))throw Object.assign(new Error('invalid_driver_number'),{status:400});out.set('driver_number',driver)}
 }
 out.sort();
 return {endpoint,query:out.toString(),key:endpoint+'?'+out.toString()};
}
export function createHandler({fetcher=fetch,cache=createCache('openf1')}={}){
 return async function GET(request){
  const headers={'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
  if(request.method!=='GET')return Response.json({error:'method_not_allowed'},{status:405,headers:{...headers,Allow:'GET','Cache-Control':'no-store'}});
  try{
   const clean=canonicalQuery(new URL(request.url));
   const payload=await cache.get(clean.key,request,async()=>{
    const upstream=await fetcher('https://api.openf1.org/v1/'+clean.endpoint+'?'+clean.query,{headers:{Accept:'application/json','User-Agent':'F1-Live-Timing-v0.2-Magic-Number'},signal:AbortSignal.timeout(10000)});
    if(!upstream.ok)throw Object.assign(new Error(upstream.status===401||upstream.status===403?'OpenF1 live session restricted to authenticated users':'openf1_upstream_unavailable'),{status:upstream.status===401||upstream.status===403?403:502});
    const body=await boundedJson(upstream,8*1024*1024);
    if(!Array.isArray(body))throw Object.assign(new Error('openf1_invalid_response'),{status:502});
    return body;
   });
   return Response.json(payload,{status:200,headers:{...headers,'Cache-Control':'public, s-maxage=60, stale-while-revalidate=300'}});
  }catch(error){
   const status=error.status||502;
   const known=new Set(['invalid_query','invalid_endpoint','invalid_year','invalid_session_name','session_required','invalid_driver_number','proxy_busy','proxy_budget_exceeded','proxy_refresh_pending','proxy_storage_unavailable','proxy_response_too_large','openf1_upstream_unavailable','openf1_invalid_response','OpenF1 live session restricted to authenticated users']);
   return Response.json({error:known.has(error.message)?error.message:'openf1_upstream_unavailable'},{status,headers:{...headers,'Cache-Control':'no-store',...(status===429||status===503?{'Retry-After':'30'}:{})}});
  }
 };
}
export const GET=createHandler();
