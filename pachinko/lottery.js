// 抽選ロジックを物理演算・演出から分離します。
// 確率は後から台ごとの設定として渡せるようにします。

export function drawOutcome({ jackpotDenominator = 319 } = {}) {
  const denominator = Math.max(1, Math.floor(jackpotDenominator));
  return Math.floor(Math.random() * denominator) === 0
    ? { type: "jackpot" }
    : { type: "miss" };
}
