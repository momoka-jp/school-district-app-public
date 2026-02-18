# lib

フロント/サーバー双方で使う共通ロジックの置き場です。

## ファイル一覧

- `app-config.ts`
  - `public/data/config.json` の読み込みとデータパス解決
- `calculate-average-distance.ts`
  - 平均通学距離の計算（全体/学校別）
- `event-constants.ts`
  - 学校選択サマリー用のカスタムイベント定義
- `fetch-merged-data.ts`
  - Flask サーバーからマージ済みデータを取得
- `flask-url.ts`
  - Flask サーバーのエンドポイント解決（環境変数対応）
- `utils.ts`
  - `cn` ユーティリティと学校カラー/ステータス色の生成
