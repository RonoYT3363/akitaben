// リーチ・大当たり・RUSHなどの表示演出をまとめる場所です。
// Canvasの描画やアニメーションは今後このモジュールに追加します。

export function showEffect(statusElement, outcome) {
  if (!statusElement) return;
  statusElement.textContent = outcome?.type === "jackpot"
    ? "大当たり！"
    : "次の回転に期待！";
}
