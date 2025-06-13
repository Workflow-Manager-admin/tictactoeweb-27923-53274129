import React, { useEffect, useState, useRef } from "react";
import "./App.css";

// PUBLIC_INTERFACE
function getCellColor(value) {
  // Returns the appropriate color and style for the cell
  if (value === "X") return { color: "var(--primary-color)", fontWeight: 700 };
  if (value === "O") return { color: "var(--accent-color)", fontWeight: 700 };
  return {};
}

const API_BASE = process.env.REACT_APP_TICTACTOE_API || "http://localhost:8000";

// PUBLIC_INTERFACE
function fetchGame(gameId) {
  return fetch(`${API_BASE}/game/${gameId}`).then((res) => res.json());
}

// PUBLIC_INTERFACE
function createGame() {
  return fetch(`${API_BASE}/game`, {
    method: "POST"
  }).then((res) => res.json());
}

// PUBLIC_INTERFACE
function makeMove(gameId, row, col) {
  return fetch(`${API_BASE}/game/${gameId}/move`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ row, col })
  }).then((res) => res.json());
}

// PUBLIC_INTERFACE
function subscribeWs(gameId, onMessage) {
  const base = API_BASE.replace(/^http/, "ws");
  const ws = new window.WebSocket(`${base}/ws/game/${gameId}`);
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) { }
  };
  return ws;
}

function GameStatus({ status, winner, next, gameOver }) {
  let content = null;
  if (gameOver) {
    if (winner) content = (
      <span style={{ color: next === "X" ? "var(--primary-color)" : "var(--accent-color)", fontWeight: 700 }}>
        Winner: {winner}
      </span>
    );
    else content = <span style={{ color: "gray" }}>It's a draw!</span>;
  } else {
    content = (
      <span>
        Next: <span style={{ color: next === "X" ? "var(--primary-color)" : "var(--accent-color)", fontWeight: 700 }}>{next}</span>
      </span>
    );
  }
  return <div className="ttt-status">{content}</div>;
}

function TicTacToeBoard({ board, onCellClick, disabled }) {
  // Responsive 3x3 grid
  return (
    <div className="ttt-board">
      {board.map((row, rIdx) =>
        row.map((cell, cIdx) => (
          <button
            key={`cell-${rIdx}-${cIdx}`}
            className="ttt-cell"
            style={getCellColor(cell)}
            onClick={() => onCellClick(rIdx, cIdx)}
            disabled={!!cell || disabled}
            aria-label={`cell-${rIdx}-${cIdx}`}
          >{cell}</button>
        ))
      )}
    </div>
  );
}

const initialBoard = [
  ["", "", ""],
  ["", "", ""],
  ["", "", ""]
];

// PUBLIC_INTERFACE
function App() {
  const [gameId, setGameId] = useState(null);
  const [board, setBoard] = useState(initialBoard);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [next, setNext] = useState("X");
  const [error, setError] = useState("");
  const wsRef = useRef(null);

  // Color theme: Primary (green), Accent (blue), Secondary (yellow)
  useEffect(() => {
    document.documentElement.style.setProperty("--primary-color", "#4CAF50");
    document.documentElement.style.setProperty("--secondary-color", "#FFC107");
    document.documentElement.style.setProperty("--accent-color", "#2196F3");
    document.body.style.backgroundColor = "#f0f0f0";
  }, []);

  const handleNewGame = async () => {
    try {
      const { game_id, board, next_player } = await createGame();
      setGameId(game_id);
      setBoard(board);
      setNext(next_player);
      setWinner(null);
      setGameOver(false);
      setError("");
    } catch {
      setError("Could not start a new game. Is the backend running?");
    }
  };

  const handleCellClick = async (row, col) => {
    if (gameOver || !gameId) return;
    try {
      const { board, winner, game_over, next_player } = await makeMove(gameId, row, col);
      setBoard(board);
      setWinner(winner);
      setNext(next_player);
      setGameOver(game_over);
      setError("");
    } catch {
      setError("Failed to make a move");
    }
  };

  useEffect(() => {
    if (!gameId) return;
    // Fetch state when connecting to (or recovering) a game
    fetchGame(gameId).then((data) => {
      const { board, winner, next_player, game_over } = data;
      setBoard(board);
      setWinner(winner);
      setNext(next_player);
      setGameOver(game_over);
    });
    // WebSocket for real-time updates!
    wsRef.current = subscribeWs(gameId, (eventData) => {
      if ("board" in eventData) setBoard(eventData.board);
      if ("winner" in eventData) setWinner(eventData.winner);
      if ("game_over" in eventData) setGameOver(eventData.game_over);
      if ("next_player" in eventData) setNext(eventData.next_player);
    });
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [gameId]);

  return (
    <div className="app">
      <nav className="navbar" style={{ backgroundColor: "var(--primary-color)" }}>
        <div className="container">
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <div className="logo">
              <span className="logo-symbol">*</span> TicTacToeWeb
            </div>
            <button className="btn" style={{ background: "var(--accent-color)" }} onClick={handleNewGame}>
              New Game
            </button>
          </div>
        </div>
      </nav>

      <main>
        <div className="container">
          <div className="hero" style={{ minHeight: 300, paddingTop: 100 }}>
            <div className="subtitle" style={{ color: "var(--secondary-color)" }}>
              Real-Time, Responsive Tic Tac Toe
            </div>
            <h1 className="title" style={{
              color: "var(--primary-color)",
              fontWeight: 700,
              fontSize: 46
            }}>Tic Tac Toe</h1>
            <div className="description" style={{ fontSize: 18, marginBottom: 18 }}>
              Enjoy a classic Tic Tac Toe game with real-time updates!
              <br />
              Start a new game and challenge yourself or a nearby friend.
            </div>
            <GameStatus status={gameOver ? "done" : "active"} winner={winner} next={next} gameOver={gameOver} />
            <div className="ttt-board-wrap">
              <TicTacToeBoard board={board} onCellClick={handleCellClick} disabled={gameOver || !gameId} />
            </div>
            {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
            {!gameId && <button className="btn btn-large" style={{ background: "var(--secondary-color)", color: "black" }} onClick={handleNewGame}>
              Start Game
            </button>}
          </div>
        </div>
      </main>
      <footer style={{
        marginTop: "auto",
        textAlign: "center",
        padding: 16,
        color: "#777",
        fontSize: 13
      }}>
        Powered by React & FastAPI | <span style={{ color: "var(--accent-color)" }}>TicTacToeWeb</span>
      </footer>
    </div>
  );
}

export default App;
