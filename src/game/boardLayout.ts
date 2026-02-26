/**
 * 盤面レイアウト読み込み
 */

import type { BoardLayout } from "./types";

export async function loadBoardLayout(size: number): Promise<BoardLayout> {
  const url = `${import.meta.env.BASE_URL}layouts/board${size}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`盤面レイアウトの読み込みに失敗: board${size} (${res.status})`);
  }
  return res.json();
}
