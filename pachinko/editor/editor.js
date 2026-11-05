import { createBall, stepBall, setPhysicsConfig, resolveBallCollisions } from "../physics.js";
import { SYMBOLS } from "../config.js";

const STORAGE_KEY = "akitaPachinkoBoardV1";
const BOARD_WIDTH = 600;
const BOARD_HEIGHT = 640;
const SCALE_X = BOARD_WIDTH / 420;
const canvas = document.querySelector("#editor-canvas");
const ctx = canvas.getContext("2d");
const $ = selector => document.querySelector(selector);
const defaultPegs = makeDefaultPegs();
const initialConfig = loadInitialConfig();
let pegs = initialConfig?.pegs ? initialConfig.pegs.map(p => ({...p})) : makeDefaultPegs();
let tool = "place";
let selected = -1;
let dirty = false;
let balls = [];
let previewFrame = 0;
let lastPreviewTime = 0;
let previewLaunchAccumulator = 0;
let previewing = false;
let settings = { gravity: initialConfig?.physics?.gravity ?? 520, restitution: initialConfig?.physics?.restitution ?? 0.72, launchX: initialConfig?.launcher?.x ?? 48*SCALE_X, launchY: initialConfig?.launcher?.y ?? 72, launchVx: initialConfig?.launcher?.vx ?? 265, launchVy: initialConfig?.launcher?.vy ?? -125, normalStrength: initialConfig?.launchStrengths?.normal ?? 50, roundStrength: initialConfig?.launchStrengths?.round ?? 90, rushStrength: initialConfig?.launchStrengths?.rush ?? 85 };
let launchIntervalMs = initialConfig?.launcher?.intervalMs ?? 340;
const symbolDefaults=Object.fromEntries(SYMBOLS.map(s=>[s.value,s.weight]));
const reachSymbolDefaults=Object.fromEntries(SYMBOLS.map(s=>[s.value,s.weight*s.weight]));
let lotterySettings={jackpotDenominator:initialConfig?.lottery?.jackpotDenominator??52,symbolWeights:{...symbolDefaults,...(initialConfig?.lottery?.symbolWeights||{})},reachSymbolWeights:{...reachSymbolDefaults,...(initialConfig?.lottery?.reachSymbolWeights||{})}};

