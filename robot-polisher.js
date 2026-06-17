const robotDb = firebase.firestore();
const polishTextFunction = firebase.functions().httpsCallable("polishText");

async function polishText(content) {
  const result = await polishTextFunction({ content });
  const polishedContent = result && result.data ? result.data.polishedContent : "";

  if (!polishedContent || !polishedContent.trim()) {
    throw new Error("문장 다듬기 결과가 비어 있습니다.");
  }

  return polishedContent.trim();
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
          <p class="robot-note">OpenAI가 원문의 의미를 유지하며 더 따뜻한 표현으로 다듬어줍니다.</p>
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

  polishText(content)
    .then((polishedContent) => {
      setRobotState("ready");
      textarea.value = polishedContent;
      status.textContent = "다듬어진 문장이 준비됐어요. 확인한 뒤 게시해 주세요.";
      preview.hidden = false;
      actions.hidden = false;
    })
    .catch((error) => {
      console.error("문장 다듬기 실패:", error);
      setRobotState("ready");
      textarea.value = content;
      status.textContent = "문장을 다듬지 못했어요. 원문으로 게시하거나 다시 시도해 주세요.";
      preview.hidden = false;
      actions.hidden = false;
    });

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
