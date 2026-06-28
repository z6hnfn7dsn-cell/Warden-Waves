const canvas=document.getElementById("game");
const ctx=canvas.getContext("2d");
const ui=document.getElementById("ui");
const menu=document.getElementById("menu");
const cell=document.getElementById("cell");
const weapons=document.getElementById("weapons");
const choice=document.getElementById("choice");
const cellList=document.getElementById("cellList");
const weaponList=document.getElementById("weaponList");
const choiceList=document.getElementById("choiceList");
const pauseBtn=document.getElementById("pauseBtn");

const stickBase=document.createElement("div");
stickBase.id="stickBase";
const stickKnob=document.createElement("div");
stickKnob.id="stickKnob";
stickBase.appendChild(stickKnob);
document.body.appendChild(stickBase);

function resize(){canvas.width=innerWidth;canvas.height=innerHeight}
resize();addEventListener("resize",resize);

const blankSave={
  contraband:0,days:1,bed:0,workout:0,
  shivLevel:0,batonUnlocked:false,batonPurchased:false,batonLevel:0,
  chosenWeapon:"shiv",clearedSolitary:false
};

let save=JSON.parse(localStorage.getItem("wardenSolitarySave")||JSON.stringify(blankSave));
function saveGame(){localStorage.setItem("wardenSolitarySave",JSON.stringify(save))}
function resetProgress(){if(confirm("Erase your prison record?")){localStorage.removeItem("wardenSolitarySave");location.reload()}}

let keys={},enemies=[],bullets=[],drops=[];
let running=false,paused=false,inBoss=false,wave=1,kills=0,neededKills=20,message="";
let boss=null;
let joy={active:false,x:0,y:0,sx:0,sy:0};
let batonSwing=0;

let player={
  x:innerWidth/2,y:innerHeight/2,
  hp:100,maxHp:100,speed:4,damage:12,
  contraband:0,attackTimer:0,attackSpeed:22,weapon:"shiv"
};

function updateMenu(){
  document.getElementById("dayText").textContent="Day "+save.days;
  document.getElementById("savedMoney").textContent=save.contraband;
}
updateMenu();

function applyStats(){
  player.maxHp=100+save.bed*15;
  player.hp=player.maxHp;
  player.speed=4+save.workout*.35;
  player.weapon=save.chosenWeapon;

  if(player.weapon==="shiv"){
    player.damage=12+save.shivLevel*5;
    player.attackSpeed=20;
  }else{
    player.damage=13+save.batonLevel*5;
    player.attackSpeed=24;
  }
}

function startGame(){
  menu.classList.add("hidden");
  cell.classList.add("hidden");
  weapons.classList.add("hidden");
  choice.classList.add("hidden");
  running=true;paused=false;inBoss=false;boss=null;
  pauseBtn.textContent="Pause";
  wave=1;kills=0;enemies=[];bullets=[];drops=[];
  player.x=innerWidth/2;player.y=innerHeight/2;
  player.contraband=0;
  applyStats();
  spawnWave();
}

function togglePause(){if(!running)return;paused=!paused;pauseBtn.textContent=paused?"Resume":"Pause"}

function spawnWave(){
  inBoss=false;
  neededKills=18+wave*12;
  kills=0;enemies=[];bullets=[];drops=[];
  message="Solitary Wave "+wave+"/3";
  for(let i=0;i<8+wave*3;i++)spawnEnemy();
}

function spawnEnemy(){
  let side=Math.floor(Math.random()*4),x,y;
  if(side===0){x=-40;y=Math.random()*innerHeight}
  if(side===1){x=innerWidth+40;y=Math.random()*innerHeight}
  if(side===2){x=Math.random()*innerWidth;y=-40}
  if(side===3){x=Math.random()*innerWidth;y=innerHeight+40}
  let tough=Math.random()<wave*.12;
  enemies.push({
    x,y,w:tough?34:24,h:tough?42:32,
    hp:tough?50+wave*12:20+wave*7,
    speed:tough?1.2+wave*.08:1.8+wave*.12,
    damage:tough?18:9,
    tough
  });
}

function spawnBoss(){
  enemies=[];bullets=[];drops=[];
  inBoss=true;
  message="Boss: Baton Guard";
  boss={
    x:innerWidth/2,y:90,w:50,h:64,
    hp:750,maxHp:750,
    speed:1.9,damage:16,
    angle:0,batonRange:70,
    phase75:false,phase50:false,phase25:false,
    specialTimer:0,specialMode:""
  };
}

