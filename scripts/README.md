# scripts

## 前提環境

- Python 3.10 以上を推奨
- Geo 系スクリプトの実行には以下が必要
  - `geopandas`
  - `shapely`
- 最適化関連スクリプトには以下が必要
  - Gurobi Optimizer
  - `gurobipy`
  - 有効な Gurobi ライセンス（Academic License 可）

※ Gurobi を使用しない場合，最適化関連スクリプトは実行不要である．

---

## スクリプト一覧

### create_ikoma_sample_csv.py

生駒市向けの**サンプル入力データ一式**を生成するスクリプトである．  
研究データ非公開時のデモ・検証用途を想定している．

- 入力
  - `public/data/p29/29209/r2ka29209.topojson`
  - `public/data/p29/A27-23_29_GML/A27-23_29.shp` (小学校区)
  - `public/data/p29/A32-23_29_GML/A32-23_29.shp` (中学校区)
  - `public/data/output/schools_base.geojson` (※ `generate_schools_base.py` により事前生成が必要)
- 出力
  - `public/data/p29/29209/小中町丁目別学校区別学齢別性別集計.csv`
  - `public/data/p29/29209/school_capacity.json`
  - `public/data/p29/29209/jimoto.json`
  - `public/data/p29/29209/distance.json`

実行例:

```
python scripts/create_ikoma_sample_csv.py
```

### generate_schools_base.py

学校一覧データをもとに，**学校点の GeoJSON** を生成する．  
`config.json` の `schools_base_source_dir` を参照し，  
対象自治体に該当する学校のみを抽出する．

- 出力: `public/data/output/schools_base.geojson`

```
python scripts/generate_schools_base.py
```

### create_merged_geojson.py

町丁目ポリゴンと学校区ポリゴンを空間結合して、町丁目単位の GeoJSON を作成します。

- 入力: `config.json` で指定した町丁目データ・学校区データ
- 出力: `public/data/output/merged.geojson`

```
python scripts/create_merged_geojson.py
```

### merged_students_multi_year.py

「小中町丁目別学校区別学齢別性別集計.csv」の年度別人数を `merged.geojson` にマージし、
`merged_with_students.geojson` を生成します。年度一覧の JSON も併せて出力します。

- 入力: `config.json` の `students_csv_filename` と `merged_geojson_filename`
- 出力
  - `public/data/output/merged_with_students.geojson`
  - `public/data/output/available_years.json`

```
python scripts/merged_students_multi_year.py
```

### mk_school_geojson.py

学校一覧 CSV を点 GeoJSON に変換するユーティリティである．

- 入力: `config.json` の `schools_csv_filename`
- 出力: `config.json` の `schools_filename`

```
python scripts/mk_school_geojson.py
```

### map_csv_year_columns.py

CSV 内の年度列を自動検出するための確認用スクリプトである．  
年度抽出ロジックの検証用途を想定している．

```
python scripts/map_csv_year_columns.py
```

### mk_lp.py

**最適化計算用の Flask API サーバ**を起動するスクリプトである．  
Web アプリからの最適化リクエストを受け付ける．

- 主なエンドポイント
  - `POST /generate_lp`: 最適化実行
  - `POST /extract_adjacency`: GeoJSON から隣接関係を抽出
  - `GET /check_gurobi`: Gurobi の動作確認

```
python scripts/mk_lp.py
```

### gurobi_config.py

Gurobi モデルのパラメータ設定をまとめたユーティリティである．  
単体実行は想定しておらず，最適化ロジック側からの import を前提とする．

### gurobi_monitor.py

Gurobi 最適化の進行状況を取得・制御するための  
**簡易 Flask サーバ**である．

- `GET /optimization_status`
- `POST /cancel_optimization`

```
python scripts/gurobi_monitor.py
```

### start_flask_server.sh

仮想環境の作成、依存インストール、JSON マージ処理の実行後に `mk_lp.py` を起動します。

```
./scripts/start_flask_server.sh
```


