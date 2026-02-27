/**
 * デッキ構築画面（Supabase DB連携）
 */

import { useState, useEffect, useCallback } from "react";
import type { SpecialCard, Category } from "../game/types";
import { canAddToDeck, DECK_MAX, MAX_LEVEL, scaledEffectValue } from "../game/cards/deck";
import { loadCollectionFromDB, loadDeckFromDB, saveDeckToDB, loadDeckSlotSummary, loadCollectionCopiesMap } from "../lib/collectionService";
import type { CardCopiesInfo } from "../lib/collectionService";
import { rarityColor } from "../game/cards/gacha";
import { emojiToImageUrl } from "../data/specialCardDefs";
import { getDeckName, setDeckName } from "../lib/deckNames";
import "../styles/DeckEditor.css";

const DECK_CATEGORIES: { key: Category; label: string }[] = [
  { key: "animals", label: "Animals" },
  { key: "food", label: "Food" },
  { key: "jobs", label: "Jobs" },
  { key: "hobby", label: "Hobby" },
  { key: "all", label: "All Genre" },
];

interface DeckEditorProps {
  userId: string;
  onBack: () => void;
}

function LevelBadge({ level }: { level: number }) {
  if (level <= 1) return null;
  const isMax = level >= MAX_LEVEL;
  return (
    <span className={`deck-editor__level${isMax ? " deck-editor__level--max" : ""}`}>
      Lv.{level}
    </span>
  );
}

function EffectText({ card }: { card: SpecialCard }) {
  const base = card.effectValue;
  const scaled = scaledEffectValue(base, card.level, card.effectType);
  if (card.level <= 1) {
    return <span className="deck-editor__card-desc">{card.description}</span>;
  }
  let enhanced = card.description;
  const rounded = Math.round(scaled * 10) / 10;
  if (card.effectType === "bonus_flat" || card.effectType === "draw_normal" || card.effectType === "recover_free"
      || card.effectType === "bonus_per_letter" || card.effectType === "draw_special"
      || card.effectType === "reduce_opponent" || card.effectType === "steal_points"
      || card.effectType === "heal_hp" || card.effectType === "poison"
      || card.effectType === "shield" || card.effectType === "mirror") {
    enhanced = card.description.replace(/\d+/, String(Math.round(scaled)));
  } else if (card.effectType === "word_multiplier" || card.effectType === "next_turn_mult") {
    enhanced = card.description.replace(/[\d.]+/, String(rounded));
  }
  return <span className="deck-editor__card-desc deck-editor__card-desc--enhanced">{enhanced}</span>;
}

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

interface CardDetailModalProps {
  card: SpecialCard;
  source: "deck" | "collection";
  copiesInfo: CardCopiesInfo | undefined;
  canAdd: boolean;
  addError: string | undefined;
  onAdd: () => void;
  onRemove: () => void;
  onClose: () => void;
}

