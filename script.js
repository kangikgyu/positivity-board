const ADMIN_EMAILS = ["theboy96@naver.com"];

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

function isAdmin(user = currentUser) {
  return !!user && ADMIN_EMAILS.includes((user.email || "").toLowerCase());
}

function canManageDoc(data, user = currentUser) {
  return !!user && (data.uid === user.uid || isAdmin(user));
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

function getPostTitle(data) {
  if (data.title && data.title.trim()) return data.title.trim();

  const firstLine = (data.content || "제목 없는 글").split("\n")[0].trim();
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}...` : firstLine;
}

function getFriendlyError(error) {
  if (error && error.code === "permission-denied") {
    return "Firestore 보안 규칙 때문에 막혔습니다. Firebase Console에서 관리자 이메일과 작성/수정/삭제 권한을 확인해주세요.";
  }

  return "처리 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
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
  button.textContent = shouldOpen ? "글쓰기 닫기" : "글쓰기";

  if (shouldOpen) {
    document.getElementById("postTitleInput")?.focus();
  }
}

function submitPost() {
  const titleInput = document.getElementById("postTitleInput");
  const contentInput = document.getElementById("postInput");
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const user = firebase.auth().currentUser;

  if (!user) return alert("로그인 후 글을 작성할 수 있습니다.");
  if (!title) return alert("제목을 입력해주세요.");
  if (!content) return alert("내용을 입력해주세요.");

  db.collection("posts").add({
    title,
    content,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    uid: user.uid,
    author: user.displayName || "익명"
  }).then(() => {
    titleInput.value = "";
    contentInput.value = "";
    toggleWriteForm(false);
  }).catch((error) => {
    console.error("글 저장 실패:", error);
    alert(getFriendlyError(error));
  });
}

function submitComment(postId) {
  const user = firebase.auth().currentUser;
  const input = document.getElementById(`commentInput-${postId}`);
  const content = input ? input.value.trim() : "";

  if (!user) return alert("로그인 후 댓글을 작성할 수 있습니다.");
  if (!content) return alert("댓글을 입력해주세요.");

  db.collection("posts").doc(postId).collection("comments").add({
    content,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: null,
    uid: user.uid,
    author: user.displayName || "익명"
  }).then(() => {
    input.value = "";
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
        meta.textContent = `${comment.author || "익명"} · ${formatDate(comment.createdAt)}${comment.updatedAt ? " · 수정됨" : ""}`;

        const content = document.createElement("p");
        content.className = "comment-content";
        content.textContent = comment.content;

        item.appendChild(meta);
        item.appendChild(content);

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
  titleButton.textContent = getPostTitle(data);
  titleButton.onclick = () => togglePostDetail(postId);
  titleCell.appendChild(titleButton);

  const authorCell = document.createElement("td");
  authorCell.className = "col-author";
  authorCell.textContent = data.author || "익명";

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

    const content = document.createElement("p");
    content.className = "post-content";
    content.textContent = data.content || "내용이 없습니다.";
    detail.appendChild(content);

    if (canManageDoc(data, currentUser)) {
      const delBtn = document.createElement("button");
      delBtn.textContent = "글 삭제";
      delBtn.classList.add("delete-btn");
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

    const input = document.createElement("textarea");
    input.id = `commentInput-${postId}`;
    input.rows = 2;
    input.placeholder = currentUser ? "따뜻한 댓글을 남겨주세요." : "로그인 후 댓글을 남길 수 있습니다.";
    input.disabled = !currentUser;

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "댓글 쓰기";
    submitBtn.disabled = !currentUser;
    submitBtn.onclick = () => submitComment(postId);

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
    .limit(15)
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
      userInfo.innerHTML = "로그인이 필요합니다.";
    }
  }

  if (loginBtn) loginBtn.style.display = user ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = user ? "inline-block" : "none";

  startPostListener(user);
});

window.login = login;
window.logout = logout;
window.submitPost = submitPost;
window.submitComment = submitComment;
window.toggleWriteForm = toggleWriteForm;
