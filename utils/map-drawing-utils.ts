import type React from "react"
import L from "leaflet"
import "leaflet.markercluster"
import { getColor } from "@/lib/utils"
import { createSchoolMarker, createSchoolLabel, deriveSchoolState } from "@/utils/school-utils"
import { createTownPopup, type TownPopupProps } from "@/components/town-popup"
import type { DistanceData } from "@/lib/calculate-average-distance"
import type GeoJSON from "geojson"
import type {
  DisplayMode,
  DisplaySettings,
  DistrictOptionValue,
  GeoJSONData,
  School,
  SchoolGeoJSONData,
  SchoolOptimizationOption,
} from "@/types/map-types"

export interface LayerRefs {
  mapRef: React.MutableRefObject<L.Map | null>
  districtLayerRef: React.MutableRefObject<L.LayerGroup | null>
  schoolLayerRef: React.MutableRefObject<L.LayerGroup | null>
  elementarySchoolLayerRef: React.MutableRefObject<L.MarkerClusterGroup | null>
  middleSchoolLayerRef: React.MutableRefObject<L.MarkerClusterGroup | null>
  lineLayerRef: React.MutableRefObject<L.LayerGroup | null>
  centroidLayerRef: React.MutableRefObject<L.LayerGroup | null>
  highlightLayerRef: React.MutableRefObject<L.LayerGroup | null>
  schoolLabelLayerRef: React.MutableRefObject<L.LayerGroup | null>
  disabledSchoolLayerRef: React.MutableRefObject<L.LayerGroup | null>
  closedSchoolLayerRef: React.MutableRefObject<L.LayerGroup | null>
  closedElementarySchoolLayerRef: React.MutableRefObject<L.LayerGroup | null>
  closedMiddleSchoolLayerRef: React.MutableRefObject<L.LayerGroup | null>
  currentDistrictPopupIdRef: React.MutableRefObject<string | null>
}

const injectToggleStyles = () => {
  if (typeof document === "undefined") return
  if (document.getElementById("leaflet-toggle-style")) return
  const style = document.createElement("style")
  style.id = "leaflet-toggle-style"
  style.textContent = `
  .toggle {
    display:inline-flex; align-items:center; gap:8px;
    cursor:pointer; user-select:none; line-height:1;
  }
  .toggle[aria-disabled="true"] { opacity:.5; cursor:not-allowed; }

  /* 視覚的には非表示だがフォーカス可能 */
  .toggle input[type="checkbox"]{
    position:absolute; width:1px; height:1px; margin:-1px;
    border:0; padding:0; clip:rect(0 0 0 0); overflow:hidden;
  }
  .toggle .label-text{ font-size:13px; color:#111827; }

  .toggle [data-slider]{
    display:inline-block; vertical-align:middle;
    position:relative; width:44px; height:24px; box-sizing:border-box;
    background:#e5e7eb; border-radius:9999px; transition:background .2s;
    box-shadow:inset 0 0 0 1px rgba(0,0,0,.08);
  }
  .toggle [data-slider]::after{
    content:""; position:absolute; top:3px; left:3px;
    width:18px; height:18px; border-radius:9999px; background:#fff;
    box-shadow:0 1px 2px rgba(0,0,0,.15); transition:transform .2s;
  }
  .toggle input[type="checkbox"]:checked + [data-slider]{ background:#000000; } /* emerald */
  .toggle input[type="checkbox"]:checked + [data-slider]::after{ transform:translateX(20px); }
  `
  document.head.appendChild(style)
}





const describeDistrictOption = (option: DistrictOptionValue): string => {
  switch (option) {
    case "固定":
      return "現行割当で固定"
    case "最適化対象":
      return "最適化対象（自由）"
    default:
      return "最適化から除外"
  }
}

