"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type React from "react"

import { Button } from "@/components/ui/button"
import { BarChart3, GraduationCap, School2, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useState, useEffect } from "react"
import { computeSchoolState } from "@/utils/school-state-utils"
import type {
  GeoJSONData,
  OptimizationComparisonSnapshot,
  SchoolComparisonMetrics,
  SchoolGeoJSONData,
} from "@/types/map-types"

interface StatisticsTabProps {
  districtData?: GeoJSONData | null
  schoolData?: SchoolGeoJSONData | null
  selectedMode?: "Name_1" | "Name_2"
  displayMode?: "original" | "current" | "optimized"
  optimizedDistrictData?: GeoJSONData | null
  baselineSnapshot?: OptimizationComparisonSnapshot | null
}

// ① 先頭あたりに小さな表示用コンポーネントを追加
function StatPill({
  tone, // "blue" | "green" | "red" | "purple"
  value,
  label,
}: {
  tone: "blue" | "green" | "red" | "purple"
  value: number | string
  label: string
}) {
  const toneMap = {
    blue: { box: "bg-blue-50", num: "text-blue-600", lab: "text-blue-700" },
    green: { box: "bg-green-50", num: "text-green-600", lab: "text-green-700" },
    red: { box: "bg-red-50", num: "text-red-600", lab: "text-red-700" },
    purple: { box: "bg-purple-50", num: "text-purple-600", lab: "text-purple-700" },
  }[tone]

  return (
    <div className={`flex-1 min-w-0 text-center p-3 rounded-lg ${toneMap.box}`}>
      <div className={`text-2xl font-bold ${toneMap.num}`}>{value}</div>
      <div className={`text-sm ${toneMap.lab}`}>{label}</div>
    </div>
  )
}

const parseStudentCount = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const numeric = Number(String(value).replace(/[, ]/g, ""))
  return Number.isFinite(numeric) ? numeric : null
}

const formatDistance = (value: number | null) => (value === null ? "–" : `${value.toFixed(2)} km`)

const formatCapacity = (stats: Pick<SchoolComparisonMetrics, "withinCapacity" | "capacityTotal">) =>
  stats.capacityTotal > 0 ? `${stats.withinCapacity} / ${stats.capacityTotal}校` : "–"

