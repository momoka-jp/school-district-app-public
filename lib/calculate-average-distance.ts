import type { GeoJSONData } from "@/types/map-types"

// 距離データの型定義
export interface DistanceData {
  [key: string]: number
}

/**
 * 平均通学距離を計算する関数
 * @param districtData 地区データ
 * @param distanceData 距離データ（地区-学校間の距離）
 * @param mode 表示モード（Name_1: 小学区, Name_2: 中学校区）
 * @param displayMode 表示モード（original: 既存校区, current: 現在の割り当て, optimized: 最適化結果）
 * @returns 平均通学距離（km）
 */
export function calculateAverageDistance(
  districtData: GeoJSONData | null,
  distanceData: DistanceData | null,
  mode: "Name_1" | "Name_2",
  displayMode: "original" | "current" | "optimized",
): number | null {
  if (!districtData || !distanceData) return null

  let totalDistance = 0
  let totalStudents = 0

  districtData.features.forEach((district: GeoJSONData["features"][number]) => {
    const districtId = district.properties.id

    // 表示モードに応じて使用する学区データを選択
    const schoolName =
      displayMode === "original"
        ? district.properties.originalDistricts?.[mode]
        : displayMode === "current"
          ? district.properties.editedDistricts?.[mode]
          : district.properties.optimizedDistricts?.[mode] || district.properties.editedDistricts?.[mode]

    // 生徒数の取得
    const students = district.properties.editedStudents?.[mode === "Name_1" ? "num_sho" : "num_chu"] ?? 0

    if (schoolName && students > 0) {
      const distanceKey = `${districtId}-${schoolName}`
      const distance = distanceData[distanceKey]

      if (distance !== undefined) {
        totalDistance += distance * students
        totalStudents += students
      }
    }
  })

  return totalStudents > 0 ? totalDistance / totalStudents : null
}

/**
 * 特定の学校の平均通学距離を計算する関数
 * @param districtData 地区データ
 * @param distanceData 距離データ（地区-学校間の距離）
 * @param schoolName 学校名
 * @param mode 表示モード（Name_1: 小学校区, Name_2: 中学校区）
 * @param displayMode 表示モード（original: 既存校区, current: 現在の割り当て, optimized: 最適化結果）
 * @returns その学校の平均通学距離（km）
 */
export function calculateSchoolAverageDistance(
  districtData: GeoJSONData | null,
  distanceData: DistanceData | null,
  schoolName: string,
  mode: "Name_1" | "Name_2",
  displayMode: "original" | "current" | "optimized",
): number | null {
  if (!districtData || !distanceData || !schoolName) return null

  let totalDistance = 0
  let totalStudents = 0

  districtData.features.forEach((district: GeoJSONData["features"][number]) => {
    const districtId = district.properties.id

    // 表示モードに応じて使用する学区データを選択
    const assignedSchoolName =
      displayMode === "original"
        ? district.properties.originalDistricts?.[mode]
        : displayMode === "current"
          ? district.properties.editedDistricts?.[mode]
          : district.properties.optimizedDistricts?.[mode] || district.properties.editedDistricts?.[mode]

    // この地区が指定された学校に割り当てられているかチェック
    if (assignedSchoolName === schoolName) {
      // 生徒数の取得
      const students = district.properties.editedStudents?.[mode === "Name_1" ? "num_sho" : "num_chu"] ?? 0

      if (students > 0) {
        const distanceKey = `${districtId}-${schoolName}`
        const distance = distanceData[distanceKey]

        if (distance !== undefined) {
          totalDistance += distance * students
          totalStudents += students
        }
      }
    }
  })

  return totalStudents > 0 ? totalDistance / totalStudents : null
}
