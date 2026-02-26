/**
 * 得点計算
 * ノーマルカード: 1文字3点、フリーカード: 1文字1点
 * 倍率マスの効果を適用する（Scrabble準拠）。
 */

import type { Cell, Placement, BoardLayout, MultiplierType, TileSource, ScoreBreakdown } from "../types";
import { cellChar } from "./helpers";
import { extractFormedWords } from "./extractWords";

/** タイルソース別の基本点 */
function basePoints(source: TileSource): number {
  switch (source) {
    case "normal": return 3;
    case "special": return 2;
    case "free": return 1;
  }
}

/** 文字倍率を返す */
function letterMultiplier(m: MultiplierType, isNewTile: boolean): number {
  if (!isNewTile) return 1;
  if (m === "DL") return 2;
  if (m === "TL") return 3;
  return 1;
}

/** 単語倍率を返す */
function wordMultiplier(m: MultiplierType, isNewTile: boolean): number {
  if (!isNewTile) return 1;
  if (m === "DW") return 2;
  if (m === "TW") return 3;
  return 1;
}

/**
 * 仮置き確定時のスコアを計算する。
 */
export function scoreMove(
  board: Cell[][],
  placements: Placement[],
  _layout: BoardLayout
): ScoreBreakdown {
  const formedWords = extractFormedWords(board, placements);
  const placementMap = new Map<string, Placement>();
  for (const p of placements) {
    placementMap.set(`${p.x},${p.y}`, p);
  }

  let total = 0;
  const breakdown: { word: string; points: number }[] = [];

  for (const fw of formedWords) {
    let wordScore = 0;
    let wMult = 1;

    for (const { x, y } of fw.cells) {
      const cell = board[y][x];
      const key = `${x},${y}`;
      const isNew = placementMap.has(key);
      const ch = cellChar(cell);
      if (ch === null) continue;

      // 新しいタイルはソースに基づく点数、既存タイルは元のソースに基づく
      let tilePts: number;
      if (isNew) {
        const placement = placementMap.get(key)!;
        tilePts = basePoints(placement.source);
      } else {
        tilePts = basePoints(cell.tileSource ?? "normal");
      }

      const lm = letterMultiplier(cell.multiplier, isNew);
      wordScore += tilePts * lm;
      wMult *= wordMultiplier(cell.multiplier, isNew);
    }

    const points = wordScore * wMult;
    total += points;
    breakdown.push({ word: fw.word, points });
  }

  return { total, breakdown };
}