function makeDefaultPegs() {
  const result = [];
  for (let row=0; row<17; row++) {
    const y=88+row*27;
    for (let column=0; column<15; column++) {
      const x=(34+column*25+(row%2?12:0))*SCALE_X;
      if(x>BOARD_WIDTH-25||y>535)continue;
      if(x>72*SCALE_X&&x<348*SCALE_X&&y>145&&y<382)continue;
      if(y>505&&x>157*SCALE_X&&x<263*SCALE_X)continue;
      result.push({x:x+(Math.random()-.5)*3*SCALE_X,y:y+(Math.random()-.5)*3,radius:3.2});
    }
  }
  for(let i=0;i<6;i++){result.push({x:(82+i*13)*SCALE_X,y:465+i*10,radius:3.5});result.push({x:(270-i*9)*SCALE_X,y:465+i*10,radius:3.5});}
  return result;
}
function loadInitialConfig(){try{const config=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(config&&config.version<2){config.pegs?.forEach(peg=>peg.x*=SCALE_X);if(config.launcher)config.launcher.x*=SCALE_X;config.version=2;}return config;}catch{return null;}}
function markDirty(){dirty=true;$("#save-state").textContent="未保存の変更あり";$("#message").textContent="変更があります。保存するとシミュレーターに反映されます。";updateCounts();}
function updateCounts(){$("#peg-count").textContent=`釘 ${pegs.length} 本`;}
function updateSelection(){const peg=pegs[selected];$("#selection-label").textContent=peg? `X: ${peg.x.toFixed(1)} / Y: ${peg.y.toFixed(1)}`:"釘が選択されていません";$("#delete-selected").disabled=!peg;if(peg){$("#peg-radius").value=peg.radius;$("#peg-radius-value").textContent=peg.radius.toFixed(1);}}
function getPoint(event){const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};}
function nearestPeg(point){let best=-1,bestDistance=25;pegs.forEach((peg,index)=>{const d=Math.hypot(peg.x-point.x,peg.y-point.y);if(d<bestDistance){best=index;bestDistance=d;}});return best;}
function makeShapePegs(start,end){
  const type=$("#shape-type").value,spacing=Number($("#shape-spacing").value)||18;
  const left=Math.min(start.x,end.x),right=Math.max(start.x,end.x),top=Math.min(start.y,end.y),bottom=Math.max(start.y,end.y);
  const width=right-left,height=bottom-top,points=[],radius=Number($("#peg-radius").value)||3.2;
  if(width<spacing&&height<spacing)return [];
  if(type==="line"){
    const distance=Math.hypot(end.x-start.x,end.y-start.y),count=Math.max(1,Math.floor(distance/spacing));
    for(let i=0;i<=count;i++){const t=i/count;points.push({x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t,radius});}
  }else{
    const cols=Math.max(1,Math.floor(width/spacing)),rows=Math.max(1,Math.floor(height/spacing));
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const x=left+(cols?col/cols:0)*width,y=top+(rows?row/rows:0)*height;
      const nx=width?(x-left)/width:.5,ny=height?(y-top)/height:.5;
      let inside=false;
      if(type==="rectangle")inside=true;
      else if(type==="circle")inside=((nx-.5)/.5)**2+((ny-.5)/.5)**2<=1.0001;
      else if(type==="triangle")inside=ny>=0&&ny<=1&&Math.abs(nx-.5)<=ny*.5+0.0001;
      else if(type==="diamond")inside=Math.abs(nx-.5)*2+Math.abs(ny-.5)*2<=1.0001;
      if(inside)points.push({x,y,radius});
    }
  }
  return points.filter(p=>p.x>=15&&p.x<=BOARD_WIDTH-15&&p.y>=20&&p.y<=620);
}
$("#shape-size").addEventListener("input",e=>$("#shape-size-value").textContent=e.target.value);
$("#shape-spacing").addEventListener("input",e=>$("#shape-spacing-value").textContent=e.target.value);

