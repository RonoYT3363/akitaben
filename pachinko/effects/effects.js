// リーチ種別ごとの仮演出。素材・アニメーションは後から差し替え可能です。
export async function showEffect(statusElement, outcome, duration = 900) {
  if (!statusElement) return;
  const messages = {
    "straight-miss": "図柄がテンパイ…そのまま停止！",
    "weak-reach": "チャンス！ 弱リーチ発展！",
    "sp-reach": "SPリーチ！！ 最後まで目が離せない！",
    "confirmed-reach": "激アツ！ 確定リーチ！！",
    "full-spin": "虹保留！ 確定全回転！！"
  };
  statusElement.textContent = messages[outcome?.route] ?? "リーチ発展！";
  statusElement.classList.toggle("status--sp", outcome?.route === "sp-reach" || outcome?.route === "full-spin");
  await new Promise(resolve => setTimeout(resolve, duration));
  statusElement.classList.remove("status--sp");
}