function update(){
  if(!running||paused)return;

  let mx=0,my=0;
  if(keys.w||keys.ArrowUp)my--;
  if(keys.s||keys.ArrowDown)my++;
  if(keys.a||keys.ArrowLeft)mx--;
  if(keys.d||keys.ArrowRight)mx++;
  if(joy.active){mx=joy.x;my=joy.y}
  let len=Math.hypot(mx,my);if(len){mx/=len;my/=len}

  player.x+=mx*player.speed;
  player.y+=my*player.speed;
  player.x=Math.max(24,Math.min(innerWidth-24,player.x));
  player.y=Math.max(34,Math.min(innerHeight-24,player.y));

  if(batonSwing>0)batonSwing--;

  player.attackTimer--;
  if(player.attackTimer<=0){attack();player.attackTimer=player.attackSpeed}

  for(let b of bullets){b.x+=b.vx;b.y+=b.vy;b.life--}
  bullets=bullets.filter(b=>b.life>0&&!b.dead);

  if(inBoss) updateBoss();
  else updateEnemies();

  for(let d of drops){
    if(dist(player,d)<42){player.contraband+=d.value;d.dead=true}
  }
  drops=drops.filter(d=>!d.dead);
}

function updateEnemies(){
  while(enemies.length<10+wave*2&&kills<neededKills)spawnEnemy();

  for(let e of enemies){
    let a=Math.atan2(player.y-e.y,player.x-e.x);
    e.x+=Math.cos(a)*e.speed;
    e.y+=Math.sin(a)*e.speed;
    if(dist(player,e)<28){player.hp-=e.damage*.04;if(player.hp<=0)gameOver(false,"The guards beat you back into solitary.")}
  }

  hitTargets(enemies);

  for(let i=enemies.length-1;i>=0;i--){
    if(enemies[i].hp<=0){
      drops.push({x:enemies[i].x,y:enemies[i].y,value:1});
      enemies.splice(i,1);
      kills++;
    }
  }

  if(kills>=neededKills){
    running=false;
    if(wave>=3) showWaveChoice(true);
    else showWaveChoice(false);
  }
}

function updateBoss(){
  let hpPct=boss.hp/boss.maxHp;

  if(hpPct<=.75&&!boss.phase75){boss.phase75=true;bossSpecial("RAGE SPIN");}
  if(hpPct<=.50&&!boss.phase50){boss.phase50=true;boss.speed+=.35;boss.batonRange+=12;bossSpecial("BATON RUSH");}
  if(hpPct<=.25&&!boss.phase25){boss.phase25=true;boss.speed+=.45;boss.damage+=6;bossSpecial("LAST STAND");}

  let a=Math.atan2(player.y-boss.y,player.x-boss.x);
  boss.x+=Math.cos(a)*boss.speed;
  boss.y+=Math.sin(a)*boss.speed;

  let spinSpeed=boss.specialTimer>0?.28:.14;
  boss.angle+=spinSpeed;
  if(boss.specialTimer>0)boss.specialTimer--;

  if(dist(player,boss)<40){
    player.hp-=boss.damage*.05;
  }

  let batonX=boss.x+Math.cos(boss.angle)*boss.batonRange;
  let batonY=boss.y+Math.sin(boss.angle)*boss.batonRange;

  if(Math.hypot(player.x-batonX,player.y-batonY)<30){
    player.hp-=1.25;
    let push=Math.atan2(player.y-batonY,player.x-batonX);
    player.x+=Math.cos(push)*7;
    player.y+=Math.sin(push)*7;
  }

  for(let b of bullets){
    if(!b.dead&&Math.hypot(b.x-boss.x,b.y-boss.y)<40){
      boss.hp-=b.damage;
      b.dead=true;
    }
  }

  if(player.hp<=0)gameOver(false,"The Baton Guard knocks you cold.");

  if(boss.hp<=0){
    save.batonUnlocked=true;
    save.clearedSolitary=true;
    save.days++;
    save.contraband+=player.contraband+20;
    saveGame();
    running=false;
    menu.classList.remove("hidden");
    menu.innerHTML=`
      <h1>Solitary Cleared</h1>
      <p>You beat the Baton Guard.</p>
      <p>The baton is now available in your cell weapons menu.</p>
      <p>Contraband earned: ${player.contraband+20}</p>
      <button onclick="location.reload()">Back to Cell</button>
    `;
  }
}

