/**
 * デッキ構築ロジック（純粋関数・定数のみ）
 * データ永続化はSupabaseのcollectionService/userServiceが担当。
 */

import type { SpecialCard } from "../types";
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
 * レベルに応じた効果値を計算。
 * Lv1=基本値、Lv2=+25%、Lv3=+50%、Lv4=+75%、Lv5=+100%（2倍）
 */
export function scaledEffectValue(base: number, level: number): number {
  const multiplier = 1 + (level - 1) * 0.25;
  return Math.round(base * multiplier * 100) / 100;
}

/** ゲーム用にデッキをシャッフルして返す */
export function prepareGameDeck(deck: SpecialCard[]): SpecialCard[] {
  return shuffle(deck);
}
