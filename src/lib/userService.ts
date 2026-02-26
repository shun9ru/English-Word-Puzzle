import { supabase } from "./supabase";

export interface UserRecord {
  id: string;
  is_admin: boolean;
  gacha_points: number;
  card_version: number;
  created_at: string;
  last_login_at: string;
}

/** ログイン（存在しなければ自動作成） */
export async function loginOrCreate(userId: string): Promise<UserRecord> {
  // まず既存ユーザーを検索
  const { data: existing } = await supabase
    .from("users")
    .select()
    .eq("id", userId)
    .single();

  if (existing) {
    // 最終ログイン更新
    await supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", userId);
    return existing as UserRecord;
  }

  // 新規作成
  const { data, error } = await supabase
    .from("users")
    .insert({ id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as UserRecord;
}

/** ユーザー取得 */
export async function getUser(userId: string): Promise<UserRecord | null> {
  const { data } = await supabase
    .from("users")
    .select()
    .eq("id", userId)
    .single();
  return (data as UserRecord) ?? null;
}

/** 全ユーザー一覧取得（管理者用） */
export async function getAllUsers(): Promise<UserRecord[]> {
  const { data, error } = await supabase
    .from("users")
    .select()
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as UserRecord[]) ?? [];
}

/** ガチャポイント更新（絶対値） */
export async function updateGachaPoints(userId: string, points: number): Promise<void> {
  const { error } = await supabase
    .from("users")
    .update({ gacha_points: points })
    .eq("id", userId);
  if (error) throw error;
}

/** ガチャポイント取得 */
export async function getGachaPoints(userId: string): Promise<number> {
  const { data } = await supabase
    .from("users")
    .select("gacha_points")
    .eq("id", userId)
    .single();
  return (data as { gacha_points: number } | null)?.gacha_points ?? 100;
}

/** ガチャポイント加算 */
export async function addGachaPointsDB(userId: string, amount: number): Promise<number> {
  const current = await getGachaPoints(userId);
  const newPoints = current + amount;
  await updateGachaPoints(userId, newPoints);
  return newPoints;
}

/** ユーザー削除（管理者用） */
export async function deleteUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);
  if (error) throw error;
}
