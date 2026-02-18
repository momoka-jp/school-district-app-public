"use client"

import { useCallback, useState } from "react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { calculateAverageDistance, type DistanceData } from "@/lib/calculate-average-distance"
import { calculateSchoolEnrollment } from "@/utils/map-utils"
import { runOptimization, processOptimizationResult } from "@/utils/optimization-utils"
import { computeSchoolState } from "@/utils/school-state-utils"
import type {
  DisplayMode,
  GeoJSONData,
  OptimizationComparisonSnapshot,
  SchoolComparisonMetrics,
  SchoolGeoJSONData,
  SchoolOptimizationOption,
} from "@/types/map-types"

interface UseOptimizationRunnerParams {
  districtData: GeoJSONData | null
  schoolData: SchoolGeoJSONData | null
  selectedMode: "Name_1" | "Name_2"
  selectedYear: number
  penaltyPlus: number
  penaltyMinus: number
  timeLimitSec: number
  mipGap: number
  selectedTownIds: Set<string>
  fixedTownIds: Set<string>
  skipAutoSyncOnceRef: MutableRefObject<boolean>
  setDistrictData: Dispatch<SetStateAction<GeoJSONData | null>>
  setOptimizedDistrictData: Dispatch<SetStateAction<GeoJSONData | null>>
  onOptimizedDistrictDataChange?: (data: GeoJSONData & { comparisonSnapshot: OptimizationComparisonSnapshot }) => void
  onOptimizationBaselineChange?: (snapshot: OptimizationComparisonSnapshot | null) => void
  displayMode: DisplayMode
  setDisplayMode: (mode: DisplayMode) => void
  setErrorMessage: (message: string | null) => void
  distanceData: DistanceData | null
  setAverageDistance: (distance: number | null) => void
}

interface UseOptimizationRunnerResult {
  isOptimizing: boolean
  handleRunOptimization: () => Promise<void>
}

const ALLOWED_SCHOOL_OPTIONS: SchoolOptimizationOption[] = ["default", "closed", "forced_open", "excluded"]

const parseStudentCount = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const numeric = Number(String(value).replace(/[, ]/g, ""))
  return Number.isFinite(numeric) ? numeric : null
}

