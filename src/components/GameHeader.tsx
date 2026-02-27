/**
 * ゲームヘッダー（スコア、ターン、タイマー、カテゴリ表示）
 */

import type { ReactElement } from "react";
import type { Category, TurnOwner, BattleType, PvpTurnOwner, PoisonState } from "../game/types";

const CATEGORY_LABELS: Record<Category, string> = {
  animals: "Animals",
  food: "Food",
  jobs: "Jobs",
  hobby: "Hobby",
  all: "All Genre",
};

interface StatusEffects {
  shield?: number;
  poison?: PoisonState | null;
  mirror?: number;
}

function StatusIcons({ effects }: { effects?: StatusEffects }) {
  if (!effects) return null;
  const icons: ReactElement[] = [];
  if (effects.shield && effects.shield > 0) {
    icons.push(<span key="shield" className="game-header__status game-header__status--shield" title={`Shield: ${effects.shield}t`}>&#x1f6e1;{effects.shield}</span>);
  }
  if (effects.poison && effects.poison.turnsLeft > 0) {
    icons.push(<span key="poison" className="game-header__status game-header__status--poison" title={`Poison: ${effects.poison.damage}dmg x${effects.poison.turnsLeft}t`}>&#x2620;{effects.poison.turnsLeft}</span>);
  }
  if (effects.mirror && effects.mirror > 0) {
    icons.push(<span key="mirror" className="game-header__status game-header__status--mirror" title={`Mirror: ${effects.mirror}t`}>&#x1fa9e;{effects.mirror}</span>);
  }
  if (icons.length === 0) return null;
  return <span className="game-header__statuses">{icons}</span>;
}

interface GameHeaderProps {
  category: Category;
  score: number;
  turn: number;
  maxTurns: number;
  timeRemaining: number;
  bagCount: number;
  /** 対戦モード用 */
  battleMode?: boolean;
  battleType?: BattleType;
  cpuScore?: number;
  turnOwner?: TurnOwner;
  battleTurn?: number;
  /** HP バトル用 */
  playerHp?: number;
  cpuHp?: number;
  maxHp?: number;
  /** ステータスエフェクト */
  playerStatus?: StatusEffects;
  cpuStatus?: StatusEffects;
  /** PvP モード用 */
  pvpMode?: boolean;
  pvpTurnOwner?: PvpTurnOwner;
  player1Name?: string;
  player1Score?: number;
  player2Name?: string;
  player2Score?: number;
  player1Hp?: number;
  player2Hp?: number;
  player1Status?: StatusEffects;
  player2Status?: StatusEffects;
  isMyTurn?: boolean;
}

export function GameHeader({
  category,
  score,
  turn,
  maxTurns,
  timeRemaining,
  bagCount,
  battleMode,
  battleType,
  cpuScore,
  turnOwner,
  battleTurn,
  playerHp,
  cpuHp,
  maxHp,
  playerStatus,
  cpuStatus,
  pvpMode,
  pvpTurnOwner,
  player1Name,
  player1Score,
  player2Name,
  player2Score,
  player1Hp,
  player2Hp,
  player1Status,
  player2Status,
  isMyTurn,
}: GameHeaderProps) {
  const isLowTime = timeRemaining <= 20;

  // PvP モード
  if (pvpMode) {
    const displayTurn = Math.floor((battleTurn ?? 0) / 2) + 1;
    const timerStr = isMyTurn === false
      ? "--:--"
      : `${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, "0")}`;
    const p1 = player1Name ?? "P1";
    const p2 = player2Name ?? "P2";

    // HP バトル
    if (battleType === "hp") {
      const p1Hp = player1Hp ?? 0;
      const p2Hp = player2Hp ?? 0;
      const mHp = maxHp ?? 100;
      const p1Pct = Math.max(0, (p1Hp / mHp) * 100);
      const p2Pct = Math.max(0, (p2Hp / mHp) * 100);

      return (
        <div className="game-header game-header--battle game-header--hp">
          <span className="game-header__category">{CATEGORY_LABELS[category]}</span>

          <div className={`game-header__hp-group game-header__hp-group--player ${pvpTurnOwner === "player1" ? "game-header__hp-group--active" : ""}`}>
            <span className="game-header__hp-label">{p1}<StatusIcons effects={player1Status} /></span>
            <div className="game-header__hp-bar">
              <div className="game-header__hp-fill game-header__hp-fill--player" style={{ width: `${p1Pct}%` }} />
            </div>
            <span className="game-header__hp-value">{p1Hp}/{mHp}</span>
          </div>

          <span className="game-header__vs">vs</span>

          <div className={`game-header__hp-group game-header__hp-group--cpu ${pvpTurnOwner === "player2" ? "game-header__hp-group--active" : ""}`}>
            <span className="game-header__hp-label">{p2}<StatusIcons effects={player2Status} /></span>
            <div className="game-header__hp-bar">
              <div className="game-header__hp-fill game-header__hp-fill--cpu" style={{ width: `${p2Pct}%` }} />
            </div>
            <span className="game-header__hp-value">{p2Hp}/{mHp}</span>
          </div>

          <span className="game-header__turn">{displayTurn} / {maxTurns}</span>
          <span className={`game-header__timer ${isLowTime && isMyTurn !== false ? "game-header__timer--low" : ""}`}>
            {timerStr}
          </span>
          <span className="game-header__bag">{bagCount}</span>
        </div>
      );
    }

    // スコアバトル
    return (
      <div className="game-header game-header--battle">
        <span className="game-header__category">{CATEGORY_LABELS[category]}</span>
        <span className={`game-header__score game-header__score--player ${pvpTurnOwner === "player1" ? "game-header__score--active" : ""}`}>
          {p1}: {player1Score ?? 0}<StatusIcons effects={player1Status} />
        </span>
        <span className="game-header__vs">vs</span>
        <span className={`game-header__score game-header__score--cpu ${pvpTurnOwner === "player2" ? "game-header__score--active" : ""}`}>
          {p2}: {player2Score ?? 0}<StatusIcons effects={player2Status} />
        </span>
        <span className="game-header__turn">{displayTurn} / {maxTurns}</span>
        <span className={`game-header__timer ${isLowTime && isMyTurn !== false ? "game-header__timer--low" : ""}`}>
          {timerStr}
        </span>
        <span className="game-header__bag">{bagCount}</span>
      </div>
    );
  }

  if (battleMode) {
    const displayTurn = Math.floor((battleTurn ?? 0) / 2) + 1;
    const timerStr = turnOwner === "cpu"
      ? "--:--"
      : `${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, "0")}`;

    // HP バトルモード
    if (battleType === "hp") {
      const pHp = playerHp ?? 0;
      const cHp = cpuHp ?? 0;
      const mHp = maxHp ?? 100;
      const playerPct = Math.max(0, (pHp / mHp) * 100);
      const cpuPct = Math.max(0, (cHp / mHp) * 100);

      return (
        <div className="game-header game-header--battle game-header--hp">
          <span className="game-header__category">{CATEGORY_LABELS[category]}</span>

          <div className={`game-header__hp-group game-header__hp-group--player ${turnOwner === "player" ? "game-header__hp-group--active" : ""}`}>
            <span className="game-header__hp-label">You<StatusIcons effects={playerStatus} /></span>
            <div className="game-header__hp-bar">
              <div
                className="game-header__hp-fill game-header__hp-fill--player"
                style={{ width: `${playerPct}%` }}
              />
            </div>
            <span className="game-header__hp-value">{pHp}/{mHp}</span>
          </div>

          <span className="game-header__vs">vs</span>

          <div className={`game-header__hp-group game-header__hp-group--cpu ${turnOwner === "cpu" ? "game-header__hp-group--active" : ""}`}>
            <span className="game-header__hp-label">CPU<StatusIcons effects={cpuStatus} /></span>
            <div className="game-header__hp-bar">
              <div
                className="game-header__hp-fill game-header__hp-fill--cpu"
                style={{ width: `${cpuPct}%` }}
              />
            </div>
            <span className="game-header__hp-value">{cHp}/{mHp}</span>
          </div>

          <span className="game-header__turn">{displayTurn} / {maxTurns}</span>
          <span className={`game-header__timer ${isLowTime && turnOwner !== "cpu" ? "game-header__timer--low" : ""}`}>
            {timerStr}
          </span>
          <span className="game-header__bag">{bagCount}</span>
        </div>
      );
    }

    // スコアバトルモード（既存）
    return (
      <div className="game-header game-header--battle">
        <span className="game-header__category">{CATEGORY_LABELS[category]}</span>
        <span className={`game-header__score game-header__score--player ${turnOwner === "player" ? "game-header__score--active" : ""}`}>
          You: {score}<StatusIcons effects={playerStatus} />
        </span>
        <span className="game-header__vs">vs</span>
        <span className={`game-header__score game-header__score--cpu ${turnOwner === "cpu" ? "game-header__score--active" : ""}`}>
          CPU: {cpuScore ?? 0}<StatusIcons effects={cpuStatus} />
        </span>
        <span className="game-header__turn">
          {displayTurn} / {maxTurns}
        </span>
        <span className={`game-header__timer ${isLowTime && turnOwner !== "cpu" ? "game-header__timer--low" : ""}`}>
          {timerStr}
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
