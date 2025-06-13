from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uuid
from typing import Dict, List, Optional, Any


# PUBLIC_INTERFACE
def create_board():
    """Create an empty 3x3 board."""
    return [["" for _ in range(3)] for _ in range(3)]


# PUBLIC_INTERFACE
def check_winner(board: List[List[str]]) -> Optional[str]:
    """Check for a winner on the board."""
    lines = []
    # Rows and columns
    for i in range(3):
        lines.append([board[i][0], board[i][1], board[i][2]])  # row
        lines.append([
            board[0][i],
            board[1][i],
            board[2][i]
        ])  # col
    # Diagonals
    lines.append([
        board[0][0],
        board[1][1],
        board[2][2]
    ])
    lines.append([
        board[0][2],
        board[1][1],
        board[2][0]
    ])
    for line in lines:
        if line[0] and all(cell == line[0] for cell in line):
            return line[0]
    return None


# PUBLIC_INTERFACE
def is_full(board: List[List[str]]):
    """Check if the board is full (draw)."""
    return all(cell for row in board for cell in row)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# In-memory data: {"game_id": { "board": ..., "next": "X", "winner": ..., "game_over": bool, "clients": set() }}
games: Dict[str, Dict[str, Any]] = {}

# WebSocket connections tracking
ws_connections: Dict[str, List[WebSocket]] = {}


@app.get("/")
def health_check():
    return {"message": "Healthy"}


# PUBLIC_INTERFACE
@app.post("/game")
def new_game():
    """Create a new game and return its ID and board."""
    gid = str(uuid.uuid4())
    board = create_board()
    games[gid] = {
        "board": board,
        "next": "X",
        "winner": None,
        "game_over": False,
    }
    return {"game_id": gid, "board": board, "next_player": "X"}


# PUBLIC_INTERFACE
@app.get("/game/{game_id}")
def get_game(game_id: str):
    """Get the full state of the game."""
    g = games.get(game_id)
    if not g:
        raise HTTPException(status_code=404, detail="Game not found")
    response = {
        "game_id": game_id,
        "board": g["board"],
        "next_player": g["next"],
        "winner": g["winner"],
        "game_over": g["game_over"],
    }
    return response


# PUBLIC_INTERFACE
@app.post("/game/{game_id}/move")
def make_move(game_id: str, move: Dict[str, int]):
    """Apply a move {row, col} and update the game state."""
    g = games.get(game_id)
    if not g:
        raise HTTPException(status_code=404, detail="Game not found")
    row = move.get("row")
    col = move.get("col")
    if g["game_over"]:
        return g
    if row not in {0, 1, 2} or col not in {0, 1, 2}:
        raise HTTPException(status_code=400, detail="Invalid cell")
    if g["board"][row][col]:
        raise HTTPException(status_code=400, detail="Cell already taken")
    g["board"][row][col] = g["next"]
    winner = check_winner(g["board"])
    if winner:
        g["winner"] = winner
        g["game_over"] = True
    elif is_full(g["board"]):
        g["game_over"] = True
    else:
        g["next"] = "O" if g["next"] == "X" else "X"
    # Notify over websocket if any
    broadcast_update(game_id)
    return {
        "game_id": game_id,
        "board": g["board"],
        "next_player": g["next"],
        "winner": g["winner"],
        "game_over": g["game_over"],
    }


def broadcast_update(game_id):
    game = games.get(game_id)
    if not game or not ws_connections.get(game_id):
        return
    update = {
        "board": game["board"],
        "next_player": game["next"],
        "winner": game["winner"],
        "game_over": game["game_over"],
    }
    # Remove closed websockets
    still_alive = []
    for ws in ws_connections[game_id]:
        try:
            ws.send_json(update)
            still_alive.append(ws)
        except Exception:
            pass
    ws_connections[game_id] = still_alive


# PUBLIC_INTERFACE
@app.websocket("/ws/game/{game_id}")
async def ws_game(websocket: WebSocket, game_id: str):
    await websocket.accept()
    if game_id not in ws_connections:
        ws_connections[game_id] = []
    ws_connections[game_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()
            # No need to process messages: only server pushes (broadcast_update)
    except WebSocketDisconnect:
        ws_connections[game_id].remove(websocket)
