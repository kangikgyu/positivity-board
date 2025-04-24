// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
 const firebaseConfig = {
    apiKey: "AIzaSyALuw2_DPTYAo0xWVygQmObST956DYCnm0",
    authDomain: "positivity-board-ig.firebaseapp.com",
    projectId: "positivity-board-ig",
    storageBucket: "positivity-board-ig.firebasestorage.app",
    messagingSenderId: "456213289485",
    appId: "1:456213289485:web:6da549c96b33cee7b15344",
    measurementId: "G-7KVLW9PFDK"
  };
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Firebase Auth 초기화
firebase.auth().onAuthStateChanged((user) => {
  const userInfo = document.getElementById("userInfo");
  if (user) {
    userInfo.textContent = `😊 ${user.displayName}님 로그인됨`;
  } else {
    userInfo.textContent = "로그인 안 됨";
  }
});

function login() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider);
}
function logout() {
  firebase.auth().signOut();
}

// 글 올리기
function submitPost() {
  const input = document.getElementById("postInput");
  const content = input.value.trim();
  if (!content) return alert("글을 입력해주세요!");

  db.collection("posts").add({
    content,
    createdAt: new Date()
    uid: firebase.auth().currentUser.uid 
  }).then(() => {
    input.value = "";
  }).catch((error) => {
    console.error("글 저장 실패:", error);
  });
}

// 글 목록 불러오기
const postList = document.getElementById("postList");

db.collection("posts")
  .orderBy("createdAt", "desc")
  .onSnapshot((snapshot) => {
    postList.innerHTML = "";
    snapshot.forEach((doc) => {
      const div = document.createElement("div");
      div.textContent = "• " + doc.data().content;
      postList.appendChild(div);
    });
  });

if (firebase.auth().currentUser.uid === doc.data().uid) {
  const delBtn = document.createElement("button");
  delBtn.textContent = "🗑 삭제";
  delBtn.onclick = () => {
    db.collection("posts").doc(doc.id).delete();
  };
  div.appendChild(delBtn);
}
