import { createBall, stepBall, setPhysicsConfig, resolveBallCollisions } from "./physics.js";
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
const spentElement=document.querySelector("#spent-count");
const paidElement=document.querySelector("#paid-count");
const netElement=document.querySelector("#net-count");
const payoutRateElement=document.querySelector("#payout-rate");
const roundElement=document.querySelector("#round-progress");
const rushHoldCountElement=document.querySelector("#rush-hold-count");
const rushHoldLamps=[...document.querySelectorAll("#rush-hold-lamps i")];
const rushTestButton=document.querySelector("#rush-test-button");

const STORAGE_KEY = "akitaPachinkoBoardV1";
const BOARD_WIDTH = 600;
const SCALE_X = BOARD_WIDTH / 420;
const defaultPegs = [];
// 初期盤面。エディターで保存した配置があればそちらを優先します。
for (let row = 0; row < 17; row++) {
  const y = 88 + row * 27;
  for (let column = 0; column < 15; column++) {
    const x = (34 + column * 25 + (row % 2 ? 12 : 0)) * SCALE_X;
    if (x > BOARD_WIDTH - 25 || y > 535) continue;
    if (x > 72 * SCALE_X && x < 348 * SCALE_X && y > 145 && y < 382) continue;
    if (y > 505 && x > 157 * SCALE_X && x < 263 * SCALE_X) continue;
    defaultPegs.push({ x: x + (Math.random() - 0.5) * 3 * SCALE_X, y: y + (Math.random() - 0.5) * 3, radius: 3.2 });
  }
}
for (let i = 0; i < 6; i++) {
  defaultPegs.push({ x: (82 + i * 13) * SCALE_X, y: 465 + i * 10, radius: 3.5 });
  defaultPegs.push({ x: (270 - i * 9) * SCALE_X, y: 465 + i * 10, radius: 3.5 });
}
let boardConfig = null;
try {
  boardConfig = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (boardConfig && boardConfig.version < 2) {
    boardConfig.pegs?.forEach(peg => peg.x *= SCALE_X);
    if (boardConfig.launcher) boardConfig.launcher.x *= SCALE_X;
    boardConfig.version = 2;
  }
} catch {
  boardConfig = null;
}
const pegs = Array.isArray(boardConfig?.pegs) ? boardConfig.pegs : defaultPegs;
const physicsConfig = boardConfig?.physics || {};
const launcher = { x: 48 * SCALE_X, y: 72, vx: 265, vy: -125, intervalMs: 340, ...(boardConfig?.launcher || {}) };
const hesoHitbox = boardConfig?.hitbox || { x: 228.6, y: 542, width: 142.9, height: 20 };
const attackerBox=boardConfig?.attacker||{x:230,y:478,width:140,height:30,rotation:0};
const rushSwitch=boardConfig?.rushSwitch||{x:250,y:420,width:100,height:18,rotation:0};
setPhysicsConfig(physicsConfig);
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
let totalSpent=0,totalPaid=0;
let outcomeQueue=[];
let rainbowActive=false;
let jackpotActive=false;
let attackerOpen=false;
let attackerHits=0;
let jackpotRoundTarget=0;
let completedRounds=0;
let attackerReopenAt=0;
let rushActive=false;
let rushHolds=0;
let rushRoundsRemaining=0;
let rushProcessing=false;

function updatePayoutStats(){const net=totalPaid-totalSpent;spentElement.textContent=totalSpent.toLocaleString();paidElement.textContent=totalPaid.toLocaleString();netElement.textContent=(net>0?"+":"")+net.toLocaleString();payoutRateElement.textContent=totalSpent?`${(totalPaid/totalSpent*100).toFixed(2)}%`:"—";roundElement.textContent=jackpotActive?`${completedRounds}/${jackpotRoundTarget}R（${attackerHits}/10）`:rushActive?`Rush 残り ${rushRoundsRemaining}R`:"—";}

function updateStats() {
  spinCountElement.textContent = spinCount.toLocaleString();
  reachCountElement.textContent = reachCount.toLocaleString();
  jackpotCountElement.textContent = jackpotCount.toLocaleString();
  jackpotRateElement.textContent = spinCount
    ? `${(jackpotCount / spinCount * 100).toFixed(2)}%`
    : "0.00%";
  updatePayoutStats();
}

function updateHolds() {
  holdCountElement.textContent = `${holds} / 4`;
  holdLamps.forEach((lamp, index) => lamp.classList.toggle("is-lit", index < holds));
}

function launchBall() {
  // 左側から右方向へ打ち出し、重力と釘で盤面中央下部へ流す。
  const vx = (launcher.vx ?? 265) + (Math.random() - 0.5) * 24;
  const vy = (launcher.vy ?? -125) + (Math.random() - 0.5) * 16;
  balls.push(createBall((launcher.x ?? 48) + (Math.random() - 0.5) * 4, launcher.y ?? 72, vx, vy));
  totalSpent+=1;updatePayoutStats();
}