function bossSpecial(text){
  message=text;
  boss.specialTimer=150;
}

function hitTargets(list){
  for(let b of bullets){
    for(let e of list){
      if(!b.dead&&dist(b,e)<24){
        e.hp-=b.damage;
        b.dead=true;
      }
    }
  }
}

function attack(){
  if(player.weapon==="shiv") throwShiv();
  else swingBaton();
}

function throwShiv(){
  let target=null,best=999999;
  for(let e of enemies){let d=dist(player,e);if(d<best){best=d;target=e}}
  if(inBoss&&boss){let d=dist(player,boss);if(d<best){best=d;target=boss}}
  if(!target)return;
  let a=Math.atan2(target.y-player.y,target.x-player.x);
  bullets.push({x:player.x,y:player.y,r:5,vx:Math.cos(a)*10,vy:Math.sin(a)*10,damage:player.damage,life:70,angle:a});
}

function swingBaton(){
  batonSwing=10;
  let range=75+save.batonLevel*8;
  for(let e of enemies){
    if(dist(player,e)<range){
      e.hp-=player.damage;
      let push=Math.atan2(e.y-player.y,e.x-player.x);
      e.x+=Math.cos(push)*(18+save.batonLevel*4);
      e.y+=Math.sin(push)*(18+save.batonLevel*4);
    }
  }
  if(inBoss&&boss&&dist(player,boss)<range){
    boss.hp-=player.damage;
    let push=Math.atan2(boss.y-player.y,boss.x-player.x);
    boss.x+=Math.cos(push)*8;
    boss.y+=Math.sin(push)*8;
  }
  message="Baton swing!";
}

const finds=[
  {name:"Sharpen Shiv",text:"+5 damage this run",go:()=>player.damage+=5},
  {name:"Quick Hands",text:"Attack faster",go:()=>player.attackSpeed=Math.max(10,player.attackSpeed-3)},
  {name:"Prison Legs",text:"+0.5 speed",go:()=>player.speed+=.5},
  {name:"Tough Skin",text:"+25 max HP and heal",go:()=>{player.maxHp+=25;player.hp+=25}},
  {name:"Hidden Stash",text:"+12 Contraband",go:()=>player.contraband+=12}
];

function showWaveChoice(afterThird){
  choice.classList.remove("hidden");
  document.getElementById("choiceTitle").textContent=afterThird?"Boss Door Found":"Wave "+wave+" Cleared";
  choiceList.innerHTML="";

  if(afterThird){
    let div=document.createElement("div");
    div.className="card";
    div.innerHTML="<h2>Open the Boss Door</h2><p>The Baton Guard waits outside solitary.</p>";
    let btn=document.createElement("button");
    btn.textContent="Fight Boss";
    btn.onclick=()=>{choice.classList.add("hidden");running=true;spawnBoss()};
    div.appendChild(btn);
    choiceList.appendChild(div);
    return;
  }

  let picks=[...finds].sort(()=>Math.random()-.5).slice(0,3);
  for(let f of picks){
    let div=document.createElement("div");
    div.className="card";
    div.innerHTML="<h2>"+f.name+"</h2><p>"+f.text+"</p>";
    let btn=document.createElement("button");
    btn.textContent="Choose";
    btn.onclick=()=>{f.go();choice.classList.add("hidden");wave++;running=true;spawnWave()};
    div.appendChild(btn);
    choiceList.appendChild(div);
  }
}

function gameOver(won,text){
  running=false;
  save.days++;
  save.contraband+=player.contraband;
  saveGame();
  menu.classList.remove("hidden");
  menu.innerHTML=`
    <h1>Back to Solitary</h1>
    <p>${text}</p>
    <p>Contraband earned: ${player.contraband}</p>
    <p>Total Contraband: ${save.contraband}</p>
    <button onclick="location.reload()">Continue</button>
  `;
}

function showCell(){
  menu.classList.add("hidden");
  weapons.classList.add("hidden");
  cell.classList.remove("hidden");
  renderCell();
}

function renderCell(){
  document.getElementById("cellMoney").textContent=save.contraband;
  cellList.innerHTML="";
  addUpgrade("Bed","Start with +15 HP per level","bed",20);
  addUpgrade("Workout Corner","Move faster each level","workout",25);
  addWeaponUpgrade("Shiv Training","Improve shiv damage","shivLevel",30);
}

