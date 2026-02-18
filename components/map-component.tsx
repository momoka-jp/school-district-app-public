"use client"

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
// import "leaflet.markercluster/dist/leaflet.markercluster.js"
// import "leaflet.markercluster/dist/MarkerCluster.css"
// import "leaflet.markercluster/dist/MarkerCluster.Default.css"
import { calculateAverageDistance } from "@/lib/calculate-average-distance"
import { emitSchoolSelectionSummary } from "@/lib/event-constants"
import ControlPanel from "./control-panel"
import type {
  GeoJSONData,
  MapComponentProps,
  DisplayMode,
  DistrictOptionValue,
  SchoolGeoJSONData,
  SchoolOptimizationOption,
  MapExportOptions,
} from "@/types/map-types"
import { useMapData, combineData } from "@/hooks/use-map-data"
import { useMapRenderer } from "@/hooks/use-map-renderer"
import { useDistrictOptions, createDefaultOptionEntry } from "@/hooks/use-district-options"
import { useSchoolSelection } from "@/hooks/use-school-selection"
import { useOptimizationRunner } from "@/hooks/use-optimization-runner"
import { calculateSchoolEnrollment, saveGeoJSON, exportSchoolsToCSV, exportDistrictsToCSV } from "@/utils/map-utils"
import { useMapInitialization } from "@/hooks/useMapInitialization"
import { exportMapAsImage } from "@/utils/map-export"
import { resetDistrictState } from "@/utils/reset-districts"
import { calculateSchoolsWithinCapacityByMode } from "@/utils/capacity-utils"

type CsvRowLike = Record<string, unknown> | unknown[]

interface MapComponentHandle {
  saveGeoJSON: () => void
  loadGeoJSON: (json: unknown) => void
  exportSchoolsCSV: () => void
  exportDistrictsCSV: () => void
  exportMapAsImage: (options?: MapExportOptions) => Promise<void>
  toggleSchoolStatus: (schoolName: string, newIsClosed: boolean) => void
  setSchoolSelection: (schoolName: string, include: boolean) => void
  selectAllTowns: () => void
  clearAllTowns: () => void
  reloadSchoolData: () => void
  setEditingMode: (enable: boolean) => void
}

type MapDebugEntry = {
  districtData: GeoJSONData | null
  schoolData: SchoolGeoJSONData | null
  optimizedDistrictData: GeoJSONData | null
  displayMode: DisplayMode
  selectedMode: "Name_1" | "Name_2"
  selectedYear: number
  selectedTownIds: string[]
  selectedTownIdsCount: number
  fixedTownIds: string[]
  districtOptionsForSelectedMode: Record<string, DistrictOptionValue>
  rangeMode: "fix" | "exclude"
  setSelectedTownIds: (ids: string[] | Set<string>) => void
}

type WindowWithApp = Window & { app?: { __debug?: (MapDebugEntry & Record<string, unknown>) } }

const applyYearToEditedStudents = (districtsGeoJson: GeoJSONData | null, year: number) => {
  if (!districtsGeoJson?.features) return districtsGeoJson
  const keySho = `num_sho${year}`
  const keyChu = `num_chu${year}`
  districtsGeoJson.features.forEach((feat: GeoJSONData["features"][number]) => {
    const p = feat.properties ?? {}
    const sho = Number(p[keySho] ?? p.num_sho2024 ?? 0)
    const chu = Number(p[keyChu] ?? p.num_chu2024 ?? 0)
    p.editedStudents = { num_sho: sho, num_chu: chu }
    feat.properties = p
  })
  return districtsGeoJson
}

// ===== index-based CSV reader =====
const CSV = {
  COL_TOWN_KEY: 3, // 町丁目名（GeoJSONのproperties.nameと一致）
  BASE_CHILD_POP: 6, // 児童学齢住民数 2025 開始列
  BASE_STUDENT_POP: 13, // 生徒学齢住民数 2025 開始列
  BASE_CHILD_COUNT: 20, // 児童数 2025 開始列  ← これを num_sho に使う
  BASE_STUDENT_COUNT: 27, // 生徒数 2025 開始列  ← これを num_chu に使う
  YEARS: 7, // 2025..2031 の7年
}

// row を配列として取り出す（配列で無ければ推測で配列化）
const rowAsArray = (row: CsvRowLike): unknown[] => {
  if (Array.isArray(row)) return row
  if (typeof row === "object" && row !== null && "__row" in row) {
    const candidate = (row as { __row?: unknown }).__row
    if (Array.isArray(candidate)) return candidate
  }
  // 最後の手段: プロパティ順（CSVパーサが順番保持する場合が多い）
  return typeof row === "object" && row !== null ? Object.values(row) : []
}