// 学区表示の更新
export function updateSchoolDistricts(
  layerRefs: LayerRefs,
  districtData: GeoJSONData | null,
  schoolData: SchoolGeoJSONData | null,
  selectedMode: "Name_1" | "Name_2",
  displayMode: DisplayMode,
  borderColor: string,
  opacity: number,
  displaySettings: DisplaySettings,
  selectedTownIds: Set<string>,
  fixedTownIds: Set<string>,
  districtOptions: Record<string, DistrictOptionValue>,
  selectedSchoolRef: React.MutableRefObject<string | null>,
  isEditingRef: React.MutableRefObject<boolean>,
  selectedSchoolIsClosed: boolean,
  setErrorMessage: (message: string | null) => void,
  setDisplayMode: (mode: DisplayMode) => void,
  calculateSchoolEnrollment: (
    districtData: GeoJSONData,
    schoolData: SchoolGeoJSONData,
    mode: "Name_1" | "Name_2",
    displayMode: DisplayMode,
  ) => void,
  refreshSchools: () => void,
  drawSchoolDistrictLines: () => void,
  calculateAverageDistance: (
    districtData: GeoJSONData,
    distanceData: DistanceData | null,
    mode: "Name_1" | "Name_2",
    displayMode: DisplayMode,
  ) => number | null,
  distanceData: DistanceData | null,
  setAverageDistance: (distance: number | null) => void,
  schoolSelectionSummary: Record<
    string,
    {
      Name_1: { total: number; selected: number; fixed: number }
      Name_2: { total: number; selected: number; fixed: number }
    }
  >,
  handleToggleSchoolSelection: (schoolName: string, include: boolean) => Promise<void> | void,
  handleTownOptionChange: (townId: string, option: DistrictOptionValue) => void,
  notifyDistrictAssignmentsChanged: () => void,
) {
  injectToggleStyles()
  if (
    !layerRefs.districtLayerRef.current ||
    !districtData ||
    !districtData.features ||
    !schoolData ||
    !schoolData.features ||
    !layerRefs.mapRef.current
  ) {
    console.warn("必要なデータまたはレイヤーが不足しています")
    return
  }

  const districtCanvasRenderer = L.canvas({ padding: 0.5 })

  const previouslyOpenDistrictId =
    layerRefs.currentDistrictPopupIdRef?.current ?? null

  layerRefs.districtLayerRef.current.clearLayers()

  const closedSchools = schoolData.features
    .filter((s: SchoolGeoJSONData["features"][number]) => {
      const assignedSho = Number(s.properties.assignedStudentsSho ?? 0)
      const assignedChu = Number(s.properties.assignedStudentsChu ?? 0)
      const isClosedBase = Boolean(s.properties.isClosed)

      if (displayMode === "original") {
        return isClosedBase
      }

      if (displayMode === "current") {
        return isClosedBase
      }

      // optimized: isClosed または対象校種の割当0なら閉校扱い
      const assigned = selectedMode === "Name_1" ? assignedSho : assignedChu
      return isClosedBase || assigned === 0
    })
    .map((s: SchoolGeoJSONData["features"][number]) => s.properties.name)

  const excludedMode = (displaySettings.excludedMode ?? "hidden") as "hidden" | "faded-info" | "faded-no-info"
  const selectedIds = selectedTownIds ?? new Set<string>()

  L.geoJSON(districtData as GeoJSON.FeatureCollection, {
    style: (feature) => {
      const districtName =
        displayMode === "original"
          ? feature?.properties?.originalDistricts?.[selectedMode]
          : displayMode === "current"
            ? feature?.properties?.editedDistricts?.[selectedMode]
            : feature?.properties?.optimizedDistricts?.[selectedMode] ||
              feature?.properties?.editedDistricts?.[selectedMode]

      const isClosedSchoolDistrict = displayMode !== "original" && closedSchools.includes(districtName)
      const districtId = feature?.properties?.id
      const isExcluded = districtId ? !selectedIds.has(districtId) : false
      const shouldHide = isExcluded && excludedMode === "hidden"

      if (shouldHide) {
        return {
          fillColor: "transparent",
          color: borderColor === "white" ? "#fff" : "#000",
          weight: borderColor === "white" ? 2 : 1,
          fillOpacity: 0,
          dashArray: "4 4",
          renderer: districtCanvasRenderer,
        }
      }

      // determine fixed/option state for styling
      const optionFromState = districtId ? districtOptions[districtId] : undefined
      const currentOption: DistrictOptionValue = optionFromState ?? (isExcluded ? "対象外" : "最適化対象")
      const isFixedOption = currentOption === "固定" || (districtId ? fixedTownIds.has(districtId) : false)

      const baseColor = getColor(districtName, selectedMode)
      const fillColor = isExcluded ? "#d3d3d3" : baseColor
      const baseOpacity = isClosedSchoolDistrict ? 0 : opacity
      const fadedOpacity = excludedMode === "faded-no-info" ? Math.min(baseOpacity, 0.1) : Math.min(baseOpacity, 0.25)
      const fillOpacity = isExcluded ? fadedOpacity : baseOpacity

      const defaultStroke = borderColor === "white" ? "#fff" : "#000"
      const strokeColor  = isFixedOption ? "#ef4444" : defaultStroke   // 赤 (#ef4444) に変更
      const strokeWeight = isFixedOption ? 3 : (borderColor === "white" ? 2 : 1) // 少し太め

      return {
        fillColor,
        color: strokeColor,
        weight: strokeWeight,
        fillOpacity,
        dashArray: isExcluded ? "4 4" : undefined, // 固定は実線、対象外のみ点線
        renderer: districtCanvasRenderer,
      }
    },
    onEachFeature: (feature, layer) => {
      const districtName =
        displayMode === "original"
          ? feature.properties.originalDistricts?.[selectedMode]
          : displayMode === "current"
            ? feature.properties.editedDistricts?.[selectedMode]
            : displayMode === "optimized"
              ? feature.properties.optimizedDistricts?.[selectedMode]
              : feature.properties.editedDistricts[selectedMode]

      const districtId = feature.properties.id
      const optionFromState = districtId ? districtOptions[districtId] : undefined
      const isExcluded = districtId ? !selectedIds.has(districtId) : false
      const currentOption: DistrictOptionValue = optionFromState ?? (isExcluded ? "対象外" : "最適化対象")
      const isFixedOption = currentOption === "固定" || (districtId ? fixedTownIds.has(districtId) : false)
      const shouldHide = isExcluded && excludedMode === "hidden"
      const studentLabel = selectedMode === "Name_1" ? "児童数" : "生徒数"

      const townIdLabel = districtId !== undefined ? String(districtId) : "未設定"
      const targetTownId = districtId !== undefined ? String(districtId) : null
      const showStudentInfo = !isExcluded || excludedMode === "faded-info"
      const getAssignedName = (modeKey: "Name_1" | "Name_2") => {
        if (displayMode === "original") {
          return (
            feature?.properties?.originalDistricts?.[modeKey] ??
            feature?.properties?.[modeKey] ??
            "-"
          )
        }
        if (displayMode === "current") {
          return (
            feature?.properties?.editedDistricts?.[modeKey] ??
            feature?.properties?.originalDistricts?.[modeKey] ??
            feature?.properties?.[modeKey] ??
            "-"
          )
        }
        return (
          feature?.properties?.optimizedDistricts?.[modeKey] ??
          feature?.properties?.editedDistricts?.[modeKey] ??
          feature?.properties?.originalDistricts?.[modeKey] ??
          feature?.properties?.[modeKey] ??
          "-"
        )
      }

      const computeCurrentStudents = () => {
        if (displayMode === "original") {
          return selectedMode === "Name_1"
            ? Number(feature.properties.num_sho2024 ?? 0)
            : Number(feature.properties.num_chu2024 ?? 0)
        }

        const edited = feature.properties.editedStudents
        if (edited) {
          return selectedMode === "Name_1"
            ? Number(edited.num_sho ?? feature.properties.num_sho2024 ?? 0)
            : Number(edited.num_chu ?? feature.properties.num_chu2024 ?? 0)
        }

        return selectedMode === "Name_1"
          ? Number(feature.properties.num_sho2024 ?? 0)
          : Number(feature.properties.num_chu2024 ?? 0)
      }

      const computeDistanceText = () => {
        const selectedModeKey: "Name_1" | "Name_2" | null =
          selectedMode === "Name_1" ? "Name_1" : selectedMode === "Name_2" ? "Name_2" : null

        if (!distanceData || !selectedModeKey || districtId === undefined) {
          return undefined
        }

        const assignedSchool = getAssignedName(selectedModeKey)
        if (!assignedSchool || assignedSchool === "-") {
          return undefined
        }

        const distanceKey = `${districtId}-${assignedSchool}`
        const rawDistance = distanceData[distanceKey]
        const numericDistance =
          typeof rawDistance === "number"
            ? rawDistance
            : typeof rawDistance === "string"
              ? Number(rawDistance)
              : NaN

        if (!Number.isFinite(numericDistance)) {
          return undefined
        }

        const formatted =
          Math.abs(numericDistance) >= 10 ? numericDistance.toFixed(1) : numericDistance.toFixed(2)
        return `通学距離: ${formatted}km`
      }

      const townName = feature?.properties?.name ?? ""

      const readLatestOption = (): DistrictOptionValue => {
        if (!targetTownId) return currentOption
        const optionEntry = districtOptions[targetTownId]
        const isExcludedNow = !selectedIds.has(targetTownId)
        return optionEntry ?? (isExcludedNow ? "対象外" : "最適化対象")
      }

      let currentOptionState: DistrictOptionValue = readLatestOption()

      const restyleDistrict = (opt: DistrictOptionValue) => {
        const isFixed = opt === "固定"
        const defaultStroke = borderColor === "white" ? "#fff" : "#000"
        const strokeColor = isFixed ? "#ef4444" : defaultStroke
        const strokeWeight = isFixed ? 3 : borderColor === "white" ? 2 : 1
        ;(layer as L.Path).setStyle({ color: strokeColor, weight: strokeWeight })
      }

      let renderTownPopup: ((props: TownPopupProps) => void) | null = null
      let unmountTownPopup: (() => void) | null = null

      function commitOption(option: DistrictOptionValue) {
        if (option === currentOptionState) return
        currentOptionState = option
        if (targetTownId) {
          handleTownOptionChange(targetTownId, option)
        }
        restyleDistrict(option)
        renderTownPopup?.(buildTownPopupProps(option))
      }

      function buildTownPopupProps(option: DistrictOptionValue): TownPopupProps {
        const assignedSho = getAssignedName("Name_1")
        const assignedChu = getAssignedName("Name_2")
        const isClosedSho = displayMode !== "original" && closedSchools.includes(assignedSho)
        const isClosedChu = displayMode !== "original" && closedSchools.includes(assignedChu)

        const studentInfo = showStudentInfo
          ? {
              label: studentLabel,
              value: computeCurrentStudents(),
              distanceText: computeDistanceText(),
            }
          : {
              label: studentLabel,
              value: null,
              message: "対象外に設定されています",
            }

        return {
          townLabel: townName || townIdLabel,
          studentInfo,
          assignments: {
            sho: { name: assignedSho, isClosed: isClosedSho },
            chu: { name: assignedChu, isClosed: isClosedChu },
          },
          currentOption: option,
          describeOption: describeDistrictOption,
          hasIdentifier: Boolean(targetTownId),
          identifierMessage: "この地区には識別子がありません",
          onChangeOption: commitOption,
        }
      }

      const popupInstance = createTownPopup(buildTownPopupProps(currentOptionState))
      renderTownPopup = popupInstance.render
      unmountTownPopup = popupInstance.unmount
      layer.bindPopup(popupInstance.container)

      layer.on("popupopen", () => {
        if (layerRefs.currentDistrictPopupIdRef) {
          layerRefs.currentDistrictPopupIdRef.current = districtId ?? null
        }
        currentOptionState = readLatestOption()
        renderTownPopup?.(buildTownPopupProps(currentOptionState))
        restyleDistrict(currentOptionState)
      })

      layer.on("popupclose", () => {
        if (
          layerRefs.currentDistrictPopupIdRef &&
          layerRefs.currentDistrictPopupIdRef.current === (districtId ?? null)
        ) {
          layerRefs.currentDistrictPopupIdRef.current = null
        }
      })

      layer.on("remove", () => {
        unmountTownPopup?.()
      })

      if (!shouldHide && previouslyOpenDistrictId && districtId && districtId === previouslyOpenDistrictId) {
        setTimeout(() => {
          if ((layer as L.Layer).getPopup && (layer as L.Layer).getPopup()) {
            layer.openPopup()
          }
        }, 0)
      }


      layer.on("click", () => {
        if (displayMode === "original") {
          setErrorMessage("既存校区モードでは校区の編集はできません")
          return
        }

        if (!isEditingRef.current) {
          setErrorMessage("校区拡大をオンにすると校区を変更できます")
          return
        }

        if (displayMode === "optimized") {
          setDisplayMode("current")
          setErrorMessage("校区拡大に切り替えました")
        }

        if (isExcluded) {
          setErrorMessage("対象外の地区は編集できません")
          return
        }

        if (currentOptionState === "固定") {
          setErrorMessage("固定設定の地区は編集できません")
          return
        }

        if (selectedSchoolRef.current && !selectedSchoolIsClosed) {
          // 履歴エントリを作成（変更前の状態を保存）
          const previousSchool = feature.properties.editedDistricts[selectedMode]
          const newSchool = selectedSchoolRef.current

          // 校区を変更
          feature.properties.editedDistricts[selectedMode] = selectedSchoolRef.current
          ;(layer as L.Path).setStyle({
            fillColor: getColor(selectedSchoolRef.current, selectedMode),
            fillOpacity: opacity,
          })
          drawSchoolDistrictLines()
          console.log(`校区が変更されました: ${selectedMode} -> ${selectedSchoolRef.current}`)

          notifyDistrictAssignmentsChanged()

          const effectiveDisplayMode = displayMode === "optimized" ? "current" : displayMode
          calculateSchoolEnrollment(districtData, schoolData, "Name_1", effectiveDisplayMode)
          calculateSchoolEnrollment(districtData, schoolData, "Name_2", effectiveDisplayMode)
          
          setTimeout(() => {
            refreshSchools()
          }, 0)

          if (districtData && distanceData) {
            const avgDistance = calculateAverageDistance(districtData, distanceData, selectedMode, "current")
            setAverageDistance(avgDistance)
          }
          renderTownPopup?.(buildTownPopupProps(currentOptionState))
        } else if (selectedSchoolRef.current && selectedSchoolIsClosed) {
          setErrorMessage("廃校の学校は校区を拡大できません")
        }
      })
    },
    pane: "districtPane",
    filter: (feature) => {
      if (!displaySettings.boundaries) return false
      return true
    },
  }).addTo(layerRefs.districtLayerRef.current)

  const currentZoom =
  layerRefs.mapRef.current ? layerRefs.mapRef.current.getZoom() : 13
  updateLayerVisibility(layerRefs, displaySettings, selectedMode, currentZoom)
}

