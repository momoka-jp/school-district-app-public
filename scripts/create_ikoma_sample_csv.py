import geopandas as gpd
import pandas as pd
import numpy as np
import csv
import json
from pathlib import Path

# ===== パス設定 =====
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "public" / "data"

# 入力ファイル
IKOMA_TOPO = DATA_DIR / "p29" / "29209" / "r2ka29209.topojson"
PATH_SHO = DATA_DIR / "p29" / "A27-23_29_GML" / "A27-23_29.shp"
PATH_CHU = DATA_DIR / "p29" / "A32-23_29_GML" / "A32-23_29.shp"
SCHOOLS_GEOJSON = DATA_DIR / "output" / "schools_base.geojson" # 事前に生成済みであること

# 出力ファイル
OUTPUT_CSV = DATA_DIR / "p29" / "29209" / "小中町丁目別学校区別学齢別性別集計.csv"
OUTPUT_CAPACITY = DATA_DIR / "p29" / "29209" / "school_capacity.json" # ★追加
OUTPUT_JIMOTO = DATA_DIR / "p29" / "29209" / "jimoto.json"
OUTPUT_DISTANCE = DATA_DIR / "p29" / "29209" / "distance.json"

def main():
    print("--- 生駒市サンプルデータ（CSV & Capacity）作成開始 ---")

    # (中略: 前回の空間結合処理などはそのまま実行)
    # データの読み込み
    gdf_town = gpd.read_file(IKOMA_TOPO, layer="town")
    gdf_sho = gpd.read_file(PATH_SHO)
    gdf_chu = gpd.read_file(PATH_CHU)

    if gdf_town.crs is None:
        gdf_town.set_crs(epsg=4326, inplace=True)
    gdf_sho = gdf_sho.to_crs(gdf_town.crs)
    gdf_chu = gdf_chu.to_crs(gdf_town.crs)
    
    gdf_town_points = gdf_town.copy()
    gdf_town_points["geometry"] = gdf_town.geometry.representative_point()
    
    town_with_sho = gpd.sjoin(gdf_town_points, gdf_sho[["A27_004", "geometry"]], how="left", predicate="within").rename(columns={"A27_004": "小学校区"})
    if "index_right" in town_with_sho.columns:
        town_with_sho = town_with_sho.drop(columns=["index_right"])
    final_gdf = gpd.sjoin(town_with_sho, gdf_chu[["A32_004", "geometry"]], how="left", predicate="within").rename(columns={"A32_004": "中学校区"})

    # --- 1. CSVデータの生成 (前回の処理) ---
    print("CSVデータを生成中...")
    rows = []
    years = [2025, 2026, 2027, 2028, 2029, 2030, 2031]
    
    # 全学校名を収集するためのセット
    all_schools = set()

    def normalize_school_name(name: str, school_type: str) -> str:
        if not name:
            return ""

        if "小中学校" in name:
            base = name.replace("小中学校", "")
            if school_type == "sho":
                return f"{base}小学校"
            if school_type == "chu":
                return f"{base}中学校"
            return base

        name = name.replace("小学校", "").replace("中学校", "")

        if school_type == "sho":
            return f"{name}小学校"
        elif school_type == "chu":
            return f"{name}中学校"
        return name

    final_gdf["小学校名"] = final_gdf["小学校区"].apply(
        lambda x: normalize_school_name(x, "sho") if pd.notnull(x) else "生駒小学校"
    )

    final_gdf["中学校名"] = final_gdf["中学校区"].apply(
        lambda x: normalize_school_name(x, "chu") if pd.notnull(x) else "生駒中学校"
    )

    final_gdf["町キー"] = (
        final_gdf["小学校名"].astype(str)
        + "-"
        + final_gdf["中学校名"].astype(str)
        + "-"
        + final_gdf["S_NAME"].fillna("").astype(str)
    )
    duplicate_index = final_gdf.groupby("町キー").cumcount()
    has_suffix = duplicate_index > 0
    final_gdf.loc[has_suffix, "町キー"] = (
        final_gdf.loc[has_suffix, "町キー"] + "_" + (duplicate_index[has_suffix] + 1).astype(str)
    )

    for _, row in final_gdf.iterrows():
        town_name = row["S_NAME"] if "S_NAME" in row and row["S_NAME"] else f"生駒地区_{_}"
        sho_name = row["小学校名"]
        chu_name = row["中学校名"]
        
        all_schools.add(sho_name)
        all_schools.add(chu_name)
        
        full_town_key = row["町キー"]
        rate_sho, rate_chu = f"{np.random.uniform(88, 98):.2f}%", f"{np.random.uniform(75, 85):.2f}%"
        pop_sho = np.random.randint(5, 45, size=len(years))
        pop_chu = np.random.randint(5, 35, size=len(years))
        val_sho = [round(p * 0.95, 1) for p in pop_sho]
        val_chu = [round(p * 0.80, 1) for p in pop_chu]
        
        data_row = [sho_name, chu_name, town_name, full_town_key, rate_sho, rate_chu]
        data_row.extend(pop_sho); data_row.extend(pop_chu); data_row.extend(val_sho); data_row.extend(val_chu)
        rows.append(data_row)

    # CSV書き出し
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f); writer.writerow([""] * 6 + ["児童学齢住民数"] * 7 + ["生徒学齢住民数"] * 7 + ["児童数"] * 7 + ["生徒数"] * 7)
        writer.writerow(["小学校区", "中学校区", "町名", "町丁目名", "小学校区就学率", "中学校区就学率"] + [f"{y}年度" for y in years] * 4)
        writer.writerows(rows)
    print(f"CSV作成完了: {OUTPUT_CSV}")

    # --- 2. school_capacity.json の生成 (ご提示の構造に修正) ---
    print("学校容量データを生成中...")
    capacity_data = {}
    
    for school in sorted(list(all_schools)):
        # 小学校か中学校かでデフォルト値を設定
        if "小学校" in school:
            min_val = 150
            max_val = 600
        else:
            min_val = 200
            max_val = 900
            
        # ご提示いただいた形式 {"学校名": {"min": 150, "max": 360}}
        capacity_data[school] = {
            "min": min_val,
            "max": max_val
        }

    with open(OUTPUT_CAPACITY, "w", encoding="utf-8") as f:
        json.dump(capacity_data, f, ensure_ascii=False, indent=2)
    
    print(f"成功！ 学校容量データ(新構造)を作成しました: {OUTPUT_CAPACITY}")

    # --- 3. jimoto.json の生成 (新規追加) ---
    print("地元（中心地）データを生成中...")
    jimoto_data = {}
    
    # 学校ごとに、その名前が含まれる町丁目を1つ選んで「地元」とする
    # final_gdf には [小学校名, 中学校名, S_NAME, 町キー] が入っている
    for school in sorted(list(all_schools)):
        if "小学校" in school:
            matched_towns = final_gdf[final_gdf["小学校名"] == school]
        elif "中学校" in school:
            matched_towns = final_gdf[final_gdf["中学校名"] == school]
        else:
            continue
        
        if not matched_towns.empty:
            # 2. その中から代表として最初の1つを選択
            first_row = matched_towns.iloc[0]
            sho_name = first_row["小学校名"]
            chu_name = first_row["中学校名"] if pd.notnull(first_row["中学校名"]) else "不明中学校"
            
            # 3. 指定のフォーマット "小学校-中学校-町名" で登録
            full_key = first_row["町キー"]
            jimoto_data[school] = full_key
        else:
            # 万が一見つからない場合のフォールバック
            if "小学校" in school:
                jimoto_data[school] = f"{school}-不明中学校-中心町"
            else:
                jimoto_data[school] = f"不明小学校-{school}-中心町"

    with open(OUTPUT_JIMOTO, "w", encoding="utf-8") as f:
        json.dump(jimoto_data, f, ensure_ascii=False, indent=2)
    
    print(f"成功！ 地元データを作成しました: {OUTPUT_JIMOTO}")

    # --- 4. distance.json の生成 (新規追加) ---
    print("距離行列データを生成中...")
    
    # 学校の位置情報を読み込む
    if not SCHOOLS_GEOJSON.exists():
        print(f"警告: {SCHOOLS_GEOJSON} が見つからないため、距離計算をスキップします。先に generate_schools_base.py を実行してください。")
        return

    gdf_schools = gpd.read_file(SCHOOLS_GEOJSON)
    distance_data = {}

    # 距離計算用に平面直角座標系（生駒市付近は EPSG:6674）へ投影
    # 度単位(4326)ではなくメートル単位で計算するため
    gdf_town_proj = final_gdf.to_crs(epsg=6674)
    gdf_sch_proj = gdf_schools.to_crs(epsg=6674)

    # 町丁目（重心）と学校のすべての組み合わせで距離を算出
    for _, town_row in gdf_town_proj.iterrows():
        town_name = town_row["S_NAME"] if town_row["S_NAME"] else f"地区_{_}"
        sho_name = town_row["小学校名"] if pd.notnull(town_row["小学校名"]) else "不明小学校"
        chu_name = town_row["中学校名"] if pd.notnull(town_row["中学校名"]) else "不明中学校"
        
        # 町丁目のフルキー (CSVの町丁目名と一致させる)
        town_key = town_row["町キー"]
        
        # 町丁目の重心を取得
        town_point = town_row.geometry.centroid

        for _, sch_row in gdf_sch_proj.iterrows():
            target_school_name = sch_row["name"]
            
            # 学校の地点を取得
            sch_point = sch_row.geometry
            
            # 距離計算 (メートル -> キロメートル)
            dist_km = town_point.distance(sch_point) / 1000.0
            
            # キー構成: "町丁目フルキー-対象学校名"
            combined_key = f"{town_key}-{target_school_name}"
            distance_data[combined_key] = round(dist_km, 2)

    with open(OUTPUT_DISTANCE, "w", encoding="utf-8") as f:
        json.dump(distance_data, f, ensure_ascii=False, indent=2)
    
    print(f"成功！ 距離行列データを作成しました: {OUTPUT_DISTANCE}")

if __name__ == "__main__":
    main()
