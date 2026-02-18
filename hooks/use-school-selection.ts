"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { calculateSchoolEnrollment, isSchoolSelectable } from "@/utils/map-utils"
import { createDefaultOptionEntry, type DistrictOptionEntry } from "@/hooks/use-district-options"
import type { LayerRefs } from "@/utils/map-drawing-utils"
import type {
  DisplayMode,
  DistrictOptionValue,
  GeoJSONData,
  SchoolGeoJSONData,
  SchoolOptimizationOption,
} from "@/types/map-types"

interface UseSchoolSelectionParams {
  layerRefs: LayerRefs
  selectedMode: "Name_1" | "Name_2"
  displayMode: DisplayMode
  setDisplayMode: (mode: DisplayMode) => void
  setErrorMessage: (message: string | null) => void
  onSelectedSchoolChange?: (schoolName: string | null) => void
  districtData: GeoJSONData | null
  schoolData: SchoolGeoJSONData | null
  setSchoolData: Dispatch<SetStateAction<SchoolGeoJSONData | null>>
  setDistrictOptions: Dispatch<SetStateAction<Record<string, DistrictOptionEntry>>>
  selectedYear: number
}

interface UseSchoolSelectionResult {
  selectedSchool: string | null
  selectedSchoolRef: MutableRefObject<string | null>
  selectedSchoolIsClosed: boolean
  isUpdatingSchool: boolean
  clearSchoolInfo: () => void
  updateSchoolInfoDisplay: (schoolName: string, isClosed: boolean) => void
  handleUpdateSchoolOption: (schoolName: string, option: SchoolOptimizationOption) => Promise<void>
  handleToggleSchoolStatus: (schoolName: string, newIsClosed: boolean) => Promise<void>
}

