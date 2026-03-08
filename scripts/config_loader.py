import csv
import json
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "public" / "data"
CONFIG_PATH = DATA_DIR / "config.json"
CITY_CODES_PATH = DATA_DIR / "city_codes.csv"

CITY_CODE_KEYS = [
    "schools_base_source_dir",
    "elementary_districts_filename",
    "middle_districts_filename",
    "students_csv_filename",
    "school_capacity_filename",
    "distance_filename",
    "jimoto_filename",
    "town_topo_filename",
    "town_boundaries_filename",
    "schools_csv_filename",
]


def _read_json(path: Path):
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, payload: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def lookup_city_code(prefecture: str, city: str, header_text: str):
    if not CITY_CODES_PATH.exists():
        return None
    with open(CITY_CODES_PATH, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            if row and row[0] == header_text:
                break
        for row in reader:
            if len(row) <= 2:
                continue
            if row[1] == prefecture and row[2] == city:
                return row[0]
    return None


def resolve_city_code(config: dict):
    pref = str(config.get("prefecture_name") or "").strip()
    city = str(config.get("city_name") or "").strip()
    header = config.get("city_code_csv_header_text", "行政区域コード")
    if pref and city:
        resolved = lookup_city_code(pref, city, header)
        if resolved:
            return resolved
    city_code = str(config.get("city_code") or "").strip()
    if city_code:
        return city_code
    return None


def apply_code_to_path(path_str: str, pref_code: str, city_code: str) -> str:
    if not path_str:
        return path_str

    updated = path_str

    updated = re.sub(r"p\d{2}/\d{5}", f"p{pref_code}/{city_code}", updated)
    updated = re.sub(r"p\d{2}/", f"p{pref_code}/", updated)
    updated = re.sub(r"/\d{5}/", f"/{city_code}/", updated)
    updated = re.sub(r"r2ka\d{5}", f"r2ka{city_code}", updated)
    updated = re.sub(r"_\d{2}_GML", f"_{pref_code}_GML", updated)

    return updated


def normalize_config(config: dict):
    normalized = dict(config)
    city_code = resolve_city_code(normalized)
    if not city_code:
        pref = str(normalized.get("prefecture_name") or "").strip()
        city = str(normalized.get("city_name") or "").strip()
        if pref and city:
            raise RuntimeError("自治体コードを特定できません。city_codes.csv と config.json の都道府県名・市町村名を確認してください。")
        return normalized

    pref_code = city_code[:2]

    normalized["city_code"] = city_code
    normalized["prefecture_code"] = pref_code

    for key in CITY_CODE_KEYS:
        raw_value = normalized.get(key)
        if isinstance(raw_value, str):
            normalized[key] = apply_code_to_path(raw_value, pref_code, city_code)

    return normalized


def load_config(write_back: bool = False):
    raw = _read_json(CONFIG_PATH)
    normalized = normalize_config(raw)
    if write_back and normalized != raw:
        _write_json(CONFIG_PATH, normalized)
    return normalized
