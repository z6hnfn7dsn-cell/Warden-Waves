const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const ui=document.getElementById("ui");
const menu=document.getElementById("menu");
const choice=document.getElementById("choice");
const cell=document.getElementById("cell");
const journal=document.getElementById("journal");
const choiceList=document.getElementById("choiceList");
const cellList=document.getElementById("cellList");
const pauseBtn=document.getElementById("pauseBtn");

const stickBase=document.createElement("div");
stickBase.id="stickBase";
const stickKnob=document.createElement("div");
stickKnob.id="stickKnob";
stickBase.appendChild(stickKnob);
document.body.appendChild(stickBase);

function resize(){canvas.width=innerWidth;canvas.height=innerHeight}
resize();addEventListener("resize",resize);

const blankSave={contraband:0,bed:0,workout:0,shiv:0,library:0,days:1,block:1,knowsDamage:false,knowsHealth:false,knowsHeal:false};
let save=JSON.parse(localStorage.getItem("wardenSave2")||JSON.stringify(blankSave));
function saveGame(){localStorage.setItem("wardenSave2",JSON.stringify(save))}
function resetProgress(){if(confirm("Erase your prison record?")){localStorage.removeItem("wardenSave2");location.reload()}}

let keys={},enemies=[],bullets=[],drops=[];
let running=false,paused=false,wave=1,kills=0,neededKills=10,message="";
let joy={active:false,x:0,y:0,sx:0,sy:0};

let player={x:innerWidth/2,y:innerHeight/2,hp:100,maxHp:100,speed:4,damage:12,level:1,xp:0,contraband:0,attackTimer:0,attackSpeed:22,shots:1};

function updateMenu(){
document.getElementById("dayText").textContent="Day "+save.days;
document.getElementById("blockText").textContent=save.block;
document.getElementById("savedMoney").textContent=save.contraband;
let k=[save.knowsDamage,save.knowsHealth,save.knowsHeal].filter(Boolean).length;
document.getElementById("knowledgeText").textContent=k+"/3";
}
updateMenu();

function applyPermanentStats(){
player.maxHp=100+save.bed*15+(save.knowsHealth?30:0);
player.hp=player.maxHp;
player.speed=4+save.workout*.35;
player.damage=12+save.shiv*4+(save.knowsDamage?8:0);
player.shots=save.knowsDamage&&save.knowsHealth?2:1;
}

function startGame(){
menu.classList.add("hidden");cell.classList.add("hidden");journal.classList.add("hidden");choice.classList.add("hidden");
running=true;paused=false;pauseBtn.textContent="Pause";
wave=1;kills=0;enemies=[];bullets=[];drops=[];
player.x=innerWidth/2;player.y=innerHeight/2;
player.level=1;player.xp=0;player.contraband=0;player.attackSpeed=22;
applyPermanentStats();spawnWave();
}

function togglePause(){if(!running)return;paused=!paused;pauseBtn.textContent=paused?"Resume":"Pause"}

function spawnWave(){
neededKills=8+wave*7;
kills=0;enemies=[];bullets=[];drops=[];
message="Wave "+wave+"/10";
for(let i=0;i<8+wave*2;i++)spawnEnemy();
}

function spawnEnemy(){
let side=Math.floor(Math.random()*4),x,y;
if(side===0){x=-50;y=Math.random()*innerHeight}
if(side===1){x=innerWidth+50;y=Math.random()*innerHeight}
if(side===2){x=Math.random()*innerWidth;y=-50}
if(side===3){x=Math.random()*innerWidth;y=innerHeight+50}
let tough=Math.random()<wave*.1;
enemies.push({x,y,w:tough?36:26,h:tough?46:34,hp:tough?55+wave*16:22+wave*8,speed:tough?1.25+wave*.05:1.8+wave*.1,damage:tough?22:10,tough});
}

function update(){
if(!running||paused)return;
while(enemies.length<10+wave&&kills<neededKills)spawnEnemy();

let mx=0,my=0;
if(keys.w||keys.ArrowUp)my--; if(keys.s||keys.ArrowDown)my++;
if(keys.a||keys.ArrowLeft)mx--; if(keys.d||keys.ArrowRight)mx++;
if(joy.active){mx=joy.x;my=joy.y}
let len=Math.hypot(mx,my); if(len){mx/=len;my/=len}
player.x+=mx*player.speed; player.y+=my*player.speed;
player.x=Math.max(22,Math.min(innerWidth-22,player.x));
player.y=Math.max(35,Math.min(innerHeight-25,player.y));

player.attackTimer--;
if(player.attackTimer<=0){shoot();player.attackTimer=player.attackSpeed}

for(let b of bullets){b.x+=b.vx;b.y+=b.vy;b.life--}
bullets=bullets.filter(b=>b.life>0&&!b.dead);

for(let e of enemies){
let a=Math.atan2(player.y-e.y,player.x-e.x);
e.x+=Math.cos(a)*e.speed;e.y+=Math.sin(a)*e.speed;
if(dist(player,e)<30){player.hp-=e.damage*.04;if(player.hp<=0)gameOver(false)}
}

for(let b of bullets){for(let e of enemies){if(!b.dead&&dist(b,e)<26){e.hp-=b.damage;b.dead=true}}}
for(let i=enemies.length-1;i>=0;i--){
if(enemies[i].hp<=0){drops.push({x:enemies[i].x,y:enemies[i].y});enemies.splice(i,1);kills++;player.xp+=5;if(player.xp>=player.level*20)levelUp()}}
for(let d of drops){if(dist(player,d)<38){player.contraband++;d.dead=true}}
drops=drops.filter(d=>!d.dead);

if(kills>=neededKills){running=false;if(wave>=10)finishFloor();else showWaveChoice()}
}

