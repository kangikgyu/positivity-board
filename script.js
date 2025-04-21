// 🛠️ 여기에 본인의 Firebase 설정 정보 입력하세요
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


// 게시글 올리기 함수
export async function submitPost() {
  const input = document.getElementById("postInput");
  const content = input.value.trim();
  if (!content) return alert("글을 입력해주세요!");

  await addDoc(collection(db, "posts"), {
    content,
    createdAt: new Date()
  });

  input.value = "";
}

// 실시간 글 목록 표시
const postList = document.getElementById("postList");
const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  postList.innerHTML = "";
  snapshot.forEach((doc) => {
    const div = document.createElement("div");
    div.textContent = "• " + doc.data().content;
    postList.appendChild(div);
  });
});
