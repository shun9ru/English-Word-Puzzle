/**
 * PvP 対戦の状態管理（純粋関数）
 */

import type {
  GameState,
  PvpBattleState,
  PvpPlayerState,
  PvpTurnOwner,
  BattleType,
  Category,
  SpecialCard,
} from "../types";
import type { MoveResult } from "../core/applyMove";
import { cloneBoard, createFreePool } from "../core/helpers";
import { drawTiles } from "../core/generateBag";

const RACK_SIZE = 7;

/** PvpPlayerState の初期値を生成 */
function createPlayerState(
  name: string,
  rack: string[],
  deck: SpecialCard[],
  maxHp: number,
): PvpPlayerState {
  const initialHand = deck.slice(0, Math.min(4, deck.length));
  const remainingDeck = deck.slice(initialHand.length);
  return {
    name,
    rack,
    score: 0,
    wordHistory: [],
    hp: maxHp,
    specialDeck: remainingDeck,
    specialHand: initialHand,
    specialSet: null,
    usedSpecialIds: [],
    lastSpecialCategory: null,
    nextTurnMultiplier: 1,
    letterLimit: null,
    freePool: createFreePool(),
    spellCheckRemaining: 3,
  };
}

/** PvpBattleState を初期化 */
export function initPvpBattleState(
  mode: "local_pvp" | "online_pvp",
  battleType: BattleType,
  player1Name: string,
  player2Name: string,
  player1Rack: string[],
  player2Rack: string[],
  player1Deck: SpecialCard[],
  player2Deck: SpecialCard[],
  maxHp: number,
): PvpBattleState {
  return {
    mode,
    battleType,
    turnOwner: "player1",
    player1: createPlayerState(player1Name, player1Rack, player1Deck, maxHp),
    player2: createPlayerState(player2Name, player2Rack, player2Deck, maxHp),
    battleTurn: 0,
    maxHp,
    lastMove: null,
    highlightCells: [],
  };
}

/** 現在ターンのプレイヤー状態を取得 */
export function getCurrentPlayer(pvp: PvpBattleState): PvpPlayerState {
  return pvp.turnOwner === "player1" ? pvp.player1 : pvp.player2;
}

/** 相手プレイヤー状態を取得 */
export function getOpponentPlayer(pvp: PvpBattleState): PvpPlayerState {
  return pvp.turnOwner === "player1" ? pvp.player2 : pvp.player1;
}

/** ターン切替後の turnOwner を返す */
function nextTurnOwner(current: PvpTurnOwner): PvpTurnOwner {
  return current === "player1" ? "player2" : "player1";
}

/** 現在ターンのプレイヤー状態を更新した PvpBattleState を返す */
function updateCurrentPlayer(
  pvp: PvpBattleState,
  updates: Partial<PvpPlayerState>,
): PvpBattleState {
  const key = pvp.turnOwner === "player1" ? "player1" : "player2";
  return {
    ...pvp,
    [key]: { ...pvp[key], ...updates },
  };
}

/** 相手プレイヤー状態を更新した PvpBattleState を返す */
export function updateOpponentPlayer(
  pvp: PvpBattleState,
  updates: Partial<PvpPlayerState>,
): PvpBattleState {
  const key = pvp.turnOwner === "player1" ? "player2" : "player1";
  return {
    ...pvp,
    [key]: { ...pvp[key], ...updates },
  };
}

/**
 * PvP の手確定:
 * 1. 盤面に仮置きを確定
 * 2. 現プレイヤーのラックから使用タイルを除去し補充
 * 3. スコア加算
 * 4. スペシャルカードドロー
 * 5. ターン切替
 */
