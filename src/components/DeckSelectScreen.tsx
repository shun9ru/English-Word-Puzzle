/**
 * デッキ選択画面 — ゲーム開始前に各プレイヤーが使用デッキスロットを選ぶ
 */

import { useState, useEffect, useCallback } from "react";
import type { GameMode, Category, BattleRoom } from "../game/types";
import { loadDeckSlotSummary } from "../lib/collectionService";
import { setHostDeckSlot, setGuestDeckSlot, subscribeToRoom, unsubscribeFromRoom } from "../lib/roomService";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getDeckName } from "../lib/deckNames";
import "../styles/DeckSelect.css";

interface DeckSelectScreenProps {
  mode: GameMode;
  category: Category;
  player1UserId: string;
  player1Name: string;
  /** ローカルPvP 用: Player2 の userId */
  player2UserId?: string;
  player2Name?: string;
  /** オンラインPvP 用 */
  roomId?: string;
  isHost?: boolean;
  /** 親からの読み込み中フラグ（startGame 実行中） */
  starting?: boolean;
  /** 親からのエラーメッセージ */
  errorMessage?: string;
  onConfirm: (p1Slot: number, p2Slot?: number) => void;
  onBack: () => void;
}

/** スロットピッカー */
function SlotPicker({
  label,
  category,
  summary,
  selected,
  onSelect,
}: {
  label: string;
  category: string;
  summary: { slot: number; count: number }[];
  selected: number;
  onSelect: (slot: number) => void;
}) {
  return (
    <div className="deck-select__player">
      <h3 className="deck-select__player-label">{label}</h3>
      <div className="deck-select__slots">
        {[0, 1, 2, 3, 4].map((s) => {
          const count = summary.find((ss) => ss.slot === s)?.count ?? 0;
          return (
            <button
              key={s}
              className={
                "deck-select__slot" +
                (selected === s ? " deck-select__slot--active" : "") +
                (count === 0 ? " deck-select__slot--empty" : "")
              }
              onClick={() => onSelect(s)}
            >
              <span className="deck-select__slot-name">{getDeckName(category, s)}</span>
              <span className="deck-select__slot-count">{count}枚</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DeckSelectScreen({
  mode,
  category,
  player1UserId,
  player1Name,
  player2UserId,
  player2Name,
  roomId,
  isHost,
  starting,
  errorMessage,
  onConfirm,
  onBack,
}: DeckSelectScreenProps) {
  const [p1Slot, setP1Slot] = useState(0);
  const [p2Slot, setP2Slot] = useState(0);
  const [p1Summary, setP1Summary] = useState<{ slot: number; count: number }[]>([]);
  const [p2Summary, setP2Summary] = useState<{ slot: number; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [channelRef, setChannelRef] = useState<RealtimeChannel | null>(null);

  const isLocalPvp = mode === "local_pvp";
  const isOnlinePvp = mode === "online_pvp";

  // スロットサマリー読み込み
  useEffect(() => {
    setLoading(true);
    const promises: Promise<{ slot: number; count: number }[]>[] = [
      loadDeckSlotSummary(player1UserId, category),
    ];
    if (isLocalPvp && player2UserId) {
      promises.push(loadDeckSlotSummary(player2UserId, category));
    }
    Promise.all(promises).then(([s1, s2]) => {
      setP1Summary(s1);
      if (s2) setP2Summary(s2);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [player1UserId, player2UserId, category, isLocalPvp]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (channelRef) unsubscribeFromRoom(channelRef);
    };
  }, [channelRef]);

  // ソロ / CPU 対戦: 確定
  const handleSoloConfirm = useCallback(() => {
    onConfirm(p1Slot);
  }, [p1Slot, onConfirm]);

  // ローカルPvP: 確定
  const handleLocalPvpConfirm = useCallback(() => {
    onConfirm(p1Slot, p2Slot);
  }, [p1Slot, p2Slot, onConfirm]);

  // オンラインPvP ホスト: スロット確定 → ゲスト待機
  const handleHostConfirm = useCallback(async () => {
    if (!roomId) return;
    setWaiting(true);
    await setHostDeckSlot(roomId, p1Slot);
    // ゲストの deck slot を待つ
    const ch = subscribeToRoom(roomId, (updatedRoom: BattleRoom) => {
      if (updatedRoom.guest_deck_slot != null) {
        unsubscribeFromRoom(ch);
        onConfirm(p1Slot, updatedRoom.guest_deck_slot);
      }
    });
    setChannelRef(ch);
  }, [roomId, p1Slot, onConfirm]);

  // オンラインPvP ゲスト: スロット確定 → ゲーム開始待機
  const handleGuestConfirm = useCallback(async () => {
    if (!roomId) return;
    setWaiting(true);
    await setGuestDeckSlot(roomId, p1Slot); // ゲスト自身のスロット
    // ゲスト側は game_state の到着を親コンポーネント (App) 側で検知する
    onConfirm(p1Slot);
  }, [roomId, p1Slot, onConfirm]);

  if (loading) {
    return <div className="deck-select"><p>読み込み中...</p></div>;
  }

  if (waiting) {
    return (
      <div className="deck-select">
        <h2 className="deck-select__title">デッキ選択</h2>
        <p className="deck-select__waiting">
          {isHost ? "相手のデッキ選択を待っています..." : "ホストの開始を待っています..."}
        </p>
      </div>
    );
  }

  return (
    <div className="deck-select">
      <h2 className="deck-select__title">デッキ選択</h2>
      <p className="deck-select__sub">使用するデッキを選んでください</p>

      {/* ソロ / CPU / オンラインPvP: 自分のスロットのみ */}
      {!isLocalPvp && (
        <SlotPicker
          label={isOnlinePvp ? `${player1Name} のデッキ` : "デッキ"}
          category={category}
          summary={p1Summary}
          selected={p1Slot}
          onSelect={setP1Slot}
        />
      )}

      {/* ローカルPvP: 両プレイヤー */}
      {isLocalPvp && (
        <>
          <SlotPicker
            label={`${player1Name} のデッキ`}
            category={category}
            summary={p1Summary}
            selected={p1Slot}
            onSelect={setP1Slot}
          />
          <SlotPicker
            label={`${player2Name ?? "Player 2"} のデッキ`}
            category={category}
            summary={p2Summary}
            selected={p2Slot}
            onSelect={setP2Slot}
          />
        </>
      )}

      {errorMessage && <p className="deck-select__error">{errorMessage}</p>}

      <button
        className="start-btn"
        onClick={
          isOnlinePvp
            ? (isHost ? handleHostConfirm : handleGuestConfirm)
            : isLocalPvp
              ? handleLocalPvpConfirm
              : handleSoloConfirm
        }
        disabled={starting}
      >
        {starting ? "読み込み中..." : isOnlinePvp ? "決定" : "スタート"}
      </button>

      {!isOnlinePvp && (
        <button className="start-btn start-btn--secondary" onClick={onBack}>
          もどる
        </button>
      )}
    </div>
  );
}
