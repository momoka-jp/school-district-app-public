# app

Next.js App Router のエントリです。画面ページと API ルートをまとめています。

## ページ

- `layout.tsx`
  - 全体レイアウトとフォント/スタイルの読み込み
- `page.tsx`
  - メイン画面（地図 + パネル）
- `usage/page.tsx`
  - 使用方法のトップページ
- `usage/visualization-detail/page.tsx`
  - 可視化機能の詳細説明
- `usage/manual-edit-detail/page.tsx`
  - 手動編集の詳細説明
- `usage/optimization-detail/page.tsx`
  - 最適化機能の詳細説明

## API ルート

- `api/school-data/route.ts`
  - `schools.geojson` を返す
- `api/district-data/route.ts`
  - `merged_with_students.geojson` を返す（CSVパス情報を付与）
- `api/merge-schools/route.ts`
  - 学校点と定員情報を統合して `schools.geojson` を生成
- `api/reset-schools/route.ts`
  - `schools.original.geojson` から `schools.geojson` を復元
- `api/update-school/route.ts`
  - 学校の開閉/除外/強制開校を更新
- `api/optimize-districts/route.ts`
  - Flask の `/generate_lp` に最適化リクエストを転送
- `api/extract-adjacency/route.ts`
  - Flask の `/extract_adjacency` に隣接関係抽出を依頼

## 備考

- `public/data/config.json` を参照して各種データのパスを解決します。
- Flask サーバーの URL は `FLASK_SERVER_URL` / `NEXT_PUBLIC_FLASK_SERVER_URL` で設定可能です。
