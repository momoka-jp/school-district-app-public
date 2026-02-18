import type {
  GeoJSONData,
  SchoolGeoJSONData,
  OptimizeOptions,
  SchoolOptimizationOption,
} from "@/types/map-types"

export interface OptimizationApiResult {
  success: boolean
  optimizedData?: GeoJSONData
  flaskResult?: unknown
  gurobiInfo?: unknown
  message?: string
  error?: string
  [key: string]: unknown
}

const ensureEligibility = (feature: GeoJSONData["features"][number]) => {
  const eligibility = feature?.properties?.optimizationEligibility
  if (!eligibility) {
    feature.properties = feature.properties || {}
    feature.properties.optimizationEligibility = { Name_1: true, Name_2: true }
    return feature.properties.optimizationEligibility
  }
  if (eligibility.Name_1 === undefined) eligibility.Name_1 = true
  if (eligibility.Name_2 === undefined) eligibility.Name_2 = true
  return eligibility
}

export const runOptimization = async (
  districtData: GeoJSONData,
  schoolData: SchoolGeoJSONData,
  selectedMode: "Name_1" | "Name_2",
  selectedYear: number,
  options?: OptimizeOptions, // ← ここを penalties から改名＆拡張
): Promise<OptimizationApiResult> => {
  console.log("最適化計算を開始します")

  const penaltyPlus   = Number.isFinite(options?.penaltyPlus)  ? Number(options!.penaltyPlus)  : 100;
  const penaltyMinus  = Number.isFinite(options?.penaltyMinus) ? Number(options!.penaltyMinus) : 100;
  const timeLimitSec0 = Number.isFinite(options?.timeLimitSec) ? Number(options!.timeLimitSec) : 60;
  const mipGap0       = Number.isFinite(options?.mipGap)       ? Number(options!.mipGap)       : 0.80;

  const timeLimitSec = Math.max(1, Math.floor(timeLimitSec0)); // >=1秒に丸め
  const mipGap = Math.min(1, Math.max(0, mipGap0));            // 0〜1 にクリップ
  const rangeMode: "fix" | "exclude" = options?.rangeMode === "exclude" ? "exclude" : "fix"
  const providedTownIds = options?.selectedTownIds
  const lockedTownIdSet = new Set(options?.lockedTownIds ?? [])
  const availableTownIds = districtData.features
    .map((feature: GeoJSONData["features"][number]) => feature?.properties?.id)
    .filter((id: GeoJSONData["features"][number]["properties"]["id"]): id is string => typeof id === "string" && id.length > 0)
  const selectedTownIdSet = new Set(
    providedTownIds !== undefined ? providedTownIds : availableTownIds,
  )

  // 固定対象も最適化対象セットへ含める
  lockedTownIdSet.forEach((id) => selectedTownIdSet.add(id))

  const allowedOptions: SchoolOptimizationOption[] = ["default", "closed", "forced_open", "excluded"]
  const forceCloseSet = new Set<string>()
  const forceOpenSet = new Set<string>()

  const candidateSchools = schoolData.features.filter((school) => {
    const name = school.properties?.name ?? ""
    const optionRaw = school.properties?.optimizationOption as string | undefined
    const option: SchoolOptimizationOption =
      optionRaw && allowedOptions.includes(optionRaw as SchoolOptimizationOption)
        ? (optionRaw as SchoolOptimizationOption)
        : school.properties?.isClosed
            ? "closed"
            : "default"

    const isTargetMode = selectedMode === "Name_1" ? name.endsWith("小学校") : name.endsWith("中学校")
    if (!isTargetMode) return false

    if (option === "excluded") {
      return false
    }

    if (option === "closed") {
      forceCloseSet.add(name)
    } else if (option === "forced_open") {
      forceOpenSet.add(name)
    }

    return true
  })

  // 強制開校と廃校が重複していた場合は廃校を優先
  forceCloseSet.forEach((name) => {
    if (forceOpenSet.has(name)) {
      forceOpenSet.delete(name)
    }
  })

  const activeSchoolData = {
    ...schoolData,
    features: candidateSchools,
  }

  const optimizationSummary = {
    totalSchools: candidateSchools.length,
    activeSchools: candidateSchools.length,
    forceCloseSchools: forceCloseSet.size,
    forceOpenSchools: forceOpenSet.size,
    districts: districtData.features.length,
    selectedMode: selectedMode,
    selectedYear: selectedYear,
    penalty_plus: penaltyPlus,
    penalty_minus: penaltyMinus,
    time_limit_sec: timeLimitSec,
    mip_gap: mipGap,
    range_mode: rangeMode,
    selectedTownCount: selectedTownIdSet.size,
    lockedTownCount: lockedTownIdSet.size,
  }

  console.log("最適化データを準備中:", optimizationSummary)

  const currentAssignments = new Set()
  districtData.features.forEach((district) => {
    const currentSchool = district.properties.editedDistricts?.[selectedMode]
    if (currentSchool) {
      currentAssignments.add(currentSchool)
    }
  })
  console.log("現在の割り当て学校数:", currentAssignments.size)

  const mode = selectedMode === "Name_1" ? "elementary" : "middle"

  const lockedAssignments: Record<string, string> = {}

  districtData.features.forEach((feature: GeoJSONData["features"][number]) => {
    const districtId = feature?.properties?.id
    if (!districtId) return
    const eligibility = ensureEligibility(feature)
    const currentSchool = feature?.properties?.editedDistricts?.[selectedMode]
    const isSelected = selectedTownIdSet.has(districtId)
    const isLocked = lockedTownIdSet.has(districtId)

    if (isLocked && currentSchool) {
      lockedAssignments[districtId] = currentSchool
    }

    if (rangeMode === "fix") {
      if (!isSelected && currentSchool) {
        lockedAssignments[districtId] = currentSchool
      }
      eligibility[selectedMode] = isSelected
    } else {
      eligibility[selectedMode] = isSelected
    }
  })

  const districtForOptimization: GeoJSONData =
    rangeMode === "exclude"
      ? {
          ...districtData,
          features: districtData.features.filter((feature: GeoJSONData["features"][number]) => {
            const districtId = feature?.properties?.id
            return districtId ? selectedTownIdSet.has(districtId) : false
          }),
        }
      : districtData

  if (rangeMode === "exclude" && districtForOptimization.features.length === 0) {
    throw new Error("最適化対象の町丁目が選択されていません")
  }

  const optimizationData = {
    district: districtForOptimization,
    schools: activeSchoolData,
    mode,
    year: selectedYear,
    penalty_plus: penaltyPlus,
    penalty_minus: penaltyMinus,
    time_limit_sec: timeLimitSec,
    mip_gap: mipGap,
    locked_assignments: lockedAssignments,
    selected_town_ids: Array.from(selectedTownIdSet),
    force_close_schools: Array.from(forceCloseSet),
    force_open_schools: Array.from(forceOpenSet),
    range_mode: rangeMode,
  }

  console.log("最適化APIを呼び出し中...")

  // === ここから置き換え ===
  const endpoint = "/api/optimize-districts";
  console.log(`[runOptimization] POST ${endpoint}`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(optimizationData),
  });

  const ctype = response.headers.get("content-type") || "";
  const isJson = ctype.includes("application/json");

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "")
    let detail = bodyText
    if (isJson && bodyText) {
      try {
        const parsed = JSON.parse(bodyText) as { error?: string; message?: string }
        detail = parsed.error || parsed.message || bodyText
      } catch {
        detail = bodyText
      }
    }
    throw new Error(
      `HTTP ${response.status} at ${endpoint}\n` +
      `content-type=${ctype}\n` +
      `${String(detail).slice(0, 500)}`
    );
  }

  if (!isJson) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(
      `Unexpected non-JSON from ${endpoint}. content-type=${ctype}\n` +
      `${bodyText.slice(0, 500)}`
    );
  }

  const result = await response.json();
  const resultKeys = Object.keys(result || {})
  const resultSize = (() => {
    try {
      return JSON.stringify(result).length
    } catch {
      return null
    }
  })()

  console.log("[runOptimization] keys:", resultKeys)
  console.log("[runOptimization] has flaskResult?", !!result?.flaskResult)
  if (resultSize !== null && resultSize > 5000) {
    console.log("[runOptimization] result size:", resultSize, "(truncated)")
  }
  // === ここまで置き換え ===

  const resultSummary = {
    success: result.success,
    hasOptimizedData: !!result.optimizedData,
    gurobiInfo: result.gurobiInfo,
    message: result.message,
  }
  console.log("最適化結果を受信:", resultSummary)

  return result
}

