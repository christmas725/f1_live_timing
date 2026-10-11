import OpenAI from 'openai';
import { extractPdfText } from '../../server/fia-pdf-text.mjs';
import { getStore } from '@netlify/blobs';
import pdfHandler from './fia-pdf.mts';
import listHandler from './fia-documents.mts';
import { hash, validFile, VERSION, schema, instructions, validateResult } from '../../server/fia-translation.mjs';
const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json = (value:unknown, status=200) => Response.json(value,{status,headers});
const env = (key:string) => Netlify.env.get(key);
function storeFor(context:any) { return getStore({name:context.deploy.context === 'production' ? 'fia-korean-production-v1' : 'fia-korean-preview-v1', consistency:'strong'}); }
export default async (request:Request, context:any) => {
 if ((new URL(request.url).pathname === '/api/fia-translation' && request.method !== 'GET') || !['GET','POST'].includes(request.method)) return new Response(null,{status:405,headers:{Allow:'GET, POST'}});
 const file = new URL(request.url).searchParams.get('file') || '';
 if (!validFile(file)) return json({state:'error',message:'올바른 문서 주소가 아닙니다.'},400);
 if (request.method === 'POST' && request.headers.get('origin') !== new URL(request.url).origin) return json({state:'error',message:'사이트에서 다시 요청해 주세요.'},403);
 let store:any, cached:any; const key = hash(file);
 try { store=storeFor(context); cached=await store.get('documents/'+key,{type:'json'});if(cached?.version!==VERSION)cached=null; }
 catch { return json({state:'unavailable',message:'번역 저장소에 연결하지 못했습니다. 원문 PDF를 이용해 주세요.'},503); }
 const configured = Boolean(env('OPENAI_API_KEY'));
 if (request.method === 'GET') return json(cached ? {state:'ready',...cached,canGenerate:configured,needsRefresh:Date.now()-cached.checkedAt>900000} : {state:configured?'not_started':'setup_required',canGenerate:configured,message:configured?'아직 한국어 해설이 없습니다. 생성하면 다음 조회부터 저장된 결과를 보여드립니다.':'자동 번역 서비스 연결을 준비하고 있습니다. 지금은 원문 PDF와 구글 문서 번역을 이용해 주세요.'});
 if (!configured) return json({state:'setup_required',message:'자동 번역 서비스 연결을 준비하고 있습니다.'},503);
 if (cached && Date.now()-cached.checkedAt<900000) return json({state:'ready',...cached});
 // One lease per document/time window prevents repeated generation across instances.
 const lease='attempts/'+key+'/'+Math.floor(Date.now()/300000);
 const claim=await store.setJSON(lease,{createdAt:Date.now()},{onlyIfNew:true});
 if (!claim.modified) return json({state:'busy',message:'이 문서를 처리 중이거나 최근 처리에 실패했습니다. 잠시 후 다시 확인해 주세요.'},429);
 const encoder=new TextEncoder();
 return new Response(new ReadableStream({async start(controller){
  const emit=(data:any)=>controller.enqueue(encoder.encode(JSON.stringify(data)+'\n'));
  emit({state:'processing',message:'공식 PDF를 확인하고 있습니다…'});
  try {
   const listResponse=await listHandler(new Request(new URL('/api/fia-documents',request.url)));
   if(!listResponse.ok) throw new Error('source_unavailable');
   const list=await listResponse.json(); const doc=list.documents.find((d:any)=>new URL(d.url).pathname===file);
   if(!doc) {emit({state:'error',message:'현재 FIA 공식 목록에서 확인할 수 없는 문서입니다. 원문을 확인해 주세요.'});return;}
   const pdf=await pdfHandler(new Request(new URL('/api/fia-pdf?file='+encodeURIComponent(file),request.url)));
   if(!pdf.ok) throw new Error('source_unavailable');
   const bytes=new Uint8Array(await pdf.arrayBuffer()); const contentHash=hash(bytes);
   if(cached?.contentHash===contentHash && cached.version===VERSION){cached.checkedAt=Date.now();await store.setJSON('documents/'+key,cached);emit({state:'ready',...cached});return;}
   emit({state:'processing',message:'PDF 본문을 추출하고 있습니다…'});
   const { default: PDFParser } = await import('pdf2json');
   const extracted:any = await new Promise((resolve,reject)=>{
    const parser=new PDFParser(null,1);const timer=setTimeout(()=>{parser.destroy();reject(new Error('parse_timeout'));},8000);
    parser.on('pdfParser_dataError',()=>{clearTimeout(timer);parser.destroy();reject(new Error('parse_failed'));});
    parser.on('pdfParser_dataReady',(data:any)=>{clearTimeout(timer);const text=extractPdfText(data);parser.destroy();resolve({text,total:data.Pages.length});});
    parser.parseBuffer(Buffer.from(bytes));
   });
   const source=extracted.text;
   if(source.trim().length<80){emit({state:'error',message:'텍스트를 추출하기 어려운 PDF입니다. 스캔·이미지 문서는 원문을 확인해 주세요.'});return;}
   if(source.length>35000 || extracted.total>15){emit({state:'error',message:'현재 자동 해설 범위(15페이지·35,000자)를 넘는 문서입니다. 원문 또는 구글 문서 번역을 이용해 주세요.'});return;}
   emit({state:'processing',message:'한국어 해설을 작성하고 있습니다…'});
   const client=new OpenAI({maxRetries:0,timeout:25000});
   const model=env('FIA_TRANSLATION_MODEL')||'gpt-4.1-mini';
   const response=await client.responses.create({model,store:false,instructions,input:'아래 문서를 한국어로 번역하고 항목별로 정리해 주세요. sections.body와 metadata.label도 반드시 한국어로 작성하세요. sourceQuote만 영어 원문 그대로 쓰세요.\nDocument title: '+doc.title+'\nPDF source:\n'+source,max_output_tokens:10000,text:{format:{type:'json_schema',name:'fia_korean_document',strict:true,schema}}});
   if(response.status!=='completed') throw new Error('incomplete_translation');
   const result=validateResult(JSON.parse(response.output_text),source);
   const saved={result,contentHash,version:VERSION,sourceUrl:doc.url,sourceTitle:doc.title,createdAt:new Date().toISOString(),checkedAt:Date.now(),model};
   await store.setJSON('documents/'+key,saved);
   emit({state:'ready',...saved});
  }catch(error:any){
   console.error('FIA translation failed',error?.status||'',error?.code||error?.name||'unknown');
   const message=error?.status===401||error?.status===403?'번역 서비스 인증 설정이 필요합니다. 원문 PDF를 이용해 주세요.':error?.status===429?'번역 서비스 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.':'한국어 해설을 완성하지 못했습니다. 원문 PDF를 확인하고 잠시 후 다시 시도해 주세요.';
   emit({state:'error',message});
  }finally{controller.close();}
 }}),{headers:{...headers,'Content-Type':'application/x-ndjson; charset=utf-8'}});
};
export const config={path:'/api/fia-translation',rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['domain'],action:'rate_limit'}};
