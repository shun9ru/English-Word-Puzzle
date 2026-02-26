/**
 * スペル確認機能
 * 日本語（ひらがな・カタカナ・漢字）または英語入力から英単語候補を検索する
 */

import type { DictEntry } from "./types";
import { expandKanjiQuery } from "./kanjiMap";

/** カタカナ → ひらがな変換 */
function kataToHira(str: string): string {
  return str.replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/** 漢字を含むか判定 (CJK統合漢字 U+4E00–U+9FFF) */
function hasKanji(str: string): boolean {
  return /[\u4E00-\u9FFF]/.test(str);
}

/**
 * クエリで辞書を検索し、一致する英単語候補を返す。
 * - 英語入力: word の前方一致・部分一致（大文字小文字無視）
 * - ひらがな/カタカナ入力: meaning の部分一致（カタカナ→ひらがな正規化）
 * - 漢字入力: 漢字→ひらがな読みに展開して meaning を検索
 * @param query 検索文字列（日本語 or 英語）
 * @param entries 辞書エントリ一覧
 * @returns マッチした辞書エントリ（最大10件）
 */
export function spellCheck(
  query: string,
  entries: DictEntry[]
): DictEntry[] {
  const normalized = query.trim();
  if (normalized.length === 0) return [];

  const queryLower = normalized.toLowerCase();

  // 英語（ASCII文字のみ）かどうか判定
  const isAscii = /^[a-zA-Z]+$/.test(normalized);

  if (isAscii) {
    // 英語検索: 前方一致を優先、その後部分一致
    const prefix: DictEntry[] = [];
    const partial: DictEntry[] = [];
    for (const e of entries) {
      const wordLower = e.word.toLowerCase();
      if (wordLower.startsWith(queryLower)) {
        prefix.push(e);
      } else if (wordLower.includes(queryLower)) {
        partial.push(e);
      }
    }
    return [...prefix, ...partial].slice(0, 10);
  }

  // 日本語検索
  const queryHira = kataToHira(normalized);
  const found = new Map<string, DictEntry>();

  // 1. 直接の部分一致（ひらがな・カタカナ・漢字そのまま）
  for (const e of entries) {
    const meaningHira = kataToHira(e.meaning);
    if (meaningHira.includes(queryHira) || e.meaning.includes(normalized)) {
      found.set(e.word, e);
    }
  }

  // 2. 漢字が含まれていたら読みに展開して再検索
  if (hasKanji(normalized)) {
    const readings = expandKanjiQuery(normalized);
    for (const reading of readings) {
      for (const e of entries) {
        if (found.has(e.word)) continue;
        const meaningHira = kataToHira(e.meaning);
        if (meaningHira.includes(reading) || e.meaning.includes(reading)) {
          found.set(e.word, e);
        }
      }
    }
  }

  return [...found.values()].slice(0, 10);
}
