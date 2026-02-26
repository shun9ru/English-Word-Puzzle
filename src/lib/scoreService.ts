import { supabase } from "./supabase";
import type { Category } from "../game/types";

export interface ScoreRecord {
  id: number;
  user_id: string;
  score: number;
  category: string;
  turn: number;
  words: string[];
  played_at: string;
}

/** スコア保存 */
export async function saveScoreToDB(
  userId: string,
  score: number,
  category: Category,
  turn: number,
  words: string[]
): Promise<void> {
  const { error } = await supabase.from("scores").insert({
    user_id: userId,
    score,
    category,
    turn,
    words,
  });
  if (error) throw error;
}

/** カテゴリ別グローバルランキング */
export async function getGlobalCategoryRanking(
  category: Category,
  limit: number = 10
): Promise<ScoreRecord[]> {
  const { data, error } = await supabase
    .from("scores")
    .select()
    .eq("category", category)
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ScoreRecord[]) ?? [];
}

/** 総合グローバルランキング */
export async function getGlobalOverallRanking(
  limit: number = 10
): Promise<ScoreRecord[]> {
  const { data, error } = await supabase
    .from("scores")
    .select()
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ScoreRecord[]) ?? [];
}
