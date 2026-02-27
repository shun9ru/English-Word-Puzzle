/**
 * ノーマルカード手札（7枚）
 */

import { useTouchDragSource } from "../hooks/useTouchDrag";
import "../styles/Rack.css";

interface NormalRackProps {
  tiles: string[];
  selectedIndex: number | null;
  usedIndices: Set<number>;
  onSelect: (index: number) => void;
  disabled?: boolean;
}

export function NormalRack({ tiles, selectedIndex, usedIndices, onSelect, disabled }: NormalRackProps) {
  const startTouchDrag = useTouchDragSource();

  return (
    <div className="rack">
      <div className="rack__label">ノーマル (3pt)</div>
      <div className="rack__tiles">
        {tiles.map((ch, i) => {
          const used = usedIndices.has(i);
          return (
            <button
              key={i}
              className={
                "rack__tile rack__tile--normal" +
                (selectedIndex === i ? " rack__tile--selected" : "") +
                (used ? " rack__tile--used" : "")
              }
              onClick={() => !disabled && !used && onSelect(i)}
              disabled={disabled || used}
              draggable={!disabled && !used}
              onDragStart={(e) => {
                if (disabled || used) { e.preventDefault(); return; }
                e.dataTransfer.setData("text/plain", `normal:${i}`);
                e.dataTransfer.effectAllowed = "move";
                e.currentTarget.classList.add("rack__tile--dragging");
              }}
              onDragEnd={(e) => {
                e.currentTarget.classList.remove("rack__tile--dragging");
              }}
              onTouchStart={(e) => {
                if (!disabled && !used) startTouchDrag(e, `normal:${i}`);
              }}
            >
              {used ? "" : ch}
            </button>
          );
        })}
      </div>
    </div>
  );
}
