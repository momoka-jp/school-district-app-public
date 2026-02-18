"use client"

import React from "react"
import L from "leaflet"
import type {
  DisplayMode,
  GeoJSONData,
  School,
  SchoolType,
  SchoolOptimizationOption,
} from "@/types/map-types"
import { createRoot, type Root } from "react-dom/client"
import SchoolPopup from "@/components/school-popup"
import { calculateSchoolAverageDistance, type DistanceData } from "@/lib/calculate-average-distance"
import { computeSchoolState } from "./school-state-utils"

type MarkerVariant = "elementary" | "middle" | "disabled" | "closed" | "forced"

export const createSchoolIcon = (variant: MarkerVariant) => {
  // 色（既存は据え置き／forcedだけ黄色）
  const bg =
    variant === "elementary" ? "#2563eb" :   // 小: 青
    variant === "middle"     ? "#ef4444" :   // 中: 赤（既存のまま）
    variant === "forced"     ? "#f59e0b" :   // ★ 強制開校: 黄
    variant === "closed"     ? "#374151" :   // 閉: 濃グレー
                               "#9ca3af"     // 不可: 薄グレー
  const fg = (variant === "closed" || variant === "disabled") ? "#e5e7eb" : "#ffffff"
  const halo = variant === "forced" ? "0 0 0 4px rgba(245,158,11,.25)" : "none" // 強制のみ薄いハロ

  const iconHtml = `
    <div class="icon-container ${variant}"
         style="width:30px;height:30px;border-radius:9999px;
                display:flex;align-items:center;justify-content:center;
                background:${bg};color:${fg};box-shadow:${halo};">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
           viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 2 1 3 3 3h6c2 0 3-1 3-3v-5" />
      </svg>
    </div>`

  return L.divIcon({
    className: `school-icon ${variant}`,
    html: iconHtml,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

export const createSchoolLabel = (schoolName: string, schoolType: string, isClosed: boolean, isSelectable: boolean) => {
  return L.divIcon({
    className: `school-label ${schoolType} ${isClosed ? "closed" : isSelectable ? "" : "disabled"}`,
    html: `<span>${schoolName}</span>`,
    iconSize: [100, 20],
    iconAnchor: [50, -20],
  })
}

export const deriveSchoolState = computeSchoolState

export const createReactPopup = (
  schoolName: string,
  schoolType: SchoolType,
  minStudents: number | string,
  maxStudents: number | string,
  assignedStudents: number,
  isClosed: boolean,
  optimizationOption: SchoolOptimizationOption,
  displayMode: DisplayMode,
  isUpdating: boolean,
  averageDistance: number | null,
  onUpdateSchoolOption: (schoolName: string, option: SchoolOptimizationOption) => Promise<void>,
  selectionInfo: { total: number; selected: number; fixed: number },
  onToggleSchoolSelection: (schoolName: string, include: boolean) => Promise<void> | void,
  onToggleBulkFix: ((fix: boolean) => Promise<void> | void) | undefined,
  onClose: () => void,
) => {
  const popupDiv = document.createElement("div")

  const root = createRoot(popupDiv)
  const props = {
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
    // ポップアップを閉じる処理は Leaflet が自動的に行う
  }

  root.render(React.createElement(SchoolPopup, props))

  return { popupDiv, root }
}

export const createSchoolMarker = (
  feature: School,
  selectedMode: "Name_1" | "Name_2",
  displayMode: DisplayMode,
  isUpdatingSchool: boolean,
  districtData: GeoJSONData | null,
  distanceData: DistanceData | null,
  onUpdateSchoolInfoDisplay: (schoolName: string, isClosed: boolean) => void,
  onUpdateSchoolOption: (schoolName: string, option: SchoolOptimizationOption) => Promise<void>,
  onSetErrorMessage: (message: string) => void,
  selectionInfo: { total: number; selected: number; fixed: number },
  onToggleSchoolSelection: (schoolName: string, include: boolean) => Promise<void> | void,
  onToggleBulkFix: (schoolName: string, modeKey: "Name_1" | "Name_2", shouldFix: boolean) => Promise<void> | void,
) => {
  const coords = feature.geometry.coordinates
  const latlng = L.latLng(coords[1], coords[0])
  const schoolName = feature.properties.name
  const {
    optimizationOption,
    isExcludedOption,
    isClosedEffective,
    isSelectable,
    assignedSho,
    assignedChu,
    assignedByType,
  } = deriveSchoolState(feature, selectedMode, displayMode)

  const isOppositeType =
    (selectedMode === "Name_1" && schoolName.endsWith("中学校")) ||
    (selectedMode === "Name_2" && schoolName.endsWith("小学校"))
  const displayClosed =
    isOppositeType && !isExcludedOption && optimizationOption !== "closed" && !feature.properties.isClosed
      ? false
      : isClosedEffective
  const isActiveSchool = !isExcludedOption && !displayClosed

  let iconClass: "elementary" | "middle" | "disabled" | "closed" | "forced"

  // ★ 強制開校は最優先で黄色に
  if (optimizationOption === "forced_open" && isActiveSchool) {
    iconClass = "forced"
  } else if (isExcludedOption) {
    iconClass = "disabled"
  } else if (displayClosed) {
    iconClass = "closed"
  } else {
    // モード(selectedMode)に関わらず、学校名でアイコン色を決定する
    // これにより、小学校モード中に表示される中学校も赤色になります
    iconClass = schoolName.endsWith("小学校") ? "elementary" : "middle"
  }

  const icon = createSchoolIcon(iconClass)

  const marker = L.marker(latlng, {
    icon: icon,
    pane: isExcludedOption
      ? "disabledSchoolPane"
      : displayClosed
        ? "closedSchoolPane"
        : "schoolPane", // モード違いでも active なら schoolPane に出す
  })

  const minStudents = feature.properties.min_students ?? "不明"
  const maxStudents = feature.properties.max_students ?? "不明"
  const assignedStudents = assignedByType

  const schoolType: SchoolType = schoolName.endsWith("小学校")
    ? "小学校"
    : schoolName.endsWith("中学校")
      ? "中学校"
      : "その他"

  const modeKey: "Name_1" | "Name_2" | null =
    schoolType === "小学校" ? "Name_1" : schoolType === "中学校" ? "Name_2" : null

  // 平均通学距��を計算
  const averageDistance =
    districtData && distanceData
      ? calculateSchoolAverageDistance(districtData, distanceData, schoolName, selectedMode, displayMode)
      : null

  // ポップアップの状態管理
  let currentPopup: { popupDiv: HTMLElement; root: Root } | null = null
  let isUnmounting = false

  // ポップアップの動的作成関数
  const selectionData = selectionInfo || { total: 0, selected: 0, fixed: 0 }
  const bulkFixHandler =
    modeKey && typeof onToggleBulkFix === "function"
      ? (fix: boolean) => onToggleBulkFix(schoolName, modeKey, fix)
      : undefined

  const createPopupContent = () => {
    const { popupDiv, root } = createReactPopup(
      schoolName,
      schoolType,
      minStudents,
      maxStudents,
      assignedStudents,
      isClosedEffective,
      optimizationOption,
      displayMode,
      isUpdatingSchool,
      averageDistance,
      onUpdateSchoolOption,
      selectionData,
      onToggleSchoolSelection,
      bulkFixHandler,
      () => marker.closePopup(),
    )
    return { popupDiv, root }
  }

  // 安全にルートをアンマウントする関数
  const safeUnmountRoot = (popupData: { popupDiv: HTMLElement; root: Root }) => {
    if (isUnmounting) return
    isUnmounting = true

    // 非同期でアンマウントを実行
    setTimeout(() => {
      try {
        if (popupData.root) {
          popupData.root.unmount()
        }
      } catch (error) {
        console.warn("ポップアップのアンマウント中にエラーが発生しました:", error)
      } finally {
        isUnmounting = false
      }
    }, 0)
  }

  marker.on("popupopen", () => {
    // 既存のポップアップがあれば安全にアンマウント
    if (currentPopup) {
      safeUnmountRoot(currentPopup)
      currentPopup = null
    }

    // 新しいポップアップを作成
    currentPopup = createPopupContent()
    marker.setPopupContent(currentPopup.popupDiv)

    const ensurePopupVisible = () => {
      const mapInstance = (marker as L.Marker & { _map?: L.Map })._map
      const popupInstance = marker.getPopup()
      const popupEl = popupInstance?.getElement()
      const mapContainer = mapInstance?.getContainer()

      if (!mapInstance || !popupEl || !mapContainer) return

      const popupRect = popupEl.getBoundingClientRect()
      const mapRect = mapContainer.getBoundingClientRect()
      const horizontalPadding = 16
      const verticalPadding = 24

      let moveX = 0
      let moveY = 0

      if (popupRect.left < mapRect.left + horizontalPadding) {
        moveX = -(mapRect.left + horizontalPadding - popupRect.left)
      } else if (popupRect.right > mapRect.right - horizontalPadding) {
        moveX = popupRect.right - (mapRect.right - horizontalPadding)
      }

      if (popupRect.top < mapRect.top + verticalPadding) {
        moveY = -(mapRect.top + verticalPadding - popupRect.top)
      } else if (popupRect.bottom > mapRect.bottom - verticalPadding) {
        moveY = popupRect.bottom - (mapRect.bottom - verticalPadding)
      }

      if (moveX !== 0 || moveY !== 0) {
        mapInstance.panBy([moveX, moveY], { animate: true, duration: 0.25 })
      }
    }

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(ensurePopupVisible)
      window.setTimeout(ensurePopupVisible, 200)
    }

    if (!isClosedEffective && !isExcludedOption) {
      onUpdateSchoolInfoDisplay(schoolName, isClosedEffective ?? false)
    } else {
      const message = isExcludedOption
        ? "対象外に設定した学校は選択できません"
        : "廃校の学校は選択できません"
      onSetErrorMessage(message)
    }
  })

  marker.on("popupclose", () => {
    if (currentPopup) {
      safeUnmountRoot(currentPopup)
      currentPopup = null
    }
  })

  // マーカーが削除される際のクリーンアップ
  marker.on("remove", () => {
    if (currentPopup) {
      safeUnmountRoot(currentPopup)
      currentPopup = null
    }
  })

  // 初期ポップアップの設定（空のdivで初期化）
  const initialDiv = document.createElement("div")
  marker.bindPopup(initialDiv, {
    maxWidth: 300,
    className: "school-popup",
    autoPan: true,
    // サイドパネル・ヘッダーに隠れないよう十分な余白を確保して自動パンさせる
    autoPanPaddingTopLeft: L.point(340, 160),
    autoPanPaddingBottomRight: L.point(60, 160),
  })

  return {
    marker,
    state: {
      optimizationOption,
      isExcluded: isExcludedOption,
      isClosed: displayClosed,
      isSelectable: !displayClosed && !isExcludedOption,
      assignedSho,
      assignedChu,
      assignedByType,
    },
  }
}
