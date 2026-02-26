/**
 * ゲームロジック共通ヘルパー
 */

import type { Cell, BoardLayout } from "../types";

/** 空の盤面を生成する */
export function createEmptyBoard(layout: BoardLayout): Cell[][] {
  const { size, multipliers } = layout;
  const board: Cell[][] = [];
  for (let y = 0; y < size; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < size; x++) {
      row.push({
        char: null,
        pending: null,
        multiplier: multipliers[y]?.[x] ?? "NONE",
        tileSource: null,
      });
    }
    board.push(row);
  }
  return board;
}

/** 盤面をディープコピーする */
export function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) =>
    row.map((cell) => ({ ...cell }))
  );
}

/** セルの表示文字を返す (pending 優先) */
export function cellChar(cell: Cell): string | null {
  return cell.pending ?? cell.char;
}

/** 配列をシャッフルする (Fisher-Yates) — 元配列は変更しない */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** フリーカードプールの初期状態を生成 */
export function createFreePool(): Record<string, number> {
  const pool: Record<string, number> = {};
  for (let i = 65; i <= 90; i++) {
    pool[String.fromCharCode(i)] = 0;
  }
  return pool;
}
