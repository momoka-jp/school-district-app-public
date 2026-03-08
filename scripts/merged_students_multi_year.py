# scripts/merged_students_multi_year.py
"""
小中町丁目別学校区別学齢別性別集計.csv を読み込み，
年度ごとの児童数・生徒数（num_shoYYYY, num_chuYYYY）を
merged.geojson にマージして merged_with_students.geojson を出力するスクリプトである．

前提：
- CSV: public/data/p29/29201/小中町丁目別学校区別学齢別性別集計.csv
    - 2行目がヘッダ（header=1）
    - 4列目（0始まり index=3）が「町丁目名」で，
      例: 富雄南小学校-富雄南中学校-青垣台一丁目
- GeoJSON: public/data/output/merged.geojson
    - properties.name が上記と同じ文字列になっている
"""

from pathlib import Path
import re
import json
from config_loader import load_config

import geopandas as gpd
import pandas as pd

def lookup_city_code(prefecture, city):
    codes_path = DATA_DIR / "city_codes.csv"
    if not codes_path.exists():
        return None
    try:
        import csv
        with open(codes_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            header_text = config.get("city_code_csv_header_text", "行政区域コード")
            for row in reader:
                if row and row[0] == header_text:
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

# ===== パス設定の基本 =====
BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "public" / "data"

config = load_config(write_back=True)

def resolve_output_path(key, default_name):
    filename = config.get(key, default_name).replace("output/", "")
    path = DATA_DIR / "output" / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    return path

# 読み込み元のCSVは config の students_csv_filename をそのまま使用
CSV_PATH = DATA_DIR / config.get("students_csv_filename")

# 生成データ（GeoJSON）は一貫して output フォルダを参照
GEOJSON_IN = DATA_DIR / "output" / config.get("merged_geojson_filename", "merged.geojson").replace("output/", "")
GEOJSON_OUT = resolve_output_path("merged_with_students_filename", "merged_with_students.geojson")
AVAILABLE_YEARS_JSON = resolve_output_path("available_years_filename", "available_years.json")


def load_students_csv(csv_path: Path):
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV が見つからない: {csv_path}")

    df = pd.read_csv(
        csv_path,
        encoding="utf-8-sig",
        engine="python",
        header=[0, 1],
    ).dropna(how="all")

    # 町丁目名列を探す（下段ヘッダを見て判定）
    town_col = None
    for col in df.columns:
        upper, lower = col
        if str(lower).strip() == "町丁目名":
            town_col = col
            break
    if town_col is None:
        raise KeyError("CSV に『町丁目名』列が見つからない")

    year_re = re.compile(r"(20\d{2})")

    sho_cols = {}
    chu_cols = {}

    # 上段ヘッダを前方埋めする
    last_group = None
    for col in df.columns:
        group_raw, year_label = col
        group_str = str(group_raw).strip()
        if group_str.startswith("Unnamed:"):
            group_str = last_group  # 直前のグループ名を継承
        else:
            last_group = group_str

        m = year_re.search(str(year_label))
        if not m:
            continue
        y = int(m.group(1))

        if group_str == "児童数":
            sho_cols[y] = col
        elif group_str == "生徒数":
            chu_cols[y] = col

    years = sorted(set(sho_cols).intersection(chu_cols))
    if not years:
        raise ValueError("児童数／生徒数の年度列が見つからない")

    print("=== CSV 列マッピング ===")
    print(f"町丁目名列: {town_col}")
    print("児童数列:")
    for y in years:
        print(f"  {y}: {sho_cols[y]}")
    print("生徒数列:")
    for y in years:
        print(f"  {y}: {chu_cols[y]}")

    out = pd.DataFrame()
    out["name"] = df[town_col].astype(str).str.strip()

    for y in years:
        out[f"num_sho{y}"] = (
            pd.to_numeric(df[sho_cols[y]], errors="coerce")
            .fillna(0.0)
            .astype(float)
        )
        out[f"num_chu{y}"] = (
            pd.to_numeric(df[chu_cols[y]], errors="coerce")
            .fillna(0.0)
            .astype(float)
        )

    out["key"] = out["name"].astype(str).str.strip()
    return out, years


def merge_to_geojson(geojson_in: Path, geojson_out: Path, students_df: pd.DataFrame, years):
    """
    merged.geojson に CSV からの人数データをマージし，
    merged_with_students.geojson を出力する．
    """

    if not geojson_in.exists():
        raise FileNotFoundError(f"GeoJSON が見つからない: {geojson_in}")

    gdf = gpd.read_file(geojson_in)

    if "name" not in gdf.columns:
        raise KeyError("GeoJSON 側に 'name' 列が見つからない（properties.name が name に展開されていない可能性がある）")

    # GeoJSON側のキー
    gdf["key"] = gdf["name"].astype(str).str.strip()

    # CSV 側のキーも念のため strip 済みにしておく
    students_df = students_df.copy()
    students_df["key"] = students_df["key"].astype(str).str.strip()

    print(f"GeoJSON features: {len(gdf)}")
    print(f"CSV rows       : {len(students_df)}")

    # name は GeoJSON 側を正とするので CSV 側の name 列は落としてマージする
    merged = gdf.merge(
        students_df.drop(columns=["name"]),
        on="key",
        how="left",
    )

    # NaN を 0 にしておく（対象外地区などで人数が付かなかった場合）
    for y in years:
        sho_col = f"num_sho{y}"
        chu_col = f"num_chu{y}"
        if sho_col in merged.columns:
            merged[sho_col] = merged[sho_col].fillna(0.0).astype(float)
        if chu_col in merged.columns:
            merged[chu_col] = merged[chu_col].fillna(0.0).astype(float)

    # デバッグ用に先頭数行を少し表示
    print("=== マージ後サンプル ===")
    print(
        merged[
            ["name", "key"]
            + [f"num_sho{years[0]}", f"num_chu{years[0]}"]
        ]
        .head()
        .to_string(index=False)
    )

    # 出力
    merged.to_file(geojson_out, driver="GeoJSON")
    print(f"書き出し完了: {geojson_out}")


def main():
    print("=== 生徒数マージスクリプト開始 ===")
    print(f"CSV       : {CSV_PATH}")
    print(f"GEOJSON in: {GEOJSON_IN}")
    print(f"GEOJSON out: {GEOJSON_OUT}")

    students_df, years = load_students_csv(CSV_PATH)
    print(f"年度リスト: {years}")

    # 1) GeoJSON にマージ
    merge_to_geojson(GEOJSON_IN, GEOJSON_OUT, students_df, years)

    # 2) available_years.json を出力
    payload = {"years": years}
    with open(AVAILABLE_YEARS_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"年度一覧を書き出し: {AVAILABLE_YEARS_JSON}")

    print("=== 完了 ===")


if __name__ == "__main__":
    main()
