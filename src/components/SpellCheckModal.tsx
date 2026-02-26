/**
 * スペル確認モーダル（検索履歴付き）
 */

import { useState, useCallback } from "react";
import type { DictEntry, SpellHistoryEntry } from "../game/types";
import { spellCheck } from "../game/spellCheck";
import "../styles/SpellCheck.css";

interface SpellCheckModalProps {
  entries: DictEntry[];
  remaining: number;
  history: SpellHistoryEntry[];
  onUse: () => void;
  onAddHistory: (entry: SpellHistoryEntry) => void;
  onClose: () => void;
}

export function SpellCheckModal({
  entries, remaining, history, onUse, onAddHistory, onClose,
}: SpellCheckModalProps) {
  const [query, setQuery] = useState("");

  const handleSearch = useCallback(() => {
    if (query.trim().length === 0) return;
    if (remaining <= 0) return;
    const found = spellCheck(query, entries);
    onAddHistory({ query: query.trim(), results: found });
    onUse();
    setQuery("");
  }, [query, entries, remaining, onUse, onAddHistory]);

  return (
    <div className="spell-modal-overlay" onClick={onClose}>
      <div className="spell-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="spell-modal__title">スペル確認</h3>
        <p className="spell-modal__desc">
          日本語や英語で検索できます（残り{remaining}回）
        </p>

        {remaining > 0 && (
          <div className="spell-modal__input-row">
            <input
              type="text"
              className="spell-modal__input"
              placeholder="ひらがな・カタカナ・漢字・英語"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              autoFocus
            />
            <button
              className="spell-modal__search-btn"
              onClick={handleSearch}
              disabled={query.trim().length === 0}
            >
              検索
            </button>
          </div>
        )}

        {history.length > 0 && (
          <div className="spell-modal__history">
            {[...history].reverse().map((h, i) => (
              <div key={i} className="spell-modal__history-entry">
                <div className="spell-modal__history-query">
                  「{h.query}」の検索結果
                </div>
                {h.results.length > 0 ? (
                  <ul className="spell-modal__list">
                    {h.results.map((r) => (
                      <li key={r.word} className="spell-modal__item">
                        <span className="spell-modal__word">{r.word}</span>
                        <span className="spell-modal__meaning">{r.meaning}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="spell-modal__no-result">見つかりませんでした</p>
                )}
              </div>
            ))}
          </div>
        )}

        {history.length === 0 && remaining <= 0 && (
          <p className="spell-modal__no-result">検索回数を使い切りました</p>
        )}

        <button className="spell-modal__close-btn" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
