"use client"

import { useState, type ChangeEvent } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getColor } from "@/lib/utils"
import { Calculator, RotateCcw, HelpCircle, ChevronDown, Printer } from "lucide-react"
import type { ControlPanelProps, DisplayMode, MapExportOptions, SchoolGeoJSONData } from "@/types/map-types"

type ModeKey = "Name_1" | "Name_2"

type OutOfRangeSchool = {
  name: string
  assigned: number
  min: number
  max: number
  usagePercent: number
}

const parseStudentCount = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const numeric = Number(String(value).replace(/[, ]/g, ""))
  return Number.isFinite(numeric) ? numeric : null
}

const isElementarySchoolName = (name: string) =>
  name.includes("小学校") || (!name.includes("中学校") && name.includes("小"))

const isMiddleSchoolName = (name: string) =>
  name.includes("中学校") || (!name.includes("小学校") && name.includes("中"))

const calculateSchoolsWithinCapacityByMode = (
  schoolData: SchoolGeoJSONData | null | undefined,
  selectedMode: ModeKey,
): { total: number; withinCapacity: number; outOfRangeSchools: OutOfRangeSchool[] } => {
  if (!schoolData?.features?.length) {
    return { total: 0, withinCapacity: 0, outOfRangeSchools: [] }
  }

  const isElementaryMode = selectedMode === "Name_1"
  const assignmentKey: "assignedStudentsSho" | "assignedStudentsChu" = isElementaryMode
    ? "assignedStudentsSho"
    : "assignedStudentsChu"

  return schoolData.features.reduce(
    (stats, feature: SchoolGeoJSONData["features"][number]) => {
      const properties = feature?.properties
      if (!properties || properties.isClosed) return stats

      const name = String(properties.name ?? "")
      const isTargetSchool = isElementaryMode ? isElementarySchoolName(name) : isMiddleSchoolName(name)
      if (!isTargetSchool) return stats

      const min = parseStudentCount(properties.min_students ?? properties.minStudents)
      const max = parseStudentCount(properties.max_students ?? properties.maxStudents)
      if (min === null || max === null) return stats

      const assigned = parseStudentCount(properties[assignmentKey])
      if (assigned === null) return stats

      stats.total += 1
      if (assigned >= min && assigned <= max) {
        stats.withinCapacity += 1
      } else {
        const usagePercent = max > 0 ? Math.round((assigned / max) * 100) : 0
        stats.outOfRangeSchools.push({ name, assigned, min, max, usagePercent })
      }

      return stats
    },
    { total: 0, withinCapacity: 0, outOfRangeSchools: [] as OutOfRangeSchool[] },
  )
}


