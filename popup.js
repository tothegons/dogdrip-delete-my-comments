const nicknameInput = document.getElementById('nickname');
const deleteBtn = document.getElementById('deleteBtn');
const status = document.getElementById('status');

// 저장된 닉네임 불러오기
chrome.storage.local.get('nickname', (data) => {
  if (data.nickname) nicknameInput.value = data.nickname;
});

// 닉네임 입력 시 자동 저장
nicknameInput.addEventListener('input', () => {
  chrome.storage.local.set({ nickname: nicknameInput.value.trim() });
});

deleteBtn.addEventListener('click', async () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    status.textContent = '닉네임을 입력해주세요.';
    return;
  }

  status.textContent = '삭제 중...';
  deleteBtn.disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { action: 'deleteMyComments', nickname }, (response) => {
    deleteBtn.disabled = false;
    if (chrome.runtime.lastError) {
      status.textContent = '오류: 페이지를 새로고침 후 다시 시도해주세요.';
      return;
    }
    if (response && response.count !== undefined) {
      status.textContent = response.count > 0
        ? `${response.count}개 댓글 삭제 완료!`
        : '삭제할 내 댓글이 없습니다.';
    }
  });
});
