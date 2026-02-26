/**
 * 英語タイル袋生成
 * Scrabble 準拠の文字頻度分布を使用
 */

import { shuffle } from "./helpers";

/** 英語文字の出現頻度（Scrabble準拠） */
const ENGLISH_LETTER_COUNTS: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3,
  H: 2, I: 9, J: 1, K: 1, L: 4, M: 2, N: 6,
  O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4,
  V: 2, W: 2, X: 1, Y: 2, Z: 1,
};

/**
 * タイル袋を生成する。
 * @returns シャッフル済みのタイル配列
 */
export function generateBag(): string[] {
  const tiles: string[] = [];
  for (const [letter, count] of Object.entries(ENGLISH_LETTER_COUNTS)) {
    for (let i = 0; i < count; i++) {
      tiles.push(letter);
    }
  }
  return shuffle(tiles);
}

/**
 * 袋からタイルを引く。袋が足りない場合は引ける分だけ返す。
 * @returns [引いたタイル[], 残りの袋]
 */
export function drawTiles(bag: string[], count: number): [string[], string[]] {
  const remaining = [...bag];
  const drawn: string[] = [];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    drawn.push(remaining.pop()!);
  }
  return [drawn, remaining];
}
