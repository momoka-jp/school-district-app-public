import fs from "fs";
import path from "path";

const DATA_ROOT = path.join(process.cwd(), "public", "data");

export function loadAppConfig() {
  const configPath = path.join(DATA_ROOT, "config.json");
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

export function resolveDataPath(fileNameOrPath: string) {
  // 1. すでに絶対パスならそのまま返す
  if (path.isAbsolute(fileNameOrPath)) return fileNameOrPath;

  // 2. 生成されるGeoJSONファイル群（outputに入れるべきもの）のリスト
  const outputFiles = [
    "schools_base.geojson",
    "merged.geojson",
    "merged_with_students.geojson",
    "schools.geojson",
    "schools.original.geojson",
    "available_years.json"
  ];

  // 3. リストに含まれるファイルなら、自動的に output/ を付与する
  if (outputFiles.includes(fileNameOrPath)) {
    return path.join(DATA_ROOT, "output", fileNameOrPath);
  }

  // 4. それ以外（素材系）は data 直下として結合
  return path.join(DATA_ROOT, fileNameOrPath);
}