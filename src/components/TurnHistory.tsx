/**
 * ターン別スコア履歴パネル（折りたたみ式）
 */

import { useState } from "react";
import type { TurnHistoryEntry, BattleType } from "../game/types";
import "../styles/TurnHistory.css";

interface TurnHistoryProps {
  entries: TurnHistoryEntry[];
  battleMode: boolean;
  battleType?: BattleType;
  player1Name?: string;
  player2Name?: string;
}

export function TurnHistory({ entries, battleMode, battleType, player1Name, player2Name }: TurnHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className="turn-history">
      <button
        className="turn-history__toggle"
        onClick={() => setExpanded((prev) => !prev)}
      >
        スコア履歴 ({entries.length}) {expanded ? "\u25B2" : "\u25BC"}
      </button>

      {expanded && (
        <div className="turn-history__list">
          {[...entries].reverse().map((entry, idx) => (
            <div
              key={idx}
              className={`turn-history__entry turn-history__entry--${entry.player}`}
            >
              <div className="turn-history__header">
                <span className="turn-history__turn">
                  T{entry.turn}
                </span>
                <span className={`turn-history__player turn-history__player--${entry.player}`}>
                  {entry.player === "player" ? "You"
                    : entry.player === "cpu" ? "CPU"
                    : entry.player === "player1" ? (player1Name ?? "P1")
                    : (player2Name ?? "P2")}
                </span>
                <span className="turn-history__total">
                  {entry.passed ? "PASS" : `+${entry.totalScore}`}
                </span>
                <span className="turn-history__cumulative">
                  ({battleMode && entry.player === "cpu" ? "CPU " : ""}{entry.cumulativeScore}pt)
                </span>
              </div>

              {!entry.passed && (
                <div className="turn-history__details">
                  <div className="turn-history__words">
                    {entry.words.map((w, i) => (
                      <span key={i} className="turn-history__word">
                        {w.word} <span className="turn-history__word-pts">{w.points}</span>
                      </span>
                    ))}
                  </div>

                  {/* 計算式: 素点と加算要素がある場合 */}
                  {(entry.multiplier > 1 || entry.specialBonus !== 0) && (
                    <div className="turn-history__formula">
                      {entry.baseScore}
                      {entry.specialBonus !== 0 && (
                        <>{entry.specialBonus > 0 ? " + " : " - "}{Math.abs(entry.specialBonus)}<span className="turn-history__label-special">[card]</span></>
                      )}
                      {entry.multiplier > 1 && (
                        <> x{entry.multiplier}</>
                      )}
                      {" = "}{entry.totalScore}
                    </div>
                  )}

                  {entry.specialCard && (
                    <div className="turn-history__special">
                      {entry.specialEffect}
                    </div>
                  )}

                  {battleType === "hp" && entry.damageDealt != null && entry.damageDealt > 0 && (
                    <div className="turn-history__damage">
                      {entry.damageDealt} DMG
                    </div>
                  )}

                  {entry.hpHealed != null && entry.hpHealed > 0 && (
                    <div className="turn-history__heal">
                      HP +{entry.hpHealed}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
