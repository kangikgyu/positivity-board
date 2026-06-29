const ADMIN_EMAILS = ["fhldid00@gmail.com"];

const firebaseConfig = {
  apiKey: "AIzaSyALuw2_DPTYAo0xWVygQmObST956DYCnm0",
  authDomain: "positivity-board-ig.firebaseapp.com",
  projectId: "positivity-board-ig",
  storageBucket: "positivity-board-ig.firebasestorage.app",
  messagingSenderId: "456213289485",
  appId: "1:456213289485:web:6da549c96b33cee7b15344",
  measurementId: "G-7KVLW9PFDK"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let unsubscribePosts = null;
let unsubscribeComments = [];
let currentUser = null;
let openPostId = null;
let latestPosts = [];
let adminDashboardLoaded = false;

const TONE_STYLES = ["부드럽게", "솔직하지만 예의 있게", "친구처럼", "짧고 담백하게"];
const EMOJI_OPTIONS = ["😊", "😢", "😡", "🤗", "🙌", "💪", "🌱", "❤️", "✨"];
const STICKER_OPTIONS = [
  { key: "hand", label: "토닥토닥", icon: "icons/hand.png?v=1" },
  { key: "hug", label: "안아주기", icon: "icons/hug.png?v=1" },
  { key: "angry", label: "같이 화내기", icon: "icons/angry.png?v=1" },
  { key: "sad", label: "같이 울기", icon: "icons/sad.png?v=1" }
];
const REACTION_TYPES = STICKER_OPTIONS;
const DAILY_TOPICS = [
  "오늘 누군가에게 하고 싶었지만 참았던 말은?",
  "요즘 나를 가장 지치게 하는 말은?",
  "조금 속상했지만 부드럽게 말하고 싶은 일은?",
  "누군가에게 고맙다고 말하고 싶은 순간은?",
  "오늘 내가 듣고 싶었던 따뜻한 말은?",
  "친구에게 서운했지만 차분히 말하고 싶은 일은?",
  "나를 힘들게 한 상황을 다르게 표현해 본다면?",
  "오늘 나에게 해주고 싶은 응원의 말은?",
  "요즘 마음속에 오래 남은 한마디는?",
  "사과하고 싶지만 아직 꺼내지 못한 말은?",
  "누군가에게 오해받았다고 느낀 순간은?",
  "내 마음을 조금 더 차분하게 설명한다면?",
  "오늘 가장 위로받고 싶었던 순간은?",
  "가족에게 조심스럽게 전하고 싶은 말은?",
  "친구에게 고마웠지만 표현하지 못한 일은?",
  "나를 서운하게 한 말을 다르게 받아본다면?",
  "오늘 내가 참고 넘긴 감정은?",
  "상대에게 부탁하고 싶은 작은 배려는?",
  "최근 나를 웃게 만든 말은?",
  "조금 화났지만 부드럽게 말하고 싶은 일은?",
  "누군가의 말 중 다시 생각해보고 싶은 부분은?",
  "내가 나에게 미안했던 순간은?",
  "오늘 마음이 무거웠던 이유는?",
  "상대에게 내 입장을 차분히 설명한다면?",
  "말하고 나서 후회했던 표현은?",
  "오늘 나를 지켜준 작은 습관은?",
  "누군가에게 응원받고 싶은 일은?",
  "내가 먼저 따뜻하게 건넬 수 있는 말은?",
  "지금 가장 내려놓고 싶은 생각은?",
  "혼자 삭였던 서운함을 말로 풀어본다면?",
  "내가 듣고 싶었던 사과는 어떤 말일까?",
  "상대에게 바라는 선을 부드럽게 말한다면?",
  "오늘 가장 고마웠던 사람은?",
  "내 마음을 오해 없이 전하려면 어떤 말이 좋을까?",
  "힘든 하루 끝에 나에게 해주고 싶은 말은?",
  "상대의 좋은 의도를 찾아본다면?",
  "요즘 자주 떠오르는 걱정은?",
  "오늘 내 감정을 한 문장으로 적는다면?",
  "조금 용기 내서 전하고 싶은 진심은?"
];

function isAdmin(user = currentUser) {
  return !!user && ADMIN_EMAILS.includes((user.email || "").trim().toLowerCase());
}

function isAdminAuthored(data) {
  return data && data.authorRole === "admin";
}

function getAuthorRole(user = currentUser) {
  return isAdmin(user) ? "admin" : "user";
}

function canManageDoc(data, user = currentUser) {
  return !!user && (data.uid === user.uid || isAdmin(user));
}

function getDefaultAuthorName(user = currentUser) {
  return user && user.displayName ? user.displayName : "익명";
}

function getAuthorNameFromInput(input, user = currentUser) {
  const author = input ? input.value.trim() : "";
  return author || getDefaultAuthorName(user);
}

function buildAuthorPayload(author, user = currentUser) {
  return {
    uid: user ? user.uid : null,
    author: author || getDefaultAuthorName(user),
    authorRole: getAuthorRole(user)
  };
}

function syncPostAuthorInput(user = currentUser) {
  const authorInput = document.getElementById("postAuthorInput");
  if (!authorInput || authorInput.value.trim()) return;

  authorInput.value = user && user.displayName ? user.displayName : "";
}

function formatDate(value) {
  if (!value) return "방금 전";

  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toDate(value) {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
}

function isToday(value) {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function getPostTitle(data) {
  if (data.title && data.title.trim()) return data.title.trim();

  const firstLine = (data.content || "제목 없는 글").split("\n")[0].trim();
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine;
}

function getFriendlyError(error, actionText = "처리") {
  if (error && error.code === "permission-denied") {
    return `Firestore 보안 규칙 때문에 ${actionText}이(가) 막혔습니다. 로컬 firestore.rules를 Firebase에 배포했는지 확인해주세요.`;
  }

  if (error && error.code === "unauthenticated") {
    return "로그인 상태를 확인하지 못했습니다. 다시 로그인한 뒤 시도해주세요.";
  }

  return error && error.message
    ? `${actionText} 중 문제가 발생했습니다. (${error.code || "error"}: ${error.message})`
    : `${actionText} 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.`;
}

function clearCommentListeners() {
  unsubscribeComments.forEach((unsubscribe) => unsubscribe());
  unsubscribeComments = [];
}

function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch((error) => {
    console.error("로그인 실패:", error);
    alert("로그인 중 문제가 발생했습니다.");
  });
}

function logout() {
  firebase.auth().signOut();
}

function toggleWriteForm(forceOpen) {
  const panel = document.getElementById("writePanel");
  const button = document.getElementById("toggleWriteBtn");
  if (!panel || !button) return;

  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
  panel.hidden = !shouldOpen;
  button.textContent = shouldOpen ? "마음 남기기 닫기" : "오늘 마음 남기기";

  if (shouldOpen) {
    document.getElementById("postTitleInput")?.focus();
  }
}

function createToneStyleField(selectId) {
  const label = document.createElement("label");
  label.className = "tone-style-field comment-tone-style-field";
  label.htmlFor = selectId;

  const text = document.createElement("span");
  text.textContent = "AI 말투 스타일";

  const select = document.createElement("select");
  select.id = selectId;
  select.className = "tone-style-select";

  TONE_STYLES.forEach((style) => {
    const option = document.createElement("option");
    option.value = style;
    option.textContent = style;
    select.appendChild(option);
  });

  label.appendChild(text);
  label.appendChild(select);
  return label;
}

function normalizeSticker(value) {
  return STICKER_OPTIONS.some((option) => option.key === value) ? value : null;
}

function getStickerOption(value) {
  return STICKER_OPTIONS.find((option) => option.key === value) || null;
}

function insertTextAtCursor(textarea, text) {
  if (!textarea) return;

  const start = typeof textarea.selectionStart === "number" ? textarea.selectionStart : textarea.value.length;
  const end = typeof textarea.selectionEnd === "number" ? textarea.selectionEnd : textarea.value.length;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  const nextPosition = start + text.length;
  textarea.focus();
  textarea.setSelectionRange(nextPosition, nextPosition);
}

function createEmojiPicker(targetTextareaId) {
  const picker = document.createElement("div");
  picker.className = "emoji-picker";
  picker.setAttribute("aria-label", "이모지 추가");

  const label = document.createElement("span");
  label.className = "picker-label";
  label.textContent = "이모지 추가";
  picker.appendChild(label);

  EMOJI_OPTIONS.forEach((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "emoji-btn";
    button.textContent = emoji;
    button.setAttribute("aria-label", `${emoji} 추가`);
    button.onclick = () => insertTextAtCursor(document.getElementById(targetTextareaId), emoji);
    picker.appendChild(button);
  });

  return picker;
}

function createStickerPicker(targetType, selectedSticker = null) {
  const picker = document.createElement("div");
  picker.className = "sticker-picker";
  picker.dataset.targetType = targetType;
  picker.dataset.selectedSticker = normalizeSticker(selectedSticker) || "";

  const label = document.createElement("span");
  label.className = "picker-label";
  label.textContent = "감정 스티커";
  picker.appendChild(label);

  STICKER_OPTIONS.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sticker-choice";
    button.dataset.sticker = option.key;
    button.setAttribute("aria-label", option.label);
    button.title = option.label;
    button.innerHTML = `<img src="${option.icon}" alt="" loading="lazy" onerror="this.hidden=true">`;
    picker.appendChild(button);
  });

  const syncSelected = () => {
    picker.querySelectorAll(".sticker-choice").forEach((button) => {
      button.classList.toggle("is-selected", button.dataset.sticker === picker.dataset.selectedSticker);
    });
  };

  picker.onclick = (event) => {
    const button = event.target.closest(".sticker-choice");
    if (!button || !picker.contains(button)) return;
    picker.dataset.selectedSticker = picker.dataset.selectedSticker === button.dataset.sticker
      ? ""
      : button.dataset.sticker;
    syncSelected();
  };

  syncSelected();
  return picker;
}

