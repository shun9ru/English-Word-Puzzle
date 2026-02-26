/**
 * 盤面から「今回の仮置きで新しくできた単語」を抽出する。
 * Scrabble ルールに準拠: 仮置きタイルを含む横・縦の連続文字列を抽出。
 */

import type { Cell, Placement } from "../types";
import { cellChar } from "./helpers";

interface ExtractedWord {
  word: string;
  cells: { x: number; y: number }[];
}

/**
 * 仮置きタイルに隣接・連結する単語をすべて抽出する。
 * 1文字だけの「単語」は除外する。
 */
export function extractFormedWords(
  board: Cell[][],
  placements: Placement[]
): ExtractedWord[] {
  if (placements.length === 0) return [];

  const size = board.length;
  const words: ExtractedWord[] = [];
  const seen = new Set<string>();

  const traceWord = (
    startX: number,
    startY: number,
    dx: number,
    dy: number
  ): ExtractedWord | null => {
    let sx = startX;
    let sy = startY;
    while (true) {
      const nx = sx - dx;
      const ny = sy - dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) break;
      const c = cellChar(board[ny][nx]);
      if (c === null) break;
      sx = nx;
      sy = ny;
    }

    const cells: { x: number; y: number }[] = [];
    let word = "";
    let cx = sx;
    let cy = sy;
    while (cx >= 0 && cy >= 0 && cx < size && cy < size) {
      const c = cellChar(board[cy][cx]);
      if (c === null) break;
      word += c;
      cells.push({ x: cx, y: cy });
      cx += dx;
      cy += dy;
    }

    if (word.length <= 1) return null;
    return { word, cells };
  };

  for (const p of placements) {
    const h = traceWord(p.x, p.y, 1, 0);
    if (h) {
      const key = `H:${h.cells[0].x},${h.cells[0].y}:${h.word}`;
      if (!seen.has(key)) {
        seen.add(key);
        words.push(h);
      }
    }
    const v = traceWord(p.x, p.y, 0, 1);
    if (v) {
      const key = `V:${v.cells[0].x},${v.cells[0].y}:${v.word}`;
      if (!seen.has(key)) {
        seen.add(key);
        words.push(v);
      }
    }
  }

  return words;
}
