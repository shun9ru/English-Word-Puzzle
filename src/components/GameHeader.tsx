/**
 * ゲームヘッダー（スコア、ターン、タイマー、カテゴリ表示）
 */

import type { Category, TurnOwner } from "../game/types";

const CATEGORY_LABELS: Record<Category, string> = {
  animals: "Animals",
  food: "Food",
  jobs: "Jobs",
  hobby: "Hobby",
  all: "All Genre",
};

interface GameHeaderProps {
  category: Category;
  score: number;
  turn: number;
  maxTurns: number;
  timeRemaining: number;
  bagCount: number;
  /** 対戦モード用 */
  battleMode?: boolean;
  cpuScore?: number;
  turnOwner?: TurnOwner;
  battleTurn?: number;
}

export function GameHeader({
  category,
  score,
  turn,
  maxTurns,
  timeRemaining,
  bagCount,
  battleMode,
  cpuScore,
  turnOwner,
  battleTurn,
}: GameHeaderProps) {
  const isLowTime = timeRemaining <= 20;

  if (battleMode) {
    const displayTurn = Math.floor((battleTurn ?? 0) / 2) + 1;
    return (
      <div className="game-header game-header--battle">
        <span className="game-header__category">{CATEGORY_LABELS[category]}</span>
        <span className={`game-header__score game-header__score--player ${turnOwner === "player" ? "game-header__score--active" : ""}`}>
          You: {score}
        </span>
        <span className="game-header__vs">vs</span>
        <span className={`game-header__score game-header__score--cpu ${turnOwner === "cpu" ? "game-header__score--active" : ""}`}>
          CPU: {cpuScore ?? 0}
        </span>
        <span className="game-header__turn">
          {displayTurn} / {maxTurns}
        </span>
        <span className={`game-header__timer ${isLowTime ? "game-header__timer--low" : ""}`}>
          {turnOwner === "cpu"
            ? "--:--"
            : `${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, "0")}`}
        </span>
        <span className="game-header__bag">{bagCount}</span>
      </div>
    );
  }

  return (
    <div className="game-header">
      <span className="game-header__category">{CATEGORY_LABELS[category]}</span>
      <span className="game-header__score">Score: {score}</span>
      <span className="game-header__turn">
        {turn + 1} / {maxTurns}
      </span>
      <span className={`game-header__timer ${isLowTime ? "game-header__timer--low" : ""}`}>
        {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
      </span>
      <span className="game-header__bag">{bagCount}</span>
    </div>
  );
}
