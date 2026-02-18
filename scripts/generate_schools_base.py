import geopandas as gpd
import json
import csv
import os
from pathlib import Path

# --- 自治体解決用ヘルパー ---
def lookup_city_code(prefecture, city, header_text, codes_path):
    if not codes_path.exists():
        return None
    with open(codes_path, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        for row in reader:
            if row and row[0] == header_text:
                break
        for row in reader:
            if len(row) > 2 and row[1] == prefecture and row[2] == city:
                return row[0]
    return None

def resolve_city_code(cfg, codes_path):
    city_code = str(cfg.get("city_code") or "").strip()
    if city_code: return city_code
    pref = str(cfg.get("prefecture_name") or "").strip()
    city = str(cfg.get("city_name") or "").strip()
    header = cfg.get("city_code_csv_header_text", "行政区域コード")
    if pref and city: return lookup_city_code(pref, city, header, codes_path)
    return None

def get_municipality_paths(config, codes_path):
    city_code = resolve_city_code(config, codes_path) 
    if not city_code:
        raise RuntimeError("自治体コードを特定できません。")
    pref_code = city_code[:2]
    base_dir = f"p{pref_code}/{city_code}"
    
    return {
        "code": city_code,
        "base_dir": base_dir
    }

# ===== パス設定 =====
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "public" / "data"
CONFIG_PATH = DATA_DIR / "config.json"
CITY_CODES_PATH = DATA_DIR / "city_codes.csv"

def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    config = load_config()
    m_info = get_municipality_paths(config, CITY_CODES_PATH)
    target_city_code = m_info["code"]

    # 出力先を強制的に output フォルダへ
    raw_filename = config.get("schools_base_filename", "schools_base.geojson")
    output_path = DATA_DIR / "output" / raw_filename.replace("output/", "")
    
    # シェープファイルの検索先（ソースディレクトリ）
    # 生駒市などの場合、ここも p29/29209/... のような構造に合わせるなら以下：
    # source_dir = DATA_DIR / m_info["base_dir"] / "shp_source" 
    source_dir = DATA_DIR / config.get("schools_base_source_dir")
    
    shp_files = list(source_dir.glob("*.shp"))
    if not shp_files:
        print(f"エラー: {source_dir} 内に .shp ファイルが見つかりません。")
        return
    shp_path = shp_files[0]

    print(f"--- 抽出開始: {config.get('city_name')} ({target_city_code}) ---")

    # 読み込み
    encoding = config.get("data_encoding", "shift_jis")
    gdf = gpd.read_file(shp_path, encoding="cp932" if encoding.lower() == "shift_jis" else encoding)

    # 1. 自治体コードでフィルタリング
    gdf = gdf[gdf["P29_001"] == target_city_code].copy()

    # 2 & 3. 属性フィルタリング
    gdf = gdf[gdf["P29_006"].astype(int).isin(config.get("target_admin_codes", [3]))]
    gdf = gdf[gdf["P29_003"].astype(int).isin(config.get("target_school_types", [16001, 16002]))]

    # 4. クレンジング
    SCHOOL_TYPE_SUFFIX = {
        16001: "小学校",
        16002: "中学校",
    }
    def clean_name(name):
        if not name:
            return ""
        table = {
            "ケ": "ヶ",
            "の": "ノ",
            "－": "-",
            "ー": "-",
            "　": "",
            " ": "",
        }
        for k, v in table.items():
            name = name.replace(k, v)
        return name.translate(str.maketrans("０１２３４５６７８９", "0123456789"))

    def make_school_names(row):
        base = clean_name(row["P29_004"])
        if not base:
            return []

        if "小中学校" in base:
            base_name = base.replace("小中学校", "")
            if not base_name:
                return []
            return [f"{base_name}小学校", f"{base_name}中学校"]

        school_type = int(row["P29_003"])
        suffix = SCHOOL_TYPE_SUFFIX.get(school_type)
        if not suffix:
            return []
        # すでに校種が付いている場合は除去
        if base.endswith("小学校"):
            base = base.removesuffix("小学校")
        elif base.endswith("中学校"):
            base = base.removesuffix("中学校")

        return [f"{base}{suffix}"]

    gdf["name_list"] = gdf.apply(make_school_names, axis=1)
    gdf = gdf[gdf["name_list"].map(len) > 0].copy()
    gdf = gdf.explode("name_list", ignore_index=True)
    gdf["name"] = gdf["name_list"].astype(str)
    gdf["isClosed"] = gdf["P29_007"].astype(int) == 1

    # 5. 書き出し
    output_gdf = gdf[["name", "isClosed", "geometry"]]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_gdf.to_file(output_path, driver="GeoJSON")
    print(f"成功: {len(output_gdf)} 校を保存 -> {output_path}")

if __name__ == "__main__":
    main()
