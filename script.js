let currentUser = null;

// =====================
// 初期化
// =====================
window.addEventListener("load", () => {
    try {
        loadUser();
        updateTopRight();
        loadPosts();
    } catch (e) {
        console.error("初期化エラー:", e);
    }
});

// =====================
// 投稿作成
// =====================
async function addPost() {
    try {
        const input = document.getElementById("postInput");
        let text = input.value.trim();

        if (!text) return;

        // 【修正】秋田弁への自動変換処理を完全に削除しました。入力されたテキストがそのまま送信されます。

        await fs.addDoc(
            fs.collection(db, "posts"),
            {
                text,
                nickname: currentUser?.nickname || "名無し",
                accountId: currentUser?.accountId || "", // タグ判定用に作成者のIDも保存
                role: currentUser?.role || "user",       // 投稿時のロールも保存
                createdAt: fs.serverTimestamp()
            }
        );

        input.value = "";
    } catch (e) {
        console.error("投稿の作成に失敗しました:", e);
    }
}

// =====================
// ロールに応じたバッジ（タグ）のHTMLを生成する関数
// =====================
function getRoleBadge(role) {
    if (!role) return "";
    
    const cleanRole = String(role).trim().toLowerCase();
    
    if (cleanRole === "owner") {
        return `<span style="background-color: #FFD700; color: #333; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 6px; font-weight: bold; border: 1px solid #DAA520; display: inline-block; vertical-align: middle;">OWNER</span>`;
    } else if (cleanRole === "smod") {
        return `<span style="background-color: #FF4500; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 6px; font-weight: bold; display: inline-block; vertical-align: middle;">SMOD</span>`;
    } else if (cleanRole === "jmod") {
        return `<span style="background-color: #FF6347; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 6px; font-weight: bold; display: inline-block; vertical-align: middle;">JMOD</span>`;
    }
    return "";
}

// =====================
// 投稿取得（最新10件制限版）
// =====================
function loadPosts() {
    try {
        const posts = document.getElementById("posts");
        if (!posts) return;

        let q;
        if (window.fs && typeof fs.limit === "function") {
            q = fs.query(
                fs.collection(db, "posts"),
                fs.orderBy("createdAt", "desc"),
                fs.limit(10)
            );
        } else {
            q = fs.query(
                fs.collection(db, "posts"),
                fs.orderBy("createdAt", "desc")
            );
        }

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

                const badgeHtml = getRoleBadge(p.role);

                const div = document.createElement("div");
                div.className = "post";
                div.innerHTML = `
                    <div class="postHeader">
                        <b>${p.nickname || "名無し"}</b>${badgeHtml}
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
    } catch (e) {
        console.error("タイムライン読み込みエラー:", e);
    }
}

// =====================
// 投稿検索
// =====================
async function searchPosts() {
    const input = document.getElementById("searchInput");
    const resultsDiv = document.getElementById("searchResults");
    
    if (!input || !resultsDiv) return;

    const keyword = input.value.trim();
    if (!keyword) {
        alert("キーワードを入力してください。");
        return;
    }

    resultsDiv.innerHTML = "<p style='color: #65676b;'>検索中...</p>";

    try {
        const q = fs.query(
            fs.collection(db, "posts"),
            fs.orderBy("createdAt", "desc"),
            fs.limit(50)
        );
        
        const snap = await fs.getDocs(q);
        resultsDiv.innerHTML = "";
        let count = 0;

        snap.forEach(doc => {
            const p = doc.data();
            
            if (p.text && p.text.includes(keyword)) {
                count++;

                let timeText = "不明な時間";
                if (p.createdAt) {
                    const date = p.createdAt.toDate();
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, "0");
                    const dd = String(date.getDate()).padStart(2, "0");
                    const hh = String(date.getHours()).padStart(2, "0");
                    const mi = String(date.getMinutes()).padStart(2, "0");
                    timeText = `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
                }

                const badgeHtml = getRoleBadge(p.role);
                const div = document.createElement("div");
                div.className = "post";
                div.innerHTML = `
                    <div class="postHeader">
                        <b>${p.nickname || "名無し"}</b>${badgeHtml}
                    </div>
                    <div class="postText">
                        ${p.text || ""}
                    </div>
                    <div class="postTime">
                        ${timeText}
                    </div>
                `;
                resultsDiv.appendChild(div);
            }
        });

        if (count === 0) {
            resultsDiv.innerHTML = `<p style='color: #65676b;'>「${keyword}」が含まれる投稿は見つかりませんでした。</p>`;
        }

    } catch (error) {
        console.error("検索エラー:", error);
        resultsDiv.innerHTML = "<p style='color: red;'>エラーが発生したため検索できませんでした。</p>";
    }
}

