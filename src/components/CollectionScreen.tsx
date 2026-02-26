/**
 * コレクション画面（カード図鑑 + 単語図鑑）
 */

import { useState, useEffect, useMemo } from "react";
import type { SpecialCard, Category, DictEntry } from "../game/types";
import { SPECIAL_CARD_DEFS, emojiToImageUrl } from "../data/specialCardDefs";
import { loadCollectionFromDB } from "../lib/collectionService";
import { loadUsedWords } from "../lib/scoreService";
import { loadDictionary } from "../game/dictionary";
import { rarityColor } from "../game/cards/gacha";
import "../styles/Collection.css";

const MAX_LEVEL = 5;

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
  const [loading, setLoading] = useState(true);

  // カード図鑑用
  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadCollectionFromDB(userId),
      loadUsedWords(userId),
    ]).then(([coll, words]) => {
      setCollection(coll);
      setUsedWords(words);
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
        <CardCollection collection={collection} />
      ) : (
        <WordCollection userId={userId} usedWords={usedWords} />
      )}

      <button className="collection__back-btn" onClick={onBack}>
        もどる
      </button>
    </div>
  );
}

/* ===================== カード図鑑 ===================== */

function CardCollection({ collection }: { collection: SpecialCard[] }) {
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
            <OwnedCard key={def.id} card={owned} />
          ) : (
            <UnknownCard key={def.id} def={def} />
          );
        })}
      </div>
    </>
  );
}

function OwnedCard({ card }: { card: SpecialCard }) {
  const isMaxLevel = card.level >= MAX_LEVEL;
  return (
    <div
      className="collection__card collection__card--owned"
      style={{ borderColor: rarityColor(card.rarity) }}
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
