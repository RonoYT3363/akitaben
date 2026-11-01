import { createBall, stepBall } from "./physics.js";
import { drawOutcome } from "./lottery.js";
import { showEffect } from "./effects/effects.js";

const canvas = document.querySelector("#machine-canvas");
const context = canvas?.getContext("2d");
const startButton = document.querySelector("#start-button");
const statusElement = document.querySelector("#status");
const reelElements = [
  document.querySelector("#reel-left"),
  document.querySelector("#reel-center"),
  document.querySelector("#reel-right")
];
const routeElement = document.querySelector("#route-label");
const resultElement = document.querySelector("#result-label");
const spinCountElement = document.querySelector("#spin-count");
const reachCountElement = document.querySelector("#reach-count");
const jackpotCountElement = document.querySelector("#jackpot-count");
const jackpotRateElement = document.querySelector("#jackpot-rate");
const holdCountElement = document.querySelector("#hold-count");
const holdLamps = [...document.querySelectorAll("#hold-lamps i")];

const pegs = [];
for (let row = 0; row < 10; row++) {
  for (let column = 0; column < 8; column++) {
    const x = 43 + column * 48 + (row % 2 ? 24 : 0);
    const y = 105 + row * 47;
    // 大型液晶の周囲には釘を配置し、中央の画面領域は空ける。
    if (x > 88 && x < 332 && y > 160 && y < 365) continue;
    pegs.push({ x, y, radius: 4 });
  }
}

let balls = [];
let firing = false;
let previousTime = 0;
let animationId = 0;
let launchAccumulator = 0;
let spinCount = 0;
let reachCount = 0;
let jackpotCount = 0;
let holds = 0;
let spinning = false;
let lastLaunchAt = 0;

function updateStats() {
  spinCountElement.textContent = spinCount.toLocaleString();
  reachCountElement.textContent = reachCount.toLocaleString();
  jackpotCountElement.textContent = jackpotCount.toLocaleString();
  jackpotRateElement.textContent = spinCount
    ? `${(jackpotCount / spinCount * 100).toFixed(2)}%`
    : "0.00%";
}

function updateHolds() {
  holdCountElement.textContent = `${holds} / 4`;
  holdLamps.forEach((lamp, index) => lamp.classList.toggle("is-lit", index < holds));
}

function launchBall() {
  // 発射口から少しずつ角度を変えて玉を連続投入する。
  const angle = (Math.random() - 0.5) * 0.34;
  balls.push(createBall(210 + (Math.random() - 0.5) * 8, 48, Math.sin(angle) * 115, Math.cos(angle) * 15));
}