function shoot(){
if(enemies.length===0)return;
let target=enemies[0],best=dist(player,target);
for(let e of enemies){let d=dist(player,e);if(d<best){best=d;target=e}}
let base=Math.atan2(target.y-player.y,target.x-player.x);
let angles=player.shots===2?[base-.16,base+.16]:[base];
for(let a of angles)bullets.push({x:player.x,y:player.y,r:6,vx:Math.cos(a)*9,vy:Math.sin(a)*9,damage:player.damage,life:70});
}

function levelUp(){player.level++;player.xp=0;player.damage+=2;player.maxHp+=5;if(save.knowsHeal)player.hp=Math.min(player.maxHp,player.hp+18);message="Level Up!"}

const finds=[
{name:"Sharpened Toothbrush",text:"+4 damage",type:"damage",go:()=>player.damage+=4},
{name:"Prison Toughness",text:"+20 max HP",type:"health",go:()=>{player.maxHp+=20;player.hp+=20}},
{name:"Stolen Boots",text:"+0.5 speed",type:"speed",go:()=>player.speed+=.5},
{name:"Quick Hands",text:"Attack faster",type:"speed",go:()=>player.attackSpeed=Math.max(10,player.attackSpeed-3)},
{name:"Riot Padding",text:"Heal 35",type:"heal",go:()=>player.hp=Math.min(player.maxHp,player.hp+35)},
{name:"Lucky Dice",text:"+10 Contraband",type:"cash",go:()=>player.contraband+=10}
];

function showWaveChoice(){
choice.classList.remove("hidden");
document.getElementById("choiceTitle").textContent="Wave "+wave+" Cleared";
choiceList.innerHTML="";
let picks=[...finds].sort(()=>Math.random()-.5).slice(0,3);
for(let f of picks){
let div=document.createElement("div");div.className="card";div.innerHTML="<h2>"+f.name+"</h2><p>"+f.text+"</p>";
let btn=document.createElement("button");btn.textContent="Choose";
btn.onclick=()=>{f.go();if(wave>=7&&f.type==="damage")save.knowsDamage=true;if(wave>=8&&f.type==="health")save.knowsHealth=true;if(wave>=9&&f.type==="heal")save.knowsHeal=true;saveGame();choice.classList.add("hidden");wave++;running=true;spawnWave()};
div.appendChild(btn);choiceList.appendChild(div);
}
}

function finishFloor(){
if(save.knowsDamage&&save.knowsHealth&&save.knowsHeal){
save.block=2;
gameOver(true,"The gate opens. The Warden stops laughing.");
}else{
gameOver(false,"The Warden laughs and drags you back to the cell.");
}
}

function gameOver(won,extra=""){
running=false;save.days++;save.contraband+=player.contraband;saveGame();
menu.classList.remove("hidden");
menu.innerHTML=`<h1>${won?"Cell Block 2 Found":"Back to the Cell"}</h1><p>${extra}</p><p>Day ${save.days}</p><p>Contraband earned: ${player.contraband}</p><p>Total Contraband: ${save.contraband}</p><button onclick="location.reload()">Continue</button>`;
}

function showCell(){menu.classList.add("hidden");cell.classList.remove("hidden");renderCell()}
function renderCell(){
document.getElementById("cellMoney").textContent=save.contraband;cellList.innerHTML="";
addUpgrade("Bed","Start with +15 HP per level","bed",20);
addUpgrade("Workout Corner","Move faster each level","workout",25);
addUpgrade("Shiv Bench","Start with +4 damage per level","shiv",30);
addUpgrade("Library","Reveals escape knowledge","library",40);
}
function addUpgrade(name,text,id,baseCost){
let lvl=save[id],cost=baseCost*(lvl+1);
let div=document.createElement("div");div.className="card";
div.innerHTML="<h2>"+name+" Lv."+lvl+"</h2><p>"+text+"</p><p>Cost: "+cost+"</p>";
let btn=document.createElement("button");btn.textContent="Upgrade";
btn.onclick=()=>{if(save.contraband>=cost){save.contraband-=cost;save[id]++;saveGame();renderCell();updateMenu()}};
div.appendChild(btn);cellList.appendChild(div);
}
function backToMenu(){cell.classList.add("hidden");journal.classList.add("hidden");menu.classList.remove("hidden");updateMenu()}

