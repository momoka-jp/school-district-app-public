"use client"

import type React from "react"

import { useEffect } from "react"
import type { Dispatch, SetStateAction } from "react"
import { calculateAverageDistance, type DistanceData } from "@/lib/calculate-average-distance"
import { calculateSchoolEnrollment } from "@/utils/map-utils"
import {
  updateSchoolDistricts,
  updateSchools,
  drawSchoolDistrictLines,
  drawCentroids,
  updateLayerVisibility,
  updateSchoolLabelVisibility,
  highlightSelectedSchool,
} from "@/utils/map-drawing-utils"
import type { LayerRefs } from "@/utils/map-drawing-utils"
import type {
  DisplayMode,
  DisplaySettings,
  DistrictOptionValue,
  GeoJSONData,
  SchoolGeoJSONData,
  SchoolOptimizationOption,
} from "@/types/map-types"

interface UseMapRendererProps {
  layerRefs: LayerRefs
  districtData: GeoJSONData | null
  setDistrictData: Dispatch<SetStateAction<GeoJSONData | null>>
  schoolData: SchoolGeoJSONData | null
  distanceData: DistanceData | null
  selectedMode: "Name_1" | "Name_2"
  selectedYear: number
  displayMode: DisplayMode
  borderColor: string
  opacity: number
  displaySettings: DisplaySettings
  selectedTownIds: Set<string>
  fixedTownIds: Set<string>
  districtOptions: Record<string, DistrictOptionValue>
  schoolSelectionSummary: Record<
    string,
    {
      Name_1: { total: number; selected: number; fixed: number }
      Name_2: { total: number; selected: number; fixed: number }
    }
  >
  handleToggleSchoolSelection: (schoolName: string, include: boolean) => Promise<void> | void
  handleToggleBulkFix: (schoolName: string, modeKey: "Name_1" | "Name_2", shouldFix: boolean) => Promise<void> | void
  handleTownOptionChange: (townId: string, option: DistrictOptionValue) => void
  selectedSchoolRef: React.MutableRefObject<string | null>
  isEditingRef: React.MutableRefObject<boolean>
  selectedSchoolIsClosed: boolean
  setErrorMessage: (message: string | null) => void
  setDisplayMode: (mode: DisplayMode) => void
  setAverageDistance: (distance: number | null) => void
  currentZoom: number
  populationMultiplier: number
  updateSchoolInfoDisplay: (schoolName: string, isClosed: boolean) => void
  handleUpdateSchoolOption: (schoolName: string, option: SchoolOptimizationOption) => Promise<void>
  isUpdatingSchool: boolean
  clearSchoolInfo: () => void
  notifyDistrictAssignmentsChanged: () => void
}

