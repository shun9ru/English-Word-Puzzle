/**
 * コレクション画面（カード図鑑 + 単語図鑑）
 */

import { useState, useEffect, useMemo } from "react";
import type { SpecialCard, Category, DictEntry } from "../game/types";
import { SPECIAL_CARD_DEFS, emojiToImageUrl } from "../data/specialCardDefs";
import { loadCollectionFromDB, loadCollectionCopiesMap } from "../lib/collectionService";
import type { CardCopiesInfo } from "../lib/collectionService";
import { loadUsedWords } from "../lib/scoreService";
import { loadDictionary } from "../game/dictionary";
import { rarityColor } from "../game/cards/gacha";
import { MAX_LEVEL, scaledEffectValue } from "../game/cards/deck";
import "../styles/Collection.css";
import "../styles/DeckEditor.css";

type Tab = "cards" | "words";

const WORD_CATEGORIES: { key: Category; label: string }[] = [
  { key: "animals", label: "Animals" },
  { key: "food", label: "Food" },
  { key: "jobs", label: "Jobs" },
  { key: "hobby", label: "Hobby" },
];

interface CollectionScreenProps {
  userId: string;
  onBack: () => void;
}

export function CollectionScreen({ userId, onBack }: CollectionScreenProps) {
  const [tab, setTab] = useState<Tab>("cards");
  const [collection, setCollection] = useState<SpecialCard[]>([]);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [copiesMap, setCopiesMap] = useState<Map<string, CardCopiesInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<SpecialCard | null>(null);

  // カード図鑑用
  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadCollectionFromDB(userId),
      loadUsedWords(userId),
      loadCollectionCopiesMap(userId),
    ]).then(([coll, words, copies]) => {
      setCollection(coll);
      setUsedWords(words);
      setCopiesMap(copies);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="collection">
        <p className="collection__loading">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="collection">
      <h1 className="collection__title">コレクション</h1>

      <div className="collection__main-tabs">
        <button
          className={`collection__main-tab ${tab === "cards" ? "collection__main-tab--active" : ""}`}
          onClick={() => setTab("cards")}
        >
          カード図鑑
        </button>
        <button
          className={`collection__main-tab ${tab === "words" ? "collection__main-tab--active" : ""}`}
          onClick={() => setTab("words")}
        >
          単語図鑑
        </button>
      </div>

      {tab === "cards" ? (
        <CardCollection collection={collection} onCardClick={setSelectedCard} />
      ) : (
        <WordCollection userId={userId} usedWords={usedWords} />
      )}

      <button className="collection__back-btn" onClick={onBack}>
        もどる
      </button>

      {selectedCard && (
        <CollectionCardModal
          card={selectedCard}
          copiesInfo={copiesMap.get(selectedCard.id)}
          onClose={() => setSelectedCard(null)}
        />
      )}
    </div>
  );
}

/* ===================== カード図鑑 ===================== */

function CardCollection({ collection, onCardClick }: { collection: SpecialCard[]; onCardClick: (card: SpecialCard) => void }) {
  const ownedMap = useMemo(() => {
    const map = new Map<string, SpecialCard>();
    for (const c of collection) map.set(c.id, c);
    return map;
  }, [collection]);

  const ownedCount = ownedMap.size;
  const totalCount = SPECIAL_CARD_DEFS.length;
  const pct = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;

  const rarityOrder = { SSR: 0, SR: 1, R: 2, N: 3 };
  const sorted = [...SPECIAL_CARD_DEFS].sort(
    (a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]
  );

  return (
    <>
      <div className="collection__progress">
        <p className="collection__progress-text">
          入手済み: {ownedCount} / {totalCount}（{pct}%）
        </p>
        <div className="collection__progress-bar">
          <div className="collection__progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="collection__card-grid">
        {sorted.map((def) => {
          const owned = ownedMap.get(def.id);
          return owned ? (
            <OwnedCard key={def.id} card={owned} onClick={() => onCardClick(owned)} />
          ) : (
            <UnknownCard key={def.id} def={def} />
          );
        })}
      </div>
    </>
  );
}

