import { NextResponse } from "next/server";
import fs from "fs";
import { loadAppConfig, resolveDataPath } from "@/lib/app-config";

// *** 🚨 強力な正規化関数（スペース、ハイフン、特殊文字をさらに除去） ***
function normalizeName(name: string): string {
  return name
    // 最初に目に見えない特殊な文字（ゼロ幅スペース等）を全て除去
    .replace(/[\u200B-\u200F\uFEFF]/g, "") 
    // 全角・半角統一 (NFKCは「ヶ」を統一しないため、手動置換と組み合わせる)
    .normalize("NFKC")      
    // --- ヶ/ケ/ツ の統一（既存の揺れ） ---
    .replace(/ヶ/g, "ケ")   // 小さいヶ → ケ
    .replace(/ｹ/g, "ケ")    // 半角ケ → ケ
    .replace(/ッ/g, "ツ")   // 小さいッ → ツ
    .replace(/っ/g, "ツ")   // ひらがなっ → ツ
    
    // --- 追加の記号の除去/統一（問題の原因になりやすい文字） ---
    // 長音記号、全角・半角のハイフン、ダッシュを全て除去
    .replace(/ー|―|-|‐/g, "")     
    // 全角・半角の括弧を除去（例：(閉校)など）
    .replace(/[()（）]/g, "")
    // 全角・半角のスペースを全て削除
    .replace(/\s+/g, "")    
    .trim();
}

export async function GET() {
  console.log("==================================================");
  console.log("--- 🚀 /api/merge-schools デバッグ開始 ---");
  const config = loadAppConfig()

  // 1. 読み込み元：config.json の schools_base_filename を使用
  const baseGeoJSON = JSON.parse(
    fs.readFileSync(resolveDataPath(config.schools_base_filename), "utf8")
  );

  // 2. config 内の school_capacity_filename を使ってパスを組み立てる
  const capacityPath = resolveDataPath(config.school_capacity_filename);

  console.log(`--- capacity 読み込みパス: ${capacityPath} ---`);

  const capacity = JSON.parse(
    fs.readFileSync(capacityPath, "utf8")
  );

  const normalizedCapacity: { [key: string]: any } = {};
  
  // 1. capacity.json のキーを正規化して新しいオブジェクトを作成
  console.log("--- capacity.json キーの正規化結果 ---");
  for (const key in capacity) {
    if (Object.prototype.hasOwnProperty.call(capacity, key)) {
      const normalizedKey = normalizeName(key);
      normalizedCapacity[normalizedKey] = capacity[key];
      
      // デバッグ出力（「ヶ瀬」または「登美」を含むものに絞る）
      if (key.includes("ヶ瀬") || key.includes("登美")) {
         console.log(`Original: [${key}] -> Normalized: [${normalizedKey}]`);
      }
    }
  }

  // 2. GeoJSON側の学校名を正規化し、結合を試みる
  const mergedFeatures = baseGeoJSON.features
    .map((f: any) => {
      const originalName = f.properties.name;
      const normalized = normalizeName(originalName);
      const cap = normalizedCapacity[normalized] || null;

      // cap が見つからない場合は null を返し、後で filter で除去する
      if (!cap) {
        console.log(`⚠️ 除外（キャパデータなし）: [${originalName}]`);
        return null;
      }

      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          name: originalName,
          isClosed: false,
          min_students: cap.min, // ここで確実に数値が入る
          max_students: cap.max,
        }
      };
    })
    .filter((f: any) => f !== null); // ❌ マージ失敗した学校を除去


  const merged = {
    type: "FeatureCollection",
    features: mergedFeatures
  };

  const mergedJson = JSON.stringify(merged, null, 2);

  // 3. 書き出し先：config.json の schools_filename / schools_original_filename を使用
  fs.writeFileSync(resolveDataPath(config.schools_filename), mergedJson);
  fs.writeFileSync(resolveDataPath(config.schools_original_filename), mergedJson);
  
  console.log("--- ✅ デバッグ終了: schools.geojson を更新しました ---");
  console.log("==================================================");

  return NextResponse.json({ success: true });
}
