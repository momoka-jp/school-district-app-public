"use client"

import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import type { DistanceData } from "@/lib/calculate-average-distance"
import type {
  DisplayMode,
  DistrictOptionValue,
  GeoJSONData,
  SchoolGeoJSONData,
  SchoolOptimizationOption,
} from "@/types/map-types"
import { calculateAverageDistance } from "@/lib/calculate-average-distance"
import { calculateSchoolEnrollment } from "@/utils/map-utils"
import { createDefaultOptionEntry, type DistrictOptionEntry } from "@/hooks/use-district-options"
import type { CsvRow } from "@/hooks/use-map-data"

interface LayerRefs {
  districtLayerRef: MutableRefObject<L.LayerGroup | null>
  lineLayerRef: MutableRefObject<L.LayerGroup | null>
  centroidLayerRef: MutableRefObject<L.LayerGroup | null>
  highlightLayerRef: MutableRefObject<L.LayerGroup | null>
}

interface ResetDistrictsParams {
  combineData: (
    districtGeoJson: GeoJSONData,
    csvData: CsvRow[],
    year: number,
    mergedStudentsMap?: Map<string, Record<string, unknown>> | null,
  ) => GeoJSONData
  originalDistrictData: GeoJSONData | null
  schoolData: SchoolGeoJSONData | null
  rawDistrictGeoJSON: GeoJSONData | null
  parsedCsvData: CsvRow[]
  mergedStudentsMap?: Map<string, Record<string, unknown>> | null
  originalSchoolData: SchoolGeoJSONData | null
  selectedYear: number
  selectedMode: "Name_1" | "Name_2"
  displayMode: DisplayMode
  distanceData: DistanceData | null
  layerRefs: LayerRefs
  onResetToInitialState: () => void
  setDistrictOptions: Dispatch<SetStateAction<Record<string, DistrictOptionEntry>>>
  setDistrictData: Dispatch<SetStateAction<GeoJSONData | null>>
  setSchoolData: Dispatch<SetStateAction<SchoolGeoJSONData | null>>
  setDisplayMode: (mode: DisplayMode) => void
  setOptimizedDistrictData: Dispatch<SetStateAction<GeoJSONData | null>>
  onOptimizedDistrictDataChange?: (data: GeoJSONData | null) => void
  setAverageDistance: (distance: number | null) => void
  setErrorMessage: (message: string | null) => void
  clearSchoolInfo: () => void
}

export const resetDistrictState = async ({
  combineData,
  originalDistrictData,
  schoolData,
  rawDistrictGeoJSON,
  parsedCsvData,
  mergedStudentsMap,
  originalSchoolData,
  selectedYear,
  selectedMode,
  displayMode,
  distanceData,
  layerRefs,
  onResetToInitialState,
  setDistrictOptions,
  setDistrictData,
  setSchoolData,
  setDisplayMode,
  setOptimizedDistrictData,
  onOptimizedDistrictDataChange,
  setAverageDistance,
  setErrorMessage,
  clearSchoolInfo,
}: ResetDistrictsParams): Promise<boolean> => {
  if (!originalDistrictData || !schoolData || !rawDistrictGeoJSON || !parsedCsvData || !originalSchoolData) {
    return false
  }

  if (
    typeof window !== "undefined" &&
    !window.confirm("すべての設定を初期状態に戻しますか？この操作は元に戻せません。")
  ) {
    return false
  }

  try {
    const response = await fetch("/api/reset-schools", { method: "POST" })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "学校データのリセットに失敗しました")
    }
  } catch (error) {
    console.error("学校GeoJSONのリセットに失敗しました:", error)
    setErrorMessage("学校データのリセットに失敗しました。時間をおいて再試行してください。")
    return false
  }

  onResetToInitialState()

  const resetData = combineData(rawDistrictGeoJSON, parsedCsvData, selectedYear, mergedStudentsMap)

  resetData.features.forEach((feature: GeoJSONData["features"][number]) => {
    if (!feature.properties.originalDistricts) {
      feature.properties.originalDistricts = {
        Name_1: feature.properties.Name_1 || "",
        Name_2: feature.properties.Name_2 || "",
      }
    }

    feature.properties.editedDistricts = {
      Name_1: feature.properties.originalDistricts.Name_1,
      Name_2: feature.properties.originalDistricts.Name_2,
    }

    if (!feature.properties.editedStudents) {
      feature.properties.editedStudents = {
        num_sho: feature.properties.num_sho2024 ?? 0,
        num_chu: feature.properties.num_chu2024 ?? 0,
      }
    }

    delete feature.properties.optimizedDistricts
  })

  const resetSchoolData = {
    ...schoolData,
    features: schoolData.features.map((school: SchoolGeoJSONData["features"][number]) => {
      const originalSchool = originalSchoolData.features.find(
        (original: SchoolGeoJSONData["features"][number]) => original.properties.name === school.properties.name,
      )
      const originalManualClosed = Boolean(
        originalSchool?.properties.isClosedManual ?? originalSchool?.properties.isClosed ?? false,
      )
      const originalOption = originalSchool?.properties.optimizationOption as SchoolOptimizationOption | undefined
      const resolvedOption: SchoolOptimizationOption = originalOption
        ? originalOption
        : originalManualClosed
          ? "closed"
          : "default"

      return {
        ...school,
        properties: {
          ...school.properties,
          isClosed: resolvedOption === "closed" || resolvedOption === "excluded",
          isClosedManual: resolvedOption === "closed",
          manualOpenOverride: resolvedOption === "forced_open",
          closedByOptimization: false,
          optimizationOption: resolvedOption,
          assignedStudentsSho: 0,
          assignedStudentsChu: 0,
        },
      }
    }),
  }

  clearSchoolInfo()
  setDisplayMode("current")
  setOptimizedDistrictData(null)
  onOptimizedDistrictDataChange?.(null)
  setDistrictOptions(() => {
    const entries: Record<string, DistrictOptionEntry> = {}
    resetData.features.forEach((feature: GeoJSONData["features"][number]) => {
      const featureId = feature?.properties?.id
      if (!featureId) return
      entries[featureId] = createDefaultOptionEntry()
    })
    return entries
  })
  setDistrictData(resetData)
  setSchoolData(resetSchoolData)

  calculateSchoolEnrollment(resetData, resetSchoolData, "Name_1", "current", selectedYear)
  calculateSchoolEnrollment(resetData, resetSchoolData, "Name_2", "current", selectedYear)

  if (layerRefs.districtLayerRef.current) layerRefs.districtLayerRef.current.clearLayers()
  if (layerRefs.lineLayerRef.current) layerRefs.lineLayerRef.current.clearLayers()
  if (layerRefs.centroidLayerRef.current) layerRefs.centroidLayerRef.current.clearLayers()
  if (layerRefs.highlightLayerRef.current) layerRefs.highlightLayerRef.current.clearLayers()

  if (distanceData) {
    const avgDistance = calculateAverageDistance(resetData, distanceData, selectedMode, displayMode)
    setAverageDistance(avgDistance)
  }

  setErrorMessage("すべての設定が初期状態にリセットされました")
  return true
}
