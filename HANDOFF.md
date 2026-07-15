# スマートパース AI — 開発引き継ぎドキュメント

2D図面（平面図＋展開図）から立体パースを自動生成するWebアプリの **フロントエンド実装**。
このドキュメントは、別の開発環境（Gemini等）で開発を継続するための完全な引き継ぎ資料。

- 場所: `/Volumes/T5_Data/CadtoPers`
- 種別: React 18 + Vite 6 + Tailwind CSS v4 + lucide-react（+ pdfjs-dist）
- 状態: LP と ツールUI（ダッシュボード）を実装済み。**バックエンド／実AI生成は未接続（モック）**。

---

## 1. コンセプト

建築・家具デザイナー向け。「2D図面のスクショから10秒でプロ品質のパースを」。
平面図と各壁の展開図をマッピング → AIが立体化、という体験。日塗工（JPMA）カラーとテクスチャ適用に対応。
デザインは **ミニマル／ソリッドなダークモード**、アクセントは teal（`#34e2c0`）、ブループリント風グリッド。

---

## 2. セットアップ / 実行

```bash
cd /Volumes/T5_Data/CadtoPers
npm install
npm run dev      # http://localhost:5173
npm run build    # 本番ビルド（dist/）
```

- `/`     … ランディングページ（LP）
- `/app`  … パース生成ツール（本体）

---

## 3. ディレクトリ構成と各ファイルの責務

```
src/
  main.jsx                 ルーティング（/ と /app）。BrowserRouter。
  index.css                Tailwind v4 テーマ(@theme)・カスタムユーティリティ・アニメCSS
  data/materials.js        JPMAカラー/テクスチャ/環境のサンプルデータ（ダミー値）
  lib/
    pdf.js                 PDF→画像化（pdfjs, 遅延ロード）。縮尺→実寸(mm/px)換算ヘルパ
    walls.js               ★壁認識エンジン：輪郭ポリゴン→壁セグメント（位置/長さ/内向き法線）
    autofit.js             ★寸法マッチング：壁長×展開図幅の一対一割り当て（比率/実寸）
  components/
    Logo.jsx               ブランドロゴ
    OutlineTracer.jsx      領域トレース（部屋の輪郭を多角形でなぞる。全画面モーダル）
    WallMapper.jsx         ★平面図＋認識した壁の表示＋壁ごとの展開図スロット＋ふかし壁追加
    SheetCropper.jsx       展開図シート(PDF/画像・複数ページ)から矩形切り出し→壁へ割り当て
    PdfPagePicker.jsx      複数ページPDFのページ選択
    ScalePicker.jsx        図面ごとの縮尺(1/50等)選択ダイアログ
    PlanAnalyzing.jsx      平面図アップロード後の「空間解析」演出（3D回転＋スキャン）
    AutoFit.jsx            寸法で自動フィット（壁長×展開図幅の照合UI）
  pages/
    LandingPage.jsx        LP（Hero/課題/機能/CTA/Footer）
    Dashboard.jsx          ★ツール本体（3カラム）。状態管理の中枢。UploadSlot/MappingArea等を内包
```

★ = 中核ロジック。

---

## 4. コアデータモデル（Dashboard.jsx の state）

- `images.center` … 平面図の画像URL（`plan` として参照）
- `scales.center` … 平面図の実寸スケール mm/px（`planScale`）。PDF＋縮尺指定時のみ値が入る
- `outline` … 平面図上の部屋輪郭。正規化座標 `[{x,y}]`（0..1、画像に対する相対）
- `walls` … ★認識した壁の配列。各要素は `lib/walls.js` の構造：
  ```
  { id, index, a:{x,y}, b:{x,y}, mid, length(px,アスペクト補正済),
    normal:{x,y}(内向き法線), source:'outline'|'custom',
    image(展開図URL|null), scale(その展開図のmm/px|null), flip }
  ```
- `selectedWall` … 選択中の壁id
- 生成条件 `allReady` = 平面図あり && 壁が1面以上 && 全壁に展開図あり

**重要な設計変更の履歴**：当初は「平面図＋上下左右4辺」の固定スロットだったが、
L字・5面以上・ふかし壁（柱型）に対応するため **輪郭から壁を動的認識するモデル** に作り替えた。
`images` の top/bottom/left/right キーは now 未使用（残骸。整理してよい）。

---

## 5. 実装済み機能（と所在）

1. **図面アップロード**：スロットへ画像/PDFをクリック/ドロップ。⌘V/Ctrl+Vでスクショ直接貼り付け（Dashboard の paste useEffect）
2. **PDF対応**：`lib/pdf.js`。ブラウザ内でページを白背景画像化。複数ページはページ選択（PdfPagePicker）
3. **領域トレース**：OutlineTracer。部屋の輪郭を多角形でなぞり、枠外の寸法線・注記を無視。色に非依存
4. **壁認識**：トレース確定 → `deriveWalls()` で各辺を壁に。WallMapperで番号・視線矢印表示
5. **ふかし壁/柱の追加**：WallMapperで線を2点描画 → `makeCustomWall()`。視線向き反転可
6. **展開図シート切り出し**：SheetCropper。1枚のシート(PDF可・複数ページ可)から矩形で各面を切り出し、壁へ割り当て（CADでバラす不要）
7. **図面ごとの縮尺**：ScalePicker（スロット別）＋ SheetCropperのページ別縮尺。`mmPerPxFrom()` で実寸換算
8. **寸法で自動フィット**：AutoFit。壁長×展開図幅を照合し割り当てを入れ替え。縮尺が揃えば実寸mm照合（似寸法も区別）、無ければ比率照合
9. **空間解析アニメ**：PlanAnalyzing。平面図投入時に1回再生（prefers-reduced-motion配慮）
10. **マテリアル**：右パネル。JPMAカラー検索（サムネ候補→HEX）＋テクスチャタブ
11. **アングル/環境**：左パネル。方位磁針＋方位/仰角スライダー＋周辺環境プリセット
12. **レスポンシブ**：PCは3カラム、モバイルは上部タブ切替

