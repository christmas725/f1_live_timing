export function extractPdfText(data) {
 return data.Pages.map((page,index)=>{
  const lines=[];
  for(const item of [...page.Texts].sort((a,b)=>a.y-b.y||a.x-b.x)){
   let line=lines.at(-1);if(!line || Math.abs(line.y-item.y)>0.08){line={y:item.y,items:[]};lines.push(line);}line.items.push(item);
  }
  return `[Page ${index+1}]\n`+lines.map(line=>line.items.sort((a,b)=>a.x-b.x).map(item=>item.R.map(run=>decodeURIComponent(run.T)).join('')).join(' ').replace(/\s+/g,' ').trim()).join('\n');
 }).join('\n\n');
}
