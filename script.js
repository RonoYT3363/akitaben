// ==========================================
// んだっす（v0.4.0-alpha）システムメインスクリプト
// ==========================================

// 💡 画面（DOM）が完全に読み込まれたら起動する
document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. 初期化処理（ログイン状態の確認） ---
    // ローカルストレージから保存されているニックネームを取得
    const savedNickname = localStorage.getItem('nda_nickname');
    const nicknameInput = document.getElementById('nicknameInput');

    if (savedNickname) {
        console.log(`ログイン中だす: ${savedNickname}`);
        // もしプロフィール画面の入力欄が存在すれば、保存されている名前を最初から入れておく
        if (nicknameInput) {
            nicknameInput.value = savedNickname;
        }
        // 【ここにログイン中の画面切り替え処理などを追加しての】
    } else {
        console.log('未ログイン状態だす。ログインしてね画面へ');
        // 【ここに未ログイン時の画面切り替え処理などを追加しての】
    }

    // --- 2. プロフィール「保存ボタン」の動き ---
    const saveButton = document.getElementById('saveBtn');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            if (!nicknameInput) return;

            const inputVal = nicknameInput.value.trim();
            
            // 空っぽのときはエラーを出す
            if (inputVal === '') {
                alert('名前を入力してけれ！');
                return;
            }

            // ニックネームをローカルストレージに保存
            localStorage.setItem('nda_nickname', inputVal);
            alert('保存したっす！タイムラインへ投稿できるようになりました！');
            
            // 保存したら画面をリロードして最新の状態を反映
            window.location.reload();
        });
    }

    // --- 3. 新機能：「ログアウトボタン」の動き ---
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            // ユーザーに確認する
            const confirmLogout = confirm('本当にログアウトするべが？');
            
            if (confirmLogout) {
                // ローカルストレージからニックネームを消去して初期化
                localStorage.removeItem('nda_nickname');
                
                alert('ログアウトしたっす！また来てねの〜👋');
                
                // 画面をリロードして完全に未ログイン状態（初期画面）に戻す
                window.location.reload();
            }
        });
    }

});
