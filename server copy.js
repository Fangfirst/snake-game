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
let gameInterval = null;

function spawnFood() {
  return {
    x: Math.floor(Math.random() * MAP_SIZE),
    y: Math.floor(Math.random() * MAP_SIZE),
  };
}

function resetGame() {
  for (let id in players) {
    players[id].snake = [
      { x: Math.floor(Math.random() * MAP_SIZE), y: Math.floor(Math.random() * MAP_SIZE) },
    ];
    players[id].alive = true;
    players[id].score = 0;
    players[id].speed = 200;
  }
  food = spawnFood();
  gameStarted = true;
  io.emit("start", { food });
  if (gameInterval) clearInterval(gameInterval);
  startGameLoop();
}

function startGameLoop() {
  gameInterval = setInterval(() => {
    if (!gameStarted) return;

    for (let id in players) {
      const player = players[id];
      if (!player.alive) continue;

      const head = { ...player.snake[0] };

      if (player.direction === "up") head.y--;
      if (player.direction === "down") head.y++;
      if (player.direction === "left") head.x--;
      if (player.direction === "right") head.x++;

      if (head.x < 0 || head.x >= MAP_SIZE || head.y < 0 || head.y >= MAP_SIZE) {
        player.alive = false;
        continue;
      }

      if (player.snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
        player.alive = false;
        continue;
      }

      for (let otherId in players) {
        if (otherId === id) continue;
        const other = players[otherId];
        if (other.snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
          player.alive = false;
        }
      }

      player.snake.unshift(head);

      if (food && head.x === food.x && head.y === food.y) {
        player.score++;
        food = spawnFood();
        io.emit("food", food);
      } else {
        player.snake.pop();
      }
    }

    io.emit("players", players);

    const aliveCount = Object.values(players).filter((p) => p.alive).length;
    if (aliveCount <= 1) {
      gameStarted = false;
      io.emit("gameOver", players);
      clearInterval(gameInterval);
    }
  }, 200);
}

io.on("connection", (socket) => {
  console.log("✅ Player connected:", socket.id);

  if (Object.keys(players).length >= 2) {
    socket.emit("full");
    socket.disconnect();
    return;
  }

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

  socket.on("move", (dir) => {
    const valid = ["up", "down", "left", "right"];
    if (valid.includes(dir)) players[socket.id].direction = dir;
  });
// socket.on("move", (dir) => {
//   const player = players[socket.id];
//   if (player && player.alive) {
//     player.direction = dir;
//     moveSnake(player);
//     io.emit("players", players);
//   }
// });


  // 🧩 Skill System
  socket.on("useSkill", (type) => {
    const player = players[socket.id];
    const opponentId = Object.keys(players).find((id) => id !== socket.id);
    const opponent = players[opponentId];

    if (!player || !opponent) return;

    if (type === "speedUp") {
      io.to(socket.id).emit("speedChange", 1000);
    }

    if (type === "slowEnemy") {
      io.to(opponentId).emit("speedChange", 60000);
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

  socket.on("restart", () => {
    if (Object.keys(players).length === 2) resetGame();
  });

  socket.on("disconnect", () => {
    console.log("❌ Player disconnected:", socket.id);
    delete players[socket.id];
    gameStarted = false;
    io.emit("lobby", { players, waiting: true });
    if (gameInterval) clearInterval(gameInterval);
  });
});

server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
