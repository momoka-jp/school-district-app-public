"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type React from "react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, MapPin, Users, X, Building, Filter } from "lucide-react"
import { useState, useMemo, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import type { SchoolGeoJSONData, SchoolOptimizationOption } from "@/types/map-types"

interface SchoolsTabProps {
  schoolData: SchoolGeoJSONData | null
  selectedMode: "Name_1" | "Name_2"
  displayMode?: "original" | "current" | "optimized"
  onSwitchToElementaryMode: () => void
  onSwitchToMiddleSchoolMode: () => void
  onToggleSchoolStatus: (schoolName: string, newIsClosed: boolean) => Promise<void>
  onToggleSchoolSelection: (schoolName: string, include: boolean) => Promise<void> | void
  onSelectAllSchools: () => Promise<void> | void
  onClearAllSchools: () => Promise<void> | void
  schoolSelectionSummary: Record<
    string,
    {
      Name_1: { total: number; selected: number; fixed: number }
      Name_2: { total: number; selected: number; fixed: number }
    }
  >
}

type SchoolListItem = {
  id: string
  name: string
  prefecture: string
  city: string
  isClosed: boolean
  min_students?: number
  max_students?: number
  selectionInfo: { total: number; selected: number; fixed: number }
  selectionState: "none" | "partial" | "all"
  schoolType: "elementary" | "middle" | "other"
  optimizationOption: SchoolOptimizationOption
}

export default function SchoolsTab({
  schoolData,
  selectedMode,
  displayMode = "current",
  onSwitchToElementaryMode,
  onSwitchToMiddleSchoolMode,
  onToggleSchoolStatus,
  onToggleSchoolSelection,
  onSelectAllSchools,
  onClearAllSchools,
  schoolSelectionSummary,
}: SchoolsTabProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSchool, setSelectedSchool] = useState<SchoolListItem | null>(null)
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(
    () =>
      new Set(
        selectedMode === "Name_1"
          ? ["elementary", "operating", "closed"]
          : ["middle", "operating", "closed"],
      ),
  )
  const [localSchoolStates, setLocalSchoolStates] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!selectedSchool || !schoolData?.features) return
    const feat = schoolData.features.find(
      (f: SchoolGeoJSONData["features"][number]) => f?.properties?.name === selectedSchool.name,
    )
    if (!feat) return
    const realIsClosed = feat.properties?.isClosed === true
    const summaryEntry = schoolSelectionSummary[selectedSchool.name]
    const selectedType = selectedSchool.name?.endsWith("小学校")
      ? "Name_1"
      : selectedSchool.name?.endsWith("中学校")
        ? "Name_2"
        : selectedMode
    const summaryStats = summaryEntry ? summaryEntry[selectedType] : { total: 0, selected: 0, fixed: 0 }
    const nextState: SchoolListItem["selectionState"] =
      summaryStats.total === 0
        ? "none"
        : summaryStats.selected === summaryStats.total
          ? "all"
          : summaryStats.selected === 0
            ? "none"
            : "partial"
    setSelectedSchool((prev) =>
      prev
        ? {
            ...prev,
            isClosed: realIsClosed,
            selectionInfo: summaryStats,
            selectionState: nextState,
          }
        : prev
    )
  }, [schoolData, selectedSchool, schoolSelectionSummary, selectedMode])

  useEffect(() => {
    setSelectedFilters((prev) => {
      const next = new Set(prev)
      next.delete("elementary")
      next.delete("middle")
      next.add(selectedMode === "Name_1" ? "elementary" : "middle")
      next.add("operating")
      next.add("closed")
      return next
    })
  }, [selectedMode])

  // 学校データを変換
  const schools = useMemo(() => {
    if (!schoolData?.features) return []

    return schoolData.features.map((feature: SchoolGeoJSONData["features"][number]) => {
      const schoolName = feature.properties.name
      const isElementary = schoolName.endsWith("小学校")
      const isMiddle = schoolName.endsWith("中学校")

      const originalIsClosed = feature.properties.isClosed === true
      const assignedSho = Number(feature.properties.assignedStudentsSho ?? 0)
      const assignedChu = Number(feature.properties.assignedStudentsChu ?? 0)
      const assignedForMode = selectedMode === "Name_1" ? assignedSho : assignedChu
      const effectiveIsClosed =
        displayMode === "optimized" ? originalIsClosed || assignedForMode === 0 : originalIsClosed

      const isClosed = Object.prototype.hasOwnProperty.call(localSchoolStates, schoolName)
        ? localSchoolStates[schoolName]
        : effectiveIsClosed

      const summaryEntry = schoolSelectionSummary[schoolName]
      const modeKey: "Name_1" | "Name_2" = isElementary ? "Name_1" : isMiddle ? "Name_2" : selectedMode
      const selectionInfo = summaryEntry ? summaryEntry[modeKey] : { total: 0, selected: 0, fixed: 0 }
      const selectionState: SchoolListItem["selectionState"] =
        selectionInfo.total === 0
          ? "none"
          : selectionInfo.selected === selectionInfo.total
            ? "all"
            : selectionInfo.selected === 0
              ? "none"
              : "partial"

      const schoolType: "elementary" | "middle" | "other" = isElementary ? "elementary" : isMiddle ? "middle" : "other"

      return {
        id: schoolName,
        name: schoolName,
        prefecture: "奈良県",
        city: "奈良市",
        isClosed,
        min_students: feature.properties.min_students,
        max_students: feature.properties.max_students,
        selectionInfo,
        selectionState,
        schoolType,
        optimizationOption: (feature.properties.optimizationOption as SchoolOptimizationOption) ?? "default",
      }
    })
  }, [schoolData, localSchoolStates, schoolSelectionSummary, selectedMode, displayMode])

  // 学校の状態をトグルする関数
  const toggleSchoolStatus = async (school: SchoolListItem, event: React.MouseEvent) => {
    event.stopPropagation() // 親要素のクリックイベントを防ぐ

    const newStatus = !school.isClosed

    // ローカル状態を即座に更新
    setLocalSchoolStates((prev) => ({
      ...prev,
      [school.name]: newStatus,
    }))

    // 選択中の学校の状態も更新
    if (selectedSchool && selectedSchool.name === school.name) {
      setSelectedSchool({
        ...selectedSchool,
        isClosed: newStatus,
      })
    }

    // 親コンポーネントに変更を通知

    try {
      await onToggleSchoolStatus(school.name, newStatus)
      setLocalSchoolStates((prev) => {
        const { [school.name]: _, ...rest } = prev
        return rest
      })
    } catch (error) {
      console.error("学校状態の更新に失敗しました:", error)
      // エラーが発生した場合、ローカル状態を元に戻す
      setLocalSchoolStates((prev) => ({
        ...prev,
        [school.name]: school.isClosed,
      }))

      if (selectedSchool && selectedSchool.name === school.name) {
        setSelectedSchool({
          ...selectedSchool,
          isClosed: school.isClosed,
        })
      }
    }
  }

  const toggleSchoolSelection = async (school: SchoolListItem, event: React.MouseEvent) => {
    event.stopPropagation()

    const info = school.selectionInfo ?? { total: 0, selected: 0, fixed: 0 }
    if (info.total === 0) return
    const shouldInclude = !(info.total > 0 && info.selected === info.total)

    try {
      await onToggleSchoolSelection(school.name, shouldInclude)
    } catch (error) {
      console.error("最適化対象の更新に失敗しました:", error)
    }
  }

  const toggleFilter = (filterType: string) => {
    setSelectedFilters((prev) => {
      const newFilters = new Set(prev)
      if (newFilters.has(filterType)) {
        newFilters.delete(filterType)
      } else {
        newFilters.add(filterType)
      }
      return newFilters
    })
  }

  const filteredSchools = useMemo(() => {
    let filtered = schools

    const activeCategories = Array.from(selectedFilters).filter((f) => f === "elementary" || f === "middle")
    const requireOperating = selectedFilters.has("operating")
    const requireClosed = selectedFilters.has("closed")
    const requireExcluded = selectedFilters.has("excluded")
    const categoryFilters = activeCategories.length > 0 ? activeCategories : ["elementary", "middle"]
    const hasOperatingFilter = requireOperating || requireClosed
    const allowOperating = !hasOperatingFilter || requireOperating
    const allowClosed = !hasOperatingFilter || requireClosed

    if (
      activeCategories.length > 0 ||
      requireOperating ||
      requireClosed ||
      requireExcluded
    ) {
      filtered = filtered.filter((school: SchoolListItem) => {
        const matchesCategory = () => {
          const type = school.schoolType as "elementary" | "middle" | "other"
          if (type === "other") return false
          return categoryFilters.includes(type)
        }

        if (!matchesCategory()) return false
        if (school.isClosed ? !allowClosed : !allowOperating) return false
        if (requireExcluded && school.optimizationOption !== "excluded") return false

        return true
      })
    }

    if (searchTerm) {
      filtered = filtered.filter((school: SchoolListItem) =>
        school.name.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    return filtered
  }, [schools, searchTerm, selectedFilters])

  const clearSearch = () => {
    setSearchTerm("")
  }

  const clearSelection = () => {
    setSelectedSchool(null)
  }

  if (!schoolData?.features) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <MapPin size={48} className="mx-auto mb-2 opacity-50" />
          <p>学校データ</p>
          <p className="text-sm">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 検索とフィルター */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search size={16} />
            学校検索
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 検索バー */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="学校名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* 検索結果数 */}
          <div className="text-sm text-gray-500">{filteredSchools.length} 件の学校が見つかりました</div>
        </CardContent>
      </Card>

      {/* 学校リスト */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin size={16} />
            学校一覧
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            <div className="text-sm font-medium text-gray-700">絞り込み条件（複数選択可）:</div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={selectedFilters.has("elementary") ? "default" : "outline"}
                onClick={() => toggleFilter("elementary")}
                className="flex items-center gap-1"
              >
                <Building size={14} />
                小学校
              </Button>
              <Button
                size="sm"
                variant={selectedFilters.has("middle") ? "default" : "outline"}
                onClick={() => toggleFilter("middle")}
                className="flex items-center gap-1"
              >
                <Building size={14} />
                中学校
              </Button>
              <Button
                size="sm"
                variant={selectedFilters.has("operating") ? "default" : "outline"}
                onClick={() => toggleFilter("operating")}
                className="flex items-center gap-1"
              >
                <Users size={14} />
                運営中
              </Button>
              <Button
                size="sm"
                variant={selectedFilters.has("closed") ? "default" : "outline"}
                onClick={() => toggleFilter("closed")}
                className="flex items-center gap-1"
              >
                <Users size={14} />
                廃校
              </Button>
              <Button
                size="sm"
                variant={selectedFilters.has("excluded") ? "default" : "outline"}
                onClick={() => toggleFilter("excluded")}
                className="flex items-center gap-1"
              >
                <Filter size={14} />
                最適化対象外
              </Button>
            </div>
            {selectedFilters.size > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">選択中:</span>
                <div className="flex flex-wrap gap-1">
                  {Array.from(selectedFilters).map((filter) => (
                    <Badge key={filter} variant="secondary" className="text-xs">
                      {filter === "elementary"
                        ? "小学校"
                        : filter === "middle"
                          ? "中学校"
                          : filter === "operating"
                            ? "運営中"
                            : filter === "closed"
                              ? "廃校"
                              : "最適化対象外"}
                    </Badge>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFilters(new Set())}
                  className="h-6 px-2 text-xs"
                >
                  クリア
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">最適化範囲</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onSelectAllSchools(); }}>
                全選択
              </Button>
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onClearAllSchools(); }}>
                全解除
              </Button>
            </div>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredSchools.map((school: SchoolListItem) => {
              const checkboxState = school.selectionInfo.total === 0
                ? false
                : school.selectionState === "all"
                  ? true
                  : school.selectionState === "none"
                    ? false
                    : "indeterminate"
              return (
                <div
                  key={school.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedSchool?.id === school.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedSchool(school)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={checkboxState}
                        onCheckedChange={(value) => {
                          const include = value === true
                          onToggleSchoolSelection(school.name, include)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4"
                        disabled={school.selectionInfo.total === 0}
                      />
                      <div className="font-medium text-sm flex items-center gap-2">
                        {school.name.includes("小学校") ? (
                          <Building size={14} className="text-blue-600" />
                        ) : school.name.includes("中学校") ? (
                          <Building size={14} className="text-purple-600" />
                        ) : (
                          <MapPin size={14} className="text-gray-600" />
                        )}
                        {school.name}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-2">
                      <span>
                        {school.prefecture} {school.city}
                      </span>
                      <span className="hidden sm:inline text-gray-400">/</span>
                      <span className="text-gray-400">
                        {school.selectionInfo.selected} / {school.selectionInfo.total} 町丁目選択
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {school.name.includes("小学校") && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 text-xs">
                          小学校
                        </Badge>
                      )}
                      {school.name.includes("中学校") && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                          中学校
                        </Badge>
                      )}
                      <button
                        onClick={(e) => toggleSchoolStatus(school, e)}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 hover:scale-105 ${
                          school.isClosed
                            ? "bg-red-100 text-red-700 hover:bg-red-200 border border-red-300"
                            : "bg-green-100 text-green-700 hover:bg-green-200 border border-green-300"
                        }`}
                      >
                        {school.isClosed ? "廃校中" : "運営中"}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredSchools.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <MapPin size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">該当する学校が見つかりませんでした</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 選択された学校の詳細 */}
      {selectedSchool && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users size={16} />
                学校詳細
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                <X size={16} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                {selectedSchool.name.includes("小学校") ? (
                  <Building size={20} className="text-blue-600" />
                ) : selectedSchool.name.includes("中学校") ? (
                  <Building size={20} className="text-purple-600" />
                ) : (
                  <MapPin size={20} className="text-gray-600" />
                )}
                {selectedSchool.name}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">所在地:</span>
                  <span>
                    {selectedSchool.prefecture} {selectedSchool.city}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">状態:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => toggleSchoolStatus(selectedSchool, e)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                        selectedSchool.isClosed
                          ? "bg-red-100 text-red-700 hover:bg-red-200 border border-red-300"
                          : "bg-green-100 text-green-700 hover:bg-green-200 border border-green-300"
                      }`}
                    >
                      {selectedSchool.isClosed ? "廃校中" : "運営中"}
                    </button>
                    <span className="text-xs text-gray-500">クリックで切り替え</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">最適化範囲:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => toggleSchoolSelection(selectedSchool, e)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105 ${
                        selectedSchool.selectionInfo?.total > 0 &&
                        selectedSchool.selectionInfo?.selected === selectedSchool.selectionInfo?.total
                          ? "bg-sky-100 text-sky-700 hover:bg-sky-200 border border-sky-300"
                          : selectedSchool.selectionInfo?.selected === 0
                            ? "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                            : "bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300"
                      }`}
                    >
                      {selectedSchool.selectionInfo?.total === 0
                        ? "対象なし"
                        : selectedSchool.selectionInfo?.selected === selectedSchool.selectionInfo?.total
                          ? "全て含める"
                          : selectedSchool.selectionInfo?.selected === 0
                            ? "除外中"
                            : "一部選択"}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>選択済み町丁目数</span>
                  <span>
                    {selectedSchool.selectionInfo?.selected ?? 0} / {selectedSchool.selectionInfo?.total ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">最小生徒数:</span>
                  <span>{selectedSchool.min_students} 人</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">最大生徒数:</span>
                  <span>{selectedSchool.max_students} 人</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
