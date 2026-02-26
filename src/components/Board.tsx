/**
 * 盤面コンポーネント
 */

import type { Cell } from "../game/types";
import "../styles/Board.css";

interface BoardProps {
  board: Cell[][];
  onCellClick: (x: number, y: number) => void;
  onDropTile?: (x: number, y: number, data: string) => void;
}

function multiplierLabel(m: Cell["multiplier"]): string {
  switch (m) {
    case "DL": return "DL";
    case "TL": return "TL";
    case "DW": return "DW";
    case "TW": return "TW";
    default: return "";
  }
}

export function Board({ board, onCellClick, onDropTile }: BoardProps) {
  const size = board.length;

  return (
    <div
      className="board"
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gridTemplateRows: `repeat(${size}, 1fr)`,
      }}
    >
      {board.map((row, y) =>
        row.map((cell, x) => {
          const char = cell.pending ?? cell.char;
          const isPending = cell.pending !== null;
          const isFree = isPending && cell.pending !== null;
          const mLabel = multiplierLabel(cell.multiplier);

          return (
            <div
              key={`${x}-${y}`}
              className={[
                "cell",
                isPending ? "cell--pending" : "",
                cell.char ? "cell--confirmed" : "",
                cell.multiplier !== "NONE" && !char ? `cell--${cell.multiplier.toLowerCase()}` : "",
                isPending && isFree ? "" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onCellClick(x, y)}
              onDragOver={(e) => {
                if (cell.char === null && cell.pending === null) {
                  e.preventDefault();
                  e.currentTarget.classList.add("cell--dragover");
                }
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("cell--dragover");
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("cell--dragover");
                const data = e.dataTransfer.getData("text/plain");
                if (data && onDropTile) {
                  onDropTile(x, y, data);
                }
              }}
            >
              {char ? (
                <span className="cell__char">{char}</span>
              ) : mLabel ? (
                <span className="cell__multiplier">{mLabel}</span>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
