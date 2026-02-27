/**
 * デッキ構築ロジック（純粋関数・定数のみ）
 * データ永続化はSupabaseのcollectionService/userServiceが担当。
 */

import type { SpecialCard, SpecialEffectType } from "../types";
import { shuffle } from "../core/helpers";

/** レベル上限 */
export const MAX_LEVEL = 5;

/** デッキ制約 */
export const DECK_MAX = 20;
export const SR_MAX = 2;
export const SSR_MAX = 1;

/** デッキにカードを追加できるか検証 */
export function canAddToDeck(deck: SpecialCard[], card: SpecialCard): { ok: boolean; reason?: string } {
  if (deck.length >= DECK_MAX) {
    return { ok: false, reason: `デッキは最大${DECK_MAX}枚です。` };
  }

  // 同じid（合成済み1枚）はデッキに1枚まで
  const hasSame = deck.some((c) => c.id === card.id);
  if (hasSame) {
    return { ok: false, reason: "同じカードは1枚までです。" };
  }

  if (card.rarity === "SR") {
    const srCount = deck.filter((c) => c.rarity === "SR").length;
    if (srCount >= SR_MAX) {
      return { ok: false, reason: `SRはデッキ最大${SR_MAX}枚までです。` };
    }
  }

  if (card.rarity === "SSR") {
    const ssrCount = deck.filter((c) => c.rarity === "SSR").length;
    if (ssrCount >= SSR_MAX) {
      return { ok: false, reason: `SSRはデッキ最大${SSR_MAX}枚までです。` };
    }
  }

  return { ok: true };
}

/**
 * レベルに応じた効果値を計算（タイプ別スケーリング）。
 * effectType を渡すとタイプに応じた適切なスケーリングを適用。
 */
export function scaledEffectValue(base: number, level: number, effectType?: SpecialEffectType): number {
  const lv = Math.min(Math.max(level, 1), MAX_LEVEL);

  if (!effectType) {
    // 後方互換: effectType未指定時は旧式計算
    const multiplier = 1 + (lv - 1) * 0.25;
    return Math.round(base * multiplier * 100) / 100;
  }

  switch (effectType) {
    // 線形スケーリング: base + (lv-1) * step
    case "bonus_flat":
    case "reduce_opponent":
    case "steal_points":
    case "heal_hp":
    case "bonus_per_letter":
    case "poison": {
      const step = Math.max(1, Math.ceil(base * 0.25));
      return base + (lv - 1) * step;
    }

    // 整数テーブル: 小さい整数値用
    case "draw_normal":
    case "recover_free":
    case "draw_special": {
      const tables: Record<number, number[]> = {
        1: [1, 1, 2, 2, 3],
        2: [2, 2, 3, 3, 4],
        3: [3, 3, 4, 4, 5],
      };
      const table = tables[base];
      if (table) return table[lv - 1];
      return base + Math.floor((lv - 1) / 2);
    }

    // 倍率スケーリング: base + (lv-1) * 0.1
    case "word_multiplier":
    case "next_turn_mult":
      return Math.round((base + (lv - 1) * 0.1) * 100) / 100;

    // 持続ターン: base + floor((lv-1)/2)
    case "shield":
    case "mirror":
      return base + Math.floor((lv - 1) / 2);

    // スケーリングなし
    case "force_letter_count":
    case "upgrade_bonus":
      return base;
  }
}

/** ゲーム用にデッキをシャッフルして返す */
export function prepareGameDeck(deck: SpecialCard[]): SpecialCard[] {
  return shuffle(deck);
}
