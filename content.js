function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getAllCpages() {
  const pages = new Set([1]);
  document.querySelectorAll('a[href*="cpage="]').forEach(a => {
    const m = a.getAttribute('href').match(/cpage=(\d+)/);
    if (m) pages.add(parseInt(m[1]));
  });
  return Array.from(pages).sort((a, b) => a - b);
}

function buildCpageUrl(cpage) {
  const url = new URL(location.href);
  url.searchParams.set('cpage', cpage);
  url.hash = 'comment';
  return url.toString();
}

// CSRF 토큰 가져오기
function getCsrfToken() {
  return window._rx_csrf_token
    || document.querySelector('meta[name="csrf-token"]')?.content
    || document.querySelector('input[name="_rx_csrf_token"]')?.value
    || '';
}

// HTML에서 내 닉네임 댓글의 삭제 파라미터 추출
function extractDeleteParams(html, nickname) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const comments = doc.querySelectorAll('[id^="comment_"]');
  const params = [];
  comments.forEach(el => {
    const nicks = el.querySelectorAll('a, span');
    const isMe = Array.from(nicks).some(n => n.textContent.trim() === nickname);
    if (!isMe) return;
    const del = el.querySelector('a.deleteComment');
    if (!del) return;
    const href = del.getAttribute('href') || '';
    // href에서 파라미터 추출
    const urlObj = new URL(href, location.origin);
    params.push({
      document_srl: urlObj.searchParams.get('document_srl'),
      comment_srl: urlObj.searchParams.get('comment_srl'),
      mid: urlObj.searchParams.get('mid'),
      cpage: urlObj.searchParams.get('cpage') || '1'
    });
  });
  return params;
}

// procBoardDeleteComment로 POST 요청
async function deleteCommentProc(p, csrfToken) {
  const body = new URLSearchParams({
    act: 'procBoardDeleteComment',
    mid: p.mid || 'dogdrip',
    document_srl: p.document_srl,
    comment_srl: p.comment_srl,
    cpage: p.cpage,
    _rx_csrf_token: csrfToken
  });

  const r = await fetch('/index.php', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    redirect: 'follow'
  });

  const text = await r.text();
  // XE 성공 응답: JSON {"error":0} 또는 리다이렉트
  const isJson = text.trim().startsWith('{');
  if (isJson) {
    try {
      const json = JSON.parse(text);
      return json.error === 0 || json.result === 'success';
    } catch (e) {}
  }
  // 리다이렉트되거나 에러 없으면 성공으로 처리
  return r.redirected || r.ok;
}

async function processPage(cpageUrl, nickname, csrfToken) {
  const resp = await fetch(cpageUrl, { credentials: 'include' });
  if (!resp.ok) return 0;
  const html = await resp.text();
  const paramsList = extractDeleteParams(html, nickname);

  let deleted = 0;
  for (const p of paramsList) {
    try {
      const ok = await deleteCommentProc(p, csrfToken);
      if (ok) deleted++;
    } catch (e) {
      console.error('[개드립삭제] 오류:', e);
    }
    await delay(400);
  }
  return deleted;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'deleteMyComments') return;

  (async () => {
    const nickname = msg.nickname;
    const csrfToken = getCsrfToken();
    let totalDeleted = 0;

    const cpages = getAllCpages();
    for (const cpage of cpages) {
      const url = buildCpageUrl(cpage);
      const count = await processPage(url, nickname, csrfToken);
      totalDeleted += count;
      await delay(300);
    }

    if (totalDeleted > 0) setTimeout(() => location.reload(), 800);
    sendResponse({ count: totalDeleted });
  })();

  return true;
});
