# スマートパース AI (Smart Parse AI)

2D図面のスクリーンショットから立体的なパースを自動生成するWebアプリの
フロントエンド実装（LP + ツールダッシュボード）。

- **Stack**: React 18 + Vite 6 + Tailwind CSS v4 + lucide-react
- **デザイン**: 建築デザイナー向けのミニマル／ソリッドなダークモード（accent: teal）

## セットアップ

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 本番ビルド → dist/
```

## 画面

| ルート | 内容 |
| --- | --- |
| `/`     | ランディングページ（Hero / 課題 / 機能 / CTA / Footer） |
| `/app`  | パース生成ツール（3カラム構成のワークスペース） |

## ダッシュボードの構成

- **中央**: 図面マッピングエリア。平面図をアップロード → 輪郭をトレースすると
  各壁を自動認識（L字・5面以上・ふかし壁/柱にも対応）。認識された各壁に展開図を
  割り当て、全壁が埋まると「パース生成を開始」ボタンが点灯。
  ※詳細な設計・現状・次ステップは [HANDOFF.md](HANDOFF.md) を参照。
- **右**: マテリアル選択。日塗工（JPMA）色番号検索（例: `19-90A` / `N-90` /
  `25-70B`）とテクスチャーストック（木目・石材・クロス・金属タブ）。
- **左**: カメラアングル（方位磁針＋方位/仰角スライダー）と周辺環境プリセット。

## 実装メモ（ダミー箇所）

- 図面/パース画像・テクスチャは `placehold.co` およびCSSグラデーションのダミー。
- JPMAカラーは `src/data/materials.js` のサンプル値。実運用では正式な
  マンセル→HEX変換テーブルに差し替える想定。
- 「パース生成」はローディング演出後にダミー画像を表示するモック。

## ディレクトリ

```
src/
  main.jsx            ルーティング（/ と /app）
  index.css           Tailwind v4 テーマ・カスタムユーティリティ
  components/Logo.jsx ブランドロゴ
  data/materials.js   JPMAカラー・テクスチャ・環境データ
  pages/
    LandingPage.jsx   LP
    Dashboard.jsx      ツールUI
```
