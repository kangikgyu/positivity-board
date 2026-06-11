const robotDb = firebase.firestore();

function softlyPolishText(text) {
  let polished = text.trim();

  const replacements = [
    [/짜증나/gi, "속상한 마음이 들어"],
    [/싫어/gi, "조금 어렵게 느껴져"],
    [/왜 그래/gi, "어떤 마음인지 조금 더 듣고 싶어"],
    [/그냥/gi, "조심스럽게"],
    [/힘들어/gi, "요즘 마음이 조금 지쳐"],
    [/못해/gi, "아직은 어렵지만 함께 해볼 수 있어"]
  ];

  replacements.forEach(([pattern, replacement]) => {
    polished = polished.replace(pattern, replacement);
  });

  if (!/[.!?。！？]$/.test(polished)) {
    polished += ".";
  }

  return `조금 더 부드럽게 전해볼게요.\n\n${polished}\n\n읽는 사람의 마음도 함께 생각하며, 따뜻한 응원의 마음을 담아 전합니다.`;
}

function ensureRobotOverlay() {
  let overlay = document.getElementById("robotPolisher");
  if (overlay) return overlay;

  overlay = document.createElement("section");
  overlay.id = "robotPolisher";
  overlay.className = "robot-polisher";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="robot-card" role="dialog" aria-modal="true" aria-labelledby="robotTitle">
      <div class="robot-scene">
        <div class="robot-aura" aria-hidden="true"></div>
        <div class="stone-robot image-robot" aria-hidden="true"></div>
      </div>
      <div class="robot-copy">
        <p class="eyebrow">kindness robot</p>
        <h2 id="robotTitle">로봇이 문장을 정돈하는 중</h2>
        <p id="robotStatus">잠시만 기다려 주세요. 문장을 조금 더 따뜻하고 배려 있게 다듬고 있어요.</p>
        <div class="robot-preview" id="robotPreview" hidden>
          <label for="polishedContent">다듬어진 문장</label>
          <textarea id="polishedContent" rows="7"></textarea>
          <p class="robot-note">현재는 LLM 연결 전 임시 다듬기입니다. 서버 함수가 연결되면 이 자리에 실제 LLM 결과가 들어옵니다.</p>
        </div>
        <div class="robot-actions" id="robotActions" hidden>
          <button type="button" class="secondary-btn" id="robotCancelBtn">다시 쓰기</button>
          <button type="button" id="robotConfirmBtn">이 문장으로 올리기</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  return overlay;
}

function setRobotState(state) {
  const overlay = ensureRobotOverlay();
  overlay.dataset.state = state;
}

function closeRobotOverlay() {
  const overlay = ensureRobotOverlay();
  overlay.hidden = true;
  overlay.dataset.state = "idle";
}

function savePolishedPost(title, content, user) {
  return robotDb.collection("posts").add({
    title,
    content,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    uid: user.uid,
    author: user.displayName || "익명"
  });
}

window.submitPost = function submitPostWithRobot() {
  const titleInput = document.getElementById("postTitleInput");
  const contentInput = document.getElementById("postInput");
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const user = firebase.auth().currentUser;

  if (!user) return alert("로그인 후 글을 작성할 수 있습니다.");
  if (!title) return alert("제목을 입력해주세요.");
  if (!content) return alert("내용을 입력해주세요.");

  const overlay = ensureRobotOverlay();
  const status = document.getElementById("robotStatus");
  const preview = document.getElementById("robotPreview");
  const textarea = document.getElementById("polishedContent");
  const actions = document.getElementById("robotActions");
  const cancelBtn = document.getElementById("robotCancelBtn");
  const confirmBtn = document.getElementById("robotConfirmBtn");

  overlay.hidden = false;
  preview.hidden = true;
  actions.hidden = true;
  status.textContent = "잠시만 기다려 주세요. 문장을 조금 더 따뜻하고 배려 있게 다듬고 있어요.";
  setRobotState("thinking");

  window.setTimeout(() => {
    setRobotState("ready");
    textarea.value = softlyPolishText(content);
    status.textContent = "다듬어진 문장이 준비됐어요. 확인한 뒤 게시해 주세요.";
    preview.hidden = false;
    actions.hidden = false;
  }, 1500);

  cancelBtn.onclick = closeRobotOverlay;
  confirmBtn.onclick = () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "올리는 중";
    savePolishedPost(title, textarea.value.trim(), user)
      .then(() => {
        titleInput.value = "";
        contentInput.value = "";
        closeRobotOverlay();
        if (window.toggleWriteForm) window.toggleWriteForm(false);
      })
      .catch((error) => {
        console.error("글 저장 실패:", error);
        alert("글 저장 중 문제가 발생했습니다. Firestore 권한을 확인해주세요.");
      })
      .finally(() => {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "이 문장으로 올리기";
      });
  };
};
