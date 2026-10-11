const MAX_BYTES = 10 * 1024 * 1024;
export default async (request: Request) => {
  if (request.method !== "GET") return new Response("Method not allowed", {status:405, headers:{Allow:"GET"}});
  const params = new URL(request.url).searchParams;
  const file = params.get("file") || "";
  if (!/^\/system\/files\/decision-document\/[a-zA-Z0-9_.-]+\.pdf$/.test(file) || file.includes("..") || [...params.keys()].some(k => !["file","download"].includes(k))) return new Response("Invalid document", {status:400});
  try {
    const upstream = await fetch(`https://www.fia.com${file}`, {redirect:"error", signal:AbortSignal.timeout(15000)});
    if (!upstream.ok || !upstream.headers.get("content-type")?.includes("application/pdf")) throw new Error("Unavailable");
    if (Number(upstream.headers.get("content-length")) > MAX_BYTES) { await upstream.body?.cancel(); return new Response("PDF exceeds 10 MB. Open the FIA original.", {status:413}); }
    const reader = upstream.body!.getReader(); const chunks: Uint8Array[] = []; let length = 0;
    while (true) { const {done,value} = await reader.read(); if (done) break; length += value.byteLength; if (length > MAX_BYTES) { await reader.cancel(); return new Response("PDF exceeds 10 MB", {status:413}); } chunks.push(value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
    if (new TextDecoder().decode(bytes.slice(0,5)) !== "%PDF-") throw new Error("Invalid PDF");
    return new Response(bytes, {headers:{"Content-Type":"application/pdf", "Content-Disposition":`${params.get("download") === "1" ? "attachment" : "inline"}; filename="${file.split("/").pop()}"`, "X-Content-Type-Options":"nosniff", "Cache-Control":"public, max-age=300", "Netlify-CDN-Cache-Control":"public, s-maxage=300"}});
  } catch { return new Response("FIA PDF is temporarily unavailable. Please open the FIA original.", {status:502, headers:{"Cache-Control":"no-store"}}); }
};
export const config = {path:"/api/fia-pdf", rateLimit:{windowLimit:30, windowSize:60, aggregateBy:["ip","domain"], action:"rate_limit"}};
