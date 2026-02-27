/**
 * ローカルPvP 設定画面（プレイヤー名入力）
 */

import { useState } from "react";
import "../styles/PvpLobby.css";

interface PvpLobbyProps {
  onStart: (player1Name: string, player2Name: string) => void;
  onBack: () => void;
}

export function PvpLobby({ onStart, onBack }: PvpLobbyProps) {
  const [p1Name, setP1Name] = useState("Player 1");
  const [p2Name, setP2Name] = useState("Player 2");

  return (
    <div className="pvp-lobby">
      <h2 className="pvp-lobby__title">ローカル対戦</h2>
      <p className="pvp-lobby__desc">同じデバイスで交代しながらプレイします</p>

      <div className="pvp-lobby__inputs">
        <label className="pvp-lobby__label">
          <span className="pvp-lobby__label-text pvp-lobby__label-text--p1">Player 1</span>
          <input
            className="pvp-lobby__input"
            type="text"
            value={p1Name}
            onChange={(e) => setP1Name(e.target.value)}
            maxLength={12}
          />
        </label>
        <span className="pvp-lobby__vs">vs</span>
        <label className="pvp-lobby__label">
          <span className="pvp-lobby__label-text pvp-lobby__label-text--p2">Player 2</span>
          <input
            className="pvp-lobby__input"
            type="text"
            value={p2Name}
            onChange={(e) => setP2Name(e.target.value)}
            maxLength={12}
          />
        </label>
      </div>

      <button
        className="start-btn start-btn--local-pvp"
        onClick={() => onStart(p1Name.trim() || "Player 1", p2Name.trim() || "Player 2")}
      >
        つぎへ
      </button>
      <button className="start-btn start-btn--secondary" onClick={onBack}>
        もどる
      </button>
    </div>
  );
}