export function useOptimizationRunner({
  districtData,
  schoolData,
  selectedMode,
  selectedYear,
  penaltyPlus,
  penaltyMinus,
  timeLimitSec,
  mipGap,
  selectedTownIds,
  fixedTownIds,
  skipAutoSyncOnceRef,
  setDistrictData,
  setOptimizedDistrictData,
  onOptimizedDistrictDataChange,
  onOptimizationBaselineChange,
  displayMode,
  setDisplayMode,
  setErrorMessage,
  distanceData,
  setAverageDistance,
}: UseOptimizationRunnerParams): UseOptimizationRunnerResult {
  const [isOptimizing, setIsOptimizing] = useState(false)

  type OptimizationDebugParams = {
    penaltyPlus: number
    penaltyMinus: number
    timeLimitSec: number
    mipGap: number
    rangeMode: "exclude"
    selectedTownIds: string[]
    lockedTownIds: string[]
    forceCloseSchools: string[]
    forceOpenSchools: string[]
    selectedMode: "Name_1" | "Name_2"
    selectedYear: number
  }

  type OptimizationDebugEntry = {
    rawResult: unknown
    params: OptimizationDebugParams
    promotedDistrictData: GeoJSONData
  }

  type AppDebug = {
    lastOptimization?: OptimizationDebugEntry
  } & Record<string, unknown>

  type WindowWithApp = Window & { app?: { __debug?: AppDebug } }

  const buildComparisonEntry = useCallback(
    (
      modeKey: "Name_1" | "Name_2",
      matcher: (name: string) => boolean,
      districtForDistance: GeoJSONData | null,
      modeForDisplay: DisplayMode,
    ): SchoolComparisonMetrics => {
      const base: SchoolComparisonMetrics = {
        total: 0,
        operating: 0,
        closed: 0,
        averageDistance: null,
        withinCapacity: 0,
        capacityTotal: 0,
      }

      if (!schoolData?.features?.length) return base

      const assignmentKey = modeKey === "Name_1" ? "assignedStudentsSho" : "assignedStudentsChu"

      const counts = schoolData.features.reduce<SchoolComparisonMetrics>(
        (acc, feature: SchoolGeoJSONData["features"][number]) => {
          const props = feature?.properties ?? {}
          const legacyName = "Name" in props ? (props as { Name?: unknown }).Name : undefined
          const rawName = props.name ?? legacyName ?? ""
          const name = String(rawName).trim() || `学校`
          if (!matcher(name)) return acc

          acc.total += 1
          const state = computeSchoolState(feature, modeKey, modeForDisplay)
          const isClosedEffective = state.isExcludedOption || state.isClosedEffective

          if (isClosedEffective) {
            acc.closed += 1
            return acc
          }

          acc.operating += 1

          const legacyMin = "minStudents" in props ? (props as { minStudents?: unknown }).minStudents : undefined
          const legacyMax = "maxStudents" in props ? (props as { maxStudents?: unknown }).maxStudents : undefined
          const min = parseStudentCount(props.min_students ?? legacyMin)
          const max = parseStudentCount(props.max_students ?? legacyMax)
          const assigned = parseStudentCount(props[assignmentKey as keyof typeof props])

          if (min !== null && max !== null && assigned !== null) {
            acc.capacityTotal += 1
            if (assigned >= min && assigned <= max) {
              acc.withinCapacity += 1
            }
          }

          return acc
        },
        base,
      )

      const averageDistance =
        districtForDistance && distanceData
          ? calculateAverageDistance(districtForDistance, distanceData, modeKey, modeForDisplay)
          : null

      return { ...counts, averageDistance }
    },
    [distanceData, schoolData],
  )

  const buildComparisonSnapshot = useCallback(
    (
      districtForDistance?: GeoJSONData | null,
      modeForDisplay: DisplayMode = displayMode,
    ): OptimizationComparisonSnapshot => {
      const targetDistrictData = districtForDistance ?? districtData
      return {
        elementary: buildComparisonEntry(
          "Name_1",
          (name) => name.includes("小学校") || name.includes("小"),
          targetDistrictData,
          modeForDisplay,
        ),
        middle: buildComparisonEntry(
          "Name_2",
          (name) => name.includes("中学校") || name.includes("中"),
          targetDistrictData,
          modeForDisplay,
        ),
      }
    },
    [buildComparisonEntry, displayMode, districtData],
  )

  const captureOptimizationBaseline = useCallback(() => {
    if (!onOptimizationBaselineChange) return
    if (!schoolData?.features || !Array.isArray(schoolData.features)) {
      onOptimizationBaselineChange(null)
      return
    }

    const snapshot = buildComparisonSnapshot(districtData, displayMode)
    onOptimizationBaselineChange(snapshot)
  }, [buildComparisonSnapshot, displayMode, districtData, onOptimizationBaselineChange, schoolData])

  const handleRunOptimization = useCallback(async () => {
    if (isOptimizing) {
      setErrorMessage("最適化が進行中です。完了するまでお待ちください。")
      return
    }
    if (!districtData || !schoolData) {
      console.warn("最適化に必要なデータが不足しています:", {
        districtData: !!districtData,
        schoolData: !!schoolData,
      })
      setErrorMessage("最適化に必要なデータが不足しています")
      return
    }

    const prevSelection = new Set(selectedTownIds)
    const prevLocked = new Set(fixedTownIds)
    const forceCloseSchools = new Set<string>()
    const forceOpenSchools = new Set<string>()

    if (schoolData?.features) {
      schoolData.features.forEach((schoolFeature: SchoolGeoJSONData["features"][number]) => {
        const name = schoolFeature?.properties?.name ?? ""
        const optionRaw = schoolFeature?.properties?.optimizationOption as string | undefined
        const option: SchoolOptimizationOption =
          optionRaw && ALLOWED_SCHOOL_OPTIONS.includes(optionRaw as SchoolOptimizationOption)
            ? (optionRaw as SchoolOptimizationOption)
            : schoolFeature?.properties?.isClosed
                ? "closed"
                : "default"

        const isTargetMode = selectedMode === "Name_1" ? name.endsWith("小学校") : name.endsWith("中学校")
        if (!isTargetMode) return
        if (option === "closed") {
          forceCloseSchools.add(name)
        } else if (option === "forced_open") {
          forceOpenSchools.add(name)
        }
      })
    }

    captureOptimizationBaseline()

    try {
      setIsOptimizing(true)
      const clonedForOpt = JSON.parse(JSON.stringify(districtData))

      console.group("[opt] runOptimization")
      console.log("[opt] mode/year", { selectedMode, selectedYear })
      console.log("[opt] rangeMode", "exclude")
      console.log("[opt] selectedTownIds.size", prevSelection.size)
      console.log("[opt] lockedTownIds.size", prevLocked.size)
      console.log("[opt] forceClose/forceOpen", forceCloseSchools.size, forceOpenSchools.size)
      console.time("[opt] optimize-time")

      const result = await runOptimization(clonedForOpt, schoolData, selectedMode, selectedYear, {
        penaltyPlus,
        penaltyMinus,
        timeLimitSec,
        mipGap,
        selectedTownIds: Array.from(prevSelection),
        lockedTownIds: Array.from(prevLocked),
        rangeMode: "exclude",
      })

      console.log("[opt] result keys:", Object.keys(result || {}))
      console.log("[opt] has flaskResult:", !!result?.flaskResult)
      console.timeEnd("[opt] optimize-time")
      console.log("[opt] raw result:", result)

      const { promotedDistrictData, changedCount } = processOptimizationResult(result, clonedForOpt, selectedMode)

      skipAutoSyncOnceRef.current = true
      setDistrictData(promotedDistrictData)

      const idsAfter = new Set(
        promotedDistrictData?.features
          ?.map((feature: GeoJSONData["features"][number]) => feature?.properties?.id)
          .filter(Boolean) ?? [],
      )
      const restoredSelection = new Set([...prevSelection].filter((id) => idsAfter.has(id)))
      const restoredLocked = new Set([...prevLocked].filter((id) => idsAfter.has(id)))
      console.log(
        `[opt] restored selectedTownIds count: ${restoredSelection.size} (before=${prevSelection.size}), locked=${restoredLocked.size}`,
      )

      calculateSchoolEnrollment(promotedDistrictData, schoolData, "Name_1", displayMode, selectedYear, {
        forceAutoClosure: true,
      })
      calculateSchoolEnrollment(promotedDistrictData, schoolData, "Name_2", displayMode, selectedYear, {
        forceAutoClosure: true,
      })

      const optimizedSnapshot = buildComparisonSnapshot(promotedDistrictData, "current")
      const optimizedDataWithStats: GeoJSONData & { comparisonSnapshot: OptimizationComparisonSnapshot } = {
        ...result.optimizedData,
        type: "FeatureCollection",
        features: result.optimizedData?.features ?? [],
        comparisonSnapshot: optimizedSnapshot,
      }

      setOptimizedDistrictData(optimizedDataWithStats)
      onOptimizedDistrictDataChange?.(optimizedDataWithStats)

      setDisplayMode("current")

      const selectedAverage =
        selectedMode === "Name_1" ? optimizedSnapshot.elementary.averageDistance : optimizedSnapshot.middle.averageDistance
      setAverageDistance(selectedAverage)
      console.log("[opt] avg distance (current):", selectedAverage)

      setErrorMessage(
        `${selectedMode === "Name_1" ? "小学校区" : "中学校区"}の最適化計算が完了しました（${changedCount}件変更）`,
      )

      if (typeof window !== "undefined") {
        const win = window as WindowWithApp
        win.app = win.app || {}
        const prev = win.app.__debug || {}
        win.app.__debug = {
          ...prev,
          lastOptimization: {
            rawResult: result,
            params: {
              penaltyPlus,
              penaltyMinus,
              timeLimitSec,
              mipGap,
              rangeMode: "exclude",
              selectedTownIds: Array.from(prevSelection),
              lockedTownIds: Array.from(prevLocked),
              forceCloseSchools: Array.from(forceCloseSchools),
              forceOpenSchools: Array.from(forceOpenSchools),
              selectedMode,
              selectedYear,
            },
            promotedDistrictData,
          },
        }
        console.log(
          "[opt] wrote __debug.lastOptimization:",
          win.app.__debug?.lastOptimization && Object.keys(win.app.__debug.lastOptimization),
        )
      }

      console.groupEnd()
    } catch (error: unknown) {
      console.groupEnd()
      console.error("[opt] optimization failed:", error)
      const rawMessage = error instanceof Error ? error.message : String(error ?? "")
      const isInfeasible = /実行不可能|infeasible/i.test(rawMessage)
      if (isInfeasible) {
        setErrorMessage("最適化条件を満たす解が見つかりませんでした。入力条件や固定設定を確認してください。")
      } else {
        setErrorMessage(`最適化計算に失敗しました: ${rawMessage || "不明なエラー"}`)
      }
    } finally {
      setIsOptimizing(false)
    }
  }, [
    captureOptimizationBaseline,
    buildComparisonSnapshot,
    calculateSchoolEnrollment,
    districtData,
    displayMode,
    fixedTownIds,
    isOptimizing,
    mipGap,
    onOptimizedDistrictDataChange,
    penaltyMinus,
    penaltyPlus,
    schoolData,
    selectedMode,
    selectedTownIds,
    selectedYear,
    setAverageDistance,
    setDistrictData,
    setDisplayMode,
    setErrorMessage,
    setOptimizedDistrictData,
    skipAutoSyncOnceRef,
    timeLimitSec,
  ])

  return {
    isOptimizing,
    handleRunOptimization,
  }
}