function addHold() {
  if (holds >= 4) {
    statusElement.textContent = "保留満タン！ 入賞しましたが保留は増えません";
    return;
  }
  holds += 1;
  updateHolds();
  statusElement.textContent = "ヘソ入賞！ 抽選を保留しました";
  processQueue();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function spinReel(element, finalSymbol, duration) {
  return new Promise(resolve => {
    const symbols = ["1","2","3","4","5","6","7","8","9","S"];
    element.classList.add("reel--spinning");
    element.classList.remove("reel--jackpot");
    let index = 0;
    const interval = setInterval(() => {
      element.textContent = symbols[index++ % symbols.length];
    }, 65);
    setTimeout(() => {
      clearInterval(interval);
      element.textContent = finalSymbol;
      element.classList.remove("reel--spinning");
      element.classList.add("reel--stopped");
      setTimeout(() => element.classList.remove("reel--stopped"), 260);
      resolve();
    }, duration);
  });
}

async function playOutcome(outcome) {
  spinning = true;
  resultElement.textContent = "変動中…";
  resultElement.classList.remove("result-label--jackpot");
  routeElement.textContent = "変動開始";
  // 左 → 右 → 中央の順。配列の並びは左・中央・右。
  const [left, center, right] = outcome.symbols;
  const spinPromises = reelElements.map(element => {
    element.textContent = "1";
    element.classList.add("reel--spinning");
  });
  await sleep(420);
  await spinReel(reelElements[0], left, 720);
  await sleep(220);
  await spinReel(reelElements[2], right, 760);

  if (outcome.reach) {
    routeElement.textContent = outcome.routeLabel;
    resultElement.textContent = "リーチ！";
    resultElement.classList.add(`route--${outcome.route}`);
    await showEffect(statusElement, outcome, 900);
    await sleep(outcome.route === "sp-reach" ? 650 : 350);
  } else {
    routeElement.textContent = "通常変動";
    await sleep(180);
  }

  await spinReel(reelElements[1], center, outcome.rainbowHold ? 1500 : outcome.route === "sp-reach" ? 1100 : 780);
  reelElements.forEach(element => {
    element.classList.remove("reel--jackpot");
    if (outcome.type === "jackpot") element.classList.add("reel--jackpot");
  });

  routeElement.textContent = outcome.rainbowHold ? "虹保留 → 確定全回転" : outcome.routeLabel;
  resultElement.textContent = outcome.type === "jackpot" ? "大当たり！" : "はずれ";
  resultElement.classList.toggle("result-label--jackpot", outcome.type === "jackpot");
  if (outcome.type === "jackpot") {
    statusElement.textContent = "大当たり！ おめでとう！";
  } else {
    statusElement.textContent = "変動終了。次の入賞を待っています";
  }

  spinCount += 1;
  if (outcome.reach) reachCount += 1;
  if (outcome.type === "jackpot") jackpotCount += 1;
  updateStats();
  spinning = false;
  processQueue();
}

async function processQueue() {
  if (spinning || holds <= 0) return;
  holds -= 1;
  updateHolds();
  await playOutcome(drawOutcome());
}

function drawMachine() {
  if (!context || !canvas) return;
  const ctx = context;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 外枠・盤面ガラス
  const bg = ctx.createLinearGradient(0, 0, 420, 640);
  bg.addColorStop(0, "#172b46");
  bg.addColorStop(0.55, "#0c1729");
  bg.addColorStop(1, "#263b58");
  ctx.fillStyle = bg;
  ctx.fillRect(9, 9, 402, 622);
  ctx.strokeStyle = "#d0b36b";
  ctx.lineWidth = 5;
  ctx.strokeRect(14, 14, 392, 612);
  ctx.strokeStyle = "#6f8bad";
  ctx.lineWidth = 1;
  ctx.strokeRect(23, 23, 374, 594);

  // 上部装飾・発射レール
  ctx.fillStyle = "#d6b86e";
  ctx.fillRect(175, 30, 70, 9);
  ctx.fillStyle = "#e8efff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AKITA PREMIUM", 210, 64);

  // 大型液晶の筐体
  const screen = ctx.createLinearGradient(90, 160, 330, 360);
  screen.addColorStop(0, "#3b234f");
  screen.addColorStop(0.5, "#142c52");
  screen.addColorStop(1, "#482b4b");
  ctx.fillStyle = "#d7b76b";
  ctx.fillRect(78, 151, 264, 222);
  ctx.fillStyle = screen;
  ctx.fillRect(85, 158, 250, 208);
  ctx.strokeStyle = "#f4d58c";
  ctx.lineWidth = 2;
  ctx.strokeRect(91, 164, 238, 196);
  ctx.fillStyle = "rgba(255,255,255,.10)";
  ctx.beginPath();
  ctx.moveTo(100, 170); ctx.lineTo(220, 170); ctx.lineTo(160, 355); ctx.lineTo(100, 355);
  ctx.fill();
  ctx.fillStyle = "#f5d98f";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("AKITA CHANCE", 210, 145);

  // 釘・風車
  for (const peg of pegs) {
    ctx.fillStyle = "#536b87";
    ctx.beginPath(); ctx.arc(peg.x + 1, peg.y + 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8edf5";
    ctx.beginPath(); ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(peg.x - 1, peg.y - 1, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  // 左右の風車風パーツ
  for (const x of [54, 366]) {
    ctx.save(); ctx.translate(x, 390); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#e5bd65"; ctx.fillRect(-3, -15, 6, 30); ctx.fillRect(-15, -3, 30, 6);
    ctx.restore();
  }

  // 入賞口とヘソ
  ctx.fillStyle = "#d9b45e";
  ctx.fillRect(151, 548, 118, 15);
  ctx.fillStyle = "#111a2b";
  ctx.fillRect(163, 551, 94, 9);
  ctx.fillStyle = "#ffe39a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("START / HESO", 210, 540);
  ctx.fillStyle = "#d8e4f7";
  ctx.fillRect(58, 520, 42, 8);
  ctx.fillRect(320, 520, 42, 8);
  ctx.font = "10px sans-serif";
  ctx.fillText("入賞口", 79, 513);
  ctx.fillText("入賞口", 341, 513);
  ctx.fillStyle = "#080d17";
  ctx.fillRect(177, 584, 66, 20);
  ctx.fillStyle = "#a7b8d0";
  ctx.fillText("OUT", 210, 598);

  // 玉の描画
  for (const ball of balls) {
    const shine = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.radius + 1);
    shine.addColorStop(0, "#ffffff");
    shine.addColorStop(0.45, "#dce5f0");
    shine.addColorStop(1, "#6f8299");
    ctx.fillStyle = shine;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill();
  }
}

function animate(time) {
  const delta = previousTime ? Math.min((time - previousTime) / 1000, 1 / 30) : 0;
  previousTime = time;
  launchAccumulator += delta;

  if (firing && launchAccumulator >= 0.34) {
    launchAccumulator = 0;
    launchBall();
  }

  balls = balls.filter(ball => {
    const alive = stepBall(ball, { width: canvas.width, height: 610 }, pegs, delta);
    if (!alive) return false;
    // ヘソの入賞エリアに到達した玉は入賞扱い。
    if (ball.y >= 542 && ball.x >= 160 && ball.x <= 260) {
      addHold();
      return false;
    }
    // 盤面下部・左右のアウトへ抜けた玉は回収。
    if (ball.y > 610 || ball.x < 24 || ball.x > 396) return false;
    return true;
  });

  drawMachine();
  if (firing || balls.length || spinning || holds > 0) {
    animationId = requestAnimationFrame(animate);
  } else {
    animationId = 0;
  }
}

function ensureAnimation() {
  if (!animationId) {
    previousTime = 0;
    animationId = requestAnimationFrame(animate);
  }
}

startButton?.addEventListener("click", () => {
  firing = !firing;
  startButton.textContent = firing ? "打ち出し OFF" : "打ち出し ON";
  startButton.classList.toggle("is-firing", firing);
  startButton.setAttribute("aria-pressed", String(firing));
  statusElement.textContent = firing
    ? "打ち出し中… ヘソ入賞で抽選します"
    : "打ち出し停止。盤面の玉と保留はそのままです";
  if (firing) ensureAnimation();
});

drawMachine();
updateStats();
updateHolds();