function getSelectedSticker(pickerId) {
  const picker = document.getElementById(pickerId);
  return normalizeSticker(picker ? picker.dataset.selectedSticker : null);
}

function resetStickerPicker(pickerId) {
  const picker = document.getElementById(pickerId);
  if (!picker) return;
  picker.dataset.selectedSticker = "";
  picker.querySelectorAll(".sticker-choice").forEach((button) => {
    button.classList.remove("is-selected");
  });
}

function createStickerImage(sticker, className = "sticker-image") {
  const option = getStickerOption(sticker);
  if (!option) return null;

  const image = document.createElement("img");
  image.className = className;
  image.src = option.icon;
  image.alt = option.label;
  image.loading = "lazy";
  image.onerror = () => {
    image.hidden = true;
  };
  return image;
}

function initPostPickers() {
  const emojiMount = document.getElementById("postEmojiPicker");
  if (emojiMount) {
    const picker = createEmojiPicker("postInput");
    picker.id = "postEmojiPicker";
    emojiMount.replaceWith(picker);
  }

  const stickerMount = document.getElementById("postStickerPicker");
  if (stickerMount) {
    const picker = createStickerPicker("post");
    picker.id = "postStickerPicker";
    stickerMount.replaceWith(picker);
  }
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDailyTopic(date = new Date()) {
  const dateKey = getLocalDateKey(date);
  const seed = Number(dateKey.replace(/-/g, ""));
  return DAILY_TOPICS[seed % DAILY_TOPICS.length];
}

function getDailyTopicIndex(date = new Date()) {
  const dateKey = getLocalDateKey(date);
  const seed = Number(dateKey.replace(/-/g, ""));
  return seed % DAILY_TOPICS.length;
}

function initDailyTopicCard() {
  const card = document.getElementById("dailyTopicCard");
  const topicText = document.getElementById("dailyTopicText");
  const useBtn = document.getElementById("useDailyTopicBtn");
  const shuffleBtn = document.getElementById("shuffleDailyTopicBtn");
  if (!card || !topicText || !useBtn) return;

  let topicIndex = getDailyTopicIndex();
  const setTopic = () => {
    topicText.textContent = DAILY_TOPICS[topicIndex];
  };

  setTopic();

  if (shuffleBtn) {
    shuffleBtn.onclick = () => {
      topicIndex = (topicIndex + 1) % DAILY_TOPICS.length;
      setTopic();
    };
  }

  useBtn.onclick = () => {
    const topic = DAILY_TOPICS[topicIndex] || getDailyTopic();
    const titleInput = document.getElementById("postTitleInput");
    const contentInput = document.getElementById("postInput");

    toggleWriteForm(true);
    if (titleInput && !titleInput.value.trim()) titleInput.value = topic;
    if (contentInput) {
      contentInput.placeholder = `오늘의 주제: ${topic}\n\n떠오르는 말을 편하게 적어주세요. 골렘이 말투를 다듬어줄게요.`;
      contentInput.focus();
    }
  };
}

function resetAdminDashboardValues() {
  ["totalPostCount", "totalCommentCount", "todayPostCount", "todayCommentCount", "adminPostCount"]
    .forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.textContent = "-";
    });
}

