const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");
const { title } = require("process");
const { error } = require("console");

const app = express();
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {};

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { title: "ChessKhelo" });
});

const resetGame = () => {
  chess.reset();
  io.emit("boardState", chess.fen());
  io.emit("rematchStarted");
};


io.on("connection", (socket) => {
  console.log(`${socket.id}:Connected`);
  if (!players.white) {
    players.white = socket.id;
    socket.emit("playerRole", "w");
  } else if (!players.black) {
    players.black = socket.id;
    socket.emit("playerRole", "b");
  } else {
    socket.emit("spectatorRole");
  }

  socket.on("rematch", () => {
  resetGame();
});


  socket.emit("boardState", chess.fen());

  socket.on("disconnect", () => {
    if (socket.id === players.white) {
      delete players.white;
    } else if (socket.id === players.black) {
      delete players.black;
    }
  });

  socket.on("move", (move) => {
    try {
      if (chess.turn() === "w" && socket.id !== players.white) return;
      if (chess.turn() === "b" && socket.id !== players.black) return;

      const result = chess.move(move);
      if (result) {
        io.emit("boardState", chess.fen());
      } else {
        console.log("Invalid Move: ", move);
        socket.emit("InvalidMove", move);
    }
} catch (error) {
  console.log("Invalid Move:", move);
  socket.emit("InvalidMove", move);
}
  });
});

server.listen(3000, () => {
  console.log("Runnin!!!");
});
  