/**
 * English Word Puzzle — 型定義
 */

/** カテゴリ（ステージ）識別子 */
export type Category = "animals" | "food" | "jobs" | "hobby" | "all";

/** 盤面セルの倍率種別 */
export type MultiplierType =
  | "NONE"
  | "DL"   // Double Letter (文字2倍)
  | "TL"   // Triple Letter (文字3倍)
  | "DW"   // Double Word (単語2倍)
  | "TW";  // Triple Word (単語3倍)

/** 盤面レイアウト JSON の型 */
export interface BoardLayout {
  size: number;
  multipliers: MultiplierType[][];
}

/** タイルのソース種別 */
export type TileSource = "normal" | "free";

/** 盤面の1マス */
export interface Cell {
  char: string | null;
  pending: string | null;
  multiplier: MultiplierType;
  /** 確定済みタイルのソース */
  tileSource: TileSource | null;
}

/** 仮置き情報 */
export interface Placement {
  x: number;
  y: number;
  char: string;
  /** ラックインデックス（フリーカードは -1） */
  rackIndex: number;
  /** タイルソース */
  source: TileSource;
}

/** validateMove の結果 */
export interface ValidationResult {
  ok: boolean;
  reason?: string;
  formedWords?: string[];
}

/** スコア内訳 */
export interface ScoreBreakdown {
  total: number;
  breakdown: { word: string; points: number }[];
}

/** スペシャルカードのレアリティ */
export type Rarity = "N" | "R" | "SR" | "SSR";

/** スペシャルカード効果タイプ */
export type SpecialEffectType =
  | "bonus_flat"       // 固定加点
  | "word_multiplier"  // 単語スコア倍率
  | "draw_normal"      // ノーマルカード追加ドロー
  | "recover_free"     // フリーカード回復
  | "upgrade_bonus"    // ボーナスマスアップグレード
  | "next_turn_mult"      // 次ターンスコア倍率
  | "reduce_opponent"     // 相手スコア減少（バトル専用）
  | "force_letter_count"; // 相手の次ターン使用タイル数制限（バトル専用）

/** スペシャルカード定義 */
export interface SpecialCardDef {
  id: string;
  /** カードの英単語 */
  word: string;
  /** 日本語意味 */
  meaning: string;
  /** 効果の説明 */
  description: string;
  rarity: Rarity;
  categories: Category[];
  effectType: SpecialEffectType;
  effectValue: number;
  /** 単語を表す絵文字アイコン */
  icon: string;
  /** バトル専用カード（ソロモードではデッキに入らない） */
  battleOnly?: boolean;
}

/** スペシャルカードインスタンス */
export interface SpecialCard extends SpecialCardDef {
  instanceId: string;
  /** カードレベル（同カード合成回数+1、デフォルト1） */
  level: number;
}

/** スコア記録エントリ */
export interface ScoreEntry {
  score: number;
  category: Category;
  turn: number;
  date: string;
  words: string[];
}

/** 辞書エントリ */
export interface DictEntry {
  word: string;
  meaning: string;
}

/** スペル確認の検索履歴 */
export interface SpellHistoryEntry {
  query: string;
  results: DictEntry[];
}

/** ゲームモード */
export type GameMode = "solo" | "battle";

/** ターン所有者 */
export type TurnOwner = "player" | "cpu";

/** CPU の着手候補 */
export interface CpuCandidate {
  placements: Placement[];
  score: number;
  words: { word: string; points: number }[];
}

/** 対戦モード用の状態 */
export interface BattleState {
  mode: "battle";
  turnOwner: TurnOwner;
  /** CPU のラック（非公開） */
  cpuRack: string[];
  /** CPU の累計スコア */
  cpuScore: number;
  /** CPU の単語履歴 */
  cpuWordHistory: string[];
  /** 進行カウンタ（偶数=プレイヤー、奇数=CPU） */
  battleTurn: number;
  /** 直前の CPU 着手結果（表示用） */
  lastCpuMove: {
    words: { word: string; points: number }[];
    totalScore: number;
    passed: boolean;
  } | null;
  /** CPU が直前に置いたセル座標（ハイライト用） */
  cpuHighlightCells: { x: number; y: number }[];
  /** CPUの次ターンで使用すべきラックタイル数（null=制限なし） */
  cpuLetterLimit: number | null;
}

/** ゲーム全体の状態 */
export interface GameState {
  board: Cell[][];
  rack: string[];
  bag: string[];
  /** 今ターンの仮置き */
  placedThisTurn: Placement[];
  score: number;
  turn: number;
  maxTurns: number;
  category: Category;
  layout: BoardLayout;
  finished: boolean;
  /** 直近確定の単語と得点 */
  lastWords: { word: string; points: number }[];
  /** フリーカード使用回数 A-Z */
  freePool: Record<string, number>;
  /** スペシャルデッキ（ゲーム開始時コピー） */
  specialDeck: SpecialCard[];
  /** スペシャル手持ち（最大4枚） */
  specialHand: SpecialCard[];
  /** セット中のスペシャルカード（1枚） */
  specialSet: SpecialCard | null;
  /** 使用済みスペシャルID一覧 */
  usedSpecialIds: string[];
  /** 前ターンに発動したスペシャルのカテゴリ（連続発動防止） */
  lastSpecialCategory: Category | null;
  /** スペル確認残り回数 */
  spellCheckRemaining: number;
  /** 次ターンスコア倍率（スペシャル効果） */
  nextTurnMultiplier: number;
  /** このゲームで使った全単語 */
  wordHistory: string[];
}
