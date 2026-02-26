/**
 * デッキ構築画面（Supabase DB連携）
 */

import { useState, useEffect, useCallback } from "react";
import type { SpecialCard } from "../game/types";
import { canAddToDeck, DECK_MAX, MAX_LEVEL, scaledEffectValue } from "../game/cards/deck";
import { loadCollectionFromDB, loadDeckFromDB, saveDeckToDB } from "../lib/collectionService";
import { rarityColor } from "../game/cards/gacha";
import { emojiToImageUrl } from "../data/specialCardDefs";
import "../styles/DeckEditor.css";

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
  const scaled = scaledEffectValue(base, card.level);
  if (card.level <= 1) {
    return <span className="deck-editor__card-desc">{card.description}</span>;
  }
  let enhanced = card.description;
  const rounded = Math.round(scaled * 10) / 10;
  if (card.effectType === "bonus_flat" || card.effectType === "draw_normal" || card.effectType === "recover_free") {
    enhanced = card.description.replace(/\d+/, String(Math.round(scaled)));
  } else if (card.effectType === "word_multiplier" || card.effectType === "next_turn_mult") {
    enhanced = card.description.replace(/[\d.]+/, String(rounded));
  }
  return <span className="deck-editor__card-desc deck-editor__card-desc--enhanced">{enhanced}</span>;
}

export function DeckEditor({ userId, onBack }: DeckEditorProps) {
  const [collection, setCollection] = useState<SpecialCard[]>([]);
  const [deck, setDeck] = useState<SpecialCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  // DB読み込み
  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadCollectionFromDB(userId),
      loadDeckFromDB(userId),
    ]).then(([coll, dk]) => {
      setCollection(coll);
      setDeck(dk);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [userId]);

  const handleAddToDeck = useCallback(async (card: SpecialCard) => {
    const check = canAddToDeck(deck, card);
    if (!check.ok) {
      setMessage(check.reason ?? "追加できません。");
      return;
    }
    const newDeck = [...deck, card];
    setDeck(newDeck);
    setMessage("");
    await saveDeckToDB(userId, newDeck);
  }, [userId, deck]);

  const handleRemoveFromDeck = useCallback(async (instanceId: string) => {
    const newDeck = deck.filter((c) => c.instanceId !== instanceId);
    setDeck(newDeck);
    setMessage("");
    await saveDeckToDB(userId, newDeck);
  }, [userId, deck]);

  if (loading) {
    return <div className="deck-editor"><p>読み込み中...</p></div>;
  }

  // デッキに入っているカードIDのセット
  const deckCardIds = new Set(deck.map((c) => c.id));

  // コレクションからデッキに入っていないカードを抽出
  const available = collection.filter((c) => !deckCardIds.has(c.id));

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

      <div className="deck-editor__section">
        <h2>デッキ ({deck.length}/{DECK_MAX})</h2>
        {sortedDeck.length === 0 ? (
          <p className="deck-editor__empty">デッキにカードがありません</p>
        ) : (
          <div className="deck-editor__card-grid">
            {sortedDeck.map((card) => (
              <button
                key={card.instanceId}
                className="deck-editor__card deck-editor__card--in-deck"
                style={{ borderColor: rarityColor(card.rarity) }}
                onClick={() => handleRemoveFromDeck(card.instanceId)}
                title="クリックで外す"
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
                onClick={() => handleAddToDeck(card)}
                title={`${card.word} (${card.meaning}) Lv.${card.level}\n${card.description}\nクリックでデッキに追加`}
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
    </div>
  );
}