export function useMapRenderer({
  layerRefs,
  districtData,
  setDistrictData,
  schoolData,
  distanceData,
  selectedMode,
  selectedYear,
  displayMode,
  borderColor,
  opacity,
  displaySettings,
  selectedTownIds,
  fixedTownIds,
  districtOptions,
  schoolSelectionSummary,
  handleToggleSchoolSelection,
  handleToggleBulkFix,
  handleTownOptionChange,
  selectedSchoolRef,
  isEditingRef,
  selectedSchoolIsClosed,
  setErrorMessage,
  setDisplayMode,
  setAverageDistance,
  currentZoom,
  populationMultiplier,
  updateSchoolInfoDisplay,
  handleUpdateSchoolOption,
  isUpdatingSchool,
  clearSchoolInfo,
  notifyDistrictAssignmentsChanged,
}: UseMapRendererProps) {
  const drawSchoolDistrictLinesWrapper = () => {
    drawSchoolDistrictLines(layerRefs, districtData, schoolData, selectedMode, displayMode)
  }

  const updateSchoolsWrapper = () => {
    updateSchools(
      layerRefs,
      schoolData,
      selectedMode,
      displayMode,
      isUpdatingSchool,
      districtData,
      distanceData,
      updateSchoolInfoDisplay,
      handleUpdateSchoolOption,
      setErrorMessage,
      displaySettings,
      currentZoom,
      schoolSelectionSummary,
      handleToggleSchoolSelection,
      handleToggleBulkFix,
    )
  }

  // ラッパー関数を定義
  const updateSchoolDistrictsWrapper = () => {
    updateSchoolDistricts(
      layerRefs,
      districtData,
      schoolData,
      selectedMode,
      displayMode,
      borderColor,
      opacity,
      displaySettings,
      selectedTownIds,
      fixedTownIds,
      districtOptions,
      selectedSchoolRef,
      isEditingRef,
      selectedSchoolIsClosed,
      setErrorMessage,
      setDisplayMode,
      (d: GeoJSONData, s: SchoolGeoJSONData, m: "Name_1" | "Name_2", dm: DisplayMode) =>
        calculateSchoolEnrollment(d, s, m, dm, selectedYear),
      updateSchoolsWrapper,
      drawSchoolDistrictLinesWrapper,
      calculateAverageDistance,
      distanceData,
      setAverageDistance,
      schoolSelectionSummary,
      handleToggleSchoolSelection,
      handleTownOptionChange,
      notifyDistrictAssignmentsChanged,
    )
  }

  const drawCentroidsWrapper = () => {
    drawCentroids(layerRefs, districtData)
  }

  const updateLayerVisibilityWrapper = () => {
    updateLayerVisibility(layerRefs, displaySettings, selectedMode, currentZoom)
  }

  const updateSchoolLabelVisibilityWrapper = () => {
    updateSchoolLabelVisibility(layerRefs, displaySettings, currentZoom)
  }

  const highlightSelectedSchoolWrapper = (schoolName: string) => {
    highlightSelectedSchool(layerRefs, schoolData, schoolName)
  }

  // 児童生徒数を増減する useEffect
  usePopulationScalingEffect({
    districtData,
    schoolData,
    populationMultiplier,
    selectedYear,
    setDistrictData,
    displayMode,
    updateSchoolDistrictsWrapper,
    updateSchoolsWrapper,
    distanceData,
    selectedMode,
    setAverageDistance,
  })

  // データが読み込まれたら地図を更新
  useInitialDataEffect({
    districtData,
    schoolData,
    layerRefs,
    updateSchoolDistrictsWrapper,
    updateSchoolsWrapper,
    drawSchoolDistrictLinesWrapper,
    drawCentroidsWrapper,
    distanceData,
    selectedMode,
    setAverageDistance,
  })

  useDistrictOptionEffect({
    districtData,
    schoolData,
    updateSchoolDistrictsWrapper,
    updateSchoolsWrapper,
    selectedTownIds,
    fixedTownIds,
    districtOptions,
  })

  // 表示モードが変更されたら地図を更新
  useDisplayModeEffect({
    districtData,
    schoolData,
    displayMode,
    selectedYear,
    updateSchoolDistrictsWrapper,
    updateSchoolsWrapper,
    drawSchoolDistrictLinesWrapper,
    distanceData,
    selectedMode,
    setAverageDistance,
  })

  // 境界線の色が変更されたら地図を更新
  useBorderColorEffect({
    borderColor,
    districtData,
    schoolData,
    updateSchoolDistrictsWrapper,
    updateSchoolsWrapper,
  })

  // 選択モードが変更されたら地図を更新
  useSelectedModeEffect({
    selectedMode,
    districtData,
    schoolData,
    clearSchoolInfo,
    updateSchoolDistrictsWrapper,
    updateSchoolsWrapper,
    drawSchoolDistrictLinesWrapper,
    drawCentroidsWrapper,
    updateLayerVisibilityWrapper,
    distanceData,
    displayMode,
    setAverageDistance,
  })

  // ズームレベルが変更されたら学校ラベルの表示/非表示を更新
  useZoomEffect({ currentZoom, updateSchoolLabelVisibilityWrapper })

  // 表示設定が変更されたら地図を更新
  useDisplaySettingsEffect({
    layerRefs,
    opacity,
    displaySettings,
    updateLayerVisibilityWrapper,
    updateSchoolsWrapper,
    updateSchoolDistrictsWrapper,
  })

  // 外部から使用できるラッパー関数を返す
  return {
    updateSchoolDistrictsWrapper,
    updateSchoolsWrapper,
    drawSchoolDistrictLinesWrapper,
    drawCentroidsWrapper,
    updateLayerVisibilityWrapper,
    updateSchoolLabelVisibilityWrapper,
    highlightSelectedSchoolWrapper,
  }
}

interface PopulationScalingParams {
  districtData: GeoJSONData | null
  schoolData: SchoolGeoJSONData | null
  populationMultiplier: number
  selectedYear: number
  setDistrictData: Dispatch<SetStateAction<GeoJSONData | null>>
  displayMode: DisplayMode
  updateSchoolDistrictsWrapper: () => void
  updateSchoolsWrapper: () => void
  distanceData: DistanceData | null
  selectedMode: "Name_1" | "Name_2"
  setAverageDistance: (distance: number | null) => void
}

