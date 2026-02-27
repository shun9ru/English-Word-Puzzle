/**
 * スペシャルカード手持ち + セット枠（英単語カード版）
 * セット時はカードの目標単語を表示する。ノーマル/フリーカードで単語を綴ると発動。
 */

import type { SpecialCard, Category } from "../game/types";
import { rarityColor } from "../game/cards/gacha";
import { emojiToImageUrl } from "../data/specialCardDefs";
import "../styles/SpecialCards.css";

function CardIcon({ icon, word }: { icon: string; word: string }) {
  const url = emojiToImageUrl(icon);
  return (
    <img
      className="special-cards__icon"
      src={url}
      alt={word}
      onError={(e) => {
        // CDN読み込み失敗時は絵文字文字で代替
        const el = e.currentTarget;
        el.style.display = "none";
        const span = document.createElement("span");
        span.className = "special-cards__icon-fallback";
        span.textContent = icon;
        el.parentElement?.insertBefore(span, el);
      }}
    />
  );
}

interface SpecialCardSlotsProps {
  hand: SpecialCard[];
  setCard: SpecialCard | null;
  onSetCard: (card: SpecialCard) => void;
  onUnsetCard: () => void;
  lastSpecialCategory: Category | null;
  disabled?: boolean;
  deckRemaining?: number;
}

export function SpecialCardSlots({
  hand,
  setCard,
  onSetCard,
  onUnsetCard,
  lastSpecialCategory,
  disabled,
  deckRemaining,
}: SpecialCardSlotsProps) {
  return (
    <div className="special-cards">
      <div className="special-cards__set-area">
        <div className="special-cards__set-label">セット枠</div>
        {setCard ? (
          <div className="special-cards__set-detail">
            <div className="special-cards__set-header">
              <CardIcon icon={setCard.icon} word={setCard.word} />
              <span
                className="special-cards__set-word"
                style={{ color: rarityColor(setCard.rarity) }}
              >
                {setCard.word}
              </span>
              <span className="special-cards__set-meaning">{setCard.meaning}</span>
              {setCard.level > 1 && (
                <span className="special-cards__set-level">Lv.{setCard.level}</span>
              )}
              <span
                className="special-cards__set-rarity"
                style={{ color: rarityColor(setCard.rarity) }}
              >
                {setCard.rarity}
              </span>
              <button
                className="special-cards__unset-btn"
                onClick={onUnsetCard}
                disabled={disabled}
              >
                外す
              </button>
            </div>
            <div className="special-cards__set-desc">{setCard.description}</div>
            <div className="special-cards__target-hint">
              盤面で「{setCard.word}」を綴ると発動！
            </div>
          </div>
        ) : (
          <div className="special-cards__empty-slot">空</div>
        )}
      </div>

      <div className="special-cards__hand">
        <div className="special-cards__hand-label">手持ち ({hand.length}/4){deckRemaining != null && <span className="special-cards__remaining"> 山札: {deckRemaining}</span>}</div>
        <div className="special-cards__hand-list">
          {hand.map((card) => {
            const isBlocked = lastSpecialCategory !== null
              && card.categories.includes(lastSpecialCategory)
              && !card.categories.includes("all");
            return (
              <button
                key={card.instanceId}
                className={
                  "special-cards__card" +
                  (isBlocked ? " special-cards__card--blocked" : "")
                }
                style={{ borderColor: rarityColor(card.rarity) }}
                onClick={() => !disabled && !isBlocked && onSetCard(card)}
                disabled={disabled || isBlocked || setCard !== null}
                title={`${card.word} (${card.meaning}): ${card.description}${isBlocked ? "\n（前ターンと同カテゴリは連続使用不可）" : ""}`}
              >
                {card.level > 1 && (
                  <span className="special-cards__card-level">Lv.{card.level}</span>
                )}
                <CardIcon icon={card.icon} word={card.word} />
                <span className="special-cards__card-word">{card.word}</span>
                <span className="special-cards__card-meaning">{card.meaning}</span>
                <span className="special-cards__rarity" style={{ color: rarityColor(card.rarity) }}>
                  {card.rarity}
                </span>
              </button>
            );
          })}
          {hand.length === 0 && (
            <div className="special-cards__empty">スペシャルカードなし</div>
          )}
        </div>
      </div>
    </div>
  );
}
