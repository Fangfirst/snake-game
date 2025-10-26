const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const PORT = 3000;
const GRID_SIZE = 20;
const MAP_SIZE = 20;

let players = {};
let food = null;
let gameStarted = false;

// ==================== Helper Functions =====================
function spawnFood() {
  return {
    x: Math.floor(Math.random() * MAP_SIZE),
    y: Math.floor(Math.random() * MAP_SIZE),
  };
}

// ฟังก์ชันขยับงูทีละช่อง (เรียกเมื่อผู้เล่นกดปุ่ม)
function moveSnake(player) {
  const head = { ...player.snake[0] };

  if (player.direction === "up") head.y--;
  if (player.direction === "down") head.y++;
  if (player.direction === "left") head.x--;
  if (player.direction === "right") head.x++;

  // ชนขอบ
  if (head.x < 0 || head.x >= MAP_SIZE || head.y < 0 || head.y >= MAP_SIZE) {
    player.alive = false;
    return;
  }

  // ชนตัวเอง
  if (player.snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
    player.alive = false;
    return;
  }

  // ชนคนอื่น
  for (let id in players) {
    if (id === player.id) continue;
    const other = players[id];
    if (other.snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
      player.alive = false;
      return;
    }
  }

  player.snake.unshift(head);

  // กินผลไม้
  if (food && head.x === food.x && head.y === food.y) {
    player.score++;
    food = spawnFood();
    io.emit("food", food);
  } else {
    player.snake.pop();
  }
}

// ==================== Reset Game =====================
function resetGame() {
  for (let id in players) {
    players[id].snake = [
      { x: Math.floor(Math.random() * MAP_SIZE), y: Math.floor(Math.random() * MAP_SIZE) },
    ];
    players[id].alive = true;
    players[id].score = 0;
    players[id].speed = 200;
    players[id].direction = "right"; // reset direction
  }
  food = spawnFood();
  gameStarted = true;
  io.emit("start", { food });
}

// ==================== Socket.io =====================
io.on("connection", (socket) => {
  console.log("✅ Player connected:", socket.id);

  // จำกัดแค่ 2 คน
  if (Object.keys(players).length >= 2) {
    socket.emit("full");
    socket.disconnect();
    return;
  }

  // ตั้งชื่อและสีผู้เล่น
  socket.on("setName", (name) => {
    players[socket.id] = {
      id: socket.id,
      name: name || `Player ${Object.keys(players).length + 1}`,
      snake: [
        { x: Math.floor(Math.random() * MAP_SIZE), y: Math.floor(Math.random() * MAP_SIZE) },
      ],
      direction: "right",
      color: Object.keys(players).length === 0 ? "limegreen" : "deepskyblue",
      alive: true,
      score: 0,
      speed: 200,
    };

    io.emit("lobby", { players, waiting: Object.keys(players).length < 2 });

    if (Object.keys(players).length === 2 && !gameStarted) {
      resetGame();
    }
  });

  // ==================== Move (ขยับเมื่อผู้เล่นกดเอง) =====================
  socket.on("move", (dir) => {
    const player = players[socket.id];
    if (!player || !player.alive) return;

    const valid = ["up", "down", "left", "right"];
    if (!valid.includes(dir)) return;

    player.direction = dir;
    moveSnake(player);

    io.emit("players", players);

    // ตรวจว่ามีคนแพ้หมดหรือยัง
    const aliveCount = Object.values(players).filter((p) => p.alive).length;
    if (aliveCount <= 1) {
      gameStarted = false;
      io.emit("gameOver", players);
    }
  });

  // ==================== Skill System =====================
  socket.on("useSkill", (type) => {
    const player = players[socket.id];
    const opponentId = Object.keys(players).find((id) => id !== socket.id);
    const opponent = players[opponentId];

    if (!player || !opponent) return;

    if (type === "speedUp") {
      io.to(socket.id).emit("speedChange", 1000); // เร่งตัวเอง 1 วิ
    }

    if (type === "slowEnemy") {
      io.to(opponentId).emit("speedChange", 60000); // ศัตรูช้า 1 นาที
    }

    if (type === "reduceEnemy") {
      const chance = Math.random();
      if (chance < 0.8) { // 80% โอกาสเกิด
        const cut = Math.floor(Math.random() * 4);
        opponent.snake = opponent.snake.slice(0, Math.max(1, opponent.snake.length - cut));
        opponent.score = Math.max(0, opponent.score - cut);
      }
    }
  });

  // ==================== Restart Game =====================
  socket.on("restart", () => {
    if (Object.keys(players).length === 2) resetGame();
  });

  // ==================== Disconnect =====================
  socket.on("disconnect", () => {
    console.log("❌ Player disconnected:", socket.id);
    delete players[socket.id];
    gameStarted = false;
    io.emit("lobby", { players, waiting: true });
  });
});

// ==================== Start Server =====================
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
