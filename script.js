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

function formatCurrency(value) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0
  }).format(value);
}

// ✅ 이자 계산기 함수
function calculateInterest() {
  const principal = Number(document.getElementById("principalInput")?.value || 0);
  const annualRate = Number(document.getElementById("rateInput")?.value || 0) / 100;
  const years = Number(document.getElementById("yearsInput")?.value || 0);
  const compoundFrequency = Number(document.getElementById("compoundFrequencyInput")?.value || 1);

  if (principal <= 0 || annualRate < 0 || years <= 0 || compoundFrequency <= 0) {
    alert("원금과 기간은 0보다 커야 하고, 이자율과 복리 횟수는 0 이상이어야 합니다.");
    return;
  }

  const simpleInterest = principal * annualRate * years;
  const simpleTotal = principal + simpleInterest;
  const compoundTotal = principal * Math.pow(1 + annualRate / compoundFrequency, compoundFrequency * years);
  const compoundInterest = compoundTotal - principal;

  document.getElementById("simpleInterestResult").textContent = formatCurrency(simpleInterest);
  document.getElementById("simpleTotalResult").textContent = formatCurrency(simpleTotal);
  document.getElementById("compoundInterestResult").textContent = formatCurrency(compoundInterest);
  document.getElementById("compoundTotalResult").textContent = formatCurrency(compoundTotal);
  document.getElementById("interestSummary").textContent = `${years}년 동안 연 ${(
    annualRate * 100
  ).toFixed(2)}% 기준으로 복리 만기 금액은 ${formatCurrency(compoundTotal)}입니다.`;
}

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
  const postList = document.getElementById("postList");

  if (userInfo) {
    if (user) {
      userInfo.innerHTML = `
        <img src="${user.photoURL || "https://via.placeholder.com/36"}" alt="프로필" />
        <span>😊 ${user.displayName || "사용자"}님 환영합니다!</span>
      `;
    } else {
      userInfo.innerHTML = "🔒 로그인 상태가 아닙니다.";
    }
  }

  if (loginBtn) loginBtn.style.display = user ? "none" : "inline-block";
  if (logoutBtn) logoutBtn.style.display = user ? "inline-block" : "none";

  if (postList) {
    db.collection("posts")
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        postList.innerHTML = "";
        snapshot.forEach((doc) => {
          const data = doc.data();
          const div = document.createElement("div");
          div.textContent = `• ${data.content} (${data.author || "익명"})`;

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
  }
});

document.addEventListener("DOMContentLoaded", () => {
  calculateInterest();
});

// ✅ HTML onclick과 연결될 수 있도록 전역 등록
window.login = login;
window.logout = logout;
window.submitPost = submitPost;
window.calculateInterest = calculateInterest;
