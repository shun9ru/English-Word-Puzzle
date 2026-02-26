import { supabase } from "./supabase";
import type { SpecialCard, Category } from "../game/types";
import { SPECIAL_CARD_DEFS } from "../data/specialCardDefs";

const MAX_LEVEL = 5;

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

/** カードをコレクションに追加（同card_idならレベルアップ） */
export async function addToCollectionDB(userId: string, card: SpecialCard): Promise<{ isLevelUp: boolean; newLevel: number }> {
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
    const oldLevel = (existing as { level: number }).level;
    const newLevel = Math.min(oldLevel + 1, MAX_LEVEL);
    const { error: updateErr } = await supabase
      .from("collections")
      .update({ level: newLevel })
      .eq("user_id", userId)
      .eq("card_id", card.id);
    if (updateErr) {
      console.error("addToCollectionDB update error:", updateErr);
      throw updateErr;
    }
    return { isLevelUp: newLevel > oldLevel, newLevel };
  }

  const { error: insertErr } = await supabase.from("collections").insert({
    user_id: userId,
    card_id: card.id,
    instance_id: card.instanceId,
    level: 1,
  });
  if (insertErr) {
    console.error("addToCollectionDB insert error:", insertErr);
    throw insertErr;
  }
  return { isLevelUp: false, newLevel: 1 };
}

/** デッキ読み込み（カテゴリ別） */
export async function loadDeckFromDB(userId: string, category?: Category): Promise<SpecialCard[]> {
  let query = supabase
    .from("decks")
    .select()
    .eq("user_id", userId);
  if (category) {
    query = query.eq("category", category);
  }
  const { data, error } = await query.order("slot_order", { ascending: true });
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

/** デッキ保存（カテゴリ別・全置換） */
export async function saveDeckToDB(userId: string, deck: SpecialCard[], category: Category): Promise<void> {
  const { error: delErr } = await supabase.from("decks").delete().eq("user_id", userId).eq("category", category);
  if (delErr) {
    console.error("saveDeckToDB delete error:", delErr);
    throw delErr;
  }
  if (deck.length > 0) {
    const rows = deck.map((card, i) => ({
      user_id: userId,
      card_id: card.id,
      instance_id: card.instanceId,
      slot_order: i,
      category,
    }));
    const { error: insErr } = await supabase.from("decks").insert(rows);
    if (insErr) {
      console.error("saveDeckToDB insert error:", insErr);
      throw insErr;
    }
  }
}