function drawEditBoxHandles(box,color){ctx.fillStyle=color;for(const [x,y] of [[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]]){ctx.fillRect(x-4,y-4,8,8);ctx.strokeStyle="#172033";ctx.lineWidth=1;ctx.strokeRect(x-4,y-4,8,8);}}
function drawBoard(){ctx.clearRect(0,0,BOARD_WIDTH,BOARD_HEIGHT);ctx.save();ctx.scale(SCALE_X,1);const bg=ctx.createLinearGradient(0,0,420,640);bg.addColorStop(0,"#172b46");bg.addColorStop(.55,"#0c1729");bg.addColorStop(1,"#263b58");ctx.fillStyle=bg;ctx.fillRect(9,9,402,622);ctx.strokeStyle="#d0b36b";ctx.lineWidth=5;ctx.strokeRect(14,14,392,612);ctx.strokeStyle="#6f8bad";ctx.lineWidth=1;ctx.strokeRect(23,23,374,594);
  ctx.fillStyle="#d6b86e";ctx.fillRect(175,30,70,9);ctx.fillStyle="#e8efff";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillText("AKITA PREMIUM",210,64);
  const screen=ctx.createLinearGradient(90,160,330,360);screen.addColorStop(0,"#3b234f");screen.addColorStop(.5,"#142c52");screen.addColorStop(1,"#482b4b");ctx.fillStyle="#d7b76b";ctx.fillRect(78,151,264,222);ctx.fillStyle=screen;ctx.fillRect(85,158,250,208);ctx.strokeStyle="#f4d58c";ctx.lineWidth=2;ctx.strokeRect(91,164,238,196);ctx.fillStyle="#f5d98f";ctx.fillText("AKITA CHANCE",210,145);
  ctx.fillStyle="#d9b45e";ctx.fillRect(151,548,118,15);ctx.fillStyle="#111a2b";ctx.fillRect(163,551,94,9);ctx.fillStyle="#ffe39a";ctx.font="bold 12px sans-serif";ctx.fillText("START / HESO",210,540);ctx.fillStyle="#d8e4f7";ctx.fillRect(58,520,42,8);ctx.fillRect(320,520,42,8);ctx.font="10px sans-serif";ctx.fillText("入賞口",79,513);ctx.fillText("入賞口",341,513);ctx.fillStyle="#080d17";ctx.fillRect(177,584,66,20);ctx.fillStyle="#a7b8d0";ctx.fillText("OUT",210,598);
  if($("#grid-toggle").checked){ctx.save();ctx.strokeStyle="#ffffff12";ctx.lineWidth=1;for(let x=35;x<400;x+=25){ctx.beginPath();ctx.moveTo(x,25);ctx.lineTo(x,615);ctx.stroke();}for(let y=35;y<620;y+=25){ctx.beginPath();ctx.moveTo(25,y);ctx.lineTo(395,y);ctx.stroke();}ctx.restore();}
  ctx.restore();
  ctx.save();
  ctx.fillStyle="rgba(255,210,90,.16)";ctx.fillRect(hitbox.x,hitbox.y,hitbox.width,hitbox.height);
  ctx.strokeStyle="#ffd36b";ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(hitbox.x,hitbox.y,hitbox.width,hitbox.height);ctx.setLineDash([]);
  drawEditBoxHandles(hitbox,"#ffe08a");
  ctx.fillStyle="rgba(255,115,95,.20)";ctx.fillRect(attacker.x,attacker.y,attacker.width,attacker.height);
  ctx.strokeStyle="#ff9b83";ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.strokeRect(attacker.x,attacker.y,attacker.width,attacker.height);ctx.setLineDash([]);
  ctx.fillStyle="#ffd2c7";ctx.font="bold 12px sans-serif";ctx.textAlign="center";ctx.fillText("アタッカー 10C15",attacker.x+attacker.width/2,attacker.y-7);
  drawEditBoxHandles(attacker,"#ffb09d");
  pegs.forEach((peg,index)=>{ctx.fillStyle="#536b87";ctx.beginPath();ctx.arc(peg.x+1,peg.y+2,5,0,Math.PI*2);ctx.fill();ctx.fillStyle=index===selected?"#ffdf78":"#e8edf5";ctx.beginPath();ctx.arc(peg.x,peg.y,peg.radius,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(peg.x-1,peg.y-1,1.5,0,Math.PI*2);ctx.fill();if(index===selected){ctx.strokeStyle="#ffe17b";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(peg.x,peg.y,peg.radius+5,0,Math.PI*2);ctx.stroke();}});
  if(tool==="shape"&&shapeStart&&shapeCurrent){const x=Math.min(shapeStart.x,shapeCurrent.x),y=Math.min(shapeStart.y,shapeCurrent.y),w=Math.abs(shapeCurrent.x-shapeStart.x),h=Math.abs(shapeCurrent.y-shapeStart.y);ctx.save();ctx.strokeStyle="#7ee7ff";ctx.fillStyle="rgba(126,231,255,.10)";ctx.lineWidth=1.5;ctx.setLineDash([5,4]);if($("#shape-type").value==="circle"){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();}else if($("#shape-type").value==="triangle"){ctx.beginPath();ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.closePath();ctx.fill();ctx.stroke();}else if($("#shape-type").value==="diamond"){ctx.beginPath();ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h/2);ctx.lineTo(x+w/2,y+h);ctx.lineTo(x,y+h/2);ctx.closePath();ctx.fill();ctx.stroke();}else if($("#shape-type").value==="line"){ctx.beginPath();ctx.moveTo(shapeStart.x,shapeStart.y);ctx.lineTo(shapeCurrent.x,shapeCurrent.y);ctx.stroke();}else{ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);}ctx.restore();}
  balls.forEach(ball=>{ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(ball.x,ball.y,ball.radius,0,Math.PI*2);ctx.fill();});
  ctx.restore();
}
let dragging=false;
let placing=false;
let lastPlacementPoint=null;
let deleting=false;
let lastDeletionPoint=null;
let draggingHitbox=false;
let draggingAttacker=false;
let activeResize=null;
let attackerDragOffset={x:0,y:0};
let shapeStart=null;
let shapeCurrent=null;
let hitboxDragOffset={x:0,y:0};
const defaultHitbox={x:228.6,y:542,width:142.9,height:20};
let hitbox=initialConfig?.hitbox?{...defaultHitbox,...initialConfig.hitbox}:{...defaultHitbox};
const defaultAttacker={x:230,y:478,width:140,height:30};
let attacker=initialConfig?.attacker?{...defaultAttacker,...initialConfig.attacker}:{...defaultAttacker};
function getCorner(box,p){const corners=[["nw",box.x,box.y],["ne",box.x+box.width,box.y],["sw",box.x,box.y+box.height],["se",box.x+box.width,box.y+box.height]];for(const [name,x,y] of corners)if(Math.hypot(p.x-x,p.y-y)<13)return name;return null;}
function resizeBox(box,corner,p){const right=box.x+box.width,bottom=box.y+box.height,minW=24,minH=12;if(corner==="nw"){box.x=Math.max(0,Math.min(right-minW,p.x));box.y=Math.max(0,Math.min(bottom-minH,p.y));box.width=right-box.x;box.height=bottom-box.y;}if(corner==="ne"){box.y=Math.max(0,Math.min(bottom-minH,p.y));box.width=Math.max(minW,Math.min(BOARD_WIDTH-box.x,p.x-box.x));box.height=bottom-box.y;}if(corner==="sw"){box.x=Math.max(0,Math.min(right-minW,p.x));box.width=right-box.x;box.height=Math.max(minH,Math.min(BOARD_HEIGHT-box.y,p.y-box.y));}if(corner==="se"){box.width=Math.max(minW,Math.min(BOARD_WIDTH-box.x,p.x-box.x));box.height=Math.max(minH,Math.min(BOARD_HEIGHT-box.y,p.y-box.y));}}

