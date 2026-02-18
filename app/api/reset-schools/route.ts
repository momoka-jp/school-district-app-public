import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { loadAppConfig, resolveDataPath } from "@/lib/app-config";

export async function POST() {
  try {
    const config = loadAppConfig()
    const originalSchoolsPath = resolveDataPath(config.schools_original_filename)
    const workingSchoolsPath = resolveDataPath(config.schools_filename)

    await fs.access(originalSchoolsPath)
    await fs.copyFile(originalSchoolsPath, workingSchoolsPath)

    console.log(`✅ 学校データをリセットしました: ${originalSchoolsPath} -> ${workingSchoolsPath}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("学校データのリセットに失敗しました:", error);
    return NextResponse.json(
      { success: false, error: "学校データのリセットに失敗しました" },
      { status: 500 }
    );
  }
}
