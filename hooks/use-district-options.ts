"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import type { DistrictOptionValue, GeoJSONData } from "@/types/map-types"

export type DistrictOptionEntry = { Name_1: DistrictOptionValue; Name_2: DistrictOptionValue }

const areSetsEqual = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) return false
  for (const value of a) {
    if (!b.has(value)) return false
  }
  return true
}

export const createDefaultOptionEntry = (): DistrictOptionEntry => ({
  Name_1: "最適化対象",
  Name_2: "最適化対象",
})

const createExcludedOptionEntry = (): DistrictOptionEntry => ({
  Name_1: "対象外",
  Name_2: "対象外",
})

interface UseDistrictOptionsParams {
  districtData: GeoJSONData | null
  setDistrictData: Dispatch<SetStateAction<GeoJSONData | null>>
  selectedMode: "Name_1" | "Name_2"
  skipAutoSyncOnceRef: MutableRefObject<boolean>
}

interface UseDistrictOptionsResult {
  districtOptions: Record<string, DistrictOptionEntry>
  setDistrictOptions: Dispatch<SetStateAction<Record<string, DistrictOptionEntry>>>
  selectedTownIds: Set<string>
  fixedTownIds: Set<string>
  districtOptionsForMode: Record<string, DistrictOptionValue>
  schoolSelectionSummary: Record<
    string,
    {
      Name_1: { total: number; selected: number; fixed: number }
      Name_2: { total: number; selected: number; fixed: number }
    }
  >
  notifyDistrictAssignmentsChanged: () => void
  handleTownOptionChange: (townId: string, option: DistrictOptionValue) => void
  handleSchoolSelectionChange: (schoolName: string, include: boolean) => void
  handleBulkFixSchoolDistricts: (
    schoolName: string,
    modeKey: "Name_1" | "Name_2",
    shouldFix: boolean,
  ) => void
  handleSelectAllTowns: () => void
  handleClearAllTowns: () => void
}

