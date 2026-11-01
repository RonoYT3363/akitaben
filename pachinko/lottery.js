import {
  SYMBOLS,
  REACH_ROUTES,
  REACH_JACKPOT_RATES,
  RAINBOW_HOLD_DENOMINATOR
} from "./config.js";

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let ticket = Math.random() * total;
  for (const item of items) {
    ticket -= item.weight;
    if (ticket < 0) return item;
  }
  return items[items.length - 1];
}

function drawSymbol() {
  return weightedPick(SYMBOLS);
}

function drawCenterSymbol(excludedValue) {
  const candidates = SYMBOLS.filter(symbol => symbol.value !== excludedValue);
  return weightedPick(candidates);
}

export function drawOutcome() {
  // 虹保留用の全回転抽選は、通常の図柄抽選とは独立させる。
  const rainbowHold = Math.floor(Math.random() * RAINBOW_HOLD_DENOMINATOR) === 0;
  const left = drawSymbol();
  const right = drawSymbol();

  if (rainbowHold) {
    return {
      type: "jackpot",
      route: "full-spin",
      routeLabel: "確定全回転",
      symbols: [left.value, left.value, left.value],
      rainbowHold: true,
      reach: true
    };
  }

  // 左右が異なる場合は通常変動。中図柄は即決し、三つ揃いを避ける。
  if (left.value !== right.value) {
    const center = drawCenterSymbol(null);
    return {
      type: "miss",
      route: "normal",
      routeLabel: "通常変動",
      symbols: [left.value, center.value, right.value],
      rainbowHold: false,
      reach: false
    };
  }

  // リーチ成立時点では当否を決めず、図柄の tier から発展先を抽選する。
  const route = weightedPick(REACH_ROUTES[left.tier]);
  const jackpot = Math.random() < REACH_JACKPOT_RATES[route.type];
  const center = jackpot ? left : drawCenterSymbol(left.value);

  const labels = {
    "straight-miss": "直外れ",
    "weak-reach": "弱リーチ",
    "sp-reach": "SPリーチ",
    "confirmed-reach": "確定リーチ"
  };

  return {
    type: jackpot ? "jackpot" : "miss",
    route: route.type,
    routeLabel: labels[route.type],
    symbols: [left.value, center.value, right.value],
    rainbowHold: false,
    reach: true,
    matchedSymbol: left.value
  };
}
