const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".board");
const turnInfo = document.getElementById("turnInfo");

const gameOverPopup = document.getElementById("gameOverPopup");
const gameOverTitle = document.getElementById("gameOverTitle");
const gameOverText = document.getElementById("gameOverText");
const closePopup = document.getElementById("closePopup");
const rematchBtn = document.getElementById("rematchBtn");



let gameOver = false;

closePopup.addEventListener("click", () => {
  gameOverPopup.classList.add("hidden");
});

rematchBtn.addEventListener("click", () => {
  socket.emit("rematch");
});


console.log("game.js loaded");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;

const updateTurnInfo = () => {
  const turn = chess.turn(); // 'w' | 'b'

  // Spectator before game starts
  if (playerRole === null && chess.history().length === 0) {
    turnInfo.textContent = "Waiting for players…";
    turnInfo.className =
      "w-96 text-center py-2 rounded bg-zinc-800 text-sm font-semibold";
    return;
  }

  // Spectator view (always objective)
  if (playerRole === null) {
    turnInfo.textContent = turn === "w" ? "♙ White’s turn" : "♟ Black’s turn";
    turnInfo.className =
      "w-96 text-center py-2 rounded bg-zinc-800 text-sm font-semibold";
    return;
  }

  // Player POV
  const isYourTurn = turn === playerRole;

  if (isYourTurn) {
    turnInfo.textContent = "✅ Your turn";
    turnInfo.className =
      "w-96 text-center py-2 rounded bg-zinc-800 text-sm font-semibold turn-white";
  } else {
    turnInfo.textContent = "⏳ Opponent’s turn";
    turnInfo.className =
      "w-96 text-center py-2 rounded bg-zinc-800 text-sm font-semibold turn-black";
  }
};

const checkGameStatus = () => {
  if (chess.in_checkmate()) {
    gameOver = true;

    const winner = chess.turn() === "w" ? "Black" : "White";

    gameOverTitle.textContent = "♚ Checkmate!";
    gameOverText.textContent = `${winner} wins the game`;

    gameOverPopup.classList.remove("hidden");
    return;
  }

  if (chess.in_check()) {
    gameOverTitle.textContent = "⚠ Check";
    gameOverText.textContent = "King is in check!";
    gameOverPopup.classList.remove("hidden");

    setTimeout(() => {
      gameOverPopup.classList.add("hidden");
    }, 1200);
  }
};

const handleMove = (source, target) => {
  if (gameOver) return;

  const isBlack = playerRole === "b";

  const fromRow = isBlack ? 7 - source.row : source.row;
  const fromCol = isBlack ? 7 - source.col : source.col;
  const toRow = isBlack ? 7 - target.row : target.row;
  const toCol = isBlack ? 7 - target.col : target.col;

  const move = {
    from: `${String.fromCharCode(97 + fromCol)}${8 - fromRow}`,
    to: `${String.fromCharCode(97 + toCol)}${8 - toRow}`,
    promotion: "q",
  };

  socket.emit("move", move);
};

const renderBoard = () => {
  const rawBoard = chess.board();
  const board =
    playerRole === "b"
      ? rawBoard
          .slice()
          .reverse()
          .map((row) => row.slice().reverse())
      : rawBoard;

  boardElement.innerHTML = "";
  board.forEach((row, rowIndex) => {
    row.forEach((square, squareIndex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add(
        "square",
        (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark",
      );

      squareElement.dataset.row = rowIndex;
      squareElement.dataset.col = squareIndex;

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add(
          "piece",
          square.color === "w" ? "white" : "black",
        );

        pieceElement.innerHTML = getPieceUnicode(square);
        pieceElement.draggable =
          playerRole !== null &&
          square.color === playerRole &&
          chess.turn() === playerRole &&
          !gameOver;

        pieceElement.addEventListener("dragstart", (e) => {
          if (pieceElement.draggable) {
            draggedPiece = pieceElement;
            sourceSquare = { row: rowIndex, col: squareIndex };
            e.dataTransfer.setData("text/plain", "");
          }
        });
        pieceElement.addEventListener("dragend", (e) => {
          draggedPiece = null;
          sourceSquare = null;
        });
        squareElement.appendChild(pieceElement);
      }
      squareElement.addEventListener("dragover", (e) => {
        e.preventDefault();
      });
      squareElement.addEventListener("drop", (e) => {
        e.preventDefault();
        if (draggedPiece) {
          const tragetSource = {
            row: parseInt(squareElement.dataset.row),
            col: parseInt(squareElement.dataset.col),
          };

          handleMove(sourceSquare, tragetSource);
        }
      });
      boardElement.appendChild(squareElement);
    });
  });

  updateTurnInfo();
  checkGameStatus();

};

socket.on("rematchStarted", () => {
  gameOver = false;
  gameOverPopup.classList.add("hidden");
  chess.reset();
  renderBoard();
});


const getPieceUnicode = (piece) => {
  const unicodePieces = {
    p: "♟",
    r: "♜",
    n: "♞",
    b: "♝",
    q: "♛",
    k: "♚",
    P: "♙",
    R: "♖",
    N: "♘",
    B: "♗",
    Q: "♕",
    K: "♔",
  };

  return unicodePieces[piece.type] || "";
};

socket.on("playerRole", (role) => {
  playerRole = role;
  renderBoard();
});

socket.on("spectatorRole", (role) => {
  playerRole = null;
  renderBoard();
});

socket.on("boardState", (fen) => {
  chess.load(fen);
  renderBoard();
});

renderBoard();
