const params = new URLSearchParams(location.search);
const file = params.get('file') || '';
const status = document.querySelector('#pdfStatus');
const title = params.get('title') || 'FIA 공식 문서';
document.querySelector('#pdfTitle').textContent = title;
document.title = `${title} | FIA 문서`;
if (!/^\/system\/files\/decision-document\/[a-zA-Z0-9_.%-]+\.pdf$/.test(file) || file.includes('..') || file.includes('%')) {
  status.textContent = '올바른 문서 주소가 아닙니다. 문서 목록에서 다시 선택해 주세요.';
  document.querySelector('#downloadPdf').hidden = true; document.querySelector('#originalPdf').hidden = true;
} else {
  const endpoint = `/api/fia-pdf?file=${encodeURIComponent(file)}`;
  document.querySelector('#originalPdf').href = `https://www.fia.com${file}`;
  document.querySelector('#downloadPdf').href = `${endpoint}&download=1`;
  document.querySelector('#downloadPdf').setAttribute('download', file.split('/').pop());
  async function loadPdf() {
   if(document.querySelector("#pdfViewer").src) return;
   try {
    const response = await fetch(endpoint, {signal:AbortSignal.timeout(25000)});
    if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) throw new Error('PDF unavailable');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const viewer = document.querySelector('#pdfViewer'); viewer.src = url; viewer.hidden = false;
    status.textContent = '원문 PDF · 번역은 위의 구글 문서 번역 버튼을 이용하세요.';
    window.addEventListener('pagehide', () => URL.revokeObjectURL(url), {once:true});
  } catch { status.textContent = 'PDF를 불러오지 못했습니다. FIA 원문 열기 또는 PDF 다운로드를 이용해 주세요.'; }
  }
  document.querySelector('#originalTab').addEventListener('click',loadPdf);
}

const koreanPanel=document.querySelector('#koreanPanel'), originalPanel=document.querySelector('#originalPanel');
const koreanTab=document.querySelector('#koreanTab'), originalTab=document.querySelector('#originalTab');
function showTab(korean){koreanPanel.hidden=!korean;originalPanel.hidden=korean;koreanTab.setAttribute('aria-pressed',String(korean));originalTab.setAttribute('aria-pressed',String(!korean));}
koreanTab.addEventListener('click',()=>showTab(true));originalTab.addEventListener('click',()=>showTab(false));
const translationStatus=document.querySelector('#translationStatus'), content=document.querySelector('#translationContent'), generate=document.querySelector('#generateTranslation');
function element(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function draw(data){
 if(data.state!=='ready'){translationStatus.textContent=data.message||'한국어 해설을 확인하고 있습니다…';generate.hidden=!data.canGenerate && data.state==='setup_required';return;}
 const r=data.result;content.replaceChildren();document.querySelector('#pdfTitle').textContent=r.titleKo;
 content.append(element('span',r.category,'doc-category'),element('p',r.summary,'korean-summary'));
 const facts=element('dl','','document-facts');for(const fact of r.metadata){facts.append(element('dt',fact.label),element('dd',fact.value));}content.append(facts);
 for(const section of r.sections){const article=element('section','','translation-section');article.append(element('h2',section.heading),element('p',section.body));const details=element('details','');details.append(element('summary','근거 원문 보기'),element('blockquote',section.sourceQuote));article.append(details);content.append(article);}
 for(const table of r.tables){const wrap=element('div','','table-wrap');const t=element('table','');t.append(element('caption',table.caption));const head=element('thead',''),tr=element('tr','');for(const h of table.columns)tr.append(element('th',h));head.append(tr);t.append(head);const body=element('tbody','');for(const row of table.rows){const tr=element('tr','');for(const cell of row)tr.append(element('td',cell));body.append(tr);}t.append(body);wrap.append(t);content.append(wrap);}
 for(const warning of r.warnings)content.append(element('p',warning,'translation-warning'));
 translationStatus.textContent=`자동 번역·정리 · 생성 ${new Date(data.createdAt).toLocaleString('ko-KR')} · 원문 대조 권장`;
 generate.hidden=!data.needsRefresh;generate.textContent='원문 변경 확인 및 해설 갱신';
}
async function readTranslation(){try{const r=await fetch('/api/fia-translation?file='+encodeURIComponent(file));const data=await r.json();generate.hidden=!data.canGenerate;draw(data);}catch{translationStatus.textContent='한국어 해설을 불러오지 못했습니다. 원문 PDF를 확인해 주세요.';}}
generate.addEventListener('click',async()=>{
 generate.disabled=true;
 try{const r=await fetch('/api/fia-translate?file='+encodeURIComponent(file),{method:'POST',signal:AbortSignal.timeout(60000)});
 if(!r.headers.get('content-type')?.includes('ndjson')){if(r.headers.get('content-type')?.includes('json'))draw(await r.json());else translationStatus.textContent='잠시 후 다시 시도해 주세요. 새 해설 생성은 사이트 전체에서 시간당 6회까지 가능합니다.';return;}
 const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='',finished=false;for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let idx;while((idx=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,idx);buffer=buffer.slice(idx+1);if(line){const update=JSON.parse(line);if(update.state!=='processing')finished=true;draw(update);}}}
 if(!finished)throw new Error('incomplete_stream');
 }catch{translationStatus.textContent='해설 생성 연결이 끊겼습니다. 잠시 후 페이지를 다시 열어 저장 여부를 확인해 주세요.';}finally{generate.disabled=false;}
});
if(/^\/system\/files\/decision-document\/[a-zA-Z0-9_.-]+\.pdf$/.test(file) && !file.includes('..'))readTranslation();else translationStatus.textContent='문서 목록에서 문서를 다시 선택해 주세요.';