export function useDistrictOptions({
  districtData,
  setDistrictData,
  selectedMode,
  skipAutoSyncOnceRef,
}: UseDistrictOptionsParams): UseDistrictOptionsResult {
  const [districtOptions, setDistrictOptions] = useState<Record<string, DistrictOptionEntry>>({})
  const [selectedTownIds, setSelectedTownIds] = useState<Set<string>>(new Set())
  const [fixedTownIds, setFixedTownIds] = useState<Set<string>>(new Set())
  const [districtAssignmentVersion, setDistrictAssignmentVersion] = useState(0)

  useEffect(() => {
    if (!districtData?.features) return

    const features = districtData.features
    const shouldSkipAutoSync = skipAutoSyncOnceRef.current

    setDistrictOptions((prev) => {
      const next: Record<string, DistrictOptionEntry> = {}
      const prevKeys = new Set(Object.keys(prev))
      const wasEmptyBefore = prevKeys.size === 0
      let changed = false

      features.forEach((feature: any) => {
        const featureId = feature?.properties?.id
        if (!featureId) return

        const featureOptions = feature?.properties?.districtOptions
        const normalizedFeatureOptions = featureOptions
          ? {
              Name_1: (featureOptions.Name_1 as DistrictOptionValue) ?? "最適化対象",
              Name_2: (featureOptions.Name_2 as DistrictOptionValue) ?? "最適化対象",
            }
          : undefined

        const prevEntry = prev[featureId]
        const baseEntry =
          prevEntry ??
          normalizedFeatureOptions ??
          (wasEmptyBefore && !shouldSkipAutoSync ? createDefaultOptionEntry() : createExcludedOptionEntry())

        const entry: DistrictOptionEntry = {
          Name_1: baseEntry.Name_1 ?? "最適化対象",
          Name_2: baseEntry.Name_2 ?? "最適化対象",
        }

        next[featureId] = entry
        prevKeys.delete(featureId)

        if (!prevEntry || prevEntry.Name_1 !== entry.Name_1 || prevEntry.Name_2 !== entry.Name_2) {
          changed = true
        }
      })

      if (prevKeys.size > 0) {
        changed = true
      }

      if (!changed) {
        return prev
      }

      return next
    })

    if (skipAutoSyncOnceRef.current) {
      skipAutoSyncOnceRef.current = false
    }
  }, [districtData, skipAutoSyncOnceRef])

  useEffect(() => {
    const includeSet = new Set<string>()
    const fixedSet = new Set<string>()

    Object.entries(districtOptions).forEach(([id, optionByMode]) => {
      const option = optionByMode[selectedMode] ?? "対象外"
      if (option !== "対象外") {
        includeSet.add(id)
        if (option === "固定") {
          fixedSet.add(id)
        }
      }
    })

    setSelectedTownIds((prev) => (areSetsEqual(prev, includeSet) ? prev : includeSet))
    setFixedTownIds((prev) => (areSetsEqual(prev, fixedSet) ? prev : fixedSet))
  }, [districtOptions, selectedMode])

  useEffect(() => {
    if (!districtData?.features) return

    setDistrictData((prevData: GeoJSONData | null) => {
      if (!prevData?.features) return prevData

      let changed = false
      const updatedFeatures = prevData.features.map((feature: any) => {
        const featureId = feature?.properties?.id
        if (!featureId) return feature

        const optionByMode = districtOptions[featureId]
        if (!optionByMode) return feature

        const existingOptions = feature.properties?.districtOptions ?? {}
        const currentOption = optionByMode[selectedMode] ?? "対象外"
        const nextOptions = {
          Name_1: optionByMode.Name_1,
          Name_2: optionByMode.Name_2,
        }

        const needsUpdate =
          existingOptions.Name_1 !== nextOptions.Name_1 ||
          existingOptions.Name_2 !== nextOptions.Name_2 ||
          feature.properties?.districtOption !== currentOption

        if (!needsUpdate) {
          return feature
        }

        changed = true

        return {
          ...feature,
          properties: {
            ...feature.properties,
            districtOptions: nextOptions,
            districtOption: currentOption,
          },
        }
      })

      if (!changed) {
        return prevData
      }

      return {
        ...prevData,
        features: updatedFeatures,
      }
    })
  }, [districtData, districtOptions, selectedMode, setDistrictData])

  const handleTownOptionChange = useCallback(
    (townId: string, option: DistrictOptionValue) => {
      if (!townId) return

      setDistrictOptions((prev) => {
        const currentEntry = prev[townId] ?? createDefaultOptionEntry()

        if (currentEntry[selectedMode] === option) {
          return prev
        }

        return {
          ...prev,
          [townId]: {
            ...currentEntry,
            [selectedMode]: option,
          },
        }
      })
    },
    [selectedMode],
  )

  const handleSchoolSelectionChange = useCallback(
    (schoolName: string, include: boolean) => {
      if (!districtData?.features) return
      const targetIds: string[] = []
      districtData.features.forEach((feature: any) => {
        const featureId = feature?.properties?.id
        const assignedSchool = feature?.properties?.editedDistricts?.[selectedMode]
        if (featureId && assignedSchool === schoolName) {
          targetIds.push(featureId)
        }
      })
      if (targetIds.length === 0) return
      setDistrictOptions((prev) => {
        let changed = false
        const next = { ...prev }
        const desired: DistrictOptionValue = include ? "最適化対象" : "対象外"

        targetIds.forEach((id) => {
          const currentEntry = next[id] ?? createDefaultOptionEntry()
          if (currentEntry[selectedMode] === desired) {
            return
          }
          next[id] = { ...currentEntry, [selectedMode]: desired }
          changed = true
        })

        return changed ? next : prev
      })
    },
    [districtData, selectedMode],
  )

  const handleBulkFixSchoolDistricts = useCallback(
    (schoolName: string, modeKey: "Name_1" | "Name_2", shouldFix: boolean) => {
      if (!districtData?.features) return
      setDistrictOptions((prev) => {
        let changed = false
        const next = { ...prev }

        districtData.features.forEach((feature: any) => {
          const districtId = feature?.properties?.id
          if (!districtId) return

          const assignedSchool =
            feature?.properties?.editedDistricts?.[modeKey] ??
            feature?.properties?.originalDistricts?.[modeKey] ??
            feature?.properties?.[modeKey]

          if (assignedSchool !== schoolName) return

          const currentEntry = next[districtId] ?? createDefaultOptionEntry()
          const currentValue = currentEntry[modeKey] ?? "対象外"

          if (shouldFix) {
            if (currentValue === "固定") return
            next[districtId] = { ...currentEntry, [modeKey]: "固定" }
            changed = true
          } else {
            if (currentValue !== "固定") return
            next[districtId] = { ...currentEntry, [modeKey]: "最適化対象" }
            changed = true
          }
        })

        return changed ? next : prev
      })
    },
    [districtData],
  )

  const handleSelectAllTowns = useCallback(() => {
    if (!districtData?.features) return
    setDistrictOptions((prev) => {
      let changed = false
      const next = { ...prev }

      districtData.features.forEach((feature: any) => {
        const featureId = feature?.properties?.id
        if (!featureId) return

        const currentEntry = next[featureId] ?? createDefaultOptionEntry()

        if (currentEntry[selectedMode] !== "最適化対象") {
          next[featureId] = { ...currentEntry, [selectedMode]: "最適化対象" }
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [districtData, selectedMode])

  const handleClearAllTowns = useCallback(() => {
    setDistrictOptions((prev) => {
      let changed = false
      const nextEntries: Record<string, DistrictOptionEntry> = {}

      Object.entries(prev).forEach(([id, value]) => {
        if (value[selectedMode] === "対象外") {
          nextEntries[id] = value
          return
        }
        changed = true
        nextEntries[id] = { ...value, [selectedMode]: "対象外" }
      })

      return changed ? nextEntries : prev
    })
  }, [selectedMode])

  const notifyDistrictAssignmentsChanged = useCallback(() => {
    setDistrictAssignmentVersion((prev) => prev + 1)
  }, [])

  const schoolSelectionSummary = useMemo(() => {
    const summary: Record<
      string,
      {
        Name_1: { total: number; selected: number; fixed: number }
        Name_2: { total: number; selected: number; fixed: number }
      }
    > = {}
    if (!districtData?.features) return summary
    if (districtAssignmentVersion === -1) {
      // no-op to satisfy dependency usage
    }

    districtData.features.forEach((feature: any) => {
      const featureId = feature?.properties?.id
      if (!featureId) return

      const districtsByMode: Record<"Name_1" | "Name_2", string | undefined> = {
        Name_1:
          feature?.properties?.editedDistricts?.Name_1 ??
          feature?.properties?.originalDistricts?.Name_1 ??
          feature?.properties?.Name_1,
        Name_2:
          feature?.properties?.editedDistricts?.Name_2 ??
          feature?.properties?.originalDistricts?.Name_2 ??
          feature?.properties?.Name_2,
      }

      const optionEntry = districtOptions[featureId]
      const isIncludedByMode: Record<"Name_1" | "Name_2", boolean> = {
        Name_1: (optionEntry?.Name_1 ?? "対象外") !== "対象外",
        Name_2: (optionEntry?.Name_2 ?? "対象外") !== "対象外",
      }
      const isFixedByMode: Record<"Name_1" | "Name_2", boolean> = {
        Name_1: (optionEntry?.Name_1 ?? "対象外") === "固定",
        Name_2: (optionEntry?.Name_2 ?? "対象外") === "固定",
      }

      ;(["Name_1", "Name_2"] as const).forEach((modeKey) => {
        const schoolName = districtsByMode[modeKey]
        if (!schoolName) return

        if (!summary[schoolName]) {
          summary[schoolName] = {
            Name_1: { total: 0, selected: 0, fixed: 0 },
            Name_2: { total: 0, selected: 0, fixed: 0 },
          }
        }

        summary[schoolName][modeKey].total += 1
        if (isIncludedByMode[modeKey]) {
          summary[schoolName][modeKey].selected += 1
        }
        if (isFixedByMode[modeKey]) {
          summary[schoolName][modeKey].fixed += 1
        }
      })
    })

    return summary
  }, [districtData, districtOptions, districtAssignmentVersion])

  const districtOptionsForMode = useMemo(() => {
    const map: Record<string, DistrictOptionValue> = {}
    Object.entries(districtOptions).forEach(([id, value]) => {
      map[id] = value[selectedMode] ?? "対象外"
    })
    return map
  }, [districtOptions, selectedMode])

  return {
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
  }
}