// 学校表示の更新
export function updateSchools(
  layerRefs: LayerRefs,
  schoolData: SchoolGeoJSONData | null,
  selectedMode: "Name_1" | "Name_2",
  displayMode: DisplayMode,
  isUpdatingSchool: boolean,
  districtData: GeoJSONData | null,
  distanceData: DistanceData | null,
  updateSchoolInfoDisplay: (schoolName: string, isClosed: boolean) => void,
  handleUpdateSchoolOption: (schoolName: string, option: SchoolOptimizationOption) => Promise<void>,
  setErrorMessage: (message: string | null) => void,
  displaySettings: DisplaySettings,
  currentZoom: number,
  schoolSelectionSummary: Record<
    string,
    {
      Name_1: { total: number; selected: number; fixed: number }
      Name_2: { total: number; selected: number; fixed: number }
    }
  >,
  handleToggleSchoolSelection: (schoolName: string, include: boolean) => Promise<void> | void,
  handleToggleBulkFix: (
    schoolName: string,
    modeKey: "Name_1" | "Name_2",
    shouldFix: boolean,
  ) => Promise<void> | void,
) {
  console.log("updateSchools called", {
    schoolLayerRef: !!layerRefs.schoolLayerRef.current,
    elementarySchoolLayerRef: !!layerRefs.elementarySchoolLayerRef.current,
    middleSchoolLayerRef: !!layerRefs.middleSchoolLayerRef.current,
    schoolLabelLayerRef: !!layerRefs.schoolLabelLayerRef.current,
    disabledSchoolLayerRef: !!layerRefs.disabledSchoolLayerRef.current,
    closedSchoolLayerRef: !!layerRefs.closedSchoolLayerRef.current,
    schoolDataFeatures: schoolData?.features?.length,
    mapRef: !!layerRefs.mapRef.current,
  })

  if (!layerRefs.mapRef.current) {
    console.warn("mapRef.current が初期化されていません")
    return
  }

  // 必要なレイヤーが初期化されていない場合は作成
  if (!layerRefs.schoolLayerRef.current) {
    layerRefs.schoolLayerRef.current = L.layerGroup().addTo(layerRefs.mapRef.current)
  }
  if (!layerRefs.elementarySchoolLayerRef.current) {
    layerRefs.elementarySchoolLayerRef.current = new L.MarkerClusterGroup({
      disableClusteringAtZoom: 14,
      maxClusterRadius: 50,
    }).addTo(layerRefs.mapRef.current)
  }
  if (!layerRefs.middleSchoolLayerRef.current) {
    layerRefs.middleSchoolLayerRef.current = new L.MarkerClusterGroup({
      disableClusteringAtZoom: 14,
      maxClusterRadius: 50,
    }).addTo(layerRefs.mapRef.current)
  }

  if (!layerRefs.schoolLabelLayerRef.current) {
    layerRefs.schoolLabelLayerRef.current = L.layerGroup().addTo(layerRefs.mapRef.current)
  }

  if (!layerRefs.disabledSchoolLayerRef.current) {
    layerRefs.disabledSchoolLayerRef.current = L.layerGroup().addTo(layerRefs.mapRef.current)
  }
  if (!layerRefs.closedSchoolLayerRef.current) {
    layerRefs.closedSchoolLayerRef.current = L.layerGroup().addTo(layerRefs.mapRef.current)
  }
  if (!layerRefs.closedElementarySchoolLayerRef.current) {
    layerRefs.closedElementarySchoolLayerRef.current = L.layerGroup().addTo(layerRefs.mapRef.current)
  }
  if (!layerRefs.closedMiddleSchoolLayerRef.current) {
    layerRefs.closedMiddleSchoolLayerRef.current = L.layerGroup().addTo(layerRefs.mapRef.current)
  }

  if (!schoolData?.features || !Array.isArray(schoolData.features)) {
    console.warn("学校データが不完全です:", schoolData)
    return
  }

  // 既存のレイヤーをクリア
  if (layerRefs.elementarySchoolLayerRef.current) {
    layerRefs.elementarySchoolLayerRef.current.clearLayers()
  }
  if (layerRefs.middleSchoolLayerRef.current) {
    layerRefs.middleSchoolLayerRef.current.clearLayers()
  }
  if (layerRefs.schoolLayerRef.current) {
    layerRefs.schoolLayerRef.current.clearLayers()
  }
  if (layerRefs.schoolLabelLayerRef.current) {
    layerRefs.schoolLabelLayerRef.current.clearLayers()
  }
  if (layerRefs.disabledSchoolLayerRef.current) {
    layerRefs.disabledSchoolLayerRef.current.clearLayers()
  }
  if (layerRefs.closedSchoolLayerRef.current) {
    layerRefs.closedSchoolLayerRef.current.clearLayers()
  }
  if (layerRefs.closedElementarySchoolLayerRef.current) {
    layerRefs.closedElementarySchoolLayerRef.current.clearLayers()
  }
  if (layerRefs.closedMiddleSchoolLayerRef.current) {
    layerRefs.closedMiddleSchoolLayerRef.current.clearLayers()
  }

  // 小学校と中学校を分けてフィルタリング
  const elementarySchools = schoolData.features.filter(
    (feature: SchoolGeoJSONData["features"][number]) => feature.properties.name.endsWith("小学校"),
  )
  const middleSchools = schoolData.features.filter(
    (feature: SchoolGeoJSONData["features"][number]) => feature.properties.name.endsWith("中学校"),
  )
  const otherSchools = schoolData.features.filter(
    (feature: SchoolGeoJSONData["features"][number]) =>
      !feature.properties.name.endsWith("小学校") && !feature.properties.name.endsWith("中学校"),
  )

  // 小学校の処理
  if (elementarySchools.length > 0) {
    elementarySchools.forEach((feature: SchoolGeoJSONData["features"][number]) => {
      const coords = feature.geometry.coordinates
      const latlng = L.latLng(coords[1], coords[0])
      const schoolName = feature.properties.name

      const summaryEntry = schoolSelectionSummary[schoolName]
      const selectionInfo = summaryEntry ? summaryEntry.Name_1 : { total: 0, selected: 0, fixed: 0 }

      const { marker, state } = createSchoolMarker(
        feature,
        selectedMode as "Name_1" | "Name_2", // selectedModeを適切な型にキャスト
        displayMode,
        isUpdatingSchool,
        districtData,
        distanceData,
        updateSchoolInfoDisplay,
        handleUpdateSchoolOption,
        setErrorMessage,
        selectionInfo,
        handleToggleSchoolSelection,
        handleToggleBulkFix,
      )

      // 適切なレイヤーに追加
      if (state.isClosed) {
        layerRefs.closedElementarySchoolLayerRef.current?.addLayer(marker)
      } else if (state.isSelectable) {
        layerRefs.elementarySchoolLayerRef.current?.addLayer(marker)
      } else {
        layerRefs.disabledSchoolLayerRef.current?.addLayer(marker)
      }

      // 学校名ラベルの追加
      const label = L.marker(latlng, {
        icon: createSchoolLabel(schoolName, "elementary", state.isClosed, state.isSelectable),
        pane: "schoolLabelPane",
      })

      layerRefs.schoolLabelLayerRef.current?.addLayer(label)
    })
  }

  // 中学校の処理
  if (middleSchools.length > 0) {
    middleSchools.forEach((feature: SchoolGeoJSONData["features"][number]) => {
      const coords = feature.geometry.coordinates
      const latlng = L.latLng(coords[1], coords[0])
      const schoolName = feature.properties.name
      const summaryEntry = schoolSelectionSummary[schoolName]
      const selectionInfo = summaryEntry ? summaryEntry.Name_2 : { total: 0, selected: 0, fixed: 0 }

      const { marker, state } = createSchoolMarker(
        feature,
        selectedMode as "Name_1" | "Name_2", // selectedModeを適切な型にキャスト
        displayMode,
        isUpdatingSchool,
        districtData,
        distanceData,
        updateSchoolInfoDisplay,
        handleUpdateSchoolOption,
        setErrorMessage,
        selectionInfo,
        handleToggleSchoolSelection,
        handleToggleBulkFix,
      )

      // 適切なレイヤーに追加
      if (state.isClosed) {
        layerRefs.closedMiddleSchoolLayerRef.current?.addLayer(marker)
      } else if (state.isSelectable) {
        layerRefs.middleSchoolLayerRef.current?.addLayer(marker)
      } else {
        layerRefs.disabledSchoolLayerRef.current?.addLayer(marker)
      }

      // 学校名ラベルの追加
      const label = L.marker(latlng, {
        icon: createSchoolLabel(schoolName, "middle", state.isClosed, state.isSelectable),
        pane: "schoolLabelPane",
      })

      layerRefs.schoolLabelLayerRef.current?.addLayer(label)
    })
  }

  // その他の学校の処理
  if (otherSchools.length > 0) {
    L.geoJSON({ type: "FeatureCollection", features: otherSchools } as GeoJSON.FeatureCollection, {
      pointToLayer: (feature, latlng) => {
        const schoolFeature = feature as School
        const state = deriveSchoolState(schoolFeature, selectedMode, displayMode)
        const isClosed = state.isClosedEffective

        const marker = L.circleMarker(latlng, {
          radius: 8,
          fillColor: isClosed ? "#1f2937" : "#999",
          color: isClosed ? "#111827" : "#000",
          weight: 1,
          opacity: 1,
          fillOpacity: isClosed ? 0.8 : 1.0,
          pane: isClosed ? "closedSchoolPane" : "schoolPane",
        })

        const label = L.marker(latlng, {
          icon: createSchoolLabel(schoolFeature.properties.name, "", isClosed, true),
          pane: "schoolLabelPane",
        })

        layerRefs.schoolLayerRef.current?.addLayer(marker)
        layerRefs.schoolLabelLayerRef.current?.addLayer(label)

        return marker
      },
      onEachFeature: (feature, layer) => {
        const schoolFeature = feature as School
        const schoolName = schoolFeature.properties.name
        const state = deriveSchoolState(schoolFeature, selectedMode, displayMode)
        const isClosed = state.isClosedEffective

        const minStudents = schoolFeature.properties.min_students ?? "不明"
        const maxStudents = schoolFeature.properties.max_students ?? "不明"
        const assignedStudents =
          selectedMode === "Name_1"
            ? (schoolFeature.properties.assignedStudentsSho ?? 0)
            : (schoolFeature.properties.assignedStudentsChu ?? 0)

        layer.on("click", () => {
          if (!isClosed && state.optimizationOption !== "excluded") {
            updateSchoolInfoDisplay(schoolName, isClosed)
          } else {
            const message = state.optimizationOption === "excluded"
              ? "対象外に設定した学校は選択できません"
              : "廃校の学校は選択できません"
            setErrorMessage(message)
          }
        })
      },
      pane: "schoolPane",
    })
  }

  updateLayerVisibility(layerRefs, displaySettings, selectedMode, currentZoom)
  // updateSchoolLabelVisibility(layerRefs, displaySettings, currentZoom)
}

