// app/api/district-data/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import { loadAppConfig, resolveDataPath } from "@/lib/app-config";

export async function GET() {
  try {
    const config = loadAppConfig()
    const filePath = resolveDataPath(config.merged_with_students_filename)

    if (!fs.existsSync(filePath)) {
      console.error(`ファイルが見つかりません: ${filePath}`);
      return NextResponse.json({ error: "町丁データ (GeoJSON) が生成されていません" }, { status: 404 });
    }

    const fileData = fs.readFileSync(filePath, "utf8");
    const jsonData = JSON.parse(fileData);

    // 2. フロントエンドに CSV の正確な場所を伝えるための情報を追加
    jsonData.students_csv_path = config.students_csv_filename;

    return NextResponse.json(jsonData);
  } catch (error) {
    console.error("データの読み込みに失敗しました:", error);
    return NextResponse.json({ error: "データの読み込みに失敗しました" }, { status: 500 });
  }
}