function showJournal(){
menu.classList.add("hidden");journal.classList.remove("hidden");
let k1=save.knowsDamage?"✓":"☐",k2=save.knowsHealth?"✓":"☐",k3=save.knowsHeal?"✓":"☐";
let clue=save.library<2?"The book is mostly blank. Upgrade the Library.":save.library<4?"Strength alone will not open the gate.":save.library<6?"The next block requires a body, a blade, and a way to recover.":"The gate listens for three lessons: Damage, Health, Heal.";
document.getElementById("journalText").innerHTML=`<p><b>Day ${save.days}</b></p><p>${clue}</p><p>${k1} Damage lesson</p><p>${k2} Health lesson</p><p>${k3} Heal lesson</p><p>Lessons are learned by choosing the right finds late in an escape attempt.</p>`;
}

function draw(){
ctx.clearRect(0,0,innerWidth,innerHeight);drawYard();drawPlayer();
for(let e of enemies)drawEnemy(e);for(let b of bullets)drawBullet(b);for(let d of drops)drawContraband(d);
ui.innerHTML=`HP: ${Math.ceil(player.hp)} / ${player.maxHp}<br>Wave: ${Math.min(wave,10)}/10<br>Kills: ${kills}/${neededKills}<br>Level: ${player.level}<br>Run Contraband: ${player.contraband}<br>${message}`;
if(paused){ctx.fillStyle="rgba(0,0,0,.55)";ctx.fillRect(0,0,innerWidth,innerHeight);ctx.fillStyle="white";ctx.font="bold 42px Arial";ctx.textAlign="center";ctx.fillText("PAUSED",innerWidth/2,innerHeight/2);ctx.textAlign="left"}
}

function drawYard(){
ctx.fillStyle="#2a2a2a";ctx.fillRect(0,0,innerWidth,innerHeight);
ctx.strokeStyle="#444";for(let x=0;x<innerWidth;x+=70){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,innerHeight);ctx.stroke()}
for(let y=0;y<innerHeight;y+=70){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(innerWidth,y);ctx.stroke()}
ctx.fillStyle="#555";ctx.fillRect(0,0,innerWidth,14);ctx.fillRect(0,innerHeight-14,innerWidth,14);ctx.fillRect(0,0,14,innerHeight);ctx.fillRect(innerWidth-14,0,14,innerHeight);
ctx.strokeStyle="#999";for(let x=30;x<innerWidth;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,42);ctx.stroke();ctx.beginPath();ctx.moveTo(x,innerHeight);ctx.lineTo(x,innerHeight-42);ctx.stroke()}
}
function drawPlayer(){ctx.fillStyle="#ff8c00";ctx.fillRect(player.x-13,player.y-10,26,28);ctx.fillStyle="#f2c08d";ctx.fillRect(player.x-9,player.y-26,18,18);ctx.fillStyle="#111";ctx.fillRect(player.x-5,player.y-20,3,3);ctx.fillRect(player.x+4,player.y-20,3,3);ctx.fillStyle="#333";ctx.fillRect(player.x+12,player.y-3,16,5)}
function drawEnemy(e){ctx.fillStyle=e.tough?"#6f35b5":"#2f6fbd";ctx.fillRect(e.x-e.w/2,e.y-e.h/2,e.w,e.h);ctx.fillStyle="#f2c08d";ctx.fillRect(e.x-9,e.y-e.h/2-14,18,16);ctx.fillStyle="#111";ctx.fillRect(e.x-5,e.y-e.h/2-9,3,3);ctx.fillRect(e.x+4,e.y-e.h/2-9,3,3)}
function drawBullet(b){ctx.fillStyle="#ffd166";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill()}
function drawContraband(d){ctx.fillStyle="#06d6a0";ctx.fillRect(d.x-7,d.y-7,14,14);ctx.fillStyle="#013";ctx.fillRect(d.x-3,d.y-3,6,6)}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

addEventListener("keydown",e=>keys[e.key]=true);addEventListener("keyup",e=>keys[e.key]=false);
canvas.addEventListener("touchstart",e=>{let t=e.touches[0];joy.active=true;joy.sx=t.clientX;joy.sy=t.clientY;stickBase.style.display="block";stickBase.style.left=(joy.sx-60)+"px";stickBase.style.top=(joy.sy-60)+"px";},{passive:false});
canvas.addEventListener("touchmove",e=>{e.preventDefault();let t=e.touches[0];let dx=t.clientX-joy.sx,dy=t.clientY-joy.sy;let len=Math.hypot(dx,dy),max=45;if(len>max){dx=dx/len*max;dy=dy/len*max}joy.x=dx/max;joy.y=dy/max;stickKnob.style.left=(38+dx)+"px";stickKnob.style.top=(38+dy)+"px";},{passive:false});
canvas.addEventListener("touchend",()=>{joy.active=false;joy.x=0;joy.y=0;stickBase.style.display="none"});

function loop(){update();draw();requestAnimationFrame(loop)}
loop();