function setAdminDashboardStatus(message) {
  const status = document.getElementById("adminDashboardStatus");
  if (status) status.textContent = message;
}

function setAdminDashboardVisibility(user = currentUser) {
  const dashboard = document.getElementById("adminDashboard");
  if (!dashboard) return;

  const shouldShow = isAdmin(user);
  dashboard.hidden = !shouldShow;

  if (!shouldShow) {
    adminDashboardLoaded = false;
    resetAdminDashboardValues();
    setAdminDashboardStatus("관리자 로그인 시 한 번 계산됩니다.");
  }
}

async function refreshAdminDashboard() {
  if (!isAdmin()) return;

  const refreshBtn = document.getElementById("refreshAdminDashboardBtn");
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "계산 중";
  }
  setAdminDashboardStatus("게시글과 댓글 수를 계산하는 중입니다...");

  try {
    const [postSnapshot, commentSnapshot] = await Promise.all([
      db.collection("posts").get(),
      db.collectionGroup("comments").get()
    ]);

    const stats = {
      totalPosts: postSnapshot.size,
      totalComments: commentSnapshot.size,
      todayPosts: 0,
      todayComments: 0,
      adminPosts: 0
    };

    postSnapshot.forEach((doc) => {
      const data = doc.data();
      if (isToday(data.createdAt)) stats.todayPosts += 1;
      if (isAdminAuthored(data)) stats.adminPosts += 1;
    });

    commentSnapshot.forEach((doc) => {
      if (isToday(doc.data().createdAt)) stats.todayComments += 1;
    });

    const statMap = {
      totalPostCount: stats.totalPosts,
      totalCommentCount: stats.totalComments,
      todayPostCount: stats.todayPosts,
      todayCommentCount: stats.todayComments,
      adminPostCount: stats.adminPosts
    };

    Object.entries(statMap).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    });

    adminDashboardLoaded = true;
    setAdminDashboardStatus(`마지막 계산: ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`);
  } catch (error) {
    console.error("관리자 대시보드 계산 실패:", error);
    setAdminDashboardStatus(getFriendlyError(error, "대시보드 계산"));
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "새로고침";
    }
  }
}

