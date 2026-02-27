/**
 * デッキ名の管理（localStorage 保存）
 */

const STORAGE_KEY = "ewp_deck_names";

/** localStorage からデッキ名マップを読み込み */
function loadDeckNames(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

/** キー: "category:slot" */
function makeKey(category: string, slot: number): string {
  return `${category}:${slot}`;
}

/** デッキ名を取得（未設定なら "Deck N"） */
export function getDeckName(category: string, slot: number): string {
  const map = loadDeckNames();
  return map[makeKey(category, slot)] ?? `Deck ${slot + 1}`;
}

/** デッキ名を保存 */
export function setDeckName(category: string, slot: number, name: string): void {
  const map = loadDeckNames();
  const trimmed = name.trim();
  if (trimmed && trimmed !== `Deck ${slot + 1}`) {
    map[makeKey(category, slot)] = trimmed;
  } else {
    delete map[makeKey(category, slot)];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