const toNum = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[, ]/g, ""))
  return Number.isFinite(n) ? n : undefined
}

// 指定年の「児童数」「生徒数」を返す（なければ undefined）
const getCountsForYear = (row: CsvRowLike, year: number) => {
  if (year < 2025 || year > 2031) return { sho: undefined, chu: undefined }
  const a = rowAsArray(row)
  const off = year - 2025
  const sho = toNum(a[CSV.BASE_CHILD_COUNT + off]) // 児童数
  const chu = toNum(a[CSV.BASE_STUDENT_COUNT + off]) // 生徒数
  return { sho, chu }
}

// ★2024はGeoJSONの num_sho2024/num_chu2024、それ以外はCSVで上書き
const applyYearFromCsvIndex = (districtsGeoJson: GeoJSONData | null, parsedCsvData: CsvRowLike[], year: number) => {
  if (!districtsGeoJson?.features) return districtsGeoJson

  districtsGeoJson.features.forEach((feat: GeoJSONData["features"][number]) => {
    const p = feat.properties ?? {}
    let sho: number | undefined
    let chu: number | undefined

    if (year === 2024) {
      sho = toNum(p.num_sho2024) ?? 0
      chu = toNum(p.num_chu2024) ?? 0
    } else {
      // 町丁目名（col 3）で突合
      const row = parsedCsvData?.find((r) => {
        const arr = rowAsArray(r)
        return arr[CSV.COL_TOWN_KEY] === p.name
      })

      if (row) {
        const counts = getCountsForYear(row, year)
        sho = counts.sho
        chu = counts.chu
      }

      // フォールバック（CSVに無い場合は2024か0）
      if (sho === undefined) sho = toNum(p.num_sho2024) ?? 0
      if (chu === undefined) chu = toNum(p.num_chu2024) ?? 0
    }

    p.editedStudents = { num_sho: sho!, num_chu: chu! }
    feat.properties = p
  })

  return districtsGeoJson
}
const MapComponent = forwardRef<MapComponentHandle, MapComponentProps>(
  (
    {
      opacity,
      populationMultiplier,
      displaySettings,
      selectedMode,
      borderColor,
      selectedYear,
      onSwitchToElementaryMode,
      onSwitchToMiddleSchoolMode,
      onResetToInitialState,
      onSchoolDataChange,
      onSelectedSchoolChange,
      penaltyPlus,
      penaltyMinus,
      timeLimitSec,
      mipGap,
      onOptimizedDistrictDataChange,
      onSchoolSelectionSummaryChange,
      isEditing,
      onEditingChange,
      onOptimizationBaselineChange,
    },
    ref,
  ) => {
    // カスタムフックからデータを取得
    const {
      districtData,
      setDistrictData,
      originalDistrictData,
      optimizedDistrictData,
      setOptimizedDistrictData,
      schoolData,
      setSchoolData,
      originalSchoolData,
      distanceData,
      isLoading,
      loadError,
      rawDistrictGeoJSON, // 生のGeoJSONデータを取得
      parsedCsvData, // パース済みCSVデータを取得
      mergedStudentsMap,
      refreshSchoolData,
    } = useMapData(selectedYear)

    // 状態管理
    const [currentZoom, setCurrentZoom] = useState(13)
    const isEditingRef = useRef<boolean>(!!isEditing)
    const skipAutoSyncOnceRef = useRef(false)
    const [displayMode, setDisplayMode] = useState<DisplayMode>("current")
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [averageDistance, setAverageDistance] = useState<number | null>(null)
    const [rangeMode] = useState<"fix" | "exclude">("fix")

    const hasAutoCenteredRef = useRef<string | null>(null); // 現在表示中の自治体名を保持

    // 新しいフックを使用してマップの初期化とref管理
    const { fitToData, ...layerRefs } = useMapInitialization(setCurrentZoom)

    const {
      districtOptions,
      setDistrictOptions,
      selectedTownIds,
      fixedTownIds,
      districtOptionsForMode,
      schoolSelectionSummary,
      notifyDistrictAssignmentsChanged,
      handleTownOptionChange,
      handleSchoolSelectionChange,
      handleBulkFixSchoolDistricts,
      handleSelectAllTowns,
      handleClearAllTowns,
    } = useDistrictOptions({
      districtData,
      setDistrictData,
      selectedMode,
      skipAutoSyncOnceRef,
    })

    const {
      selectedSchool,
      selectedSchoolRef,
      selectedSchoolIsClosed,
      isUpdatingSchool,
      clearSchoolInfo,
      updateSchoolInfoDisplay,
      handleUpdateSchoolOption,
      handleToggleSchoolStatus,
    } = useSchoolSelection({
      layerRefs,
      selectedMode,
      displayMode,
      setDisplayMode,
      setErrorMessage,
      onSelectedSchoolChange,
      districtData,
      schoolData,
      setSchoolData,
      setDistrictOptions,
      selectedYear,
    })

    const { isOptimizing, handleRunOptimization } = useOptimizationRunner({
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
    })

    useEffect(() => {
      if (onSchoolSelectionSummaryChange) {
        onSchoolSelectionSummaryChange(schoolSelectionSummary)
      }
    }, [schoolSelectionSummary, onSchoolSelectionSummaryChange])

    useEffect(() => {
      if (typeof window === "undefined") return
      emitSchoolSelectionSummary(schoolSelectionSummary)
    }, [schoolSelectionSummary])

    // useMapRenderer フックを使用してレンダリング関連のロジックを処理
    const {
      updateSchoolDistrictsWrapper,
      updateSchoolsWrapper,
      drawSchoolDistrictLinesWrapper,
      drawCentroidsWrapper,
      updateLayerVisibilityWrapper,
      updateSchoolLabelVisibilityWrapper,
      highlightSelectedSchoolWrapper,
    } = useMapRenderer({
      layerRefs,
      districtData,
      setDistrictData,
      schoolData,
      distanceData,
      selectedMode,
      selectedYear,
      displayMode,
      borderColor,
      opacity,
      displaySettings,
      selectedTownIds,
      fixedTownIds,
      districtOptions: districtOptionsForMode,
      schoolSelectionSummary,
      handleToggleSchoolSelection: handleSchoolSelectionChange,
      handleToggleBulkFix: handleBulkFixSchoolDistricts,
      handleTownOptionChange,
      selectedSchoolRef,
      isEditingRef,
      selectedSchoolIsClosed,
      setErrorMessage,
      setDisplayMode,
      setAverageDistance,
      currentZoom,
      populationMultiplier,
      updateSchoolInfoDisplay,
      handleUpdateSchoolOption,
      isUpdatingSchool,
      clearSchoolInfo,
      notifyDistrictAssignmentsChanged,
    })

    useEffect(() => {
      const targetData = rawDistrictGeoJSON
      // districtData があり、かつ、まだその自治体で自動ズームをしていない場合のみ実行
      if (targetData && !isLoading && targetData.features?.length > 0) {
        // 行政コードや自治体名などで判定（例としてここでは最初の要素のコードを使用）
        const cityCode = targetData.features[0]?.properties?.code || "default"

        if (hasAutoCenteredRef.current !== cityCode) {
          fitToData(targetData)
          hasAutoCenteredRef.current = cityCode // 実行済みとして記録
        }
      }
    }, [rawDistrictGeoJSON, isLoading, fitToData])

    // 年度が変わったら editedStudents を当年値に更新
    useEffect(() => {
      if (!districtData) return
      if (schoolData) {
        calculateSchoolEnrollment(districtData, schoolData, "Name_1", displayMode, selectedYear)
        calculateSchoolEnrollment(districtData, schoolData, "Name_2", displayMode, selectedYear)
      }
      if (distanceData) {
        setAverageDistance(calculateAverageDistance(districtData, distanceData, selectedMode, displayMode))
      }
    }, [districtData, schoolData, distanceData, selectedMode, displayMode, selectedYear])

    useEffect(() => {
      // `districtData` が初期化され、`isLoading` が false になったタイミングでログを出力
      if (districtData && !isLoading) {
        logStudentKeys(districtData, selectedYear, "initial load")
      }
    }, [districtData, isLoading, selectedYear])

    const logStudentKeys = (data: GeoJSONData, year: number, label: string) => {
      if (!data?.features?.length) {
        console.log(`[${label}] no features`)
        return
      }
      const Y = String(year)
      const re = new RegExp(`${Y}.*(児童|生徒|sho|chu)|(児童|生徒|sho|chu).*${Y}`, "i")

      // 先頭3フィーチャだけ軽く確認
      const sample = data.features.slice(0, 3).map((f: GeoJSONData["features"][number], i: number) => {
        const p = f?.properties ?? {}
        const keys = Object.keys(p)
        const candidateKeys = keys.filter((k) => re.test(k) || /^num_(sho|chu)\d{4}$/.test(k))

        // 値も見たいのでテーブル化
        return {
          featureIndex: i,
          id: p.id ?? p.code ?? "",
          // 見つけた候補キーとその値
          ...Object.fromEntries(candidateKeys.map((k) => [k, p[k]])),
          // normalize形式があればそれも
          [`num_sho${Y}`]: p[`num_sho${Y}`],
          [`num_chu${Y}`]: p[`num_chu${Y}`],
        }
      })

      console.log(`[${label}] student-related keys for year=${year}`)
      console.table(sample)
    }

    // 学校データが変更されたら親コンポーネントに通知
    useEffect(() => {
      if (schoolData && onSchoolDataChange) {
        onSchoolDataChange(schoolData)
      }
    }, [schoolData, onSchoolDataChange])

    // 親コンポーネントに公開するメソッド
    useImperativeHandle(ref, () => ({
      saveGeoJSON: () => {
        if (districtData && schoolData) {
          calculateSchoolEnrollment(districtData, schoolData, "Name_1", displayMode, selectedYear)
          calculateSchoolEnrollment(districtData, schoolData, "Name_2", displayMode, selectedYear)
        }
        saveGeoJSON(districtData, schoolData, { districtOptions, selectedMode, displayMode })
      },
      loadGeoJSON: (json: unknown) => {
        const payload = (json ?? {}) as {
          districts?: GeoJSONData
          schools?: SchoolGeoJSONData
          features?: GeoJSONData["features"]
        }
        const nextDistricts = payload?.districts?.features
          ? payload.districts
          : payload?.features
            ? (payload as GeoJSONData)
            : null
        const nextSchools = payload?.schools?.features ? payload.schools : null

        if (nextDistricts?.features) {
          const nextOptions: Record<string, { Name_1: DistrictOptionValue; Name_2: DistrictOptionValue }> = {}

          nextDistricts.features.forEach((feature: GeoJSONData["features"][number]) => {
            const featureId = feature?.properties?.id
            if (!featureId) return

            const optionEntry = feature?.properties?.districtOptions
            if (optionEntry?.Name_1 || optionEntry?.Name_2) {
              nextOptions[featureId] = {
                Name_1: (optionEntry.Name_1 as DistrictOptionValue) ?? "最適化対象",
                Name_2: (optionEntry.Name_2 as DistrictOptionValue) ?? "最適化対象",
              }
              return
            }

            const fallbackEntry = createDefaultOptionEntry()
            const singleOption = feature?.properties?.districtOption as DistrictOptionValue | undefined
            if (singleOption) {
              nextOptions[featureId] = {
                ...fallbackEntry,
                [selectedMode]: singleOption,
              }
              return
            }

            nextOptions[featureId] = fallbackEntry
          })

          skipAutoSyncOnceRef.current = true
          setDistrictOptions(nextOptions)
          setDistrictData(nextDistricts)
        }

        if (nextSchools?.features) {
          setSchoolData(nextSchools)
        }
      },
      exportSchoolsCSV: () => exportSchoolsToCSV(districtData, schoolData, selectedMode, displayMode),
      exportDistrictsCSV: () => exportDistrictsToCSV(districtData, displayMode, selectedYear),
      exportMapAsImage: (options?: MapExportOptions) => handleExportMapAsImage(options),
      toggleSchoolStatus: (schoolName: string, newIsClosed: boolean) =>
        handleToggleSchoolStatus(schoolName, newIsClosed),
      setSchoolSelection: (schoolName: string, include: boolean) =>
        handleSchoolSelectionChange(schoolName, include),
      selectAllTowns: () => handleSelectAllTowns(),
      clearAllTowns: () => handleClearAllTowns(),
      reloadSchoolData: () => refreshSchoolData(),
      setEditingMode: (enable: boolean) => {
        const previous = isEditingRef.current
        isEditingRef.current = enable
        if (onEditingChange && previous !== enable) {
          onEditingChange(enable)
        }
      },
    }))

    useEffect(() => {
      isEditingRef.current = !!isEditing
    }, [isEditing])

    // selectedSchoolが変更されたらハイライト表示
    useEffect(() => {
      if (selectedSchool) {
        highlightSelectedSchoolWrapper(selectedSchool)
      }
    }, [selectedSchool, highlightSelectedSchoolWrapper])

    // エラーメッセージを表示して自動的に消す
    useEffect(() => {
      if (errorMessage) {
        const timer = setTimeout(() => {
          setErrorMessage(null)
        }, 3000)
        return () => clearTimeout(timer)
      }
    }, [errorMessage])

    useEffect(() => {
      if (loadError) {
        setErrorMessage(loadError)
      }
    }, [loadError])

    // 最適化計算を実行する関数
    // ★ デバッグ用: window から選択状況を観察 & 強制設定できるようにする
    useEffect(() => {
      if (process.env.NODE_ENV !== "development") return
      if (typeof window === "undefined") return;

      const win = window as WindowWithApp
      win.app = win.app || {}
      // 既存 __debug の内容は残したままマージする
      const prev = win.app.__debug || {}

      win.app.__debug = {
        ...prev,

        // 既存で出していた情報
        districtData,
        schoolData,
        optimizedDistrictData,
        displayMode,
        selectedMode,
        selectedYear,

        // ★ 追加：選択範囲の中身を可視化
        selectedTownIds: Array.from(selectedTownIds),
        selectedTownIdsCount: selectedTownIds.size,
        fixedTownIds: Array.from(fixedTownIds),
        districtOptionsForSelectedMode: districtOptionsForMode,
        rangeMode,

        // ★ 追加：コンソールから強制的に選択セットを入れ替えるためのヘルパー
        setSelectedTownIds: (ids: string[] | Set<string>) => {
          const arr = Array.isArray(ids) ? ids : Array.from(ids)
          const includeSet = new Set(arr)
          setDistrictOptions((prev) => {
            if (!districtData?.features) return prev
            let changed = false
            const next = { ...prev }

            districtData.features.forEach((feature: GeoJSONData["features"][number]) => {
              const featureId = feature?.properties?.id
              if (!featureId) return

              const currentEntry = next[featureId] ?? createDefaultOptionEntry()

              const desired: DistrictOptionValue = includeSet.has(featureId) ? "最適化対象" : "対象外"

              if (currentEntry[selectedMode] !== desired) {
                next[featureId] = { ...currentEntry, [selectedMode]: desired }
                changed = true
              }
            })

            return changed ? next : prev
          })
          console.log("[debug] setSelectedTownIds() called. size =", arr.length)
        },
      };
    }, [
      districtData,
      schoolData,
      optimizedDistrictData,
      displayMode,
      selectedMode,
      selectedYear,
      selectedTownIds,   // ← 追加
      fixedTownIds,
      districtOptionsForMode,
      rangeMode,         // ← 追加
    ]);



    // 校区をリセットする関数
    const resetDistricts = () => {
      void resetDistrictState({
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
        layerRefs: {
          districtLayerRef: layerRefs.districtLayerRef,
          lineLayerRef: layerRefs.lineLayerRef,
          centroidLayerRef: layerRefs.centroidLayerRef,
          highlightLayerRef: layerRefs.highlightLayerRef,
        },
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
      })
    }

    // 地図を画像として保存する関数
    const handleExportMapAsImage = async (options?: MapExportOptions) => {
      const capacityStats = calculateSchoolsWithinCapacityByMode(schoolData, selectedMode)
      const capacityPercentage =
        capacityStats.total > 0 ? Math.round((capacityStats.withinCapacity / capacityStats.total) * 100) : 0
      const modeLabel = selectedMode === "Name_1" ? "小学校" : "中学校"
      const mergedOptions: MapExportOptions = {
        ...options,
        averageDistance,
        capacityWithin: capacityStats.withinCapacity,
        capacityTotal: capacityStats.total,
        capacityPercentage,
        capacityModeLabel: modeLabel,
      }
      await exportMapAsImage({
        options: mergedOptions,
        districtData,
        layerRefs,
        displaySettings,
        updateLayerVisibility: updateLayerVisibilityWrapper,
        updateSchoolLabelVisibility: updateSchoolLabelVisibilityWrapper,
        setErrorMessage,
      })
    }

    return (
      <>
        <div className="map-container">
          <div id="map" className="w-full h-full"></div>
          {errorMessage && <div className="error-message">{errorMessage}</div>}
        </div>

        <ControlPanel
          displayMode={displayMode}
          selectedSchool={selectedSchool}
          selectedSchoolIsClosed={selectedSchoolIsClosed}
          averageDistance={averageDistance}
          isOptimizing={isOptimizing}
          optimizedDistrictData={optimizedDistrictData}
          schoolData={schoolData} // schoolDataプロパティを追加
          selectedMode={selectedMode} // selectedModeプロパティを追加
          onDisplayModeChange={setDisplayMode}
          onClearSchoolInfo={clearSchoolInfo}
          onRunOptimization={handleRunOptimization}
          onResetDistricts={resetDistricts}
          onExportMapAsImage={handleExportMapAsImage}
        />

        {(isLoading || isOptimizing || isUpdatingSchool) && (
          <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-[2000]">
            <div className="text-xl font-bold">
              {isLoading ? "データを読み込み中..." : isOptimizing ? "最適化計算中..." : "学校情報を更新中..."}
            </div>
          </div>
        )}
      </>
    )
  },
)

MapComponent.displayName = "MapComponent"

export default MapComponent
