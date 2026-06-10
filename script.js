// Firebase setting
const firebaseConfig = {
  apiKey: "AIzaSyALuw2_DPTYAo0xWVygQmObST956DYCnm0",
  authDomain: "positivity-board-ig.firebaseapp.com",
  projectId: "positivity-board-ig",
  storageBucket: "positivity-board-ig.firebasestorage.app",
  messagingSenderId: "456213289485",
  appId: "1:456213289485:web:6da549c96b33cee7b15344",
  measurementId: "G-7KVLW9PFDK"
};

// Firebase init
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let unsubscribePosts = null;
let unsubscribeComments = [];

function formatDate(value) {
  if (!value) return "방금 전";

  const date = value.toDate ? value.toDate() : new Date(value);
  return date.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function clearCommentListeners() {
  unsubscribeComments.forEach((unsubscribe) => unsubscribe());
  unsubscribeComments = [];
}

// Login
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider);
}

// Logout
function logout() {
  firebase.auth().signOut();
}

// Create post
function submitPost() {
  const input = document.getElementById("postInput");
  const content = input.value.trim();
  const user = firebase.auth().currentUser;

  if (!content) return alert("글을 입력해주세요!");
  if (!user) return alert("로그인 후 글을 작성할 수 있습니다.");

  db.collection("posts").add({
    content,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    uid: user.uid,
    author: user.displayName || "익명"
  }).then(() => {
    input.value = "";
  }).catch((error) => {
    console.error("글 저장 실패:", error);
    alert("글 저장 중 문제가 발생했습니다.");
  });
}

function submitComment(postId) {
  const user = firebase.auth().currentUser;
  const input = document.getElementById(`commentInput-${postId}`);
  const content = input ? input.value.trim() : "";

  if (!user) return alert("로그인 후 댓글을 작성할 수 있습니다.");
  if (!content) return alert("댓글을 입력해주세요!");

  db.collection("posts").doc(postId).collection("comments").add({
    content,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    uid: user.uid,
    author: user.displayName || "익명"
  }).then(() => {
    input.value = "";
  }).catch((error) => {
    console.error("댓글 저장 실패:", error);
    alert("댓글 저장 중 문제가 발생했습니다.");
  });
}

function deleteComment(postId, commentId) {
  const confirmDelete = confirm("댓글을 삭제하시겠어요?");
  if (!confirmDelete) return;

  db.collection("posts").doc(postId).collection("comments").doc(commentId).delete()
    .catch((error) => {
      console.error("댓글 삭제 실패:", error);
      alert("댓글 삭제 중 문제가 발생했습니다.");
    });
}

function deletePost(postId) {
  const confirmDelete = confirm("정말로 삭제하시겠어요?");
  if (!confirmDelete) return;

  const postRef = db.collection("posts").doc(postId);

  postRef.collection("comments").get()
    .then((snapshot) => {
      const batch = db.batch();
      snapshot.forEach((commentDoc) => batch.delete(commentDoc.ref));
      batch.delete(postRef);
      return batch.commit();
    })
    .catch((error) => {
      console.error("글 삭제 실패:", error);
      alert("글 삭제 중 문제가 발생했습니다.");
    });
}

function renderComments(postId, commentsBox, user) {
  const unsubscribe = db.collection("posts").doc(postId).collection("comments")
    .orderBy("createdAt", "asc")
    .onSnapshot((snapshot) => {
      commentsBox.innerHTML = "";

      if (snapshot.empty) {
        const empty = document.createElement("p");
        empty.className = "empty-comments";
        empty.textContent = "아직 댓글이 없습니다. 따뜻한 한마디를 남겨보세요.";
        commentsBox.appendChild(empty);
        return;
      }

      snapshot.forEach((commentDoc) => {
        const comment = commentDoc.data();
        const item = document.createElement("div");
        item.className = "comment-item";

        const meta = document.createElement("div");
        meta.className = "comment-meta";
        meta.textContent = `${comment.author || "익명"} · ${formatDate(comment.createdAt)}`;

        const content = document.createElement("p");
        content.className = "comment-content";
        content.textContent = comment.content;

        item.appendChild(meta);
        item.appendChild(content);

        if (user && user.uid === comment.uid) {
          const delBtn = document.createElement("button");
          delBtn.textContent = "댓글 삭제";
          delBtn.classList.add("comment-delete-btn");
          delBtn.onclick = () => deleteComment(postId, commentDoc.id);
          item.appendChild(delBtn);
        }

        commentsBox.appendChild(item);
      });
    }, (error) => {
      console.error("댓글 불러오기 실패:", error);
    });

  unsubscribeComments.push(unsubscribe);
}