function addHold() {
  if (holds >= 4) {
    statusElement.textContent = "保留満タン！ 入賞しましたが保留は増えません";
    return;
  }
  holds += 1;
  outcomeQueue.push(drawOutcome());
  updateHolds();
  statusElement.textContent = "ヘソ入賞！ 抽選結果を保留しました";
  processQueue();
}

function getRoundCount(symbol){if(["2","4","6","8"].includes(symbol))return 5;if(["1","5","9"].includes(symbol))return 10;if(["3","7"].includes(symbol))return 20;return [30,40,50][Math.floor(Math.random()*3)];}
function startJackpot(outcome){const symbol=outcome.symbols[0];jackpotRoundTarget=getRoundCount(symbol);completedRounds=0;attackerHits=0;attackerOpen=true;jackpotActive=true;attackerReopenAt=0;statusElement.textContent=`${symbol}図柄大当たり！ ${jackpotRoundTarget}R・10C15`;updatePayoutStats();ensureAnimation();}
function registerAttackerHit(){if(!jackpotActive||!attackerOpen)return;attackerHits+=1;totalPaid+=15;if(attackerHits>=10){completedRounds+=1;attackerHits=0;attackerOpen=false;if(completedRounds>=jackpotRoundTarget){jackpotActive=false;attackerReopenAt=0;statusElement.textContent=`大当たり終了！ ${jackpotRoundTarget*150}玉払い出し`;processQueue();}else{attackerReopenAt=performance.now()+450;statusElement.textContent=`${completedRounds}R終了。次のラウンドへ`;}}updatePayoutStats();}

function updateRushHolds(){
  if(rushHoldCountElement)rushHoldCountElement.textContent=`${rushHolds} / 4`;
  rushHoldLamps.forEach((lamp,index)=>lamp.classList.toggle("is-lit",index<rushHolds));
}
function pointInRotatedBox(point,box){
  const angle=-(Number(box.rotation)||0)*Math.PI/180;
  const dx=point.x-(box.x+box.width/2),dy=point.y-(box.y+box.height/2);
  const x=dx*Math.cos(angle)-dy*Math.sin(angle),y=dx*Math.sin(angle)+dy*Math.cos(angle);
  return Math.abs(x)<=box.width/2&&Math.abs(y)<=box.height/2;
}
function addRushHold(){
  if(!rushActive||rushHolds>=4)return;
  rushHolds++;updateRushHolds();statusElement.textContent="Rushスルー通過！ 赤保留を獲得";
  processRushRound();
}
function beginRush(initialRounds=10){
  rushActive=true;rushHolds=0;rushRoundsRemaining=initialRounds;rushProcessing=false;
  updateRushHolds();statusElement.textContent=`通常Rush開始！ ${initialRounds}Rスタート。スルー保留を待っています`;
  if(rushTestButton)rushTestButton.textContent="Rush終了";
  ensureAnimation();
}
function endRush(){
  rushActive=false;rushHolds=0;rushProcessing=false;updateRushHolds();
  if(rushTestButton)rushTestButton.textContent="Rushテスト開始（10R）";
  statusElement.textContent="通常Rush終了！";
}
function processRushRound(){
  if(!rushActive||rushProcessing||rushHolds<=0)return;
  if(rushRoundsRemaining<=0){endRush();return;}
  rushProcessing=true;rushHolds--;rushRoundsRemaining--;updateRushHolds();
  const roll=Math.random();let label="ハズレ";let bonus=0;
  if(roll>=0.50&&roll<0.854){label="偶数 +1R";bonus=1;}
  else if(roll>=0.854&&roll<0.954){
    label="159 +1R";bonus=1;
    let loops=0;while(Math.random()<0.60){bonus++;loops++;}
    label+=`（60%ループ ${loops}回）`;
  }else if(roll>=0.954){label="3・7 +5R";bonus=5;}
  rushRoundsRemaining+=bonus;
  statusElement.textContent=`Rush：${label} ／ 残り ${rushRoundsRemaining}R`;
  updatePayoutStats();
  setTimeout(()=>{
    rushProcessing=false;
    if(rushRoundsRemaining<=0){endRush();return;}
    if(rushHolds>0)processRushRound();
  },350);
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
    statusElement.textContent = "大当たり！ 虹色演出中…";
    rainbowActive=true;
    await sleep(3000);
    rainbowActive=false;
    startJackpot(outcome);
  } else {
    statusElement.textContent = "変動終了。次の入賞を待っています";
  }

  spinCount += 1;
  if (outcome.reach) reachCount += 1;
  if (outcome.type === "jackpot") jackpotCount += 1;
  updateStats();
  // 通常時は停止図柄を約1秒表示。大当たり時は3秒の虹演出後にアタッカーへ移行。
  if(outcome.type!=="jackpot") await sleep(1000);
  spinning = false;
  processQueue();
}

