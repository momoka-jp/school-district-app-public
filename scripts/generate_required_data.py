import geopandas as gpd
import pandas as pd
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

SCHOOLS_GEOJSON = resolve_path(config["schools_base_filename"])

# =========================
# 出力ファイル
# =========================

OUTPUT_DISTANCE = resolve_path(config["distance_filename"])
OUTPUT_JIMOTO = resolve_path(config["jimoto_filename"])

LOCAL_EPSG = config["local_epsg"]


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

    print(f"--- {city_name}必須データ生成開始 ---")

    final_gdf = build_final_gdf()

    # =========================
    # jimoto.json
    # =========================

    all_schools = set(final_gdf["小学校名"].dropna().tolist())
    all_schools.update(final_gdf["中学校名"].dropna().tolist())

    jimoto_data = {}

    for school in sorted(list(all_schools)):

        if "小学校" in school:
            matched = final_gdf[final_gdf["小学校名"] == school]
        else:
            matched = final_gdf[final_gdf["中学校名"] == school]

        if not matched.empty:
            first_row = matched.iloc[0]
            jimoto_data[school] = first_row["町キー"]

    with open(OUTPUT_JIMOTO, "w", encoding="utf-8") as f:
        json.dump(jimoto_data, f, ensure_ascii=False, indent=2)

    print("jimoto.json 作成完了")

    # =========================
    # distance.json
    # =========================

    if not SCHOOLS_GEOJSON.exists():

        print("schools_base.geojson が存在しないため距離計算をスキップ")

        return

    gdf_schools = gpd.read_file(SCHOOLS_GEOJSON)

    distance_data = {}

    gdf_town_proj = final_gdf.to_crs(epsg=LOCAL_EPSG)
    gdf_sch_proj = gdf_schools.to_crs(epsg=LOCAL_EPSG)

    for _, town_row in gdf_town_proj.iterrows():

        town_key = town_row["町キー"]

        town_point = town_row.geometry.centroid

        for _, sch_row in gdf_sch_proj.iterrows():

            school_name = sch_row["name"]

            sch_point = sch_row.geometry

            dist_km = town_point.distance(sch_point) / 1000.0

            key = f"{town_key}-{school_name}"

            distance_data[key] = round(dist_km, 2)

    with open(OUTPUT_DISTANCE, "w", encoding="utf-8") as f:
        json.dump(distance_data, f, ensure_ascii=False, indent=2)

    print("distance.json 作成完了")


if __name__ == "__main__":
    main()
