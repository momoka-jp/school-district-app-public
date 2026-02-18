"use client"

import { useState, useRef, useCallback, useEffect } from "react"
//import MapComponent from "@/components/map-component"
import SidePanel from "@/components/side-panel"
import ComparisonView from "@/components/comparison-view"
import Header from "@/components/header"
import dynamic from "next/dynamic"
import type { OptimizationComparisonSnapshot, MapExportOptions } from "@/types/map-types"

const MapComponent = dynamic(() => import("@/components/map-component"), {
  ssr: false,
})

export default function Home() {
  const [isEditing, setIsEditing] = useState(false)
  const [optimizedDistrictDataForStats, setOptimizedDistrictDataForStats] = useState<any | null>(null)
  const [optimizationBaselineStats, setOptimizationBaselineStats] =
    useState<OptimizationComparisonSnapshot | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(2025)
  const [opacity, setOpacity] = useState(0.5)
  const [populationMultiplier, setPopulationMultiplier] = useState(1.0)
  const [displaySettings, setDisplaySettings] = useState<{
    boundaries: boolean
    elementarySchools: boolean
    elementaryMarkers: boolean
    elementaryLabels: boolean
    middleSchools: boolean
    middleMarkers: boolean
    middleLabels: boolean
    districts: boolean
    excludedMode: "hidden" | "faded-info" | "faded-no-info"
  }>({
    boundaries: true,
    elementarySchools: true,
    elementaryMarkers: true,
    elementaryLabels: true,
    middleSchools: false, // デフォルトで中学校マーカーは非表示
    middleMarkers: false,
    middleLabels: false,
    districts: true,
    excludedMode: "hidden",
  })
  const [borderColor] = useState<"white" | "black">("black")
  const [selectedMode, setSelectedMode] = useState<"Name_1" | "Name_2">("Name_1")
  const [showComparisonView, setShowComparisonView] = useState(false)
  const [schoolData, setSchoolData] = useState<any>(null)
  const [sidePanelOpen, setSidePanelOpen] = useState(true)
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null)

  const [penaltyPlus, setPenaltyPlus] = useState<number>(100)
  const [penaltyMinus, setPenaltyMinus] = useState<number>(100)
  const [timeLimitSec, setTimeLimitSec] = useState<number>(60)
  const [mipGap, setMipGap] = useState<number>(0.0)
  const [schoolSelectionSummary, setSchoolSelectionSummary] = useState<
    Record<
      string,
      {
        Name_1: { total: number; selected: number; fixed: number }
        Name_2: { total: number; selected: number; fixed: number }
      }
    >
  >({})

  const mapRef = useRef<any>(null)

  useEffect(() => {
    async function init() {
      try {
        console.log("初期マージを試行中...");
        // 🚨 修正: 失敗しても後続を止めないように例外をキャッチする
        await fetch("/api/merge-schools").catch(err => console.warn("マージAPIスキップ:", err));

        // configの読み込み
        const configResponse = await fetch(`/data/config.json?t=${Date.now()}`)
        const config = configResponse.ok ? await configResponse.json() : {}
        
        // config.json のキー名 (merged_geojson_filename) に合わせる
        const mergedFilename = config.merged_geojson_filename || "merged.geojson";
        const geojsonPath = `/data/output/${mergedFilename}`;

        console.log(`GeoJSONを取得中: ${geojsonPath}`);
        const geojsonResponse = await fetch(`${geojsonPath}?t=${Date.now()}`);

        if (!geojsonResponse.ok) {
          // merged.geojson すら無い場合は、Pythonスクリプトの実行が必要
          throw new Error("merged.geojsonが見つかりません。Pythonスクリプトを確認してください。");
        }
        const geojson = await geojsonResponse.json();

        // 3. 隣接関係抽出APIを確実に叩く
        console.log("隣接関係を自動抽出中...");
        const adjResponse = await fetch("/api/extract-adjacency", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            geojson,
            min_shared_length: 0 
          }),
        });

        const adjResult = await adjResponse.json();
        if (adjResult.success) {
          console.log("隣接関係の自動更新に成功しました:", adjResult.stats);
        }

      } catch (error) {
        console.error("初期化プロセスでエラーが発生しました:", error);
      }
    }
    init();
  }, []);


  // selectedModeが変更された時に表示設定を自動的に切り替える
  useEffect(() => {
    if (selectedMode === "Name_1") {
      // 小学校モード: 小学校マーカーを表示、中学校マーカーを非表示
      setDisplaySettings((prev) => ({
        ...prev,
        elementarySchools: true,
        elementaryMarkers: true,
        elementaryLabels: true,
        middleSchools: false,
        middleMarkers: false,
        middleLabels: false,
      }))
    } else if (selectedMode === "Name_2") {
      // 中学校モード: 中学校マーカーを表示、小学校マーカーを非表示
      setDisplaySettings((prev) => ({
        ...prev,
        elementarySchools: false,
        elementaryMarkers: false,
        elementaryLabels: false,
        middleSchools: true,
        middleMarkers: true,
        middleLabels: true,
      }))
    }
  }, [selectedMode])

  useEffect(() => {
    console.log("Current selectedYear:", selectedYear)
  }, [selectedYear])

  const handleOpacityChange = useCallback((value: number[]) => {
    setOpacity(value[0])
  }, [])

  const handlePopulationChange = useCallback((value: number[]) => {
    setPopulationMultiplier(value[0])
  }, [])

  const handleDisplaySettingChange = useCallback((setting: string, checked: boolean) => {
    setDisplaySettings((prev) => ({
      ...prev,
      [setting]: checked,
    }))
  }, [])

  const handleExcludedModeChange = useCallback((mode: "hidden" | "faded-info" | "faded-no-info") => {
    setDisplaySettings((prev) => ({
      ...prev,
      excludedMode: mode,
    }))
  }, [])

  const handleSwitchToElementaryMode = useCallback(() => {
    if (selectedSchool) {
      alert("学校が選択されています。選択を解除してからモードを変更してください。")
      return
    }
    setSelectedMode("Name_1")
  }, [selectedSchool])

  const handleSwitchToMiddleSchoolMode = useCallback(() => {
    if (selectedSchool) {
      alert("学校が選択されています。選択を解除してからモードを変更してください。")
      return
    }
    setSelectedMode("Name_2")
  }, [selectedSchool])

  const handleResetToInitialState = useCallback(() => {
    // リセット時は小学校モードに戻す
    setSelectedMode("Name_1")
    setOptimizationBaselineStats(null)
    setPopulationMultiplier(1.0)
    // 表示設定も小学校モードに合わせてリセット
    setDisplaySettings({
      boundaries: true,
      elementarySchools: true,
      elementaryMarkers: true,
      elementaryLabels: true,
      middleSchools: false,
      middleMarkers: false,
      middleLabels: false,
      districts: true,
      excludedMode: "hidden",
    })
  }, [])

  const handleToggleSchoolStatus = useCallback(
    async (schoolName: string, newIsClosed: boolean) => {
      await mapRef.current?.toggleSchoolStatus?.(schoolName, newIsClosed)
    },
    []
  )

  const handleSchoolSelectionChange = useCallback(
    async (schoolName: string, include: boolean) => {
      await mapRef.current?.setSchoolSelection?.(schoolName, include)
    },
    [],
  )

  const handleSelectAllTowns = useCallback(async () => {
    await mapRef.current?.selectAllTowns?.()
  }, [])

  const handleClearAllTowns = useCallback(async () => {
    await mapRef.current?.clearAllTowns?.()
  }, [])

  const handleSchoolSelectionSummaryChange = useCallback(
    (
      summary: Record<
        string,
        {
          Name_1: { total: number; selected: number; fixed: number }
          Name_2: { total: number; selected: number; fixed: number }
        }
      >,
    ) => {
      setSchoolSelectionSummary(summary)
    },
    [],
  )

  const handleSaveGeoJSON = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.saveGeoJSON()
    }
  }, [])

  const handleLoadGeoJSON = useCallback((json: unknown) => {
    if (mapRef.current) {
      mapRef.current.loadGeoJSON(json)
    }
  }, [])

  const handleExportSchoolsCSV = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.exportSchoolsCSV()
    }
  }, [])

  const handleExportDistrictsCSV = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.exportDistrictsCSV()
    }
  }, [])

  const [isExportingMap, setIsExportingMap] = useState(false)

  const handleExportMapAsImage = useCallback(async (options?: MapExportOptions) => {
    if (!mapRef.current) return
    setIsExportingMap(true)
    try {
      await mapRef.current.exportMapAsImage(options)
    } finally {
      setIsExportingMap(false)
    }
  }, [])

  const handleShowComparison = useCallback(() => {
    setShowComparisonView(true)
  }, [])

  const handleCloseComparison = useCallback(() => {
    setShowComparisonView(false)
  }, [])

  const handleSchoolDataChange = useCallback((newSchoolData: any) => {
    setSchoolData(newSchoolData)
  }, [])

  const handleToggleSidePanel = useCallback(() => {
    setSidePanelOpen(!sidePanelOpen)
  }, [sidePanelOpen])

  const handleCloseSidePanel = useCallback(() => {
    setSidePanelOpen(false)
  }, [])

  const handleYearChange = useCallback((value: number[]) => {
    console.log("Year changed to:", value[0])
    setSelectedYear(value[0])
  }, [])

  const handleSelectedSchoolChange = useCallback((schoolName: string | null) => {
    setSelectedSchool(schoolName)
  }, [])

  // 学校選択が外れたら校区拡大も自動でオフ
  useEffect(() => {
    if (!selectedSchool && isEditing) setIsEditing(false)
  }, [selectedSchool, isEditing])

  // ヘッダーからのトグル要求を受けて、地図にも通知（メソッド名は後で地図側に実装）
  const handleToggleEditing = useCallback((enable: boolean) => {
    setIsEditing(enable)
    mapRef.current?.setEditingMode?.(enable) // ← MapComponent 側で実装予定の任意メソッド
  }, [])

  if (showComparisonView) {
    return (
      <div className="h-screen w-screen flex flex-col">
        <Header
          selectedMode={selectedMode}
          sidePanelOpen={sidePanelOpen}
          selectedSchool={selectedSchool}
          onToggleSidePanel={handleToggleSidePanel}
          onSwitchToElementaryMode={handleSwitchToElementaryMode}
          onSwitchToMiddleSchoolMode={handleSwitchToMiddleSchoolMode}
          isEditing={isEditing}
          onToggleEditing={handleToggleEditing}
        />
        <div className="flex-1">
          <ComparisonView onClose={handleCloseComparison} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <Header
        selectedMode={selectedMode}
        sidePanelOpen={sidePanelOpen}
        selectedSchool={selectedSchool}
        onToggleSidePanel={handleToggleSidePanel}
        onSwitchToElementaryMode={handleSwitchToElementaryMode}
        onSwitchToMiddleSchoolMode={handleSwitchToMiddleSchoolMode}
        isEditing={isEditing}
        onToggleEditing={handleToggleEditing}
      />

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {/* サイドパネル */}
        {sidePanelOpen && (
          <SidePanel
            opacity={opacity}
            populationMultiplier={populationMultiplier}
            displaySettings={displaySettings}
            schoolData={schoolData}
            selectedYear={selectedYear}
            onYearChange={handleYearChange}
            onOpacityChange={handleOpacityChange}
            onPopulationChange={handlePopulationChange}
            onDisplaySettingChange={handleDisplaySettingChange}
            onExcludedModeChange={handleExcludedModeChange}
            onSaveGeoJSON={handleSaveGeoJSON}
            onLoadGeoJSON={handleLoadGeoJSON}
            onExportSchoolsCSV={handleExportSchoolsCSV}
            onExportDistrictsCSV={handleExportDistrictsCSV}
            onExportMapAsImage={handleExportMapAsImage}
            isExportingMap={isExportingMap}
            onShowComparison={handleShowComparison}
            selectedMode={selectedMode}
            onSwitchToElementaryMode={handleSwitchToElementaryMode}
            onSwitchToMiddleSchoolMode={handleSwitchToMiddleSchoolMode}
            onClose={handleCloseSidePanel}
            penaltyPlus={penaltyPlus}
            penaltyMinus={penaltyMinus}
            timeLimitSec={timeLimitSec}
            mipGap={mipGap}
            onPenaltyPlusChange={setPenaltyPlus}
            onPenaltyMinusChange={setPenaltyMinus}
            onTimeLimitSecChange={setTimeLimitSec}
            onMipGapChange={setMipGap}
            onToggleSchoolStatus={handleToggleSchoolStatus}
            onToggleSchoolSelection={handleSchoolSelectionChange}
            onSelectAllSchools={handleSelectAllTowns}
            onClearAllSchools={handleClearAllTowns}
            schoolSelectionSummary={schoolSelectionSummary}
            optimizedDistrictData={optimizedDistrictDataForStats}
            optimizationBaselineStats={optimizationBaselineStats}
            displayMode={"original"}
          />
        )}

        {/* 地図エリア */}
        <div className="flex-1 relative">
          <MapComponent
            ref={mapRef}
            opacity={opacity}
            populationMultiplier={populationMultiplier}
            displaySettings={displaySettings}
            selectedMode={selectedMode}
            borderColor={borderColor}
            selectedYear={selectedYear}
            onYearChange={handleYearChange}
            onSwitchToElementaryMode={handleSwitchToElementaryMode}
            onSwitchToMiddleSchoolMode={handleSwitchToMiddleSchoolMode}
            onResetToInitialState={handleResetToInitialState}
            onSchoolDataChange={handleSchoolDataChange}
            onSelectedSchoolChange={handleSelectedSchoolChange}
            penaltyPlus={penaltyPlus}
            penaltyMinus={penaltyMinus}
            timeLimitSec={timeLimitSec}
            mipGap={mipGap}
            onOptimizedDistrictDataChange={setOptimizedDistrictDataForStats}
            onSchoolSelectionSummaryChange={handleSchoolSelectionSummaryChange}
            isEditing={isEditing}
            onEditingChange={setIsEditing}
            onOptimizationBaselineChange={setOptimizationBaselineStats}
          />
        </div>
      </div>
    </div>
  )
}