function renderPost(doc, user, postList) {
  const data = doc.data();
  const postId = doc.id;
  const article = document.createElement("article");
  article.className = "post-card";

  const body = document.createElement("div");
  body.className = "post-body";

  const content = document.createElement("p");
  content.className = "post-content";
  content.textContent = data.content;

  const meta = document.createElement("div");
  meta.className = "post-meta";
  meta.textContent = `${data.author || "익명"} · ${formatDate(data.createdAt)}`;

  body.appendChild(content);
  body.appendChild(meta);

  if (user && user.uid === data.uid) {
    const delBtn = document.createElement("button");
    delBtn.textContent = "글 삭제";
    delBtn.classList.add("delete-btn");
    delBtn.onclick = () => deletePost(postId);
    body.appendChild(delBtn);
  }

  const commentsSection = document.createElement("section");
  commentsSection.className = "comments-section";

  const title = document.createElement("h3");
  title.textContent = "댓글";

  const commentsBox = document.createElement("div");
  commentsBox.className = "comments-list";

  const form = document.createElement("div");
  form.className = "comment-form";

  const input = document.createElement("textarea");
  input.id = `commentInput-${postId}`;
  input.rows = 2;
  input.placeholder = user ? "따뜻한 댓글을 남겨주세요..." : "로그인 후 댓글을 남길 수 있습니다.";
  input.disabled = !user;

  const submitBtn = document.createElement("button");
  submitBtn.textContent = "댓글 쓰기";
  submitBtn.disabled = !user;
  submitBtn.onclick = () => submitComment(postId);

  form.appendChild(input);
  form.appendChild(submitBtn);

  commentsSection.appendChild(title);
  commentsSection.appendChild(commentsBox);
  commentsSection.appendChild(form);

  article.appendChild(body);
  article.appendChild(commentsSection);
  postList.appendChild(article);

  renderComments(postId, commentsBox, user);
}

function startPostListener(user) {
  const postList = document.getElementById("postList");
  if (!postList) return;

  if (unsubscribePosts) unsubscribePosts();
  clearCommentListeners();

  unsubscribePosts = db.collection("posts")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      postList.innerHTML = "";
      clearCommentListeners();

      if (snapshot.empty) {
        postList.innerHTML = "<p class='empty-posts'>아직 게시글이 없습니다. 첫 번째 긍정 메시지를 남겨보세요.</p>";
        return;
      }

      snapshot.forEach((doc) => renderPost(doc, user, postList));
    }, (error) => {
      console.error("글 목록 불러오기 실패:", error);
    });
}

// Login state + post list
firebase.auth().onAuthStateChanged((user) => {
  const userInfo = document.getElementById("userInfo");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (userInfo) {
    if (user) {
      userInfo.innerHTML = `
        <img src="${user.photoURL || 'https://via.placeholder.com/36'}" alt="프로필" />
        <span>${user.displayName || '사용자'}님 환영합니다!</span>
      `;
    } else {
      userInfo.innerHTML = "로그인 상태가 아닙니다.";
    }
  }

  if (loginBtn) loginBtn.style.display = user ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = user ? "inline-block" : "none";

  startPostListener(user);
});

// Expose functions for HTML onclick handlers.
window.login = login;
window.logout = logout;
window.submitPost = submitPost;
window.submitComment = submitComment;