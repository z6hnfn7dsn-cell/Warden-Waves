const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const ui = document.getElementById("ui");
const menu = document.getElementById("menu");
const choice = document.getElementById("choice");
const cell = document.getElementById("cell");
const choiceList = document.getElementById("choiceList");
const pauseBtn = document.getElementById("pauseBtn");

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
resize();
addEventListener("resize", resize);

let save = JSON.parse(localStorage.getItem("wardenSave") || '{"contraband":0,"bed":0,"workout":0,"shiv":0}');
function saveGame() { localStorage.setItem("wardenSave", JSON.stringify(save)); }
function updateMenu() { document.getElementById("savedMoney").textContent = save.contraband; }

let keys = {}, enemies = [], bullets = [], drops = [];
let running = false, paused = false, wave = 1, kills = 0, neededKills = 8, message = "";

let player = {
  x: innerWidth / 2, y: innerHeight / 2, w: 26, h: 34,
  hp: 100, maxHp: 100, speed: 4, damage: 12,
  level: 1, xp: 0, contraband: 0, attackTimer: 0, attackSpeed: 25
};

function applyPermanentStats() {
  player.maxHp = 100 + save.bed * 15;
  player.hp = player.maxHp;
  player.speed = 4 + save.workout * .35;
  player.damage = 12 + save.shiv * 4;
}

function startGame() {
  menu.classList.add("hidden");
  cell.classList.add("hidden");
  choice.classList.add("hidden");
  running = true;
  paused = false;
  wave = 1;
  kills = 0;
  enemies = [];
  bullets = [];
  drops = [];
  player.x = innerWidth / 2;
  player.y = innerHeight / 2;
  player.level = 1;
  player.xp = 0;
  player.contraband = 0;
  player.attackSpeed = 25;
  applyPermanentStats();
  spawnWave();
}

function togglePause() {
  if (!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
}

function spawnWave() {
  neededKills = 6 + wave * 3;
  kills = 0;
  enemies = [];
  bullets = [];
  drops = [];
  message = "Wave " + wave + "/10";
  for (let i = 0; i < 6; i++) spawnEnemy();
}

function spawnEnemy() {
  let side = Math.floor(Math.random() * 4), x, y;
  if (side === 0) { x = -40; y = Math.random() * innerHeight; }
  if (side === 1) { x = innerWidth + 40; y = Math.random() * innerHeight; }
  if (side === 2) { x = Math.random() * innerWidth; y = -40; }
  if (side === 3) { x = Math.random() * innerWidth; y = innerHeight + 40; }

  let tough = Math.random() < wave * .08;

  enemies.push({
    x, y,
    w: tough ? 34 : 26,
    h: tough ? 42 : 34,
    hp: tough ? 45 + wave * 12 : 18 + wave * 6,
    speed: tough ? 1.15 + wave * .05 : 1.6 + wave * .08,
    damage: tough ? 18 : 9,
    tough
  });
}

function update() {
  if (!running || paused) return;

  while (enemies.length < 6 && kills < neededKills) spawnEnemy();

  let mx = 0, my = 0;
  if (keys.w || keys.ArrowUp) my--;
  if (keys.s || keys.ArrowDown) my++;
  if (keys.a || keys.ArrowLeft) mx--;
  if (keys.d || keys.ArrowRight) mx++;

  let len = Math.hypot(mx, my);
  if (len) { mx /= len; my /= len; }

  player.x += mx * player.speed;
  player.y += my * player.speed;
  player.x = Math.max(20, Math.min(innerWidth - 20, player.x));
  player.y = Math.max(30, Math.min(innerHeight - 20, player.y));

  player.attackTimer--;
  if (player.attackTimer <= 0) {
    shoot();
    player.attackTimer = player.attackSpeed;
  }

  for (let b of bullets) {
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
  }
  bullets = bullets.filter(b => b.life > 0);

  for (let e of enemies) {
    let a = Math.atan2(player.y - e.y, player.x - e.x);
    e.x += Math.cos(a) * e.speed;
    e.y += Math.sin(a) * e.speed;

    if (dist(player, e) < 28) {
      player.hp -= e.damage * .035;
      if (player.hp <= 0) gameOver(false);
    }
  }

  for (let b of bullets) {
    for (let e of enemies) {
      if (!b.dead && dist(b, e) < 24) {
        e.hp -= b.damage;
        b.dead = true;
      }
    }
  }
  bullets = bullets.filter(b => !b.dead);

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].hp <= 0) {
      drops.push({ x: enemies[i].x, y: enemies[i].y, r: 8 });
      enemies.splice(i, 1);
      kills++;
      player.xp += 5;
      if (player.xp >= player.level * 20) levelUp();
    }
  }

  for (let d of drops) {
    if (dist(player, d) < 35) {
      player.contraband++;
      d.dead = true;
    }
  }
  drops = drops.filter(d => !d.dead);

  if (kills >= neededKills) {
    running = false;
    if (wave >= 10) gameOver(true);
    else showWaveChoice();
  }
}

