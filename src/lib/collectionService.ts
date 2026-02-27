import { supabase } from "./supabase";
import type { SpecialCard, Category } from "../game/types";
import { SPECIAL_CARD_DEFS } from "../data/specialCardDefs";

const MAX_LEVEL = 5;

/** レベルアップに必要な累計コピー数: index=level */
const LEVEL_THRESHOLDS = [0, 1, 3, 6, 10, 15];

/** card_id から SpecialCardDef を復元 */
function cardDefById(cardId: string) {
  return SPECIAL_CARD_DEFS.find((d) => d.id === cardId);
}

/** DBレコード → SpecialCard に変換 */
function toSpecialCard(row: { card_id: string; instance_id: string; level: number }): SpecialCard | null {
  const def = cardDefById(row.card_id);
  if (!def) return null;
  return { ...def, instanceId: row.instance_id, level: row.level };
}

/** コレクション読み込み */
export async function loadCollectionFromDB(userId: string): Promise<SpecialCard[]> {
  const { data, error } = await supabase
    .from("collections")
    .select()
    .eq("user_id", userId);
  if (error) {
    console.error("loadCollectionFromDB error:", error);
    throw error;
  }
  return (data ?? [])
    .map((r: { card_id: string; instance_id: string; level: number }) => toSpecialCard(r))
    .filter((c): c is SpecialCard => c !== null);
}

/** カードをコレクションに追加（同card_idなら累進コストでレベルアップ） */
export async function addToCollectionDB(userId: string, card: SpecialCard): Promise<{
  isLevelUp: boolean;
  newLevel: number;
  copies: number;
  copiesNeeded: number;
}> {
  // まず既存カードを探す（.maybeSingle で 0件でもエラーにならない）
  const { data: existing, error: selectErr } = await supabase
    .from("collections")
    .select()
    .eq("user_id", userId)
    .eq("card_id", card.id)
    .maybeSingle();

  if (selectErr) {
    console.error("addToCollectionDB select error:", selectErr);
    throw selectErr;
  }

  if (existing) {
    const oldLevel = (existing as { level: number; copies?: number }).level;
    const oldCopies = (existing as { copies?: number }).copies ?? oldLevel;
    const newCopies = oldCopies + 1;

    // 累進コスト: copies が次レベルの閾値に達したらレベルアップ
    let newLevel = oldLevel;
    if (oldLevel < MAX_LEVEL && newCopies >= LEVEL_THRESHOLDS[oldLevel + 1]) {
      newLevel = oldLevel + 1;
    }

    const copiesNeeded = newLevel < MAX_LEVEL ? LEVEL_THRESHOLDS[newLevel + 1] : newCopies;

    const { error: updateErr } = await supabase
      .from("collections")
      .update({ level: newLevel, copies: newCopies })
      .eq("user_id", userId)
      .eq("card_id", card.id);
    if (updateErr) {
      console.error("addToCollectionDB update error:", updateErr);
      throw updateErr;
    }
    return { isLevelUp: newLevel > oldLevel, newLevel, copies: newCopies, copiesNeeded };
  }

  const { error: insertErr } = await supabase.from("collections").insert({
    user_id: userId,
    card_id: card.id,
    instance_id: card.instanceId,
    level: 1,
    copies: 1,
  });
  if (insertErr) {
    console.error("addToCollectionDB insert error:", insertErr);
    throw insertErr;
  }
  return { isLevelUp: false, newLevel: 1, copies: 1, copiesNeeded: LEVEL_THRESHOLDS[2] };
}

/** カード別コピー数情報 */
export interface CardCopiesInfo {
  copies: number;
  copiesNeeded: number;
}

/** コレクション全カードのコピー進捗をMap形式で返す */
export async function loadCollectionCopiesMap(userId: string): Promise<Map<string, CardCopiesInfo>> {
  const { data, error } = await supabase
    .from("collections")
    .select("card_id, level, copies")
    .eq("user_id", userId);
  if (error) {
    console.error("loadCollectionCopiesMap error:", error);
    return new Map();
  }
  const map = new Map<string, CardCopiesInfo>();
  for (const row of (data ?? []) as { card_id: string; level: number; copies?: number }[]) {
    const level = row.level;
    const copies = row.copies ?? level;
    const copiesNeeded = level < MAX_LEVEL ? LEVEL_THRESHOLDS[level + 1] : copies;
    map.set(row.card_id, { copies, copiesNeeded });
  }
  return map;
}