// 学校と校区を結ぶ線を描画
export function drawSchoolDistrictLines(
  layerRefs: LayerRefs,
  districtData: GeoJSONData | null,
  schoolData: SchoolGeoJSONData | null,
  selectedMode: "Name_1" | "Name_2",
  displayMode: DisplayMode,
) {
  if (
    !layerRefs.lineLayerRef.current ||
    !districtData ||
    !districtData.features ||
    !schoolData ||
    !schoolData.features ||
    !layerRefs.mapRef.current
  ) {
    console.warn("線描画に必要なデータが不足しています")
    return
  }

  layerRefs.lineLayerRef.current.clearLayers()

  const closedSchools =
    displayMode === "original"
      ? []
      : schoolData.features
          .filter((s: SchoolGeoJSONData["features"][number]) => {
            const assigned =
              selectedMode === "Name_1"
                ? Number(s.properties.assignedStudentsSho ?? 0)
                : Number(s.properties.assignedStudentsChu ?? 0)
            return Boolean(s.properties.isClosed) || (displayMode === "optimized" && assigned === 0)
          })
          .map((s: SchoolGeoJSONData["features"][number]) => s.properties.name)

  districtData.features.forEach((districtFeature: GeoJSONData["features"][number]) => {
    if (!districtFeature.properties) return

    const districtCentroid = [districtFeature.properties.centroid_y, districtFeature.properties.centroid_x]

    const assignedSchool =
      displayMode === "original"
        ? districtFeature.properties.originalDistricts?.[selectedMode]
        : displayMode === "current"
          ? districtFeature.properties.editedDistricts?.[selectedMode]
          : displayMode === "optimized"
            ? districtFeature.properties.optimizedDistricts?.[selectedMode]
            : districtFeature.properties.editedDistricts?.[selectedMode]

    if (!assignedSchool || (displayMode !== "original" && closedSchools.includes(assignedSchool))) return

    for (const schoolFeature of schoolData.features) {
      if (!schoolFeature.properties) continue
      if (schoolFeature.properties.name === assignedSchool) {
        const schoolLatLng = [schoolFeature.geometry.coordinates[1], schoolFeature.geometry.coordinates[0]]

        L.polyline([L.latLng(schoolLatLng[0], schoolLatLng[1]), L.latLng(districtCentroid[0], districtCentroid[1])], {
          color: "black",
          weight: 2,
          opacity: 0.7,
          pane: "linePane",
        }).addTo(layerRefs.lineLayerRef.current!)

        break
      }
    }
  })
}

