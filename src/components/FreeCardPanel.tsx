/**
 * フリーカードパネル（A-Z、各2枚まで）
 */

import "../styles/FreeCards.css";

const MAX_FREE_USES = 2;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface FreeCardPanelProps {
  freePool: Record<string, number>;
  selectedLetter: string | null;
  onSelect: (letter: string) => void;
  disabled?: boolean;
}

export function FreeCardPanel({ freePool, selectedLetter, onSelect, disabled }: FreeCardPanelProps) {
  return (
    <div className="free-cards">
      <div className="free-cards__label">フリー (1pt)</div>
      <div className="free-cards__grid">
        {LETTERS.map((letter) => {
          const used = freePool[letter] ?? 0;
          const exhausted = used >= MAX_FREE_USES;
          const isSelected = selectedLetter === letter;

          return (
            <button
              key={letter}
              className={
                "free-cards__btn" +
                (isSelected ? " free-cards__btn--selected" : "") +
                (exhausted ? " free-cards__btn--exhausted" : "")
              }
              onClick={() => !disabled && !exhausted && onSelect(letter)}
              disabled={disabled || exhausted}
              draggable={!disabled && !exhausted}
              onDragStart={(e) => {
                if (disabled || exhausted) { e.preventDefault(); return; }
                e.dataTransfer.setData("text/plain", `free:${letter}`);
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <span className="free-cards__letter">{letter}</span>
              <span className="free-cards__count">{MAX_FREE_USES - used}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