---

## 6. 主要アルゴリズム（式つき）

### 壁認識（lib/walls.js）
- 輪郭 N点 → 閉多角形の N辺 = N壁。各壁の `length` はアスペクト補正した画素長
  `length = hypot((b.x-a.x)*natW, (b.y-a.y)*natH)`
- 内向き法線：辺の垂線を、多角形重心へ向く符号に揃える

### 縮尺→実寸（lib/pdf.js）
- PDFレンダ時に `ptPerPx = 1/renderScale` を保持
- `mmPerPx = ptPerPx × (25.4/72) × R`  （R = 縮尺の分母。1/50ならR=50）
- 検証済み：1/100・renderScale2.5 で 画素幅→4200mm を正確復元
- ⚠️ **画像スクショは物理サイズ不明のため縮尺だけでは実寸化不可**（PDFのみ実寸）。画像は比率照合のまま

### 寸法マッチング（lib/autofit.js）
- `absolute=true`（両者mm）：相対誤差 `|w-e|/max(w,e)` で照合＝似寸法も区別
- `absolute=false`：各列を最大値で正規化して比率照合＝スケール未知でも順序で合う
- 貪欲な一対一割り当て（コスト昇順）

---

## 7. デザインシステム（index.css）

- `@theme` で色トークン定義：`--color-ink-950..600`（背景/面）、`--color-accent-300/400/500`（teal）
- カスタムクラス：`.bp-grid` / `.bp-grid-fine`（ブループリント格子）、`.glow-accent` / `.animate-pulse-glow`（生成ボタン）、
  `.plan-rotor` / `.plan-scan` / `.turntable`（解析アニメ）、`.thin-scroll`（細スクロールバー）
- フォント：Inter + 日本語Noto Sans JP系、`font-feature-settings: "palt"`

---

## 8. モック／ダミーの箇所（本実装で差し替える対象）

- **パース生成**：`onGenerate()` はローディング後に placehold.co のダミー画像を表示するだけ。→ 実AI生成APIに接続
- **JPMAカラー**：`data/materials.js` はサンプルHEX。→ 正式な日塗工→マンセル→HEX変換テーブルに差し替え
- **テクスチャ**：CSSグラデーションの擬似。→ 実際のシームレス素材画像に
- **寸法の自動読み取り（OCR）**：未実装。現在は縮尺を人が入力。→ 図面の寸法テキスト/寸法線をAIで読むOCR/画像認識バックエンドを足すと、
  `AutoFit` の mm欄自動入力＝完全自動化。差し込み口（各mm/縮尺欄）は用意済み
- LP のビジュアルも placehold.co

---

## 9. 検証状況（重要）

**Chrome拡張（claude-in-chrome）が全セッションで接続不可**だったため、ブラウザ実操作のクリック確認ができていない。
代わりに以下で検証済み：

- `npm run build` 成功（全1587モジュール）
- 全モジュールのJSX変換エラー無し
- **単体テスト（Node）**：壁認識（矩形→4面/L字→6面・法線内向き）、縮尺換算（4200mm復元）、
  実寸マッチング（4200 vs 4180 の区別）、比率マッチング（異スケールでも順序一致）
- **SSRスモークテスト**：Dashboard/LandingPage が renderToString でクラッシュ無し

⚠️ **未確認＝インタラクション**：トレース→壁出現、壁への展開図アップロード、ふかし壁の線引き、
自動フィット押下時の実挙動、PDF読み込みのworker動作。→ 継続開発時にまず一通りクリックして確認推奨。

---

## 10. 次のステップ候補（ロードマップ）

- [ ] 上記インタラクションのブラウザ実機確認・微修正
- [ ] パース生成の実AI接続（バックエンド）。左パネルのアングル/環境、右のカラー/テクスチャを生成パラメータに反映
- [ ] OCRで図面の寸法を自動読み取り → 縮尺入力の自動化／自動フィットの完全自動化
- [ ] 展開図の高さ情報（床ライン/天井ライン）で立体化精度向上（前に検討、未着手）
- [ ] 切り出し矩形の辺ドラッグ微調整（寸法線の写り込み低減）、台形補正
- [ ] `images` の未使用キー（top/bottom/left/right）や `pdfBusy` 等の残骸整理
- [ ] 生成結果の書き出し（現在ボタンのみ）、プロジェクト保存

---

## 11. 開発メモ

- プレビュー：この環境ではプレビューMCPがセッション起点(別プロジェクト)に固定される事情があり、
  `npm run dev` を直接起動して `open http://localhost:5173/app` で確認していた
- pdf.js は初期バンドルを軽く保つため **遅延ロード**（初回PDF時のみ取得）。worker は Vite の `?url` import で解決
- 座標は基本 **正規化 [0..1]**（画像に対する相対）で保持し、解像度・トリミング非依存にしている
