import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";

const GRID_MAP = [
  "###############",
  "#.............#",
  "#.###.###.###.#",
  "#.............#",
  "#.###.#.#.###.#",
  "#.....#.#.....#",
  "###.#.###.#.###",
  "#.............#",
  "#.###.###.###.#",
  "#.............#",
  "###############",
];

const DIRECTIONS = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

const START_POSITION = { row: 1, col: 1 };
const GHOST_STARTS = [
  { row: 5, col: 7, color: "pink" },
  { row: 7, col: 7, color: "cyan" },
];

const GAME_SPEED = 220;
const MOVE_ORDER = ["up", "left", "down", "right"];

const buildDots = () => {
  const dots = new Set();
  GRID_MAP.forEach((row, rowIndex) => {
    row.split("").forEach((cell, colIndex) => {
      if (cell === ".") {
        dots.add(`${rowIndex},${colIndex}`);
      }
    });
  });
  return dots;
};

const isWall = (row, col) => GRID_MAP[row]?.[col] === "#";

const App = () => {
  const [pacman, setPacman] = useState({ ...START_POSITION });
  const [direction, setDirection] = useState("right");
  const [nextDirection, setNextDirection] = useState("right");
  const [ghosts, setGhosts] = useState(() =>
    GHOST_STARTS.map((ghost) => ({
      ...ghost,
      direction: "left",
    }))
  );
  const [dots, setDots] = useState(() => buildDots());
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [status, setStatus] = useState("ready");
  const intervalRef = useRef(null);

  const totalDots = useMemo(() => buildDots().size, []);

  const resetPositions = useCallback(() => {
    setPacman({ ...START_POSITION });
    setDirection("right");
    setNextDirection("right");
    setGhosts(
      GHOST_STARTS.map((ghost) => ({
        ...ghost,
        direction: "left",
      }))
    );
  }, []);

  const resetGame = useCallback(() => {
    resetPositions();
    setDots(buildDots());
    setScore(0);
    setLives(3);
    setStatus("ready");
  }, [resetPositions]);

  const canMove = useCallback((row, col) => !isWall(row, col), []);

  const moveEntity = useCallback(
    (position, nextDirectionValue, fallbackDirection) => {
      const tryDirection = (dir) => {
        const delta = DIRECTIONS[dir];
        const nextRow = position.row + delta.row;
        const nextCol = position.col + delta.col;
        if (canMove(nextRow, nextCol)) {
          return { row: nextRow, col: nextCol, direction: dir };
        }
        return null;
      };

      return (
        tryDirection(nextDirectionValue) ||
        tryDirection(fallbackDirection) ||
        { ...position, direction: fallbackDirection }
      );
    },
    [canMove]
  );

  const getAvailableMoves = useCallback((position) => {
    return MOVE_ORDER.filter((dir) => {
      const delta = DIRECTIONS[dir];
      return canMove(position.row + delta.row, position.col + delta.col);
    });
  }, [canMove]);

  const handleTick = useCallback(() => {
    setPacman((prev) => {
      const moved = moveEntity(prev, nextDirection, direction);
      setDirection(moved.direction);
      return { row: moved.row, col: moved.col };
    });

    setGhosts((prevGhosts) =>
      prevGhosts.map((ghost) => {
        const availableMoves = getAvailableMoves(ghost);
        let nextMove = ghost.direction;

        if (!availableMoves.includes(nextMove)) {
          nextMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
        } else if (Math.random() > 0.65) {
          nextMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }

        const delta = DIRECTIONS[nextMove];
        return {
          ...ghost,
          row: ghost.row + delta.row,
          col: ghost.col + delta.col,
          direction: nextMove,
        };
      })
    );
  }, [direction, getAvailableMoves, moveEntity, nextDirection]);

  useEffect(() => {
    if (status !== "playing") {
      return undefined;
    }

    intervalRef.current = setInterval(handleTick, GAME_SPEED);
    return () => clearInterval(intervalRef.current);
  }, [handleTick, status]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const keyMap = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const next = keyMap[event.key];
      if (next) {
        event.preventDefault();
        setNextDirection(next);
      }
      if (event.key === " " && status !== "playing") {
        setStatus("playing");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status]);

  useEffect(() => {
    const pacKey = `${pacman.row},${pacman.col}`;
    if (dots.has(pacKey)) {
      setDots((prev) => {
        const updated = new Set(prev);
        updated.delete(pacKey);
        return updated;
      });
      setScore((prev) => prev + 10);
    }
  }, [dots, pacman]);

  useEffect(() => {
    const ghostCollision = ghosts.some(
      (ghost) => ghost.row === pacman.row && ghost.col === pacman.col
    );
    if (!ghostCollision) {
      return;
    }

    setLives((prev) => {
      const nextLives = prev - 1;
      if (nextLives <= 0) {
        setStatus("lost");
      } else {
        setStatus("ready");
        resetPositions();
      }
      return nextLives;
    });
  }, [ghosts, pacman, resetPositions]);

  useEffect(() => {
    if (dots.size === 0 && status === "playing") {
      setStatus("won");
    }
  }, [dots.size, status]);

  const handleControl = (dir) => {
    setNextDirection(dir);
  };

  const handleStart = () => {
    setStatus("playing");
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Pac-Runner</h1>
          <p className="subtitle">Collect all dots and dodge the ghosts.</p>
        </div>
        <div className="scoreboard">
          <div>
            <span className="label">Score</span>
            <span className="value">{score}</span>
          </div>
          <div>
            <span className="label">Lives</span>
            <span className="value">{lives}</span>
          </div>
          <div>
            <span className="label">Dots</span>
            <span className="value">
              {totalDots - dots.size}/{totalDots}
            </span>
          </div>
        </div>
      </header>

      <section className="game-panel">
        <div className="game-grid">
          {GRID_MAP.map((row, rowIndex) =>
            row.split("").map((cell, colIndex) => {
              const key = `${rowIndex}-${colIndex}`;
              const isPacman = pacman.row === rowIndex && pacman.col === colIndex;
              const ghost = ghosts.find(
                (ghostItem) => ghostItem.row === rowIndex && ghostItem.col === colIndex
              );
              const hasDot = dots.has(`${rowIndex},${colIndex}`);

              return (
                <div
                  key={key}
                  className={[
                    "cell",
                    cell === "#" ? "wall" : "path",
                    hasDot ? "dot" : "",
                    isPacman ? `pacman ${direction}` : "",
                    ghost ? `ghost ${ghost.color}` : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              );
            })
          )}
        </div>

        <div className="status-panel">
          {status === "ready" && (
            <div className="status-card">
              <h2>Ready?</h2>
              <p>Tap start or press space. Use the arrows or the D-pad below.</p>
              <button type="button" onClick={handleStart} className="primary">
                Start
              </button>
            </div>
          )}
          {status === "won" && (
            <div className="status-card">
              <h2>You cleared the maze!</h2>
              <p>Score {score}. Want another round?</p>
              <button type="button" onClick={resetGame} className="primary">
                Play again
              </button>
            </div>
          )}
          {status === "lost" && (
            <div className="status-card">
              <h2>Game over</h2>
              <p>Ghosts got you. Try again?</p>
              <button type="button" onClick={resetGame} className="primary">
                Restart
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="controls">
        <div className="dpad">
          <button type="button" onClick={() => handleControl("up")}>
            ▲
          </button>
          <div className="dpad-row">
            <button type="button" onClick={() => handleControl("left")}>
              ◀
            </button>
            <button type="button" onClick={() => handleControl("down")}>
              ▼
            </button>
            <button type="button" onClick={() => handleControl("right")}>
              ▶
            </button>
          </div>
        </div>
        <div className="control-hint">
          <p>
            Tip: Add this to your iPhone home screen for a full-screen arcade vibe.
          </p>
        </div>
      </section>
    </div>
  );
};

export default App;