canvas.addEventListener("pointerdown",event=>{const p=getPoint(event);if(tool==="shape"){shapeStart=p;shapeCurrent=p;canvas.setPointerCapture(event.pointerId);drawBoard();$("#message").textContent="ドラッグして図形の終点を指定してください";return;}if(tool==="place"||tool==="add"){placing=true;lastPlacementPoint=p;canvas.setPointerCapture(event.pointerId);pegs.push({x:p.x,y:p.y,radius:Number($("#peg-radius").value)||3.2});selected=pegs.length-1;markDirty();updateSelection();drawBoard();$("#message").textContent="ドラッグして釘を連続配置できます";return;}if(tool==="delete"){deleting=true;lastDeletionPoint=p;canvas.setPointerCapture(event.pointerId);const index=nearestPeg(p);if(index>=0){pegs.splice(index,1);selected=-1;markDirty();}updateSelection();drawBoard();$("#message").textContent="ドラッグして釘を連続削除できます";return;}const hitboxCorner=getCorner(hitbox,p);if(hitboxCorner){activeResize={target:"hitbox",corner:hitboxCorner};selected=-1;canvas.setPointerCapture(event.pointerId);$("#message").textContent="ヘソの角をドラッグしてサイズ変更できます";updateSelection();return;}
const attackerCorner=getCorner(attacker,p);if(attackerCorner){activeResize={target:"attacker",corner:attackerCorner};selected=-1;canvas.setPointerCapture(event.pointerId);$("#message").textContent="アタッカーの角をドラッグしてサイズ変更できます";updateSelection();return;}
if(p.x>=attacker.x&&p.x<=attacker.x+attacker.width&&p.y>=attacker.y&&p.y<=attacker.y+attacker.height){draggingAttacker=true;attackerDragOffset={x:p.x-attacker.x,y:p.y-attacker.y};selected=-1;canvas.setPointerCapture(event.pointerId);$("#message").textContent="アタッカーをドラッグして移動できます";updateSelection();return;}
if(p.x>=hitbox.x-8&&p.x<=hitbox.x+hitbox.width+8&&p.y>=hitbox.y-8&&p.y<=hitbox.y+hitbox.height+8){draggingHitbox=true;hitboxDragOffset={x:p.x-hitbox.x,y:p.y-hitbox.y};selected=-1;canvas.setPointerCapture(event.pointerId);$("#message").textContent="ヘソ枠をドラッグして移動できます";updateSelection();drawBoard();return;}selected=nearestPeg(p);dragging=selected>=0;canvas.setPointerCapture(event.pointerId);updateSelection();drawBoard();});
canvas.addEventListener("pointermove",event=>{const p=getPoint(event);if(shapeStart){shapeCurrent=p;drawBoard();return;}if(placing&&lastPlacementPoint){const dx=p.x-lastPlacementPoint.x,dy=p.y-lastPlacementPoint.y,distance=Math.hypot(dx,dy),spacing=Math.max(8,(Number($("#peg-radius").value)||3.2)*3.5);if(distance>=spacing){const count=Math.floor(distance/spacing);for(let i=1;i<=count;i++){const t=Math.min(1,i*spacing/distance);pegs.push({x:lastPlacementPoint.x+dx*t,y:lastPlacementPoint.y+dy*t,radius:Number($("#peg-radius").value)||3.2});}lastPlacementPoint={x:lastPlacementPoint.x+dx*(count*spacing/distance),y:lastPlacementPoint.y+dy*(count*spacing/distance)};selected=pegs.length-1;markDirty();updateSelection();drawBoard();$("#message").textContent=`釘を${pegs.length}本配置中`;}return;}if(deleting&&lastDeletionPoint){const dx=p.x-lastDeletionPoint.x,dy=p.y-lastDeletionPoint.y,distance=Math.hypot(dx,dy),spacing=6;const count=Math.max(1,Math.ceil(distance/spacing));let removed=0;for(let i=1;i<=count;i++){const t=i/count;const point={x:lastDeletionPoint.x+dx*t,y:lastDeletionPoint.y+dy*t};const index=nearestPeg(point);if(index>=0){pegs.splice(index,1);if(selected===index)selected=-1;else if(selected>index)selected--;removed++;}}lastDeletionPoint=p;if(removed){markDirty();updateSelection();drawBoard();$("#message").textContent=`釘を${removed}本削除しました`;}return;}if(activeResize){const box=activeResize.target==="hitbox"?hitbox:attacker;resizeBox(box,activeResize.corner,p);markDirty();drawBoard();return;}
if(draggingAttacker){attacker.x=Math.max(0,Math.min(BOARD_WIDTH-attacker.width,p.x-attackerDragOffset.x));attacker.y=Math.max(0,Math.min(BOARD_HEIGHT-attacker.height,p.y-attackerDragOffset.y));markDirty();drawBoard();return;}
if(draggingHitbox){hitbox.x=Math.max(0,Math.min(BOARD_WIDTH-hitbox.width,p.x-hitboxDragOffset.x));hitbox.y=Math.max(0,Math.min(BOARD_HEIGHT-hitbox.height,p.y-hitboxDragOffset.y));markDirty();drawBoard();return;}if(!dragging||selected<0)return;pegs[selected].x=Math.max(15,Math.min(BOARD_WIDTH-15,p.x));pegs[selected].y=Math.max(20,Math.min(620,p.y));updateSelection();markDirty();drawBoard();});
canvas.addEventListener("pointerup",()=>{if(shapeStart&&shapeCurrent){const additions=makeShapePegs(shapeStart,shapeCurrent);if(additions.length){pegs.push(...additions);selected=pegs.length-1;markDirty();updateSelection();$("#message").textContent=`${$("#shape-type").selectedOptions[0].textContent}の形に釘を${additions.length}本配置しました`;}else{$("#message").textContent="範囲が小さいか、盤面内に配置できませんでした";}shapeStart=null;shapeCurrent=null;drawBoard();}dragging=false;placing=false;lastPlacementPoint=null;deleting=false;lastDeletionPoint=null;draggingHitbox=false;draggingAttacker=false;activeResize=null;});canvas.addEventListener("pointercancel",()=>{shapeStart=null;shapeCurrent=null;dragging=false;placing=false;lastPlacementPoint=null;deleting=false;lastDeletionPoint=null;draggingHitbox=false;draggingAttacker=false;activeResize=null;});
document.querySelectorAll("[data-tool]").forEach(button=>button.addEventListener("click",()=>{tool=button.dataset.tool;document.querySelectorAll("[data-tool]").forEach(b=>{b.classList.toggle("active",b===button);b.setAttribute("aria-pressed",String(b===button));});canvas.style.cursor=(tool==="add"||tool==="place"||tool==="shape")?"crosshair":tool==="delete"?"not-allowed":"grab";$("#message").textContent=tool==="place"?"クリック配置モード：盤面をクリックすると釘を追加します":tool==="delete"?"削除モード：釘をクリックすると削除します":tool==="shape"?"図形配置モード：形の中心にしたい場所をクリックします":"選択モード：釘やヘソ枠を操作できます";}));
$("#peg-radius").addEventListener("input",event=>{if(selected<0)return;pegs[selected].radius=Number(event.target.value);$("#peg-radius-value").textContent=pegs[selected].radius.toFixed(1);markDirty();drawBoard();});
$("#delete-selected").addEventListener("click",()=>{if(selected<0)return;pegs.splice(selected,1);selected=-1;markDirty();updateSelection();drawBoard();});
$("#add-peg-center").addEventListener("click",()=>{pegs.push({x:BOARD_WIDTH/2,y:420,radius:Number($("#peg-radius").value)||3.2});selected=pegs.length-1;markDirty();updateSelection();drawBoard();});
$("#clear-pegs").addEventListener("click",()=>{if(!confirm("盤面上の釘をすべて削除しますか？"))return;pegs=[];selected=-1;markDirty();updateSelection();drawBoard();});
$("#reset-board").addEventListener("click",()=>{if(!confirm("初期配置に戻しますか？"))return;pegs=defaultPegs.map(peg=>({...peg}));selected=-1;markDirty();updateSelection();drawBoard();});
function bindRange(id,key,format){const input=$("#"+id),output=$("#"+id+"-value");input.addEventListener("input",()=>{settings[key]=Number(input.value);output.textContent=format(settings[key]);markDirty();if(key==="gravity"||key==="restitution")setPhysicsConfig({gravity:settings.gravity,restitution:settings.restitution});});}
bindRange("gravity","gravity",v=>String(v));bindRange("bounce","restitution",v=>v.toFixed(2));bindRange("launch-x","launchX",v=>String(v));bindRange("launch-y","launchY",v=>String(v));bindRange("launch-vx","launchVx",v=>String(v));bindRange("launch-vy","launchVy",v=>String(v));
$("#launch-interval").addEventListener("input",event=>{launchIntervalMs=Number(event.target.value);$("#launch-interval-value").textContent=String(launchIntervalMs);markDirty();});
$("#launch-interval").value=launchIntervalMs;$("#launch-interval-value").textContent=String(launchIntervalMs);
for (const [id,key] of [["gravity","gravity"],["bounce","restitution"],["launch-x","launchX"],["launch-y","launchY"],["launch-vx","launchVx"],["launch-vy","launchVy"]]) {
  $("#"+id).value = settings[key];
  $("#"+id+"-value").textContent = id === "bounce" ? settings[key].toFixed(2) : String(settings[key]);
}
function getConfig(){return{version:4,pegs,hitbox:{...hitbox},attacker:{...attacker},physics:{gravity:settings.gravity,restitution:settings.restitution},launcher:{x:settings.launchX,y:settings.launchY,vx:settings.launchVx,vy:settings.launchVy,intervalMs:launchIntervalMs},lottery:JSON.parse(JSON.stringify(lotterySettings))};}
function applyConfig(config){if(!config||!Array.isArray(config.pegs)||config.pegs.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.radius)))throw new Error("盤面データの形式が正しくありません");pegs=config.pegs.map(p=>({x:p.x,y:p.y,radius:p.radius}));hitbox={...defaultHitbox,...(config.hitbox||{})};attacker={...defaultAttacker,...(config.attacker||{})};lotterySettings={jackpotDenominator:config.lottery?.jackpotDenominator??52,symbolWeights:{...symbolDefaults,...(config.lottery?.symbolWeights||{})},reachSymbolWeights:{...reachSymbolDefaults,...(config.lottery?.reachSymbolWeights||{})}};renderLotteryControls();settings={gravity:config.physics?.gravity??520,restitution:config.physics?.restitution??.72,launchX:config.launcher?.x??48,launchY:config.launcher?.y??72,launchVx:config.launcher?.vx??265,launchVy:config.launcher?.vy??-125};launchIntervalMs=config.launcher?.intervalMs??340;$("#launch-interval").value=launchIntervalMs;$("#launch-interval-value").textContent=String(launchIntervalMs);const vals={gravity:settings.gravity,bounce:settings.restitution,"launch-x":settings.launchX,"launch-y":settings.launchY,"launch-vx":settings.launchVx,"launch-vy":settings.launchVy};for(const[id,value]of Object.entries(vals)){$("#"+id).value=value;$("#"+id+"-value").textContent=id==="bounce"?Number(value).toFixed(2):String(value);}setPhysicsConfig({gravity:settings.gravity,restitution:settings.restitution});selected=-1;updateSelection();markDirty();drawBoard();}
$("#save-board").addEventListener("click",()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(getConfig()));dirty=false;$("#save-state").textContent="保存済み";$("#message").textContent="保存しました。シミュレーターを再読み込みすると反映されます。";}catch(error){$("#message").textContent="保存できませんでした: "+error.message;}});
$("#export-board").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(getConfig(),null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="akita-pachinko-board.json";a.click();URL.revokeObjectURL(url);});
$("#import-board").addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{applyConfig(JSON.parse(await file.text()));$("#message").textContent="読み込みました。保存するとシミュレーターに反映されます。";}catch(error){$("#message").textContent="読み込み失敗: "+error.message;}event.target.value="";});
$("#grid-toggle").addEventListener("change",drawBoard);
function renderLotteryControls(){
  $("#jackpot-denominator").value=lotterySettings.jackpotDenominator;
  const makeRows=(containerId,weights,prefix)=>{
    const container=$("#"+containerId);container.replaceChildren();
    for(const symbol of SYMBOLS){
      const row=document.createElement("label");row.className="weight-row";
      const name=document.createElement("span");name.textContent="図柄 "+symbol.value;
      const input=document.createElement("input");input.type="number";input.min="0";input.max="1000000";input.step="1";input.value=weights[symbol.value]??0;input.setAttribute("aria-label",prefix+" 図柄 "+symbol.value);
      input.addEventListener("change",()=>{weights[symbol.value]=Math.max(0,Number(input.value)||0);if(Object.values(weights).every(value=>value<=0)){weights[symbol.value]=1;input.value="1";$("#message").textContent="すべて0にはできないため、最低1に調整しました";}markDirty();});
      row.append(name,input);container.append(row);
    }
  };
  makeRows("symbol-weight-controls",lotterySettings.symbolWeights,"出現比率");
  makeRows("reach-weight-controls",lotterySettings.reachSymbolWeights,"リーチ図柄振分");
}
$("#jackpot-denominator").addEventListener("change",event=>{lotterySettings.jackpotDenominator=Math.max(1,Math.floor(Number(event.target.value)||1));event.target.value=lotterySettings.jackpotDenominator;markDirty();});
renderLotteryControls();
function previewStep(time){const dt=lastPreviewTime?Math.min((time-lastPreviewTime)/1000,1/30):0;lastPreviewTime=time;previewLaunchAccumulator+=dt;const interval=Math.max(50,launchIntervalMs)/1000;while(previewLaunchAccumulator>=interval){previewLaunchAccumulator-=interval;balls.push(createBall(settings.launchX,settings.launchY,settings.launchVx,settings.launchVy));}balls=balls.filter(ball=>stepBall(ball,{width:BOARD_WIDTH,height:610},pegs,dt));resolveBallCollisions(balls);drawBoard();if(previewing)previewFrame=requestAnimationFrame(previewStep);}
$("#preview-toggle").addEventListener("change",event=>{previewing=event.target.checked;if(previewing){balls=[];lastPreviewTime=0;previewLaunchAccumulator=0;setPhysicsConfig({gravity:settings.gravity,restitution:settings.restitution});previewFrame=requestAnimationFrame(previewStep);}else{cancelAnimationFrame(previewFrame);balls=[];previewLaunchAccumulator=0;drawBoard();}});
window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue="";}});
updateCounts();updateSelection();setPhysicsConfig({gravity:settings.gravity,restitution:settings.restitution});drawBoard();