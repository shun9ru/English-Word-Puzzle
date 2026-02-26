/**
 * CPU の着手を盤面に適用する
 */

import type { GameState, BattleState, CpuCandidate } from "../types";
import { cloneBoard } from "../core/helpers";
import { drawTiles } from "../core/generateBag";

const RACK_SIZE = 7;

/** CPU の着手を確定し、state と battleState を更新して返す */
export function applyCpuMove(
  state: GameState,
  battle: BattleState,
  candidate: CpuCandidate
): { newState: GameState; newBattle: BattleState } {
  const newBoard = cloneBoard(state.board);

  // pending をクリアして char に確定
  for (const p of candidate.placements) {
    newBoard[p.y][p.x].char = p.char;
    newBoard[p.y][p.x].pending = null;
    newBoard[p.y][p.x].tileSource = "normal";
  }

  // CPU ラックから使用文字を除去し補充
  const usedChars = candidate.placements.map((p) => p.char);
  const newCpuRack = [...battle.cpuRack];
  for (const ch of usedChars) {
    const idx = newCpuRack.indexOf(ch);
    if (idx !== -1) newCpuRack.splice(idx, 1);
  }
  const needed = RACK_SIZE - newCpuRack.length;
  const [drawn, newBag] = drawTiles(state.bag, needed);
  newCpuRack.push(...drawn);

  const newBattleTurn = battle.battleTurn + 1;
  const finished = newBattleTurn >= state.maxTurns * 2;

  return {
    newState: {
      ...state,
      board: newBoard,
      bag: newBag,
      finished,
      lastWords: candidate.words,
    },
    newBattle: {
      ...battle,
      cpuRack: newCpuRack,
      cpuScore: battle.cpuScore + candidate.score,
      cpuWordHistory: [
        ...battle.cpuWordHistory,
        ...candidate.words.map((w) => w.word),
      ],
      battleTurn: newBattleTurn,
      turnOwner: "player",
      lastCpuMove: {
        words: candidate.words,
        totalScore: candidate.score,
        passed: false,
      },
      cpuHighlightCells: candidate.placements.map((p) => ({
        x: p.x,
        y: p.y,
      })),
      cpuLetterLimit: null,
    },
  };
}

/** CPU パス — ターンだけ進める */
export function applyCpuPass(
  state: GameState,
  battle: BattleState
): { newState: GameState; newBattle: BattleState } {
  const newBattleTurn = battle.battleTurn + 1;
  const finished = newBattleTurn >= state.maxTurns * 2;

  return {
    newState: {
      ...state,
      finished,
      lastWords: [],
    },
    newBattle: {
      ...battle,
      battleTurn: newBattleTurn,
      turnOwner: "player",
      lastCpuMove: {
        words: [],
        totalScore: 0,
        passed: true,
      },
      cpuHighlightCells: [],
      cpuLetterLimit: null,
    },
  };
}