function addUpgrade(name,text,id,baseCost){
  let lvl=save[id],cost=baseCost*(lvl+1);
  let div=document.createElement("div");
  div.className="card";
  div.innerHTML="<h2>"+name+" Lv."+lvl+"</h2><p>"+text+"</p><p>Cost: "+cost+"</p>";
  let btn=document.createElement("button");
  btn.textContent="Upgrade";
  btn.onclick=()=>{if(save.contraband>=cost){save.contraband-=cost;save[id]++;saveGame();renderCell();updateMenu()}};
  div.appendChild(btn);
  cellList.appendChild(div);
}

function addWeaponUpgrade(name,text,id,baseCost){addUpgrade(name,text,id,baseCost)}

function showWeapons(){
  cell.classList.add("hidden");
  weapons.classList.remove("hidden");
  renderWeapons();
}

function renderWeapons(){
  weaponList.innerHTML="";
  weaponCard("Shiv","Fast ranged weapon. Weak early, dangerous when upgraded.","shiv",true,save.shivLevel,0);

  if(save.batonUnlocked){
    weaponCard("Baton","Short-range swing. Hits groups and knocks guards back.","baton",save.batonPurchased,save.batonLevel,60);
  }
}

function weaponCard(name,text,id,purchased,lvl,cost){
  let d=document.createElement("div");
  d.className="card";
  d.innerHTML="<h2>"+name+"</h2><p>"+text+"</p><p>Level: "+lvl+"</p>";
  if(!purchased){
    let b=document.createElement("button");
    b.textContent="Purchase "+cost;
    b.onclick=()=>{
      if(save.contraband>=cost){
        save.contraband-=cost;
        save.batonPurchased=true;
        save.chosenWeapon="baton";
        saveGame();
        renderWeapons();
      }
    };
    d.appendChild(b);
  }else{
    let select=document.createElement("button");
    select.textContent=save.chosenWeapon===id?"Selected":"Select";
    select.onclick=()=>{save.chosenWeapon=id;saveGame();renderWeapons()};
    d.appendChild(select);

    let up=document.createElement("button");
    let upgradeCost=id==="shiv"?30*(save.shivLevel+1):40*(save.batonLevel+1);
    up.textContent="Upgrade "+upgradeCost;
    up.onclick=()=>{
      if(save.contraband>=upgradeCost){
        save.contraband-=upgradeCost;
        if(id==="shiv")save.shivLevel++;
        if(id==="baton")save.batonLevel++;
        saveGame();
        renderWeapons();
      }
    };
    d.appendChild(up);
  }
  weaponList.appendChild(d);
}

function backToMenu(){
  cell.classList.add("hidden");
  weapons.classList.add("hidden");
  menu.classList.remove("hidden");
  updateMenu();
}

function draw(){
  ctx.clearRect(0,0,innerWidth,innerHeight);
  drawSolitary();
  drawPlayer();
  for(let e of enemies)drawEnemy(e);
  if(boss)drawBoss();
  for(let b of bullets)drawShiv(b);
  for(let d of drops)drawContraband(d);

  ui.innerHTML=`HP: ${Math.ceil(player.hp)} / ${player.maxHp}<br>
  Area: Solitary<br>
  ${inBoss?"Boss Fight":"Wave: "+wave+"/3"}<br>
  ${inBoss&&boss?"Boss HP: "+Math.ceil(boss.hp)+"/"+boss.maxHp:"Kills: "+kills+"/"+neededKills}<br>
  Weapon: ${player.weapon}<br>
  Run Contraband: ${player.contraband}<br>${message}`;

  if(paused){
    ctx.fillStyle="rgba(0,0,0,.55)";
    ctx.fillRect(0,0,innerWidth,innerHeight);
    ctx.fillStyle="white";
    ctx.font="bold 42px Arial";
    ctx.textAlign="center";
    ctx.fillText("PAUSED",innerWidth/2,innerHeight/2);
    ctx.textAlign="left";
  }
}

function drawSolitary(){
  ctx.fillStyle="#1f1f22";
  ctx.fillRect(0,0,innerWidth,innerHeight);
  ctx.strokeStyle="#3a3a3d";
  for(let x=0;x<innerWidth;x+=55){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,innerHeight);ctx.stroke()}
  for(let y=0;y<innerHeight;y+=55){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(innerWidth,y);ctx.stroke()}
  ctx.fillStyle="#555";
  ctx.fillRect(0,0,innerWidth,18);
  ctx.fillRect(0,innerHeight-18,innerWidth,18);
  ctx.fillRect(0,0,18,innerHeight);
  ctx.fillRect(innerWidth-18,0,18,innerHeight);
  ctx.strokeStyle="#999";
  for(let x=28;x<innerWidth;x+=38){
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,55);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x,innerHeight);ctx.lineTo(x,innerHeight-55);ctx.stroke();
  }
}

