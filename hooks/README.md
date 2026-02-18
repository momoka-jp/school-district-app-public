# hooks

地図画面・最適化・選択状態などのロジックをまとめたカスタムフック群です。

## 一覧

- `useMapInitialization.ts`
  - Leaflet マップと各レイヤーを初期化し、ズームや pane を設定
- `use-map-data.ts`
  - CSV/GeoJSON の読み込み、正規化、年度別人数のマージ
- `use-map-renderer.ts`
  - レイヤ描画/更新の統合（学校・校区・ラベル・重心線など）
- `use-map-reducer.ts`
  - `map-reducer` を利用した画面状態管理
- `use-school-selection.ts`
  - 学校選択と開閉/除外/強制開校の更新処理
- `use-district-options.ts`
  - 町丁目の「固定/対象外/最適化対象」管理、選択集計
- `use-optimization-runner.ts`
  - 最適化実行、比較指標の計算、結果反映
- `use-mobile.tsx`
  - 画面幅によるモバイル判定
- `use-toast.ts`
  - トースト通知の状態管理（react-hot-toast風）