export const processOptimizationResult = (
  result: OptimizationApiResult,
  previousDistrictData: GeoJSONData,
  selectedMode: "Name_1" | "Name_2",
): { promotedDistrictData: GeoJSONData; optimizedSnapshot: GeoJSONData; changedCount: number } => {
  if (!result.success || !result.optimizedData) {
    throw new Error(result.error || "最適化計算に失敗しました")
  }

  if (!result.optimizedData.features || !Array.isArray(result.optimizedData.features)) {
    throw new Error("最適化結果のデータ構造が正しくありません")
  }

  console.log("最適化結果の処理を開始:", {
    featuresCount: result.optimizedData.features.length,
    selectedMode,
  })

  const optimizedSnapshot: GeoJSONData = JSON.parse(JSON.stringify(result.optimizedData))

  const previousAssignment = new Map<string, string>()
  previousDistrictData.features.forEach((feature: GeoJSONData["features"][number]) => {
    const currentSchool = feature?.properties?.editedDistricts?.[selectedMode]
    if (currentSchool) {
      previousAssignment.set(feature?.properties?.id, currentSchool)
    }
  })

  const optimizedFeaturesMap = new Map<string, GeoJSONData["features"][number]>(
    optimizedSnapshot.features.map((feature: GeoJSONData["features"][number]) => [feature?.properties?.id, feature]),
  )

  let changedCount = 0
  optimizedSnapshot.features.forEach((optimizedFeature: GeoJSONData["features"][number]) => {
    const districtId = optimizedFeature?.properties?.id
    if (!districtId) return
    const optimizedSchool = optimizedFeature?.properties?.optimizedDistricts?.[selectedMode]
    const currentSchool = previousAssignment.get(districtId)
    if (optimizedSchool && optimizedSchool !== currentSchool) changedCount++
  })

  console.log("最適化結果の分析:", {
    selectedMode,
    prevAssignmentCount: previousAssignment.size,
    changedCount,
    modeType: selectedMode === "Name_1" ? "小学校区" : "中学校区",
  })

  const promotedDistrictData: GeoJSONData = {
    ...previousDistrictData,
    features: previousDistrictData.features.map((originalFeature: GeoJSONData["features"][number]) => {
      const originalProps = originalFeature?.properties || {}
      const optimizedFeature = optimizedFeaturesMap.get(originalProps.id)
      const optimizedDistricts = optimizedFeature?.properties?.optimizedDistricts

      const mergedEditedDistricts = {
        ...(originalProps.editedDistricts || {}),
        Name_1: optimizedDistricts?.Name_1 ?? originalProps.editedDistricts?.Name_1 ?? originalProps.Name_1,
        Name_2: optimizedDistricts?.Name_2 ?? originalProps.editedDistricts?.Name_2 ?? originalProps.Name_2,
      }

      const previousOptimized = originalProps.optimizedDistricts || {}
      const resolvedOptimized = optimizedDistricts
        ? {
            Name_1: optimizedDistricts.Name_1 ?? mergedEditedDistricts.Name_1,
            Name_2: optimizedDistricts.Name_2 ?? mergedEditedDistricts.Name_2,
          }
        : {
            Name_1: previousOptimized.Name_1 ?? mergedEditedDistricts.Name_1,
            Name_2: previousOptimized.Name_2 ?? mergedEditedDistricts.Name_2,
          }

      const eligibility = ensureEligibility(originalFeature)

      return {
        ...originalFeature,
        properties: {
          ...originalProps,
          optimizedDistricts: resolvedOptimized,
          editedDistricts: mergedEditedDistricts,
          optimizationEligibility: eligibility,
        },
      }
    }),
  }

  return { promotedDistrictData, optimizedSnapshot, changedCount }
}