// =====================
// 登録
// =====================
async function register() {
    try {
        const id = document.getElementById("regId").value;
        const name = document.getElementById("regName").value;
        const pw = document.getElementById("regPw").value;

        await fs.addDoc(
            fs.collection(db, "users"),
            {
                accountId: id,
                nickname: name,
                password: pw,
                role: "user"
            }
        );

        alert("登録が完了しました。ログインしてください。");
        showPage("loginPage");
    } catch (e) {
        console.error("登録エラー:", e);
    }
}

// =====================
// ログイン
// =====================
async function login() {
    try {
        const id = document.getElementById("loginId").value;
        const pw = document.getElementById("loginPw").value;

        const snap = await fs.getDocs(
            fs.collection(db, "users")
        );

        let loggedInUser = null;

        snap.forEach(doc => {
            const u = doc.data();
            if (u.accountId === id && u.password === pw) {
                loggedInUser = u;
            }
        });

        if (loggedInUser) {
            currentUser = loggedInUser;
            localStorage.setItem("user", JSON.stringify(loggedInUser));
            updateTopRight();
            showPage("homePage");
        } else {
            alert("IDまたはパスワードが間違っています。");
        }
    } catch (e) {
        console.error("ログインエラー:", e);
    }
}

// =====================
// ユーザー読込
// =====================
function loadUser() {
    try {
        const u = localStorage.getItem("user");
        if (u) {
            currentUser = JSON.parse(u);
        }
    } catch (e) {
        console.error("ユーザー読み込みエラー:", e);
        localStorage.removeItem("user");
        currentUser = null;
    }
}

// =====================
// 右上ボタンおよびメニュー表示の更新
// =====================
function updateTopRight() {
    try {
        const btn = document.getElementById("accountBtn");
        
        const loginBtn = document.querySelector("#leftMenu button[onclick*='loginPage']");
        const registerBtn = document.querySelector("#leftMenu button[onclick*='registerPage']");
        const profileBtn = document.querySelector("#leftMenu button[onclick*='profilePage']");

        if (!btn) return;

        if (!currentUser) {
            btn.textContent = "アカウント作成";
            btn.onclick = () => {
                showPage("registerPage");
            };

            if (loginBtn) loginBtn.style.display = "block";
            if (registerBtn) registerBtn.style.display = "block";
            if (profileBtn) profileBtn.style.display = "none";

        } else {
            btn.textContent = currentUser.nickname;
            btn.onclick = () => {
                showPage("profilePage");
            };

            if (loginBtn) loginBtn.style.display = "none";
            if (registerBtn) registerBtn.style.display = "none";
            if (profileBtn) profileBtn.style.display = "block";

            renderProfile();
        }
    } catch (e) {
        console.error("UI更新エラー:", e);
    }
}

// =====================
// プロフィール表示
// =====================
function renderProfile() {
    try {
        const el = document.getElementById("profileInfo");
        if (!el || !currentUser) return;

        const badgeHtml = getRoleBadge(currentUser.role);

        el.innerHTML = `
            <p style="font-size: 16px; margin: 8px 0;"><b>ID:</b> ${currentUser.accountId}</p>
            <p style="font-size: 16px; margin: 8px 0; display: flex; align-items: center;">
                <b>名前:</b> <span style="margin-left: 6px;">${currentUser.nickname}</span> ${badgeHtml}
            </p>
            <p style="font-size: 16px; margin: 8px 0;"><b>権限:</b> ${currentUser.role || "user"}</p>
            <button id="logoutBtn" style="background-color: #ff4d4d; color: white; border: none; padding: 12px 20px; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; width: 100%; margin-top: 20px; transition: background-color 0.2s;">
                ログアウト
            </button>
        `;

        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
            logoutBtn.onmouseenter = () => logoutBtn.style.backgroundColor = "#e60000";
            logoutBtn.onmouseleave = () => logoutBtn.style.backgroundColor = "#ff4d4d";
            
            logoutBtn.onclick = () => {
                if (confirm("本当にログアウトしますか？")) {
                    localStorage.removeItem("user");
                    currentUser = null;
                    alert("ログアウトしました。");
                    window.location.reload();
                }
            };
        }
    } catch (e) {
        console.error("プロフィールレンダリングエラー:", e);
    }
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
window.searchPosts = searchPosts;

// ==========================================
// 地図（Leaflet）初期化
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    if (!document.getElementById('map')) return;

    const map = L.map('map').setView([39.7169, 140.1267], 15);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const userMarker = L.marker([39.7169, 140.1267]).addTo(map)
        .bindPopup('あなたの現在地（読み込み中...）');

    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                userMarker.setLatLng([lat, lng]);
                userMarker.getPopup().setContent('現在地にピンを配置しました');
                map.panTo([lat, lng]);
            },
            (error) => {
                console.error("位置情報の取得失敗:", error.message);
                userMarker.getPopup().setContent('GPSをONにしてください。');
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