// 学区の重心を描画
export function drawCentroids(layerRefs: LayerRefs, districtData: GeoJSONData | null) {
  if (!layerRefs.centroidLayerRef.current || !districtData || !districtData.features || !layerRefs.mapRef.current) {
    console.warn("重心描画に必要なデータが不足しています")
    return
  }

  layerRefs.centroidLayerRef.current.clearLayers()

  districtData.features.forEach((feature: GeoJSONData["features"][number]) => {
    if (!feature.properties) return
    const districtCentroid = [feature.properties.centroid_y, feature.properties.centroid_x]
    L.circleMarker(districtCentroid as L.LatLngExpression, {
      radius: 3,
      fillColor: "black",
      color: "black",
      weight: 1,
      opacity: 1,
      fillOpacity: 1,
      pane: "centroidPane",
    }).addTo(layerRefs.centroidLayerRef.current!)
  })
}

// レイヤーの表示/非表示を更新する関数
export function updateLayerVisibility(
  layerRefs: LayerRefs,
  displaySettings: DisplaySettings,
  selectedMode: "Name_1" | "Name_2",
  currentZoom: number,
) {
  if (!layerRefs.mapRef.current) return

  const showElementaryMarkers = displaySettings.elementarySchools && displaySettings.elementaryMarkers
  const showMiddleMarkers = displaySettings.middleSchools && displaySettings.middleMarkers

  // 小学校の表示/非表示
  if (showElementaryMarkers) {
    if (
      layerRefs.elementarySchoolLayerRef.current &&
      !layerRefs.mapRef.current.hasLayer(layerRefs.elementarySchoolLayerRef.current)
    ) {
      layerRefs.mapRef.current.addLayer(layerRefs.elementarySchoolLayerRef.current)
    }
  } else {
    if (
      layerRefs.elementarySchoolLayerRef.current &&
      layerRefs.mapRef.current.hasLayer(layerRefs.elementarySchoolLayerRef.current)
    ) {
      layerRefs.mapRef.current.removeLayer(layerRefs.elementarySchoolLayerRef.current)
    }
  }

  // 中学校の表示/非表示
  if (showMiddleMarkers) {
    if (
      layerRefs.middleSchoolLayerRef.current &&
      !layerRefs.mapRef.current.hasLayer(layerRefs.middleSchoolLayerRef.current)
    ) {
      layerRefs.mapRef.current.addLayer(layerRefs.middleSchoolLayerRef.current)
    }
  } else {
    if (
      layerRefs.middleSchoolLayerRef.current &&
      layerRefs.mapRef.current.hasLayer(layerRefs.middleSchoolLayerRef.current)
    ) {
      layerRefs.mapRef.current.removeLayer(layerRefs.middleSchoolLayerRef.current)
    }
  }

  // 選択不可の学校の表示/非表示
  if (
    (selectedMode === "Name_1" && showMiddleMarkers) ||
    (selectedMode === "Name_2" && showElementaryMarkers)
  ) {
    if (
      layerRefs.disabledSchoolLayerRef.current &&
      !layerRefs.mapRef.current.hasLayer(layerRefs.disabledSchoolLayerRef.current)
    ) {
      layerRefs.mapRef.current.addLayer(layerRefs.disabledSchoolLayerRef.current)
    }
  } else {
    if (
      layerRefs.disabledSchoolLayerRef.current &&
      layerRefs.mapRef.current.hasLayer(layerRefs.disabledSchoolLayerRef.current)
    ) {
      layerRefs.mapRef.current.removeLayer(layerRefs.disabledSchoolLayerRef.current)
    }
  }

  // 廃校の学校の表示/非表示
  if (layerRefs.closedElementarySchoolLayerRef.current) {
    if (showElementaryMarkers) {
      if (!layerRefs.mapRef.current.hasLayer(layerRefs.closedElementarySchoolLayerRef.current)) {
        layerRefs.mapRef.current.addLayer(layerRefs.closedElementarySchoolLayerRef.current)
      }
    } else if (layerRefs.mapRef.current.hasLayer(layerRefs.closedElementarySchoolLayerRef.current)) {
      layerRefs.mapRef.current.removeLayer(layerRefs.closedElementarySchoolLayerRef.current)
    }
  }
  if (layerRefs.closedMiddleSchoolLayerRef.current) {
    if (showMiddleMarkers) {
      if (!layerRefs.mapRef.current.hasLayer(layerRefs.closedMiddleSchoolLayerRef.current)) {
        layerRefs.mapRef.current.addLayer(layerRefs.closedMiddleSchoolLayerRef.current)
      }
    } else if (layerRefs.mapRef.current.hasLayer(layerRefs.closedMiddleSchoolLayerRef.current)) {
      layerRefs.mapRef.current.removeLayer(layerRefs.closedMiddleSchoolLayerRef.current)
    }
  }

  if (
    layerRefs.closedSchoolLayerRef.current &&
    !layerRefs.mapRef.current.hasLayer(layerRefs.closedSchoolLayerRef.current)
  ) {
    layerRefs.mapRef.current.addLayer(layerRefs.closedSchoolLayerRef.current)
  }

  updateSchoolLabelVisibility(layerRefs, displaySettings, currentZoom)
}