function initAdminDashboard() {
  const refreshBtn = document.getElementById("refreshAdminDashboardBtn");
  if (refreshBtn) refreshBtn.onclick = refreshAdminDashboard;
  setAdminDashboardVisibility(currentUser);
}

function getReactionStorageKey(targetType, postId, commentId, reactionType) {
  return commentId
    ? `positivityReaction:${targetType}:${postId}:${commentId}:${reactionType}`
    : `positivityReaction:${targetType}:${postId}:${reactionType}`;
}

function hasReacted(targetType, postId, commentId, reactionType) {
  return localStorage.getItem(getReactionStorageKey(targetType, postId, commentId, reactionType)) === "1";
}

function markReacted(targetType, postId, commentId, reactionType) {
  localStorage.setItem(getReactionStorageKey(targetType, postId, commentId, reactionType), "1");
}

function getReactionRef(targetType, postId, commentId) {
  return targetType === "comment"
    ? db.collection("posts").doc(postId).collection("comments").doc(commentId)
    : db.collection("posts").doc(postId);
}

async function addReaction(targetType, postId, commentId, reactionType) {
  const reaction = getStickerOption(reactionType);
  if (!reaction) return false;
  if (hasReacted(targetType, postId, commentId, reaction.key)) return false;

  const ref = getReactionRef(targetType, postId, commentId);

  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("이미 삭제된 글입니다.");

      const reactions = snapshot.data().reactions || {};
      const nextCount = Number(reactions[reaction.key] || 0) + 1;
      transaction.update(ref, {
        [`reactions.${reaction.key}`]: nextCount
      });
    });

    markReacted(targetType, postId, commentId, reaction.key);
    return true;
  } catch (error) {
    console.error("반응 저장 실패:", error);
    alert(getFriendlyError(error));
    return false;
  }
}