function shoot() {
  if (enemies.length === 0) return;

  let target = enemies[0], best = dist(player, target);
  for (let e of enemies) {
    let d = dist(player, e);
    if (d < best) { best = d; target = e; }
  }

  let a = Math.atan2(target.y - player.y, target.x - player.x);
  bullets.push({
    x: player.x, y: player.y, r: 6,
    vx: Math.cos(a) * 8,
    vy: Math.sin(a) * 8,
    damage: player.damage,
    life: 70
  });
}

function levelUp() {
  player.level++;
  player.xp = 0;
  player.damage += 2;
  player.maxHp += 5;
  player.hp = Math.min(player.maxHp, player.hp + 15);
  message = "Level Up!";
  setTimeout(() => message = "Wave " + wave + "/10", 1000);
}

const finds = [
  { name: "Sharpened Toothbrush", text: "+4 damage", go: () => player.damage += 4 },
  { name: "Stolen Boots", text: "+0.5 speed", go: () => player.speed += .5 },
  { name: "Prison Toughness", text: "+20 max HP, heal 20", go: () => { player.maxHp += 20; player.hp = Math.min(player.maxHp, player.hp + 20); } },
  { name: "Quick Hands", text: "Attack faster", go: () => player.attackSpeed = Math.max(12, player.attackSpeed - 3) },
  { name: "Lucky Dice", text: "+8 Contraband now", go: () => player.contraband += 8 },
  { name: "Riot Padding", text: "Heal 35", go: () => player.hp = Math.min(player.maxHp, player.hp + 35) }
];

function showWaveChoice() {
  choice.classList.remove("hidden");
  document.getElementById("choiceTitle").textContent = "Wave " + wave + " Cleared";
  choiceList.innerHTML = "";

  let picks = [...finds].sort(() => Math.random() - .5).slice(0, 3);

  for (let f of picks) {
    let div = document.createElement("div");
    div.className = "card";
    div.innerHTML = "<h2>" + f.name + "</h2><p>" + f.text + "</p>";
    let btn = document.createElement("button");
    btn.textContent = "Choose";
    btn.onclick = () => {
      f.go();
      choice.classList.add("hidden");
      wave++;
      running = true;
      spawnWave();
    };
    div.appendChild(btn);
    choiceList.appendChild(div);
  }
}

function gameOver(won) {
  running = false;
  save.contraband += player.contraband;
  saveGame();

  menu.classList.remove("hidden");
  menu.innerHTML = `
    <h1>${won ? "You cleared Level 1!" : "Back to the Cell"}</h1>
    <p>Wave reached: ${wave > 10 ? 10 : wave}/10</p>
    <p>Contraband earned: ${player.contraband}</p>
    <p>Total Contraband: ${save.contraband}</p>
    <button onclick="location.reload()">Continue</button>
  `;
}

function showCell() {
  menu.classList.add("hidden");
  cell.classList.remove("hidden");
  renderCell();
}

function renderCell() {
  document.getElementById("cellMoney").textContent = save.contraband;
  cellList.innerHTML = "";
  addUpgrade("Bed", "Start with +15 HP per level", "bed", 20);
  addUpgrade("Workout Corner", "Move faster each level", "workout", 25);
  addUpgrade("Shiv Bench", "Start with +4 damage per level", "shiv", 30);
}

