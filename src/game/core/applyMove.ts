/**
 * 手を確定してゲーム状態を更新する純粋関数。
 */

import type { GameState, ScoreBreakdown } from "../types";
import { cloneBoard } from "./helpers";
import { drawTiles } from "./generateBag";
import { scoreMove } from "./scoreMove";

export interface MoveResult {
  formedWords: string[];
  scoreBreakdown: ScoreBreakdown;
}

const RACK_SIZE = 7;

/**
 * 確定処理:
 * 1. 仮置きを盤面に確定
 * 2. スコア加算（次ターン倍率適用）
 * 3. 使用済みタイルをラックから除去し補充
 * 4. スペシャルカードを1枚ドロー
 * 5. ターン進行
 */
export function applyMove(state: GameState, moveResult: MoveResult): GameState {
  const newBoard = cloneBoard(state.board);

  // 仮置きを確定に変換
  for (const p of state.placedThisTurn) {
    const cell = newBoard[p.y][p.x];
    cell.char = cell.pending;
    cell.pending = null;
    cell.tileSource = p.source;
  }

  // 使用されたラックインデックス（フリーカードは -1 なので除外）
  const usedIndices = new Set(
    state.placedThisTurn.filter((p) => p.rackIndex >= 0).map((p) => p.rackIndex)
  );

  // 使用済みタイルを除去し補充
  const newRack = state.rack.filter((_, i) => !usedIndices.has(i));
  const needed = RACK_SIZE - newRack.length;
  const [drawn, newBag] = drawTiles(state.bag, needed);
  newRack.push(...drawn);

  // 次ターン倍率を適用
  let turnScore = moveResult.scoreBreakdown.total;
  if (state.nextTurnMultiplier > 1) {
    turnScore = Math.round(turnScore * state.nextTurnMultiplier);
  }

  // スペシャルデッキから1枚ドロー（手持ち4枚未満の場合）
  let newSpecialHand = [...state.specialHand];
  let newSpecialDeck = [...state.specialDeck];
  if (newSpecialHand.length < 4 && newSpecialDeck.length > 0) {
    newSpecialHand.push(newSpecialDeck[0]);
    newSpecialDeck = newSpecialDeck.slice(1);
  }

  const newTurn = state.turn + 1;
  const finished = newTurn >= state.maxTurns;

  return {
    ...state,
    board: newBoard,
    rack: newRack,
    bag: newBag,
    placedThisTurn: [],
    score: state.score + turnScore,
    turn: newTurn,
    finished,
    lastWords: moveResult.scoreBreakdown.breakdown,
    specialHand: newSpecialHand,
    specialDeck: newSpecialDeck,
    specialSet: null,
    lastSpecialCategory: state.specialSet
      ? (state.specialSet.categories.find((c) => c !== "all") ?? null)
      : null,
    nextTurnMultiplier: 1,
    wordHistory: [...state.wordHistory, ...moveResult.formedWords],
    spellCheckRemaining: 3,
  };
}

/**
 * パス処理: ターンだけ進める。
 */
export function applyPass(state: GameState): GameState {
  const newBoard = cloneBoard(state.board);

  for (const p of state.placedThisTurn) {
    newBoard[p.y][p.x].pending = null;
  }

  // フリーカード使用を戻す
  const newFreePool = { ...state.freePool };
  for (const p of state.placedThisTurn) {
    if (p.source === "free") {
      newFreePool[p.char] = Math.max(0, (newFreePool[p.char] ?? 0) - 1);
    }
  }

  // スペシャルデッキから1枚ドロー
  let newSpecialHand = [...state.specialHand];
  let newSpecialDeck = [...state.specialDeck];
  if (newSpecialHand.length < 4 && newSpecialDeck.length > 0) {
    newSpecialHand.push(newSpecialDeck[0]);
    newSpecialDeck = newSpecialDeck.slice(1);
  }

  const newTurn = state.turn + 1;
  const finished = newTurn >= state.maxTurns;

  return {
    ...state,
    board: newBoard,
    freePool: newFreePool,
    placedThisTurn: [],
    turn: newTurn,
    finished,
    lastWords: [],
    specialHand: newSpecialHand,
    specialDeck: newSpecialDeck,
    specialSet: null,
    lastSpecialCategory: null,
    nextTurnMultiplier: 1,
    spellCheckRemaining: 3,
  };
}

/**
 * Undo処理: 仮置きを全てクリアする。
 */
export function undoPlacement(state: GameState): GameState {
  const newBoard = cloneBoard(state.board);

  // フリーカード使用を戻す
  const newFreePool = { ...state.freePool };
  for (const p of state.placedThisTurn) {
    newBoard[p.y][p.x].pending = null;
    if (p.source === "free") {
      newFreePool[p.char] = Math.max(0, (newFreePool[p.char] ?? 0) - 1);
    }
  }

  return {
    ...state,
    board: newBoard,
    freePool: newFreePool,
    placedThisTurn: [],
  };
}

/**
 * スコア計算用ラッパー
 */
export function computeScore(state: GameState): ScoreBreakdown {
  return scoreMove(state.board, state.placedThisTurn, state.layout);
}
