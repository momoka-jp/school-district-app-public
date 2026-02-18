# components

画面構成に関わる React コンポーネント群です。地図表示とサイドパネル、各種ポップアップ、UIプリミティブを含みます。

## 主要コンポーネント

- `map-component.tsx`
  - Leaflet 地図の本体。データ読み込み・レイヤ描画・最適化・エクスポートを統合
- `header.tsx`
  - モード切替（小/中）と編集トグル、サイドパネル開閉
- `side-panel.tsx`
  - 左側のタブパネル（設定/統計/学校/ファイル）を管理
- `control-panel.tsx`
  - 画面右上の表示モード/平均距離/最適化実行などの操作パネル
- `comparison-view.tsx`
  - 画像アップロードによる比較ビュー
- `school-popup.tsx`
  - 学校マーカーのポップアップ（開閉/強制開校/対象外など）
- `town-popup.tsx`
  - 町丁目ポリゴンのポップアップ（最適化対象/固定の設定）
- `theme-provider.tsx`
  - `next-themes` のテーマプロバイダー

## tabs/

- `tabs/settings-tab.tsx` 表示設定、年度、最適化パラメータ
- `tabs/statistics-tab.tsx` 最適化前後の指標比較
- `tabs/schools-tab.tsx` 学校一覧と状態操作
- `tabs/files-tab.tsx` GeoJSON/CSV/画像の入出力、隣接関係の抽出

## ui/

`components/ui` は Radix UI + shadcn/ui スタイルの UI プリミティブ集です。
ボタン、ダイアログ、タブ、フォームなどが含まれます。
