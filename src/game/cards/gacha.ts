/**
 * ガチャロジック
 */

import type { Rarity, SpecialCard, SpecialCardDef, Category } from "../types";
import { SPECIAL_CARD_DEFS } from "../../data/specialCardDefs";

/** ガチャバナー定義 */
export interface GachaBanner {
  id: string;
  name: string;
  description: string;
  singleCost: number;
  multiCost: number;
  rates: { rarity: Rarity; weight: number }[];
  /** カテゴリフィルタ（指定時はそのカテゴリ + "all" のカードのみ排出） */
  categoryFilter?: Category;
}

/** バナー一覧 */
export const GACHA_BANNERS: GachaBanner[] = [
  {
    id: "normal",
    name: "ノーマルガチャ",
    description: "通常排出率",
    singleCost: 10,
    multiCost: 90,
    rates: [
      { rarity: "N", weight: 60 },
      { rarity: "R", weight: 25 },
      { rarity: "SR", weight: 10 },
      { rarity: "SSR", weight: 5 },
    ],
  },
  {
    id: "sr_up",
    name: "SR確率UPガチャ",
    description: "SR・SSRの排出率が上昇！",
    singleCost: 30,
    multiCost: 270,
    rates: [
      { rarity: "N", weight: 40 },
      { rarity: "R", weight: 25 },
      { rarity: "SR", weight: 25 },
      { rarity: "SSR", weight: 10 },
    ],
  },
  {
    id: "ssr_up",
    name: "SSR確率UPガチャ",
    description: "SSR排出率が大幅上昇！！",
    singleCost: 50,
    multiCost: 450,
    rates: [
      { rarity: "N", weight: 30 },
      { rarity: "R", weight: 25 },
      { rarity: "SR", weight: 25 },
      { rarity: "SSR", weight: 20 },
    ],
  },
  {
    id: "category",
    name: "カテゴリ別ガチャ",
    description: "選んだカテゴリのカードのみ排出",
    singleCost: 15,
    multiCost: 135,
    rates: [
      { rarity: "N", weight: 60 },
      { rarity: "R", weight: 25 },
      { rarity: "SR", weight: 10 },
      { rarity: "SSR", weight: 5 },
    ],
  },
];

/** レアリティを抽選する */
function rollRarity(rates: { rarity: Rarity; weight: number }[]): Rarity {
  const total = rates.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const { rarity, weight } of rates) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return "N";
}

/** ユニークIDを生成 */
function generateInstanceId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** カードプールを取得（カテゴリフィルタ対応） */
function getPool(rarity: Rarity, categoryFilter?: Category): SpecialCardDef[] {
  let pool = SPECIAL_CARD_DEFS.filter((c) => c.rarity === rarity);
  if (categoryFilter) {
    pool = pool.filter((c) => c.category === categoryFilter || c.category === "all");
  }
  return pool;
}

/** バナー指定でガチャを1回引く */
export function pullGachaWithBanner(banner: GachaBanner): SpecialCard {
  const rarity = rollRarity(banner.rates);
  const pool = getPool(rarity, banner.categoryFilter);
  // プールが空の場合はレアリティを下げてフォールバック
  const finalPool = pool.length > 0 ? pool : SPECIAL_CARD_DEFS.filter((c) => c.rarity === rarity);
  const def = finalPool[Math.floor(Math.random() * finalPool.length)];
  return { ...def, instanceId: generateInstanceId(), level: 1 };
}

/** バナー指定で10連ガチャ */
export function pullGacha10WithBanner(banner: GachaBanner): SpecialCard[] {
  const results: SpecialCard[] = [];
  for (let i = 0; i < 10; i++) {
    results.push(pullGachaWithBanner(banner));
  }
  // 10連保証: SR以上が1枚もなければ最後の1枚をSR以上にする
  const hasSRPlus = results.some((c) => c.rarity === "SR" || c.rarity === "SSR");
  if (!hasSRPlus) {
    let srPool = SPECIAL_CARD_DEFS.filter((c) => c.rarity === "SR" || c.rarity === "SSR");
    if (banner.categoryFilter) {
      const filtered = srPool.filter((c) => c.category === banner.categoryFilter || c.category === "all");
      if (filtered.length > 0) srPool = filtered;
    }
    const def = srPool[Math.floor(Math.random() * srPool.length)];
    results[9] = { ...def, instanceId: generateInstanceId(), level: 1 };
  }
  return results;
}

/** ガチャを1回引く（互換用：ノーマルバナー） */
export function pullGacha(): SpecialCard {
  return pullGachaWithBanner(GACHA_BANNERS[0]);
}

/** ガチャを10連で引く（互換用：ノーマルバナー） */
export function pullGacha10(): SpecialCard[] {
  return pullGacha10WithBanner(GACHA_BANNERS[0]);
}

/** カード定義を取得 */
export function getCardDef(id: string): SpecialCardDef | undefined {
  return SPECIAL_CARD_DEFS.find((c) => c.id === id);
}

/** レアリティの色を取得 */
export function rarityColor(rarity: Rarity): string {
  switch (rarity) {
    case "N": return "#78909c";
    case "R": return "#42a5f5";
    case "SR": return "#ab47bc";
    case "SSR": return "#ffd54f";
  }
}

/** レアリティのラベル */
export function rarityLabel(rarity: Rarity): string {
  switch (rarity) {
    case "N": return "N";
    case "R": return "R";
    case "SR": return "SR";
    case "SSR": return "SSR";
  }
}
