/**
 * スペル確認機能
 * 日本語入力から英単語候補を検索する
 */

import type { DictEntry } from "./types";

/**
 * 日本語クエリで辞書を検索し、一致する英単語候補を返す。
 * @param query 日本語検索文字列
 * @param entries 辞書エントリ一覧
 * @returns マッチした辞書エントリ（最大5件）
 */
export function spellCheck(
  query: string,
  entries: DictEntry[]
): DictEntry[] {
  const normalized = query.trim();
  if (normalized.length === 0) return [];

  return entries
    .filter((e) => e.meaning.includes(normalized))
    .slice(0, 5);
}
