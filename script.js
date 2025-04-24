// ✅ Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyALuw2_DPTYAo0xWVygQmObST956DYCnm0",
  authDomain: "positivity-board-ig.firebaseapp.com",
  projectId: "positivity-board-ig",
  storageBucket: "positivity-board-ig.firebasestorage.app",
  messagingSenderId: "456213289485",
  appId: "1:456213289485:web:6da549c96b33cee7b15344",
  measurementId: "G-7KVLW9PFDK"
};

// ✅ Firebase 초기화
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ✅ 로그인 함수
function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider);
}

// ✅ 로그아웃 함수
function logout() {
  firebase.auth().signOut();
}

// ✅ 글쓰기 함수
function submitPost() {
  const input = document.getElementById("postInput");
  const content = input.value.trim();
  const user = firebase.auth().currentUser;

  if (!content) return alert("글을 입력해주세요!");
  if (!user) return alert("로그인 후 글을 작성할 수 있습니다.");

  db.collection("posts").add({
    content,
    createdAt: new Date(),
    uid: user.uid,
    author: user.displayName || "익명"
  }).then(() => {
    input.value = "";
  }).catch((error) => {
    console.error("글 저장 실패:", error);
  });
}

// ✅ 로그인 상태 감지 + 글 목록 표시
firebase.auth().onAuthStateChanged((user) => {
  const userInfo = document.getElementById("userInfo");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (user) {
    userInfo.textContent = `😊 ${user.displayName}님 환영합니다!`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
  } else {
    userInfo.textContent = "🔒 로그인 상태가 아닙니다.";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
  }

  const postList = document.getElementById("postList");
  db.collection("posts")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      postList.innerHTML = "";
      snapshot.forEach((doc) => {
        const data = doc.data();
        const div = document.createElement("div");
        div.textContent = `• ${data.content} (${data.author || "익명"})`;

        // 삭제 버튼 – 본인 글만
        if (user && user.uid === data.uid) {
          const delBtn = document.createElement("button");
          delBtn.textContent = "🗑 삭제";
          delBtn.classList.add("delete-btn");
          delBtn.onclick = () => {
            const confirmDelete = confirm("정말로 삭제하시겠어요?");
            if (confirmDelete) {
              db.collection("posts").doc(doc.id).delete();
            }
          };
          div.appendChild(delBtn);
        }

        postList.appendChild(div);
      });
    });
});

// ✅ HTML onclick과 연결될 수 있도록 전역 등록
window.login = login;
window.logout = logout;
window.submitPost = submitPost;
