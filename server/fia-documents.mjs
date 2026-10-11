export const SOURCE = 'https://www.fia.com/documents/championships/fia-formula-one-world-championship/110191';
function text(value = '') {
  return value.replace(/<[^>]*>/g, ' ').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => { const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1),16) : Number(n); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''; }).replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g, e => ({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '})[e]).replace(/\s+/g, ' ').trim();
}
export function parseDocuments(html) {
  const documents = [], seen = new Set();
  let event = 'F1';
  const tokens = /<div\b[^>]*class="event-title[^">]*"[^>]*>([\s\S]*?)<\/div>|<li\b[^>]*class="document-row[ "][^>]*>([\s\S]*?)<\/li>/g;
  for (const match of html.matchAll(tokens)) {
    if (match[1] !== undefined) { event = text(match[1]); continue; }
    const row = match[2];
    const href = row.match(/href="([^"]+)"/)?.[1];
    const title = text(row.match(/class="title"[^>]*>([\s\S]*?)<\/div>/)?.[1]);
    if (!href || !title) continue;
    let url; try { url = new URL(text(href), SOURCE); } catch { continue; }
    if (url.origin !== 'https://www.fia.com' || !url.pathname.startsWith('/system/files/') || !url.pathname.endsWith('.pdf') || seen.has(url.href)) continue;
    seen.add(url.href);
    const published = text(row.match(/class="published"[^>]*>([\s\S]*?)<\/div>/)?.[1]).replace(/^Published on /, '');
    documents.push({event, title, published, url:url.href});
  }
  return documents;
}
