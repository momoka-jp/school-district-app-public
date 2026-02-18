# utils

地図描画、最適化、エクスポート、学校状態管理などのユーティリティ群です。多くはクライアント側で使われます。

## 主なファイル

- `map-utils.ts`
  - 学校選択可否、色生成、在籍数の集計、年度別人数の取り回しなど
- `map-drawing-utils.ts`
  - Leaflet レイヤの描画/更新（校区ポリゴン、学校マーカー、ラベル、重心線など）
- `map-reducer.ts`
  - 地図画面の UI 状態をまとめる reducer
- `optimization-utils.ts`
  - 最適化 API へのリクエスト生成と結果の前処理
- `map-export.ts`
  - 地図の画像出力（`html2canvas` を利用）
- `school-utils.ts`
  - 学校マーカー/ラベル/ポップアップ生成、学校状態の派生
- `school-state-utils.ts`
  - 学校の開閉/除外/強制開校などの状態を一元判定
- `capacity-utils.ts`
  - 適正規模校数の集計
- `reset-districts.ts`
  - 校区のリセット処理（API呼び出し・状態再構築・再描画）

## 注意点

- `Leaflet` を使う処理が多く、ブラウザ環境前提のモジュールが含まれます。
- `map-drawing-utils.ts` は UI との結合が強いため、変更時は表示モードの影響を確認してください。
