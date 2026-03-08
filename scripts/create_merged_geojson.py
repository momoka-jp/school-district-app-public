import geopandas as gpd
import pandas as pd
import os
import csv
from pathlib import Path
from config_loader import load_config

def get_municipality_paths(config):
    city_code = resolve_city_code(config) 
    if not city_code:
        raise RuntimeError("自治体コードを特定できません。")
    pref_code = city_code[:2]
    base_dir = f"p{pref_code}/{city_code}"
    
    return {
        "topojson": f"{base_dir}/r2ka{city_code}.topojson",
        "students": f"{base_dir}/小中町丁目別学校区別学齢別性別集計.csv",
        "capacity": f"{base_dir}/school_capacity.json",
        "distance": f"{base_dir}/distance.json",
        "jimoto": f"{base_dir}/jimoto.json"
    }

# ===== パス設定 =====
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "public" / "data"

# 1. まず設定を読み込む
config = load_config(write_back=True)

# --- 各種設定値の取得 ---
AREA_THRESHOLD = config.get("area_threshold", 0.01)
TOWN_NAME_COL = config.get("town_name_col", "S_NAME")
UNKNOWN_TEXT = config.get("unknown_school_text", "不明")
CSV_HEADER_TEXT = config.get("city_code_csv_header_text", "行政区域コード")

# --- 自治体解決用関数群 ---