function usePopulationScalingEffect({
  districtData,
  schoolData,
  populationMultiplier,
  selectedYear,
  setDistrictData,
  displayMode,
  updateSchoolDistrictsWrapper,
  updateSchoolsWrapper,
  distanceData,
  selectedMode,
  setAverageDistance,
}: PopulationScalingParams) {
  useEffect(() => {
    if (districtData && schoolData) {
      const updatedDistrictData = {
        ...districtData,
        features: districtData.features.map((district: any) => {
          const properties = district.properties ?? {}

          const baseShoRaw =
            properties.populationBase?.sho?.[selectedYear] ??
            properties[`num_sho${selectedYear}`] ??
            properties.num_sho2024 ??
            0
          const baseChuRaw =
            properties.populationBase?.chu?.[selectedYear] ??
            properties[`num_chu${selectedYear}`] ??
            properties.num_chu2024 ??
            0

          const baseSho = Number(baseShoRaw) || 0
          const baseChu = Number(baseChuRaw) || 0

          const scaledSho = Number.isFinite(baseSho) ? baseSho * populationMultiplier : 0
          const scaledChu = Number.isFinite(baseChu) ? baseChu * populationMultiplier : 0

          const nextPopulationBase = {
            sho: {
              ...(properties.populationBase?.sho ?? {}),
              [selectedYear]: baseSho,
            },
            chu: {
              ...(properties.populationBase?.chu ?? {}),
              [selectedYear]: baseChu,
            },
          }

          return {
            ...district,
            properties: {
              ...properties,
              populationBase: nextPopulationBase,
              editedStudents: {
                num_sho: baseSho === 0 ? 0 : scaledSho,
                num_chu: baseChu === 0 ? 0 : scaledChu,
              },
            },
          }
        }),
      }
      setDistrictData(updatedDistrictData)

      calculateSchoolEnrollment(updatedDistrictData, schoolData, "Name_1", displayMode, selectedYear)
      calculateSchoolEnrollment(updatedDistrictData, schoolData, "Name_2", displayMode, selectedYear)

      updateSchoolDistrictsWrapper()
      updateSchoolsWrapper()

      if (distanceData) {
        const avgDistance = calculateAverageDistance(updatedDistrictData, distanceData, selectedMode, displayMode)
        setAverageDistance(avgDistance)
      }
    }
  }, [populationMultiplier, selectedYear])
}

interface InitialDataParams {
  districtData: GeoJSONData | null
  schoolData: SchoolGeoJSONData | null
  layerRefs: LayerRefs
  updateSchoolDistrictsWrapper: () => void
  updateSchoolsWrapper: () => void
  drawSchoolDistrictLinesWrapper: () => void
  drawCentroidsWrapper: () => void
  distanceData: DistanceData | null
  selectedMode: "Name_1" | "Name_2"
  setAverageDistance: (distance: number | null) => void
}

function useInitialDataEffect({
  districtData,
  schoolData,
  layerRefs,
  updateSchoolDistrictsWrapper,
  updateSchoolsWrapper,
  drawSchoolDistrictLinesWrapper,
  drawCentroidsWrapper,
  distanceData,
  selectedMode,
  setAverageDistance,
}: InitialDataParams) {
  useEffect(() => {
    if (districtData && schoolData && layerRefs.mapRef.current) {
      updateSchoolDistrictsWrapper()
      updateSchoolsWrapper()
      drawSchoolDistrictLinesWrapper()
      drawCentroidsWrapper()

      if (distanceData) {
        const avgDistance = calculateAverageDistance(districtData, distanceData, selectedMode, "current")
        setAverageDistance(avgDistance)
      }
    }
  }, [districtData, schoolData])
}

interface DistrictOptionParams {
  districtData: GeoJSONData | null
  schoolData: SchoolGeoJSONData | null
  updateSchoolDistrictsWrapper: () => void
  updateSchoolsWrapper: () => void
  selectedTownIds: Set<string>
  fixedTownIds: Set<string>
  districtOptions: Record<string, DistrictOptionValue>
}

function useDistrictOptionEffect({
  districtData,
  schoolData,
  updateSchoolDistrictsWrapper,
  updateSchoolsWrapper,
  selectedTownIds,
  fixedTownIds,
  districtOptions,
}: DistrictOptionParams) {
  useEffect(() => {
    if (districtData && schoolData) {
      updateSchoolDistrictsWrapper()
      updateSchoolsWrapper()
    }
  }, [selectedTownIds, fixedTownIds, districtOptions])
}

interface DisplayModeParams {
  districtData: GeoJSONData | null
  schoolData: SchoolGeoJSONData | null
  displayMode: DisplayMode
  selectedYear: number
  updateSchoolDistrictsWrapper: () => void
  updateSchoolsWrapper: () => void
  drawSchoolDistrictLinesWrapper: () => void
  distanceData: DistanceData | null
  selectedMode: "Name_1" | "Name_2"
  setAverageDistance: (distance: number | null) => void
}

