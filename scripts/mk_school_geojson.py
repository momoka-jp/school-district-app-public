import csv
import json
from pathlib import Path

def csv_to_geojson(csv_file, geojson_file):
    features = []
    
    with open(csv_file, newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # ヘッダーをスキップ
        
        for row in reader:
            name = row[0]  # 1カラム目: 学校名
            try:
                lat = float(row[2])  # 3カラム目: 緯度
                lon = float(row[3])  # 4カラム目: 経度
                max_students = float(row[4]) if row[4] else None  # 6カラム目: 適正児童生徒数上限
                min_students = float(row[5]) if row[5] else None  # 5カラム目: 適正児童生徒数下限
                
                feature = {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lon, lat]
                    },
                    "properties": {
                        "name": name,
                        # "lat": lat,
                        # "lon": lon,
                        "min_students": min_students,
                        "max_students": max_students
                    }
                }
                features.append(feature)
            except ValueError:
                print(f"無効な座標値: {row}")
    
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(geojson_file, 'w', encoding='utf-8') as f:
        json.dump(geojson, f, ensure_ascii=False, indent=4)
    
    print(f"GeoJSONファイルが作成されました: {geojson_file}")

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "public" / "data"

def load_config():
    config_path = DATA_DIR / "config.json"
    if not config_path.exists():
        return {}
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)

def resolve_data_path(key, default_name, cfg):
    filename = cfg.get(key, default_name)
    path = Path(filename)
    resolved = path if path.is_absolute() else DATA_DIR / path
    resolved.parent.mkdir(parents=True, exist_ok=True)
    return resolved

config = load_config()

csv_to_geojson(
    resolve_data_path("schools_csv_filename", "schools.csv", config),
    resolve_data_path("schools_filename", "schools.geojson", config),
)
