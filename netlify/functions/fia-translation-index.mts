import {VERSION} from '../../server/fia-translation.mjs';
import {getStore} from '@netlify/blobs';
export default async (request:Request,context:any)=>{
 if(request.method!=='GET')return new Response(null,{status:405});
 try{
  const store=getStore({name:context.deploy.context==='production'?'fia-korean-production-v1':'fia-korean-preview-v1',consistency:'strong'});
  const {blobs}=await store.list({prefix:'documents/'});
  const rows=await Promise.all(blobs.slice(0,100).map(async b=>{const d:any=await store.get(b.key,{type:'json'});return d?.version===VERSION?{url:d.sourceUrl,titleKo:d.result.titleKo,category:d.result.category}:null;}));
  return Response.json({documents:rows.filter(Boolean)},{headers:{'Cache-Control':'public, max-age=30'}});
 }catch{return Response.json({documents:[]},{headers:{'Cache-Control':'no-store'}});}
};
export const config={path:'/api/fia-translation-index'};
