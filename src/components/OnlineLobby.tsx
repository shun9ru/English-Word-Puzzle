/**
 * オンラインPvP ロビー（ルーム作成/参加）
 */

import { useState } from "react";
import { createRoom, joinRoom } from "../lib/roomService";
import type { RoomConfig, BattleRoom } from "../game/types";
import "../styles/PvpLobby.css";

interface OnlineLobbyProps {
  userId: string;
  config: RoomConfig;
  onRoomCreated: (room: BattleRoom) => void;
  onRoomJoined: (room: BattleRoom) => void;
  onBack: () => void;
}

export function OnlineLobby({
  userId,
  config,
  onRoomCreated,
  onRoomJoined,
  onBack,
}: OnlineLobbyProps) {
  const [createdRoom, setCreatedRoom] = useState<BattleRoom | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const room = await createRoom(userId, config);
      setCreatedRoom(room);
      onRoomCreated(room);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    setError("");
    try {
      const room = await joinRoom(joinCode.trim(), userId);
      onRoomJoined(room);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="online-lobby">
      <h2 className="online-lobby__title">オンライン対戦</h2>
      <p className="online-lobby__desc">招待コードで友達と対戦</p>

      {/* ルーム作成 */}
      <div className="online-lobby__section">
        <h3 className="online-lobby__section-title">ルームを作成</h3>
        {createdRoom ? (
          <>
            <div className="online-lobby__code-display">
              <span className="online-lobby__code">{createdRoom.invite_code}</span>
            </div>
            <p className="online-lobby__waiting">相手の参加を待っています...</p>
          </>
        ) : (
          <button
            className="start-btn start-btn--online-pvp"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? "作成中..." : "ルーム作成"}
          </button>
        )}
      </div>

      <div className="online-lobby__divider">または</div>

      {/* ルーム参加 */}
      <div className="online-lobby__section">
        <h3 className="online-lobby__section-title">ルームに参加</h3>
        <div className="online-lobby__join-form">
          <input
            className="online-lobby__code-input"
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="招待コード"
            maxLength={6}
            disabled={loading || !!createdRoom}
          />
          <button
            className="online-lobby__join-btn"
            onClick={handleJoin}
            disabled={loading || !joinCode.trim() || !!createdRoom}
          >
            参加
          </button>
        </div>
      </div>

      {error && <p className="online-lobby__error">{error}</p>}

      <button className="start-btn start-btn--secondary" onClick={onBack} disabled={loading}>
        もどる
      </button>
    </div>
  );
}
