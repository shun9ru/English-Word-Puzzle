import { supabase } from "./supabase";
import type { SpecialCard } from "../game/types";
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
  if (error) throw error;
  return (data ?? [])
    .map((r: { card_id: string; instance_id: string; level: number }) => toSpecialCard(r))
    .filter((c): c is SpecialCard => c !== null);
}

/** カードをコレクションに追加（同card_idならレベルアップ） */
export async function addToCollectionDB(userId: string, card: SpecialCard): Promise<{ isLevelUp: boolean; newLevel: number }> {
  const { data: existing } = await supabase
    .from("collections")
    .select()
    .eq("user_id", userId)
    .eq("card_id", card.id)
    .single();

  if (existing) {
    const oldLevel = (existing as { level: number }).level;
    const newLevel = Math.min(oldLevel + 1, MAX_LEVEL);
    await supabase
      .from("collections")
      .update({ level: newLevel })
      .eq("user_id", userId)
      .eq("card_id", card.id);
    return { isLevelUp: newLevel > oldLevel, newLevel };
  }

  await supabase.from("collections").insert({
    user_id: userId,
    card_id: card.id,
    instance_id: card.instanceId,
    level: 1,
  });
  return { isLevelUp: false, newLevel: 1 };
}

/** デッキ読み込み */
export async function loadDeckFromDB(userId: string): Promise<SpecialCard[]> {
  const { data, error } = await supabase
    .from("decks")
    .select()
    .eq("user_id", userId)
    .order("slot_order", { ascending: true });
  if (error) throw error;

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

/** デッキ保存（全置換） */
export async function saveDeckToDB(userId: string, deck: SpecialCard[]): Promise<void> {
  await supabase.from("decks").delete().eq("user_id", userId);
  if (deck.length > 0) {
    const rows = deck.map((card, i) => ({
      user_id: userId,
      card_id: card.id,
      instance_id: card.instanceId,
      slot_order: i,
    }));
    await supabase.from("decks").insert(rows);
  }
}
