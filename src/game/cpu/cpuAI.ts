/**
 * CPU AI — 盤面とラックから最善手を探索する
 */

import type { Cell, Placement, BoardLayout, CpuCandidate } from "../types";
import { cloneBoard } from "../core/helpers";
import { extractFormedWords } from "../core/extractWords";
import { scoreMove } from "../core/scoreMove";

/**
 * CPU の最善手を探索する。
 * 辞書の全単語 × 盤面の全位置 × 2方向 を総当たりし、
 * スコア上位候補からランダムに1つ返す。
 */
export function findBestMove(
  board: Cell[][],
  cpuRack: string[],
  dict: Set<string>,
  layout: BoardLayout,
  letterLimit?: number | null
): CpuCandidate | null {
  const size = board.length;
  const boardHasConfirmed = board.some((row) =>
    row.some((c) => c.char !== null)
  );
  const words = Array.from(dict);
  const candidates: CpuCandidate[] = [];

  for (const word of words) {
    // ラックに含まれない文字が多すぎる単語は早期スキップ
    if (!canPotentiallyForm(word, cpuRack, board, size)) continue;

    for (let dir = 0; dir < 2; dir++) {
      const dx = dir === 0 ? 1 : 0;
      const dy = dir === 0 ? 0 : 1;

      for (let startY = 0; startY < size; startY++) {
        for (let startX = 0; startX < size; startX++) {
          const endX = startX + dx * (word.length - 1);
          const endY = startY + dy * (word.length - 1);
          if (endX >= size || endY >= size) continue;

          const result = tryPlace(
            board,
            cpuRack,
            word,
            startX,
            startY,
            dx,
            dy,
            boardHasConfirmed,
            dict,
            layout
          );
          if (result) candidates.push(result);
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // タイル数制限が指定されている場合、条件に合う候補のみ残す
  const filtered = typeof letterLimit === "number"
    ? candidates.filter((c) => c.placements.length === letterLimit)
    : candidates;
  if (filtered.length === 0) return null;

  // スコア降順ソートし、上位5件からランダム選択（適度な強さ）
  filtered.sort((a, b) => b.score - a.score);
  const topN = Math.min(5, filtered.length);
  const pick = Math.floor(Math.random() * topN);
  return filtered[pick];
}

/**
 * ラック文字＋盤面文字で単語を綴れる可能性があるかの簡易チェック
 */
function canPotentiallyForm(
  word: string,
  rack: string[],
  board: Cell[][],
  size: number
): boolean {
  // ラック内の文字カウント
  const available: Record<string, number> = {};
  for (const ch of rack) {
    available[ch] = (available[ch] ?? 0) + 1;
  }
  // 盤面上の全確定文字をカウント
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ch = board[y][x].char;
      if (ch) available[ch] = (available[ch] ?? 0) + 1;
    }
  }

  for (const ch of word) {
    if (!available[ch] || available[ch] <= 0) return false;
    available[ch]--;
  }
  return true;
}

/**
 * 特定の位置・方向に単語を配置できるか試行し、
 * 有効なら CpuCandidate を返す。
 */
function tryPlace(
  board: Cell[][],
  cpuRack: string[],
  word: string,
  startX: number,
  startY: number,
  dx: number,
  dy: number,
  boardHasConfirmed: boolean,
  dict: Set<string>,
  layout: BoardLayout
): CpuCandidate | null {
  const rackCopy = [...cpuRack];
  const placements: Placement[] = [];
  let usesRackTile = false;
  let overlapsExisting = false;

  for (let i = 0; i < word.length; i++) {
    const x = startX + dx * i;
    const y = startY + dy * i;
    const cell = board[y][x];
    const needed = word[i];

    if (cell.char === needed) {
      // 盤面に既にある文字と一致 → ラック不要
      overlapsExisting = true;
      continue;
    }

    if (cell.char !== null) {
      // 盤面に別の文字がある → 配置不可
      return null;
    }

    // 空セル → ラックから使う
    const rackIdx = rackCopy.indexOf(needed);
    if (rackIdx === -1) return null;
    rackCopy.splice(rackIdx, 1);
    usesRackTile = true;

    placements.push({
      x,
      y,
      char: needed,
      rackIndex: -1, // CPU用のダミー値
      source: "normal",
    });
  }

  if (!usesRackTile || placements.length === 0) return null;

  // 既存タイルとの連結チェック
  if (boardHasConfirmed) {
    const connected =
      overlapsExisting ||
      placements.some((p) => {
        const neighbors = [
          [p.x - 1, p.y],
          [p.x + 1, p.y],
          [p.x, p.y - 1],
          [p.x, p.y + 1],
        ];
        return neighbors.some(([nx, ny]) => {
          const c = board[ny]?.[nx];
          return c?.char !== null && c?.char !== undefined;
        });
      });
    if (!connected) return null;
  }

  // 仮盤面で交差単語を検証
  const testBoard = cloneBoard(board);
  for (const p of placements) {
    testBoard[p.y][p.x].pending = p.char;
  }

  const formedWords = extractFormedWords(testBoard, placements);
  if (formedWords.length === 0) return null;

  const allValid = formedWords.every((fw) =>
    dict.has(fw.word.toUpperCase())
  );
  if (!allValid) return null;

  const breakdown = scoreMove(testBoard, placements, layout);

  return {
    placements,
    score: breakdown.total,
    words: breakdown.breakdown,
  };
}
