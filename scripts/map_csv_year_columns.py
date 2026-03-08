import re
from pathlib import Path
import pandas as pd
from config_loader import load_config

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "public" / "data"

def resolve_data_path(key, default_name, cfg):
    filename = cfg.get(key, default_name)
    path = Path(filename)
    return path if path.is_absolute() else DATA_DIR / path

config = load_config(write_back=False)
df = pd.read_csv(resolve_data_path("map_csv_input_filename", "input.csv", config))

# 年度(YYYY)を抽出する正規表現
year_re = re.compile(r"(20\d{2})年度")

# 「児童数」「生徒数」ブロックの列を自動検出
sho_cols = {}  # {year:int(col_index)}
chu_cols = {}

for col in df.columns:
    m = year_re.search(col)
    if not m:
        continue
    y = int(m.group(1))
    if "児童数" in col:
        sho_cols[y] = col
    elif "生徒数" in col:
        chu_cols[y] = col

years = sorted(set(sho_cols).intersection(chu_cols))  # 2025..2031 の共通年