function OwnedCard({ card, onClick }: { card: SpecialCard; onClick: () => void }) {
  const isMaxLevel = card.level >= MAX_LEVEL;
  return (
    <div
      className="collection__card collection__card--owned"
      style={{ borderColor: rarityColor(card.rarity), cursor: "pointer" }}
      onClick={onClick}
    >
      {card.level > 1 && (
        <span className={`collection__card-level${isMaxLevel ? " collection__card-level--max" : ""}`}>
          Lv.{card.level}
        </span>
      )}
      <img className="collection__card-icon" src={emojiToImageUrl(card.icon)} alt={card.word} />
      <span className="collection__card-word">{card.word}</span>
      <span className="collection__card-meaning">{card.meaning}</span>
      <span className="collection__card-desc">{card.description}</span>
      <span className="collection__card-rarity" style={{ color: rarityColor(card.rarity) }}>
        {card.rarity}
      </span>
    </div>
  );
}

function UnknownCard({ def }: { def: typeof SPECIAL_CARD_DEFS[number] }) {
  return (
    <div className="collection__card collection__card--unknown">
      <img
        className="collection__card-icon collection__card-icon--unknown"
        src={emojiToImageUrl(def.icon)}
        alt="?"
      />
      <span className="collection__card-word">???</span>
      <span className="collection__card-meaning">???</span>
      <span className="collection__card-rarity" style={{ color: "#90a4ae" }}>
        {def.rarity}
      </span>
    </div>
  );
}

/* ===================== カード詳細モーダル ===================== */

const CATEGORY_LABELS: Record<string, string> = {
  animals: "Animals", food: "Food", jobs: "Jobs", hobby: "Hobby", all: "All Genre",
};

function buildLevelTable(card: SpecialCard): { level: number; desc: string }[] {
  const rows: { level: number; desc: string }[] = [];
  for (let lv = 1; lv <= MAX_LEVEL; lv++) {
    const val = scaledEffectValue(card.effectValue, lv, card.effectType);
    const rounded = Math.round(val * 10) / 10;
    let desc = card.description;
    if (card.effectType === "word_multiplier" || card.effectType === "next_turn_mult") {
      desc = card.description.replace(/[\d.]+/, String(rounded));
    } else if (card.effectType !== "force_letter_count" && card.effectType !== "upgrade_bonus") {
      desc = card.description.replace(/\d+/, String(Math.round(val)));
    }
    rows.push({ level: lv, desc });
  }
  return rows;
}