// 新しいComparisonCard: 縦列比較ベースに戻し、全指標を統合
function ComparisonCard({
  title,
  icon,
  baselineStats,
  optimizedStats,
}: {
  title: string
  icon: React.ReactNode
  baselineStats: SchoolComparisonMetrics
  optimizedStats: SchoolComparisonMetrics
}) {
  // preference: true=Lower is better (distance), false=Higher is better (operating, capacity)
  const getChangeIndicator = (current: number | null, optimized: number | null, preferLower = false, isClosedMetric = false) => {
    if (current === null || optimized === null) {
      return { icon: <Minus size={12} />, color: "text-gray-500", bg: "bg-gray-50", diff: 0 }
    }

    const diff = optimized - current
    const isChange = diff !== 0

    let color = "text-gray-500"
    let bg = "bg-gray-50"
    let icon = <Minus size={12} />

    if (isChange) {
      // 1. 廃校数 (closed) の特別処理 (赤色/上向き、緑色/下向き)
      if (isClosedMetric) {
        if (diff > 0) {
          // 廃校数増加: 赤色 + 上向き矢印 (ご要望)
          color = "text-red-600"
          bg = "bg-red-50"
          icon = <TrendingUp size={12} />
        } else {
          // 廃校数減少: 緑色 + 下向き矢印
          color = "text-emerald-600"
          bg = "bg-emerald-50"
          icon = <TrendingDown size={12} />
        }
      } 
      // 2. その他の指標 (運営中、適正規模校数、平均距離) の一般処理
      else {
        const improved = preferLower ? diff < 0 : diff > 0
        const worsened = preferLower ? diff > 0 : diff < 0

        if (improved) {
          color = "text-emerald-600"
          bg = "bg-emerald-50"
          // preferLower (距離) の場合は、改善(値減少)で下向き矢印
          // preferLower = false (運営中、規模) の場合は、改善(値増加)で上向き矢印
          icon = preferLower ? <TrendingDown size={12} /> : <TrendingUp size={12} /> 
        } else if (worsened) {
          color = "text-red-600"
          bg = "bg-red-50"
          // preferLower (距離) の場合は、悪化(値増加)で上向き矢印
          // preferLower = false (運営中、規模) の場合は、悪化(値減少)で下向き矢印
          icon = preferLower ? <TrendingUp size={12} /> : <TrendingDown size={12} />
        }
      }
    }

    return { icon, color, bg, diff }
  }

  // School Stats
  const operatingChange = getChangeIndicator(baselineStats.operating, optimizedStats.operating)

  // 廃校数: 赤色/上向きロジック適用 (isClosedMetric=true)
  const closedChange = getChangeIndicator(baselineStats.closed, optimizedStats.closed, false, true) 

  // Additional Metrics
  // 平均通学距離: 減少(改善)で緑色/下向き
  const distanceChange = getChangeIndicator(
    baselineStats.averageDistance,
    optimizedStats.averageDistance,
    true, 
  )
  // 適正規模校数: 増加(改善)で緑色/上向き
  const capacityChange = getChangeIndicator(
    baselineStats.withinCapacity,
    optimizedStats.withinCapacity,
    false, 
  )

  // 修正されたコンパクトな比較表示コンポーネント
  const CompactComparisonRow = ({
    label,
    baselineValue,
    optimizedValue,
    change,
    unit = "校", // 単位のデフォルト設定
  }: {
    label: string
    baselineValue: string | number
    optimizedValue: string | number
    change: { icon: React.ReactNode; color: string; bg: string; diff: number }
    unit?: string
  }) => {
    // 単位を適用
    const displayUnit = (value: string | number): string => {
      if (typeof value === 'number') {
        // 距離の場合、単位は既に formatDistance で処理されている
        if (label.includes("距離")) return String(value);
        return `${value}${unit}`;
      }
      return value; // 既にフォーマットされた文字列 (例: 容量や距離)
    };

    return (
      <div className="space-y-1">
        {/* 項目名と矢印アイコン - グリッドを使用して縦位置を揃える */}
        <div className="grid grid-cols-[1fr_auto] items-center">
            <div className="text-base font-medium text-sidebar-foreground"> {/* text-base に変更 */}
                {label}
            </div>
            <div className={`p-1 rounded ${change.bg} flex items-center justify-center`}>
                <span className={change.color}>{change.icon}</span>
            </div>
        </div>
        {/* 最適化前 → 最適化後 の値 (値を大きく表示) */}
        <div className="grid grid-cols-3 text-base text-muted-foreground items-center gap-1 ml-1"> 
          {/* 最適化前 (左寄せ) */}
          <span className="font-bold text-sidebar-foreground text-left whitespace-nowrap">
            {displayUnit(baselineValue)}
          </span> 
          
          {/* 矢印 (中央寄せ) */}
          <span className="text-base font-semibold text-muted-foreground text-center">
            →
          </span>
          
          {/* 最適化後 (右寄せ) */}
          <span className="font-bold text-sidebar-foreground text-right whitespace-nowrap">
            {displayUnit(optimizedValue)}
          </span> 
        </div>
      </div>
    );
  };


  return (
    <Card className="border-sidebar-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-sidebar-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* すべての指標の比較 (コンパクトな単一行表示) */}
        <div className="space-y-4">
          
          <CompactComparisonRow
            label="運営中"
            baselineValue={baselineStats.operating}
            optimizedValue={optimizedStats.operating}
            change={operatingChange}
            unit="校"
          />
          
          <CompactComparisonRow
            label="廃校"
            baselineValue={baselineStats.closed}
            optimizedValue={optimizedStats.closed}
            change={closedChange}
            unit="校"
          />

          <div className="pt-3 border-t border-sidebar-border"></div>

          <CompactComparisonRow
            label="平均通学距離"
            baselineValue={formatDistance(baselineStats.averageDistance)}
            optimizedValue={formatDistance(optimizedStats.averageDistance)}
            change={distanceChange}
            unit="" // formatDistanceで既に単位が付与されているため空
          />
          
          <CompactComparisonRow
            label="適正規模校数"
            baselineValue={formatCapacity(baselineStats)}
            optimizedValue={formatCapacity(optimizedStats)}
            change={capacityChange}
            unit="" // formatCapacityで既に単位が付与されているため空
          />
        </div>

        {/* 変化の概要（全指標） */}
        <div className="pt-3 border-t border-sidebar-border space-y-2 text-xs">
          <span className="text-sm font-medium text-sidebar-foreground">変化の概要</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">運営中</span>
              <span className={`font-medium ${operatingChange.color}`}>
                {operatingChange.diff > 0 ? "+" : ""}
                {operatingChange.diff}校
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">廃校</span>
              <span className={`font-medium ${closedChange.color}`}>
                {closedChange.diff > 0 ? "+" : ""}
                {closedChange.diff}校
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">平均距離</span>
              <span className={`font-medium ${distanceChange.color}`}>
                {distanceChange.diff > 0 ? "+" : ""}
                {distanceChange.diff.toFixed(2)} km
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">適正規模校</span>
              <span className={`font-medium ${capacityChange.color}`}>
                {capacityChange.diff > 0 ? "+" : ""}
                {capacityChange.diff}校
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function StatisticsTab({
  districtData,
  schoolData,
  selectedMode = "Name_1",
  displayMode = "current",
  optimizedDistrictData,
  baselineSnapshot,
}: StatisticsTabProps) {
  const [isComparisonMode, setIsComparisonMode] = useState(false)

  const resolveSchoolName = (feature: SchoolGeoJSONData["features"][number], index: number) =>
    String(feature?.properties?.name || feature?.properties?.Name || `学校${index + 1}`).trim()

  // 学校統計計算用のヘルパー関数
  const getSchoolStatistics = () => {
    const schools = schoolData?.features || []

    const buildCategoryStats = (targetSchools: Array<{ isClosed: boolean }>) => {
      const total = targetSchools.length
      const closed = targetSchools.filter((school) => school.isClosed).length
      const operating = total - closed
      return { total, operating, closed }
    }

    const buildStats = (isClosedFn: (properties: SchoolGeoJSONData["features"][number]["properties"]) => boolean) => {
      const allSchools = schools.map((feature: SchoolGeoJSONData["features"][number], index: number) => {
        const name = (feature.properties?.name || `学校${index + 1}`).trim()
        return {
          id: String(index),
          name,
          isClosed: isClosedFn(feature.properties ?? {}),
          isElementary: name.includes("小学校") || name.includes("小"),
          isMiddle: name.includes("中学校") || name.includes("中"),
        }
      })

      const elementarySchools = allSchools.filter((school) => school.isElementary)
      const middleSchools = allSchools.filter((school) => school.isMiddle)

      return {
        total: buildCategoryStats(allSchools),
        elementary: buildCategoryStats(elementarySchools),
        middle: buildCategoryStats(middleSchools),
      }
    }

    return {
      current: buildStats((properties) => properties?.isClosed === true),
      preOptimization: buildStats((properties) => properties?.isClosedManual === true),
    }
  }

  const buildCapacityStats = (
    mode: "Name_1" | "Name_2",
    matcher: (name: string) => boolean,
  ): Pick<SchoolComparisonMetrics, "withinCapacity" | "capacityTotal"> => {
    if (!schoolData?.features) {
      return { withinCapacity: 0, capacityTotal: 0 }
    }

    const assignmentKey = mode === "Name_1" ? "assignedStudentsSho" : "assignedStudentsChu"
    const effectiveDisplayMode = displayMode ?? "current"

    return schoolData.features.reduce(
      (acc: { withinCapacity: number; capacityTotal: number }, feature: SchoolGeoJSONData["features"][number], index: number) => {
        const name = resolveSchoolName(feature, index)
        const isElementaryTarget = name.includes("小学校") || name.includes("小")
        const isMiddleTarget = name.includes("中学校") || name.includes("中")
        const isTargetSchool = mode === "Name_1" ? isElementaryTarget : isMiddleTarget

        if (!isTargetSchool) return acc

        const state = computeSchoolState(feature, mode, effectiveDisplayMode)
        const isClosedEffective = state.isExcludedOption || state.isClosedEffective
        if (isClosedEffective) return acc

        const min = parseStudentCount(feature?.properties?.min_students ?? feature?.properties?.minStudents)
        const max = parseStudentCount(feature?.properties?.max_students ?? feature?.properties?.maxStudents)
        const assigned = parseStudentCount(feature?.properties?.[assignmentKey])

        if (min !== null && max !== null && assigned !== null) {
          // ここでは対象の学校（matcherでフィルタされたもの）のみをカウントすべきだが、
          // 既存のmatcherロジックは使わず、nameによる判定（isTargetSchool）でフィルタを適用
          if (matcher(name)) {
             // フィルタされた学校が運営中の場合のみ capacityTotalをインクリメント
            acc.capacityTotal += 1
            if (assigned >= min && assigned <= max) {
              acc.withinCapacity += 1
            }
          }
        }

        return acc
      },
      { withinCapacity: 0, capacityTotal: 0 },
    )
  }

  const calculateOptimizedStatistics = (baselineStats: OptimizationComparisonSnapshot) => {
    if (!schoolData?.features) {
      return null
    }

    const buildMarkerStats = (
      mode: "Name_1" | "Name_2",
      matcher: (name: string) => boolean,
      fallback: SchoolComparisonMetrics,
    ) => {
      const relevant = schoolData.features
        .map((feature: SchoolGeoJSONData["features"][number], index: number) => ({
          feature,
          name: resolveSchoolName(feature, index),
        }))
        .filter(({ name }: { name: string }) => matcher(name))

      if (relevant.length === 0) {
        return fallback
      }

      const stats: SchoolComparisonMetrics = {
        total: relevant.length,
        operating: 0,
        closed: 0,
        withinCapacity: 0,
        capacityTotal: 0,
        averageDistance: fallback.averageDistance ?? null,
      }

      relevant.forEach(({ feature }: { feature: SchoolGeoJSONData["features"][number] }) => {
        const state = computeSchoolState(feature, mode, displayMode ?? "current")
        const isClosedEffective = state.isExcludedOption || state.isClosedEffective
        if (isClosedEffective) {
          stats.closed += 1
        } else {
          stats.operating += 1
        }
      })

      const capacityStats = buildCapacityStats(mode, matcher)
      stats.withinCapacity = capacityStats.withinCapacity
      stats.capacityTotal = capacityStats.capacityTotal

      return stats
    }

    const elementaryStats = buildMarkerStats(
      "Name_1",
      (name) => name.includes("小学校") || name.includes("小"),
      baselineStats.elementary,
    )
    const middleStats = buildMarkerStats(
      "Name_2",
      (name) => name.includes("中学校") || name.includes("中"),
      baselineStats.middle,
    )

    return {
      elementary: elementaryStats,
      middle: middleStats,
    }
  }

  // 統計データの計算
  const calculateStatistics = () => {
    const districts = districtData?.features || []
    const schools = schoolData?.features || []

    if (districts.length === 0 && schools.length === 0) {
      return null
    }

    // 学校統計（学校データがある場合のみ）
    let schoolStats = {
      total: 0,
      elementary: 0,
      middle: 0,
      closed: 0,
      operating: 0,
    }

    if (schools.length > 0) {
      const totalSchools = schools.length
      const elementarySchools = schools.filter(
        (s: SchoolGeoJSONData["features"][number]) => s.properties?.name?.includes("小学校") || s.properties?.name?.includes("小"),
      )
      const middleSchools = schools.filter(
        (s: SchoolGeoJSONData["features"][number]) => s.properties?.name?.includes("中学校") || s.properties?.name?.includes("中"),
      )
      const closedSchools = schools.filter((s: SchoolGeoJSONData["features"][number]) => s.properties?.isClosed === true)

      schoolStats = {
        total: totalSchools,
        elementary: elementarySchools.length,
        middle: middleSchools.length,
        closed: closedSchools.length,
        operating: totalSchools - closedSchools.length,
      }
    }

    // 地区統計（地区データがある場合のみ）
    let districtStats = {
      total: 0,
      totalStudents: 0,
      averageStudents: 0,
    }

    if (districts.length > 0) {
      const totalDistricts = districts.length
      const totalStudents = districts.reduce((sum: number, district: GeoJSONData["features"][number]) => {
        let students = 0

        if (selectedMode === "Name_1") {
          students =
            district.properties?.editedStudents?.num_sho ||
            district.properties?.num_sho2024 ||
            district.properties?.num_sho ||
            0
        } else {
          students =
            district.properties?.editedStudents?.num_chu ||
            district.properties?.num_chu2024 ||
            district.properties?.num_chu ||
            0
        }

        return sum + (typeof students === "number" ? students : 0)
      }, 0)

      const averageStudentsPerDistrict = totalDistricts > 0 ? totalStudents / totalDistricts : 0

      districtStats = {
        total: totalDistricts,
        totalStudents,
        averageStudents: averageStudentsPerDistrict,
      }
    }

    return {
      schools: schoolStats,
      districts: districtStats,
    }
  }

  const stats = calculateStatistics()
  const { current: currentSchoolStats } = getSchoolStatistics()

  const withComparisonDefaults = (metrics: Partial<SchoolComparisonMetrics>) => ({
    total: metrics.total ?? 0,
    operating: metrics.operating ?? 0,
    closed: metrics.closed ?? 0,
    averageDistance: metrics.averageDistance ?? null,
    withinCapacity: metrics.withinCapacity ?? 0,
    capacityTotal: metrics.capacityTotal ?? 0,
  })

  // 比較前のベースライン（baselineSnapshotがあればそれを使用、なければ現在の学校統計を使用）
  const baselineForComparison: OptimizationComparisonSnapshot =
    baselineSnapshot
      ? {
          elementary: withComparisonDefaults(baselineSnapshot.elementary),
          middle: withComparisonDefaults(baselineSnapshot.middle),
        }
      : {
          elementary: withComparisonDefaults({
            ...currentSchoolStats.elementary,
            ...buildCapacityStats("Name_1", (name) => name.includes("小学校") || name.includes("小")),
          }),
          middle: withComparisonDefaults({
            ...currentSchoolStats.middle,
            ...buildCapacityStats("Name_2", (name) => name.includes("中学校") || name.includes("中")),
          }),
        }

  // 最適化後のデータ（optimizedDistrictDataに埋め込まれたスナップショットを優先し、なければ計算）
    const optimizedSnapshotFromData =
      ((optimizedDistrictData as unknown as { comparisonSnapshot?: OptimizationComparisonSnapshot })?.comparisonSnapshot) ?? null

  const optimizedStats =
    optimizedSnapshotFromData && optimizedSnapshotFromData.elementary && optimizedSnapshotFromData.middle
      ? {
          elementary: withComparisonDefaults(optimizedSnapshotFromData.elementary),
          middle: withComparisonDefaults(optimizedSnapshotFromData.middle),
        }
      : calculateOptimizedStatistics(baselineForComparison)

  const optimizedSchoolStats = optimizedStats ?? baselineForComparison

  useEffect(() => {
    if ((!optimizedDistrictData?.features || !baselineSnapshot) && isComparisonMode) {
      setIsComparisonMode(false)
    }
  }, [optimizedDistrictData, baselineSnapshot, isComparisonMode])

  // データが全くない場合のみ「準備中」を表示
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="text-center">
          <BarChart3 size={48} className="mx-auto mb-2 opacity-50" />
          <p>統計情報</p>
          <p className="text-sm">データを読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-sidebar-foreground">統計情報</h3>
        <Button
          variant={isComparisonMode ? "default" : "outline"}
          size="sm"
          onClick={() => setIsComparisonMode(!isComparisonMode)}
          className="text-xs"
          disabled={!optimizedDistrictData?.features?.length || !baselineSnapshot}
        >
          {isComparisonMode ? "通常表示" : "比較表示"}
        </Button>
      </div>

      {isComparisonMode ? (
        <div className="space-y-6">
          <ComparisonCard
            title="小学校"
            icon={<GraduationCap size={16} />}
            baselineStats={baselineForComparison.elementary}
            optimizedStats={optimizedSchoolStats.elementary}
          />
          <ComparisonCard
            title="中学校"
            icon={<School2 size={16} />}
            baselineStats={baselineForComparison.middle}
            optimizedStats={optimizedSchoolStats.middle}
          />
        </div>
      ) : (
        // 通常表示モード（既存のコード）
        <div className="space-y-6">
          {/* 小学校統計 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <GraduationCap size={16} />
                小学校
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-stretch gap-3">
                <StatPill tone="blue" value={currentSchoolStats.elementary.total} label="学校数" />
                <StatPill tone="green" value={currentSchoolStats.elementary.operating} label="運営中" />
                <StatPill tone="red" value={currentSchoolStats.elementary.closed} label="廃校" />
              </div>
              {currentSchoolStats.elementary.total > 0 && (
                <div className="pt-3 border-t">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>
                      廃校率: {((currentSchoolStats.elementary.closed / currentSchoolStats.elementary.total) * 100).toFixed(1)}%
                    </div>
                    <div>
                      運営率: {((currentSchoolStats.elementary.operating / currentSchoolStats.elementary.total) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 中学校統計 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <School2 size={16} />
                中学校
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-stretch gap-3">
                <StatPill tone="purple" value={currentSchoolStats.middle.total} label="学校数" />
                <StatPill tone="green" value={currentSchoolStats.middle.operating} label="運営中" />
                <StatPill tone="red" value={currentSchoolStats.middle.closed} label="廃校" />
              </div>
              {currentSchoolStats.middle.total > 0 && (
                <div className="pt-3 border-t">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>廃校率: {((currentSchoolStats.middle.closed / currentSchoolStats.middle.total) * 100).toFixed(1)}%</div>
                    <div>運営率: {((currentSchoolStats.middle.operating / currentSchoolStats.middle.total) * 100).toFixed(1)}%</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