function useDisplayModeEffect({
  districtData,
  schoolData,
  displayMode,
  selectedYear,
  updateSchoolDistrictsWrapper,
  updateSchoolsWrapper,
  drawSchoolDistrictLinesWrapper,
  distanceData,
  selectedMode,
  setAverageDistance,
}: DisplayModeParams) {
  useEffect(() => {
    if (districtData && schoolData) {
      calculateSchoolEnrollment(districtData, schoolData, "Name_1", displayMode, selectedYear)
      calculateSchoolEnrollment(districtData, schoolData, "Name_2", displayMode, selectedYear)

      updateSchoolDistrictsWrapper()
      updateSchoolsWrapper()
      drawSchoolDistrictLinesWrapper()

      if (distanceData) {
        const avgDistance = calculateAverageDistance(districtData, distanceData, selectedMode, displayMode)
        setAverageDistance(avgDistance)
      }
    }
  }, [displayMode, selectedYear, districtData, schoolData, distanceData, selectedMode])
}

interface BorderColorParams {
  borderColor: string
  districtData: GeoJSONData | null
  schoolData: SchoolGeoJSONData | null
  updateSchoolDistrictsWrapper: () => void
  updateSchoolsWrapper: () => void
}

function useBorderColorEffect({
  borderColor,
  districtData,
  schoolData,
  updateSchoolDistrictsWrapper,
  updateSchoolsWrapper,
}: BorderColorParams) {
  useEffect(() => {
    if (districtData && schoolData) {
      updateSchoolDistrictsWrapper()
      updateSchoolsWrapper()
    }
  }, [borderColor])
}

interface SelectedModeParams {
  selectedMode: "Name_1" | "Name_2"
  districtData: GeoJSONData | null
  schoolData: SchoolGeoJSONData | null
  clearSchoolInfo: () => void
  updateSchoolDistrictsWrapper: () => void
  updateSchoolsWrapper: () => void
  drawSchoolDistrictLinesWrapper: () => void
  drawCentroidsWrapper: () => void
  updateLayerVisibilityWrapper: () => void
  distanceData: DistanceData | null
  displayMode: DisplayMode
  setAverageDistance: (distance: number | null) => void
}

function useSelectedModeEffect({
  selectedMode,
  districtData,
  schoolData,
  clearSchoolInfo,
  updateSchoolDistrictsWrapper,
  updateSchoolsWrapper,
  drawSchoolDistrictLinesWrapper,
  drawCentroidsWrapper,
  updateLayerVisibilityWrapper,
  distanceData,
  displayMode,
  setAverageDistance,
}: SelectedModeParams) {
  useEffect(() => {
    if (districtData && schoolData) {
      clearSchoolInfo()
      updateSchoolDistrictsWrapper()
      updateSchoolsWrapper()
      drawSchoolDistrictLinesWrapper()
      drawCentroidsWrapper()
      updateLayerVisibilityWrapper()

      if (districtData && distanceData) {
        const avgDistance = calculateAverageDistance(districtData, distanceData, selectedMode, displayMode)
        setAverageDistance(avgDistance)
      }
    }
  }, [selectedMode])
}

interface ZoomParams {
  currentZoom: number
  updateSchoolLabelVisibilityWrapper: () => void
}

function useZoomEffect({ currentZoom, updateSchoolLabelVisibilityWrapper }: ZoomParams) {
  useEffect(() => {
    updateSchoolLabelVisibilityWrapper()
  }, [currentZoom])
}

interface DisplaySettingsParams {
  layerRefs: LayerRefs
  opacity: number
  displaySettings: DisplaySettings
  updateLayerVisibilityWrapper: () => void
  updateSchoolsWrapper: () => void
  updateSchoolDistrictsWrapper: () => void
}

function useDisplaySettingsEffect({
  layerRefs,
  opacity,
  displaySettings,
  updateLayerVisibilityWrapper,
  updateSchoolsWrapper,
  updateSchoolDistrictsWrapper,
}: DisplaySettingsParams) {
  useEffect(() => {
    if (!layerRefs.mapRef.current) return

    if (layerRefs.districtLayerRef.current) {
      layerRefs.districtLayerRef.current.eachLayer((layer: any) => {
        if (layer.setStyle) {
          layer.setStyle({ fillOpacity: opacity })
        }
      })
    }

    if (displaySettings.boundaries) {
      if (
        layerRefs.districtLayerRef.current &&
        !layerRefs.mapRef.current.hasLayer(layerRefs.districtLayerRef.current)
      ) {
        layerRefs.mapRef.current.addLayer(layerRefs.districtLayerRef.current)
      }
      updateSchoolDistrictsWrapper()
    } else {
      if (layerRefs.districtLayerRef.current && layerRefs.mapRef.current.hasLayer(layerRefs.districtLayerRef.current)) {
        layerRefs.mapRef.current.removeLayer(layerRefs.districtLayerRef.current)
      }
    }

    updateLayerVisibilityWrapper()
    updateSchoolsWrapper()
  }, [opacity, displaySettings])
}
