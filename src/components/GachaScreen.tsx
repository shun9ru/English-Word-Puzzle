/**
 * ガチャ画面（バナー選択 + Supabase DB連携）
 */

import { useState, useEffect, useCallback } from "react";
import type { SpecialCard, Category } from "../game/types";
import { GACHA_BANNERS, pullGachaWithBanner, pullGacha10WithBanner, rarityColor } from "../game/cards/gacha";
import type { GachaBanner } from "../game/cards/gacha";
import { addToCollectionDB } from "../lib/collectionService";
import { getGachaPoints, updateGachaPoints } from "../lib/userService";
import { emojiToImageUrl } from "../data/specialCardDefs";
import "../styles/Gacha.css";

const MAX_LEVEL = 5;

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "animals", label: "Animals" },
  { value: "food", label: "Food" },
  { value: "jobs", label: "Jobs" },
  { value: "hobby", label: "Hobby" },
];

interface GachaResult {
  card: SpecialCard;
  isLevelUp: boolean;
  newLevel: number;
  copies: number;
  copiesNeeded: number;
}

interface GachaScreenProps {
  userId: string;
  onBack: () => void;
}

export function GachaScreen({ userId, onBack }: GachaScreenProps) {
  const [points, setPoints] = useState<number | null>(null);
  const [results, setResults] = useState<GachaResult[]>([]);
  const [animating, setAnimating] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<GachaBanner>(GACHA_BANNERS[0]);
  const [categoryFilter, setCategoryFilter] = useState<Category>("animals");

  useEffect(() => {
    getGachaPoints(userId).then(setPoints);
  }, [userId]);

  // カテゴリ別バナー選択時、バナーにフィルタを適用
  const activeBanner: GachaBanner = selectedBanner.id === "category"
    ? { ...selectedBanner, categoryFilter }
    : selectedBanner;

  const [error, setError] = useState("");

  const handleSingle = useCallback(async () => {
    if (points === null || points < activeBanner.singleCost || animating) return;
    setAnimating(true);
    setError("");
    try {
      const newPoints = points - activeBanner.singleCost;
      setPoints(newPoints);
      await updateGachaPoints(userId, newPoints);

      const card = pullGachaWithBanner(activeBanner);
      const result = await addToCollectionDB(userId, card);
      setResults([{ card, ...result }]);
    } catch (e) {
      console.error("ガチャエラー:", e);
      setError("保存に失敗しました。接続を確認してください。");
    } finally {
      setAnimating(false);
    }
  }, [userId, points, animating, activeBanner]);

  const handleMulti = useCallback(async () => {
    if (points === null || points < activeBanner.multiCost || animating) return;
    setAnimating(true);
    setError("");
    try {
      const newPoints = points - activeBanner.multiCost;
      setPoints(newPoints);
      await updateGachaPoints(userId, newPoints);

      const cards = pullGacha10WithBanner(activeBanner);
      const gachaResults: GachaResult[] = [];
      for (const card of cards) {
        const result = await addToCollectionDB(userId, card);
        gachaResults.push({ card, ...result });
      }
      setResults(gachaResults);
    } catch (e) {
      console.error("10連ガチャエラー:", e);
      setError("保存に失敗しました。接続を確認してください。");
    } finally {
      setAnimating(false);
    }
  }, [userId, points, animating, activeBanner]);

  if (points === null) {
    return <div className="gacha-screen"><p>読み込み中...</p></div>;
  }

  // 排出率テキスト
  const rateText = activeBanner.rates
    .map((r) => `${r.rarity}:${r.weight}%`)
    .join(" / ");

  return (
    <div className="gacha-screen">
      <h1 className="gacha-screen__title">ガチャ</h1>
      <p className="gacha-screen__points">ポイント: {points}pt</p>
      <p className="gacha-screen__hint">同じカードを引くと自動でレベルアップ（最大Lv.{MAX_LEVEL}）</p>

      {/* バナー選択タブ */}
      <div className="gacha-banner-tabs">
        {GACHA_BANNERS.map((b) => (
          <button
            key={b.id}
            className={`gacha-banner-tab ${selectedBanner.id === b.id ? "gacha-banner-tab--active" : ""}`}
            onClick={() => { setSelectedBanner(b); setResults([]); }}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* バナー説明 */}
      <div className="gacha-banner-info">
        <p className="gacha-banner-info__desc">{activeBanner.description}</p>
        <p className="gacha-banner-info__rates">排出率: {rateText}</p>
      </div>

      {/* カテゴリ別バナーの場合、カテゴリ選択表示 */}
      {selectedBanner.id === "category" && (
        <div className="gacha-category-select">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`gacha-category-btn ${categoryFilter === opt.value ? "gacha-category-btn--active" : ""}`}
              onClick={() => setCategoryFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {error && <p style={{ color: "#d32f2f", textAlign: "center", fontWeight: "bold" }}>{error}</p>}

      <div className="gacha-screen__buttons">
        <button
          className="gacha-screen__btn gacha-screen__btn--single"
          onClick={handleSingle}
          disabled={points < activeBanner.singleCost || animating}
        >
          1回引く ({activeBanner.singleCost}pt)
        </button>
        <button
          className="gacha-screen__btn gacha-screen__btn--multi"
          onClick={handleMulti}
          disabled={points < activeBanner.multiCost || animating}
        >
          10連 ({activeBanner.multiCost}pt) SR以上確定
        </button>
      </div>

      {animating && (
        <div className="gacha-screen__animating">抽選中...</div>
      )}

      {results.length > 0 && !animating && (
        <div className="gacha-screen__results">
          <h3>結果</h3>
          <div className="gacha-screen__card-grid">
            {results.map((r, i) => (
              <div
                key={`${r.card.instanceId}-${i}`}
                className={`gacha-screen__card${r.isLevelUp ? " gacha-screen__card--levelup" : ""}`}
                style={{ borderColor: rarityColor(r.card.rarity) }}
              >
                <img className="gacha-screen__card-icon" src={emojiToImageUrl(r.card.icon)} alt={r.card.word} />
                <span className="gacha-screen__card-word">{r.card.word}</span>
                <span className="gacha-screen__card-meaning">{r.card.meaning}</span>
                <span className="gacha-screen__card-rarity" style={{ color: rarityColor(r.card.rarity) }}>
                  {r.card.rarity}
                </span>
                {r.isLevelUp ? (
                  <span className="gacha-screen__levelup-badge">Lv.{r.newLevel} UP!</span>
                ) : r.newLevel < 5 ? (
                  <span className="gacha-screen__card-copies">{r.copies}/{r.copiesNeeded}</span>
                ) : (
                  <span className="gacha-screen__card-desc">MAX</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="gacha-screen__footer">
        <button className="gacha-screen__btn gacha-screen__btn--back" onClick={onBack}>
          もどる
        </button>
      </div>
    </div>
  );
}
