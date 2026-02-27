/**
 * ローカルPvP 設定画面（プレイヤー名入力 + Player2 ログイン）
 */

import { useState } from "react";
import { loginOrCreate } from "../lib/userService";
import "../styles/PvpLobby.css";

interface PvpLobbyProps {
  player1UserId: string;
  player1Name: string;
  onStart: (player1Name: string, player2Name: string, player2UserId: string) => void;
  onBack: () => void;
}

export function PvpLobby({ player1UserId, player1Name, onStart, onBack }: PvpLobbyProps) {
  const [p2LoginId, setP2LoginId] = useState("");
  const [p2LoggedIn, setP2LoggedIn] = useState(false);
  const [p2UserId, setP2UserId] = useState("");
  const [p2LoginLoading, setP2LoginLoading] = useState(false);
  const [p2LoginError, setP2LoginError] = useState("");

  const handleP2Login = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = p2LoginId.trim();
    if (!trimmed) return;
    if (trimmed === player1UserId) {
      setP2LoginError("Player 1 と同じIDは使えません");
      return;
    }
    setP2LoginLoading(true);
    setP2LoginError("");
    try {
      const user = await loginOrCreate(trimmed);
      // P1のセッションを壊さないため setCurrentUserId は呼ばない
      setP2UserId(user.id);
      setP2LoggedIn(true);
    } catch {
      setP2LoginError("ログインに失敗しました");
    } finally {
      setP2LoginLoading(false);
    }
  };

  return (
    <div className="pvp-lobby">
      <h2 className="pvp-lobby__title">ローカル対戦</h2>
      <p className="pvp-lobby__desc">同じデバイスで交代しながらプレイします</p>

      <div className="pvp-lobby__inputs">
        {/* Player 1: ログイン済み表示 */}
        <div className="pvp-lobby__label">
          <span className="pvp-lobby__label-text pvp-lobby__label-text--p1">Player 1</span>
          <div className="pvp-lobby__logged-in">{player1Name}</div>
        </div>

        <span className="pvp-lobby__vs">vs</span>

        {/* Player 2: ログインフォーム */}
        <div className="pvp-lobby__label">
          <span className="pvp-lobby__label-text pvp-lobby__label-text--p2">Player 2</span>
          {p2LoggedIn ? (
            <div className="pvp-lobby__logged-in">
              {p2UserId}
              <button
                className="pvp-lobby__change-btn"
                onClick={() => { setP2LoggedIn(false); setP2UserId(""); setP2LoginId(""); }}
              >
                変更
              </button>
            </div>
          ) : (
            <form className="pvp-lobby__login-form" onSubmit={handleP2Login}>
              <input
                className="pvp-lobby__input"
                type="text"
                value={p2LoginId}
                onChange={(e) => setP2LoginId(e.target.value)}
                placeholder="ユーザーIDを入力"
                maxLength={20}
              />
              <button
                className="pvp-lobby__login-btn"
                type="submit"
                disabled={p2LoginLoading || !p2LoginId.trim()}
              >
                {p2LoginLoading ? "..." : "ログイン"}
              </button>
            </form>
          )}
          {p2LoginError && <p className="pvp-lobby__error">{p2LoginError}</p>}
        </div>
      </div>

      <button
        className="start-btn start-btn--local-pvp"
        onClick={() => onStart(player1Name, p2UserId, p2UserId)}
        disabled={!p2LoggedIn}
      >
        つぎへ
      </button>
      <button className="start-btn start-btn--secondary" onClick={onBack}>
        もどる
      </button>
    </div>
  );
}
