import type { DistanceData } from "@/lib/calculate-average-distance"
import type { GeoJSONData, DisplayMode, SchoolGeoJSONData } from "@/types/map-types"

// 1. 管理する状態を一つのオブジェクトにまとめる型
export interface MapState {
  // データ関連
  districtData: GeoJSONData | null
  originalDistrictData: GeoJSONData | null
  optimizedDistrictData: GeoJSONData | null
  schoolData: SchoolGeoJSONData | null
  distanceData: DistanceData | null

  // UI状態
  selectedSchool: string | null
  selectedSchoolIsClosed: boolean
  displayMode: DisplayMode
  currentZoom: number
  showComparisonView: boolean

  // エラー・ローディング状態
  errorMessage: string | null
  isLoading: boolean
  isOptimizing: boolean
  isUpdatingSchool: boolean

  // 計算結果
  averageDistance: number | null
}

// 2. 状態を更新するための「指示書」となるActionの型
export type MapAction =
  // データ初期化
  | {
      type: "SET_INITIAL_DATA"
      payload: {
        districtData: GeoJSONData
        originalDistrictData: GeoJSONData
        schoolData: SchoolGeoJSONData
        distanceData: DistanceData | null
      }
    }
  | { type: "SET_DISTRICT_DATA"; payload: GeoJSONData }
  | { type: "SET_OPTIMIZED_DISTRICT_DATA"; payload: GeoJSONData | null }
  | { type: "SET_SCHOOL_DATA"; payload: SchoolGeoJSONData }

  // UI状態変更
  | { type: "SELECT_SCHOOL"; payload: { schoolName: string | null; isClosed: boolean } }
  | { type: "CLEAR_SCHOOL_SELECTION" }
  | { type: "SET_DISPLAY_MODE"; payload: DisplayMode }
  | { type: "SET_CURRENT_ZOOM"; payload: number }
  | { type: "SET_SHOW_COMPARISON_VIEW"; payload: boolean }

  // エラー・ローディング状態
  | { type: "SET_ERROR_MESSAGE"; payload: string | null }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_OPTIMIZING"; payload: boolean }
  | { type: "SET_UPDATING_SCHOOL"; payload: boolean }

  // 計算結果
  | { type: "SET_AVERAGE_DISTANCE"; payload: number | null }

  // 複合操作
  | {
      type: "RESET_TO_INITIAL_STATE"
      payload: { originalDistrictData: GeoJSONData; schoolData: SchoolGeoJSONData }
    }
  | {
      type: "UPDATE_SCHOOL_STATUS"
      payload: { schoolName: string; isClosed: boolean; updatedSchoolData: SchoolGeoJSONData }
    }
  | {
      type: "UPDATE_DISTRICT_ASSIGNMENT"
      payload: { districtId: string; schoolName: string; mode: "Name_1" | "Name_2" }
    }

// 3. 初期状態の定義は utils/map-reducer.ts に移動しました
// export const initialMapState: MapState = { ... }
