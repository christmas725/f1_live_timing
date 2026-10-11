const list = document.querySelector('#documentList');
const status = document.querySelector('#documentStatus');
const filter = document.querySelector('#eventFilter');
const search = document.querySelector('#documentSearch');
const refresh = document.querySelector('#documentRefresh');
let documents = [], fetchedAt = '';
function render() {
  const query = search.value.trim().toLowerCase();
  const rows = documents.filter(d => (!filter.value || d.event === filter.value) && `${d.title} ${d.event}`.toLowerCase().includes(query));
  list.replaceChildren();
  for (const doc of rows) {
    const li = document.createElement('li'); li.className = 'card document-item';
    const a = document.createElement('a'); a.textContent = `${doc.title} ↗`; a.href = doc.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    const meta = document.createElement('p'); meta.className = 'document-meta'; meta.textContent = `${doc.event} · ${doc.published || '게시 시각 미표기'} · PDF`;
    li.append(a, meta); list.append(li);
  }
  status.textContent = `${rows.length}개 문서${rows.length ? '' : ' · 검색 조건에 맞는 문서가 없습니다.'} · 조회 ${new Date(fetchedAt).toLocaleString('ko-KR')}`;
}
async function load() {
  refresh.disabled = true; status.textContent = 'FIA 공식 문서를 불러오는 중…';
  try {
    const res = await fetch('/api/fia-documents', {signal: AbortSignal.timeout(20000)});
    if (!res.ok) throw new Error('upstream');
    const data = await res.json(); if (!Array.isArray(data.documents) || !data.documents.length) throw new Error('empty');
    documents = data.documents; fetchedAt = data.fetchedAt;
    const previous = filter.value; filter.replaceChildren(new Option('전체 대회', ''));
    for (const event of new Set(documents.map(d => d.event))) filter.add(new Option(event, event));
    if ([...filter.options].some(o => o.value === previous)) filter.value = previous;
    render();
  } catch {
    status.textContent = documents.length ? '새로고침에 실패했습니다. 마지막으로 불러온 목록을 유지합니다. 잠시 후 다시 시도하거나 FIA 원본 목록을 확인해 주세요.' : 'FIA 문서를 불러오지 못했습니다. 잠시 후 새로고침하거나 위의 FIA 원본 목록을 확인해 주세요.';
  } finally { refresh.disabled = false; }
}
filter.addEventListener('change', render); search.addEventListener('input', () => { if (fetchedAt) render(); }); refresh.addEventListener('click', load); load();
