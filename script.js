let currentUser = null;

// =====================
// テーマ切り替え
// =====================
function applyTheme(theme) {
    const selectedTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = selectedTheme;

    const button = document.getElementById("themeToggle");
    if (button) {
        button.textContent = selectedTheme === "dark" ? "☀️ ライト" : "🌙 ダーク";
        button.setAttribute("aria-label", selectedTheme === "dark" ? "ライトテーマに切り替える" : "ダークテーマに切り替える");
        button.title = selectedTheme === "dark" ? "ライトテーマに切り替える" : "ダークテーマに切り替える";
    }

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
        themeColor.content = selectedTheme === "dark" ? "#0f172a" : "#f8fafc";
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.dataset.theme || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    applyTheme(nextTheme);
    try {
        localStorage.setItem("akitaben-theme", nextTheme);
    } catch (error) {
        console.warn("テーマ設定を保存できませんでした:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const savedTheme = (() => {
        try {
            return localStorage.getItem("akitaben-theme");
        } catch (error) {
            return null;
        }
    })();
    const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    applyTheme(savedTheme || document.documentElement.dataset.theme || preferredTheme);

    const button = document.getElementById("themeToggle");
    if (button) button.addEventListener("click", toggleTheme);
});



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
let pendingAkitaText = "";

function previewAkitaConversion() {
    const input = document.getElementById("postInput");
    const preview = document.getElementById("akitaPreview");
    const previewText = document.getElementById("akitaPreviewText");
    if (!input || !preview || !previewText) return;
    const original = input.value.trim();
    if (!original) {
        alert("先に投稿文を入力してください。");
        return;
    }
    if (typeof window.convertToAkita !== "function") {
        alert("秋田弁変換エンジンを読み込めませんでした。");
        return;
    }
    pendingAkitaText = window.convertToAkita(original);
    previewText.textContent = pendingAkitaText;
    preview.hidden = false;
}

function applyAkitaConversion() {
    const input = document.getElementById("postInput");
    if (!input || !pendingAkitaText) return;
    input.value = pendingAkitaText;
    closeAkitaPreview();
    input.focus();
}

function closeAkitaPreview() {
    const preview = document.getElementById("akitaPreview");
    if (preview) preview.hidden = true;
    pendingAkitaText = "";
}

async function addPost() {
    try {
        const input = document.getElementById("postInput");
        const text = input.value.trim();
        if (!text) return;
        await fs.addDoc(fs.collection(db, "posts"), {
            text,
            nickname: currentUser?.nickname || "名無し",
            accountId: currentUser?.accountId || "",
            role: currentUser?.role || "user",
            createdAt: fs.serverTimestamp()
        });
        input.value = "";
        closeAkitaPreview();
    } catch (e) {
        console.error("投稿の作成に失敗しました:", e);
        alert("投稿できませんでした。時間をおいて再度お試しください。");
    }
}

// =====================
// // ロールに応じたバッジ（タグ）のHTMLを生成する関数
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
// アカウント統合フロー
// =====================
let accountFlowStage = "initial";
let accountPending = null;

function resetAccountFlow() {
    accountFlowStage = "initial";
    accountPending = null;
    const credentials = document.getElementById("accountCredentialsStep");
    const registration = document.getElementById("accountRegistrationStep");
    const confirm = document.getElementById("accountConfirmWrap");
    const continueBtn = document.getElementById("accountContinueBtn");
    const status = document.getElementById("accountStatus");
    const nickname = document.getElementById("accountNicknameInput");
    const password = document.getElementById("accountPasswordInput");
    if (credentials) credentials.hidden = false;
    if (registration) registration.hidden = true;
    if (confirm) confirm.hidden = true;
    if (continueBtn) continueBtn.disabled = false;
    if (status) status.textContent = "";
    if (nickname) nickname.value = "";
    if (password) { password.value = ""; password.autocomplete = "current-password"; }
}

function backToAccountDetails() {
    accountFlowStage = "nickname";
    const registration = document.getElementById("accountRegistrationStep");
    const confirm = document.getElementById("accountConfirmWrap");
    if (confirm) confirm.hidden = true;
    if (registration) registration.hidden = false;
}

