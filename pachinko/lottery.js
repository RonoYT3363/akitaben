import {
  SYMBOLS,
  REACH_ROUTES,
  RAINBOW_HOLD_DENOMINATOR
} from "./config.js";

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
  if (total <= 0) return items[0];
  let ticket = Math.random() * total;
  for (const item of items) {
    ticket -= Math.max(0, Number(item.weight) || 0);
    if (ticket < 0) return item;
  }
  return items[items.length - 1];
}

function getLotterySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("akitaPachinkoBoardV1") || "null")?.lottery || {};
    return {
      jackpotDenominator: Math.max(1, Math.floor(Number(saved.jackpotDenominator) || 52)),
      symbolWeights: saved.symbolWeights || {},
      reachSymbolWeights: saved.reachSymbolWeights || {}
    };
  } catch {
    return { jackpotDenominator: 52, symbolWeights: {}, reachSymbolWeights: {} };
  }
}

function buildSymbols(weights) {
  return SYMBOLS.map(symbol => ({
    ...symbol,
    weight: Number.isFinite(Number(weights[symbol.value]))
      ? Math.max(0, Number(weights[symbol.value]))
      : symbol.weight
  }));
}

function drawCenterSymbol(excludedValue, symbols) {
  const candidates = symbols.filter(symbol => symbol.value !== excludedValue);
  return weightedPick(candidates);
}

export function drawOutcome() {
  const settings = getLotterySettings();
  const symbols = buildSymbols(settings.symbolWeights);
  const reachSymbols = SYMBOLS.map(symbol => ({ ...symbol, weight: Number.isFinite(Number(settings.reachSymbolWeights[symbol.value])) ? Math.max(0, Number(settings.reachSymbolWeights[symbol.value])) : symbol.weight * symbol.weight }));
  const jackpot = Math.random() < 1 / settings.jackpotDenominator;
  // 虹保留は大当たりの一部として扱い、全体の大当たり確率は設定値どおりに保つ。
  const rainbowHold = jackpot && Math.floor(Math.random() * RAINBOW_HOLD_DENOMINATOR) === 0;

  if (jackpot) {
    const winning = weightedPick(symbols);
    return {
      type: "jackpot",
      route: rainbowHold ? "full-spin" : "confirmed-reach",
      routeLabel: rainbowHold ? "確定全回転" : "確定リーチ",
      symbols: [winning.value, winning.value, winning.value],
      rainbowHold,
      reach: true,
      matchedSymbol: winning.value
    };
  }

  const left = weightedPick(symbols);
  const right = weightedPick(symbols);

  if (left.value !== right.value) {
    const center = drawCenterSymbol(null, symbols);
    return {
      type: "miss",
      route: "normal",
      routeLabel: "通常変動",
      symbols: [left.value, center.value, right.value],
      rainbowHold: false,
      reach: false
    };
  }

  // リーチが成立した場合の図柄は、専用の振り分け比率から選ぶ。
  const matched = weightedPick(reachSymbols);
  const route = weightedPick(REACH_ROUTES[matched.tier]);
  const center = drawCenterSymbol(matched.value, symbols);
  const labels = {
    "straight-miss": "直外れ",
    "weak-reach": "弱リーチ",
    "sp-reach": "SPリーチ",
    "confirmed-reach": "確定リーチ"
  };

  return {
    type: "miss",
    route: route.type,
    routeLabel: labels[route.type],
    symbols: [matched.value, center.value, matched.value],
    rainbowHold: false,
    reach: true,
    matchedSymbol: matched.value
  };
}
