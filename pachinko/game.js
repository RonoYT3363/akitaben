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
// 実機風の密な千鳥配置。液晶まわりとヘソの入口だけを避ける。
for (let row = 0; row < 17; row++) {
  const y = 88 + row * 27;
  for (let column = 0; column < 15; column++) {
    const x = 34 + column * 25 + (row % 2 ? 12 : 0);
    if (x > 395 || y > 535) continue;
    // 大型液晶の領域は避け、左右の脇と下側に釘を密集させる。
    if (x > 72 && x < 348 && y > 145 && y < 382) continue;
    // ヘソ直前には玉が通れる細い入賞ルートを残す。
    if (y > 505 && x > 157 && x < 263) continue;
    const jitterX = (Math.random() - 0.5) * 3;
    const jitterY = (Math.random() - 0.5) * 3;
    pegs.push({ x: x + jitterX, y: y + jitterY, radius: 3.2 });
  }
}
// 左下から中央ヘソへ向かう導線の両脇にガイド釘を追加。
for (let i = 0; i < 6; i++) {
  pegs.push({ x: 82 + i * 13, y: 465 + i * 10, radius: 3.5 });
  pegs.push({ x: 270 - i * 9, y: 465 + i * 10, radius: 3.5 });
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
  // 左側から右方向へ打ち出し、重力と釘で盤面中央下部へ流す。
  const vx = 265 + (Math.random() - 0.5) * 24;
  const vy = -125 + (Math.random() - 0.5) * 16;
  balls.push(createBall(48 + (Math.random() - 0.5) * 4, 72, vx, vy));
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

function beginReel(element) {
  const symbols = ["1","2","3","4","5","6","7","8","9","S"];
  // 前回転の停止図柄をそのまま残して回転開始する。
  let index = Math.max(0, symbols.indexOf(element.textContent.trim()));
  element.classList.add("reel--spinning");
  element.classList.remove("reel--jackpot", "reel--stopped");
  const interval = setInterval(() => {
    index = (index + 1) % symbols.length;
    element.textContent = symbols[index];
  }, 65);

  return (finalSymbol, duration) => new Promise(resolve => {
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

async function playOutcome(outcome, queuedHolds = 0) {
  spinning = true;
  // 保留が多いほど変動テンポを上げる（最大約45%短縮）。
  const speed = Math.max(0.55, 1 - queuedHolds * 0.15);
  const wait = ms => sleep(ms * speed);
  resultElement.textContent = "変動中…";
  resultElement.classList.remove("result-label--jackpot");
  routeElement.textContent = "変動開始";
  // 左・中央・右を同時に回し始め、停止だけ左→右→中央の順に見せる。
  const [left, center, right] = outcome.symbols;
  const stopLeft = beginReel(reelElements[0]);
  const stopCenter = beginReel(reelElements[1]);
  const stopRight = beginReel(reelElements[2]);

  await wait(420);
  await stopLeft(left, 720 * speed);
  await wait(220);
  await stopRight(right, 760 * speed);

  if (outcome.reach) {
    routeElement.textContent = outcome.routeLabel;
    resultElement.textContent = "リーチ！";
    resultElement.classList.add(`route--${outcome.route}`);
    await showEffect(statusElement, outcome, 900 * speed);
    await wait(outcome.route === "sp-reach" ? 650 : 350);
  } else {
    routeElement.textContent = "通常変動";
    await wait(180);
  }

  await stopCenter(center, (outcome.rainbowHold ? 1500 : outcome.route === "sp-reach" ? 1100 : 780) * speed);
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
  // 全リール停止後、停止図柄を約1秒見せてから次の変動へ。
  await sleep(1000);
  spinning = false;
  processQueue();
}

async function processQueue() {
  if (spinning || holds <= 0) return;
  holds -= 1;
  updateHolds();
  await playOutcome(drawOutcome(), holds);
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