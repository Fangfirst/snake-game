const socket = io();
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const startMenu = document.getElementById("menu");
const startBtn = document.getElementById("startBtn");
const nameInput = document.getElementById("playerName");
const lobby = document.getElementById("lobby");
const playerList = document.getElementById("playerList");
const restartDiv = document.getElementById("restart");
const restartBtn = document.getElementById("restartBtn");
const skillsDiv = document.getElementById("skills");

const gridSize = 20;
let players = {};
let food = null;
let waiting = true;
let gameOver = false;
let playerId = null;
let moveSpeed = 200;
let speedTimer = null;

const appleImg = new Image();
appleImg.src = "https://cdn-icons-png.flaticon.com/512/415/415733.png"; // 🍎

// ====================  START MENU =====================
startBtn.addEventListener("click", () => {
  const name = nameInput.value.trim() || "ผู้เล่น";
  socket.emit("setName", name);

  startMenu.style.display = "none";
  lobby.style.display = "block";
});

// ====================  SOCKET EVENTS =====================
socket.on("lobby", (data) => {
  players = data.players;
  waiting = data.waiting;
  playerList.innerHTML = Object.values(players)
    .map((p) => `<p>${p.name}</p>`)
    .join("");
});

socket.on("start", (data) => {
  food = data.food;
  waiting = false;
  lobby.style.display = "none";
  canvas.style.display = "block";
  skillsDiv.style.display = "block";
  restartDiv.style.display = "none";
  gameOver = false;
  draw();
});

socket.on("players", (data) => {
  players = data;
  draw();
});

socket.on("food", (data) => {
  food = data;
});

socket.on("gameOver", () => {
  gameOver = true;
  skillsDiv.style.display = "none";
  restartDiv.style.display = "block";
  draw();
});

socket.on("speedChange", (duration) => {
  clearTimeout(speedTimer);
  moveSpeed = duration === 1000 ? 100 : 400; // speed up or slow down
  speedTimer = setTimeout(() => {
    moveSpeed = 200;
  }, duration);
});

socket.on("connect", () => {
  playerId = socket.id;
});

socket.on("full", () => {
  alert("❌ ห้องเต็มแล้ว! (เล่นได้แค่ 2 คน)");
});

// ====================  CONTROL =====================
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") socket.emit("move", "up");
  if (e.key === "ArrowDown") socket.emit("move", "down");
  if (e.key === "ArrowLeft") socket.emit("move", "left");
  if (e.key === "ArrowRight") socket.emit("move", "right");
});

// ====================  SKILLS =====================
document.querySelectorAll("#skills button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const skill = btn.getAttribute("data-skill");
    socket.emit("useSkill", skill);
  });
});

// ====================  RESTART =====================
restartBtn.addEventListener("click", () => {
  socket.emit("restart");
  restartDiv.style.display = "none";
  lobby.style.display = "block";
});

// ====================  DRAW =====================
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (waiting) {
    ctx.fillStyle = "white";
    ctx.font = "24px Arial";
    ctx.fillText("รอผู้เล่นอีกคนเข้ามา...", 70, 180);
    return;
  }

  if (food) {
    ctx.drawImage(appleImg, food.x * gridSize, food.y * gridSize, gridSize, gridSize);
  }

  for (let id in players) {
    const p = players[id];
    ctx.fillStyle = p.color;

    for (let i = 0; i < p.snake.length; i++) {
      const seg = p.snake[i];
      ctx.beginPath();
      ctx.arc(
        seg.x * gridSize + gridSize / 2,
        seg.y * gridSize + gridSize / 2,
        gridSize / 2 - 2,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // 🧿 Eyes for the head
      if (i === 0) {
        ctx.fillStyle = "white";
        const eyeOffset = 4;
        const dir = p.direction;
        let dx1 = 0, dy1 = 0, dx2 = 0, dy2 = 0;
        if (dir === "right") { dx1 = eyeOffset; dy1 = -3; dx2 = eyeOffset; dy2 = 3; }
        if (dir === "left") { dx1 = -eyeOffset; dy1 = -3; dx2 = -eyeOffset; dy2 = 3; }
        if (dir === "up") { dx1 = -3; dy1 = -eyeOffset; dx2 = 3; dy2 = -eyeOffset; }
        if (dir === "down") { dx1 = -3; dy1 = eyeOffset; dx2 = 3; dy2 = eyeOffset; }

        ctx.beginPath();
        ctx.arc(seg.x * gridSize + gridSize / 2 + dx1 / 2,
                seg.y * gridSize + gridSize / 2 + dy1 / 2, 2, 0, Math.PI * 2);
        ctx.arc(seg.x * gridSize + gridSize / 2 + dx2 / 2,
                seg.y * gridSize + gridSize / 2 + dy2 / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 🧮 Score text
    ctx.font = "14px Arial";

// สีชื่อของเราตรงกับสีงู
if (p.id === playerId) {
  ctx.fillStyle = p.color;
  ctx.fillText(`${p.name} (You): ${p.score}`, 5, 15);
} else {
  ctx.fillStyle = p.color;
  ctx.fillText(`${p.name}: ${p.score}`, 5, 35);
}

    // 💀 Game Over text
    if (!p.alive && p.id === playerId && gameOver) {
      ctx.fillStyle = "red";
      ctx.font = "30px Arial";
      ctx.fillText("💀 Game Over!", 100, 200);
    }
  }

  requestAnimationFrame(draw);
}
