/**
 * 操作ボタン群
 */

import "../styles/Controls.css";

interface ControlsProps {
  onConfirm: () => void;
  onUndo: () => void;
  onPass: () => void;
  onQuit: () => void;
  onSpellCheck: () => void;
  canConfirm: boolean;
  canUndo: boolean;
  spellCheckRemaining: number;
  spellHistoryCount: number;
  allDisabled?: boolean;
}

export function Controls({
  onConfirm,
  onUndo,
  onPass,
  onQuit,
  onSpellCheck,
  canConfirm,
  canUndo,
  spellCheckRemaining,
  spellHistoryCount,
  allDisabled = false,
}: ControlsProps) {
  const d = allDisabled;
  return (
    <div className="controls">
      <button
        className="controls__btn controls__btn--confirm"
        onClick={onConfirm}
        disabled={d || !canConfirm}
      >
        確定
      </button>
      <button
        className="controls__btn controls__btn--undo"
        onClick={onUndo}
        disabled={d || !canUndo}
      >
        もどす
      </button>
      <button
        className="controls__btn controls__btn--pass"
        onClick={onPass}
        disabled={d}
      >
        パス
      </button>
      <button
        className="controls__btn controls__btn--spell"
        onClick={onSpellCheck}
        disabled={d || (spellCheckRemaining <= 0 && spellHistoryCount === 0)}
      >
        スペル確認({spellCheckRemaining}){spellHistoryCount > 0 ? ` 履歴${spellHistoryCount}件` : ""}
      </button>
      <button
        className="controls__btn controls__btn--quit"
        onClick={onQuit}
        disabled={d}
      >
        中断
      </button>
    </div>
  );
}
