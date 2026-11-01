// テストプレイ用の仮設定です。
// ここを変更すれば、図柄の出現率・リーチ発展率・各リーチ期待度を調整できます。

export const SYMBOLS = [
  { value: "1", weight: 7, tier: "medium" },
  { value: "2", weight: 10, tier: "weak" },
  { value: "3", weight: 4, tier: "strong" },
  { value: "4", weight: 10, tier: "weak" },
  { value: "5", weight: 7, tier: "medium" },
  { value: "6", weight: 10, tier: "weak" },
  { value: "7", weight: 4, tier: "strong" },
  { value: "8", weight: 10, tier: "weak" },
  { value: "9", weight: 7, tier: "medium" },
  { value: "S", weight: 1, tier: "special" }
];

// 左右が一致した後、図柄の強さに応じて選ばれる発展先。
// 数値は重みであり、合計に対する割合で抽選します。
export const REACH_ROUTES = {
  weak: [
    { type: "straight-miss", weight: 55 },
    { type: "weak-reach", weight: 35 },
    { type: "sp-reach", weight: 9 },
    { type: "confirmed-reach", weight: 1 }
  ],
  medium: [
    { type: "straight-miss", weight: 35 },
    { type: "weak-reach", weight: 40 },
    { type: "sp-reach", weight: 20 },
    { type: "confirmed-reach", weight: 5 }
  ],
  strong: [
    { type: "straight-miss", weight: 15 },
    { type: "weak-reach", weight: 35 },
    { type: "sp-reach", weight: 35 },
    { type: "confirmed-reach", weight: 15 }
  ],
  special: [
    { type: "straight-miss", weight: 0 },
    { type: "weak-reach", weight: 10 },
    { type: "sp-reach", weight: 40 },
    { type: "confirmed-reach", weight: 50 }
  ]
};

// リーチ発展後の当否。confirmed-reach は仮で大当たり濃厚（100%）に設定。
export const REACH_JACKPOT_RATES = {
  "straight-miss": 0,
  "weak-reach": 0.03,
  "sp-reach": 0.20,
  "confirmed-reach": 1
};

// 虹保留に対応する独立抽選。今回は仮で1/500。
// 成立した回転は確定全回転となります。
export const RAINBOW_HOLD_DENOMINATOR = 500;
