import { type NextRequest, NextResponse } from "next/server"
import { resolveFlaskEndpoint } from "@/lib/flask-url"

const FLASK_GENERATE_LP_URL = resolveFlaskEndpoint("/generate_lp")

export async function POST(request: NextRequest) {
  try {
    console.log("最適化リクエストを受信しました")

    // リクエストボディからデータを取得
    const data = await request.json()

    const district = data.districtData ?? data.district
    const schools  = data.schoolData   ?? data.schools
    const selectedMode: "Name_1" | "Name_2" | undefined =
      data.selectedMode ??
      (data.mode === "elementary"
        ? "Name_1"
        : data.mode === "middle"
        ? "Name_2"
        : undefined)

    const year: number = data.selectedYear ?? data.year ?? 2024

    const penalty_plus: number | undefined = data.penalty_plus ?? data.penaltyPlus
    const penalty_minus: number | undefined = data.penalty_minus ?? data.penaltyMinus

    const time_limit_sec: number | undefined = data.time_limit_sec ?? data.timeLimitSec
    const mip_gap: number | undefined = data.mip_gap ?? data.mipGap

    console.log("受信データ(正規化後):", {
      districtCount: district?.features?.length,
      schoolCount: schools?.features?.length,
      selectedMode,
      year,
      time_limit_sec,
      mip_gap
    })

    // データの検証
    if (!district?.features || !Array.isArray(district.features)) {
      throw new Error("地区データが不正です")
    }
    if (!schools?.features || !Array.isArray(schools.features)) {
      throw new Error("学校データが不正です")
    }
    if (!selectedMode) {
      throw new Error("selectedMode/mode が指定されていません")
    }

    // Flask に渡す mode を決定
    const mode = selectedMode === "Name_1" ? "elementary" : "middle"
    console.log("最適化モード:", mode)

    // locked_assignments を初期化（空オブジェクトまたはデータから取得）
    const locked_assignments = data.locked_assignments ?? data.lockedAssignments ?? {}

    const flaskRequestData = {
      district,
      schools,
      mode,
      year,
      penalty_plus,
      penalty_minus,
      time_limit_sec,
      mip_gap,
      locked_assignments,
      selected_town_ids: data.selected_town_ids ?? data.selectedTownIds ?? [],
      range_mode: data.range_mode ?? data.rangeMode ?? "fix",
      force_close_schools: data.force_close_schools ?? data.forceCloseSchools ?? [],
      force_open_schools:  data.force_open_schools  ?? data.forceOpenSchools  ?? [],
    }

    console.log("Flaskサーバーにリクエストを送信中...")

    // Flaskサーバーにリクエストを送信
    const response = await fetch(FLASK_GENERATE_LP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(flaskRequestData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Flaskサーバーエラー:", response.status, errorText)
      throw new Error(`Flaskサーバーエラー: ${response.status} - ${errorText}`)
    }

    // レスポンスを解析
    const flaskResult = await response.json()
    console.log("Flaskサーバーからの応答を受信:", {
      status: flaskResult.status,
      hasResult: !!flaskResult.result,
      objective: flaskResult.result?.objective,
      optimizationTime: flaskResult.result?.optimization_time,
      statistics: flaskResult.result?.statistics,
    })

    if (flaskResult.status !== "success") {
      throw new Error(flaskResult.message || "Flaskサーバーで最適化に失敗しました")
    }

    const optimizationResult = flaskResult.result

    if (!optimizationResult || !optimizationResult.optimized_assignments) {
      throw new Error("最適化結果が不正です")
    }

    // 最適化結果を地区データに統合
    console.log("最適化結果を地区データに統合中...")
    const optimizedDistrictData = await processOptimizationResults(
      district,
      schools,
      optimizationResult,
      selectedMode,
    )

    console.log("最適化結果の処理完了")

    return NextResponse.json({
      success: true,
      flaskResult,
      optimizedData: optimizedDistrictData,
      gurobiInfo: {
        solver: "Gurobi",
        status: optimizationResult.status,
        objective: optimizationResult.objective,
        optimizationTime: optimizationResult.optimization_time,
        statistics: optimizationResult.statistics,
      },
      message: "最適化計算が完了",
    })
  } catch (error) {
    console.error("最適化計算中にエラーが発生:", error)
    return NextResponse.json(
      {
        success: false,
        error: "最適化計算に失敗: " + (error instanceof Error ? error.message : "不明なエラー"),
      },
      { status: 500 },
    )
  }
}

// 最適化結果を処理する関数
async function processOptimizationResults(
  districtData: any,
  schoolData: any,
  optimizationResult: any,
  selectedMode: string,
): Promise<any> {
  try {
    console.log("最適化結果の処理を開始:", {
      districts: districtData.features.length,
      optimizedAssignments: {
        sho: Object.keys(optimizationResult.optimized_assignments?.sho || {}).length,
        chu: Object.keys(optimizationResult.optimized_assignments?.chu || {}).length,
      },
    })

    // 地区データのディープコピーを作成
    const updatedDistrictData = JSON.parse(JSON.stringify(districtData))

    // 最適化結果から割り当て情報を取得
    const shoAssignments = optimizationResult.optimized_assignments?.sho || {}
    const chuAssignments = optimizationResult.optimized_assignments?.chu || {}

    console.log("割り当て情報:", {
      shoAssignments: Object.keys(shoAssignments).length,
      chuAssignments: Object.keys(chuAssignments).length,
    })

    // 地区データに最適化結果を適用
    let updatedCount = 0
    updatedDistrictData.features.forEach((feature: any) => {
      // optimizedDistrictsプロパティを初期化
      if (!feature.properties.optimizedDistricts) {
        feature.properties.optimizedDistricts = {
          Name_1: feature.properties.editedDistricts?.Name_1 || feature.properties.Name_1 || "",
          Name_2: feature.properties.editedDistricts?.Name_2 || feature.properties.Name_2 || "",
        }
      }

      // 地区の識別子を取得（複数の可能性を試す）
      const districtId = feature.properties.id || feature.properties.name || feature.properties.Name_1

      if (selectedMode === "Name_1" && shoAssignments[districtId]) {
        // 小学校の割り当てを適用
        feature.properties.optimizedDistricts.Name_1 = shoAssignments[districtId]
        updatedCount++
        // console.log(`📍 地区 ${districtId} -> 小学校 ${shoAssignments[districtId]}`)
      }

      if (selectedMode === "Name_2" && chuAssignments[districtId]) {
        // 中学校の割り当てを適用
        feature.properties.optimizedDistricts.Name_2 = chuAssignments[districtId]
        updatedCount++
        // console.log(`📍 地区 ${districtId} -> 中学校 ${chuAssignments[districtId]}`)
      }
    })

    console.log(`${updatedCount}件の地区に最適化結果を適用しました`)

    if (updatedCount === 0) {
      console.warn("最適化結果が地区データに適用されませんでした")
      console.log("デバッグ情報:")
      console.log(
        "- 地区ID例:",
        updatedDistrictData.features.slice(0, 3).map((f: any) => ({
          id: f.properties.id,
          name: f.properties.name,
          Name_1: f.properties.Name_1,
        })),
      )
      console.log("- 割り当て例:", Object.keys(selectedMode === "Name_1" ? shoAssignments : chuAssignments).slice(0, 3))
    }

    return updatedDistrictData
  } catch (error) {
    console.error("最適化結果の処理中にエラー:", error)
    throw new Error("最適化結果の処理に失敗: " + (error instanceof Error ? error.message : "不明なエラー"))
  }
}