/** デッキ読み込み（カテゴリ別・スロット別） */
export async function loadDeckFromDB(userId: string, category?: Category, slot: number = 0): Promise<SpecialCard[]> {
  let query = supabase
    .from("decks")
    .select()
    .eq("user_id", userId)
    .eq("slot", slot);
  if (category) {
    query = query.eq("category", category);
  }
  let { data, error } = await query.order("slot_order", { ascending: true });

  // slot カラムが未追加の場合はフォールバック（slot フィルタなし）
  if (error) {
    console.warn("loadDeckFromDB: slot filter failed, falling back without slot:", error.message);
    let fallbackQuery = supabase.from("decks").select().eq("user_id", userId);
    if (category) fallbackQuery = fallbackQuery.eq("category", category);
    const fallback = await fallbackQuery.order("slot_order", { ascending: true });
    data = fallback.data;
    error = fallback.error;
  }
  if (error) {
    console.error("loadDeckFromDB error:", error);
    throw error;
  }

  // デッキのcard_idに対応するコレクションのlevelを取得
  const { data: collData } = await supabase
    .from("collections")
    .select("card_id, level")
    .eq("user_id", userId);
  const levelMap = new Map<string, number>();
  for (const c of (collData ?? []) as { card_id: string; level: number }[]) {
    levelMap.set(c.card_id, c.level);
  }

  return (data ?? [])
    .map((r: { card_id: string; instance_id: string }) => {
      const def = cardDefById(r.card_id);
      if (!def) return null;
      return { ...def, instanceId: r.instance_id, level: levelMap.get(r.card_id) ?? 1 } as SpecialCard;
    })
    .filter((c): c is SpecialCard => c !== null);
}

/** デッキ保存（カテゴリ別・スロット別・全置換） */
export async function saveDeckToDB(userId: string, deck: SpecialCard[], category: Category, slot: number = 0): Promise<void> {
  // 削除: slot フィルタ付き → フォールバック
  let delErr = (await supabase.from("decks").delete().eq("user_id", userId).eq("category", category).eq("slot", slot)).error;
  if (delErr) {
    // slot カラム未追加の場合フォールバック
    console.warn("saveDeckToDB: slot delete failed, falling back:", delErr.message);
    delErr = (await supabase.from("decks").delete().eq("user_id", userId).eq("category", category)).error;
    if (delErr) {
      console.error("saveDeckToDB delete error:", delErr);
      throw delErr;
    }
  }
  if (deck.length > 0) {
    const rows = deck.map((card, i) => ({
      user_id: userId,
      card_id: card.id,
      instance_id: card.instanceId,
      slot_order: i,
      category,
      slot,
    }));
    let insErr = (await supabase.from("decks").insert(rows)).error;
    if (insErr) {
      // slot カラム未追加の場合、slot 無しで再試行
      console.warn("saveDeckToDB: slot insert failed, retrying without slot:", insErr.message);
      const rowsNoSlot = deck.map((card, i) => ({
        user_id: userId,
        card_id: card.id,
        instance_id: card.instanceId,
        slot_order: i,
        category,
      }));
      insErr = (await supabase.from("decks").insert(rowsNoSlot)).error;
      if (insErr) {
        console.error("saveDeckToDB insert error:", insErr);
        throw insErr;
      }
    }
  }
}

/** 各スロットのカード枚数を取得（デッキ選択画面用） */
export async function loadDeckSlotSummary(userId: string, category: Category): Promise<{ slot: number; count: number }[]> {
  let { data, error } = await supabase
    .from("decks")
    .select("slot")
    .eq("user_id", userId)
    .eq("category", category);
  if (error) {
    // slot カラム未追加の場合: 全件カウントして slot=0 として返す
    console.warn("loadDeckSlotSummary: slot query failed, falling back:", error.message);
    const fallback = await supabase.from("decks").select("card_id").eq("user_id", userId).eq("category", category);
    if (fallback.error || !fallback.data) return [];
    return fallback.data.length > 0 ? [{ slot: 0, count: fallback.data.length }] : [];
  }
  const counts = new Map<number, number>();
  for (const row of (data ?? []) as { slot: number }[]) {
    counts.set(row.slot, (counts.get(row.slot) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([slot, count]) => ({ slot, count }));
}
