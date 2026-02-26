/**
 * 手の妥当性を検証する。
 */

import type { GameState, ValidationResult } from "../types";
import { cellChar } from "./helpers";
import { extractFormedWords } from "./extractWords";

export function validateMove(
  state: GameState,
  dict: Set<string>
): ValidationResult {
  const { board, placedThisTurn } = state;

  if (placedThisTurn.length === 0) {
    return { ok: false, reason: "タイルが1枚も置かれていません。" };
  }

  // 一直線チェック
  const xs = placedThisTurn.map((p) => p.x);
  const ys = placedThisTurn.map((p) => p.y);
  const sameRow = ys.every((y) => y === ys[0]);
  const sameCol = xs.every((x) => x === xs[0]);

  if (!sameRow && !sameCol) {
    return { ok: false, reason: "タイルは横一列または縦一列に置いてください。" };
  }

  // 隙間チェック
  if (sameRow && placedThisTurn.length > 1) {
    const y = ys[0];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    for (let x = minX; x <= maxX; x++) {
      if (cellChar(board[y][x]) === null) {
        return { ok: false, reason: "タイルの間に隙間があります。" };
      }
    }
  }
  if (sameCol && placedThisTurn.length > 1) {
    const x = xs[0];
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    for (let y = minY; y <= maxY; y++) {
      if (cellChar(board[y][x]) === null) {
        return { ok: false, reason: "タイルの間に隙間があります。" };
      }
    }
  }

  // 既存タイルとの連結チェック (初手以外)
  const boardHasConfirmed = board.some((row) => row.some((c) => c.char !== null));
  if (boardHasConfirmed) {
    const isConnected = placedThisTurn.some((p) => {
      const neighbors = [
        [p.x - 1, p.y],
        [p.x + 1, p.y],
        [p.x, p.y - 1],
        [p.x, p.y + 1],
      ];
      return neighbors.some(([nx, ny]) => {
        const cell = board[ny]?.[nx];
        return cell?.char !== null && cell?.char !== undefined;
      });
    });
    if (!isConnected) {
      return { ok: false, reason: "既存のタイルに隣接させてください。" };
    }
  }

  // 形成単語を抽出し辞書照合
  const formedWords = extractFormedWords(board, placedThisTurn);

  if (formedWords.length === 0) {
    return { ok: false, reason: "単語が形成されていません。" };
  }

  const wordStrings = formedWords.map((w) => w.word.toUpperCase());

  for (const w of wordStrings) {
    if (!dict.has(w)) {
      return {
        ok: false,
        reason: `「${w}」は辞書にありません。`,
        formedWords: wordStrings,
      };
    }
  }

  return { ok: true, formedWords: wordStrings };
}
