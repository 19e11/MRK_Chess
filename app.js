const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const chess = new Chess();
let players = { white: null, black: null };
let gameStarted = false;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { title: "ChessKhelo" });
});

const resetGame = () => {
  chess.reset();
  gameStarted = true;
  io.emit("boardState", chess.fen());
  io.emit("rematchStarted");
};

io.on("connection", (socket) => {
  console.log(`${socket.id} connected`);

  // Assign roles
  if (!players.white) {
    players.white = socket.id;
    socket.emit("playerRole", "w");
  } else if (!players.black) {
    players.black = socket.id;
    socket.emit("playerRole", "b");
  } else {
    socket.emit("spectatorRole");
  }

  // Start game only when both players are present
  if (players.white && players.black && !gameStarted) {
    gameStarted = true;
    io.emit("gameStart");
  }

  socket.emit("boardState", chess.fen());

  socket.on("move", (move) => {
    if (!gameStarted) return;

    try {
      if (chess.turn() === "w" && socket.id !== players.white) return;
      if (chess.turn() === "b" && socket.id !== players.black) return;

      const result = chess.move(move);
      if (!result) {
        socket.emit("InvalidMove", move);
        return;
      }

      io.emit("boardState", chess.fen());

      if (chess.isGameOver()) {
        io.emit("gameOver", {
          reason: chess.isCheckmate() ? "checkmate" : "draw",
        });
      }
    } catch {
      socket.emit("InvalidMove");
    }
  });

  socket.on("rematch", () => {
    if (players.white && players.black) {
      resetGame();
    }
  });

  socket.on("disconnect", () => {
    console.log(`${socket.id} disconnected`);

    if (socket.id === players.white) players.white = null;
    if (socket.id === players.black) players.black = null;

    gameStarted = false;
    io.emit("waitingForPlayer");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
