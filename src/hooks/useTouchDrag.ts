/**
 * タッチ操作によるドラッグ&ドロップ
 *
 * - useTouchDropTarget: Board で呼び出し、ドロップ先を登録
 * - useTouchDragSource: NormalRack / FreeCardPanel で呼び出し、ドラッグ元を登録
 */

import { useEffect, useRef, useCallback } from "react";

/* ================================================================
   ドロップハンドラ（モジュールレベルで共有）
   ================================================================ */

let dropHandler: ((x: number, y: number, data: string) => void) | null = null;

/**
 * Board コンポーネントでドロップコールバックを登録する。
 */
export function useTouchDropTarget(
  onDrop: ((x: number, y: number, data: string) => void) | undefined
) {
  useEffect(() => {
    if (onDrop) dropHandler = onDrop;
    return () => {
      if (dropHandler === onDrop) dropHandler = null;
    };
  }, [onDrop]);
}

/* ================================================================
   ドラッグソースフック
   ================================================================ */

const DRAG_THRESHOLD = 8; // px — これ以上動いたらドラッグ開始

export function useTouchDragSource() {
  const ghostRef = useRef<HTMLElement | null>(null);
  const dataRef = useRef("");
  const sourceRef = useRef<HTMLElement | null>(null);
  const highlightRef = useRef<HTMLElement | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const pendingRef = useRef(false);
  const activeRef = useRef(false);

  const cleanup = useCallback(() => {
    if (highlightRef.current) {
      highlightRef.current.classList.remove("cell--dragover");
      highlightRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.style.opacity = "";
      sourceRef.current = null;
    }
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
    activeRef.current = false;
    pendingRef.current = false;
    dataRef.current = "";
  }, []);

  useEffect(() => {
    function onMove(e: TouchEvent) {
      if (!pendingRef.current && !activeRef.current) return;

      const touch = e.touches[0];

      /* ── 閾値チェック: まだ閾値未満なら何もしない ── */
      if (pendingRef.current && !activeRef.current) {
        const dx = touch.clientX - startPosRef.current.x;
        const dy = touch.clientY - startPosRef.current.y;
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return;

        // ドラッグ開始
        activeRef.current = true;
        pendingRef.current = false;

        const src = sourceRef.current!;

        // ゴースト要素を作成
        const ghost = document.createElement("div");
        ghost.className = "touch-drag-ghost";
        const letterSpan = src.querySelector(".free-cards__letter");
        ghost.textContent = letterSpan
          ? letterSpan.textContent ?? ""
          : src.textContent?.trim().charAt(0) ?? "";
        ghost.style.left = `${touch.clientX - 24}px`;
        ghost.style.top = `${touch.clientY - 24}px`;
        document.body.appendChild(ghost);
        ghostRef.current = ghost;

        src.style.opacity = "0.4";
      }

      if (!activeRef.current) return;
      e.preventDefault(); // スクロール抑止

      /* ── ゴーストを指に追従 ── */
      const ghost = ghostRef.current!;
      ghost.style.left = `${touch.clientX - 24}px`;
      ghost.style.top = `${touch.clientY - 24}px`;

      /* ── 指の下のセルをハイライト ── */
      // ghost は pointer-events:none なので elementFromPoint に影響しない
      const el = document.elementFromPoint(touch.clientX, touch.clientY);

      if (highlightRef.current) {
        highlightRef.current.classList.remove("cell--dragover");
        highlightRef.current = null;
      }

      if (el) {
        const cell = (el.closest("[data-cell-x]") as HTMLElement) ?? null;
        if (cell && cell.dataset.droppable === "true") {
          cell.classList.add("cell--dragover");
          highlightRef.current = cell;
        }
      }
    }

    function onEnd(e: TouchEvent) {
      if (pendingRef.current && !activeRef.current) {
        // 閾値未満 → タップとして扱う（onClick が発火する）
        pendingRef.current = false;
        dataRef.current = "";
        sourceRef.current = null;
        return;
      }
      if (!activeRef.current) return;

      const touch = e.changedTouches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);

      if (el && dropHandler && dataRef.current) {
        const cell = (el.closest("[data-cell-x]") as HTMLElement) ?? null;
        if (cell && cell.dataset.droppable === "true") {
          const cx = parseInt(cell.dataset.cellX!, 10);
          const cy = parseInt(cell.dataset.cellY!, 10);
          if (!isNaN(cx) && !isNaN(cy)) {
            dropHandler(cx, cy, dataRef.current);
          }
        }
      }

      cleanup();
    }

    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", cleanup);

    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", cleanup);
      cleanup();
    };
  }, [cleanup]);

  /** タッチ開始ハンドラ — draggable 要素の onTouchStart に設定 */
  const startTouchDrag = useCallback(
    (e: React.TouchEvent, data: string) => {
      if (pendingRef.current || activeRef.current) return;
      const touch = e.touches[0];
      dataRef.current = data;
      sourceRef.current = e.currentTarget as HTMLElement;
      startPosRef.current = { x: touch.clientX, y: touch.clientY };
      pendingRef.current = true;
      activeRef.current = false;
      // preventDefault しない → タップ時に onClick を発火させる
    },
    []
  );

  return startTouchDrag;
}