export default function ControlPanel({
  displayMode,
  selectedSchool,
  selectedSchoolIsClosed,
  averageDistance,
  isOptimizing,
  optimizedDistrictData,
  schoolData, // schoolDataプロパティを追加
  selectedMode, // selectedModeプロパティを追加
  onDisplayModeChange,
  onClearSchoolInfo,
  onRunOptimization,
  onResetDistricts,
  onExportMapAsImage,
}: ControlPanelProps) {
  const capacityStats = calculateSchoolsWithinCapacityByMode(schoolData, selectedMode)
  const modeLabel = selectedMode === "Name_1" ? "小学校" : "中学校"
  const capacityPercentage =
    capacityStats.total > 0 ? Math.round((capacityStats.withinCapacity / capacityStats.total) * 100) : 0
  const buttonTextColor =
    selectedSchool && selectedMode !== "Name_1"
      ? "text-white"
      : "text-black"
  const buttonBackgroundColor = selectedSchool ? getColor(selectedSchool, selectedMode) : "white"
  const [showOutOfRange, setShowOutOfRange] = useState(false)
  const hasOutOfRangeSchools = capacityStats.outOfRangeSchools.length > 0 && selectedMode === "Name_1"

  const [isPrintPopoverOpen, setIsPrintPopoverOpen] = useState(false)
  const [printOptions, setPrintOptions] = useState<MapExportOptions>({
    elementaryMarkers: true,
    middleMarkers: true,
    labels: true,
    disabledMarkers: true,
    closedMarkers: true,
    filename: "",
  })

  type BooleanExportOptionKey = "elementaryMarkers" | "middleMarkers" | "labels" | "disabledMarkers" | "closedMarkers"

  const handleExportOptionToggle = (key: BooleanExportOptionKey) => (checked: boolean | "indeterminate") => {
    setPrintOptions((prev) => ({
      ...prev,
      [key]: Boolean(checked),
    }))
  }

  const handleFilenameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setPrintOptions((prev) => ({ ...prev, filename: value }))
  }

  const handleConfirmExportImage = () => {
    const { filename, ...rest } = printOptions
    const trimmed = filename?.trim()
    onExportMapAsImage({
      ...rest,
      filename: trimmed ? trimmed : undefined,
    })
    setIsPrintPopoverOpen(false)
  }

  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 w-64">
      {/* 表示モード切り替えセレクトボックス */}
      <div className="bg-white p-2 rounded-md shadow-md">
        <label className="block text-sm font-medium mb-1">表示モード</label>
        <select
          value={displayMode}
          onChange={(e) => onDisplayModeChange(e.target.value as DisplayMode)}
          className="w-full p-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="current">現在の割り当て</option>
          <option value="original">既存校区</option>
          <option value="optimized" disabled={!optimizedDistrictData}>
            最適化結果{!optimizedDistrictData ? " (未計算)" : ""}
          </option>
        </select>
      </div>

      {/* 選択中の学校表示 */}
      <Button
        variant="outline"
        className={`bg-white ${buttonTextColor}`}
        style={{
          backgroundColor: buttonBackgroundColor,
        }}
        onClick={onClearSchoolInfo}
      >
        選択: {selectedSchool || "なし"}
        {selectedSchoolIsClosed ? " (廃校)" : ""}
      </Button>

      {/* 平均通学距離表示 */}
      <div className="bg-white p-2 rounded-md shadow-md">
        <div className="text-sm font-medium">平均通学距離</div>
        <div className="text-lg font-bold">
          {averageDistance !== null ? `${averageDistance.toFixed(2)} km` : "計算中..."}
        </div>
      </div>

      {/* 適正規模学校数の計算状況を確認 */}
      <div className="bg-white p-2 rounded-md shadow-md">
        <div className="text-sm font-medium">適正規模{modeLabel}数</div>
        <div className="text-lg font-bold">
          {capacityStats.withinCapacity} / {capacityStats.total}校
        </div>
        <div className="text-xs text-gray-500 mt-1">({capacityPercentage}%)</div>
        {hasOutOfRangeSchools && (
          <div className="mt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-between px-2"
              onClick={() => setShowOutOfRange((prev) => !prev)}
            >
              <span>適正規模外の学校一覧</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${showOutOfRange ? "rotate-180" : ""}`}
              />
            </Button>
            {showOutOfRange && (
              <ul className="mt-2 max-h-32 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-2 text-xs leading-5 text-gray-700">
                {capacityStats.outOfRangeSchools.map((school) => (
                  <li key={school.name}>
                    {school.name}（容量使用率: {school.usagePercent}%）
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 操作ボタン */}
      <div className="bg-white p-1 rounded-md shadow-md flex flex-col gap-1">
        <Button
          variant="outline"
          onClick={onRunOptimization}
          className="flex items-center gap-1 bg-transparent"
          disabled={isOptimizing}
        >
          <Calculator size={16} className="mr-1" />
          {isOptimizing ? "計算中..." : "最適化計算"}
        </Button>
        <Button variant="outline" onClick={onResetDistricts} className="flex items-center gap-1 bg-transparent">
          <RotateCcw size={16} className="mr-1" />
          リセット
        </Button>
        
        <Button asChild variant="outline" className="flex items-center gap-1 bg-transparent">
          <Link href="/usage">
            <HelpCircle size={16} className="mr-1" />
            使用方法
          </Link>
        </Button>
      </div>
    </div>
  )
}
