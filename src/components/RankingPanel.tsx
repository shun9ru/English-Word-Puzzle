import { useState, useEffect } from "react";
import type { Category } from "../game/types";
import type { ScoreRecord } from "../lib/scoreService";
import { getGlobalCategoryRanking, getGlobalOverallRanking } from "../lib/scoreService";
import "../styles/Ranking.css";

const CATEGORY_LABELS: Record<Category, string> = {
  animals: "Animals",
  food: "Food",
  jobs: "Jobs",
  hobby: "Hobby",
  all: "All Genre",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

interface RankingPanelProps {
  selectedCategory: Category;
  currentUserId: string;
}

export function RankingPanel({ selectedCategory, currentUserId }: RankingPanelProps) {
  const [catRanking, setCatRanking] = useState<ScoreRecord[]>([]);
  const [allRanking, setAllRanking] = useState<ScoreRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getGlobalCategoryRanking(selectedCategory, 10),
      getGlobalOverallRanking(10),
    ]).then(([cat, all]) => {
      if (cancelled) return;
      setCatRanking(cat);
      setAllRanking(all);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [selectedCategory]);

  if (loading) {
    return <div className="ranking-panel ranking-panel--loading">ランキング読み込み中...</div>;
  }

  return (
    <div className="ranking-panel">
      {catRanking.length > 0 && (
        <div className="ranking">
          <h3 className="ranking__title">{CATEGORY_LABELS[selectedCategory]} ランキング</h3>
          <ol className="ranking__list">
            {catRanking.map((e, i) => (
              <li
                key={e.id}
                className={`ranking__item${e.user_id === currentUserId ? " ranking__item--me" : ""}`}
              >
                <span className="ranking__rank">{i + 1}.</span>
                <span className="ranking__user">{e.user_id}</span>
                <span className="ranking__score">{e.score}点</span>
                <span className="ranking__date">{formatDate(e.played_at)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {allRanking.length > 0 && (
        <div className="ranking">
          <h3 className="ranking__title">総合ランキング</h3>
          <ol className="ranking__list">
            {allRanking.map((e, i) => (
              <li
                key={e.id}
                className={`ranking__item${e.user_id === currentUserId ? " ranking__item--me" : ""}`}
              >
                <span className="ranking__rank">{i + 1}.</span>
                <span className="ranking__user">{e.user_id}</span>
                <span className="ranking__score">{e.score}点</span>
                <span className="ranking__date">{formatDate(e.played_at)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {catRanking.length === 0 && allRanking.length === 0 && (
        <p className="ranking-panel__empty">まだスコアが記録されていません</p>
      )}
    </div>
  );
}
