# 進捗

## 2026-11-18(続き) — §2 実サイト調査 + 実データ対応

Claude in Chromeでユーザーの実アカウントにログインした状態を一緒に確認しながら調査した。詳細は `docs/site-notes.md`。カード番号・車両番号はすべてマスクした上でまとめている。

### 分かったこと

- ログイン前後で**同一URL**。URLではログイン判定できないため、DOM内のナビ文言(「ログアウト」「利用明細の表示」)で判定するよう `site-detect.ts` を修正。
- ブラウザの戻る/30分超の古い画面への再アクセス等で、ログイン切れとは別の**画面遷移ガード**(`利用明細 -確認してください-`)が出ることを発見。再ログイン不要で「利用明細へ」ボタンから復帰できる。`site-detect.ts` に `isFlowGuardScreen` / `findFlowGuardRecoverButton` を追加。
- 月タブ(`taisyoYM=YYYYMM`)は**既に取得済みの検索結果の中の表示切り替えに過ぎず、CSV出力の範囲には影響しない**ことを実験で確認(同じ内容のCSVが2回落ちてきた)。範囲を変えるには「検索条件の指定」画面でfrom/toを明示的に指定して検索し直す必要がある。
- CSV出力は**ブラウザの通常ファイルダウンロード**として行われる(新規タブが一瞬開いてすぐ閉じる)。content scriptでは `明細CSV` リンクのクリックをシミュレートせず、実行時にリンクの `href` をDOMから読み取って `fetch(href, {credentials:'include'})` で直接取得する方針に確定(`sync-runner.ts`)。
- 文字コードはShift_JIS確定。CSVの列構成を確定(`docs/site-notes.md`参照)。**道路名・距離の列はCSVに存在しない**ことが判明(§5のIC座標整備と合わせて別途対応が必要)。
- `備考`列にステータス(確定/確認中)と割引種別がセミコロン区切りで同居していることが判明。`確認中`→`確定`まで最長3週間かかる旨の案内あり。`Trip.status` を追加し、`meisaiRowToTrip`でパースするようにした。
- 実データをマスクして `fixtures/sample-meisai.csv`(94行)として保存。`src/shared/meisai-fixture.test.ts` でこのfixtureに対するパース結果を検証(11件のテストすべてpass)。
- 調査中にダウンロードされた生CSV(マスク前)2件は確認の上、ユーザーの指示で `~/Downloads/` から削除済み。

### 更新したコード

- `shared/types.ts`: `Trip.status` 追加。
- `shared/parse-csv.ts`: `meisaiRowToTrip()` を追加。実列名(全角含む)でのマッピング、2桁年の補完、`後納料金`優先のfare、`備考`分割ロジックを実装。
- `content/sync-runner.ts`: `findCsvExportLink()` + `fetch`ベースの取得に書き換え。旧・仮の列名マッピングを削除。
- `content/site-detect.ts`: 実際に確認した文言で判定するよう書き換え。

### まだ未確認

- 検索条件フォームを実際に送信して期間を変えた場合のレスポンス(フォームのpostをまだ試していない。本実装時に `nextfunc=1014000000` 宛のフォーム送信を組み立てて検証する必要がある)。
- サーバー側セッションが本当にタイムアウトした場合の挙動(ログインフォームに戻るのか専用画面が出るのか)。
- ログイン後各画面の生HTML fixture(`fixtures/`にHTMLはまだ無い。CSVのみ)。
- `車種`コードの対応表。
- 複数ETCカード保有時の「表示対象カード」切り替えUI。

## 2026-11-18 — プロジェクト初期化 + ダッシュボードUI実装

### やったこと

- `package.json` / `vite.config.ts` / `manifest.json` / `tsconfig.json` 一式を新規作成（Vite + @crxjs/vite-plugin + React 18 + TypeScript strict + Dexie）。§8のディレクトリ構成に合わせて `src/{content,background,dashboard,shared}` を用意。
- Claude上のデザインキャンバス（Explore / Insights / Records / Design tokens & states）から仕様を抽出し、`tokens.css` と3画面（Explore・Insights・Records）をReact + CSS Modulesで実装。
  - 共通部品: `Header`（ナビ・同期ステータス・カードチップ・テーマ切替）、`Primitives`（IconButton/LabelButton/Segmented/Chip/Tag/FloatPanel）、`EmptyState`、`Skeleton`、`Toast`（成功/エラー）。
  - **Explore**: 期間・頻度/均一の切り替え、サイドバー（検索・日付グループ・開閉）、SVGルート地図、選択時のハイライト/減光、詳細パネル（経路・料金内訳）。
  - **Insights**: 月送り、月/四半期/年の切り替え、KPI4枚（スパークライン付き）、月別推移チャート（平均線・当月の途中集計ハッチング）、道路/IC ランキング、時間帯ヒストグラム、曜日×時間帯ヒートマップ、この月の記録。
  - **Records**: ソート可能なテーブル（月グループ・スティッキーヘッダー）、検索・期間・割引フィルタ、行選択で右詳細パネル（モーダル不使用）。
- `src/shared/types.ts`（Trip/SyncState）、`parse-csv.ts`（Shift_JISデコード・CSVパース・重複キー）、`normalize-ic.ts`、`mock-data.ts`（開発用ダミーデータ、ダッシュボード単体確認に使用）。
- `background/{index,store,sync-controller}.ts` と `content/{main,floating-button,site-detect,sync-runner}.tsx` の配線を用意。CSV取得の実エンドポイント・DOM判定は**未確定**（下記参照）。
- Vitest: `parse-csv.test.ts`（CSVパース・重複キー・IC名正規化）、`aggregate.test.ts`（ルート集計・ランキング）。全7件 pass。
- `npx tsc -b --noEmit` / `npx vite build` / `npx vitest run` いずれも成功を確認。ダッシュボードはChromeで目視確認済み（ライト/ダーク両方、Explore/Insights/Records、選択状態・詳細パネルまで）。

### 未確認・未着手（次にやること）

- ~~§2のサイト調査が未着手~~ → **2026-11-18に実施済み**（下の節を参照）。CSVの列名・文字コード・ログイン判定・CSV取得方式は確定し、コードも実データ構造に合わせて更新した。ただし検索条件フォームを送信して期間を変える部分（複数月を遡る同期の実装そのもの）はまだコード化していない。
- ダッシュボードは引き続き `generateMockTrips()` のダミーデータで表示確認している（`content/sync-runner.ts` は実装したが、background側の月送り同期ループ・`search条件`フォーム送信はまだ繋いでいない）。
- Explore画面の地図はIC実座標（国土数値情報 N06）を未投入のため、IC名から決定的な仮配置で描画する簡易版（`src/dashboard/lib/geo.ts`）。§5 Phase 1/2（実座標・最短経路）は未着手。MapLibre GL / 地理院ベクトルタイルは未導入（現状はインラインSVGのみ）。
- `background/sync-controller.ts` の状態遷移・再開ロジックはCSV取得が確定してから本格的な単体テストを書く。
- アイコンは design-spec記載のカスタム形状を独自SVGで再現（lucideではなく自前実装）。細部（曲線の丸み等）はモックアップと完全一致ではない。
- 拡張機能アイコン（`public/icon*.png`）は仮のプレースホルダー画像。
