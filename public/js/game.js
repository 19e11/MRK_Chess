const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".board");
const turnInfo = document.getElementById("turnInfo");

const gameOverPopup = document.getElementById("gameOverPopup");
const gameOverTitle = document.getElementById("gameOverTitle");
const gameOverText = document.getElementById("gameOverText");
const closePopup = document.getElementById("closePopup");
const rematchBtn = document.getElementById("rematchBtn");
let gameStarted = false;
let gameOver = false;
let wasDragging = false;
let selectedSquare = null;
let validMoves = [];

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
  if (!gameStarted) {
    turnInfo.textContent = "Waiting for opponent…";
    turnInfo.className =
      "w-96 text-center py-2 rounded bg-zinc-800 text-sm font-semibold";
    return;
  }

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

const toChessSquare = (row, col) => {
  const isBlack = playerRole === "b";
  const realRow = isBlack ? 7 - row : row;
  const realCol = isBlack ? 7 - col : col;
  return `${String.fromCharCode(97 + realCol)}${8 - realRow}`;
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

      squareElement.addEventListener("click", () => {
        if (wasDragging) return;
        if (!gameStarted || gameOver) return;

        // If no piece selected → do nothing
        if (!selectedSquare) return;

        const targetSq = toChessSquare(rowIndex, squareIndex);

        // Invalid click → clear selection
        if (!validMoves.includes(targetSq)) {
          selectedSquare = null;
          validMoves = [];
          renderBoard();
          return;
        }

        // Valid click move
        handleMove(selectedSquare, { row: rowIndex, col: squareIndex });

        selectedSquare = null;
        validMoves = [];
      });

      if (selectedSquare) {
        const sq = toChessSquare(rowIndex, squareIndex);
        if (validMoves.includes(sq)) {
          squareElement.classList.add("valid-move");
        }
      }

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add(
          "piece",
          square.color === "w" ? "white" : "black",
        );

        pieceElement.innerHTML = getPieceUnicode(square);
        pieceElement.draggable =
          gameStarted &&
          playerRole !== null &&
          square.color === playerRole &&
          chess.turn() === playerRole &&
          !gameOver;

        pieceElement.addEventListener("mousedown", () => {
          if (!pieceElement.draggable) return;

          selectedSquare = { row: rowIndex, col: squareIndex };

          const from = toChessSquare(rowIndex, squareIndex);
          validMoves = chess
            .moves({ square: from, verbose: true })
            .map((m) => m.to);

          renderBoard();
        });

        pieceElement.addEventListener("dragstart", (e) => {
          wasDragging = true;
          if (!pieceElement.draggable) return;

          draggedPiece = pieceElement;
          sourceSquare = { row: rowIndex, col: squareIndex };

          // renderBoard();

          e.dataTransfer.setData("text/plain", "");
        });

        pieceElement.addEventListener("dragend", (e) => {
          setTimeout(() => (wasDragging = false), 0);
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
        if (!draggedPiece) return;

        const targetSource = {
          row: parseInt(squareElement.dataset.row),
          col: parseInt(squareElement.dataset.col),
        };

        const targetSq = toChessSquare(targetSource.row, targetSource.col);

        if (!validMoves.includes(targetSq)) {
          draggedPiece = null;
          sourceSquare = null;
          selectedSquare = null;
          validMoves = [];
          renderBoard();
          return;
        }

        handleMove(sourceSquare, targetSource);

        draggedPiece = null;
        sourceSquare = null;
        selectedSquare = null;
        validMoves = [];
      });

      boardElement.appendChild(squareElement);
    });
  });

  updateTurnInfo();
  // checkGameStatus();
};

socket.on("rematchStarted", () => {
  gameOver = false;
  gameStarted = true;
  selectedSquare = null;
  validMoves = [];
  gameOverPopup.classList.add("hidden");
  chess.reset();
  renderBoard();
});

socket.on("gameStart", () => {
  gameStarted = true;
  turnInfo.textContent = "Game started!";
  renderBoard();
});

socket.on("waitingForPlayer", () => {
  gameStarted = false;
  turnInfo.textContent = "Waiting for opponent…";
});

socket.on("gameOver", ({ reason }) => {
  gameOver = true;

  gameOverTitle.textContent =
    reason === "checkmate" ? "♚ Checkmate!" : "🤝 Draw";

  gameOverText.textContent =
    reason === "checkmate" ? "Game over" : "The game ended in a draw";

  gameOverPopup.classList.remove("hidden");
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
