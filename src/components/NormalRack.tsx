/**
 * ノーマルカード手札（7枚）
 */

import "../styles/Rack.css";

interface NormalRackProps {
  tiles: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
}

export function NormalRack({ tiles, selectedIndex, onSelect, disabled }: NormalRackProps) {
  return (
    <div className="rack">
      <div className="rack__label">ノーマル (3pt)</div>
      <div className="rack__tiles">
        {tiles.map((ch, i) => (
          <button
            key={i}
            className={
              "rack__tile rack__tile--normal" +
              (selectedIndex === i ? " rack__tile--selected" : "")
            }
            onClick={() => !disabled && onSelect(i)}
            disabled={disabled}
            draggable={!disabled}
            onDragStart={(e) => {
              if (disabled) { e.preventDefault(); return; }
              e.dataTransfer.setData("text/plain", `normal:${i}`);
              e.dataTransfer.effectAllowed = "move";
              e.currentTarget.classList.add("rack__tile--dragging");
            }}
            onDragEnd={(e) => {
              e.currentTarget.classList.remove("rack__tile--dragging");
            }}
          >
            {ch}
          </button>
        ))}
      </div>
    </div>
  );
}
