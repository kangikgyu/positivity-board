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
        <div class="word-stream" id="wordStream"></div>
        <div class="polished-scroll" id="polishedScroll" aria-hidden="true">따뜻한 말</div>
        <div class="stone-robot" aria-hidden="true">
          <div class="robot-part robot-antenna"></div>
          <div class="robot-part robot-head">
            <span class="robot-eye left-eye"></span>
            <span class="robot-eye right-eye"></span>
            <span class="robot-mouth"></span>
            <span class="moss head-moss"></span>
          </div>
          <div class="robot-part robot-neck"></div>
          <div class="robot-part shoulder left-shoulder"><span class="moss shoulder-moss"></span></div>
          <div class="robot-part shoulder right-shoulder"><span class="moss shoulder-moss"></span></div>
          <div class="robot-part arm upper-arm left-upper-arm"><span class="moss arm-moss"></span></div>
          <div class="robot-part arm lower-arm left-lower-arm"><span class="moss arm-moss long"></span></div>
          <div class="robot-part hand left-hand"></div>
          <div class="robot-part arm upper-arm right-upper-arm"><span class="moss arm-moss"></span></div>
          <div class="robot-part arm lower-arm right-lower-arm"><span class="moss arm-moss long"></span></div>
          <div class="robot-part hand right-hand"></div>
          <div class="robot-part robot-body">
            <span class="stone-crack crack-one"></span>
            <span class="stone-crack crack-two"></span>
            <span class="moss body-moss"></span>
            <div class="robot-chest">
              <div class="robot-door left-door"></div>
              <div class="robot-door right-door"></div>
              <div class="robot-glow"></div>
            </div>
          </div>
          <div class="robot-part robot-waist"></div>
          <div class="robot-part robot-hip"></div>
          <div class="robot-part leg left-thigh"><span class="moss leg-moss"></span></div>
          <div class="robot-part leg right-thigh"><span class="moss leg-moss"></span></div>
          <div class="robot-part leg left-shin"><span class="moss leg-moss long"></span></div>
          <div class="robot-part leg right-shin"><span class="moss leg-moss long"></span></div>
          <div class="robot-part foot left-foot"></div>
          <div class="robot-part foot right-foot"></div>
        </div>
      </div>
      <div class="robot-copy">
        <p class="eyebrow">kindness robot</p>
        <h2 id="robotTitle">로봇이 문장을 다듬는 중</h2>
        <p id="robotStatus">작성한 글자를 먹고, 더 부드러운 표현으로 정리하고 있어요.</p>
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

function buildWordStream(text) {
  const stream = document.getElementById("wordStream");
  stream.innerHTML = "";

  const words = text.split(/\s+/).filter(Boolean).slice(0, 18);
  words.forEach((word, index) => {
    const chip = document.createElement("span");
    chip.className = "word-chip";
    chip.textContent = word.length > 8 ? `${word.slice(0, 8)}...` : word;
    chip.style.setProperty("--delay", `${index * 0.06}s`);
    chip.style.setProperty("--x", `${(index % 6) * 22 - 54}px`);
    chip.style.setProperty("--y", `${Math.floor(index / 6) * 20 - 36}px`);
    stream.appendChild(chip);
  });
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
  status.textContent = "작성한 글자를 먹고, 더 부드러운 표현으로 정리하고 있어요.";
  buildWordStream(`${title} ${content}`);
  setRobotState("eating");

  window.setTimeout(() => {
    setRobotState("opening");
    const polished = softlyPolishText(content);
    textarea.value = polished;
    status.textContent = "가슴의 뚜껑을 열고 다듬어진 문장을 꺼냈어요. 확인 후 게시해 주세요.";
    preview.hidden = false;
    actions.hidden = false;
  }, 1900);

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
