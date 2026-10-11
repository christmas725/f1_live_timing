import { parseDocuments, SOURCE } from "../../server/fia-documents.mjs";
let cached: {documents: unknown[]; fetchedAt: string} | null = null;
let expires = 0;
let pending: Promise<typeof cached> | null = null;
let retryAfter = 0;
export default async (request: Request) => {
  const headers = {"Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff"};
  if (request.method !== "GET") return new Response(null, {status:405, headers:{Allow:"GET"}});
  if (new URL(request.url).search) return new Response(JSON.stringify({error:"Query parameters are not supported"}), {status:400, headers});
  try {
    if (!cached || Date.now() >= expires) {
      if (Date.now() < retryAfter) throw new Error("Retry later");
      pending ||= (async () => {
        const response = await fetch(SOURCE, {signal:AbortSignal.timeout(12000), redirect:"error"});
        if (!response.ok) throw new Error("FIA unavailable");
        const html = await response.text();
        if (html.length > 3000000) throw new Error("Oversized response");
        const documents = parseDocuments(html);
        if (!documents.length) throw new Error("No documents found");
        cached = {documents, fetchedAt:new Date().toISOString()}; expires = Date.now()+300000; return cached;
      })().catch(error => { retryAfter = Date.now()+30000; throw error; }).finally(() => { pending = null; });
      await pending;
    }
    return new Response(JSON.stringify(cached), {headers:{...headers,"Cache-Control":"public, max-age=60", "Netlify-CDN-Cache-Control":"public, s-maxage=300"}});
  } catch {
    return new Response(JSON.stringify({error:"FIA documents are temporarily unavailable", source:SOURCE}), {status:502, headers:{...headers,"Cache-Control":"no-store"}});
  }
};
export const config = {path:"/api/fia-documents", rateLimit:{windowLimit:30, windowSize:60, aggregateBy:["ip","domain"], action:"rate_limit"}};