function createReactionBar(targetType, postId, data, commentId = null) {
  const bar = document.createElement("div");
  bar.className = "reaction-bar";

  const reactions = data.reactions || {};
  REACTION_TYPES.forEach((reaction) => {
    const button = document.createElement("button");
    const count = Number(reactions[reaction.key] || 0);
    const alreadyReacted = hasReacted(targetType, postId, commentId, reaction.key);
    button.type = "button";
    button.className = alreadyReacted ? "reaction-btn is-reacted" : "reaction-btn";
    button.disabled = alreadyReacted;
    button.innerHTML = `
      <img src="${reaction.icon}" alt="" loading="lazy" onerror="this.hidden=true">
      <span class="reaction-label">${reaction.label}</span>
      <span class="reaction-count">${count}</span>
    `;
    button.setAttribute("aria-label", `${reaction.label} ${count}`);
    button.onclick = async () => {
      button.disabled = true;
      const saved = await addReaction(targetType, postId, commentId, reaction.key);
      if (!saved && !hasReacted(targetType, postId, commentId, reaction.key)) {
        button.disabled = false;
      }
    };
    bar.appendChild(button);
  });

  return bar;
}

function submitPost() {
  const titleInput = document.getElementById("postTitleInput");
  const authorInput = document.getElementById("postAuthorInput");
  const contentInput = document.getElementById("postInput");
  const submitBtn = document.getElementById("submitBtn");
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const sticker = getSelectedSticker("postStickerPicker");
  const user = firebase.auth().currentUser;
  const author = getAuthorNameFromInput(authorInput, user);

  if (!title) return alert("제목을 입력해주세요.");
  if (!content) return alert("내용을 입력해주세요.");

  db.collection("posts").add({
    title,
    content,
    sticker,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    ...buildAuthorPayload(author, user)
  }).then(() => {
    titleInput.value = "";
    if (authorInput) authorInput.value = user && user.displayName ? user.displayName : "";
    contentInput.value = "";
    resetStickerPicker("postStickerPicker");
    toggleWriteForm(false);
  }).catch((error) => {
    console.error("글 저장 실패:", error);
    alert(getFriendlyError(error));
  }).finally(() => {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "글 올리기";
    }
  });

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "올리는 중";
  }
}

function submitComment(postId) {
  const user = firebase.auth().currentUser;
  const authorInput = document.getElementById(`commentAuthorInput-${postId}`);
  const input = document.getElementById(`commentInput-${postId}`);
  const content = input ? input.value.trim() : "";
  const author = getAuthorNameFromInput(authorInput, user);

  if (!content) return alert("댓글을 입력해주세요.");

  db.collection("posts").doc(postId).collection("comments").add({
    content,
    sticker: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: null,
    ...buildAuthorPayload(author, user)
  }).then(() => {
    input.value = "";
    if (authorInput) authorInput.value = user && user.displayName ? user.displayName : "";
  }).catch((error) => {
    console.error("댓글 저장 실패:", error);
    alert(getFriendlyError(error));
  });
}

