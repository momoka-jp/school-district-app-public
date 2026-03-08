import geopandas as gpd
import pandas as pd
import numpy as np
import csv
import json
from pathlib import Path

# =========================
# 基本パス
# =========================

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "public" / "data"

CONFIG_PATH = DATA_DIR / "config.json"


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def resolve_path(path_str):
    path = Path(path_str)
    if path.is_absolute():
        return path
    return DATA_DIR / path


config = load_config()

# =========================
# 入力ファイル
# =========================

TOWN_TOPO = resolve_path(config["town_topo_filename"])

PATH_SHO = resolve_path(config["elementary_districts_filename"])
PATH_CHU = resolve_path(config["middle_districts_filename"])

# =========================
# 出力ファイル
# =========================

OUTPUT_CSV = resolve_path(config["students_csv_filename"])
OUTPUT_CAPACITY = resolve_path(config["school_capacity_filename"])


# =========================
# 共通処理
# =========================

def normalize_school_name(name, school_type):

    if not name:
        return ""

    if "小中学校" in name:
        base = name.replace("小中学校", "")

        if school_type == "sho":
            return f"{base}小学校"

        if school_type == "chu":
            return f"{base}中学校"

    name = name.replace("小学校", "").replace("中学校", "")

    if school_type == "sho":
        return f"{name}小学校"

    if school_type == "chu":
        return f"{name}中学校"

    return name


def build_final_gdf():

    gdf_town = gpd.read_file(TOWN_TOPO, layer="town")
    gdf_sho = gpd.read_file(PATH_SHO)
    gdf_chu = gpd.read_file(PATH_CHU)

    if gdf_town.crs is None:
        gdf_town.set_crs(epsg=4326, inplace=True)

    gdf_sho = gdf_sho.to_crs(gdf_town.crs)
    gdf_chu = gdf_chu.to_crs(gdf_town.crs)

    gdf_town_points = gdf_town.copy()
    gdf_town_points["geometry"] = gdf_town.geometry.representative_point()

    town_with_sho = gpd.sjoin(
        gdf_town_points,
        gdf_sho[[config["elementary_school_name_col"], "geometry"]],
        how="left",
        predicate="within"
    ).rename(columns={config["elementary_school_name_col"]: "小学校区"})

    if "index_right" in town_with_sho.columns:
        town_with_sho = town_with_sho.drop(columns=["index_right"])

    final_gdf = gpd.sjoin(
        town_with_sho,
        gdf_chu[[config["middle_school_name_col"], "geometry"]],
        how="left",
        predicate="within"
    ).rename(columns={config["middle_school_name_col"]: "中学校区"})

    final_gdf["小学校名"] = final_gdf["小学校区"].apply(
        lambda x: normalize_school_name(x, "sho") if pd.notnull(x) else "不明小学校"
    )

    final_gdf["中学校名"] = final_gdf["中学校区"].apply(
        lambda x: normalize_school_name(x, "chu") if pd.notnull(x) else "不明中学校"
    )

    final_gdf["町キー"] = (
        final_gdf["小学校名"].astype(str)
        + "-"
        + final_gdf["中学校名"].astype(str)
        + "-"
        + final_gdf[config["town_name_col"]].fillna("").astype(str)
    )

    duplicate_index = final_gdf.groupby("町キー").cumcount()
    has_suffix = duplicate_index > 0

    final_gdf.loc[has_suffix, "町キー"] = (
        final_gdf.loc[has_suffix, "町キー"]
        + "_"
        + (duplicate_index[has_suffix] + 1).astype(str)
    )

    return final_gdf


# =========================
# メイン処理
# =========================

def main():

    city_name = config["city_name"]

    print(f"--- {city_name}デモデータ生成開始 ---")

    final_gdf = build_final_gdf()

    # =========================
    # CSV生成
    # =========================

    print("CSV生成中")

    rows = []
    years = [2025, 2026, 2027, 2028, 2029, 2030, 2031]

    all_schools = set()

    for _, row in final_gdf.iterrows():

        town_name = row[config["town_name_col"]]
        sho_name = row["小学校名"]
        chu_name = row["中学校名"]

        all_schools.add(sho_name)
        all_schools.add(chu_name)

        town_key = row["町キー"]

        rate_sho = f"{np.random.uniform(88, 98):.2f}%"
        rate_chu = f"{np.random.uniform(75, 85):.2f}%"

        pop_sho = np.random.randint(5, 45, size=len(years))
        pop_chu = np.random.randint(5, 35, size=len(years))

        val_sho = [round(p * 0.95, 1) for p in pop_sho]
        val_chu = [round(p * 0.80, 1) for p in pop_chu]

        row_data = [sho_name, chu_name, town_name, town_key, rate_sho, rate_chu]

        row_data.extend(pop_sho)
        row_data.extend(pop_chu)
        row_data.extend(val_sho)
        row_data.extend(val_chu)

        rows.append(row_data)

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_CSV, "w", encoding="utf-8-sig", newline="") as f:

        writer = csv.writer(f)

        writer.writerow(
            [""] * 6
            + ["児童学齢住民数"] * 7
            + ["生徒学齢住民数"] * 7
            + ["児童数"] * 7
            + ["生徒数"] * 7
        )

        writer.writerow(
            ["小学校区", "中学校区", "町名", "町丁目名", "小学校区就学率", "中学校区就学率"]
            + [f"{y}年度" for y in years] * 4
        )

        writer.writerows(rows)

    print("CSV作成完了")

    # =========================
    # school_capacity.json
    # =========================

    capacity_data = {}

    for school in sorted(list(all_schools)):

        if "小学校" in school:
            min_val = 150
            max_val = 600
        else:
            min_val = 200
            max_val = 900

        capacity_data[school] = {
            "min": min_val,
            "max": max_val
        }

    with open(OUTPUT_CAPACITY, "w", encoding="utf-8") as f:
        json.dump(capacity_data, f, ensure_ascii=False, indent=2)

    print("school_capacity.json 作成完了")


if __name__ == "__main__":
    main()
