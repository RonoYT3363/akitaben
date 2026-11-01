import { createBall, stepBall } from "./physics.js";
import { drawOutcome } from "./lottery.js";
import { showEffect } from "./effects/effects.js";

const canvas = document.querySelector("#machine-canvas");
const context = canvas?.getContext("2d");
const startButton = document.querySelector("#start-button");
const rateInput = document.querySelector("#rate");
const statusElement = document.querySelector("#status");

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
      const outcome = drawOutcome();
      showEffect(statusElement, outcome);
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

  // ここでは物理演算の試作のみ。Token残高の読み書きはまだ行いません。
  statusElement.textContent = `レート ${rate.toLocaleString()} Token／回転・玉を発射中…`;
  startButton.disabled = true;
  ball = createBall(canvas.width / 2, 48, (Math.random() - 0.5) * 90, 0);
  previousTime = 0;
  animationId = requestAnimationFrame(animate);
});

draw();