async function continueAccount() {
    const idInput = document.getElementById("accountIdInput");
    const passwordInput = document.getElementById("accountPasswordInput");
    const credentials = document.getElementById("accountCredentialsStep");
    const registration = document.getElementById("accountRegistrationStep");
    const nicknameInput = document.getElementById("accountNicknameInput");
    const continueBtn = document.getElementById("accountContinueBtn");
    const registrationContinueBtn = document.getElementById("accountRegistrationContinueBtn");
    const status = document.getElementById("accountStatus");
    if (!idInput || !passwordInput) return;

    if (accountFlowStage === "nickname") {
        const name = nicknameInput ? nicknameInput.value.trim() : "";
        if (!name) { alert("ニックネームを入力してください。"); return; }
        accountPending = { id: idInput.value.trim(), pw: passwordInput.value, name };
        document.getElementById("accountConfirmId").textContent = accountPending.id;
        document.getElementById("accountConfirmName").textContent = name;
        if (registration) registration.hidden = true;
        document.getElementById("accountConfirmWrap").hidden = false;
        return;
    }

    const id = idInput.value.trim();
    const pw = passwordInput.value;
    if (!id || !pw) { alert("ユーザーIDとパスワードを入力してください。"); return; }

    if (continueBtn) continueBtn.disabled = true;
    if (status) status.textContent = "アカウントを確認しています…";
    try {
        const snap = await fs.getDocs(fs.collection(db, "users"));
        let found = null;
        snap.forEach(userDoc => {
            const user = userDoc.data();
            if (String(user.accountId || "") === id) found = { docId: userDoc.id, ...user };
        });
        if (found) {
            if (found.password !== pw) { if (status) status.textContent = ""; alert("パスワードが違います。"); return; }
            currentUser = { ...found, tokens: found.tokens !== undefined && found.tokens !== null ? found.tokens : 0 };
            localStorage.setItem("user", JSON.stringify(currentUser));
            updateTopRight();
            resetAccountFlow();
            showPage("homePage");
            alert("ログインしました。");
            return;
        }

        accountFlowStage = "nickname";
        const idSummary = document.getElementById("accountStepIdValue");
        if (idSummary) idSummary.textContent = id;
        if (credentials) credentials.hidden = true;
        if (registration) registration.hidden = false;
        passwordInput.autocomplete = "new-password";
        if (status) status.textContent = "";
        if (nicknameInput) nicknameInput.focus();
    } catch (error) {
        console.error("アカウント確認エラー:", error);
        alert("アカウントを確認できませんでした。時間をおいて再度お試しください。");
    } finally {
        if (continueBtn) continueBtn.disabled = false;
        if (registrationContinueBtn) registrationContinueBtn.disabled = false;
    }
}

async function createAccount() {
    if (!accountPending) return;
    const createBtn = document.getElementById("accountCreateBtn");
    if (createBtn) createBtn.disabled = true;
    try {
        const snap = await fs.getDocs(fs.collection(db, "users"));
        let duplicate = false;
        snap.forEach(userDoc => { if (String(userDoc.data().accountId || "") === accountPending.id) duplicate = true; });
        if (duplicate) {
            alert("このユーザーIDはすでに登録されています。最初からやり直してください。");
            resetAccountFlow();
            return;
        }
        const newUser = { accountId: accountPending.id, nickname: accountPending.name, password: accountPending.pw, role: "user", tokens: 0 };
        const created = await fs.addDoc(fs.collection(db, "users"), newUser);
        currentUser = { docId: created.id, ...newUser };
        localStorage.setItem("user", JSON.stringify(currentUser));
        updateTopRight();
        resetAccountFlow();
        showPage("homePage");
        alert("アカウントを作成しました。");
    } catch (error) {
        console.error("アカウント作成エラー:", error);
        alert("アカウントを作成できませんでした。時間をおいて再度お試しください。");
    } finally {
        if (createBtn) createBtn.disabled = false;
    }
}

// 旧画面との互換用
async function register() { return continueAccount(); }
async function login() { return continueAccount(); }

// =====================
// ユーザー読込
// =====================
function loadUser() {
    try {
        const u = localStorage.getItem("user");
        if (u) {
            currentUser = JSON.parse(u);
            if (currentUser.tokens === undefined) {
                currentUser.tokens = 0;
            }
        }
    } catch (e) {
        console.error("ユーザー読み込みエラー:", e);
        localStorage.removeItem("user");
        currentUser = null;
    }
}

// =====================
// トークン加算およびFirestore更新関数
// =====================
async function addTokensToUser(amount) {
    if (!currentUser) {
        alert("ログインしていません。");
        return;
    }

    try {
        currentUser.tokens = (currentUser.tokens || 0) + amount;
        if (currentUser.tokens < 0) currentUser.tokens = 0; // マイナス防止

        // Firestoreのドキュメントを更新
        if (currentUser.docId) {
            const userRef = fs.doc(db, "users", currentUser.docId);
            await fs.updateDoc(userRef, { tokens: currentUser.tokens });
        }

        // ローカルストレージも更新
        localStorage.setItem("user", JSON.stringify(currentUser));
        
        // 画面の表示を最新に更新
        updateTopRight();
    } catch (e) {
        console.error("トークン更新エラー:", e);
    }
}

// =====================
// 右上ボタンおよびメニュー表示の更新
// =====================
function openAccountEntry() {
    if (currentUser) {
        showPage("profilePage");
    } else {
        resetAccountFlow();
        showPage("accountPage");
    }
}

// =====================
// 右上ボタンおよびメニュー表示の更新
// =====================
function updateTopRight() {
    try {
        const btn = document.getElementById("accountBtn");
        const menuBtn = document.getElementById("accountMenuBtn");
        const headerToken = document.getElementById("headerToken");
        const tokenCountSpan = document.getElementById("tokenCount");
        if (btn) {
            btn.textContent = "アカウント";
            btn.onclick = openAccountEntry;
        }
        if (menuBtn) {
            menuBtn.textContent = "アカウント";
            menuBtn.onclick = openAccountEntry;
            menuBtn.style.display = "block";
        }
        if (!currentUser) {
            if (headerToken) headerToken.style.display = "none";
        } else {
            if (headerToken && tokenCountSpan) {
                tokenCountSpan.textContent = currentUser.tokens !== undefined ? currentUser.tokens : 0;
                headerToken.style.display = "block";
            }
            renderProfile();
        }
        renderGachaInventory();
    } catch (e) { console.error("UI更新エラー:", e); }
}