export function useSchoolSelection({
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
}: UseSchoolSelectionParams): UseSchoolSelectionResult {
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null)
  const selectedSchoolRef = useRef<string | null>(selectedSchool)
  const [selectedSchoolIsClosed, setSelectedSchoolIsClosed] = useState(false)
  const [isUpdatingSchool, setIsUpdatingSchool] = useState(false)

  const clearSchoolInfo = useCallback(() => {
    setSelectedSchool(null)
    setSelectedSchoolIsClosed(false)
    onSelectedSchoolChange?.(null)
    if (layerRefs.highlightLayerRef?.current) {
      layerRefs.highlightLayerRef.current.clearLayers()
    }
  }, [layerRefs, onSelectedSchoolChange])

  const updateSchoolInfoDisplay = useCallback(
    (schoolName: string, isClosed: boolean) => {
      if (isClosed) {
        setErrorMessage("廃校の学校は選択できません")
        return
      }

      if (selectedSchool === schoolName) {
        setSelectedSchoolIsClosed(false)
        onSelectedSchoolChange?.(schoolName)
        selectedSchoolRef.current = schoolName
        return
      }

      setSelectedSchool(schoolName)
      setSelectedSchoolIsClosed(false)
      onSelectedSchoolChange?.(schoolName)

      if (!isSchoolSelectable(schoolName, false, selectedMode)) {
        const schoolType = schoolName.endsWith("小学校") ? "小学校" : "中学校"
        const modeType = selectedMode === "Name_1" ? "小学校区" : "中学校区"
        setErrorMessage(`${schoolType}は${modeType}モードでは校区拡大できません`)
      }
    },
    [onSelectedSchoolChange, selectedMode, selectedSchool, setErrorMessage],
  )

  const handleUpdateSchoolOption = useCallback(
    async (schoolName: string, option: SchoolOptimizationOption) => {
      if (!schoolData?.features) return

      try {
        setIsUpdatingSchool(true)

        const shouldClearSelection =
          (option === "closed" || option === "excluded") && selectedSchoolRef.current === schoolName

        if (shouldClearSelection) {
          clearSchoolInfo()
        }

        if (displayMode === "optimized" || displayMode === "original") {
          setDisplayMode("current")
          setErrorMessage("校区拡大に切り替えました")
        }

        const response = await fetch("/api/update-school", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            schoolName,
            optimizationOption: option,
          }),
        })

        if (!response.ok) {
          const errorData = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(errorData?.error || "学校の更新に失敗しました")
        }

        const updatedSchoolData = {
          ...schoolData,
          features: schoolData.features.map((s: SchoolGeoJSONData["features"][number]) => {
            if (s.properties.name !== schoolName) return s

            const nextProps = { ...s.properties }
            nextProps.optimizationOption = option
            nextProps.closedByOptimization = false

            if (option === "closed" || option === "excluded") {
              nextProps.isClosed = true
              nextProps.isClosedManual = option === "closed"
              nextProps.manualOpenOverride = false
            } else if (option === "forced_open") {
              nextProps.isClosed = false
              nextProps.isClosedManual = false
              nextProps.manualOpenOverride = true
            } else {
              nextProps.isClosed = false
              nextProps.isClosedManual = false
              nextProps.manualOpenOverride = false
            }

            return { ...s, properties: nextProps }
          }),
        }

        setSchoolData(updatedSchoolData)

        if ((option === "closed" || option === "excluded") && districtData?.features) {
          const targetMode: "Name_1" | "Name_2" | null = schoolName.endsWith("小学校")
            ? "Name_1"
            : schoolName.endsWith("中学校")
              ? "Name_2"
              : null

          if (targetMode) {
            setDistrictOptions((prev) => {
              let changed = false
              const next: Record<string, DistrictOptionEntry> = {
                ...prev,
              }

              districtData.features.forEach((feature: GeoJSONData["features"][number]) => {
                const districtId = feature?.properties?.id
                if (!districtId) return

                const assignedSchool =
                  feature?.properties?.editedDistricts?.[targetMode] ??
                  feature?.properties?.optimizedDistricts?.[targetMode] ??
                  feature?.properties?.originalDistricts?.[targetMode] ??
                  feature?.properties?.[targetMode]

                if (assignedSchool !== schoolName) return

                const currentEntry = next[districtId] ?? createDefaultOptionEntry()

                if (currentEntry[targetMode] === "固定") {
                  next[districtId] = { ...currentEntry, [targetMode]: "最適化対象" }
                  changed = true
                }
              })

              return changed ? next : prev
            })
          }
        }

        if (!shouldClearSelection && selectedSchool === schoolName) {
          setSelectedSchoolIsClosed(option === "closed" || option === "excluded")
          onSelectedSchoolChange?.(schoolName)
        }

        setTimeout(() => {
          if (districtData && updatedSchoolData) {
            calculateSchoolEnrollment(districtData, updatedSchoolData, "Name_1", displayMode, selectedYear)
            calculateSchoolEnrollment(districtData, updatedSchoolData, "Name_2", displayMode, selectedYear)
          }
        }, 100)

        const messageLabel =
          option === "closed"
            ? "廃校"
            : option === "forced_open"
              ? "強制開校"
              : option === "excluded"
                ? "対象外"
                : "指定なし"
        setErrorMessage(`${schoolName}を${messageLabel}に設定しました`)
      } catch (error) {
        console.error("学校の更新中にエラーが発生しました:", error)
        if (error instanceof Error) {
          setErrorMessage(`エラー: ${error.message}`)
        } else {
          setErrorMessage("学校の更新中に不明なエラーが発生しました")
        }
        throw error
      } finally {
        setIsUpdatingSchool(false)
      }
    },
    [
      clearSchoolInfo,
      districtData,
      displayMode,
      onSelectedSchoolChange,
      schoolData,
      selectedSchool,
      selectedYear,
      setDisplayMode,
      setErrorMessage,
      setDistrictOptions,
      setSchoolData,
    ],
  )

  const handleToggleSchoolStatus = useCallback(
    async (schoolName: string, newIsClosed: boolean) =>
      handleUpdateSchoolOption(schoolName, newIsClosed ? "closed" : "default"),
    [handleUpdateSchoolOption],
  )

  useEffect(() => {
    selectedSchoolRef.current = selectedSchool

    if (selectedSchool && schoolData) {
      const school = schoolData.features.find(
        (s: SchoolGeoJSONData["features"][number]) => s.properties.name === selectedSchool,
      )
      if (school) {
        const allowedOptions: SchoolOptimizationOption[] = ["default", "closed", "forced_open", "excluded"]
        const optionRaw = school.properties.optimizationOption as string | undefined
        const option: SchoolOptimizationOption =
          optionRaw && allowedOptions.includes(optionRaw as SchoolOptimizationOption)
            ? (optionRaw as SchoolOptimizationOption)
            : school.properties.isClosed
                ? "closed"
                : "default"
        const effectiveClosed = option === "closed" || option === "excluded" || school.properties.isClosed === true
        setSelectedSchoolIsClosed(effectiveClosed)
      }
    } else {
      setSelectedSchoolIsClosed(false)
    }
  }, [selectedSchool, schoolData])

  return {
    selectedSchool,
    selectedSchoolRef,
    selectedSchoolIsClosed,
    isUpdatingSchool,
    clearSchoolInfo,
    updateSchoolInfoDisplay,
    handleUpdateSchoolOption,
    handleToggleSchoolStatus,
  }
}
