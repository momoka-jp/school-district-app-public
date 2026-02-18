"use client"

import type { SchoolGeoJSONData } from "@/types/map-types"

type ModeKey = "Name_1" | "Name_2"

export type CapacityStats = {
  total: number
  withinCapacity: number
  outOfRangeSchools: Array<{
    name: string
    assigned: number
    min: number
    max: number
    usagePercent: number
  }>
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

export const calculateSchoolsWithinCapacityByMode = (
  schoolData: SchoolGeoJSONData | null | undefined,
  selectedMode: ModeKey,
): CapacityStats => {
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
    { total: 0, withinCapacity: 0, outOfRangeSchools: [] as CapacityStats["outOfRangeSchools"] },
  )
}
