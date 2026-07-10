let currentUser = null;

// =====================
// 初期化
// =====================
window.addEventListener("load", () => {
    loadUser();
    updateTopRight();
    loadPosts();
});

// =====================
// 投稿作成
// =====================
async function addPost() {

    const input = document.getElementById("postInput");

    let text = input.value.trim();

    if (!text) return;

    // 秋田弁へ変換
    if (typeof convertToAkita === "function") {
        text = convertToAkita(text);
    }

    await fs.addDoc(
        fs.collection(db, "posts"),
        {
            text,
            nickname: currentUser?.nickname || "名無し",
            createdAt: fs.serverTimestamp()
        }
    );

    input.value = "";
}

// =====================
// 投稿取得
// =====================
function loadPosts() {

    const posts = document.getElementById("posts");

    const q = fs.query(
        fs.collection(db, "posts"),
        fs.orderBy("createdAt", "desc")
    );

    fs.onSnapshot(q, (snap) => {

        console.log("posts:", snap.size);

        posts.innerHTML = "";

        snap.forEach(doc => {

            const p = doc.data();

            let timeText = "送信中...";

            if (p.createdAt) {

                const date = p.createdAt.toDate();

                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, "0");
                const dd = String(date.getDate()).padStart(2, "0");
                const hh = String(date.getHours()).padStart(2, "0");
                const mi = String(date.getMinutes()).padStart(2, "0");

                timeText = `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
            }

            const div = document.createElement("div");

            div.className = "post";

            div.innerHTML = `
                <div class="postHeader">
                    <b>${p.nickname || "名無し"}</b>
                </div>

                <div class="postText">
                    ${p.text || ""}
                </div>

                <div class="postTime">
                    ${timeText}
                </div>
            `;

            posts.appendChild(div);

        });

    });

}

// =====================
// 登録
// =====================
async function register() {

    const id = document.getElementById("regId").value;

    const name = document.getElementById("regName").value;

    const pw = document.getElementById("regPw").value;

    await fs.addDoc(

        fs.collection(db, "users"),

        {

            accountId: id,

            nickname: name,

            password: pw

        }

    );

    alert("登録完了");

    showPage("loginPage");

}

// =====================
// ログイン
// =====================
async function login() {

    const id = document.getElementById("loginId").value;

    const pw = document.getElementById("loginPw").value;

    const snap = await fs.getDocs(

        fs.collection(db, "users")

    );

    snap.forEach(doc => {

        const u = doc.data();

        if (

            u.accountId === id &&

            u.password === pw

        ) {

            currentUser = u;

            localStorage.setItem(

                "user",

                JSON.stringify(u)

            );

        }

    });

    updateTopRight();

    showPage("homePage");

}

// =====================
// ユーザー読込
// =====================
function loadUser() {

    const u = localStorage.getItem("user");

    if (u) {

        currentUser = JSON.parse(u);

    }

}

// =====================
// 右上ボタンおよびメニュー表示の更新
// =====================
function updateTopRight() {

    const btn = document.getElementById("accountBtn");
    
    // 左メニューのボタンたちを取得
    const loginBtn = document.querySelector("#leftMenu button[onclick*='loginPage']");
    const registerBtn = document.querySelector("#leftMenu button[onclick*='registerPage']");
    const profileBtn = document.querySelector("#leftMenu button[onclick*='profilePage']");

    if (!btn) return;

    if (!currentUser) {
        // ログイン【前】のとき
        btn.textContent = "アカウント作成";
        btn.onclick = () => {
            showPage("registerPage");
        };

        // ログイン・登録ボタンは表示、プロフィールは非表示
        if (loginBtn) loginBtn.style.display = "block";
        if (registerBtn) registerBtn.style.display = "block";
        if (profileBtn) profileBtn.style.display = "none";

    } else {
        // ログイン【後】のとき
        btn.textContent = currentUser.nickname;
        btn.onclick = () => {
            showPage("profilePage");
        };

        // ログイン・登録ボタンは非表示、プロフィールを表示
        if (loginBtn) loginBtn.style.display = "none";
        if (registerBtn) registerBtn.style.display = "none";
        if (profileBtn) profileBtn.style.display = "block";

        renderProfile();
    }
}

// =====================
// プロフィール表示
// =====================
function renderProfile() {

    const el = document.getElementById("profileInfo");

    if (!el || !currentUser) return;

    el.innerHTML = `
        <p>ID: ${currentUser.accountId}</p>
        <p>名前: ${currentUser.nickname}</p>
    `;

}

// =====================
// ページ切替
// =====================
function showPage(id) {

    document.querySelectorAll(".page").forEach(page => {

        page.style.display = "none";

    });

    const target = document.getElementById(id);

    if (target) {

        target.style.display = "block";

    }

}

// =====================
// Enterキーで投稿
// =====================
document.addEventListener("DOMContentLoaded", () => {

    const input = document.getElementById("postInput");

    if (!input) return;

    input.addEventListener("keydown", (e) => {

        if (e.key === "Enter" && !e.shiftKey) {

            e.preventDefault();

            addPost();

        }

    });

});

// =====================
// グローバル公開
// =====================
window.addPost = addPost;
window.register = register;
window.login = login;
window.showPage = showPage;


// ==========================================
// 地図（Leaflet）初期化 ＆ アイテム配置
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById('map')) return;

    // 最初は秋田駅周辺で地図を準備
    const map = L.map('map').setView([39.7169, 140.1267], 15);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // 自分の現在地を表示するためのピン
    const userMarker = L.marker([39.7169, 140.1267]).addTo(map)
        .bindPopup('あなたの現在地（読み込み中...）');

    window.myAppMap = map;

    // --- マップ上にアイテム（ピン）を配置 ---
    // アイテム1：なまはげの盾
    const item1 = L.marker([39.7180, 140.1280]).addTo(map)
        .bindPopup('<b>【レアアイテム】</b><br>なまはげの盾を見つけたっす！');

    // アイテム2：きりたんぽ
    const item2 = L.marker([39.7155, 140.1245]).addTo(map)
        .bindPopup('<b>【回復アイテム】</b><br>ほかほかのきりたんぽっす！');


    // --- 現在地をリアルタイムに追いかける機能 (GPS連携) ---
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;  // 緯度
                const lng = position.coords.longitude; // 経度

                // 自分のピンを今の位置に移動
                userMarker.setLatLng([lat, lng]);
                userMarker.getPopup().setContent('ここにいるっす！');

                // 地図の中心を自分の位置に移動
                map.panTo([lat, lng]);
                
                console.log("現在地を更新しました:", lat, lng);
            },
            (error) => {
                console.error("位置情報の取得に失敗しました:", error.message);
                userMarker.getPopup().setContent('GPSをオンにしてけれ！');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        alert("お使いのブラウザは位置情報（GPS）に対応していません。");
    }

    // Akitamonが開かれたら地図を表示更新する
    const originalShowPage = window.showPage;
    window.showPage = function(id) {
        originalShowPage(id);
        
        if (id === 'akitamonPage') {
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
        }
    };
});
