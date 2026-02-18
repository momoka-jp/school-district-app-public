// app/api/school-data/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import { loadAppConfig, resolveDataPath } from "@/lib/app-config";

export async function GET() {
  try {
    const config = loadAppConfig()
    const filePath = resolveDataPath(config.schools_filename)

    if (!fs.existsSync(filePath)) {
      console.warn(`ファイルが見つかりません: ${filePath}`);
      return NextResponse.json({ error: "学校データファイルが生成されていません" }, { status: 404 });
    }

    const fileData = fs.readFileSync(filePath, "utf8");
    const jsonData = JSON.parse(fileData);
    
    return NextResponse.json(jsonData);
  } catch (error) {
    console.error("データの読み込みに失敗しました:", error);
    return NextResponse.json({ error: "データの読み込みに失敗しました" }, { status: 500 });
  }
}