export function applyPvpMove(
  state: GameState,
  pvp: PvpBattleState,
  moveResult: MoveResult,
): { newState: GameState; newPvp: PvpBattleState } {
  const newBoard = cloneBoard(state.board);

  // 仮置きを確定
  for (const p of state.placedThisTurn) {
    const cell = newBoard[p.y][p.x];
    cell.char = cell.pending;
    cell.pending = null;
    cell.tileSource = p.source;
  }

  // ラックから使用タイルを除去し補充
  const usedIndices = new Set(
    state.placedThisTurn.filter((p) => p.rackIndex >= 0).map((p) => p.rackIndex),
  );
  const currentPlayer = getCurrentPlayer(pvp);
  const newRack = currentPlayer.rack.filter((_, i) => !usedIndices.has(i));
  const needed = RACK_SIZE - newRack.length;
  const [drawn, newBag] = drawTiles(state.bag, needed);
  newRack.push(...drawn);

  // スコア計算（次ターン倍率適用）
  let turnScore = moveResult.scoreBreakdown.total;
  if (currentPlayer.nextTurnMultiplier > 1) {
    turnScore = Math.round(turnScore * currentPlayer.nextTurnMultiplier);
  }

  // スペシャルデッキから1枚ドロー
  let newSpecialHand = [...currentPlayer.specialHand];
  let newSpecialDeck = [...currentPlayer.specialDeck];
  if (newSpecialHand.length < 4 && newSpecialDeck.length > 0) {
    newSpecialHand.push(newSpecialDeck[0]);
    newSpecialDeck = newSpecialDeck.slice(1);
  }

  const newBattleTurn = pvp.battleTurn + 1;
  const finished = newBattleTurn >= state.maxTurns * 2;

  // 現プレイヤー状態を更新
  const updatedPvp = updateCurrentPlayer(pvp, {
    rack: newRack,
    score: currentPlayer.score + turnScore,
    wordHistory: [...currentPlayer.wordHistory, ...moveResult.formedWords],
    specialHand: newSpecialHand,
    specialDeck: newSpecialDeck,
    specialSet: null,
    lastSpecialCategory: currentPlayer.specialSet
      ? (currentPlayer.specialSet.categories.find((c: Category) => c !== "all") ?? null)
      : null,
    nextTurnMultiplier: 1,
    spellCheckRemaining: 3,
  });

  return {
    newState: {
      ...state,
      board: newBoard,
      bag: newBag,
      placedThisTurn: [],
      finished,
      lastWords: moveResult.scoreBreakdown.breakdown,
    },
    newPvp: {
      ...updatedPvp,
      battleTurn: newBattleTurn,
      turnOwner: nextTurnOwner(pvp.turnOwner),
      lastMove: {
        player: pvp.turnOwner,
        words: moveResult.scoreBreakdown.breakdown,
        totalScore: turnScore,
        passed: false,
      },
      highlightCells: state.placedThisTurn.map((p) => ({ x: p.x, y: p.y })),
    },
  };
}

/**
 * PvP パス処理
 */
export function applyPvpPass(
  state: GameState,
  pvp: PvpBattleState,
): { newState: GameState; newPvp: PvpBattleState } {
  const newBoard = cloneBoard(state.board);

  // 仮置きをクリア
  for (const p of state.placedThisTurn) {
    newBoard[p.y][p.x].pending = null;
  }

  // フリーカード使用を戻す
  const currentPlayer = getCurrentPlayer(pvp);
  const newFreePool = { ...currentPlayer.freePool };
  for (const p of state.placedThisTurn) {
    if (p.source === "free") {
      newFreePool[p.char] = Math.max(0, (newFreePool[p.char] ?? 0) - 1);
    }
  }

  // スペシャルデッキから1枚ドロー
  let newSpecialHand = [...currentPlayer.specialHand];
  let newSpecialDeck = [...currentPlayer.specialDeck];
  if (newSpecialHand.length < 4 && newSpecialDeck.length > 0) {
    newSpecialHand.push(newSpecialDeck[0]);
    newSpecialDeck = newSpecialDeck.slice(1);
  }

  const newBattleTurn = pvp.battleTurn + 1;
  const finished = newBattleTurn >= state.maxTurns * 2;

  const updatedPvp = updateCurrentPlayer(pvp, {
    freePool: newFreePool,
    specialHand: newSpecialHand,
    specialDeck: newSpecialDeck,
    specialSet: null,
    lastSpecialCategory: null,
    nextTurnMultiplier: 1,
    spellCheckRemaining: 3,
  });

  return {
    newState: {
      ...state,
      board: newBoard,
      placedThisTurn: [],
      finished,
      lastWords: [],
    },
    newPvp: {
      ...updatedPvp,
      battleTurn: newBattleTurn,
      turnOwner: nextTurnOwner(pvp.turnOwner),
      lastMove: {
        player: pvp.turnOwner,
        words: [],
        totalScore: 0,
        passed: true,
      },
      highlightCells: [],
    },
  };
}

/**
 * GameState.rack を次のターンプレイヤーの rack に入れ替える
 */
export function swapRackForTurn(
  state: GameState,
  pvp: PvpBattleState,
): GameState {
  const nextPlayer = getCurrentPlayer(pvp);
  return {
    ...state,
    rack: [...nextPlayer.rack],
    // PvP では GameState.score/freePool/special* は現ターンプレイヤーのものに入れ替え
    score: nextPlayer.score,
    freePool: { ...nextPlayer.freePool },
    specialDeck: [...nextPlayer.specialDeck],
    specialHand: [...nextPlayer.specialHand],
    specialSet: nextPlayer.specialSet,
    usedSpecialIds: [...nextPlayer.usedSpecialIds],
    lastSpecialCategory: nextPlayer.lastSpecialCategory,
    spellCheckRemaining: nextPlayer.spellCheckRemaining,
    nextTurnMultiplier: nextPlayer.nextTurnMultiplier,
    placedThisTurn: [],
  };
}
