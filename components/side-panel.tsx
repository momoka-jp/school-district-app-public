"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X, Settings, BarChart3, School, FileText } from "lucide-react"
import SettingsTab from "./tabs/settings-tab"
import StatisticsTab from "./tabs/statistics-tab"
import FilesTab from "./tabs/files-tab"
import SchoolsTab from "./tabs/schools-tab"
import type { SidePanelProps } from "@/types/map-types"

export default function SidePanel({
  opacity,
  populationMultiplier,
  displaySettings,
  displayMode,
  schoolData,
  selectedYear,
  penaltyPlus,
  penaltyMinus,
  timeLimitSec,
  mipGap,
  onYearChange,
  selectedMode,
  onOpacityChange,
  onPopulationChange,
  onDisplaySettingChange,
  onExcludedModeChange,
  onPenaltyPlusChange,
  onPenaltyMinusChange,
  onTimeLimitSecChange,
  onMipGapChange,
  onSaveGeoJSON,
  onLoadGeoJSON,
  onExportSchoolsCSV,
  onExportDistrictsCSV,
  onExportMapAsImage,
  isExportingMap,
  onShowComparison,
  onSwitchToElementaryMode,
  onSwitchToMiddleSchoolMode,
  onClose,
  onToggleSchoolStatus,
  onToggleSchoolSelection,
  onSelectAllSchools,
  onClearAllSchools,
  schoolSelectionSummary,
  optimizedDistrictData,
  optimizationBaselineStats,
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState("settings")
  // ★ available_years.json から読む年度一覧
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const tabTriggerClass =
    "flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium " +
    "text-gray-600 transition-colors rounded-md " +
    "data-[state=active]:bg-gray-900 data-[state=active]:text-white " +
    "data-[state=inactive]:hover:text-gray-900 data-[state=inactive]:hover:bg-gray-50 " +
    "ring-0 outline-none focus-visible:ring-0 focus-visible:bg-gray-200"
  
      useEffect(() => {
        async function loadYears() {
          try {
            const configRes = await fetch("/data/config.json")
            const config = configRes.ok ? await configRes.json() : {}
            const yearsFilename =
              typeof config?.available_years_filename === "string" && config.available_years_filename
                ? config.available_years_filename
                : "available_years.json"

            const res = await fetch(`/data/output/${yearsFilename}`)
            if (!res.ok) throw new Error("failed to load available_years.json")

            const data = await res.json()

            if (Array.isArray(data.years) && data.years.length > 0) {
              const years: number[] = data.years
              setAvailableYears(years)

              // いまの selectedYear が範囲外なら先頭にそろえる
              if (!years.includes(selectedYear)) {
                onYearChange([years[0]])
              }
            } else {
              throw new Error("invalid years format")
            }
          } catch (e) {
            console.error("年度一覧の読み込みに失敗しました", e)
            // フォールバック（以前と同じ 2025–2031）
            const fallback = [2025, 2026, 2027, 2028, 2029, 2030, 2031]
            setAvailableYears(fallback)
            if (!fallback.includes(selectedYear)) {
              onYearChange([fallback[0]])
            }
          }
        }

        loadYears()
      }, [selectedYear, onYearChange])


  return (
    <div className="w-[20rem] bg-white border-r border-gray-200 flex flex-col h-full">
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">設定パネル</h2>
        <Button variant="ghost" size="sm" onClick={onClose} className="p-1 h-8 w-8">
          <X size={16} />
        </Button>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-[90%] grid-cols-4 mx-4 mt-2 mb-2 h-10 rounded-lg border border-gray-200 bg-gray-100 p-1 overflow-hidden">
            <TabsTrigger value="settings" className={tabTriggerClass} title="設定">
              <Settings size={16} />
            </TabsTrigger>
            <TabsTrigger value="statistics" className={tabTriggerClass} title="統計">
              <BarChart3 size={16} />
            </TabsTrigger>
            <TabsTrigger value="schools" className={tabTriggerClass} title="学校一覧">
              <School size={16} />
            </TabsTrigger>
            <TabsTrigger value="files" className={tabTriggerClass} title="ファイル">
              <FileText size={16} />
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <TabsContent value="settings" className="h-full m-0 mt-2">
              <SettingsTab
                opacity={opacity}
                populationMultiplier={populationMultiplier}
                displaySettings={displaySettings}
                penaltyPlus={penaltyPlus}
                penaltyMinus={penaltyMinus}
                timeLimitSec={timeLimitSec}
                mipGap={mipGap}
                onOpacityChange={onOpacityChange}
                onPopulationChange={onPopulationChange}
                onDisplaySettingChange={onDisplaySettingChange}
                onPenaltyPlusChange={onPenaltyPlusChange}
                onPenaltyMinusChange={onPenaltyMinusChange}
                onTimeLimitSecChange={onTimeLimitSecChange}
                onMipGapChange={onMipGapChange}
                selectedYear={selectedYear}
                onYearChange={onYearChange}
                availableYears={availableYears}
              />
            </TabsContent>

            <TabsContent value="statistics" className="h-full m-0 mt-2">
              <StatisticsTab
                schoolData={schoolData}
                selectedMode={selectedMode}
                optimizedDistrictData={optimizedDistrictData}
                baselineSnapshot={optimizationBaselineStats}
              />
            </TabsContent>

            <TabsContent value="schools" className="h-full m-0 mt-2">
              <SchoolsTab
                schoolData={schoolData}
                selectedMode={selectedMode}
                displayMode={displayMode}
                onSwitchToElementaryMode={onSwitchToElementaryMode}
                onSwitchToMiddleSchoolMode={onSwitchToMiddleSchoolMode}
                onToggleSchoolStatus={onToggleSchoolStatus}
                onToggleSchoolSelection={onToggleSchoolSelection}
                onSelectAllSchools={onSelectAllSchools}
                onClearAllSchools={onClearAllSchools}
                schoolSelectionSummary={schoolSelectionSummary}
              />
            </TabsContent>

            <TabsContent value="files" className="h-full m-0 mt-2">
              <FilesTab
                onSaveGeoJSON={onSaveGeoJSON}
                onLoadGeoJSON={onLoadGeoJSON}
                onExportSchoolsCSV={onExportSchoolsCSV}
                onExportDistrictsCSV={onExportDistrictsCSV}
                onExportMapAsImage={onExportMapAsImage}
                isExportingMap={isExportingMap}
                selectedMode={selectedMode}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
