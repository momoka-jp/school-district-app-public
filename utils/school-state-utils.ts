"use client"

import type { School, DisplayMode, SchoolOptimizationOption } from "@/types/map-types"
import { isSchoolSelectable } from "@/utils/map-utils"

export interface SchoolStateSnapshot {
  optimizationOption: SchoolOptimizationOption
  isExcludedOption: boolean
  isClosedEffective: boolean
  isSelectable: boolean
  assignedSho: number
  assignedChu: number
  assignedByType: number
}

const allowedOptions: SchoolOptimizationOption[] = ["default", "closed", "forced_open", "excluded"]

export const computeSchoolState = (
  feature: School,
  selectedMode: "Name_1" | "Name_2",
  displayMode: DisplayMode,
): SchoolStateSnapshot => {
  const props = feature.properties ?? {}
  const schoolName = props.name ?? ""

  const assignedSho = Number(props.assignedStudentsSho ?? 0)
  const assignedChu = Number(props.assignedStudentsChu ?? 0)
  const assignedByType = selectedMode === "Name_1" ? assignedSho : assignedChu

  const rawOptimizationOption = props.optimizationOption as string | undefined
  const optimizationOption: SchoolOptimizationOption =
    rawOptimizationOption && allowedOptions.includes(rawOptimizationOption as SchoolOptimizationOption)
      ? (rawOptimizationOption as SchoolOptimizationOption)
      : props.isClosed
          ? "closed"
          : "default"

  const isExcludedOption = optimizationOption === "excluded"
  const isManualClosed = optimizationOption === "closed"
  const isForcedOpen = optimizationOption === "forced_open"

  const originalIsClosed =
    props.originalIsClosed ??
    Boolean(props.isClosed)

  let isClosedEffective: boolean

  if (displayMode === "original") {
    isClosedEffective = originalIsClosed
  } else {
    const baseClosed = Boolean(props.isClosed)
    isClosedEffective = baseClosed || assignedByType === 0

    if (isExcludedOption || isManualClosed) {
      isClosedEffective = true
    } else if (isForcedOpen) {
      isClosedEffective = false
    }
  }

  const isSelectable = !isExcludedOption && isSchoolSelectable(schoolName, isClosedEffective, selectedMode)

  return {
    optimizationOption,
    isExcludedOption,
    isClosedEffective,
    isSelectable,
    assignedSho,
    assignedChu,
    assignedByType,
  }
}