function addUpgrade(name, text, id, baseCost) {
  let lvl = save[id];
  let cost = baseCost * (lvl + 1);
  let div = document.createElement("div");
  div.className = "card";
  div.innerHTML = "<h2>" + name + " Lv." + lvl + "</h2><p>" + text + "</p><p>Cost: " + cost + "</p>";

  let btn = document.createElement("button");
  btn.textContent = "Upgrade";
  btn.onclick = () => {
    if (save.contraband >= cost) {
      save.contraband -= cost;
      save[id]++;
      saveGame();
      renderCell();
      updateMenu();
    }
  };

  div.appendChild(btn);
  cellList.appendChild(div);
}

function backToMenu() {
  cell.classList.add("hidden");
  menu.classList.remove("hidden");
  updateMenu();
}

function draw() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  drawYard();
  drawPlayer();

  for (let e of enemies) drawEnemy(e);
  for (let b of bullets) drawBullet(b);
  for (let d of drops) drawContraband(d);

  ui.innerHTML =
    `HP: ${Math.ceil(player.hp)} / ${player.maxHp}<br>
     Wave: ${Math.min(wave,10)}/10<br>
     Kills: ${kills}/${neededKills}<br>
     Level: ${player.level}<br>
     Run Contraband: ${player.contraband}<br>
     ${message}`;

  if (paused) {
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(0,0,innerWidth,innerHeight);
    ctx.fillStyle = "white";
    ctx.font = "bold 42px Arial";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", innerWidth/2, innerHeight/2);
    ctx.textAlign = "left";
  }
}

function drawYard() {
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(0,0,innerWidth,innerHeight);

  ctx.strokeStyle = "#444";
  for (let x=0; x<innerWidth; x+=70) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,innerHeight); ctx.stroke();
  }
  for (let y=0; y<innerHeight; y+=70) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(innerWidth,y); ctx.stroke();
  }

  ctx.fillStyle = "#555";
  ctx.fillRect(0,0,innerWidth,14);
  ctx.fillRect(0,innerHeight-14,innerWidth,14);
  ctx.fillRect(0,0,14,innerHeight);
  ctx.fillRect(innerWidth-14,0,14,innerHeight);

  ctx.strokeStyle = "#999";
  for (let x=30; x<innerWidth; x+=45) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,innerHeight); ctx.lineTo(x,innerHeight-42); ctx.stroke();
  }
}

function drawPlayer() {
  ctx.fillStyle = "#ff8c00";
  ctx.fillRect(player.x-13, player.y-10, 26, 28);
  ctx.fillStyle = "#f2c08d";
  ctx.fillRect(player.x-9, player.y-26, 18, 18);
  ctx.fillStyle = "#111";
  ctx.fillRect(player.x-5, player.y-20, 3, 3);
  ctx.fillRect(player.x+4, player.y-20, 3, 3);
  ctx.fillStyle = "#333";
  ctx.fillRect(player.x+12, player.y-3, 16, 5);
}

function drawEnemy(e) {
  ctx.fillStyle = e.tough ? "#6f35b5" : "#2f6fbd";
  ctx.fillRect(e.x-e.w/2, e.y-e.h/2, e.w, e.h);

  ctx.fillStyle = "#f2c08d";
  ctx.fillRect(e.x-9, e.y-e.h/2-14, 18, 16);

  ctx.fillStyle = "#111";
  ctx.fillRect(e.x-5, e.y-e.h/2-9, 3, 3);
  ctx.fillRect(e.x+4, e.y-e.h/2-9, 3, 3);

  ctx.fillStyle = "#222";
  ctx.fillRect(e.x-12, e.y+e.h/2-4, 24, 4);
}

function drawBullet(b) {
  ctx.fillStyle = "#ffd166";
  ctx.beginPath();
  ctx.arc(b.x,b.y,b.r,0,Math.PI*2);
  ctx.fill();
}

function drawContraband(d) {
  ctx.fillStyle = "#06d6a0";
  ctx.fillRect(d.x-7,d.y-7,14,14);
  ctx.fillStyle = "#013";
  ctx.fillRect(d.x-3,d.y-3,6,6);
}

function dist(a,b) {
  return Math.hypot(a.x-b.x,a.y-b.y);
}

addEventListener("keydown", e => keys[e.key] = true);
addEventListener("keyup", e => keys[e.key] = false);

canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  let t = e.touches[0];
  player.x += (t.clientX - player.x) * .08;
  player.y += (t.clientY - player.y) * .08;
}, {passive:false});

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

updateMenu();
loop();