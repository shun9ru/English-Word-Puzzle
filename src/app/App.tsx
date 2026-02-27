/**
 * English Word Puzzle — メインアプリケーション（Supabase連携版）
 */

import { useState, useCallback, useEffect, useRef } from "react";
import type { GameState, GameMode, BattleType, CpuDifficulty, Category, Placement, DictEntry, SpecialCard, SpellHistoryEntry, BattleState, TurnHistoryEntry, PvpBattleState } from "../game/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { findBestMove } from "../game/cpu/cpuAI";
import { applyCpuMove, applyCpuPass } from "../game/cpu/applyCpuMove";
import { initPvpBattleState, applyPvpMove, applyPvpPass, getCurrentPlayer, getOpponentPlayer, updateOpponentPlayer, updateCurrentPlayer, swapRackForTurn } from "../game/pvp/pvpState";
import { updateRoomGameState, finishRoom, subscribeToRoom, unsubscribeFromRoom, updateRoomConfig } from "../lib/roomService";
import { loadDictionary } from "../game/dictionary";
import { loadBoardLayout } from "../game/boardLayout";
import { createEmptyBoard, cloneBoard, createFreePool } from "../game/core/helpers";
import { generateBag, drawTiles } from "../game/core/generateBag";
import { validateMove } from "../game/core/validateMove";
import { applyMove, applyPass, undoPlacement, computeScore } from "../game/core/applyMove";
import { prepareGameDeck, scaledEffectValue } from "../game/cards/deck";
import { getCurrentUserId, setCurrentUserId, logout } from "../lib/auth";
import { loginOrCreate, getUser } from "../lib/userService";
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
import { CollectionScreen } from "../components/CollectionScreen";
import { TurnHistory } from "../components/TurnHistory";
import { PvpLobby } from "../components/PvpLobby";
import { OnlineLobby } from "../components/OnlineLobby";
import { DeckSelectScreen } from "../components/DeckSelectScreen";
import "../styles/App.css";

const CATEGORY_LABELS: Record<Category, string> = {
  animals: "Animals",
  food: "Food",
  jobs: "Jobs",
  hobby: "Hobby",
  all: "All Genre",
};

const RACK_SIZE = 7;
const TURN_TIME = 120;
const MAX_FREE_USES = 2;
const DEFAULT_MAX_HP = 100;

const BOARD_SIZE_OPTIONS = [
  { size: 9, label: "9×9", desc: "スモール" },
  { size: 11, label: "11×11", desc: "ミディアム" },
  { size: 15, label: "15×15", desc: "ラージ" },
] as const;

const TURN_OPTIONS = [
  { turns: 5, label: "5ターン", desc: "クイック" },
  { turns: 10, label: "10ターン", desc: "スタンダード" },
  { turns: 15, label: "15ターン", desc: "ロング" },
] as const;

type Screen = "login" | "title" | "categorySelect" | "deckSelect" | "game" | "result" | "tutorial" | "gacha" | "deckEdit" | "collection" | "admin" | "pvpLobby" | "onlineLobby" | "ranking";