// 学校ラベルの表示/非表示を更新する関数
export function updateSchoolLabelVisibility(
  layerRefs: LayerRefs,
  displaySettings: DisplaySettings,
  currentZoom: number,
) {
  if (!layerRefs.schoolLabelLayerRef.current) return

  const shouldShowLabels = currentZoom >= 14

  document.querySelectorAll(".school-label.elementary").forEach((label) => {
    ;(label as HTMLElement).style.display =
      shouldShowLabels && displaySettings.elementarySchools && displaySettings.elementaryLabels ? "block" : "none"
  })

  document.querySelectorAll(".school-label.middle").forEach((label) => {
    ;(label as HTMLElement).style.display =
      shouldShowLabels && displaySettings.middleSchools && displaySettings.middleLabels ? "block" : "none"
  })

  document.querySelectorAll(".school-label:not(.elementary):not(.middle)").forEach((label) => {
    ;(label as HTMLElement).style.display = shouldShowLabels ? "block" : "none"
  })
}

// 選択した学校をハイライト
export function highlightSelectedSchool(
  layerRefs: LayerRefs,
  schoolData: SchoolGeoJSONData | null,
  schoolName: string,
) {
  if (!schoolData || !layerRefs.mapRef.current || !layerRefs.highlightLayerRef.current) return

  layerRefs.highlightLayerRef.current.clearLayers()

  const schoolFeature = schoolData.features.find(
    (feature: SchoolGeoJSONData["features"][number]) => feature.properties.name === schoolName,
  )

  if (schoolFeature) {
    const coords = schoolFeature.geometry.coordinates
    const latlng = [coords[1], coords[0]]

    const marker = L.circleMarker(latlng as L.LatLngExpression, {
      radius: 15,
      color: "gold",
      weight: 3,
      fillColor: "none",
      pane: "schoolPane",
    })
    marker.addTo(layerRefs.highlightLayerRef.current)
  }
}