// =====================
// プロフィール表示
// =====================
function renderProfile() {
    try {
        const el = document.getElementById("profileInfo");
        if (!el || !currentUser) return;

        const badgeHtml = getRoleBadge(currentUser.role);
        const userTokens = currentUser.tokens !== undefined ? currentUser.tokens : 0;

        el.innerHTML = `
            <p style="font-size: 16px; margin: 8px 0;"><b>ID:</b> ${currentUser.accountId}</p>
            <p style="font-size: 16px; margin: 8px 0; display: flex; align-items: center;">
                <b>名前:</b> <span style="margin-left: 6px;">${currentUser.nickname}</span> ${badgeHtml}
            </p>
            <p style="font-size: 16px; margin: 8px 0;"><b>権限:</b> ${currentUser.role || "user"}</p>
            <p style="font-size: 16px; margin: 8px 0; color: #d97706; font-weight: bold;"><b>所持 Akita Token:</b> 🪙 ${userTokens} 枚</p>
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

// ==========================================
// 🏮 竿灯お囃子太鼓ミニゲームロジック
// ==========================================
let gameInterval = null;
let notes = [];
let gameScore = 0;
let gameActive = false;

function startKantoGame() {
    const startBtn = document.getElementById("gameStartBtn");
    const scoreDisplay = document.getElementById("gameScore");
    const feedback = document.getElementById("gameFeedback");

    gameScore = 0;
    notes = [];
    gameActive = true;
    if (startBtn) startBtn.style.display = "none";
    if (scoreDisplay) scoreDisplay.textContent = gameScore;
    if (feedback) feedback.textContent = "どっこいしょー！リズムに乗ろう！";

    if (gameInterval) clearInterval(gameInterval);

    gameInterval = setInterval(() => {
        if (!gameActive) return;

        const note = {
            id: Math.random(),
            x: 100
        };
        notes.push(note);
    }, 1200);

    window.requestAnimationFrame(updateGameLoop);
}

function updateGameLoop() {
    if (!gameActive) return;

    for (let i = notes.length - 1; i >= 0; i--) {
        notes[i].x -= 1.0;

        if (notes[i].x < -5) {
            notes.splice(i, 1);
            showFeedback("MISS...", "#ef4444");
        }
    }

    renderGame();

    if (gameActive) {
        window.requestAnimationFrame(updateGameLoop);
    }
}

function renderGame() {
    const track = document.getElementById("gameTrack");
    if (!track) return;

    let html = `
        <div style="position: absolute; left: 20%; top: 0; bottom: 0; width: 4px; background: #ef4444; z-index: 2;"></div>
        <div style="position: absolute; left: 19%; top: 40%; font-size: 12px; color: #ef4444; font-weight: bold; z-index: 3;">判定ライン</div>
    `;

    notes.forEach(note => {
        html += `
            <div style="position: absolute; left: ${note.x}%; top: 20px; width: 40px; height: 80px; background-color: #dc2626; border-radius: 20px; border: 2px solid #b91c1c; display: flex; align-items: center; justify-content: center; color: #fbbf24; font-weight: bold; font-size: 18px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                🏮
            </div>
        `;
    });

    track.innerHTML = html;
}

function hitTaiko() {
    if (!gameActive) return;

    let hitIndex = -1;
    let minDiff = 999;

    notes.forEach((note, index) => {
        const diff = Math.abs(note.x - 20);
        if (diff < minDiff) {
            minDiff = diff;
            hitIndex = index;
        }
    });

    if (hitIndex !== -1 && minDiff < 7) {
        let earned = 0;
        if (minDiff < 2.5) {
            showFeedback("✨ PERFECT! ドンッ！！ (+3 Token)", "#10b981");
            earned = 3;
        } else if (minDiff < 5) {
            showFeedback("👍 GREAT! ポンッ！ (+1 Token)", "#3b82f6");
            earned = 1;
        } else {
            showFeedback("🙂 GOOD (+1 Token)", "#f59e0b");
            earned = 1;
        }

        gameScore += earned;
        const scoreDisplay = document.getElementById("gameScore");
        if (scoreDisplay) scoreDisplay.textContent = gameScore;

        notes.splice(hitIndex, 1);

        if (gameScore >= 10) {
            endKantoGame(true);
        }
    } else {
        showFeedback("💥 スカッ…！", "#ef4444");
    }
}

function showFeedback(text, color) {
    const feedback = document.getElementById("gameFeedback");
    if (feedback) {
        feedback.textContent = text;
        feedback.style.color = color;
    }
}

async function endKantoGame(success) {
    gameActive = false;
    if (gameInterval) clearInterval(gameInterval);

    const startBtn = document.getElementById("gameStartBtn");
    const feedback = document.getElementById("gameFeedback");

    if (startBtn) startBtn.style.display = "inline-block";

    if (success) {
        if (feedback) feedback.textContent = `🎉 大成功！ Akita Token ${gameScore}枚ゲットしました！`;
        await addTokensToUser(gameScore);
        alert(`お見事！竿灯お囃子ゲームクリア！\n🪙 ${gameScore} Akita Tokenを獲得しました！`);
    } else {
        if (feedback) feedback.textContent = "ゲーム終了！";
    }
}

// ==========================================
// 🎁 ガチャ機能ロジック
// ==========================================
 // Akita Token 装備品ガチャ（ゲーム内アイテムのみ）
 // ==========================================
const gachaItems = [
    { id: "akita-tenugui", name: "竿灯の手ぬぐい", rarity: "N", rate: 60 },
    { id: "namahage-charm", name: "なまはげ面チャーム", rarity: "R", rate: 30 },
    { id: "golden-chochin", name: "金色の提灯", rarity: "SR", rate: 9 },
    { id: "kanto-crest", name: "竿灯大祭の紋章", rarity: "SSR", rate: 1 }
];
let gachaPulling = false;

function getGachaInventory() {
    if (!currentUser) return [];
    return Array.isArray(currentUser.gachaInventory) ? currentUser.gachaInventory : [];
}

function drawGachaItem() {
    const roll = Math.random() * 100;
    let total = 0;
    for (const item of gachaItems) {
        total += item.rate;
        if (roll < total) return item;
    }
    return gachaItems[0];
}

function renderGachaInventory() {
    const list = document.getElementById("gachaInventoryList");
    const count = document.getElementById("gachaCollectionCount");
    if (!list || !count) return;
    const owned = getGachaInventory().filter(entry => Number(entry.count) > 0);
    count.textContent = owned.length + "種類";
    list.replaceChildren();
    if (!owned.length) {
        const empty = document.createElement("p");
        empty.className = "gachaEmpty";
        empty.textContent = currentUser ? "まだアイテムを獲得していません。" : "ログインするとコレクションを確認できます。";
        list.appendChild(empty);
        return;
    }
    owned.forEach(entry => {
        const item = gachaItems.find(candidate => candidate.id === entry.id);
        if (!item) return;
        const card = document.createElement("div");
        card.className = "gachaItemCard";
        const rarity = document.createElement("span");
        rarity.className = "gachaRarity rarity" + item.rarity;
        rarity.textContent = item.rarity;
        const name = document.createElement("strong");
        name.textContent = item.name;
        const amount = document.createElement("span");
        amount.className = "gachaItemAmount";
        amount.textContent = "×" + Number(entry.count);
        card.append(rarity, name, amount);
        list.appendChild(card);
    });
}

async function pullGacha() {
    if (gachaPulling) return;
    const status = document.getElementById("gachaStatus");
    const button = document.getElementById("gachaPullButton");
    if (!currentUser || !currentUser.docId) {
        if (status) status.textContent = "ガチャを利用するにはログインしてください。";
        return;
    }
    const currentTokens = Math.max(0, Number(currentUser.tokens) || 0);
    if (currentTokens < 1) {
        if (status) status.textContent = "Tokenが足りません。ミニゲームで獲得できます。";
        return;
    }
    gachaPulling = true;
    if (button) button.disabled = true;
    if (status) status.textContent = "抽選中…";
    try {
        const wonItem = drawGachaItem();
        const inventory = getGachaInventory().map(entry => ({ id: entry.id, count: Number(entry.count) || 0 }));
        const existing = inventory.find(entry => entry.id === wonItem.id);
        if (existing) existing.count += 1;
        else inventory.push({ id: wonItem.id, count: 1 });
        const nextTokens = currentTokens - 1;
        const userRef = fs.doc(db, "users", currentUser.docId);
        await fs.updateDoc(userRef, { tokens: nextTokens, gachaInventory: inventory });
        currentUser.tokens = nextTokens;
        currentUser.gachaInventory = inventory;
        localStorage.setItem("user", JSON.stringify(currentUser));
        const result = document.getElementById("gachaLastResult");
        if (result) {
            result.replaceChildren();
            const rarity = document.createElement("span");
            rarity.className = "gachaRarity rarity" + wonItem.rarity;
            rarity.textContent = wonItem.rarity;
            const name = document.createElement("strong");
            name.textContent = wonItem.name;
            result.append("獲得！ ", rarity, " ", name);
        }
        if (status) status.textContent = "1 Akita Tokenを使用しました。残り " + nextTokens + " Token";
        updateTopRight();
        renderGachaInventory();
    } catch (error) {
        console.error("ガチャ処理に失敗しました:", error);
        if (status) status.textContent = "保存できませんでした。通信状態を確認して、もう一度お試しください。";
    } finally {
        gachaPulling = false;
        if (button) button.disabled = false;
    }
}

// =====================
// グローバル公開
// =====================
window.addPost = addPost;
window.previewAkitaConversion = previewAkitaConversion;
window.applyAkitaConversion = applyAkitaConversion;
window.closeAkitaPreview = closeAkitaPreview;
window.register = register;
window.login = login;
window.continueAccount = continueAccount;
window.createAccount = createAccount;
window.resetAccountFlow = resetAccountFlow;
window.backToAccountDetails = backToAccountDetails;
window.showPage = showPage;
window.searchPosts = searchPosts;
window.startKantoGame = startKantoGame;
window.hitTaiko = hitTaiko;
window.pullGacha = pullGacha;

// ==========================================
// Akitamon map (MapLibre GL JS + OpenFreeMap)
// ==========================================
let akitamonMap = null;
let akitamonUserMarker = null;
let akitamonLocationWatchId = null;
let akitamonHasCenteredOnUser = false;

const AKITAMON_TICKET_STORAGE_KEY = "akitamon-test-roulette-tickets-v2";
const AKITAMON_TICKET_COUNT_KEY = "akitamon-test-roulette-ticket-count-v1";
const AKITAMON_TICKET_TEST_DENSITY = 0.01; // 100㎡ごとに1%
const AKITAMON_TICKET_GRID_SIDE = 1000; // 10m × 10m の区画を1000 × 1000個
const AKITAMON_TICKET_AREA_SIDE_M = 10000; // 10km × 10km
let akitamonTicketMarkers = [];
let akitamonTicketData = null;
let akitamonMapLoaded = false;
let akitamonLocationResolved = false;

function getAkitamonTicketCount() {
    try {
        return Math.max(0, Number(localStorage.getItem(AKITAMON_TICKET_COUNT_KEY)) || 0);
    } catch (_) {
        return 0;
    }
}

function updateAkitamonTicketHud() {
    const count = document.getElementById("akitamonTicketCount");
    if (count) count.textContent = String(getAkitamonTicketCount());
}

function createAkitamonTestTickets() {
    if (Array.isArray(akitamonTicketData)) return akitamonTicketData;

    try {
        const saved = localStorage.getItem(AKITAMON_TICKET_STORAGE_KEY);
        akitamonTicketData = saved ? JSON.parse(saved) : null;
    } catch (_) {
        akitamonTicketData = null;
    }

    if (!Array.isArray(akitamonTicketData)) {
        akitamonTicketData = [];
        const center = akitamonMap.getCenter();
        const latScale = 1 / 111320;
        const lngScale = 1 / (111320 * Math.max(0.1, Math.cos(center.lat * Math.PI / 180)));
        const cellSize = AKITAMON_TICKET_AREA_SIDE_M / AKITAMON_TICKET_GRID_SIDE;

        // 10km四方を10m四方（100㎡）の区画に分け、各区画を独立して1%で抽選
        for (let row = 0; row < AKITAMON_TICKET_GRID_SIDE; row++) {
            for (let col = 0; col < AKITAMON_TICKET_GRID_SIDE; col++) {
                if (Math.random() >= AKITAMON_TICKET_TEST_DENSITY) continue;
                const east = -AKITAMON_TICKET_AREA_SIDE_M / 2 + (col + Math.random()) * cellSize;
                const north = -AKITAMON_TICKET_AREA_SIDE_M / 2 + (row + Math.random()) * cellSize;
                akitamonTicketData.push({
                    id: "test-ticket-" + row + "-" + col,
                    lng: center.lng + east * lngScale,
                    lat: center.lat + north * latScale
                });
            }
        }
        try {
            localStorage.setItem(AKITAMON_TICKET_STORAGE_KEY, JSON.stringify(akitamonTicketData));
        } catch (error) {
            console.warn("挑戦券のテスト配置を保存できませんでした:", error);
        }
    }

    return akitamonTicketData;
}

function renderAkitamonTestTickets() {
    if (!akitamonMap || !akitamonMapLoaded || !akitamonLocationResolved) return;
    const bounds = akitamonMap.getBounds();
    const tickets = createAkitamonTestTickets();
    const visibleTickets = tickets.filter(ticket => bounds.contains([ticket.lng, ticket.lat]));
    const visibleIds = new Set(visibleTickets.map(ticket => ticket.id));

    // 画面外に出たマーカーは外し、再び表示範囲に入ったら描画する
    akitamonTicketMarkers = akitamonTicketMarkers.filter(item => {
        if (visibleIds.has(item.id)) return true;
        item.marker.remove();
        return false;
    });

    const renderedIds = new Set(akitamonTicketMarkers.map(item => item.id));
    visibleTickets.forEach(ticket => {
        if (renderedIds.has(ticket.id)) return;
        const element = document.createElement("button");
        element.type = "button";
        element.className = "akitamon-ticket-marker";
        element.textContent = "券";
        element.setAttribute("aria-label", "Akita Tokenルーレット挑戦券を回収");
        element.title = "タップして挑戦券を回収";

        const marker = new maplibregl.Marker({ element, anchor: "center" })
            .setLngLat([ticket.lng, ticket.lat])
            .addTo(akitamonMap);

        element.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            marker.remove();
            akitamonTicketMarkers = akitamonTicketMarkers.filter(item => item.id !== ticket.id);
            akitamonTicketData = akitamonTicketData.filter(item => item.id !== ticket.id);
            try {
                localStorage.setItem(AKITAMON_TICKET_STORAGE_KEY, JSON.stringify(akitamonTicketData));
                localStorage.setItem(AKITAMON_TICKET_COUNT_KEY, String(getAkitamonTicketCount() + 1));
            } catch (error) {
                console.warn("挑戦券の回収状態を保存できませんでした:", error);
            }
            updateAkitamonTicketHud();
        });

        akitamonTicketMarkers.push({ id: ticket.id, marker });
    });

    updateAkitamonTicketHud();
}

function createAkitamonUserMarker() {
    const element = document.createElement("div");
    element.className = "akitamon-user-marker";
    element.setAttribute("aria-label", "現在地");
    return element;
}

function simplifyAkitamonStyle(style) {
    style.layers = (style.layers || []).map((layer) => {
        const id = String(layer.id || "").toLowerCase();
        const sourceLayer = String(layer["source-layer"] || "").toLowerCase();
        const key = id + " " + sourceLayer;
        const next = { ...layer, layout: { ...(layer.layout || {}) }, paint: { ...(layer.paint || {}) } };

        // Remove visual clutter that is not useful for a location-based game.
        if (/poi|housenumber|building|airport|transit|railway|shop|amenity|tourism|medical|food/.test(key)) {
            next.layout.visibility = "none";
            return next;
        }

        if (next.type === "background") {
            next.paint["background-color"] = "#edf4e9";
        } else if (next.type === "fill") {
            if (/water/.test(key)) {
                next.paint["fill-color"] = "#dcecf0";
            } else if (/wood|forest|park|grass|scrub|meadow|orchard|vineyard/.test(key)) {
                next.paint["fill-color"] = "#cfe2c5";
            } else if (/residential|commercial|industrial|landuse/.test(key)) {
                next.paint["fill-color"] = "#e7eee2";
            } else if (/landcover|land/.test(key)) {
                next.paint["fill-color"] = "#edf4e9";
            }
        } else if (next.type === "line") {
            if (/waterway|river|stream|canal/.test(key)) {
                next.paint["line-color"] = "#c3dfe5";
            } else if (/transportation|road|street|bridge|tunnel/.test(key)) {
                next.paint["line-color"] = "#ffffff";
            } else if (/boundary/.test(key)) {
                next.paint["line-color"] = "#d4dfd0";
            }
        } else if (next.type === "symbol" && next.layout["text-field"]) {
            next.paint["text-color"] = "#536454";
            next.paint["text-halo-color"] = "#f5f8f1";
            next.paint["text-halo-width"] = 1.2;
        } else if (next.type === "fill-extrusion") {
            next.layout.visibility = "none";
        }

        return next;
    });
    return style;
}

async function initializeAkitamonMap() {
    const container = document.getElementById("map");
    if (!container || typeof maplibregl === "undefined") {
        console.error("Akitamon: MapLibre GL JSを読み込めませんでした。");
        return;
    }

    try {
        const response = await fetch("https://tiles.openfreemap.org/styles/liberty");
        if (!response.ok) throw new Error("地図スタイルを取得できませんでした: " + response.status);
        const baseStyle = await response.json();
        const cleanStyle = simplifyAkitamonStyle(baseStyle);

        akitamonMap = new maplibregl.Map({
            container,
            style: cleanStyle,
            center: [140.1267, 39.7169],
            zoom: 14,
            minZoom: 3,
            maxZoom: 19,
            maxPitch: 0,
            pitchWithRotate: false,
            dragRotate: false,
            touchPitch: false,
            attributionControl: true
        });

        akitamonMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        akitamonMap.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");

        akitamonMap.once("load", () => {
            akitamonMapLoaded = true;
            renderAkitamonTestTickets();
        });

        akitamonMap.on("moveend", renderAkitamonTestTickets);
        akitamonMap.on("resize", renderAkitamonTestTickets);

        akitamonUserMarker = new maplibregl.Marker({
            element: createAkitamonUserMarker(),
            anchor: "center"
        });

        akitamonMap.on("click", (event) => {
            const panel = document.getElementById("ownerPanel");
            if (!panel || getComputedStyle(panel).display === "none") return;
            const latInput = document.getElementById("spoofLat");
            const lngInput = document.getElementById("spoofLng");
            if (latInput && lngInput) {
                latInput.value = event.lngLat.lat.toFixed(6);
                lngInput.value = event.lngLat.lng.toFixed(6);
            }
        });

        akitamonMap.on("error", (event) => {
            if (event && event.error) console.warn("Akitamon map:", event.error.message);
        });

        const originalShowPage = window.showPage;
        if (typeof originalShowPage === "function") {
            window.showPage = function(id) {
                originalShowPage(id);
                if (id === "akitamonPage") {
                    window.setTimeout(() => {
                        if (akitamonMap) {
                            akitamonMap.resize();
                            renderAkitamonTestTickets();
                        }
                    }, 250);
                    startAkitamonLocationWatch();
                } else {
                    stopAkitamonLocationWatch();
                }
            };
        }
    } catch (error) {
        console.error("Akitamon地図の初期化に失敗しました:", error);
        container.innerHTML = '<div class="akitamon-map-error">地図を読み込めませんでした。通信状態を確認して、ページを再度開いてください。</div>';
    }
}

function startAkitamonLocationWatch() {
    if (akitamonLocationWatchId !== null) return;
    if (!navigator.geolocation) {
        akitamonLocationResolved = true;
        renderAkitamonTestTickets();
        return;
    }

    akitamonLocationWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            if (!akitamonMap || !akitamonUserMarker) return;

            akitamonUserMarker.setLngLat([lng, lat]).addTo(akitamonMap);
            if (!akitamonHasCenteredOnUser) {
                akitamonHasCenteredOnUser = true;
                akitamonMap.once("moveend", () => {
                    akitamonLocationResolved = true;
                    renderAkitamonTestTickets();
                });
                akitamonMap.flyTo({ center: [lng, lat], zoom: Math.max(akitamonMap.getZoom(), 15), essential: true });
            } else {
                akitamonLocationResolved = true;
                renderAkitamonTestTickets();
            }
        },
        (error) => {
            console.warn("Akitamon: 現在地を取得できませんでした。", error.message);
            // 位置情報が使えない場合は、現在表示している地図の中心をテスト配置の基準にする
            akitamonLocationResolved = true;
            renderAkitamonTestTickets();
        },
        {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 10000
        }
    );
}

function stopAkitamonLocationWatch() {
    if (akitamonLocationWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(akitamonLocationWatchId);
        akitamonLocationWatchId = null;
    }
}

window.applySpoofedLocation = function() {
    const lat = Number(document.getElementById("spoofLat")?.value);
    const lng = Number(document.getElementById("spoofLng")?.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        alert("緯度・経度を正しく入力してください。");
        return;
    }
    if (akitamonMap && akitamonUserMarker) {
        akitamonUserMarker.setLngLat([lng, lat]).addTo(akitamonMap);
        akitamonMap.flyTo({ center: [lng, lat], zoom: 15, essential: true });
    }
};

document.addEventListener("DOMContentLoaded", initializeAkitamonMap);

document.addEventListener("DOMContentLoaded", renderGachaInventory);

// =====================
// DM 試験版（dm-test ブランチ専用）
// =====================
let dmUnsubscribe = null;
let dmSelectedUserId = "";
let dmCachedUsers = [];
let dmMessages = [];

function openDmPage() {
    showPage("dmPage");
    if (!currentUser) {
        const conversation = document.getElementById("dmConversation");
        if (conversation) conversation.textContent = "DMを使うにはログインしてください。";
        return;
    }
    loadDmUsers();
    if (!dmUnsubscribe) subscribeDmMessages();
}

async function loadDmUsers() {
    const select = document.getElementById("dmRecipient");
    if (!select) return;
    if (!currentUser) {
        select.innerHTML = '<option value="">ログインしてください</option>';
        return;
    }
    select.innerHTML = '<option value="">ユーザーを読み込み中...</option>';
    try {
        const snap = await fs.getDocs(fs.collection(db, "users"));
        dmCachedUsers = [];
        snap.forEach(userDoc => {
            const user = userDoc.data();
            if (userDoc.id !== currentUser.docId) {
                dmCachedUsers.push({id:userDoc.id,accountId:String(user.accountId||""),nickname:String(user.nickname||"名無し")});
            }
        });
        dmCachedUsers.sort((a,b)=>a.nickname.localeCompare(b.nickname,"ja"));
        select.replaceChildren();
        const placeholder=document.createElement("option");
        placeholder.value="";
        placeholder.textContent=dmCachedUsers.length?"送信先を選択":"ほかのユーザーはいません";
        select.appendChild(placeholder);
        dmCachedUsers.forEach(user=>{
            const option=document.createElement("option");
            option.value=user.id;
            option.textContent=user.nickname+(user.accountId?" (@"+user.accountId+")":"");
            select.appendChild(option);
        });
        if(dmSelectedUserId&&dmCachedUsers.some(user=>user.id===dmSelectedUserId)) select.value=dmSelectedUserId;
        else dmSelectedUserId="";
        renderDmConversation();
    } catch(error) {
        console.error("DMユーザー取得エラー:",error);
        select.innerHTML='<option value="">ユーザーを読み込めませんでした</option>';
    }
}

function subscribeDmMessages() {
    if(dmUnsubscribe||!currentUser) return;
    try {
        const q=fs.query(fs.collection(db,"dmMessages"),fs.orderBy("createdAt","desc"),fs.limit(100));
        dmUnsubscribe=fs.onSnapshot(q,snapshot=>{
            dmMessages=[];
            snapshot.forEach(messageDoc=>dmMessages.push({id:messageDoc.id,...messageDoc.data()}));
            renderDmConversation();
        },error=>{
            console.error("DM受信エラー:",error);
            const area=document.getElementById("dmConversation");
            if(area) area.textContent="メッセージを読み込めませんでした。";
        });
    } catch(error) {
        console.error("DM初期化エラー:",error);
    }
}

function renderDmConversation() {
    const area=document.getElementById("dmConversation");
    const select=document.getElementById("dmRecipient");
    if(!area||!currentUser) return;
    if(select&&select.value!==dmSelectedUserId) dmSelectedUserId=select.value;
    area.replaceChildren();
    if(!dmSelectedUserId) {
        const empty=document.createElement("p");
        empty.className="dmEmpty";
        empty.textContent="送信先を選ぶと会話が表示されます。";
        area.appendChild(empty);
        return;
    }
    const selected=dmCachedUsers.find(user=>user.id===dmSelectedUserId);
    if(!selected) {
        area.textContent="送信先が見つかりません。ユーザーを再読み込みしてください。";
        return;
    }
    const conversation=dmMessages.filter(message=>
        (message.fromId===currentUser.docId&&message.toId===dmSelectedUserId)||
        (message.fromId===dmSelectedUserId&&message.toId===currentUser.docId)
    ).reverse();
    if(!conversation.length) {
        const empty=document.createElement("p");
        empty.className="dmEmpty";
        empty.textContent=selected.nickname+" さんとのメッセージはまだありません。";
        area.appendChild(empty);
        return;
    }
    conversation.forEach(message=>{
        const bubble=document.createElement("div");
        bubble.className="dmBubble"+(message.fromId===currentUser.docId?" dmMine":" dmTheirs");
        const sender=document.createElement("div");
        sender.className="dmSender";
        sender.textContent=message.fromNickname||"名無し";
        const body=document.createElement("div");
        body.className="dmBody";
        body.textContent=message.text||"";
        const time=document.createElement("div");
        time.className="dmTime";
        if(message.createdAt&&typeof message.createdAt.toDate==="function") {
            time.textContent=message.createdAt.toDate().toLocaleString("ja-JP",{dateStyle:"short",timeStyle:"short"});
        } else time.textContent="送信直後";
        bubble.append(sender,body,time);
        area.appendChild(bubble);
    });
    area.scrollTop=area.scrollHeight;
}

async function sendDirectMessage() {
    if(!currentUser||!currentUser.docId) {alert("DMを送るにはログインしてください。");return;}
    const select=document.getElementById("dmRecipient");
    const input=document.getElementById("dmMessageInput");
    if(!select||!input) return;
    const recipientId=select.value;
    const text=input.value.trim();
    if(!recipientId) {alert("送信先を選択してください。");return;}
    if(!text) {alert("メッセージを入力してください。");return;}
    if(text.length>2000) {alert("メッセージは2,000文字以内にしてください。");return;}
    const recipient=dmCachedUsers.find(user=>user.id===recipientId);
    if(!recipient) {alert("送信先を再読み込みしてください。");return;}
    const button=document.getElementById("dmSendBtn");
    if(button) button.disabled=true;
    try {
        await fs.addDoc(fs.collection(db,"dmMessages"),{
            fromId:currentUser.docId,
            fromAccountId:currentUser.accountId||"",
            fromNickname:currentUser.nickname||"名無し",
            toId:recipientId,
            toAccountId:recipient.accountId,
            toNickname:recipient.nickname,
            text,
            createdAt:fs.serverTimestamp()
        });
        input.value="";
    } catch(error) {
        console.error("DM送信エラー:",error);
        alert("送信できませんでした。Firestoreの設定を確認してください。");
    } finally {
        if(button) button.disabled=false;
    }
}

document.addEventListener("DOMContentLoaded",()=>{
    const select=document.getElementById("dmRecipient");
    const input=document.getElementById("dmMessageInput");
    if(select) select.addEventListener("change",()=>{dmSelectedUserId=select.value;renderDmConversation();});
    if(input) input.addEventListener("keydown",event=>{
        if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();sendDirectMessage();}
    });
});


// =====================
// サイト全体のフォント選択・プレビュー
// =====================
(() => {
    const STORAGE_KEY = "say-font-family";
    const DEFAULT_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Yu Gothic UI", Meiryo, sans-serif';
    const modal = () => document.getElementById("fontPickerModal");
    const select = () => document.getElementById("fontPickerSelect");
    const sample = () => document.getElementById("fontPickerSample");
    const currentLabel = () => document.getElementById("fontPickerCurrent");

    function familyStack(name) {
        return '"' + name.replace(/"/g, "") + '", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    }
    function applyFont(name, save) {
        const family = name ? familyStack(name) : DEFAULT_FONT;
        document.documentElement.style.setProperty("--say-font-family", family);
        if (save) {
            try {
                if (name) localStorage.setItem(STORAGE_KEY, name);
                else localStorage.removeItem(STORAGE_KEY);
            } catch (error) {
                console.warn("フォント設定を保存できませんでした:", error);
            }
        }
        if (currentLabel()) currentLabel().textContent = name || "標準フォント";
    }
    function previewFont(name) {
        if (sample()) sample().style.fontFamily = name ? familyStack(name) : DEFAULT_FONT;
        if (currentLabel()) currentLabel().textContent = name || "標準フォント";
    }
    function openPicker() {
        const panel = modal();
        if (!panel) return;
        let saved = "";
        try { saved = localStorage.getItem(STORAGE_KEY) || ""; } catch (error) {}
        if (select()) select().value = saved;
        previewFont(saved);
        panel.hidden = false;
        panel.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        if (select()) select().focus();
    }
    function closePicker() {
        const panel = modal();
        if (!panel) return;
        panel.hidden = true;
        panel.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
        let saved = "";
        try { saved = localStorage.getItem(STORAGE_KEY) || ""; } catch (error) {}
        applyFont(saved, false);
        const opener = document.getElementById("fontPickerOpen");
        if (opener) opener.focus();
    }

    document.addEventListener("DOMContentLoaded", () => {
        let saved = "";
        try { saved = localStorage.getItem(STORAGE_KEY) || ""; } catch (error) {}
        applyFont(saved, false);

        const opener = document.getElementById("fontPickerOpen");
        const picker = select();
        const done = document.getElementById("fontPickerDone");
        const reset = document.getElementById("fontPickerReset");
        if (opener) opener.addEventListener("click", openPicker);
        if (picker) picker.addEventListener("change", () => {
            previewFont(picker.value);
            applyFont(picker.value, false);
        });
        if (done) done.addEventListener("click", () => {
            applyFont(picker ? picker.value : "", true);
            closePicker();
        });
        if (reset) reset.addEventListener("click", () => {
            if (picker) picker.value = "";
            previewFont("");
            applyFont("", true);
        });
        document.querySelectorAll("[data-font-close]").forEach(button => {
            button.addEventListener("click", closePicker);
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && modal() && !modal().hidden) closePicker();
        });
    });
})();
