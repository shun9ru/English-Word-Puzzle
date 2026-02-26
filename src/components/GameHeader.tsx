/**
 * ゲームヘッダー（スコア、ターン、タイマー、カテゴリ表示）
 */

import type { Category } from "../game/types";

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
}

export function GameHeader({ category, score, turn, maxTurns, timeRemaining, bagCount }: GameHeaderProps) {
  const isLowTime = timeRemaining <= 20;

  return (
    <div className="game-header">
      <span className="game-header__category">{CATEGORY_LABELS[category]}</span>
      <span className="game-header__score">スコア: {score}</span>
      <span className="game-header__turn">
        ターン: {turn + 1} / {maxTurns}
      </span>
      <span className={`game-header__timer ${isLowTime ? "game-header__timer--low" : ""}`}>
        {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
      </span>
      <span className="game-header__bag">袋: {bagCount}枚</span>
    </div>
  );
}