function drawPlayer(){
  ctx.fillStyle="#ff8c00";
  ctx.fillRect(player.x-13,player.y-10,26,28);
  ctx.fillStyle="#f0c08c";
  ctx.fillRect(player.x-9,player.y-26,18,18);
  ctx.fillStyle="#111";
  ctx.fillRect(player.x-5,player.y-20,3,3);
  ctx.fillRect(player.x+4,player.y-20,3,3);

  if(player.weapon==="baton"){
    ctx.strokeStyle="#ddd";
    ctx.lineWidth=5;
    ctx.beginPath();
    if(batonSwing>0){
      ctx.arc(player.x,player.y,50,0,Math.PI*2);
    }else{
      ctx.moveTo(player.x+12,player.y);
      ctx.lineTo(player.x+42,player.y+8);
    }
    ctx.stroke();
    ctx.lineWidth=1;
  }
}

function drawEnemy(e){
  ctx.fillStyle=e.tough?"#6f35b5":"#2f6fbd";
  ctx.fillRect(e.x-e.w/2,e.y-e.h/2,e.w,e.h);
  ctx.fillStyle="#f0c08c";
  ctx.fillRect(e.x-8,e.y-e.h/2-13,16,15);
}

function drawBoss(){
  ctx.fillStyle="#9b1c31";
  ctx.fillRect(boss.x-boss.w/2,boss.y-boss.h/2,boss.w,boss.h);
  ctx.fillStyle="#f0c08c";
  ctx.fillRect(boss.x-13,boss.y-boss.h/2-18,26,20);

  let bx=boss.x+Math.cos(boss.angle)*boss.batonRange;
  let by=boss.y+Math.sin(boss.angle)*boss.batonRange;
  ctx.strokeStyle=boss.specialTimer>0?"#ffdd57":"#ddd";
  ctx.lineWidth=boss.specialTimer>0?10:7;
  ctx.beginPath();
  ctx.moveTo(boss.x,boss.y);
  ctx.lineTo(bx,by);
  ctx.stroke();
  ctx.lineWidth=1;

  ctx.fillStyle="#111";
  ctx.fillRect(20,40,innerWidth-40,14);
  ctx.fillStyle="#d62828";
  ctx.fillRect(20,40,(innerWidth-40)*(boss.hp/boss.maxHp),14);
}

function drawShiv(b){
  ctx.save();
  ctx.translate(b.x,b.y);
  ctx.rotate(b.angle||0);
  ctx.fillStyle="#cfd8dc";
  ctx.beginPath();
  ctx.moveTo(12,0);
  ctx.lineTo(-6,-4);
  ctx.lineTo(-3,0);
  ctx.lineTo(-6,4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle="#5d4037";
  ctx.fillRect(-12,-3,7,6);
  ctx.restore();
}

function drawContraband(d){
  ctx.fillStyle="#06d6a0";
  ctx.fillRect(d.x-7,d.y-7,14,14);
}

function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

addEventListener("keydown",e=>keys[e.key]=true);
addEventListener("keyup",e=>keys[e.key]=false);

canvas.addEventListener("touchstart",e=>{
  let t=e.touches[0];
  joy.active=true;joy.sx=t.clientX;joy.sy=t.clientY;
  stickBase.style.display="block";
  stickBase.style.left=(joy.sx-60)+"px";
  stickBase.style.top=(joy.sy-60)+"px";
},{passive:false});

canvas.addEventListener("touchmove",e=>{
  e.preventDefault();
  let t=e.touches[0];
  let dx=t.clientX-joy.sx,dy=t.clientY-joy.sy;
  let len=Math.hypot(dx,dy),max=45;
  if(len>max){dx=dx/len*max;dy=dy/len*max}
  joy.x=dx/max;joy.y=dy/max;
  stickKnob.style.left=(38+dx)+"px";
  stickKnob.style.top=(38+dy)+"px";
},{passive:false});

canvas.addEventListener("touchend",()=>{
  joy.active=false;joy.x=0;joy.y=0;
  stickBase.style.display="none";
});

function loop(){update();draw();requestAnimationFrame(loop)}
loop();
