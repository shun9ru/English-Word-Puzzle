/**
 * チュートリアル（遊び方）画面
 */

import "../styles/Tutorial.css";

interface TutorialProps {
  onBack: () => void;
}

export function Tutorial({ onBack }: TutorialProps) {
  return (
    <div className="tutorial">
      <h1 className="tutorial__title">あそびかた</h1>

      <section className="tutorial__section">
        <h2>基本ルール</h2>
        <ul>
          <li>15×15の盤面に英単語を作って得点を稼ごう！</li>
          <li>1ゲーム10ターン、1ターン120秒の制限時間</li>
          <li>2文字以上の英単語（原形のみ）が有効</li>
          <li>既存のタイルに接するように置く（初手は自由配置）</li>
        </ul>
      </section>

      <section className="tutorial__section">
        <h2>3種類のカード</h2>
        <h3>ノーマルカード (3点/文字)</h3>
        <ul>
          <li>毎ターン手札7枚に自動補充</li>
          <li>ランダムに配布される英文字カード</li>
        </ul>
        <h3>フリーカード (1点/文字)</h3>
        <ul>
          <li>A〜Z全26文字がいつでも使える</li>
          <li>各文字は1ゲーム最大2回まで使用可能</li>
          <li>スペルがわからないときの救済用</li>
        </ul>
        <h3>スペシャルカード (2点/文字)</h3>
        <ul>
          <li>ガチャで集めた英単語カードでデッキを構築</li>
          <li>ターン開始時に1枚セットすると文字が使える</li>
          <li>カードの英単語を盤面で完成させると効果発動</li>
          <li>単語が完成しなくても文字は2点/文字で得点</li>
          <li>フリーカードを含む配置では効果発動しない</li>
          <li>同じカテゴリは2ターン連続で発動不可</li>
          <li>レアリティが高いほど長い単語で強力な効果</li>
        </ul>
      </section>

      <section className="tutorial__section">
        <h2>ボーナスマス</h2>
        <ul>
          <li><strong>DL</strong>（水色）: その文字のスコア×2</li>
          <li><strong>TL</strong>（青）: その文字のスコア×3</li>
          <li><strong>DW</strong>（黄色）: 単語全体のスコア×2</li>
          <li><strong>TW</strong>（オレンジ）: 単語全体のスコア×3</li>
        </ul>
      </section>

      <section className="tutorial__section">
        <h2>ステージ（カテゴリ）</h2>
        <ul>
          <li><strong>Animals</strong>: 動物に関する英単語</li>
          <li><strong>Food</strong>: 食べ物に関する英単語</li>
          <li><strong>Jobs</strong>: 職業に関する英単語</li>
          <li><strong>All Genre</strong>: 制限なし（全ジャンル）</li>
        </ul>
      </section>

      <section className="tutorial__section">
        <h2>スペル確認</h2>
        <ul>
          <li>1ターン3回まで使用可能</li>
          <li>日本語を入力して英単語候補を検索できる</li>
          <li>使用中もタイマーは止まらない</li>
          <li>最善手や自動配置の提案はしない</li>
        </ul>
      </section>

      <section className="tutorial__section">
        <h2>スペシャルカードのレアリティ</h2>
        <ul>
          <li><strong>N</strong>（灰）: 軽い補助効果</li>
          <li><strong>R</strong>（青）: 明確に強い効果</li>
          <li><strong>SR</strong>（紫）: 戦略的な効果</li>
          <li><strong>SSR</strong>（金）: 切り札級の効果</li>
        </ul>
      </section>

      <button className="tutorial__back-btn" onClick={onBack}>
        もどる
      </button>
    </div>
  );
}
