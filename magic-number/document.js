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
