/**
 * English Word Puzzle — メインアプリケーション（Supabase連携版）
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { GameState, Category, Placement, DictEntry, SpecialCard } from "../game/types";
import { loadDictionary } from "../game/dictionary";
import { loadBoardLayout } from "../game/boardLayout";
import { createEmptyBoard, cloneBoard, createFreePool } from "../game/core/helpers";
import { generateBag, drawTiles } from "../game/core/generateBag";
import { validateMove } from "../game/core/validateMove";
import { applyMove, applyPass, undoPlacement, computeScore } from "../game/core/applyMove";
import { prepareGameDeck, scaledEffectValue } from "../game/cards/deck";
import { getCurrentUserId, setCurrentUserId, logout } from "../lib/auth";
import { loginOrCreate } from "../lib/userService";
import { addGachaPointsDB } from "../lib/userService";
import { saveScoreToDB } from "../lib/scoreService";
import { loadDeckFromDB } from "../lib/collectionService";
import { Board } from "../components/Board";
import { NormalRack } from "../components/NormalRack";
import { FreeCardPanel } from "../components/FreeCardPanel";
import { Controls } from "../components/Controls";
import { GameHeader } from "../components/GameHeader";
import { SpecialCardSlots } from "../components/SpecialCardSlots";
import { SpellCheckModal } from "../components/SpellCheckModal";
import { GachaScreen } from "../components/GachaScreen";
import { DeckEditor } from "../components/DeckEditor";
import { Tutorial } from "../components/Tutorial";
import { LoginScreen } from "../components/LoginScreen";
import { RankingPanel } from "../components/RankingPanel";
import { AdminScreen } from "../components/AdminScreen";
import "../styles/App.css";

const CATEGORY_LABELS: Record<Category, string> = {
  animals: "Animals",
  food: "Food",
  jobs: "Jobs",
  hobby: "Hobby",
  all: "All Genre",
};

const MAX_TURNS = 10;
const RACK_SIZE = 7;
const BOARD_SIZE = 15;
const TURN_TIME = 120;
const MAX_FREE_USES = 2;

type Screen = "login" | "title" | "categorySelect" | "game" | "result" | "tutorial" | "gacha" | "deckEdit" | "admin";

export default function App() {
  // 認証
  const [userId, setUserId] = useState<string | null>(getCurrentUserId());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [screen, setScreen] = useState<Screen>(userId ? "title" : "login");
  const [selectedCategory, setSelectedCategory] = useState<Category>("animals");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [dict, setDict] = useState<Set<string> | null>(null);
  const [dictEntries, setDictEntries] = useState<DictEntry[]>([]);
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null);
  const [selectedFreeLetter, setSelectedFreeLetter] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSpellCheck, setShowSpellCheck] = useState(false);

  // タイマー
  const [timeRemaining, setTimeRemaining] = useState(TURN_TIME);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ログイン処理
  const handleLogin = useCallback(async (id: string) => {
    setLoginLoading(true);
    setLoginError("");
    try {
      const user = await loginOrCreate(id);
      setCurrentUserId(id);
      setUserId(id);
      setIsAdmin(user.is_admin);
      setScreen("title");
    } catch {
      setLoginError("ログインに失敗しました。接続を確認してください。");
    } finally {
      setLoginLoading(false);
    }
  }, []);

  // ログアウト処理
  const handleLogout = useCallback(() => {
    logout();
    setUserId(null);
    setIsAdmin(false);
    setScreen("login");
    setGameState(null);
    setDict(null);
    setDictEntries([]);
    setMessage("");
  }, []);

  // タイマー開始
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeRemaining(TURN_TIME);
    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // タイマー停止
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // タイマー切れ → 自動パス
  useEffect(() => {
    if (timeRemaining <= 0 && gameState && !gameState.finished && screen === "game") {
      handlePassInternal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining]);

  // 画面変更時にタイマー停止
  useEffect(() => {
    if (screen !== "game") {
      stopTimer();
    }
  }, [screen, stopTimer]);

  // タイトルに戻る
  const returnToTitle = useCallback(() => {
    stopTimer();
    setScreen("title");
    setGameState(null);
    setDict(null);
    setDictEntries([]);
    setMessage("");
    setSelectedRackIndex(null);
    setSelectedFreeLetter(null);
  }, [stopTimer]);

  // ゲーム開始
  const startGame = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setMessage("");
    try {
      const [dictionary, layout] = await Promise.all([
        loadDictionary(selectedCategory),
        loadBoardLayout(BOARD_SIZE),
      ]);
      setDict(dictionary.set);
      setDictEntries(dictionary.entries);

      const bag = generateBag();
      const [initialRack, remainingBag] = drawTiles(bag, RACK_SIZE);

      // DBからデッキ読み込み
      const playerDeck = await loadDeckFromDB(userId);
      const gameDeck = prepareGameDeck(playerDeck);
      const initialSpecialHand = gameDeck.slice(0, Math.min(4, gameDeck.length));
      const remainingDeck = gameDeck.slice(initialSpecialHand.length);

      const state: GameState = {
        board: createEmptyBoard(layout),
        rack: initialRack,
        bag: remainingBag,
        placedThisTurn: [],
        score: 0,
        turn: 0,
        maxTurns: MAX_TURNS,
        category: selectedCategory,
        layout,
        finished: false,
        lastWords: [],
        freePool: createFreePool(),
        specialDeck: remainingDeck,
        specialHand: initialSpecialHand,
        specialSet: null,
        usedSpecialIds: [],
        lastSpecialCategory: null,
        spellCheckRemaining: 3,
        nextTurnMultiplier: 1,
        wordHistory: [],
      };

      setGameState(state);
      setSelectedRackIndex(null);
      setSelectedFreeLetter(null);
      setScreen("game");
      startTimer();
    } catch (e) {
      setMessage(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedCategory, startTimer]);

  // ラック選択
  const selectRackTile = useCallback((index: number) => {
    setSelectedRackIndex(index);
    setSelectedFreeLetter(null);
  }, []);

  // フリーカード選択
  const selectFreeLetter = useCallback((letter: string) => {
    setSelectedFreeLetter((prev) => (prev === letter ? null : letter));
    setSelectedRackIndex(null);
  }, []);

  // 盤面にタイルを配置
  const placeTileOnBoard = useCallback(
    (x: number, y: number, placement: Placement) => {
      if (!gameState || gameState.finished) return;
      const cell = gameState.board[y][x];
      if (cell.char !== null || cell.pending !== null) return;

      const newBoard = cloneBoard(gameState.board);
      newBoard[y][x].pending = placement.char;

      let newFreePool = gameState.freePool;
      if (placement.source === "free") {
        newFreePool = { ...gameState.freePool };
        newFreePool[placement.char] = (newFreePool[placement.char] ?? 0) + 1;
      }

      setGameState({
        ...gameState,
        board: newBoard,
        freePool: newFreePool,
        placedThisTurn: [...gameState.placedThisTurn, placement],
      });
      setSelectedRackIndex(null);
      setSelectedFreeLetter(null);
      setMessage("");
    },
    [gameState]
  );

  // セルクリック
  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (!gameState || gameState.finished) return;
      const cell = gameState.board[y][x];

      // 仮置き済みセルをクリック → 取り消し
      if (cell.pending !== null) {
        const newBoard = cloneBoard(gameState.board);
        newBoard[y][x].pending = null;

        const placement = gameState.placedThisTurn.find((p) => p.x === x && p.y === y);
        let newFreePool = gameState.freePool;
        if (placement?.source === "free") {
          newFreePool = { ...gameState.freePool };
          newFreePool[placement.char] = Math.max(0, (newFreePool[placement.char] ?? 0) - 1);
        }

        setGameState({
          ...gameState,
          board: newBoard,
          freePool: newFreePool,
          placedThisTurn: gameState.placedThisTurn.filter((p) => !(p.x === x && p.y === y)),
        });
        setMessage("");
        return;
      }

      // 確定済みセルは無視
      if (cell.char !== null) return;

      // フリーカードを置く
      if (selectedFreeLetter !== null) {
        const used = gameState.freePool[selectedFreeLetter] ?? 0;
        if (used >= MAX_FREE_USES) return;
        placeTileOnBoard(x, y, {
          x, y,
          char: selectedFreeLetter,
          rackIndex: -1,
          source: "free",
        });
        return;
      }

      // ラックから置く
      if (selectedRackIndex === null) return;
      if (selectedRackIndex >= gameState.rack.length) return;
      const char = gameState.rack[selectedRackIndex];
      placeTileOnBoard(x, y, {
        x, y,
        char,
        rackIndex: selectedRackIndex,
        source: "normal",
      });
    },
    [gameState, selectedRackIndex, selectedFreeLetter, placeTileOnBoard]
  );

  // ドロップ処理
  const handleDropOnCell = useCallback(
    (x: number, y: number, data: string) => {
      if (!gameState || gameState.finished) return;
      const cell = gameState.board[y][x];
      if (cell.char !== null || cell.pending !== null) return;

      if (data.startsWith("normal:")) {
        const rackIndex = parseInt(data.split(":")[1], 10);
        if (isNaN(rackIndex) || rackIndex >= gameState.rack.length) return;
        placeTileOnBoard(x, y, {
          x, y,
          char: gameState.rack[rackIndex],
          rackIndex,
          source: "normal",
        });
      } else if (data.startsWith("free:")) {
        const letter = data.split(":")[1];
        const used = gameState.freePool[letter] ?? 0;
        if (used >= MAX_FREE_USES) return;
        placeTileOnBoard(x, y, {
          x, y,
          char: letter,
          rackIndex: -1,
          source: "free",
        });
      }
    },
    [gameState, placeTileOnBoard]
  );

  // スペシャルカード発動判定
  const checkSpecialActivation = useCallback(
    (state: GameState, formedWords: string[]): { bonus: number; activated: boolean; effectDesc: string } => {
      if (!state.specialSet) return { bonus: 0, activated: false, effectDesc: "" };

      const card = state.specialSet;

      if (card.category !== "all" && card.category !== state.category) {
        return { bonus: 0, activated: false, effectDesc: "" };
      }

      const cardWord = card.word.toUpperCase();
      const wordFormed = formedWords.some((w) => w.toUpperCase() === cardWord);
      if (!wordFormed) return { bonus: 0, activated: false, effectDesc: "" };

      let bonus = 0;
      const effectDesc = `[${card.word}] ${card.meaning} 発動！ ${card.description}`;

      switch (card.effectType) {
        case "bonus_flat":
          bonus = card.effectValue;
          break;
        case "word_multiplier":
        case "draw_normal":
        case "recover_free":
        case "upgrade_bonus":
        case "next_turn_mult":
          break;
      }

      return { bonus, activated: true, effectDesc };
    },
    []
  );

  // ゲーム終了時の保存処理
  const saveGameResult = useCallback(async (finalState: GameState) => {
    if (!userId) return;
    // ガチャポイント付与
    const earnedPoints = finalState.score;
    await addGachaPointsDB(userId, earnedPoints);
    // スコア保存
    await saveScoreToDB(
      userId,
      finalState.score,
      finalState.category,
      finalState.turn,
      finalState.wordHistory,
    );
  }, [userId]);

  // 確定処理
  const handleConfirm = useCallback(() => {
    if (!gameState || !dict) return;

    const result = validateMove(gameState, dict);
    if (!result.ok) {
      setMessage(result.reason ?? "不正な手です。");
      return;
    }

    let scoreBreakdown = computeScore(gameState);
    const formedWords = result.formedWords ?? [];

    const special = checkSpecialActivation(gameState, formedWords);
    let newState = gameState;

    if (special.activated && gameState.specialSet) {
      const card = gameState.specialSet;
      const ev = scaledEffectValue(card.effectValue, card.level ?? 1);
      let totalScore = scoreBreakdown.total;

      switch (card.effectType) {
        case "bonus_flat":
          totalScore += Math.round(ev);
          break;
        case "word_multiplier": {
          const extraScore = Math.round(totalScore * (ev - 1));
          const cap = card.rarity === "SSR" ? 40 + (card.level - 1) * 10 : Infinity;
          totalScore += Math.min(extraScore, cap);
          break;
        }
        case "draw_normal": {
          const drawCount = Math.round(ev);
          const [drawn, newBag] = drawTiles(newState.bag, drawCount);
          newState = {
            ...newState,
            rack: [...newState.rack, ...drawn],
            bag: newBag,
          };
          break;
        }
        case "recover_free": {
          const recoverCount = Math.round(ev);
          const newFreePool = { ...newState.freePool };
          let recovered = 0;
          for (const letter of Object.keys(newFreePool)) {
            if (recovered >= recoverCount) break;
            if (newFreePool[letter] > 0) {
              newFreePool[letter] = Math.max(0, newFreePool[letter] - 1);
              recovered++;
            }
          }
          newState = { ...newState, freePool: newFreePool };
          break;
        }
        case "next_turn_mult":
          newState = { ...newState, nextTurnMultiplier: ev };
          break;
        case "upgrade_bonus":
          break;
      }

      scoreBreakdown = { ...scoreBreakdown, total: totalScore };

      newState = {
        ...newState,
        usedSpecialIds: [...newState.usedSpecialIds, card.instanceId],
        specialHand: newState.specialHand.filter((c) => c.instanceId !== card.instanceId),
      };
    }

    const moveResult = { formedWords, scoreBreakdown };
    const finalState = applyMove(newState, moveResult);

    setGameState(finalState);
    setSelectedRackIndex(null);
    setSelectedFreeLetter(null);

    const specialMsg = special.activated ? ` ${special.effectDesc}` : "";
    setMessage(
      scoreBreakdown.breakdown
        .map((b) => `「${b.word}」${b.points}点`)
        .join("、") +
      `  (+${scoreBreakdown.total}点)` +
      specialMsg
    );

    if (finalState.finished) {
      stopTimer();
      saveGameResult(finalState);
      setScreen("result");
    } else {
      startTimer();
    }
  }, [gameState, dict, checkSpecialActivation, startTimer, stopTimer, saveGameResult]);

  // パス処理（内部用）
  const handlePassInternal = useCallback(() => {
    if (!gameState) return;

    const newState = applyPass(gameState);
    setGameState(newState);
    setSelectedRackIndex(null);
    setSelectedFreeLetter(null);
    setMessage("パスしました。");

    if (newState.finished) {
      stopTimer();
      saveGameResult(newState);
      setScreen("result");
    } else {
      startTimer();
    }
  }, [gameState, startTimer, stopTimer, saveGameResult]);

  // パス（UI経由）
  const handlePass = useCallback(() => {
    handlePassInternal();
  }, [handlePassInternal]);

  // Undo
  const handleUndo = useCallback(() => {
    if (!gameState) return;
    setGameState(undoPlacement(gameState));
    setSelectedRackIndex(null);
    setSelectedFreeLetter(null);
    setMessage("");
  }, [gameState]);

  // 中断
  const handleQuit = useCallback(() => {
    if (window.confirm("ゲームを中断しますか？\nスコアは記録されません。")) {
      returnToTitle();
    }
  }, [returnToTitle]);

  // スペシャルカードセット
  const handleSetSpecial = useCallback((card: SpecialCard) => {
    if (!gameState || gameState.placedThisTurn.length > 0) return;
    setGameState({ ...gameState, specialSet: card });
  }, [gameState]);

  // スペシャルカードアンセット
  const handleUnsetSpecial = useCallback(() => {
    if (!gameState) return;
    setGameState({ ...gameState, specialSet: null });
  }, [gameState]);

  // スペル確認使用
  const handleUseSpellCheck = useCallback(() => {
    if (!gameState) return;
    setGameState({
      ...gameState,
      spellCheckRemaining: gameState.spellCheckRemaining - 1,
    });
  }, [gameState]);

  // === 画面レンダリング ===

  // ログイン画面
  if (screen === "login") {
    return (
      <div className="app app--login">
        <LoginScreen onLogin={handleLogin} loading={loginLoading} error={loginError} />
      </div>
    );
  }

  // 未ログインガード
  if (!userId) {
    setScreen("login");
    return null;
  }

  // チュートリアル
  if (screen === "tutorial") {
    return (
      <div className="app app--tutorial">
        <Tutorial onBack={returnToTitle} />
      </div>
    );
  }

  // ガチャ
  if (screen === "gacha") {
    return (
      <div className="app app--gacha">
        <GachaScreen userId={userId} onBack={returnToTitle} />
      </div>
    );
  }

  // デッキ構築
  if (screen === "deckEdit") {
    return (
      <div className="app app--deck">
        <DeckEditor userId={userId} onBack={returnToTitle} />
      </div>
    );
  }

  // 管理者画面
  if (screen === "admin" && isAdmin) {
    return (
      <div className="app app--admin">
        <AdminScreen onBack={returnToTitle} />
      </div>
    );
  }

  // カテゴリ選択画面
  if (screen === "categorySelect") {
    return (
      <div className="app app--categorySelect">
        <div className="category-select-screen">
          <h1 className="category-select-screen__heading">ステージ選択</h1>
          <p className="category-select-screen__sub">プレイするカテゴリを選んでください</p>

          <div className="category-select-screen__grid">
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
              <button
                key={c}
                className={`category-select-card ${selectedCategory === c ? "category-select-card--active" : ""}`}
                onClick={() => setSelectedCategory(c)}
              >
                <span className="category-select-card__name">{CATEGORY_LABELS[c]}</span>
              </button>
            ))}
          </div>

          <button
            className="start-btn"
            onClick={startGame}
            disabled={loading}
          >
            {loading ? "読み込み中..." : "スタート"}
          </button>

          <button
            className="start-btn start-btn--secondary"
            onClick={returnToTitle}
          >
            もどる
          </button>

          {message && <p className="error-msg">{message}</p>}
        </div>
      </div>
    );
  }

  // タイトル画面
  if (screen === "title") {
    return (
      <div className="app app--title">
        <div className="title-screen">
          <h1 className="title-screen__heading">English Word Puzzle</h1>
          <p className="title-screen__sub">英単語でパズルに挑戦しよう！</p>
          <p className="title-screen__user">ログイン中: <strong>{userId}</strong></p>

          <button
            className="start-btn"
            onClick={() => setScreen("categorySelect")}
          >
            ゲーム
          </button>

          <button
            className="start-btn start-btn--gacha"
            onClick={() => setScreen("gacha")}
          >
            ガチャ
          </button>

          <button
            className="start-btn start-btn--deck"
            onClick={() => setScreen("deckEdit")}
          >
            デッキ構築
          </button>

          <button
            className="start-btn start-btn--secondary"
            onClick={() => setScreen("tutorial")}
          >
            あそびかた
          </button>

          {isAdmin && (
            <button
              className="start-btn start-btn--admin"
              onClick={() => setScreen("admin")}
            >
              管理者画面
            </button>
          )}

          <button
            className="start-btn start-btn--logout"
            onClick={handleLogout}
          >
            ログアウト
          </button>

          {message && <p className="error-msg">{message}</p>}

          <RankingPanel selectedCategory={selectedCategory} currentUserId={userId} />
        </div>
      </div>
    );
  }

  // 結果画面
  if (screen === "result" && gameState) {
    return (
      <div className="app app--result">
        <div className="result-screen">
          <h1>ゲーム終了！</h1>
          <p className="result-screen__category">ステージ: {CATEGORY_LABELS[gameState.category]}</p>
          <p className="result-screen__score">
            スコア: <strong>{gameState.score}</strong> 点
          </p>
          <p className="result-screen__turns">ターン: {gameState.turn} / {gameState.maxTurns}</p>

          {gameState.wordHistory.length > 0 && (
            <div className="result-screen__words">
              <h3>使った単語（学習ログ）</h3>
              <ul className="result-screen__word-list">
                {[...new Set(gameState.wordHistory)].map((w) => (
                  <li key={w} className="result-screen__word-item">{w}</li>
                ))}
              </ul>
            </div>
          )}

          <button className="start-btn" onClick={returnToTitle}>
            タイトルにもどる
          </button>
        </div>
      </div>
    );
  }

  // ゲーム画面
  if (!gameState) return null;

  return (
    <div className="app app--game">
      <div className="game-screen">
        <GameHeader
          category={gameState.category}
          score={gameState.score}
          turn={gameState.turn}
          maxTurns={gameState.maxTurns}
          timeRemaining={timeRemaining}
          bagCount={gameState.bag.length}
        />

        {message && (
          <div className={`game-message ${message.includes("点") ? "game-message--success" : message.includes("パス") ? "game-message--info" : "game-message--error"}`}>
            {message}
          </div>
        )}

        {!message && gameState.lastWords.length > 0 && (
          <div className="game-message game-message--success">
            {gameState.lastWords.map((w) => `「${w.word}」${w.points}点`).join("、")}
          </div>
        )}

        <Board
          board={gameState.board}
          onCellClick={handleCellClick}
          onDropTile={handleDropOnCell}
        />

        <NormalRack
          tiles={gameState.rack}
          selectedIndex={selectedRackIndex}
          onSelect={selectRackTile}
        />

        <FreeCardPanel
          freePool={gameState.freePool}
          selectedLetter={selectedFreeLetter}
          onSelect={selectFreeLetter}
        />

        {(gameState.specialHand.length > 0 || gameState.specialSet !== null) && (
          <SpecialCardSlots
            hand={gameState.specialHand}
            setCard={gameState.specialSet}
            onSetCard={handleSetSpecial}
            onUnsetCard={handleUnsetSpecial}
            lastSpecialCategory={gameState.lastSpecialCategory}
          />
        )}

        <Controls
          onConfirm={handleConfirm}
          onUndo={handleUndo}
          onPass={handlePass}
          onQuit={handleQuit}
          onSpellCheck={() => setShowSpellCheck(true)}
          canConfirm={gameState.placedThisTurn.length > 0}
          canUndo={gameState.placedThisTurn.length > 0}
          spellCheckRemaining={gameState.spellCheckRemaining}
        />

        {showSpellCheck && (
          <SpellCheckModal
            entries={dictEntries}
            remaining={gameState.spellCheckRemaining}
            onUse={handleUseSpellCheck}
            onClose={() => setShowSpellCheck(false)}
          />
        )}
      </div>
    </div>
  );
}