function CardDetailModal({ card, source, copiesInfo, canAdd, addError, onAdd, onRemove, onClose }: CardDetailModalProps) {
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
          <EffectText card={card} />
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

        {addError && <p className="deck-editor-modal__error">{addError}</p>}
        <div className="deck-editor-modal__actions">
          {source === "collection" ? (
            <button
              className="deck-editor-modal__btn deck-editor-modal__btn--add"
              onClick={onAdd}
              disabled={!canAdd}
            >
              デッキに追加
            </button>
          ) : (
            <button
              className="deck-editor-modal__btn deck-editor-modal__btn--remove"
              onClick={onRemove}
            >
              デッキから外す
            </button>
          )}
          <button className="deck-editor-modal__btn deck-editor-modal__btn--close" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeckEditor({ userId, onBack }: DeckEditorProps) {
  const [collection, setCollection] = useState<SpecialCard[]>([]);
  const [deck, setDeck] = useState<SpecialCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("animals");
  const [activeSlot, setActiveSlot] = useState(0);
  const [slotSummary, setSlotSummary] = useState<{ slot: number; count: number }[]>([]);
  const [selectedCard, setSelectedCard] = useState<SpecialCard | null>(null);
  const [selectedCardSource, setSelectedCardSource] = useState<"deck" | "collection">("collection");
  const [copiesMap, setCopiesMap] = useState<Map<string, CardCopiesInfo>>(new Map());
  const [deckNames, setDeckNames] = useState<Record<number, string>>({});
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  // デッキ名をロード
  useEffect(() => {
    const names: Record<number, string> = {};
    for (let s = 0; s < 5; s++) {
      names[s] = getDeckName(activeCategory, s);
    }
    setDeckNames(names);
  }, [activeCategory]);

  // DB読み込み（カテゴリ別・スロット別）
  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadCollectionFromDB(userId),
      loadDeckFromDB(userId, activeCategory, activeSlot),
      loadDeckSlotSummary(userId, activeCategory),
      loadCollectionCopiesMap(userId),
    ]).then(([coll, dk, summary, copies]) => {
      setCollection(coll);
      setDeck(dk);
      setSlotSummary(summary);
      setCopiesMap(copies);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [userId, activeCategory, activeSlot]);

  const handleCategoryChange = useCallback((cat: Category) => {
    setActiveCategory(cat);
    setActiveSlot(0);
    setMessage("");
  }, []);

  const handleAddToDeck = useCallback(async (card: SpecialCard) => {
    const check = canAddToDeck(deck, card);
    if (!check.ok) {
      setMessage(check.reason ?? "追加できません。");
      return;
    }
    const newDeck = [...deck, card];
    setDeck(newDeck);
    setMessage("");
    await saveDeckToDB(userId, newDeck, activeCategory, activeSlot);
    setSlotSummary((prev) => {
      const rest = prev.filter((s) => s.slot !== activeSlot);
      return [...rest, { slot: activeSlot, count: newDeck.length }];
    });
  }, [userId, deck, activeCategory, activeSlot]);

  const handleRemoveFromDeck = useCallback(async (instanceId: string) => {
    const newDeck = deck.filter((c) => c.instanceId !== instanceId);
    setDeck(newDeck);
    setMessage("");
    await saveDeckToDB(userId, newDeck, activeCategory, activeSlot);
    setSlotSummary((prev) => {
      const rest = prev.filter((s) => s.slot !== activeSlot);
      if (newDeck.length > 0) return [...rest, { slot: activeSlot, count: newDeck.length }];
      return rest;
    });
  }, [userId, deck, activeCategory, activeSlot]);

  if (loading) {
    return <div className="deck-editor"><p>読み込み中...</p></div>;
  }

  // デッキに入っているカードIDのセット
  const deckCardIds = new Set(deck.map((c) => c.id));

  // コレクションからデッキに入っていない & このカテゴリで使えるカードを抽出
  const available = collection.filter((c) => {
    if (deckCardIds.has(c.id)) return false;
    // "All Genre" タブでは全カードを表示
    if (activeCategory === "all") return true;
    return c.categories.includes(activeCategory);
  });

  // レアリティ順にソート
  const rarityOrder = { SSR: 0, SR: 1, R: 2, N: 3 };
  const sortedAvailable = [...available].sort(
    (a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]
  );
  const sortedDeck = [...deck].sort(
    (a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]
  );

  return (
    <div className="deck-editor">
      <h1 className="deck-editor__title">デッキ構築</h1>

      <div className="deck-editor__tabs">
        {DECK_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`deck-editor__tab ${activeCategory === cat.key ? "deck-editor__tab--active" : ""}`}
            onClick={() => handleCategoryChange(cat.key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="deck-editor__slot-tabs">
        {[0, 1, 2, 3, 4].map((s) => {
          const count = slotSummary.find((ss) => ss.slot === s)?.count ?? 0;
          return (
            <button
              key={s}
              className={`deck-editor__slot-tab${activeSlot === s ? " deck-editor__slot-tab--active" : ""}`}
              onClick={() => { setActiveSlot(s); setMessage(""); }}
            >
              <span className="deck-editor__slot-num">{deckNames[s] ?? `Deck ${s + 1}`}</span>
              <span className="deck-editor__slot-count">{count}枚</span>
            </button>
          );
        })}
      </div>

      <div className="deck-editor__section">
        <h2 className="deck-editor__deck-header">
          {editingSlot === activeSlot ? (
            <span className="deck-editor__name-edit">
              <input
                className="deck-editor__name-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setDeckName(activeCategory, activeSlot, editName);
                    setDeckNames((prev) => ({ ...prev, [activeSlot]: editName.trim() || `Deck ${activeSlot + 1}` }));
                    setEditingSlot(null);
                  }
                }}
                maxLength={20}
                autoFocus
              />
              <button
                className="deck-editor__name-save"
                onClick={() => {
                  setDeckName(activeCategory, activeSlot, editName);
                  setDeckNames((prev) => ({ ...prev, [activeSlot]: editName.trim() || `Deck ${activeSlot + 1}` }));
                  setEditingSlot(null);
                }}
              >OK</button>
            </span>
          ) : (
            <span
              className="deck-editor__deck-name"
              onClick={() => { setEditingSlot(activeSlot); setEditName(deckNames[activeSlot] ?? `Deck ${activeSlot + 1}`); }}
              title="クリックで名前を編集"
            >
              {deckNames[activeSlot] ?? `Deck ${activeSlot + 1}`}
              <span className="deck-editor__edit-icon">&#x270E;</span>
            </span>
          )}
          <span className="deck-editor__deck-count">({deck.length}/{DECK_MAX})</span>
        </h2>
        {sortedDeck.length === 0 ? (
          <p className="deck-editor__empty">デッキにカードがありません</p>
        ) : (
          <div className="deck-editor__card-grid">
            {sortedDeck.map((card) => (
              <button
                key={card.instanceId}
                className="deck-editor__card deck-editor__card--in-deck"
                style={{ borderColor: rarityColor(card.rarity) }}
                onClick={() => { setSelectedCard(card); setSelectedCardSource("deck"); }}
                title="クリックで詳細"
              >
                <LevelBadge level={card.level} />
                <img className="deck-editor__card-icon" src={emojiToImageUrl(card.icon)} alt={card.word} />
                <span className="deck-editor__card-word">{card.word}</span>
                <span className="deck-editor__card-meaning">{card.meaning}</span>
                <span className="deck-editor__card-rarity" style={{ color: rarityColor(card.rarity) }}>
                  {card.rarity}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {message && <p className="deck-editor__message">{message}</p>}

      <div className="deck-editor__section">
        <h2>コレクション ({available.length}枚)</h2>
        <p className="deck-editor__hint">同じカードを引くと自動でレベルアップ（最大Lv.{MAX_LEVEL}）</p>
        {sortedAvailable.length === 0 ? (
          <p className="deck-editor__empty">カードがありません（ガチャで入手しよう）</p>
        ) : (
          <div className="deck-editor__card-grid">
            {sortedAvailable.map((card) => (
              <button
                key={card.instanceId}
                className="deck-editor__card"
                style={{ borderColor: rarityColor(card.rarity) }}
                onClick={() => { setSelectedCard(card); setSelectedCardSource("collection"); }}
                title="クリックで詳細"
              >
                <LevelBadge level={card.level} />
                <img className="deck-editor__card-icon" src={emojiToImageUrl(card.icon)} alt={card.word} />
                <span className="deck-editor__card-word">{card.word}</span>
                <span className="deck-editor__card-meaning">{card.meaning}</span>
                <EffectText card={card} />
                <span className="deck-editor__card-rarity" style={{ color: rarityColor(card.rarity) }}>
                  {card.rarity}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="deck-editor__back-btn" onClick={onBack}>
        もどる
      </button>

      {selectedCard && (() => {
        const addCheck = canAddToDeck(deck, selectedCard);
        return (
          <CardDetailModal
            card={selectedCard}
            source={selectedCardSource}
            copiesInfo={copiesMap.get(selectedCard.id)}
            canAdd={addCheck.ok}
            addError={addCheck.ok ? undefined : addCheck.reason}
            onAdd={() => {
              handleAddToDeck(selectedCard);
              setSelectedCard(null);
            }}
            onRemove={() => {
              handleRemoveFromDeck(selectedCard.instanceId);
              setSelectedCard(null);
            }}
            onClose={() => setSelectedCard(null)}
          />
        );
      })()}
    </div>
  );
}
