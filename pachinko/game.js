import { createBall, stepBall } from "./physics.js";
import { drawOutcome } from "./lottery.js";
import { showEffect } from "./effects/effects.js";

const canvas = document.querySelector("#machine-canvas");
const context = canvas?.getContext("2d");
const startButton = document.querySelector("#start-button");
const rateInput = document.querySelector("#rate");
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

const pegs = [];
for (let row = 0; row < 8; row++) {
  for (let column = 0; column < 7; column++) {
    pegs.push({
      x: 48 + column * 54 + (row % 2 ? 27 : 0),
      y: 150 + row * 48,
      radius: 4
    });
  }
}

let ball = null;
let previousTime = 0;
let animationId = 0;
let spinCount = 0;
let reachCount = 0;
let jackpotCount = 0;

function updateStats() {
  spinCountElement.textContent = spinCount.toLocaleString();
  reachCountElement.textContent = reachCount.toLocaleString();
  jackpotCountElement.textContent = jackpotCount.toLocaleString();
  jackpotRateElement.textContent = spinCount
    ? `${(jackpotCount / spinCount * 100).toFixed(2)}%`
    : "0.00%";
}

function displayOutcome(outcome) {
  reelElements.forEach((element, index) => {
    element.textContent = outcome.symbols[index];
    element.classList.toggle("reel--jackpot", outcome.type === "jackpot");
  });

  routeElement.textContent = outcome.rainbowHold
    ? "虹保留 → 確定全回転"
    : outcome.routeLabel;
  resultElement.textContent = outcome.type === "jackpot" ? "大当たり！" : "はずれ";
  resultElement.classList.toggle("result-label--jackpot", outcome.type === "jackpot");

  spinCount += 1;
  if (outcome.reach) reachCount += 1;
  if (outcome.type === "jackpot") jackpotCount += 1;
  updateStats();
  showEffect(statusElement, outcome);
}

function draw() {
  if (!context || !canvas) return;
  context.clearRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#263653";
  context.fillRect(18, 18, canvas.width - 36, canvas.height - 36);

  context.fillStyle = "#d5def5";
  for (const peg of pegs) {
    context.beginPath();
    context.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#ffc857";
  context.fillRect(160, 590, 100, 18);
  context.fillStyle = "#ffffff";
  context.font = "12px sans-serif";
  context.textAlign = "center";
  context.fillText("入賞口（仮）", 210, 582);

  if (ball) {
    context.fillStyle = "#f4f7ff";
    context.beginPath();
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    context.fill();
  }
}

function animate(time) {
  const delta = previousTime ? (time - previousTime) / 1000 : 0;
  previousTime = time;

  if (ball) {
    const alive = stepBall(ball, { width: canvas.width, height: canvas.height }, pegs, delta);
    if (!alive) {
      ball = null;
      cancelAnimationFrame(animationId);
      displayOutcome(drawOutcome());
      startButton.disabled = false;
    }
  }

  draw();
  if (ball) animationId = requestAnimationFrame(animate);
}

startButton?.addEventListener("click", () => {
  const rate = Number(rateInput?.value);
  if (!Number.isSafeInteger(rate) || rate < 1) {
    statusElement.textContent = "レートは1以上の整数にしてください";
    return;
  }

  // テスト専用。既存のAkita Token残高にはまだ接続しない。
  statusElement.textContent = `レート ${rate.toLocaleString()} Token／回転・玉を発射中…`;
  startButton.disabled = true;
  resultElement.textContent = "抽選中…";
  resultElement.classList.remove("result-label--jackpot");
  ball = createBall(canvas.width / 2, 48, (Math.random() - 0.5) * 90, 0);
  previousTime = 0;
  animationId = requestAnimationFrame(animate);
});

draw();
updateStats();
