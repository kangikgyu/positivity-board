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
        <video class="robot-video" src="icons/robot.mp4?v=20260619-1" muted playsinline loop preload="auto" aria-hidden="true"></video>
      </div>
      <div class="robot-copy">
        <p class="eyebrow">kindness robot</p>
        <h2 id="robotTitle">로봇이 문장을 정돈하는 중</h2>
        <p id="robotStatus">잠시만 기다려 주세요. 문장을 조금 더 따뜻하고 배려 있게 다듬고 있어요.</p>
        <div class="robot-preview" id="robotPreview" hidden>
          <label for="polishedContent">다듬어진 문장</label>
          <textarea id="polishedContent" rows="7"></textarea>
          <p class="robot-note">OpenAI가 원문의 의미를 유지하며 공감과 위로가 느껴지도록 다듬어줍니다.</p>
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

function savePolishedPost(title, content, user) {
  return robotDb.collection("posts").add({
    title,
    content,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    uid: user.uid,
    author: user.displayName || "익명"
  });
}

function savePolishedComment(postId, content, user) {
  return robotDb.collection("posts").doc(postId).collection("comments").add({
    content,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: null,
    uid: user.uid,
    author: user.displayName || "익명"
  });
}

function openRobotPolisher({ content, onConfirm, onSuccess, savingText = "올리는 중" }) {
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
  confirmBtn.disabled = false;
  confirmBtn.textContent = "이 문장으로 올리기";
  status.textContent = "잠시만 기다려 주세요. 문장을 조금 더 따뜻하고 배려 있게 다듬고 있어요.";
  setRobotState("thinking");
  playRobotVideo();

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
        alert("저장 중 문제가 발생했습니다. Firestore 권한을 확인해주세요.");
      })
      .finally(() => {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "이 문장으로 올리기";
      });
  };
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

  openRobotPolisher({
    content,
    savingText: "글 올리는 중",
    onConfirm: (polishedContent) => savePolishedPost(title, polishedContent, user),
    onSuccess: () => {
      titleInput.value = "";
      contentInput.value = "";
      if (window.toggleWriteForm) window.toggleWriteForm(false);
    }
  });
};

window.submitComment = function submitCommentWithRobot(postId) {
  const user = firebase.auth().currentUser;
  const input = document.getElementById(`commentInput-${postId}`);
  const content = input ? input.value.trim() : "";

  if (!user) return alert("로그인 후 댓글을 작성할 수 있습니다.");
  if (!content) return alert("댓글을 입력해주세요.");

  openRobotPolisher({
    content,
    savingText: "댓글 올리는 중",
    onConfirm: (polishedContent) => savePolishedComment(postId, polishedContent, user),
    onSuccess: () => {
      input.value = "";
    }
  });
};