def lookup_city_code(prefecture, city):
    codes_path = DATA_DIR / "city_codes.csv"
    if not codes_path.exists():
        return None
    try:
        with open(codes_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            for row in reader:
                if row and row[0] == CSV_HEADER_TEXT:
                    break
            for row in reader:
                if len(row) <= 2: continue
                if row[1] == prefecture and row[2] == city:
                    return row[0]
    except Exception:
        return None
    return None

def resolve_city_code(cfg):
    city_code = str(cfg.get("city_code") or "").strip()
    if city_code: return city_code
    pref = str(cfg.get("prefecture_name") or "").strip()
    city = str(cfg.get("city_name") or "").strip()
    if pref and city: return lookup_city_code(pref, city)
    return None

def build_town_topojson_path(city_code):
    pref_code = city_code[:2]
    # p29/29201/r2ka29201.topojson の形式に合わせる
    return f"p{pref_code}/{city_code}/r2ka{city_code}.topojson"

def resolve_town_filename(cfg):
    explicit = cfg.get("town_boundaries_filename")
    if explicit: return explicit
    city_code = resolve_city_code(cfg)
    if city_code: return build_town_topojson_path(city_code)
    raise RuntimeError("町丁目データの解決に失敗しました。config.jsonの市町村名を確認してください。")

def resolve_data_path(key, default_val):
    filename = config.get(key, default_val)
    if not filename: return None
    path = Path(filename)
    return path if path.is_absolute() else DATA_DIR / path

# --- パス解決部分を以下に差し替え ---
def resolve_output_path(key, default_val):
    # configから取得した値から "output/" を除去し、強制的に output フォルダへ配置
    raw_filename = config.get(key, default_val)
    filename = raw_filename.replace("output/", "")
    out_path = DATA_DIR / "output" / filename
    out_path.parent.mkdir(parents=True, exist_ok=True) 
    return out_path

m_info = get_municipality_paths(config)

# パス変数
PATH_SHO = resolve_data_path("elementary_districts_filename", "")
PATH_CHU = resolve_data_path("middle_districts_filename", "")
PATH_TOWN = DATA_DIR / resolve_town_filename(config)

PATH_TOWN = DATA_DIR / m_info["topojson"]

OUTPUT_PATH = resolve_output_path("merged_geojson_filename", "merged.geojson")

TOWN_LAYER = config.get("town_boundaries_layer", "town")
LOCAL_EPSG = config.get("local_epsg", 6674) 
COL_SHO_NAME = config.get("elementary_school_name_col", "A27_004")
COL_CHU_NAME = config.get("middle_school_name_col", "A32_004")

def main():
    print(f"--- 処理開始 ---")
    print(f"ターゲット: {config.get('prefecture_name')}{config.get('city_name')}")
    print(f"使用EPSG: {LOCAL_EPSG}")

    # データの読み込み
    gdf_sho = gpd.read_file(PATH_SHO)
    gdf_chu = gpd.read_file(PATH_CHU)
    gdf_town = gpd.read_file(PATH_TOWN, layer=TOWN_LAYER)

    if gdf_town.crs is None:
        gdf_town.set_crs(epsg=4326, inplace=True)

    gdf_sho = gdf_sho.to_crs(gdf_town.crs)
    gdf_chu = gdf_chu.to_crs(gdf_town.crs)

    # 1. 面積の計算
    town_projected = gdf_town.to_crs(epsg=LOCAL_EPSG)
    gdf_town["area"] = town_projected.geometry.area / 1e6

    # 2. 面積によるフィルタリング
    initial_count = len(gdf_town)
    gdf_town = gdf_town[gdf_town["area"] >= AREA_THRESHOLD].copy()
    print(f"面積フィルタリング完了: {initial_count - len(gdf_town)} 区画を削除")

    # 3. 重心の計算と補正
    projected_geometry = gdf_town.to_crs(epsg=LOCAL_EPSG).geometry
    centroids = projected_geometry.centroid.to_crs(gdf_town.crs)
    rep_points = projected_geometry.representative_point().to_crs(gdf_town.crs)
    gdf_town["centroid_x"] = centroids.x
    gdf_town["centroid_y"] = centroids.y

    for i, row in gdf_town.iterrows():
        if not row.geometry.contains(centroids[i]):
            gdf_town.at[i, "centroid_x"] = rep_points[i].x
            gdf_town.at[i, "centroid_y"] = rep_points[i].y

    # 4. 空間結合
    gdf_town["temp_point"] = gpd.points_from_xy(gdf_town.centroid_x, gdf_town.centroid_y, crs=gdf_town.crs)
    
    town_with_sho = gpd.sjoin(
        gdf_town.set_geometry("temp_point"), 
        gdf_sho[[COL_SHO_NAME, 'geometry']], 
        how="left", 
        predicate="within"
    ).rename(columns={COL_SHO_NAME: 'Name_1'})

    if 'index_right' in town_with_sho.columns:
        town_with_sho = town_with_sho.drop(columns=['index_right'])

    merged_gdf = gpd.sjoin(
        town_with_sho, 
        gdf_chu[[COL_CHU_NAME, 'geometry']], 
        how="left", 
        predicate="within"
    ).rename(columns={COL_CHU_NAME: 'Name_2'})

    # 5. プロパティの整形
    print("最終データを整形中...")
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
        if school_type == "chu":
            return f"{name}中学校"
        return name

    merged_gdf['Name_1'] = merged_gdf['Name_1'].fillna(f"{UNKNOWN_TEXT}小学校").apply(
        lambda x: normalize_school_name(x, "sho") if pd.notnull(x) else f"{UNKNOWN_TEXT}小学校"
    )
    merged_gdf['Name_2'] = merged_gdf['Name_2'].fillna(f"{UNKNOWN_TEXT}中学校").apply(
        lambda x: normalize_school_name(x, "chu") if pd.notnull(x) else f"{UNKNOWN_TEXT}中学校"
    )
    
    # 町名カラム名をconfigから取得
    merged_gdf["name"] = merged_gdf['Name_1'] + "-" + merged_gdf['Name_2'] + "-" + merged_gdf[TOWN_NAME_COL]
    
    duplicate_index = merged_gdf.groupby("name").cumcount()
    has_suffix = duplicate_index > 0
    merged_gdf.loc[has_suffix, "name"] = merged_gdf.loc[has_suffix, "name"] + "_" + (duplicate_index[has_suffix] + 1).astype(str)
    merged_gdf["id"] = merged_gdf["name"]

    merged_gdf = merged_gdf.set_geometry("geometry")
    final_cols = ["name", "area", "id", "Name_1", "Name_2", "centroid_x", "centroid_y", "geometry"]
    output_gdf = merged_gdf[final_cols]

    # 6. 書き出し
    if os.path.exists(OUTPUT_PATH):
        os.remove(OUTPUT_PATH)
    output_gdf.to_file(OUTPUT_PATH, driver="GeoJSON")
    print(f"成功！ {OUTPUT_PATH} を作成しました。")

if __name__ == "__main__":
    main()
