/**
 * スペル確認モーダル
 */

import { useState, useCallback } from "react";
import type { DictEntry } from "../game/types";
import { spellCheck } from "../game/spellCheck";
import "../styles/SpellCheck.css";

interface SpellCheckModalProps {
  entries: DictEntry[];
  onClose: () => void;
  remaining: number;
  onUse: () => void;
}

export function SpellCheckModal({ entries, onClose, remaining, onUse }: SpellCheckModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DictEntry[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(() => {
    if (query.trim().length === 0) return;
    const found = spellCheck(query, entries);
    setResults(found);
    setSearched(true);
    onUse();
  }, [query, entries, onUse]);

  return (
    <div className="spell-modal-overlay" onClick={onClose}>
      <div className="spell-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="spell-modal__title">スペル確認</h3>
        <p className="spell-modal__desc">
          日本語を入力して英単語を検索できます（残り{remaining}回）
        </p>

        <div className="spell-modal__input-row">
          <input
            type="text"
            className="spell-modal__input"
            placeholder="日本語を入力..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !searched && handleSearch()}
            autoFocus
            disabled={searched}
          />
          <button
            className="spell-modal__search-btn"
            onClick={handleSearch}
            disabled={searched || query.trim().length === 0}
          >
            検索
          </button>
        </div>

        {searched && (
          <div className="spell-modal__results">
            {results.length > 0 ? (
              <ul className="spell-modal__list">
                {results.map((r) => (
                  <li key={r.word} className="spell-modal__item">
                    <span className="spell-modal__word">{r.word}</span>
                    <span className="spell-modal__meaning">{r.meaning}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="spell-modal__no-result">見つかりませんでした。</p>
            )}
          </div>
        )}

        <button className="spell-modal__close-btn" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
