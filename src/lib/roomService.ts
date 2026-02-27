/**
 * オンライン対戦ルームの CRUD + Realtime 購読
 */

import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { BattleRoom, RoomConfig, GameState, PvpBattleState } from "../game/types";

/** 紛らわしい文字を除いたコード文字セット */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 6文字の招待コードを生成 */
function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/** ルームを作成 */
export async function createRoom(
  hostUserId: string,
  config: RoomConfig,
): Promise<BattleRoom> {
  const inviteCode = generateInviteCode();

  const { data, error } = await supabase
    .from("battle_rooms")
    .insert({
      invite_code: inviteCode,
      host_user_id: hostUserId,
      status: "waiting",
      game_config: config,
    })
    .select()
    .single();

  if (error) throw new Error(`ルーム作成失敗: ${error.message}`);
  return data as BattleRoom;
}

/** 招待コードでルームに参加 */
export async function joinRoom(
  inviteCode: string,
  guestUserId: string,
): Promise<BattleRoom> {
  // まずルームを検索
  const { data: room, error: findError } = await supabase
    .from("battle_rooms")
    .select()
    .eq("invite_code", inviteCode.toUpperCase())
    .eq("status", "waiting")
    .single();

  if (findError || !room) {
    throw new Error("ルームが見つかりません（コードを確認してください）");
  }

  // ゲスト参加 + ステータス更新
  const { data, error } = await supabase
    .from("battle_rooms")
    .update({
      guest_user_id: guestUserId,
      status: "playing",
    })
    .eq("id", room.id)
    .select()
    .single();

  if (error) throw new Error(`ルーム参加失敗: ${error.message}`);
  return data as BattleRoom;
}

/** ルームを取得 */
export async function getRoom(roomId: string): Promise<BattleRoom> {
  const { data, error } = await supabase
    .from("battle_rooms")
    .select()
    .eq("id", roomId)
    .single();

  if (error) throw new Error(`ルーム取得失敗: ${error.message}`);
  return data as BattleRoom;
}

/** ゲーム状態を DB に保存 */
export async function updateRoomGameState(
  roomId: string,
  gameState: GameState,
  pvpBattleState: PvpBattleState,
): Promise<void> {
  const { error } = await supabase
    .from("battle_rooms")
    .update({
      game_state: gameState,
      pvp_battle_state: pvpBattleState,
    })
    .eq("id", roomId);

  if (error) throw new Error(`状態保存失敗: ${error.message}`);
}

/** ルームを終了状態に更新 */
export async function finishRoom(roomId: string): Promise<void> {
  const { error } = await supabase
    .from("battle_rooms")
    .update({ status: "finished" })
    .eq("id", roomId);

  if (error) throw new Error(`ルーム終了失敗: ${error.message}`);
}

/** Realtime でルームの変更を購読 */
export function subscribeToRoom(
  roomId: string,
  onUpdate: (room: BattleRoom) => void,
): RealtimeChannel {
  // 毎回ユニークなチャンネル名にして、removeChannel の非同期競合を回避
  const channel = supabase
    .channel(`room:${roomId}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "battle_rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        onUpdate(payload.new as BattleRoom);
      },
    )
    .subscribe();

  return channel;
}

/** Realtime 購読を解除 */
export function unsubscribeFromRoom(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
