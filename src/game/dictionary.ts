/**
 * 辞書読み込みモジュール
 */

import type { Category, DictEntry } from "./types";

/**
 * 指定カテゴリの辞書を読み込む。
 * JSON は DictEntry[] を想定。
 */
export async function loadDictionary(
  category: Category
): Promise<{ set: Set<string>; entries: DictEntry[] }> {
  const url = `${import.meta.env.BASE_URL}dictionaries/stages/${category}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`辞書の読み込みに失敗: ${category} (${res.status})`);
  }
  const entries: DictEntry[] = await res.json();
  const set = new Set(entries.map((e) => e.word.toUpperCase()));
  return { set, entries };
}
