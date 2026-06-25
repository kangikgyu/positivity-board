const robotDb = firebase.firestore();
const polishTextFunction = firebase.functions().httpsCallable("polishText");
const DEFAULT_TONE_STYLE = "부드럽게";
const ROBOT_TONE_STYLES = ["부드럽게", "솔직하지만 예의 있게", "친구처럼", "짧고 담백하게"];

function normalizeToneStyle(style) {
  return ROBOT_TONE_STYLES.includes(style) ? style : DEFAULT_TONE_STYLE;
}

function getSelectedToneStyle(selectId) {
  const select = document.getElementById(selectId);
  return normalizeToneStyle(select ? select.value : DEFAULT_TONE_STYLE);
}

async function polishText(content, style = DEFAULT_TONE_STYLE) {
  const result = await polishTextFunction({
    content,
    style: normalizeToneStyle(style)
  });
  const data = result && result.data ? result.data : {};
  const polishedContent = data.polishedContent || "";

  if (!polishedContent || !polishedContent.trim()) {
    throw new Error("문장 다듬기 결과가 비어 있습니다.");
  }

  return {
    polishedContent: polishedContent.trim(),
    riskSummary: (data.riskSummary || "공격적으로 보일 수 있는 표현을 확인하고 더 부드러운 문장으로 다듬었어요.").trim()
  };
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
        <video class="robot-video" src="icons/robot.mp4?v=20260619-1" muted playsinline loop preload="auto" aria-hidden="true"></video>
      </div>
      <div class="robot-copy">
        <p class="eyebrow">kindness robot</p>
        <h2 id="robotTitle">로봇이 문장을 정돈하는 중</h2>
        <p id="robotStatus">잠시만 기다려 주세요. 문장을 조금 더 따뜻하고 배려 있게 다듬고 있어요.</p>
        <div class="robot-preview" id="robotPreview" hidden>
          <article class="robot-preview-card robot-original-card">
            <strong>원문</strong>
            <p id="robotOriginalText"></p>
          </article>
          <article class="robot-preview-card robot-risk" id="robotRisk" hidden>
            <strong>상대에게 이렇게 보일 수 있어요</strong>
            <p id="robotRiskText"></p>
          </article>
          <article class="robot-preview-card robot-suggestion-card">
            <label for="polishedContent">수정 제안</label>
            <textarea id="polishedContent" rows="7"></textarea>
          </article>
          <p class="robot-note">수정본을 확인한 뒤 게시하기 버튼을 누르면 저장됩니다.</p>
        </div>
        <div class="robot-actions" id="robotActions" hidden>
          <button type="button" class="secondary-btn" id="robotCancelBtn">다시 쓰기</button>
          <button type="button" id="robotConfirmBtn">게시하기</button>
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

function getRobotVideo() {
  return ensureRobotOverlay().querySelector(".robot-video");
}

function playRobotVideo() {
  const video = getRobotVideo();
  if (!video) return;

  video.currentTime = 0;
  video.play().catch((error) => {
    console.warn("로봇 영상 자동 재생 실패:", error);
  });
}

function stopRobotVideo() {
  const video = getRobotVideo();
  if (!video) return;

  video.pause();
  video.currentTime = 0;
}

function closeRobotOverlay() {
  const overlay = ensureRobotOverlay();
  overlay.hidden = true;
  overlay.dataset.state = "idle";
  stopRobotVideo();
}

function getDefaultAuthorName(user) {
  return user && user.displayName ? user.displayName : "익명";
}

function getAuthorNameFromInput(input, user) {
  const author = input ? input.value.trim() : "";
  return author || getDefaultAuthorName(user);
}

function buildRobotAuthorPayload(author, user) {
  if (typeof window.buildAuthorPayload === "function") {
    return window.buildAuthorPayload(author, user);
  }

  return {
    uid: user ? user.uid : null,
    author: author || getDefaultAuthorName(user),
    authorRole: "user"
  };
}

function getSelectedSticker(pickerId) {
  if (typeof window.getSelectedSticker === "function") {
    return window.getSelectedSticker(pickerId);
  }

  return null;
}

function resetStickerPicker(pickerId) {
  if (typeof window.resetStickerPicker === "function") {
    window.resetStickerPicker(pickerId);
  }
}

function savePolishedPost(title, content, user, author, sticker) {
  return robotDb.collection("posts").add({
    title,
    content,
    sticker,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...buildRobotAuthorPayload(author, user)
  });
}

function savePolishedComment(postId, content, user, author, sticker) {
  return robotDb.collection("posts").doc(postId).collection("comments").add({
    content,
    sticker,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: null,
    ...buildRobotAuthorPayload(author, user)
  });
}

function openRobotPolisher({ content, style = DEFAULT_TONE_STYLE, onConfirm, onSuccess, savingText = "올리는 중" }) {
  const overlay = ensureRobotOverlay();
  const status = document.getElementById("robotStatus");
  const preview = document.getElementById("robotPreview");
  const originalText = document.getElementById("robotOriginalText");
  const textarea = document.getElementById("polishedContent");
  const risk = document.getElementById("robotRisk");
  const riskText = document.getElementById("robotRiskText");
  const actions = document.getElementById("robotActions");
  const cancelBtn = document.getElementById("robotCancelBtn");
  const confirmBtn = document.getElementById("robotConfirmBtn");

  overlay.hidden = false;
  preview.hidden = true;
  actions.hidden = true;
  if (risk) risk.hidden = true;
  if (riskText) riskText.textContent = "";
  if (originalText) originalText.textContent = content;
  confirmBtn.disabled = false;
  confirmBtn.textContent = "게시하기";
  status.textContent = "잠시만 기다려 주세요. 문장을 조금 더 따뜻하고 배려 있게 다듬고 있어요. 검토가 끝나면 게시 버튼이 나타납니다.";
  setRobotState("thinking");
  playRobotVideo();

  polishText(content, style)
    .then(({ polishedContent, riskSummary }) => {
      setRobotState("ready");
      textarea.value = polishedContent;
      if (riskText) riskText.textContent = riskSummary;
      if (risk) risk.hidden = false;
      status.textContent = "원문이 어떻게 보일 수 있는지 확인하고, 아래 게시하기 버튼을 누르면 저장됩니다.";
      preview.hidden = false;
      actions.hidden = false;
    })
    .catch((error) => {
      console.error("문장 다듬기 실패:", error);
      setRobotState("ready");
      textarea.value = content;
      if (riskText) riskText.textContent = "AI가 문장을 분석하지 못했어요. 원문을 한 번 더 확인한 뒤 게시 여부를 선택해주세요.";
      if (risk) risk.hidden = false;
      status.textContent = "문장을 다듬지 못했어요. 그래도 아래 게시하기 버튼을 누르면 원문으로 저장할 수 있습니다.";
      preview.hidden = false;
      actions.hidden = false;
    });

  cancelBtn.onclick = closeRobotOverlay;
  confirmBtn.onclick = () => {
    const finalContent = textarea.value.trim();
    if (!finalContent) return alert("올릴 문장을 입력해주세요.");

    confirmBtn.disabled = true;
    confirmBtn.textContent = savingText;
    onConfirm(finalContent)
      .then(() => {
        closeRobotOverlay();
        if (typeof onSuccess === "function") onSuccess();
      })
      .catch((error) => {
        console.error("글 저장 실패:", error);
        const message = typeof window.getFriendlyError === "function"
          ? window.getFriendlyError(error)
          : "저장 중 문제가 발생했습니다. Firestore 권한을 확인해주세요.";
        alert(message);
      })
      .finally(() => {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "게시하기";
      });
  };
}

window.submitPost = function submitPostWithRobot() {
  const titleInput = document.getElementById("postTitleInput");
  const authorInput = document.getElementById("postAuthorInput");
  const contentInput = document.getElementById("postInput");
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const style = getSelectedToneStyle("toneStyleSelect");
  const sticker = getSelectedSticker("postStickerPicker");
  const user = firebase.auth().currentUser;
  const author = getAuthorNameFromInput(authorInput, user);

  if (!title) return alert("제목을 입력해주세요.");
  if (!content) return alert("내용을 입력해주세요.");

  openRobotPolisher({
    content,
    style,
    savingText: "글 올리는 중",
    onConfirm: (polishedContent) => savePolishedPost(title, polishedContent, user, author, sticker),
    onSuccess: () => {
      titleInput.value = "";
      if (authorInput) authorInput.value = user && user.displayName ? user.displayName : "";
      contentInput.value = "";
      resetStickerPicker("postStickerPicker");
      if (window.toggleWriteForm) window.toggleWriteForm(false);
    }
  });
};

window.submitComment = function submitCommentWithRobot(postId) {
  const user = firebase.auth().currentUser;
  const authorInput = document.getElementById(`commentAuthorInput-${postId}`);
  const input = document.getElementById(`commentInput-${postId}`);
  const content = input ? input.value.trim() : "";
  const style = getSelectedToneStyle(`commentToneStyleSelect-${postId}`);
  const sticker = getSelectedSticker(`commentStickerPicker-${postId}`);
  const author = getAuthorNameFromInput(authorInput, user);

  if (!content) return alert("댓글을 입력해주세요.");

  openRobotPolisher({
    content,
    style,
    savingText: "댓글 올리는 중",
    onConfirm: (polishedContent) => savePolishedComment(postId, polishedContent, user, author, sticker),
    onSuccess: () => {
      input.value = "";
      resetStickerPicker(`commentStickerPicker-${postId}`);
      if (authorInput) authorInput.value = user && user.displayName ? user.displayName : "";
    }
  });
};