async function processQueue() {
  if (spinning || jackpotActive || holds <= 0) return;
  holds -= 1;
  updateHolds();
  const outcome=outcomeQueue.shift() || drawOutcome();
  await playOutcome(outcome, holds);
}

function drawMachine() {
  if (!context || !canvas) return;
  const ctx = context;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(SCALE_X, 1);

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
  if(rainbowActive){const hue=(performance.now()/9)%360;const rainbow=ctx.createLinearGradient(85,158,335,366);for(let i=0;i<=6;i++)rainbow.addColorStop(i/6,`hsl(${(hue+i*55)%360} 100% 58%)`);ctx.save();ctx.beginPath();ctx.rect(85,158,250,208);ctx.clip();ctx.globalAlpha=.72;ctx.fillStyle=rainbow;ctx.shadowColor="#fff";ctx.shadowBlur=28;ctx.fillRect(85,158,250,208);ctx.globalAlpha=1;ctx.fillStyle="#fff";ctx.font="bold 28px sans-serif";ctx.shadowBlur=14;ctx.fillText("大当たり！",210,275);ctx.restore();}

  // 釘は600px座標のまま、静的な筐体アートとは別スケールで描画する。
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

  ctx.restore();
  ctx.save();ctx.translate(attackerBox.x+attackerBox.width/2,attackerBox.y+attackerBox.height/2);ctx.rotate((Number(attackerBox.rotation)||0)*Math.PI/180);ctx.fillStyle=attackerOpen?"rgba(255,75,75,.75)":"rgba(110,125,145,.55)";ctx.fillRect(-attackerBox.width/2,-attackerBox.height/2,attackerBox.width,attackerBox.height);ctx.strokeStyle=attackerOpen?"#fff1a8":"#aab6c8";ctx.lineWidth=2;ctx.strokeRect(-attackerBox.width/2,-attackerBox.height/2,attackerBox.width,attackerBox.height);ctx.fillStyle="#fff";ctx.font="bold 12px sans-serif";ctx.textAlign="center";ctx.fillText(attackerOpen?`アタッカー OPEN ${attackerHits}/10`:"アタッカー",0,4);ctx.restore();
  ctx.save();ctx.translate(rushSwitch.x+rushSwitch.width/2,rushSwitch.y+rushSwitch.height/2);ctx.rotate((Number(rushSwitch.rotation)||0)*Math.PI/180);ctx.fillStyle=rushActive?"#d92345":"#7e3445";ctx.strokeStyle="#ffd6df";ctx.lineWidth=2;ctx.fillRect(-rushSwitch.width/2,-rushSwitch.height/2,rushSwitch.width,rushSwitch.height);ctx.strokeRect(-rushSwitch.width/2,-rushSwitch.height/2,rushSwitch.width,rushSwitch.height);ctx.fillStyle="#fff";ctx.font="bold 10px sans-serif";ctx.textAlign="center";ctx.fillText("RUSH THROUGH",0,4);ctx.restore();
  // 釘と玉は盤面の600×640座標で描画する。
  for (const peg of pegs) {
    ctx.fillStyle = "#536b87";
    ctx.beginPath(); ctx.arc(peg.x + 1, peg.y + 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e8edf5";
    ctx.beginPath(); ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(peg.x - 1, peg.y - 1, 1.5, 0, Math.PI * 2); ctx.fill();
  }
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

  const launchInterval = Math.max(50, Number(launcher.intervalMs) || 340) / 1000;
  if (firing && launchAccumulator >= launchInterval) {
    launchAccumulator %= launchInterval;
    launchBall();
  }

  // まず全玉を個別に進め、その後に玉同士の衝突をまとめて解決する。
  balls = balls.filter(ball => stepBall(ball, { width: BOARD_WIDTH, height: 610 }, pegs, delta));
  resolveBallCollisions(balls);
  if(attackerReopenAt && time>=attackerReopenAt){attackerReopenAt=0;attackerOpen=true;statusElement.textContent=`${completedRounds+1}R開始`;updatePayoutStats();}
  balls = balls.filter(ball => {
    if(attackerOpen&&pointInRotatedBox(ball,attackerBox)){registerAttackerHit();return false;}
    if(rushActive&&pointInRotatedBox(ball,rushSwitch)){addRushHold();return false;}
    // ヘソの入賞エリアに到達した玉は入賞扱い。
    if (pointInRotatedBox(ball,hesoHitbox)) {
      addHold();
      return false;
    }
    // 盤面下部・左右のアウトへ抜けた玉は回収。
    if (ball.y > 610 || ball.x < 24 * SCALE_X || ball.x > 396 * SCALE_X) return false;
    return true;
  });

  drawMachine();
  if (firing || balls.length || spinning || holds > 0 || jackpotActive || attackerReopenAt || rainbowActive || rushActive) {
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

rushTestButton?.addEventListener("click",()=>{
  if(rushActive){endRush();return;}
  beginRush(10);
});
drawMachine();
updateStats();
updateHolds();
updateRushHolds();