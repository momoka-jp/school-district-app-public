"use client"

import { useCallback, useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { SchoolOptimizationOption } from "@/types/map-types"
import { SCHOOL_SELECTION_SUMMARY_EVENT, type SelectionSummaryMap } from "@/lib/event-constants"

interface SchoolPopupProps {
  schoolName: string
  schoolType: "小学校" | "中学校" | "その他"
  minStudents: number | string
  maxStudents: number | string
  assignedStudents: number
  isClosed: boolean
  optimizationOption: SchoolOptimizationOption
  displayMode: "original" | "current" | "optimized"
  isUpdating: boolean
  averageDistance: number | null
  onUpdateSchoolOption: (schoolName: string, option: SchoolOptimizationOption) => Promise<void>
  selectionInfo: { total: number; selected: number; fixed: number }
  onToggleSchoolSelection: (schoolName: string, include: boolean) => Promise<void> | void
  onToggleBulkFix?: (fix: boolean) => Promise<void> | void
  onClose: () => void
}

const quadItems: Array<{
  value: SchoolOptimizationOption
  short: string
  long: string
  description: string
}> = [
  { value: "default",     short: "開校",     long: "開校（最適化範囲に含む）", description: "最適化対象として通常通り扱います。" },
  { value: "closed",      short: "廃校",     long: "廃校（割当不可）",         description: "この学校へは最適化で割り当てられません（y = 0）。" },
  { value: "forced_open", short: "強制開校", long: "強制開校",                 description: "必ず開校させます。割当 0 人でも閉校扱いにしません（y = 1）。" },
  { value: "excluded",    short: "対象外",   long: "対象外",                   description: "この学校を最適化候補から外します（変数を生成しません）。" },
]

export default function SchoolPopup({
  schoolName,
  schoolType,
  minStudents,
  maxStudents,
  assignedStudents,
  isClosed,
  optimizationOption,
  displayMode,
  isUpdating,
  averageDistance,
  onUpdateSchoolOption,
  selectionInfo,
  onToggleSchoolSelection,
  onToggleBulkFix,
  onClose,
}: SchoolPopupProps) {
  const [isSelectionProcessing, setIsSelectionProcessing] = useState(false)
  const [optionProcessing, setOptionProcessing] = useState(false)
  const [bulkFixProcessing, setBulkFixProcessing] = useState(false)
  const [localSelectionInfo, setLocalSelectionInfo] = useState(selectionInfo)

  const modeKey: "Name_1" | "Name_2" | null =
    schoolType === "小学校" ? "Name_1" : schoolType === "中学校" ? "Name_2" : null

  const applySelectionEntry = useCallback((entry?: { total: number; selected: number; fixed: number }) => {
    if (!entry) return
    setLocalSelectionInfo((prev) => {
      if (prev.total === entry.total && prev.selected === entry.selected && prev.fixed === entry.fixed) return prev
      return entry
    })
  }, [])

  useEffect(() => {
    if (typeof window === "undefined" || !modeKey) return
    const summary = window.__schoolSelectionSummaryCache as SelectionSummaryMap | undefined
    const entry = summary?.[schoolName]?.[modeKey]
    applySelectionEntry(entry)
  }, [schoolName, modeKey, applySelectionEntry])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleSelectionSummaryUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ summary?: SelectionSummaryMap }>
      const summary = customEvent.detail?.summary
      if (!summary || !modeKey) return
      const entry = summary[schoolName]?.[modeKey]
      applySelectionEntry(entry)
    }
    window.addEventListener(SCHOOL_SELECTION_SUMMARY_EVENT, handleSelectionSummaryUpdate)
    return () => window.removeEventListener(SCHOOL_SELECTION_SUMMARY_EVENT, handleSelectionSummaryUpdate)
  }, [schoolName, modeKey, applySelectionEntry])

  const isOriginalMode = displayMode === "original"
  const isClosedEffective = isClosed || optimizationOption === "closed" || optimizationOption === "excluded"
  const displayedStudents = isClosedEffective ? 0 : assignedStudents

  const handleToggleSelection = async () => {
    if (isOriginalMode || localSelectionInfo.total === 0 || isSelectionProcessing) return
    const shouldInclude = localSelectionInfo.selected !== localSelectionInfo.total
    try {
      setIsSelectionProcessing(true)
      await onToggleSchoolSelection(schoolName, shouldInclude)
      setLocalSelectionInfo((prev) => ({
        ...prev,
        selected: shouldInclude ? prev.total : 0,
      }))
    } finally {
      setIsSelectionProcessing(false)
    }
  }

  const handleToggleBulkFix = async () => {
    if (bulkFixDisabled || bulkFixProcessing || !onToggleBulkFix || !modeKey) return
    const isAllFixed = localSelectionInfo.total > 0 && localSelectionInfo.fixed === localSelectionInfo.total
    const shouldFix = !isAllFixed
    const prevFixed = localSelectionInfo.fixed
    try {
      setBulkFixProcessing(true)
      setLocalSelectionInfo((prev) => ({
        ...prev,
        fixed: shouldFix ? prev.total : 0,
      }))
      await onToggleBulkFix(shouldFix)
    } catch (error) {
      console.error("一括固定の更新に失敗しました:", error)
      setLocalSelectionInfo((prev) => ({
        ...prev,
        fixed: prevFixed,
      }))
    } finally {
      setBulkFixProcessing(false)
    }
  }

  const handleOptionChange = async (value: string) => {
    if (isOriginalMode || isUpdating || optionProcessing) return
    if (value === optimizationOption) return
    try {
      setOptionProcessing(true)
      await onUpdateSchoolOption(schoolName, value as SchoolOptimizationOption)
      onClose()
    } finally {
      setOptionProcessing(false)
    }
  }

  const selectionState =
    localSelectionInfo.total === 0
      ? false
      : localSelectionInfo.selected === localSelectionInfo.total
        ? true
        : localSelectionInfo.selected === 0
          ? false
          : "indeterminate"

  const bulkFixState: boolean | "indeterminate" =
    localSelectionInfo.total === 0
      ? false
      : localSelectionInfo.fixed === localSelectionInfo.total
        ? true
        : localSelectionInfo.fixed === 0
          ? false
          : "indeterminate"

  const bulkFixDisabled = isOriginalMode || !modeKey || localSelectionInfo.total === 0 || !onToggleBulkFix

  const enrollmentStatus = (() => {
    if (typeof minStudents !== "number" || typeof maxStudents !== "number" || isClosedEffective) {
      return { status: "unknown", message: "情報なし", color: "text-gray-600" }
    }
    if (displayedStudents < minStudents) return { status: "under", message: "小規模", color: "text-orange-600" }
    if (displayedStudents > maxStudents) return { status: "over", message: "大規模", color: "text-red-600" }
    return { status: "appropriate", message: "適正規模", color: "text-green-600" }
  })()

  const capacityRate = (() => {
    if (typeof maxStudents !== "number" || maxStudents === 0) return 0
    return Math.round((displayedStudents / maxStudents) * 100)
  })()

  const progressBarColor = (() => {
    if (isClosedEffective) return "bg-gray-300"
    switch (enrollmentStatus.status) {
      case "over": return "bg-red-500"
      case "under": return "bg-orange-500"
      case "appropriate": return "bg-green-500"
      default: return "bg-gray-300"
    }
  })()

  const fmt1 = (n: number) =>
    Number.isFinite(n) ? n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "-"

  const isExcluded = String(optimizationOption) === "excluded"
  const effectiveAverageDistance = isClosedEffective || isExcluded ? null : averageDistance

  return (
    <div className="school-popup-content p-3 w-[260px]">
      {/* 学校基本情報（右上トグルボタン付き） */}
      <div className="mb-3">
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-4 h-4 rounded-full ${
                isClosedEffective
                  ? "bg-gray-500"
                  : schoolType === "小学校"
                    ? "bg-blue-500"
                    : schoolType === "中学校"
                      ? "bg-red-500"
                      : "bg-gray-500"
              }`}
            />
            <h3 className="font-bold text-base text-gray-900 truncate" title={schoolName}>
              {schoolName}
            </h3>
          </div>

        </div>

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Checkbox
            checked={selectionState}
            onCheckedChange={handleToggleSelection}
            disabled={isOriginalMode || localSelectionInfo.total === 0 || isSelectionProcessing}
            className="h-4 w-4"
          />
          <span className="font-medium">最適化に含める</span>
          <span className="text-xs text-gray-500">
            {localSelectionInfo.selected} / {localSelectionInfo.total} 町丁目
          </span>
          {localSelectionInfo.total === 0 && <span className="text-[10px] text-gray-400 ml-2">割当なし</span>}
          {isSelectionProcessing && <span className="text-[10px] text-blue-500 ml-2">更新中...</span>}
        </div>

        {modeKey && localSelectionInfo.total > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-700 mt-2">
            <Checkbox
              checked={bulkFixState}
              onCheckedChange={handleToggleBulkFix}
              disabled={bulkFixDisabled}
              className="h-4 w-4"
            />
            <div className="flex flex-col">
              <span className="font-medium">割当町丁目を一括固定</span>
              <span className="text-[10px] text-gray-500">
                {localSelectionInfo.fixed} / {localSelectionInfo.total} 固定
              </span>
            </div>
            {bulkFixProcessing && <span className="text-[10px] text-blue-500 ml-auto">更新中...</span>}
          </div>
        )}
      </div>

      {/* 生徒数情報 */}
      <div className="space-y-4 mb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-baseline gap-0.5">
            <span className="text-4xl font-bold text-gray-900">{fmt1(displayedStudents)}</span>
            <span className="text-sm text-gray-700">人</span>
          </div>
          <div className="flex flex-col items-end leading-tight">
            <span className="text-xs text-gray-500">適正</span>
            <span className="text-sm font-medium text-gray-700">{minStudents}～{maxStudents}人</span>
          </div>
        </div>

        <div className="w-full">
          <div className="flex justify-between items-baseline mb-0.5">
            <span className="text-xs text-gray-500">容量使用率</span>
            <span className={`text-base font-bold ${enrollmentStatus.color}`}>{capacityRate.toLocaleString()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`h-2 rounded-full transition-all duration-300 ${progressBarColor}`}
                 style={{ width: `${Math.min(capacityRate, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* 平均通学距離（コンパクト化） */}
      <div className="border-t pt-2 mt-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">平均通学距離</span>
          <span className="text-base font-bold text-blue-600">
            {effectiveAverageDistance !== null ? `${effectiveAverageDistance.toFixed(1)} km` : "算出なし"}
          </span>
        </div>
        {effectiveAverageDistance !== null && (
          <div className="mt-1">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  effectiveAverageDistance <= 2.0 ? "bg-green-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min((effectiveAverageDistance / 5.0) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
              <span>0km</span>
              <span className="text-[10px]">{effectiveAverageDistance <= 2.0 ? "適正" : "遠距離"}</span>
              <span>5km+</span>
            </div>
          </div>
        )}
      </div>

      {/* 最適化オプション（2×2 グリッド） */}
      <div className="border-t pt-3 mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">最適化での扱い</h4>
          {optionProcessing && <span className="text-[11px] text-blue-600">更新中...</span>}
        </div>

        <TooltipProvider delayDuration={120}>
          <RadioGroup value={optimizationOption} onValueChange={handleOptionChange}>
            <div className="grid grid-cols-2 gap-2">
              {quadItems.map((item) => {
                const disabled = isOriginalMode || isUpdating || optionProcessing
                const id = `${schoolName}-${item.value}`
                const active = optimizationOption === item.value
                return (
                  <Tooltip key={item.value}>
                    <TooltipTrigger asChild>
                      <Label
                        htmlFor={id}
                        className={[
                          "relative flex items-center justify-center rounded-lg border p-3 h-16 cursor-pointer select-none",
                          "text-sm font-medium transition-colors",
                          active ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white",
                          disabled ? "opacity-60 cursor-not-allowed" : "hover:border-blue-400",
                        ].join(" ")}
                      >
                        <RadioGroupItem id={id} value={item.value} className="absolute left-2 top-2" disabled={disabled} />
                        <span className="truncate">{item.short}</span>
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="start" className="max-w-xs text-xs leading-relaxed">
                      <div className="font-semibold mb-0.5">{item.long}</div>
                      <div className="text-gray-600">{item.description}</div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </RadioGroup>
        </TooltipProvider>

        {isOriginalMode && <p className="text-[11px] text-gray-500">既存校区モードでは最適化設定を変更できません</p>}
      </div>
    </div>
  )
}