function updateComment(postId, commentId, content) {
  const user = firebase.auth().currentUser;
  if (!user) return alert("로그인 후 댓글을 수정할 수 있습니다.");
  if (!content.trim()) return alert("댓글 내용을 입력해주세요.");

  const commentRef = db.collection("posts").doc(postId).collection("comments").doc(commentId);

  commentRef.update({
    content: content.trim(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    editedBy: user.email || user.uid
  }).catch((error) => {
    console.error("댓글 수정 실패:", error);
    alert(getFriendlyError(error));
  });
}

function deleteComment(postId, commentId) {
  if (!confirm("댓글을 삭제하시겠어요?")) return;

  db.collection("posts").doc(postId).collection("comments").doc(commentId).delete()
    .catch((error) => {
      console.error("댓글 삭제 실패:", error);
      alert(getFriendlyError(error));
    });
}

function updatePost(postId, title, content) {
  const user = firebase.auth().currentUser;
  if (!user) return alert("로그인 후 글을 수정할 수 있습니다.");
  if (!title.trim()) return alert("제목을 입력해주세요.");
  if (!content.trim()) return alert("내용을 입력해주세요.");

  const postRef = db.collection("posts").doc(postId);

  return postRef.get()
    .then((doc) => {
      if (!doc.exists) throw new Error("이미 삭제된 글입니다.");

      const data = doc.data();
      if (!canManageDoc(data, user)) {
        alert("작성자 또는 관리자만 글을 수정할 수 있습니다.");
        return null;
      }

      return postRef.update({
        title: title.trim(),
        content: content.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        editedBy: user.email || user.uid
      });
    })
    .catch((error) => {
      console.error("글 수정 실패:", error);
      alert(getFriendlyError(error));
    });
}

function deletePost(postId) {
  const user = firebase.auth().currentUser;
  if (!user) return alert("로그인 후 글을 삭제할 수 있습니다.");
  if (!confirm("정말로 삭제하시겠어요?")) return;

  const postRef = db.collection("posts").doc(postId);

  postRef.get()
    .then((doc) => {
      if (!doc.exists) throw new Error("이미 삭제된 글입니다.");

      const data = doc.data();
      if (!canManageDoc(data, user)) {
        alert("작성자 또는 관리자만 글을 삭제할 수 있습니다.");
        return null;
      }

      return postRef.delete();
    })
    .catch((error) => {
      console.error("글 삭제 실패:", error);
      alert(getFriendlyError(error));
    });
}

function togglePostDetail(postId) {
  openPostId = openPostId === postId ? null : postId;
  renderBoard(currentUser);
}

function renderPostEditForm(postId, data, detail) {
  detail.innerHTML = "";

  const form = document.createElement("div");
  form.className = "post-edit-form";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.maxLength = 80;
  titleInput.value = data.title || "";

  const textarea = document.createElement("textarea");
  textarea.value = data.content || "";
  textarea.rows = 5;

  const actions = document.createElement("div");
  actions.className = "comment-edit-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "취소";
  cancelBtn.className = "cancel-edit-btn";
  cancelBtn.onclick = () => renderBoard(currentUser);

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "저장";
  saveBtn.onclick = () => updatePost(postId, titleInput.value, textarea.value)
    .then(() => renderBoard(currentUser));

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  form.appendChild(titleInput);
  form.appendChild(textarea);
  form.appendChild(actions);
  detail.appendChild(form);
}

function renderCommentEditForm(postId, commentId, comment, item) {
  item.innerHTML = "";

  const form = document.createElement("div");
  form.className = "comment-edit-form";

  const textarea = document.createElement("textarea");
  textarea.value = comment.content || "";
  textarea.rows = 3;

  const actions = document.createElement("div");
  actions.className = "comment-edit-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "취소";
  cancelBtn.className = "cancel-edit-btn";
  cancelBtn.onclick = () => renderBoard(currentUser);

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "저장";
  saveBtn.onclick = () => updateComment(postId, commentId, textarea.value);

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  form.appendChild(textarea);
  form.appendChild(actions);
  item.appendChild(form);
  textarea.focus();
}

function renderComments(postId, commentsBox, user) {
  const unsubscribe = db.collection("posts").doc(postId).collection("comments")
    .orderBy("createdAt", "asc")
    .onSnapshot((snapshot) => {
      commentsBox.innerHTML = "";

      if (snapshot.empty) {
        const empty = document.createElement("p");
        empty.className = "empty-comments";
        empty.textContent = "아직 댓글이 없습니다.";
        commentsBox.appendChild(empty);
        return;
      }

      snapshot.forEach((commentDoc) => {
        const comment = commentDoc.data();
        const item = document.createElement("div");
        item.className = "comment-item";

        const meta = document.createElement("div");
        meta.className = "comment-meta";

        const author = createAuthorLabel(comment);
        const dateText = document.createElement("span");
        dateText.textContent = ` · ${formatDate(comment.createdAt)}${comment.updatedAt ? " · 수정됨" : ""}`;
        meta.appendChild(author);
        meta.appendChild(dateText);

        const content = document.createElement("p");
        content.className = "comment-content";
        content.textContent = comment.content;

        item.appendChild(meta);
        const commentSticker = createStickerImage(comment.sticker, "content-sticker comment-sticker");
        if (commentSticker) item.appendChild(commentSticker);
        item.appendChild(content);
        item.appendChild(createReactionBar("comment", postId, comment, commentDoc.id));

        if (canManageDoc(comment, user)) {
          const editBtn = document.createElement("button");
          editBtn.textContent = "수정";
          editBtn.classList.add("text-btn");
          editBtn.onclick = () => renderCommentEditForm(postId, commentDoc.id, comment, item);
          item.appendChild(editBtn);

          const delBtn = document.createElement("button");
          delBtn.textContent = "삭제";
          delBtn.classList.add("text-btn", "danger-text");
          delBtn.onclick = () => deleteComment(postId, commentDoc.id);
          item.appendChild(delBtn);
        }

        commentsBox.appendChild(item);
      });
    }, (error) => {
      console.error("댓글 불러오기 실패:", error);
      commentsBox.innerHTML = `<p class="error-text">${getFriendlyError(error)}</p>`;
    });

  unsubscribeComments.push(unsubscribe);
}

function renderPostRow(post, index, tableBody) {
  const { id: postId, data } = post;
  const row = document.createElement("tr");
  row.className = openPostId === postId ? "post-row is-open" : "post-row";

  const numberCell = document.createElement("td");
  numberCell.className = "col-number";
  numberCell.textContent = latestPosts.length - index;

  const titleCell = document.createElement("td");
  titleCell.className = "col-title";

  const titleButton = document.createElement("button");
  titleButton.className = "board-title-btn";
  const titleSticker = createStickerImage(data.sticker, "title-sticker");
  if (titleSticker) titleButton.appendChild(titleSticker);
  const titleText = document.createElement("span");
  titleText.textContent = getPostTitle(data);
  titleButton.appendChild(titleText);
  titleButton.onclick = () => togglePostDetail(postId);
  titleCell.appendChild(titleButton);

  const authorCell = document.createElement("td");
  authorCell.className = "col-author";
  authorCell.appendChild(createAuthorLabel(data));

  const dateCell = document.createElement("td");
  dateCell.className = "col-date";
  dateCell.textContent = formatDate(data.createdAt);

  row.appendChild(numberCell);
  row.appendChild(titleCell);
  row.appendChild(authorCell);
  row.appendChild(dateCell);
  tableBody.appendChild(row);

  if (openPostId === postId) {
    const detailRow = document.createElement("tr");
    detailRow.className = "detail-row";

    const detailCell = document.createElement("td");
    detailCell.colSpan = 4;

    const detail = document.createElement("div");
    detail.className = "post-detail";

    const postSticker = createStickerImage(data.sticker, "content-sticker post-sticker");
    if (postSticker) detail.appendChild(postSticker);

    const content = document.createElement("p");
    content.className = "post-content";
    content.textContent = data.content || "내용이 없습니다.";
    detail.appendChild(content);
    detail.appendChild(createReactionBar("post", postId, data));

    if (canManageDoc(data, currentUser)) {
      const editBtn = document.createElement("button");
      editBtn.textContent = "글 수정";
      editBtn.classList.add("text-btn");
      editBtn.onclick = () => renderPostEditForm(postId, data, detail);
      detail.appendChild(editBtn);

      const delBtn = document.createElement("button");
      delBtn.textContent = "글 삭제";
      delBtn.classList.add("text-btn", "danger-text", "post-action-btn");
      delBtn.onclick = () => deletePost(postId);
      detail.appendChild(delBtn);
    }

    const commentsSection = document.createElement("section");
    commentsSection.className = "comments-section";

    const commentsTitle = document.createElement("h3");
    commentsTitle.textContent = "댓글";

    const commentsBox = document.createElement("div");
    commentsBox.className = "comments-list";

    const form = document.createElement("div");
    form.className = "comment-form";

    const authorInput = document.createElement("input");
    authorInput.id = `commentAuthorInput-${postId}`;
    authorInput.className = "comment-author-input";
    authorInput.type = "text";
    authorInput.maxLength = 40;
    authorInput.placeholder = "작성자 (비워두면 익명)";
    authorInput.value = currentUser && currentUser.displayName ? currentUser.displayName : "";

    const input = document.createElement("textarea");
    input.id = `commentInput-${postId}`;
    input.rows = 2;
    input.placeholder = "거친 말도 괜찮아요. 골렘이 따뜻하게 다듬어줄게요.";

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "댓글 쓰기";
    submitBtn.onclick = () => window.submitComment(postId);

    form.appendChild(authorInput);
    form.appendChild(createToneStyleField(`commentToneStyleSelect-${postId}`));
    form.appendChild(input);
    form.appendChild(submitBtn);

    commentsSection.appendChild(commentsTitle);
    commentsSection.appendChild(commentsBox);
    commentsSection.appendChild(form);
    detail.appendChild(commentsSection);
    detailCell.appendChild(detail);
    detailRow.appendChild(detailCell);
    tableBody.appendChild(detailRow);

    renderComments(postId, commentsBox, currentUser);
  }
}

function renderBoard(user) {
  const postList = document.getElementById("postList");
  if (!postList) return;

  clearCommentListeners();

  if (latestPosts.length === 0) {
    postList.innerHTML = "<p class='empty-posts'>아직 게시글이 없습니다. 첫 번째 긍정 메시지를 남겨보세요.</p>";
    return;
  }

  const table = document.createElement("table");
  table.className = "board-table";

  table.innerHTML = `
    <thead>
      <tr>
        <th class="col-number">번호</th>
        <th class="col-title">제목</th>
        <th class="col-author">작성자</th>
        <th class="col-date">작성일</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement("tbody");
  latestPosts.forEach((post, index) => renderPostRow(post, index, tbody));
  table.appendChild(tbody);

  postList.innerHTML = "";
  postList.appendChild(table);
}

function startPostListener(user) {
  const postList = document.getElementById("postList");
  if (!postList) return;

  if (unsubscribePosts) unsubscribePosts();
  clearCommentListeners();

  unsubscribePosts = db.collection("posts")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      latestPosts = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
      renderBoard(user);
    }, (error) => {
      console.error("글 목록 불러오기 실패:", error);
      postList.innerHTML = `<p class="error-text">${getFriendlyError(error)}</p>`;
    });
}

firebase.auth().onAuthStateChanged((user) => {
  currentUser = user;

  const userInfo = document.getElementById("userInfo");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (userInfo) {
    if (user) {
      userInfo.innerHTML = `
        <img src="${user.photoURL || 'https://via.placeholder.com/36'}" alt="프로필" />
        <span>${user.displayName || '사용자'}님${isAdmin(user) ? '<b class="admin-badge">관리자</b>' : ''}</span>
      `;
    } else {
      userInfo.innerHTML = "로그인 없이도 작성 가능";
    }
  }

  if (loginBtn) loginBtn.style.display = user ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = user ? "inline-block" : "none";
  document.body.classList.toggle("is-admin-user", isAdmin(user));
  setAdminDashboardVisibility(user);

  syncPostAuthorInput(user);
  startPostListener(user);

  if (isAdmin(user) && !adminDashboardLoaded) {
    refreshAdminDashboard();
  }
});

window.login = login;
window.logout = logout;
window.submitPost = submitPost;
window.submitComment = submitComment;
window.toggleWriteForm = toggleWriteForm;
window.isAdmin = isAdmin;
window.buildAuthorPayload = buildAuthorPayload;
window.getFriendlyError = getFriendlyError;
window.getSelectedSticker = getSelectedSticker;
window.resetStickerPicker = resetStickerPicker;

initDailyTopicCard();
initAdminDashboard();
initPostPickers();

function createAuthorLabel(data) {
  const label = document.createElement("span");
  label.className = isAdminAuthored(data) ? "author-label admin-author" : "author-label";
  if (isAdminAuthored(data)) {
    label.title = "관리자가 작성한 글입니다";
    label.setAttribute("aria-label", `${data.author || "익명"} 관리자`);
  }

  const name = document.createElement("span");
  name.className = "author-name";
  name.textContent = data.author || "익명";
  label.appendChild(name);

  if (isAdminAuthored(data)) {
    const badge = document.createElement("span");
    badge.className = "admin-author-badge";
    badge.textContent = "관리자";
    label.appendChild(badge);
  }

  return label;
}