function CollectionCardModal({ card, copiesInfo, onClose }: {
  card: SpecialCard;
  copiesInfo: CardCopiesInfo | undefined;
  onClose: () => void;
}) {
  const levelTable = buildLevelTable(card);
  const isMax = card.level >= MAX_LEVEL;

  return (
    <div className="deck-editor-modal-overlay" onClick={onClose}>
      <div className="deck-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="deck-editor-modal__header">
          <img className="deck-editor-modal__icon" src={emojiToImageUrl(card.icon)} alt={card.word} />
          <div className="deck-editor-modal__header-info">
            <span className="deck-editor-modal__word">{card.word}</span>
            <span className="deck-editor-modal__meaning">{card.meaning}</span>
            <span className="deck-editor-modal__rarity" style={{ color: rarityColor(card.rarity) }}>
              {card.rarity}
            </span>
            {card.battleOnly && <span className="deck-editor-modal__battle-tag">バトル専用</span>}
          </div>
        </div>

        <div className="deck-editor-modal__categories">
          {card.categories.map((cat) => (
            <span key={cat} className="deck-editor-modal__cat-pill">{CATEGORY_LABELS[cat] ?? cat}</span>
          ))}
        </div>

        <div className="deck-editor-modal__level-section">
          <span className="deck-editor-modal__level-label">
            Lv.{card.level}{isMax ? " (MAX)" : ""}
          </span>
          {copiesInfo && !isMax ? (
            <div className="deck-editor-modal__copies">
              <div className="deck-editor-modal__copies-bar">
                <div
                  className="deck-editor-modal__copies-fill"
                  style={{ width: `${Math.min(100, (copiesInfo.copies / copiesInfo.copiesNeeded) * 100)}%` }}
                />
              </div>
              <span className="deck-editor-modal__copies-text">
                {copiesInfo.copies}/{copiesInfo.copiesNeeded} コピー
              </span>
            </div>
          ) : isMax ? (
            <span className="deck-editor-modal__copies-max">MAX</span>
          ) : null}
        </div>

        <div className="deck-editor-modal__effect">
          <span className="deck-editor-modal__effect-label">現在の効果:</span>
          <span className="deck-editor__card-desc">{card.description}</span>
        </div>

        <div className="deck-editor-modal__table-wrap">
          <table className="deck-editor-modal__table">
            <thead>
              <tr><th>Lv.</th><th>効果</th></tr>
            </thead>
            <tbody>
              {levelTable.map((row) => (
                <tr
                  key={row.level}
                  className={row.level === card.level ? "deck-editor-modal__table-row--current" : ""}
                >
                  <td>Lv.{row.level}</td>
                  <td>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="deck-editor-modal__actions">
          <button className="deck-editor-modal__btn deck-editor-modal__btn--close" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== 単語図鑑 ===================== */

function WordCollection({ userId: _userId, usedWords }: { userId: string; usedWords: Set<string> }) {
  const [wordCat, setWordCat] = useState<Category>("animals");
  const [dictEntries, setDictEntries] = useState<DictEntry[]>([]);
  const [dictLoading, setDictLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setDictLoading(true);
    loadDictionary(wordCat).then(({ entries }) => {
      setDictEntries(entries);
      setDictLoading(false);
    }).catch(() => setDictLoading(false));
  }, [wordCat]);

  const filtered = useMemo(() => {
    if (!search) return dictEntries;
    const q = search.toUpperCase();
    return dictEntries.filter((e) => e.word.toUpperCase().includes(q));
  }, [dictEntries, search]);

  const knownCount = useMemo(
    () => dictEntries.filter((e) => usedWords.has(e.word.toUpperCase())).length,
    [dictEntries, usedWords]
  );
  const totalCount = dictEntries.length;
  const pct = totalCount > 0 ? Math.round((knownCount / totalCount) * 100) : 0;

  return (
    <>
      <div className="collection__cat-tabs">
        {WORD_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`collection__cat-tab ${wordCat === cat.key ? "collection__cat-tab--active" : ""}`}
            onClick={() => { setWordCat(cat.key); setSearch(""); }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="collection__progress">
        <p className="collection__progress-text">
          学習済み: {knownCount} / {totalCount}（{pct}%）
        </p>
        <div className="collection__progress-bar">
          <div className="collection__progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="collection__search">
        <input
          className="collection__search-input"
          type="text"
          placeholder="単語を検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {dictLoading ? (
        <p className="collection__loading">辞書を読み込み中...</p>
      ) : (
        <ul className="collection__word-list">
          {filtered.map((entry) => {
            const known = usedWords.has(entry.word.toUpperCase());
            return (
              <li
                key={entry.word}
                className={`collection__word-item ${known ? "collection__word-item--known" : ""}`}
              >
                <span className={`collection__word-mark ${known ? "collection__word-mark--known" : ""}`}>
                  {known ? "\u2713" : ""}
                </span>
                <span className="collection__word-eng">{entry.word}</span>
                <span className={known ? "collection__word-jpn" : "collection__word-jpn collection__word-jpn--hidden"}>
                  {known ? entry.meaning : "---"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