export default function App() {
  // 認証
  const [userId, setUserId] = useState<string | null>(getCurrentUserId());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [screen, setScreen] = useState<Screen>(userId ? "title" : "login");

  // セッション復帰時に管理者フラグを復元
  useEffect(() => {
    if (!userId) return;
    getUser(userId).then((user) => {
      if (user) {
        setIsAdmin(user.is_admin);
      }
    });
  }, [userId]);

  const [selectedCategory, setSelectedCategory] = useState<Category>("animals");
  const [selectedBoardSize, setSelectedBoardSize] = useState(15);
  const [selectedMaxTurns, setSelectedMaxTurns] = useState(10);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [dict, setDict] = useState<Set<string> | null>(null);
  const [dictEntries, setDictEntries] = useState<DictEntry[]>([]);
  const [selectedRackIndex, setSelectedRackIndex] = useState<number | null>(null);
  const [selectedFreeLetter, setSelectedFreeLetter] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSpellCheck, setShowSpellCheck] = useState(false);
  const [spellHistory, setSpellHistory] = useState<SpellHistoryEntry[]>([]);

  // バトルモード
  const [gameMode, setGameMode] = useState<GameMode>("solo");
  const [battleType, setBattleType] = useState<BattleType>("score");
  const [cpuDifficulty, setCpuDifficulty] = useState<CpuDifficulty>("normal");
  const [showDifficultyPicker, setShowDifficultyPicker] = useState(false);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [cpuThinking, setCpuThinking] = useState(false);
  const cpuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PvP モード
  const [pvpBattleState, setPvpBattleState] = useState<PvpBattleState | null>(null);
  const [pvpPlayer1Name, setPvpPlayer1Name] = useState("Player 1");
  const [pvpPlayer2Name, setPvpPlayer2Name] = useState("Player 2");
  const [showTurnInterstitial, setShowTurnInterstitial] = useState(false);
  const [onlineChannel, setOnlineChannel] = useState<RealtimeChannel | null>(null);
  const [onlineRoomId, setOnlineRoomId] = useState<string | null>(null);

  // デッキ選択
  const [p2UserId, setP2UserId] = useState<string | null>(null);

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

  // タイマー切れ → 自動パス（CPU思考中は無視）
  useEffect(() => {
    if (timeRemaining <= 0 && gameState && !gameState.finished && screen === "game" && !cpuThinking && !showTurnInterstitial) {
      // オンラインPvPで相手ターン中は自動パスしない
      if (pvpBattleState?.mode === "online_pvp" && pvpBattleState.myRole && pvpBattleState.turnOwner !== pvpBattleState.myRole) return;
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

  // オンラインPvP cleanup
  useEffect(() => {
    return () => {
      if (onlineChannel) {
        unsubscribeFromRoom(onlineChannel);
      }
    };
  }, [onlineChannel]);

  // タイトルに戻る
  const returnToTitle = useCallback(() => {
    stopTimer();
    if (cpuTimerRef.current) { clearTimeout(cpuTimerRef.current); cpuTimerRef.current = null; }
    setScreen("title");
    setGameState(null);
    setDict(null);
    setDictEntries([]);
    setMessage("");
    setSelectedRackIndex(null);
    setSelectedFreeLetter(null);
    setSpellHistory([]);
    setBattleState(null);
    setCpuThinking(false);
    setShowDifficultyPicker(false);
    // PvP cleanup
    setPvpBattleState(null);
    setShowTurnInterstitial(false);
    if (onlineChannel) {
      unsubscribeFromRoom(onlineChannel);
      setOnlineChannel(null);
    }
    setOnlineRoomId(null);
  }, [stopTimer, onlineChannel]);

  // ゲーム開始
  const startGame = useCallback(async (p1Slot: number = 0, p2Slot?: number) => {
    if (!userId) return;
    setLoading(true);
    setMessage("");
    try {
      const [dictionary, layout] = await Promise.all([
        loadDictionary(selectedCategory),
        loadBoardLayout(selectedBoardSize),
      ]);
      setDict(dictionary.set);
      setDictEntries(dictionary.entries);

      const bag = generateBag();
      const [initialRack, remainingBag] = drawTiles(bag, RACK_SIZE);

      const isBattle = gameMode === "battle";
      const isPvp = gameMode === "local_pvp" || gameMode === "online_pvp";

      // バトルモード / PvP: 相手ラックもバッグからドロー
      let finalBag = remainingBag;
      let secondRack: string[] = [];
      if (isBattle || isPvp) {
        const [r2, bagAfter] = drawTiles(remainingBag, RACK_SIZE);
        secondRack = r2;
        finalBag = bagAfter;
      }

      // スペシャルカード読み込み（ソロモードではバトル専用カードを除外）
      const playerDeck = await loadDeckFromDB(userId, selectedCategory, p1Slot);
      const allDeck = prepareGameDeck(playerDeck);
      const gameDeck = (isBattle || isPvp) ? allDeck : allDeck.filter((c) => !c.battleOnly);
      const initialSpecialHand = gameDeck.slice(0, Math.min(4, gameDeck.length));
      const remainingDeck = gameDeck.slice(initialSpecialHand.length);

      const state: GameState = {
        board: createEmptyBoard(layout),
        rack: initialRack,
        bag: finalBag,
        placedThisTurn: [],
        score: 0,
        turn: 0,
        maxTurns: selectedMaxTurns,
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
        turnHistory: [],
      };

      setGameState(state);
      setSelectedRackIndex(null);
      setSelectedFreeLetter(null);
      setSpellHistory([]);

      if (isPvp) {
        // PvP: Player2 のデッキを個別にロード
        let p2GameDeck: SpecialCard[];
        if (gameMode === "local_pvp" && p2UserId) {
          const p2DeckRaw = await loadDeckFromDB(p2UserId, selectedCategory, p2Slot ?? 0);
          p2GameDeck = prepareGameDeck(p2DeckRaw);
        } else if (gameMode === "online_pvp" && pvpPlayer2Name && pvpPlayer2Name !== userId) {
          const p2DeckRaw = await loadDeckFromDB(pvpPlayer2Name, selectedCategory, p2Slot ?? 0);
          p2GameDeck = prepareGameDeck(p2DeckRaw);
        } else {
          // フォールバック: P1デッキをコピー
          p2GameDeck = prepareGameDeck(playerDeck);
        }

        const pvp = initPvpBattleState(
          gameMode as "local_pvp" | "online_pvp",
          battleType,
          pvpPlayer1Name,
          pvpPlayer2Name,
          initialRack,
          secondRack,
          gameDeck,
          p2GameDeck,
          DEFAULT_MAX_HP,
        );

        setPvpBattleState(pvp);
        setBattleState(null);

        // オンラインPvP: ホストが初期状態をDBに保存
        if (gameMode === "online_pvp" && onlineRoomId) {
          const hostPvp = { ...pvp, myRole: "player1" as const };
          setPvpBattleState(hostPvp);
          await updateRoomGameState(onlineRoomId, state, hostPvp);

          // ゲーム中の更新を受信するためリスナーを再設定
          if (onlineChannel) unsubscribeFromRoom(onlineChannel);
          const ch = subscribeToRoom(onlineRoomId, (updatedRoom) => {
            if (!updatedRoom.game_state || !updatedRoom.pvp_battle_state) return;
            const gs = updatedRoom.game_state;
            const remotePvp = updatedRoom.pvp_battle_state;

            // ゲーム終了
            if (gs.finished) {
              setGameState(gs);
              setPvpBattleState({ ...remotePvp, myRole: "player1" });
              stopTimer();
              setScreen("result");
              return;
            }

            // 自分のターンになった → rack を入れ替えてタイマー開始
            if (remotePvp.turnOwner === "player1") {
              const swapped = swapRackForTurn(gs, remotePvp);
              setGameState(swapped);
              setPvpBattleState({ ...remotePvp, myRole: "player1" });
              startTimer();
            } else {
              // 相手のターン → 盤面だけ更新（自分の手の結果を反映）
              setGameState(gs);
              setPvpBattleState({ ...remotePvp, myRole: "player1" });
            }
          });
          setOnlineChannel(ch);
        }
      } else if (isBattle) {
        setBattleState({
          mode: "battle",
          battleType,
          turnOwner: "player",
          cpuRack: secondRack,
          cpuScore: 0,
          cpuWordHistory: [],
          battleTurn: 0,
          lastCpuMove: null,
          cpuHighlightCells: [],
          cpuLetterLimit: null,
          playerHp: DEFAULT_MAX_HP,
          cpuHp: DEFAULT_MAX_HP,
          maxHp: DEFAULT_MAX_HP,
          playerShield: 0,
          cpuShield: 0,
          playerMirror: 0,
          cpuMirror: 0,
          playerPoison: null,
          cpuPoison: null,
        });
        setPvpBattleState(null);
      } else {
        setBattleState(null);
        setPvpBattleState(null);
      }

      setScreen("game");
      startTimer();
    } catch (e) {
      setMessage(`エラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [userId, selectedCategory, selectedBoardSize, selectedMaxTurns, gameMode, battleType, startTimer, pvpPlayer1Name, pvpPlayer2Name, onlineRoomId, onlineChannel, p2UserId]);

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
      if (!gameState || gameState.finished || cpuThinking || showTurnInterstitial) return;
      // PvP: オンライン対戦で相手ターン中は操作不可
      if (pvpBattleState?.mode === "online_pvp" && pvpBattleState.myRole && pvpBattleState.turnOwner !== pvpBattleState.myRole) return;
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
      // 既にこのターンで使用済みのタイルは置けない
      const usedRackIndices = new Set(
        gameState.placedThisTurn.filter((p) => p.rackIndex >= 0).map((p) => p.rackIndex)
      );
      if (usedRackIndices.has(selectedRackIndex)) return;
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
      if (!gameState || gameState.finished || cpuThinking || showTurnInterstitial) return;
      // PvP: オンライン対戦で相手ターン中は操作不可
      if (pvpBattleState?.mode === "online_pvp" && pvpBattleState.myRole && pvpBattleState.turnOwner !== pvpBattleState.myRole) return;
      const cell = gameState.board[y][x];
      if (cell.char !== null || cell.pending !== null) return;

      if (data.startsWith("normal:")) {
        const rackIndex = parseInt(data.split(":")[1], 10);
        if (isNaN(rackIndex) || rackIndex >= gameState.rack.length) return;
        const usedRackIndices = new Set(
          gameState.placedThisTurn.filter((p) => p.rackIndex >= 0).map((p) => p.rackIndex)
        );
        if (usedRackIndices.has(rackIndex)) return;
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

      // "all" ステージまたは "all" タグ持ちカードなら発動可能
      if (state.category !== "all" && !card.categories.includes(state.category) && !card.categories.includes("all")) {
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
        case "reduce_opponent":
        case "force_letter_count":
        case "heal_hp":
        case "bonus_per_letter":
        case "draw_special":
        case "steal_points":
        case "shield":
        case "poison":
        case "mirror":
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

  // CPU ターン実行
  const executeCpuTurn = useCallback(
    (state: GameState, battle: BattleState) => {
      if (!dict) return;
      setCpuThinking(true);
      setMessage("CPU が考え中...");

      cpuTimerRef.current = setTimeout(() => {
        // CPUターン開始: 毒ティック
        if (battle.cpuPoison && battle.cpuPoison.turnsLeft > 0) {
          if (battle.battleType === "hp") {
            battle = { ...battle, cpuHp: Math.max(0, battle.cpuHp - battle.cpuPoison.damage) };
          } else {
            battle = { ...battle, cpuScore: Math.max(0, battle.cpuScore - battle.cpuPoison.damage) };
          }
          const remaining = battle.cpuPoison!.turnsLeft - 1;
          battle = { ...battle, cpuPoison: remaining > 0 ? { damage: battle.cpuPoison!.damage, turnsLeft: remaining } : null };
        }
        // CPUターン開始: シールド・ミラー減衰
        if (battle.cpuShield > 0) battle = { ...battle, cpuShield: battle.cpuShield - 1 };
        if (battle.cpuMirror > 0) battle = { ...battle, cpuMirror: battle.cpuMirror - 1 };

        const bestMove = findBestMove(state.board, battle.cpuRack, dict, state.layout, battle.cpuLetterLimit, cpuDifficulty);

        let result: { newState: GameState; newBattle: BattleState };
        if (bestMove) {
          result = applyCpuMove(state, battle, bestMove);
          const scoreMsg = `CPU: ${bestMove.words.map((w) => `「${w.word}」${w.points}点`).join("、")}  (+${bestMove.score}点)`;
          if (battle.battleType === "hp") {
            setMessage(`${scoreMsg} (${bestMove.score}ダメージ！)`);
          } else {
            setMessage(scoreMsg);
          }
        } else {
          result = applyCpuPass(state, battle);
          setMessage("CPU はパスしました。");
        }

        // HPバトル: CPUのスコアでプレイヤーにダメージ
        if (battle.battleType === "hp" && bestMove) {
          const damage = bestMove.score;
          const newPlayerHp = Math.max(0, result.newBattle.playerHp - damage);
          result.newBattle = { ...result.newBattle, playerHp: newPlayerHp };

          if (newPlayerHp <= 0) {
            result.newState = { ...result.newState, finished: true };
          }
        }

        // CPUターン履歴記録
        const cpuTurnNum = Math.floor((battle.battleTurn + 1) / 2) + 1;
        const cpuHistoryEntry: TurnHistoryEntry = bestMove
          ? {
              turn: cpuTurnNum,
              player: "cpu",
              words: bestMove.words,
              baseScore: bestMove.score,
              specialBonus: 0,
              multiplier: 1,
              totalScore: bestMove.score,
              cumulativeScore: result.newBattle.cpuScore,
              damageDealt: battle.battleType === "hp" ? bestMove.score : undefined,
              passed: false,
            }
          : {
              turn: cpuTurnNum,
              player: "cpu",
              words: [],
              baseScore: 0,
              specialBonus: 0,
              multiplier: 1,
              totalScore: 0,
              cumulativeScore: battle.cpuScore,
              passed: true,
            };

        result.newState = {
          ...result.newState,
          turnHistory: [...state.turnHistory, cpuHistoryEntry],
        };

        setGameState(result.newState);
        setBattleState(result.newBattle);
        setCpuThinking(false);
        cpuTimerRef.current = null;

        // プレイヤーターン開始: 毒ティック
        if (result.newBattle.playerPoison && result.newBattle.playerPoison.turnsLeft > 0) {
          if (result.newBattle.battleType === "hp") {
            result.newBattle = { ...result.newBattle, playerHp: Math.max(0, result.newBattle.playerHp - result.newBattle.playerPoison.damage) };
          }
          // スコアバトルでのプレイヤー毒は playerScore に影響（GameState.score で管理）
          const pRemaining = result.newBattle.playerPoison!.turnsLeft - 1;
          result.newBattle = { ...result.newBattle, playerPoison: pRemaining > 0 ? { damage: result.newBattle.playerPoison!.damage, turnsLeft: pRemaining } : null };
        }
        // プレイヤーターン開始: シールド・ミラー減衰
        if (result.newBattle.playerShield > 0) result.newBattle = { ...result.newBattle, playerShield: result.newBattle.playerShield - 1 };
        if (result.newBattle.playerMirror > 0) result.newBattle = { ...result.newBattle, playerMirror: result.newBattle.playerMirror - 1 };

        if (result.newState.finished) {
          stopTimer();
          saveGameResult(result.newState);
          setScreen("result");
        } else {
          startTimer();
        }
      }, 1200);
    },
    [dict, cpuDifficulty, startTimer, stopTimer, saveGameResult]
  );

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

    // --- PvP モード ---
    if (pvpBattleState) {
      const currentPlayer = getCurrentPlayer(pvpBattleState);
      const opponentPlayer = getOpponentPlayer(pvpBattleState);
      const playerRole = pvpBattleState.turnOwner;

      // スペシャルカード処理
      const special = checkSpecialActivation(gameState, formedWords);
      let specialMsg = "";
      let pvpGameState = gameState;
      let pvp = pvpBattleState;

      if (special.activated && gameState.specialSet) {
        const card = gameState.specialSet;
        const ev = scaledEffectValue(card.effectValue, card.level ?? 1, card.effectType);
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
            const [drawn, newBag] = drawTiles(pvpGameState.bag, drawCount);
            pvpGameState = { ...pvpGameState, rack: [...pvpGameState.rack, ...drawn], bag: newBag };
            break;
          }
          case "recover_free": {
            const recoverCount = Math.round(ev);
            const newFreePool = { ...pvpGameState.freePool };
            let recovered = 0;
            for (const letter of Object.keys(newFreePool)) {
              if (recovered >= recoverCount) break;
              if (newFreePool[letter] > 0) { newFreePool[letter] = Math.max(0, newFreePool[letter] - 1); recovered++; }
            }
            pvpGameState = { ...pvpGameState, freePool: newFreePool };
            break;
          }
          case "next_turn_mult":
            pvpGameState = { ...pvpGameState, nextTurnMultiplier: ev };
            break;
          case "reduce_opponent": {
            const opponent = getOpponentPlayer(pvp);
            if (opponent.shield > 0) {
              pvp = updateOpponentPlayer(pvp, { shield: opponent.shield - 1 });
            } else {
              pvp = updateOpponentPlayer(pvp, { score: Math.max(0, opponent.score - Math.round(ev)) });
            }
            break;
          }
          case "force_letter_count": {
            const opponent2 = getOpponentPlayer(pvp);
            if (opponent2.shield > 0) {
              pvp = updateOpponentPlayer(pvp, { shield: opponent2.shield - 1 });
            } else {
              pvp = updateOpponentPlayer(pvp, { letterLimit: Math.round(ev) });
            }
            break;
          }
          case "bonus_per_letter": {
            const perLetter = Math.round(ev);
            totalScore += perLetter * gameState.placedThisTurn.length;
            break;
          }
          case "draw_special": {
            const drawCount = Math.round(ev);
            let hand = [...pvpGameState.specialHand];
            let deck = [...pvpGameState.specialDeck];
            for (let i = 0; i < drawCount && deck.length > 0; i++) {
              hand.push(deck[0]); deck = deck.slice(1);
            }
            pvpGameState = { ...pvpGameState, specialHand: hand, specialDeck: deck };
            break;
          }
          case "steal_points": {
            const opponent3 = getOpponentPlayer(pvp);
            if (opponent3.shield > 0) {
              pvp = updateOpponentPlayer(pvp, { shield: opponent3.shield - 1 });
            } else {
              const stealAmount = Math.min(Math.round(ev), opponent3.score);
              pvp = updateOpponentPlayer(pvp, { score: opponent3.score - stealAmount });
              totalScore += stealAmount;
            }
            break;
          }
          case "shield": {
            const duration = Math.round(ev);
            pvp = updateCurrentPlayer(pvp, { shield: duration });
            break;
          }
          case "poison": {
            const opponent4 = getOpponentPlayer(pvp);
            if (opponent4.shield > 0) {
              pvp = updateOpponentPlayer(pvp, { shield: opponent4.shield - 1 });
            } else {
              const dmg = Math.round(ev);
              const turnsLeft = 3 + Math.floor(((card.level ?? 1) - 1) / 2);
              pvp = updateOpponentPlayer(pvp, { poison: { damage: dmg, turnsLeft } });
            }
            break;
          }
          case "mirror": {
            const mirrorDuration = Math.round(ev);
            pvp = updateCurrentPlayer(pvp, { mirrorActive: mirrorDuration });
            break;
          }
          case "heal_hp":
            break;
          case "upgrade_bonus":
            break;
        }
        scoreBreakdown = { ...scoreBreakdown, total: totalScore };
        specialMsg = ` ${special.effectDesc}`;
        pvpGameState = {
          ...pvpGameState,
          usedSpecialIds: [...pvpGameState.usedSpecialIds, card.instanceId],
          specialHand: pvpGameState.specialHand.filter((c) => c.instanceId !== card.instanceId),
        };
      }

      // HPバトル: ダメージ・回復
      let updatedPlayerHp = currentPlayer.hp;
      let updatedOpponentHp = opponentPlayer.hp;

      if (pvpBattleState.battleType === "hp") {
        updatedOpponentHp = Math.max(0, updatedOpponentHp - scoreBreakdown.total);
        if (special.activated && gameState.specialSet?.effectType === "heal_hp") {
          const card = gameState.specialSet;
          const healAmount = Math.round(scaledEffectValue(card.effectValue, card.level ?? 1, card.effectType));
          updatedPlayerHp = Math.min(pvpBattleState.maxHp, updatedPlayerHp + healAmount);
        }
      }

      // 素点を記録
      const rawScore = computeScore(gameState).total;

      const moveResult = { formedWords, scoreBreakdown };
      const { newState: pvpNewState, newPvp: pvpNewBattle } = applyPvpMove(pvpGameState, pvp, moveResult);

      // HP更新を反映
      const currentKey = playerRole === "player1" ? "player1" : "player2";
      const opponentKey = playerRole === "player1" ? "player2" : "player1";
      let finalPvp: PvpBattleState = {
        ...pvpNewBattle,
        [currentKey]: { ...pvpNewBattle[currentKey], hp: updatedPlayerHp },
        [opponentKey]: { ...pvpNewBattle[opponentKey], hp: updatedOpponentHp },
      };

      const hpKo = pvpBattleState.battleType === "hp" && updatedOpponentHp <= 0;
      let finalState = { ...pvpNewState, finished: hpKo || pvpNewState.finished };

      // 履歴記録
      let healAmount = 0;
      if (pvpBattleState.battleType === "hp" && special.activated && gameState.specialSet?.effectType === "heal_hp") {
        healAmount = Math.round(scaledEffectValue(gameState.specialSet.effectValue, gameState.specialSet.level ?? 1, gameState.specialSet.effectType));
      }
      const pvpHistoryEntry: TurnHistoryEntry = {
        turn: Math.floor(finalPvp.battleTurn / 2) + 1,
        player: playerRole,
        words: scoreBreakdown.breakdown,
        baseScore: rawScore,
        specialCard: special.activated ? gameState.specialSet?.word : undefined,
        specialEffect: special.activated ? special.effectDesc : undefined,
        specialBonus: scoreBreakdown.total - rawScore,
        multiplier: gameState.nextTurnMultiplier,
        totalScore: scoreBreakdown.total,
        cumulativeScore: finalPvp[currentKey].score,
        damageDealt: pvpBattleState.battleType === "hp" ? scoreBreakdown.total : undefined,
        hpHealed: healAmount > 0 ? healAmount : undefined,
        passed: false,
      };
      finalState = { ...finalState, turnHistory: [...gameState.turnHistory, pvpHistoryEntry] };

      let msgText = scoreBreakdown.breakdown
        .map((b) => `「${b.word}」${b.points}点`)
        .join("、") + `  (+${scoreBreakdown.total}点)`;
      if (pvpBattleState.battleType === "hp") {
        msgText += ` (${scoreBreakdown.total}ダメージ！)`;
      }
      msgText += specialMsg;
      setMessage(msgText);
      stopTimer();

      if (finalState.finished) {
        setGameState(finalState);
        setPvpBattleState(finalPvp);
        saveGameResult(finalState);
        if (onlineRoomId) {
          updateRoomGameState(onlineRoomId, finalState, finalPvp);
          finishRoom(onlineRoomId);
        }
        setScreen("result");
      } else if (pvpBattleState.mode === "local_pvp") {
        // ローカルPvP: ターン切替インタースティシャル表示
        setGameState(finalState);
        setPvpBattleState(finalPvp);
        setSelectedRackIndex(null);
        setSelectedFreeLetter(null);
        setShowTurnInterstitial(true);
      } else {
        // オンラインPvP: DB に保存
        const swapped = swapRackForTurn(finalState, finalPvp);
        setGameState(swapped);
        setPvpBattleState(finalPvp);
        setSelectedRackIndex(null);
        setSelectedFreeLetter(null);
        if (onlineRoomId) {
          updateRoomGameState(onlineRoomId, finalState, finalPvp);
        }
      }
      return;
    }

    // --- バトルモード ---
    if (battleState) {
      let battleGameState = gameState;

      // スペシャルカード処理
      const special = checkSpecialActivation(battleGameState, formedWords);
      let specialMsg = "";
      let newCpuLetterLimit: number | null = battleState.cpuLetterLimit;
      let newCpuScore = battleState.cpuScore;
      let newPlayerShield = battleState.playerShield;
      let newCpuShield = battleState.cpuShield;
      let newPlayerMirror = battleState.playerMirror;
      let newCpuPoison = battleState.cpuPoison;
      let newPlayerPoison = battleState.playerPoison;

      if (special.activated && battleGameState.specialSet) {
        const card = battleGameState.specialSet;
        const ev = scaledEffectValue(card.effectValue, card.level ?? 1, card.effectType);
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
            const [drawn, newBag] = drawTiles(battleGameState.bag, drawCount);
            battleGameState = {
              ...battleGameState,
              rack: [...battleGameState.rack, ...drawn],
              bag: newBag,
            };
            break;
          }
          case "recover_free": {
            const recoverCount = Math.round(ev);
            const newFreePool = { ...battleGameState.freePool };
            let recovered = 0;
            for (const letter of Object.keys(newFreePool)) {
              if (recovered >= recoverCount) break;
              if (newFreePool[letter] > 0) {
                newFreePool[letter] = Math.max(0, newFreePool[letter] - 1);
                recovered++;
              }
            }
            battleGameState = { ...battleGameState, freePool: newFreePool };
            break;
          }
          case "next_turn_mult":
            battleGameState = { ...battleGameState, nextTurnMultiplier: ev };
            break;
          case "reduce_opponent":
            if (newCpuShield > 0) { newCpuShield--; }
            else { newCpuScore = Math.max(0, newCpuScore - Math.round(ev)); }
            break;
          case "force_letter_count":
            if (newCpuShield > 0) { newCpuShield--; }
            else { newCpuLetterLimit = Math.round(ev); }
            break;
          case "bonus_per_letter": {
            const perLetter = Math.round(ev);
            totalScore += perLetter * gameState.placedThisTurn.length;
            break;
          }
          case "draw_special": {
            const spDrawCount = Math.round(ev);
            let hand = [...battleGameState.specialHand];
            let deck = [...battleGameState.specialDeck];
            for (let i = 0; i < spDrawCount && deck.length > 0; i++) {
              hand.push(deck[0]); deck = deck.slice(1);
            }
            battleGameState = { ...battleGameState, specialHand: hand, specialDeck: deck };
            break;
          }
          case "steal_points": {
            if (newCpuShield > 0) { newCpuShield--; }
            else {
              const stealAmount = Math.min(Math.round(ev), newCpuScore);
              newCpuScore -= stealAmount;
              totalScore += stealAmount;
            }
            break;
          }
          case "shield":
            newPlayerShield = Math.round(ev);
            break;
          case "poison": {
            if (newCpuShield > 0) { newCpuShield--; }
            else {
              const dmg = Math.round(ev);
              const turnsLeft = 3 + Math.floor(((card.level ?? 1) - 1) / 2);
              newCpuPoison = { damage: dmg, turnsLeft };
            }
            break;
          }
          case "mirror":
            newPlayerMirror = Math.round(ev);
            break;
          case "heal_hp":
            // HP回復はスコア計算後に別途処理
            break;
          case "upgrade_bonus":
            break;
        }

        scoreBreakdown = { ...scoreBreakdown, total: totalScore };
        specialMsg = ` ${special.effectDesc}`;

        battleGameState = {
          ...battleGameState,
          usedSpecialIds: [...battleGameState.usedSpecialIds, card.instanceId],
          specialHand: battleGameState.specialHand.filter((c) => c.instanceId !== card.instanceId),
        };
      }

      // HPバトル: HP ダメージ・回復処理
      let newPlayerHp = battleState.playerHp;
      let newCpuHp = battleState.cpuHp;

      if (battleState.battleType === "hp") {
        // プレイヤーのスコア = CPUへのダメージ
        newCpuHp = Math.max(0, newCpuHp - scoreBreakdown.total);

        // heal_hp カード効果
        if (special.activated && battleGameState.specialSet?.effectType === "heal_hp") {
          const card = battleGameState.specialSet;
          const healAmount = Math.round(scaledEffectValue(card.effectValue, card.level ?? 1, card.effectType));
          newPlayerHp = Math.min(battleState.maxHp, newPlayerHp + healAmount);
        }
      }

      // 素点を記録（スペシャル効果適用前）
      const rawScore = computeScore(gameState).total;

      const moveResult = { formedWords, scoreBreakdown };
      let finalState = applyMove(battleGameState, moveResult);

      // battleTurn で終了判定を上書き
      const newBattleTurn = battleState.battleTurn + 1;
      const hpKo = battleState.battleType === "hp" && newCpuHp <= 0;
      const finished = hpKo || newBattleTurn >= gameState.maxTurns * 2;
      finalState = { ...finalState, finished };

      // プレイヤーターン履歴記録
      let healAmount = 0;
      if (battleState.battleType === "hp" && special.activated && gameState.specialSet?.effectType === "heal_hp") {
        healAmount = Math.round(scaledEffectValue(gameState.specialSet.effectValue, gameState.specialSet.level ?? 1, gameState.specialSet.effectType));
      }
      const playerHistoryEntry: TurnHistoryEntry = {
        turn: Math.floor(newBattleTurn / 2) + 1,
        player: "player",
        words: scoreBreakdown.breakdown,
        baseScore: rawScore,
        specialCard: special.activated ? gameState.specialSet?.word : undefined,
        specialEffect: special.activated ? special.effectDesc : undefined,
        specialBonus: scoreBreakdown.total - rawScore,
        multiplier: gameState.nextTurnMultiplier,
        totalScore: scoreBreakdown.total,
        cumulativeScore: finalState.score,
        damageDealt: battleState.battleType === "hp" ? scoreBreakdown.total : undefined,
        hpHealed: healAmount > 0 ? healAmount : undefined,
        passed: false,
      };
      finalState = { ...finalState, turnHistory: [...gameState.turnHistory, playerHistoryEntry] };

      const newBattle: BattleState = {
        ...battleState,
        battleTurn: newBattleTurn,
        turnOwner: "cpu",
        cpuHighlightCells: [],
        cpuScore: newCpuScore,
        cpuLetterLimit: newCpuLetterLimit,
        playerHp: newPlayerHp,
        cpuHp: newCpuHp,
        playerShield: newPlayerShield,
        cpuShield: newCpuShield,
        playerMirror: newPlayerMirror,
        cpuMirror: battleState.cpuMirror,
        playerPoison: newPlayerPoison,
        cpuPoison: newCpuPoison,
      };

      setGameState(finalState);
      setBattleState(newBattle);
      setSelectedRackIndex(null);
      setSelectedFreeLetter(null);

      let msgText = scoreBreakdown.breakdown
        .map((b) => `「${b.word}」${b.points}点`)
        .join("、") +
        `  (+${scoreBreakdown.total}点)`;
      if (battleState.battleType === "hp") {
        msgText += ` (${scoreBreakdown.total}ダメージ！)`;
      }
      msgText += specialMsg;
      setMessage(msgText);
      stopTimer();

      if (finished) {
        saveGameResult(finalState);
        setScreen("result");
      } else {
        executeCpuTurn(finalState, newBattle);
      }
      return;
    }

    // --- ソロモード: 既存ロジック ---
    const special = checkSpecialActivation(gameState, formedWords);
    let newState = gameState;

    if (special.activated && gameState.specialSet) {
      const card = gameState.specialSet;
      const ev = scaledEffectValue(card.effectValue, card.level ?? 1, card.effectType);
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
        case "bonus_per_letter": {
          const perLetter = Math.round(ev);
          totalScore += perLetter * gameState.placedThisTurn.length;
          break;
        }
        case "draw_special": {
          const spDrawCount = Math.round(ev);
          let hand = [...newState.specialHand];
          let deck = [...newState.specialDeck];
          for (let i = 0; i < spDrawCount && deck.length > 0; i++) {
            hand.push(deck[0]); deck = deck.slice(1);
          }
          newState = { ...newState, specialHand: hand, specialDeck: deck };
          break;
        }
        case "upgrade_bonus":
        case "reduce_opponent":
        case "force_letter_count":
        case "heal_hp":
        case "steal_points":
        case "shield":
        case "poison":
        case "mirror":
          break;
      }

      scoreBreakdown = { ...scoreBreakdown, total: totalScore };

      newState = {
        ...newState,
        usedSpecialIds: [...newState.usedSpecialIds, card.instanceId],
        specialHand: newState.specialHand.filter((c) => c.instanceId !== card.instanceId),
      };
    }

    // 素点を記録
    const rawScoreSolo = computeScore(gameState).total;

    const moveResult = { formedWords, scoreBreakdown };
    let finalState = applyMove(newState, moveResult);

    // ソロモード履歴記録
    const soloHistoryEntry: TurnHistoryEntry = {
      turn: gameState.turn + 1,
      player: "player",
      words: scoreBreakdown.breakdown,
      baseScore: rawScoreSolo,
      specialCard: special.activated ? gameState.specialSet?.word : undefined,
      specialEffect: special.activated ? special.effectDesc : undefined,
      specialBonus: scoreBreakdown.total - rawScoreSolo,
      multiplier: gameState.nextTurnMultiplier,
      totalScore: scoreBreakdown.total,
      cumulativeScore: finalState.score,
      passed: false,
    };
    finalState = { ...finalState, turnHistory: [...gameState.turnHistory, soloHistoryEntry] };

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
  }, [gameState, dict, battleState, pvpBattleState, checkSpecialActivation, executeCpuTurn, startTimer, stopTimer, saveGameResult, onlineRoomId]);

  // パス処理（内部用）
  const handlePassInternal = useCallback(() => {
    if (!gameState) return;

    setSelectedRackIndex(null);
    setSelectedFreeLetter(null);
    setMessage("パスしました。");

    // --- PvP モード ---
    if (pvpBattleState) {
      const playerRole = pvpBattleState.turnOwner;
      const { newState: pvpNewState, newPvp } = applyPvpPass(gameState, pvpBattleState);

      const passEntry: TurnHistoryEntry = {
        turn: Math.floor(pvpNewState.turn) + 1,
        player: playerRole,
        words: [],
        baseScore: 0,
        specialBonus: 0,
        multiplier: 1,
        totalScore: 0,
        cumulativeScore: getCurrentPlayer(pvpBattleState).score,
        passed: true,
      };
      const finalState = { ...pvpNewState, turnHistory: [...gameState.turnHistory, passEntry] };

      stopTimer();

      if (finalState.finished) {
        setGameState(finalState);
        setPvpBattleState(pvpNewState.finished ? pvpNewState as unknown as PvpBattleState : newPvp);
        setPvpBattleState(newPvp);
        saveGameResult(finalState);
        if (onlineRoomId) {
          updateRoomGameState(onlineRoomId, finalState, newPvp);
          finishRoom(onlineRoomId);
        }
        setScreen("result");
      } else if (pvpBattleState.mode === "local_pvp") {
        setGameState(finalState);
        setPvpBattleState(newPvp);
        setShowTurnInterstitial(true);
      } else {
        const swapped = swapRackForTurn(finalState, newPvp);
        setGameState(swapped);
        setPvpBattleState(newPvp);
        if (onlineRoomId) {
          updateRoomGameState(onlineRoomId, finalState, newPvp);
        }
      }
      return;
    }

    const newState = applyPass(gameState);

    // パス履歴エントリ
    const passEntry: TurnHistoryEntry = {
      turn: battleState ? Math.floor((battleState.battleTurn + 1) / 2) + 1 : gameState.turn + 1,
      player: "player",
      words: [],
      baseScore: 0,
      specialBonus: 0,
      multiplier: 1,
      totalScore: 0,
      cumulativeScore: gameState.score,
      passed: true,
    };

    // --- バトルモード ---
    if (battleState) {
      const newBattleTurn = battleState.battleTurn + 1;
      const finished = newBattleTurn >= gameState.maxTurns * 2;
      const finalState = { ...newState, finished, turnHistory: [...gameState.turnHistory, passEntry] };

      const newBattle: BattleState = {
        ...battleState,
        battleTurn: newBattleTurn,
        turnOwner: "cpu",
        cpuHighlightCells: [],
      };

      setGameState(finalState);
      setBattleState(newBattle);
      stopTimer();

      if (finished) {
        saveGameResult(finalState);
        setScreen("result");
      } else {
        executeCpuTurn(finalState, newBattle);
      }
      return;
    }

    // --- ソロモード ---
    setGameState({ ...newState, turnHistory: [...gameState.turnHistory, passEntry] });

    if (newState.finished) {
      stopTimer();
      saveGameResult(newState);
      setScreen("result");
    } else {
      startTimer();
    }
  }, [gameState, battleState, pvpBattleState, executeCpuTurn, startTimer, stopTimer, saveGameResult, onlineRoomId]);

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
      if (cpuTimerRef.current) { clearTimeout(cpuTimerRef.current); cpuTimerRef.current = null; }
      setCpuThinking(false);
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

  // コレクション画面
  if (screen === "collection") {
    return (
      <div className="app app--collection">
        <CollectionScreen userId={userId} onBack={returnToTitle} />
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

  // ランキング画面
  if (screen === "ranking") {
    return (
      <div className="app app--categorySelect">
        <div className="ranking-screen">
          <h1 className="ranking-screen__heading">ランキング</h1>
          <RankingPanel selectedCategory={selectedCategory} currentUserId={userId} />
          <button className="start-btn start-btn--secondary" onClick={returnToTitle}>
            もどる
          </button>
        </div>
      </div>
    );
  }

  // デッキ選択画面
  if (screen === "deckSelect") {
    const isOnlineGuest = gameMode === "online_pvp" && onlineRoomId && pvpPlayer1Name !== userId;
    const isOnlineHost = gameMode === "online_pvp" && onlineRoomId && pvpPlayer1Name === userId;

    return (
      <div className="app app--categorySelect">
        <DeckSelectScreen
          mode={gameMode}
          category={selectedCategory}
          player1UserId={isOnlineGuest ? userId! : userId!}
          player1Name={isOnlineGuest ? userId! : pvpPlayer1Name}
          player2UserId={gameMode === "local_pvp" ? (p2UserId ?? undefined) : undefined}
          player2Name={gameMode === "local_pvp" ? pvpPlayer2Name : undefined}
          roomId={gameMode === "online_pvp" ? (onlineRoomId ?? undefined) : undefined}
          isHost={isOnlineHost === true}
          starting={loading}
          errorMessage={message}
          onConfirm={(p1Slot, p2Slot) => {
            if (isOnlineGuest) {
              // ゲスト: スロット確定後、game_state の到着を待つ
              let gameStarted = false;
              const channel = subscribeToRoom(onlineRoomId!, (updatedRoom) => {
                if (!updatedRoom.game_state || !updatedRoom.pvp_battle_state) return;
                const gs = updatedRoom.game_state;
                const remotePvp = updatedRoom.pvp_battle_state;

                if (!gameStarted) {
                  gameStarted = true;
                  const myPvp = { ...remotePvp, myRole: "player2" as const };
                  setPvpBattleState(myPvp);
                  Promise.all([
                    loadDictionary(gs.category),
                    loadBoardLayout(gs.layout.size),
                  ]).then(([dictionary]) => {
                    setDict(dictionary.set);
                    setDictEntries(dictionary.entries);
                  });
                  setGameState({ ...gs, rack: remotePvp.player2.rack });
                  setScreen("game");
                } else {
                  if (gs.finished) {
                    setGameState(gs);
                    setPvpBattleState({ ...remotePvp, myRole: "player2" });
                    stopTimer();
                    setScreen("result");
                  } else if (remotePvp.turnOwner === "player2") {
                    const swapped = swapRackForTurn(gs, remotePvp);
                    setGameState(swapped);
                    setPvpBattleState({ ...remotePvp, myRole: "player2" });
                    startTimer();
                  } else {
                    setGameState(gs);
                    setPvpBattleState({ ...remotePvp, myRole: "player2" });
                  }
                }
              });
              setOnlineChannel(channel);
            } else {
              // ホスト / ソロ / CPU / ローカルPvP: ゲーム開始
              startGame(p1Slot, p2Slot);
            }
          }}
          onBack={() => setScreen("categorySelect")}
        />
      </div>
    );
  }

  // ローカルPvPロビー
  if (screen === "pvpLobby") {
    return (
      <div className="app app--categorySelect">
        <PvpLobby
          player1UserId={userId!}
          player1Name={userId!}
          onStart={(p1Name, p2Name, p2Id) => {
            setPvpPlayer1Name(p1Name);
            setPvpPlayer2Name(p2Name);
            setP2UserId(p2Id);
            setScreen("categorySelect");
          }}
          onBack={returnToTitle}
        />
      </div>
    );
  }

  // オンラインPvPロビー
  if (screen === "onlineLobby") {
    return (
      <div className="app app--categorySelect">
        <OnlineLobby
          userId={userId!}
          config={{
            category: selectedCategory,
            boardSize: selectedBoardSize,
            maxTurns: selectedMaxTurns,
            battleType,
          }}
          onRoomCreated={(room) => {
            setOnlineRoomId(room.id);
            setPvpPlayer1Name(userId!);
            // Subscribe to room updates (waiting for guest)
            const channel = subscribeToRoom(room.id, (updatedRoom) => {
              if (updatedRoom.status === "playing" && updatedRoom.guest_user_id) {
                setPvpPlayer2Name(updatedRoom.guest_user_id);
                setScreen("categorySelect");
              }
            });
            setOnlineChannel(channel);
          }}
          onRoomJoined={(room) => {
            setOnlineRoomId(room.id);
            setPvpPlayer1Name(room.host_user_id);
            setPvpPlayer2Name(userId!);
            // ルームの設定からカテゴリ等を読み取り
            setSelectedCategory(room.game_config.category);
            setSelectedBoardSize(room.game_config.boardSize);
            setSelectedMaxTurns(room.game_config.maxTurns);
            setBattleType(room.game_config.battleType);
            setGameMode("online_pvp");
            // デッキ選択画面へ（ゲスト用）
            setScreen("deckSelect");
          }}
          onBack={returnToTitle}
        />
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

          {(gameMode === "battle" || gameMode === "local_pvp" || gameMode === "online_pvp") && (
            <>
              <h2 className="category-select-screen__section-title">バトルタイプ</h2>
              <div className="category-select-screen__options">
                <button
                  className={`option-card ${battleType === "score" ? "option-card--active" : ""}`}
                  onClick={() => setBattleType("score")}
                >
                  <span className="option-card__label">スコア勝負</span>
                  <span className="option-card__desc">スコアが高い方が勝ち</span>
                </button>
                <button
                  className={`option-card ${battleType === "hp" ? "option-card--active" : ""}`}
                  onClick={() => setBattleType("hp")}
                >
                  <span className="option-card__label">HPバトル</span>
                  <span className="option-card__desc">相手のHPを0にしたら勝ち</span>
                </button>
              </div>
            </>
          )}

          <h2 className="category-select-screen__section-title">盤面サイズ</h2>
          <div className="category-select-screen__options">
            {BOARD_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.size}
                className={`option-card ${selectedBoardSize === opt.size ? "option-card--active" : ""}`}
                onClick={() => setSelectedBoardSize(opt.size)}
              >
                <span className="option-card__label">{opt.label}</span>
                <span className="option-card__desc">{opt.desc}</span>
              </button>
            ))}
          </div>

          <h2 className="category-select-screen__section-title">ターン数</h2>
          <div className="category-select-screen__options">
            {TURN_OPTIONS.map((opt) => (
              <button
                key={opt.turns}
                className={`option-card ${selectedMaxTurns === opt.turns ? "option-card--active" : ""}`}
                onClick={() => setSelectedMaxTurns(opt.turns)}
              >
                <span className="option-card__label">{opt.label}</span>
                <span className="option-card__desc">{opt.desc}</span>
              </button>
            ))}
          </div>

          <button
            className="start-btn"
            onClick={async () => {
              // オンラインPvP: カテゴリ確定時にルーム設定を更新
              if (gameMode === "online_pvp" && onlineRoomId) {
                await updateRoomConfig(onlineRoomId, {
                  category: selectedCategory,
                  boardSize: selectedBoardSize,
                  maxTurns: selectedMaxTurns,
                  battleType,
                });
              }
              setScreen("deckSelect");
            }}
            disabled={loading}
          >
            つぎへ
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

          {/* ゲームグループ */}
          <div className="title-screen__group">
            <h2 className="title-screen__group-title">ゲーム</h2>
            <div className="title-screen__group-btns">
              <button
                className="start-btn start-btn--solo"
                onClick={() => {
                  setGameMode("solo");
                  setShowDifficultyPicker(false);
                  setScreen("categorySelect");
                }}
              >
                ソロプレイ
              </button>

              <button
                className="start-btn start-btn--battle"
                onClick={() => {
                  setGameMode("battle");
                  setShowDifficultyPicker(true);
                }}
              >
                CPU対戦
              </button>

              <button
                className="start-btn start-btn--local-pvp"
                onClick={() => {
                  setGameMode("local_pvp");
                  setShowDifficultyPicker(false);
                  setScreen("pvpLobby");
                }}
              >
                ローカル対戦
              </button>

              <button
                className="start-btn start-btn--online-pvp"
                onClick={() => {
                  setGameMode("online_pvp");
                  setShowDifficultyPicker(false);
                  setScreen("onlineLobby");
                }}
              >
                オンライン対戦
              </button>
            </div>

            {showDifficultyPicker && (
              <div className="difficulty-picker">
                <h3 className="difficulty-picker__title">CPUの強さ</h3>
                <div className="difficulty-picker__options">
                  {([
                    { value: "easy" as CpuDifficulty, label: "よわい", desc: "初心者向け" },
                    { value: "normal" as CpuDifficulty, label: "ふつう", desc: "バランス型" },
                    { value: "hard" as CpuDifficulty, label: "つよい", desc: "上級者向け" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      className={`option-card ${cpuDifficulty === opt.value ? "option-card--active" : ""}`}
                      onClick={() => setCpuDifficulty(opt.value)}
                    >
                      <span className="option-card__label">{opt.label}</span>
                      <span className="option-card__desc">{opt.desc}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="start-btn"
                  onClick={() => {
                    setShowDifficultyPicker(false);
                    setScreen("categorySelect");
                  }}
                >
                  つぎへ
                </button>
              </div>
            )}
          </div>

          {/* カードグループ */}
          <div className="title-screen__group">
            <h2 className="title-screen__group-title">カード</h2>
            <div className="title-screen__group-btns">
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
                className="start-btn start-btn--collection"
                onClick={() => setScreen("collection")}
              >
                コレクション
              </button>
            </div>
          </div>

          {/* その他グループ */}
          <div className="title-screen__group title-screen__group--other">
            <div className="title-screen__group-btns">
              <button
                className="start-btn start-btn--secondary"
                onClick={() => setScreen("ranking")}
              >
                ランキング
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
            </div>
          </div>

          {message && <p className="error-msg">{message}</p>}
        </div>
      </div>
    );
  }

  // 結果画面
  if (screen === "result" && gameState) {
    const isBattleResult = battleState !== null;
    const isPvpResult = pvpBattleState !== null;
    const isHpBattle = battleState?.battleType === "hp" || pvpBattleState?.battleType === "hp";

    let player1Win = false;
    let player2Win = false;

    if (isPvpResult && pvpBattleState) {
      const p1 = pvpBattleState.player1;
      const p2 = pvpBattleState.player2;
      if (pvpBattleState.battleType === "hp") {
        if (p2.hp <= 0) { player1Win = true; }
        else if (p1.hp <= 0) { player2Win = true; }
        else { player1Win = p1.hp > p2.hp; player2Win = p1.hp < p2.hp; }
      } else {
        player1Win = p1.score > p2.score;
        player2Win = p1.score < p2.score;
      }
    }

    let playerWin = false;
    let cpuWin = false;

    if (isBattleResult && battleState) {
      if (isHpBattle) {
        if (battleState.cpuHp <= 0) { playerWin = true; }
        else if (battleState.playerHp <= 0) { cpuWin = true; }
        else { playerWin = battleState.playerHp > battleState.cpuHp; cpuWin = battleState.playerHp < battleState.cpuHp; }
      } else {
        playerWin = gameState.score > (battleState?.cpuScore ?? 0);
        cpuWin = gameState.score < (battleState?.cpuScore ?? 0);
      }
    }

    return (
      <div className="app app--result">
        <div className="result-screen">
          <h1>ゲーム終了！</h1>

          {/* PvP結果 */}
          {isPvpResult && pvpBattleState && (
            <>
              <h2 className={`result-screen__battle-result ${player1Win ? "result-screen__battle-result--win" : player2Win ? "result-screen__battle-result--lose" : "result-screen__battle-result--draw"}`}>
                {player1Win
                  ? `${pvpBattleState.player1.name} の勝ち！`
                  : player2Win
                  ? `${pvpBattleState.player2.name} の勝ち！`
                  : "引き分け！"}
              </h2>

              {pvpBattleState.battleType === "hp" ? (
                <div className="result-screen__hp-display">
                  <div className="result-screen__hp-bar-wrapper">
                    <strong className="result-screen__battle-player">{pvpBattleState.player1.name}</strong>
                    <div className="result-screen__hp-bar">
                      <div className="result-screen__hp-fill--player" style={{ width: `${Math.max(0, (pvpBattleState.player1.hp / pvpBattleState.maxHp) * 100)}%` }} />
                    </div>
                    <span>HP {pvpBattleState.player1.hp} / {pvpBattleState.maxHp}</span>
                  </div>
                  <div className="result-screen__hp-bar-wrapper">
                    <strong className="result-screen__battle-cpu">{pvpBattleState.player2.name}</strong>
                    <div className="result-screen__hp-bar">
                      <div className="result-screen__hp-fill--cpu" style={{ width: `${Math.max(0, (pvpBattleState.player2.hp / pvpBattleState.maxHp) * 100)}%` }} />
                    </div>
                    <span>HP {pvpBattleState.player2.hp} / {pvpBattleState.maxHp}</span>
                  </div>
                </div>
              ) : (
                <div className="result-screen__battle-scores">
                  <div className="result-screen__battle-player">
                    <strong>{pvpBattleState.player1.name}</strong>: {pvpBattleState.player1.score}点
                  </div>
                  <div className="result-screen__battle-cpu">
                    <strong>{pvpBattleState.player2.name}</strong>: {pvpBattleState.player2.score}点
                  </div>
                </div>
              )}
            </>
          )}

          {/* CPU対戦結果 */}
          {isBattleResult && !isPvpResult && (
            <>
              <h2 className={`result-screen__battle-result ${playerWin ? "result-screen__battle-result--win" : cpuWin ? "result-screen__battle-result--lose" : "result-screen__battle-result--draw"}`}>
                {playerWin ? "あなたの勝ち！" : cpuWin ? "CPUの勝ち..." : "引き分け！"}
              </h2>

              {isHpBattle && battleState ? (
                <div className="result-screen__hp-display">
                  <div className="result-screen__hp-bar-wrapper">
                    <strong className="result-screen__battle-player">You</strong>
                    <div className="result-screen__hp-bar">
                      <div className="result-screen__hp-fill--player" style={{ width: `${Math.max(0, (battleState.playerHp / battleState.maxHp) * 100)}%` }} />
                    </div>
                    <span>HP {battleState.playerHp} / {battleState.maxHp}</span>
                  </div>
                  <div className="result-screen__hp-bar-wrapper">
                    <strong className="result-screen__battle-cpu">CPU</strong>
                    <div className="result-screen__hp-bar">
                      <div className="result-screen__hp-fill--cpu" style={{ width: `${Math.max(0, (battleState.cpuHp / battleState.maxHp) * 100)}%` }} />
                    </div>
                    <span>HP {battleState.cpuHp} / {battleState.maxHp}</span>
                  </div>
                </div>
              ) : (
                <div className="result-screen__battle-scores">
                  <div className="result-screen__battle-player">
                    <strong>You</strong>: {gameState.score}点
                  </div>
                  <div className="result-screen__battle-cpu">
                    <strong>CPU</strong>: {battleState?.cpuScore ?? 0}点
                  </div>
                </div>
              )}
            </>
          )}

          <p className="result-screen__category">ステージ: {CATEGORY_LABELS[gameState.category]}</p>

          {!isBattleResult && !isPvpResult && (
            <>
              <p className="result-screen__score">
                スコア: <strong>{gameState.score}</strong> 点
              </p>
              <p className="result-screen__turns">ターン: {gameState.turn} / {gameState.maxTurns}</p>
            </>
          )}

          {gameState.wordHistory.length > 0 && (
            <div className="result-screen__words">
              <h3>{(isBattleResult || isPvpResult) ? "あなたの単語" : "使った単語（学習ログ）"}</h3>
              <ul className="result-screen__word-list">
                {[...new Set(gameState.wordHistory)].map((w) => (
                  <li key={w} className="result-screen__word-item">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {isBattleResult && !isPvpResult && battleState.cpuWordHistory.length > 0 && (
            <div className="result-screen__words">
              <h3>CPUの単語</h3>
              <ul className="result-screen__word-list">
                {[...new Set(battleState.cpuWordHistory)].map((w) => (
                  <li key={w} className="result-screen__word-item">{w}</li>
                ))}
              </ul>
            </div>
          )}

          {isPvpResult && pvpBattleState && (
            <>
              <div className="result-screen__words">
                <h3>{pvpBattleState.player1.name} の単語</h3>
                <ul className="result-screen__word-list">
                  {[...new Set(pvpBattleState.player1.wordHistory)].map((w) => (
                    <li key={w} className="result-screen__word-item">{w}</li>
                  ))}
                </ul>
              </div>
              <div className="result-screen__words">
                <h3>{pvpBattleState.player2.name} の単語</h3>
                <ul className="result-screen__word-list">
                  {[...new Set(pvpBattleState.player2.wordHistory)].map((w) => (
                    <li key={w} className="result-screen__word-item">{w}</li>
                  ))}
                </ul>
              </div>
            </>
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

  // PvP: オンライン対戦で相手ターン中は操作無効
  const isOnlineOpponentTurn = pvpBattleState?.mode === "online_pvp"
    && pvpBattleState.myRole
    && pvpBattleState.turnOwner !== pvpBattleState.myRole;
  const allDisabled = cpuThinking || showTurnInterstitial || !!isOnlineOpponentTurn;

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
          battleMode={battleState !== null}
          battleType={battleState?.battleType ?? pvpBattleState?.battleType}
          cpuScore={battleState?.cpuScore}
          turnOwner={battleState?.turnOwner}
          battleTurn={battleState?.battleTurn ?? pvpBattleState?.battleTurn}
          playerHp={battleState?.playerHp}
          cpuHp={battleState?.cpuHp}
          maxHp={battleState?.maxHp ?? pvpBattleState?.maxHp}
          playerStatus={battleState ? { shield: battleState.playerShield, poison: battleState.playerPoison, mirror: battleState.playerMirror } : undefined}
          cpuStatus={battleState ? { shield: battleState.cpuShield, poison: battleState.cpuPoison, mirror: battleState.cpuMirror } : undefined}
          pvpMode={pvpBattleState !== null}
          pvpTurnOwner={pvpBattleState?.turnOwner}
          player1Name={pvpBattleState?.player1.name}
          player1Score={pvpBattleState?.player1.score}
          player2Name={pvpBattleState?.player2.name}
          player2Score={pvpBattleState?.player2.score}
          player1Hp={pvpBattleState?.player1.hp}
          player2Hp={pvpBattleState?.player2.hp}
          player1Status={pvpBattleState ? { shield: pvpBattleState.player1.shield, poison: pvpBattleState.player1.poison, mirror: pvpBattleState.player1.mirrorActive } : undefined}
          player2Status={pvpBattleState ? { shield: pvpBattleState.player2.shield, poison: pvpBattleState.player2.poison, mirror: pvpBattleState.player2.mirrorActive } : undefined}
          isMyTurn={pvpBattleState?.mode === "online_pvp" ? !isOnlineOpponentTurn : undefined}
        />

        {/* PvP: 現在のターン表示バナー */}
        {pvpBattleState && !showTurnInterstitial && (
          <div className={`pvp-turn-banner pvp-turn-banner--${pvpBattleState.turnOwner}`}>
            {pvpBattleState.mode === "online_pvp" && isOnlineOpponentTurn
              ? `${getCurrentPlayer(pvpBattleState).name} のターン… 待機中`
              : `${getCurrentPlayer(pvpBattleState).name} のターン`}
          </div>
        )}

        {message && (
          <div className={`game-message ${cpuThinking ? "game-message--cpu" : message.includes("CPU") ? "game-message--cpu" : message.includes("点") ? "game-message--success" : message.includes("パス") ? "game-message--info" : "game-message--error"}`}>
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
          cpuHighlightCells={battleState?.cpuHighlightCells ?? pvpBattleState?.highlightCells}
          disabled={allDisabled}
        />

        <NormalRack
          tiles={gameState.rack}
          selectedIndex={selectedRackIndex}
          usedIndices={new Set(
            gameState.placedThisTurn.filter((p) => p.rackIndex >= 0).map((p) => p.rackIndex)
          )}
          onSelect={selectRackTile}
          disabled={allDisabled}
          bagCount={gameState.bag.length}
        />

        <FreeCardPanel
          freePool={gameState.freePool}
          selectedLetter={selectedFreeLetter}
          onSelect={selectFreeLetter}
          disabled={allDisabled}
        />

        {(gameState.specialHand.length > 0 || gameState.specialSet !== null) && (
          <SpecialCardSlots
            hand={gameState.specialHand}
            setCard={gameState.specialSet}
            onSetCard={handleSetSpecial}
            onUnsetCard={handleUnsetSpecial}
            lastSpecialCategory={gameState.lastSpecialCategory}
            disabled={allDisabled}
            deckRemaining={gameState.specialDeck.length}
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
          spellHistoryCount={spellHistory.length}
          allDisabled={allDisabled}
        />

        <TurnHistory
          entries={gameState.turnHistory}
          battleMode={battleState !== null || pvpBattleState !== null}
          battleType={battleState?.battleType ?? pvpBattleState?.battleType}
          player1Name={pvpBattleState?.player1.name}
          player2Name={pvpBattleState?.player2.name}
        />

        {showSpellCheck && (
          <SpellCheckModal
            entries={dictEntries}
            remaining={gameState.spellCheckRemaining}
            history={spellHistory}
            onUse={handleUseSpellCheck}
            onAddHistory={(entry) => setSpellHistory((prev) => [...prev, entry])}
            onClose={() => setShowSpellCheck(false)}
          />
        )}

        {/* ローカルPvP ターン切替インタースティシャル */}
        {showTurnInterstitial && pvpBattleState && (
          <div className="turn-interstitial">
            <div className="turn-interstitial__text">
              <span className={`turn-interstitial__player--${pvpBattleState.turnOwner}`}>
                {getCurrentPlayer(pvpBattleState).name}
              </span>
              {" のターンです"}
            </div>
            <button
              className="turn-interstitial__btn"
              onClick={() => {
                // rack を次プレイヤーに入れ替え
                const swapped = swapRackForTurn(gameState, pvpBattleState);
                setGameState(swapped);
                setShowTurnInterstitial(false);
                startTimer();
              }}
            >
              準備OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
